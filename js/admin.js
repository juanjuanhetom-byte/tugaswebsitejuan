/* =========================================================
   SIBORU — Panel Admin (Task 4)
   Peran ADMIN: dashboard, kelola pemesanan, kelola ruangan,
   daftar pengguna. Mode offline memakai data lokal
   (js/rooms.js + localStorage); bila backend aktif, data
   diambil lewat API (js/api.js) dengan fallback lokal.
   Dimuat SETELAH api.js, auth.js, dan rooms.js.
   ========================================================= */

/* ---------------------------------------------------------
   Route guard: hanya peran ADMIN
--------------------------------------------------------- */
const adminSession = getSession();
if (!adminSession || !adminSession.id) {
  clearSession();
  window.location.replace("index.html");
} else if (adminSession.role !== "ADMIN") {
  // Sudah login namun bukan admin: kembalikan ke katalog tanpa menghapus sesi
  window.location.replace("catalog.html");
}

/* ---------------------------------------------------------
   Helper tanggal & jam (ringkas, gaya booking.js)
--------------------------------------------------------- */
const DAY_NAMES = ["Minggu", "Senin", "Selasa", "Rabu", "Kamis", "Jumat", "Sabtu"];
const MONTH_NAMES = [
  "Januari", "Februari", "Maret", "April", "Mei", "Juni",
  "Juli", "Agustus", "September", "Oktober", "November", "Desember",
];

function todayISO() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function parseISO(iso) {
  const [y, m, d] = String(iso).split("-").map(Number);
  return new Date(y, m - 1, d);
}

/** "Selasa, 20 Oktober 2026" */
function formatDateID(iso) {
  if (!iso) return "-";
  const d = parseISO(iso);
  return `${DAY_NAMES[d.getDay()]}, ${d.getDate()} ${MONTH_NAMES[d.getMonth()]} ${d.getFullYear()}`;
}

/** "20 Okt 2026" — untuk tabel agar ringkas */
function shortDateID(iso) {
  if (!iso) return "-";
  const d = parseISO(iso);
  const shortMonth = ["Jan", "Feb", "Mar", "Apr", "Mei", "Jun", "Jul", "Agu", "Sep", "Okt", "Nov", "Des"];
  return `${d.getDate()} ${shortMonth[d.getMonth()]} ${d.getFullYear()}`;
}

/** "09.00 – 12.00" */
function rangeLabel(start, end) {
  if (!start || !end) return "-";
  return `${start.replace(":", ".")} – ${end.replace(":", ".")}`;
}

function toMinutes(t) {
  const [h, m] = String(t).split(":").map(Number);
  return h * 60 + m;
}

function isWeekendISO(iso) {
  const day = parseISO(iso).getDay();
  return day === 0 || day === 6;
}

/** Sisipkan aman ke innerHTML */
function esc(value) {
  return String(value == null ? "" : value).replace(/[&<>"']/g, (c) =>
    ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c])
  );
}

/* ---------------------------------------------------------
   Elemen & state
--------------------------------------------------------- */
const el = (id) => document.getElementById(id);

const toastEl = el("toast");
let toastTimer = null;
function showToast(message) {
  toastEl.textContent = message;
  toastEl.classList.add("is-show");
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => toastEl.classList.remove("is-show"), 3400);
}

let ONLINE = false;          // true bila backend Express aktif
let ALL_BOOKINGS = [];       // seluruh booking (flatten per ruangan)
let USER_LIST = [];          // daftar pengguna utk view Pengguna
let bkScope = "all";         // chip filter tanggal aktif
let bkStatus = "all";        // chip filter status persetujuan (Task 5)
let currentBkRows = [];      // baris yang sedang dirender (untuk aksi hapus)
let detailRowIndex = null;    // baris yang sedang dibuka di modal detail
let editingRoomId = null;    // null = mode tambah
let rmIdTouched = false;

/* Label & gaya status persetujuan */
const STATUS_META = {
  pending:  { label: "Menunggu",         tag: "tag--pending",  icon: "⏳" },
  approved: { label: "Disetujui",        tag: "tag--approved", icon: "✓" },
  rejected: { label: "Ditolak",          tag: "tag--rejected", icon: "✕" },
};
const statusOf = (b) => (b && b.status) || "approved";

function statusTag(status) {
  const m = STATUS_META[status] || STATUS_META.approved;
  return `<span class="tag ${m.tag}">${m.icon} ${m.label}</span>`;
}

