#!/usr/bin/env bash
# =============================================================================
# update.sh — Update backend dan/atau frontend di VPS (tanpa setup ulang)
#
# Usage:
#   sudo bash scripts/update.sh
# =============================================================================

set -e

APP_DIR="${APP_DIR:-/opt/laundry-barcode}"
APP_USER="${SUDO_USER:-$(logname 2>/dev/null || whoami)}"

GREEN='\033[0;32m'
YELLOW='\033[1;33m'
CYAN='\033[0;36m'
NC='\033[0m'

log()     { echo -e "${GREEN}[+]${NC} $1"; }
warn()    { echo -e "${YELLOW}[!]${NC} $1"; }
section() { echo -e "\n${CYAN}===== $1 =====${NC}"; }

if [ "$EUID" -ne 0 ]; then
  echo "Jalankan sebagai root: sudo bash scripts/update.sh"
  exit 1
fi

echo ""
echo "Apa yang ingin di-update?"
echo "  1) Backend saja"
echo "  2) Frontend saja"
echo "  3) Keduanya"
echo ""
read -rp "Pilih [1/2/3]: " CHOICE </dev/tty

case "$CHOICE" in
  1) TARGET="backend" ;;
  2) TARGET="frontend" ;;
  *) TARGET="all" ;;
esac

# Pastikan cache npm bisa ditulis oleh APP_USER
export NPM_CONFIG_CACHE="/tmp/.npm-laundry"
mkdir -p "$NPM_CONFIG_CACHE"
chown "$APP_USER:$APP_USER" "$NPM_CONFIG_CACHE"

REPO_URL="${REPO_URL:-https://github.com/cakapbagus/laundry-barcode}"

# =============================================================================
section "Ambil latest code dari GitHub"
# =============================================================================
TMP_SRC=$(mktemp -d)
log "Clone repository ke $TMP_SRC..."
git clone --depth=1 "$REPO_URL" "$TMP_SRC"

rsync -a --exclude='.git' --exclude='node_modules' --exclude='*.db' --exclude='.env' \
  "$TMP_SRC/" "$APP_DIR/"

chown -R "$APP_USER:$APP_USER" "$APP_DIR"
log "Code diperbarui"

# =============================================================================
update_backend() {
  section "Update Backend"
  cd "$APP_DIR/backend"

  sudo -u "$APP_USER" -E npm install
  sudo -u "$APP_USER" -E npx prisma generate
  sudo -u "$APP_USER" -E npx prisma db push
  sudo -u "$APP_USER" -E npm run build
  sudo -u "$APP_USER" -E npm prune --omit=dev

  pm2 restart laundry-backend
  log "Backend di-update & restart"
}

update_frontend() {
  section "Update Frontend"
  cd "$APP_DIR/frontend"

  sudo -u "$APP_USER" -E npm install
  sudo -u "$APP_USER" -E npm run build
  sudo -u "$APP_USER" -E npm prune --omit=dev

  chmod -R 755 "$APP_DIR/frontend/dist"
  chmod o+x "$APP_DIR" "$APP_DIR/frontend"

  systemctl reload nginx
  log "Frontend di-update & nginx di-reload"
}
# =============================================================================

case "$TARGET" in
  backend)  update_backend ;;
  frontend) update_frontend ;;
  *)        update_backend; update_frontend ;;
esac

rm -rf "$TMP_SRC"


echo ""
echo "================================================"
echo -e "  ${GREEN}Update selesai!${NC}"
echo "================================================"
echo ""
