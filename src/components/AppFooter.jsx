import React from 'react';
import waschenLogo from '../assets/images/waschen.webp';

/**
 * Footer premium POS — garis emas tipis, logo, tagline, dan tahun.
 * Responsif: bertumpuk di HP (tengah), satu baris di layar lebar; aman untuk area bawah iPhone.
 */
export default function AppFooter() {
  const year = new Date().getFullYear();

  return (
    <footer className="relative mt-6 sm:mt-10 pb-[max(1.25rem,env(safe-area-inset-bottom))]">
      <div className="max-w-[1600px] mx-auto px-3 sm:px-4 lg:px-6">
        {/* Garis pemisah: memudar di kedua ujung, kilau emas di tengah */}
        <div className="relative h-px w-full bg-gradient-to-r from-transparent via-[#5f1340]/25 to-transparent">
          <span className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 h-[3px] w-24 sm:w-32 rounded-full bg-gradient-to-r from-transparent via-[#d4a937] to-transparent" />
        </div>

        <div className="pt-5 sm:pt-6 flex flex-col sm:flex-row items-center justify-between gap-2.5 sm:gap-6">
          <img src={waschenLogo} alt="Waschen" className="h-6 sm:h-7 w-auto object-contain opacity-90" />
          <p className="flex items-center gap-2.5 text-[10px] sm:text-[11px] font-black uppercase tracking-[0.22em] text-[#5f1340]/70">
            <span>Total Care For Happy Life</span>
            <span className="h-3 w-px bg-slate-300" />
            <span className="tabular-nums tracking-normal text-[#b8862a]">{year}</span>
          </p>
        </div>
      </div>
    </footer>
  );
}
