import React from 'react';
import { Sparkles, Check, Plus, ShoppingBag, Clock, Search, ArrowLeft, ArrowRight, Edit3, X } from 'lucide-react';
import ItemConfigModal from './ItemConfigModal.jsx';

const CleanoxBadge = () => (
  <span className="text-[9px] font-black text-sky-800 bg-sky-50 border border-sky-200 px-2 py-0.5 rounded-full inline-flex items-center gap-1">
    <Sparkles className="h-3 w-3" />
    Cleanox
  </span>
);

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
                    {rec.isCleanox && (
                      <div className="mt-1"><CleanoxBadge /></div>
                    )}
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
                    <div className="flex items-center gap-2">
                      {service.isCleanox && <CleanoxBadge />}
                      {!isSelected && (
                        <span className="text-[11px] text-slate-400 font-bold flex items-center gap-1">
                          <Clock className="h-3.5 w-3.5" /> {service.duration}
                        </span>
                      )}
                    </div>
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

      <ItemConfigModal
        configuringItem={configuringItem}
        setConfiguringItem={setConfiguringItem}
        itemSpecs={itemSpecs}
        setItemSpecs={setItemSpecs}
        handleAddToCart={handleAddToCart}
        isEditing={Boolean(configuringItem?.editingCartId)}
      />
    </div>
  );
}
