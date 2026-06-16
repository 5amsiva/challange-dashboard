const DAY = 24 * 60 * 60 * 1000;
const CATEGORIES = ["Micro Challenge", "Weekly Challenge", "Monthly Challenge"];
const SKILLS = ["Programming", "Fitness", "Language", "Creativity", "Productivity", "Lifestyle", "Custom"];
const DIFFICULTIES = ["Easy", "Medium", "Hard"];
const STATUSES = ["Not Started", "In Progress", "Completed", "Expired"];
const SORTS = ["Newest", "Oldest", "Closest Deadline", "Furthest Deadline", "Highest Progress", "Lowest Progress"];

const state = {
  data: null,
  settings: null,
  filters: { search: "", category: "All", difficulty: "All", skill: "All", status: "All", sort: "Newest" },
  deferredPrompt: null
};

document.addEventListener("DOMContentLoaded", init);

function init() {
  state.data = Store.loadData() || sampleData();
  state.settings = { theme: "system", ...Store.loadSettings() };
  applyTheme(resolveTheme());
  seedFilters();
  bindEvents();
  registerServiceWorker();
  updateDerivedState();
  render();
}

function sampleData() {
  const today = dateKey(new Date());
  const add = (days) => dateKey(new Date(Date.now() + days * DAY));
  const sub = (days) => dateKey(new Date(Date.now() - days * DAY));

  return {
    challenges: [
      challenge("Learn Whistling in 2 Days", "Practice breath control, tone, and short melodies.", "Micro Challenge", "Creativity", "Easy", sub(1), add(1), 10, 4, [sub(1), today]),
      challenge("Learn Git in 1 Week", "Practice commits, branches, merges, pull requests, and conflict resolution.", "Weekly Challenge", "Programming", "Medium", sub(2), add(5), 14, 7, [sub(2), sub(1), today]),
      challenge("Build a Portfolio Website", "Design, build, and publish a professional portfolio with case studies.", "Monthly Challenge", "Programming", "Hard", sub(8), add(22), 30, 9, [sub(8), sub(7), sub(6), today]),
      challenge("Learn Python in 30 Days", "Move from syntax to scripts, data structures, and a useful automation project.", "Monthly Challenge", "Programming", "Medium", sub(30), today, 30, 30, Array.from({ length: 30 }, (_, i) => sub(29 - i)))
    ],
    roadmaps: [
      {
        id: uid(),
        name: "AI Engineer Roadmap",
        createdAt: new Date().toISOString(),
        steps: ["Learn Git", "Learn Python", "Learn NumPy", "Learn Machine Learning", "Build AI Project"].map((title, index) => ({
          id: uid(),
          title,
          completed: index < 2
        }))
      }
    ],
    achievements: []
  };
}

function challenge(name, description, category, skillType, difficulty, startDate, targetDate, totalMilestones, completedMilestones, progressDates) {
  return {
    id: uid(),
    name,
    description,
    category,
    skillType,
    difficulty,
    startDate,
    targetDate,
    totalMilestones,
    completedMilestones,
    progressDates,
    currentStreak: 0,
    longestStreak: 0,
    status: "Not Started",
    createdAt: new Date().toISOString()
  };
}

