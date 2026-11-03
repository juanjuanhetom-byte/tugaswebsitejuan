/* =========================================================
   SIBORU — Booking Form Modal & Business Rules (Task 3)
   - Validasi aturan bisnis di sisi client (UX instan)
   - Konflik & penyimpanan divalidasi OLEH SERVER (SQLite)
   Harus dimuat SEBELUM catalog.js.
   ========================================================= */

/* ---------------------------------------------------------
   Helper tanggal & jam
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
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(y, m - 1, d);
}

/** "Minggu, 18 Oktober 2026" */
function formatDateID(iso) {
  if (!iso) return "-";
  const d = parseISO(iso);
  return `${DAY_NAMES[d.getDay()]}, ${d.getDate()} ${MONTH_NAMES[d.getMonth()]} ${d.getFullYear()}`;
}

/** true jika hari Senin–Jumat */
function isWeekday(iso) {
  const g = parseISO(iso).getDay();
  return g >= 1 && g <= 5;
}

/** "09:00" -> 540 */
function toMinutes(t) {
  const [h, m] = t.split(":").map(Number);
  return h * 60 + m;
}

/** "09:00" -> "09.00" */
function fmtHour(t) {
  return t.replace(":", ".");
}

function rangeLabel(start, end) {
  return `${fmtHour(start)} – ${fmtHour(end)}`;
}

/** Preview bentrok: booking pada tanggal terpilih (data API atau lokal).
    Booking berstatus "ditolak" tidak menempati slot sehingga bisa dipakai ulang. */
function previewConflicts(room, iso, start, end) {
  const s = toMinutes(start);
  const e = toMinutes(end);
  return (room.bookings || []).filter(
    (b) => bookingOccupiesSlot(b) &&
           (!b.booking_date || b.booking_date === iso) &&
           s < toMinutes(b.end_time) &&
           e > toMinutes(b.start_time)
  );
}

/** Label status pada daftar bentrok — "menunggu" ikut menahan slot */
function conflictStatusLabel(b) {
  return bookingStatusOf(b) === "pending" ? "menunggu persetujuan" : "disetujui";
}

/* ---------------------------------------------------------
   Tanggal yang sedang ditampilkan di grid
--------------------------------------------------------- */
let activeBookingDate = todayISO();

/* ---------------------------------------------------------
   Modal controller
--------------------------------------------------------- */
const bookingModal = {
  root: document.getElementById("bookingModal"),
  icon: document.getElementById("modalRoomIcon"),
  name: document.getElementById("modalRoomName"),
  sub: document.getElementById("modalRoomSub"),
  close: document.getElementById("modalClose"),
  formView: document.getElementById("bookingFormView"),
  receiptView: document.getElementById("receiptView"),
  form: document.getElementById("bookingForm"),
  alert: document.getElementById("bookingAlert"),
  alertText: document.getElementById("bookingAlertText"),
  date: document.getElementById("bookDate"),
  dateError: document.getElementById("dateError"),
  purpose: document.getElementById("bookPurpose"),
  start: document.getElementById("bookStart"),
  end: document.getElementById("bookEnd"),
  sender: document.getElementById("bookSender"),
  conflictBox: document.getElementById("conflictBox"),
  conflictText: document.getElementById("conflictText"),
  conflictList: document.getElementById("conflictList"),
  cancel: document.getElementById("cancelBooking"),
  confirm: document.getElementById("confirmBooking"),
  receiptId: document.getElementById("receiptId"),
  receiptIcon: document.getElementById("receiptIcon"),
  receiptTitle: document.getElementById("receiptTitle"),
  receiptSub: document.getElementById("receiptSub"),
  receiptNote: document.getElementById("receiptNote"),
  receiptActions: document.getElementById("receiptActions"),
  receiptHistoryBtn: document.getElementById("receiptHistoryBtn"),
  receiptDetails: document.getElementById("receiptDetails"),
  receiptDownload: document.getElementById("receiptDownload"),
  receiptWhatsapp: document.getElementById("receiptWhatsapp"),
  receiptClose: document.getElementById("receiptClose"),
};

let currentBookingRoom = null;

function showModalView(view) {
  bookingModal.formView.hidden = view !== "form";
  bookingModal.receiptView.hidden = view !== "receipt";
}

