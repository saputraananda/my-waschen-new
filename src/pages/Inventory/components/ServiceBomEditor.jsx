import React, { useEffect, useState } from 'react';
import axios from 'axios';
import { Plus, Trash2, Save } from 'lucide-react';
import { useAppDialog } from '../../../context/AppDialogContext.jsx';

/**
 * Editor BOM: layanan → daftar pemakaian item warehouse.
 * Kosong = layanan tidak potong stok saat transaksi.
 */
export default function ServiceBomEditor({ services, items }) {
  const { showAlert } = useAppDialog();
  const [serviceId, setServiceId] = useState('');
  const [bomRows, setBomRows] = useState([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!serviceId) {
      setBomRows([]);
      return;
    }
    let cancelled = false;
    (async () => {
      setLoading(true);
      try {
        const res = await axios.get(`/api/inventory/service-bom/${serviceId}`);
        if (!cancelled && res.data?.success) {
          setBomRows(
            (res.data.data || [])
              .filter((r) => r.is_active !== 0)
              .map((r) => ({
                itemId: r.item_id,
                qtyPerService: String(r.qty_per_service ?? 1),
                notes: r.notes || ''
              }))
          );
        }
      } catch (err) {
        console.error(err);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [serviceId]);

  const addRow = () => {
    const first = (items || []).find((i) => i.is_active !== 0);
    if (!first) return;
    setBomRows((prev) => [...prev, { itemId: first.id, qtyPerService: '1', notes: '' }]);
  };

  const save = async () => {
    if (!serviceId) {
      await showAlert({ title: 'Pilih layanan', message: 'Pilih layanan dulu sebelum menyimpan BOM', type: 'warning' });
      return;
    }
    setSaving(true);
    try {
      const payload = {
        items: bomRows
          .map((r) => ({
            itemId: Number(r.itemId),
            qtyPerService: parseFloat(r.qtyPerService),
            notes: r.notes || null
          }))
          .filter((r) => r.itemId && r.qtyPerService > 0)
      };
      const res = await axios.put(`/api/inventory/service-bom/${serviceId}`, payload);
      if (!res.data?.success) throw new Error(res.data?.message || 'Gagal');
      await showAlert({ title: 'BOM Disimpan', message: res.data.message, type: 'success' });
      setBomRows(
        (res.data.data || []).map((r) => ({
          itemId: r.item_id,
          qtyPerService: String(r.qty_per_service ?? 1),
          notes: r.notes || ''
        }))
      );
    } catch (err) {
      await showAlert({
        title: 'Gagal Simpan BOM',
        message: err?.response?.data?.message || err.message,
        type: 'error'
      });
    } finally {
      setSaving(false);
    }
  };

  const selectedService = (services || []).find((s) => String(s.id) === String(serviceId));

  return (
    <div className="bg-white border border-[#e0e0e0] rounded-3xl p-5 shadow-xs flex flex-col gap-4">
      <div className="flex flex-col sm:flex-row gap-3 sm:items-end justify-between">
        <div className="w-full sm:max-w-md">
          <label className="text-[10px] font-extrabold uppercase tracking-wider text-[#313030] block mb-1">
            Pilih Layanan
          </label>
          <select
            value={serviceId}
            onChange={(e) => setServiceId(e.target.value)}
            className="w-full px-3 py-2.5 border border-[#e0e0e0] rounded-xl text-xs font-bold outline-none focus:border-[#5f1340] bg-white"
          >
            <option value="">— Pilih layanan —</option>
            {(services || []).map((s) => (
              <option key={s.id} value={s.id}>
                {s.name} ({s.code})
              </option>
            ))}
          </select>
          <p className="text-[10px] text-slate-400 mt-1.5 font-medium">
            Contoh: Kemeja → 1× Hanger Uk 16 + 2× Plastik Uk 35×60. Kosong = tidak potong stok.
          </p>
        </div>
        <div className="flex gap-2">
          <button
            type="button"
            disabled={!serviceId}
            onClick={addRow}
            className="px-3 py-2 rounded-xl bg-[#f8f8f8] text-xs font-black cursor-pointer flex items-center gap-1 disabled:opacity-40"
          >
            <Plus className="h-3.5 w-3.5" /> Tambah Item
          </button>
          <button
            type="button"
            disabled={!serviceId || saving}
            onClick={save}
            className="px-4 py-2 rounded-xl bg-[#5f1340] text-white text-xs font-black cursor-pointer flex items-center gap-1.5 disabled:opacity-50"
          >
            <Save className="h-3.5 w-3.5" />
            {saving ? 'Menyimpan…' : 'Simpan BOM'}
          </button>
        </div>
      </div>

      {!serviceId ? (
        <p className="text-center text-sm text-slate-400 font-bold py-8">Pilih layanan untuk mengatur pemakaian warehouse.</p>
      ) : loading ? (
        <p className="text-center text-sm text-slate-400 font-bold py-8">Memuat BOM…</p>
      ) : (
        <div className="space-y-2">
          {selectedService && (
            <p className="text-[11px] font-bold text-slate-500 mb-2">
              BOM: <span className="text-[#5f1340]">{selectedService.name}</span>
            </p>
          )}
          {bomRows.length === 0 ? (
            <div className="border border-dashed border-[#e0e0e0] rounded-2xl py-8 text-center text-xs text-slate-400 font-bold">
              Belum ada item BOM — layanan ini tidak mengurangi stok saat transaksi.
            </div>
          ) : (
            bomRows.map((row, idx) => (
              <div key={`${row.itemId}-${idx}`} className="grid grid-cols-1 sm:grid-cols-12 gap-2 items-center border border-[#e0e0e0] rounded-2xl p-3">
                <div className="sm:col-span-5">
                  <select
                    value={row.itemId}
                    onChange={(e) => {
                      const next = [...bomRows];
                      next[idx] = { ...next[idx], itemId: Number(e.target.value) };
                      setBomRows(next);
                    }}
                    className="w-full px-2.5 py-2 border rounded-xl text-xs font-bold bg-white outline-none focus:border-[#5f1340]"
                  >
                    {(items || []).filter((i) => i.is_active !== 0).map((i) => (
                      <option key={i.id} value={i.id}>
                        {i.name} ({i.unit_symbol || ''})
                      </option>
                    ))}
                  </select>
                </div>
                <div className="sm:col-span-2">
                  <input
                    type="number"
                    step="0.001"
                    min="0"
                    value={row.qtyPerService}
                    onChange={(e) => {
                      const next = [...bomRows];
                      next[idx] = { ...next[idx], qtyPerService: e.target.value };
                      setBomRows(next);
                    }}
                    placeholder="Qty"
                    className="w-full px-2.5 py-2 border rounded-xl text-xs font-bold outline-none focus:border-[#5f1340] [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                  />
                </div>
                <div className="sm:col-span-4">
                  <input
                    type="text"
                    value={row.notes}
                    onChange={(e) => {
                      const next = [...bomRows];
                      next[idx] = { ...next[idx], notes: e.target.value };
                      setBomRows(next);
                    }}
                    placeholder="Catatan (opsional)"
                    className="w-full px-2.5 py-2 border rounded-xl text-xs font-bold outline-none focus:border-[#5f1340]"
                  />
                </div>
                <div className="sm:col-span-1 flex justify-end">
                  <button
                    type="button"
                    onClick={() => setBomRows(bomRows.filter((_, i) => i !== idx))}
                    className="p-2 rounded-lg bg-rose-50 text-rose-600 cursor-pointer"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>
              </div>
            ))
          )}
        </div>
      )}
    </div>
  );
}
