# Indonesia Fishing Watch — pilot pemantauan maritim Indonesia

Implementasi dari `../PRD_Pemantauan_Maritim_Indonesia.md` dan `../Design_System_Pemantauan_Maritim_Indonesia.md`.
Nama aplikasi **Indonesia Fishing Watch** (sejak 14 Okt 2026; sebelumnya nama kerja "Pantau Laut"). Data aktivitas berasal
dari Global Fishing Watch; aplikasi ini tidak berafiliasi dengan Global Fishing Watch.

**Deploy online gratis (laptop Linux + Tailscale Funnel):** lihat [deploy/README.md](deploy/README.md).

## Status tahapan

| Tahap | Isi | Status |
| --- | --- | --- |
| 0 | Fondasi UI, design tokens, shell, komponen dasar | Selesai |
| 1 | Database SQLite (`node:sqlite`), login berbasis undangan, peran | Selesai |
| 2 | Adapter GFW, contract check, wilayah ZEE Indonesia, Sumber & status data | Selesai |
| 3 | Worker & antrean job (lease, lock report GFW, pemulihan last-report, snapshot + provenance) | Selesai |
| 4 | Ringkasan: filter, 4 KPI + pembanding, tren harian + tabel, sel hotspot | Selesai |
| 5 | Peta: grid apparent fishing / keberadaan / radar, legenda kuantil, detail sel, mobile | Selesai |
| 6 | Kapal: pencarian nama/MMSI/IMO, profil (identitas, aktivitas, kunjungan pelabuhan) | Selesai |
| 7 | Pelabuhan: agregasi kunjungan teramati per pelabuhan GFW (worker), detail per pelabuhan | Selesai |
| 8 | Temuan: simpan dari sel/kapal/kejadian, status peninjauan, catatan append-only, version guard, peran | Selesai |
| 9 | Laporan: ekspor CSV (ZIP data + metadata) via worker, unduhan terlindungi, tampilan cetak | Selesai |
| 10 | Analisis (tren, perbandingan dua periode, hotspot) & Pengaturan Admin; revisi 14 Okt: statistik lengkap (armada, antar-WPP, kejadian) | Selesai |
| — | Ramah pemula, glassmorphism (latar putih), WPP-NRI dari Shapefile | Selesai |
| 11 | QA akhir | Belum |

Halaman yang belum lolos gerbangnya menampilkan state "Belum tersambung ke sumber data" beserta alasannya.
Halaman tidak diisi data rekaan.

## Menjalankan

```bash
npm install
cp .env.example .env.local   # isi ADMIN_EMAIL, ADMIN_NAME, ADMIN_PASSWORD
npm run seed:admin           # membuat Admin pertama (idempoten)
npm run dev                  # http://localhost:3000 → login
npm test                     # unit test (Vitest)
npm run lint
npm run build
```

Pengguna lain diundang lewat **Pengaturan → Undang pengguna** (Admin), atau dari CLI:
`npm run invite -- nama@contoh.id analyst`. Tautan undangan berlaku 7 hari dan hanya ditampilkan sekali.

## Autentikasi & peran (PRD §4, FR-01)

- Tidak ada signup publik. Akun hanya dibuat dari undangan; Admin pertama dari `npm run seed:admin`.
- Sesi: token acak di cookie `ifw_session` (httpOnly, SameSite=Lax, Secure di produksi). Database hanya menyimpan
  hash SHA-256 token, sehingga sesi bisa dicabut dan perubahan peran langsung berlaku. Masa berlaku 7 hari.
- Kata sandi: scrypt bawaan Node, minimal 12 karakter. Akun dikunci 15 menit setelah 5 kegagalan login beruntun.
- Pemeriksaan berlapis: `src/proxy.ts` hanya redirect optimistis; sesi & peran diverifikasi lagi di server pada
  layout aplikasi, setiap halaman/Server Action, dan setiap Route Handler (`src/lib/api/guard.ts`).