/** Buka modal pemesanan untuk sebuah ruangan (objek dari API /rooms/status) */
function openBookingModal(room) {
  currentBookingRoom = room;

  bookingModal.icon.textContent = room.icon;
  bookingModal.name.textContent = room.name;
  bookingModal.sub.textContent =
    `${room.category} · Kapasitas ${room.capacity} orang · Kode ${room.id}` +
    (room.weekend_only ? " · Akhir pekan saja" : "");

  // reset isian form
  showModalView("form");
  bookingModal.date.min = todayISO();
  bookingModal.date.value = activeBookingDate;
  bookingModal.start.value = "";
  bookingModal.end.value = "";
  bookingModal.purpose.value = "";
  bookingModal.sender.value = session ? session.name : "";

  bookingModal.root.hidden = false;
  document.body.style.overflow = "hidden";

  validateBooking(false);
  bookingModal.date.focus();
}

function closeBookingModal() {
  bookingModal.root.hidden = true;
  document.body.style.overflow = "";
  currentBookingRoom = null;
  showModalView("form");
}

/** Setelah data ruangan terbaru datang dari server, ikutkan ke modal */
function syncModalWithLatestRooms() {
  if (!currentBookingRoom) return;
  const latest = ROOMS.find((r) => r.id === currentBookingRoom.id);
  if (latest) currentBookingRoom = latest;
  validateBooking(false);
}

/* ---------------------------------------------------------
   Validasi form (client-side; server tetap memvalidasi ulang)
--------------------------------------------------------- */
function validateBooking(showRequired) {
  const room = currentBookingRoom;
  const iso = bookingModal.date.value;
  const start = bookingModal.start.value;
  const end = bookingModal.end.value;

  const issues = [];

  // reset indikator
  [bookingModal.date, bookingModal.purpose, bookingModal.start, bookingModal.end, bookingModal.sender]
    .forEach((el) => el.classList.remove("is-invalid"));
  bookingModal.dateError.hidden = true;
  bookingModal.conflictBox.hidden = true;

  // --- Aturan 1: ruang kelas (weekend_only) hanya untuk Sabtu/Minggu ---
  const weekendOnly = room && room.weekend_only;
  if (weekendOnly && iso && isWeekday(iso)) {
    bookingModal.dateError.hidden = false;
    bookingModal.date.classList.add("is-invalid");
    issues.push(
      "Ruang Kelas Reguler hanya dapat digunakan pada hari Sabtu dan Minggu untuk sesi non-perkuliahan."
    );
  }

  // --- Jam selesai harus setelah jam mulai ---
  const timeInvalid = start && end && toMinutes(end) <= toMinutes(start);
  if (timeInvalid) {
    bookingModal.end.classList.add("is-invalid");
    issues.push("Jam Selesai harus lebih besar daripada Jam Mulai.");
  }

  // --- Aturan 2: preview bentrok dengan data booking yang sudah terdaftar ---
  if (room && iso && start && end && !timeInvalid) {
    const conflicts = previewConflicts(room, iso, start, end);
    if (conflicts.length) {
      bookingModal.conflictBox.hidden = false;
      bookingModal.conflictText.textContent =
        `Jadwal bentrok dengan pemesanan yang sudah terdaftar di ${room.name} pada ${formatDateID(iso)}:`;
      bookingModal.conflictList.innerHTML = conflicts
        .map(
          (c) =>
            `<li><strong>${rangeLabel(c.start_time, c.end_time)}</strong> &middot; ${c.organization_name} &middot; ${c.purpose} <span class="conflict-status">(${conflictStatusLabel(c)})</span></li>`
        )
        .join("");
      issues.push("Slot sudah FULL / BENTROK — silakan ubah tanggal atau jam pemesanan.");
    }
  }

  // --- Kelengkapan isian (dicek saat submit) ---
  if (showRequired) {
    const missing = [];
    if (!iso) { missing.push("Tanggal Pemesanan"); bookingModal.date.classList.add("is-invalid"); }
    if (!start) { missing.push("Jam Mulai"); bookingModal.start.classList.add("is-invalid"); }
    if (!end) { missing.push("Jam Selesai"); bookingModal.end.classList.add("is-invalid"); }
    if (!bookingModal.purpose.value) { missing.push("Kepentingan / Keperluan"); bookingModal.purpose.classList.add("is-invalid"); }
    if (!bookingModal.sender.value.trim()) { missing.push("Atas Nama Pengirim"); bookingModal.sender.classList.add("is-invalid"); }
    if (missing.length) issues.push(`Harap lengkapi isian berikut: ${missing.join(", ")}.`);
  }

  if (issues.length) {
    bookingModal.alertText.textContent = issues.join(" ");
    bookingModal.alert.hidden = false;
  } else {
    bookingModal.alert.hidden = true;
  }

  // Tombol Konfirmasi dinonaktifkan jika terjadi bentrok / aturan terlanggar
  bookingModal.confirm.disabled = issues.length > 0;
  return issues.length === 0;
}

