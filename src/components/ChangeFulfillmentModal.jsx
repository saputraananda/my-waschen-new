import React, { useEffect, useMemo, useState } from 'react';
import { Truck, Package, X, MapPin } from 'lucide-react';
import axios from 'axios';

/**
 * Modal ubah pengambilan: Ambil di Outlet ↔ Delivery (full nota atau per item).
 */
export default function ChangeFulfillmentModal({
  open,
  onClose,
  order,
  items = [],
  onSuccess,
  showAlert
}) {
  const [mode, setMode] = useState('delivery'); // delivery | pickup
  const [scope, setScope] = useState('all'); // all | selected
  const [selectedIds, setSelectedIds] = useState([]);
  const [address, setAddress] = useState('');
  const [notes, setNotes] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const activeItems = useMemo(
    () => (items || []).filter((it) => it.id && it.status !== 'Dibatalkan'),
    [items]
  );

  useEffect(() => {
    if (!open || !order) return;
    const wantDelivery = !order.isDelivery;
    setMode(wantDelivery ? 'delivery' : 'pickup');
    setScope('all');
    setSelectedIds(activeItems.map((it) => it.id));
    setAddress(
      order.deliveryAddress
      || order.customerAddress
      || ''
    );
    setNotes(order.deliveryNotes || '');
  }, [open, order, activeItems]);

  if (!open || !order) return null;

  const toggleItem = (id) => {
    setSelectedIds((prev) => (
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    ));
  };

  const handleSubmit = async () => {
    const toDelivery = mode === 'delivery';
    const itemIds = scope === 'all' ? activeItems.map((it) => it.id) : selectedIds;

    if (!itemIds.length) {
      showAlert?.({ title: 'Pilih Item', message: 'Pilih minimal 1 item.', type: 'warning' });
      return;
    }
    if (toDelivery && !String(address || '').trim()) {
      showAlert?.({
        title: 'Alamat Wajib',
        message: 'Isi alamat pengantaran supaya tim delivery mudah antar.',
        type: 'warning'
      });
      return;
    }

    setSubmitting(true);
    try {
      const res = await axios.patch(`/api/transactions/${order.dbId}/fulfillment`, {
        isDelivery: toDelivery,
        itemIds,
        deliveryAddress: toDelivery ? String(address).trim() : null,
        deliveryNotes: toDelivery ? String(notes || '').trim() || null : null,
        employeeId: parseInt(localStorage.getItem('employeeId'), 10) || 167,
        notes: toDelivery
          ? `Ubah ke Delivery (${scope === 'all' ? 'full nota' : `${itemIds.length} item`})`
          : `Ubah ke Ambil di Outlet (${scope === 'all' ? 'full nota' : `${itemIds.length} item`})`
      });

      if (!res.data?.success) {
        showAlert?.({
          title: 'Gagal',
          message: res.data?.message || 'Tidak bisa mengubah metode pengambilan',
          type: 'error'
        });
        return;
      }

      showAlert?.({
        title: 'Berhasil',
        message: res.data.message,
        type: 'success'
      });
      onSuccess?.(res.data.data);
      onClose?.();
    } catch (err) {
      showAlert?.({
        title: 'Gagal',
        message: err.response?.data?.message || err.message || 'Koneksi gagal',
        type: 'error'
      });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[80] flex items-center justify-center bg-black/50 p-4">
      <div className="w-full max-w-lg bg-white rounded-3xl shadow-2xl border border-[#e0e0e0] overflow-hidden">
        <div className="px-5 py-4 border-b border-[#e0e0e0] flex items-center justify-between bg-[#fafafa]">
          <div>
            <h3 className="text-sm font-black text-[#313030]">Ubah Metode Pengambilan</h3>
            <p className="text-[11px] text-slate-400 font-medium mt-0.5">
              Nota {order.id || order.orderNo}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="w-8 h-8 rounded-xl border border-[#e0e0e0] bg-white grid place-items-center text-slate-500 hover:bg-slate-100 cursor-pointer"
            aria-label="Tutup"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="p-5 space-y-4 max-h-[70vh] overflow-y-auto">
          <div className="grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={() => setMode('delivery')}
              className={`rounded-2xl border px-3 py-3 text-left transition cursor-pointer ${
                mode === 'delivery'
                  ? 'border-orange-300 bg-orange-50 text-orange-800'
                  : 'border-[#e0e0e0] bg-white text-slate-600'
              }`}
            >
              <Truck className="h-4 w-4 mb-1" />
              <span className="text-[12px] font-black block">Delivery</span>
              <span className="text-[10px] font-medium opacity-80">Diantar kurir</span>
            </button>
            <button
              type="button"
              onClick={() => setMode('pickup')}
              className={`rounded-2xl border px-3 py-3 text-left transition cursor-pointer ${
                mode === 'pickup'
                  ? 'border-[#5f1340]/30 bg-[#5f1340]/5 text-[#5f1340]'
                  : 'border-[#e0e0e0] bg-white text-slate-600'
              }`}
            >
              <Package className="h-4 w-4 mb-1" />
              <span className="text-[12px] font-black block">Ambil di Outlet</span>
              <span className="text-[10px] font-medium opacity-80">Customer ambil sendiri</span>
            </button>
          </div>

          <div>
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-2">
              Cakupan
            </span>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setScope('all')}
                className={`flex-1 py-2 rounded-xl border text-[11px] font-black cursor-pointer ${
                  scope === 'all'
                    ? 'bg-[#5f1340] text-white border-[#5f1340]'
                    : 'bg-white text-slate-600 border-[#e0e0e0]'
                }`}
              >
                Satu Nota Full
              </button>
              <button
                type="button"
                onClick={() => setScope('selected')}
                className={`flex-1 py-2 rounded-xl border text-[11px] font-black cursor-pointer ${
                  scope === 'selected'
                    ? 'bg-[#5f1340] text-white border-[#5f1340]'
                    : 'bg-white text-slate-600 border-[#e0e0e0]'
                }`}
              >
                Beberapa Item
              </button>
            </div>
          </div>

          {scope === 'selected' && (
            <div className="space-y-2 rounded-2xl border border-[#e0e0e0] bg-[#fafafa] p-3">
              {activeItems.map((it) => {
                const checked = selectedIds.includes(it.id);
                const isDel = it.fulfillmentType === 'Delivery_Kurir';
                return (
                  <label
                    key={it.id}
                    className="flex items-start gap-2.5 cursor-pointer bg-white border border-[#e0e0e0] rounded-xl px-3 py-2.5"
                  >
                    <input
                      type="checkbox"
                      checked={checked}
                      onChange={() => toggleItem(it.id)}
                      className="mt-0.5 accent-[#5f1340]"
                    />
                    <span className="min-w-0 flex-1">
                      <span className="text-[12px] font-bold text-[#313030] block truncate">
                        {it.serviceName || 'Item'}
                      </span>
                      <span className="text-[10px] text-slate-400 font-medium">
                        {it.status || '-'} · {isDel ? 'Delivery' : 'Ambil outlet'}
                      </span>
                    </span>
                  </label>
                );
              })}
            </div>
          )}

          {mode === 'delivery' && (
            <div className="space-y-3">
              <div>
                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1 mb-1.5">
                  <MapPin className="h-3 w-3" /> Alamat Pengantaran
                </label>
                <textarea
                  value={address}
                  onChange={(e) => setAddress(e.target.value)}
                  rows={3}
                  placeholder="Contoh : Jalan Pondok Bambu Asri Blok A3 No 18"
                  className="w-full rounded-xl border border-[#e0e0e0] bg-white px-3 py-2.5 text-[12px] font-medium text-slate-700 outline-none focus:border-[#5f1340]/40 resize-none"
                />
              </div>
              <div>
                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1.5">
                  Catatan Delivery (opsional)
                </label>
                <input
                  type="text"
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="Contoh : rumah cat hijau, belok kiri"
                  className="w-full rounded-xl border border-[#e0e0e0] bg-white px-3 py-2.5 text-[12px] font-medium text-slate-700 outline-none focus:border-[#5f1340]/40"
                />
              </div>
              <p className="text-[10.5px] text-slate-500 font-medium leading-relaxed">
                Item yang sudah <strong>Siap Diambil</strong> akan otomatis jadi <strong>Siap Diantar</strong> supaya muncul di tab Delivery mobile.
              </p>
            </div>
          )}
        </div>

        <div className="px-5 py-4 border-t border-[#e0e0e0] flex gap-2 justify-end bg-[#fafafa]">
          <button
            type="button"
            onClick={onClose}
            disabled={submitting}
            className="px-4 py-2 rounded-xl border border-[#e0e0e0] bg-white text-slate-600 text-xs font-bold cursor-pointer"
          >
            Batal
          </button>
          <button
            type="button"
            onClick={handleSubmit}
            disabled={submitting}
            className="px-4 py-2 rounded-xl bg-[#5f1340] hover:bg-[#4d0f33] text-white text-xs font-black cursor-pointer disabled:opacity-60"
          >
            {submitting ? 'Menyimpan…' : 'Simpan Perubahan'}
          </button>
        </div>
      </div>
    </div>
  );
}
