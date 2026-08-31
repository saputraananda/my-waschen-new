/**
 * Mutasi stok inventory outlet.
 * movement_type: In | Out | Adjust | Usage
 * qty selalu positif; arah ditentukan movement_type.
 */

/**
 * Pastikan baris tr_inventory_stock ada untuk outlet+item.
 */
function monthStartYmd(dateYmd) {
  const d = dateYmd ? new Date(`${dateYmd}T00:00:00`) : new Date();
  if (Number.isNaN(d.getTime())) return new Date().toISOString().slice(0, 8) + '01';
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  return `${y}-${m}-01`;
}

export function resolvePeriodStart(stockRow, usageDateYmd) {
  if (stockRow?.period_start) {
    const ps = stockRow.period_start instanceof Date
      ? stockRow.period_start.toISOString().slice(0, 10)
      : String(stockRow.period_start).slice(0, 10);
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
  const endDate = usageDateYmd || new Date().toISOString().slice(0, 10);

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
  const [existing] = await connection.query(
    `SELECT id, qty_opening, qty_current, min_stock, par_stock, period_start, is_active
     FROM tr_inventory_stock
     WHERE outlet_id = ? AND item_id = ?
     LIMIT 1`,
    [outletId, itemId]
  );
  if (existing.length) return existing[0];

  const [ins] = await connection.query(
    `INSERT INTO tr_inventory_stock (outlet_id, item_id, qty_opening, qty_current, min_stock, par_stock, is_active)
     VALUES (?, ?, 0, 0, 0, 0, 1)`,
    [outletId, itemId]
  );
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
export async function consumeServiceBom(connection, {
  outletId,
  serviceId,
  lineQty = 1,
  employeeId = null,
  transactionId = null,
  orderNo = null
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

    const moved = await applyStockMovement(connection, {
      outletId: oid,
      itemId: bom.item_id,
      movementType: 'Usage',
      qty: useQty,
      employeeId,
      referenceType: 'transaction',
      referenceId: transactionId || null,
      notes: orderNo
        ? `Pemakaian BOM layanan #${sid} — nota ${orderNo} (${bom.item_name})`
        : `Pemakaian BOM layanan #${sid} (${bom.item_name})`
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