function bindEvents() {
  $("#addChallengeBtn").addEventListener("click", () => openDialog("#challengeDialog"));
  $("#addRoadmapBtn").addEventListener("click", () => openDialog("#roadmapDialog"));
  $("#sideRoadmapBtn").addEventListener("click", () => openDialog("#roadmapDialog"));
  $$(".close-dialog").forEach((btn) => btn.addEventListener("click", () => btn.closest("dialog").close()));

  $("#themeBtn").addEventListener("click", () => {
    state.settings.theme = document.documentElement.dataset.theme === "dark" ? "light" : "dark";
    Store.saveSettings(state.settings);
    applyTheme(state.settings.theme);
  });

  $("#challengeForm").addEventListener("submit", onChallengeSubmit);
  $("#roadmapForm").addEventListener("submit", onRoadmapSubmit);
  $("#searchInput").addEventListener("input", (event) => {
    state.filters.search = event.target.value.trim().toLowerCase();
    renderChallenges();
  });

  [
    ["#categoryFilter", "category"],
    ["#difficultyFilter", "difficulty"],
    ["#skillFilter", "skill"],
    ["#statusFilter", "status"],
    ["#sortSelect", "sort"]
  ].forEach(([selector, key]) => {
    $(selector).addEventListener("change", (event) => {
      state.filters[key] = event.target.value;
      renderChallenges();
    });
  });

  document.addEventListener("click", onAction);
  window.addEventListener("beforeinstallprompt", (event) => {
    event.preventDefault();
    state.deferredPrompt = event;
    $("#installBtn").hidden = false;
  });
  $("#installBtn").addEventListener("click", installApp);
}

function seedFilters() {
  options("#categoryFilter", ["All", ...CATEGORIES]);
  options("#difficultyFilter", ["All", ...DIFFICULTIES]);
  options("#skillFilter", ["All", ...SKILLS]);
  options("#statusFilter", ["All", ...STATUSES]);
  options("#sortSelect", SORTS);
}

function onChallengeSubmit(event) {
  event.preventDefault();
  const data = new FormData(event.currentTarget);
  const startDate = data.get("startDate");
  const targetDate = data.get("targetDate");

  if (new Date(`${targetDate}T00:00:00`) < new Date(`${startDate}T00:00:00`)) {
    toast("Target date must be on or after the start date.");
    return;
  }

  state.data.challenges.unshift(challenge(
    data.get("name").trim(),
    data.get("description").trim(),
    data.get("category"),
    data.get("skillType"),
    data.get("difficulty"),
    startDate,
    targetDate,
    Number(data.get("totalMilestones")),
    0,
    []
  ));

  event.currentTarget.reset();
  $("#challengeDialog").close();
  persistAndRender("Challenge created.");
}

function onRoadmapSubmit(event) {
  event.preventDefault();
  const data = new FormData(event.currentTarget);
  const steps = data.get("steps").split("\n").map((step) => step.trim()).filter(Boolean);
  if (!steps.length) return toast("Add at least one roadmap step.");

  state.data.roadmaps.unshift({
    id: uid(),
    name: data.get("name").trim(),
    createdAt: new Date().toISOString(),
    steps: steps.map((title) => ({ id: uid(), title, completed: false }))
  });

  event.currentTarget.reset();
  $("#roadmapDialog").close();
  persistAndRender("Roadmap created.");
}

function onAction(event) {
  const action = event.target.closest("[data-action]");
  if (!action) return;

  const id = action.dataset.id;
  if (action.dataset.action === "plus") changeMilestone(id, 1);
  if (action.dataset.action === "minus") changeMilestone(id, -1);
  if (action.dataset.action === "delete-challenge") deleteChallenge(id);
  if (action.dataset.action === "delete-roadmap") deleteRoadmap(id);
  if (action.dataset.action === "toggle-step") toggleStep(id, action.dataset.stepId);
}

function changeMilestone(id, delta) {
  const item = state.data.challenges.find((challenge) => challenge.id === id);
  if (!item) return;
  const next = Math.min(item.totalMilestones, Math.max(0, item.completedMilestones + delta));
  if (next === item.completedMilestones) return;

  item.completedMilestones = next;
  if (delta > 0) {
    const today = dateKey(new Date());
    if (!item.progressDates.includes(today)) item.progressDates.push(today);
  }
  persistAndRender(delta > 0 ? "Milestone recorded." : "Milestone adjusted.");
}

function deleteChallenge(id) {
  if (!confirm("Delete this challenge? This cannot be undone.")) return;
  state.data.challenges = state.data.challenges.filter((challenge) => challenge.id !== id);
  persistAndRender("Challenge deleted.");
}

