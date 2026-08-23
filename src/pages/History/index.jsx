import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import HeaderNav from '../../components/HeaderNav';
import HistoryTransaction from './components/HistoryTransaction';
import RequestDeleteTransaction from './components/RequestDeleteTransaction';
import {
  History as HistoryIcon,
  Trash2,
  CheckCircle2,
  ShoppingBag
} from 'lucide-react';

export default function History() {
  const navigate = useNavigate();
  const [userProfile, setUserProfile] = useState(null);
  const [activeOutletName, setActiveOutletName] = useState(localStorage.getItem('activeOutletName') || 'Waschen Laundry Raffles Hills');
  const [activeOutletId, setActiveOutletId] = useState(localStorage.getItem('activeOutletId') || '');
  const [outlets, setOutlets] = useState([]);

  // Active Tab State: 'history' | 'request_delete'
  const [activeTab, setActiveTab] = useState('history');

  // Transactions State
  const [transactions, setTransactions] = useState([]);

  // Toast Notification
  const [toast, setToast] = useState(null);
  const showToast = (title, message, type = 'success') => {
    setToast({ title, message, type });
    setTimeout(() => setToast(null), 3500);
  };

  useEffect(() => {
    document.title = 'Riwayat Transaksi POS | Waschen Laundry';
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

    axios.get('/api/outlets')
      .then(res => {
        if (res.data && res.data.success && res.data.data.length > 0) {
          setOutlets(res.data.data);
        }
      })
      .catch(err => console.error('Gagal mengambil data outlet:', err));

    fetchTransactions();
  }, [navigate]);

  const fetchTransactions = async () => {
    try {
      const res = await axios.get('/api/transactions');
      if (res.data && res.data.success && res.data.data.length > 0) {
        const mapped = res.data.data.map(t => ({
          id: t.order_no,
          dbId: t.id,
          customerName: t.customer_name || 'Pelanggan',
          customerPhone: t.customer_phone || '-',
          customerTier: t.customer_tier || 'Reguler',
          branch: t.home_branch || 'Waschen Laundry Citra Gran',
          serviceType: t.speed_name ? `${t.order_category} - ${t.speed_name}` : t.order_category,
          category: t.order_category,
          qty: t.order_category === 'Kiloan' ? `${t.total_weight_kg} Kg` : `${t.total_pcs} Pcs`,
          perfume: t.parfume_name || 'Standar',
          speed: t.speed_name || 'Reguler',
          subtotal: parseFloat(t.subtotal) || 0,
          grandTotal: parseFloat(t.grand_total) || 0,
          paymentStatus: t.payment_status || 'Belum Lunas',
          paymentMethod: t.payment_method || '-',
          progressStatus: t.work_status || 'Antrean',
          cashierName: t.cashier_employee_id ? `Kasir #${t.cashier_employee_id}` : 'Kasir Waschen',
          createdAt: new Date(t.order_date).toLocaleString('id-ID', { dateStyle: 'medium', timeStyle: 'short' }),
          notes: t.special_notes || '-',
          // Delete Request Fields
          isDeleteRequested: t.is_delete_requested === 1 || t.is_delete_requested === true,
          deleteApprovalStatus: t.delete_approval_status,
          deleteRequestedAt: t.delete_requested_at ? new Date(t.delete_requested_at).toLocaleString('id-ID', { dateStyle: 'medium', timeStyle: 'short' }) : null,
          deleteReason: t.delete_reason || null
        }));
        setTransactions(mapped);
      }
    } catch (err) {
      console.error('Gagal mengambil data transaksi:', err);
    }
  };

  const activeTransactionsCount = transactions.filter(t => !t.isDeleteRequested).length;
  const deleteRequestsCount = transactions.filter(t => t.isDeleteRequested).length;

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

      {/* Toast Notification */}
      {toast && (
        <div className="fixed top-5 right-5 z-50 animate-bounce">
          <div className="p-4 rounded-2xl shadow-2xl border flex items-center gap-3 bg-emerald-50 border-emerald-200 text-emerald-900">
            <CheckCircle2 className="h-5 w-5 text-emerald-600" />
            <div>
              <span className="font-extrabold text-xs block">{toast.title}</span>
              <span className="text-[11px] font-medium">{toast.message}</span>
            </div>
          </div>
        </div>
      )}

      {/* Main Workspace */}
      <main className="max-w-[1500px] w-full mx-auto p-4 sm:p-6 flex-grow flex flex-col gap-6">
        {/* Top Header Bar */}
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-white border border-[#e0e0e0] rounded-3xl p-5 shadow-2xs">
          <div>
            <h1 className="text-xl sm:text-2xl font-black text-[#313030] tracking-tight flex items-center gap-2.5">
              <HistoryIcon className="h-6 w-6 text-[#5f1340]" />
              <span>Riwayat Transaksi & Request Delete</span>
            </h1>
            <p className="text-xs text-slate-400 mt-0.5">Daftar pesanan kasir, cetak ulang struk, dan pengajuan hapus nota (Pending Approval vs Approved)</p>
          </div>

          <button
            onClick={() => navigate('/transaction')}
            className="flex items-center gap-2 px-5 py-2.5 bg-[#5f1340] hover:bg-[#4d0f33] text-white font-black rounded-xl text-xs transition-all shadow-2xs cursor-pointer"
          >
            <ShoppingBag className="h-4 w-4" />
            <span>+ Order Transaksi Baru</span>
          </button>
        </div>

        {/* Main Tab Bar Navigation */}
        <div className="flex border-b border-[#e0e0e0] gap-2">
          <button
            type="button"
            onClick={() => setActiveTab('history')}
            className={`px-5 py-3 font-extrabold text-xs rounded-t-2xl border-t border-x transition-all flex items-center gap-2 cursor-pointer ${
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
              {activeTransactionsCount}
            </span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('request_delete')}
            className={`px-5 py-3 font-extrabold text-xs rounded-t-2xl border-t border-x transition-all flex items-center gap-2 cursor-pointer ${
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
        </div>

        {/* Tab Content Rendering */}
        {activeTab === 'history' ? (
          <HistoryTransaction
            transactions={transactions}
            setTransactions={setTransactions}
            outlets={outlets}
            showToast={showToast}
            fetchTransactions={fetchTransactions}
          />
        ) : (
          <RequestDeleteTransaction
            transactions={transactions}
            outlets={outlets}
          />
        )}
      </main>
    </div>
  );
}
