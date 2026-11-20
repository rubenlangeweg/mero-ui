import { escapeHtml as esc } from "./html.mjs";
import { inventoryContext, renderWorkbench } from "./lab.mjs";

export function layoutMarkup(screen, content, { brand = "Studio", navigation = [{ id: "dashboard", href: "/layouts/dashboard", label: "Overview" }, { id: "inventory", href: "/layouts/dashboard?view=inventory", label: "Inventory" }, { id: "settings", href: "/layouts/settings", label: "Settings" }] } = {}) {
  return `<div class="mero-app">
  <aside class="mero-app-nav">
    <span class="mero-app-brand"><span aria-hidden="true" class="mero-app-monogram">${esc(brand.slice(0, 1))}</span>${esc(brand)}</span>
    <nav aria-label="Workspace">
      ${navigation.map(link => `<a href="${esc(link.href)}"${screen === link.id ? ' aria-current="page"' : ""}>${esc(link.label)}</a>`).join("")}
    </nav>
  </aside>
  <section class="mero-app-main" aria-label="Workspace content">
    ${content}
  </section>
</div>`;
}

export function renderSettingsForm(settings, error = "", { nested = false, formAttrs = 'data-mero-form hx-post="/demo/settings" hx-target="this" hx-swap="outerHTML"' } = {}) {
  const heading = nested ? "h3" : "h2";
  return `<form class="mero-settings" id="layout-settings" data-mero-return-focus="#settings-save" ${formAttrs}>
    <section aria-labelledby="workspace-details">
      <${heading} id="workspace-details">General</${heading}>
      <p>Choose the name your team sees in the workspace.</p>
      <div class="mero-field">
        <label class="mero-label" for="workspace-name">Workspace name</label>
        <input class="mero-input" id="workspace-name" name="name" required maxlength="48" value="${esc(settings.name)}"${error ? ' aria-invalid="true" aria-describedby="workspace-error"' : ""}>
        ${error ? `<small class="mero-field-error" id="workspace-error">${esc(error)}</small>` : ""}
      </div>
    </section>
    <section aria-labelledby="workspace-notifications">
      <${heading} id="workspace-notifications">Notifications</${heading}>
      <label class="mero-row"><input type="checkbox" class="mero-switch" role="switch" name="digest" value="on"${settings.digest ? " checked" : ""}> Weekly inventory digest</label>
    </section>
    <p role="alert" data-mero-form-error hidden></p>
    <div class="mero-settings-actions"><button class="mero-button mero-button-primary" id="settings-save" type="submit">Save settings</button></div>
  </form>`;
}

export function renderLayout(screen, store, settings, options = {}) {
  const heading = options.pageHeading ? "h1" : "h2";
  const content = screen === "settings"
    ? `<header class="mero-page-head"><div><${heading}>Settings</${heading}><p>Manage your workspace preferences.</p></div></header>
    ${renderSettingsForm(settings, "", { nested: !options.pageHeading })}`
    : `<header class="mero-page-head"><div><${heading}>Catalog overview</${heading}><p>Browse and manage the studio catalog.</p></div></header>
    ${renderStats(store, false, inventoryContext(options))}
    ${renderWorkbench(store, { ...options, expanded: true, dashboard: true })}`;
  return layoutMarkup(screen, content, options);
}

export function renderStats(store, outOfBand = false, { prefix = "" } = {}) {
  const products = store.products;
  const active = products.filter(product => product.status === "Active").length;
  const drafts = products.filter(product => product.status === "Draft").length;
  const categories = new Map();
  for (const product of products) categories.set(product.category, (categories.get(product.category) || 0) + 1);
  const total = products.length;
  const share = total ? Math.round(active * 100 / total) : 0;
  const leading = [...categories].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))[0];
  return `<dl id="${prefix}dashboard-stats" class="mero-stat-grid"${outOfBand ? ' hx-swap-oob="true"' : ""}>
    <div class="mero-stat"><dt>Products</dt><dd>${total}<small>${drafts} in draft</small></dd></div>
    <div class="mero-stat"><dt>Active</dt><dd>${active}<small><span class="mero-stat-meter" aria-hidden="true" style="--mero-stat-value:${share}%"></span>${share}% of catalog</small></dd></div>
    <div class="mero-stat"><dt>Categories</dt><dd>${categories.size}<small>${leading ? `${leading[1]} in ${esc(leading[0])}` : "No categories yet"}</small></dd></div>
  </dl>`;
}
