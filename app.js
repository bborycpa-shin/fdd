const projectList = document.getElementById("project-list");
const newProjectBtn = document.getElementById("new-project-btn");

let cachedProjects = null;

const PROJECT_COLORS = [
  { bgFrom: "#eff6ff", bgTo: "#e0e7ff", grad: "from-blue-500 to-indigo-600" },
  { bgFrom: "#fdf2f8", bgTo: "#ffe4e6", grad: "from-pink-500 to-rose-600" },
  { bgFrom: "#f0fdf4", bgTo: "#d1fae5", grad: "from-green-500 to-emerald-600" },
  { bgFrom: "#fff7ed", bgTo: "#fee2e2", grad: "from-orange-500 to-red-500" },
  { bgFrom: "#faf5ff", bgTo: "#ede9fe", grad: "from-purple-500 to-violet-600" },
  { bgFrom: "#f0fdfa", bgTo: "#cffafe", grad: "from-teal-500 to-cyan-600" },
  { bgFrom: "#fffbeb", bgTo: "#ffedd5", grad: "from-amber-500 to-orange-600" },
  { bgFrom: "#f1f5f9", bgTo: "#e2e8f0", grad: "from-slate-600 to-slate-800" },
];

function projectColor(id) {
  const s = String(id);
  let hash = 0;
  for (let i = 0; i < s.length; i++) hash = (hash * 31 + s.charCodeAt(i)) >>> 0;
  return PROJECT_COLORS[hash % PROJECT_COLORS.length];
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
  const sorted = [...projects].sort((a, b) =>
    a.name.localeCompare(b.name, "ko")
  );

  if (sorted.length === 0) {
    projectList.innerHTML =
      '<p class="text-slate-400 text-center text-xs py-6">아직 프로젝트가 없어요.<br>위 버튼을 눌러 만들어보세요!</p>';
    return;
  }

  projectList.innerHTML = sorted
    .map((p) => {
      const color = projectColor(p.id);
      const iconHtml = p.has_image
        ? `<img src="/api/projects/${encodeURIComponent(p.id)}/image" class="block rounded-md shadow-sm shrink-0" alt="${escapeHtml(p.name)}" style="max-height:40px;max-width:64px;height:auto;width:auto;" />`
        : `<div class="w-10 h-10 rounded-md bg-gradient-to-br ${color.grad} text-white text-lg flex items-center justify-center shadow-sm shrink-0">📁</div>`;
      return `
    <div class="flex items-center gap-2 px-3 py-2 rounded-xl border border-white/60 shadow-sm" style="background: linear-gradient(135deg, ${color.bgFrom}, ${color.bgTo})">
      <button class="project-open flex-1 flex items-center gap-2.5 min-w-0 active:opacity-60 transition text-left" data-id="${p.id}">
        ${iconHtml}
        <div class="flex-1 min-w-0 leading-tight">
          <p class="text-sm font-bold break-all text-slate-900">${escapeHtml(p.name)}</p>
          <p class="text-[10px] text-slate-500 mt-0.5">${formatDate(p.created_at)}</p>
        </div>
      </button>
      <button class="project-delete text-slate-400 active:text-red-500 px-1.5 py-1 text-base shrink-0 self-center" data-id="${p.id}" data-name="${escapeHtml(p.name)}" aria-label="프로젝트 삭제">🗑</button>
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
