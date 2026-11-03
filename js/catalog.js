/* =========================================================
   SIBORU — Main Room Catalog (Task 3.5)
   Sumber data: koleksi lokal ROOMS_DATA (js/rooms.js).
   Bila backend aktif, status booking per tanggal diambil
   dari GET /api/rooms/status dan di-merge per room id.
   ========================================================= */

/* ---------------------------------------------------------
   Route guard: hanya bisa diakses setelah login
   (session lama tanpa id user -> minta login ulang)
--------------------------------------------------------- */
const session = getSession();
if (!session || !session.id) {
  clearSession();
  window.location.replace("index.html");
}

/* ---------------------------------------------------------
   State
--------------------------------------------------------- */
let ROOMS = [];

const grid = document.getElementById("roomGrid");
const emptyState = document.getElementById("emptyState");
const emptyTitle = document.getElementById("emptyTitle");
const emptyText = document.getElementById("emptyText");
const searchInput = document.getElementById("searchInput");
const filterTabs = document.getElementById("filterTabs");
const gridTitle = document.getElementById("gridTitle");
const resultCount = document.getElementById("resultCount");
const dateCaption = document.getElementById("dateCaption");
const toast = document.getElementById("toast");

let activeCategory = "all";
let searchTerm = "";

/* ---------------------------------------------------------
   Sapaan & aksi header
--------------------------------------------------------- */
(function initHeader() {
  if (!session) return;

  const roleLabel = session.role === "LECTURER" ? "Dosen" : session.role === "ADMIN" ? "Admin" : "Mahasiswa";
  document.getElementById("greetingTitle").textContent = `Halo, ${roleLabel} 👋`;

  const nameEl = document.getElementById("userName");
  const roleEl = document.getElementById("userRole");
  const avatarEl = document.getElementById("userAvatar");

  nameEl.textContent = `${session.name} · ${session.nim}`;
  roleEl.textContent = session.role;
  roleEl.dataset.role = session.role;
  avatarEl.textContent = session.role === "LECTURER" ? "D" : session.role === "ADMIN" ? "A" : "M";

  /* Task 4: tautan Panel Admin hanya untuk peran ADMIN */
  const adminPanelBtn = document.getElementById("adminPanelBtn");
  if (adminPanelBtn && session.role === "ADMIN") {
    adminPanelBtn.hidden = false;
    adminPanelBtn.addEventListener("click", () => {
      window.location.href = "admin.html";
    });
  }

  document.getElementById("logoutBtn").addEventListener("click", () => {
    clearSession();
    showToast("Anda telah keluar. Sampai jumpa! 👋");
    setTimeout(() => window.location.replace("index.html"), 600);
  });

  /* Task 5: riwayat peminjaman milik pengguna yang sedang login */
  const historyBtn = document.getElementById("historyBtn");
  if (historyBtn) historyBtn.addEventListener("click", openHistoryModal);
})();

/* ---------------------------------------------------------
   Status lokal (mode offline / tanpa backend)
--------------------------------------------------------- */
const OPS_OPEN = "08:00";
const OPS_CLOSE = "17:00";

function toMin(t) {
  const [h, m] = t.split(":").map(Number);
  return h * 60 + m;
}

/** Apakah booking menutup penuh jam operasional 08.00-17.00? */
function coversFullDay(bookings) {
  const sorted = bookings
    .map((b) => [toMin(b.start_time), toMin(b.end_time)])
    .sort((a, b) => a[0] - b[0]);

  let cursor = toMin(OPS_OPEN);
  const close = toMin(OPS_CLOSE);

  for (const [s, e] of sorted) {
    if (s > cursor) return false;
    cursor = Math.max(cursor, e);
    if (cursor >= close) return true;
  }
  return cursor >= close;
}

/** Bentuk objek ruangan + status untuk satu tanggal (tanpa backend).
    Booking berstatus "ditolak" tidak dihitung menempati slot. */
function computeLocalStatus(room, iso) {
  const bookings = room.bookings.filter((b) => b.booking_date === iso && bookingOccupiesSlot(b));
  const isFull = room.room_status === "Tersedia" && coversFullDay(bookings);

  let statusKey = "available";
  let status = "Tersedia";
  if (room.room_status !== "Tersedia") {
    statusKey = "maintenance";
    status = room.room_status;
  } else if (isFull) {
    statusKey = "full";
    status = "FULL / BOOKED";
  } else if (bookings.length) {
    statusKey = "busy";
    status = "Terpakai";
  }

  return { ...room, bookings, is_full: isFull, status, status_key: statusKey };
}

