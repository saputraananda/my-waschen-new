import { myWaschenPool } from '../db/pool.js';
import { emitDashboardRefresh } from '../socket.js';
import { consumeServiceBom, reverseServiceBomUsage } from '../utils/inventoryStock.js';
import { isDropPointOutlet, listDropPointOutlets } from '../utils/dropPointOutlet.js';

/**
 * Distribusi item nota Drop Point ke outlet produksi lain, per Drop Point (t.outlet_id, outlet
 * dengan mst_outlet.is_drop_point = 1). Beberapa Drop Point boleh aktif bersamaan.
 *
 * Drop Point = outlet biasa. production_outlet_id NULL = item dikerjakan di drop point itu sendiri
 * (seperti outlet biasa); NOT NULL = didistribusikan ke outlet tsb untuk produksi/QC.
 * Item boleh dibagi / dipindah / dikembalikan ke drop point hanya selama masih di status awal
 * (Antrean), tidak di-hold, dan belum ada progres produksi selain QC awal (frontliner).
 *
 * Stok BOM: pemakaian (movement Usage, tidak mengubah qty_current) dicatat saat nota dibuat di
 * outlet nota (drop point). Saat item pindah outlet produksi, log Usage di outlet lama dibatalkan
 * dan dicatat ulang di outlet baru — tepat per item (penanda transaction_detail id di notes log).
 */

const EDITABLE_STATUS = 'Antrean';

/** SQL: jumlah progres produksi yang sudah berjalan selain QC awal (frontliner). */
const STARTED_PROGRESS_SQL = `(SELECT COUNT(*) FROM tr_item_progress p
  WHERE p.transaction_detail_id = d.id AND p.stage <> 'frontliner')`;

const isItemEditable = (it) =>
  it.item_work_status === EDITABLE_STATUS && Number(it.is_on_hold) !== 1 && Number(it.progress_started) === 0;

/**
 * Outlet drop point yang sedang dikerjakan. Staf: dikunci ke outlet di header (req.dropPointScope).
 * Manajemen: dropPointOutletId dari query/body, wajib outlet drop point.
 */
async function resolveDropPointOutletId(req) {
  if (!req.dropPointScope?.isManagement) return req.dropPointScope?.outletId || null;
  const id = parseInt(req.query.dropPointOutletId ?? req.body?.dropPointOutletId, 10);
  return (await isDropPointOutlet(id)) ? id : null;
}

/** GET /api/drop-point/list — Drop Point yang boleh dibuka (Manajemen: semua, staf: drop point di header) */
export const getDropPointList = async (req, res) => {
  try {
    const dropPoints = await listDropPointOutlets();
    const data = req.dropPointScope?.isManagement
      ? dropPoints
      : dropPoints.filter((dp) => Number(dp.id) === Number(req.dropPointScope?.outletId));
    return res.json({ success: true, data });
  } catch (error) {
    console.error('getDropPointList:', error);
    return res.status(500).json({ success: false, message: 'Gagal memuat daftar Drop Point', error: error.message });
  }
};

/** GET /api/drop-point/outlets — outlet tujuan produksi: outlet non-drop point yang aktif */
export const getBranchOutlets = async (req, res) => {
  try {
    const [rows] = await myWaschenPool.query(
      `SELECT id, name, full_name FROM mst_outlet
       WHERE COALESCE(is_drop_point, 0) = 0 AND COALESCE(is_active, 0) = 1
       ORDER BY name ASC`
    );
    return res.json({ success: true, data: rows });
  } catch (error) {
    console.error('getBranchOutlets:', error);
    return res.status(500).json({ success: false, message: 'Gagal memuat daftar cabang', error: error.message });
  }
};

/**
 * GET /api/drop-point/items?dropPointOutletId=&filter=unassigned|assigned|all&search=
 * Item produksi (bukan biaya tambahan) nota satu Drop Point beserta outlet produksinya.
 */
