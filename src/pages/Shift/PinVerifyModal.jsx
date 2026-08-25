import React, { useState } from 'react';
import axios from 'axios';
import { Lock, X } from 'lucide-react';

/**
 * Modal PIN sebelum create transaksi.
 * verify via POST /api/shifts/verify-pin
 */
export default function PinVerifyModal({
  outletId,
  defaultEmployeeId,
  onCancel,
  onVerified,
  title = 'Konfirmasi PIN Kasir',
  description = 'Masukkan 8 digit PIN frontliner yang membuat nota ini (untuk atribusi kasir).',
  submitLabel = 'Lanjut Simpan Nota'
}) {
  const [pin, setPin] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!pin.trim()) {
      setError('PIN wajib diisi');
      return;
    }
    if (pin.trim().length !== 8) {
      setError('PIN harus 8 digit angka');
      return;
    }
    setLoading(true);
    setError('');
    try {
      // Coba PIN milik user login dulu; jika gagal, cari frontliner lain di outlet (backup)
      let res;
      try {
        res = await axios.post('/api/shifts/verify-pin', {
          employeeId: defaultEmployeeId ? parseInt(defaultEmployeeId) : undefined,
          codePin: pin.trim(),
          outletId: outletId ? parseInt(outletId) : undefined
        });
      } catch (firstErr) {
        if (firstErr.response?.status === 401 && defaultEmployeeId) {
          res = await axios.post('/api/shifts/verify-pin', {
            codePin: pin.trim(),
            outletId: outletId ? parseInt(outletId) : undefined
          });
        } else {
          throw firstErr;
        }
      }

      if (res.data?.success) {
        onVerified({
          employeeId: res.data.data.employeeId,
          role: res.data.data.role
        });
      } else {
        setError(res.data?.message || 'PIN tidak valid');
      }
    } catch (err) {
      setError(err.response?.data?.message || 'PIN tidak valid');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[70] bg-[#313030]/70 backdrop-blur-sm flex justify-center items-center p-4">
      <div className="bg-white rounded-3xl border border-[#e0e0e0] w-full max-w-sm shadow-2xl overflow-hidden">
        <div className="p-4 border-b border-[#e0e0e0] flex justify-between items-center bg-[#f8f8f8]">
          <div className="flex items-center gap-2">
            <Lock className="h-4 w-4 text-[#5f1340]" />
            <h3 className="text-sm font-black text-[#313030]">{title}</h3>
          </div>
          <button type="button" onClick={onCancel} className="p-1 text-slate-400">
            <X className="h-4 w-4" />
          </button>
        </div>
        <form onSubmit={handleSubmit} className="p-5 space-y-3 text-xs">
          <p className="text-slate-500 font-medium">
            {description}
          </p>
          {error && (
            <div className="p-2.5 bg-rose-50 border border-rose-200 text-rose-800 rounded-xl font-bold">{error}</div>
          )}
          <input
            type="password"
            inputMode="numeric"
            autoFocus
            maxLength={8}
            value={pin}
            onChange={(e) => setPin(e.target.value.replace(/\D/g, ''))}
            placeholder="••••••••"
            className="w-full px-4 py-3 border border-[#e0e0e0] rounded-xl text-center text-lg font-black tracking-[0.4em] outline-none focus:border-[#5f1340]"
          />
          <button
            type="submit"
            disabled={loading}
            className="w-full py-3 bg-[#5f1340] text-white font-black rounded-xl disabled:opacity-60 cursor-pointer"
          >
            {loading ? 'Memverifikasi...' : submitLabel}
          </button>
        </form>
      </div>
    </div>
  );
}
