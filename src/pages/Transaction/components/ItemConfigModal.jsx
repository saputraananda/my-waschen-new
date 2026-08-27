import React, { useState, useRef, useEffect } from 'react';
import { Sparkles, Plus, ShoppingBag, Clock, Edit3, X, Save, ChevronDown, Search, Check } from 'lucide-react';

const CleanoxBadge = () => (
  <span className="text-[9px] font-black text-sky-800 bg-sky-50 border border-sky-200 px-2 py-0.5 rounded-full inline-flex items-center gap-1">
    <Sparkles className="h-3 w-3" />
    Cleanox
  </span>
);

export const MATERIAL_OPTIONS = [
  'Cotton', 'Linen', 'Silk', 'Wool', 'Cashmere', 'Hemp', 'Bamboo', 'Leather',
  'Rayon', 'Modal', 'Lyocell', 'Polyester', 'Nylon', 'Acrylic', 'Spandex',
  'Fleece', 'Microfiber', 'Mesh', 'Neoprene', 'Gore-Tex', 'Denim', 'Twill',
  'Poplin', 'Canvas', 'Corduroy', 'Jersey', 'Suede', 'Chiffon', 'Velvet',
  'Satin', 'Organza', 'Tulle', 'Brokat', 'Georgette', 'Crepe', 'Payet',
  'Lace', 'Sequin', 'Tweed', 'Flannel', 'Mix'
];

