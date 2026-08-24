import React, { useMemo, useState } from 'react';
import { Search } from 'lucide-react';

const getCategoryBadge = (code) => {
  if (code === 'KILOAN') return 'bg-[#5f1340]/10 text-[#5f1340]';
  if (code === 'SATUAN') return 'bg-amber-100 text-amber-800';
  return 'bg-slate-100 text-slate-700';
};

function ServiceCard({ service }) {
  return (
    <div className="p-5 border border-[#e0e0e0] hover:border-[#5f1340]/40 rounded-3xl bg-white shadow-xs hover:shadow-md transition-all flex flex-col justify-between gap-4 group">
      <div>
        <div className="flex justify-between items-center mb-3">
          <span className={`text-[10px] font-black px-2.5 py-0.5 rounded-full ${getCategoryBadge(service.categoryCode)}`}>
            {service.categoryName}
          </span>
          <span className="text-[10px] font-bold text-slate-400">
            {service.estTime}
          </span>
        </div>
        <h3 className="font-black text-[#313030] text-base group-hover:text-[#5f1340] transition-colors">{service.name}</h3>
        <p className="text-xs text-slate-500 mt-1.5 leading-relaxed font-medium">{service.desc}</p>
        {service.isFeatured && (
          <span className="inline-block mt-2 text-[9px] font-black text-amber-700 bg-amber-50 border border-amber-200 px-2 py-0.5 rounded-full">
            Layanan Unggulan
          </span>
        )}
      </div>
      <div className="pt-3 border-t border-[#e0e0e0]">
        <span className="text-[9px] text-slate-400 font-bold uppercase tracking-wider block">Harga</span>
        <span className="text-lg font-black text-[#5f1340]">
          Rp {service.price.toLocaleString('id-ID')} <span className="text-xs font-bold text-slate-500">/ {service.unit}</span>
        </span>
      </div>
    </div>
  );
}

export default function ListServices({ servicesList, categories }) {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategoryCode, setSelectedCategoryCode] = useState('Semua');

  const activeCategories = useMemo(
    () => (categories || []).filter(c => c.is_active === 1 || c.is_active === true),
    [categories]
  );

  const countByCode = useMemo(() => {
    const counts = {};
    servicesList.forEach(s => {
      const key = s.categoryCode || 'UNKNOWN';
      counts[key] = (counts[key] || 0) + 1;
    });
    return counts;
  }, [servicesList]);

  const filteredServices = servicesList.filter(s => {
    const q = searchQuery.toLowerCase();
    const matchesSearch = !q ||
      s.name.toLowerCase().includes(q) ||
      s.desc.toLowerCase().includes(q) ||
      (s.categoryName && s.categoryName.toLowerCase().includes(q)) ||
      (s.categoryCode && s.categoryCode.toLowerCase().includes(q));
    const matchesCategory = selectedCategoryCode === 'Semua' || s.categoryCode === selectedCategoryCode;
    return matchesSearch && matchesCategory;
  });

  return (
    <div className="flex flex-col gap-6">
      <div className="bg-white border border-[#e0e0e0] rounded-2xl p-4 shadow-xs flex flex-col gap-4">
        <div className="relative w-full">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
          <input
            type="text"
            placeholder="Cari nama layanan..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-10 pr-4 py-2.5 border border-[#e0e0e0] rounded-xl text-xs font-bold outline-none focus:border-[#5f1340]"
          />
        </div>

        <div className="flex items-center gap-2 overflow-x-auto no-scrollbar pb-0.5">
          <button
            type="button"
            onClick={() => setSelectedCategoryCode('Semua')}
            className={`px-4 py-2 rounded-xl text-xs font-black transition-all cursor-pointer whitespace-nowrap flex items-center gap-1.5 ${
              selectedCategoryCode === 'Semua'
                ? 'bg-[#5f1340] text-white shadow-xs'
                : 'bg-[#f8f8f8] text-slate-600 hover:bg-[#e0e0e0] border border-[#e0e0e0]'
            }`}
          >
            Semua Layanan
            <span className={`px-1.5 py-0.5 rounded-full text-[9px] font-black ${
              selectedCategoryCode === 'Semua' ? 'bg-white/20 text-white' : 'bg-slate-200 text-slate-600'
            }`}>
              {servicesList.length}
            </span>
          </button>

          {activeCategories.map(cat => {
            const count = countByCode[cat.code] || 0;
            return (
              <button
                key={cat.id}
                type="button"
                onClick={() => setSelectedCategoryCode(cat.code)}
                className={`px-4 py-2 rounded-xl text-xs font-black transition-all cursor-pointer whitespace-nowrap flex items-center gap-1.5 ${
                  selectedCategoryCode === cat.code
                    ? 'bg-[#5f1340] text-white shadow-xs'
                    : 'bg-[#f8f8f8] text-slate-600 hover:bg-[#e0e0e0] border border-[#e0e0e0]'
                }`}
                title={cat.description || cat.name}
              >
                {cat.name}
                <span className={`px-1.5 py-0.5 rounded-full text-[9px] font-black ${
                  selectedCategoryCode === cat.code ? 'bg-white/20 text-white' : 'bg-slate-200 text-slate-600'
                }`}>
                  {count}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {filteredServices.length === 0 ? (
        <div className="bg-white border border-[#e0e0e0] rounded-3xl p-12 text-center text-slate-400">
          <p className="font-bold text-sm text-[#313030]">Tidak ada layanan yang sesuai filter</p>
          <p className="text-xs mt-1">Coba ubah kata kunci pencarian atau kategori</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {filteredServices.map(s => (
            <ServiceCard key={s.id} service={s} />
          ))}
        </div>
      )}
    </div>
  );
}
