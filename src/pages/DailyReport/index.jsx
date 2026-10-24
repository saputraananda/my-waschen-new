import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import HeaderNav from '../../components/HeaderNav';
import { formatEmployeeName } from '../../utils/FormatName.js';
import { todayWibISO } from '../../utils/wib.js';
import { Copy, FileText, Banknote, Check, ChevronDown } from 'lucide-react';

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

  const copyReport = async (shift) => {
    if (!shift.report_text) return;
    try {
      await navigator.clipboard.writeText(shift.report_text);
      setCopiedId(shift.id);
      setTimeout(() => setCopiedId(null), 2000);
    } catch (_) { /* ignore */ }
  };

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
        <div className="bg-white border border-[#e0e0e0] rounded-3xl p-5 shadow-xs flex flex-col sm:flex-row justify-between gap-4 items-start sm:items-center">
          <div className="flex items-center gap-3">
            <div className="p-3 bg-[#5f1340]/10 text-[#5f1340] rounded-2xl">
              <FileText className="h-5 w-5" />
            </div>
            <div>
              <h1 className="text-xl font-black tracking-tight">Daily Report Shift</h1>
              <p className="text-xs text-slate-400 mt-0.5">Riwayat open/close shift & ceklis nota</p>
            </div>
          </div>
          <div className="flex items-center gap-2 w-full sm:w-auto">
            <input
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              className="px-3 py-2 border border-[#e0e0e0] rounded-xl text-xs font-bold outline-none focus:border-[#5f1340]"
            />
            {localStorage.getItem('companyId') === '1' && (
              <select
                value={activeOutletId}
                onChange={(e) => {
                  const id = e.target.value;
                  const o = outlets.find((x) => String(x.id) === String(id));
                  setActiveOutletId(id);
                  if (o) setActiveOutletName(o.full_name || o.name);
                }}
                className="px-3 py-2 border border-[#e0e0e0] rounded-xl text-xs font-bold outline-none focus:border-[#5f1340]"
              >
                {outlets.map((o) => (
                  <option key={o.id} value={o.id}>{o.full_name || o.name}</option>
                ))}
              </select>
            )}
          </div>
        </div>

        {loading ? (
          <div className="bg-white border border-[#e0e0e0] rounded-3xl p-12 text-center text-slate-400 text-xs font-bold">
            Memuat laporan...
          </div>
        ) : shifts.length === 0 ? (
          <div className="bg-white border border-[#e0e0e0] rounded-3xl p-12 text-center text-slate-400 text-xs font-bold">
            Tidak ada data shift untuk tanggal ini
          </div>
        ) : (
          shifts.map((s) => (
            <div key={s.id} className="bg-white border border-[#e0e0e0] rounded-3xl p-5 shadow-xs flex flex-col gap-4">
              <div className="flex flex-wrap justify-between gap-3 items-start border-b border-[#e0e0e0] pb-3">
                <div>
                  <h2 className="text-sm font-black text-[#5f1340]">
                    Shift {Number(s.shift_number) === 2 ? 'Siang' : 'Pagi'} · #{s.id}
                  </h2>
                  <p className="text-[11px] text-slate-500 mt-0.5">
                    Status: <strong>{s.status}</strong>
                    {s.close_type ? ` · ${s.close_type}` : ''}
                    {' · '}Buka: {s.opened_at ? new Date(s.opened_at).toLocaleString('id-ID') : '-'}
                    {s.closed_at ? ` · Tutup: ${new Date(s.closed_at).toLocaleString('id-ID')}` : ''}
                  </p>
                  <p className="text-[11px] text-slate-600 mt-1">
                    Dibuka: <strong>{formatEmployeeName(s.opener_name)}</strong>
                    {s.closed_by_name ? (
                      <> · Ditutup: <strong>{formatEmployeeName(s.closed_by_name)}</strong></>
                    ) : null}
                  </p>
                </div>
                {s.report_text && (
                  <button
                    type="button"
                    onClick={() => copyReport(s)}
                    className="px-3 py-1.5 bg-[#5f1340]/10 text-[#5f1340] rounded-xl text-[11px] font-black flex items-center gap-1.5 cursor-pointer"
                  >
                    <Copy className="h-3.5 w-3.5" />
                    {copiedId === s.id ? 'Tersalin' : 'Salin Report'}
                  </button>
                )}
              </div>

              <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-xs">
                <div className="p-3 bg-slate-50 rounded-xl border border-[#e0e0e0]">
                  <span className="text-[9px] text-slate-400 font-bold uppercase block">Cash Modal Open</span>
                  <span className="font-black text-[#313030]">Rp {Number(s.initial_cash || 0).toLocaleString('id-ID')}</span>
                </div>
                <div className="p-3 bg-slate-50 rounded-xl border border-[#e0e0e0]">
                  <span className="text-[9px] text-slate-400 font-bold uppercase block">Petty Open</span>
                  <span className="font-black text-[#313030]">Rp {Number(s.initial_petty_cash || 0).toLocaleString('id-ID')}</span>
                </div>
                <div className="p-3 bg-slate-50 rounded-xl border border-[#e0e0e0]">
                  <span className="text-[9px] text-slate-400 font-bold uppercase block">Cash Aktual Close</span>
                  <span className="font-black text-[#313030]">Rp {Number(s.actual_cash || 0).toLocaleString('id-ID')}</span>
                </div>
                <div className="p-3 bg-slate-50 rounded-xl border border-[#e0e0e0]">
                  <span className="text-[9px] text-slate-400 font-bold uppercase block">Revenue</span>
                  <span className="font-black text-[#5f1340]">Rp {Number(s.declared_revenue || 0).toLocaleString('id-ID')}</span>
                </div>
              </div>

              {s.open_imbalance_reason && (
                <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl text-[11px] text-amber-900">
                  <strong>Alasan imbalance open:</strong> {s.open_imbalance_reason}
                </div>
              )}

              {s.close_type === 'Final' && (
                <div className="p-3 bg-slate-50 border border-[#e0e0e0] rounded-xl text-[11px] space-y-2">
                  <span className="text-[9px] text-slate-400 font-bold uppercase flex items-center gap-1.5">
                    <Banknote className="h-3.5 w-3.5" /> Setoran Tunai
                  </span>
                  {s.deposit_proof_url ? (
                    <div className="flex flex-wrap items-start gap-3">
                      <a
                        href={s.deposit_proof_url}
                        target="_blank"
                        rel="noreferrer"
                        className="text-[#5f1340] font-black underline"
                      >
                        Lihat Bukti Setoran
                      </a>
                      {s.deposit_notes && (
                        <span className="text-slate-600 font-medium">Catatan: {s.deposit_notes}</span>
                      )}
                      {s.deposit_uploaded_at && (
                        <span className="text-slate-400">
                          · {s.deposit_uploaded_by_name ? `${formatEmployeeName(s.deposit_uploaded_by_name)} · ` : ''}
                          {new Date(s.deposit_uploaded_at).toLocaleString('id-ID')}
                        </span>
                      )}
                    </div>
                  ) : (
                    <span className="text-amber-700 font-bold">
                      Belum diupload —{' '}
                      <button
                        type="button"
                        onClick={() => navigate('/deposit-report')}
                        className="underline cursor-pointer"
                      >
                        buka menu Setoran Tunai
                      </button>
                    </span>
                  )}
                </div>
              )}

              {s.transactions?.length > 0 && (
                <div>
                  {(() => {
                    const done = s.transactions.filter((t) => Number(t.is_verified) === 1).length;
                    const all = done === s.transactions.length;
                    return (
                      <button type="button" onClick={() => setOpenTx((p) => ({ ...p, [s.id]: !p[s.id] }))}
                        className="w-full flex justify-between items-center gap-2 px-4 py-3 mb-2 rounded-xl border border-[#5f1340]/20 bg-[#5f1340]/5 hover:bg-[#5f1340]/10 cursor-pointer">
                        <span className="flex items-center gap-2 text-xs font-black text-[#5f1340]">
                          Nota dibayar di shift ini
                          <span className="px-2 py-0.5 rounded-full bg-[#5f1340] text-white text-[10px]">{s.transactions.length} nota</span>
                          <span className={`px-2 py-0.5 rounded-full text-[10px] ${all ? 'bg-emerald-600 text-white' : 'bg-amber-100 text-amber-800'}`}>
                            {done}/{s.transactions.length} diceklis
                          </span>
                        </span>
                        <ChevronDown className={`h-4 w-4 text-[#5f1340] transition-transform ${openTx[s.id] ? 'rotate-180' : ''}`} />
                      </button>
                    );
                  })()}
                  {openTx[s.id] && (
                  <div className="overflow-auto max-h-80 border border-[#e0e0e0] rounded-xl">
                    <table className="w-full text-xs">
                      <thead className="sticky top-0">
                        <tr className="bg-[#f8f8f8] text-[10px] uppercase text-slate-400 font-extrabold">
                          <th className="py-2 px-3 text-left">Jam</th>
                          <th className="py-2 px-3 text-left">No Nota</th>
                          <th className="py-2 px-3 text-left">Customer</th>
                          <th className="py-2 px-3 text-left">Bayar</th>
                          <th className="py-2 px-3 text-right">Nominal</th>
                          <th className="py-2 px-3 text-center">Cek</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-[#e0e0e0]/60 font-semibold">
                        {s.transactions.map((t) => {
                          const ok = Number(t.is_verified) === 1;
                          return (
                            <tr key={t.id} className={ok ? 'bg-emerald-50/40' : ''}>
                              <td className="py-2 px-3">{new Date(t.last_paid_at || t.order_date).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })}</td>
                              <td className="py-2 px-3 font-mono text-[#5f1340]">{t.order_no}</td>
                              <td className="py-2 px-3">{t.customer_name || '-'}{t.customer_address && <span className="block text-[10px] font-medium text-slate-400 max-w-[260px] truncate" title={t.customer_address}>{t.customer_address}</span>}</td>
                              <td className="py-2 px-3">{t.payment_status === 'DP' ? 'DP ' : ''}{t.payment_method || '-'}</td>
                              <td className="py-2 px-3 text-right">Rp {Number(t.paid_here || 0).toLocaleString('id-ID')}</td>
                              <td className="py-2 px-3 text-center">
                                <button
                                  type="button"
                                  disabled={s.status !== 'Open'}
                                  onClick={() => toggleVerify(s.id, t)}
                                  title={s.status !== 'Open' ? 'Shift sudah ditutup' : (ok ? 'Batalkan ceklis' : 'Ceklis')}
                                  className={`inline-flex items-center justify-center w-7 h-7 rounded-lg border ${ok ? 'bg-emerald-600 border-emerald-600 text-white' : 'bg-white border-[#e0e0e0] text-slate-400'} ${s.status === 'Open' ? 'cursor-pointer' : 'opacity-60 cursor-not-allowed'}`}
                                >
                                  <Check className="h-3.5 w-3.5" />
                                </button>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                  )}
                </div>
              )}
              {s.report_text && (
                <pre className="text-[11px] font-mono bg-slate-50 border border-[#e0e0e0] rounded-2xl p-4 whitespace-pre-wrap text-slate-700 max-h-64 overflow-y-auto">
                  {s.report_text}
                </pre>
              )}
            </div>
          ))
        )}
      </main>
    </div>
  );
}
