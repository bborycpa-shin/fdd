export async function onRequestPost({ request, env }) {
  const formData = await request.formData();
  const projectId = String(formData.get("project_id") || "").trim();
  const folderId = formData.get("folder_id")
    ? String(formData.get("folder_id")).trim()
    : null;
  const file = formData.get("file");

  if (!projectId || !file || !(file instanceof File)) {
    return new Response("project_id and file required", { status: 400 });
  }

  if (file.size > 50 * 1024 * 1024) {
    return new Response("File too large (max 50MB)", { status: 413 });
  }

  const project = await env.DB.prepare("SELECT id FROM projects WHERE id = ?")
    .bind(projectId)
    .first();
  if (!project) return new Response("Project not found", { status: 404 });

  if (folderId) {
    const folder = await env.DB.prepare(
      "SELECT id FROM folders WHERE id = ? AND project_id = ?"
    )
      .bind(folderId, projectId)
      .first();
    if (!folder) return new Response("Folder not found", { status: 404 });
  }

  const id = crypto.randomUUID();
  const r2_key = `${projectId}/${id}`;
  const contentType = file.type || "application/octet-stream";
  const uploaderId =
    String(request.headers.get("X-Uploader-Id") || "").trim() || null;

  await env.FILES.put(r2_key, file.stream(), {
    httpMetadata: { contentType },
  });

  await env.DB.prepare(
    "INSERT INTO files (id, project_id, folder_id, name, size, content_type, r2_key, uploader_id) VALUES (?, ?, ?, ?, ?, ?, ?, ?)"
  )
    .bind(
      id,
      projectId,
      folderId,
      file.name,
      file.size,
      contentType,
      r2_key,
      uploaderId
    )
    .run();

  return Response.json(
    { id, name: file.name, size: file.size, content_type: contentType },
    { status: 201 }
  );
}
