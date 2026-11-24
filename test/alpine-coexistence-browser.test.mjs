import { browserConfig } from "../scripts/browser-config.mjs";
import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const playwright = await import(browserConfig.playwrightModule || "playwright").catch(error => {
  if (error.code === "ERR_MODULE_NOT_FOUND" && !browserConfig.playwrightModule) return null;
  throw error;
});
const source = new URL("../", import.meta.url);
const packages = JSON.parse(await readFile(new URL("package.json", source), "utf8")).devDependencies;
// The floor is the oldest Alpine Mero is tested with; the current pin is bumped by hand.
const builds = ["alpinejs-floor", "alpinejs-current"].map(name => ({ name, version: packages[name].split("@").at(-1) }));
const orders = {
  "Mero before Alpine": ["/mero.js", "/mero-forms.js", "/alpine.js"],
  "Alpine before Mero": ["/alpine.js", "/mero.js", "/mero-forms.js"],
};

const tabs = (prefix, selected = true) => `<div data-mero-tabs id="${prefix}">
  <div role="tablist" aria-label="${prefix}">
    <button type="button" role="tab" id="${prefix}-tab-one" aria-controls="${prefix}-panel-one"${selected ? ' aria-selected="true"' : ""}>One</button>
    <button type="button" role="tab" id="${prefix}-tab-two" aria-controls="${prefix}-panel-two"${selected ? ' aria-selected="false" tabindex="-1"' : ""}>Two</button>
  </div>
  <div role="tabpanel" id="${prefix}-panel-one" aria-labelledby="${prefix}-tab-one">First</div>
  <div role="tabpanel" id="${prefix}-panel-two" aria-labelledby="${prefix}-tab-two"${selected ? " hidden" : ""}>Second</div>
</div>`;

// served numbers each response so a test can wait for the swap it asked for. The tabs
// carry no state, so a selected tab after a swap proves Mero initialised the new content.
const regionBody = served => `<span id="served">${served}</span>
  <button id="n" type="button" @click="n++" x-text="n"></button>
  ${tabs("region", false)}
  <button id="inner" type="button" hx-get="/region-inner" hx-target="#island" hx-swap="innerHTML">Replace</button>
  <button id="morph" type="button" hx-get="/region" hx-target="#island" hx-swap="outerMorph">Morph</button>`;
const region = served => `<section id="island" x-data="{ n: 0 }">${regionBody(served)}</section>`;

const pageHtml = scripts => `<!doctype html><html lang="en"><head><title>Mero with Alpine</title>
<script>document.addEventListener('alpine:initialized', () => { window.__alpineReady = true })</script>
<script src="/htmx.js"></script><script src="/hx-alpine-compat.js"></script>
${scripts.map(src => `<script defer src="${src}"></script>`).join("")}</head><body>
<main id="app" x-data="{ count: 0, picked: '', choice: '', typed: '', show: false, tab: null, toggle: null, local: [], heard: [] }"
  x-on:mero:selection="picked = $event.detail.value"
  x-on:mero:tab="tab = { id: $event.target.id, selected: $event.target.getAttribute('aria-selected'), panelHidden: $event.detail.panel.hidden }"
  @mero:toggle="toggle = { pressed: $event.detail.pressed, attribute: $event.target.getAttribute('aria-pressed') }"
  @mero:action="local.push($event.detail)"
  @mero:action.window="heard.push($event.detail)">
  <button id="count" type="button" @click="count++" x-text="count"></button>
  <ul role="listbox" aria-label="Workspace" data-mero-listbox>
    <li role="option" aria-selected="true" tabindex="0">Atlas</li>
    <li role="option" aria-selected="false" tabindex="-1" data-value="beacon">Beacon</li>
  </ul>
  ${tabs("main")}
  <button id="toggle" type="button" aria-pressed="false" data-mero-toggle>Pin</button>
  <div data-mero-combo>
    <input aria-label="Project" type="text" role="combobox" aria-expanded="false" aria-controls="combo-options"
      aria-autocomplete="list" autocomplete="off" x-model.lazy="choice" @input="typed = $event.target.value">
    <ul id="combo-options" role="listbox" aria-label="Projects" hidden>
      <li role="option" aria-selected="false">Atlas</li>
      <li role="option" aria-selected="false">Beacon</li>
    </ul>
    <span data-mero-combo-status role="status"></span>
  </div>
  <form id="stay" data-mero-form hx-post="/save" hx-swap="none"><button>Save</button></form>
  <div id="gone-region"><form id="gone" data-mero-form hx-post="/replace" hx-target="#gone-region" hx-swap="innerHTML"><button>Replace form</button></form></div>
  <form id="dirty" data-mero-dirty>
    <input id="dirty-name" name="name" value="a" aria-label="Name" x-ref="name">
    <fieldset id="branch" data-mero-show-when="name=b" hidden disabled><legend>Only for b</legend></fieldset>
    <button id="apply">Apply</button>
  </form>
  <button id="write" type="button" @click="$refs.name.value = 'b'">Write</button>
  <button id="tell" type="button" @click="$refs.name.dispatchEvent(new Event('change', { bubbles: true }))">Tell</button>
  <template x-if="show">${tabs("late", false)}</template>
</main>
${region(1)}</body></html>`;

