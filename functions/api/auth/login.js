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
  const code = String(body.access_code || "").trim();
  if (!pw || !code) {
    return new Response("password and access_code required", { status: 400 });
  }

  const hash = await sha256Hex(pw);
  const stored = await getSetting(env, "user_password_hash");
  if (!stored || hash !== stored) {
    return new Response("Invalid password", { status: 401 });
  }

  const codeRow = await env.DB.prepare(
    "SELECT code, label, all_projects FROM access_codes WHERE code = ?"
  )
    .bind(code)
    .first();
  if (!codeRow) {
    return new Response("Invalid access code", { status: 401 });
  }

  return Response.json({
    ok: true,
    access_code: {
      code: codeRow.code,
      label: codeRow.label || "",
      all_projects: !!codeRow.all_projects,
    },
  });
}
