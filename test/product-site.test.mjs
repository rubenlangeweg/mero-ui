import { browserConfig } from "../scripts/browser-config.mjs";
import assert from "node:assert/strict";
import test from "node:test";
import { createApp } from "../server.mjs";

const playwright = await import(browserConfig.playwrightModule || "playwright").catch(error => {
  if (error.code === "ERR_MODULE_NOT_FOUND" && !browserConfig.playwrightModule) return null;
  throw error;
});
const engine = browserConfig.engine || "chromium";
const options = { skip: !playwright && "Install Playwright for the product-page browser checks" };

async function visit(t, route) {
  const app = createApp();
  await new Promise((resolve, reject) => app.once("error", reject).listen(0, "127.0.0.1", resolve));
  t.after(() => new Promise(resolve => app.close(resolve)));
  const browser = await playwright[engine].launch({
    executablePath: engine === "chromium" ? browserConfig.chromeExecutable : undefined,
  });
  t.after(() => browser.close());
  const page = await browser.newPage({ viewport: { width: 390, height: 844 }, reducedMotion: "reduce" });
  page.setDefaultTimeout(6000);
  await page.goto("http://127.0.0.1:" + app.address().port + route);
  return page;
}

// The live examples above the homepage inventory load lazily and then grow to fit. Load them first,
// or WebKit can move a row between the press and the release of a click, which then misses its button.
async function settleLiveExamples(page) {
  for (const frame of await page.locator("[data-live-specimen]").all()) {
    await frame.scrollIntoViewIfNeeded();
    await page.waitForFunction(el => el.style.getPropertyValue("--specimen-content-height"), await frame.elementHandle());
  }
}

test("the quick start's first request runs on the page and exposes its actual response", options, async t => {
  const page = await visit(t, "/start");
  const brand = page.getByRole("banner").getByRole("link", { name: "Mero UI home" });
  assert.equal(await brand.getAttribute("href"), "/");
  assert.equal(await page.getByRole("link", { name: /Download source/ }).getAttribute("href"), "/downloads/mero-ui.tar.gz");
  await page.getByRole("button", { name: "Check inventory" }).click();
  await page.getByText("6 products", { exact: true }).waitFor();
  await page.getByRole("tab", { name: "HTTP exchange" }).click();
  const exchange = await page.locator("[data-exchange-body]").innerText();
  assert.match(exchange, /GET \/demo\/stock-summary/);
  assert.match(exchange, /HTTP 200/);
  assert.match(exchange, /<strong>6 products<\/strong> · 4 active/);
});

test("the homepage tracks an edited or deleted feature and preserves unrelated gallery choices", options, async t => {
  const page = await visit(t, "/");
  await settleLiveExamples(page);
  const stage = page.locator("#studio-feature");
  const selectFinish = stage.getByText("Graphite", { exact: true }).first();
  await selectFinish.click();
  const editLink = stage.getByRole("link", { name: "Edit in inventory" });
  assert.match(await editLink.getAttribute("href"), /finish=graphite/);
  await page.getByRole("button", { name: "Edit Dune Throw" }).click();
  await page.getByRole("button", { name: "Save changes" }).click();
  await page.getByRole("dialog").waitFor({ state: "hidden" });
  assert.match(await editLink.getAttribute("href"), /finish=graphite/);
  await page.getByRole("button", { name: "Edit Arc Task Lamp" }).click();
  const dialog = page.getByRole("dialog");
  await dialog.getByLabel("Product name").fill("Desk light & shade");
  await dialog.getByLabel("SKU", { exact: true }).fill("ST-12");
  await dialog.getByRole("combobox", { name: /^Status/ }).selectOption("Draft");
  await dialog.getByRole("combobox", { name: /^Finish/ }).selectOption("sand");
  await dialog.getByRole("button", { name: "Save changes" }).click();
  await stage.getByRole("heading", { name: "Desk light & shade", exact: true }).waitFor();
  assert.equal(await stage.locator("code").textContent(), "ST-12");
  assert.equal(await stage.locator(".ps-image-status").innerText(), "Draft");
  assert.match(await editLink.getAttribute("href"), /finish=sand/);
  await page.reload();
  await settleLiveExamples(page);
  await stage.getByRole("heading", { name: "Desk light & shade", exact: true }).waitFor();
  await page.getByRole("button", { name: "Edit Desk light & shade" }).click();
  await page.getByRole("button", { name: "Delete product", exact: true }).click();
  await page.getByRole("dialog", { name: "Delete Desk light & shade?" }).getByRole("button", { name: /Delete/ }).click();
  await stage.getByRole("link", { name: "Open inventory" }).waitFor();
  assert.equal(await stage.locator("[href*='edit=6'], [data-href*='edit=6']").count(), 0);
  assert.equal(await stage.locator(".ps-journal").count(), 0);
});

test("homepage examples update from the server and grow to fit the expanded chart", options, async t => {
  const page = await visit(t, "/");
  const chartFrame = page.locator('iframe[title="Dispatch report live example"]');
  const chart = page.frameLocator('iframe[title="Dispatch report live example"]');
  await chartFrame.scrollIntoViewIfNeeded();
  await chart.getByRole("combobox", { name: /Reporting period/ }).selectOption("recent");
  await chart.getByRole("button", { name: "Apply" }).click();
  await chart.getByText("Friday to Sunday").waitFor();
  const data = chart.getByText("View chart data", { exact: true });
  await data.click();
  await chart.getByRole("table").waitFor();
  await page.waitForFunction(() => {
    const frame = document.querySelector('iframe[title="Dispatch report live example"]');
    return frame.contentDocument.documentElement.scrollHeight <= frame.clientHeight + 1;
  });
  const chat = page.frameLocator('iframe[title="Dispatch assistant live example"]');
  await page.locator('iframe[title="Dispatch assistant live example"]').scrollIntoViewIfNeeded();
  await chat.getByRole("button", { name: "Which day shipped most?" }).click();
  await chat.getByRole("button", { name: /send/i }).click();
  await chat.getByText(/The busiest day was/).waitFor();
});
