import React, { useEffect, useMemo, useRef, useState } from 'react';
import axios from 'axios';
import { Plus, Trash2, Save, Search, ChevronDown, X, Check } from 'lucide-react';
import { useAppDialog } from '../../../context/AppDialogContext.jsx';

function SearchableBomItemSelect({
  value,
  onChange,
  items = [],
  placeholder = "Pilih item..."
}) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [highlightedIndex, setHighlightedIndex] = useState(0);
  const containerRef = useRef(null);
  const searchInputRef = useRef(null);
  const listRef = useRef(null);

  const activeItems = useMemo(() => {
    return (items || []).filter((i) => i.is_active !== 0);
  }, [items]);

  const selectedItem = useMemo(() => {
    return activeItems.find((it) => String(it.id) === String(value));
  }, [activeItems, value]);

  useEffect(() => {
    const handleClickOutside = (e) => {
      if (containerRef.current && !containerRef.current.contains(e.target)) {
        setOpen(false);
      }
    };
    if (open) {
      document.addEventListener("mousedown", handleClickOutside);
    }
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [open]);

  useEffect(() => {
    if (open) {
      setHighlightedIndex(0);
      const timer = setTimeout(() => {
        searchInputRef.current?.focus();
      }, 50);
      return () => clearTimeout(timer);
    } else {
      setSearch("");
    }
  }, [open]);

  const filteredItems = useMemo(() => {
    const q = search.toLowerCase().trim();
    if (!q) return activeItems;
    return activeItems.filter((it) => {
      const name = String(it.name || "").toLowerCase();
      const code = String(it.code || "").toLowerCase();
      const unit = String(it.unit_symbol || it.unit || "").toLowerCase();
      return name.includes(q) || code.includes(q) || unit.includes(q);
    });
  }, [activeItems, search]);

  useEffect(() => {
    setHighlightedIndex(0);
  }, [search]);

  useEffect(() => {
    if (open && listRef.current) {
      const activeEl = listRef.current.querySelector(`[data-index="${highlightedIndex}"]`);
      if (activeEl) {
        activeEl.scrollIntoView({ block: "nearest" });
      }
    }
  }, [highlightedIndex, open]);

  const handleSelect = (itemId) => {
    onChange(itemId);
    setOpen(false);
    setSearch("");
  };

  const handleKeyDown = (e) => {
    if (e.key === "Escape") {
      setOpen(false);
    } else if (e.key === "ArrowDown") {
      e.preventDefault();
      setHighlightedIndex((prev) =>
        prev < filteredItems.length - 1 ? prev + 1 : prev
      );
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setHighlightedIndex((prev) => (prev > 0 ? prev - 1 : 0));
    } else if (e.key === "Enter") {
      e.preventDefault();
      if (filteredItems[highlightedIndex]) {
        handleSelect(filteredItems[highlightedIndex].id);
      }
    }
  };

  return (
    <div ref={containerRef} className={`relative w-full ${open ? "z-50" : "z-10"}`}>
      <button
        type="button"
        onClick={() => setOpen((prev) => !prev)}
        className={`w-full px-2.5 py-2 border rounded-xl text-xs font-bold bg-white text-left outline-none transition-all flex items-center justify-between gap-2 cursor-pointer ${
          open
            ? "border-[#5f1340] ring-2 ring-[#5f1340]/15 shadow-xs"
            : "border-[#e0e0e0] hover:border-slate-400"
        } ${!selectedItem ? "text-slate-400" : "text-slate-800"}`}
      >
        <span className="truncate">
          {selectedItem ? (
            <span>
              {selectedItem.name}{" "}
              <span className="text-slate-400 font-normal">
                ({selectedItem.unit_symbol || selectedItem.unit || "—"})
              </span>
            </span>
          ) : (
            placeholder
          )}
        </span>
        <ChevronDown
          className={`h-3.5 w-3.5 shrink-0 text-slate-400 transition-transform duration-200 ${
            open ? "rotate-180 text-[#5f1340]" : ""
          }`}
        />
      </button>

      {open && (
        <div className="absolute left-0 right-0 top-full mt-1 w-full min-w-[270px] max-w-[380px] rounded-2xl border border-slate-200 bg-white shadow-xl z-50 overflow-hidden flex flex-col">
          <div className="p-2 border-b border-slate-100 bg-slate-50/80">
            <div className="relative">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-400 pointer-events-none" />
              <input
                ref={searchInputRef}
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="Cari item atau kode..."
                className="w-full rounded-xl border border-slate-200 bg-white pl-8 pr-7 py-1.5 text-xs font-bold text-slate-800 outline-none focus:border-[#5f1340] focus:ring-1 focus:ring-[#5f1340]/20"
              />
              {search && (
                <button
                  type="button"
                  onClick={() => setSearch("")}
                  className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 p-0.5 rounded cursor-pointer"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              )}
            </div>
            {search && (
              <div className="flex items-center justify-between text-[10px] text-slate-400 mt-1 px-1 font-semibold">
                <span>Ditemukan: {filteredItems.length} item</span>
                <span className="italic">Tekan Enter untuk memilih</span>
              </div>
            )}
          </div>

          <div ref={listRef} className="max-h-52 overflow-y-auto p-1 divide-y divide-slate-50">
            {filteredItems.length === 0 ? (
              <div className="py-6 px-3 text-center">
                <p className="text-xs font-bold text-slate-500">
                  Item &quot;{search}&quot; tidak ditemukan
                </p>
                <p className="text-[10px] text-slate-400 mt-0.5">
                  Coba kata kunci nama atau kode item lainnya
                </p>
              </div>
            ) : (
              filteredItems.map((it, idx) => {
                const isSelected = String(it.id) === String(value);
                const isHighlighted = idx === highlightedIndex;
                const unitStr = it.unit_symbol || it.unit || "—";
                return (
                  <button
                    key={it.id}
                    data-index={idx}
                    type="button"
                    onClick={() => handleSelect(it.id)}
                    onMouseEnter={() => setHighlightedIndex(idx)}
                    className={`w-full text-left px-2.5 py-2 rounded-xl text-xs transition-colors flex items-center justify-between gap-2 cursor-pointer ${
                      isSelected
                        ? "bg-[#5f1340]/10 text-[#5f1340] font-black"
                        : isHighlighted
                        ? "bg-slate-100 text-slate-900 font-bold"
                        : "text-slate-700 hover:bg-slate-50 hover:text-[#5f1340] font-semibold"
                    }`}
                  >
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <span className="truncate">{it.name}</span>
                        {it.code && (
                          <span className="text-[9px] font-mono px-1 py-0.5 bg-slate-100 text-slate-500 rounded border border-slate-200">
                            {it.code}
                          </span>
                        )}
                      </div>
                    </div>
                    <div className="shrink-0 flex items-center gap-1.5">
                      <span
                        className={`text-[10px] px-1.5 py-0.5 rounded-md font-bold ${
                          isSelected
                            ? "bg-[#5f1340]/20 text-[#5f1340]"
                            : "bg-slate-100 text-slate-500"
                        }`}
                      >
                        {unitStr}
                      </span>
                      {isSelected && <Check className="h-3.5 w-3.5 text-[#5f1340]" />}
                    </div>
                  </button>
                );
              })
            )}
          </div>
        </div>
      )}
    </div>
  );
}

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
              <div
                key={`${row.itemId}-${idx}`}
                className="grid grid-cols-1 sm:grid-cols-12 gap-2 items-center border border-[#e0e0e0] rounded-2xl p-3 relative"
                style={{ zIndex: bomRows.length - idx }}
              >
                <div className="sm:col-span-5">
                  <SearchableBomItemSelect
                    value={row.itemId}
                    onChange={(val) => {
                      const next = [...bomRows];
                      next[idx] = { ...next[idx], itemId: Number(val) };
                      setBomRows(next);
                    }}
                    items={items}
                    placeholder="Pilih item..."
                  />
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
                    placeholder="Contoh : 1"
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
                    placeholder="Contoh : Plastik untuk kiloan"
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
