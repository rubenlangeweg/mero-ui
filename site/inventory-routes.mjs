import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { fileURLToPath } from "node:url";
import {
  blankProductDialog, createLabStore, inventoryContext, productVersion, renderDelete,
  renderProductDialog, renderProductForm, renderResults, saveProduct,
} from "./lab.mjs";
import { renderStats } from "./layouts.mjs";

const execFileAsync = promisify(execFile);
export const inventoryAssets = [
  "mero.css", "mero.js", "mero-forms.js", "mero-layouts.css",
  "mero-inventory.css", "mero-inventory.js", "vendor/htmx.min.js",
  "vendor/HTMX-LICENSE.txt", "fonts/geist.woff2", "fonts/geist-mono.woff2",
  "fonts/geist-LICENSE.txt", "fonts/geist-mono-LICENSE.txt",
];

export const inventoryArchiveEntries = [
  "LICENSE",
  "examples/studio-inventory/server.mjs", "examples/studio-inventory/README.md",
  "site/html.mjs", "site/lab.mjs", "site/layouts.mjs", "site/inventory-routes.mjs",
  ...inventoryAssets.map(name => "public/" + name),
];

function send(response, body, status = 200, headers = {}) {
  response.writeHead(status, { "Content-Type": "text/html; charset=utf-8", "Cache-Control": "no-store", ...headers });
  response.end(body);
  return true;
}

async function parameters(request) {
  const chunks = [];
  let size = 0;
  for await (const chunk of request) {
    size += chunk.length;
    if (size > 16384) return null;
    chunks.push(chunk);
  }
  return new URLSearchParams(Buffer.concat(chunks).toString());
}

// Callers supply a fixed manifest of project paths.
export async function createSourceArchive(entries) {
  const { stdout } = await execFileAsync("tar", ["-czf", "-", "--", ...entries], {
    cwd: fileURLToPath(new URL("../", import.meta.url)), encoding: "buffer", maxBuffer: 32 * 1024 * 1024,
    env: { ...process.env, COPYFILE_DISABLE: "1" },
  });
  return stdout;
}

export async function handleInventoryRequest(request, response, url, store, { basePath = "/demo/products", demoControls = true, renderRelated = () => "", origin } = {}) {
  if (request.method === "GET" && url.pathname === "/downloads/studio-inventory.tar.gz") {
    const archive = await createSourceArchive(inventoryArchiveEntries);
    return send(response, archive, 200, {
      "Content-Type": "application/gzip",
      "Content-Disposition": 'attachment; filename="studio-inventory.tar.gz"',
    });
  }

  if (url.pathname !== basePath && !url.pathname.startsWith(basePath + "/")) return false;
  const route = url.pathname.slice(basePath.length);
  if (request.method !== "GET" && request.method !== "POST") return send(response, "Method not allowed.", 405);
  const expectedOrigin = origin ?? `${request.socket?.encrypted ? "https" : "http"}://${request.headers.host}`;
  if (request.method === "POST" && request.headers.origin && request.headers.origin !== expectedOrigin) {
    return send(response, "Request origin must match the local app.", 403);
  }
  const params = request.method === "GET" ? url.searchParams : await parameters(request);
  if (!params) return send(response, "Form is too large.", 413);
  const instance = params.get("instance") ?? "";
  if (instance && !/^[a-z][a-z0-9-]{0,47}$/i.test(instance)) return send(response, "Invalid inventory instance.", 400);
  const context = inventoryContext({ instance, basePath });
  const version = () => ({ "Inventory-Revision": String(store.revision) });

  if (request.method === "GET" && route === "") return send(response, renderResults(store, params, false, context), 200, version());
  if (request.method === "GET" && route === "/new") return send(response, blankProductDialog(context));
  if (request.method === "POST" && route === "/reset" && demoControls) {
    const previous = store.revision;
    Object.assign(store, createLabStore(), { revision: previous + 1 });
    return send(response, renderResults(store, params, false, context) + (params.has("dashboard") ? renderStats(store, true, context) : ""), 200, version());
  }

  const match = route.match(/^\/(\d+)(?:\/(edit|delete))?$/);
  if (route && !match) return send(response, "Product route not found.", 404);
  const scenario = demoControls && request.method === "POST" ? params.get("scenario") : "";
  if (scenario === "slow") await new Promise(resolve => setTimeout(resolve, 1000));
  if (scenario === "fail") return send(response, "The sample server could not save this change.", 500);
  const product = match ? store.products.find(item => String(item.id) === match[1]) : null;
  if (match && !product) return send(response, "This product no longer exists.", 404, { "Relay-Form-Error": "This product was removed. Close the editor and refresh the inventory." });
  const action = match?.[2];
  if (request.method === "GET") {
    if (action === "edit") return send(response, renderProductDialog(product, {}, false, context));
    if (action === "delete") return send(response, renderDelete(product, context));
    return send(response, "Method not allowed.", 405);
  }
  if (action === "edit") return send(response, "Method not allowed.", 405);
  if (product && params.has("productVersion") && params.get("productVersion") !== productVersion(product)) {
    const conflict = "This product changed while you were editing it. Your draft is still here. Reopen the product to review its latest values.";
    return send(response, conflict, 409, { ...version(), "Relay-Form-Error": conflict });
  }

  let message;
  let changedId;
  if (action === "delete") {
    store.products = store.products.filter(item => item.id !== product.id);
    store.revision++;
    message = "Product deleted";
  } else {
    const validation = scenario === "invalid" ? { sku: "The sample server rejected this SKU. Review it and save again." } : {};
    const result = saveProduct(store, product, params, validation);
    if (result.errors) return send(response, renderProductForm(result.product, result.errors, !product, context, product ? productVersion(product) : undefined), 422);
    changedId = result.product.id;
    message = product ? "Product updated" : "Product created";
  }
  const fragments = renderResults(store, params, true, context, changedId) +
    (params.has("dashboard") ? renderStats(store, true, context) : "") +
    (params.has("studioShowcase") ? renderRelated(changedId ?? product.id) : "");
  return send(response, fragments, 200, {
    ...version(), "HX-Reswap": "none",
    "HX-Trigger-After-Settle": JSON.stringify({ "relay:form-saved": { message } }),
  });
}
