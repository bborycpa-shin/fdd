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

export async function onRequestPost({ request, env }) {
  let body;
  try {
    body = await request.json();
  } catch {
    return new Response("Invalid JSON", { status: 400 });
  }
  const pw = String(body.password || "");
  if (!pw) return new Response("password required", { status: 400 });

  const hash = await sha256Hex(pw);
  const stored = await getSetting(env, "admin_password_hash");
  if (!stored || hash !== stored) {
    return new Response("Invalid", { status: 401 });
  }
  return Response.json({ ok: true });
}
