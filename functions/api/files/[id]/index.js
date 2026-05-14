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
