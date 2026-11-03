/* =========================================================
   SIBORU — Autentikasi (Task 3)
   Login diverifikasi backend (POST /api/auth/login) dengan
   password hash tersimpan di SQLite.
   ========================================================= */

const IDB_AUTH_KEY = "idb_bali_session";

/* Akun demo lokal — dipakai bila backend tidak aktif (mode offline) */
const LOCAL_ACCOUNTS = {
  "2026001": { id: 1, nim_nidn: "2026001", password: "password123", role: "STUDENT", full_name: "Mahasiswa IDB" },
  "2026002": { id: 2, nim_nidn: "2026002", password: "password123", role: "LECTURER", full_name: "Dosen IDB" },
  // Akun pemilik aplikasi — TIDAK ditampilkan sebagai chip demo di halaman login
  "246120940015": { id: 3, nim_nidn: "246120940015", password: "BUKANUNTUKSEMUAORANG", role: "ADMIN", full_name: "Admin IDB Bali" },
};

/* Session helpers ------------------------------------------------- */
function getSession() {
  try {
    const raw = localStorage.getItem(IDB_AUTH_KEY) || sessionStorage.getItem(IDB_AUTH_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch (e) {
    return null;
  }
}

function setSession(user, { remember = false } = {}) {
  const session = {
    id: user.id,
    nim: user.nim_nidn,
    nim_nidn: user.nim_nidn,
    role: user.role,
    name: user.full_name,
    loginAt: new Date().toISOString(),
  };
  const store = remember ? localStorage : sessionStorage;
  const other = remember ? sessionStorage : localStorage;
  other.removeItem(IDB_AUTH_KEY);
  store.setItem(IDB_AUTH_KEY, JSON.stringify(session));
  return session;
}

function clearSession() {
  localStorage.removeItem(IDB_AUTH_KEY);
  sessionStorage.removeItem(IDB_AUTH_KEY);
}

/* Autentikasi ke backend (fallback lokal bila backend mati) */
async function login(nim, password, remember = false) {
  const idTrimmed = (nim || "").trim();
  const result = await Api.login(idTrimmed, password);

  const backendDown =
    result.networkError || result.httpStatus === 0 || result.httpStatus === 404;

  if (backendDown) {
    // Mode offline: verifikasi terhadap akun demo lokal
    const acc = LOCAL_ACCOUNTS[idTrimmed];
    if (acc && acc.password === password) {
      return { ok: true, session: setSession(acc, { remember }) };
    }
    return { ok: false, message: "NIM/NIDN atau Password salah." };
  }

  if (!result.ok) {
    // Pesan error backend langsung ditampilkan (401 / 400)
    return { ok: false, message: result.message || "NIM/NIDN atau Password salah." };
  }

  const session = setSession(result.data.user, { remember });
  return { ok: true, session };
}

/* =========================================================
   LOGIKA HALAMAN LOGIN (hanya berjalan di index.html)
   ========================================================= */
(function initLoginPage() {
  const form = document.getElementById("loginForm");
  if (!form) return;

  /* Sudah login? → langsung ke halaman sesuai peran */
  const existingSession = getSession();
  if (existingSession) {
    window.location.replace(existingSession.role === "ADMIN" ? "admin.html" : "catalog.html");
    return;
  }

  const nimInput = document.getElementById("nim");
  const passInput = document.getElementById("password");
  const alertBox = document.getElementById("loginAlert");
  const alertText = document.getElementById("loginAlertText");
  const toggleBtn = document.getElementById("togglePassword");
  const eyeIcon = document.getElementById("eyeIcon");

  const showAlert = (msg) => {
    alertText.textContent = msg;
    alertBox.hidden = false;
  };
  const hideAlert = () => {
    alertBox.hidden = true;
    nimInput.classList.remove("is-invalid");
    passInput.classList.remove("is-invalid");
  };

  /* Show / hide password */
  toggleBtn.addEventListener("click", () => {
    const showing = passInput.type === "text";
    passInput.type = showing ? "password" : "text";
    toggleBtn.setAttribute("aria-label", showing ? "Tampilkan password" : "Sembunyikan password");
    eyeIcon.innerHTML = showing
      ? '<path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path><circle cx="12" cy="12" r="3"></circle>'
      : '<path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94"></path>' +
        '<path d="M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19"></path>' +
        '<line x1="1" y1="1" x2="23" y2="23"></line>';
  });

  /* Demo chips: auto-fill */
  document.querySelectorAll(".demo-chip").forEach((chip) => {
    chip.addEventListener("click", () => {
      nimInput.value = chip.dataset.nim;
      passInput.value = chip.dataset.pass;
      hideAlert();
      nimInput.focus();
    });
  });

  /* Clear error while typing */
  [nimInput, passInput].forEach((el) => el.addEventListener("input", hideAlert));

  /* Submit */
  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    hideAlert();

    const nim = nimInput.value.trim();
    const password = passInput.value;
    const remember = document.getElementById("remember").checked;

    if (!nim || !password) {
      showAlert("NIM/NIDN dan Password wajib diisi.");
      if (!nim) nimInput.classList.add("is-invalid");
      if (!password) passInput.classList.add("is-invalid");
      return;
    }

    const btn = document.getElementById("loginBtn");
    btn.disabled = true;
    btn.querySelector("span").textContent = "Memverifikasi…";

    const result = await login(nim, password, remember);

    if (!result.ok) {
      showAlert(result.message);
      nimInput.classList.add("is-invalid");
      passInput.classList.add("is-invalid");
      btn.disabled = false;
      btn.querySelector("span").textContent = "Masuk";
      return;
    }

    btn.querySelector("span").textContent = "Berhasil!";
    const homePage = result.session && result.session.role === "ADMIN" ? "admin.html" : "catalog.html";
    setTimeout(() => window.location.replace(homePage), 450);
  });
})();
