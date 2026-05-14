export async function onRequestGet({ params, env }) {
  const id = params.id;

  const project = await env.DB.prepare(
    "SELECT image_r2_key FROM projects WHERE id = ?"
  )
    .bind(id)
    .first();

  if (!project || !project.image_r2_key) {
    return new Response("Image not set", { status: 404 });
  }

  const obj = await env.FILES.get(project.image_r2_key);
  if (!obj) return new Response("Image missing in storage", { status: 404 });

  return new Response(obj.body, {
    headers: {
      "Content-Type": obj.httpMetadata?.contentType || "image/jpeg",
      "Cache-Control": "public, max-age=60",
    },
  });
}

export async function onRequestPost({ params, request, env }) {
  const id = params.id;

  const project = await env.DB.prepare(
    "SELECT id, image_r2_key FROM projects WHERE id = ?"
  )
    .bind(id)
    .first();
  if (!project) return new Response("Project not found", { status: 404 });

  const formData = await request.formData();
  const file = formData.get("file");
  if (!file || !(file instanceof File)) {
    return new Response("file required", { status: 400 });
  }
  if (!file.type.startsWith("image/")) {
    return new Response("must be image", { status: 400 });
  }
  if (file.size > 5 * 1024 * 1024) {
    return new Response("max 5MB", { status: 413 });
  }

  if (project.image_r2_key) {
    await env.FILES.delete(project.image_r2_key);
  }

  const key = `projects/${id}/logo-${Date.now()}`;
  await env.FILES.put(key, file.stream(), {
    httpMetadata: { contentType: file.type },
  });

  await env.DB.prepare("UPDATE projects SET image_r2_key = ? WHERE id = ?")
    .bind(key, id)
    .run();

  return Response.json({ ok: true });
}

export async function onRequestDelete({ params, env }) {
  const id = params.id;

  const project = await env.DB.prepare(
    "SELECT image_r2_key FROM projects WHERE id = ?"
  )
    .bind(id)
    .first();
  if (!project) return new Response("Project not found", { status: 404 });

  if (project.image_r2_key) {
    await env.FILES.delete(project.image_r2_key);
  }

  await env.DB.prepare("UPDATE projects SET image_r2_key = NULL WHERE id = ?")
    .bind(id)
    .run();

  return new Response(null, { status: 204 });
}
