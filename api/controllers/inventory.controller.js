import { myWaschenPool, mainPool } from '../db/pool.js';
import { applyStockMovement, ensureStockRow, recalcStockSisa } from '../utils/inventoryStock.js';

function todayYmd() {
  return new Date().toISOString().slice(0, 10);
}

function parseUsageDate(raw) {
  const s = raw ? String(raw).trim().slice(0, 10) : todayYmd();
  return /^\d{4}-\d{2}-\d{2}$/.test(s) ? s : todayYmd();
}

async function resolveEmployeeNames(employeeIds = []) {
  const ids = [...new Set(employeeIds.filter(Boolean).map((id) => parseInt(id, 10)).filter(Boolean))];
  if (!ids.length) return new Map();
  try {
    const [rows] = await mainPool.query(
      `SELECT employee_id, full_name FROM mst_employee WHERE employee_id IN (?)`,
      [ids]
    );
    return new Map(rows.map((r) => [r.employee_id, r.full_name || null]));
  } catch (err) {
    console.warn('resolveEmployeeNames inventory:', err.message);
    return new Map();
  }
}

/**
 * GET /api/inventory/items
 * Katalog global item (+ optional filter search / active)
 */
export const listInventoryItems = async (req, res) => {
  try {
    const { search, active } = req.query;
    let sql = `
      SELECT i.*,
             u.symbol AS unit_symbol,
             u.name AS unit_name,
             u.code AS unit_code
      FROM mst_inventory_item i
      LEFT JOIN mst_unit u ON u.id = i.unit_id
      WHERE 1=1
    `;
    const params = [];

    if (active === '1' || active === 'true') {
      sql += ' AND i.is_active = 1';
    } else if (active === '0' || active === 'false') {
      sql += ' AND i.is_active = 0';
    }

    if (search && String(search).trim()) {
      sql += ' AND (i.name LIKE ? OR i.code LIKE ?)';
      const q = `%${String(search).trim()}%`;
      params.push(q, q);
    }

    sql += ' ORDER BY i.name ASC';
    const [rows] = await myWaschenPool.query(sql, params);

    return res.status(200).json({ success: true, data: rows });
  } catch (error) {
    console.error('listInventoryItems:', error);
    return res.status(500).json({
      success: false,
      message: 'Gagal mengambil katalog inventory',
      error: error.message
    });
  }
};

/**
 * POST /api/inventory/items
 */
export const createInventoryItem = async (req, res) => {
  const connection = await myWaschenPool.getConnection();
  try {
    const { code, name, unitId, description, isActive = true, seedOutlets = true } = req.body;
    if (!name || !String(name).trim()) {
      return res.status(400).json({ success: false, message: 'Nama item wajib diisi' });
    }
    if (!unitId) {
      return res.status(400).json({ success: false, message: 'Satuan (unitId) wajib diisi' });
    }

    await connection.beginTransaction();

    const itemCode = (code && String(code).trim())
      || `INV-${Date.now().toString().slice(-6)}`;

    const [result] = await connection.query(
      `INSERT INTO mst_inventory_item (code, name, unit_id, description, is_active)
       VALUES (?, ?, ?, ?, ?)`,
      [
        itemCode,
        String(name).trim(),
        parseInt(unitId, 10),
        description || null,
        isActive ? 1 : 0
      ]
    );

    const itemId = result.insertId;

    if (seedOutlets) {
      await connection.query(
        `INSERT IGNORE INTO tr_inventory_stock (outlet_id, item_id, qty_opening, qty_current, min_stock, par_stock, is_active)
         SELECT o.id, ?, 0, 0, 0, 0, 1 FROM mst_outlet o`,
        [itemId]
      );
    }

    await connection.commit();

    const [rows] = await myWaschenPool.query(
      `SELECT i.*, u.symbol AS unit_symbol, u.name AS unit_name
       FROM mst_inventory_item i
       LEFT JOIN mst_unit u ON u.id = i.unit_id
       WHERE i.id = ?`,
      [itemId]
    );

    return res.status(201).json({
      success: true,
      message: 'Item inventory berhasil ditambahkan',
      data: rows[0]
    });
  } catch (error) {
    await connection.rollback();
    console.error('createInventoryItem:', error);
    const dup = error?.code === 'ER_DUP_ENTRY';
    return res.status(dup ? 400 : 500).json({
      success: false,
      message: dup ? 'Kode atau nama item sudah dipakai' : 'Gagal menambah item inventory',
      error: error.message
    });
  } finally {
    connection.release();
  }
};

