import { createHash } from "node:crypto";
import { escapeHtml as esc } from "./html.mjs";

const categories = ["Furniture", "Lighting", "Objects", "Textiles"];
const states = ["Active", "Draft", "Archived"];
const initialProducts = [
  { id: 1, name: "Arc Lounge Chair", sku: "RL-1042", category: "Furniture", status: "Active", accent: "lilac" },
  { id: 2, name: "Halo Pendant", sku: "RL-1078", category: "Lighting", status: "Draft", accent: "peach" },
  { id: 3, name: "Fold Side Table", sku: "RL-1116", category: "Furniture", status: "Active", accent: "mint" },
  { id: 4, name: "Forma Vase", sku: "RL-1140", category: "Objects", status: "Active", accent: "sky" },
  { id: 5, name: "Dune Throw", sku: "RL-1151", category: "Textiles", status: "Archived", accent: "rose" },
  { id: 6, name: "Arc Task Lamp", sku: "SL-204", category: "Lighting", status: "Active", accent: "peach", finish: "ivory" },
];
const finishes = { ivory: "Soft ivory", sand: "Warm sand", graphite: "Graphite" };
const art = { Furniture: "lilac", Lighting: "peach", Objects: "sky", Textiles: "rose" };
const tones = { Active: "live", Draft: "draft", Archived: "archived" };
const newProduct = { id: null, name: "", sku: "", category: "Furniture", status: "Draft" };

export function createLabStore() {
  return { products: initialProducts.map((product) => ({ ...product })), nextId: initialProducts.length + 1, revision: 0 };
}

// Compare the record that the user actually saw, including edits made via the data grid.
export function productVersion(product) {
  const fields = [product.id, product.name, product.sku, product.category, product.status, product.finish];
  return createHash("sha256").update(JSON.stringify(fields)).digest("base64url");
}

export function inventoryContext({ instance = "", basePath = "/demo/products" } = {}) {
  if (instance && !/^[a-z][a-z0-9-]{0,47}$/i.test(instance)) throw new TypeError("Invalid inventory instance");
  if (!/^\/(?:[a-zA-Z0-9_-]+\/)*[a-zA-Z0-9_-]+$/.test(basePath)) throw new TypeError("Invalid inventory route");
  const prefix = instance ? instance + "-" : "";
  return { instance, basePath, prefix };
}

function icon(name) {
  return `<span class="lab-icon lab-icon-${name}" aria-hidden="true"></span>`;
}

function options(list, selected) {
  return list.map((item) => `<option${item === selected ? " selected" : ""}>${esc(item)}</option>`).join("");
}

function getProducts(store, params) {
  const query = (params.get("q") ?? "").trim().toLowerCase();
  const category = params.get("filterCategory") ?? "";
  const matching = store.products.filter((product) =>
    (!query || `${product.name} ${product.sku}`.toLowerCase().includes(query)) &&
    (!category || product.category === category)
  );
  return params.get("order") === "name" ? matching.sort((a, b) => a.name.localeCompare(b.name)) : matching;
}

