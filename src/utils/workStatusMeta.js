/** Shared work-status visual meta + persentase akumulatif */
import {
  Clock,
  Wind,
  Shirt,
  Layers,
  PackageCheck,
  Truck,
  CheckCircle2
} from 'lucide-react';

export const STATUS_STEPS = {
  Antrean: { text: 'text-slate-600', bg: 'bg-slate-100 border-slate-200', icon: Clock, percentage: 10 },
  Diterima: { text: 'text-slate-600', bg: 'bg-slate-100 border-slate-200', icon: Clock, percentage: 10 },
  Pencucian: { text: 'text-sky-700', bg: 'bg-sky-50 border-sky-200', icon: Wind, percentage: 25 },
  'Proses Cuci': { text: 'text-sky-700', bg: 'bg-sky-50 border-sky-200', icon: Wind, percentage: 25 },
  Penyetrikaan: { text: 'text-indigo-700', bg: 'bg-indigo-50 border-indigo-200', icon: Shirt, percentage: 50 },
  'Proses Setrika': { text: 'text-indigo-700', bg: 'bg-indigo-50 border-indigo-200', icon: Shirt, percentage: 50 },
  Pengemasan: { text: 'text-purple-700', bg: 'bg-purple-50 border-purple-200', icon: Layers, percentage: 75 },
  'Proses Packing': { text: 'text-purple-700', bg: 'bg-purple-50 border-purple-200', icon: Layers, percentage: 75 },
  'Siap Diambil': { text: 'text-amber-700', bg: 'bg-amber-50 border-amber-200', icon: PackageCheck, percentage: 90 },
  'Siap Diantar': { text: 'text-blue-700', bg: 'bg-blue-50 border-blue-200', icon: Truck, percentage: 90 },
  Delivery: { text: 'text-blue-700', bg: 'bg-blue-50 border-blue-200', icon: Truck, percentage: 90 },
  Selesai: { text: 'text-emerald-700', bg: 'bg-emerald-50 border-emerald-200', icon: CheckCircle2, percentage: 100 },
  Dibatalkan: { text: 'text-rose-700', bg: 'bg-rose-50 border-rose-200', icon: Clock, percentage: 0 }
};

export const DEFAULT_WORK_STATUSES = [
  'Antrean',
  'Pencucian',
  'Penyetrikaan',
  'Pengemasan',
  'Siap Diambil',
  'Siap Diantar',
  'Selesai'
];

export function getWorkPercentage(status, catalog = []) {
  if (status == null || status === '') return 10;
  if (typeof status === 'number' && Number.isFinite(status)) return Number(status);
  const raw = String(status).trim();
  if (/^-?\d+(\.\d+)?$/.test(raw)) return Number(raw);
  if (Array.isArray(catalog) && catalog.length) {
    const match = catalog.find((s) => s.name === status || s.label === status || s.code === status);
    if (match && match.percentage != null) return Number(match.percentage);
  }
  return STATUS_STEPS[status]?.percentage ?? 10;
}

/** Tab filter berdasarkan rata-rata persentase header nota. */
export function matchesWorkStatusTab(workStatus, tabName) {
  if (!tabName || tabName === 'Semua') return true;
  const pct = getWorkPercentage(workStatus);
  if (tabName === 'Dibatalkan') return pct <= 0;
  if (tabName === 'Antrean' || tabName === 'Diterima') return pct > 0 && pct <= 17.5;
  if (tabName === 'Pencucian' || tabName === 'Proses Cuci') return pct > 17.5 && pct <= 37.5;
  if (tabName === 'Penyetrikaan' || tabName === 'Proses Setrika') return pct > 37.5 && pct <= 62.5;
  if (tabName === 'Pengemasan' || tabName === 'Proses Packing') return pct > 62.5 && pct <= 82.5;
  if (
    tabName === 'Siap Diambil / Diantar' ||
    tabName === 'Siap Diambil' ||
    tabName === 'Siap Diantar' ||
    tabName === 'Delivery'
  ) {
    return pct > 82.5 && pct < 100;
  }
  if (tabName === 'Selesai') return pct >= 100;
  return true;
}

export function percentageTone(pct) {
  if (pct <= 0) return { text: 'text-rose-700', bg: 'bg-rose-50 border-rose-200' };
  if (pct < 50) return { text: 'text-slate-700', bg: 'bg-slate-100 border-slate-200' };
  if (pct < 90) return { text: 'text-sky-800', bg: 'bg-sky-50 border-sky-200' };
  if (pct < 100) return { text: 'text-amber-800', bg: 'bg-amber-50 border-amber-200' };
  return { text: 'text-emerald-800', bg: 'bg-emerald-50 border-emerald-200' };
}

export function formatWorkPercentage(status, catalog = []) {
  const n = getWorkPercentage(status, catalog);
  const rounded = Math.round(n * 10) / 10;
  const label = Number.isInteger(rounded) ? String(rounded) : rounded.toFixed(1);
  return `${label}%`;
}
