import { myWaschenPool } from '../db/pool.js';
import { emitDashboardRefresh } from '../socket.js';
import { applyStockMovement, consumeServiceBom } from '../utils/inventoryStock.js';
import { isEventOutlet, listEventOutlets } from '../utils/eventOutlet.js';

/**
 * Distribusi item event ke cabang produksi, per event (outlet event = t.outlet_id).
 * Beberapa event boleh berjalan bersamaan; item tiap event tidak tercampur.
 *
 * production_outlet_id NULL = belum dibagi. Boleh dibagi/diubah selama tahap Pencucian
 * belum dimulai (tidak ada tr_item_progress stage='washing'). Setelah itu terkunci.
 * Stok BOM layanan dipotong di cabang tujuan saat dibagi (dikembalikan bila dipindah).
 */

const EDITABLE_STATUSES = ['Antrean', 'Pencucian'];

/**
 * Outlet event yang sedang dikerjakan. Staf: dikunci ke outlet di header (req.eventScope).
 * Manajemen: eventOutletId dari query/body, wajib outlet event.
 */
async function resolveEventOutletId(req) {
  if (!req.eventScope?.isManagement) return req.eventScope?.outletId || null;
  const id = parseInt(req.query.eventOutletId ?? req.body?.eventOutletId, 10);
  return (await isEventOutlet(id)) ? id : null;
}

/** GET /api/event/list — event yang boleh dibuka (Manajemen: semua, staf: event di header) */
export const getEventList = async (req, res) => {
  try {
    const events = await listEventOutlets();
    const data = req.eventScope?.isManagement
      ? events
      : events.filter((ev) => Number(ev.id) === Number(req.eventScope?.outletId));
    return res.json({ success: true, data });
  } catch (error) {
    console.error('getEventList:', error);
    return res.status(500).json({ success: false, message: 'Gagal memuat daftar event', error: error.message });
  }
};

/** GET /api/event/outlets — cabang tujuan (outlet non-event) */
export const getBranchOutlets = async (req, res) => {
  try {
    const [rows] = await myWaschenPool.query(
      `SELECT id, name, full_name FROM mst_outlet WHERE COALESCE(is_event, 0) = 0 ORDER BY name ASC`
    );
    return res.json({ success: true, data: rows });
  } catch (error) {
    console.error('getBranchOutlets:', error);
    return res.status(500).json({ success: false, message: 'Gagal memuat daftar cabang', error: error.message });
  }
};

/**
 * GET /api/event/items?eventOutletId=&filter=unassigned|assigned|all&search=
 * Item produksi (bukan biaya tambahan) satu event beserta cabang tujuannya.
 */
export const getEventItems = async (req, res) => {
  try {
    const eventOutletId = await resolveEventOutletId(req);
    if (!eventOutletId) {
      return res.status(400).json({ success: false, message: 'Pilih event terlebih dahulu.' });
    }
    const filter = ['unassigned', 'assigned', 'all'].includes(req.query.filter) ? req.query.filter : 'unassigned';
    const search = String(req.query.search || '').trim().slice(0, 40);

    let where = `t.outlet_id = ? AND d.is_event = 1 AND d.is_production = 1 AND d.item_work_status <> 'Dibatalkan'`;
    const params = [eventOutletId];
    if (filter === 'unassigned') where += ' AND d.production_outlet_id IS NULL';
    if (filter === 'assigned') where += ' AND d.production_outlet_id IS NOT NULL';
    if (search) {
      where += ' AND (t.order_no LIKE ? OR c.name LIKE ? OR c.phone LIKE ?)';
      params.push(`%${search}%`, `%${search}%`, `%${search}%`);
    }

    const [rows] = await myWaschenPool.query(
      `SELECT d.id, d.transaction_id, t.order_no, t.order_date, t.payment_status,
              c.name AS customer_name, c.phone AS customer_phone,
              d.service_name, d.qty, d.unit, d.item_work_status,
              d.production_outlet_id, o.name AS production_outlet_name,
              d.production_assigned_at,
              (SELECT COUNT(*) FROM tr_item_progress p
                WHERE p.transaction_detail_id = d.id AND p.stage = 'washing') AS washing_started
       FROM tr_transaction_detail d
       JOIN tr_transaction t ON t.id = d.transaction_id
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
       LEFT JOIN mst_outlet o ON o.id = d.production_outlet_id
       WHERE t.outlet_id = ? AND d.is_event = 1 AND d.is_production = 1 AND d.item_work_status <> 'Dibatalkan'
       GROUP BY d.production_outlet_id, o.name`,
      [eventOutletId]
    );

    return res.json({
      success: true,
      data: rows.map((r) => ({ ...r, locked: Number(r.washing_started) > 0 })),
      summary
    });
  } catch (error) {
    console.error('getEventItems:', error);
    return res.status(500).json({ success: false, message: 'Gagal memuat item event', error: error.message });
  }
};

