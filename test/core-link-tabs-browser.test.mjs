import { browserConfig } from "../scripts/browser-config.mjs";
import assert from "node:assert/strict";
import test from "node:test";
import { createApp } from "../server.mjs";
import { groups } from "../site/core-components.mjs";

const playwright = await import(browserConfig.playwrightModule || "playwright").catch(error => {
  if (error.code === "ERR_MODULE_NOT_FOUND" && !browserConfig.playwrightModule) return null;
  throw error;
});

test("link tabs are a nav of links the server marks with aria-current", () => {
  const variant = groups.flatMap(({ items }) => items).find(({ id }) => id === "tabs").variants.find(({ name }) => name === "Link tabs");
  assert.match(variant.code, /<nav class="mero-tabs-list" aria-label="Operation views">/);
  assert.equal(variant.code.match(/aria-current="page"/g).length, 1);
  assert.doesNotMatch(variant.code, /role="tab|data-mero-tabs/);
  assert.match(variant.render(new URLSearchParams({ view: "closed" })), /href="\?view=closed" aria-current="page">Completed</);
});

test("link tabs navigate with Tab and Enter, show the current view and keep it in forced colors", {
  skip: !playwright && "Install Playwright to run the browser regression",
}, async t => {
  const server = createApp();
  await new Promise(resolve => server.listen(0, "127.0.0.1", resolve));
  t.after(() => new Promise(resolve => { server.close(resolve); server.closeAllConnections(); }));
  const engine = browserConfig.engine || "chromium";
  const browser = await playwright[engine].launch({ executablePath: engine === "chromium" ? browserConfig.chromeExecutable : undefined });
  t.after(() => browser.close());
  const base = "http://127.0.0.1:" + server.address().port + "/preview/tabs?variant=Link+tabs";
  const tab = (page, name) => page.getByRole("navigation", { name: "Operation views" }).getByRole("link", { name });
  const linkKey = engine === "webkit" && process.platform === "darwin" ? "Alt+Tab" : "Tab";

  for (const theme of ["light", "dark"]) {
    const page = await browser.newPage({ reducedMotion: "reduce", javaScriptEnabled: theme === "light" });
    await page.goto(base + "&theme=" + theme);
    const attention = tab(page, "Needs attention 3"), active = tab(page, "In progress 12");
    assert.equal(await attention.getAttribute("aria-current"), "page");
    const [current, other] = await Promise.all([attention, active].map(link => link.evaluate(el => getComputedStyle(el).backgroundColor)));
    assert.notEqual(current, other, "the current view stands out");

    await attention.focus();
    await page.keyboard.press(linkKey);
    assert.equal(await page.evaluate(() => document.activeElement.textContent.replace(/\s+/g, " ").trim()), "In progress 12");
    await page.keyboard.press("Enter");
    await page.waitForURL(/view=active/);
    assert.equal(await tab(page, "In progress 12").getAttribute("aria-current"), "page");
    assert.equal(await tab(page, "Needs attention 3").getAttribute("aria-current"), null);

    await page.setViewportSize({ width: 320, height: 600 });
    assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), "tabs wrap instead of overflowing");
    await page.close();
  }

  if (engine === "chromium") {
    const page = await browser.newPage({ forcedColors: "active" });
    await page.goto(base);
    assert.notEqual(await tab(page, "Needs attention 3").evaluate(el => getComputedStyle(el).outlineStyle), "none");
    assert.equal(await tab(page, "Completed").evaluate(el => getComputedStyle(el).outlineStyle), "none");
    await page.close();
  }
});
