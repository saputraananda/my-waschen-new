import React, { useEffect, useState } from 'react';
import axios from 'axios';
import { composeFullAddress } from '../../../utils/NormalizePhone.js';

export default function FillAddressModal({ customer, onClose, onSaved, showToast }) {
  const [form, setForm] = useState({
    address: customer?.address && customer.address !== '-' ? customer.address : '',
    block: customer?.block || '',
    houseNumber: customer?.houseNumber || customer?.house_number || '',
    fullAddress: customer?.fullAddress || customer?.full_address || '',
    notes: customer?.notes || ''
  });
  const [touchedFull, setTouchedFull] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (touchedFull) return;
    setForm((prev) => ({
      ...prev,
      fullAddress: composeFullAddress({
        address: prev.address,
        block: prev.block,
        houseNumber: prev.houseNumber
      })
    }));
  }, [form.address, form.block, form.houseNumber, touchedFull]);

  const handleSave = async (e) => {
    e.preventDefault();
    if (!form.address && !form.fullAddress) {
      showToast?.('Alamat Wajib', 'Isi alamat singkat atau alamat lengkap terlebih dahulu', 'error');
      return;
    }
    setSaving(true);
    try {
      const res = await axios.put(`/api/customers/${customer.dbId || customer.id}`, {
        address: form.address || null,
        block: form.block || null,
        houseNumber: form.houseNumber || null,
        fullAddress: form.fullAddress || null,
        notes: form.notes || null
      });
      if (res.data?.success) {
        onSaved(res.data.data);
      }
    } catch (err) {
      showToast?.('Gagal Simpan', err.response?.data?.message || 'Tidak bisa menyimpan alamat', 'error');
    } finally {
      setSaving(false);
    }
  };

  const fieldCls = 'w-full p-3 border border-[#e0e0e0] rounded-xl bg-white text-xs font-bold outline-none focus:border-[#5f1340]';

  return (
    <div className="fixed inset-0 z-50 bg-[#313030]/60 backdrop-blur-sm flex justify-center items-center p-4">
      <form onSubmit={handleSave} className="bg-white rounded-3xl border border-[#e0e0e0] w-full max-w-md p-5 shadow-2xl flex flex-col gap-3">
        <div>
          <h3 className="text-sm font-black text-[#313030]">Isi Alamat Terlebih Dahulu</h3>
          <p className="text-xs text-slate-400 mt-0.5">
            {customer?.name} belum punya alamat. Lengkapi sebelum lanjut transaksi.
          </p>
        </div>
        <div>
          <label className="text-[11px] font-black text-slate-700">Alamat Singkat</label>
          <input className={fieldCls} value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} placeholder="Jalan Pondok Bambu Asri" />
        </div>
        <div className="grid grid-cols-2 gap-2">
          <div>
            <label className="text-[11px] font-black text-slate-700">Blok</label>
            <input className={fieldCls} value={form.block} onChange={(e) => setForm({ ...form, block: e.target.value })} placeholder="A3" />
          </div>
          <div>
            <label className="text-[11px] font-black text-slate-700">Nomor Rumah</label>
            <input className={fieldCls} value={form.houseNumber} onChange={(e) => setForm({ ...form, houseNumber: e.target.value })} placeholder="18" />
          </div>
        </div>
        <div>
          <label className="text-[11px] font-black text-slate-700">Alamat Lengkap</label>
          <textarea
            className={`${fieldCls} resize-none`}
            rows={2}
            value={form.fullAddress}
            onChange={(e) => {
              setTouchedFull(true);
              setForm({ ...form, fullAddress: e.target.value });
            }}
          />
        </div>
        <div>
          <label className="text-[11px] font-black text-slate-700">Catatan</label>
          <input className={fieldCls} value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} placeholder="Rumah pagar hitam" />
        </div>
        <div className="flex gap-2 pt-1">
          <button type="button" onClick={onClose} className="flex-1 py-2.5 rounded-xl border border-[#e0e0e0] text-xs font-black text-slate-600 cursor-pointer">
            Batal
          </button>
          <button type="submit" disabled={saving} className="flex-1 py-2.5 rounded-xl bg-[#5f1340] text-white text-xs font-black cursor-pointer disabled:opacity-60">
            {saving ? 'Menyimpan...' : 'Simpan & Lanjut'}
          </button>
        </div>
      </form>
    </div>
  );
}
