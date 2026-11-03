import { myWaschenPool } from '../db/pool.js';

/**
 * Bayar Backdate: admin Super App (Master Data › Metode Pembayaran) bisa mengizinkan kasir memilih
 * tanggal pelunasan di masa lalu. Setelan disimpan di mst_payment_backdate (satu baris, id = 1).
 *
 * Yang di-backdate hanya tr_transaction.paid_at & settled_at (tanggal pengakuan revenue).
 * tr_payment_log.created_at tetap waktu input, supaya uang tetap masuk Daily Report shift yang sedang buka.
 */
const YMD = /^\d{4}-\d{2}-\d{2}$/;

/** true bila admin mengizinkan bayar backdate. Tabel belum ada = nonaktif. */
export const isBackdatePaymentEnabled = async (db = myWaschenPool) => {
  try {
    const [rows] = await db.query('SELECT is_active FROM mst_payment_backdate WHERE id = 1 LIMIT 1');
    return Number(rows[0]?.is_active) === 1;
  } catch (err) {
    if (err?.code === 'ER_NO_SUCH_TABLE') return false;
    throw err;
  }
};

/**
 * Validasi tanggal bayar dari client.
 * - kosong / hari ini → { sql: 'NOW()', params: [] } (perilaku lama)
 * - tanggal lampau → hanya bila diizinkan; tidak boleh sebelum tanggal nota
 * Return { error } bila ditolak.
 */
export const resolvePaidAt = async (connection, { paidDate, transactionIds = [] }) => {
  const raw = String(paidDate || '').trim();
  if (!raw) return { sql: 'NOW()', params: [], backdated: false };
  if (!YMD.test(raw)) return { error: 'Format tanggal bayar tidak valid (YYYY-MM-DD)' };

  const [[{ today }]] = await connection.query("SELECT DATE_FORMAT(CURDATE(), '%Y-%m-%d') AS today");
  if (raw > today) return { error: 'Tanggal bayar tidak boleh di masa depan' };
  if (raw === today) return { sql: 'NOW()', params: [], backdated: false };

  if (!(await isBackdatePaymentEnabled(connection))) {
    return { error: 'Bayar backdate sedang tidak diizinkan admin. Muat ulang halaman lalu coba lagi.' };
  }

  if (transactionIds.length) {
    const marks = transactionIds.map(() => '?').join(',');
    const [rows] = await connection.query(
      `SELECT order_no, DATE_FORMAT(order_date, '%Y-%m-%d') AS order_day
       FROM tr_transaction WHERE id IN (${marks})`,
      transactionIds
    );
    const tooEarly = rows.find((r) => r.order_day && raw < r.order_day);
    if (tooEarly) {
      return { error: `Tanggal bayar tidak boleh sebelum tanggal nota ${tooEarly.order_no} (${tooEarly.order_day})` };
    }
  }

  // Jam tetap jam input supaya urutan dalam sehari wajar
  return { sql: 'TIMESTAMP(?, CURTIME())', params: [raw], backdated: true, date: raw };
};

/** Catatan audit di log pembayaran untuk pelunasan backdate. */
export const backdateNote = (paid) => (paid?.backdated ? ` [Backdate: dibayar ${paid.date}]` : '');
