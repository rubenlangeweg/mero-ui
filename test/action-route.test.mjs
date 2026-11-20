import test from "node:test";
import assert from "node:assert/strict";
import { createApp } from "../server.mjs";
import { components } from "../site/catalog.mjs";
import { exampleAssets } from "../site/catalog-pages.mjs";

test("action demo route maps each outcome to its status and headers", async t => {
  const server = createApp();
  await new Promise(resolve => server.listen(0, "127.0.0.1", resolve));
  t.after(() => new Promise(resolve => server.close(resolve)));
  const post = outcome => fetch(`http://127.0.0.1:${server.address().port}/demo/catalog/action-button${outcome ? "?outcome=" + outcome : ""}`, { method: "POST" });

  const succeeded = await post("succeeded");
  assert.equal(succeeded.status, 200);
  assert.equal(succeeded.headers.get("mero-action-message"), "Export restarted.");
  const rejected = await post("rejected");
  assert.equal(rejected.status, 409);
  assert.equal(rejected.headers.get("mero-action-message"), "This key was already revoked. Nothing changed.");
  const unknown = await post("unknown");
  assert.equal(unknown.status, 503);
  assert.equal(unknown.headers.get("mero-action-message"), null);
  assert.equal((await post()).status, 400);
  assert.equal((await post("toString")).status, 400);
});

test("action button example ships HTMX and mero-forms.js", () => {
  const item = components.get("action-button");
  const assets = exampleAssets(item, item.code);
  assert.ok(assets.includes("mero-forms.js"));
  assert.ok(assets.includes("vendor/htmx.min.js"));
  assert.equal(item.code.match(/ data-mero-action>/g).length, 3);
  assert.equal(item.code.match(/data-mero-action-status role="status"/g).length, 3);
});
