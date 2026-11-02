import React from 'react';
import { Loader2, RefreshCw } from 'lucide-react';

export function PageLoading() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-[#f8f8f8]">
      <Loader2 className="h-8 w-8 text-[#5f1340] animate-spin" aria-label="Memuat halaman" />
    </div>
  );
}

/** File halaman bisa gagal diunduh saat sinyal putus; tampilkan pesan, bukan layar putih. */
export default class PageLoadBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { failed: false };
  }

  static getDerivedStateFromError() {
    return { failed: true };
  }

  componentDidCatch(error) {
    console.error('Halaman gagal dimuat:', error);
  }

  render() {
    if (!this.state.failed) return this.props.children;
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#f8f8f8] p-4">
        <div className="bg-white border border-[#e0e0e0] rounded-3xl p-6 text-center max-w-sm w-full">
          <p className="font-black text-sm text-[#313030]">Halaman gagal dimuat</p>
          <p className="text-xs text-slate-500 mt-1 mb-4">Periksa koneksi internet, lalu coba lagi.</p>
          <button
            type="button"
            onClick={() => window.location.reload()}
            className="px-4 py-2 bg-[#5f1340] hover:bg-[#4d0f33] text-white font-bold text-xs rounded-xl inline-flex items-center gap-1.5 cursor-pointer"
          >
            <RefreshCw className="h-3.5 w-3.5" />
            <span>Coba Lagi</span>
          </button>
        </div>
      </div>
    );
  }
}
