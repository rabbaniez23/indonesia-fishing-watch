# Design System — Platform Pemantauan Maritim Indonesia

Versi: 1.0 · Tanggal: 13 Oktober 2026 · Tema: light, hijau–putih.

Nama: **Indonesia Fishing Watch** (sebelumnya “Pantau Laut”), mengikuti PRD. Dokumen pasangan: [PRD](PRD_Pemantauan_Maritim_Indonesia.md).

Status: spesifikasi visual dan interaksi untuk implementasi, bukan website atau mockup UI yang telah dirender. Seluruh angka contoh dalam desain harus diberi label contoh; tidak ada screenshot referensi yang diperlakukan sebagai data maritim Indonesia.

## 1. Arah visual dan referensi

Kelima gambar pengguna telah diperiksa secara visual. Referensi digunakan untuk struktur dan suasana desain, bukan untuk menyalin merek, foto, data kapal, atau fitur yang tidak tersedia.

| Referensi pengguna | Yang terlihat | Yang diterapkan |
| --- | --- | --- |
| `image(3).png` | Peta MarineTraffic, navigasi tipis, pencarian, toolbar, timeline bawah | Peta dominan, kontrol terkelompok, detail di panel; garis lintasan tidak diadopsi pada MVP |
| `image(4).png` | Sidebar daftar menu MarineTraffic | Menu jelas dan konsisten; hanya menu PRD yang didukung data |
| `image(5).png` | Dashboard putih, aksen lime, KPI, grafik, tabel dan pembatas halus | Dasar palet hijau–putih; hierarki angka dan whitespace |
| `image(6).png` | Dashboard terang, sidebar ikon, peta dan panel ringkasan | Komposisi kartu teratur dan panel detail; ungu/biru dekoratif diganti hijau |
| `image(7).png` | Peta padat, simbol berarah, popup kapal, panel weather | Detail kontekstual dan layer controls; heading arrows, foto, weather, dan live positions tidak ditiru |

Desain akhir: profesional, ringan, mudah dipindai, dan berorientasi data. Latar putih/off-white mendominasi; hijau tua menandai aksi; lime dipakai terbatas sebagai aksen grafik. Tidak ada gradient besar, glassmorphism, neon, bayangan tebal, atau dashboard gelap pada MVP.

## 2. Prinsip desain

1. **Data menjadi fokus.** Judul, periode, unit, nilai, lalu caveat; hiasan tidak bersaing dengan informasi.
2. **Status terlihat.** Data kosong, belum tersedia, sebagian, lama, dan gagal harus tampak berbeda.
3. **Konteks tetap dekat.** Wilayah/periode aktif terlihat pada peta, grafik, tabel, dan ekspor.
4. **Konsistensi interaksi.** Terapkan filter, detail drawer, tabel, dan status badge bekerja sama di semua halaman.
5. **Simbol sesuai data.** Grid adalah grid; kejadian adalah kejadian; deteksi belum tentu kapal unik; tidak ada simbol yang menyiratkan posisi langsung.
6. **Aksesibilitas sejak awal.** Teks, label, focus, dan alternatif tabel dirancang sebelum animasi atau ornamen.

## 3. Design tokens — warna

### 3.1 Foundation dan brand

| Token | HEX | Penggunaan |
| --- | --- | --- |
| `canvas` | `#F6F8F5` | Latar halaman |
| `surface` | `#FFFFFF` | Sidebar, topbar, kartu, dialog |
| `surface-subtle` | `#EFF5EF` | Header tabel, strip konteks, hover halus |
| `ink` | `#172B22` | Teks utama dan judul |
| `ink-muted` | `#52645A` | Teks sekunder yang tetap terbaca |
| `border` | `#DDE6DF` | Pembatas dekoratif dan kartu |
| `border-control` | `#7D9184` | Input/checkbox yang perlu batas terlihat |
| `primary` | `#166534` | Tombol utama, item aktif, focus |
| `primary-hover` | `#14532D` | Hover tombol utama |
| `primary-soft` | `#EAF5EB` | Latar item aktif |
| `accent-lime` | `#B7E34B` | Aksen grafik dan area brand terbatas |
| `accent-lime-ink` | `#23370A` | Teks di atas lime |
| `inverse` | `#FFFFFF` | Teks di atas primary |

Lime tidak dipakai sebagai teks kecil di atas putih atau background tombol dengan teks putih. Border dekoratif tidak menjadi satu-satunya batas komponen interaktif.

### 3.2 Status semantik

