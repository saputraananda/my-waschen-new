import React from 'react';
import { Plus } from 'lucide-react';

export default function CustomerChurn({
  navigate,
  churnFilter,
  setChurnFilter,
  churnCounts,
  filteredChurnCustomers,
  renderChurnBadge
}) {
  const handleOpenWA = (cust) => {
    let rawPhone = (cust.phone || '').replace(/[^0-9]/g, '');
    if (rawPhone.startsWith('0')) {
      rawPhone = '62' + rawPhone.slice(1);
    }
    if (!rawPhone) rawPhone = '628123456789';
    const message = encodeURIComponent(`Halo Kak ${cust.name || 'Pelanggan'}, salam hangat dari Waschen Laundry! Ada promo & diskon khusus retensi Kakak hari ini. Hubungi kami untuk jadwal antar/jemput cucian ya 😊`);
    window.open(`https://wa.me/${rawPhone}?text=${message}`, '_blank');
  };

  return (
    <div className="bg-white border border-[#e0e0e0]/70 rounded-3xl p-5 shadow-xs flex flex-col gap-3">
      <div className="flex justify-between items-center pb-3 border-b border-[#e0e0e0]">
        <div>
          <h4 className="text-sm font-extrabold text-[#313030] tracking-tight">Analisis Customer Churn</h4>
          <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider mt-0.5">Retensi & Aktivitas Pelanggan</p>
        </div>
        <button
          type="button"
          onClick={() => navigate('/customer')}
          className="p-1.5 text-[#5f1340] hover:bg-[#5f1340]/5 rounded-xl transition-all cursor-pointer"
          title="Kelola Customer"
        >
          <Plus className="h-4.5 w-4.5" />
        </button>
      </div>

      {/* Churn Category Filter Pills */}
      <div className="flex items-center gap-1 overflow-x-auto pb-1 scrollbar-none">
        {['Semua', 'Active', 'Warning', 'Churn', 'Dormant', 'Lost'].map(cat => {
          const active = churnFilter === cat;
          return (
            <button
              key={cat}
              type="button"
              onClick={() => setChurnFilter(cat)}
              className={`px-2.5 py-1 rounded-xl text-[9px] font-black transition-all cursor-pointer whitespace-nowrap flex items-center gap-1 ${
                active
                  ? 'bg-[#5f1340] text-white shadow-xs'
                  : 'bg-[#f8f8f8] border border-[#e0e0e0] text-slate-600 hover:text-[#313030]'
              }`}
            >
              <span>{cat}</span>
              <span className={`px-1 py-0.2 rounded-full text-[8px] ${active ? 'bg-white/20 text-white' : 'bg-slate-200 text-slate-700'}`}>
                {churnCounts[cat]}
              </span>
            </button>
          );
        })}
      </div>

      {/* Customer List with Churn Status Badge & WhatsApp Action */}
      <div className="flex flex-col gap-2.5 mt-1">
        {filteredChurnCustomers.length > 0 ? (
          filteredChurnCustomers.map(cust => (
            <div key={cust.id} className="flex items-center justify-between text-xs pb-2 border-b border-slate-100 last:border-b-0 last:pb-0 gap-2">
              <div className="flex items-center gap-2.5 min-w-0">
                <div className="w-8 h-8 rounded-xl bg-[#5f1340]/5 text-[#5f1340] border border-[#5f1340]/10 flex items-center justify-center font-black text-xs flex-shrink-0">
                  {cust.name ? cust.name.substring(0, 2).toUpperCase() : 'CU'}
                </div>
                <div className="min-w-0">
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <span className="font-extrabold text-[#313030] truncate leading-tight">{cust.name}</span>
                    {cust.tier === 'VIP' && (
                      <span className="text-[7px] bg-amber-50 text-amber-700 px-1 py-0.2 rounded font-black border border-amber-200">VIP</span>
                    )}
                  </div>
                  <div className="mt-0.5">
                    {renderChurnBadge(cust.churnStatus, cust.daysSinceLast)}
                  </div>
                </div>
              </div>

              {/* Direct WhatsApp Action Button (Icon Only) */}
              <button
                type="button"
                onClick={() => handleOpenWA(cust)}
                className="p-2 rounded-xl bg-emerald-50 hover:bg-emerald-600 text-emerald-600 hover:text-white border border-emerald-200/80 transition-all flex items-center justify-center flex-shrink-0 cursor-pointer shadow-2xs group"
                title={`Hubungi ${cust.name} via WhatsApp (${cust.phone})`}
              >
                <svg className="w-4 h-4 fill-current group-hover:scale-110 transition-transform" viewBox="0 0 24 24">
                  <path d="M.057 24l1.687-6.163c-1.041-1.804-1.588-3.849-1.587-5.946.003-6.556 5.338-11.891 11.893-11.891 3.181.001 6.167 1.24 8.413 3.488 2.245 2.248 3.481 5.236 3.48 8.414-.003 6.557-5.338 11.892-11.893 11.892-1.99-.001-3.951-.5-5.688-1.448l-6.305 1.654zm6.597-3.807c1.676.995 3.276 1.591 5.392 1.592 5.448 0 9.886-4.434 9.889-9.885.002-5.462-4.415-9.89-9.881-9.892-5.452 0-9.887 4.434-9.889 9.884-.001 2.225.651 3.891 1.746 5.634l-.999 3.648 3.742-.981zm11.387-5.464c-.074-.124-.272-.198-.57-.347-.297-.149-1.758-.868-2.031-.967-.272-.099-.47-.149-.669.149-.198.297-.768.967-.941 1.165-.173.198-.347.223-.644.074-.297-.149-1.255-.462-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.297-.347.446-.521.151-.172.2-.296.3-.495.099-.198.05-.372-.025-.521-.075-.148-.669-1.611-.916-2.206-.242-.579-.487-.501-.669-.51l-.57-.01c-.198 0-.52.074-.792.372s-1.04 1.016-1.04 2.479 1.065 2.876 1.213 3.074c.149.198 2.095 3.2 5.076 4.487.709.306 1.263.489 1.694.626.712.226 1.36.194 1.872.118.571-.085 1.758-.719 2.006-1.413.248-.695.248-1.29.173-1.414z"/>
                </svg>
              </button>
            </div>
          ))
        ) : (
          <div className="text-center py-6 text-slate-400 text-xs font-bold">
            Tidak ada customer dalam kategori "{churnFilter}"
          </div>
        )}
      </div>

      <button
        type="button"
        onClick={() => navigate('/customer')}
        className="w-full py-2.5 border border-dashed border-[#e0e0e0] hover:border-[#5f1340]/30 rounded-2xl text-center text-[9px] font-bold text-slate-500 hover:text-[#5f1340] mt-2 transition-all duration-300 cursor-pointer"
      >
        Kelola Pelanggan &bull; Ke Halaman Customer
      </button>
    </div>
  );
}
