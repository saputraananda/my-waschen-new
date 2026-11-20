import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import HeaderNav from '../../components/HeaderNav';
import { formatEmployeeName } from '../../utils/FormatName.js';
import { todayWibISO } from '../../utils/wib.js';
import { exportDailyReportToExcel } from '../../utils/exportDailyReport.js';
import { Copy, FileText, Banknote, Check, ChevronDown, FileSpreadsheet } from 'lucide-react';

export default function DailyReport() {
  const navigate = useNavigate();
  const [userProfile, setUserProfile] = useState(null);
  const [activeOutletName, setActiveOutletName] = useState(localStorage.getItem('activeOutletName') || '');
  const [activeOutletId, setActiveOutletId] = useState(localStorage.getItem('activeOutletId') || '2');
  const [outlets, setOutlets] = useState([]);
  const [date, setDate] = useState(todayWibISO());
  const [shifts, setShifts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [copiedId, setCopiedId] = useState(null);
  const [openTx, setOpenTx] = useState({});
  const [exporting, setExporting] = useState(false);

  useEffect(() => {
    document.title = 'Daily Report | Waschen Laundry';
    const token = localStorage.getItem('token');
    if (!token) {
      navigate('/login', { replace: true });
      return;
    }
    const isHq = localStorage.getItem('companyId') === '1';
    setUserProfile({
      fullName: localStorage.getItem('fullName') || 'Kasir Waschen',
      role: isHq ? 'Management Alora' : (localStorage.getItem('activeRole') || 'Staff Kasir')
    });
    axios.get('/api/masters/outlets')
      .then((res) => {
        if (res.data?.success) setOutlets(res.data.data || []);
      })
      .catch(() => {});
  }, [navigate]);

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      try {
        const res = await axios.get('/api/shifts/daily-report', {
          params: { outlet_id: activeOutletId, date }
        });
        if (res.data?.success) setShifts(res.data.data || []);
        else setShifts([]);
      } catch (err) {
        console.error(err);
        setShifts([]);
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [activeOutletId, date]);

  const toggleVerify = async (shiftId, t) => {
    const next = Number(t.is_verified) !== 1;
    try {
      await axios.post(`/api/shifts/${shiftId}/verify-txn`, {
        transactionId: t.id,
        verifiedBy: parseInt(localStorage.getItem('employeeId'), 10),
        verified: next
      });
      setShifts((prev) => prev.map((s) => (s.id !== shiftId ? s : {
        ...s,
        transactions: s.transactions.map((x) => (x.id === t.id ? { ...x, is_verified: next ? 1 : 0 } : x))
      })));
    } catch (err) {
      alert(err.response?.data?.message || err.message);
    }
  };

  const handleExport = async () => {
    setExporting(true);
    try {
      await exportDailyReportToExcel({ shifts, date, outletName: activeOutletName });
    } catch (err) {
      console.error(err);
      alert('Gagal export Excel: ' + (err.message || err));
    } finally {
      setExporting(false);
    }
  };

  const copyReport = async (shift) => {
    if (!shift.report_text) return;
    try {
      await navigator.clipboard.writeText(shift.report_text);
      setCopiedId(shift.id);
      setTimeout(() => setCopiedId(null), 2000);
    } catch (_) { /* ignore */ }
  };

  const isHq = localStorage.getItem('companyId') === '1';

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
        {/* Header */}
        <div className="bg-white border border-[#e0e0e0] rounded-3xl p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 min-w-0">
          <h1 className="text-lg sm:text-2xl font-black tracking-tight flex items-center gap-2">
            <FileText className="h-5 w-5 sm:h-6 sm:w-6 text-[#5f1340] shrink-0" />
            Daily Report
          </h1>
          <div className="grid grid-cols-[minmax(0,1fr)_auto] gap-2 w-full sm:w-auto sm:flex sm:items-center min-w-0">
            {isHq && (
              <select
                value={activeOutletId}
                onChange={(e) => {
                  const id = e.target.value;
                  const o = outlets.find((x) => String(x.id) === String(id));
                  setActiveOutletId(id);
                  if (o) setActiveOutletName(o.full_name || o.name);
                }}
                className="col-span-2 w-full min-w-0 sm:w-auto sm:max-w-[240px] bg-white px-3 py-2.5 border border-[#e0e0e0] rounded-xl text-xs font-bold outline-none focus:border-[#5f1340] truncate"
              >
                {outlets.map((o) => (
                  <option key={o.id} value={o.id}>{o.full_name || o.name}</option>
                ))}
              </select>
            )}
            <input
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              className="w-full min-w-0 sm:w-auto appearance-none [-webkit-appearance:none] bg-white px-3 py-2.5 border border-[#e0e0e0] rounded-xl text-xs font-bold outline-none focus:border-[#5f1340]"
            />
            <button
              type="button"
              onClick={handleExport}
              disabled={exporting || loading || shifts.length === 0}
              className="whitespace-nowrap px-3.5 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-black flex items-center justify-center gap-1.5 disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
            >
              <FileSpreadsheet className="h-4 w-4 shrink-0" />
              {exporting ? 'Mengekspor...' : 'Excel'}
            </button>
          </div>
        </div>

        {loading ? (
          <div className="bg-white border border-[#e0e0e0] rounded-3xl p-12 text-center text-slate-400 text-xs font-bold">
            Memuat laporan...
          </div>
        ) : shifts.length === 0 ? (
          <div className="bg-white border border-[#e0e0e0] rounded-3xl p-12 text-center text-slate-400 text-xs font-bold">
            Tidak ada shift di tanggal ini
          </div>
        ) : (
          shifts.map((s) => {
            const isOpen = s.status === 'Open';
            const txs = s.transactions || [];
            const done = txs.filter((t) => Number(t.is_verified) === 1).length;
            const allDone = txs.length > 0 && done === txs.length;
            return (
              <section key={s.id} className="bg-white border border-[#e0e0e0] rounded-3xl p-4 sm:p-5 flex flex-col gap-4 min-w-0">
                {/* Judul shift + status + salin */}
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <h2 className="text-base font-black text-[#5f1340]">
                        Shift {Number(s.shift_number) === 2 ? 'Siang' : 'Pagi'}
                      </h2>
                      <span className={`px-2 py-0.5 rounded-full text-[10px] font-black border ${isOpen ? 'bg-emerald-50 text-emerald-700 border-emerald-200' : 'bg-slate-100 text-slate-600 border-slate-200'}`}>
                        {isOpen ? 'Open' : (s.close_type ? `Closed · ${s.close_type}` : s.status)}
                      </span>
                    </div>
                    <p className="text-[11px] text-slate-500 mt-1 break-words">
                      Buka <strong className="text-[#313030]">{fmtTime(s.opened_at)}</strong> · {formatEmployeeName(s.opener_name)}
                      {s.closed_at && (
                        <>
                          <span className="text-slate-300 mx-1.5">→</span>
                          Tutup <strong className="text-[#313030]">{fmtTime(s.closed_at)}</strong>
                          {s.closed_by_name ? ` · ${formatEmployeeName(s.closed_by_name)}` : ''}
                        </>
                      )}
                    </p>
                  </div>
                  {s.report_text && (
                    <button
                      type="button"
                      onClick={() => copyReport(s)}
                      title="Salin teks report"
                      className="shrink-0 px-3 py-2 bg-[#5f1340]/10 hover:bg-[#5f1340]/15 text-[#5f1340] rounded-xl text-[11px] font-black flex items-center gap-1.5 cursor-pointer"
                    >
                      {copiedId === s.id ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
                      <span className="hidden sm:inline">{copiedId === s.id ? 'Tersalin' : 'Salin Report'}</span>
                    </button>
                  )}
                </div>

                {/* Angka utama */}
                <div className="grid grid-cols-2 lg:grid-cols-4 gap-2.5">
                  <Stat label="Modal Cash" value={s.initial_cash} />
                  <Stat label="Petty Cash Awal" value={s.initial_petty_cash} />
                  <Stat label="Cash Aktual Tutup" value={s.actual_cash} />
                  <Stat label="Revenue" value={s.declared_revenue} highlight />
                </div>

                {s.open_imbalance_reason && (
                  <p className="px-3 py-2 bg-amber-50 border border-amber-200 rounded-xl text-[11px] text-amber-900">
                    <strong>Selisih saat buka:</strong> {s.open_imbalance_reason}
                  </p>
                )}

                {s.close_type === 'Final' && (
                  <div className="flex items-center gap-x-2 gap-y-1 flex-wrap px-3 py-2 bg-[#f8f8f8] border border-[#e0e0e0]/70 rounded-xl text-[11px]">
                    <Banknote className="h-4 w-4 text-slate-500 shrink-0" />
                    <span className="font-bold text-slate-600">Setoran Tunai:</span>
                    {s.deposit_proof_url ? (
                      <>
                        <a href={s.deposit_proof_url} target="_blank" rel="noreferrer" className="text-[#5f1340] font-black underline">
                          Lihat bukti
                        </a>
                        {s.deposit_uploaded_at && (
                          <span className="text-slate-400">
                            {s.deposit_uploaded_by_name ? `${formatEmployeeName(s.deposit_uploaded_by_name)} · ` : ''}{fmtTime(s.deposit_uploaded_at)}
                          </span>
                        )}
                        {s.deposit_notes && <span className="text-slate-600 w-full sm:w-auto">"{s.deposit_notes}"</span>}
                      </>
                    ) : (
                      <button type="button" onClick={() => navigate('/deposit-report')} className="text-amber-700 font-black underline cursor-pointer">
                        Belum diupload
                      </button>
                    )}
                  </div>
                )}

                {/* Nota dibayar di shift ini */}
                {txs.length > 0 && (
                  <div className="min-w-0">
                    <button
                      type="button"
                      onClick={() => setOpenTx((p) => ({ ...p, [s.id]: !p[s.id] }))}
                      className="w-full flex items-center justify-between gap-2 px-3.5 py-2.5 rounded-xl border border-[#e0e0e0] hover:border-[#5f1340]/30 bg-white cursor-pointer"
                    >
                      <span className="flex items-center gap-2 flex-wrap text-xs font-black text-[#313030]">
                        Nota dibayar
                        <span className="px-2 py-0.5 rounded-full bg-[#5f1340]/10 text-[#5f1340] text-[10px]">{txs.length}</span>
                        <span className={`px-2 py-0.5 rounded-full text-[10px] ${allDone ? 'bg-emerald-600 text-white' : 'bg-amber-100 text-amber-800'}`}>
                          {done}/{txs.length} dicek
                        </span>
                      </span>
                      <ChevronDown className={`h-4 w-4 text-slate-500 shrink-0 transition-transform ${openTx[s.id] ? 'rotate-180' : ''}`} />
                    </button>

                    {openTx[s.id] && (
                      <div className="mt-2 border border-[#e0e0e0] rounded-xl overflow-hidden">
                        {/* HP: daftar ringkas */}
                        <ul className="sm:hidden divide-y divide-[#e0e0e0]/70 max-h-96 overflow-y-auto">
                          {txs.map((t) => {
                            const ok = Number(t.is_verified) === 1;
                            return (
                              <li key={t.id} className={`flex items-center gap-3 px-3 py-2.5 ${ok ? 'bg-emerald-50/50' : ''}`}>
                                <div className="min-w-0 flex-1">
                                  <div className="flex items-center justify-between gap-2">
                                    <span className="font-mono text-[11px] font-bold text-[#5f1340] truncate">{t.order_no}</span>
                                    <span className="text-xs font-black tabular-nums shrink-0">Rp {Number(t.paid_here || 0).toLocaleString('id-ID')}</span>
                                  </div>
                                  <p className="text-[11px] text-slate-500 truncate">
                                    {fmtTime(t.last_paid_at || t.order_date)} · {t.customer_name || '-'} · {t.payment_status === 'DP' ? 'DP ' : ''}{t.payment_method || '-'}
                                  </p>
                                </div>
                                <VerifyButton ok={ok} open={isOpen} onClick={() => toggleVerify(s.id, t)} />
                              </li>
                            );
                          })}
                        </ul>

                        {/* Tablet/desktop: tabel */}
                        <div className="hidden sm:block overflow-auto max-h-96">
                          <table className="w-full text-xs">
                            <thead className="sticky top-0 bg-[#f8f8f8]">
                              <tr className="text-[10px] uppercase text-slate-400 font-extrabold">
                                <th className="py-2 px-3 text-left">Jam</th>
                                <th className="py-2 px-3 text-left">No Nota</th>
                                <th className="py-2 px-3 text-left">Customer</th>
                                <th className="py-2 px-3 text-left">Bayar</th>
                                <th className="py-2 px-3 text-right">Nominal</th>
                                <th className="py-2 px-3 text-center">Cek</th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-[#e0e0e0]/60 font-semibold">
                              {txs.map((t) => {
                                const ok = Number(t.is_verified) === 1;
                                return (
                                  <tr key={t.id} className={ok ? 'bg-emerald-50/40' : ''}>
                                    <td className="py-2 px-3 tabular-nums">{fmtTime(t.last_paid_at || t.order_date)}</td>
                                    <td className="py-2 px-3 font-mono text-[#5f1340]">{t.order_no}</td>
                                    <td className="py-2 px-3">
                                      {t.customer_name || '-'}
                                      {t.customer_address && (
                                        <span className="block text-[10px] font-medium text-slate-400 max-w-[260px] truncate" title={t.customer_address}>{t.customer_address}</span>
                                      )}
                                    </td>
                                    <td className="py-2 px-3">{t.payment_status === 'DP' ? 'DP ' : ''}{t.payment_method || '-'}</td>
                                    <td className="py-2 px-3 text-right tabular-nums">Rp {Number(t.paid_here || 0).toLocaleString('id-ID')}</td>
                                    <td className="py-2 px-3 text-center">
                                      <VerifyButton ok={ok} open={isOpen} onClick={() => toggleVerify(s.id, t)} />
                                    </td>
                                  </tr>
                                );
                              })}
                            </tbody>
                          </table>
                        </div>
                      </div>
                    )}
                  </div>
                )}

                {/* Teks report (dilipat) */}
                {s.report_text && (
                  <details className="group">
                    <summary className="list-none [&::-webkit-details-marker]:hidden cursor-pointer text-[11px] font-black text-slate-500 hover:text-[#5f1340] inline-flex items-center gap-1">
                      <ChevronDown className="h-3.5 w-3.5 transition-transform group-open:rotate-180" />
                      Teks report
                    </summary>
                    <pre className="mt-2 text-[11px] font-mono bg-[#f8f8f8] border border-[#e0e0e0] rounded-2xl p-4 whitespace-pre-wrap break-words text-slate-700 max-h-72 overflow-y-auto">
                      {s.report_text}
                    </pre>
                  </details>
                )}
              </section>
            );
          })
        )}
      </main>
    </div>
  );
}

/** Jam:menit dari tanggal ISO. */
function fmtTime(v) {
  if (!v) return '-';
  const d = new Date(v);
  return Number.isNaN(d.getTime()) ? '-' : d.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' });
}

function Stat({ label, value, highlight = false }) {
  return (
    <div className="px-3 py-2.5 bg-[#f8f8f8] rounded-xl border border-[#e0e0e0]/70 min-w-0">
      <span className="text-[10px] text-slate-400 font-bold block truncate">{label}</span>
      <span className={`text-sm sm:text-base font-black tabular-nums block truncate ${highlight ? 'text-[#5f1340]' : 'text-[#313030]'}`}>
        Rp {Number(value || 0).toLocaleString('id-ID')}
      </span>
    </div>
  );
}

function VerifyButton({ ok, open, onClick }) {
  return (
    <button
      type="button"
      disabled={!open}
      onClick={onClick}
      title={!open ? 'Shift sudah ditutup' : (ok ? 'Batalkan ceklis' : 'Ceklis')}
      className={`inline-flex items-center justify-center w-8 h-8 shrink-0 rounded-lg border ${ok ? 'bg-emerald-600 border-emerald-600 text-white' : 'bg-white border-[#e0e0e0] text-slate-400'} ${open ? 'cursor-pointer' : 'opacity-60 cursor-not-allowed'}`}
    >
      <Check className="h-4 w-4" />
    </button>
  );
}
