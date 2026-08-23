import React from 'react';
import { Sparkles, Check, Plus, ShoppingBag, Clock, Search, ArrowLeft, ArrowRight, Edit3, X } from 'lucide-react';

export default function SelectServices({
  topRecommendedServices,
  selectedCustomer,
  cartItems,
  handleOpenItemConfig,
  configuringItem,
  setConfiguringItem,
  itemSpecs,
  setItemSpecs,
  handleAddToCart,
  serviceCategoryFilter,
  setServiceCategoryFilter,
  serviceSearch,
  setServiceSearch,
  paginatedServices,
  totalServicePages,
  serviceCurrentPage,
  setServiceCurrentPage,
  setCurrentStep,
  calculations
}) {
  return (
    <div className="flex flex-col gap-6">
      
      {/* Top 5 Layanan Favorit Pelanggan Ini (Only if customer has history) */}
      {topRecommendedServices.length > 0 && (
        <div className="bg-gradient-to-r from-[#5f1340]/[0.06] via-white to-amber-500/[0.04] border border-[#5f1340]/25 rounded-3xl p-5 shadow-xs flex flex-col gap-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 text-[#5f1340]">
              <Sparkles className="h-4.5 w-4.5 text-amber-500" />
              <h3 className="text-xs font-black uppercase tracking-wider">
                Top 5 Layanan Favorit Pelanggan Ini ({selectedCustomer?.name})
              </h3>
            </div>
            <span className="text-[10px] font-bold text-slate-400">Rekomendasi Cepat</span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-5 gap-3 pt-1">
            {topRecommendedServices.map(rec => {
              const isSelected = cartItems.some(item => item.serviceId === rec.id);
              const selectedCount = cartItems.filter(item => item.serviceId === rec.id).length;

              return (
                <div
                  key={rec.id}
                  onClick={() => handleOpenItemConfig(rec)}
                  className={`p-3.5 bg-white border ${
                    isSelected
                      ? 'border-emerald-500 ring-2 ring-emerald-500/20 bg-emerald-500/[0.02]'
                      : 'border-[#5f1340]/20 hover:border-[#5f1340]'
                  } rounded-2xl shadow-2xs hover:shadow-xs transition-all cursor-pointer flex flex-col justify-between group relative`}
                >
                  {/* Centang Hijau di Sisi Kanan Atas */}
                  {isSelected && (
                    <div className="absolute top-2.5 right-2.5 bg-emerald-600 text-white rounded-full px-1.5 py-0.5 shadow-sm flex items-center gap-1 text-[10px] font-black z-10">
                      <Check className="h-3 w-3 stroke-[3px]" />
                      {selectedCount > 1 && <span>{selectedCount}</span>}
                    </div>
                  )}

                  <div>
                    <span className="text-[9px] font-black uppercase text-[#5f1340] bg-[#5f1340]/10 px-1.5 py-0.5 rounded inline-block mb-1">
                      {rec.category}
                    </span>
                    <h4 className="font-extrabold text-xs text-[#313030] group-hover:text-[#5f1340] line-clamp-1">
                      {rec.name}
                    </h4>
                    <span className="text-[10px] text-slate-400 block mt-0.5">
                      Rp {rec.price.toLocaleString('id-ID')} / {rec.unit}
                    </span>
                  </div>
                  <button
                    type="button"
                    className={`mt-3 w-full py-1.5 ${
                      isSelected
                        ? 'bg-emerald-600 text-white hover:bg-emerald-700'
                        : 'bg-[#5f1340]/10 hover:bg-[#5f1340] text-[#5f1340] hover:text-white'
                    } font-black text-[11px] rounded-xl transition-colors flex items-center justify-center gap-1`}
                  >
                    <Plus className="h-3.5 w-3.5" />
                    <span>{isSelected ? `Tambah (${selectedCount})` : 'Tambah'}</span>
                  </button>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Full Master Service Catalog with Search, Category Filter & Pagination */}
      <div className="bg-white border border-[#e0e0e0] rounded-3xl p-5 shadow-xs flex flex-col gap-4">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 pb-3 border-b border-[#e0e0e0]">
          <div>
            <h2 className="text-sm font-black text-[#5f1340] uppercase tracking-wider flex items-center gap-2">
              <ShoppingBag className="h-4 w-4" />
              <span>Langkah 2: Pilih Layanan Laundry (Kiloan, Satuan, Meteran, Sepatu)</span>
            </h2>
            <p className="text-xs text-slate-400 mt-0.5">Kiloan minimal 4 Kg (Rp 36.000). Anda dapat memilih lebih dari satu layanan.</p>
          </div>

          {/* Category Filter Chips */}
          <div className="flex items-center gap-1 overflow-x-auto no-scrollbar w-full sm:w-auto">
            {['Semua', 'Kiloan', 'Satuan', 'Meteran', 'Sepatu & Tas'].map(cat => (
              <button
                key={cat}
                type="button"
                onClick={() => setServiceCategoryFilter(cat)}
                className={`px-3 py-1.5 rounded-xl text-xs font-black transition-all cursor-pointer whitespace-nowrap ${
                  serviceCategoryFilter === cat
                    ? 'bg-[#5f1340] text-white shadow-xs'
                    : 'bg-[#f8f8f8] text-slate-600 border border-[#e0e0e0] hover:bg-slate-100'
                }`}
              >
                {cat}
              </button>
            ))}
          </div>
        </div>

        {/* Service Search Bar */}
        <div className="relative">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
          <input
            type="text"
            placeholder="Cari layanan (Kemeja, Bedcover, Cuci Setrika, Karpet, Sepatu)..."
            value={serviceSearch}
            onChange={(e) => setServiceSearch(e.target.value)}
            className="w-full pl-10 pr-4 py-2.5 bg-[#f8f8f8] border border-[#e0e0e0] rounded-xl text-xs font-semibold text-[#313030] outline-none focus:bg-white focus:border-[#5f1340]"
          />
        </div>

        {/* Service Cards Grid (Paginated) */}
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
          {paginatedServices.map(service => {
            const isSelected = cartItems.some(item => item.serviceId === service.id);
            const selectedCount = cartItems.filter(item => item.serviceId === service.id).length;

            return (
              <div
                key={service.id}
                onClick={() => handleOpenItemConfig(service)}
                className={`p-5 bg-white border ${
                  isSelected
                    ? 'border-emerald-500 ring-2 ring-emerald-500/20 bg-emerald-500/[0.02]'
                    : 'border-[#e0e0e0] hover:border-[#5f1340]/60'
                } hover:shadow-md rounded-3xl transition-all duration-200 cursor-pointer flex flex-col justify-between group relative overflow-hidden`}
              >
                {/* Centang Hijau di Sisi Kanan Atas */}
                {isSelected && (
                  <div className="absolute top-3 right-3 bg-emerald-600 text-white rounded-full px-2 py-0.5 shadow-sm flex items-center gap-1 text-[10px] font-black z-10 animate-fade-in">
                    <Check className="h-3.5 w-3.5 stroke-[3px]" />
                    <span>Terpilih {selectedCount > 1 ? `(${selectedCount}x)` : ''}</span>
                  </div>
                )}

                <div>
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-[10px] font-black uppercase tracking-wider text-[#5f1340] bg-[#5f1340]/10 px-2.5 py-0.5 rounded-full">
                      {service.category}
                    </span>
                    {!isSelected && (
                      <span className="text-[11px] text-slate-400 font-bold flex items-center gap-1">
                        <Clock className="h-3.5 w-3.5" /> {service.duration}
                      </span>
                    )}
                  </div>
                  <h4 className="font-extrabold text-sm text-[#313030] group-hover:text-[#5f1340] transition-colors leading-snug">
                    {service.name}
                  </h4>
                  <p className="text-xs text-slate-400 mt-1 line-clamp-2">{service.description}</p>
                </div>

                <div className="mt-4 pt-3 border-t border-[#e0e0e0]/70 flex items-center justify-between">
                  <div>
                    <span className="text-sm font-black text-[#5f1340] block">
                      Rp {service.price.toLocaleString('id-ID')}
                    </span>
                    <span className="text-[10px] text-slate-400">per {service.unit}</span>
                  </div>
                  <button
                    type="button"
                    className={`px-4 py-2 ${
                      isSelected
                        ? 'bg-emerald-600 hover:bg-emerald-700 text-white'
                        : 'bg-[#5f1340] text-white'
                    } rounded-xl text-xs font-black shadow-xs group-hover:scale-105 transition-transform flex items-center gap-1`}
                  >
                    <Plus className="h-3.5 w-3.5" />
                    <span>{isSelected ? 'Tambah Lagi' : 'Pilih'}</span>
                  </button>
                </div>
              </div>
            );
          })}
        </div>

        {/* Service Pagination Controls */}
        {totalServicePages > 1 && (
          <div className="flex items-center justify-between text-xs pt-3 border-t border-[#e0e0e0]">
            <span className="text-slate-400 text-xs">
              Halaman {serviceCurrentPage} dari {totalServicePages}
            </span>
            <div className="flex items-center gap-1.5">
              <button
                type="button"
                disabled={serviceCurrentPage === 1}
                onClick={() => setServiceCurrentPage(prev => Math.max(1, prev - 1))}
                className="px-3.5 py-1.5 bg-[#f8f8f8] border border-[#e0e0e0] rounded-xl disabled:opacity-40 hover:bg-slate-100 text-xs font-bold cursor-pointer"
              >
                Prev
              </button>
              <button
                type="button"
                disabled={serviceCurrentPage === totalServicePages}
                onClick={() => setServiceCurrentPage(prev => Math.min(totalServicePages, prev + 1))}
                className="px-3.5 py-1.5 bg-[#f8f8f8] border border-[#e0e0e0] rounded-xl disabled:opacity-40 hover:bg-slate-100 text-xs font-bold cursor-pointer"
              >
                Next
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Bottom Sticky Navigation Bar to Proceed to Cart */}
      <div className="bg-white border border-[#e0e0e0] rounded-3xl p-4 shadow-sm flex flex-col sm:flex-row items-center justify-between gap-4 sticky bottom-4 z-20">
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => setCurrentStep(1)}
            className="px-4 py-2.5 bg-[#f8f8f8] hover:bg-[#e0e0e0] border border-[#e0e0e0] text-slate-700 font-bold rounded-xl text-xs flex items-center gap-1.5 cursor-pointer"
          >
            <ArrowLeft className="h-4 w-4" />
            <span>Ganti Pelanggan</span>
          </button>
          <div className="text-xs">
            <span className="font-bold text-[#313030] block">
              {cartItems.length} Item Terpilih di Keranjang
            </span>
            <span className="text-[11px] text-[#5f1340] font-black">
              Estimasi Subtotal: Rp {calculations.rawSubtotal.toLocaleString('id-ID')}
            </span>
          </div>
        </div>

        <button
          type="button"
          disabled={cartItems.length === 0}
          onClick={() => setCurrentStep(3)}
          className="w-full sm:w-auto px-6 py-3 bg-[#5f1340] hover:bg-[#4d0f33] disabled:opacity-50 text-white font-black text-xs rounded-2xl shadow-md transition-all flex items-center justify-center gap-2 cursor-pointer"
        >
          <span>Lanjut ke Keranjang & Opsi ({cartItems.length} Item)</span>
          <ArrowRight className="h-4 w-4" />
        </button>
      </div>

      {/* MODAL: DETAIL & SPESIFIKASI ITEM */}
      {configuringItem && (
        <div className="fixed inset-0 z-50 bg-[#313030]/65 backdrop-blur-xs flex justify-center items-center p-3 sm:p-5 overflow-y-auto">
          <div className="bg-white rounded-3xl border border-[#e0e0e0] w-full max-w-2xl sm:max-w-3xl shadow-2xl overflow-hidden animate-fade-in my-auto">
            
            {/* Modal Header */}
            <div className="p-5 sm:p-6 border-b border-[#e0e0e0] flex justify-between items-start bg-[#f8f8f8]/60">
              <div className="flex items-start gap-3.5">
                <div className="w-12 h-12 rounded-2xl bg-[#5f1340]/10 text-[#5f1340] font-black flex items-center justify-center shrink-0">
                  <ShoppingBag className="h-6 w-6" />
                </div>
                <div>
                  <div className="flex items-center gap-2 flex-wrap mb-1">
                    <span className="text-[10px] font-black uppercase tracking-wider text-[#5f1340] bg-[#5f1340]/10 px-2.5 py-0.5 rounded-full">
                      {configuringItem.category}
                    </span>
                    <span className="text-xs text-slate-400 font-bold flex items-center gap-1">
                      <Clock className="h-3.5 w-3.5" /> {configuringItem.duration}
                    </span>
                  </div>
                  <h3 className="text-base sm:text-lg font-black text-[#313030] leading-snug">{configuringItem.name}</h3>
                  <span className="text-xs font-extrabold text-[#5f1340] mt-0.5 block">
                    Rp {configuringItem.price.toLocaleString('id-ID')} / {configuringItem.unit}
                  </span>
                </div>
              </div>

              <button
                type="button"
                onClick={() => setConfiguringItem(null)}
                className="p-2 rounded-xl text-slate-400 hover:text-[#313030] hover:bg-slate-200/60 transition-colors cursor-pointer"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <form onSubmit={handleAddToCart} className="p-5 sm:p-7 space-y-5 text-xs">
              
              {/* 1. Quantity / Weight Section */}
              <div className="p-4 sm:p-5 bg-[#f8f8f8] border border-[#e0e0e0] rounded-2xl space-y-3">
                {configuringItem.category === 'Kiloan' ? (
                  <div>
                    <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-1 mb-2.5">
                      <label className="text-xs font-black text-[#313030] uppercase tracking-wider">
                        Berat Timbangan Cucian (Kg) *
                      </label>
                      <span className="text-[11px] text-amber-700 bg-amber-50 border border-amber-200 px-2.5 py-0.5 rounded-full font-bold">
                        Minimal 4 Kg = Rp 36.000 (Bare Minimum)
                      </span>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-12 gap-3 items-center">
                      <div className="sm:col-span-6 flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => setItemSpecs(prev => ({ ...prev, weight: Math.max(0.5, (parseFloat(prev.weight) || 4) - 0.5) }))}
                          className="w-12 h-12 bg-white border border-[#e0e0e0] hover:border-[#5f1340] rounded-2xl flex items-center justify-center font-black text-lg text-[#5f1340] hover:bg-[#5f1340]/10 active:scale-95 transition-all cursor-pointer shadow-2xs"
                        >
                          -
                        </button>
                        <div className="relative flex-1">
                          <input
                            type="number"
                            step="0.1"
                            required
                            value={itemSpecs.weight}
                            onChange={(e) => setItemSpecs({ ...itemSpecs, weight: parseFloat(e.target.value) || 1 })}
                            className="w-full text-center py-2.5 bg-white border border-[#e0e0e0] rounded-2xl text-lg font-black text-[#313030] outline-none focus:border-[#5f1340] focus:ring-2 focus:ring-[#5f1340]/15 shadow-2xs"
                          />
                          <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs font-bold text-slate-400 pointer-events-none">
                            Kg
                          </span>
                        </div>
                        <button
                          type="button"
                          onClick={() => setItemSpecs(prev => ({ ...prev, weight: (parseFloat(prev.weight) || 4) + 0.5 }))}
                          className="w-12 h-12 bg-white border border-[#e0e0e0] hover:border-[#5f1340] rounded-2xl flex items-center justify-center font-black text-lg text-[#5f1340] hover:bg-[#5f1340]/10 active:scale-95 transition-all cursor-pointer shadow-2xs"
                        >
                          +
                        </button>
                      </div>

                      {/* Quick Presets for Kiloan */}
                      <div className="sm:col-span-6 flex items-center gap-1.5 overflow-x-auto no-scrollbar">
                        {[4, 5, 6, 8, 10].map(w => (
                          <button
                            key={w}
                            type="button"
                            onClick={() => setItemSpecs(prev => ({ ...prev, weight: w }))}
                            className={`flex-1 py-2.5 rounded-xl font-bold text-xs border transition-all cursor-pointer whitespace-nowrap ${
                              parseFloat(itemSpecs.weight) === w
                                ? 'bg-[#5f1340] text-white border-[#5f1340] shadow-xs'
                                : 'bg-white border-[#e0e0e0] text-slate-700 hover:bg-slate-100'
                            }`}
                          >
                            {w} Kg
                          </button>
                        ))}
                      </div>
                    </div>

                    {parseFloat(itemSpecs.weight) < 4 && (
                      <p className="text-[11px] text-amber-700 font-bold mt-2 bg-amber-100/50 p-2 rounded-xl border border-amber-200">
                        * Catatan: Timbangan di bawah 4 Kg tetap dikenakan tarif bare minimum Rp 36.000
                      </p>
                    )}
                  </div>
                ) : (
                  <div>
                    <div className="flex justify-between items-center mb-2.5">
                      <label className="text-xs font-black text-[#313030] uppercase tracking-wider">
                        Jumlah Kuantitas ({configuringItem.unit}) *
                      </label>
                      <span className="text-[11px] text-slate-400 font-bold">
                        Tarif: Rp {configuringItem.price.toLocaleString('id-ID')} / {configuringItem.unit}
                      </span>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-12 gap-3 items-center">
                      <div className="sm:col-span-6 flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => setItemSpecs(prev => ({ ...prev, qty: Math.max(1, (parseInt(prev.qty, 10) || 1) - 1) }))}
                          className="w-12 h-12 bg-white border border-[#e0e0e0] hover:border-[#5f1340] rounded-2xl flex items-center justify-center font-black text-lg text-[#5f1340] hover:bg-[#5f1340]/10 active:scale-95 transition-all cursor-pointer shadow-2xs"
                        >
                          -
                        </button>
                        <div className="relative flex-1">
                          <input
                            type="number"
                            min="1"
                            required
                            value={itemSpecs.qty}
                            onChange={(e) => setItemSpecs({ ...itemSpecs, qty: parseInt(e.target.value, 10) || 1 })}
                            className="w-full text-center py-2.5 bg-white border border-[#e0e0e0] rounded-2xl text-lg font-black text-[#313030] outline-none focus:border-[#5f1340] focus:ring-2 focus:ring-[#5f1340]/15 shadow-2xs"
                          />
                          <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs font-bold text-slate-400 pointer-events-none">
                            {configuringItem.unit}
                          </span>
                        </div>
                        <button
                          type="button"
                          onClick={() => setItemSpecs(prev => ({ ...prev, qty: (parseInt(prev.qty, 10) || 1) + 1 }))}
                          className="w-12 h-12 bg-white border border-[#e0e0e0] hover:border-[#5f1340] rounded-2xl flex items-center justify-center font-black text-lg text-[#5f1340] hover:bg-[#5f1340]/10 active:scale-95 transition-all cursor-pointer shadow-2xs"
                        >
                          +
                        </button>
                      </div>

                      {/* Quick Presets for Satuan */}
                      <div className="sm:col-span-6 flex items-center gap-1.5 overflow-x-auto no-scrollbar">
                        {[1, 2, 3, 5, 10].map(q => (
                          <button
                            key={q}
                            type="button"
                            onClick={() => setItemSpecs(prev => ({ ...prev, qty: q }))}
                            className={`flex-1 py-2.5 rounded-xl font-bold text-xs border transition-all cursor-pointer whitespace-nowrap ${
                              parseInt(itemSpecs.qty, 10) === q
                                ? 'bg-[#5f1340] text-white border-[#5f1340] shadow-xs'
                                : 'bg-white border-[#e0e0e0] text-slate-700 hover:bg-slate-100'
                            }`}
                          >
                            {q} {configuringItem.unit}
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>
                )}
              </div>

              {/* 2. Item Specifications (Merk, Warna, Material, Ukuran) */}
              <div>
                <h4 className="text-xs font-black uppercase tracking-wider text-[#5f1340] mb-3 flex items-center gap-1.5">
                  <Edit3 className="h-3.5 w-3.5" />
                  <span>Rincian Spesifikasi Item (Opsional)</span>
                </h4>

                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3.5">
                  <div>
                    <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1">
                      Merk / Brand
                    </label>
                    <input
                      type="text"
                      placeholder="Misal: Uniqlo, Zara"
                      value={itemSpecs.brand}
                      onChange={(e) => setItemSpecs({ ...itemSpecs, brand: e.target.value })}
                      className="w-full px-3.5 py-2.5 bg-[#f8f8f8] border border-[#e0e0e0] rounded-xl text-xs font-semibold outline-none focus:bg-white focus:border-[#5f1340]"
                    />
                  </div>

                  <div>
                    <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1">
                      Warna
                    </label>
                    <input
                      type="text"
                      placeholder="Misal: Putih, Navy, Hitam"
                      value={itemSpecs.color}
                      onChange={(e) => setItemSpecs({ ...itemSpecs, color: e.target.value })}
                      className="w-full px-3.5 py-2.5 bg-[#f8f8f8] border border-[#e0e0e0] rounded-xl text-xs font-semibold outline-none focus:bg-white focus:border-[#5f1340]"
                    />
                  </div>

                  <div>
                    <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1">
                      Bahan / Material
                    </label>
                    <input
                      type="text"
                      placeholder="Misal: Katun, Sutra, Wool"
                      value={itemSpecs.material}
                      onChange={(e) => setItemSpecs({ ...itemSpecs, material: e.target.value })}
                      className="w-full px-3.5 py-2.5 bg-[#f8f8f8] border border-[#e0e0e0] rounded-xl text-xs font-semibold outline-none focus:bg-white focus:border-[#5f1340]"
                    />
                  </div>

                  <div>
                    <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1">
                      Ukuran / Size
                    </label>
                    <input
                      type="text"
                      placeholder="Misal: L, XL, 2x3m"
                      value={itemSpecs.size}
                      onChange={(e) => setItemSpecs({ ...itemSpecs, size: e.target.value })}
                      className="w-full px-3.5 py-2.5 bg-[#f8f8f8] border border-[#e0e0e0] rounded-xl text-xs font-semibold outline-none focus:bg-white focus:border-[#5f1340]"
                    />
                  </div>
                </div>
              </div>

              {/* 3. Physical Condition / Notes */}
              <div>
                <label className="text-xs font-bold text-slate-600 uppercase tracking-wider block mb-1.5">
                  Keterangan / Kondisi Fisik Item (Opsional)
                </label>
                <textarea
                  rows="2"
                  placeholder="Contoh: Kancing kedua lepas, ada noda minyak di lengan bawah, robek kecil di sambungan kerah..."
                  value={itemSpecs.note}
                  onChange={(e) => setItemSpecs({ ...itemSpecs, note: e.target.value })}
                  className="w-full p-3 bg-[#f8f8f8] border border-[#e0e0e0] rounded-2xl text-xs font-medium outline-none focus:bg-white focus:border-[#5f1340]"
                />
              </div>

              {/* 4. Action Buttons & Live Item Subtotal */}
              <div className="pt-3 border-t border-[#e0e0e0] flex flex-col sm:flex-row items-center justify-between gap-4">
                <div>
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Estimasi Subtotal Item:</span>
                  <span className="text-lg font-black text-[#5f1340]">
                    Rp {(
                      configuringItem.category === 'Kiloan'
                        ? (parseFloat(itemSpecs.weight) < 4 ? 36000 : (parseFloat(itemSpecs.weight) || 4) * configuringItem.price)
                        : ((parseInt(itemSpecs.qty, 10) || 1) * configuringItem.price)
                    ).toLocaleString('id-ID')}
                  </span>
                </div>

                <div className="flex items-center gap-2.5 w-full sm:w-auto">
                  <button
                    type="button"
                    onClick={() => setConfiguringItem(null)}
                    className="flex-1 sm:flex-none px-5 py-3.5 bg-[#f8f8f8] hover:bg-[#e0e0e0] text-slate-700 font-bold text-xs rounded-2xl transition-all cursor-pointer"
                  >
                    Batal
                  </button>

                  <button
                    type="submit"
                    className="flex-1 sm:flex-none px-7 py-3.5 bg-gradient-to-r from-[#5f1340] to-[#7d1956] hover:from-[#4d0f33] hover:to-[#6a1549] text-white font-black text-xs rounded-2xl shadow-md active:scale-98 transition-all cursor-pointer flex items-center justify-center gap-2"
                  >
                    <Plus className="h-4 w-4" />
                    <span>Masukkan ke Keranjang</span>
                  </button>
                </div>
              </div>

            </form>
          </div>
        </div>
      )}
    </div>
  );
}
