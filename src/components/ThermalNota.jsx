import React, { useEffect } from 'react';
import { createPortal } from 'react-dom';
import Barcode from 'react-barcode';
import { QRCodeSVG } from 'qrcode.react';
import { Printer, X } from 'lucide-react';
import { formatEmployeeName } from '../utils/FormatName.js';
import { useAppDialog } from '../context/AppDialogContext.jsx';

const paymentStatusLabel = (status, method, batchNo) => {
  if (batchNo) return `Lunas Gabungan (${method || 'Tunai'} - #${batchNo})`;
  if (status === 'Lunas') return `Lunas (${method || 'Tunai'})`;
  if (status === 'DP') return `DP (${method || 'Tunai'})`;
  if (status === 'Outstanding') return 'Outstanding (Belum Bayar)';
  return `${status || '-'} (${method || '-'})`;
};

export default function ThermalNota({ createdOrderReceipt, onClose }) {
  const { showAlert } = useAppDialog();

  useEffect(() => {
    if (!createdOrderReceipt) return undefined;
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = prev;
    };
  }, [createdOrderReceipt]);

  if (!createdOrderReceipt) return null;

  const ps = createdOrderReceipt.paymentStatus || 'Lunas';
  const isOutstanding = ps === 'Outstanding';
  const isDP = ps === 'DP';
  const isLunas = ps === 'Lunas';

  const handleClose = () => {
    if (onClose) onClose();
  };

  return createPortal(
    <div
      className="fixed inset-0 z-[100] bg-[#313030]/60 backdrop-blur-xs overflow-y-auto overscroll-contain"
      onClick={handleClose}
    >
      <div className="flex min-h-full items-center justify-center p-4 sm:p-6">
        <div
          className="bg-white rounded-3xl border border-[#e0e0e0] w-full max-w-md shadow-2xl flex flex-col max-h-[90vh] animate-fade-in"
          onClick={(e) => e.stopPropagation()}
        >
          <div className="shrink-0 p-4 border-b border-[#e0e0e0] flex justify-between items-center bg-[#f8f8f8] rounded-t-3xl">
            <div className="flex items-center gap-2">
              <Printer className="h-5 w-5 text-[#5f1340]" />
              <h3 className="text-sm font-black text-[#313030]">Struk Nota Transaksi POS</h3>
            </div>
            <button
              type="button"
              onClick={handleClose}
              className="p-1 text-slate-400 hover:text-[#313030] cursor-pointer"
            >
              <X className="h-5 w-5" />
            </button>
          </div>

          <div className="flex-1 min-h-0 overflow-y-auto overscroll-contain bg-[#ece9e4] py-5 px-4 sm:px-6">
            <div className="mx-auto w-full max-w-[280px] bg-[#fffefb] shadow-sm border border-slate-200/80 px-4 py-4 font-mono text-[11px] leading-relaxed text-slate-800 space-y-2.5">

              <div className="text-center pb-2 border-b border-dashed border-slate-400">
                <p className="font-black text-[13px] tracking-wide">WASCHEN LAUNDRY</p>
                <p className="text-[10px] text-slate-500 mt-0.5">{createdOrderReceipt.branch}</p>
                <p className="text-[9px] text-slate-400">{createdOrderReceipt.createdAt}</p>
              </div>

              <div className="space-y-0.5">
                <p className="font-bold">No. Nota: {createdOrderReceipt.id}</p>
                <p>Pelanggan: {createdOrderReceipt.customerName}</p>
                <p className="text-[10px] text-slate-500">Telp: {createdOrderReceipt.customerPhone}</p>
                <p className="text-[10px] text-slate-500 break-words">Alamat: {createdOrderReceipt.customerAddress}</p>
                <p className="text-[10px] text-slate-500">Kasir: {formatEmployeeName(createdOrderReceipt.cashierName)}</p>
              </div>

              <div className="border-t border-b border-dashed border-slate-400 py-2 space-y-2">
                {createdOrderReceipt.items?.map((item, idx) => (
                  <div key={idx} className="space-y-0.5">
                    <div className="flex justify-between gap-2 font-bold">
                      <span className="min-w-0 break-words">{item.name}</span>
                      <span className="shrink-0">Rp {(item.effectiveSubtotal || 0).toLocaleString('id-ID')}</span>
                    </div>
                    <p className="text-[9px] text-slate-500">
                      {item.qtyDisplay}{(item.isDryClean || item.is_dry_clean || item.laundry_method_code === 'DC') ? ' • DRY CLEAN (DC)' : ''}{item.isCleanox ? ' • CLEANOX' : ''}{item.size && item.size !== '-' ? ` | Ukuran: ${item.size}` : ''} | Merk: {item.brand} | Warna: {item.color}
                    </p>
                    {item.note && item.note !== '-' && (
                      <p className="text-[9px] text-amber-800">Ket: {item.note}</p>
                    )}
                  </div>
                ))}
              </div>

              <div className="space-y-0.5 text-[10px]">
                <div className="flex justify-between gap-2">
                  <span>Aroma Parfum:</span>
                  <span className="font-bold text-right">{createdOrderReceipt.perfume}</span>
                </div>
                <div className="flex justify-between gap-2">
                  <span>Tipe Pengerjaan:</span>
                  <span className="font-bold">{createdOrderReceipt.isExpress ? 'EXPRESS 1X24 JAM' : 'REGULER'}</span>
                </div>
                <div className="flex justify-between gap-2">
                  <span>Tipe Pengambilan:</span>
                  <span className="font-bold">{createdOrderReceipt.isDelivery ? 'DIANTAR' : 'AMBIL DI OUTLET'}</span>
                </div>
                {createdOrderReceipt.discountAmount > 0 && (
                  <div className="flex justify-between gap-2 text-emerald-700">
                    <span>Diskon Promo:</span>
                    <span className="font-bold">- Rp {createdOrderReceipt.discountAmount.toLocaleString('id-ID')}</span>
                  </div>
                )}
              </div>

              <div className="flex justify-between font-black text-[13px] pt-1 border-t border-dashed border-slate-400">
                <span>TOTAL TAGIHAN:</span>
                <span>Rp {(createdOrderReceipt.grandTotal || 0).toLocaleString('id-ID')}</span>
              </div>

              {!isOutstanding && (createdOrderReceipt.paidAmount || 0) > 0 && (
                <div className="space-y-0.5 text-[10px] border-t border-dashed border-slate-300 pt-1">
                  <div className="flex justify-between gap-2">
                    <span>{isDP ? 'DP Dibayar:' : 'Bayar:'}</span>
                    <span className="font-bold">Rp {createdOrderReceipt.paidAmount.toLocaleString('id-ID')}</span>
                  </div>
                  {isDP && (
                    <div className="flex justify-between gap-2 text-amber-800">
                      <span>Sisa Tagihan:</span>
                      <span className="font-bold">
                        Rp {Math.max(0, (createdOrderReceipt.grandTotal || 0) - createdOrderReceipt.paidAmount).toLocaleString('id-ID')}
                      </span>
                    </div>
                  )}
                  {createdOrderReceipt.changeAmount > 0 && (
                    <div className="flex justify-between gap-2">
                      <span>Kembalian:</span>
                      <span className="font-bold">Rp {createdOrderReceipt.changeAmount.toLocaleString('id-ID')}</span>
                    </div>
                  )}
                  {createdOrderReceipt.depositAdded > 0 && (
                    <div className="flex justify-between gap-2 text-emerald-800">
                      <span>Masuk Saldo Member:</span>
                      <span className="font-bold">+ Rp {createdOrderReceipt.depositAdded.toLocaleString('id-ID')}</span>
                    </div>
                  )}
                </div>
              )}

              <div className="flex justify-between gap-2 text-[10px] pt-1 border-t border-dashed border-slate-300">
                <span>Status Pembayaran:</span>
                <span className={`font-bold text-right ${
                  isLunas ? 'text-emerald-700' : isDP ? 'text-amber-700' : 'text-rose-700'
                }`}>
                  {paymentStatusLabel(
                    ps,
                    createdOrderReceipt.paymentMethod,
                    createdOrderReceipt.paymentBatchNo || createdOrderReceipt.payment_batch_no
                  )}
                </span>
              </div>

              {createdOrderReceipt.customerBalance != null && (
                <div className="flex justify-between gap-2 text-[10px]">
                  <span>Saldo Member:</span>
                  <span className="font-bold">Rp {createdOrderReceipt.customerBalance.toLocaleString('id-ID')}</span>
                </div>
              )}

              {createdOrderReceipt.generalNotes && createdOrderReceipt.generalNotes !== '-' && (
                <p className="text-[9px] text-slate-600 bg-slate-100 p-1.5 rounded border border-slate-200 break-words">
                  <b>Catatan:</b> {createdOrderReceipt.generalNotes}
                </p>
              )}

              {/* Barcode & QR Code Section */}
              <div className="pt-2 pb-1 border-t border-dashed border-slate-400 flex flex-col items-center justify-center gap-1.5 text-center">
                <div className="bg-white p-1 rounded border border-slate-200">
                  <Barcode
                    value={createdOrderReceipt.barcode || createdOrderReceipt.id || 'WLRH202608250001'}
                    format="CODE128"
                    width={1.1}
                    height={34}
                    fontSize={9}
                    margin={2}
                    background="#ffffff"
                    lineColor="#000000"
                  />
                </div>
                <div className="bg-white p-1 rounded border border-slate-200 shadow-2xs">
                  <QRCodeSVG
                    value={`${window.location.origin}/dashboard?trackingNo=${encodeURIComponent(createdOrderReceipt.id)}`}
                    size={76}
                    level="M"
                    includeMargin={false}
                  />
                </div>
                <p className="text-[8px] text-slate-500 font-bold uppercase tracking-tight">
                  Scan Barcode / QR untuk Lacak Status Nota
                </p>
              </div>

              <p className="text-center text-[9px] text-slate-400 pt-1 pb-1 border-t border-dashed border-slate-300">
                Terima kasih telah mempercayakan cucian Anda!
              </p>
            </div>
          </div>

          <div className="shrink-0 p-4 bg-[#f8f8f8] border-t border-[#e0e0e0] rounded-b-3xl">
            <button
              type="button"
              onClick={async () => {
                await showAlert({
                  title: 'Struk Dikirim',
                  message: 'Struk transaksi berhasil dikirim ke Printer Thermal Bluetooth!',
                  type: 'success',
                  confirmLabel: 'Selesai'
                });
                handleClose();
              }}
              className="w-full py-2.5 bg-[#5f1340] hover:bg-[#4d0f33] text-white rounded-xl font-black text-xs flex items-center justify-center gap-2 cursor-pointer shadow-xs"
            >
              <Printer className="h-4 w-4" />
              <span>Cetak Thermal</span>
            </button>
          </div>
        </div>
      </div>
    </div>,
    document.body
  );
}
