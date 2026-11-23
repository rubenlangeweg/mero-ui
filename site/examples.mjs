import { markupTokens } from "../public/markup-tokens.mjs";
import { escapeHtml as esc } from "./html.mjs";

export function highlight(code) {
  let html = "";
  for (const [text, type] of markupTokens(code)) {
    html += type ? `<span class="syntax-${type}">${esc(text)}</span>` : esc(text);
  }
  return html;
}

export function codePanel(code, caption = "HTML") {
  return `<div class="docs-code"><div class="docs-example-head"><span>${esc(caption)}</span><button type="button" data-copy-code>Copy code</button></div><pre tabindex="0"><code>${highlight(code)}</code></pre></div>`;
}

export function example(code, demo, caption) {
  return `<section class="docs-example">${demo ? `<div class="docs-preview">${demo}</div>` : ""}${codePanel(code, caption)}</section>`;
}

function responsePanel() {
  return `<div class="docs-http"><div class="docs-http-heading"><strong>HTTP exchange</strong><output data-exchange-status aria-live="polite">Waiting for a request</output></div><pre tabindex="0"><code data-exchange-body>Use the preview to see the request and the HTML your server returns.</code></pre></div>`;
}

export function playgroundTrace(id) {
  return `<section class="pg-trace" data-playground-trace="${esc(id)}" aria-label="Request log">
    <div class="pg-trace-head"><h2>Request log</h2><button type="button" data-trace-clear disabled>Clear</button></div>
    <p class="pg-trace-empty" data-trace-empty>Try the workflow to see its requests here.</p>
    <ol class="pg-trace-list" data-trace-list></ol>
    <p class="pg-trace-hint" data-trace-hint hidden>Select a request to inspect the exchange. The latest eight are kept.</p>
  </section>`;
}

export function interactiveExample({
  id,
  demo,
  code,
  sourceCaption = "HTML",
  sourceTarget = "",
  hasRequests,
  variantLinks = "",
  openUrl = "",
  openLabel = "",
  themeSelector = true,
  trace = false,
}) {
  const views = [
    ["preview", "Preview"],
    ["source", "Template"],
  ];
  if (hasRequests) views.push(["http", "HTTP exchange"]);
  const tabId = (key) => `docs-${id}-${key}`;
  return `<section class="doc-lab" data-mero-tabs data-doc-lab${trace ? ` data-trace-id="${esc(id)}"` : ""}>
    <div class="doc-lab-head"><div class="doc-tab-list" role="tablist" aria-label="Example views">${views.map(([key, name], i) => `<button type="button" id="${tabId(key)}-tab" role="tab" aria-selected="${i === 0}" tabindex="${i === 0 ? 0 : -1}" aria-controls="${tabId(key)}">${name}</button>`).join("")}</div>
    <div class="doc-lab-options">${openUrl ? `<a class="doc-source-jump" href="#${tabId("source")}">View template</a>` : ""}${themeSelector ? '<select class="mero-select" aria-label="Preview theme" data-preview-theme><option value="auto">Page theme</option><option value="light">Light</option><option value="dark">Dark</option><option value="brand">Tenant theme</option></select>' : ""}${openUrl ? `<a href="${esc(openUrl)}" data-open-preview target="_blank" rel="noopener" aria-label="${openLabel ? esc(openLabel) + ' in a new tab' : 'Open standalone preview'}">${openLabel ? esc(openLabel) + ' ' : ''}<span aria-hidden="true">↗</span></a>` : ""}</div></div>
    ${variantLinks}
    <div role="tabpanel" aria-labelledby="${tabId("preview")}-tab" id="${tabId("preview")}"><div class="docs-preview" data-sample-scope>${demo}</div></div>
    <div role="tabpanel" aria-labelledby="${tabId("source")}-tab" id="${tabId("source")}"${sourceTarget ? ` data-template-for="${esc(sourceTarget)}"` : ""} hidden>${codePanel(code, sourceCaption)}</div>
    ${hasRequests ? `<div role="tabpanel" aria-labelledby="${tabId("http")}-tab" id="${tabId("http")}" hidden>${responsePanel()}</div>` : ""}
  </section>`;
}

export function selectVariant(item, search) {
  const requested = search.get("variant");
  const variants = [
    { name: "Default", demo: item.render ? item.render(search) : item.demo, code: item.code ?? item.demo },
    ...(item.variants ?? []),
  ];
  const index = variants.findIndex((variant) => variant.name === requested);
  const selected = variants[index < 0 ? 0 : index];
  const path = `/components/${item.id}`;
  const variantLinks =
    variants.length < 2
      ? ""
      : `<nav aria-label="Example variants" class="doc-variants"><span aria-hidden="true">Variant</span>${variants.map((v, i) => `<a href="${path}${i ? `?variant=${encodeURIComponent(v.name)}` : ""}"${v === selected ? ' aria-current="page"' : ""}>${esc(v.name)}</a>`).join("")}</nav>`;
  return {
    demo: index > 0 && selected.render ? selected.render(search) : selected.demo,
    code: selected.code ?? selected.demo,
    description: selected.description ?? item.description,
    notes: selected.notes ?? item.notes,
    variantLinks,
    openUrl: `/preview/${item.id}${index > 0 ? `?variant=${encodeURIComponent(selected.name)}` : ""}`,
  };
}
