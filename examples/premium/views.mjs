import { randomUUID } from "node:crypto";
import { escapeHtml as esc } from "../../site/html.mjs";

const page = "/premium/views";
const filters = { all: "All stock levels", low: "Low stock (1–9)", empty: "Out of stock", available: "In stock" };
const sorts = { ascending: "Stock, low to high", descending: "Stock, high to low", name: "Product, A–Z" };
const columns = { sku: "SKU", quantity: "On hand", price: "Unit price" };
const products = [
  ["Arc desk lamp", "AR-108", 3, 129], ["Line shelf", "LN-244", 18, 84],
  ["Fold stool", "FD-216", 2, 98], ["Halo pendant", "HL-110", 7, 180],
  ["Field notebook", "FL-320", 42, 14], ["Loop tray", "LP-160", 5, 32],
  ["Atlas planter", "AT-290", 0, 49], ["Ridge carafe", "RD-154", 4, 58],
  ["Forma chair", "FM-230", 9, 215], ["Cove vase", "CV-187", 0, 62],
].map(([name, sku, quantity, price]) => ({ name, sku, quantity, price }));

function readConfig(params, fallback) {
  if (!params.has("custom")) return fallback;
  return {
    filter: Object.hasOwn(filters, params.get("filter")) ? params.get("filter") : fallback.filter,
    sort: Object.hasOwn(sorts, params.get("sort")) ? params.get("sort") : fallback.sort,
    columns: Object.keys(columns).filter(key => params.getAll("column").includes(key)),
  };
}

function viewLink(view, config = view.config) {
  const params = new URLSearchParams({ view: view.id });
  if (JSON.stringify(config) !== JSON.stringify(view.config)) {
    params.set("custom", "1");
    params.set("filter", config.filter);
    params.set("sort", config.sort);
    config.columns.forEach(key => params.append("column", key));
  }
  return page + "?" + params;
}

function options(choices, selected) {
  return Object.entries(choices).map(([key, label]) => `<option value="${key}" ${key === selected ? "selected" : ""}>${label}</option>`).join("");
}

function viewRows(config) {
  const matching = products.filter(({ quantity }) => {
    if (config.filter === "low") return quantity > 0 && quantity < 10;
    if (config.filter === "empty") return quantity === 0;
    if (config.filter === "available") return quantity > 0;
    return true;
  });
  return matching.sort((a, b) => {
    if (config.sort === "name") return a.name.localeCompare(b.name);
    const delta = config.sort === "ascending" ? a.quantity - b.quantity : b.quantity - a.quantity;
    return delta || a.name.localeCompare(b.name);
  });
}

async function readBody(req) {
  const chunks = [];
  let size = 0;
  for await (const chunk of req) {
    size += chunk.length;
    if (size > 8192) return null;
    chunks.push(chunk);
  }
  return new URLSearchParams(Buffer.concat(chunks).toString());
}

