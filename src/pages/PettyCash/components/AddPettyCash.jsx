import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { formatRupiah, parseRupiah } from '../../../utils/FormatRupiah.js';
import { formatEmployeeName } from '../../../utils/FormatName.js';
import { RotateCcw, Save, Paperclip, X } from 'lucide-react';

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
  const [evidenceFile, setEvidenceFile] = useState(null);
  const [evidencePreview, setEvidencePreview] = useState(null);
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

  useEffect(() => () => {
    if (evidencePreview) URL.revokeObjectURL(evidencePreview);
  }, [evidencePreview]);

  const visibleCategories = categories.filter((cat) => {
    if (logForm.type === 'Masuk') return cat.flow_type === 'Masuk';
    return cat.flow_type === 'Keluar';
  });

  const handleEvidenceChange = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (evidencePreview) URL.revokeObjectURL(evidencePreview);
    setEvidenceFile(file);
    setEvidencePreview(file.type.startsWith('image/') ? URL.createObjectURL(file) : null);
  };

  const clearEvidence = () => {
    if (evidencePreview) URL.revokeObjectURL(evidencePreview);
    setEvidenceFile(null);
    setEvidencePreview(null);
  };

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
      const fd = new FormData();
      fd.append('outletId', String(parseInt(activeOutletId, 10) || 2));
      fd.append('cashierEmployeeId', String(parseInt(localStorage.getItem('employeeId'), 10) || 167));
      const shiftId = localStorage.getItem('activeShiftId');
      if (shiftId) fd.append('shiftId', shiftId);
      fd.append('type', logForm.type);
      fd.append('category', selectedCategory?.label || selectedCategory?.name || '');
      fd.append('amount', String(numAmount));
      fd.append('description', logForm.desc || 'Pengajuan kas outlet');
      if (evidenceFile) fd.append('evidence', evidenceFile);

      const res = await axios.post('/api/petty-cash', fd, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });

      if (res.data?.success) {
        const created = res.data.data;
        onCashLogCreated({
          id: created.id,
          type: created.type,
          category: created.category,
          amount: parseFloat(created.amount) || numAmount,
          desc: created.description || 'Pengajuan kas outlet',
          status: created.status || 'Pengajuan',
          receiptPhotoUrl: created.receipt_photo_url || null,
          date: 'Baru saja',
          createdBy: formatEmployeeName(userProfile?.fullName, 'Staff Kasir')
        });
        showToast('Pengajuan Terkirim', res.data.message || 'Menunggu persetujuan.');
        const firstOut = categories.find((c) => c.flow_type === 'Keluar');
        setLogForm(getDefaultForm(firstOut?.id || ''));
        clearEvidence();
        setTimeout(() => onSwitchToDashboard(), 800);
      }
    } catch (err) {
      console.error('Gagal mengajukan kas kecil:', err);
      showToast('Gagal Ajukan', err.response?.data?.message || err.message, 'error');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <form onSubmit={handleSaveCashLog} className="flex flex-col gap-6 bg-white border border-[#e0e0e0] rounded-3xl p-6 shadow-xs w-full">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between border-b border-[#e0e0e0] pb-4 gap-3">
        <div>
          <h2 className="text-lg font-black text-[#313030]">Ajukan Transaksi Kas Laci</h2>
          <p className="text-xs text-slate-400">Saldo baru berubah setelah pengajuan disetujui</p>
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
            <span className="text-[10px] font-black text-[#5f1340] uppercase tracking-wider">2. Kategori</span>
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
            <span className="text-[10px] font-black text-[#5f1340] uppercase tracking-wider">3. Nominal</span>
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
            <span className="text-[10px] font-black text-[#5f1340] uppercase tracking-wider">4. Keterangan</span>
            <textarea
              rows={5}
              required
              placeholder="Contoh: Beli tabung gas 12 kg..."
              value={logForm.desc}
              onChange={(e) => setLogForm({ ...logForm, desc: e.target.value })}
              className="w-full px-4 py-3 border border-[#e0e0e0] rounded-xl bg-white text-xs font-bold outline-none focus:border-[#5f1340] resize-none flex-1 min-h-[120px]"
            />
          </div>

          <div className="p-5 border border-[#e0e0e0] rounded-2xl bg-[#f8f8f8]/50 flex flex-col gap-3">
            <span className="text-[10px] font-black text-[#5f1340] uppercase tracking-wider">5. Bukti Pengajuan</span>
            {evidenceFile ? (
              <div className="flex items-center gap-3 p-3 bg-white border border-[#e0e0e0] rounded-xl">
                {evidencePreview ? (
                  <img src={evidencePreview} alt="Bukti" className="h-14 w-14 object-cover rounded-lg border" />
                ) : (
                  <div className="h-14 w-14 rounded-lg bg-slate-100 flex items-center justify-center">
                    <Paperclip className="h-5 w-5 text-slate-400" />
                  </div>
                )}
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-black text-[#313030] truncate">{evidenceFile.name}</p>
                  <p className="text-[10px] text-slate-400">{(evidenceFile.size / 1024).toFixed(0)} KB</p>
                </div>
                <button type="button" onClick={clearEvidence} className="p-1.5 rounded-lg hover:bg-slate-100 cursor-pointer">
                  <X className="h-4 w-4 text-slate-500" />
                </button>
              </div>
            ) : (
              <label className="flex flex-col items-center justify-center gap-2 p-6 border-2 border-dashed border-[#e0e0e0] rounded-xl bg-white cursor-pointer hover:border-[#5f1340]/40 transition-colors">
                <Paperclip className="h-6 w-6 text-slate-400" />
                <span className="text-xs font-bold text-slate-500">Upload foto / PDF bukti</span>
                <input
                  type="file"
                  accept="image/jpeg,image/png,image/webp,application/pdf"
                  className="hidden"
                  onChange={handleEvidenceChange}
                />
              </label>
            )}
          </div>

          <div className="flex items-center gap-3">
            <button
              type="submit"
              disabled={isSubmitting}
              className="flex-1 py-3.5 bg-gradient-to-r from-[#5f1340] to-[#7d1956] hover:opacity-95 text-white font-black rounded-2xl text-xs shadow-lg shadow-[#5f1340]/25 transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-60"
            >
              <Save className="h-4 w-4" />
              <span>{isSubmitting ? 'Mengajukan...' : 'Ajukan'}</span>
            </button>
            <button
              type="button"
              onClick={() => {
                const firstOut = categories.find((c) => c.flow_type === 'Keluar');
                setLogForm(getDefaultForm(firstOut?.id || ''));
                clearEvidence();
              }}
              className="px-4 py-3.5 bg-white border border-[#e0e0e0] hover:bg-slate-50 text-slate-600 font-extrabold rounded-2xl text-xs transition-all cursor-pointer"
              title="Reset Form"
            >
              <RotateCcw className="h-4 w-4" />
            </button>
          </div>
        </div>
      </div>
    </form>
  );
}
