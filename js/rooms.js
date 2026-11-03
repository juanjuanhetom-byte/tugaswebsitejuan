/* =========================================================
   SIBORU — Koleksi Ruangan (Task 3.5)
   9 fasilitas resmi katalog kampus. Data ini menjadi sumber
   utama frontend; ketika backend aktif, status booking per
   tanggal di-merge dari GET /api/rooms/status.
   ========================================================= */

/** Offset hari menuju Sabtu/Minggu berikutnya (0 = hari ini bila akhir pekan) */
function nextWeekendOffset() {
  const now = new Date();
  for (let off = 0; off < 7; off++) {
    const day = new Date(now.getFullYear(), now.getMonth(), now.getDate() + off).getDay();
    if (day === 0 || day === 6) return off;
  }
  return 0;
}

const ROOMS_DATA = [
  {
    id: "LAB-KOMPUTER",
    name: "Lab Komputer",
    category: "Lab & Studio",
    weekend_only: false,
    capacity: 40,
    icon: "💻",
    description: "Laboratorium komputer berspesifikasi terbaru dengan jaringan kampus berkecepatan tinggi.",
    image: "images/lab-komputer.jpg",
    room_status: "Tersedia",
    bookings: [
      { dayOffset: 0, start_time: "09:00", end_time: "12:00", purpose: "Bimbingan", organization_name: "Kelompok Praktikum A",
        status: "approved", user_id: 1, nim_nidn: "2026001", full_name: "Mahasiswa IDB" },
    ],
  },
  {
    id: "LAB-IMAC",
    name: "Lab iMac",
    category: "Lab & Studio",
    weekend_only: false,
    capacity: 24,
    icon: "🖥️",
    description: "Workstation grafis Apple OSX M1/M2 untuk desain, editing, dan animasi.",
    image: "images/lab-imac.jpg",
    room_status: "Tersedia",
    bookings: [
      { dayOffset: 1, start_time: "10:00", end_time: "13:00", purpose: "Kelas Tambahan", organization_name: "Kelas Ekstensi Semester",
        status: "approved" },
    ],
  },
  {
    id: "CLS-REGULER",
    name: "Ruang Kelas (Reguler)",
    category: "Classroom",
    weekend_only: true,
    capacity: 36,
    icon: "🏫",
    description: "Ruang kelas teori standar ber-AC, lengkap dengan proyektor dan whiteboard.",
    image: "images/ruang-kelas-reguler.jpg",
    room_status: "Tersedia",
    bookings: [
      { dayOffset: nextWeekendOffset(), start_time: "08:00", end_time: "17:00", purpose: "Keperluan Organisasi BEM/HMJ", organization_name: "Panitia LDK IDB Bali",
        status: "approved" },
    ],
  },
  {
    id: "LAB-FASHION",
    name: "Lab Fashion Design",
    category: "Lab & Studio",
    weekend_only: false,
    capacity: 20,
    icon: "✂️",
    description: "Studio desain busana dengan meja pola, manekin, dan peralatan jahit lengkap.",
    image: "images/lab-fashion-design.jpg",
    room_status: "Tersedia",
    bookings: [],
  },
  {
    id: "PUB-GSG",
    name: "Gedung Serba Guna (GSG)",
    category: "Public Area",
    weekend_only: false,
    capacity: 300,
    icon: "🏛️",
    description: "Gedung kampus bertingkat untuk area parkir dan penyelenggaraan acara berskala besar.",
    image: "images/gsg.jpg",
    room_status: "Tersedia",
    bookings: [],
  },
  {
    id: "PUB-AULA",
    name: "Aula",
    category: "Public Area",
    weekend_only: false,
    capacity: 250,
    icon: "🎤",
    description: "Aula seminar utama dengan kursi konferensi dan layar presentasi besar.",
    image: "images/aula.jpg",
    room_status: "Tersedia",
    bookings: [
      { dayOffset: 0, start_time: "13:00", end_time: "17:00", purpose: "Keperluan Organisasi BEM/HMJ", organization_name: "BEM IDB Bali",
        status: "pending", user_id: 2, nim_nidn: "2026002", full_name: "Dosen IDB" },
    ],
  },
  {
    id: "CLS-ASSIST",
    name: "Ruang Assistensi",
    category: "Classroom",
    weekend_only: false,
    capacity: 10,
    icon: "💬",
    description: "Ruang diskusi kecil untuk asistensi mahasiswa, bimbingan, dan konsultasi ide.",
    image: "images/ruang-assistensi.jpg",
    room_status: "Tersedia",
    bookings: [
      { dayOffset: 0, start_time: "08:00", end_time: "10:00", purpose: "Bimbingan", organization_name: "Dosen Pembimbing",
        status: "rejected", user_id: 1, nim_nidn: "2026001", full_name: "Mahasiswa IDB",
        decided_at: null, reject_reason: "Bersamaan dengan kegiatan rutin dosen" },
      { dayOffset: 0, start_time: "13:00", end_time: "14:00", purpose: "Diskusi Ide/Bisnis", organization_name: "Tim Startup Kampus",
        status: "pending", user_id: 1, nim_nidn: "2026001", full_name: "Mahasiswa IDB" },
    ],
  },
  {
    id: "STU-FOTO",
    name: "Studio Foto",
    category: "Lab & Studio",
    weekend_only: false,
    capacity: 20,
    icon: "📷",
    description: "Studio fotografi lengkap dengan lampu studio, backdrop, dan tripod kamera.",
    image: "images/studio-foto.jpg",
    room_status: "Tersedia",
    bookings: [
      { dayOffset: 0, start_time: "08:00", end_time: "17:00", purpose: "Kelas Tambahan", organization_name: "HMJ Fotografi",
        status: "approved" },
    ],
  },
  {
    id: "CLS-MAGISTER",
    name: "Ruang Kelas Magister",
    category: "Classroom",
    weekend_only: true,
    capacity: 30,
    icon: "🎓",
    description: "Ruang kelas magister premium untuk kelas Master Digital Business.",
    image: "images/ruang-kelas-magister.jpg",
    room_status: "Tersedia",
    bookings: [],
  },
];