const files = {
  "/htmx.js": "public/vendor/htmx.min.js",
  "/hx-alpine-compat.js": "node_modules/htmx.org/dist/ext/hx-alpine-compat.js",
  "/mero.js": "ui/mero.js",
  "/mero-forms.js": "ui/mero-forms.js",
};

for (const build of builds) for (const [order, scripts] of Object.entries(orders)) {
  test(`Mero and Alpine ${build.version} share a page, ${order}`,
    { skip: !playwright && "Install Playwright to run the browser regression" }, async t => {
      const engine = browserConfig.engine || "chromium";
      const browser = await playwright[engine].launch({ executablePath: engine === "chromium" ? browserConfig.chromeExecutable : undefined });
      t.after(() => browser.close());
      const page = await browser.newPage();
      page.setDefaultTimeout(5000);
      const errors = [];
      page.on("pageerror", error => errors.push(error.message));
      page.on("console", message => { if (/Alpine (Warning|Expression Error)/.test(message.text())) errors.push(message.text()); });
      await page.route("http://mero.test/**", async route => {
        const { pathname } = new URL(route.request().url());
        const html = body => route.fulfill({ contentType: "text/html", body });
        if (pathname === "/") return html(pageHtml(scripts));
        if (pathname === "/save") return html("");
        if (pathname === "/replace") return html('<p id="replaced">Saved</p>');
        if (pathname === "/region") return html(region(3));
        if (pathname === "/region-inner") return html(regionBody(2));
        const filename = pathname === "/alpine.js" ? `node_modules/${build.name}/dist/cdn.min.js` : files[pathname];
        if (!filename) return route.fulfill({ status: 404, body: "" });
        return route.fulfill({ contentType: "text/javascript", body: await readFile(new URL(filename, source)) });
      });
      await page.goto("http://mero.test/");
      await page.waitForFunction(() => window.__alpineReady && window.MeroUI);
      const data = () => page.evaluate(() => JSON.parse(JSON.stringify(window.Alpine.$data(document.querySelector("#app")))));
      const tab = name => page.locator("#" + name);
      const selectsSecondTab = async prefix => {
        await tab(prefix + "-tab-two").click();
        assert.equal(await tab(prefix + "-tab-two").getAttribute("aria-selected"), "true");
        assert.equal(await tab(prefix + "-tab-one").getAttribute("aria-selected"), "false");
        assert.equal(await tab(prefix + "-tab-one").getAttribute("tabindex"), "-1");
        assert.equal(await tab(prefix + "-panel-one").isHidden(), true);
        assert.equal(await tab(prefix + "-panel-two").isVisible(), true);
      };

      await t.test("a: the pinned Alpine build runs", async () => {
        assert.equal(await page.evaluate(() => window.Alpine.version), build.version);
      });

      await t.test("b: x-on:mero:selection on an x-data ancestor receives detail.value", async () => {
        await page.getByRole("option", { name: "Beacon" }).first().click();
        assert.equal((await data()).picked, "beacon");
      });

      await t.test("c: mero:action reaches .window listeners; a removed form is heard only there", async () => {
        const settled = { state: "succeeded", status: 200, message: null };
        await page.getByRole("button", { name: "Save" }).click();
        await page.waitForFunction(() => window.Alpine.$data(document.querySelector("#app")).heard.length === 2);
        let state = await data();
        assert.deepEqual(state.heard, [{ state: "pending" }, settled]);
        assert.deepEqual(state.local, state.heard, "a form that stays reports both steps on itself");

        await page.evaluate(() => { const state = window.Alpine.$data(document.querySelector("#app")); state.heard = []; state.local = []; });
        await page.getByRole("button", { name: "Replace form" }).click();
        await page.locator("#replaced").waitFor();
        await page.waitForFunction(() => window.Alpine.$data(document.querySelector("#app")).heard.length === 2);
        state = await data();
        // The final event is dispatched on document and carries no source identity.
        assert.deepEqual(state.heard, [{ state: "pending" }, settled]);
        assert.deepEqual(state.local, [{ state: "pending" }], "an element listener misses the final step of a form the swap removed");
      });

      await t.test("d: Mero writes tab and toggle state without touching Alpine state, and Alpine hears the updated state", async () => {
        await page.locator("#count").click({ clickCount: 2 });
        await selectsSecondTab("main");
        await page.locator("#toggle").click();
        const state = await data();
        assert.equal(state.count, 2);
        assert.equal(await page.locator("#count").textContent(), "2");
        assert.deepEqual(state.tab, { id: "main-tab-two", selected: "true", panelHidden: false });
        assert.deepEqual(state.toggle, { pressed: true, attribute: "true" });
      });

      await t.test("e: x-model.lazy on a combobox input receives the chosen option", async () => {
        const combo = page.getByRole("combobox", { name: "Project" });
        await combo.fill("At");
        await page.locator("#combo-options").getByRole("option", { name: "Atlas" }).click();
        assert.equal(await combo.inputValue(), "Atlas");
        const state = await data();
        assert.equal(state.choice, "Atlas");
        assert.equal(state.typed, "At", "choosing fires change, not input, so a plain x-model keeps the typed text");
      });

      await t.test("f: Mero initialises swapped tabs and Alpine state survives an innerHTML swap and an outerMorph swap", async () => {
        await page.locator("#n").click({ clickCount: 3 });
        for (const [button, count] of [["#inner", "2"], ["#morph", "3"]]) {
          await selectsSecondTab("region");
          await page.locator(button).click();
          await page.locator("#served").getByText(count, { exact: true }).waitFor();
          await page.locator("#region[data-mero-tabs-ready] #region-tab-one[aria-selected=true]").waitFor();
          assert.equal(await tab("region-panel-two").isHidden(), true, "Mero initialises the swapped tabs");
          await page.locator("#island[x-data] #n").getByText("3", { exact: true }).waitFor();
        }
        await selectsSecondTab("region");
        await page.locator("#n").click();
        assert.equal(await page.locator("#n").textContent(), "4");
      });

      await t.test("g: tabs rendered by x-if work after MeroUI.init(el), and a second init changes nothing", async () => {
        await page.evaluate(() => { window.Alpine.$data(document.querySelector("#app")).show = true; });
        await page.locator("#late").waitFor();
        assert.equal(await page.locator("#late").getAttribute("data-mero-tabs-ready"), null, "Mero does not watch Alpine's insertions");
        const html = () => page.locator("#late").evaluate(node => node.outerHTML);
        await page.evaluate(() => window.MeroUI.init(document.querySelector("#late")));
        assert.equal(await page.locator("#late").getAttribute("data-mero-tabs-ready"), "");
        assert.equal(await tab("late-tab-one").getAttribute("aria-selected"), "true");
        assert.equal(await tab("late-panel-two").isHidden(), true);
        const once = await html();
        await page.evaluate(() => window.MeroUI.init(document.querySelector("#late")));
        assert.equal(await html(), once);
        await selectsSecondTab("late");
        assert.equal((await data()).tab.id, "late-tab-two");
      });

      await t.test("h: a value Alpine writes reaches data-mero-dirty and data-mero-show-when only after a bubbling change", async () => {
        assert.equal(await page.locator("#apply").isDisabled(), true);
        await page.locator("#write").click();
        assert.equal(await page.locator("#dirty-name").inputValue(), "b");
        assert.equal(await page.locator("#apply").isDisabled(), true, "a programmatic write fires no event");
        assert.equal(await page.locator("#branch").isHidden(), true);
        await page.locator("#tell").click();
        assert.equal(await page.locator("#apply").isDisabled(), false);
        assert.equal(await page.locator("#branch").isVisible(), true);
        assert.equal(await page.locator("#branch").isDisabled(), false);
      });

      await t.test("a: no page error and no Alpine warning during the cases above", () => {
        assert.deepEqual(errors, []);
      });
    });
}
