import { examplePage } from "./app-examples.mjs";
import { example, interactiveExample } from "./examples.mjs";
import { assetScripts, assetStyles, shell } from "./shell.mjs";
import { studioUrl } from "./studio-links.mjs";
import { escapeHtml as esc } from "./html.mjs";

export function communicationAssets(screen) {
  return ["mero.css", "vendor/htmx.min.js", "mero.js", "mero-forms.js",
    ...(screen === "mail" ? ["mero-workspace.css", "mero-workspace.js"] : []),
    "communication-layouts.css", "communication-layouts.js"];
}

const guides = {
  dashboard: {
    text: "Studio keeps companies, tasks and bookings in memory for the life of the demo server. The company profile counts open tasks from those same records.",
    source: "site/studio.mjs",
  },
  inventory: {
    text: "Point the product URLs at your inventory routes. The standalone example includes the editable table, validation, confirmed deletion and the server that handles them.",
    source: "site/inventory-routes.mjs",
  },
  settings: {
    text: "POST /demo/settings returns the saved form. On a validation error it returns the submitted values and field errors with HTTP 422. On success the HX-Trigger-After-Settle header announces the save.",
    source: "server.mjs",
  },
  mail: {
    text: 'GET /demo/layouts/mail renders the selected folder and message. The reply and move forms post to /demo/layouts/mail/reply and /demo/layouts/mail/move. On wide layouts, the <a href="/components/resizable?variant=Adaptive">Resizable divider</a> learns where you leave the edge of the message list.',
    source: "site/communication-layouts.mjs",
  },
  chat: {
    text: "GET /demo/layouts/chat opens a channel. POST /demo/layouts/chat/send returns the updated conversation, or the composer with the submitted text and HTTP 422 on a validation error.",
    source: "site/communication-layouts.mjs",
  },
  crm: {
    text: "GET /layouts/crm takes stage and deal query parameters. The same URL serves the full page to a browser and the selected pipeline and deal details to an HTMX request targeting #business-layout.",
    source: "site/business-layouts.mjs",
  },
  finance: {
    text: "GET /layouts/finance takes period and transaction query parameters. Return #business-layout to update the balance, chart and ledger together. The example calculates all three from the same postings.",
    source: "site/business-layouts.mjs",
  },
};

export const layoutSourceFiles = new Set(Object.values(guides).map(guide => guide.source));
layoutSourceFiles.add("site/studio-board.mjs");

function companyTaskGuide(params) {
  const companyUrl = esc(studioUrl("companies", { company: "forma" }, params));
  const request = `POST /demo/studio/tasks
HX-Request: true
HX-Target: studio-workspace
Content-Type: application/x-www-form-urlencoded

operation=move&id=ST-103&company=forma&display=list&openTask=1&status=done`;
  return `<details class="component-install" id="studio-task-guide"><summary>Walkthrough · Finish a company task</summary>
    <ol><li><a href="${companyUrl}">Open Forma Works</a> and check its <strong>Open tasks</strong> count.</li>
    <li>Under <strong>Tasks</strong>, open <strong>Price the first retail rollout</strong>. Set <strong>Task status</strong> to <strong>Done</strong> and choose <strong>Save status</strong>.</li>
    <li>Open <strong>HTTP exchange</strong> to inspect the save. Use your browser’s Back button to return to Forma Works. The task now shows Done. Finishing an open task reduces the count by one.</li></ol>
    ${example(request, undefined, "Task move with List selected")}
    <p>Studio validates the task and stage, then returns the updated <code>#studio-workspace</code> fragment. A successful save returns HTTP 200 and replaces the current history entry. An invalid stage returns HTTP 422 with the error. A native form submission redirects to the task with HTTP 303 on success.</p>
    <a href="/source/site/studio-board.mjs">Read the task move handler</a></details>`;
}

export function workflowInstall(screen, assets) {
  const guide = guides[screen];
  const inventory = screen === "inventory";
  return `<details class="component-install"><summary>Use in your app</summary>
    <p>${guide.text}</p>
    <p>Serve these assets from the download’s <code>public/</code> directory. Add the tags to your page head.</p>
    ${example([assetStyles(assets), assetScripts(assets)].join("\n"), undefined, "Page assets")}
    <p>Server source · <a class="site-inline-link" href="/source/${guide.source}">${guide.source}</a></p>
    <a class="site-inline-link" href="/downloads/${inventory ? "studio-inventory" : "mero-ui"}.tar.gz" download>${inventory ? "Download runnable inventory example" : "Download full example source"} ↓</a></details>`;
}

export function layoutWorkbench({ screen, title, content, assets, params, origin, description, indexable = true }) {
  const query = new URLSearchParams(params);
  query.set("embed", "1");
  const demo = interactiveExample({
    id: screen, demo: content, code: content,
    sourceTarget: screen === "dashboard" ? "studio-workspace" : "",
    sourceCaption: screen === "dashboard" ? "Server-rendered workspace HTML" : "Initial server-rendered HTML",
    hasRequests: true, openUrl: `/layouts/${screen}?${query}`, openLabel: "Open app",
  });
  return shell({
    title, description, path: `/layouts/${screen}`, origin, indexable,
    nav: "layouts", assets: [...assets, "app-examples.css"],
    body: examplePage(screen, demo, { after: (screen === "dashboard" ? companyTaskGuide(params) : "") + workflowInstall(screen, assets) }),
  });
}
