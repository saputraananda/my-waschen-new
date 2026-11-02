import axios from 'axios';

/** Master jarang berubah dan diminta hampir semua menu: dipakai ulang agar tidak menunggu sinyal. */
const FRESH_MS = 5 * 60 * 1000;
const REUSABLE = /^\/api\/(masters(\/(outlets|payment-methods|customer-sources|customer-tiers|petty-cash-categories|work-statuses))?|services\/(parfumes|speeds|units))$/;
/** Salinan terakhir dipakai hanya saat server tidak terjangkau. Jangan tambahkan data pelanggan/nota. */
const OFFLINE_COPY = /^\/api\/services$/;
const MASTER_WRITE = /^\/api\/(masters|services)(\/|$)/;
const STORE_PREFIX = 'apiCache:';

const memory = new Map();

const pathOf = (cfg) => String(cfg?.url || '').split('?')[0];
const isGet = (cfg) => String(cfg?.method).toLowerCase() === 'get';
const keyOf = (cfg) => `${cfg.url}|${JSON.stringify(cfg.params || {})}`;
const isCovered = (path) => REUSABLE.test(path) || OFFLINE_COPY.test(path);

const cachedResponse = (json, config) => ({
  data: JSON.parse(json),
  status: 200,
  statusText: 'OK',
  headers: {},
  config,
  request: null
});

function readStored(key) {
  try {
    return localStorage.getItem(STORE_PREFIX + key);
  } catch {
    return null;
  }
}

function store(key, json) {
  try {
    localStorage.setItem(STORE_PREFIX + key, json);
  } catch {
    // Penyimpanan penuh/diblokir: hanya kehilangan salinan cadangan
  }
}

export function installApiCache() {
  axios.interceptors.request.use((cfg) => {
    if (!isGet(cfg) || !REUSABLE.test(pathOf(cfg))) return cfg;
    const hit = memory.get(keyOf(cfg));
    if (hit && Date.now() - hit.at < FRESH_MS) {
      cfg.adapter = async (config) => cachedResponse(hit.json, config);
    }
    return cfg;
  });

  axios.interceptors.response.use(
    (res) => {
      const path = pathOf(res.config);
      if (!isGet(res.config)) {
        if (MASTER_WRITE.test(path)) memory.clear();
        return res;
      }
      if (isCovered(path) && res.data?.success) {
        const key = keyOf(res.config);
        const json = JSON.stringify(res.data);
        memory.set(key, { json, at: Date.now() });
        store(key, json);
      }
      return res;
    },
    (err) => {
      const cfg = err?.config;
      if (cfg && !err.response && !axios.isCancel(err) && isGet(cfg) && isCovered(pathOf(cfg))) {
        const json = readStored(keyOf(cfg));
        if (json) return cachedResponse(json, cfg);
      }
      return Promise.reject(err);
    }
  );
}