function deleteRoadmap(id) {
  if (!confirm("Delete this roadmap? This cannot be undone.")) return;
  state.data.roadmaps = state.data.roadmaps.filter((roadmap) => roadmap.id !== id);
  persistAndRender("Roadmap deleted.");
}

function toggleStep(roadmapId, stepId) {
  const roadmap = state.data.roadmaps.find((item) => item.id === roadmapId);
  const step = roadmap?.steps.find((item) => item.id === stepId);
  if (!step) return;
  step.completed = !step.completed;
  persistAndRender();
}

function persistAndRender(message) {
  updateDerivedState();
  Store.saveData(state.data);
  render();
  if (message) toast(message);
}

function updateDerivedState() {
  state.data.challenges.forEach((item) => {
    recalcStreak(item);
    updateStatus(item);
  });
  state.data.achievements = achievements().filter((achievement) => achievement.unlocked()).map((achievement) => achievement.id);
  Store.saveData(state.data);
}

function recalcStreak(item) {
  const dates = [...new Set(item.progressDates)].sort();
  let streak = 0;
  let longest = 0;
  let previous = null;
  dates.forEach((date) => {
    streak = !previous || daysBetween(previous, date) === 1 ? streak + 1 : 1;
    longest = Math.max(longest, streak);
    previous = date;
  });

  const last = dates.at(-1);
  const today = dateKey(new Date());
  const yesterday = dateKey(new Date(Date.now() - DAY));
  item.currentStreak = last === today || last === yesterday ? streak : 0;
  item.longestStreak = Math.max(item.longestStreak || 0, longest);
}

function updateStatus(item) {
  const today = startOfDay(new Date());
  const start = startOfDay(new Date(`${item.startDate}T00:00:00`));
  const target = startOfDay(new Date(`${item.targetDate}T00:00:00`));
  if (item.completedMilestones >= item.totalMilestones) item.status = "Completed";
  else if (today > target) item.status = "Expired";
  else if (today < start || item.completedMilestones === 0) item.status = "Not Started";
  else item.status = "In Progress";
}

function render() {
  renderStats();
  renderChallenges();
  renderAchievements();
  renderRoadmaps();
}

function renderStats() {
  const total = state.data.challenges.length;
  const completed = state.data.challenges.filter((item) => item.status === "Completed").length;
  const active = state.data.challenges.filter((item) => item.status === "In Progress").length;
  $("#totalStat").textContent = total;
  $("#activeStat").textContent = active;
  $("#completedStat").textContent = completed;
  $("#currentStreakStat").textContent = globalCurrentStreak();
  $("#longestStreakStat").textContent = Math.max(0, ...state.data.challenges.map((item) => item.longestStreak || 0), globalLongestStreak());
  $("#rateStat").textContent = total ? `${Math.round((completed / total) * 100)}%` : "0%";
}

function renderChallenges() {
  const groups = Object.fromEntries(CATEGORIES.map((category) => [category, []]));
  filteredChallenges().forEach((item) => groups[item.category].push(item));
  renderGroup("#microList", "#microCount", groups["Micro Challenge"]);
  renderGroup("#weeklyList", "#weeklyCount", groups["Weekly Challenge"]);
  renderGroup("#monthlyList", "#monthlyCount", groups["Monthly Challenge"]);
}

function renderGroup(listSelector, countSelector, items) {
  $(countSelector).textContent = items.length;
  $(listSelector).innerHTML = items.length ? items.map(card).join("") : empty("No matching challenges yet.");
}

function filteredChallenges() {
  return state.data.challenges
    .filter((item) => {
      const searchable = `${item.name} ${item.description} ${item.skillType}`.toLowerCase();
      return (!state.filters.search || searchable.includes(state.filters.search))
        && (state.filters.category === "All" || item.category === state.filters.category)
        && (state.filters.difficulty === "All" || item.difficulty === state.filters.difficulty)
        && (state.filters.skill === "All" || item.skillType === state.filters.skill)
        && (state.filters.status === "All" || item.status === state.filters.status);
    })
    .sort(sortBySelected);
}

