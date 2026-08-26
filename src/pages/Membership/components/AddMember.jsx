import React, { useState, useEffect, useMemo, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import {
  ArrowLeft,
  CreditCard,
  RotateCcw,
  Save,
  UserCheck,
  Search,
  CheckCircle2,
  Plus,
  Crown,
  Gem,
  Wallet,
  Sparkles,
  X
} from 'lucide-react';
import CascadingPaymentSelector, { resolvePaymentMethodString } from '../../../components/CascadingPaymentSelector.jsx';
import WaschenMemberCard from '../../../components/WaschenMemberCard.jsx';
import MemberExclusiveBenefits from '../../../components/MemberExclusiveBenefits.jsx';
import { formatName } from '../../../utils/FormatName.js';

export default function AddMember({
  outlets,
  activeOutletName,
  showToast,
  onMemberRegistered,
  onSwitchToCatalog
}) {
  const navigate = useNavigate();
  const dropdownRef = useRef(null);
  const [packages, setPackages] = useState([]);
  const [paymentMethods, setPaymentMethods] = useState([]);
  const [customersList, setCustomersList] = useState([]);
  const [customerSearch, setCustomerSearch] = useState('');
  const [selectedCustId, setSelectedCustId] = useState('');
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const [showAllCustomers, setShowAllCustomers] = useState(false);
  const [selectedBranchFilter, setSelectedBranchFilter] = useState(
    activeOutletName || localStorage.getItem('activeOutletName') || 'Semua'
  );
  const [selectedSpendingTier, setSelectedSpendingTier] = useState('Semua');

  const [packageId, setPackageId] = useState('');
  const [mainCategory, setMainCategory] = useState('Tunai');
  const [edcCardType, setEdcCardType] = useState('Debit Card');
  const [isCrossTransfer, setIsCrossTransfer] = useState(false);
  const [crossBankOutletId, setCrossBankOutletId] = useState(1);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    const handleClickOutside = (e) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target)) {
        setIsDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  useEffect(() => {
    Promise.all([
      axios.get('/api/memberships/packages'),
      axios.get('/api/masters/payment-methods'),
      axios.get('/api/customers')
    ])
      .then(([pkgRes, payRes, custRes]) => {
        if (pkgRes.data?.success && pkgRes.data.data?.length > 0) {
          const list = pkgRes.data.data;
          setPackages(list);
          setPackageId(list[0].id);
        }
        if (payRes.data?.success) {
          setPaymentMethods(payRes.data.data || []);
        }
        if (custRes.data?.success && Array.isArray(custRes.data.data)) {
          setCustomersList(custRes.data.data);
        }
      })
      .catch((err) => console.error('Gagal memuat master membership/customer:', err));
  }, []);

  useEffect(() => {
    if (activeOutletName) {
      setSelectedBranchFilter(activeOutletName);
    }
  }, [activeOutletName]);

  useEffect(() => {
    setShowAllCustomers(false);
  }, [customerSearch, selectedSpendingTier, selectedBranchFilter]);

  const selectedCustomer = useMemo(() => {
    return customersList.find((c) => String(c.id) === String(selectedCustId));
  }, [customersList, selectedCustId]);

  const selectedPackage = useMemo(() => {
    return packages.find((p) => String(p.id) === String(packageId)) || packages[0];
  }, [packages, packageId]);

  const filteredCustomers = useMemo(() => {
    return customersList.filter((c) => {
      const q = customerSearch.toLowerCase();
      const matchesSearch =
        !q ||
        (c.name || '').toLowerCase().includes(q) ||
        (c.phone || '').includes(q) ||
        (c.customer_code || '').toLowerCase().includes(q);

      const customerTier = String(c.tier || c.spending_tier || 'One-Time');
      const matchesTier =
        selectedSpendingTier === 'Semua' ||
        customerTier.toLowerCase() === selectedSpendingTier.toLowerCase() ||
        (c.spending_tier_code || '').toLowerCase().includes(selectedSpendingTier.toLowerCase());

      let matchesBranch = true;
      if (selectedBranchFilter && selectedBranchFilter !== 'Semua') {
        const custBranch = c.home_branch || c.homeBranch || '';
        const filterClean = selectedBranchFilter
          .toLowerCase()
          .replace('waschen laundry ', '')
          .replace('outlet ', '')
          .trim();
        const custBranchClean = custBranch
          .toLowerCase()
          .replace('waschen laundry ', '')
          .replace('outlet ', '')
          .trim();
        matchesBranch =
          !custBranch ||
          custBranch === selectedBranchFilter ||
          (custBranchClean.length > 0 &&
            filterClean.length > 0 &&
            (custBranchClean.includes(filterClean) || filterClean.includes(custBranchClean)));
      }

      return matchesSearch && matchesTier && matchesBranch;
    });
  }, [customersList, customerSearch, selectedSpendingTier, selectedBranchFilter]);

  const displayedCustomers = useMemo(() => {
    return showAllCustomers ? filteredCustomers : filteredCustomers.slice(0, 4);
  }, [filteredCustomers, showAllCustomers]);

  const renderSpendingTierBadge = (spendingTier) => {
    const clean = String(spendingTier || 'One-Time').trim();
    if (/vip/i.test(clean)) {
      return (
        <span className="px-2 py-0.5 bg-purple-50 text-purple-800 border border-purple-200 text-[9px] font-black rounded-full uppercase tracking-wider shrink-0">
          VIP
        </span>
      );
    }
    if (/gold/i.test(clean)) {
      return (
        <span className="px-2 py-0.5 bg-amber-50 text-amber-800 border border-amber-200 text-[9px] font-black rounded-full uppercase tracking-wider shrink-0">
          Gold
        </span>
      );
    }
    if (/reguler/i.test(clean)) {
      return (
        <span className="px-2 py-0.5 bg-blue-50 text-blue-800 border border-blue-200 text-[9px] font-black rounded-full uppercase tracking-wider shrink-0">
          Reguler
        </span>
      );
    }
    return (
      <span className="px-2 py-0.5 bg-slate-100 text-slate-600 border border-slate-200 text-[9px] font-black rounded-full uppercase tracking-wider shrink-0">
        One-Time
      </span>
    );
  };

  const handleRegisterMember = async (e) => {
    e.preventDefault();
    if (!selectedCustId || !selectedCustomer) {
      showToast('Pilih Pelanggan', 'Silakan pilih pelanggan terdaftar dari mst_customer terlebih dahulu!', 'error');
      return;
    }

    if (!selectedPackage) {
      showToast('Pilih Paket', 'Silakan pilih paket membership yang valid!', 'error');
      return;
    }

    const resolvedPaymentMethod = resolvePaymentMethodString({
      mainCategory,
      edcCardType,
      isCrossTransfer,
      crossBankOutletId,
      activeOutletId: localStorage.getItem('activeOutletId') || 2,
      activeOutletName: localStorage.getItem('activeOutletName') || 'Waschen Laundry Citra Gran',
      outlets
    });

    setIsSubmitting(true);
    try {
      const memRes = await axios.post('/api/memberships', {
        customerId: selectedCustomer.id,
        packageId: selectedPackage.id,
        outletId: parseInt(localStorage.getItem('activeOutletId')) || 2,
        paymentMethod: resolvedPaymentMethod,
        cashierEmployeeId: localStorage.getItem('employeeId') || null
      });

      if (memRes.data?.success) {
        showToast('Member Berhasil Diaktifkan', memRes.data.message || `${selectedCustomer.name} — Paket ${selectedPackage.name} aktif!`);
        onMemberRegistered();
        setTimeout(() => onSwitchToCatalog(), 1000);
      } else {
        showToast('Gagal Aktivasi Paket', memRes.data?.message || 'Terjadi kesalahan sistem', 'error');
      }
    } catch (err) {
      console.error('Gagal register member:', err);
      showToast('Gagal Aktivasi Paket', err.response?.data?.message || 'Koneksi server gagal', 'error');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <form onSubmit={handleRegisterMember} className="flex flex-col gap-6 bg-white border border-[#e0e0e0] rounded-3xl p-6 shadow-xs">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between border-b border-[#e0e0e0] pb-4 gap-3">
        <div className="flex items-center gap-3">
          <div className="p-3 bg-[#5f1340]/10 text-[#5f1340] rounded-2xl">
            <CreditCard className="h-6 w-6" />
          </div>
          <div>
            <h2 className="text-lg font-black text-[#313030]">Aktivasi Paket Membership Member</h2>
            <p className="text-xs text-slate-400">Pilih pelanggan terdaftar dari database mst_customer & setorkan nominal pas paket deposit</p>
          </div>
        </div>

        <button
          type="button"
          onClick={() => navigate(-1)}
          className="flex items-center gap-2 px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-extrabold rounded-xl text-xs transition-colors cursor-pointer self-start sm:self-auto"
        >
          <ArrowLeft className="h-4 w-4" />
          <span>Kembali</span>
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Step 1: Customer Selector UX */}
        <div className="p-5 border border-[#e0e0e0] rounded-2xl bg-[#f8f8f8]/50 flex flex-col gap-4 self-start w-full">
          <div className="flex items-center justify-between border-b border-[#e0e0e0] pb-2">
            <div className="flex items-center gap-2 text-[#5f1340] font-black text-xs uppercase tracking-wider">
              <UserCheck className="h-4 w-4" />
              <span>1. Identitas Member (Pilih Customer Terdaftar)</span>
            </div>
            <button
              type="button"
              onClick={() => navigate('/customer', { state: { tab: 'add', from: '/membership' } })}
              className="text-[10px] font-black text-[#5f1340] hover:underline flex items-center gap-1 cursor-pointer"
            >
              <Plus className="h-3.5 w-3.5" />
              <span>Registrasi Pelanggan Baru</span>
            </button>
          </div>

          {!selectedCustomer ? (
            <div className="flex flex-col gap-3">
              <div>
                <label className="text-[11px] font-black text-slate-700 block mb-1.5">
                  Cari & Pilih Pelanggan *
                </label>
                <div className="relative">
                  <Search className="absolute left-3.5 top-3.5 h-4 w-4 text-slate-400 pointer-events-none" />
                  <input
                    type="text"
                    placeholder="Ketik nama pelanggan atau nomor HP..."
                    value={customerSearch}
                    onChange={(e) => setCustomerSearch(e.target.value)}
                    className="w-full pl-10 pr-9 py-3 bg-white border border-[#e0e0e0] rounded-xl text-xs font-bold outline-none focus:border-[#5f1340] focus:ring-2 focus:ring-[#5f1340]/10 shadow-xs"
                  />
                  {customerSearch && (
                    <button
                      type="button"
                      onClick={() => setCustomerSearch('')}
                      className="absolute right-3 top-3 text-slate-400 hover:text-slate-600 cursor-pointer"
                    >
                      <X className="h-4 w-4" />
                    </button>
                  )}
                </div>
              </div>

              {/* Branch Filter — default cabang login */}
              <div>
                <span className="text-[10px] uppercase tracking-wider font-extrabold text-slate-400 block mb-1.5">Filter Cabang:</span>
                <select
                  value={selectedBranchFilter}
                  onChange={(e) => setSelectedBranchFilter(e.target.value)}
                  className="w-full h-10 px-3 bg-white border border-[#e0e0e0] rounded-xl text-xs font-semibold text-[#313030] outline-none focus:border-[#5f1340] focus:ring-2 focus:ring-[#5f1340]/10 cursor-pointer shadow-xs"
                >
                  <option value="Semua">Semua Cabang Outlet</option>
                  {(outlets || []).map((o) => (
                    <option key={o.id} value={o.full_name || o.name}>
                      {o.full_name || o.name}
                    </option>
                  ))}
                </select>
              </div>

              {/* Spending Tier Filter Tabs */}
              <div>
                <span className="text-[10px] uppercase tracking-wider font-extrabold text-slate-400 block mb-1.5">Filter Tier Spending Pelanggan:</span>
                <div className="flex flex-wrap gap-1.5">
                  {['Semua', 'VIP', 'Gold', 'Reguler', 'One-Time'].map((tierName) => {
                    const isSelected = selectedSpendingTier === tierName;
                    return (
                      <button
                        key={tierName}
                        type="button"
                        onClick={() => setSelectedSpendingTier(tierName)}
                        className={`px-3 py-1.5 rounded-xl text-[11px] font-extrabold transition-all cursor-pointer ${
                          isSelected
                            ? 'bg-[#5f1340] text-white shadow-xs'
                            : 'bg-white text-slate-600 border border-[#e0e0e0] hover:bg-slate-100'
                        }`}
                      >
                        {tierName}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Customer Cards Grid — tanpa max-height agar card tidak terpotong */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5 pt-1 content-start">
                {displayedCustomers.length > 0 ? (
                  displayedCustomers.map((c) => (
                    <div
                      key={c.id}
                      onClick={() => setSelectedCustId(c.id)}
                      className="group relative bg-white border border-[#e0e0e0] hover:border-[#5f1340] rounded-2xl p-3.5 shadow-2xs hover:shadow-md transition-all cursor-pointer flex flex-col justify-between shrink-0 min-h-[108px]"
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex items-center gap-2.5 min-w-0">
                          <div className="h-9 w-9 rounded-full bg-[#5f1340]/10 text-[#5f1340] font-black text-xs flex items-center justify-center shrink-0">
                            {c.name ? c.name.charAt(0).toUpperCase() : 'C'}
                          </div>
                          <div className="min-w-0">
                            <h4 className="font-black text-xs text-[#313030] group-hover:text-[#5f1340] truncate">
                              {formatName(c.name)}
                            </h4>
                            <span className="text-[10px] text-slate-400 block truncate">
                              {c.phone}
                            </span>
                          </div>
                        </div>

                        {/* Spending Tier Badge */}
                        {renderSpendingTierBadge(c.tier || c.spending_tier || 'One-Time')}
                      </div>

                      <div className="mt-3 pt-2.5 border-t border-slate-100 text-[10px]">
                        <span className="text-slate-400 block">Saldo Deposit:</span>
                        <span className="font-black text-emerald-700 text-xs">
                          Rp {parseFloat(c.deposit_balance || 0).toLocaleString('id-ID')}
                        </span>
                      </div>
                    </div>
                  ))
                ) : (
                  <div className="col-span-full p-8 text-center bg-white border border-dashed border-[#e0e0e0] rounded-2xl">
                    <p className="text-xs font-bold text-slate-500">Tidak ada pelanggan pada tier/pencarian ini.</p>
                    <button
                      type="button"
                      onClick={() => navigate('/customer', { state: { tab: 'add', from: '/membership' } })}
                      className="mt-2 text-xs font-black text-[#5f1340] hover:underline inline-flex items-center gap-1 cursor-pointer"
                    >
                      <Plus className="h-3.5 w-3.5" />
                      <span>Registrasi Pelanggan Baru</span>
                    </button>
                  </div>
                )}
              </div>

              {/* Show More / Hide Customers Button */}
              {filteredCustomers.length > 4 && (
                <button
                  type="button"
                  onClick={() => setShowAllCustomers(!showAllCustomers)}
                  className="w-full py-2.5 bg-slate-50 hover:bg-slate-100 border border-[#e0e0e0] text-slate-700 text-xs font-black rounded-xl cursor-pointer transition-colors flex items-center justify-center gap-1.5 shadow-2xs mt-1"
                >
                  <span>{showAllCustomers ? 'Sembunyikan Pelanggan' : `Tampilkan ${filteredCustomers.length - 4} Pelanggan Lainnya`}</span>
                </button>
              )}
            </div>
          ) : (
            <>
              {/* Selected Customer Summary Card */}
              <div className="p-5 bg-gradient-to-r from-emerald-50 via-teal-50/50 to-emerald-50/30 border border-emerald-300 rounded-2xl flex flex-col gap-3 shadow-xs">
                <div className="flex justify-between items-start">
                  <div className="flex items-center gap-3">
                    <div className="p-2.5 bg-emerald-600 text-white rounded-xl shadow-xs shrink-0">
                      <UserCheck className="h-5 w-5" />
                    </div>
                    <div>
                      <span className="text-[10px] uppercase tracking-wider font-extrabold text-emerald-800 block">Pelanggan Terpilih</span>
                      <h4 className="text-sm font-black text-[#313030]">{formatName(selectedCustomer.name)}</h4>
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={() => setSelectedCustId('')}
                    className="px-3 py-1.5 bg-white border border-emerald-300 hover:bg-emerald-100 text-emerald-800 font-extrabold rounded-xl text-xs transition-colors flex items-center gap-1.5 cursor-pointer shadow-2xs shrink-0"
                  >
                    <RotateCcw className="h-3.5 w-3.5" />
                    <span>Ganti Pelanggan</span>
                  </button>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs pt-3 border-t border-emerald-200/80">
                  <div>
                    <span className="text-[10px] text-slate-500 block font-bold">Nomor HP / WhatsApp:</span>
                    <span className="font-black text-slate-800">{selectedCustomer.phone}</span>
                  </div>
                  <div>
                    <span className="text-[10px] text-slate-500 block font-bold">Saldo Deposit saat ini:</span>
                    <span className="font-black text-emerald-700 text-sm">Rp {parseFloat(selectedCustomer.deposit_balance || 0).toLocaleString('id-ID')}</span>
                  </div>
                </div>
              </div>

              {/* Exclusive Benefits Display Panel */}
              <MemberExclusiveBenefits tier={selectedPackage?.tier || 'Gold'} className="mt-3" />
            </>
          )}
        </div>

        {/* Step 2: Package & Payment */}
        <div className="p-5 border border-[#e0e0e0] rounded-2xl bg-[#f8f8f8]/50 flex flex-col gap-4">
          <div className="flex items-center gap-2 border-b border-[#e0e0e0] pb-2 text-[#5f1340] font-black text-xs uppercase tracking-wider">
            <CreditCard className="h-4 w-4" />
            <span>2. Paket Membership & Pembayaran</span>
          </div>

          <div className="flex flex-col gap-1">
            <label className="text-[11px] font-black text-slate-700">Pilih Paket Membership</label>
            <select
              value={packageId}
              onChange={(e) => setPackageId(e.target.value)}
              className="p-3 border border-[#e0e0e0] rounded-xl bg-white text-xs font-bold outline-none focus:border-[#5f1340] cursor-pointer"
              disabled={packages.length === 0}
            >
              {packages.map((pkg) => (
                <option key={pkg.id} value={pkg.id}>
                  {pkg.name} ({pkg.tier} — Rp {Number(pkg.top_up_amount).toLocaleString('id-ID')})
                </option>
              ))}
            </select>
          </div>

          {/* Waschen Member Card Graphic Display */}
          <div className="my-1 flex flex-col gap-2">
            <label className="text-[11px] font-black text-slate-700 block">Pratinjau Kartu Member & Nominal Top-Up</label>
            <WaschenMemberCard
              tier={selectedPackage?.tier || 'Gold'}
              memberName={selectedCustomer?.name ? formatName(selectedCustomer.name) : 'NAMA PELANGGAN'}
              customerCode={selectedCustomer?.customer_code || '2600604'}
              topUpAmount={selectedPackage ? Number(selectedPackage.top_up_amount) : 500000}
              validityDays={selectedPackage?.validity_days || 180}
            />

            {/* Bonus Deposit Breakdown Banner */}
            <div className={`p-3 rounded-xl border flex flex-col sm:flex-row items-center justify-between gap-2 text-xs font-bold shadow-2xs ${
              selectedPackage?.tier === 'Diamond'
                ? 'bg-gradient-to-r from-cyan-50 via-sky-50 to-cyan-50 border-cyan-300 text-cyan-950'
                : 'bg-gradient-to-r from-amber-50 via-yellow-50 to-amber-50 border-amber-300 text-amber-950'
            }`}>
              <div className="flex items-center gap-2">
                <Sparkles className={`h-4 w-4 shrink-0 ${selectedPackage?.tier === 'Diamond' ? 'text-cyan-600' : 'text-amber-600'}`} />
                <span>
                  Deposit <strong>Rp {Number(selectedPackage?.top_up_amount || 500000).toLocaleString('id-ID')}</strong> + <span className="text-emerald-700 font-extrabold">Bonus Saldo +Rp {(selectedPackage?.tier === 'Diamond' ? 50000 : 25000).toLocaleString('id-ID')}</span>
                </span>
              </div>
              <div className="px-3 py-1 bg-white rounded-lg border border-slate-200 shadow-2xs text-[#313030] flex items-center gap-1.5 shrink-0">
                <span className="text-[10px] text-slate-400 font-bold uppercase">Total Saldo:</span>
                <span className="font-black text-emerald-600 text-xs sm:text-sm">
                  Rp {(Number(selectedPackage?.top_up_amount || 500000) + (selectedPackage?.tier === 'Diamond' ? 50000 : 25000)).toLocaleString('id-ID')}
                </span>
              </div>
            </div>
          </div>

          {/* Cascading Payment Selector */}
          <div className="pt-2">
            <CascadingPaymentSelector
              mainCategory={mainCategory}
              setMainCategory={setMainCategory}
              edcCardType={edcCardType}
              setEdcCardType={setEdcCardType}
              isCrossTransfer={isCrossTransfer}
              setIsCrossTransfer={setIsCrossTransfer}
              crossBankOutletId={crossBankOutletId}
              setCrossBankOutletId={setCrossBankOutletId}
              activeOutletId={localStorage.getItem('activeOutletId') || 2}
              activeOutletName={activeOutletName}
              outlets={outlets}
              paymentMethods={paymentMethods}
              selectedCustomer={selectedCustomer}
              grandTotal={selectedPackage ? Number(selectedPackage.top_up_amount) : 500000}
            />
          </div>

          <div className="flex items-center gap-3 pt-4 border-t border-[#e0e0e0] mt-auto">
            <button
              type="submit"
              disabled={isSubmitting || !selectedCustId}
              className="flex-1 py-3.5 bg-gradient-to-r from-[#5f1340] to-[#7d1956] hover:opacity-95 text-white font-black rounded-2xl text-xs shadow-lg shadow-[#5f1340]/25 transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
            >
              <Save className="h-4 w-4" />
              <span>{isSubmitting ? 'Memproses...' : 'Simpan & Aktifkan Member'}</span>
            </button>
          </div>
        </div>
      </div>
    </form>
  );
}
