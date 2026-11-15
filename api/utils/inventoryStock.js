/**
 * Mutasi stok inventory outlet.
 * movement_type: In | Out | Adjust | Usage
 * qty selalu positif; arah ditentukan movement_type.
 */

import { todayWibISO, toWibDateKey, getWibYearMonth } from './wib.js';

/**
 * Pastikan baris tr_inventory_stock ada untuk outlet+item.
 */
function monthStartYmd(dateYmd) {
  const key = toWibDateKey(dateYmd) || todayWibISO();
  const { year, month } = getWibYearMonth(`${key}T12:00:00+07:00`);
  // Jika dateYmd adalah string YYYY-MM-DD, ambil Y-M langsung
  if (/^\d{4}-\d{2}-\d{2}$/.test(String(dateYmd || ''))) {
    return `${String(dateYmd).slice(0, 7)}-01`;
  }
  return `${year}-${String(month).padStart(2, '0')}-01`;
}

export function resolvePeriodStart(stockRow, usageDateYmd) {
  if (stockRow?.period_start) {
    const ps = toWibDateKey(stockRow.period_start);
    if (ps) return ps;
  }
  return monthStartYmd(usageDateYmd);
}

/**
 * Sisa periode = qty_opening − Σ aktual opname (period_start … usage_date).
 */
export async function recalcStockSisa(connection, stockId, usageDateYmd) {
  const [rows] = await connection.query(
    `SELECT id, outlet_id, item_id, qty_opening, period_start
     FROM tr_inventory_stock WHERE id = ? LIMIT 1`,
    [stockId]
  );
  if (!rows.length) return null;

  const stock = rows[0];
  const periodStart = resolvePeriodStart(stock, usageDateYmd);
  const endDate = usageDateYmd || todayWibISO();

  const [[sumRow]] = await connection.query(
    `SELECT COALESCE(SUM(qty_used), 0) AS total
     FROM tr_stock_opname
     WHERE outlet_id = ? AND item_id = ?
       AND usage_date >= ? AND usage_date <= ?`,
    [stock.outlet_id, stock.item_id, periodStart, endDate]
  );

  const qtyOpening = parseFloat(stock.qty_opening) || 0;
  const qtyAktual = parseFloat(sumRow?.total) || 0;
  const qtySisa = qtyOpening - qtyAktual;

  await connection.query(
    `UPDATE tr_inventory_stock SET qty_current = ?, updated_at = NOW() WHERE id = ?`,
    [qtySisa, stockId]
  );

  return { qtySisa, qtyAktual, periodStart };
}

export async function ensureStockRow(connection, outletId, itemId) {
  const selectSql = `
    SELECT id, qty_opening, qty_current, min_stock, par_stock, period_start, is_active
    FROM tr_inventory_stock
    WHERE outlet_id = ? AND item_id = ?
    LIMIT 1`;

  const [existing] = await connection.query(selectSql, [outletId, itemId]);
  if (existing.length) return existing[0];

  try {
    const [ins] = await connection.query(
      `INSERT IGNORE INTO tr_inventory_stock
         (outlet_id, item_id, qty_opening, qty_current, min_stock, par_stock, is_active)
       VALUES (?, ?, 0, 0, 0, 0, 1)`,
      [outletId, itemId]
    );
    if (ins.insertId) {
      return {
        id: ins.insertId,
        qty_opening: 0,
        qty_current: 0,
        min_stock: 0,
        par_stock: 0,
        period_start: null,
        is_active: 1
      };
    }
  } catch (err) {
    if (err?.code !== 'ER_LOCK_DEADLOCK' && err?.code !== 'ER_DUP_ENTRY') throw err;
  }

  // Race / deadlock: baris mungkin sudah dibuat transaksi lain
  const [again] = await connection.query(selectSql, [outletId, itemId]);
  if (again.length) return again[0];
  throw new Error('Gagal membuat baris stok inventory');
}

/**
 * Terapkan 1 mutasi stok + tulis log.
 * @returns {{ stockId, qtyBefore, qtyAfter, logId }}
 */
