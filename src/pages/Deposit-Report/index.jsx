import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import { useNetworkRestored } from '../../hooks/useNetworkRestored.js';
import HeaderNav from '../../components/HeaderNav';
import DateModeFilter from '../../components/DateModeFilter.jsx';
import { ProofLink } from '../../components/ImageLightbox.jsx';
import UploadDepositModal from './components/UploadDepositModal.jsx';
import { formatEmployeeName } from '../../utils/FormatName.js';
import { todayWibISO } from '../../utils/wib.js';
import { isHqUser } from '../../utils/authSession.js';
import { getCutoffMonthKey, getCutoffRangeForMonth, formatDateKeyId } from '../../utils/dateCutoffFilter.js';
import { Banknote, RefreshCw, AlertTriangle, CheckCircle2, Clock3, Upload, Image as ImageIcon } from 'lucide-react';

const STATUS_TABS = [
  { key: 'all', label: 'Semua' },
  { key: 'pending', label: 'Belum Upload' },
  { key: 'uploaded', label: 'Sudah Upload' },
  { key: 'late', label: 'Terlambat' }
];

const fmtRp = (v) => `Rp ${Number(v || 0).toLocaleString('id-ID')}`;

export default function DepositReport() {
  const navigate = useNavigate();
  const isHq = isHqUser();
  const [userProfile, setUserProfile] = useState(null);
  const [activeOutletName, setActiveOutletName] = useState(localStorage.getItem('activeOutletName') || '');
  const [activeOutletId, setActiveOutletId] = useState(localStorage.getItem('activeOutletId') || '2');
  const [outlets, setOutlets] = useState([]);
  /** Khusus manajemen: '' = semua outlet */
  const [hqOutletId, setHqOutletId] = useState('');

  const [dateMode, setDateMode] = useState('cutoff'); // 'cutoff' | 'range'
  const [rangeStart, setRangeStart] = useState('');
  const [rangeEnd, setRangeEnd] = useState('');
  const [cutoffMonth, setCutoffMonth] = useState(getCutoffMonthKey());
  const [statusTab, setStatusTab] = useState('all');

  const [rows, setRows] = useState([]);
  const [summary, setSummary] = useState({ total: 0, uploaded: 0, pending: 0, late: 0 });
  const [dueDays, setDueDays] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [uploadRow, setUploadRow] = useState(null);

  useEffect(() => {
    document.title = 'Setoran Tunai | Waschen Laundry';
    if (!localStorage.getItem('token')) {
      navigate('/login', { replace: true });
      return;
    }
    setUserProfile({
      fullName: localStorage.getItem('fullName') || 'Kasir Waschen',
      role: isHq ? 'Management Alora' : (localStorage.getItem('activeRole') || 'Staff Kasir')
    });
    axios.get('/api/masters/outlets')
      .then((res) => {
        if (res.data?.success) setOutlets(res.data.data || []);
      })
      .catch(() => {});
  }, [navigate, isHq]);

  const today = todayWibISO();
  const range = useMemo(() => {
    const base = dateMode === 'cutoff'
      ? getCutoffRangeForMonth(cutoffMonth)
      : { start: rangeStart, end: rangeEnd };
    // Tampil sampai hari berjalan saja, bukan sampai akhir periode cutoff.
    const end = !base.end || base.end > today ? today : base.end;
    return { start: base.start || '', end };
  }, [dateMode, cutoffMonth, rangeStart, rangeEnd, today]);

  // Staf mengikuti outlet aktif di header (setoran closing Final shift outlet tsb).
  const outletFilter = isHq ? hqOutletId : activeOutletId;

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const res = await axios.get('/api/deposit-report', {
        params: {
          outlet_id: outletFilter || undefined,
          start: range.start || undefined,
          end: range.end,
          status: statusTab
        },
        headers: { Authorization: `Bearer ${localStorage.getItem('token') || ''}` }
      });
      if (res.data?.success) {
        setRows(res.data.data || []);
        setSummary(res.data.summary || { total: 0, uploaded: 0, pending: 0, late: 0 });
        setDueDays(res.data.meta?.dueDays ?? 1);
      } else {
        setRows([]);
        setError(res.data?.message || 'Gagal memuat data setoran');
      }
    } catch (err) {
      setRows([]);
      setError(err.response?.data?.message || 'Gagal memuat data setoran');
    } finally {
      setLoading(false);
    }
  }, [outletFilter, range.start, range.end, statusTab]);

  useNetworkRestored(load);

  useEffect(() => {
    load();
  }, [load]);

  const handleUploaded = () => {
    setUploadRow(null);
    load();
  };

  const periodLabel = `${range.start ? formatDateKeyId(range.start) : 'Awal'} – ${formatDateKeyId(range.end)}`;


  // Kelompokkan per tanggal closing (terbaru di atas)
  const groups = useMemo(() => {
    const map = new Map();
    rows.forEach((r) => {
      const k = dateKeyOf(r.closed_at);
      if (!map.has(k)) map.set(k, []);
      map.get(k).push(r);
    });
    return [...map.entries()]
      .sort((a, b) => (a[0] < b[0] ? 1 : -1))
      .map(([key, items]) => ({
        key,
        items: items.sort((a, b) => new Date(b.closed_at) - new Date(a.closed_at)),
        revenue: items.reduce((sum, r) => sum + (Number(r.cash_revenue ?? r.declared_revenue) || 0), 0),
        pending: items.filter((r) => r.status !== 'uploaded').length
      }));
  }, [rows]);

  return (
    <div className="min-h-screen bg-[#f8f8f8] text-[#313030] flex flex-col font-sans">
      <HeaderNav
        activeOutletName={activeOutletName}
        setActiveOutletName={setActiveOutletName}
        activeOutletId={activeOutletId}
        setActiveOutletId={setActiveOutletId}
        outlets={outlets}
        userProfile={userProfile}
      />

      <main className="max-w-[1500px] w-full min-w-0 mx-auto p-3 sm:p-6 flex-grow flex flex-col gap-4 sm:gap-5">
        {/* Header + filter */}
        <div className="bg-white border border-[#e0e0e0] rounded-3xl p-4 sm:p-5 flex flex-col gap-3 min-w-0">
          <div className="flex items-center justify-between gap-3">
            <h1 className="text-lg sm:text-2xl font-black tracking-tight flex items-center gap-2 min-w-0">
              <Banknote className="h-5 w-5 sm:h-6 sm:w-6 text-[#5f1340] shrink-0" />
              <span className="truncate">Setoran Tunai</span>
            </h1>
            <div className="flex items-center gap-2 shrink-0">
              {isHq && (
                <select
                  value={hqOutletId}
                  onChange={(e) => setHqOutletId(e.target.value)}
                  className="hidden sm:block max-w-[220px] px-3 py-2.5 border border-[#e0e0e0] rounded-xl text-xs font-bold outline-none focus:border-[#5f1340] bg-white truncate"
                >
                  <option value="">Semua Outlet</option>
                  {outlets.map((o) => (
                    <option key={o.id} value={o.id}>{o.full_name || o.name}</option>
                  ))}
                </select>
              )}
              <button
                type="button"
                onClick={load}
                title="Muat ulang"
                className="p-2.5 bg-[#5f1340]/10 hover:bg-[#5f1340]/15 text-[#5f1340] rounded-xl cursor-pointer"
              >
                <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
              </button>
            </div>
          </div>

          {isHq && (
            <select
              value={hqOutletId}
              onChange={(e) => setHqOutletId(e.target.value)}
              className="sm:hidden w-full px-3 py-2.5 border border-[#e0e0e0] rounded-xl text-xs font-bold outline-none focus:border-[#5f1340] bg-white"
            >
              <option value="">Semua Outlet</option>
              {outlets.map((o) => (
                <option key={o.id} value={o.id}>{o.full_name || o.name}</option>
              ))}
            </select>
          )}

          <div className="flex flex-wrap items-center gap-x-3 gap-y-2 min-w-0">
            <DateModeFilter
              mode={dateMode}
              onModeChange={setDateMode}
              rangeStart={rangeStart}
              rangeEnd={rangeEnd}
              onRangeStartChange={setRangeStart}
              onRangeEndChange={setRangeEnd}
              cutoffMonth={cutoffMonth}
              onCutoffMonthChange={setCutoffMonth}
              showCutoffLabel={false}
            />
            <span className="text-[11px] font-bold text-slate-400">{periodLabel}</span>
          </div>
        </div>

        {/* Ringkasan = tombol filter status */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-2.5">
          {STATUS_TABS.map((t) => (
            <StatusTile
              key={t.key}
              label={t.label}
              value={t.key === 'all' ? summary.total : summary[t.key]}
              tone={t.key}
              active={statusTab === t.key}
              onClick={() => setStatusTab(t.key)}
            />
          ))}
        </div>

        {error && (
          <div className="p-3 bg-rose-50 border border-rose-200 text-rose-800 rounded-xl text-xs font-bold flex items-start gap-2">
            <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5" />
            <span>{error}</span>
          </div>
        )}

        {loading ? (
          <div className="bg-white border border-[#e0e0e0] rounded-3xl p-12 text-center text-slate-400 text-xs font-bold">
            Memuat data setoran...
          </div>
        ) : rows.length === 0 ? (
          <div className="bg-white border border-[#e0e0e0] rounded-3xl p-12 text-center text-slate-400 text-xs font-bold">
            Tidak ada setoran
          </div>
        ) : (
          <div className="bg-white border border-[#e0e0e0] rounded-3xl p-3 sm:p-5 flex flex-col gap-5">
            {groups.map((g) => (
              <section key={g.key} className="flex flex-col gap-2.5">
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-0.5 px-1">
                  <h2 className="text-sm font-black text-[#313030]">
                    {longDate(g.key)}
                    {relativeDay(g.key, today) && <span className="font-medium text-slate-500"> · {relativeDay(g.key, today)}</span>}
                  </h2>
                  <p className="text-[11px] sm:text-xs text-slate-500">
                    {g.items.length} closing · <strong className="text-[#313030] tabular-nums">{fmtRp(g.revenue)}</strong> ·{' '}
                    {g.pending > 0
                      ? <strong className="text-amber-700">{g.pending} belum upload</strong>
                      : <strong className="text-emerald-700">semua sudah upload</strong>}
                  </p>
                </div>
                {g.items.map((r) => (
                  <ClosingItem key={r.key} row={r} dueDays={dueDays} onUpload={() => setUploadRow(r)} />
                ))}
              </section>
            ))}
          </div>
        )}
      </main>

      {uploadRow && (
        <UploadDepositModal
          row={uploadRow}
          onUploaded={handleUploaded}
          onCancel={() => setUploadRow(null)}
        />
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ helpers */

const pad = (n) => String(n).padStart(2, '0');

/** YYYY-MM-DD (zona waktu perangkat = WIB di outlet) */
function dateKeyOf(v) {
  const d = v ? new Date(v) : null;
  if (!d || Number.isNaN(d.getTime())) return '0000-00-00';
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

function keyToDate(key) {
  const [y, m, d] = key.split('-').map(Number);
  return new Date(y, (m || 1) - 1, d || 1);
}

/** "Jumat, 20 Nov 2026" */
const longDate = (key) => keyToDate(key).toLocaleDateString('id-ID', { weekday: 'long', day: 'numeric', month: 'short', year: 'numeric' });

function relativeDay(key, todayKey) {
  const diff = Math.round((keyToDate(todayKey) - keyToDate(key)) / 86400000);
  if (diff === 0) return 'Hari ini';
  if (diff === 1) return 'Kemarin';
  return '';
}

const hhmm = (v) => {
  const d = v ? new Date(v) : null;
  return !d || Number.isNaN(d.getTime()) ? '-' : `${pad(d.getHours())}.${pad(d.getMinutes())}`;
};

/** "Waschen Laundry Citra Gran" → "Citra Gran" */
const shortOutlet = (name) => String(name || '-').replace(/^waschen\s+laundry\s+/i, '');

/** "An'nisa Puspa Khairani Rangkuti" → "An'nisa P. K. Rangkuti" */
function shortName(name) {
  const parts = String(formatEmployeeName(name) || '').trim().split(/\s+/).filter(Boolean);
  if (parts.length <= 2) return parts.join(' ') || '-';
  return [parts[0], ...parts.slice(1, -1).map((p) => `${p[0]}.`), parts[parts.length - 1]].join(' ');
}

const TILE_TONES = {
  all: { text: 'text-[#313030]', active: 'border-[#5f1340] ring-2 ring-[#5f1340]/15' },
  uploaded: { text: 'text-emerald-700', active: 'border-emerald-500 ring-2 ring-emerald-500/15' },
  pending: { text: 'text-amber-700', active: 'border-amber-500 ring-2 ring-amber-500/15' },
  late: { text: 'text-rose-700', active: 'border-rose-500 ring-2 ring-rose-500/15' }
};

function StatusTile({ label, value, tone, active, onClick }) {
  const t = TILE_TONES[tone] || TILE_TONES.all;
  return (
    <button
      type="button"
      onClick={onClick}
      className={`text-left bg-white border rounded-2xl px-4 py-3 cursor-pointer transition-all ${active ? t.active : 'border-[#e0e0e0] hover:border-slate-300'}`}
    >
      <span className="text-[11px] text-slate-500 font-bold block">{label}</span>
      <span className={`text-xl sm:text-2xl font-black tabular-nums block ${t.text}`}>{Number(value || 0).toLocaleString('id-ID')}</span>
    </button>
  );
}

/* ------------------------------------------------------------- satu closing */

function ClosingItem({ row, dueDays, onUpload }) {
  const uploaded = row.status === 'uploaded';
  const late = row.is_late && !uploaded;
  const isSiang = Number(row.shift_number) === 2;

  const tone = uploaded
    ? { card: 'bg-white border-[#e0e0e0]', box: 'bg-indigo-50 text-indigo-900' }
    : late
      ? { card: 'bg-rose-50/60 border-rose-200', box: 'bg-rose-100/70 text-rose-900' }
      : { card: 'bg-amber-50/60 border-amber-200', box: 'bg-amber-100/70 text-amber-900' };

  // Batas upload = tanggal closing + H+dueDays
  const dueDate = keyToDate(dateKeyOf(row.closed_at));
  dueDate.setDate(dueDate.getDate() + Number(dueDays || 0));
  const dueLabel = Number(dueDays || 0) === 0
    ? 'Upload sebelum tutup hari'
    : `Batas ${dueDate.toLocaleDateString('id-ID', { weekday: 'short', day: 'numeric', month: 'short' })}`;

  const sameDayUpload = uploaded && dateKeyOf(row.deposit_uploaded_at) === dateKeyOf(row.closed_at);
  const uploadedWhen = uploaded
    ? (sameDayUpload
      ? hhmm(row.deposit_uploaded_at)
      : `${keyToDate(dateKeyOf(row.deposit_uploaded_at)).toLocaleDateString('id-ID', { day: 'numeric', month: 'short' })} ${hhmm(row.deposit_uploaded_at)}`)
    : '';

  return (
    <div className={`border rounded-2xl p-3 sm:p-4 flex flex-col md:flex-row md:items-center gap-3 md:gap-5 ${tone.card}`}>
      {/* Jam + shift, outlet, revenue */}
      <div className="flex items-center gap-3 sm:gap-4 min-w-0 md:flex-1">
        <div className={`w-14 h-14 sm:w-16 sm:h-16 rounded-xl flex flex-col items-center justify-center shrink-0 ${tone.box}`}>
          <span className="text-sm sm:text-base font-black tabular-nums leading-none">{hhmm(row.closed_at)}</span>
          <span className="text-[9px] sm:text-[10px] font-black tracking-wider mt-1">{isSiang ? 'SIANG' : 'PAGI'}</span>
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-sm sm:text-base font-black text-[#313030] truncate" title={row.outlet_name}>{shortOutlet(row.outlet_name)}</p>
          <p className="text-[11px] sm:text-xs text-slate-500 truncate">
            Closing oleh {formatEmployeeName(row.closed_by_name || row.opener_name)}
          </p>
        </div>
        <div className="text-right shrink-0">
          <span className="block text-[10px] sm:text-[11px] text-slate-400 font-semibold">Tunai disetor</span>
          <span className="block text-sm sm:text-lg font-black text-[#313030] tabular-nums leading-tight">
            {(row.cash_revenue ?? row.declared_revenue) != null ? fmtRp(row.cash_revenue ?? row.declared_revenue) : '—'}
          </span>
          {row.cash_reported != null && row.cash_revenue != null
            && Math.round(row.cash_reported) !== Math.round(row.cash_revenue) && (
            <span className="block text-[10px] font-bold text-amber-700 tabular-nums">
              Laporan kasir: {fmtRp(row.cash_reported)}
            </span>
          )}
        </div>
      </div>

      {/* Status bukti + aksi */}
      <div className="flex items-center gap-3 md:w-[46%] lg:w-[42%] shrink-0 pt-3 md:pt-0 border-t md:border-t-0 md:border-l border-black/5 md:pl-5">
        <div className="flex items-start gap-2.5 min-w-0 flex-1">
          {uploaded ? (
            <CheckCircle2 className="h-5 w-5 text-emerald-600 shrink-0 mt-0.5" />
          ) : (
            <Clock3 className={`h-5 w-5 shrink-0 mt-0.5 ${late ? 'text-rose-600' : 'text-amber-600'}`} />
          )}
          <div className="min-w-0">
            {uploaded ? (
              <>
                <p className="text-xs sm:text-sm font-black text-emerald-700 truncate">Bukti diupload {uploadedWhen}</p>
                <p className="text-[11px] sm:text-xs text-slate-500 truncate" title={row.deposit_notes || ''}>
                  oleh {shortName(row.deposit_uploaded_by_name)}{row.deposit_notes ? ` · "${row.deposit_notes}"` : ''}
                </p>
              </>
            ) : (
              <>
                <p className={`text-xs sm:text-sm font-black truncate ${late ? 'text-rose-700' : 'text-amber-800'}`}>
                  {late ? `Terlambat ${row.late_days} hari` : 'Bukti setor belum ada'}
                </p>
                <p className={`text-[11px] sm:text-xs truncate ${late ? 'text-rose-600' : 'text-amber-700'}`}>
                  {late ? 'Segera upload bukti setor' : dueLabel}
                </p>
              </>
            )}
          </div>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          {uploaded ? (
            <>
              <ProofLink
                url={row.deposit_proof_url}
                title="Bukti setoran tunai"
                className="inline-flex items-center gap-1.5 px-3 sm:px-4 py-2 sm:py-2.5 rounded-xl border border-[#e0e0e0] bg-white hover:border-[#5f1340]/40 text-[#313030] text-xs font-black cursor-pointer whitespace-nowrap"
              >
                <ImageIcon className="h-4 w-4" />
                <span className="hidden sm:inline">Lihat bukti</span>
              </ProofLink>
              <button
                type="button"
                onClick={onUpload}
                title="Ganti bukti"
                className="p-2 sm:p-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-600 cursor-pointer"
              >
                <RefreshCw className="h-4 w-4" />
              </button>
            </>
          ) : (
            <button
              type="button"
              onClick={onUpload}
              className="inline-flex items-center gap-1.5 px-3.5 sm:px-5 py-2 sm:py-2.5 rounded-xl bg-[#5f1340] hover:bg-[#4d0f33] text-white text-xs font-black cursor-pointer whitespace-nowrap shadow-sm"
            >
              <Upload className="h-4 w-4" />
              Upload bukti
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
