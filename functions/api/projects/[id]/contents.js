export async function onRequestGet({ params, request, env }) {
  const projectId = params.id;
  const url = new URL(request.url);
  const folderId = url.searchParams.get("folder") || null;
  const showAll = url.searchParams.get("all") === "1";

  const projectRow = await env.DB.prepare(
    "SELECT id, name, image_r2_key FROM projects WHERE id = ?"
  )
    .bind(projectId)
    .first();
  if (!projectRow) return new Response("Project not found", { status: 404 });
  const project = {
    id: projectRow.id,
    name: projectRow.name,
    has_image: !!projectRow.image_r2_key,
  };

  const { results: allFolders } = await env.DB.prepare(
    "SELECT id, name, parent_folder_id FROM folders WHERE project_id = ?"
  )
    .bind(projectId)
    .all();

  if (showAll) {
    const { results: allFiles } = await env.DB.prepare(
      "SELECT id, name, size, content_type, folder_id, uploaded_at FROM files WHERE project_id = ?"
    )
      .bind(projectId)
      .all();

    const folderMap = new Map();
    (allFolders || []).forEach((f) => folderMap.set(f.id, f));
    function getFolderPath(fid) {
      const parts = [];
      let cur = folderMap.get(fid);
      let safety = 50;
      while (cur && safety-- > 0) {
        parts.unshift(cur.name);
        cur = cur.parent_folder_id ? folderMap.get(cur.parent_folder_id) : null;
      }
      return parts.join(" / ");
    }
    const filesWithPath = (allFiles || []).map((f) => ({
      ...f,
      folder_path: f.folder_id ? getFolderPath(f.folder_id) : "",
    }));

    return Response.json({
      project,
      current_folder: null,
      breadcrumb: [],
      folders: [],
      files: filesWithPath,
      all_folders: allFolders || [],
    });
  }

  let currentFolder = null;
  if (folderId) {
    currentFolder = await env.DB.prepare(
      "SELECT id, name, parent_folder_id FROM folders WHERE id = ? AND project_id = ?"
    )
      .bind(folderId, projectId)
      .first();
    if (!currentFolder)
      return new Response("Folder not found", { status: 404 });
  }

  const breadcrumb = [];
  if (currentFolder) {
    let f = currentFolder;
    let safety = 50;
    while (f && safety-- > 0) {
      breadcrumb.unshift({ id: f.id, name: f.name });
      if (f.parent_folder_id) {
        f = await env.DB.prepare(
          "SELECT id, name, parent_folder_id FROM folders WHERE id = ?"
        )
          .bind(f.parent_folder_id)
          .first();
      } else {
        f = null;
      }
    }
  }

  const folders = folderId
    ? (
        await env.DB.prepare(
          "SELECT id, name, created_at FROM folders WHERE project_id = ? AND parent_folder_id = ? ORDER BY name"
        )
          .bind(projectId, folderId)
          .all()
      ).results
    : (
        await env.DB.prepare(
          "SELECT id, name, created_at FROM folders WHERE project_id = ? AND parent_folder_id IS NULL ORDER BY name"
        )
          .bind(projectId)
          .all()
      ).results;

  const files = folderId
    ? (
        await env.DB.prepare(
          "SELECT id, name, size, content_type, uploaded_at FROM files WHERE project_id = ? AND folder_id = ? ORDER BY uploaded_at DESC"
        )
          .bind(projectId, folderId)
          .all()
      ).results
    : (
        await env.DB.prepare(
          "SELECT id, name, size, content_type, uploaded_at FROM files WHERE project_id = ? AND folder_id IS NULL ORDER BY uploaded_at DESC"
        )
          .bind(projectId)
          .all()
      ).results;

  return Response.json({
    project,
    current_folder: currentFolder,
    breadcrumb,
    folders,
    files,
    all_folders: allFolders || [],
  });
}
