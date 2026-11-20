import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import HeaderNav from '../../components/HeaderNav';
import ListServices from './components/ListServices';

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

const PAGE_SIZE = 24;

export default function Services() {
  const navigate = useNavigate();
  const [userProfile, setUserProfile] = useState(null);
  const [activeOutletName, setActiveOutletName] = useState(localStorage.getItem('activeOutletName') || 'Waschen Laundry Raffles Hills');
  const [activeOutletId, setActiveOutletId] = useState(localStorage.getItem('activeOutletId') || '');
  const [outlets, setOutlets] = useState([]);

  // Katalog berhalaman: data satu halaman dari server
  const [servicesList, setServicesList] = useState([]);
  const [categories, setCategories] = useState([]);
  const [meta, setMeta] = useState({ page: 1, totalPages: 1, total: 0, counts: {}, countAll: 0 });
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [searchQuery, setSearchQuery] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [categoryCode, setCategoryCode] = useState('Semua');
  const fetchSeq = useRef(0);

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

    axios.get('/api/masters/outlets')
      .then(res => {
        if (res.data && res.data.success && res.data.data.length > 0) {
          setOutlets(res.data.data);
        }
      })
      .catch(err => console.error('Gagal mengambil data outlet:', err));
  }, [navigate]);

  // Ketik → tunggu 350 ms sebelum cari ke server
  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(searchQuery.trim()), 350);
    return () => clearTimeout(t);
  }, [searchQuery]);

  // Filter / outlet berubah → kembali ke halaman 1
  useEffect(() => {
    setPage(1);
  }, [debouncedSearch, categoryCode, activeOutletId]);

  // Katalog mengikuti outlet aktif di header (layanan per outlet dari mst_service_outlet, termasuk Drop Point)
  useEffect(() => {
    const seq = ++fetchSeq.current;
    setLoading(true);
    axios.get('/api/services', {
      params: {
        outlet_id: activeOutletId || undefined,
        page,
        limit: PAGE_SIZE,
        category: categoryCode !== 'Semua' ? categoryCode : undefined,
        search: debouncedSearch || undefined
      }
    })
      .then((res) => {
        if (seq !== fetchSeq.current || !res.data?.success) return;
        setCategories((res.data.categories || []).filter((c) => c.is_active === 1 || c.is_active === true));
        setServicesList((res.data.data || []).map(mapServiceFromApi));
        setMeta(res.data.meta || { page: 1, totalPages: 1, total: 0, counts: {}, countAll: 0 });
      })
      .catch((err) => console.error('Gagal mengambil katalog layanan:', err))
      .finally(() => { if (seq === fetchSeq.current) setLoading(false); });
  }, [activeOutletId, page, categoryCode, debouncedSearch]);

  const goToPage = (p) => {
    setPage(p);
    window.scrollTo({ top: 0, behavior: 'smooth' });
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
        <div className="bg-white border border-[#e0e0e0] rounded-3xl p-4 sm:p-5">
          <h1 className="text-lg sm:text-2xl font-black text-[#313030] tracking-tight">Daftar Layanan Waschen Laundry 2026</h1>
        </div>

        <ListServices
          servicesList={servicesList}
          categories={categories}
          meta={meta}
          loading={loading}
          searchQuery={searchQuery}
          onSearchChange={setSearchQuery}
          categoryCode={categoryCode}
          onCategoryChange={setCategoryCode}
          page={page}
          pageSize={PAGE_SIZE}
          onPageChange={goToPage}
        />
      </main>
    </div>
  );
}
