const params = new URLSearchParams(location.search);
const projectId = params.get("id");
const folderId = params.get("folder");
const showAll = params.get("all") === "1";

const contentsEl = document.getElementById("contents");
const recentFilesList = document.getElementById("recent-files-list");
const newFolderBtn = document.getElementById("new-folder-btn");
const uploadBtn = document.getElementById("upload-btn");
const fileInput = document.getElementById("file-input");
const imageInput = document.getElementById("image-input");
const projectImageRow = document.getElementById("project-image-row");
const uploadStatus = document.getElementById("upload-status");
const sortBar = document.getElementById("sort-bar");
const selectAllBtn = document.getElementById("select-all-btn");
const treeContainer = document.getElementById("tree-container");
const folderTreeEl = document.getElementById("folder-tree");
const actionBar = document.getElementById("action-bar");
const selectedCountEl = document.getElementById("selected-count");
const cancelSelectBtn = document.getElementById("cancel-select");
const bulkDownloadBtn = document.getElementById("bulk-download");
const bulkMoveBtn = document.getElementById("bulk-move");
const bulkDeleteBtn = document.getElementById("bulk-delete");
const moveModal = document.getElementById("move-modal");
const moveCancelBtn = document.getElementById("move-cancel");
const moveFolderListEl = document.getElementById("move-folder-list");

if (!projectId) {
  location.href = "/";
}

const PROJECT_COLORS = [
  { bgFrom: "#eff6ff", bgTo: "#e0e7ff", grad: "from-blue-500 to-indigo-600" },
  { bgFrom: "#fdf2f8", bgTo: "#ffe4e6", grad: "from-pink-500 to-rose-600" },
  { bgFrom: "#f0fdf4", bgTo: "#d1fae5", grad: "from-green-500 to-emerald-600" },
  { bgFrom: "#fff7ed", bgTo: "#fee2e2", grad: "from-orange-500 to-red-500" },
  { bgFrom: "#faf5ff", bgTo: "#ede9fe", grad: "from-purple-500 to-violet-600" },
  { bgFrom: "#f0fdfa", bgTo: "#cffafe", grad: "from-teal-500 to-cyan-600" },
  { bgFrom: "#fffbeb", bgTo: "#ffedd5", grad: "from-amber-500 to-orange-600" },
  { bgFrom: "#f1f5f9", bgTo: "#e2e8f0", grad: "from-slate-600 to-slate-800" },
  { bgFrom: "#e0f2fe", bgTo: "#bae6fd", grad: "from-sky-500 to-sky-700" },
  { bgFrom: "#cffafe", bgTo: "#a5f3fc", grad: "from-cyan-500 to-cyan-700" },
  { bgFrom: "#ecfccb", bgTo: "#d9f99d", grad: "from-lime-500 to-lime-700" },
  { bgFrom: "#fef9c3", bgTo: "#fef08a", grad: "from-yellow-500 to-yellow-700" },
  { bgFrom: "#fee2e2", bgTo: "#fecaca", grad: "from-red-500 to-red-700" },
  { bgFrom: "#fae8ff", bgTo: "#f5d0fe", grad: "from-fuchsia-500 to-fuchsia-700" },
  { bgFrom: "#e0e7ff", bgTo: "#c7d2fe", grad: "from-indigo-500 to-indigo-700" },
  { bgFrom: "#ede9fe", bgTo: "#ddd6fe", grad: "from-violet-500 to-violet-700" },
  { bgFrom: "#bfdbfe", bgTo: "#93c5fd", grad: "from-blue-600 to-blue-800" },
  { bgFrom: "#a7f3d0", bgTo: "#6ee7b7", grad: "from-emerald-600 to-emerald-800" },
  { bgFrom: "#fde68a", bgTo: "#fcd34d", grad: "from-amber-600 to-orange-700" },
  { bgFrom: "#fbcfe8", bgTo: "#f9a8d4", grad: "from-pink-600 to-rose-700" },
  { bgFrom: "#d8b4fe", bgTo: "#c084fc", grad: "from-purple-600 to-purple-800" },
  { bgFrom: "#fca5a5", bgTo: "#f87171", grad: "from-red-600 to-red-800" },
  { bgFrom: "#fdba74", bgTo: "#fb923c", grad: "from-orange-600 to-red-700" },
  { bgFrom: "#cbd5e1", bgTo: "#94a3b8", grad: "from-slate-600 to-slate-900" },
];

function projectColorByHash(id) {
  const s = String(id);
  let hash = 0;
  for (let i = 0; i < s.length; i++) hash = (hash * 31 + s.charCodeAt(i)) >>> 0;
  return PROJECT_COLORS[hash % PROJECT_COLORS.length];
}

function projectColor(project) {
  if (
    project &&
    project.color_index !== null &&
    project.color_index !== undefined
  ) {
    return PROJECT_COLORS[project.color_index];
  }
  return projectColorByHash(project && project.id ? project.id : project);
}

function applyBackground(project) {
  const c = projectColor(project);
  document.body.style.background = `linear-gradient(135deg, ${c.bgFrom}, ${c.bgTo})`;
  document.body.style.backgroundAttachment = "fixed";
  document.body.style.minHeight = "100vh";
}

(function applyCachedBackground() {
  let cachedIdx = null;
  try {
    const map = JSON.parse(
      localStorage.getItem("fdd_project_colors") || "{}"
    );
    if (
      map &&
      Object.prototype.hasOwnProperty.call(map, projectId) &&
      map[projectId] !== null
    ) {
      cachedIdx = map[projectId];
    }
  } catch {}
  if (cachedIdx !== null) {
    applyBackground({ id: projectId, color_index: cachedIdx });
  } else {
    applyBackground({ id: projectId });
  }
})();

if (showAll) {
  newFolderBtn.disabled = true;
  newFolderBtn.classList.add("opacity-40", "pointer-events-none");
  newFolderBtn.title = "전체 보기에서는 비활성. 폴더로 이동 후 사용하세요";
  uploadBtn.disabled = true;
  uploadBtn.classList.add("opacity-40", "pointer-events-none");
  uploadBtn.title = "전체 보기에서는 비활성. 폴더로 이동 후 사용하세요";
}

