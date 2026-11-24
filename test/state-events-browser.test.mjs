import { browserConfig } from "../scripts/browser-config.mjs";
import test from "node:test";
import assert from "node:assert/strict";
import { createApp } from "../server.mjs";

const playwright = await import(browserConfig.playwrightModule || "playwright").catch(error => {
  if (error.code === "ERR_MODULE_NOT_FOUND" && !browserConfig.playwrightModule) return null;
  throw error;
});

test("mero:tab and mero:toggle fire once per change by a person, after the state is written, and never from init",
  { skip: !playwright && "Install Playwright to run the browser regression" }, async t => {
    const server = createApp();
    await new Promise(resolve => server.listen(0, "127.0.0.1", resolve));
    t.after(() => new Promise(resolve => { server.close(resolve); server.closeAllConnections(); }));
    const base = "http://127.0.0.1:" + server.address().port;
    const engine = browserConfig.engine || "chromium";
    const browser = await playwright[engine].launch({ executablePath: engine === "chromium" ? browserConfig.chromeExecutable : undefined });
    t.after(() => browser.close());
    const page = await browser.newPage();
    page.setDefaultTimeout(5000);
    // Listen on document before any page script runs, and record what a listener can read at that moment.
    await page.addInitScript(() => {
      window.heard = [];
      for (const type of ["mero:tab", "mero:toggle"]) {
        document.addEventListener(type, event => window.heard.push({
          type,
          target: event.target.id || event.target.textContent.trim(),
          selected: event.target.getAttribute("aria-selected"),
          pressedAttribute: event.target.getAttribute("aria-pressed"),
          pressed: event.detail.pressed,
          tabIsTarget: event.detail.tab === event.target,
          panel: event.detail.panel?.id,
          panelHidden: event.detail.panel?.hidden,
        }));
      }
    });
    const heard = async () => JSON.parse(JSON.stringify(await page.evaluate(() => window.heard.splice(0))));

    await page.goto(base + "/preview/tabs");
    await page.locator("[data-mero-tabs-ready]").first().waitFor();
    assert.deepEqual(await heard(), [], "nothing fires while the script loads");
    // The preview ships a selected tab, so init would have nothing to change. Clear it so init has to select one.
    await page.evaluate(() => {
      for (const tab of document.querySelectorAll("[data-mero-tabs] [role=tab]")) tab.removeAttribute("aria-selected");
      window.MeroUI.init();
    });
    assert.deepEqual(await heard(), [], "nothing fires when MeroUI.init() selects a tab");

    const tabs = page.locator("[data-mero-tabs]").first().getByRole("tab");
    const [first, second] = await tabs.evaluateAll(nodes => nodes.map(node => ({ id: node.id, panel: node.getAttribute("aria-controls") })));
    const tabEvent = tab => ({ type: "mero:tab", target: tab.id, selected: "true", pressedAttribute: null, tabIsTarget: true, panel: tab.panel, panelHidden: false });

    await tabs.nth(0).click();
    assert.deepEqual(await heard(), [], "clicking the selected tab changes nothing");
    await tabs.nth(1).click();
    assert.deepEqual(await heard(), [tabEvent(second)], "one event per click, after the tab and panel are updated");
    await page.keyboard.press("ArrowLeft");
    assert.deepEqual(await heard(), [tabEvent(first)], "one event per arrow key");
    assert.equal(await tabs.nth(0).evaluate(node => node === document.activeElement), true);

    await page.goto(base + "/preview/toggle-button");
    const toggle = page.locator("[data-mero-toggle]").first();
    await toggle.waitFor();
    const label = (await toggle.textContent()).trim();
    await toggle.click();
    assert.deepEqual(await heard(), [{ type: "mero:toggle", target: label, selected: null, pressedAttribute: "true", pressed: true, tabIsTarget: false }]);
    await toggle.click();
    assert.deepEqual(await heard(), [{ type: "mero:toggle", target: label, selected: null, pressedAttribute: "false", pressed: false, tabIsTarget: false }]);
  });
