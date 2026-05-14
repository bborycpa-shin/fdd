const projectList = document.getElementById("project-list");
const newProjectBtn = document.getElementById("new-project-btn");
const sortSelect = document.getElementById("sort-select");

const SORT_KEY = "fdd_sort_main_v1";
sortSelect.value = localStorage.getItem(SORT_KEY) || "created_desc";

let cachedProjects = null;

sortSelect.addEventListener("change", () => {
  localStorage.setItem(SORT_KEY, sortSelect.value);
  if (cachedProjects) renderProjects(cachedProjects);
});

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
  return `${y}.${m}.${day}`;
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
  const sorted = sortProjects(projects, sortSelect.value);

  if (sorted.length === 0) {
    projectList.innerHTML =
      '<p class="text-slate-400 text-center text-xs py-6">아직 프로젝트가 없어요.<br>위 버튼을 눌러 만들어보세요!</p>';
    return;
  }

  projectList.innerHTML = sorted
    .map(
      (p) => `
    <div class="flex items-center gap-2 px-3 py-1.5 bg-white rounded-xl border border-slate-200">
      <button class="project-open flex-1 flex items-center gap-2 min-w-0 active:opacity-60 transition text-left py-0.5" data-id="${p.id}">
        <span class="w-7 h-7 rounded-md bg-amber-100 text-amber-700 flex items-center justify-center text-sm shrink-0">📂</span>
        <div class="flex-1 min-w-0 leading-tight">
          <p class="text-xs font-medium break-all">${escapeHtml(p.name)}</p>
          <p class="text-[10px] text-slate-400 mt-0.5">${formatDate(p.created_at)}</p>
        </div>
      </button>
      <button class="project-delete text-slate-400 active:text-red-500 px-1.5 py-1 text-base shrink-0 self-center" data-id="${p.id}" data-name="${escapeHtml(p.name)}" aria-label="프로젝트 삭제">🗑</button>
    </div>
  `
    )
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