const FILE_ICON_MAP = {
  xlsx: { color: "bg-emerald-600", label: "XLS" },
  xls: { color: "bg-emerald-600", label: "XLS" },
  csv: { color: "bg-emerald-600", label: "CSV" },
  numbers: { color: "bg-emerald-600", label: "NUM" },
  doc: { color: "bg-blue-600", label: "DOC" },
  docx: { color: "bg-blue-600", label: "DOC" },
  rtf: { color: "bg-blue-600", label: "RTF" },
  odt: { color: "bg-blue-600", label: "ODT" },
  pages: { color: "bg-blue-600", label: "PGS" },
  ppt: { color: "bg-orange-500", label: "PPT" },
  pptx: { color: "bg-orange-500", label: "PPT" },
  key: { color: "bg-orange-500", label: "KEY" },
  pdf: { color: "bg-red-600", label: "PDF" },
  hwp: { color: "bg-sky-700", label: "HWP" },
  hwpx: { color: "bg-sky-700", label: "HWP" },
  jpg: { color: "bg-purple-500", label: "JPG" },
  jpeg: { color: "bg-purple-500", label: "JPG" },
  png: { color: "bg-purple-500", label: "PNG" },
  gif: { color: "bg-purple-500", label: "GIF" },
  webp: { color: "bg-purple-500", label: "WEBP" },
  svg: { color: "bg-purple-500", label: "SVG" },
  heic: { color: "bg-purple-500", label: "HEIC" },
  heif: { color: "bg-purple-500", label: "HEIF" },
  bmp: { color: "bg-purple-500", label: "BMP" },
  ico: { color: "bg-purple-500", label: "ICO" },
  mp4: { color: "bg-pink-500", label: "MP4" },
  mov: { color: "bg-pink-500", label: "MOV" },
  avi: { color: "bg-pink-500", label: "AVI" },
  webm: { color: "bg-pink-500", label: "WEBM" },
  mkv: { color: "bg-pink-500", label: "MKV" },
  mp3: { color: "bg-yellow-500", label: "MP3" },
  wav: { color: "bg-yellow-500", label: "WAV" },
  ogg: { color: "bg-yellow-500", label: "OGG" },
  flac: { color: "bg-yellow-500", label: "FLAC" },
  m4a: { color: "bg-yellow-500", label: "M4A" },
  aac: { color: "bg-yellow-500", label: "AAC" },
  zip: { color: "bg-amber-600", label: "ZIP" },
  rar: { color: "bg-amber-600", label: "RAR" },
  "7z": { color: "bg-amber-600", label: "7Z" },
  tar: { color: "bg-amber-600", label: "TAR" },
  gz: { color: "bg-amber-600", label: "GZ" },
  txt: { color: "bg-slate-500", label: "TXT" },
  md: { color: "bg-slate-500", label: "MD" },
};

function getExt(filename) {
  const parts = String(filename).split(".");
  return parts.length > 1 ? parts.pop().toLowerCase() : "";
}

function getFileIcon(filename) {
  const ext = getExt(filename);
  if (FILE_ICON_MAP[ext]) return FILE_ICON_MAP[ext];
  return {
    color: "bg-slate-400",
    label: (ext || "FILE").toUpperCase().slice(0, 4),
  };
}

function escapeHtml(str) {
  return String(str).replace(
    /[&<>"']/g,
    (c) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c])
  );
}

function formatSize(bytes) {
  if (!bytes || bytes <= 0) return "0 B";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  if (bytes < 1024 * 1024 * 1024)
    return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
  return `${(bytes / 1024 / 1024 / 1024).toFixed(2)} GB`;
}

function formatDate(unixSec) {
  if (!unixSec) return "";
  const d = new Date(unixSec * 1000);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  const hh = String(d.getHours()).padStart(2, "0");
  const mm = String(d.getMinutes()).padStart(2, "0");
  return `${y}.${m}.${day} ${hh}:${mm}`;
}

function isToday(unixSec) {
  if (!unixSec) return false;
  const d = new Date(unixSec * 1000);
  const n = new Date();
  return (
    d.getFullYear() === n.getFullYear() &&
    d.getMonth() === n.getMonth() &&
    d.getDate() === n.getDate()
  );
}

function formatDateHtml(unixSec) {
  if (!unixSec) return "";
  const txt = formatDate(unixSec);
  if (isToday(unixSec)) {
    return `<span class="text-red-600 font-bold">${txt} (오늘)</span>`;
  }
  return txt;
}

let currentSort = "created_desc";
const selectedFileIds = new Set();
let cachedData = null;

function applySortChipStyles() {
  sortBar.querySelectorAll(".sort-chip").forEach((chip) => {
    const isCurrent = chip.dataset.sort === currentSort;
    chip.className =
      "sort-chip shrink-0 px-1.5 py-px rounded-full border text-[10px] " +
      (isCurrent
        ? "bg-slate-700 text-white border-slate-700 font-semibold"
        : "bg-slate-100 text-slate-600 border-slate-200 active:bg-slate-200");
  });
}

sortBar.querySelectorAll(".sort-chip").forEach((chip) => {
  chip.addEventListener("click", () => {
    currentSort = chip.dataset.sort;
    applySortChipStyles();
    if (cachedData) render(cachedData);
  });
});
applySortChipStyles();

function sortItems(items, kind, key) {
  const arr = [...items];
  const ts = (it) => (kind === "folder" ? it.created_at : it.uploaded_at) || 0;
  switch (key) {
    case "created_desc":
      arr.sort((a, b) => ts(b) - ts(a));
      break;
    case "created_asc":
      arr.sort((a, b) => ts(a) - ts(b));
      break;
    case "name_asc":
      arr.sort((a, b) => a.name.localeCompare(b.name, "ko"));
      break;
    case "name_desc":
      arr.sort((a, b) => b.name.localeCompare(a.name, "ko"));
      break;
    case "type":
      if (kind === "file") {
        arr.sort((a, b) => {
          const eA = getExt(a.name);
          const eB = getExt(b.name);
          if (eA === eB) return a.name.localeCompare(b.name, "ko");
          return eA.localeCompare(eB);
        });
      } else {
        arr.sort((a, b) => a.name.localeCompare(b.name, "ko"));
      }
      break;
  }
  return arr;
}