export const getDropPointItems = async (req, res) => {
  try {
    const dropPointOutletId = await resolveDropPointOutletId(req);
    if (!dropPointOutletId) {
      return res.status(400).json({ success: false, message: 'Pilih Drop Point terlebih dahulu.' });
    }
    const filter = ['unassigned', 'assigned', 'all'].includes(req.query.filter) ? req.query.filter : 'unassigned';
    const search = String(req.query.search || '').trim().slice(0, 40);

    let where = `t.outlet_id = ? AND d.is_production = 1 AND d.item_work_status <> 'Dibatalkan'`;
    const params = [dropPointOutletId];
    if (filter === 'unassigned') where += ' AND d.production_outlet_id IS NULL';
    if (filter === 'assigned') where += ' AND d.production_outlet_id IS NOT NULL';
    if (search) {
      where += ' AND (t.order_no LIKE ? OR c.name LIKE ? OR c.phone LIKE ?)';
      params.push(`%${search}%`, `%${search}%`, `%${search}%`);
    }

    const [rows] = await myWaschenPool.query(
      `SELECT d.id, d.transaction_id, t.order_no, t.order_date, t.payment_status,
              c.name AS customer_name, c.phone AS customer_phone,
              COALESCE(NULLIF(TRIM(c.full_address), ''), NULLIF(TRIM(c.address), '')) AS customer_address,
              d.service_name, d.qty, d.unit, d.item_work_status, d.is_on_hold,
              d.production_outlet_id, o.name AS production_outlet_name,
              d.production_assigned_at,
              ${STARTED_PROGRESS_SQL} AS progress_started
       FROM tr_transaction_detail d
       JOIN tr_transaction t ON t.id = d.transaction_id
       JOIN mst_outlet dp ON dp.id = t.outlet_id AND dp.is_drop_point = 1
       LEFT JOIN mst_customer c ON c.id = t.customer_id
       LEFT JOIN mst_outlet o ON o.id = d.production_outlet_id
       WHERE ${where}
       ORDER BY t.order_date DESC, d.id ASC
       LIMIT 500`,
      params
    );

    const [summary] = await myWaschenPool.query(
      `SELECT d.production_outlet_id, o.name AS outlet_name, COUNT(*) AS total_items,
              SUM(d.item_work_status IN ('Siap Diambil','Selesai')) AS done_items
       FROM tr_transaction_detail d
       JOIN tr_transaction t ON t.id = d.transaction_id
       JOIN mst_outlet dp ON dp.id = t.outlet_id AND dp.is_drop_point = 1
       LEFT JOIN mst_outlet o ON o.id = d.production_outlet_id
       WHERE t.outlet_id = ? AND d.is_production = 1 AND d.item_work_status <> 'Dibatalkan'
       GROUP BY d.production_outlet_id, o.name`,
      [dropPointOutletId]
    );

    return res.json({
      success: true,
      data: rows.map((r) => ({ ...r, locked: !isItemEditable(r) })),
      summary
    });
  } catch (error) {
    console.error('getDropPointItems:', error);
    return res.status(500).json({ success: false, message: 'Gagal memuat item Drop Point', error: error.message });
  }
};

/**
 * POST /api/drop-point/assign
 * body: { dropPointOutletId: number, itemIds: number[], outletId: number }
 * outletId = outlet produksi tujuan (aktif, bukan drop point), atau id drop point itu sendiri
 * untuk "Kerjakan di drop point" (production_outlet_id kembali NULL).
 */
