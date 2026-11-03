/* =========================================================
   SIBORU — Sistem Booking Ruangan (IDB Bali)
   Backend : Node.js + Express + SQLite (modul bawaan node:sqlite)
   Jalankan : node server.js   (atau npm start)
   Aplikasi : http://localhost:3000
   ========================================================= */

const path = require("path");
const crypto = require("crypto");
const express = require("express");
const { DatabaseSync } = require("node:sqlite");

const PORT = process.env.PORT || 3000;
const OPS_OPEN = "08:00";   // jam operasional kampus
const OPS_CLOSE = "17:00";

/* =========================================================
   1. KONEKSI & SKEMA DATABASE (SQLite)
   ========================================================= */
const db = new DatabaseSync(path.join(__dirname, "database.db"));

db.exec("PRAGMA journal_mode = WAL;");
db.exec("PRAGMA foreign_keys = ON;");

db.exec(`
  CREATE TABLE IF NOT EXISTS users (
    id            INTEGER PRIMARY KEY AUTOINCREMENT,
    nim_nidn      TEXT    NOT NULL UNIQUE,
    password_hash TEXT    NOT NULL,
    role          TEXT    NOT NULL CHECK (role IN ('STUDENT','LECTURER','ADMIN')),
    full_name     TEXT    NOT NULL
  );

  CREATE TABLE IF NOT EXISTS rooms (
    id           TEXT    PRIMARY KEY,
    name         TEXT    NOT NULL,
    category     TEXT    NOT NULL,
    weekend_only INTEGER NOT NULL DEFAULT 0 CHECK (weekend_only IN (0,1)),
    capacity     INTEGER NOT NULL DEFAULT 0,
    icon         TEXT    NOT NULL DEFAULT '🏫',
    image        TEXT    NOT NULL DEFAULT '',
    description  TEXT    NOT NULL DEFAULT '',
    status       TEXT    NOT NULL DEFAULT 'Tersedia'  -- 'Tersedia' | 'Pemeliharaan'
  );

  CREATE TABLE IF NOT EXISTS bookings (
    id               TEXT    PRIMARY KEY,
    user_id          INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    room_id          TEXT    NOT NULL REFERENCES rooms(id) ON DELETE CASCADE,
    booking_date     TEXT    NOT NULL,
    start_time       TEXT    NOT NULL,
    end_time         TEXT    NOT NULL,
    purpose          TEXT    NOT NULL,
    organization_name TEXT   NOT NULL,
    status           TEXT    NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','approved','rejected')),
    decided_at       TEXT,
    decided_by       TEXT,
    reject_reason    TEXT,
    created_at       TEXT    NOT NULL DEFAULT (datetime('now','localtime'))
  );

  CREATE INDEX IF NOT EXISTS idx_bookings_room_date ON bookings (room_id, booking_date);
  CREATE INDEX IF NOT EXISTS idx_bookings_user      ON bookings (user_id);
`);

/* Migrasi ringan untuk database yang dibuat sebelum Task 5 */
[
  "ALTER TABLE bookings ADD COLUMN status TEXT NOT NULL DEFAULT 'pending'",
  "ALTER TABLE bookings ADD COLUMN decided_at TEXT",
  "ALTER TABLE bookings ADD COLUMN decided_by TEXT",
  "ALTER TABLE bookings ADD COLUMN reject_reason TEXT",
].forEach((sql) => {
  try { db.exec(sql); } catch { /* kolom sudah ada */ }
});
db.exec("UPDATE bookings SET status = 'approved' WHERE status IS NULL OR status = ''");

/* =========================================================
   2. UTILITAS PASSWORD (scrypt — tanpa dependensi eksternal)
   ========================================================= */
function hashPassword(plain) {
  const salt = crypto.randomBytes(16).toString("hex");
  const hash = crypto.scryptSync(plain, salt, 64).toString("hex");
  return `scrypt$${salt}$${hash}`;
}

function verifyPassword(plain, stored) {
  try {
    const [algo, salt, hash] = String(stored).split("$");
    if (algo !== "scrypt" || !salt || !hash) return false;
    const test = crypto.scryptSync(plain, salt, 64);
    return crypto.timingSafeEqual(Buffer.from(hash, "hex"), test);
  } catch {
    return false;
  }
}

