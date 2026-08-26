import React from 'react';
import {
  PlusCircle,
  History,
  Info,
  Users,
  CreditCard,
  Wallet
} from 'lucide-react';
import { useShiftOptional } from '../../../context/ShiftContext.jsx';

const MENU_ITEMS = [
  {
    key: 'order',
    path: '/transaction',
    label: 'Order Baru',
    hint: 'POS Laundry',
    icon: PlusCircle,
    iconWrap: 'bg-[#5f1340]/5 text-[#5f1340] group-hover:bg-[#5f1340]/10',
    labelHover: 'group-hover:text-[#5f1340]',
    useOrderFlow: true
  },
  {
    key: 'history',
    path: '/riwayat',
    label: 'Riwayat',
    hint: 'Semua Transaksi',
    icon: History,
    iconWrap: 'bg-rose-50 text-rose-700 group-hover:bg-rose-100/60',
    labelHover: 'group-hover:text-rose-700'
  },
  {
    key: 'services',
    path: '/services',
    label: 'Layanan',
    hint: 'Kilo & Satuan',
    icon: Info,
    iconWrap: 'bg-sky-50 text-sky-700 group-hover:bg-sky-100/60',
    labelHover: 'group-hover:text-sky-700'
  },
  {
    key: 'customer',
    path: '/customer',
    label: 'Pelanggan',
    hint: 'Data Member',
    icon: Users,
    iconWrap: 'bg-teal-50 text-teal-700 group-hover:bg-teal-100/60',
    labelHover: 'group-hover:text-teal-700'
  },
  {
    key: 'membership',
    path: '/membership',
    label: 'Membership',
    hint: 'Saldo Kartu',
    icon: CreditCard,
    iconWrap: 'bg-indigo-50 text-indigo-700 group-hover:bg-indigo-100/60',
    labelHover: 'group-hover:text-indigo-700'
  },
  {
    key: 'petty-cash',
    path: '/petty-cash',
    label: 'Petty Cash',
    hint: 'Kas Outlet',
    icon: Wallet,
    iconWrap: 'bg-amber-50 text-amber-700 group-hover:bg-amber-100/60',
    labelHover: 'group-hover:text-amber-700'
  }
];

export default function Menu({ navigate, onOrderClick }) {
  const shiftCtx = useShiftOptional();
  const ensureShiftThenNavigate = shiftCtx?.ensureShiftThenNavigate;
  const mustGateShift = shiftCtx?.mustGateShift;
  const isShiftReady = shiftCtx?.isShiftReady;

  const handleMenuClick = (item) => {
    if (item.useOrderFlow && onOrderClick) {
      onOrderClick();
      return;
    }

    if (typeof ensureShiftThenNavigate === 'function') {
      ensureShiftThenNavigate(item.path);
      return;
    }

    navigate(item.path);
  };

  return (
    <div>
      <div className="flex items-center justify-between gap-2 mb-3">
        <h3 className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Menu Cepat POS Laundry</h3>
        {mustGateShift && !isShiftReady && (
          <span className="text-[9px] font-extrabold uppercase tracking-wider text-amber-700 bg-amber-50 border border-amber-200 px-2 py-0.5 rounded-lg">
            Buka shift dulu
          </span>
        )}
      </div>
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3.5">
        {MENU_ITEMS.map((item) => {
          const Icon = item.icon;
          const locked = mustGateShift && !isShiftReady;
          return (
            <button
              key={item.key}
              type="button"
              onClick={() => handleMenuClick(item)}
              className={`bg-white border border-[#e0e0e0]/80 hover:border-[#5f1340]/60 hover:shadow-md p-4 rounded-2xl transition-all duration-300 flex flex-col items-center text-center group transform hover:-translate-y-1 cursor-pointer ${
                locked ? 'opacity-80' : ''
              }`}
            >
              <div className={`p-3 rounded-2xl mb-2.5 group-hover:scale-110 transition-all duration-200 ${item.iconWrap}`}>
                <Icon className="h-5 w-5" />
              </div>
              <span className={`text-xs font-bold text-[#313030] transition-colors ${item.labelHover}`}>
                {item.label}
              </span>
              <span className="text-[9px] text-slate-400 mt-1 hidden sm:inline">
                {locked ? 'Perlu buka shift' : item.hint}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
