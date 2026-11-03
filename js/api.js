/* =========================================================
   SIBORU — API Client (Task 3)
   Wrapper fetch() ke backend Express + SQLite.
   Semua fungsi TIDAK melempar error: selalu mengembalikan
   { ok, httpStatus, status, message, data }.
   ========================================================= */

const API_BASE = "/api";

async function apiRequest(path, { method = "GET", body } = {}) {
  try {
    const res = await fetch(API_BASE + path, {
      method,
      headers: body ? { "Content-Type": "application/json" } : undefined,
      body: body ? JSON.stringify(body) : undefined,
    });

    let payload = null;
    try {
      payload = await res.json();
    } catch {
      payload = { status: "error", message: `Respons server tidak valid (HTTP ${res.status}).` };
    }

    return {
      ok: res.ok,
      httpStatus: res.status,
      status: payload.status || (res.ok ? "success" : "error"),
      message: payload.message || "",
      data: payload.data !== undefined ? payload.data : payload,
      conflict: payload.conflict || null,
    };
  } catch (err) {
    // Jaringan gagal / server mati
    return {
      ok: false,
      httpStatus: 0,
      status: "error",
      message: "Backend tidak terjangkau. Pastikan server berjalan (npm start) lalu muat ulang halaman.",
      data: null,
      conflict: null,
      networkError: true,
    };
  }
}

/* --- Endpoint --- */
const Api = {
  login: (nim_nidn, password) =>
    apiRequest("/auth/login", { method: "POST", body: { nim_nidn, password } }),

  roomsStatus: (date) => apiRequest(`/rooms/status?date=${encodeURIComponent(date)}`),

  createBooking: (payload) =>
    apiRequest("/bookings", { method: "POST", body: payload }),

  bookings: (params = {}) => {
    const qs = new URLSearchParams(params).toString();
    return apiRequest(`/bookings${qs ? "?" + qs : ""}`);
  },

  /* --- Admin (Task 4) --- */
  adminStats: () => apiRequest("/admin/stats"),
  users: () => apiRequest("/users"),
  deleteBooking: (id) => apiRequest(`/bookings/${encodeURIComponent(id)}`, { method: "DELETE" }),
  createRoom: (payload) => apiRequest("/rooms", { method: "POST", body: payload }),
  updateRoom: (id, payload) => apiRequest(`/rooms/${encodeURIComponent(id)}`, { method: "PUT", body: payload }),
  deleteRoom: (id) => apiRequest(`/rooms/${encodeURIComponent(id)}`, { method: "DELETE" }),

  /* --- Persetujuan pemesanan (Task 5) --- */
  updateBookingStatus: (id, status, reason) =>
    apiRequest(`/bookings/${encodeURIComponent(id)}/status`, {
      method: "PATCH",
      body: { status, reason },
    }),
};
