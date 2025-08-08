// scoring.js
export function computeScore(p, cfg) {
  // Hard constraints
  const minBeds = cfg.constraints.min_bedrooms ?? 2;
  const allowedTenure = (cfg.constraints.allowed_tenure ?? ["Freehold", "Share of freehold"])
    .map(t => t.toLowerCase());

  const okBeds = (p.bedrooms ?? 0) >= minBeds;
  const okTenure = p.tenure && allowedTenure.includes(String(p.tenure).toLowerCase());
  if (!okBeds || !okTenure) return 0;

  // Base weights
  const w = cfg.weights;
  const targetPrice = cfg.price.target; // e.g. 380000
  const tolerance = cfg.price.tolerance; // e.g. 0.10 (±10%)

  // Price score: 1 within band; decays outside
  const price = p.price ?? null;
  let priceScore = 0;
  if (price) {
    const lower = targetPrice * (1 - tolerance);
    const upper = targetPrice * (1 + tolerance);
    if (price >= lower && price <= upper) priceScore = 1;
    else {
      // simple decay: 1% score penalty per 1% outside band, floored at 0
      const overshoot = price < lower ? (lower - price) / lower : (price - upper) / upper;
      priceScore = Math.max(0, 1 - overshoot * 2); // steeper decay
    }
  }

  // Bedrooms: linear up to cap
  const bedCap = cfg.bedrooms.cap ?? 4;
  const bedScore = Math.min((p.bedrooms ?? 0) / bedCap, 1);

  // Zone (prefer <= 2)
  const zone = Number(p.zone ?? 9);
  const zoneScore = zone <= 2 ? 1 : zone <= 3 ? 0.7 : zone <= 4 ? 0.5 : 0.3;

  // Travel time to Zone 1 (minutes): lower is better; clamp 15–60
  const tMin = Math.max(15, Math.min(60, Number(p.travel_time_to_zone1 ?? 60)));
  const travelScore = 1 - (tMin - 15) / (60 - 15);

  // EPC: A=1 … G=0.2 (or unknown=0.5)
  const epcMap = { A: 1, B: 0.9, C: 0.8, D: 0.7, E: 0.55, F: 0.4, G: 0.2 };
  const epcScore = epcMap[(p.epc || "").toUpperCase()] ?? 0.5;

  // Subjective ratings 0–10 scaled
  const subjectiveFields = ["layout", "light", "noise", "outdoor", "kitchen", "bathroom", "area_vibe"];
  const subj = subjectiveFields.map(f => norm10(p[f]));
  const subjectiveScore = subj.reduce((a, b) => a + b, 0) / subj.length || 0;

  // Weighted sum
  const total =
    w.price * priceScore +
    w.bedrooms * bedScore +
    w.zone * zoneScore +
    w.travel * travelScore +
    w.epc * epcScore +
    w.subjective * subjectiveScore;

  // Normalise to 0–10 for display
  return round(total * 10, 1);
}

function norm10(v) {
  if (v == null) return 0;
  const n = Number(v);
  if (Number.isNaN(n)) return 0;
  return Math.max(0, Math.min(1, n / 10));
}

function round(x, dp = 1) {
  const m = Math.pow(10, dp);
  return Math.round(x * m) / m;
}

export function compare(a, b, key) {
  // custom comparators for sort
  const dir = (k) => (k === "price" || k === "zone") ? +1 : -1; // price/zone ascending; others descending
  if (a[key] == null && b[key] == null) return 0;
  if (a[key] == null) return 1;
  if (b[key] == null) return -1;
  if (a[key] < b[key]) return -1 * dir(key);
  if (a[key] > b[key]) return +1 * dir(key);
  return 0;
}
