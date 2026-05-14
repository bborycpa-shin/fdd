export async function onRequestPatch({ params, request, env }) {
  const id = params.id;

  let body;
  try {
    body = await request.json();
  } catch {
    return new Response("Invalid JSON", { status: 400 });
  }

  const project = await env.DB.prepare("SELECT id FROM projects WHERE id = ?")
    .bind(id)
    .first();
  if (!project) return new Response("Project not found", { status: 404 });

  let didSomething = false;

  if (body.name !== undefined) {
    const newName = String(body.name || "").trim();
    if (!newName) return new Response("name required", { status: 400 });
    if (newName.length > 100)
      return new Response("name too long", { status: 400 });
    await env.DB.prepare("UPDATE projects SET name = ? WHERE id = ?")
      .bind(newName, id)
      .run();
    didSomething = true;
  }

  if (body.color_index !== undefined) {
    let colorIdx;
    if (body.color_index === null || body.color_index === "") {
      colorIdx = null;
    } else {
      colorIdx = parseInt(body.color_index, 10);
      if (Number.isNaN(colorIdx) || colorIdx < 0 || colorIdx > 7) {
        return new Response("invalid color_index", { status: 400 });
      }
    }
    await env.DB.prepare("UPDATE projects SET color_index = ? WHERE id = ?")
      .bind(colorIdx, id)
      .run();
    didSomething = true;
  }

  if (!didSomething) return new Response("nothing to update", { status: 400 });

  return new Response(null, { status: 204 });
}

export async function onRequestDelete({ params, env }) {
  const id = params.id;

  const project = await env.DB.prepare(
    "SELECT image_r2_key FROM projects WHERE id = ?"
  )
    .bind(id)
    .first();

  const { results: files } = await env.DB.prepare(
    "SELECT r2_key FROM files WHERE project_id = ?"
  )
    .bind(id)
    .all();

  const r2Keys = (files || []).map((f) => f.r2_key);
  if (project?.image_r2_key) r2Keys.push(project.image_r2_key);
  if (r2Keys.length > 0) {
    await Promise.all(r2Keys.map((k) => env.FILES.delete(k)));
  }

  await env.DB.batch([
    env.DB.prepare("DELETE FROM files WHERE project_id = ?").bind(id),
    env.DB.prepare("DELETE FROM folders WHERE project_id = ?").bind(id),
    env.DB.prepare("DELETE FROM projects WHERE id = ?").bind(id),
  ]);

  return new Response(null, { status: 204 });
}
