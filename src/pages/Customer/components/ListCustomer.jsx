import React, { useState } from 'react';
import { formatName } from '../../../utils/FormatName';
import {
  Users,
  Search,
  Award,
  DollarSign,
  TrendingUp,
  X
} from 'lucide-react';

const renderTierBadge = (tier) => {
  switch (tier) {
    case 'VIP':
      return <span className="bg-gradient-to-r from-amber-400 to-amber-500 text-slate-950 font-black text-[10px] px-3 py-1 rounded-full border border-amber-300 shadow-xs uppercase tracking-wider inline-block whitespace-nowrap">VIP</span>;
    case 'Gold':
      return <span className="bg-amber-50 text-amber-900 border border-amber-200 font-extrabold text-[10px] px-3 py-1 rounded-full inline-block whitespace-nowrap">Gold</span>;
    case 'Reguler':
      return <span className="bg-slate-100 text-slate-700 border border-slate-200 font-bold text-[10px] px-3 py-1 rounded-full inline-block whitespace-nowrap">Reguler</span>;
    default:
      return <span className="bg-sky-50 text-sky-800 border border-sky-200 font-bold text-[10px] px-3 py-1 rounded-full inline-block whitespace-nowrap">One-Time</span>;
  }
};

export default function ListCustomer({ customers }) {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedTier, setSelectedTier] = useState('Semua');
  const [selectedCustomerDetail, setSelectedCustomerDetail] = useState(null);

  const filteredCustomers = customers.filter(c => {
    const matchesSearch = c.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      c.phone.includes(searchQuery) ||
      (c.address && c.address.toLowerCase().includes(searchQuery.toLowerCase()));
    if (selectedTier === 'Semua') return matchesSearch;
    return matchesSearch && c.tier === selectedTier;
  });

  const totalVipCount = customers.filter(c => c.tier === 'VIP').length;
  const totalGoldCount = customers.filter(c => c.tier === 'Gold').length;

  return (
    <>
      <div className="flex flex-col gap-6">
        {/* Top Summary Metrics Cards */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="bg-white border border-[#e0e0e0] rounded-2xl p-4 shadow-xs flex items-center gap-4">
            <div className="p-3 bg-[#5f1340]/5 text-[#5f1340] rounded-xl">
              <Users className="h-6 w-6" />
            </div>
            <div>
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Total Pelanggan</span>
              <span className="text-lg font-black text-[#313030] block">{customers.length} Orang</span>
            </div>
          </div>

          <div className="bg-white border border-[#e0e0e0] rounded-2xl p-4 shadow-xs flex items-center gap-4">
            <div className="p-3 bg-amber-50 text-amber-700 rounded-xl">
              <Award className="h-6 w-6" />
            </div>
            <div>
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Member VIP</span>
              <span className="text-lg font-black text-amber-800 block">{totalVipCount} Pelanggan</span>
            </div>
          </div>

          <div className="bg-white border border-[#e0e0e0] rounded-2xl p-4 shadow-xs flex items-center gap-4">
            <div className="p-3 bg-yellow-50 text-yellow-700 rounded-xl">
              <TrendingUp className="h-6 w-6" />
            </div>
            <div>
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Member Gold</span>
              <span className="text-lg font-black text-yellow-800 block">{totalGoldCount} Pelanggan</span>
            </div>
          </div>

          <div className="bg-white border border-[#e0e0e0] rounded-2xl p-4 shadow-xs flex items-center gap-4">
            <div className="p-3 bg-emerald-50 text-emerald-700 rounded-xl">
              <DollarSign className="h-6 w-6" />
            </div>
            <div>
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Rata-rata Spending</span>
              <span className="text-lg font-black text-emerald-800 block">Rp 7.47M</span>
            </div>
          </div>
        </div>

        {/* Main CRM Table Workspace */}
        <div className="bg-white border border-[#e0e0e0] rounded-3xl p-5 shadow-xs flex flex-col gap-4">
          {/* Search and Tier Tabs */}
          <div className="flex flex-col sm:flex-row justify-between items-center gap-4 border-b border-[#e0e0e0]/70 pb-4">
            <div className="relative w-full sm:w-80">
              <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
              <input
                type="text"
                placeholder="Cari nama, nomor HP, alamat..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-10 pr-4 py-2 border border-[#e0e0e0] rounded-xl text-xs font-bold outline-none focus:border-[#5f1340]"
              />
            </div>

            <div className="flex items-center gap-1.5 overflow-x-auto w-full sm:w-auto">
              {['Semua', 'VIP', 'Gold', 'Reguler', 'One-Time'].map(tier => (
                <button
                  key={tier}
                  type="button"
                  onClick={() => setSelectedTier(tier)}
                  className={`px-3.5 py-1.5 rounded-xl text-xs font-black transition-all cursor-pointer ${
                    selectedTier === tier
                      ? 'bg-[#5f1340] text-white shadow-xs'
                      : 'bg-[#f8f8f8] text-slate-600 hover:bg-[#e0e0e0]'
                  }`}
                >
                  {tier}
                </button>
              ))}
            </div>
          </div>

          {/* Table */}
          <div className="overflow-x-auto">
            <table className="w-full min-w-[900px] text-left text-xs border-collapse">
              <thead>
                <tr className="bg-[#f8f8f8] text-slate-400 font-extrabold uppercase text-[10px] border-b border-[#e0e0e0] whitespace-nowrap">
                  <th className="py-3.5 px-4">Nama Pelanggan</th>
                  <th className="py-3.5 px-4">No. Telepon & Alamat</th>
                  <th className="py-3.5 px-4">Cabang Terdaftar</th>
                  <th className="py-3.5 px-4 text-center">Tier Member</th>
                  <th className="py-3.5 px-4">Total Spending</th>
                  <th className="py-3.5 px-4">Total Transaksi</th>
                  <th className="py-3.5 px-4">Terakhir Transaksi</th>
                  <th className="py-3.5 px-4 text-center">Aksi Detail</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#e0e0e0]/70 font-semibold">
                {filteredCustomers.map(cust => (
                  <tr key={cust.id} className="hover:bg-[#f8f8f8] transition-colors">
                    <td className="py-3.5 px-4">
                      <span className="font-extrabold text-[#313030] block text-xs">{formatName(cust.name)}</span>
                      <span className="text-[10px] text-slate-400 block font-mono mt-0.5">{cust.id}</span>
                    </td>
                    <td className="py-3.5 px-4">
                      <span className="text-slate-700 block font-bold">{cust.phone}</span>
                      <span className="text-[10px] text-slate-400 block truncate max-w-[200px] mt-0.5">{cust.address}</span>
                    </td>
                    <td className="py-3.5 px-4 font-bold text-slate-600">
                      {cust.homeBranch}
                    </td>
                    <td className="py-3.5 px-4 text-center">
                      {renderTierBadge(cust.tier)}
                    </td>
                    <td className="py-3.5 px-4 font-black text-[#5f1340]">
                      Rp {cust.totalSpending.toLocaleString('id-ID')}
                    </td>
                    <td className="py-3.5 px-4 font-extrabold text-slate-700">
                      {cust.trxCount} Order
                    </td>
                    <td className="py-3.5 px-4 text-slate-500 font-bold text-[11px]">
                      {cust.lastTrx}
                    </td>
                    <td className="py-3.5 px-4 text-center">
                      <button
                        type="button"
                        onClick={() => setSelectedCustomerDetail(cust)}
                        className="px-3 py-1 bg-[#f8f8f8] hover:bg-[#5f1340]/10 border border-[#e0e0e0] rounded-xl text-[#5f1340] font-black text-[11px] transition-all cursor-pointer"
                      >
                        Rincian CRM
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* MODAL CRM DETAIL VIEWER */}
      {selectedCustomerDetail && (
        <div className="fixed inset-0 z-50 bg-[#313030]/60 backdrop-blur-md flex justify-center items-center p-3 sm:p-4">
          <div className="bg-white rounded-3xl border border-[#e0e0e0] w-full max-w-2xl shadow-2xl overflow-hidden animate-fade-in flex flex-col max-h-[90vh]">
            <div className="p-4 border-b border-[#e0e0e0] flex justify-between items-center bg-[#f8f8f8]">
              <div className="flex items-center gap-3">
                <span className="font-mono font-black text-[#5f1340] bg-[#5f1340]/10 px-3 py-1 rounded-xl text-xs">
                  {selectedCustomerDetail.id}
                </span>
                <div>
                  <h3 className="text-sm font-extrabold text-[#313030]">{formatName(selectedCustomerDetail.name)}</h3>
                  <p className="text-[10px] text-slate-400">Tahu Waschen dari: {selectedCustomerDetail.source}</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setSelectedCustomerDetail(null)}
                className="p-1.5 hover:bg-[#e0e0e0] rounded-xl text-slate-400 transition-colors"
              >
                <X className="h-4.5 w-4.5" />
              </button>
            </div>

            <div className="p-5 flex flex-col gap-5 text-xs bg-white overflow-y-auto">
              <div className="bg-[#f8f8f8] p-4 rounded-2xl border border-[#e0e0e0] grid grid-cols-3 gap-4 text-center">
                <div>
                  <span className="text-[9px] font-bold text-slate-400 uppercase tracking-wider block">Status Tier</span>
                  <div className="mt-1">{renderTierBadge(selectedCustomerDetail.tier)}</div>
                </div>
                <div>
                  <span className="text-[9px] font-bold text-slate-400 uppercase tracking-wider block">Cabang Terdaftar</span>
                  <span className="text-xs font-black text-[#313030] block mt-1">{selectedCustomerDetail.homeBranch}</span>
                </div>
                <div>
                  <span className="text-[9px] font-bold text-slate-400 uppercase tracking-wider block">Total Transaksi</span>
                  <span className="text-xs font-black text-[#5f1340] block mt-1">{selectedCustomerDetail.trxCount} Order</span>
                </div>
              </div>

              <div className="flex flex-col gap-2">
                <span className="text-[10px] font-extrabold text-[#5f1340] uppercase tracking-wider">Biodata & Preferensi Pelanggan</span>
                <div className="bg-[#f8f8f8] p-4 rounded-2xl border border-[#e0e0e0] space-y-2 text-slate-700">
                  <div><strong>No. WhatsApp:</strong> {selectedCustomerDetail.phone}</div>
                  <div><strong>Email:</strong> {selectedCustomerDetail.email || '-'}</div>
                  <div><strong>Alamat Lengkap:</strong> {selectedCustomerDetail.address} ({selectedCustomerDetail.city || 'Jakarta'})</div>
                  <div><strong>Patokan / Landmark:</strong> {selectedCustomerDetail.landmark || '-'}</div>
                  <div><strong>Aroma Parfum Favorit:</strong> {selectedCustomerDetail.perfumePreference || 'Sakura Premium'}</div>
                  <div><strong>Preferensi Kerja:</strong> {selectedCustomerDetail.workPreference || 'Standard Reguler'}</div>
                  <div><strong>Catatan Khusus:</strong> {selectedCustomerDetail.notes}</div>
                </div>
              </div>

              <div className="flex flex-col gap-2">
                <span className="text-[10px] font-extrabold text-[#5f1340] uppercase tracking-wider">Riwayat Komplain / Umpan Balik</span>
                {selectedCustomerDetail.complaints && selectedCustomerDetail.complaints.length > 0 ? (
                  <div className="space-y-2">
                    {selectedCustomerDetail.complaints.map((comp, idx) => (
                      <div key={idx} className="p-3 bg-rose-50 border border-rose-200 rounded-xl flex justify-between items-center text-xs">
                        <div>
                          <span className="font-extrabold text-rose-900 block">{comp.issue}</span>
                          <span className="text-[10px] text-rose-400 block mt-0.5">{comp.date}</span>
                        </div>
                        <span className="px-2.5 py-0.5 bg-white border border-rose-300 text-rose-800 rounded-full font-black text-[9px]">
                          {comp.status}
                        </span>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="p-3 bg-emerald-50 border border-emerald-200 text-emerald-800 rounded-xl text-center font-bold text-[11px]">
                    ✨ Tidak ada catatan komplain. Pelanggan puas dengan layanan Waschen.
                  </div>
                )}
              </div>

              <div className="flex flex-col gap-2">
                <span className="text-[10px] font-extrabold text-[#5f1340] uppercase tracking-wider">Riwayat Transaksi Terbaru</span>
                {selectedCustomerDetail.history && selectedCustomerDetail.history.length > 0 ? (
                  <div className="space-y-2">
                    {selectedCustomerDetail.history.map((h, idx) => (
                      <div key={idx} className="p-3.5 bg-white border border-[#e0e0e0] rounded-2xl flex justify-between items-center text-xs shadow-xs">
                        <div>
                          <span className="font-mono font-black text-[#5f1340] text-xs block">{h.orderId}</span>
                          <span className="font-bold text-[#313030] block mt-0.5">{h.items}</span>
                          <span className="text-[9px] text-slate-400 block mt-0.5">{h.date}</span>
                        </div>
                        <span className="font-black text-[#313030] text-xs">
                          Rp {h.amount.toLocaleString('id-ID')}
                        </span>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="p-3 bg-slate-50 border border-slate-200 text-slate-500 rounded-xl text-center font-bold text-[11px]">
                    Belum ada riwayat transaksi recorded.
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
