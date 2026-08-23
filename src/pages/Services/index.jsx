import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import HeaderNav from '../../components/HeaderNav';
import ListServices from './components/ListServices';
import DashboardServices from './components/DashboardServices';
import {
  Layers,
  BarChart3
} from 'lucide-react';

export const mapServiceFromApi = (s) => ({
  id: s.code || `s-${s.id}`,
  dbId: s.id,
  categoryId: s.category_id,
  categoryCode: s.category_code || '',
  categoryName: s.category_name || 'Lainnya',
  name: s.name,
  price: parseFloat(s.price) || 0,
  unit: s.unit || 'Kg',
  estTime: s.regular_duration_days ? `${s.regular_duration_days} Hari` : '2 Hari',
  desc: s.description || 'Layanan laundry profesional higienis dengan pewangi segar.',
  minOrderQty: parseFloat(s.min_order_qty) || 1,
  isFeatured: s.is_featured === 1
});

export default function Services() {
  const navigate = useNavigate();
  const [userProfile, setUserProfile] = useState(null);
  const [activeOutletName, setActiveOutletName] = useState(localStorage.getItem('activeOutletName') || 'Waschen Laundry Raffles Hills');
  const [activeOutletId, setActiveOutletId] = useState(localStorage.getItem('activeOutletId') || '');
  const [outlets, setOutlets] = useState([]);
  const [activeTab, setActiveTab] = useState('list');
  const [servicesList, setServicesList] = useState([]);
  const [categories, setCategories] = useState([]);

  useEffect(() => {
    document.title = 'Katalog & Layanan | Waschen Laundry';
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
      .catch(err => console.error('Gagal mengambil data outlet:', err));

    fetchServices();
  }, [navigate]);

  const fetchServices = async () => {
    try {
      const res = await axios.get('/api/services');
      if (res.data && res.data.success) {
        const activeCategories = (res.data.categories || []).filter(
          c => c.is_active === 1 || c.is_active === true
        );
        setCategories(activeCategories);

        if (res.data.data && res.data.data.length > 0) {
          setServicesList(res.data.data.map(mapServiceFromApi));
        } else {
          setServicesList([]);
        }
      }
    } catch (err) {
      console.error('Gagal mengambil katalog layanan:', err);
    }
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

      <main className="max-w-[1400px] w-full mx-auto p-4 sm:p-6 flex-grow flex flex-col gap-6">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-white border border-[#e0e0e0] rounded-3xl p-5 shadow-xs">
          <div>
            <h1 className="text-xl sm:text-2xl font-black text-[#313030] tracking-tight">Katalog Layanan & Daftar Tarif Resmi</h1>
            <p className="text-xs text-slate-400 mt-0.5">Daftar harga resmi Waschen Laundry — hanya tampilan baca (read-only)</p>
          </div>

          <div className="flex items-center gap-1.5 bg-[#f8f8f8] border border-[#e0e0e0] p-1 rounded-2xl w-full sm:w-auto">
            <button
              type="button"
              onClick={() => setActiveTab('list')}
              className={`flex-1 sm:flex-none flex items-center justify-center gap-2 px-4 py-2 rounded-xl text-xs font-black transition-all cursor-pointer ${
                activeTab === 'list'
                  ? 'bg-[#5f1340] text-white shadow-xs'
                  : 'text-slate-500 hover:text-[#313030]'
              }`}
            >
              <Layers className="h-4 w-4" />
              <span>Daftar Tarif Layanan</span>
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('dashboard')}
              className={`flex-1 sm:flex-none flex items-center justify-center gap-2 px-4 py-2 rounded-xl text-xs font-black transition-all cursor-pointer ${
                activeTab === 'dashboard'
                  ? 'bg-[#5f1340] text-white shadow-xs'
                  : 'text-slate-500 hover:text-[#313030]'
              }`}
            >
              <BarChart3 className="h-4 w-4" />
              <span>Ringkasan Layanan</span>
            </button>
          </div>
        </div>

        {activeTab === 'list' && (
          <ListServices
            servicesList={servicesList}
            categories={categories}
          />
        )}

        {activeTab === 'dashboard' && (
          <DashboardServices servicesList={servicesList} />
        )}
      </main>
    </div>
  );
}
