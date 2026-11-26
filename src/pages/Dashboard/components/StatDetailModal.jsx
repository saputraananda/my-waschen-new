import React, { useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import axios from 'axios';
import { useNavigate } from 'react-router-dom';
import { Banknote, CalendarDays, ChevronRight, CreditCard, Loader2, Receipt, Search, Wallet, X } from 'lucide-react';
import DateModeFilter from '../../../components/DateModeFilter.jsx';
import { getCutoffMonthKey, toDateKey, formatDateKeyId } from '../../../utils/dateCutoffFilter.js';
import { resolveStatDateRange } from '../../../utils/dailyTargetCarry.js';
import { formatName } from '../../../utils/FormatName.js';

/*
 * Modal rincian kartu Ringkasan Operasional (Dashboard POS):
 *  - RevenueDetailModal  : semua pembayaran satu periode (default cutoff berjalan)
 *  - TodayPaymentsModal  : pembayaran hari ini (termasuk pelunasan nota lama)
 *  - PiutangDetailModal  : nota belum lunas (default cutoff berjalan, bisa semua periode / range)
 * HP: layar penuh + daftar kartu. Desktop: jendela lebar + tabel.
 */

const PAGE = 50;
const fmtRp = (v) => `Rp ${Math.round(Number(v) || 0).toLocaleString('id-ID')}`;
const fmtNum = (v) => (Number(v) || 0).toLocaleString('id-ID');
const fmtDateTime = (v) => (v
  ? new Date(v).toLocaleString('id-ID', { timeZone: 'Asia/Jakarta', day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })
  : '-');
const fmtDate = (v) => (v
  ? new Date(v).toLocaleDateString('id-ID', { timeZone: 'Asia/Jakarta', day: '2-digit', month: 'short', year: 'numeric' })
  : '-');
const fmtShortDate = (v) => (v
  ? new Date(v).toLocaleDateString('id-ID', { timeZone: 'Asia/Jakarta', day: 'numeric', month: 'short' })
  : '-');
const fmtTime = (v) => (v
  ? new Date(v).toLocaleTimeString('id-ID', { timeZone: 'Asia/Jakarta', hour: '2-digit', minute: '2-digit' })
  : '-');
const wibDateKey = (v) => (v ? new Date(v).toLocaleDateString('en-CA', { timeZone: 'Asia/Jakarta' }) : '');
const pct = (part, total) => (total > 0 ? Math.round((part / total) * 100) : 0);

/** Warna per metode bayar (dot, segmen bar, label). */
function methodTone(name) {
  const n = String(name || '').toLowerCase();
  if (/tunai|cash/.test(n)) return { dot: 'bg-emerald-500', soft: 'bg-emerald-50 text-emerald-700', bar: '#10b981' };
  if (/qris/.test(n)) return { dot: 'bg-violet-500', soft: 'bg-violet-50 text-violet-700', bar: '#8b5cf6' };
  if (/transfer/.test(n)) return { dot: 'bg-sky-500', soft: 'bg-sky-50 text-sky-700', bar: '#0ea5e9' };
  if (/edc|debit|kredit|card/.test(n)) return { dot: 'bg-amber-500', soft: 'bg-amber-50 text-amber-700', bar: '#f59e0b' };
  if (/saldo|member|deposit/.test(n)) return { dot: 'bg-rose-500', soft: 'bg-rose-50 text-rose-700', bar: '#f43f5e' };
  return { dot: 'bg-slate-400', soft: 'bg-slate-100 text-slate-600', bar: '#94a3b8' };
}

/* ───────────────────────── kerangka modal ───────────────────────── */

function ModalShell({ open, onClose, title, subtitle, icon: Icon, children }) {
  useEffect(() => {
    if (!open) return undefined;
    const onKey = (e) => { if (e.key === 'Escape') onClose(); };
    // Kunci scroll halaman di belakang (body + kontainer scroll dashboard)
    const prevBody = document.body.style.overflow;
    const prevHtml = document.documentElement.style.overflow;
    document.body.style.overflow = 'hidden';
    document.documentElement.style.overflow = 'hidden';
    document.addEventListener('keydown', onKey);
    return () => {
      document.body.style.overflow = prevBody;
      document.documentElement.style.overflow = prevHtml;
      document.removeEventListener('keydown', onKey);
    };
  }, [open, onClose]);

  if (!open) return null;
  // Portal ke <body>: lepas dari kontainer scroll / transform dashboard
  return createPortal(
    <div
      className="fixed inset-0 z-[125] bg-[#1f0a15]/60 backdrop-blur-[2px] flex items-stretch sm:items-center justify-center sm:p-6"
      onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div
        role="dialog"
        aria-modal="true"
        className="bg-[#f6f3f1] w-full h-[100dvh] sm:h-[min(88dvh,860px)] sm:max-w-5xl sm:rounded-[28px] shadow-2xl flex flex-col min-h-0 overflow-hidden"
      >
        <div className="relative shrink-0 overflow-hidden bg-gradient-to-br from-[#5f1340] via-[#4a0d31] to-[#2a0419] text-white px-4 sm:px-7 pt-[max(14px,env(safe-area-inset-top))] pb-4 sm:py-5">
          <div className="pointer-events-none absolute -right-10 -top-16 h-44 w-44 rounded-full bg-white/[0.06]" />
          <div className="pointer-events-none absolute right-24 -bottom-20 h-36 w-36 rounded-full bg-[#e3b65c]/10" />
          <div className="relative flex items-center gap-3">
            {Icon && (
              <span className="h-11 w-11 rounded-2xl bg-white/10 ring-1 ring-white/15 grid place-items-center shrink-0">
                <Icon className="h-5 w-5 text-[#f3d9a4]" />
              </span>
            )}
            <div className="min-w-0 flex-1">
              <h2 className="text-lg sm:text-xl font-black leading-tight tracking-tight">{title}</h2>
              {subtitle && <p className="text-xs sm:text-[13px] text-white/70 font-medium mt-0.5 truncate">{subtitle}</p>}
            </div>
            <button
              type="button"
              onClick={onClose}
              aria-label="Tutup"
              className="h-10 w-10 rounded-full grid place-items-center bg-white/10 hover:bg-white/20 ring-1 ring-white/15 shrink-0 cursor-pointer transition-colors"
            >
              <X className="h-5 w-5" />
            </button>
          </div>
        </div>
        <div className="flex-1 min-h-0 overflow-y-auto overscroll-contain px-4 sm:px-7 py-4 sm:py-5 pb-[max(20px,env(safe-area-inset-bottom))]">
          <div className="flex flex-col gap-3.5">{children}</div>
        </div>
      </div>
    </div>,
    document.body
  );
}

/* ───────────────────────── potongan UI bersama ───────────────────────── */

function Chip({ active, onClick, dot, children }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={`shrink-0 whitespace-nowrap inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-[11.5px] font-bold transition-all cursor-pointer ${
        active
          ? 'border-[#5f1340] bg-[#5f1340] text-white shadow-[0_6px_14px_-8px_rgba(95,19,64,0.7)]'
          : 'border-[#e6dcd5] bg-white text-slate-600 hover:border-[#5f1340]/40 hover:text-[#5f1340]'
      }`}
    >
      {dot && <span className={`h-2 w-2 rounded-full ${dot} ${active ? 'ring-2 ring-white/60' : ''}`} />}
      {children}
    </button>
  );
}