function sortBySelected(a, b) {
  const sorters = {
    Newest: () => new Date(b.createdAt) - new Date(a.createdAt),
    Oldest: () => new Date(a.createdAt) - new Date(b.createdAt),
    "Closest Deadline": () => new Date(a.targetDate) - new Date(b.targetDate),
    "Furthest Deadline": () => new Date(b.targetDate) - new Date(a.targetDate),
    "Highest Progress": () => progress(b) - progress(a),
    "Lowest Progress": () => progress(a) - progress(b)
  };
  return sorters[state.filters.sort]();
}

function card(item) {
  const pct = progress(item);
  return `
    <article class="card status-${slug(item.status)}">
      <div class="card-top"><span>${escapeHtml(item.status)}</span><button class="delete-btn" data-action="delete-challenge" data-id="${item.id}" aria-label="Delete ${escapeHtml(item.name)}">×</button></div>
      <h3>${escapeHtml(item.name)}</h3>
      <p>${escapeHtml(item.description)}</p>
      <div class="badges">
        <span class="badge">${escapeHtml(item.category)}</span>
        <span class="badge skill">${escapeHtml(item.skillType)}</span>
        <span class="badge ${item.difficulty.toLowerCase()}">${escapeHtml(item.difficulty)}</span>
      </div>
      <div class="dates">
        <div><span>Start</span><strong>${formatDate(item.startDate)}</strong></div>
        <div><span>Target</span><strong>${formatDate(item.targetDate)}</strong></div>
      </div>
      <div>
        <div class="progress-label"><span>${item.completedMilestones} / ${item.totalMilestones} milestones</span><strong>${pct}%</strong></div>
        <div class="progress" aria-label="${pct}% complete"><span style="width:${pct}%"></span></div>
      </div>
      <div class="milestones">
        <button type="button" data-action="minus" data-id="${item.id}">- Milestone</button>
        <button type="button" data-action="plus" data-id="${item.id}">+ Milestone</button>
      </div>
      <div class="meta-row"><span>🔥 ${item.currentStreak || 0} Days</span><span>Best: ${item.longestStreak || 0} Days</span></div>
    </article>`;
}

function renderAchievements() {
  $("#achievementList").innerHTML = achievements().map((item) => {
    const unlocked = state.data.achievements.includes(item.id);
    return `<article class="achievement ${unlocked ? "unlocked" : "locked"}"><span class="achievement-icon">🏆</span><div><strong>${item.name}</strong><p>${item.description}</p></div></article>`;
  }).join("");
}

function achievements() {
  const completed = state.data.challenges.filter((item) => item.status === "Completed");
  const programming = completed.filter((item) => item.skillType === "Programming").length;
  const longest = Math.max(0, ...state.data.challenges.map((item) => item.longestStreak || 0), globalLongestStreak());
  return [
    { id: "first-created", name: "First Challenge Created", description: "Create your first challenge.", unlocked: () => state.data.challenges.length >= 1 },
    { id: "first-completed", name: "First Challenge Completed", description: "Complete any challenge.", unlocked: () => completed.length >= 1 },
    { id: "seven-streak", name: "7 Day Streak", description: "Reach a 7 day streak.", unlocked: () => longest >= 7 },
    { id: "thirty-streak", name: "30 Day Streak", description: "Reach a 30 day streak.", unlocked: () => longest >= 30 },
    { id: "ten-completed", name: "10 Challenges Completed", description: "Complete 10 challenges.", unlocked: () => completed.length >= 10 },
    { id: "programming-master", name: "Programming Master", description: "Complete 5 programming challenges.", unlocked: () => programming >= 5 },
    { id: "consistency-king", name: "Consistency King", description: "Record progress for 30 consecutive days.", unlocked: () => globalLongestStreak() >= 30 }
  ];
}

