import React, { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import axios from 'axios';
import HeaderNav from '../../components/HeaderNav';
import DashboardPettyCash from './components/DashboardPettyCash';
import AddPettyCash from './components/AddPettyCash';
import {
  Wallet,
  Plus,
  BarChart3,
  CheckCircle2,
  AlertCircle
} from 'lucide-react';

export const mapCashLogFromApi = (p) => ({
  id: p.id,
  type: p.type,
  category: p.category,
  amount: parseFloat(p.amount) || 0,
  desc: p.description || 'Pencatatan kas',
  date: new Date(p.transaction_date).toLocaleString('id-ID', { dateStyle: 'medium', timeStyle: 'short' }),
  createdBy: 'Staff Kasir'
});

export default function PettyCash() {
  const navigate = useNavigate();
  const location = useLocation();
  const [userProfile, setUserProfile] = useState(null);
  const [activeOutletName, setActiveOutletName] = useState(localStorage.getItem('activeOutletName') || 'Waschen Laundry Raffles Hills');
  const [activeOutletId, setActiveOutletId] = useState(localStorage.getItem('activeOutletId') || '');
  const [outlets, setOutlets] = useState([]);
  const [activeTab, setActiveTab] = useState('dashboard');
  const [cashLogs, setCashLogs] = useState([]);
  const [initialCashFloat, setInitialCashFloat] = useState(0);
  const [toast, setToast] = useState(null);

  const showToast = (title, message, type = 'success') => {
    setToast({ title, message, type });
    setTimeout(() => setToast(null), 3500);
  };

  useEffect(() => {
    const params = new URLSearchParams(location.search);
    if (params.get('tab') === 'add' || location.state?.tab === 'add') {
      setActiveTab('add');
    }
  }, [location]);

  useEffect(() => {
    document.title = 'Petty Cash Laci Outlet | Waschen Laundry';
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
      .then(res => {
        if (res.data && res.data.success && res.data.data.length > 0) {
          setOutlets(res.data.data);
        }
      })
      .catch(err => console.error('Gagal mengambil data outlet:', err));

    fetchPettyCash();
  }, [navigate]);

  const fetchPettyCash = async () => {
    try {
      const res = await axios.get('/api/petty-cash');
      if (res.data && res.data.success) {
        if (typeof res.data.initialFloat === 'number') {
          setInitialCashFloat(res.data.initialFloat);
        }
        if (res.data.data && res.data.data.length > 0) {
          setCashLogs(res.data.data.map(mapCashLogFromApi));
        } else {
          setCashLogs([]);
        }
      }
    } catch (err) {
      console.error('Gagal mengambil data kas kecil:', err);
    }
  };

  const handleCashLogCreated = (newLog) => {
    setCashLogs(prev => [newLog, ...prev]);
  };

  const scrollToTop = () => {
    window.scrollTo({ top: 0, left: 0, behavior: 'instant' });
    if (document.documentElement) document.documentElement.scrollTop = 0;
    if (document.body) document.body.scrollTop = 0;
  };

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
            toast.type === 'error' ? 'bg-rose-50 border-rose-200 text-rose-800' : 'bg-emerald-50 border-emerald-200 text-emerald-900'
          }`}>
            {toast.type === 'error' ? (
              <AlertCircle className="h-5 w-5 text-rose-600" />
            ) : (
              <CheckCircle2 className="h-5 w-5 text-emerald-600" />
            )}
            <div>
              <span className="font-extrabold text-xs block">{toast.title}</span>
              <span className="text-[11px] font-medium">{toast.message}</span>
            </div>
          </div>
        </div>
      )}

      <main className="max-w-[1500px] w-full mx-auto p-4 sm:p-6 flex-grow flex flex-col gap-6">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-white border border-[#e0e0e0] rounded-3xl p-5 shadow-xs">
          <div>
            <h1 className="text-xl sm:text-2xl font-black text-[#313030] tracking-tight flex items-center gap-2.5">
              <Wallet className="h-6 w-6 text-[#5f1340]" />
              <span>Pencatatan Petty Cash (Kas Laci Outlet)</span>
            </h1>
            <p className="text-xs text-slate-400 mt-0.5">Pengelolaan saldo kas fisik laci, pencatatan pengeluaran operasional, dan suntikan modal kembalian</p>
          </div>

          <div className="flex items-center gap-2 bg-[#f8f8f8] border border-[#e0e0e0] p-1.5 rounded-2xl w-full sm:w-auto">
            <button
              type="button"
              onClick={() => {
                scrollToTop();
                setActiveTab('dashboard');
              }}
              className={`flex-1 sm:flex-none flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl text-xs font-black transition-all cursor-pointer ${
                activeTab === 'dashboard'
                  ? 'bg-[#5f1340] text-white shadow-xs'
                  : 'text-slate-500 hover:text-[#313030]'
              }`}
            >
              <BarChart3 className="h-4 w-4" />
              <span>Dashboard Kas Laci</span>
            </button>
            <button
              type="button"
              onClick={() => {
                scrollToTop();
                setActiveTab('add');
              }}
              className={`flex-1 sm:flex-none flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl text-xs font-black transition-all cursor-pointer ${
                activeTab === 'add'
                  ? 'bg-[#5f1340] text-white shadow-xs'
                  : 'text-slate-500 hover:text-[#313030]'
              }`}
            >
              <Plus className="h-4 w-4" />
              <span>Catat Transaksi Kas</span>
            </button>
          </div>
        </div>

        {activeTab === 'dashboard' && (
          <DashboardPettyCash
            cashLogs={cashLogs}
            initialCashFloat={initialCashFloat}
            activeOutletName={activeOutletName}
          />
        )}

        {activeTab === 'add' && (
          <AddPettyCash
            activeOutletId={activeOutletId}
            userProfile={userProfile}
            showToast={showToast}
            onCashLogCreated={handleCashLogCreated}
            onSwitchToDashboard={() => setActiveTab('dashboard')}
          />
        )}
      </main>
    </div>
  );
}
