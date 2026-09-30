import React, { useState } from 'react';
import axios from 'axios';
import { Send, Search, User, FileText, MessageSquareText, Paperclip, X, ImageIcon } from 'lucide-react';

const authCfg = () => ({ headers: { Authorization: `Bearer ${localStorage.getItem('token') || ''}` } });

const field = 'w-full px-4 py-3 bg-white border border-[#e0e0e0] rounded-xl text-xs font-bold text-[#313030] outline-none focus:border-[#5f1340] focus:ring-1 focus:ring-[#5f1340] transition-all';

const EMPTY = {
  type_id: '',
  category_id: '',
  topic_id: '',
  nota_number: '',
  complaint_name: '',
  qty: 1,
  description: ''
};

const Section = ({ step, title, children }) => (
  <div className="p-5 border border-[#e0e0e0] rounded-2xl bg-[#f8f8f8]/50 flex flex-col gap-4">
    <span className="text-[10px] font-black text-[#5f1340] uppercase tracking-wider">{step}. {title}</span>
    {children}
  </div>
);

export default function AddComplaint({ meta, activeOutletId, activeOutletName, onSubmitted }) {
  const [form, setForm] = useState(EMPTY);
  const [notaHits, setNotaHits] = useState([]);
  const [showHits, setShowHits] = useState(false);
  const [notaItems, setNotaItems] = useState([]);
  const [pickedItems, setPickedItems] = useState([]);
  const [files, setFiles] = useState([]);
  const [previews, setPreviews] = useState([]);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  const set = (key) => (e) => setForm((f) => ({ ...f, [key]: e.target.value }));

  const searchNota = (value) => {
    setForm((f) => ({ ...f, nota_number: value }));
    setShowHits(false);
    if (!value.trim() || value.trim().length < 3) return;
    const timer = setTimeout(async () => {
      try {
        const res = await axios.get('/api/complaints/nota', { ...authCfg(), params: { q: value.trim() } });
        setNotaHits(res.data?.data || []);
        setShowHits(true);
      } catch {
        setNotaHits([]);
      }
    }, 350);
    return () => clearTimeout(timer);
  };

  const pickNota = async (row) => {
    setForm((f) => ({ ...f, nota_number: row.no_nota, complaint_name: row.customer_nama || f.complaint_name }));
    setNotaHits([]);
    setShowHits(false);
    setPickedItems([]);
    try {
      const res = await axios.get('/api/complaints/nota/items', { ...authCfg(), params: { nota: row.no_nota } });
      setNotaItems(res.data?.data || []);
    } catch {
      setNotaItems([]);
    }
  };

  const toggleItem = (id) =>
    setPickedItems((p) => (p.includes(id) ? p.filter((x) => x !== id) : [...p, id]));

  const handleFiles = (e) => {
    const picked = [...e.target.files].slice(0, 8);
    setFiles(picked);
    setPreviews(picked.filter((f) => f.type.startsWith('image/')).map((f) => URL.createObjectURL(f)));
  };

  const removeFile = (idx) => {
    const next = files.filter((_, i) => i !== idx);
    setFiles(next);
    setPreviews(next.filter((f) => f.type.startsWith('image/')).map((f) => URL.createObjectURL(f)));
  };

  const submit = async (e) => {
    e.preventDefault();
    setError('');
    setMessage('');
    if (!activeOutletId || activeOutletId === 'Semua') {
      setError('Pilih outlet spesifik di header dulu.');
      return;
    }
    const fd = new FormData();
    Object.entries(form).forEach(([k, v]) => fd.append(k, v));
    fd.append('outlet_id', activeOutletId);
    const picked = notaItems.filter((it) => pickedItems.includes(it.id));
    if (picked.length) {
      fd.append('description', `${picked.map((p) => `${p.service_name} (${p.qty} ${p.unit || 'pcs'})`).join(', ')}\n${form.description}`);
    }
    files.forEach((file) => fd.append('documents', file));
    setSaving(true);
    try {
      const res = await axios.post('/api/complaints/request', fd, authCfg());
      setMessage(res.data?.message || 'Pengajuan terkirim.');
      setForm(EMPTY);
      setFiles([]);
      setPreviews([]);
      setNotaHits([]);
      setNotaItems([]);
      setPickedItems([]);
      onSubmitted?.();
    } catch (err) {
      setError(err.response?.data?.message || 'Gagal mengirim pengajuan');
    } finally {
      setSaving(false);
    }
  };

  return (
    <form onSubmit={submit} className="flex flex-col gap-6 bg-white border border-[#e0e0e0] rounded-3xl p-6 shadow-xs w-full">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between border-b border-[#e0e0e0] pb-4 gap-3">
        <div>
          <h2 className="text-lg font-black text-[#313030]">Ajukan Komplain Pelanggan</h2>
          <p className="text-xs text-slate-400 mt-0.5">
            {activeOutletName ? `Cabang ${activeOutletName} · ` : ''}Status awal <span className="font-black text-orange-600">Request</span> — admin Alsa menyetujui jadi Open atau menolak jadi Archive
          </p>
        </div>
        {message && (
          <span className="px-4 py-2 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-700 text-xs font-black self-start sm:self-auto">
            {message}
          </span>
        )}
      </div>

      {error && (
        <div className="px-4 py-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs font-black">
          {error}
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="flex flex-col gap-5">
          <Section step="1" title="Klasifikasi Komplain">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <label className="flex flex-col gap-1.5">
                <span className="text-[10px] font-black text-slate-400 uppercase tracking-wider">Tipe</span>
                <select className={field} value={form.type_id} onChange={set('type_id')} required>
                  <option value="">Pilih tipe</option>
                  {(meta.types || []).map((t) => <option key={t.type_id} value={t.type_id}>{t.type_name}</option>)}
                </select>
              </label>
              <label className="flex flex-col gap-1.5">
                <span className="text-[10px] font-black text-slate-400 uppercase tracking-wider">Kategori Bahan</span>
                <select className={field} value={form.category_id} onChange={set('category_id')} required>
                  <option value="">Pilih kategori</option>
                  {(meta.categories || []).map((t) => <option key={t.category_id} value={t.category_id}>{t.category_name}</option>)}
                </select>
              </label>
              <label className="flex flex-col gap-1.5">
                <span className="text-[10px] font-black text-slate-400 uppercase tracking-wider">Topik</span>
                <select className={field} value={form.topic_id} onChange={set('topic_id')} required>
                  <option value="">Pilih topik</option>
                  {(meta.topics || []).map((t) => <option key={t.topic_id} value={t.topic_id}>{t.topic_name}</option>)}
                </select>
              </label>
            </div>
          </Section>

          <Section step="2" title="Pelanggan & Transaksi">
            <div className="flex flex-col gap-3">
              <label className="relative flex flex-col gap-1.5">
                <span className="text-[10px] font-black text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
                  <FileText className="h-3 w-3" /> Nomor Nota
                </span>
                <input
                  className={`${field} font-black tracking-wide`}
                  placeholder="Ketik minimal 3 digit — cari dari POS & nota lama"
                  value={form.nota_number}
                  onChange={(e) => searchNota(e.target.value)}
                  onFocus={() => { if (notaHits.length > 0) setShowHits(true); }}
                  required
                />
                {showHits && notaHits.length > 0 && (
                  <ul className="absolute z-20 top-full mt-1 w-full max-h-52 overflow-auto bg-white border border-[#e0e0e0] rounded-xl shadow-lg">
                    {notaHits.map((row) => (
                      <li key={row.no_nota}>
                        <button
                          type="button"
                          className="w-full text-left px-4 py-2.5 hover:bg-[#f8f8f8] cursor-pointer border-b border-[#e0e0e0]/60 last:border-0"
                          onClick={() => pickNota(row)}
                        >
                          <span className="block text-xs font-black text-[#313030]">{row.no_nota}</span>
                          {row.customer_nama && <span className="text-[11px] text-slate-400">{row.customer_nama}</span>}
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
              </label>
              {notaItems.length > 0 && (
                <div className="flex flex-col gap-1.5">
                  <span className="text-[10px] font-black text-slate-400 uppercase tracking-wider">Item yang Dikomplain (opsional)</span>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    {notaItems.map((it) => {
                      const active = pickedItems.includes(it.id);
                      return (
                        <button
                          key={it.id}
                          type="button"
                          onClick={() => toggleItem(it.id)}
                          className={`flex items-center justify-between gap-2 px-3 py-2 rounded-xl border text-left transition-all cursor-pointer ${
                            active ? 'border-[#5f1340] bg-[#5f1340]/5' : 'border-[#e0e0e0] bg-white hover:border-[#5f1340]/40'
                          }`}
                        >
                          <span className="text-xs font-bold text-[#313030] truncate">{it.service_name}</span>
                          <span className={`text-[10px] font-black whitespace-nowrap ${active ? 'text-[#5f1340]' : 'text-slate-400'}`}>
                            {it.qty} {it.unit || 'pcs'}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}
              <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
                <label className="flex flex-col gap-1.5 sm:col-span-3">
                  <span className="text-[10px] font-black text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
                    <User className="h-3 w-3" /> Nama Pelanggan
                  </span>
                  <input className={field} placeholder="Nama pelanggan" value={form.complaint_name} onChange={set('complaint_name')} required />
                </label>
                <label className="flex flex-col gap-1.5">
                  <span className="text-[10px] font-black text-slate-400 uppercase tracking-wider">Qty</span>
                  <input className={field} type="number" min="1" value={form.qty} onChange={set('qty')} />
                </label>
              </div>
            </div>
          </Section>

          <Section step="3" title="Kronologi">
            <label className="flex flex-col gap-1.5">
              <span className="text-[10px] font-black text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
                <MessageSquareText className="h-3 w-3" /> Jelaskan Kronologi Kejadian
              </span>
              <textarea
                rows={5}
                className="w-full px-4 py-3 border border-[#e0e0e0] rounded-xl bg-white text-xs font-bold outline-none focus:border-[#5f1340] focus:ring-1 focus:ring-[#5f1340] resize-none"
                placeholder="Contoh: Customer komplain selimut kembali dengan bau tidak hilang setelah pencucian…"
                value={form.description}
                onChange={set('description')}
                required
              />
            </label>
          </Section>
        </div>

        <div className="flex flex-col gap-5">
          <Section step="4" title="Bukti Foto / Dokumen (opsional, maks 8)">
            {files.length > 0 ? (
              <div className="grid grid-cols-3 gap-2">
                {files.map((file, idx) => (
                  <div key={`${file.name}-${idx}`} className="relative group">
                    <div className="h-20 rounded-xl border border-[#e0e0e0] bg-white flex items-center justify-center overflow-hidden">
                      {previews[idx] ? (
                        <img src={previews[idx]} alt={file.name} className="h-full w-full object-cover" />
                      ) : (
                        <Paperclip className="h-5 w-5 text-slate-400" />
                      )}
                    </div>
                    <button
                      type="button"
                      onClick={() => removeFile(idx)}
                      className="absolute -top-1.5 -right-1.5 h-5 w-5 rounded-full bg-rose-500 text-white flex items-center justify-center shadow cursor-pointer"
                      aria-label={`Hapus ${file.name}`}
                    >
                      <X className="h-3 w-3" />
                    </button>
                    <p className="text-[9px] font-bold text-slate-400 truncate mt-1">{file.name}</p>
                  </div>
                ))}
                {files.length < 8 && (
                  <label className="h-20 rounded-xl border-2 border-dashed border-[#e0e0e0] bg-white flex flex-col items-center justify-center gap-1 cursor-pointer hover:border-[#5f1340]/40 transition-colors">
                    <ImageIcon className="h-5 w-5 text-slate-400" />
                    <span className="text-[9px] font-black text-slate-400">Tambah</span>
                    <input type="file" accept="image/jpeg,image/png,image/webp,application/pdf,.heic,.heif" multiple className="hidden" onChange={handleFiles} />
                  </label>
                )}
              </div>
            ) : (
              <label className="flex flex-col items-center justify-center gap-2 p-8 border-2 border-dashed border-[#e0e0e0] rounded-xl bg-white cursor-pointer hover:border-[#5f1340]/40 transition-colors">
                <Paperclip className="h-6 w-6 text-slate-400" />
                <span className="text-xs font-bold text-slate-500">Upload foto bukti / PDF</span>
                <span className="text-[10px] text-slate-400">JPG, PNG, WEBP, PDF · maks 5 MB per file</span>
                <input type="file" accept="image/jpeg,image/png,image/webp,application/pdf,.heic,.heif" multiple className="hidden" onChange={handleFiles} />
              </label>
            )}
          </Section>

          <button
            type="submit"
            disabled={saving}
            className="py-3.5 bg-gradient-to-r from-[#5f1340] to-[#7d1956] hover:opacity-95 text-white font-black rounded-2xl text-xs shadow-lg shadow-[#5f1340]/25 transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-60"
          >
            <Send className="h-4 w-4" />
            {saving ? 'Mengirim…' : 'Kirim Pengajuan Komplain'}
          </button>
        </div>
      </div>
    </form>
  );
}
