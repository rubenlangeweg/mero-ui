import { createServer } from "node:http";
import { readFile } from "node:fs/promises";
import { extname } from "node:path";
import { pathToFileURL } from "node:url";
import { catalogFragment } from "./site/components.mjs";
import { groups, components, moduleAssets } from "./site/catalog.mjs";
import { catalogIndex, componentPage, exampleAssets, standalonePage } from "./site/catalog-pages.mjs";
import { example, interactiveExample, selectVariant } from "./site/examples.mjs";
import { handleCollectionRequest } from "./site/collection-components.mjs";
import { handleWorkspaceRequest } from "./site/workspace-components.mjs";
import { handleInsightRequest } from "./site/insight-components.mjs";
import { handleInventoryRequest, createSourceArchive } from "./site/inventory-routes.mjs";
import { proStage } from "./site/pro-stage.mjs";
import { catalogLayout, embeddedLayout, home, shell } from "./site/shell.mjs";
import { layouts, showcaseApps, layoutGallery } from "./site/app-examples.mjs";
import { infoPages } from "./site/info-pages.mjs";
import { robotsTxt, seoHead, sitemapXml, siteOrigin as normalizeOrigin } from "./site/seo.mjs";
import { themesPage, themeAssets } from "./site/themes.mjs";
import { designPrinciplesPage } from "./site/design-principles.mjs";
import { responsiveLayoutsPage, responsiveLayoutsAssets } from "./site/responsive-layouts.mjs";
import { playgroundPage } from "./site/playground.mjs";
import { communicationAssets, layoutSourceFiles, layoutWorkbench, workflowInstall } from "./site/layout-workbench.mjs";
import { readTheme, themeTokens } from "./public/theme-model.mjs";
import { createCommunicationLayouts } from "./site/communication-layouts.mjs";
import { businessAssets, renderBusinessLayout } from "./site/business-layouts.mjs";
import { escapeHtml as esc } from "./site/html.mjs";
import { createLabStore, renderWorkbench } from "./site/lab.mjs";
import { renderLayout, renderSettingsForm } from "./site/layouts.mjs";
import { createStudio, renderStudio, studioActions, studioAssets, studioView, studioViews, updateSettings } from "./site/studio.mjs";
import { studioUrl } from "./site/studio-links.mjs";

export const sourceArchiveEntries = ["LICENSE", ".gitignore", "README.md", "package.json", "package-lock.json", "server.mjs", "site", "public", "examples", "test", "scripts", "docs", "worker.mjs", "vite.config.mjs", "cloudflare.config.ts"];
const formAssets = ["mero.css", "vendor/htmx.min.js", "mero.js", "mero-forms.js"];
const settingsAssets = [...formAssets, "mero-layouts.css"];
const workbenchAssets = [...formAssets, "mero-inventory.css", "mero-inventory.js"];
const inventoryAssets = [...workbenchAssets, "mero-layouts.css"];
const layoutPages = new Map(layouts.map(layout => [layout.id, layout]));
const discoveryPaths = [
  "/", "/start", "/docs/design-principles", "/docs/responsive-layouts", "/components", "/layouts", "/themes", "/playground",
  ...infoPages.keys(), ...Array.from(components.keys(), id => "/components/" + id),
  ...layouts.map(layout => "/layouts/" + layout.id),
];
const types = {
  ".css": "text/css; charset=utf-8",
  ".mjs": "text/javascript; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".woff2": "font/woff2",
  ".webp": "image/webp",
  ".txt": "text/plain; charset=utf-8",
  ".svg": "image/svg+xml",
  ".ico": "image/x-icon",
};

function send(response, body, options = {}) {
  const { status = 200, type = "text/html; charset=utf-8", headers } = options;
  response.writeHead(status, { "Content-Type": type, "Cache-Control": "no-store", "X-Content-Type-Options": "nosniff", ...headers });
  response.end(body);
}

async function formBody(request) {
  const chunks = [];
  let size = 0;
  for await (const chunk of request) {
    size += chunk.length;
    if (size > 16384) return null;
    chunks.push(chunk);
  }
  return new URLSearchParams(Buffer.concat(chunks).toString("utf8"));
}

function docs(title, description, content) {
  return `<header class="docs-heading"><h1>${esc(title)}</h1><p>${esc(description)}</p></header>${content}`;
}

