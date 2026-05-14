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

function getClientIP(request) {
  return (
    request.headers.get("CF-Connecting-IP") ||
    request.headers.get("X-Forwarded-For") ||
    "unknown"
  );
}

async function checkRateLimit(env, ip) {
  const now = Math.floor(Date.now() / 1000);
  const row = await env.DB.prepare(
    "SELECT fail_count, blocked_until FROM login_attempts WHERE ip = ?"
  )
    .bind(ip)
    .first();
  if (row && row.blocked_until && row.blocked_until > now) {
    return { blocked: true, remainingSec: row.blocked_until - now };
  }
  return { blocked: false };
}

async function recordFailure(env, ip) {
  const now = Math.floor(Date.now() / 1000);
  const row = await env.DB.prepare(
    "SELECT fail_count FROM login_attempts WHERE ip = ?"
  )
    .bind(ip)
    .first();
  const newCount = (row ? row.fail_count : 0) + 1;
  let blockedUntil = null;
  if (newCount >= 10) blockedUntil = now + 12 * 60 * 60;
  else if (newCount >= 5) blockedUntil = now + 60;

  if (row) {
    await env.DB.prepare(
      "UPDATE login_attempts SET fail_count = ?, last_fail_at = ?, blocked_until = ? WHERE ip = ?"
    )
      .bind(newCount, now, blockedUntil, ip)
      .run();
  } else {
    await env.DB.prepare(
      "INSERT INTO login_attempts (ip, fail_count, last_fail_at, blocked_until) VALUES (?, ?, ?, ?)"
    )
      .bind(ip, newCount, now, blockedUntil)
      .run();
  }
  return { newCount, blockedUntil };
}

async function clearFailures(env, ip) {
  await env.DB.prepare("DELETE FROM login_attempts WHERE ip = ?")
    .bind(ip)
    .run();
}

function rateLimitResponse(remainingSec, message) {
  return new Response(
    JSON.stringify({ blocked: true, remaining_sec: remainingSec, message }),
    {
      status: 429,
      headers: { "Content-Type": "application/json" },
    }
  );
}

export async function onRequestPost({ request, env }) {
  const ip = getClientIP(request);

  const limit = await checkRateLimit(env, ip);
  if (limit.blocked) {
    return rateLimitResponse(
      limit.remainingSec,
      "로그인 시도가 너무 많아요. 잠시 후 다시 시도하세요."
    );
  }

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
    const rec = await recordFailure(env, ip);
    if (rec.blockedUntil) {
      const remaining = rec.blockedUntil - Math.floor(Date.now() / 1000);
      const msg =
        rec.newCount >= 10
          ? "로그인 10회 실패: 12시간 차단되었습니다."
          : "로그인 5회 실패: 1분간 차단되었습니다.";
      return rateLimitResponse(remaining, msg);
    }
    return new Response("Invalid", { status: 401 });
  }

  await clearFailures(env, ip);
  return Response.json({ ok: true });
}
