// Zero-dependency Node 22+ full-flow Mero UI reference starter.
// Demonstrates CRUD, per-client CSRF (403), validation (422), optimistic concurrency (409),
// multi-select channels, conditional fields, draft leave guard, typed confirmation
// delete, boosted navigation, and live polling with server interval + 401 redirect.
import { createServer } from "node:http";
import { randomBytes, timingSafeEqual } from "node:crypto";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";

const repoRoot = fileURLToPath(new URL("../../../", import.meta.url));
const CHANNELS = [
  { value: "web", label: "Web" },
  { value: "b2b", label: "B2B" },
  { value: "pos", label: "POS" },
  { value: "marketplace", label: "Marketplace" },
];
const STATUSES = ["Draft", "Active", "Archived"];

class HttpError extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
  }
}

function esc(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

// HTTP headers must be pure ASCII so Unicode product names never throw ERR_INVALID_CHAR.
function asciiJson(value) {
  return JSON.stringify(value).replace(/[^\x20-\x7e]/g, ch => "\\u" + ch.charCodeAt(0).toString(16).padStart(4, "0"));
}

function asciiHeader(value) {
  return String(value ?? "").replace(/[^\x20-\x7e]/g, "?");
}

function parseCookies(header) {
  const out = Object.create(null);
  for (const part of String(header || "").split(";")) {
    const idx = part.indexOf("=");
    if (idx === -1) continue;
    const key = part.slice(0, idx).trim();
    const raw = part.slice(idx + 1).trim();
    if (!key) continue;
    try { out[key] = decodeURIComponent(raw); } catch { out[key] = raw; }
  }
  return out;
}

function safeEqual(a, b) {
  const ba = Buffer.from(String(a || ""));
  const bb = Buffer.from(String(b || ""));
  return ba.length === bb.length && ba.length > 0 && timingSafeEqual(ba, bb);
}

async function readForm(request) {
  const chunks = [];
  let size = 0;
  for await (const chunk of request) {
    size += chunk.length;
    if (size > 32768) throw new HttpError(413, "Payload too large.");
    chunks.push(chunk);
  }
  return new URLSearchParams(Buffer.concat(chunks).toString("utf8"));
}

function send(response, body, { status = 200, type = "text/html; charset=utf-8", headers = {} } = {}) {
  response.writeHead(status, {
    "Content-Type": type,
    "Cache-Control": "no-store",
    "X-Content-Type-Options": "nosniff",
    ...headers,
  });
  response.end(body);
}

function renderMultiselect(selected) {
  const set = new Set(selected);
  const chips = CHANNELS.filter(ch => set.has(ch.value)).map(ch =>
    `<li class="mero-chip" data-value="${esc(ch.value)}">${esc(ch.label)}` +
    `<input type="hidden" name="channels" value="${esc(ch.value)}">` +
    `<button type="button" aria-label="Remove ${esc(ch.label)}" data-mero-multiselect-remove>×</button></li>`
  ).join("");
  const options = CHANNELS.map(ch =>
    `<li id="opt-ch-${esc(ch.value)}" role="option" data-value="${esc(ch.value)}" aria-selected="${set.has(ch.value) ? "true" : "false"}">${esc(ch.label)}</li>`
  ).join("");
  return `<div id="channels-picker" class="mero-multiselect" data-mero-multiselect data-mero-combo data-mero-multiselect-name="channels">
    <div class="mero-multiselect-control">
      <ul class="mero-tag-group mero-multiselect-chips" data-mero-multiselect-chips>${chips}</ul>
      <input id="channels-input" class="mero-multiselect-input" type="text" role="combobox" aria-label="Sales channels"
             placeholder="Add channel…" aria-expanded="false" aria-controls="channels-listbox" aria-autocomplete="list" autocomplete="off">
    </div>
    <ul id="channels-listbox" class="mero-listbox mero-combo-list" role="listbox" aria-multiselectable="true" hidden>${options}</ul>
    <span data-mero-combo-status role="status" class="mero-sr-only"></span>
  </div>`;
}

function renderProductRows(products) {
  if (products.length === 0) {
    return `<p class="mero-muted">No products left.</p>`;
  }
  return `<div class="mero-table-wrap">
    <table class="mero-table">
      <thead><tr><th scope="col">Product</th><th scope="col">SKU</th><th scope="col">Status</th><th scope="col">Channels</th><th scope="col">Rev</th><th scope="col">Actions</th></tr></thead>
      <tbody>
        ${products.map(item => `<tr id="product-row-${item.id}">
          <th scope="row">${esc(item.name)}</th>
          <td><code>${esc(item.sku)}</code></td>
          <td><span class="mero-badge">${esc(item.status)}</span></td>
          <td>${item.channels.map(c => `<span class="mero-chip">${esc(c)}</span>`).join(" ")}</td>
          <td>v${item.version}</td>
          <td class="mero-inline-actions">
            <a class="mero-button mero-button-sm" href="/products/${item.id}/edit">Edit</a>
            <button type="button" class="mero-button mero-button-sm" data-mero-action
                    hx-post="/products/${item.id}/bump" hx-target="#product-table" hx-swap="outerHTML">Simulate external edit</button>
            <button type="button" class="mero-button mero-button-sm mero-button-danger"
                    hx-get="/products/${item.id}/delete" hx-target="#dialog-host" hx-swap="innerHTML">Delete</button>
          </td>
        </tr>`).join("")}
      </tbody>
    </table>
  </div>`;
}

function renderEditForm(draft, { csrfToken, errors = {}, conflict = null, notice = "" } = {}) {
  const errFor = field => errors[field]
    ? `<p id="err-${field}" class="mero-field-error">${esc(errors[field])}</p>`
    : "";
  const invalidAttr = field => errors[field] ? ` aria-invalid="true" aria-describedby="err-${field}"` : "";
  const conflictPanel = conflict ? `<div class="mero-callout mero-callout-warning" role="alert" data-mero-conflict-focus tabindex="-1">
    <strong>Conflict (HTTP 409):</strong> Another edit saved revision v${conflict.version} (<em>${esc(conflict.name)}</em>, ${esc(conflict.status)}) while you were editing.
    Review your draft below and save again to overwrite v${conflict.version}.
  </div>` : "";
  const showNote = draft.status !== "Draft";
  const dirtyAttr = conflict || Object.keys(errors).length > 0 ? 'data-mero-dirty="dirty"' : "data-mero-dirty";
  return `<form id="product-edit-form" class="mero-stack" data-mero-form ${dirtyAttr}
                data-mero-dirty-guard="You have unsaved product edits. Leave anyway?"
                data-mero-conflict-swap
                hx-post="/products/${draft.id}" hx-target="this" hx-swap="outerHTML">
    <input type="hidden" name="csrf" value="${esc(csrfToken)}">
    <input type="hidden" name="version" value="${esc(conflict ? conflict.version : draft.version)}">
    ${conflictPanel}
    ${notice ? `<p class="mero-callout" role="status">${esc(notice)}</p>` : ""}
    <p data-mero-form-error class="mero-field-error" hidden></p>
    <div class="mero-field">
      <label for="field-name">Product name</label>
      <input id="field-name" class="mero-input" name="name" value="${esc(draft.name)}"${invalidAttr("name")}>
      ${errFor("name")}
    </div>
    <div class="mero-field">
      <label for="field-sku">SKU (e.g. RL-1001)</label>
      <input id="field-sku" class="mero-input" name="sku" value="${esc(draft.sku)}"${invalidAttr("sku")}>
      ${errFor("sku")}
    </div>
    <div class="mero-field">
      <label for="field-status">Status</label>
      <select id="field-status" class="mero-select" name="status">
        ${STATUSES.map(status => `<option value="${esc(status)}"${draft.status === status ? " selected" : ""}>${esc(status)}</option>`).join("")}
      </select>
    </div>
    <fieldset class="mero-field" data-mero-show-when="status!=Draft"${showNote ? "" : " hidden disabled"}>
      <label for="field-note">Publishing note</label>
      <input id="field-note" class="mero-input" name="publishedNote" value="${esc(draft.publishedNote || "")}">
    </fieldset>
    <div class="mero-field">
      <label for="channels-input">Sales channels</label>
      ${renderMultiselect(draft.channels)}
      ${errFor("channels")}
    </div>
    <div class="mero-inline-actions">
      <button type="submit" class="mero-button mero-button-primary">Save product</button>
      <a class="mero-button" href="/">Back to products</a>
    </div>
  </form>`;
}

function renderDeleteForm(product, { csrfToken, errors = {}, phrase = "", reason = "" } = {}) {
  const expected = `delete ${product.sku}`;
  return `<form id="delete-form" class="mero-stack" data-mero-form data-mero-confirm
        hx-post="/products/${product.id}/delete" hx-target="this" hx-swap="outerHTML">
    <input type="hidden" name="csrf" value="${esc(csrfToken)}">
    <h2>Delete ${esc(product.name)}</h2>
    <p>Type <code class="mero-confirm-phrase" data-mero-confirm-phrase>${esc(expected)}</code> and give a reason (8+ characters) to permanently delete this product.</p>
    <p data-mero-form-error class="mero-field-error" hidden></p>
    <div class="mero-field">
      <label for="confirm-phrase">Confirmation phrase</label>
      <input id="confirm-phrase" class="mero-input" name="phrase" value="${esc(phrase)}" data-mero-confirm-input required
             ${errors.phrase ? 'aria-invalid="true" aria-describedby="err-phrase"' : ""}>
      ${errors.phrase ? `<p id="err-phrase" class="mero-field-error">${esc(errors.phrase)}</p>` : ""}
    </div>
    <div class="mero-field">
      <label for="confirm-reason">Reason</label>
      <input id="confirm-reason" class="mero-input" name="reason" value="${esc(reason)}" data-mero-confirm-reason required
             ${errors.reason ? 'aria-invalid="true" aria-describedby="err-reason"' : ""}>
      ${errors.reason ? `<p id="err-reason" class="mero-field-error">${esc(errors.reason)}</p>` : ""}
    </div>
    <p data-mero-confirm-hint class="mero-muted"></p>
    <div class="mero-inline-actions">
      <button type="submit" class="mero-button mero-button-danger" data-mero-confirm-submit disabled>Delete product</button>
      <button type="button" class="mero-button" data-mero-close>Cancel</button>
    </div>
  </form>`;
}

function renderDeleteDialog(product, options = {}) {
  return `<dialog id="delete-dialog" class="mero-dialog" role="alertdialog" data-mero-dialog data-mero-static data-mero-autoopen>
    <div class="mero-dialog-body">${renderDeleteForm(product, options)}</div>
  </dialog>`;
}

function renderExportWidget(job) {
  if (!job) {
    return `<section id="export-card" class="mero-card mero-stack">
      <h2>Catalog export</h2>
      <p class="mero-muted">Demonstrates <code>data-mero-live</code>, <code>Mero-Live-Interval</code>, <code>Mero-Live: done</code> and 401 <code>HX-Redirect</code>.</p>
      <div class="mero-inline-actions">
        <button type="button" class="mero-button" hx-post="/exports" hx-target="#export-card" hx-swap="outerHTML">Start export</button>
        <button type="button" class="mero-button" hx-post="/exports?expired=1" hx-target="#export-card" hx-swap="outerHTML">Start export (401 session expiry)</button>
      </div>
    </section>`;
  }
  const suffix = job.expireNext ? "?expired=1" : "";
  return `<section id="export-card" class="mero-card mero-stack" data-mero-live="1500" data-mero-live-follow
                   hx-get="/exports/${esc(job.id)}/status${suffix}" hx-trigger="mero:refresh" hx-target="find [data-mero-live-status]">
    <h2>Catalog export #${esc(job.id)}</h2>
    <div data-mero-live-status role="status">Queued…</div>
    <p data-mero-live-error class="mero-field-error" hidden></p>
    <button type="button" class="mero-button mero-button-sm" data-mero-live-retry hidden>Retry now</button>
  </section>`;
}

function renderPage({ title, main, csrfToken }) {
  return `<!doctype html>
<html lang="en" data-theme="auto">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <meta name="csrf-token" content="${esc(csrfToken)}">
  <title>${esc(title)} · Mero UI Starter</title>
  <link rel="stylesheet" href="/ui/mero.css">
  <script defer src="/vendor/htmx.min.js"></script>
  <script defer src="/ui/mero.js"></script>
  <script defer src="/ui/mero-forms.js"></script>
  <script defer src="/ui/mero-live.js"></script>
  <script>
    document.addEventListener("htmx:config:request", (e) => {
      const token = document.querySelector('meta[name="csrf-token"]')?.content;
      if (token && e.detail?.ctx?.request?.headers) e.detail.ctx.request.headers["X-CSRF-Token"] = token;
    });
  </script>
</head>
<body hx-boost:inherited="true" data-mero-boost="#app-main">
  <header class="mero-container" style="padding-block: 1rem;">
    <nav aria-label="Primary" class="mero-inline-actions">
      <a href="/">Products</a>
      <a href="/login">Sign in</a>
    </nav>
  </header>
  <main id="app-main" class="mero-container mero-stack" tabindex="-1">
    ${main}
  </main>
  <div id="dialog-host"></div>
</body>
</html>`;
}

export function createStarterApp({ assetsDir = process.env.MERO_ASSETS_DIR || resolve(repoRoot, "ui"), vendorDir = resolve(repoRoot, "public/vendor") } = {}) {
  const sessions = new Set();
  const initialProducts = () => [
    { id: 1, name: "Arc Task Lamp", sku: "RL-1001", status: "Active", publishedNote: "Spring catalog", channels: ["web", "b2b"], version: 1 },
    { id: 2, name: "Halo Pendant", sku: "RL-1002", status: "Draft", publishedNote: "", channels: ["web"], version: 1 },
  ];
  const store = {
    products: initialProducts(),
    jobs: new Map(),
    nextJobId: 1,
  };

  function reset() {
    store.products = initialProducts();
    store.jobs.clear();
    store.nextJobId = 1;
  }

  function issueCsrf(request) {
    const existing = parseCookies(request.headers.cookie).mero_csrf;
    if (existing && sessions.has(existing)) return { token: existing, cookie: null };
    const token = randomBytes(16).toString("hex");
    sessions.add(token);
    return { token, cookie: `mero_csrf=${encodeURIComponent(token)}; Path=/; HttpOnly; SameSite=Lax` };
  }

  function verifyCsrf(request, params) {
    const cookieToken = parseCookies(request.headers.cookie).mero_csrf;
    if (!cookieToken || !sessions.has(cookieToken)) return false;
    const submitted = request.headers["x-csrf-token"] || params?.get("csrf") || "";
    return safeEqual(submitted, cookieToken);
  }

  async function serveStatic(pathname, response) {
    const allowed = new Map([
      ["/ui/mero.css", [resolve(assetsDir, "mero.css"), "text/css; charset=utf-8"]],
      ["/ui/mero.js", [resolve(assetsDir, "mero.js"), "text/javascript; charset=utf-8"]],
      ["/ui/mero-forms.js", [resolve(assetsDir, "mero-forms.js"), "text/javascript; charset=utf-8"]],
      ["/ui/mero-live.js", [resolve(assetsDir, "mero-live.js"), "text/javascript; charset=utf-8"]],
      ["/vendor/htmx.min.js", [resolve(vendorDir, "htmx.min.js"), "text/javascript; charset=utf-8"]],
    ]);
    const entry = allowed.get(pathname);
    if (!entry) return false;
    const content = await readFile(entry[0]);
    send(response, content, { type: entry[1] });
    return true;
  }

  async function routeRequest(request, response) {
    let url;
    try {
      url = new URL(request.url, "http://127.0.0.1");
    } catch {
      throw new HttpError(400, "Bad request URL.");
    }
    const { pathname, searchParams } = url;
    const method = request.method || "GET";

    if (method === "GET" && await serveStatic(pathname, response)) return;

    const session = issueCsrf(request);
    const cookieHeaders = session.cookie ? { "Set-Cookie": session.cookie } : {};

    if (method === "GET" && (pathname === "/" || pathname === "/products")) {
      const main = `<h1>Products</h1>
        <div id="product-table">${renderProductRows(store.products)}</div>
        ${renderExportWidget(null)}`;
      return send(response, renderPage({ title: "Products", main, csrfToken: session.token }), { headers: cookieHeaders });
    }

    if (method === "GET" && pathname === "/login") {
      const main = `<h1>Session expired</h1><p>Your session expired while polling. <a href="/">Return to products</a>.</p>`;
      return send(response, renderPage({ title: "Sign in", main, csrfToken: session.token }), { headers: cookieHeaders });
    }

    const editMatch = pathname.match(/^\/products\/(\d+)\/edit$/);
    if (method === "GET" && editMatch) {
      const product = store.products.find(p => p.id === Number(editMatch[1]));
      if (!product) return send(response, "Not found", { status: 404 });
      const main = `<h1>Edit ${esc(product.name)}</h1>${renderEditForm(product, { csrfToken: session.token })}`;
      return send(response, renderPage({ title: `Edit ${product.name}`, main, csrfToken: session.token }), { headers: cookieHeaders });
    }

    const bumpMatch = pathname.match(/^\/products\/(\d+)\/bump$/);
    if (method === "POST" && bumpMatch) {
      const params = await readForm(request);
      if (!verifyCsrf(request, params)) {
        return send(response, "Forbidden", {
          status: 403,
          headers: { "Mero-Action-Outcome": "rejected", "Mero-Action-Message": "Invalid CSRF token." },
        });
      }
      const product = store.products.find(p => p.id === Number(bumpMatch[1]));
      if (!product) return send(response, "Not found", { status: 404 });
      product.version += 1;
      product.name = product.name.replace(/ \(rev \d+\)$/, "") + ` (rev ${product.version})`;
      return send(response, `<div id="product-table">${renderProductRows(store.products)}</div>`, {
        headers: {
          "Mero-Action-Outcome": "succeeded",
          "Mero-Action-Message": asciiHeader(`External edit bumped ${product.sku} to v${product.version}.`),
        },
      });
    }

    const saveMatch = pathname.match(/^\/products\/(\d+)$/);
    if (method === "POST" && saveMatch) {
      const params = await readForm(request);
      if (!verifyCsrf(request, params)) {
        return send(response, "Invalid CSRF token.", {
          status: 403,
          headers: { "Mero-Action-Outcome": "rejected", "Mero-Action-Message": "Invalid CSRF token." },
        });
      }
      const product = store.products.find(p => p.id === Number(saveMatch[1]));
      if (!product) return send(response, "Not found", { status: 404 });

      const draft = {
        id: product.id,
        name: (params.get("name") || "").trim(),
        sku: (params.get("sku") || "").trim().toUpperCase(),
        status: STATUSES.includes(params.get("status")) ? params.get("status") : product.status,
        publishedNote: (params.get("publishedNote") || "").trim(),
        channels: params.getAll("channels").filter(v => CHANNELS.some(c => c.value === v)),
        version: Number(params.get("version") || 0),
      };

      const errors = {};
      if (!draft.name) errors.name = "Product name is required.";
      if (!/^[A-Z]{2,4}-\d{3,4}$/.test(draft.sku)) errors.sku = "SKU must match pattern like RL-1001.";
      if (draft.channels.length === 0) errors.channels = "Select at least one sales channel.";
      if (Object.keys(errors).length > 0) {
        return send(response, renderEditForm(draft, { csrfToken: session.token, errors }), { status: 422 });
      }

      if (draft.version !== product.version) {
        return send(response, renderEditForm(draft, { csrfToken: session.token, conflict: product }), {
          status: 409,
          headers: { "Mero-Form-Error": "Record changed on the server. Review and save again." },
        });
      }

      Object.assign(product, {
        name: draft.name,
        sku: draft.sku,
        status: draft.status,
        publishedNote: draft.status === "Draft" ? "" : draft.publishedNote,
        channels: draft.channels,
        version: product.version + 1,
      });
      const trigger = asciiJson({ "mero:form-saved": { message: `Saved ${product.name} (v${product.version}).` } });
      return send(response, renderEditForm(product, { csrfToken: session.token, notice: `Saved revision v${product.version}.` }), {
        headers: { "HX-Trigger": trigger },
      });
    }

    const deleteMatch = pathname.match(/^\/products\/(\d+)\/delete$/);
    if (deleteMatch) {
      const product = store.products.find(p => p.id === Number(deleteMatch[1]));
      if (!product) return send(response, "Not found", { status: 404 });
      if (method === "GET") {
        return send(response, renderDeleteDialog(product, { csrfToken: session.token }), { headers: cookieHeaders });
      }
      if (method === "POST") {
        const params = await readForm(request);
        if (!verifyCsrf(request, params)) {
          return send(response, "Invalid CSRF token.", {
            status: 403,
            headers: { "Mero-Action-Outcome": "rejected", "Mero-Action-Message": "Invalid CSRF token." },
          });
        }
        const phrase = (params.get("phrase") || "").trim();
        const reason = (params.get("reason") || "").trim();
        const errors = {};
        if (phrase !== `delete ${product.sku}`) errors.phrase = `Enter "delete ${product.sku}" exactly.`;
        if (reason.length < 8) errors.reason = "Reason must be at least 8 characters.";
        if (Object.keys(errors).length > 0) {
          return send(response, renderDeleteForm(product, { csrfToken: session.token, errors, phrase, reason }), { status: 422 });
        }
        store.products = store.products.filter(p => p.id !== product.id);
        const trigger = asciiJson({ "mero:form-saved": { message: `Deleted ${product.name}.`, target: "#delete-form" } });
        return send(response, `<div id="product-table" hx-swap-oob="outerHTML">${renderProductRows(store.products)}</div>`, {
          headers: { "HX-Reswap": "none", "HX-Trigger": trigger },
        });
      }
    }

    if (method === "POST" && pathname === "/exports") {
      const params = await readForm(request);
      if (!verifyCsrf(request, params)) {
        return send(response, "Invalid CSRF token.", { status: 403 });
      }
      const id = String(store.nextJobId++);
      const job = { id, step: 0, expireNext: searchParams.get("expired") === "1" };
      store.jobs.set(id, job);
      return send(response, renderExportWidget(job));
    }

    const exportStatusMatch = pathname.match(/^\/exports\/(\d+)\/status$/);
    if (method === "GET" && exportStatusMatch) {
      const job = store.jobs.get(exportStatusMatch[1]);
      if (!job) return send(response, "Not found", { status: 404 });
      if (searchParams.get("expired") === "1" || request.headers["x-simulate-expired"] === "1") {
        return send(response, "Unauthorized", { status: 401, headers: { "HX-Redirect": "/login" } });
      }
      job.step += 1;
      if (job.step === 1) {
        return send(response, `<p>Exporting catalog… 50%</p>`, { headers: { "Mero-Live-Interval": "800" } });
      }
      return send(response, `<p><strong>Export ready:</strong> 2 products exported.</p>`, {
        headers: { "Mero-Live": "done" },
      });
    }

    send(response, "Not found", { status: 404 });
  }

  async function handler(request, response) {
    try {
      await routeRequest(request, response);
    } catch (error) {
      const status = error instanceof HttpError ? error.status : 400;
      if (!response.headersSent) send(response, error.message || "Bad request.", { status, type: "text/plain; charset=utf-8" });
    }
  }

  return { handler, store, reset };
}

const isMain = process.argv[1] && resolve(process.argv[1]) === resolve(fileURLToPath(import.meta.url));
if (isMain) {
  const port = Number(process.env.PORT || 4181);
  const { handler } = createStarterApp();
  createServer(handler).listen(port, "127.0.0.1", () => {
    console.log(`Mero UI full-flow starter listening on http://127.0.0.1:${port}`);
  });
}
