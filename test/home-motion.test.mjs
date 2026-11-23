import assert from "node:assert/strict";
import test from "node:test";
import { browserConfig } from "../scripts/browser-config.mjs";
import { createApp } from "../server.mjs";

const playwright = await import(browserConfig.playwrightModule || "playwright").catch(error => {
  if (error.code === "ERR_MODULE_NOT_FOUND" && !browserConfig.playwrightModule) return null;
  throw error;
});
const options = { skip: !playwright && "Install Playwright for the homepage motion checks" };

async function start(t) {
  const app = createApp();
  let browser;
  t.after(async () => {
    try { await browser?.close(); }
    finally { if (app.listening) await new Promise(resolve => app.close(resolve)); }
  });
  await new Promise((resolve, reject) => app.once("error", reject).listen(0, "127.0.0.1", resolve));
  const engine = browserConfig.engine || "chromium";
  browser = await playwright[engine].launch({ executablePath: engine === "chromium" ? browserConfig.chromeExecutable : undefined });
  return { browser, base: "http://127.0.0.1:" + app.address().port };
}

test("the shared wordmark is a single text link and the homepage works without scripts", options, async t => {
  const { base, browser } = await start(t);
  const page = await browser.newPage({ javaScriptEnabled: false, reducedMotion: "reduce", viewport: { width: 320, height: 800 } });
  await page.goto(base + "/playground");
  for (const landmark of ["banner", "contentinfo"]) {
    const brand = page.getByRole(landmark).getByRole("link", { name: "Mero UI home" });
    assert.equal(await brand.innerText(), "Mero UI");
    assert.equal(await brand.locator(".mero-mark, img, svg").count(), 0);
    assert.equal(await brand.getAttribute("href"), "/");
  }
  await page.getByRole("contentinfo").getByRole("link", { name: "Mero UI home" }).focus();
  await page.keyboard.press("Enter");
  await page.waitForURL(base + "/");
  const heading = page.getByRole("heading", { level: 1, name: "The UI kit for HTMX.", exact: true });
  assert.ok(await heading.isVisible());
  assert.ok(await page.getByRole("link", { name: "Browse components", exact: true }).isVisible());
  for (const name of ["Go", "Rust"]) {
    const link = page.locator(".hero-intro").getByRole("link", { name, exact: true });
    assert.equal(await link.getAttribute("href"), "/start#" + name.toLowerCase());
  }
  const question = page.getByText("What does my server return?", { exact: true });
  await question.focus();
  await page.keyboard.press("Enter");
  assert.ok(await page.getByText("Return the part of the page that changed", { exact: false }).isVisible());
  const stage = page.locator("#studio-feature");
  assert.ok(await stage.getByRole("heading", { name: "Arc Task Lamp" }).isVisible());
  assert.equal(await stage.getByRole("radio", { disabled: false }).count(), 0);
  const inventory = stage.getByRole("link", { name: "View in inventory" });
  assert.equal(await inventory.getAttribute("href"), "/layouts/dashboard?view=inventory#product-6");
  const width = await page.evaluate(() => document.documentElement.scrollWidth - innerWidth);
  assert.ok(width <= 1, "homepage fits a 320px viewport without JavaScript");
  await inventory.click();
  await page.waitForURL(base + "/layouts/dashboard?view=inventory#product-6");
  assert.ok(await page.locator("#product-6").getByText("Arc Task Lamp", { exact: true }).isVisible());
});

test("the homepage shows the full CRM capture at phone and desktop widths in either theme", options, async t => {
  const { base, browser } = await start(t);
  const page = await browser.newPage({ viewport: { width: 1280, height: 900 }, reducedMotion: "reduce" });
  await page.goto(base);
  await page.locator('label[for="home-layout-crm"]').click();
  for (const width of [1280, 390]) {
    await page.setViewportSize({ width, height: 900 });
    for (const theme of ["dark", "light"]) {
      if (await page.locator("html").getAttribute("data-theme") !== theme) {
        await page.getByRole("button", { name: `Switch to ${theme} theme` }).click();
      }
      const image = page.locator("#home-preview-crm img:visible");
      await image.scrollIntoViewIfNeeded();
      const capture = await image.evaluate(async img => {
        await img.decode();
        const frame = img.closest(".home-app-shot").getBoundingClientRect();
        const canvas = document.createElement("canvas");
        canvas.width = 160;
        canvas.height = Math.round(160 * img.naturalHeight / img.naturalWidth);
        const ctx = canvas.getContext("2d");
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
        const background = ctx.getImageData(0, 0, 1, 1).data;
        const edges = [[0, 0, 160, 2], [0, 0, 2, canvas.height], [158, 0, 2, canvas.height]];
        const hasGutters = edges.every(rect => ctx.getImageData(...rect).data.every((channel, i) =>
          Math.abs(channel - background[i % 4]) < 20));
        return { src: new URL(img.currentSrc).pathname, ratio: frame.width / frame.height, hasGutters };
      });
      assert.equal(capture.src, `/example-crm-${theme}${width < 600 ? "-phone" : ""}.webp`);
      assert.ok(Math.abs(capture.ratio - (width < 600 ? 780 / 640 : 1620 / 900)) < .01);
      assert.ok(capture.hasGutters, "the captured CRM keeps space above the title and on both sides of the pipeline");
    }
  }
});

