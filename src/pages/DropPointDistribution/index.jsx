import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import {
  Loader2, Search, Share2, Lock, CheckCircle2, MapPin, User, Package, Inbox, Building2, Send, X, Clock, ChevronDown
} from 'lucide-react';
import HeaderNav from '../../components/HeaderNav';
import TablePagination, { usePagination } from '../History/components/TablePagination.jsx';
import { isDropPointOutletId } from '../../utils/authSession.js';

const authCfg = () => ({
  headers: {
    Authorization: `Bearer ${localStorage.getItem('token') || ''}`,
    'X-Active-Outlet-Id': localStorage.getItem('activeOutletId') || ''
  }
});

const FILTERS = [
  { key: 'unassigned', label: 'Belum Dibagi' },
  { key: 'assigned', label: 'Sudah Dibagi' },
  { key: 'all', label: 'Semua' }
];

const PAY_TONE = {
  Lunas: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  DP: 'bg-sky-50 text-sky-700 border-sky-200',
  Outstanding: 'bg-amber-50 text-amber-800 border-amber-200'
};

const CHECK_CLS = 'h-4 w-4 shrink-0 rounded border-slate-300 accent-[#5f1340] cursor-pointer disabled:cursor-not-allowed disabled:opacity-40';

const fmtQty = (n) => Number(n || 0).toLocaleString('id-ID', { maximumFractionDigits: 2 });

/**
 * Bagi item nota Drop Point ke cabang produksi (atau kembalikan ke drop point).
 * Terkunci setelah item dicuci (boleh dibagi saat Antrean atau sesudah QC awal / Pencucian).
 */
