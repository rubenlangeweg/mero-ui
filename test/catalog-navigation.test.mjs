import { browserConfig } from "../scripts/browser-config.mjs";
import assert from "node:assert/strict";
import test from "node:test";
import { createApp } from "../server.mjs";

const playwright = await import(browserConfig.playwrightModule || "playwright").catch(error => {
  if (error.code === "ERR_MODULE_NOT_FOUND" && !browserConfig.playwrightModule) return null;
  throw error;
});
const options = { skip: !playwright && "Install Playwright for catalog navigation checks" };

async function visit(t, width, pathname = "/components", contextOptions = {}) {
  const app = createApp();
  await new Promise((resolve, reject) => app.once("error", reject).listen(0, "127.0.0.1", resolve));
  t.after(() => new Promise(resolve => app.close(resolve)));
  const engine = browserConfig.engine || "chromium";
  const browser = await playwright[engine].launch({ executablePath: engine === "chromium" ? browserConfig.chromeExecutable : undefined });
  t.after(() => browser.close());
  const page = await browser.newPage({ viewport: { width, height: 760 }, reducedMotion: "reduce", ...contextOptions });
  page.setDefaultTimeout(6000);
  await page.goto("http://127.0.0.1:" + app.address().port + pathname);
  return page;
}

test("component visits keep the sidebar in place and restore the index, filters and focus on Back", options, async t => {
  const page = await visit(t, 1280);
  const canonicalPath = () => page.locator('head link[rel="canonical"]').evaluate(link => new URL(link.href).pathname);
  const description = page.locator('head meta[name="description"]');
  const indexDescription = await description.getAttribute("content");
  const nav = page.getByRole("navigation", {name: "Component catalog"});
  const tooltip = nav.getByRole("link", {name:"Tooltip", exact:true});
  await tooltip.evaluate(link => link.scrollIntoView({ block: "center" }));
  const oldTop = await nav.evaluate(el => { window.originalSidebar = el; return el.scrollTop; });
  const fragment = page.waitForResponse(response => response.url().endsWith("/components/tooltip"));
  await tooltip.click();
  await page.getByRole("heading", { name:"Tooltip", exact:true, level:1 }).waitFor();
  assert.equal((await fragment).request().headers()["hx-target"], "catalog-content");
  assert.ok(!((await (await fragment).text()).includes("catalog-sidebar")));
  assert.equal(await nav.evaluate(el => el === window.originalSidebar), true);
  assert.equal(await nav.evaluate(el => el.scrollTop), oldTop);
  assert.equal(await page.title(), "Tooltip · Mero UI");
  assert.equal(await canonicalPath(), "/components/tooltip");
  assert.notEqual(await description.getAttribute("content"), indexDescription);
  const schema = JSON.parse(await page.locator('head script[type="application/ld+json"]').textContent());
  assert.ok(schema["@graph"].some(entry => entry.url?.endsWith("/components/tooltip")));
  assert.equal(await tooltip.getAttribute("aria-current"), "page");
  assert.equal(await page.evaluate(() => document.activeElement.tagName), "H1");

  await nav.getByRole("link", {name:"All components",exact:true}).click();
  const family = page.getByLabel("Browse by family");
  await family.selectOption({ label:"Studio collections" });
  const search = page.getByRole("searchbox", {name:"Filter components"});
  await search.fill("data");
  const card = page.locator('.catalog-card[href="/components/data-grid"]');
  await card.evaluate(el => el.scrollIntoView({block:"start"}));
  const indexY = await page.evaluate(() => scrollY);
  await card.press("Enter");
  await page.getByRole("heading", {name:"Data Grid",exact:true,level:1}).waitFor();
  assert.equal(await search.inputValue(), "data");
  assert.equal(await nav.locator('[aria-current="page"]').innerText(), "Data Grid");
  await page.getByRole("navigation", {name:"Example variants"}).getByRole("link", {name:"Drafts only",exact:true}).click();
  await page.waitForFunction(() => location.search.includes("variant="));
  const variantTitle = await page.locator('.doc-variants [aria-current="page"]').innerText();
  await page.goBack();
  await page.waitForFunction(() => document.querySelector('.doc-variants [aria-current="page"]')?.textContent === "Default");
  await page.goBack();
  await family.waitFor();
  assert.equal(await canonicalPath(), "/components");
  assert.equal(await description.getAttribute("content"), indexDescription);
  assert.equal(await family.inputValue(), "group-studio-collections");
  assert.equal(await search.inputValue(), "data");
  assert.equal(await card.evaluate(el => document.activeElement === el), true);
  assert.ok(Math.abs(await page.evaluate(() => scrollY) - indexY) <= 2);
  await page.goForward();
  await page.getByRole("heading", {name:"Data Grid",exact:true,level:1}).waitFor();
  await page.goForward();
  await page.waitForFunction(expected => document.querySelector('.doc-variants [aria-current="page"]')?.textContent === expected, variantTitle);
  assert.equal(await nav.evaluate(el => el === window.originalSidebar), true);
});

