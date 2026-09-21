// ============================================================
// Easy Resume Builder — demo logic. All in-memory, no backend.
// ============================================================

const $ = (sel) => document.querySelector(sel);
const $$ = (sel) => Array.from(document.querySelectorAll(sel));

// ---------- Tab / view switching ----------
$("#tabs").addEventListener("click", (e) => {
  const tab = e.target.closest(".tab");
  if (!tab) return;
  $$(".tab").forEach((t) => t.classList.toggle("is-active", t === tab));
  const view = tab.dataset.view;
  $$(".view").forEach((v) => v.classList.remove("is-active"));
  $("#view-" + view).classList.add("is-active");
});

// ============================================================
// BUILDER — block list (editor side)
// ============================================================
const BLOCK_TYPES = {
  summary: "Summary",
  experience: "Experience",
  skills: "Skills",
  education: "Education",
  projects: "Projects",
};

function blockMeta(block) {
  const d = block.data;
  if (block.type === "summary") return "Short intro paragraph";
  if (block.type === "experience") return `${d.items.length} role${d.items.length > 1 ? "s" : ""}`;
  if (block.type === "skills") return `${d.groups.length} groups`;
  if (block.type === "education") return `${d.items.length} entry`;
  if (block.type === "projects") return `${d.items.length} project${d.items.length > 1 ? "s" : ""}`;
  return "";
}

function renderBlockList() {
  const list = $("#blockList");
  list.innerHTML = "";
  BLOCKS.forEach((block) => {
    const li = document.createElement("li");
    li.className = "block";
    li.draggable = true;
    li.dataset.id = block.id;
    li.setAttribute("aria-disabled", (!block.enabled).toString());
    li.innerHTML = `
      <span class="block-grip" aria-hidden="true">⠿</span>
      <div class="block-info">
        <div class="block-label">${block.label}</div>
        <div class="block-meta">${blockMeta(block)}</div>
      </div>
      <label class="switch" title="Show on resume">
        <input type="checkbox" ${block.enabled ? "checked" : ""} data-id="${block.id}" />
        <span class="track"></span>
      </label>
    `;
    list.appendChild(li);
  });
  wireDragAndDrop();
  renderAddButtons();
}

// ---------- Toggle show/hide ----------
$("#blockList").addEventListener("change", (e) => {
  const input = e.target.closest('input[type="checkbox"]');
  if (!input) return;
  const block = BLOCKS.find((b) => b.id === input.dataset.id);
  block.enabled = input.checked;
  renderBlockList();
  renderResume();
});

// ---------- Drag and drop reorder (native HTML5 DnD) ----------
let dragId = null;
function wireDragAndDrop() {
  $$("#blockList .block").forEach((el) => {
    el.addEventListener("dragstart", () => {
      dragId = el.dataset.id;
      el.classList.add("dragging");
    });
    el.addEventListener("dragend", () => {
      el.classList.remove("dragging");
      $$("#blockList .block").forEach((b) => b.classList.remove("drop-target"));
      dragId = null;
    });
    el.addEventListener("dragover", (e) => {
      e.preventDefault();
      if (el.dataset.id !== dragId) el.classList.add("drop-target");
    });
    el.addEventListener("dragleave", () => el.classList.remove("drop-target"));
    el.addEventListener("drop", (e) => {
      e.preventDefault();
      el.classList.remove("drop-target");
      const targetId = el.dataset.id;
      if (!dragId || dragId === targetId) return;
      const from = BLOCKS.findIndex((b) => b.id === dragId);
      const to = BLOCKS.findIndex((b) => b.id === targetId);
      const [moved] = BLOCKS.splice(from, 1);
      BLOCKS.splice(to, 0, moved);
      renderBlockList();
      renderResume();
    });
  });
}

// ---------- Add-block chips ----------
function renderAddButtons() {
  const wrap = $("#addBlockButtons");
  wrap.innerHTML = "";
  Object.entries(BLOCK_TYPES).forEach(([type, label]) => {
    const exists = BLOCKS.some((b) => b.type === type);
    const chip = document.createElement("button");
    chip.className = "chip";
    chip.textContent = "+ " + label;
    chip.disabled = exists;
    chip.title = exists ? "Already added" : "Add " + label;
    chip.addEventListener("click", () => addBlock(type, label));
    wrap.appendChild(chip);
  });
}