/**
 * PUT /api/inventory/items/:id
 */
export const updateInventoryItem = async (req, res) => {
  try {
    const { id } = req.params;
    const { code, name, unitId, description, isActive } = req.body;

    const [existing] = await myWaschenPool.query(
      'SELECT id FROM mst_inventory_item WHERE id = ? LIMIT 1',
      [id]
    );
    if (!existing.length) {
      return res.status(404).json({ success: false, message: 'Item tidak ditemukan' });
    }

    await myWaschenPool.query(
      `UPDATE mst_inventory_item
       SET code = COALESCE(?, code),
           name = COALESCE(?, name),
           unit_id = COALESCE(?, unit_id),
           description = COALESCE(?, description),
           is_active = COALESCE(?, is_active),
           updated_at = NOW()
       WHERE id = ?`,
      [
        code != null ? String(code).trim() : null,
        name != null ? String(name).trim() : null,
        unitId != null ? parseInt(unitId, 10) : null,
        description !== undefined ? (description || null) : null,
        isActive === undefined ? null : (isActive ? 1 : 0),
        id
      ]
    );

    const [rows] = await myWaschenPool.query(
      `SELECT i.*, u.symbol AS unit_symbol, u.name AS unit_name
       FROM mst_inventory_item i
       LEFT JOIN mst_unit u ON u.id = i.unit_id
       WHERE i.id = ?`,
      [id]
    );

    return res.status(200).json({
      success: true,
      message: 'Item inventory berhasil diperbarui',
      data: rows[0]
    });
  } catch (error) {
    console.error('updateInventoryItem:', error);
    const dup = error?.code === 'ER_DUP_ENTRY';
    return res.status(dup ? 400 : 500).json({
      success: false,
      message: dup ? 'Kode atau nama item sudah dipakai' : 'Gagal memperbarui item',
      error: error.message
    });
  }
};

/**
 * GET /api/inventory/stock?outlet_id=&usage_date=&low_stock=1&search=
 * Stok per outlet dengan kolom opname: Stok Awal, Min, Seharusnya, Aktual, Sisa, Selisih
 */
