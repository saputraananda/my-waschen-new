import React, { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import axios from 'axios';
import HeaderNav from '../../components/HeaderNav';
import ListCustomer from './components/ListCustomer';
import AddCustomer from './components/AddCustomer';
import {
  Users,
  Plus
} from 'lucide-react';

const mapCustomerFromApi = (c, activeOutletName) => {
  const trxCount = parseInt(c.trx_count_live ?? c.total_orders, 10) || 0;
  const totalSpending = parseFloat(c.total_spent_live ?? c.total_spent) || 0;
  const formatDateId = (d) =>
    d ? new Date(d).toLocaleDateString('id-ID', { day: '2-digit', month: 'short', year: 'numeric' }) : '-';
  const lastDate = c.last_order_date || null;
  return {
    id: c.customer_code || `CUST-${String(c.id).padStart(3, '0')}`,
    dbId: c.id,
    name: c.name,
    phone: c.phone,
    gender: c.gender || '',
    greeting: c.greeting || '',
    email: c.email || '-',
    birthDate: c.birth_date || '',
    occupation: c.occupation || '',
    address: c.address || '-',
    block: c.block || '',
    houseNumber: c.house_number || '',
    fullAddress: c.full_address || c.address || '-',
    district: c.district || '',
    subDistrict: c.sub_district || '',
    city: c.city || '',
    landmark: c.landmark || '-',
    homeBranch: c.home_branch || activeOutletName,
    preferredOutletId: c.preferred_outlet_id || null,
    tier: c.tier || 'One-Time',
    tierId: c.spending_tier_id,
    membershipTier: c.membership_tier || null,
    membershipPackage: c.membership_package_name || null,
    totalSpending,
    monthlySpending: parseFloat(c.monthly_spending) || 0,
    trxCount,
    depositBalance: parseFloat(c.deposit_balance) || 0,
    registeredAt: formatDateId(c.created_at),
    lastTrx: trxCount > 0 && lastDate ? formatDateId(lastDate) : '-',
    source: c.source || c.source_name || '-',
    sourceId: c.customer_source_id,
    notes: c.notes || 'Pelanggan terdaftar Waschen.',
    generalNotes: c.general_notes || '',
    complaints: [],
    history: Array.isArray(c.history) ? c.history : []
  };
};

export default function Customer() {
  const navigate = useNavigate();
  const location = useLocation();
  const [userProfile, setUserProfile] = useState(null);
  const [activeOutletName, setActiveOutletName] = useState(localStorage.getItem('activeOutletName') || 'Waschen Laundry Raffles Hills');
  const [activeOutletId, setActiveOutletId] = useState(localStorage.getItem('activeOutletId') || '');
  const [outlets, setOutlets] = useState([]);
  const [customerTiers, setCustomerTiers] = useState([]);
  const [activeTab, setActiveTab] = useState('catalog');
  const [editingCustomer, setEditingCustomer] = useState(null);
  const [customers, setCustomers] = useState([]);

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

    axios.get('/api/masters/outlets')
      .then(res => {
        if (res.data && res.data.success && res.data.data.length > 0) {
          setOutlets(res.data.data);
        }
      })
      .catch(err => console.error('Gagal mengambil data outlet dari mst_outlet:', err));

    axios.get('/api/masters/customer-tiers')
      .then(res => {
        if (res.data?.success) setCustomerTiers(res.data.data || []);
      })
      .catch(err => console.error('Gagal mengambil tier pelanggan:', err));

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

  const scrollToTop = () => {
    window.scrollTo({ top: 0, left: 0, behavior: 'instant' });
    if (document.documentElement) document.documentElement.scrollTop = 0;
    if (document.body) document.body.scrollTop = 0;
  };

  const handleCustomerCreated = (newCustomer) => {
    scrollToTop();
    setCustomers(prev => [newCustomer, ...prev]);
    setEditingCustomer(null);
  };

  const handleEditCustomer = async (cust) => {
    scrollToTop();
    try {
      const res = await axios.get(`/api/customers/${cust.dbId || cust.id}`);
      setEditingCustomer(res.data?.success ? res.data.data : cust);
    } catch {
      setEditingCustomer(cust);
    }
    setActiveTab('add');
    scrollToTop();
  };

  const handleCustomerUpdated = () => {
    scrollToTop();
    setEditingCustomer(null);
    fetchCustomers();
    setActiveTab('catalog');
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

      <main className="max-w-[1500px] w-full mx-auto p-3 sm:p-6 flex-grow flex flex-col gap-4 sm:gap-6">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 sm:gap-4 bg-white border border-[#e0e0e0] rounded-2xl sm:rounded-3xl p-4 sm:p-5 shadow-xs">
          <div>
            <h1 className="text-lg sm:text-2xl font-black text-[#313030] tracking-tight">Data Customer Waschen</h1>
            <p className="text-[11px] sm:text-xs text-slate-400 mt-0.5">Kelola database member, tiering loyalty, dan pendaftaran new customer</p>
          </div>

          <div className="flex items-center gap-1.5 sm:gap-2 bg-[#f8f8f8] border border-[#e0e0e0] p-1 sm:p-1.5 rounded-2xl w-full sm:w-auto">
            <button
              type="button"
              onClick={() => {
                scrollToTop();
                setActiveTab('catalog');
              }}
              className={`flex-1 sm:flex-none flex items-center justify-center gap-1.5 px-3 sm:px-5 py-2 sm:py-2.5 rounded-xl text-xs font-black transition-all cursor-pointer ${
                activeTab === 'catalog'
                  ? 'bg-[#5f1340] text-white shadow-xs'
                  : 'text-slate-500 hover:text-[#313030]'
              }`}
            >
              <Users className="h-3.5 w-3.5 sm:h-4 sm:w-4 shrink-0" />
              <span className="whitespace-nowrap text-[11px] sm:text-xs">Data Customer</span>
            </button>
            <button
              type="button"
              onClick={() => {
                scrollToTop();
                setEditingCustomer(null);
                setActiveTab('add');
              }}
              className={`flex-1 sm:flex-none flex items-center justify-center gap-1.5 px-3 sm:px-5 py-2 sm:py-2.5 rounded-xl text-xs font-black transition-all cursor-pointer ${
                activeTab === 'add'
                  ? 'bg-[#5f1340] text-white shadow-xs'
                  : 'text-slate-500 hover:text-[#313030]'
              }`}
            >
              <Plus className="h-3.5 w-3.5 sm:h-4 sm:w-4 shrink-0" />
              <span className="whitespace-nowrap text-[11px] sm:text-xs">Tambah Customer</span>
            </button>
          </div>
        </div>

        {activeTab === 'catalog' && (
          <ListCustomer
            customers={customers}
            customerTiers={customerTiers}
            outlets={outlets}
            activeOutletName={activeOutletName}
            activeOutletId={activeOutletId}
            onEditCustomer={handleEditCustomer}
          />
        )}

        {activeTab === 'add' && (
          <AddCustomer
            outlets={outlets}
            activeOutletName={activeOutletName}
            activeOutletId={activeOutletId}
            onCustomerCreated={handleCustomerCreated}
            onSwitchToCatalog={() => { setEditingCustomer(null); setActiveTab('catalog'); }}
            customerToEdit={editingCustomer}
            onCustomerUpdated={handleCustomerUpdated}
          />
        )}
      </main>
    </div>
  );
}
