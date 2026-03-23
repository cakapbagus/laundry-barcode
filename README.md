# Laundry Pesantren — Sistem Kasir & Tracking Berbasis Barcode

Aplikasi web full-stack untuk mengelola operasional laundry di pesantren menggunakan QR code. Menggantikan pencatatan manual 100% dengan sistem digital yang real-time, transparan, dan bisa diakses santri kapan saja.

[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)
![Node.js](https://img.shields.io/badge/Node.js-24-green)
![React](https://img.shields.io/badge/React-18-61dafb)
![PWA Ready](https://img.shields.io/badge/PWA-Ready-purple)
[![🚀 Install](https://img.shields.io/badge/🚀_Install-Sekarang-4f46e5?style=for-the-badge)](#instalasi--menjalankan)

---

## Fitur Utama

| Fitur | Deskripsi |
|-------|-----------|
| 📥 Penerimaan Cucian | Form intake dengan autocomplete santri, scan kartu pelajar via kamera, cetak nota + QR code |
| 📱 Scanner QR | Scan kamera real-time, validasi urutan tahap, pilih mesin per proses |
| 📊 Dashboard Kanban | 7 kolom real-time via WebSocket, filter kolom, KPI bulan, alert macet, export CSV |
| 🔍 Tracking Publik | Santri lacak cucian tanpa login via kode order / scan QR |
| 🔐 RBAC | 3 role: KASIR, OPERATOR, MANAGER — JWT authentication |
| ⚙️ Manajemen | Kelola mesin (WASH/DRY/IRON), akun staf, konfigurasi (biaya/kg, estimasi hari, tenggat jam) |
| 📲 PWA | Installable, offline support, standalone mode (Android/iOS/Desktop), splash screen semua device |

---

## Alur Kerja

```
PENERIMAAN → PENCUCIAN → PENGERINGAN → PENYETRIKAAN → PENGEPAKAN → SELESAI → DIAMBIL
```

Setiap perpindahan tahap **divalidasi dengan scan QR** dan tercatat secara immutable (siapa, kapan, mesin apa).

---

## Tech Stack

| Layer | Teknologi |
|-------|-----------|
| Frontend | React 18 + TypeScript + Vite + Tailwind CSS |
| State | Zustand + persist middleware |
| Real-time | socket.io-client |
| QR Scan | jsQR (kamera) + qrcode (generate) |
| PWA | vite-plugin-pwa + Workbox |
| Backend | Node.js 24 + Express.js + TypeScript |
| Database | SQLite 3 via Prisma ORM |
| Auth | JWT (24 jam) + bcrypt + rate limiting (express-rate-limit) |
| WebSocket | socket.io |
| Image Processing | sharp (icon & splash screen generation) |

---

## Struktur Proyek

```
laundry-barcode/
├── backend/
│   ├── prisma/
│   │   ├── schema.prisma       # Data model (User, Order, StageHistory, ScanLog, ...)
│   │   └── seed.ts             # Data awal (users, mesin, settings)
│   ├── src/
│   │   ├── server.ts           # Entry point Express + socket.io
│   │   ├── middleware/         # JWT auth + RBAC
│   │   ├── routes/             # auth, orders, scans, dashboard, settings, machines, users, customers, public
│   │   ├── controllers/        # Business logic
│   │   └── utils/              # orderCode generator, stage flow validator
│   ├── .env                    # Environment variables (tidak di-commit)
│   └── .env.example            # Template environment variables
├── frontend/
│   ├── public/
│   │   ├── icons/              # icon.svg, icon-180x180.png, icon-192x192.png, icon-512x512.png
│   │   └── splash/             # 17 iOS splash screen (iPhone SE s/d iPhone 16 Pro Max + iPad)
│   └── src/
│       ├── pages/              # Login, Intake, Scanner, Dashboard, Orders, Settings, Users, PublicTrack
│       ├── components/         # Navbar (top bar + bottom tab bar mobile)
│       ├── stores/             # Zustand auth store
│       └── api/                # Axios client + interceptors
├── scripts/
│   ├── dev-setup.sh            # Setup lokal otomatis (install, migrate, seed)
│   ├── prod-setup.sh           # Deploy ke VPS Ubuntu (PM2 + Nginx + firewall)
│   └── generate-splash.js      # Generate iOS splash screens dari icon-512x512.png
├── LICENSE
└── README.md
```

---

## Akun Default (Seed)

Production seed hanya membuat satu akun MANAGER. Nama dan password ditanyakan interaktif saat `prod-setup.sh` berjalan:
- Nama dikosongkan → `Admin` / `admin123`
- Nama diisi → password 6 karakter acak, ditampilkan di akhir script

Akun KASIR dan OPERATOR dibuat manual oleh MANAGER setelah login pertama via menu **Manajemen → Pengguna**.

**Development (seed lokal):**

| Nama | Password | Role |
|------|----------|------|
| Admin | `admin123` | MANAGER |

---

## Instalasi & Menjalankan

### Production

#### Cara 1 — Langsung via curl

```bash
curl -fsSL https://raw.githubusercontent.com/cakapbagus/laundry-barcode/main/scripts/prod-setup.sh | sudo bash
```

Script otomatis clone repo, install semua dependensi, setup database, build, dan konfigurasi Nginx + PM2 + firewall.

#### Cara 2 — Download script lalu jalankan

```bash
curl -O https://raw.githubusercontent.com/cakapbagus/laundry-barcode/main/scripts/prod-setup.sh
sudo bash prod-setup.sh
```

#### Cara 3 — Clone repo dulu lalu jalankan

```bash
git clone https://github.com/cakapbagus/laundry-barcode.git
cd laundry-barcode
sudo bash scripts/prod-setup.sh
```

---

### Development (Lokal)

### Prasyarat
- Node.js >= 20
- npm >= 9

```bash
git clone https://github.com/cakapbagus/laundry-barcode.git
cd laundry-barcode

chmod +x scripts/dev-setup.sh
./scripts/dev-setup.sh
```

Atau manual:

```bash
# Backend
cd backend
npm install
npx prisma generate
npx prisma db push
npx tsx prisma/seed.ts
npm run dev          # http://localhost:3001

# Frontend (terminal baru)
cd frontend
npm install
npm run dev          # http://localhost:5173
```

---

## Environment Variables

Buat file `.env` di folder `backend/` (lihat `.env.example`):

```env
# JWT secret — gunakan string acak panjang (min 32 karakter) di production
# Generate: node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"
JWT_SECRET=ganti-dengan-string-acak-panjang-minimal-32-karakter

# Port server backend
PORT=3001

# Database URL (SQLite):
DATABASE_URL=file:./dev.db (Development)

# CORS — domain frontend yang diizinkan, pisahkan dengan koma
# Development:
ALLOWED_ORIGINS=http://localhost:5173,http://127.0.0.1:5173
# Production:
# ALLOWED_ORIGINS=https://laundry.yourdomain.com
```

---

## API Endpoints

### Public (tanpa auth)
| Method | Endpoint | Deskripsi |
|--------|----------|-----------|
| `GET` | `/api/public/track/:orderCode` | Tracking publik untuk santri |
| `GET` | `/api/health` | Health check |

### Auth
| Method | Endpoint | Deskripsi |
|--------|----------|-----------|
| `POST` | `/api/auth/login` | Login, return JWT (24 jam) — rate limited: 10 req/IP/15 menit |

### Orders (KASIR / MANAGER)
| Method | Endpoint | Deskripsi |
|--------|----------|-----------|
| `POST` | `/api/orders` | Buat order baru |
| `GET` | `/api/orders` | List order dengan filter & pagination |
| `GET` | `/api/orders/:id` | Detail order + riwayat tahap |
| `PATCH` | `/api/orders/:id/complete` | Tandai PICKED_UP |

### Scans (OPERATOR / MANAGER)
| Method | Endpoint | Deskripsi |
|--------|----------|-----------|
| `POST` | `/api/scans/stage-transition` | Transisi tahap via scan QR |
| `POST` | `/api/scans/integrity-check` | Verifikasi QR + cek duplikasi |

### Dashboard (MANAGER)
| Method | Endpoint | Deskripsi |
|--------|----------|-----------|
| `GET` | `/api/dashboard/summary` | KPI bulan (total order, berat, pendapatan, avg cycle) |
| `GET` | `/api/dashboard/orders-by-status` | Data kanban (active carry-over + completed bulan ini) |
| `GET` | `/api/dashboard/reports/daily` | Laporan bulanan untuk export CSV |

### Settings & Master Data (MANAGER)
| Method | Endpoint | Deskripsi |
|--------|----------|-----------|
| `GET/PUT` | `/api/settings/:key` | COST_PER_KG, COMPLETION_DAYS, STUCK_HOURS |
| `GET/POST/PUT/DELETE` | `/api/machines` | Kelola daftar mesin (WASH/DRY/IRON) |
| `GET/POST/PUT/DELETE` | `/api/users` | Kelola akun staf |
| `GET/POST` | `/api/customer` | Data santri (autocomplete intake) |

---

## WebSocket Events

Frontend subscribe ke socket.io untuk update real-time:

| Event | Trigger |
|-------|---------|
| `order:created` | Order baru dibuat kasir |
| `order:stage_updated` | Operator scan → pindah tahap |
| `order:completed` | Order status PICKED_UP |
| `dashboard:refresh` | Trigger fetch ulang KPI & kanban |

---

## PWA — Mobile & Desktop

### Android
- Install via "Tambahkan ke layar utama" di Chrome
- Adaptive icon (maskable) support
- Standalone mode (tanpa browser chrome)

### iPhone / iPad
- Install via Safari → Share → "Tambahkan ke Layar Utama"
- Apple touch icon 180×180 px
- Splash screen untuk 17 ukuran device (iPhone SE s/d iPhone 16 Pro Max, iPad mini s/d iPad Pro 12.9")
- `viewport-fit=cover` + `env(safe-area-inset-bottom)` untuk notch & home indicator

### Desktop (Chrome/Edge)
- Install via ikon install di address bar
- Standalone window, shortcuts ke Lacak & Scanner

### Offline Support
- App shell (HTML/CSS/JS) sepenuhnya di-cache via Workbox
- Public tracking (`/api/public/*`) cached NetworkFirst (1 jam)
- Static assets cached CacheFirst (7 hari)
- Navigasi offline fallback ke `index.html` (SPA routing tetap berfungsi)

---

## Mobile Layout

Dirancang mobile-first dengan Tailwind CSS:

- **Bottom tab bar** — `fixed bottom-0` dengan `env(safe-area-inset-bottom)` untuk iPhone
- **`pb-nav`** — padding bawah konten: `max(96px, 56px + safe-area-inset-bottom)`
- **`fab-above-nav`** — posisi FAB: `56px + safe-area-inset-bottom + 8px` dari bawah
- **`mobile-landscape:`** — breakpoint khusus landscape `(max-width:1023px) and (orientation:landscape)`
- Pull-to-refresh di halaman Daftar Order (mobile)
- Kanban portrait: swimlane vertikal collapsible; landscape/desktop: kolom horizontal

---

## License

[MIT](LICENSE) © 2026 cakapbagus
