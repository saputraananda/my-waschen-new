import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { formatName } from '../../../utils/FormatName';
import { useAppDialog } from '../../../context/AppDialogContext.jsx';
import {
  CreditCard,
  Users,
  Search,
  Plus,
  ArrowUpRight,
  ArrowDownLeft,
  Award,
  X,
  Sparkles,
  Wallet,
  History,
  Gem,
  Crown
} from 'lucide-react';

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

export default function ListMember({
  members,
  setMembers,
  outlets,
  activeOutletName,
  showToast
}) {
  const { showPrompt } = useAppDialog();
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedTierFilter, setSelectedTierFilter] = useState('Semua');
  const [selectedBranchFilter, setSelectedBranchFilter] = useState(activeOutletName || 'Semua');
  const [membershipPackages, setMembershipPackages] = useState([]);
  const [paymentMethods, setPaymentMethods] = useState([]);

  const [isTopUpModalOpen, setIsTopUpModalOpen] = useState(false);
  const [isMutationModalOpen, setIsMutationModalOpen] = useState(false);
  const [selectedMember, setSelectedMember] = useState(null);

  const [topUpAmount, setTopUpAmount] = useState(100000);
  const [topUpMethod, setTopUpMethod] = useState('QRIS Gopay');
  const [topUpBonus, setTopUpBonus] = useState(10000);

  useEffect(() => {
    if (activeOutletName) {
      setSelectedBranchFilter(activeOutletName);
    }
  }, [activeOutletName]);

  useEffect(() => {
    Promise.all([
      axios.get('/api/memberships/packages'),
      axios.get('/api/masters/payment-methods')
    ])
      .then(([pkgRes, payRes]) => {
        if (pkgRes.data?.success) setMembershipPackages(pkgRes.data.data || []);
        if (payRes.data?.success) {
          const methods = (payRes.data.data || []).filter((m) => !m.requires_member_balance);
          setPaymentMethods(methods);
          if (methods[0]) setTopUpMethod(methods[0].name);
        }
      })
      .catch((err) => console.error('Gagal memuat master membership:', err));
  }, []);

  useEffect(() => {
    if (topUpAmount >= 1000000) {
      setTopUpBonus(120000);
    } else if (topUpAmount >= 500000) {
      setTopUpBonus(50000);
    } else if (topUpAmount >= 200000) {
      setTopUpBonus(15000);
    } else if (topUpAmount >= 100000) {
      setTopUpBonus(5000);
    } else {
      setTopUpBonus(0);
    }
  }, [topUpAmount]);

  const handleTopUpSubmit = async (e) => {
    e.preventDefault();
    if (!selectedMember) return;

    const totalAdded = Number(topUpAmount) + Number(topUpBonus);

    try {
      if (selectedMember.dbId) {
        await axios.post(`/api/customers/${selectedMember.dbId}/deposit`, {
          amount: totalAdded,
          paymentMethod: topUpMethod,
          notes: `Top-Up Saldo via ${topUpMethod}`
        });
      }

      const newMutation = {
        id: `MUT-${Date.now().toString().slice(-4)}`,
        type: 'Top-Up',
        amount: Number(topUpAmount),
        bonus: Number(topUpBonus),
        date: new Date().toLocaleString('id-ID', { dateStyle: 'medium', timeStyle: 'short' }),
        desc: `Top-Up Saldo via ${topUpMethod}`
      };

      setMembers(members.map(m => {
        if (m.id === selectedMember.id) {
          return {
            ...m,
            balance: m.balance + totalAdded,
            totalTopUp: m.totalTopUp + Number(topUpAmount),
            mutations: [newMutation, ...m.mutations]
          };
        }
        return m;
      }));

      showToast('Top-Up Berhasil', `Saldo kartu ${selectedMember.name} bertambah Rp ${totalAdded.toLocaleString('id-ID')}`);
      setIsTopUpModalOpen(false);
    } catch (err) {
      console.error('Gagal topup deposit:', err);
      showToast('Gagal Top-Up', err.response?.data?.message || 'Terjadi kesalahan sistem', 'error');
    }
  };

  const filteredMembers = members.filter(m => {
    const q = searchQuery.toLowerCase();
    const matchesSearch = m.name.toLowerCase().includes(q) ||
      m.phone.includes(q) ||
      (m.cardNumber && m.cardNumber.toLowerCase().includes(q));
    const matchesTier = selectedTierFilter === 'Semua' || m.membershipTier === selectedTierFilter || m.tier === selectedTierFilter;
    const matchesBranch = selectedBranchFilter === 'Semua' ||
      m.homeBranch === selectedBranchFilter ||
      (m.homeBranch && selectedBranchFilter && (
        m.homeBranch.toLowerCase().includes(selectedBranchFilter.toLowerCase()) ||
        selectedBranchFilter.toLowerCase().includes(m.homeBranch.toLowerCase())
      ));
    return matchesSearch && matchesTier && matchesBranch;
  });

  const totalMemberCount = members.length;
  const totalBalanceFloating = members.reduce((sum, m) => sum + m.balance, 0);
  const diamondCount = members.filter(m => m.membershipTier === 'Diamond' || m.tier === 'Diamond').length;
  const goldCount = members.filter(m => m.membershipTier === 'Gold' || m.tier === 'Gold').length;
  const totalTopUpAll = members.reduce((sum, m) => sum + m.totalTopUp, 0);

  return (
    <>
      {/* Metrics Summary Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-gradient-to-tr from-[#420a2c] to-[#5f1340] text-white rounded-2xl p-4 sm:p-5 shadow-md flex flex-col justify-between">
          <span className="text-[10px] uppercase font-bold tracking-widest text-rose-200 block">Total Saldo Member</span>
          <span className="text-xl sm:text-2xl font-black block mt-2 text-amber-300">Rp {totalBalanceFloating.toLocaleString('id-ID')}</span>
          <span className="text-[10px] text-rose-100/80 block mt-2 font-medium">Saldo Mengendap di Kartu</span>
        </div>

        <div className="bg-white border border-[#e0e0e0] rounded-2xl p-4 sm:p-5 shadow-xs flex items-center gap-4">
          <div className="p-3 bg-[#5f1340]/10 text-[#5f1340] rounded-xl">
            <Users className="h-6 w-6" />
          </div>
          <div>
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Member Terdaftar</span>
            <span className="text-lg font-black text-[#313030] block mt-0.5">{totalMemberCount} Member</span>
            <span className="text-[10px] text-slate-400 font-medium">Kartu RFID / ID Aktif</span>
          </div>
        </div>

        <div className="bg-white border border-[#e0e0e0] rounded-2xl p-4 sm:p-5 shadow-xs flex items-center gap-4">
          <div className="p-3 bg-amber-50 text-amber-700 rounded-xl">
            <Award className="h-6 w-6" />
          </div>
          <div>
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Member Diamond / Gold</span>
            <span className="text-lg font-black text-amber-800 block mt-0.5">{diamondCount + goldCount} Orang</span>
            <span className="text-[10px] text-amber-600 font-bold">{diamondCount} Diamond · {goldCount} Gold</span>
          </div>
        </div>

        <div className="bg-white border border-[#e0e0e0] rounded-2xl p-4 sm:p-5 shadow-xs flex items-center gap-4">
          <div className="p-3 bg-emerald-50 text-emerald-700 rounded-xl">
            <ArrowUpRight className="h-6 w-6" />
          </div>
          <div>
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Total Top-Up Masuk</span>
            <span className="text-lg font-black text-emerald-700 block mt-0.5">Rp {totalTopUpAll.toLocaleString('id-ID')}</span>
            <span className="text-[10px] text-emerald-600 font-bold">Akumulasi Deposit</span>
          </div>
        </div>
      </div>

      {/* Filter & Search + Table */}
      <div className="bg-white border border-[#e0e0e0] rounded-3xl p-5 shadow-xs flex flex-col gap-4">
        <div className="grid grid-cols-1 md:grid-cols-12 gap-3 items-center">
          <div className="relative md:col-span-5 flex items-center">
            <Search className="absolute left-3.5 h-4 w-4 text-slate-400 pointer-events-none" />
            <input
              type="text"
              placeholder="Cari nama, No. Kartu (WS-...), atau No HP..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
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
              {outlets.map(o => (
                <option key={o.id} value={o.full_name || o.name}>{o.full_name || o.name}</option>
              ))}
            </select>
          </div>

          <div className="md:col-span-3 flex items-center gap-1 overflow-x-auto no-scrollbar">
            {['Semua', ...membershipPackages.map(p => p.tier)].filter((v, i, a) => a.indexOf(v) === i).map(t => (
              <button
                key={t}
                type="button"
                onClick={() => setSelectedTierFilter(t)}
                className={`flex-1 h-10 px-2 rounded-xl text-[11px] font-black transition-all cursor-pointer whitespace-nowrap ${
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

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="bg-[#f8f8f8] text-slate-400 font-extrabold uppercase text-[10px] border-b border-[#e0e0e0]">
                <th className="py-3 px-4">Kartu & Pelanggan</th>
                <th className="py-3 px-4">Cabang Outlet</th>
                <th className="py-3 px-4 text-center">Paket Member</th>
                <th className="py-3 px-4 text-right">Saldo Kartu Aktif</th>
                <th className="py-3 px-4 text-right">Total Top-Up</th>
                <th className="py-3 px-4 text-center">Masa Berlaku</th>
                <th className="py-3 px-4 text-center">Aksi Transaksi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#e0e0e0]/70 font-semibold">
              {filteredMembers.length > 0 ? (
                filteredMembers.map(m => (
                  <tr key={m.id} className="hover:bg-[#f8f8f8]/60 transition-colors">
                    <td className="py-3.5 px-4">
                      <div className="flex items-center gap-3">
                        <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-[#5f1340] to-[#7d1956] text-white font-black text-xs flex items-center justify-center shadow-xs shrink-0">
                          {m.name.charAt(0).toUpperCase()}
                        </div>
                        <div>
                          <span className="font-extrabold text-[#313030] block text-xs">{formatName(m.name)}</span>
                          <div className="flex items-center gap-2 mt-0.5">
                            <span className="font-mono text-[10px] text-[#5f1340] bg-[#5f1340]/10 px-1.5 py-0.5 rounded font-bold">{m.cardNumber}</span>
                            <span className="text-[10px] text-slate-400">{m.phone}</span>
                          </div>
                        </div>
                      </div>
                    </td>
                    <td className="py-3.5 px-4">
                      <span className="text-slate-600 font-bold block">{m.homeBranch}</span>
                      <span className="text-[10px] text-slate-400">Terdaftar: {m.registeredAt}</span>
                    </td>
                    <td className="py-3.5 px-4 text-center">
                      {renderMembershipBadge(m.membershipTier || m.tier)}
                    </td>
                    <td className="py-3.5 px-4 text-right">
                      <span className="font-black text-sm text-emerald-700 block">
                        Rp {m.balance.toLocaleString('id-ID')}
                      </span>
                      <span className="text-[10px] text-slate-400 font-medium">Terpakai: Rp {m.totalUsage.toLocaleString('id-ID')}</span>
                    </td>
                    <td className="py-3.5 px-4 text-right font-black text-[#5f1340]">
                      Rp {m.totalTopUp.toLocaleString('id-ID')}
                    </td>
                    <td className="py-3.5 px-4 text-center">
                      <span className="text-slate-700 font-bold text-[11px] block">{m.expiryDate}</span>
                      <span className="text-[9px] font-bold text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-full inline-block mt-0.5">Aktif</span>
                    </td>
                    <td className="py-3.5 px-4">
                      <div className="flex items-center justify-center gap-1.5">
                        <button
                          type="button"
                          onClick={() => {
                            setSelectedMember(m);
                            setIsTopUpModalOpen(true);
                          }}
                          className="px-3 py-1.5 bg-[#5f1340] hover:bg-[#4d0f33] text-white font-bold rounded-xl text-[11px] transition-all flex items-center gap-1 cursor-pointer shadow-xs"
                          title="Isi Saldo Kartu Member"
                        >
                          <Plus className="h-3 w-3" />
                          <span>Top-Up</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            setSelectedMember(m);
                            setIsMutationModalOpen(true);
                          }}
                          className="px-2.5 py-1.5 bg-[#f8f8f8] hover:bg-[#e0e0e0] border border-[#e0e0e0] text-slate-700 font-bold rounded-xl text-[11px] transition-all flex items-center gap-1 cursor-pointer"
                          title="Lihat Riwayat Mutasi Saldo"
                        >
                          <History className="h-3 w-3 text-slate-500" />
                          <span>Mutasi</span>
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan="7" className="py-12 text-center text-slate-400">
                    <CreditCard className="h-10 w-10 mx-auto text-slate-300 mb-2" />
                    <p className="font-bold text-xs text-[#313030]">Tidak ada data member yang sesuai</p>
                    <p className="text-[11px] mt-0.5">Silakan sesuaikan filter cabang atau kata kunci pencarian</p>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* MODAL: TOP-UP SALDO KARTU */}
      {isTopUpModalOpen && selectedMember && (
        <div className="fixed inset-0 z-50 bg-[#313030]/60 backdrop-blur-xs flex justify-center items-center p-4">
          <div className="bg-white rounded-3xl border border-[#e0e0e0] w-full max-w-md shadow-2xl overflow-hidden animate-fade-in">
            <div className="p-5 border-b border-[#e0e0e0] flex justify-between items-center bg-[#f8f8f8]">
              <div className="flex items-center gap-2.5">
                <div className="p-2 bg-[#5f1340]/10 text-[#5f1340] rounded-xl">
                  <Wallet className="h-5 w-5" />
                </div>
                <div>
                  <h3 className="text-sm font-black text-[#313030]">Top-Up Saldo Kartu Member</h3>
                  <p className="text-[10px] text-slate-400">{selectedMember.cardNumber} &bull; {selectedMember.name}</p>
                </div>
              </div>
              <button type="button" onClick={() => setIsTopUpModalOpen(false)} className="p-1 text-slate-400 hover:text-[#313030]">
                <X className="h-5 w-5" />
              </button>
            </div>

            <form onSubmit={handleTopUpSubmit} className="p-6 flex flex-col gap-4">
              <div className="p-4 bg-gradient-to-r from-[#5f1340]/10 via-[#5f1340]/5 to-transparent border border-[#5f1340]/20 rounded-2xl flex justify-between items-center">
                <div>
                  <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block">Saldo Saat Ini</span>
                  <span className="text-xs font-extrabold text-[#313030]">{selectedMember.name}</span>
                </div>
                <span className="text-lg font-black text-[#5f1340]">Rp {selectedMember.balance.toLocaleString('id-ID')}</span>
              </div>

              <div>
                <label className="text-[11px] font-bold text-slate-500 uppercase tracking-wider block mb-2">Pilih Nominal Top-Up</label>
                <div className="grid grid-cols-3 gap-2">
                  {[100000, 200000, 500000, 1000000, 2000000].map(amt => (
                    <button
                      key={amt}
                      type="button"
                      onClick={() => setTopUpAmount(amt)}
                      className={`py-2 px-2 rounded-xl text-xs font-black transition-all cursor-pointer ${
                        topUpAmount === amt
                          ? 'bg-[#5f1340] text-white shadow-xs'
                          : 'bg-[#f8f8f8] text-slate-700 border border-[#e0e0e0] hover:bg-slate-100'
                      }`}
                    >
                      Rp {(amt / 1000).toLocaleString('id-ID')}k
                    </button>
                  ))}
                  <button
                    type="button"
                    onClick={async () => {
                      const custom = await showPrompt({
                        title: 'Nominal Top-Up Custom',
                        message: 'Masukkan nominal top-up saldo member (Rp).',
                        defaultValue: '300000',
                        placeholder: '300000',
                        inputLabel: 'Nominal (Rp)',
                        submitLabel: 'Gunakan',
                        inputMode: 'numeric'
                      });
                      if (custom) setTopUpAmount(Number(custom.replace(/\D/g, '')) || 100000);
                    }}
                    className="py-2 px-2 bg-[#f8f8f8] hover:bg-slate-100 border border-[#e0e0e0] text-slate-700 font-bold rounded-xl text-xs"
                  >
                    Custom
                  </button>
                </div>
              </div>

              {topUpBonus > 0 && (
                <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl flex items-center justify-between text-xs">
                  <div className="flex items-center gap-1.5 text-amber-900 font-bold">
                    <Sparkles className="h-4 w-4 text-amber-600" />
                    <span>Bonus Deposit:</span>
                  </div>
                  <span className="font-black text-amber-900">+ Rp {topUpBonus.toLocaleString('id-ID')}</span>
                </div>
              )}

              <div>
                <label className="text-[11px] font-bold text-slate-500 uppercase tracking-wider block mb-1.5">Metode Pembayaran</label>
                <select
                  value={topUpMethod}
                  onChange={(e) => setTopUpMethod(e.target.value)}
                  className="w-full px-3 py-2.5 bg-white border border-[#e0e0e0] rounded-xl text-xs font-bold text-[#313030] outline-none focus:border-[#5f1340]"
                >
                  {paymentMethods.map((m) => (
                    <option key={m.id} value={m.name}>{m.label}</option>
                  ))}
                </select>
              </div>

              <div className="pt-3 border-t border-[#e0e0e0] flex justify-between items-center text-sm font-black">
                <span>Total Masuk ke Saldo:</span>
                <span className="text-[#5f1340] text-base">Rp {(Number(topUpAmount) + Number(topUpBonus)).toLocaleString('id-ID')}</span>
              </div>

              <button
                type="submit"
                className="w-full py-3.5 mt-2 bg-gradient-to-r from-[#5f1340] to-[#7d1956] hover:from-[#4d0f33] hover:to-[#6a1549] text-white font-black text-xs rounded-2xl shadow-md shadow-[#5f1340]/20 transition-all cursor-pointer"
              >
                Konfirmasi & Simpan Top-Up
              </button>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: RIWAYAT MUTASI SALDO */}
      {isMutationModalOpen && selectedMember && (
        <div className="fixed inset-0 z-50 bg-[#313030]/60 backdrop-blur-xs flex justify-center items-center p-4">
          <div className="bg-white rounded-3xl border border-[#e0e0e0] w-full max-w-lg shadow-2xl overflow-hidden animate-fade-in">
            <div className="p-5 border-b border-[#e0e0e0] flex justify-between items-center bg-[#f8f8f8]">
              <div className="flex items-center gap-2.5">
                <div className="p-2 bg-[#5f1340]/10 text-[#5f1340] rounded-xl">
                  <History className="h-5 w-5" />
                </div>
                <div>
                  <h3 className="text-sm font-black text-[#313030]">Riwayat Mutasi Saldo Kartu</h3>
                  <p className="text-[10px] text-slate-400">{selectedMember.cardNumber} &bull; {selectedMember.name}</p>
                </div>
              </div>
              <button type="button" onClick={() => setIsMutationModalOpen(false)} className="p-1 text-slate-400 hover:text-[#313030]">
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="p-6 flex flex-col gap-4">
              <div className="p-4 bg-[#f8f8f8] border border-[#e0e0e0] rounded-2xl flex justify-between items-center">
                <div>
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Saldo Aktif Saat Ini</span>
                  <span className="text-base font-black text-[#5f1340]">Rp {selectedMember.balance.toLocaleString('id-ID')}</span>
                </div>
                {renderMembershipBadge(selectedMember.membershipTier || selectedMember.tier)}
              </div>

              <div className="space-y-2.5 max-h-[300px] overflow-y-auto pr-1">
                {selectedMember.mutations && selectedMember.mutations.length > 0 ? (
                  selectedMember.mutations.map((mut) => (
                    <div key={mut.id} className="p-3 border border-[#e0e0e0] rounded-xl flex items-center justify-between text-xs hover:bg-[#f8f8f8] transition-colors">
                      <div className="flex items-center gap-3">
                        <div className={`w-8 h-8 rounded-lg flex items-center justify-center font-black ${
                          mut.type === 'Top-Up' ? 'bg-emerald-50 text-emerald-700' : 'bg-rose-50 text-rose-700'
                        }`}>
                          {mut.type === 'Top-Up' ? <ArrowUpRight className="h-4 w-4" /> : <ArrowDownLeft className="h-4 w-4" />}
                        </div>
                        <div>
                          <span className="font-bold text-[#313030] block">{mut.desc}</span>
                          <span className="text-[10px] text-slate-400 block">{mut.date}</span>
                        </div>
                      </div>
                      <span className={`font-black ${mut.type === 'Top-Up' ? 'text-emerald-700' : 'text-rose-700'}`}>
                        {mut.type === 'Top-Up' ? `+ Rp ${(mut.amount + (mut.bonus || 0)).toLocaleString('id-ID')}` : `- Rp ${Math.abs(mut.amount).toLocaleString('id-ID')}`}
                      </span>
                    </div>
                  ))
                ) : (
                  <p className="text-center text-xs text-slate-400 py-6">Belum ada catatan mutasi transaksi</p>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
