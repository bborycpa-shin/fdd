const projectList = document.getElementById("project-list");
const newProjectBtn = document.getElementById("new-project-btn");

const editModal = document.getElementById("edit-modal");
const editName = document.getElementById("edit-name");
const editColors = document.getElementById("edit-colors");
const editSaveBtn = document.getElementById("edit-save");
const editCancelXBtn = document.getElementById("edit-cancel-x");
const editCancelBtn = document.getElementById("edit-cancel-btn");

let cachedProjects = null;
let editingProject = null;
let editingColorIndex = null;

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
  return projectColorByHash(project.id);
}

function escapeHtml(str) {
  return String(str).replace(
    /[&<>"']/g,
    (c) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c])
  );
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

async function loadProjects() {
  try {
    const res = await fetch("/api/projects");
    if (!res.ok) throw new Error();
    const data = await res.json();
    cachedProjects = data.projects || [];
    renderProjects(cachedProjects);
  } catch (e) {
    projectList.innerHTML =
      '<p class="text-red-500 text-center text-sm py-6">불러오기 실패</p>';
  }
}

function renderProjects(projects) {
  const sorted = [...projects].sort((a, b) => {
    const ad = a.display_number || 0;
    const bd = b.display_number || 0;
    if (ad !== bd) return ad - bd;
    return a.name.localeCompare(b.name, "ko");
  });

  if (sorted.length === 0) {
    projectList.innerHTML =
      '<p class="text-slate-400 text-center text-xs py-6">아직 프로젝트가 없어요.<br>위 버튼을 눌러 만들어보세요!</p>';
    return;
  }

  projectList.innerHTML = sorted
    .map((p) => {
      const color = projectColor(p);
      const iconHtml = p.has_image
        ? `<img src="/api/projects/${encodeURIComponent(p.id)}/image" class="block rounded-md shadow-sm shrink-0" alt="${escapeHtml(p.name)}" style="max-height:40px;max-width:64px;height:auto;width:auto;" />`
        : `<div class="w-10 h-10 rounded-md bg-gradient-to-br ${color.grad} text-white text-lg flex items-center justify-center shadow-sm shrink-0">📁</div>`;
      const numBadge = p.display_number
        ? `<span class="shrink-0 inline-flex items-center justify-center min-w-[22px] h-[18px] px-1 rounded bg-white/80 border border-slate-300 text-[10px] font-bold text-slate-700">#${p.display_number}</span>`
        : "";
      return `
    <div class="project-row flex items-center gap-1 px-2 py-2 rounded-xl border border-white/60 shadow-sm" data-id="${p.id}" style="background: linear-gradient(135deg, ${color.bgFrom}, ${color.bgTo})">
      <span class="drag-handle admin-only shrink-0 inline-flex items-center justify-center w-5 text-slate-500 text-base select-none" style="cursor:grab;touch-action:none;" title="드래그하여 순서 변경" aria-hidden="true">⋮⋮</span>
      <button class="project-open flex-1 flex items-center gap-2 min-w-0 active:opacity-60 transition text-left" data-id="${p.id}">
        ${iconHtml}
        <div class="flex-1 min-w-0 leading-tight">
          <div class="flex items-center gap-1.5 min-w-0">${numBadge}<p class="text-sm font-bold break-all text-slate-900 min-w-0">${escapeHtml(p.name)}</p></div>
          <p class="text-[10px] text-slate-500 mt-0.5">${formatDate(p.created_at)}</p>
        </div>
      </button>
      <button class="project-edit admin-only text-slate-400 active:text-blue-600 px-1 py-1 text-sm shrink-0 self-center" data-id="${p.id}" aria-label="프로젝트 수정">✏</button>
      <button class="project-delete admin-only text-slate-400 active:text-red-500 px-1 py-1 text-base shrink-0 self-center" data-id="${p.id}" data-name="${escapeHtml(p.name)}" aria-label="프로젝트 삭제">🗑</button>
    </div>
  `;
    })
    .join("");

  projectList.querySelectorAll(".project-open").forEach((btn) => {
    btn.addEventListener("click", () => {
      const id = btn.dataset.id;
      location.href = `/project.html?id=${encodeURIComponent(id)}`;
    });
  });

  projectList.querySelectorAll(".project-edit").forEach((btn) => {
    btn.addEventListener("click", (e) => {
      e.stopPropagation();
      const id = btn.dataset.id;
      const p = cachedProjects.find((x) => x.id === id);
      if (p) openEditModal(p);
    });
  });

  projectList.querySelectorAll(".project-delete").forEach((btn) => {
    btn.addEventListener("click", async (e) => {
      e.stopPropagation();
      const id = btn.dataset.id;
      const name = btn.dataset.name;
      if (
        !confirm(
          `"${name}" 프로젝트를 삭제할까요?\n(안에 있는 모든 폴더와 파일도 함께 삭제됩니다)`
        )
      )
        return;
      try {
        const res = await fetch(`/api/projects/${id}`, { method: "DELETE" });
        if (!res.ok) throw new Error();
        await loadProjects();
      } catch (e) {
        alert("삭제 실패");
      }
    });
  });

  setupSortable();
}

