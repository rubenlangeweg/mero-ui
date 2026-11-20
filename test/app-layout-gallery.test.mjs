import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { examplePage, layoutGallery, showcaseApps } from "../site/app-examples.mjs";
import { renderStats } from "../site/layouts.mjs";

test("the gallery and example switcher link to each working app with local light and dark captures", async () => {
  const gallery = layoutGallery();
  for (const id of [...showcaseApps.map(app => app.id), "settings"]) {
    assert.ok(gallery.includes(`href="/layouts/${id}"`));
    const example = examplePage(id, "<h1>Example</h1>");
    assert.equal(example.match(/aria-current="page"/g)?.length, 1);
    assert.ok(example.includes(`href="/layouts/${id}" aria-current="page"`));
    assert.ok(example.includes(`href="/layouts#example-${id}"`));
    assert.ok(gallery.includes(`id="example-${id}"`));
    for (const capture of ["light", "dark", "light-phone", "dark-phone"]) {
      const path = `/example-${id}-${capture}.webp`;
      assert.ok(gallery.includes(path));
      const bytes = await readFile(new URL("../public" + path, import.meta.url));
      assert.equal(bytes.toString("ascii", 8, 12), "WEBP");
    }
  }
});

test("dashboard breakdowns use the current inventory after an edit or removal", () => {
  const store = { products: [
    { category: "Objects", status: "Active" },
    { category: "Objects", status: "Draft" },
    { category: "Lighting", status: "Active" },
  ] };
  const initial = renderStats(store);
  assert.ok(initial.includes("67% of catalog"));
  assert.ok(initial.includes("2 in Objects"));
  store.products = [];
  const updated = renderStats(store, true);
  assert.ok(updated.includes('hx-swap-oob="true"'));
  assert.ok(updated.includes("0% of catalog"));
  assert.ok(updated.includes("No categories yet"));
});
