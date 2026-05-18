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

  const { results: folderSizeRows } = await env.DB.prepare(
    "SELECT folder_id, COALESCE(SUM(size), 0) AS s, MAX(uploaded_at) AS last_at FROM files WHERE project_id = ? AND folder_id IS NOT NULL GROUP BY folder_id"
  )
    .bind(projectId)
    .all();
  const directFolderSize = new Map();
  const directFolderLast = new Map();
  (folderSizeRows || []).forEach((r) => {
    directFolderSize.set(r.folder_id, Number(r.s) || 0);
    directFolderLast.set(r.folder_id, Number(r.last_at) || 0);
  });

  const childrenByParent = new Map();
  (allFolders || []).forEach((f) => {
    const pid = f.parent_folder_id || null;
    if (!childrenByParent.has(pid)) childrenByParent.set(pid, []);
    childrenByParent.get(pid).push(f.id);
  });
  const totalFolderSize = new Map();
  function computeFolderSize(fid) {
    if (totalFolderSize.has(fid)) return totalFolderSize.get(fid);
    let sum = directFolderSize.get(fid) || 0;
    const kids = childrenByParent.get(fid) || [];
    for (const k of kids) sum += computeFolderSize(k);
    totalFolderSize.set(fid, sum);
    return sum;
  }
  (allFolders || []).forEach((f) => computeFolderSize(f.id));

  const totalFolderLast = new Map();
  function computeFolderLast(fid) {
    if (totalFolderLast.has(fid)) return totalFolderLast.get(fid);
    let mx = directFolderLast.get(fid) || 0;
    const kids = childrenByParent.get(fid) || [];
    for (const k of kids) {
      const v = computeFolderLast(k);
      if (v > mx) mx = v;
    }
    totalFolderLast.set(fid, mx);
    return mx;
  }
  (allFolders || []).forEach((f) => computeFolderLast(f.id));
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
    "SELECT f.id, f.name, f.size, f.content_type, f.folder_id, f.uploaded_at, f.uploader_id, f.uploader_access_code, ac.label as uploader_label FROM files f LEFT JOIN access_codes ac ON f.uploader_access_code = ac.code WHERE f.project_id = ? ORDER BY f.uploaded_at DESC LIMIT 10"
  )
    .bind(projectId)
    .all();
  const recentFiles = (recentRaw || []).map((f) => ({
    ...f,
    folder_path: f.folder_id ? buildFolderPath(f.folder_id) : "",
  }));

  if (showAll) {
    const { results: allFiles } = await env.DB.prepare(
      "SELECT f.id, f.name, f.size, f.content_type, f.folder_id, f.uploaded_at, f.uploader_id, f.uploader_access_code, ac.label as uploader_label FROM files f LEFT JOIN access_codes ac ON f.uploader_access_code = ac.code WHERE f.project_id = ?"
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
      all_folders: (allFolders || []).map((f) => ({
        ...f,
        direct_last_upload_at: directFolderLast.get(f.id) || 0,
      })),
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

  const folderRows = folderId
    ? (
        await env.DB.prepare(
          "SELECT f.id, f.name, f.created_at, f.creator_access_code, ac.label as creator_label FROM folders f LEFT JOIN access_codes ac ON f.creator_access_code = ac.code WHERE f.project_id = ? AND f.parent_folder_id = ? ORDER BY f.name"
        )
          .bind(projectId, folderId)
          .all()
      ).results
    : (
        await env.DB.prepare(
          "SELECT f.id, f.name, f.created_at, f.creator_access_code, ac.label as creator_label FROM folders f LEFT JOIN access_codes ac ON f.creator_access_code = ac.code WHERE f.project_id = ? AND f.parent_folder_id IS NULL ORDER BY f.name"
        )
          .bind(projectId)
          .all()
      ).results;
  const folders = (folderRows || []).map((f) => ({
    ...f,
    size: totalFolderSize.get(f.id) || 0,
    last_upload_at: totalFolderLast.get(f.id) || 0,
  }));

  const files = folderId
    ? (
        await env.DB.prepare(
          "SELECT f.id, f.name, f.size, f.content_type, f.uploaded_at, f.uploader_id, f.uploader_access_code, ac.label as uploader_label FROM files f LEFT JOIN access_codes ac ON f.uploader_access_code = ac.code WHERE f.project_id = ? AND f.folder_id = ? ORDER BY f.uploaded_at DESC"
        )
          .bind(projectId, folderId)
          .all()
      ).results
    : (
        await env.DB.prepare(
          "SELECT f.id, f.name, f.size, f.content_type, f.uploaded_at, f.uploader_id, f.uploader_access_code, ac.label as uploader_label FROM files f LEFT JOIN access_codes ac ON f.uploader_access_code = ac.code WHERE f.project_id = ? AND f.folder_id IS NULL ORDER BY f.uploaded_at DESC"
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
    all_folders: (allFolders || []).map((f) => ({
      ...f,
      direct_last_upload_at: directFolderLast.get(f.id) || 0,
    })),
    recent_files: recentFiles,
  });
}
