import { createServer } from "node:http";
import { readFile } from "node:fs/promises";
import { extname } from "node:path";
import { pathToFileURL } from "node:url";
import { createLabStore, renderWorkbench } from "../../site/lab.mjs";
import { renderLayout } from "../../site/layouts.mjs";
import { handleInventoryRequest, inventoryAssets } from "../../site/inventory-routes.mjs";

const files = new URL("../../public/", import.meta.url);
const types = { ".js": "text/javascript", ".css": "text/css", ".woff2": "font/woff2", ".txt": "text/plain" };
const navigation = [
  { id: "dashboard", href: "/", label: "Overview" },
  { id: "two", href: "/two", label: "Two inventories" },
];

function page(content, theme, url) {
  const nextTheme = theme === "dark" ? "light" : "dark";
  const preferences = new URLSearchParams(url.searchParams);
  preferences.set("theme", nextTheme);
  return `<!doctype html><html lang="en" data-theme="${theme}"><head>
    <meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
    <title>Studio Inventory · Mero UI</title>
    <link rel="stylesheet" href="/mero.css"><link rel="stylesheet" href="/mero-layouts.css"><link rel="stylesheet" href="/mero-inventory.css">
    <style>
      @font-face{font-family:Geist;src:url("/fonts/geist.woff2") format("woff2");font-weight:100 900;font-display:swap}
      @font-face{font-family:"Geist Mono";src:url("/fonts/geist-mono.woff2") format("woff2");font-weight:100 900;font-display:swap}
      *{box-sizing:border-box}body{margin:0;background:var(--mero-bg);color:var(--mero-text);font-family:var(--mero-font)}
      main{max-width:72rem;margin:clamp(1rem,5vw,4rem) auto;padding:0 1rem}
      main>nav{display:flex;flex-wrap:wrap;gap:1rem;margin-block-end:1rem}main>nav a{color:inherit}
      .examples{display:grid;grid-template-columns:minmax(0,1fr);gap:1.25rem}.tenant{min-width:0;--mero-primary:#23655e;--mero-primary-ink:white;--mero-accent:#368a80}
    </style>
    <script defer src="/vendor/htmx.min.js"></script><script defer src="/mero.js"></script>
    <script defer src="/mero-forms.js"></script><script defer src="/mero-inventory.js"></script>
    </head><body><main><nav aria-label="Preview">${url.pathname === "/two" ? '<a href="/">Back to overview</a>' : ""}<a href="?${preferences.toString().replaceAll("&", "&amp;")}">Use ${nextTheme} theme</a></nav>${content}</main></body></html>`;
}

export function createInventoryExample() {
  const store = createLabStore();
  const tenantStore = createLabStore();
  return createServer(async (req, res) => {
    try {
      const url = new URL(req.url, "http://localhost");
      if (await handleInventoryRequest(req, res, url, store, { basePath: "/inventory" })) return;
      if (await handleInventoryRequest(req, res, url, tenantStore, { basePath: "/tenant/inventory" })) return;
      const name = url.pathname.slice(1);
      if (req.method === "GET" && inventoryAssets.includes(name)) {
        const asset = await readFile(new URL(name, files));
        res.writeHead(200, { "Content-Type": types[extname(name)], "X-Content-Type-Options": "nosniff" });
        return res.end(asset);
      }
      if (req.method === "GET" && ["/", "/two"].includes(url.pathname)) {
        const shared = { expanded: true, inspect: true, basePath: "/inventory", initial: url.searchParams };
        const content = url.pathname === "/"
          ? renderLayout("dashboard", store, {}, { ...shared, navigation, instance: "studio", pageHeading: true })
          : `<h1>Two inventories</h1><div class="examples">${renderWorkbench(store, { ...shared, instance: "studio" })}<section class="tenant" aria-label="Tenant inventory">${renderWorkbench(tenantStore, { ...shared, brand: "Tenant", initial: new URLSearchParams(), instance: "tenant", basePath: "/tenant/inventory" })}</section></div>`;
        res.writeHead(200, { "Content-Type": "text/html; charset=utf-8", "Cache-Control": "no-store" });
        return res.end(page(content, url.searchParams.get("theme") === "light" ? "light" : "dark", url));
      }
      res.writeHead(404);
      res.end("Not found.");
    } catch (error) {
      console.error(error);
      if (!res.headersSent) res.writeHead(500);
      res.end("Request failed.");
    }
  });
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const port = Number(process.env.PORT ?? 4183);
  createInventoryExample().listen(port, "127.0.0.1", () => console.log(`Studio Inventory is running at http://127.0.0.1:${port}/`));
}