- Mutation API menolak request tanpa header `Origin` atau dari origin lain (CSRF).
- Peran: Viewer (baca) ⊂ Analyst (+ temuan) ⊂ Admin (+ pengguna & dataset). Matriks izin di `src/lib/auth/roles.ts`.

## Integrasi Global Fishing Watch (Tahap 2)

Token hanya dibaca server dari `GFW_API_ACCESS_TOKEN` di `.env.local` (tanpa prefix `NEXT_PUBLIC_`).

```bash
npm run contract-check   # ±10 request nyata; simpan fixture ke fixtures/gfw/ & status ke tabel datasets
npm run regions:import   # impor poligon ZEE Indonesia (fixtures/gfw/region-eez-8492.geojson) ke tabel regions
```

Fakta kontrak yang terbukti lewat respons nyata (13 Okt 2026), dan dipakai sebagai dasar schema `src/lib/gfw/schemas.ts`:

| Hal | Hasil nyata | Catatan terhadap dokumentasi |
| --- | --- | --- |
| ZEE Indonesia | `public-eez-areas` id **8492** (satu-satunya iso3=IDN dari 286 wilayah) | Dokumentasi tidak memberi contoh Indonesia |
| Events | `POST /v3/events?offset&limit`, body `{datasets, startDate, endDate, region:{dataset,id}}` | Dokumentasi menulis `/api/v3/events`; yang berhasil `/v3/events` |
| Versi Events | `metadata.datasets` (mis. `...:v4.0`); tidak ada header `x-datasets` | Port visits: dokumentasi menyebut v3.1, respons menyatakan v4.0 |
| Geometri wilayah | Events mengirim poligon lengkap di `metadata.geometry` (MRGID_EEZ 8492) | Tidak didokumentasikan; dipakai sebagai sumber geometri berlabel |
| Report 4Wings | `GET /v3/4wings/report` + `region-dataset`/`region-id`, `format=JSON` → **JSON langsung** | Dokumentasi menyebut hasil zip; pembaca zip tetap disiapkan |
| Isi report | `entries[0]["<dataset:versi>"] = [{date, flag, lat, lon, hours/detections, vesselIDs}]` | `vesselIDs` = jumlah per baris, **tidak boleh dijumlah** menjadi kapal unik |
| Metadata report | `{}` (tidak ada info ketersediaan) | Kelengkapan ditandai "belum diketahui" |
| Grid | Resolusi `LOW` = sel 0,1°; titik tengah vs sudut sel belum dipastikan | Diverifikasi di Tahap 5 |
| Bendera | Ada baris `flag` kosong/null (banyak di SAR) | Dipertahankan sebagai kelompok "tidak diketahui" |
| Events overlap | Kejadian bisa dimulai jauh sebelum periode (port visit sejak 2012) | UI menampilkan interval asli; durasi dihitung dari start–end |
| Vessels | Profil `GET /v3/vessels/{id}?dataset=`; search `GET /v3/vessels/search?query&datasets[0]&limit` | Registry kosong pada kapal sampel; field registry belum teruji data nyata |

Field `potentialRisk`/status otorisasi dari GFW sengaja tidak ditampilkan (PRD: tidak ada label risiko tanpa metode).

## Worker & antrean (Tahap 3)

Jalankan worker di terminal terpisah, berdampingan dengan `npm run dev`:

```bash
npm run worker      # Ctrl+C: selesaikan job berjalan lalu berhenti
```

- Web **tidak pernah** memanggil report GFW langsung. `POST /api/analysis/jobs` mengembalikan hasil fresh (≤ 6 jam)
  atau mengantre job (dedup per parameter); worker memprosesnya satu per satu.
- Jenis report: `daily` (tren harian, agregasi spasial), `cells` (grid 0,1°), `vessels` (per GFW vessel ID → jumlah unik).
- Lock `gfw-report` di database memastikan hanya satu report GFW berjalan per akun (dokumentasi: 429 bila bersamaan).
- Bila worker mati/timeout (524) setelah report dimulai, job diklaim ulang dan hasilnya diambil lewat
  `GET /v3/4wings/last-report` (disimpan GFW 30 menit) — **tanpa membuat report baru**. Karena last-report tidak memuat
  penanda report, hasilnya diverifikasi (dataset, bentuk baris, periode) sebelum dipakai.