/** "20 Okt 2026, 14.30" dari stempel ISO */
function shortDateTimeID(iso) {
  if (!iso) return "—";
  try {
    return new Date(iso).toLocaleString("id-ID", {
      day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit",
    });
  } catch (e) {
    return "—";
  }
}

/* ---------------------------------------------------------
   Deteksi mode & pemuatan data
--------------------------------------------------------- */
async function detectMode() {
  const probe = await Api.roomsStatus(todayISO());
  ONLINE = !(probe.networkError || probe.httpStatus === 0 || probe.httpStatus === 404);
  el("modeBadge").textContent = ONLINE ? "Terhubung Backend" : "Mode Lokal (offline)";
  el("modeBadge").classList.toggle("is-online", ONLINE);
}

/** Susun ALL_BOOKINGS dari respon backend (per tanggal aktif tidak cukup —
    pakai GET /api/bookings yang mengembalikan seluruh tanggal) */
async function loadBookings() {
  if (ONLINE) {
    const r = await Api.bookings();
    if (r.ok && r.data && Array.isArray(r.data.bookings)) {
      ALL_BOOKINGS = r.data.bookings.map((b) => ({
        id: b.id,
        booking_date: b.booking_date,
        start_time: b.start_time,
        end_time: b.end_time,
        purpose: b.purpose,
        organization_name: b.organization_name,
        full_name: b.full_name,
        nim_nidn: b.nim_nidn,
        room_id: b.room_id,
        room_name: b.room_name,
        user_id: b.user_id,
        status: b.status || "pending",
        created_at: b.created_at,
        decided_at: b.decided_at,
        decided_by: b.decided_by,
        reject_reason: b.reject_reason,
      }));
      sortBookings();
      return;
    }
    showToast("Backend gagal merespons — menampilkan data lokal.");
    ONLINE = false;
  }
  // Lokal: flatten ROOMS_DATA (demo + booking lokal + hasil kelola admin)
  ALL_BOOKINGS = [];
  ROOMS_DATA.forEach((room) => {
    (room.bookings || []).forEach((b) => {
      pushFlatBooking(room, b);
    });
  });
  sortBookings();
}

function pushFlatBooking(room, b) {
  ALL_BOOKINGS.push({
    id: b.id || null,
    booking_date: b.booking_date,
    start_time: b.start_time,
    end_time: b.end_time,
    purpose: b.purpose,
    organization_name: b.organization_name,
    full_name: b.full_name || "-",
    nim_nidn: b.nim_nidn || null,
    user_id: b.user_id || null,
    room_id: room.id,
    room_name: room.name,
    room_icon: room.icon,
    // Task 5 — status persetujuan
    status: statusOf(b),
    created_at: b.created_at || null,
    decided_at: b.decided_at || null,
    decided_by: b.decided_by || null,
    reject_reason: b.reject_reason || null,
  });
}

function sortBookings() {
  ALL_BOOKINGS.sort(
    (a, b) =>
      String(b.booking_date).localeCompare(String(a.booking_date)) ||
      toMinutes(a.start_time) - toMinutes(b.start_time)
  );
}

async function loadUsers() {
  if (ONLINE) {
    const r = await Api.users();
    if (r.ok && r.data && Array.isArray(r.data.users)) {
      USER_LIST = r.data.users.map((u) => ({
        nim_nidn: u.nim_nidn,
        full_name: u.full_name,
        role: u.role,
        booking_count: u.booking_count || 0,
      }));
      return;
    }
  }
  // Lokal: akun demo + hitung pemesanan per nama
  USER_LIST = Object.values(LOCAL_ACCOUNTS).map((acc) => ({
    nim_nidn: acc.nim_nidn,
    full_name: acc.full_name,
    role: acc.role,
    booking_count: ALL_BOOKINGS.filter((b) => b.full_name === acc.full_name).length,
  }));
}

/** Tarik ulang data ruangan dari backend (mode online) */
async function refreshRoomsFromApi() {
  if (!ONLINE) return;
  const r = await Api.roomsStatus(todayISO());
  if (!r.ok || !r.data || !Array.isArray(r.data.rooms)) return;
  const date = r.data.date;
  ROOMS_DATA.length = 0;
  r.data.rooms.forEach((x) => {
    ROOMS_DATA.push({
      id: x.id,
      name: x.name,
      category: x.category,
      weekend_only: !!x.weekend_only,
      capacity: x.capacity,
      icon: x.icon,
      description: x.description,
      image: x.image,
      room_status: x.room_status,
      bookings: (x.bookings || []).map((b) => ({
        id: b.id,
        booking_date: date,
        start_time: b.start_time,
        end_time: b.end_time,
        purpose: b.purpose,
        organization_name: b.organization_name,
        full_name: b.full_name,
      })),
    });
  });
}