function startGuide() {
  const install = `<link rel="stylesheet" href="/mero.css">
<script defer src="/vendor/htmx.min.js"></script>
<script defer src="/mero.js"></script>`;
  const markup = `<button type="button" class="mero-button mero-button-primary"
        hx-get="/demo/stock-summary" hx-target="next output"
        hx-disabled-elt="this">
  Check inventory
</button>
<output aria-live="polite"></output>`;
  return docs("Get started", "Use Mero UI with any backend that can render HTML fragments.", `
    <div><a class="mero-button mero-button-primary site-cta" href="/downloads/mero-ui.tar.gz" download>Download source ↓</a></div>
    <p>Extract the archive and run <code>npm start</code> with Node 22 or newer. The app runs at <a href="/">127.0.0.1:4173</a>. For just the editable table and its server routes, <a href="/downloads/studio-inventory.tar.gz" download>download Studio Inventory</a>.</p>
    <h2>Load the assets</h2>
    <p>The sample serves these files from its <code>public/</code> directory. Use the same paths in your app, or point them to your own asset directory.</p>
    <div class="start-assets" aria-label="Download individual assets">
      <a href="/mero.css" download>mero.css ↓</a>
      <a href="/mero.js" download>mero.js ↓</a>
      <a href="/vendor/htmx.min.js" download>HTMX ↓</a>
    </div>
    <p>Projects that already load HTMX only need the Mero UI files.</p>
    ${example(install)}
    <h2>Request a fragment</h2>
    <p>Choose <strong>Check inventory</strong> to fetch the current product count. Open <strong>HTTP exchange</strong> to see exactly what the server returned.</p>
    ${interactiveExample({ id: "first-request", demo: markup, code: markup, hasRequests: true, themeSelector: false })}
    <h2>Try server-side validation</h2>
    <p>Open the <a href="/playground">inventory playground</a>, choose a validation error under <strong>Next save</strong>, then edit and save a product. The server returns the filled-in form with HTTP 422. The drawer stays open and focuses the invalid field.</p>
    <p>The <strong>HTTP exchange</strong> tab shows the returned form and headers. The <a href="/downloads/studio-inventory.tar.gz" download>standalone inventory</a> includes the same template and routes. Add <a href="/mero-forms.js" download>mero-forms.js</a> after the core to use these behaviors in your app.</p>
    <h2>Theme your app</h2>
    <p>Use the <a href="/themes">theme studio</a> to preview your colors, radii and typography, then export the <code>--mero-*</code> tokens into your stylesheet. Set <code>data-theme="light"</code> or <code>data-theme="dark"</code> on the document to choose a theme.</p>
    <p>Read the <a href="/docs/design-principles">design principles</a> for action hierarchy, spacing and focus after a save. Try the <a href="/docs/responsive-layouts">resizable company directory</a> to see how a layout behaves inside a narrow panel.</p>
  `);
}

