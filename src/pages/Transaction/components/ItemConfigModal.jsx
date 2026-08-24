import React from 'react';
import { Sparkles, Plus, ShoppingBag, Clock, Edit3, X, Save } from 'lucide-react';

const CleanoxBadge = () => (
  <span className="text-[9px] font-black text-sky-800 bg-sky-50 border border-sky-200 px-2 py-0.5 rounded-full inline-flex items-center gap-1">
    <Sparkles className="h-3 w-3" />
    Cleanox
  </span>
);

/**
 * Modal rincian item layanan — dipakai di Pilih Layanan (tambah) & Keranjang (edit).
 */
export default function ItemConfigModal({
  configuringItem,
  setConfiguringItem,
  itemSpecs,
  setItemSpecs,
  handleAddToCart,
  isEditing = false
}) {
  if (!configuringItem) return null;

  return (
    <div className="fixed inset-0 z-50 bg-[#313030]/65 backdrop-blur-xs flex justify-center items-center p-3 sm:p-5 overflow-y-auto">
      <div className="bg-white rounded-3xl border border-[#e0e0e0] w-full max-w-2xl sm:max-w-3xl shadow-2xl overflow-hidden animate-fade-in my-auto">

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
                {isEditing && (
                  <span className="text-[10px] font-black uppercase tracking-wider text-amber-800 bg-amber-50 border border-amber-200 px-2.5 py-0.5 rounded-full">
                    Edit Item Keranjang
                  </span>
                )}
              </div>
              <h3 className="text-base sm:text-lg font-black text-[#313030] leading-snug">{configuringItem.name}</h3>
              <span className="text-xs font-extrabold text-[#5f1340] mt-0.5 block">
                Rp {configuringItem.price.toLocaleString('id-ID')} / {configuringItem.unit}
              </span>
              {configuringItem.isCleanox && (
                <div className="mt-2"><CleanoxBadge /></div>
              )}
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
                      onClick={() => setItemSpecs((prev) => ({ ...prev, weight: Math.max(0.5, (parseFloat(prev.weight) || 4) - 0.5) }))}
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
                      onClick={() => setItemSpecs((prev) => ({ ...prev, weight: (parseFloat(prev.weight) || 4) + 0.5 }))}
                      className="w-12 h-12 bg-white border border-[#e0e0e0] hover:border-[#5f1340] rounded-2xl flex items-center justify-center font-black text-lg text-[#5f1340] hover:bg-[#5f1340]/10 active:scale-95 transition-all cursor-pointer shadow-2xs"
                    >
                      +
                    </button>
                  </div>

                  <div className="sm:col-span-6 flex items-center gap-1.5 overflow-x-auto no-scrollbar">
                    {[4, 5, 6, 8, 10].map((w) => (
                      <button
                        key={w}
                        type="button"
                        onClick={() => setItemSpecs((prev) => ({ ...prev, weight: w }))}
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
                      onClick={() => setItemSpecs((prev) => ({ ...prev, qty: Math.max(1, (parseInt(prev.qty, 10) || 1) - 1) }))}
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
                      onClick={() => setItemSpecs((prev) => ({ ...prev, qty: (parseInt(prev.qty, 10) || 1) + 1 }))}
                      className="w-12 h-12 bg-white border border-[#e0e0e0] hover:border-[#5f1340] rounded-2xl flex items-center justify-center font-black text-lg text-[#5f1340] hover:bg-[#5f1340]/10 active:scale-95 transition-all cursor-pointer shadow-2xs"
                    >
                      +
                    </button>
                  </div>

                  <div className="sm:col-span-6 flex items-center gap-1.5 overflow-x-auto no-scrollbar">
                    {[1, 2, 3, 5, 10].map((q) => (
                      <button
                        key={q}
                        type="button"
                        onClick={() => setItemSpecs((prev) => ({ ...prev, qty: q }))}
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

          <div>
            <h4 className="text-xs font-black uppercase tracking-wider text-[#5f1340] mb-3 flex items-center gap-1.5">
              <Edit3 className="h-3.5 w-3.5" />
              <span>Rincian Spesifikasi Item (Opsional)</span>
            </h4>

            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3.5">
              <div>
                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1">Merk / Brand</label>
                <input
                  type="text"
                  placeholder="Misal: Uniqlo, Zara"
                  value={itemSpecs.brand}
                  onChange={(e) => setItemSpecs({ ...itemSpecs, brand: e.target.value })}
                  className="w-full px-3.5 py-2.5 bg-[#f8f8f8] border border-[#e0e0e0] rounded-xl text-xs font-semibold outline-none focus:bg-white focus:border-[#5f1340]"
                />
              </div>
              <div>
                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1">Warna</label>
                <input
                  type="text"
                  placeholder="Misal: Putih, Navy, Hitam"
                  value={itemSpecs.color}
                  onChange={(e) => setItemSpecs({ ...itemSpecs, color: e.target.value })}
                  className="w-full px-3.5 py-2.5 bg-[#f8f8f8] border border-[#e0e0e0] rounded-xl text-xs font-semibold outline-none focus:bg-white focus:border-[#5f1340]"
                />
              </div>
              <div>
                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1">Bahan / Material</label>
                <input
                  type="text"
                  placeholder="Misal: Katun, Sutra, Wool"
                  value={itemSpecs.material}
                  onChange={(e) => setItemSpecs({ ...itemSpecs, material: e.target.value })}
                  className="w-full px-3.5 py-2.5 bg-[#f8f8f8] border border-[#e0e0e0] rounded-xl text-xs font-semibold outline-none focus:bg-white focus:border-[#5f1340]"
                />
              </div>
              <div>
                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1">Ukuran / Size</label>
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

          <div className="flex items-center justify-between p-4 bg-sky-50/80 border border-sky-200 rounded-2xl">
            <div>
              <span className="font-extrabold text-xs text-[#313030] block">Cleanox By Waschen</span>
              <span className="text-[10px] text-slate-500">
                {configuringItem.isCleanox
                  ? 'Layanan ini default Cleanox — bisa dimatikan per item'
                  : 'Aktifkan jika item ini dikerjakan tim Cleanox'}
              </span>
            </div>
            <label className="relative inline-flex items-center cursor-pointer">
              <input
                type="checkbox"
                checked={itemSpecs.isCleanox === true}
                onChange={(e) => setItemSpecs({ ...itemSpecs, isCleanox: e.target.checked })}
                className="sr-only peer"
              />
              <div className="w-10 h-6 bg-slate-300 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-sky-600" />
            </label>
          </div>

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
                {isEditing ? <Save className="h-4 w-4" /> : <Plus className="h-4 w-4" />}
                <span>{isEditing ? 'Simpan Perubahan' : 'Masukkan ke Keranjang'}</span>
              </button>
            </div>
          </div>

        </form>
      </div>
    </div>
  );
}
