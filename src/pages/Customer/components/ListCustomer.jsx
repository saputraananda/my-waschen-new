import React, { useEffect, useState } from 'react';
import axios from 'axios';
import { useNavigate } from 'react-router-dom';
import { formatName } from '../../../utils/FormatName';
import { formatWorkPercentage } from '../../../utils/workStatusMeta.js';
import CombinedReceiptModal from '../../../components/CombinedReceiptModal.jsx';
import {
  Users,
  Search,
  Award,
  TrendingUp,
  UserRound,
  UserPlus,
  Eye,
  Pencil,
  X,
  Loader2,
  MapPin,
  Receipt,
  Gem,
  Crown
} from 'lucide-react';

const WhatsAppIcon = ({ className = 'h-3.5 w-3.5' }) => (
  <svg viewBox="0 0 24 24" fill="currentColor" className={className} aria-hidden="true">
    <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.435 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z" />
  </svg>
);

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

const renderMembershipBadge = (tier) => {
  if (!tier || tier === '-' || tier === 'Tidak' || tier === 'None') {
    return <span className="text-slate-400 font-bold">-</span>;
  }
  const clean = String(tier).replace(/^member\s*/i, '').trim();

  if (/diamond/i.test(clean)) {
    return (
      <span className="inline-flex items-center gap-1.5 bg-cyan-50 text-cyan-900 border border-cyan-200 font-extrabold text-[10px] px-3 py-1 rounded-full shadow-2xs uppercase tracking-wider whitespace-nowrap">
        <Gem className="h-3.5 w-3.5 text-cyan-600 shrink-0" />
        <span>Diamond</span>
      </span>
    );
  }

  if (/gold/i.test(clean)) {
    return (
      <span className="inline-flex items-center gap-1.5 bg-amber-50 text-amber-900 border border-amber-200 font-extrabold text-[10px] px-3 py-1 rounded-full shadow-2xs uppercase tracking-wider whitespace-nowrap">
        <Crown className="h-3.5 w-3.5 text-amber-600 shrink-0" />
        <span>Gold</span>
      </span>
    );
  }

  return (
    <span className="inline-flex items-center gap-1.5 bg-purple-50 text-purple-900 border border-purple-200 font-extrabold text-[10px] px-3 py-1 rounded-full shadow-2xs uppercase tracking-wider whitespace-nowrap">
      <span>{clean}</span>
    </span>
  );
};

const normalizeTier = (tier) => {
  if (!tier) return 'One-Time';
  const t = String(tier).trim();
  if (/one[\s_-]?time/i.test(t)) return 'One-Time';
  if (/^vip$/i.test(t)) return 'VIP';
  if (/^gold$/i.test(t)) return 'Gold';
  if (/reguler|regular/i.test(t)) return 'Reguler';
  return t;
};

const openWhatsApp = (e, rawPhone) => {
  e.stopPropagation();
  if (!rawPhone) return;
  let digits = rawPhone.replace(/\D/g, '');
  if (digits.startsWith('0')) digits = `62${digits.slice(1)}`;
  if (!digits.startsWith('62')) digits = `62${digits}`;
  window.open(`https://wa.me/${digits}`, '_blank', 'noopener,noreferrer');
};

