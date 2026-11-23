const products = [
  ["Halo Pendant", "Lighting", 189, 205, "The new opal shade comes from a smaller production run.", "Mara"],
  ["Linen Throw", "Textiles", 84, 79, "The winter textile agreement lowers the unit cost.", "Noor"],
  ["Forma Stool", "Furniture", 220, 235, "The supplier has moved to certified European oak.", "Levi"],
  ["Ridge Vase", "Objects", 48, 52, "The studio has revised its hand-finishing rate.", "Noor"],
  ["Arc Desk Lamp", "Lighting", 145, 155, "The replacement driver includes a longer warranty.", "Mara"],
  ["Loop Cushion", "Textiles", 58, 54, "Lower fabric costs now apply to this colourway.", "Noor"],
  ["Ash Bench", "Furniture", 385, 410, "Freight and finishing costs rose on the new batch.", "Levi"],
  ["Ripple Glass Set", "Objects", 62, 65, "The set now ships in reinforced packaging.", "Mara"],
  ["Fold Wall Light", "Lighting", 115, 109, "A larger production run reduced assembly costs.", "Levi"],
  ["Cove Tray", "Objects", 72, 76, "The new batch uses thicker solid ash.", "Noor"],
].map(([name, category, previous, proposed, reason, author], i) => ({
  id: String(1001 + i), name, category, previous, proposed, reason, author,
}));

const euro = new Intl.NumberFormat("en-IE", {style: "currency", currency: "EUR", maximumFractionDigits: 0});
const base = "/premium/queue";
const partial = (id, html) => `<hx-partial hx-target="#${id}" hx-swap="innerHTML">${html}</hx-partial>`;
const difference = p => (p.proposed > p.previous ? "+" : "−") + euro.format(Math.abs(p.proposed - p.previous));
const request = (method, path) => `hx-${method}="${base}/${path}" hx-target="#pq-delivery" hx-swap="innerHTML"`;

function list(items, selected, last) {
  if (!items.length) return `<li class="pq-empty">Every price change has been reviewed.
    <button type="button" class="mero-button mero-button-outline pq-empty-undo" ${request("post", "undo/" + last.id)}>Undo last approval</button></li>`;
  return items.map(p => `<li><button type="button" class="pq-row" id="pq-row-${p.id}" aria-current="${p.id === selected ? "true" : "false"}" aria-controls="pq-inspector" ${request("get", "inspect/" + p.id)}>
    <span><strong>${p.name}</strong><small>${p.category} · RL-${p.id}</small></span><span class="pq-delta">${difference(p)}</span>
  </button></li>`).join("");
}

function inspector(p, last) {
  const undo = last ? `<button type="button" id="pq-undo" class="mero-button mero-button-outline" ${request("post", "undo/" + last.id)}>Undo</button>` : "";
  return `<header class="mero-peek-header"><span>${p ? p.category + " · RL-" + p.id : "Review complete"}</span>
    <button type="button" class="mero-button mero-button-ghost mero-button-sm pq-close" aria-label="Close price inspector" data-pq-close>Close</button></header>
    ${p ? `<div class="pq-detail"><h3>${p.name}</h3><dl class="pq-prices"><div><dt>Current price</dt><dd>${euro.format(p.previous)}</dd></div><div><dt>Proposed price</dt><dd>${euro.format(p.proposed)}</dd></div></dl>
    <h4>Reason for change</h4><p>${p.reason}</p><small>Requested by ${p.author}</small></div>` : '<div class="pq-detail"><h3>All caught up</h3><p>The price review queue is empty.</p></div>'}
    <footer class="mero-peek-footer"><div>${p ? `<button type="button" id="pq-approve" class="mero-button mero-button-primary" ${request("post", "approve/" + p.id)}>Approve &amp; next</button>` : ""}${undo}</div>
    ${last ? `<small>Last approved · ${last.name}</small>` : ""}</footer>`;
}

export function createFeature(saved) {
  const approvals = [...(saved?.approvals ?? [])];
  const pending = () => products.filter(p => !approvals.includes(p.id));
  const lastApproved = () => products.find(p => p.id === approvals.at(-1));

  function render() {
    const items = pending();
    return `<section id="pq-queue" aria-label="Price review queue" hx-sync:inherited="#pq-queue:drop">
      <header class="pq-header"><h1>Pending price changes</h1><span id="pq-count">${items.length} pending</span></header>
      <div class="pq-columns"><ul aria-label="Pending requests" id="pq-list">${list(items, items[0]?.id, lastApproved())}</ul>
      <aside class="mero-peek" id="pq-inspector" aria-label="Price inspector">${inspector(items[0], lastApproved())}</aside></div>
      <p class="pq-sr" role="status" aria-live="polite" id="pq-status"></p><div id="pq-delivery" hidden></div></section>`;
  }

  async function handle(req, res, url) {
    const [, action, id] = url.pathname.match(/^\/premium\/queue\/(inspect|approve|undo)\/(\d+)$/) ?? [];
    const product = products.find(p => p.id === id);
    if (!product) { res.writeHead(404).end("Unknown price change"); return; }
    if (req.method !== (action === "inspect" ? "GET" : "POST")) { res.writeHead(405).end(); return; }
    let selected = product;
    let message;
    if (action === "approve") {
      if (!approvals.includes(id)) {
        approvals.push(id);
        message = product.name + " approved.";
      } else message = product.name + " was already approved.";
      const items = pending();
      selected = items.find(p => Number(p.id) > Number(id)) ?? items[0];
    } else if (action === "undo") {
      if (approvals.at(-1) === id) {
        approvals.pop();
        message = product.name + " returned to the queue.";
      } else {
        message = "The most recent approval has changed.";
        selected = pending()[0];
      }
    } else if (approvals.includes(id)) {
      selected = pending()[0];
      message = product.name + " was already approved.";
    }
    const items = pending();
    const detail = message ? message + (selected ? " Reviewing " + selected.name + "." : " Queue complete.") : "Reviewing " + selected.name + ".";
    res.writeHead(200, { "Content-Type": "text/html; charset=utf-8", "Cache-Control": "no-store",
      "HX-Trigger": JSON.stringify({ "premium:queue-ready": { target: "#pq-queue" } }) });
    res.end(partial("pq-count", items.length + " pending") + partial("pq-list", list(items, selected?.id, lastApproved())) +
      partial("pq-inspector", inspector(selected, lastApproved())) + partial("pq-status", detail));
  }
  return { render, handle, snapshot: () => ({ approvals: [...approvals] }) };
}
