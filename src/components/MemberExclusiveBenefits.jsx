import React from 'react';
import {
  Award,
  Gift,
  Sparkles,
  Percent,
  Bell,
  CheckCircle2,
  Headphones,
  Zap,
  Coins,
  Shirt,
  PhoneCall,
  Mail,
  Crown,
  Gem
} from 'lucide-react';

export default function MemberExclusiveBenefits({ tier = 'Gold', className = '' }) {
  const isDiamond = String(tier).toLowerCase().includes('diamond');

  return (
    <div
      className={`rounded-2xl p-4 sm:p-5 border transition-all ${isDiamond
        ? 'bg-gradient-to-br from-cyan-950/20 via-slate-900/10 to-sky-950/20 border-cyan-500/30'
        : 'bg-gradient-to-br from-amber-950/15 via-slate-900/10 to-rose-950/15 border-amber-500/30'
        } ${className}`}
    >
      {/* Header Banner */}
      <div className="flex items-center justify-between border-b border-slate-200/80 pb-3 mb-4">
        <div>
          <span className="text-[10px] font-black tracking-[0.25em] text-[#5f1340] uppercase block">
            PRIORITY CLUB
          </span>
          <h4 className="text-xs font-black text-[#313030]">
            Exclusive Benefits, Only For Members
          </h4>
        </div>

        <div
          className={`px-3 py-1 rounded-full border text-[10px] font-black uppercase tracking-wider flex items-center gap-1.5 shadow-2xs ${isDiamond
            ? 'bg-cyan-50 text-cyan-900 border-cyan-300'
            : 'bg-amber-50 text-amber-900 border-amber-300'
            }`}
        >
          {isDiamond ? (
            <>
              <Gem className="h-3.5 w-3.5 text-cyan-600" />
              <span>DIAMOND MEMBER</span>
            </>
          ) : (
            <>
              <Crown className="h-3.5 w-3.5 text-amber-600" />
              <span>GOLDEN MEMBER</span>
            </>
          )}
        </div>
      </div>

      {/* Benefits Grid */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
        {/* Benefit 1: Welcome Gift */}
        <div className="p-2.5 bg-white border border-slate-200/70 rounded-xl flex flex-col items-center text-center shadow-2xs">
          <div className="p-2 bg-amber-100/70 text-amber-800 rounded-lg mb-1.5">
            <Award className="h-4 w-4" />
          </div>
          <span className="text-[10px] font-black text-slate-800 block">Welcome Gift</span>
          <span className="text-[9px] text-slate-400 font-medium leading-tight">Hadiah Selamat Datang</span>
        </div>

        {/* Benefit 2: Birthday Gift */}
        <div className="p-2.5 bg-white border border-slate-200/70 rounded-xl flex flex-col items-center text-center shadow-2xs">
          <div className="p-2 bg-rose-100/70 text-rose-800 rounded-lg mb-1.5">
            <Gift className="h-4 w-4" />
          </div>
          <span className="text-[10px] font-black text-slate-800 block">Birthday Gift</span>
          <span className="text-[9px] text-slate-400 font-medium leading-tight">Kejutan Ulang Tahun</span>
        </div>

        {/* Benefit 3: Point Reward */}
        <div className="p-2.5 bg-white border border-slate-200/70 rounded-xl flex flex-col items-center text-center shadow-2xs">
          <div className="p-2 bg-purple-100/70 text-purple-800 rounded-lg mb-1.5">
            <Sparkles className="h-4 w-4" />
          </div>
          <span className="text-[10px] font-black text-slate-800 block">Point Reward</span>
          <span className="text-[9px] text-slate-400 font-medium leading-tight">Poin per Transaksi</span>
        </div>

        {/* Benefit 4: Cleanox Discount */}
        <div className="p-2.5 bg-white border border-slate-200/70 rounded-xl flex flex-col items-center text-center shadow-2xs">
          <div className="p-2 bg-emerald-100/70 text-emerald-800 rounded-lg mb-1.5">
            <Percent className="h-4 w-4" />
          </div>
          <span className="text-[10px] font-black text-slate-800 block">
            {isDiamond ? 'Diskon 10% Cleanox' : 'Discount 5% Cleanox'}
          </span>
          <span className="text-[9px] text-slate-400 font-medium leading-tight">Potongan Produk</span>
        </div>

        {/* Benefit 5: Auto Notification */}
        <div className="p-2.5 bg-white border border-slate-200/70 rounded-xl flex flex-col items-center text-center shadow-2xs">
          <div className="p-2 bg-blue-100/70 text-blue-800 rounded-lg mb-1.5">
            <Bell className="h-4 w-4" />
          </div>
          <span className="text-[10px] font-black text-slate-800 block">Notifikasi Otomatis</span>
          <span className="text-[9px] text-slate-400 font-medium leading-tight">Update Status WA</span>
        </div>

        {/* Benefit 6: Priority Handling */}
        <div className="p-2.5 bg-white border border-slate-200/70 rounded-xl flex flex-col items-center text-center shadow-2xs">
          <div className="p-2 bg-[#5f1340]/10 text-[#5f1340] rounded-lg mb-1.5">
            <CheckCircle2 className="h-4 w-4" />
          </div>
          <span className="text-[10px] font-black text-slate-800 block">Priority Handling</span>
          <span className="text-[9px] text-slate-400 font-medium leading-tight">Proses Lebih Cepat</span>
        </div>

        {/* Benefit 7: Customer Care */}
        <div className="p-2.5 bg-white border border-slate-200/70 rounded-xl flex flex-col items-center text-center shadow-2xs">
          <div className="p-2 bg-teal-100/70 text-teal-800 rounded-lg mb-1.5">
            <Headphones className="h-4 w-4" />
          </div>
          <span className="text-[10px] font-black text-slate-800 block">
            {isDiamond ? 'Customer Care Priority' : 'Customer Care'}
          </span>
          <span className="text-[9px] text-slate-400 font-medium leading-tight">Layanan Prioritas</span>
        </div>

        {/* Benefit 8: Extra / Express Benefit */}
        {isDiamond ? (
          <div className="p-2.5 bg-white border border-slate-200/70 rounded-xl flex flex-col items-center text-center shadow-2xs">
            <div className="p-2 bg-sky-100/70 text-sky-800 rounded-lg mb-1.5">
              <Zap className="h-4 w-4" />
            </div>
            <span className="text-[10px] font-black text-slate-800 block">1X Upgrade Express</span>
            <span className="text-[9px] text-slate-400 font-medium leading-tight">Gratis Layanan Kilat</span>
          </div>
        ) : (
          <div className="p-2.5 bg-white border border-slate-200/70 rounded-xl flex flex-col items-center text-center shadow-2xs">
            <div className="p-2 bg-amber-100/70 text-amber-800 rounded-lg mb-1.5">
              <Shirt className="h-4 w-4" />
            </div>
            <span className="text-[10px] font-black text-slate-800 block">1X Cuci Kemeja</span>
            <span className="text-[9px] text-slate-400 font-medium leading-tight">Gratis Cuci Kemeja</span>
          </div>
        )}
      </div>

      {/* Extra Bonus Banner */}
      <div className="mt-3 p-3 bg-gradient-to-r from-[#5f1340] to-[#7d1956] text-white rounded-xl flex items-center justify-between shadow-xs">
        <div className="flex items-center gap-2">
          <div className="p-1.5 bg-white/20 rounded-lg">
            <Coins className="h-4 w-4 text-amber-300" />
          </div>
          <div>
            <span className="text-[9px] uppercase tracking-widest text-amber-200 font-extrabold block">
              EXTRA BONUS MEMBER {isDiamond ? 'DIAMOND' : 'GOLD'}
            </span>
            <span className="text-xs font-black">
              {isDiamond
                ? 'Bonus Saldo Rp 50.000 / Gratis 1x Cuci Bedcover'
                : 'Bonus Saldo Rp 25.000 / Gratis 1x Cuci Kemeja'}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
