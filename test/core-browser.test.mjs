import { browserConfig } from "../scripts/browser-config.mjs";
import assert from "node:assert/strict";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { execFile } from "node:child_process";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
import { promisify } from "node:util";
import test from "node:test";
import { catalogFragment, groups } from "../site/core-components.mjs";
import { createInventoryExample } from "../examples/studio-inventory/server.mjs";

// Optional browser dependency for contributors. MERO_PLAYWRIGHT_MODULE can
// point at a shared Playwright installation and MERO_CHROME at a local binary.
const playwright = await import(browserConfig.playwrightModule || "playwright").catch(error => {
  if (error.code === "ERR_MODULE_NOT_FOUND" && !browserConfig.playwrightModule) return null;
  throw error;
});
const examples = new Map(groups.flatMap(group => group.items.map(item => [item.id, item])));
const source = new URL("../", import.meta.url);
const browserName = browserConfig.engine || "chromium";
const browserOptions = { skip: !playwright && "Install Playwright to run the browser regression" };

async function browserPage(t) {
  const browser = await playwright[browserName].launch({
    executablePath: browserName === "chromium" ? browserConfig.chromeExecutable : undefined,
  });
  t.diagnostic(browserName + " " + browser.version());
  t.after(() => browser.close());
  const page = await browser.newPage();
  page.setDefaultTimeout(8000);
  return page;
}

