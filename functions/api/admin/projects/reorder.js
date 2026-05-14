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
  const order = Array.isArray(body.order) ? body.order.map(String) : null;
  if (!order || order.length === 0) {
    return new Response("order required", { status: 400 });
  }

  const stmts = order.map((id, idx) =>
    env.DB.prepare(
      "UPDATE projects SET display_number = ? WHERE id = ?"
    ).bind(idx + 1, id)
  );
  await env.DB.batch(stmts);

  return Response.json({ ok: true });
}
