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

async function requireAdmin(request, env) {
  const pw = request.headers.get("X-Admin-Password");
  if (!pw) return false;
  const hash = await sha256Hex(pw);
  const stored = await getSetting(env, "admin_password_hash");
  return !!stored && hash === stored;
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
  const locked = body.locked ? "1" : "0";
  await env.DB.prepare("UPDATE settings SET value = ? WHERE key = ?")
    .bind(locked, "locked")
    .run();
  return Response.json({ ok: true, locked: locked === "1" });
}
