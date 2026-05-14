export async function onRequestGet({ params, env }) {
  const id = params.id;

  const file = await env.DB.prepare(
    "SELECT name, content_type, r2_key FROM files WHERE id = ?"
  )
    .bind(id)
    .first();

  if (!file) return new Response("File not found", { status: 404 });

  const obj = await env.FILES.get(file.r2_key);
  if (!obj) return new Response("File missing in storage", { status: 404 });

  const encodedName = encodeURIComponent(file.name);

  return new Response(obj.body, {
    headers: {
      "Content-Type": file.content_type || "application/octet-stream",
      "Content-Disposition": `attachment; filename*=UTF-8''${encodedName}`,
      "Cache-Control": "private, no-cache",
    },
  });
}