export const listOutletStock = async (req, res) => {
  try {
    const { outlet_id, low_stock, search, active } = req.query;
    const usageDate = parseUsageDate(req.query.usage_date);

    if (!outlet_id || outlet_id === 'Semua') {
      return res.status(400).json({
        success: false,
        message: 'outlet_id wajib diisi'
      });
    }

    const outletId = parseInt(outlet_id, 10);
    const monthStart = `${usageDate.slice(0, 7)}-01`;

    let sql = `
      SELECT
        s.id AS stock_id,
        s.outlet_id,
        s.item_id,
        s.qty_opening,
        s.period_start,
        s.qty_current,
        s.min_stock,
        s.par_stock,
        s.is_active AS stock_active,
        s.updated_at AS stock_updated_at,
        i.code AS item_code,
        i.name AS item_name,
        i.description AS item_description,
        i.is_active AS item_active,
        u.id AS unit_id,
        u.symbol AS unit_symbol,
        u.name AS unit_name,
        COALESCE(s.period_start, ?) AS period_start_effective,
        (
          SELECT COALESCE(SUM(si.qty_per_service * td.qty), 0)
          FROM tr_transaction t
          INNER JOIN tr_transaction_detail td ON td.transaction_id = t.id
          INNER JOIN mst_service_inventory si
            ON si.service_id = td.service_id AND si.item_id = s.item_id AND si.is_active = 1
          WHERE t.outlet_id = s.outlet_id
            AND DATE(t.order_date) >= COALESCE(s.period_start, ?)
            AND DATE(t.order_date) <= ?
        ) AS qty_seharusnya,
        (
          SELECT COALESCE(SUM(o.qty_used), 0)
          FROM tr_stock_opname o
          WHERE o.outlet_id = s.outlet_id AND o.item_id = s.item_id
            AND o.usage_date >= COALESCE(s.period_start, ?)
            AND o.usage_date <= ?
        ) AS qty_aktual_period,
        (
          SELECT COALESCE(o.qty_used, 0)
          FROM tr_stock_opname o
          WHERE o.outlet_id = s.outlet_id AND o.item_id = s.item_id AND o.usage_date = ?
          LIMIT 1
        ) AS qty_aktual_hari,
        (
          SELECT o.id
          FROM tr_stock_opname o
          WHERE o.outlet_id = s.outlet_id AND o.item_id = s.item_id AND o.usage_date = ?
          LIMIT 1
        ) AS opname_id,
        (
          SELECT o.notes
          FROM tr_stock_opname o
          WHERE o.outlet_id = s.outlet_id AND o.item_id = s.item_id AND o.usage_date = ?
          LIMIT 1
        ) AS opname_notes
      FROM tr_inventory_stock s
      INNER JOIN mst_inventory_item i ON i.id = s.item_id
      LEFT JOIN mst_unit u ON u.id = i.unit_id
      WHERE s.outlet_id = ?
    `;
    const params = [
      monthStart,
      monthStart,
      usageDate,
      monthStart,
      usageDate,
      usageDate,
      usageDate,
      usageDate,
      outletId
    ];

    if (active !== '0' && active !== 'false') {
      sql += ' AND i.is_active = 1 AND s.is_active = 1';
    }

    if (search && String(search).trim()) {
      sql += ' AND (i.name LIKE ? OR i.code LIKE ?)';
      const q = `%${String(search).trim()}%`;
      params.push(q, q);
    }

    sql += ' ORDER BY i.name ASC';

    const [rows] = await myWaschenPool.query(sql, params);

    const data = rows.map((r) => {
      const qtyOpening = parseFloat(r.qty_opening) || 0;
      const qtySeharusnya = parseFloat(r.qty_seharusnya) || 0;
      const qtyAktualPeriod = parseFloat(r.qty_aktual_period) || 0;
      const qtyAktualHari = parseFloat(r.qty_aktual_hari) || 0;
      const qtySisa = qtyOpening - qtyAktualPeriod;
      const qtySelisih = qtyAktualPeriod - qtySeharusnya;
      const isLowStock = qtySisa < (parseFloat(r.min_stock) || 0);

      return {
        ...r,
        qty_seharusnya: qtySeharusnya,
        qty_aktual: qtyAktualPeriod,
        qty_aktual_hari: qtyAktualHari,
        qty_sisa: qtySisa,
        qty_selisih: qtySelisih,
        is_low_stock: isLowStock ? 1 : 0
      };
    });

    if (low_stock === '1' || low_stock === 'true') {
      const filtered = data.filter((r) => Number(r.is_low_stock) === 1);
      return res.status(200).json({
        success: true,
        data: filtered,
        meta: {
          outletId,
          usageDate,
          periodStartEffective: monthStart,
          total: filtered.length,
          lowStockCount: filtered.length
        }
      });
    }

    const lowCount = data.filter((r) => Number(r.is_low_stock) === 1).length;

    return res.status(200).json({
      success: true,
      data,
      meta: {
        outletId,
        usageDate,
        periodStartEffective: data[0]?.period_start_effective || monthStart,
        total: data.length,
        lowStockCount: lowCount
      }
    });
  } catch (error) {
    console.error('listOutletStock:', error);
    return res.status(500).json({
      success: false,
      message: 'Gagal mengambil stok outlet',
      error: error.message
    });
  }
};

/**
 * PUT /api/inventory/stock/:stockId
 * Update min_stock / par_stock / qty_opening / period_start / is_active
 */
