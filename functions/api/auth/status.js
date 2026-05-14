async function sha256Hex(text) {
  const buf = await crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(text)
  );
  return Array.from(new Uint8Array(buf))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

async function getSetting(env, key) {
  const row = await env.DB.prepare("SELECT value FROM settings WHERE key = ?")
    .bind(key)
    .first();
  return row ? row.value : null;
}

export async function onRequestGet({ request, env }) {
  let isAdmin = false;
  const adminPw = request.headers.get("X-Admin-Password");
  if (adminPw) {
    try {
      const hash = await sha256Hex(adminPw);
      const stored = await getSetting(env, "admin_password_hash");
      isAdmin = !!stored && hash === stored;
    } catch {}
  }

  let userAuthenticated = false;
  let accessCode = null;
  const userPw = request.headers.get("X-User-Password");
  const accessCodeHeader = (request.headers.get("X-Access-Code") || "").trim();
  if (userPw && accessCodeHeader) {
    try {
      const hash = await sha256Hex(userPw);
      const stored = await getSetting(env, "user_password_hash");
      if (stored && hash === stored) {
        const codeRow = await env.DB.prepare(
          "SELECT code, label, all_projects FROM access_codes WHERE code = ?"
        )
          .bind(accessCodeHeader)
          .first();
        if (codeRow) {
          userAuthenticated = true;
          let allowedNumbers = null;
          if (!codeRow.all_projects) {
            const { results } = await env.DB.prepare(
              `SELECT p.display_number FROM projects p
               INNER JOIN access_code_projects acp ON p.id = acp.project_id
               WHERE acp.code = ?
               ORDER BY p.display_number ASC`
            )
              .bind(accessCodeHeader)
              .all();
            allowedNumbers = (results || [])
              .map((r) => r.display_number)
              .filter((n) => n != null);
          }
          accessCode = {
            code: codeRow.code,
            label: codeRow.label || "",
            all_projects: !!codeRow.all_projects,
            allowed_project_numbers: allowedNumbers,
          };
        }
      }
    } catch {}
  }

  const userPwSet = !!(await getSetting(env, "user_password_hash"));
  const locked = (await getSetting(env, "locked")) === "1";
  const hasCodesRow = await env.DB.prepare(
    "SELECT 1 FROM access_codes LIMIT 1"
  ).first();

  return Response.json({
    is_admin: isAdmin,
    user_authenticated: userAuthenticated || isAdmin,
    user_password_set: userPwSet,
    has_access_codes: !!hasCodesRow,
    access_code: accessCode,
    locked,
  });
}
