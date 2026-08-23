import React from 'react';
import { Printer, X } from 'lucide-react';

export default function ThermalNota({
  createdOrderReceipt,
  setCreatedOrderReceipt,
  setSelectedCustId,
  setCartItems,
  setCurrentStep
}) {
  if (!createdOrderReceipt) return null;

  return (
    <div className="fixed inset-0 z-50 bg-[#313030]/60 backdrop-blur-xs flex justify-center items-center p-4">
      <div className="bg-white rounded-3xl border border-[#e0e0e0] w-full max-w-sm shadow-2xl overflow-hidden animate-fade-in">
        <div className="p-4 border-b border-[#e0e0e0] flex justify-between items-center bg-[#f8f8f8]">
          <div className="flex items-center gap-2">
            <Printer className="h-5 w-5 text-[#5f1340]" />
            <h3 className="text-sm font-black text-[#313030]">Struk Nota Transaksi POS</h3>
          </div>
          <button 
            type="button"
            onClick={() => setCreatedOrderReceipt(null)} 
            className="p-1 text-slate-400 hover:text-[#313030] cursor-pointer"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Thermal Slip Simulation */}
        <div className="p-5 font-mono text-xs text-slate-800 space-y-3 bg-[#fffefb] border-b border-dashed border-slate-300 max-h-[450px] overflow-y-auto">
          <div className="text-center pb-2 border-b border-dashed border-slate-300">
            <span className="font-black text-sm block">WASCHEN LAUNDRY</span>
            <span className="text-[10px] text-slate-500 block">{createdOrderReceipt.branch}</span>
            <span className="text-[9px] text-slate-400 block mt-0.5">{createdOrderReceipt.createdAt}</span>
          </div>

          <div>
            <span className="font-bold block">No. Nota: {createdOrderReceipt.id}</span>
            <span>Pelanggan: {createdOrderReceipt.customerName}</span>
            <span className="text-[10px] text-slate-500 block">Telp: {createdOrderReceipt.customerPhone}</span>
            <span className="text-[10px] text-slate-500 block">Alamat: {createdOrderReceipt.customerAddress}</span>
            <span className="text-[10px] text-slate-500 block">Kasir: {createdOrderReceipt.cashierName}</span>
          </div>

          {/* Items Table */}
          <div className="border-t border-b border-dashed border-slate-300 py-2 space-y-1.5">
            {createdOrderReceipt.items && createdOrderReceipt.items.map((item, idx) => (
              <div key={idx} className="space-y-0.5">
                <div className="flex justify-between font-bold">
                  <span>{item.name}</span>
                  <span>Rp {(item.effectiveSubtotal || 0).toLocaleString('id-ID')}</span>
                </div>
                <div className="flex justify-between text-[10px] text-slate-500">
                  <span>Qty: {item.qtyDisplay}</span>
                  <span>Merk: {item.brand} | Warna: {item.color}</span>
                </div>
                {item.note !== '-' && (
                  <div className="text-[9px] text-amber-800">
                    Ket: {item.note}
                  </div>
                )}
              </div>
            ))}
          </div>

          {/* Breakdown */}
          <div className="space-y-1 text-[11px]">
            <div className="flex justify-between">
              <span>Aroma Parfum:</span>
              <span className="font-bold">{createdOrderReceipt.perfume}</span>
            </div>
            <div className="flex justify-between">
              <span>Tipe Pengerjaan:</span>
              <span className="font-bold">{createdOrderReceipt.isExpress ? 'EXPRESS 1X24 JAM' : 'REGULER'}</span>
            </div>
            <div className="flex justify-between">
              <span>Tipe Pengambilan:</span>
              <span className="font-bold">{createdOrderReceipt.isDelivery ? 'DIANTAR KE RUMAH' : 'AMBIL DI OUTLET'}</span>
            </div>
            {createdOrderReceipt.discountAmount > 0 && (
              <div className="flex justify-between text-emerald-700">
                <span>Diskon Promo:</span>
                <span>- Rp {createdOrderReceipt.discountAmount.toLocaleString('id-ID')}</span>
              </div>
            )}
          </div>

          <div className="flex justify-between font-black text-sm pt-2 border-t border-dashed border-slate-300">
            <span>TOTAL TAGIHAN:</span>
            <span>Rp {(createdOrderReceipt.grandTotal || 0).toLocaleString('id-ID')}</span>
          </div>

          <div className="flex justify-between text-[10px]">
            <span>Status Pembayaran:</span>
            <span className="font-bold">{createdOrderReceipt.paymentStatus} ({createdOrderReceipt.paymentMethod})</span>
          </div>

          {createdOrderReceipt.generalNotes !== '-' && (
            <div className="text-[10px] text-slate-600 bg-slate-100 p-2 rounded border border-slate-200">
              <b>Catatan Nota:</b> {createdOrderReceipt.generalNotes}
            </div>
          )}
        </div>

        <div className="p-4 bg-[#f8f8f8] flex gap-2">
          <button
            type="button"
            onClick={() => {
              alert('Struk transaksi berhasil dikirim ke Printer Thermal Bluetooth!');
              setCreatedOrderReceipt(null);
              setSelectedCustId('');
              setCartItems([]);
              setCurrentStep(1); // Return to Step 1 for next order
            }}
            className="flex-1 py-2.5 bg-[#5f1340] hover:bg-[#4d0f33] text-white rounded-xl font-black text-xs flex items-center justify-center gap-2 cursor-pointer shadow-xs"
          >
            <Printer className="h-4 w-4" />
            <span>Cetak Thermal</span>
          </button>
        </div>
      </div>
    </div>
  );
}
