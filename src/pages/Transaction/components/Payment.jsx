import React, { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Receipt, ArrowLeft, CreditCard, Save, Wallet, Coins, Upload, Camera, X, Loader2, SwitchCamera } from 'lucide-react';
import { formatEmployeeName } from '../../../utils/FormatName.js';
import { formatRupiah, parseRupiah } from '../../../utils/FormatRupiah.js';
import CascadingPaymentSelector from '../../../components/CascadingPaymentSelector.jsx';
import { useAppDialog } from '../../../context/AppDialogContext.jsx';

export default function Payment({
  setCurrentStep,
  selectedCustomer,
  formatName,
  renderTierBadge,
  activeOutletName,
  activeOutletId,
  outlets = [],
  userProfile,
  cartItems,
  selectedPerfume,
  isExpress,
  isDelivery,
  generalOrderNotes,
  calculations,
  activePromo,
  paymentStatus,
  setPaymentStatus,
  mainCategory = 'Tunai',
  setMainCategory,
  edcCardType = 'Debit Card',
  setEdcCardType,
  paymentMethods = [],
  paidAmountInput,
  setPaidAmountInput,
  overpaymentAction,
  setOverpaymentAction,
  isOutstandingDropOff,
  setIsOutstandingDropOff,
  paymentProofFile,
  setPaymentProofFile,
  handleCreateOrder,
  isSaving = false,
  isCrossTransfer = false,
  setIsCrossTransfer,
  crossBankOutletId = 1,
  setCrossBankOutletId
}) {
  const { showAlert } = useAppDialog();
  const [isCameraOpen, setIsCameraOpen] = useState(false);
  const [cameraReady, setCameraReady] = useState(false);
  const [isStartingCamera, setIsStartingCamera] = useState(false);
  const [facingMode, setFacingMode] = useState('environment');
  const [flashOn, setFlashOn] = useState(false);
  const videoRef = useRef(null);
  const streamRef = useRef(null);

  const stopCamera = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
    setCameraReady(false);
  };

  const closeCamera = () => {
    stopCamera();
    setIsCameraOpen(false);
    setIsStartingCamera(false);
    setFlashOn(false);
  };

  const startCameraStream = async (mode = 'environment') => {
    stopCamera();
    let stream;
    try {
      stream = await navigator.mediaDevices.getUserMedia({
        audio: false,
        video: {
          facingMode: { ideal: mode },
          width: { ideal: 1280 },
          height: { ideal: 720 }
        }
      });
    } catch {
      stream = await navigator.mediaDevices.getUserMedia({
        audio: false,
        video: true
      });
    }
    streamRef.current = stream;
    setFacingMode(mode);
    return stream;
  };

  const openCamera = async () => {
    if (!navigator.mediaDevices?.getUserMedia) {
      showAlert({
        title: 'Kamera Tidak Didukung',
        message: 'Browser ini tidak mendukung akses kamera langsung. Gunakan opsi pilih file.',
        type: 'error'
      });
      return;
    }

    setIsStartingCamera(true);
    try {
      await startCameraStream('environment');
      setIsCameraOpen(true);
    } catch (err) {
      console.error('Gagal akses kamera:', err);
      showAlert({
        title: 'Akses Kamera Ditolak',
        message: 'Izinkan akses kamera di browser, atau gunakan opsi pilih file.',
        type: 'error'
      });
    } finally {
      setIsStartingCamera(false);
    }
  };

  const switchCamera = async () => {
    const next = facingMode === 'environment' ? 'user' : 'environment';
    setCameraReady(false);
    try {
      await startCameraStream(next);
      if (videoRef.current && streamRef.current) {
        videoRef.current.srcObject = streamRef.current;
        await videoRef.current.play();
        setCameraReady(true);
      }
    } catch (err) {
      console.error('Gagal ganti kamera:', err);
      showAlert({
        title: 'Gagal Ganti Kamera',
        message: 'Perangkat ini mungkin hanya punya satu kamera.',
        type: 'warning'
      });
    }
  };

  useEffect(() => {
    if (!isCameraOpen || !streamRef.current || !videoRef.current) return undefined;
    const video = videoRef.current;
    video.srcObject = streamRef.current;
    video.play()
      .then(() => setCameraReady(true))
      .catch((err) => console.error('Gagal putar preview kamera:', err));
    return undefined;
  }, [isCameraOpen]);

  useEffect(() => () => stopCamera(), []);

  // Kunci scroll backdrop saat modal kamera terbuka
  useEffect(() => {
    if (!isCameraOpen) return undefined;

    const scrollY = window.scrollY;
    const scrollbarWidth = window.innerWidth - document.documentElement.clientWidth;

    document.body.classList.add('modal-open');
    document.documentElement.classList.add('modal-open');
    document.body.style.overflow = 'hidden';
    document.documentElement.style.overflow = 'hidden';
    document.body.style.position = 'fixed';
    document.body.style.top = `-${scrollY}px`;
    document.body.style.left = '0';
    document.body.style.right = '0';
    document.body.style.width = '100%';
    if (scrollbarWidth > 0) {
      document.body.style.paddingRight = `${scrollbarWidth}px`;
    }

    return () => {
      document.body.classList.remove('modal-open');
      document.documentElement.classList.remove('modal-open');
      document.body.style.overflow = '';
      document.documentElement.style.overflow = '';
      document.body.style.position = '';
      document.body.style.top = '';
      document.body.style.left = '';
      document.body.style.right = '';
      document.body.style.width = '';
      document.body.style.paddingRight = '';
      window.scrollTo(0, scrollY);
    };
  }, [isCameraOpen]);

  const capturePhoto = () => {
    const video = videoRef.current;
    if (!video || !cameraReady) return;

    setFlashOn(true);
    setTimeout(() => setFlashOn(false), 180);

    const width = video.videoWidth || 1280;
    const height = video.videoHeight || 720;
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.drawImage(video, 0, 0, width, height);

    canvas.toBlob((blob) => {
      if (!blob) {
        showAlert({
          title: 'Gagal Ambil Foto',
          message: 'Tidak bisa menyimpan hasil kamera. Coba lagi.',
          type: 'error'
        });
        return;
      }
      const file = new File([blob], `bukti_bayar_${Date.now()}.jpg`, { type: 'image/jpeg' });
      setPaymentProofFile(file);
      setTimeout(() => closeCamera(), 220);
    }, 'image/jpeg', 0.92);
  };

  const isMemberBalanceMethod = mainCategory === 'Potong Saldo Member';

  const paidAmountNum = parseRupiah(paidAmountInput);
  const isOutstanding = paymentStatus === 'Outstanding';
  const isLunas = paymentStatus === 'Lunas';
  const isDP = paymentStatus === 'DP';
  const showPaymentFields = !isOutstanding;

  const excessAmount = isLunas && !isMemberBalanceMethod
    ? Math.max(0, paidAmountNum - calculations.grandTotal)
    : 0;
  const isUnderpaidLunas = isLunas && !isMemberBalanceMethod
    && paidAmountNum > 0
    && paidAmountNum < calculations.grandTotal;
  const isInvalidDP = isDP && (paidAmountNum <= 0 || paidAmountNum >= calculations.grandTotal);

  const canSubmit = isOutstanding
    || (isLunas && (isMemberBalanceMethod || (paidAmountNum >= calculations.grandTotal && !isUnderpaidLunas)))
    || (isDP && paidAmountNum > 0 && paidAmountNum < calculations.grandTotal);

  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 w-full animate-fade-in">
      
      {/* Left 7 Columns: Detailed Order & Item Receipt Recap */}
      <div className="lg:col-span-7 flex flex-col gap-5">
        <div className="bg-white border border-[#e0e0e0] rounded-3xl p-5 sm:p-6 shadow-xs flex flex-col gap-5">
          
          <div className="flex items-center justify-between pb-4 border-b border-[#e0e0e0]">
            <div>
              <h2 className="text-base font-black text-[#5f1340] uppercase tracking-wider flex items-center gap-2">
                <Receipt className="h-5 w-5" />
                <span>Rincian Nota Transaksi POS</span>
              </h2>
              <p className="text-xs text-slate-400 mt-0.5">Periksa kembali data pelanggan dan rincian item cucian</p>
            </div>
            <button
              type="button"
              onClick={() => setCurrentStep(3)}
              className="px-3.5 py-2 bg-[#f8f8f8] hover:bg-[#e0e0e0] border border-[#e0e0e0] text-slate-700 font-bold rounded-xl text-xs flex items-center gap-1.5 cursor-pointer"
            >
              <ArrowLeft className="h-3.5 w-3.5" />
              <span>Ubah Keranjang</span>
            </button>
          </div>

          {/* Customer & Branch Overview Card */}
          <div className="p-4 bg-[#f8f8f8] border border-[#e0e0e0] rounded-2xl grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
            <div>
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Pelanggan:</span>
              <div className="flex items-center gap-1.5 mt-0.5">
                <span className="font-black text-sm text-[#313030]">{formatName(selectedCustomer?.name)}</span>
                {renderTierBadge(selectedCustomer?.tier)}
              </div>
              <span className="text-xs text-slate-500 font-medium block mt-0.5">{selectedCustomer?.phone}</span>
              <p className="text-[11px] text-slate-500 mt-1 line-clamp-2">{selectedCustomer?.address || 'Alamat belum diisi (Walk-in)'}</p>
            </div>

            <div className="sm:border-l sm:border-[#e0e0e0] sm:pl-4 space-y-1.5">
              <div>
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Outlet Kasir:</span>
                <span className="font-extrabold text-xs text-[#313030]">{activeOutletName}</span>
              </div>
              <div>
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Petugas Kasir:</span>
                <span className="font-bold text-xs text-slate-700">{formatEmployeeName(userProfile?.fullName, 'Staff Kasir')}</span>
              </div>
              <div>
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Saldo Kartu Member:</span>
                <span className="font-black text-xs text-emerald-700">Rp {(selectedCustomer?.memberBalance || 0).toLocaleString('id-ID')}</span>
              </div>
            </div>
          </div>

          {/* Ordered Items Detailed List */}
          <div>
            <h3 className="text-xs font-black uppercase tracking-wider text-[#5f1340] mb-3 flex items-center justify-between">
              <span>Daftar Item Layanan ({cartItems.length})</span>
              <span className="text-[10px] font-bold text-slate-400">Harga Satuan & Subtotal</span>
            </h3>

            <div className="space-y-2.5 max-h-[320px] overflow-y-auto pr-1">
              {cartItems.map((item, idx) => (
                <div
                  key={item.cartId}
                  className="p-3.5 bg-white border border-[#e0e0e0] rounded-2xl flex flex-col gap-2 shadow-2xs"
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2.5 min-w-0">
                      <span className="w-5 h-5 rounded-lg bg-[#5f1340]/10 text-[#5f1340] font-black text-xs flex items-center justify-center shrink-0">
                        {idx + 1}
                      </span>
                      <div className="min-w-0">
                        <span className="font-extrabold text-xs text-[#313030] block truncate">{item.name}</span>
                        <span className="text-[10px] text-slate-400 font-semibold">
                          {item.qtyDisplay} &bull; Rp {item.unitPrice.toLocaleString('id-ID')} / {item.unit}
                          {item.isCleanox && (
                            <span className="ml-1.5 text-sky-700 font-black">• Cleanox</span>
                          )}
                        </span>
                      </div>
                    </div>
                    <span className="font-black text-xs text-[#5f1340]">
                      Rp {item.effectiveSubtotal.toLocaleString('id-ID')}
                    </span>
                  </div>

                  <div className="p-2 bg-[#f8f8f8] rounded-xl text-[10px] text-slate-600 grid grid-cols-2 sm:grid-cols-4 gap-1.5">
                    <span>Merk: <b className="text-[#313030]">{item.brand}</b></span>
                    <span>Warna: <b className="text-[#313030]">{item.color}</b></span>
                    <span>Material: <b className="text-[#313030]">{item.material}</b></span>
                    <span>Ukuran: <b className="text-[#313030]">{item.size}</b></span>
                  </div>

                  {item.note !== '-' && (
                    <div className="text-[10px] text-amber-900 bg-amber-50 p-1.5 rounded-lg font-semibold border border-amber-200">
                      Catatan Item: {item.note}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>

          {/* Global Order Specs Recap */}
          <div className="p-4 bg-[#f8f8f8] border border-[#e0e0e0] rounded-2xl grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
            <div>
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Aroma Parfum:</span>
              <span className="font-extrabold text-[#313030]">{selectedPerfume}</span>
            </div>
            <div>
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Kecepatan:</span>
              <span className={`font-black ${isExpress ? 'text-amber-800' : 'text-[#313030]'}`}>
                {isExpress ? 'Express (1x24 Jam)' : 'Reguler (2-3 Hari)'}
              </span>
            </div>
            <div>
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Pengambilan:</span>
              <span className={`font-black ${isDelivery ? 'text-indigo-700' : 'text-[#313030]'}`}>
                {isDelivery ? 'Diantar (Delivery)' : 'Ambil di Toko'}
              </span>
            </div>

            {generalOrderNotes && (
              <div className="col-span-full pt-2 border-t border-[#e0e0e0] text-slate-600">
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-0.5">Catatan Nota Keseluruhan:</span>
                <p className="text-xs bg-white p-2.5 rounded-xl border border-[#e0e0e0] font-medium">{generalOrderNotes}</p>
              </div>
            )}
          </div>

        </div>
      </div>

      {/* Right 5 Columns: Financial Summary & Payment Checkout */}
      <div className="lg:col-span-5 flex flex-col gap-5">
        <div className="bg-gradient-to-b from-[#5f1340]/[0.03] via-white to-[#5f1340]/[0.05] border border-[#5f1340]/20 rounded-3xl p-6 shadow-md relative overflow-hidden flex flex-col gap-5">
          <div className="h-1.5 w-full bg-gradient-to-r from-[#5f1340] via-[#8e1f62] to-amber-400 absolute top-0 left-0" />

          <div>
            <h2 className="text-base font-black text-[#5f1340] uppercase tracking-wider flex items-center gap-2">
              <CreditCard className="h-5 w-5" />
              <span>Konfirmasi Pembayaran</span>
            </h2>
            <p className="text-xs text-slate-400 mt-0.5">Pilih status dan metode pembayaran nota</p>
          </div>

          {/* Calculation breakdown */}
          <div className="space-y-2.5 text-xs text-slate-600 font-medium p-4 bg-white border border-[#e0e0e0] rounded-2xl">
            <div className="flex justify-between items-center">
              <span>Subtotal ({cartItems.length} Item)</span>
              <span className="font-bold text-[#313030]">Rp {calculations.rawSubtotal.toLocaleString('id-ID')}</span>
            </div>

            {isExpress && (
              <div className="flex justify-between items-center text-amber-800">
                <span>Surcharge Express 1x24 Jam (x2)</span>
                <span className="font-bold">+ Rp {calculations.rawSubtotal.toLocaleString('id-ID')}</span>
              </div>
            )}

            {calculations.discountAmount > 0 && (
              <div className="flex justify-between items-center text-emerald-700">
                <span>Diskon Promo ({activePromo?.name})</span>
                <span className="font-bold">- Rp {calculations.discountAmount.toLocaleString('id-ID')}</span>
              </div>
            )}

            <div className="p-4 bg-gradient-to-r from-[#5f1340]/10 via-[#5f1340]/5 to-transparent border border-[#5f1340]/20 rounded-2xl flex justify-between items-center mt-2">
              <div>
                <span className="text-[11px] font-black uppercase tracking-wider text-[#5f1340] block">Grand Total Tagihan</span>
                <span className="text-[10px] text-slate-400 font-medium">Total yang harus dibayar</span>
              </div>
              <span className="text-2xl font-black text-[#5f1340] tracking-tight">
                Rp {calculations.grandTotal.toLocaleString('id-ID')}
              </span>
            </div>
          </div>

          {/* Payment status selector */}
          <div className="space-y-4">
            {!isOutstanding && (
              <div>
                <label className="text-[11px] font-bold text-slate-500 uppercase tracking-wider block mb-2">
                  Status Pembayaran Nota
                </label>
                <div className="grid grid-cols-2 gap-3">
                  <button
                    type="button"
                    onClick={() => {
                      setPaymentStatus('Lunas');
                      setIsOutstandingDropOff(false);
                    }}
                    className={`py-3 rounded-2xl text-xs font-black transition-all cursor-pointer ${
                      isLunas
                        ? 'bg-emerald-600 text-white shadow-sm'
                        : 'bg-white text-slate-600 border border-[#e0e0e0] hover:bg-slate-50'
                    }`}
                  >
                    Lunas (Sudah Bayar)
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setPaymentStatus('DP');
                      setIsOutstandingDropOff(false);
                    }}
                    className={`py-3 rounded-2xl text-xs font-black transition-all cursor-pointer ${
                      isDP
                        ? 'bg-amber-600 text-white shadow-sm'
                        : 'bg-white text-slate-600 border border-[#e0e0e0] hover:bg-slate-50'
                    }`}
                  >
                    DP (Bayar Sebagian)
                  </button>
                </div>
              </div>
            )}

            {isOutstanding && (
              <div className="p-4 bg-rose-50 border border-rose-200 rounded-2xl text-xs text-rose-900">
                <span className="font-black block mb-1">Outstanding — Belum Ada Pembayaran</span>
                <p className="text-[11px] text-rose-800 font-medium">
                  Nota tetap akan diproses. Pelunasan dilakukan di halaman Riwayat Transaksi.
                </p>
              </div>
            )}

            {showPaymentFields && (
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
                  activeOutletId={activeOutletId}
                  activeOutletName={activeOutletName}
                  outlets={outlets}
                  paymentMethods={paymentMethods}
                  selectedCustomer={selectedCustomer}
                  grandTotal={calculations.grandTotal}
                />

                {!isMemberBalanceMethod && (
                  <>
                    <div>
                      <label className="text-[11px] font-bold text-slate-500 uppercase tracking-wider block mb-1.5">
                        Nominal Bayar (Rp)
                      </label>
                      <input
                        type="text"
                        inputMode="numeric"
                        value={paidAmountInput}
                        onChange={(e) => setPaidAmountInput(formatRupiah(e.target.value))}
                        placeholder={isDP ? formatRupiah(Math.floor(calculations.grandTotal / 2)) : formatRupiah(calculations.grandTotal)}
                        className="w-full px-4 py-3 bg-white border border-[#e0e0e0] rounded-2xl text-sm font-black text-[#313030] outline-none focus:border-[#5f1340]"
                      />
                      <div className="flex flex-wrap gap-2 mt-2">
                        {(isDP
                          ? [50000, 100000, 200000, Math.floor(calculations.grandTotal / 2)]
                          : [calculations.grandTotal, 100000, 200000, 500000]
                        )
                          .filter((v, i, arr) => v > 0 && arr.indexOf(v) === i)
                          .filter((v) => isDP ? v < calculations.grandTotal : v >= calculations.grandTotal || v === calculations.grandTotal)
                          .slice(0, 4)
                          .map((preset) => (
                          <button
                            key={preset}
                            type="button"
                            onClick={() => setPaidAmountInput(formatRupiah(preset))}
                            className="px-3 py-1.5 rounded-lg bg-[#f8f8f8] border border-[#e0e0e0] text-[10px] font-bold text-slate-600 hover:border-[#5f1340] cursor-pointer"
                          >
                            {!isDP && preset === calculations.grandTotal ? 'Pas' : formatRupiah(preset, true)}
                          </button>
                        ))}
                      </div>
                    </div>

                    {isDP && paidAmountNum > 0 && (
                      <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl text-xs font-bold text-amber-900">
                        Sisa tagihan: Rp {Math.max(0, calculations.grandTotal - paidAmountNum).toLocaleString('id-ID')}
                      </div>
                    )}

                    {isUnderpaidLunas && (
                      <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-xs font-bold text-rose-700">
                        Nominal bayar kurang Rp {(calculations.grandTotal - paidAmountNum).toLocaleString('id-ID')}
                      </div>
                    )}

                    {isInvalidDP && paidAmountNum > 0 && (
                      <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-xs font-bold text-rose-700">
                        Nominal DP harus lebih dari 0 dan kurang dari total tagihan.
                      </div>
                    )}

                    {isLunas && excessAmount > 0 && (
                      <div className="p-4 bg-amber-50 border border-amber-200 rounded-2xl space-y-3">
                        <div className="flex items-center justify-between text-xs">
                          <span className="font-bold text-amber-900 flex items-center gap-1.5">
                            <Coins className="h-4 w-4" />
                            Kelebihan Bayar
                          </span>
                          <span className="font-black text-amber-900">
                            Rp {excessAmount.toLocaleString('id-ID')}
                          </span>
                        </div>
                        <div className="grid grid-cols-2 gap-2">
                          <button
                            type="button"
                            onClick={() => setOverpaymentAction('change')}
                            className={`py-2.5 rounded-xl text-[11px] font-black transition-all cursor-pointer ${
                              overpaymentAction === 'change'
                                ? 'bg-amber-600 text-white'
                                : 'bg-white text-amber-900 border border-amber-300'
                            }`}
                          >
                            Kembalian Tunai
                          </button>
                          <button
                            type="button"
                            onClick={() => setOverpaymentAction('deposit')}
                            className={`py-2.5 rounded-xl text-[11px] font-black transition-all cursor-pointer ${
                              overpaymentAction === 'deposit'
                                ? 'bg-emerald-600 text-white'
                                : 'bg-white text-emerald-800 border border-emerald-300'
                            }`}
                          >
                            Simpan ke Saldo
                          </button>
                        </div>
                        {overpaymentAction === 'deposit' && (
                          <p className="text-[10px] text-emerald-800 font-medium">
                            Kelebihan Rp {excessAmount.toLocaleString('id-ID')} masuk saldo member.
                            Saldo baru: Rp {((selectedCustomer?.memberBalance || 0) + excessAmount).toLocaleString('id-ID')}
                          </p>
                        )}
                      </div>
                    )}
                  </>
                )}

                <div>
                  <label className="text-[11px] font-bold text-slate-500 uppercase tracking-wider block mb-1.5">
                    Upload Bukti Pembayaran (Opsional)
                  </label>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    <label className="flex flex-col items-center justify-center w-full p-4 border-2 border-dashed border-[#e0e0e0] rounded-2xl cursor-pointer hover:border-[#5f1340]/40 hover:bg-[#5f1340]/[0.02] transition-all">
                      <Upload className="h-5 w-5 text-slate-400 mb-1.5" />
                      <span className="text-[11px] font-bold text-slate-500 text-center">
                        Pilih file foto/PDF
                      </span>
                      <input
                        type="file"
                        accept="image/jpeg,image/png,image/webp,application/pdf"
                        className="hidden"
                        onChange={(e) => setPaymentProofFile(e.target.files?.[0] || null)}
                      />
                    </label>
                    <button
                      type="button"
                      onClick={openCamera}
                      disabled={isStartingCamera}
                      className="flex flex-col items-center justify-center w-full p-4 border-2 border-dashed border-[#e0e0e0] rounded-2xl cursor-pointer hover:border-[#5f1340]/40 hover:bg-[#5f1340]/[0.02] transition-all disabled:opacity-60"
                    >
                      {isStartingCamera ? (
                        <Loader2 className="h-5 w-5 text-slate-400 mb-1.5 animate-spin" />
                      ) : (
                        <Camera className="h-5 w-5 text-slate-400 mb-1.5" />
                      )}
                      <span className="text-[11px] font-bold text-slate-500 text-center">
                        {isStartingCamera ? 'Membuka kamera...' : 'Ambil foto kamera'}
                      </span>
                    </button>
                  </div>
                  {paymentProofFile && (
                    <div className="mt-2 flex items-center justify-between gap-2 px-3 py-2 bg-[#f8f8f8] border border-[#e0e0e0] rounded-xl">
                      <span className="text-[11px] font-bold text-slate-600 truncate">
                        {paymentProofFile.name || 'Bukti bayar terpilih'}
                      </span>
                      <button
                        type="button"
                        onClick={() => setPaymentProofFile(null)}
                        className="text-[10px] font-bold text-rose-600 flex items-center gap-1 cursor-pointer shrink-0"
                      >
                        <X className="h-3 w-3" /> Hapus
                      </button>
                    </div>
                  )}
                </div>
              </>
            )}

            <label className={`flex items-start gap-3 p-3.5 rounded-2xl border cursor-pointer transition-all ${
              isOutstanding
                ? 'bg-rose-50 border-rose-300'
                : 'bg-slate-50 border-[#e0e0e0] hover:border-amber-300'
            }`}>
              <input
                type="checkbox"
                checked={paymentStatus === 'Outstanding'}
                onChange={(e) => {
                  const checked = e.target.checked;
                  setIsOutstandingDropOff(checked);
                  setPaymentStatus(checked ? 'Outstanding' : 'Lunas');
                  if (checked) setPaymentProofFile(null);
                }}
                className="mt-0.5 accent-rose-600"
              />
              <div>
                <span className="text-xs font-black text-[#313030] block">
                  Pelanggan taruh cucian & pergi (Outstanding)
                </span>
                <span className="text-[10px] text-slate-500 font-medium">
                  Customer belum sempat bayar — nota tetap diproses, pembayaran nanti di Riwayat.
                </span>
              </div>
            </label>

            <button
              type="button"
              onClick={handleCreateOrder}
              disabled={!canSubmit || isSaving}
              className="w-full py-4 mt-2 rounded-2xl bg-gradient-to-r from-[#5f1340] to-[#7d1956] hover:from-[#4d0f33] hover:to-[#6a1549] disabled:opacity-50 disabled:cursor-not-allowed text-white font-black text-sm shadow-lg shadow-[#5f1340]/25 active:scale-98 transition-all flex items-center justify-center gap-2.5 cursor-pointer"
            >
              {isSaving ? (
                <>
                  <Loader2 className="h-5 w-5 animate-spin" />
                  <span>Menyimpan...</span>
                </>
              ) : (
                <>
                  <Save className="h-5 w-5" />
                  <span>Simpan Nota</span>
                </>
              )}
            </button>
          </div>

        </div>
      </div>

      {isCameraOpen && createPortal(
        <div
          className="fixed inset-0 z-[80] bg-[#1a0a12]/92 backdrop-blur-md flex items-center justify-center p-3 sm:p-6 animate-fade-in modal-backdrop overscroll-none"
          role="dialog"
          aria-modal="true"
          onWheel={(e) => e.preventDefault()}
          onTouchMove={(e) => e.preventDefault()}
        >
          <div
            className="relative w-full max-w-md overflow-hidden rounded-[28px] shadow-[0_25px_80px_rgba(95,19,64,0.45)] border border-white/10 bg-gradient-to-b from-[#2a1020] to-[#12060c]"
            onWheel={(e) => e.stopPropagation()}
            onTouchMove={(e) => e.stopPropagation()}
          >
            <div className="absolute top-0 inset-x-0 z-20 px-4 pt-4 pb-10 bg-gradient-to-b from-black/70 via-black/30 to-transparent flex items-start justify-between pointer-events-none">
              <div className="pointer-events-auto">
                <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-[#5f1340]/90 text-amber-100 text-[10px] font-black tracking-wide uppercase shadow-lg shadow-[#5f1340]/40">
                  <Camera className="h-3 w-3" />
                  Bukti Bayar
                </div>
                <p className="mt-2 text-white text-sm font-black drop-shadow">Posisikan struk / bukti transfer</p>
                <p className="text-white/65 text-[11px] font-medium">Pastikan teks jelas di dalam bingkai</p>
              </div>
              <button
                type="button"
                onClick={closeCamera}
                className="pointer-events-auto p-2.5 rounded-full bg-white/15 hover:bg-white/25 text-white backdrop-blur-md border border-white/20 cursor-pointer transition-colors"
                aria-label="Tutup kamera"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="relative w-full aspect-[3/4] sm:aspect-[4/5] bg-black overflow-hidden">
              <video
                ref={videoRef}
                autoPlay
                playsInline
                muted
                className={`absolute inset-0 w-full h-full object-cover transition-opacity duration-300 ${facingMode === 'user' ? 'scale-x-[-1]' : ''} ${cameraReady ? 'opacity-100' : 'opacity-40'}`}
              />

              <div className="absolute inset-0 pointer-events-none bg-[radial-gradient(ellipse_at_center,transparent_45%,rgba(0,0,0,0.55)_100%)]" />

              <div className="absolute inset-[14%] sm:inset-[16%] pointer-events-none">
                <div className="absolute inset-0 rounded-2xl border border-white/35 shadow-[0_0_0_9999px_rgba(0,0,0,0.28)]" />
                <span className="absolute -top-0.5 -left-0.5 w-7 h-7 border-t-[3px] border-l-[3px] border-amber-300 rounded-tl-xl" />
                <span className="absolute -top-0.5 -right-0.5 w-7 h-7 border-t-[3px] border-r-[3px] border-amber-300 rounded-tr-xl" />
                <span className="absolute -bottom-0.5 -left-0.5 w-7 h-7 border-b-[3px] border-l-[3px] border-amber-300 rounded-bl-xl" />
                <span className="absolute -bottom-0.5 -right-0.5 w-7 h-7 border-b-[3px] border-r-[3px] border-amber-300 rounded-br-xl" />
                <div className="absolute left-1/2 -translate-x-1/2 bottom-3 px-3 py-1 rounded-full bg-black/45 backdrop-blur-sm text-[10px] font-bold text-amber-100 tracking-wide">
                  Sejajarkan bukti di sini
                </div>
              </div>

              {!cameraReady && (
                <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 text-white z-10">
                  <Loader2 className="h-6 w-6 animate-spin text-amber-200" />
                  <span className="text-xs font-bold tracking-wide">Menyiapkan kamera…</span>
                </div>
              )}

              <div
                className={`absolute inset-0 bg-white pointer-events-none transition-opacity duration-150 z-30 ${
                  flashOn ? 'opacity-90' : 'opacity-0'
                }`}
              />
            </div>

            <div className="relative z-20 px-5 pt-4 pb-5 bg-gradient-to-t from-black via-[#1a0a12] to-transparent">
              <div className="flex items-center justify-between gap-4">
                <button
                  type="button"
                  onClick={closeCamera}
                  className="w-14 h-14 rounded-2xl bg-white/10 hover:bg-white/20 border border-white/15 text-white text-[11px] font-black cursor-pointer transition-colors"
                >
                  Batal
                </button>

                <button
                  type="button"
                  onClick={capturePhoto}
                  disabled={!cameraReady}
                  className="group relative w-[76px] h-[76px] rounded-full cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
                  aria-label="Ambil foto"
                >
                  <span className="absolute inset-0 rounded-full border-[3px] border-white/90 group-active:scale-95 transition-transform" />
                  <span className="absolute inset-[7px] rounded-full bg-gradient-to-br from-[#8b1f5a] to-[#5f1340] shadow-[0_8px_28px_rgba(95,19,64,0.65)] group-hover:from-[#a3286a] group-active:scale-90 transition-all flex items-center justify-center">
                    <Camera className="h-7 w-7 text-amber-100" />
                  </span>
                </button>

                <button
                  type="button"
                  onClick={switchCamera}
                  disabled={!cameraReady}
                  className="w-14 h-14 rounded-2xl bg-white/10 hover:bg-white/20 border border-white/15 text-white flex items-center justify-center cursor-pointer disabled:opacity-40 transition-colors"
                  title="Ganti kamera"
                  aria-label="Ganti kamera"
                >
                  <SwitchCamera className="h-5 w-5" />
                </button>
              </div>
              <p className="mt-3 text-center text-[10px] text-white/50 font-medium">
                Tekan tombol tengah untuk mengabadikan bukti pembayaran
              </p>
            </div>
          </div>
        </div>,
        document.body
      )}
    </div>
  );
}
