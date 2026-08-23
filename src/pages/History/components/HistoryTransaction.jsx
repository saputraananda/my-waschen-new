import React, { useState } from 'react';
import axios from 'axios';
import { formatName } from '../../../utils/FormatName';
import {
  Search,
  Printer,
  CheckCircle2,
  Clock,
  ArrowRight,
  PackageCheck,
  AlertCircle,
  Truck,
  Layers,
  Shirt,
  Wind,
  X,
  Trash2,
  RotateCcw
} from 'lucide-react';

const STATUS_STEPS = {
  'Antrean': { text: 'text-slate-600', bg: 'bg-slate-100 border-slate-200', icon: Clock },
  'Diterima': { text: 'text-slate-600', bg: 'bg-slate-100 border-slate-200', icon: Clock },
  'Pencucian': { text: 'text-sky-700', bg: 'bg-sky-50 border-sky-200', icon: Wind },
  'Proses Cuci': { text: 'text-sky-700', bg: 'bg-sky-50 border-sky-200', icon: Wind },
  'Penyetrikaan': { text: 'text-indigo-700', bg: 'bg-indigo-50 border-indigo-200', icon: Shirt },
  'Proses Setrika': { text: 'text-indigo-700', bg: 'bg-indigo-50 border-indigo-200', icon: Shirt },
  'Pengemasan': { text: 'text-purple-700', bg: 'bg-purple-50 border-purple-200', icon: Layers },
  'Proses Packing': { text: 'text-purple-700', bg: 'bg-purple-50 border-purple-200', icon: Layers },
  'Siap Diambil': { text: 'text-amber-700', bg: 'bg-amber-50 border-amber-200', icon: PackageCheck },
  'Siap Diantar': { text: 'text-blue-700', bg: 'bg-blue-50 border-blue-200', icon: Truck },
  'Delivery': { text: 'text-blue-700', bg: 'bg-blue-50 border-blue-200', icon: Truck },
  'Selesai': { text: 'text-emerald-700', bg: 'bg-emerald-50 border-emerald-200', icon: CheckCircle2 }
};

