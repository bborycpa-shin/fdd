const params = new URLSearchParams(location.search);
const projectId = params.get("id");
const folderId = params.get("folder");

const projectNameEl = document.getElementById("project-name");
const contentsEl = document.getElementById("contents");
const newFolderBtn = document.getElementById("new-folder-btn");
const uploadBtn = document.getElementById("upload-btn");
const fileInput = document.getElementById("file-input");
const uploadStatus = document.getElementById("upload-status");
const sortSelect = document.getElementById("sort-select");
const treeContainer = document.getElementById("tree-container");
const folderTreeEl = document.getElementById("folder-tree");
const actionBar = document.getElementById("action-bar");
const selectedCountEl = document.getElementById("selected-count");
const cancelSelectBtn = document.getElementById("cancel-select");
const bulkDeleteBtn = document.getElementById("bulk-delete");

if (!projectId) {
  location.href = "/";
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

function getFileIcon(filename) {
  const parts = String(filename).split(".");
  const ext = parts.length > 1 ? parts.pop().toLowerCase() : "";
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
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

function formatDate(unixSec) {
  if (!unixSec) return "";
  const d = new Date(unixSec * 1000);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}.${m}.${day}`;
}

const selectedFileIds = new Set();
let cachedData = null;

const SORT_KEY = "fdd_sort_v1";
sortSelect.value = localStorage.getItem(SORT_KEY) || "created_desc";
sortSelect.addEventListener("change", () => {
  localStorage.setItem(SORT_KEY, sortSelect.value);
  if (cachedData) render(cachedData);
});

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
    case "size_desc":
      if (kind === "file") arr.sort((a, b) => b.size - a.size);
      else arr.sort((a, b) => a.name.localeCompare(b.name, "ko"));
      break;
    case "size_asc":
      if (kind === "file") arr.sort((a, b) => a.size - b.size);
      else arr.sort((a, b) => a.name.localeCompare(b.name, "ko"));
      break;
  }
  return arr;
}

async function load() {
  try {
    const url =
      `/api/projects/${encodeURIComponent(projectId)}/contents` +
      (folderId ? `?folder=${encodeURIComponent(folderId)}` : "");
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

function renderTree(data) {
  const all = data.all_folders || [];
  const pid = encodeURIComponent(data.project.id);
  const currentId = folderId || null;
  const isRoot = !currentId;
  const lines = [];

  lines.push(`
    <a href="/project.html?id=${pid}" class="inline-flex items-center px-2.5 py-1 rounded-full border shrink-0 transition ${isRoot ? "bg-blue-600 text-white border-blue-600 font-semibold" : "bg-white text-slate-700 border-slate-300 active:bg-slate-100"}">
      ${escapeHtml(data.project.name)}
    </a>
  `);

  if (all.length > 0) {
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

    function walk(nodes, pathPrefix) {
      for (const n of nodes) {
        const fullPath = pathPrefix ? `${pathPrefix} / ${n.name}` : n.name;
        const isCurrent = n.id === currentId;
        lines.push(`
          <a href="/project.html?id=${pid}&folder=${encodeURIComponent(n.id)}" class="inline-flex items-center px-2.5 py-1 rounded-full border shrink-0 transition ${isCurrent ? "bg-blue-600 text-white border-blue-600 font-semibold" : "bg-amber-50 text-amber-900 border-amber-200 active:bg-amber-100"}">
            📁 ${escapeHtml(fullPath)}
          </a>
        `);
        if (n.children.length > 0) walk(n.children, fullPath);
      }
    }
    walk(roots, "");
  }

  folderTreeEl.innerHTML = lines.join("");

  const currentEl = folderTreeEl.querySelector(".bg-blue-600");
  if (currentEl && currentEl.scrollIntoView) {
    currentEl.scrollIntoView({ block: "nearest", inline: "nearest" });
  }
}

function render(data) {
  projectNameEl.textContent = data.project.name;
  document.title = `${data.project.name} - 파일 공유`;

  renderTree(data);

  const sortKey = sortSelect.value;
  const folders = sortItems(data.folders, "folder", sortKey);
  const files = sortItems(data.files, "file", sortKey);

  if (folders.length === 0 && files.length === 0) {
    contentsEl.innerHTML =
      '<p class="text-slate-400 text-center text-xs py-6">아직 비어있어요.<br>위 버튼으로 폴더를 만들거나 파일을 올려보세요!<br><span class="text-[10px]">PC에서는 화면에 파일을 끌어다 놓아도 돼요</span></p>';
    updateActionBar();
    return;
  }

  const items = [];

  for (const f of folders) {
    items.push(`
      <div class="flex items-center gap-2 px-3 py-1.5 bg-amber-50 rounded-xl border border-amber-200">
        <a href="/project.html?id=${encodeURIComponent(data.project.id)}&folder=${encodeURIComponent(f.id)}" class="flex-1 flex items-center gap-2 min-w-0 active:opacity-60 transition py-0.5">
          <span class="w-7 h-7 rounded-md bg-amber-200 text-amber-800 flex items-center justify-center text-sm shrink-0">📁</span>
          <div class="flex-1 min-w-0 leading-tight">
            <p class="text-xs font-medium break-all text-amber-950">${escapeHtml(f.name)}</p>
            <p class="text-[10px] text-amber-700/70 mt-0.5">${formatDate(f.created_at)}</p>
          </div>
        </a>
        <button class="folder-delete text-amber-600/70 active:text-red-500 px-1.5 py-1 text-base shrink-0 self-center" data-id="${f.id}" data-name="${escapeHtml(f.name)}" aria-label="폴더 삭제">🗑</button>
      </div>
    `);
  }

  for (const file of files) {
    const icon = getFileIcon(file.name);
    const isChecked = selectedFileIds.has(file.id);
    items.push(`
      <div class="flex items-center gap-2 px-3 py-1.5 bg-white rounded-xl border ${isChecked ? "border-blue-400 bg-blue-50" : "border-slate-200"}">
        <label class="shrink-0 self-center p-1 -ml-1 cursor-pointer">
          <input type="checkbox" class="file-check w-4 h-4 align-middle accent-blue-600" data-id="${file.id}" ${isChecked ? "checked" : ""} />
        </label>
        <a href="/api/files/${encodeURIComponent(file.id)}/download" class="flex-1 flex items-start gap-2 min-w-0 active:opacity-60 transition py-0.5" target="_blank" rel="noopener">
          <span class="w-7 h-7 rounded-md ${icon.color} text-white flex items-center justify-center text-[8px] font-bold shrink-0 mt-0.5">${icon.label}</span>
          <div class="flex-1 min-w-0 leading-tight">
            <p class="text-xs font-medium break-all">${escapeHtml(file.name)}</p>
            <p class="text-[10px] text-slate-400 mt-0.5">${formatSize(file.size)} · ${formatDate(file.uploaded_at)}</p>
          </div>
        </a>
        <button class="file-delete text-slate-400 active:text-red-500 px-1.5 py-1 text-base shrink-0 self-center" data-id="${file.id}" data-name="${escapeHtml(file.name)}" aria-label="파일 삭제">🗑</button>
      </div>
    `);
  }

  contentsEl.innerHTML = items.join("");

  contentsEl.querySelectorAll(".folder-delete").forEach((btn) => {
    btn.addEventListener("click", async () => {
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
    btn.addEventListener("click", async () => {
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

  contentsEl.querySelectorAll(".file-check").forEach((cb) => {
    cb.addEventListener("change", () => {
      const id = cb.dataset.id;
      if (cb.checked) selectedFileIds.add(id);
      else selectedFileIds.delete(id);
      const row = cb.closest("div.flex.items-center");
      if (row) {
        if (cb.checked) {
          row.classList.add("border-blue-400", "bg-blue-50");
          row.classList.remove("border-slate-200");
        } else {
          row.classList.remove("border-blue-400", "bg-blue-50");
          row.classList.add("border-slate-200");
        }
      }
      updateActionBar();
    });
  });

  updateActionBar();
}

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

async function uploadFiles(files) {
  if (!files || files.length === 0) return;

  uploadStatus.classList.remove("hidden");
  let success = 0;
  let fail = 0;

  for (let i = 0; i < files.length; i++) {
    uploadStatus.textContent = `${i + 1}/${files.length} 업로드 중: ${files[i].name}`;
    const fd = new FormData();
    fd.append("project_id", projectId);
    if (folderId) fd.append("folder_id", folderId);
    fd.append("file", files[i]);
    try {
      const res = await fetch("/api/files", { method: "POST", body: fd });
      if (!res.ok) throw new Error();
      success++;
    } catch (e) {
      fail++;
    }
  }

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
