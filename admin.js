(function () {
  const PW_KEY = "fdd_admin_pw";
  let storedPw = localStorage.getItem(PW_KEY) || null;
  let isAdmin = false;
  let locked = false;

  const origFetch = window.fetch.bind(window);
  window.fetch = function (input, init) {
    init = init || {};
    if (storedPw) {
      const headers = new Headers(init.headers || {});
      headers.set("X-Admin-Password", storedPw);
      init.headers = headers;
    }
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
    const btn = document.getElementById("admin-lock-btn");
    btn.addEventListener("click", openAdminModal);
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

  function injectModal() {
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
    if (!isAdmin) {
      showLoginUI();
    } else {
      showAdminPanel();
    }
    const wrap = document.getElementById("admin-modal");
    if (wrap) wrap.style.display = "flex";
  }

  function showLoginUI(forced) {
    const body = document.getElementById("admin-modal-body");
    if (!body) return;
    body.innerHTML = `
      <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:10px;">
        <h3 style="font-size:14px;font-weight:700;margin:0;">${forced ? "🔒 잠금 해제" : "관리자 로그인"}</h3>
        ${forced ? "" : '<button id="admin-cancel" style="color:#94a3b8;font-size:18px;background:none;border:none;cursor:pointer;">✕</button>'}
      </div>
      ${forced ? '<p style="font-size:11px;color:#64748b;margin-bottom:8px;">관리자가 잠금을 활성화했습니다. 비밀번호를 입력해주세요.</p>' : ""}
      <label style="font-size:11px;color:#64748b;display:block;margin-bottom:4px;">비밀번호</label>
      <input id="admin-pw-input" type="password" autocomplete="current-password" style="width:100%;font-size:14px;padding:8px 10px;border:1px solid #cbd5e1;border-radius:8px;margin-bottom:12px;box-sizing:border-box;" />
      <p id="admin-pw-error" style="font-size:11px;color:#dc2626;margin-bottom:8px;display:none;"></p>
      <button id="admin-pw-submit" style="width:100%;font-size:14px;padding:8px;background:#2563eb;color:white;font-weight:500;border:none;border-radius:8px;cursor:pointer;">확인</button>
    `;
    const cancel = document.getElementById("admin-cancel");
    if (cancel) cancel.addEventListener("click", closeAdminModal);
    const input = document.getElementById("admin-pw-input");
    const submit = document.getElementById("admin-pw-submit");
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
        if (!res.ok) throw new Error("invalid");
        storedPw = pw;
        localStorage.setItem(PW_KEY, pw);
        closeAdminModal();
        location.reload();
      } catch (e) {
        errEl.textContent = "비밀번호가 맞지 않아요";
        errEl.style.display = "block";
      }
    };
    submit.addEventListener("click", tryLogin);
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
          <span id="admin-lock-slider" style="position:absolute;cursor:pointer;inset:0;background:${locked ? "#2563eb" : "#cbd5e1"};border-radius:22px;transition:0.2s;"></span>
          <span style="position:absolute;height:18px;width:18px;left:${locked ? "20px" : "2px"};top:2px;background:white;border-radius:50%;transition:0.2s;pointer-events:none;"></span>
        </label>
      </div>

      <button id="admin-change-pw" style="width:100%;font-size:12px;padding:8px;background:white;color:#0f172a;font-weight:500;border:1px solid #cbd5e1;border-radius:8px;margin-bottom:8px;cursor:pointer;">비밀번호 변경</button>
      <button id="admin-logout" style="width:100%;font-size:12px;padding:8px;background:white;color:#dc2626;font-weight:500;border:1px solid #cbd5e1;border-radius:8px;cursor:pointer;">로그아웃</button>
    `;
    document
      .getElementById("admin-cancel")
      .addEventListener("click", closeAdminModal);

    const toggle = document.getElementById("admin-lock-toggle");
    toggle.addEventListener("change", async () => {
      try {
        const res = await fetch("/api/admin/lock", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ locked: toggle.checked }),
        });
        if (!res.ok) throw new Error();
        locked = toggle.checked;
        showAdminPanel();
      } catch (e) {
        toggle.checked = !toggle.checked;
        alert("잠금 변경 실패");
      }
    });

    document
      .getElementById("admin-change-pw")
      .addEventListener("click", showPasswordChangeUI);

    document.getElementById("admin-logout").addEventListener("click", () => {
      storedPw = null;
      localStorage.removeItem(PW_KEY);
      isAdmin = false;
      setAdminBodyClass();
      updateLockButton();
      closeAdminModal();
      location.reload();
    });
  }

  function showPasswordChangeUI() {
    const body = document.getElementById("admin-modal-body");
    if (!body) return;
    body.innerHTML = `
      <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:10px;">
        <h3 style="font-size:14px;font-weight:700;margin:0;">비밀번호 변경</h3>
        <button id="admin-back" style="color:#94a3b8;font-size:13px;background:none;border:none;cursor:pointer;">‹ 뒤로</button>
      </div>
      <label style="font-size:11px;color:#64748b;display:block;margin-bottom:4px;">현재 비밀번호</label>
      <input id="admin-cur-pw" type="password" autocomplete="current-password" style="width:100%;font-size:14px;padding:8px 10px;border:1px solid #cbd5e1;border-radius:8px;margin-bottom:8px;box-sizing:border-box;" />
      <label style="font-size:11px;color:#64748b;display:block;margin-bottom:4px;">새 비밀번호 (4자 이상)</label>
      <input id="admin-new-pw" type="password" autocomplete="new-password" style="width:100%;font-size:14px;padding:8px 10px;border:1px solid #cbd5e1;border-radius:8px;margin-bottom:12px;box-sizing:border-box;" />
      <p id="admin-cpw-err" style="font-size:11px;color:#dc2626;margin-bottom:8px;display:none;"></p>
      <button id="admin-cpw-submit" style="width:100%;font-size:14px;padding:8px;background:#2563eb;color:white;font-weight:500;border:none;border-radius:8px;cursor:pointer;">변경</button>
    `;
    document
      .getElementById("admin-back")
      .addEventListener("click", showAdminPanel);
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
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ current: cur.value, next: next.value }),
          });
          if (!res.ok) throw new Error();
          storedPw = next.value;
          localStorage.setItem(PW_KEY, next.value);
          alert("비밀번호가 변경됐어요");
          closeAdminModal();
        } catch (e) {
          err.textContent = "현재 비밀번호가 맞지 않아요";
          err.style.display = "block";
        }
      });
  }

  async function refreshStatus() {
    try {
      const res = await origFetch("/api/admin/status", {
        headers: storedPw ? { "X-Admin-Password": storedPw } : {},
      });
      if (res.ok) {
        const data = await res.json();
        isAdmin = data.is_admin;
        locked = data.locked;
        if (!isAdmin && storedPw) {
          storedPw = null;
          localStorage.removeItem(PW_KEY);
        }
        setAdminBodyClass();
        updateLockButton();
        if (locked && !isAdmin) {
          openAdminModal();
          showLoginUI(true);
        }
      }
    } catch (e) {}
  }

  injectStyles();
  injectLockButton();
  injectModal();
  refreshStatus();

  window.fddAdmin = {
    isAdmin: () => isAdmin,
    refresh: refreshStatus,
  };
})();
