import assert from "node:assert/strict";
import test from "node:test";
import { browserConfig } from "../scripts/browser-config.mjs";
import { createApp } from "../server.mjs";

const playwright = await import(browserConfig.playwrightModule || "playwright").catch(error => {
  if (error.code === "ERR_MODULE_NOT_FOUND" && !browserConfig.playwrightModule) return null;
  throw error;
});

test("copied request buttons recover from failures and switches expose the saved policy", {
  skip: !playwright && "Install Playwright to test component states",
}, async t => {
  const app = createApp();
  await new Promise(resolve => app.listen(0, "127.0.0.1", resolve));
  t.after(() => new Promise(resolve => app.close(resolve)));
  const base = "http://127.0.0.1:" + app.address().port;
  const engine = browserConfig.engine || "chromium";
  const browser = await playwright[engine].launch({ executablePath: engine === "chromium" ? browserConfig.chromeExecutable : undefined });
  t.after(() => browser.close());
  const page = await browser.newPage({ viewport: { width: 360, height: 800 }, reducedMotion: "reduce" });
  page.setDefaultTimeout(6000);

  await page.goto(base + "/components/button?variant=Pending%20request");
  await page.getByRole("tab", { name: "Template" }).click();
  const template = await page.getByRole("tabpanel").locator("code").textContent();
  await page.getByText("Use in your app", { exact: true }).click();
  const assets = await page.locator(".component-install code").last().textContent();
  await page.route("**/copied-buttons", route => route.fulfill({
    contentType: "text/html",
    body: `<!doctype html><html lang="en"><head>${assets}</head><body>${template}${template}</body></html>`,
  }));
  await page.goto(base + "/copied-buttons");
  const forms = page.locator("form");
  const form = forms.nth(1);
  const button = form.getByRole("button", { name: "Check inventory" });
  const before = await button.boundingBox();
  let releaseFailure;
  const delayed = new Promise(resolve => { releaseFailure = resolve; });
  let requests = 0;
  await page.route("**/demo/stock-summary*", async route => {
    if (++requests > 1) return route.continue();
    await delayed;
    await route.fulfill({ status: 503, body: "" });
  });
  const starting = page.waitForRequest("**/demo/stock-summary*");
  await button.focus();
  await page.keyboard.press("Enter");
  await starting;
  try {
    assert.ok(await button.isDisabled());
    assert.equal(await form.getAttribute("aria-busy"), "true");
    assert.ok(await form.locator(".rl-indicator").isVisible());
    assert.deepEqual(await button.boundingBox(), before);
    assert.ok(await forms.first().getByRole("button").isEnabled());
    await page.keyboard.press("Enter");
    assert.equal(requests, 1);
  } finally {
    releaseFailure();
  }
  await form.getByRole("alert").waitFor();
  assert.ok(await button.isEnabled());
  assert.ok(await form.locator(".rl-indicator").isHidden());
  await button.click();
  await form.locator("output").getByText("6 products", { exact: true }).waitFor();
  assert.equal(await forms.first().locator("output").textContent(), "");
  assert.ok(await form.getByRole("alert", { includeHidden: true }).isHidden());

  await page.goto(base + "/preview/switch?variant=Managed%20preference");
  const policy = page.getByRole("switch", { name: "Sign-in alerts", exact: true });
  assert.ok(await policy.isChecked());
  assert.ok(await policy.isDisabled());
  assert.match(await policy.ariaSnapshot(), /Sign-in alerts/);
  assert.equal(await policy.evaluate(input => document.getElementById(input.getAttribute("aria-describedby")).textContent), "Required by your workspace administrator.");
  await page.goto(base + "/preview/switch?variant=Notification%20preference");
  const stock = page.getByRole("switch", { name: "Stock alerts", exact: true });
  await stock.focus();
  await page.keyboard.press("Space");
  assert.equal(await stock.isChecked(), false);
});
