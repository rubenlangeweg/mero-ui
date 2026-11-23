import { escapeHtml as esc } from "../../site/html.mjs";

const base = "/premium/paste";
const target = 'hx-target="#paste-workspace" hx-swap="outerHTML"';
const formatter = new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" });
const money = cents => formatter.format(cents / 100);
const productNames = [
  "Arc desk lamp", "Taper vase", "Field stool", "Linen throw", "Mesa tray", "Oriel pendant",
  "Ripple carafe", "Dune cushion", "Slope chair", "Loop mirror", "Halo sconce", "Aster rug",
  "Reed basket", "Ridge shelf", "Nook side table", "Beam lamp", "Flint candleholder", "Folio stand",
  "Cove planter", "Orbit clock", "Vale bowl", "Twist hook", "Oak bench", "Cloud pillow",
  "Prism glass", "Haven ottoman", "Loom runner", "Moss pitcher", "Drift console", "Pillar vase",
];

function button(label, primary = false) {
  return `<button type="submit" class="mero-button mero-button-${primary ? "primary" : "outline"}">${label}</button>`;
}

function entry(message = "", pasted = "") {
  return `<section id="paste-workspace" class="paste-workspace" aria-label="Price import">
    <form class="paste-form" hx-post="${base}/review" ${target}>
      <label for="paste-data">Spreadsheet rows</label>
      <p id="paste-hint" class="paste-muted">Paste SKU and price columns separated by tabs. Use SKUs MRO-1001 through MRO-1030 and prices in USD.</p>
      <textarea id="paste-data" name="tsv" class="mero-textarea" rows="6" aria-describedby="paste-hint" required placeholder="SKU&#9;Price&#10;MRO-1001&#9;24.50">${esc(pasted)}</textarea>
      ${message ? `<p role="alert" class="mero-field-error">${esc(message)}</p>` : ""}
      <div class="paste-actions">${button("Review prices", true)}
        <button type="button" class="mero-button mero-button-outline" hx-get="${base}/sample" ${target}>Try 30 sample rows</button>
      </div>
    </form></section>`;
}

function parsePaste(raw) {
  const lines = raw.trimEnd().replace(/^\uFEFF/, "").split(/\r\n|\n|\r/).filter(line => line.trim());
  if (/^sku\tprice$/i.test(lines[0]?.trim())) lines.shift();
  if (!lines.length || lines.length > 100) throw new Error("Paste between 1 and 100 rows.");
  return lines.map((line, index) => {
    const cells = line.split("\t");
    if (cells.length > 2) throw new Error(`Row ${index + 1} has extra columns. Paste only SKU and price.`);
    return { sku: cells[0].trim().toUpperCase(), price: (cells[1] || "").trim() };
  });
}

function readPrice(text) {
  if (!/^\d{1,6}([.,]\d{1,2})?$/.test(text)) return null;
  const [dollars, fraction = ""] = text.split(/[.,]/);
  const cents = Number(dollars) * 100 + Number(fraction.padEnd(2, "0"));
  return cents > 0 ? cents : null;
}

function validate(rows, inventory) {
  const seen = new Set();
  return rows.map(({ sku, price }) => {
    const product = inventory.get(sku);
    const cents = readPrice(price);
    let skuError = "";
    if (!product) skuError = "Enter a SKU from MRO-1001 to MRO-1030.";
    else if (seen.has(sku)) skuError = "This SKU appears twice. Give this row a different SKU.";
    seen.add(sku);
    return { sku, price, product, cents, skuError, priceError: cents === null ? "Enter a positive price with up to two decimal places." : "" };
  });
}

function cellInput(name, value, error, index) {
  if (!error) return `<input type="hidden" name="${name}" value="${esc(value)}">`;
  return `<input class="mero-input" data-paste-error name="${name}" value="${esc(value)}" aria-label="Row ${index + 1} ${name}" aria-invalid="true" aria-describedby="paste-${name}-${index}" ${name === "price" ? 'inputmode="decimal"' : ""}>
    <span class="paste-error" id="paste-${name}-${index}">${esc(error)}</span>`;
}

