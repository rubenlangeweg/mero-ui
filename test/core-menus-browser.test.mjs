import { browserConfig } from "../scripts/browser-config.mjs";
import test from "node:test";
import assert from "node:assert/strict";
import { createApp } from "../server.mjs";
import { groups } from "../site/core-components.mjs";

const playwright = await import(browserConfig.playwrightModule || "playwright").catch(error => {
  if (error.code === "ERR_MODULE_NOT_FOUND" && !browserConfig.playwrightModule) return null;
  throw error;
});

test("menu button markup works without scripts and names each row's button", () => {
  const html = groups.flatMap(({ items }) => items).find(({ id }) => id === "menu-button").code;
  assert.equal(html.match(/aria-haspopup="menu"/g).length, 2);
  assert.match(html, /popovertarget="row-1-actions"[^>]*aria-label="Actions for Arc Task Lamp">Actions</);
  assert.match(html, /id="row-2-actions" popover role="menu"/);
  assert.match(html, /<a class="mero-menu-item" role="menuitem" href="[^"]+">Open details/);
  assert.ok(html.indexOf('popovertarget="row-1-actions"') < html.indexOf('id="row-1-actions"'));
});

test("menu button follows the APG keyboard pattern across instances and swaps",
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
    const errors = [];
    page.on("pageerror", error => errors.push(error.message));
    await page.goto(base + "/preview/menu-button");

    const first = page.getByRole("button", { name: "Actions for Arc Task Lamp" });
    const menu = page.locator("#row-1-actions");
    const focusedText = () => page.evaluate(() => document.activeElement.textContent.trim());
    const isOpen = () => menu.evaluate(node => node.matches(":popover-open"));

    await first.focus();
    await page.keyboard.press("ArrowDown");
    await page.waitForFunction(() => document.activeElement?.textContent.trim() === "Open details");
    assert.equal(await first.getAttribute("aria-expanded"), "true");
    await page.keyboard.press("End");
    assert.equal(await focusedText(), "Delete", "the disabled item stays focusable");
    await page.keyboard.press("Enter");
    assert.equal(await isOpen(), true, "the disabled item does not activate");
    await page.keyboard.press("Home");
    assert.equal(await focusedText(), "Open details");
    await page.keyboard.press("ArrowUp");
    assert.equal(await focusedText(), "Delete");
    await page.keyboard.press("ArrowUp");
    assert.equal(await focusedText(), "Archive");
    await page.keyboard.press("ArrowDown");
    await page.keyboard.press("ArrowDown");
    assert.equal(await focusedText(), "Open details", "Down from Delete wraps");
    await page.keyboard.press("d");
    assert.equal(await focusedText(), "Duplicate");

    await page.keyboard.press("Escape");
    await page.waitForFunction(() => document.activeElement?.getAttribute("aria-label") === "Actions for Arc Task Lamp");
    assert.equal(await isOpen(), false);
    // The toggle event that syncs aria-expanded is dispatched a task after the popover hides.
    await page.waitForFunction(() => document.querySelector('[popovertarget="row-1-actions"]').ariaExpanded === "false");

    await page.keyboard.press("ArrowUp");
    await page.waitForFunction(() => document.activeElement?.textContent.trim() === "Delete");
    await page.keyboard.press("Escape");
    await page.waitForFunction(() => document.activeElement?.getAttribute("aria-haspopup") === "menu");
    await page.keyboard.press("Enter");
    await page.waitForFunction(() => document.activeElement?.textContent.trim() === "Open details");

    await page.keyboard.press("Tab");
    assert.equal(await isOpen(), false);
    await page.waitForFunction(() => document.querySelector('[popovertarget="row-1-actions"]').ariaExpanded === "false");
    assert.equal(await page.evaluate(() => {
      const active = document.activeElement;
      return active.closest("#row-1-actions") !== null || active.getAttribute("aria-label") === "Actions for Arc Task Lamp";
    }), false);

    await first.click();
    await page.waitForFunction(() => document.activeElement?.textContent.trim() === "Open details");
    await menu.getByRole("menuitem", { name: "Duplicate" }).click();
    await page.getByText("Arc Task Lamp duplicated").waitFor();
    assert.equal(await isOpen(), false);
    await page.waitForFunction(() => document.activeElement?.getAttribute("aria-label") === "Actions for Arc Task Lamp");

    const second = page.getByRole("button", { name: "Actions for Halo Pendant" });
    await second.focus();
    await page.keyboard.press("ArrowDown");
    await page.waitForFunction(() => document.activeElement?.closest("#row-2-actions"));
    assert.equal(await second.getAttribute("aria-expanded"), "true");
    assert.equal(await first.getAttribute("aria-expanded"), "false");
    await page.keyboard.press("Escape");

    const cloneButton = await page.evaluate(() => {
      const scope = document.querySelector("[data-mero-scope]");
      const clone = scope.cloneNode(true);
      scope.after(clone);
      window.htmx?.process(clone);
      window.MeroUI.init(clone);
      const button = clone.querySelector("[aria-haspopup=menu]");
      button.id = "cloned-menu-button";
      return button.getAttribute("popovertarget");
    });
    assert.notEqual(cloneButton, "row-1-actions");
    await page.locator("#cloned-menu-button").focus();
    await page.keyboard.press("ArrowDown");
    await page.waitForFunction(id => document.activeElement?.closest("#" + id), cloneButton);
    assert.equal(await page.locator("#cloned-menu-button").getAttribute("aria-expanded"), "true");
    assert.equal(await isOpen(), false);
    await page.keyboard.press("Escape");
    await page.waitForFunction(() => document.activeElement?.id === "cloned-menu-button");

    assert.deepEqual(errors, []);
  });