export default function ListCustomer({
  customers,
  customerTiers = [],
  outlets = [],
  activeOutletName = '',
  activeOutletId = '',
  onEditCustomer
}) {
  const navigate = useNavigate();
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedTier, setSelectedTier] = useState('Semua');
  const [selectedBranch, setSelectedBranch] = useState(activeOutletId || 'Semua');
  const [selectedCustomerDetail, setSelectedCustomerDetail] = useState(null);
  const [isLoadingDetail, setIsLoadingDetail] = useState(false);
  const [isCombinedModalOpen, setIsCombinedModalOpen] = useState(false);

  useEffect(() => {
    if (activeOutletId) setSelectedBranch(String(activeOutletId));
  }, [activeOutletId]);

  const tierTabs = ['Semua', ...(customerTiers.length ? customerTiers.map((t) => t.name) : ['VIP', 'Gold', 'Reguler', 'One-Time'])];

  const matchesBranch = (c) => {
    if (!selectedBranch || selectedBranch === 'Semua') return true;
    if (c.preferredOutletId != null && String(c.preferredOutletId) === String(selectedBranch)) return true;
    const outlet = outlets.find((o) => String(o.id) === String(selectedBranch));
    const outletName = outlet?.full_name || outlet?.name || activeOutletName;
    if (!outletName) return false;
    const branch = (c.homeBranch || '').toLowerCase();
    return branch === outletName.toLowerCase() || branch.includes(outletName.toLowerCase());
  };

  const filteredCustomers = customers.filter((c) => {
    const q = searchQuery.toLowerCase();
    const matchesSearch = !q
      || c.name.toLowerCase().includes(q)
      || (c.phone || '').includes(searchQuery);
    if (!matchesSearch || !matchesBranch(c)) return false;
    if (selectedTier === 'Semua') return true;
    return normalizeTier(c.tier) === normalizeTier(selectedTier);
  });

  const totalVipCount = filteredCustomers.filter((c) => normalizeTier(c.tier) === 'VIP').length;
  const totalGoldCount = filteredCustomers.filter((c) => normalizeTier(c.tier) === 'Gold').length;
  const totalRegulerCount = filteredCustomers.filter((c) => normalizeTier(c.tier) === 'Reguler').length;
  const totalOneTimeCount = filteredCustomers.filter((c) => normalizeTier(c.tier) === 'One-Time').length;

  const openCustomerDetail = async (cust) => {
    setSelectedCustomerDetail(cust);
    setIsLoadingDetail(true);
    try {
      const res = await axios.get(`/api/customers/${cust.dbId || cust.id}`);
      if (res.data?.success && res.data.data) {
        const c = res.data.data;
        const trxCount = parseInt(c.trx_count_live ?? c.total_orders, 10) || 0;
        const totalSpending = parseFloat(c.total_spent_live ?? c.total_spent) || 0;
        const formatDateId = (d) =>
          d ? new Date(d).toLocaleDateString('id-ID', { day: '2-digit', month: 'short', year: 'numeric' }) : '-';
        const lastDate = c.last_order_date || null;
        setSelectedCustomerDetail({
          ...cust,
          id: c.customer_code || cust.id,
          dbId: c.id,
          name: c.name || cust.name,
          phone: c.phone || cust.phone,
          email: c.email || cust.email || '-',
          address: c.address || cust.address || '-',
          city: c.city || cust.city,
          landmark: c.landmark || cust.landmark || '-',
          homeBranch: c.home_branch || cust.homeBranch || activeOutletName,
          preferredOutletId: c.preferred_outlet_id ?? cust.preferredOutletId,
          tier: c.tier || cust.tier,
          membershipTier: c.membership_tier || cust.membershipTier,
          totalSpending,
          trxCount,
          registeredAt: formatDateId(c.created_at) || cust.registeredAt || '-',
          lastTrx: trxCount > 0 && lastDate ? formatDateId(lastDate) : '-',
          source: c.source || c.source_name || cust.source,
          notes: c.notes || cust.notes,
          history: Array.isArray(c.history) ? c.history : []
        });
      }
    } catch (err) {
      console.error('Gagal memuat detail pelanggan:', err);
    } finally {
      setIsLoadingDetail(false);
    }
  };

  return (
    <>
      <div className="flex flex-col gap-6">
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-2.5 sm:gap-4">
          <div className="bg-white border border-[#e0e0e0] rounded-2xl p-3 sm:p-4 shadow-xs flex items-center gap-2.5 sm:gap-4 min-w-0">
            <div className="p-2.5 sm:p-3 bg-[#5f1340]/5 text-[#5f1340] rounded-xl shrink-0">
              <Users className="h-5 w-5 sm:h-6 sm:w-6" />
            </div>
            <div className="min-w-0 flex-1">
              <span className="text-[9px] sm:text-[10px] font-bold text-slate-400 uppercase tracking-wider block truncate">Total Pelanggan</span>
              <span className="text-sm sm:text-lg font-black text-[#313030] block truncate">{filteredCustomers.length} Orang</span>
            </div>
          </div>
          <div className="bg-white border border-[#e0e0e0] rounded-2xl p-3 sm:p-4 shadow-xs flex items-center gap-2.5 sm:gap-4 min-w-0">
            <div className="p-2.5 sm:p-3 bg-amber-50 text-amber-700 rounded-xl shrink-0"><Award className="h-5 w-5 sm:h-6 sm:w-6" /></div>
            <div className="min-w-0 flex-1">
              <span className="text-[9px] sm:text-[10px] font-bold text-slate-400 uppercase tracking-wider block truncate">VIP</span>
              <span className="text-sm sm:text-lg font-black text-amber-800 block truncate">{totalVipCount} Pelanggan</span>
            </div>
          </div>
          <div className="bg-white border border-[#e0e0e0] rounded-2xl p-3 sm:p-4 shadow-xs flex items-center gap-2.5 sm:gap-4 min-w-0">
            <div className="p-2.5 sm:p-3 bg-yellow-50 text-yellow-700 rounded-xl shrink-0"><TrendingUp className="h-5 w-5 sm:h-6 sm:w-6" /></div>
            <div className="min-w-0 flex-1">
              <span className="text-[9px] sm:text-[10px] font-bold text-slate-400 uppercase tracking-wider block truncate">Gold</span>
              <span className="text-sm sm:text-lg font-black text-yellow-800 block truncate">{totalGoldCount} Pelanggan</span>
            </div>
          </div>
          <div className="bg-white border border-[#e0e0e0] rounded-2xl p-3 sm:p-4 shadow-xs flex items-center gap-2.5 sm:gap-4 min-w-0">
            <div className="p-2.5 sm:p-3 bg-slate-100 text-slate-600 rounded-xl shrink-0"><UserRound className="h-5 w-5 sm:h-6 sm:w-6" /></div>
            <div className="min-w-0 flex-1">
              <span className="text-[9px] sm:text-[10px] font-bold text-slate-400 uppercase tracking-wider block truncate">Reguler</span>
              <span className="text-sm sm:text-lg font-black text-slate-700 block truncate">{totalRegulerCount} Pelanggan</span>
            </div>
          </div>
          <div className="bg-white border border-[#e0e0e0] rounded-2xl p-3 sm:p-4 shadow-xs flex items-center gap-2.5 sm:gap-4 min-w-0 col-span-2 sm:col-span-1">
            <div className="p-2.5 sm:p-3 bg-sky-50 text-sky-700 rounded-xl shrink-0"><UserPlus className="h-5 w-5 sm:h-6 sm:w-6" /></div>
            <div className="min-w-0 flex-1">
              <span className="text-[9px] sm:text-[10px] font-bold text-slate-400 uppercase tracking-wider block truncate">One-Time</span>
              <span className="text-sm sm:text-lg font-black text-sky-800 block truncate">{totalOneTimeCount} Pelanggan</span>
            </div>
          </div>
        </div>

        <div className="bg-white border border-[#e0e0e0] rounded-2xl sm:rounded-3xl p-4 sm:p-5 shadow-xs flex flex-col gap-4">
          <div className="flex flex-col lg:flex-row justify-between items-stretch lg:items-center gap-3 border-b border-[#e0e0e0]/70 pb-4">
            <div className="relative w-full lg:w-72">
              <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
              <input
                type="text"
                placeholder="Cari nama atau nomor HP..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-10 pr-4 py-2 border border-[#e0e0e0] rounded-xl text-xs font-bold outline-none focus:border-[#5f1340]"
              />
            </div>

            <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 w-full lg:w-auto min-w-0">
              <select
                value={selectedBranch}
                onChange={(e) => setSelectedBranch(e.target.value)}
                className="w-full sm:w-auto px-3 py-2 bg-[#f8f8f8] border border-[#e0e0e0] rounded-xl text-xs font-bold text-[#313030] outline-none focus:border-[#5f1340] cursor-pointer min-w-0 sm:min-w-[180px]"
                title="Filter cabang"
              >
                <option value="Semua">Semua Cabang</option>
                {outlets.map((o) => (
                  <option key={o.id} value={String(o.id)}>
                    {o.full_name || o.name}
                  </option>
                ))}
              </select>

              <div className="flex items-center gap-1.5 overflow-x-auto pb-1 sm:pb-0 scrollbar-none">
                {tierTabs.map((tier) => (
                  <button
                    key={tier}
                    type="button"
                    onClick={() => setSelectedTier(tier)}
                    className={`px-3 py-1.5 rounded-xl text-xs font-black transition-all cursor-pointer whitespace-nowrap ${
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
          </div>

          <div className="overflow-x-auto">
            <table className="w-full min-w-[900px] text-left text-xs border-collapse">
              <thead>
                <tr className="bg-[#f8f8f8] text-slate-400 font-extrabold uppercase text-[10px] border-b border-[#e0e0e0] whitespace-nowrap">
                  <th className="py-3.5 px-3 text-center w-12">No</th>
                  <th className="py-3.5 px-4">Nama Pelanggan</th>
                  <th className="py-3.5 px-4">No. Telepon</th>
                  <th className="py-3.5 px-4">Cabang Terdaftar</th>
                  <th className="py-3.5 px-4 text-center">Tier</th>
                  <th className="py-3.5 px-4 text-center">Member</th>
                  <th className="py-3.5 px-4">Total Spending</th>
                  <th className="py-3.5 px-4">Total Transaksi</th>
                  <th className="py-3.5 px-4">Terdaftar Pada</th>
                  <th className="py-3.5 px-4">Terakhir Transaksi</th>
                  <th className="py-3.5 px-4 text-center">Aksi</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#e0e0e0]/70 font-semibold">
                {filteredCustomers.length === 0 ? (
                  <tr>
                    <td colSpan={11} className="py-10 text-center text-slate-400 font-bold">
                      Tidak ada pelanggan pada filter cabang / tier ini.
                    </td>
                  </tr>
                ) : (
                  filteredCustomers.map((cust, idx) => (
                    <tr key={cust.dbId || cust.id} className="hover:bg-[#f8f8f8] transition-colors">
                      <td className="py-3.5 px-3 text-center font-black text-slate-500">
                        {idx + 1}
                      </td>
                      <td className="py-3.5 px-4">
                        <span className="font-extrabold text-[#313030] block text-xs">{formatName(cust.name)}</span>
                      </td>
                      <td className="py-3.5 px-4">
                        {cust.phone && cust.phone !== '-' ? (
                          <button
                            type="button"
                            onClick={(e) => openWhatsApp(e, cust.phone)}
                            className="inline-flex items-center gap-1.5 text-emerald-700 hover:text-emerald-800 font-bold hover:underline cursor-pointer"
                            title={`Chat WhatsApp ${cust.phone}`}
                          >
                            <span className="text-emerald-600"><WhatsAppIcon /></span>
                            <span className="font-mono">{cust.phone}</span>
                          </button>
                        ) : (
                          <span className="text-slate-300">—</span>
                        )}
                      </td>
                      <td className="py-3.5 px-4 font-bold text-slate-600">
                        {cust.homeBranch}
                      </td>
                      <td className="py-3.5 px-4 text-center">
                        {renderTierBadge(normalizeTier(cust.tier))}
                      </td>
                      <td className="py-3.5 px-4 text-center">
                        {renderMembershipBadge(cust.membershipTier)}
                      </td>
                      <td className="py-3.5 px-4 font-black text-[#5f1340]">
                        Rp {(cust.totalSpending || 0).toLocaleString('id-ID')}
                      </td>
                      <td className="py-3.5 px-4 font-extrabold text-slate-700">
                        {cust.trxCount || 0}X
                      </td>
                      <td className="py-3.5 px-4 text-slate-500 font-bold text-[11px]">
                        {cust.registeredAt || '-'}
                      </td>
                      <td className="py-3.5 px-4 text-slate-500 font-bold text-[11px]">
                        {cust.trxCount > 0 ? (cust.lastTrx || '-') : '-'}
                      </td>
                      <td className="py-3.5 px-4 text-center">
                        <div className="inline-flex items-center gap-1.5">
                          <button
                            type="button"
                            onClick={() => onEditCustomer?.(cust)}
                            className="inline-flex items-center justify-center p-2 rounded-xl border border-[#e0e0e0] bg-white hover:bg-slate-50 text-slate-600 transition-all cursor-pointer"
                            title="Ubah data pelanggan"
                          >
                            <Pencil className="h-4 w-4" />
                          </button>
                          <button
                            type="button"
                            onClick={() => openCustomerDetail(cust)}
                            className="inline-flex items-center justify-center p-2 rounded-xl border border-[#e0e0e0] bg-white hover:bg-[#5f1340] hover:text-white text-[#5f1340] transition-all cursor-pointer shadow-2xs"
                            title="Lihat rincian pelanggan & riwayat belanja"
                          >
                            <Eye className="h-4 w-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {selectedCustomerDetail && (
        <div className="fixed inset-0 z-50 bg-[#313030]/60 backdrop-blur-md flex justify-center items-center p-3 sm:p-4">
          <div className="bg-white rounded-3xl border border-[#e0e0e0] w-full max-w-2xl shadow-2xl overflow-hidden animate-fade-in flex flex-col max-h-[90vh]">
            <div className="p-4 border-b border-[#e0e0e0] flex justify-between items-center bg-[#f8f8f8]">
              <div>
                <h3 className="text-sm font-extrabold text-[#313030]">{formatName(selectedCustomerDetail.name)}</h3>
                <p className="text-[10px] text-slate-400">Tahu Waschen dari: {selectedCustomerDetail.source}</p>
                <p className="text-[10px] text-slate-400 mt-0.5">Terdaftar pada: {selectedCustomerDetail.registeredAt || '-'}</p>
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => {
                    onEditCustomer?.(selectedCustomerDetail);
                    setSelectedCustomerDetail(null);
                  }}
                  className="px-3 py-1.5 text-[10px] font-black rounded-xl border border-[#5f1340]/20 text-[#5f1340] hover:bg-[#5f1340] hover:text-white cursor-pointer"
                >
                  Ubah Data
                </button>
              <button
                type="button"
                onClick={() => setSelectedCustomerDetail(null)}
                className="p-1.5 hover:bg-[#e0e0e0] rounded-xl text-slate-400 transition-colors cursor-pointer"
              >
                <X className="h-4.5 w-4.5" />
              </button>
              </div>
            </div>

            <div className="p-5 flex flex-col gap-5 text-xs bg-white overflow-y-auto">
              <div className="bg-[#f8f8f8] p-4 rounded-2xl border border-[#e0e0e0] grid grid-cols-2 sm:grid-cols-4 gap-4 text-center">
                <div>
                  <span className="text-[9px] font-bold text-slate-400 uppercase tracking-wider block">Tier</span>
                  <div className="mt-1">{renderTierBadge(normalizeTier(selectedCustomerDetail.tier))}</div>
                </div>
                <div>
                  <span className="text-[9px] font-bold text-slate-400 uppercase tracking-wider block">Member</span>
                  <div className="mt-1">{renderMembershipBadge(selectedCustomerDetail.membershipTier)}</div>
                </div>
                <div>
                  <span className="text-[9px] font-bold text-slate-400 uppercase tracking-wider block">Cabang Terdaftar</span>
                  <span className="text-xs font-black text-[#313030] block mt-1">{selectedCustomerDetail.homeBranch}</span>
                </div>
                <div>
                  <span className="text-[9px] font-bold text-slate-400 uppercase tracking-wider block">Total Transaksi</span>
                  <span className="text-xs font-black text-[#5f1340] block mt-1">{selectedCustomerDetail.trxCount || 0}X</span>
                </div>
              </div>

              <div className="flex flex-col gap-2">
                <span className="text-[10px] font-extrabold text-[#5f1340] uppercase tracking-wider">Biodata & Preferensi Pelanggan</span>
                <div className="bg-[#f8f8f8] p-4 rounded-2xl border border-[#e0e0e0] space-y-2 text-slate-700">
                  <div className="flex items-center gap-2 flex-wrap">
                    <strong>No. WhatsApp:</strong>
                    {selectedCustomerDetail.phone && selectedCustomerDetail.phone !== '-' ? (
                      <button
                        type="button"
                        onClick={(e) => openWhatsApp(e, selectedCustomerDetail.phone)}
                        className="inline-flex items-center gap-1.5 text-emerald-700 font-bold hover:underline cursor-pointer"
                      >
                        <span className="text-emerald-600"><WhatsAppIcon /></span>
                        {selectedCustomerDetail.phone}
                      </button>
                    ) : '—'}
                  </div>
                  <div><strong>Email:</strong> {selectedCustomerDetail.email || '-'}</div>
                  <div><strong>Alamat Lengkap:</strong> {selectedCustomerDetail.fullAddress || selectedCustomerDetail.address}{selectedCustomerDetail.city ? ` (${selectedCustomerDetail.city})` : ''}</div>
                  <div><strong>Patokan / Landmark:</strong> {selectedCustomerDetail.landmark || '-'}</div>
                  <div><strong>Catatan Khusus:</strong> {selectedCustomerDetail.notes}</div>
                  <div><strong>Terdaftar Pada:</strong> {selectedCustomerDetail.registeredAt || '-'}</div>
                  <div><strong>Terakhir Transaksi:</strong> {(selectedCustomerDetail.trxCount || 0) > 0 ? (selectedCustomerDetail.lastTrx || '-') : '-'}</div>
                  <div><strong>Total Spending:</strong> Rp {(selectedCustomerDetail.totalSpending || 0).toLocaleString('id-ID')}</div>
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
                    Tidak ada catatan komplain. Pelanggan puas dengan layanan Waschen.
                  </div>
                )}
              </div>

              <div className="flex flex-col gap-2">
                <div className="flex justify-between items-center">
                  <span className="text-[10px] font-extrabold text-[#5f1340] uppercase tracking-wider">Riwayat Transaksi Terbaru</span>
                  {selectedCustomerDetail.history && selectedCustomerDetail.history.filter(h => {
                    const ps = h.paymentStatus || h.payment_status;
                    return ps === 'Outstanding' || ps === 'DP' || (Number(h.amount) > Number(h.paidAmount || 0));
                  }).length >= 2 && (
                    <button
                      type="button"
                      onClick={() => setIsCombinedModalOpen(true)}
                      className="inline-flex items-center gap-1.5 px-3 py-1 bg-[#5f1340] hover:bg-[#4d0f33] text-amber-200 text-[10px] font-black rounded-xl shadow-xs cursor-pointer transition-colors"
                      title="Gabungkan pelunasan nota tertunggak dan cetak struk gabungan"
                    >
                      <Receipt className="h-3.5 w-3.5" />
                      <span>Pelunasan Gabungan Nota</span>
                    </button>
                  )}
                </div>
                {isLoadingDetail ? (
                  <div className="p-6 flex items-center justify-center gap-2 text-slate-400 font-bold text-[11px]">
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Memuat riwayat dari transaksi...
                  </div>
                ) : selectedCustomerDetail.history && selectedCustomerDetail.history.length > 0 ? (
                  <div className="space-y-2">
                    {selectedCustomerDetail.history.map((h, idx) => (
                      <button
                        key={h.dbId || h.orderId || idx}
                        type="button"
                        onClick={() => h.orderId && navigate(`/riwayat/${h.orderId}`, { state: { from: '/customer' } })}
                        className="w-full text-left p-3.5 bg-white border border-[#e0e0e0] rounded-2xl flex justify-between items-start gap-3 text-xs shadow-xs hover:border-[#5f1340]/40 hover:bg-[#5f1340]/[0.02] cursor-pointer transition-colors"
                      >
                        <div className="min-w-0">
                          <span className="font-mono font-black text-[#5f1340] text-xs block">{h.orderId}</span>
                          <span className="font-bold text-[#313030] block mt-0.5 truncate">{h.items}</span>
                          <span className="text-[9px] text-slate-400 block mt-0.5">
                            {h.date}
                            {h.paymentStatus ? ` · ${h.paymentStatus}` : ''}
                            {h.workStatus != null && h.workStatus !== '' ? ` · ${formatWorkPercentage(h.workStatus)}` : ''}
                          </span>
                          {(h.branch || h.outletName) && (
                            <span className="inline-flex items-center gap-1 mt-1 text-[10px] font-bold text-[#5f1340] bg-[#5f1340]/5 border border-[#5f1340]/15 px-2 py-0.5 rounded-lg">
                              <MapPin className="h-3 w-3" />
                              {h.branch || h.outletName}
                            </span>
                          )}
                        </div>
                        <span className="font-black text-[#313030] text-xs shrink-0">
                          Rp {(Number(h.amount) || 0).toLocaleString('id-ID')}
                        </span>
                      </button>
                    ))}
                  </div>
                ) : (
                  <div className="p-3 bg-slate-50 border border-slate-200 text-slate-500 rounded-xl text-center font-bold text-[11px]">
                    Belum ada riwayat transaksi tercatat.
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Combined Receipt Modal for Multi-Invoice Settlement */}
      <CombinedReceiptModal
        isOpen={isCombinedModalOpen}
        onClose={() => setIsCombinedModalOpen(false)}
        customer={selectedCustomerDetail}
        outstandingOrders={selectedCustomerDetail?.history || []}
        activeOutletId={activeOutletId}
        activeOutletName={activeOutletName}
        onSuccess={() => {
          // Re-fetch detail for current customer
          if (selectedCustomerDetail?.id) {
            axios.get(`/api/customers/${selectedCustomerDetail.id}`).then((res) => {
              if (res.data && res.data.success) {
                setSelectedCustomerDetail(res.data.data);
              }
            }).catch(() => {});
          }
        }}
      />
    </>
  );
}