export default function HistoryTransaction({
  transactions,
  setTransactions,
  outlets,
  showToast,
  fetchTransactions
}) {
  // Search & Filter States
  const [searchQuery, setSearchQuery] = useState('');
  const [paymentFilter, setPaymentFilter] = useState('Semua'); // Semua | Lunas | Belum Lunas
  const [activeFilterTab, setActiveFilterTab] = useState('Semua'); // Status Workflow Tab
  const [selectedBranchFilter, setSelectedBranchFilter] = useState(localStorage.getItem('activeOutletName') || 'Semua');
  const [dateFilter, setDateFilter] = useState(''); // YYYY-MM-DD string

  // Modals
  const [selectedReceipt, setSelectedReceipt] = useState(null);
  const [deleteModalOrder, setDeleteModalOrder] = useState(null);
  const [deleteReason, setDeleteReason] = useState('');
  const [isSubmittingDelete, setIsSubmittingDelete] = useState(false);

  // WhatsApp Helper
  const handleOpenWA = (e, order) => {
    if (e) e.stopPropagation();
    let rawPhone = (order.customerPhone || '').replace(/[^0-9]/g, '');
    if (rawPhone.startsWith('0')) {
      rawPhone = '62' + rawPhone.slice(1);
    }
    if (!rawPhone) rawPhone = '628123456789';
    const message = encodeURIComponent(`Halo Kak ${order.customerName || 'Pelanggan'}, update status pengerjaan nota ${order.id} Anda saat ini: ${order.progressStatus || order.workStatus}. Terima kasih telah mempercayakan Waschen Laundry! 😊`);
    window.open(`https://wa.me/${rawPhone}?text=${message}`, '_blank');
  };

  // Mark transaction as paid
  const handleMarkAsPaid = async (trxId) => {
    const target = transactions.find(t => t.id === trxId);
    const method = prompt('Pilih metode pembayaran (Tunai / QRIS / Transfer BCA):', 'QRIS Gopay');
    if (!method) return;

    try {
      if (target?.dbId) {
        await axios.patch(`/api/transactions/${target.dbId}/pay`, {
          paymentMethod: method,
          paidAmount: target.grandTotal
        });
      }

      setTransactions(transactions.map(t => {
        if (t.id === trxId) {
          return {
            ...t,
            paymentStatus: 'Lunas',
            paymentMethod: method
          };
        }
        return t;
      }));

      if (selectedReceipt && selectedReceipt.id === trxId) {
        setSelectedReceipt({
          ...selectedReceipt,
          paymentStatus: 'Lunas',
          paymentMethod: method
        });
      }

      showToast('Pembayaran Diterima', `Nota ${trxId} telah berhasil dilunasi via ${method}`);
    } catch (err) {
      console.error('Gagal memperbarui status pembayaran:', err);
      showToast('Gagal Lunasi', err.response?.data?.message || 'Terjadi kesalahan sistem', 'error');
    }
  };

  // Submit Delete Request
  const handleSubmitDeleteRequest = async () => {
    if (!deleteModalOrder) return;
    if (!deleteReason.trim()) {
      alert('Harap isi alasan pengajuan hapus nota!');
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
    if (paymentFilter === 'Lunas' && order.paymentStatus !== 'Lunas') return false;
    if (paymentFilter === 'Belum Lunas' && order.paymentStatus !== 'Belum Lunas') return false;

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
    const status = order.progressStatus || order.workStatus;
    if (activeFilterTab !== 'Semua') {
      if (activeFilterTab === 'Antrean' && status !== 'Antrean' && status !== 'Diterima') return false;
      if (activeFilterTab === 'Pencucian' && status !== 'Pencucian' && status !== 'Proses Cuci') return false;
      if (activeFilterTab === 'Penyetrikaan' && status !== 'Penyetrikaan' && status !== 'Proses Setrika') return false;
      if (activeFilterTab === 'Pengemasan' && status !== 'Pengemasan' && status !== 'Proses Packing') return false;
      if (activeFilterTab === 'Siap Diambil / Diantar' && status !== 'Siap Diambil' && status !== 'Siap Diantar' && status !== 'Delivery') return false;
      if (activeFilterTab === 'Selesai' && status !== 'Selesai') return false;
    }

    return true;
  });

  // Helper for Status Tab Counts
  const getTabCount = (tabName) => {
    const baseList = activeTransactions.filter(order => {
      if (paymentFilter === 'Lunas' && order.paymentStatus !== 'Lunas') return false;
      if (paymentFilter === 'Belum Lunas' && order.paymentStatus !== 'Belum Lunas') return false;
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
    if (tabName === 'Antrean') return baseList.filter(o => (o.progressStatus || o.workStatus) === 'Antrean' || (o.progressStatus || o.workStatus) === 'Diterima').length;
    if (tabName === 'Pencucian') return baseList.filter(o => (o.progressStatus || o.workStatus) === 'Pencucian' || (o.progressStatus || o.workStatus) === 'Proses Cuci').length;
    if (tabName === 'Penyetrikaan') return baseList.filter(o => (o.progressStatus || o.workStatus) === 'Penyetrikaan' || (o.progressStatus || o.workStatus) === 'Proses Setrika').length;
    if (tabName === 'Pengemasan') return baseList.filter(o => (o.progressStatus || o.workStatus) === 'Pengemasan' || (o.progressStatus || o.workStatus) === 'Proses Packing').length;
    if (tabName === 'Siap Diambil / Diantar') return baseList.filter(o => (o.progressStatus || o.workStatus) === 'Siap Diambil' || (o.progressStatus || o.workStatus) === 'Siap Diantar' || (o.progressStatus || o.workStatus) === 'Delivery').length;
    if (tabName === 'Selesai') return baseList.filter(o => (o.progressStatus || o.workStatus) === 'Selesai').length;
    return 0;
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
            {outlets.length > 0 ? (
              outlets.map(o => (
                <option key={o.id} value={o.full_name || o.name}>{o.full_name || o.name}</option>
              ))
            ) : (
              <>
                <option value="Waschen Laundry Raffles Hills">Waschen Laundry Raffles Hills</option>
                <option value="Waschen Laundry Citra Gran">Waschen Laundry Citra Gran</option>
              </>
            )}
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
            <option value="Belum Lunas">Belum Lunas Only</option>
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
        {['Semua', 'Antrean', 'Pencucian', 'Penyetrikaan', 'Pengemasan', 'Siap Diambil / Diantar', 'Selesai'].map((tab) => {
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
                const statusMeta = STATUS_STEPS[workStatus] || { text: 'text-slate-600', bg: 'bg-slate-100 border-slate-200', icon: Clock };
                const StatusIcon = statusMeta.icon;

                return (
                  <tr
                    key={order.id}
                    onClick={() => setSelectedReceipt(order)}
                    className="hover:bg-[#5f1340]/[0.03] cursor-pointer transition-colors group"
                    title="Klik untuk melihat rincian pengerjaan per item"
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
                      <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full border text-xs font-black shadow-2xs ${statusMeta.bg} ${statusMeta.text}`}>
                        <StatusIcon className="h-3.5 w-3.5" />
                        <span>{workStatus}</span>
                      </span>
                    </td>

                    {/* Tagihan (Single Line) */}
                    <td className="py-3.5 px-6 font-black text-[#313030] text-sm whitespace-nowrap">
                      Rp {(order.grandTotal || order.totalAmount || 0).toLocaleString('id-ID')}
                    </td>

                    {/* Status Bayar (Center Aligned, Single Line) */}
                    <td className="py-3.5 px-6 text-center whitespace-nowrap">
                      {order.paymentStatus === 'Lunas' ? (
                        <span className="px-3 py-1 rounded-xl bg-emerald-50 text-emerald-700 border border-emerald-200 text-[10px] font-black inline-flex items-center gap-1 shadow-2xs whitespace-nowrap">
                          <CheckCircle2 className="h-3 w-3 text-emerald-600" />
                          <span>Lunas ({order.paymentMethod})</span>
                        </span>
                      ) : (
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleMarkAsPaid(order.id);
                          }}
                          className="px-3 py-1 rounded-xl bg-rose-50 hover:bg-rose-600 text-rose-700 hover:text-white border border-rose-200 text-[10px] font-black inline-flex items-center gap-1 transition-all shadow-2xs cursor-pointer whitespace-nowrap group/pay"
                          title="Klik untuk proses pelunasan nota"
                        >
                          <AlertCircle className="h-3 w-3 text-rose-600 group-hover/pay:text-white" />
                          <span>Belum Lunas</span>
                        </button>
                      )}
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
                <span className="text-[10px] text-slate-500 block">Kasir: {selectedReceipt.cashierName}</span>
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
                <span className={`font-bold ${selectedReceipt.paymentStatus === 'Lunas' ? 'text-emerald-700' : 'text-rose-700'}`}>
                  {selectedReceipt.paymentStatus} ({selectedReceipt.paymentMethod})
                </span>
              </div>
              <div className="flex justify-between text-[10px]">
                <span>Status Pengerjaan:</span>
                <span className="font-bold">{selectedReceipt.progressStatus || selectedReceipt.workStatus}</span>
              </div>
            </div>

            <div className="p-4 bg-[#f8f8f8] flex gap-2">
              {selectedReceipt.paymentStatus === 'Belum Lunas' && (
                <button
                  onClick={() => handleMarkAsPaid(selectedReceipt.id)}
                  className="px-3 py-2.5 bg-emerald-600 text-white rounded-xl font-black text-xs flex items-center justify-center gap-1.5 cursor-pointer"
                >
                  <CheckCircle2 className="h-4 w-4" />
                  <span>Lunasi</span>
                </button>
              )}
              <button
                onClick={() => {
                  alert('Struk transaksi berhasil dikirim ke Printer Thermal Bluetooth Waschen!');
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
    </div>
  );
}