function renderTree(data) {
  const all = data.all_folders || [];
  const pid = encodeURIComponent(data.project.id);
  const currentId = folderId || null;
  const isRoot = !currentId && !showAll;

  const projectChip = `
    <a href="/project.html?id=${pid}" class="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full border transition ${isRoot ? "bg-blue-600 text-white border-blue-600 font-semibold" : "bg-white text-slate-700 border-slate-300 active:bg-slate-100"}">
      <span aria-hidden="true">🏠</span>
      <span class="text-[10px] ${isRoot ? "text-white/80" : "text-slate-400"}">최상위</span>
      <span>${escapeHtml(data.project.name)}</span>
    </a>
  `;
  const allFilesChip = `
    <a href="/project.html?id=${pid}&all=1" class="inline-flex items-center px-2.5 py-0.5 rounded-full border transition ${showAll ? "bg-blue-600 text-white border-blue-600 font-semibold" : "bg-white text-slate-700 border-slate-300 active:bg-slate-100"}">
      📋 모든 파일 보기
    </a>
  `;
  const refreshBtn = `
    <button id="refresh-btn" class="shrink-0 inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-rose-50 border border-rose-300 text-rose-700 active:bg-rose-100 shadow-sm text-[11px] font-medium" aria-label="새로고침">
      <span class="refresh-icon leading-none inline-block">↻</span>
      <span>새로고침</span>
    </button>
  `;
  const headerRow = `
    <div class="flex items-start justify-between gap-2">
      <div class="flex flex-wrap gap-1 items-center flex-1 min-w-0">${projectChip}${allFilesChip}</div>
      ${refreshBtn}
    </div>
  `;

  if (all.length === 0) {
    folderTreeEl.innerHTML = headerRow;
    attachRefreshHandler();
    return;
  }

  const map = new Map();
  all.forEach((f) => map.set(f.id, { ...f, children: [] }));
  const roots = [];
  all.forEach((f) => {
    const node = map.get(f.id);
    if (f.parent_folder_id && map.has(f.parent_folder_id)) {
      map.get(f.parent_folder_id).children.push(node);
    } else {
      roots.push(node);
    }
  });
  const sortByName = (a, b) => a.name.localeCompare(b.name, "ko");
  function sortRec(nodes) {
    nodes.sort(sortByName);
    nodes.forEach((n) => sortRec(n.children));
  }
  sortRec(roots);

  const DEPTH_BG = [
    "bg-amber-100 text-amber-900 border-amber-300",
    "bg-amber-50 text-amber-900 border-amber-200",
    "bg-yellow-50 text-yellow-900 border-yellow-200",
    "bg-orange-50 text-orange-900 border-orange-200",
  ];

  function renderNode(node, depth) {
    const isCurrent = node.id === currentId;
    const idx = Math.min(depth - 1, DEPTH_BG.length - 1);
    const normalBg = DEPTH_BG[idx];
    const cls = isCurrent
      ? "bg-blue-600 text-white border-blue-600 font-semibold"
      : normalBg + " active:opacity-70";
    const chip = `
      <a href="/project.html?id=${pid}&folder=${encodeURIComponent(node.id)}" class="inline-flex items-center px-2 py-0.5 rounded-full border transition ${cls}">
        📁 ${escapeHtml(node.name)}
      </a>
    `;
    const childrenHtml =
      node.children.length > 0
        ? `<div class="ml-3 mt-1 flex flex-wrap gap-1 items-start border-l border-amber-200 pl-2">
             ${node.children.map((c) => renderNode(c, depth + 1)).join("")}
           </div>`
        : "";
    return `<div class="inline-block align-top">${chip}${childrenHtml}</div>`;
  }

  folderTreeEl.innerHTML = `
    ${headerRow}
    <div class="mt-1.5 flex flex-wrap gap-1 items-start">
      ${roots.map((r) => renderNode(r, 1)).join("")}
    </div>
  `;
  attachRefreshHandler();
}

function attachRefreshHandler() {
  const btn = document.getElementById("refresh-btn");
  if (!btn) return;
  btn.addEventListener("click", async () => {
    btn.disabled = true;
    const icon = btn.querySelector(".refresh-icon");
    if (icon) {
      icon.style.transform = "rotate(360deg)";
      icon.style.transition = "transform 0.6s";
    }
    try {
      await load();
    } finally {
      btn.disabled = false;
      setTimeout(() => {
        if (icon) {
          icon.style.transition = "";
          icon.style.transform = "";
        }
      }, 600);
    }
  });
}

async function load() {
  try {
    const qs = showAll
      ? "?all=1"
      : folderId
      ? `?folder=${encodeURIComponent(folderId)}`
      : "";
    const url = `/api/projects/${encodeURIComponent(projectId)}/contents${qs}`;
    const res = await fetch(url);
    if (!res.ok) throw new Error();
    const data = await res.json();
    cachedData = data;

    const visibleIds = new Set(data.files.map((f) => f.id));
    for (const id of [...selectedFileIds]) {
      if (!visibleIds.has(id)) selectedFileIds.delete(id);
    }
    render(data);
  } catch (e) {
    contentsEl.innerHTML =
      '<p class="text-red-500 text-center text-sm py-6">불러오기 실패</p>';
  }
}

function renderProjectImage(data) {
  const isAdmin =
    window.fddAdmin && typeof window.fddAdmin.isAdmin === "function"
      ? window.fddAdmin.isAdmin()
      : false;
  if (data.project.has_image) {
    const url = `/api/projects/${encodeURIComponent(projectId)}/image?t=${Date.now()}`;
    projectImageRow.innerHTML = `
      <div class="relative inline-flex items-center">
        <div id="project-image-btn" class="block bg-white rounded-md shadow-sm border border-white p-0.5 ${isAdmin ? "cursor-pointer active:opacity-80" : ""}" title="${isAdmin ? "클릭/끌기/Ctrl+V로 변경" : ""}">
          <img src="${url}" alt="프로젝트 로고" class="block object-contain" style="max-height: 32px; max-width: 80px; height: auto; width: auto;" />
        </div>
        <button id="project-image-remove" class="admin-only absolute -top-1.5 -right-1.5 w-4 h-4 rounded-full bg-white border border-slate-300 text-[8px] text-slate-500 active:text-red-500 shadow leading-none flex items-center justify-center" aria-label="로고 삭제">✕</button>
      </div>
    `;
    const btn = document.getElementById("project-image-btn");
    if (isAdmin) btn.addEventListener("click", () => imageInput.click());
    const removeBtn = document.getElementById("project-image-remove");
    if (removeBtn) {
      removeBtn.addEventListener("click", async () => {
        if (!confirm("프로젝트 로고를 삭제할까요?")) return;
        try {
          const res = await fetch(
            `/api/projects/${encodeURIComponent(projectId)}/image`,
            { method: "DELETE" }
          );
          if (!res.ok) throw new Error();
          await load();
        } catch (e) {
          alert("삭제 실패");
        }
      });
    }
  } else if (isAdmin) {
    projectImageRow.innerHTML = `
      <button id="project-image-btn" class="admin-only text-[10px] px-2 h-7 rounded-lg border border-dashed border-slate-300 bg-white/70 text-slate-400 font-medium active:bg-white" title="클릭, 끌어놓기, 또는 Ctrl+V로 로고 추가">
        + 로고
      </button>
    `;
    document
      .getElementById("project-image-btn")
      .addEventListener("click", () => imageInput.click());
  } else {
    projectImageRow.innerHTML = "";
  }
}

