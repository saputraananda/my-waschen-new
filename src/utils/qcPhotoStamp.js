const STAGE_PROCESS_LABEL = {
  frontliner: 'Frontliner',
  delivery: 'Pengantaran',
  handover: 'Serah Terima',
  payment: 'Bukti Bayar'
};

function formatPhotoTimestampWib(date = new Date()) {
  const parts = new Intl.DateTimeFormat('id-ID', {
    timeZone: 'Asia/Jakarta',
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false
  }).formatToParts(new Date(date));
  const get = (type) => parts.find((p) => p.type === type)?.value || '';
  return `${get('weekday')}, ${get('day')} ${get('month')} ${get('year')}, ${get('hour')}:${get('minute')} WIB`;
}

export function qcPhotographerName() {
  return localStorage.getItem('fullName') || 'Karyawan';
}

function truncateLine(ctx, text, maxWidth) {
  const raw = String(text || '');
  if (ctx.measureText(raw).width <= maxWidth) return raw;
  let t = raw;
  while (t.length > 3 && ctx.measureText(`${t}…`).width > maxWidth) t = t.slice(0, -1);
  return `${t}…`;
}

/** 3 baris watermark, sama urutan dengan Waschen Mobile */
export function buildQcPhotoLines({ orderNo, stage, date = new Date() }) {
  return [
    formatPhotoTimestampWib(date),
    `${orderNo || '-'} - ${STAGE_PROCESS_LABEL[stage] || stage}`,
    qcPhotographerName()
  ];
}

export function drawTextOverlay(ctx, width, height, lines) {
  const safeLines = lines.map((l) => String(l || '').trim()).filter(Boolean);
  if (!safeLines.length) return;
  const pad = Math.max(12, Math.floor(Math.min(width, height) * 0.02));
  const primarySize = Math.max(13, Math.floor(Math.min(width, height) * 0.032));
  const secondarySize = Math.max(11, Math.floor(primarySize * 0.82));
  const lineGap = Math.max(3, Math.floor(primarySize * 0.3));
  const maxTextW = Math.min(width * 0.92, width - pad * 4);
  ctx.textBaseline = 'alphabetic';
  let boxW = 0;
  const measured = safeLines.map((line, i) => {
    const size = i === 0 ? primarySize : secondarySize;
    ctx.font = `${i === 0 ? 700 : 600} ${size}px system-ui, Segoe UI, Arial`;
    const text = truncateLine(ctx, line, maxTextW);
    boxW = Math.max(boxW, ctx.measureText(text).width);
    return { text, size, bold: i === 0 };
  });
  const boxH = pad * 2 + measured.reduce((sum, m, i) => sum + m.size + (i < measured.length - 1 ? lineGap : 0), 0);
  const x = pad;
  const y = height - boxH - pad;
  ctx.fillStyle = 'rgba(0,0,0,0.58)';
  ctx.fillRect(x, y, boxW + pad * 2, boxH);
  let cursorY = y + pad;
  measured.forEach((m, i) => {
    cursorY += m.size;
    ctx.fillStyle = i === 0 ? '#ffffff' : 'rgba(255,255,255,0.94)';
    ctx.font = `${m.bold ? 700 : 600} ${m.size}px system-ui, Segoe UI, Arial`;
    ctx.fillText(m.text, x + pad, cursorY);
    if (i < measured.length - 1) cursorY += lineGap;
  });
}

/** Cap nota + tahap + nama, hasil JPEG. Sama pola dengan Waschen Mobile. */
export async function burnQcPhoto(file, { orderNo, stage }) {
  const img = await new Promise((resolve, reject) => {
    const el = new Image();
    const url = URL.createObjectURL(file);
    el.onload = () => { URL.revokeObjectURL(url); resolve(el); };
    el.onerror = (e) => { URL.revokeObjectURL(url); reject(e); };
    el.src = url;
  });
  const maxW = 1600;
  const scale = img.width > maxW ? maxW / img.width : 1;
  const w = Math.round(img.width * scale);
  const h = Math.round(img.height * scale);
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d');
  ctx.drawImage(img, 0, 0, w, h);
  drawTextOverlay(ctx, w, h, buildQcPhotoLines({ orderNo, stage }));
  const blob = await new Promise((resolve) => canvas.toBlob(resolve, 'image/jpeg', 0.88));
  if (!blob) throw new Error('Gagal memproses foto');
  return new File([blob], `qc_${Date.now()}.jpg`, { type: 'image/jpeg' });
}
