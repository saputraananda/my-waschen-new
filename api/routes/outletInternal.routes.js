import express from 'express';
import { myWaschenPool } from '../db/pool.js';
import { getIO, emitDashboardRefresh } from '../socket.js';
import { requireSyncToken } from './complaintInternal.routes.js';

const router = express.Router();

/**
 * POST /api/internal/outlet-updated  { id }
 * Dipanggil Super App setelah admin mengubah outlet (Wajib Shift, Aktif, Drop Point).
 * Flag dibaca ulang dari DB (bukan dari body), lalu disiarkan ke semua POS lewat socket
 * agar gerbang shift / badge langsung menyesuaikan tanpa login ulang.
 */
router.post('/outlet-updated', requireSyncToken, async (req, res) => {
  const id = Number(req.body?.id) || 0;
  if (!id) return res.status(400).json({ success: false, message: 'id wajib' });
  try {
    const [[row]] = await myWaschenPool.query(
      'SELECT id, name, full_name, is_drop_point, is_event, is_active, requires_shift FROM mst_outlet WHERE id = ? LIMIT 1',
      [id]
    );
    if (!row) return res.status(404).json({ success: false, message: 'Outlet tidak ditemukan' });
    const outlet = {
      id: Number(row.id),
      name: row.name,
      full_name: row.full_name,
      is_drop_point: Number(row.is_drop_point) === 1 ? 1 : 0,
      is_event: Number(row.is_event) === 1 ? 1 : 0,
      is_active: Number(row.is_active) === 1 ? 1 : 0,
      requires_shift: Number(row.requires_shift) === 1 ? 1 : 0
    };
    getIO()?.emit('outlet:updated', { outlet, at: new Date().toISOString() });
    return res.json({ success: true });
  } catch (err) {
    console.error('[outlet-updated]', err);
    return res.status(500).json({ success: false, message: 'Gagal menyiarkan perubahan outlet' });
  }
});

/**
 * POST /api/internal/petty-cash-updated  { id }
 * Dipanggil Super App setelah admin menyetujui / menolak / mengubah / menghapus pengajuan petty cash.
 * POS menyiarkan 'petty-cash:updated' agar halaman Petty Cash & Dashboard langsung menghitung ulang
 * (mis. pengajuan ditolak → uang tunai di laci otomatis kembali).
 */
router.post('/petty-cash-updated', requireSyncToken, async (req, res) => {
  const id = Number(req.body?.id) || 0;
  let outletId = Number(req.body?.outletId) || null;
  let status = null;
  try {
    if (id) {
      const [[row]] = await myWaschenPool.query('SELECT outlet_id, status FROM tr_petty_cash WHERE id = ? LIMIT 1', [id]);
      if (row) {
        outletId = Number(row.outlet_id) || outletId;
        status = row.status;
      }
    }
    emitDashboardRefresh('petty-cash:updated', { id: id || null, outletId, status, source: 'superapp' });
    return res.json({ success: true });
  } catch (err) {
    console.error('[petty-cash-updated]', err);
    return res.status(500).json({ success: false, message: 'Gagal menyiarkan perubahan petty cash' });
  }
});

export default router;
