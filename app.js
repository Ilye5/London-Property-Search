import { computeScore, compare } from './scoring.js';
import { renderTable, buildWeightsIssue } from './ui.js';

// >>> your repo
const REPO = "Ilye5/London-Property-Search";

// Elements
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

// Enrichment
const EH = {
  addr: document.getElementById('eh_addr'),
  go: document.getElementById('eh_go'),
  copy: document.getElementById('eh_copy'),
  out: document.getElementById('eh_out'),
  issue: document.getElementById('eh_issue')
};

let state = { config: null, items: [], timer: null };

function linkIssueFormAnchors() {
  const url = `https://github.com/${REPO}/issues/new?template=rating.yml`;
  if (newRatingBtn) newRatingBtn.href = url;
  if (EH.issue) EH.issue.href = url;
}

async function loadJson(path) {
  const url = path.startsWith("http") ? path : `${path}?_=${Date.now()}`;
  const r = await fetch(url, { cache: "no-store" });
  if (!r.ok) throw new Error(`Failed to load ${path}: ${r.status}`);
  return r.json();
}

async function loadData() {
  try {
    const [cfg, props] = await Promise.all([
      loadJson("./data/config.json"),
      loadJson("./data/properties.json").catch(() => [])
    ]);
    state.config = cfg;
    state.items = (props || []).map(p => ({ ...p, score: computeScore(p, cfg) }));
    lastUpdatedEl.textContent = `Updated ${new Date().toLocaleString("en-GB")}`;
    applyRender();
  } catch (e) {
    console.error(e);
    if (lastUpdatedEl) lastUpdatedEl.textContent = "Failed to load data.";
  }
}

function applyRender() {
  try {
    const key = sortByEl?.value ?? "score";
    const minBeds = Number(minBedsEl?.value || 0);
    const tenureMode = tenureFilterEl?.value || "any";

    let filtered = state.items.filter(x => (x.bedrooms ?? 0) >= minBeds);
    if (tenureMode === "freehold_only") {
      filtered = filtered.filter(x => (x.tenure || "").toLowerCase() === "freehold");
    } else if (tenureMode === "share_or_freehold") {
      filtered = filtered.filter(x => ["freehold","share of freehold"].includes((x.tenure||"").toLowerCase()));
    }

    filtered = filtered.map(x => ({
      ...x,
      viewing_date: x.viewing_date ? new Date(x.viewing_date).getTime() : null
    }));

    filtered.sort((a, b) => compare(a, b, key));
    renderTable(rowsEl, filtered);
  } catch (e) {
    console.error(e);
  }
}

function openWeightsModal() {
  const w = state.config?.weights || {};
  const fields = Object.keys(w);
  if (!fields.length) return;
  weightsForm.innerHTML = fields.map(f => `
    <label class="block">
      <span class="text-sm">${f}</span>
      <input data-key="${f}" type="number" step="0.01" value="${w[f]}" class="mt-1 w-full border rounded p-2" />
    </label>
  `).join('') + `<p class="text-xs text-slate-500 mt-2">Weights are combined then shown on a 0–10 scale.</p>`;
  weightsDialog.showModal();
}

function saveWeightsViaIssue(e) {
  e?.preventDefault?.();
  const inputs = weightsForm.querySelectorAll("input[data-key]");
  const cfg = JSON.parse(JSON.stringify(state.config));
  inputs.forEach(inp => {
    const k = inp.getAttribute("data-key");
    cfg.weights[k] = Number(inp.value);
  });
  const url = buildWeightsIssue(REPO, cfg);
  window.open(url, "_blank");
}

function startPolling() {
  if (state.timer) clearInterval(state.timer);
  state.timer = setInterval(loadData, 30000);
}

function wireEvents() {
  refreshBtn?.addEventListener("click", loadData);
  sortByEl?.addEventListener("change", applyRender);
  minBedsEl?.addEventListener("input", applyRender);
  tenureFilterEl?.addEventListener("change", applyRender);
  editWeightsBtn?.addEventListener("click", openWeightsModal);
  saveWeightsBtn?.addEventListener("click", saveWeightsViaIssue);

  // Enrichment
  const BANK = { lat: 51.5133, lon: -0.0898 };
  EH.go?.addEventListener('click', async () => {
    const q = (EH.addr?.value || '').trim();
    if (!q) { EH.out.textContent = 'Enter an address or postcode.'; return; }
    try {
      const geoUrl = `https://nominatim.openstreetmap.org/search?format=jsonv2&limit=1&q=${encodeURIComponent(q)}`;
      const g = await fetch(geoUrl, { headers: { 'Accept': 'application/json' }}).then(r => r.json());
      if (!g?.length) { EH.out.textContent = 'No geocoding match.'; return; }
      const { lat, lon, display_name } = g[0];

      const tubeUrl = `https://nominatim.openstreetmap.org/search?format=jsonv2&limit=5&q=${encodeURIComponent('Underground station')}&viewbox=${lon-0.02},${+lat+0.02},${+lon+0.02},${lat-0.02}&bounded=1`;
      const t = await fetch(tubeUrl).then(r => r.json());
      const nearest = (t||[]).map(s => ({
        name: (s.display_name||'').split(',')[0],
        dist_km: haversine(+lat, +lon, +s.lat, +s.lon)
      })).sort((a,b)=>a.dist_km-b.dist_km)[0];

      const distBankKm = haversine(+lat, +lon, BANK.lat, BANK.lon);
      EH.out.textContent =
`Copy into the Issue Form:
Nearest Tube: ${nearest?.name || '—'}
Nearest Tube distance (km): ${nearest ? nearest.dist_km.toFixed(2) : '—'}
Distance to Bank (km): ${distBankKm.toFixed(2)}`;
    } catch (e) {
      console.error(e);
      EH.out.textContent = 'Enrichment failed. Try again.';
    }
  });

  EH.copy?.addEventListener('click', async () => {
    const text = EH.out?.textContent || '';
    if (!text) return;
    await navigator.clipboard.writeText(text);
    EH.out.textContent += '\n\n(Copied to clipboard)';
  });
}

function haversine(lat1, lon1, lat2, lon2) {
  const R = 6371;
  const toRad = d => d * Math.PI / 180;
  const dLat = toRad(lat2-lat1), dLon = toRad(lon2-lon1);
  const a = Math.sin(dLat/2)**2 + Math.cos(toRad(lat1))*Math.cos(toRad(lat2))*sin2(dLon/2);
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
}
function sin2(x){ const s=Math.sin(x); return s*s; }

// init
linkIssueFormAnchors();
wireEvents();
loadData();
startPolling();
