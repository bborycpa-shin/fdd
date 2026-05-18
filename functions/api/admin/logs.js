async function sha256Hex(text) {
  const buf = await crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(text)
  );
  return Array.from(new Uint8Array(buf))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

async function isAdmin(request, env) {
  const pw = request.headers.get("X-Admin-Password");
  if (!pw) return false;
  try {
    const hash = await sha256Hex(pw);
    const row = await env.DB.prepare(
      "SELECT value FROM settings WHERE key = ?"
    )
      .bind("admin_password_hash")
      .first();
    return !!row && row.value === hash;
  } catch {
    return false;
  }
}

const KIND_LABEL = {
  login: "로그인",
  admin: "설정",
  project: "프로젝트",
  folder: "폴더",
  file: "파일",
};

const ACTION_LABEL = {
  user_login: "일반 로그인",
  admin_login: "관리자 로그인",
  lock_toggle: "전체 잠금 변경",
  admin_password_change: "관리자 비밀번호 변경",
  user_password_change: "일반 비밀번호 변경",
  access_code_add: "식별번호 추가",
  access_code_delete: "식별번호 삭제",
  access_code_edit: "식별번호 수정",
  projects_reorder: "프로젝트 순서 변경",
  notice_edit: "안내 문구 수정",
  create: "생성",
  edit: "수정",
  delete: "삭제",
  set_image: "이미지 설정",
  delete_image: "이미지 삭제",
  upload: "업로드",
  rename: "이름 변경",
  download: "다운로드",
  view: "보기",
  zip_download: "ZIP 다운로드",
};

function pad(n) {
  return n < 10 ? "0" + n : String(n);
}

const KST_OFFSET_SEC = 9 * 3600;

function formatTs(ts) {
  const d = new Date((ts + KST_OFFSET_SEC) * 1000);
  const yyyy = d.getUTCFullYear();
  const mm = pad(d.getUTCMonth() + 1);
  const dd = pad(d.getUTCDate());
  const hh = pad(d.getUTCHours());
  const mi = pad(d.getUTCMinutes());
  const ss = pad(d.getUTCSeconds());
  return `${yyyy}-${mm}-${dd} ${hh}:${mi}:${ss}`;
}

export async function onRequestGet({ request, env }) {
  if (!(await isAdmin(request, env))) {
    return new Response("Admin required", { status: 403 });
  }

  const { results } = await env.DB.prepare(
    "SELECT ts, kind, action, success, actor, actor_label, ip, target_id, target_name FROM activity_logs ORDER BY ts DESC, id DESC LIMIT 50000"
  ).all();

  const rows = results || [];

  const header =
    "# fdd 활동 로그\n" +
    `# 생성 시각: ${formatTs(Math.floor(Date.now() / 1000))} (KST)\n` +
    `# 보관 기간: 최근 30일\n` +
    `# 총 ${rows.length}건\n` +
    "# 시간(KST) | 종류 | 행위 | 결과 | 사용자 | IP | 대상\n" +
    "# ─────────────────────────────────────────────\n";

  const lines = rows.map((r) => {
    const time = formatTs(r.ts);
    const kindLabel = KIND_LABEL[r.kind] || r.kind;
    const actionLabel = ACTION_LABEL[r.action] || r.action;
    const result = r.success ? "성공" : "실패";
    let who = "(비인증)";
    if (r.actor === "admin") who = "관리자";
    else if (r.actor) {
      who = r.actor_label
        ? `${r.actor_label}(${r.actor})`
        : r.actor;
    }
    const ip = r.ip || "-";
    let target = "";
    if (r.target_name) {
      target = `${r.target_name}`;
      if (r.target_id) target += ` [${r.target_id}]`;
    } else if (r.target_id) {
      target = `[${r.target_id}]`;
    }
    return `${time} | ${kindLabel} | ${actionLabel} | ${result} | ${who} | ${ip} | ${target}`;
  });

  const body = header + lines.join("\n") + (lines.length ? "\n" : "");

  const d = new Date(Date.now() + KST_OFFSET_SEC * 1000);
  const yyyy = d.getUTCFullYear();
  const mm = pad(d.getUTCMonth() + 1);
  const dd = pad(d.getUTCDate());
  const filename = `fdd-logs-${yyyy}${mm}${dd}.txt`;
  const encoded = encodeURIComponent(filename);

  return new Response(body, {
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
      "Content-Disposition": `attachment; filename*=UTF-8''${encoded}`,
      "Cache-Control": "no-cache",
    },
  });
}
