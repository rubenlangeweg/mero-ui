import assert from "node:assert/strict";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { Readable } from "node:stream";
import { pathToFileURL } from "node:url";
import test from "node:test";
import { createLabStore, productVersion, renderWorkbench } from "../site/lab.mjs";
import { renderLayout } from "../site/layouts.mjs";
import { handleInventoryRequest } from "../site/inventory-routes.mjs";

async function exchange(store, path, fields, options) {
  const body = fields ? new URLSearchParams(fields).toString() : "";
  const request = Object.assign(Readable.from([Buffer.from(body)]), {
    method: fields ? "POST" : "GET", headers: { host: "localhost" },
  });
  const response = {
    writeHead(status, headers) { this.status = status; this.headers = headers; },
    end(body) { this.body = body; },
  };
  assert.equal(await handleInventoryRequest(request, response, new URL(path, "http://localhost"), store, options), true);
  return response;
}

test("instance-scoped fragments and host routing survive validation, save and delete", async () => {
  const store = createLabStore();
  const options = { basePath: "/stock" };
  const draft = { instance: "studio", name: "Arc Task Lamp", sku: "SL-204", category: "Lighting", status: "Active", finish: "sand", dashboard: "1" };
  const first = renderWorkbench(store, { ...options, instance: "studio" });
  const second = renderWorkbench(store, { ...options, instance: "tenant" });
  const ids = [...(first + second).matchAll(/\sid="([^"]+)"/g)].map(match => match[1]);
  assert.equal(ids.length, new Set(ids).size);
  assert.match(first, /hx-get="\/stock\/6\/edit" hx-target="#studio-lab-overlay"/);
  const drawer = await exchange(store, "/stock/6/edit?instance=studio", undefined, options);
  assert.match(drawer.body, /data-mero-return-focus="#studio-edit-product-6"/);
  const invalid = await exchange(store, "/stock/6", { ...draft, sku: "RL-1042" }, options);
  assert.equal(invalid.status, 422);
  assert.match(invalid.body, /aria-describedby="studio-error-sku"/);
  assert.match(invalid.body, /value="sand" selected/);
  assert.equal(store.products.at(-1).finish, "ivory");
  const failure = await exchange(store, "/stock/6", { ...draft, scenario: "fail" }, options);
  assert.equal(failure.status, 500);
  assert.equal(store.revision, 0);
  const success = await exchange(store, "/stock/6", draft, options);
  assert.match(success.body, /id="studio-product-results" hx-swap-oob="true"/);
  assert.match(success.body, /id="studio-dashboard-stats"[^>]*hx-swap-oob="true"/);
  assert.match(success.body, /SL-204 · Warm sand/);
  assert.equal(success.headers["Inventory-Revision"], "1");
  assert.equal(store.products.at(-1).finish, "sand");
  assert.equal((await exchange(store, "/stock/6/delete", draft, options)).status, 200);
  assert.equal(store.products.some(item => item.id === 6), false);
});

test("deep links pass an unsaved lamp finish to the drawer, with host-defined navigation", () => {
  const store = createLabStore();
  const view = renderLayout("dashboard", store, {}, {
    initial: new URLSearchParams({ edit: "6", finish: "graphite" }),
    instance: "sample", brand: "Workbench", navigation: [{ id: "dashboard", href: "/work", label: "Home" }],
  });
  assert.match(view, /<option value="graphite" selected>/);
  assert.match(view, /id="sample-product-dialog"/);
  assert.ok(view.includes(`name="productVersion" value="${productVersion(store.products.at(-1))}"`));
  assert.match(view, /href="\/work" aria-current="page">Home/);
  assert.equal(store.products.at(-1).finish, "ivory");
});

test("stale edits and deletes preserve the latest record, including after a validation retry", async () => {
  const store = createLabStore();
  const original = store.products[0];
  const version = productVersion(original);
  const draft = { ...original, name: "New chair", productVersion: version };
  const form = await exchange(store, "/demo/products/1/edit");
  assert.ok(form.body.includes(`name="productVersion" value="${version}"`));
  const invalid = await exchange(store, "/demo/products/1", { ...draft, sku: "" });
  assert.equal(invalid.status, 422);
  assert.ok(invalid.body.includes(`name="productVersion" value="${version}"`));
  assert.equal((await exchange(store, "/demo/products/1", draft)).status, 200);
  for (const route of ["/demo/products/1", "/demo/products/1/delete"]) {
    const stale = await exchange(store, route, { ...draft, name: "Old chair" });
    assert.equal(stale.status, 409);
    assert.match(stale.headers["Mero-Form-Error"], /Reopen/);
    assert.equal(store.products[0].name, "New chair");
  }
  const other = store.products[1];
  assert.equal((await exchange(store, "/demo/products/2", { ...other, name: "Other lamp", productVersion: productVersion(other) })).status, 200);
});

test("only participating hosts receive extra markup for the changed inventory item", async () => {
  const store = createLabStore();
  const options = { renderRelated: id => `<aside>Related ${id}</aside>` };
  const record = store.products[0];
  assert.doesNotMatch((await exchange(store, "/demo/products/1", record, options)).body, /Related/);
  assert.match((await exchange(store, "/demo/products/1", { ...record, studioShowcase: "1" }, options)).body, /Related 1/);
  assert.match((await exchange(store, "/demo/products/1/delete", { studioShowcase: "1" }, options)).body, /Related 1/);
});

test("downloaded archive contains a runnable application with local assets and shared handlers", async (t) => {
  const response = await exchange(createLabStore(), "/downloads/studio-inventory.tar.gz");
  const directory = await mkdtemp(join(tmpdir(), "mero-inventory-test-"));
  t.after(() => rm(directory, { recursive: true, force: true }));
  const archive = join(directory, "inventory.tar.gz");
  await writeFile(archive, response.body);
  await promisify(execFile)("tar", ["-xzf", archive, "-C", directory]);
  const script = join(directory, "examples/studio-inventory/server.mjs");
  const { createInventoryExample } = await import(pathToFileURL(script).href);
  assert.equal(typeof createInventoryExample, "function");
  assert.deepEqual(await readFile(join(directory, "ui/mero-inventory.css")), await readFile(new URL("../ui/mero-inventory.css", import.meta.url)));
  assert.ok(await readFile(join(directory, "public/vendor/HTMX-LICENSE.txt"), "utf8"));
});
