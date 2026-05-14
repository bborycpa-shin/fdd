async function getAllowedProjectIds(env, accessCode) {
  if (!accessCode) return null;
  if (accessCode.all_projects) return null;
  const { results } = await env.DB.prepare(
    "SELECT project_id FROM access_code_projects WHERE code = ?"
  )
    .bind(accessCode.code)
    .all();
  return new Set((results || []).map((r) => r.project_id));
}

export async function onRequestGet({ env, data }) {
  const { results } = await env.DB.prepare(
    "SELECT id, name, created_at, image_r2_key, color_index, display_number FROM projects ORDER BY display_number ASC, created_at ASC"
  ).all();

  const isAdmin = data && data.isAdmin;
  let allowed = null;
  if (!isAdmin && data && data.accessCode) {
    allowed = await getAllowedProjectIds(env, data.accessCode);
  }

  const filtered = (results || []).filter((p) => {
    if (isAdmin) return true;
    if (!data || !data.accessCode) return false;
    if (data.accessCode.all_projects) return true;
    return allowed && allowed.has(p.id);
  });

  return Response.json({
    projects: filtered.map((p) => ({
      id: p.id,
      name: p.name,
      created_at: p.created_at,
      has_image: !!p.image_r2_key,
      color_index: p.color_index,
      display_number: p.display_number || 0,
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
  const maxRow = await env.DB.prepare(
    "SELECT COALESCE(MAX(display_number), 0) as mx FROM projects"
  ).first();
  const nextNumber = ((maxRow && maxRow.mx) || 0) + 1;

  await env.DB.prepare(
    "INSERT INTO projects (id, name, display_number) VALUES (?, ?, ?)"
  )
    .bind(id, name, nextNumber)
    .run();

  return Response.json({ id, name, display_number: nextNumber }, { status: 201 });
}
