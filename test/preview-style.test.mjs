import { browserConfig } from "../scripts/browser-config.mjs";
import test from "node:test";
import assert from "node:assert/strict";
import { createApp } from "../server.mjs";

const playwright = await import(browserConfig.playwrightModule || "playwright").catch(error => {
  if (error.code === "ERR_MODULE_NOT_FOUND" && !browserConfig.playwrightModule) return null;
  throw error;
});

test("the documentation shell preserves the exported component styles", { skip: !playwright }, async t => {
  const app = createApp();
  await new Promise((resolve, reject) => app.once("error", reject).listen(0, "127.0.0.1", resolve));
  const base = "http://127.0.0.1:" + app.address().port;
  const engine = browserConfig.engine || "chromium";
  const browser = await playwright[engine].launch({ executablePath: engine === "chromium" ? browserConfig.chromeExecutable : undefined });
  t.after(async () => {
    await browser.close();
    await new Promise(resolve => app.close(resolve));
  });
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 }, reducedMotion: "reduce" });
  const docs = await context.newPage();
  const standalone = await context.newPage();
  async function visualStyle(page, section, selector) {
    await page.evaluate(() => document.fonts.ready);
    return page.locator(section).locator(selector).first().evaluate(el => {
      const style = getComputedStyle(el);
      return [style.color, style.fontFamily, style.fontSize, style.fontWeight, style.lineHeight, style.textDecorationLine, style.boxSizing];
    });
  }
  for (const [id, selector] of [
    ["holo-card", "a"], ["inline-select", "select"], ["chat-conversation", "textarea"],
    ["carousel", "button"], ["breadcrumbs", "a"], ["cell-switch", "[role=switch]"],
  ]) {
    await Promise.all([docs.goto(base + "/components/" + id), standalone.goto(base + "/preview/" + id)]);
    assert.deepEqual(await visualStyle(docs, "[data-sample-scope]", selector), await visualStyle(standalone, "main", selector), id);
  }
});
