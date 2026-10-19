import React, { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import axios from 'axios';
import HeaderNav from '../../components/HeaderNav';
import ListCustomer from './components/ListCustomer';
import AddCustomer from './components/AddCustomer';
import CustomerChurn from './components/CustomerChurn';
import {
  Users,
  Plus,
  TrendingDown
} from 'lucide-react';

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
  const [listRefresh, setListRefresh] = useState(0);
  const [customerToOpen, setCustomerToOpen] = useState(null);

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
  }, [navigate]);

  const scrollToTop = () => {
    window.scrollTo({ top: 0, left: 0, behavior: 'instant' });
    if (document.documentElement) document.documentElement.scrollTop = 0;
    if (document.body) document.body.scrollTop = 0;
  };

  const handleCustomerCreated = () => {
    scrollToTop();
    setEditingCustomer(null);
    setListRefresh((n) => n + 1);
    setActiveTab('catalog');
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

  // Dari modal nomor ganda: buka detail pelanggan yang sudah terdaftar
  const handleOpenCustomer = (existing) => {
    scrollToTop();
    setEditingCustomer(null);
    setCustomerToOpen(existing);
    setActiveTab('catalog');
  };

  // Dari modal nomor ganda: edit pelanggan yang sudah terdaftar
  const handleEditExisting = async (existing, { continueToTransaction = false } = {}) => {
    scrollToTop();
    let cust = { dbId: existing.id, id: existing.customer_code || existing.id, ...existing };
    try {
      const res = await axios.get(`/api/customers/${existing.id}`);
      if (res.data?.success) cust = res.data.data;
    } catch (err) {
      console.error('Gagal memuat pelanggan:', err);
    }
    setEditingCustomer({ ...cust, _continueToTransaction: continueToTransaction });
    setActiveTab('add');
  };

  const handleCustomerUpdated = () => {
    scrollToTop();
    setEditingCustomer(null);
    setListRefresh((n) => n + 1);
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

      <main className="max-w-[1500px] w-full min-w-0 mx-auto p-3 sm:p-6 flex-grow flex flex-col gap-4 sm:gap-6">
        <div className="flex flex-col xl:flex-row xl:justify-between xl:items-center gap-3 sm:gap-4 bg-white border border-[#e0e0e0] rounded-2xl sm:rounded-3xl p-4 sm:p-5 shadow-xs min-w-0">
          <div className="min-w-0">
            <h1 className="text-lg sm:text-2xl font-black text-[#313030] tracking-tight">Data Customer Waschen</h1>
            <p className="text-[11px] sm:text-xs text-slate-400 mt-0.5">Kelola database member, tiering loyalty, dan pendaftaran new customer</p>
          </div>

          <div className="flex items-center gap-1.5 sm:gap-2 bg-[#f8f8f8] border border-[#e0e0e0] p-1 sm:p-1.5 rounded-2xl w-full xl:w-auto min-w-0">
            <button
              type="button"
              onClick={() => {
                scrollToTop();
                setActiveTab('catalog');
              }}
              className={`flex-1 xl:flex-none min-w-0 flex items-center justify-center gap-1.5 px-2.5 sm:px-5 py-2 sm:py-2.5 rounded-xl text-xs font-black transition-all cursor-pointer ${
                activeTab === 'catalog'
                  ? 'bg-[#5f1340] text-white shadow-xs'
                  : 'text-slate-500 hover:text-[#313030]'
              }`}
            >
              <Users className="h-3.5 w-3.5 sm:h-4 sm:w-4 shrink-0" />
              <span className="truncate text-[11px] sm:text-xs">Data Customer</span>
            </button>
            <button
              type="button"
              onClick={() => {
                scrollToTop();
                setEditingCustomer(null);
                setActiveTab('add');
              }}
              className={`flex-1 xl:flex-none min-w-0 flex items-center justify-center gap-1.5 px-2.5 sm:px-5 py-2 sm:py-2.5 rounded-xl text-xs font-black transition-all cursor-pointer ${
                activeTab === 'add'
                  ? 'bg-[#5f1340] text-white shadow-xs'
                  : 'text-slate-500 hover:text-[#313030]'
              }`}
            >
              <Plus className="h-3.5 w-3.5 sm:h-4 sm:w-4 shrink-0" />
              <span className="truncate text-[11px] sm:text-xs">Tambah Customer</span>
            </button>
            <button
              type="button"
              onClick={() => {
                scrollToTop();
                setActiveTab('churn');
              }}
              className={`flex-1 xl:flex-none min-w-0 flex items-center justify-center gap-1.5 px-2.5 sm:px-5 py-2 sm:py-2.5 rounded-xl text-xs font-black transition-all cursor-pointer ${
                activeTab === 'churn'
                  ? 'bg-[#5f1340] text-white shadow-xs'
                  : 'text-slate-500 hover:text-[#313030]'
              }`}
            >
              <TrendingDown className="h-3.5 w-3.5 sm:h-4 sm:w-4 shrink-0" />
              <span className="truncate text-[11px] sm:text-xs">Analisis Churn</span>
            </button>
          </div>
        </div>

        {activeTab === 'catalog' && (
          <ListCustomer
            customerTiers={customerTiers}
            outlets={outlets}
            activeOutletName={activeOutletName}
            activeOutletId={activeOutletId}
            refreshKey={listRefresh}
            onEditCustomer={handleEditCustomer}
            customerToOpen={customerToOpen}
            onCustomerOpened={() => setCustomerToOpen(null)}
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
            onOpenCustomer={handleOpenCustomer}
            onEditExisting={handleEditExisting}
          />
        )}

        {activeTab === 'churn' && (
          <CustomerChurn
            outlets={outlets}
            activeOutletName={activeOutletName}
            activeOutletId={activeOutletId}
            onEditCustomer={handleEditCustomer}
          />
        )}
      </main>
    </div>
  );
}
