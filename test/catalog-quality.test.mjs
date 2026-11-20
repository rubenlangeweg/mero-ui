import { browserConfig } from "../scripts/browser-config.mjs";
import test from "node:test";
import assert from "node:assert/strict";
import { createApp } from "../server.mjs";

const playwright = await import(browserConfig.playwrightModule || "playwright").catch(error => {
  if (error.code === "ERR_MODULE_NOT_FOUND" && !browserConfig.playwrightModule) return null;
  throw error;
});
const options = { skip: !playwright && "Install Playwright for the catalog browser checks" };

test("catalog discovery, exported previews and the HTTP inspector", options, async t => {
  const server = createApp();
  await new Promise((resolve, reject) => server.once("error", reject).listen(0, "127.0.0.1", resolve));
  t.after(() => new Promise(resolve => server.close(resolve)));
  const base = "http://127.0.0.1:" + server.address().port;
  const browserName = browserConfig.engine || "chromium";
  const browser = await playwright[browserName].launch({
    executablePath: browserName === "chromium" ? browserConfig.chromeExecutable : undefined,
  });
  t.after(() => browser.close());
  const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
  page.setDefaultTimeout(5000);
  const exceptions = [];
  page.on("pageerror", error => exceptions.push(error.message));
  await page.goto(base + "/components");

  const search = page.getByRole("searchbox", { name: "Filter components" });
  const nav = page.getByRole("navigation", { name: "Component catalog", includeHidden: true });
  const browse = page.getByRole("checkbox", { name: "Browse components" });
  await search.fill("thumbnails");
  const cards = page.locator(".catalog-card:visible");
  assert.equal(await cards.count(), 1);
  assert.match(await cards.innerText(), /Carousel/);
  assert.equal(await nav.isHidden(), true);
  await browse.check();
  assert.equal(await nav.getByRole("link", { name: "Carousel" }).isVisible(), true);
  await browse.uncheck();
  assert.equal(await nav.isHidden(), true);
  await search.press("ArrowDown");
  assert.equal(await cards.evaluate(el => document.activeElement === el), true);

  await search.fill("");
  const family = page.getByLabel("Browse by family");
  await family.selectOption({ label: "Media galleries" });
  assert.equal(await page.locator(".catalog-category:visible").count(), 1);
  await search.fill("thumbnails");
  await page.reload();
  assert.equal(await cards.count(), 1);
  assert.match(await family.inputValue(), /media-galleries/);
  await search.press("Enter");
  await page.waitForURL("**/components/carousel");

  await search.fill("unfindable");
  assert.equal(await page.locator("[data-catalog-count]").innerText(), "0 matching components");
  await browse.uncheck();
  assert.equal(await nav.isHidden(), true);
  await search.press("Escape");
  assert.equal(await search.inputValue(), "");
  assert.equal(new URL(page.url()).searchParams.has("q"), false);

  await page.getByLabel("Preview theme").selectOption("brand");
  const link = page.getByLabel("Open standalone preview");
  const target = new URL(await link.getAttribute("href"), base);
  assert.equal(target.searchParams.get("theme"), "brand");
  const popup = await browser.newPage();
  await popup.goto(target.href);
  assert.equal(await popup.getByRole("heading", {level: 1}).innerText(), "Carousel");
  const color = element => getComputedStyle(element).getPropertyValue("--rl-primary").trim();
  assert.equal(await popup.locator("html").evaluate(color), await page.locator("[data-sample-scope]").evaluate(color));
  await popup.close();

  await page.getByRole("tab", { name: "Template" }).click();
  await page.evaluate(() => {
    Object.defineProperty(navigator, "clipboard", {
      configurable: true,
      value: { writeText: async value => { document.body.dataset.testClipboard = value; } },
    });
  });
  const template = page.getByRole("tabpanel", { name: "Template" });
  const copy = template.locator("[data-copy-code]");
  await copy.focus();
  await copy.press("Enter");
  await template.getByRole("button", { name: "Copied" }).waitFor();
  assert.equal(await copy.evaluate(el => document.activeElement === el), true);
  assert.equal(await page.locator("body").getAttribute("data-test-clipboard"), await template.locator("code").textContent());

  await page.goto(base + "/layouts/settings");
  await page.locator("input[name=name]").fill("Studio & Co");
  await page.getByRole("button", { name: "Save settings" }).click();
  await page.getByRole("tab", { name: "HTTP exchange" }).click();
  const exchange = page.locator("[data-exchange-body]");
  await page.locator("[data-exchange-status]").filter({ hasText: "HTTP 200" }).waitFor();
  const text = await exchange.textContent();
  assert.match(text, /^POST \/demo\//);
  assert.match(text, /Submitted fields\nname = Studio & Co/);
  assert.match(text, /HTTP 200\ncontent-type:/);

  // The inspector describes the most recently started interaction even if its predecessor finishes last.
  let release;
  const slowResponse = new Promise(resolve => { release = resolve; });
  await page.route("**/catalog-audit-slow", async route => {
    await slowResponse;
    await route.fulfill({ contentType: "text/html", body: "old response" });
  });
  await page.route("**/catalog-audit-fast", route => route.fulfill({ contentType: "text/html", body: "new response" }));
  await page.getByRole("tab", { name: "Preview", exact: true }).click();
  await page.evaluate(() => {
    const preview = document.querySelector("[data-sample-scope]");
    for (const speed of ["slow", "fast"]) {
      const button = document.createElement("button");
      button.textContent = speed;
      button.setAttribute("hx-get", "/catalog-audit-" + speed);
      button.setAttribute("hx-swap", "none");
      preview.append(button);
      window.htmx.process(button);
    }
  });
  const slow = page.waitForResponse("**/catalog-audit-slow");
  await page.getByRole("button", { name:"slow" }).click();
  await page.getByRole("button", { name:"fast" }).click();
  await page.waitForFunction(() => document.querySelector("[data-exchange-body]").textContent.endsWith("new response"));
  await page.evaluate(() => window.htmx.on("htmx:afterRequest", event => {
    if (event.detail.pathInfo.requestPath.includes("audit-slow")) document.body.dataset.slowDone = "yes";
  }));
  release();
  await slow;
  await page.waitForFunction(() => document.body.dataset.slowDone === "yes");
  assert.match(await exchange.textContent(), /new response$/);
  assert.deepEqual(exceptions, []);
});
