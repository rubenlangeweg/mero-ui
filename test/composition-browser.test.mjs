import { browserConfig } from "../scripts/browser-config.mjs";
import assert from "node:assert/strict";
import test from "node:test";
import { readFile } from "node:fs/promises";
import { groups } from "../site/composition-components.mjs";

const playwright = await import(browserConfig.playwrightModule || "playwright").catch(error => {
  if (error.code === "ERR_MODULE_NOT_FOUND" && !browserConfig.playwrightModule) return null;
  throw error;
});

test("copied compositions align in both writing directions and retain their keyboard actions", {
  skip: !playwright && "Install Playwright for browser regressions",
}, async t => {
  const engine = browserConfig.engine || "chromium";
  const browser = await playwright[engine].launch({
    executablePath: engine === "chromium" ? browserConfig.chromeExecutable : undefined,
  });
  t.after(() => browser.close());
  const page = await browser.newPage({ viewport: { width: 360, height: 800 }, reducedMotion: "reduce" });
  page.setDefaultTimeout(6000);
  const examples = groups.flatMap(group => group.items);
  const origin = "http://composition.test";
  const assets = new Map([
    ["mero.css", "text/css"], ["mero-composition.css", "text/css"],
    ["mero-composition.js", "text/javascript"], ["studio-lamp.webp", "image/webp"],
  ]);
  // No site stylesheet, global box sizing, or body typography.
  await page.route(origin + "/**", async route => {
    const path = new URL(route.request().url()).pathname;
    if (path === "/") return route.fulfill({
      contentType: "text/html",
      body: `<!doctype html><html lang="en"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
        <link rel="stylesheet" href="/mero.css"><link rel="stylesheet" href="/mero-composition.css">
        <script defer src="/mero-composition.js"></script><main>${examples.map(item => `<section id="${item.id}">${item.code}</section>`).join("")}</main></html>`,
    });
    if (assets.has(path.slice(1))) return route.fulfill({
      contentType: assets.get(path.slice(1)), body: await readFile(new URL("../public" + path, import.meta.url)),
    });
    return route.fulfill({ contentType: "text/html", body: "<main>Destination</main>" });
  });
  await page.goto(origin);
  const join = page.locator("#join");
  const indicator = page.getByRole("link", { name: "Inventory, 3 updates" });
  for (const dir of ["ltr", "rtl"]) {
    await page.locator("html").evaluate((node, dir) => node.dir = dir, dir);
    const rounded = await join.evaluate(section => {
      const field = section.querySelector("input"), button = section.querySelector("button");
      const a = field.getBoundingClientRect(), b = button.getBoundingClientRect();
      return {
        aligned: Math.abs(a.top - b.top) <= 0.5 && Math.abs(a.bottom - b.bottom) <= 0.5,
        seam: getComputedStyle(field).direction === "rtl" ? a.left - b.right : b.left - a.right,
        fieldInnerRadius: getComputedStyle(field).borderStartEndRadius,
        buttonInnerRadius: getComputedStyle(button).borderEndStartRadius,
      };
    });
    assert.ok(rounded.aligned, dir);
    assert.ok(Math.abs(rounded.seam) < 1, dir);
    assert.equal(rounded.fieldInnerRadius, "0px");
    assert.equal(rounded.buttonInnerRadius, "0px");
    const badge = await indicator.evaluate(el => {
      const root = el.getBoundingClientRect(), badge = el.lastElementChild.getBoundingClientRect();
      return {
        top: badge.top < root.top && badge.bottom > root.top,
        end: getComputedStyle(el).direction === "rtl" ? badge.left < root.left : badge.right > root.right,
        round: Math.abs(badge.width - badge.height) < 1,
      };
    });
    assert.deepEqual(badge, { top: true, end: true, round: true });
  }
  await page.locator("html").evaluate(el => el.dir = "ltr");

  const swap = page.locator(".mero-swap");
  const initial = await swap.boundingBox();
  await swap.getByRole("checkbox").focus();
  await page.keyboard.press("Space");
  assert.ok(await swap.getByRole("checkbox").isChecked());
  assert.ok(await swap.getByText("★ Pinned").isVisible());
  assert.equal((await swap.boundingBox()).width, initial.width);
  await page.keyboard.press("Space");
  assert.ok(await swap.getByText("☆ Pin").isVisible());

  const select = page.getByLabel("Appearance");
  await select.selectOption("dark");
  assert.equal(await page.locator("[data-mero-theme-scope]").getAttribute("data-theme"), "dark");
  const sku = page.getByRole("textbox", { name: "Catalog SKU" });
  await sku.fill("invalid");
  await sku.press("Enter");
  assert.equal(await sku.evaluate(el => el.validity.patternMismatch), true);
  await sku.fill("RL-1234");
  await sku.press("Enter");
  assert.equal(await page.getByRole("status").textContent(), "SKU format accepted.");
  await sku.fill("RL-1235");
  assert.equal(await page.getByRole("status").textContent(), "");

  const next = page.getByRole("button", { name: "Next finish" });
  await next.focus();
  await page.keyboard.press("Enter");
  assert.equal(await page.locator("[data-cycle-item]:visible").textContent(), "Warm sand");
  const auto = page.getByRole("button", { name: "Auto rotate" });
  await auto.click();
  assert.equal(await auto.getAttribute("aria-pressed"), "true");
  await next.click();
  assert.equal(await auto.getAttribute("aria-pressed"), "false");
  assert.match(await page.locator("time").textContent(), /^\d{2}:\d{2}:\d{2}$/);

  for (const figure of ["hero", "mask", "stack", "phone-mockup", "browser-mockup"]) {
    const img = page.locator("#" + figure + " img");
    await img.scrollIntoViewIfNeeded();
    assert.ok(await img.evaluate(async el => {
      await el.decode();
      return el.naturalWidth === Number(el.getAttribute("width")) && el.naturalHeight === Number(el.getAttribute("height"));
    }), figure);
  }
  const paths = await page.locator("a").evaluateAll(links => links.map(a => a.getAttribute("href")));
  assert.deepEqual(paths, ["/layouts/dashboard", "/layouts/dashboard?view=inventory", "/layouts/dashboard?view=settings", "/components/carousel",
    "/components", "/layouts", "/start", "/components/carousel", "/layouts/dashboard?view=inventory"]);
  await join.getByRole("searchbox").fill("carousel");
  await Promise.all([page.waitForURL("**/components?q=carousel"), join.getByRole("searchbox").press("Enter")]);
});
