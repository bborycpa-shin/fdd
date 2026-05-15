export async function onRequestGet({ env }) {
  const row = await env.DB.prepare(
    "SELECT value FROM settings WHERE key = ?"
  )
    .bind("home_notice")
    .first();
  return Response.json({ notice: row ? row.value : "" });
}

export async function onRequestPut({ request, env }) {
  let body;
  try {
    body = await request.json();
  } catch {
    return new Response("Invalid JSON", { status: 400 });
  }
  const text = typeof body.notice === "string" ? body.notice : "";
  if (text.length > 2000) {
    return new Response("Notice too long", { status: 400 });
  }
  await env.DB.prepare(
    "INSERT INTO settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value"
  )
    .bind("home_notice", text)
    .run();
  return Response.json({ ok: true });
}
