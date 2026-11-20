import { createServer } from "node:http";
import { readFile } from "node:fs/promises";
import { extname } from "node:path";
import { pathToFileURL } from "node:url";
import { catalogFragment } from "./site/core-components.mjs";
import { groups, components, moduleAssets } from "./site/catalog.mjs";
import { catalogIndex, componentPage, exampleAssets, standalonePage } from "./site/catalog-pages.mjs";
import { selectVariant } from "./site/examples.mjs";
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
import {
  createStudio, renderStudio, studioActions, studioAssets, studioView, studioViews, updateSettings,
} from "./site/studio.mjs";
import { studioUrl } from "./site/studio-links.mjs";
import { startGuide } from "./site/start-guide.mjs";

export const sourceArchiveEntries = [
  "LICENSE", ".gitignore", "README.md", "package.json", "package-lock.json", "server.mjs", "site", "ui", "public", "examples",
  "test", "scripts", "docs", "worker.mjs", "vite.config.mjs", "cloudflare.config.ts",
];
// The files the npm package ships live in ui/. Site-only files stay in public/.
const libraryAsset = /^(?:mero[a-z-]*\.(?:css|js)|insight-[a-z-]+\.mjs|studio-lamp\.webp)$/;
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

// MERO_HTMX=4 serves htmx 4 at the same path, so every page and test can run on either version.
const htmxAsset = path => path === "vendor/htmx.min.js" && process.env.MERO_HTMX === "4" ? "vendor/htmx-4.min.js" : path;

const fragmentVary = "HX-Request, HX-Target, HX-History-Restore-Request";
const layoutVary = fragmentVary + ", Sec-Fetch-Dest, X-Mero-Embed";

// An HTMX request for one region gets that fragment. A history restore gets the full page.
function wantsFragment(request, target) {
  return request.headers["hx-request"] === "true" && request.headers["hx-target"]?.split("#").pop() === target &&
    request.headers["hx-history-restore-request"] !== "true";
}

function wantsEmbed(request, params) {
  return params.get("embed") === "1" || request.headers["sec-fetch-dest"] === "iframe" || request.headers["x-mero-embed"] === "1";
}

function embeddedPage(params, options) {
  const theme = params.get("studio") === "1" ? readTheme(params) : null;
  return embeddedLayout({ ...options, mode: theme?.mode || params.get("theme"), tokens: theme && themeTokens(theme) });
}

