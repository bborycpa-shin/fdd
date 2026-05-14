export async function onRequestDelete({ params, env }) {
  const id = params.id;

  const file = await env.DB.prepare("SELECT r2_key FROM files WHERE id = ?")
    .bind(id)
    .first();

  if (!file) return new Response("File not found", { status: 404 });

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

  const targetFolderId = body.folder_id ? String(body.folder_id).trim() : null;

  const file = await env.DB.prepare(
    "SELECT id, project_id FROM files WHERE id = ?"
  )
    .bind(id)
    .first();
  if (!file) return new Response("File not found", { status: 404 });

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

  return new Response(null, { status: 204 });
}
