// ui.js
export function renderTable(rowsEl, items) {
  rowsEl.innerHTML = items.map(rowHtml).join("");
}

function rowHtml(p) {
  const link = p.url ? `<a class="text-emerald-700 underline" href="${p.url}" target="_blank">Open</a>` : "";
  const viewed = p.viewing_date ? new Date(p.viewing_date).toISOString().slice(0,10) : "";
  return `
    <tr class="border-b last:border-0">
      <td class="px-4 py-3 font-semibold">${p.score?.toFixed?.(1) ?? ""}</td>
      <td class="px-4 py-3">${escapeHtml(p.address ?? "")}</td>
      <td class="px-4 py-3">${fmtGBP(p.price)}</td>
      <td class="px-4 py-3">${p.bedrooms ?? ""}</td>
      <td class="px-4 py-3">${p.tenure ?? ""}</td>
      <td class="px-4 py-3">${p.zone ?? ""}</td>
      <td class="px-4 py-3">${p.travel_time_to_zone1 ?? ""}</td>
      <td class="px-4 py-3">${p.epc ?? ""}</td>
      <td class="px-4 py-3">${viewed}</td>
      <td class="px-4 py-3">${link}</td>
    </tr>
  `;
}

export function buildNewRatingIssueUrl(repo, templateName="rating.md", defaults={}) {
  // Uses issue template with labels auto-applied; pass nothing to let template drive
  const base = `https://github.com/${repo}/issues/new`;
  const params = new URLSearchParams();
  params.set("template", templateName);
  if (defaults.title) params.set("title", defaults.title);
  if (defaults.labels) params.set("labels", defaults.labels);
  return `${base}?${params.toString()}`;
}

export function buildWeightsIssue(repo, currentCfg) {
  const base = `https://github.com/${repo}/issues/new`;
  const payload = {
    type: "config_update",
    config: currentCfg
  };
  const body = "```json\n" + JSON.stringify(payload, null, 2) + "\n```";
  const params = new URLSearchParams({
    title: "Config: update weights",
    labels: "config",
    body
  });
  return `${base}?${params.toString()}`;
}

function fmtGBP(n) {
  if (n == null) return "";
  return new Intl.NumberFormat("en-GB", { style: "currency", currency: "GBP", maximumFractionDigits: 0 }).format(n);
}
function escapeHtml(s) {
  return s.replace(/[&<>"']/g, m => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[m]));
}