- Retry terbatas (maks. 4 percobaan, backoff); 401/403/422/kontrak tidak cocok tidak di-retry.
- Setiap hasil disimpan immutable (`report_results`) dengan provenance (`source_fetches`): versi dataset dilayani,
  waktu ambil, periode, observasi terakhir dalam hasil, kelengkapan (`unknown` karena provider tidak memberi metadata),
  jumlah baris/ditolak, dan peringatan.

Teruji 13 Okt 2026 dengan GFW nyata: worker dimatikan paksa 2 detik setelah report dimulai → worker baru melanjutkan
lewat last-report, job selesai sekali; request upstream bertambah 1 (last-report), bukan report kedua.

## Ringkasan (Tahap 4)

- Filter wilayah & periode (hari UTC, inklusif di UI; maks. 90 hari; default 30 hari berakhir 5 hari sebelum hari ini).
  Draft terpisah dari filter aktif, baru dijalankan setelah **Terapkan**; filter tersimpan di URL (`region`, `from`, `to`).
- 4 KPI: jam apparent fishing, jam keberadaan AIS, deteksi radar, ID kapal unik (distinct GFW vessel ID dari report
  per kapal). Perbandingan dengan periode sebelumnya yang sama panjang; previous = 0 → "tidak dapat dihitung".
- Setiap KPI/bagian punya "Sumber & waktu" (versi dataset, waktu ambil, observasi terakhir, kelengkapan, peringatan).
- Tren harian satu metrik per grafik (tanpa dual axis), periode pembanding garis putus-putus, hari tanpa baris = celah,
  tooltip lewat hover/keyboard, dan "Lihat tabel" dari snapshot yang sama.
- Grafik dibuat dengan SVG sendiri (`src/components/charts/TrendChart.tsx`) sebagai "library setara" Recharts (PRD §11.1)
  agar aturan null-gap, dash pembanding, dan aksesibilitas terkendali tanpa dependensi tambahan.
- Warna garis pembanding grafik memakai `#929292`, bukan `#52645A` dari DS: validator palet menunjukkan `#52645A`
  terlalu mirip warna metrik (ΔE normal 6,8–14,3 < 15). `#929292` lolos untuk ketiga metrik.
- Render halaman tidak mengantre job; komponen klien mengantre bagian yang belum fresh lewat API lalu me-refresh saat
  worker selesai. Bagian yang gagal tidak diantre ulang otomatis (tombol "Coba lagi").

Teruji 13 Okt 2026 dengan data nyata (19/19 e2e): KPI apparent fishing 30 hari = jumlah tabel tren (70.422,9 jam);
periode 7 hari = 14.430,4 jam, sama dengan report Tahap 2–3.

## Peta (Tahap 5)

- Renderer MapLibre GL JS 6.14 (client-only). Worker MapLibre disalin ke `public/vendor/` oleh
  `scripts/copy-maplibre-worker.mjs` (otomatis lewat `predev`/`prebuild`) lalu dimuat dengan `setWorkerUrl`.
- Basemap OpenFreeMap Positron (`https://tiles.openfreemap.org/styles/positron`): gratis, tanpa API key, boleh komersial,
  **tanpa SLA**. Atribusi "© OpenMapTiles · Data from OpenStreetMap" ditampilkan MapLibre. Warna laut/darat diubah saat
  runtime ke target DS §8.1 (laut `#EEF4F1`, darat `#E0E9E1`).
- Layer aktivitas berasal dari **report GFW untuk wilayah tervalidasi** (bukan tile global), sesuai GATE peta PRD §11.4.
- Sel 0,1°: koordinat GFW adalah **titik tengah sel** — dibuktikan empiris dengan dua report poligon kustom
  (`scripts/probe-grid-alignment.ts`, fixture 14–15); dokumentasi GFW tidak menjelaskannya.
