#!/usr/bin/env bash
# Perbarui server ke versi terbaru di GitHub lalu jalankan ulang layanan.
#   bash ~/apps/indonesia-fishing-watch/deploy/update.sh
# Server hanya menjalankan kode dari GitHub: perubahan lokal di server ditimpa. Data (data/, storage/)
# dan .env.local tidak tersentuh karena tidak dilacak git.
set -euo pipefail
cd "$HOME/apps/indonesia-fishing-watch"
. "$HOME/.nvm/nvm.sh"
git fetch origin
git reset --hard origin/main
npm ci
npm run build
systemctl --user restart ifw-web ifw-worker
systemctl --user --no-pager status ifw-web ifw-worker | grep -E "●|Active:"
