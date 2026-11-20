import { components, groups, moduleAssets, catalogGroupId } from "./catalog.mjs";
import { codePanel, interactiveExample, selectVariant } from "./examples.mjs";
import { escapeHtml as esc } from "./html.mjs";
import { assetStyles, assetScripts } from "./shell.mjs";

export function catalogIndex() {
  return `<header class="docs-heading"><h1>Components</h1><p>Explore ${components.size} interactive HTML examples. Open a component to try it, inspect its markup and get the assets.</p></header>
    <div class="catalog-featured" data-catalog-featured>
      <a class="catalog-feature catalog-feature-photo" href="/components/carousel"><img src="/studio-lamp.webp" alt="" width="1120" height="747"><span><strong>Media gallery</strong><small>Finishes, thumbnails and touch</small></span></a>
      <a class="catalog-feature catalog-feature-grid" href="/components/data-grid"><span class="mini-stock" aria-hidden="true"><span>Product <i>Status</i></span><span>Arc Task Lamp <i>Active</i></span><span>Forma Vase <i>Draft</i></span></span><span><strong>Editable collection</strong><small>Sort, select and edit rows</small></span></a>
    </div>
    <label class="catalog-family-picker">Browse by family
      <select class="mero-select" data-catalog-family><option value="">All families</option>${groups.map((group) => `<option value="${catalogGroupId(group.name)}">${esc(group.name)}</option>`).join("")}</select>
    </label>
    ${groups
      .map(
        (group) => `<section class="catalog-category" id="${catalogGroupId(group.name)}"><h2>${esc(group.name)}</h2>
      <div class="catalog-grid">${group.items.map((item) => `<a class="catalog-card" href="/components/${item.id}"><strong>${esc(item.name)}</strong><p>${esc(item.description)}</p><span aria-hidden="true">↗</span></a>`).join("")}</div></section>`,
      )
      .join("")}
    <p data-catalog-empty hidden>No matching components. Try another search or choose a different family.</p>`;
}

export function exampleAssets(item, demo) {
  const assets = ['mero.css','mero.js',...moduleAssets(item.module)];
  if (/\bhx-(?:get|post|put|patch|delete)=/.test(demo)) assets.unshift('vendor/htmx.min.js');
  if (demo.includes('data-mero-form')) assets.push('mero-forms.js');
  return assets;
}

export function componentPage(item, search) {
  const sample = selectVariant(item, search);
  const assets = exampleAssets(item, sample.demo);
  const hasRequests = assets.includes('vendor/htmx.min.js');
  const head = [assetStyles(assets), assetScripts(assets)].filter(Boolean).join("\n");
  return `<header class="docs-heading"><div class="catalog-family-label"><a href="/components">Components</a><span aria-hidden="true">/</span><a href="/components#${catalogGroupId(item.category)}">${esc(item.category)}</a></div><h1>${esc(item.name)}</h1><p>${esc(sample.description)}</p></header>
    ${interactiveExample({ id: item.id, ...sample, hasRequests })}
    ${sample.notes ? `<p class="doc-notes">${esc([sample.notes].flat().join(" "))}</p>` : ""}
    ${item.relatedExample ? `<a class="site-inline-link" href="${esc(item.relatedExample.href)}">${esc(item.relatedExample.label)} →</a>` : ""}
    <details class="component-install"><summary>Use in your app</summary>
    <p>Copy these tags into your page head once. Serve the files at the paths shown, then add the example’s template to your page.</p>
    ${codePanel(head, "Page assets")}
    ${hasRequests ? "<p>Point the HTMX attributes at your own HTML endpoints. Use the live preview’s HTTP exchange to inspect the request and response.</p>" : ""}
    <ul aria-label="Download individual assets">${(sample.demo.includes("studio-lamp.webp") ? [...assets, "studio-lamp.webp"] : assets).map((name) => `<li><a href="/${name}" download>${esc(name)} ↓</a></li>`).join("")}</ul>
    ${item.serverHelper ? `<p>Optional server helper · <a href="/${esc(item.serverHelper)}" download>${esc(item.serverHelper)} ↓</a></p>` : ""}
    <a class="site-inline-link" href="/downloads/mero-ui.tar.gz" download>Download library and examples ↓</a></details>`;
}

export function standalonePage(item, search) {
  const { demo } = selectVariant(item, search);
  const assets = exampleAssets(item,demo);
  const embedded = search.has("embed");
  const theme = search.get("theme");
  return `<!doctype html><html lang="en" data-theme="${theme === "light" || theme === "brand" ? "light" : "dark"}"${theme === "brand" ? " data-tenant-preview" : ""}><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
    <meta name="htmx-config" content='{"selfRequestsOnly":true,"allowEval":false,"allowScriptTags":false,"includeIndicatorStyles":false}'>
    <title>${esc(item.name)} · Mero UI</title>
    <meta name="robots" content="noindex">
    ${assetStyles(["site-fonts.css",...assets, "preview.css"])}
    ${assetScripts(assets)}
    </head><body class="doc-standalone${embedded ? " is-embedded" : ""}"><main aria-label="${esc(item.name)} preview">${embedded ? "" : `<h1 class="doc-preview-title">${esc(item.name)}</h1>`}${demo}</main></body></html>`;
}