function renderRoadmaps() {
  $("#roadmapList").innerHTML = state.data.roadmaps.length ? state.data.roadmaps.map((roadmap) => {
    const done = roadmap.steps.filter((step) => step.completed).length;
    const pct = roadmap.steps.length ? Math.round((done / roadmap.steps.length) * 100) : 0;
    return `<article class="roadmap">
      <div class="roadmap-head"><div><h3>${escapeHtml(roadmap.name)}</h3><p>${done} / ${roadmap.steps.length} steps • ${pct}%</p></div><button class="delete-btn" data-action="delete-roadmap" data-id="${roadmap.id}" aria-label="Delete ${escapeHtml(roadmap.name)}">×</button></div>
      <div class="progress"><span style="width:${pct}%"></span></div>
      <div class="steps">${roadmap.steps.map((step) => `<label><input type="checkbox" ${step.completed ? "checked" : ""} data-action="toggle-step" data-id="${roadmap.id}" data-step-id="${step.id}" />${escapeHtml(step.title)}</label>`).join("")}</div>
    </article>`;
  }).join("") : empty("Create a roadmap to organize a longer learning path.");
}

function globalCurrentStreak() {
  const set = new Set(allProgressDates());
  let count = 0;
  let cursor = startOfDay(new Date());
  while (set.has(dateKey(cursor))) {
    count += 1;
    cursor = new Date(cursor.getTime() - DAY);
  }
  return count;
}

function globalLongestStreak() {
  let longest = 0;
  let streak = 0;
  let previous = null;
  allProgressDates().forEach((date) => {
    streak = !previous || daysBetween(previous, date) === 1 ? streak + 1 : 1;
    longest = Math.max(longest, streak);
    previous = date;
  });
  return longest;
}

function allProgressDates() {
  return [...new Set(state.data.challenges.flatMap((item) => item.progressDates || []))].sort();
}

function registerServiceWorker() {
  if (!("serviceWorker" in navigator)) return;
  navigator.serviceWorker.register("./sw.js").catch(() => {
    toast("Offline support could not be registered in this browser.");
  });
}

async function installApp() {
  if (!state.deferredPrompt) return;
  state.deferredPrompt.prompt();
  await state.deferredPrompt.userChoice;
  state.deferredPrompt = null;
  $("#installBtn").hidden = true;
}

function openDialog(selector) {
  const dialog = $(selector);
  if (dialog.showModal) dialog.showModal();
  else dialog.setAttribute("open", "");
}

function applyTheme(theme) {
  document.documentElement.dataset.theme = theme;
  $("#themeBtn").textContent = theme === "dark" ? "☀" : "☾";
}

function resolveTheme() {
  if (state.settings.theme === "system") return matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
  return state.settings.theme;
}

function options(selector, values) {
  $(selector).innerHTML = values.map((value) => `<option>${value}</option>`).join("");
}

function progress(item) {
  return Math.round((item.completedMilestones / item.totalMilestones) * 100);
}

function toast(message) {
  const node = document.createElement("div");
  node.className = "toast";
  node.textContent = message;
  $("#toastRegion").appendChild(node);
  setTimeout(() => node.remove(), 2800);
}

function empty(message) {
  return `<div class="empty"><p>${message}</p></div>`;
}

function formatDate(value) {
  return new Intl.DateTimeFormat(undefined, { month: "short", day: "numeric", year: "numeric" }).format(new Date(`${value}T00:00:00`));
}

function dateKey(date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

function startOfDay(date) {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

function daysBetween(a, b) {
  return Math.round((new Date(`${b}T00:00:00`) - new Date(`${a}T00:00:00`)) / DAY);
}

function slug(value) {
  return value.toLowerCase().replace(/\s+/g, "-");
}

function uid() {
  return globalThis.crypto?.randomUUID ? globalThis.crypto.randomUUID() : `id-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function escapeHtml(value) {
  return String(value).replace(/[&<>"']/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[char]));
}

function $(selector) {
  return document.querySelector(selector);
}

function $$(selector) {
  return [...document.querySelectorAll(selector)];
}
