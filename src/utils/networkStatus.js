import axios from 'axios';

/** Request belum selesai selama ini = sinyal lambat. */
const SLOW_MS = 8000;
const GET_TIMEOUT_MS = 30000;
const PROBE_TIMEOUT_MS = 6000;
const PROBE_RETRY_MS = 2000;
const OFFLINE_RETRY_MS = 5000;
/** Probe gagal berturut-turut sebelum dianggap putus (server sibuk sesaat bukan sinyal hilang). */
const OFFLINE_AFTER_FAILS = 2;
const RESTORED_SHOW_MS = 3000;
const STALE_REQUEST_MS = 120000;
/** Server sibuk/lambat bisa terbaca "putus": jangan probe berulang & jangan picu muat ulang data massal. */
const SLOW_PROBE_MIN_GAP_MS = 15000;
const REFETCH_MIN_DOWNTIME_MS = 1000;
const REFETCH_MIN_GAP_MS = 30000;

const WEAK_LINK_TYPES = ['slow-2g', '2g'];

const pending = new Set();
const listeners = new Set();

let offline = false;
let slowRequest = false;
let weakLink = false;
let restored = false;
let unsureWrite = false;
let verifying = false;
let fails = 0;
let retryTimer = null;
let restoredTimer = null;
let offlineSince = 0;
let lastRefetchEventAt = 0;
let lastSlowProbeAt = 0;

const buildSnapshot = () => ({
  status: offline ? 'offline' : (slowRequest || weakLink) ? 'slow' : 'online',
  restored,
  unsureWrite
});

let snapshot = buildSnapshot();

function publish() {
  const next = buildSnapshot();
  if (
    next.status === snapshot.status &&
    next.restored === snapshot.restored &&
    next.unsureWrite === snapshot.unsureWrite
  ) return;
  snapshot = next;
  listeners.forEach((fn) => fn());
}

export const getNetworkSnapshot = () => snapshot;

export function subscribeNetwork(fn) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

async function probe() {
  if (navigator.onLine === false) return false;
  try {
    const res = await fetch('/api/health', { cache: 'no-store', signal: AbortSignal.timeout(PROBE_TIMEOUT_MS) });
    // 4xx tetap berarti server terjangkau
    return res.status < 500;
  } catch {
    return false;
  }
}

function markRestored() {
  const now = Date.now();
  const downtime = offlineSince ? now - offlineSince : 0;
  offline = false;
  offlineSince = 0;
  unsureWrite = false;
  restored = true;
  clearTimeout(restoredTimer);
  restoredTimer = setTimeout(() => {
    restored = false;
    publish();
  }, RESTORED_SHOW_MS);
  // Halaman memuat ulang datanya saat event ini terterima. Hanya untuk putus yang nyata & tidak beruntun,
  // supaya server yang sedang lambat tidak dibanjiri muat-ulang dari semua halaman.
  if (downtime >= REFETCH_MIN_DOWNTIME_MS && now - lastRefetchEventAt >= REFETCH_MIN_GAP_MS) {
    lastRefetchEventAt = now;
    window.dispatchEvent(new Event('waschen:network-restored'));
  }
}

export async function verifyConnection() {
  if (verifying) return;
  verifying = true;
  clearTimeout(retryTimer);
  const ok = await probe();
  verifying = false;

  if (ok) {
    fails = 0;
    if (offline) markRestored();
  } else {
    fails += 1;
    if (fails >= OFFLINE_AFTER_FAILS || navigator.onLine === false) {
      if (!offline) offlineSince = Date.now();
      offline = true;
    }
    retryTimer = setTimeout(verifyConnection, offline ? OFFLINE_RETRY_MS : PROBE_RETRY_MS);
  }
  publish();
}

function finishRequest(config) {
  if (!config) return;
  pending.delete(config);
}

function checkPendingRequests() {
  const now = Date.now();
  let hasSlow = false;
  pending.forEach((cfg) => {
    const age = now - cfg.__startedAt;
    if (age > STALE_REQUEST_MS) pending.delete(cfg);
    else if (age > SLOW_MS) hasSlow = true;
  });
  if (hasSlow && !slowRequest && now - lastSlowProbeAt >= SLOW_PROBE_MIN_GAP_MS) {
    lastSlowProbeAt = now;
    verifyConnection();
  }
  slowRequest = hasSlow;
  publish();
}

function readWeakLink() {
  weakLink = WEAK_LINK_TYPES.includes(navigator.connection?.effectiveType);
  publish();
}

/** Pasang sebelum interceptor lain: interceptor 401 tidak pernah menyelesaikan promise-nya. */
export function installNetworkMonitor() {
  axios.interceptors.request.use((cfg) => {
    // Hanya GET: POST yang diputus lalu diulang kasir bisa menjadi nota ganda
    if (String(cfg.method).toLowerCase() === 'get' && !cfg.timeout) cfg.timeout = GET_TIMEOUT_MS;
    cfg.__startedAt = Date.now();
    pending.add(cfg);
    return cfg;
  });

  axios.interceptors.response.use(
    (res) => {
      finishRequest(res.config);
      return res;
    },
    (err) => {
      finishRequest(err?.config);
      if (axios.isCancel(err)) return Promise.reject(err);
      const noReply = !err?.response;
      const isWrite = String(err?.config?.method).toLowerCase() !== 'get';
      if (noReply && isWrite && !String(err?.config?.url).startsWith('/api/auth/')) {
        // Bisa saja sudah tersimpan di server, hanya balasannya yang hilang
        unsureWrite = true;
      }
      if (noReply || err.response.status >= 500) verifyConnection();
      return Promise.reject(err);
    }
  );

  window.addEventListener('offline', () => {
    if (!offline) offlineSince = Date.now();
    offline = true;
    publish();
    verifyConnection();
  });
  window.addEventListener('online', verifyConnection);
  navigator.connection?.addEventListener?.('change', readWeakLink);
  readWeakLink();
  setInterval(checkPendingRequests, 1000);
}