export const assignDropPointItems = async (req, res) => {
  const connection = await myWaschenPool.getConnection();
  try {
    const dropPointOutletId = await resolveDropPointOutletId(req);
    const itemIds = [...new Set((req.body.itemIds || []).map((n) => parseInt(n, 10)).filter(Boolean))];
    const targetOutletId = parseInt(req.body.outletId, 10);
    const employeeId = Number(req.auth?.employeeId) || null;

    if (!dropPointOutletId) {
      return res.status(400).json({ success: false, message: 'Pilih Drop Point terlebih dahulu.' });
    }
    if (!itemIds.length || !targetOutletId) {
      return res.status(400).json({ success: false, message: 'Pilih item dan cabang tujuan.' });
    }
    if (itemIds.length > 300) {
      return res.status(400).json({ success: false, message: 'Maksimal 300 item per proses.' });
    }

    // Tujuan = drop point itu sendiri -> kerjakan di drop point (NULL).
    const backToDropPoint = targetOutletId === Number(dropPointOutletId);
    const [outletRows] = await connection.query(
      'SELECT id, name, is_drop_point, is_active FROM mst_outlet WHERE id = ? LIMIT 1',
      [targetOutletId]
    );
    if (!outletRows.length) {
      return res.status(400).json({ success: false, message: 'Cabang tujuan tidak valid.' });
    }
    if (!backToDropPoint) {
      if (Number(outletRows[0].is_drop_point) === 1) {
        return res.status(400).json({ success: false, message: 'Cabang tujuan tidak boleh outlet Drop Point lain.' });
      }
      if (Number(outletRows[0].is_active) !== 1) {
        return res.status(400).json({ success: false, message: `Cabang tujuan ${outletRows[0].name} sedang tidak aktif.` });
      }
    }
    const newProductionOutletId = backToDropPoint ? null : targetOutletId;

    await connection.beginTransaction();

    const [items] = await connection.query(
      `SELECT d.id, d.transaction_id, d.service_id, d.qty, d.item_work_status, d.is_on_hold,
              d.production_outlet_id, t.order_no, t.outlet_id,
              ${STARTED_PROGRESS_SQL} AS progress_started
       FROM tr_transaction_detail d
       JOIN tr_transaction t ON t.id = d.transaction_id
       JOIN mst_outlet dp ON dp.id = t.outlet_id AND dp.is_drop_point = 1
       WHERE d.id IN (?) AND t.outlet_id = ? AND d.is_production = 1 AND d.item_work_status <> 'Dibatalkan'
       FOR UPDATE`,
      [itemIds, dropPointOutletId]
    );

    if (items.length !== itemIds.length) {
      await connection.rollback();
      return res.status(400).json({ success: false, message: 'Ada item yang bukan item produksi Drop Point ini.' });
    }

    const locked = items.filter((it) => !isItemEditable(it));
    if (locked.length) {
      await connection.rollback();
      return res.status(409).json({
        success: false,
        message: `${locked.length} item sudah mulai diproses (bukan status Antrean / sedang di-hold) dan tidak bisa dipindah.`,
        lockedIds: locked.map((it) => it.id)
      });
    }

    let moved = 0;
    for (const it of items) {
      const currentProd = it.production_outlet_id == null ? null : Number(it.production_outlet_id);
      if (currentProd === newProductionOutletId) continue;

      // Outlet efektif lama/baru (NULL = drop point / outlet nota)
      const fromOutlet = currentProd ?? Number(it.outlet_id);
      const toOutlet = newProductionOutletId ?? Number(it.outlet_id);

      // Pindahkan log pemakaian BOM (Usage, tanpa ubah qty_current) dari outlet lama ke outlet baru.
      await reverseServiceBomUsage(connection, {
        outletId: fromOutlet,
        transactionId: it.transaction_id,
        detailId: it.id,
        serviceId: it.service_id,
        lineQty: it.qty
      });

      if (newProductionOutletId == null) {
        await connection.query(
          `UPDATE tr_transaction_detail
           SET production_outlet_id = NULL, production_assigned_by = NULL, production_assigned_at = NULL
           WHERE id = ?`,
          [it.id]
        );
      } else {
        await connection.query(
          `UPDATE tr_transaction_detail
           SET production_outlet_id = ?, production_assigned_by = ?, production_assigned_at = NOW()
           WHERE id = ?`,
          [newProductionOutletId, employeeId, it.id]
        );
      }

      await consumeServiceBom(connection, {
        outletId: toOutlet,
        serviceId: it.service_id,
        lineQty: it.qty,
        employeeId,
        transactionId: it.transaction_id,
        orderNo: it.order_no,
        detailId: it.id
      });
      moved += 1;
    }

    await connection.commit();

    if (newProductionOutletId) emitDashboardRefresh('transaction:updated', { outletId: newProductionOutletId });
    emitDashboardRefresh('transaction:updated', { outletId: dropPointOutletId });

    return res.json({
      success: true,
      message: backToDropPoint
        ? `${moved} item dikerjakan di drop point.`
        : `${moved} item dibagi ke ${outletRows[0].name}.`,
      moved
    });
  } catch (error) {
    await connection.rollback().catch(() => {});
    console.error('assignDropPointItems:', error);
    return res.status(500).json({ success: false, message: 'Gagal membagi item ke cabang', error: error.message });
  } finally {
    connection.release();
  }
};
