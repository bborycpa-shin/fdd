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

function escapeLike(s) {
  return String(s).replace(/[\\%_]/g, (c) => "\\" + c);
}

export async function onRequestGet({ env, data, request }) {
  const url = new URL(request.url);
  const qRaw = String(url.searchParams.get("q") || "").trim();
  const limit = Math.max(
    1,
    Math.min(100, parseInt(url.searchParams.get("limit") || "30", 10) || 30)
  );

  const isAdmin = data && data.isAdmin;
  const accessCode = data && data.accessCode;

  if (!isAdmin && !accessCode) {
    return new Response("Forbidden", { status: 403 });
  }

  if (qRaw.length === 0) {
    return Response.json({ projects: [], files: [] });
  }

  let allowedIds = null;
  if (!isAdmin && !accessCode.all_projects) {
    allowedIds = await getAllowedProjectIds(env, accessCode);
    if (!allowedIds || allowedIds.size === 0) {
      return Response.json({ projects: [], files: [] });
    }
  }

  const pattern = "%" + escapeLike(qRaw) + "%";

  // 1) 프로젝트 이름 매칭
  let projSql =
    "SELECT id, name, display_number, color_index, image_r2_key FROM projects WHERE name LIKE ? ESCAPE '\\'";
  const projBinds = [pattern];
  if (allowedIds) {
    const ph = Array.from(allowedIds).map(() => "?").join(",");
    projSql += ` AND id IN (${ph})`;
    projBinds.push(...allowedIds);
  }
  projSql += " ORDER BY display_number ASC, name ASC LIMIT ?";
  projBinds.push(limit);

  const { results: projRows } = await env.DB.prepare(projSql)
    .bind(...projBinds)
    .all();

  // 2) 파일 이름 매칭
  let fileSql =
    "SELECT f.id, f.name, f.size, f.content_type, f.folder_id, f.project_id, f.uploaded_at, f.uploader_access_code, ac.label AS uploader_label, p.name AS project_name, p.color_index AS project_color_index, p.display_number AS project_display_number FROM files f LEFT JOIN access_codes ac ON f.uploader_access_code = ac.code LEFT JOIN projects p ON f.project_id = p.id WHERE f.name LIKE ? ESCAPE '\\'";
  const fileBinds = [pattern];
  if (allowedIds) {
    const ph = Array.from(allowedIds).map(() => "?").join(",");
    fileSql += ` AND f.project_id IN (${ph})`;
    fileBinds.push(...allowedIds);
  }
  fileSql += " ORDER BY f.uploaded_at DESC LIMIT ?";
  fileBinds.push(limit);

  const { results: rawFiles } = await env.DB.prepare(fileSql)
    .bind(...fileBinds)
    .all();

  // 폴더 경로 빌드 (recent-files.js와 동일 패턴)
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

  const projects = (projRows || []).map((p) => ({
    id: p.id,
    name: p.name,
    display_number: p.display_number || 0,
    color_index: p.color_index,
    has_image: !!p.image_r2_key,
  }));

  return Response.json({ projects, files });
}
