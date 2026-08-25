import React, { useState, useMemo, useEffect } from 'react';
import { createPortal } from 'react-dom';
import axios from 'axios';
import {
  Receipt,
  X,
  CheckSquare,
  Square,
  Upload,
  Printer,
  Loader2,
  CheckCircle2,
  AlertCircle,
  Wallet,
  CreditCard,
  Building2,
  Coins,
  ArrowRightLeft
} from 'lucide-react';
import { formatEmployeeName } from '../utils/FormatName.js';
import { formatRupiah, parseRupiah } from '../utils/FormatRupiah.js';
import { getBankAccountForOutlet, getAllBankAccounts, OUTLET_BANK_ACCOUNTS } from '../utils/bankAccounts.js';
import CascadingPaymentSelector, { resolvePaymentMethodString } from './CascadingPaymentSelector.jsx';

export default function CombinedReceiptModal({
  isOpen,
  onClose,
  customer,
  outstandingOrders = [],
  activeOutletId,
  activeOutletName,
  cashierEmployeeId,
  paymentMethods = [],
  initialBatchData = null,
  onSuccess
}) {
  const [selectedOrderIds, setSelectedOrderIds] = useState([]);
  const [mainCategory, setMainCategory] = useState('Tunai');
  const [edcCardType, setEdcCardType] = useState('Debit Card');
  const [isCrossTransfer, setIsCrossTransfer] = useState(false);
  const [crossBankOutletId, setCrossBankOutletId] = useState(1);
  const [paidAmountInput, setPaidAmountInput] = useState('');
  const [overpaymentAction, setOverpaymentAction] = useState('change');
  const [paymentProofFile, setPaymentProofFile] = useState(null);
  const [paymentProofUrl, setPaymentProofUrl] = useState('');
  const [isUploading, setIsUploading] = useState(false);
  const [notes, setNotes] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [settledBatchData, setSettledBatchData] = useState(initialBatchData);

  const isTransferBank = useMemo(() => {
    return String(mainCategory || '').toLowerCase().includes('transfer');
  }, [mainCategory]);

  const defaultBankAccount = useMemo(() => {
    return getBankAccountForOutlet(activeOutletId, activeOutletName);
  }, [activeOutletId, activeOutletName]);

  const selectedBankAccount = useMemo(() => {
    if (isCrossTransfer && OUTLET_BANK_ACCOUNTS[crossBankOutletId]) {
      return OUTLET_BANK_ACCOUNTS[crossBankOutletId];
    }
    return defaultBankAccount;
  }, [isCrossTransfer, crossBankOutletId, defaultBankAccount]);

  // Filter only unpaid or DP orders for this customer
  const unpaidOrders = useMemo(() => {
    return outstandingOrders.filter((o) => {
      const ps = o.paymentStatus || o.payment_status;
      return ps === 'Outstanding' || ps === 'DP' || (o.amount > (o.paidAmount || 0));
    });
  }, [outstandingOrders]);

  const [methodsList, setMethodsList] = useState(paymentMethods);

  // Fetch payment methods once on open if not loaded
  useEffect(() => {
    if (isOpen) {
      if (paymentMethods && paymentMethods.length > 0) {
        setMethodsList(paymentMethods);
      } else {
        axios
          .get('/api/masters/payment-methods')
          .then((res) => {
            if (res.data && res.data.success && res.data.data?.length > 0) {
              const filtered = res.data.data.filter((m) => !m.requires_member_balance);
              setMethodsList(filtered);
            }
          })
          .catch((err) => console.error('Error fetching payment methods:', err));
      }
    }
  }, [isOpen]);

  // Pre-select all unpaid orders or set initialBatchData on open
  useEffect(() => {
    if (isOpen) {
      if (initialBatchData) {
        setSettledBatchData(initialBatchData);
      } else {
        const allIds = unpaidOrders.map((o) => o.dbId || o.id);
        setSelectedOrderIds(allIds);
        setSettledBatchData(null);
      }
      setErrorMessage('');
      setPaymentProofFile(null);
      setPaymentProofUrl('');
      setNotes('');
    }
  }, [isOpen, initialBatchData, unpaidOrders]);

  const selectedOrders = unpaidOrders.filter((o) =>
    selectedOrderIds.includes(o.dbId || o.id)
  );

  const totalSelectedAmount = selectedOrders.reduce((sum, o) => {
    const total = parseFloat(o.amount || o.grand_total || o.grandTotal) || 0;
    const paid = parseFloat(o.paidAmount || o.paid_amount) || 0;
    const unpaid = Math.max(0, total - paid);
    return sum + unpaid;
  }, 0);

  // Sync paidAmountInput with totalSelectedAmount
  useEffect(() => {
    if (totalSelectedAmount > 0) {
      setPaidAmountInput(formatRupiah(totalSelectedAmount));
    } else {
      setPaidAmountInput('');
    }
  }, [totalSelectedAmount]);

  const paidAmountNum = parseRupiah(paidAmountInput);
  const excessAmount = Math.max(0, paidAmountNum - totalSelectedAmount);

  if (!isOpen) return null;

  const toggleSelectOrder = (id) => {
    setSelectedOrderIds((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]
    );
  };

  const toggleSelectAll = () => {
    if (selectedOrderIds.length === unpaidOrders.length) {
      setSelectedOrderIds([]);
    } else {
      setSelectedOrderIds(unpaidOrders.map((o) => o.dbId || o.id));
    }
  };

  // File upload handler
  const handleFileUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setPaymentProofFile(file);
    setIsUploading(true);
    setErrorMessage('');

    try {
      const formData = new FormData();
      formData.append('image', file);
      const res = await axios.post('/api/upload', formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });

      if (res.data && res.data.url) {
        setPaymentProofUrl(res.data.url);
      }
    } catch (err) {
      console.error('Error uploading payment proof:', err);
      setErrorMessage('Gagal mengunggah foto bukti transfer. Silakan coba lagi.');
    } finally {
      setIsUploading(false);
    }
  };

  // Submit Batch Settlement
  const handleSubmitBatch = async () => {
    if (selectedOrderIds.length === 0) {
      setErrorMessage('Pilih minimal 1 nota tertunggak untuk dilunasi.');
      return;
    }

    if (totalSelectedAmount <= 0) {
      setErrorMessage('Total tagihan nota terpilih adalah Rp 0.');
      return;
    }

    if (paidAmountNum < totalSelectedAmount) {
      setErrorMessage(`Nominal bayar kurang Rp ${(totalSelectedAmount - paidAmountNum).toLocaleString('id-ID')}`);
      return;
    }

    setIsSubmitting(true);
    setErrorMessage('');

    try {
      const resolvedPaymentMethod = resolvePaymentMethodString({
        mainCategory,
        edcCardType,
        isCrossTransfer,
        crossBankOutletId,
        activeOutletId,
        activeOutletName
      });

      const payload = {
        customerId: customer?.id || customer?.dbId,
        outletId: activeOutletId || parseInt(localStorage.getItem('activeOutletId'), 10) || 2,
        cashierEmployeeId: cashierEmployeeId || parseInt(localStorage.getItem('employeeId'), 10) || 167,
        paymentMethod: resolvedPaymentMethod,
        paymentProofUrl,
        notes,
        paidAmount: paidAmountNum,
        overpaymentToDeposit: overpaymentAction === 'deposit',
        items: selectedOrders.map((o) => {
          const total = parseFloat(o.amount || o.grand_total || o.grandTotal) || 0;
          const paid = parseFloat(o.paidAmount || o.paid_amount) || 0;
          const unpaid = Math.max(0, total - paid);
          return {
            transactionId: o.dbId || o.id,
            amountToPay: unpaid
          };
        })
      };

      const res = await axios.post('/api/transactions/settle-batch', payload);

      if (res.data && res.data.success) {
        setSettledBatchData(res.data.data);
        if (onSuccess) {
          onSuccess(res.data.data);
        }
      } else {
        setErrorMessage(res.data?.message || 'Gagal memproses pelunasan gabungan.');
      }
    } catch (err) {
      console.error('Error processing batch settlement:', err);
      setErrorMessage(
        err.response?.data?.message || 'Terjadi kesalahan sistem saat memproses pelunasan.'
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  return createPortal(
    <div className="fixed inset-0 z-[120] bg-slate-900/75 backdrop-blur-xs flex justify-center items-center p-3 sm:p-6 overflow-y-auto">
      <div className="bg-white rounded-3xl border border-[#e0e0e0] w-full max-w-2xl shadow-2xl overflow-hidden flex flex-col max-h-[calc(100vh-4rem)] sm:max-h-[85vh] my-auto animate-fade-in">
        
        {/* Header */}
        <div className="px-5 py-4 bg-gradient-to-r from-[#420a2c] via-[#5f1340] to-[#340722] text-white flex justify-between items-center shrink-0">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-white/10 rounded-xl">
              <Receipt className="h-5 w-5 text-amber-300" />
            </div>
            <div>
              <h3 className="text-sm sm:text-base font-black tracking-tight text-white">
                {settledBatchData ? 'Struk Pelunasan Gabungan Nota' : 'Pelunasan Gabungan & Merged Nota'}
              </h3>
              <p className="text-[11px] text-rose-100/80">
                {customer?.name ? `Pelanggan: ${customer.name}` : 'Satu kali bayar untuk beberapa nota tertunggak'}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 text-rose-200 hover:text-white hover:bg-white/10 rounded-full transition-colors cursor-pointer"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Content Body */}
        {settledBatchData ? (() => {
          const itemsList = settledBatchData.settledTransactions || settledBatchData.items || [];
          const batchNo = settledBatchData.batchNo || settledBatchData.batch_no || '-';
          const totalAmount = parseFloat(settledBatchData.totalAmount || settledBatchData.total_amount || 0);
          const paidAmount = parseFloat(settledBatchData.paidAmount || settledBatchData.paid_amount || totalAmount);
          const changeAmount = parseFloat(settledBatchData.changeAmount || settledBatchData.change_amount || 0);
          const depositAdded = parseFloat(settledBatchData.depositAdded || settledBatchData.deposit_added || 0);
          const paymentMethod = settledBatchData.paymentMethod || settledBatchData.payment_method || 'Tunai Kasir';
          const customerName = settledBatchData.customer_name || settledBatchData.customerName || customer?.name || '-';
          const customerPhone = settledBatchData.customer_phone || settledBatchData.customerPhone || customer?.phone || '';
          const outletName = settledBatchData.outlet_name || settledBatchData.outletName || activeOutletName || 'Outlet Waschen';

          return (
            /* RECEIPT VIEW (Struk Thermal Gabungan) */
            <div className="flex-1 overflow-y-auto p-5 space-y-4 bg-slate-50">
              <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-2xl flex items-center gap-3 text-emerald-800 text-xs font-bold">
                <CheckCircle2 className="h-5 w-5 text-emerald-600 shrink-0" />
                <span>Pelunasan gabungan {itemsList.length} nota berhasil diproses!</span>
              </div>

              {/* Thermal Printable Container */}
              <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm max-w-md mx-auto text-xs font-mono space-y-3 text-slate-800" id="thermal-batch-receipt">
                <div className="text-center space-y-1 pb-3 border-b border-dashed border-slate-300">
                  <h4 className="font-black text-sm uppercase text-slate-900">WASCHEN LAUNDRY</h4>
                  <p className="text-[10px] text-slate-500">{outletName}</p>
                  <p className="text-[10px] font-bold text-[#5f1340] pt-1">STRUK PELUNASAN GABUNGAN NOTA</p>
                </div>

                <div className="text-[11px] space-y-1 py-1 border-b border-dashed border-slate-300">
                  <div className="flex justify-between">
                    <span>No. Batch:</span>
                    <span className="font-bold text-slate-900">{batchNo}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Tanggal:</span>
                    <span>{new Date().toLocaleDateString('id-ID', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Pelanggan:</span>
                    <span className="font-bold">{customerName}</span>
                  </div>
                  {customerPhone && (
                    <div className="flex justify-between">
                      <span>No. HP:</span>
                      <span>{customerPhone}</span>
                    </div>
                  )}
                </div>

                {/* Rincian Nota */}
                <div className="space-y-2 py-2 border-b border-dashed border-slate-300">
                  <span className="font-bold block text-[11px] text-slate-700 uppercase tracking-wider">Rincian Nota Dilunasi:</span>
                  {itemsList.map((tx, idx) => {
                    const orderNo = tx.orderNo || tx.order_no || '-';
                    const orderCat = tx.orderCategory || tx.order_category || 'Laundry';
                    const amtPaid = parseFloat(tx.amountPaidThisBatch || tx.allocated_amount || tx.grand_total || 0);

                    return (
                      <div key={idx} className="flex justify-between items-start text-[11px] bg-slate-50 p-2 rounded-lg border border-slate-100">
                        <div>
                          <span className="font-black text-slate-900 block">{orderNo}</span>
                          <span className="text-[10px] text-slate-500">{orderCat}</span>
                        </div>
                        <div className="text-right">
                          <span className="font-black text-emerald-700 block">Rp {amtPaid.toLocaleString('id-ID')}</span>
                          <span className="text-[9px] px-1.5 py-0.2 bg-emerald-100 text-emerald-800 rounded font-bold">LUNAS</span>
                        </div>
                      </div>
                    );
                  })}
                </div>

                {/* Summary */}
                <div className="space-y-1.5 pt-1 text-xs">
                  <div className="flex justify-between items-center text-sm font-black text-[#5f1340] py-1 border-y border-slate-200">
                    <span>TOTAL PELUNASAN:</span>
                    <span>Rp {totalAmount.toLocaleString('id-ID')}</span>
                  </div>
                  {paidAmount > totalAmount && (
                    <>
                      <div className="flex justify-between text-[11px] text-slate-600">
                        <span>Uang Diterima:</span>
                        <span className="font-bold text-slate-900">Rp {paidAmount.toLocaleString('id-ID')}</span>
                      </div>
                      {changeAmount > 0 && (
                        <div className="flex justify-between text-[11px] text-amber-700 font-bold">
                          <span>Kembalian Tunai:</span>
                          <span>Rp {changeAmount.toLocaleString('id-ID')}</span>
                        </div>
                      )}
                      {depositAdded > 0 && (
                        <div className="flex justify-between text-[11px] text-emerald-700 font-bold">
                          <span>Masuk Deposit:</span>
                          <span>+ Rp {depositAdded.toLocaleString('id-ID')}</span>
                        </div>
                      )}
                    </>
                  )}
                  <div className="flex justify-between text-[11px] text-slate-600 pt-1">
                    <span>Metode Pembayaran:</span>
                    <span className="font-bold text-slate-900">{paymentMethod}</span>
                  </div>
                  {paymentProofUrl && (
                    <div className="text-[10px] text-emerald-700 font-medium">
                      ✓ Bukti Transfer/QRIS Terlampir ke Audit Finance
                    </div>
                  )}
                </div>

                <div className="text-center text-[10px] text-slate-400 pt-3 border-t border-dashed border-slate-300">
                  Bukti pelunasan sah 1 kali pembayaran untuk nota-nota tertera di atas.<br/>
                  Terima kasih atas kepercayaan Anda!
                </div>
              </div>
            </div>
          );
        })() : (
          /* FORM SETUP PELUNASAN GABUNGAN */
          <div className="flex-1 overflow-y-auto p-5 space-y-5">
            {errorMessage && (
              <div className="p-3 bg-rose-50 border border-rose-200 rounded-2xl flex items-center gap-2.5 text-rose-800 text-xs font-bold">
                <AlertCircle className="h-4 w-4 text-rose-600 shrink-0" />
                <span>{errorMessage}</span>
              </div>
            )}

            {/* Step 1: Select Unpaid Invoices */}
            <div className="space-y-2.5">
              <div className="flex justify-between items-center">
                <span className="text-xs font-black text-[#313030] uppercase tracking-wider block">
                  1. Pilih Nota Tertunggak yang Ingin Digabung:
                </span>
                {unpaidOrders.length > 0 && (
                  <button
                    type="button"
                    onClick={toggleSelectAll}
                    className="text-xs font-extrabold text-[#5f1340] hover:underline cursor-pointer flex items-center gap-1"
                  >
                    {selectedOrderIds.length === unpaidOrders.length ? (
                      <>
                        <CheckSquare className="h-3.5 w-3.5" /> Batalkan Semua
                      </>
                    ) : (
                      <>
                        <Square className="h-3.5 w-3.5" /> Pilih Semua ({unpaidOrders.length})
                      </>
                    )}
                  </button>
                )}
              </div>

              {unpaidOrders.length === 0 ? (
                <div className="p-6 bg-slate-50 border border-slate-200 rounded-2xl text-center text-xs text-slate-400">
                  Pelanggan ini tidak memiliki nota tertunggak yang perlu dilunasi.
                </div>
              ) : (
                <div className="space-y-2 max-h-56 overflow-y-auto pr-1">
                  {unpaidOrders.map((o) => {
                    const id = o.dbId || o.id;
                    const isSelected = selectedOrderIds.includes(id);
                    const grandTotal = parseFloat(o.amount || o.grand_total || o.grandTotal) || 0;
                    const paidAmount = parseFloat(o.paidAmount || o.paid_amount) || 0;
                    const unpaidBalance = Math.max(0, grandTotal - paidAmount);

                    return (
                      <div
                        key={id}
                        onClick={() => toggleSelectOrder(id)}
                        className={`p-3 rounded-2xl border transition-all cursor-pointer flex items-center justify-between gap-3 ${
                          isSelected
                            ? 'bg-[#5f1340]/5 border-[#5f1340] shadow-xs'
                            : 'bg-white border-[#e0e0e0] hover:border-slate-300'
                        }`}
                      >
                        <div className="flex items-center gap-3 min-w-0">
                          <div className={`p-1 rounded-lg ${isSelected ? 'text-[#5f1340]' : 'text-slate-300'}`}>
                            {isSelected ? <CheckSquare className="h-5 w-5" /> : <Square className="h-5 w-5" />}
                          </div>
                          <div className="min-w-0">
                            <div className="flex items-center gap-2">
                              <span className="text-xs font-black text-[#313030]">{o.orderId || o.orderNo || o.order_no}</span>
                              <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-slate-100 text-slate-600">
                                {o.category || o.orderCategory || 'Laundry'}
                              </span>
                            </div>
                            <span className="text-[10px] text-slate-400 block mt-0.5">
                              Tanggal: {o.date || o.order_date || '-'}
                            </span>
                          </div>
                        </div>

                        <div className="text-right shrink-0">
                          <span className="text-xs font-black text-rose-600 block">
                            Sisa: Rp {unpaidBalance.toLocaleString('id-ID')}
                          </span>
                          <span className="text-[10px] text-slate-400 block">
                            Total: Rp {grandTotal.toLocaleString('id-ID')}
                          </span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Total Summary Header */}
            <div className="p-4 bg-gradient-to-r from-amber-500/10 via-amber-50 to-amber-100/40 border border-amber-200/80 rounded-2xl flex items-center justify-between">
              <div>
                <span className="text-[10px] font-extrabold text-amber-800 uppercase tracking-wider block">
                  Total Pelunasan Gabungan ({selectedOrders.length} Nota Selected)
                </span>
                <span className="text-lg sm:text-xl font-black text-[#5f1340]">
                  Rp {totalSelectedAmount.toLocaleString('id-ID')}
                </span>
              </div>
              <span className="px-3 py-1 bg-amber-500 text-white text-xs font-black rounded-xl">
                1 Kali Bayar
              </span>
            </div>

            {/* Step 2: Payment Details */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {/* Cascading Payment Selector */}
              <div className="sm:col-span-2">
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
                  selectedCustomer={customer}
                  grandTotal={totalSelectedAmount}
                />
              </div>

              {/* Nominal Bayar Input & Quick Presets */}
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-700 block">Nominal Uang Diterima / Dibayar (Rp)</label>
                <input
                  type="text"
                  inputMode="numeric"
                  value={paidAmountInput}
                  onChange={(e) => setPaidAmountInput(formatRupiah(e.target.value))}
                  placeholder={formatRupiah(totalSelectedAmount)}
                  className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-black text-slate-900 focus:outline-hidden focus:border-[#5f1340]"
                />
                <div className="flex flex-wrap gap-1.5 mt-1">
                  {[totalSelectedAmount, 50000, 100000, 200000, 500000]
                    .filter((v, i, arr) => v > 0 && arr.indexOf(v) === i && v >= totalSelectedAmount)
                    .slice(0, 4)
                    .map((preset) => (
                      <button
                        key={preset}
                        type="button"
                        onClick={() => setPaidAmountInput(formatRupiah(preset))}
                        className="px-2 py-1 rounded-lg bg-slate-100 border border-slate-200 text-[10px] font-bold text-slate-700 hover:border-[#5f1340] hover:bg-[#5f1340]/5 cursor-pointer transition-colors"
                      >
                        {preset === totalSelectedAmount ? 'Pas' : formatRupiah(preset, true)}
                      </button>
                    ))}
                </div>
              </div>

              {/* Excess Amount / Kembalian Calculation */}
              {excessAmount > 0 && (
                <div className="sm:col-span-2 p-3.5 bg-amber-50 border border-amber-200 rounded-2xl space-y-2.5">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2 text-xs font-black text-amber-900">
                      <Coins className="h-4 w-4 text-amber-600 shrink-0" />
                      <span>Kelebihan Uang Diterima: Rp {excessAmount.toLocaleString('id-ID')}</span>
                    </div>
                    <span className="text-[10px] font-extrabold text-amber-700 uppercase">Pilih Aksi</span>
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      type="button"
                      onClick={() => setOverpaymentAction('change')}
                      className={`py-2 px-3 rounded-xl text-xs font-black cursor-pointer transition-colors ${
                        overpaymentAction === 'change'
                          ? 'bg-amber-600 text-white shadow-xs'
                          : 'bg-white border border-amber-300 text-amber-900 hover:bg-amber-100'
                      }`}
                    >
                      Kembalian Tunai (Rp {excessAmount.toLocaleString('id-ID')})
                    </button>
                    <button
                      type="button"
                      onClick={() => setOverpaymentAction('deposit')}
                      className={`py-2 px-3 rounded-xl text-xs font-black cursor-pointer transition-colors ${
                        overpaymentAction === 'deposit'
                          ? 'bg-emerald-600 text-white shadow-xs'
                          : 'bg-white border border-emerald-300 text-emerald-900 hover:bg-emerald-100'
                      }`}
                    >
                      Simpan ke Saldo Deposit
                    </button>
                  </div>
                </div>
              )}

              {/* Proof File Upload */}
              <div className="sm:col-span-2 space-y-1.5">
                <label className="text-xs font-bold text-slate-700 block">
                  Foto Bukti Transfer (1 Bukti Utuh)
                </label>
                <div className="relative">
                  <input
                    type="file"
                    accept="image/*"
                    onChange={handleFileUpload}
                    className="hidden"
                    id="batch-payment-proof-input"
                  />
                  <label
                    htmlFor="batch-payment-proof-input"
                    className="flex items-center justify-center gap-2 px-3.5 py-2.5 bg-slate-50 hover:bg-slate-100 border border-dashed border-slate-300 rounded-xl text-xs font-bold text-slate-700 cursor-pointer transition-colors"
                  >
                    {isUploading ? (
                      <>
                        <Loader2 className="h-4 w-4 animate-spin text-[#5f1340]" />
                        <span>Mengunggah foto...</span>
                      </>
                    ) : paymentProofUrl ? (
                      <>
                        <CheckCircle2 className="h-4 w-4 text-emerald-600" />
                        <span className="text-emerald-700 truncate max-w-[150px]">Foto Ter-upload</span>
                      </>
                    ) : (
                      <>
                        <Upload className="h-4 w-4 text-slate-400" />
                        <span>Pilih Foto Bukti Transfer</span>
                      </>
                    )}
                  </label>
                </div>
              </div>
            </div>

            {/* Notes */}
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-slate-700 block">Catatan Tambahan untuk Tim Finance</label>
              <input
                type="text"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Contoh: Transfer gabungan atas nama Bpk Budi (BCA 80rb)"
                className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium text-slate-800 focus:outline-hidden focus:border-[#5f1340]"
              />
            </div>
          </div>
        )}

        {/* Footer Actions */}
        <div className="p-4 bg-slate-50 border-t border-[#e0e0e0] flex items-center justify-end gap-3 shrink-0">
          {settledBatchData ? (
            <div className="flex gap-2 w-full sm:w-auto">
              <button
                type="button"
                onClick={() => {
                  window.print();
                }}
                className="flex-1 sm:flex-initial px-5 py-2.5 bg-[#5f1340] hover:bg-[#4d0f33] text-white text-xs font-black rounded-xl flex items-center justify-center gap-2 cursor-pointer shadow-xs"
              >
                <Printer className="h-4 w-4" />
                <span>Cetak Nota Gabungan</span>
              </button>
              <button
                type="button"
                onClick={onClose}
                className="px-5 py-2.5 bg-slate-200 hover:bg-slate-300 text-slate-800 text-xs font-bold rounded-xl cursor-pointer"
              >
                Selesai
              </button>
            </div>
          ) : (
            <div className="flex gap-2 w-full sm:w-auto">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2.5 bg-slate-200 hover:bg-slate-300 text-slate-700 text-xs font-bold rounded-xl cursor-pointer"
              >
                Batal
              </button>
              <button
                type="button"
                disabled={isSubmitting || selectedOrderIds.length === 0}
                onClick={handleSubmitBatch}
                className="flex-1 sm:flex-initial px-6 py-2.5 bg-[#5f1340] hover:bg-[#4d0f33] disabled:opacity-50 text-white text-xs font-black rounded-xl flex items-center justify-center gap-2 cursor-pointer shadow-md transition-all"
              >
                {isSubmitting ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    <span>Memproses Pelunasan...</span>
                  </>
                ) : (
                  <>
                    <Receipt className="h-4 w-4 text-amber-300" />
                    <span>Proses & Cetak Nota Gabungan</span>
                  </>
                )}
              </button>
            </div>
          )}
        </div>

      </div>
    </div>,
    document.body
  );
}
