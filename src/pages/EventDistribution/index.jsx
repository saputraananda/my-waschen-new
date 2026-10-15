import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import { Loader2, Search, Share2, Lock, CheckCircle2 } from 'lucide-react';
import HeaderNav from '../../components/HeaderNav';
import { isEventOutletId } from '../../utils/authSession.js';

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

/** Bagi item nota Event ke cabang produksi. Terkunci setelah pencucian dimulai di cabang. */
export default function EventDistribution() {
  const navigate = useNavigate();
  const [filter, setFilter] = useState('unassigned');
  const [search, setSearch] = useState('');
  const [items, setItems] = useState([]);
  const [summary, setSummary] = useState([]);
  const [branches, setBranches] = useState([]);
  const [targetOutlet, setTargetOutlet] = useState('');
  const [selected, setSelected] = useState(() => new Set());
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [activeOutletName, setActiveOutletName] = useState(localStorage.getItem('activeOutletName') || '');
  const [activeOutletId, setActiveOutletId] = useState(localStorage.getItem('activeOutletId') || '');
  // Event yang sedang didistribusikan (beberapa event bisa berjalan bersamaan)
  const [events, setEvents] = useState([]);
  const [eventId, setEventId] = useState(isEventOutletId(activeOutletId) ? String(activeOutletId) : '');

  useEffect(() => {
    document.title = 'Distribusi Event | Waschen Laundry';
    if (!localStorage.getItem('token')) navigate('/login', { replace: true });
  }, [navigate]);

  // Ganti outlet di header ke event lain -> halaman ikut pindah event
  useEffect(() => {
    if (isEventOutletId(activeOutletId)) setEventId(String(activeOutletId));
    axios.get('/api/event/list', authCfg())
      .then((res) => {
        const list = res.data?.data || [];
        setEvents(list);
        setEventId((cur) => (list.some((ev) => String(ev.id) === cur) ? cur : String(list[0]?.id || '')));
      })
      .catch(() => setEvents([]));
  }, [activeOutletId]);

  const load = useCallback(async () => {
    if (!eventId) {
      setItems([]);
      setSummary([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    setError('');
    try {
      const res = await axios.get('/api/event/items', { params: { eventOutletId: eventId, filter, search }, ...authCfg() });
      setItems(res.data?.data || []);
      setSummary(res.data?.summary || []);
      setSelected(new Set());
    } catch (err) {
      setError(err.response?.data?.message || 'Gagal memuat item event');
    } finally {
      setLoading(false);
    }
  }, [eventId, filter, search]);

  useEffect(() => {
    const t = setTimeout(load, search ? 300 : 0);
    return () => clearTimeout(t);
  }, [load, search]);

  useEffect(() => {
    axios.get('/api/event/outlets', authCfg())
      .then((res) => setBranches(res.data?.data || []))
      .catch(() => setBranches([]));
  }, []);

  const selectable = useMemo(() => items.filter((it) => !it.locked), [items]);
  const allSelected = selectable.length > 0 && selectable.every((it) => selected.has(it.id));

  const toggle = (id) => setSelected((prev) => {
    const next = new Set(prev);
    if (next.has(id)) next.delete(id); else next.add(id);
    return next;
  });
  const toggleAll = () => setSelected(allSelected ? new Set() : new Set(selectable.map((it) => it.id)));

  const grouped = useMemo(() => {
    const map = new Map();
    items.forEach((it) => {
      if (!map.has(it.transaction_id)) map.set(it.transaction_id, { head: it, rows: [] });
      map.get(it.transaction_id).rows.push(it);
    });
    return [...map.values()];
  }, [items]);

  const assign = async () => {
    if (!selected.size || !targetOutlet) return;
    setSaving(true);
    setError('');
    setNotice('');
    try {
      const res = await axios.post('/api/event/assign', { eventOutletId: Number(eventId), itemIds: [...selected], outletId: Number(targetOutlet) }, authCfg());
      await load();
      setNotice(res.data?.message || 'Berhasil dibagi');
    } catch (err) {
      setError(err.response?.data?.message || 'Gagal membagi item');
    } finally {
      setSaving(false);
    }
  };

  const unassignedCount = summary.find((s) => s.production_outlet_id == null)?.total_items || 0;

  return (
    <div className="min-h-screen bg-[#f8f8f8] text-[#313030] overflow-x-hidden">
      <HeaderNav
        activeOutletName={activeOutletName}
        setActiveOutletName={setActiveOutletName}
        activeOutletId={activeOutletId}
        setActiveOutletId={setActiveOutletId}
      />
      <main className="max-w-[1200px] w-full mx-auto p-3 sm:p-5 lg:p-6 flex flex-col gap-4">
        <div className="bg-white border border-[#e0e0e0] rounded-3xl p-4 sm:p-6">
          <h1 className="text-lg sm:text-2xl font-black flex items-center gap-2">
            <Share2 className="h-5 w-5 sm:h-6 sm:w-6 text-[#5f1340] shrink-0" />
            Distribusi Event ke Cabang
          </h1>
          {events.length > 1 ? (
            <select
              value={eventId}
              onChange={(e) => setEventId(e.target.value)}
              className="mt-3 w-full sm:w-auto rounded-xl border border-[#e0e0e0] bg-white px-3 py-2 text-sm font-bold outline-none"
              aria-label="Pilih event"
            >
              {events.map((ev) => (
                <option key={ev.id} value={String(ev.id)}>
                  {(ev.full_name || ev.name) + (ev.active ? '' : ' (selesai)')}
                </option>
              ))}
            </select>
          ) : events[0] ? (
            <p className="mt-1 text-sm font-extrabold text-[#5f1340]">{events[0].full_name || events[0].name}</p>
          ) : null}
          <p className="text-xs text-slate-400 mt-1">
            Pilih item, lalu tentukan cabang yang mengerjakan. Bisa diubah selama pencucian belum dimulai di cabang.
          </p>
          <div className="flex flex-wrap gap-2 mt-4">
            <span className="px-3 py-1.5 rounded-xl bg-amber-50 border border-amber-200 text-amber-800 text-xs font-extrabold">
              Belum dibagi: {unassignedCount}
            </span>
            {summary.filter((s) => s.production_outlet_id != null).map((s) => (
              <span key={s.production_outlet_id} className="px-3 py-1.5 rounded-xl bg-[#f8f8f8] border border-[#e0e0e0] text-xs font-bold">
                {s.outlet_name}: {s.done_items || 0}/{s.total_items} selesai
              </span>
            ))}
          </div>
        </div>

        <div className="bg-white border border-[#e0e0e0] rounded-3xl p-4 sm:p-6 flex flex-col gap-4">
          <div className="flex flex-col lg:flex-row gap-3 lg:items-center lg:justify-between">
            <div className="inline-flex rounded-2xl bg-[#f8f8f8] p-1 self-start">
              {FILTERS.map((f) => (
                <button
                  key={f.key}
                  type="button"
                  onClick={() => setFilter(f.key)}
                  className={`px-3 py-1.5 rounded-xl text-xs font-black cursor-pointer ${filter === f.key ? 'bg-[#5f1340] text-white' : 'text-slate-500'}`}
                >
                  {f.label}
                </button>
              ))}
            </div>
            <div className="relative lg:w-72">
              <Search className="h-4 w-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Cari nota / nama / HP"
                className="w-full pl-9 pr-3 py-2 rounded-xl border border-[#e0e0e0] text-sm outline-none focus:border-[#5f1340]/50"
              />
            </div>
          </div>

          <div className="flex flex-col sm:flex-row gap-2 sm:items-center p-3 rounded-2xl bg-[#5f1340]/5 border border-[#5f1340]/15">
            <label className="flex items-center gap-2 text-xs font-extrabold cursor-pointer">
              <input type="checkbox" checked={allSelected} onChange={toggleAll} disabled={!selectable.length} />
              Pilih semua ({selected.size} dipilih)
            </label>
            <select
              value={targetOutlet}
              onChange={(e) => setTargetOutlet(e.target.value)}
              className="sm:ml-auto rounded-xl border border-[#e0e0e0] bg-white px-3 py-2 text-sm font-bold outline-none"
              aria-label="Cabang tujuan"
            >
              <option value="">Pilih cabang tujuan…</option>
              {branches.map((b) => (
                <option key={b.id} value={b.id}>{b.full_name || b.name}</option>
              ))}
            </select>
            <button
              type="button"
              onClick={assign}
              disabled={saving || !selected.size || !targetOutlet}
              className="px-4 py-2 rounded-xl bg-[#5f1340] text-white text-sm font-black disabled:opacity-40 cursor-pointer inline-flex items-center justify-center gap-2"
            >
              {saving && <Loader2 className="h-4 w-4 animate-spin" />}
              Bagi ke cabang
            </button>
          </div>

          {error && <p className="text-sm font-bold text-rose-700 bg-rose-50 border border-rose-200 rounded-xl px-3 py-2">{error}</p>}
          {notice && <p className="text-sm font-bold text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-xl px-3 py-2">{notice}</p>}

          {loading ? (
            <div className="py-12 flex justify-center"><Loader2 className="h-6 w-6 animate-spin text-[#5f1340]" /></div>
          ) : !grouped.length ? (
            <p className="py-12 text-center text-sm text-slate-400">Tidak ada item event pada filter ini.</p>
          ) : (
            <div className="flex flex-col gap-3">
              {grouped.map(({ head, rows }) => (
                <div key={head.transaction_id} className="border border-[#e0e0e0] rounded-2xl overflow-hidden">
                  <div className="px-3 py-2 bg-[#f8f8f8] flex flex-wrap items-center gap-x-3 gap-y-1">
                    <span className="text-sm font-black">{head.order_no}</span>
                    <span className="text-xs text-slate-500 font-bold">{head.customer_name}</span>
                    <span className="text-[10px] px-2 py-0.5 rounded-lg bg-white border border-[#e0e0e0] font-extrabold">{head.payment_status}</span>
                  </div>
                  <ul className="divide-y divide-[#f0f0f0]">
                    {rows.map((it) => (
                      <li key={it.id} className="px-3 py-2 flex items-center gap-3">
                        <input
                          type="checkbox"
                          checked={selected.has(it.id)}
                          disabled={it.locked}
                          onChange={() => toggle(it.id)}
                          aria-label={`Pilih ${it.service_name}`}
                        />
                        <div className="min-w-0 flex-1">
                          <p className="text-sm font-bold truncate">{it.service_name}</p>
                          <p className="text-[11px] text-slate-400">{Number(it.qty)} {it.unit} · {it.item_work_status}</p>
                        </div>
                        {it.locked ? (
                          <span className="inline-flex items-center gap-1 text-[11px] font-extrabold text-slate-500">
                            <Lock className="h-3.5 w-3.5" /> {it.production_outlet_name || 'Diproses'}
                          </span>
                        ) : it.production_outlet_name ? (
                          <span className="inline-flex items-center gap-1 text-[11px] font-extrabold text-emerald-700">
                            <CheckCircle2 className="h-3.5 w-3.5" /> {it.production_outlet_name}
                          </span>
                        ) : (
                          <span className="text-[11px] font-extrabold text-amber-700">Belum dibagi</span>
                        )}
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
