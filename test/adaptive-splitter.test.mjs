import assert from "node:assert/strict";
import test from "node:test";
import { browserConfig } from "../scripts/browser-config.mjs";
import { createApp } from "../server.mjs";

const playwright = await import(browserConfig.playwrightModule || "playwright").catch(error => {
  if (error.code === "ERR_MODULE_NOT_FOUND" && !browserConfig.playwrightModule) return null;
  throw error;
});
const options = { skip: !playwright && "Install Playwright to test resizable panels" };

async function fixture(t) {
  const app = createApp();
  await new Promise((resolve, reject) => app.once("error", reject).listen(0, "127.0.0.1", resolve));
  t.after(() => new Promise(resolve => app.close(resolve)));
  const engine = browserConfig.engine || "chromium";
  const browser = await playwright[engine].launch({
    executablePath: engine === "chromium" ? browserConfig.chromeExecutable : undefined,
  });
  t.after(() => browser.close());
  const page = await browser.newPage({ viewport: { width: 1280, height: 900 }, reducedMotion: "reduce" });
  page.setDefaultTimeout(5000);
  return { page, origin: "http://127.0.0.1:" + app.address().port };
}

const firstPaneWidth = split => split.evaluate(el => el.firstElementChild.getBoundingClientRect().width);

// Keep the pointer at the middle of the handle, including on hosts with a wider touch target.
async function dragToWidth(page, split, width) {
  const handle = split.getByRole("separator");
  await handle.scrollIntoViewIfNeeded();
  const box = await handle.boundingBox();
  const startX = Math.round(box.x + box.width / 2);
  const y = Math.round(box.y + box.height / 2);
  const x = startX + Math.round(width - await firstPaneWidth(split));
  await page.mouse.move(startX, y);
  await page.mouse.down();
  await page.mouse.move(x, y);
  return { x, y };
}

async function dropAtWidth(page, split, width) {
  await split.getByRole("separator").press("End");
  await dragToWidth(page, split, width);
  await page.mouse.up();
  return firstPaneWidth(split);
}

function near(actual, expected, tolerance = 1.2) {
  assert.ok(Math.abs(actual - expected) <= tolerance, `expected ${expected}px ±${tolerance}px, got ${actual}px`);
}

test("the adaptive divider learns recent drop widths, releases for precision and keeps arrows exact", options, async t => {
  const { page, origin } = await fixture(t);
  await page.goto(origin + "/preview/resizable?variant=Adaptive");
  const split = page.locator("[data-mero-ws-snap][data-mero-ws-split-ready]");
  const handle = split.getByRole("separator");
  await handle.waitFor();
  const firstWidth = Math.round((await split.boundingBox()).width * .5);

  near(await dropAtWidth(page, split, firstWidth), firstWidth);
  near(await dropAtWidth(page, split, firstWidth + 4), firstWidth + 4);
  await dropAtWidth(page, split, firstWidth - 1);
  // Several similar stops establish a preference. A nearby pointer position now lands on it.
  await handle.press("End");
  const pointer = await dragToWidth(page, split, firstWidth + 8);
  await split.locator("[role=separator][data-mero-ws-snapped]").waitFor();
  const snapped = await firstPaneWidth(split);
  near(snapped, firstWidth, 3);
  // Holding still unlocks the edge. The next three pixels of motion move the pane three pixels.
  await split.locator("[role=separator][data-mero-ws-snapped]").waitFor({ state: "hidden" });
  near(await firstPaneWidth(split), snapped);
  await page.mouse.move(pointer.x + 3, pointer.y);
  near(await firstPaneWidth(split), snapped + 3);
  await page.mouse.up();
  const released = await firstPaneWidth(split);
  await handle.press("ArrowLeft");
  near(await firstPaneWidth(split), released - 1, .3);
  await page.evaluate(() => { document.documentElement.dir = "rtl"; });
  await handle.press("ArrowLeft");
  near(await firstPaneWidth(split), released, .3);
  await handle.press("Shift+ArrowRight");
  near(await firstPaneWidth(split), released - 10, .3);
  await page.evaluate(() => { document.documentElement.dir = "ltr"; });

  for (let i = 0; i < 4; i++) await dropAtWidth(page, split, firstWidth);
  const newWidth = firstWidth - 60;
  // The earlier cluster still has more samples, but a consistent new preference takes over.
  for (let i = 0; i < 5; i++) await dropAtWidth(page, split, newWidth);
  near(await dropAtWidth(page, split, newWidth + 8), newWidth, 2);
  near(await dropAtWidth(page, split, firstWidth + 8), firstWidth + 8);

  await page.goto(origin + "/preview/resizable");
  const plain = page.getByRole("separator");
  assert.equal(await plain.getAttribute("aria-valuenow"), "40");
  await plain.press("ArrowRight");
  assert.equal(await plain.getAttribute("aria-valuenow"), "42");
  await page.reload();
  assert.equal(await plain.getAttribute("aria-valuenow"), "40");
});

test("Mail keeps its pane width and snap point through an HTMX message change and phone layout", options, async t => {
  const { page, origin } = await fixture(t);
  await page.goto(origin + "/layouts/mail?embed=1&thread=proofs");
  const mail = page.locator('[data-communication="mail"]');
  const split = mail.locator("[data-mero-ws-snap][data-mero-ws-split-ready]");
  const handle = split.getByRole("separator");
  await handle.waitFor();
  const preferred = Math.round((await split.boundingBox()).width * .41);
  for (const offset of [0, 1, -1]) await dropAtWidth(page, split, preferred + offset);
  const beforeSwap = await firstPaneWidth(split);
  const swapped = page.waitForResponse(response =>
    ["xhr", "fetch"].includes(response.request().resourceType()) && new URL(response.url()).pathname === "/demo/layouts/mail");
  await mail.getByRole("link", { name: /Julian Park/ }).click();
  assert.equal((await swapped).status(), 200);
  await mail.getByLabel("Reply to Julian").waitFor();
  await handle.waitFor();
  near(await firstPaneWidth(split), beforeSwap);
  near(await dropAtWidth(page, split, preferred + 8), preferred, 2);
  await page.setViewportSize({ width: 390, height: 844 });
  assert.equal(await handle.isVisible(), false);
  await mail.getByRole("link", { name: "Messages", exact: true }).click();
  await mail.getByRole("link", { name: /Mara Lind/ }).waitFor();
  assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true);
  await page.setViewportSize({ width: 1280, height: 900 });
  await handle.waitFor();
  // The handle reappears in CSS before ResizeObserver restores its wide-host width.
  await page.waitForFunction(expected =>
    Math.abs(document.querySelector(".comm-list").getBoundingClientRect().width - expected) <= 2, preferred);
  await page.reload();
  await handle.waitFor();
  near(await firstPaneWidth(split), preferred, 2);
});
