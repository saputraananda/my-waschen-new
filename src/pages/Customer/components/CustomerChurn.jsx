import React, { useMemo, useState } from 'react';
import { Search, TrendingDown } from 'lucide-react';

const CHURN_TABS = ['Semua', 'Active', 'Warning', 'Churn', 'Dormant', 'Lost'];

const CHURN_THRESHOLDS = [
  { max: 20, status: 'Active' },
  { max: 45, status: 'Warning' },
  { max: 60, status: 'Churn' },
  { max: 90, status: 'Dormant' }
];

function resolveChurnStatus(lastOrderDate) {
  if (!lastOrderDate) return { lastOrderDate: null, daysSinceLast: null, churnStatus: 'Lost' };

  const last = lastOrderDate instanceof Date ? lastOrderDate : new Date(lastOrderDate);
  if (Number.isNaN(last.getTime())) {
    return { lastOrderDate: null, daysSinceLast: null, churnStatus: 'Lost' };
  }

  const daysSinceLast = Math.max(0, Math.floor((Date.now() - last.getTime()) / 86400000));
  const match = CHURN_THRESHOLDS.find((t) => daysSinceLast <= t.max);
  return { lastOrderDate: last, daysSinceLast, churnStatus: match ? match.status : 'Lost' };
}

function withChurnStatus(customers) {
  return (customers || []).map((c) => ({ ...c, ...resolveChurnStatus(c.lastOrderDate) }));
}

function computeChurnCounts(customersWithChurn) {
  const counts = { Semua: customersWithChurn.length };
  for (const tab of CHURN_TABS) {
    if (tab === 'Semua') continue;
    counts[tab] = customersWithChurn.filter((c) => c.churnStatus === tab).length;
  }
  return counts;
}

const BADGE_TONE = {
  Active: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  Warning: 'bg-amber-50 text-amber-700 border-amber-200',
  Churn: 'bg-rose-50 text-rose-700 border-rose-200',
  Dormant: 'bg-purple-50 text-purple-700 border-purple-200',
  Lost: 'bg-slate-100 text-slate-600 border-slate-200'
};

function renderChurnBadge(status, days) {
  const daysText = days !== null && days !== undefined ? `${days} hari lalu` : 'Belum Transaksi';
  const tone = BADGE_TONE[status] || BADGE_TONE.Lost;
  return (
    <span className={`${tone} border text-[9px] font-black px-2 py-0.5 rounded-lg shadow-2xs whitespace-nowrap`}>
      {status} &bull; {daysText}
    </span>
  );
}

const waLink = (cust) => {
  let rawPhone = (cust.phone || '').replace(/[^0-9]/g, '');
  if (rawPhone.startsWith('0')) rawPhone = '62' + rawPhone.slice(1);
  if (!rawPhone) return null;
  const message = encodeURIComponent(
    `Halo Kak ${cust.name || 'Pelanggan'}, salam hangat dari Waschen Laundry! Ada promo & diskon khusus retensi Kakak hari ini. Hubungi kami untuk jadwal antar/jemput cucian ya 😊`
  );
  return `https://api.whatsapp.com/send?phone=${rawPhone}&text=${message}`;
};

const WhatsAppIcon = (props) => (
  <svg viewBox="0 0 24 24" className={props.className} fill="currentColor">
    <path d="M.057 24l1.687-6.163c-1.041-1.804-1.588-3.849-1.587-5.946.003-6.556 5.338-11.891 11.893-11.891 3.181.001 6.167 1.24 8.413 3.488 2.245 2.248 3.481 5.236 3.48 8.414-.003 6.557-5.338 11.892-11.893 11.892-1.99-.001-3.951-.5-5.688-1.448l-6.305 1.654zm6.597-3.807c1.676.995 3.276 1.591 5.392 1.592 5.448 0 9.886-4.434 9.889-9.885.002-5.462-4.415-9.89-9.881-9.892-5.452 0-9.887 4.434-9.889 9.884-.001 2.225.651 3.891 1.746 5.634l-.999 3.648 3.742-.981zm11.387-5.464c-.074-.124-.272-.198-.57-.347-.297-.149-1.758-.868-2.031-.967-.272-.099-.47-.149-.669.149-.198.297-.768.967-.941 1.165-.173.198-.347.223-.644.074-.297-.149-1.255-.462-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.297-.347.446-.521.151-.172.2-.296.3-.495.099-.198.05-.372-.025-.521-.075-.148-.669-1.611-.916-2.206-.242-.579-.487-.501-.669-.51l-.57-.01c-.198 0-.52.074-.792.372s-1.04 1.016-1.04 2.479 1.065 2.876 1.213 3.074c.149.198 2.095 3.2 5.076 4.487.709.306 1.263.489 1.694.626.712.226 1.36.194 1.872.118.571-.085 1.758-.719 2.006-1.413.248-.695.248-1.29.173-1.414z" />
  </svg>
);

