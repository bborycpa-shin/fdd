export async function onRequestGet({ env }) {
  const { results } = await env.DB.prepare(
    "SELECT id, name, created_at, image_r2_key, color_index FROM projects ORDER BY created_at DESC"
  ).all();
  return Response.json({
    projects: results.map((p) => ({
      id: p.id,
      name: p.name,
      created_at: p.created_at,
      has_image: !!p.image_r2_key,
      color_index: p.color_index,
    })),
  });
}

export async function onRequestPost({ request, env }) {
  let body;
  try {
    body = await request.json();
  } catch {
    return new Response("Invalid JSON", { status: 400 });
  }

  const name = String(body.name || "").trim();
  if (!name) return new Response("Name required", { status: 400 });
  if (name.length > 100) return new Response("Name too long", { status: 400 });

  const id = crypto.randomUUID();
  await env.DB.prepare("INSERT INTO projects (id, name) VALUES (?, ?)")
    .bind(id, name)
    .run();

  return Response.json({ id, name }, { status: 201 });
}
