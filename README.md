# PT Waschen Alora Indonesia - My Waschen SuperApp

**My Waschen** adalah platform sistem manajemen laundry terpadu (SuperApp) yang dikembangkan untuk **PT Waschen Alora Indonesia**. Aplikasi ini dibangun menggunakan arsitektur monorepo modern dengan **React (Vite)** pada sisi *frontend* dan **Node.js (Express.js)** pada sisi *backend*.

---

## 🚀 Fitur Utama

- 📊 **Dashboard & Analisis Real-time**: Visualisasi data transaksi, grafik performa outlet, dan laporan keuangan berbasis [Recharts](https://recharts.org/).
- 🔐 **Autentikasi & Keamanan**: Dukungan autentikasi berbasis JWT, enkripsi kata sandi, serta integrasi biometrik WebAuthn.
- 🏢 **Multi-Tenant / Multi-Outlet Management**: Pengelolaan data outlet, pengguna, peran (roles), dan hak akses secara aman.
- 🗄️ **Koneksi Multi-Database**: Dukungan koneksi ganda ke database SuperApp dan database operasional berbasis MySQL.
- 🧾 **Laporan & Ekspor Data**: Pengolahan laporan Excel menggunakan `exceljs` dan manajemen gambar/upload menggunakan `sharp` & `multer`.

---

## 🛠️ Teknologi & Stack

### Frontend
- **Framework**: React 18 + Vite
- **Styling**: Tailwind CSS, PostCSS, Autoprefixer
- **UI & Icon**: Lucide React, SweetAlert2
- **Routing & State**: React Router DOM (v6)
- **Charts**: Recharts

### Backend
- **Runtime**: Node.js (ES Modules)
- **Framework**: Express.js
- **Database**: MySQL (driver `mysql2` dengan Connection Pooling)
- **Keamanan**: JSON Web Token (`jsonwebtoken`), `bcryptjs`, CORS
- **Pengolahan File**: Multer, Sharp, ExcelJS

---

## 📁 Struktur Direktori

```
my-waschen-new/
├── api/                    # Backend API (Express.js)
│   ├── controllers/        # Logika bisnis & pengolahan request (auth, info, dll.)
│   ├── db/                 # Konfigurasi koneksi MySQL pool
│   ├── middleware/         # Middleware Express (upload, auth, dll.)
│   ├── routes/             # Definisikan endpoint API
│   └── index.js            # Entry point Serverless Function (Vercel) & Express App Instance
├── public/                 # Asset statis publik
├── src/                    # Frontend React
│   ├── assets/             # Gambar & file statis pendukung
│   ├── components/         # Komponen UI modular (Toast, Popups, Navbar, dll.)
│   ├── pages/              # Halaman utama (Dashboard, LoginPage, dll.)
│   ├── utils/              # Utility functions & helpers
│   ├── App.jsx             # Router utama aplikasi
│   ├── main.jsx            # Entry point React
│   └── index.css           # Styling global & Tailwind CSS directives
├── server.js               # Standalone Entry Point Server (Lokal / Hostinger)
├── vercel.json             # Konfigurasi rewrite rute untuk Vercel Deployment
├── vite.config.js          # Konfigurasi Vite & Proxy API
├── package.json            # Dependencies & Script npm
└── README.md               # Dokumentasi proyek
```

---

## ⚙️ Persyaratan Sistem

- **Node.js**: v18.0.0 atau yang lebih baru
- **npm**: v9.0.0 atau yang lebih baru
- **Database**: MySQL v8.0 / MariaDB

---

## 🚀 Panduan Instalasi & Penggunaan

### 1. Clone Repository & Install Dependencies
```bash
git clone <repository-url>
cd my-waschen-new
npm install
```

### 2. Konfigurasi Environment Variable
Buat file `.env` di root proyek menggunakan variabel contoh berikut:

```env
PORT=7001
NODE_ENV=development
CORS_ORIGIN=http://localhost:7000
SESSION_SECRET=your_session_secret

# Database SuperAPP
DB_HOST=your_db_host
DB_PORT=3306
DB_USER=your_db_user
DB_PASS=your_db_password
DB_NAME=your_db_name

# Database My Waschen
DB_HOST_MY_WASCHEN=your_db_host
DB_PORT_MY_WASCHEN=3306
DB_USER_MY_WASCHEN=your_db_user
DB_PASS_MY_WASCHEN=your_db_password
DB_NAME_MY_WASCHEN=your_db_name
```

### 3. Menjalankan Aplikasi dalam Mode Development

Aplikasi dapat dijalankan secara bersamaan (*concurrently*) untuk Frontend dan Backend:

```bash
npm run dev
```

- **Frontend App**: [http://localhost:7000](http://localhost:7000)
- **Backend API**: [http://localhost:7001](http://localhost:7001)

---

## 📜 Daftar NPM Scripts

| Script | Command | Deskripsi |
| :--- | :--- | :--- |
| `npm run dev` | `concurrently "nodemon server.js" "vite"` | Jalankan server backend & client frontend secara bersamaan |
| `npm run dev:server` | `nodemon server.js` | Jalankan hanya backend Express (port 7001) |
| `npm run dev:client` | `vite` | Jalankan hanya frontend Vite (port 7000) |
| `npm run build` | `vite build` | Build bundle frontend untuk lingkungan produksi |
| `npm start` | `node server.js` | Jalankan server Express di lingkungan produksi |
| `npm run preview` | `vite preview` | Preview hasil build produksi dari Vite |

---

## 🛡️ Hak Cipta & Lisensi

© 2026 **PT Waschen Alora Indonesia**. All rights reserved.


