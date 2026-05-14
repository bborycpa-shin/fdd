let migrationsDone = false;

async function sha256Hex(text) {
  const buf = await crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(text)
  );
  return Array.from(new Uint8Array(buf))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

async function ensureColumn(env, table, column, type) {
  const row = await env.DB.prepare(
    `SELECT COUNT(*) as cnt FROM pragma_table_info('${table}') WHERE name = ?`
  )
    .bind(column)
    .first();
  if (row && row.cnt === 0) {
    await env.DB.prepare(
      `ALTER TABLE ${table} ADD COLUMN ${column} ${type}`
    ).run();
  }
}

async function ensureProjectNumbers(env) {
  const { results } = await env.DB.prepare(
    "SELECT id FROM projects WHERE display_number IS NULL ORDER BY created_at ASC, id ASC"
  ).all();
  if (!results || results.length === 0) return;
  const maxRow = await env.DB.prepare(
    "SELECT COALESCE(MAX(display_number), 0) as mx FROM projects"
  ).first();
  let next = ((maxRow && maxRow.mx) || 0) + 1;
  for (const row of results) {
    await env.DB.prepare(
      "UPDATE projects SET display_number = ? WHERE id = ?"
    )
      .bind(next, row.id)
      .run();
    next++;
  }
}

async function ensureMigrations(env) {
  if (migrationsDone) return;
  if (!env || !env.DB) return;
  try {
    await ensureColumn(env, "projects", "image_r2_key", "TEXT");
    await ensureColumn(env, "projects", "color_index", "INTEGER");
    await ensureColumn(env, "projects", "display_number", "INTEGER");
    await ensureColumn(env, "files", "uploader_id", "TEXT");

    await env.DB.prepare(
      "CREATE TABLE IF NOT EXISTS settings (key TEXT PRIMARY KEY, value TEXT)"
    ).run();
    await env.DB.prepare(
      `CREATE TABLE IF NOT EXISTS access_codes (
        code TEXT PRIMARY KEY,
        label TEXT,
        all_projects INTEGER NOT NULL DEFAULT 0,
        created_at INTEGER NOT NULL DEFAULT (unixepoch())
      )`
    ).run();
    await env.DB.prepare(
      `CREATE TABLE IF NOT EXISTS access_code_projects (
        code TEXT NOT NULL,
        project_id TEXT NOT NULL,
        PRIMARY KEY (code, project_id)
      )`
    ).run();

    const adminRow = await env.DB.prepare(
      "SELECT value FROM settings WHERE key = ?"
    )
      .bind("admin_password_hash")
      .first();
    if (!adminRow) {
      const defaultHash = await sha256Hex("7878ssss");
      await env.DB.prepare(
        "INSERT INTO settings (key, value) VALUES (?, ?)"
      )
        .bind("admin_password_hash", defaultHash)
        .run();
    }

    const userPwRow = await env.DB.prepare(
      "SELECT value FROM settings WHERE key = ?"
    )
      .bind("user_password_hash")
      .first();
    if (!userPwRow) {
      const defaultHash = await sha256Hex("1234");
      await env.DB.prepare(
        "INSERT INTO settings (key, value) VALUES (?, ?)"
      )
        .bind("user_password_hash", defaultHash)
        .run();
    }

    const lockedRow = await env.DB.prepare(
      "SELECT value FROM settings WHERE key = ?"
    )
      .bind("locked")
      .first();
    if (!lockedRow) {
      await env.DB.prepare(
        "INSERT INTO settings (key, value) VALUES (?, ?)"
      )
        .bind("locked", "0")
        .run();
    }

    await ensureProjectNumbers(env);

    migrationsDone = true;
  } catch (e) {
    // ignore — retry on next request
  }
}

async function getSetting(env, key) {
  const row = await env.DB.prepare("SELECT value FROM settings WHERE key = ?")
    .bind(key)
    .first();
  return row ? row.value : null;
}

async function isAdminRequest(request, env) {
  const pw = request.headers.get("X-Admin-Password");
  if (!pw) return false;
  try {
    const hash = await sha256Hex(pw);
    const stored = await getSetting(env, "admin_password_hash");
    return !!stored && hash === stored;
  } catch {
    return false;
  }
}

async function getAccessCode(request, env) {
  const code = (request.headers.get("X-Access-Code") || "").trim();
  if (!code) return null;
  try {
    return await env.DB.prepare(
      "SELECT code, label, all_projects FROM access_codes WHERE code = ?"
    )
      .bind(code)
      .first();
  } catch {
    return null;
  }
}

async function isUserAuthenticated(request, env) {
  const pw = request.headers.get("X-User-Password");
  if (!pw) return { ok: false };
  try {
    const hash = await sha256Hex(pw);
    const stored = await getSetting(env, "user_password_hash");
    if (!stored || hash !== stored) return { ok: false };
  } catch {
    return { ok: false };
  }
  const codeRow = await getAccessCode(request, env);
  if (!codeRow) return { ok: false };
  return { ok: true, accessCode: codeRow };
}

async function isLocked(env) {
  return (await getSetting(env, "locked")) === "1";
}

export async function onRequest(context) {
  await ensureMigrations(context.env);

  const url = new URL(context.request.url);
  const path = url.pathname;
  const method = context.request.method.toUpperCase();

  if (path.startsWith("/api/admin/") || path.startsWith("/api/auth/")) {
    return context.next();
  }

  if (path.startsWith("/api/")) {
    const adminMode = await isAdminRequest(context.request, context.env);
    const userAuth = await isUserAuthenticated(context.request, context.env);
    const lockedFlag = await isLocked(context.env);

    if (adminMode) {
      context.data = context.data || {};
      context.data.isAdmin = true;
    } else if (userAuth.ok) {
      context.data = context.data || {};
      context.data.isAdmin = false;
      context.data.accessCode = userAuth.accessCode;
    }

    const isPublicGet =
      method === "GET" &&
      (/^\/api\/projects\/[^/]+\/image$/.test(path) ||
        /^\/api\/files\/[^/]+\/download$/.test(path));

    if (lockedFlag && !adminMode) {
      return new Response("Locked", { status: 403 });
    }

    if (!adminMode && !userAuth.ok && !isPublicGet) {
      return new Response("Login required", { status: 401 });
    }

    if (!adminMode) {
      const publicPostPaths = new Set(["/api/files", "/api/folders"]);
      const isPublicCreate =
        method === "POST" && publicPostPaths.has(path);
      const isOwnerFileDelete =
        method === "DELETE" && /^\/api\/files\/[^/]+$/.test(path);
      const isMutating = ["POST", "PATCH", "DELETE", "PUT"].includes(method);
      if (isMutating && !isPublicCreate && !isOwnerFileDelete) {
        return new Response("Admin required", { status: 403 });
      }
    }
  }

  return context.next();
}