test("copied widgets keep local references through HTMX swaps", browserOptions, async t => {
  const page = await browserPage(t);
  const errors = [];
  page.on("pageerror", error => errors.push(error.message));
  const template = ["tabs", "autocomplete", "modal", "accordion", "radio-group", "pagination", "calendar", "tooltip"]
    .map(id => examples.get(id).demo).join("\n");
  // A form can render a saved draft with its initial, unfiltered options.
  const draft = template.replace('name="q" type="text" role="combobox"', 'name="q" type="text" role="combobox" value="not-a-workspace"');
  const body = `<section>${template}</section><section>${template}</section>
    <button hx-get="/prepend" hx-target="body" hx-swap="afterbegin">Insert a copy</button>
    <div data-theme="light" id="light-preview"><div data-theme="dark" id="dark-preview"></div></div>`;

  await page.route("http://mero.test/**", async route => {
    const url = new URL(route.request().url());
    if (url.pathname === "/") {
      return route.fulfill({ contentType: "text/html", body: `<!doctype html><html data-theme="dark">
        <link rel="stylesheet" href="/mero.css"><script defer src="/htmx.js"></script>
        <script defer src="/mero.js"></script><body>${body}</body></html>` });
    }
    if (url.pathname === "/prepend") return route.fulfill({ contentType: "text/html", body: `<section>${draft}</section>` });
    if (url.pathname.endsWith("/autocomplete")) {
      if (url.searchParams.get("q") === "offline") return route.fulfill({ status: 503, body: "" });
      return route.fulfill({ contentType: "text/html", body: catalogFragment("autocomplete", url.searchParams) });
    }
    if (url.pathname.startsWith("/demo/catalog/")) {
      return route.fulfill({ contentType: "text/html", body: catalogFragment(url.pathname.split("/").at(-1), url.searchParams) });
    }
    const filename = { "/htmx.js": "public/vendor/htmx.min.js", "/mero.js": "ui/mero.js", "/mero.css": "ui/mero.css" }[url.pathname];
    if (!filename) return route.fulfill({ status: 404, body: "" });
    return route.fulfill({
      contentType: filename.endsWith(".css") ? "text/css" : "text/javascript",
      body: await readFile(new URL(filename, source)),
    });
  });
  await page.goto("http://mero.test/");
  const sections = page.locator("section");
  const second = sections.nth(1);
  for (const section of await sections.all()) {
    assert.equal(await section.getByRole("radio", { name: "Private" }).isChecked(), true);
    assert.equal(await section.locator("details").first().getAttribute("open"), "");
  }
  await second.getByRole("radio", { name: "Team" }).check();
  await second.getByText("Can it run without a build step?").click();
  assert.equal(await sections.first().getByRole("radio", { name: "Private" }).isChecked(), true);
  assert.equal(await sections.first().locator("details").first().getAttribute("open"), "");
  assert.equal(await second.locator("details").first().getAttribute("open"), null);
  assert.equal(await second.getByRole("radio", { name: "Team" }).evaluate(input => new FormData(input.form).get("demo-visibility")), "team");

  const nextPage = second.getByRole("navigation", { name: "Results pages" }).getByRole("button", { name: "2" });
  await nextPage.focus();
  await nextPage.press("Enter");
  await second.getByText("Engineering notes").waitFor();
  await page.waitForFunction(() => document.activeElement?.matches('section:nth-of-type(2) [aria-current="page"]'));
  const nextMonth = second.getByRole("button", { name: "Next month" });
  const nextId = await nextMonth.getAttribute("id");
  const monthResponse = page.waitForResponse(response => new URL(response.url()).pathname === "/demo/catalog/calendar");
  await nextMonth.focus();
  await nextMonth.press("Enter");
  await monthResponse;
  await page.waitForFunction(id => document.activeElement?.id === id && !document.querySelector(".htmx-settling"), nextId);

  await page.setViewportSize({ width: 360, height: 760 });
  const tooltipTrigger = second.getByRole("button", { name: "Publish information" });
  await tooltipTrigger.focus();
  const tooltip = second.getByRole("tooltip");
  const bounds = await tooltip.boundingBox();
  assert.ok(bounds && bounds.x >= 0 && bounds.x + bounds.width <= 360);
  await tooltipTrigger.press("Escape");
  await tooltip.waitFor({ state: "hidden" });
  await second.getByRole("tab", { name: "Overview" }).focus();
  await page.keyboard.press("ArrowRight");
  assert.match(await second.getByRole("tabpanel").innerText(), /invited collaborators/);
  assert.match(await sections.first().getByRole("tabpanel").innerText(), /ready for changes/);
  assert.equal(await second.getByRole("tabpanel").getAttribute("aria-labelledby"), await second.getByRole("tab", { name: "Access" }).getAttribute("id"));
  const trigger = second.getByRole("button", { name: "Workspace details" });
  await trigger.click();
  await second.getByRole("dialog").waitFor();
  await page.evaluate(() => window.MeroUI.toast("Saved inside dialog", { duration: 0 }));
  const dismiss = second.getByRole("dialog").getByRole("button", { name: "Dismiss notification" });
  await dismiss.focus();
  assert.equal(await dismiss.evaluate(el => document.activeElement === el), true);
  await dismiss.press("Enter");
  assert.equal(await second.getByRole("dialog").getByText("Saved inside dialog").count(), 0);
  await page.keyboard.press("Escape");
  await page.waitForFunction(() => document.activeElement?.matches("section:nth-of-type(2) [data-mero-open]"));

  const combo = second.getByRole("combobox", { name: "Workspace" });
  await combo.fill("not-a-workspace");
  await combo.press("Escape");
  await combo.press("ArrowDown");
  assert.equal(await combo.getAttribute("aria-activedescendant"), null);
  await second.getByRole("option", { name: "No workspaces found" }).waitFor();
  assert.equal(await second.locator("[data-mero-active]").count(), 0);
  await combo.fill("missing");
  await second.getByRole("option", { name: "No workspaces found" }).waitFor();
  await combo.press("ArrowDown");
  assert.equal(await combo.getAttribute("aria-activedescendant"), null);
  await combo.fill("offline");
  await second.getByText(/Could not load suggestions/).waitFor();
  await combo.fill("cob");
  await second.getByRole("option", { name: "Cobalt" }).waitFor();
  await combo.press("ArrowDown");
  assert.equal(await second.getByRole("option", { name: "Cobalt" }).getAttribute("aria-selected"), "true");
  await combo.press("Enter");
  assert.equal(await combo.inputValue(), "Cobalt");
  assert.equal(await sections.first().getByRole("combobox").inputValue(), "");

  // The next field can gain focus between native dialog dismissal and Mero's
  // deferred focus restoration. The settled results still belong to that field.
  await trigger.click();
  await second.getByRole("dialog").evaluate(dialog => dialog.addEventListener("close", () => {
    const input = dialog.closest("section").querySelector('[role="combobox"]');
    input.focus();
    input.value = "missing";
    input.dispatchEvent(new Event("input", { bubbles: true }));
  }, { once: true }));
  await page.keyboard.press("Escape");
  await second.getByRole("option", { name: "No workspaces found" }).waitFor();
  assert.equal(await combo.evaluate(input => document.activeElement === input), true);

  // Resolve an older request during the debounce window for a newer query.
  let releaseOld;
  const oldResponse = new Promise(resolve => { releaseOld = resolve; });
  await page.route("**/autocomplete?q=old", async route => {
    await oldResponse;
    return route.fulfill({ contentType: "text/html", body: '<li role="option" id="stale-result">Obsolete result</li>' });
  });
  const oldStart = page.waitForRequest(request => new URL(request.url()).searchParams.get("q") === "old");
  await combo.fill("old");
  await oldStart;
  await page.evaluate(() => {
    window.staleSwap = false;
    document.addEventListener("htmx:after:swap", () => {
      if (document.getElementById("stale-result")) window.staleSwap = true;
    });
  });
  await combo.fill("atlas");
  releaseOld();
  await second.getByRole("option", { name: "Atlas" }).waitFor();
  assert.equal(await page.evaluate(() => window.staleSwap), false);
  await combo.press("Escape");

  await page.getByRole("button", { name: "Insert a copy" }).click();
  await page.waitForFunction(() => document.querySelectorAll("section").length === 3 &&
    new Set([...document.querySelectorAll("[id]")].map(el => el.id)).size === document.querySelectorAll("[id]").length);
  const restoredDraft = sections.first().getByRole("combobox", { name: "Workspace" });
  await restoredDraft.fill("not-a-workspace");
  await restoredDraft.press("Escape");
  await restoredDraft.press("ArrowDown");
  assert.equal(await restoredDraft.getAttribute("aria-activedescendant"), null);
  await sections.first().getByRole("option", { name: "No workspaces found" }).waitFor();
  assert.equal(await sections.first().locator("[data-mero-active]").count(), 0);
  await sections.first().getByRole("tab", { name: "History" }).click();
  assert.match(await sections.first().getByRole("tabpanel").innerText(), /deployment/);
  assert.match(await sections.nth(2).getByRole("tabpanel").innerText(), /invited collaborators/);
  assert.deepEqual(await page.evaluate(() => ["light-preview", "dark-preview"].map(id =>
    getComputedStyle(document.getElementById(id)).getPropertyValue("--mero-surface").trim())), ["#fff", "#1c1c1e"]);
  assert.deepEqual(errors, []);
});

