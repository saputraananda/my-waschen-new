import React, { useCallback, useEffect, useState } from 'react';
import { useNavigate, useParams, useLocation } from 'react-router-dom';
import axios from 'axios';
import HeaderNav from '../../../components/HeaderNav.jsx';
import ThermalNota from '../../../components/ThermalNota.jsx';
import CombinedReceiptModal from '../../../components/CombinedReceiptModal.jsx';
import { formatName, formatEmployeeName } from '../../../utils/FormatName.js';
import { formatRupiah, parseRupiah } from '../../../utils/FormatRupiah.js';
import { formatDateId } from '../../../utils/FilterDate.js';
import { STATUS_STEPS, DEFAULT_WORK_STATUSES, getWorkPercentage, percentageTone, formatWorkPercentage } from '../../../utils/workStatusMeta.js';
import { useAppDialog } from '../../../context/AppDialogContext.jsx';
import { getBankAccountForOutlet, getAllBankAccounts, OUTLET_BANK_ACCOUNTS } from '../../../utils/bankAccounts.js';
import CascadingPaymentSelector, { resolvePaymentMethodString } from '../../../components/CascadingPaymentSelector.jsx';
import {
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  Coins,
  CreditCard,
  History,
  Layers,
  Printer,
  Receipt,
  Upload,
  Wallet,
  X,
  UserCheck,
  Building2,
  ArrowRightLeft
} from 'lucide-react';

const normalizePaymentStatus = (status) => {
  if (status === 'Belum Lunas') return 'Outstanding';
  return status || 'Outstanding';
};

