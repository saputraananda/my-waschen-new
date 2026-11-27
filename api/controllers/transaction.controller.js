import { myWaschenPool } from '../db/pool.js';
import { emitDashboardRefresh } from '../socket.js';
import { applyTransactionSpendingUpdate } from '../utils/spendingTier.js';
import { applyDepositOnPayment } from '../utils/customerDeposit.js';
import { insertPaymentLog, resolvePaymentStatus, buildPaymentProofUrl } from '../utils/paymentLog.js';
import { resolvePaidAt, backdateNote } from '../utils/backdatePayment.js';
import { computeAccumulatedWorkPercentage, refreshHeaderWorkPercentage, nextLifecycleStatus, workStatusTabSql } from '../utils/workStatus.js';
import { consumeServiceBom } from '../utils/inventoryStock.js';
import { generateAccessCode } from '../utils/accessCode.js';
import { getOutletFlags } from '../utils/dropPointOutlet.js';
import { getEmployeeNames, fillFallbackNames } from '../utils/employeeName.js';
import { buildCustomerTrackingUrl } from '../utils/customerTrackingUrl.js';
import { attachQueueNo } from '../utils/queueNo.js';
import { fetchSmartlinkWorkLog, groupSmartlinkWork, isSmartlinkTransaction, smartlinkEmployeeIds } from '../utils/smartlinkWorkLog.js';
import { collectPhotoUrls, insertItemPhotos, loadItemPhotos, MAX_ITEM_PHOTOS } from '../utils/itemPhotos.js';
import { safeUnlinkUploadUrl, replaceUploadUrl, safeUnlinkAbsPath, buildUploadPublicUrl, isItemPhotoUrl, ITEM_PHOTO_SUBDIR, DELETE_REQUEST_SUBDIR, REFUND_REQUEST_SUBDIR } from '../middleware/upload.js';
import { REFUND_TYPES, findPendingRefund, insertRefundRequest, REFUND_SUMMARY_COLUMNS } from '../utils/transactionRefund.js';
import { findLastPayment, findPendingVoid } from '../utils/paymentVoid.js';
import { toWibYmdCompact, formatWibTime } from '../utils/wib.js';
import { isShiftOptionalCashier, resolveValidCashier } from '../utils/cashierGuard.js';
import { getMemberNotaInfo } from '../utils/memberNota.js';
import { auditOrderPricing, priceCheckMode } from '../utils/priceAudit.js';
import { AVAILABLE_SQL, EFFECTIVE_CATEGORY_ID_SQL } from '../utils/serviceOutlet.js';
import { insertCleanoxItemsForDetail, getCleanoxItemsByTransaction, attachCleanoxHoldCount } from '../utils/cleanoxItems.js';
import path from 'path';
import crypto from 'crypto';

const resolveCashierName = async (employeeId) => {
  const id = Number(employeeId);
  if (!id) return null;
  try {
    const [roleRows] = await myWaschenPool.query(
      `SELECT employee_name FROM mst_role
       WHERE employee_id = ?
         AND employee_name IS NOT NULL AND TRIM(employee_name) != ''
       LIMIT 1`,
      [id]
    );
    if (roleRows[0]?.employee_name) return roleRows[0].employee_name;
    // Manajemen tidak ada di mst_role: ambil dari mst_employee
    return (await getEmployeeNames([id])).get(id) || null;
  } catch (err) {
    console.warn('resolveCashierName:', err.message);
    return null;
  }
};

/**
 * Helper to generate order number (nota):
 * Format: WL{outlet_code}{YYYYMMDD}{4 digit acak} (Tanpa Strip)
 * Example: WLRH202610291234, WLCG202610290507
 * Ekor acak (bukan urut) sebagai penanda mudah dibedakan oleh tim produksi. Keunikan dijamin oleh
 * pengecekan di bawah + GET_LOCK per outlet di pemanggil + UNIQUE uq_order_no.
 */
const generateOrderNo = async (outletId = 2, db = myWaschenPool) => {
  const dateStr = toWibYmdCompact(); // YYYYMMDD

  // 1. Get outlet_code from DB
  let outletCode = 'CG';
  try {
    const [outlets] = await db.query(
      'SELECT outlet_code, name FROM mst_outlet WHERE id = ? LIMIT 1',
      [outletId]
    );
    if (outlets.length > 0) {
      if (outlets[0].outlet_code) {
        outletCode = outlets[0].outlet_code;
      } else if (outlets[0].name) {
        const name = outlets[0].name.trim();
        const words = name.split(/\s+/);
        outletCode = words.length > 1
          ? words.map(w => w[0].toUpperCase()).join('')
          : words[0].slice(0, 3).toUpperCase();
      }
    }
  } catch (e) {
    console.error('Error fetching outlet_code for order_no:', e.message);
  }

  const prefix = `WL${outletCode}${dateStr}`;

  // Cek lewat pool (koneksi lain, snapshot baru): nota yang baru di-commit pemegang kunci sebelumnya
  // pasti terlihat. Lewat 30 percobaan (hari sangat padat) ekor diperpanjang jadi 5 digit.
  for (let attempt = 0; attempt < 60; attempt += 1) {
    const digits = attempt < 30 ? 4 : 5;
    const candidate = `${prefix}${String(crypto.randomInt(0, 10 ** digits)).padStart(digits, '0')}`;
    const [taken] = await myWaschenPool.query('SELECT 1 FROM tr_transaction WHERE order_no = ? LIMIT 1', [candidate]);
    if (!taken.length) return candidate;
  }
  throw new Error('Gagal membuat nomor nota unik, coba lagi.');
};

