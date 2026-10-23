import React, { useState } from 'react';
import axios from 'axios';
import { RotateCcw, X, Wallet, Banknote, HandCoins, FileText } from 'lucide-react';
import { formatRupiah, parseRupiah } from '../../../utils/FormatRupiah';
import { formatName } from '../../../utils/FormatName';
import { useAppDialog } from '../../../context/AppDialogContext.jsx';
import PaymentProofFields from '../../../components/PaymentProofFields.jsx';
import ImageLightbox from '../../../components/ImageLightbox.jsx';

const REFUND_OPTIONS = [
  { id: 'Refund', label: 'Refund', hint: 'Uang dikembalikan ke pelanggan', Icon: Banknote, tone: 'sky' },
  { id: 'Deposit', label: 'Deposit', hint: 'Masuk saldo member setelah disetujui', Icon: Wallet, tone: 'emerald' },
  { id: 'Tips', label: 'Tips', hint: 'Dicatat sebagai tips, tanpa mutasi saldo', Icon: HandCoins, tone: 'amber' }
];

const TONE_ACTIVE = {
  sky: 'bg-sky-600 text-white border-sky-600',
  emerald: 'bg-emerald-600 text-white border-emerald-600',
  amber: 'bg-amber-600 text-white border-amber-600'
};

// "Transfer Bank (BCA 740… a/n NAMA)" → { method: "Transfer Bank", detail: "BCA 740… a/n NAMA" }
const splitPaymentMethod = (raw) => {
  const text = String(raw || '').trim();
  if (!text || text === '-') return { method: '', detail: '' };
  const open = text.indexOf(' (');
  if (open === -1) return { method: text, detail: '' };
  const detail = text.slice(open + 2).replace(/\)\s*$/, '').trim();
  return { method: text.slice(0, open).trim(), detail };
};

const isPdf = (url) => /\.pdf(\?|$)/i.test(String(url || ''));

/**
 * Modal Aksi Refund (Phase 13). Kelebihan bayar tidak lagi diproses saat
 * pembayaran; frontliner mengajukannya di sini, admin Alsa yang approve / tolak.
 */