export default function DetailTransaction() {
  const { orderNo } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const { showAlert } = useAppDialog();

  const [userProfile, setUserProfile] = useState(null);
  const [outlets, setOutlets] = useState([]);
  const [activeOutletName, setActiveOutletName] = useState(localStorage.getItem('activeOutletName') || 'Waschen Laundry');
  const [activeOutletId, setActiveOutletId] = useState(localStorage.getItem('activeOutletId') || '');

  const [order, setOrder] = useState(null);
  const [items, setItems] = useState([]);
  const [logs, setLogs] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [expandedItemId, setExpandedItemId] = useState(null);
  const [workStatusOptions, setWorkStatusOptions] = useState(DEFAULT_WORK_STATUSES);
  const [updatingItemId, setUpdatingItemId] = useState(null);

  const [toast, setToast] = useState(null);
  const [printReceipt, setPrintReceipt] = useState(null);

  // Combined Multi-Invoice Payment Modal
  const [isCombinedModalOpen, setIsCombinedModalOpen] = useState(false);
  const [batchPrintData, setBatchPrintData] = useState(null);
  const [customerOutstandingOrders, setCustomerOutstandingOrders] = useState([]);
  const [unpaidCount, setUnpaidCount] = useState(0);

  // Payment modal
  const [paymentModalOpen, setPaymentModalOpen] = useState(false);
  const [paymentDetail, setPaymentDetail] = useState(null);
  const [paymentMethods, setPaymentMethods] = useState([]);
  const [mainCategory, setMainCategory] = useState('Tunai');
  const [edcCardType, setEdcCardType] = useState('Debit Card');
  const [isCrossTransfer, setIsCrossTransfer] = useState(false);
  const [crossBankOutletId, setCrossBankOutletId] = useState(1);
  const [paymentForm, setPaymentForm] = useState({
    additionalAmount: '',
    paymentMethod: 'Tunai',
    notes: '',
    overpaymentAction: 'change'
  });
  const [proofFile, setProofFile] = useState(null);
  const [isSubmittingPayment, setIsSubmittingPayment] = useState(false);
  const [isLoadingPayment, setIsLoadingPayment] = useState(false);

  const showToast = (title, message, type = 'success') => {
    setToast({ title, message, type });
    setTimeout(() => setToast(null), 3500);
  };

  const mapOrder = (raw) => ({
    dbId: raw.id,
    id: raw.order_no,
    customerId: raw.customer_id,
    customerCode: raw.customer_code,
    customerName: raw.customer_name || 'Pelanggan',
    customerPhone: raw.customer_phone || '-',
    customerTier: raw.customer_tier || 'Reguler',
    customerAddress: raw.customer_address || '-',
    branch: raw.outlet_name || raw.home_branch || activeOutletName,
    category: raw.order_category,
    serviceType: raw.speed_name ? `${raw.order_category} - ${raw.speed_name}` : raw.order_category,
    perfume: raw.parfume_name || 'Standar',
    speed: raw.speed_name || 'Reguler',
    isExpress: Number(raw.speed_surcharge) > 0,
    isDelivery: raw.is_delivery === 1,
    subtotal: parseFloat(raw.subtotal) || 0,
    discountAmount: parseFloat(raw.discount_amount) || 0,
    grandTotal: parseFloat(raw.grand_total) || 0,
    paidAmount: parseFloat(raw.paid_amount) || 0,
    changeAmount: parseFloat(raw.change_amount) || 0,
    paymentStatus: normalizePaymentStatus(raw.payment_status),
    paymentMethod: raw.payment_method || '-',
    paymentProofUrl: raw.payment_proof_url || null,
    paymentBatchNo: raw.payment_batch_no || null,
    workStatus: raw.work_status ?? 10,
    specialNotes: raw.special_notes || '-',
    cashierName: raw.cashier_name || raw.cashier_employee_name || (raw.cashier_employee_id ? `Kasir #${raw.cashier_employee_id}` : 'Kasir Waschen'),
    createdAt: formatDateId(raw.order_date),
    rawDate: raw.order_date
  });

  const mapItems = (rawItems, headerStatus) => (rawItems || []).map((it) => ({
    id: it.id,
    serviceName: it.service_name,
    qty: it.qty,
    unit: it.unit || 'Pcs',
    qtyDisplay: `${parseFloat(it.qty) || 0} ${it.unit || 'Pcs'}`,
    unitPrice: parseFloat(it.unit_price) || 0,
    subtotal: parseFloat(it.subtotal) || 0,
    status: it.item_work_status || 'Antrean',
    brand: it.brand || '-',
    color: it.color || '-',
    material: it.material || '-',
    size: it.size || '-',
    note: it.condition_notes || '-',
    isCleanox: it.is_cleanox === 1,
    photoUrl: it.photo_url || null
  }));

  const fetchDetail = useCallback(async () => {
    if (!orderNo) return;
    setIsLoading(true);
    try {
      const res = await axios.get(`/api/transactions/${orderNo}`);
      if (!res.data?.success || !res.data.data) {
        showToast('Nota Tidak Ditemukan', res.data?.message || `Nota ${orderNo} tidak ada`, 'error');
        setOrder(null);
        return;
      }
      const raw = res.data.data;
      const mapped = mapOrder(raw);
      setOrder(mapped);
      setItems(mapItems(raw.items, mapped.workStatus));
      setLogs(raw.logs || []);
      document.title = `Detail ${mapped.id} | Waschen Laundry`;

      // Fetch outstanding notes for the same customer (by customer_id, bukan nama/HP longgar)
      if (raw.customer_id) {
        axios.get('/api/transactions', {
          params: { customer_id: raw.customer_id }
        }).then(tRes => {
          if (tRes.data?.data) {
            const mappedList = tRes.data.data.map(rawTx => ({
              dbId: rawTx.id,
              orderId: rawTx.order_no,
              orderNo: rawTx.order_no,
              amount: parseFloat(rawTx.grand_total) || 0,
              paidAmount: parseFloat(rawTx.paid_amount) || 0,
              paymentStatus: rawTx.payment_status,
              category: rawTx.order_category,
              date: rawTx.order_date
            }));
            setCustomerOutstandingOrders(mappedList);
            const unpaid = mappedList.filter(o => o.paymentStatus === 'Outstanding' || o.paymentStatus === 'DP' || (o.amount > o.paidAmount));
            setUnpaidCount(unpaid.length);
          }
        }).catch(() => {});
      }
    } catch (err) {
      console.error('Gagal memuat detail nota:', err);
      showToast('Gagal Memuat', err.response?.data?.message || 'Tidak dapat memuat detail nota', 'error');
      setOrder(null);
    } finally {
      setIsLoading(false);
    }
  }, [orderNo, activeOutletName]);

  useEffect(() => {
    const token = localStorage.getItem('token');
    if (!token) {
      navigate('/login', { replace: true });
      return;
    }
    const isHq = localStorage.getItem('companyId') === '1';
    setUserProfile({
      fullName: localStorage.getItem('fullName') || 'Kasir Waschen',
      role: isHq ? 'Management Alora' : (localStorage.getItem('activeRole') || 'Staff Kasir')
    });

    axios.get('/api/masters/outlets')
      .then((res) => {
        if (res.data?.success) setOutlets(res.data.data || []);
      })
      .catch(() => {});

    axios.get('/api/masters/work-statuses')
      .then((res) => {
        if (res.data?.success && res.data.data?.length) {
          setWorkStatusOptions(res.data.data.map((s) => s.name || s.label).filter(Boolean));
        }
      })
      .catch(() => setWorkStatusOptions(DEFAULT_WORK_STATUSES));

    fetchDetail();
  }, [navigate, fetchDetail]);

  const handleUpdateItemStatus = async (item, nextStatus) => {
    if (!order?.dbId || !item?.id) return;
    if (item.status === nextStatus) return;

    setUpdatingItemId(item.id);
    try {
      const res = await axios.patch(
        `/api/transactions/${order.dbId}/items/${item.id}/status`,
        {
          workStatus: nextStatus,
          employeeId: parseInt(localStorage.getItem('employeeId'), 10) || 167
        }
      );
      if (!res.data?.success) {
        showToast('Gagal Update', res.data?.message || 'Gagal mengubah status item', 'error');
        return;
      }
      const accumulated = res.data.data?.workStatus || nextStatus;
      setItems((prev) => prev.map((it) => (it.id === item.id ? { ...it, status: nextStatus } : it)));
      setOrder((prev) => (prev ? { ...prev, workStatus: accumulated } : prev));
      showToast('Status Item Diperbarui', `${item.serviceName} → ${nextStatus}`);
      fetchDetail();
    } catch (err) {
      showToast('Gagal Update', err.response?.data?.message || 'Koneksi server gagal', 'error');
    } finally {
      setUpdatingItemId(null);
    }
  };

  const openCombinedPaymentModal = async () => {
    if (!order) return;
    setIsCombinedModalOpen(true);
    try {
      const res = await axios.get('/api/transactions', {
        params: { search: order.customerPhone || order.customerName }
      });
      if (res.data?.data && res.data.data.length > 0) {
        const mapped = res.data.data.map(raw => ({
          dbId: raw.id,
          orderId: raw.order_no,
          orderNo: raw.order_no,
          amount: parseFloat(raw.grand_total) || 0,
          paidAmount: parseFloat(raw.paid_amount) || 0,
          paymentStatus: raw.payment_status,
          category: raw.order_category,
          date: raw.order_date
        }));
        setCustomerOutstandingOrders(mapped);
      } else {
        setCustomerOutstandingOrders([
          {
            dbId: order.dbId,
            orderId: order.id,
            orderNo: order.id,
            amount: order.grandTotal,
            paidAmount: order.paidAmount,
            paymentStatus: order.paymentStatus,
            category: order.category,
            date: order.createdAt
          }
        ]);
      }
    } catch (err) {
      console.error('Error fetching customer transactions:', err);
      setCustomerOutstandingOrders([
        {
          dbId: order.dbId,
          orderId: order.id,
          orderNo: order.id,
          amount: order.grandTotal,
          paidAmount: order.paidAmount,
          paymentStatus: order.paymentStatus,
          category: order.category,
          date: order.createdAt
        }
      ]);
    }
  };

  const openPaymentModal = async () => {
    if (!order) return;
    setPaymentModalOpen(true);
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
        axios.get(`/api/history/transactions/${order.dbId}/payments`),
        axios.get('/api/masters/payment-methods')
      ]);
      if (logsRes.data?.success) setPaymentDetail(logsRes.data.data);
      if (methodsRes.data?.success) {
        setPaymentMethods((methodsRes.data.data || []).filter((m) => !m.requires_member_balance));
      }
    } catch (err) {
      showToast('Gagal Memuat', err.response?.data?.message || 'Tidak dapat memuat riwayat pembayaran', 'error');
    } finally {
      setIsLoadingPayment(false);
    }
  };

  const handleSubmitPaymentUpdate = async () => {
    if (!order) return;
    const addAmount = parseRupiah(paymentForm.additionalAmount);
    if (normalizePaymentStatus(order.paymentStatus) === 'Lunas') {
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

    setIsSubmittingPayment(true);
    try {
      let proofUrl = paymentDetail?.order?.payment_proof_url || order.paymentProofUrl || null;
      if (proofFile) {
        const fd = new FormData();
        fd.append('proof', proofFile);
        const up = await axios.post(`/api/history/transactions/${order.dbId}/payment-proof`, fd);
        proofUrl = up.data?.data?.paymentProofUrl || proofUrl;
      }

      const resolvedPaymentMethod = resolvePaymentMethodString({
        mainCategory,
        edcCardType,
        isCrossTransfer,
        crossBankOutletId,
        activeOutletId,
        activeOutletName
      });

      const res = await axios.patch(`/api/history/transactions/${order.dbId}/payment`, {
        additionalAmount: addAmount,
        paymentMethod: resolvedPaymentMethod,
        paymentProofUrl: proofUrl,
        notes: paymentForm.notes || `Pelunasan nota ${order.id}`,
        overpaymentToDeposit: paymentForm.overpaymentAction === 'deposit',
        cashierEmployeeId: localStorage.getItem('employeeId') || null
      });

      const updated = res.data?.data;
      showToast('Pembayaran Diperbarui', `Nota ${order.id} — ${updated?.paymentStatus || 'OK'}`);
      setPaymentModalOpen(false);
      setPaymentDetail(null);
      fetchDetail();
    } catch (err) {
      showToast('Gagal Bayar', err.response?.data?.message || 'Terjadi kesalahan sistem', 'error');
    } finally {
      setIsSubmittingPayment(false);
    }
  };

  const handlePrint = async () => {
    if (!order) return;

    if (order.paymentBatchNo) {
      try {
        const res = await axios.get(`/api/transactions/batch/${order.paymentBatchNo}`);
        if (res.data && res.data.success) {
          setBatchPrintData(res.data.data);
          setIsCombinedModalOpen(true);
          return;
        }
      } catch (err) {
        console.error('Error fetching payment batch for print:', err);
      }
    }

    setPrintReceipt({
      id: order.id,
      customerName: order.customerName,
      customerPhone: order.customerPhone,
      customerAddress: order.customerAddress,
      cashierName: order.cashierName,
      branch: order.branch,
      createdAt: order.createdAt,
      perfume: order.perfume,
      isExpress: order.isExpress,
      isDelivery: order.isDelivery,
      discountAmount: order.discountAmount,
      grandTotal: order.grandTotal,
      paidAmount: order.paidAmount,
      changeAmount: order.changeAmount,
      paymentStatus: order.paymentStatus,
      paymentMethod: order.paymentMethod,
      paymentBatchNo: order.paymentBatchNo,
      items: items.map((it) => ({
        name: it.serviceName,
        qtyDisplay: it.qtyDisplay,
        effectiveSubtotal: it.subtotal,
        brand: it.brand,
        color: it.color,
        note: it.note,
        isCleanox: it.isCleanox
      }))
    });
  };

  const paymentStatus = normalizePaymentStatus(order?.paymentStatus);
  const remaining = Math.max(0, (order?.grandTotal || 0) - (order?.paidAmount || 0));

  return (
    <div className="min-h-screen bg-[#f8f8f8] text-[#313030] flex flex-col font-sans">
      <HeaderNav
        activeOutletName={activeOutletName}
        setActiveOutletName={setActiveOutletName}
        activeOutletId={activeOutletId}
        setActiveOutletId={setActiveOutletId}
        outlets={outlets}
        userProfile={userProfile}
      />

      {toast && (
        <div className="fixed top-5 right-5 z-50 animate-bounce">
          <div className={`p-4 rounded-2xl shadow-2xl border flex items-center gap-3 ${
            toast.type === 'error' ? 'bg-rose-50 border-rose-200 text-rose-900' : 'bg-emerald-50 border-emerald-200 text-emerald-900'
          }`}>
            <CheckCircle2 className="h-5 w-5" />
            <div>
              <span className="font-extrabold text-xs block">{toast.title}</span>
              <span className="text-[11px] font-medium">{toast.message}</span>
            </div>
          </div>
        </div>
      )}

      <main className="max-w-[1200px] w-full mx-auto p-4 sm:p-6 flex-grow flex flex-col gap-5">
        {isLoading ? (
          <div className="bg-white border border-[#e0e0e0] rounded-3xl p-12 text-center text-slate-400 font-bold text-sm">
            Memuat rincian transaksi...
          </div>
        ) : !order ? (
          <div className="bg-white border border-[#e0e0e0] rounded-3xl p-12 text-center">
            <span className="font-black text-[#313030] block mb-2">Nota tidak ditemukan</span>
            <button
              type="button"
              onClick={() => navigate(location.state?.from || '/riwayat')}
              className="mt-3 px-4 py-2 bg-[#5f1340] text-white text-xs font-bold rounded-xl cursor-pointer"
            >
              Kembali ke Riwayat
            </button>
          </div>
        ) : (
          <>
            {/* Header card */}
            <div className="bg-white border border-[#e0e0e0] rounded-3xl p-5 shadow-2xs">
              <div className="flex flex-col lg:flex-row lg:items-start justify-between gap-4">
                <div>
                  <div className="flex items-center gap-2 flex-wrap">
                    <Receipt className="h-5 w-5 text-[#5f1340]" />
                    <h1 className="text-lg sm:text-xl font-black text-[#313030]">Rincian Nota {order.id}</h1>
                    <span
                      title={order.workStatus}
                      className={`inline-flex items-center justify-center min-w-[52px] px-2.5 py-0.5 rounded-full border text-[10px] font-black ${percentageTone(getWorkPercentage(order.workStatus)).bg} ${percentageTone(getWorkPercentage(order.workStatus)).text}`}
                    >
                      {formatWorkPercentage(order.workStatus)}
                    </span>
                  </div>
                  <p className="text-xs text-slate-400 mt-1">{order.createdAt} · {order.branch}</p>
                </div>

                <div className="flex flex-wrap gap-2">
                  {paymentStatus !== 'Lunas' && (
                    <button
                      type="button"
                      onClick={openPaymentModal}
                      className="px-4 py-2 bg-rose-600 hover:bg-rose-700 text-white text-xs font-black rounded-xl cursor-pointer inline-flex items-center gap-1.5"
                    >
                      <Wallet className="h-3.5 w-3.5" />
                      Update Pembayaran
                    </button>
                  )}
                  {unpaidCount >= 2 && (
                    <button
                      type="button"
                      onClick={openCombinedPaymentModal}
                      className="px-4 py-2 bg-[#5f1340] hover:bg-[#4d0f33] text-amber-200 text-xs font-black rounded-xl cursor-pointer inline-flex items-center gap-1.5 shadow-xs"
                      title="Gabungkan pelunasan beberapa nota tertunggak milik pelanggan ini"
                    >
                      <Receipt className="h-3.5 w-3.5" />
                      Pelunasan Gabungan Nota
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={handlePrint}
                    className="px-4 py-2 border border-[#e0e0e0] bg-white hover:bg-slate-800 hover:text-white text-slate-700 text-xs font-bold rounded-xl cursor-pointer inline-flex items-center gap-1.5"
                  >
                    <Printer className="h-4 w-4" />
                    Cetak Nota
                  </button>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 mt-5">
                <div className="p-3.5 bg-[#f8f8f8] border border-[#e0e0e0] rounded-2xl">
                  <span className="text-[10px] font-bold text-slate-400 uppercase block">Pelanggan</span>
                  <span className="font-black text-sm text-[#313030] block mt-0.5">{formatName(order.customerName)}</span>
                  <span className="text-[11px] font-mono text-emerald-700">{order.customerPhone}</span>
                  <span className="text-[10px] text-slate-500 block mt-0.5 truncate">{order.customerAddress}</span>
                </div>
                <div className="p-3.5 bg-[#f8f8f8] border border-[#e0e0e0] rounded-2xl">
                  <span className="text-[10px] font-bold text-slate-400 uppercase block">Layanan</span>
                  <span className="font-black text-sm text-[#313030] block mt-0.5">{order.serviceType}</span>
                  <span className="text-[11px] text-pink-700 font-bold">Aroma: {order.perfume}</span>
                  <span className="text-[10px] text-slate-500 block">{order.isDelivery ? 'Diantar' : 'Ambil di outlet'}</span>
                </div>
                <div className="p-3.5 bg-[#f8f8f8] border border-[#e0e0e0] rounded-2xl">
                  <span className="text-[10px] font-bold text-slate-400 uppercase block">Tagihan</span>
                  <span className="font-black text-sm text-[#5f1340] block mt-0.5">Rp {order.grandTotal.toLocaleString('id-ID')}</span>
                  <span className={`text-[11px] font-extrabold ${
                    paymentStatus === 'Lunas' ? 'text-emerald-600' : paymentStatus === 'DP' ? 'text-amber-700' : 'text-rose-600'
                  }`}>
                    {paymentStatus} ({order.paymentMethod})
                  </span>
                  {paymentStatus !== 'Lunas' && (
                    <span className="text-[10px] text-slate-500 block">Sisa: Rp {remaining.toLocaleString('id-ID')}</span>
                  )}
                </div>
                <div className="p-3.5 bg-[#f8f8f8] border border-[#e0e0e0] rounded-2xl">
                  <span className="text-[10px] font-bold text-slate-400 uppercase block">Kasir</span>
                  <span className="font-black text-sm text-[#313030] block mt-0.5">{formatEmployeeName(order.cashierName)}</span>
                  <span className="text-[10px] text-slate-500 block">Catatan: {order.specialNotes}</span>
                </div>
              </div>
            </div>

            {/* Items */}
            <div className="bg-white border border-[#e0e0e0] rounded-3xl p-5 shadow-2xs">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-sm font-black text-[#313030] uppercase tracking-wider flex items-center gap-2">
                  <Layers className="h-4 w-4 text-[#5f1340]" />
                  Item Cucian ({items.length})
                </h2>
                <span className="text-[10px] text-slate-400">Klik baris untuk detail fisik · ubah status via dropdown</span>
              </div>

              <div className="border border-[#e0e0e0] rounded-2xl overflow-hidden">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="bg-slate-100/70 border-b border-[#e0e0e0] text-[10px] uppercase font-extrabold text-slate-500 tracking-wider">
                      <th className="py-2.5 px-4 w-8" />
                      <th className="py-2.5 px-4">Nama Item / Layanan</th>
                      <th className="py-2.5 px-4">Qty</th>
                      <th className="py-2.5 px-4">Status Pengerjaan</th>
                      <th className="py-2.5 px-4 text-right">Subtotal</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#e0e0e0] text-xs">
                    {items.map((it) => {
                      const meta = STATUS_STEPS[it.status] || STATUS_STEPS.Antrean;
                      const options = workStatusOptions.includes(it.status)
                        ? workStatusOptions
                        : [it.status, ...workStatusOptions];
                      const isOpen = expandedItemId === it.id;

                      return (
                        <React.Fragment key={it.id}>
                          <tr className="hover:bg-slate-50">
                            <td className="py-3 px-3">
                              <button
                                type="button"
                                onClick={() => setExpandedItemId(isOpen ? null : it.id)}
                                className="p-1 rounded-lg text-slate-400 hover:text-[#5f1340] hover:bg-[#5f1340]/10 cursor-pointer"
                                title="Lihat detail item"
                              >
                                {isOpen ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                              </button>
                            </td>
                            <td className="py-3 px-4">
                              <span className="font-extrabold text-[#313030] block">{it.serviceName}</span>
                              {it.isCleanox && (
                                <span className="text-[9px] font-black text-sky-800 bg-sky-50 border border-sky-200 px-1.5 py-0.5 rounded-full">Cleanox</span>
                              )}
                            </td>
                            <td className="py-3 px-4 font-bold text-slate-600">{it.qtyDisplay}</td>
                            <td className="py-3 px-4">
                              <select
                                value={it.status}
                                disabled={updatingItemId === it.id}
                                onChange={(e) => handleUpdateItemStatus(it, e.target.value)}
                                className={`w-full min-w-[150px] max-w-[200px] px-2.5 py-1.5 rounded-xl border text-[10px] font-black outline-none cursor-pointer disabled:opacity-60 ${meta.bg} ${meta.text}`}
                              >
                                {options.map((s) => (
                                  <option key={s} value={s}>{getWorkPercentage(s)}% · {s}</option>
                                ))}
                              </select>
                            </td>
                            <td className="py-3 px-4 text-right font-mono font-bold">
                              Rp {it.subtotal.toLocaleString('id-ID')}
                            </td>
                          </tr>
                          {isOpen && (
                            <tr className="bg-[#f8f8f8]/80">
                              <td colSpan={5} className="px-4 py-3">
                                <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2 text-[11px]">
                                  <div>
                                    <span className="text-slate-400 font-bold block uppercase text-[9px]">Merk</span>
                                    <span className="font-bold text-[#313030]">{it.brand}</span>
                                  </div>
                                  <div>
                                    <span className="text-slate-400 font-bold block uppercase text-[9px]">Warna</span>
                                    <span className="font-bold text-[#313030]">{it.color}</span>
                                  </div>
                                  <div>
                                    <span className="text-slate-400 font-bold block uppercase text-[9px]">Material</span>
                                    <span className="font-bold text-[#313030]">{it.material}</span>
                                  </div>
                                  <div>
                                    <span className="text-slate-400 font-bold block uppercase text-[9px]">Ukuran</span>
                                    <span className="font-bold text-[#313030]">{it.size}</span>
                                  </div>
                                  <div>
                                    <span className="text-slate-400 font-bold block uppercase text-[9px]">Harga / Unit</span>
                                    <span className="font-bold text-[#313030]">Rp {it.unitPrice.toLocaleString('id-ID')}</span>
                                  </div>
                                  <div className="sm:col-span-2 lg:col-span-1">
                                    <span className="text-slate-400 font-bold block uppercase text-[9px]">Catatan Fisik</span>
                                    <span className="font-bold text-[#313030]">{it.note}</span>
                                  </div>
                                </div>
                              </td>
                            </tr>
                          )}
                        </React.Fragment>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Status logs */}
            {logs.length > 0 && (
              <div className="bg-white border border-[#e0e0e0] rounded-3xl p-5 shadow-2xs">
                <h2 className="text-sm font-black text-[#313030] uppercase tracking-wider flex items-center gap-2 mb-3">
                  <History className="h-4 w-4 text-[#5f1340]" />
                  Log Status Pengerjaan
                </h2>
                <div className="space-y-2 max-h-48 overflow-y-auto">
                  {logs.map((log) => (
                    <div key={log.id || `${log.status}-${log.created_at}`} className="p-2.5 bg-[#f8f8f8] border border-[#e0e0e0] rounded-xl flex justify-between gap-3 text-xs">
                      <div>
                        <span className="font-black text-[#313030]">{log.status}</span>
                        {log.notes && <span className="text-[10px] text-slate-500 block">{log.notes}</span>}
                      </div>
                      <span className="text-[10px] text-slate-400 shrink-0">
                        {log.created_at ? formatDateId(log.created_at) : ''}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </>
        )}
      </main>

      {printReceipt && (
        <ThermalNota
          createdOrderReceipt={printReceipt}
          onClose={() => setPrintReceipt(null)}
        />
      )}

      {/* Payment modal */}
      {paymentModalOpen && order && (
        <div className="fixed inset-0 z-50 bg-[#313030]/75 backdrop-blur-xs flex justify-center items-center p-3 sm:p-6 overflow-y-auto">
          <div className="bg-white rounded-3xl border border-[#e0e0e0] w-full max-w-lg shadow-2xl overflow-hidden flex flex-col max-h-[calc(100vh-4rem)] sm:max-h-[85vh] my-auto">
            <div className="p-4 sm:p-5 border-b border-[#e0e0e0] flex justify-between items-center bg-[#5f1340]/5 shrink-0">
              <div className="flex items-center gap-2">
                <CreditCard className="h-5 w-5 text-[#5f1340]" />
                <div>
                  <h3 className="text-sm font-black text-[#313030]">Update Pembayaran — {order.id}</h3>
                  <span className="text-[10px] text-slate-400">{formatName(order.customerName)}</span>
                </div>
              </div>
              <button type="button" onClick={() => { setPaymentModalOpen(false); setPaymentDetail(null); }} className="p-1 text-slate-400 hover:text-[#313030]">
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
                      <span className="text-[10px] font-bold text-slate-400 block uppercase">Total</span>
                      <span className="font-black text-[#5f1340] text-sm">
                        Rp {(paymentDetail?.grandTotal || order.grandTotal || 0).toLocaleString('id-ID')}
                      </span>
                    </div>
                    <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-xl text-center">
                      <span className="text-[10px] font-bold text-emerald-600 block uppercase">Sudah Bayar</span>
                      <span className="font-black text-emerald-800 text-sm">
                        Rp {(paymentDetail?.paidAmount ?? order.paidAmount ?? 0).toLocaleString('id-ID')}
                      </span>
                    </div>
                    <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-center">
                      <span className="text-[10px] font-bold text-rose-600 block uppercase">Sisa</span>
                      <span className="font-black text-rose-800 text-sm">
                        Rp {(paymentDetail?.remaining ?? remaining).toLocaleString('id-ID')}
                      </span>
                    </div>
                  </div>

                  {paymentStatus !== 'Lunas' && (
                    <>
                      {unpaidCount >= 2 && (
                        <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl flex items-center justify-between gap-2 text-xs">
                          <div className="flex items-center gap-2">
                            <Receipt className="h-4 w-4 text-amber-700 shrink-0" />
                            <span className="text-[11px] font-bold text-amber-900">
                              Ingin melunasi beberapa nota sekaligus dalam 1 kali bayar?
                            </span>
                          </div>
                          <button
                            type="button"
                            onClick={() => {
                              setPaymentModalOpen(false);
                              openCombinedPaymentModal();
                            }}
                            className="px-2.5 py-1 bg-[#5f1340] text-amber-200 rounded-lg text-[10px] font-black shrink-0 hover:bg-[#4d0f33] cursor-pointer shadow-xs"
                          >
                            Gabung Bayar Nota
                          </button>
                        </div>
                      )}

                      <CascadingPaymentSelector
                        mainCategory={mainCategory}
                        setMainCategory={setMainCategory}
                        edcCardType={edcCardType}
                        setEdcCardType={setEdcCardType}
                        isCrossTransfer={isCrossTransfer}
                        setIsCrossTransfer={setIsCrossTransfer}
                        crossBankOutletId={crossBankOutletId}
                        setCrossBankOutletId={setCrossBankOutletId}
                        activeOutletId={activeOutletId}
                        activeOutletName={activeOutletName}
                        outlets={outlets}
                        paymentMethods={paymentMethods}
                        selectedCustomer={order}
                        grandTotal={paymentDetail?.remaining || remaining || order.grandTotal}
                      />
                      <div>
                        <label className="text-[11px] font-bold text-slate-500 uppercase tracking-wider block mb-1.5">Nominal Bayar (Rp)</label>
                        <input
                          type="text"
                          inputMode="numeric"
                          value={paymentForm.additionalAmount}
                          onChange={(e) => setPaymentForm({ ...paymentForm, additionalAmount: formatRupiah(e.target.value) })}
                          placeholder={formatRupiah(paymentDetail?.remaining || remaining || order.grandTotal)}
                          className="w-full px-4 py-2.5 bg-white border border-[#e0e0e0] rounded-xl text-sm font-black outline-none focus:border-[#5f1340]"
                        />
                        <div className="flex flex-wrap gap-2 mt-2">
                          {[paymentDetail?.remaining || remaining, 50000, 100000, 200000]
                            .filter((v, i, arr) => v > 0 && arr.indexOf(v) === i)
                            .slice(0, 4)
                            .map((preset) => (
                              <button
                                key={preset}
                                type="button"
                                onClick={() => setPaymentForm({ ...paymentForm, additionalAmount: formatRupiah(preset) })}
                                className="px-3 py-1 rounded-lg bg-[#f8f8f8] border border-[#e0e0e0] text-[10px] font-bold text-slate-600 hover:border-[#5f1340] cursor-pointer"
                              >
                                {preset === (paymentDetail?.remaining || remaining) ? 'Lunas Pas' : formatRupiah(preset, true)}
                              </button>
                            ))}
                        </div>
                      </div>
                      <div>
                        <label className="text-[11px] font-bold text-slate-500 uppercase tracking-wider block mb-1.5">Catatan</label>
                        <input
                          type="text"
                          value={paymentForm.notes}
                          onChange={(e) => setPaymentForm({ ...paymentForm, notes: e.target.value })}
                          placeholder="Opsional"
                          className="w-full px-4 py-2.5 bg-white border border-[#e0e0e0] rounded-xl text-xs outline-none focus:border-[#5f1340]"
                        />
                      </div>
                      <div>
                        <label className="text-[11px] font-bold text-slate-500 uppercase tracking-wider block mb-1.5">Bukti Pembayaran</label>
                        <label className="flex flex-col items-center justify-center w-full p-4 border-2 border-dashed border-[#e0e0e0] rounded-xl cursor-pointer hover:border-[#5f1340]/40">
                          <Upload className="h-4 w-4 text-slate-400 mb-1" />
                          <span className="text-[10px] font-bold text-slate-500">{proofFile ? proofFile.name : 'Upload foto/PDF'}</span>
                          <input type="file" accept="image/jpeg,image/png,image/webp,application/pdf" className="hidden" onChange={(e) => setProofFile(e.target.files?.[0] || null)} />
                        </label>
                      </div>
                      {parseRupiah(paymentForm.additionalAmount) > (paymentDetail?.remaining || remaining || 0) && (
                        <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl space-y-2">
                          <div className="flex items-center gap-1.5 text-xs font-bold text-amber-900">
                            <Coins className="h-4 w-4" />
                            Kelebihan: Rp {(parseRupiah(paymentForm.additionalAmount) - (paymentDetail?.remaining || remaining || 0)).toLocaleString('id-ID')}
                          </div>
                          <div className="grid grid-cols-2 gap-2">
                            <button type="button" onClick={() => setPaymentForm({ ...paymentForm, overpaymentAction: 'change' })} className={`py-2 rounded-lg text-[10px] font-black cursor-pointer ${paymentForm.overpaymentAction === 'change' ? 'bg-amber-600 text-white' : 'bg-white border border-amber-300 text-amber-900'}`}>Kembalian Tunai</button>
                            <button type="button" onClick={() => setPaymentForm({ ...paymentForm, overpaymentAction: 'deposit' })} className={`py-2 rounded-lg text-[10px] font-black cursor-pointer ${paymentForm.overpaymentAction === 'deposit' ? 'bg-emerald-600 text-white' : 'bg-white border border-emerald-300 text-emerald-800'}`}>Simpan ke Saldo</button>
                          </div>
                        </div>
                      )}
                    </>
                  )}
                </>
              )}
            </div>

            {paymentStatus !== 'Lunas' && !isLoadingPayment && (
              <div className="p-4 border-t border-[#e0e0e0] bg-[#f8f8f8] flex gap-2 shrink-0">
                <button type="button" onClick={() => { setPaymentModalOpen(false); setPaymentDetail(null); }} className="px-4 py-2.5 bg-white border border-[#e0e0e0] text-slate-700 font-bold rounded-xl text-xs cursor-pointer">Batal</button>
                <button type="button" disabled={isSubmittingPayment} onClick={handleSubmitPaymentUpdate} className="flex-1 py-2.5 bg-[#5f1340] hover:bg-[#4d0f33] disabled:opacity-50 text-white font-black rounded-xl text-xs cursor-pointer flex items-center justify-center gap-1.5">
                  <CheckCircle2 className="h-4 w-4" />
                  {isSubmittingPayment ? 'Menyimpan...' : 'Simpan Pembayaran'}
                </button>
              </div>
            )}
          </div>
        </div>
      )}
      {/* Combined Multi-Invoice Payment Modal */}
      <CombinedReceiptModal
        isOpen={isCombinedModalOpen}
        onClose={() => {
          setIsCombinedModalOpen(false);
          setBatchPrintData(null);
        }}
        customer={{
          dbId: order?.customerId,
          id: order?.customerCode || order?.customerId,
          name: order?.customerName,
          phone: order?.customerPhone,
          address: order?.customerAddress
        }}
        outstandingOrders={customerOutstandingOrders}
        activeOutletId={activeOutletId}
        activeOutletName={activeOutletName}
        paymentMethods={paymentMethods}
        initialBatchData={batchPrintData}
        onSuccess={() => {
          fetchDetail();
        }}
      />
    </div>
  );
}