- Warna: ramp 5 kelas per layer dibangun di OKLCH dan lolos validator palet ordinal terhadap warna laut (`src/lib/map/layers.ts`).
  Ramp fishing DS tidak dipakai di peta karena kelas terangnya hanya 1,10:1 terhadap permukaan (sel kecil tidak terlihat).
- Legenda: skala kuantil dari snapshot yang ditampilkan (kelas duplikat digabung, maks. 6), satuan, periode, catatan sel.
- Klik/tabel sel → panel detail: nilai, peringkat, batas sel, rincian per bendera, provenance. Daftar kapal per sel belum
  ditampilkan (Interaction API belum diuji). Sel terpilih tersimpan di URL (`?cell=lat,lon`).
- Responsif: panel layer 280px + detail 360px; bila area peta < 600px hanya satu panel; mobile memakai sheet layar penuh,
  detail bottom sheet, dan legenda terlipat.
- **Gaya peta gelap (bawaan, revisi 14 Okt 2026):** basemap OpenFreeMap `dark` (laut `#121416`, darat `#2A2C2E`); tiap sel
  digambar sebagai **titik bercahaya** di titik tengahnya (makin ramai makin terang & sedikit lebih besar), kotak transparan
  tetap menjadi area klik/hover. Ramp `rampDark` lolos validator ordinal terhadap laut gelap. Legenda menegaskan satu titik =
  satu kotak ±11 × 11 km, **bukan satu kapal**. Tidak ada panah arah/heading (data report tidak memuat arah gerak).
  Tombol "Peta terang" kembali ke kotak di basemap Positron (`?gaya=terang`); posisi kamera dipertahankan saat berganti.

Teruji 13 Okt 2026 (21/22 e2e; satu kegagalan adalah selector tes setelah legenda dibuat bisa dilipat).

## Kapal (Tahap 6)

- `/vessels?q=` — pencarian GFW (nama, MMSI, IMO; min. 3 karakter), 20 kandidat per halaman, halaman berikut lewat token
  `since`. Kandidat berbeda tidak digabung walau namanya sama.
- `/vessels/[id]` — profil: identitas AIS utama + identitas AIS lain dalam entri (masing-masing dengan periode), jenis kapal &
  alat tangkap GFW, registry; tab Aktivitas (fishing/encounter/loitering) dan Kunjungan pelabuhan, dibatasi wilayah
  tervalidasi dan periode (maks. 90 hari). Kejadian yang dimulai sebelum / berlanjut setelah periode diberi label.
- API: `GET /api/vessels/search`, `GET /api/vessels/:id`, `GET /api/vessels/:id/events?kind=&from=&to=&offset=`.

Terbukti lewat contract check (fixture 16–21):
- Filter body `vessels: [id]` pada Events bekerja; pagination `nextOffset` tanpa duplikat dan **`null` di halaman terakhir**.
- Pencarian nama mengembalikan token `since` untuk halaman berikut (tanpa duplikat).
- Registry: kapal dengan `registryInfoTotalRecords: 1` tetap mengembalikan `registryInfo: []` walau
  `registries-info-data=ALL` → UI menyatakan "tercatat N record, detail tidak dikembalikan untuk akses ini".

Teruji 13 Okt 2026 (17/17 e2e): TB NAILA — 27 kejadian fishing (25 + 2 lewat "Muat berikutnya", tanpa duplikat),
kunjungan pelabuhan Tuban/Banjarmasin/Kumai.

## Pelabuhan (Tahap 7)

- `/ports` — referensi pelabuhan dari kunjungan teramati (bukan inventaris pelabuhan nasional). Satu baris per ID pelabuhan GFW
  (`startAnchorage.id`, mis. `idn-tarakan`): kunjungan, ID kapal unik, durasi median, confidence, negara menurut GFW.
- Hanya kunjungan yang **dimulai** dalam periode (`timeFilterMode: START-DATE`), rentang maks. **31 hari** karena volume
  (±54 ribu kunjungan / 30 hari di ZEE Indonesia). Agregasi dikerjakan worker (job `gfw_port_visits`, 1.000 event per request)
  lalu dicek terhadap `POST /v3/events/stats` dari query identik → "Lengkap terhadap statistik GFW" bila jumlahnya sama.
