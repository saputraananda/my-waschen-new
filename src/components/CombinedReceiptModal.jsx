import React, { useState, useMemo, useEffect } from 'react';
import { createPortal } from 'react-dom';
import axios from 'axios';
import {
  Receipt,
  X,
  CheckSquare,
  Square,
  Upload,
  Loader2,
  CheckCircle2,
  AlertCircle,
  Coins
} from 'lucide-react';
import { formatRupiah, parseRupiah } from '../utils/FormatRupiah.js';
import CascadingPaymentSelector, { resolvePaymentMethodString } from './CascadingPaymentSelector.jsx';
import PinVerifyModal from '../pages/Shift/PinVerifyModal.jsx';

export default function CombinedReceiptModal({
  isOpen,
  onClose,
  customer,
  outstandingOrders = [],
  activeOutletId,
  activeOutletName,
  cashierEmployeeId,
  paymentMethods = [],
  onSuccess
}) {
  const [selectedOrderIds, setSelectedOrderIds] = useState([]);
  const [mainCategory, setMainCategory] = useState('Tunai');
  const [edcCardType, setEdcCardType] = useState('Debit Card');
  const [isCrossTransfer, setIsCrossTransfer] = useState(false);
  const [crossBankOutletId, setCrossBankOutletId] = useState(1);
  const [paidAmountInput, setPaidAmountInput] = useState('');
  const [overpaymentAction, setOverpaymentAction] = useState('change');
  const [paymentProofUrl, setPaymentProofUrl] = useState('');
  const [isUploading, setIsUploading] = useState(false);
  const [notes, setNotes] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [showPayPinModal, setShowPayPinModal] = useState(false);

  const unpaidOrders = useMemo(() => {
    return outstandingOrders.filter((o) => {
      const ps = o.paymentStatus || o.payment_status;
      return ps === 'Outstanding' || ps === 'DP' || (o.amount > (o.paidAmount || 0));
    });
  }, [outstandingOrders]);

  useEffect(() => {
    if (isOpen && (!paymentMethods || paymentMethods.length === 0)) {
      axios
        .get('/api/masters/payment-methods')
        .catch((err) => console.error('Error fetching payment methods:', err));
    }
  }, [isOpen, paymentMethods]);

  useEffect(() => {
    if (isOpen) {
      const allIds = unpaidOrders.map((o) => o.dbId || o.id);
      setSelectedOrderIds(allIds);
      setErrorMessage('');
      setPaymentProofUrl('');
      setNotes('');
    }
  }, [isOpen, unpaidOrders]);

  const selectedOrders = unpaidOrders.filter((o) =>
    selectedOrderIds.includes(o.dbId || o.id)
  );

  const totalSelectedAmount = selectedOrders.reduce((sum, o) => {
    const total = parseFloat(o.amount || o.grand_total || o.grandTotal) || 0;
    const paid = parseFloat(o.paidAmount || o.paid_amount) || 0;
    const unpaid = Math.max(0, total - paid);
    return sum + unpaid;
  }, 0);

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

  const handleFileUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

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

  const requestSubmitBatch = () => {
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

    setErrorMessage('');
    setShowPayPinModal(true);
  };

  const handleSubmitBatch = async (pinCashierEmployeeId) => {
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

    const resolvedCashierId = Number(
      pinCashierEmployeeId || cashierEmployeeId || localStorage.getItem('employeeId')
    );
    if (!resolvedCashierId) {
      setErrorMessage('Identitas kasir dari PIN tidak ditemukan.');
      return;
    }

    setShowPayPinModal(false);
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
        customerId: customer?.dbId || customer?.id,
        outletId: activeOutletId || parseInt(localStorage.getItem('activeOutletId'), 10) || 2,
        cashierEmployeeId: resolvedCashierId,
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
            transactionId: o.dbId || o.transaction_id || o.id,
            amountToPay: unpaid
          };
        })
      };

      const res = await axios.post('/api/transactions/settle-batch', payload);

      if (res.data && res.data.success) {
        const data = {
          ...res.data.data,
          outletName: res.data.data?.outletName || res.data.data?.outlet_name || activeOutletName,
          customerName: res.data.data?.customerName || res.data.data?.customer_name || customer?.name,
          customerPhone: res.data.data?.customerPhone || res.data.data?.customer_phone || customer?.phone
        };
        if (onSuccess) {
          onSuccess(data);
        }
        onClose();
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
        <div className="px-5 py-4 bg-gradient-to-r from-[#420a2c] via-[#5f1340] to-[#340722] text-white flex justify-between items-center shrink-0">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-white/10 rounded-xl">
              <Receipt className="h-5 w-5 text-amber-300" />
            </div>
            <div>
              <h3 className="text-sm sm:text-base font-black tracking-tight text-white">
                Pelunasan Gabungan & Merged Nota
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

        <div className="flex-1 overflow-y-auto p-5 space-y-5">
          {errorMessage && (
            <div className="p-3 bg-rose-50 border border-rose-200 rounded-2xl flex items-center gap-2.5 text-rose-800 text-xs font-bold">
              <AlertCircle className="h-4 w-4 text-rose-600 shrink-0" />
              <span>{errorMessage}</span>
            </div>
          )}

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

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
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

            <div className="space-y-1.5">
              <label className="text-xs font-bold text-slate-700 block">Nominal Uang Diterima / Dibayar (Rp)</label>
              <input
                type="text"
                inputMode="numeric"
                value={paidAmountInput}
                onChange={(e) => setPaidAmountInput(formatRupiah(e.target.value))}
                placeholder={`Contoh : ${formatRupiah(totalSelectedAmount)}`}
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

          <div className="space-y-1.5">
            <label className="text-xs font-bold text-slate-700 block">Catatan Tambahan untuk Tim Finance</label>
            <input
              type="text"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Contoh : Transfer gabungan atas nama Bpk Budi (BCA 80rb)"
              className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium text-slate-800 focus:outline-hidden focus:border-[#5f1340]"
            />
          </div>
        </div>

        <div className="p-4 bg-slate-50 border-t border-[#e0e0e0] flex items-center justify-end gap-3 shrink-0">
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
              onClick={requestSubmitBatch}
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
        </div>
      </div>

      {showPayPinModal && (
        <PinVerifyModal
          outletId={activeOutletId || localStorage.getItem('activeOutletId')}
          mode="pin"
          title="PIN Pelunasan Gabungan"
          description="Masukkan PIN frontliner yang menerima pelunasan (jumlah digit bebas)."
          submitLabel="Lanjut Proses Pelunasan"
          onCancel={() => setShowPayPinModal(false)}
          onVerified={({ employeeId }) => handleSubmitBatch(employeeId)}
        />
      )}
    </div>,
    document.body
  );
}