| Status | Teks/ikon | Background | Border | Contoh label |
| --- | --- | --- | --- | --- |
| Sukses | `#166534` | `#EDF7ED` | `#B9DDBD` | Laporan siap |
| Informasi | `#1D4ED8` | `#EFF6FF` | `#BFDBFE` | Data perkiraan |
| Peringatan | `#854D0E` | `#FFF8E6` | `#EBCF8F` | Hasil sebagian |
| Error | `#B91C1C` | `#FEF2F2` | `#FECACA` | Sumber tidak dapat diakses |
| Netral | `#52645A` | `#F2F5F2` | `#DDE6DF` | Belum diketahui |

Ikon dan teks wajib menyertai status. Hijau sukses tidak dipakai untuk menyatakan kapal “legal”, dan merah error tidak dipakai untuk kapal asing atau deteksi unmatched.

### 3.3 Palette data

| Metric/elemen | Warna jangkar | Bentuk/label |
| --- | --- | --- |
| Apparent fishing | `#166534` | Grid heatmap; label “Jam apparent fishing” |
| Vessel presence | `#0F766E` | Grid heatmap; label “Jam keberadaan berbasis AIS” |
| SAR detections | `#A16207` | Grid atau diamond bila deteksi individual sah; label “Deteksi radar” |
| Port visit event | `#1D4ED8` | Pin/event icon; bukan koordinat port resmi tanpa sumber |
| Wilayah terpilih | `#166534` | Garis tebal serta nama wilayah |
| Wilayah lain | `#66796D` | Garis netral |
| Data unknown | `#64748B` | Label unknown, bukan nilai nol |
| Periode pembanding | `#52645A` | Garis putus-putus atau outline bar |

Sequential fishing ramp: `#EDF6EE`, `#CDE9D1`, `#9BD3A6`, `#53AC6C`, `#278345`, `#166534`.

Bin boundaries adalah hasil konfigurasi data, bukan angka dekoratif tetap. Legend menyebut unit, rentang, dan periode. Jika memakai quantile, sebut “Skala kuantil”; gunakan bins identik saat membandingkan wilayah/periode. Untuk mode SAR matched/unmatched, pakai teal/amber dan label lengkap, bukan green/red yang menyerupai status hukum.

### 3.4 Kontras yang dihitung

Rasio berikut dihitung dari pasangan HEX solid menggunakan relative luminance sRGB. Nilai ini memverifikasi pasangan warna, bukan menyatakan seluruh website telah memenuhi WCAG.

| Pasangan | Rasio sekitar | Ketentuan |
| --- | --- | --- |
| Ink / putih | 14,95:1 | Teks utama |
| Ink-muted / putih | 6,31:1 | Teks sekunder |
| Putih / primary | 7,13:1 | Tombol utama |
| Accent-lime-ink / lime | 8,69:1 | Label pada lime |
| Border-control / putih | 3,36:1 | Batas input yang relevan |
| Putih / lime | 1,49:1 | Tidak dipakai untuk teks |