export default function CustomerChurn({ customers = [], activeOutletName, onEditCustomer }) {
  const [churnFilter, setChurnFilter] = useState('Semua');
  const [searchQuery, setSearchQuery] = useState('');

  const customersWithChurn = useMemo(() => withChurnStatus(customers), [customers]);
  const churnCounts = useMemo(() => computeChurnCounts(customersWithChurn), [customersWithChurn]);

  const visible = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return customersWithChurn
      .filter((c) => churnFilter === 'Semua' || c.churnStatus === churnFilter)
      .filter((c) => !q || (c.name || '').toLowerCase().includes(q) || (c.phone || '').includes(q))
      // Paling lama tidak transaksi tampil dulu — itu yang paling perlu ditindak.
      .sort((a, b) => (b.daysSinceLast ?? Infinity) - (a.daysSinceLast ?? Infinity));
  }, [customersWithChurn, churnFilter, searchQuery]);

  return (
    <div className="flex flex-col gap-4 sm:gap-6">
      <div className="bg-white border border-[#e0e0e0] rounded-2xl sm:rounded-3xl p-4 sm:p-5 shadow-xs flex flex-col gap-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-2xl bg-[#5f1340]/5 text-[#5f1340] border border-[#5f1340]/10 flex items-center justify-center shrink-0">
              <TrendingDown className="h-5 w-5" />
            </div>
            <div>
              <h2 className="text-sm sm:text-base font-black text-[#313030] tracking-tight">Analisis Customer Churn</h2>
              <p className="text-[10px] sm:text-[11px] text-slate-400 font-bold uppercase tracking-wider mt-0.5">
                Retensi &amp; aktivitas pelanggan {activeOutletName || ''}
              </p>
            </div>
          </div>

          <div className="relative w-full sm:w-72">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-400" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Cari nama / nomor telepon"
              className="w-full pl-9 pr-8 py-2.5 bg-[#f8f8f8] border border-[#e0e0e0] rounded-2xl text-xs font-bold text-[#313030] placeholder:text-slate-400 placeholder:font-normal focus:outline-none focus:border-[#5f1340]/40"
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery('')}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-[#313030] text-sm font-bold leading-none cursor-pointer"
              >
                &times;
              </button>
            )}
          </div>
        </div>

        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 scrollbar-none border-t border-[#e0e0e0] pt-4">
          {CHURN_TABS.map((cat) => {
            const active = churnFilter === cat;
            return (
              <button
                key={cat}
                type="button"
                onClick={() => setChurnFilter(cat)}
                className={`shrink-0 px-3 py-1.5 rounded-xl text-[11px] font-black transition-all cursor-pointer whitespace-nowrap flex items-center gap-1.5 ${
                  active
                    ? 'bg-[#5f1340] text-white shadow-xs'
                    : 'bg-[#f8f8f8] border border-[#e0e0e0] text-slate-600 hover:text-[#313030]'
                }`}
              >
                <span>{cat}</span>
                <span className={`px-1.5 rounded-full text-[10px] ${active ? 'bg-white/20 text-white' : 'bg-slate-200 text-slate-700'}`}>
                  {churnCounts[cat] ?? 0}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {visible.length > 0 ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3 sm:gap-4">
          {visible.map((cust) => {
            const link = waLink(cust);
            return (
              <div
                key={cust.id}
                className="bg-white border border-[#e0e0e0] rounded-2xl p-4 shadow-xs flex flex-col gap-3 hover:border-[#5f1340]/30 transition-colors"
              >
                <div className="flex items-start gap-3 min-w-0">
                  <div className="w-10 h-10 rounded-2xl bg-[#5f1340]/5 text-[#5f1340] border border-[#5f1340]/10 flex items-center justify-center font-black text-xs shrink-0">
                    {cust.name ? cust.name.substring(0, 2).toUpperCase() : 'CU'}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <span className="font-black text-sm text-[#313030] truncate leading-tight">{cust.name}</span>
                      {cust.tier === 'VIP' && (
                        <span className="text-[8px] bg-amber-50 text-amber-700 px-1.5 py-0.5 rounded font-black border border-amber-200">VIP</span>
                      )}
                    </div>
                    <p className="text-[11px] font-mono font-bold text-slate-500 mt-0.5 truncate">{cust.phone || '-'}</p>
                  </div>
                </div>

                <div>{renderChurnBadge(cust.churnStatus, cust.daysSinceLast)}</div>

                <div className="flex items-center justify-between gap-2 text-[10px] font-bold text-slate-400 border-t border-slate-100 pt-3 mt-auto">
                  <span>{cust.trxCount ?? 0}x transaksi</span>
                  <span>Terakhir: {cust.lastTrx || '-'}</span>
                </div>

                <div className="flex items-center gap-2">
                  {link && (
                    <a
                      href={link}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex-1 py-2 rounded-xl bg-emerald-50 hover:bg-emerald-600 text-emerald-700 hover:text-white border border-emerald-200 text-[11px] font-black inline-flex items-center justify-center gap-1.5 transition-all cursor-pointer"
                    >
                      <WhatsAppIcon className="w-3.5 h-3.5" />
                      Hubungi
                    </a>
                  )}
                  {onEditCustomer && (
                    <button
                      type="button"
                      onClick={() => onEditCustomer(cust)}
                      className="px-3 py-2 rounded-xl border border-[#e0e0e0] bg-white hover:bg-[#5f1340] hover:text-white text-slate-600 text-[11px] font-black transition-all cursor-pointer"
                    >
                      Detail
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        <div className="bg-white border border-dashed border-[#e0e0e0] rounded-2xl sm:rounded-3xl py-16 text-center">
          <p className="text-sm font-black text-slate-500">Tidak ada customer</p>
          <p className="text-xs text-slate-400 mt-1">
            {searchQuery ? `Pencarian "${searchQuery}" tidak cocok` : `Kategori "${churnFilter}" masih kosong`}
          </p>
        </div>
      )}
    </div>
  );
}
