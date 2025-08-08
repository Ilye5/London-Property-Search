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
  // Change the new rating link to open the Issue Form
newRatingBtn.href = `https://github.com/${REPO}/issues/new?template=rating.yml`;
  loadData().catch(err => {
    console.error(err);
    lastUpdatedEl.textContent = "Failed to load data.";
  });
  startPolling();
}



init();

// ---- Enrichment Helper (client-only; no keys) ----
const EH = {
  addr: document.getElementById('eh_addr'),
  go: document.getElementById('eh_go'),
  copy: document.getElementById('eh_copy'),
  out: document.getElementById('eh_out'),
  issue: document.getElementById('eh_issue')
};

const BANK = { lat: 51.5133, lon: -0.0898 }; // Bank station approx
EH.issue.href = `https://github.com/${REPO}/issues/new?template=rating.yml`;

EH.go?.addEventListener('click', async () => {
  const q = (EH.addr.value || '').trim();
  if (!q) { EH.out.textContent = 'Enter an address or postcode.'; return; }

  try {
    // 1) Geocode via Nominatim (no key). Rate-limited; be gentle.
    const url = `https://nominatim.openstreetmap.org/search?format=jsonv2&limit=1&q=${encodeURIComponent(q)}`;
    const res = await fetch(url, { headers: { 'Accept': 'application/json' }});
    const js = await res.json();
    if (!js?.length) { EH.out.textContent = 'No geocoding match.'; return; }
    const { lat, lon, display_name } = js[0];

    // 2) Find a nearby Tube stop via Nominatim (query around point)
    const tubeUrl = `https://nominatim.openstreetmap.org/search?` +
      `format=jsonv2&limit=5&` +
      `q=${encodeURIComponent('Underground station')}&` +
      `viewbox=${lon-0.02},${lat+0.02},${lon+0.02},${lat-0.02}&bounded=1`;
    const tRes = await fetch(tubeUrl);
    const tJs = await tRes.json();
    // Choose nearest by haversine
    const nearest = (tJs||[]).map(s => {
      const d = haversine(Number(lat), Number(lon), Number(s.lat), Number(s.lon));
      return { name: s.display_name?.split(',')[0] || 'Unknown', dist_km: d };
    }).sort((a,b)=>a.dist_km-b.dist_km)[0];

    // 3) Distance to Bank (km)
    const distBankKm = haversine(Number(lat), Number(lon), BANK.lat, BANK.lon);

    const out = {
      geocoded_address: display_name,
      lat: Number(lat),
      lon: Number(lon),
      nearest_tube: nearest?.name || null,
      nearest_tube_distance_km: nearest ? Number(nearest.dist_km.toFixed(2)) : null,
      distance_to_bank_km: Number(distBankKm.toFixed(2))
    };
    EH.out.textContent =
`Copy into the Issue Form:

Nearest Tube: ${out.nearest_tube || '—'}
Nearest Tube distance (km): ${out.nearest_tube_distance_km ?? '—'}
Distance to Bank (km): ${out.distance_to_bank_km}`;

  } catch (e) {
    EH.out.textContent = 'Enrichment failed. Try again.';
    console.error(e);
  }
});

EH.copy?.addEventListener('click', async () => {
  const text = EH.out.textContent || '';
  if (!text) return;
  await navigator.clipboard.writeText(text);
  EH.out.textContent += '\n\n(Copied to clipboard)';
});

function haversine(lat1, lon1, lat2, lon2) {
  const R = 6371; // km
  const toRad = d => d * Math.PI / 180;
  const dLat = toRad(lat2-lat1), dLon = toRad(lon2-lon1);
  const a = Math.sin(dLat/2)**2 + Math.cos(toRad(lat1))*Math.cos(toRad(lat2))*Math.sin(dLon/2)**2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
}

