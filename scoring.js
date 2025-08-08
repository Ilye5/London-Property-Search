// scoring.js
export function computeScore(p, cfg) {
  // Hard constraints
  const minBeds = cfg?.constraints?.min_bedrooms ?? 2;
  const allowedTenure = (cfg?.constraints?.allowed_tenure ?? ["Freehold", "Share of freehold"])
    .map(t => String(t).toLowerCase());

  const okBeds = Number(p.bedrooms ?? 0) >= minBeds;
  const okTenure = p.tenure && allowedTenure.includes(String(p.tenure).toLowerCase());
  if (!okBeds || !okTenure) return 0;

  // Weights & price band
  const w = cfg.weights;
  const targetPrice = cfg.price.target;        // e.g., 380000
  const tolerance  = cfg.price.tolerance;      // e.g., 0.10 (±10%)

  // Price score
  const price = Number(p.price ?? NaN);
  let priceScore = 0;
  if (!Number.isNaN(price)) {
    const lower = targetPrice * (1 - tolerance);
    const upper = targetPrice * (1 + tolerance);
    if (price >= lower && price <= upper) {
      priceScore = 1;
    } else {
      const overshoot = price < lower ? (lower - price) / lower : (price - upper) / upper;
      priceScore = Math.max(0, 1 - overshoot * 2); // steeper decay
    }
  }

  // Bedrooms: linear up to cap
  const bedCap = cfg?.bedrooms?.cap ?? 4;
  const bedScore = clamp01((Number(p.bedrooms ?? 0)) / bedCap);

  // Zone preference (lower better)
  const zone = Number(p.zone ?? 9);
  const zoneScore = zone <= 2 ? 1 : zone <= 3 ? 0.7 : zone <= 4 ? 0.5 : 0.3;

  // Travel time (minutes) 15–60 mapping
  const tMinRaw = Number(p.travel_time_to_zone1 ?? 60);
  const tMin = clamp(tMinRaw, 15, 60);
  const travelScore = 1 - (tMin - 15) / (60 - 15);

  // EPC score
  const epcMap = { A: 1, B: 0.9, C: 0.8, D: 0.7, E: 0.55, F: 0.4, G: 0.2 };
  const epcScore = epcMap[(p.epc || "").toUpperCase()] ?? 0.5;

  // Optional: distance to Bank (km), if provided
  const distBank = Number(p.distance_to_bank_km ?? NaN);
  const bankScore = Number.isNaN(distBank) ? 0.5 : Math.max(0, 1 - (distBank / 12)); // 0 at 12km+

  // Subjective (0–10 each) → 0–1
  const subjectiveFields = ["layout", "light", "noise", "outdoor", "kitchen", "bathroom", "area_vibe"];
  const subj = subjectiveFields.map(f => norm10(p[f]));
  const subjectiveScore = subj.length ? (subj.reduce((a,b)=>a+b,0) / subj.length) : 0;

  // Weighted sum
  const total =
    (w.price ?? 0)      * priceScore +
    (w.bedrooms ?? 0)   * bedScore +
    (w.zone ?? 0)       * zoneScore +
    (w.travel ?? 0)     * travelScore +
    (w.epc ?? 0)        * epcScore +
    (w.bank ?? 0)       * bankScore +
    (w.subjective ?? 0) * subjectiveScore;

  // Display on 0–10
  return round(total * 10, 1);
}

export function compare(a, b, key) {
  // price/zone asc; others desc
  const asc = (key === "price" || key === "zone");
  const va = a[key] ?? null, vb = b[key] ?? null;
  if (va == null && vb == null) return 0;
  if (va == null) return +1;
  if (vb == null) return -1;
  if (va < vb) return asc ? -1 :  1;
  if (va > vb) return asc ?  1 : -1;
  return 0;
}

// ---- helpers ----
function norm10(v) {
  const n = Number(v);
  if (Number.isNaN(n)) return 0;
  return clamp01(n / 10);
}
function round(x, dp = 1) {
  const m = 10 ** dp;
  return Math.round(x * m) / m;
}
function clamp(x, lo, hi) { return Math.max(lo, Math.min(hi, x)); }
function clamp01(x)       { return clamp(x, 0, 1); }