export function renderResults(store, params = new URLSearchParams(), outOfBand = false, context = inventoryContext(), changedId) {
  const { prefix, basePath } = context;
  const products = getProducts(store, params);
  return `<div id="${prefix}product-results"${outOfBand ? ' hx-swap-oob="true"' : ""}>
    <div class="lab-table-wrap">
      <table class="rl-table lab-table">
        <thead><tr><th scope="col">Product</th><th scope="col">Status</th><th scope="col">Category</th><th scope="col"><span class="lab-sr-only">Actions</span></th></tr></thead>
        <tbody>${products.map((product) => `
          <tr id="${prefix}product-${product.id}"${product.id === changedId ? " data-inventory-updated" : ""}>
            <th scope="row"><div class="lab-product">
              <span class="lab-thumbnail lab-thumbnail-${esc(product.accent)}" aria-hidden="true"><span></span></span>
              <span class="lab-product-name"><strong>${esc(product.name)}</strong><small>${esc(product.sku)}${product.finish ? " · " + esc(finishes[product.finish]) : ""}</small></span>
            </div></th>
            <td><span class="lab-status lab-status-${esc(tones[product.status])}">${esc(product.status)}</span></td>
            <td class="lab-category">${esc(product.category)}</td>
            <td class="lab-row-action"><button type="button" id="${prefix}edit-product-${product.id}" class="rl-button lab-edit" aria-label="Edit ${esc(product.name)}" aria-haspopup="dialog"
              hx-get="${basePath}/${product.id}/edit" hx-target="#${prefix}lab-overlay" hx-sync="#${prefix}lab-overlay:replace">${icon("edit")}</button></td>
          </tr>`).join("") || '<tr><td colspan="4"><div class="lab-empty"><strong>No matching products</strong><span>Try a different search or category.</span></div></td></tr>'}</tbody>
      </table>
    </div>
    <div class="lab-footer"><span role="status">${products.length === store.products.length ? products.length : `${products.length} of ${store.products.length}`} ${store.products.length === 1 ? "product" : "products"}</span><span><i></i> Server-rendered HTML</span></div>
  </div>`;
}

export function renderWorkbench(store, { expanded = false, dashboard = false, inspect = false, initial = new URLSearchParams(), instance, brand = "Studio", basePath: route } = {}) {
  const context = inventoryContext({ instance, basePath: route });
  const { prefix, basePath } = context;
  let initialDialog = "";
  const editId = initial.get("edit");
  if (editId) {
    const selected = store.products.find(product => String(product.id) === editId);
    if (selected) {
      const finish = initial.get("finish");
      const draft = selected.finish && Object.hasOwn(finishes, finish) ? { ...selected, finish } : selected;
      initialDialog = renderProductDialog(draft, {}, false, context, productVersion(selected));
    } else {
      initialDialog = '<p class="lab-request-error" role="status">This product is no longer in the catalog.</p>';
    }
  }
  return `<div class="lab${expanded ? " lab-expanded" : ""}" data-lab data-inventory-revision="${store.revision}"${context.instance ? ` hx-vals='${JSON.stringify({instance: context.instance})}'` : ""}>
    <header class="lab-header"><div class="lab-breadcrumb"><span class="lab-workspace" aria-hidden="true">${esc(brand.slice(0, 1))}</span><span>${esc(brand)}</span><span class="lab-slash">/</span><span>Inventory</span></div><span class="lab-live"><i></i> Live demo</span></header>
    <div class="lab-body">
      <div class="lab-heading"><div><h2>Products</h2><p>Manage your product catalog.</p></div>
        <button type="button" id="${prefix}add-product" class="rl-button lab-add" aria-haspopup="dialog" hx-get="${basePath}/new" hx-target="#${prefix}lab-overlay" hx-sync="#${prefix}lab-overlay:replace">${icon("plus")} <span>Add product</span></button>
      </div>
      <form id="${prefix}lab-filters" class="lab-toolbar" role="search" hx-get="${basePath}" hx-target="#${prefix}product-results-frame" hx-swap="innerHTML" hx-sync="this:replace"
        hx-trigger="submit, input changed delay:200ms from:find [type=search], change">
        <label class="lab-search">${icon("search")} <span class="lab-sr-only">Search products</span><input id="${prefix}lab-search" type="search" name="q" value="${esc(initial.get("q"))}" placeholder="Search products…" autocomplete="off"></label>
        ${dashboard ? '<input type="hidden" name="dashboard" value="1">' : ""}
        <label class="lab-filter"><span class="lab-sr-only">Filter by category</span><select class="rl-select" name="filterCategory"><option value="">All categories</option>${options(categories, initial.get("filterCategory"))}</select></label>
        ${expanded ? `<label class="lab-filter lab-order"><span class="lab-sr-only">Sort products</span><select class="rl-select" name="order"><option value="">Default order</option><option value="name"${initial.get("order") === "name" ? " selected" : ""}>Sort by name</option></select></label>` : ""}
      </form>
      <p class="lab-request-error" data-lab-request-error role="alert" hidden></p>
      <div id="${prefix}product-results-frame">${renderResults(store, initial, false, context)}</div>
      ${inspect ? `<details class="lab-scenarios" id="${prefix}lab-scenarios"><summary>Request scenarios</summary>
        <label>Next save <select class="rl-select" data-inventory-scenario><option value="">Normal response</option><option value="slow">Slow response (1 second)</option><option value="fail">Server error (500)</option><option value="invalid">Validation error (422)</option></select></label>
        <button type="button" class="rl-button rl-button-sm" hx-post="${basePath}/reset" hx-target="#${prefix}product-results-frame" hx-swap="innerHTML" hx-include="#${prefix}lab-filters">Restore sample products</button>
      </details>` : ""}
    </div>
    <div id="${prefix}lab-overlay">${initialDialog}</div>
  </div>`;
}

