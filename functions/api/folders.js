export async function onRequestPost({ request, env }) {
  let body;
  try {
    body = await request.json();
  } catch {
    return new Response("Invalid JSON", { status: 400 });
  }

  const project_id = String(body.project_id || "").trim();
  const parent_folder_id = body.parent_folder_id
    ? String(body.parent_folder_id).trim()
    : null;
  const name = String(body.name || "").trim();

  if (!project_id || !name)
    return new Response("project_id and name required", { status: 400 });
  if (name.length > 100)
    return new Response("Name too long", { status: 400 });

  const project = await env.DB.prepare("SELECT id FROM projects WHERE id = ?")
    .bind(project_id)
    .first();
  if (!project) return new Response("Project not found", { status: 404 });

  if (parent_folder_id) {
    const parent = await env.DB.prepare(
      "SELECT id FROM folders WHERE id = ? AND project_id = ?"
    )
      .bind(parent_folder_id, project_id)
      .first();
    if (!parent) return new Response("Parent folder not found", { status: 404 });
  }

  const id = crypto.randomUUID();
  const creatorAccessCode =
    String(request.headers.get("X-Access-Code") || "").trim() || null;
  await env.DB.prepare(
    "INSERT INTO folders (id, project_id, parent_folder_id, name, creator_access_code) VALUES (?, ?, ?, ?, ?)"
  )
    .bind(id, project_id, parent_folder_id, name, creatorAccessCode)
    .run();

  return Response.json(
    { id, name, project_id, parent_folder_id },
    { status: 201 }
  );
}
