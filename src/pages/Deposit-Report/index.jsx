import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import HeaderNav from '../../components/HeaderNav';
import DateModeFilter from '../../components/DateModeFilter.jsx';
import { ProofLink } from '../../components/ImageLightbox.jsx';
import UploadDepositModal from './components/UploadDepositModal.jsx';
import { formatEmployeeName } from '../../utils/FormatName.js';
import { todayWibISO, formatWibDateTime } from '../../utils/wib.js';
import { isHqUser } from '../../utils/authSession.js';
import { getCutoffMonthKey, getCutoffRangeForMonth, formatDateKeyId } from '../../utils/dateCutoffFilter.js';
import { Banknote, Paperclip, RefreshCw, AlertTriangle, CheckCircle2, Clock3 } from 'lucide-react';

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

  // Staf mengikuti outlet aktif di header: outlet biasa → setoran closing Final, outlet Event → setoran harian.
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

  useEffect(() => {
    load();
  }, [load]);

  const handleUploaded = () => {
    setUploadRow(null);
    load();
  };

  const periodLabel = `${range.start ? formatDateKeyId(range.start) : 'Awal'} – ${formatDateKeyId(range.end)}`;

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

      <main className="max-w-[1200px] w-full mx-auto p-4 sm:p-6 flex-grow flex flex-col gap-5">
        <div className="bg-white border border-[#e0e0e0] rounded-3xl p-5 shadow-xs flex flex-col gap-4">
          <div className="flex flex-col sm:flex-row justify-between gap-3 sm:items-center">
            <div className="flex items-center gap-3">
              <div className="p-3 bg-[#5f1340]/10 text-[#5f1340] rounded-2xl">
                <Banknote className="h-5 w-5" />
              </div>
              <div>
                <h1 className="text-xl font-black tracking-tight">Setoran Tunai</h1>
                <p className="text-xs text-slate-400 mt-0.5">
                  Bukti setor uang tiap closing Final (outlet Event: tiap hari). Batas upload H+{dueDays}.
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              {isHq && (
                <select
                  value={hqOutletId}
                  onChange={(e) => setHqOutletId(e.target.value)}
                  className="px-3 py-2 border border-[#e0e0e0] rounded-xl text-xs font-bold outline-none focus:border-[#5f1340] bg-white"
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
                className="inline-flex items-center gap-1.5 px-3 py-2 bg-[#5f1340]/10 text-[#5f1340] rounded-xl text-xs font-black cursor-pointer"
              >
                <RefreshCw className={`h-3.5 w-3.5 ${loading ? 'animate-spin' : ''}`} />
                Refresh
              </button>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
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
            <span className="text-[10px] font-bold text-slate-400">
              Ditampilkan: {periodLabel} (sampai hari ini)
            </span>
          </div>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <SummaryTile label="Total Setoran" value={summary.total} />
          <SummaryTile label="Sudah Upload" value={summary.uploaded} tone="emerald" />
          <SummaryTile label="Belum Upload" value={summary.pending} tone="amber" />
          <SummaryTile label="Terlambat" value={summary.late} tone="rose" />
        </div>

        <div className="flex flex-wrap gap-1.5">
          {STATUS_TABS.map((t) => (
            <button
              key={t.key}
              type="button"
              onClick={() => setStatusTab(t.key)}
              className={`px-3 py-1.5 rounded-xl text-[11px] font-black border cursor-pointer transition-colors ${
                statusTab === t.key
                  ? 'bg-[#5f1340] text-white border-[#5f1340]'
                  : 'bg-white text-slate-600 border-[#e0e0e0] hover:bg-slate-50'
              }`}
            >
              {t.label}
            </button>
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
            Tidak ada setoran untuk filter ini
          </div>
        ) : (
          <div className="bg-white border border-[#e0e0e0] rounded-3xl shadow-xs overflow-x-auto">
            <table className="w-full min-w-[860px] text-xs">
              <thead>
                <tr className="bg-[#f8f8f8] text-[10px] uppercase text-slate-400 font-extrabold">
                  <th className="py-3 px-4 text-left">Closing / Tanggal</th>
                  <th className="py-3 px-4 text-left">Outlet · Shift</th>
                  <th className="py-3 px-4 text-right">Revenue / Tunai</th>
                  <th className="py-3 px-4 text-left">Status</th>
                  <th className="py-3 px-4 text-left">Diupload Oleh</th>
                  <th className="py-3 px-4 text-left">Bukti</th>
                  <th className="py-3 px-4 text-right">Aksi</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#e0e0e0]/60 font-semibold">
                {rows.map((r) => (
                  <DepositRow key={r.key} row={r} onUpload={() => setUploadRow(r)} />
                ))}
              </tbody>
            </table>
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

function SummaryTile({ label, value, tone }) {
  const tones = {
    emerald: 'text-emerald-700',
    amber: 'text-amber-700',
    rose: 'text-rose-700'
  };
  return (
    <div className="bg-white border border-[#e0e0e0] rounded-2xl p-4 shadow-xs">
      <span className="text-[9px] text-slate-400 font-bold uppercase block">{label}</span>
      <span className={`text-2xl font-black block mt-1 ${tones[tone] || 'text-[#313030]'}`}>{value}</span>
    </div>
  );
}

function StatusBadge({ row }) {
  if (row.status === 'uploaded') {
    return (
      <div className="flex flex-col gap-1 items-start">
        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg bg-emerald-50 text-emerald-700 border border-emerald-200 text-[10px] font-black">
          <CheckCircle2 className="h-3 w-3" /> Sudah Upload
        </span>
        {row.is_late && (
          <span className="text-[10px] font-black text-rose-700">Terlambat {row.late_days} hari</span>
        )}
      </div>
    );
  }
  return (
    <div className="flex flex-col gap-1 items-start">
      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg bg-amber-50 text-amber-700 border border-amber-200 text-[10px] font-black">
        <Clock3 className="h-3 w-3" /> Belum Upload
      </span>
      {row.is_late && (
        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg bg-rose-50 text-rose-700 border border-rose-200 text-[10px] font-black">
          Terlambat {row.late_days} hari
        </span>
      )}
    </div>
  );
}

function DepositRow({ row, onUpload }) {
  const uploaded = row.status === 'uploaded';
  const isEvent = row.kind === 'event';
  return (
    <tr className={row.is_late && !uploaded ? 'bg-rose-50/40' : ''}>
      <td className="py-3 px-4 whitespace-nowrap">
        {isEvent ? (
          <span className="block">{formatDateKeyId(row.event_date)}</span>
        ) : (
          <>
            <span className="block">{formatWibDateTime(row.closed_at)}</span>
            <span className="block text-[10px] text-slate-400 font-medium">
              Ditutup: {formatEmployeeName(row.closed_by_name || row.opener_name)}
            </span>
          </>
        )}
      </td>
      <td className="py-3 px-4">
        <span className="block">{row.outlet_name}</span>
        <span className="block text-[10px] text-slate-400 font-medium">
          {isEvent ? 'Event · setoran harian' : `Shift ${Number(row.shift_number) === 2 ? 'Siang' : 'Pagi'} · #${row.id}`}
        </span>
      </td>
      <td className="py-3 px-4 text-right whitespace-nowrap text-[#5f1340]">
        {isEvent ? (
          <>
            <span className="block">{fmtRp(row.cash_amount)}</span>
            {row.deposit_amount != null && (
              <span className="block text-[10px] font-medium text-slate-500">
                Disetor {fmtRp(row.deposit_amount)}
                {Number(row.deposit_amount) !== Number(row.cash_amount) && (
                  <span className={Number(row.deposit_amount) < Number(row.cash_amount) ? 'text-rose-700 font-black' : 'text-amber-700 font-black'}>
                    {' '}({Number(row.deposit_amount) - Number(row.cash_amount) > 0 ? '+' : '-'}{fmtRp(Math.abs(Number(row.deposit_amount) - Number(row.cash_amount)))})
                  </span>
                )}
              </span>
            )}
          </>
        ) : (
          row.declared_revenue != null ? fmtRp(row.declared_revenue) : '—'
        )}
      </td>
      <td className="py-3 px-4"><StatusBadge row={row} /></td>
      <td className="py-3 px-4">
        {uploaded ? (
          <>
            <span className="block">{formatEmployeeName(row.deposit_uploaded_by_name)}</span>
            <span className="block text-[10px] text-slate-400 font-medium">
              {formatWibDateTime(row.deposit_uploaded_at)}
            </span>
            {row.deposit_notes && (
              <span className="block text-[10px] text-slate-500 font-medium mt-0.5 max-w-[14rem] break-words">
                {row.deposit_notes}
              </span>
            )}
          </>
        ) : (
          <span className="text-slate-300">—</span>
        )}
      </td>
      <td className="py-3 px-4">
        {uploaded ? (
          <ProofLink
            url={row.deposit_proof_url}
            title="Bukti setoran tunai"
            className="inline-flex items-center gap-1 text-[#5f1340] font-black underline cursor-pointer"
          >
            <Paperclip className="h-3 w-3" /> Lihat Bukti
          </ProofLink>
        ) : (
          <span className="text-slate-300">—</span>
        )}
      </td>
      <td className="py-3 px-4 text-right">
        <button
          type="button"
          onClick={onUpload}
          className={`px-3 py-1.5 rounded-xl text-[11px] font-black cursor-pointer ${
            uploaded
              ? 'bg-white border border-[#e0e0e0] text-slate-600 hover:bg-slate-50'
              : 'bg-gradient-to-r from-[#5f1340] to-[#7d1956] text-white shadow-sm'
          }`}
        >
          {uploaded ? 'Ganti' : 'Upload'}
        </button>
      </td>
    </tr>
  );
}
