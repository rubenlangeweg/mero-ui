import { browserConfig } from "../scripts/browser-config.mjs";
import test from "node:test";
import assert from "node:assert/strict";
import { createApp } from "../server.mjs";
import { records } from "../site/core/data-display.mjs";

const playwright = await import(browserConfig.playwrightModule || "playwright").catch(error => {
  if (error.code === "ERR_MODULE_NOT_FOUND" && !browserConfig.playwrightModule) return null;
  throw error;
});

test("row peek markup carries each preview in its row and stays off by default", () => {
  const html = records(new URLSearchParams(), { peek: true });
  assert.equal(html.match(/<div data-mero-peek>/g).length, 1);
  assert.equal(html.match(/<template data-mero-peek-body>/g).length, 8);
  assert.match(html, /<a class="mero-row-link" href="[^"]+">Arc Task Lamp<\/a><template data-mero-peek-body><dl>\s*<dt>SKU<\/dt><dd>RL-1001<\/dd>/);
  assert.doesNotMatch(records(new URLSearchParams()), /data-mero-peek/);
});

test("row peek opens on Space, follows focus, closes back to the row and survives swaps",
  { skip: !playwright && "Install Playwright to run the browser regression" }, async t => {
    const server = createApp();
    await new Promise(resolve => server.listen(0, "127.0.0.1", resolve));
    t.after(() => new Promise(resolve => { server.close(resolve); server.closeAllConnections(); }));
    const base = "http://127.0.0.1:" + server.address().port;
    const engine = browserConfig.engine || "chromium";
    const browser = await playwright[engine].launch({ executablePath: engine === "chromium" ? browserConfig.chromeExecutable : undefined });
    t.after(() => browser.close());
    const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
    page.setDefaultTimeout(5000);
    const errors = [];
    page.on("pageerror", error => errors.push(error.message));
    await page.goto(base + "/preview/sortable-table?variant=Row%20peek");

    const panel = page.getByRole("complementary", { name: "Preview" });
    const title = () => page.locator(".mero-peek-title").textContent();
    const focused = () => page.evaluate(() => document.activeElement?.textContent.trim());
    const row = name => page.getByRole("link", { name, exact: true });
    const scrollY = () => page.evaluate(() => scrollY);

    await row("Arc Task Lamp").focus();
    const before = await scrollY();
    await page.keyboard.press("Space");
    await panel.waitFor();
    assert.equal(await scrollY(), before, "Space does not scroll the page");
    assert.equal(await title(), "Arc Task Lamp");
    assert.equal(await panel.getAttribute("aria-live"), "polite");
    assert.equal(await page.getByRole("heading", { name: "Arc Task Lamp" }).count(), 1);
    assert.match(await panel.textContent(), /RL-1001/);
    assert.equal(await panel.getByRole("link", { name: "Open" }).getAttribute("href"), await row("Arc Task Lamp").getAttribute("href"));
    assert.equal(await focused(), "Arc Task Lamp", "focus stays on the row");
    const box = await panel.boundingBox(), table = await page.locator(".mero-table").boundingBox();
    assert.ok(box.x >= table.x + table.width, "the preview sits beside the table");

    await page.keyboard.press("ArrowDown");
    await page.waitForFunction(() => document.querySelector(".mero-peek-title")?.textContent === "Ash Lounge Chair");
    assert.equal(await focused(), "Ash Lounge Chair");
    assert.match(await panel.textContent(), /RL-2002/);
    await page.keyboard.press("ArrowUp");
    await page.waitForFunction(() => document.querySelector(".mero-peek-title")?.textContent === "Arc Task Lamp");
    // Tab passes the row's Actions button, then reaches the next row.
    await page.keyboard.press("Tab");
    assert.equal(await title(), "Arc Task Lamp");
    await page.keyboard.press("Tab");
    assert.equal(await focused(), "Ash Lounge Chair");
    await page.waitForFunction(() => document.querySelector(".mero-peek-title")?.textContent === "Ash Lounge Chair");

    await page.keyboard.press("Escape");
    await panel.waitFor({ state: "detached" });
    assert.equal(await focused(), "Ash Lounge Chair");
    await page.keyboard.press("ArrowDown");
    assert.equal(await focused(), "Ash Lounge Chair", "arrow keys keep their native behaviour while no preview is open");

    await page.keyboard.press("Space");
    await panel.waitFor();
    await page.keyboard.press("Space");
    await panel.waitFor({ state: "detached" });
    assert.equal(await focused(), "Ash Lounge Chair");

    // Focus is not trapped: Shift+Tab leaves the panel and the Close button returns focus to the row.
    await page.keyboard.press("Space");
    await panel.getByRole("button", { name: "Close preview" }).focus();
    await page.keyboard.press("Shift+Tab");
    assert.equal(await panel.count(), 1);
    assert.equal(await page.evaluate(() => document.querySelector(".mero-peek").contains(document.activeElement)), false);
    await panel.getByRole("button", { name: "Close preview" }).click();
    await panel.waitFor({ state: "detached" });
    assert.equal(await focused(), "Ash Lounge Chair");

    // A boosted sort replaces the table; the preview stays on the same row.
    await row("Halo Pendant").focus();
    await page.keyboard.press("Space");
    await panel.waitFor();
    await page.getByRole("link", { name: "Product" }).click();
    await page.waitForURL(/sort=-name/);
    await page.waitForFunction(() => document.querySelector("th[aria-sort]")?.getAttribute("aria-sort") === "descending");
    await page.waitForFunction(() => document.querySelector(".mero-peek-title")?.textContent === "Halo Pendant");
    assert.equal(await page.locator(".mero-peek").count(), 1);
    assert.match(await panel.getByRole("link", { name: "Open" }).getAttribute("href"), /sort=-name/);

    // A morph swap of the same table keeps one panel, and Space still toggles once per press.
    await page.evaluate(() => htmx.ajax("GET", location.href, { target: "[data-mero-records]", select: "[data-mero-records]", swap: "outerMorph" }));
    await page.waitForFunction(() => document.querySelectorAll(".mero-peek").length === 1 && document.querySelector(".mero-peek-title")?.textContent === "Halo Pendant");
    await row("Halo Pendant").focus();
    await page.keyboard.press("Space");
    await panel.waitFor({ state: "detached" });
    await page.keyboard.press("Space");
    await panel.waitFor();
    assert.equal(await page.locator(".mero-peek").count(), 1);
    assert.deepEqual(errors, []);
  });

