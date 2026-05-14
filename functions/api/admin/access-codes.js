async function sha256Hex(text) {
  const buf = await crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(text)
  );
  return Array.from(new Uint8Array(buf))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

async function requireAdmin(request, env) {
  const pw = request.headers.get("X-Admin-Password");
  if (!pw) return false;
  const hash = await sha256Hex(pw);
  const row = await env.DB.prepare(
    "SELECT value FROM settings WHERE key = ?"
  )
    .bind("admin_password_hash")
    .first();
  return !!row && row.value === hash;
}

const VALID_CHARS = /^[0-9*#@!~]{6}$/;

export async function onRequestGet({ request, env }) {
  if (!(await requireAdmin(request, env))) {
    return new Response("Admin required", { status: 403 });
  }
  const { results: codes } = await env.DB.prepare(
    "SELECT code, label, all_projects, created_at FROM access_codes ORDER BY created_at ASC"
  ).all();
  const { results: assignments } = await env.DB.prepare(
    "SELECT code, project_id FROM access_code_projects"
  ).all();
  const map = new Map();
  for (const c of codes) map.set(c.code, []);
  for (const a of assignments) {
    if (map.has(a.code)) map.get(a.code).push(a.project_id);
  }
  return Response.json({
    codes: codes.map((c) => ({
      code: c.code,
      label: c.label || "",
      all_projects: !!c.all_projects,
      project_ids: map.get(c.code) || [],
      created_at: c.created_at,
    })),
  });
}

export async function onRequestPost({ request, env }) {
  if (!(await requireAdmin(request, env))) {
    return new Response("Admin required", { status: 403 });
  }
  let body;
  try {
    body = await request.json();
  } catch {
    return new Response("Invalid JSON", { status: 400 });
  }

  const code = String(body.code || "").trim();
  if (!VALID_CHARS.test(code)) {
    return new Response("code must be 6 chars from 0-9*#@!~", { status: 400 });
  }
  const label = String(body.label || "").trim().slice(0, 100);
  const allProjects = body.all_projects ? 1 : 0;
  const projectIds = Array.isArray(body.project_ids) ? body.project_ids : [];

  const exists = await env.DB.prepare(
    "SELECT 1 FROM access_codes WHERE code = ?"
  )
    .bind(code)
    .first();
  if (exists) return new Response("code already exists", { status: 409 });

  await env.DB.prepare(
    "INSERT INTO access_codes (code, label, all_projects) VALUES (?, ?, ?)"
  )
    .bind(code, label || null, allProjects)
    .run();

  if (!allProjects && projectIds.length > 0) {
    const stmts = projectIds.map((pid) =>
      env.DB.prepare(
        "INSERT OR IGNORE INTO access_code_projects (code, project_id) VALUES (?, ?)"
      ).bind(code, String(pid))
    );
    await env.DB.batch(stmts);
  }

  return Response.json({ ok: true, code });
}

export async function onRequestPatch({ request, env }) {
  if (!(await requireAdmin(request, env))) {
    return new Response("Admin required", { status: 403 });
  }
  let body;
  try {
    body = await request.json();
  } catch {
    return new Response("Invalid JSON", { status: 400 });
  }

  const oldCode = String(body.old_code || "").trim();
  if (!oldCode) return new Response("old_code required", { status: 400 });

  const existing = await env.DB.prepare(
    "SELECT code, all_projects FROM access_codes WHERE code = ?"
  )
    .bind(oldCode)
    .first();
  if (!existing) return new Response("Not found", { status: 404 });

  let newCode = oldCode;
  if (body.new_code !== undefined) {
    const candidate = String(body.new_code).trim();
    if (!VALID_CHARS.test(candidate)) {
      return new Response("new_code must be 6 chars from 0-9*#@!~", {
        status: 400,
      });
    }
    if (candidate !== oldCode) {
      const clash = await env.DB.prepare(
        "SELECT 1 FROM access_codes WHERE code = ?"
      )
        .bind(candidate)
        .first();
      if (clash) return new Response("code already exists", { status: 409 });
      newCode = candidate;
    }
  }

  let allProjects = existing.all_projects;
  if (body.all_projects !== undefined) {
    allProjects = body.all_projects ? 1 : 0;
  }

  let label;
  let updateLabel = false;
  if (body.label !== undefined) {
    label = String(body.label || "").trim().slice(0, 100) || null;
    updateLabel = true;
  }

  let projectIds = null;
  if (Array.isArray(body.project_ids)) {
    projectIds = body.project_ids.map(String);
  }

  if (newCode !== oldCode) {
    await env.DB.batch([
      env.DB.prepare(
        "UPDATE access_codes SET code = ? WHERE code = ?"
      ).bind(newCode, oldCode),
      env.DB.prepare(
        "UPDATE access_code_projects SET code = ? WHERE code = ?"
      ).bind(newCode, oldCode),
    ]);
  }

  const sets = ["all_projects = ?"];
  const vals = [allProjects];
  if (updateLabel) {
    sets.push("label = ?");
    vals.push(label);
  }
  vals.push(newCode);
  await env.DB.prepare(
    `UPDATE access_codes SET ${sets.join(", ")} WHERE code = ?`
  )
    .bind(...vals)
    .run();

  if (projectIds !== null) {
    await env.DB.prepare(
      "DELETE FROM access_code_projects WHERE code = ?"
    )
      .bind(newCode)
      .run();
    if (!allProjects && projectIds.length > 0) {
      const stmts = projectIds.map((pid) =>
        env.DB.prepare(
          "INSERT OR IGNORE INTO access_code_projects (code, project_id) VALUES (?, ?)"
        ).bind(newCode, pid)
      );
      await env.DB.batch(stmts);
    }
  } else if (allProjects) {
    await env.DB.prepare(
      "DELETE FROM access_code_projects WHERE code = ?"
    )
      .bind(newCode)
      .run();
  }

  return Response.json({ ok: true, code: newCode });
}

export async function onRequestDelete({ request, env }) {
  if (!(await requireAdmin(request, env))) {
    return new Response("Admin required", { status: 403 });
  }
  let body;
  try {
    body = await request.json();
  } catch {
    return new Response("Invalid JSON", { status: 400 });
  }
  const code = String(body.code || "").trim();
  if (!code) return new Response("code required", { status: 400 });

  await env.DB.batch([
    env.DB.prepare(
      "DELETE FROM access_code_projects WHERE code = ?"
    ).bind(code),
    env.DB.prepare("DELETE FROM access_codes WHERE code = ?").bind(code),
  ]);
  return new Response(null, { status: 204 });
}
