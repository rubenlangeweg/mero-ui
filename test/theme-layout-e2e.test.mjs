import { browserConfig } from "../scripts/browser-config.mjs";
import assert from "node:assert/strict";
import test from "node:test";
import { createApp } from "../server.mjs";

const playwright = await import(browserConfig.playwrightModule || "playwright").catch(error => {
  if (error.code === "ERR_MODULE_NOT_FOUND" && !browserConfig.playwrightModule) return null;
  throw error;
});
const engine = browserConfig.engine || "chromium";
const options = { skip: !playwright && "Install Playwright for the showcase browser checks" };

async function start(t, viewport = { width: 1280, height: 800 }) {
  const app = createApp();
  await new Promise((resolve, reject) => app.once("error", reject).listen(0, "127.0.0.1", resolve));
  let browser;
  t.after(async () => {
    try { await browser?.close(); }
    finally { await new Promise(resolve => app.close(resolve)); }
  });
  browser = await playwright[engine].launch({
    executablePath: engine === "chromium" ? browserConfig.chromeExecutable : undefined,
  });
  const page = await browser.newPage({ viewport, reducedMotion: "reduce" });
  page.setDefaultTimeout(7000);
  await page.goto("http://127.0.0.1:" + app.address().port);
  return { browser, page };
}

async function fitsViewport(page) {
  const extra = await page.evaluate(async () => {
    await document.fonts.ready;
    return document.documentElement.scrollWidth - innerWidth;
  });
  assert.ok(extra <= 1, `${page.url()} overflows horizontally by ${extra}px`);
}

test("a theme edited from the homepage opens with the same controls in a fresh browser session", options, async t => {
  const { browser, page } = await start(t);
  await page.locator('a[href="/themes"]:visible').first().click();
  const hue = page.getByRole("slider", { name: "Hue", exact: true });
  await hue.focus();
  await hue.press("Home");
  await hue.press("ArrowRight");
  const value = await hue.inputValue();
  assert.ok(Number(value) > 0);
  await page.waitForFunction(expected => new URL(location.href).searchParams.get("hue") === expected, value);

  const shared = await browser.newPage({ viewport: { width: 360, height: 800 } });
  await shared.goto(page.url());
  await shared.getByRole("button", { name: "Customize", exact: true }).click();
  assert.equal(await shared.getByRole("slider", { name: "Hue", exact: true }).inputValue(), value);
  await shared.getByRole("button", { name: "Done", exact: true }).click();
  const preview = shared.getByRole("region", { name: "Live preview" });
  const accent = await preview.getByRole("button", { name: "Preview invitation" }).evaluate(button =>
    getComputedStyle(button).getPropertyValue("--mero-accent").trim());
  assert.ok(accent);
  await preview.getByRole("link", { name: "CRM", exact: true }).click();
  await shared.frameLocator('iframe[title="CRM theme preview"]').getByRole("heading", { name: "Sales pipeline" }).waitFor();
  await shared.waitForFunction(expected => {
    const heading = document.querySelector('iframe[title="CRM theme preview"]').contentDocument.querySelector("h1");
    return heading && getComputedStyle(heading).getPropertyValue("--mero-accent").trim() === expected;
  }, accent);
  await fitsViewport(shared);
});

test("visitors can open each app from the layout gallery and return to the gallery on a phone", options, async t => {
  const { browser, page: desktop } = await start(t);
  const showcase = desktop.locator("#pro");
  await showcase.getByText("Finance", { exact: true }).click();
  assert.equal(await showcase.getByRole("radio", { name: "Finance", exact: true }).isChecked(), true);
  await showcase.getByRole("link", { name: /open finance/i }).click();
  await desktop.waitForURL(url => url.pathname === "/layouts/finance");
  await desktop.locator(".bu-posting").and(desktop.getByRole("link", { expanded: false })).first().click();
  await desktop.locator("dt").getByText("Reference", { exact: true }).waitFor();
  await desktop.waitForURL(url => url.searchParams.has("transaction"));
  await desktop.goBack();
  await desktop.waitForURL(url => url.pathname === "/layouts/finance" && !url.searchParams.has("transaction"));
  await desktop.goBack();
  await showcase.getByRole("link", { name: /all layouts/i }).click();
  await desktop.waitForURL(url => url.pathname === "/layouts");
  // Open the phone at its real viewport. Resizing the live gallery can stall Firefox's automation protocol.
  const page = await browser.newPage({ viewport: { width: 360, height: 800 }, reducedMotion: "reduce" });
  page.setDefaultTimeout(7000);
  await page.goto(desktop.url());
  const titles = new Set();
  for (const slug of ["dashboard", "mail", "chat", "crm", "finance", "settings"]) {
    await fitsViewport(page);
    await page.locator(`main a[href="/layouts/${slug}"]:visible`).first().click();
    await page.waitForURL(url => url.pathname === "/layouts/" + slug);
    const title = page.getByRole("heading", { level: 1 });
    assert.equal(await title.count(), 1, `${slug} needs one page heading`);
    titles.add((await title.innerText()).trim());
    const preview = page.locator(".app-example-stage [data-sample-scope]");
    const host = await preview.boundingBox();
    const app = await preview.locator(":scope > :first-child").boundingBox();
    assert.ok(app.width >= host.width - 2, `${slug} should fill its preview`);
    await fitsViewport(page);
    await page.goBack();
    await page.waitForURL(url => url.pathname === "/layouts");
  }
  assert.equal(titles.size, 6);
});

