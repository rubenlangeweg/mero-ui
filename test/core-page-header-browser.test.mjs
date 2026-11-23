import { browserConfig } from "../scripts/browser-config.mjs";
import assert from "node:assert/strict";
import test from "node:test";
import { createApp } from "../server.mjs";

const playwright = await import(browserConfig.playwrightModule || "playwright").catch(error => {
  if (error.code === "ERR_MODULE_NOT_FOUND" && !browserConfig.playwrightModule) return null;
  throw error;
});

test("page header keeps the record title named, actions at the end and wraps them below 768 px", {
  skip: !playwright && "Install Playwright to run the browser regression",
}, async t => {
  const server = createApp();
  await new Promise(resolve => server.listen(0, "127.0.0.1", resolve));
  t.after(() => new Promise(resolve => { server.close(resolve); server.closeAllConnections(); }));
  const engine = browserConfig.engine || "chromium";
  const browser = await playwright[engine].launch({ executablePath: engine === "chromium" ? browserConfig.chromeExecutable : undefined });
  t.after(() => browser.close());
  const page = await browser.newPage({ reducedMotion: "reduce" });
  const header = page.locator(".mero-page-head");
  const box = selector => header.locator(selector).first().boundingBox();

  for (const theme of ["light", "dark"]) {
    await page.setViewportSize({ width: 1024, height: 700 });
    await page.goto("http://127.0.0.1:" + server.address().port + "/preview/page-header?variant=Record&theme=" + theme);
    // The status badge follows the heading without becoming part of its name.
    await page.getByRole("heading", { level: 1, name: "acme-production", exact: true }).waitFor();
    assert.match(await header.ariaSnapshot(), /navigation "Breadcrumb"[\s\S]*heading "acme-production" \[level=1\]\n- text: Live/);

    const [crumbs, title, actions, bounds] = [await box(".mero-breadcrumbs"), await box("h1"), await box(".mero-page-head-actions"), await header.boundingBox()];
    assert.ok(crumbs.y + crumbs.height <= title.y, "breadcrumbs sit above the title");
    assert.ok(actions.y < title.y + title.height && actions.y + actions.height > title.y, "actions share the title row");
    assert.ok(Math.abs(actions.x + actions.width - (bounds.x + bounds.width)) < 1, "actions end at the header edge");

    await page.evaluate(() => { document.documentElement.dir = "rtl"; });
    const [rtlActions, rtlBounds] = [await box(".mero-page-head-actions"), await header.boundingBox()];
    assert.ok(Math.abs(rtlActions.x - rtlBounds.x) < 1, "actions move to the inline end in RTL");
    await page.evaluate(() => { document.documentElement.dir = "ltr"; });

    await page.setViewportSize({ width: 767, height: 700 });
    const [meta, narrowActions] = [await box("p"), await box(".mero-page-head-actions")];
    assert.ok(narrowActions.y >= meta.y + meta.height, "actions wrap under the heading");

    // Reading order is visual order: breadcrumb, then the actions.
    await page.getByRole("link", { name: "Environments" }).focus();
    await page.keyboard.press(engine === "webkit" && process.platform === "darwin" ? "Alt+Tab" : "Tab");
    assert.equal(await page.evaluate(() => document.activeElement.textContent.trim()), "Suspend");

    await page.setViewportSize({ width: 320, height: 700 });
    await header.locator("h1").evaluate(el => { el.textContent = "acme-" + "production".repeat(8); });
    assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), "long titles wrap");
  }
});