/* ---------------------------------------------------------
   Navigasi antar view
--------------------------------------------------------- */
const VIEW_TITLES = {
  dashboard: "Dashboard",
  bookings: "Kelola Pemesanan",
  rooms: "Kelola Ruangan",
  users: "Daftar Pengguna",
};
let activeView = "dashboard";

function switchView(view) {
  activeView = view;
  document.querySelectorAll(".admin-nav__item").forEach((b) => {
    b.classList.toggle("is-active", b.dataset.view === view);
  });
  ["dashboard", "bookings", "rooms", "users"].forEach((v) => {
    el("view" + v.charAt(0).toUpperCase() + v.slice(1)).hidden = v !== view;
  });
  el("adminPageTitle").textContent = VIEW_TITLES[view] || "Panel Admin";
  renderActiveView();
}

function renderActiveView() {
  if (activeView === "dashboard") renderDashboard();
  else if (activeView === "bookings") renderBookings();
  else if (activeView === "rooms") renderRooms();
  else if (activeView === "users") renderUsers();
}

/* ---------------------------------------------------------
   View 1: Dashboard
--------------------------------------------------------- */
function renderDashboard() {
  const today = todayISO();
  const byStatus = (s) => ALL_BOOKINGS.filter((b) => statusOf(b) === s).length;

  el("statRooms").textContent = ROOMS_DATA.length;
  el("statToday").textContent = ALL_BOOKINGS.filter((b) => b.booking_date === today).length;
  el("statTotalBookings").textContent = ALL_BOOKINGS.length;
  el("statPending").textContent = byStatus("pending");
  el("statApproved").textContent = byStatus("approved");
  el("statRejected").textContent = byStatus("rejected");
  el("statWeekend").textContent = ALL_BOOKINGS.filter((b) => isWeekendISO(b.booking_date)).length;
  el("statUsers").textContent = USER_LIST.length;

  // Panel "menunggu persetujuan" — pintasan proses pengajuan
  const pendingList = ALL_BOOKINGS.filter((b) => statusOf(b) === "pending");
  const pendBox = el("pendingBox");
  if (pendBox) {
    pendBox.hidden = !pendingList.length;
    const first = pendingList[0];
    el("pendingCount").textContent = pendingList.length;
    el("pendingFirst").textContent = first
      ? `${first.room_name} · ${shortDateID(first.booking_date)} ${rangeLabel(first.start_time, first.end_time)} · ${first.full_name}`
      : "";
  }

  const perRoom = {};
  ALL_BOOKINGS.forEach((b) => {
    perRoom[b.room_name] = (perRoom[b.room_name] || 0) + 1;
  });
  let topName = "—";
  let topCount = 0;
  Object.entries(perRoom).forEach(([name, count]) => {
    if (count > topCount) {
      topName = name;
      topCount = count;
    }
  });
  el("statTopRoom").textContent = topCount ? `${topName} (${topCount}×)` : "—";

  const recent = ALL_BOOKINGS.slice(0, 8);
  el("recentBookingsBody").innerHTML = recent.length
    ? recent
        .map(
          (b) => `
      <tr>
        <td class="mono" data-label="Booking ID">${esc(b.id || "—")}</td>
        <td data-label="Tanggal">${esc(shortDateID(b.booking_date))}</td>
        <td data-label="Jam">${esc(rangeLabel(b.start_time, b.end_time))}</td>
        <td data-label="Ruang">${esc(b.room_name)}</td>
        <td data-label="Atas Nama">${esc(b.organization_name)}</td>
        <td data-label="Pemesan">${esc(b.full_name)}</td>
        <td data-label="Status">${statusTag(statusOf(b))}</td>
      </tr>`
        )
        .join("")
    : `<tr><td colspan="7" class="admin-empty">Belum ada pemesanan.</td></tr>`;
}

/* ---------------------------------------------------------
   View 2: Kelola Pemesanan
--------------------------------------------------------- */
function bookingPassesScope(b) {
  const today = todayISO();
  if (bkScope === "today") return b.booking_date === today;
  if (bkScope === "upcoming") return b.booking_date >= today;
  if (bkScope === "weekend") return isWeekendISO(b.booking_date);
  return true;
}

