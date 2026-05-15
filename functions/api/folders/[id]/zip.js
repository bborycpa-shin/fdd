const MAX_TOTAL_BYTES = 100 * 1024 * 1024;

const CRC32_TABLE = (() => {
  const t = new Uint32Array(256);
  for (let i = 0; i < 256; i++) {
    let c = i;
    for (let k = 0; k < 8; k++) {
      c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    }
    t[i] = c >>> 0;
  }
  return t;
})();

function crc32(buf) {
  let c = 0xffffffff;
  for (let i = 0; i < buf.length; i++) {
    c = CRC32_TABLE[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
  }
  return (c ^ 0xffffffff) >>> 0;
}

function dosTime(d) {
  return (
    ((d.getHours() & 0x1f) << 11) |
    ((d.getMinutes() & 0x3f) << 5) |
    (Math.floor(d.getSeconds() / 2) & 0x1f)
  );
}
function dosDate(d) {
  return (
    (((d.getFullYear() - 1980) & 0x7f) << 9) |
    (((d.getMonth() + 1) & 0xf) << 5) |
    (d.getDate() & 0x1f)
  );
}

function buildLFH(crc, size, nameLen, time, date) {
  const buf = new Uint8Array(30);
  const view = new DataView(buf.buffer);
  view.setUint32(0, 0x04034b50, true);
  view.setUint16(4, 20, true);
  view.setUint16(6, 0x0800, true);
  view.setUint16(8, 0, true);
  view.setUint16(10, time, true);
  view.setUint16(12, date, true);
  view.setUint32(14, crc, true);
  view.setUint32(18, size, true);
  view.setUint32(22, size, true);
  view.setUint16(26, nameLen, true);
  view.setUint16(28, 0, true);
  return buf;
}

function buildCDH(crc, size, nameLen, offset, time, date) {
  const buf = new Uint8Array(46);
  const view = new DataView(buf.buffer);
  view.setUint32(0, 0x02014b50, true);
  view.setUint16(4, 20, true);
  view.setUint16(6, 20, true);
  view.setUint16(8, 0x0800, true);
  view.setUint16(10, 0, true);
  view.setUint16(12, time, true);
  view.setUint16(14, date, true);
  view.setUint32(16, crc, true);
  view.setUint32(20, size, true);
  view.setUint32(24, size, true);
  view.setUint16(28, nameLen, true);
  view.setUint16(30, 0, true);
  view.setUint16(32, 0, true);
  view.setUint16(34, 0, true);
  view.setUint16(36, 0, true);
  view.setUint32(38, 0, true);
  view.setUint32(42, offset, true);
  return buf;
}

function buildEOCD(count, cdSize, cdOffset) {
  const buf = new Uint8Array(22);
  const view = new DataView(buf.buffer);
  view.setUint32(0, 0x06054b50, true);
  view.setUint16(4, 0, true);
  view.setUint16(6, 0, true);
  view.setUint16(8, count, true);
  view.setUint16(10, count, true);
  view.setUint32(12, cdSize, true);
  view.setUint32(16, cdOffset, true);
  view.setUint16(20, 0, true);
  return buf;
}

async function gatherTree(env, projectId, rootId, rootName) {
  const tree = new Map();
  tree.set(rootId, { path: rootName });
  let frontier = [rootId];
  let safety = 1000;
  while (frontier.length > 0 && safety-- > 0) {
    const placeholders = frontier.map(() => "?").join(",");
    const { results } = await env.DB.prepare(
      `SELECT id, name, parent_folder_id FROM folders WHERE project_id = ? AND parent_folder_id IN (${placeholders})`
    )
      .bind(projectId, ...frontier)
      .all();
    const next = [];
    for (const f of results || []) {
      const parent = tree.get(f.parent_folder_id);
      tree.set(f.id, { path: `${parent.path}/${f.name}` });
      next.push(f.id);
    }
    frontier = next;
  }
  return tree;
}

export async function onRequestGet({ params, env }) {
  const id = params.id;

  const root = await env.DB.prepare(
    "SELECT id, project_id, name FROM folders WHERE id = ?"
  )
    .bind(id)
    .first();
  if (!root) return new Response("Folder not found", { status: 404 });

  const tree = await gatherTree(env, root.project_id, root.id, root.name);
  const folderIds = [...tree.keys()];
  const placeholders = folderIds.map(() => "?").join(",");
  const { results: files } = await env.DB.prepare(
    `SELECT id, name, size, r2_key, folder_id FROM files WHERE project_id = ? AND folder_id IN (${placeholders})`
  )
    .bind(root.project_id, ...folderIds)
    .all();

  if (!files || files.length === 0) {
    return new Response("Folder is empty", { status: 404 });
  }

  const totalSize = files.reduce((s, f) => s + (f.size || 0), 0);
  if (totalSize > MAX_TOTAL_BYTES) {
    return new Response(
      `Folder too large (${(totalSize / 1024 / 1024).toFixed(1)} MB > 100 MB)`,
      { status: 413 }
    );
  }

  const now = new Date();
  const time = dosTime(now);
  const date = dosDate(now);

  const parts = [];
  const cdEntries = [];
  let offset = 0;

  for (const file of files) {
    const folder = tree.get(file.folder_id);
    const pathInZip = `${folder.path}/${file.name}`;
    const nameBytes = new TextEncoder().encode(pathInZip);

    const obj = await env.FILES.get(file.r2_key);
    if (!obj) continue;
    const data = new Uint8Array(await obj.arrayBuffer());
    const crc = crc32(data);

    const lfh = buildLFH(crc, data.length, nameBytes.length, time, date);
    parts.push(lfh, nameBytes, data);
    cdEntries.push({ crc, size: data.length, nameBytes, offset });
    offset += lfh.length + nameBytes.length + data.length;
  }

  const cdStart = offset;
  for (const e of cdEntries) {
    const cdh = buildCDH(e.crc, e.size, e.nameBytes.length, e.offset, time, date);
    parts.push(cdh, e.nameBytes);
    offset += cdh.length + e.nameBytes.length;
  }
  const cdSize = offset - cdStart;
  parts.push(buildEOCD(cdEntries.length, cdSize, cdStart));

  const total = parts.reduce((s, p) => s + p.length, 0);
  const result = new Uint8Array(total);
  let pos = 0;
  for (const p of parts) {
    result.set(p, pos);
    pos += p.length;
  }

  const zipName = `${root.name}.zip`;
  const encodedName = encodeURIComponent(zipName);

  return new Response(result, {
    headers: {
      "Content-Type": "application/zip",
      "Content-Disposition": `attachment; filename*=UTF-8''${encodedName}`,
      "Cache-Control": "no-cache",
    },
  });
}
