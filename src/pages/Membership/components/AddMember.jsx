import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import {
  ArrowLeft,
  CreditCard,
  RotateCcw,
  Save,
  UserCheck
} from 'lucide-react';

const getDefaultForm = (activeOutletName, pkg = null) => ({
  name: '',
  phone: '',
  address: '',
  packageId: pkg?.id || '',
  membershipTier: pkg?.tier || 'Gold',
  initialDeposit: pkg ? Number(pkg.top_up_amount || 0) : 0,
  homeBranch: activeOutletName,
  paymentMethod: 'Tunai'
});

export default function AddMember({
  outlets,
  activeOutletName,
  showToast,
  onMemberRegistered,
  onSwitchToCatalog
}) {
  const navigate = useNavigate();
  const [packages, setPackages] = useState([]);
  const [paymentMethods, setPaymentMethods] = useState([]);
  const [newMemberForm, setNewMemberForm] = useState(() => getDefaultForm(activeOutletName));
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    Promise.all([
      axios.get('/api/memberships/packages'),
      axios.get('/api/masters/payment-methods')
    ])
      .then(([pkgRes, payRes]) => {
        if (pkgRes.data?.success && pkgRes.data.data?.length > 0) {
          const list = pkgRes.data.data;
          setPackages(list);
          setNewMemberForm((prev) => ({
            ...prev,
            ...getDefaultForm(activeOutletName, list[0]),
            name: prev.name,
            phone: prev.phone,
            address: prev.address,
            homeBranch: prev.homeBranch || activeOutletName,
            paymentMethod: prev.paymentMethod || 'Tunai'
          }));
        }
        if (payRes.data?.success) {
          const methods = (payRes.data.data || []).filter((m) => !m.requires_member_balance);
          setPaymentMethods(methods);
          if (methods[0]) {
            setNewMemberForm((prev) => ({ ...prev, paymentMethod: prev.paymentMethod || methods[0].name }));
          }
        }
      })
      .catch((err) => console.error('Gagal memuat paket/payment master:', err));
  }, [activeOutletName]);

  const handlePackageChange = (packageId) => {
    const pkg = packages.find((p) => String(p.id) === String(packageId));
    if (!pkg) return;
    setNewMemberForm((prev) => ({
      ...prev,
      packageId: pkg.id,
      tier: pkg.tier || prev.membershipTier,
      membershipTier: pkg.tier || prev.membershipTier,
      initialDeposit: Number(pkg.top_up_amount || 0)
    }));
  };

  const handleRegisterMember = async (e) => {
    e.preventDefault();
    if (!newMemberForm.name || !newMemberForm.phone) {
      showToast('Form Belum Lengkap', 'Nama dan Nomor HP wajib diisi!', 'error');
      return;
    }

    setIsSubmitting(true);
    try {
      const custRes = await axios.post('/api/customers', {
        name: newMemberForm.name.trim(),
        phone: newMemberForm.phone.trim(),
        address: newMemberForm.address || null,
        tier: 'One-Time',
        homeBranch: newMemberForm.homeBranch || activeOutletName,
        depositBalance: 0
      });

      if (!custRes.data?.success) {
        showToast('Gagal Mendaftar', custRes.data?.message || 'Terjadi kesalahan server', 'error');
        return;
      }

      const customerId = custRes.data.data.id;
      const memRes = await axios.post('/api/memberships', {
        customerId,
        packageId: newMemberForm.packageId,
        outletId: parseInt(localStorage.getItem('activeOutletId')) || 2,
        paymentMethod: newMemberForm.paymentMethod
      });

      if (memRes.data?.success) {
        showToast('Member Baru Terdaftar', `${newMemberForm.name} — paket ${newMemberForm.membershipTier} berhasil diaktifkan!`);
        setNewMemberForm(getDefaultForm(activeOutletName, packages[0] || null));
        onMemberRegistered();
        setTimeout(() => onSwitchToCatalog(), 1000);
      } else {
        showToast('Gagal Aktivasi Paket', memRes.data?.message || 'Pelanggan tersimpan, paket gagal diaktifkan', 'error');
      }
    } catch (err) {
      console.error('Gagal register member:', err);
      showToast('Gagal Mendaftar', err.response?.data?.message || 'Koneksi server gagal', 'error');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <form onSubmit={handleRegisterMember} className="flex flex-col gap-6 bg-white border border-[#e0e0e0] rounded-3xl p-6 shadow-xs">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between border-b border-[#e0e0e0] pb-4 gap-3">
        <div className="flex items-center gap-3">
          <div className="p-3 bg-[#5f1340]/10 text-[#5f1340] rounded-2xl">
            <CreditCard className="h-6 w-6" />
          </div>
          <div>
            <h2 className="text-lg font-black text-[#313030]">Aktivasi Kartu Member Baru</h2>
            <p className="text-xs text-slate-400">Pendaftaran nomor kartu RFID/ID member baru & saldo deposit</p>
          </div>
        </div>

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

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="p-5 border border-[#e0e0e0] rounded-2xl bg-[#f8f8f8]/50 flex flex-col gap-4">
          <div className="flex items-center gap-2 border-b border-[#e0e0e0] pb-2 text-[#5f1340] font-black text-xs uppercase tracking-wider">
            <UserCheck className="h-4 w-4" />
            <span>1. Identitas Member</span>
          </div>

          <div className="flex flex-col gap-1">
            <label className="text-[11px] font-black text-slate-700">Nama Lengkap *</label>
            <input
              type="text"
              required
              placeholder="Contoh: Budi Santoso"
              value={newMemberForm.name}
              onChange={(e) => setNewMemberForm({ ...newMemberForm, name: e.target.value })}
              className="p-3 border border-[#e0e0e0] rounded-xl bg-white text-xs font-bold outline-none focus:border-[#5f1340]"
            />
          </div>

          <div className="flex flex-col gap-1">
            <label className="text-[11px] font-black text-slate-700">Nomor WhatsApp / HP *</label>
            <input
              type="tel"
              required
              placeholder="0812xxxx"
              value={newMemberForm.phone}
              onChange={(e) => setNewMemberForm({ ...newMemberForm, phone: e.target.value })}
              className="p-3 border border-[#e0e0e0] rounded-xl bg-white text-xs font-bold outline-none focus:border-[#5f1340]"
            />
          </div>

          <div className="flex flex-col gap-1">
            <label className="text-[11px] font-black text-slate-700">Alamat (Opsional)</label>
            <textarea
              rows={2}
              placeholder="Alamat domisili pelanggan..."
              value={newMemberForm.address}
              onChange={(e) => setNewMemberForm({ ...newMemberForm, address: e.target.value })}
              className="p-3 border border-[#e0e0e0] rounded-xl bg-white text-xs font-bold outline-none focus:border-[#5f1340] resize-none"
            />
          </div>
        </div>

        <div className="p-5 border border-[#e0e0e0] rounded-2xl bg-[#f8f8f8]/50 flex flex-col gap-4">
          <div className="flex items-center gap-2 border-b border-[#e0e0e0] pb-2 text-[#5f1340] font-black text-xs uppercase tracking-wider">
            <CreditCard className="h-4 w-4" />
            <span>2. Paket & Saldo Awal</span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="flex flex-col gap-1">
              <label className="text-[11px] font-black text-slate-700">Paket Membership</label>
              <select
                value={newMemberForm.packageId}
                onChange={(e) => handlePackageChange(e.target.value)}
                className="p-3 border border-[#e0e0e0] rounded-xl bg-white text-xs font-bold outline-none focus:border-[#5f1340] cursor-pointer"
                disabled={packages.length === 0}
              >
                {packages.length === 0 ? (
                  <option value="">Memuat paket...</option>
                ) : (
                  packages.map((pkg) => (
                    <option key={pkg.id} value={pkg.id}>
                      {pkg.name} ({pkg.tier} — Rp {Number(pkg.top_up_amount).toLocaleString('id-ID')})
                    </option>
                  ))
                )}
              </select>
            </div>

            <div className="flex flex-col gap-1">
              <label className="text-[11px] font-black text-slate-700">Cabang Pendaftaran</label>
              <select
                value={newMemberForm.homeBranch}
                onChange={(e) => setNewMemberForm({ ...newMemberForm, homeBranch: e.target.value })}
                className="p-3 border border-[#e0e0e0] rounded-xl bg-white text-xs font-bold outline-none focus:border-[#5f1340] cursor-pointer"
              >
                {outlets.map(o => (
                  <option key={o.id} value={o.full_name || o.name}>
                    {o.full_name || o.name}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="flex flex-col gap-1">
              <label className="text-[11px] font-black text-slate-700">Setoran Saldo Awal (Rp)</label>
              <input
                type="number"
                min="0"
                step="10000"
                value={newMemberForm.initialDeposit}
                onChange={(e) => setNewMemberForm({ ...newMemberForm, initialDeposit: e.target.value })}
                className="p-3 border border-[#e0e0e0] rounded-xl bg-white text-xs font-bold outline-none focus:border-[#5f1340]"
              />
              <span className="text-[9px] text-slate-400">Paket member: <strong>{newMemberForm.membershipTier || '-'}</strong></span>
            </div>

            <div className="flex flex-col gap-1">
              <label className="text-[11px] font-black text-slate-700">Metode Bayar Setoran</label>
              <select
                value={newMemberForm.paymentMethod}
                onChange={(e) => setNewMemberForm({ ...newMemberForm, paymentMethod: e.target.value })}
                className="p-3 border border-[#e0e0e0] rounded-xl bg-white text-xs font-bold outline-none focus:border-[#5f1340] cursor-pointer"
              >
                {paymentMethods.map((m) => (
                  <option key={m.id} value={m.name}>{m.label}</option>
                ))}
              </select>
            </div>
          </div>

          <div className="flex items-center gap-3 pt-4 border-t border-[#e0e0e0] mt-auto">
            <button
              type="submit"
              disabled={isSubmitting}
              className="flex-1 py-3.5 bg-gradient-to-r from-[#5f1340] to-[#7d1956] hover:opacity-95 text-white font-black rounded-2xl text-xs shadow-lg shadow-[#5f1340]/25 transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-60"
            >
              <Save className="h-4 w-4" />
              <span>{isSubmitting ? 'Menyimpan...' : 'Simpan & Terbitkan Kartu Member'}</span>
            </button>

            <button
              type="button"
              onClick={() => setNewMemberForm(getDefaultForm(activeOutletName, packages[0] || null))}
              className="px-4 py-3.5 bg-white border border-[#e0e0e0] hover:bg-slate-50 text-slate-600 font-extrabold rounded-2xl text-xs transition-all cursor-pointer"
            >
              <RotateCcw className="h-4 w-4" />
            </button>
          </div>
        </div>
      </div>
    </form>
  );
}
