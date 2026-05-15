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

export async function onRequestGet({ env, data, request }) {
  const url = new URL(request.url);
  const limit = Math.max(
    1,
    Math.min(50, parseInt(url.searchParams.get("limit") || "15", 10) || 15)
  );

  const isAdmin = data && data.isAdmin;
  const accessCode = data && data.accessCode;

  if (!isAdmin && !accessCode) {
    return new Response("Forbidden", { status: 403 });
  }

  let allowedIds = null;
  if (!isAdmin && !accessCode.all_projects) {
    allowedIds = await getAllowedProjectIds(env, accessCode);
    if (!allowedIds || allowedIds.size === 0) {
      return Response.json({ files: [] });
    }
  }

  let sql =
    "SELECT f.id, f.name, f.size, f.content_type, f.folder_id, f.project_id, f.uploaded_at, f.uploader_access_code, ac.label AS uploader_label, p.name AS project_name, p.color_index AS project_color_index, p.display_number AS project_display_number FROM files f LEFT JOIN access_codes ac ON f.uploader_access_code = ac.code LEFT JOIN projects p ON f.project_id = p.id";
  const binds = [];
  if (allowedIds) {
    const placeholders = Array.from(allowedIds).map(() => "?").join(",");
    sql += ` WHERE f.project_id IN (${placeholders})`;
    binds.push(...allowedIds);
  }
  sql += " ORDER BY f.uploaded_at DESC LIMIT ?";
  binds.push(limit);

  const { results: rawFiles } = await env.DB.prepare(sql)
    .bind(...binds)
    .all();

  const folderIds = new Set();
  (rawFiles || []).forEach((f) => {
    if (f.folder_id) folderIds.add(f.folder_id);
  });

  const folderMap = new Map();
  if (folderIds.size > 0) {
    const ph = Array.from(folderIds).map(() => "?").join(",");
    const { results: folderRows } = await env.DB.prepare(
      `SELECT id, name, parent_folder_id, project_id FROM folders WHERE id IN (${ph})`
    )
      .bind(...folderIds)
      .all();
    (folderRows || []).forEach((f) => folderMap.set(f.id, f));

    // Build parent chain
    const need = new Set();
    folderMap.forEach((f) => {
      if (f.parent_folder_id && !folderMap.has(f.parent_folder_id)) {
        need.add(f.parent_folder_id);
      }
    });
    while (need.size > 0) {
      const arr = Array.from(need);
      need.clear();
      const ph2 = arr.map(() => "?").join(",");
      const { results: more } = await env.DB.prepare(
        `SELECT id, name, parent_folder_id, project_id FROM folders WHERE id IN (${ph2})`
      )
        .bind(...arr)
        .all();
      (more || []).forEach((f) => {
        folderMap.set(f.id, f);
        if (f.parent_folder_id && !folderMap.has(f.parent_folder_id)) {
          need.add(f.parent_folder_id);
        }
      });
    }
  }

  function buildFolderPath(fid) {
    const parts = [];
    let cur = folderMap.get(fid);
    let safety = 50;
    while (cur && safety-- > 0) {
      parts.unshift(cur.name);
      cur = cur.parent_folder_id ? folderMap.get(cur.parent_folder_id) : null;
    }
    return parts.join(" / ");
  }

  const files = (rawFiles || []).map((f) => ({
    id: f.id,
    name: f.name,
    size: f.size,
    content_type: f.content_type,
    folder_id: f.folder_id,
    project_id: f.project_id,
    project_name: f.project_name,
    project_color_index: f.project_color_index,
    project_display_number: f.project_display_number || 0,
    uploaded_at: f.uploaded_at,
    uploader_access_code: f.uploader_access_code,
    uploader_label: f.uploader_label,
    folder_path: f.folder_id ? buildFolderPath(f.folder_id) : "",
  }));

  return Response.json({ files });
}
