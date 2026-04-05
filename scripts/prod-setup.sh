#!/usr/bin/env bash
# =============================================================================
# prod-setup.sh — Deploy ke VPS Ubuntu (production)
# Laundry Pesantren - Barcode Tracking System
#
# Prasyarat:
#   - Ubuntu 22.04 / 24.04 LTS
#   - Jalankan sebagai root atau dengan sudo
#   - Domain sudah diarahkan ke IP VPS (untuk SSL)
#
# Usage:
#   sudo bash scripts/prod-setup.sh
#
# Env vars opsional (set sebelum jalankan):
#   APP_DOMAIN=laundry.example.com   (default: gunakan IP server)
#   APP_DIR=/opt/laundry-barcode     (default: /opt/laundry-barcode)
#   JWT_SECRET=xxx                   (default: auto-generate)
# =============================================================================

set -e

# --- Konfigurasi ---
APP_DIR="${APP_DIR:-/opt/laundry-barcode}"
APP_DOMAIN="${APP_DOMAIN:-}"
APP_USER="${SUDO_USER:-$(logname 2>/dev/null || whoami)}"
REPO_URL="${REPO_URL:-https://github.com/cakapbagus/laundry-barcode}"
BACKEND_PORT=3001
NODE_VERSION="22"

GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
CYAN='\033[0;36m'
NC='\033[0m'

log()     { echo -e "${GREEN}[+]${NC} $1"; }
warn()    { echo -e "${YELLOW}[!]${NC} $1"; }
err()     { echo -e "${RED}[x]${NC} $1"; exit 1; }
section() { echo -e "\n${CYAN}===== $1 =====${NC}"; }

# --- Cek root ---
if [ "$EUID" -ne 0 ]; then
  err "Jalankan script ini sebagai root: sudo bash scripts/prod-setup.sh"
fi

echo ""
echo "================================================"
echo "  Laundry Pesantren — Production Setup"
echo "  Target: $APP_DIR"
echo "================================================"
echo ""

# --- Tanya domain jika belum diset via env ---
if [ -z "$APP_DOMAIN" ]; then
  read -rp "Domain (kosongkan untuk pakai IP server): " APP_DOMAIN </dev/tty
fi

# --- Tanya nama manager ---
read -rp "Nama login Manager (Enter untuk pakai 'Admin'): " MANAGER_NAME </dev/tty
if [ -z "$MANAGER_NAME" ]; then
  MANAGER_NAME="Admin"
  MANAGER_PASSWORD="admin123"
else
  MANAGER_PASSWORD=$(openssl rand -base64 18 | tr -dc 'A-Za-z0-9' | head -c 12)
fi

# =============================================================================
section "1. Update sistem & install dependensi"
# =============================================================================
apt-get update -qq
apt-get install -y -qq curl git nginx ufw openssl

# --- Install Node.js via NodeSource ---
if ! command -v node &>/dev/null || [ "$(node -e 'process.stdout.write(process.version.slice(1).split(".")[0])')" -lt "$NODE_VERSION" ]; then
  log "Install Node.js $NODE_VERSION..."
  curl -fsSL https://deb.nodesource.com/setup_${NODE_VERSION}.x | bash -
  apt-get install -y nodejs
fi
log "Node.js $(node -v)"

# --- Install PM2 ---
if ! command -v pm2 &>/dev/null; then
  log "Install PM2..."
  npm install -g pm2 --quiet
fi
log "PM2 $(pm2 -v)"

log "Menjalankan sebagai user: $APP_USER"

# =============================================================================
section "2. Salin source code"
# =============================================================================

# Deteksi apakah script dijalankan dari dalam clone repo
if [ -n "${BASH_SOURCE[0]:-}" ] && [ -f "${BASH_SOURCE[0]}" ]; then
  CANDIDATE_SRC="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
else
  CANDIDATE_SRC=""
fi

if [ -f "$CANDIDATE_SRC/backend/package.json" ]; then
  SRC_DIR="$CANDIDATE_SRC"
  log "Source ditemukan di $SRC_DIR"
else
  # curl | bash  ATAU  script standalone di folder acak → clone repo
  TMP_SRC=$(mktemp -d)
  log "Clone repository dari $REPO_URL ke $TMP_SRC..."
  git clone --depth=1 "$REPO_URL" "$TMP_SRC"
  SRC_DIR="$TMP_SRC"
fi

