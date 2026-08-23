import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import {
  ArrowLeft,
  CreditCard,
  RotateCcw,
  Save,
  UserCheck
} from 'lucide-react';

const getDefaultForm = (activeOutletName) => ({
  name: '',
  phone: '',
  address: '',
  tier: 'VIP',
  initialDeposit: 200000,
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
  const [newMemberForm, setNewMemberForm] = useState(() => getDefaultForm(activeOutletName));
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleRegisterMember = async (e) => {
    e.preventDefault();
    if (!newMemberForm.name || !newMemberForm.phone) {
      showToast('Form Belum Lengkap', 'Nama dan Nomor HP wajib diisi!', 'error');
      return;
    }

    setIsSubmitting(true);
    try {
      const res = await axios.post('/api/customers', {
        name: newMemberForm.name.trim(),
        phone: newMemberForm.phone.trim(),
        address: newMemberForm.address || null,
        tier: newMemberForm.tier || 'VIP',
        homeBranch: newMemberForm.homeBranch || activeOutletName,
        depositBalance: newMemberForm.initialDeposit || 0
      });

      if (res.data && res.data.success) {
        showToast('Member Baru Terdaftar', `${newMemberForm.name} berhasil didaftarkan ke database!`);
        setNewMemberForm(getDefaultForm(activeOutletName));
        onMemberRegistered();
        setTimeout(() => onSwitchToCatalog(), 1000);
      } else {
        showToast('Gagal Mendaftar', res.data?.message || 'Terjadi kesalahan server', 'error');
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
            <span>2. Tier & Saldo Awal</span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="flex flex-col gap-1">
              <label className="text-[11px] font-black text-slate-700">Tier Membership</label>
              <select
                value={newMemberForm.tier}
                onChange={(e) => setNewMemberForm({ ...newMemberForm, tier: e.target.value })}
                className="p-3 border border-[#e0e0e0] rounded-xl bg-white text-xs font-bold outline-none focus:border-[#5f1340] cursor-pointer"
              >
                <option value="VIP">VIP (Prioritas + Diskon Spesial)</option>
                <option value="Gold">Gold (Diskon Reguler)</option>
                <option value="Reguler">Reguler</option>
              </select>
            </div>

            <div className="flex flex-col gap-1">
              <label className="text-[11px] font-black text-slate-700">Cabang Pendaftaran</label>
              <select
                value={newMemberForm.homeBranch}
                onChange={(e) => setNewMemberForm({ ...newMemberForm, homeBranch: e.target.value })}
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
            </div>

            <div className="flex flex-col gap-1">
              <label className="text-[11px] font-black text-slate-700">Metode Bayar Setoran</label>
              <select
                value={newMemberForm.paymentMethod}
                onChange={(e) => setNewMemberForm({ ...newMemberForm, paymentMethod: e.target.value })}
                className="p-3 border border-[#e0e0e0] rounded-xl bg-white text-xs font-bold outline-none focus:border-[#5f1340] cursor-pointer"
              >
                <option value="Tunai">Tunai Kasir</option>
                <option value="QRIS Gopay">QRIS / E-Wallet</option>
                <option value="Transfer BCA">Transfer Bank BCA</option>
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
              onClick={() => setNewMemberForm(getDefaultForm(activeOutletName))}
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