export default function RefundRequestModal({ order, onClose, onSubmitted }) {
  const { showAlert } = useAppDialog();
  const [refundType, setRefundType] = useState('Refund');
  const [amountInput, setAmountInput] = useState('');
  const [reason, setReason] = useState('');
  const [attachment, setAttachment] = useState(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [previewOpen, setPreviewOpen] = useState(false);

  if (!order) return null;

  const amount = parseRupiah(amountInput);
  const proofUrl = order.paymentProofUrl || null;
  const canSubmit = amount > 0 && reason.trim() && !isSubmitting;
  const address = order.customerAddress && order.customerAddress !== '-' ? order.customerAddress : '';
  const payment = splitPaymentMethod(order.paymentMethod);

  const handleSubmit = async () => {
    if (!canSubmit) return;
    setIsSubmitting(true);
    try {
      const fd = new FormData();
      fd.append('refundType', refundType);
      fd.append('refundAmount', String(amount));
      fd.append('reason', reason.trim());
      if (attachment) fd.append('attachment', attachment);
      const res = await axios.patch(`/api/transactions/${order.dbId || order.id}/request-refund`, fd, {
        headers: { Authorization: `Bearer ${localStorage.getItem('token') || ''}` }
      });
      showAlert({
        title: 'Pengajuan Refund Dikirim',
        message: res.data?.message || `Pengajuan ${refundType} nota ${order.id} menunggu persetujuan admin.`,
        type: 'success'
      });
      onSubmitted?.(res.data?.data);
    } catch (err) {
      showAlert({
        title: 'Gagal Ajukan Refund',
        message: err.response?.data?.message || 'Terjadi kesalahan sistem',
        type: 'error'
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-[#313030]/60 backdrop-blur-xs flex justify-center items-center p-4">
      <div className="bg-white rounded-3xl border border-[#e0e0e0] w-full max-w-3xl shadow-2xl overflow-hidden animate-fade-in flex flex-col max-h-[calc(100vh-2rem)]">
        <div className="p-5 border-b border-[#e0e0e0] flex justify-between items-center bg-sky-50/60 shrink-0">
          <div className="flex items-center gap-2 min-w-0">
            <RotateCcw className="h-5 w-5 text-sky-700 shrink-0" />
            <div className="min-w-0">
              <h3 className="text-sm font-black text-[#313030] truncate">Ajukan Refund — {order.id}</h3>
              <span className="text-[10px] text-slate-400">Diproses admin di Alora SuperApp</span>
            </div>
          </div>
          <button type="button" onClick={onClose} className="p-1 text-slate-400 hover:text-[#313030] cursor-pointer">
            <X className="h-4.5 w-4.5" />
          </button>
        </div>

        <div className="p-5 text-xs overflow-y-auto flex-1 grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-4 items-start">
          {(order.refundPendingCount || 0) > 0 && (
            <div className="md:col-span-2 px-4 py-3 bg-amber-50 border border-amber-200 rounded-2xl text-[11px] font-semibold text-amber-800 leading-snug">
              Nota ini sudah punya {order.refundPendingCount} pengajuan yang masih Pending. Pastikan pengajuan baru ini bukan pengajuan yang sama.
            </div>
          )}
          <div className="md:col-span-2 p-4 sm:p-5 bg-slate-50 border border-[#e0e0e0] rounded-2xl space-y-4 min-w-0">
            <div className="min-w-0">
              <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block">Pelanggan</span>
              <span className="text-lg font-black text-[#313030] block break-words leading-tight mt-0.5">{formatName(order.customerName)}</span>
              {address && (
                <span className="text-sm font-semibold text-slate-600 block mt-1 break-words leading-snug">{address}</span>
              )}
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
              <div className="bg-white border border-[#e0e0e0] rounded-xl px-4 py-3 min-w-0">
                <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block">Tagihan Nota</span>
                <span className="text-xl font-black text-[#5f1340] block mt-1">
                  Rp {(order.grandTotal || 0).toLocaleString('id-ID')}
                </span>
              </div>
              <div className="bg-white border border-[#e0e0e0] rounded-xl px-4 py-3 min-w-0">
                <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block">Tercatat Dibayar</span>
                <span className="text-xl font-black text-[#313030] block mt-1">
                  Rp {(order.paidAmount || 0).toLocaleString('id-ID')}
                </span>
              </div>
              <div className="bg-white border border-[#e0e0e0] rounded-xl px-4 py-3 min-w-0">
                <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block">Metode Bayar</span>
                {payment.method ? (
                  <>
                    <span className="inline-block mt-1.5 px-2.5 py-1 rounded-full bg-emerald-50 border border-emerald-200 text-emerald-700 text-xs font-black">
                      {payment.method}
                    </span>
                    {payment.detail && (
                      <span className="text-xs font-semibold text-slate-600 block mt-1.5 break-words leading-snug">{payment.detail}</span>
                    )}
                  </>
                ) : (
                  <span className="text-sm font-bold text-slate-400 block mt-1">-</span>
                )}
              </div>
            </div>
          </div>

          <div className="space-y-4 min-w-0">

          <div>
            <label className="block text-xs font-bold text-[#313030] mb-1.5">
              Jadikan <span className="text-rose-600">*</span>
            </label>
            <div className="grid grid-cols-3 gap-2">
              {REFUND_OPTIONS.map(({ id, label, Icon, tone }) => (
                <button
                  key={id}
                  type="button"
                  onClick={() => setRefundType(id)}
                  className={`py-2.5 rounded-xl border text-[11px] font-black flex flex-col items-center gap-1 transition-all cursor-pointer ${
                    refundType === id ? TONE_ACTIVE[tone] : 'bg-white border-[#e0e0e0] text-slate-600 hover:bg-slate-50'
                  }`}
                >
                  <Icon className="h-4 w-4" />
                  {label}
                </button>
              ))}
            </div>
            <p className="text-[10px] text-slate-500 font-medium mt-1.5">
              {REFUND_OPTIONS.find((o) => o.id === refundType)?.hint}
            </p>
          </div>

          <div>
            <label className="block text-xs font-bold text-[#313030] mb-1.5">
              Nominal yang Direfund (Rp) <span className="text-rose-600">*</span>
            </label>
            <input
              type="text"
              inputMode="numeric"
              value={amountInput}
              onChange={(e) => setAmountInput(formatRupiah(e.target.value))}
              placeholder="Contoh : 50.000"
              className="w-full px-4 py-2.5 bg-white border border-[#e0e0e0] rounded-xl text-sm font-black outline-none focus:border-sky-600"
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-[#313030] mb-1.5">
              Alasan <span className="text-rose-600">*</span>
            </label>
            <textarea
              rows="3"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="Contoh : Pelanggan transfer Rp 150.000 untuk tagihan Rp 100.000"
              className="w-full p-3 border border-[#e0e0e0] rounded-xl text-xs outline-none focus:border-sky-600 focus:ring-1 focus:ring-sky-600 text-[#313030]"
            />
          </div>
          </div>

          <div className="space-y-4 min-w-0">
          <div>
            <span className="block text-xs font-bold text-[#313030] mb-1.5">Bukti Pembayaran Nota</span>
            {proofUrl ? (
              isPdf(proofUrl) ? (
                <a
                  href={proofUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="flex items-center gap-2 p-3 bg-slate-50 border border-[#e0e0e0] rounded-xl font-bold text-sky-700 hover:underline"
                >
                  <FileText className="h-4 w-4" /> Lihat bukti (PDF)
                </a>
              ) : (
                <button type="button" onClick={() => setPreviewOpen(true)} className="block w-full cursor-zoom-in" title="Klik untuk memperbesar">
                  <img
                    src={proofUrl}
                    alt={`Bukti bayar ${order.id}`}
                    className="w-full max-h-48 object-contain rounded-xl border border-[#e0e0e0] bg-slate-50"
                  />
                </button>
              )
            ) : (
              <p className="p-3 bg-slate-50 border border-dashed border-[#e0e0e0] rounded-xl text-[11px] font-bold text-slate-400">
                Tidak ada bukti pembayaran di nota ini.
              </p>
            )}
            <p className="text-[10px] text-slate-500 font-medium mt-1">Bukti ini ikut terkirim otomatis ke admin.</p>
          </div>

          <PaymentProofFields
            orderNo={order.id}
            file={attachment}
            onFile={setAttachment}
            stage="refund_request"
            label="Bukti Tambahan (Opsional)"
            cameraTitle="Ambil Foto Bukti Refund"
          />
          </div>
        </div>

        <div className="p-4 bg-slate-50 border-t border-[#e0e0e0] flex justify-end gap-2 shrink-0">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 bg-white border border-[#e0e0e0] hover:bg-slate-100 text-slate-700 font-bold rounded-xl text-xs cursor-pointer"
          >
            Batal
          </button>
          <button
            type="button"
            disabled={!canSubmit}
            onClick={handleSubmit}
            className="px-4 py-2 bg-sky-600 hover:bg-sky-700 disabled:opacity-50 disabled:cursor-not-allowed text-white font-bold rounded-xl text-xs cursor-pointer flex items-center gap-1.5 shadow-2xs"
          >
            <RotateCcw className="h-3.5 w-3.5" />
            <span>{isSubmitting ? 'Mengirim...' : 'Kirim Pengajuan'}</span>
          </button>
        </div>
        {previewOpen && (
          <ImageLightbox src={proofUrl} alt={`Bukti bayar ${order.id}`} title={`Bukti Pembayaran — ${order.id}`} onClose={() => setPreviewOpen(false)} />
        )}
      </div>
    </div>
  );
}
