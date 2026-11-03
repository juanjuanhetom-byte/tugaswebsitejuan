# SIBORU — Sistem Booking Ruangan (IDB Bali)

**SIBORU** (**Sistem Booking Ruangan**) adalah aplikasi peminjaman ruangan kampus Institut Desain & Bisnis (IDB) Bali: katalog ruangan, pengajuan peminjaman, alur persetujuan admin, dan struk digital. **Task 1** — Frontend Layout: Halaman Login & Katalog Ruangan.

## Cara Menjalankan

Karena ini proyek statis (HTML/CSS/JS), Anda bisa langsung membuka file berikut di browser:

```
index.html    → Halaman Login (titik masuk)
catalog.html  → Katalog Ruangan (dilindungi session)
```

> **Tips:** Komputer ini tidak memiliki Python/Node, jadi saya sertakan server statis PowerShell:
>
> ```powershell
> powershell -ExecutionPolicy Bypass -File .\server.ps1 -Port 8080
> ```
>
> Lalu buka `http://localhost:8080`. Double-click `index.html` juga tetap bisa langsung jalan.

## Struktur Proyek

```
booking_idb_bali/
├── index.html        # Halaman Login (branding IDB Bali) + hero gambar & video 3 detik
├── catalog.html      # Katalog Ruangan (grid responsif) + struk & aksi WhatsApp
├── admin.html        # (Task 4) Panel Admin — dashboard, pemesanan, ruangan, pengguna
├── server.js         # Backend Express + SQLite (Task 3/4 — butuh `npm start`)
├── server.ps1        # Server statis opsional (PowerShell, port 8080)
├── package.json      # Dependensi backend (express)
├── README.md
├── images/           # Foto asli ruangan dari idbbali.ac.id (.jpg) + fallback SVG (Task 3.5)
│                     # + hero-tampilan-awal.png (gambar tampilan awal, Task 3.7)
│                     # + logo-idb.png & logo-idb-transparent.png (Task 3.8/3.10)
├── media/            # Video hero (hero-3detik.mp4 Task 3.7, hero-katalog-6detik.mp4 Task 3.8)
├── css/
│   └── styles.css    # Seluruh style (login + katalog + modal + struk + panel admin + responsive)
└── js/
    ├── api.js        # Client API fetch() ke backend (Task 3) + endpoint admin (Task 4)
    ├── auth.js       # Auth ke backend + fallback akun lokal, session, proteksi route per peran
    ├── rooms.js      # Koleksi 9 ruangan resmi + penyimpanan persisten lokal (Task 3.5/4)
    ├── booking.js    # Modal pemesanan + aturan bisnis + struk PNG/WhatsApp (Task 2/3/3.5/3.9)
    ├── catalog.js    # Render grid kartu-gambar, filter, search, merge status API
    └── admin.js      # (Task 4) Logika panel admin: data, filter, hapus, CRUD ruangan
```

**Penyimpanan lokal (mode offline)** — agar perubahan bertahan setelah muat ulang dan terlihat oleh panel admin, `js/rooms.js` memakai empat kunci `localStorage`:

| Kunci | Isi |
| ----- | --- |
| `idb_bali_local_bookings` | Pengajuan/pemesanan yang dibuat pengguna dari katalog (termasuk status persetujuan) |
| `idb_bali_removed_seeds`  | Jadwal contoh (demo) yang dihapus admin |
| `idb_bali_rooms_state`    | Ruangan yang ditambah / diubah / dihapus admin |
| `idb_bali_booking_status` | Keputusan admin (**setujui / tolak**) atas jadwal contoh |

## Akun Demo (Dummy Authentication)

| Role     | NIM / NIDN | Password     | Diarahkan ke        |
| -------- | ---------- | ------------ | ------------------- |
| STUDENT  | `2026001`  | `password123`| `catalog.html`      |
| LECTURER | `2026002`  | `password123`| `catalog.html`      |

Input lain akan menampilkan error: **"NIM/NIDN atau Password salah."**

### Akun Admin (rahasia — khusus pemilik aplikasi)

| Role  | NIM / NIDN      | Password                | Diarahkan ke   |
| ----- | --------------- | ----------------------- | -------------- |
| ADMIN | `246120940015`  | `BUKANUNTUKSEMUAORANG`  | `admin.html`   |

