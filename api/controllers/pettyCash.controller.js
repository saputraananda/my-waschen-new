import { myWaschenPool } from '../db/pool.js';
import { emitDashboardRefresh } from '../socket.js';

/**
 * GET /api/petty-cash
 * Mengambil riwayat mutasi kas kecil kasir outlet
 */
export const getPettyCashLogs = async (req, res) => {
  try {
    const { outlet_id, type } = req.query;

    let sql = 'SELECT * FROM tr_petty_cash WHERE 1=1';
    const params = [];

    if (outlet_id && outlet_id !== 'Semua') {
      sql += ' AND outlet_id = ?';
      params.push(outlet_id);
    }

    if (type && type !== 'Semua') {
      sql += ' AND type = ?';
      params.push(type);
    }

    sql += ' ORDER BY id DESC LIMIT 50';

    const [rows] = await myWaschenPool.query(sql, params);

    // Get active shift initial float
    const [shiftRows] = await myWaschenPool.query(
      'SELECT initial_cash FROM tr_cashier_shift WHERE status = "Open" ORDER BY id DESC LIMIT 1'
    );
    const initialFloat = shiftRows.length > 0 ? parseFloat(shiftRows[0].initial_cash || 0) : 0;

    // Get current balance
    const [latestRow] = await myWaschenPool.query(
      'SELECT balance_after FROM tr_petty_cash ORDER BY id DESC LIMIT 1'
    );
    const currentBalance = latestRow.length > 0 ? parseFloat(latestRow[0].balance_after || 0) : initialFloat;

    return res.status(200).json({
      success: true,
      data: rows,
      initialFloat,
      currentBalance
    });
  } catch (error) {
    console.error('Error fetching petty cash logs:', error);
    return res.status(500).json({
      success: false,
      message: 'Gagal mengambil buku kas kecil',
      error: error.message
    });
  }
};

/**
 * POST /api/petty-cash
 * Catat transaksi kas kecil masuk / keluar
 */
export const addPettyCashEntry = async (req, res) => {
  try {
    const { outletId, cashierEmployeeId, shiftId, type, category, amount, description, receiptPhotoUrl } = req.body;

    const numAmount = parseFloat(amount);
    if (!type || !description || isNaN(numAmount) || numAmount <= 0) {
      return res.status(400).json({
        success: false,
        message: 'Tipe (Masuk/Keluar), Keterangan, dan Nominal wajib diisi dengan benar'
      });
    }

    // Resolve shift id
    let resolvedShiftId = shiftId || null;
    if (!resolvedShiftId) {
      const [shiftRows] = await myWaschenPool.query(
        'SELECT id, initial_cash FROM tr_cashier_shift WHERE status = "Open" ORDER BY id DESC LIMIT 1'
      );
      if (shiftRows.length > 0) resolvedShiftId = shiftRows[0].id;
    }

    const [shiftRows] = await myWaschenPool.query(
      'SELECT initial_cash FROM tr_cashier_shift WHERE status = "Open" ORDER BY id DESC LIMIT 1'
    );
    const initialFloat = shiftRows.length > 0 ? parseFloat(shiftRows[0].initial_cash || 0) : 0;

    // Get current balance
    const [latestRow] = await myWaschenPool.query(
      'SELECT balance_after FROM tr_petty_cash ORDER BY id DESC LIMIT 1'
    );
    const balanceBefore = latestRow.length > 0 ? parseFloat(latestRow[0].balance_after || 0) : initialFloat;
    const balanceAfter = type === 'Masuk' ? (balanceBefore + numAmount) : (balanceBefore - numAmount);

    const [result] = await myWaschenPool.query(
      `INSERT INTO tr_petty_cash 
       (outlet_id, shift_id, cashier_employee_id, type, category, amount, balance_before, balance_after, description, receipt_photo_url, transaction_date)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW())`,
      [
        outletId || 2,
        resolvedShiftId,
        cashierEmployeeId || 167,
        type,
        category || 'Biaya Operasional',
        numAmount,
        balanceBefore,
        balanceAfter,
        description.trim(),
        receiptPhotoUrl || null
      ]
    );

    const [newRow] = await myWaschenPool.query('SELECT * FROM tr_petty_cash WHERE id = ?', [result.insertId]);

    emitDashboardRefresh('petty-cash:updated', {
      outletId: outletId || newRow[0]?.outlet_id,
      type,
      amount: numAmount
    });

    return res.status(201).json({
      success: true,
      message: `Berhasil mencatat kas ${type.toLowerCase()} Rp ${numAmount.toLocaleString('id-ID')}`,
      data: newRow[0]
    });
  } catch (error) {
    console.error('Error recording petty cash entry:', error);
    return res.status(500).json({
      success: false,
      message: 'Gagal mencatat transaksi kas kecil',
      error: error.message
    });
  }
};

/**
 * GET /api/petty-cash/shift/current
 * Mengambil data sesi shift kasir aktif
 */
export const getCurrentShift = async (req, res) => {
  try {
    const { outlet_id } = req.query;

    const [shiftRows] = await myWaschenPool.query(
      'SELECT * FROM tr_cashier_shift WHERE status = "Open" ORDER BY id DESC LIMIT 1'
    );

    if (shiftRows.length === 0) {
      return res.status(200).json({
        success: true,
        data: null,
        message: 'Tidak ada shift kasir yang sedang aktif'
      });
    }

    return res.status(200).json({
      success: true,
      data: shiftRows[0]
    });
  } catch (error) {
    console.error('Error fetching current shift:', error);
    return res.status(500).json({
      success: false,
      message: 'Gagal mengambil data shift aktif',
      error: error.message
    });
  }
};

/**
 * POST /api/petty-cash/shift/open
 * Buka sesi shift kasir (input modal awal laci)
 */
export const openShift = async (req, res) => {
  try {
    const { outletId, cashierEmployeeId, initialCash, shiftNumber } = req.body;

    const initial = parseFloat(initialCash) || 0;

    const [result] = await myWaschenPool.query(
      `INSERT INTO tr_cashier_shift 
       (outlet_id, cashier_employee_id, shift_number, opened_at, initial_cash, expected_cash, status)
       VALUES (?, ?, ?, NOW(), ?, ?, 'Open')`,
      [outletId || 2, cashierEmployeeId || 167, shiftNumber || 1, initial, initial]
    );

    return res.status(201).json({
      success: true,
      message: 'Shift kasir berhasil dibuka',
      data: {
        shiftId: result.insertId,
        initialCash: initial
      }
    });
  } catch (error) {
    console.error('Error opening shift:', error);
    return res.status(500).json({
      success: false,
      message: 'Gagal membuka shift kasir',
      error: error.message
    });
  }
};
