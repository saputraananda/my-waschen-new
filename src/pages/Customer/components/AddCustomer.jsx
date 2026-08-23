import React, { useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import axios from 'axios';
import { formatName } from '../../../utils/FormatName';
import {
  ArrowLeft,
  MapPin,
  Phone,
  Sparkles,
  Save,
  RotateCcw,
  UserCheck
} from 'lucide-react';

const renderTierBadge = (tier) => {
  switch (tier) {
    case 'VIP':
      return <span className="bg-gradient-to-r from-amber-400 to-amber-500 text-slate-950 font-black text-[10px] px-3 py-1 rounded-full border border-amber-300 shadow-xs uppercase tracking-wider inline-block whitespace-nowrap">VIP</span>;
    case 'Gold':
      return <span className="bg-amber-50 text-amber-900 border border-amber-200 font-extrabold text-[10px] px-3 py-1 rounded-full inline-block whitespace-nowrap">Gold</span>;
    case 'Reguler':
      return <span className="bg-slate-100 text-slate-700 border border-slate-200 font-bold text-[10px] px-3 py-1 rounded-full inline-block whitespace-nowrap">Reguler</span>;
    default:
      return <span className="bg-sky-50 text-sky-800 border border-sky-200 font-bold text-[10px] px-3 py-1 rounded-full inline-block whitespace-nowrap">One-Time</span>;
  }
};

const getDefaultForm = (activeOutletName) => ({
  name: '',
  phone: '',
  email: '',
  address: '',
  city: 'Jakarta Selatan',
  postalCode: '',
  landmark: '',
  homeBranch: activeOutletName,
  source: 'Instagram / Media Sosial',
  perfumePreference: 'Sakura Premium',
  workPreference: 'Standard Reguler',
  specialNotes: '',
  tier: 'One-Time',
  sendWaNotification: true
});

export default function AddCustomer({
  outlets,
  activeOutletName,
  activeOutletId,
  showToast,
  onCustomerCreated,
  onSwitchToCatalog
}) {
  const navigate = useNavigate();
  const location = useLocation();
  const [newCustForm, setNewCustForm] = useState(() => getDefaultForm(activeOutletName));

  const handleRegisterNewCustomer = async (e) => {
    e.preventDefault();
    if (!newCustForm.name || !newCustForm.phone || !newCustForm.address) {
      showToast('Form Belum Lengkap', 'Nama Pelanggan, Nomor HP/WhatsApp, dan Alamat Domisili wajib diisi', 'error');
      return;
    }

    const formattedName = formatName(newCustForm.name);

    try {
      const res = await axios.post('/api/customers', {
        name: formattedName,
        phone: newCustForm.phone,
        email: newCustForm.email,
        address: newCustForm.address,
        city: newCustForm.city,
        postalCode: newCustForm.postalCode,
        landmark: newCustForm.landmark,
        homeBranch: newCustForm.homeBranch || activeOutletName,
        preferredOutletId: parseInt(activeOutletId) || 2,
        tier: newCustForm.tier || 'One-Time',
        source: newCustForm.source,
        perfumePreference: newCustForm.perfumePreference,
        workPreference: newCustForm.workPreference,
        notes: newCustForm.specialNotes
      });

      if (res.data && res.data.success) {
        const created = res.data.data;
        const newCustFormatted = {
          id: created.customer_code || `CUST-${String(created.id).padStart(3, '0')}`,
          dbId: created.id,
          name: created.name,
          phone: created.phone,
          email: created.email || '-',
          address: created.address,
          city: created.city,
          landmark: created.landmark || '-',
          homeBranch: created.home_branch || activeOutletName,
          tier: created.tier || 'One-Time',
          totalSpending: 0,
          monthlySpending: 0,
          trxCount: 0,
          depositBalance: 0,
          points: 0,
          lastTrx: 'Baru Terdaftar',
          source: created.source,
          perfumePreference: created.perfume_preference,
          workPreference: created.work_preference,
          notes: created.notes || 'Pelanggan baru terdaftar.',
          complaints: [],
          history: []
        };

        onCustomerCreated(newCustFormatted);
        localStorage.setItem('autoSelectCustId', newCustFormatted.id);
        showToast('Registrasi Berhasil!', `Pelanggan ${formattedName} berhasil disimpan ke database.`, 'success');
        setNewCustForm(getDefaultForm(activeOutletName));

        setTimeout(() => {
          if (location.state?.from === '/transaction' || new URLSearchParams(location.search).get('tab') === 'add') {
            navigate('/transaction', { replace: true });
          } else {
            onSwitchToCatalog();
          }
        }, 1000);
      }
    } catch (err) {
      console.error('Gagal mendaftarkan pelanggan:', err);
      showToast('Gagal Simpan', err.response?.data?.message || 'Terjadi kesalahan saat menyimpan ke database', 'error');
    }
  };

  return (
    <form onSubmit={handleRegisterNewCustomer} className="flex flex-col gap-6 bg-white border border-[#e0e0e0] rounded-3xl p-6 shadow-xs">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between border-b border-[#e0e0e0] pb-4 gap-3">
        <div className="flex items-center gap-3">
          <div className="p-3 bg-[#5f1340]/10 text-[#5f1340] rounded-2xl">
            <UserCheck className="h-6 w-6" />
          </div>
          <div>
            <h2 className="text-lg font-black text-[#313030]">Formulir Pendaftaran Pelanggan Baru</h2>
            <p className="text-xs text-slate-400">Lengkapi data profil pelanggan untuk mendaftarkan member Waschen Laundry</p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => navigate(-1)}
            className="flex items-center gap-2 px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-extrabold rounded-xl text-xs transition-colors cursor-pointer self-start sm:self-auto"
            title="Kembali ke halaman sebelumnya"
          >
            <ArrowLeft className="h-4 w-4" />
            <span>Kembali</span>
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* BAGIAN 1: INFORMASI KONTAK & IDENTITAS */}
        <div className="p-5 border border-[#e0e0e0] rounded-2xl bg-[#f8f8f8]/50 flex flex-col gap-4">
          <div className="flex items-center gap-2 border-b border-[#e0e0e0] pb-2 text-[#5f1340] font-black text-xs uppercase tracking-wider">
            <Phone className="h-4 w-4" />
            <span>1. Identitas & Kontak Utama</span>
          </div>

          <div className="flex flex-col gap-1">
            <label className="text-[11px] font-black text-slate-700">Nama Lengkap Pelanggan *</label>
            <input
              type="text"
              placeholder="Contoh: An'nisa Puspa Khairani Rangkuti"
              value={newCustForm.name}
              onChange={(e) => setNewCustForm({ ...newCustForm, name: e.target.value })}
              className="p-3 border border-[#e0e0e0] rounded-xl bg-white text-xs font-bold outline-none focus:border-[#5f1340]"
              required
            />
            <span className="text-[9px] text-slate-400">Format nama akan otomatis dikonversi ke Title Case (Kapital Setiap Kata).</span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="flex flex-col gap-1">
              <label className="text-[11px] font-black text-slate-700">Nomor WhatsApp / HP *</label>
              <input
                type="tel"
                placeholder="Contoh: 08123456789"
                value={newCustForm.phone}
                onChange={(e) => setNewCustForm({ ...newCustForm, phone: e.target.value })}
                className="p-3 border border-[#e0e0e0] rounded-xl bg-white text-xs font-bold outline-none focus:border-[#5f1340]"
                required
              />
            </div>

            <div className="flex flex-col gap-1">
              <label className="text-[11px] font-black text-slate-700">Alamat Email (Opsional)</label>
              <input
                type="email"
                placeholder="annisa@example.com"
                value={newCustForm.email}
                onChange={(e) => setNewCustForm({ ...newCustForm, email: e.target.value })}
                className="p-3 border border-[#e0e0e0] rounded-xl bg-white text-xs font-bold outline-none focus:border-[#5f1340]"
              />
            </div>
          </div>

          <div className="flex flex-col gap-1">
            <label className="text-[11px] font-black text-slate-700">Cabang Tempat Mendaftar (Home Branch)</label>
            <select
              value={newCustForm.homeBranch}
              onChange={(e) => setNewCustForm({ ...newCustForm, homeBranch: e.target.value })}
              className="p-3 border border-[#e0e0e0] rounded-xl bg-white text-xs font-bold outline-none focus:border-[#5f1340] cursor-pointer"
            >
              {outlets.length > 0 ? (
                outlets.map(o => (
                  <option key={o.id} value={o.full_name || o.name}>
                    {o.full_name || o.name}
                  </option>
                ))
              ) : (
                <>
                  <option value="Waschen Laundry Raffles Hills">Waschen Laundry Raffles Hills</option>
                  <option value="Waschen Laundry Citra Gran">Waschen Laundry Citra Gran</option>
                  <option value="Waschen Laundry Legenda">Waschen Laundry Legenda</option>
                  <option value="Waschen Laundry Canadian">Waschen Laundry Canadian</option>
                  <option value="Waschen Laundry Sentra Eropa">Waschen Laundry Sentra Eropa</option>
                </>
              )}
            </select>
          </div>
        </div>

        {/* BAGIAN 2: DOMISILI & PATOKAN LOKASI */}
        <div className="p-5 border border-[#e0e0e0] rounded-2xl bg-[#f8f8f8]/50 flex flex-col gap-4">
          <div className="flex items-center gap-2 border-b border-[#e0e0e0] pb-2 text-[#5f1340] font-black text-xs uppercase tracking-wider">
            <MapPin className="h-4 w-4" />
            <span>2. Alamat Domisili & Pengiriman</span>
          </div>

          <div className="flex flex-col gap-1">
            <label className="text-[11px] font-black text-slate-700">Alamat Lengkap Domisili *</label>
            <textarea
              rows={3}
              placeholder="Nama jalan, nomor rumah, RT/RW, kelurahan, kecamatan..."
              value={newCustForm.address}
              onChange={(e) => setNewCustForm({ ...newCustForm, address: e.target.value })}
              className="p-3 border border-[#e0e0e0] rounded-xl bg-white text-xs font-bold outline-none focus:border-[#5f1340] resize-none"
              required
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="flex flex-col gap-1">
              <label className="text-[11px] font-black text-slate-700">Kota / Kabupaten</label>
              <input
                type="text"
                placeholder="Jakarta Selatan"
                value={newCustForm.city}
                onChange={(e) => setNewCustForm({ ...newCustForm, city: e.target.value })}
                className="p-3 border border-[#e0e0e0] rounded-xl bg-white text-xs font-bold outline-none focus:border-[#5f1340]"
              />
            </div>

            <div className="flex flex-col gap-1">
              <label className="text-[11px] font-black text-slate-700">Kode Pos</label>
              <input
                type="text"
                placeholder="12810"
                value={newCustForm.postalCode}
                onChange={(e) => setNewCustForm({ ...newCustForm, postalCode: e.target.value })}
                className="p-3 border border-[#e0e0e0] rounded-xl bg-white text-xs font-bold outline-none focus:border-[#5f1340]"
              />
            </div>
          </div>

          <div className="flex flex-col gap-1">
            <label className="text-[11px] font-black text-slate-700">Patokan Alamat / Landmark (Antar-Jemput)</label>
            <input
              type="text"
              placeholder="Contoh: Depan Masjid Al-Ikhlas / Samping Alfamart"
              value={newCustForm.landmark}
              onChange={(e) => setNewCustForm({ ...newCustForm, landmark: e.target.value })}
              className="p-3 border border-[#e0e0e0] rounded-xl bg-white text-xs font-bold outline-none focus:border-[#5f1340]"
            />
          </div>
        </div>

        {/* BAGIAN 3: PREFERENSI & PERILAKU PELANGGAN */}
        <div className="p-5 border border-[#e0e0e0] rounded-2xl bg-[#f8f8f8]/50 flex flex-col gap-4">
          <div className="flex items-center gap-2 border-b border-[#e0e0e0] pb-2 text-[#5f1340] font-black text-xs uppercase tracking-wider">
            <Sparkles className="h-4 w-4" />
            <span>3. Preferensi Layanan & Sumber Info</span>
          </div>

          <div className="flex flex-col gap-1">
            <label className="text-[11px] font-black text-slate-700">Tahu Waschen Laundry Dari Mana? *</label>
            <select
              value={newCustForm.source}
              onChange={(e) => setNewCustForm({ ...newCustForm, source: e.target.value })}
              className="p-3 border border-[#e0e0e0] rounded-xl bg-white text-xs font-bold outline-none focus:border-[#5f1340] cursor-pointer"
              required
            >
              <option value="Instagram / Media Sosial">📸 Instagram / Media Sosial</option>
              <option value="Google Maps / Pencarian">📍 Google Maps / Pencarian Google</option>
              <option value="Spanduk / Banner Outlet">🚩 Spanduk / Banner Outlet</option>
              <option value="Rekomendasi Teman / Keluarga">👥 Rekomendasi Teman / Keluarga</option>
              <option value="Brosur / Leaflet">📄 Brosur / Leaflet</option>
              <option value="Walk-in Spontan">🏬 Walk-in / Langsung Datang</option>
            </select>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="flex flex-col gap-1">
              <label className="text-[11px] font-black text-slate-700">Aroma Parfum Favorit</label>
              <select
                value={newCustForm.perfumePreference}
                onChange={(e) => setNewCustForm({ ...newCustForm, perfumePreference: e.target.value })}
                className="p-3 border border-[#e0e0e0] rounded-xl bg-white text-xs font-bold outline-none focus:border-[#5f1340] cursor-pointer"
              >
                <option value="Sakura Premium">🌸 Sakura Premium</option>
                <option value="Lavender Calm">🌿 Lavender Calm</option>
                <option value="Lily Sweet">🌺 Lily Sweet</option>
                <option value="Ocean Breeze">🍃 Ocean Breeze</option>
                <option value="Tanpa Parfum">🚫 Tanpa Parfum (Alergi / Sensitive)</option>
              </select>
            </div>

            <div className="flex flex-col gap-1">
              <label className="text-[11px] font-black text-slate-700">Preferensi Pengerjaan</label>
              <select
                value={newCustForm.workPreference}
                onChange={(e) => setNewCustForm({ ...newCustForm, workPreference: e.target.value })}
                className="p-3 border border-[#e0e0e0] rounded-xl bg-white text-xs font-bold outline-none focus:border-[#5f1340] cursor-pointer"
              >
                <option value="Standard Reguler">Lipat Rapi Standard</option>
                <option value="Express 6 Jam">Prioritas Express</option>
                <option value="Hanger / Gantung">Gantung Hanger</option>
              </select>
            </div>
          </div>

          <div className="flex flex-col gap-1">
            <label className="text-[11px] font-black text-slate-700">Catatan Khusus / Instruksi Pakaian</label>
            <textarea
              rows={2}
              placeholder="Contoh: Pisahkan kemeja putih, jangan gunakan pemutih pada jas..."
              value={newCustForm.specialNotes}
              onChange={(e) => setNewCustForm({ ...newCustForm, specialNotes: e.target.value })}
              className="p-3 border border-[#e0e0e0] rounded-xl bg-white text-xs font-bold outline-none focus:border-[#5f1340] resize-none"
            />
          </div>
        </div>

        {/* BAGIAN 4: SYARAT & SUBMIT */}
        <div className="p-5 border border-[#e0e0e0] rounded-2xl bg-[#f8f8f8]/50 flex flex-col justify-between gap-4">
          <div className="flex flex-col gap-4">
            <div className="flex items-center gap-2 border-b border-[#e0e0e0] pb-2 text-[#5f1340] font-black text-xs uppercase tracking-wider">
              <UserCheck className="h-4 w-4" />
              <span>4. Status Member & Konfirmasi</span>
            </div>

            <div className="bg-white p-4 rounded-xl border border-[#e0e0e0] flex items-center justify-between">
              <div>
                <span className="text-xs font-black text-[#313030] block">Status Tier Pendaftaran:</span>
                <span className="text-[10px] text-slate-400">Otomatis terdaftar sebagai One-Time member</span>
              </div>
              {renderTierBadge('One-Time')}
            </div>

            <label className="flex items-start gap-3 p-3 bg-white border border-[#e0e0e0] rounded-xl cursor-pointer">
              <input
                type="checkbox"
                checked={newCustForm.sendWaNotification}
                onChange={(e) => setNewCustForm({ ...newCustForm, sendWaNotification: e.target.checked })}
                className="mt-0.5 accent-[#5f1340] h-4 w-4 cursor-pointer"
              />
              <span className="text-xs font-bold text-slate-700 leading-snug">
                Kirim pesan notifikasi ucapan selamat datang via WhatsApp otomatis ke nomor pelanggan.
              </span>
            </label>
          </div>

          <div className="flex items-center gap-3 pt-4 border-t border-[#e0e0e0]">
            <button
              type="submit"
              className="flex-1 py-3.5 bg-gradient-to-r from-[#5f1340] to-[#7d1b55] hover:opacity-95 text-white font-black rounded-2xl text-xs shadow-lg shadow-[#5f1340]/25 transition-all flex items-center justify-center gap-2 cursor-pointer"
            >
              <Save className="h-4 w-4" />
              <span>Simpan & Registrasi Pelanggan</span>
            </button>

            <button
              type="button"
              onClick={() => setNewCustForm(getDefaultForm(activeOutletName))}
              className="px-4 py-3.5 bg-white border border-[#e0e0e0] hover:bg-slate-50 text-slate-600 font-extrabold rounded-2xl text-xs transition-all cursor-pointer"
              title="Reset Isian Form"
            >
              <RotateCcw className="h-4 w-4" />
            </button>
          </div>
        </div>
      </div>
    </form>
  );
}
