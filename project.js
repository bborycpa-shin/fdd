const params = new URLSearchParams(location.search);
const projectId = params.get("id");
const folderId = params.get("folder");

const projectNameEl = document.getElementById("project-name");
const breadcrumbEl = document.getElementById("breadcrumb");
const contentsEl = document.getElementById("contents");
const newFolderBtn = document.getElementById("new-folder-btn");
const uploadBtn = document.getElementById("upload-btn");
const fileInput = document.getElementById("file-input");
const uploadStatus = document.getElementById("upload-status");

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

async function load() {
  try {
    const url =
      `/api/projects/${encodeURIComponent(projectId)}/contents` +
      (folderId ? `?folder=${encodeURIComponent(folderId)}` : "");
    const res = await fetch(url);
    if (!res.ok) throw new Error();
    const data = await res.json();
    render(data);
  } catch (e) {
    contentsEl.innerHTML =
      '<p class="text-red-500 text-center py-8">불러오기 실패</p>';
  }
}

function render(data) {
  projectNameEl.textContent = data.project.name;
  document.title = `${data.project.name} - 파일 공유`;

  const crumbs = [
    `<a href="/project.html?id=${encodeURIComponent(data.project.id)}" class="active:text-slate-900">🏠</a>`,
  ];
  for (const c of data.breadcrumb) {
    crumbs.push('<span class="text-slate-300">/</span>');
    crumbs.push(
      `<a href="/project.html?id=${encodeURIComponent(data.project.id)}&folder=${encodeURIComponent(c.id)}" class="active:text-slate-900">${escapeHtml(c.name)}</a>`
    );
  }
  breadcrumbEl.innerHTML = crumbs.join(" ");

  if (data.folders.length === 0 && data.files.length === 0) {
    contentsEl.innerHTML =
      '<p class="text-slate-400 text-center py-8">아직 비어있어요.<br>위 버튼으로 폴더를 만들거나 파일을 올려보세요!<br><span class="text-xs">PC에서는 화면에 파일을 끌어다 놓아도 돼요</span></p>';
    return;
  }

  const items = [];

  for (const f of data.folders) {
    items.push(`
      <div class="bg-white rounded-2xl border border-slate-200 p-4 flex items-center gap-3">
        <a href="/project.html?id=${encodeURIComponent(data.project.id)}&folder=${encodeURIComponent(f.id)}" class="flex-1 flex items-center gap-3 min-w-0 active:opacity-60 transition">
          <span class="w-10 h-10 rounded-lg bg-amber-100 text-amber-700 flex items-center justify-center text-xl shrink-0">📁</span>
          <span class="font-medium truncate">${escapeHtml(f.name)}</span>
        </a>
        <button class="folder-delete text-slate-400 active:text-red-500 px-2 py-1 text-xl shrink-0" data-id="${f.id}" data-name="${escapeHtml(f.name)}" aria-label="폴더 삭제">🗑</button>
      </div>
    `);
  }

  for (const file of data.files) {
    const icon = getFileIcon(file.name);
    items.push(`
      <div class="bg-white rounded-2xl border border-slate-200 p-4 flex items-center gap-3">
        <a href="/api/files/${encodeURIComponent(file.id)}/download" class="flex-1 flex items-center gap-3 min-w-0 active:opacity-60 transition" target="_blank" rel="noopener">
          <span class="w-10 h-10 rounded-lg ${icon.color} text-white flex items-center justify-center text-[10px] font-bold shrink-0">${icon.label}</span>
          <div class="min-w-0 flex-1">
            <p class="font-medium truncate">${escapeHtml(file.name)}</p>
            <p class="text-xs text-slate-500">${formatSize(file.size)}</p>
          </div>
        </a>
        <button class="file-delete text-slate-400 active:text-red-500 px-2 py-1 text-xl shrink-0" data-id="${file.id}" data-name="${escapeHtml(file.name)}" aria-label="파일 삭제">🗑</button>
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
        await load();
      } catch (e) {
        alert("삭제 실패");
      }
    });
  });
}

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