test("row peek is a bottom sheet over phone cards and drops its motion when reduced",
  { skip: !playwright && "Install Playwright to run the browser regression" }, async t => {
    const server = createApp();
    await new Promise(resolve => server.listen(0, "127.0.0.1", resolve));
    t.after(() => new Promise(resolve => { server.close(resolve); server.closeAllConnections(); }));
    const base = "http://127.0.0.1:" + server.address().port;
    const engine = browserConfig.engine || "chromium";
    const browser = await playwright[engine].launch({ executablePath: engine === "chromium" ? browserConfig.chromeExecutable : undefined });
    t.after(() => browser.close());
    const page = await browser.newPage({ viewport: { width: 390, height: 780 }, reducedMotion: "reduce" });
    page.setDefaultTimeout(5000);
    const errors = [];
    page.on("pageerror", error => errors.push(error.message));
    await page.goto(base + "/preview/sortable-table?variant=Row%20peek");

    await page.getByRole("link", { name: "Halo Pendant", exact: true }).focus();
    await page.keyboard.press("Space");
    const panel = page.getByRole("complementary", { name: "Preview" });
    await panel.waitFor();
    const style = await panel.evaluate(node => { const s = getComputedStyle(node); return { position: s.position, animation: s.animationName }; });
    assert.deepEqual(style, { position: "fixed", animation: "none" });
    const box = await panel.boundingBox();
    assert.ok(box.y + box.height <= 780 && box.y >= 780 / 2 - 1, "the sheet sits in the lower half of the viewport");
    assert.ok(box.x >= 0 && box.x + box.width <= 390);
    const card = await page.locator("tr", { has: page.getByRole("link", { name: "Halo Pendant", exact: true }) }).boundingBox();
    assert.ok(card.y >= 0 && card.y + card.height <= box.y, "the focused card stays visible above the sheet");
    await page.keyboard.press("Escape");
    await panel.waitFor({ state: "detached" });
    assert.equal(await page.evaluate(() => document.activeElement?.textContent.trim()), "Halo Pendant");

    const plain = await browser.newPage({ javaScriptEnabled: false });
    await plain.goto(base + "/preview/sortable-table?variant=Row%20peek");
    assert.equal(await plain.getByText("RL-1002").count(), 0, "templates stay hidden without scripts");
    await plain.close();
    assert.deepEqual(errors, []);
  });