function renderRecentFiles(files) {
  if (!recentFilesList) return;
  if (!files || files.length === 0) {
    recentFilesList.innerHTML =
      '<p class="text-[10px] text-slate-400 text-center py-3">아직 파일이 없어요</p>';
    return;
  }
  recentFilesList.innerHTML = files
    .map((f) => {
      const icon = getFileIcon(f.name);
      const path = f.folder_path || "(루트)";
      const uploader = f.uploader_label || f.uploader_access_code || "관리자";
      const uploaderLine = ` · 👤 ${escapeHtml(uploader)}`;
      return `
        <a href="/api/files/${encodeURIComponent(f.id)}/download" target="_blank" rel="noopener" class="recent-download flex items-center gap-1.5 px-1.5 py-1 bg-slate-50 active:bg-slate-200 rounded-md transition">
          <span class="w-5 h-5 rounded ${icon.color} text-white text-[6px] font-bold flex items-center justify-center shrink-0">${icon.label}</span>
          <div class="flex-1 min-w-0 leading-tight">
            <p class="text-[10px] font-medium truncate text-slate-800">${escapeHtml(f.name)}</p>
            <p class="text-[8px] text-slate-400 truncate">📁 ${escapeHtml(path)} · ${formatDateHtml(f.uploaded_at)}${uploaderLine}</p>
          </div>
        </a>
      `;
    })
    .join("");

  if (isKakaoInApp()) {
    recentFilesList.querySelectorAll(".recent-download").forEach((a) => {
      a.addEventListener("click", (e) => {
        e.preventDefault();
        openInExternalBrowser(a.getAttribute("href"));
      });
    });
  }
}

