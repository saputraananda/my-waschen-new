import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { formatRupiah, parseRupiah } from '../../../utils/FormatRupiah.js';
import { formatEmployeeName } from '../../../utils/FormatName.js';
import { RotateCcw, Save } from 'lucide-react';

const AMOUNT_PRESETS = [25000, 50000, 100000, 200000, 500000];

const getDefaultForm = (categoryId = '') => ({
  type: 'Keluar',
  categoryId,
  amount: '',
  desc: ''
});

export default function AddPettyCash({
  activeOutletId,
  userProfile,
  showToast,
  onCashLogCreated,
  onSwitchToDashboard
}) {
  const [categories, setCategories] = useState([]);
  const [logForm, setLogForm] = useState(getDefaultForm);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const numAmount = parseRupiah(logForm.amount);
  const selectedCategory = categories.find(c => String(c.id) === String(logForm.categoryId));

  useEffect(() => {
    axios.get('/api/masters/petty-cash-categories')
      .then((res) => {
        if (res.data?.success && res.data.data?.length) {
          const list = res.data.data;
          setCategories(list);
          const firstOut = list.find((c) => c.flow_type === 'Keluar') || list[0];
          setLogForm((prev) => ({ ...prev, categoryId: firstOut?.id || '' }));
        }
      })
      .catch((err) => console.error('Gagal memuat kategori petty cash:', err));
  }, []);

  useEffect(() => {
    if (!categories.length) return;
    if (logForm.type === 'Masuk') {
      const masuk = categories.find(c => c.flow_type === 'Masuk');
      if (masuk && String(logForm.categoryId) !== String(masuk.id)) {
        setLogForm(prev => ({ ...prev, categoryId: masuk.id }));
      }
    } else {
      const current = categories.find(c => String(c.id) === String(logForm.categoryId));
      const keluar = categories.find(c => c.flow_type === 'Keluar');
      if (current?.flow_type === 'Masuk' && keluar) {
        setLogForm(prev => ({ ...prev, categoryId: keluar.id }));
      }
    }
  }, [logForm.type, categories]);

  const visibleCategories = categories.filter((cat) => {
    if (logForm.type === 'Masuk') return cat.flow_type === 'Masuk';
    return cat.flow_type === 'Keluar';
  });

  const handleSaveCashLog = async (e) => {
    e.preventDefault();
    if (!logForm.categoryId) {
      showToast('Kategori Belum Dipilih', 'Pilih kategori pengeluaran / pemasukan.', 'error');
      return;
    }
    if (!logForm.amount || numAmount <= 0) {
      showToast('Nominal Tidak Valid', 'Nominal harus diisi dengan benar!', 'error');
      return;
    }

    setIsSubmitting(true);
    try {
      const res = await axios.post('/api/petty-cash', {
        outletId: parseInt(activeOutletId) || 2,
        cashierEmployeeId: parseInt(localStorage.getItem('employeeId')) || 167,
        shiftId: localStorage.getItem('activeShiftId')
          ? parseInt(localStorage.getItem('activeShiftId'))
          : null,
        type: logForm.type,
        category: selectedCategory?.label || selectedCategory?.name,
        amount: numAmount,
        description: logForm.desc || 'Pencatatan kas outlet'
      });

      if (res.data && res.data.success) {
        const created = res.data.data;
        onCashLogCreated({
          id: created.id,
          type: created.type,
          category: created.category,
          amount: parseFloat(created.amount) || numAmount,
          desc: created.description || 'Pencatatan kas outlet',
          date: 'Baru saja',
          createdBy: formatEmployeeName(userProfile?.fullName, 'Staff Kasir')
        });
        showToast('Kas Tersimpan', 'Transaksi petty cash berhasil dicatat.');
        const firstOut = categories.find((c) => c.flow_type === 'Keluar');
        setLogForm(getDefaultForm(firstOut?.id || ''));
        setTimeout(() => onSwitchToDashboard(), 800);
      }
    } catch (err) {
      console.error('Gagal menyimpan kas kecil:', err);
      showToast('Gagal Simpan', err.response?.data?.message || err.message, 'error');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <form onSubmit={handleSaveCashLog} className="flex flex-col gap-6 bg-white border border-[#e0e0e0] rounded-3xl p-6 shadow-xs w-full">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between border-b border-[#e0e0e0] pb-4 gap-3">
        <div>
          <h2 className="text-lg font-black text-[#313030]">Catat Arus Kas Laci</h2>
          <p className="text-xs text-slate-400">Input transaksi kas masuk atau keluar dari laci outlet</p>
        </div>

        <button
          type="button"
          onClick={() => onSwitchToDashboard()}
          className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-extrabold rounded-xl text-xs transition-colors cursor-pointer self-start sm:self-auto"
        >
          Kembali ke Dashboard
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="flex flex-col gap-5">
          <div className="p-5 border border-[#e0e0e0] rounded-2xl bg-[#f8f8f8]/50 flex flex-col gap-4">
            <span className="text-[10px] font-black text-[#5f1340] uppercase tracking-wider">1. Tipe Transaksi</span>
            <div className="grid grid-cols-2 gap-3">
              <button
                type="button"
                onClick={() => setLogForm({ ...logForm, type: 'Keluar' })}
                className={`py-3 px-3 rounded-2xl text-xs font-black transition-all cursor-pointer border-2 ${
                  logForm.type === 'Keluar'
                    ? 'border-rose-500 bg-rose-50 text-rose-700 shadow-xs'
                    : 'border-[#e0e0e0] bg-white text-slate-500 hover:border-rose-200'
                }`}
              >
                Kas Keluar
              </button>
              <button
                type="button"
                onClick={() => setLogForm({ ...logForm, type: 'Masuk' })}
                className={`py-3 px-3 rounded-2xl text-xs font-black transition-all cursor-pointer border-2 ${
                  logForm.type === 'Masuk'
                    ? 'border-emerald-500 bg-emerald-50 text-emerald-700 shadow-xs'
                    : 'border-[#e0e0e0] bg-white text-slate-500 hover:border-emerald-200'
                }`}
              >
                Kas Masuk
              </button>
            </div>
          </div>

          <div className="p-5 border border-[#e0e0e0] rounded-2xl bg-[#f8f8f8]/50 flex flex-col gap-4">
            <span className="text-[10px] font-black text-[#5f1340] uppercase tracking-wider">2. Kategori Pengeluaran / Pemasukan</span>
            {visibleCategories.length === 0 ? (
              <p className="text-xs text-slate-400 font-medium">Tidak ada kategori untuk tipe ini.</p>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-[280px] overflow-y-auto pr-1">
                {visibleCategories.map(cat => (
                  <button
                    key={cat.id}
                    type="button"
                    onClick={() => setLogForm({ ...logForm, categoryId: cat.id })}
                    className={`p-3 rounded-xl text-left transition-all cursor-pointer border ${
                      String(logForm.categoryId) === String(cat.id)
                        ? 'border-[#5f1340] bg-[#5f1340]/5 shadow-xs'
                        : 'border-[#e0e0e0] bg-white hover:border-[#5f1340]/30'
                    }`}
                  >
                    <span className="text-xs font-black text-[#313030] block leading-snug">{cat.label}</span>
                  </button>
                ))}
              </div>
            )}
          </div>

          <div className="p-5 border border-[#e0e0e0] rounded-2xl bg-[#f8f8f8]/50 flex flex-col gap-4">
            <span className="text-[10px] font-black text-[#5f1340] uppercase tracking-wider">3. Nominal Transaksi</span>
            <input
              type="text"
              required
              placeholder="Contoh: 25.000"
              value={logForm.amount}
              onChange={(e) => setLogForm({ ...logForm, amount: formatRupiah(e.target.value) })}
              className="w-full px-4 py-3 border border-[#e0e0e0] rounded-xl bg-white font-black text-lg text-[#5f1340] outline-none focus:border-[#5f1340] focus:ring-1 focus:ring-[#5f1340]"
            />
            <div className="flex flex-wrap gap-2">
              {AMOUNT_PRESETS.map(amt => (
                <button
                  key={amt}
                  type="button"
                  onClick={() => setLogForm({ ...logForm, amount: formatRupiah(String(amt)) })}
                  className={`px-3 py-1.5 rounded-xl text-[11px] font-black transition-all cursor-pointer ${
                    numAmount === amt
                      ? 'bg-[#5f1340] text-white'
                      : 'bg-white border border-[#e0e0e0] text-slate-600 hover:border-[#5f1340]/40'
                  }`}
                >
                  Rp {(amt / 1000).toLocaleString('id-ID')}k
                </button>
              ))}
            </div>
          </div>
        </div>

        <div className="flex flex-col gap-5">
          <div className="p-5 border border-[#e0e0e0] rounded-2xl bg-[#f8f8f8]/50 flex flex-col gap-4 flex-1">
            <span className="text-[10px] font-black text-[#5f1340] uppercase tracking-wider">4. Keterangan / Keperluan</span>
            <textarea
              rows={5}
              required
              placeholder="Contoh: Beli tabung gas 12 kg untuk dapur outlet..."
              value={logForm.desc}
              onChange={(e) => setLogForm({ ...logForm, desc: e.target.value })}
              className="w-full px-4 py-3 border border-[#e0e0e0] rounded-xl bg-white text-xs font-bold outline-none focus:border-[#5f1340] resize-none flex-1 min-h-[120px]"
            />
          </div>

          <div className={`p-5 rounded-2xl border-2 flex flex-col gap-3 ${
            logForm.type === 'Keluar'
              ? 'border-rose-200 bg-gradient-to-br from-rose-50 to-white'
              : 'border-emerald-200 bg-gradient-to-br from-emerald-50 to-white'
          }`}>
            <span className="text-[10px] font-black text-[#5f1340] uppercase tracking-wider">Ringkasan Transaksi</span>
            <div className="space-y-2 text-xs">
              <div className="flex justify-between">
                <span className="text-slate-500 font-bold">Tipe</span>
                <span className={`font-black ${logForm.type === 'Keluar' ? 'text-rose-700' : 'text-emerald-700'}`}>{logForm.type}</span>
              </div>
              <div className="flex justify-between gap-4">
                <span className="text-slate-500 font-bold shrink-0">Kategori</span>
                <span className="font-black text-[#313030] text-right">{selectedCategory?.label || '-'}</span>
              </div>
              <div className="flex justify-between pt-2 border-t border-[#e0e0e0]/60">
                <span className="text-slate-500 font-bold">Nominal</span>
                <span className="font-black text-base text-[#5f1340]">
                  {logForm.type === 'Keluar' ? '- ' : '+ '}Rp {numAmount > 0 ? numAmount.toLocaleString('id-ID') : '0'}
                </span>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <button
              type="submit"
              disabled={isSubmitting}
              className="flex-1 py-3.5 bg-gradient-to-r from-[#5f1340] to-[#7d1956] hover:opacity-95 text-white font-black rounded-2xl text-xs shadow-lg shadow-[#5f1340]/25 transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-60"
            >
              <Save className="h-4 w-4" />
              <span>{isSubmitting ? 'Menyimpan...' : 'Simpan Kas'}</span>
            </button>
            <button
              type="button"
              onClick={() => {
                const firstOut = categories.find((c) => c.flow_type === 'Keluar');
                setLogForm(getDefaultForm(firstOut?.id || ''));
              }}
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
