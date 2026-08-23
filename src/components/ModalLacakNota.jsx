import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { formatName } from '../utils/FormatName';
import {
  Search,
  QrCode,
  X,
  Clock,
  Wind,
  Shirt,
  Layers,
  PackageCheck,
  Truck,
  CheckCircle2,
  AlertCircle,
  FileText,
  Printer,
  Sparkles,
  ArrowRight,
  User,
  Phone,
  Calendar
} from 'lucide-react';

const WORKFLOW_STAGES = [
  { id: 'Antrean', label: 'Antrean', icon: Clock, desc: 'Nota Diterima' },
  { id: 'Pencucian', label: 'Pencucian', icon: Wind, desc: 'Proses Cuci' },
  { id: 'Penyetrikaan', label: 'Penyetrikaan', icon: Shirt, desc: 'Proses Setrika' },
  { id: 'Pengemasan', label: 'Pengemasan', icon: Layers, desc: 'Proses Packing' },
  { id: 'Siap Diambil', label: 'Siap Diambil', icon: PackageCheck, desc: 'Menunggu Pelanggan' },
  { id: 'Selesai', label: 'Selesai', icon: CheckCircle2, desc: 'Diserahkan' }
];

export default function ModalLacakNota({ isOpen, onClose, initialOrderNo = '' }) {
  const [searchKey, setSearchKey] = useState(initialOrderNo || '');
  const [trackedOrder, setTrackedOrder] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [recentOrders, setRecentOrders] = useState([]);

  // Fetch recent orders for 1-click suggestion pills
  useEffect(() => {
    if (isOpen) {
      if (initialOrderNo) {
        setSearchKey(initialOrderNo);
        handleSearchOrder(initialOrderNo);
      }
      axios.get('/api/transactions?limit=6')
        .then(res => {
          if (res.data && res.data.success && res.data.data) {
            setRecentOrders(res.data.data);
            if (!initialOrderNo && res.data.data.length > 0) {
              const firstNo = res.data.data[0].order_no;
              setSearchKey(firstNo);
              handleSearchOrder(firstNo);
            }
          }
        })
        .catch(err => console.error('Failed to fetch recent orders:', err));
    }
  }, [isOpen, initialOrderNo]);

  const handleSearchOrder = async (queryKey) => {
    const targetKey = queryKey || searchKey;
    if (!targetKey || !targetKey.trim()) {
      setErrorMessage('Harap masukkan nomor nota!');
      return;
    }

    setIsLoading(true);
    setErrorMessage('');
    try {
      const res = await axios.get(`/api/transactions/${targetKey.trim()}`);
      if (res.data && res.data.success && res.data.data) {
        setTrackedOrder(res.data.data);
      } else {
        setTrackedOrder(null);
        setErrorMessage(`Nota dengan nomor "${targetKey}" tidak ditemukan.`);
      }
    } catch (err) {
      console.error('Error fetching transaction detail:', err);
      // Fallback: search in recent orders array
      const foundInRecent = recentOrders.find(o => o.order_no?.toLowerCase() === targetKey.trim().toLowerCase());
      if (foundInRecent) {
        setTrackedOrder(foundInRecent);
      } else {
        setTrackedOrder(null);
        setErrorMessage(err.response?.data?.message || `Nota "${targetKey}" tidak ditemukan.`);
      }
    } finally {
      setIsLoading(false);
    }
  };

  const handleOpenWA = (phone, name, orderNo, status) => {
    let rawPhone = (phone || '').replace(/[^0-9]/g, '');
    if (rawPhone.startsWith('0')) rawPhone = '62' + rawPhone.slice(1);
    if (!rawPhone) rawPhone = '628123456789';
    const message = encodeURIComponent(`Halo Kak ${name || 'Pelanggan'}, update status pengerjaan nota ${orderNo} Anda saat ini adalah: ${status}. Terima kasih! 😊`);
    window.open(`https://wa.me/${rawPhone}?text=${message}`, '_blank');
  };

  if (!isOpen) return null;

  // Determine stage progress index
  const getStageIndex = (status) => {
    if (!status) return 0;
    if (status === 'Antrean' || status === 'Diterima') return 0;
    if (status === 'Pencucian' || status === 'Proses Cuci') return 1;
    if (status === 'Penyetrikaan' || status === 'Proses Setrika') return 2;
    if (status === 'Pengemasan' || status === 'Proses Packing') return 3;
    if (status === 'Siap Diambil' || status === 'Siap Diantar' || status === 'Delivery') return 4;
    if (status === 'Selesai') return 5;
    return 0;
  };

  const currentStageIndex = trackedOrder ? getStageIndex(trackedOrder.work_status || trackedOrder.workStatus) : 0;

  return (
    <div className="fixed inset-0 z-50 bg-[#313030]/60 backdrop-blur-sm flex justify-center items-center p-4">
      <div className="bg-white rounded-3xl border border-[#e0e0e0] w-full max-w-3xl shadow-2xl overflow-hidden animate-fade-in flex flex-col max-h-[92vh]">
        
        {/* Modal Header Bar */}
        <div className="p-5 border-b border-[#e0e0e0] flex justify-between items-center bg-gradient-to-r from-slate-50 via-white to-pink-50/30">
          <div className="flex items-center gap-2.5">
            <div className="p-2.5 bg-[#5f1340]/10 text-[#5f1340] rounded-2xl border border-[#5f1340]/15">
              <Search className="h-5 w-5" />
            </div>
            <div>
              <h3 className="text-base font-black text-[#313030]">Lacak Status Progress Nota</h3>
              <p className="text-xs text-slate-400 font-medium mt-0.5">Pantau alur pengerjaan cucian nota & rincian progress per item real-time</p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-2 hover:bg-slate-100 rounded-xl text-slate-400 hover:text-slate-700 transition-colors cursor-pointer"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Modal Search Toolbar Section */}
        <div className="p-5 bg-slate-50/70 border-b border-[#e0e0e0] flex flex-col gap-3">
          <div className="flex flex-col sm:flex-row gap-2">
            {/* Search Input */}
            <div className="relative flex-1">
              <Search className="absolute left-3.5 top-3 h-4 w-4 text-slate-400 pointer-events-none" />
              <input
                type="text"
                placeholder="Masukkan Nomor Struk Nota (misal: WS-0826001)..."
                value={searchKey}
                onChange={(e) => setSearchKey(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleSearchOrder()}
                className="w-full pl-10 pr-4 py-2.5 border border-[#e0e0e0] rounded-2xl text-xs font-bold text-[#313030] bg-white outline-none focus:border-[#5f1340] focus:ring-2 focus:ring-[#5f1340]/20 shadow-xs"
              />
            </div>

            {/* Submit Lacak Button */}
            <button
              type="button"
              disabled={isLoading}
              onClick={() => handleSearchOrder()}
              className="px-5 py-2.5 bg-[#5f1340] hover:bg-[#4d0f33] text-white font-black rounded-2xl text-xs transition-all shadow-xs cursor-pointer flex items-center justify-center gap-1.5 whitespace-nowrap"
            >
              <Search className="h-4 w-4" />
              <span>{isLoading ? 'Melacak...' : 'Lacak Nota'}</span>
            </button>

            {/* Placeholder Scan Barcode / QR */}
            <button
              type="button"
              onClick={() => alert('Fitur Scanner Camera Barcode / QR Code Nota Waschen siap diaktifkan saat terhubung ke perangkat kamera fisik!')}
              className="px-4 py-2.5 bg-white border border-[#e0e0e0] hover:border-[#5f1340] text-slate-700 hover:text-[#5f1340] font-bold rounded-2xl text-xs transition-all shadow-xs cursor-pointer flex items-center justify-center gap-1.5 whitespace-nowrap"
              title="Pindai QR / Barcode Struk Nota via Kamera"
            >
              <QrCode className="h-4 w-4 text-[#5f1340]" />
              <span>Scan Barcode</span>
            </button>
          </div>

          {/* Quick Suggestion Pills */}
          {recentOrders.length > 0 && (
            <div className="flex items-center gap-1.5 overflow-x-auto pt-1 no-scrollbar">
              <span className="text-[10px] font-extrabold text-slate-400 uppercase tracking-wider whitespace-nowrap">Nota Terbaru:</span>
              {recentOrders.slice(0, 5).map(o => (
                <button
                  key={o.id || o.order_no}
                  type="button"
                  onClick={() => {
                    setSearchKey(o.order_no);
                    handleSearchOrder(o.order_no);
                  }}
                  className={`px-2.5 py-1 rounded-xl text-[11px] font-mono font-bold transition-all cursor-pointer whitespace-nowrap ${
                    searchKey === o.order_no
                      ? 'bg-[#5f1340] text-white shadow-2xs'
                      : 'bg-white border border-[#e0e0e0] text-slate-600 hover:border-[#5f1340]/40'
                  }`}
                >
                  {o.order_no}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Modal Body: Tracking Results */}
        <div className="p-6 overflow-y-auto flex flex-col gap-6 text-xs bg-white">
          {errorMessage && (
            <div className="p-4 bg-rose-50 border border-rose-200 rounded-2xl text-rose-800 flex items-center gap-3">
              <AlertCircle className="h-5 w-5 text-rose-600 flex-shrink-0" />
              <div>
                <span className="font-extrabold text-xs block">Nota Tidak Ditemukan</span>
                <span className="text-[11px] font-medium">{errorMessage}</span>
              </div>
            </div>
          )}

          {trackedOrder && (
            <>
              {/* 1. Header Card Nota Summary */}
              <div className="bg-gradient-to-r from-slate-50 via-white to-pink-50/20 border border-[#e0e0e0] rounded-2xl p-4 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 shadow-2xs">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-mono font-black text-lg text-[#5f1340]">{trackedOrder.order_no || trackedOrder.id}</span>
                    <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-black border ${
                      trackedOrder.payment_status === 'Lunas' || trackedOrder.paymentStatus === 'Lunas'
                        ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                        : 'bg-rose-50 text-rose-700 border-rose-200'
                    }`}>
                      {trackedOrder.payment_status || trackedOrder.paymentStatus || 'Belum Lunas'}
                    </span>
                  </div>
                  
                  <div className="flex items-center gap-3 mt-1 text-slate-500 font-medium text-xs">
                    <span>Pelanggan: <strong className="text-[#313030]">{formatName(trackedOrder.customer_name || trackedOrder.customerName)}</strong></span>
                    <button
                      type="button"
                      onClick={() => handleOpenWA(trackedOrder.customer_phone || trackedOrder.customerPhone, trackedOrder.customer_name || trackedOrder.customerName, trackedOrder.order_no || trackedOrder.id, trackedOrder.work_status || trackedOrder.workStatus)}
                      className="text-emerald-600 hover:underline font-mono font-bold text-[11px]"
                    >
                      {trackedOrder.customer_phone || trackedOrder.customerPhone}
                    </button>
                  </div>
                </div>

                <div className="text-left sm:text-right">
                  <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider block">Total Tagihan</span>
                  <span className="text-xl font-black text-[#313030] block">
                    Rp {parseFloat(trackedOrder.grand_total || trackedOrder.grandTotal || trackedOrder.totalAmount || 0).toLocaleString('id-ID')}
                  </span>
                  <span className="text-[10px] text-slate-400 block mt-0.5">
                    Tanggal: {trackedOrder.order_date ? new Date(trackedOrder.order_date).toLocaleDateString('id-ID', { dateStyle: 'medium' }) : (trackedOrder.createdAt || '-')}
                  </span>
                </div>
              </div>

              {/* 2. Visual Overall Stepper Timeline (Nota Progress) */}
              <div className="bg-slate-50 border border-[#e0e0e0] rounded-2xl p-5">
                <div className="flex justify-between items-center mb-4">
                  <h4 className="font-black text-[#313030] text-xs uppercase tracking-wider flex items-center gap-1.5">
                    <Clock className="h-4 w-4 text-[#5f1340]" />
                    <span>Progress Pengerjaan Nota Utama</span>
                  </h4>
                  <span className="px-2.5 py-0.5 rounded-full bg-[#5f1340]/10 text-[#5f1340] text-[10px] font-black border border-[#5f1340]/20">
                    Status: {trackedOrder.work_status || trackedOrder.workStatus}
                  </span>
                </div>

                {/* Horizontal Stepper Timeline */}
                <div className="grid grid-cols-2 sm:grid-cols-6 gap-2 relative">
                  {WORKFLOW_STAGES.map((stage, idx) => {
                    const isDone = idx <= currentStageIndex;
                    const isCurrent = idx === currentStageIndex;
                    const IconComp = stage.icon;

                    return (
                      <div
                        key={stage.id}
                        className={`flex flex-col items-center text-center p-3 rounded-2xl border transition-all duration-300 ${
                          isCurrent
                            ? 'bg-[#5f1340] text-white border-[#5f1340] shadow-md scale-105 z-10'
                            : isDone
                            ? 'bg-emerald-50 text-emerald-900 border-emerald-200'
                            : 'bg-white text-slate-400 border-slate-200'
                        }`}
                      >
                        <div className={`p-2 rounded-xl mb-1.5 ${
                          isCurrent
                            ? 'bg-white/20 text-white animate-pulse'
                            : isDone
                            ? 'bg-emerald-600 text-white'
                            : 'bg-slate-100 text-slate-400'
                        }`}>
                          <IconComp className="h-4 w-4" />
                        </div>
                        <span className="font-extrabold text-xs block leading-tight">{stage.label}</span>
                        <span className={`text-[9px] mt-0.5 block ${isCurrent ? 'text-rose-100' : isDone ? 'text-emerald-700' : 'text-slate-400'}`}>
                          {stage.desc}
                        </span>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* 3. Itemized Detail Progress Breakdown (Progress Per Item) */}
              <div>
                <div className="flex justify-between items-center mb-3">
                  <h4 className="font-black text-[#313030] text-xs uppercase tracking-wider flex items-center gap-1.5">
                    <Layers className="h-4 w-4 text-[#5f1340]" />
                    <span>Progress Pengerjaan Per Item ({trackedOrder.items?.length || 1} Item)</span>
                  </h4>
                  <span className="text-[10px] text-slate-400 font-medium">Status Fisik Pakaian Rincian</span>
                </div>

                <div className="border border-[#e0e0e0] rounded-2xl overflow-hidden shadow-2xs">
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="bg-slate-100/80 border-b border-[#e0e0e0] text-[10px] uppercase font-extrabold text-slate-500 tracking-wider">
                        <th className="py-3 px-4">Detail Item & Layanan</th>
                        <th className="py-3 px-4 text-center">Spesifikasi Fisik</th>
                        <th className="py-3 px-4 text-center">Qty</th>
                        <th className="py-3 px-4 text-center">Status Item</th>
                        <th className="py-3 px-4 text-right">Subtotal</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[#e0e0e0] text-xs font-semibold">
                      {(trackedOrder.items && trackedOrder.items.length > 0) ? (
                        trackedOrder.items.map((item, idx) => {
                          const itemStatus = item.item_work_status || item.status || trackedOrder.work_status || trackedOrder.workStatus || 'Antrean';
                          const itemStageIdx = getStageIndex(itemStatus);

                          return (
                            <tr key={item.id || idx} className="hover:bg-slate-50/80 transition-colors">
                              {/* Layanan */}
                              <td className="py-3.5 px-4">
                                <span className="font-extrabold text-[#313030] text-xs block">{item.service_name || item.serviceName || trackedOrder.serviceType}</span>
                                {item.condition_notes || item.conditionNotes ? (
                                  <span className="text-[10px] text-slate-500 block mt-0.5">Catatan: {item.condition_notes || item.conditionNotes}</span>
                                ) : null}
                              </td>

                              {/* Spesifikasi Fisik */}
                              <td className="py-3.5 px-4 text-center">
                                {(item.brand || item.color || item.size) ? (
                                  <div className="flex items-center justify-center gap-1 flex-wrap">
                                    {item.brand && <span className="bg-slate-100 text-slate-700 text-[9px] font-bold px-1.5 py-0.5 rounded-md border border-slate-200">{item.brand}</span>}
                                    {item.color && <span className="bg-slate-100 text-slate-700 text-[9px] font-bold px-1.5 py-0.5 rounded-md border border-slate-200">{item.color}</span>}
                                    {item.size && <span className="bg-slate-100 text-slate-700 text-[9px] font-bold px-1.5 py-0.5 rounded-md border border-slate-200">{item.size}</span>}
                                  </div>
                                ) : (
                                  <span className="text-[10px] text-slate-400 font-mono">-</span>
                                )}
                              </td>

                              {/* Qty */}
                              <td className="py-3.5 px-4 text-center font-bold text-slate-700">
                                {item.qty} {item.unit || 'Pcs'}
                              </td>

                              {/* Progress Status Item */}
                              <td className="py-3.5 px-4 text-center">
                                <div className="inline-flex flex-col items-center">
                                  <span className={`px-3 py-1 rounded-full border text-[10px] font-black inline-flex items-center gap-1 shadow-2xs ${
                                    itemStatus === 'Selesai'
                                      ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                                      : itemStatus === 'Siap Diambil' || itemStatus === 'Siap Diantar'
                                      ? 'bg-amber-50 text-amber-800 border-amber-300'
                                      : 'bg-purple-50 text-purple-800 border-purple-200'
                                  }`}>
                                    <Clock className="h-3 w-3" />
                                    <span>{itemStatus}</span>
                                  </span>

                                  {/* Item Mini Progress Stepper Dots */}
                                  <div className="flex items-center gap-1 mt-1.5">
                                    {[0, 1, 2, 3, 4, 5].map(step => (
                                      <div
                                        key={step}
                                        className={`h-1.5 rounded-full transition-all ${
                                          step === itemStageIdx
                                            ? 'w-4 bg-[#5f1340]'
                                            : step < itemStageIdx
                                            ? 'w-1.5 bg-emerald-500'
                                            : 'w-1.5 bg-slate-200'
                                        }`}
                                        title={`Step ${step + 1}`}
                                      />
                                    ))}
                                  </div>
                                </div>
                              </td>

                              {/* Subtotal */}
                              <td className="py-3.5 px-4 text-right font-mono font-black text-[#313030] text-xs">
                                Rp {parseFloat(item.subtotal || trackedOrder.grand_total || 0).toLocaleString('id-ID')}
                              </td>
                            </tr>
                          );
                        })
                      ) : (
                        <tr className="hover:bg-slate-50">
                          <td className="py-3.5 px-4 font-extrabold text-[#313030]">
                            {trackedOrder.serviceType || 'Cuci Laundry'}
                          </td>
                          <td className="py-3.5 px-4 text-center text-slate-400 font-mono">-</td>
                          <td className="py-3.5 px-4 text-center font-bold text-slate-600">
                            {trackedOrder.qty || '1 Pcs'}
                          </td>
                          <td className="py-3.5 px-4 text-center">
                            <span className="px-3 py-1 rounded-full border text-[10px] font-black bg-purple-50 text-purple-800 border-purple-200 inline-flex items-center gap-1">
                              <Clock className="h-3 w-3" />
                              <span>{trackedOrder.work_status || trackedOrder.workStatus}</span>
                            </span>
                          </td>
                          <td className="py-3.5 px-4 text-right font-mono font-black text-[#313030]">
                            Rp {parseFloat(trackedOrder.grand_total || trackedOrder.totalAmount || 0).toLocaleString('id-ID')}
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </>
          )}
        </div>

        {/* Modal Footer */}
        <div className="p-4 bg-slate-50 border-t border-[#e0e0e0] flex justify-between items-center text-xs">
          <span className="text-[10px] text-slate-400 font-bold">Waschen Laundry POS Enterprise v2.0 &bull; Live Tracking</span>
          <button
            type="button"
            onClick={onClose}
            className="px-5 py-2 bg-slate-800 hover:bg-slate-900 text-white font-black rounded-xl text-xs cursor-pointer shadow-2xs"
          >
            Tutup
          </button>
        </div>
      </div>
    </div>
  );
}