function SearchBox({ value, onChange, placeholder }) {
  return (
    <div className="relative">
      <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400 pointer-events-none" />
      <input
        type="text"
        inputMode="search"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="w-full h-11 pl-10 pr-10 rounded-2xl border border-[#e6dcd5] bg-white text-base sm:text-sm font-medium text-[#313030] outline-none focus:border-[#5f1340] focus:ring-2 focus:ring-[#5f1340]/10 placeholder:text-slate-400"
      />
      {value && (
        <button
          type="button"
          onClick={() => onChange('')}
          aria-label="Hapus pencarian"
          className="absolute right-2.5 top-1/2 -translate-y-1/2 h-7 w-7 grid place-items-center rounded-full text-slate-400 hover:bg-slate-100 cursor-pointer"
        >
          <X className="h-3.5 w-3.5" />
        </button>
      )}
    </div>
  );
}

function StateBox({ loading, error, empty }) {
  if (loading) {
    return (
      <div className="flex items-center justify-center gap-2 py-14 text-sm font-semibold text-slate-400">
        <Loader2 className="h-5 w-5 animate-spin text-[#5f1340]" /> Memuat data…
      </div>
    );
  }
  if (error) return <div className="rounded-2xl border border-rose-200 bg-rose-50 p-4 text-center text-xs font-semibold text-rose-700">{error}</div>;
  if (empty) {
    return (
      <div className="rounded-2xl border border-dashed border-[#e0d4cb] bg-white/70 py-12 text-center">
        <Receipt className="mx-auto h-8 w-8 text-slate-300" />
        <p className="mt-2 text-xs font-semibold text-slate-400">{empty}</p>
      </div>
    );
  }
  return null;
}

function MoreButton({ shown, total, onMore }) {
  if (shown >= total) return null;
  return (
    <button
      type="button"
      onClick={onMore}
      className="w-full py-3 rounded-2xl border border-[#e6dcd5] bg-white text-xs font-black text-[#5f1340] hover:bg-[#5f1340]/[0.03] cursor-pointer"
    >
      Tampilkan {Math.min(PAGE, total - shown)} lagi · {fmtNum(shown)} dari {fmtNum(total)}
    </button>
  );
}

const STATUS_TONE = {
  DP: 'bg-amber-50 text-amber-700 ring-amber-200',
  Lunas: 'bg-emerald-50 text-emerald-700 ring-emerald-200',
  Pelunasan: 'bg-sky-50 text-sky-700 ring-sky-200',
  Outstanding: 'bg-rose-50 text-rose-700 ring-rose-200'
};

function StatusBadge({ type }) {
  return (
    <span className={`inline-flex rounded-full px-2 py-0.5 text-[10.5px] font-extrabold ring-1 ring-inset ${STATUS_TONE[type] || 'bg-slate-50 text-slate-600 ring-slate-200'}`}>
      {type || '-'}
    </span>
  );
}

