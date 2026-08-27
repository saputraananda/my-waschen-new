import React, { useMemo, useEffect } from 'react';
import { Building2, ArrowRightLeft, CreditCard, Wallet, Check } from 'lucide-react';
import { getBankAccountForOutlet, getAllBankAccounts, OUTLET_BANK_ACCOUNTS } from '../utils/bankAccounts.js';

export default function CascadingPaymentSelector({
  mainCategory,
  setMainCategory,
  edcCardType = 'Debit Card',
  setEdcCardType,
  isCrossTransfer = false,
  setIsCrossTransfer,
  crossBankOutletId = 1,
  setCrossBankOutletId,
  activeOutletId,
  activeOutletName,
  outlets = [],
  paymentMethods = [],
  selectedCustomer,
  grandTotal = 0
}) {
  // 1. Extract unique main groups directly from DB records in paymentMethods
  const mainGroupList = useMemo(() => {
    if (!paymentMethods || paymentMethods.length === 0) {
      return [
        { id: 'Tunai', label: 'Tunai' },
        { id: 'Transfer Bank', label: 'Transfer Bank' },
        { id: 'EDC BCA', label: 'EDC BCA' },
        { id: 'EDC BSI', label: 'EDC BSI' },
        { id: 'EDC BRI', label: 'EDC BRI' },
        { id: 'QRIS Statis BCA', label: 'QRIS Statis BCA' },
        { id: 'QRIS Statis BSI', label: 'QRIS Statis BSI' },
        { id: 'Potong Saldo Member', label: 'Potong Saldo Member' }
      ];
    }

    const groups = [];
    const seen = new Set();
    paymentMethods.forEach((m) => {
      if (m.is_active !== 0 && m.is_active !== false) {
        const gName = m.group || 'Tunai';
        if (!seen.has(gName)) {
          seen.add(gName);
          groups.push({
            id: gName,
            label: gName,
            requiresMemberBalance: m.requires_member_balance === 1
          });
        }
      }
    });

    return groups;
  }, [paymentMethods]);

  // 2. Extract sub-items (e.g. Card Types for EDC) matching the selected mainCategory group
  const subItemsForGroup = useMemo(() => {
    if (!paymentMethods || paymentMethods.length === 0) return [];
    return paymentMethods.filter(
      (m) => m.group === mainCategory && (m.is_active !== 0 && m.is_active !== false)
    );
  }, [mainCategory, paymentMethods]);

  const hasSubItems = subItemsForGroup.length > 1;
  const isTransferBank = mainCategory === 'Transfer Bank';
  const isMemberBalance = mainCategory === 'Potong Saldo Member';

  // Ensure default mainCategory and edcCardType are valid
  useEffect(() => {
    if (mainGroupList.length > 0 && !mainGroupList.some((g) => g.id === mainCategory)) {
      setMainCategory(mainGroupList[0].id);
    }
  }, [mainGroupList, mainCategory, setMainCategory]);

  useEffect(() => {
    if (hasSubItems && !subItemsForGroup.some((item) => item.name === edcCardType)) {
      if (subItemsForGroup[0]?.name) {
        setEdcCardType(subItemsForGroup[0].name);
      }
    }
  }, [hasSubItems, subItemsForGroup, edcCardType, setEdcCardType]);

  const defaultBankAccount = useMemo(() => {
    return getBankAccountForOutlet(activeOutletId, activeOutletName, outlets);
  }, [activeOutletId, activeOutletName, outlets]);

  const selectedBankAccount = useMemo(() => {
    if (isCrossTransfer && OUTLET_BANK_ACCOUNTS[crossBankOutletId]) {
      return OUTLET_BANK_ACCOUNTS[crossBankOutletId];
    }
    return defaultBankAccount;
  }, [isCrossTransfer, crossBankOutletId, defaultBankAccount]);

  const currentMemberBal = parseFloat(
    selectedCustomer?.memberBalance ??
    selectedCustomer?.customerBalance ??
    selectedCustomer?.deposit_balance ??
    selectedCustomer?.customer_deposit_balance ??
    selectedCustomer?.depositBalance ??
    0
  );
  const hasMemberBalance = currentMemberBal >= grandTotal && currentMemberBal > 0;

  return (
    <div className="space-y-3 animate-fade-in">
      {/* Level 1: Kategori Utama Pembayaran */}
      <div>
        <label className="text-[11px] font-bold text-slate-500 uppercase tracking-wider block mb-1.5">
          Pilih Kategori Utama Pembayaran
        </label>
        <select
          value={mainCategory}
          onChange={(e) => {
            const nextCat = e.target.value;
            setMainCategory(nextCat);
            if (nextCat !== 'Transfer Bank' && setIsCrossTransfer) {
              setIsCrossTransfer(false);
            }
          }}
          className="w-full px-4 py-3 bg-white border border-[#e0e0e0] rounded-2xl text-xs font-bold text-[#313030] outline-none focus:border-[#5f1340] cursor-pointer shadow-2xs"
        >
          {mainGroupList.map((cat) => {
            const isMember = cat.id === 'Potong Saldo Member';
            if (isMember) {
              if (!hasMemberBalance) {
                return (
                  <option key={cat.id} value={cat.id} disabled>
                    {cat.label} (Saldo Tidak Cukup: Rp {currentMemberBal.toLocaleString('id-ID')})
                  </option>
                );
              }
              return (
                <option key={cat.id} value={cat.id}>
                  {cat.label} (Saldo: Rp {currentMemberBal.toLocaleString('id-ID')})
                </option>
              );
            }
            return (
              <option key={cat.id} value={cat.id}>
                {cat.label}
              </option>
            );
          })}
        </select>
      </div>

      {/* Level 2: Sub-Kategori / Pilihan Kartu Mesin (jika memiliki sub-tipe seperti EDC) */}
      {hasSubItems && (
        <div className="p-4 bg-purple-50/70 border border-purple-200 rounded-2xl space-y-2.5 shadow-2xs">
          <div className="flex items-center gap-2">
            <CreditCard className="h-4 w-4 text-[#5f1340]" />
            <label className="text-[11px] font-black text-[#5f1340] uppercase tracking-wider">
              Pilih Tipe {mainCategory}
            </label>
          </div>

          <div className="grid grid-cols-2 gap-2">
            {subItemsForGroup.map((item, idx) => {
              const isSelected = edcCardType === item.name || edcCardType === item.label;
              return (
                <button
                  key={item.id || item.code || idx}
                  type="button"
                  onClick={() => setEdcCardType(item.name || item.label)}
                  className={`p-2.5 rounded-xl border text-left transition-all cursor-pointer flex flex-col justify-between ${
                    isSelected
                      ? 'bg-[#5f1340] text-white border-[#5f1340] shadow-2xs'
                      : 'bg-white text-slate-700 border-purple-200 hover:border-[#5f1340]'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span className="font-extrabold text-xs">{item.name}</span>
                    {isSelected && <Check className="h-3.5 w-3.5 text-white" />}
                  </div>
                  <span className={`text-[9px] font-medium mt-1 ${isSelected ? 'text-purple-100' : 'text-slate-400'}`}>
                    {item.label}
                  </span>
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* Level 2: Sub-Kategori Pilihan untuk Transfer Bank & Cross Transfer */}
      {isTransferBank && (
        <div className="p-4 bg-sky-50/90 border border-sky-200 rounded-2xl flex flex-col gap-3 text-xs shadow-2xs">
          <div className="flex items-center justify-between gap-2 flex-wrap">
            <div className="flex items-center gap-2 font-black text-sky-900">
              <Building2 className="h-4.5 w-4.5 text-sky-600 shrink-0" />
              <span>Rekening Bank Tujuan Transfer</span>
            </div>
            <button
              type="button"
              onClick={() => setIsCrossTransfer && setIsCrossTransfer(!isCrossTransfer)}
              className={`px-3 py-1.5 rounded-xl text-[10px] font-black transition-all cursor-pointer flex items-center gap-1.5 ${
                isCrossTransfer
                  ? 'bg-[#5f1340] text-white shadow-xs'
                  : 'bg-white border border-sky-300 text-sky-800 hover:bg-sky-100'
              }`}
              title="Klik jika pelanggan transfer ke rekening bank cabang outlet lain"
            >
              <ArrowRightLeft className="h-3.5 w-3.5" />
              <span>{isCrossTransfer ? '⚡ Cross Transfer (Aktif)' : 'Cross Transfer Bank Account'}</span>
            </button>
          </div>

          {isCrossTransfer ? (
            <div className="flex flex-col gap-2 bg-white p-3.5 rounded-xl border border-sky-300 shadow-2xs">
              <label className="text-[10px] font-extrabold text-slate-500 uppercase tracking-wider">
                Pilih Rekening Outlet Tujuan (Cross Transfer):
              </label>
              <select
                value={crossBankOutletId}
                onChange={(e) => setCrossBankOutletId && setCrossBankOutletId(parseInt(e.target.value, 10))}
                className="w-full p-2.5 bg-[#f8f8f8] border border-sky-300 rounded-xl text-xs font-bold text-slate-800 outline-none focus:border-[#5f1340] cursor-pointer"
              >
                {getAllBankAccounts().map((acc) => (
                  <option key={acc.outletId} value={acc.outletId}>
                    {acc.label} — {acc.outletName}
                  </option>
                ))}
              </select>
              <div className="p-2 bg-amber-50 border border-amber-200 rounded-lg text-[10px] text-amber-900 font-semibold">
                📌 Pelanggan transfer ke rekening <strong>{selectedBankAccount.label}</strong>
              </div>
            </div>
          ) : (
            <div className="bg-white p-3.5 rounded-xl border border-sky-200 flex flex-col gap-1 text-slate-700">
              <span className="font-mono font-black text-sm text-[#5f1340]">
                {selectedBankAccount.bankName} - {selectedBankAccount.accountNumber}
              </span>
              <span className="text-xs font-bold text-slate-800">
                a/n {selectedBankAccount.accountHolder}
              </span>
            </div>
          )}
        </div>
      )}

      {/* Info Potong Saldo Member */}
      {isMemberBalance && (
        <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-2xl text-xs text-emerald-900">
          <div className="flex items-center gap-2 font-black mb-1">
            <Wallet className="h-4 w-4" />
            Potong Saldo Member
          </div>
          <p>
            Rp {grandTotal.toLocaleString('id-ID')} akan dipotong dari saldo member.
            Sisa saldo: Rp {Math.max(0, (selectedCustomer?.memberBalance || 0) - grandTotal).toLocaleString('id-ID')}
          </p>
        </div>
      )}
    </div>
  );
}

/**
 * Helper function to resolve the full descriptive payment method string from cascading inputs.
 */
export function resolvePaymentMethodString({
  mainCategory,
  edcCardType = 'Debit Card',
  isCrossTransfer = false,
  crossBankOutletId = 1,
  activeOutletId,
  activeOutletName,
  outlets = []
}) {
  if (!mainCategory) return 'Tunai';

  if (['EDC BCA', 'EDC BSI', 'EDC BRI'].includes(mainCategory)) {
    return `${mainCategory} - ${edcCardType || 'Debit Card'}`;
  }

  if (mainCategory === 'Transfer Bank') {
    const bank = isCrossTransfer && OUTLET_BANK_ACCOUNTS[crossBankOutletId]
      ? OUTLET_BANK_ACCOUNTS[crossBankOutletId]
      : getBankAccountForOutlet(activeOutletId, activeOutletName, outlets);

    return isCrossTransfer
      ? `Transfer Bank (${bank.label} - Cross Outlet ${bank.outletId})`
      : `Transfer Bank (${bank.label})`;
  }

  return mainCategory;
}
