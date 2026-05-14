const projectList = document.getElementById("project-list");
const newProjectBtn = document.getElementById("new-project-btn");

function escapeHtml(str) {
  return String(str).replace(
    /[&<>"']/g,
    (c) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c])
  );
}

async function loadProjects() {
  try {
    const res = await fetch("/api/projects");
    if (!res.ok) throw new Error();
    const data = await res.json();
    renderProjects(data.projects || []);
  } catch (e) {
    projectList.innerHTML =
      '<p class="text-red-500 text-center text-sm py-6">불러오기 실패</p>';
  }
}

function renderProjects(projects) {
  if (projects.length === 0) {
    projectList.innerHTML =
      '<p class="text-slate-400 text-center text-sm py-6">아직 프로젝트가 없어요.<br>위 버튼을 눌러 만들어보세요!</p>';
    return;
  }

  projectList.innerHTML = projects
    .map(
      (p) => `
    <div class="flex items-center gap-2 px-3 py-2 bg-white rounded-xl border border-slate-200">
      <button class="project-open flex-1 flex items-center gap-2 min-w-0 active:opacity-60 transition" data-id="${p.id}">
        <span class="w-8 h-8 rounded-lg bg-amber-100 text-amber-700 flex items-center justify-center text-base shrink-0">📂</span>
        <span class="text-sm font-medium truncate">${escapeHtml(p.name)}</span>
      </button>
      <button class="project-delete text-slate-400 active:text-red-500 px-1.5 py-1 text-base shrink-0" data-id="${p.id}" data-name="${escapeHtml(p.name)}" aria-label="프로젝트 삭제">🗑</button>
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