/* ---------------------------------------------------------
   Ambil status ruangan (backend dulu, fallback lokal)
--------------------------------------------------------- */
async function loadRoomStatus() {
  const iso = activeBookingDate;
  const result = await Api.roomsStatus(iso);

  if (result.ok && result.data && Array.isArray(result.data.rooms)) {
    // Backend aktif -> merge status server per room id
    ROOMS = ROOMS_DATA.map((local) => {
      const remote = result.data.rooms.find((r) => r.id === local.id);
      if (!remote) return computeLocalStatus(local, iso);
      return {
        ...local,
        bookings: remote.bookings || [],
        is_full: !!remote.is_full,
        status: remote.status,
        status_key: remote.status_key || "available",
      };
    });
    console.info("[catalog] status dari backend:", iso);
  } else {
    // Backend tidak aktif -> status dihitung lokal dari ROOMS_DATA
    ROOMS = ROOMS_DATA.map((room) => computeLocalStatus(room, iso));
    console.info("[catalog] mode lokal (backend tidak aktif):", iso);
  }

  renderRooms();
  return ROOMS;
}

/* ---------------------------------------------------------
   Render kartu ruangan (kartu berbasis gambar)
--------------------------------------------------------- */
function renderRooms() {
  const term = searchTerm.toLowerCase();
  const filtered = ROOMS.filter((room) => {
    const matchCategory = activeCategory === "all" || room.category === activeCategory;
    const matchSearch =
      !term ||
      room.name.toLowerCase().includes(term) ||
      room.category.toLowerCase().includes(term) ||
      room.id.toLowerCase().includes(term);
    return matchCategory && matchSearch;
  });

  dateCaption.textContent = `Status per: ${formatDateID(activeBookingDate)}`;

  if (!ROOMS.length) {
    grid.innerHTML = "";
    emptyState.hidden = false;
    emptyTitle.textContent = "Ruangan tidak ditemukan";
    emptyText.textContent = "Coba kata kunci lain atau pilih kategori “Semua”.";
    resultCount.textContent = "0 ruangan";
    document.getElementById("statTotal").textContent = "0";
    document.getElementById("statAvailable").textContent = "0";
    return;
  }

  emptyState.hidden = filtered.length !== 0;
  if (filtered.length) {
    emptyTitle.textContent = "Ruangan tidak ditemukan";
    emptyText.textContent = "Coba kata kunci lain atau pilih kategori “Semua”.";
  }
  resultCount.textContent = `${filtered.length} ruangan`;

  grid.innerHTML = filtered
    .map((room, i) => {
      const isBookable = room.status_key !== "maintenance";
      return `
      <article class="room-card" data-category="${room.category}" style="animation-delay:${i * 55}ms">
        <div class="room-card__media">
          <img src="${room.image}" class="room-image" alt="${room.name}"
               onerror="this.onerror=null;this.src=this.src.replace('.jpg','.svg')" />
          <span class="status-badge" data-status="${room.status_key}">${room.status}</span>
        </div>

        <div class="room-card__body">
          <span class="category-tag">${room.category}</span>
          <h3 class="room-card__title">${room.name}</h3>
          <p class="room-card__desc">${room.description}</p>

          <div class="room-meta">
            <span class="room-meta__item" title="Kode Ruangan">
              <svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor"
                   stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"></path>
              </svg>
              <strong>${room.id}</strong>
            </span>
            <span class="room-meta__item" title="Kapasitas">
              <svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor"
                   stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"></path>
                <circle cx="9" cy="7" r="4"></circle>
                <path d="M23 21v-2a4 4 0 0 0-3-3.87"></path>
                <path d="M16 3.13a4 4 0 0 1 0 7.75"></path>
              </svg>
              Kapasitas <strong>${room.capacity}</strong> orang
            </span>
          </div>
        </div>

        <div class="room-card__foot">
          <button
            type="button"
            class="btn ${isBookable ? "btn--gold" : "btn--outline"}"
            data-room-id="${room.id}"
            ${isBookable ? "" : "disabled"}
          >
            ${isBookable ? "Pesan Ruangan" : "Tidak Tersedia"}
          </button>
        </div>
      </article>`;
    })
    .join("");

  document.getElementById("statTotal").textContent = ROOMS.length;
  document.getElementById("statAvailable").textContent =
    ROOMS.filter((r) => r.status_key === "available").length;

  /* Klik "Pesan Ruangan" -> buka modal pemesanan */
  grid.querySelectorAll(".btn[data-room-id]").forEach((btn) => {
    if (btn.disabled) return;
    btn.addEventListener("click", () => {
      const room = ROOMS.find((r) => r.id === btn.dataset.roomId);
      if (room) openBookingModal(room);
    });
  });
}