function renderBookings() {
  // opsi filter ruangan
  const roomSelect = el("bkRoom");
  const prevValue = roomSelect.value;
  roomSelect.innerHTML =
    `<option value="">Semua Ruangan</option>` +
    ROOMS_DATA.map((r) => `<option value="${esc(r.id)}">${esc(r.icon)} ${esc(r.name)}</option>`).join("");
  roomSelect.value = prevValue;

  const term = el("bkSearch").value.trim().toLowerCase();
  const roomFilter = roomSelect.value;
  const dateFilter = el("bkDate").value;

  currentBkRows = ALL_BOOKINGS.filter((b) => {
    if (!bookingPassesScope(b)) return false;
    if (bkStatus !== "all" && statusOf(b) !== bkStatus) return false;
    if (roomFilter && b.room_id !== roomFilter) return false;
    if (dateFilter && b.booking_date !== dateFilter) return false;
    if (term) {
      const haystack = [b.id, b.room_name, b.organization_name, b.full_name, b.purpose]
        .join(" ")
        .toLowerCase();
      if (!haystack.includes(term)) return false;
    }
    return true;
  });

  el("bkCount").textContent = currentBkRows.length;

  el("bkBody").innerHTML = currentBkRows.length
    ? currentBkRows
        .map((b, i) => {
          const isToday = b.booking_date === todayISO();
          const st = statusOf(b);
          return `
      <tr>
        <td class="mono" data-label="Booking ID">${esc(b.id || "—")}</td>
        <td data-label="Tanggal">${esc(shortDateID(b.booking_date))}${isToday ? ' <span class="tag tag--today">Hari ini</span>' : ""}</td>
        <td data-label="Jam">${esc(rangeLabel(b.start_time, b.end_time))}</td>
        <td data-label="Ruang">${esc(b.room_name)}</td>
        <td data-label="Kepentingan">${esc(b.purpose)}</td>
        <td data-label="Atas Nama">${esc(b.organization_name)}</td>
        <td data-label="Pemesan">${esc(b.full_name)}</td>
        <td data-label="Status">${statusTag(st)}</td>
        <td data-label="Aksi">
          <div class="row-actions">
            <button type="button" class="btn btn--outline btn--sm" data-detail-booking="${i}" title="Lihat detail pengajuan">
              Detail
            </button>
            ${
              st === "pending"
                ? `<button type="button" class="btn btn--gold btn--sm" data-approve-booking="${i}" title="Setujui pengajuan">Setujui</button>
                   <button type="button" class="btn btn--danger btn--sm" data-reject-booking="${i}" title="Tolak pengajuan">Tolak</button>`
                : ""
            }
            <button type="button" class="btn btn--danger btn--sm" data-del-booking="${i}" title="Hapus pemesanan">
              Hapus
            </button>
          </div>
        </td>
      </tr>`;
        })
        .join("")
    : `<tr><td colspan="9" class="admin-empty">${
        bkStatus === "pending"
          ? "Tidak ada pengajuan yang menunggu persetujuan. 🎉"
          : "Tidak ada pemesanan yang cocok dengan filter."
      }</td></tr>`;
}

async function deleteBookingByIndex(idx) {
  const row = currentBkRows[idx];
  if (!row) return;

  const ok = await confirmAction(
    `Pemesanan ${row.id || "(jadwal contoh)"} atas ruang ${row.room_name} pada ${formatDateID(
      row.booking_date
    )}, ${rangeLabel(row.start_time, row.end_time)} akan dihapus permanen.`,
    "Ya, Hapus Pemesanan"
  );
  if (!ok) return;

  if (ONLINE && row.id) {
    const r = await Api.deleteBooking(row.id);
    if (!r.ok) {
      showToast(r.message || "Gagal menghapus pemesanan di backend.");
      return;
    }
    await loadBookings();
    await loadUsers();
  } else {
    deleteBookingData(row.room_id, {
      id: row.id || undefined,
      booking_date: row.booking_date,
      start_time: row.start_time,
      end_time: row.end_time,
    });
    await loadBookings();
    await loadUsers();
  }
  renderActiveView();
  showToast("Pemesanan berhasil dihapus. 🗑️");
}

/* ---------------------------------------------------------
   Task 5 — Detail pengajuan & keputusan (setujui / tolak)
--------------------------------------------------------- */
function closeDetailModal() {
  el("detailModal").hidden = true;
  detailRowIndex = null;
}

