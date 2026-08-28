/**
 * Koneksi thermal printer via Web Serial API (Chrome/Edge).
 * RPP02N / sejenis biasanya muncul sebagai port Serial setelah Bluetooth/USB pairing di Windows.
 */

const BAUD_CANDIDATES = [9600, 115200, 38400, 19200, 57600];

let port = null;
let writer = null;
let reader = null;
let keepReading = false;
let disconnectHandler = null;

export function isSerialSupported() {
  return typeof navigator !== 'undefined' && !!navigator.serial;
}

export function isPrinterConnected() {
  return !!(port && writer);
}

export function getConnectedPortInfo() {
  if (!port) return null;
  try {
    const info = port.getInfo?.() || {};
    return {
      usbVendorId: info.usbVendorId || null,
      usbProductId: info.usbProductId || null
    };
  } catch {
    return {};
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
 * Dialog pilih port Serial (butuh gesture user).
 */
export async function connectThermalPrinter() {
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

/**
 * Kirim raw ESC/POS bytes ke printer yang sudah terkoneksi.
 */
export async function writeToThermalPrinter(bytes) {
  if (!isPrinterConnected()) {
    throw new Error('Printer belum terhubung. Hubungkan dulu di Setting Printer.');
  }
  const data = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes);
  const CHUNK = 512;
  for (let i = 0; i < data.length; i += CHUNK) {
    await writer.write(data.subarray(i, Math.min(i + CHUNK, data.length)));
    await new Promise((r) => setTimeout(r, 20));
  }
}