/* ---------------------------------------------------------
   Tampilkan kegagalan API di dalam modal
--------------------------------------------------------- */
function showServerRejection(result) {
  bookingModal.alertText.textContent = result.message;
  bookingModal.alert.hidden = false;

  if (result.httpStatus === 409 && result.conflict) {
    // FULL / BENTROK dari transaksi database
    bookingModal.conflictBox.hidden = false;
    bookingModal.conflictText.textContent =
      `${result.message} — periksa kembali rentang waktu Anda:`;
    bookingModal.conflictList.innerHTML =
      `<li><strong>${rangeLabel(result.conflict.start_time, result.conflict.end_time)}</strong> &middot; ${result.conflict.organization_name}</li>`;
    bookingModal.confirm.disabled = true;
    bookingModal.date.classList.add("is-invalid");
    bookingModal.start.classList.add("is-invalid");
    bookingModal.end.classList.add("is-invalid");
  }
}

/* ---------------------------------------------------------
   Mode offline: simpan booking langsung ke koleksi lokal
   (dipakai ketika backend Express belum aktif — setara Task 2)
--------------------------------------------------------- */
function generateLocalBookingId(iso) {
  const stamp = iso.replace(/-/g, "");
  let id;
  do {
    id = `RB-${stamp}-${Math.floor(1000 + Math.random() * 9000)}`;
  } while (ROOMS_DATA.some((r) => r.bookings.some((b) => b.id === id)));
  return id;
}

function createLocalBooking(payload) {
  const room = ROOMS_DATA.find((r) => r.id === payload.room_id);
  if (!room) return { ok: false, httpStatus: 404, message: "Ruangan tidak ditemukan." };

  // Aturan ruang kelas hanya akhir pekan
  if (room.weekend_only && isWeekday(payload.booking_date)) {
    return {
      ok: false,
      httpStatus: 400,
      message:
        "Ruang Kelas Reguler hanya dapat digunakan pada hari Sabtu dan Minggu untuk sesi non-perkuliahan.",
    };
  }

  // Anti-bentrok (yang menolak sudah tidak menempati slot)
  const conflicts = previewConflicts(room, payload.booking_date, payload.start_time, payload.end_time);
  if (conflicts.length) {
    const c = conflicts[0];
    return {
      ok: false,
      httpStatus: 409,
      message:
        "FULL / BENTROK: Ruangan telah dipesan / diajukan peminjaman lain pada slot waktu tersebut (menunggu persetujuan atau sudah disetujui).",
      conflict: {
        start_time: c.start_time,
        end_time: c.end_time,
        organization_name: c.organization_name,
      },
    };
  }

  const id = generateLocalBookingId(payload.booking_date);
  const newBooking = {
    id,
    ...payload,
    full_name: session ? session.name : "-",
    nim_nidn: session ? session.nim : null,
    // Task 5: setiap pengajuan baru menunggu persetujuan admin
    status: "pending",
    created_at: new Date().toISOString(),
  };
  room.bookings.push(newBooking);
  // Task 4: simpan persisten agar booking bertahan setelah reload
  // dan bisa dilihat/dikelola lewat panel admin
  persistLocalBooking(newBooking);

  return {
    ok: true,
    httpStatus: 201,
    data: {
      booking_id: id,
      room_id: room.id,
      room_name: room.name,
      booking_date: payload.booking_date,
      start_time: payload.start_time,
      end_time: payload.end_time,
      purpose: payload.purpose,
      organization_name: payload.organization_name,
      status: "pending",
    },
  };
}

/* ---------------------------------------------------------
   Submit ke POST /api/bookings (fallback lokal bila offline)
--------------------------------------------------------- */
/* ---------------------------------------------------------
   Struk (bukti pemesanan): gambar PNG + unduh + WhatsApp
--------------------------------------------------------- */
let lastReceipt = null;

