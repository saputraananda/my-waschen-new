import React from 'react';
import ReactDOM from 'react-dom/client';
import { registerSW } from 'virtual:pwa-register';
import App from './App.jsx';
import './index.css';
import axios from 'axios';
import { logoutSession } from './utils/authSession.js';
import { installNetworkMonitor } from './utils/networkStatus.js';
import { installApiCache } from './utils/apiCache.js';

installNetworkMonitor();
installApiCache();

// Server mewajibkan JWT di semua /api (kecuali login): sisipkan otomatis bila belum ada.
axios.interceptors.request.use((cfg) => {
    const url = String(cfg.url || '');
    if (url.startsWith('/api/') && !url.startsWith('/api/auth/')) {
        const token = localStorage.getItem('token');
        if (token && !cfg.headers?.Authorization) cfg.headers.Authorization = `Bearer ${token}`;
    }
    return cfg;
});

// Token kadaluarsa/invalid -> bersihkan sesi & langsung ke login, tanpa pesan error.
axios.interceptors.response.use(
    (r) => r,
    (err) => {
        const url = String(err?.config?.url || '');
        if (err?.response?.status === 401 && !url.includes('/api/auth/login') && window.location.pathname !== '/login') {
            logoutSession();
            window.location.replace('/login');
            return new Promise(() => {});
        }
        return Promise.reject(err);
    }
);

// Mode autoUpdate: plugin memanggil reload tanpa syarat tiap SW baru aktif. Tanpa pengaman, dua versi
// sw.js yang bergantian terlayani (cache server/CDN, Safari + PWA terbuka bersamaan) bisa membuat
// halaman reload terus-menerus -> iOS menampilkan "A problem repeatedly occurred".
const SW_RELOAD_KEY = 'waschen:sw-reload-times';
const SW_RELOAD_WINDOW_MS = 2 * 60 * 1000;
const SW_RELOAD_MAX = 2;

function reloadForUpdate() {
    // Jangan menyela kasir yang sedang menyusun order; SW baru tetap aktif, JS baru terpakai di muatan berikutnya.
    const path = window.location.pathname;
    if (path.startsWith('/transaction') && !path.startsWith('/transaction/complete')) return;

    const now = Date.now();
    let times = [];
    try {
        times = JSON.parse(sessionStorage.getItem(SW_RELOAD_KEY) || '[]').filter((t) => now - t < SW_RELOAD_WINDOW_MS);
    } catch { /* sessionStorage diblokir: lanjut tanpa riwayat */ }
    if (times.length >= SW_RELOAD_MAX) return; // pengaman loop reload
    try {
        sessionStorage.setItem(SW_RELOAD_KEY, JSON.stringify([...times, now]));
    } catch { /* abaikan */ }
    window.location.reload();
}

// iOS PWA standalone tidak reload saat resume dari background -> update SW tak pernah terdeteksi.
// Cek update saat app kembali foreground (maks 1x per 10 menit) + tiap 1 jam.
const SW_CHECK_MIN_GAP_MS = 10 * 60 * 1000;
registerSW({
    immediate: true,
    onNeedReload: reloadForUpdate,
    onRegisteredSW(_url, reg) {
        if (!reg) return;
        let lastCheck = Date.now();
        const check = (force = false) => {
            if (document.visibilityState !== 'visible') return;
            if (!force && Date.now() - lastCheck < SW_CHECK_MIN_GAP_MS) return;
            lastCheck = Date.now();
            reg.update().catch(() => {});
        };
        document.addEventListener('visibilitychange', () => check());
        window.addEventListener('focus', () => check());
        setInterval(() => check(true), 60 * 60 * 1000);
    },
});

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
