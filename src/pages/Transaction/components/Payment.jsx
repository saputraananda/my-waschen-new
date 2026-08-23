import React from 'react';
import { Receipt, ArrowLeft, CreditCard, Printer } from 'lucide-react';
import ThermalNota from './ThermalNota.jsx';

export default function Payment({
  setCurrentStep,
  selectedCustomer,
  formatName,
  renderTierBadge,
  activeOutletName,
  userProfile,
  cartItems,
  selectedPerfume,
  isExpress,
  isDelivery,
  generalOrderNotes,
  calculations,
  activePromo,
  paymentStatus,
  setPaymentStatus,
  paymentMethod,
  setPaymentMethod,
  handleCreateOrder,
  createdOrderReceipt,
  setCreatedOrderReceipt,
  setSelectedCustId,
  setCartItems
}) {
  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 w-full animate-fade-in">
      
      {/* Left 7 Columns: Detailed Order & Item Receipt Recap */}
      <div className="lg:col-span-7 flex flex-col gap-5">
        <div className="bg-white border border-[#e0e0e0] rounded-3xl p-5 sm:p-6 shadow-xs flex flex-col gap-5">
          
          <div className="flex items-center justify-between pb-4 border-b border-[#e0e0e0]">
            <div>
              <h2 className="text-base font-black text-[#5f1340] uppercase tracking-wider flex items-center gap-2">
                <Receipt className="h-5 w-5" />
                <span>Rincian Nota Transaksi POS</span>
              </h2>
              <p className="text-xs text-slate-400 mt-0.5">Periksa kembali data pelanggan dan rincian item cucian</p>
            </div>
            <button
              type="button"
              onClick={() => setCurrentStep(3)}
              className="px-3.5 py-2 bg-[#f8f8f8] hover:bg-[#e0e0e0] border border-[#e0e0e0] text-slate-700 font-bold rounded-xl text-xs flex items-center gap-1.5 cursor-pointer"
            >
              <ArrowLeft className="h-3.5 w-3.5" />
              <span>Ubah Keranjang</span>
            </button>
          </div>

          {/* Customer & Branch Overview Card */}
          <div className="p-4 bg-[#f8f8f8] border border-[#e0e0e0] rounded-2xl grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
            <div>
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Pelanggan:</span>
              <div className="flex items-center gap-1.5 mt-0.5">
                <span className="font-black text-sm text-[#313030]">{formatName(selectedCustomer?.name)}</span>
                {renderTierBadge(selectedCustomer?.tier)}
              </div>
              <span className="text-xs text-slate-500 font-medium block mt-0.5">{selectedCustomer?.phone}</span>
              <p className="text-[11px] text-slate-500 mt-1 line-clamp-2">{selectedCustomer?.address || 'Alamat belum diisi (Walk-in)'}</p>
            </div>

            <div className="sm:border-l sm:border-[#e0e0e0] sm:pl-4 space-y-1.5">
              <div>
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Outlet Kasir:</span>
                <span className="font-extrabold text-xs text-[#313030]">{activeOutletName}</span>
              </div>
              <div>
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Petugas Kasir:</span>
                <span className="font-bold text-xs text-slate-700">{userProfile?.fullName || 'Staff Kasir'}</span>
              </div>
              <div>
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Saldo Kartu Member:</span>
                <span className="font-black text-xs text-emerald-700">Rp {(selectedCustomer?.memberBalance || 0).toLocaleString('id-ID')}</span>
              </div>
            </div>
          </div>

          {/* Ordered Items Detailed List */}
          <div>
            <h3 className="text-xs font-black uppercase tracking-wider text-[#5f1340] mb-3 flex items-center justify-between">
              <span>Daftar Item Layanan ({cartItems.length})</span>
              <span className="text-[10px] font-bold text-slate-400">Harga Satuan & Subtotal</span>
            </h3>

            <div className="space-y-2.5 max-h-[320px] overflow-y-auto pr-1">
              {cartItems.map((item, idx) => (
                <div
                  key={item.cartId}
                  className="p-3.5 bg-white border border-[#e0e0e0] rounded-2xl flex flex-col gap-2 shadow-2xs"
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2.5 min-w-0">
                      <span className="w-5 h-5 rounded-lg bg-[#5f1340]/10 text-[#5f1340] font-black text-xs flex items-center justify-center shrink-0">
                        {idx + 1}
                      </span>
                      <div className="min-w-0">
                        <span className="font-extrabold text-xs text-[#313030] block truncate">{item.name}</span>
                        <span className="text-[10px] text-slate-400 font-semibold">
                          {item.qtyDisplay} &bull; Rp {item.unitPrice.toLocaleString('id-ID')} / {item.unit}
                        </span>
                      </div>
                    </div>
                    <span className="font-black text-xs text-[#5f1340]">
                      Rp {item.effectiveSubtotal.toLocaleString('id-ID')}
                    </span>
                  </div>

                  {/* Specs pill */}
                  <div className="p-2 bg-[#f8f8f8] rounded-xl text-[10px] text-slate-600 grid grid-cols-2 sm:grid-cols-4 gap-1.5">
                    <span>Merk: <b className="text-[#313030]">{item.brand}</b></span>
                    <span>Warna: <b className="text-[#313030]">{item.color}</b></span>
                    <span>Material: <b className="text-[#313030]">{item.material}</b></span>
                    <span>Ukuran: <b className="text-[#313030]">{item.size}</b></span>
                  </div>

                  {item.note !== '-' && (
                    <div className="text-[10px] text-amber-900 bg-amber-50 p-1.5 rounded-lg font-semibold border border-amber-200">
                      Catatan Item: {item.note}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>

          {/* Global Order Specs Recap */}
          <div className="p-4 bg-[#f8f8f8] border border-[#e0e0e0] rounded-2xl grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
            <div>
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Aroma Parfum:</span>
              <span className="font-extrabold text-[#313030]">{selectedPerfume}</span>
            </div>
            <div>
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Kecepatan:</span>
              <span className={`font-black ${isExpress ? 'text-amber-800' : 'text-[#313030]'}`}>
                {isExpress ? 'Express (1x24 Jam)' : 'Reguler (2-3 Hari)'}
              </span>
            </div>
            <div>
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Pengambilan:</span>
              <span className={`font-black ${isDelivery ? 'text-indigo-700' : 'text-[#313030]'}`}>
                {isDelivery ? 'Diantar (Delivery)' : 'Ambil di Toko'}
              </span>
            </div>

            {generalOrderNotes && (
              <div className="col-span-full pt-2 border-t border-[#e0e0e0] text-slate-600">
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-0.5">Catatan Nota Keseluruhan:</span>
                <p className="text-xs bg-white p-2.5 rounded-xl border border-[#e0e0e0] font-medium">{generalOrderNotes}</p>
              </div>
            )}
          </div>

        </div>
      </div>

      {/* Right 5 Columns: Financial Summary & Payment Checkout */}
      <div className="lg:col-span-5 flex flex-col gap-5">
        <div className="bg-gradient-to-b from-[#5f1340]/[0.03] via-white to-[#5f1340]/[0.05] border border-[#5f1340]/20 rounded-3xl p-6 shadow-md relative overflow-hidden flex flex-col gap-5">
          <div className="h-1.5 w-full bg-gradient-to-r from-[#5f1340] via-[#8e1f62] to-amber-400 absolute top-0 left-0" />

          <div>
            <h2 className="text-base font-black text-[#5f1340] uppercase tracking-wider flex items-center gap-2">
              <CreditCard className="h-5 w-5" />
              <span>Konfirmasi Pembayaran</span>
            </h2>
            <p className="text-xs text-slate-400 mt-0.5">Pilih status dan metode pembayaran nota</p>
          </div>

          {/* Calculation breakdown */}
          <div className="space-y-2.5 text-xs text-slate-600 font-medium p-4 bg-white border border-[#e0e0e0] rounded-2xl">
            <div className="flex justify-between items-center">
              <span>Subtotal ({cartItems.length} Item)</span>
              <span className="font-bold text-[#313030]">Rp {calculations.rawSubtotal.toLocaleString('id-ID')}</span>
            </div>

            {isExpress && (
              <div className="flex justify-between items-center text-amber-800">
                <span>Surcharge Express 1x24 Jam (x2)</span>
                <span className="font-bold">+ Rp {calculations.rawSubtotal.toLocaleString('id-ID')}</span>
              </div>
            )}

            {calculations.discountAmount > 0 && (
              <div className="flex justify-between items-center text-emerald-700">
                <span>Diskon Promo ({activePromo?.name})</span>
                <span className="font-bold">- Rp {calculations.discountAmount.toLocaleString('id-ID')}</span>
              </div>
            )}

            {/* Grand total highlight */}
            <div className="p-4 bg-gradient-to-r from-[#5f1340]/10 via-[#5f1340]/5 to-transparent border border-[#5f1340]/20 rounded-2xl flex justify-between items-center mt-2">
              <div>
                <span className="text-[11px] font-black uppercase tracking-wider text-[#5f1340] block">Grand Total Tagihan</span>
                <span className="text-[10px] text-slate-400 font-medium">Total yang harus dibayar</span>
              </div>
              <span className="text-2xl font-black text-[#5f1340] tracking-tight">
                Rp {calculations.grandTotal.toLocaleString('id-ID')}
              </span>
            </div>
          </div>

          {/* Payment status selector */}
          <div className="space-y-4">
            <div>
              <label className="text-[11px] font-bold text-slate-500 uppercase tracking-wider block mb-2">
                Status Pembayaran Nota
              </label>
              <div className="grid grid-cols-2 gap-3">
                <button
                  type="button"
                  onClick={() => setPaymentStatus('Lunas')}
                  className={`py-3 rounded-2xl text-xs font-black transition-all cursor-pointer ${
                    paymentStatus === 'Lunas'
                      ? 'bg-emerald-600 text-white shadow-sm'
                      : 'bg-white text-slate-600 border border-[#e0e0e0] hover:bg-slate-50'
                  }`}
                >
                  Lunas (Sudah Bayar)
                </button>
                <button
                  type="button"
                  onClick={() => setPaymentStatus('Belum Lunas')}
                  className={`py-3 rounded-2xl text-xs font-black transition-all cursor-pointer ${
                    paymentStatus === 'Belum Lunas'
                      ? 'bg-amber-600 text-white shadow-sm'
                      : 'bg-white text-slate-600 border border-[#e0e0e0] hover:bg-slate-50'
                  }`}
                >
                  Belum Lunas (Bayar Nanti)
                </button>
              </div>
            </div>

            {paymentStatus === 'Lunas' && (
              <div>
                <label className="text-[11px] font-bold text-slate-500 uppercase tracking-wider block mb-1.5">
                  Metode Pembayaran
                </label>
                <select
                  value={paymentMethod}
                  onChange={(e) => setPaymentMethod(e.target.value)}
                  className="w-full px-4 py-3 bg-white border border-[#e0e0e0] rounded-2xl text-xs font-bold text-[#313030] outline-none focus:border-[#5f1340] cursor-pointer"
                >
                  <option value="Tunai">Tunai Kasir</option>
                  <option value="QRIS Gopay">QRIS / E-Wallet</option>
                  <option value="Transfer BCA">Transfer Bank BCA</option>
                  {selectedCustomer?.memberBalance >= calculations.grandTotal && (
                    <option value="Saldo Member">Potong Saldo Member (Rp {selectedCustomer.memberBalance.toLocaleString('id-ID')})</option>
                  )}
                </select>
              </div>
            )}

            <button
              type="button"
              onClick={handleCreateOrder}
              className="w-full py-4 mt-2 rounded-2xl bg-gradient-to-r from-[#5f1340] to-[#7d1956] hover:from-[#4d0f33] hover:to-[#6a1549] text-white font-black text-sm shadow-lg shadow-[#5f1340]/25 active:scale-98 transition-all flex items-center justify-center gap-2.5 cursor-pointer"
            >
              <Printer className="h-5 w-5" />
              <span>Cetak & Simpan Struk Nota POS</span>
            </button>
          </div>

        </div>
      </div>

      {/* Embedded Thermal Nota Modal */}
      <ThermalNota
        createdOrderReceipt={createdOrderReceipt}
        setCreatedOrderReceipt={setCreatedOrderReceipt}
        setSelectedCustId={setSelectedCustId}
        setCartItems={setCartItems}
        setCurrentStep={setCurrentStep}
      />

    </div>
  );
}