/** Baris rincian yang sama untuk tampilan modal & struk PNG */
function receiptRows(data) {
  return [
    ["Ruang", `${data.room_icon || "🏫"} ${data.room_name}`],
    ["Kode Ruangan", data.room_id],
    ["Tanggal", formatDateID(data.booking_date)],
    ["Jam", rangeLabel(data.start_time, data.end_time)],
    ["Kepentingan", data.purpose || "-"],
    ["Atas Nama", data.organization_name || "-"],
  ];
}

function renderReceipt(data) {
  lastReceipt = data;
  const pending = (data.status || "approved") === "pending";

  // Task 5: pengajuan baru berstatus "menunggu persetujuan" —
  // struk (PNG / WhatsApp) baru tersedia setelah disetujui admin.
  if (bookingModal.receiptIcon) bookingModal.receiptIcon.textContent = pending ? "⏳" : "✓";
  bookingModal.receiptTitle.textContent = pending ? "Pengajuan Terkirim!" : "Pemesanan Disetujui!";
  bookingModal.receiptSub.textContent = pending
    ? "Permintaan peminjaman Anda menunggu persetujuan admin. Pantau perkembangannya di menu Riwayat Peminjaman."
    : "Simpan Booking ID di bawah ini sebagai bukti pemesanan Anda.";
  if (bookingModal.receiptNote) bookingModal.receiptNote.hidden = !pending;
  if (bookingModal.receiptActions) bookingModal.receiptActions.hidden = pending;
  if (bookingModal.receiptHistoryBtn) bookingModal.receiptHistoryBtn.hidden = !pending;

  bookingModal.receiptId.textContent = data.booking_id;
  bookingModal.receiptDetails.innerHTML = receiptRows(data)
    .map(
      ([label, value]) =>
        `<div class="receipt__row"><dt>${label}</dt><dd>${value}</dd></div>`
    )
    .join("");
}

/** Pecah teks menjadi beberapa baris agar muat pada lebar maksimum */
function wrapLines(ctx, text, maxWidth) {
  const words = String(text).split(/\s+/);
  const lines = [];
  let line = "";
  for (const w of words) {
    const test = line ? line + " " + w : w;
    if (!line || ctx.measureText(test).width <= maxWidth) line = test;
    else { lines.push(line); line = w; }
  }
  if (line) lines.push(line);
  return lines.length ? lines : [""];
}

/**
 * Gambar struk ke <canvas> (ukuran 720px, super-sample 2x → 1440px).
 * Gaya: header navy + emas, Booking ID bergaya karcis, tabel rincian,
 * footer pemesan & waktu cetak. Warna mengikuti variabel CSS aplikasi.
 */