function render(data) {
  document.title = `${data.project.name} · 파일공유(by신)`;

  try {
    const map = JSON.parse(localStorage.getItem("fdd_project_colors") || "{}");
    map[data.project.id] =
      data.project.color_index === undefined ? null : data.project.color_index;
    localStorage.setItem("fdd_project_colors", JSON.stringify(map));
  } catch {}

  applyBackground(data.project);
  renderProjectImage(data);
  renderTree(data);
  renderRecentFiles(data.recent_files || []);

  const folders = sortItems(data.folders, "folder", "name_asc");
  const files = sortItems(data.files, "file", currentSort);

  updateSelectAllChip(files);

  if (folders.length === 0 && files.length === 0) {
    contentsEl.innerHTML =
      '<p class="text-slate-400 text-center text-xs py-6">아직 비어있어요.<br>위 버튼으로 폴더를 만들거나 파일을 올려보세요!<br><span class="text-[10px]">PC에서는 화면에 파일을 끌어다 놓아도 돼요</span></p>';
    updateActionBar();
    return;
  }

  const items = [];

  for (const f of folders) {
    const creator = f.creator_label || f.creator_access_code || "관리자";
    const creatorLine = ` · 👤 ${escapeHtml(creator)}`;
    const sizeLine = f.size > 0
      ? ` · 💾 ${formatSize(f.size)}`
      : ` · 💾 비어있음`;
    items.push(`
      <div class="flex items-center gap-1.5 px-2 py-1 bg-amber-50 rounded-lg border border-amber-200">
        <a href="/project.html?id=${encodeURIComponent(data.project.id)}&folder=${encodeURIComponent(f.id)}" class="flex-1 flex items-center gap-1.5 min-w-0 active:opacity-60 transition">
          <span class="w-6 h-6 rounded bg-amber-200 text-amber-800 flex items-center justify-center text-xs shrink-0">📁</span>
          <div class="flex-1 min-w-0 leading-tight">
            <p class="text-[11px] font-medium break-all text-amber-950">${escapeHtml(f.name)}</p>
            <p class="text-[9px] text-amber-700/70 mt-0.5">${formatDateHtml(f.created_at)}${creatorLine}${sizeLine}</p>
          </div>
        </a>
        <button class="folder-zip text-amber-600/70 active:text-blue-600 px-1 py-0.5 text-sm shrink-0 self-center" data-id="${f.id}" data-name="${escapeHtml(f.name)}" aria-label="폴더 ZIP 다운로드" title="ZIP으로 받기">📦</button>
        <button class="folder-rename admin-only text-amber-600/70 active:text-blue-600 px-1 py-0.5 text-sm shrink-0 self-center" data-id="${f.id}" data-name="${escapeHtml(f.name)}" aria-label="폴더 이름 바꾸기">✏</button>
        <button class="folder-delete admin-only text-amber-600/70 active:text-red-500 px-1 py-0.5 text-sm shrink-0 self-center" data-id="${f.id}" data-name="${escapeHtml(f.name)}" aria-label="폴더 삭제">🗑</button>
      </div>
    `);
  }

  const myAccessCode = window.fddAccessCode || null;

  for (const file of files) {
    const icon = getFileIcon(file.name);
    const isChecked = selectedFileIds.has(file.id);
    const pathLine = showAll && file.folder_path
      ? `<p class="text-[9px] text-blue-600/80 mt-0.5">📁 ${escapeHtml(file.folder_path)}</p>`
      : (showAll ? `<p class="text-[9px] text-slate-400 mt-0.5">📁 (루트)</p>` : "");
    const uploader = file.uploader_label || file.uploader_access_code || "관리자";
    const uploaderLine = ` · 👤 ${escapeHtml(uploader)}`;
    const isSameCode =
      myAccessCode &&
      file.uploader_access_code &&
      file.uploader_access_code === myAccessCode;
    const deleteClass = isSameCode ? "" : "admin-only";
    items.push(`
      <div class="file-row flex items-center gap-1.5 px-2 py-1 rounded-lg border cursor-pointer ${isChecked ? "border-blue-400 bg-blue-50" : "border-slate-200 bg-white"}" data-id="${file.id}">
        <label class="shrink-0 self-center p-0.5 -ml-0.5" onclick="event.stopPropagation()">
          <input type="checkbox" class="file-check w-3.5 h-3.5 align-middle accent-blue-600" data-id="${file.id}" ${isChecked ? "checked" : ""} />
        </label>
        <div class="flex-1 flex items-start gap-1.5 min-w-0">
          <span class="w-6 h-6 rounded ${icon.color} text-white flex items-center justify-center text-[7px] font-bold shrink-0 mt-0.5">${icon.label}</span>
          <div class="flex-1 min-w-0 leading-tight">
            <p class="text-[11px] font-medium break-all">${escapeHtml(file.name)}</p>
            <p class="text-[9px] text-slate-400 mt-0.5">${formatSize(file.size)} · ${formatDateHtml(file.uploaded_at)}${uploaderLine}</p>
            ${pathLine}
          </div>
        </div>
        ${isViewable(file.name, file.content_type)
          ? `<button class="file-view text-slate-400 active:text-blue-600 px-1 py-0.5 text-sm shrink-0 self-center" data-id="${file.id}" aria-label="보기">👁</button>`
          : ""}
        <button class="file-download text-slate-400 active:text-blue-600 px-1 py-0.5 text-sm shrink-0 self-center" data-id="${file.id}" data-name="${escapeHtml(file.name)}" aria-label="다운로드">⬇</button>
        <button class="file-rename admin-only text-slate-400 active:text-blue-600 px-1 py-0.5 text-sm shrink-0 self-center" data-id="${file.id}" data-name="${escapeHtml(file.name)}" aria-label="이름 바꾸기">✏</button>
        <button class="file-delete ${deleteClass} text-slate-400 active:text-red-500 px-1 py-0.5 text-sm shrink-0 self-center" data-id="${file.id}" data-name="${escapeHtml(file.name)}" aria-label="파일 삭제">🗑</button>
      </div>
    `);
  }

  contentsEl.innerHTML = items.join("");

  contentsEl.querySelectorAll(".folder-delete").forEach((btn) => {
    btn.addEventListener("click", async (e) => {
      e.stopPropagation();
      const id = btn.dataset.id;
      const name = btn.dataset.name;
      if (
        !confirm(
          `"${name}" 폴더를 삭제할까요?\n(안에 있는 모든 폴더와 파일도 함께 삭제됩니다)`
        )
      )
        return;
      try {
        const res = await fetch(`/api/folders/${id}`, { method: "DELETE" });
        if (!res.ok) throw new Error();
        await load();
      } catch (e) {
        alert("삭제 실패");
      }
    });
  });

  contentsEl.querySelectorAll(".file-delete").forEach((btn) => {
    btn.addEventListener("click", async (e) => {
      e.stopPropagation();
      const id = btn.dataset.id;
      const name = btn.dataset.name;
      if (!confirm(`"${name}" 파일을 삭제할까요?`)) return;
      try {
        const res = await fetch(`/api/files/${id}`, { method: "DELETE" });
        if (!res.ok) throw new Error();
        selectedFileIds.delete(id);
        await load();
      } catch (e) {
        alert("삭제 실패");
      }
    });
  });

  contentsEl.querySelectorAll(".file-download").forEach((btn) => {
    btn.addEventListener("click", async (e) => {
      e.stopPropagation();
      const id = btn.dataset.id;
      const name = btn.dataset.name || "";
      await downloadFile(id, name);
    });
  });

  contentsEl.querySelectorAll(".file-view").forEach((btn) => {
    btn.addEventListener("click", (e) => {
      e.stopPropagation();
      viewFile(btn.dataset.id);
    });
  });

  contentsEl.querySelectorAll(".folder-zip").forEach((btn) => {
    btn.addEventListener("click", (e) => {
      e.stopPropagation();
      e.preventDefault();
      downloadFolderZip(btn.dataset.id, btn.dataset.name);
    });
  });

  contentsEl.querySelectorAll(".file-rename").forEach((btn) => {
    btn.addEventListener("click", async (e) => {
      e.stopPropagation();
      const id = btn.dataset.id;
      const current = btn.dataset.name;
      const newName = prompt("새 파일 이름을 입력해주세요", current);
      if (!newName || !newName.trim() || newName.trim() === current) return;
      try {
        const res = await fetch(`/api/files/${id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ name: newName.trim() }),
        });
        if (!res.ok) throw new Error();
        await load();
      } catch (e) {
        alert("이름 변경 실패");
      }
    });
  });

  contentsEl.querySelectorAll(".folder-rename").forEach((btn) => {
    btn.addEventListener("click", async (e) => {
      e.stopPropagation();
      const id = btn.dataset.id;
      const current = btn.dataset.name;
      const newName = prompt("새 폴더 이름을 입력해주세요", current);
      if (!newName || !newName.trim() || newName.trim() === current) return;
      try {
        const res = await fetch(`/api/folders/${id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ name: newName.trim() }),
        });
        if (!res.ok) throw new Error();
        await load();
      } catch (e) {
        alert("이름 변경 실패");
      }
    });
  });

  contentsEl.querySelectorAll(".file-check").forEach((cb) => {
    cb.addEventListener("change", () => {
      const id = cb.dataset.id;
      toggleFileSelected(id, cb.checked);
      const row = cb.closest(".file-row");
      if (row) {
        if (cb.checked) {
          row.classList.add("border-blue-400", "bg-blue-50");
          row.classList.remove("border-slate-200", "bg-white");
        } else {
          row.classList.remove("border-blue-400", "bg-blue-50");
          row.classList.add("border-slate-200", "bg-white");
        }
      }
    });
    cb.addEventListener("click", (e) => e.stopPropagation());
  });

  contentsEl.querySelectorAll(".file-row").forEach((row) => {
    row.addEventListener("click", (e) => {
      if (e.target.closest("button")) return;
      if (e.target.closest("input")) return;
      const id = row.dataset.id;
      const nowSelected = !selectedFileIds.has(id);
      toggleFileSelected(id, nowSelected);
      const cb = row.querySelector(".file-check");
      if (cb) cb.checked = nowSelected;
      if (nowSelected) {
        row.classList.add("border-blue-400", "bg-blue-50");
        row.classList.remove("border-slate-200", "bg-white");
      } else {
        row.classList.remove("border-blue-400", "bg-blue-50");
        row.classList.add("border-slate-200", "bg-white");
      }
    });
  });

  updateActionBar();
}

