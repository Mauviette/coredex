const STORAGE_KEY = "coredex-progress";
const STATES = ["todo", "doing", "done"];
const STATE_LABELS = { todo: "À faire", doing: "En cours", done: "Fait" };

function loadProgress() {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY)) || {};
  } catch {
    return {};
  }
}

function saveProgress(progress) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(progress));
}

function getStatus(progress, islandId, objectiveId) {
  return progress[islandId]?.[objectiveId] || "todo";
}

function setStatus(progress, islandId, objectiveId, status) {
  if (!progress[islandId]) progress[islandId] = {};
  progress[islandId][objectiveId] = status;
}

function nextState(current) {
  const idx = STATES.indexOf(current);
  return STATES[(idx + 1) % STATES.length];
}

function updateIslandProgressLabel(islandId, island) {
  const progress = loadProgress();
  const done = island.objectives.filter(
    (o) => getStatus(progress, islandId, o.id) === "done"
  ).length;
  const el = document.querySelector(`[data-island-progress="${islandId}"]`);
  if (el) el.textContent = `${done}/${island.objectives.length} faits`;
}

function renderIsland(island, progress) {
  const section = document.createElement("section");
  section.className = "island-section";

  const left = document.createElement("a");
  left.className = "island-left";
  left.href = island.link || "#";
  left.target = "_blank";
  left.rel = "noopener";
  left.innerHTML = `
    <img src="${island.image}" alt="${island.name}" loading="lazy" />
    <div class="island-name">${island.name}</div>
    <div class="island-progress" data-island-progress="${island.id}"></div>
  `;

  const right = document.createElement("div");
  right.className = "island-right";

  island.objectives.forEach((obj) => {
    const card = document.createElement("a");
    card.className = "objective-card" + (obj.type === "special" ? " special" : "");
    card.href = obj.link || "#";
    card.target = "_blank";
    card.rel = "noopener";
    card.dataset.islandId = island.id;
    card.dataset.objectiveId = obj.id;

    const status = getStatus(progress, island.id, obj.id);
    if (status !== "todo") card.classList.add(status);

    card.innerHTML = `
      <img src="${obj.image}" alt="${obj.name}" loading="lazy" />
      <div class="objective-name">${obj.name}</div>
      <div class="objective-badge">${STATE_LABELS[status]}</div>
    `;

    card.addEventListener("click", (e) => {
      if (e.ctrlKey || e.metaKey) return; // laisse le navigateur ouvrir le lien
      e.preventDefault();
      const current = getStatus(loadProgress(), island.id, obj.id);
      const next = nextState(current);
      const progress = loadProgress();
      setStatus(progress, island.id, obj.id, next);
      saveProgress(progress);

      card.classList.remove("doing", "done");
      if (next !== "todo") card.classList.add(next);
      card.querySelector(".objective-badge").textContent = STATE_LABELS[next];
      updateIslandProgressLabel(island.id, island);
    });

    right.appendChild(card);
  });

  section.appendChild(left);
  section.appendChild(right);
  return section;
}

async function init() {
  const container = document.getElementById("islands-container");
  let islands;
  try {
    const res = await fetch("data/islands.json");
    islands = await res.json();
  } catch (err) {
    container.innerHTML = `<p class="loading">Erreur de chargement des données : ${err}</p>`;
    return;
  }

  container.innerHTML = "";
  const progress = loadProgress();
  islands.forEach((island) => {
    container.appendChild(renderIsland(island, progress));
  });
  islands.forEach((island) => updateIslandProgressLabel(island.id, island));
}

document.getElementById("export-btn").addEventListener("click", () => {
  const data = JSON.stringify(loadProgress(), null, 2);
  const blob = new Blob([data], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = "coredex-progression.json";
  a.click();
  URL.revokeObjectURL(url);
});

document.getElementById("import-btn").addEventListener("click", () => {
  document.getElementById("import-input").click();
});

document.getElementById("import-input").addEventListener("change", async (e) => {
  const file = e.target.files[0];
  if (!file) return;
  try {
    const text = await file.text();
    const imported = JSON.parse(text);
    saveProgress(imported);
    init();
  } catch (err) {
    alert("Fichier invalide : " + err);
  } finally {
    e.target.value = "";
  }
});

init();
