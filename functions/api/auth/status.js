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

async function verifyPw(headerName, settingKey, request, env) {
  const pw = request.headers.get(headerName);
  if (!pw) return false;
  try {
    const hash = await sha256Hex(pw);
    const stored = await getSetting(env, settingKey);
    return !!stored && hash === stored;
  } catch {
    return false;
  }
}

export async function onRequestGet({ request, env }) {
  const isAdmin = await verifyPw(
    "X-Admin-Password",
    "admin_password_hash",
    request,
    env
  );
  let userAuthenticated = isAdmin;
  if (!userAuthenticated) {
    userAuthenticated = await verifyPw(
      "X-User-Password",
      "user_password_hash",
      request,
      env
    );
  }
  const userPwSet = !!(await getSetting(env, "user_password_hash"));
  const locked = (await getSetting(env, "locked")) === "1";

  return Response.json({
    is_admin: isAdmin,
    user_authenticated: userAuthenticated,
    user_password_set: userPwSet,
    locked,
  });
}