Target teks normal minimal 4,5:1; elemen UI/focus relevan minimal 3:1. Pasangan dengan opacity, overlay peta, hover, dan disabled harus diperiksa pada implementasi. Dasar standar: [W3C Contrast Minimum](https://www.w3.org/WAI/WCAG22/Understanding/contrast-minimum.html).

## 4. Typography

Font utama: **Inter**. Fallback: `ui-sans-serif, system-ui, -apple-system, Segoe UI, sans-serif`. Self-host jika lisensi/asset tersedia; jangan mengasumsikan jaringan font eksternal selalu dapat diakses.

| Token | Ukuran / line-height | Weight | Penggunaan |
| --- | --- | --- | --- |
| `page-title` | 28 / 36 px | 600 | Judul halaman |
| `section-title` | 18 / 26 px | 600 | Judul panel |
| `card-title` | 15 / 22 px | 600 | Judul kartu |
| `body` | 14 / 22 px | 400 | Konten utama |
| `body-strong` | 14 / 22 px | 500 | Label/aksi |
| `caption` | 12 / 18 px | 400 | Metadata singkat dan attribution |
| `metric` | 32 / 40 px | 600 | KPI desktop |
| `metric-mobile` | 28 / 36 px | 600 | KPI mobile |
| `table-number` | 14 / 22 px | 500 | Nilai tabular |

Gunakan tabular numerals pada KPI/tabel. MMSI/IMO dapat memakai mono dengan ukuran 13–14 px; pertahankan identifier sebagai string. Tidak semua label memakai uppercase. Judul cukup sentence case, maksimal dua baris sebelum wrapping normal.

Format Indonesia: pemisah ribuan titik, desimal koma. Jam aggregate satu desimal bila perlu; jumlah deteksi integer. CSV menyertakan unit dan menggunakan format angka mesin yang didokumentasikan. Timestamp event harus menyebut UTC atau timezone pilihan. Jangan memotong nilai penting menjadi bentuk pendek tanpa nilai lengkap pada tooltip/tabel.

## 5. Spacing, radius, shadow dan motion

| Jenis | Tokens |
| --- | --- |
| Spacing | 4, 8, 12, 16, 20, 24, 32, 40, 48 px |
| Page padding | 32 px desktop; 24 px tablet; 16 px mobile |
| Card padding | 24 px default; 16 px padat/mobile |
| Gap panel | 24 px desktop; 16 px mobile |
| Radius | 8 px input; 12 px button/panel kecil; 16 px kartu/dialog; pill hanya badge/chip |
| Border | 1 px; batas selected/focus mengikuti ketentuan aksesibilitas |
| Shadow kartu | `0 1px 2px rgba(23,43,34,0.04)` |
| Shadow overlay | `0 12px 32px rgba(23,43,34,0.12)` |
| Transition | 120–180 ms untuk state; drawer maksimal 220 ms |

Hover kartu tidak membesar atau melompat. Animation tidak menghambat pembacaan grafik. `prefers-reduced-motion` mematikan transform/animasi nonesensial. Timeline mengubah periode observasi; tidak menganimasikan kapal bergerak secara rekaan.

## 6. Layout aplikasi dan responsif

### 6.1 Shell

- Sidebar expanded 232 px; collapsed 72 px.
- Topbar 64 px, background putih, border bawah halus.
- Sidebar putih dengan logo sementara berbasis teks; tidak memakai logo GFW, MarineTraffic, atau instansi sebagai logo produk.
- Logo/menu di atas; sumber/status dan pengaturan/akun di bawah.
- Item menu tinggi 44 px, icon 20 px, gap 12 px, padding horizontal 12 px, radius 10 px.
- Active: primary-soft, teks primary 600, penanda kiri atau selected label accessible.
- Ikon-only wajib tooltip dan accessible name; jangan mengandalkan tooltip untuk fungsi inti.
- Konten dashboard grid 12 kolom; peta boleh memakai lebar penuh ruang konten.
- Maksimum konten nonpeta 1600 px dengan alignment konsisten; tidak menciptakan whitespace besar di antara komponen terkait.

### 6.2 Breakpoints

| Lebar | Sidebar | KPI | Panel peta/filter |
| --- | --- | --- | --- |
| >= 1280 px | Expanded dashboard; collapsed default pada Peta | 4 kolom | Layer kiri 280 px dan detail kanan 360 px bila ruang cukup |
| 1024–1279 px | Collapsed | 2 kolom | Satu panel aktif; detail mengganti layer panel |
| 768–1023 px | Drawer navigasi | 2 kolom | Filter dialog; detail side sheet maksimum 360 px |
| < 768 px | Tombol menu/drawer | 1 kolom | Filter full-screen sheet; detail bottom sheet |

Pada desktop ketika dua panel membuat area peta < 600 px, buka satu panel saja. Main map memakai `100dvh` dikurangi shell/toolbar yang nyata; jangan hardcode tinggi yang memotong layar pendek. Pada 390 px, detail sheet memiliki tinggi awal sekitar 55dvh, expandable, dan tombol tutup yang selalu terlihat.

Halaman panjang mengikuti scroll dokumen. Tabel boleh horizontal scroll di dalam container; halaman keseluruhan tidak overflow horizontal. Header tabel sticky hanya dalam container yang dapat diakses keyboard.

## 7. Komponen dasar

### 7.1 Buttons

| Variant | Visual | Penggunaan |
| --- | --- | --- |
| Primary | Primary + teks putih | Terapkan, Simpan temuan, Buat laporan |
| Secondary | Putih, border-control, ink | Batal, Atur filter, Bandingkan |
| Ghost | Tanpa fill, primary/ink | Lihat detail, Reset |
| Destructive | Error + putih | Hanya tindakan destruktif nyata |
| Icon | Surface, border, 44 x 44 px | Zoom, buka/tutup panel |

Tinggi default 44 px; compact 36 px hanya desktop dengan hit area cukup. Horizontal padding 16 px, icon gap 8 px. Fokus outline primary 2 px dengan offset 2 px. Loading menyertakan label proses serta `aria-busy`; disabled memakai atribut nyata dan alasan tersedia di teks dekat kontrol. Jangan membuat tombol fitur masa depan terlihat aktif.

### 7.2 Fields dan filter

Input tinggi 44 px, label terlihat di atas, helper/error di bawah. Label 14 px; placeholder bukan pengganti label. Error memakai icon/teks. Filter tanggal menggunakan dua tanggal atau range picker yang accessible, dilengkapi ringkasan “Hari UTC”.

Filter bar: Wilayah, Periode, Metric/layer, atribut dataset yang didukung, tombol Terapkan, Reset. Tidak otomatis mengirim report setiap perubahan field. Draft yang berbeda dari applied menampilkan “Perubahan belum diterapkan”. Loading tidak menghapus filter aktif.

Filter chip menunjukkan nilai, dapat dihapus jika sesuai capability, dan memiliki nama accessible. Status completeness tidak memakai chip filter yang bisa dihapus. Filter unsupported tidak tampil sebagai kontrol aktif.

### 7.3 Cards dan KPI

Kartu background putih, border decorative, radius 16 px, padding 24 px. Urutan KPI: label → nilai → unit/periode → perbandingan → sumber/status. Nilai kosong berupa dash dengan kalimat penjelas, bukan angka nol.

Delta naik tidak selalu sukses/hijau; gunakan warna netral serta panah naik/turun. Kenaikan aktivitas bukan otomatis hasil positif atau pelanggaran. Sparkline opsional dan hanya jika seri tersedia; tidak ditambahkan sebagai dekorasi acak.

### 7.4 Tabs

Tabs profile memakai teks 14 px dan indikator selected primary; tinggi hit area 44 px. ARIA tablist/tab/tabpanel dan keyboard arrow navigation. Tab tidak tersedia dapat dihilangkan dengan alasan pada status sumber; jangan menaruh tabel rekaan agar tab terlihat lengkap.

### 7.5 Table

Header 44 px, baris default 52 px; event multiline hingga 72 px. Header subtle, garis baris border. Angka right aligned; nama/identitas left aligned. Link kapal nyata terlihat sebagai link. Sorting hanya pada kolom yang didukung; server/client sort tidak dicampur diam-diam.

Default 25 baris/page, opsi 25/50. Total unknown tampil “Total belum diketahui”, bukan menggunakan jumlah page sebagai total. Unknown cells “Tidak tersedia”. Identitas konflik memiliki status dan akses ke sumber. Row selection tidak berarti seluruh dataset telah dipilih; ekspor seluruh hasil menggunakan job.

Mobile memilih kolom inti + detail sheet, atau scroll tabel; jangan menghilangkan timestamp/satuan tanpa jalur detail. Tabel alternatif grafik memakai sumber snapshot sama.

### 7.6 Badge, banner, toast

Badge: 12 px, line-height 18 px, padding 4 x 8 px, icon 14 px; status berupa teks. Banner di atas area data untuk partial/stale/error, menyertakan tindakan relevan.

Toast: feedback aksi lokal, misalnya “Temuan disimpan”; bukan satu-satunya tempat memberi tahu report gagal. Toast tidak mengandung token atau raw body upstream. Status lama/pending tetap terlihat pada kartu/tabel setelah toast hilang.

### 7.7 Dialog dan drawer

Dialog kecil 480 px, form 640 px; width maksimal `calc(100vw - 32px)`. Judul, deskripsi, form, footer actions. Escape dan tombol tutup, focus trap, focus return. Klik overlay menutup hanya jika tidak menghilangkan form yang belum tersimpan; berikan konfirmasi discard bila diperlukan.

Detail drawer memuat judul item, jenis data, periode, sumber, nilai/atribut, caveat, dan aksi. URL filter tidak hilang ketika drawer ditutup. Drawer deep link dapat dipulihkan tanpa token di URL.

## 8. Desain peta

### 8.1 Basemap dan hierarki

Basemap light: laut mendekati `#EEF4F1`, daratan `#E0E9E1`, label `#52645A`, jalan/batas lembut. Warna tersebut target style bila provider mendukung kustomisasi, bukan janji tile provider tertentu. Basemap berfungsi orientasi; layer aktivitas lebih menonjol.

Wilayah aktif: garis primary 2 px, fill transparan maksimal 6%. Wilayah lain: garis abu-hijau 1 px. Label WPP tidak bertumpuk; collision control. Fill batas tidak mengubah warna data secara menyesatkan.

### 8.2 Geometri dan simbol

| Objek | Simbol | Label wajib |
| --- | --- | --- |
| Presence/effort aggregate | Sel/grid atau heatmap | Metric, unit, resolusi |
| SAR aggregate | Sel/grid berwarna amber | Jumlah deteksi, periode |
| Event representatif | Lingkaran/ikon jenis kejadian | Jenis event, waktu, lokasi representatif |
| Port visit | Pin kejadian | Kunjungan teramati; bukan pin koordinat resmi port |
| Port catalog P1 | Ikon anchor setelah sumber geometri sah | Nama dan sumber koordinat |
| Selected cell | Outline gelap + indicator | Detail sel aktif |

Tidak ada segitiga kapal berarah, speed/course popup, ETA, rute animasi, atau garis past track dalam MVP. Simbol tersebut hanya boleh diperkenalkan jika sumber posisi dan kontraknya sudah mendukungnya.

### 8.3 Controls

- Kiri: tombol Layer, Filter, dan detail active context.
- Kanan: zoom +/−, reset ke wilayah, fullscreen jika didukung browser.
- Bawah: legend dan periode, terpisah dari attribution provider.
- Search kapal membuka hasil profil, bukan langsung menyatakan posisi saat ini.
- Pointer hover menampilkan tooltip singkat; klik/keyboard membuka panel detail lengkap.
- Jangan mengklaim “tidak ada kapal” pada tile yang belum berhasil dimuat.

Z-index keputusan: basemap 0; data layer 10; labels/selection 20; controls 30; drawer 40; dialog overlay 60; toast 80. Implementasi harus mempertimbangkan stacking context MapLibre, bukan sekadar memberi angka global pada setiap node.

### 8.4 Legend dan waktu

Legend selalu menampilkan dataset/metric, satuan, bins, periode aktif, dan keterangan grid/perkiraan. Maximum 6 bins agar dapat dipindai. Transparansi map layer dikontrol pengguna; legend tetap memakai warna referensi yang jelas.

MVP memakai range picker serta label periode; playback perubahan harian bersifat P1. Jika playback ditambahkan, tampilkan “Perubahan aktivitas per hari”, bukan “Pergerakan kapal langsung”. Partial/no-data frame diberi state tersendiri dan tidak ditransisikan menjadi aktivitas nol.

## 9. Grafik dan analisis

### 9.1 Chart rules

- Line chart untuk tren; bar horizontal untuk ranking; stacked bar hanya ketika komponen dan denominator valid.
- Maksimum dua wilayah/periode pada perbandingan MVP.
- Axis wajib satuan dan periode; tidak menggunakan dual axis yang tidak dijelaskan.
- Bar baseline nol. Line chart boleh rentang khusus dengan label yang jelas.
- Missing value berupa gap/null; nol hanya nilai nol terverifikasi.
- Tooltip: tanggal, metric, nilai, unit, wilayah, dan status jika partial.
- Legend interactive mempertahankan satuan, tidak menyembunyikan semua data tanpa penjelasan.
- Tidak memakai 3D, donut dekoratif, gauge risiko palsu, atau grafik dengan angka demo di produksi.
- Tombol “Lihat tabel” tersedia; tabel diturunkan dari snapshot identik.

### 9.2 Aksen lime

Lime dapat menyorot seri terpilih pada bar besar dengan outline primary atau label ink. Seri lain netral/light green. Teks tetap gelap. Jangan menggunakan lime tipis untuk line chart kecil di atas putih; pakai primary agar terlihat.

### 9.3 Analisis perubahan

Delta diberi label “Dibanding periode sebelumnya” dan menyertakan tanggal kedua periode. Jika previous zero, tampil “Persentase tidak dapat dihitung”. Jika partial, banner dan note selalu dekat grafik. Tidak ada klaim “naik X% kapal ilegal”.

## 10. Spesifikasi halaman

### 10.1 Ringkasan — `/overview` — FR-04

Urutan desktop:

1. Judul “Ringkasan aktivitas maritim”; subtitle cakupan.
2. Filter bar dan status waktu/sumber.
3. Empat KPI pada satu baris: jam apparent fishing, jam presence, deteksi radar, IDs unik.
4. Peta ringkas 7 kolom dan tren aktivitas 5 kolom.
5. Ranking WPP/grid 7 kolom dan temuan terbaru 5 kolom.
6. Attribution dan tautan definisi data.

Kartu peta tinggi sekitar 360 px desktop, tetapi responsif. CTA “Buka peta” dan “Lihat analisis”. Tidak membuat ranking WPP bila hanya satu WPP pilot tersedia; tampilkan ranking grid pilot dan konteksnya.

### 10.2 Peta — `/map` — FR-03

Sidebar collapsed default. Topbar judul serta search kapal. Peta mengisi ruang utama; layer panel kiri 280 px, detail drawer kanan 360 px hanya jika map masih >=600 px. Filter diterapkan dalam panel/sheet. Status sumber adalah strip kecil terlihat, bukan banner besar yang menutupi peta terus-menerus.

Default satu layer apparent fishing aktif; presence dan radar dapat dipilih. Layer tanpa gate akses teruji tidak diberi toggle aktif. Selection tetap terlihat hingga pengguna menutup detail atau mengganti filter yang membuat item tidak relevan.

### 10.3 Analisis WPP — `/analysis` — FR-05

Header, filter, segmented control “Tren / Perbandingan / Hotspot”, tiga ringkasan context metrics, grafik utama, tabel detail, source note. Comparison selector membatasi dua wilayah atau dua periode. Gambar peta tidak dijadikan background dekoratif grafik.

Tab hotspot menampilkan ranking nilai teramati, unit dan periode; tombol tiap row membuka Peta dengan konteks sama. Tidak menampilkan “ranking risiko” tanpa metode yang telah disepakati.

### 10.4 Kapal — `/vessels` dan `/vessels/[id]` — FR-06/07

Search besar tetapi tidak mendominasi halaman. Placeholder “Cari nama kapal, MMSI, atau IMO”; helper menjelaskan hasil berasal dari identitas GFW. Search results tabel: nama, identifier, flag/sumber, jenis jika ada, aksi.

Profil: breadcrumb, nama/identifier, badge “Identitas dari AIS/registry”, panel data identitas, lalu tabs Identitas/Aktivitas/Kunjungan pelabuhan. Tidak ada foto kosong besar; gunakan ikon netral kecil jika foto tidak tersedia. Konflik identitas tampil di panel sumber.

Timeline events berisi tanggal, jenis, durasi, posisi representatif jika ada, dan detail. Tidak ada tombol “Live tracking” atau “Past track” dalam MVP. CTA utama kontekstual “Simpan temuan”.

### 10.5 Pelabuhan — `/ports` — FR-08

Judul “Kunjungan pelabuhan”; subtitle “Referensi pelabuhan berdasarkan kejadian yang teramati”. Filter periode dan cakupan. KPI hanya jika query lengkap: kunjungan teramati dan distinct IDs yang tercatat. Tabel nama provider/ID, kunjungan, periode, dan aksi detail.

MVP tidak memakai peta pin seluruh pelabuhan sebagai hero karena koordinat katalog belum tersedia. Detail menampilkan daftar port visits. P1 dapat menambahkan peta setelah impor anchorages/ports terverifikasi. Tidak ada kapasitas terminal, fasilitas, ETA, atau kelas pelabuhan tanpa sumber.

### 10.6 Temuan — `/findings` — FR-09

Header dengan tombol Buat temuan untuk Analyst/Admin. Tabs status atau filter status, tabel judul/prioritas/status/wilayah/pembuat/waktu, detail drawer. Prioritas tinggi amber dengan teks; tidak disebut kapal berisiko ilegal.

Form: judul, alasan, referensi snapshot, prioritas, tombol Simpan. Status read-only untuk Viewer. Detail memuat catatan append-only dan riwayat perubahan. “Selesai” berarti review selesai; tidak berarti kapal dinyatakan legal.

### 10.7 Laporan — `/reports` — FR-10

Header dan CTA “Buat laporan”. Dialog memilih jenis report, wilayah, periode, dan format yang tersedia. MVP menawarkan CSV; print view ringkasan terpisah. Tidak menawarkan PDF aktif jika generator belum dibuat.

Job list states: antre, diproses, siap, gagal. Progress percentage hanya bila dapat diukur; jika tidak, gunakan spinner/step status tanpa persentase buatan. CTA Unduh hanya ready. File metadata accessible dekat tombol unduh.

### 10.8 Sumber & status data — `/data-status` — FR-11

Tabel dataset, documentation-supported, access-tested, versi, fetch berhasil terakhir, dan completeness. Informasi teknis detail tersedia lewat expand untuk Admin; pengguna umum melihat label mudah dipahami. Error token tidak mengungkap secret.

“Observasi terakhir dalam hasil” dibedakan dari “Data tersedia sampai” dan “Diambil pada”. Jika available-through tidak diketahui, tampil “Belum diketahui”. Banner demo persisten di semua halaman mode demo.

### 10.9 Pengaturan — `/settings`

Admin mengelola undangan pengguna, peran, status geometri, dataset config dan budget. UI tidak menampilkan token utuh setelah tersimpan. Tidak menyimpan secret lewat field `NEXT_PUBLIC`. Langkah credential dilakukan pada setup resmi, bukan form dalam mockup yang mengklaim koneksi sukses.

## 11. States dan microcopy

| State | Tampilan | Kalimat contoh | Tindakan |
| --- | --- | --- | --- |
| Loading awal | Skeleton berukuran tetap | “Memuat aktivitas…” | Filter tetap terlihat |
| Job antre | Badge netral | “Laporan menunggu giliran.” | Boleh meninggalkan halaman |
| Job diproses | Spinner/step, tanpa % buatan | “Laporan sedang diproses.” | Lihat status |
| Empty terverifikasi | Ikon netral + periode | “Tidak ada kejadian yang tercatat pada filter ini.” | Ubah filter |
| Unknown | Dash dan caption | “Data belum tersedia untuk menghitung nilai ini.” | Lihat status sumber |
| Partial | Banner amber + chip pada metric | “Hasil belum mencakup seluruh permintaan.” | Lihat bagian yang belum tersedia |
| Stale cache | Ikon jam + fetch time | “Menampilkan hasil tersimpan; pembaruan belum berhasil.” | Coba lagi |
| Error | Banner merah pada area terdampak | “Sumber data belum dapat diakses.” | Coba lagi/status |
| Unsupported | Informasi netral | “Data ini belum tersedia melalui akses yang digunakan.” | Baca sumber |
| Demo | Banner persisten | “Data contoh — bukan hasil pemantauan nyata.” | Tidak disembunyikan |

Label produk yang digunakan:

- “Apparent fishing” dengan helper “Perkiraan aktivitas terkait penangkapan berdasarkan pola AIS”.
- “Keberadaan berbasis AIS”, bukan “posisi langsung”.
- “Deteksi radar”, bukan “kapal terverifikasi”.
- “Belum memiliki pasangan AIS menurut GFW”, bukan “kapal ilegal” atau “AIS sengaja dimatikan”.
- “Bendera kapal”, bukan “kewarganegaraan pemilik”.
- “Lokasi representatif kejadian”, bukan “posisi presisi saat ini”.

## 12. Aksesibilitas dan keyboard

- Target WCAG 2.2 AA; pemeriksaan manual dan automated dilakukan saat UI dibangun.
- Skip link ke konten utama; landmarks `nav`, `main`, `aside`; hierarchy heading logis.
- Semua kontrol inti memiliki hit target 44 x 44 px atau padding area setara.
- Focus visible, tidak tertutup sticky header/drawer.
- Dropdown, tabs, calendar, dialog memakai primitive keyboard-accessible.
- Icon-only buttons memiliki `aria-label`; tooltip bukan satu-satunya nama.
- Grafik/peta punya ringkasan teks dan alternatif tabel yang setara.
- `aria-live` untuk hasil filter/job status, bukan setiap pan peta atau tile request.
- Jangan mengandalkan hover di mobile. Tooltip detail tersedia melalui klik/focus.
- Warna dilengkapi label/bentuk/pola; status tidak hanya titik hijau/merah.
- Uji zoom 200%, viewport sempit, dan reduced-motion.
- Disabled feature memberi alasan dalam teks di sekitarnya, bukan tooltip yang tak bisa difokuskan.

## 13. Token CSS untuk handoff

Snippet berikut merupakan spesifikasi awal, bukan file aplikasi yang sudah terpasang. Tailwind harus mengarah ke semantic variables, bukan menggunakan warna acak tiap halaman.

```css
:root {
  color-scheme: light;
  --color-canvas: #f6f8f5;
  --color-surface: #ffffff;
  --color-surface-subtle: #eff5ef;
  --color-ink: #172b22;
  --color-ink-muted: #52645a;
  --color-border: #dde6df;
  --color-border-control: #7d9184;
  --color-primary: #166534;
  --color-primary-hover: #14532d;
  --color-primary-soft: #eaf5eb;
  --color-accent-lime: #b7e34b;
  --color-accent-lime-ink: #23370a;
  --color-inverse: #ffffff;
  --color-success: #166534;
  --color-warning: #854d0e;
  --color-error: #b91c1c;
  --color-info: #1d4ed8;
  --color-data-fishing: #166534;
  --color-data-presence: #0f766e;
  --color-data-sar: #a16207;
  --color-data-port: #1d4ed8;
  --radius-input: 8px;
  --radius-button: 12px;
  --radius-card: 16px;
  --space-1: 4px;
  --space-2: 8px;
  --space-3: 12px;
  --space-4: 16px;
  --space-5: 20px;
  --space-6: 24px;
  --space-8: 32px;
  --space-10: 40px;
  --space-12: 48px;
  --sidebar-expanded: 232px;
  --sidebar-collapsed: 72px;
  --topbar-height: 64px;
  --shadow-card: 0 1px 2px rgba(23, 43, 34, 0.04);
  --shadow-overlay: 0 12px 32px rgba(23, 43, 34, 0.12);
}
```

Konvensi komponen yang diusulkan: `AppShell`, `SidebarNav`, `PageHeader`, `AppliedContext`, `FilterBar`, `MetricCard`, `SourceStatus`, `ActivityMap`, `LayerPanel`, `MapLegend`, `CellDetailDrawer`, `EventDetailDrawer`, `TrendChart`, `DataTable`, `VesselIdentityPanel`, `FindingForm`, `ReportJobRow`.

## 14. Batas antara design system dan kemampuan data

| Elemen yang menarik pada referensi | Keputusan MVP |
| --- | --- |
| Ship heading arrow | Tidak dibuat dari grid presence |
| Full vessel track | Tidak tampil tanpa kontrak akses sah |
| Weather panel | Di luar scope |
| Photo gallery | Di luar scope |
| Lighthouse/company/container menu | Di luar scope |
| Live badge | Tidak dipakai untuk data GFW tertunda |
| Score risiko 0–100 | Tidak dibuat tanpa metode/label/evaluasi |
| VIIRS dan Sentinel-2 toggles | Tidak aktif pada API-only MVP |
| Peta seluruh pelabuhan | P1 setelah katalog sah diimpor |

Fitur yang belum tersedia tidak digambarkan sebagai menu aktif untuk membuat UI terlihat lengkap. Jika mockup masa depan perlu menampilkan fitur lanjut, harus diberi label konsep/lanjutan dan dipisahkan dari layar MVP.

## 15. Checklist handoff dan visual QA

### 15.1 Layar yang harus dibuat saat implementasi

| Layar | Desktop | Mobile | State wajib |
| --- | --- | --- | --- |
| Ringkasan | 1440 dan 1280 px | 390 px | Ready, partial, source error |
| Peta | 1440 dan 1024 px | 390 px | Layer loading, selected cell, panel open, unavailable |
| Analisis WPP | 1440 px | 390 px | Compare, previous zero, missing series |
| Kapal/search | 1440 px | 390 px | Multiple candidates, empty |
| Profil kapal | 1440 px | 390 px | Unknown identity fields, source conflict, no events |
| Pelabuhan | 1440 px | 390 px | Observed visits only, unknown coordinate |
| Temuan | 1440 px | 390 px | Viewer read-only, form error, saved |
| Laporan | 1440 px | 390 px | Queued, processing, ready, failed |
| Sumber & status | 1440 px | 390 px | Untested access, partial, stale |

### 15.2 Kriteria selesai desain implementasi

- [ ] Semua menu dan komponen mengikuti PRD FR-01 sampai FR-12.
- [ ] Typography dan semantic tokens konsisten.
- [ ] Primary buttons hijau tua dengan teks putih; lime tidak menurunkan kontras.
- [ ] Whitespace rapi tanpa mengurangi konteks sumber/periode.
- [ ] Detail drawer dan filter tidak menutupi seluruh peta desktop.
- [ ] Attribution peta/GFW terlihat dan tidak tertutup overlay.
- [ ] Grid/pin/kejadian diberi simbol sesuai jenis data.
- [ ] Tidak ada live badge, heading arrow, trajectory, foto, atau angka rekaan.
- [ ] Empty, partial, unknown, stale, dan error tampak berbeda.
- [ ] Mobile tidak overflow horizontal pada shell dan form.
- [ ] Keyboard, focus, kontrast states, zoom dan tabel alternatif diperiksa.
- [ ] Data contoh ditandai pada setiap layar/ekspor demo.

## 16. Sumber dan aturan perubahan

Sumber visual: lima gambar yang diberikan pengguna dan diperiksa dalam tugas ini. Warna, ukuran, komposisi, dan tokens merupakan keputusan desain yang dibuat untuk produk ini, bukan ukuran hasil ekstraksi otomatis dari screenshot.

Sumber fakta kemampuan API dan batas data: tabel sumber pada PRD, terutama [GFW 4Wings](https://globalfishingwatch.org/our-apis/documentation/docs/v3/4wings), [Data Availability](https://globalfishingwatch.org/global-fishing-watch-data-availability/), serta [Data Caveats](https://api-doc.globalfishingwatch.org/our-apis/documentation/docs/v3/general-api-doc/data-caveats). Dibaca 13 Oktober 2026.

Sumber target kontras: [W3C WCAG Contrast Minimum](https://www.w3.org/WAI/WCAG22/Understanding/contrast-minimum.html). Perhitungan pasangan token solid dilakukan saat penyusunan; belum ada pemeriksaan browser atas UI implementasi.

Jika PRD mengubah scope atau capability, perbarui halaman/komponen terkait dan checklist. Jangan menjadikan gambar referensi alasan menambahkan data yang tidak tersedia. Bila desain dan kontrak sumber bertentangan, pertahankan kejujuran data dan catat perubahan desain.
