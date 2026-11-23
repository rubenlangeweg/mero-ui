import { browserConfig } from "../scripts/browser-config.mjs";
import assert from "node:assert/strict";
import test from "node:test";
import { createApp } from "../server.mjs";

const playwright = await import(browserConfig.playwrightModule || "playwright").catch(error => {
  if (error.code === "ERR_MODULE_NOT_FOUND" && !browserConfig.playwrightModule) return null;
  throw error;
});

test("visually hidden text completes accessible names without taking space", {
  skip: !playwright && "Install Playwright to run the browser regression",
}, async t => {
  const server = createApp();
  await new Promise(resolve => server.listen(0, "127.0.0.1", resolve));
  t.after(() => new Promise(resolve => { server.close(resolve); server.closeAllConnections(); }));
  const engine = browserConfig.engine || "chromium";
  const browser = await playwright[engine].launch({ executablePath: engine === "chromium" ? browserConfig.chromeExecutable : undefined });
  t.after(() => browser.close());
  const page = await browser.newPage({ reducedMotion: "reduce" });

  for (const theme of ["light", "dark"]) {
    await page.goto("http://127.0.0.1:" + server.address().port + "/preview/visually-hidden?theme=" + theme);
    const button = page.getByRole("button", { name: "Copy release ID", exact: true });
    await button.waitFor();
    assert.match(await page.locator(".mero-row").ariaSnapshot(), /- text: 3 environments need attention/);

    const sizes = await button.evaluate(el => {
      const hidden = el.querySelector(".mero-sr-only").getBoundingClientRect();
      const clone = el.cloneNode(true);
      clone.querySelector(".mero-sr-only").remove();
      el.after(clone);
      const without = clone.getBoundingClientRect().width;
      clone.remove();
      return { hidden: [hidden.width, hidden.height], with: el.getBoundingClientRect().width, without };
    });
    assert.deepEqual(sizes.hidden, [1, 1]);
    assert.ok(Math.abs(sizes.with - sizes.without) < 1, "the hidden words add no width to the button");

    // A hidden phrase at the far end of a scrolling container does not widen the page.
    await page.setViewportSize({ width: 320, height: 600 });
    await page.evaluate(() => {
      const scroller = document.createElement("div");
      scroller.style.cssText = "position:relative;overflow-x:auto";
      scroller.innerHTML = '<p style="inline-size:200vw">Wide content<span class="mero-sr-only"> and a long hidden explanation at the end</span></p>';
      document.querySelector("main").append(scroller);
    });
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth), 320);
    await page.setViewportSize({ width: 1280, height: 720 });
  }
});
