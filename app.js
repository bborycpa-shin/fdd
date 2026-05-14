const projectList = document.getElementById("project-list");
const newProjectBtn = document.getElementById("new-project-btn");
const sortBar = document.getElementById("sort-bar");

let currentSort = "created_desc";
let cachedProjects = null;

function applySortChipStyles() {
  sortBar.querySelectorAll(".sort-chip").forEach((chip) => {
    const isCurrent = chip.dataset.sort === currentSort;
    chip.className =
      "sort-chip shrink-0 px-2.5 py-1 rounded-full border " +
      (isCurrent
        ? "bg-blue-600 text-white border-blue-600 font-semibold"
        : "bg-white text-slate-700 border-slate-300 active:bg-slate-100");
  });
}

sortBar.querySelectorAll(".sort-chip").forEach((chip) => {
  chip.addEventListener("click", () => {
    currentSort = chip.dataset.sort;
    applySortChipStyles();
    if (cachedProjects) renderProjects(cachedProjects);
  });
});
applySortChipStyles();

function escapeHtml(str) {
  return String(str).replace(
    /[&<>"']/g,
    (c) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c])
  );
}

const GRADIENTS = [
  "from-blue-500 to-indigo-600",
  "from-pink-500 to-rose-600",
  "from-green-500 to-emerald-600",
  "from-orange-500 to-red-500",
  "from-purple-500 to-violet-600",
  "from-teal-500 to-cyan-600",
  "from-amber-500 to-orange-600",
  "from-slate-600 to-slate-800",
];

function gradientFor(id) {
  const s = String(id);
  let hash = 0;
  for (let i = 0; i < s.length; i++) hash = (hash * 31 + s.charCodeAt(i)) >>> 0;
  return GRADIENTS[hash % GRADIENTS.length];
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

function sortProjects(projects, key) {
  const arr = [...projects];
  switch (key) {
    case "created_desc":
      arr.sort((a, b) => (b.created_at || 0) - (a.created_at || 0));
      break;
    case "created_asc":
      arr.sort((a, b) => (a.created_at || 0) - (b.created_at || 0));
      break;
    case "name_asc":
      arr.sort((a, b) => a.name.localeCompare(b.name, "ko"));
      break;
    case "name_desc":
      arr.sort((a, b) => b.name.localeCompare(a.name, "ko"));
      break;
  }
  return arr;
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
  const sorted = sortProjects(projects, currentSort);

  if (sorted.length === 0) {
    projectList.innerHTML =
      '<div class="col-span-2"><p class="text-slate-400 text-center text-xs py-6">아직 프로젝트가 없어요.<br>위 버튼을 눌러 만들어보세요!</p></div>';
    return;
  }

  projectList.innerHTML = sorted
    .map((p) => {
      const iconHtml = p.has_image
        ? `<img src="/api/projects/${encodeURIComponent(p.id)}/image" class="w-12 h-12 rounded-xl object-cover shadow-md bg-slate-100" alt="${escapeHtml(p.name)}" />`
        : `<div class="w-12 h-12 rounded-xl bg-gradient-to-br ${gradientFor(p.id)} text-white text-2xl flex items-center justify-center shadow-md">📁</div>`;
      return `
    <div class="relative aspect-square bg-white rounded-2xl border border-slate-100 shadow-sm active:scale-[0.97] transition-transform">
      <button class="project-open block w-full h-full text-left p-3" data-id="${p.id}">
        <div class="flex flex-col h-full justify-between">
          ${iconHtml}
          <div class="mt-2 min-w-0">
            <p class="text-sm font-bold break-all leading-tight line-clamp-3">${escapeHtml(p.name)}</p>
            <p class="text-[10px] text-slate-400 mt-1">${formatDate(p.created_at)}</p>
          </div>
        </div>
      </button>
      <button class="project-delete absolute top-1.5 right-1.5 text-slate-300 active:text-red-500 text-base px-1.5 py-1" data-id="${p.id}" data-name="${escapeHtml(p.name)}" aria-label="프로젝트 삭제">🗑</button>
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

  projectList.querySelectorAll(".project-delete").forEach((btn) => {
    btn.addEventListener("click", async () => {
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
}

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