/** Buka modal detail untuk baris pada tabel pemesanan yang sedang dirender */
function openDetailByIndex(idx) {
  const row = currentBkRows[idx];
  if (!row) return;
  detailRowIndex = idx;

  const st = statusOf(row);
  const meta = STATUS_META[st] || STATUS_META.approved;
  const statusLabel = st === "pending" ? "Menunggu Persetujuan" : meta.label;

  el("detailIcon").textContent = row.room_icon || "📋";
  el("detailTitle").textContent = row.id || row.room_name;
  el("detailSub").textContent = row.id
    ? `${row.room_name} · ${formatDateID(row.booking_date)}`
    : `Jadwal contoh · ${formatDateID(row.booking_date)}`;
  el("detailStatus").innerHTML = `<span class="tag ${meta.tag}">${meta.icon} ${statusLabel}</span>`;

  const decidedText = row.decided_at
    ? `${st === "approved" ? "Disetujui" : "Ditolak"} oleh ${row.decided_by || "Admin"} — ${shortDateTimeID(row.decided_at)}`
    : "Belum ada keputusan";

  const fields = [
    ["Booking ID", `<span class="mono">${esc(row.id || "— (jadwal contoh)")}</span>`],
    ["Status", `<strong>${statusLabel}</strong>`],
    ["Ruangan", `${esc(row.room_name)} <span class="mono">(${esc(row.room_id)})</span>`],
    ["Tanggal", esc(formatDateID(row.booking_date))],
    ["Jam", esc(rangeLabel(row.start_time, row.end_time))],
    ["Kepentingan", esc(row.purpose || "—")],
    ["Atas Nama", esc(row.organization_name || "—")],
    ["Pemesan", `${esc(row.full_name || "—")}${row.nim_nidn ? ` · <span class="mono">${esc(row.nim_nidn)}</span>` : ""}`],
    ["Diajukan pada", esc(shortDateTimeID(row.created_at))],
    ["Keputusan", esc(decidedText)],
  ];
  if (st === "rejected" && row.reject_reason) {
    fields.push(["Alasan penolakan", esc(row.reject_reason)]);
  }

  el("detailGrid").innerHTML = fields
    .map(([k, v]) => `<div class="detail-grid__item"><dt>${k}</dt><dd>${v}</dd></div>`)
    .join("");

  // Catatan status
  const note = el("detailNote");
  note.hidden = false;
  note.className = `detail__note detail__note--${st}`;
  note.textContent =
    st === "pending"
      ? "⏳ Slot sudah diamankan untuk pengaju ini. Setujui agar pemesanan aktif, atau tolak agar slot kembali dibuka."
      : st === "approved"
      ? "✅ Peminjaman aktif — pengaju dapat mengunduh struk bukti pemesanan."
      : "❌ Pengajuan ditolak dan slot sudah dibuka kembali untuk pemesanan lain.";

  // Tombol aksi hanya untuk pengajuan yang masih menunggu
  const pending = st === "pending";
  el("detailApprove").hidden = !pending;
  el("detailReject").hidden = !pending;
  el("detailReasonField").hidden = !pending;
  el("detailReason").value = "";

  el("detailModal").hidden = false;
}

/** Terapkan keputusan admin pada satu pengajuan */
async function decideBooking(idx, status) {
  const row = currentBkRows[idx];
  if (!row) return;
  const isApprove = status === "approved";

  const ok = await confirmAction(
    isApprove
      ? `Pengajuan ${row.id || "(jadwal contoh)"} untuk ruang ${row.room_name} pada ${formatDateID(
          row.booking_date
        )}, ${rangeLabel(row.start_time, row.end_time)} akan DISETUJUI dan menjadi pemesanan aktif.`
      : `Pengajuan ${row.id || "(jadwal contoh)"} untuk ruang ${row.room_name} pada ${formatDateID(
          row.booking_date
        )}, ${rangeLabel(row.start_time, row.end_time)} akan DITOLAK dan slot kembali dibuka untuk pemesanan lain.`,
    isApprove ? "Ya, Setujui" : "Ya, Tolak",
    isApprove ? "gold" : "danger"
  );
  if (!ok) return;

  const reason = el("detailReason").value.trim();

  if (ONLINE && row.id) {
    const r = await Api.updateBookingStatus(row.id, status, reason);
    if (!r.ok) {
      showToast(r.message || "Gagal menyimpan keputusan di backend.");
      return;
    }
  } else {
    setBookingStatusData(row.room_id, row, status, {
      reject_reason: status === "rejected" ? reason || "Ditolak oleh admin" : null,
    });
  }

  closeDetailModal();
  await reloadAll();
  const label = row.id || `${row.room_name} (${rangeLabel(row.start_time, row.end_time)})`;
  showToast(isApprove ? `Pengajuan ${label} disetujui ✅` : `Pengajuan ${label} ditolak ❌`);
}