function review(rows, revision, message = "") {
  const invalid = rows.filter(row => row.skuError || row.priceError).length;
  const changed = rows.filter(row => row.product && row.cents !== null && row.product.cents !== row.cents).length;
  const summary = invalid ? `${invalid} row${invalid === 1 ? "" : "s"} to correct` : `${changed} price change${changed === 1 ? "" : "s"} ready`;
  const apply = invalid ? "Review corrections" : `Apply ${changed} price change${changed === 1 ? "" : "s"}`;
  return `<section id="paste-workspace" class="paste-workspace" aria-label="Price review">
    <div class="paste-summary"><div><h2 tabindex="-1" data-paste-focus>${summary}</h2>
      <p class="paste-muted">${rows.length} rows reviewed · ${invalid ? "Fix the marked cells before applying this batch." : "Compare the current and proposed USD prices."}</p></div>
      ${invalid ? '<button type="button" class="mero-button mero-button-outline" data-paste-jump>Go to first error</button>' : ""}</div>
    ${message ? `<p role="alert">${esc(message)}</p>` : ""}
    <form hx-post="${base}/${invalid ? "recheck" : "commit"}" ${target}>
      <input type="hidden" name="revision" value="${revision}">
      <div class="paste-scroll" tabindex="0" role="region" aria-label="Price comparison, scroll for more rows"><table class="mero-table">
        <thead><tr><th scope="col">Product</th><th scope="col">Current</th><th scope="col">Proposed</th></tr></thead>
        <tbody>${rows.map((row, i) => `<tr${row.skuError || row.priceError ? ' class="paste-invalid"' : ""}>
          <th scope="row">${row.product ? `<span>${esc(row.product.name)}</span>` : ""}
            ${row.skuError ? "" : `<small class="paste-muted">${esc(row.sku)}</small>`}${cellInput("sku", row.sku, row.skuError, i)}</th>
          <td>${row.product ? money(row.product.cents) : "—"}</td><td>${row.priceError ? "" : money(row.cents)}${cellInput("price", row.price, row.priceError, i)}</td></tr>`).join("")}</tbody>
      </table></div>
      <div class="paste-actions">${invalid || changed ? button(apply, true) : ""}
        <button type="button" class="mero-button mero-button-outline" hx-get="${base}/start" ${target}>Start over</button></div>
    </form></section>`;
}

async function params(req) {
  const chunks = [];
  let size = 0;
  for await (const chunk of req) {
    size += chunk.length;
    if (size > 65536) return null;
    chunks.push(chunk);
  }
  return new URLSearchParams(Buffer.concat(chunks).toString());
}

function send(res, html, status = 200) {
  res.writeHead(status, { "Content-Type": "text/html; charset=utf-8", "Cache-Control": "no-store" });
  res.end(html);
  return true;
}

export function createFeature(saved) {
  const inventory = new Map(productNames.map((name, i) => {
    const sku = `MRO-${1001 + i}`;
    return [sku, { name, cents: saved?.prices?.[sku] ?? 1700 + i * 425 }];
  }));
  let revision = saved?.revision ?? 1;

  async function handle(req, res, url) {
    const path = url.pathname;
    if (req.method === "GET" && path === `${base}/start`) return send(res, entry());
    if (req.method === "GET" && path === `${base}/sample`) {
      const sample = [...inventory].map(([sku, item], i) => {
        const price = i === 0 ? "TBD" : i === 4 ? "-5.00" : ((item.cents + 125) / 100).toFixed(2);
        return { sku, price };
      });
      return send(res, review(validate(sample, inventory), revision));
    }
    if (req.method !== "POST" || !["review", "recheck", "commit"].some(action => path === `${base}/${action}`)) return send(res, "Unknown price action", 404);
    const form = await params(req);
    if (!form) return send(res, entry("This batch exceeds the 64 KB limit."));
    let input;
    if (path === `${base}/review`) {
      try { input = parsePaste(form.get("tsv") || ""); }
      catch (error) { return send(res, entry(error.message, form.get("tsv"))); }
    } else {
      const skus = form.getAll("sku"), prices = form.getAll("price");
      if (!skus.length || skus.length > 100 || skus.length !== prices.length) return send(res, entry("Paste the batch again to review its rows."));
      input = skus.map((sku, i) => ({ sku: sku.trim().toUpperCase(), price: prices[i].trim() }));
    }
    const rows = validate(input, inventory);
    if (path !== `${base}/commit` || rows.some(row => row.skuError || row.priceError)) return send(res, review(rows, revision));
    if (Number(form.get("revision")) !== revision) return send(res, review(rows, revision, "Inventory changed since your review. Check the updated current prices before applying."));
    const changes = rows.filter(row => row.cents !== row.product.cents);
    const receipt = changes.map(row => `<tr><th scope="row">${esc(row.product.name)}<small class="paste-muted">${esc(row.sku)}</small></th><td>${money(row.product.cents)}</td><td>${money(row.cents)}</td></tr>`).join("");
    for (const row of changes) row.product.cents = row.cents;
    if (changes.length) revision++;
    return send(res, `<section id="paste-workspace" class="paste-workspace" aria-label="Price import receipt">
      <div class="paste-summary"><div><h2 tabindex="-1" data-paste-focus>${changes.length} price change${changes.length === 1 ? "" : "s"} applied</h2><p class="paste-muted">Saved to this demo inventory.</p></div>
      <button type="button" class="mero-button mero-button-outline" hx-get="${base}/start" ${target}>Start another import</button></div>
      <div class="paste-scroll"><table class="mero-table"><thead><tr><th scope="col">Product</th><th scope="col">Previous</th><th scope="col">Saved</th></tr></thead><tbody>${receipt}</tbody></table></div></section>`);
  }

  function render() {
    return `<header class="paste-heading"><h1>Import prices</h1><p>Review and apply spreadsheet changes to your inventory.</p></header>${entry()}`;
  }

  function snapshot() {
    return { revision, prices: Object.fromEntries([...inventory].map(([sku, item]) => [sku, item.cents])) };
  }
  return { render, handle, snapshot };
}