export function renderProductDialog(product, errors = {}, isNew = false, context = inventoryContext(), version) {
  const { prefix, basePath } = context;
  const id = product.id;
  const title = isNew ? "Add product" : "Edit product";
  return `<dialog id="${prefix}product-dialog" class="rl-dialog rl-drawer lab-dialog" data-rl-autoopen aria-labelledby="${prefix}product-dialog-title">
    <div class="rl-dialog-body lab-dialog-body">
    <header class="lab-dialog-head">
      <div><h2 id="${prefix}product-dialog-title">${title}</h2><p>${isNew ? "Create an item in your catalog." : "Update the product details."}</p></div>
      <button type="button" class="rl-button lab-dialog-close" data-rl-close aria-label="Close">×</button>
    </header>
    ${renderProductForm(product, errors, isNew, context, version)}
    ${isNew ? "" : `<div class="lab-danger-zone"><button type="button" class="rl-button lab-delete" aria-haspopup="dialog"
      hx-get="${basePath}/${id}/delete" hx-target="#${prefix}lab-confirm" hx-sync="#${prefix}lab-confirm:replace">Delete product</button></div><div id="${prefix}lab-confirm"></div>`}
    </div>
  </dialog>`;
}

export function renderProductForm(product, errors = {}, isNew = false, context = inventoryContext(), version = productVersion(product)) {
  const { prefix, basePath } = context;
  const action = isNew ? basePath : `${basePath}/${product.id}`;
  const textField = (name, label, value, maxLength, autofocus = false) => `<label class="lab-field" for="${prefix}product-${name}"><span>${label}</span>
    <input class="rl-input" id="${prefix}product-${name}" name="${name}" value="${esc(value)}" maxlength="${maxLength}" required${autofocus ? " autofocus" : ""}${errors[name] ? ` aria-invalid="true" aria-describedby="${prefix}error-${name}"` : ""}>
    ${errors[name] ? `<small id="${prefix}error-${name}" class="lab-field-error">${esc(errors[name])}</small>` : ""}</label>`;
  return `<form class="lab-form" data-rl-form data-rl-return-focus="#${prefix}${isNew ? "add-product" : `edit-product-${product.id}`}" data-rl-fallback-focus="#${prefix}add-product"
      hx-post="${action}" hx-target="this" hx-swap="outerHTML" hx-sync="this:drop" hx-include="#${prefix}lab-filters">
    ${isNew ? "" : `<input type="hidden" name="productVersion" value="${esc(version)}">`}
    ${textField("name", "Product name", product.name, 80, true)}
    ${textField("sku", "SKU", product.sku, 24)}
    ${product.finish ? `<label class="lab-field"><span>Finish</span><select class="rl-select" name="finish"${errors.finish ? ` aria-invalid="true" aria-describedby="${prefix}error-finish"` : ""}>${Object.entries(finishes).map(([value, label]) => `<option value="${value}"${value === product.finish ? " selected" : ""}>${label}</option>`).join("")}</select>${errors.finish ? `<small id="${prefix}error-finish" class="lab-field-error">Choose a finish.</small>` : ""}</label>` : ""}
    <label class="lab-field"><span>Category</span><select class="rl-select" name="category"${errors.category ? ` aria-invalid="true" aria-describedby="${prefix}error-category"` : ""}>${options(categories, product.category)}</select>${errors.category ? `<small id="${prefix}error-category" class="lab-field-error">Choose a category.</small>` : ""}</label>
    <label class="lab-field"><span>Status</span><select class="rl-select" name="status"${errors.status ? ` aria-invalid="true" aria-describedby="${prefix}error-status"` : ""}>${options(states, product.status)}</select>${errors.status ? `<small id="${prefix}error-status" class="lab-field-error">Choose a status.</small>` : ""}</label>
    <p data-rl-form-error class="lab-field-error" role="alert" hidden></p>
    <footer class="lab-form-actions"><button type="button" class="rl-button lab-cancel" data-rl-close>Cancel</button><button type="submit" class="rl-button lab-add">${isNew ? "Create product" : "Save changes"}</button></footer>
  </form>`;
}