/* ---------------------------------------------------------
   View 3: Kelola Ruangan
--------------------------------------------------------- */
function renderRooms() {
  el("rmCount").textContent = ROOMS_DATA.length;
  el("roomGridAdmin").innerHTML = ROOMS_DATA.map((room) => {
    const count = (room.bookings || []).length;
    return `
    <article class="room-manage-card">
      <img class="room-manage-card__img" src="${esc(room.image)}" alt="${esc(room.name)}"
           onerror="this.style.display='none'" />
      <div class="room-manage-card__body">
        <span class="room-manage-card__id">${esc(room.id)}</span>
        <h3>${esc(room.icon)} ${esc(room.name)}</h3>
        <div class="room-manage-card__tags">
          <span class="tag tag--cat">${esc(room.category)}</span>
          <span class="tag tag--cap">👥 ${esc(room.capacity)} orang</span>
          ${room.weekend_only ? `<span class="tag tag--weekend">Akhir pekan saja</span>` : ""}
          <span class="tag ${count ? "tag--booked" : "tag--ok"}">${count ? `${count} booking` : "Kosong"}</span>
        </div>
      </div>
      <div class="room-manage-card__foot">
        <button type="button" class="btn btn--outline btn--sm" data-edit-room="${esc(room.id)}">Edit</button>
        <button type="button" class="btn btn--danger btn--sm" data-del-room="${esc(room.id)}">Hapus</button>
      </div>
    </article>`;
  }).join("");
}

