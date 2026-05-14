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
  const pw = request.headers.get("X-Admin-Password");
  let isAdmin = false;
  if (pw) {
    try {
      const hash = await sha256Hex(pw);
      const stored = await getSetting(env, "admin_password_hash");
      isAdmin = !!stored && hash === stored;
    } catch {}
  }
  const locked = (await getSetting(env, "locked")) === "1";
  return Response.json({ is_admin: isAdmin, locked });
}
