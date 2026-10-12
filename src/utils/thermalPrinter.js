/**
 * Koneksi thermal printer.
 *
 * Dua mode (dipilih otomatis):
 *  - 'serial' : Web Serial API (Chrome/Edge desktop). RPP02N / sejenis muncul sebagai
 *               port COM setelah Bluetooth/USB pairing di Windows.
 *  - 'rawbt'  : Android (tablet/HP). Web Serial di Android hanya mengenali USB-serial,
 *               bukan Bluetooth Classic, jadi data ESC/POS dikirim lewat aplikasi RawBT
 *               (ru.a402d.rawbtprinter) memakai Android intent.
 */

const BAUD_CANDIDATES = [9600, 115200, 38400, 19200, 57600];
const RAWBT_PACKAGE = 'ru.a402d.rawbtprinter';
const RAWBT_FLAG_KEY = 'thermal_rawbt_ready';

let port = null;
let writer = null;
let reader = null;
let keepReading = false;
let disconnectHandler = null;

// ---------------------------------------------------------------------------
// Deteksi mode
// ---------------------------------------------------------------------------

export function isAndroidDevice() {
  return typeof navigator !== 'undefined' && /Android/i.test(navigator.userAgent || '');
}

/** Android selalu pakai RawBT, karena Web Serial tidak bisa melihat printer Bluetooth. */
export function isRawBtMode() {
  return isAndroidDevice();
}

export function getPrinterMode() {
  return isRawBtMode() ? 'rawbt' : 'serial';
}

export function isSerialSupported() {
  return typeof navigator !== 'undefined' && !!navigator.serial;
}

/** Ada cara untuk mencetak di perangkat ini (serial di desktop, RawBT di Android). */
export function isPrintSupported() {
  return isRawBtMode() || isSerialSupported();
}

// ---------------------------------------------------------------------------
// RawBT (Android)
// ---------------------------------------------------------------------------

function readRawBtReady() {
  try {
    return localStorage.getItem(RAWBT_FLAG_KEY) === '1';
  } catch {
    return false;
  }
}

function writeRawBtReady(val) {
  try {
    if (val) localStorage.setItem(RAWBT_FLAG_KEY, '1');
    else localStorage.removeItem(RAWBT_FLAG_KEY);
  } catch { /* ignore */ }
}

function bytesToBase64(bytes) {
  let bin = '';
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) {
    bin += String.fromCharCode.apply(null, bytes.subarray(i, i + chunk));
  }
  return btoa(bin);
}

function sendToRawBt(bytes) {
  const b64 = bytesToBase64(bytes);
  const url =
    `intent:base64,${b64}#Intent;scheme=rawbt;launchFlags=0x10000000;package=${RAWBT_PACKAGE};end;`;
  // Batas panjang URL intent beberapa ratus KB; nota teks biasa jauh di bawahnya,
  // tetapi logo/gambar raster yang besar bisa melewati batas ini.
  if (url.length > 1_500_000) {
    throw new Error(
      'Data nota terlalu besar untuk dikirim ke RawBT. Kecilkan ukuran logo/gambar di nota.'
    );
  }
  window.location.href = url;
}

// ---------------------------------------------------------------------------
// Status & info
// ---------------------------------------------------------------------------

export function isPrinterConnected() {
  if (isRawBtMode()) return readRawBtReady();
  return !!(port && writer);
}

export function getConnectedPortInfo() {
  if (isRawBtMode()) {
    return readRawBtReady() ? { mode: 'rawbt' } : null;
  }
  if (!port) return null;
  try {
    const info = port.getInfo?.() || {};
    return {
      mode: 'serial',
      usbVendorId: info.usbVendorId || null,
      usbProductId: info.usbProductId || null
    };
  } catch {
    return { mode: 'serial' };
  }
}

export function formatSerialConnectError(err) {
  const raw = err?.message || String(err || '');
  const isOpenFail = /failed to open serial port|could not open|access denied|networkerror/i.test(raw);

  if (err?.name === 'NotFoundError') {
    return 'Koneksi dibatalkan — tidak ada port yang dipilih.';
  }

  if (isOpenFail) {
    return [
      'Gagal membuka port serial printer.',
      '',
      'Coba langkah ini:',
      '1. Pastikan printer menyala & Bluetooth Windows status Connected',
      '2. Tutup tab Chrome/Edge lain atau aplikasi POS yang memakai printer',
      '3. Di Windows: Bluetooth → disconnect RPP02N → connect ulang',
      '4. Tunggu 3–5 detik, lalu Hubungkan lagi dan pilih port yang sama',
      '',
      'Jika tetap gagal: Device Manager → Ports (COM & LPT) — pastikan ada COM untuk printer dan tidak bertanda error.'
    ].join('\n');
  }

  return raw || 'Gagal menghubungkan printer';
}

// ---------------------------------------------------------------------------
// Web Serial (desktop)
// ---------------------------------------------------------------------------

