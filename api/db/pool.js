import mysql from 'mysql2/promise';
import dotenv from 'dotenv';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Ensure env variables are loaded if this file is imported directly in tests/scripts
const envFile = process.env.NODE_ENV === 'production' ? '.env.prod' : '.env';
const envPath = path.resolve(__dirname, '../../', envFile);
if (fs.existsSync(envPath)) {
  dotenv.config({ path: envPath });
} else {
  dotenv.config();
}

export const mainPool = mysql.createPool({
  host: process.env.DB_HOST,
  port: parseInt(process.env.DB_PORT || '3306'),
  user: process.env.DB_USER,
  password: process.env.DB_PASS,
  database: process.env.DB_NAME,
  timezone: '+07:00',
  waitForConnections: true,
  connectionLimit: 10,
  maxIdle: 2,                   // harus < connectionLimit agar idleTimeout mereap koneksi nganggur
  idleTimeout: 60000,
  queueLimit: 0,
  enableKeepAlive: true,
  keepAliveInitialDelay: 10000, // 10 detik keep-alive ping
  connectTimeout: 10000         // 10 detik timeout koneksi
});

export const myWaschenPool = mysql.createPool({
  host: process.env.DB_HOST_MY_WASCHEN,
  port: parseInt(process.env.DB_PORT_MY_WASCHEN || '3306'),
  user: process.env.DB_USER_MY_WASCHEN,
  password: process.env.DB_PASS_MY_WASCHEN,
  database: process.env.DB_NAME_MY_WASCHEN,
  timezone: '+07:00',
  waitForConnections: true,
  connectionLimit: 10,
  maxIdle: 6,                   // harus < connectionLimit; koneksi hangat dipakai ulang (buka baru ke DB remote bisa 4-6 detik)
  idleTimeout: 300000,
  queueLimit: 0,
  enableKeepAlive: true,
  keepAliveInitialDelay: 10000, // 10 detik keep-alive ping
  connectTimeout: 10000         // 10 detik timeout koneksi
});

function holdPool(pool) {
  const raw = pool.pool || pool;
  raw.on('error', (err) => {
    console.error('mysql', err.code || err.message);
  });
}
holdPool(mainPool);
holdPool(myWaschenPool);

/**
 * Jaga koneksi tetap hangat: buka beberapa koneksi sekarang dan ping berkala, supaya request
 * pertama (atau banyak request paralel saat halaman dibuka) tidak menunggu koneksi baru.
 * Dipanggil dari server saja, bukan saat import (skrip satu kali tidak ikut).
 */
export function startPoolWarmup({ pool = myWaschenPool, size = 4, everyMs = 45000 } = {}) {
  const warm = async () => {
    try {
      await Promise.all(Array.from({ length: size }, async () => {
        const conn = await pool.getConnection();
        try { await conn.query('SELECT 1'); } finally { conn.release(); }
      }));
    } catch (err) {
      console.error('pool warmup:', err.code || err.message);
    }
  };
  warm();
  const timer = setInterval(warm, everyMs);
  timer.unref?.();
  return timer;
}

export default {
  mainPool,
  myWaschenPool
};
