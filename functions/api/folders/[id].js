export async function onRequestPatch({ params, request, env }) {
  const id = params.id;

  let body;
  try {
    body = await request.json();
  } catch {
    return new Response("Invalid JSON", { status: 400 });
  }

  const newName = String(body.name || "").trim();
  if (!newName) return new Response("name required", { status: 400 });
  if (newName.length > 100)
    return new Response("name too long", { status: 400 });

  const folder = await env.DB.prepare("SELECT id FROM folders WHERE id = ?")
    .bind(id)
    .first();
  if (!folder) return new Response("Folder not found", { status: 404 });

  await env.DB.prepare("UPDATE folders SET name = ? WHERE id = ?")
    .bind(newName, id)
    .run();

  return new Response(null, { status: 204 });
}

export async function onRequestDelete({ params, env }) {
  const id = params.id;

  const folder = await env.DB.prepare(
    "SELECT id, project_id FROM folders WHERE id = ?"
  )
    .bind(id)
    .first();
  if (!folder) return new Response("Folder not found", { status: 404 });

  const allFolderIds = [id];
  const queue = [id];
  let safety = 1000;
  while (queue.length > 0 && safety-- > 0) {
    const current = queue.shift();
    const { results } = await env.DB.prepare(
      "SELECT id FROM folders WHERE parent_folder_id = ?"
    )
      .bind(current)
      .all();
    for (const child of results) {
      allFolderIds.push(child.id);
      queue.push(child.id);
    }
  }

  const placeholders = allFolderIds.map(() => "?").join(",");
  const { results: files } = await env.DB.prepare(
    `SELECT r2_key FROM files WHERE folder_id IN (${placeholders})`
  )
    .bind(...allFolderIds)
    .all();

  if (files && files.length > 0) {
    await Promise.all(files.map((f) => env.FILES.delete(f.r2_key)));
  }

  await env.DB.batch([
    env.DB.prepare(
      `DELETE FROM files WHERE folder_id IN (${placeholders})`
    ).bind(...allFolderIds),
    env.DB.prepare(
      `DELETE FROM folders WHERE id IN (${placeholders})`
    ).bind(...allFolderIds),
  ]);

  return new Response(null, { status: 204 });
}
