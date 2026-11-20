import { browserConfig } from "../scripts/browser-config.mjs";
import assert from "node:assert/strict";
import test from "node:test";
import { createApp } from "../server.mjs";

const playwright = await import(browserConfig.playwrightModule || "playwright").catch(error => {
  if (error.code === "ERR_MODULE_NOT_FOUND" && !browserConfig.playwrightModule) return null;
  throw error;
});

test("settings and inventory recover visibly from validation, offline requests and delayed searches", {
  skip: !playwright && "Install Playwright to run the workflow regression",
}, async t => {
  const app = createApp();
  await new Promise((resolve, reject) => app.once("error", reject).listen(0, "127.0.0.1", resolve));
  t.after(() => app.close());
  const base = "http://127.0.0.1:" + app.address().port;
  const engine = browserConfig.engine || "chromium";
  const browser = await playwright[engine].launch({ executablePath: engine === "chromium" ? browserConfig.chromeExecutable : undefined });
  t.after(() => browser.close());
  const page = await browser.newPage({ viewport: { width: 320, height: 820 }, reducedMotion: "reduce" });
  page.setDefaultTimeout(6000);
  await page.goto(base + "/layouts/settings");
  const instructions = page.locator("details.component-install");
  const assetTags = await instructions.locator("pre code").textContent();
  const template = await page.locator("#docs-settings-source pre code").textContent();
  const files = [...assetTags.matchAll(/(?:href|src)="([^"]+)"/g)].map(match => match[1]);
  assert.deepEqual(files, ["/mero.css", "/mero-layouts.css", "/vendor/htmx.min.js", "/mero.js", "/mero-forms.js"]);
  // Build a bare host page using only the two snippets visitors can copy.
  const hosted = await browser.newPage({ viewport: { width: 320, height: 820 } });
  hosted.setDefaultTimeout(6000);
  await hosted.route(base + "/clean-settings", route => route.fulfill({
    contentType: "text/html", body: `<!doctype html><html lang="en"><head>${assetTags}</head><body><main>${template}</main></body></html>`,
  }));
  await hosted.goto(base + "/clean-settings");
  const hostedField = hosted.getByRole("textbox", { name: "Workspace name" });
  const hostedSave = hosted.getByRole("button", { name: "Save settings" });
  await hostedField.fill("   ");
  await hostedSave.click();
  await hosted.getByText("Enter a workspace name up to 48 characters.", { exact: true }).waitFor();
  await hosted.waitForFunction(() => document.activeElement?.id === "workspace-name");
  await hostedField.fill("Independent host");
  await hostedSave.click();
  await hosted.getByText("Settings saved", { exact: true }).waitFor();
  assert.equal(await hostedField.getAttribute("aria-invalid"), null);
  assert.equal(await hostedSave.evaluate(button => button === document.activeElement), true);
  const name = page.getByRole("textbox", { name: "Workspace name" });
  const saveSettings = page.getByRole("button", { name: "Save settings" });
  await name.fill("   ");
  await saveSettings.click();
  await page.getByText("Enter a workspace name up to 48 characters.", { exact: true }).waitFor();
  await name.fill("   Sample studio  ");
  await saveSettings.click();
  await page.getByText("Settings saved", { exact: true }).waitFor();
  assert.equal(await name.inputValue(), "Sample studio");
  assert.equal(await name.getAttribute("aria-invalid"), null);
  assert.equal(await saveSettings.evaluate(button => document.activeElement === button), true);
  await page.reload();
  assert.equal(await name.inputValue(), "Sample studio");

  await page.goto(base + "/playground");
  assert.match(await page.locator("details.component-install pre code").textContent(), /mero-inventory\.js/);
  const edit = page.getByRole("button", { name: "Edit Arc Task Lamp" });
  assert.equal(await edit.evaluate(button => {
    const wrapper = button.closest(".lab-table-wrap");
    return wrapper.clientWidth >= wrapper.scrollWidth && button.getBoundingClientRect().right <= wrapper.getBoundingClientRect().right;
  }), true);
  await edit.click();
  const drawer = page.getByRole("dialog", { name: "Edit product" });
  const productName = drawer.getByRole("textbox", { name: "Product name" });
  await productName.fill("Offline draft");
  const saveProduct = drawer.getByRole("button", { name: "Save changes" });
  await page.route("**/demo/products/6", route => route.abort("failed"));
  await saveProduct.click();
  await drawer.getByRole("alert").filter({ hasText: /before retrying/ }).waitFor();
  assert.equal(await productName.inputValue(), "Offline draft");
  assert.equal(await saveProduct.isEnabled(), true);
  await page.unroute("**/demo/products/6");
  // htmx 4 swaps error responses by default. A server error page must not replace the form.
  await page.route("**/demo/products/6", route => route.fulfill({ status: 500, contentType: "text/html", body: "<p>Server exploded</p>" }));
  await saveProduct.click();
  await drawer.getByRole("alert").filter({ hasText: /could not be completed/ }).waitFor();
  assert.equal(await drawer.getByText("Server exploded").count(), 0);
  assert.equal(await productName.inputValue(), "Offline draft");
  await page.unroute("**/demo/products/6");
  await saveProduct.click();
  await drawer.waitFor({ state: "hidden" });
  await page.getByRole("button", { name: "Edit Offline draft" }).waitFor();

  let release;
  let arrived;
  const hold = new Promise(resolve => { release = resolve; });
  const stale = new Promise(resolve => { arrived = resolve; });
  await page.route("**/demo/products?**", async route => {
    if (new URL(route.request().url()).searchParams.get("q") !== "old") return route.continue();
    arrived();
    await hold;
    await route.fulfill({ headers: { "Inventory-Revision": "1", "Content-Type": "text/html" }, body: '<div id="obsolete-workflow-result">Old results</div>' });
  });
  await page.evaluate(() => {
    window.obsoleteSearchAppeared = false;
    document.addEventListener("htmx:afterSwap", () => {
      if (document.getElementById("obsolete-workflow-result")) window.obsoleteSearchAppeared = true;
    });
  });
  const search = page.getByRole("searchbox", { name: "Search products" });
  await search.fill("old");
  await stale;
  await search.fill("Offline");
  release();
  await page.getByRole("status").filter({ hasText: "1 of 6 products" }).waitFor();
  assert.equal(await page.evaluate(() => window.obsoleteSearchAppeared), false);
});
