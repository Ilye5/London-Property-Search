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

// Tabs
const tabProperties = document.getElementById("tabProperties");
const tabInsights   = document.getElementById("tabInsights");
const panelProperties = document.getElementById("panelProperties");
const panelInsights   = document.getElementById("panelInsights");

// Enrichment
const EH = {
  addr: document.getElementById('eh_addr'),
  go: document.getElementById('eh_go'),
  copy: document.getElementById('eh_copy'),
  out: document.getElementById('eh_out'),
  issue: document.getElementById('eh_issue')
};

let state = { config: null, items: [], timer: null, charts: {} };

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
    if (lastUpdatedEl) lastUpdatedEl.textContent = `Updated ${new Date().toLocaleString("en-GB")}`;
    applyRender();
    renderCharts();
  } catch (e) {
    console.error(e);
    if (lastUpdatedEl) lastUpdatedEl.textContent = "Failed to load data.";
  }
}

function applyRender() {
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
}

/* ---------------- Tabs ---------------- */
function setActiveTab(which) {
  const buttons = [tabProperties, tabInsights];
  const panels  = [panelProperties, panelInsights];
  buttons.forEach(btn => btn?.classList.remove("active", "bg-white/10"));
  panels.forEach(p => p?.classList.add("hidden"));
  if (which === "insights") {
    tabInsights?.classList.add("active", "bg-white/10");
    panelInsights?.classList.remove("hidden");
    renderCharts();
  } else {
    tabProperties?.classList.add("active", "bg-white/10");
    panelProperties?.classList.remove("hidden");
  }
}

/* ---------------- Charts ---------------- */
function renderCharts() {
  // Destroy existing
  Object.values(state.charts).forEach(ch => ch?.destroy());
  state.charts = {};

  const items = [...state.items].filter(p => Number.isFinite(p.score) && p.score > 0);
  if (!items.length) return;

  // Top 10
  const top = [...items].sort((a,b)=>b.score-a.score).slice(0,10);
  const ctxTop = document.getElementById('chartTop10');
  if (ctxTop) {
    state.charts.top10 = new Chart(ctxTop, {
      type: 'bar',
      data: {
        labels: top.map(x => (x.address || x.property_id || "").slice(0,18)),
        datasets: [{ label: 'Score', data: top.map(x => x.score) }]
      },
      options: { responsive: true, plugins: { legend: { display: false }}, scales: { y: { suggestedMin: 0, suggestedMax: 10 }}}
    });
  }

  // Scatter: score vs price
  const ctxSc = document.getElementById('chartScatter');
  if (ctxSc) {
    state.charts.scatter = new Chart(ctxSc, {
      type: 'scatter',
      data: {
        datasets: [{
          label: 'Properties',
          data: items.filter(x => x.price).map(x => ({ x: x.price, y: x.score }))
        }]
      },
      options: {
        responsive: true,
        parsing: false,
        plugins: { legend: { display: false }},
        scales: {
          x: { title: { text: 'Price (£)', display: true }},
          y: { title: { text: 'Score', display: true }, suggestedMin: 0, suggestedMax: 10 }
        }
      }
    });
  }

  // Histogram of scores
  const ctxH = document.getElementById('chartHist');
  if (ctxH) {
    const bins = Array.from({length: 10}, (_,i)=>i+1);
    const counts = bins.map(b => items.filter(x => x.score >= b-1 && x.score < b).length);
    state.charts.hist = new Chart(ctxH, {
      type: 'bar',
      data: { labels: bins.map(b => `${b-1}-${b}`), datasets: [{ label: 'Count', data: counts }] },
      options: { responsive: true, plugins: { legend: { display: false }}, scales: { y: { beginAtZero: true }}}
    });
  }
}