export async function applyStockMovement(connection, {
  outletId,
  itemId,
  movementType = 'Adjust',
  qty,
  employeeId = null,
  referenceType = 'manual',
  referenceId = null,
  notes = null,
  /** Jika true (Adjust), qty adalah nilai absolut target, bukan delta */
  setAbsolute = false
}) {
  const oid = parseInt(outletId, 10);
  const iid = parseInt(itemId, 10);
  const amount = Math.abs(parseFloat(qty) || 0);

  if (!oid || !iid) {
    throw new Error('outletId dan itemId wajib diisi');
  }

  const type = String(movementType || 'Adjust');
  if (!['In', 'Out', 'Adjust', 'Usage'].includes(type)) {
    throw new Error(`movement_type tidak valid: ${type}`);
  }

  if (!setAbsolute && amount <= 0 && type !== 'Adjust') {
    throw new Error('Qty mutasi harus lebih dari 0');
  }

  const stock = await ensureStockRow(connection, oid, iid);
  const qtyBefore = parseFloat(stock.qty_current) || 0;
  let qtyAfter = qtyBefore;

  if (type === 'In') {
    qtyAfter = qtyBefore + amount;
  } else if (type === 'Out') {
    qtyAfter = qtyBefore - amount;
  } else if (type === 'Usage') {
    // Pemakaian BOM dicatat di log; sisa stok dihitung dari opname (qty_opening − aktual).
    qtyAfter = qtyBefore;
  } else if (type === 'Adjust') {
    qtyAfter = setAbsolute ? (parseFloat(qty) || 0) : qtyBefore + (parseFloat(qty) || 0);
  }

  await connection.query(
    `UPDATE tr_inventory_stock
     SET qty_current = ?, updated_at = NOW()
     WHERE id = ?`,
    [qtyAfter, stock.id]
  );

  const logQty = type === 'Adjust' && setAbsolute
    ? Math.abs(qtyAfter - qtyBefore)
    : amount;

  const [logResult] = await connection.query(
    `INSERT INTO tr_inventory_log
     (outlet_id, item_id, stock_id, movement_type, qty, qty_before, qty_after, employee_id, reference_type, reference_id, notes)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      oid,
      iid,
      stock.id,
      type,
      logQty,
      qtyBefore,
      qtyAfter,
      employeeId || null,
      referenceType || 'manual',
      referenceId || null,
      notes || null
    ]
  );

  return {
    stockId: stock.id,
    qtyBefore,
    qtyAfter,
    logId: logResult.insertId,
    isBelowMin: qtyAfter < (parseFloat(stock.min_stock) || 0)
  };
}

/**
 * Potong stok berdasarkan BOM layanan (mst_service_inventory).
 * Jika layanan tidak punya BOM → no-op (qty 0).
 * qty line item dikalikan qty_per_service.
 */
/** Penanda item di notes log BOM: "[item #<transaction_detail_id>]" (tr_inventory_log tidak punya kolom detail). */
export const bomItemTag = (detailId) => `[item #${parseInt(detailId, 10)}]`;

export async function consumeServiceBom(connection, {
  outletId,
  serviceId,
  lineQty = 1,
  employeeId = null,
  transactionId = null,
  orderNo = null,
  /** tr_transaction_detail.id — dicatat di notes agar log bisa dibalik tepat per item */
  detailId = null
}) {
  const sid = parseInt(serviceId, 10);
  const oid = parseInt(outletId, 10);
  const multiplier = Math.max(0, parseFloat(lineQty) || 0);

  if (!sid || !oid || multiplier <= 0) return [];

  const [bomRows] = await connection.query(
    `SELECT si.item_id, si.qty_per_service, i.name AS item_name
     FROM mst_service_inventory si
     INNER JOIN mst_inventory_item i ON i.id = si.item_id AND i.is_active = 1
     WHERE si.service_id = ? AND si.is_active = 1`,
    [sid]
  );

  if (!bomRows.length) return [];

  const results = [];
  for (const bom of bomRows) {
    const useQty = (parseFloat(bom.qty_per_service) || 0) * multiplier;
    if (useQty <= 0) continue;

    const tag = detailId ? ` ${bomItemTag(detailId)}` : '';
    const moved = await applyStockMovement(connection, {
      outletId: oid,
      itemId: bom.item_id,
      movementType: 'Usage',
      qty: useQty,
      employeeId,
      referenceType: 'transaction',
      referenceId: transactionId || null,
      notes: orderNo
        ? `Pemakaian BOM layanan #${sid} — nota ${orderNo} (${bom.item_name})${tag}`
        : `Pemakaian BOM layanan #${sid} (${bom.item_name})${tag}`
    });
    results.push({
      itemId: bom.item_id,
      itemName: bom.item_name,
      qtyUsed: useQty,
      ...moved
    });
  }
  return results;
}

/**
 * Batalkan log pemakaian BOM (movement Usage) satu item di satu outlet, mis. saat item Drop Point
 * dipindah outlet produksi. Usage tidak pernah mengubah qty_current, jadi pembatalan cukup
 * menghapus baris log Usage item tsb — qty_current tidak disentuh.
 * Log baru ditandai bomItemTag(detailId); untuk log lama tanpa penanda, dihapus satu log per
 * baris BOM yang cocok (outlet, nota, item, qty).
 * @returns {number} jumlah log yang dihapus
 */
export async function reverseServiceBomUsage(connection, {
  outletId,
  transactionId,
  detailId,
  serviceId,
  lineQty = 1
}) {
  const oid = parseInt(outletId, 10);
  const tid = parseInt(transactionId, 10);
  const did = parseInt(detailId, 10);
  if (!oid || !tid || !did) return 0;

  const [tagged] = await connection.query(
    `DELETE FROM tr_inventory_log
     WHERE movement_type = 'Usage' AND reference_type = 'transaction'
       AND reference_id = ? AND outlet_id = ? AND notes LIKE ?`,
    [tid, oid, `%${bomItemTag(did)}%`]
  );
  if (tagged.affectedRows > 0) return tagged.affectedRows;

  // Log lama (sebelum penanda item): cocokkan per baris BOM.
  const sid = parseInt(serviceId, 10);
  const multiplier = Math.max(0, parseFloat(lineQty) || 0);
  if (!sid || multiplier <= 0) return 0;
  const [bomRows] = await connection.query(
    `SELECT si.item_id, si.qty_per_service
     FROM mst_service_inventory si
     WHERE si.service_id = ? AND si.is_active = 1`,
    [sid]
  );
  let removed = 0;
  for (const bom of bomRows) {
    const useQty = (parseFloat(bom.qty_per_service) || 0) * multiplier;
    if (useQty <= 0) continue;
    const [r] = await connection.query(
      `DELETE FROM tr_inventory_log
       WHERE movement_type = 'Usage' AND reference_type = 'transaction'
         AND reference_id = ? AND outlet_id = ? AND item_id = ? AND ABS(qty - ?) <= 0.006
         AND (notes IS NULL OR notes NOT LIKE '%[item #%')
       ORDER BY id DESC LIMIT 1`,
      [tid, oid, bom.item_id, useQty]
    );
    removed += r.affectedRows;
  }
  return removed;
}