export default function DropPointDistribution() {
  const navigate = useNavigate();
  const [filter, setFilter] = useState('unassigned');
  const [search, setSearch] = useState('');
  const [items, setItems] = useState([]);
  const [summary, setSummary] = useState([]);
  const [branches, setBranches] = useState([]);
  const [targetOutlet, setTargetOutlet] = useState('');
  const [selected, setSelected] = useState(() => new Set());
  // Nota yang item-nya sedang dibuka (default tertutup: fokus ke nota, customer, alamat)
  const [expanded, setExpanded] = useState(() => new Set());
  const toggleExpand = (id) => setExpanded((prev) => {
    const next = new Set(prev);
    if (next.has(id)) next.delete(id); else next.add(id);
    return next;
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [activeOutletName, setActiveOutletName] = useState(localStorage.getItem('activeOutletName') || '');
  const [activeOutletId, setActiveOutletId] = useState(localStorage.getItem('activeOutletId') || '');
  // Drop Point yang sedang didistribusikan (beberapa drop point bisa aktif bersamaan)
  const [dropPoints, setDropPoints] = useState([]);
  const [dropPointId, setDropPointId] = useState(isDropPointOutletId(activeOutletId) ? String(activeOutletId) : '');
  const [userProfile] = useState(() => ({
    fullName: localStorage.getItem('fullName') || 'Kasir Waschen',
    role: localStorage.getItem('companyId') === '1' ? 'Management Alora' : (localStorage.getItem('activeRole') || 'Staff Kasir')
  }));

  useEffect(() => {
    document.title = 'Distribusi Drop Point | Waschen Laundry';
    if (!localStorage.getItem('token')) navigate('/login', { replace: true });
  }, [navigate]);

  // Ganti outlet di header ke drop point lain -> halaman ikut pindah drop point
  useEffect(() => {
    if (isDropPointOutletId(activeOutletId)) setDropPointId(String(activeOutletId));
    axios.get('/api/drop-point/list', authCfg())
      .then((res) => {
        const list = res.data?.data || [];
        setDropPoints(list);
        setDropPointId((cur) => (list.some((dp) => String(dp.id) === cur) ? cur : String(list[0]?.id || '')));
      })
      .catch(() => setDropPoints([]));
  }, [activeOutletId]);

  const load = useCallback(async () => {
    if (!dropPointId) {
      setItems([]);
      setSummary([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    setError('');
    try {
      const res = await axios.get('/api/drop-point/items', { params: { dropPointOutletId: dropPointId, filter, search }, ...authCfg() });
      setItems(res.data?.data || []);
      setSummary(res.data?.summary || []);
      setSelected(new Set());
    } catch (err) {
      setError(err.response?.data?.message || 'Gagal memuat item Drop Point');
    } finally {
      setLoading(false);
    }
  }, [dropPointId, filter, search]);

  useEffect(() => {
    const t = setTimeout(load, search ? 300 : 0);
    return () => clearTimeout(t);
  }, [load, search]);

  useEffect(() => {
    axios.get('/api/drop-point/outlets', authCfg())
      .then((res) => setBranches(res.data?.data || []))
      .catch(() => setBranches([]));
  }, []);

  // Notifikasi sukses hilang sendiri
  useEffect(() => {
    if (!notice) return undefined;
    const t = setTimeout(() => setNotice(''), 4000);
    return () => clearTimeout(t);
  }, [notice]);

  const selectable = useMemo(() => items.filter((it) => !it.locked), [items]);
  const allSelected = selectable.length > 0 && selectable.every((it) => selected.has(it.id));

  const toggle = (id) => setSelected((prev) => {
    const next = new Set(prev);
    if (next.has(id)) next.delete(id); else next.add(id);
    return next;
  });
  const toggleAll = () => setSelected(allSelected ? new Set() : new Set(selectable.map((it) => it.id)));
  // Klik satu nota -> pilih / batal pilih semua item nota itu yang belum terkunci
  const toggleNota = (rows) => setSelected((prev) => {
    const ids = rows.filter((it) => !it.locked).map((it) => it.id);
    const next = new Set(prev);
    if (ids.every((id) => next.has(id))) ids.forEach((id) => next.delete(id));
    else ids.forEach((id) => next.add(id));
    return next;
  });

  const grouped = useMemo(() => {
    const map = new Map();
    items.forEach((it) => {
      if (!map.has(it.transaction_id)) map.set(it.transaction_id, { head: it, rows: [] });
      map.get(it.transaction_id).rows.push(it);
    });
    return [...map.values()];
  }, [items]);

  // Pagination per nota; kembali ke halaman 1 saat filter / pencarian / drop point berubah
  const pagination = usePagination(grouped, `${filter}|${search}|${dropPointId}`, 10);

  const assign = async () => {
    if (!selected.size || !targetOutlet) return;
    setSaving(true);
    setError('');
    setNotice('');
    try {
      const res = await axios.post('/api/drop-point/assign', { dropPointOutletId: Number(dropPointId), itemIds: [...selected], outletId: Number(targetOutlet) }, authCfg());
      await load();
      setNotice(res.data?.message || 'Berhasil dibagi');
    } catch (err) {
      setError(err.response?.data?.message || 'Gagal membagi item');
    } finally {
      setSaving(false);
    }
  };

  const branchSummary = summary.filter((s) => s.production_outlet_id != null);
  const currentDropPoint = dropPoints.find((dp) => String(dp.id) === String(dropPointId)) || dropPoints[0] || null;

  return (
    <div className="min-h-screen bg-[#f8f8f8] text-[#313030] overflow-x-hidden flex flex-col">
      <HeaderNav
        activeOutletName={activeOutletName}
        setActiveOutletName={setActiveOutletName}
        activeOutletId={activeOutletId}
        setActiveOutletId={setActiveOutletId}
        userProfile={userProfile}
      />
      <main className="max-w-[1500px] w-full min-w-0 mx-auto p-3 sm:p-6 flex-grow flex flex-col gap-4 sm:gap-5">
        {/* ── Header sederhana: judul, drop point, ringkasan ── */}
        <section className="bg-white border border-[#e9e9e9] rounded-3xl p-4 sm:p-5 flex flex-col gap-3">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <h1 className="flex items-center gap-2.5 min-w-0 text-lg sm:text-xl font-black">
              <span className="h-9 w-9 shrink-0 rounded-xl bg-[#5f1340]/10 text-[#5f1340] flex items-center justify-center">
                <Share2 className="h-[18px] w-[18px]" />
              </span>
              Distribusi Drop Point
            </h1>
            {dropPoints.length > 1 ? (
              <select
                value={dropPointId}
                onChange={(e) => setDropPointId(e.target.value)}
                className="w-full sm:w-auto sm:min-w-[240px] rounded-xl border border-[#e0e0e0] bg-white px-3 py-2.5 text-sm font-bold outline-none focus:border-[#5f1340] cursor-pointer"
                aria-label="Pilih Drop Point"
              >
                {dropPoints.map((dp) => (
                  <option key={dp.id} value={String(dp.id)}>
                    {(dp.full_name || dp.name) + (dp.active ? '' : ' (nonaktif)')}
                  </option>
                ))}
              </select>
            ) : currentDropPoint ? (
              <span className="inline-flex items-center gap-1.5 self-start sm:self-auto text-sm font-extrabold text-[#5f1340]">
                <Building2 className="h-4 w-4" />
                {currentDropPoint.full_name || currentDropPoint.name}
              </span>
            ) : null}
          </div>

          {branchSummary.length > 0 && (
            <div className="flex flex-wrap gap-2">
              {branchSummary.map((s) => (
                <span key={s.production_outlet_id} className="px-3 py-1.5 rounded-xl bg-[#f8f8f8] border border-[#e0e0e0] text-xs font-bold">
                  {s.outlet_name}: {s.done_items || 0}/{s.total_items} selesai
                </span>
              ))}
            </div>
          )}
        </section>

        {/* ── Daftar item ── */}
        <section className="bg-white border border-[#e9e9e9] rounded-3xl p-3 sm:p-5 flex flex-col gap-4 shadow-[0_2px_16px_rgba(0,0,0,0.03)]">
          <div className="flex flex-col lg:flex-row gap-3 lg:items-center lg:justify-between">
            <div className="grid grid-cols-3 sm:inline-flex rounded-2xl bg-[#f4f4f5] p-1 self-stretch sm:self-start">
              {FILTERS.map((f) => (
                <button
                  key={f.key}
                  type="button"
                  onClick={() => setFilter(f.key)}
                  aria-pressed={filter === f.key}
                  className={`px-3 sm:px-4 py-2 rounded-xl text-xs font-black cursor-pointer transition-all ${
                    filter === f.key ? 'bg-[#5f1340] text-white shadow-sm' : 'text-slate-500 hover:text-[#5f1340]'
                  }`}
                >
                  {f.label}
                </button>
              ))}
            </div>
            <div className="relative lg:w-80">
              <Search className="h-4 w-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Cari nota / nama / HP"
                className="w-full pl-10 pr-9 py-2.5 rounded-2xl border border-[#e5e5e5] bg-[#fafafa] text-sm outline-none focus:bg-white focus:border-[#5f1340]/40 focus:ring-4 focus:ring-[#5f1340]/5 transition"
              />
              {search && (
                <button type="button" onClick={() => setSearch('')} aria-label="Hapus pencarian"
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 h-6 w-6 rounded-full text-slate-400 hover:bg-slate-100 flex items-center justify-center cursor-pointer">
                  <X className="h-3.5 w-3.5" />
                </button>
              )}
            </div>
          </div>

          {/* Pilih semua */}
          {!loading && selectable.length > 0 && (
            <label className="flex items-center gap-2.5 px-1 text-xs font-extrabold text-slate-600 cursor-pointer select-none">
              <input type="checkbox" className={CHECK_CLS} checked={allSelected} onChange={toggleAll} />
              Pilih semua item yang bisa dibagi
              <span className="text-slate-400 font-bold">({selectable.length})</span>
            </label>
          )}

          {error && <p className="text-sm font-bold text-rose-700 bg-rose-50 border border-rose-200 rounded-2xl px-4 py-2.5">{error}</p>}
          {notice && (
            <p className="flex items-center gap-2 text-sm font-bold text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-2xl px-4 py-2.5">
              <CheckCircle2 className="h-4 w-4 shrink-0" /> {notice}
            </p>
          )}

          {loading ? (
            <div className="flex flex-col gap-3">
              {[0, 1, 2].map((i) => <div key={i} className="h-32 rounded-2xl bg-[#f4f4f5] animate-pulse" />)}
            </div>
          ) : !grouped.length ? (
            <div className="py-14 flex flex-col items-center text-center">
              <span className="h-14 w-14 rounded-2xl bg-[#5f1340]/5 text-[#5f1340]/60 flex items-center justify-center">
                <Inbox className="h-7 w-7" />
              </span>
              <p className="mt-3 text-sm font-black text-slate-600">Tidak ada item di sini</p>
              <p className="text-xs text-slate-400">
                {search ? 'Coba kata kunci lain.' : filter === 'unassigned' ? 'Semua item sudah dibagi ke cabang.' : 'Belum ada item pada filter ini.'}
              </p>
            </div>
          ) : (
            <div className="flex flex-col gap-3">
              {pagination.pageItems.map(({ head, rows }) => {
                const open = rows.filter((it) => !it.locked);
                const picked = open.filter((it) => selected.has(it.id)).length;
                const notaChecked = open.length > 0 && picked === open.length;
                const isOpen = expanded.has(head.transaction_id);
                const waiting = rows.filter((it) => !it.production_outlet_name && !it.locked).length;
                const kg = rows.reduce((t, it) => t + (String(it.unit || '').toLowerCase() === 'kg' ? Number(it.qty) || 0 : 0), 0);
                return (
                  <article
                    key={head.transaction_id}
                    className={`rounded-2xl border overflow-hidden transition-all ${
                      picked ? 'border-[#5f1340]/40 shadow-[0_6px_20px_-10px_rgba(95,19,64,0.45)]' : 'border-[#ececec] hover:border-[#5f1340]/20'
                    }`}
                  >
                    <div
                      className={`flex items-start gap-3 px-3.5 sm:px-4 py-3 transition-colors ${
                        picked ? 'bg-[#5f1340]/[0.06]' : 'bg-white hover:bg-[#fafafa]'
                      }`}
                    >
                      <input
                        type="checkbox"
                        className={`${CHECK_CLS} mt-1`}
                        checked={notaChecked}
                        ref={(el) => { if (el) el.indeterminate = picked > 0 && !notaChecked; }}
                        disabled={!open.length}
                        onChange={() => toggleNota(rows)}
                        aria-label={`Pilih semua item nota ${head.order_no}`}
                      />
                      <button
                        type="button"
                        onClick={() => toggleExpand(head.transaction_id)}
                        aria-expanded={isOpen}
                        className="min-w-0 flex-1 flex items-start gap-3 text-left cursor-pointer"
                      >
                        <div className="min-w-0 flex-1">
                          <div className="flex flex-wrap items-center gap-x-2.5 gap-y-1.5">
                            <span className="font-mono text-[13px] sm:text-sm font-black tracking-tight text-[#313030]">{head.order_no}</span>
                            <span className={`text-[10px] px-2 py-0.5 rounded-full border font-black ${PAY_TONE[head.payment_status] || 'bg-slate-50 text-slate-600 border-slate-200'}`}>
                              {head.payment_status}
                            </span>
                            {picked > 0 && (
                              <span className="text-[10px] px-2 py-0.5 rounded-full bg-[#5f1340] text-white font-black">
                                {picked}/{open.length} dipilih
                              </span>
                            )}
                          </div>
                          <p className="mt-1.5 flex items-center gap-1.5 text-sm sm:text-[15px] font-extrabold text-[#313030] min-w-0">
                            <User className="h-3.5 w-3.5 shrink-0 text-[#5f1340]/60" />
                            <span className="break-words">{head.customer_name || '-'}</span>
                          </p>
                          <p className="mt-0.5 flex items-start gap-1.5 text-xs sm:text-[13px] text-slate-500 min-w-0">
                            <MapPin className="h-3.5 w-3.5 shrink-0 mt-px text-slate-400" />
                            <span className="break-words">{head.customer_address || 'Alamat belum diisi'}</span>
                          </p>
                        </div>
                        <div className="shrink-0 flex flex-col items-end gap-1.5">
                          <span className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-2.5 py-1 text-[10px] sm:text-[11px] font-black text-slate-600">
                            {rows.length} item{kg ? ` · ${fmtQty(kg)} kg` : ''}
                            <ChevronDown className={`h-3.5 w-3.5 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
                          </span>
                          {waiting > 0 ? (
                            <span className="rounded-full bg-amber-50 border border-amber-100 px-2 py-0.5 text-[10px] font-extrabold text-amber-700 whitespace-nowrap">{waiting} belum dibagi</span>
                          ) : (
                            <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 border border-emerald-100 px-2 py-0.5 text-[10px] font-extrabold text-emerald-700 whitespace-nowrap">
                              <CheckCircle2 className="h-3 w-3" /> Sudah dibagi
                            </span>
                          )}
                        </div>
                      </button>
                    </div>

                    {isOpen && (
                    <ul className="divide-y divide-[#f2f2f2] bg-white border-t border-[#f2f2f2]">
                      {rows.map((it) => {
                        const isPicked = selected.has(it.id);
                        return (
                          <li key={it.id}>
                            <label className={`flex items-center gap-3 px-3.5 sm:px-4 py-2.5 transition-colors ${
                              it.locked ? 'cursor-not-allowed' : 'cursor-pointer hover:bg-[#5f1340]/[0.03]'
                            } ${isPicked ? 'bg-[#5f1340]/[0.04]' : ''}`}>
                              <input
                                type="checkbox"
                                className={CHECK_CLS}
                                checked={isPicked}
                                disabled={it.locked}
                                onChange={() => toggle(it.id)}
                                aria-label={`Pilih ${it.service_name}`}
                              />
                              <span className="hidden min-[420px]:flex h-8 w-8 shrink-0 rounded-xl bg-[#f4f4f5] text-slate-500 items-center justify-center">
                                <Package className="h-4 w-4" />
                              </span>
                              <div className="min-w-0 flex-1">
                                <p className="text-sm font-bold text-[#313030] truncate">{it.service_name}</p>
                                <p className="mt-0.5 flex flex-wrap items-center gap-1.5 text-[11px] text-slate-500">
                                  <span className="font-black text-slate-600 tabular-nums">{fmtQty(it.qty)} {it.unit}</span>
                                  <span className="text-slate-300">•</span>
                                  <span className="inline-flex items-center gap-1"><Clock className="h-3 w-3" />{it.item_work_status}</span>
                                </p>
                              </div>
                              {it.locked ? (
                                <span className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-2.5 py-1 text-[10px] sm:text-[11px] font-extrabold text-slate-500 max-w-[45%] truncate">
                                  <Lock className="h-3 w-3 shrink-0" /> <span className="truncate">{it.production_outlet_name || 'Diproses di drop point'}</span>
                                </span>
                              ) : it.production_outlet_name ? (
                                <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 border border-emerald-100 px-2.5 py-1 text-[10px] sm:text-[11px] font-extrabold text-emerald-700 max-w-[45%] truncate">
                                  <CheckCircle2 className="h-3 w-3 shrink-0" /> <span className="truncate">{it.production_outlet_name}</span>
                                </span>
                              ) : (
                                <span className="rounded-full bg-amber-50 border border-amber-100 px-2.5 py-1 text-[10px] sm:text-[11px] font-extrabold text-amber-700 whitespace-nowrap">
                                  Belum dibagi
                                </span>
                              )}
                            </label>
                          </li>
                        );
                      })}
                    </ul>
                    )}
                  </article>
                );
              })}
            </div>
          )}

          {!loading && grouped.length > 0 && (
            <TablePagination pagination={pagination} unit="nota" />
          )}
        </section>
      </main>

      {/* ── Bar aksi melayang: muncul saat ada item dipilih ── */}
      {selected.size > 0 && (
        <div className="sticky bottom-0 z-30 px-3 sm:px-6 pb-[max(0.75rem,env(safe-area-inset-bottom))] pt-2">
          <div className="max-w-[1500px] mx-auto rounded-2xl sm:rounded-3xl bg-[#2a0a1d]/95 backdrop-blur text-white shadow-[0_16px_40px_-12px_rgba(42,10,29,0.7)] ring-1 ring-white/10 p-3 sm:p-3.5 flex flex-col sm:flex-row sm:items-center gap-2.5 sm:gap-3">
            <div className="flex items-center justify-between sm:justify-start gap-3 min-w-0">
              <span className="inline-flex items-center gap-2 text-sm font-black">
                <span className="h-7 min-w-[1.75rem] px-1.5 rounded-lg bg-[#f3d27a] text-[#2a0a1d] text-xs font-black flex items-center justify-center tabular-nums">
                  {selected.size}
                </span>
                item dipilih
              </span>
              <button type="button" onClick={() => setSelected(new Set())}
                className="text-[11px] font-bold text-white/60 hover:text-white underline-offset-2 hover:underline cursor-pointer">
                Batal pilih
              </button>
            </div>
            <div className="flex flex-col min-[480px]:flex-row gap-2 sm:ml-auto sm:min-w-[440px]">
              <select
                value={targetOutlet}
                onChange={(e) => setTargetOutlet(e.target.value)}
                className="flex-1 min-w-0 rounded-xl bg-white text-[#313030] px-3 py-2.5 text-sm font-bold outline-none cursor-pointer"
                aria-label="Cabang tujuan"
              >
                <option value="">Pilih cabang tujuan…</option>
                {dropPointId && (
                  <option value={dropPointId}>Kerjakan di drop point (tidak dibagi)</option>
                )}
                {branches.map((b) => (
                  <option key={b.id} value={b.id}>{b.full_name || b.name}</option>
                ))}
              </select>
              <button
                type="button"
                onClick={assign}
                disabled={saving || !targetOutlet}
                className="px-5 py-2.5 rounded-xl bg-gradient-to-r from-[#f3d27a] to-[#d4a937] text-[#2a0a1d] text-sm font-black disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer inline-flex items-center justify-center gap-2 shadow-[0_6px_18px_-6px_rgba(212,169,55,0.8)] whitespace-nowrap"
              >
                {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                Bagi ke cabang
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