function addBlock(type, label) {
  const templates = {
    summary: { text: "New summary. Click into the resume to imagine editing this." },
    experience: { items: [{ role: "Role", org: "Company", dates: "Year", points: ["Achievement with a number."] }] },
    skills: { groups: [{ name: "Category", items: "Skill, skill, skill" }] },
    education: { items: [{ school: "School", degree: "Degree", dates: "Year", detail: "" }] },
    projects: { items: [{ name: "Project", detail: "What it does and the stack." }] },
  };
  BLOCKS.push({ id: "b" + Date.now(), type, label, enabled: true, data: templates[type] });
  renderBlockList();
  renderResume();
}

// ============================================================
// BUILDER — resume preview (paper side)
// ============================================================
function renderResume() {
  const paper = $("#paper");
  let html = `
    <h1 class="r-name">${PROFILE.name}</h1>
    <div class="r-title">${PROFILE.title}</div>
    <p class="r-contact">
      <span>${PROFILE.email}</span> &nbsp;·&nbsp;
      <span>${PROFILE.phone}</span> &nbsp;·&nbsp;
      <span>${PROFILE.location}</span> &nbsp;·&nbsp;
      <span>${PROFILE.links}</span>
    </p>
  `;

  BLOCKS.filter((b) => b.enabled).forEach((block) => {
    html += `<div class="r-section"><h2 class="r-section-title">${block.label}</h2>`;
    html += renderSection(block);
    html += `</div>`;
  });

  paper.innerHTML = html;
}

function renderSection(block) {
  const d = block.data;
  switch (block.type) {
    case "summary":
      return `<p class="r-summary">${d.text}</p>`;

    case "experience":
      return d.items.map((it) => `
        <div class="r-item">
          <div class="r-item-head">
            <div><span class="r-role">${it.role}</span>, <span class="r-org">${it.org}</span></div>
            <span class="r-dates">${it.dates}</span>
          </div>
          <ul class="r-points">${it.points.map((p) => `<li>${p}</li>`).join("")}</ul>
        </div>
      `).join("");

    case "skills":
      return `<div class="r-skills">${d.groups.map((g) => `
        <div class="r-skill-row">
          <span class="r-skill-name">${g.name}</span>
          <span class="r-skill-items">${g.items}</span>
        </div>
      `).join("")}</div>`;

    case "education":
      return d.items.map((it) => `
        <div class="r-item">
          <div class="r-item-head">
            <div><span class="r-role">${it.school}</span></div>
            <span class="r-dates">${it.dates}</span>
          </div>
          <p class="r-detail">${it.degree}${it.detail ? " — " + it.detail : ""}</p>
        </div>
      `).join("");

    case "projects":
      return d.items.map((it) => `
        <div class="r-item">
          <div class="r-item-head"><span class="r-role">${it.name}</span></div>
          <p class="r-detail">${it.detail}</p>
        </div>
      `).join("");

    default:
      return "";
  }
}

// ---------- Export PDF ----------
$("#printBtn").addEventListener("click", () => {
  // Make sure the builder view is showing before printing.
  $$(".tab").forEach((t) => t.classList.toggle("is-active", t.dataset.view === "builder"));
  $$(".view").forEach((v) => v.classList.remove("is-active"));
  $("#view-builder").classList.add("is-active");
  window.print();
});

// ============================================================
// ATS modal
// ============================================================
function renderATS() {
  const r = ATS_RESULT;
  $("#atsBody").innerHTML = `
    <div class="ats-score">
      <div class="ats-ring" style="--pct:${r.score}"><span>${r.score}</span></div>
      <div class="ats-score-text">
        <h3>Strong match</h3>
        <p>Your resume covers most of what this posting asks for.</p>
      </div>
    </div>
    <div class="ats-group">
      <h4>Keywords found</h4>
      <div class="tag-row">${r.matched.map((k) => `<span class="tag tag-yes">${k}</span>`).join("")}</div>
    </div>
    <div class="ats-group">
      <h4>Missing from the posting</h4>
      <div class="tag-row">${r.missing.map((k) => `<span class="tag tag-no">${k}</span>`).join("")}</div>
    </div>
    <div class="ats-group">
      <h4>Suggestions</h4>
      <ul class="ats-tips">${r.tips.map((t) => `<li>${t}</li>`).join("")}</ul>
    </div>
  `;
}
$("#atsBtn").addEventListener("click", () => { renderATS(); openModal("#atsModal"); });
$("#atsClose").addEventListener("click", () => closeModal("#atsModal"));

