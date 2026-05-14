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

export async function onRequestPatch({ params, request, env }) {
  if (!(await requireAdmin(request, env))) {
    return new Response("Admin required", { status: 403 });
  }
  const code = params.code;
  const existing = await env.DB.prepare(
    "SELECT code, all_projects FROM access_codes WHERE code = ?"
  )
    .bind(code)
    .first();
  if (!existing) return new Response("Not found", { status: 404 });

  let body;
  try {
    body = await request.json();
  } catch {
    return new Response("Invalid JSON", { status: 400 });
  }

  let newCode = code;
  if (body.new_code !== undefined) {
    newCode = String(body.new_code).trim();
    if (!VALID_CHARS.test(newCode)) {
      return new Response("new_code must be 6 chars from 0-9*#@!~", {
        status: 400,
      });
    }
    if (newCode !== code) {
      const clash = await env.DB.prepare(
        "SELECT 1 FROM access_codes WHERE code = ?"
      )
        .bind(newCode)
        .first();
      if (clash) return new Response("code already exists", { status: 409 });
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

  if (newCode !== code) {
    await env.DB.batch([
      env.DB.prepare(
        "UPDATE access_codes SET code = ? WHERE code = ?"
      ).bind(newCode, code),
      env.DB.prepare(
        "UPDATE access_code_projects SET code = ? WHERE code = ?"
      ).bind(newCode, code),
    ]);
  }

  const updates = [];
  const values = [];
  updates.push("all_projects = ?");
  values.push(allProjects);
  if (updateLabel) {
    updates.push("label = ?");
    values.push(label);
  }
  values.push(newCode);
  await env.DB.prepare(
    `UPDATE access_codes SET ${updates.join(", ")} WHERE code = ?`
  )
    .bind(...values)
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

export async function onRequestDelete({ params, request, env }) {
  if (!(await requireAdmin(request, env))) {
    return new Response("Admin required", { status: 403 });
  }
  const code = params.code;
  await env.DB.batch([
    env.DB.prepare("DELETE FROM access_code_projects WHERE code = ?").bind(
      code
    ),
    env.DB.prepare("DELETE FROM access_codes WHERE code = ?").bind(code),
  ]);
  return new Response(null, { status: 204 });
}