/* =========================================================
   3. SEED DATA (sekali jalan — hanya bila tabel masih kosong)
   ========================================================= */
const todayISO = (() => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
})();

/** Format Date -> YYYY-MM-DD memakai waktu lokal server */
function formatLocalDate(d) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function addDaysISO(iso, days) {
  const d = new Date(iso + "T00:00:00");
  d.setDate(d.getDate() + days);
  return formatLocalDate(d);
}

function nextWeekendISO() {
  let d = todayISO;
  for (let i = 0; i < 7; i++) {
    const day = new Date(d + "T00:00:00").getDay();
    if (day === 0 || day === 6) return d;
    d = addDaysISO(d, 1);
  }
  return todayISO;
}

function seedDatabase() {
  // --- users ---
  const userCount = db.prepare("SELECT COUNT(*) AS n FROM users").get().n;
  if (userCount === 0) {
    const insertUser = db.prepare(
      "INSERT INTO users (nim_nidn, password_hash, role, full_name) VALUES (?, ?, ?, ?)"
    );
    insertUser.run("2026001", hashPassword("password123"), "STUDENT", "Mahasiswa IDB");
    insertUser.run("2026002", hashPassword("password123"), "LECTURER", "Dosen IDB");
    insertUser.run("246120940015", hashPassword("BUKANUNTUKSEMUAORANG"), "ADMIN", "Admin IDB Bali");
    console.log("[seed] 3 akun dibuat (2026001 / 2026002 — password123 | 246120940015 — akun admin, tanpa chip demo)");
  }

  // --- rooms (9 fasilitas — Task 3.5) ---
  const roomCount = db.prepare("SELECT COUNT(*) AS n FROM rooms").get().n;
  if (roomCount === 0) {
    const insertRoom = db.prepare(
      `INSERT INTO rooms (id, name, category, weekend_only, capacity, icon, image, description, status)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
    );
    const ROOM_SEED = [
      ["LAB-KOMPUTER", "Lab Komputer",           "Lab & Studio", 0, 40,  "💻", "images/lab-komputer.jpg",      "Laboratorium komputer berspesifikasi terbaru dengan jaringan kampus berkecepatan tinggi.", "Tersedia"],
      ["LAB-IMAC",     "Lab iMac",               "Lab & Studio", 0, 24,  "🖥️", "images/lab-imac.jpg",          "Workstation grafis Apple OSX M1/M2 untuk desain, editing, dan animasi.", "Tersedia"],
      ["CLS-REGULER",  "Ruang Kelas (Reguler)",  "Classroom",    1, 36,  "🏫", "images/ruang-kelas-reguler.jpg", "Ruang kelas teori standar ber-AC, lengkap dengan proyektor dan whiteboard.", "Tersedia"],
      ["LAB-FASHION",  "Lab Fashion Design",     "Lab & Studio", 0, 20,  "✂️", "images/lab-fashion-design.jpg", "Studio desain busana dengan meja pola, manekin, dan peralatan jahit lengkap.", "Tersedia"],
      ["PUB-GSG",      "Gedung Serba Guna (GSG)","Public Area",  0, 300, "🏛️", "images/gsg.jpg",                "Gedung kampus bertingkat untuk area parkir dan penyelenggaraan acara berskala besar.", "Tersedia"],
      ["PUB-AULA",     "Aula",                   "Public Area",  0, 250, "🎤", "images/aula.jpg",               "Aula seminar utama dengan kursi konferensi dan layar presentasi besar.", "Tersedia"],
      ["CLS-ASSIST",   "Ruang Assistensi",       "Classroom",    0, 10,  "💬", "images/ruang-assistensi.jpg",   "Ruang diskusi kecil untuk asistensi mahasiswa, bimbingan, dan konsultasi ide.", "Tersedia"],
      ["STU-FOTO",     "Studio Foto",            "Lab & Studio", 0, 20,  "📷", "images/studio-foto.jpg",        "Studio fotografi lengkap dengan lampu studio, backdrop, dan tripod kamera.", "Tersedia"],
      ["CLS-MAGISTER", "Ruang Kelas Magister",   "Classroom",    1, 30,  "🎓", "images/ruang-kelas-magister.jpg", "Ruang kelas magister premium untuk kelas Master Digital Business.", "Tersedia"],
    ];
    ROOM_SEED.forEach((r) => insertRoom.run(...r));
    console.log("[seed] 9 ruangan kampus dibuat");
  }

  // --- bookings ( simulasi jadwal yang sudah terisi ) ---
  const bookingCount = db.prepare("SELECT COUNT(*) AS n FROM bookings").get().n;
  if (bookingCount === 0) {
    const student = db.prepare("SELECT id FROM users WHERE nim_nidn = '2026001'").get();
    const lecturer = db.prepare("SELECT id FROM users WHERE nim_nidn = '2026002'").get();
    const insertBooking = db.prepare(
      `INSERT INTO bookings (id, user_id, room_id, booking_date, start_time, end_time, purpose, organization_name, status)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
    );
    const SEED = [
      ["BK-0001", student.id,  "LAB-KOMPUTER", todayISO,               "09:00", "12:00", "Bimbingan", "Kelompok Praktikum A", "approved"],
      ["BK-0002", student.id,  "LAB-IMAC", addDaysISO(todayISO, 1),     "10:00", "13:00", "Kelas Tambahan", "Kelas Ekstensi Semester", "approved"],
      ["BK-0003", lecturer.id, "STU-FOTO", todayISO,                    "08:00", "17:00", "Kelas Tambahan", "HMJ Fotografi", "approved"],
      ["BK-0004", lecturer.id, "CLS-REGULER", nextWeekendISO(),         "08:00", "17:00", "Keperluan Organisasi BEM/HMJ", "Panitia LDK IDB Bali", "approved"],
      ["BK-0005", student.id,  "PUB-AULA", todayISO,                    "13:00", "17:00", "Keperluan Organisasi BEM/HMJ", "BEM IDB Bali", "pending"],
      ["BK-0006", lecturer.id, "CLS-ASSIST", todayISO,                  "08:00", "10:00", "Bimbingan", "Dosen Pembimbing", "rejected"],
    ];
    SEED.forEach((b) => insertBooking.run(...b));
    console.log("[seed] 6 jadwal contoh dibuat (4 disetujui, 1 menunggu, 1 ditolak)");
  }
}
seedDatabase();