export function renderDelete(product, context = inventoryContext()) {
  const { prefix, basePath } = context;
  return `<dialog class="rl-dialog lab-confirm-dialog" id="${prefix}confirm-delete" data-rl-autoopen aria-labelledby="${prefix}confirm-delete-title">
    <div class="rl-dialog-body lab-dialog-body"><h2 id="${prefix}confirm-delete-title">Delete ${esc(product.name)}?</h2><p>This removes the product from your catalog.</p>
    <form data-rl-form data-rl-close-all data-rl-return-focus="#${prefix}add-product" hx-post="${basePath}/${product.id}/delete" hx-target="this" hx-swap="outerHTML" hx-sync="this:drop" hx-include="#${prefix}lab-filters">
      <input type="hidden" name="productVersion" value="${productVersion(product)}">
      <p data-rl-form-error class="lab-field-error" role="alert" hidden></p>
      <footer class="lab-form-actions"><button type="button" class="rl-button lab-cancel" data-rl-close autofocus>Cancel</button><button type="submit" class="rl-button lab-delete-solid">Delete product</button></footer>
    </form></div>
  </dialog>`;
}

export function saveProduct(store, current, input, validationErrors = {}) {
  const product = {
    ...(current ?? newProduct),
    name: (input.get("name") ?? "").trim(),
    sku: (input.get("sku") ?? "").trim(),
    category: input.get("category"),
    status: input.get("status"),
  };
  const errors = { ...validationErrors };
  if (!product.name || product.name.length > 80) errors.name = "Enter a product name up to 80 characters.";
  if (!product.sku || product.sku.length > 24) errors.sku = "Enter a SKU up to 24 characters.";
  else if (store.products.some((other) => other.id !== product.id && other.sku.toLowerCase() === product.sku.toLowerCase())) errors.sku = "A product already uses this SKU.";
  if (!categories.includes(product.category)) errors.category = true;
  if (!states.includes(product.status)) errors.status = true;
  if (current?.finish && input.has("finish")) {
    if (Object.hasOwn(finishes, input.get("finish"))) product.finish = input.get("finish");
    else errors.finish = true;
  }
  if (Object.keys(errors).length) return { errors, product };
  if (current) Object.assign(current, product, { accent: current.category === product.category ? current.accent : art[product.category] });
  else {
    product.id = store.nextId++;
    product.accent = art[product.category];
    store.products.push(product);
  }
  store.revision++;
  return { errors: null, product };
}

export function blankProductDialog(context) {
  return renderProductDialog(newProduct, {}, true, context);
}
