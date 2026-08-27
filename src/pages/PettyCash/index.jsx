import React, { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import axios from 'axios';
import HeaderNav from '../../components/HeaderNav';
import DashboardPettyCash from './components/DashboardPettyCash';
import AddPettyCash from './components/AddPettyCash';
import { useAppDialog } from '../../context/AppDialogContext.jsx';
import {
  Wallet,
  Plus,
  BarChart3
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
  const { showAlert } = useAppDialog();
  const [userProfile, setUserProfile] = useState(null);
  const [activeOutletName, setActiveOutletName] = useState(localStorage.getItem('activeOutletName') || 'Waschen Laundry Raffles Hills');
  const [activeOutletId, setActiveOutletId] = useState(localStorage.getItem('activeOutletId') || '');
  const [outlets, setOutlets] = useState([]);
  const [activeTab, setActiveTab] = useState('dashboard');
  const [cashLogs, setCashLogs] = useState([]);
  const [initialPettyCashFloat, setInitialPettyCashFloat] = useState(0);

  const showToast = (title, message, type = 'success') => {
    showAlert({ title, message, type });
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
      const outletId = localStorage.getItem('activeOutletId') || activeOutletId;
      const res = await axios.get('/api/petty-cash', {
        params: outletId ? { outlet_id: outletId } : undefined
      });
      if (res.data && res.data.success) {
        const floatVal = res.data.initialPettyCash ?? res.data.initialFloat;
        if (typeof floatVal === 'number') {
          setInitialPettyCashFloat(floatVal);
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
            initialPettyCashFloat={initialPettyCashFloat}
            activeOutletName={activeOutletName}
          />
        )}

        {activeTab === 'add' && (
          <AddPettyCash
            activeOutletId={activeOutletId}
            userProfile={userProfile}
            showToast={showToast}
            onCashLogCreated={(newLog) => {
              handleCashLogCreated(newLog);
              fetchPettyCash();
            }}
            onSwitchToDashboard={() => {
              setActiveTab('dashboard');
              fetchPettyCash();
            }}
          />
        )}
      </main>
    </div>
  );
}
