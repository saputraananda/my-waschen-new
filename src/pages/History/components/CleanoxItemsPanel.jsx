import React, { useState } from 'react';
import axios from 'axios';
import { Sparkles, PauseCircle, CheckCircle2, XCircle, Loader2 } from 'lucide-react';
import PinVerifyModal from '../../Shift/PinVerifyModal.jsx';

// Phase 17 — Cleanox By Waschen: progres per barang fisik (tr_cleanox_by_waschen) + keputusan hold.
const STAGES = [
  { key: 'pickup', label: 'Pickup' },
  { key: 'cuci_jemur', label: 'Cuci Jemur' },
  { key: 'packing', label: 'Packing' },
  { key: 'pengantaran', label: 'Pengantaran' }
];

const STATUS_TONE = {
  Pickup: 'bg-sky-50 text-sky-800 border-sky-200',
  'Cuci Jemur': 'bg-indigo-50 text-indigo-800 border-indigo-200',
  Packing: 'bg-amber-50 text-amber-800 border-amber-200',
  Pengantaran: 'bg-emerald-50 text-emerald-800 border-emerald-200'
};

const fmtTime = (v) => {
  if (!v) return null;
  const d = new Date(v);
  if (Number.isNaN(d.getTime())) return null;
  return d.toLocaleString('id-ID', { timeZone: 'Asia/Jakarta', day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' });
};

const names = (v) => {
  if (!v) return '';
  if (Array.isArray(v)) return v.join(', ');
  try {
    const parsed = JSON.parse(v);
    return Array.isArray(parsed) ? parsed.join(', ') : String(parsed);
  } catch {
    return String(v);
  }
};

export default function CleanoxItemsPanel({ cleanoxItems, orderDbId, outletId, onChanged, showToast }) {
  const [pending, setPending] = useState(null); // { item, decision }
  const [notes, setNotes] = useState({});
  const [savingId, setSavingId] = useState(null);

  if (!cleanoxItems?.length) return null;

  const countByDetail = cleanoxItems.reduce((m, c) => m.set(c.transaction_detail_id, (m.get(c.transaction_detail_id) || 0) + 1), new Map());
  const holdCount = cleanoxItems.filter((c) => Number(c.on_hold) === 1).length;

  const submitDecision = async (employeeId) => {
    const { item, decision } = pending;
    setPending(null);
    setSavingId(item.id);
    try {
      const res = await axios.patch(`/api/transactions/${orderDbId}/cleanox-items/${item.id}/decision`, {
        decision,
        note: notes[item.id] || '',
        cashierEmployeeId: employeeId
      });
      onChanged(res.data?.data?.cleanoxItems || []);
      showToast('Keputusan Tersimpan', res.data?.message || 'Keputusan Cleanox tersimpan', 'success');
    } catch (err) {
      showToast('Gagal', err.response?.data?.message || 'Gagal menyimpan keputusan Cleanox', 'error');
    } finally {
      setSavingId(null);
    }
  };

  return (
    <div className="bg-white border border-sky-200 rounded-3xl p-5 shadow-2xs">
      <div className="mb-4 flex items-start justify-between gap-3">
        <div>
          <h2 className="text-base font-black text-[#313030] flex items-center gap-2">
            <Sparkles className="h-4 w-4 text-sky-600" />
            Cleanox By Waschen
          </h2>
          <p className="text-[11px] text-slate-400 mt-0.5">{cleanoxItems.length} barang dikerjakan tim Cleanox</p>
        </div>
        {holdCount > 0 && (
          <span className="shrink-0 text-[10px] font-extrabold text-rose-800 bg-rose-50 border border-rose-200 px-2 py-1 rounded-lg">
            {holdCount} menunggu keputusan
          </span>
        )}
      </div>

      <div className="space-y-3">
        {cleanoxItems.map((c) => {
          const isHold = Number(c.on_hold) === 1;
          const multi = (countByDetail.get(c.transaction_detail_id) || 1) > 1;
          const deadline = c.status === 'Cuci Jemur' ? fmtTime(c.cuci_jemur_deadline_at) : null;
          return (
            <div key={c.id} className={`border rounded-2xl p-3.5 ${isHold ? 'border-rose-300 bg-rose-50/40' : 'border-[#e0e0e0]'}`}>
              <div className="flex flex-wrap items-center gap-1.5">
                <span className="font-black text-sm text-[#313030]">
                  {c.service_name}{multi ? ` #${c.item_ke}` : ''}
                </span>
                <span className={`text-[9px] font-extrabold px-1.5 py-0.5 rounded-md border ${STATUS_TONE[c.status] || 'bg-slate-50 text-slate-600 border-slate-200'}`}>
                  {c.status || 'Belum diproses'}
                </span>
                {isHold && (
                  <span className="text-[9px] font-extrabold text-rose-800 bg-rose-100 border border-rose-200 px-1.5 py-0.5 rounded-md inline-flex items-center gap-1">
                    <PauseCircle className="h-3 w-3" /> Ditahan Cleanox
                  </span>
                )}
                {c.qc_frontliner_at && (
                  <span className="text-[9px] font-extrabold text-emerald-800 bg-emerald-50 border border-emerald-200 px-1.5 py-0.5 rounded-md">
                    QC frontliner {fmtTime(c.qc_frontliner_at)}
                  </span>
                )}
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mt-3 text-[11px]">
                {STAGES.map((s) => {
                  const at = fmtTime(c[`${s.key}_at`]);
                  return (
                    <div key={s.key} className={`rounded-xl px-2.5 py-2 border ${at ? 'bg-white border-[#e0e0e0]' : 'bg-[#fafafa] border-dashed border-[#e0e0e0]'}`}>
                      <span className="text-[9px] font-bold text-slate-400 uppercase tracking-wider block">{s.label}</span>
                      <span className={`font-bold block truncate ${at ? 'text-[#313030]' : 'text-slate-300'}`}>{at || '-'}</span>
                      {at && <span className="text-[10px] text-slate-500 block truncate">{names(c[`${s.key}_by`])}</span>}
                    </div>
                  );
                })}
              </div>

              {deadline && <p className="text-[10px] font-bold text-indigo-700 mt-2">Batas Cuci Jemur: {deadline}</p>}
              {c.cleanox_note && (
                <p className="text-[11px] text-slate-600 mt-2"><span className="font-bold">Catatan Cleanox:</span> {c.cleanox_note}</p>
              )}
              {c.is_continue != null && !isHold && (
                <p className="text-[11px] text-slate-600 mt-2">
                  <span className="font-bold">Keputusan frontliner:</span> {Number(c.is_continue) === 1 ? 'Lanjut' : 'Batal'}
                  {c.continue_by ? ` oleh ${c.continue_by}` : ''}{c.continue_note ? ` — ${c.continue_note}` : ''}
                </p>
              )}

              {isHold && (
                <div className="mt-3 space-y-2">
                  <textarea
                    rows={2}
                    value={notes[c.id] || ''}
                    onChange={(e) => setNotes((p) => ({ ...p, [c.id]: e.target.value }))}
                    placeholder="Catatan keputusan (opsional)"
                    className="w-full text-xs border border-[#e0e0e0] rounded-xl px-3 py-2 outline-none focus:border-[#5f1340]/40"
                  />
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      type="button"
                      disabled={savingId === c.id}
                      onClick={() => setPending({ item: c, decision: 'lanjut' })}
                      className="min-h-[40px] rounded-xl text-xs font-black bg-emerald-600 text-white inline-flex items-center justify-center gap-1.5 cursor-pointer disabled:opacity-50"
                    >
                      {savingId === c.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />}
                      Lanjut
                    </button>
                    <button
                      type="button"
                      disabled={savingId === c.id}
                      onClick={() => setPending({ item: c, decision: 'batal' })}
                      className="min-h-[40px] rounded-xl text-xs font-black bg-rose-600 text-white inline-flex items-center justify-center gap-1.5 cursor-pointer disabled:opacity-50"
                    >
                      <XCircle className="h-4 w-4" />
                      Batal
                    </button>
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {pending && (
        <PinVerifyModal
          outletId={outletId}
          mode="pin"
          title={pending.decision === 'lanjut' ? 'PIN Lanjutkan Item Cleanox' : 'PIN Batalkan Item Cleanox'}
          description="Masukkan PIN frontliner yang mengambil keputusan."
          submitLabel="Simpan Keputusan"
          onCancel={() => setPending(null)}
          onVerified={({ employeeId }) => submitDecision(employeeId)}
        />
      )}
    </div>
  );
}
