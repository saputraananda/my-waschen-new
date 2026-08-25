import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import { formatName, formatEmployeeName } from '../../../utils/FormatName';
import { formatRupiah, parseRupiah } from '../../../utils/FormatRupiah';
import { useAppDialog } from '../../../context/AppDialogContext.jsx';
import { getWorkPercentage, percentageTone, formatWorkPercentage, matchesWorkStatusTab } from '../../../utils/workStatusMeta.js';
import {
  Search,
  Printer,
  CheckCircle2,
  AlertCircle,
  Truck,
  X,
  Trash2,
  RotateCcw,
  CreditCard,
  Upload,
  Wallet,
  Coins,
  History
} from 'lucide-react';
import CascadingPaymentSelector, { resolvePaymentMethodString } from '../../../components/CascadingPaymentSelector.jsx';

export default function HistoryTransaction({
  transactions,
  setTransactions,
  outlets,
  showToast,
  fetchTransactions
}) {
  const navigate = useNavigate();
  const { showAlert } = useAppDialog();

  // Search & Filter States
  const [searchQuery, setSearchQuery] = useState('');
  const [paymentFilter, setPaymentFilter] = useState('Semua'); // Semua | Lunas | DP | Outstanding | Sisa Tagihan
  const [activeFilterTab, setActiveFilterTab] = useState('Semua'); // Status Workflow Tab
  const [selectedBranchFilter, setSelectedBranchFilter] = useState(localStorage.getItem('activeOutletName') || 'Semua');
  const [dateFilter, setDateFilter] = useState(''); // YYYY-MM-DD string
  const [workStatusTabs, setWorkStatusTabs] = useState([]);

  useEffect(() => {
    axios.get('/api/masters/work-statuses?filter_tabs=1')
      .then((res) => {
        if (res.data?.success) {
          setWorkStatusTabs((res.data.data || []).map((s) => s.label || s.name));
        }
      })
      .catch((err) => console.error('Gagal memuat work status:', err));
  }, []);

  // Modals
  const [selectedReceipt, setSelectedReceipt] = useState(null);
  const [deleteModalOrder, setDeleteModalOrder] = useState(null);
  const [deleteReason, setDeleteReason] = useState('');
  const [isSubmittingDelete, setIsSubmittingDelete] = useState(false);

  // Payment update modal
  const [paymentModalOrder, setPaymentModalOrder] = useState(null);
  const [paymentDetail, setPaymentDetail] = useState(null);
  const [paymentMethods, setPaymentMethods] = useState([]);
  const [mainCategory, setMainCategory] = useState('Tunai');
  const [edcCardType, setEdcCardType] = useState('Debit Card');
  const [isCrossTransfer, setIsCrossTransfer] = useState(false);
  const [crossBankOutletId, setCrossBankOutletId] = useState(1);
  const [paymentForm, setPaymentForm] = useState({
    additionalAmount: '',
    notes: '',
    overpaymentAction: 'change'
  });
  const [proofFile, setProofFile] = useState(null);
  const [isSubmittingPayment, setIsSubmittingPayment] = useState(false);
  const [isLoadingPayment, setIsLoadingPayment] = useState(false);

  const normalizePaymentStatus = (status) => {
    if (status === 'Belum Lunas') return 'Outstanding';
    return status || 'Outstanding';
  };

  const matchesPaymentFilter = (order) => {
    const ps = normalizePaymentStatus(order.paymentStatus);
    if (paymentFilter === 'Semua') return true;
    if (paymentFilter === 'Lunas') return ps === 'Lunas';
    if (paymentFilter === 'DP') return ps === 'DP';
    if (paymentFilter === 'Outstanding') return ps === 'Outstanding';
    if (paymentFilter === 'Sisa Tagihan') return ps !== 'Lunas';
    return true;
  };

  // WhatsApp Helper
  const handleOpenWA = (e, order) => {
    if (e) e.stopPropagation();
    let rawPhone = (order.customerPhone || '').replace(/[^0-9]/g, '');
    if (rawPhone.startsWith('0')) {
      rawPhone = '62' + rawPhone.slice(1);
    }
    if (!rawPhone) rawPhone = '628123456789';
    const message = encodeURIComponent(`Halo Kak ${order.customerName || 'Pelanggan'}, update status pengerjaan nota ${order.id} Anda saat ini: ${formatWorkPercentage(order.progressStatus ?? order.workStatus)}. Terima kasih telah mempercayakan Waschen Laundry! 😊`);
    window.open(`https://wa.me/${rawPhone}?text=${message}`, '_blank');
  };

  const openPaymentModal = async (order, e) => {
    if (e) e.stopPropagation();
    setPaymentModalOrder(order);
    setMainCategory('Tunai');
    setEdcCardType('Debit Card');
    setIsCrossTransfer(false);
    setCrossBankOutletId(1);
    setPaymentForm({
      additionalAmount: '',
      notes: '',
      overpaymentAction: 'change'
    });
    setProofFile(null);
    setIsLoadingPayment(true);
    try {
      const [logsRes, methodsRes] = await Promise.all([
        axios.get(`/api/history/transactions/${order.dbId || order.id}/payments`),
        axios.get('/api/masters/payment-methods')
      ]);
      if (logsRes.data?.success) setPaymentDetail(logsRes.data.data);
      if (methodsRes.data?.success) {
        setPaymentMethods(methodsRes.data.data || []);
      }
    } catch (err) {
      console.error('Gagal memuat detail pembayaran:', err);
      showToast('Gagal Memuat', err.response?.data?.message || 'Tidak dapat memuat riwayat pembayaran', 'error');
    } finally {
      setIsLoadingPayment(false);
    }
  };

  const handleSubmitPaymentUpdate = async () => {
    if (!paymentModalOrder) return;
    const remaining = paymentDetail?.remaining ?? Math.max(0, (paymentModalOrder.grandTotal || 0) - (paymentModalOrder.paidAmount || 0));
    const addAmount = parseRupiah(paymentForm.additionalAmount);

    if (normalizePaymentStatus(paymentModalOrder.paymentStatus) === 'Lunas') {
      showToast('Sudah Lunas', 'Nota ini sudah lunas.', 'error');
      return;
    }
    if (addAmount <= 0) {
      showAlert({
        title: 'Nominal Kosong',
        message: 'Nominal bayar wajib diisi sebelum menyimpan pembayaran.',
        type: 'warning'
      });
      return;
    }

    const resolvedMethod = resolvePaymentMethodString({
      mainCategory,
      edcCardType,
      isCrossTransfer,
      crossBankOutletId,
      activeOutletId: localStorage.getItem('activeOutletId') || 2,
      activeOutletName: localStorage.getItem('activeOutletName') || 'Waschen Laundry Citra Gran',
      outlets
    });

    setIsSubmittingPayment(true);
    try {
      const txnId = paymentModalOrder.dbId || paymentModalOrder.id;
      let proofUrl = paymentDetail?.order?.payment_proof_url || paymentModalOrder.paymentProofUrl || null;

      if (proofFile) {
        const fd = new FormData();
        fd.append('proof', proofFile);
        const up = await axios.post(`/api/history/transactions/${txnId}/payment-proof`, fd);
        proofUrl = up.data?.data?.paymentProofUrl || proofUrl;
      }

      const res = await axios.patch(`/api/history/transactions/${txnId}/payment`, {
        additionalAmount: addAmount,
        paymentMethod: resolvedMethod,
        paymentProofUrl: proofUrl,
        notes: paymentForm.notes || `Pelunasan nota ${paymentModalOrder.id}`,
        overpaymentToDeposit: paymentForm.overpaymentAction === 'deposit',
        cashierEmployeeId: localStorage.getItem('employeeId') || null
      });

      const updated = res.data?.data;
      setTransactions(transactions.map((t) => (
        t.id === paymentModalOrder.id
          ? {
              ...t,
              paymentStatus: updated?.paymentStatus || t.paymentStatus,
              paymentMethod: updated?.paymentMethod || t.paymentMethod,
              paidAmount: updated?.paidAmount ?? t.paidAmount,
              paymentProofUrl: updated?.paymentProofUrl || t.paymentProofUrl
            }
          : t
      )));

      showToast('Pembayaran Diperbarui', `Nota ${paymentModalOrder.id} — ${updated?.paymentStatus || 'OK'}`);
      setPaymentModalOrder(null);
      setPaymentDetail(null);
      fetchTransactions();
    } catch (err) {
      console.error('Gagal memperbarui pembayaran:', err);
      showToast('Gagal Bayar', err.response?.data?.message || 'Terjadi kesalahan sistem', 'error');
    } finally {
      setIsSubmittingPayment(false);
    }
  };

  // Submit Delete Request
  const handleSubmitDeleteRequest = async () => {
    if (!deleteModalOrder) return;
    if (!deleteReason.trim()) {
      showAlert({
        title: 'Alasan Wajib Diisi',
        message: 'Harap isi alasan pengajuan hapus nota sebelum mengirim request.',
        type: 'warning'
      });
      return;
    }

    setIsSubmittingDelete(true);
    try {
      await axios.patch(`/api/transactions/${deleteModalOrder.dbId || deleteModalOrder.id}/request-delete`, {
        reason: deleteReason
      });

      showToast('Request Delete Dikirim', `Pengajuan hapus nota ${deleteModalOrder.id} telah dikirim (Status: Pending)`);
      setDeleteModalOrder(null);
      setDeleteReason('');
      fetchTransactions();
    } catch (err) {
      console.error('Gagal pengajuan hapus nota:', err);
      showToast('Gagal Request Delete', err.response?.data?.message || 'Terjadi kesalahan sistem', 'error');
    } finally {
      setIsSubmittingDelete(false);
    }
  };

  // Filter Active Transactions
  const activeTransactions = transactions.filter(t => !t.isDeleteRequested);

  const displayOrders = activeTransactions.filter(order => {
    // Search Filter
    const q = searchQuery.toLowerCase();
    const matchesSearch = !q ||
      order.id.toLowerCase().includes(q) ||
      (order.customerName && order.customerName.toLowerCase().includes(q)) ||
      (order.customerPhone && order.customerPhone.includes(q)) ||
      (order.serviceType && order.serviceType.toLowerCase().includes(q));

    if (!matchesSearch) return false;

    // Payment Filter
    if (!matchesPaymentFilter(order)) return false;

    // Branch Filter
    if (selectedBranchFilter !== 'Semua') {
      const matchesBranch = order.branch === selectedBranchFilter ||
        (order.branch && selectedBranchFilter && (
          order.branch.toLowerCase().includes(selectedBranchFilter.toLowerCase()) ||
          selectedBranchFilter.toLowerCase().includes(order.branch.toLowerCase())
        ));
      if (!matchesBranch) return false;
    }

    // Date Filter
    if (dateFilter) {
      const orderDateStr = order.createdAt ? new Date(order.createdAt).toISOString().slice(0, 10) : '';
      if (orderDateStr !== dateFilter) return false;
    }

    // Workflow Status Tab Filter
    const status = order.progressStatus ?? order.workStatus;
    if (activeFilterTab !== 'Semua' && !matchesWorkStatusTab(status, activeFilterTab)) return false;

    return true;
  });

  // Helper for Status Tab Counts
  const getTabCount = (tabName) => {
    const baseList = activeTransactions.filter(order => {
      if (!matchesPaymentFilter(order)) return false;
      if (selectedBranchFilter !== 'Semua') {
        const matchesBranch = order.branch === selectedBranchFilter ||
          (order.branch && selectedBranchFilter && (
            order.branch.toLowerCase().includes(selectedBranchFilter.toLowerCase()) ||
            selectedBranchFilter.toLowerCase().includes(order.branch.toLowerCase())
          ));
        if (!matchesBranch) return false;
      }
      if (dateFilter) {
        const orderDateStr = order.createdAt ? new Date(order.createdAt).toISOString().slice(0, 10) : '';
        if (orderDateStr !== dateFilter) return false;
      }
      return true;
    });

    if (tabName === 'Semua') return baseList.length;
    return baseList.filter((o) => matchesWorkStatusTab(o.progressStatus ?? o.workStatus, tabName)).length;
  };

  return (
    <div id="tracking-service-section" className="bg-white border border-[#e0e0e0]/70 rounded-3xl shadow-xs flex flex-col overflow-hidden transition-all duration-300">
      {/* Table Header Controls (Sleek Single Line Toolbar) */}
      <div className="p-4 sm:p-5 border-b border-[#e0e0e0]/70 flex flex-col xl:flex-row justify-between items-start xl:items-center gap-3 bg-slate-50/50">
        <div>
          <div className="flex items-center gap-2">
            <h3 className="text-base font-extrabold text-[#313030] tracking-tight">Riwayat Transaksi POS</h3>
            <span className="px-2.5 py-0.5 rounded-full bg-[#5f1340]/10 text-[#5f1340] text-[10px] font-black border border-[#5f1340]/15">
              {displayOrders.length} Order
            </span>
          </div>
          <p className="text-xs text-slate-400 font-medium mt-0.5">Klik baris untuk melihat rincian status pengerjaan per item</p>
        </div>

        {/* Header Right Controls: Search, Branch, Date, Payment Filter */}
        <div className="flex flex-wrap items-center gap-2 w-full xl:w-auto">
          {/* Search Input */}
          <div className="relative flex-1 sm:w-56">
            <Search className="absolute left-3 top-2.5 h-3.5 w-3.5 text-slate-400" />
            <input
              type="text"
              placeholder="Cari Struk, Pelanggan..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-8 pr-7 py-1.5 border border-[#e0e0e0] rounded-xl text-xs bg-white focus:border-[#5f1340] focus:ring-1 focus:ring-[#5f1340] outline-none font-medium text-[#313030]"
            />
            {searchQuery && (
              <button onClick={() => setSearchQuery('')} className="absolute right-2.5 top-1.5 text-slate-400 text-xs font-bold">&times;</button>
            )}
          </div>

          {/* Branch Filter */}
          <select
            value={selectedBranchFilter}
            onChange={(e) => setSelectedBranchFilter(e.target.value)}
            className="px-3 py-1.5 border border-[#e0e0e0] bg-white rounded-xl outline-none focus:border-[#5f1340] text-xs font-bold text-[#313030] cursor-pointer"
          >
            <option value="Semua">Semua Cabang Outlet</option>
            {outlets.map(o => (
              <option key={o.id} value={o.full_name || o.name}>{o.full_name || o.name}</option>
            ))}
          </select>

          {/* Date Picker */}
          <input
            type="date"
            value={dateFilter}
            onChange={(e) => setDateFilter(e.target.value)}
            className="px-2.5 py-1.5 border border-[#e0e0e0] rounded-xl text-xs font-bold text-[#313030] bg-white outline-none focus:border-[#5f1340] cursor-pointer"
            title="Filter Tanggal Transaksi"
          />

          {/* Payment Status Select */}
          <select
            value={paymentFilter}
            onChange={(e) => setPaymentFilter(e.target.value)}
            className="px-3 py-1.5 border border-[#e0e0e0] bg-white rounded-xl outline-none focus:border-[#5f1340] text-xs font-bold text-[#313030] cursor-pointer"
          >
            <option value="Semua">Semua Bayar</option>
            <option value="Lunas">Lunas Only</option>
            <option value="DP">DP Only</option>
            <option value="Outstanding">Outstanding Only</option>
            <option value="Sisa Tagihan">Sisa Tagihan (DP + Outstanding)</option>
          </select>

          {/* Reset Filters */}
          {(dateFilter || paymentFilter !== 'Semua' || selectedBranchFilter !== 'Semua' || searchQuery) && (
            <button
              type="button"
              onClick={() => { setDateFilter(''); setPaymentFilter('Semua'); setSelectedBranchFilter('Semua'); setSearchQuery(''); }}
              className="p-1.5 bg-slate-100 hover:bg-slate-200 text-slate-600 rounded-xl transition-all cursor-pointer"
              title="Reset Semua Filter"
            >
              <RotateCcw className="h-3.5 w-3.5" />
            </button>
          )}
        </div>
      </div>

      {/* Filter Tabs with Live Counters */}
      <div className="px-5 border-b border-[#e0e0e0]/60 flex gap-2 overflow-x-auto py-2.5 bg-slate-50/30 no-scrollbar">
        {['Semua', ...(workStatusTabs.length ? workStatusTabs : ['Antrean', 'Pencucian', 'Penyetrikaan', 'Pengemasan', 'Siap Diambil / Diantar', 'Selesai'])].map((tab) => {
          const active = activeFilterTab === tab;
          const count = getTabCount(tab);

          return (
            <button
              key={tab}
              type="button"
              onClick={() => setActiveFilterTab(tab)}
              className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all duration-200 cursor-pointer whitespace-nowrap flex items-center gap-1.5 ${
                active
                  ? 'bg-[#5f1340] text-white shadow-2xs font-extrabold'
                  : 'bg-white border border-[#e0e0e0]/70 text-slate-600 hover:border-[#5f1340]/40 hover:text-[#5f1340]'
              }`}
            >
              <span>{tab}</span>
              <span className={`px-1.5 py-0.2 rounded-full text-[9px] font-black ${
                active ? 'bg-white/20 text-white' : 'bg-slate-100 text-slate-600'
              }`}>
                {count}
              </span>
            </button>
          );
        })}
      </div>

      {/* Table Content (Exact structure as TrackingService) */}
      <div className="overflow-x-auto">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="border-b border-[#e0e0e0]/70 text-[10px] uppercase font-extrabold text-slate-400 tracking-wider bg-slate-50/70">
              <th className="py-3.5 px-6">No. Struk Nota</th>
              <th className="py-3.5 px-6 text-center">Pelanggan</th>
              <th className="py-3.5 px-6 text-center">No. WhatsApp</th>
              <th className="py-3.5 px-6 text-center">Status Pengerjaan</th>
              <th className="py-3.5 px-6">Tagihan</th>
              <th className="py-3.5 px-6 text-center">Status Bayar</th>
              <th className="py-3.5 px-6 text-center">Aksi</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[#e0e0e0]/40 text-xs font-medium">
            {displayOrders.length === 0 ? (
              <tr>
                <td colSpan="7" className="py-12 text-center text-slate-400 font-bold">
                  Tidak ada data riwayat transaksi yang sesuai dengan filter.
                </td>
              </tr>
            ) : (
              displayOrders.map((order) => {
                const workStatus = order.progressStatus || order.workStatus || 'Antrean';
                const workPct = getWorkPercentage(workStatus);
                const pctTone = percentageTone(workPct);

                return (
                  <tr
                    key={order.id}
                    onClick={() => navigate(`/riwayat/${order.id}`, { state: { from: '/riwayat' } })}
                    className="hover:bg-[#5f1340]/[0.03] cursor-pointer transition-colors group"
                    title="Klik untuk membuka halaman rincian transaksi"
                  >
                    {/* No Struk */}
                    <td className="py-3.5 px-6 font-mono font-black text-[#5f1340] whitespace-nowrap">
                      <div className="flex items-center gap-1.5">
                        <span className="text-sm tracking-tight group-hover:underline">{order.id}</span>
                        {order.isDelivery && (
                          <span className="bg-blue-50 text-blue-700 border border-blue-200 text-[8px] font-extrabold px-1.5 py-0.5 rounded-md flex items-center gap-0.5">
                            <Truck className="h-2.5 w-2.5" /> Delivery
                          </span>
                        )}
                      </div>
                    </td>

                    {/* Pelanggan */}
                    <td className="py-3.5 px-6 text-center">
                      <span className="font-extrabold text-[#313030] leading-tight">{formatName(order.customerName)}</span>
                    </td>

                    {/* No. WhatsApp (Clickable — buka chat WA langsung) */}
                    <td className="py-3.5 px-6 text-center whitespace-nowrap">
                      {order.customerPhone && order.customerPhone !== '-' ? (
                        <button
                          type="button"
                          onClick={(e) => handleOpenWA(e, order)}
                          className="text-xs text-emerald-600 hover:text-emerald-700 font-mono font-bold hover:underline cursor-pointer inline-flex items-center gap-0.5"
                          title={`Klik untuk kirim pesan WhatsApp ke ${order.customerName}`}
                        >
                          <span>{order.customerPhone}</span>
                        </button>
                      ) : (
                        <span className="text-slate-300 font-bold">—</span>
                      )}
                    </td>

                    {/* Status Pengerjaan (Center Aligned, Badge ONLY) */}
                    <td className="py-3.5 px-6 text-center whitespace-nowrap">
                      <span
                        title={workStatus}
                        className={`inline-flex items-center justify-center min-w-[52px] px-3 py-1 rounded-full border text-xs font-black shadow-2xs ${pctTone.bg} ${pctTone.text}`}
                      >
                        {formatWorkPercentage(workStatus)}
                      </span>
                    </td>

                    {/* Tagihan (Single Line) */}
                    <td className="py-3.5 px-6 font-black text-[#313030] text-sm whitespace-nowrap">
                      Rp {(order.grandTotal || order.totalAmount || 0).toLocaleString('id-ID')}
                    </td>

                    {/* Status Bayar (Center Aligned, Single Line) */}
                    <td className="py-3.5 px-6 text-center whitespace-nowrap">
                      {(() => {
                        const ps = normalizePaymentStatus(order.paymentStatus);
                        if (ps === 'Lunas') {
                          return (
                            <span className="px-3 py-1 rounded-xl bg-emerald-50 text-emerald-700 border border-emerald-200 text-[10px] font-black inline-flex items-center gap-1 shadow-2xs whitespace-nowrap">
                              <CheckCircle2 className="h-3 w-3 text-emerald-600" />
                              <span>Lunas ({order.paymentMethod})</span>
                            </span>
                          );
                        }
                        if (ps === 'DP') {
                          return (
                            <button
                              type="button"
                              onClick={(e) => openPaymentModal(order, e)}
                              className="px-3 py-1 rounded-xl bg-amber-50 hover:bg-amber-600 text-amber-800 hover:text-white border border-amber-200 text-[10px] font-black inline-flex items-center gap-1 transition-all shadow-2xs cursor-pointer whitespace-nowrap group/pay"
                              title="Klik untuk pelunasan / update pembayaran"
                            >
                              <Wallet className="h-3 w-3" />
                              <span>DP Rp {(order.paidAmount || 0).toLocaleString('id-ID')}</span>
                            </button>
                          );
                        }
                        return (
                          <button
                            type="button"
                            onClick={(e) => openPaymentModal(order, e)}
                            className="px-3 py-1 rounded-xl bg-rose-50 hover:bg-rose-600 text-rose-700 hover:text-white border border-rose-200 text-[10px] font-black inline-flex items-center gap-1 transition-all shadow-2xs cursor-pointer whitespace-nowrap group/pay"
                            title="Klik untuk proses pembayaran nota outstanding"
                          >
                            <AlertCircle className="h-3 w-3 text-rose-600 group-hover/pay:text-white" />
                            <span>Outstanding</span>
                          </button>
                        );
                      })()}
                    </td>

                    {/* Aksi Kasir (Center Aligned, Print & Delete Request Icon Buttons) */}
                    <td className="py-3.5 px-6 text-center whitespace-nowrap">
                      <div className="inline-flex items-center gap-1.5">
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            setSelectedReceipt(order);
                          }}
                          className="p-2 rounded-xl border border-[#e0e0e0] bg-white hover:bg-[#5f1340] hover:text-white text-slate-700 transition-all cursor-pointer shadow-2xs inline-flex items-center justify-center group/print"
                          title="Cetak Struk Nota Bluetooth"
                        >
                          <Printer className="h-4 w-4" />
                        </button>

                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            setDeleteModalOrder(order);
                          }}
                          className="p-2 rounded-xl border border-rose-200 bg-rose-50/80 hover:bg-rose-600 hover:text-white text-rose-700 transition-all cursor-pointer shadow-2xs inline-flex items-center justify-center group/del"
                          title="Ajukan Hapus Nota (Request Delete)"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {/* Table footer */}
      <div className="p-4 border-t border-[#e0e0e0]/70 bg-slate-50/50 flex justify-between items-center text-[10px] text-slate-400 font-bold">
        <span>Menampilkan {displayOrders.length} dari {activeTransactions.length} transaksi terdaftar</span>
      </div>

      {/* MODAL: REQUEST DELETE TRANSACTION */}
      {deleteModalOrder && (
        <div className="fixed inset-0 z-50 bg-[#313030]/60 backdrop-blur-xs flex justify-center items-center p-4">
          <div className="bg-white rounded-3xl border border-[#e0e0e0] w-full max-w-md shadow-2xl overflow-hidden animate-fade-in">
            <div className="p-5 border-b border-[#e0e0e0] flex justify-between items-center bg-rose-50/50">
              <div className="flex items-center gap-2">
                <Trash2 className="h-5 w-5 text-rose-600" />
                <div>
                  <h3 className="text-sm font-black text-[#313030]">Request Hapus Nota {deleteModalOrder.id}</h3>
                  <span className="text-[10px] text-slate-400">Status akan menjadi Request Delete Pending Approval</span>
                </div>
              </div>
              <button onClick={() => setDeleteModalOrder(null)} className="p-1 text-slate-400 hover:text-[#313030]">
                <X className="h-4.5 w-4.5" />
              </button>
            </div>

            <div className="p-5 space-y-4 text-xs">
              <div className="p-3 bg-slate-50 border border-[#e0e0e0] rounded-xl space-y-1">
                <div className="flex justify-between">
                  <span className="font-bold text-slate-500">Pelanggan:</span>
                  <span className="font-extrabold text-[#313030]">{deleteModalOrder.customerName}</span>
                </div>
                <div className="flex justify-between">
                  <span className="font-bold text-slate-500">Tagihan Nota:</span>
                  <span className="font-extrabold text-[#5f1340]">Rp {(deleteModalOrder.grandTotal || deleteModalOrder.totalAmount || 0).toLocaleString('id-ID')}</span>
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-[#313030] mb-1.5">
                  Alasan Pengajuan Hapus <span className="text-rose-600">*</span>
                </label>
                <textarea
                  rows="3"
                  value={deleteReason}
                  onChange={(e) => setDeleteReason(e.target.value)}
                  placeholder="Misal: Salah input layanan kiloan, double input nota, atau pembatalan transaksi oleh pelanggan..."
                  className="w-full p-3 border border-[#e0e0e0] rounded-xl text-xs outline-none focus:border-rose-600 focus:ring-1 focus:ring-rose-600 text-[#313030]"
                />
              </div>

              <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl text-[11px] text-amber-800 font-medium">
                ⚠️ <strong>Catatan:</strong> Nota tidak akan langsung terhapus permanen dari sistem. Status akan berubah menjadi <strong>Pending Approval</strong> dan menunggu persetujuan dari Aplikasi Utama / Manager.
              </div>
            </div>

            <div className="p-4 bg-slate-50 border-t border-[#e0e0e0] flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setDeleteModalOrder(null)}
                className="px-4 py-2 bg-white border border-[#e0e0e0] hover:bg-slate-100 text-slate-700 font-bold rounded-xl text-xs cursor-pointer"
              >
                Batal
              </button>
              <button
                type="button"
                disabled={isSubmittingDelete}
                onClick={handleSubmitDeleteRequest}
                className="px-4 py-2 bg-rose-600 hover:bg-rose-700 text-white font-bold rounded-xl text-xs cursor-pointer flex items-center gap-1.5 shadow-2xs"
              >
                <Trash2 className="h-3.5 w-3.5" />
                <span>{isSubmittingDelete ? 'Mengirim...' : 'Kirim Request Hapus'}</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL: DETAIL STRUK NOTA & CETAK THERMAL */}
      {selectedReceipt && (
        <div className="fixed inset-0 z-50 bg-[#313030]/60 backdrop-blur-xs flex justify-center items-center p-4">
          <div className="bg-white rounded-3xl border border-[#e0e0e0] w-full max-w-sm shadow-2xl overflow-hidden animate-fade-in">
            <div className="p-4 border-b border-[#e0e0e0] flex justify-between items-center bg-[#f8f8f8]">
              <div className="flex items-center gap-2">
                <Printer className="h-5 w-5 text-[#5f1340]" />
                <h3 className="text-sm font-black text-[#313030]">Detail Struk Transaksi</h3>
              </div>
              <button onClick={() => setSelectedReceipt(null)} className="p-1 text-slate-400 hover:text-[#313030]">
                <X className="h-4.5 w-4.5" />
              </button>
            </div>

            {/* Thermal Slip Simulation */}
            <div className="p-5 font-mono text-xs text-slate-800 space-y-3 bg-[#fffefb] border-b border-dashed border-slate-300">
              <div className="text-center pb-2 border-b border-dashed border-slate-300">
                <span className="font-black text-sm block">WASCHEN LAUNDRY</span>
                <span className="text-[10px] text-slate-500 block">{selectedReceipt.branch}</span>
                <span className="text-[9px] text-slate-400 block mt-0.5">{selectedReceipt.createdAt}</span>
              </div>

              <div>
                <span className="font-bold block">No. Nota: {selectedReceipt.id}</span>
                <span>Pelanggan: {selectedReceipt.customerName} ({selectedReceipt.customerPhone})</span>
                <span className="text-[10px] text-slate-500 block">Kasir: {formatEmployeeName(selectedReceipt.cashierName)}</span>
              </div>

              <div className="border-t border-b border-dashed border-slate-300 py-2 space-y-1">
                <div className="flex justify-between">
                  <span>{selectedReceipt.serviceType}</span>
                  <span>{selectedReceipt.qty}</span>
                </div>
                <div className="flex justify-between text-[10px] text-slate-500">
                  <span>Aroma: {selectedReceipt.perfume}</span>
                  <span>{selectedReceipt.speed}</span>
                </div>
              </div>

              <div className="flex justify-between font-black text-sm pt-1">
                <span>TOTAL:</span>
                <span>Rp {(selectedReceipt.grandTotal || selectedReceipt.totalAmount || 0).toLocaleString('id-ID')}</span>
              </div>
              <div className="flex justify-between text-[10px]">
                <span>Status Payment:</span>
                <span className={`font-bold ${
                  normalizePaymentStatus(selectedReceipt.paymentStatus) === 'Lunas'
                    ? 'text-emerald-700'
                    : normalizePaymentStatus(selectedReceipt.paymentStatus) === 'DP'
                      ? 'text-amber-700'
                      : 'text-rose-700'
                }`}>
                  {normalizePaymentStatus(selectedReceipt.paymentStatus)} ({selectedReceipt.paymentMethod})
                </span>
              </div>
              {(selectedReceipt.paidAmount || 0) > 0 && (
                <div className="flex justify-between text-[10px]">
                  <span>Sudah Dibayar:</span>
                  <span className="font-bold">Rp {(selectedReceipt.paidAmount || 0).toLocaleString('id-ID')}</span>
                </div>
              )}
              {normalizePaymentStatus(selectedReceipt.paymentStatus) !== 'Lunas' && (
                <div className="flex justify-between text-[10px] text-rose-700">
                  <span>Sisa Tagihan:</span>
                  <span className="font-bold">Rp {Math.max(0, (selectedReceipt.grandTotal || 0) - (selectedReceipt.paidAmount || 0)).toLocaleString('id-ID')}</span>
                </div>
              )}
              <div className="flex justify-between text-[10px]">
                <span>Status Pengerjaan:</span>
                <span className="font-bold">{formatWorkPercentage(selectedReceipt.progressStatus ?? selectedReceipt.workStatus)}</span>
              </div>
            </div>

            <div className="p-4 bg-[#f8f8f8] flex gap-2">
              {normalizePaymentStatus(selectedReceipt.paymentStatus) !== 'Lunas' && (
                <button
                  onClick={() => {
                    openPaymentModal(selectedReceipt);
                    setSelectedReceipt(null);
                  }}
                  className="px-3 py-2.5 bg-emerald-600 text-white rounded-xl font-black text-xs flex items-center justify-center gap-1.5 cursor-pointer"
                >
                  <CreditCard className="h-4 w-4" />
                  <span>Bayar / Pelunasan</span>
                </button>
              )}
              <button
                onClick={async () => {
                  await showAlert({
                    title: 'Struk Dikirim',
                    message: 'Struk transaksi berhasil dikirim ke Printer Thermal Bluetooth Waschen!',
                    type: 'success',
                    confirmLabel: 'Selesai'
                  });
                  setSelectedReceipt(null);
                }}
                className="flex-1 py-2.5 bg-[#5f1340] hover:bg-[#4d0f33] text-white rounded-xl font-black text-xs flex items-center justify-center gap-2 cursor-pointer shadow-2xs"
              >
                <Printer className="h-4 w-4" />
                <span>Cetak Thermal</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL: UPDATE PEMBAYARAN / PELUNASAN */}
      {paymentModalOrder && (
        <div className="fixed inset-0 z-50 bg-[#313030]/75 backdrop-blur-xs flex justify-center items-center p-3 sm:p-6 overflow-y-auto">
          <div className="bg-white rounded-3xl border border-[#e0e0e0] w-full max-w-lg shadow-2xl overflow-hidden animate-fade-in flex flex-col max-h-[calc(100vh-4rem)] sm:max-h-[85vh] my-auto">
            <div className="p-4 sm:p-5 border-b border-[#e0e0e0] flex justify-between items-center bg-[#5f1340]/5 shrink-0">
              <div className="flex items-center gap-2">
                <CreditCard className="h-5 w-5 text-[#5f1340]" />
                <div>
                  <h3 className="text-sm font-black text-[#313030]">Update Pembayaran — {paymentModalOrder.id}</h3>
                  <span className="text-[10px] text-slate-400">{formatName(paymentModalOrder.customerName)}</span>
                </div>
              </div>
              <button
                type="button"
                onClick={() => { setPaymentModalOrder(null); setPaymentDetail(null); }}
                className="p-1 text-slate-400 hover:text-[#313030]"
              >
                <X className="h-4.5 w-4.5" />
              </button>
            </div>

            <div className="p-5 space-y-4 text-xs overflow-y-auto flex-1">
              {isLoadingPayment ? (
                <div className="py-8 text-center text-slate-400 font-bold">Memuat riwayat pembayaran...</div>
              ) : (
                <>
                  <div className="grid grid-cols-3 gap-2">
                    <div className="p-3 bg-slate-50 border border-[#e0e0e0] rounded-xl text-center">
                      <span className="text-[10px] font-bold text-slate-400 block uppercase">Total Tagihan</span>
                      <span className="font-black text-[#5f1340] text-sm">
                        Rp {(paymentDetail?.grandTotal || paymentModalOrder.grandTotal || 0).toLocaleString('id-ID')}
                      </span>
                    </div>
                    <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-xl text-center">
                      <span className="text-[10px] font-bold text-emerald-600 block uppercase">Sudah Bayar</span>
                      <span className="font-black text-emerald-800 text-sm">
                        Rp {(paymentDetail?.paidAmount ?? paymentModalOrder.paidAmount ?? 0).toLocaleString('id-ID')}
                      </span>
                    </div>
                    <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-center">
                      <span className="text-[10px] font-bold text-rose-600 block uppercase">Sisa</span>
                      <span className="font-black text-rose-800 text-sm">
                        Rp {(paymentDetail?.remaining ?? Math.max(0, (paymentModalOrder.grandTotal || 0) - (paymentModalOrder.paidAmount || 0))).toLocaleString('id-ID')}
                      </span>
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    <span className="text-[10px] font-bold text-slate-400 uppercase">Status:</span>
                    <span className={`px-2 py-0.5 rounded-lg text-[10px] font-black ${
                      normalizePaymentStatus(paymentModalOrder.paymentStatus) === 'DP'
                        ? 'bg-amber-100 text-amber-800'
                        : 'bg-rose-100 text-rose-800'
                    }`}>
                      {normalizePaymentStatus(paymentModalOrder.paymentStatus)}
                    </span>
                  </div>

                  {(paymentDetail?.order?.payment_proof_url || paymentModalOrder.paymentProofUrl) && (
                    <div className="p-3 bg-slate-50 border border-[#e0e0e0] rounded-xl">
                      <span className="text-[10px] font-bold text-slate-400 block mb-1">Bukti Pembayaran Terakhir</span>
                      <a
                        href={paymentDetail?.order?.payment_proof_url || paymentModalOrder.paymentProofUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-[11px] font-bold text-[#5f1340] hover:underline"
                      >
                        Lihat bukti pembayaran
                      </a>
                    </div>
                  )}

                  {paymentDetail?.logs?.length > 0 && (
                    <div>
                      <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-2 flex items-center gap-1">
                        <History className="h-3.5 w-3.5" /> Riwayat Pembayaran
                      </span>
                      <div className="space-y-1.5 max-h-32 overflow-y-auto">
                        {paymentDetail.logs.map((log) => (
                          <div key={log.id} className="p-2.5 bg-[#f8f8f8] border border-[#e0e0e0] rounded-xl flex justify-between items-center">
                            <div>
                              <span className="font-black text-[#313030] block">{log.log_type}</span>
                              <span className="text-[10px] text-slate-500">{log.payment_method} • {new Date(log.created_at).toLocaleString('id-ID')}</span>
                              {log.notes && <span className="text-[10px] text-slate-400 block">{log.notes}</span>}
                            </div>
                            <span className="font-black text-[#5f1340]">Rp {parseFloat(log.amount || 0).toLocaleString('id-ID')}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {normalizePaymentStatus(paymentModalOrder.paymentStatus) !== 'Lunas' && (
                    <>
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
                        activeOutletName={localStorage.getItem('activeOutletName') || 'Waschen Laundry Citra Gran'}
                        outlets={outlets}
                        paymentMethods={paymentMethods}
                        selectedCustomer={paymentModalOrder}
                        grandTotal={paymentDetail?.remaining || Math.max(0, (paymentModalOrder.grandTotal || 0) - (paymentModalOrder.paidAmount || 0))}
                      />

                      <div>
                        <label className="text-[11px] font-bold text-slate-500 uppercase tracking-wider block mb-1.5">
                          Nominal Bayar / Pelunasan (Rp)
                        </label>
                        <input
                          type="text"
                          inputMode="numeric"
                          value={paymentForm.additionalAmount}
                          onChange={(e) => setPaymentForm({ ...paymentForm, additionalAmount: formatRupiah(e.target.value) })}
                          placeholder={formatRupiah(paymentDetail?.remaining || paymentModalOrder.grandTotal || 0)}
                          className="w-full px-4 py-2.5 bg-white border border-[#e0e0e0] rounded-xl text-sm font-black outline-none focus:border-[#5f1340]"
                        />
                        <div className="flex flex-wrap gap-2 mt-2">
                          {[
                            paymentDetail?.remaining || Math.max(0, (paymentModalOrder.grandTotal || 0) - (paymentModalOrder.paidAmount || 0)),
                            50000, 100000, 200000
                          ]
                            .filter((v, i, arr) => v > 0 && arr.indexOf(v) === i)
                            .slice(0, 4)
                            .map((preset) => (
                              <button
                                key={preset}
                                type="button"
                                onClick={() => setPaymentForm({ ...paymentForm, additionalAmount: formatRupiah(preset) })}
                                className="px-3 py-1 rounded-lg bg-[#f8f8f8] border border-[#e0e0e0] text-[10px] font-bold text-slate-600 hover:border-[#5f1340] cursor-pointer"
                              >
                                {preset === (paymentDetail?.remaining || 0) ? 'Lunas Pas' : formatRupiah(preset, true)}
                              </button>
                            ))}
                        </div>
                      </div>

                      <div>
                        <label className="text-[11px] font-bold text-slate-500 uppercase tracking-wider block mb-1.5">
                          Catatan Pembayaran
                        </label>
                        <input
                          type="text"
                          value={paymentForm.notes}
                          onChange={(e) => setPaymentForm({ ...paymentForm, notes: e.target.value })}
                          placeholder="Opsional — misal: transfer BCA a/n pelanggan"
                          className="w-full px-4 py-2.5 bg-white border border-[#e0e0e0] rounded-xl text-xs font-medium outline-none focus:border-[#5f1340]"
                        />
                      </div>

                      <div>
                        <label className="text-[11px] font-bold text-slate-500 uppercase tracking-wider block mb-1.5">
                          Upload Bukti Pembayaran
                        </label>
                        <label className="flex flex-col items-center justify-center w-full p-4 border-2 border-dashed border-[#e0e0e0] rounded-xl cursor-pointer hover:border-[#5f1340]/40 transition-all">
                          <Upload className="h-4 w-4 text-slate-400 mb-1" />
                          <span className="text-[10px] font-bold text-slate-500">
                            {proofFile ? proofFile.name : 'Upload foto/PDF bukti bayar'}
                          </span>
                          <input
                            type="file"
                            accept="image/jpeg,image/png,image/webp,application/pdf"
                            className="hidden"
                            onChange={(e) => setProofFile(e.target.files?.[0] || null)}
                          />
                        </label>
                      </div>

                      {parseRupiah(paymentForm.additionalAmount) > (paymentDetail?.remaining || 0) && (
                        <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl space-y-2">
                          <div className="flex items-center gap-1.5 text-xs font-bold text-amber-900">
                            <Coins className="h-4 w-4" />
                            Kelebihan bayar: Rp {(parseRupiah(paymentForm.additionalAmount) - (paymentDetail?.remaining || 0)).toLocaleString('id-ID')}
                          </div>
                          <div className="grid grid-cols-2 gap-2">
                            <button
                              type="button"
                              onClick={() => setPaymentForm({ ...paymentForm, overpaymentAction: 'change' })}
                              className={`py-2 rounded-lg text-[10px] font-black cursor-pointer ${
                                paymentForm.overpaymentAction === 'change' ? 'bg-amber-600 text-white' : 'bg-white border border-amber-300 text-amber-900'
                              }`}
                            >
                              Kembalian Tunai
                            </button>
                            <button
                              type="button"
                              onClick={() => setPaymentForm({ ...paymentForm, overpaymentAction: 'deposit' })}
                              className={`py-2 rounded-lg text-[10px] font-black cursor-pointer ${
                                paymentForm.overpaymentAction === 'deposit' ? 'bg-emerald-600 text-white' : 'bg-white border border-emerald-300 text-emerald-800'
                              }`}
                            >
                              Simpan ke Saldo
                            </button>
                          </div>
                        </div>
                      )}
                    </>
                  )}
                </>
              )}
            </div>

            {normalizePaymentStatus(paymentModalOrder.paymentStatus) !== 'Lunas' && !isLoadingPayment && (
              <div className="p-4 border-t border-[#e0e0e0] bg-[#f8f8f8] flex gap-2 shrink-0">
                <button
                  type="button"
                  onClick={() => { setPaymentModalOrder(null); setPaymentDetail(null); }}
                  className="px-4 py-2.5 bg-white border border-[#e0e0e0] hover:bg-slate-100 text-slate-700 font-bold rounded-xl text-xs cursor-pointer"
                >
                  Batal
                </button>
                <button
                  type="button"
                  disabled={isSubmittingPayment}
                  onClick={handleSubmitPaymentUpdate}
                  className="flex-1 py-2.5 bg-[#5f1340] hover:bg-[#4d0f33] disabled:opacity-50 text-white font-black rounded-xl text-xs cursor-pointer flex items-center justify-center gap-1.5"
                >
                  <CheckCircle2 className="h-4 w-4" />
                  <span>{isSubmittingPayment ? 'Menyimpan...' : 'Simpan Pembayaran'}</span>
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
