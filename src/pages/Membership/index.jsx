import React, { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import axios from 'axios';
import HeaderNav from '../../components/HeaderNav';
import ListMember from './components/ListMember';
import AddMember from './components/AddMember';
import {
  CreditCard,
  Users,
  Plus,
  CheckCircle2,
  AlertCircle
} from 'lucide-react';

export const mapMemberFromApi = (c) => {
  const expiry = c.membership_end_date
    ? new Date(c.membership_end_date)
    : (() => {
        const d = new Date(c.created_at || Date.now());
        d.setDate(d.getDate() + 180);
        return d;
      })();

  return {
    id: c.customer_code || `MBR-${String(c.id).padStart(3, '0')}`,
    cardNumber: c.customer_code || `MBR-${String(c.id).padStart(3, '0')}`,
    dbId: c.id,
    name: c.name,
    phone: c.phone,
    homeBranch: c.home_branch || 'Waschen Laundry Citra Gran',
    spendingTier: c.tier || 'Reguler',
    tier: c.membership_tier || 'Gold',
    membershipTier: c.membership_tier || null,
    balance: parseFloat(c.deposit_balance) || 0,
    totalTopUp: parseFloat(c.membership_top_up_amount) || parseFloat(c.deposit_balance) || 0,
    totalUsage: Math.max(0, (parseFloat(c.membership_top_up_amount) || parseFloat(c.deposit_balance) || 0) - (parseFloat(c.deposit_balance) || 0)),
    registeredAt: c.membership_start_date
      ? new Date(c.membership_start_date).toLocaleDateString('id-ID', { day: '2-digit', month: 'short', year: 'numeric' })
      : new Date(c.created_at || Date.now()).toLocaleDateString('id-ID', { day: '2-digit', month: 'short', year: 'numeric' }),
    expiryDate: expiry.toLocaleDateString('id-ID', { day: '2-digit', month: 'short', year: 'numeric' }),
    status: c.membership_status === 'Active' ? 'Aktif' : (c.membership_status || 'Aktif'),
    mutations: []
  };
};

export default function Membership() {
  const navigate = useNavigate();
  const location = useLocation();
  const [userProfile, setUserProfile] = useState(null);
  const [activeOutletName, setActiveOutletName] = useState(localStorage.getItem('activeOutletName') || 'Waschen Laundry Raffles Hills');
  const [activeOutletId, setActiveOutletId] = useState(localStorage.getItem('activeOutletId') || '');
  const [outlets, setOutlets] = useState([]);
  const [activeTab, setActiveTab] = useState('catalog');
  const [members, setMembers] = useState([]);
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
    document.title = 'Data Membership & Kartu Saldo | Waschen Laundry';
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

    fetchMembers();
  }, [navigate]);

  const fetchMembers = async () => {
    try {
      const res = await axios.get('/api/customers', { params: { has_membership: '1' } });
      if (res.data && res.data.success) {
        setMembers((res.data.data || []).map(mapMemberFromApi));
      }
    } catch (err) {
      console.error('Gagal mengambil data member:', err);
    }
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
              <CreditCard className="h-6 w-6 text-[#5f1340]" />
              <span>Kelola Membership & Saldo Kartu</span>
            </h1>
            <p className="text-xs text-slate-400 mt-0.5">Paket member Diamond/Gold terpisah dari tier spending organik pelanggan</p>
          </div>

          <div className="flex items-center gap-2 bg-[#f8f8f8] border border-[#e0e0e0] p-1.5 rounded-2xl w-full sm:w-auto">
            <button
              type="button"
              onClick={() => {
                scrollToTop();
                setActiveTab('catalog');
              }}
              className={`flex-1 sm:flex-none flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl text-xs font-black transition-all cursor-pointer ${
                activeTab === 'catalog'
                  ? 'bg-[#5f1340] text-white shadow-xs'
                  : 'text-slate-500 hover:text-[#313030]'
              }`}
            >
              <Users className="h-4 w-4" />
              <span>Daftar Member</span>
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
              <span>Aktivasi Member Baru</span>
            </button>
          </div>
        </div>

        {activeTab === 'catalog' && (
          <ListMember
            members={members}
            setMembers={setMembers}
            outlets={outlets}
            activeOutletName={activeOutletName}
            showToast={showToast}
          />
        )}

        {activeTab === 'add' && (
          <AddMember
            outlets={outlets}
            activeOutletName={activeOutletName}
            showToast={showToast}
            onMemberRegistered={fetchMembers}
            onSwitchToCatalog={() => setActiveTab('catalog')}
          />
        )}
      </main>
    </div>
  );
}