/* =========================================================
   4. HELPERS
   ========================================================= */
const toMinutes = (t) => {
  const [h, m] = t.split(":").map(Number);
  return h * 60 + m;
};

const isDateISO = (s) => {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(s));
  if (!m) return false;
  const d = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
  return (
    d.getFullYear() === Number(m[1]) &&
    d.getMonth() === Number(m[2]) - 1 &&
    d.getDate() === Number(m[3])
  );
};

const isTimeHHMM = (s) => /^([01]\d|2[0-3]):[0-5]\d$/.test(s);

const isWeekendISO = (iso) => {
  const day = new Date(iso + "T00:00:00").getDay();
  return day === 0 || day === 6;
};

/** Apakah daftar booking menutup penuh jam operasional (08.00-17.00)? */
function isFullyBooked(bookings) {
  const intervals = bookings
    .map((b) => [toMinutes(b.start_time), toMinutes(b.end_time)])
    .sort((a, b) => a[0] - b[0]);

  const close = toMinutes(OPS_CLOSE);
  let cursor = toMinutes(OPS_OPEN);

  for (const [s, e] of intervals) {
    if (s > cursor) return false; // masih ada celah
    cursor = Math.max(cursor, e);
    if (cursor >= close) return true;
  }
  return cursor >= close;
}

function generateBookingId(iso) {
  const stamp = iso.replace(/-/g, "");
  let id;
  do {
    id = `RB-${stamp}-${Math.floor(1000 + Math.random() * 9000)}`;
  } while (db.prepare("SELECT 1 FROM bookings WHERE id = ?").get(id));
  return id;
}

const selectRoom = db.prepare("SELECT * FROM rooms WHERE id = ?");
const selectBookingsByRoomDate = db.prepare(
  `SELECT b.id, b.start_time, b.end_time, b.purpose, b.organization_name,
          b.user_id, b.status, u.full_name, u.nim_nidn, u.role
     FROM bookings b
     JOIN users u ON u.id = b.user_id
    WHERE b.room_id = ? AND b.booking_date = ?
      AND b.status != 'rejected'
    ORDER BY b.start_time`
);

