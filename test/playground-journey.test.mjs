import assert from "node:assert/strict";
import test from "node:test";
import { browserConfig } from "../scripts/browser-config.mjs";
import { createApp } from "../server.mjs";

const playwright = await import(browserConfig.playwrightModule || "playwright").catch(error => {
  if (error.code === "ERR_MODULE_NOT_FOUND" && !browserConfig.playwrightModule) return null;
  throw error;
});
const options = { skip: !playwright && "Install Playwright to exercise the playground" };

async function openPlayground(t, width, path = "/playground") {
  const server = createApp();
  let browser;
  t.after(async () => {
    try { await browser?.close(); }
    finally { if (server.listening) await new Promise(resolve => server.close(resolve)); }
  });
  await new Promise((resolve, reject) => server.once("error", reject).listen(0, "127.0.0.1", resolve));
  const engine = browserConfig.engine || "chromium";
  browser = await playwright[engine].launch({ executablePath: engine === "chromium" ? browserConfig.chromeExecutable : undefined });
  const base = "http://127.0.0.1:" + server.address().port;
  const page = await browser.newPage({ viewport: { width, height: 860 }, reducedMotion: "reduce" });
  await page.goto(base + path);
  return { browser, page, base };
}

function workflows(page) {
  return page.getByRole("navigation", { name: "Playground workflows" });
}

async function inspectResponse(page, response) {
  await page.getByRole("tab", { name: "HTTP exchange" }).click();
  const payload = await response.text();
  const text = await page.locator("[data-exchange-body]").textContent();
  assert.ok(text.includes(response.request().method() + " " + new URL(response.url()).pathname));
  assert.ok(text.includes("HTTP " + response.status()));
  assert.ok(payload.length > 0 && text.includes(payload), "inspector contains the server's actual HTML");
}

test("playground validation preserves keyboard focus and shows the actual failed and successful responses", options, async t => {
  const { page } = await openPlayground(t, 1280);
  await workflows(page).getByRole("link", { name: /form validation/i }).click();
  const tabs = name => page.getByRole("tab", { name, exact: true });
  await tabs("Template").click();
  assert.match(await page.getByRole("tabpanel", { name: "Template" }).innerText(), /hx-post="\/demo\/settings"/);
  await tabs("Preview").click();
  const field = page.getByRole("textbox", { name: "Workspace name" });
  const save = page.getByRole("button", { name: "Save settings" });
  await field.fill("   ");
  const invalid = page.waitForResponse(response => new URL(response.url()).pathname === "/demo/settings" && response.status() === 422);
  await save.click();
  await page.waitForFunction(() => document.activeElement?.id === "workspace-name" && document.activeElement.getAttribute("aria-invalid") === "true");
  await inspectResponse(page, await invalid);
  await tabs("Preview").click();
  await field.fill("North studio");
  const valid = page.waitForResponse(response => new URL(response.url()).pathname === "/demo/settings" && response.status() === 200);
  await save.click();
  await page.waitForFunction(() => document.activeElement?.id === "settings-save");
  await page.getByText("Settings saved", { exact: true }).waitFor();
  await inspectResponse(page, await valid);
  await tabs("Preview").click();
  const history = page.getByRole("region", { name: "Request log" });
  await history.getByRole("button", { name: /422/ }).click();
  assert.equal(await tabs("HTTP exchange").getAttribute("aria-selected"), "true");
  const earlier = await page.locator("[data-exchange-body]").textContent();
  assert.ok(earlier.includes(await (await invalid).text()));
  assert.ok(earlier.includes("HTTP 422"));
  await history.getByRole("button", { name: "Clear", exact: true }).click();
  assert.equal(await history.getByRole("button", { name: /POST/ }).count(), 0);
  assert.equal(await page.locator("[data-exchange-status]").textContent(), "Waiting for a request");
  const fresh = page.waitForResponse(response => new URL(response.url()).pathname === "/demo/settings" && response.status() === 422);
  await page.getByRole("button", { name: "Try an invalid name" }).click();
  await history.getByRole("button", { name: /POST.*422/ }).waitFor();
  assert.equal(await history.getByRole("button", { name: /POST/ }).count(), 1);
  assert.equal(await tabs("Preview").getAttribute("aria-selected"), "true");
  await inspectResponse(page, await fresh);
});

test("phone visitors can inspect a filtered report, return by history and follow workflow links without JavaScript", options, async t => {
  const { page, browser, base } = await openPlayground(t, 320, "/playground?scenario=report");
  await page.getByRole("combobox", { name: "Reporting period" }).selectOption("recent");
  const recent = page.waitForResponse(response => {
    const url = new URL(response.url());
    return url.pathname === "/demo/insights/chart" && url.searchParams.get("period") === "recent";
  });
  await page.getByRole("button", { name: "Apply", exact: true }).click();
  await page.getByText("Friday to Sunday", { exact: true }).waitFor();
  await inspectResponse(page, await recent);
  assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1));
  await workflows(page).getByRole("link", { name: /inventory/i }).click();
  await page.getByRole("button", { name: "Edit Arc Task Lamp" }).waitFor();
  await page.goBack();
  const report = workflows(page).getByRole("link", { name: /dispatch report/i });
  await page.waitForURL(url => url.searchParams.get("scenario") === "report");
  assert.equal(await report.getAttribute("aria-current"), "page");

  const plain = await browser.newPage({ javaScriptEnabled: false });
  await plain.goto(base + "/playground");
  await workflows(plain).getByRole("link", { name: /dispatch report/i }).click();
  await plain.getByRole("combobox", { name: "Reporting period" }).waitFor();
  assert.equal(new URL(plain.url()).searchParams.get("scenario"), "report");
});
