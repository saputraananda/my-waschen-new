import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import HeaderNav from '../../components/HeaderNav';
import { formatEmployeeName } from '../../utils/FormatName.js';
import { Copy, FileText } from 'lucide-react';

export default function DailyReport() {
  const navigate = useNavigate();
  const [userProfile, setUserProfile] = useState(null);
  const [activeOutletName, setActiveOutletName] = useState(localStorage.getItem('activeOutletName') || '');
  const [activeOutletId, setActiveOutletId] = useState(localStorage.getItem('activeOutletId') || '2');
  const [outlets, setOutlets] = useState([]);
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [shifts, setShifts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [copiedId, setCopiedId] = useState(null);

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
              <p className="text-xs text-slate-400 mt-0.5">Riwayat open/close shift — view only</p>
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
                  <span className="text-[9px] text-slate-400 font-bold uppercase block">Revenue Dideklarasi</span>
                  <span className="font-black text-[#5f1340]">Rp {Number(s.declared_revenue || 0).toLocaleString('id-ID')}</span>
                </div>
              </div>

              {s.open_imbalance_reason && (
                <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl text-[11px] text-amber-900">
                  <strong>Alasan imbalance open:</strong> {s.open_imbalance_reason}
                </div>
              )}

              {s.verifiedTransactions?.length > 0 && (
                <div>
                  <span className="text-[10px] font-black text-slate-400 uppercase tracking-wider block mb-2">
                    Nota terverifikasi ({s.verifiedTransactions.length})
                  </span>
                  <div className="overflow-x-auto border border-[#e0e0e0] rounded-xl">
                    <table className="w-full text-xs">
                      <thead>
                        <tr className="bg-[#f8f8f8] text-[10px] uppercase text-slate-400 font-extrabold">
                          <th className="py-2 px-3 text-left">No Nota</th>
                          <th className="py-2 px-3 text-left">Customer</th>
                          <th className="py-2 px-3 text-left">Bayar</th>
                          <th className="py-2 px-3 text-right">Nominal</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-[#e0e0e0]/60 font-semibold">
                        {s.verifiedTransactions.map((v) => (
                          <tr key={v.id}>
                            <td className="py-2 px-3 font-mono text-[#5f1340]">{v.order_no}</td>
                            <td className="py-2 px-3">{v.customer_name || '-'}</td>
                            <td className="py-2 px-3">{v.payment_method || '-'}</td>
                            <td className="py-2 px-3 text-right">Rp {Number(v.grand_total || 0).toLocaleString('id-ID')}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
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
