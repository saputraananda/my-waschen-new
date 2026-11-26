import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import { useNetworkRestored } from '../../hooks/useNetworkRestored.js';
import HeaderNav from '../../components/HeaderNav';
import HistoryTransaction from './components/HistoryTransaction';
import RequestDeleteTransaction from './components/RequestDeleteTransaction';
import RequestRefundTransaction from './components/RequestRefundTransaction';
import RequestVoidPayment from './components/RequestVoidPayment';
import { mapHistoryTxn } from './mapHistoryTxn.js';
import {
  History as HistoryIcon,
  Trash2,
  RefreshCcw,
  Banknote
} from 'lucide-react';

export default function History() {
  const navigate = useNavigate();
  const [userProfile, setUserProfile] = useState(null);
  const [activeOutletName, setActiveOutletName] = useState(localStorage.getItem('activeOutletName') || 'Waschen Laundry Raffles Hills');
  const [activeOutletId, setActiveOutletId] = useState(localStorage.getItem('activeOutletId') || '');
  const [outlets, setOutlets] = useState([]);

  // Active Tab State: 'history' | 'request_delete' | 'request_refund' | 'request_void'
  const [activeTab, setActiveTab] = useState('history');


  useEffect(() => {
    document.title = 'Riwayat Transaksi | Waschen Laundry';
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

    const savedOutlet = localStorage.getItem('activeOutletName');
    if (savedOutlet) {
      setActiveOutletName(savedOutlet);
    }

    axios.get('/api/masters/outlets')
      .then(res => {
        if (res.data && res.data.success && res.data.data.length > 0) {
          setOutlets(res.data.data);
        }
      })
      .catch(err => console.error('Gagal mengambil data outlet:', err));

  }, [navigate]);

  useEffect(() => {
    fetchDeleteRequests(activeOutletId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeOutletId]);

  // Riwayat mengambil datanya sendiri per halaman (HistoryTransaction). Di sini hanya
  // nota pengajuan hapus (tab Request Delete + badge) dan jumlah total nota untuk badge.
  const [deleteRequests, setDeleteRequests] = useState([]);
  const [historyTotal, setHistoryTotal] = useState(0);

  const [refundRequestsCount, setRefundRequestsCount] = useState(0);
  const [voidRequests, setVoidRequests] = useState([]);

  /** Data badge tab: pengajuan hapus (juga isi tab Request Delete) + refund yang masih Pending. */
  const fetchDeleteRequests = async (outletId = localStorage.getItem('activeOutletId')) => {
    const [del, ref, vd] = await Promise.allSettled([
      axios.get('/api/transactions', {
        params: { lite: 1, outlet_id: outletId || undefined, delete_requested: 'only' },
        timeout: 20000
      }),
      axios.get('/api/transactions/refunds', { params: { outlet_id: outletId || undefined }, timeout: 20000 }),
      axios.get('/api/transactions/payment-voids', { params: { outlet_id: outletId || undefined }, timeout: 20000 })
    ]);
    if (vd.status === 'fulfilled' && Array.isArray(vd.value.data?.data)) {
      setVoidRequests(vd.value.data.data);
    }
    if (del.status === 'fulfilled' && del.value.data?.success) {
      setDeleteRequests(del.value.data.data.map(mapHistoryTxn));
    } else if (del.status === 'rejected') {
      console.error('Gagal mengambil pengajuan hapus:', del.reason);
    }
    if (ref.status === 'fulfilled' && Array.isArray(ref.value.data?.data)) {
      setRefundRequestsCount(ref.value.data.data.filter((r) => r.status === 'Pending').length);
    }
  };
  useNetworkRestored(() => fetchDeleteRequests(activeOutletId));

  // Badge hanya menghitung yang masih menunggu keputusan (bukan disetujui / ditolak).
  const deleteRequestsCount = deleteRequests.filter(
    t => t.isDeleteRequested && !(t.deleteApprovalStatus === 1 || t.deleteApprovalStatus === '1')
  ).length;
  const voidPendingCount = voidRequests.filter((r) => r.status === 'Pending').length;

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

      <main className="max-w-[1500px] w-full mx-auto p-4 sm:p-6 flex-grow flex flex-col gap-6">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-white border border-[#e0e0e0] rounded-3xl p-5 shadow-2xs">
          <div className="min-w-0 w-full">
            <h1 className="text-[clamp(13px,4.1vw,24px)] font-black text-[#313030] tracking-tight flex items-center gap-2 sm:gap-2.5 min-w-0">
              <HistoryIcon className="h-5 w-5 sm:h-6 sm:w-6 shrink-0 text-[#5f1340]" />
              <span className="whitespace-nowrap truncate">Riwayat Transaksi, Refund & Delete</span>
            </h1>
          </div>
        </div>

        <div className="flex border-b border-[#e0e0e0] gap-2 overflow-x-auto">
          <button
            type="button"
            onClick={() => setActiveTab('history')}
            className={`px-5 py-3 font-extrabold text-xs rounded-t-2xl border-t border-x transition-all flex items-center gap-2 cursor-pointer whitespace-nowrap ${
              activeTab === 'history'
                ? 'bg-white border-[#e0e0e0] text-[#5f1340] shadow-2xs -mb-px font-black'
                : 'bg-slate-100/60 border-transparent text-slate-500 hover:text-[#313030]'
            }`}
          >
            <HistoryIcon className="h-4 w-4" />
            <span>Riwayat Transaksi</span>
            <span className={`px-2 py-0.5 rounded-full text-[10px] font-black ${
              activeTab === 'history' ? 'bg-[#5f1340] text-white' : 'bg-slate-200 text-slate-700'
            }`}>
              {historyTotal}
            </span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('request_refund')}
            className={`px-5 py-3 font-extrabold text-xs rounded-t-2xl border-t border-x transition-all flex items-center gap-2 cursor-pointer whitespace-nowrap ${
              activeTab === 'request_refund'
                ? 'bg-white border-[#e0e0e0] text-sky-700 shadow-2xs -mb-px font-black'
                : 'bg-slate-100/60 border-transparent text-slate-500 hover:text-sky-600'
            }`}
          >
            <RefreshCcw className="h-4 w-4" />
            <span>Request Refund &amp; Deposit</span>
            {refundRequestsCount > 0 && (
              <span className="px-2 py-0.5 rounded-full text-[10px] font-black bg-sky-600 text-white animate-pulse">
                {refundRequestsCount}
              </span>
            )}
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('request_delete')}
            className={`px-5 py-3 font-extrabold text-xs rounded-t-2xl border-t border-x transition-all flex items-center gap-2 cursor-pointer whitespace-nowrap ${
              activeTab === 'request_delete'
                ? 'bg-white border-[#e0e0e0] text-rose-700 shadow-2xs -mb-px font-black'
                : 'bg-slate-100/60 border-transparent text-slate-500 hover:text-rose-600'
            }`}
          >
            <Trash2 className="h-4 w-4" />
            <span>Request Delete</span>
            {deleteRequestsCount > 0 && (
              <span className="px-2 py-0.5 rounded-full text-[10px] font-black bg-rose-600 text-white animate-pulse">
                {deleteRequestsCount}
              </span>
            )}
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('request_void')}
            className={`px-5 py-3 font-extrabold text-xs rounded-t-2xl border-t border-x transition-all flex items-center gap-2 cursor-pointer whitespace-nowrap ${
              activeTab === 'request_void'
                ? 'bg-white border-[#e0e0e0] text-sky-800 shadow-2xs -mb-px font-black'
                : 'bg-slate-100/60 border-transparent text-slate-500 hover:text-sky-700'
            }`}
          >
            <Banknote className="h-4 w-4" />
            <span>Request Hapus Pelunasan</span>
            {voidPendingCount > 0 && (
              <span className="px-2 py-0.5 rounded-full text-[10px] font-black bg-sky-700 text-white animate-pulse">
                {voidPendingCount}
              </span>
            )}
          </button>
        </div>

        {activeTab === 'history' && (
          <HistoryTransaction
            outletId={activeOutletId}
            outlets={outlets}
            onTotalChange={setHistoryTotal}
            onDeleteRequested={() => fetchDeleteRequests(activeOutletId)}
          />
        )}
        {activeTab === 'request_refund' && (
          <RequestRefundTransaction outletId={activeOutletId} />
        )}
        {activeTab === 'request_void' && (
          <RequestVoidPayment requests={voidRequests} />
        )}
        {activeTab === 'request_delete' && (
          <RequestDeleteTransaction
            transactions={deleteRequests}
            outlets={outlets}
          />
        )}
      </main>
    </div>
  );
}
