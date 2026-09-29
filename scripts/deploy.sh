#!/usr/bin/env bash
# Deploys the latest code on the production server (run as the "deploy" user).
# Called by GitHub Actions on every push to main, or by hand:  bash ~/bar-shop/scripts/deploy.sh [branch]
#
#   1. backs up the database (keeps the last 14 backups in ~/backups)
#   2. updates the code to origin/<branch>
#   3. installs, updates the database schema, and builds the API and the web app
#   4. reloads both PM2 processes and checks they answer
#
# Stops at the first error, so a broken build never replaces the running version.
set -euo pipefail

BRANCH="${1:-main}"
APP_DIR="$(cd "$(dirname "$0")/.." && pwd)"
cd "$APP_DIR"

export NVM_DIR="$HOME/.nvm"
# shellcheck disable=SC1091
. "$NVM_DIR/nvm.sh"
nvm use --silent 20 >/dev/null

step() { printf '\n\033[1m▶ %s\033[0m\n' "$1"; }

step "Backing up the database"
mkdir -p "$HOME/backups"
DB_URL="$(grep '^DATABASE_URL=' backend/.env | cut -d= -f2- | tr -d '"')"
pg_dump -Fc "${DB_URL%%\?*}" -f "$HOME/backups/bar_shop-$(date +%F-%H%M%S).dump"
ls -1t "$HOME"/backups/*.dump | tail -n +15 | xargs -r rm -f
echo "saved to ~/backups"

step "Updating code to origin/$BRANCH"
git fetch --prune origin
git checkout -q "$BRANCH"
git reset --hard "origin/$BRANCH"   # .env files and new uploads are untracked, so they are kept
git log -1 --format='%h %s (%an, %ar)'

step "Backend: install, database schema, build"
cd "$APP_DIR/backend"
npm ci --no-audit --no-fund
# Brings the database up to schema.prisma. Refuses changes that would lose data (the deploy stops).
npx prisma db push --skip-generate
npm run build

step "Frontend: install, build"
cd "$APP_DIR/pos"
npm ci --no-audit --no-fund
npm run build

step "Restarting services"
cd "$APP_DIR"
pm2 startOrReload ecosystem.config.cjs --update-env
pm2 save >/dev/null

step "Health check"
for attempt in $(seq 1 30); do
  if curl -fsS http://127.0.0.1:5010/health >/dev/null && curl -fsS -o /dev/null http://127.0.0.1:3001/signin; then
    echo "API and web app are up ✔"
    exit 0
  fi
  sleep 2
done
echo "Services did not come up in time — see: pm2 logs --lines 100" >&2
exit 1