export function createFeature() {
  const views = new Map();
  for (const [id, name, filter, sort, visible] of [
    ["low-stock", "Low stock", "low", "ascending", ["sku", "quantity", "price"]],
    ["all-products", "All products", "all", "name", ["quantity", "price"]],
  ]) views.set(id, { id, name, version: 1, config: { filter, sort, columns: visible } });

  function render(url, message = "", draftName = "") {
    const params = url?.searchParams ?? new URLSearchParams();
    const view = views.get(params.get("view") || "low-stock");
    if (!view) return `<section id="saved-view"><h2>View unavailable</h2><p>This saved view could not be found. <a href="${page}">Open Low stock</a></p></section>`;
    const config = readConfig(params, view.config);
    const rows = viewRows(config);
    const workingLink = viewLink(view, config);
    const savedLink = viewLink(view);
    const dirty = savedLink !== workingLink;
    return `<section id="saved-view" aria-label="Saved views">
      <header class="sv-page-heading"><h1>Inventory views</h1><p>Save and share the filters, sort order and columns you use together.</p></header>
      <nav aria-label="Inventory views" class="sv-tabs">${[...views.values()].map(item =>
        `<a href="${esc(viewLink(item))}" ${item === view ? 'aria-current="page"' : ""}>${esc(item.name)}</a>`).join("")}</nav>
      <div class="sv-heading"><div><h2>${esc(view.name)}</h2><p>${rows.length} of ${products.length} products${dirty ? " · Unsaved changes" : ""}</p></div>
        <button type="button" class="mero-button" data-sv-copy="${esc(workingLink)}">Copy link</button></div>
      <form id="sv-controls" method="get" action="${page}" hx-get="${page}/preview" hx-trigger="change, submit" hx-target="#saved-view" hx-swap="outerHTML" hx-sync="#saved-view:replace" class="sv-controls">
        <input type="hidden" name="view" value="${esc(view.id)}"><input type="hidden" name="custom" value="1">
        <label class="mero-label" for="sv-filter">Stock level<select class="mero-select" id="sv-filter" name="filter">${options(filters, config.filter)}</select></label>
        <label class="mero-label" for="sv-sort">Sort by<select class="mero-select" id="sv-sort" name="sort">${options(sorts, config.sort)}</select></label>
        <fieldset><legend>Visible columns</legend>${Object.entries(columns).map(([key, label]) => `<label><input class="mero-checkbox" id="sv-column-${key}" type="checkbox" name="column" value="${key}" ${config.columns.includes(key) ? "checked" : ""}> ${label}</label>`).join("")}</fieldset>
        <noscript><button class="mero-button">Apply</button></noscript>
      </form>
      <div class="mero-table-wrap"><table class="mero-table" aria-label="${esc(view.name)} products">
        <thead><tr><th scope="col">Product</th>${config.columns.map(key => `<th scope="col">${columns[key]}</th>`).join("")}</tr></thead>
        <tbody>${rows.map(product => `<tr><th scope="row">${product.name}</th>${config.columns.map(key => `<td>${key === "price" ? "$" + product.price.toFixed(2) : product[key]}</td>`).join("")}</tr>`).join("")}</tbody>
      </table></div>
      <form method="post" action="${page}/save" hx-post="${page}/save" hx-target="#saved-view" hx-swap="outerHTML" class="sv-actions">
        <input type="hidden" name="view" value="${esc(view.id)}"><input type="hidden" name="version" value="${view.version}"><input type="hidden" name="custom" value="1">
        <input type="hidden" name="filter" value="${config.filter}"><input type="hidden" name="sort" value="${config.sort}">${config.columns.map(key => `<input type="hidden" name="column" value="${key}">`).join("")}
        <div class="sv-update"><button class="mero-button mero-button-primary" name="action" value="update" ${dirty ? "" : "disabled"}>Update view</button>${dirty ? `<a class="mero-button" href="${esc(savedLink)}">Reset changes</a>` : ""}</div>
        <div class="sv-duplicate"><label class="mero-label" for="sv-copy-name">New view name</label>
        <input id="sv-copy-name" class="mero-input" name="name" maxlength="60" placeholder="${esc(view.name)} copy" value="${esc(draftName)}">
        <button class="mero-button" name="action" value="copy">Save a copy</button></div>
      </form>
      <p id="sv-message" role="status" aria-live="polite">${esc(message)}</p>
    </section>`;
  }

  async function handle(req, res, url) {
    const respond = (status, body, headers = {}) => {
      res.writeHead(status, { "Content-Type": "text/html; charset=utf-8", "Cache-Control": "no-store", ...headers });
      res.end(body);
      return true;
    };
    const preview = req.method === "GET" && url.pathname === page + "/preview";
    if (!preview && !(req.method === "POST" && url.pathname === page + "/save")) return respond(404, "Unknown view action.");
    const params = preview ? url.searchParams : await readBody(req);
    if (!params) return respond(413, "Form too large.");
    let view = views.get(params.get("view"));
    if (!view) return respond(404, "View unavailable.");
    const config = readConfig(params, view.config);
    let message = "";
    let draftName = "";
    if (!preview) {
      const action = params.get("action");
      if (action === "update") {
        if (Number(params.get("version")) === view.version) {
          view.config = config;
          view.version++;
          message = "Saved changes to " + view.name + ".";
        } else message = "This view changed in another tab. Review your settings before updating it again.";
      } else if (action === "copy") {
        draftName = (params.get("name") || "").trim().slice(0, 60);
        const name = draftName || view.name + " copy";
        if ([...views.values()].some(item => item.name.toLowerCase() === name.toLowerCase())) {
          message = "That view name is already in use. Choose a different name.";
        } else {
          view = { id: randomUUID(), name, config, version: 1 };
          views.set(view.id, view);
          draftName = "";
          message = "Created " + name + ".";
        }
      } else return respond(400, "Unknown save action.");
    }
    const location = viewLink(view, config);
    if (!req.headers["hx-request"]) return respond(303, "", { Location: location });
    return respond(200, render(new URL(location, url), message, draftName), { "HX-Replace-Url": location });
  }
  return { render, handle };
}
