import React from 'react';
import ReactDOM from 'react-dom/client';
import { registerSW } from 'virtual:pwa-register';
import App from './App.jsx';
import './index.css';
import axios from 'axios';
import { logoutSession } from './utils/authSession.js';

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

// iOS PWA standalone tidak reload saat resume dari background -> update SW tak pernah terdeteksi.
// Paksa cek update saat app kembali foreground + tiap 1 jam.
const updateSW = registerSW({
    immediate: true,
    onRegisteredSW(_url, reg) {
        if (!reg) return;
        const check = () => { if (document.visibilityState === 'visible') reg.update(); };
        document.addEventListener('visibilitychange', check);
        window.addEventListener('focus', check);
        setInterval(check, 60 * 60 * 1000);
    },
    onNeedRefresh() { updateSW(true); },
});

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