test("changing a variant from its template retains the reading view and updates the page assets", options, async t => {
  const page = await visit(t, 390, "/components/autocomplete");
  const install = page.locator(".component-install");
  await install.locator("summary").click();
  const head = install.locator("pre code");
  assert.match(await head.textContent(), /src="\/vendor\/htmx.min.js"/);
  await page.getByRole("tab", { name: "Preview", exact: true }).focus();
  await page.keyboard.press("ArrowRight");
  const choose = page.getByRole("link", { name: "Local shortlist" });
  await choose.focus();
  await page.keyboard.press("Enter");
  const source = page.getByRole("tabpanel", { name: "Template" });
  await page.waitForURL(/variant=Local/);
  await source.waitFor();
  assert.match(await source.locator("code").textContent(), /Pinned workspace/);
  assert.equal(await choose.evaluate(link => link === document.activeElement), true);
  assert.equal(await page.getByRole("tab", { name: "HTTP exchange" }).count(), 0);
  assert.match(await page.locator(".docs-heading p").textContent(), /already on the page/);
  assert.doesNotMatch(await page.locator(".doc-notes").textContent(), /server-rendered/);
  assert.doesNotMatch(await head.textContent(), /htmx/);
  await page.goBack();
  await page.getByRole("tab", { name: "HTTP exchange" }).waitFor();
  await source.waitFor();
  assert.match(await source.locator("code").textContent(), /hx-get/);
});

test("component templates and installation tags are readable on a phone with scripts disabled", options, async t => {
  const page = await visit(t, 320, "/components/cell-switch", { javaScriptEnabled: false });
  const jump = page.getByRole("link", { name: "View template" });
  await jump.focus();
  await page.keyboard.press("Enter");
  await page.waitForURL(/#docs-cell-switch-source$/);
  const source = page.getByRole("tabpanel", { name: "Template" });
  assert.ok(await source.isVisible());
  assert.match(await source.locator("pre code").textContent(), /hx-post/);
  assert.ok(await source.locator("pre").evaluate(pre => pre.scrollWidth <= pre.clientWidth + 1));
  const install = page.locator(".component-install");
  await install.locator("summary").click();
  assert.match(await install.locator("pre code").textContent(), /src="\/mero-workspace.js"/);
  assert.equal(await page.getByRole("button", { name: "Copy code" }).count(), 0);
  assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1));
});

