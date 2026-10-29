import { formatEmployeeName } from './FormatName.js';

const HEADER_FILL = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF5F1340' } };
const HEADER_FONT = { bold: true, color: { argb: 'FFFFFFFF' } };
const RUPIAH_FMT = '"Rp" #,##0';

const fmtDate = (v) => (v ? new Date(v).toLocaleDateString('id-ID') : '-');
const fmtTime = (v) => (v ? new Date(v).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' }) : '-');
const fmtDateTime = (v) => (v ? new Date(v).toLocaleString('id-ID') : '-');
const safeSheetName = (s) => String(s).replace(/[\\/?*[\]:]/g, '-').slice(0, 31);

const paymentLabel = (t) => `${t.payment_status === 'DP' ? 'DP ' : ''}${t.payment_method || '-'}`;

const addTransactionTable = (ws, txns) => {
  const header = ws.addRow(['Tanggal', 'Jam', 'No Nota', 'Customer', 'Alamat', 'Pembuat Nota', 'Bayar', 'Nominal', 'Disetujui']);
  header.eachCell((c) => { c.fill = HEADER_FILL; c.font = HEADER_FONT; });
  const first = ws.rowCount + 1;
  txns.forEach((t) => {
    const when = t.last_paid_at || t.order_date;
    const row = ws.addRow([
      fmtDate(when),
      fmtTime(when),
      t.order_no,
      t.customer_name || '-',
      t.customer_address || '',
      t.cashier_name ? formatEmployeeName(t.cashier_name) : '',
      paymentLabel(t),
      Number(t.paid_here) || 0,
      Number(t.is_verified) === 1 ? 'Ya' : 'Belum'
    ]);
    row.getCell(8).numFmt = RUPIAH_FMT;
  });
  const last = ws.rowCount;
  const total = ws.addRow(['', '', '', '', '', '', 'TOTAL', txns.length ? { formula: `SUM(H${first}:H${last})` } : 0, '']);
  total.font = { bold: true };
  total.getCell(8).numFmt = RUPIAH_FMT;
  [12, 8, 22, 24, 30, 22, 14, 16, 12].forEach((w, i) => { ws.getColumn(i + 1).width = w; });
};

const addShiftSummary = (ws, shift) => {
  const rows = [
    ['Shift', `${Number(shift.shift_number) === 2 ? 'Siang' : 'Pagi'} #${shift.id}`],
    ['Status', `${shift.status || '-'}${shift.close_type ? ` · ${shift.close_type}` : ''}`],
    ['Dibuka', `${fmtDateTime(shift.opened_at)}${shift.opener_name ? ` oleh ${formatEmployeeName(shift.opener_name)}` : ''}`],
    ['Ditutup', shift.closed_at ? `${fmtDateTime(shift.closed_at)}${shift.closed_by_name ? ` oleh ${formatEmployeeName(shift.closed_by_name)}` : ''}` : '-']
  ];
  rows.forEach(([k, v]) => { ws.addRow([k, v]).getCell(1).font = { bold: true }; });
  const money = [
    ['Cash Modal Open', shift.initial_cash],
    ['Petty Open', shift.initial_petty_cash],
    ['Cash Aktual Close', shift.actual_cash],
    ['Revenue', shift.declared_revenue]
  ];
  money.forEach(([k, v]) => {
    const r = ws.addRow([k, Number(v) || 0]);
    r.getCell(1).font = { bold: true };
    r.getCell(2).numFmt = RUPIAH_FMT;
    r.getCell(2).alignment = { horizontal: 'left' };
  });
  ws.addRow([]);
};

const download = async (wb, filename) => {
  const buffer = await wb.xlsx.writeBuffer();
  const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
};

const newWorkbook = async () => {
  const ExcelJS = (await import('exceljs')).default;
  const wb = new ExcelJS.Workbook();
  wb.creator = 'Waschen Laundry';
  return wb;
};

/** Halaman Daily Report: satu sheet per shift. */
export async function exportDailyReportToExcel({ shifts, date, outletName }) {
  const wb = await newWorkbook();
  shifts.forEach((s) => {
    const ws = wb.addWorksheet(safeSheetName(`Shift ${Number(s.shift_number) === 2 ? 'Siang' : 'Pagi'} #${s.id}`));
    addShiftSummary(ws, s);
    addTransactionTable(ws, s.transactions || []);
  });
  await download(wb, `Daily-Report_${(outletName || 'Outlet').replace(/\s+/g, '-')}_${date}.xlsx`);
}

/** Modal closing shift: transaksi (sudah terfilter) dari satu shift. */
export async function exportShiftTransactionsToExcel({ shift, txns, label }) {
  const wb = await newWorkbook();
  const ws = wb.addWorksheet('Daily Report');
  addShiftSummary(ws, shift);
  if (label) ws.addRow(['Filter', label]).getCell(1).font = { bold: true };
  addTransactionTable(ws, txns);
  const stamp = new Date().toISOString().slice(0, 10);
  await download(wb, `Daily-Report_Shift-${shift.id}_${stamp}.xlsx`);
}
