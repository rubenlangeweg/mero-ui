import { browserConfig } from "../scripts/browser-config.mjs";
import assert from "node:assert/strict";
import test from "node:test";
import { createApp } from "../server.mjs";

const playwright = await import(browserConfig.playwrightModule || "playwright").catch(error => {
  if (error.code === "ERR_MODULE_NOT_FOUND" && !browserConfig.playwrightModule) return null;
  throw error;
});

test("a start-edge drawer opens from the start side, closes from its button and returns focus", {
  skip: !playwright && "Install Playwright to run the browser regression",
}, async t => {
  const server = createApp();
  await new Promise(resolve => server.listen(0, "127.0.0.1", resolve));
  t.after(() => new Promise(resolve => { server.close(resolve); server.closeAllConnections(); }));
  const engine = browserConfig.engine || "chromium";
  const browser = await playwright[engine].launch({ executablePath: engine === "chromium" ? browserConfig.chromeExecutable : undefined });
  t.after(() => browser.close());
  const page = await browser.newPage({ reducedMotion: "reduce", viewport: { width: 960, height: 700 } });
  page.setDefaultTimeout(5000);

  for (const [theme, dir] of [["light", "ltr"], ["dark", "rtl"]]) {
    await page.goto("http://127.0.0.1:" + server.address().port + "/preview/drawer?variant=Start+edge&theme=" + theme);
    await page.evaluate(dir => { document.documentElement.dir = dir; }, dir);
    const opener = page.getByRole("button", { name: "Menu" });
    const drawer = page.getByRole("dialog", { name: "Navigation" });
    // The closed drawer waits off the start edge, so it slides in from that side.
    assert.equal(await page.locator("dialog.mero-drawer-start").evaluate(el => getComputedStyle(el).getPropertyValue("--mero-offset-x").trim()), dir === "ltr" ? "-100%" : "100%");

    await opener.focus();
    await page.keyboard.press("Enter");
    await drawer.waitFor();
    const box = await drawer.boundingBox();
    const radii = await drawer.evaluate(el => {
      const style = getComputedStyle(el);
      return { left: parseFloat(style.borderTopLeftRadius), right: parseFloat(style.borderTopRightRadius) };
    });
    if (dir === "ltr") {
      assert.ok(box.x < 1 && box.width < 960, "drawer sits on the left edge");
      assert.ok(radii.left === 0 && radii.right > 0, "only the inner corners are rounded");
    } else {
      assert.ok(Math.abs(box.x + box.width - 960) < 1, "drawer sits on the right edge in RTL");
      assert.ok(radii.right === 0 && radii.left > 0, "only the inner corners are rounded in RTL");
    }
    assert.ok(await page.getByRole("navigation", { name: "Main" }).isVisible());

    await page.getByRole("button", { name: "Close navigation" }).click();
    await drawer.waitFor({ state: "hidden" });
    await page.waitForFunction(() => document.activeElement?.textContent.trim() === "Menu");

    await page.keyboard.press("Enter");
    await drawer.waitFor();
    await page.keyboard.press("Escape");
    await drawer.waitFor({ state: "hidden" });
    await page.waitForFunction(() => document.activeElement?.textContent.trim() === "Menu");
  }
});
