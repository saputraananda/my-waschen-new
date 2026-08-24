import React from 'react';
import { Users, Plus, Search, MapPin, ArrowRight, ChevronLeft, ChevronRight } from 'lucide-react';

export default function SelectCustomer({
  customerSearch,
  setCustomerSearch,
  selectedBranchFilter,
  setSelectedBranchFilter,
  outlets,
  customerTiers = [],
  selectedTierFilter,
  setSelectedTierFilter,
  paginatedCustomers,
  activeOutletName,
  setSelectedCustId,
  onPickCustomer,
  setCurrentStep,
  formatName,
  renderTierBadge,
  totalCustPages,
  custCurrentPage,
  setCustCurrentPage,
  filteredCustomers,
  navigate
}) {
  return (
    <div className="flex flex-col gap-5">
      {/* Top Toolbar: Search, Filters & Add Customer */}
      <div className="bg-white border border-[#e0e0e0] rounded-3xl p-5 shadow-xs flex flex-col gap-4">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-3 pb-3 border-b border-[#e0e0e0]">
          <div>
            <h1 className="text-xl font-black text-[#313030] tracking-tight flex items-center gap-2">
              <Users className="h-5 w-5 text-[#5f1340]" />
              <span>Langkah 1: Pilih Pelanggan POS Waschen</span>
            </h1>
            <p className="text-xs text-slate-400 mt-0.5">Prioritas member VIP & Gold ditampilkan terlebih dahulu untuk kemudahan kasir</p>
          </div>

          <button
            type="button"
            onClick={() => navigate('/customer', { state: { tab: 'add', from: '/transaction' } })}
            className="px-4 py-2.5 bg-[#5f1340] hover:bg-[#4d0f33] text-white font-black text-xs rounded-xl shadow-xs transition-all flex items-center gap-1.5 cursor-pointer self-stretch sm:self-auto justify-center"
          >
            <Plus className="h-4 w-4" />
            <span>Registrasi Pelanggan Baru</span>
          </button>
        </div>

        {/* Filter Row: Search, Branch, Tier */}
        <div className="grid grid-cols-1 md:grid-cols-12 gap-3 items-center">
          <div className="relative md:col-span-5 flex items-center">
            <Search className="absolute left-3.5 h-4 w-4 text-slate-400 pointer-events-none" />
            <input
              type="text"
              placeholder="Cari nama pelanggan, nomor WhatsApp, atau alamat..."
              value={customerSearch}
              onChange={(e) => setCustomerSearch(e.target.value)}
              className="w-full pl-10 pr-3.5 h-10 bg-[#f8f8f8] border border-[#e0e0e0] rounded-xl text-xs font-semibold text-[#313030] outline-none focus:bg-white focus:border-[#5f1340] focus:ring-1 focus:ring-[#5f1340] transition-all"
            />
          </div>

          <div className="md:col-span-4">
            <select
              value={selectedBranchFilter}
              onChange={(e) => setSelectedBranchFilter(e.target.value)}
              className="w-full h-10 px-3 bg-[#f8f8f8] border border-[#e0e0e0] rounded-xl text-xs font-semibold text-[#313030] outline-none focus:bg-white focus:border-[#5f1340] cursor-pointer"
            >
              <option value="Semua">Semua Cabang Outlet</option>
              {(outlets || []).map(o => (
                <option key={o.id} value={o.full_name || o.name}>{o.full_name || o.name}</option>
              ))}
            </select>
          </div>

          <div className="md:col-span-3 flex items-center gap-1 overflow-x-auto no-scrollbar">
            {['Semua', ...customerTiers.map(t => t.name)].map(t => (
              <button
                key={t}
                type="button"
                onClick={() => setSelectedTierFilter(t)}
                className={`flex-1 h-10 px-2 rounded-xl text-[10px] font-black transition-all cursor-pointer whitespace-nowrap ${
                  selectedTierFilter === t
                    ? 'bg-[#5f1340] text-white shadow-xs'
                    : 'bg-[#f8f8f8] text-slate-600 border border-[#e0e0e0] hover:bg-slate-100'
                }`}
              >
                {t}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Customer Cards Grid (3x3 Paginated) */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {paginatedCustomers.length > 0 ? (
          paginatedCustomers.map(c => {
            const isCross = c.homeBranch !== activeOutletName;
            return (
              <div
                key={c.id}
                onClick={() => {
                  if (typeof onPickCustomer === 'function') {
                    onPickCustomer(c);
                    return;
                  }
                  setSelectedCustId(c.id);
                  setCurrentStep(2);
                }}
                className="bg-white border border-[#e0e0e0] hover:border-[#5f1340]/50 hover:shadow-md rounded-3xl p-5 transition-all duration-200 cursor-pointer flex flex-col justify-between group relative overflow-hidden"
              >
                {/* Top Row: Avatar, Name, Tier */}
                <div className="flex items-start gap-3.5">
                  <div className="w-11 h-11 rounded-2xl bg-gradient-to-tr from-[#5f1340] to-[#7d1956] text-white font-black text-base flex items-center justify-center shadow-xs shrink-0 group-hover:scale-105 transition-transform">
                    {c.name.charAt(0).toUpperCase()}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <h3 className="font-black text-sm text-[#313030] group-hover:text-[#5f1340] transition-colors truncate">
                        {formatName(c.name)}
                      </h3>
                      {renderTierBadge(c.tier)}
                    </div>
                    <span className="text-xs text-slate-400 font-medium block mt-0.5">{c.phone}</span>
                  </div>
                </div>

                {/* Middle: Address & Branch info */}
                <div className="my-3 py-2.5 border-t border-b border-[#e0e0e0]/70 text-xs text-slate-500 space-y-1">
                  <div className="flex items-start gap-1.5">
                    <MapPin className="h-3.5 w-3.5 text-slate-400 mt-0.5 shrink-0" />
                    <span className="text-[11px] line-clamp-2">{c.address || 'Alamat belum dilengkapi (Walk-in)'}</span>
                  </div>
                  <div className="flex items-center justify-between text-[10px] text-slate-400 pt-1">
                    <span>{c.homeBranch}</span>
                    {isCross && (
                      <span className="text-amber-800 bg-amber-50 border border-amber-200 font-bold px-1.5 py-0.5 rounded">
                        Lintas Cabang
                      </span>
                    )}
                  </div>
                </div>

                {/* Bottom: Member Card Balance & Action */}
                <div className="flex items-center justify-between text-xs pt-1">
                  <div>
                    <span className="text-[10px] text-slate-400 block font-medium">Saldo Kartu:</span>
                    <span className="font-black text-emerald-700 text-xs">
                      Rp {(c.memberBalance || 0).toLocaleString('id-ID')}
                    </span>
                  </div>
                  <span className="text-[11px] font-bold text-[#5f1340] group-hover:underline flex items-center gap-1">
                    Pilih & Lanjut <ArrowRight className="h-3.5 w-3.5" />
                  </span>
                </div>
              </div>
            );
          })
        ) : (
          <div className="col-span-full py-16 bg-white border border-[#e0e0e0] rounded-3xl text-center text-slate-400">
            <Users className="h-10 w-10 mx-auto text-slate-300 mb-2" />
            <p className="font-bold text-xs text-[#313030]">Tidak ada pelanggan yang sesuai dengan pencarian</p>
            <p className="text-[11px] mt-0.5">Silakan reset filter atau tambahkan pelanggan baru</p>
          </div>
        )}
      </div>

      {/* Customer Pagination Controls */}
      {totalCustPages > 1 && (
        <div className="bg-white border border-[#e0e0e0] rounded-2xl p-3 shadow-xs flex items-center justify-between text-xs">
          <span className="text-slate-400 font-medium">
            Menampilkan {paginatedCustomers.length} dari {filteredCustomers.length} pelanggan (Halaman {custCurrentPage} / {totalCustPages})
          </span>

          <div className="flex items-center gap-1.5">
            <button
              type="button"
              disabled={custCurrentPage === 1}
              onClick={() => setCustCurrentPage(prev => Math.max(1, prev - 1))}
              className="p-2 rounded-xl border border-[#e0e0e0] disabled:opacity-40 hover:bg-slate-100 transition-colors cursor-pointer"
            >
              <ChevronLeft className="h-4 w-4" />
            </button>

            {Array.from({ length: totalCustPages }, (_, i) => i + 1).map(pageNum => (
              <button
                key={pageNum}
                type="button"
                onClick={() => setCustCurrentPage(pageNum)}
                className={`w-8 h-8 rounded-xl font-bold text-xs transition-all cursor-pointer ${
                  custCurrentPage === pageNum
                    ? 'bg-[#5f1340] text-white shadow-xs'
                    : 'bg-[#f8f8f8] border border-[#e0e0e0] text-slate-700 hover:bg-slate-100'
                }`}
              >
                {pageNum}
              </button>
            ))}

            <button
              type="button"
              disabled={custCurrentPage === totalCustPages}
              onClick={() => setCustCurrentPage(prev => Math.min(totalCustPages, prev + 1))}
              className="p-2 rounded-xl border border-[#e0e0e0] disabled:opacity-40 hover:bg-slate-100 transition-colors cursor-pointer"
            >
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
