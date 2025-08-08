// app.js
import { computeScore, compare } from './scoring.js';
import { renderTable, buildNewRatingIssueUrl, buildWeightsIssue } from './ui.js';

// >>>> SET THIS TO "your-github-username/your-repo"
const REPO = "Ilye5/London-Property-Search";

const rowsEl = document.getElementById("rows");
const lastUpdatedEl = document.getElementById("lastUpdated");
const sortByEl = document.getElementById("sortBy");
const minBedsEl = document.getElementById("minBeds");
const tenureFilterEl = document.getElementById("tenureFilter");
const refreshBtn = document.getElementById("refreshBtn");
const newRatingBtn = document.getElementById("newRatingBtn");
const weightsDialog = document.getElementById("weightsDialog");
const weightsForm = document.getElementById("weightsForm");
const editWeightsBtn = document.getElementById("editWeightsBtn");
const saveWeightsBtn = document.getElementById("saveWeightsBtn");

let state = {
  config: null,
  items: [],
  timer: null
};

async function loadJson(path) {
  const url = path.startsWith("http") ? path : `${path}?_=${Date.now()}`;
  const r = await fetch(url, { cache: "no-store" });
  if (!r.ok) throw new Error(`Failed to load ${path}: ${r.status}`);
  return r.json();
}

async function loadData() {
  const [cfg, props] = await Promise.all([
    loadJson("./data/config.json"),
    loadJson("./data/properties.json").catch(() => [])
  ]);
  state.config = cfg;
  // compute scores
  const scored = props.map(p => ({ ...p, score: computeScore(p, cfg) }));
  state.items = scored;
  lastUpdatedEl.textContent = `Updated ${new Date().toLocaleString("en-GB")}`;
  applyRender();
}

function applyRender() {
  const key = sortByEl.value;
  const minBeds = Number(minBedsEl.value || 0);
  const tenureMode = tenureFilterEl.value;

  let filtered = state.items.filter(x => (x.bedrooms ?? 0) >= minBeds);
  if (tenureMode === "freehold_only") {
    filtered = filtered.filter(x => (x.tenure || "").toLowerCase() === "freehold");
  } else if (tenureMode === "share_or_freehold") {
    filtered = filtered.filter(x => ["freehold","share of freehold"].includes((x.tenure||"").toLowerCase()));
  }

  // Derived fields for sorting
  filtered = filtered.map(x => ({
    ...x,
    viewing_date: x.viewing_date ? new Date(x.viewing_date).getTime() : null
  }));

  filtered.sort((a, b) => compare(a, b, key));
  renderTable(rowsEl, filtered);
}

function openWeightsModal() {
  // build inputs for weights
  const w = state.config.weights;
  const fields = Object.keys(w);
  weightsForm.innerHTML = fields.map(f => `
    <label class="block">
      <span class="text-sm">${f}</span>
      <input data-key="${f}" type="number" step="0.01" value="${w[f]}" class="mt-1 w-full border rounded p-2" />
    </label>
  `).join('') + `
    <p class="text-xs text-slate-500 mt-2">Weights are combined then normalised to a 0–10 score for display.</p>
  `;
  weightsDialog.showModal();
}

function saveWeightsViaIssue() {
  // collect
  const inputs = weightsForm.querySelectorAll("input[data-key]");
  const cfg = JSON.parse(JSON.stringify(state.config));
  inputs.forEach(inp => {
    const k = inp.getAttribute("data-key");
    cfg.weights[k] = Number(inp.value);
  });
  // Open an issue link to request config update
  const url = buildWeightsIssue(REPO, cfg);
  window.open(url, "_blank");
}

function startPolling() {
  if (state.timer) clearInterval(state.timer);
  state.timer = setInterval(loadData, 30000); // 30s
}

// Events
refreshBtn.addEventListener("click", loadData);
sortByEl.addEventListener("change", applyRender);
minBedsEl.addEventListener("input", applyRender);
tenureFilterEl.addEventListener("change", applyRender);
editWeightsBtn.addEventListener("click", openWeightsModal);
saveWeightsBtn.addEventListener("click", (e) => {
  e.preventDefault();
  saveWeightsViaIssue();
});

function init() {
  newRatingBtn.href = buildNewRatingIssueUrl(REPO, "rating.md", {});
  loadData().catch(err => {
    console.error(err);
    lastUpdatedEl.textContent = "Failed to load data.";
  });
  startPolling();
}

init();
