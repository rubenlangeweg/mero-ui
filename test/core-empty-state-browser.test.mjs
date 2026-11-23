import { browserConfig } from "../scripts/browser-config.mjs";
import assert from "node:assert/strict";
import test from "node:test";
import { components } from "../site/catalog.mjs";
import { standalonePage } from "../site/catalog-pages.mjs";
import { createApp } from "../server.mjs";

const playwright = await import(browserConfig.playwrightModule || "playwright").catch(error => {
  if (error.code === "ERR_MODULE_NOT_FOUND" && !browserConfig.playwrightModule) return null;
  throw error;
});

test("the empty state ships with core and needs no collections assets", () => {
  const html = standalonePage(components.get("empty-state"), new URLSearchParams());
  assert.match(html, /mero\.css/);
  assert.doesNotMatch(html, /mero-collections\.(css|js)/);
});

test("empty state names its section with a real heading and centres its action", {
  skip: !playwright && "Install Playwright to run the browser regression",
}, async t => {
  const server = createApp();
  await new Promise(resolve => server.listen(0, "127.0.0.1", resolve));
  t.after(() => new Promise(resolve => { server.close(resolve); server.closeAllConnections(); }));
  const engine = browserConfig.engine || "chromium";
  const browser = await playwright[engine].launch({ executablePath: engine === "chromium" ? browserConfig.chromeExecutable : undefined });
  t.after(() => browser.close());
  const page = await browser.newPage({ reducedMotion: "reduce" });
  const base = "http://127.0.0.1:" + server.address().port;

  for (const theme of ["light", "dark"]) {
    for (const width of [1024, 360]) {
      await page.setViewportSize({ width, height: 700 });
      await page.goto(base + "/preview/empty-state?theme=" + theme);
      const region = page.getByRole("region", { name: "No environments yet" });
      assert.equal(await region.ariaSnapshot(), [
        '- region "No environments yet":',
        '  - heading "No environments yet" [level=2]',
        "  - paragraph: Create the first environment to deploy a release to it.",
        '  - link "New environment":',
        "    - /url: /components/form",
      ].join("\n"));
      const [box, action, title] = await Promise.all([region.boundingBox(), region.getByRole("link").boundingBox(), region.getByRole("heading").boundingBox()]);
      const centre = rect => rect.x + rect.width / 2;
      assert.ok(Math.abs(centre(action) - centre(box)) < 1 && Math.abs(centre(title) - centre(box)) < 1, "title and action are centred");
      assert.ok(action.y > title.y + title.height, "the action follows the text");
      assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
      await page.keyboard.press("Tab");
      assert.equal(await page.evaluate(() => document.activeElement.textContent.trim()), "New environment");
    }
  }

  // Collections still render their empty results with the core styles.
  await page.goto(base + "/preview/data-grid?variant=No+matches");
  // The grid may re-render its body after load, so wait for the settled element instead of reading it once.
  await page.waitForFunction(() => {
    const empty = document.querySelector(".mero-empty-state");
    return empty && getComputedStyle(empty).textAlign === "center" && getComputedStyle(empty.querySelector("strong")).display === "block";
  });
});