function CustomMaterialSelect({ value, onChange, availableMaterials }) {
  const [isOpen, setIsOpen] = useState(false);
  const [search, setSearch] = useState('');
  const containerRef = useRef(null);

  useEffect(() => {
    const handleClickOutside = (e) => {
      if (containerRef.current && !containerRef.current.contains(e.target)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const filtered = availableMaterials.filter((m) =>
    m.toLowerCase().includes(search.toLowerCase())
  );

  const selectedDisplay = value && value !== '-' ? value : 'Pilih Bahan...';

  return (
    <div className="relative" ref={containerRef}>
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className="w-full px-2.5 py-1.5 bg-[#f8f8f8] hover:bg-[#e0e0e0]/60 border border-[#e0e0e0] rounded-lg text-xs font-semibold text-[#313030] outline-none flex items-center justify-between gap-1 cursor-pointer transition-colors text-left"
      >
        <span className={`truncate ${!value || value === '-' ? 'text-slate-400 font-normal' : 'font-extrabold text-[#5f1340]'}`}>
          {selectedDisplay}
        </span>
        <div className="flex items-center gap-1 shrink-0 text-slate-400">
          {value && value !== '-' && (
            <span
              onClick={(e) => {
                e.stopPropagation();
                onChange('');
              }}
              className="p-0.5 hover:text-red-500 rounded-full hover:bg-slate-200 transition-colors"
            >
              <X className="h-3 w-3" />
            </span>
          )}
          <ChevronDown className={`h-3.5 w-3.5 transition-transform duration-200 ${isOpen ? 'rotate-180 text-[#5f1340]' : ''}`} />
        </div>
      </button>

      {isOpen && (
        <div className="absolute left-0 right-0 bottom-full mb-1 sm:top-full sm:bottom-auto sm:mt-1 z-50 bg-white border border-[#e0e0e0] rounded-xl shadow-xl overflow-hidden animate-fade-in text-xs">
          <div className="p-1.5 border-b border-slate-100 bg-slate-50 flex items-center gap-1.5">
            <Search className="h-3.5 w-3.5 text-slate-400 shrink-0 ml-1" />
            <input
              type="text"
              autoFocus
              placeholder="Cari bahan (e.g. Cotton...)"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full py-1 text-xs bg-transparent outline-none font-medium placeholder:text-slate-400"
            />
            {search && (
              <button
                type="button"
                onClick={() => setSearch('')}
                className="text-slate-400 hover:text-slate-600 mr-1"
              >
                <X className="h-3 w-3" />
              </button>
            )}
          </div>

          <div className="max-h-40 overflow-y-auto p-1 divide-y divide-slate-50">
            <button
              type="button"
              onClick={() => {
                onChange('');
                setIsOpen(false);
                setSearch('');
              }}
              className={`w-full text-left px-2.5 py-1.5 rounded-lg text-xs font-medium cursor-pointer transition-colors ${
                !value || value === '-' ? 'bg-[#5f1340]/10 text-[#5f1340] font-black' : 'text-slate-400 hover:bg-slate-100'
              }`}
            >
              -- Tidak Ada (Kosong) --
            </button>
            {filtered.map((mat) => (
              <button
                key={mat}
                type="button"
                onClick={() => {
                  onChange(mat);
                  setIsOpen(false);
                  setSearch('');
                }}
                className={`w-full text-left px-2.5 py-1.5 rounded-lg text-xs font-semibold cursor-pointer transition-colors flex items-center justify-between ${
                  value === mat
                    ? 'bg-[#5f1340] text-white font-black shadow-xs'
                    : 'text-slate-700 hover:bg-[#5f1340]/10 hover:text-[#5f1340]'
                }`}
              >
                <span>{mat}</span>
                {value === mat && <Check className="h-3.5 w-3.5 text-white" />}
              </button>
            ))}
            {filtered.length === 0 && (
              <div className="p-3 text-center text-slate-400 text-xs font-medium">
                Bahan "{search}" tidak ditemukan
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

/**
 * Modal rincian item layanan — dipakai di Pilih Layanan (tambah) & Keranjang (edit).
 */
export default function ItemConfigModal({
  configuringItem,
  setConfiguringItem,
  itemSpecs,
  setItemSpecs,
  handleAddToCart,
  isEditing = false,
  materialsList = []
}) {
  if (!configuringItem) return null;

  const isMeterService = configuringItem.unit_id === 4 || configuringItem.unit === 'm²' || configuringItem.unit === 'm2' || configuringItem.unit === 'Meter';

  // Merge backend materials list with MATERIAL_OPTIONS if provided
  const availableMaterials = Array.from(new Set([
    ...MATERIAL_OPTIONS,
    ...(Array.isArray(materialsList) ? materialsList.map(m => m.name || m) : [])
  ]));

  return (
    <div className="fixed inset-0 z-50 bg-[#313030]/65 backdrop-blur-xs flex justify-center items-center p-3 sm:p-4 overflow-y-auto">
      <div className="bg-white rounded-3xl border border-[#e0e0e0] w-full max-w-2xl sm:max-w-3xl shadow-2xl overflow-hidden animate-fade-in my-auto flex flex-col max-h-[90vh]">

        {/* Modal Header */}
        <div className="p-4 sm:p-5 border-b border-[#e0e0e0] flex justify-between items-start bg-[#f8f8f8]/60 shrink-0">
          <div className="flex items-start gap-3">
            <div className="w-10 h-10 rounded-2xl bg-[#5f1340]/10 text-[#5f1340] font-black flex items-center justify-center shrink-0">
              <ShoppingBag className="h-5 w-5" />
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap mb-0.5">
                <span className="text-[9px] font-black uppercase tracking-wider text-[#5f1340] bg-[#5f1340]/10 px-2 py-0.5 rounded-full">
                  {configuringItem.category}
                </span>
                <span className="text-xs text-slate-400 font-bold flex items-center gap-1">
                  <Clock className="h-3 w-3" /> {configuringItem.duration}
                </span>
                {isEditing && (
                  <span className="text-[9px] font-black uppercase tracking-wider text-amber-800 bg-amber-50 border border-amber-200 px-2 py-0.5 rounded-full">
                    Edit Item Keranjang
                  </span>
                )}
              </div>
              <h3 className="text-base font-black text-[#313030] leading-snug">{configuringItem.name}</h3>
              <span className="text-xs font-extrabold text-[#5f1340] block">
                Rp {configuringItem.price.toLocaleString('id-ID')} / {configuringItem.unit}
              </span>
            </div>
          </div>

          <button
            type="button"
            onClick={() => setConfiguringItem(null)}
            className="p-1.5 rounded-xl text-slate-400 hover:text-[#313030] hover:bg-slate-200/60 transition-colors cursor-pointer"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Form Body - Scrollable */}
        <form onSubmit={handleAddToCart} className="flex flex-col flex-1 overflow-hidden">
          <div className="p-4 sm:p-5 space-y-3.5 text-xs overflow-y-auto flex-1">

            {/* Input Qty / Berat / Dimensi Meter */}
            <div className="p-3.5 bg-[#f8f8f8] border border-[#e0e0e0] rounded-2xl">
              {configuringItem.category === 'Kiloan' ? (
                <div>
                  <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-1 mb-2">
                    <label className="text-[11px] font-black text-[#313030] uppercase tracking-wider">
                      Berat Timbangan Cucian (Kg) *
                    </label>
                    <span className="text-[10px] text-amber-700 bg-amber-50 border border-amber-200 px-2 py-0.5 rounded-full font-bold">
                      Minimal 4 Kg = Rp 36.000 (Bare Minimum)
                    </span>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-12 gap-2.5 items-center">
                    <div className="sm:col-span-6 flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => setItemSpecs((prev) => ({ ...prev, weight: Math.max(0.5, (parseFloat(prev.weight) || 4) - 0.5) }))}
                        className="w-10 h-10 bg-white border border-[#e0e0e0] hover:border-[#5f1340] rounded-xl flex items-center justify-center font-black text-base text-[#5f1340] hover:bg-[#5f1340]/10 active:scale-95 transition-all cursor-pointer shadow-2xs"
                      >
                        -
                      </button>
                      <div className="relative flex-1">
                        <input
                          type="number"
                          step="0.1"
                          required
                          value={itemSpecs.weight ?? ''}
                          onChange={(e) => {
                            const val = e.target.value;
                            setItemSpecs((prev) => ({ ...prev, weight: val }));
                          }}
                          className="w-full text-center py-2 bg-white border border-[#e0e0e0] rounded-xl text-base font-black text-[#313030] outline-none focus:border-[#5f1340] [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                        />
                        <span className="absolute right-2.5 top-1/2 -translate-y-1/2 text-xs font-bold text-slate-400 pointer-events-none">
                          Kg
                        </span>
                      </div>
                      <button
                        type="button"
                        onClick={() => setItemSpecs((prev) => ({ ...prev, weight: (parseFloat(prev.weight) || 4) + 0.5 }))}
                        className="w-10 h-10 bg-white border border-[#e0e0e0] hover:border-[#5f1340] rounded-xl flex items-center justify-center font-black text-base text-[#5f1340] hover:bg-[#5f1340]/10 active:scale-95 transition-all cursor-pointer shadow-2xs"
                      >
                        +
                      </button>
                    </div>

                    <div className="sm:col-span-6 flex items-center gap-1 overflow-x-auto no-scrollbar">
                      {[4, 5, 6, 8, 10].map((w) => (
                        <button
                          key={w}
                          type="button"
                          onClick={() => setItemSpecs((prev) => ({ ...prev, weight: w }))}
                          className={`flex-1 py-2 rounded-lg font-bold text-[11px] border transition-all cursor-pointer whitespace-nowrap ${
                            parseFloat(itemSpecs.weight) === w
                              ? 'bg-[#5f1340] text-white border-[#5f1340]'
                              : 'bg-white border-[#e0e0e0] text-slate-700 hover:bg-slate-100'
                          }`}
                        >
                          {w} Kg
                        </button>
                      ))}
                    </div>
                  </div>

                  {parseFloat(itemSpecs.weight) < 4 && (
                    <p className="text-[10px] text-amber-700 font-bold mt-1.5 bg-amber-100/50 p-1.5 rounded-lg border border-amber-200">
                      * Catatan: Timbangan di bawah 4 Kg tetap dikenakan tarif bare minimum Rp 36.000
                    </p>
                  )}
                </div>
              ) : isMeterService ? (
                <div className="space-y-2.5">
                  <div className="flex items-center justify-between">
                    <label className="text-[11px] font-black text-[#5f1340] uppercase tracking-wider">
                      Dimensi Ukuran & Kuantitas ({configuringItem.unit}) *
                    </label>
                    <span className="text-[10px] text-slate-500 font-bold">
                      Tarif: Rp {configuringItem.price.toLocaleString('id-ID')} / m²
                    </span>
                  </div>

                  <div className="grid grid-cols-3 gap-2.5">
                    <div>
                      <label className="text-[10px] font-extrabold text-slate-600 uppercase tracking-wider block mb-1">
                        Panjang (m) *
                      </label>
                      <input
                        type="number"
                        step="0.1"
                        min="0.1"
                        required
                        value={itemSpecs.length ?? ''}
                        onChange={(e) => {
                          const val = e.target.value;
                          setItemSpecs((prev) => ({ ...prev, length: val }));
                        }}
                        className="w-full px-3 py-1.5 bg-white border border-[#e0e0e0] rounded-xl text-xs font-black outline-none focus:border-[#5f1340] [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                        placeholder="3.5"
                      />
                    </div>

                    <div>
                      <label className="text-[10px] font-extrabold text-slate-600 uppercase tracking-wider block mb-1">
                        Lebar (m) *
                      </label>
                      <input
                        type="number"
                        step="0.1"
                        min="0.1"
                        required
                        value={itemSpecs.width ?? ''}
                        onChange={(e) => {
                          const val = e.target.value;
                          setItemSpecs((prev) => ({ ...prev, width: val }));
                        }}
                        className="w-full px-3 py-1.5 bg-white border border-[#e0e0e0] rounded-xl text-xs font-black outline-none focus:border-[#5f1340] [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                        placeholder="2.0"
                      />
                    </div>

                    <div>
                      <label className="text-[10px] font-extrabold text-slate-600 uppercase tracking-wider block mb-1">
                        Qty (Pcs) *
                      </label>
                      <input
                        type="number"
                        min="1"
                        required
                        value={itemSpecs.qty ?? ''}
                        onChange={(e) => {
                          const val = e.target.value;
                          setItemSpecs((prev) => ({ ...prev, qty: val }));
                        }}
                        className="w-full px-3 py-1.5 bg-white border border-[#e0e0e0] rounded-xl text-xs font-black outline-none focus:border-[#5f1340] [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                        placeholder="1"
                      />
                    </div>
                  </div>

                  <div className="p-2.5 bg-purple-50/80 border border-purple-200 rounded-xl flex items-center justify-between text-[11px]">
                    <span className="font-extrabold text-[#5f1340]">
                      Luas Per Item: {(parseFloat(itemSpecs.length) || 0)}m × {(parseFloat(itemSpecs.width) || 0)}m = {((parseFloat(itemSpecs.length) || 0) * (parseFloat(itemSpecs.width) || 0)).toFixed(2)} m²
                    </span>
                    <span className="font-black text-[#5f1340]">
                      Total: {(((parseFloat(itemSpecs.length) || 0) * (parseFloat(itemSpecs.width) || 0)) * (parseInt(itemSpecs.qty, 10) || 0)).toFixed(2)} m²
                    </span>
                  </div>
                </div>
              ) : (
                <div>
                  <div className="flex justify-between items-center mb-2">
                    <label className="text-[11px] font-black text-[#313030] uppercase tracking-wider">
                      Jumlah Kuantitas ({configuringItem.unit}) *
                    </label>
                    <span className="text-[10px] text-slate-400 font-bold">
                      Tarif: Rp {configuringItem.price.toLocaleString('id-ID')} / {configuringItem.unit}
                    </span>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-12 gap-2.5 items-center">
                    <div className="sm:col-span-6 flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => setItemSpecs((prev) => ({ ...prev, qty: Math.max(1, (parseInt(prev.qty, 10) || 1) - 1) }))}
                        className="w-10 h-10 bg-white border border-[#e0e0e0] hover:border-[#5f1340] rounded-xl flex items-center justify-center font-black text-base text-[#5f1340] hover:bg-[#5f1340]/10 active:scale-95 transition-all cursor-pointer shadow-2xs"
                      >
                        -
                      </button>
                      <div className="relative flex-1">
                        <input
                          type="number"
                          min="1"
                          required
                          value={itemSpecs.qty ?? ''}
                          onChange={(e) => {
                            const val = e.target.value;
                            setItemSpecs((prev) => ({ ...prev, qty: val }));
                          }}
                          className="w-full text-center py-2 bg-white border border-[#e0e0e0] rounded-xl text-base font-black text-[#313030] outline-none focus:border-[#5f1340] [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                        />
                        <span className="absolute right-2.5 top-1/2 -translate-y-1/2 text-xs font-bold text-slate-400 pointer-events-none">
                          {configuringItem.unit}
                        </span>
                      </div>
                      <button
                        type="button"
                        onClick={() => setItemSpecs((prev) => ({ ...prev, qty: (parseInt(prev.qty, 10) || 1) + 1 }))}
                        className="w-10 h-10 bg-white border border-[#e0e0e0] hover:border-[#5f1340] rounded-xl flex items-center justify-center font-black text-base text-[#5f1340] hover:bg-[#5f1340]/10 active:scale-95 transition-all cursor-pointer shadow-2xs"
                      >
                        +
                      </button>
                    </div>

                    <div className="sm:col-span-6 flex items-center gap-1 overflow-x-auto no-scrollbar">
                      {[1, 2, 3, 5, 10].map((q) => (
                        <button
                          key={q}
                          type="button"
                          onClick={() => setItemSpecs((prev) => ({ ...prev, qty: q }))}
                          className={`flex-1 py-2 rounded-lg font-bold text-[11px] border transition-all cursor-pointer whitespace-nowrap ${
                            parseInt(itemSpecs.qty, 10) === q
                              ? 'bg-[#5f1340] text-white border-[#5f1340]'
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

            {/* Rincian Spesifikasi (Brand, Warna, Material, Size) */}
            <div>
              <h4 className="text-[10.5px] font-black uppercase tracking-wider text-[#5f1340] mb-1.5 flex items-center gap-1">
                <Edit3 className="h-3 w-3" />
                <span>Rincian Spesifikasi (Opsional)</span>
              </h4>

              <div className={`grid grid-cols-2 ${isMeterService ? 'sm:grid-cols-3' : 'sm:grid-cols-4'} gap-2`}>
                <div>
                  <label className="text-[9.5px] font-bold text-slate-400 uppercase block mb-0.5">Merk / Brand</label>
                  <input
                    type="text"
                    placeholder="Uniqlo, Zara..."
                    value={itemSpecs.brand}
                    onChange={(e) => setItemSpecs({ ...itemSpecs, brand: e.target.value })}
                    className="w-full px-2.5 py-1.5 bg-[#f8f8f8] border border-[#e0e0e0] rounded-lg text-xs font-medium outline-none focus:bg-white focus:border-[#5f1340]"
                  />
                </div>
                <div>
                  <label className="text-[9.5px] font-bold text-slate-400 uppercase block mb-0.5">Warna</label>
                  <input
                    type="text"
                    placeholder="Putih, Navy..."
                    value={itemSpecs.color}
                    onChange={(e) => setItemSpecs({ ...itemSpecs, color: e.target.value })}
                    className="w-full px-2.5 py-1.5 bg-[#f8f8f8] border border-[#e0e0e0] rounded-lg text-xs font-medium outline-none focus:bg-white focus:border-[#5f1340]"
                  />
                </div>
                <div>
                  <label className="text-[9.5px] font-bold text-slate-400 uppercase block mb-0.5">Bahan / Material</label>
                  <CustomMaterialSelect
                    value={itemSpecs.material}
                    onChange={(val) => setItemSpecs({ ...itemSpecs, material: val })}
                    availableMaterials={availableMaterials}
                  />
                </div>
                {!isMeterService && (
                  <div>
                    <label className="text-[9.5px] font-bold text-slate-400 uppercase block mb-0.5">Ukuran / Size</label>
                    <input
                      type="text"
                      placeholder="L, XL..."
                      value={itemSpecs.size}
                      onChange={(e) => setItemSpecs({ ...itemSpecs, size: e.target.value })}
                      className="w-full px-2.5 py-1.5 bg-[#f8f8f8] border border-[#e0e0e0] rounded-lg text-xs font-medium outline-none focus:bg-white focus:border-[#5f1340]"
                    />
                  </div>
                )}
              </div>
            </div>

            {/* Combined Full-Card Clickable Toggles (Cleanox & Dry Clean) */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
              {/* Cleanox Card Toggle */}
              <button
                type="button"
                onClick={() => setItemSpecs((prev) => ({ ...prev, isCleanox: !prev.isCleanox }))}
                className={`p-3 rounded-2xl border transition-all text-left flex items-center justify-between gap-3 cursor-pointer select-none active:scale-[0.99] ${
                  itemSpecs.isCleanox
                    ? 'bg-sky-600 border-sky-600 text-white shadow-md ring-2 ring-sky-300/50'
                    : 'bg-white border-[#e0e0e0] text-slate-700 hover:border-sky-300 hover:bg-sky-50/40'
                }`}
              >
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-1.5 mb-0.5">
                    <span className="font-extrabold text-xs block">Cleanox By Waschen</span>
                    <span className={`text-[9px] font-black px-1.5 py-0.5 rounded-full ${
                      itemSpecs.isCleanox
                        ? 'bg-white text-sky-700'
                        : 'bg-slate-100 text-slate-400 border border-slate-200'
                    }`}>
                      {itemSpecs.isCleanox ? 'ON ✓' : 'OFF'}
                    </span>
                  </div>
                  <span className={`text-[10px] block truncate ${itemSpecs.isCleanox ? 'text-sky-100' : 'text-slate-400'}`}>
                    Dikerjakan khusus tim Cleanox
                  </span>
                </div>

                {/* Big iOS Toggle Switch */}
                <div className={`w-11 h-6 rounded-full relative p-0.5 transition-colors shrink-0 ${
                  itemSpecs.isCleanox ? 'bg-white/30' : 'bg-slate-300'
                }`}>
                  <div className={`w-5 h-5 rounded-full bg-white shadow-md transition-transform duration-200 ${
                    itemSpecs.isCleanox ? 'translate-x-5' : 'translate-x-0'
                  }`} />
                </div>
              </button>

              {/* Dry Clean (DC) Card Toggle */}
              <button
                type="button"
                onClick={() => setItemSpecs((prev) => ({ ...prev, isDryClean: !prev.isDryClean }))}
                className={`p-3 rounded-2xl border transition-all text-left flex items-center justify-between gap-3 cursor-pointer select-none active:scale-[0.99] ${
                  itemSpecs.isDryClean
                    ? 'bg-amber-600 border-amber-600 text-white shadow-md ring-2 ring-amber-300/50'
                    : 'bg-white border-[#e0e0e0] text-slate-700 hover:border-amber-300 hover:bg-amber-50/40'
                }`}
              >
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-1.5 mb-0.5">
                    <span className="font-extrabold text-xs block">Metode Dry Clean (DC)</span>
                    <span className={`text-[9px] font-black px-1.5 py-0.5 rounded-full ${
                      itemSpecs.isDryClean
                        ? 'bg-white text-amber-800'
                        : 'bg-slate-100 text-slate-400 border border-slate-200'
                    }`}>
                      {itemSpecs.isDryClean ? 'DC ON ✓' : 'OFF'}
                    </span>
                  </div>
                  <span className={`text-[10px] block truncate ${itemSpecs.isDryClean ? 'text-amber-100' : 'text-slate-400'}`}>
                    Pencucian khusus metode Dry Clean
                  </span>
                </div>

                {/* Big iOS Toggle Switch */}
                <div className={`w-11 h-6 rounded-full relative p-0.5 transition-colors shrink-0 ${
                  itemSpecs.isDryClean ? 'bg-white/30' : 'bg-slate-300'
                }`}>
                  <div className={`w-5 h-5 rounded-full bg-white shadow-md transition-transform duration-200 ${
                    itemSpecs.isDryClean ? 'translate-x-5' : 'translate-x-0'
                  }`} />
                </div>
              </button>
            </div>

            {/* Notes Input */}
            <div>
              <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block mb-1">
                Keterangan / Kondisi Fisik Item (Opsional)
              </label>
              <textarea
                rows="1"
                placeholder="Misal: ada noda di lengan, kancing lepas..."
                value={itemSpecs.note}
                onChange={(e) => setItemSpecs({ ...itemSpecs, note: e.target.value })}
                className="w-full p-2 bg-[#f8f8f8] border border-[#e0e0e0] rounded-xl text-xs font-medium outline-none focus:bg-white focus:border-[#5f1340]"
              />
            </div>
          </div>

          {/* Modal Footer - Fixed at bottom */}
          <div className="p-3.5 sm:p-4 border-t border-[#e0e0e0] bg-[#f8f8f8]/80 flex items-center justify-between gap-3 shrink-0">
            <div>
              <span className="text-[9.5px] font-bold text-slate-400 uppercase tracking-wider block">Subtotal Item:</span>
              <span className="text-base sm:text-lg font-black text-[#5f1340]">
                Rp {(
                  configuringItem.category === 'Kiloan'
                    ? (parseFloat(itemSpecs.weight || 0) < 4 ? 36000 : (parseFloat(itemSpecs.weight || 0)) * configuringItem.price)
                    : isMeterService
                      ? (((parseFloat(itemSpecs.length || 0)) * (parseFloat(itemSpecs.width || 0)) * (parseInt(itemSpecs.qty || 0, 10))) * configuringItem.price)
                      : ((parseInt(itemSpecs.qty || 0, 10)) * configuringItem.price)
                ).toLocaleString('id-ID')}
              </span>
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setConfiguringItem(null)}
                className="px-4 py-2.5 bg-white border border-[#e0e0e0] hover:bg-slate-100 text-slate-700 font-bold text-xs rounded-xl transition-all cursor-pointer"
              >
                Batal
              </button>

              <button
                type="submit"
                className="px-5 py-2.5 bg-gradient-to-r from-[#5f1340] to-[#7d1956] hover:from-[#4d0f33] hover:to-[#6a1549] text-white font-black text-xs rounded-xl shadow-xs active:scale-98 transition-all cursor-pointer flex items-center gap-1.5"
              >
                {isEditing ? <Save className="h-3.5 w-3.5" /> : <Plus className="h-3.5 w-3.5" />}
                <span>{isEditing ? 'Simpan' : 'Masukkan Keranjang'}</span>
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
}
