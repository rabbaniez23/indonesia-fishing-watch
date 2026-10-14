# Deploy ke laptop Linux Mint (gratis, online 24 jam)

Aplikasi ini butuh **tiga hal yang tidak cocok dengan hosting serverless (Vercel, dsb.)**:
server Next.js yang terus hidup, **worker** yang terus mengambil data dari Global Fishing Watch, dan **database SQLite
berupa file** yang harus tersimpan permanen. Laptop Linux sendiri memenuhi ketiganya. Agar bisa dibuka dari internet
tanpa membuka port router dan tanpa membeli domain, dipakai **Tailscale Funnel** (gratis, HTTPS otomatis,
alamat tetap `https://<nama-laptop>.<nama-tailnet>.ts.net`).

```
Internet ──HTTPS──▶ Tailscale Funnel ──▶ laptop: ifw-web (127.0.0.1:3000) ──▶ data/indonesia-fishing-watch.db
                                                  ifw-worker ──▶ API Global Fishing Watch
```

Semua perintah di bawah dijalankan **di laptop Linux lewat SSH** (`ssh user@ip-laptop`), kecuali yang ditandai
"di Windows".

## 1. Node.js 24 (lewat nvm) dan git

Aplikasi memakai `node:sqlite`, jadi **wajib Node 24**. Di `hp-server` Node v24.18.0 sudah terpasang lewat nvm
(`~/.nvm`); layanan systemd memuatnya sendiri lewat `~/.nvm/nvm.sh`. Untuk server baru:

```bash
sudo apt update && sudo apt install -y git curl sqlite3
curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.40.3/install.sh | bash
source ~/.bashrc && nvm install 24 && nvm alias default 24
node -v   # harus v24.x
```

## 2. Ambil kode dari GitHub

```bash
git clone https://github.com/rabbaniez23/indonesia-fishing-watch.git ~/apps/indonesia-fishing-watch
cd ~/apps/indonesia-fishing-watch
npm ci
```

## 3. Salin token & database dari Windows

Hentikan dulu `npm run dev` dan `npm run worker` di Windows (Ctrl+C) agar file database tidak sedang ditulis.
Lalu **di Windows (PowerShell)**, dari folder proyek:

```powershell
scp .env.local user@ip-laptop:~/apps/indonesia-fishing-watch/
ssh user@ip-laptop "mkdir -p ~/apps/indonesia-fishing-watch/data"
scp data\indonesia-fishing-watch.db user@ip-laptop:~/apps/indonesia-fishing-watch/data/
```

Database berisi akun admin, 12 wilayah (ZEE + 11 WPP), dan data yang sudah diambil — jadi tidak perlu impor ulang.
Token GFW dikirim sebagai file lewat SSH (terenkripsi), **jangan pernah di-commit ke GitHub**.

## 4. Aktifkan Tailscale Funnel (alamat publik HTTPS)

```bash
curl -fsSL https://tailscale.com/install.sh | sh
sudo tailscale up            # buka tautan yang muncul, login (Google/GitHub/Microsoft)
sudo tailscale funnel --bg 3000
```

Bila diminta, buka tautan yang muncul untuk mengizinkan Funnel. Perintah terakhir mencetak alamat publik, misalnya
`https://laptop-mint.tail1234.ts.net`. Cek lagi kapan saja dengan `tailscale funnel status`.

Tambahkan alamat itu ke `.env.local` (dipakai untuk tautan undangan & pemeriksaan keamanan form):

```bash
nano ~/apps/indonesia-fishing-watch/.env.local
# tambahkan baris:  APP_BASE_URL=https://laptop-mint.tail1234.ts.net
```

## 5. Build

```bash
cd ~/apps/indonesia-fishing-watch
npm run build
```

`APP_BASE_URL` dibaca saat build, jadi build **setelah** langkah 4. Laptop lama dengan RAM 4 GB cukup; build ±2–5 menit.

## 6. Jalankan otomatis (systemd)

```bash
mkdir -p ~/.config/systemd/user
cp deploy/ifw-web.service deploy/ifw-worker.service ~/.config/systemd/user/
systemctl --user daemon-reload
systemctl --user enable --now ifw-web ifw-worker
sudo loginctl enable-linger "$USER"   # tetap jalan walau SSH ditutup & setelah laptop restart
```

Cek: `systemctl --user status ifw-web ifw-worker` (keduanya harus `active (running)`), lalu buka alamat Funnel di HP.

## 7. Jangan biarkan laptop tidur

```bash
sudo sed -i 's/^#\?HandleLidSwitch=.*/HandleLidSwitch=ignore/' /etc/systemd/logind.conf
sudo sed -i 's/^#\?HandleLidSwitchExternalPower=.*/HandleLidSwitchExternalPower=ignore/' /etc/systemd/logind.conf
sudo systemctl mask sleep.target suspend.target hibernate.target hybrid-sleep.target
sudo systemctl restart systemd-logind
```

Laptop sekarang tetap menyala walau layar ditutup. Biarkan charger terpasang.

## Perawatan

| Tugas | Perintah |
|---|---|
| Perbarui ke versi terbaru di GitHub | `bash ~/apps/indonesia-fishing-watch/deploy/update.sh` |
| Lihat log web / worker | `journalctl --user -u ifw-web -f` / `journalctl --user -u ifw-worker -f` |
| Restart | `systemctl --user restart ifw-web ifw-worker` |
| Cadangkan database | `sqlite3 ~/apps/indonesia-fishing-watch/data/indonesia-fishing-watch.db ".backup '$HOME/ifw-backup-$(date +%F).db'"` |
| Undang pengguna baru | `cd ~/apps/indonesia-fishing-watch && npm run invite -- email@contoh.id analyst` |

Setelah deploy, **jalankan aplikasi hanya di satu tempat** (laptop server). Bila Windows dan laptop sama-sama
menjalankan worker, keduanya memakai kuota GFW yang sama dan database-nya berbeda.

## Alternatif

- **Cloudflare Tunnel cepat** (uji coba): `cloudflared tunnel --url http://localhost:3000` memberi alamat
  `*.trycloudflare.com` gratis, tetapi **berganti setiap restart**. Alamat tetap lewat Cloudflare butuh domain sendiri.
- **Oracle Cloud Always Free** (VM gratis permanen) bisa memakai langkah yang sama, tetapi pendaftaran butuh kartu kredit.
- **Render/Railway/Vercel paket gratis tidak cocok**: tidak ada worker permanen dan/atau file database hilang saat restart.
