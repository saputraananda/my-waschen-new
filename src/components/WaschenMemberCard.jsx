import React from 'react';
import waschenWhiteLogo from '../assets/images/waschen_white.webp';

export default function WaschenMemberCard({
  tier = 'Gold',
  memberName = 'NAMA PELANGGAN',
  customerCode = '2600604',
  topUpAmount = 500000,
  validityDays = 180,
  className = ''
}) {
  const isDiamond = String(tier).toLowerCase().includes('diamond');

  // Dates calculation
  const today = new Date();
  const joinStr = `${String(today.getMonth() + 1).padStart(2, '0')}/${String(today.getFullYear()).slice(-2)}`;
  
  const expiryDate = new Date(today);
  expiryDate.setDate(expiryDate.getDate() + (validityDays || 180));
  const validThruStr = `${String(expiryDate.getMonth() + 1).padStart(2, '0')}/${String(expiryDate.getFullYear()).slice(-2)}`;

  // Ukuran mengikuti lebar kartu (cqw) — proporsi sama di HP & desktop, tidak ada teks bertabrakan
  const fs = (cqw, minPx) => ({ fontSize: `max(${minPx}px, ${cqw}cqw)` });

  return (
    <div className={`mx-auto w-full max-w-[440px] [container-type:inline-size] ${className}`}>
      <div
        className={`relative w-full overflow-hidden text-white shadow-2xl transition-all duration-300 hover:scale-[1.005] ${
          isDiamond
            ? 'bg-gradient-to-br from-[#2f0821] via-[#4d0f33] to-[#1d0313] border border-cyan-500/30 shadow-cyan-950/40'
            : 'bg-gradient-to-br from-[#3b0826] via-[#5f1340] to-[#250418] border border-amber-500/30 shadow-amber-950/40'
        }`}
        style={{ aspectRatio: '1.586 / 1', borderRadius: '5cqw', padding: '5.5cqw' }}
      >
        {/* Background Arc Lines Matching Reference Graphics Exactly */}
        <svg className="absolute right-0 top-0 bottom-0 h-full w-2/3 pointer-events-none z-0" viewBox="0 0 300 215" fill="none">
          {isDiamond ? (
            <>
              {/* Top Metallic Cyan Arc */}
              <circle
                cx="250"
                cy="20"
                r="140"
                stroke="url(#cyanArcGrad)"
                strokeWidth="2.5"
                strokeOpacity="0.7"
              />
              {/* Bottom Metallic Cyan Arc */}
              <circle
                cx="260"
                cy="190"
                r="120"
                stroke="url(#cyanArcGrad)"
                strokeWidth="2"
                strokeOpacity="0.6"
              />
              <defs>
                <linearGradient id="cyanArcGrad" x1="0%" y1="0%" x2="100%" y2="100%">
                  <stop offset="0%" stopColor="#e0f2fe" />
                  <stop offset="50%" stopColor="#38bdf8" />
                  <stop offset="100%" stopColor="#0284c7" />
                </linearGradient>
              </defs>
            </>
          ) : (
            <>
              {/* Top Metallic Gold Arc */}
              <circle
                cx="250"
                cy="20"
                r="140"
                stroke="url(#goldArcGrad)"
                strokeWidth="2"
                strokeOpacity="0.5"
              />
              {/* Bottom Metallic Gold Arc */}
              <circle
                cx="260"
                cy="190"
                r="120"
                stroke="url(#goldArcGrad)"
                strokeWidth="1.8"
                strokeOpacity="0.45"
              />
              <defs>
                <linearGradient id="goldArcGrad" x1="0%" y1="0%" x2="100%" y2="100%">
                  <stop offset="0%" stopColor="#fff4cf" />
                  <stop offset="50%" stopColor="#e2ca7a" />
                  <stop offset="100%" stopColor="#a37b36" />
                </linearGradient>
              </defs>
            </>
          )}
        </svg>

        {/* Radial Glow Highlight */}
        <div
          className={`absolute -left-12 -top-12 h-64 w-64 rounded-full blur-2xl pointer-events-none opacity-20 ${
            isDiamond ? 'bg-cyan-400' : 'bg-amber-300'
          }`}
        />

        {/* Isi kartu */}
        <div className="relative z-10 flex h-full flex-col justify-between">
          {/* Atas: logo & tier */}
          <div className="flex items-start justify-between gap-2">
            <img
              src={waschenWhiteLogo}
              alt="Waschen Expert Laundry Solutions"
              className="w-auto object-contain drop-shadow-md"
              style={{ height: '8.5cqw' }}
            />
            <div className="text-right leading-none">
              <span
                className={`block font-black uppercase tracking-wider ${
                  isDiamond
                    ? 'bg-gradient-to-r from-cyan-200 via-sky-100 to-cyan-400 bg-clip-text text-transparent drop-shadow-[0_2px_4px_rgba(0,0,0,0.6)]'
                    : 'bg-gradient-to-r from-amber-200 via-yellow-100 to-amber-400 bg-clip-text text-transparent drop-shadow-[0_2px_4px_rgba(0,0,0,0.6)]'
                }`}
                style={fs(6.2, 16)}
              >
                {isDiamond ? 'DIAMOND' : 'GOLD'}
              </span>
              <span className="mt-[0.8cqw] block font-bold uppercase tracking-wide text-white/80" style={fs(2.4, 8)}>
                Member Card
              </span>
            </div>
          </div>

          {/* Tengah: kode, nama, emblem */}
          <div className="flex items-center justify-between gap-[3cqw]">
            <div className="min-w-0 flex-1">
              <span className="block font-extrabold uppercase tracking-[0.25em] text-white/70" style={fs(2.6, 8)}>
                PRIORITY CLUB
              </span>
              <div className="font-mono font-bold tracking-[0.15em] text-white drop-shadow-sm leading-tight" style={fs(6.4, 16)}>
                {customerCode || '2600604'}
              </div>
              <div className="truncate font-black capitalize tracking-wide text-white drop-shadow-md leading-tight" style={fs(4.8, 13)}>
                {memberName || 'NAMA PELANGGAN'}
              </div>
            </div>
            <div className="shrink-0" style={{ width: '17cqw', height: '17cqw' }}>
            {isDiamond ? (
                /* DIAMOND EMBLEM: Sparkling Faceted Blue Gem */
                <svg viewBox="0 0 100 100" className="w-full h-full drop-shadow-[0_4px_16px_rgba(2,132,199,0.6)]">
                  <defs>
                    <radialGradient id="diaGemGrad" cx="40%" cy="40%" r="60%">
                      <stop offset="0%" stopColor="#f0f9ff" />
                      <stop offset="25%" stopColor="#7dd3fc" />
                      <stop offset="60%" stopColor="#0284c7" />
                      <stop offset="100%" stopColor="#0c4a6e" />
                    </radialGradient>
                  </defs>
                  {/* Smooth Outer Ring */}
                  <circle cx="50" cy="50" r="47" fill="url(#diaGemGrad)" stroke="#e0f2fe" strokeWidth="1.5" />
                  
                  {/* Facet Geometry Cut Lines */}
                  <polygon points="50,15 75,27 85,50 75,73 50,85 25,73 15,50 25,27" fill="none" stroke="#ffffff" strokeWidth="1" opacity="0.75" />
                  <polygon points="50,28 66,36 66,64 50,72 34,64 34,36" fill="#e0f2fe" opacity="0.35" />
                  
                  {/* Radial Facet Connectors */}
                  <line x1="50" y1="15" x2="50" y2="28" stroke="#ffffff" strokeWidth="1" opacity="0.8" />
                  <line x1="75" y1="27" x2="66" y2="36" stroke="#ffffff" strokeWidth="1" opacity="0.8" />
                  <line x1="85" y1="50" x2="66" y2="50" stroke="#ffffff" strokeWidth="1" opacity="0.8" />
                  <line x1="75" y1="73" x2="66" y2="64" stroke="#ffffff" strokeWidth="1" opacity="0.8" />
                  <line x1="50" y1="85" x2="50" y2="72" stroke="#ffffff" strokeWidth="1" opacity="0.8" />
                  <line x1="25" y1="73" x2="34" y2="64" stroke="#ffffff" strokeWidth="1" opacity="0.8" />
                  <line x1="15" y1="50" x2="34" y2="50" stroke="#ffffff" strokeWidth="1" opacity="0.8" />
                  <line x1="25" y1="27" x2="34" y2="36" stroke="#ffffff" strokeWidth="1" opacity="0.8" />
                  
                  {/* Bright Sparkle Glint */}
                  <polygon points="36,24 38,30 44,32 38,34 36,40 34,34 28,32 34,30" fill="#ffffff" opacity="0.95" />
                </svg>
              ) : (
                /* GOLD EMBLEM: Smooth Solid Metallic Champagne Gold Sphere (Exact match to reference gold seal) */
                <svg viewBox="0 0 100 100" className="w-full h-full drop-shadow-[0_4px_16px_rgba(0,0,0,0.5)]">
                  <defs>
                    <radialGradient id="smoothGoldRadial" cx="35%" cy="30%" r="70%">
                      <stop offset="0%" stopColor="#fffce6" />
                      <stop offset="20%" stopColor="#f5e1a4" />
                      <stop offset="50%" stopColor="#d5ba75" />
                      <stop offset="80%" stopColor="#ab883b" />
                      <stop offset="100%" stopColor="#75591c" />
                    </radialGradient>
                    <linearGradient id="goldRimGrad" x1="0%" y1="0%" x2="100%" y2="100%">
                      <stop offset="0%" stopColor="#fff8e0" />
                      <stop offset="50%" stopColor="#c7a450" />
                      <stop offset="100%" stopColor="#634913" />
                    </linearGradient>
                  </defs>
                  {/* Solid Smooth 3D Gold Disk */}
                  <circle cx="50" cy="50" r="47" fill="url(#smoothGoldRadial)" stroke="url(#goldRimGrad)" strokeWidth="1.5" />
                  {/* Subtle Inner Bevel Highlight */}
                  <circle cx="50" cy="50" r="45" fill="none" stroke="#ffffff" strokeWidth="1" opacity="0.35" />
                </svg>
              )}
            </div>
          </div>

          {/* Bawah: tanggal & nominal */}
          <div className="flex items-end justify-between gap-[2.5cqw] border-t border-white/15 pt-[2.5cqw]">
            <div className="flex shrink-0 items-end gap-[4cqw] font-bold text-white/80">
              <div className="leading-tight">
                <span className="block uppercase tracking-wider text-white/60" style={fs(2, 7)}>VALID THRU</span>
                <span className="block whitespace-nowrap font-mono font-black text-white" style={fs(3, 10)}>{validThruStr}</span>
              </div>
              <div className="leading-tight">
                <span className="block uppercase tracking-wider text-white/60" style={fs(2, 7)}>JOIN DATE</span>
                <span className="block whitespace-nowrap font-mono font-black text-white" style={fs(3, 10)}>{joinStr}</span>
              </div>
            </div>

            {/* Nominal */}
            <div
              className={`min-w-0 rounded-[2.5cqw] px-[3cqw] py-[1.5cqw] text-right leading-tight shadow-md ${
                isDiamond
                  ? 'bg-gradient-to-r from-cyan-500 to-sky-600 text-white border border-cyan-300/40'
                  : 'bg-gradient-to-r from-amber-500 to-yellow-600 text-white border border-amber-300/40'
              }`}
            >
              <span className="block font-extrabold uppercase tracking-wider text-white/90" style={fs(2, 7)}>Nominal</span>
              <span className="block whitespace-nowrap font-black text-white tabular-nums" style={fs(4.2, 12)}>
                Rp {Number(topUpAmount || 0).toLocaleString('id-ID')}
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
