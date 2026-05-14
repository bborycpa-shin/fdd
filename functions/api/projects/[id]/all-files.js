export async function onRequestGet({ params, env }) {
  const projectId = params.id;

  const projectRow = await env.DB.prepare(
    "SELECT id, name, image_r2_key FROM projects WHERE id = ?"
  )
    .bind(projectId)
    .first();
  if (!projectRow) return new Response("Project not found", { status: 404 });

  const { results: allFolders } = await env.DB.prepare(
    "SELECT id, name, parent_folder_id FROM folders WHERE project_id = ?"
  )
    .bind(projectId)
    .all();

  const { results: files } = await env.DB.prepare(
    "SELECT id, name, size, content_type, folder_id, uploaded_at FROM files WHERE project_id = ?"
  )
    .bind(projectId)
    .all();

  const folderMap = new Map();
  (allFolders || []).forEach((f) => folderMap.set(f.id, f));

  function getFolderPath(folderId) {
    const parts = [];
    let cur = folderMap.get(folderId);
    let safety = 50;
    while (cur && safety-- > 0) {
      parts.unshift(cur.name);
      cur = cur.parent_folder_id ? folderMap.get(cur.parent_folder_id) : null;
    }
    return parts.join(" / ");
  }

  const filesWithPath = (files || []).map((f) => ({
    ...f,
    folder_path: f.folder_id ? getFolderPath(f.folder_id) : "",
  }));

  return Response.json({
    project: {
      id: projectRow.id,
      name: projectRow.name,
      has_image: !!projectRow.image_r2_key,
    },
    all_folders: allFolders || [],
    files: filesWithPath,
  });
}
