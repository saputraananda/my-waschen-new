/**
 * Bank Accounts configuration per Outlet ID as specified in Phase 4 requirements.
 * outletName uses the short `name` column from mst_outlet table.
 */
export const OUTLET_BANK_ACCOUNTS = {
  1: {
    outletId: 1,
    outletName: 'Raffles Hills',
    bankName: 'BSI',
    accountNumber: '7360647368',
    accountHolder: 'WASCHEN ALORA INDONESIA PT',
    label: 'BSI 7360647368 a/n WASCHEN ALORA INDONESIA PT'
  },
  2: {
    outletId: 2,
    outletName: 'Citra Gran',
    bankName: 'BCA',
    accountNumber: '7402065977',
    accountHolder: 'RAHMI SOLEHAH',
    label: 'BCA 7402065977 a/n RAHMI SOLEHAH'
  },
  3: {
    outletId: 3,
    outletName: 'Legenda',
    bankName: 'BCA',
    accountNumber: '7402509743',
    accountHolder: 'RAHMI SOLEHAH',
    label: 'BCA 7402509743 a/n RAHMI SOLEHAH'
  },
  4: {
    outletId: 4,
    outletName: 'Canadian',
    bankName: 'BCA',
    accountNumber: '7402582921',
    accountHolder: 'RAHMI SOLEHAH',
    label: 'BCA 7402582921 a/n RAHMI SOLEHAH'
  },
  5: {
    outletId: 5,
    outletName: 'Sentra Eropa',
    bankName: 'BCA',
    accountNumber: '7402496978',
    accountHolder: 'RAHMI SOLEHAH',
    label: 'BCA 7402496978 a/n RAHMI SOLEHAH'
  }
};

/**
 * Get default bank account for a given outletId or outletName.
 */
export const getBankAccountForOutlet = (outletId, outletName = '', outlets = []) => {
  let id = parseInt(outletId, 10);
  if (!id && outletName && outlets.length > 0) {
    const found = outlets.find(o =>
      (o.name && o.name.toLowerCase().includes(outletName.toLowerCase())) ||
      (o.full_name && o.full_name.toLowerCase().includes(outletName.toLowerCase()))
    );
    if (found) id = parseInt(found.id, 10);
  }

  if (id && OUTLET_BANK_ACCOUNTS[id]) {
    return OUTLET_BANK_ACCOUNTS[id];
  }

  // Fallback to outlet 2 (BCA Rahmi Solehah) if outlet ID not matched
  return OUTLET_BANK_ACCOUNTS[2];
};

/**
 * Get list of all bank accounts for Cross Transfer selection.
 */
export const getAllBankAccounts = () => {
  return Object.values(OUTLET_BANK_ACCOUNTS);
};