- KPI hanya ditampilkan bila hasil lengkap (DS §10.5). Tidak ada peta pin/koordinat pelabuhan (tidak dibuat dari rata-rata posisi).
- `/ports/[portId]` — daftar kunjungan ke satu pelabuhan (filter `portIds`), tertaut ke profil kapal.

Terbukti lewat contract check (fixture 22–29), beberapa berbeda dari dokumentasi:
- Stats memakai `startDate`/`endDate` (dokumentasi menulis `start-date`/`end-date` → 422).
- `groupBy` stats hanya FLAG, GEARTYPE, REGION_*, NEXT_PORT_ID — tidak ada pengelompokan per pelabuhan yang dikunjungi.
- `timeFilterMode` hanya `OVERLAP` atau `START-DATE`; `limit=1000` diterima; filter `portIds` bekerja.

Teruji 13 Okt 2026 dengan data nyata: 54.235 kunjungan, 13.296 kapal, 329 pelabuhan (8 Sep – 7 Okt 2026), sama dengan
statistik GFW; detail Tarakan 392 kunjungan = angka di ringkasan.

## Temuan (Tahap 8)

- Simpan temuan dari detail sel peta, header profil kapal, atau baris kejadian (atau "Buat temuan" manual). Sumber dan filter
  disimpan sebagai **snapshot** (nilai, versi dataset, waktu ambil) dan tidak berubah walau data provider diperbarui.
- Wajib: judul, alasan, prioritas (rendah/sedang/tinggi) dengan alasan — bukan probabilitas ilegal.
- Status: `baru → ditinjau → perlu_informasi | selesai`; `selesai → ditinjau` (buka kembali) wajib alasan. "Selesai" berarti
  peninjauan selesai, tidak menyatakan kapal legal/ilegal (badge sengaja netral, bukan hijau).
- Catatan **append-only**, dijaga trigger database (UPDATE/DELETE pada `finding_notes` ditolak). Perubahan status/prioritas
  tercatat sebagai entri riwayat + `audit_entries`.
- Optimistic concurrency: setiap PATCH membawa `version`; versi usang → 409 dan UI meminta muat ulang.
- Peran: Viewer hanya baca (API mutasi 403); Analyst/Admin membuat, mengubah, dan menambah catatan.
- API: `GET/POST /api/findings`, `GET/PATCH /api/findings/:id`, `POST /api/findings/:id/notes`.

Teruji 13 Okt 2026 (e2e 3 peran): simpan dari kapal/sel/kejadian, alur status termasuk buka kembali, prioritas + catatan,
konflik versi 409, Viewer read-only, persist setelah login ulang, 390px tanpa overflow.

## Laporan (Tahap 9)

- Jenis: ringkasan harian (3 metrik), sel grid satu layer, kunjungan pelabuhan, kejadian satu kapal. Format MVP: **ZIP berisi
  `data.csv` + `metadata.csv`** (PDF terformat = P1, tidak ditawarkan).
- Diproses worker (job `report_export`) dari **snapshot yang sama dengan UI** (`loadPart`/`loadPortPart`); bila snapshot belum
  ada, sumber diantre lalu ekspor menunggu (maks. ±15 menit). Kejadian kapal diambil per 1.000 dan dicek terhadap total GFW.
- Metadata: wilayah & hash geometri, periode UTC, versi dataset diminta/dilayani, waktu ambil, kelengkapan, agregasi, satuan,
  referensi snapshot, catatan, atribusi GFW, batas interpretasi.
- CSV: UTF-8 + BOM, angka format mesin (titik desimal), sel kosong = tidak tersedia; teks yang diawali `= + - @` diberi
  awalan `'` (pencegahan formula injection).