/** Susun payload status ruangan untuk satu tanggal */
function roomStatusPayload(room, date) {
  const bookings = selectBookingsByRoomDate.all(room.id, date);
  const isFull = isFullyBooked(bookings);

  let status = "Tersedia";
  let statusKey = "available";
  if (room.status !== "Tersedia") {
    status = room.status;            // Pemeliharaan
    statusKey = "maintenance";
  } else if (isFull) {
    status = "FULL / BOOKED";
    statusKey = "full";
  }

  return {
    id: room.id,
    name: room.name,
    category: room.category,
    weekend_only: room.weekend_only === 1,
    capacity: room.capacity,
    icon: room.icon,
    image: room.image,
    description: room.description,
    room_status: room.status,
    is_full: isFull,
    status,
    status_key: statusKey,
    bookings,
  };
}

const CATEGORY_ORDER = { "Lab & Studio": 0, "Classroom": 1, "Public Area": 2 };

function allRoomsStatus(date) {
  return db
    .prepare("SELECT * FROM rooms")
    .all()
    .sort(
      (a, b) =>
        (CATEGORY_ORDER[a.category] ?? 9) - (CATEGORY_ORDER[b.category] ?? 9) ||
        a.name.localeCompare(b.name)
    )
    .map((room) => roomStatusPayload(room, date));
}

/* =========================================================
   5. API
   ========================================================= */
const app = express();
app.use(express.json());

// Static assets frontend (tanpa membocorkan server.js / database.db)
app.use("/css", express.static(path.join(__dirname, "css")));
app.use("/js", express.static(path.join(__dirname, "js")));
app.use("/images", express.static(path.join(__dirname, "images")));
app.use("/media", express.static(path.join(__dirname, "media")));
app.get("/", (_req, res) => res.sendFile(path.join(__dirname, "index.html")));
app.get("/catalog.html", (_req, res) => res.sendFile(path.join(__dirname, "catalog.html")));
app.get("/admin.html", (_req, res) => res.sendFile(path.join(__dirname, "admin.html")));

/* ---------- GET /api/health ---------- */
app.get("/api/health", (_req, res) => {
  res.json({ status: "success", data: { uptime: process.uptime(), db: "sqlite" } });
});

/* ---------- POST /api/auth/login ---------- */
app.post("/api/auth/login", (req, res) => {
  const { nim_nidn, password } = req.body || {};

  if (!nim_nidn || !password) {
    return res
      .status(400)
      .json({ status: "error", message: "NIM/NIDN dan Password wajib diisi." });
  }

  const user = db
    .prepare("SELECT id, nim_nidn, password_hash, role, full_name FROM users WHERE nim_nidn = ?")
    .get(String(nim_nidn).trim());

  if (!user || !verifyPassword(String(password), user.password_hash)) {
    return res
      .status(401)
      .json({ status: "error", message: "NIM/NIDN atau Password salah." });
  }

  delete user.password_hash;
  res.json({ status: "success", data: { user } });
});

/* ---------- GET /api/rooms/status?date=YYYY-MM-DD ---------- */
app.get("/api/rooms/status", (req, res) => {
  const date = req.query.date || todayISO;

  if (!isDateISO(date)) {
    return res.status(400).json({
      status: "error",
      message: "Format tanggal tidak valid. Gunakan format YYYY-MM-DD.",
    });
  }

  res.json({
    status: "success",
    data: { date, rooms: allRoomsStatus(date) },
  });
});

/* ---------- GET /api/bookings (opsional: filter user/tanggal) ---------- */
app.get("/api/bookings", (req, res) => {
  const { user_id, date, room_id } = req.query;
  const clauses = [];
  const params = [];

  if (user_id) { clauses.push("b.user_id = ?"); params.push(Number(user_id)); }
  if (date) {
    if (!isDateISO(date)) {
      return res.status(400).json({ status: "error", message: "Format tanggal tidak valid." });
    }
    clauses.push("b.booking_date = ?"); params.push(date);
  }
  if (room_id) { clauses.push("b.room_id = ?"); params.push(String(room_id)); }

  const rows = db.prepare(
    `SELECT b.*, u.full_name, u.nim_nidn, u.role, r.name AS room_name
       FROM bookings b
       JOIN users  u ON u.id = b.user_id
       JOIN rooms  r ON r.id = b.room_id
      ${clauses.length ? "WHERE " + clauses.join(" AND ") : ""}
      ORDER BY b.booking_date DESC, b.start_time ASC`
  ).all(...params);

  res.json({ status: "success", data: { bookings: rows } });
});