function buildReceiptCanvas(data) {
  const C = {
    navy950: "#071a33", navy900: "#0b2545", navy800: "#123a6b", navy700: "#1a4d8f",
    gold400: "#ffc857", gold500: "#f5a623",
    ink900: "#101828", ink700: "#344054", ink500: "#667085",
    ink300: "#d0d5dd", ink100: "#eaecf0", ink50: "#f8fafc",
  };
  const FONT = '"Plus Jakarta Sans", "Segoe UI", sans-serif';
  const MONO = 'ui-monospace, "SF Mono", Menlo, Consolas, monospace';
  const W = 720;
  const S = 2;
  const PAD = 34;
  const HEAD_H = 96;
  const inner = W - PAD * 2;

  const probe = document.createElement("canvas").getContext("2d");
  const F = {
    brand: `800 21px ${FONT}`,
    tag: `600 11.5px ${FONT}`,
    pill: `800 12px ${FONT}`,
    idLabel: `700 11px ${FONT}`,
    id: `800 27px ${MONO}`,
    rowLabel: `600 13.5px ${FONT}`,
    rowValue: `700 14.5px ${FONT}`,
    footBold: `700 13px ${FONT}`,
    foot: `500 12px ${FONT}`,
    footSmall: `500 11px ${FONT}`,
  };

  const rows = receiptRows(data).map(([k, v]) => ({ k, v }));
  const VALUE_X = PAD + 150;
  const VALUE_MAX = W - PAD - 18 - VALUE_X;

  probe.font = F.rowValue;
  rows.forEach((r) => { r.lines = wrapLines(probe, r.v, VALUE_MAX); });

  const ROW_MIN_H = 44;
  const LINE_H = 21;
  const ROW_VPAD = 13;
  const rowH = rows.map((r) => Math.max(ROW_MIN_H, r.lines.length * LINE_H + ROW_VPAD * 2));
  const tableH = rowH.reduce((a, b) => a + b, 0);

  probe.font = F.id;
  const idTextW = probe.measureText(data.booking_id).width;
  const ID_BOX_H = 54;

  let y = HEAD_H;
  y += 26;                                  // jarak dari header
  const idLabelY = y; y += 15;              // label "BOOKING ID"
  const idBoxY = y; y += ID_BOX_H;
  y += 18;                                  // jarak ke tabel
  const tableY = y;
  y += tableH;
  y += 20;                                  // jarak ke footer
  const footY = y; y += 74;
  const H = y + 6;

  const c = document.createElement("canvas");
  c.width = W * S;
  c.height = H * S;
  const ctx = c.getContext("2d");
  ctx.scale(S, S);

  // Latar
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, W, H);

  // Header navy
  const g = ctx.createLinearGradient(0, 0, W, HEAD_H);
  g.addColorStop(0, C.navy950);
  g.addColorStop(1, C.navy800);
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, W, HEAD_H);

  // Garis emas bawah header
  const gg = ctx.createLinearGradient(0, 0, W, 0);
  gg.addColorStop(0, C.gold400);
  gg.addColorStop(1, C.gold500);
  ctx.fillStyle = gg;
  ctx.fillRect(0, HEAD_H - 4, W, 4);

  // Teks header
  ctx.textAlign = "left";
  ctx.textBaseline = "alphabetic";
  ctx.fillStyle = "#ffffff";
  ctx.font = F.brand;
  ctx.fillText("SIBORU", PAD, 42);
  ctx.font = F.tag;
  ctx.fillStyle = "rgba(255,255,255,0.75)";
  try { ctx.letterSpacing = "2px"; } catch (e) {}
  ctx.fillText("SISTEM BOOKING RUANGAN · IDB BALI", PAD, 63);
  try { ctx.letterSpacing = "0px"; } catch (e) {}

  // Pill emas "BUKTI PEMESANAN"
  ctx.font = F.pill;
  const pillText = "BUKTI PEMESANAN";
  const pillW = ctx.measureText(pillText).width + 26;
  const pillX = W - PAD - pillW;
  const pillY = HEAD_H / 2 - 15;
  ctx.fillStyle = gg;
  roundedRect(ctx, pillX, pillY, pillW, 30, 15);
  ctx.fill();
  ctx.fillStyle = C.navy950;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(pillText, pillX + pillW / 2, pillY + 16);

  // Label + kotak Booking ID (gaya karcis, putus-putus)
  ctx.textAlign = "center";
  ctx.textBaseline = "alphabetic";
  ctx.font = F.idLabel;
  ctx.fillStyle = C.ink500;
  try { ctx.letterSpacing = "3px"; } catch (e) {}
  ctx.fillText("BOOKING ID", W / 2, idLabelY);
  try { ctx.letterSpacing = "0px"; } catch (e) {}

  const idBoxW = idTextW + 64;
  const idBoxX = (W - idBoxW) / 2;
  ctx.fillStyle = "#f4f8fd";
  roundedRect(ctx, idBoxX, idBoxY, idBoxW, ID_BOX_H, 12);
  ctx.fill();
  ctx.setLineDash([7, 6]);
  ctx.lineWidth = 1.6;
  ctx.strokeStyle = C.navy700;
  ctx.stroke();
  ctx.setLineDash([]);
  ctx.font = F.id;
  ctx.fillStyle = C.navy900;
  ctx.textBaseline = "middle";
  ctx.fillText(data.booking_id, W / 2, idBoxY + ID_BOX_H / 2 + 1);

  // Tabel rincian
  ctx.textBaseline = "middle";
  ctx.save();
  roundedRect(ctx, PAD, tableY, inner, tableH, 12);
  ctx.clip();
  let ry = tableY;
  rows.forEach((r, i) => {
    const h = rowH[i];
    if (i % 2 === 1) {
      ctx.fillStyle = C.ink50;
      ctx.fillRect(PAD, ry, inner, h);
    }
    if (i > 0) {
      ctx.strokeStyle = C.ink100;
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(PAD, ry + 0.5);
      ctx.lineTo(W - PAD, ry + 0.5);
      ctx.stroke();
    }
    ctx.font = F.rowLabel;
    ctx.fillStyle = C.ink500;
    ctx.textAlign = "left";
    ctx.fillText(r.k, PAD + 16, ry + h / 2);

    ctx.font = F.rowValue;
    ctx.fillStyle = C.ink900;
    const blockH = r.lines.length * LINE_H;
    const startY = ry + h / 2 - blockH / 2 + LINE_H / 2;
    r.lines.forEach((ln, li) => {
      ctx.fillText(ln, VALUE_X, startY + li * LINE_H);
    });
    ry += h;
  });
  ctx.restore();
  ctx.strokeStyle = C.ink100;
  ctx.lineWidth = 1;
  roundedRect(ctx, PAD, tableY, inner, tableH, 12);
  ctx.stroke();

  // Footer
  ctx.setLineDash([6, 6]);
  ctx.strokeStyle = C.ink300;
  ctx.beginPath();
  ctx.moveTo(PAD, footY + 0.5);
  ctx.lineTo(W - PAD, footY + 0.5);
  ctx.stroke();
  ctx.setLineDash([]);

  const who = session && session.name ? session.name : data.organization_name;
  const printedAt = new Date().toLocaleString("id-ID", {
    day: "numeric", month: "long", year: "numeric",
    hour: "2-digit", minute: "2-digit",
  });
  ctx.textAlign = "center";
  ctx.font = F.footBold;
  ctx.fillStyle = C.ink900;
  ctx.fillText(`Pemesan: ${who}`, W / 2, footY + 30);
  ctx.font = F.foot;
  ctx.fillStyle = C.ink500;
  ctx.fillText(`Dicetak ${printedAt} — simpan struk ini dan tunjukkan saat memasuki ruangan.`, W / 2, footY + 50);
  ctx.font = F.footSmall;
  ctx.fillText("Institut Desain & Bisnis (IDB) Bali • SIBORU (Sistem Booking Ruangan)", W / 2, footY + 68);

  return c;
}

function roundedRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  if (typeof ctx.roundRect === "function") {
    ctx.roundRect(x, y, w, h, r);
    return;
  }
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

function canvasToBlobPNG(canvas) {
  return new Promise((resolve) => canvas.toBlob(resolve, "image/png"));
}

function downloadBlobAsFile(blob, filename) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 5000);
}

/** Teks struk untuk WhatsApp (mendukung *bold* di WhatsApp) */
function receiptWaText(data) {
  const lines = [
    "*SIBORU — BUKTI PEMESANAN RUANGAN*",
    "Institut Desain & Bisnis (IDB) Bali",
    "",
    `Booking ID: *${data.booking_id}*`,
  ];
  receiptRows(data).forEach(([k, v]) => lines.push(`${k}: ${v}`));
  lines.push("", "Mohon simpan struk ini dan tunjukkan saat memasuki ruangan.");
  return lines.join("\n");
}

async function prepareReceiptPNG(data) {
  if (document.fonts && document.fonts.ready) {
    try { await document.fonts.ready; } catch (e) { /* abaikan */ }
  }
  const canvas = buildReceiptCanvas(data);
  const blob = await canvasToBlobPNG(canvas);
  if (!blob) throw new Error("toBlob gagal");
  return blob;
}

/* --- Aksi: Unduh struk PNG --- */
bookingModal.receiptDownload.addEventListener("click", async () => {
  if (!lastReceipt) return;
  try {
    const blob = await prepareReceiptPNG(lastReceipt);
    downloadBlobAsFile(blob, `struk-${lastReceipt.booking_id}.png`);
    showToast(`Struk ${lastReceipt.booking_id} berhasil diunduh sebagai PNG 📄`);
  } catch (e) {
    showToast("Maaf, struk gagal dibuat. Coba lagi.");
  }
});

