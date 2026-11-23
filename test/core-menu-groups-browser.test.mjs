import { browserConfig } from "../scripts/browser-config.mjs";
import assert from "node:assert/strict";
import test from "node:test";
import { createApp } from "../server.mjs";

const playwright = await import(browserConfig.playwrightModule || "playwright").catch(error => {
  if (error.code === "ERR_MODULE_NOT_FOUND" && !browserConfig.playwrightModule) return null;
  throw error;
});

// WCAG relative luminance from a computed rgb() or color(srgb …) value.
function luminance(value) {
  const numbers = value.match(/[\d.]+/g).map(Number);
  const channels = value.startsWith("color(") ? numbers.slice(0, 3) : numbers.slice(0, 3).map(n => n / 255);
  const [r, g, b] = channels.map(c => c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4);
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}
const contrast = (a, b) => {
  const [light, dark] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (light + 0.05) / (dark + 0.05);
};

test("menu groups take their name from a visible heading and the danger item stays legible", {
  skip: !playwright && "Install Playwright to run the browser regression",
}, async t => {
  const server = createApp();
  await new Promise(resolve => server.listen(0, "127.0.0.1", resolve));
  t.after(() => new Promise(resolve => { server.close(resolve); server.closeAllConnections(); }));
  const engine = browserConfig.engine || "chromium";
  const browser = await playwright[engine].launch({ executablePath: engine === "chromium" ? browserConfig.chromeExecutable : undefined });
  t.after(() => browser.close());
  const page = await browser.newPage({ reducedMotion: "reduce" });
  page.setDefaultTimeout(5000);
  const focused = text => page.waitForFunction(text => document.activeElement?.textContent.trim() === text, text);

  for (const theme of ["light", "dark"]) {
    await page.goto("http://127.0.0.1:" + server.address().port + "/preview/menu-button?variant=Groups+and+danger&theme=" + theme);
    const button = page.getByRole("button", { name: "Environment actions" });
    const menu = page.getByRole("menu", { name: "acme-production actions" });
    await button.focus();
    await page.keyboard.press("Enter");
    await focused("Deploy release");

    // Each heading names its group once; it is not a menu item of its own.
    const tree = await menu.ariaSnapshot();
    assert.match(tree, /- group "Lifecycle":\n\s+- menuitem "Deploy release"\n\s+- menuitem "Suspend"\n\s+- group "Access":/);
    assert.doesNotMatch(tree, /- text: (Lifecycle|Access)/);

    // Arrow keys and typeahead move between items and skip the headings.
    for (const next of ["Suspend", "Grant support access", "Delete environment…", "Deploy release"]) {
      await page.keyboard.press("ArrowDown");
      await focused(next);
    }
    await page.keyboard.press("l");
    assert.equal(await page.evaluate(() => document.activeElement.textContent.trim()), "Deploy release", "typeahead ignores the Lifecycle heading");
    await page.keyboard.press("End");
    await focused("Delete environment…");

    const danger = page.getByRole("menuitem", { name: "Delete environment…" });
    const surface = await menu.evaluate(el => getComputedStyle(el).backgroundColor);
    const [ink, focusBg] = await danger.evaluate(el => [getComputedStyle(el).color, getComputedStyle(el).backgroundColor]);
    const plain = await page.getByRole("menuitem", { name: "Suspend" }).evaluate(el => getComputedStyle(el).color);
    assert.notEqual(ink, plain, "the destructive action has its own tone");
    assert.ok(contrast(ink, focusBg) >= 4.5, `focused danger item contrast ${contrast(ink, focusBg).toFixed(2)}`);
    assert.ok(contrast(ink, surface) >= 4.5, `danger item contrast ${contrast(ink, surface).toFixed(2)}`);
    await page.keyboard.press("Escape");
    await page.waitForFunction(() => document.activeElement?.textContent.trim() === "Environment actions");
  }
});