/* =========================================================
   POST /api/bookings — inti transaksi anti-bentrok
   ========================================================= */
app.post("/api/bookings", (req, res) => {
  const body = req.body || {};
  const roomId = String(body.room_id || "").trim();
  const date = String(body.booking_date || "").trim();
  const start = String(body.start_time || "").trim();
  const end = String(body.end_time || "").trim();
  const purpose = String(body.purpose || "").trim();
  const organizationName = String(body.organization_name || "").trim();
  const userId = Number(body.user_id);

  // ---- Validasi input dasar ----
  if (!roomId || !date || !start || !end || !purpose || !organizationName || !userId) {
    return res.status(400).json({
      status: "error",
      message: "Data pemesanan belum lengkap (ruang, tanggal, jam, keperluan, dan pengirim wajib diisi).",
    });
  }
  if (!isDateISO(date)) {
    return res.status(400).json({
      status: "error",
      message: "Format tanggal tidak valid. Gunakan format YYYY-MM-DD.",
    });
  }
  if (!isTimeHHMM(start) || !isTimeHHMM(end)) {
    return res.status(400).json({
      status: "error",
      message: "Format jam tidak valid. Gunakan format HH:MM.",
    });
  }
  if (toMinutes(end) <= toMinutes(start)) {
    return res.status(400).json({
      status: "error",
      message: "Jam Selesai harus lebih besar daripada Jam Mulai.",
    });
  }

  const room = selectRoom.get(roomId);
  if (!room) {
    return res.status(404).json({ status: "error", message: "Ruangan tidak ditemukan." });
  }
  const user = db.prepare("SELECT id FROM users WHERE id = ?").get(userId);
  if (!user) {
    return res.status(404).json({ status: "error", message: "Pengguna tidak ditemukan." });
  }

  // ---- Aturan 1: ruang kelas hanya akhir pekan ----
  if (room.weekend_only === 1 && !isWeekendISO(date)) {
    return res.status(400).json({
      status: "error",
      message:
        "Ruang Kelas Reguler hanya dapat digunakan pada hari Sabtu dan Minggu untuk sesi non-perkuliahan.",
    });
  }

  // ---- Transaksi ketat: cek bentrok lalu insert ----
  try {
    db.exec("BEGIN IMMEDIATE");

    // Overlap: (Requested_Start < Existing_End) AND (Requested_End > Existing_Start)
    // Booking yang DITOLAK tidak menempati slot sehingga bisa diajukan ulang.
    const overlap = db
      .prepare(
        `SELECT id, start_time, end_time, organization_name, status
           FROM bookings
          WHERE room_id = ?
            AND booking_date = ?
            AND start_time < ?
            AND end_time   > ?
            AND status != 'rejected'
          LIMIT 1`
      )
      .get(roomId, date, end, start);

    if (overlap) {
      db.exec("ROLLBACK");
      return res.status(409).json({
        status: "error",
        message:
          "FULL / BENTROK: Ruangan telah dipesan / diajukan peminjaman lain pada slot waktu tersebut (menunggu persetujuan atau sudah disetujui).",
        conflict: {
          booking_id: overlap.id,
          start_time: overlap.start_time,
          end_time: overlap.end_time,
          organization_name: overlap.organization_name,
          status: overlap.status,
        },
      });
    }

    const bookingId = generateBookingId(date);
    // Task 5: pengajuan baru selalu berstatus "menunggu persetujuan" admin
    db.prepare(
      `INSERT INTO bookings (id, user_id, room_id, booking_date, start_time, end_time, purpose, organization_name, status)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'pending')`
    ).run(bookingId, userId, roomId, date, start, end, purpose, organizationName);

    db.exec("COMMIT");

    return res.status(201).json({
      status: "success",
      message: "Pengajuan peminjaman terkirim — menunggu persetujuan admin.",
      data: {
        booking_id: bookingId,
        room_id: roomId,
        room_name: room.name,
        booking_date: date,
        start_time: start,
        end_time: end,
        purpose,
        organization_name: organizationName,
        status: "pending",
      },
    });
  } catch (err) {
    try { db.exec("ROLLBACK"); } catch { /* sudah rollback */ }
    console.error("[bookings] error:", err);
    return res.status(500).json({
      status: "error",
      message: "Terjadi kesalahan pada server saat menyimpan pemesanan.",
    });
  }
});