- Keamanan: buat laporan = Analyst/Admin; unduh = pengguna login (Viewer boleh); file di storage privat
  (`REPORTS_DIR`, default `storage/reports/`), disajikan lewat server, kedaluwarsa 7 hari (410). Idempotency key per pengguna.
- `/print/ringkasan` — tampilan cetak ringkasan (tanpa shell aplikasi) dari snapshot Ringkasan yang sama.
- Perbaikan infrastruktur: `transaction()` kini aman dipanggil bersarang (SAVEPOINT).

Teruji 13 Okt 2026 dengan data nyata: Σ CSV apparent fishing 30 hari = 70.422,941 jam = snapshot UI; sel grid 3.730 baris =
jumlah sel; kejadian TB NAILA 27 baris "complete"; idempotency, Viewer 200/403, tanpa sesi 401.

## Analisis & Pengaturan (Tahap 10)

- `/analysis` — tab **Tren** (total, rata-rata per hari berdata, hari tanpa baris, tren harian, komposisi bendera),
  **Perbandingan** (dua periode dengan panjang sama dan tidak tumpang tindih; total, selisih, tren bertumpuk, bendera, dan
  25 sel teratas dengan **kelas warna dari gabungan kedua periode** → skala identik), **Hotspot** (50 sel teratas, tautan ke
  peta dengan konteks & sel). Metrik: apparent fishing / keberadaan AIS / deteksi radar. Hanya tab aktif yang mengantre report.
- Perbandingan dua wilayah & analisis per WPP **terkunci** sampai file geometri WPPNRI resmi tersedia (dinyatakan di UI).
- `/settings` (Admin): ubah peran / nonaktifkan pengguna (sesi dicabut seketika; akun sendiri & Admin aktif terakhir dilindungi),
  budget request GFW harian (`app_settings`, dipakai klien GFW sebelum env), status token (hanya "terpasang", nilai tidak
  pernah ditampilkan), status geometri (ZEE tervalidasi, WPPNRI belum tersedia).

Teruji 13 Okt 2026 (27/27 e2e): total tren = Ringkasan (70.422,9 jam); perbandingan 70.422,9 vs 62.080,3 (+13,4%);
hotspot teratas 707 jam di 3,7° LS · 114,5° BT; budget 4.000 dipakai klien; Viewer dinonaktifkan → 401.

## Ramah pemula (revisi 13 Okt 2026)

- Istilah dalam satu sumber: `src/lib/copy.ts` (mis. "apparent fishing" → **Aktivitas penangkapan ikan**; istilah
  teknis tetap disebut di penjelasan). Label jenis kapal/alat tangkap: `src/lib/vessels/labels.ts` (kode asli di tooltip).
- Penjelasan panjang dipindah ke tombol ⓘ (`InfoTip`; klik/Esc, tidak keluar layar di ponsel).
- Ringkasan punya panduan **"Mau mulai dari mana?"**; halaman **Tentang data** punya "Cara membaca data".
- **Kapal** langsung menampilkan daftar tanpa mencari: kapal penangkap ikan paling aktif (report fishing effort per
  kapal) atau semua kapal (kehadiran per kapal), 25/50/100 teratas, klik → profil.
- Foto kapal **tidak** tersedia di API GFW (tidak ada field foto di respons vessel/search/events), jadi tidak ditampilkan.

## Tampilan glassmorphism (revisi 13 Okt 2026)

- Token & utilitas di `src/app/globals.css`: `glass` (kartu, 55% putih + blur 18px), `glass-strong` (sidebar, topbar,
  dialog, panel & legenda peta, tooltip, 80%), `glass-hover`. Latar halaman putih polos; kartu dipisahkan oleh garis tepi + bayangan halus.
- Kontras: teks muted 6,0:1 di atas putih; panel "Mau mulai dari mana?" ≥ 4,69:1 untuk teks putih.
- Fallback otomatis ke permukaan putih solid bila `backdrop-filter` tidak didukung, `prefers-reduced-transparency`,
  mode kontras tinggi (`forced-colors`), dan saat dicetak. Peta & grafik tidak diburamkan.