export function createApp({ siteOrigin = process.env.MERO_SITE_ORIGIN, serveFiles = true } = {}) {
  const publicOrigin = normalizeOrigin(siteOrigin);
  const store = createLabStore();
  const studio = createStudio();
  const communication = createCommunicationLayouts();
  const settings = { name: "Studio", digest: true };

  // Each handler gets { request, response, url, pathname, searchParams, origin, page }.
  // A handler that returns false passes the request on to the next matching route.

  function robots({ response, origin }) {
    return send(response, robotsTxt(origin), { type: types[".txt"] });
  }

  function sitemap({ response, origin }) {
    if (!origin) return send(response, "Configure MERO_SITE_ORIGIN to publish the sitemap.", { status: 503, type: types[".txt"] });
    return send(response, sitemapXml(discoveryPaths, origin), { type: "application/xml; charset=utf-8" });
  }

  function infoPage({ pathname, page }) {
    return page({ ...infoPages.get(pathname), nav: "project", assets: ["info-pages.css"] });
  }

  function homePage({ page }) {
    const body = home({
      apps: showcaseApps, workbench: renderWorkbench(store), componentCount: components.size,
      product: store.products.find(product => product.id === 6),
    });
    return page({ title: "Mero UI", body, nav: "home", assets: [...inventoryAssets, ...moduleAssets("gallery")] });
  }

  function startPage({ page }) {
    return page({ title: "Get started", body: catalogLayout({ groups, active: "", content: startGuide() }), nav: "start",
      assets: ["vendor/htmx.min.js", "catalog-navigation.js"] });
  }

  function designPrinciples({ page }) {
    return page({ title: "Design principles", nav: "start", assets: ["design-principles.css", "catalog-navigation.js"],
      body: catalogLayout({ groups, active: "design-principles", content: designPrinciplesPage() }) });
  }

  function responsiveLayouts({ request, response, searchParams, page }) {
    response.setHeader("Vary", fragmentVary);
    if (wantsFragment(request, "guide-panes")) {
      return send(response, responsiveLayoutsPage(searchParams, { panesOnly: true }), { headers: { "X-Robots-Tag": "noindex" } });
    }
    return page({ title: "Responsive layouts", nav: "start", assets: [...responsiveLayoutsAssets, "catalog-navigation.js"],
      body: catalogLayout({ groups, active: "responsive-layouts", content: responsiveLayoutsPage(searchParams) }) });
  }

  function playground({ searchParams, page }) {
    return page({ nav: "playground", ...playgroundPage({ store, settings, params: searchParams, workflowInstall }) });
  }

  function themes({ searchParams, page }) {
    return page({ title: "Theme studio", nav: "themes", assets: themeAssets, body: themesPage(searchParams) });
  }

  function layoutIndex({ page }) {
    return page({ title: "Application layouts", nav: "layouts", assets: ["app-examples.css"], body: layoutGallery() });
  }

  // GET renders the Studio dashboard. POST applies one of studioActions and renders the result.
  async function studioPage({ request, response, url, pathname, searchParams, origin }) {
    const { method } = request;
    let params = new URLSearchParams(searchParams);
    const standalone = wantsEmbed(request, params);
    if (standalone) params.set("embed", "1");
    const fragment = wantsFragment(request, "studio-workspace");
    response.setHeader("Vary", layoutVary);
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
    if (standalone) return send(response, embeddedPage(params, { title, content, assets: studioAssets }), { status });
    return send(response, layoutWorkbench({
      screen: "dashboard", title, content, assets: studioAssets, params, origin,
      description: layoutPages.get("dashboard").description, indexable: method === "GET" && status === 200,
    }), { status });
  }

  function layoutPage({ request, response, pathname, searchParams, origin }) {
    const screen = pathname.slice("/layouts/".length);
    const { name: title, description } = layoutPages.get(screen);
    response.setHeader("Vary", layoutVary);
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
      if (wantsFragment(request, "business-layout")) return send(response, content, { headers: { "X-Robots-Tag": "noindex" } });
    }
    if (wantsEmbed(request, searchParams)) return send(response, embeddedPage(searchParams, { title, content, assets }));
    return send(response, layoutWorkbench({ screen, title, content, assets, params: searchParams, origin, description }));
  }

  // /components, /components/:id and /preview/:id.
  function catalogPage({ request, response, pathname, searchParams, origin, page }) {
    const item = components.get(pathname.split("/").slice(2).join("/"));
    if (item && pathname.startsWith("/preview/")) return send(response, standalonePage(item, searchParams));
    if (!item && pathname !== "/components") return false;
    const title = item?.name || "Components";
    const description = item?.description;
    const assets = item ? exampleAssets(item, selectVariant(item, searchParams).demo) : [];
    const content = item ? componentPage(item, searchParams) : catalogIndex();
    response.setHeader("Vary", fragmentVary);
    if (wantsFragment(request, "catalog-content")) {
      const head = seoHead({ title, description, path: pathname, origin });
      return send(response, `<title>${esc(title)} · Mero UI</title><template data-catalog-head>${head}</template>${content}`, { headers: {
        "X-Mero-Assets": assets.join(","), "X-Robots-Tag": "noindex",
      } });
    }
    return page({ title, description, nav: "components", assets: ["vendor/htmx.min.js", ...assets, "catalog-navigation.js"],
      body: catalogLayout({ groups, active: item?.id, content }) });
  }

  async function sourceFile({ response, pathname }) {
    const file = pathname.slice("/source/".length);
    if (!layoutSourceFiles.has(file)) return false;
    return send(response, await readFile(new URL(file, import.meta.url)), { type: types[".txt"] });
  }

  async function sourceArchive({ response }) {
    const archive = await createSourceArchive(sourceArchiveEntries);
    return send(response, archive, { type: "application/gzip", headers: { "Content-Disposition": 'attachment; filename="mero-ui.tar.gz"' } });
  }

  function stockSummary({ response }) {
    const total = store.products.length;
    const active = store.products.filter(item => item.status === "Active").length;
    return send(response, `<strong>${total} ${total === 1 ? "product" : "products"}</strong> · ${active} active`);
  }

  function inventory({ request, response, url }) {
    return handleInventoryRequest(request, response, url, store, {
      origin: publicOrigin,
      renderRelated: id => id === 6 ? proStage({ product: store.products.find(item => item.id === id), outOfBand: true }) : "",
    });
  }

  function catalogDemo({ response, pathname, searchParams }) {
    const html = catalogFragment(pathname.slice("/demo/catalog/".length), searchParams);
    if (html == null) return false;
    return send(response, html);
  }

  async function saveSettings({ request, response }) {
    const params = await formBody(request);
    if (!params) return send(response, "Form is too large.", { status: 413 });
    const result = updateSettings(settings, params);
    if (result.error) return send(response, renderSettingsForm(result.values, result.error), { status: 422 });
    return send(response, renderSettingsForm(settings), { headers: {
      "HX-Trigger-After-Settle": JSON.stringify({ "mero:form-saved": { target: "#layout-settings", message: "Settings saved" } }),
    } });
  }

  function actionDemo({ response, searchParams }) {
    const outcomes = {
      succeeded: [200, { "Mero-Action-Message": "Export restarted." }],
      rejected: [409, { "Mero-Action-Message": "This key was already revoked. Nothing changed." }],
      unknown: [503],
    };
    const outcome = searchParams.get("outcome");
    const [status, headers] = Object.hasOwn(outcomes, outcome) ? outcomes[outcome] : [400];
    return send(response, "", { status, headers });
  }

  function demoNotFound({ response }) {
    return send(response, "Demo route not found.", { status: 404 });
  }

  async function staticAsset({ response, pathname }) {
    const type = types[extname(pathname)];
    if (!type) return false;
    const assetPath = htmxAsset(pathname.slice(1));
    const directory = libraryAsset.test(assetPath) ? "./ui/" : "./public/";
    const asset = await readFile(new URL(directory + assetPath, import.meta.url)).catch((error) => {
      if (error.code !== "ENOENT") throw error;
    });
    if (!asset) return false;
    return send(response, asset, { type });
  }

  // [method, path, handler]. The first match that does not return false answers the request.
  // A path is an exact string or a pattern. "*" matches every method: those handlers answer 405 themselves.
  // HEAD is answered by the GET routes.
  const routes = [
    ["GET", "/robots.txt", robots],
    ["GET", "/sitemap.xml", sitemap],
    ...Array.from(infoPages.keys(), path => ["GET", path, infoPage]),
    ["GET", "/", homePage],
    ["GET", "/start", startPage],
    ["GET", "/docs/design-principles", designPrinciples],
    ["GET", "/docs/responsive-layouts", responsiveLayouts],
    ["GET", "/playground", playground],
    ["GET", "/themes", themes],
    ["GET", "/layouts", layoutIndex],
    ["*", /^\/demo\/layouts\//, ({ request, response, url }) => communication.handle(request, response, url)],
    ["GET", "/layouts/dashboard", studioPage],
    ...Object.keys(studioActions).map(path => ["POST", path, studioPage]),
    ...layouts.filter(layout => layout.id !== "dashboard").map(layout => ["GET", "/layouts/" + layout.id, layoutPage]),
    ["GET", "/components", catalogPage],
    ["GET", /^\/(?:components|preview)\//, catalogPage],
    // Cloudflare serves the files itself (scripts/build-assets.mjs), so the worker runs without the file routes.
    ...(serveFiles ? [
      ["GET", /^\/source\//, sourceFile],
      ["GET", "/downloads/mero-ui.tar.gz", sourceArchive],
    ] : []),
    ["GET", "/demo/stock-summary", stockSummary],
    ["GET", "/downloads/studio-inventory.tar.gz", inventory],
    ["*", /^\/demo\/products(?:\/|$)/, inventory],
    ["*", /^\/demo\/collections\//, ({ request, response, url }) => handleCollectionRequest(request, response, url, store)],
    ["*", /^\/demo\/insights\//, ({ request, response, url }) => handleInsightRequest(request, response, url)],
    ["*", /^\/demo\/workspace\//, ({ request, response, url }) => handleWorkspaceRequest(request, response, url)],
    ["GET", /^\/demo\/catalog\//, catalogDemo],
    ["POST", "/demo/settings", saveSettings],
    ["POST", "/demo/catalog/action-button", actionDemo],
    ["*", /^\/demo\//, demoNotFound],
    ...(serveFiles ? [["GET", /^\/(?:fonts\/|vendor\/)?[a-z0-9.-]+$/i, staticAsset]] : []),
  ];

  return createServer(async (request, response) => {
    try {
      // Node leaves the body out of a HEAD response, so the GET routes answer it with the same status and headers.
      if (request.method === "HEAD") request.method = "GET";
      const url = new URL(request.url, "http://localhost");
      const { pathname, searchParams } = url;
      const { method } = request;
      // Only the configured origin and the local preview have trusted absolute URLs.
      const host = request.headers.host || "";
      const origin = publicOrigin || (/^(?:localhost|127\.0\.0\.1|\[::1\])(?::\d+)?$/i.test(host) ? "http://" + host : undefined);
      const page = ({ status = 200, ...options }) => send(response,
        shell({ path: pathname, origin, indexable: status === 200, ...options }), { status });
      if (/^\/(?:preview|demo|downloads|source)\//.test(pathname)) response.setHeader("X-Robots-Tag", "noindex");
      if (method === "POST" && request.headers.origin && request.headers.origin !== (publicOrigin || `http://${request.headers.host}`)) {
        return send(response, "Request origin must match the local app.", { status: 403 });
      }
      const context = { request, response, url, pathname, searchParams, origin, page };
      for (const [routeMethod, path, handler] of routes) {
        if (routeMethod !== "*" && routeMethod !== method) continue;
        if (typeof path === "string" ? path !== pathname : !path.test(pathname)) continue;
        if (await handler(context) !== false) return;
      }
      return page({ title: "Page not found", status: 404,
        body: '<section class="lab-page"><h1>Page not found</h1><a href="/components">Browse components</a></section>' });
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