export function createApp({ siteOrigin = process.env.MERO_SITE_ORIGIN, serveFiles = true } = {}) {
  const publicOrigin = normalizeOrigin(siteOrigin);
  const store = createLabStore();
  const studio = createStudio();
  const communication = createCommunicationLayouts();
  const settings = { name: "Studio", digest: true };
  return createServer(async (request, response) => {
    try {
      const url = new URL(request.url, "http://localhost");
      const { pathname, searchParams } = url;
      const method = request.method;
      // Only the configured origin and the local preview have trusted absolute URLs.
      const host = request.headers.host || "";
      const origin = publicOrigin || (/^(?:localhost|127\.0\.0\.1|\[::1\])(?::\d+)?$/i.test(host) ? "http://" + host : undefined);
      const page = ({ status = 200, ...options }) => send(response,
        shell({ path: pathname, origin, indexable: status === 200, ...options }), { status });
      if (/^\/(?:preview|demo|downloads|source)\//.test(pathname)) response.setHeader("X-Robots-Tag", "noindex");
      if (method === "GET" && pathname === "/robots.txt") return send(response, robotsTxt(origin), { type: types[".txt"] });
      if (method === "GET" && pathname === "/sitemap.xml") {
        if (!origin) return send(response, "Configure MERO_SITE_ORIGIN to publish the sitemap.", { status: 503, type: types[".txt"] });
        return send(response, sitemapXml(discoveryPaths, origin), { type: "application/xml; charset=utf-8" });
      }
      if (method === "GET" && infoPages.has(pathname)) {
        return page({ ...infoPages.get(pathname), nav: "project", assets: ["info-pages.css"] });
      }
      if (method === "POST" && request.headers.origin && request.headers.origin !== (publicOrigin || `http://${request.headers.host}`)) {
        return send(response, "Request origin must match the local app.", { status: 403 });
      }
      if (method === "GET" && pathname === "/") {
        return page({ title: "Mero UI", body: home({ apps: showcaseApps, workbench: renderWorkbench(store), componentCount: components.size, product: store.products.find(product => product.id === 6) }), nav: "home", assets: [...inventoryAssets,...moduleAssets("gallery")] });
      }
      if (method === "GET" && pathname === "/start") {
        return page({ title: "Get started", body: catalogLayout({ groups, active: "", content: startGuide() }), nav: "start", assets: ["vendor/htmx.min.js", "catalog-navigation.js"] });
      }
      if (method === "GET" && pathname === "/docs/design-principles") {
        return page({ title: "Design principles", nav: "start", assets: ["design-principles.css", "catalog-navigation.js"],
          body: catalogLayout({ groups, active: "design-principles", content: designPrinciplesPage() }) });
      }
      if (method === "GET" && pathname === "/docs/responsive-layouts") {
        response.setHeader("Vary", "HX-Request, HX-Target, HX-History-Restore-Request");
        if (request.headers["hx-request"] === "true" && request.headers["hx-target"] === "guide-panes" && request.headers["hx-history-restore-request"] !== "true") {
          return send(response, responsiveLayoutsPage(searchParams, { panesOnly: true }), { headers: { "X-Robots-Tag": "noindex" } });
        }
        return page({ title: "Responsive layouts", nav: "start", assets: [...responsiveLayoutsAssets, "catalog-navigation.js"],
          body: catalogLayout({ groups, active: "responsive-layouts", content: responsiveLayoutsPage(searchParams) }) });
      }
      if (method === "GET" && pathname === "/playground") {
        return page({ nav: "playground", ...playgroundPage({ store, settings, params: searchParams, workflowInstall }) });
      }
      if (method === "GET" && pathname === "/themes") {
        return page({ title: "Theme studio", nav: "themes", assets: themeAssets, body: themesPage(searchParams) });
      }
      if (method === "GET" && pathname === "/layouts") {
        return page({ title: "Application layouts", nav: "layouts", assets: ["app-examples.css"], body: layoutGallery() });
      }
      if (await communication.handle(request, response, url)) return;
      const screen = pathname.startsWith("/layouts/") && pathname.slice("/layouts/".length);
      if ((method === "GET" && screen === "dashboard") || (method === "POST" && Object.hasOwn(studioActions, pathname))) {
        let params = new URLSearchParams(searchParams);
        const standalone = params.get("embed") === "1" || request.headers["sec-fetch-dest"] === "iframe" || request.headers["x-mero-embed"] === "1";
        if (standalone) params.set("embed", "1");
        const fragment = request.headers["hx-request"] === "true" && request.headers["hx-target"] === "studio-workspace" && request.headers["hx-history-restore-request"] !== "true";
        response.setHeader("Vary", "HX-Request, HX-Target, HX-History-Restore-Request, Sec-Fetch-Dest, X-Mero-Embed");
        let options = {};
        if (method === "POST") {
          const form = await formBody(request);
          if (!form) return send(response, "Form is too large.", { status: 413 });
          const action = studioActions[pathname];
          const result = action.mutate(studio, form, settings);
          const location = studioUrl(action.view, result.params, params);
          if (!fragment && !result.error) return send(response, "", { status: 303, headers: { Location: location } });
          params = new URL(location, url).searchParams;
          options = { error: result.error, values: result.values || Object.fromEntries(form) };
          if (fragment && !result.error) {
            response.setHeader("HX-Replace-Url", location);
            response.setHeader("HX-Trigger-After-Settle", JSON.stringify({ "studio:saved": { message: action.message } }));
          }
        }
        const content = renderStudio(studio, store, settings, params, options);
        const title = studioViews[studioView(params)] + " · Studio";
        const status = options.error ? 422 : 200;
        if (fragment) return send(response, content, { status, headers: { "X-Robots-Tag": "noindex" } });
        if (standalone) {
          const theme = params.get("studio") === "1" ? readTheme(params) : null;
          return send(response, embeddedLayout({ title, content, assets: studioAssets, mode: theme?.mode || params.get("theme"), tokens: theme && themeTokens(theme) }), { status });
        }
        return send(response, layoutWorkbench({ screen: "dashboard", title, content, assets: studioAssets, params, origin, description: layoutPages.get("dashboard").description, indexable: method === "GET" && status === 200 }), { status });
      }
      if (method === "GET" && layoutPages.has(screen)) {
        const { name: title, description } = layoutPages.get(screen);
        response.setHeader("Vary", "HX-Request, HX-Target, HX-History-Restore-Request, Sec-Fetch-Dest, X-Mero-Embed");
        let assets, content;
        if (screen === "settings") {
          assets = settingsAssets;
          content = renderLayout(screen, store, settings, { pageHeading: true });
        } else if (screen === "mail" || screen === "chat") {
          assets = communicationAssets(screen);
          content = communication.render(screen, request, response, searchParams);
        } else {
          assets = ["mero.css", "vendor/htmx.min.js", "mero.js", ...businessAssets];
          content = renderBusinessLayout(screen, searchParams);
          if (request.headers["hx-request"] === "true" && request.headers["hx-target"] === "business-layout" &&
              request.headers["hx-history-restore-request"] !== "true") return send(response, content, { headers: { "X-Robots-Tag": "noindex" } });
        }
        if (searchParams.get("embed") === "1" || request.headers["sec-fetch-dest"] === "iframe" || request.headers["x-mero-embed"] === "1") {
          const theme = searchParams.get("studio") === "1" ? readTheme(searchParams) : null;
          return send(response, embeddedLayout({ title, content, assets, mode: theme?.mode || searchParams.get("theme"), tokens: theme && themeTokens(theme) }));
        }
        return send(response, layoutWorkbench({ screen, title, content, assets, params: searchParams, origin, description }));
      }
      if (method === "GET" && (pathname === "/components" || pathname.startsWith("/components/") || pathname.startsWith("/preview/"))) {
        const item = components.get(pathname.split("/").slice(2).join("/"));
        if (item && pathname.startsWith("/preview/")) return send(response, standalonePage(item, searchParams));
        if (item || pathname === "/components") {
          const title = item?.name || "Components";
          const description = item?.description;
          const assets = item ? exampleAssets(item, selectVariant(item, searchParams).demo) : [];
          const content = item ? componentPage(item, searchParams) : catalogIndex();
          response.setHeader("Vary", "HX-Request, HX-Target, HX-History-Restore-Request");
          if (request.headers["hx-request"] === "true" && request.headers["hx-target"] === "catalog-content" && request.headers["hx-history-restore-request"] !== "true") {
            const head = seoHead({ title, description, path: pathname, origin });
            return send(response, `<title>${esc(title)} · Mero UI</title><template data-catalog-head>${head}</template>${content}`, { headers: {
              "X-Mero-Assets": assets.join(","), "X-Robots-Tag": "noindex",
            } });
          }
          return page({ title, description, nav: "components", assets: ["vendor/htmx.min.js", ...assets, "catalog-navigation.js"],
            body: catalogLayout({ groups, active: item?.id, content }) });
        }
      }
      if (serveFiles && method === "GET" && pathname.startsWith("/source/")) {
        const file = pathname.slice("/source/".length);
        if (layoutSourceFiles.has(file)) return send(response, await readFile(new URL(file, import.meta.url)), { type: types[".txt"] });
      }
      if (serveFiles && method === "GET" && pathname === "/downloads/mero-ui.tar.gz") {
        const archive = await createSourceArchive(sourceArchiveEntries);
        return send(response, archive, {type:"application/gzip",headers:{"Content-Disposition":'attachment; filename="mero-ui.tar.gz"'}});
      }
      if (method === "GET" && pathname === "/demo/stock-summary") {
        const total = store.products.length;
        const active = store.products.filter(item => item.status === "Active").length;
        return send(response, `<strong>${total} ${total === 1 ? "product" : "products"}</strong> · ${active} active`);
      }
      if (await handleInventoryRequest(request, response, url, store, {
        origin: publicOrigin,
        renderRelated: id => id === 6 ? proStage({ product: store.products.find(item => item.id === id), outOfBand: true }) : "",
      })) return;
      if (await handleCollectionRequest(request, response, url, store)) return;
      if (await handleInsightRequest(request, response, url)) return;
      if (await handleWorkspaceRequest(request, response, url)) return;
      if (method === "GET" && pathname.startsWith("/demo/catalog/")) {
        const html = catalogFragment(pathname.slice("/demo/catalog/".length), searchParams);
        if (html != null) return send(response, html);
      }
      if (method === "POST" && pathname === "/demo/settings") {
        const params = await formBody(request);
        if (!params) return send(response, "Form is too large.", { status: 413 });
        const result = updateSettings(settings, params);
        if (result.error) return send(response, renderSettingsForm(result.values, result.error), { status: 422 });
        return send(response, renderSettingsForm(settings), { headers: {
          "HX-Trigger-After-Settle": JSON.stringify({ "mero:form-saved": { target: "#layout-settings", message: "Settings saved" } }),
        } });
      }

      if (pathname.startsWith("/demo/")) return send(response, "Demo route not found.", { status: 404 });

      const type = types[extname(pathname)];
      if (serveFiles && method === "GET" && type && /^\/(?:fonts\/|vendor\/)?[a-z0-9.-]+$/i.test(pathname)) {
        const assetPath = pathname.slice(1);
        const asset = await readFile(new URL("./public/" + assetPath, import.meta.url)).catch((error) => {
          if (error.code !== "ENOENT") throw error;
        });
        if (asset) return send(response, asset, { type });
      }
      return page({ title: "Page not found", status: 404, body: '<section class="lab-page"><h1>Page not found</h1><a href="/components">Browse components</a></section>' });
    } catch (error) {
      console.error(error);
      if (!response.headersSent) send(response, "The local server could not complete the request.", { status: 500 });
      else response.end();
    }
  });
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const port = Number(process.env.PORT ?? 4173);
  createApp().listen(port, "127.0.0.1", () => console.log(`Mero UI is running at http://127.0.0.1:${port}`));
}