## WPP-NRI (revisi 13 Okt 2026)

- Sumber: 11 Shapefile `shp&shx/namobj_WPP-RI ###.shp` (+ `.shx`; tanpa `.dbf`/`.prj`, sumber tidak dicatat).
  Kode WPP dari nama file; CRS diasumsikan EPSG:4326 (koordinat terbukti derajat, posisi cocok dengan WPP).
- `npm run regions:import-wpp` → konversi tanpa dependensi (`src/lib/geo/shapefile.ts`): pulau dipasangkan ke
  poligon induk, Douglas–Peucker 0,005° (±555 m) + perbaikan **lokal** perpotongan, pulau < 0,002 derajat² dilebur,
  serpihan berluas ≈ 0 dibuang → 7,3 juta titik menjadi ±21 ribu titik, 0 perpotongan. Pemeriksa: `scripts/inspect-shapefile.ts`.
- GFW menerima poligon sendiri (fixture 32–34): report = POST body `{geojson: FeatureCollection}`;
  events & stats = body `{geometry}`. Kunci lock/cache memakai hash poligon.
- Rekonsiliasi apparent fishing 8 Sep–7 Okt 2026 per sel 0,1°: 11 WPP mencakup **99,9%** jam ZEE GFW;
  tumpang tindih antar-WPP 60,8 jam (9 sel). Jumlah WPP (121.299,8 jam) > ZEE (70.422,9) karena WPP 571 (40%)
  dan 711 (85%) mencakup perairan di luar ZEE versi GFW (dominan kapal MYS/VNM) → peringatan `RegionNotice`.
- UI: filter Wilayah dikelompokkan (Seluruh perairan / WPP) di semua halaman termasuk Kapal; Analisis
  "Bandingkan dengan wilayah lain" (periode sama, total + rasio + tren + bendera).

## Analisis statistik lengkap (revisi 14 Okt 2026)

Enam tab di `/analysis`; semua angka dari snapshot GFW yang sama dengan grafiknya, tanpa skor risiko/label pelanggaran.
Fungsi murni + test di `src/lib/analysis/stats.ts` dan `fleetBreakdown` (`aggregate.ts`); grafik batang aksesibel
`src/components/charts/BarChart.tsx` (hover/fokus = rincian, selalu ada tabel setara).

| Tab | Isi | Sumber |
|---|---|---|
| Naik-turun | tren + hari tertinggi/terendah, median, simpangan baku, kestabilan (koef. variasi), pola hari dalam seminggu, porsi Indonesia vs bendera lain | report harian (group-by FLAG) |
| Kapal & alat tangkap | jumlah ID kapal, rata-rata/median per kapal, porsi 10 kapal & 10% kapal teratas, per alat tangkap, per jenis kapal, kapal per bendera, sebaran jam per kapal, 20 kapal teraktif | report per kapal (group-by VESSEL_ID), seluruh kapal |
| Lokasi teramai | jumlah lokasi, perkiraan luas area beraktivitas (& porsi luas wilayah), porsi 10 lokasi teratas, lokasi penyumbang 50%, kurva konsentrasi, 50 lokasi | report sel 0,1° |
| Antar-WPP | total 11 WPP pada periode sama + kepadatan per 1.000 km² (luas poligon pada bola) | report harian tiap WPP |
| Kejadian di laut | kegiatan menangkap ikan, pertemuan antar-kapal, berhenti lama, kunjungan pelabuhan: kejadian/kapal/bendera vs periode sebelumnya | `POST /v3/events/stats` (fixture 35; cache 6 jam) |
| Bandingkan | periode lain / wilayah lain (seperti sebelumnya) | — |

- Report per kapal kini menyimpan rincian seluruh armada (bukan hanya 100 teratas); kunci dedup `vessels` diberi
  `payloadVersion: 2` sehingga hasil lama diambil ulang sekali. **Worker harus dijalankan ulang** setelah pembaruan.
- Rincian per kapal untuk radar satelit (SAR) belum diuji → tab Kapal menyatakan "belum tersedia", bukan angka.
- `scripts/probe-event-stats.ts`: contract check events/stats keempat jenis (respons hanya total, tanpa deret waktu).