function slugifyRoomId(name) {
  const base =
    String(name)
      .toUpperCase()
      .replace(/[^A-Z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "") || "RUANGAN";
  let slug = base;
  let n = 2;
  while (
    ROOMS_DATA.some((r) => r.id === slug) ||
    (getRoomsState().added || []).some((r) => r.id === slug)
  ) {
    slug = `${base}-${n}`;
    n++;
  }
  return slug;
}

function openRoomModal(roomId) {
  editingRoomId = roomId || null;
  rmIdTouched = !!roomId;
  const room = roomId ? ROOMS_DATA.find((r) => r.id === roomId) : null;

  el("roomModalTitle").textContent = room ? "Edit Ruangan" : "Tambah Ruangan";
  el("roomModalIcon").textContent = room ? room.icon || "🏫" : "🏫";
  el("roomAlert").hidden = true;

  el("rmName").value = room ? room.name : "";
  el("rmId").value = room ? room.id : "";
  el("rmId").disabled = !!room; // kode ruangan tidak bisa diubah saat edit
  el("rmCategory").value = room ? room.category : "Lab & Studio";
  el("rmCapacity").value = room ? room.capacity : "";
  el("rmIcon").value = room ? room.icon || "" : "";
  el("rmImage").value = room ? room.image || "" : "";
  el("rmDesc").value = room ? room.description || "" : "";
  el("rmWeekend").checked = room ? !!room.weekend_only : false;

  el("roomModal").hidden = false;
  el("rmName").focus();
}

function closeRoomModal() {
  el("roomModal").hidden = true;
  editingRoomId = null;
}

async function saveRoom() {
  const name = el("rmName").value.trim();
  const capacity = Number(el("rmCapacity").value);
  const alertBox = el("roomAlert");

  const fail = (msg) => {
    el("roomAlertText").textContent = msg;
    alertBox.hidden = false;
  };
  alertBox.hidden = true;

  if (!name) return fail("Nama ruangan wajib diisi.");
  if (!capacity || capacity < 1) return fail("Kapasitas harus angka minimal 1.");

  const patch = {
    name,
    category: el("rmCategory").value,
    capacity,
    icon: el("rmIcon").value.trim() || "🚪",
    image: el("rmImage").value.trim(),
    description: el("rmDesc").value.trim(),
    weekend_only: el("rmWeekend").checked,
  };

  const saveBtn = el("roomSave");
  saveBtn.disabled = true;

  try {
    if (editingRoomId) {
      if (ONLINE) {
        const r = await Api.updateRoom(editingRoomId, patch);
        if (!r.ok) return fail(r.message || "Gagal menyimpan perubahan di backend.");
        await refreshRoomsFromApi();
      } else {
        adminUpdateRoom(editingRoomId, patch);
      }
      showToast(`Ruangan "${name}" berhasil diperbarui. ✅`);
    } else {
      const roomId = el("rmId").value.trim() || slugifyRoomId(name);
      if (ROOMS_DATA.some((r) => r.id === roomId)) {
        return fail(`Kode ruangan "${roomId}" sudah dipakai ruangan lain.`);
      }
      const newRoom = { id: roomId, ...patch };
      if (ONLINE) {
        const r = await Api.createRoom(newRoom);
        if (!r.ok) return fail(r.message || "Gagal menyimpan ruangan di backend.");
        await refreshRoomsFromApi();
      } else {
        adminAddRoom(newRoom);
      }
      showToast(`Ruangan "${name}" berhasil ditambahkan. 🏫`);
    }
    closeRoomModal();
    await loadBookings();
    renderRooms();
    syncRoomFilter();
  } finally {
    saveBtn.disabled = false;
  }
}

async function removeRoomById(roomId) {
  const room = ROOMS_DATA.find((r) => r.id === roomId);
  if (!room) return;
  const count = (room.bookings || []).length;

  const ok = await confirmAction(
    `Ruangan ${room.name} (${room.id}) akan dihapus${
      count ? ` beserta ${count} pemesanan yang terkait dengannya` : ""
    }. Tindakan ini tidak bisa dibatalkan.`,
    "Ya, Hapus Ruangan"
  );
  if (!ok) return;

  if (ONLINE) {
    const r = await Api.deleteRoom(roomId);
    if (!r.ok) {
      showToast(r.message || "Gagal menghapus ruangan di backend.");
      return;
    }
    await refreshRoomsFromApi();
  } else {
    adminRemoveRoom(roomId);
  }
  await loadBookings();
  await loadUsers();
  renderRooms();
  syncRoomFilter();
  showToast(`Ruangan "${room.name}" dihapus. 🗑️`);
}

function syncRoomFilter() {
  if (activeView === "bookings") renderBookings();
}

/* ---------------------------------------------------------
   View 4: Daftar Pengguna
--------------------------------------------------------- */
const ROLE_TAGS = {
  ADMIN: "tag--role-admin",
  STUDENT: "tag--role-student",
  LECTURER: "tag--role-lecturer",
};
const ROLE_LABELS = { ADMIN: "Admin", STUDENT: "Mahasiswa", LECTURER: "Dosen" };

function renderUsers() {
  el("usrCount").textContent = USER_LIST.length;
  el("usrBody").innerHTML = USER_LIST.length
    ? USER_LIST.map(
        (u) => `
      <tr>
        <td class="mono" data-label="NIM / NIDN">${esc(u.nim_nidn)}</td>
        <td data-label="Nama">${esc(u.full_name)}${u.nim_nidn === adminSession.nim ? ' <span class="tag tag--ok">Anda</span>' : ""}</td>
        <td data-label="Peran"><span class="tag ${ROLE_TAGS[u.role] || "tag--cat"}">${esc(ROLE_LABELS[u.role] || u.role)}</span></td>
        <td data-label="Pemesanan"><strong>${esc(u.booking_count)}</strong> booking</td>
      </tr>`
      ).join("")
    : `<tr><td colspan="4" class="admin-empty">Belum ada pengguna terdaftar.</td></tr>`;
}

/* ---------------------------------------------------------
   Modal konfirmasi (Promise-based)
--------------------------------------------------------- */
let confirmResolve = null;

function confirmAction(message, okLabel, variant) {
  return new Promise((resolve) => {
    confirmResolve = resolve;
    el("confirmText").textContent = message;
    const okBtn = el("confirmOk");
    okBtn.textContent = okLabel || "Ya, Hapus";
    okBtn.classList.toggle("btn--gold", variant === "gold");
    okBtn.classList.toggle("btn--danger", variant !== "gold");
    el("confirmModal").hidden = false;
    okBtn.focus();
  });
}

function settleConfirm(value) {
  el("confirmModal").hidden = true;
  if (confirmResolve) {
    confirmResolve(value);
    confirmResolve = null;
  }
}

/* ---------------------------------------------------------
   Muat ulang seluruh data + render
--------------------------------------------------------- */
async function reloadAll() {
  await loadBookings();
  await loadUsers();
  renderActiveView();
}

/* ---------------------------------------------------------
   Init
--------------------------------------------------------- */
(function initAdmin() {
  // Kepala halaman
  el("adminName").textContent = `${adminSession.name} · ${adminSession.nim}`;

  // Navigasi sidebar
  document.querySelectorAll(".admin-nav__item").forEach((btn) => {
    btn.addEventListener("click", () => switchView(btn.dataset.view));
  });
  document.querySelectorAll("[data-goto]").forEach((btn) => {
    btn.addEventListener("click", () => switchView(btn.dataset.goto));
  });

  // Keluar
  el("adminLogout").addEventListener("click", () => {
    clearSession();
    showToast("Anda telah keluar. Sampai jumpa! 👋");
    setTimeout(() => window.location.replace("index.html"), 600);
  });

  // Filter pemesanan (tanggal)
  el("bkChips").addEventListener("click", (e) => {
    const chip = e.target.closest(".f-chip");
    if (!chip) return;
    bkScope = chip.dataset.scope;
    el("bkChips").querySelectorAll(".f-chip").forEach((c) => c.classList.toggle("is-active", c === chip));
    renderBookings();
  });
  // Filter pemesanan (status persetujuan) — Task 5
  el("bkStatusChips").addEventListener("click", (e) => {
    const chip = e.target.closest(".f-chip");
    if (!chip) return;
    bkStatus = chip.dataset.bstatus;
    el("bkStatusChips").querySelectorAll(".f-chip").forEach((c) => c.classList.toggle("is-active", c === chip));
    renderBookings();
  });
  el("bkSearch").addEventListener("input", renderBookings);
  el("bkRoom").addEventListener("change", renderBookings);
  el("bkDate").addEventListener("change", renderBookings);

  // Aksi baris pemesanan: detail, setujui, tolak, hapus (delegasi)
  el("bkBody").addEventListener("click", (e) => {
    const detailBtn = e.target.closest("[data-detail-booking]");
    if (detailBtn) return openDetailByIndex(Number(detailBtn.dataset.detailBooking));

    const approveBtn = e.target.closest("[data-approve-booking]");
    if (approveBtn) return decideBooking(Number(approveBtn.dataset.approveBooking), "approved");

    const rejectBtn = e.target.closest("[data-reject-booking]");
    if (rejectBtn) return decideBooking(Number(rejectBtn.dataset.rejectBooking), "rejected");

    const delBtn = e.target.closest("[data-del-booking]");
    if (delBtn) deleteBookingByIndex(Number(delBtn.dataset.delBooking));
  });

  // Modal detail pengajuan
  el("detailClose").addEventListener("click", closeDetailModal);
  el("detailDismiss").addEventListener("click", closeDetailModal);
  el("detailApprove").addEventListener("click", () => {
    if (detailRowIndex != null) decideBooking(detailRowIndex, "approved");
  });
  el("detailReject").addEventListener("click", () => {
    if (detailRowIndex != null) decideBooking(detailRowIndex, "rejected");
  });
  el("detailModal").addEventListener("click", (e) => {
    if (e.target === el("detailModal")) closeDetailModal();
  });

  // Pintasan dashboard: proses pengajuan yang menunggu
  const pendingProcessBtn = el("pendingProcessBtn");
  if (pendingProcessBtn) {
    pendingProcessBtn.addEventListener("click", () => {
      bkStatus = "pending";
      el("bkStatusChips").querySelectorAll(".f-chip").forEach((c) =>
        c.classList.toggle("is-active", c.dataset.bstatus === "pending")
      );
      switchView("bookings");
    });
  }

  // Ruangan: tambah / edit / hapus
  el("addRoomBtn").addEventListener("click", () => openRoomModal(null));
  el("roomModalClose").addEventListener("click", closeRoomModal);
  el("roomCancel").addEventListener("click", closeRoomModal);
  el("roomForm").addEventListener("submit", (e) => {
    e.preventDefault();
    saveRoom();
  });
  el("rmName").addEventListener("input", () => {
    if (!editingRoomId && !rmIdTouched) {
      el("rmId").value = slugifyRoomId(el("rmName").value || "RUANGAN");
    }
  });
  el("rmId").addEventListener("input", () => {
    rmIdTouched = true;
  });
  el("roomGridAdmin").addEventListener("click", (e) => {
    const editBtn = e.target.closest("[data-edit-room]");
    if (editBtn) {
      openRoomModal(editBtn.dataset.editRoom);
      return;
    }
    const delBtn = e.target.closest("[data-del-room]");
    if (delBtn) removeRoomById(delBtn.dataset.delRoom);
  });

  // Modal konfirmasi
  el("confirmOk").addEventListener("click", () => settleConfirm(true));
  el("confirmCancel").addEventListener("click", () => settleConfirm(false));

  // Tutup modal dengan ESC
  document.addEventListener("keydown", (e) => {
    if (e.key !== "Escape") return;
    if (!el("confirmModal").hidden) settleConfirm(false);
    else if (!el("detailModal").hidden) closeDetailModal();
    else if (!el("roomModal").hidden) closeRoomModal();
  });

  // Mulai
  (async () => {
    await detectMode();
    await reloadAll();
  })();
})();