if [ "$SRC_DIR" != "$APP_DIR" ]; then
  log "Salin source ke $APP_DIR..."
  rsync -a --exclude='.git' --exclude='node_modules' --exclude='*.db' \
    "$SRC_DIR/" "$APP_DIR/"
fi

chown -R "$APP_USER:$APP_USER" "$APP_DIR"

# Bersihkan clone sementara jika ada
if [[ "$SRC_DIR" == /tmp/* ]]; then
  rm -rf "$SRC_DIR"
fi

# =============================================================================
section "3. Setup backend"
# =============================================================================
# Pastikan cache npm bisa ditulis oleh APP_USER
export NPM_CONFIG_CACHE="/tmp/.npm-laundry"
mkdir -p "$NPM_CONFIG_CACHE"
chown "$APP_USER:$APP_USER" "$NPM_CONFIG_CACHE"

cd "$APP_DIR/backend"

# Buat .env production
if [ ! -f .env ]; then
  GENERATED_SECRET=$(openssl rand -hex 64)
  SERVER_IP=$(hostname -I | awk '{print $1}')

  # Susun ALLOWED_ORIGINS: selalu sertakan IP server, tambah domain jika ada
  if [ -n "$APP_DOMAIN" ]; then
    ORIGINS="https://$APP_DOMAIN,http://$SERVER_IP"
  else
    ORIGINS="http://$SERVER_IP"
  fi

  if [ -n "$APP_DOMAIN" ]; then
    FRONTEND_URL_VAL="https://$APP_DOMAIN"
  else
    FRONTEND_URL_VAL="http://$SERVER_IP"
  fi

  cat > .env <<EOF
NODE_ENV=production
PORT=$BACKEND_PORT
JWT_SECRET=${JWT_SECRET:-$GENERATED_SECRET}
DATABASE_URL=file:$APP_DIR/backend/prisma/prod.db
FRONTEND_URL=$FRONTEND_URL_VAL
ALLOWED_ORIGINS=$ORIGINS
EOF
  log ".env production dibuat (JWT_SECRET di-generate otomatis)"
  log "ALLOWED_ORIGINS=$ORIGINS"
else
  warn ".env sudah ada, dilewati"
fi

sudo -u "$APP_USER" -E npm install
sudo -u "$APP_USER" -E npx prisma generate
sudo -u "$APP_USER" -E npx prisma db push
log "Database production siap"

# Seed hanya jika DB kosong
USER_COUNT=$(sudo -u "$APP_USER" -E node -e "
const { PrismaClient } = require('@prisma/client');
const p = new PrismaClient();
p.user.count().then(n => { process.stdout.write(String(n)); p.\$disconnect(); });
" 2>/dev/null || echo "0")

if [ "$USER_COUNT" = "0" ]; then
  SEED_MANAGER_NAME="$MANAGER_NAME" SEED_MANAGER_PASSWORD="$MANAGER_PASSWORD" \
    sudo -u "$APP_USER" -E npx tsx prisma/seed.ts -y
  log "Data seed ditambahkan"
else
  warn "Database sudah berisi data, seed dilewati"
fi

# Build backend (compile TypeScript)
sudo -u "$APP_USER" -E npm run build
sudo -u "$APP_USER" -E npm prune --omit=dev
log "Backend di-build"

# =============================================================================
section "4. Setup frontend"
# =============================================================================
cd "$APP_DIR/frontend"

sudo -u "$APP_USER" -E npm install
sudo -u "$APP_USER" -E npm run build
sudo -u "$APP_USER" -E npm prune --omit=dev
# Pastikan Nginx (www-data) bisa baca file statis
chmod -R 755 "$APP_DIR/frontend/dist"
chmod o+x "$APP_DIR" "$APP_DIR/frontend"
log "Frontend di-build → dist/"

# =============================================================================
section "5. Konfigurasi PM2"
# =============================================================================
cat > "$APP_DIR/ecosystem.config.js" <<EOF
module.exports = {
  apps: [
    {
      name: 'laundry-backend',
      script: '$APP_DIR/backend/dist/server.js',
      cwd: '$APP_DIR/backend',
      env: {
        NODE_ENV: 'production',
      },
      max_memory_restart: '256M',
      restart_delay: 3000,
      log_file: '/var/log/laundry/combined.log',
      error_file: '/var/log/laundry/error.log',
      out_file: '/var/log/laundry/out.log',
    },
  ],
};
EOF

mkdir -p /var/log/laundry
chown "$APP_USER:$APP_USER" /var/log/laundry

sudo -u "$APP_USER" pm2 start "$APP_DIR/ecosystem.config.js"
sudo -u "$APP_USER" pm2 save

# Daftarkan PM2 agar auto-start saat reboot
env PATH="$PATH:/usr/local/bin" \
  pm2 startup systemd -u "$APP_USER" --hp "/home/$APP_USER" | tail -1 | bash
log "PM2 dikonfigurasi (auto-start saat boot)"

# =============================================================================
section "6. Konfigurasi Nginx"
# =============================================================================
SERVER_NAME="${APP_DOMAIN:-_}"

cat > /etc/nginx/sites-available/laundry <<EOF
server {
    listen 80;
    server_name $SERVER_NAME;

    # Gzip compression
    gzip on;
    gzip_types text/plain text/css application/json application/javascript text/xml application/xml application/xml+rss text/javascript;

    # Serve frontend (PWA)
    root $APP_DIR/frontend/dist;
    index index.html;

    # API proxy ke backend
    location /api/ {
        proxy_pass http://127.0.0.1:$BACKEND_PORT;
        proxy_http_version 1.1;
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
    }

    # WebSocket proxy (socket.io)
    location /socket.io/ {
        proxy_pass http://127.0.0.1:$BACKEND_PORT;
        proxy_http_version 1.1;
        proxy_set_header Upgrade \$http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_cache_bypass \$http_upgrade;
    }

    # SPA fallback — semua route diarahkan ke index.html
    location / {
        try_files \$uri \$uri/ /index.html;
    }

    # Cache assets statis
    location ~* \.(js|css|png|jpg|svg|ico|woff2?)$ {
        expires 7d;
        add_header Cache-Control "public, immutable";
    }

    # Service worker tidak di-cache
    location = /sw.js {
        add_header Cache-Control "no-cache";
    }
}
EOF

ln -sf /etc/nginx/sites-available/laundry /etc/nginx/sites-enabled/laundry
rm -f /etc/nginx/sites-enabled/default

nginx -t && systemctl reload nginx
log "Nginx dikonfigurasi"

# =============================================================================
section "7. Firewall (UFW)"
# =============================================================================
ufw allow OpenSSH
ufw allow 'Nginx Full'
ufw --force enable
log "UFW aktif (SSH + HTTP/HTTPS dibuka)"

# =============================================================================
section "8. SSL dengan Certbot"
# =============================================================================
if [ -n "$APP_DOMAIN" ]; then
  log "Instalasi SSL untuk domain: $APP_DOMAIN"
  if ! command -v certbot &>/dev/null; then
    apt-get install -y -qq certbot python3-certbot-nginx
  fi
  certbot --nginx -d "$APP_DOMAIN" --non-interactive --agree-tos --register-unsafely-without-email
  log "SSL aktif — https://$APP_DOMAIN"
else
  warn "Domain tidak diisi — SSL dilewati, akses via HTTP ke IP server"
fi

# =============================================================================
section "Selesai!"
# =============================================================================

SERVER_IP=$(hostname -I | awk '{print $1}')
if [ -n "$APP_DOMAIN" ]; then
  ACCESS_URL="https://$APP_DOMAIN"
else
  ACCESS_URL="http://$SERVER_IP"
fi

echo ""
echo "================================================"
echo -e "  ${GREEN}Deployment berhasil!${NC}"
echo "================================================"
echo ""
echo "  Akses aplikasi : $ACCESS_URL"
echo "  Backend API    : $ACCESS_URL/api"
echo "  App directory  : $APP_DIR"
echo "  Logs           : /var/log/laundry/"
echo ""
echo "Perintah berguna:"
echo "  pm2 status                      — cek status proses"
echo "  pm2 logs laundry-backend        — lihat log"
echo "  pm2 restart laundry-backend     — restart backend"
echo "  sudo systemctl reload nginx     — reload nginx"
echo ""
echo "================================================"
echo -e "  ${YELLOW}Kredensial Login Manager${NC}"
echo "================================================"
echo ""
echo -e "  Nama   : ${GREEN}$MANAGER_NAME${NC}"
echo -e "  Password : ${GREEN}$MANAGER_PASSWORD${NC}"
echo ""
warn "Simpan kredensial ini! Password tidak bisa ditampilkan ulang."
echo ""
