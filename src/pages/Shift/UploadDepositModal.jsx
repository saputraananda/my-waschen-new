import React, { useEffect, useState } from 'react';
import axios from 'axios';
import { Banknote, Paperclip, X, AlertTriangle } from 'lucide-react';

/**
 * Modal wajib upload bukti setoran tunai closing Final SEBELUMNYA.
 * Muncul saat mau Open Shift atau Close Shift jika masih ada closing Final
 * yang belum diupload buktinya (deposit_proof_url masih NULL).
 */
export default function UploadDepositModal({
  pendingDeposit,
  employeeId,
  onUploaded,
  onCancel
}) {
  const [file, setFile] = useState(null);
  const [preview, setPreview] = useState(null);
  const [notes, setNotes] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => () => {
    if (preview) URL.revokeObjectURL(preview);
  }, [preview]);

  const closedAt = pendingDeposit?.closed_at ? new Date(pendingDeposit.closed_at) : null;
  const sn = Number(pendingDeposit?.shift_number) || 1;

  const handleFileChange = (e) => {
    const f = e.target.files?.[0];
    if (!f) return;
    if (preview) URL.revokeObjectURL(preview);
    setFile(f);
    setPreview(f.type.startsWith('image/') ? URL.createObjectURL(f) : null);
  };

  const clearFile = () => {
    if (preview) URL.revokeObjectURL(preview);
    setFile(null);
    setPreview(null);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!file) {
      setError('Foto/PDF bukti setoran wajib diupload');
      return;
    }
    setSubmitting(true);
    setError('');
    try {
      const fd = new FormData();
      fd.append('proof', file);
      fd.append('notes', notes || '');
      fd.append('uploadedBy', String(parseInt(employeeId, 10) || ''));

      const res = await axios.post(`/api/shifts/${pendingDeposit.id}/deposit-proof`, fd, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });

      if (res.data?.success) {
        onUploaded(res.data.data);
      } else {
        setError(res.data?.message || 'Gagal upload bukti setoran');
      }
    } catch (err) {
      setError(err.response?.data?.message || err.message);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[65] bg-[#313030]/70 backdrop-blur-sm flex justify-center items-center p-4">
      <div className="bg-white rounded-3xl border border-[#e0e0e0] w-full max-w-lg shadow-2xl overflow-hidden">
        <div className="p-5 border-b border-[#e0e0e0] bg-amber-50 flex items-center gap-3">
          <div className="p-2.5 bg-amber-100 text-amber-700 rounded-xl">
            <Banknote className="h-5 w-5" />
          </div>
          <div>
            <h3 className="text-sm font-black text-[#313030]">Upload Setoran Tunai</h3>
            <p className="text-[10px] text-slate-500">
              Wajib diisi sebelum {pendingDeposit?._gateReason === 'close' ? 'closing' : 'open shift'} — setoran hasil closing hari sebelumnya
            </p>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="p-5 space-y-4 text-xs">
          {error && (
            <div className="p-3 bg-rose-50 border border-rose-200 text-rose-800 rounded-xl font-bold flex items-start gap-2">
              <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5" />
              <span>{error}</span>
            </div>
          )}

          <div className="p-3 bg-slate-50 border border-[#e0e0e0] rounded-xl space-y-1">
            <span className="text-[10px] font-black text-slate-400 uppercase tracking-wider block">
              Closing Final belum ada bukti setoran
            </span>
            <span className="text-xs font-black text-[#313030] block">
              Shift {sn === 2 ? 'Siang' : 'Pagi'}
              {closedAt && <> · {closedAt.toLocaleDateString('id-ID')} {closedAt.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })}</>}
            </span>
            {pendingDeposit?.declared_revenue != null && (
              <span className="text-[11px] text-slate-500 font-medium block">
                Revenue: Rp {Number(pendingDeposit.declared_revenue || 0).toLocaleString('id-ID')}
              </span>
            )}
            {pendingDeposit?.pendingCount > 1 && (
              <span className="text-[10px] text-amber-700 font-bold block">
                +{pendingDeposit.pendingCount - 1} closing lain juga menunggu setoran (diselesaikan berurutan)
              </span>
            )}
          </div>

          <div className="space-y-2">
            <span className="text-[10px] font-bold text-slate-500 uppercase block">Bukti Setoran (foto/PDF) *</span>
            {file ? (
              <div className="flex items-center gap-3 p-3 bg-white border border-[#e0e0e0] rounded-xl">
                {preview ? (
                  <img src={preview} alt="Bukti" className="h-14 w-14 object-cover rounded-lg border" />
                ) : (
                  <div className="h-14 w-14 rounded-lg bg-slate-100 flex items-center justify-center">
                    <Paperclip className="h-5 w-5 text-slate-400" />
                  </div>
                )}
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-black text-[#313030] truncate">{file.name}</p>
                  <p className="text-[10px] text-slate-400">{(file.size / 1024).toFixed(0)} KB</p>
                </div>
                <button type="button" onClick={clearFile} className="p-1.5 rounded-lg hover:bg-slate-100 cursor-pointer">
                  <X className="h-4 w-4 text-slate-500" />
                </button>
              </div>
            ) : (
              <label className="flex flex-col items-center justify-center gap-2 p-6 border-2 border-dashed border-[#e0e0e0] rounded-xl bg-white cursor-pointer hover:border-[#5f1340]/40 transition-colors">
                <Paperclip className="h-6 w-6 text-slate-400" />
                <span className="text-xs font-bold text-slate-500">Upload foto / PDF bukti setoran</span>
                <input
                  type="file"
                  accept="image/jpeg,image/png,image/webp,application/pdf"
                  className="hidden"
                  onChange={handleFileChange}
                />
              </label>
            )}
          </div>

          <div className="space-y-2">
            <span className="text-[10px] font-bold text-slate-500 uppercase block">Keterangan (Notes)</span>
            <textarea
              rows={3}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Contoh: Setor ke rekening BCA outlet, tanggal 31 Agustus..."
              className="w-full px-3 py-2.5 border border-[#e0e0e0] rounded-xl bg-white font-medium outline-none focus:border-[#5f1340] resize-none"
            />
          </div>

          <div className="flex flex-col sm:flex-row gap-2 pt-1">
            <button
              type="submit"
              disabled={submitting}
              className="flex-1 py-3.5 bg-gradient-to-r from-[#5f1340] to-[#7d1956] text-white font-black rounded-2xl text-xs shadow-md disabled:opacity-60 cursor-pointer"
            >
              {submitting ? 'Mengupload...' : 'Upload & Lanjutkan'}
            </button>
            {onCancel && (
              <button
                type="button"
                onClick={onCancel}
                disabled={submitting}
                className="sm:w-auto px-5 py-3.5 bg-white border border-[#e0e0e0] hover:bg-slate-50 text-slate-600 font-black rounded-2xl text-xs cursor-pointer disabled:opacity-60"
              >
                Batal
              </button>
            )}
          </div>
        </form>
      </div>
    </div>
  );
}