export const updateStockThresholds = async (req, res) => {
  try {
    const { stockId } = req.params;
    const { minStock, parStock, isActive, qtyOpening, periodStart } = req.body;

    const [existing] = await myWaschenPool.query(
      'SELECT * FROM tr_inventory_stock WHERE id = ? LIMIT 1',
      [stockId]
    );
    if (!existing.length) {
      return res.status(404).json({ success: false, message: 'Baris stok tidak ditemukan' });
    }

    await myWaschenPool.query(
      `UPDATE tr_inventory_stock
       SET min_stock = COALESCE(?, min_stock),
           par_stock = COALESCE(?, par_stock),
           qty_opening = COALESCE(?, qty_opening),
           period_start = COALESCE(?, period_start),
           is_active = COALESCE(?, is_active),
           updated_at = NOW()
       WHERE id = ?`,
      [
        minStock !== undefined && minStock !== null ? parseFloat(minStock) : null,
        parStock !== undefined && parStock !== null ? parseFloat(parStock) : null,
        qtyOpening !== undefined && qtyOpening !== null ? parseFloat(qtyOpening) : null,
        periodStart !== undefined && periodStart !== null ? String(periodStart).slice(0, 10) : null,
        isActive === undefined ? null : (isActive ? 1 : 0),
        stockId
      ]
    );

    const usageDate = todayYmd();
    await recalcStockSisa(myWaschenPool, stockId, usageDate);

    const [rows] = await myWaschenPool.query(
      `SELECT s.*, i.name AS item_name, i.code AS item_code
       FROM tr_inventory_stock s
       INNER JOIN mst_inventory_item i ON i.id = s.item_id
       WHERE s.id = ?`,
      [stockId]
    );

    return res.status(200).json({
      success: true,
      message: 'Data stok berhasil diperbarui',
      data: rows[0]
    });
  } catch (error) {
    console.error('updateStockThresholds:', error);
    return res.status(500).json({
      success: false,
      message: 'Gagal memperbarui data stok',
      error: error.message
    });
  }
};

/**
 * PUT /api/inventory/opname
 * Body: { outletId, itemId, stockId?, usageDate, qtyDelta, direction?: 'add'|'subtract'|'reset', notes?, employeeId? }
 * add/subtract = kumulatif. reset = set total hari ke qtyDelta (angka absolut).
 */
export const saveStockOpname = async (req, res) => {
  const connection = await myWaschenPool.getConnection();
  try {
    const {
      outletId,
      itemId,
      stockId,
      usageDate: rawDate,
      qtyDelta,
      direction = 'add',
      employeeId,
      notes
    } = req.body;

    const oid = parseInt(outletId, 10);
    const iid = parseInt(itemId, 10);
    const usageDate = parseUsageDate(rawDate);
    const deltaRaw = parseFloat(qtyDelta);

    if (!oid || !iid) {
      return res.status(400).json({ success: false, message: 'outletId dan itemId wajib' });
    }

    const isReset = direction === 'reset';

    if (isReset) {
      if (Number.isNaN(deltaRaw) || deltaRaw < 0) {
        return res.status(400).json({ success: false, message: 'Total baru tidak valid' });
      }
    } else if (!(deltaRaw > 0)) {
      return res.status(400).json({ success: false, message: 'qtyDelta harus lebih dari 0' });
    }

    const delta = isReset ? 0 : (direction === 'subtract' ? -deltaRaw : deltaRaw);

    await connection.beginTransaction();

    let sid = parseInt(stockId, 10);
    if (!sid) {
      const stock = await ensureStockRow(connection, oid, iid);
      sid = stock.id;
    }

    const empId = employeeId
      || parseInt(req.body.cashierEmployeeId, 10)
      || null;

    const [[existing]] = await connection.query(
      `SELECT id, qty_used, notes FROM tr_stock_opname
       WHERE outlet_id = ? AND item_id = ? AND usage_date = ?
       LIMIT 1`,
      [oid, iid, usageDate]
    );

    const currentQty = parseFloat(existing?.qty_used) || 0;
    const newQty = isReset ? Math.max(0, deltaRaw) : Math.max(0, currentQty + delta);

    const timeLabel = new Date().toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' });
    let logLine;
    if (isReset) {
      logLine = `${timeLabel} set ${newQty} (dari ${currentQty})`;
    } else {
      const sign = delta >= 0 ? '+' : '';
      logLine = `${timeLabel} ${sign}${delta}${notes ? ` (${notes})` : ''}`;
    }
    const mergedNotes = existing?.notes
      ? `${existing.notes}; ${logLine}`
      : logLine;

    await connection.query(
      `INSERT INTO tr_stock_opname (outlet_id, item_id, stock_id, usage_date, qty_used, employee_id, notes)
       VALUES (?, ?, ?, ?, ?, ?, ?)
       ON DUPLICATE KEY UPDATE
         stock_id = VALUES(stock_id),
         qty_used = ?,
         employee_id = VALUES(employee_id),
         notes = ?,
         updated_at = NOW()`,
      [oid, iid, sid, usageDate, newQty, empId, mergedNotes, newQty, mergedNotes]
    );

    const recalc = await recalcStockSisa(connection, sid, usageDate);

    await connection.commit();

    const [[opnameRow]] = await myWaschenPool.query(
      `SELECT * FROM tr_stock_opname
       WHERE outlet_id = ? AND item_id = ? AND usage_date = ? LIMIT 1`,
      [oid, iid, usageDate]
    );

    return res.status(200).json({
      success: true,
      message: isReset
        ? `Total diset ke ${newQty}`
        : direction === 'subtract'
          ? `Dikurangi ${deltaRaw} — total ${newQty}`
          : `Ditambah ${deltaRaw} — total ${newQty}`,
      data: {
        opname: opnameRow,
        qtyBefore: currentQty,
        qtyAfter: newQty,
        qtyDelta: delta,
        qtySisa: recalc?.qtySisa ?? null,
        qtyAktualPeriod: recalc?.qtyAktual ?? null
      }
    });
  } catch (error) {
    await connection.rollback();
    console.error('saveStockOpname:', error);
    return res.status(500).json({
      success: false,
      message: 'Gagal menyimpan pemakaian aktual',
      error: error.message
    });
  } finally {
    connection.release();
  }
};

