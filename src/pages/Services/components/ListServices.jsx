import React, { useMemo } from 'react';
import { Search, ChevronLeft, ChevronRight } from 'lucide-react';

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
        {service.desc && <p className="text-xs text-slate-500 mt-1.5 leading-relaxed font-medium">{service.desc}</p>}
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

/** Nomor halaman ringkas: 1 … 4 5 6 … 12 */
function pageNumbers(current, total) {
  const set = new Set([1, total, current - 1, current, current + 1]);
  const nums = [...set].filter((n) => n >= 1 && n <= total).sort((a, b) => a - b);
  const out = [];
  nums.forEach((n, i) => {
    if (i > 0 && n - nums[i - 1] > 1) out.push(`gap-${n}`);
    out.push(n);
  });
  return out;
}

export default function ListServices({
  servicesList,
  categories,
  meta,
  loading,
  searchQuery,
  onSearchChange,
  categoryCode,
  onCategoryChange,
  page,
  pageSize,
  onPageChange
}) {
  const activeCategories = useMemo(
    () => (categories || []).filter(c => c.is_active === 1 || c.is_active === true),
    [categories]
  );
  const counts = meta?.counts || {};
  const total = meta?.total || 0;
  const totalPages = meta?.totalPages || 1;
  const start = total === 0 ? 0 : (page - 1) * pageSize + 1;
  const end = Math.min(page * pageSize, total);

  const chip = (active) => `px-4 py-2 rounded-xl text-xs font-black transition-all cursor-pointer whitespace-nowrap flex items-center gap-1.5 ${
    active ? 'bg-[#5f1340] text-white shadow-xs' : 'bg-[#f8f8f8] text-slate-600 hover:bg-[#e0e0e0] border border-[#e0e0e0]'
  }`;
  const chipCount = (active) => `px-1.5 py-0.5 rounded-full text-[9px] font-black ${
    active ? 'bg-white/20 text-white' : 'bg-slate-200 text-slate-600'
  }`;

  return (
    <div className="flex flex-col gap-4 sm:gap-6">
      <div className="bg-white border border-[#e0e0e0] rounded-2xl p-4 shadow-xs flex flex-col gap-4">
        <div className="relative w-full">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
          <input
            type="text"
            placeholder="Contoh : Kemeja / Bedcover"
            value={searchQuery}
            onChange={(e) => onSearchChange(e.target.value)}
            className="w-full pl-10 pr-4 py-2.5 border border-[#e0e0e0] rounded-xl text-xs font-bold outline-none focus:border-[#5f1340]"
          />
        </div>

        <div className="flex items-center gap-2 overflow-x-auto no-scrollbar pb-0.5">
          <button type="button" onClick={() => onCategoryChange('Semua')} className={chip(categoryCode === 'Semua')}>
            Semua Layanan
            <span className={chipCount(categoryCode === 'Semua')}>{meta?.countAll ?? 0}</span>
          </button>
          {activeCategories.map(cat => (
            <button
              key={cat.id}
              type="button"
              onClick={() => onCategoryChange(cat.code)}
              className={chip(categoryCode === cat.code)}
              title={cat.description || cat.name}
            >
              {cat.name}
              <span className={chipCount(categoryCode === cat.code)}>{counts[cat.code] || 0}</span>
            </button>
          ))}
        </div>
      </div>

      {loading && servicesList.length === 0 ? (
        <div className="bg-white border border-[#e0e0e0] rounded-3xl p-12 text-center text-slate-400 text-xs font-bold">
          Memuat layanan...
        </div>
      ) : servicesList.length === 0 ? (
        <div className="bg-white border border-[#e0e0e0] rounded-3xl p-12 text-center text-slate-400">
          <p className="font-bold text-sm text-[#313030]">Tidak ada layanan yang sesuai filter</p>
        </div>
      ) : (
        <div className={`grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-5 transition-opacity ${loading ? 'opacity-50' : ''}`}>
          {servicesList.map(s => (
            <ServiceCard key={s.id} service={s} />
          ))}
        </div>
      )}

      {total > 0 && (
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 bg-white border border-[#e0e0e0] rounded-2xl px-4 py-3">
          <span className="text-[11px] font-bold text-slate-500">
            {start}–{end} dari {total.toLocaleString('id-ID')} layanan
          </span>
          {totalPages > 1 && (
            <div className="flex items-center gap-1.5 flex-wrap">
              <button
                type="button"
                disabled={page <= 1 || loading}
                onClick={() => onPageChange(page - 1)}
                aria-label="Halaman sebelumnya"
                className="h-8 w-8 rounded-lg bg-[#5f1340]/10 text-[#5f1340] hover:bg-[#5f1340]/20 grid place-items-center cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
              >
                <ChevronLeft className="h-4 w-4" />
              </button>
              {pageNumbers(page, totalPages).map((n) => (typeof n === 'string' ? (
                <span key={n} className="px-1 text-slate-400 text-xs">…</span>
              ) : (
                <button
                  key={n}
                  type="button"
                  disabled={loading}
                  onClick={() => onPageChange(n)}
                  className={`h-8 min-w-8 px-2 rounded-lg text-xs font-black cursor-pointer ${
                    n === page ? 'bg-[#5f1340] text-white' : 'bg-[#f8f8f8] text-slate-600 hover:bg-[#e0e0e0] border border-[#e0e0e0]'
                  }`}
                >
                  {n}
                </button>
              )))}
              <button
                type="button"
                disabled={page >= totalPages || loading}
                onClick={() => onPageChange(page + 1)}
                aria-label="Halaman berikutnya"
                className="h-8 w-8 rounded-lg bg-[#5f1340]/10 text-[#5f1340] hover:bg-[#5f1340]/20 grid place-items-center cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
              >
                <ChevronRight className="h-4 w-4" />
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
