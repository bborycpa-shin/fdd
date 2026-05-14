export async function onRequestDelete({ params, env }) {
  const id = params.id;

  const { results: files } = await env.DB.prepare(
    "SELECT r2_key FROM files WHERE project_id = ?"
  )
    .bind(id)
    .all();

  if (files && files.length > 0) {
    await Promise.all(files.map((f) => env.FILES.delete(f.r2_key)));
  }

  await env.DB.batch([
    env.DB.prepare("DELETE FROM files WHERE project_id = ?").bind(id),
    env.DB.prepare("DELETE FROM folders WHERE project_id = ?").bind(id),
    env.DB.prepare("DELETE FROM projects WHERE id = ?").bind(id),
  ]);

  return new Response(null, { status: 204 });
}
