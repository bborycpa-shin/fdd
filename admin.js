(function () {
  const ADMIN_KEY = "fdd_admin_pw";
  const UPLOADER_KEY = "fdd_uploader_id";
  const USER_PW_LOCAL = "fdd_user_pw";
  const USER_PW_SESSION = "fdd_user_pw";

  let storedAdminPw = localStorage.getItem(ADMIN_KEY) || null;
  let storedUserPw =
    localStorage.getItem(USER_PW_LOCAL) ||
    sessionStorage.getItem(USER_PW_SESSION) ||
    null;
  let uploaderId = localStorage.getItem(UPLOADER_KEY);
  if (!uploaderId) {
    uploaderId =
      (crypto.randomUUID && crypto.randomUUID()) ||
      String(Date.now()) + "-" + Math.random().toString(36).slice(2);
    localStorage.setItem(UPLOADER_KEY, uploaderId);
  }
  window.fddUploaderId = uploaderId;

  let isAdmin = false;
  let userAuthenticated = false;
  let userPwSet = false;
  let locked = false;

  const origFetch = window.fetch.bind(window);
  window.fetch = function (input, init) {
    init = init || {};
    const headers = new Headers(init.headers || {});
    if (storedAdminPw) headers.set("X-Admin-Password", storedAdminPw);
    if (storedUserPw) headers.set("X-User-Password", storedUserPw);
    if (uploaderId) headers.set("X-Uploader-Id", uploaderId);
    init.headers = headers;
    return origFetch(input, init);
  };

  function setAdminBodyClass() {
    document.body.classList.toggle("admin-mode", isAdmin);
    document.body.classList.toggle("locked-blocked", locked && !isAdmin);
  }

  function injectStyles() {
    const s = document.createElement("style");
    s.textContent = `
      body:not(.admin-mode) .admin-only { display: none !important; }
      body.locked-blocked > main,
      body.locked-blocked > #recent-files-bar,
      body.locked-blocked > #action-bar { visibility: hidden; }
      body.needs-login > main,
      body.needs-login > #recent-files-bar,
      body.needs-login > #action-bar { visibility: hidden; }
      .keypad-key { -webkit-tap-highlight-color: transparent; }
      .keypad-key:active { transform: scale(0.96); background: #e2e8f0; }
    `;
    document.head.appendChild(s);
  }

  const LOCK_SVG_CLOSED =
    '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" style="width:13px;height:13px;display:block;"><rect x="4" y="11" width="16" height="10" rx="2"></rect><path d="M8 11V7a4 4 0 0 1 8 0v4"></path></svg>';
  const LOCK_SVG_OPEN =
    '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" style="width:13px;height:13px;display:block;"><rect x="4" y="11" width="16" height="10" rx="2"></rect><path d="M8 11V7a4 4 0 0 1 7.8-1"></path></svg>';

  function injectLockButton() {
    const slot = document.getElementById("admin-lock-slot");
    if (!slot) return;
    slot.innerHTML = `
      <button id="admin-lock-btn" aria-label="관리자" title="관리자"
        class="shrink-0 inline-flex items-center justify-center px-2 py-1 rounded-lg border text-[11px] font-medium">
      </button>
    `;
    document
      .getElementById("admin-lock-btn")
      .addEventListener("click", openAdminModal);
    updateLockButton();
  }

  function updateLockButton() {
    const btn = document.getElementById("admin-lock-btn");
    if (!btn) return;
    btn.innerHTML = isAdmin ? LOCK_SVG_OPEN : LOCK_SVG_CLOSED;
    if (isAdmin) {
      btn.style.background = "#2563eb";
      btn.style.color = "white";
      btn.style.borderColor = "#2563eb";
    } else {
      btn.style.background = "white";
      btn.style.color = "#475569";
      btn.style.borderColor = "#cbd5e1";
    }
  }

  function injectAdminModal() {
    const wrap = document.createElement("div");
    wrap.id = "admin-modal";
    wrap.style.cssText =
      "position:fixed;inset:0;background:rgba(0,0,0,0.5);z-index:70;display:none;align-items:center;justify-content:center;padding:12px;";
    wrap.innerHTML = `
      <div style="background:white;border-radius:16px;padding:16px;width:100%;max-width:360px;" onclick="event.stopPropagation()">
        <div id="admin-modal-body"></div>
      </div>
    `;
    wrap.addEventListener("click", (e) => {
      if (e.target === wrap) closeAdminModal();
    });
    document.body.appendChild(wrap);
  }

  function closeAdminModal() {
    const wrap = document.getElementById("admin-modal");
    if (wrap) wrap.style.display = "none";
  }

  function openAdminModal() {
    if (!isAdmin) showAdminLoginUI();
    else showAdminPanel();
    document.getElementById("admin-modal").style.display = "flex";
  }

  function showAdminLoginUI() {
    const body = document.getElementById("admin-modal-body");
    if (!body) return;
    body.innerHTML = `
      <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:10px;">
        <h3 style="font-size:14px;font-weight:700;margin:0;">관리자 로그인</h3>
        <button id="admin-cancel" style="color:#94a3b8;font-size:18px;background:none;border:none;cursor:pointer;">✕</button>
      </div>
      <label style="font-size:11px;color:#64748b;display:block;margin-bottom:4px;">관리자 비밀번호</label>
      <input id="admin-pw-input" type="password" autocomplete="current-password" style="width:100%;font-size:14px;padding:8px 10px;border:1px solid #cbd5e1;border-radius:8px;margin-bottom:12px;box-sizing:border-box;" />
      <p id="admin-pw-error" style="font-size:11px;color:#dc2626;margin-bottom:8px;display:none;"></p>
      <button id="admin-pw-submit" style="width:100%;font-size:14px;padding:8px;background:#2563eb;color:white;font-weight:500;border:none;border-radius:8px;cursor:pointer;">확인</button>
    `;
    document
      .getElementById("admin-cancel")
      .addEventListener("click", closeAdminModal);
    const input = document.getElementById("admin-pw-input");
    const errEl = document.getElementById("admin-pw-error");
    const tryLogin = async () => {
      const pw = input.value;
      if (!pw) return;
      try {
        const res = await origFetch("/api/admin/login", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ password: pw }),
        });
        if (!res.ok) throw new Error();
        storedAdminPw = pw;
        localStorage.setItem(ADMIN_KEY, pw);
        closeAdminModal();
        location.reload();
      } catch {
        errEl.textContent = "비밀번호가 맞지 않아요";
        errEl.style.display = "block";
      }
    };
    document
      .getElementById("admin-pw-submit")
      .addEventListener("click", tryLogin);
    input.addEventListener("keydown", (e) => {
      if (e.key === "Enter") tryLogin();
    });
    setTimeout(() => input.focus(), 50);
  }

  function showAdminPanel() {
    const body = document.getElementById("admin-modal-body");
    if (!body) return;
    body.innerHTML = `
      <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:12px;">
        <h3 style="font-size:14px;font-weight:700;margin:0;">🔓 관리자 모드</h3>
        <button id="admin-cancel" style="color:#94a3b8;font-size:18px;background:none;border:none;cursor:pointer;">✕</button>
      </div>

      <div style="display:flex;align-items:center;justify-content:space-between;padding:10px;background:#f1f5f9;border-radius:8px;margin-bottom:10px;">
        <div>
          <p style="font-size:12px;font-weight:600;margin:0;">전체 잠금</p>
          <p style="font-size:10px;color:#64748b;margin:0;">일반 사용자가 콘텐츠를 못 봄</p>
        </div>
        <label style="position:relative;display:inline-block;width:40px;height:22px;">
          <input id="admin-lock-toggle" type="checkbox" ${locked ? "checked" : ""} style="opacity:0;width:0;height:0;" />
          <span style="position:absolute;cursor:pointer;inset:0;background:${locked ? "#2563eb" : "#cbd5e1"};border-radius:22px;transition:0.2s;"></span>
          <span style="position:absolute;height:18px;width:18px;left:${locked ? "20px" : "2px"};top:2px;background:white;border-radius:50%;transition:0.2s;pointer-events:none;"></span>
        </label>
      </div>

      <button id="admin-change-user-pw" style="width:100%;font-size:12px;padding:8px;background:white;color:#0f172a;font-weight:500;border:1px solid #cbd5e1;border-radius:8px;margin-bottom:6px;cursor:pointer;">일반 비밀번호 변경</button>
      <button id="admin-change-pw" style="width:100%;font-size:12px;padding:8px;background:white;color:#0f172a;font-weight:500;border:1px solid #cbd5e1;border-radius:8px;margin-bottom:8px;cursor:pointer;">관리자 비밀번호 변경</button>
      <button id="admin-logout" style="width:100%;font-size:12px;padding:8px;background:white;color:#dc2626;font-weight:500;border:1px solid #cbd5e1;border-radius:8px;cursor:pointer;">관리자 로그아웃</button>
    `;
    document
      .getElementById("admin-cancel")
      .addEventListener("click", closeAdminModal);

    document
      .getElementById("admin-lock-toggle")
      .addEventListener("change", async (e) => {
        try {
          const res = await fetch("/api/admin/lock", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ locked: e.target.checked }),
          });
          if (!res.ok) throw new Error();
          locked = e.target.checked;
          showAdminPanel();
        } catch {
          e.target.checked = !e.target.checked;
          alert("잠금 변경 실패");
        }
      });

    document
      .getElementById("admin-change-pw")
      .addEventListener("click", showAdminPasswordChangeUI);
    document
      .getElementById("admin-change-user-pw")
      .addEventListener("click", showUserPasswordChangeUI);

    document.getElementById("admin-logout").addEventListener("click", () => {
      storedAdminPw = null;
      localStorage.removeItem(ADMIN_KEY);
      isAdmin = false;
      setAdminBodyClass();
      updateLockButton();
      closeAdminModal();
      location.reload();
    });
  }

  function showAdminPasswordChangeUI() {
    const body = document.getElementById("admin-modal-body");
    if (!body) return;
    body.innerHTML = `
      <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:10px;">
        <h3 style="font-size:14px;font-weight:700;margin:0;">관리자 비밀번호 변경</h3>
        <button id="admin-back" style="color:#94a3b8;font-size:13px;background:none;border:none;cursor:pointer;">‹ 뒤로</button>
      </div>
      <label style="font-size:11px;color:#64748b;display:block;margin-bottom:4px;">현재 비밀번호</label>
      <input id="admin-cur-pw" type="password" autocomplete="current-password" style="width:100%;font-size:14px;padding:8px 10px;border:1px solid #cbd5e1;border-radius:8px;margin-bottom:8px;box-sizing:border-box;" />
      <label style="font-size:11px;color:#64748b;display:block;margin-bottom:4px;">새 비밀번호 (4자 이상)</label>
      <input id="admin-new-pw" type="password" autocomplete="new-password" style="width:100%;font-size:14px;padding:8px 10px;border:1px solid #cbd5e1;border-radius:8px;margin-bottom:12px;box-sizing:border-box;" />
      <p id="admin-cpw-err" style="font-size:11px;color:#dc2626;margin-bottom:8px;display:none;"></p>
      <button id="admin-cpw-submit" style="width:100%;font-size:14px;padding:8px;background:#2563eb;color:white;font-weight:500;border:none;border-radius:8px;cursor:pointer;">변경</button>
    `;
    document.getElementById("admin-back").addEventListener("click", showAdminPanel);
    const cur = document.getElementById("admin-cur-pw");
    const next = document.getElementById("admin-new-pw");
    const err = document.getElementById("admin-cpw-err");
    document
      .getElementById("admin-cpw-submit")
      .addEventListener("click", async () => {
        err.style.display = "none";
        if (!cur.value || !next.value) return;
        if (next.value.length < 4) {
          err.textContent = "새 비밀번호는 4자 이상이어야 해요";
          err.style.display = "block";
          return;
        }
        try {
          const res = await origFetch("/api/admin/password", {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              "X-Admin-Password": storedAdminPw,
            },
            body: JSON.stringify({ current: cur.value, next: next.value }),
          });
          if (!res.ok) throw new Error();
          storedAdminPw = next.value;
          localStorage.setItem(ADMIN_KEY, next.value);
          alert("관리자 비밀번호가 변경됐어요");
          closeAdminModal();
        } catch {
          err.textContent = "현재 비밀번호가 맞지 않아요";
          err.style.display = "block";
        }
      });
  }

  function showUserPasswordChangeUI() {
    const body = document.getElementById("admin-modal-body");
    if (!body) return;
    body.innerHTML = `
      <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:10px;">
        <h3 style="font-size:14px;font-weight:700;margin:0;">일반 비밀번호 변경</h3>
        <button id="admin-back" style="color:#94a3b8;font-size:13px;background:none;border:none;cursor:pointer;">‹ 뒤로</button>
      </div>
      <p style="font-size:11px;color:#64748b;margin-bottom:8px;">일반 사용자가 로그인할 때 쓰는 비밀번호입니다.<br>키패드의 문자(<code>1-0 * # @ ! ~</code>)만 사용하세요.</p>
      <label style="font-size:11px;color:#64748b;display:block;margin-bottom:4px;">새 비밀번호</label>
      <input id="user-new-pw" type="text" autocomplete="off" style="width:100%;font-size:14px;padding:8px 10px;border:1px solid #cbd5e1;border-radius:8px;margin-bottom:12px;box-sizing:border-box;" />
      <p id="user-cpw-err" style="font-size:11px;color:#dc2626;margin-bottom:8px;display:none;"></p>
      <button id="user-cpw-submit" style="width:100%;font-size:14px;padding:8px;background:#2563eb;color:white;font-weight:500;border:none;border-radius:8px;cursor:pointer;">변경</button>
    `;
    document.getElementById("admin-back").addEventListener("click", showAdminPanel);
    const next = document.getElementById("user-new-pw");
    const err = document.getElementById("user-cpw-err");
    document
      .getElementById("user-cpw-submit")
      .addEventListener("click", async () => {
        err.style.display = "none";
        const v = next.value.trim();
        if (!v) return;
        if (!/^[0-9*#@!~]+$/.test(v)) {
          err.textContent = "키패드 문자만 사용해주세요";
          err.style.display = "block";
          return;
        }
        try {
          const res = await origFetch("/api/admin/user-password", {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              "X-Admin-Password": storedAdminPw,
            },
            body: JSON.stringify({ password: v }),
          });
          if (!res.ok) throw new Error();
          alert("일반 비밀번호가 변경됐어요");
          closeAdminModal();
        } catch {
          err.textContent = "변경 실패";
          err.style.display = "block";
        }
      });
  }

  function injectLoginOverlay() {
    const wrap = document.createElement("div");
    wrap.id = "login-overlay";
    wrap.style.cssText =
      "position:fixed;inset:0;background:#f8fafc;z-index:80;display:none;align-items:flex-start;justify-content:center;padding:24px 16px;overflow-y:auto;";
    wrap.innerHTML = `
      <div style="width:100%;max-width:360px;display:flex;flex-direction:column;align-items:center;">
        <h1 style="font-size:18px;font-weight:700;margin:8px 0 2px 0;text-align:center;display:flex;align-items:baseline;gap:6px;">
          <span>📁 파일공유 시스템</span>
          <span style="font-size:10px;font-weight:400;color:#94a3b8;">by 신CPA</span>
        </h1>
        <p style="font-size:11px;color:#dc2626;margin:8px 0 16px 0;text-align:center;line-height:1.4;">
          업로드한 파일 삭제는 본인만 가능합니다<br>(5분 이내 + 동일 기기).
        </p>

        <div id="login-display" style="width:100%;background:white;border:1px solid #cbd5e1;border-radius:12px;padding:12px;text-align:center;font-size:24px;letter-spacing:6px;min-height:48px;margin-bottom:8px;color:#0f172a;font-weight:600;"></div>
        <p id="login-error" style="font-size:11px;color:#dc2626;margin:0 0 12px 0;height:14px;text-align:center;"></p>

        <div id="login-keypad" style="width:100%;display:grid;grid-template-columns:repeat(4,1fr);gap:6px;margin-bottom:14px;"></div>

        <label style="display:flex;align-items:center;gap:6px;font-size:12px;color:#475569;margin-bottom:10px;">
          <input id="login-remember" type="checkbox" style="width:14px;height:14px;accent-color:#2563eb;" />
          이 기기에서 비밀번호 기억
        </label>

        <button id="login-submit" style="width:100%;font-size:14px;padding:10px;background:#2563eb;color:white;font-weight:500;border:none;border-radius:10px;cursor:pointer;margin-bottom:6px;">로그인</button>
        <button id="login-admin-mode" style="width:100%;font-size:12px;padding:8px;background:white;color:#0f172a;font-weight:500;border:1px solid #cbd5e1;border-radius:10px;cursor:pointer;">관리자 모드</button>
      </div>
    `;
    document.body.appendChild(wrap);

    const display = document.getElementById("login-display");
    const errEl = document.getElementById("login-error");
    const keypad = document.getElementById("login-keypad");
    let inputBuffer = "";

    function updateDisplay() {
      display.textContent = inputBuffer
        ? "●".repeat(inputBuffer.length)
        : "—";
    }
    updateDisplay();

    const keys = ["1","2","3","4","5","6","7","8","9","0","*","#","@","!","~","⌫"];
    keys.forEach((k) => {
      const btn = document.createElement("button");
      btn.className = "keypad-key";
      btn.style.cssText =
        "padding:14px 0;background:white;border:1px solid #cbd5e1;border-radius:10px;font-size:18px;font-weight:600;color:#0f172a;transition:0.05s;cursor:pointer;";
      btn.textContent = k;
      btn.addEventListener("click", () => {
        errEl.textContent = "";
        if (k === "⌫") {
          inputBuffer = inputBuffer.slice(0, -1);
        } else {
          if (inputBuffer.length >= 20) return;
          inputBuffer += k;
        }
        updateDisplay();
      });
      keypad.appendChild(btn);
    });

    const submit = async () => {
      if (!inputBuffer) {
        errEl.textContent = "비밀번호를 입력하세요";
        return;
      }
      try {
        const res = await origFetch("/api/auth/login", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ password: inputBuffer }),
        });
        if (!res.ok) throw new Error();
        const remember = document.getElementById("login-remember").checked;
        if (remember) {
          localStorage.setItem(USER_PW_LOCAL, inputBuffer);
          sessionStorage.removeItem(USER_PW_SESSION);
        } else {
          sessionStorage.setItem(USER_PW_SESSION, inputBuffer);
          localStorage.removeItem(USER_PW_LOCAL);
        }
        storedUserPw = inputBuffer;
        location.reload();
      } catch {
        errEl.textContent = "비밀번호가 맞지 않아요";
        inputBuffer = "";
        updateDisplay();
      }
    };

    document.getElementById("login-submit").addEventListener("click", submit);
    document
      .getElementById("login-admin-mode")
      .addEventListener("click", () => {
        hideLoginOverlay();
        openAdminModal();
      });
  }

  function showLoginOverlay() {
    document.body.classList.add("needs-login");
    const wrap = document.getElementById("login-overlay");
    if (wrap) wrap.style.display = "flex";
  }
  function hideLoginOverlay() {
    document.body.classList.remove("needs-login");
    const wrap = document.getElementById("login-overlay");
    if (wrap) wrap.style.display = "none";
  }

  async function refreshStatus() {
    try {
      const res = await origFetch("/api/auth/status", {
        headers: {
          ...(storedAdminPw ? { "X-Admin-Password": storedAdminPw } : {}),
          ...(storedUserPw ? { "X-User-Password": storedUserPw } : {}),
        },
      });
      if (!res.ok) return;
      const data = await res.json();
      isAdmin = data.is_admin;
      userAuthenticated = data.user_authenticated;
      userPwSet = data.user_password_set;
      locked = data.locked;
      if (!isAdmin && storedAdminPw) {
        storedAdminPw = null;
        localStorage.removeItem(ADMIN_KEY);
      }
      if (!userAuthenticated && storedUserPw) {
        storedUserPw = null;
        localStorage.removeItem(USER_PW_LOCAL);
        sessionStorage.removeItem(USER_PW_SESSION);
      }
      setAdminBodyClass();
      updateLockButton();
      if (userPwSet && !userAuthenticated) {
        showLoginOverlay();
      } else {
        hideLoginOverlay();
        if (locked && !isAdmin) {
          openAdminModal();
        }
      }
    } catch {}
  }

  function injectLogoutSlot() {
    const slot = document.getElementById("logout-slot");
    if (!slot) return;
    slot.innerHTML = `
      <button id="logout-btn" aria-label="로그아웃"
        class="shrink-0 inline-flex items-center justify-center px-2 py-1 rounded-lg border border-slate-300 bg-white text-slate-600 active:bg-slate-100 text-[11px] font-medium"
        title="로그인 화면으로">
        <span style="margin-right:2px;">↩</span>나가기
      </button>
    `;
    document.getElementById("logout-btn").addEventListener("click", () => {
      storedUserPw = null;
      localStorage.removeItem(USER_PW_LOCAL);
      sessionStorage.removeItem(USER_PW_SESSION);
      storedAdminPw = null;
      localStorage.removeItem(ADMIN_KEY);
      location.reload();
    });
  }

  injectStyles();
  injectLockButton();
  injectLogoutSlot();
  injectAdminModal();
  injectLoginOverlay();
  refreshStatus();

  window.fddAdmin = {
    isAdmin: () => isAdmin,
    refresh: refreshStatus,
  };
})();
