import { components, moduleAssets } from "./catalog.mjs";
import { example, interactiveExample, playgroundTrace, selectVariant } from "./examples.mjs";
import { renderWorkbench } from "./lab.mjs";
import { renderSettingsForm } from "./layouts.mjs";
import { assetScripts, assetStyles } from "./shell.mjs";

const workflows = {
  inventory: {
    name: "Inventory",
    summary: "Search and edit products",
    heading: "Studio inventory",
    hint: "Search for a lamp and open its edit drawer. Under Request scenarios, try a slow save or a validation error.",
    run: "Search for “lamp”",
    label: "GET /demo/products",
    icon: '<path d="m3 7 9-4 9 4-9 4z"/><path d="M3 7v10l9 4 9-4V7m-9 4v10M8 5l9 4"/>',
  },
  settings: {
    name: "Form validation",
    summary: "Handle field errors",
    heading: "Workspace settings",
    hint: "Submit a name containing just a space. The server returns the form with a field error. Enter a name and save again.",
    run: "Try an invalid name",
    label: "POST /demo/settings",
    icon: '<rect x="3.5" y="4" width="17" height="16" rx="2.5"/><path d="M7.5 9h9m-9 5h3m3 .5 1.4 1.4 2.8-3"/>',
  },
  report: {
    name: "Dispatch report",
    summary: "Filter a live chart",
    heading: "Dispatch report",
    hint: "Compare the full week with its last three days. Open the chart data to see the numbers behind each line.",
    run: "Show the last three days",
    label: "GET /demo/insights/chart",
    icon: '<path d="M4 4v15a1 1 0 0 0 1 1h15M7 14l4-5 4 3 5-7"/>',
  },
};

function icon(path, size = 20) {
  return `<svg aria-hidden="true" width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.65" stroke-linecap="round" stroke-linejoin="round">${path}</svg>`;
}

function workflowNav(current) {
  return `<nav class="pg-workflows" aria-label="Playground workflows">${Object.entries(workflows).map(([id, item]) =>
    `<a href="/playground${id === "inventory" ? "" : "?scenario=" + id}" aria-labelledby="pg-nav-${id}" aria-describedby="pg-nav-${id}-description"${id === current ? ' aria-current="page"' : ""}>
      <span class="pg-workflow-icon pg-icon-${id}">${icon(item.icon)}</span>
      <span class="pg-workflow-copy"><strong id="pg-nav-${id}">${item.name}</strong><small id="pg-nav-${id}-description">${item.summary}</small></span>
    </a>`).join("")}</nav>`;
}

function reportInstall(assets) {
  const markup = [assetStyles(assets), assetScripts(assets)].join("\n");
  return `<details class="component-install"><summary>Use in your app</summary>
    <p>Copy the form from Template. Point its <code>hx-get</code> at your report route and return the chart figure for the selected period.</p>
    ${example(markup, undefined, "Page assets")}
    <a class="site-inline-link" href="/components/line-chart?variant=Period+picker">Line chart example</a>
    <a class="site-inline-link" href="/downloads/mero-ui.tar.gz" download>Download the example source ↓</a>
  </details>`;
}

export function playgroundPage({ store, settings, params, workflowInstall }) {
  const requested = params.get("scenario");
  const id = Object.hasOwn(workflows, requested) ? requested : "inventory";
  const item = workflows[id];
  const assets = ["mero.css", "vendor/htmx.min.js", "mero.js"];
  let demo;
  let code;
  if (id === "inventory") {
    assets.push("mero-forms.js", "mero-inventory.css", "mero-inventory.js");
    demo = renderWorkbench(store, { expanded: true, inspect: true, initial: params });
    code = renderWorkbench(store, { expanded: true });
  } else if (id === "settings") {
    assets.push("mero-forms.js", "mero-layouts.css");
    demo = renderSettingsForm(settings);
    code = demo;
  } else {
    assets.push(...moduleAssets("insights"));
    const variant = selectVariant(components.get("line-chart"), new URLSearchParams({ variant: "Period picker" }));
    demo = variant.demo;
    code = variant.code;
  }
  const install = id === "report" ? reportInstall(assets) : workflowInstall(id, assets);
  const body = `<section class="site-wrap pg-page" data-playground="${id}" aria-labelledby="pg-title">
    <header class="pg-heading"><h1 id="pg-title">Playground</h1>
      <p>Try a workflow and inspect the HTML behind each request.</p></header>
    ${workflowNav(id)}
    <div class="pg-workspace">
      <section class="pg-canvas" aria-labelledby="pg-workflow-heading">
        <header class="pg-canvas-head"><h2 id="pg-workflow-heading">${item.heading}</h2>
          <a class="pg-log-jump" href="#pg-requests">Request log ↓</a>
          <div class="pg-actions">${id === "inventory" ? '<a href="#lab-scenarios" data-pg-scenarios>Request scenarios ↓</a>' : ""}
            <button type="button" class="pg-run" data-pg-run hidden>${icon('<path d="m8 5 10 7-10 7z"/>', 13)}${item.run}</button>
          </div>
        </header>
        ${interactiveExample({ id, demo, code, hasRequests: true, trace: true })}
        ${install}
      </section>
      <aside class="pg-rail" aria-label="Workflow tools">
        <section class="pg-guide" aria-labelledby="pg-guide-heading">
          <h2 id="pg-guide-heading">Try it</h2><p>${item.hint}</p>
          <code class="pg-endpoint">${item.label}</code>
        </section>
        <div id="pg-requests" tabindex="-1">${playgroundTrace(id)}</div>
      </aside>
    </div>
  </section>`;
  return { title: id === "inventory" ? "Playground" : item.name + " · Playground", assets: [...assets, "playground.css", "playground-trace.css", "playground.js"], body };
}
