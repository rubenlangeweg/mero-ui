import { browserConfig } from "../scripts/browser-config.mjs";
import test from "node:test";
import assert from "node:assert/strict";
import { createApp } from "../server.mjs";

const playwright = await import(browserConfig.playwrightModule || "playwright").catch(error => {
  if (error.code === "ERR_MODULE_NOT_FOUND" && !browserConfig.playwrightModule) return null;
  throw error;
});

test("action buttons report pending, succeeded, rejected and unknown outcomes",
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
    await page.goto(base + "/preview/action-button");
    await page.evaluate(() => {
      window.actionEvents = [];
      document.addEventListener("mero:action", event => window.actionEvents.push((event.target.textContent ?? "document").trim() + ":" + event.detail.state));
    });

    const retry = page.getByRole("button", { name: "Retry export" });
    const status = button => button.locator("xpath=following-sibling::*[@data-mero-action-status]");
    const state = button => button.getAttribute("data-mero-action-state");

    let hits = 0;
    let release;
    const held = new Promise(resolve => { release = resolve; });
    await page.route("**/demo/catalog/action-button?outcome=succeeded", async route => {
      hits += 1;
      await held;
      await route.continue();
    });
    const before = await retry.boundingBox();
    await retry.click();
    await page.waitForFunction(() => document.querySelector("[data-mero-action-state=pending]"));
    assert.equal(await retry.getAttribute("aria-busy"), "true");
    assert.equal(await retry.getAttribute("aria-disabled"), "true");
    assert.equal(await retry.evaluate(node => node === document.activeElement), true, "focus stays on the pending button");
    assert.deepEqual(await retry.boundingBox(), before, "the spinner overlay keeps the button size");
    // aria-disabled reads as disabled to Playwright, so force a real second click.
    await retry.click({ force: true });
    await page.waitForTimeout(100);
    release();
    await page.waitForFunction(() => document.querySelector("[data-mero-action-state=succeeded]"));
    await page.waitForTimeout(150);
    assert.equal(hits, 1, "a click while pending is dropped, not queued");
    assert.equal(await retry.getAttribute("aria-busy"), null);
    assert.equal(await retry.getAttribute("aria-disabled"), null);
    assert.equal(await status(retry).textContent(), "Export restarted.");
    assert.equal(await status(retry).getAttribute("data-tone"), "success");
    await page.unroute("**/demo/catalog/action-button?outcome=succeeded");

    const revoke = page.getByRole("button", { name: "Revoke key" });
    await revoke.click();
    await page.waitForFunction(() => document.querySelectorAll("[data-mero-action-state=rejected]").length === 1);
    assert.equal(await status(revoke).textContent(), "This key was already revoked. Nothing changed.");
    assert.equal(await status(revoke).getAttribute("data-tone"), "warning");
    assert.equal(await status(retry).textContent(), "Export restarted.", "each row keeps its own status");

    const halt = page.getByRole("button", { name: "Halt run" });
    await halt.click();
    await page.waitForFunction(() => document.querySelectorAll("[data-mero-action-state=unknown]").length === 1);
    assert.equal(await status(halt).textContent(), "The result is unknown. Check the current state before you try again.");
    assert.equal(await status(halt).getAttribute("data-tone"), "danger");

    await page.route("**/demo/catalog/action-button?outcome=succeeded", route => route.abort());
    await retry.click();
    await page.waitForFunction(() => document.querySelectorAll("[data-mero-action-state=unknown]").length === 2);
    assert.equal(await status(retry).getAttribute("data-tone"), "danger");

    assert.deepEqual(await page.evaluate(() => window.actionEvents), [
      "Retry export:pending", "Retry export:succeeded",
      "Revoke key:pending", "Revoke key:rejected",
      "Halt run:pending", "Halt run:unknown",
      "Retry export:pending", "Retry export:unknown",
    ]);

    // A cancelled request never goes out, so the button must not stay pending.
    await page.evaluate(() => document.querySelector("[hx-post*=rejected]")
      .addEventListener("htmx:before:request", event => event.preventDefault(), { once: true }));
    await revoke.click();
    await page.waitForTimeout(100);
    assert.equal(await state(revoke), "rejected");
    assert.equal(await revoke.getAttribute("aria-disabled"), null);

    // A success that swaps out the button's row still announces and reports.
    await page.route("**/demo/catalog/action-button?outcome=succeeded", route => route.fulfill({
      status: 200, headers: { "Content-Type": "text/html", "Mero-Action-Message": "Halted." },
      body: '<p id="swapped-row">Replaced</p>',
    }));
    await page.evaluate(() => {
      window.actionEvents = [];
      const button = document.querySelector("[hx-post*=succeeded]");
      button.setAttribute("hx-target", "closest .mero-row");
      button.setAttribute("hx-swap", "outerHTML");
      window.htmx.process(button);
    });
    await retry.click();
    await page.locator("#swapped-row").waitFor();
    await page.getByText("Halted.").waitFor();
    await page.waitForFunction(() => window.actionEvents.length === 2);
    assert.deepEqual(await page.evaluate(() => window.actionEvents.map(entry => entry.split(":").at(-1))), ["pending", "succeeded"]);
    assert.deepEqual(errors, []);
  });