/* ---------------------------------------------------------
   Filter kategori & pencarian
--------------------------------------------------------- */
filterTabs.addEventListener("click", (e) => {
  const tab = e.target.closest(".filter-tab");
  if (!tab) return;

  filterTabs.querySelectorAll(".filter-tab").forEach((t) => {
    t.classList.toggle("is-active", t === tab);
    t.setAttribute("aria-selected", t === tab ? "true" : "false");
  });

  activeCategory = tab.dataset.category;
  gridTitle.textContent = activeCategory === "all" ? "Semua Ruangan" : activeCategory;
  renderRooms();
});

searchInput.addEventListener("input", (e) => {
  searchTerm = e.target.value.trim();
  renderRooms();
});

/* ---------------------------------------------------------
   Toast helper
--------------------------------------------------------- */
let toastTimer;
function showToast(message) {
  toast.textContent = message;
  toast.classList.add("is-show");
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => toast.classList.remove("is-show"), 3200);
}

/* Initial load */
loadRoomStatus();

/* ---------------------------------------------------------
   Task 5 — Riwayat Peminjaman (pengajuan milik pengguna)
   Status: pending (menunggu) / approved (disetujui) / rejected (ditolak)
--------------------------------------------------------- */
const historyModal = {
  root: document.getElementById("historyModal"),
  list: document.getElementById("historyList"),
  chips: document.getElementById("historyChips"),
  summary: document.getElementById("historySummary"),
  close: document.getElementById("historyClose"),
};

const STATUS_META = {
  pending:  { label: "Menunggu Persetujuan", tag: "tag--pending",  icon: "⏳" },
  approved: { label: "Disetujui",            tag: "tag--approved", icon: "✓" },
  rejected: { label: "Ditolak",              tag: "tag--rejected", icon: "✕" },
};

let historyFilter = "all";
let historyRows = [];

/** Booking milik pengguna yang sedang login (dari data lokal yang sudah dimerge) */
function myBookings() {
  return flatBookings()
    .filter((b) => session && b.user_id === session.id)
    .sort(
      (a, b) =>
        String(b.booking_date).localeCompare(String(a.booking_date)) ||
        toMin(b.start_time) - toMin(a.start_time)
    );
}

/** Susun objek rincian struk dari sebuah booking pada riwayat */
function receiptDataFromBooking(b) {
  return {
    booking_id: b.id,
    room_id: b.room_id,
    room_name: b.room_name,
    room_icon: b.room_icon,
    booking_date: b.booking_date,
    start_time: b.start_time,
    end_time: b.end_time,
    purpose: b.purpose,
    organization_name: b.organization_name,
    status: bookingStatusOf(b),
  };
}

function openHistoryModal() {
  historyFilter = "all";
  historyModal.chips.querySelectorAll(".f-chip").forEach((c) =>
    c.classList.toggle("is-active", c.dataset.hstatus === "all")
  );
  renderHistory();
  historyModal.root.hidden = false;
  document.body.style.overflow = "hidden";
}

function closeHistoryModal() {
  historyModal.root.hidden = true;
  if (bookingModal.root.hidden) document.body.style.overflow = "";
}

