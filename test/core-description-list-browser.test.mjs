import { browserConfig } from "../scripts/browser-config.mjs";
import assert from "node:assert/strict";
import test from "node:test";
import { createApp } from "../server.mjs";

const playwright = await import(browserConfig.playwrightModule || "playwright").catch(error => {
  if (error.code === "ERR_MODULE_NOT_FOUND" && !browserConfig.playwrightModule) return null;
  throw error;
});

test("description list pairs labels with values and stacks them below 768 px", {
  skip: !playwright && "Install Playwright to run the browser regression",
}, async t => {
  const server = createApp();
  await new Promise(resolve => server.listen(0, "127.0.0.1", resolve));
  t.after(() => new Promise(resolve => { server.close(resolve); server.closeAllConnections(); }));
  const engine = browserConfig.engine || "chromium";
  const browser = await playwright[engine].launch({ executablePath: engine === "chromium" ? browserConfig.chromeExecutable : undefined });
  t.after(() => browser.close());
  const page = await browser.newPage({ reducedMotion: "reduce" });
  const preview = theme => page.goto("http://127.0.0.1:" + server.address().port + "/preview/description-list?theme=" + theme);
  const row = label => page.locator(".mero-description-list > div").filter({ has: page.getByRole("term").filter({ hasText: label }) });
  const boxes = async label => ({ term: await row(label).locator("dt").boundingBox(), value: await row(label).locator("dd").boundingBox() });

  for (const theme of ["light", "dark"]) {
    await page.setViewportSize({ width: 1024, height: 700 });
    await preview(theme);
    // Screen readers get native term and definition pairs; the wrapping divs add nothing.
    assert.match(await page.locator(".mero-description-list").ariaSnapshot(), /- term: Release\n- definition:\n\s+- code: rel_01HZX3K9Q4F7WM2D8B6N\n- term: Region/);
    const wide = await boxes("Release");
    assert.ok(wide.value.x > wide.term.x + wide.term.width, "value sits after its label");
    assert.ok(Math.abs(wide.value.y - wide.term.y) < 4, "label and value share a row");
    assert.match(await row("Release").locator("code").evaluate(el => getComputedStyle(el).fontFamily), /monospace/);
    const [term, value] = await row("Region").evaluate(div => [...div.children].map(el => getComputedStyle(el).color));
    assert.notEqual(term, value, "labels are muted against their values");

    await page.setViewportSize({ width: 767, height: 700 });
    const narrow = await boxes("Release");
    assert.ok(narrow.value.y >= narrow.term.y + narrow.term.height - 1, "value sits below its label");
    assert.ok(Math.abs(narrow.value.x - narrow.term.x) < 1, "label and value start on the same edge");

    // A long unbroken identifier wraps instead of widening the page.
    await page.setViewportSize({ width: 320, height: 700 });
    await row("Release").locator("code").evaluate(el => { el.textContent = "rel_" + "0".repeat(80); });
    assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
  }
});
