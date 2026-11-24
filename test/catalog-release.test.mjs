import test from "node:test";
import assert from "node:assert/strict";
import { access } from "node:fs/promises";
import { groups, components, moduleAssets } from "../site/catalog.mjs";
import { componentPage, standalonePage } from "../site/catalog-pages.mjs";
import { selectVariant } from "../site/examples.mjs";

test("every catalog example has a usable preview, matching template, and optional assets on disk", async () => {
  for (const component of components.values()) {
    assert.ok(component.demo && component.name && component.description, component.id);
    const sample = selectVariant(component, new URLSearchParams());
    assert.equal(sample.code, component.code ?? component.demo);
    assert.ok(standalonePage(component, new URLSearchParams()).includes(sample.demo), component.id);
    assert.ok(componentPage(component, new URLSearchParams()).includes("Use in your app"), component.id);
    for (const variant of component.variants ?? []) {
      assert.equal(
        selectVariant(component, new URLSearchParams({ variant: variant.name })).demo,
        variant.demo,
      );
    }
  }
  const assets = new Set([...components.values()].flatMap((item) => moduleAssets(item.module)));
  await Promise.all([...assets].map((name) => access(new URL("../ui/" + name, import.meta.url))));
  assert.equal(
    groups.reduce((count, group) => count + group.items.length, 0),
    components.size,
  );
});

test("optional media code stays scoped to media pages", () => {
  const button = standalonePage(components.get("button"), new URLSearchParams());
  const gallery = standalonePage(components.get("carousel"), new URLSearchParams());
  assert.doesNotMatch(button, /mero-gallery\.(js|css)/);
  assert.match(gallery, /mero-gallery\.js/);
  assert.match(gallery, /mero-gallery\.css/);
});

test("chart and Markdown helpers are downloadable server modules separate from the browser assets", async () => {
  for (const item of [...components.values()].filter(item => item.category === "Charts" || item.id === "markdown")) {
    const file = item.id === "markdown" ? "insight-markdown.mjs" : "insight-charts.mjs";
    await access(new URL("../ui/" + file, import.meta.url));
    for (const variant of ["Default", ...(item.variants || []).map(option => option.name)]) {
      const search = new URLSearchParams({ variant });
      const page = componentPage(item, search);
      assert.ok(page.includes(`Optional server helper · <a href="/${file}" download>`), item.id);
      assert.ok(!page.match(/<ul aria-label="Download individual assets">[\s\S]*?<\/ul>/)[0].includes(file));
      assert.ok(!standalonePage(item, search).includes(file));
    }
  }
  assert.doesNotMatch(componentPage(components.get("button"), new URLSearchParams()), /Optional server helper/);
});

test("pages run on plain htmx 4: no implicit inheritance, one vendored htmx 4 build, native trigger contract", async () => {
  const { readFile } = await import("node:fs/promises");
  const { shell } = await import("../site/shell.mjs");
  const { referencePage } = await import("../site/reference.mjs");
  for (const html of [shell({ body: "" }), standalonePage(components.get("button"), new URLSearchParams())]) {
    assert.match(html, /name="htmx-config"/);
    assert.doesNotMatch(html, /implicitInheritance/);
  }
  const pinned = JSON.parse(await readFile(new URL("../package.json", import.meta.url), "utf8")).devDependencies["htmx.org"];
  assert.match(String(pinned), /^\d+\.\d+\.\d+$/, "htmx.org must be an exact devDependency version");
  const fix = `run npm ci; public/vendor/htmx.min.js must equal htmx.org@${pinned} dist/htmx.min.js. To re-vendor: bump htmx.org in package.json and copy node_modules/htmx.org/dist/htmx.min.js to public/vendor/`;
  const [vendored, published] = await Promise.all(
    ["../public/vendor/htmx.min.js", "../node_modules/htmx.org/dist/htmx.min.js"].map((file) =>
      readFile(new URL(file, import.meta.url)).catch(() => assert.fail(fix)),
    ),
  );
  assert.ok(vendored.equals(published), fix);
  await assert.rejects(access("public/vendor/htmx-4.min.js"));
  assert.doesNotMatch(referencePage(), /HX-Trigger-After/);
});