let sortableInstance = null;
function setupSortable() {
  if (sortableInstance) {
    sortableInstance.destroy();
    sortableInstance = null;
  }
  if (!window.Sortable) return;
  if (!window.fddAdmin || !window.fddAdmin.isAdmin()) return;
  sortableInstance = window.Sortable.create(projectList, {
    animation: 150,
    handle: ".drag-handle",
    ghostClass: "opacity-50",
    chosenClass: "ring-2",
    onEnd: async () => {
      const newOrder = Array.from(projectList.querySelectorAll(".project-row")).map(
        (el) => el.dataset.id
      );
      try {
        const res = await fetch("/api/admin/projects/reorder", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ order: newOrder }),
        });
        if (!res.ok) throw new Error();
        await loadProjects();
      } catch (e) {
        alert("순서 변경 실패");
        await loadProjects();
      }
    },
  });
}

function openEditModal(project) {
  editingProject = project;
  editingColorIndex =
    project.color_index === null || project.color_index === undefined
      ? null
      : project.color_index;
  editName.value = project.name;
  renderColorOptions();
  editModal.style.display = "flex";
}

function closeEditModal() {
  editModal.style.display = "none";
  editingProject = null;
}

function renderColorOptions() {
  const cells = [];
  const autoSelected = editingColorIndex === null;
  cells.push(`
    <button data-idx="auto" class="color-option h-9 rounded-lg border-2 transition text-[10px] font-medium bg-white text-slate-500 flex items-center justify-center" style="border-color: ${autoSelected ? "#2563eb" : "transparent"}">
      자동
    </button>
  `);
  PROJECT_COLORS.forEach((c, i) => {
    const selected = editingColorIndex === i;
    cells.push(`
      <button data-idx="${i}" class="color-option h-9 rounded-lg border-2 transition" style="background: linear-gradient(135deg, ${c.bgFrom}, ${c.bgTo}); border-color: ${selected ? "#2563eb" : "transparent"}"></button>
    `);
  });
  editColors.innerHTML = cells.join("");
  editColors.querySelectorAll(".color-option").forEach((btn) => {
    btn.addEventListener("click", () => {
      const raw = btn.dataset.idx;
      editingColorIndex = raw === "auto" ? null : parseInt(raw, 10);
      renderColorOptions();
    });
  });
}

editSaveBtn.addEventListener("click", async () => {
  if (!editingProject) return;
  const newName = editName.value.trim();
  if (!newName) {
    alert("이름을 입력해주세요");
    return;
  }
  try {
    const body = { name: newName, color_index: editingColorIndex };
    const res = await fetch(`/api/projects/${editingProject.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    if (!res.ok) throw new Error();
    closeEditModal();
    await loadProjects();
  } catch (e) {
    alert("수정 실패");
  }
});

editCancelXBtn.addEventListener("click", closeEditModal);
editCancelBtn.addEventListener("click", closeEditModal);
editModal.addEventListener("click", (e) => {
  if (e.target === editModal) closeEditModal();
});

newProjectBtn.addEventListener("click", async () => {
  const name = prompt("새 프로젝트 이름을 입력해주세요");
  if (!name || !name.trim()) return;
  try {
    const res = await fetch("/api/projects", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: name.trim() }),
    });
    if (!res.ok) throw new Error();
    await loadProjects();
  } catch (e) {
    alert("만들기 실패");
  }
});

loadProjects();