## Database

SQLite memakai modul bawaan Node 24 (`node:sqlite`), tanpa dependensi native. File default `data/indonesia-fishing-watch.db`
(bila belum ada tetapi `data/pantau-laut.db` lama ada, file lama dipakai)
(diatur lewat `DATABASE_PATH`) dan migrasi berjalan otomatis saat pertama dibuka (`src/lib/db/migrations.ts`).
Rencana awal memakai Prisma, tetapi tag `latest` Prisma saat ini masih RC dan versi stabilnya memerlukan driver native
`better-sqlite3`. SQL ditulis standar (TEXT/INTEGER, waktu ISO-8601 UTC) agar dapat dipindah ke PostgreSQL + PostGIS.
Tabel data GFW ditambahkan pada tahap masing-masing setelah bentuk respons nyata diperiksa.

`/design-preview` menampilkan galeri komponen dan state untuk QA visual. Route ini hanya ada saat development, dan
semua angkanya berlabel "Contoh".

## Versi terpasang (dikunci di package-lock.json)

| Paket | Versi |
| --- | --- |
| Node.js (lingkungan dev) | 24.18.0 |
| next | 16.4.0 (App Router, Cache Components aktif) |
| react / react-dom | 19.3.0 |
| tailwindcss | 4.3.3 |
| typescript | 5.9.3 |
| lucide-react | 1.56.0 |
| zod | 4.6.7 |
| maplibre-gl | 6.14.0 |
| server-only | 0.0.1 |
| vitest (dev) | 5.0.4 |
| tsx (dev) | 4.23.15 |
| @types/node (dev) | 24.19.2 |
| eslint | 9.39.5 |
| SQLite (via node:sqlite) | 3.53.1 |

## Struktur

- `src/app/globals.css`: design tokens (DS §3, §5, §13), dipetakan ke utilitas Tailwind.
- `src/components/ui/`: Button, Badge, Banner, Card, MetricCard, DataTable, Tabs, Dialog, DetailDrawer, StateView.
- `src/components/layout/`: AppShell (sidebar 232/72px, drawer di bawah 1024px), PageContainer, PendingFeature.
- `src/lib/format.ts`: format angka Indonesia dan tanggal UTC. Nilai kosong ditampilkan "—", tidak pernah 0.
- `src/app/(app)/*`: route untuk 9 menu MVP (PRD §7.2), semuanya di balik login.
- `src/app/login`, `src/app/invite/[token]`: halaman publik.
- `src/lib/auth/`: password, token, peran, layanan sesi/undangan (`service.ts`), lapisan cookie (`session.ts`), Server Actions.
- `src/lib/db/`: koneksi SQLite dan migrasi.
- `src/lib/gfw/`: `http.ts` (klien: timeout, retry terbatas, budget harian, token server-only), `capabilities.ts`
  (allowlist dataset & status akses), `schemas.ts` (schema + normalizer dari fixture), `adapters.ts` (Events, Vessels,
  4Wings, Regions), `cache.ts` (TTL & coalescing), `zip.ts`.
- `src/lib/regions.ts`: katalog & validasi geometri; `src/lib/data-status.ts`: data halaman status.
- `fixtures/gfw/`: respons nyata GFW (diringkas, tanpa token) untuk test kontrak.
- `src/lib/jobs/`: antrean (`queue.ts`) dan lock lintas proses (`locks.ts`).
- `src/lib/analysis/`: agregasi murni (`aggregate.ts`) dan job report GFW (`report-jobs.ts`).
- `src/lib/map/`, `src/lib/vessels/`, `src/lib/ports/`: logika peta, identitas kapal, agregasi & job pelabuhan.
- `scripts/`: `seed-admin.ts`, `create-invite.ts`, `contract-check.ts`, `import-region.ts`, `worker.ts`, dan skrip
  `probe-*.ts` (contract check per tahap; hasilnya di `fixtures/gfw/`).
