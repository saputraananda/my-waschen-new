import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Search,
  Printer,
  CheckCircle2,
  Clock,
  AlertCircle,
  Truck,
  Layers,
  X,
  RotateCcw,
  CreditCard,
  Upload,
  Coins,
  History,
  ExternalLink
} from 'lucide-react';
import axios from 'axios';
import { formatName } from '../../../utils/FormatName.js';
import { formatRupiah, parseRupiah } from '../../../utils/FormatRupiah.js';
import { useAppDialog } from '../../../context/AppDialogContext.jsx';
import { STATUS_STEPS, DEFAULT_WORK_STATUSES, getWorkPercentage, percentageTone, formatWorkPercentage, matchesWorkStatusTab } from '../../../utils/workStatusMeta.js';

export default function TrackingService({
  filteredOrders,
  orders,
  searchQuery,
  setSearchQuery,
  activeFilterTab,
  setActiveFilterTab,
  handlePrintNota,
  showToast,
  fetchLiveDashboardData
}) {
  const navigate = useNavigate();
  const { showAlert } = useAppDialog();
  const [selectedOrderModal, setSelectedOrderModal] = useState(null);
  const [workStatusTabs, setWorkStatusTabs] = useState([]);
  const [workStatusOptions, setWorkStatusOptions] = useState(DEFAULT_WORK_STATUSES);
  const [updatingItemId, setUpdatingItemId] = useState(null);

  // Payment update modal (sama seperti HistoryTransaction)
  const [paymentModalOrder, setPaymentModalOrder] = useState(null);
  const [paymentDetail, setPaymentDetail] = useState(null);
  const [paymentMethods, setPaymentMethods] = useState([]);
  const [paymentForm, setPaymentForm] = useState({
    additionalAmount: '',
    paymentMethod: 'Tunai Kasir',
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

  useEffect(() => {
    axios.get('/api/masters/work-statuses?filter_tabs=1')
      .then((res) => {
        if (res.data?.success) {
          setWorkStatusTabs((res.data.data || []).map((s) => s.label || s.name));
        }
      })
      .catch((err) => console.error('Gagal memuat work status:', err));

    axios.get('/api/masters/work-statuses')
      .then((res) => {
        if (res.data?.success && res.data.data?.length) {
          setWorkStatusOptions(res.data.data.map((s) => s.name || s.label).filter(Boolean));
        }
      })
      .catch(() => setWorkStatusOptions(DEFAULT_WORK_STATUSES));
  }, []);

  // WhatsApp Helper
  const handleOpenWA = (e, order) => {
    if (e) e.stopPropagation();
    let rawPhone = (order.customerPhone || '').replace(/[^0-9]/g, '');
    if (rawPhone.startsWith('0')) {
      rawPhone = '62' + rawPhone.slice(1);
    }
    if (!rawPhone) rawPhone = '628123456789';
    const message = encodeURIComponent(`Halo Kak ${order.customerName || 'Pelanggan'}, update status pengerjaan nota ${order.id} Anda saat ini: ${formatWorkPercentage(order.workStatus)}. Terima kasih telah mempercayakan Waschen Laundry! 😊`);
    window.open(`https://wa.me/${rawPhone}?text=${message}`, '_blank');
  };

  const openOrderModal = (order) => {
    setSelectedOrderModal(order);
  };

  const handleUpdateItemStatus = async (item, nextStatus) => {
    if (!selectedOrderModal?.dbId || !item?.id) {
      showToast?.('Gagal Update', 'ID item tidak valid', 'error');
      return;
    }
    if ((item.status || selectedOrderModal.workStatus) === nextStatus) return;

    setUpdatingItemId(item.id);
    try {
      const res = await axios.patch(
        `/api/transactions/${selectedOrderModal.dbId}/items/${item.id}/status`,
        {
          workStatus: nextStatus,
          employeeId: parseInt(localStorage.getItem('employeeId'), 10) || 167
        }
      );
      if (!res.data?.success) {
        showToast?.('Gagal Update', res.data?.message || 'Gagal mengubah status item', 'error');
        return;
      }

      const accumulated = res.data.data?.workStatus || nextStatus;
      setSelectedOrderModal((prev) => {
        if (!prev) return prev;
        return {
          ...prev,
          workStatus: accumulated,
          items: (prev.items || []).map((it) => (
            it.id === item.id ? { ...it, status: nextStatus } : it
          ))
        };
      });
      showToast?.('Status Item Diperbarui', `${item.serviceName || 'Item'} → ${nextStatus}`, 'success');
      if (typeof fetchLiveDashboardData === 'function') fetchLiveDashboardData();
    } catch (err) {
      console.error('Gagal update status item:', err);
      showToast?.('Gagal Update', err.response?.data?.message || 'Koneksi server gagal', 'error');
    } finally {
      setUpdatingItemId(null);
    }
  };

  const openPaymentModal = async (order, e) => {
    if (e) e.stopPropagation();
    const modalOrder = {
      ...order,
      grandTotal: order.grandTotal ?? order.totalAmount ?? 0,
      paidAmount: order.paidAmount ?? 0
    };
    setPaymentModalOrder(modalOrder);
    setPaymentForm({
      additionalAmount: '',
      paymentMethod: order.paymentMethod && order.paymentMethod !== '-' ? order.paymentMethod : 'Tunai Kasir',
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
        setPaymentMethods((methodsRes.data.data || []).filter((m) => !m.requires_member_balance));
      }
    } catch (err) {
      console.error('Gagal memuat detail pembayaran:', err);
      showToast?.('Gagal Memuat', err.response?.data?.message || 'Tidak dapat memuat riwayat pembayaran', 'error');
    } finally {
      setIsLoadingPayment(false);
    }
  };

  const handleSubmitPaymentUpdate = async () => {
    if (!paymentModalOrder) return;
    const remaining = paymentDetail?.remaining ?? Math.max(0, (paymentModalOrder.grandTotal || 0) - (paymentModalOrder.paidAmount || 0));
    const addAmount = parseRupiah(paymentForm.additionalAmount);

    if (normalizePaymentStatus(paymentModalOrder.paymentStatus) === 'Lunas') {
      showToast?.('Sudah Lunas', 'Nota ini sudah lunas.', 'error');
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
        paymentMethod: paymentForm.paymentMethod,
        paymentProofUrl: proofUrl,
        notes: paymentForm.notes || `Pelunasan nota ${paymentModalOrder.id}`,
        overpaymentToDeposit: paymentForm.overpaymentAction === 'deposit',
        cashierEmployeeId: localStorage.getItem('employeeId') || null
      });

      const updated = res.data?.data;
      showToast?.(
        'Pembayaran Diperbarui',
        `Nota ${paymentModalOrder.id} — ${updated?.paymentStatus || 'OK'}`,
        'success'
      );
      setPaymentModalOrder(null);
      setPaymentDetail(null);
      setSelectedOrderModal(null);
      if (typeof fetchLiveDashboardData === 'function') {
        fetchLiveDashboardData();
      }
    } catch (err) {
      console.error('Gagal memperbarui pembayaran:', err);
      showToast?.('Gagal Bayar', err.response?.data?.message || 'Terjadi kesalahan sistem', 'error');
    } finally {
      setIsSubmittingPayment(false);
    }
  };

  // Filter States: Payment Status & Date
  const [paymentFilter, setPaymentFilter] = useState('Semua');
  const [dateFilter, setDateFilter] = useState('');

  // Compute final displayed orders
  const displayOrders = filteredOrders.filter(order => {
    if (paymentFilter === 'Lunas' && order.paymentStatus !== 'Lunas') return false;
    if (paymentFilter === 'DP' && order.paymentStatus !== 'DP') return false;
    if (paymentFilter === 'Outstanding' && order.paymentStatus !== 'Outstanding' && order.paymentStatus !== 'Belum Lunas') return false;
    if (paymentFilter === 'Sisa Tagihan' && order.paymentStatus === 'Lunas') return false;

    if (dateFilter) {
      const orderDateStr = order.rawDate
        ? new Date(order.rawDate).toISOString().slice(0, 10)
        : '';
      if (orderDateStr !== dateFilter) return false;
    }

    return true;
  });

  // Helper to count orders for each status tab
  const getTabCount = (tabName) => {
    const baseList = orders.filter(order => {
      if (paymentFilter === 'Lunas' && order.paymentStatus !== 'Lunas') return false;
      if (paymentFilter === 'DP' && order.paymentStatus !== 'DP') return false;
      if (paymentFilter === 'Outstanding' && order.paymentStatus !== 'Outstanding' && order.paymentStatus !== 'Belum Lunas') return false;
      if (paymentFilter === 'Sisa Tagihan' && order.paymentStatus === 'Lunas') return false;
      if (dateFilter) {
        const orderDateStr = order.rawDate ? new Date(order.rawDate).toISOString().slice(0, 10) : '';
        if (orderDateStr !== dateFilter) return false;
      }
      return true;
    });

    if (tabName === 'Semua') return baseList.length;
    return baseList.filter((o) => matchesWorkStatusTab(o.workStatus, tabName)).length;
  };

  return (
    <div id="tracking-service-section" className="bg-white border border-[#e0e0e0]/70 rounded-3xl shadow-xs flex flex-col overflow-hidden transition-all duration-300">
      {/* Table Header Controls (Sleek Single Line Toolbar) */}
      <div className="p-4 sm:p-5 border-b border-[#e0e0e0]/70 flex flex-col md:flex-row justify-between items-start md:items-center gap-3 bg-slate-50/50">
        <div>
          <div className="flex items-center gap-2">
            <h3 className="text-base font-extrabold text-[#313030] tracking-tight">Antrean Cucian Hari Ini</h3>
            <span className="px-2.5 py-0.5 rounded-full bg-[#5f1340]/10 text-[#5f1340] text-[10px] font-black border border-[#5f1340]/15">
              {displayOrders.length} Order
            </span>
          </div>
          <p className="text-xs text-slate-400 font-medium mt-0.5">Klik baris untuk rincian status pengerjaan per item</p>
        </div>

        {/* Clean Filter Controls Toolbar */}
        <div className="flex flex-wrap items-center gap-2 w-full md:w-auto">
          {/* Search Input */}
          <div className="relative flex-1 md:w-56">
            <Search className="absolute left-3 top-2.5 h-3.5 w-3.5 text-slate-400" />
            <input
              id="tracking-search-input"
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

          {/* Date Picker */}
          <input
            type="date"
            value={dateFilter}
            onChange={(e) => setDateFilter(e.target.value)}
            className="px-2.5 py-1.5 border border-[#e0e0e0] rounded-xl text-xs font-bold text-[#313030] bg-white outline-none focus:border-[#5f1340] cursor-pointer"
            title="Filter Tanggal Transaksi"
          />

          {/* Payment Status Dropdown Select */}
          <select
            value={paymentFilter}
            onChange={(e) => setPaymentFilter(e.target.value)}
            className="px-3 py-1.5 border border-[#e0e0e0] bg-white rounded-xl outline-none focus:border-[#5f1340] text-xs font-bold text-[#313030] cursor-pointer"
          >
            <option value="Semua">Semua Bayar</option>
            <option value="Lunas">Lunas Only</option>
            <option value="DP">DP Only</option>
            <option value="Outstanding">Outstanding Only</option>
            <option value="Sisa Tagihan">Sisa Tagihan</option>
          </select>

          {/* Reset Filters Button */}
          {(dateFilter || paymentFilter !== 'Semua') && (
            <button
              type="button"
              onClick={() => { setDateFilter(''); setPaymentFilter('Semua'); }}
              className="p-1.5 bg-slate-100 hover:bg-slate-200 text-slate-600 rounded-xl transition-all cursor-pointer"
              title="Reset Filter Tanggal & Bayar"
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

      {/* Table Content */}
      <div className="overflow-x-auto">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="border-b border-[#e0e0e0]/70 text-[10px] uppercase font-extrabold text-slate-400 tracking-wider bg-slate-50/70">
              <th className="py-3.5 px-6">No. Struk Nota</th>
              <th className="py-3.5 px-6 text-center">Pelanggan</th>
              <th className="py-3.5 px-6 text-center">Status Pengerjaan</th>
              <th className="py-3.5 px-6">Tagihan</th>
              <th className="py-3.5 px-6 text-center">Status Bayar</th>
              <th className="py-3.5 px-6 text-center">Aksi</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[#e0e0e0]/40 text-xs font-medium">
            {displayOrders.length === 0 ? (
              <tr>
                <td colSpan="6" className="py-12 text-center text-slate-400 font-bold">
                  Tidak ada data antrean yang sesuai dengan filter.
                </td>
              </tr>
            ) : (
              displayOrders.map((order) => {
                const workPct = getWorkPercentage(order.workStatus);
                const pctTone = percentageTone(workPct);

                return (
                  <tr
                    key={order.id}
                    onClick={() => openOrderModal(order)}
                    className="hover:bg-[#5f1340]/[0.03] cursor-pointer transition-colors group"
                    title="Klik untuk update status per item (modal cepat)"
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
                      <span className="font-extrabold text-[#313030] block leading-tight">{formatName(order.customerName)}</span>
                      <button
                        type="button"
                        onClick={(e) => handleOpenWA(e, order)}
                        className="text-[10px] text-emerald-600 hover:text-emerald-700 font-mono font-bold mt-0.5 hover:underline cursor-pointer inline-flex items-center gap-0.5"
                        title={`Klik untuk kirim pesan WhatsApp ke ${order.customerName}`}
                      >
                        <span>{order.customerPhone}</span>
                      </button>
                    </td>

                    {/* Status Pengerjaan */}
                    <td className="py-3.5 px-6 text-center whitespace-nowrap">
                      <span
                        title={order.workStatus}
                        className={`inline-flex items-center justify-center min-w-[52px] px-3 py-1 rounded-full border text-xs font-black shadow-2xs ${pctTone.bg} ${pctTone.text}`}
                      >
                        {formatWorkPercentage(order.workStatus)}
                      </span>
                    </td>

                    {/* Tagihan */}
                    <td className="py-3.5 px-6 font-black text-[#313030] text-sm whitespace-nowrap">
                      Rp {order.totalAmount.toLocaleString('id-ID')}
                    </td>

                    {/* Status Bayar */}
                    <td className="py-3.5 px-6 text-center whitespace-nowrap">
                      {order.paymentStatus === 'Lunas' ? (
                        <span className="px-3 py-1 rounded-xl bg-emerald-50 text-emerald-700 border border-emerald-200 text-[10px] font-black inline-flex items-center gap-1 shadow-2xs whitespace-nowrap">
                          <CheckCircle2 className="h-3 w-3 text-emerald-600" />
                          <span>Lunas ({order.paymentMethod})</span>
                        </span>
                      ) : order.paymentStatus === 'DP' ? (
                        <button
                          type="button"
                          onClick={(e) => openPaymentModal(order, e)}
                          className="px-3 py-1 rounded-xl bg-amber-50 hover:bg-amber-600 text-amber-800 hover:text-white border border-amber-200 text-[10px] font-black inline-flex items-center gap-1 transition-all shadow-2xs cursor-pointer whitespace-nowrap group/pay"
                          title="Klik untuk update pembayaran / pelunasan"
                        >
                          <AlertCircle className="h-3 w-3" />
                          <span>DP ({order.paymentMethod})</span>
                        </button>
                      ) : (
                        <button
                          type="button"
                          onClick={(e) => openPaymentModal(order, e)}
                          className="px-3 py-1 rounded-xl bg-rose-50 hover:bg-rose-600 text-rose-700 hover:text-white border border-rose-200 text-[10px] font-black inline-flex items-center gap-1 transition-all shadow-2xs cursor-pointer whitespace-nowrap group/pay"
                          title="Klik untuk update pembayaran / pelunasan"
                        >
                          <AlertCircle className="h-3 w-3 text-rose-600 group-hover/pay:text-white" />
                          <span>Outstanding</span>
                        </button>
                      )}
                    </td>

                    {/* Aksi Kasir */}
                    <td className="py-3.5 px-6 text-center whitespace-nowrap">
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          handlePrintNota(order);
                        }}
                        className="p-2 rounded-xl border border-[#e0e0e0] bg-white hover:bg-[#5f1340] hover:text-white text-slate-700 transition-all cursor-pointer shadow-2xs inline-flex items-center justify-center group/print"
                        title="Cetak Struk Nota Bluetooth"
                      >
                        <Printer className="h-4 w-4" />
                      </button>
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
        <span>Menampilkan {displayOrders.length} dari {orders.length} transaksi terdaftar</span>
      </div>

      {/* Modal Rincian Status Per Item */}
      {selectedOrderModal && (
        <div className="fixed inset-0 z-50 bg-[#313030]/60 backdrop-blur-sm flex justify-center items-center p-4">
          <div className="bg-white rounded-3xl border border-[#e0e0e0] w-full max-w-2xl shadow-2xl overflow-hidden animate-fade-in flex flex-col max-h-[90vh]">
            {/* Modal Header */}
            <div className="p-5 border-b border-[#e0e0e0] flex justify-between items-center bg-gradient-to-r from-slate-50 via-white to-pink-50/20">
              <div>
                <div className="flex items-center gap-2">
                  <h3 className="text-base font-black text-[#313030]">Rincian Status Nota {selectedOrderModal.id}</h3>
                  <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-black border ${percentageTone(getWorkPercentage(selectedOrderModal.workStatus)).bg} ${percentageTone(getWorkPercentage(selectedOrderModal.workStatus)).text}`}>
                    Akumulasi: {formatWorkPercentage(selectedOrderModal.workStatus)}
                  </span>
                </div>
                <p className="text-xs text-slate-400 mt-0.5">Detail pengerjaan item cucian & status pelunasan</p>
              </div>
              <button
                type="button"
                onClick={() => setSelectedOrderModal(null)}
                className="p-1.5 hover:bg-slate-100 rounded-xl text-slate-400 hover:text-slate-600 transition-colors cursor-pointer"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-6 overflow-y-auto flex flex-col gap-5 text-xs">
              {/* Customer & Order Summary Cards */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 p-4 bg-slate-50 border border-[#e0e0e0] rounded-2xl">
                <div>
                  <span className="text-[10px] font-extrabold text-slate-400 uppercase tracking-wider block">Pelanggan</span>
                  <span className="font-extrabold text-[#313030] text-sm mt-0.5 block">{selectedOrderModal.customerName}</span>
                  <button
                    type="button"
                    onClick={(e) => handleOpenWA(e, selectedOrderModal)}
                    className="text-[10px] text-emerald-600 hover:text-emerald-700 font-mono font-bold hover:underline cursor-pointer inline-flex items-center gap-0.5"
                    title={`Kirim WA ke ${selectedOrderModal.customerName}`}
                  >
                    <span>{selectedOrderModal.customerPhone}</span>
                  </button>
                </div>
                <div>
                  <span className="text-[10px] font-extrabold text-slate-400 uppercase tracking-wider block">Kategori & Parfum</span>
                  <span className="font-extrabold text-[#313030] mt-0.5 block">{selectedOrderModal.serviceType}</span>
                  <span className="text-[10px] text-pink-700 font-bold block">Aroma: {selectedOrderModal.perfume || 'Standar'}</span>
                </div>
                <div>
                  <span className="text-[10px] font-extrabold text-slate-400 uppercase tracking-wider block">Tagihan & Bayar</span>
                  <span className="font-black text-[#5f1340] text-sm mt-0.5 block">Rp {selectedOrderModal.totalAmount.toLocaleString('id-ID')}</span>
                  <span className={`text-[10px] font-extrabold ${selectedOrderModal.paymentStatus === 'Lunas' ? 'text-emerald-600' : 'text-rose-600'}`}>
                    {selectedOrderModal.paymentStatus} ({selectedOrderModal.paymentMethod})
                  </span>
                </div>
              </div>

              {/* Rincian Status Per Item Section */}
              <div>
                <div className="flex justify-between items-center mb-2.5">
                  <h4 className="font-black text-[#313030] text-xs uppercase tracking-wider flex items-center gap-1.5">
                    <Layers className="h-4 w-4 text-[#5f1340]" />
                    <span>Rincian Pengerjaan Item Cucian ({selectedOrderModal.items?.length || 1} Item)</span>
                  </h4>
                  <span className="text-[10px] text-slate-400">Ubah status via dropdown per item</span>
                </div>

                <div className="border border-[#e0e0e0] rounded-2xl overflow-hidden">
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="bg-slate-100/70 border-b border-[#e0e0e0] text-[10px] uppercase font-extrabold text-slate-500 tracking-wider">
                        <th className="py-2.5 px-4">Nama Item / Layanan</th>
                        <th className="py-2.5 px-4">Qty</th>
                        <th className="py-2.5 px-4">Status Item</th>
                        <th className="py-2.5 px-4 text-right">Subtotal</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[#e0e0e0] text-xs font-semibold">
                      {(selectedOrderModal.items && selectedOrderModal.items.length > 0) ? (
                        selectedOrderModal.items.map((it, idx) => {
                          const currentStatus = it.status || selectedOrderModal.workStatus || 'Antrean';
                          const itemMeta = STATUS_STEPS[currentStatus] || { text: 'text-slate-600', bg: 'bg-slate-100 border-slate-200', icon: Clock };
                          const options = workStatusOptions.includes(currentStatus)
                            ? workStatusOptions
                            : [currentStatus, ...workStatusOptions];

                          return (
                            <tr key={it.id || idx} className="hover:bg-slate-50">
                              <td className="py-3 px-4">
                                <span className="font-extrabold text-[#313030] block">{it.serviceName || selectedOrderModal.serviceType}</span>
                                {it.conditionNotes && it.conditionNotes !== '-' && (
                                  <span className="text-[10px] text-slate-400 block font-normal mt-0.5">Catatan: {it.conditionNotes}</span>
                                )}
                              </td>
                              <td className="py-3 px-4 font-bold text-slate-600">
                                {it.qty}
                              </td>
                              <td className="py-3 px-4">
                                <select
                                  value={currentStatus}
                                  disabled={updatingItemId === it.id || !it.id}
                                  onClick={(e) => e.stopPropagation()}
                                  onChange={(e) => handleUpdateItemStatus(it, e.target.value)}
                                  className={`w-full min-w-[140px] max-w-[180px] px-2.5 py-1.5 rounded-xl border text-[10px] font-black outline-none cursor-pointer disabled:opacity-60 ${itemMeta.bg} ${itemMeta.text}`}
                                >
                                  {options.map((s) => (
                                    <option key={s} value={s}>{getWorkPercentage(s)}% · {s}</option>
                                  ))}
                                </select>
                              </td>
                              <td className="py-3 px-4 text-right font-mono font-bold text-[#313030]">
                                Rp {(it.subtotal || selectedOrderModal.totalAmount).toLocaleString('id-ID')}
                              </td>
                            </tr>
                          );
                        })
                      ) : (
                        <tr className="hover:bg-slate-50">
                          <td className="py-3 px-4 font-extrabold text-[#313030]">
                            {selectedOrderModal.serviceType}
                          </td>
                          <td className="py-3 px-4 font-bold text-slate-600">
                            {selectedOrderModal.qty}
                          </td>
                          <td className="py-3 px-4">
                            <span className={`inline-flex items-center justify-center min-w-[52px] px-2.5 py-0.5 rounded-full border text-[10px] font-black ${percentageTone(getWorkPercentage(selectedOrderModal.workStatus)).bg} ${percentageTone(getWorkPercentage(selectedOrderModal.workStatus)).text}`}>
                              {formatWorkPercentage(selectedOrderModal.workStatus)}
                            </span>
                          </td>
                          <td className="py-3 px-4 text-right font-mono font-bold text-[#313030]">
                            Rp {selectedOrderModal.totalAmount.toLocaleString('id-ID')}
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Action Buttons Inside Modal */}
              <div className="flex flex-col sm:flex-row justify-between items-center gap-3 pt-3 border-t border-[#e0e0e0] mt-2">
                <div className="flex gap-2 w-full sm:w-auto flex-wrap">
                  {selectedOrderModal.paymentStatus !== 'Lunas' && (
                    <button
                      type="button"
                      onClick={() => openPaymentModal(selectedOrderModal)}
                      className="flex-1 sm:flex-initial px-4 py-2 bg-rose-600 hover:bg-rose-700 text-white text-xs font-black rounded-xl shadow-xs cursor-pointer"
                    >
                      Bayar Pelunasan
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => {
                      setSelectedOrderModal(null);
                      navigate(`/riwayat/${selectedOrderModal.id}`, { state: { from: '/dashboard' } });
                    }}
                    className="flex-1 sm:flex-initial px-4 py-2 border border-[#5f1340]/30 bg-[#5f1340]/5 hover:bg-[#5f1340] hover:text-white text-[#5f1340] text-xs font-black rounded-xl cursor-pointer inline-flex items-center justify-center gap-1.5"
                  >
                    <ExternalLink className="h-3.5 w-3.5" />
                    <span>Detail Lengkap</span>
                  </button>
                </div>

                <div className="flex gap-2 w-full sm:w-auto justify-end">
                  <button
                    type="button"
                    onClick={() => {
                      handlePrintNota(selectedOrderModal);
                    }}
                    className="px-4 py-2 border border-[#e0e0e0] bg-white hover:bg-slate-800 hover:text-white text-slate-700 text-xs font-bold rounded-xl cursor-pointer flex items-center gap-1.5"
                  >
                    <Printer className="h-4 w-4" />
                    <span>Cetak Struk</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setSelectedOrderModal(null)}
                    className="px-4 py-2 border border-[#e0e0e0] bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold rounded-xl cursor-pointer"
                  >
                    Tutup
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* MODAL: UPDATE PEMBAYARAN / PELUNASAN */}
      {paymentModalOrder && (
        <div className="fixed inset-0 z-[60] bg-[#313030]/60 backdrop-blur-xs flex justify-center items-center p-4">
          <div className="bg-white rounded-3xl border border-[#e0e0e0] w-full max-w-lg shadow-2xl overflow-hidden animate-fade-in max-h-[90vh] flex flex-col">
            <div className="p-5 border-b border-[#e0e0e0] flex justify-between items-center bg-[#5f1340]/5 shrink-0">
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
                      <div>
                        <label className="text-[11px] font-bold text-slate-500 uppercase tracking-wider block mb-1.5">
                          Metode Pembayaran
                        </label>
                        <select
                          value={paymentForm.paymentMethod}
                          onChange={(e) => setPaymentForm({ ...paymentForm, paymentMethod: e.target.value })}
                          className="w-full px-4 py-2.5 bg-white border border-[#e0e0e0] rounded-xl text-xs font-bold outline-none focus:border-[#5f1340] cursor-pointer"
                        >
                          {(paymentMethods.length ? paymentMethods : [{ name: 'Tunai Kasir', label: 'Tunai Kasir' }]).map((m) => (
                            <option key={m.id || m.name} value={m.name}>{m.label || m.name}</option>
                          ))}
                        </select>
                      </div>

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