function toggleFileSelected(id, selected) {
  if (selected) selectedFileIds.add(id);
  else selectedFileIds.delete(id);
  if (cachedData) updateSelectAllChip(sortItems(cachedData.files, "file", currentSort));
  updateActionBar();
}

function updateSelectAllChip(currentFiles) {
  const files = currentFiles || (cachedData ? cachedData.files : []);
  const fileIds = files.map((f) => f.id);
  const allSelected =
    fileIds.length > 0 && fileIds.every((id) => selectedFileIds.has(id));
  selectAllBtn.innerHTML = allSelected ? "☑ 전체" : "☐ 전체";
  selectAllBtn.className =
    "shrink-0 px-1.5 py-0.5 rounded-full border font-semibold inline-flex items-center justify-center " +
    (allSelected
      ? "bg-blue-600 text-white border-blue-600"
      : "bg-white text-slate-700 border-slate-300 active:bg-slate-100");
  selectAllBtn.style.minWidth = "52px";
}

selectAllBtn.addEventListener("click", () => {
  if (!cachedData) return;
  const fileIds = cachedData.files.map((f) => f.id);
  if (fileIds.length === 0) return;
  const allSelected = fileIds.every((id) => selectedFileIds.has(id));
  if (allSelected) {
    fileIds.forEach((id) => selectedFileIds.delete(id));
  } else {
    fileIds.forEach((id) => selectedFileIds.add(id));
  }
  render(cachedData);
});

function updateActionBar() {
  const count = selectedFileIds.size;
  if (count === 0) {
    actionBar.classList.add("hidden");
  } else {
    actionBar.classList.remove("hidden");
    selectedCountEl.textContent = count;
  }
}

cancelSelectBtn.addEventListener("click", () => {
  selectedFileIds.clear();
  if (cachedData) render(cachedData);
});

bulkDeleteBtn.addEventListener("click", async () => {
  const ids = [...selectedFileIds];
  if (ids.length === 0) return;
  if (!confirm(`선택한 ${ids.length}개 파일을 삭제할까요?`)) return;

  bulkDeleteBtn.disabled = true;
  bulkDeleteBtn.textContent = "삭제 중...";

  const results = await Promise.allSettled(
    ids.map((id) =>
      fetch(`/api/files/${encodeURIComponent(id)}`, { method: "DELETE" })
    )
  );
  const failed = results.filter(
    (r) => r.status === "rejected" || !r.value.ok
  ).length;

  bulkDeleteBtn.disabled = false;
  bulkDeleteBtn.textContent = "🗑 삭제";

  if (failed > 0) {
    alert(`${ids.length - failed}개 삭제, ${failed}개 실패`);
  }
  selectedFileIds.clear();
  await load();
});

bulkDownloadBtn.addEventListener("click", async () => {
  const ids = [...selectedFileIds];
  if (ids.length === 0) return;
  if (ids.length > 5) {
    if (!confirm(`${ids.length}개를 한 번에 받으면 브라우저가 일부를 막을 수 있어요. 계속할까요?`))
      return;
  }
  if (isKakaoInApp()) {
    openInExternalBrowser(window.location.href);
    return;
  }
  if (window.showSaveFilePicker) {
    // 지원 브라우저: 파일마다 저장 위치 선택. 취소하면 중단
    const nameById = new Map();
    if (cachedData && cachedData.files) {
      cachedData.files.forEach((f) => nameById.set(f.id, f.name));
    }
    for (const id of ids) {
      const name = nameById.get(id) || "download";
      await downloadFile(id, name);
    }
  } else {
    // 폴백: 새 탭 stagger
    ids.forEach((id, i) => {
      setTimeout(() => {
        window.open(`/api/files/${encodeURIComponent(id)}/download`, "_blank");
      }, i * 200);
    });
  }
});

bulkMoveBtn.addEventListener("click", () => {
  if (selectedFileIds.size === 0) return;
  openMoveModal();
});

function openMoveModal() {
  if (!cachedData) return;
  const all = cachedData.all_folders || [];
  const pid = cachedData.project.id;

  const map = new Map();
  all.forEach((f) => map.set(f.id, { ...f, children: [] }));
  const roots = [];
  all.forEach((f) => {
    const node = map.get(f.id);
    if (f.parent_folder_id && map.has(f.parent_folder_id)) {
      map.get(f.parent_folder_id).children.push(node);
    } else {
      roots.push(node);
    }
  });
  const sortByName = (a, b) => a.name.localeCompare(b.name, "ko");
  function sortRec(nodes) {
    nodes.sort(sortByName);
    nodes.forEach((n) => sortRec(n.children));
  }
  sortRec(roots);

  const rows = [];
  const currentLoc = folderId || null;

  rows.push(`
    <button class="move-target w-full text-left px-2 py-2 rounded hover:bg-slate-100 active:bg-slate-200 ${currentLoc === null ? "opacity-50" : ""}" data-target="" ${currentLoc === null ? "disabled" : ""}>
      🏠 ${escapeHtml(cachedData.project.name)}${currentLoc === null ? " (현재 위치)" : ""}
    </button>
  `);

  function walk(nodes, depth) {
    for (const n of nodes) {
      const isCurrent = n.id === currentLoc;
      const pad = depth * 14 + 8;
      rows.push(`
        <button class="move-target w-full text-left py-2 rounded hover:bg-slate-100 active:bg-slate-200 ${isCurrent ? "opacity-50" : ""}" data-target="${n.id}" ${isCurrent ? "disabled" : ""} style="padding-left:${pad}px; padding-right:8px;">
          📁 ${escapeHtml(n.name)}${isCurrent ? " (현재 위치)" : ""}
        </button>
      `);
      if (n.children.length > 0) walk(n.children, depth + 1);
    }
  }
  walk(roots, 1);

  moveFolderListEl.innerHTML = rows.join("");

  moveFolderListEl.querySelectorAll(".move-target").forEach((btn) => {
    if (btn.disabled) return;
    btn.addEventListener("click", async () => {
      const target = btn.dataset.target || null;
      await moveSelectedFiles(target);
    });
  });

  moveModal.style.display = "flex";
}

