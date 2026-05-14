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

  const current = String(body.current || "");
  const next = String(body.next || "");
  if (!current || !next)
    return new Response("required", { status: 400 });
  if (next.length < 4)
    return new Response("password must be at least 4 chars", { status: 400 });

  const stored = await getSetting(env, "admin_password_hash");
  const currentHash = await sha256Hex(current);
  if (!stored || currentHash !== stored) {
    return new Response("Invalid current password", { status: 401 });
  }

  const nextHash = await sha256Hex(next);
  await env.DB.prepare("UPDATE settings SET value = ? WHERE key = ?")
    .bind(nextHash, "admin_password_hash")
    .run();

  return Response.json({ ok: true });
}
