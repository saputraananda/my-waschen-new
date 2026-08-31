import React, { useMemo, useState } from 'react';
import axios from 'axios';
import { Search, AlertTriangle, RefreshCcw, CalendarDays, SlidersHorizontal } from 'lucide-react';
import { useAppDialog } from '../../../context/AppDialogContext.jsx';

function fmtQty(n) {
  const v = parseFloat(n);
  if (Number.isNaN(v)) return '0';
  return v.toLocaleString('id-ID', { maximumFractionDigits: 2 });
}

function ThresholdModal({ row, isAdmin, onClose, onDone }) {
  const { showAlert } = useAppDialog();
  const [minStock, setMinStock] = useState(String(row.min_stock ?? 0));
  const [qtyOpening, setQtyOpening] = useState(String(row.qty_opening ?? 0));
  const [periodStart, setPeriodStart] = useState(
    row.period_start ? String(row.period_start).slice(0, 10) : ''
  );
  const [saving, setSaving] = useState(false);

  const submit = async () => {
    setSaving(true);
    try {
      const payload = { minStock: parseFloat(minStock) || 0 };
      if (isAdmin) {
        payload.qtyOpening = parseFloat(qtyOpening) || 0;
        if (periodStart) payload.periodStart = periodStart;
      }
      const res = await axios.put(`/api/inventory/stock/${row.stock_id}`, payload);
      if (!res.data?.success) throw new Error(res.data?.message || 'Gagal');
      await showAlert({ title: 'Disimpan', message: `Data stok ${row.item_name} diperbarui`, type: 'success' });
      onDone();
      onClose();
    } catch (err) {
      await showAlert({
        title: 'Gagal',
        message: err?.response?.data?.message || err.message,
        type: 'error'
      });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[100] bg-[#313030]/60 backdrop-blur-xs flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-white rounded-3xl border w-full max-w-sm shadow-2xl" onClick={(e) => e.stopPropagation()}>
        <div className="p-4 border-b bg-[#f8f8f8]">
          <h3 className="text-sm font-black">Pengaturan Stok</h3>
          <p className="text-[11px] text-slate-500 font-bold">{row.item_name}</p>
        </div>
        <div className="p-4 space-y-3">
          {isAdmin && (
            <>
              <div>
                <label className="text-[10px] font-extrabold uppercase block mb-1">Stok Awal</label>
                <input
                  type="number"
                  step="0.01"
                  value={qtyOpening}
                  onChange={(e) => setQtyOpening(e.target.value)}
                  className="w-full px-3 py-2.5 border rounded-xl text-xs font-bold outline-none focus:border-[#5f1340] [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                />
              </div>
              <div>
                <label className="text-[10px] font-extrabold uppercase block mb-1">Awal Periode</label>
                <input
                  type="date"
                  value={periodStart}
                  onChange={(e) => setPeriodStart(e.target.value)}
                  className="w-full px-3 py-2.5 border rounded-xl text-xs font-bold outline-none focus:border-[#5f1340]"
                />
              </div>
            </>
          )}
          <div>
            <label className="text-[10px] font-extrabold uppercase block mb-1">Min Stock</label>
            <input
              type="number"
              step="0.01"
              value={minStock}
              onChange={(e) => setMinStock(e.target.value)}
              className="w-full px-3 py-2.5 border rounded-xl text-xs font-bold outline-none focus:border-[#5f1340] [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
            />
          </div>
        </div>
        <div className="p-4 border-t bg-[#f8f8f8] flex gap-2">
          <button type="button" onClick={onClose} className="flex-1 py-2.5 rounded-xl border text-xs font-black cursor-pointer">Batal</button>
          <button type="button" disabled={saving} onClick={submit} className="flex-1 py-2.5 rounded-xl bg-[#5f1340] text-white text-xs font-black cursor-pointer disabled:opacity-50">
            Simpan
          </button>
        </div>
      </div>
    </div>
  );
}

function AktualModal({ row, usageDate, onClose, onDone }) {
  const { showAlert, showConfirm } = useAppDialog();
  const [tab, setTab] = useState('add');
  const [qty, setQty] = useState('');
  const [saving, setSaving] = useState(false);

  const totalHari = parseFloat(row.qty_aktual_hari) || 0;

  const submit = async (direction) => {
    const n = parseFloat(qty);
    if (direction === 'reset') {
      if (qty === '' || Number.isNaN(n) || n < 0) {
        await showAlert({ title: 'Qty wajib', message: 'Isi total baru (≥ 0)', type: 'warning' });
        return;
      }
    } else if (!(n > 0)) {
      await showAlert({ title: 'Qty wajib', message: 'Isi jumlah lebih dari 0', type: 'warning' });
      return;
    }
    if (direction === 'subtract' && n > totalHari) {
      await showAlert({
        title: 'Gagal',
        message: `Maks. kurang ${fmtQty(totalHari)}`,
        type: 'warning'
      });
      return;
    }

    if (direction === 'reset') {
      const ok = await showConfirm({
        title: 'Reset?',
        message: `Set total dari ${fmtQty(totalHari)} ke ${fmtQty(n)}?`,
        confirmLabel: 'Reset'
      });
      if (!ok) return;
    }

    setSaving(true);
    try {
      const res = await axios.put('/api/inventory/opname', {
        outletId: row.outlet_id,
        itemId: row.item_id,
        stockId: row.stock_id,
        usageDate,
        qtyDelta: n,
        direction,
        employeeId: parseInt(localStorage.getItem('employeeId'), 10) || null
      });
      if (!res.data?.success) throw new Error(res.data?.message || 'Gagal');
      onDone();
      onClose();
    } catch (err) {
      await showAlert({
        title: 'Gagal',
        message: err?.response?.data?.message || err.message,
        type: 'error'
      });
    } finally {
      setSaving(false);
    }
  };

  const tabs = [
    { id: 'add', label: 'Tambah' },
    { id: 'subtract', label: 'Kurang' },
    { id: 'reset', label: 'Reset' }
  ];

  return (
    <div className="fixed inset-0 z-[100] bg-[#313030]/60 backdrop-blur-xs flex items-center justify-center p-4" onClick={onClose}>
      <div
        className="bg-white rounded-3xl border border-[#e0e0e0] w-full max-w-sm shadow-2xl overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="p-4 border-b bg-[#f8f8f8]">
          <h3 className="text-sm font-black text-[#313030]">{row.item_name}</h3>
          <p className="text-[11px] text-slate-500 font-bold mt-1">
            Hari ini: <span className="text-[#5f1340]">{fmtQty(totalHari)}</span> {row.unit_symbol || ''}
          </p>
        </div>

        <div className="p-4 space-y-3">
          <div className="grid grid-cols-3 gap-1.5 bg-[#f8f8f8] border border-[#e0e0e0] p-1 rounded-xl">
            {tabs.map((t) => (
              <button
                key={t.id}
                type="button"
                onClick={() => setTab(t.id)}
                className={`py-2 rounded-lg text-[11px] font-black cursor-pointer ${
                  tab === t.id ? 'bg-[#5f1340] text-white' : 'text-slate-500'
                }`}
              >
                {t.label}
              </button>
            ))}
          </div>

          <input
            type="number"
            step="0.01"
            min="0"
            value={qty}
            onChange={(e) => setQty(e.target.value)}
            placeholder={tab === 'reset' ? 'Total baru' : 'Jumlah'}
            className="w-full px-3 py-2.5 border border-[#e0e0e0] rounded-xl text-center text-sm font-black outline-none focus:border-[#5f1340] [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
          />
        </div>

        <div className="p-4 border-t bg-[#f8f8f8] flex gap-2">
          <button type="button" onClick={onClose} className="flex-1 py-2.5 rounded-xl border text-xs font-black cursor-pointer">
            Batal
          </button>
          <button
            type="button"
            disabled={saving}
            onClick={() => submit(tab)}
            className={`flex-1 py-2.5 rounded-xl text-xs font-black cursor-pointer disabled:opacity-50 ${
              tab === 'reset'
                ? 'bg-rose-600 text-white'
                : tab === 'subtract'
                  ? 'bg-rose-50 text-rose-700 border border-rose-200'
                  : 'bg-[#5f1340] text-white'
            }`}
          >
            {saving ? '…' : tab === 'reset' ? 'Reset' : 'Simpan'}
          </button>
        </div>
      </div>
    </div>
  );
}

function AktualCell({ row, usageDate, onOpen }) {
  const totalHari = parseFloat(row.qty_aktual_hari) || 0;

  return (
    <button
      type="button"
      onClick={() => onOpen(row)}
      title="Klik untuk tambah/kurang pemakaian"
      className="min-w-[4.5rem] px-3 py-1.5 border border-[#5f1340]/30 rounded-lg text-center text-xs font-black text-[#5f1340] bg-white hover:bg-[#5f1340]/5 cursor-pointer transition-colors"
    >
      {fmtQty(totalHari)}
    </button>
  );
}

export default function StockDashboard({
  stockRows,
  stockMeta,
  loading,
  activeOutletId,
  activeOutletName,
  usageDate,
  onUsageDateChange,
  isAdmin,
  onRefresh
}) {
  const [searchQuery, setSearchQuery] = useState('');
  const [filterLow, setFilterLow] = useState(false);
  const [thRow, setThRow] = useState(null);
  const [aktualRow, setAktualRow] = useState(null);

  const filtered = useMemo(() => {
    const q = searchQuery.toLowerCase().trim();
    return stockRows.filter((r) => {
      const matchQ = !q
        || String(r.item_name || '').toLowerCase().includes(q)
        || String(r.item_code || '').toLowerCase().includes(q);
      const matchLow = !filterLow || Number(r.is_low_stock) === 1;
      return matchQ && matchLow;
    });
  }, [stockRows, searchQuery, filterLow]);

  if (!activeOutletId || activeOutletId === 'Semua') {
    return (
      <div className="bg-white border border-[#e0e0e0] rounded-3xl p-10 text-center text-sm text-slate-500 font-bold">
        Pilih outlet spesifik di header untuk melihat stok warehouse.
      </div>
    );
  }

  const periodLabel = stockMeta.periodStartEffective
    ? String(stockMeta.periodStartEffective).slice(0, 10)
    : '-';

  return (
    <>
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-gradient-to-tr from-[#420a2c] to-[#5f1340] text-white rounded-2xl p-5 shadow-md">
          <span className="text-[10px] uppercase font-bold tracking-widest text-rose-200 block">Outlet Aktif</span>
          <span className="text-lg font-black block mt-2">{activeOutletName}</span>
          <span className="text-[10px] text-rose-100/80 mt-1 block">
            Periode opname: {periodLabel} — {usageDate}
          </span>
        </div>
        <div className="bg-white border border-[#e0e0e0] rounded-2xl p-5 shadow-xs">
          <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Total Item</span>
          <span className="text-2xl font-black text-[#313030] mt-1 block">{stockMeta.total || 0}</span>
        </div>
        <div className="bg-white border border-[#e0e0e0] rounded-2xl p-5 shadow-xs">
          <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block flex items-center gap-1">
            <AlertTriangle className="h-3.5 w-3.5 text-amber-500" /> Di Bawah Min Stock
          </span>
          <span className={`text-2xl font-black mt-1 block ${(stockMeta.lowStockCount || 0) > 0 ? 'text-amber-600' : 'text-emerald-700'}`}>
            {stockMeta.lowStockCount || 0}
          </span>
        </div>
      </div>

      <div className="bg-white border border-[#e0e0e0] rounded-3xl p-5 shadow-xs flex flex-col gap-4">
        <div className="flex flex-col sm:flex-row gap-3 justify-between">
          <div className="flex flex-col sm:flex-row gap-3 w-full sm:w-auto">
            <div className="relative w-full sm:w-72">
              <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
              <input
                type="text"
                placeholder="Cari nama / kode item..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-10 pr-4 py-2 border border-[#e0e0e0] rounded-xl text-xs font-bold outline-none focus:border-[#5f1340]"
              />
            </div>
            <div className="relative">
              <CalendarDays className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400 pointer-events-none" />
              <input
                type="date"
                value={usageDate}
                onChange={(e) => onUsageDateChange(e.target.value)}
                className="pl-10 pr-3 py-2 border border-[#e0e0e0] rounded-xl text-xs font-bold outline-none focus:border-[#5f1340]"
              />
            </div>
          </div>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => setFilterLow((v) => !v)}
              className={`px-3 py-2 rounded-xl text-[11px] font-black cursor-pointer flex items-center gap-1.5 ${
                filterLow ? 'bg-amber-500 text-white' : 'bg-[#f8f8f8] text-slate-600'
              }`}
            >
              <AlertTriangle className="h-3.5 w-3.5" /> Low Stock
            </button>
            <button
              type="button"
              onClick={onRefresh}
              className="px-3 py-2 rounded-xl text-[11px] font-black bg-[#f8f8f8] text-slate-600 cursor-pointer flex items-center gap-1.5"
            >
              <RefreshCcw className="h-3.5 w-3.5" /> Refresh
            </button>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse min-w-[960px]">
            <thead>
              <tr className="bg-[#f8f8f8] text-slate-400 font-extrabold uppercase text-[10px] border-b">
                <th className="py-3 px-3">Item</th>
                <th className="py-3 px-3">Satuan</th>
                <th className="py-3 px-3 text-center">Stok Awal</th>
                <th className="py-3 px-3 text-center">Min</th>
                <th className="py-3 px-3 text-center">Seharusnya</th>
                <th className="py-3 px-3 text-center">Aktual</th>
                <th className="py-3 px-3 text-center">Sisa</th>
                <th className="py-3 px-3 text-center">Selisih</th>
                <th className="py-3 px-3 text-center w-16">Aksi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#e0e0e0]/70 font-semibold">
              {loading ? (
                <tr><td colSpan={9} className="py-10 text-center text-slate-400">Memuat stok…</td></tr>
              ) : filtered.length === 0 ? (
                <tr><td colSpan={9} className="py-10 text-center text-slate-400">Tidak ada item</td></tr>
              ) : (
                filtered.map((r) => {
                  const low = Number(r.is_low_stock) === 1;
                  const selisih = parseFloat(r.qty_selisih) || 0;
                  const selisihClass = selisih > 0
                    ? 'text-rose-600'
                    : selisih < 0
                      ? 'text-emerald-700'
                      : 'text-slate-500';

                  return (
                    <tr key={r.stock_id} className={`hover:bg-[#f8f8f8] ${low ? 'bg-amber-50/40' : ''}`}>
                      <td className="py-3 px-3">
                        <span className="font-black text-[#313030] block">{r.item_name}</span>
                        <span className="text-[10px] text-slate-400 font-bold">{r.item_code}</span>
                        {low && (
                          <span className="inline-flex items-center gap-1 mt-1 text-[9px] font-black text-amber-700 bg-amber-100 px-1.5 py-0.5 rounded-md">
                            <AlertTriangle className="h-3 w-3" /> Di bawah min
                          </span>
                        )}
                      </td>
                      <td className="py-3 px-3 text-slate-600">{r.unit_symbol || '-'}</td>
                      <td className="py-3 px-3 text-center font-black text-[#313030]">
                        {fmtQty(r.qty_opening)}
                      </td>
                      <td className="py-3 px-3 text-center">{fmtQty(r.min_stock)}</td>
                      <td className="py-3 px-3 text-center text-slate-700">{fmtQty(r.qty_seharusnya)}</td>
                      <td className="py-3 px-3 text-center">
                        <AktualCell row={r} usageDate={usageDate} onOpen={setAktualRow} />
                      </td>
                      <td className={`py-3 px-3 text-center font-black ${low ? 'text-amber-700' : 'text-[#5f1340]'}`}>
                        {fmtQty(r.qty_sisa)}
                      </td>
                      <td className={`py-3 px-3 text-center font-black ${selisihClass}`}>
                        {selisih > 0 ? '+' : ''}{fmtQty(selisih)}
                      </td>
                      <td className="py-3 px-3 text-center">
                        <button
                          type="button"
                          title="Pengaturan stok"
                          onClick={() => setThRow(r)}
                          className="inline-flex p-1.5 rounded-lg bg-slate-100 text-slate-600 cursor-pointer hover:bg-slate-200"
                        >
                          <SlidersHorizontal className="h-3.5 w-3.5" />
                        </button>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {aktualRow && (
        <AktualModal
          row={aktualRow}
          usageDate={usageDate}
          onClose={() => setAktualRow(null)}
          onDone={onRefresh}
        />
      )}

      {thRow && (
        <ThresholdModal
          row={thRow}
          isAdmin={isAdmin}
          onClose={() => setThRow(null)}
          onDone={onRefresh}
        />
      )}
    </>
  );
}