/**
 * POST /api/inventory/stock/ensure
 * Pastikan semua item aktif punya baris stok di outlet
 */
export const ensureOutletStockRows = async (req, res) => {
  try {
    const outletId = parseInt(req.body.outletId, 10);
    if (!outletId) {
      return res.status(400).json({ success: false, message: 'outletId wajib' });
    }

    const [result] = await myWaschenPool.query(
      `INSERT IGNORE INTO tr_inventory_stock (outlet_id, item_id, qty_opening, qty_current, min_stock, par_stock, is_active)
       SELECT ?, i.id, 0, 0, 0, 0, 1
       FROM mst_inventory_item i
       WHERE i.is_active = 1`,
      [outletId]
    );

    return res.status(200).json({
      success: true,
      message: 'Baris stok outlet disinkronkan',
      data: { affectedRows: result.affectedRows }
    });
  } catch (error) {
    console.error('ensureOutletStockRows:', error);
    return res.status(500).json({
      success: false,
      message: 'Gagal sinkron stok outlet',
      error: error.message
    });
  }
};

/**
 * POST /api/inventory/movements
 * Body: { outletId, itemId, movementType, qty, setAbsolute?, notes, employeeId }
 */
export const createStockMovement = async (req, res) => {
  const connection = await myWaschenPool.getConnection();
  try {
    const {
      outletId,
      itemId,
      movementType = 'Adjust',
      qty,
      setAbsolute = false,
      notes,
      employeeId
    } = req.body;

    if (!outletId || !itemId) {
      return res.status(400).json({ success: false, message: 'outletId dan itemId wajib' });
    }

    await connection.beginTransaction();
    const result = await applyStockMovement(connection, {
      outletId,
      itemId,
      movementType,
      qty,
      setAbsolute: Boolean(setAbsolute),
      employeeId: employeeId || parseInt(req.body.cashierEmployeeId, 10) || null,
      referenceType: 'manual',
      notes: notes || null
    });
    await connection.commit();

    return res.status(201).json({
      success: true,
      message: 'Mutasi stok berhasil dicatat',
      data: result
    });
  } catch (error) {
    await connection.rollback();
    console.error('createStockMovement:', error);
    return res.status(400).json({
      success: false,
      message: error.message || 'Gagal mencatat mutasi stok',
      error: error.message
    });
  } finally {
    connection.release();
  }
};

/**
 * GET /api/inventory/logs?outlet_id=&item_id=&limit=
 */
