import { browserConfig } from "../scripts/browser-config.mjs";
import assert from "node:assert/strict";
import test from "node:test";
import { createApp } from "../server.mjs";

const playwright = await import(browserConfig.playwrightModule || "playwright").catch(error => {
  if (error.code === "ERR_MODULE_NOT_FOUND" && !browserConfig.playwrightModule) return null;
  throw error;
});

test("collection controls, media and app layouts retain their geometry across host widths and text directions", {
  skip: !playwright && "Install Playwright to run the browser regression",
}, async t => {
  const app = createApp();
  await new Promise(resolve => app.listen(0, "127.0.0.1", resolve));
  const base = "http://127.0.0.1:" + app.address().port;
  const engine = browserConfig.engine || "chromium";
  const browser = await playwright[engine].launch({
    executablePath: engine === "chromium" ? browserConfig.chromeExecutable : undefined,
  });
  t.after(async () => {
    await browser.close();
    await new Promise(resolve => app.close(resolve));
  });
  const page = await browser.newPage({ viewport: { width: 1366, height: 900 }, hasTouch: true, reducedMotion: "reduce" });
  await page.goto(base + "/layouts/dashboard");
  const shell = page.locator(".rl-app");
  assert.ok((await shell.boundingBox()).width > 900, "Desktop dashboard fills its host");
  const stats = page.locator(".rl-stat");
  assert.equal((await stats.nth(0).boundingBox()).y, (await stats.nth(2).boundingBox()).y);
  await shell.evaluate(el => { el.style.inlineSize = "400px"; });
  const main = await page.locator(".rl-app-main").boundingBox();
  const nav = await page.locator(".rl-app-nav").boundingBox();
  assert.ok(main.y >= nav.y + nav.height - 1, "A narrow host uses a top navigation even on a desktop viewport");
  for (const select of await page.locator(".lab-filter select").all()) {
    assert.equal(await select.evaluate(el => getComputedStyle(el).appearance), "none");
    assert.ok(await select.evaluate(el => parseFloat(getComputedStyle(el).paddingInlineEnd) >= 28));
  }

  await page.setViewportSize({ width: 360, height: 820 });
  await page.goto(base + "/preview/agenda");
  await page.waitForFunction(() => !document.querySelector(".htmx-request,.htmx-settling"));
  const previous = page.getByRole("button", { name: "Previous day" });
  const next = page.getByRole("button", { name: "Next day" });
  for (const button of [previous, next]) {
    const bounds = await button.boundingBox();
    assert.ok(Math.abs(bounds.width - bounds.height) < 1, "Arrow buttons are square");
    const targetSize = await page.evaluate(() => matchMedia("(pointer:coarse)").matches ? 44 : 32);
    assert.ok(bounds.width >= targetSize - .05, `Button width ${bounds.width}px, expected ${targetSize}px`);
  }
  const readDirection = async () => Promise.all([previous, next].map(b => b.locator("span").evaluate(el => getComputedStyle(el).transform)));
  const ltrArrows = await readDirection();
  assert.notEqual(ltrArrows[0], ltrArrows[1]);
  await page.locator("html").evaluate(el => { el.dir = "rtl"; });
  assert.deepEqual(await readDirection(), [...ltrArrows].reverse());

  await page.goto(base + "/components/hover-gallery");
  const choices = page.locator(".rl-gallery-choices label");
  const boxes = await Promise.all((await choices.all()).map(label => label.boundingBox()));
  assert.equal(boxes.length, 3);
  assert.ok(boxes.every(box => Math.abs(box.y - boxes[0].y) < 1 && Math.abs(box.width - boxes[0].width) <= 1));
  await choices.last().click();
  assert.equal(await page.locator("[data-rl-gallery-label]").textContent(), "Brushed base");

  await page.goto(base + "/preview/diff");
  const slider = page.getByRole("slider");
  await slider.focus();
  for (const key of ["Home", "End"]) {
    await slider.press(key);
    const frame = await page.locator(".rl-diff-stage").boundingBox();
    const handle = await page.locator(".rl-diff-line i").boundingBox();
    assert.ok(handle.x >= frame.x + 3 && handle.x + handle.width <= frame.x + frame.width - 3);
  }

  await page.goto(base + "/components/holo-card");
  await page.getByLabel("Preview theme").selectOption("light");
  const foil = page.locator(".rl-foil");
  assert.equal(await foil.evaluate(el => getComputedStyle(el).color), "rgb(248, 248, 244)");

  await page.goto(base + "/preview/data-grid");
  await page.waitForFunction(() => !document.querySelector(".htmx-request,.htmx-settling"));
  const filter = await page.locator(".rl-collection-filters").boundingBox();
  const table = await page.locator(".rl-collection-table").boundingBox();
  assert.ok(table.y - (filter.y + filter.height) >= 10);
  const hitArea = page.locator(".rl-collection-pick").nth(1);
  await hitArea.click({position:{x:3,y:3}});
  assert.ok(await hitArea.locator("input").isChecked(), "The whole inset around the checkbox selects the row");
});
