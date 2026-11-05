import React, { useEffect, useState } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';

const PAGE_SIZES = [10, 25, 50, 100];

/** Nomor halaman: 1 … (sekitar halaman aktif) … terakhir. String '…' = celah. */
function buildPageNumbers(currentPage, totalPages) {
  const set = new Set([1, totalPages, currentPage - 1, currentPage, currentPage + 1]);
  const nums = [...set].filter((n) => n >= 1 && n <= totalPages).sort((a, b) => a - b);
  const out = [];
  nums.forEach((n, i) => {
    if (i > 0 && n - nums[i - 1] > 1) out.push(`gap-${n}`);
    out.push(n);
  });
  return out;
}

/**
 * State pagination untuk daftar yang sudah difilter.
 * `resetKey` berubah (mis. kata kunci / filter) → kembali ke halaman 1.
 */
export function usePagination(items, resetKey, initialSize = 10) {
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(initialSize);

  useEffect(() => {
    setPage(1);
  }, [resetKey, pageSize]);

  const totalPages = Math.max(1, Math.ceil(items.length / pageSize));
  const currentPage = Math.min(page, totalPages);
  const start = (currentPage - 1) * pageSize;

  return {
    pageItems: items.slice(start, start + pageSize),
    total: items.length,
    start,
    end: Math.min(start + pageSize, items.length),
    currentPage,
    totalPages,
    pageSize,
    setPage,
    setPageSize
  };
}

/** Footer tabel: ringkasan baris, pilih baris/halaman, tombol halaman. */
export default function TablePagination({ pagination, accent = 'bg-[#5f1340]', accentSoft = 'bg-[#5f1340]/10 text-[#5f1340] hover:bg-[#5f1340]/20' }) {
  const { total, start, end, currentPage, totalPages, pageSize, setPage, setPageSize } = pagination;
  const pageNumbers = buildPageNumbers(currentPage, totalPages);

  return (
    <div className="flex flex-col lg:flex-row justify-between lg:items-center gap-3 border-t border-[#e0e0e0]/70 pt-4 text-[11px] text-slate-500 font-bold">
      <span>
        Menampilkan {total === 0 ? 0 : start + 1}–{end} dari {total} pengajuan
      </span>
      <div className="flex flex-wrap items-center gap-1.5">
        <label className="flex items-center gap-1.5 mr-2">
          <span>Baris/halaman</span>
          <select
            value={pageSize}
            onChange={(e) => setPageSize(Number(e.target.value))}
            className="px-2 py-1 rounded-lg border border-[#e0e0e0] bg-white text-slate-600 font-extrabold cursor-pointer"
          >
            {PAGE_SIZES.map((n) => <option key={n} value={n}>{n}</option>)}
          </select>
        </label>
        <button
          type="button"
          disabled={currentPage <= 1}
          onClick={() => setPage(currentPage - 1)}
          className={`inline-flex items-center gap-0.5 px-2.5 py-1 rounded-lg font-extrabold cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed ${accentSoft}`}
        >
          <ChevronLeft className="h-3.5 w-3.5" /> Sebelumnya
        </button>
        {pageNumbers.map((n) => (typeof n === 'string' ? (
          <span key={n} className="px-1">…</span>
        ) : (
          <button
            key={n}
            type="button"
            onClick={() => setPage(n)}
            className={`min-w-[28px] px-2 py-1 rounded-lg font-extrabold cursor-pointer ${
              n === currentPage ? `${accent} text-white` : accentSoft
            }`}
          >
            {n}
          </button>
        )))}
        <button
          type="button"
          disabled={currentPage >= totalPages}
          onClick={() => setPage(currentPage + 1)}
          className={`inline-flex items-center gap-0.5 px-2.5 py-1 rounded-lg font-extrabold cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed ${accentSoft}`}
        >
          Berikutnya <ChevronRight className="h-3.5 w-3.5" />
        </button>
      </div>
    </div>
  );
}
