import React from 'react';

export default function DashboardServices({ servicesList }) {
  const kiloanServices = servicesList.filter(s => s.categoryCode === 'KILOAN');
  const satuanServices = servicesList.filter(s => s.categoryCode === 'SATUAN');
  const featuredCount = servicesList.filter(s => s.isFeatured).length;
  const kiloanRatio = servicesList.length > 0
    ? Math.round((kiloanServices.length / servicesList.length) * 100)
    : 0;

  const renderServiceBar = (services, barColor) => {
    if (services.length === 0) {
      return <p className="text-center text-xs text-slate-400 py-4">Belum ada data layanan</p>;
    }

    const maxPrice = Math.max(...services.map(s => s.price), 1);

    return (
      <div className="space-y-4">
        {services.map(s => (
          <div key={s.id} className="space-y-1.5">
            <div className="flex justify-between items-center text-xs font-extrabold">
              <span className="text-[#313030]">{s.name}</span>
              <span className="font-mono text-slate-600">
                Rp {s.price.toLocaleString('id-ID')}/{s.unit}
              </span>
            </div>
            <div className="w-full bg-slate-100 h-2 rounded-full overflow-hidden">
              <div
                className={`h-full rounded-full ${barColor}`}
                style={{ width: `${Math.round((s.price / maxPrice) * 100)}%` }}
              />
            </div>
          </div>
        ))}
      </div>
    );
  };

  const statCards = [
    {
      label: 'Total Layanan Aktif',
      value: `${servicesList.length} Item`,
      sub: `${featuredCount} Unggulan`
    },
    {
      label: 'Kategori Kiloan',
      value: `${kiloanServices.length} Layanan`,
      sub: 'Laundry Kiloan'
    },
    {
      label: 'Kategori Satuan',
      value: `${satuanServices.length} Layanan`,
      sub: 'Laundry Satuan'
    },
    {
      label: 'Proporsi Kiloan : Satuan',
      value: `${kiloanRatio}% : ${100 - kiloanRatio}%`,
      sub: 'Berdasarkan katalog aktif'
    }
  ];

  return (
    <div className="flex flex-col gap-6">
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4">
        {statCards.map(card => (
          <div key={card.label} className="bg-white border border-[#e0e0e0] rounded-2xl p-5 shadow-xs">
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">{card.label}</span>
            <span className="text-sm font-black text-[#313030] block mt-1">{card.value}</span>
            <span className="text-[10px] text-slate-500 font-medium block mt-0.5">{card.sub}</span>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="bg-white border border-[#e0e0e0] rounded-3xl p-6 shadow-xs flex flex-col gap-4">
          <div className="flex justify-between items-center pb-3 border-b border-[#e0e0e0]">
            <h3 className="text-sm font-black text-[#5f1340]">Tarif Jasa Kiloan</h3>
            <span className="text-[10px] font-bold text-slate-400">{kiloanServices.length} Layanan</span>
          </div>
          {renderServiceBar(kiloanServices, 'bg-[#5f1340]')}
        </div>

        <div className="bg-white border border-[#e0e0e0] rounded-3xl p-6 shadow-xs flex flex-col gap-4">
          <div className="flex justify-between items-center pb-3 border-b border-[#e0e0e0]">
            <h3 className="text-sm font-black text-amber-800">Tarif Jasa Satuan</h3>
            <span className="text-[10px] font-bold text-slate-400">{satuanServices.length} Layanan</span>
          </div>
          {renderServiceBar(satuanServices.slice(0, 6), 'bg-amber-500')}
        </div>
      </div>
    </div>
  );
}
