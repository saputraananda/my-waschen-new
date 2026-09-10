# My Waschen

Platform POS dan operasional laundry untuk PT Waschen Alora Indonesia. Frontend React (Vite) dan backend Express dalam satu monorepo.

## Fitur

- Dashboard outlet dan antrean nota
- Transaksi kasir (kiloan / satuan)
- Pelanggan dan membership
- Riwayat transaksi dan pelunasan
- Shift, petty cash, inventory
- Cetak nota thermal

## Stack

- Frontend: React 18, Vite, Tailwind CSS, React Router
- Backend: Node.js, Express
- Database: MySQL

## Struktur

```
my-waschen-new/
├── api/           # Backend Express
├── src/           # Frontend React
├── server.js      # Entry server
├── vite.config.js
└── package.json
```

## Menjalankan

Prasyarat: Node.js 18+ dan akses database yang sudah dikonfigurasi di environment lokal.

```bash
npm install
npm run dev
```

- Frontend: `http://localhost:7000`
- Backend: `http://localhost:7001`

Konfigurasi environment disimpan di file `.env` lokal (tidak ikut ke repository).

## Scripts

| Command | Keterangan |
| --- | --- |
| `npm run dev` | Jalankan frontend + backend |
| `npm run build` | Build produksi |
| `npm start` | Jalankan server produksi |

## Lisensi

Hak cipta PT Waschen Alora Indonesia. Semua hak dilindungi.
