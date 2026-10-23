import React, { useEffect, useState } from 'react';
import axios from 'axios';
import { Banknote, Paperclip, X, AlertTriangle } from 'lucide-react';
import { formatWibDateTime } from '../../../utils/wib.js';
import { formatRupiah, parseRupiah } from '../../../utils/FormatRupiah.js';
import { formatDateKeyId } from '../../../utils/dateCutoffFilter.js';

/**
 * Modal upload bukti setoran tunai untuk satu closing Final, atau satu hari outlet Event
 * (Event wajib isi nominal yang disetor).
 * Dibuka dari halaman Setoran Tunai. Jika sudah ada bukti, upload ini menggantinya.
 */
export default function UploadDepositModal({ row, onUploaded, onCancel }) {
  const [file, setFile] = useState(null);
  const [preview, setPreview] = useState(null);
  const [notes, setNotes] = useState('');
  const isEvent = row.kind === 'event';
  const [amountInput, setAmountInput] = useState(
    isEvent ? formatRupiah(String(Math.round(row.deposit_amount ?? row.cash_amount ?? 0))) : ''
  );
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => () => {
    if (preview) URL.revokeObjectURL(preview);
  }, [preview]);

  const replacing = row.status === 'uploaded';
  const sn = Number(row.shift_number) || 1;

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
    if (isEvent && parseRupiah(amountInput) <= 0) {
      setError('Nominal yang disetor wajib diisi');
      return;
    }
    setSubmitting(true);
    setError('');
    try {
      const fd = new FormData();
      fd.append('proof', file);
      fd.append('notes', notes || '');
      if (isEvent) fd.append('amount', String(parseRupiah(amountInput)));

      const url = isEvent
        ? `/api/deposit-report/event/${row.outlet_id}/${row.event_date}/proof`
        : `/api/deposit-report/${row.id}/proof`;
      const res = await axios.post(url, fd, {
        headers: { Authorization: `Bearer ${localStorage.getItem('token') || ''}` }
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
          <div className="flex-1 min-w-0">
            <h3 className="text-sm font-black text-[#313030]">
              {replacing ? 'Ganti Bukti Setoran Tunai' : 'Upload Setoran Tunai'}
            </h3>
            <p className="text-[10px] text-slate-500">Bukti setor uang hasil closing Final</p>
          </div>
          <button type="button" onClick={onCancel} disabled={submitting} className="p-1.5 rounded-lg hover:bg-amber-100 cursor-pointer">
            <X className="h-4 w-4 text-slate-500" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-5 space-y-4 text-xs">
          {error && (
            <div className="p-3 bg-rose-50 border border-rose-200 text-rose-800 rounded-xl font-bold flex items-start gap-2">
              <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5" />
              <span>{error}</span>
            </div>
          )}

          <div className="p-3 bg-slate-50 border border-[#e0e0e0] rounded-xl space-y-1">
            <span className="text-xs font-black text-[#313030] block">
              {row.outlet_name}{isEvent ? ' · Setoran harian Event' : ` · Shift ${sn === 2 ? 'Siang' : 'Pagi'}`}
            </span>
            <span className="text-[11px] text-slate-500 font-medium block">
              {isEvent ? (
                <>Tanggal: {formatDateKeyId(row.event_date)} · Tunai sistem Rp {Number(row.cash_amount || 0).toLocaleString('id-ID')}</>
              ) : (
                <>
                  Closing: {formatWibDateTime(row.closed_at)}
                  {row.declared_revenue != null && <> · Revenue Rp {Number(row.declared_revenue || 0).toLocaleString('id-ID')}</>}
                </>
              )}
            </span>
            {replacing && (
              <span className="text-[10px] text-amber-700 font-bold block">
                Bukti yang sudah ada akan diganti, pengunggah dan jam ikut berubah.
              </span>
            )}
          </div>

          {isEvent && (
            <div className="space-y-2">
              <span className="text-[10px] font-bold text-slate-500 uppercase block">Nominal Disetor (Rp) *</span>
              <input
                inputMode="numeric"
                value={amountInput}
                onChange={(e) => setAmountInput(formatRupiah(e.target.value))}
                placeholder="0"
                className="w-full px-3 py-2.5 border border-[#e0e0e0] rounded-xl bg-white font-black outline-none focus:border-[#5f1340]"
              />
            </div>
          )}

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
              placeholder="Contoh : Setor ke rekening BCA outlet, tanggal 31 Agustus"
              className="w-full px-3 py-2.5 border border-[#e0e0e0] rounded-xl bg-white font-medium outline-none focus:border-[#5f1340] resize-none"
            />
          </div>

          <div className="flex flex-col sm:flex-row gap-2 pt-1">
            <button
              type="submit"
              disabled={submitting}
              className="flex-1 py-3.5 bg-gradient-to-r from-[#5f1340] to-[#7d1956] text-white font-black rounded-2xl text-xs shadow-md disabled:opacity-60 cursor-pointer"
            >
              {submitting ? 'Mengupload...' : 'Upload Bukti'}
            </button>
            <button
              type="button"
              onClick={onCancel}
              disabled={submitting}
              className="sm:w-auto px-5 py-3.5 bg-white border border-[#e0e0e0] hover:bg-slate-50 text-slate-600 font-black rounded-2xl text-xs cursor-pointer disabled:opacity-60"
            >
              Batal
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