test("layout switching, gallery return and standalone navigation retain their context", options, async t => {
  const { page } = await start(t, { width: 320, height: 800 });
  await page.goto(new URL("/layouts/crm", page.url()).href);
  const chooser = page.locator(".app-example-chooser summary");
  await chooser.focus();
  await page.keyboard.press("Enter");
  const menu = page.getByRole("navigation", { name: "Application examples" });
  assert.equal(await menu.locator('a[aria-current="page"]').innerText(), "CRM");
  await page.keyboard.press("Escape");
  assert.equal(await menu.isVisible(), false);
  await chooser.click();
  await menu.getByRole("link", { name: "Finance" }).click();
  await page.getByRole("link", { name: "All layouts" }).click();
  assert.equal(new URL(page.url()).hash, "#example-finance");
  await page.locator("#example-finance").click();
  await page.getByLabel("Preview theme").selectOption("brand");
  await page.getByRole("link", { name: "September 2026" }).click();
  await page.waitForURL(url => url.searchParams.get("period") === "2026-09");
  const link = page.getByRole("link", { name: "Open app in a new tab" });
  const [standalone] = await Promise.all([page.waitForEvent("popup"), link.click()]);
  await standalone.waitForLoadState("domcontentloaded");
  assert.equal(new URL(standalone.url()).searchParams.get("period"), "2026-09");
  assert.ok(await standalone.locator("html[data-tenant-preview]").count());
  await standalone.getByRole("link", { name: "August 2026" }).click();
  await standalone.waitForURL(url => url.searchParams.get("period") === "2026-08" && url.searchParams.get("embed") === "1");
  await standalone.reload();
  assert.equal(await standalone.getByRole("navigation", { name: "Main navigation" }).count(), 0);
  assert.ok(await standalone.locator("html[data-tenant-preview]").count());
  await standalone.goBack();
  await standalone.waitForURL(url => url.searchParams.get("period") === "2026-09" && url.searchParams.get("theme") === "brand");
});

test("standalone message forms retain their appearance on native validation and submission", options, async t => {
  const { browser, page } = await start(t);
  const native = await browser.newPage({ javaScriptEnabled: false, viewport: { width: 390, height: 844 } });
  await native.goto(new URL("/layouts/mail?thread=proofs&embed=1&theme=light", page.url()).href);
  const message = native.getByRole("textbox");
  await message.fill("  ");
  const send = native.getByRole("button", { name: /send reply/i });
  const [invalid] = await Promise.all([native.waitForNavigation(), send.click()]);
  assert.equal(invalid.status(), 422);
  assert.equal(await native.getByRole("navigation", { name: "Main navigation" }).count(), 0);
  assert.equal(await native.locator("html").getAttribute("data-theme"), "light");
  await message.fill("The proof is ready for review.");
  await send.click();
  await native.waitForURL(url => url.pathname === "/layouts/mail" && url.searchParams.get("theme") === "light" && url.searchParams.get("embed") === "1");
  assert.ok(await native.getByLabel("Open message").getByText("The proof is ready for review.", { exact: true }).isVisible());
});

test("the layout gallery downloads only matching viewport and theme captures", options, async t => {
  const { browser, page } = await start(t);
  for (const [width, theme, suffix] of [[390, "light", "light-phone"], [1280, "dark", "dark"]]) {
    const gallery = await browser.newPage({ viewport: { width, height: 800 } });
    await gallery.addInitScript(value => localStorage.setItem("mero-theme", value), theme);
    const art = new Set();
    gallery.on("request", request => {
      const image = new URL(request.url()).pathname;
      if (image.startsWith("/example-")) art.add(image);
    });
    await gallery.goto(new URL("/layouts", page.url()).href);
    // The shots are CSS backgrounds: WebKit can request them after the load event.
    for (let waited = 0; art.size < 6 && waited < 5000; waited += 50) await gallery.waitForTimeout(50);
    // Give any extra, wrongly matched capture time to show up before counting.
    await gallery.waitForTimeout(250);
    assert.equal(art.size, 6);
    assert.ok([...art].every(path => path.endsWith("-" + suffix + ".webp")));
    await gallery.getByRole("link", { name: /^Mail Read, reply to/ }).and(gallery.locator("#example-mail")).waitFor();
    await gallery.close();
  }
});
