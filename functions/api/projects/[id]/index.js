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
