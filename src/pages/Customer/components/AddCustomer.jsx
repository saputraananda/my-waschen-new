import React, { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import axios from 'axios';
import { formatName } from '../../../utils/FormatName';
import { normalizePhone, composeFullAddress } from '../../../utils/NormalizePhone.js';
import { ArrowLeft, Save, RotateCcw } from 'lucide-react';
import { useAppDialog } from '../../../context/AppDialogContext.jsx';

const GREETINGS = ['Pak', 'Bu', 'Mas', 'Mba', 'Kaka', 'Mr.', 'Mrs.'];

const emptyForm = (activeOutletName, defaults = {}) => ({
  name: '',
  phone: '',
  gender: '',
  greeting: '',
  email: '',
  birthDate: '',
  occupation: '',
  address: '',
  block: '',
  houseNumber: '',
  fullAddress: '',
  district: '',
  subDistrict: '',
  city: '',
  postalCode: '',
  notes: '',
  generalNotes: '',
  homeBranch: activeOutletName || '',
  customerSourceId: defaults.customerSourceId || '',
  customerTierId: defaults.customerTierId || ''
});

const fromCustomer = (c, activeOutletName) => ({
  name: c.name || '',
  phone: c.phone || '',
  gender: c.gender || '',
  greeting: c.greeting || '',
  email: !c.email || c.email === '-' ? '' : c.email,
  birthDate: c.birth_date ? String(c.birth_date).slice(0, 10) : (c.birthDate || ''),
  occupation: c.occupation || '',
  address: !c.address || c.address === '-' ? '' : c.address,
  block: c.block || '',
  houseNumber: c.house_number || c.houseNumber || '',
  fullAddress: c.full_address || c.fullAddress || '',
  district: c.district || '',
  subDistrict: c.sub_district || c.subDistrict || '',
  city: !c.city || c.city === '-' ? '' : c.city,
  postalCode: c.postal_code || c.postalCode || '',
  notes: c.notes && c.notes !== 'Pelanggan terdaftar Waschen.' ? c.notes : '',
  generalNotes: c.general_notes || c.generalNotes || '',
  homeBranch: c.home_branch || c.homeBranch || activeOutletName || '',
  customerSourceId: c.customer_source_id || c.sourceId || '',
  customerTierId: c.spending_tier_id || c.tierId || ''
});

export default function AddCustomer({
  outlets,
  activeOutletName,
  activeOutletId,
  onCustomerCreated,
  onSwitchToCatalog,
  customerToEdit = null,
  onCustomerUpdated
}) {
  const navigate = useNavigate();
  const location = useLocation();
  const { showAlert } = useAppDialog();
  const isEdit = Boolean(customerToEdit?.dbId || customerToEdit?.id);
  const [customerSources, setCustomerSources] = useState([]);
  const [customerTiers, setCustomerTiers] = useState([]);
  const [showDetailAddress, setShowDetailAddress] = useState(false);
  const [showOptionalIdentity, setShowOptionalIdentity] = useState(false);
  const [fullAddressTouched, setFullAddressTouched] = useState(Boolean(customerToEdit?.full_address || customerToEdit?.fullAddress));
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [form, setForm] = useState(() => (
    customerToEdit ? fromCustomer(customerToEdit, activeOutletName) : emptyForm(activeOutletName)
  ));

  useEffect(() => {
    window.scrollTo({ top: 0, left: 0, behavior: 'instant' });
    if (document.documentElement) document.documentElement.scrollTop = 0;
    if (document.body) document.body.scrollTop = 0;

    if (customerToEdit) {
      const mapped = fromCustomer(customerToEdit, activeOutletName);
      setForm(mapped);
      setFullAddressTouched(Boolean(customerToEdit.full_address || customerToEdit.fullAddress));
      if (customerToEdit.district || customerToEdit.sub_district || customerToEdit.subDistrict) {
        setShowDetailAddress(true);
      }
      if (mapped.gender || mapped.birthDate || mapped.occupation || mapped.email) {
        setShowOptionalIdentity(true);
      }
    }
  }, [customerToEdit, activeOutletName]);

  useEffect(() => {
    Promise.all([
      axios.get('/api/masters/customer-sources'),
      axios.get('/api/masters/customer-tiers')
    ])
      .then(([sourceRes, tierRes]) => {
        const sourceList = sourceRes.data?.success ? (sourceRes.data.data || []) : [];
        const tierList = tierRes.data?.success ? (tierRes.data.data || []) : [];
        const defaultTier = tierList.find((t) => t.code === 'ONE_TIME' || t.name === 'One-Time') || tierList[tierList.length - 1];
        setCustomerSources(sourceList);
        setCustomerTiers(tierList);
        setForm((prev) => ({
          ...prev,
          customerSourceId: prev.customerSourceId || '',
          customerTierId: prev.customerTierId || defaultTier?.id || ''
        }));
      })
      .catch((err) => console.error('Gagal memuat master preferensi:', err));
  }, []);

  const patch = (partial) => {
    setForm((prev) => {
      const next = { ...prev, ...partial };
      if (!fullAddressTouched) {
        next.fullAddress = composeFullAddress({
          address: next.address,
          block: next.block,
          houseNumber: next.houseNumber
        });
      }
      return next;
    });
  };

  const handlePhoneBlur = () => {
    const clean = normalizePhone(form.phone);
    if (clean) setForm((prev) => ({ ...prev, phone: clean }));
  };

  const resolveOutletIdFromBranch = (branchName) => {
    const match = (outlets || []).find(
      (o) => (o.full_name || o.name) === branchName
    );
    return match?.id || parseInt(activeOutletId, 10) || null;
  };

  const payloadFromForm = () => ({
    name: formatName(form.name),
    phone: normalizePhone(form.phone),
    gender: form.gender || null,
    greeting: form.greeting || null,
    email: form.email || null,
    birthDate: form.birthDate || null,
    occupation: form.occupation || null,
    address: form.address || null,
    block: form.block || null,
    houseNumber: form.houseNumber || null,
    fullAddress: form.fullAddress || null,
    district: form.district || null,
    subDistrict: form.subDistrict || null,
    city: form.city || null,
    postalCode: form.postalCode || null,
    notes: form.notes || null,
    generalNotes: form.generalNotes || null,
    homeBranch: form.homeBranch || activeOutletName,
    preferredOutletId: resolveOutletIdFromBranch(form.homeBranch || activeOutletName),
    customerTierId: form.customerTierId || null,
    customerSourceId: form.customerSourceId || null
  });

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (isSubmitting) return;

    if (!form.greeting || !form.name || !form.phone) {
      showAlert({ title: 'Form Belum Lengkap', message: 'Sapaan, nama lengkap, dan nomor HP wajib diisi', type: 'error' });
      return;
    }
    const cleanPhone = normalizePhone(form.phone);
    if (!cleanPhone || cleanPhone.length < 10) {
      showAlert({ title: 'Nomor HP Tidak Valid', message: 'Masukkan nomor HP yang benar, contoh 087770597000', type: 'error' });
      return;
    }

    const payload = payloadFromForm();
    setIsSubmitting(true);
    try {
      if (isEdit) {
        const id = customerToEdit.dbId || customerToEdit.id;
        const res = await axios.put(`/api/customers/${id}`, payload, { timeout: 20000 });
        if (res.data?.success) {
          showAlert({ title: 'Data Diperbarui', message: `Data ${payload.name} berhasil disimpan.`, type: 'success' });
          onCustomerUpdated?.(res.data.data);
          onSwitchToCatalog?.();
        } else {
          showAlert({ title: 'Gagal Simpan', message: res.data?.message || 'Respons server tidak valid', type: 'error' });
        }
        return;
      }

      const res = await axios.post('/api/customers', payload, { timeout: 20000 });
      if (res.data?.success) {
        const created = res.data.data;
        const mapped = {
          id: created.customer_code || String(created.id),
          dbId: created.id,
          name: created.name,
          phone: created.phone,
          email: created.email || '-',
          address: created.full_address || created.address,
          city: created.city,
          landmark: created.landmark || '-',
          homeBranch: created.home_branch || activeOutletName,
          tier: created.tier || 'One-Time',
          tierId: created.spending_tier_id,
          membershipTier: created.membership_tier || null,
          totalSpending: 0,
          monthlySpending: 0,
          trxCount: 0,
          depositBalance: 0,
          lastTrx: '-',
          registeredAt: created.created_at
            ? new Date(created.created_at).toLocaleDateString('id-ID', { day: '2-digit', month: 'short', year: 'numeric' })
            : new Date().toLocaleDateString('id-ID', { day: '2-digit', month: 'short', year: 'numeric' }),
          source: created.source || created.source_name || '-',
          sourceId: created.customer_source_id,
          notes: created.notes || '',
          complaints: [],
          history: []
        };
        onCustomerCreated?.(mapped);
        localStorage.setItem('autoSelectCustId', mapped.id);
        showAlert({ title: 'Registrasi Berhasil', message: `Pelanggan ${payload.name} tersimpan. Nomor HP: ${created.phone}`, type: 'success' });
        setForm(emptyForm(activeOutletName, {
          customerSourceId: '',
          customerTierId: customerTiers.find((t) => t.code === 'ONE_TIME')?.id || customerTiers[customerTiers.length - 1]?.id || ''
        }));
        setFullAddressTouched(false);
        setTimeout(() => {
          if (location.state?.from === '/transaction' || new URLSearchParams(location.search).get('tab') === 'add') {
            navigate('/transaction', { replace: true });
          } else {
            onSwitchToCatalog?.();
          }
        }, 400);
      } else {
        showAlert({ title: 'Gagal Simpan', message: res.data?.message || 'Respons server tidak valid', type: 'error' });
      }
    } catch (err) {
      console.error('Gagal menyimpan pelanggan:', err);
      const timedOut = err.code === 'ECONNABORTED' || /timeout/i.test(err.message || '');
      showAlert({
        title: 'Gagal Simpan',
        message: timedOut
          ? 'Request timeout. Coba lagi — server mungkin sibuk.'
          : (err.response?.data?.message || 'Terjadi kesalahan saat menyimpan'),
        type: 'error'
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const fieldCls = 'p-2.5 border border-[#e0e0e0] rounded-xl bg-white text-xs font-semibold text-slate-800 outline-none focus:border-[#5f1340] focus:ring-1 focus:ring-[#5f1340]/20 transition-all';
  const labelCls = 'text-[11px] font-extrabold text-slate-700';

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-5 sm:gap-6 bg-white border border-[#e0e0e0] rounded-2xl sm:rounded-3xl p-4 sm:p-6 shadow-xs">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between border-b border-[#e0e0e0] pb-4 gap-3">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-base sm:text-lg font-black text-[#313030]">
              {isEdit ? 'Ubah Data Customer' : 'Pendaftaran Customer Baru'}
            </h2>
            {isEdit && (
              <span className="px-2.5 py-0.5 bg-amber-50 text-amber-700 border border-amber-200 text-[10px] font-bold rounded-full">
                Mode Edit
              </span>
            )}
          </div>
          <p className="text-[11px] sm:text-xs text-slate-400 mt-0.5">
            Wajib: sapaan, nama, dan nomor HP. Data lain boleh dilengkapi nanti.
          </p>
        </div>
        <button
          type="button"
          onClick={() => (isEdit ? onSwitchToCatalog?.() : navigate(-1))}
          className="flex items-center justify-center gap-2 px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-extrabold rounded-xl text-xs cursor-pointer transition-colors w-full sm:w-auto"
        >
          <ArrowLeft className="h-4 w-4" />
          <span>Kembali</span>
        </button>
      </div>

      {/* Main Form Fields in 2 Columns */}
      <div className="grid grid-cols-1 lg:grid-cols-2 items-start gap-4 sm:gap-6">

        {/* Left Column: Identitas & Preferensi */}
        <div className="flex flex-col gap-4 sm:gap-5">
          {/* Identitas Card — hanya field wajib */}
          <div className="flex flex-col gap-4 p-4 sm:p-5 border border-[#e0e0e0] rounded-2xl bg-[#fcfcfc]">
            <div className="flex items-center justify-between border-b border-[#f0f0f0] pb-2 gap-2">
              <h3 className="text-xs font-black text-[#5f1340] uppercase tracking-wider">
                Identitas Pelanggan
              </h3>
              <span className="text-[9px] font-extrabold uppercase tracking-wider text-[#5f1340] bg-[#5f1340]/5 border border-[#5f1340]/15 px-2 py-0.5 rounded-lg shrink-0">
                Wajib
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div className="flex flex-col gap-1 sm:col-span-1">
                <label className={labelCls}>Sapaan *</label>
                <select
                  className={`${fieldCls} cursor-pointer`}
                  value={form.greeting}
                  onChange={(e) => patch({ greeting: e.target.value })}
                  required
                >
                  <option value="">— Pilih —</option>
                  {GREETINGS.map((g) => <option key={g} value={g}>{g}</option>)}
                </select>
              </div>
              <div className="flex flex-col gap-1 sm:col-span-2">
                <label className={labelCls}>Nama Lengkap *</label>
                <input className={fieldCls} placeholder="Contoh: Budi Santoso" value={form.name} onChange={(e) => patch({ name: e.target.value })} required />
              </div>
            </div>

            <div className="flex flex-col gap-1">
              <label className={labelCls}>Nomor Handphone (WhatsApp) *</label>
              <input
                className={fieldCls}
                type="tel"
                placeholder="087770597000"
                value={form.phone}
                onChange={(e) => patch({ phone: e.target.value })}
                onBlur={handlePhoneBlur}
                required
              />
              <span className="text-[10px] text-slate-400">Otomatis diformat ke 08xx meski diisi +62 atau 62.</span>
            </div>

            <div className="pt-1 border-t border-[#f0f0f0]">
              <button
                type="button"
                onClick={() => setShowOptionalIdentity((v) => !v)}
                className="text-xs font-bold text-[#5f1340] hover:underline cursor-pointer flex items-center gap-1"
              >
                {showOptionalIdentity
                  ? '▲ Sembunyikan Data Tambahan'
                  : '▼ Lengkapi Data Tambahan (Jenis Kelamin, Tgl Lahir, Pekerjaan, Email)'}
              </button>

              {showOptionalIdentity && (
                <div className="flex flex-col gap-3 mt-3 p-3 bg-white border border-[#e0e0e0] rounded-xl">
                  <span className="text-[10px] font-extrabold uppercase tracking-wider text-slate-400">
                    Opsional — bisa diisi nanti
                  </span>

                  <div className="flex flex-col gap-1">
                    <label className={labelCls}>Jenis Kelamin</label>
                    <div className="grid grid-cols-2 gap-2 text-xs font-bold">
                      {['Laki-Laki', 'Perempuan'].map((g) => {
                        const active = form.gender === g;
                        return (
                          <button
                            type="button"
                            key={g}
                            onClick={() => patch({ gender: active ? '' : g })}
                            className={`py-2 px-3 rounded-xl border text-xs font-bold transition-all cursor-pointer text-center ${
                              active
                                ? 'border-[#5f1340] bg-[#5f1340]/5 text-[#5f1340]'
                                : 'border-[#e0e0e0] bg-white text-slate-600 hover:bg-slate-50'
                            }`}
                          >
                            {g}
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div className="flex flex-col gap-1">
                      <label className={labelCls}>Tanggal Lahir</label>
                      <div className="relative">
                        {!form.birthDate && (
                          <span
                            aria-hidden="true"
                            className="pointer-events-none absolute inset-y-0 left-2.5 z-[1] flex items-center text-xs font-semibold text-slate-400"
                          >
                            dd/mm/yyyy
                          </span>
                        )}
                        <input
                          className={`${fieldCls} w-full ${!form.birthDate ? 'text-transparent [&::-webkit-datetime-edit]:text-transparent [&::-webkit-calendar-picker-indicator]:opacity-100' : ''}`}
                          type="date"
                          value={form.birthDate}
                          onChange={(e) => patch({ birthDate: e.target.value })}
                          aria-label="Tanggal lahir"
                        />
                      </div>
                    </div>
                    <div className="flex flex-col gap-1">
                      <label className={labelCls}>Pekerjaan</label>
                      <input className={fieldCls} placeholder="PNS, Swasta, dll" value={form.occupation} onChange={(e) => patch({ occupation: e.target.value })} />
                    </div>
                  </div>

                  <div className="flex flex-col gap-1">
                    <label className={labelCls}>Email</label>
                    <input className={fieldCls} type="email" placeholder="pelanggan@email.com" value={form.email} onChange={(e) => patch({ email: e.target.value })} />
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Preferensi & Outlet Card */}
          <div className="flex flex-col gap-4 p-5 border border-[#e0e0e0] rounded-2xl bg-[#fcfcfc]">
            <h3 className="text-xs font-black text-[#5f1340] uppercase tracking-wider border-b border-[#f0f0f0] pb-2">
              Preferensi & Cabang
            </h3>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="flex flex-col gap-1">
                <label className={labelCls}>Tahu Waschen Dari Mana?</label>
                <select
                  className={`${fieldCls} cursor-pointer`}
                  value={form.customerSourceId}
                  onChange={(e) => patch({ customerSourceId: parseInt(e.target.value, 10) || '' })}
                >
                  <option value="">— Pilih —</option>
                  {customerSources.map((s) => (
                    <option key={s.id} value={s.id}>{s.label || s.name}</option>
                  ))}
                </select>
              </div>

              <div className="flex flex-col gap-1">
                <label className={labelCls}>Cabang Utama</label>
                <select
                  className={`${fieldCls} cursor-pointer`}
                  value={form.homeBranch}
                  onChange={(e) => patch({ homeBranch: e.target.value })}
                >
                  {(outlets && outlets.length > 0) ? (
                    outlets.map((o) => (
                      <option key={o.id} value={o.full_name || o.name}>{o.full_name || o.name}</option>
                    ))
                  ) : (
                    <option value={activeOutletName || ''}>{activeOutletName || 'Utama'}</option>
                  )}
                </select>
              </div>
            </div>

            <div className="flex flex-col gap-1">
              <label className={labelCls}>Catatan Umum / Khusus</label>
              <textarea
                className={`${fieldCls} resize-none`}
                rows={2}
                placeholder="Catatan internal pelanggan, misal: Pakaian branded, perlakuan khusus..."
                value={form.generalNotes}
                onChange={(e) => patch({ generalNotes: e.target.value })}
              />
            </div>
          </div>
        </div>

        {/* Right Column: Alamat & Wilayah */}
        <div className="flex flex-col gap-5">
          <div className="flex flex-col gap-4 p-5 border border-[#e0e0e0] rounded-2xl bg-[#fcfcfc]">
            <h3 className="text-xs font-black text-[#5f1340] uppercase tracking-wider border-b border-[#f0f0f0] pb-2">
              Alamat Lengkap & Pengiriman
            </h3>

            <div className="flex flex-col gap-1">
              <label className={labelCls}>Alamat Singkat / Nama Jalan</label>
              <input className={fieldCls} placeholder="Raffles Hills" value={form.address} onChange={(e) => patch({ address: e.target.value })} />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="flex flex-col gap-1">
                <label className={labelCls}>Blok</label>
                <input className={fieldCls} placeholder="T11" value={form.block} onChange={(e) => patch({ block: e.target.value })} />
              </div>
              <div className="flex flex-col gap-1">
                <label className={labelCls}>Nomor Rumah</label>
                <input className={fieldCls} placeholder="18" value={form.houseNumber} onChange={(e) => patch({ houseNumber: e.target.value })} />
              </div>
            </div>

            <div className="flex flex-col gap-1">
              <label className={labelCls}>Alamat Lengkap (Ditampilkan di Struk/Nota)</label>
              <textarea
                className={`${fieldCls} resize-none`}
                rows={3}
                placeholder="Raffles Hills Blok T11 No 18"
                value={form.fullAddress}
                onChange={(e) => {
                  setFullAddressTouched(true);
                  setForm((prev) => ({ ...prev, fullAddress: e.target.value }));
                }}
              />
              <span className="text-[10px] text-slate-400">Otomatis terisi dari alamat singkat, blok & nomor rumah.</span>
            </div>

            <div className="flex flex-col gap-1">
              <label className={labelCls}>Catatan / Patokan Lokasi Rumah</label>
              <input className={fieldCls} placeholder="Pagar hitam depan masjid" value={form.notes} onChange={(e) => patch({ notes: e.target.value })} />
            </div>

            <div className="pt-2 border-t border-[#f0f0f0]">
              <button
                type="button"
                onClick={() => setShowDetailAddress((v) => !v)}
                className="text-xs font-bold text-[#5f1340] hover:underline cursor-pointer flex items-center gap-1"
              >
                {showDetailAddress ? '▲ Sembunyikan Detail Wilayah' : '▼ Tampilkan Detail Wilayah (Kecamatan, Kelurahan, Kota, Kode POS)'}
              </button>

              {showDetailAddress && (
                <div className="grid grid-cols-2 gap-3 mt-3 p-3 bg-white border border-[#e0e0e0] rounded-xl">
                  <div className="flex flex-col gap-1">
                    <label className={labelCls}>Kecamatan</label>
                    <input className={fieldCls} placeholder="Duren Sawit" value={form.district} onChange={(e) => patch({ district: e.target.value })} />
                  </div>
                  <div className="flex flex-col gap-1">
                    <label className={labelCls}>Kelurahan</label>
                    <input className={fieldCls} placeholder="Pondok Bambu" value={form.subDistrict} onChange={(e) => patch({ subDistrict: e.target.value })} />
                  </div>
                  <div className="flex flex-col gap-1">
                    <label className={labelCls}>Kota</label>
                    <input className={fieldCls} placeholder="Jakarta Timur" value={form.city} onChange={(e) => patch({ city: e.target.value })} />
                  </div>
                  <div className="flex flex-col gap-1">
                    <label className={labelCls}>Kode POS</label>
                    <input className={fieldCls} placeholder="13430" value={form.postalCode} onChange={(e) => patch({ postalCode: e.target.value })} />
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Full-width Footer Action Bar */}
      <div className="flex flex-col sm:flex-row items-center justify-between border-t border-[#e0e0e0] pt-5 gap-3 mt-1">
        <span className="text-xs text-slate-400 font-medium text-center sm:text-left">
          * Wajib: sapaan, nama, nomor HP. Data lain opsional dan bisa dilengkapi nanti.
        </span>

        <div className="flex items-center gap-3 w-full sm:w-auto justify-end">
          {!isEdit && (
            <button
              type="button"
              disabled={isSubmitting}
              onClick={() => {
                setFullAddressTouched(false);
                setForm(emptyForm(activeOutletName, {
                  customerSourceId: '',
                  customerTierId: customerTiers.find((t) => t.code === 'ONE_TIME')?.id || ''
                }));
              }}
              className="flex-1 sm:flex-none px-4 py-3 bg-white border border-[#e0e0e0] hover:bg-slate-50 disabled:opacity-50 text-slate-700 font-bold rounded-xl text-xs cursor-pointer flex items-center justify-center gap-2 transition-colors"
            >
              <RotateCcw className="h-4 w-4" />
              <span>Reset Form</span>
            </button>
          )}

          <button
            type="submit"
            disabled={isSubmitting}
            className="flex-1 sm:flex-none px-6 py-3 bg-[#5f1340] hover:bg-[#4d0f33] disabled:opacity-60 disabled:cursor-not-allowed text-white font-extrabold rounded-xl text-xs flex items-center justify-center gap-2 cursor-pointer shadow-xs transition-colors"
          >
            <Save className="h-4 w-4" />
            <span>
              {isSubmitting
                ? 'Menyimpan...'
                : (isEdit ? 'Simpan Perubahan' : 'Simpan Pelanggan')}
            </span>
          </button>
        </div>
      </div>
    </form>
  );
}

