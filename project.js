const params = new URLSearchParams(location.search);
const projectId = params.get("id");
const folderId = params.get("folder");

const projectNameEl = document.getElementById("project-name");
const breadcrumbEl = document.getElementById("breadcrumb");
const contentsEl = document.getElementById("contents");
const newFolderBtn = document.getElementById("new-folder-btn");

if (!projectId) {
  location.href = "/";
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
      '<p class="text-slate-400 text-center py-8">아직 비어있어요.<br>위 버튼으로 새 폴더를 만들어보세요!</p>';
    return;
  }

  const items = [];

  for (const f of data.folders) {
    items.push(`
      <a href="/project.html?id=${encodeURIComponent(data.project.id)}&folder=${encodeURIComponent(f.id)}" class="bg-white rounded-2xl border border-slate-200 p-4 flex items-center gap-3 active:bg-slate-100 transition">
        <span class="text-2xl">📁</span>
        <span class="font-medium">${escapeHtml(f.name)}</span>
      </a>
    `);
  }

  for (const file of data.files) {
    items.push(`
      <div class="bg-white rounded-2xl border border-slate-200 p-4 flex items-center gap-3">
        <span class="text-2xl">📄</span>
        <div class="flex-1 min-w-0">
          <p class="font-medium truncate">${escapeHtml(file.name)}</p>
          <p class="text-xs text-slate-500">${formatSize(file.size)}</p>
        </div>
      </div>
    `);
  }

  contentsEl.innerHTML = items.join("");
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

load();
