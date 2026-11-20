import assert from "node:assert/strict";
import test from "node:test";
import { catalogFragment, groups } from "../site/core-components.mjs";
import { createLabStore, renderResults, renderProductForm, saveProduct } from "../site/lab.mjs";

test("the catalog exposes distinct copyable component examples", () => {
  const entries = groups.flatMap(({ items }) => items);
  assert.equal(entries.length, 79);
  assert.equal(new Set(entries.map(({ id }) => id)).size, entries.length);
  assert.ok(entries.every(({ name, description, demo, code }) => name && description && demo && code));
  assert.equal(catalogFragment("missing", new URLSearchParams()), null);
});

test("invalid saves preserve the draft and leave the stored product intact", () => {
  const store = createLabStore();
  const existing = store.products[0];
  const draft = new URLSearchParams({ name: '<Arc & Chair>', sku: "rl-1078", category: "Furniture", status: "Draft" });
  const result = saveProduct(store, existing, draft);
  assert.match(result.errors.sku, /already uses/);
  const form = renderProductForm(result.product, result.errors);
  assert.match(form, /&lt;Arc &amp; Chair&gt;/);
  assert.match(form, /aria-invalid="true" aria-describedby="error-sku"/);
  assert.equal(existing.name, "Arc Lounge Chair");
  assert.equal(existing.status, "Active");
});

test("valid changes are reflected in filtered out-of-band results", () => {
  const store = createLabStore();
  const draft = new URLSearchParams({ name: "Mesh chair", sku: "RL-9999", category: "Furniture", status: "Draft" });
  assert.equal(saveProduct(store, null, draft).errors, null);
  const fragment = renderResults(store, new URLSearchParams({ q: "mesh" }), true);
  assert.match(fragment, /id="product-results" hx-swap-oob="true"/);
  assert.match(fragment, /Mesh chair/);
  assert.doesNotMatch(fragment, /Arc Lounge Chair/);
});