/* Materialisasi booking demo: dayOffset -> booking_date YYYY-MM-DD */
(function materializeDemoBookings() {
  const fmt = (d) =>
    `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  const base = new Date();

  ROOMS_DATA.forEach((room) => {
    room.bookings = (room.bookings || []).map((b) => {
      const d = new Date(base.getFullYear(), base.getMonth(), base.getDate() + (b.dayOffset || 0));
      const { dayOffset, ...rest } = b;
      return { ...rest, booking_date: fmt(d) };
    });
  });
})();

/* =========================================================
   Task 4 — Penyimpanan persisten (mode offline)
   - idb_bali_local_bookings : pemesanan buatan pengguna
   - idb_bali_removed_seeds  : jadwal contoh yang dihapus admin
   - idb_bali_rooms_state    : tambah / ubah / hapus ruangan
   Diterapkan saat halaman dimuat sehingga katalog & panel
   admin selalu melihat data yang sama.
   ========================================================= */
const IDB_LOCAL_BOOKINGS_KEY = "idb_bali_local_bookings";
const IDB_REMOVED_SEEDS_KEY = "idb_bali_removed_seeds";
const IDB_ROOMS_STATE_KEY = "idb_bali_rooms_state";
/* Task 5 — status persetujuan pemesanan (menunggu / disetujui / ditolak) */
const IDB_BOOKING_STATUS_KEY = "idb_bali_booking_status";

/** Status bawaan sebuah booking (data lama tanpa status = sudah disetujui) */
function bookingStatusOf(b) {
  return (b && b.status) || "approved";
}

/** Slot ruangan ditempati booking berstatus menunggu/disetujui (ditolak bebas) */
function bookingOccupiesSlot(b) {
  return bookingStatusOf(b) !== "rejected";
}

function idbReadJSON(key, fallback) {
  try {
    const v = JSON.parse(localStorage.getItem(key));
    return v == null ? fallback : v;
  } catch (e) {
    return fallback;
  }
}

function idbWriteJSON(key, value) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch (e) {
    /* storage penuh / mode privat — diabaikan */
  }
}

/** Kunci identitas jadwal contoh (seed tidak punya id booking) */
function seedBookingKey(roomId, b) {
  return `${roomId}|${b.booking_date}|${b.start_time}|${b.end_time}`;
}

(function applyPersistedState() {
  // 1) Ruangan: hapus → tambah → ubah
  const st = idbReadJSON(IDB_ROOMS_STATE_KEY, { added: [], updated: {}, removed: [] });
  (st.removed || []).forEach((id) => {
    const i = ROOMS_DATA.findIndex((r) => r.id === id);
    if (i >= 0) ROOMS_DATA.splice(i, 1);
  });
  (st.added || []).forEach((r) => {
    if (r && r.id && !ROOMS_DATA.some((x) => x.id === r.id)) {
      ROOMS_DATA.push({ icon: "🚪", description: "", image: "", room_status: "Tersedia", bookings: [], ...r });
    }
  });
  Object.entries(st.updated || {}).forEach(([id, patch]) => {
    const room = ROOMS_DATA.find((r) => r.id === id);
    if (room) Object.assign(room, patch);
  });

  // 2) Saring jadwal contoh yang dihapus admin
  const removedSeeds = idbReadJSON(IDB_REMOVED_SEEDS_KEY, []);
  ROOMS_DATA.forEach((room) => {
    room.bookings = (room.bookings || []).filter(
      (b) => b.id || !removedSeeds.includes(seedBookingKey(room.id, b))
    );
  });

  // 3) Terapkan keputusan admin pada jadwal contoh (setujui / tolak)
  const statusMap = idbReadJSON(IDB_BOOKING_STATUS_KEY, {});
  ROOMS_DATA.forEach((room) => {
    (room.bookings || []).forEach((b) => {
      if (b.id) return; // booking pengguna ditangani saat merge di bawah
      const patch = statusMap[seedBookingKey(room.id, b)];
      if (patch) Object.assign(b, patch);
    });
  });

  // 3b) Stempel waktu keputusan untuk jadwal contoh yang sudah disetujui/ditolak
  //     (agar detail admin & riwayat selalu menampilkan waktu keputusan yang wajar)
  const SEED_DECIDED_AGO = 5 * 60 * 60 * 1000;
  const SEED_CREATED_AGO = 26 * 60 * 60 * 1000;
  ROOMS_DATA.forEach((room) => {
    (room.bookings || []).forEach((b) => {
      if (b.id) return;
      if (!b.created_at) b.created_at = new Date(Date.now() - SEED_CREATED_AGO).toISOString();
      if (!b.status || b.status === "pending" || b.decided_at) return;
      b.decided_at = new Date(Date.now() - SEED_DECIDED_AGO).toISOString();
      b.decided_by = b.decided_by || "Admin IDB Bali";
    });
  });

  // 4) Merge pemesanan pengguna (lokal) — data lama tanpa status = disetujui
  idbReadJSON(IDB_LOCAL_BOOKINGS_KEY, []).forEach((b) => {
    const room = ROOMS_DATA.find((r) => r.id === b.room_id);
    if (room && !room.bookings.some((x) => x.id === b.id)) room.bookings.push({ status: "approved", ...b });
  });
})();

/* --- Helper CRUD dipakai booking.js & panel admin --- */
function persistLocalBooking(booking) {
  const list = idbReadJSON(IDB_LOCAL_BOOKINGS_KEY, []);
  list.push(booking);
  idbWriteJSON(IDB_LOCAL_BOOKINGS_KEY, list);
}

function removeLocalBooking(bookingId) {
  idbWriteJSON(
    IDB_LOCAL_BOOKINGS_KEY,
    idbReadJSON(IDB_LOCAL_BOOKINGS_KEY, []).filter((b) => b.id !== bookingId)
  );
}

function markSeedRemoved(roomId, booking) {
  const list = idbReadJSON(IDB_REMOVED_SEEDS_KEY, []);
  const key = seedBookingKey(roomId, booking);
  if (!list.includes(key)) list.push(key);
  idbWriteJSON(IDB_REMOVED_SEEDS_KEY, list);
}

/** Hapus satu booking dari tampilan sekaligus dari penyimpanan */
function deleteBookingData(roomId, booking) {
  const room = ROOMS_DATA.find((r) => r.id === roomId);
  if (room) {
    const targetKey = seedBookingKey(roomId, booking);
    room.bookings = (room.bookings || []).filter((b) =>
      booking.id ? b.id !== booking.id : seedBookingKey(roomId, b) !== targetKey
    );
  }
  if (booking.id) removeLocalBooking(booking.id);
  else markSeedRemoved(roomId, booking);
}

function getRoomsState() {
  return idbReadJSON(IDB_ROOMS_STATE_KEY, { added: [], updated: {}, removed: [] });
}

/* =========================================================
   Task 5 — Persetujuan pemesanan (setujui / tolak)
   Keputusan admin disimpan persisten: booking pengguna di
   idb_bali_local_bookings, jadwal contoh di idb_bali_booking_status
   ========================================================= */
/** Simpan keputusan admin pada sebuah booking (penyimpanan + memori) */
function setBookingStatusData(roomId, booking, status, extra = {}) {
  const patch = {
    status,
    decided_at: new Date().toISOString(),
    decided_by: "Admin IDB Bali",
    ...extra,
  };

  if (booking.id) {
    const list = idbReadJSON(IDB_LOCAL_BOOKINGS_KEY, []);
    const saved = list.find((b) => b.id === booking.id);
    if (saved) Object.assign(saved, patch);
    idbWriteJSON(IDB_LOCAL_BOOKINGS_KEY, list);
  } else {
    const map = idbReadJSON(IDB_BOOKING_STATUS_KEY, {});
    map[seedBookingKey(roomId, booking)] = patch;
    idbWriteJSON(IDB_BOOKING_STATUS_KEY, map);
  }

  const room = ROOMS_DATA.find((r) => r.id === roomId);
  const target =
    room &&
    (room.bookings || []).find((b) =>
      booking.id ? b.id === booking.id : seedBookingKey(roomId, b) === seedBookingKey(roomId, booking)
    );
  if (target) Object.assign(target, patch);
  return target || booking;
}

/** Seluruh booking diratakan per ruangan (riwayat pengguna & ringkasan admin) */
function flatBookings() {
  const out = [];
  ROOMS_DATA.forEach((room) => {
    (room.bookings || []).forEach((b) =>
      out.push({ ...b, room_id: room.id, room_name: room.name, room_icon: room.icon })
    );
  });
  return out;
}

function saveRoomsState(st) {
  idbWriteJSON(IDB_ROOMS_STATE_KEY, st);
}

function adminAddRoom(room) {
  const st = getRoomsState();
  st.added = st.added || [];
  st.added.push(room);
  saveRoomsState(st);
  ROOMS_DATA.push({ icon: "🚪", description: "", image: "", room_status: "Tersedia", bookings: [], ...room });
}

function adminUpdateRoom(roomId, patch) {
  const st = getRoomsState();
  st.updated = st.updated || {};
  st.updated[roomId] = { ...(st.updated[roomId] || {}), ...patch };
  const addedRoom = (st.added || []).find((r) => r.id === roomId);
  if (addedRoom) Object.assign(addedRoom, patch);
  saveRoomsState(st);
  const room = ROOMS_DATA.find((r) => r.id === roomId);
  if (room) Object.assign(room, patch);
}

function adminRemoveRoom(roomId) {
  const st = getRoomsState();
  const idxAdded = (st.added || []).findIndex((r) => r.id === roomId);
  if (idxAdded >= 0) st.added.splice(idxAdded, 1);
  else {
    st.removed = st.removed || [];
    if (!st.removed.includes(roomId)) st.removed.push(roomId);
  }
  if (st.updated) delete st.updated[roomId];
  saveRoomsState(st);

  const i = ROOMS_DATA.findIndex((r) => r.id === roomId);
  if (i >= 0) ROOMS_DATA.splice(i, 1);
  idbWriteJSON(
    IDB_LOCAL_BOOKINGS_KEY,
    idbReadJSON(IDB_LOCAL_BOOKINGS_KEY, []).filter((b) => b.room_id !== roomId)
  );
}