function MethodLabel({ name }) {
  const t = methodTone(name);
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-[11px] font-bold ${t.soft}`}>
      <span className={`h-1.5 w-1.5 rounded-full ${t.dot}`} />
      {name}
    </span>
  );
}

const matchText = (q, ...fields) => {
  if (!q) return true;
  const needle = q.toLowerCase();
  return fields.some((f) => String(f || '').toLowerCase().includes(needle));
};

const SectionLabel = ({ children }) => (
  <p className="text-[10.5px] font-extrabold uppercase tracking-[0.12em] text-slate-400">{children}</p>
);

/* ───────────────────────── daftar pembayaran (kartu 1 & 2) ───────────────────────── */

function usePayments({ open, outletId, start, end }) {
  const [state, setState] = useState({ loading: true, error: '', rows: [], summary: null, truncated: false });
  useEffect(() => {
    if (!open || !start || !end) return undefined;
    let cancelled = false;
    setState((s) => ({ ...s, loading: true, error: '' }));
    axios.get('/api/dashboard/payments', { params: { outlet_id: outletId || undefined, start, end } })
      .then((res) => {
        if (cancelled) return;
        setState({ loading: false, error: '', rows: res.data?.data || [], summary: res.data?.meta?.summary || null, truncated: !!res.data?.meta?.truncated });
      })
      .catch((err) => {
        if (cancelled) return;
        setState({ loading: false, error: err.response?.data?.message || 'Gagal memuat rincian pembayaran', rows: [], summary: null, truncated: false });
      });
    return () => { cancelled = true; };
  }, [open, outletId, start, end]);
  return state;
}

/** Kartu Tunai / Non tunai: nominal + porsi dari total, ketuk = filter. */
function ShareTile({ label, icon: Icon, amount, total, count, active, onClick, accent }) {
  const share = pct(amount, total);
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={`group min-w-0 text-left rounded-2xl border p-3.5 sm:p-4 transition-all cursor-pointer ${
        active
          ? 'border-transparent bg-white shadow-[0_10px_26px_-14px_rgba(95,19,64,0.55)] ring-2 ring-[#5f1340]'
          : 'border-[#e6dcd5] bg-white hover:border-[#5f1340]/30 hover:shadow-sm'
      }`}
    >
      <div className="flex items-center justify-between gap-2">
        <span className="inline-flex items-center gap-1.5 text-[11.5px] font-bold text-slate-500">
          <span className={`h-6 w-6 rounded-lg grid place-items-center ${accent.icon}`}><Icon className="h-3.5 w-3.5" /></span>
          {label}
        </span>
        <span className={`text-[11px] font-black tabular-nums ${accent.text}`}>{share}%</span>
      </div>
      <p className="mt-2 text-lg sm:text-[22px] font-black tabular-nums tracking-tight text-[#2a1d23] leading-none truncate">{fmtRp(amount)}</p>
      <p className="mt-1.5 text-[11px] font-semibold text-slate-400">
        {fmtNum(count)} pembayaran · {active ? 'ketuk lagi untuk semua' : 'ketuk untuk filter'}
      </p>
    </button>
  );
}

function PaymentsPanel({ data, oldBeforeKey = null, emptyText, toolbar = null }) {
  const navigate = useNavigate();
  const [kind, setKind] = useState('all'); // all | tunai | nontunai
  const [method, setMethod] = useState('');
  const [query, setQuery] = useState('');
  const [shown, setShown] = useState(PAGE);
  const { rows, summary, loading, error, truncated } = data;

  // Data baru (periode berganti) → filter kembali ke awal
  useEffect(() => { setKind('all'); setMethod(''); setShown(PAGE); }, [rows]);
  useEffect(() => { setShown(PAGE); }, [kind, method, query]);

  const total = summary?.total || 0;
  const counts = useMemo(() => {
    const c = { tunai: 0, nontunai: 0, byMethod: {} };
    rows.forEach((r) => {
      if (r.is_tunai) c.tunai += 1; else c.nontunai += 1;
      c.byMethod[r.method] = (c.byMethod[r.method] || 0) + 1;
    });
    return c;
  }, [rows]);

  const allMethods = useMemo(() => Object.entries(summary?.byMethod || {})
    .map(([name, amount]) => ({ name, amount, count: counts.byMethod[name] || 0, tunai: rows.some((r) => r.method === name && r.is_tunai) }))
    .sort((a, b) => b.amount - a.amount), [summary, rows, counts]);
  const methods = allMethods.filter((m) => kind === 'all' || (kind === 'tunai' ? m.tunai : !m.tunai));

  const filtered = useMemo(() => rows.filter((r) => {
    if (kind === 'tunai' && !r.is_tunai) return false;
    if (kind === 'nontunai' && r.is_tunai) return false;
    if (method && r.method !== method) return false;
    return matchText(query.trim(), r.order_no, r.customer_name, r.customer_phone, r.cashier_name);
  }), [rows, kind, method, query]);
  const filteredTotal = useMemo(() => filtered.reduce((s, r) => s + r.amount, 0), [filtered]);
  const visible = filtered.slice(0, shown);
  const toggleKind = (k) => { setKind((cur) => (cur === k ? 'all' : k)); setMethod(''); };
  const openNota = (r) => navigate(`/riwayat/${r.order_no}`, { state: { from: '/dashboard' } });
  const isOld = (r) => oldBeforeKey && wibDateKey(r.order_date) < oldBeforeKey;
  const paidLabel = (r) => (oldBeforeKey ? fmtTime(r.paid_at) : fmtDateTime(r.paid_at));
  const isFiltered = kind !== 'all' || method || query.trim();

  return (
    <>
      {toolbar}

      {/* Ringkasan: total + komposisi metode, lalu Tunai / Non tunai */}
      <div className="grid grid-cols-2 lg:grid-cols-[1.35fr_1fr_1fr] gap-2.5 sm:gap-3">
        <button
          type="button"
          onClick={() => { setKind('all'); setMethod(''); }}
          className="col-span-2 lg:col-span-1 text-left rounded-2xl bg-white border border-[#e6dcd5] p-4 cursor-pointer hover:border-[#5f1340]/30"
        >
          <span className="inline-flex items-center gap-1.5 text-[11.5px] font-bold text-slate-500">
            <span className="h-6 w-6 rounded-lg grid place-items-center bg-[#5f1340]/10 text-[#5f1340]"><Wallet className="h-3.5 w-3.5" /></span>
            Total diterima
          </span>
          <p className="mt-2 text-2xl sm:text-[28px] font-black tabular-nums tracking-tight text-[#5f1340] leading-none">{fmtRp(total)}</p>
          <p className="mt-1.5 text-[11.5px] font-semibold text-slate-500">
            {fmtNum(summary?.notaCount)} nota · {fmtNum(summary?.paymentCount)} pembayaran
          </p>
        </button>
        <ShareTile
          label="Tunai"
          icon={Banknote}
          amount={summary?.tunai}
          total={total}
          count={counts.tunai}
          active={kind === 'tunai'}
          onClick={() => toggleKind('tunai')}
          accent={{ icon: 'bg-emerald-50 text-emerald-600', text: 'text-emerald-600', bar: 'bg-emerald-500' }}
        />
        <ShareTile
          label="Non tunai"
          icon={CreditCard}
          amount={summary?.nonTunai}
          total={total}
          count={counts.nontunai}
          active={kind === 'nontunai'}
          onClick={() => toggleKind('nontunai')}
          accent={{ icon: 'bg-sky-50 text-sky-600', text: 'text-sky-600', bar: 'bg-sky-500' }}
        />
      </div>

      {methods.length > 0 && (
        <div className="flex flex-col gap-2">
          <SectionLabel>Metode pembayaran</SectionLabel>
          <div className="flex gap-1.5 overflow-x-auto pb-1 -mx-4 px-4 sm:mx-0 sm:px-0 sm:flex-wrap [scrollbar-width:none]">
            <Chip active={!method} onClick={() => setMethod('')}>Semua metode</Chip>
            {methods.map((m) => (
              <Chip key={m.name} dot={methodTone(m.name).dot} active={method === m.name} onClick={() => setMethod((cur) => (cur === m.name ? '' : m.name))}>
                {m.name}
                <span className={method === m.name ? 'text-white/75' : 'text-slate-400'}>· {fmtRp(m.amount)} · {fmtNum(m.count)}x</span>
              </Chip>
            ))}
          </div>
        </div>
      )}

      <SearchBox value={query} onChange={setQuery} placeholder="Cari no. nota / customer / no. WA / kasir" />

      {(loading || error || filtered.length === 0) ? (
        <StateBox loading={loading} error={error} empty={rows.length ? 'Tidak ada pembayaran yang cocok dengan filter.' : emptyText} />
      ) : (
        <>
          <div className="flex items-baseline justify-between gap-2 px-0.5">
            <SectionLabel>Riwayat pembayaran{isFiltered ? ' (difilter)' : ''}</SectionLabel>
            <p className="text-[11.5px] font-bold text-slate-500 tabular-nums">
              {fmtNum(filtered.length)} × · <span className="text-[#2a1d23]">{fmtRp(filteredTotal)}</span>
            </p>
          </div>
          {truncated && <p className="-mt-2 px-0.5 text-[11px] font-semibold text-amber-700">Dibatasi 5.000 pembayaran terbaru.</p>}

          {/* HP: kartu */}
          <ul className="md:hidden flex flex-col gap-2">
            {visible.map((r) => (
              <li key={r.id}>
                <button
                  type="button"
                  onClick={() => openNota(r)}
                  className="relative w-full overflow-hidden text-left bg-white border border-[#ece3dc] rounded-2xl pl-4 pr-3.5 py-3 active:bg-slate-50 cursor-pointer"
                >
                  <span className="absolute left-0 inset-y-0 w-1" style={{ background: methodTone(r.method).bar }} />
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="text-[14px] font-extrabold text-[#2a1d23] truncate">{formatName(r.customer_name) || 'Pelanggan'}</p>
                      <p className="font-mono text-[11px] font-bold text-[#5f1340] truncate">{r.order_no}</p>
                    </div>
                    <div className="text-right shrink-0">
                      <p className="text-[15px] font-black text-[#2a1d23] tabular-nums">{fmtRp(r.amount)}</p>
                      <p className="text-[11px] font-semibold text-slate-400 tabular-nums">{paidLabel(r)}</p>
                    </div>
                  </div>
                  <div className="mt-2 flex flex-wrap items-center gap-1.5">
                    <StatusBadge type={r.log_type} />
                    <MethodLabel name={r.method} />
                    {isOld(r) && (
                      <span className="inline-flex items-center gap-1 rounded-full bg-violet-50 px-2 py-0.5 text-[10.5px] font-bold text-violet-700">
                        <CalendarDays className="h-3 w-3" /> Nota {fmtShortDate(r.order_date)}
                      </span>
                    )}
                  </div>
                  {r.cashier_name && <p className="mt-1.5 text-[11px] font-medium text-slate-400 truncate">Kasir {formatName(r.cashier_name)}</p>}
                </button>
              </li>
            ))}
          </ul>

          {/* Desktop: tabel */}
          <div className="hidden md:block rounded-2xl border border-[#ece3dc] bg-white overflow-hidden">
            <table className="w-full text-[12.5px]">
              <thead>
                <tr className="bg-[#faf6f3] text-[10.5px] uppercase tracking-[0.08em] text-slate-400">
                  <th className="px-4 py-3 text-left font-extrabold">Waktu</th>
                  <th className="px-4 py-3 text-left font-extrabold">Customer & Nota</th>
                  <th className="px-4 py-3 text-left font-extrabold">Jenis</th>
                  <th className="px-4 py-3 text-left font-extrabold">Metode</th>
                  <th className="px-4 py-3 text-left font-extrabold">Kasir</th>
                  <th className="px-4 py-3 text-right font-extrabold">Nominal</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#f1ebe6]">
                {visible.map((r) => (
                  <tr key={r.id} onClick={() => openNota(r)} className="group cursor-pointer hover:bg-[#5f1340]/[0.025] transition-colors">
                    <td className="px-4 py-3 whitespace-nowrap font-bold tabular-nums text-slate-500">{paidLabel(r)}</td>
                    <td className="px-4 py-3 min-w-0">
                      <span className="block font-extrabold text-[#2a1d23]">{formatName(r.customer_name) || 'Pelanggan'}</span>
                      <span className="mt-0.5 flex flex-wrap items-center gap-1.5">
                        <span className="font-mono text-[11px] font-bold text-[#5f1340]">{r.order_no}</span>
                        {isOld(r) && (
                          <span className="inline-flex items-center gap-1 rounded-full bg-violet-50 px-1.5 py-px text-[10px] font-bold text-violet-700">
                            <CalendarDays className="h-3 w-3" /> Nota {fmtShortDate(r.order_date)}
                          </span>
                        )}
                      </span>
                    </td>
                    <td className="px-4 py-3"><StatusBadge type={r.log_type} /></td>
                    <td className="px-4 py-3"><MethodLabel name={r.method} /></td>
                    <td className="px-4 py-3 text-slate-500 max-w-[180px] truncate" title={formatName(r.cashier_name)}>{formatName(r.cashier_name) || '-'}</td>
                    <td className="px-4 py-3 text-right whitespace-nowrap">
                      <span className="inline-flex items-center gap-1 font-black tabular-nums text-[#2a1d23]">
                        {fmtRp(r.amount)}
                        <ChevronRight className="h-3.5 w-3.5 text-slate-300 group-hover:text-[#5f1340] transition-colors" />
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <MoreButton shown={visible.length} total={filtered.length} onMore={() => setShown((n) => n + PAGE)} />
        </>
      )}
    </>
  );
}

/** Filter periode dalam kotak putih (dipakai modal Revenue & Piutang). */
function PeriodBar({ label, children }) {
  return (
    <div className="rounded-2xl border border-[#e6dcd5] bg-white px-3.5 py-3 flex flex-col sm:flex-row sm:items-center gap-2.5">
      <span className="inline-flex items-center gap-1.5 text-[11.5px] font-bold text-slate-500 shrink-0">
        <CalendarDays className="h-4 w-4 text-[#5f1340]" /> {label}
      </span>
      <div className="min-w-0 sm:ml-auto">{children}</div>
    </div>
  );
}

/* ───────────────────────── Kartu 1: Revenue periode ───────────────────────── */

export function RevenueDetailModal({ open, onClose, outletId }) {
  const [mode, setMode] = useState('cutoff');
  const [cutoffMonth, setCutoffMonth] = useState(getCutoffMonthKey());
  const [rangeStart, setRangeStart] = useState('');
  const [rangeEnd, setRangeEnd] = useState('');
  // Dibuka ulang → kembali ke cutoff berjalan
  useEffect(() => {
    if (!open) return;
    setMode('cutoff');
    setCutoffMonth(getCutoffMonthKey());
    setRangeStart('');
    setRangeEnd('');
  }, [open]);

  const range = useMemo(
    () => resolveStatDateRange({ mode, cutoffMonth, start: rangeStart, end: rangeEnd }),
    [mode, cutoffMonth, rangeStart, rangeEnd]
  );
  const data = usePayments({ open, outletId, start: range.start, end: range.end });

  return (
    <ModalShell open={open} onClose={onClose} icon={Wallet} title="Revenue Periode" subtitle={`Uang masuk · ${range.label}`}>
      <PaymentsPanel
        data={data}
        emptyText="Belum ada pembayaran di periode ini."
        toolbar={(
          <PeriodBar label="Periode">
            <DateModeFilter
              mode={mode}
              onModeChange={setMode}
              rangeStart={rangeStart}
              rangeEnd={rangeEnd}
              onRangeStartChange={setRangeStart}
              onRangeEndChange={setRangeEnd}
              cutoffMonth={cutoffMonth}
              onCutoffMonthChange={setCutoffMonth}
            />
          </PeriodBar>
        )}
      />
    </ModalShell>
  );
}

/* ───────────────────────── Kartu 2: Hari ini ───────────────────────── */

/** 'YYYY-MM-DD' ± n hari (kalender lokal, tanpa geser zona waktu). */
const shiftDay = (key, n) => {
  const [y, m, d] = key.split('-').map(Number);
  const dt = new Date(y, m - 1, d + n);
  return `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, '0')}-${String(dt.getDate()).padStart(2, '0')}`;
};

export function TodayPaymentsModal({ open, onClose, outletId, dateKey }) {
  const today = dateKey || toDateKey(new Date());
  const [day, setDay] = useState(today);
  // Dibuka ulang → kembali ke hari ini
  useEffect(() => { if (open) setDay(today); }, [open, today]);
  const isToday = day === today;
  const data = usePayments({ open, outletId, start: day, end: day });
  const navBtn = 'h-9 w-9 rounded-xl border border-[#e6dcd5] bg-white grid place-items-center text-slate-600 hover:border-[#5f1340]/40 hover:text-[#5f1340] cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed';

  return (
    <ModalShell
      open={open}
      onClose={onClose}
      icon={Banknote}
      title={isToday ? 'Pembayaran Hari Ini' : 'Pembayaran Harian'}
      subtitle={`${formatDateKeyId(day)} · termasuk pelunasan nota hari sebelumnya`}
    >
      <PaymentsPanel
        data={data}
        oldBeforeKey={day}
        emptyText={isToday ? 'Belum ada pembayaran hari ini.' : 'Tidak ada pembayaran di tanggal ini.'}
        toolbar={(
          <PeriodBar label="Tanggal bayar">
            <div className="flex items-center gap-1.5">
              <button type="button" className={navBtn} onClick={() => setDay((d) => shiftDay(d, -1))} aria-label="Hari sebelumnya">
                <ChevronRight className="h-4 w-4 rotate-180" />
              </button>
              <input
                type="date"
                value={day}
                max={today}
                onChange={(e) => e.target.value && setDay(e.target.value)}
                className="h-9 min-w-0 flex-1 sm:flex-none sm:w-40 rounded-xl border border-[#e6dcd5] bg-white px-2.5 text-base sm:text-[13px] font-bold text-[#313030] outline-none focus:border-[#5f1340] cursor-pointer"
                aria-label="Pilih tanggal"
              />
              <button type="button" className={navBtn} onClick={() => setDay((d) => shiftDay(d, 1))} disabled={day >= today} aria-label="Hari berikutnya">
                <ChevronRight className="h-4 w-4" />
              </button>
              {!isToday && (
                <button
                  type="button"
                  onClick={() => setDay(today)}
                  className="h-9 px-3 rounded-xl bg-[#5f1340] text-white text-[12px] font-black hover:bg-[#4a0d31] cursor-pointer shrink-0"
                >
                  Hari ini
                </button>
              )}
            </div>
          </PeriodBar>
        )}
      />
    </ModalShell>
  );
}

/* ───────────────────────── Kartu 3: Piutang ───────────────────────── */

export function PiutangDetailModal({ open, onClose, outletId }) {
  const navigate = useNavigate();
  const [mode, setMode] = useState('cutoff');
  const [cutoffMonth, setCutoffMonth] = useState(getCutoffMonthKey());
  const [rangeStart, setRangeStart] = useState('');
  const [rangeEnd, setRangeEnd] = useState('');
  const [status, setStatus] = useState('');
  const [query, setQuery] = useState('');
  const [shown, setShown] = useState(PAGE);
  const [state, setState] = useState({ loading: true, error: '', rows: [], summary: null, truncated: false });

  useEffect(() => {
    if (!open) return;
    setMode('cutoff');
    setCutoffMonth(getCutoffMonthKey());
    setRangeStart('');
    setRangeEnd('');
    setStatus('');
    setQuery('');
  }, [open]);

  const range = useMemo(
    () => (mode === 'all' ? { start: '', end: '', label: 'Semua periode' } : resolveStatDateRange({ mode, cutoffMonth, start: rangeStart, end: rangeEnd })),
    [mode, cutoffMonth, rangeStart, rangeEnd]
  );

  useEffect(() => {
    if (!open) return undefined;
    let cancelled = false;
    setState((s) => ({ ...s, loading: true, error: '' }));
    axios.get('/api/dashboard/receivables', {
      params: { outlet_id: outletId || undefined, start: range.start || undefined, end: range.end || undefined }
    })
      .then((res) => {
        if (cancelled) return;
        setState({ loading: false, error: '', rows: res.data?.data || [], summary: res.data?.meta?.summary || null, truncated: !!res.data?.meta?.truncated });
      })
      .catch((err) => {
        if (cancelled) return;
        setState({ loading: false, error: err.response?.data?.message || 'Gagal memuat piutang', rows: [], summary: null, truncated: false });
      });
    return () => { cancelled = true; };
  }, [open, outletId, range.start, range.end]);

  useEffect(() => { setShown(PAGE); }, [status, query, state.rows]);

  const { rows, summary, loading, error, truncated } = state;
  const filtered = useMemo(() => rows.filter((r) => {
    if (status && r.payment_status !== status) return false;
    return matchText(query.trim(), r.order_no, r.customer_name, r.customer_phone, r.cashier_name);
  }), [rows, status, query]);
  const filteredRemaining = useMemo(() => filtered.reduce((s, r) => s + r.remaining, 0), [filtered]);
  const visible = filtered.slice(0, shown);
  const byStatus = summary?.byStatus || {};
  const openNota = (r) => navigate(`/riwayat/${r.order_no}`, { state: { from: '/dashboard' } });
  const pickedUnpaid = rows.filter((r) => r.picked_up).length;

  return (
    <ModalShell open={open} onClose={onClose} icon={Receipt} title="Piutang" subtitle={`Nota belum lunas · ${range.label}`}>
      <PeriodBar label="Tanggal nota">
        <DateModeFilter
          allowAll
          mode={mode}
          onModeChange={setMode}
          rangeStart={rangeStart}
          rangeEnd={rangeEnd}
          onRangeStartChange={setRangeStart}
          onRangeEndChange={setRangeEnd}
          cutoffMonth={cutoffMonth}
          onCutoffMonthChange={setCutoffMonth}
        />
      </PeriodBar>

      <div className="grid grid-cols-2 lg:grid-cols-[1.35fr_1fr_1fr] gap-2.5 sm:gap-3">
        <div className="col-span-2 lg:col-span-1 rounded-2xl bg-white border border-[#e6dcd5] p-4">
          <span className="inline-flex items-center gap-1.5 text-[11.5px] font-bold text-slate-500">
            <span className="h-6 w-6 rounded-lg grid place-items-center bg-rose-50 text-rose-600"><Wallet className="h-3.5 w-3.5" /></span>
            Sisa tagihan
          </span>
          <p className="mt-2 text-2xl sm:text-[28px] font-black tabular-nums tracking-tight text-rose-700 leading-none">{fmtRp(summary?.remaining)}</p>
          <p className="mt-1.5 text-[11.5px] font-semibold text-slate-500">{fmtNum(summary?.count)} nota belum lunas</p>
        </div>
        <div className="rounded-2xl bg-white border border-[#e6dcd5] p-3.5 sm:p-4">
          <span className="text-[11.5px] font-bold text-slate-500">Belum bayar</span>
          <p className="mt-2 text-lg sm:text-[22px] font-black tabular-nums text-[#2a1d23] leading-none">{fmtNum(byStatus.Outstanding)} <span className="text-xs font-bold text-slate-400">nota</span></p>
          <p className="mt-1.5 text-[11px] font-semibold text-slate-400">Sudah DP: {fmtNum(byStatus.DP)} nota</p>
        </div>
        <div className="rounded-2xl bg-white border border-[#e6dcd5] p-3.5 sm:p-4">
          <span className="text-[11.5px] font-bold text-slate-500">Sudah diambil</span>
          <p className="mt-2 text-lg sm:text-[22px] font-black tabular-nums text-amber-700 leading-none">{fmtNum(pickedUnpaid)} <span className="text-xs font-bold text-slate-400">nota</span></p>
          <p className="mt-1.5 text-[11px] font-semibold text-slate-400">diambil tapi belum lunas</p>
        </div>
      </div>

      <div className="flex gap-1.5 overflow-x-auto pb-1 [scrollbar-width:none]">
        <Chip active={!status} onClick={() => setStatus('')}>Semua · {fmtNum(summary?.count)}</Chip>
        {Object.entries(byStatus).map(([s, n]) => (
          <Chip key={s} active={status === s} onClick={() => setStatus((cur) => (cur === s ? '' : s))}>{s} · {fmtNum(n)}</Chip>
        ))}
      </div>

      <SearchBox value={query} onChange={setQuery} placeholder="Cari no. nota / customer / no. WA / kasir" />

      {(loading || error || filtered.length === 0) ? (
        <StateBox loading={loading} error={error} empty={rows.length ? 'Tidak ada nota yang cocok dengan filter.' : 'Tidak ada piutang di periode ini.'} />
      ) : (
        <>
          <div className="flex items-baseline justify-between gap-2 px-0.5">
            <SectionLabel>Nota belum lunas</SectionLabel>
            <p className="text-[11.5px] font-bold text-slate-500 tabular-nums">
              {fmtNum(filtered.length)} nota · sisa <span className="text-rose-700">{fmtRp(filteredRemaining)}</span>
            </p>
          </div>
          {truncated && <p className="-mt-2 px-0.5 text-[11px] font-semibold text-amber-700">Dibatasi 5.000 nota terbaru.</p>}

          <ul className="md:hidden flex flex-col gap-2">
            {visible.map((r) => (
              <li key={r.id}>
                <button
                  type="button"
                  onClick={() => openNota(r)}
                  className="relative w-full overflow-hidden text-left bg-white border border-[#ece3dc] rounded-2xl pl-4 pr-3.5 py-3 active:bg-slate-50 cursor-pointer"
                >
                  <span className={`absolute left-0 inset-y-0 w-1 ${r.payment_status === 'DP' ? 'bg-amber-400' : 'bg-rose-400'}`} />
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="text-[14px] font-extrabold text-[#2a1d23] truncate">{formatName(r.customer_name) || 'Pelanggan'}</p>
                      <p className="font-mono text-[11px] font-bold text-[#5f1340] truncate">{r.order_no}</p>
                    </div>
                    <div className="text-right shrink-0">
                      <p className="text-[15px] font-black text-rose-700 tabular-nums">{fmtRp(r.remaining)}</p>
                      <p className="text-[10.5px] font-semibold text-slate-400 tabular-nums">dari {fmtRp(r.grand_total)}</p>
                    </div>
                  </div>
                  <div className="mt-2 flex flex-wrap items-center gap-1.5 text-[11px] font-semibold text-slate-500">
                    <StatusBadge type={r.payment_status} />
                    <span className="inline-flex items-center gap-1"><CalendarDays className="h-3 w-3" /> {fmtDate(r.order_date)}</span>
                    <span>· progres {r.work_status}%</span>
                    {r.picked_up && <span className="rounded-full bg-amber-50 px-2 py-0.5 text-[10.5px] font-bold text-amber-700">Sudah diambil</span>}
                  </div>
                </button>
              </li>
            ))}
          </ul>

          <div className="hidden md:block rounded-2xl border border-[#ece3dc] bg-white overflow-hidden">
            <table className="w-full text-[12.5px]">
              <thead>
                <tr className="bg-[#faf6f3] text-[10.5px] uppercase tracking-[0.08em] text-slate-400">
                  <th className="px-4 py-3 text-left font-extrabold">Tanggal</th>
                  <th className="px-4 py-3 text-left font-extrabold">Customer & Nota</th>
                  <th className="px-4 py-3 text-left font-extrabold">Status</th>
                  <th className="px-4 py-3 text-left font-extrabold">Progres</th>
                  <th className="px-4 py-3 text-right font-extrabold">Tagihan</th>
                  <th className="px-4 py-3 text-right font-extrabold">Dibayar</th>
                  <th className="px-4 py-3 text-right font-extrabold">Sisa</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#f1ebe6]">
                {visible.map((r) => (
                  <tr key={r.id} onClick={() => openNota(r)} className="group cursor-pointer hover:bg-[#5f1340]/[0.025] transition-colors">
                    <td className="px-4 py-3 whitespace-nowrap font-bold tabular-nums text-slate-500">{fmtDate(r.order_date)}</td>
                    <td className="px-4 py-3">
                      <span className="block font-extrabold text-[#2a1d23]">{formatName(r.customer_name) || 'Pelanggan'}</span>
                      <span className="font-mono text-[11px] font-bold text-[#5f1340]">{r.order_no}</span>
                    </td>
                    <td className="px-4 py-3"><StatusBadge type={r.payment_status} /></td>
                    <td className="px-4 py-3 whitespace-nowrap">
                      <span className="inline-flex items-center gap-2">
                        <span className="h-1.5 w-14 rounded-full bg-slate-100 overflow-hidden">
                          <span className="block h-full rounded-full bg-[#5f1340]" style={{ width: `${Math.min(100, r.work_status)}%` }} />
                        </span>
                        <span className="text-[11px] font-bold tabular-nums text-slate-500">{r.work_status}%</span>
                        {r.picked_up && <span className="rounded-full bg-amber-50 px-1.5 py-px text-[10px] font-bold text-amber-700">Diambil</span>}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right tabular-nums text-slate-500">{fmtRp(r.grand_total)}</td>
                    <td className="px-4 py-3 text-right tabular-nums text-slate-500">{fmtRp(r.paid_amount)}</td>
                    <td className="px-4 py-3 text-right whitespace-nowrap">
                      <span className="inline-flex items-center gap-1 font-black tabular-nums text-rose-700">
                        {fmtRp(r.remaining)}
                        <ChevronRight className="h-3.5 w-3.5 text-slate-300 group-hover:text-[#5f1340] transition-colors" />
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <MoreButton shown={visible.length} total={filtered.length} onMore={() => setShown((n) => n + PAGE)} />
        </>
      )}
    </ModalShell>
  );
}