async function localFixture(server, t) {
  await new Promise((resolve, reject) => server.once("error", reject).listen(0, "127.0.0.1", resolve));
  t.after(() => server.close());
  return "http://127.0.0.1:" + server.address().port;
}

test("the downloaded inventory supports validation, save and confirmed delete", browserOptions, async t => {
  const downloadHost = await localFixture(createInventoryExample(), t);
  const archive = await fetch(downloadHost + "/downloads/studio-inventory.tar.gz");
  assert.equal(archive.status, 200);
  const directory = await mkdtemp(join(tmpdir(), "mero-core-browser-"));
  t.after(() => rm(directory, { recursive: true, force: true }));
  const filename = join(directory, "inventory.tar.gz");
  await writeFile(filename, new Uint8Array(await archive.arrayBuffer()));
  await promisify(execFile)("tar", ["xzf", filename, "-C", directory]);
  const extracted = await import(pathToFileURL(join(directory, "examples/studio-inventory/server.mjs")));
  const host = await localFixture(extracted.createInventoryExample(), t);
  const page = await browserPage(t);
  await page.goto(host + "/two");
  const [studio, tenant] = await page.locator("[data-lab]").all();
  const edit = tenant.getByRole("button", { name: "Edit Arc Task Lamp" });
  await edit.click();
  const drawer = tenant.getByRole("dialog", { name: "Edit product" });
  const sku = drawer.getByRole("textbox", { name: "SKU" });
  await sku.fill("RL-1042");
  await drawer.getByRole("button", { name: "Save changes" }).click();
  await drawer.getByText("A product already uses this SKU.").waitFor();
  await page.waitForFunction(() => document.activeElement?.id === "tenant-product-sku");
  assert.equal(await sku.inputValue(), "RL-1042");
  await sku.fill("E2E-7");
  await drawer.getByRole("button", { name: "Save changes" }).click();
  await drawer.waitFor({ state: "hidden" });
  await page.waitForFunction(() => document.activeElement?.id === "tenant-edit-product-6");
  assert.match(await tenant.getByRole("row", { name: /Arc Task Lamp/ }).textContent(), /E2E-7/);
  assert.match(await studio.getByRole("row", { name: /Arc Task Lamp/ }).textContent(), /SL-204/);
  await edit.click();
  await drawer.getByRole("button", { name: "Delete product" }).click();
  const confirm = tenant.getByRole("alertdialog").or(tenant.getByRole("dialog", { name: /Delete Arc Task Lamp/ }));
  await confirm.getByRole("button", { name: "Cancel" }).click();
  await confirm.waitFor({ state: "hidden" });
  await drawer.getByRole("button", { name: "Delete product" }).click();
  await confirm.getByRole("button", { name: "Delete product" }).click();
  await page.waitForFunction(() => document.activeElement?.id === "tenant-add-product");
  assert.equal(await tenant.getByRole("row", { name: /Arc Task Lamp/ }).count(), 0);
  assert.equal(await studio.getByRole("row", { name: /Arc Task Lamp/ }).count(), 1);
});