test("a layout keeps its template available after a native form validation response", options, async t => {
  const page = await visit(t, 360, "/layouts/chat", { javaScriptEnabled: false });
  const composer = page.getByRole("textbox", { name: /message/i });
  await composer.fill("   ");
  const invalid = page.waitForResponse(response => response.request().method() === "POST" && response.status() === 422);
  await page.getByRole("button", { name: /send/i }).click();
  await invalid;
  const jump = page.getByRole("link", { name: "View template" });
  await jump.focus();
  await page.keyboard.press("Enter");
  await page.waitForURL(/#docs-chat-source$/);
  const code = page.getByRole("tabpanel", { name: "Template" }).locator("pre code");
  assert.ok(await code.isVisible());
  assert.match(await code.textContent(), /aria-invalid="true"/);
  assert.equal(await page.getByRole("tab", { name: "HTTP exchange" }).count(), 0);
});

test("Back restores a deep index card and a component’s open reading view", options, async t => {
  const page = await visit(t, 1200);
  const card = page.locator(".catalog-card").last();
  const name = await card.locator("strong").innerText();
  await card.evaluate(el => el.scrollIntoView({ block: "center" }));
  const indexY = await page.evaluate(() => scrollY);
  assert.ok(indexY > 1000);
  await card.click();
  await page.getByRole("heading", { level:1, name, exact:true }).waitFor();
  await page.getByLabel("Preview theme").selectOption("brand");
  await page.getByRole("tab", { name:"Template", exact:true }).click();
  await page.locator(".component-install summary").click();
  await page.goBack();
  await card.waitFor();
  assert.ok(Math.abs(await page.evaluate(() => scrollY) - indexY) <= 2);
  await page.goForward();
  await page.waitForFunction(() => document.querySelector('.doc-tab-list [aria-selected="true"]')?.textContent === "Template");
  assert.equal(await page.getByLabel("Preview theme").inputValue(), "brand");
  assert.equal(await page.locator(".component-install").evaluate(el => el.open), true);
});

test("mobile catalog navigation closes Browse, supports HTMX across families and recovers from a failed or superseded visit", options, async t => {
  const page = await visit(t,390,"/components/native-select");
  const menu = page.getByRole("checkbox", {name:"Browse components"});
  const nav = page.locator(".catalog-index");
  const search = page.getByRole("searchbox", {name:"Filter components"});
  await search.fill("cell switch");
  await nav.getByRole("link", {name:"Cell Switch",exact:true}).click();
  const toggle = page.getByRole("switch");
  await toggle.waitFor();
  assert.equal(await menu.isChecked(), false);
  assert.equal(await search.inputValue(), "cell switch");
  await toggle.focus();
  await toggle.press("Space");
  await page.getByText("Release notifications: off", {exact:true}).waitFor();
  await page.goBack();
  await page.getByRole("heading", {name:"Native Select",exact:true,level:1}).waitFor();
  assert.equal(await menu.isChecked(), true);
  assert.equal(await search.inputValue(), "cell switch");
  await page.getByRole("button", {name:"Clear filters"}).click();
  // Clearing re-lists every family; click Holo Card only once it is listed again.
  await nav.getByRole("link", {name:"Holo Card",exact:true}).waitFor();

  const release = Promise.withResolvers();
  await page.route("**/components/holo-card", async route => {
    await release.promise;
    await route.continue().catch(() => {});
  });
  const pending = page.waitForRequest("**/components/holo-card");
  await nav.getByRole("link", {name:"Holo Card",exact:true}).click();
  await pending;
  await nav.getByRole("link", {name:"Carousel",exact:true}).click();
  await page.getByRole("heading", {name:"Carousel",exact:true,level:1}).waitFor();
  release.resolve();
  await page.locator("mero-gallery").first().waitFor();
  assert.equal(await page.evaluate(() => !!customElements.get("mero-gallery")), true);
  await menu.check();
  await page.route("**/components/tooltip", route => route.abort());
  await nav.getByRole("link",{name:"Tooltip",exact:true}).click();
  await page.getByText(/couldn’t open that page/i).waitFor();
  assert.match(page.url(), /\/components\/carousel$/);
  await page.unroute("**/components/tooltip");
  await nav.getByRole("link",{name:"Tooltip",exact:true}).click();
  await page.getByRole("heading",{name:"Tooltip",exact:true,level:1}).waitFor();
});
