export async function onRequestGet({ params, request, env, data }) {
  const projectId = params.id;
  const url = new URL(request.url);
  const folderId = url.searchParams.get("folder") || null;
  const showAll = url.searchParams.get("all") === "1";

  const projectRow = await env.DB.prepare(
    "SELECT id, name, image_r2_key, color_index, display_number FROM projects WHERE id = ?"
  )
    .bind(projectId)
    .first();
  if (!projectRow) return new Response("Project not found", { status: 404 });

  const isAdmin = data && data.isAdmin;
  if (!isAdmin) {
    const accessCode = data && data.accessCode;
    if (!accessCode) return new Response("Forbidden", { status: 403 });
    if (!accessCode.all_projects) {
      const row = await env.DB.prepare(
        "SELECT 1 FROM access_code_projects WHERE code = ? AND project_id = ?"
      )
        .bind(accessCode.code, projectId)
        .first();
      if (!row) return new Response("Forbidden", { status: 403 });
    }
  }

  const project = {
    id: projectRow.id,
    name: projectRow.name,
    has_image: !!projectRow.image_r2_key,
    color_index: projectRow.color_index,
    display_number: projectRow.display_number || 0,
  };

  const { results: allFolders } = await env.DB.prepare(
    "SELECT id, name, parent_folder_id FROM folders WHERE project_id = ?"
  )
    .bind(projectId)
    .all();

  const folderMapForPath = new Map();
  (allFolders || []).forEach((f) => folderMapForPath.set(f.id, f));
  function buildFolderPath(fid) {
    const parts = [];
    let cur = folderMapForPath.get(fid);
    let safety = 50;
    while (cur && safety-- > 0) {
      parts.unshift(cur.name);
      cur = cur.parent_folder_id
        ? folderMapForPath.get(cur.parent_folder_id)
        : null;
    }
    return parts.join(" / ");
  }

  const { results: recentRaw } = await env.DB.prepare(
    "SELECT id, name, size, content_type, folder_id, uploaded_at FROM files WHERE project_id = ? ORDER BY uploaded_at DESC LIMIT 10"
  )
    .bind(projectId)
    .all();
  const recentFiles = (recentRaw || []).map((f) => ({
    ...f,
    folder_path: f.folder_id ? buildFolderPath(f.folder_id) : "",
  }));

  if (showAll) {
    const { results: allFiles } = await env.DB.prepare(
      "SELECT id, name, size, content_type, folder_id, uploaded_at, uploader_id FROM files WHERE project_id = ?"
    )
      .bind(projectId)
      .all();
    const filesWithPath = (allFiles || []).map((f) => ({
      ...f,
      folder_path: f.folder_id ? buildFolderPath(f.folder_id) : "",
    }));

    return Response.json({
      project,
      current_folder: null,
      breadcrumb: [],
      folders: [],
      files: filesWithPath,
      all_folders: allFolders || [],
      recent_files: recentFiles,
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
          "SELECT id, name, size, content_type, uploaded_at, uploader_id FROM files WHERE project_id = ? AND folder_id = ? ORDER BY uploaded_at DESC"
        )
          .bind(projectId, folderId)
          .all()
      ).results
    : (
        await env.DB.prepare(
          "SELECT id, name, size, content_type, uploaded_at, uploader_id FROM files WHERE project_id = ? AND folder_id IS NULL ORDER BY uploaded_at DESC"
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
    recent_files: recentFiles,
  });
}