/** Nota Smartlink: karyawan tak ditemukan di mst_employee -> pakai nama asli pembuat nota. */
const useLegacyCashierName = (rows) => {
  for (const r of rows) {
    if (r?.legacy_cashier_name && /^Kasir #\d+$/.test(String(r.cashier_name || ''))) r.cashier_name = r.legacy_cashier_name;
  }
};

/**
 * POST /api/transactions
 * Buat transaksi nota POS baru (Step 4 Checkout)
 */
export const createTransaction = async (req, res) => {
  const connection = await myWaschenPool.getConnection();
  let orderNoLock = null;
  try {
    await connection.beginTransaction();

    const {
      customerId,
      outletId,
      cashierEmployeeId,
      shiftId,
      orderCategory,
      totalWeightKg,
      totalPcs,
      speedId,
      speedName,
      parfumeId,
      parfumeName,
      subtotal,
      speedSurcharge,
      discountAmount,
      discountNotes,
      grandTotal,
      paymentStatus,
      paymentMethod,
      paidAmount,
      paymentProofUrl,
      isDelivery,
      deliveryAddress,
      deliveryNotes,
      specialNotes,
      items
    } = req.body;

    if (!customerId || !items || items.length === 0) {
      await connection.rollback();
      return res.status(400).json({
        success: false,
        message: 'Customer ID dan rincian item keranjang wajib diisi'
      });
    }

    const resolvedCustomerId = parseInt(customerId, 10);
    if (!resolvedCustomerId || Number.isNaN(resolvedCustomerId)) {
      await connection.rollback();
      return res.status(400).json({
        success: false,
        message: 'Customer ID tidak valid. Pilih ulang pelanggan dari daftar.'
      });
    }

    const [custCheck] = await connection.query(
      'SELECT id, name, phone, COALESCE(full_address, address) AS address FROM mst_customer WHERE id = ? AND is_active = 1 LIMIT 1',
      [resolvedCustomerId]
    );
    if (!custCheck.length) {
      await connection.rollback();
      return res.status(404).json({
        success: false,
        message: 'Pelanggan tidak ditemukan'
      });
    }

    if (!Number(cashierEmployeeId) || Number.isNaN(Number(cashierEmployeeId))) {
      await connection.rollback();
      return res.status(400).json({
        success: false,
        message: 'cashierEmployeeId wajib diisi dari verifikasi PIN frontliner'
      });
    }
    const resolvedCashierId = await resolveValidCashier(connection, req, cashierEmployeeId);
    if (!resolvedCashierId) {
      await connection.rollback();
      return res.status(400).json({ success: false, message: 'Kasir tidak terdaftar. Verifikasi ulang PIN frontliner.' });
    }

    // Gate shift — jangan percaya shiftId dari client, tentukan sendiri di server.
    // Selain Frontliner bebas buat nota tanpa shift; notanya diklaim shift outlet
    // berikutnya yang dibuka (lihat adoptOrphanTransactions di shift.controller.js).
    const resolvedOutletId = parseInt(outletId, 10) || 2;
    const shiftOptional = await isShiftOptionalCashier(connection, resolvedCashierId);
    // Semua outlet (biasa maupun Drop Point) harus aktif untuk membuat nota baru.
    const outletFlags = await getOutletFlags(resolvedOutletId, connection);
    if (outletFlags.is_active !== 1) {
      await connection.rollback();
      return res.status(409).json({
        success: false,
        message: 'Outlet ini sedang tidak aktif, tidak bisa membuat nota.'
      });
    }

    // Shift wajib hanya bila outlet diset requires_shift = 1 (diatur admin di SuperApp).
    let resolvedShiftId = null;
    if (outletFlags.requires_shift === 1) {
      const [openShiftRows] = await connection.query(
        `SELECT id FROM tr_cashier_shift WHERE outlet_id = ? AND status = 'Open' ORDER BY id DESC LIMIT 1`,
        [resolvedOutletId]
      );
      // Selain Frontliner: shift opsional — ikut shift yang sedang terbuka bila ada, bila tidak notanya yatim
      if (shiftOptional) {
        resolvedShiftId = openShiftRows[0]?.id || null;
      } else if (!openShiftRows.length) {
        await connection.rollback();
        return res.status(409).json({
          success: false,
          message: 'Belum ada shift yang dibuka di outlet ini. Buka shift dulu sebelum membuat transaksi.',
          requireOpenShift: true
        });
      } else {
        resolvedShiftId = openShiftRows[0].id;
      }
    }

    const cashierNameResolved = await resolveCashierName(resolvedCashierId);

    // Serialkan penomoran per outlet sampai commit: dua nota bersamaan tidak boleh dapat nomor sama.
    const lockName = `wl_order_no_${resolvedOutletId}`;
    const [[lockRow]] = await connection.query('SELECT GET_LOCK(?, 15) AS got', [lockName]);
    if (Number(lockRow?.got) !== 1) {
      await connection.rollback();
      return res.status(503).json({ success: false, message: 'Sistem sedang sibuk membuat nota, coba lagi sebentar.' });
    }
    orderNoLock = lockName;
    const orderNo = await generateOrderNo(outletId, connection);
    const accessCode = generateAccessCode();
    const grandTotalNum = parseFloat(grandTotal) || 0;

    // Audit harga di server (total dari klien tidak dipercaya begitu saja).
    const audit = await auditOrderPricing(connection, { items, subtotal, discountAmount, grandTotal, speedId, outletId: resolvedOutletId });
    if (audit.fatal.length) {
      await connection.rollback();
      return res.status(400).json({ success: false, message: `Nota ditolak: ${audit.fatal.join('; ')}` });
    }
    if (audit.issues.length) {
      console.warn(`[PRICE-CHECK] ${orderNo} outlet=${resolvedOutletId} kasir=${resolvedCashierId}: ${audit.issues.join(' | ')}`);
      if (priceCheckMode() === 'enforce') {
        await connection.rollback();
        return res.status(400).json({ success: false, message: 'Total nota tidak sesuai harga layanan. Muat ulang halaman lalu coba lagi.' });
      }
    }
    const isOutstanding = paymentStatus === 'Outstanding';
    const isLunas = paymentStatus === 'Lunas';
    const isDP = paymentStatus === 'DP';

    if (!isOutstanding && !isLunas && !isDP) {
      await connection.rollback();
      return res.status(400).json({
        success: false,
        message: 'Status pembayaran wajib Lunas, DP, atau Outstanding'
      });
    }

    // Nominal bayar dikunci: Lunas = grand_total, tanpa kembalian (Phase 13).
    // Kelebihan bayar diajukan lewat aksi Refund di Riwayat.
    let resolvedPaidAmount = 0;
    const resolvedChangeAmount = 0;
    let resolvedStatus = paymentStatus;
    let depositResult = null;

    if (isOutstanding) {
      resolvedStatus = 'Outstanding';
      resolvedPaidAmount = 0;
    } else if (isLunas) {
      depositResult = await applyDepositOnPayment(connection, {
        customerId: resolvedCustomerId,
        orderNo,
        grandTotal: grandTotalNum,
        paymentMethod,
        outletId: outletId || 2,
        cashierEmployeeId: resolvedCashierId
      });
      resolvedPaidAmount = depositResult.paidAmount;
      resolvedStatus = 'Lunas';
    } else if (isDP) {
      resolvedPaidAmount = parseFloat(paidAmount) || 0;
      if (resolvedPaidAmount <= 0 || resolvedPaidAmount >= grandTotalNum) {
        await connection.rollback();
        return res.status(400).json({
          success: false,
          message: 'Nominal DP harus lebih dari 0 dan kurang dari total tagihan'
        });
      }
      resolvedStatus = 'DP';
    }

    let resolvedParfumeId = parfumeId || null;
    if (!resolvedParfumeId && parfumeName) {
      const [parfumeRows] = await connection.query(
        'SELECT id FROM mst_parfume WHERE name = ? AND is_active = 1 LIMIT 1',
        [parfumeName]
      );
      resolvedParfumeId = parfumeRows[0]?.id || null;
    }

    // 1. Insert tr_transaction (+ access_code untuk nota digital)
    let orderResult;
    try {
      [orderResult] = await connection.query(
        `INSERT INTO tr_transaction 
         (order_no, barcode, customer_id, outlet_id, cashier_employee_id, shift_id, order_category, total_weight_kg, total_pcs, speed_id, parfume_id, subtotal, speed_surcharge, discount_amount, discount_notes, grand_total, payment_status, payment_method, paid_amount, change_amount, payment_proof_url, paid_at, work_status, is_delivery, delivery_address, delivery_notes, special_notes, order_date, access_code)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 10, ?, ?, ?, ?, NOW(), ?)`,
        [
          orderNo,
          orderNo,
          resolvedCustomerId,
          resolvedOutletId,
          resolvedCashierId,
          resolvedShiftId,
          orderCategory || 'Kiloan',
          parseFloat(totalWeightKg) || 0,
          parseInt(totalPcs) || 0,
          speedId || null,
          resolvedParfumeId,
          parseFloat(subtotal) || 0,
          parseFloat(speedSurcharge) || 0,
          parseFloat(discountAmount) || 0,
          discountNotes || null,
          grandTotalNum,
          resolvedStatus,
          isOutstanding ? '-' : (paymentMethod || 'Tunai'),
          resolvedPaidAmount,
          resolvedChangeAmount,
          paymentProofUrl || null,
          isOutstanding ? null : new Date(),
          isDelivery ? 1 : 0,
          deliveryAddress || null,
          deliveryNotes || null,
          specialNotes || null,
          accessCode
        ]
      );
    } catch (colErr) {
      if (!/Unknown column.*access_code/i.test(colErr.message || '')) throw colErr;
      // Kolom belum dimigrasi — tetap buat nota tanpa access_code
      [orderResult] = await connection.query(
        `INSERT INTO tr_transaction 
         (order_no, barcode, customer_id, outlet_id, cashier_employee_id, shift_id, order_category, total_weight_kg, total_pcs, speed_id, parfume_id, subtotal, speed_surcharge, discount_amount, discount_notes, grand_total, payment_status, payment_method, paid_amount, change_amount, payment_proof_url, paid_at, work_status, is_delivery, delivery_address, delivery_notes, special_notes, order_date)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 10, ?, ?, ?, ?, NOW())`,
        [
          orderNo,
          orderNo,
          resolvedCustomerId,
          resolvedOutletId,
          resolvedCashierId,
          resolvedShiftId,
          orderCategory || 'Kiloan',
          parseFloat(totalWeightKg) || 0,
          parseInt(totalPcs) || 0,
          speedId || null,
          resolvedParfumeId,
          parseFloat(subtotal) || 0,
          parseFloat(speedSurcharge) || 0,
          parseFloat(discountAmount) || 0,
          discountNotes || null,
          grandTotalNum,
          resolvedStatus,
          isOutstanding ? '-' : (paymentMethod || 'Tunai'),
          resolvedPaidAmount,
          resolvedChangeAmount,
          paymentProofUrl || null,
          isOutstanding ? null : new Date(),
          isDelivery ? 1 : 0,
          deliveryAddress || null,
          deliveryNotes || null,
          specialNotes || null
        ]
      );
    }

    const transactionId = orderResult.insertId;

    // 2. Insert tr_transaction_detail + potong stok BOM layanan (jika ada)
    // is_production dari master kategori (bukan dari client): 0 = biaya tambahan, langsung Selesai, tidak masuk QC/produksi
    const itemServiceIds = items.map((it) => parseInt(it.serviceId || it.serviceDbId || it.id, 10));
    if (itemServiceIds.some((id) => !Number.isInteger(id) || id <= 0)) {
      await connection.rollback();
      return res.status(400).json({ success: false, message: 'Ada item tanpa id layanan yang valid. Muat ulang halaman lalu pilih ulang layanan.' });
    }
    const serviceIds = [...new Set(itemServiceIds)];
    // Kategori efektif per outlet (override di mst_service_outlet, jika kosong ikut master).
    const [prodRows] = serviceIds.length
      ? await connection.query(
        `SELECT s.id, COALESCE(so.name, s.name) AS name,
                COALESCE(c.is_production, 1) AS is_production, COALESCE(so.is_dc_required, s.is_dc_required, 0) AS is_dc_required,
                ${AVAILABLE_SQL} AS available
         FROM mst_service s
         LEFT JOIN mst_service_outlet so ON so.service_id = s.id AND so.outlet_id = ?
         LEFT JOIN mst_service_category c ON c.id = ${EFFECTIVE_CATEGORY_ID_SQL}
         WHERE s.id IN (?)`,
        [resolvedOutletId, serviceIds]
      )
      : [[]];
    // Semua id layanan wajib ada di master.
    const foundIds = new Set(prodRows.map((r) => Number(r.id)));
    const unknownIds = serviceIds.filter((id) => !foundIds.has(id));
    if (unknownIds.length) {
      await connection.rollback();
      return res.status(400).json({
        success: false,
        message: `Layanan tidak ditemukan: #${unknownIds.join(', #')}. Muat ulang halaman lalu pilih ulang layanan.`
      });
    }
    // Layanan hanya boleh dipakai di outlet tempat layanan itu tersedia (mst_service_outlet).
    const unavailable = prodRows.filter((r) => Number(r.available) !== 1);
    if (unavailable.length) {
      await connection.rollback();
      return res.status(400).json({
        success: false,
        message: `Layanan tidak tersedia di outlet ini: ${unavailable.map((r) => r.name).join(', ')}. Muat ulang halaman lalu pilih ulang layanan.`
      });
    }
    const productionOf = new Map(prodRows.map((r) => [r.id, Number(r.is_production)]));
    const dcRequiredOf = new Map(prodRows.map((r) => [r.id, Number(r.is_dc_required) === 1]));
    if (!items.some((it) => productionOf.get(parseInt(it.serviceId || it.serviceDbId || it.id, 10)) !== 0)) {
      await connection.rollback();
      return res.status(400).json({ success: false, message: 'Nota wajib berisi minimal 1 layanan cucian (bukan hanya biaya tambahan)' });
    }

    // Estimasi selesai = durasi TERLAMA (regular_duration_days) dari layanan produksi di nota,
    // dikali pengali kecepatan (Express 0.5, min 24 jam). Disimpan ke estimated_finished_at.
    try {
      const prodIds = serviceIds.filter((id) => productionOf.get(id) !== 0);
      let maxDays = 0;
      if (prodIds.length) {
        const [durRows] = await connection.query(
          `SELECT MAX(COALESCE(so.regular_duration_days, s.regular_duration_days)) AS d
           FROM mst_service s
           LEFT JOIN mst_service_outlet so ON so.service_id = s.id AND so.outlet_id = ?
           WHERE s.id IN (?)`,
          [resolvedOutletId, prodIds]
        );
        maxDays = Number(durRows[0]?.d) || 0;
      }
      let mult = 1;
      let speedHours = 48;
      if (speedId) {
        const [spRows] = await connection.query(
          'SELECT duration_multiplier, duration_hours FROM mst_service_speed WHERE id = ? LIMIT 1',
          [speedId]
        );
        mult = Number(spRows[0]?.duration_multiplier) || 1;
        speedHours = Number(spRows[0]?.duration_hours) || 48;
      }
      const hours = maxDays > 0 ? Math.max(24, Math.round(maxDays * 24 * mult)) : speedHours;
      await connection.query(
        'UPDATE tr_transaction SET estimated_finished_at = DATE_ADD(NOW(), INTERVAL ? HOUR) WHERE id = ?',
        [hours, orderResult.insertId]
      );
    } catch (estErr) {
      console.error('Gagal menghitung estimasi selesai:', estErr.message);
    }

    const inventoryUsages = [];
    let cleanoxOutletName;
    for (const item of items) {
      const serviceId = parseInt(item.serviceId || item.serviceDbId || item.id, 10);
      const mustDc = dcRequiredOf.get(parseInt(serviceId, 10)) === true;
      const isDryClean = mustDc || (item.isDryClean || item.is_dry_clean || item.laundryMethodId === 2 || item.laundry_method_id === 2) ? true : false;
      const laundryMethodId = isDryClean ? 2 : (parseInt(item.laundryMethodId || item.laundry_method_id, 10) || 1);
      const lineQty = parseFloat(item.qty) || 1;
      const fulfillmentType = isDelivery ? 'Delivery_Kurir' : 'Ambil_Di_Outlet';
      const isProduction = productionOf.get(parseInt(serviceId, 10)) === 0 ? 0 : 1;
      const photoUrls = collectPhotoUrls(item, isItemPhotoUrl);
      const detailParams = [
        transactionId,
        serviceId,
        item.serviceName || item.name || 'Layanan Laundry',
        isProduction,
        lineQty,
        item.unit || 'Kg',
        parseFloat(item.unitPrice || item.price) || 0,
        parseFloat(item.subtotal || item.effectiveSubtotal || ((item.qty || 1) * (item.price || 0))) || 0,
        item.isCleanox ? 1 : 0,
        laundryMethodId,
        item.brand || null,
        item.color || null,
        item.material || null,
        item.size || null,
        item.conditionNotes || null,
        isProduction ? 'Antrean' : 'Selesai',
        isProduction ? null : new Date(),
        photoUrls[0] || null, // sampul; semua foto di tr_transaction_detail_photo
        fulfillmentType
      ];

      const [detailResult] = await connection.query(
        `INSERT INTO tr_transaction_detail
         (transaction_id, service_id, service_name, is_production, qty, unit, unit_price, subtotal, is_cleanox, laundry_method_id, brand, color, material, size, condition_notes, item_work_status, item_completed_at, photo_url, fulfillment_type)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        detailParams
      );
      await insertItemPhotos(connection, {
        transactionId,
        detailId: detailResult.insertId,
        urls: photoUrls,
        uploadedBy: resolvedCashierId
      });
      // Phase 17: item Cleanox By Waschen -> antrean produksi Cleanox (1 baris per barang fisik)
      if (item.isCleanox && isProduction) {
        if (cleanoxOutletName === undefined) {
          const [[o]] = await connection.query('SELECT name FROM mst_outlet WHERE id = ?', [resolvedOutletId]);
          cleanoxOutletName = o?.name || null;
        }
        await insertCleanoxItemsForDetail(connection, {
          transactionId,
          detailId: detailResult.insertId,
          orderNo,
          outletId: resolvedOutletId,
          outletName: cleanoxOutletName,
          customer: custCheck[0],
          serviceName: item.serviceName || item.name || 'Layanan Laundry',
          unit: item.unit || 'Kg',
          qty: lineQty,
          subtotal: detailParams[7],
          receivedAt: new Date()
        });
      }
      // Pemakaian BOM dicatat di outlet nota (termasuk Drop Point). Bila item Drop Point nanti
      // didistribusikan, log dipindah ke outlet produksi (dropPointDistribution.controller.js).
      try {
        const used = await consumeServiceBom(connection, {
          outletId: resolvedOutletId,
          serviceId,
          lineQty,
          employeeId: resolvedCashierId,
          transactionId,
          orderNo,
          detailId: detailResult.insertId
        });
        if (used.length) inventoryUsages.push(...used);
      } catch (invErr) {
        // Jangan gagalkan transaksi POS hanya karena stok — log & lanjut
        console.warn('consumeServiceBom skip:', invErr.message);
      }
    }

    // 3. Insert initial status log
    await connection.query(
      `INSERT INTO tr_transaction_status_log 
       (transaction_id, status, employee_id, notes)
       VALUES (?, 'Antrean', ?, 'Cetak Nota Diterima oleh Kasir')`,
      [transactionId, resolvedCashierId]
    );

    if (!isOutstanding) {
      await insertPaymentLog(connection, {
        transactionId,
        logType: resolvedStatus === 'Lunas' ? 'Lunas' : 'DP',
        amount: resolvedPaidAmount,
        paymentMethod: paymentMethod || 'Tunai',
        paymentProofUrl: paymentProofUrl || null,
        notes: resolvedStatus === 'DP' ? `DP nota ${orderNo}` : `Pembayaran lunas nota ${orderNo}`,
        cashierEmployeeId: resolvedCashierId
      });
    } else {
      await insertPaymentLog(connection, {
        transactionId,
        logType: 'Outstanding',
        amount: 0,
        paymentMethod: null,
        paymentProofUrl: null,
        notes: `Nota outstanding — pelanggan taruh cucian & pergi (${orderNo})`,
        cashierEmployeeId: resolvedCashierId
      });
    }

    // 4. Update customer spending summary & auto tier
    await applyTransactionSpendingUpdate(connection, resolvedCustomerId, grandTotalNum);

    await connection.commit();

    if (depositResult?.depositDelta) {
      emitDashboardRefresh('customer:updated', {
        outletId: outletId || 2,
        customerId: resolvedCustomerId
      });
    }

    // Fetch full created order with items
    const [fullOrder] = await myWaschenPool.query(
      `SELECT t.*,
              t.customer_id,
              c.customer_code,
              c.name as customer_name,
              c.phone as customer_phone,
              COALESCE(c.deposit_balance, 0) as member_balance,
              COALESCE(c.deposit_balance, 0) as customer_deposit_balance,
              ct.name as customer_tier,
              COALESCE(NULLIF(TRIM(c.full_address), ''), NULLIF(TRIM(c.address), ''), '-') as customer_address,
              c.home_branch,
              COALESCE(o.full_name, o.name, c.home_branch, 'Outlet Waschen') as outlet_name
       FROM tr_transaction t
       LEFT JOIN mst_customer c ON c.id = t.customer_id
       LEFT JOIN mst_customer_tier ct ON c.spending_tier_id = ct.id
       LEFT JOIN mst_outlet o ON o.id = t.outlet_id
       WHERE t.id = ?`,
      [transactionId]
    );

    const [orderItems] = await myWaschenPool.query(
      `SELECT td.*,
              (CASE WHEN td.laundry_method_id = 2 THEN 1 ELSE 0 END) as is_dry_clean,
              COALESCE(ml.name, 'Wet Clean') as laundry_method_name,
              COALESCE(ml.code, 'WC') as laundry_method_code
       FROM tr_transaction_detail td
       LEFT JOIN mst_method_laundry ml ON ml.id = td.laundry_method_id
       WHERE td.transaction_id = ?`,
      [transactionId]
    );

    await attachQueueNo(myWaschenPool, fullOrder);
    const resultData = fullOrder[0];
    resultData.items = orderItems;
    resultData.cashier_employee_id = resolvedCashierId;
    resultData.cashier_name = cashierNameResolved || `Karyawan #${resolvedCashierId}`;

    emitDashboardRefresh('transaction:created', {
      outletId: resultData.outlet_id,
      orderNo: orderNo,
      transactionId
    });

    return res.status(201).json({
      success: true,
      message: `Nota ${orderNo} berhasil disimpan & siap cetak struk POS`,
      data: {
        ...resultData,
        access_code: resultData.access_code || accessCode,
        tracking_url: buildCustomerTrackingUrl(orderNo),
        deposit_delta: depositResult?.depositDelta || 0,
        inventory_usages: inventoryUsages,
        balance_after: depositResult?.balanceAfter ?? null
      }
    });
  } catch (error) {
    await connection.rollback();
    console.error('Error creating POS transaction:', error);
    const isClientError = /tidak cukup|kurang dari|tidak ditemukan/i.test(error.message || '');
    return res.status(isClientError ? 400 : 500).json({
      success: false,
      message: error.message || 'Gagal memproses transaksi nota',
      error: error.message
    });
  } finally {
    if (orderNoLock) {
      try { await connection.query('SELECT RELEASE_LOCK(?)', [orderNoLock]); } catch { /* lock ikut lepas saat koneksi ditutup */ }
    }
    connection.release();
  }
};

/**
 * GET /api/transactions
 * Mengambil daftar transaksi nota untuk Dashboard Antrean & Riwayat Transaksi
 */
export const getTransactions = async (req, res) => {
  try {
    const { outlet_id, work_status, payment_status, category, search, limit } = req.query;
    // lite=1: daftar ringkas (riwayat). Tanpa item, log, dan subquery batch pembayaran.
    const lite = req.query.lite === '1' || req.query.lite === 'true';

    let sql = `
      SELECT t.*, 
             t.customer_id,
             c.customer_code,
             c.name as customer_name, 
             c.phone as customer_phone, 
             COALESCE(c.deposit_balance, 0) as member_balance,
             COALESCE(c.deposit_balance, 0) as customer_deposit_balance,
             ct.name as customer_tier,
             COALESCE(NULLIF(TRIM(c.full_address), ''), NULLIF(TRIM(c.address), ''), '-') as customer_address,
             c.home_branch,
             COALESCE(o.full_name, o.name, c.home_branch, 'Outlet Waschen') as outlet_name,
             sp.name as speed_name,
             p.name as parfume_name,
             COALESCE(NULLIF(TRIM(cr.employee_name), ''), IF(t.cashier_employee_id > 0, CONCAT('Kasir #', t.cashier_employee_id), NULL), t.legacy_cashier_name, CONCAT('Kasir #', t.cashier_employee_id)) as cashier_name,
             ${REFUND_SUMMARY_COLUMNS}
             ${lite ? '' : `,
             (
               SELECT b.batch_no
               FROM tr_payment_batch_item bi
               JOIN tr_payment_batch b ON b.id = bi.batch_id
               WHERE bi.transaction_id = t.id
               ORDER BY bi.id DESC
               LIMIT 1
             ) as payment_batch_no,
             (
               SELECT b.id
               FROM tr_payment_batch_item bi
               JOIN tr_payment_batch b ON b.id = bi.batch_id
               WHERE bi.transaction_id = t.id
               ORDER BY bi.id DESC
               LIMIT 1
             ) as payment_batch_id`}
      FROM tr_transaction t
      LEFT JOIN mst_customer c ON c.id = t.customer_id
      LEFT JOIN mst_customer_tier ct ON c.spending_tier_id = ct.id
      LEFT JOIN mst_outlet o ON o.id = t.outlet_id
      LEFT JOIN mst_service_speed sp ON t.speed_id = sp.id
      LEFT JOIN mst_parfume p ON t.parfume_id = p.id
      LEFT JOIN mst_role cr ON cr.employee_id = t.cashier_employee_id
      WHERE 1=1
    `;
    const params = [];

    // Jendela tanggal (WIB, YYYY-MM-DD) agar riwayat tidak menarik seluruh nota sepanjang masa.
    // include_delete_requested=1: nota pengajuan hapus tetap ikut walau di luar jendela.
    const dateRe = /^\d{4}-\d{2}-\d{2}$/;
    const dateFrom = dateRe.test(String(req.query.date_from || '')) ? req.query.date_from : null;
    const dateTo = dateRe.test(String(req.query.date_to || '')) ? req.query.date_to : null;
    if (dateFrom || dateTo) {
      const parts = [];
      if (dateFrom) { parts.push('t.order_date >= ?'); params.push(`${dateFrom} 00:00:00`); }
      if (dateTo) { parts.push('t.order_date < DATE_ADD(?, INTERVAL 1 DAY)'); params.push(`${dateTo} 00:00:00`); }
      const keepDel = req.query.include_delete_requested === '1' ? ' OR t.is_delete_requested = 1' : '';
      sql += ` AND ((${parts.join(' AND ')})${keepDel})`;
    }

    // delete_requested=only → hanya nota pengajuan hapus (tab Request Delete); exclude → tanpa itu (Riwayat).
    // Termasuk yang ditolak SuperApp (is_delete_requested kembali 0, delete_approval_status = 2) sebagai riwayat.
    if (req.query.delete_requested === 'only') sql += ' AND (t.is_delete_requested = 1 OR t.delete_approval_status = 2)';
    if (req.query.delete_requested === 'exclude') sql += ' AND COALESCE(t.is_delete_requested, 0) = 0';

    if (outlet_id && outlet_id !== 'Semua') {
      sql += ' AND t.outlet_id = ?';
      params.push(outlet_id);
    }

    if (work_status && work_status !== 'Semua') {
      const clause = workStatusTabSql(work_status, 't.work_status');
      sql += ` AND ${clause.sql}`;
      params.push(...clause.params);
    }

    if (req.query.customer_id) {
      sql += ' AND t.customer_id = ?';
      params.push(req.query.customer_id);
    }

    if (payment_status && payment_status !== 'Semua') {
      // Status lama 'Belum Lunas' setara Outstanding (normalizePaymentStatus di frontend)
      if (payment_status === 'Outstanding') {
        sql += " AND (t.payment_status IN ('Outstanding', 'Belum Lunas') OR t.payment_status IS NULL OR t.payment_status = '')";
      } else {
        sql += ' AND t.payment_status = ?';
        params.push(payment_status);
      }
    }

    if (category && category !== 'Semua') {
      sql += ' AND t.order_category = ?';
      params.push(category);
    }

    if (search && search.trim()) {
      sql += ' AND (t.order_no LIKE ? OR c.name LIKE ? OR c.phone LIKE ? OR sp.name LIKE ?)';
      const s = `%${search.trim()}%`;
      params.push(s, s, s, s);
    }

    // Paginasi server (page_size diisi): Riwayat bisa menampilkan semua periode tanpa menarik semua nota.
    const pageSize = Math.min(200, Math.max(1, parseInt(req.query.page_size, 10) || 0));
    const paginate = Boolean(parseInt(req.query.page_size, 10));
    let total = null;
    let rows;
    if (paginate) {
      // Cepat untuk semua periode (±120rb nota):
      //  - hitung total tanpa JOIN (customer/layanan hanya dibutuhkan saat mencari);
      //  - ambil id halaman ini dulu lewat indeks order_date, baru JOIN kolom lengkap + subquery
      //    refund untuk 25 baris itu saja (bukan seluruh nota sebelum diurutkan).
      const FROM_LINE = '      FROM tr_transaction t\n';
      const fromIdx = sql.indexOf(FROM_LINE);
      const whereIdx = sql.indexOf('      WHERE 1=1');
      const selectPart = sql.slice(0, fromIdx);
      const joinPart = sql.slice(fromIdx + FROM_LINE.length, whereIdx);
      const wherePart = sql.slice(whereIdx);
      const searchJoins = search && search.trim()
        ? ' LEFT JOIN mst_customer c ON c.id = t.customer_id LEFT JOIN mst_service_speed sp ON t.speed_id = sp.id'
        : '';
      const [[cnt]] = await myWaschenPool.query(
        `SELECT COUNT(*) AS total FROM tr_transaction t${searchJoins} ${wherePart}`,
        params
      );
      total = Number(cnt?.total) || 0;
      const page = Math.max(1, parseInt(req.query.page, 10) || 1);
      [rows] = await myWaschenPool.query(
        `${selectPart}      FROM tr_transaction t
         JOIN (
           SELECT t.id FROM tr_transaction t${searchJoins} ${wherePart}
           ORDER BY t.order_date DESC, t.id DESC
           LIMIT ? OFFSET ?
         ) pg ON pg.id = t.id
${joinPart}      ORDER BY t.order_date DESC, t.id DESC`,
        [...params, pageSize, (page - 1) * pageSize]
      );
    } else {
      sql += ' ORDER BY t.order_date DESC, t.id DESC';
      if (limit) {
        sql += ' LIMIT ?';
        params.push(parseInt(limit));
      }
      [rows] = await myWaschenPool.query(sql, params);
    }
    await attachQueueNo(myWaschenPool, rows);
    await fillFallbackNames(rows, 'cashier_employee_id', 'cashier_name');
    useLegacyCashierName(rows);
    await attachCleanoxHoldCount(myWaschenPool, rows);

    if (lite) {
      return res.status(200).json({
        success: true,
        ...(paginate ? { total } : {}),
        data: rows.map((order) => ({
          ...order,
          items: [],
          logs: [],
          createdAtFormatted: formatWibTime(order.order_date)
        }))
      });
    }

    // Item & log diambil sekali untuk seluruh halaman, bukan 2 query per nota.
    const ids = rows.map((order) => order.id);
    const logsByTxn = new Map();
    const itemsByTxn = new Map();
    if (ids.length) {
      const [allLogs] = await myWaschenPool.query(
        `SELECT transaction_id, notes, status
         FROM tr_transaction_status_log
         WHERE transaction_id IN (?)
         ORDER BY id ASC`,
        [ids]
      );
      const [allItems] = await myWaschenPool.query(
        `SELECT td.*,
                COALESCE(td.service_name, s.name) as service_name,
                s.code as service_code
         FROM tr_transaction_detail td
         LEFT JOIN mst_service s ON s.id = td.service_id
         WHERE td.transaction_id IN (?)`,
        [ids]
      );
      for (const log of allLogs) {
        const list = logsByTxn.get(log.transaction_id) || [];
        list.push(log.notes || log.status);
        logsByTxn.set(log.transaction_id, list);
      }
      for (const item of allItems) {
        const list = itemsByTxn.get(item.transaction_id) || [];
        list.push(item);
        itemsByTxn.set(item.transaction_id, list);
      }
    }

    const enriched = rows.map((order) => ({
      ...order,
      items: itemsByTxn.get(order.id) || [],
      logs: logsByTxn.get(order.id) || [],
      createdAtFormatted: formatWibTime(order.order_date)
    }));

    return res.status(200).json({
      success: true,
      data: enriched
    });
  } catch (error) {
    console.error('Error fetching transactions:', error);
    return res.status(500).json({
      success: false,
      message: 'Gagal mengambil data transaksi',
      error: error.message
    });
  }
};

/**
 * GET /api/transactions/:orderNo
 * Ambil rincian nota by ID / orderNo untuk Lacak Nota & Thermal Receipt Modal
 */
export const getTransactionDetail = async (req, res) => {
  try {
    const { orderNo } = req.params;
    const key = String(orderNo || '').trim();

    const [orderRows] = await myWaschenPool.query(
      `SELECT t.*,
              t.customer_id,
              c.customer_code,
              c.name as customer_name,
              c.phone as customer_phone,
              COALESCE(c.deposit_balance, 0) as member_balance,
              COALESCE(c.deposit_balance, 0) as customer_deposit_balance,
              ct.name as customer_tier,
              COALESCE(NULLIF(TRIM(c.full_address), ''), NULLIF(TRIM(c.address), ''), '-') as customer_address,
              c.home_branch,
              COALESCE(o.full_name, o.name, c.home_branch, 'Outlet Waschen') as outlet_name,
              sp.name as speed_name,
              p.name as parfume_name,
              COALESCE(NULLIF(TRIM(r.employee_name), ''), IF(t.cashier_employee_id > 0, CONCAT('Kasir #', t.cashier_employee_id), NULL), t.legacy_cashier_name, CONCAT('Kasir #', t.cashier_employee_id)) as cashier_name,
              COALESCE(NULLIF(TRIM(rs.employee_name), ''), IF(t.settled_by_employee_id IS NULL, NULL, CONCAT('Karyawan #', t.settled_by_employee_id))) as settled_by_name,
              (
                SELECT b.batch_no
                FROM tr_payment_batch_item bi
                JOIN tr_payment_batch b ON b.id = bi.batch_id
                WHERE bi.transaction_id = t.id
                ORDER BY bi.id DESC
                LIMIT 1
              ) as payment_batch_no,
              (
                SELECT b.id
                FROM tr_payment_batch_item bi
                JOIN tr_payment_batch b ON b.id = bi.batch_id
                WHERE bi.transaction_id = t.id
                ORDER BY bi.id DESC
                LIMIT 1
              ) as payment_batch_id
       FROM tr_transaction t
       LEFT JOIN mst_customer c ON c.id = t.customer_id
       LEFT JOIN mst_customer_tier ct ON c.spending_tier_id = ct.id
       LEFT JOIN mst_outlet o ON o.id = t.outlet_id
       LEFT JOIN mst_service_speed sp ON t.speed_id = sp.id
       LEFT JOIN mst_parfume p ON t.parfume_id = p.id
       LEFT JOIN mst_role r ON r.employee_id = t.cashier_employee_id
       LEFT JOIN mst_role rs ON rs.employee_id = t.settled_by_employee_id
       WHERE t.order_no = ? OR t.barcode = ? OR t.id = ?
       ORDER BY CASE
         WHEN t.order_no = ? THEN 0
         WHEN t.barcode = ? THEN 1
         ELSE 2
       END, t.id DESC
       LIMIT 1`,
      [key, key, key, key, key]
    );

    if (orderRows.length === 0) {
      return res.status(404).json({
        success: false,
        message: `Nota ${orderNo} tidak ditemukan`
      });
    }

    const order = orderRows[0];
    await attachQueueNo(myWaschenPool, [order]);
    await fillFallbackNames([order], 'cashier_employee_id', 'cashier_name');
    useLegacyCashierName([order]);
    await fillFallbackNames([order], 'settled_by_employee_id', 'settled_by_name');

    const [items] = await myWaschenPool.query(
      `SELECT td.*,
              s.code as service_code,
              (CASE WHEN td.laundry_method_id = 2 THEN 1 ELSE 0 END) as is_dry_clean,
              COALESCE(ml.name, 'Wet Clean') as laundry_method_name,
              COALESCE(ml.code, 'WC') as laundry_method_code
       FROM tr_transaction_detail td
       LEFT JOIN mst_service s ON s.id = td.service_id
       LEFT JOIN mst_method_laundry ml ON ml.id = td.laundry_method_id
       WHERE td.transaction_id = ?`,
      [order.id]
    );

    const [logs] = await myWaschenPool.query(
      'SELECT * FROM tr_transaction_status_log WHERE transaction_id = ? ORDER BY id ASC',
      [order.id]
    );

    // Alur pengerjaan per item: QC produksi (tr_item_progress) + riwayat lama Smartlink
    const PROGRESS_LABELS = {
      frontliner: 'Frontliner', washing: 'Pencucian', ironing: 'Penyetrikaan',
      packing: 'Pengemasan', delivery: 'Pengiriman', handover: 'Serah Terima'
    };
    const [[progressRows], smartlinkRows] = await Promise.all([
      myWaschenPool.query(
        `SELECT id, transaction_detail_id, stage, employee_id, employee_name, qc_status, qc_decision, notes, status, completed_at, created_at
         FROM tr_item_progress WHERE transaction_id = ? ORDER BY completed_at ASC, id ASC`,
        [order.id]
      ),
      isSmartlinkTransaction(order)
        ? fetchSmartlinkWorkLog((sql, params) => myWaschenPool.query(sql, params), order.id)
        : Promise.resolve([])
    ]);
    const workerNames = await getEmployeeNames([
      ...progressRows.map((p) => p.employee_id),
      ...smartlinkEmployeeIds(smartlinkRows)
    ]);
    const smartlinkByDetail = groupSmartlinkWork(items, smartlinkRows, (eid) => workerNames.get(eid) || null);
    const byTime = (a, b) => new Date(a.completed_at || a.created_at || 0) - new Date(b.completed_at || b.created_at || 0);
    const photosByDetail = await loadItemPhotos((sql, params) => myWaschenPool.query(sql, params), items);
    for (const it of items) {
      it.photos = photosByDetail[it.id] || [];
      const progress = progressRows
        .filter((p) => Number(p.transaction_detail_id) === Number(it.id))
        .map((p) => ({
          ...p,
          source: 'pos',
          stage_label: PROGRESS_LABELS[p.stage] || p.stage,
          employee_name: p.employee_name || workerNames.get(Number(p.employee_id)) || null,
          completed_at: p.completed_at || p.created_at
        }));
      it.workers = [...(smartlinkByDetail[it.id] || []), ...progress].sort(byTime);
    }

    order.items = items;
    order.logs = logs;
    order.cleanoxItems = items.some((it) => Number(it.is_cleanox) === 1)
      ? await getCleanoxItemsByTransaction(myWaschenPool, order.id)
      : [];

    return res.status(200).json({
      success: true,
      data: order
    });
  } catch (error) {
    console.error('Error fetching transaction detail:', error);
    return res.status(500).json({
      success: false,
      message: 'Gagal mengambil detail nota',
      error: error.message
    });
  }
};

/**
 * PATCH /api/transactions/:id/fulfillment
 * Ubah nota/item dari Ambil di Outlet → Delivery (atau sebaliknya).
 * Body: { isDelivery, itemIds?, deliveryAddress?, deliveryNotes?, employeeId?, notes? }
 * - itemIds kosong/null = seluruh item aktif
 * - Jika jadi delivery & status item "Siap Diambil" → otomatis "Siap Diantar"
 */
export const updateFulfillment = async (req, res) => {
  try {
    const { id } = req.params;
    const {
      isDelivery,
      itemIds,
      deliveryAddress,
      deliveryNotes,
      employeeId,
      notes
    } = req.body;

    if (typeof isDelivery !== 'boolean' && isDelivery !== 0 && isDelivery !== 1) {
      return res.status(400).json({
        success: false,
        message: 'isDelivery wajib diisi (true/false)'
      });
    }

    const toDelivery = isDelivery === true || isDelivery === 1;
    const fulfillmentType = toDelivery ? 'Delivery_Kurir' : 'Ambil_Di_Outlet';

    const [orderRows] = await myWaschenPool.query(
      `SELECT t.*,
              COALESCE(NULLIF(TRIM(t.delivery_address), ''), NULLIF(TRIM(c.full_address), ''), NULLIF(TRIM(c.address), ''), '-') AS customer_address_fallback
       FROM tr_transaction t
       LEFT JOIN mst_customer c ON c.id = t.customer_id
       WHERE t.id = ?
       LIMIT 1`,
      [id]
    );
    if (orderRows.length === 0) {
      return res.status(404).json({ success: false, message: 'Nota tidak ditemukan' });
    }
    const order = orderRows[0];

    const [allItems] = await myWaschenPool.query(
      `SELECT id, item_work_status, fulfillment_type
       FROM tr_transaction_detail
       WHERE transaction_id = ?
         AND COALESCE(item_work_status, '') != 'Dibatalkan'`,
      [id]
    );
    if (allItems.length === 0) {
      return res.status(422).json({ success: false, message: 'Nota tidak punya item aktif' });
    }

    const selectedIds = Array.isArray(itemIds) && itemIds.length > 0
      ? itemIds.map((x) => Number(x)).filter((x) => Number.isFinite(x) && x > 0)
      : allItems.map((it) => it.id);

    const targetItems = allItems.filter((it) => selectedIds.includes(it.id));
    if (targetItems.length === 0) {
      return res.status(422).json({ success: false, message: 'Item yang dipilih tidak valid' });
    }

    const targetIdList = targetItems.map((it) => it.id);
    const placeholders = targetIdList.map(() => '?').join(',');

    // Update fulfillment_type (+ sesuaikan Siap Diambil/Diantar)
    if (toDelivery) {
      await myWaschenPool.query(
        `UPDATE tr_transaction_detail
         SET fulfillment_type = ?,
             item_work_status = CASE
               WHEN item_work_status = 'Siap Diambil' THEN 'Siap Diantar'
               ELSE item_work_status
             END
         WHERE transaction_id = ?
           AND id IN (${placeholders})`,
        [fulfillmentType, id, ...targetIdList]
      );
    } else {
      await myWaschenPool.query(
        `UPDATE tr_transaction_detail
         SET fulfillment_type = ?,
             item_work_status = CASE
               WHEN item_work_status = 'Siap Diantar' THEN 'Siap Diambil'
               ELSE item_work_status
             END
         WHERE transaction_id = ?
           AND id IN (${placeholders})`,
        [fulfillmentType, id, ...targetIdList]
      );
    }

    const [afterItems] = await myWaschenPool.query(
      `SELECT id, fulfillment_type, item_work_status
       FROM tr_transaction_detail
       WHERE transaction_id = ?
         AND COALESCE(item_work_status, '') != 'Dibatalkan'`,
      [id]
    );
    const hasDeliveryItem = afterItems.some((it) => it.fulfillment_type === 'Delivery_Kurir');
    const headerIsDelivery = hasDeliveryItem ? 1 : 0;

    let nextAddress = order.delivery_address;
    let nextNotes = order.delivery_notes;
    if (headerIsDelivery) {
      const addr = String(deliveryAddress || '').trim();
      nextAddress = addr || order.delivery_address || order.customer_address_fallback || null;
      if (deliveryNotes !== undefined) nextNotes = String(deliveryNotes || '').trim() || null;
    } else if (!hasDeliveryItem) {
      // Semua item kembali ambil di outlet — kosongkan alamat antar opsional
      if (deliveryAddress === '' || deliveryAddress === null) nextAddress = null;
      if (deliveryNotes === '' || deliveryNotes === null) nextNotes = null;
    }

    await myWaschenPool.query(
      `UPDATE tr_transaction
       SET is_delivery = ?,
           delivery_address = ?,
           delivery_notes = ?,
           updated_at = NOW()
       WHERE id = ?`,
      [headerIsDelivery, nextAddress, nextNotes, id]
    );

    const accumulated = await refreshHeaderWorkPercentage(myWaschenPool, id);

    const scopeLabel = selectedIds.length === allItems.length
      ? 'seluruh item'
      : `${targetItems.length} item`;
    const logNote = notes
      || (toDelivery
        ? `Pengambilan diubah ke Delivery (${scopeLabel})`
        : `Pengambilan diubah ke Ambil di Outlet (${scopeLabel})`);

    await myWaschenPool.query(
      'INSERT INTO tr_transaction_status_log (transaction_id, status, employee_id, notes) VALUES (?, ?, ?, ?)',
      [
        id,
        toDelivery ? 'Siap Diantar' : 'Siap Diambil',
        employeeId || 167,
        logNote
      ]
    );

    emitDashboardRefresh('transaction:updated', {
      outletId: order.outlet_id,
      orderNo: order.order_no,
      transactionId: Number(id),
      workStatus: accumulated,
      isDelivery: headerIsDelivery
    });

    return res.status(200).json({
      success: true,
      message: toDelivery
        ? `Nota ${order.order_no} berhasil diubah ke Delivery (${scopeLabel})`
        : `Nota ${order.order_no} berhasil diubah ke Ambil di Outlet (${scopeLabel})`,
      data: {
        orderId: Number(id),
        orderNo: order.order_no,
        isDelivery: headerIsDelivery,
        fulfillmentType,
        deliveryAddress: nextAddress,
        deliveryNotes: nextNotes,
        updatedItemIds: targetIdList,
        workStatus: accumulated,
        items: afterItems
      }
    });
  } catch (error) {
    console.error('Error updateFulfillment:', error);
    if (/Unknown column.*fulfillment_type/i.test(error.message || '')) {
      return res.status(500).json({
        success: false,
        message: 'Fitur pengambilan/antar sedang dalam perbaikan. Silakan coba lagi nanti atau hubungi admin.'
      });
    }
    return res.status(500).json({
      success: false,
      message: 'Gagal mengubah metode pengambilan',
      error: error.message
    });
  }
};

/**
 * PATCH /api/transactions/:id/status
 * Memajukan tahapan status pengerjaan (Antrean -> Pencucian -> Penyetrikaan -> Pengemasan -> Siap Diambil/Diantar -> Selesai)
 * Juga menyelaraskan semua item ke status yang sama (opsional jika syncItems !== false).
 */
export const updateWorkStatus = async (req, res) => {
  try {
    const { id } = req.params;
    const { status, workStatus, employeeId, notes, syncItems = true } = req.body;

    const [orderRows] = await myWaschenPool.query('SELECT * FROM tr_transaction WHERE id = ?', [id]);
    if (orderRows.length === 0) {
      return res.status(404).json({ success: false, message: 'Nota tidak ditemukan' });
    }

    const order = orderRows[0];
    let nextStatus = status || workStatus;

    if (!nextStatus) {
      nextStatus = nextLifecycleStatus(order.work_status, order.is_delivery === 1);
    }

    if (syncItems !== false) {
      await myWaschenPool.query(
        'UPDATE tr_transaction_detail SET item_work_status = ? WHERE transaction_id = ? AND is_production = 1',
        [nextStatus, id]
      );
    }

    const accumulated = await refreshHeaderWorkPercentage(myWaschenPool, id);

    const logNote = notes || `Status pengerjaan item diseragamkan ke ${nextStatus} (rata-rata nota: ${accumulated}%)`;
    await myWaschenPool.query(
      'INSERT INTO tr_transaction_status_log (transaction_id, status, employee_id, notes) VALUES (?, ?, ?, ?)',
      [id, nextStatus, employeeId || 167, logNote]
    );

    emitDashboardRefresh('transaction:updated', {
      outletId: order.outlet_id,
      orderNo: order.order_no,
      transactionId: Number(id),
      workStatus: accumulated
    });

    return res.status(200).json({
      success: true,
      message: `Status nota ${order.order_no} berhasil diupdate (rata-rata ${accumulated}%)`,
      data: {
        orderId: id,
        orderNo: order.order_no,
        workStatus: accumulated
      }
    });
  } catch (error) {
    console.error('Error updating work status:', error);
    return res.status(500).json({
      success: false,
      message: 'Gagal memperbarui status pengerjaan',
      error: error.message
    });
  }
};

/**
 * PATCH /api/transactions/:id/items/:itemId/status
 * Update status pengerjaan per item; akumulasi nota dihitung ulang dari semua item.
 */
export const updateItemWorkStatus = async (req, res) => {
  try {
    const { id, itemId } = req.params;
    const { status, workStatus, employeeId, notes } = req.body;
    const nextStatus = status || workStatus;

    if (!nextStatus) {
      return res.status(400).json({ success: false, message: 'Status pengerjaan wajib diisi' });
    }

    const [orderRows] = await myWaschenPool.query(
      'SELECT * FROM tr_transaction WHERE id = ? OR order_no = ? LIMIT 1',
      [id, id]
    );
    if (!orderRows.length) {
      return res.status(404).json({ success: false, message: 'Nota tidak ditemukan' });
    }
    const order = orderRows[0];

    const [itemRows] = await myWaschenPool.query(
      'SELECT * FROM tr_transaction_detail WHERE id = ? AND transaction_id = ? LIMIT 1',
      [itemId, order.id]
    );
    if (!itemRows.length) {
      return res.status(404).json({ success: false, message: 'Item cucian tidak ditemukan pada nota ini' });
    }
    const item = itemRows[0];
    if (Number(item.is_production) === 0) {
      return res.status(422).json({ success: false, message: 'Biaya tambahan tidak memiliki status pengerjaan' });
    }

    await myWaschenPool.query(
      'UPDATE tr_transaction_detail SET item_work_status = ? WHERE id = ?',
      [nextStatus, item.id]
    );

    const [allItems] = await myWaschenPool.query(
      'SELECT id, item_work_status FROM tr_transaction_detail WHERE transaction_id = ? AND is_production = 1',
      [order.id]
    );
    const accumulated = computeAccumulatedWorkPercentage(
      allItems.map((i) => (i.id === item.id ? nextStatus : (i.item_work_status || 'Antrean')))
    );

    await myWaschenPool.query(
      'UPDATE tr_transaction SET work_status = ?, updated_at = NOW() WHERE id = ?',
      [accumulated, order.id]
    );

    // Semua item aktif Selesai → isi picked_up_at (keluar dari filter Di Ruko)
    const statusesForPickup = allItems.map((i) =>
      i.id === item.id ? nextStatus : (i.item_work_status || 'Antrean')
    );
    const activeStatuses = statusesForPickup.filter((s) => s !== 'Dibatalkan');
    if (activeStatuses.length > 0 && activeStatuses.every((s) => s === 'Selesai')) {
      await myWaschenPool.query(
        `UPDATE tr_transaction
         SET picked_up_at = COALESCE(picked_up_at, NOW())
         WHERE id = ?`,
        [order.id]
      );
    }

    const logNote = notes
      || `Item "${item.service_name}" → ${nextStatus} (rata-rata nota: ${accumulated}%)`;
    await myWaschenPool.query(
      'INSERT INTO tr_transaction_status_log (transaction_id, status, employee_id, notes) VALUES (?, ?, ?, ?)',
      [order.id, nextStatus, employeeId || 167, logNote]
    );

    emitDashboardRefresh('transaction:updated', {
      outletId: order.outlet_id,
      orderNo: order.order_no,
      transactionId: order.id,
      workStatus: accumulated,
      itemId: Number(itemId),
      itemWorkStatus: nextStatus
    });

    return res.status(200).json({
      success: true,
      message: `Status item diperbarui ke ${nextStatus}`,
      data: {
        orderId: order.id,
        orderNo: order.order_no,
        itemId: Number(itemId),
        itemWorkStatus: nextStatus,
        workStatus: accumulated,
        items: allItems.map((i) => ({
          id: i.id,
          itemWorkStatus: i.id === item.id ? nextStatus : (i.item_work_status || 'Antrean')
        }))
      }
    });
  } catch (error) {
    console.error('Error updating item work status:', error);
    return res.status(500).json({
      success: false,
      message: 'Gagal memperbarui status item',
      error: error.message
    });
  }
};

/**
 * PATCH /api/transactions/:id/pay
 * Pelunasan pembayaran nota di kasir
 */
export const markTransactionAsPaid = async (req, res) => {
  const connection = await myWaschenPool.getConnection();
  try {
    const { id } = req.params;
    const { paymentMethod, cashierEmployeeId } = req.body;

    await connection.beginTransaction();

    const [orderRows] = await connection.query('SELECT * FROM tr_transaction WHERE id = ?', [id]);
    if (orderRows.length === 0) {
      await connection.rollback();
      return res.status(404).json({ success: false, message: 'Nota tidak ditemukan' });
    }

    const order = orderRows[0];
    // Shift dicek di outlet nota; outlet tanpa shift (requires_shift = 0) boleh melunasi tanpa shift.
    // Selain Frontliner shift opsional: pembayarannya masuk ke shift outlet berikutnya yang dibuka
    // (rentang pembayaran shift dimulai dari closing shift sebelumnya, lihat getShiftPaymentFrom).
    const orderOutletFlags = await getOutletFlags(order.outlet_id, connection);
    const [openShiftRows] = await connection.query(
      `SELECT id FROM tr_cashier_shift WHERE outlet_id = ? AND status = 'Open' ORDER BY id DESC LIMIT 1`,
      [order.outlet_id]
    );
    const payActorId = (await resolveValidCashier(connection, req, cashierEmployeeId)) || Number(req.auth?.employeeId) || null;
    if (!openShiftRows.length && orderOutletFlags.requires_shift === 1
      && !(await isShiftOptionalCashier(connection, payActorId))) {
      await connection.rollback();
      return res.status(409).json({
        success: false,
        message: 'Pelunasan hanya bisa saat shift outlet sedang terbuka'
      });
    }
    const method = paymentMethod || 'Tunai';
    const grandTotalNum = parseFloat(order.grand_total) || 0;
    const remaining = Math.max(0, grandTotalNum - (parseFloat(order.paid_amount) || 0));
    if (remaining <= 0) {
      await connection.rollback();
      return res.status(400).json({ success: false, message: `Nota ${order.order_no} sudah lunas` });
    }

    // Nominal dikunci = sisa tagihan (Phase 13)
    const depositResult = await applyDepositOnPayment(connection, {
      customerId: order.customer_id,
      orderNo: order.order_no,
      grandTotal: remaining,
      paymentMethod: method,
      outletId: order.outlet_id,
      cashierEmployeeId: cashierEmployeeId || order.cashier_employee_id
    });

    const settlerId = cashierEmployeeId || order.cashier_employee_id || null;
    const paidNow = remaining;

    await insertPaymentLog(connection, {
      transactionId: order.id,
      logType: 'Lunas',
      amount: paidNow,
      paymentMethod: method,
      paymentProofUrl: null,
      notes: `Pelunasan nota ${order.order_no}`,
      cashierEmployeeId: settlerId
    });

    await connection.query(
      `UPDATE tr_transaction 
       SET payment_status = 'Lunas',
           payment_method = ?,
           paid_amount = ?,
           change_amount = 0,
           paid_at = NOW(),
           settled_by_employee_id = ?,
           settled_at = NOW(),
           updated_at = NOW()
       WHERE id = ?`,
      [method, grandTotalNum, settlerId, id]
    );

    await connection.commit();

    emitDashboardRefresh('transaction:paid', {
      outletId: order.outlet_id,
      orderNo: order.order_no,
      transactionId: Number(id)
    });

    if (depositResult.depositDelta) {
      emitDashboardRefresh('customer:updated', {
        outletId: order.outlet_id,
        customerId: order.customer_id
      });
    }

    return res.status(200).json({
      success: true,
      message: `Nota ${order.order_no} telah lunas terbayar via ${method}`,
      data: {
        orderId: id,
        orderNo: order.order_no,
        paymentStatus: 'Lunas',
        paymentMethod: method,
        paidAmount: grandTotalNum,
        changeAmount: 0,
        depositDelta: depositResult.depositDelta,
        balanceAfter: depositResult.balanceAfter
      }
    });
  } catch (error) {
    await connection.rollback();
    console.error('Error marking order as paid:', error);
    return res.status(error.message?.includes('tidak cukup') || error.message?.includes('kurang')
      ? 400
      : 500).json({
      success: false,
      message: error.message || 'Gagal melunasi pembayaran nota',
      error: error.message
    });
  } finally {
    connection.release();
  }
};

/**
 * PATCH /api/transactions/:id/request-delete
 * Pengajuan Hapus Nota oleh Kasir (Status = Pending / 0, Menunggu Approval = 1)
 * Jika nota sudah dibayar, ikut dibuat pengajuan refund sebesar paid_amount
 * (Saldo Member → jenis Deposit, selain itu → Refund) agar admin Alsa bisa
 * mengembalikan dana. Wajib melampirkan foto/PDF pendukung (multipart field `attachment`).
 */
export const requestDeleteTransaction = async (req, res) => {
  let saved = false;
  const connection = await myWaschenPool.getConnection();
  try {
    const { id } = req.params;
    const { reason } = req.body;

    if (!req.file) {
      return res.status(400).json({ success: false, message: 'Lampiran foto/dokumen wajib disertakan untuk pengajuan hapus nota.' });
    }
    const attachmentUrl = buildUploadPublicUrl(`${DELETE_REQUEST_SUBDIR}/${path.basename(req.file.filename || req.file.path)}`);

    await connection.beginTransaction();
    const [orderRows] = await connection.query(
      'SELECT * FROM tr_transaction WHERE id = ? OR order_no = ? LIMIT 1 FOR UPDATE',
      [id, id]
    );
    if (orderRows.length === 0) {
      await connection.rollback();
      return res.status(404).json({ success: false, message: 'Nota tidak ditemukan' });
    }

    const order = orderRows[0];
    if (order.is_delete_requested) {
      await connection.rollback();
      return res.status(400).json({
        success: false,
        message: `Nota ${order.order_no} sudah dalam pengajuan hapus`
      });
    }
    if (await findPendingVoid(connection, order.id)) {
      await connection.rollback();
      return res.status(400).json({
        success: false,
        message: `Nota ${order.order_no} sedang dalam pengajuan hapus pelunasan — tunggu keputusan SuperApp dulu`
      });
    }

    const paidAmount = parseFloat(order.paid_amount) || 0;
    const isMemberPay = /saldo member/i.test(order.payment_method || '');
    const pending = paidAmount > 0 ? await findPendingRefund(connection, order.id) : null;
    const shouldRefundOnDelete = paidAmount > 0 && !pending;

    await connection.query(
      `UPDATE tr_transaction
       SET is_delete_requested = 1,
           delete_approval_status = 0,
           delete_requested_at = NOW(),
           delete_reason = ?,
           delete_attachment_url = ?,
           updated_at = NOW()
       WHERE id = ?`,
      [reason || 'Request Hapus Nota oleh Kasir', attachmentUrl, order.id]
    );
    // Siapa yang mengajukan (kolom dari agent/migrate_delete_requested_by.sql; abaikan bila belum dimigrasi)
    await connection.query(
      'UPDATE tr_transaction SET delete_requested_by_employee_id = ? WHERE id = ?',
      [req.auth?.employeeId || null, order.id]
    ).catch((err) => { if (err?.code !== 'ER_BAD_FIELD_ERROR') throw err; });

    if (shouldRefundOnDelete) {
      const reasonSuffix = reason ? ` — ${reason}` : '';
      await insertRefundRequest(connection, {
        transactionId: order.id,
        refundType: isMemberPay ? 'Deposit' : 'Refund',
        source: 'Hapus Nota',
        amount: paidAmount,
        reason: `Refund akibat pengajuan hapus nota ${order.order_no}${isMemberPay ? ' (Saldo Member)' : ''}${reasonSuffix}`.slice(0, 500),
        paymentProofUrl: order.payment_proof_url || null,
        attachmentUrl,
        requestedByEmployeeId: req.auth?.employeeId || null
      });
    }

    await connection.commit();
    saved = true;
    // Pengajuan ulang: lampiran lama tidak dipakai lagi
    await replaceUploadUrl(order.delete_attachment_url, attachmentUrl);

    emitDashboardRefresh('transaction:updated', {
      outletId: order.outlet_id,
      orderNo: order.order_no,
      transactionId: order.id
    });

    return res.status(200).json({
      success: true,
      message: `Pengajuan hapus nota ${order.order_no} berhasil dikirim (Status: Pending Approval / 0)`,
      data: {
        orderId: order.id,
        orderNo: order.order_no,
        isDeleteRequested: 1,
        deleteApprovalStatus: 0,
        deleteAttachmentUrl: attachmentUrl,
        refundRequested: shouldRefundOnDelete,
        refundAmount: shouldRefundOnDelete ? paidAmount : 0
      }
    });
  } catch (error) {
    await connection.rollback();
    console.error('Error requesting transaction deletion:', error);
    return res.status(500).json({
      success: false,
      message: 'Gagal mengajukan hapus nota',
      error: error.message
    });
  } finally {
    connection.release();
    // Pengajuan gagal → hapus file lampiran yang sudah terunggah
    if (!saved && req.file?.path) await safeUnlinkAbsPath(req.file.path);
  }
};

/**
 * PATCH /api/transactions/:id/request-void-payment  (multipart, field `attachment` wajib)
 * Request Hapus Pelunasan: ajukan pembatalan PEMBAYARAN TERAKHIR nota. Nota tidak dihapus.
 * Sampai disetujui di SuperApp pembayaran tetap terhitung revenue. Setelah disetujui:
 * log pembayaran → 'Dibatalkan' (keluar dari revenue di tanggal bayar aslinya), status bayar
 * turun (Lunas → DP / Outstanding), Potong Saldo Member dikembalikan ke saldo.
 */
export const requestVoidPayment = async (req, res) => {
  let saved = false;
  const connection = await myWaschenPool.getConnection();
  try {
    const { id } = req.params;
    const reason = String(req.body?.reason || '').trim().slice(0, 500);
    if (!reason) {
      return res.status(400).json({ success: false, message: 'Alasan hapus pelunasan wajib diisi.' });
    }
    if (!req.file) {
      return res.status(400).json({ success: false, message: 'Lampiran foto/dokumen wajib disertakan.' });
    }
    const attachmentUrl = buildUploadPublicUrl(`${DELETE_REQUEST_SUBDIR}/${path.basename(req.file.filename || req.file.path)}`);

    await connection.beginTransaction();
    const [orderRows] = await connection.query(
      'SELECT * FROM tr_transaction WHERE id = ? OR order_no = ? LIMIT 1 FOR UPDATE',
      [id, id]
    );
    if (!orderRows.length) {
      await connection.rollback();
      return res.status(404).json({ success: false, message: 'Nota tidak ditemukan' });
    }
    const order = orderRows[0];
    if (order.is_delete_requested) {
      await connection.rollback();
      return res.status(400).json({ success: false, message: `Nota ${order.order_no} sedang dalam pengajuan hapus nota` });
    }
    if (await findPendingVoid(connection, order.id)) {
      await connection.rollback();
      return res.status(400).json({ success: false, message: `Nota ${order.order_no} sudah punya pengajuan hapus pelunasan yang menunggu approval` });
    }
    const last = await findLastPayment(connection, order);
    if (!last) {
      await connection.rollback();
      return res.status(400).json({ success: false, message: `Nota ${order.order_no} belum punya pembayaran untuk dihapus` });
    }

    const [ins] = await connection.query(
      `INSERT INTO tr_payment_void_request
       (transaction_id, payment_log_id, log_type, amount, payment_method, paid_at, reason, attachment_url, requested_by_employee_id)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [order.id, last.paymentLogId, last.logType, last.amount, last.paymentMethod, last.paidAt, reason, attachmentUrl, req.auth?.employeeId || null]
    );
    await connection.commit();
    saved = true;

    emitDashboardRefresh('transaction:updated', { outletId: order.outlet_id, orderNo: order.order_no, transactionId: order.id });

    return res.status(200).json({
      success: true,
      message: `Pengajuan hapus pelunasan nota ${order.order_no} (Rp ${last.amount.toLocaleString('id-ID')}) dikirim — menunggu approval`,
      data: { id: ins.insertId, orderNo: order.order_no, amount: last.amount, logType: last.logType, paymentMethod: last.paymentMethod }
    });
  } catch (error) {
    await connection.rollback().catch(() => {});
    console.error('Error requestVoidPayment:', error);
    return res.status(500).json({ success: false, message: 'Gagal mengajukan hapus pelunasan', error: error.message });
  } finally {
    connection.release();
    if (!saved && req.file?.path) await safeUnlinkAbsPath(req.file.path);
  }
};

/** GET /api/transactions/payment-voids?outlet_id= — daftar Request Hapus Pelunasan (tab Riwayat POS). */
export const getPaymentVoidRequests = async (req, res) => {
  try {
    const outletId = parseInt(req.query.outlet_id, 10) || null;
    const [rows] = await myWaschenPool.query(
      `SELECT v.*, t.order_no, t.outlet_id, t.grand_total, t.paid_amount, t.payment_status, t.order_date,
              c.name AS customer_name, c.phone AS customer_phone
       FROM tr_payment_void_request v
       JOIN tr_transaction t ON t.id = v.transaction_id
       LEFT JOIN mst_customer c ON c.id = t.customer_id
       ${outletId ? 'WHERE t.outlet_id = ?' : ''}
       ORDER BY v.requested_at DESC, v.id DESC
       LIMIT 500`,
      outletId ? [outletId] : []
    );
    const names = await getEmployeeNames(rows.flatMap((r) => [r.requested_by_employee_id, r.reviewed_by_employee_id]));
    const data = rows.map((r) => ({
      ...r,
      requested_by_name: names.get(Number(r.requested_by_employee_id)) || null,
      reviewed_by_name: names.get(Number(r.reviewed_by_employee_id)) || null
    }));
    return res.status(200).json({ success: true, data });
  } catch (error) {
    if (error?.code === 'ER_NO_SUCH_TABLE') return res.status(200).json({ success: true, data: [] });
    console.error('Error getPaymentVoidRequests:', error);
    return res.status(500).json({ success: false, message: 'Gagal mengambil pengajuan hapus pelunasan', error: error.message });
  }
};

/**
 * PATCH /api/transactions/:id/request-refund  (multipart, field `attachment` opsional)
 * Body: refundType (Refund | Deposit | Tips), refundAmount, reason, cashierEmployeeId
 * Nominal bebas (diverifikasi admin Alsa lewat bukti). Satu nota boleh punya
 * beberapa pengajuan sekaligus, termasuk saat yang lain masih Pending.
 */
export const requestRefundTransaction = async (req, res) => {
  let saved = false;
  const connection = await myWaschenPool.getConnection();
  try {
    const { id } = req.params;
    const { refundType, refundAmount, reason, cashierEmployeeId } = req.body;

    const type = REFUND_TYPES.find((t) => t.toLowerCase() === String(refundType || '').toLowerCase());
    if (!type) {
      return res.status(400).json({ success: false, message: 'Jenis refund wajib dipilih: Refund, Deposit, atau Tips' });
    }
    const amount = Math.round((parseFloat(refundAmount) || 0) * 100) / 100;
    if (amount <= 0) {
      return res.status(400).json({ success: false, message: 'Nominal refund harus lebih dari 0' });
    }
    const reasonText = String(reason || '').trim();
    if (!reasonText) {
      return res.status(400).json({ success: false, message: 'Alasan refund wajib diisi' });
    }

    // Kunci nota: pengajuan tidak bentrok dengan pengajuan hapus nota yang berjalan bersamaan
    await connection.beginTransaction();
    const [orderRows] = await connection.query(
      'SELECT * FROM tr_transaction WHERE id = ? OR order_no = ? LIMIT 1 FOR UPDATE',
      [id, id]
    );
    if (!orderRows.length) {
      await connection.rollback();
      return res.status(404).json({ success: false, message: 'Nota tidak ditemukan' });
    }

    const order = orderRows[0];
    if (order.is_delete_requested) {
      await connection.rollback();
      return res.status(400).json({
        success: false,
        message: `Nota ${order.order_no} sudah diajukan hapus. Refund ikut diproses lewat pengajuan hapus.`
      });
    }
    if ((parseFloat(order.paid_amount) || 0) <= 0) {
      await connection.rollback();
      return res.status(400).json({
        success: false,
        message: `Nota ${order.order_no} belum ada pembayaran, tidak bisa diajukan refund`
      });
    }

    const attachmentUrl = req.file
      ? buildUploadPublicUrl(`${REFUND_REQUEST_SUBDIR}/${path.basename(req.file.filename || req.file.path)}`)
      : null;

    const refundId = await insertRefundRequest(connection, {
      transactionId: order.id,
      refundType: type,
      source: 'Manual',
      amount,
      reason: reasonText.slice(0, 500),
      paymentProofUrl: order.payment_proof_url || null,
      attachmentUrl,
      requestedByEmployeeId: req.auth?.employeeId || Number(cashierEmployeeId) || null
    });
    await connection.commit();
    saved = true;

    emitDashboardRefresh('transaction:updated', {
      outletId: order.outlet_id,
      orderNo: order.order_no,
      transactionId: order.id
    });

    return res.status(200).json({
      success: true,
      message: `Pengajuan ${type} nota ${order.order_no} Rp ${amount.toLocaleString('id-ID')} berhasil dikirim (Pending Approval)`,
      data: {
        refundId,
        orderId: order.id,
        orderNo: order.order_no,
        refundType: type,
        amount,
        status: 'Pending',
        attachmentUrl
      }
    });
  } catch (error) {
    await connection.rollback().catch(() => {});
    console.error('Error requesting refund:', error);
    return res.status(500).json({
      success: false,
      message: 'Gagal mengajukan refund',
      error: error.message
    });
  } finally {
    connection.release();
    if (!saved && req.file?.path) await safeUnlinkAbsPath(req.file.path);
  }
};

/**
 * GET /api/transactions/refunds?outlet_id=
 * Daftar pengajuan refund (tab Request Refund di Riwayat POS).
 */
export const getRefundRequests = async (req, res) => {
  try {
    const outletId = parseInt(req.query.outlet_id, 10) || null;
    const params = [];
    let where = '';
    if (outletId) {
      where = 'WHERE t.outlet_id = ?';
      params.push(outletId);
    }
    const [rows] = await myWaschenPool.query(
      `SELECT rf.*,
              t.order_no, t.outlet_id, t.grand_total, t.paid_amount, t.payment_method,
              c.name AS customer_name, c.phone AS customer_phone
       FROM tr_transaction_refund rf
       JOIN tr_transaction t ON t.id = rf.transaction_id
       LEFT JOIN mst_customer c ON c.id = t.customer_id
       ${where}
       ORDER BY rf.requested_at DESC, rf.id DESC
       LIMIT 500`,
      params
    );

    const names = await getEmployeeNames(
      rows.flatMap((r) => [r.requested_by_employee_id, r.reviewed_by_employee_id])
    );
    const data = rows.map((r) => ({
      ...r,
      requested_by_name: names.get(Number(r.requested_by_employee_id)) || null,
      reviewed_by_name: names.get(Number(r.reviewed_by_employee_id)) || null
    }));

    return res.status(200).json({ success: true, data });
  } catch (error) {
    console.error('Error getRefundRequests:', error);
    return res.status(500).json({ success: false, message: 'Gagal mengambil daftar refund', error: error.message });
  }
};

/**
 * POST /api/transactions/settle-batch
 * Pelunasan gabungan multi-nota sekaligus (1 kali bayar / 1 foto bukti transfer)
 */
export const settlePaymentBatch = async (req, res) => {
  const connection = await myWaschenPool.getConnection();
  try {
    const {
      customerId,
      outletId,
      cashierEmployeeId,
      shiftId,
      paymentMethod,
      paymentProofUrl,
      items = [],
      notes,
      paidDate
    } = req.body;

    if (!items || items.length === 0) {
      return res.status(400).json({ success: false, message: 'Tidak ada nota yang dipilih untuk pelunasan.' });
    }

    const resolvedCustomerId = parseInt(customerId, 10) || null;
    if (!resolvedCustomerId) {
      return res.status(400).json({
        success: false,
        message: 'Customer ID tidak valid. Buka ulang detail pelanggan lalu coba lagi.'
      });
    }

    const [custRows] = await connection.query(
      'SELECT id, name, phone FROM mst_customer WHERE id = ? LIMIT 1',
      [resolvedCustomerId]
    );
    if (!custRows.length) {
      return res.status(404).json({ success: false, message: 'Pelanggan tidak ditemukan' });
    }
    const customerRow = custRows[0];

    // Pastikan semua nota milik pelanggan yang sama
    for (const item of items) {
      const txnId = parseInt(item.transactionId, 10);
      if (!txnId) {
        return res.status(400).json({ success: false, message: 'ID transaksi tidak valid pada daftar nota' });
      }
      const [ownRows] = await connection.query(
        'SELECT id, order_no, customer_id FROM tr_transaction WHERE id = ? LIMIT 1',
        [txnId]
      );
      if (!ownRows.length) {
        return res.status(404).json({ success: false, message: `Nota ID ${txnId} tidak ditemukan` });
      }
      if (Number(ownRows[0].customer_id) !== resolvedCustomerId) {
        return res.status(400).json({
          success: false,
          message: `Nota ${ownRows[0].order_no} bukan milik pelanggan yang dipilih`
        });
      }
    }

    await connection.beginTransaction();

    const datePrefix = toWibYmdCompact();
    const [countRows] = await connection.query(
      "SELECT COUNT(*) AS total FROM tr_payment_batch WHERE DATE(created_at) = CURDATE()"
    );
    const seq = (parseInt(countRows[0]?.total || 0) + 1).toString().padStart(3, '0');
    const batchNo = `COMB-${datePrefix}${seq}`;

    // Nominal dikunci = sisa tagihan tiap nota (Phase 13), dihitung di server.
    const lockedOrders = [];
    for (const item of items) {
      const [orderRows] = await connection.query(
        'SELECT * FROM tr_transaction WHERE id = ? FOR UPDATE',
        [item.transactionId]
      );
      if (!orderRows.length) continue;
      const order = orderRows[0];
      const remaining = Math.max(0, (parseFloat(order.grand_total) || 0) - (parseFloat(order.paid_amount) || 0));
      if (remaining > 0) lockedOrders.push({ order, remaining });
    }
    if (!lockedOrders.length) {
      await connection.rollback();
      return res.status(400).json({ success: false, message: 'Semua nota yang dipilih sudah lunas.' });
    }

    const paid = await resolvePaidAt(connection, {
      paidDate,
      transactionIds: lockedOrders.map(({ order }) => order.id)
    });
    if (paid.error) {
      await connection.rollback();
      return res.status(400).json({ success: false, message: paid.error });
    }

    const totalAmount = lockedOrders.reduce((sum, o) => sum + o.remaining, 0);
    const paidAmount = totalAmount;
    const depositAdded = 0;
    const changeAmount = 0;

    const [batchResult] = await connection.query(
      `INSERT INTO tr_payment_batch 
       (batch_no, customer_id, outlet_id, cashier_employee_id, shift_id, total_amount, payment_method, payment_proof_url, notes)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        batchNo,
        resolvedCustomerId,
        outletId || 0,
        cashierEmployeeId || 0,
        shiftId || null,
        totalAmount,
        paymentMethod || 'Tunai',
        paymentProofUrl || null,
        notes || `Pelunasan gabungan ${lockedOrders.length} nota`
      ]
    );
    const batchId = batchResult.insertId;

    const settledTransactions = [];
    const orphanedProofUrls = [];

    for (const { order, remaining } of lockedOrders) {
      const grandTotal = parseFloat(order.grand_total) || 0;
      const amountToPay = remaining;
      const newPaidAmount = grandTotal;
      const newStatus = 'Lunas';

      if (paymentProofUrl && order.payment_proof_url && paymentProofUrl !== order.payment_proof_url) {
        orphanedProofUrls.push(order.payment_proof_url);
      }

      await connection.query(
        `UPDATE tr_transaction 
         SET paid_amount = ?,
             payment_status = ?,
             payment_method = ?,
             payment_proof_url = COALESCE(?, payment_proof_url),
             paid_at = ${paid.sql},
             settled_by_employee_id = ?,
             settled_at = ${paid.sql},
             updated_at = NOW()
         WHERE id = ?`,
        [newPaidAmount, newStatus, paymentMethod, paymentProofUrl, ...paid.params, cashierEmployeeId || null, ...paid.params, order.id]
      );

      await connection.query(
        `INSERT INTO tr_payment_log 
         (transaction_id, payment_batch_id, log_type, amount, payment_method, payment_proof_url, notes, cashier_employee_id)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          order.id,
          batchId,
          newStatus,
          amountToPay,
          paymentMethod,
          paymentProofUrl,
          `Pelunasan gabungan #${batchNo}${backdateNote(paid)}`,
          cashierEmployeeId
        ]
      );

      await connection.query(
        `INSERT INTO tr_payment_batch_item (batch_id, transaction_id, allocated_amount) VALUES (?, ?, ?)`,
        [batchId, order.id, amountToPay]
      );

      settledTransactions.push({
        id: order.id,
        orderNo: order.order_no,
        orderCategory: order.order_category,
        grandTotal: grandTotal,
        amountPaidThisBatch: amountToPay,
        paymentStatus: newStatus
      });
    }

    await connection.commit();

    for (const oldUrl of orphanedProofUrls) {
      await replaceUploadUrl(oldUrl, paymentProofUrl);
    }

    emitDashboardRefresh('transaction:updated', {
      outletId,
      batchNo,
      settledCount: settledTransactions.length
    });

    return res.status(200).json({
      success: true,
      message: `Berhasil memproses pelunasan gabungan (${settledTransactions.length} nota) dengan No. Batch ${batchNo}`,
      data: {
        batchId,
        batchNo,
        customerId: resolvedCustomerId,
        customer_name: customerRow.name,
        customer_phone: customerRow.phone,
        customerName: customerRow.name,
        customerPhone: customerRow.phone,
        totalAmount,
        paidAmount,
        changeAmount,
        depositAdded,
        paymentMethod,
        paymentProofUrl,
        settledTransactions
      }
    });

  } catch (error) {
    await connection.rollback();
    console.error('Error settling batch payment:', error);
    return res.status(500).json({
      success: false,
      message: 'Gagal memproses pelunasan gabungan nota',
      error: error.message
    });
  } finally {
    connection.release();
  }
};

/**
 * GET /api/transactions/batch/:batchNo
 * Detail batch pelunasan gabungan untuk cetak nota & audit
 */
export const getPaymentBatchByNo = async (req, res) => {
  try {
    const { batchNo } = req.params;
    const [batchRows] = await myWaschenPool.query(
      `SELECT b.*, 
              c.name as customer_name, 
              c.phone as customer_phone, 
              o.full_name as outlet_name,
              COALESCE(NULLIF(TRIM(r.employee_name), ''), CONCAT('Kasir #', b.cashier_employee_id)) as cashier_name
       FROM tr_payment_batch b
       LEFT JOIN mst_customer c ON c.id = b.customer_id
       LEFT JOIN mst_outlet o ON o.id = b.outlet_id
       LEFT JOIN mst_role r ON r.employee_id = b.cashier_employee_id
       WHERE b.batch_no = ? OR b.id = ?`,
      [batchNo, batchNo]
    );

    if (batchRows.length === 0) {
      return res.status(404).json({ success: false, message: 'Batch pelunasan tidak ditemukan' });
    }

    const batch = batchRows[0];
    await fillFallbackNames(batchRows, 'cashier_employee_id', 'cashier_name');

    const [items] = await myWaschenPool.query(
      `SELECT bi.*, t.order_no, t.order_category, t.grand_total, t.total_weight_kg, t.total_pcs
       FROM tr_payment_batch_item bi
       JOIN tr_transaction t ON t.id = bi.transaction_id
       WHERE bi.batch_id = ?`,
      [batch.id]
    );

    const formattedItems = items.map((it) => ({
      ...it,
      orderNo: it.order_no,
      orderCategory: it.order_category,
      amountPaidThisBatch: parseFloat(it.allocated_amount) || parseFloat(it.grand_total) || 0
    }));

    return res.status(200).json({
      success: true,
      data: {
        ...batch,
        batchId: batch.id,
        batchNo: batch.batch_no,
        totalAmount: parseFloat(batch.total_amount) || 0,
        paidAmount: parseFloat(batch.total_amount) || 0,
        paymentMethod: batch.payment_method,
        paymentProofUrl: batch.payment_proof_url,
        settledTransactions: formattedItems,
        items: formattedItems
      }
    });
  } catch (error) {
    console.error('Error fetching payment batch:', error);
    return res.status(500).json({
      success: false,
      message: 'Gagal mengambil data batch pelunasan',
      error: error.message
    });
  }
};

/**
 * POST /api/transactions/:orderNo/digital-nota-access
 * Pastikan nota punya access_code 4 digit + kembalikan URL tracking customer yang valid.
 * Dipakai sebelum kasir kirim nota digital WhatsApp.
 */
/** GET /api/transactions/:orderNo/member-info — blok member di nota cetak & nota digital (null = bukan member) */
export const getTransactionMemberInfo = async (req, res) => {
  try {
    const data = await getMemberNotaInfo((sql, params) => myWaschenPool.query(sql, params), req.params.orderNo);
    res.json({ success: true, data });
  } catch (err) {
    console.error('getTransactionMemberInfo error:', err);
    res.status(500).json({ success: false, message: 'Gagal mengambil info member nota' });
  }
};

export const ensureDigitalNotaAccess = async (req, res) => {
  try {
    const key = String(req.params.orderNo || '').trim();
    if (!key || key.length > 60) {
      return res.status(400).json({ success: false, message: 'Nomor nota tidak valid' });
    }

    let rows;
    try {
      [rows] = await myWaschenPool.query(
        `SELECT id, order_no, access_code
         FROM tr_transaction
         WHERE order_no = ? OR barcode = ? OR CAST(id AS CHAR) = ?
         ORDER BY CASE WHEN order_no = ? THEN 0 ELSE 1 END
         LIMIT 1`,
        [key, key, key, key]
      );
    } catch (err) {
      if (/Unknown column.*access_code/i.test(err.message || '')) {
        return res.status(503).json({
          success: false,
          code: 'ACCESS_CODE_COLUMN_MISSING',
          message: 'Fitur nota digital sedang dalam perbaikan. Silakan coba lagi nanti atau hubungi admin.'
        });
      }
      throw err;
    }

    if (!rows.length) {
      return res.status(404).json({ success: false, message: `Nota "${key}" tidak ditemukan` });
    }

    const trx = rows[0];
    let accessCode = String(trx.access_code || '').replace(/\D/g, '');

    if (!/^\d{4}$/.test(accessCode)) {
      accessCode = generateAccessCode();
      await myWaschenPool.query(
        'UPDATE tr_transaction SET access_code = ?, updated_at = NOW() WHERE id = ?',
        [accessCode, trx.id]
      );
    }

    const trackingUrl = buildCustomerTrackingUrl(trx.order_no);
    if (!trackingUrl) {
      return res.status(503).json({
        success: false,
        code: 'CUSTOMER_APP_URL_MISSING',
        message: 'CUSTOMER_APP_URL / VITE_CUSTOMER_APP_URL belum dikonfigurasi. Link tracking tidak bisa dibuat.'
      });
    }

    return res.json({
      success: true,
      data: {
        orderNo: trx.order_no,
        accessCode,
        trackingUrl
      }
    });
  } catch (err) {
    console.error('ensureDigitalNotaAccess:', err);
    return res.status(500).json({
      success: false,
      message: err.message || 'Gagal menyiapkan kode akses nota digital'
    });
  }
};

/**
 * POST /api/transactions/item-photo
 * Upload foto item saat nota masih disusun (belum ada nota/item). URL dikirim lagi
 * lewat items[].photoUrl saat createTransaction.
 */
export const uploadItemPhotoDraft = async (req, res) => {
  if (!req.file) {
    return res.status(400).json({ success: false, message: 'Foto item wajib diupload' });
  }
  const url = buildUploadPublicUrl(`${ITEM_PHOTO_SUBDIR}/${path.basename(req.file.filename || req.file.path)}`);
  return res.status(200).json({ success: true, data: { photoUrl: url } });
};

/**
 * POST /api/transactions/:id/items/:itemId/photo
 * Tambah foto item pada nota yang sudah dibuat (bisa >1; foto pertama = sampul photo_url).
 */
export const uploadItemPhoto = async (req, res) => {
  try {
    const { id, itemId } = req.params;
    if (!req.file) {
      return res.status(400).json({ success: false, message: 'Foto item wajib diupload' });
    }
    const photoUrl = buildUploadPublicUrl(`${ITEM_PHOTO_SUBDIR}/${path.basename(req.file.filename || req.file.path)}`);

    const [orderRows] = await myWaschenPool.query(
      'SELECT id, outlet_id FROM tr_transaction WHERE id = ? OR order_no = ? LIMIT 1',
      [id, id]
    );
    if (!orderRows.length) {
      await safeUnlinkAbsPath(req.file.path);
      return res.status(404).json({ success: false, message: 'Nota tidak ditemukan' });
    }
    const order = orderRows[0];

    const [itemRows] = await myWaschenPool.query(
      'SELECT id, photo_url FROM tr_transaction_detail WHERE id = ? AND transaction_id = ? LIMIT 1',
      [itemId, order.id]
    );
    if (!itemRows.length) {
      await safeUnlinkAbsPath(req.file.path);
      return res.status(404).json({ success: false, message: 'Item tidak ditemukan pada nota ini' });
    }

    const detail = itemRows[0];
    const existing = await loadItemPhotos((sql, params) => myWaschenPool.query(sql, params), [detail]);
    if ((existing[detail.id] || []).length >= MAX_ITEM_PHOTOS) {
      await safeUnlinkAbsPath(req.file.path);
      return res.status(400).json({ success: false, message: `Maksimal ${MAX_ITEM_PHOTOS} foto per item` });
    }

    const saved = await insertItemPhotos(myWaschenPool, {
      transactionId: order.id,
      detailId: detail.id,
      urls: [photoUrl],
      uploadedBy: Number(req.auth?.employeeId) || null
    });
    if (!saved) {
      // Tabel foto belum dimigrasi: perilaku lama (ganti foto tunggal)
      await myWaschenPool.query('UPDATE tr_transaction_detail SET photo_url = ? WHERE id = ?', [photoUrl, detail.id]);
      await replaceUploadUrl(detail.photo_url, photoUrl);
    } else if (!detail.photo_url) {
      await myWaschenPool.query('UPDATE tr_transaction_detail SET photo_url = ? WHERE id = ?', [photoUrl, detail.id]);
    }

    emitDashboardRefresh('transaction:updated', { outletId: order.outlet_id, transactionId: order.id });

    const after = await loadItemPhotos((sql, params) => myWaschenPool.query(sql, params), [{ ...detail, photo_url: detail.photo_url || photoUrl }]);
    return res.status(200).json({
      success: true,
      message: 'Foto item tersimpan',
      data: { photoUrl, photos: after[detail.id] || [] }
    });
  } catch (error) {
    console.error('Error uploadItemPhoto:', error);
    if (req.file?.path) await safeUnlinkAbsPath(req.file.path);
    return res.status(500).json({ success: false, message: 'Gagal upload foto item' });
  }
};

/**
 * POST /api/transactions/:id/payment-proof
 * Upload bukti bayar (file / foto kamera) → UPLOAD_BASE_DIR/assets/payment_receipt
 */
/**
 * DELETE /api/transactions/:id/items/:itemId/photos/:photoId
 * Hapus satu foto item (foto tidak wajib, boleh sampai habis).
 */
export const deleteItemPhoto = async (req, res) => {
  try {
    const { id, itemId, photoId } = req.params;
    const [orderRows] = await myWaschenPool.query(
      'SELECT id, outlet_id FROM tr_transaction WHERE id = ? OR order_no = ? LIMIT 1',
      [id, id]
    );
    if (!orderRows.length) return res.status(404).json({ success: false, message: 'Nota tidak ditemukan' });
    const order = orderRows[0];

    const [itemRows] = await myWaschenPool.query(
      'SELECT id, photo_url FROM tr_transaction_detail WHERE id = ? AND transaction_id = ? LIMIT 1',
      [itemId, order.id]
    );
    if (!itemRows.length) return res.status(404).json({ success: false, message: 'Item tidak ditemukan pada nota ini' });
    const detail = itemRows[0];

    if (!/^\d+$/.test(String(photoId))) {
      return res.status(400).json({ success: false, message: 'Foto lama belum dimigrasi, tidak bisa dihapus satu per satu' });
    }
    const [photoRows] = await myWaschenPool.query(
      'SELECT id, photo_url FROM tr_transaction_detail_photo WHERE id = ? AND transaction_detail_id = ? LIMIT 1',
      [photoId, detail.id]
    );
    if (!photoRows.length) return res.status(404).json({ success: false, message: 'Foto tidak ditemukan' });
    const photo = photoRows[0];

    await myWaschenPool.query('DELETE FROM tr_transaction_detail_photo WHERE id = ?', [photo.id]);
    // Sampul ikut pindah ke foto berikutnya
    if (detail.photo_url === photo.photo_url) {
      const [[next]] = await myWaschenPool.query(
        'SELECT photo_url FROM tr_transaction_detail_photo WHERE transaction_detail_id = ? ORDER BY id ASC LIMIT 1',
        [detail.id]
      );
      await myWaschenPool.query('UPDATE tr_transaction_detail SET photo_url = ? WHERE id = ?', [next?.photo_url || null, detail.id]);
    }
    const [[stillUsed]] = await myWaschenPool.query(
      'SELECT COUNT(*) AS n FROM tr_transaction_detail_photo WHERE photo_url = ?',
      [photo.photo_url]
    );
    if (!Number(stillUsed.n)) await safeUnlinkUploadUrl(photo.photo_url);

    emitDashboardRefresh('transaction:updated', { outletId: order.outlet_id, transactionId: order.id });

    const [[fresh]] = await myWaschenPool.query('SELECT id, photo_url FROM tr_transaction_detail WHERE id = ?', [detail.id]);
    const after = await loadItemPhotos((sql, params) => myWaschenPool.query(sql, params), [fresh]);
    return res.status(200).json({ success: true, message: 'Foto item dihapus', data: { photos: after[detail.id] || [] } });
  } catch (error) {
    console.error('Error deleteItemPhoto:', error);
    return res.status(500).json({ success: false, message: 'Gagal menghapus foto item' });
  }
};

export const uploadPaymentProof = async (req, res) => {
  try {
    const { id } = req.params;
    if (!req.file) {
      return res.status(400).json({ success: false, message: 'File bukti pembayaran wajib diupload' });
    }

    const proofUrl = buildPaymentProofUrl(path.basename(req.file.filename || req.file.path));
    const [orderRows] = await myWaschenPool.query(
      'SELECT id, outlet_id, payment_proof_url FROM tr_transaction WHERE id = ? OR order_no = ? LIMIT 1',
      [id, id]
    );
    if (!orderRows.length) {
      await safeUnlinkAbsPath(req.file.path);
      return res.status(404).json({ success: false, message: 'Nota tidak ditemukan' });
    }

    const order = orderRows[0];
    await myWaschenPool.query(
      'UPDATE tr_transaction SET payment_proof_url = ?, updated_at = NOW() WHERE id = ?',
      [proofUrl, order.id]
    );

    await replaceUploadUrl(order.payment_proof_url, proofUrl);

    emitDashboardRefresh('transaction:updated', { outletId: order.outlet_id, transactionId: order.id });

    return res.status(200).json({
      success: true,
      message: 'Bukti pembayaran berhasil diupload',
      data: { paymentProofUrl: proofUrl }
    });
  } catch (error) {
    console.error('Error uploadPaymentProof:', error);
    if (req.file?.path) await safeUnlinkAbsPath(req.file.path);
    return res.status(500).json({
      success: false,
      message: 'Gagal upload bukti pembayaran'
    });
  }
};


/**
 * PATCH /api/transactions/:id/cleanox-items/:cleanoxId/decision
 * Phase 17: keputusan frontliner atas item Cleanox By Waschen yang di-hold tim Cleanox.
 * Body: { decision: 'lanjut' | 'batal', note?, cashierEmployeeId? (PIN perangkat bersama) }
 */
export const decideCleanoxHold = async (req, res) => {
  const connection = await myWaschenPool.getConnection();
  try {
    const { id, cleanoxId } = req.params;
    const { decision, note, cashierEmployeeId } = req.body || {};
    const choice = String(decision || '').toLowerCase();
    if (!['lanjut', 'batal'].includes(choice)) {
      return res.status(400).json({ success: false, message: 'Keputusan harus Lanjut atau Batal' });
    }
    const noteText = String(note || '').trim().slice(0, 1000) || null;

    await connection.beginTransaction();
    const actorId = await resolveValidCashier(connection, req, cashierEmployeeId);
    if (!actorId) {
      await connection.rollback();
      return res.status(400).json({ success: false, message: 'Karyawan tidak terdaftar. Verifikasi ulang PIN frontliner.' });
    }
    const [rows] = await connection.query(
      `SELECT c.id, c.on_hold, c.order_no, t.id AS transaction_id, t.outlet_id
       FROM tr_cleanox_by_waschen c
       JOIN tr_transaction t ON t.id = c.transaction_id
       WHERE c.id = ? AND (t.id = ? OR t.order_no = ?)
       LIMIT 1 FOR UPDATE`,
      [cleanoxId, id, id]
    );
    if (!rows.length) {
      await connection.rollback();
      return res.status(404).json({ success: false, message: 'Item Cleanox tidak ditemukan di nota ini' });
    }
    const row = rows[0];
    if (Number(row.on_hold) !== 1) {
      await connection.rollback();
      return res.status(409).json({ success: false, message: 'Item ini tidak sedang di-hold' });
    }

    const actorName = (await resolveCashierName(actorId)) || `#${actorId}`;
    // Sama dengan decideCuciJemur di Cleanox app: keputusan mengembalikan item ke tahap Cuci Jemur.
    await connection.query(
      `UPDATE tr_cleanox_by_waschen
       SET on_hold = 0, is_continue = ?, continue_by = ?, continue_at = NOW(), continue_note = ?,
           status = 'Cuci Jemur', updated_by = ?, updated_at = NOW()
       WHERE id = ?`,
      [choice === 'lanjut' ? 1 : 0, actorName, noteText, actorName, row.id]
    );
    await connection.commit();

    emitDashboardRefresh('transaction:updated', {
      outletId: row.outlet_id,
      orderNo: row.order_no,
      transactionId: row.transaction_id
    });
    const items = await getCleanoxItemsByTransaction(myWaschenPool, row.transaction_id);
    return res.status(200).json({
      success: true,
      message: choice === 'lanjut' ? 'Item Cleanox dilanjutkan' : 'Item Cleanox dibatalkan',
      data: { cleanoxItems: items }
    });
  } catch (error) {
    try { await connection.rollback(); } catch { /* sudah selesai */ }
    console.error('Error decideCleanoxHold:', error);
    return res.status(500).json({ success: false, message: 'Gagal menyimpan keputusan Cleanox', error: error.message });
  } finally {
    connection.release();
  }
};
