import React, { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import axios from 'axios';
import HeaderNav from '../../components/HeaderNav';
import ListCustomer from './components/ListCustomer';
import AddCustomer from './components/AddCustomer';
import {
  Users,
  Plus,
  CheckCircle2
} from 'lucide-react';

const mapCustomerFromApi = (c, activeOutletName) => ({
  id: c.customer_code || `CUST-${String(c.id).padStart(3, '0')}`,
  dbId: c.id,
  name: c.name,
  phone: c.phone,
  email: c.email || '-',
  address: c.address || '-',
  city: c.city || 'Jakarta Selatan',
  landmark: c.landmark || '-',
  homeBranch: c.home_branch || activeOutletName,
  tier: c.tier || 'Reguler',
  totalSpending: parseFloat(c.total_spent) || 0,
  monthlySpending: parseFloat(c.monthly_spending) || 0,
  trxCount: parseInt(c.total_orders) || 0,
  depositBalance: parseFloat(c.deposit_balance) || 0,
  points: parseInt(c.points) || 0,
  lastTrx: c.updated_at ? new Date(c.updated_at).toLocaleDateString('id-ID', { day: '2-digit', month: 'short' }) : 'Hari ini',
  source: c.source || 'Langsung ke Toko',
  perfumePreference: c.perfume_preference || 'Standar',
  workPreference: c.work_preference || 'Standard Reguler',
  notes: c.notes || 'Pelanggan terdaftar Waschen.',
  complaints: [],
  history: []
});

export default function Customer() {
  const navigate = useNavigate();
  const location = useLocation();
  const [userProfile, setUserProfile] = useState(null);
  const [activeOutletName, setActiveOutletName] = useState(localStorage.getItem('activeOutletName') || 'Waschen Laundry Raffles Hills');
  const [activeOutletId, setActiveOutletId] = useState(localStorage.getItem('activeOutletId') || '');
  const [outlets, setOutlets] = useState([]);
  const [activeTab, setActiveTab] = useState('catalog');
  const [customers, setCustomers] = useState([]);
  const [toast, setToast] = useState(null);

  const showToast = (title, message, type = 'success') => {
    setToast({ title, message, type });
    setTimeout(() => setToast(null), 4000);
  };

  useEffect(() => {
    const params = new URLSearchParams(location.search);
    if (params.get('tab') === 'add' || location.state?.tab === 'add') {
      setActiveTab('add');
    }
  }, [location]);

  useEffect(() => {
    document.title = 'Data Pelanggan & Registrasi | Waschen Laundry';
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

    axios.get('/api/outlets')
      .then(res => {
        if (res.data && res.data.success && res.data.data.length > 0) {
          setOutlets(res.data.data);
        }
      })
      .catch(err => console.error('Gagal mengambil data outlet dari mst_outlet:', err));

    fetchCustomers();
  }, [navigate]);

  const fetchCustomers = async () => {
    try {
      const res = await axios.get('/api/customers');
      if (res.data && res.data.success && res.data.data.length > 0) {
        setCustomers(res.data.data.map(c => mapCustomerFromApi(c, activeOutletName)));
      }
    } catch (err) {
      console.error('Gagal memuat data pelanggan:', err);
    }
  };

  const handleCustomerCreated = (newCustomer) => {
    setCustomers(prev => [newCustomer, ...prev]);
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
            <CheckCircle2 className="h-5 w-5 text-emerald-600" />
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
            <h1 className="text-xl sm:text-2xl font-black text-[#313030] tracking-tight">Katalog CRM & Pendataan Pelanggan</h1>
            <p className="text-xs text-slate-400 mt-0.5">Kelola database member, tiering loyalty, dan pendaftaran pelanggan baru</p>
          </div>

          <div className="flex items-center gap-2 bg-[#f8f8f8] border border-[#e0e0e0] p-1.5 rounded-2xl w-full sm:w-auto">
            <button
              type="button"
              onClick={() => setActiveTab('catalog')}
              className={`flex-1 sm:flex-none flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl text-xs font-black transition-all cursor-pointer ${
                activeTab === 'catalog'
                  ? 'bg-[#5f1340] text-white shadow-xs'
                  : 'text-slate-500 hover:text-[#313030]'
              }`}
            >
              <Users className="h-4 w-4" />
              <span>Katalog CRM Pelanggan</span>
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('add')}
              className={`flex-1 sm:flex-none flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl text-xs font-black transition-all cursor-pointer ${
                activeTab === 'add'
                  ? 'bg-[#5f1340] text-white shadow-xs'
                  : 'text-slate-500 hover:text-[#313030]'
              }`}
            >
              <Plus className="h-4 w-4" />
              <span>Tambah Pelanggan Baru</span>
            </button>
          </div>
        </div>

        {activeTab === 'catalog' && (
          <ListCustomer customers={customers} />
        )}

        {activeTab === 'add' && (
          <AddCustomer
            outlets={outlets}
            activeOutletName={activeOutletName}
            activeOutletId={activeOutletId}
            showToast={showToast}
            onCustomerCreated={handleCustomerCreated}
            onSwitchToCatalog={() => setActiveTab('catalog')}
          />
        )}
      </main>
    </div>
  );
}
