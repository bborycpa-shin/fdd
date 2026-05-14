async function sha256Hex(text) {
  const buf = await crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(text)
  );
  return Array.from(new Uint8Array(buf))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

async function isAdminRequest(request, env) {
  const pw = request.headers.get("X-Admin-Password");
  if (!pw) return false;
  try {
    const hash = await sha256Hex(pw);
    const row = await env.DB.prepare(
      "SELECT value FROM settings WHERE key = ?"
    )
      .bind("admin_password_hash")
      .first();
    return !!row && row.value === hash;
  } catch {
    return false;
  }
}

const OWNER_DELETE_WINDOW_SEC = 5 * 60;

export async function onRequestDelete({ params, request, env }) {
  const id = params.id;

  const file = await env.DB.prepare(
    "SELECT r2_key, uploader_id, uploaded_at FROM files WHERE id = ?"
  )
    .bind(id)
    .first();

  if (!file) return new Response("File not found", { status: 404 });

  const admin = await isAdminRequest(request, env);
  if (!admin) {
    const uploaderId = String(
      request.headers.get("X-Uploader-Id") || ""
    ).trim();
    if (!uploaderId || uploaderId !== file.uploader_id) {
      return new Response("Forbidden", { status: 403 });
    }
    const nowSec = Math.floor(Date.now() / 1000);
    const ageSec = nowSec - (file.uploaded_at || 0);
    if (ageSec > OWNER_DELETE_WINDOW_SEC) {
      return new Response("Owner delete window expired", { status: 403 });
    }
  }

  await env.FILES.delete(file.r2_key);
  await env.DB.prepare("DELETE FROM files WHERE id = ?").bind(id).run();

  return new Response(null, { status: 204 });
}

export async function onRequestPatch({ params, request, env }) {
  const id = params.id;

  let body;
  try {
    body = await request.json();
  } catch {
    return new Response("Invalid JSON", { status: 400 });
  }

  const file = await env.DB.prepare(
    "SELECT id, project_id FROM files WHERE id = ?"
  )
    .bind(id)
    .first();
  if (!file) return new Response("File not found", { status: 404 });

  if (body.folder_id !== undefined) {
    const targetFolderId = body.folder_id ? String(body.folder_id).trim() : null;
    if (targetFolderId) {
      const folder = await env.DB.prepare(
        "SELECT id FROM folders WHERE id = ? AND project_id = ?"
      )
        .bind(targetFolderId, file.project_id)
        .first();
      if (!folder) return new Response("Folder not found", { status: 404 });
    }
    await env.DB.prepare("UPDATE files SET folder_id = ? WHERE id = ?")
      .bind(targetFolderId, id)
      .run();
  }

  if (body.name !== undefined) {
    const newName = String(body.name).trim();
    if (!newName) return new Response("name required", { status: 400 });
    if (newName.length > 255)
      return new Response("name too long", { status: 400 });
    await env.DB.prepare("UPDATE files SET name = ? WHERE id = ?")
      .bind(newName, id)
      .run();
  }

  return new Response(null, { status: 204 });
}