// ============================================================
// TRACKER
// ============================================================
const STATUS_CLASS = {
  Applied: "applied", Interview: "interview", Waitlist: "waitlist",
  Hold: "hold", Accepted: "accepted", Rejected: "rejected", Declined: "declined",
};

function resumeName(id) {
  const r = RESUMES.find((x) => x.id === id);
  return r ? r.name : "—";
}
function fmtDate(iso) {
  const d = new Date(iso + "T00:00:00");
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

function renderTracker() {
  const body = $("#appsBody");
  body.innerHTML = APPLICATIONS.map((a) => {
    const cls = a.custom ? "custom" : (STATUS_CLASS[a.status] || "custom");
    return `
      <tr>
        <td class="app-employer">${a.employer}</td>
        <td>${a.role}</td>
        <td><span class="status status-${cls}">${a.status}</span></td>
        <td class="app-resume">${resumeName(a.resumeId)}</td>
        <td class="app-date">${fmtDate(a.applied)}</td>
        <td><button class="row-del" data-id="${a.id}">Delete</button></td>
      </tr>
    `;
  }).join("");

  $("#trackerCount").textContent = `${APPLICATIONS.length} applications tracked`;
  renderStats();
}

function renderStats() {
  const total = APPLICATIONS.length;
  const active = APPLICATIONS.filter((a) => ["Applied", "Interview", "Waitlist", "Hold"].includes(a.status) || a.custom).length;
  const interviews = APPLICATIONS.filter((a) => a.status === "Interview").length;
  const offers = APPLICATIONS.filter((a) => a.status === "Accepted").length;
  const stats = [
    { num: total, label: "Total" },
    { num: active, label: "In progress" },
    { num: interviews, label: "Interviews" },
    { num: offers, label: "Offers" },
  ];
  $("#statRow").innerHTML = stats.map((s) => `
    <div class="stat"><div class="stat-num">${s.num}</div><div class="stat-label">${s.label}</div></div>
  `).join("");
}

// ---------- Delete ----------
$("#appsBody").addEventListener("click", (e) => {
  const btn = e.target.closest(".row-del");
  if (!btn) return;
  APPLICATIONS = APPLICATIONS.filter((a) => a.id !== btn.dataset.id);
  renderTracker();
});

// ---------- Add application modal ----------
function fillResumeSelect() {
  $("#fResume").innerHTML = RESUMES.map((r) => `<option value="${r.id}">${r.name}</option>`).join("");
}

$("#addAppBtn").addEventListener("click", () => {
  $("#fEmployer").value = "";
  $("#fRole").value = "";
  $("#fStatus").value = "Applied";
  $("#fCustom").value = "";
  $("#customWrap").hidden = true;
  fillResumeSelect();
  openModal("#appModal");
});

$("#fStatus").addEventListener("change", (e) => {
  $("#customWrap").hidden = e.target.value !== "__custom";
});

$("#appSave").addEventListener("click", () => {
  const employer = $("#fEmployer").value.trim() || "Untitled";
  const role = $("#fRole").value.trim() || "—";
  const statusSel = $("#fStatus").value;
  const isCustom = statusSel === "__custom";
  const status = isCustom ? ($("#fCustom").value.trim() || "Custom") : statusSel;
  APPLICATIONS.unshift({
    id: "a" + Date.now(),
    employer, role, status,
    resumeId: $("#fResume").value,
    applied: new Date().toISOString().slice(0, 10),
    custom: isCustom,
  });
  closeModal("#appModal");
  renderTracker();
});

$("#appCancel").addEventListener("click", () => closeModal("#appModal"));
$("#appClose").addEventListener("click", () => closeModal("#appModal"));

// ============================================================
// Modal helpers
// ============================================================
function openModal(sel) { $(sel).hidden = false; }
function closeModal(sel) { $(sel).hidden = true; }
$$(".modal-backdrop").forEach((bd) => {
  bd.addEventListener("click", (e) => { if (e.target === bd) bd.hidden = true; });
});
document.addEventListener("keydown", (e) => {
  if (e.key === "Escape") $$(".modal-backdrop").forEach((bd) => (bd.hidden = true));
});

// ============================================================
// Init
// ============================================================
renderBlockList();
renderResume();
renderTracker();
