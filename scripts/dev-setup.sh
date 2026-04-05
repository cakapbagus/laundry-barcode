#!/usr/bin/env bash
# =============================================================================
# dev-setup.sh — Setup environment development lokal
# Laundry Pesantren - Barcode Tracking System
# =============================================================================

set -e

GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

log()  { echo -e "${GREEN}[+]${NC} $1"; }
warn() { echo -e "${YELLOW}[!]${NC} $1"; }
err()  { echo -e "${RED}[x]${NC} $1"; exit 1; }

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(dirname "$SCRIPT_DIR")"

echo ""
echo "================================================"
echo "  Laundry Pesantren — Dev Setup"
echo "================================================"
echo ""

# --- Cek Node.js ---
if ! command -v node &>/dev/null; then
  err "Node.js tidak ditemukan. Install dari https://nodejs.org (>=20)"
fi

NODE_VERSION=$(node -e "process.stdout.write(process.version.slice(1).split('.')[0])")
if [ "$NODE_VERSION" -lt 20 ]; then
  err "Node.js versi $NODE_VERSION terlalu lama. Butuh >= 20."
fi
log "Node.js v$(node -v | sed 's/v//')"

# --- Backend ---
log "Setup backend..."
cd "$ROOT_DIR/backend"

npm install

# Buat .env jika belum ada
if [ ! -f .env ]; then
  warn ".env tidak ditemukan, membuat dari template..."
  cat > .env <<'EOF'
JWT_SECRET=dev-secret-ganti-di-production-dengan-string-acak-panjang
PORT=3001
DATABASE_URL=file:./dev.db
FRONTEND_URL=http://localhost:5173
ALLOWED_ORIGINS=http://localhost:5173,http://127.0.0.1:5173
EOF
  log ".env dibuat"
else
  warn ".env sudah ada, dilewati"
fi

npx prisma generate
log "Prisma client di-generate"

npx prisma db push
log "Database schema di-push"

# Seed hanya jika DB kosong
USER_COUNT=$(node -e "
const { PrismaClient } = require('@prisma/client');
const p = new PrismaClient();
p.user.count().then(n => { console.log(n); p.\$disconnect(); });
" 2>/dev/null || echo "0")

if [ "$USER_COUNT" -eq "0" ]; then
  npx tsx prisma/seed.ts
  log "Data seed berhasil ditambahkan"
else
  warn "Database sudah berisi data, seed dilewati"
fi

# --- Frontend ---
log "Setup frontend..."
cd "$ROOT_DIR/frontend"

npm install
log "Dependensi frontend terinstall"

# --- Selesai ---
echo ""
echo "================================================"
echo -e "  ${GREEN}Setup selesai!${NC}"
echo "================================================"
echo ""
echo "Jalankan aplikasi:"
echo ""
echo "  Terminal 1 (Backend):"
echo "    cd backend && npm run dev"
echo "    → http://localhost:3001"
echo ""
echo "  Terminal 2 (Frontend):"
echo "    cd frontend && npm run dev"
echo "    → http://localhost:5173"
echo ""
echo "Akun default (dari seed):"
echo "  manager (MANAGER) : manager / manager123"
echo ""
echo "Buat akun KASIR/OPERATOR via halaman /users setelah login."
echo ""
