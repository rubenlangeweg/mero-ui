import assert from "node:assert/strict";
import test from "node:test";
import { browserConfig } from "../scripts/browser-config.mjs";
import { createApp } from "../server.mjs";

const playwright = await import(browserConfig.playwrightModule || "playwright").catch(error => {
  if (error.code === "ERR_MODULE_NOT_FOUND" && !browserConfig.playwrightModule) return null;
  throw error;
});

async function guideServer(t) {
  const server = createApp();
  await new Promise((resolve, reject) => server.once("error", reject).listen(0, "127.0.0.1", resolve));
  t.after(() => new Promise(resolve => server.close(resolve)));
  return `http://127.0.0.1:${server.address().port}/docs/responsive-layouts`;
}

test("company selection returns only the panes while direct and history visits return the guide", async t => {
  const url = await guideServer(t) + "?company=arc&width=360";
  const headers = { "HX-Request": "true", "HX-Target": "guide-panes" };
  const response = await fetch(url, { headers });
  assert.equal(response.status, 200);
  const vary = response.headers.get("vary").toLowerCase().split(",").map(token => token.trim());
  for (const token of ["hx-request", "hx-target", "hx-history-restore-request"]) assert.ok(vary.includes(token));
  const fragment = await response.text();
  assert.match(fragment, /^<div class="sc-panes" id="guide-panes" data-open-record/);
  assert.match(fragment, /id="guide-record-title" tabindex="-1">Arc &amp; Field</);
  assert.doesNotMatch(fragment, /<!doctype|catalog-sidebar|docs-code|<footer/i);
  for (const requestHeaders of [{}, { ...headers, "HX-History-Restore-Request": "true" }]) {
    const full = await fetch(url, { headers: requestHeaders });
    assert.equal(full.status, 200);
    const html = await full.text();
    assert.match(html, /^<!doctype html>/i);
    assert.match(html, /id="guide-preview" data-guide-width="360"/);
    assert.ok(html.includes(fragment));
  }
});

test("resize the directory, select with the keyboard and restore its previous record", { skip: !playwright && "Install Playwright" }, async t => {
  const base = await guideServer(t);
  const engine = browserConfig.engine || "chromium";
  const browser = await playwright[engine].launch({ executablePath: engine === "chromium" ? browserConfig.chromeExecutable : undefined });
  t.after(() => browser.close());
  const page = await browser.newPage({ viewport: { width: 1280, height: 840 } });
  page.setDefaultTimeout(6000);
  await page.goto(base);
  const bench = page.locator("#guide-preview");
  const company = bench.getByRole("heading", { name: "Forma Works" });
  const directory = bench.getByRole("navigation", { name: "Company directory" });
  const range = bench.getByRole("slider", { name: "Preview width" });
  assert.ok(await company.isVisible() && await directory.isVisible());
  await bench.getByRole("link", { name: "Narrow" }).click();
  assert.equal(await range.inputValue(), "360");
  assert.ok(!(await company.isVisible()));
  await range.focus();
  await page.keyboard.press("ArrowRight");
  assert.equal(await bench.locator("output").innerText(), "361 px");
  const row = directory.getByRole("link", { name: /Arc & Field/ });
  await row.focus();
  await page.keyboard.press("Enter");
  await page.waitForURL(/company=arc/);
  const heading = bench.getByRole("heading", { name: "Arc & Field" });
  await heading.waitFor();
  await page.waitForFunction(() => document.activeElement?.id === "guide-record-title");
  assert.ok(!(await directory.isVisible()));
  assert.equal(new URL(page.url()).searchParams.get("width"), "361");
  await bench.getByRole("link", { name: "Full width" }).click();
  assert.ok(await directory.isVisible() && await heading.isVisible());
  await directory.getByRole("link", { name: /Stillwater/ }).click();
  await page.waitForURL(/company=stillwater/);
  await page.waitForFunction(() => document.activeElement?.id === "guide-record-title");
  await page.goBack();
  await heading.waitFor();
  assert.ok(await directory.isVisible());
  assert.equal(new URL(page.url()).searchParams.has("width"), false);
  await page.waitForFunction(() => document.activeElement?.id === "guide-row-stillwater");
  await page.reload();
  await heading.waitFor();
  assert.ok(await directory.isVisible());
  await bench.getByRole("link", { name: "Narrow" }).click();
  await bench.getByRole("link", { name: "Company directory" }).click();
  await row.waitFor();
  await page.waitForFunction(() => document.activeElement?.id === "guide-row-arc");
  assert.ok(!(await heading.isVisible()));
  await page.goBack();
  await heading.waitFor();
  assert.equal(await range.inputValue(), "360");
  assert.ok(!(await directory.isVisible()));
  await page.waitForFunction(() => document.activeElement?.id === "guide-back");
  assert.ok(await heading.evaluate(el => el.getBoundingClientRect().top >= 0 && el.getBoundingClientRect().bottom <= innerHeight));
  await page.reload();
  await heading.waitFor();
  assert.equal(await range.inputValue(), "360");

  const native = await browser.newPage({ viewport: { width: 320, height: 680 }, javaScriptEnabled: false });
  await native.goto(base);
  const compact = native.locator("#guide-preview");
  await compact.getByRole("link", { name: /Arc & Field/ }).click();
  await compact.getByRole("heading", { name: "Arc & Field" }).waitFor();
  await compact.getByRole("link", { name: "Company directory" }).click();
  await compact.getByRole("navigation", { name: "Company directory" }).waitFor();
  assert.ok(await native.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
});
