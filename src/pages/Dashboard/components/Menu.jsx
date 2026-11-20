import React from 'react';
import { useShiftOptional } from '../../../context/ShiftContext.jsx';
import { canUseDropPointDistribution } from '../../../utils/authSession.js';

// Ikon 3D: 3dicons.co (CC0) — public/menu-icons. File WebP berlatar putih → mix-blend-multiply di kartu putih
const ICON = (name) => `/menu-icons/${name}.webp`;

const MENU_ITEMS = [
  {
    key: 'order',
    path: '/transaction',
    label: 'Order Baru',
    icon: ICON("order"),
    labelHover: 'group-hover:text-[#5f1340]',
    useOrderFlow: true
  },
  {
    key: 'history',
    path: '/riwayat',
    label: 'Riwayat',
    shiftFree: true,
    icon: ICON("history"),
    labelHover: 'group-hover:text-rose-700'
  },
  {
    key: 'services',
    path: '/services',
    label: 'Layanan',
    icon: ICON("services"),
    labelHover: 'group-hover:text-sky-700'
  },
  {
    key: 'customer',
    path: '/customer',
    label: 'Pelanggan',
    icon: ICON("customer"),
    labelHover: 'group-hover:text-teal-700'
  },
  {
    key: 'membership',
    path: '/membership',
    label: 'Membership',
    icon: ICON("membership"),
    labelHover: 'group-hover:text-indigo-700'
  },
  {
    key: 'petty-cash',
    path: '/petty-cash',
    label: 'Petty Cash',
    icon: ICON("petty-cash"),
    labelHover: 'group-hover:text-amber-700'
  },
  {
    key: 'inventory',
    path: '/inventory',
    label: 'Inventory',
    icon: ICON("inventory"),
    labelHover: 'group-hover:text-emerald-700'
  },
  {
    key: 'qc',
    path: '/qc',
    label: 'QC',
    icon: ICON("qc"),
    labelHover: 'group-hover:text-[#5f1340]'
  },
  {
    key: 'complaint',
    path: '/complaint',
    label: 'Komplain',
    icon: ICON("complaint"),
    labelHover: 'group-hover:text-orange-700'
  },
  {
    key: 'deposit-report',
    path: '/deposit-report',
    label: 'Setoran Tunai',
    noShiftGate: true,
    icon: ICON("deposit"),
    labelHover: 'group-hover:text-lime-700'
  },
  {
    key: 'drop-point-distribusi',
    path: '/drop-point-distribusi',
    label: 'Distribusi Drop Point',
    shiftFree: true,
    dropPointOnly: true,
    icon: ICON("drop-point"),
    labelHover: 'group-hover:text-violet-700'
  }
];

export default function Menu({ navigate, onOrderClick }) {
  const shiftCtx = useShiftOptional();
  const ensureShiftThenNavigate = shiftCtx?.ensureShiftThenNavigate;
  const mustGateShift = shiftCtx?.mustGateShift;
  const isShiftReady = shiftCtx?.isShiftReady;
  const shiftChecked = shiftCtx?.shiftChecked;
  const showShiftLock = Boolean(mustGateShift && shiftChecked && !isShiftReady);

  const visibleItems = MENU_ITEMS.filter((item) => !item.dropPointOnly || canUseDropPointDistribution());
  // 10 menu: 5 atas + 5 bawah. 11 menu (dengan Distribusi Drop Point): 6 + 5. Selain itu satu baris di layar lebar.
  const gridCols = visibleItems.length === 11
    ? 'md:grid-cols-6'
    : visibleItems.length === 10
      ? 'md:grid-cols-5'
      : 'lg:grid-cols-4 xl:grid-cols-9';

  const handleMenuClick = (item) => {
    if (item.useOrderFlow && onOrderClick) {
      onOrderClick();
      return;
    }

    // Tanpa shift: halaman lain tetap bisa dibuka dalam mode lihat saja (aksi dikunci di ShiftContext)
    if (showShiftLock || typeof ensureShiftThenNavigate !== 'function') {
      navigate(item.path);
      return;
    }

    ensureShiftThenNavigate(item.path);
  };

  return (
    <div>
      <div className="flex items-center justify-between gap-2 mb-3">
        <h3 className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Menu Cepat POS Laundry</h3>
        {showShiftLock && (
          <span className="text-[9px] font-extrabold uppercase tracking-wider text-amber-700 bg-amber-50 border border-amber-200 px-2 py-0.5 rounded-lg">
            Mode lihat saja
          </span>
        )}
      </div>
      <div className={`grid grid-cols-2 sm:grid-cols-3 gap-3.5 ${gridCols}`}>
        {visibleItems.map((item) => {
          // Hanya Order Baru yang butuh shift untuk dibuka
          const locked = showShiftLock && item.useOrderFlow;
          return (
            <button
              key={item.key}
              type="button"
              onClick={() => handleMenuClick(item)}
              className={`bg-white border border-[#e0e0e0]/80 hover:border-[#5f1340]/60 hover:shadow-md p-4 rounded-2xl transition-all duration-300 flex flex-col items-center text-center group transform hover:-translate-y-1 cursor-pointer ${
                locked ? 'opacity-80' : ''
              }`}
            >
              <div className="h-14 w-14 sm:h-16 sm:w-16 mb-2.5 grid place-items-center">
                <img src={item.icon} alt="" aria-hidden="true" draggable="false" loading="lazy" className="h-full w-full object-contain mix-blend-multiply select-none transition-transform duration-200 group-hover:scale-110" />
              </div>
              <span className={`text-sm sm:text-[15px] font-bold leading-snug text-[#313030] break-words transition-colors ${item.labelHover}`}>
                {item.label}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