export const listInventoryLogs = async (req, res) => {
  try {
    const { outlet_id, item_id, limit = 100 } = req.query;
    let sql = `
      SELECT
        l.*,
        i.code AS item_code,
        i.name AS item_name,
        u.symbol AS unit_symbol,
        o.name AS outlet_name
      FROM tr_inventory_log l
      INNER JOIN mst_inventory_item i ON i.id = l.item_id
      LEFT JOIN mst_unit u ON u.id = i.unit_id
      LEFT JOIN mst_outlet o ON o.id = l.outlet_id
      WHERE 1=1
    `;
    const params = [];

    if (outlet_id && outlet_id !== 'Semua') {
      sql += ' AND l.outlet_id = ?';
      params.push(parseInt(outlet_id, 10));
    }
    if (item_id) {
      sql += ' AND l.item_id = ?';
      params.push(parseInt(item_id, 10));
    }

    sql += ' ORDER BY l.id DESC LIMIT ?';
    params.push(Math.min(parseInt(limit, 10) || 100, 500));

    const [rows] = await myWaschenPool.query(sql, params);
    const nameMap = await resolveEmployeeNames(rows.map((r) => r.employee_id));

    const data = rows.map((r) => ({
      ...r,
      employee_name: nameMap.get(r.employee_id) || (r.employee_id ? `Karyawan #${r.employee_id}` : '-')
    }));

    return res.status(200).json({ success: true, data });
  } catch (error) {
    console.error('listInventoryLogs:', error);
    return res.status(500).json({
      success: false,
      message: 'Gagal mengambil riwayat inventory',
      error: error.message
    });
  }
};

/**
 * GET /api/inventory/service-bom/:serviceId
 */
export const getServiceBom = async (req, res) => {
  try {
    const { serviceId } = req.params;
    const [rows] = await myWaschenPool.query(
      `SELECT
         si.*,
         i.code AS item_code,
         i.name AS item_name,
         u.symbol AS unit_symbol
       FROM mst_service_inventory si
       INNER JOIN mst_inventory_item i ON i.id = si.item_id
       LEFT JOIN mst_unit u ON u.id = i.unit_id
       WHERE si.service_id = ?
       ORDER BY i.name ASC`,
      [serviceId]
    );
    return res.status(200).json({ success: true, data: rows });
  } catch (error) {
    console.error('getServiceBom:', error);
    return res.status(500).json({
      success: false,
      message: 'Gagal mengambil BOM layanan',
      error: error.message
    });
  }
};

/**
 * PUT /api/inventory/service-bom/:serviceId
 * Body: { items: [{ itemId, qtyPerService, notes?, isActive? }] }
 * Replace-all aktif untuk service tersebut.
 */
export const saveServiceBom = async (req, res) => {
  const connection = await myWaschenPool.getConnection();
  try {
    const { serviceId } = req.params;
    const items = Array.isArray(req.body.items) ? req.body.items : [];

    const [svc] = await connection.query(
      'SELECT id, name FROM mst_service WHERE id = ? LIMIT 1',
      [serviceId]
    );
    if (!svc.length) {
      return res.status(404).json({ success: false, message: 'Layanan tidak ditemukan' });
    }

    await connection.beginTransaction();

    // Soft-deactivate semua dulu, lalu upsert yang dikirim
    await connection.query(
      `UPDATE mst_service_inventory SET is_active = 0, updated_at = NOW() WHERE service_id = ?`,
      [serviceId]
    );

    for (const row of items) {
      const itemId = parseInt(row.itemId || row.item_id, 10);
      const qty = parseFloat(row.qtyPerService ?? row.qty_per_service);
      if (!itemId || !(qty > 0)) continue;

      await connection.query(
        `INSERT INTO mst_service_inventory (service_id, item_id, qty_per_service, is_active, notes)
         VALUES (?, ?, ?, 1, ?)
         ON DUPLICATE KEY UPDATE
           qty_per_service = VALUES(qty_per_service),
           is_active = 1,
           notes = VALUES(notes),
           updated_at = NOW()`,
        [serviceId, itemId, qty, row.notes || null]
      );
    }

    await connection.commit();

    const [rows] = await myWaschenPool.query(
      `SELECT si.*, i.code AS item_code, i.name AS item_name, u.symbol AS unit_symbol
       FROM mst_service_inventory si
       INNER JOIN mst_inventory_item i ON i.id = si.item_id
       LEFT JOIN mst_unit u ON u.id = i.unit_id
       WHERE si.service_id = ? AND si.is_active = 1
       ORDER BY i.name ASC`,
      [serviceId]
    );

    return res.status(200).json({
      success: true,
      message: `BOM layanan "${svc[0].name}" disimpan (${rows.length} item)`,
      data: rows
    });
  } catch (error) {
    await connection.rollback();
    console.error('saveServiceBom:', error);
    return res.status(500).json({
      success: false,
      message: 'Gagal menyimpan BOM layanan',
      error: error.message
    });
  } finally {
    connection.release();
  }
};

/** Helper export untuk seed/ensure dari luar */
export { ensureStockRow };
