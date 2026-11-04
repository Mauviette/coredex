const STATES = ["todo", "doing", "done"];

let ISLANDS = [];
// Source de vérité unique : ce que renvoie le serveur (/api/progress).
let STATE = { progress: {}, order: null, notes: {} };

function getNote(islandId) {
  return STATE.notes?.[islandId] || "";
}

function setNote(islandId, text) {
  if (!STATE.notes) STATE.notes = {};
  STATE.notes[islandId] = text;
}

function getStatus(islandId, objectiveId) {
  return STATE.progress[islandId]?.[objectiveId] || "todo";
}

function setStatus(islandId, objectiveId, status) {
  if (!STATE.progress[islandId]) STATE.progress[islandId] = {};
  STATE.progress[islandId][objectiveId] = status;
}

function nextState(current) {
  const idx = STATES.indexOf(current);
  return STATES[(idx + 1) % STATES.length];
}

function statusIconSrc(status) {
  if (status === "todo") return "x.png";
  if (status === "done") return "v.png";
  return null;
}

function updateStatusIcon(card, status) {
  const existing = card.querySelector(".status-icon");
  const src = statusIconSrc(status);
  if (!src) {
    if (existing) existing.remove();
    return;
  }
  if (existing) {
    existing.src = src;
  } else {
    const img = document.createElement("img");
    img.className = "status-icon";
    img.src = src;
    img.alt = "";
    card.appendChild(img);
  }
}

// L'ordre d'affichage va du haut vers le bas : order[0] = île du haut, dernier = île du bas.
function getOrder() {
  const ids = ISLANDS.map((i) => i.id);
  const saved = STATE.order;
  if (!Array.isArray(saved)) {
    return ids.slice().reverse();
  }
  const filtered = saved.filter((id) => ids.includes(id));
  const missing = ids.filter((id) => !filtered.includes(id));
  return [...filtered, ...missing];
}

function setSyncStatus(text) {
  const el = document.getElementById("sync-status");
  if (el) el.textContent = text;
}

async function persist() {
  setSyncStatus("Enregistrement…");
  try {
    const res = await fetch("/api/progress", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(STATE),
    });
    if (!res.ok) throw new Error((await res.json()).error || res.statusText);
    setSyncStatus("Enregistré");
  } catch (err) {
    setSyncStatus("Erreur de sauvegarde");
    console.error("Échec de la sauvegarde :", err);
  }
}

function moveIsland(islandId, direction) {
  const order = getOrder();
  const idx = order.indexOf(islandId);
  const swapIdx = idx + direction;
  if (idx === -1 || swapIdx < 0 || swapIdx >= order.length) return;
  [order[idx], order[swapIdx]] = [order[swapIdx], order[idx]];
  STATE.order = order;
  persist();
  render();
}

function renderIsland(island, position, total) {
  const section = document.createElement("section");
  section.className = "island-section";

  const upBtn = document.createElement("button");
  upBtn.className = "order-arrow";
  upBtn.textContent = "▲";
  upBtn.title = "Monter l'île";
  upBtn.disabled = position === 0;
  upBtn.addEventListener("click", () => moveIsland(island.id, -1));

  const downBtn = document.createElement("button");
  downBtn.className = "order-arrow";
  downBtn.textContent = "▼";
  downBtn.title = "Descendre l'île";
  downBtn.disabled = position === total - 1;
  downBtn.addEventListener("click", () => moveIsland(island.id, 1));

  const imgLink = document.createElement("a");
  imgLink.className = "island-image-link";
  imgLink.href = island.link || "#";
  imgLink.target = "_blank";
  imgLink.rel = "noopener";
  imgLink.innerHTML = `<img src="${island.image}" alt="${island.name}" loading="lazy" />`;

  const left = document.createElement("div");
  left.className = "island-left";
  left.appendChild(upBtn);
  left.appendChild(imgLink);
  left.appendChild(downBtn);

  const right = document.createElement("div");
  right.className = "island-right";

  island.objectives.forEach((obj) => {
    const card = document.createElement("a");
    card.className = "objective-card";
    card.href = obj.link || "#";
    card.target = "_blank";
    card.rel = "noopener";
    card.dataset.islandId = island.id;
    card.dataset.objectiveId = obj.id;
    card.title = obj.name;

    const status = getStatus(island.id, obj.id);
    if (status !== "todo") card.classList.add(status);

    const extra = obj.additional_img
      ? `<img class="objective-extra" src="${obj.additional_img}" alt="" />`
      : "";
    card.innerHTML = `<img src="${obj.image}" alt="${obj.name}" loading="lazy" />${extra}`;
    updateStatusIcon(card, status);

    card.addEventListener("click", (e) => {
      if (e.shiftKey) return; // laisse le navigateur ouvrir le lien
      e.preventDefault();
      const next = nextState(getStatus(island.id, obj.id));
      setStatus(island.id, obj.id, next);
      persist();

      card.classList.remove("doing", "done");
      if (next !== "todo") card.classList.add(next);
      updateStatusIcon(card, next);
    });

    right.appendChild(card);
  });

  const notes = document.createElement("textarea");
  notes.className = "island-notes";
  notes.placeholder = "Notes…";
  notes.value = getNote(island.id);
  let noteTimer = null;
  notes.addEventListener("input", () => {
    setNote(island.id, notes.value);
    clearTimeout(noteTimer);
    noteTimer = setTimeout(persist, 500);
  });
  notes.addEventListener("blur", () => {
    clearTimeout(noteTimer);
    persist();
  });

  section.appendChild(left);
  section.appendChild(right);
  section.appendChild(notes);
  return section;
}

function render(scrollToBottom) {
  const container = document.getElementById("islands-container");
  container.innerHTML = "";

  const order = getOrder();
  const byId = Object.fromEntries(ISLANDS.map((i) => [i.id, i]));

  order.forEach((id, idx) => {
    const island = byId[id];
    if (!island) return;
    container.appendChild(renderIsland(island, idx, order.length));
  });

  if (scrollToBottom) container.scrollTop = container.scrollHeight;
}

async function init() {
  const container = document.getElementById("islands-container");
  try {
    const res = await fetch("data/islands.json");
    ISLANDS = await res.json();
  } catch (err) {
    container.innerHTML = `<p class="loading">Erreur de chargement des données : ${err}</p>`;
    return;
  }

  try {
    setSyncStatus("Chargement…");
    const res = await fetch("/api/progress");
    if (!res.ok) throw new Error((await res.json()).error || res.statusText);
    const data = await res.json();
    STATE = { progress: data.progress || {}, order: data.order || null, notes: data.notes || {} };
    setSyncStatus("Enregistré");
  } catch (err) {
    setSyncStatus("Erreur de connexion au stockage");
    console.error("Échec du chargement de la progression :", err);
  }

  render(true);
}

document.getElementById("export-btn").addEventListener("click", () => {
  const data = JSON.stringify(STATE, null, 2);
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
    STATE = { progress: imported.progress || {}, order: imported.order || null, notes: imported.notes || {} };
    await persist();
    render(false);
  } catch (err) {
    alert("Fichier invalide : " + err);
  } finally {
    e.target.value = "";
  }
});

init();