/* =========================================================
   ADMIN API (Task 4) — dipakai panel admin (admin.html)
   Catatan demo: tanpa middleware otorisasi; pada produksi
   setiap endpoint wajib memverifikasi sesi/token admin.
   ========================================================= */

/* ---------- GET /api/users — daftar pengguna + jumlah booking ---------- */
app.get("/api/users", (_req, res) => {
  const users = db
    .prepare(
      `SELECT u.id, u.nim_nidn, u.role, u.full_name, COUNT(b.id) AS booking_count
         FROM users u
         LEFT JOIN bookings b ON b.user_id = u.id
        GROUP BY u.id
        ORDER BY u.id`
    )
    .all();
  res.json({ status: "success", data: { users } });
});

/* ---------- GET /api/admin/stats — ringkasan dashboard ---------- */
app.get("/api/admin/stats", (_req, res) => {
  const count = (sql, ...params) => db.prepare(sql).get(...params).n;
  const topRoom = db
    .prepare(
      `SELECT r.name, COUNT(*) AS n
         FROM bookings b JOIN rooms r ON r.id = b.room_id
        GROUP BY b.room_id
        ORDER BY n DESC
        LIMIT 1`
    )
    .get();
  res.json({
    status: "success",
    data: {
      total_rooms: count("SELECT COUNT(*) AS n FROM rooms"),
      total_users: count("SELECT COUNT(*) AS n FROM users"),
      total_bookings: count("SELECT COUNT(*) AS n FROM bookings"),
      pending_bookings: count("SELECT COUNT(*) AS n FROM bookings WHERE status = 'pending'"),
      approved_bookings: count("SELECT COUNT(*) AS n FROM bookings WHERE status = 'approved'"),
      rejected_bookings: count("SELECT COUNT(*) AS n FROM bookings WHERE status = 'rejected'"),
      today_bookings: count("SELECT COUNT(*) AS n FROM bookings WHERE booking_date = ?", todayISO),
      weekend_bookings: count("SELECT COUNT(*) AS n FROM bookings WHERE strftime('%w', booking_date) IN ('0','6')"),
      top_room: topRoom ? { name: topRoom.name, count: topRoom.n } : null,
    },
  });
});

/* ---------- DELETE /api/bookings/:id — hapus pemesanan ---------- */
app.delete("/api/bookings/:id", (req, res) => {
  const id = String(req.params.id);
  const existing = db.prepare("SELECT id FROM bookings WHERE id = ?").get(id);
  if (!existing) {
    return res.status(404).json({ status: "error", message: "Pemesanan tidak ditemukan." });
  }
  db.prepare("DELETE FROM bookings WHERE id = ?").run(id);
  res.json({ status: "success", message: "Pemesanan dihapus." });
});

/* ---------- PATCH /api/bookings/:id/status — setujui / tolak pengajuan (Task 5) ---------- */
app.patch("/api/bookings/:id/status", (req, res) => {
  const id = String(req.params.id);
  const body = req.body || {};
  const status = String(body.status || "");
  const reason = String(body.reason || "").trim();

  if (status !== "approved" && status !== "rejected") {
    return res.status(400).json({
      status: "error",
      message: "Status tidak valid. Gunakan 'approved' (setujui) atau 'rejected' (tolak).",
    });
  }

  const existing = db.prepare("SELECT id, status FROM bookings WHERE id = ?").get(id);
  if (!existing) {
    return res.status(404).json({ status: "error", message: "Pengajuan tidak ditemukan." });
  }
  if (existing.status === status) {
    return res.status(409).json({
      status: "error",
      message: status === "approved" ? "Pengajuan sudah disetujui sebelumnya." : "Pengajuan sudah ditolak sebelumnya.",
    });
  }

  db.prepare(
    `UPDATE bookings
        SET status = ?, decided_at = datetime('now','localtime'), decided_by = ?, reject_reason = ?
      WHERE id = ?`
  ).run(status, "Admin IDB Bali", status === "rejected" ? reason || "Ditolak oleh admin" : null, id);

  res.json({
    status: "success",
    message: status === "approved" ? "Pengajuan disetujui." : "Pengajuan ditolak.",
    data: { booking_id: id, status },
  });
});