async function releaseLocks() {
  keepReading = false;
  try {
    await reader?.cancel?.();
  } catch { /* ignore */ }
  try {
    reader?.releaseLock?.();
  } catch { /* ignore */ }
  reader = null;

  try {
    writer?.releaseLock?.();
  } catch { /* ignore */ }
  writer = null;
}

async function closePortQuiet(p) {
  if (!p) return;
  try {
    if (disconnectHandler) {
      p.removeEventListener?.('disconnect', disconnectHandler);
    }
  } catch { /* ignore */ }
  try {
    await p.close();
  } catch { /* ignore */ }
}

export async function disconnectThermalPrinter() {
  if (isRawBtMode()) {
    writeRawBtReady(false);
    return;
  }
  const current = port;
  port = null;
  await releaseLocks();
  await closePortQuiet(current);
  disconnectHandler = null;
}

async function attachStreams(selectedPort) {
  port = selectedPort;

  disconnectHandler = () => {
    writer = null;
    port = null;
    reader = null;
  };
  port.addEventListener?.('disconnect', disconnectHandler);

  keepReading = true;
  if (port.readable) {
    (async () => {
      try {
        reader = port.readable.getReader();
        while (keepReading) {
          const { done } = await reader.read();
          if (done) break;
        }
      } catch {
        /* disconnect / cancel */
      } finally {
        try { reader?.releaseLock(); } catch { /* ignore */ }
        reader = null;
      }
    })();
  }

  if (!port.writable) {
    throw new Error('Port tidak writable');
  }
  writer = port.writable.getWriter();
  return getConnectedPortInfo();
}

async function openPort(selectedPort) {
  // Pastikan state lokal bersih + port tidak terkunci dari sesi sebelumnya
  await disconnectThermalPrinter();
  await releaseLocks();
  try {
    // Jika port masih open di browser (readable/writable ada), tutup dulu
    if (selectedPort.readable || selectedPort.writable) {
      await closePortQuiet(selectedPort);
      await new Promise((r) => setTimeout(r, 300));
    }
  } catch { /* ignore */ }

  let lastErr = null;
  for (const baudRate of BAUD_CANDIDATES) {
    try {
      await selectedPort.open({
        baudRate,
        dataBits: 8,
        stopBits: 1,
        parity: 'none',
        flowControl: 'none'
      });
      return await attachStreams(selectedPort);
    } catch (err) {
      lastErr = err;
      await releaseLocks();
      await closePortQuiet(selectedPort);
      await new Promise((r) => setTimeout(r, 200));
    }
  }

  const wrapped = new Error(formatSerialConnectError(lastErr));
  wrapped.name = lastErr?.name || 'SerialOpenError';
  wrapped.cause = lastErr;
  throw wrapped;
}

/**
 * Hubungkan printer.
 *  - Android : tidak ada dialog; cukup menandai "siap" (RawBT yang mengurus Bluetooth).
 *  - Desktop : dialog pilih port Serial (butuh gesture user).
 */
export async function connectThermalPrinter() {
  if (isRawBtMode()) {
    writeRawBtReady(true);
    return { mode: 'rawbt' };
  }

  if (!isSerialSupported()) {
    throw new Error(
      'Browser tidak mendukung Web Serial. Pakai Google Chrome atau Microsoft Edge di desktop.'
    );
  }

  // Lepas koneksi lama dulu supaya port tidak "double open"
  await disconnectThermalPrinter();

  const selected = await navigator.serial.requestPort({
    // filters kosong = tampilkan semua port yang tersedia
    filters: []
  });

  return openPort(selected);
}

/**
 * Coba reconnect ke port yang sudah pernah diizinkan browser.
 * Tidak memaksa — gagal = diam, user hubungkan manual.
 */
export async function tryReconnectThermalPrinter() {
  if (isRawBtMode()) return readRawBtReady();
  if (!isSerialSupported()) return false;
  if (isPrinterConnected()) return true;

  try {
    const ports = await navigator.serial.getPorts();
    if (!ports.length) return false;
    await openPort(ports[0]);
    return true;
  } catch (err) {
    console.warn('tryReconnectThermalPrinter:', err);
    await disconnectThermalPrinter();
    return false;
  }
}

let writeInProgress = false;

/**
 * Kirim ESC/POS utuh — jangan potong 512 byte (penyebab nota korup).
 * Android: dikirim ke RawBT lewat intent. Desktop: ditulis ke port serial.
 */
export async function writeToThermalPrinter(bytes) {
  if (!isPrinterConnected()) {
    throw new Error('Printer belum terhubung. Hubungkan dulu di Setting Printer.');
  }
  if (writeInProgress) {
    throw new Error('Printer sedang mencetak. Tunggu selesai dulu.');
  }

  const data = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes);
  if (!data.length) return;

  writeInProgress = true;
  try {
    if (isRawBtMode()) {
      sendToRawBt(data);
      // Beri waktu Android membuka RawBT sebelum cetak berikutnya
      await new Promise((r) => setTimeout(r, 800));
      return;
    }
    await writer.ready;
    await writer.write(data);
    await writer.ready;
    await new Promise((r) => setTimeout(r, 200));
  } finally {
    writeInProgress = false;
  }
}