Akun admin **sengaja tidak ditampilkan** di halaman login: tidak ada chip demo, tidak ada isian otomatis — kredensial harus diketik manual. Nama yang tampil tetap **Admin IDB Bali**. Lihat juga [Task 4 — Catatan Keamanan](#task-4--panel-admin-pemilik-aplikasi).

## Fitur Task 1

**Halaman Login**
- Desain modern 2 panel: branding kampus (kiri) + form (kanan)
- Field NIM/NIDN & Password dengan ikon, toggle lihat password, "Ingat saya"
- Validasi error + pesan "NIM/NIDN atau Password salah."
- Chip akun demo untuk isi otomatis
- Session disimpan di `localStorage` / `sessionStorage`

**Katalog Ruangan**
- Hanya bisa diakses setelah login (redirect otomatis ke `index.html`)
- Grid responsif (`auto-fill minmax`) — 4 kolom di desktop, 1 kolom di mobile
- 8 ruangan dalam 3 kategori: **Lab & Studio**, **Classroom**, **Area Publik**
- Tiap kartu: nama ruangan, kategori, kapasitas, kode ruangan, status badge, tombol **"Pesan Ruangan"**
- Badge status berwarna: 🟢 Tersedia / 🟠 Terpakai / 🔴 Pemeliharaan
- Filter kategori + pencarian real-time + statistik + toast + logout

## Task 2 — Booking Modal & Aturan Bisnis

**File baru/ubah:**
- `js/booking.js` (baru) — modal, dummy database pemesanan, semua validasi
- `catalog.html` — markup modal + `<script src="js/booking.js">` (dimuat sebelum `catalog.js`)
- `js/catalog.js` — status badge memakai `getRoomDayStatus()`, tombol pesan membuka modal
- `css/styles.css` — style modal, konflik, receipt, badge FULL

**Form pemesanan (modal):** Tanggal, Jam Mulai, Jam Selesai, Kepentingan (dropdown), Atas Nama (ter-isi otomatis dari session).

**Aturan bisnis:**
1. **Ruang kelas akhir pekan** — "Ruang Kelas Reguler 101/102" hanya boleh dipesan Sabtu & Minggu; hari Senin–Jumat menampilkan error sesuai spesifikasi dan tombol *Konfirmasi Pesanan* dinonaktifkan.
2. **Cegah bentrok** — `BOOKED_SLOTS` (array dummy simulasi database) berisi jadwal terisi; jika rentang yang dipilih menabrak, muncul badge merah **⚠ FULL / BENTROK** + daftar pemesanan yang menabrak, tombol konfirmasi dinonaktifkan.
3. **Badge FULL di grid** — ruangan yang terisi penuh (08.00–17.00) pada tanggal terpilih otomatis berubah menjadi badge merah **FULL / BOOKED**; badge & statistik mengikuti tanggal yang dipilih di modal.
4. **Receipt** — sukses submit menutup form dan menampilkan bukti: Booking ID (`RB-YYYYMMDD-XXXX`), ruang, tanggal, jam, kepentingan, atas nama; pemesanan langsung tersimpan sehingga slot yang sama tidak bisa dipesan ulang.
   > **Perbaruan (Task 5):** sejak alur persetujuan diaktifkan, pengajuan baru **tidak langsung aktif** — statusnya **"Menunggu Persetujuan"**, layar bukti menampilkan pengumuman pengajuan (struk baru bisa diunduh setelah admin menyetujui), dan tombol konfirmasi berlabel **"Ajukan Peminjaman"**. Rincian lengkap di [Task 5](#task-5--alur-persetujuan-peminjaman).

**Skenario demo (tanggal hari ini otomatis terisi):**
- *Lab Software Development* sudah dibooking **09.00–12.00** → coba pesan jam 10.00 = bentrok.
- *Studio Foto*, *Studio Pola*, *Ruang Kelas 101* full sehari → badge merah **FULL / BOOKED** di grid.
- Pesan *Ruang Kelas 102* pada hari Senin–Jumat = ditolak (aturan akhir pekan).

## Task 3.5 — Katalog Ruangan Visual (9 Fasilitas Resmi)

**File baru/ubah:**
- `js/rooms.js` (baru) — `ROOMS_DATA`: koleksi **tepat 9 ruangan** (id, nama, kategori, `weekend_only`, kapasitas, ikon, deskripsi, gambar, booking demo)
- `images/` (baru) — **foto asli tiap ruangan dari situs IDB Bali** (`https://www.idbbali.ac.id/fasilitas-kampus/`, file `.jpg`) + ilustrasi SVG sebagai fallback bila foto gagal dimuat (`<img onerror>` di atas kartu)
- `css/styles.css` — kartu berbasis gambar ala platform reservasi modern: `.room-image { object-fit: cover; height: 180px; }`, badge status menimpa gambar, efek zoom saat hover
- `catalog.html` — render `<img src="…" class="room-image">` di atas judul ruang; tab filter: Lab & Studio / Classroom / **Public Area**
- `js/catalog.js` — data dari `ROOMS_DATA`, status per tanggal dari backend bila aktif, kalau tidak dihitung lokal (mode offline)
- `js/booking.js` & `js/auth.js` — fallback lokal ketika backend Express belum aktif, sehingga seluruh alur Task 1–2 tetap jalan tanpa server
- `server.js` — seed 9 ruangan + kolom `image` disinkronkan agar cocok saat backend diaktifkan (langkah final)

**9 fasilitas (kategorisasi persis sesuai permintaan):**

| # | Ruangan | Kategori | Weekend Only |
|---|---------|----------|--------------|
| 1 | Lab Komputer | Lab & Studio | ❌ |
| 2 | Lab iMac | Lab & Studio | ❌ |
| 3 | Ruang Kelas (Reguler) | Classroom | ✅ |
| 4 | Lab Fashion Design | Lab & Studio | ❌ |
| 5 | Gedung Serba Guna (GSG) | Public Area | ❌ |
| 6 | Aula | Public Area | ❌ |
| 7 | Ruang Assistensi | Classroom | ❌ |
| 8 | Studio Foto | Lab & Studio | ❌ |
| 9 | Ruang Kelas Magister | Classroom | ✅ |

**Skenario demo Task 3.5:**
- *Studio Foto* & *Ruang Kelas (Reguler)* full sehari (Minggu) → badge 🔴 **FULL / BOOKED**; *Lab Komputer*, *Aula*, *Ruang Assistensi* → 🟠 **Terpakai**; sisanya 🟢 **Tersedia**.
- Pesan *Ruang Kelas Magister* / *Ruang Kelas (Reguler)* pada hari Senin–Jumat → error: *"Ruang Kelas Reguler hanya dapat digunakan pada hari Sabtu dan Minggu untuk sesi non-perkuliahan."*
- *Lab Komputer* 10.00–11.00 → preview **⚠ FULL / BENTROK** dengan jadwal 09.00–12.00; 13.00–15.00 lolos → receipt `RB-YYYYMMDD-XXXX`.
- Booking *Lab Fashion Design* 08.00–17.00 → badge grid langsung berubah **FULL / BOOKED** dan statistik "Tersedia" berkurang.

> **Mode offline vs backend:** frontend selalu mencoba `GET /api/rooms/status` terlebih dulu; jika backend Express (`server.js`) belum aktif, semua data & validasi dijalankan lokal dari `ROOMS_DATA` sehingga aplikasi tetap berfungsi penuh di `server.ps1` maupun via double-click `index.html`.

## Task 3.7 — Gambar & Video 3 Detik di Tampilan Awal

**File baru/ubah:**
- `images/hero-tampilan-awal.png` (baru) — gambar fasilitas kampus IDB Bali, 1080×365, diambil dari `https://www.idbbali.ac.id/wp-content/uploads/2022/11/idb-fasilitas.png`
- `media/hero-3detik.mp4` (baru) — **video 3 detik** (1080×364, H.264/avc1, ±412 KB) hasil animasi *ken-burns* dari gambar di atas
- `index.html` — blok `<figure class="auth-hero">` (gambar + `<video autoplay muted loop playsinline>`) di atas form login, ditambah skrip kecil: bila video gagal dimuat/diputar, elemen video dihapus sehingga gambar (poster) tetap tampil
- `css/styles.css` — `.auth-hero` (rasio 1080/365), animasi masuk **3 detik** (`authHeroIn`), caption di atas gradasi, plus dukungan `prefers-reduced-motion`
- `server.ps1` — MIME `.mp4` → `video/mp4` dan `.webm` → `video/webm`
- `server.js` — `app.use("/media", express.static(...))` agar video ikut tersaji saat backend Express aktif

**Cara kerja:**
- Halaman awal menampilkan hero: gambar sebagai poster sekaligus fallback, dan video 3 detik yang berputar otomatis (muted + loop) sehingga tampilan terasa "hidup".
- Video dibuat **tanpa ffmpeg**: di browser, gambar digambar ke `<canvas>` dengan animasi zoom/pan selama 3 detik, direkam `canvas.captureStream(30)` + `MediaRecorder` (`video/mp4;codecs=avc1`), lalu disimpan ke `media/hero-3detik.mp4`.
- Durasi hasil rekaman ±**3,03 detik** (perekaman real-time), loop otomatis sehingga terlihat mulus.

**Mengganti gambar/video:**
1. Timpa `images/hero-tampilan-awal.png` dengan gambar pilihan Bapak/Ibu (nama file dibuat sama).
2. Bila ingin video baru mengikuti gambar baru, jalankan ulang pembuatan video (canvas + MediaRecorder) — rasio canvas mengikuti dimensi gambar.

## Task 3.8 — Logo Resmi, Background Cinematic 6 Detik & Foto Mahasiswa

**File baru/ubah:**
- `images/logo-idb.png` (baru) — logo resmi IDB Bali (350×350 PNG, latar putih) yang diberikan pengguna; dipasang di 3 titik: panel brand halaman login (`index.html` `.brand-mark`), brand mobile login (`.auth-mobile-brand`), dan navbar katalog (`catalog.html` `.navbar__brand`)
- `images/hero-visit-kampus.jpg` (baru) — foto gedung kampus **1920×670** dari halaman `https://www.idbbali.ac.id/visit/` (og:image "Campus Tour")
- `media/hero-katalog-6detik.mp4` (baru) — **video cinematic 6 detik** (1280×448, H.264/avc1, ±1,5 MB) hasil animasi dari foto tersebut
- `images/mahasiswa.jpg` (baru) — foto mahasiswa (678×452) yang diberikan pengguna
- `catalog.html` — di section **"Katalog Fasilitas Kampus / Halo, Mahasiswa 👋"**: `<img>` fallback + `<video autoplay muted loop playsinline>` sebagai **background**, scrim gradasi navy, serta kartu foto mahasiswa (`.page-hero__photo`) di antara sapaan dan statistik
- `index.html` — kartu foto mahasiswa (`.auth-brand__photo`) di panel biru halaman login (tampil pada layar lebar > 980px)
- `css/styles.css` — `.brand-mark__logo-img` (+ `--sm`), `.page-hero__bg`, `.page-hero__scrim`, `.page-hero__photo`, `.auth-brand__photo`, serta aturan responsif ≤640px

**Cara kerja:**
- Background hero berlapis: foto statis (jika video gagal/gagal diputar, elemen video dihapus otomatis via `onerror` sehingga foto tetap tampil) → video 6 detik → scrim gradasi navy 58–90% agar teks putih tetap kontras → lingkaran aksen emas → konten (`z-index: 1`).
- Sentuhan *cinematic*: zoom pelan + pan (ken-burns), vignette, fade-in dari hitam 0,7 detik dan fade-out ke hitam 0,7 detik di akhir → loop mulus setiap 6 detik.
- Video dibuat **tanpa ffmpeg**: digambar ke `<canvas>` 1280×448, direkam `canvas.captureStream(30)` + `MediaRecorder` (`video/mp4;codecs=avc1.42E01E`), durasi terukur **5,999 detik** di browser (autoplay muted loop playsinline).
- Catatan Chrome: durasi MediaRecorder tampil bertahap (metadata awal ~3,6–3,9 detik → final 5,999 detik setelah buffer penuh); pemutaran tetap berjalan penuh sampai 6 detik.
- Semua gambar/video punya `onerror` fallback sehingga section tidak pernah kosong bila file gagal dimuat.

## Task 3.9 — Unduh Struk (PNG) & Bagikan ke WhatsApp

**File ubah:**
- `catalog.html` — di view **BUKTI PESANAN** (`#receiptView`) ditambah `<div class="receipt__actions">` berisi dua tombol: **Unduh Struk (PNG)** (`#receiptDownload`, ikon unduh) dan **Bagikan ke WhatsApp** (`#receiptWhatsapp`, ikon logo WhatsApp resmi)
- `css/styles.css` — `.receipt__actions` (grid 2 kolom, 1 kolom ≤520px), `.btn--wa` (hijau WhatsApp #25D366)
- `js/booking.js` — mesin struk PNG + handler aksi:
  - `lastReceipt` & `receiptRows(data)` — data struk dipakai bersama oleh modal dan PNG
  - `buildReceiptCanvas(data)` — menggambar struk ke `<canvas>` **720px super-sample 2× (1440px)**: header gradasi navy + pill emas "BUKTI PEMESANAN", kotak **Booking ID** bergaya karcis putus-putus, tabel rincian (label kiri abu-abu, nilai kanan tebal + wrap otomatis via `wrapLines`), garis putus-putus, footer *Pemesan • Dicetak (tanggal lokal)*; warna mengikuti variabel CSS aplikasi (navy/emas/ink)
  - `prepareReceiptPNG` — tunggu `document.fonts.ready` → `toBlob("image/png")`
  - `downloadBlobAsFile` — anchor `download` → file `struk-<BOOKING-ID>.png`
  - `receiptWaText(data)` — teks WhatsApp (format `*bold*`): bukti pemesanan + seluruh rincian
  - Dua listener tombol (lihat **Cara kerja**)

**Cara kerja:**
1. **Unduh Struk (PNG)** → canvas dirender → diunduh sebagai `struk-RB-YYYYMMDD-XXXX.png` + toast konfirmasi.
2. **Bagikan ke WhatsApp** → dua jalur otomatis:
   - **Utama:** bila `navigator.canShare({files})` didukung (HP/Chrome modern) → `navigator.share` membuka share sheet sistem; pengguna memilih WhatsApp → gambar struk + teks langsung terkirim. Dibatalkan pengguna = batal (tanpa aksi lanjutan).
   - **Fallback:** `window.open("https://wa.me/?text=…")` membuka WhatsApp dengan seluruh rincian struk, **dan** PNG ikut diunduh otomatis → pengguna tinggal melampirkan gambar ke pesan. Toast mengarahkan: *"lampirkan PNG yang baru diunduh"*.
   - Kode `onerror`/try-catch memastikan tombol tidak pernah error, hanya toast "coba lagi".

**Verifikasi (E2E di browser, booking `RB-20261020-6170` — Lab Komputer, Selasa 20 Oktober 2026, 10.00–11.00):**
- Struk modal menampilkan 6 baris rincian + kedua tombol baru.
- PNG dirender **1440×1182 px, 399.071 byte**; analisis piksel: header navy pekat, kotak ID, tabel, footer terbaca.
- Klik **Unduh** → file `struk-RB-20261020-6170.png` muncul di daftar unduhan browser, `state: completed`, toast muncul.
- **WhatsApp (fallback)** → `window.open` menerima `https://wa.me/?text=*BUKTI PEMESANAN RUANGAN*…Booking ID…` (lengkap, URL-encoded) + unduhan PNG kedua.
- **WhatsApp (share sheet)** → spy `navigator.share` menerima `files[0] = {name: struk-RB-20261020-6170.png, size: 399071, type: image/png}` + judul + teks.
- Modal tertutup normal setelah "Selesai"; tidak ada error JavaScript.

## Task 3.10 — Favicon Logo IDB Bali

**File ubah:** `index.html`, `catalog.html` — di `<head>` ditambahkan:

```html
<link rel="icon" type="image/png" href="images/logo-idb.png" />
<link rel="apple-touch-icon" href="images/logo-idb.png" />
```

- Ikon tab browser (favicon) kini memakai **logo resmi IDB Bali** (`images/logo-idb.png`, PNG 350×350) di kedua halaman — halaman login maupun katalog.
- `apple-touch-icon` ditambahkan agar logo juga tampil saat aplikasi di-*home screen* / dibuka dari ponsel.
- Verifikasi: link terdeteksi di DOM kedua halaman; file terlayani `200` dengan `Content-Type: image/png` (14.687 byte, magic-byte PNG valid).
- **Favicon transparan (perbaruan):** favicon kini memakai `images/logo-idb-transparent.png` — versi logo **tanpa background putih** (putih → alpha transparan dengan tepi halus/un-premultiply; 350×350, RGBA, 15.403 byte). Hasil piksel: 87% transparan penuh, 2% semi-transparan (anti-lace), 12% konten logo solid (warna asli terjaga, contoh sampel RGB 0,102,132 α255). `apple-touch-icon` sengaja **tetap memakai versi putih** agar tampil rapi di iOS (area transparan dirender hitam oleh sistem iOS).

**Verifikasi:**
- Navbar/login menampilkan logo (naturalWidth 350) — tak ada gambar rusak di kedua halaman.
- Background hero: video `paused: false`, `loop: true`, durasi 5,999 detik; foto 1920×670 terisi `object-fit: cover`.
- Layout hero tidak tumpang-tindih (teks → foto → statistik) dan tanpa scroll horizontal.
- Sumber daya termuat semua (satu-satunya 404 adalah `GET /api/rooms/status` yang memang backend Express belum dijalankan → fallback lokal aktif).

## Task 4 — Panel Admin (Pemilik Aplikasi)

Tampilan khusus **peran ADMIN** untuk memantau dan mengelola aplikasi tanpa menyentuh kode/data manual.

**File baru/ubah:**
- `admin.html` (baru) — halaman panel admin: sidebar (navy gradasi), topbar (nama admin, lencana mode data), 4 view, **modal tambah/edit ruangan**, **modal konfirmasi**, dan toast
- `js/admin.js` (baru) — route guard peran ADMIN, deteksi mode data, muat & render data, filter, hapus, CRUD ruangan, modal konfirmasi berbasis Promise
- `js/auth.js` — akun ADMIN milik pemilik aplikasi (`246120940015`) ditambahkan; redirect kini **berbasis peran** (`ADMIN` → `admin.html`, lainnya → `catalog.html`)
- `js/rooms.js` — lapisan **penyimpanan persisten** (lihat tabel di atas) + helper CRUD: `persistLocalBooking`, `deleteBookingData`, `adminAddRoom`, `adminUpdateRoom`, `adminRemoveRoom`
- `js/booking.js` — pemesanan kini ikut tersimpan (`persistLocalBooking`) sehingga bertahan setelah muat ulang dan tampil di panel admin
- `js/catalog.js` + `catalog.html` — tombol **"Panel Admin"** di navbar, hanya muncul untuk peran ADMIN
- `index.html` — chip demo akun **Admin sengaja TIDAK dipasang** (kredensial admin tidak ditampilkan maupun diisi otomatis di halaman login)
- `css/styles.css` — gaya panel admin (`.admin-shell`, `.admin-sidebar`, `.stat-tile`, `.panel`, `.admin-table`, `.f-chip`, `.tag`, `.room-manage-card`, `.btn--danger`, modal & responsif)
- `server.js` — akun admin di seed + endpoint admin (lihat di bawah)
- `js/api.js` — `adminStats`, `users`, `deleteBooking`, `createRoom`, `updateRoom`, `deleteRoom`

**Empat halaman dalam panel admin:**

| Tab | Isi |
| --- | --- |
| **Dashboard** | 9 kartu statistik (total ruangan, booking hari ini, total pemesanan, **menunggu persetujuan**, **peminjaman disetujui**, **pengajuan ditolak**, booking akhir pekan, pengguna terdaftar, ruangan terfavorit) + panel pintasan **pengajuan menunggu** + tabel **Booking Terbaru** (8 baris terakhir, kini dengan kolom **Status**) |
| **Pemesanan** | Tabel seluruh pengajuan semua pengguna + chip filter cepat (Semua / Hari Ini / Mendatang / Akhir Pekan) + **chip filter status** (Semua / Menunggu / Disetujui / Ditolak), pencarian teks (ID, ruang, nama, keperluan), filter per ruangan, filter per tanggal, kolom **Status**, dan aksi per baris: **Detail**, **Setujui** & **Tolak** (khusus pengajuan menunggu), **Hapus** |
| **Ruangan** | Kartu per ruangan (foto, kode, kategori, kapasitas, jumlah booking) + **Tambah / Edit / Hapus** ruangan lewat modal (kode ruangan otomatis dari nama, aturan akhir pekan, dsb.) |
| **Pengguna** | Daftar akun (NIM/NIDN, nama, peran berwarna, jumlah pemesanan) — dari akun lokal, atau dari backend bila aktif |

**Data & mode kerja:** panel menampilkan status mode di kanan atas — **"Mode Lokal (offline)"** (sumber: `js/rooms.js` + `localStorage`) atau **"Terhubung Backend"** (sumber `GET /api/bookings`, `GET /api/users`). Saat backend Express dijalankan, panel otomatis berpindah ke mode API dan memakai endpoint admin.

**Endpoint backend baru (`server.js`):**

| Method & path | Fungsi |
| ------------- | ------ |
| `GET /api/users` | Daftar pengguna + `booking_count` (SQL `LEFT JOIN` + `COUNT`) |
| `GET /api/admin/stats` | Ringkasan dashboard (total & hari ini & akhir pekan, ruangan terfavorit) |
| `DELETE /api/bookings/:id` | Hapus satu pemesanan |
| `POST /api/rooms` | Tambah ruangan (validasi kode unik, kapasitas ≥ 1) |
| `PUT /api/rooms/:id` | Ubah ruangan |
| `DELETE /api/rooms/:id` | Hapus ruangan (pemesanannya ikut terhapus via FK `CASCADE`) |

> Catatan demo: endpoint admin belum memakai middleware otorisasi (mengikuti pola endpoint lain di proyek ini). Pada produksi, setiap endpoint admin wajib memverifikasi sesi/token admin.

**Aturan & perlindungan:**
- Membuka `admin.html` **tanpa sesi** → dialihkan ke `index.html`; membukanya dengan sesi **non-ADMIN** (mis. mahasiswa/dosen) → dikembalikan ke `catalog.html` **tanpa menghapus sesi** (hak akses berbeda per peran, tetapi pengguna tidak dipaksa login ulang).
- Semua tindakan destruktif melewati **modal konfirmasi** (bisa dibatalkan, tombol ESC juga membatalkan); keputusan setujui/tolak juga dikonfirmasi.
- Hapus pemesanan contoh (demo) maupun pemesanan pengguna tersimpan persisten; hapus ruangan otomatis membersihkan pemesanan lokal terkait.

**Verifikasi (E2E di browser, semua lolos):**
1. **Login admin** `246120940015` / `BUKANUNTUKSEMUAORANG` (diketik manual — tidak ada chip maupun isi otomatis) → mendarat di `admin.html` dengan nama **Admin IDB Bali**; halaman login kini hanya menampilkan 2 chip (Mahasiswa & Dosen). Kombinasi lama `admin` / `admin123` maupun password yang salah ditolak dengan pesan "NIM/NIDN atau Password salah."
2. **Dashboard**: 9 ruangan, 7 pemesanan (5 hari ini), 3 pengguna, ruangan terfavorit "Ruang Assistensi (2×)"; 8 baris booking terbaru tampil.
3. **Filter**: Hari Ini = 5, Mendatang = 7, Akhir Pekan = 1, Semua = 7; pencarian "assistensi" = 2 hasil; filter ruangan Lab Komputer = 1 hasil.
4. **Hapus pemesanan**: modal konfirmasi tampil dengan teks lengkap (ruang, tanggal, jam) → "Batal" membatalkan tanpa perubahan; konfirmasi menghapus 7 → 6 dan bertahan setelah **reload halaman** (tersimpan di `idb_bali_removed_seeds`).
5. **Tambah ruangan**: "Ruang Sidang" → kode otomatis `RUANG-SIDANG`, 15 orang, akhir pekan saja → 9 → 10 ruangan, kartu tampil dengan benar.
6. **Edit ruangan**: diubah jadi "Ruang Sidang Utama", 20 orang, akhir pekan dilepas → kode ruangan terkunci (tidak bisa diubah saat edit); perubahan **bertahan setelah reload** dan ruangan baru ikut muncul di katalog mahasiswa serta di dropdown filter pemesanan.
7. **Hapus ruangan**: konfirmasi → 10 → 9 ruangan; `idb_bali_rooms_state` kembali bersih.
8. **Lintas peran (alur nyata)**: mahasiswa `2026001` memesan **Lab iMac, Rabu 21 Oktober 2026, 08.00–10.00** → struk `RB-20261021-6496` muncul dan tersimpan → login admin kembali → pemesanan tersebut terlihat di tab **Pemesanan** dan pengguna *Mahasiswa IDB* kini menunjukkan **1 booking**; menghapusnya mengosongkan `idb_bali_local_bookings` kembali ke `[]`.
9. **Tombol "Panel Admin"** di navbar katalog tampil hanya untuk peran ADMIN (tersembunyi untuk STUDENT) dan berhasil membuka `admin.html`.
10. **Keamanan peran**: setelah logout, sesi bersih; tampilan panel dirender tanpa error JavaScript.

**Tata letak responsif:** sidebar 252px + kolom konten (diperiksa: `grid-template-columns: 252px 928px`, nav vertikal, statistik 3 kolom). Di bawah lebar 900px panel otomatis menjadi satu kolom — brand + tombol di baris atas, navigasi jadi baris horizontal yang bisa digeser.

### Catatan Keamanan akses admin

- **Tidak ada petunjuk di UI:** chip demo, placeholder, dan teks bantuan mana pun di halaman login tidak menyebut akun admin. Pintu masuk hanya satu: mengetik NIM & password secara manual.
- **Mode offline punya batasan:** saat backend Express **belum** dijalankan, verifikasi password dilakukan di `js/auth.js`, sehingga password admin ikut terbaca bila seseorang membuka *page source* / DevTools. Dengan kata lain, panel admin tersembunyi dari pengguna biasa, tetapi belum aman secara kriptografi.
- **Untuk keamanan sungguhan, jalankan backend:** dengan `npm start` (Express + SQLite), password disimpan sebagai **hash scrypt** di `database.db`, password tidak pernah dikirim ke file JavaScript frontend, dan verifikasi dilakukan server-side lewat `POST /api/auth/login`. Pada langkah ini, panel otomatis berpindah ke **"Terhubung Backend"**.
- Saran lanjutan (untuk produksi): tambahkan middleware otorisasi yang memverifikasi token/sesi admin pada seluruh endpoint `/api/*` admin, dan hindari menyimpan sesi admin di `localStorage` bila aplikasi dipakai di perangkat bersama.

## Task 5 — Alur Persetujuan Peminjaman (Approval Workflow)

Setiap pemesanan kini menjadi **pengajuan** yang harus diputuskan admin. Hak akses berbeda per peran: mahasiswa/dosen **mengajukan & memantau**, admin **memeriksa, memutus & mengelola**. Login tetap memakai **NIM/NIDN + password sesuai jenis akun** (`2026001` STUDENT, `2026002` LECTURER, `246120940015` ADMIN) dengan penyimpanan data yang persisten.

**Status pengajuan:**

| Status | Label di UI | Arti |
| ------ | ----------- | ---- |
| `pending` | ⏳ Menunggu Persetujuan | Pengajuan baru; **slot sudah diamankan**, menunggu admin |
| `approved` | ✓ Disetujui | Peminjaman aktif; struk (PNG / WhatsApp) baru bisa diunduh |
| `rejected` | ✕ Ditolak | Ditolak admin (+ alasan); **slot langsung dibuka** untuk pemesanan lain |

**Fitur Mahasiswa & Dosen (`catalog.html`):**
- Melihat daftar ruangan (9 fasilitas) beserta **jadwal ketersediaannya** per tanggal (badge Tersedia / Terpakai / FULL·BOOKED).
- **Mengajukan peminjaman** lewat modal — status awal selalu *menunggu persetujuan*; layar bukti menampilkan Booking ID + catatan pengajuan, sedangkan tombol struk & WhatsApp disembunyikan sampai disetujui (ada tombol pintas **Lihat Riwayat Peminjaman**).
- **Melihat status pengajuan** lewat tombol navbar **Riwayat Saya**: ringkasan (jumlah menunggu / disetujui / ditolak), kartu per pengajuan (ruang, Booking ID, tanggal, jam, kepentingan, atas nama, badge status, catatan keputusan/alan), chip filter **Semua / Menunggu / Disetujui / Ditolak**, serta aksi **Unduh Struk (PNG)** dan **Bagikan ke WhatsApp** khusus yang sudah disetujui.
- **Melihat riwayat peminjaman** seluruh pengajuan miliknya (termasuk yang ditolak, beserta alasannya).
- **Pengecekan ketersediaan**: slot yang menabrak pengajuan *menunggu* maupun *disetujui* → kotak **⚠ FULL / BENTROK** lengkap dengan label status pemiliknya; pengajuan *ditolak* tidak menempati slot sehingga bisa diajukan ulang.

**Fitur Admin (`admin.html`):**
- **Melihat seluruh pengajuan** — tab Pemesanan dengan kolom **Status** + chip filter **Semua / ⏳ Menunggu / ✅ Disetujui / ❌ Ditolak** (jalan berdampingan dengan filter tanggal, ruang, dan pencarian teks).
- **Memeriksa detail pengajuan** — tombol **Detail** membuka modal berisi Booking ID, status, ruangan, tanggal, jam, kepentingan, atas nama, pemesan (nama + NIM), saat diajukan, keputusan (oleh siapa & kapan), dan alasan penolakan.
- **Menyetujui / menolak pengajuan** — tombol **Setujui** (konfirmasi emas) dan **Tolak** (konfirmasi merah + **alasan penolakan opsional**); keduanya juga tersedia di dalam modal detail, hanya untuk pengajuan berstatus *menunggu*.
- **Mengelola daftar ruangan & jadwal peminjaman** — CRUD ruangan (Task 4) dan hapus pemesanan per baris.
- **Melihat data peminjaman yang telah disetujui** — chip **✅ Disetujui**, plus 3 kartu statistik baru (Menunggu / Disetujui / Ditolak) dan panel pintasan **"Proses Pengajuan"** di dashboard (otomatis tersembunyi bila tidak ada yang menunggu).

**Penyimpanan & backend:**
- Mode offline: booking pengguna disimpan di `idb_bali_local_bookings` dengan `status`, `decided_at`, `decided_by`, `reject_reason`; keputusan atas jadwal contoh disimpan di `idb_bali_booking_status`. Data lama yang belum punya `status` otomatis dianggap **disetujui** (migrasi otomatis, tanpa kehilangan data).
- `server.js`: kolom `status`/`decided_at`/`decided_by`/`reject_reason` pada tabel `bookings` (dengan migrasi `ALTER TABLE` ringan untuk database lama), booking baru selalu `pending`, cek bentrok mengabaikan status `rejected`, statistik admin memuat jumlah per status, plus endpoint baru:

| Method & path | Fungsi |
| ------------- | ------ |
| `PATCH /api/bookings/:id/status` | Setujui (`approved`) / tolak (`rejected`) pengajuan beserta alasan |

**File ubah/tambah:** `catalog.html`, `js/catalog.js`, `js/booking.js`, `js/rooms.js`, `admin.html`, `js/admin.js`, `js/api.js`, `server.js`, `css/styles.css`.

**Verifikasi (E2E di browser, semua lolos):**
1. **Data contoh**: 7 pengajuan = 4 disetujui, 2 menunggu, 1 ditolak — dashboard admin menampilkan angka yang sama, panel "menunggu persetujuan" menampilkan Aula 13.00–17.00 (Dosen IDB).
2. **Riwayat mahasiswa** `2026001`: 3 pengajuan (1 menunggu / 1 disetujui / 1 ditolak), filter status mengembalikan jumlah tepat, tombol struk hanya muncul di yang disetujui.
3. **Ketersediaan**: mengajukan Ruang Assistensi 13.00–14.00 (ada pengajuan menunggu) → kotak **FULL / BENTROK** dengan label *(MENUNGGU PERSETUJUAN)* dan tidak ada data tersimpan; mengajukan 08.00–10.00 (pengajuan lama **ditolak**) → berhasil diajukan.
4. **Pengajuan baru** `RB-20261020-5408` → layar **"Pengajuan Terkirim! ⏳"**, catatan menunggu admin, aksi struk tersembunyi, toast `…menunggu persetujuan admin ⏳`, tersimpan di `idb_bali_local_bookings`.
5. **Admin menyetujui**: Detail → data lengkap → Setujui → konfirmasi → baris berubah *✓ Disetujui* (aksi Setujui/Tolak hilang), **bertahan setelah reload**, dan terlihat kembali oleh mahasiswa di Riwayat sebagai *Disetujui* lengkap dengan tombol Unduh Struk / WhatsApp.
6. **Admin menolak** jadwal contoh 13.00–14.00 dengan alasan → `reject_reason` tersimpan, statistik diperbarui, **slot langsung bebas** (cek konflik = 0), dan alasan tampil di riwayat mahasiswa.
7. **Hak akses per peran**: mahasiswa membuka `admin.html` → dikembalikan ke `catalog.html` **tanpa kehilangan sesi**; tanpa sesi → halaman login; sesi mahasiswa tidak memunculkan tombol Panel Admin.
8. **Kebersihan data**: data uji dihapus (booking uji + keputusan uji), aplikasi dikembalikan ke keadaan demo awal (7 pengajuan: 4 disetujui / 2 menunggu / 1 ditolak).

## Tampilan Mobile (Responsif)

Aplikasi dapat diakses dari ponsel dengan tata letak yang disesuaikan — bukan sekadar "mengecil":

| Bagian | Penyesuaian di ponsel |
| ------ | --------------------- |
| **Login** | Panel branding disembunyikan, diganti baris merek ringkas (**SIBORU · Sistem Booking Ruangan**), hero video 3 detik, form penuh selebar layar dengan tombol 48 px (nyaman disentuh) |
| **Navbar katalog** | Logo + nama sistem tetap tampil; tombol (Riwayat, Panel Admin, Keluar) menjadi ikon dengan `aria-label`/`title` agar tetap terbaca |
| **Hero katalog** | Tinggi diringkas (525 px → ±380 px) supaya kartu ruangan cepat terlihat; foto mahasiswa & kartu statistik dipadatkan |
| **Filter kategori** | Satu baris yang bisa digeser ke samping (tanpa turun baris) |
| **Kartu ruangan** | Satu kolom penuh, padding & tipografi disesuaikan |
| **Modal pemesanan/riwayat/detail** | Gaya *bottom sheet* (menempel bawah, sudut atas membulat), footer form **sticky** sehingga tombol "Ajukan Peminjaman" selalu terlihat, input selebar layar |
| **Panel admin** | Sidebar berubah menjadi bilah atas ringkas yang **menempel (sticky)** dengan menu yang bisa digeser; 9 kartu statistik tersusun 2 kolom |
| **Tabel admin** | Pada layar ≤ 640 px tabel berubah menjadi **kartu bertumpuk** dengan label per baris (`data-label`) — tanpa scroll horizontal, tombol Detail/Setujui/Tolak/Hapus selebar kartu |
| **Lain-lain** | `100dvh`/`93dvh` untuk browser ponsel, `safe-area-inset` (notch & bilah gestur iOS), dan animasi dimatikan bila pengguna memilih *reduce motion* |

**Verifikasi lebar layar** (iframe 320×640, 360×780, 390×844): **tidak ada scroll horizontal** di halaman login, katalog, dashboard, pemesanan, ruangan, maupun pengguna. Pengujian cepat bisa memakai `_mobile-test.html?p=catalog.html` (file bantu lokal, tidak ikut dipublikasikan).

## Deploy di Vercel

| Item | Nilai |
| ---- | ----- |
| URL produksi | **https://tugaswebsitejuan.vercel.app/** |
| Pratinjau mobile | https://tugaswebsitejuan.vercel.app/mobile.html |
| Repo | https://github.com/juanjuanhetom-byte/tugaswebsitejuan |

**Masalah awal:** Vercel mendeteksi `package.json` + `server.js` (Express) lalu memperlakukan proyek sebagai aplikasi Node. Setiap request memanggil function yang gagal → `500 FUNCTION_INVOCATION_FAILED` di semua URL.

**Perbaikan:**

| Berkas | Fungsi |
| ------ | ------ |
| `vercel.json` | `"framework": null`, `buildCommand`/`installCommand` kosong, `"outputDirectory": "."` → Vercel menyajikan repo sebagai **static site** (tanpa function). Ditambah header cache: HTML `must-revalidate`, CSS/JS `max-age=0, must-revalidate`, gambar/media `immutable`, serta `X-Robots-Tag: noindex` untuk `/admin` |
| `.vercelignore` | `server.js`, `server.ps1`, `package.json`, `tools/`, `README.md`, `_mobile-test.html` **tidak** diunggah — backend & berkas internal tidak bisa diakses publik |
| `js/api.js` | Pada host statis (`vercel.app`, `netlify.app`, `github.io`, `pages.dev`, `here.now`) client langsung memakai mode offline → **tidak ada request `/api/*` yang gagal**. Paksa mode API dengan `?online=1` |
| `index.html`, `catalog.html`, `admin.html` | Aset diberi versi (`?v=20261103`) agar perubahan CSS/JS langsung terpakai |

**Verifikasi di Vercel:** login mahasiswa → katalog 9 ruangan, gambar & video termuat, riwayat 3 pengajuan (1 menunggu/1 disetujui/1 ditolak), **0 request gagal**; login admin → dashboard 7 pemesanan (2/4/1) tanpa error; guard peran (`/admin.html` tanpa sesi → halaman login) berfungsi; `mobile.html` menampilkan pratinjau 390×844 dengan iframe ke origin yang sama.

> Catatan: aplikasi ini memakai `localStorage`, jadi data peminjaman bersifat **per-perangkat/per-browser**, tidak tersinkron antar pengguna. Untuk data terpusat, jalankan `server.js` (Express + SQLite) di host yang mendukung Node, lalu akses dengan `?online=1`.

## Publikasi (here.now) & Agar Ditemukan di Google

> **Status per 3 Nov 2026:** situs demo anonim di bawah sudah **kedaluwarsa** (here.now anonim hanya aktif 24 jam). Berkas proyek tetap lengkap dan siap diterbitkan ulang kapan saja — lihat *Menerbitkan ulang* di bawah.

| Item | Nilai |
| ---- | ----- |
| URL demo (kedaluwarsa) | ~~https://centered-larch-nws3.here.now/~~ (27–28 Okt 2026) |
| Jenis | Situs **anonim** here.now (aktif 24 jam) |
| Domain final | **https://siboru.idbbali.ac.id/** — canonical, OG, JSON-LD, `sitemap.xml`, dan `robots.txt` sudah diarahkan ke domain ini |

### Menerbitkan ulang (tanpa API key)

```powershell
# situs anonim baru (berlaku 24 jam) + tautan klaim baru
.\tools\publish.ps1

# atau perbarui situs milik akun here.now
.\tools\publish.ps1 -ApiKey "<API_KEY_HERE_NOW>" -Slug "<slug-situs>"
```

Skrip otomatis menyertakan `google*.html` (berkas verifikasi Search Console) dan menjaga `canonical`/`sitemap`/`robots` tetap mengarah ke `siboru.idbbali.ac.id`.

### Mengaktifkan `siboru.idbbali.ac.id`

DNS `idbbali.ac.id` dikelola **Cloudflare** (`huxley.ns.cloudflare.com`, `lina.ns.cloudflare.com`). Subdomain `siboru` belum ada, jadi urutannya:

1. **Klaim situs** lewat tautan klaim di atas (wajib — tanpa ini situs hilang dalam 24 jam dan domain kustom tidak bisa dipasang).
2. Di dasbor here.now: **Domains → Add custom domain → `siboru.idbbali.ac.id`**. here.now akan menampilkan **target CNAME** (mis. `xxxxx.here.now`).
3. Minta admin IT IDB (pemegang Cloudflare) menambahkan record:
   ```
   Type : CNAME
   Name : siboru
   Target: <target dari dasbor here.now>
   Proxy: DNS only (awan abu-abu) — agar SSL/TLS ditangani here.now
   ```
4. Tunggu propagasi (biasanya < 5 menit), lalu tekan **Verify/Refresh** di dasbor here.now sampai status domain **Active**.
5. Setelah domain aktif, verifikasi Google Search Console memakai properti **Domain** (TXT) atau **URL prefix** + token HTML:
   ```powershell
   .\tools\publish.ps1 -Domain "https://siboru.idbbali.ac.id/" `
       -GoogleVerification "TOKEN_DARI_GSC" -ApiKey "<API_KEY_HERE_NOW>"
   ```
   lalu kirim `https://siboru.idbbali.ac.id/sitemap.xml` di Search Console.

> Untuk memperbarui situs setelah diklaim, gunakan **API key** here.now (dasbor → Settings → API keys) dengan `-ApiKey`; `-ClaimToken` hanya berlaku untuk situs anonim.

**Berkas verifikasi Google Search Console:** `googlebb7aaef64b9c8b41.html` (isi: `google-site-verification: googlebb7aaef64b9c8b41.html`) sudah ada di akar proyek dan otomatis ikut terunggah oleh `tools/publish.ps1` (pola `google*.html`). Verifikasi HTML seperti ini berlaku untuk properti **URL prefix**; untuk properti **Domain** gunakan record TXT `google-site-verification=…` di Cloudflare.

**Skrip publikasi ulang** — `tools/publish.ps1` (PowerShell, tanpa Node):

```powershell
# Pratinjau berkas yang akan diunggah (tidak mengunggah)
.\tools\publish.ps1 -DryRun

# Ganti domain final saja (canonical, OG, sitemap, robots) tanpa menerbitkan
.\tools\publish.ps1 -Domain "https://siboru.idbbali.ac.id/" -SetDomainOnly

# Sisipkan token Google Search Console + terbitkan ulang (perlu API key here.now)
.\tools\publish.ps1 -Domain "https://siboru.idbbali.ac.id/" `
    -GoogleVerification "TOKEN_DARI_GSC" -ApiKey "<API_KEY_HERE_NOW>"

# Terbitkan ulang tanpa mengubah domain (situs anonim: pakai -ClaimToken saat baru dibuat)
.\tools\publish.ps1 -ApiKey "<API_KEY_HERE_NOW>"
```

Skrip ini otomatis: memperbarui `canonical`/`og:url`/`og:image`/`twitter:image`/JSON-LD/`sitemap.xml`/`robots.txt` saat `-Domain` dipakai, menyisipkan `<meta name="google-site-verification">` (idempoten), dan **ikut mengunggah berkas `google*.html`** yang Anda letakkan di folder akar.

> **Catatan keamanan publikasi:** pada versi statis, akun demo (termasuk NIM & password admin) tersimpan di `js/auth.js` karena autentikasi berjalan di sisi klien. Siapa pun yang membuka situs dapat membaca berkas JS tersebut. Untuk pemakaian nyata, gunakan backend (`server.js`) dengan hash password + sesi, atau batasi akses situs (password/undangan) di dasbor here.now.

### SEO yang sudah terpasang

| Berkas / tag | Fungsi |
| ------------ | ------ |
| `<title>` + `<meta name="description">` | Menampilkan nama **SIBORU — Sistem Booking Ruangan** pada hasil pencarian |
| `<meta name="keywords">`, `author`, `application-name` | Sinyal nama merek & institusi |
| `<link rel="canonical">` | Mencegah konten ganda antar-URL |
| Open Graph + Twitter Card | Pratinjau rapi saat tautan dibagikan (WhatsApp, X, dsb.) |
| JSON-LD `WebApplication` | Google membaca entitas **SIBORU** sebagai aplikasi web (nama, deskripsi, penerbit IDB Bali) |
| JSON-LD `BreadcrumbList` (katalog) | Struktur navigasi untuk hasil pencarian |
| `robots.txt` | Mengizinkan crawler, menutup `/admin.html` |
| `sitemap.xml` | Peta URL untuk Google Search Console |
| `site.webmanifest` | Nama **SIBORU** + ikon saat dipasang ke layar utama ponsel |
| `404.html` | Halaman 404 bermerek (status 404 yang benar) |
| `<meta name="robots" content="noindex">` di `admin.html` | Panel admin tidak diindeks mesin pencari |

### Langkah agar muncul saat orang mencari "SIBORU"

1. **Jadikan situs permanen.** Buka tautan klaim di atas, masuk/daftar here.now. Situs anonim 24 jam **tidak akan diindeks** Google karena sudah mati sebelum crawler datang.
2. **Pakai URL yang stabil & mudah diingat.** Setelah punya akun, aktifkan *vanity URL* (mis. `siboru.here.now`) atau pasang domain kustom (paling kuat: `siboru.idbbali.ac.id`). Domain yang mengandung kata kunci "siboru" sangat membantu peringkat.
3. **Daftarkan ke Google Search Console** (`search.google.com/search-console`) dengan domain/URL situs, lalu **kirim `sitemap.xml`**.
4. **Minta indeks** lewat *URL Inspection → Request indexing* untuk halaman `/` dan `/catalog.html`.
5. **Tunggu 3–14 hari.** Indeks pertama biasanya muncul dalam beberapa hari; peringkat nama merek butuh waktu lebih lama.
6. **Perkuat sinyal merek:** tautkan situs dari halaman kampus/Instagram/organisasi (backlink), dan pastikan nama "SIBORU" ditulis konsisten di judul, deskripsi, dan konten.

> Catatan jujur: mesin pencari **tidak bisa** "dipaksa" menampilkan situs hanya karena judulnya SIBORU. Google tetap butuh URL permanen, indeks, dan sinyal otoritas. Selama memakai situs anonim 24 jam, pencarian nama tidak akan berfungsi — halaman harus permanen dulu.

