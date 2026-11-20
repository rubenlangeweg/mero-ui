import { escapeHtml as esc } from "./html.mjs";
import { inventoryContext, renderWorkbench } from "./lab.mjs";

export function layoutMarkup(screen, content, { brand = "Studio", navigation = [{ id: "dashboard", href: "/layouts/dashboard", label: "Overview" }, { id: "inventory", href: "/layouts/dashboard?view=inventory", label: "Inventory" }, { id: "settings", href: "/layouts/settings", label: "Settings" }] } = {}) {
  return `<div class="rl-app">
  <aside class="rl-app-nav">
    <span class="rl-app-brand"><span aria-hidden="true" class="rl-app-monogram">${esc(brand.slice(0, 1))}</span>${esc(brand)}</span>
    <nav aria-label="Workspace">
      ${navigation.map(link => `<a href="${esc(link.href)}"${screen === link.id ? ' aria-current="page"' : ""}>${esc(link.label)}</a>`).join("")}
    </nav>
  </aside>
  <section class="rl-app-main" aria-label="Workspace content">
    ${content}
  </section>
</div>`;
}

export function renderSettingsForm(settings, error = "", { nested = false, formAttrs = 'data-rl-form hx-post="/demo/settings" hx-target="this" hx-swap="outerHTML"' } = {}) {
  const heading = nested ? "h3" : "h2";
  return `<form class="rl-settings" id="layout-settings" data-rl-return-focus="#settings-save" ${formAttrs}>
    <section aria-labelledby="workspace-details">
      <${heading} id="workspace-details">General</${heading}>
      <p>Choose the name your team sees in the workspace.</p>
      <div class="rl-field">
        <label class="rl-label" for="workspace-name">Workspace name</label>
        <input class="rl-input" id="workspace-name" name="name" required maxlength="48" value="${esc(settings.name)}"${error ? ' aria-invalid="true" aria-describedby="workspace-error"' : ""}>
        ${error ? `<small class="rl-field-error" id="workspace-error">${esc(error)}</small>` : ""}
      </div>
    </section>
    <section aria-labelledby="workspace-notifications">
      <${heading} id="workspace-notifications">Notifications</${heading}>
      <label class="rl-row"><input type="checkbox" class="rl-switch" role="switch" name="digest" value="on"${settings.digest ? " checked" : ""}> Weekly inventory digest</label>
    </section>
    <p role="alert" data-rl-form-error hidden></p>
    <div class="rl-settings-actions"><button class="rl-button rl-button-primary" id="settings-save" type="submit">Save settings</button></div>
  </form>`;
}

export function renderLayout(screen, store, settings, options = {}) {
  const heading = options.pageHeading ? "h1" : "h2";
  const content = screen === "settings"
    ? `<header class="rl-page-head"><div><${heading}>Settings</${heading}><p>Manage your workspace preferences.</p></div></header>
    ${renderSettingsForm(settings, "", { nested: !options.pageHeading })}`
    : `<header class="rl-page-head"><div><${heading}>Catalog overview</${heading}><p>Browse and manage the studio catalog.</p></div></header>
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
  return `<dl id="${prefix}dashboard-stats" class="rl-stat-grid"${outOfBand ? ' hx-swap-oob="true"' : ""}>
    <div class="rl-stat"><dt>Products</dt><dd>${total}<small>${drafts} in draft</small></dd></div>
    <div class="rl-stat"><dt>Active</dt><dd>${active}<small><span class="rl-stat-meter" aria-hidden="true" style="--rl-stat-value:${share}%"></span>${share}% of catalog</small></dd></div>
    <div class="rl-stat"><dt>Categories</dt><dd>${categories.size}<small>${leading ? `${leading[1]} in ${esc(leading[0])}` : "No categories yet"}</small></dd></div>
  </dl>`;
}