/* ---------- POST /api/rooms — tambah ruangan ---------- */
app.post("/api/rooms", (req, res) => {
  const b = req.body || {};
  const id = String(b.id || "").trim().toUpperCase();
  const name = String(b.name || "").trim();
  const category = String(b.category || "Lainnya").trim();
  const capacity = Number(b.capacity);

  if (!id || !name || !capacity || capacity < 1) {
    return res.status(400).json({
      status: "error",
      message: "Kode, nama, dan kapasitas ruangan wajib diisi (kapasitas minimal 1).",
    });
  }
  if (db.prepare("SELECT 1 FROM rooms WHERE id = ?").get(id)) {
    return res.status(409).json({ status: "error", message: `Kode ruangan "${id}" sudah dipakai.` });
  }

  db.prepare(
    `INSERT INTO rooms (id, name, category, weekend_only, capacity, icon, image, description, status)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'Tersedia')`
  ).run(
    id,
    name,
    category,
    b.weekend_only ? 1 : 0,
    capacity,
    String(b.icon || "🏫"),
    String(b.image || ""),
    String(b.description || "")
  );
  res.status(201).json({ status: "success", message: "Ruangan ditambahkan.", data: { id } });
});

/* ---------- PUT /api/rooms/:id — ubah ruangan ---------- */
app.put("/api/rooms/:id", (req, res) => {
  const id = String(req.params.id);
  const room = db.prepare("SELECT * FROM rooms WHERE id = ?").get(id);
  if (!room) {
    return res.status(404).json({ status: "error", message: "Ruangan tidak ditemukan." });
  }
  const b = req.body || {};
  db.prepare(
    `UPDATE rooms
        SET name = ?, category = ?, weekend_only = ?, capacity = ?, icon = ?, image = ?, description = ?
      WHERE id = ?`
  ).run(
    String(b.name || room.name).trim(),
    String(b.category || room.category).trim(),
    b.weekend_only === undefined ? room.weekend_only : b.weekend_only ? 1 : 0,
    Number(b.capacity || room.capacity),
    String(b.icon || room.icon),
    String(b.image !== undefined ? b.image : room.image),
    String(b.description !== undefined ? b.description : room.description),
    id
  );
  res.json({ status: "success", message: "Ruangan diperbarui." });
});

/* ---------- DELETE /api/rooms/:id — hapus ruangan (bookings ikut, FK CASCADE) ---------- */
app.delete("/api/rooms/:id", (req, res) => {
  const id = String(req.params.id);
  const room = db.prepare("SELECT id FROM rooms WHERE id = ?").get(id);
  if (!room) {
    return res.status(404).json({ status: "error", message: "Ruangan tidak ditemukan." });
  }
  db.prepare("DELETE FROM rooms WHERE id = ?").run(id);
  res.json({ status: "success", message: "Ruangan dihapus." });
});

/* ---------- 404 untuk route API yang tidak dikenal ---------- */
app.use("/api", (_req, res) => {
  res.status(404).json({ status: "error", message: "Endpoint tidak ditemukan." });
});

/* ---------- Jalankan server ---------- */
app.listen(PORT, () => {
  console.log("--------------------------------------------------------");
  console.log("  SIBORU — Sistem Booking Ruangan (IDB Bali) · Backend");
  console.log(`  Aplikasi : http://localhost:${PORT}`);
  console.log("  Database : SQLite (database.db)");
  console.log("  Login    : 2026001 / 2026002 — password123 | Admin: 246120940015 (rahasia, tanpa chip demo)");
  console.log("--------------------------------------------------------");
});