function renderHistory() {
  const all = myBookings();
  const count = (s) => all.filter((b) => bookingStatusOf(b) === s).length;

  historyModal.summary.textContent = all.length
    ? `${all.length} pengajuan · ${count("pending")} menunggu · ${count("approved")} disetujui · ${count("rejected")} ditolak`
    : "Belum ada pengajuan peminjaman";

  historyRows =
    historyFilter === "all" ? all : all.filter((b) => bookingStatusOf(b) === historyFilter);

  if (!historyRows.length) {
    historyModal.list.innerHTML = `
      <div class="empty-state">
        <div class="empty-state__icon">📭</div>
        <h3>Belum ada riwayat</h3>
        <p>${
          all.length
            ? "Tidak ada pengajuan dengan status yang dipilih."
            : "Ajukan peminjaman ruangan dari katalog untuk memulai."
        }</p>
      </div>`;
    return;
  }

  historyModal.list.innerHTML = historyRows
    .map((b, i) => {
      const st = bookingStatusOf(b);
      const meta = STATUS_META[st] || STATUS_META.approved;
      const decided = b.decided_at
        ? new Date(b.decided_at).toLocaleString("id-ID", {
            day: "numeric", month: "long", year: "numeric", hour: "2-digit", minute: "2-digit",
          })
        : null;

      return `
      <article class="history-card" data-status="${st}">
        <div class="history-card__head">
          <span class="history-card__room">${b.room_icon || "🏫"} ${b.room_name}</span>
          <span class="tag ${meta.tag}">${meta.icon} ${meta.label}</span>
        </div>

        <dl class="history-card__grid">
          <div><dt>Booking ID</dt><dd class="mono">${b.id || "—"}</dd></div>
          <div><dt>Tanggal</dt><dd>${formatDateID(b.booking_date)}</dd></div>
          <div><dt>Jam</dt><dd>${rangeLabel(b.start_time, b.end_time)}</dd></div>
          <div><dt>Kepentingan</dt><dd>${b.purpose || "-"}</dd></div>
          <div><dt>Atas Nama</dt><dd>${b.organization_name || "-"}</dd></div>
          <div><dt>Kode Ruangan</dt><dd>${b.room_id}</dd></div>
        </dl>

        ${
          st === "pending"
            ? `<p class="history-card__note">⏳ Menunggu persetujuan admin — slot sudah diamankan untuk Anda.</p>`
            : ""
        }
        ${
          st === "approved"
            ? `<p class="history-card__note history-card__note--ok">✓ Disetujui${
                decided ? ` ${decided}` : ""
              } — struk dapat diunduh atau dibagikan.</p>`
            : ""
        }
        ${
          st === "rejected"
            ? `<p class="history-card__note history-card__note--no">✕ Ditolak${
                decided ? ` ${decided}` : ""
              }${b.reject_reason ? ` — ${b.reject_reason}` : ""}. Slot kembali dibuka untuk pemesanan.</p>`
            : ""
        }

        ${
          st === "approved"
            ? `<div class="history-card__foot">
                <button type="button" class="btn btn--outline btn--sm" data-hdl="${i}">
                  Unduh Struk (PNG)
                </button>
                <button type="button" class="btn btn--wa btn--sm" data-hwa="${i}">
                  Bagikan ke WhatsApp
                </button>
              </div>`
            : ""
        }
      </article>`;
    })
    .join("");
}

/* Aksi pada kartu riwayat: unduh struk & bagikan ke WhatsApp */
historyModal.list.addEventListener("click", async (e) => {
  const dlBtn = e.target.closest("[data-hdl]");
  const waBtn = e.target.closest("[data-hwa]");
  if (!dlBtn && !waBtn) return;

  const b = historyRows[Number(dlBtn ? dlBtn.dataset.hdl : waBtn.dataset.hwa)];
  if (!b) return;
  const data = receiptDataFromBooking(b);

  if (dlBtn) {
    try {
      const blob = await prepareReceiptPNG(data);
      downloadBlobAsFile(blob, `struk-${data.booking_id}.png`);
      showToast(`Struk ${data.booking_id} berhasil diunduh sebagai PNG 📄`);
    } catch (err) {
      showToast("Maaf, struk gagal dibuat. Coba lagi.");
    }
    return;
  }

  // Bagikan ke WhatsApp (share sheet, fallback: buka wa.me + unduh PNG)
  const filename = `struk-${data.booking_id}.png`;
  const text = receiptWaText(data);
  try {
    const blob = await prepareReceiptPNG(data);
    const file = new File([blob], filename, { type: "image/png" });
    if (navigator.canShare && navigator.canShare({ files: [file] })) {
      try {
        await navigator.share({ files: [file], title: `Struk Pemesanan ${data.booking_id}`, text });
        showToast("Struk siap dibagikan ke WhatsApp 📤");
        return;
      } catch (err) {
        if (err && err.name === "AbortError") return;
      }
    }
    window.open("https://wa.me/?text=" + encodeURIComponent(text), "_blank", "noopener");
    downloadBlobAsFile(blob, filename);
    showToast("WhatsApp terbuka dengan rincian struk — lampirkan PNG yang baru diunduh 📎");
  } catch (err) {
    showToast("Maaf, struk gagal dibagikan. Coba lagi.");
  }
});

/* Filter status pada modal riwayat */
historyModal.chips.addEventListener("click", (e) => {
  const chip = e.target.closest(".f-chip");
  if (!chip) return;
  historyFilter = chip.dataset.hstatus;
  historyModal.chips.querySelectorAll(".f-chip").forEach((c) => c.classList.toggle("is-active", c === chip));
  renderHistory();
});

/* Tombol "Lihat Riwayat Peminjaman" pada layar konfirmasi pengajuan */
const receiptHistoryBtn = document.getElementById("receiptHistoryBtn");
if (receiptHistoryBtn) {
  receiptHistoryBtn.addEventListener("click", () => {
    closeBookingModal();
    openHistoryModal();
  });
}

/* Tutup modal riwayat */
historyModal.close.addEventListener("click", closeHistoryModal);
historyModal.root.addEventListener("click", (e) => {
  if (e.target === historyModal.root) closeHistoryModal();
});
document.addEventListener("keydown", (e) => {
  if (e.key === "Escape" && !historyModal.root.hidden) closeHistoryModal();
});
