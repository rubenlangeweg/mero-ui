import { browserConfig } from "../scripts/browser-config.mjs";
import test from "node:test";
import assert from "node:assert/strict";
import { createApp } from "../server.mjs";

const playwright = await import(browserConfig.playwrightModule || "playwright").catch(error => {
  if (error.code === "ERR_MODULE_NOT_FOUND" && !browserConfig.playwrightModule) return null;
  throw error;
});
const options = { skip: !playwright && "Install Playwright to run the browser regression" };

async function start(t, contextOptions = {}) {
  const server = createApp();
  await new Promise(resolve => server.listen(0, "127.0.0.1", resolve));
  t.after(() => new Promise(resolve => { server.close(resolve); server.closeAllConnections(); }));
  const engine = browserConfig.engine || "chromium";
  const browser = await playwright[engine].launch({ executablePath: engine === "chromium" ? browserConfig.chromeExecutable : undefined });
  t.after(() => browser.close());
  const context = await browser.newContext({ reducedMotion: "reduce", ...contextOptions });
  const page = await context.newPage();
  page.setDefaultTimeout(5000);
  const errors = [];
  page.on("pageerror", error => errors.push(error.message));
  return { base: "http://127.0.0.1:" + server.address().port, page, context, errors };
}

test("copy buttons copy a value or a target and select the target when the clipboard is blocked", options, async t => {
  const { base, page, errors } = await start(t);
  // Stub the clipboard so every engine behaves the same; the second call fails as a blocked clipboard would.
  await page.addInitScript(() => {
    window.copied = [];
    Object.defineProperty(navigator, "clipboard", { configurable: true, value: { writeText: async text => {
      if (window.blockClipboard) throw new DOMException("Blocked", "NotAllowedError");
      window.copied.push(text);
    } } });
  });
  await page.goto(base + "/preview/button?variant=Copy%20to%20clipboard");
  const key = page.getByRole("button", { name: "Copy publishable key" });
  await key.click();
  await page.locator(".mero-toast", { hasText: "Copied" }).waitFor();
  await page.getByRole("button", { name: "Copy environment ID" }).click();
  await page.waitForFunction(() => window.copied.length === 2);
  assert.deepEqual(await page.evaluate(() => window.copied), ["pk_live_51HcX2eDeploy", "env_7f3a91"]);
  assert.equal(await key.textContent(), "Copy", "the label never changes");
  await page.evaluate(() => { window.blockClipboard = true; });
  await key.click();
  await page.locator(".mero-toast", { hasText: "Press Ctrl+C" }).waitFor();
  assert.deepEqual(await page.locator("#copy-demo-key").evaluate(input => [input.selectionStart, input.selectionEnd, input.value.length]), [0, 21, 21]);
  assert.deepEqual(errors, []);
});

test("local times follow the reader's locale and time zone and relative times refresh", options, async t => {
  const { base, page, errors } = await start(t, { locale: "en-US", timezoneId: "Europe/Amsterdam" });
  await page.clock.install({ time: new Date("2026-11-23T09:46:00Z") });
  await page.goto(base + "/preview/typography?variant=Local%20time");
  const text = async name => (await page.locator(`time[data-mero-time=${name}]`).textContent()).replace(/\s/g, " ");
  assert.equal(await text("relative"), "5 minutes ago");
  assert.equal(await text("absolute"), "Nov 21, 2026, 5:05 PM", "16:05 UTC is 17:05 in Amsterdam");
  assert.equal(await text("date"), "Dec 23, 2026");
  assert.match((await page.locator("time[data-mero-time=relative]").getAttribute("title")).replace(/\s/g, " "), /^Nov 23, 2026, 10:41 AM$/);
  await page.clock.fastForward(61000);
  await page.waitForFunction(() => document.querySelector("time[data-mero-time=relative]").textContent === "6 minutes ago");
  assert.deepEqual(errors, []);
});

test("single-key shortcuts act outside fields and can be switched off for every page", options, async t => {
  const { base, page, errors } = await start(t);
  await page.goto(base + "/preview/kbd?variant=Keyboard%20shortcuts");
  const search = page.getByRole("searchbox", { name: "Search /" });
  const toasts = page.locator(".mero-toast");
  const toggle = page.getByRole("checkbox", { name: "Single-key shortcuts" });
  assert.equal(await search.getAttribute("aria-keyshortcuts"), "/");
  assert.equal(await page.getByRole("button", { name: /New draft/ }).getAttribute("aria-keyshortcuts"), "n");
  assert.equal(await page.getByRole("button", { name: /Reports/ }).getAttribute("aria-keyshortcuts"), null, "sequences are not announced");

  await page.keyboard.press("/");
  assert.equal(await search.evaluate(node => node === document.activeElement), true);
  await page.keyboard.type("n");
  assert.equal(await search.inputValue(), "n", "typing in a field is never a shortcut");
  await page.waitForTimeout(150);
  assert.equal(await toasts.count(), 0);

  await search.evaluate(node => node.blur());
  await page.keyboard.press("n");
  await toasts.filter({ hasText: "New draft started" }).waitFor();
  await page.keyboard.press("g");
  await page.keyboard.press("r");
  await toasts.filter({ hasText: "Opened reports" }).waitFor();

  await toggle.click();
  await search.evaluate(node => node.blur());
  const before = await toasts.filter({ hasText: "New draft started" }).count();
  await page.keyboard.press("n");
  await page.waitForTimeout(150);
  assert.equal(await toasts.filter({ hasText: "New draft started" }).count(), before, "off means off");
  assert.equal(await search.getAttribute("aria-keyshortcuts"), null);

  await page.reload();
  assert.equal(await toggle.isChecked(), false, "the choice applies to every page");
  assert.equal(await search.getAttribute("aria-keyshortcuts"), null);
  await toggle.click();
  assert.equal(await search.getAttribute("aria-keyshortcuts"), "/");
  assert.deepEqual(errors, []);
});

test("conditional branches show and disable with their field, and Apply waits for a change", options, async t => {
  const { base, page, errors } = await start(t);
  await page.goto(base + "/preview/fieldset?variant=Conditional%20fields");
  const apply = page.getByRole("button", { name: "Apply" });
  const branch = page.locator("[data-mero-show-when]");
  const team = page.getByLabel("Team name");
  assert.equal(await apply.isDisabled(), true);
  assert.equal(await branch.isHidden(), true);

  await page.getByLabel("A team").check();
  assert.equal(await branch.isVisible(), true);
  assert.equal(await team.isEnabled(), true);
  assert.equal(await apply.isEnabled(), true, "a change enables Apply");

  await page.getByLabel("Only me").check();
  assert.equal(await branch.isHidden(), true);
  assert.equal(await branch.evaluate(node => node.disabled), true, "a hidden branch neither validates nor submits");
  assert.equal(await apply.isDisabled(), true, "back to the rendered value");

  await page.getByLabel("The organisation").check();
  await team.fill("Platform");
  const request = page.waitForRequest(request => request.url().includes("/demo/stock-summary"));
  await apply.click();
  const url = new URL((await request).url());
  assert.equal(url.searchParams.get("owner"), "org");
  assert.equal(url.searchParams.get("team"), "Platform");
  await page.locator("output", { hasText: "products" }).waitFor();
  await page.waitForTimeout(50);
  assert.equal(await apply.isEnabled(), true, "the request leaves Apply as the form's state says");
  assert.deepEqual(errors, []);
});