/* --- Aksi: Bagikan ke WhatsApp --- */
bookingModal.receiptWhatsapp.addEventListener("click", async () => {
  const data = lastReceipt;
  if (!data) return;
  const text = receiptWaText(data);
  const filename = `struk-${data.booking_id}.png`;
  try {
    const blob = await prepareReceiptPNG(data);

    // 1) Jalur utama: share sheet sistem (WhatsApp muncul di daftar aplikasi)
    const file = new File([blob], filename, { type: "image/png" });
    if (navigator.canShare && navigator.canShare({ files: [file] })) {
      try {
        await navigator.share({ files: [file], title: `Struk Pemesanan ${data.booking_id}`, text });
        showToast("Struk siap dibagikan ke WhatsApp 📤");
        return;
      } catch (err) {
        if (err && err.name === "AbortError") return; // pengguna membatalkan
      }
    }

    // 2) Fallback: buka WhatsApp (rincian struk) + unduh PNG untuk dilampirkan
    window.open("https://wa.me/?text=" + encodeURIComponent(text), "_blank", "noopener");
    downloadBlobAsFile(blob, filename);
    showToast("WhatsApp terbuka dengan rincian struk — lampirkan PNG yang baru diunduh 📎");
  } catch (e) {
    showToast("Maaf, struk gagal dibagikan. Coba lagi.");
  }
});

bookingModal.form.addEventListener("submit", async (e) => {
  e.preventDefault();
  if (!validateBooking(true) || !currentBookingRoom) return;

  const payload = {
    user_id: session ? session.id : null,
    room_id: currentBookingRoom.id,
    booking_date: bookingModal.date.value,
    start_time: bookingModal.start.value,
    end_time: bookingModal.end.value,
    purpose: bookingModal.purpose.value,
    organization_name: bookingModal.sender.value.trim(),
  };

  const confirmLabel = bookingModal.confirm.textContent;
  bookingModal.confirm.disabled = true;
  bookingModal.confirm.textContent = "Memproses…";

  const result = await Api.createBooking(payload);

  bookingModal.confirm.textContent = confirmLabel;

  // Backend tidak aktif (server statis / file:// / mati) -> penyimpanan lokal
  const backendDown =
    result.networkError || result.httpStatus === 0 || result.httpStatus === 404;
  const finalResult = backendDown ? createLocalBooking(payload) : result;

  if (!finalResult.ok) {
    // Server menolak (409 bentrok / 400 aturan / 404 / 500)
    showServerRejection(finalResult);
    if (finalResult.httpStatus !== 409) validateBooking(false);
    if (typeof loadRoomStatus === "function") loadRoomStatus(); // badge grid ikut terbaru
    return;
  }

  // Sukses — tampilkan bukti pengajuan (status awal: menunggu persetujuan)
  const submitted = {
    ...finalResult.data,
    room_icon: currentBookingRoom.icon,
    status: finalResult.data.status || "pending",
  };
  renderReceipt(submitted);
  showModalView("receipt");
  showToast(
    submitted.status === "pending"
      ? `Pengajuan ${submitted.room_name} terkirim! Booking ID: ${submitted.booking_id} — menunggu persetujuan admin ⏳`
      : `Pemesanan ${submitted.room_name} disetujui! Booking ID: ${submitted.booking_id} ✅`
  );

  if (typeof loadRoomStatus === "function") loadRoomStatus();
  bookingModal.confirm.disabled = false;
});

/* ---------------------------------------------------------
   Event listener modal
--------------------------------------------------------- */
["change", "input"].forEach((evt) => {
  bookingModal.date.addEventListener(evt, async () => {
    if (bookingModal.date.value) {
      activeBookingDate = bookingModal.date.value;
      // Muat ulang status ruangan dari database untuk tanggal baru
      if (typeof loadRoomStatus === "function") {
        await loadRoomStatus();
        syncModalWithLatestRooms();
      }
    }
    validateBooking(false);
  });

  [bookingModal.start, bookingModal.end, bookingModal.purpose, bookingModal.sender].forEach((el) =>
    el.addEventListener(evt, () => validateBooking(false))
  );
});

bookingModal.cancel.addEventListener("click", closeBookingModal);
bookingModal.receiptClose.addEventListener("click", closeBookingModal);
bookingModal.close.addEventListener("click", closeBookingModal);

bookingModal.root.addEventListener("click", (e) => {
  if (e.target === bookingModal.root) closeBookingModal();
});

document.addEventListener("keydown", (e) => {
  if (e.key === "Escape" && !bookingModal.root.hidden) closeBookingModal();
});
