import React from 'react';
import { Receipt, Plus, Trash2, Edit3, Zap, Truck, ArrowLeft, ArrowRight } from 'lucide-react';

export default function Cart({
  cartItems,
  setCurrentStep,
  handleRemoveFromCart,
  handleToggleItemExpand,
  selectedCustomer,
  renderTierBadge,
  formatName,
  isExpress,
  setIsExpress,
  selectedPromoCode,
  setSelectedPromoCode,
  PROMO_LIST,
  hasValidAddress,
  isDelivery,
  setIsDelivery,
  selectedPerfume,
  setSelectedPerfume,
  generalOrderNotes,
  setGeneralOrderNotes,
  calculations
}) {
  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">

      {/* Left 7 Columns: Detailed Cart Items List */}
      <div className="lg:col-span-7 flex flex-col gap-5">
        
        <div className="bg-white border border-[#e0e0e0] rounded-3xl p-5 shadow-xs flex flex-col gap-4">
          <div className="flex items-center justify-between pb-3 border-b border-[#e0e0e0]">
            <div>
              <h2 className="text-sm font-black text-[#5f1340] uppercase tracking-wider flex items-center gap-2">
                <Receipt className="h-4 w-4" />
                <span>Langkah 3: Rincian Item di Keranjang ({cartItems.length})</span>
              </h2>
              <p className="text-xs text-slate-400 mt-0.5">Klik "Lihat Rincian Item" untuk melihat merk, warna, material, ukuran & catatan fisik</p>
            </div>

            <button
              type="button"
              onClick={() => setCurrentStep(2)}
              className="px-3.5 py-1.5 bg-[#5f1340]/10 hover:bg-[#5f1340] text-[#5f1340] hover:text-white font-black text-xs rounded-xl transition-colors flex items-center gap-1 cursor-pointer"
            >
              <Plus className="h-3.5 w-3.5" />
              <span>Tambah Layanan Lain</span>
            </button>
          </div>

          {cartItems.length > 0 ? (
            <div className="space-y-3">
              {cartItems.map((item, idx) => (
                <div
                  key={item.cartId}
                  className="p-4 bg-[#f8f8f8] border border-[#e0e0e0] rounded-2xl shadow-2xs hover:border-[#5f1340]/40 transition-all flex flex-col gap-2.5"
                >
                  <div className="flex items-center justify-between gap-3">
                    <div className="flex items-center gap-3 min-w-0">
                      <span className="w-6 h-6 rounded-lg bg-[#5f1340]/10 text-[#5f1340] font-black text-xs flex items-center justify-center shrink-0">
                        {idx + 1}
                      </span>
                      <div className="min-w-0">
                        <span className="font-black text-xs text-[#313030] block truncate">{item.name}</span>
                        <span className="text-[11px] text-slate-400 font-semibold">
                          {item.qtyDisplay} &bull; Rp {item.unitPrice.toLocaleString('id-ID')} / {item.unit}
                        </span>
                      </div>
                    </div>

                    <div className="flex items-center gap-3 shrink-0">
                      <span className="font-black text-sm text-[#5f1340]">
                        Rp {item.effectiveSubtotal.toLocaleString('id-ID')}
                      </span>
                      <button
                        type="button"
                        onClick={() => handleRemoveFromCart(item.cartId)}
                        className="p-1.5 text-slate-400 hover:text-rose-600 rounded-lg hover:bg-rose-50 cursor-pointer"
                        title="Hapus Item"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  </div>

                  {/* Expandable Specifications Pill */}
                  <div className="pt-2 border-t border-[#e0e0e0] flex items-center justify-between">
                    <button
                      type="button"
                      onClick={() => handleToggleItemExpand(item.cartId)}
                      className="text-xs text-[#5f1340] font-extrabold flex items-center gap-1 hover:underline cursor-pointer"
                    >
                      <Edit3 className="h-3 w-3" />
                      <span>{item.isExpanded ? 'Sembunyikan Rincian Spesifikasi' : 'Lihat / Periksa Rincian Item'}</span>
                    </button>
                    {item.note !== '-' && (
                      <span className="text-[10px] font-bold text-amber-800 bg-amber-50 border border-amber-200 px-2 py-0.5 rounded-full">
                        Ada Catatan Khusus
                      </span>
                    )}
                  </div>

                  {item.isExpanded && (
                    <div className="p-3 bg-white border border-[#e0e0e0] rounded-xl text-xs space-y-1.5 text-slate-600 font-medium">
                      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                        <span>Merk: <b className="text-[#313030]">{item.brand}</b></span>
                        <span>Warna: <b className="text-[#313030]">{item.color}</b></span>
                        <span>Material: <b className="text-[#313030]">{item.material}</b></span>
                        <span>Ukuran: <b className="text-[#313030]">{item.size}</b></span>
                      </div>
                      {item.note !== '-' && (
                        <div className="text-amber-900 bg-amber-50 p-2 rounded-lg mt-1 font-semibold border border-amber-200">
                          <b>Kondisi Fisik / Catatan:</b> {item.note}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              ))}
            </div>
          ) : (
            <div className="p-8 text-center text-slate-400">
              <Receipt className="h-10 w-10 mx-auto text-slate-300 mb-2" />
              <span className="text-xs font-bold block text-[#313030]">Keranjang Kosong</span>
              <button
                type="button"
                onClick={() => setCurrentStep(2)}
                className="mt-3 px-4 py-2 bg-[#5f1340] text-white font-bold text-xs rounded-xl"
              >
                Pilih Layanan
              </button>
            </div>
          )}
        </div>

      </div>

      {/* Right 5 Columns: Options (Express, Promo, Delivery, Perfume, Notes) */}
      <div className="lg:col-span-5 flex flex-col gap-5">
        
        <div className="bg-white border border-[#e0e0e0] rounded-3xl p-5 shadow-xs flex flex-col gap-4">
          
          {/* Brief Customer Card */}
          <div className="p-4 bg-[#f8f8f8] border border-[#e0e0e0] rounded-2xl flex items-center justify-between gap-3">
            <div className="min-w-0">
              <div className="flex items-center gap-1.5">
                <span className="font-black text-xs text-[#313030] truncate">{formatName(selectedCustomer?.name)}</span>
                {renderTierBadge(selectedCustomer?.tier)}
              </div>
              <p className="text-[11px] text-slate-500 truncate mt-0.5">{selectedCustomer?.address || 'Alamat belum dilengkapi'}</p>
              <span className="text-[11px] font-extrabold text-emerald-700 block mt-0.5">
                Saldo Kartu: Rp {(selectedCustomer?.memberBalance || 0).toLocaleString('id-ID')}
              </span>
            </div>
          </div>

          {/* Option Controls */}
          <div className="space-y-3.5 text-xs">
            
            {/* Express Toggle (1x24 Jam, X2 Price) */}
            <div className="flex items-center justify-between p-3 bg-[#f8f8f8] border border-[#e0e0e0] rounded-2xl">
              <div className="flex items-center gap-2.5">
                <div className={`p-2 rounded-xl ${isExpress ? 'bg-amber-500 text-white' : 'bg-slate-200 text-slate-600'}`}>
                  <Zap className="h-4 w-4" />
                </div>
                <div>
                  <span className="font-extrabold text-xs text-[#313030] block">Layanan Express (1x24 Jam)</span>
                  <span className="text-[10px] text-slate-400">Harga seluruh item x2 (Surcharge)</span>
                </div>
              </div>
              <label className="relative inline-flex items-center cursor-pointer">
                <input
                  type="checkbox"
                  checked={isExpress}
                  onChange={(e) => setIsExpress(e.target.checked)}
                  className="sr-only peer"
                />
                <div className="w-10 h-6 bg-slate-300 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-[#5f1340]"></div>
              </label>
            </div>

            {/* Promo Selector */}
            <div>
              <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1">
                Pilihan Promo Diskon (mst_promo)
              </label>
              <select
                value={selectedPromoCode}
                onChange={(e) => setSelectedPromoCode(e.target.value)}
                className="w-full px-3 py-2.5 bg-[#f8f8f8] border border-[#e0e0e0] rounded-xl text-xs font-bold text-[#313030] outline-none focus:border-[#5f1340] cursor-pointer"
              >
                {PROMO_LIST.map(p => (
                  <option key={p.code} value={p.code}>
                    {p.name} {p.value > 0 ? `(${p.type === 'percentage' ? `${p.value}%` : `Rp ${p.value.toLocaleString('id-ID')}`})` : ''}
                  </option>
                ))}
              </select>
            </div>

            {/* Delivery Toggle (Requires Address) */}
            <div className={`p-3 border rounded-2xl flex items-center justify-between ${
              hasValidAddress ? 'bg-[#f8f8f8] border-[#e0e0e0]' : 'bg-slate-50 border-slate-200 opacity-60'
            }`}>
              <div className="flex items-center gap-2.5">
                <div className={`p-2 rounded-xl ${isDelivery ? 'bg-indigo-600 text-white' : 'bg-slate-200 text-slate-600'}`}>
                  <Truck className="h-4 w-4" />
                </div>
                <div>
                  <span className="font-extrabold text-xs text-[#313030] block">Layanan Antar (Delivery)</span>
                  <span className="text-[10px] text-slate-400">
                    {hasValidAddress ? 'Nota wajib diantar ke alamat customer' : 'Alamat belum diisi (Disabled)'}
                  </span>
                </div>
              </div>
              <label className={`relative inline-flex items-center ${hasValidAddress ? 'cursor-pointer' : 'cursor-not-allowed'}`}>
                <input
                  type="checkbox"
                  disabled={!hasValidAddress}
                  checked={isDelivery}
                  onChange={(e) => setIsDelivery(e.target.checked)}
                  className="sr-only peer"
                />
                <div className="w-10 h-6 bg-slate-300 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-indigo-600"></div>
              </label>
            </div>

            {/* Perfume Selector */}
            <div>
              <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1">
                Aroma Parfum
              </label>
              <select
                value={selectedPerfume}
                onChange={(e) => setSelectedPerfume(e.target.value)}
                className="w-full px-3 py-2.5 bg-[#f8f8f8] border border-[#e0e0e0] rounded-xl text-xs font-bold text-[#313030] outline-none focus:border-[#5f1340] cursor-pointer"
              >
                <option value="Standar">Standar</option>
                <option value="Tanpa Parfum">Tanpa Parfum</option>
              </select>
            </div>

            {/* General Order Notes */}
            <div>
              <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1">
                Keterangan / Catatan Keseluruhan Nota
              </label>
              <textarea
                rows="2"
                placeholder="Contoh: Packing double plastik rapi, diantar hari Sabtu sore..."
                value={generalOrderNotes}
                onChange={(e) => setGeneralOrderNotes(e.target.value)}
                className="w-full p-2.5 bg-[#f8f8f8] border border-[#e0e0e0] rounded-xl text-xs font-medium text-[#313030] outline-none focus:border-[#5f1340]"
              />
            </div>

          </div>

          {/* Subtotal & Next Step Button */}
          <div className="pt-3 border-t border-[#e0e0e0] space-y-3">
            <div className="flex justify-between items-center text-xs">
              <span className="font-bold text-slate-500">Estimasi Total Tagihan:</span>
              <span className="font-black text-base text-[#5f1340]">Rp {calculations.grandTotal.toLocaleString('id-ID')}</span>
            </div>

            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setCurrentStep(2)}
                className="px-4 py-3 bg-[#f8f8f8] hover:bg-[#e0e0e0] border border-[#e0e0e0] text-slate-700 font-bold rounded-2xl text-xs cursor-pointer flex items-center gap-1"
              >
                <ArrowLeft className="h-4 w-4" /> Kembali
              </button>
              <button
                type="button"
                disabled={cartItems.length === 0}
                onClick={() => setCurrentStep(4)}
                className="flex-1 py-3 bg-[#5f1340] hover:bg-[#4d0f33] disabled:opacity-50 text-white font-black text-xs rounded-2xl shadow-md transition-all flex items-center justify-center gap-2 cursor-pointer"
              >
                <span>Lanjut ke Pembayaran</span>
                <ArrowRight className="h-4 w-4" />
              </button>
            </div>
          </div>

        </div>

      </div>

    </div>
  );
}