/**
 * POST /api/event/assign
 * body: { eventOutletId: number, itemIds: number[], outletId: number }
 */
export const assignEventItems = async (req, res) => {
  const connection = await myWaschenPool.getConnection();
  try {
    const eventOutletId = await resolveEventOutletId(req);
    const itemIds = [...new Set((req.body.itemIds || []).map((n) => parseInt(n, 10)).filter(Boolean))];
    const targetOutletId = parseInt(req.body.outletId, 10);
    const employeeId = Number(req.auth?.employeeId) || null;

    if (!eventOutletId) {
      return res.status(400).json({ success: false, message: 'Pilih event terlebih dahulu.' });
    }
    if (!itemIds.length || !targetOutletId) {
      return res.status(400).json({ success: false, message: 'Pilih item dan cabang tujuan.' });
    }
    if (itemIds.length > 300) {
      return res.status(400).json({ success: false, message: 'Maksimal 300 item per proses.' });
    }

    const [outletRows] = await connection.query(
      'SELECT id, name, is_event FROM mst_outlet WHERE id = ? LIMIT 1',
      [targetOutletId]
    );
    if (!outletRows.length || Number(outletRows[0].is_event) === 1) {
      return res.status(400).json({ success: false, message: 'Cabang tujuan tidak valid.' });
    }

    await connection.beginTransaction();

    const [items] = await connection.query(
      `SELECT d.id, d.transaction_id, d.service_id, d.qty, d.item_work_status, d.production_outlet_id, t.order_no,
              (SELECT COUNT(*) FROM tr_item_progress p
                WHERE p.transaction_detail_id = d.id AND p.stage = 'washing') AS washing_started
       FROM tr_transaction_detail d
       JOIN tr_transaction t ON t.id = d.transaction_id
       WHERE d.id IN (?) AND t.outlet_id = ? AND d.is_event = 1 AND d.is_production = 1
       FOR UPDATE`,
      [itemIds, eventOutletId]
    );

    if (items.length !== itemIds.length) {
      await connection.rollback();
      return res.status(400).json({ success: false, message: 'Ada item yang bukan item produksi event ini.' });
    }

    const locked = items.filter(
      (it) => Number(it.washing_started) > 0 || !EDITABLE_STATUSES.includes(it.item_work_status)
    );
    if (locked.length) {
      await connection.rollback();
      return res.status(409).json({
        success: false,
        message: `${locked.length} item sudah diproses di cabang dan tidak bisa dipindah.`,
        lockedIds: locked.map((it) => it.id)
      });
    }

    let moved = 0;
    for (const it of items) {
      if (Number(it.production_outlet_id) === targetOutletId) continue;

      // Pindah cabang: kembalikan stok BOM di cabang lama
      if (it.production_outlet_id) {
        const [bomRows] = await connection.query(
          `SELECT si.item_id, si.qty_per_service
           FROM mst_service_inventory si
           WHERE si.service_id = ? AND si.is_active = 1`,
          [it.service_id]
        );
        for (const bom of bomRows) {
          const back = (parseFloat(bom.qty_per_service) || 0) * (parseFloat(it.qty) || 0);
          if (back <= 0) continue;
          await applyStockMovement(connection, {
            outletId: it.production_outlet_id,
            itemId: bom.item_id,
            movementType: 'In',
            qty: back,
            employeeId,
            referenceType: 'transaction',
            referenceId: it.transaction_id,
            notes: `Pengembalian BOM event — nota ${it.order_no} dipindah cabang`
          });
        }
      }

      await connection.query(
        `UPDATE tr_transaction_detail
         SET production_outlet_id = ?, production_assigned_by = ?, production_assigned_at = NOW()
         WHERE id = ?`,
        [targetOutletId, employeeId, it.id]
      );

      try {
        await consumeServiceBom(connection, {
          outletId: targetOutletId,
          serviceId: it.service_id,
          lineQty: it.qty,
          employeeId,
          transactionId: it.transaction_id,
          orderNo: it.order_no
        });
      } catch (invErr) {
        console.warn('consumeServiceBom (event assign) skip:', invErr.message);
      }
      moved += 1;
    }

    await connection.commit();

    emitDashboardRefresh('transaction:updated', { outletId: targetOutletId });
    emitDashboardRefresh('transaction:updated', { outletId: eventOutletId });

    return res.json({
      success: true,
      message: `${moved} item dibagi ke ${outletRows[0].name}.`,
      moved
    });
  } catch (error) {
    await connection.rollback().catch(() => {});
    console.error('assignEventItems:', error);
    return res.status(500).json({ success: false, message: 'Gagal membagi item ke cabang', error: error.message });
  } finally {
    connection.release();
  }
};
