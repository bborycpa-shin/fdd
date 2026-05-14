(function () {
  const ADMIN_KEY = "fdd_admin_pw";
  const UPLOADER_KEY = "fdd_uploader_id";
  const USER_PW_LOCAL = "fdd_user_pw";
  const USER_PW_SESSION = "fdd_user_pw";
  const ACCESS_CODE_LOCAL = "fdd_access_code";
  const ACCESS_CODE_SESSION = "fdd_access_code";

  let storedAdminPw = localStorage.getItem(ADMIN_KEY) || null;
  let storedUserPw =
    localStorage.getItem(USER_PW_LOCAL) ||
    sessionStorage.getItem(USER_PW_SESSION) ||
    null;
  let storedAccessCode =
    localStorage.getItem(ACCESS_CODE_LOCAL) ||
    sessionStorage.getItem(ACCESS_CODE_SESSION) ||
    null;
  let uploaderId = localStorage.getItem(UPLOADER_KEY);
  if (!uploaderId) {
    uploaderId =
      (crypto.randomUUID && crypto.randomUUID()) ||
      String(Date.now()) + "-" + Math.random().toString(36).slice(2);
    localStorage.setItem(UPLOADER_KEY, uploaderId);
  }
  window.fddUploaderId = uploaderId;
  window.fddAccessCode = storedAccessCode;

  let isAdmin = false;
  let userAuthenticated = false;
  let userPwSet = false;
  let locked = false;
  let currentAccessCode = null;

  const origFetch = window.fetch.bind(window);
  window.fetch = function (input, init) {
    init = init || {};
    const headers = new Headers(init.headers || {});
    if (storedAdminPw) headers.set("X-Admin-Password", storedAdminPw);
    if (storedUserPw) headers.set("X-User-Password", storedUserPw);
    if (storedAccessCode) headers.set("X-Access-Code", storedAccessCode);
    if (uploaderId) headers.set("X-Uploader-Id", uploaderId);
    init.headers = headers;
    return origFetch(input, init);
  };

  function setBodyClasses() {
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
      .keypad-key {
        -webkit-tap-highlight-color: transparent;
        transition: transform 0.06s ease-out, background-color 0.06s, color 0.06s, box-shadow 0.06s;
        box-shadow: 0 1px 2px rgba(15, 23, 42, 0.06);
      }
      .keypad-key:active,
      .keypad-key.pressed {
        background: #2563eb !important;
        color: white !important;
        border-color: #2563eb !important;
        transform: scale(0.92);
        box-shadow: 0 0 0 3px rgba(37, 99, 235, 0.25);
      }
      .input-field.active { border-color: #2563eb !important; box-shadow: 0 0 0 2px rgba(37, 99, 235, 0.15); }
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
      <div style="background:white;border-radius:16px;padding:16px;width:100%;max-width:380px;max-height:85vh;overflow-y:auto;" onclick="event.stopPropagation()">
        <div id="admin-modal-body"></div>
      </div>
    `;
    wrap.addEventListener("click", (e) => {
      if (e.target === wrap) closeAdminModal();
    });
    document.body.appendChild(wrap);
  }

  function closeAdminModal() {
    document.getElementById("admin-modal").style.display = "none";
  }
  function openAdminModal() {
    if (!isAdmin) showAdminLoginUI();
    else showAdminPanel();
    document.getElementById("admin-modal").style.display = "flex";
  }

  function showAdminLoginUI() {
    const body = document.getElementById("admin-modal-body");
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
    document.getElementById("admin-cancel").addEventListener("click", closeAdminModal);
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
    document.getElementById("admin-pw-submit").addEventListener("click", tryLogin);
    input.addEventListener("keydown", (e) => { if (e.key === "Enter") tryLogin(); });
    setTimeout(() => input.focus(), 50);
  }

  function showAdminPanel() {
    const body = document.getElementById("admin-modal-body");
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
      <button id="admin-access-codes" style="width:100%;font-size:12px;padding:8px;background:#eff6ff;color:#1d4ed8;font-weight:600;border:1px solid #bfdbfe;border-radius:8px;margin-bottom:6px;cursor:pointer;">🔑 식별번호 관리</button>
      <button id="admin-change-user-pw" style="width:100%;font-size:12px;padding:8px;background:white;color:#0f172a;font-weight:500;border:1px solid #cbd5e1;border-radius:8px;margin-bottom:6px;cursor:pointer;">일반 비밀번호 변경</button>
      <button id="admin-change-pw" style="width:100%;font-size:12px;padding:8px;background:white;color:#0f172a;font-weight:500;border:1px solid #cbd5e1;border-radius:8px;margin-bottom:8px;cursor:pointer;">관리자 비밀번호 변경</button>
      <button id="admin-logout" style="width:100%;font-size:12px;padding:8px;background:white;color:#dc2626;font-weight:500;border:1px solid #cbd5e1;border-radius:8px;cursor:pointer;">관리자 로그아웃</button>
    `;
    document.getElementById("admin-cancel").addEventListener("click", closeAdminModal);
    document.getElementById("admin-lock-toggle").addEventListener("change", async (e) => {
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
    document.getElementById("admin-access-codes").addEventListener("click", showAccessCodesUI);
    document.getElementById("admin-change-pw").addEventListener("click", showAdminPasswordChangeUI);
    document.getElementById("admin-change-user-pw").addEventListener("click", showUserPasswordChangeUI);
    document.getElementById("admin-logout").addEventListener("click", () => {
      storedAdminPw = null;
      localStorage.removeItem(ADMIN_KEY);
      closeAdminModal();
      location.reload();
    });
  }

  async function showAccessCodesUI() {
    const body = document.getElementById("admin-modal-body");
    body.innerHTML = `
      <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:10px;">
        <h3 style="font-size:14px;font-weight:700;margin:0;">🔑 식별번호 관리</h3>
        <button id="admin-back" style="color:#94a3b8;font-size:13px;background:none;border:none;cursor:pointer;">‹ 뒤로</button>
      </div>
      <button id="ac-new" style="width:100%;font-size:12px;padding:8px;background:#2563eb;color:white;font-weight:500;border:none;border-radius:8px;margin-bottom:10px;cursor:pointer;">+ 새 식별번호 만들기</button>
      <div id="ac-list" style="display:flex;flex-direction:column;gap:6px;"></div>
    `;
    document.getElementById("admin-back").addEventListener("click", showAdminPanel);
    document.getElementById("ac-new").addEventListener("click", () => showAccessCodeForm(null));

    const list = document.getElementById("ac-list");
    list.innerHTML = '<p style="font-size:11px;color:#94a3b8;text-align:center;padding:10px;">불러오는 중...</p>';
    try {
      const res = await origFetch("/api/admin/access-codes", {
        headers: { "X-Admin-Password": storedAdminPw },
      });
      if (!res.ok) throw new Error();
      const data = await res.json();
      if (data.codes.length === 0) {
        list.innerHTML = '<p style="font-size:11px;color:#94a3b8;text-align:center;padding:10px;">등록된 식별번호가 없어요</p>';
        return;
      }
      list.innerHTML = data.codes.map(c => `
        <div style="border:1px solid #e2e8f0;border-radius:8px;padding:8px;background:white;">
          <div style="display:flex;align-items:center;justify-content:space-between;">
            <div>
              <code style="font-size:14px;font-weight:700;background:#f1f5f9;padding:2px 6px;border-radius:4px;">${c.code}</code>
              ${c.label ? `<span style="font-size:11px;color:#64748b;margin-left:6px;">${escapeText(c.label)}</span>` : ''}
            </div>
            <div style="display:flex;gap:4px;">
              <button class="ac-edit" data-code="${c.code}" style="font-size:11px;padding:3px 8px;background:white;color:#0f172a;border:1px solid #cbd5e1;border-radius:6px;cursor:pointer;">수정</button>
              <button class="ac-del" data-code="${c.code}" style="font-size:11px;padding:3px 8px;background:white;color:#dc2626;border:1px solid #cbd5e1;border-radius:6px;cursor:pointer;">삭제</button>
            </div>
          </div>
          <p style="font-size:10px;color:#64748b;margin:6px 0 0 0;">${c.all_projects ? '✅ 모든 프로젝트 열람' : `📁 ${c.project_ids.length}개 프로젝트`}</p>
        </div>
      `).join('');
      list.querySelectorAll('.ac-edit').forEach(btn => {
        btn.addEventListener('click', () => {
          const c = data.codes.find(x => x.code === btn.dataset.code);
          showAccessCodeForm(c);
        });
      });
      list.querySelectorAll('.ac-del').forEach(btn => {
        btn.addEventListener('click', async () => {
          if (!confirm(`식별번호 ${btn.dataset.code}를 삭제할까요?`)) return;
          try {
            const r = await origFetch(`/api/admin/access-codes`, {
              method: 'DELETE',
              headers: { "Content-Type": "application/json", "X-Admin-Password": storedAdminPw },
              body: JSON.stringify({ code: btn.dataset.code }),
            });
            if (!r.ok) throw new Error();
            showAccessCodesUI();
          } catch {
            alert('삭제 실패');
          }
        });
      });
    } catch {
      list.innerHTML = '<p style="font-size:11px;color:#dc2626;text-align:center;padding:10px;">불러오기 실패</p>';
    }
  }

  function escapeText(s) {
    return String(s).replace(/[<>&"]/g, c => ({'<':'&lt;','>':'&gt;','&':'&amp;','"':'&quot;'}[c]));
  }

  async function showAccessCodeForm(existing) {
    const body = document.getElementById("admin-modal-body");
    body.innerHTML = `
      <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:10px;">
        <h3 style="font-size:14px;font-weight:700;margin:0;">${existing ? '식별번호 수정' : '새 식별번호'}</h3>
        <button id="admin-back" style="color:#94a3b8;font-size:13px;background:none;border:none;cursor:pointer;">‹ 뒤로</button>
      </div>
      <label style="font-size:11px;color:#64748b;display:block;margin-bottom:4px;">코드 (6자리, <code>0-9 * # @ ! ~</code>만 사용)</label>
      <input id="ac-code" type="text" maxlength="6" value="${existing ? existing.code : ''}" style="width:100%;font-size:18px;font-weight:600;padding:8px 10px;border:1px solid #cbd5e1;border-radius:8px;margin-bottom:8px;box-sizing:border-box;font-family:monospace;letter-spacing:4px;text-align:center;" />
      <label style="font-size:11px;color:#64748b;display:block;margin-bottom:4px;">별명 (선택, 메모용)</label>
      <input id="ac-label" type="text" maxlength="100" value="${existing ? escapeText(existing.label) : ''}" placeholder="예: 영업팀, 김부장" style="width:100%;font-size:13px;padding:8px 10px;border:1px solid #cbd5e1;border-radius:8px;margin-bottom:10px;box-sizing:border-box;" />

      <div style="display:flex;align-items:center;gap:8px;margin-bottom:8px;padding:8px;background:#f1f5f9;border-radius:8px;">
        <input id="ac-all" type="checkbox" ${existing && existing.all_projects ? 'checked' : ''} style="width:14px;height:14px;accent-color:#2563eb;" />
        <label for="ac-all" style="font-size:12px;font-weight:500;flex:1;cursor:pointer;">모든 프로젝트 열람 가능</label>
      </div>

      <div id="ac-projects-wrap">
        <label style="font-size:11px;color:#64748b;display:block;margin-bottom:4px;">열람 가능한 프로젝트 선택</label>
        <div id="ac-projects" style="display:flex;flex-direction:column;gap:4px;max-height:200px;overflow-y:auto;border:1px solid #e2e8f0;border-radius:8px;padding:6px;margin-bottom:10px;"></div>
      </div>

      <p id="ac-error" style="font-size:11px;color:#dc2626;margin-bottom:8px;display:none;"></p>
      <button id="ac-save" style="width:100%;font-size:14px;padding:8px;background:#2563eb;color:white;font-weight:500;border:none;border-radius:8px;cursor:pointer;">저장</button>
    `;
    document.getElementById("admin-back").addEventListener("click", showAccessCodesUI);

    const allChk = document.getElementById("ac-all");
    const projectsWrap = document.getElementById("ac-projects-wrap");
    const updateWrap = () => {
      projectsWrap.style.display = allChk.checked ? "none" : "block";
    };
    allChk.addEventListener("change", updateWrap);
    updateWrap();

    const projectList = document.getElementById("ac-projects");
    projectList.innerHTML = '<p style="font-size:11px;color:#94a3b8;text-align:center;">불러오는 중...</p>';
    let allProjects = [];
    try {
      const adminFetch = (u) => origFetch(u, { headers: { "X-Admin-Password": storedAdminPw } });
      const r = await adminFetch("/api/projects");
      if (!r.ok) throw new Error();
      const d = await r.json();
      allProjects = d.projects || [];
      const selected = new Set(existing ? existing.project_ids : []);
      if (allProjects.length === 0) {
        projectList.innerHTML = '<p style="font-size:11px;color:#94a3b8;text-align:center;padding:6px;">아직 프로젝트가 없어요</p>';
      } else {
        projectList.innerHTML = allProjects.map(p => `
          <label style="display:flex;align-items:center;gap:6px;padding:4px;cursor:pointer;font-size:12px;">
            <input type="checkbox" class="ac-p" data-id="${p.id}" ${selected.has(p.id) ? 'checked' : ''} style="width:14px;height:14px;accent-color:#2563eb;" />
            <span style="font-weight:600;color:#475569;">#${p.display_number || '?'}</span>
            <span style="flex:1;">${escapeText(p.name)}</span>
          </label>
        `).join('');
      }
    } catch {
      projectList.innerHTML = '<p style="font-size:11px;color:#dc2626;text-align:center;padding:6px;">프로젝트 목록 불러오기 실패</p>';
    }

    const errEl = document.getElementById("ac-error");
    document.getElementById("ac-save").addEventListener("click", async () => {
      errEl.style.display = "none";
      const newCode = document.getElementById("ac-code").value.trim();
      const label = document.getElementById("ac-label").value.trim();
      const allProjectsFlag = allChk.checked;
      const selectedIds = Array.from(projectList.querySelectorAll('.ac-p:checked')).map(i => i.dataset.id);

      if (!/^[0-9*#@!~]{6}$/.test(newCode)) {
        errEl.textContent = "코드는 6자리여야 하고, 0-9 또는 * # @ ! ~ 만 사용해야 해요";
        errEl.style.display = "block";
        return;
      }

      try {
        if (existing) {
          const r = await origFetch("/api/admin/access-codes", {
            method: "PATCH",
            headers: { "Content-Type": "application/json", "X-Admin-Password": storedAdminPw },
            body: JSON.stringify({
              old_code: existing.code,
              new_code: newCode,
              label,
              all_projects: allProjectsFlag,
              project_ids: allProjectsFlag ? [] : selectedIds,
            }),
          });
          if (!r.ok) {
            const t = await r.text();
            throw new Error(t || "save failed");
          }
        } else {
          const r = await origFetch("/api/admin/access-codes", {
            method: "POST",
            headers: { "Content-Type": "application/json", "X-Admin-Password": storedAdminPw },
            body: JSON.stringify({
              code: newCode,
              label,
              all_projects: allProjectsFlag,
              project_ids: allProjectsFlag ? [] : selectedIds,
            }),
          });
          if (!r.ok) {
            const t = await r.text();
            throw new Error(t || "save failed");
          }
        }
        showAccessCodesUI();
      } catch (e) {
        errEl.textContent = e.message || "저장 실패";
        errEl.style.display = "block";
      }
    });
  }

  function showAdminPasswordChangeUI() {
    const body = document.getElementById("admin-modal-body");
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
    document.getElementById("admin-cpw-submit").addEventListener("click", async () => {
      err.style.display = "none";
      if (!cur.value || !next.value) return;
      if (next.value.length < 4) { err.textContent = "새 비밀번호는 4자 이상이어야 해요"; err.style.display = "block"; return; }
      try {
        const res = await origFetch("/api/admin/password", {
          method: "POST",
          headers: { "Content-Type": "application/json", "X-Admin-Password": storedAdminPw },
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

  async function showUserPasswordChangeUI() {
    const body = document.getElementById("admin-modal-body");
    body.innerHTML = `
      <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:10px;">
        <h3 style="font-size:14px;font-weight:700;margin:0;">일반 비밀번호 변경</h3>
        <button id="admin-back" style="color:#94a3b8;font-size:13px;background:none;border:none;cursor:pointer;">‹ 뒤로</button>
      </div>
      <div style="background:#f1f5f9;border:1px solid #e2e8f0;border-radius:8px;padding:8px;margin-bottom:10px;">
        <p style="font-size:10px;color:#64748b;margin:0 0 2px 0;">현재 비밀번호</p>
        <p id="user-cur-pw" style="font-size:15px;font-weight:700;color:#0f172a;margin:0;font-family:monospace;letter-spacing:2px;">불러오는 중...</p>
      </div>
      <p style="font-size:11px;color:#64748b;margin-bottom:8px;">키패드의 문자(<code>0-9 * # @ ! ~</code>)만 사용하세요.</p>
      <label style="font-size:11px;color:#64748b;display:block;margin-bottom:4px;">새 비밀번호</label>
      <input id="user-new-pw" type="text" autocomplete="off" style="width:100%;font-size:14px;padding:8px 10px;border:1px solid #cbd5e1;border-radius:8px;margin-bottom:12px;box-sizing:border-box;" />
      <p id="user-cpw-err" style="font-size:11px;color:#dc2626;margin-bottom:8px;display:none;"></p>
      <button id="user-cpw-submit" style="width:100%;font-size:14px;padding:8px;background:#2563eb;color:white;font-weight:500;border:none;border-radius:8px;cursor:pointer;">변경</button>
    `;
    document.getElementById("admin-back").addEventListener("click", showAdminPanel);

    const curEl = document.getElementById("user-cur-pw");
    try {
      const r = await origFetch("/api/admin/user-password", {
        headers: { "X-Admin-Password": storedAdminPw },
      });
      if (r.ok) {
        const d = await r.json();
        curEl.textContent = d.password ? d.password : "(표시할 수 없음)";
        curEl.style.color = d.password ? "#0f172a" : "#94a3b8";
      } else {
        curEl.textContent = "(불러오기 실패)";
        curEl.style.color = "#dc2626";
      }
    } catch {
      curEl.textContent = "(불러오기 실패)";
      curEl.style.color = "#dc2626";
    }

    const next = document.getElementById("user-new-pw");
    const err = document.getElementById("user-cpw-err");
    document.getElementById("user-cpw-submit").addEventListener("click", async () => {
      err.style.display = "none";
      const v = next.value.trim();
      if (!v) return;
      if (!/^[0-9*#@!~]+$/.test(v)) { err.textContent = "키패드 문자만 사용해주세요"; err.style.display = "block"; return; }
      try {
        const res = await origFetch("/api/admin/user-password", {
          method: "POST",
          headers: { "Content-Type": "application/json", "X-Admin-Password": storedAdminPw },
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
      "position:fixed;inset:0;background:#f8fafc;z-index:80;display:none;align-items:flex-start;justify-content:center;padding:28px;overflow-y:auto;";
    wrap.innerHTML = `
      <div style="width:100%;max-width:280px;display:flex;flex-direction:column;align-items:center;">
        <h1 style="font-size:16px;font-weight:700;margin:4px 0 10px 0;text-align:center;display:flex;align-items:baseline;gap:5px;">
          <span>📁 파일공유 시스템</span>
          <span style="font-size:9px;font-weight:400;color:#94a3b8;">by 신CPA</span>
        </h1>

        <label style="font-size:10px;color:#475569;width:100%;margin-bottom:2px;font-weight:500;">비밀번호</label>
        <div id="login-pw-display" class="input-field" style="width:100%;background:white;border:1px solid #cbd5e1;border-radius:8px;padding:7px;text-align:center;font-size:17px;letter-spacing:5px;min-height:34px;margin-bottom:6px;color:#0f172a;font-weight:600;cursor:pointer;box-sizing:border-box;"></div>

        <label style="font-size:10px;color:#475569;width:100%;margin-bottom:2px;font-weight:500;">식별번호 (6자리)</label>
        <div id="login-code-display" class="input-field" style="width:100%;background:white;border:1px solid #cbd5e1;border-radius:8px;padding:7px;text-align:center;font-size:17px;letter-spacing:5px;min-height:34px;margin-bottom:4px;color:#0f172a;font-weight:600;cursor:pointer;box-sizing:border-box;"></div>

        <p id="login-error" style="font-size:10px;color:#dc2626;margin:0 0 6px 0;min-height:14px;text-align:center;"></p>

        <div id="login-keypad" style="width:100%;display:grid;grid-template-columns:repeat(4,1fr);gap:4px;margin-bottom:8px;"></div>

        <label style="display:flex;align-items:center;gap:5px;font-size:11px;color:#475569;margin-bottom:7px;">
          <input id="login-remember" type="checkbox" style="width:13px;height:13px;accent-color:#2563eb;" />
          이 기기에서 비번+식별번호 기억
        </label>

        <button id="login-submit" style="width:100%;font-size:14px;padding:8px;background:#2563eb;color:white;font-weight:500;border:none;border-radius:8px;cursor:pointer;margin-bottom:5px;">로그인</button>
        <button id="login-admin-mode" style="width:100%;font-size:11px;padding:6px;background:white;color:#0f172a;font-weight:500;border:1px solid #cbd5e1;border-radius:8px;cursor:pointer;">관리자 모드</button>
      </div>
    `;
    document.body.appendChild(wrap);

    const pwDisplay = document.getElementById("login-pw-display");
    const codeDisplay = document.getElementById("login-code-display");
    const errEl = document.getElementById("login-error");
    const keypad = document.getElementById("login-keypad");
    let pwBuffer = "";
    let codeBuffer = "";
    let activeField = "pw"; // 'pw' or 'code'
    let pwRevealUntil = 0;
    let codeRevealUntil = 0;
    let revealTimer = null;
    const REVEAL_MS = 800;

    function renderMasked(buf, revealUntil) {
      if (!buf) return "—";
      const showLast = Date.now() < revealUntil;
      if (!showLast) return "●".repeat(buf.length);
      return "●".repeat(buf.length - 1) + buf[buf.length - 1];
    }

    function updateDisplays() {
      pwDisplay.textContent = renderMasked(pwBuffer, pwRevealUntil);
      codeDisplay.textContent = renderMasked(codeBuffer, codeRevealUntil);
      pwDisplay.classList.toggle("active", activeField === "pw");
      codeDisplay.classList.toggle("active", activeField === "code");
    }

    function scheduleReveal() {
      if (revealTimer) clearTimeout(revealTimer);
      const earliest = Math.min(
        pwRevealUntil || Infinity,
        codeRevealUntil || Infinity
      );
      const now = Date.now();
      const latest = Math.max(pwRevealUntil, codeRevealUntil);
      if (latest > now) {
        revealTimer = setTimeout(updateDisplays, latest - now + 30);
      }
    }

    updateDisplays();

    pwDisplay.addEventListener("click", () => { activeField = "pw"; updateDisplays(); });
    codeDisplay.addEventListener("click", () => { activeField = "code"; updateDisplays(); });

    const keys = ["1","2","3","4","5","6","7","8","9","0","*","#","@","!","~","⌫"];
    keys.forEach(k => {
      const btn = document.createElement("button");
      btn.className = "keypad-key";
      btn.style.cssText = "padding:9px 0;background:white;border:1px solid #cbd5e1;border-radius:8px;font-size:16px;font-weight:600;color:#0f172a;cursor:pointer;";
      btn.textContent = k;
      btn.addEventListener("click", () => {
        btn.classList.add("pressed");
        setTimeout(() => btn.classList.remove("pressed"), 110);
        errEl.textContent = "";
        if (k === "⌫") {
          if (activeField === "pw") {
            pwBuffer = pwBuffer.slice(0, -1);
            pwRevealUntil = 0;
          } else {
            codeBuffer = codeBuffer.slice(0, -1);
            codeRevealUntil = 0;
          }
        } else {
          if (activeField === "pw") {
            if (pwBuffer.length < 8) {
              pwBuffer += k;
              pwRevealUntil = Date.now() + REVEAL_MS;
              if (pwBuffer.length === 8) {
                activeField = "code";
              }
            }
          } else {
            if (codeBuffer.length < 6) {
              codeBuffer += k;
              codeRevealUntil = Date.now() + REVEAL_MS;
              if (codeBuffer.length === 6 && pwBuffer.length < 8) {
                activeField = "pw";
              }
            }
          }
        }
        updateDisplays();
        scheduleReveal();
      });
      keypad.appendChild(btn);
    });

    const submit = async () => {
      if (!pwBuffer || !codeBuffer) {
        errEl.textContent = "비밀번호와 식별번호를 모두 입력하세요";
        return;
      }
      if (codeBuffer.length !== 6) {
        errEl.textContent = "식별번호는 6자리입니다";
        return;
      }
      try {
        const res = await origFetch("/api/auth/login", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ password: pwBuffer, access_code: codeBuffer }),
        });
        if (!res.ok) throw new Error();
        const remember = document.getElementById("login-remember").checked;
        if (remember) {
          localStorage.setItem(USER_PW_LOCAL, pwBuffer);
          localStorage.setItem(ACCESS_CODE_LOCAL, codeBuffer);
          sessionStorage.removeItem(USER_PW_SESSION);
          sessionStorage.removeItem(ACCESS_CODE_SESSION);
        } else {
          sessionStorage.setItem(USER_PW_SESSION, pwBuffer);
          sessionStorage.setItem(ACCESS_CODE_SESSION, codeBuffer);
          localStorage.removeItem(USER_PW_LOCAL);
          localStorage.removeItem(ACCESS_CODE_LOCAL);
        }
        storedUserPw = pwBuffer;
        storedAccessCode = codeBuffer;
        location.reload();
      } catch {
        errEl.textContent = "비밀번호 또는 식별번호가 맞지 않아요";
        pwBuffer = "";
        codeBuffer = "";
        activeField = "pw";
        updateDisplays();
      }
    };

    document.getElementById("login-submit").addEventListener("click", submit);
    document.getElementById("login-admin-mode").addEventListener("click", () => {
      hideLoginOverlay();
      openAdminModal();
    });
  }

  function showLoginOverlay() {
    document.body.classList.add("needs-login");
    document.getElementById("login-overlay").style.display = "flex";
  }
  function hideLoginOverlay() {
    document.body.classList.remove("needs-login");
    document.getElementById("login-overlay").style.display = "none";
  }

  function injectAuthStatusLine() {
    const slot = document.getElementById("auth-status-slot");
    if (!slot) return;
    let html = "";
    if (isAdmin) {
      html = `🔓 관리자 (모든 권한)`;
    } else if (userAuthenticated && currentAccessCode) {
      const labelTxt = currentAccessCode.label
        ? `${escapeText(currentAccessCode.label)} · `
        : "";
      let scope;
      if (currentAccessCode.all_projects) {
        scope = "모든 프로젝트 열람 가능";
      } else {
        const nums = (currentAccessCode.allowed_project_numbers || [])
          .map((n) => `#${n}`)
          .join(", ");
        scope = nums ? `프로젝트 ${nums} 열람 가능` : "열람 가능 프로젝트 없음";
      }
      html = `🔑 권한 식별 : ${labelTxt}${scope}`;
    }
    if (!html) {
      slot.innerHTML = "";
      return;
    }
    slot.innerHTML = `
      <div style="display:flex;justify-content:flex-end;font-size:10px;color:#64748b;margin-bottom:6px;line-height:1.3;padding:0 2px;">
        <span style="background:rgba(255,255,255,0.7);border:1px solid #e2e8f0;border-radius:9999px;padding:2px 8px;">${html}</span>
      </div>
    `;
  }

  async function refreshStatus() {
    try {
      const headers = {};
      if (storedAdminPw) headers["X-Admin-Password"] = storedAdminPw;
      if (storedUserPw) headers["X-User-Password"] = storedUserPw;
      if (storedAccessCode) headers["X-Access-Code"] = storedAccessCode;
      const res = await origFetch("/api/auth/status", { headers });
      if (!res.ok) return;
      const data = await res.json();
      isAdmin = data.is_admin;
      userAuthenticated = data.user_authenticated;
      userPwSet = data.user_password_set;
      locked = data.locked;
      currentAccessCode = data.access_code || null;
      if (!isAdmin && storedAdminPw) {
        storedAdminPw = null;
        localStorage.removeItem(ADMIN_KEY);
      }
      if (!userAuthenticated && (storedUserPw || storedAccessCode)) {
        storedUserPw = null;
        storedAccessCode = null;
        localStorage.removeItem(USER_PW_LOCAL);
        sessionStorage.removeItem(USER_PW_SESSION);
        localStorage.removeItem(ACCESS_CODE_LOCAL);
        sessionStorage.removeItem(ACCESS_CODE_SESSION);
      }
      setBodyClasses();
      updateLockButton();
      injectAuthStatusLine();
      if (!isAdmin && !userAuthenticated) {
        showLoginOverlay();
      } else {
        hideLoginOverlay();
        if (locked && !isAdmin) openAdminModal();
      }
    } catch {}
  }

  function injectLogoutSlot() {
    const slot = document.getElementById("logout-slot");
    if (!slot) return;
    slot.innerHTML = `
      <button id="logout-btn" aria-label="로그아웃"
        class="shrink-0 inline-flex items-center justify-center px-2 py-1 rounded-lg border border-slate-300 bg-white text-slate-600 active:bg-slate-100 text-[11px] font-medium"
        title="로그아웃 (로그인 화면으로)">
        <span style="margin-right:2px;">↩</span>로그아웃
      </button>
    `;
    document.getElementById("logout-btn").addEventListener("click", () => {
      storedUserPw = null;
      storedAccessCode = null;
      localStorage.removeItem(USER_PW_LOCAL);
      sessionStorage.removeItem(USER_PW_SESSION);
      localStorage.removeItem(ACCESS_CODE_LOCAL);
      sessionStorage.removeItem(ACCESS_CODE_SESSION);
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