test("studio lighting follows the pointer, settles, and responds immediately to reduced motion", options, async t => {
  const { base, browser } = await start(t);
  const page = await browser.newPage({ viewport: { width: 1280, height: 900 }, reducedMotion: "no-preference" });
  await page.goto(base);
  const finePointer = await page.evaluate(() => matchMedia("(hover: hover) and (pointer: fine)").matches);
  if (!finePointer) return t.skip("Studio lighting is a fine-pointer interaction");
  const stage = page.locator("#studio-feature");
  await stage.scrollIntoViewIfNeeded();
  const bounds = await stage.boundingBox();
  const y = bounds.y + bounds.height * .5;
  const left = bounds.x + bounds.width * .25;
  const right = bounds.x + bounds.width * .75;
  await page.mouse.move(left, y);
  await page.waitForFunction(() => {
    const style = getComputedStyle(document.querySelector("#studio-feature"));
    return parseFloat(style.getPropertyValue("--stage-response")) > .65 && parseFloat(style.getPropertyValue("--stage-light-x")) < 48;
  }, null, { timeout: 5000 });
  await page.mouse.move(right, y);
  await page.waitForFunction(() => parseFloat(getComputedStyle(document.querySelector("#studio-feature")).getPropertyValue("--stage-light-x")) > 52);
  await page.mouse.move(1, 1);
  await page.waitForFunction(() => (parseFloat(getComputedStyle(document.querySelector("#studio-feature")).getPropertyValue("--stage-response")) || 0) < .01);
  await page.waitForFunction(async () => {
    const stage = document.querySelector("#studio-feature");
    const original = stage.getAttribute("style");
    for (let i = 0; i < 6; i++) await new Promise(requestAnimationFrame);
    return original === stage.getAttribute("style");
  });
  await page.mouse.move(right, y);
  await page.waitForFunction(() => parseFloat(getComputedStyle(document.querySelector("#studio-feature")).getPropertyValue("--stage-response")) > .65);
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.mouse.move(left, y);
  await page.waitForFunction(() => !document.querySelector("#studio-feature").style.getPropertyValue("--stage-response"));
  await stage.getByText("Graphite", { exact: true }).first().click();
  assert.match(await stage.getByRole("link", { name: "Edit in inventory" }).getAttribute("href"), /finish=graphite/);
});

test("the studio cards enter on landing and stay settled when inventory replaces the showcase", options, async t => {
  const { base, browser } = await start(t);
  const page = await browser.newPage({ reducedMotion: "no-preference" });
  await page.goto(base);
  const stage = page.locator("#studio-feature");
  const cards = stage.locator(".ps-card");
  const hasEntrance = () => cards.evaluateAll(nodes => nodes.map(node => getComputedStyle(node).animationName !== "none"));
  assert.deepEqual(await hasEntrance(), [true, true, true]);

  await page.emulateMedia({ reducedMotion: "reduce" });
  assert.deepEqual(await hasEntrance(), [false, false, false]);
  await page.emulateMedia({ reducedMotion: "no-preference" });

  await page.getByRole("button", { name: "Edit Arc Task Lamp" }).click();
  const dialog = page.getByRole("dialog");
  await dialog.getByLabel("Product name").fill("Updated lamp");
  await dialog.getByRole("button", { name: "Save changes" }).click();
  await stage.getByRole("heading", { name: "Updated lamp", exact: true }).waitFor();
  assert.deepEqual(await hasEntrance(), [false, false, false]);
});