/* ---------------- Weights modal ---------------- */
function openWeightsModal() {
  const w = state.config?.weights || {};
  const fields = Object.keys(w);
  if (!fields.length) return;
  weightsForm.innerHTML = fields.map(f => `
    <label class="block">
      <span class="text-sm">${f}</span>
      <input data-key="${f}" type="number" step="0.01" value="${w[f]}" class="mt-1 w-full border rounded-lg p-2" />
    </label>
  `).join('') + `<p class="text-xs text-slate-500 mt-2">Weights sum isn't required; scores are scaled to 0–10.</p>`;
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

/* ---------------- Location Helper (real TfL) ---------------- */
// Using public Overpass API (no key). It queries OSM for subway stations in London Underground network.
const BANK = { lat: 51.5133, lon: -0.0898 };

async function geocodeNominatim(q) {
  const url = `https://nominatim.openstreetmap.org/search?format=jsonv2&limit=1&q=${encodeURIComponent(q)}`;
  const res = await fetch(url, { headers: { 'Accept': 'application/json' }});
  if (!res.ok) throw new Error(`Geocode failed: ${res.status}`);
  const js = await res.json();
  if (!js?.length) throw new Error('No geocoding match');
  return { lat: +js[0].lat, lon: +js[0].lon, label: js[0].display_name };
}

async function nearestTubeOverpass(lat, lon) {
  // Search within 2km for London Underground stations or entrances
  const q = `
    [out:json][timeout:25];
    (
      node(around:2000,${lat},${lon})["railway"="station"]["station"="subway"]["network"~"London Underground"];
      node(around:2000,${lat},${lon})["railway"="subway_entrance"]["network"~"London Underground"];
    );
    out body;
  `.trim();
  const res = await fetch("https://overpass-api.de/api/interpreter", {
    method: "POST",
    headers: { "Content-Type": "text/plain" },
    body: q
  });
  if (!res.ok) throw new Error(`Overpass failed: ${res.status}`);
  const js = await res.json();
  const elements = js.elements || [];
  if (!elements.length) return null;
  const scored = elements.map(el => ({
    name: el.tags?.name || "Unknown station",
    dist_km: haversine(lat, lon, el.lat, el.lon)
  })).sort((a,b)=>a.dist_km-b.dist_km);
  return scored[0];
}

function haversine(lat1, lon1, lat2, lon2) {
  const R = 6371;
  const toRad = d => d * Math.PI / 180;
  const dLat = toRad(lat2-lat1), dLon = toRad(lon2-lon1);
  const a = Math.sin(dLat/2)**2 + Math.cos(toRad(lat1))*Math.cos(toRad(lat2))*Math.sin(dLon/2)**2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
}

/* ---------------- Wiring ---------------- */
function wireEvents() {
  refreshBtn?.addEventListener("click", () => { loadData(); });
  sortByEl?.addEventListener("change", applyRender);
  minBedsEl?.addEventListener("input", applyRender);
  tenureFilterEl?.addEventListener("change", applyRender);
  editWeightsBtn?.addEventListener("click", openWeightsModal);
  saveWeightsBtn?.addEventListener("click", saveWeightsViaIssue);

  // Tabs
  tabProperties?.addEventListener("click", () => setActiveTab("properties"));
  tabInsights?.addEventListener("click",   () => { setActiveTab("insights"); renderCharts(); });

  // Location helper
  EH.go?.addEventListener('click', async () => {
    const q = (EH.addr?.value || '').trim();
    if (!q) { EH.out.textContent = 'Enter an address or postcode.'; return; }
    EH.out.textContent = 'Looking up address…';
    try {
      const g = await geocodeNominatim(q);
      EH.out.textContent = `Found: ${g.label}\nFinding nearest Tube…`;
      const nearest = await nearestTubeOverpass(g.lat, g.lon);
      const distBankKm = haversine(g.lat, g.lon, BANK.lat, BANK.lon);

      if (!nearest) {
        EH.out.textContent = `Found: ${g.label}\nNo Tube stations within 2 km (Overpass/OSM). Try a broader query.`;
        return;
      }
      EH.out.textContent =
`Copy into the Issue Form:

Nearest Tube: ${nearest.name}
Nearest Tube distance (km): ${nearest.dist_km.toFixed(2)}
Distance to Bank (km): ${distBankKm.toFixed(2)}`;
    } catch (e) {
      console.error(e);
      EH.out.textContent = 'Lookup failed (geocoder/Overpass may be rate-limited). Try again in ~1 minute.';
    }
  });

  EH.copy?.addEventListener('click', async () => {
    const text = EH.out?.textContent || '';
    if (!text) return;
    await navigator.clipboard.writeText(text);
    EH.out.textContent += '\n\n(Copied to clipboard)';
  });
}

/* ---------------- Init ---------------- */
function startPolling() {
  if (state.timer) clearInterval(state.timer);
  state.timer = setInterval(loadData, 30000);
}

function linkIssueForm() {
  const url = `https://github.com/${REPO}/issues/new?template=rating.yml`;
  if (newRatingBtn) newRatingBtn.href = url;
  if (EH.issue) EH.issue.href = url;
}

linkIssueFormAnchors();
wireEvents();
loadData();
startPolling();
setActiveTab("properties"); // default