function closeMoveModal() {
  moveModal.style.display = "none";
  moveFolderListEl.innerHTML = "";
}

moveCancelBtn.addEventListener("click", closeMoveModal);
moveModal.addEventListener("click", (e) => {
  if (e.target === moveModal) closeMoveModal();
});

async function moveSelectedFiles(targetFolderId) {
  const ids = [...selectedFileIds];
  if (ids.length === 0) return;

  const buttons = moveFolderListEl.querySelectorAll(".move-target");
  buttons.forEach((b) => (b.disabled = true));

  const results = await Promise.allSettled(
    ids.map((id) =>
      fetch(`/api/files/${encodeURIComponent(id)}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ folder_id: targetFolderId }),
      })
    )
  );
  const failed = results.filter(
    (r) => r.status === "rejected" || !r.value.ok
  ).length;

  if (failed > 0) {
    alert(`${ids.length - failed}개 이동, ${failed}개 실패`);
  }
  selectedFileIds.clear();
  closeMoveModal();
  await load();
}

const uploadOverlay = document.getElementById("upload-progress-overlay");
const uploadProgressBar = document.getElementById("upload-progress-bar");
const uploadProgressName = document.getElementById("upload-progress-name");
const uploadProgressCount = document.getElementById("upload-progress-count");

function showUploadOverlay(total) {
  if (!uploadOverlay) return;
  uploadOverlay.style.display = "flex";
  uploadProgressName.textContent = "준비 중...";
  uploadProgressCount.textContent = `0/${total}`;
  uploadProgressBar.style.width = "0%";
}
function updateUploadOverlay(name, currentIndex, total, fileProgress) {
  if (!uploadOverlay) return;
  uploadProgressName.textContent = name;
  uploadProgressCount.textContent = `${Math.min(currentIndex + 1, total)}/${total}`;
  const overall = (currentIndex + (fileProgress || 0)) / total;
  uploadProgressBar.style.width = `${Math.min(overall * 100, 100)}%`;
}
function hideUploadOverlay() {
  if (!uploadOverlay) return;
  uploadOverlay.style.display = "none";
}

function isKakaoInApp() {
  return /KAKAOTALK/i.test(navigator.userAgent || "");
}
const VIEWABLE_EXT = new Set([
  "jpg", "jpeg", "png", "gif", "webp", "svg", "bmp", "heic",
  "pdf",
  "txt", "csv", "md", "log", "json", "xml", "html", "htm", "js", "css",
  "mp4", "webm", "mov",
  "mp3", "wav", "ogg", "m4a",
]);
function isViewable(name, contentType) {
  const ct = (contentType || "").toLowerCase();
  if (
    ct.startsWith("image/") ||
    ct.startsWith("video/") ||
    ct.startsWith("audio/") ||
    ct.startsWith("text/") ||
    ct === "application/pdf" ||
    ct === "application/json"
  )
    return true;
  const ext = (name.split(".").pop() || "").toLowerCase();
  return VIEWABLE_EXT.has(ext);
}
function viewFile(id) {
  const url = `/api/files/${encodeURIComponent(id)}/view`;
  if (isKakaoInApp()) {
    openInExternalBrowser(url);
    return;
  }
  window.open(url, "_blank", "noopener");
}
async function downloadFolderZip(id, name) {
  const url = `/api/folders/${encodeURIComponent(id)}/zip`;
  if (isKakaoInApp()) {
    openInExternalBrowser(url);
    return;
  }
  const suggestedName = `${name}.zip`;
  if (window.showSaveFilePicker) {
    let handle;
    try {
      handle = await window.showSaveFilePicker({
        suggestedName,
        types: [
          {
            description: "ZIP archive",
            accept: { "application/zip": [".zip"] },
          },
        ],
      });
    } catch (e) {
      if (e && e.name === "AbortError") return;
      // picker 미지원 등 → 폴백으로 진행
    }
    if (handle) {
      try {
        const res = await fetch(url);
        if (!res.ok) {
          const msg = (await res.text().catch(() => "")) || "다운로드 실패";
          alert(msg);
          return;
        }
        const writable = await handle.createWritable();
        await res.body.pipeTo(writable);
        return;
      } catch (e) {
        alert(`다운로드 실패: ${e.message || ""}`);
        return;
      }
    }
  }
  const a = document.createElement("a");
  a.href = url;
  a.download = suggestedName;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
}
function isIOSDevice() {
  const ua = navigator.userAgent || "";
  return /iPhone|iPad|iPod/i.test(ua);
}
function openInExternalBrowser(path) {
  const absolute = path.startsWith("http")
    ? path
    : window.location.origin + path;
  if (isIOSDevice()) {
    alert(
      "카카오톡 안에서는 파일 다운로드가 안 돼요.\n\n화면 아래쪽 메뉴에서 '다른 브라우저로 열기' 또는 'Safari로 열기'를 눌러주세요."
    );
    return;
  }
  window.location.href =
    "kakaotalk://web/openExternal?url=" + encodeURIComponent(absolute);
}

async function downloadFile(id, name) {
  const url = `/api/files/${encodeURIComponent(id)}/download`;
  if (isKakaoInApp()) {
    openInExternalBrowser(url);
    return;
  }
  if (window.showSaveFilePicker) {
    try {
      const handle = await window.showSaveFilePicker({ suggestedName: name });
      const res = await fetch(url);
      if (!res.ok) throw new Error("download failed");
      const writable = await handle.createWritable();
      await res.body.pipeTo(writable);
      return;
    } catch (e) {
      if (e && e.name === "AbortError") return;
      // fall through to fallback download
    }
  }
  window.open(url, "_blank");
}

function uploadFileWithProgress(fd, onProgress) {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.upload.addEventListener("progress", (e) => {
      if (e.lengthComputable && onProgress) {
        onProgress(e.loaded / e.total);
      }
    });
    xhr.addEventListener("load", () => {
      if (xhr.status >= 200 && xhr.status < 300) resolve();
      else reject(new Error("upload failed: " + xhr.status));
    });
    xhr.addEventListener("error", () => reject(new Error("network error")));
    xhr.addEventListener("abort", () => reject(new Error("aborted")));
    xhr.open("POST", "/api/files");
    const headers =
      typeof window.fddAuthHeaders === "function" ? window.fddAuthHeaders() : {};
    Object.entries(headers).forEach(([k, v]) => xhr.setRequestHeader(k, v));
    xhr.send(fd);
  });
}

async function uploadFiles(files) {
  if (!files || files.length === 0) return;

  const MAX_SIZE = 30 * 1024 * 1024;
  const oversized = files.filter((f) => f.size > MAX_SIZE);
  if (oversized.length > 0) {
    const list = oversized
      .map((f) => `• ${f.name} (${(f.size / 1024 / 1024).toFixed(1)} MB)`)
      .join("\n");
    alert(
      `다음 ${oversized.length}개 파일은 30MB를 초과해서 업로드할 수 없어요:\n\n${list}`
    );
    files = files.filter((f) => f.size <= MAX_SIZE);
    if (files.length === 0) return;
  }

  showUploadOverlay(files.length);
  uploadStatus.classList.add("hidden");
  let success = 0;
  let fail = 0;

  for (let i = 0; i < files.length; i++) {
    updateUploadOverlay(files[i].name, i, files.length, 0);
    const fd = new FormData();
    fd.append("project_id", projectId);
    if (folderId) fd.append("folder_id", folderId);
    fd.append("file", files[i]);
    try {
      await uploadFileWithProgress(fd, (frac) => {
        updateUploadOverlay(files[i].name, i, files.length, frac);
      });
      success++;
    } catch (e) {
      fail++;
    }
    updateUploadOverlay(files[i].name, i + 1, files.length, 0);
  }

  hideUploadOverlay();
  uploadStatus.classList.remove("hidden");
  uploadStatus.textContent =
    fail > 0
      ? `완료: ${success}개 성공, ${fail}개 실패`
      : `완료: ${success}개 업로드 ✅`;
  setTimeout(() => uploadStatus.classList.add("hidden"), 3000);
  await load();
}

newFolderBtn.addEventListener("click", async () => {
  const name = prompt("새 폴더 이름을 입력해주세요");
  if (!name || !name.trim()) return;
  try {
    const res = await fetch("/api/folders", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        project_id: projectId,
        parent_folder_id: folderId || null,
        name: name.trim(),
      }),
    });
    if (!res.ok) throw new Error();
    await load();
  } catch (e) {
    alert("만들기 실패");
  }
});

uploadBtn.addEventListener("click", () => fileInput.click());

fileInput.addEventListener("change", async () => {
  const files = Array.from(fileInput.files || []);
  fileInput.value = "";
  await uploadFiles(files);
});

async function uploadLogoImage(file) {
  if (!file) return;
  if (!file.type.startsWith("image/")) {
    alert("이미지 파일만 업로드 가능해요");
    return;
  }
  if (file.size > 5 * 1024 * 1024) {
    alert("이미지는 5MB 이하만 가능해요");
    return;
  }
  try {
    const fd = new FormData();
    fd.append("file", file);
    const res = await fetch(
      `/api/projects/${encodeURIComponent(projectId)}/image`,
      { method: "POST", body: fd }
    );
    if (!res.ok) throw new Error();
    await load();
  } catch (e) {
    alert("이미지 업로드 실패");
  }
}

imageInput.addEventListener("change", async () => {
  const file = imageInput.files?.[0];
  imageInput.value = "";
  await uploadLogoImage(file);
});

projectImageRow.addEventListener("dragenter", (e) => {
  if (!e.dataTransfer || !Array.from(e.dataTransfer.types || []).includes("Files"))
    return;
  e.preventDefault();
  e.stopPropagation();
  projectImageRow.classList.add("logo-drop-active");
});
projectImageRow.addEventListener("dragover", (e) => {
  if (!e.dataTransfer || !Array.from(e.dataTransfer.types || []).includes("Files"))
    return;
  e.preventDefault();
  e.stopPropagation();
});
projectImageRow.addEventListener("dragleave", (e) => {
  if (!e.dataTransfer) return;
  e.stopPropagation();
  if (!projectImageRow.contains(e.relatedTarget)) {
    projectImageRow.classList.remove("logo-drop-active");
  }
});
projectImageRow.addEventListener("drop", async (e) => {
  if (!e.dataTransfer) return;
  e.preventDefault();
  e.stopPropagation();
  projectImageRow.classList.remove("logo-drop-active");
  const file = e.dataTransfer.files?.[0];
  await uploadLogoImage(file);
});

window.addEventListener("paste", async (e) => {
  const tag = e.target && e.target.tagName;
  if (tag === "INPUT" || tag === "TEXTAREA" || (e.target && e.target.isContentEditable))
    return;
  const items = e.clipboardData && e.clipboardData.items;
  if (!items) return;
  for (const item of items) {
    if (item.kind === "file" && item.type.startsWith("image/")) {
      const file = item.getAsFile();
      if (file) {
        e.preventDefault();
        await uploadLogoImage(file);
        return;
      }
    }
  }
});

let dragCounter = 0;
window.addEventListener("dragenter", (e) => {
  if (!e.dataTransfer || !Array.from(e.dataTransfer.types || []).includes("Files"))
    return;
  e.preventDefault();
  dragCounter++;
  document.body.classList.add("drag-active");
});
window.addEventListener("dragover", (e) => {
  if (!e.dataTransfer || !Array.from(e.dataTransfer.types || []).includes("Files"))
    return;
  e.preventDefault();
});
window.addEventListener("dragleave", (e) => {
  if (!e.dataTransfer || !Array.from(e.dataTransfer.types || []).includes("Files"))
    return;
  e.preventDefault();
  dragCounter--;
  if (dragCounter <= 0) {
    dragCounter = 0;
    document.body.classList.remove("drag-active");
  }
});
window.addEventListener("drop", async (e) => {
  if (!e.dataTransfer) return;
  e.preventDefault();
  dragCounter = 0;
  document.body.classList.remove("drag-active");
  const files = Array.from(e.dataTransfer.files || []);
  if (files.length === 0) return;
  await uploadFiles(files);
});

load();
