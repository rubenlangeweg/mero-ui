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
  "Mero before Alpine": ["/mero.js", "/mero-forms.js", "/mero-live.js", "/alpine.js"],
  "Alpine before Mero": ["/alpine.js", "/mero.js", "/mero-forms.js", "/mero-live.js"],
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
  <button id="inner-morph" type="button" hx-get="/region-inner-morph" hx-target="#island" hx-swap="innerMorph">InnerMorph</button>
  <button id="morph" type="button" hx-get="/region" hx-target="#island" hx-swap="outerMorph">Morph</button>`;
const region = served => `<section id="island" x-data="{ n: 0 }">${regionBody(served)}</section>`;

const pageHtml = scripts => `<!doctype html><html lang="en"><head><title>Mero with Alpine</title>
<script>document.addEventListener('alpine:initialized', () => { window.__alpineReady = true })
window.__native = []; document.addEventListener('mero:action', event => window.__native.push({
  state: event.detail.state, status: event.detail.status, message: event.detail.message,
  id: event.detail.id, hasSource: event.detail.source instanceof Element,
  sameTarget: event.detail.source === event.target,
}))</script>
<script src="/htmx.js"></script><script src="/hx-alpine-compat.js"></script>
${scripts.map(src => `<script defer src="${src}"></script>`).join("")}</head><body>
<main id="app" x-data="{ count: 0, picked: '', choice: '', comboEvent: null, typed: '', show: false, showLive: false, showTeleport: false, tab: null, toggle: null, dialogs: [], dirtyLog: [], local: [], heard: [] }"
  x-on:mero:selection="picked = $event.detail.value"
  x-on:mero:tab="tab = { id: $event.target.id, selected: $event.target.getAttribute('aria-selected'), panelHidden: $event.detail.panel.hidden }"
  @mero:toggle="toggle = { pressed: $event.detail.pressed, attribute: $event.target.getAttribute('aria-pressed') }"
  @mero:select="comboEvent = { value: $event.detail.value, label: $event.detail.label, optionId: $event.detail.option.dataset.id }"
  @mero:dialog.window="dialogs.push({ open: $event.detail.open, id: $event.detail.dialog.id, returnValue: $event.detail.returnValue })"
  @mero:dirty="dirtyLog.push({ dirty: $event.detail.dirty, id: $event.detail.form.id })"
  @mero:action="local.push({ state: $event.detail.state, status: $event.detail.status, message: $event.detail.message, id: $event.detail.id, hasSource: $event.detail.source instanceof Element })"
  @mero:action.window="heard.push({ state: $event.detail.state, status: $event.detail.status, message: $event.detail.message, id: $event.detail.id, hasSource: $event.detail.source instanceof Element })">
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
      <li role="option" aria-selected="false" data-id="proj-1">Atlas</li>
      <li role="option" aria-selected="false" data-id="proj-2" data-value="beacon">Beacon</li>
    </ul>
    <span data-mero-combo-status role="status"></span>
  </div>
  <div data-mero-combo data-mero-combo-remote>
    <input aria-label="Remote project" type="text" role="combobox" aria-expanded="false" aria-controls="remote-combo-options"
      aria-autocomplete="list" autocomplete="off"
      hx-get="/remote-options" hx-trigger="input changed delay:40ms, mero:query" hx-target="#remote-combo-options" hx-swap="innerHTML">
    <ul id="remote-combo-options" role="listbox" aria-label="Remote projects" hidden></ul>
    <span data-mero-combo-status role="status"></span>
  </div>
  <form id="stay" data-mero-form hx-post="/save" hx-swap="none"><button>Save</button></form>
  <div id="gone-region"><form id="gone" data-mero-form hx-post="/replace" hx-target="#gone-region" hx-swap="innerHTML"><button>Replace form</button></form></div>
  <form id="invalid" data-mero-form hx-post="/invalid" hx-swap="outerHTML"><button>Validate</button></form>
  <div id="action-row">
    <button id="act-reject" type="button" data-mero-action hx-post="/act-reject" hx-swap="none">Reject action</button>
    <button id="act-unknown" type="button" data-mero-action hx-post="/act-unknown" hx-swap="none">Unknown action</button>
    <button id="act-gone" type="button" data-mero-action hx-post="/replace" hx-target="#action-row" hx-swap="outerHTML">Swap action</button>
    <span data-mero-action-status role="status"></span>
  </div>
  <form id="dirty" data-mero-dirty>
    <input id="dirty-name" name="name" value="a" aria-label="Name" x-ref="name">
    <fieldset id="branch" data-mero-show-when="name=b" hidden disabled><legend>Only for b</legend></fieldset>
    <button id="apply">Apply</button>
  </form>
  <button id="write" type="button" @click="$refs.name.value = 'b'">Write</button>
  <button id="tell" type="button" @click="$refs.name.dispatchEvent(new Event('change', { bubbles: true }))">Tell</button>
  <button id="open-dlg" type="button" data-mero-open="alpine-dialog">Open dialog</button>
  <dialog id="alpine-dialog">
    <p>Dialog body</p>
    <button id="close-dlg" type="button" data-mero-close="confirmed">Close dialog</button>
  </dialog>
  <template x-if="show">
    <div id="late-block">
      ${tabs("late", false)}
      <form id="late-dirty" data-mero-dirty>
        <input id="late-input" name="title" value="one" aria-label="Late title">
        <fieldset id="late-branch" data-mero-show-when="title=two"><legend>Late branch</legend></fieldset>
        <button id="late-save">Late save</button>
      </form>
    </div>
  </template>
  <template x-if="showLive">
    <div id="late-live-wrap">
      <div id="late-live" data-mero-live="60" hx-get="/live-tick" hx-trigger="mero:refresh" hx-target="find [data-mero-live-status]">
        <div data-mero-live-status>Queued</div>
        <span data-mero-live-error></span>
        <button type="button" data-mero-live-retry hidden>Retry</button>
      </div>
    </div>
  </template>
  <template x-teleport="body">
    <dialog id="teleported-dialog" x-show="showTeleport">
      <p>Teleported</p>
      <button id="close-teleported" type="button" data-mero-close="done">Done</button>
    </dialog>
  </template>
</main>
${region(1)}</body></html>`;

const files = {
  "/htmx.js": "public/vendor/htmx.min.js",
  "/hx-alpine-compat.js": "node_modules/htmx.org/dist/ext/hx-alpine-compat.js",
  "/mero.js": "ui/mero.js",
  "/mero-forms.js": "ui/mero-forms.js",
  "/mero-live.js": "ui/mero-live.js",
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
      let remoteHits = 0;
      let liveHits = 0;
      page.on("pageerror", error => errors.push(error.message));
      page.on("console", message => { if (/Alpine (Warning|Expression Error)/.test(message.text())) errors.push(message.text()); });
      await page.route("http://mero.test/**", async route => {
        const { pathname } = new URL(route.request().url());
        const html = body => route.fulfill({ contentType: "text/html", body });
        if (pathname === "/") return html(pageHtml(scripts));
        if (pathname === "/save") return html("");
        if (pathname === "/replace") return html('<p id="replaced">Saved</p>');
        if (pathname === "/invalid") return route.fulfill({ status: 422, contentType: "text/html", body: '<form id="invalid" data-mero-form hx-post="/invalid" hx-swap="outerHTML"><p id="invalid-error">Fix the name</p><button>Validate</button></form>' });
        if (pathname === "/act-reject") return route.fulfill({ status: 403, headers: { "Content-Type": "text/html", "Mero-Action-Message": "Forbidden" }, body: "" });
        if (pathname === "/act-unknown") return route.fulfill({ status: 503, contentType: "text/html", body: "" });
        if (pathname === "/remote-options") {
          remoteHits += 1;
          return html('<li id="ro-1" role="option" aria-selected="false" data-id="rem-1">Mercury</li>');
        }
        if (pathname === "/live-tick") {
          liveHits += 1;
          return html(`<span>Tick ${liveHits}</span>`);
        }
        if (pathname === "/region") return html(region(4));
        if (pathname === "/region-inner") return html(regionBody(2));
        if (pathname === "/region-inner-morph") return html(regionBody(3));
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
      const resetActions = () => page.evaluate(() => {
        const state = window.Alpine.$data(document.querySelector("#app"));
        state.heard = [];
        state.local = [];
      });

      await t.test("a: the pinned Alpine build runs", async () => {
        assert.equal(await page.evaluate(() => window.Alpine.version), build.version);
      });

      await t.test("b: x-on:mero:selection on an x-data ancestor receives detail.value", async () => {
        await page.getByRole("option", { name: "Beacon" }).first().click();
        assert.equal((await data()).picked, "beacon");
      });

      await t.test("c: mero:action identifies its source on forms and action buttons across succeeded, rejected, unknown and swapped-away outcomes", async () => {
        const pending = id => ({ state: "pending", id, hasSource: true });
        const settled = (id, state, status, message = null) => ({ state, status, message, id, hasSource: true });
        await page.getByRole("button", { name: "Save" }).click();
        await page.waitForFunction(() => window.Alpine.$data(document.querySelector("#app")).heard.length === 2);
        let state = await data();
        assert.deepEqual(state.heard, [pending("stay"), settled("stay", "succeeded", 200)]);
        assert.deepEqual(state.local, state.heard, "a form that stays reports both steps on itself");

        await resetActions();
        await page.getByRole("button", { name: "Replace form" }).click();
        await page.locator("#replaced").waitFor();
        await page.waitForFunction(() => window.Alpine.$data(document.querySelector("#app")).heard.length === 2);
        state = await data();
        assert.deepEqual(state.heard, [pending("gone"), settled("gone", "succeeded", 200)], "a window listener identifies a swapped-out form by id and source");
        assert.deepEqual(state.local, [pending("gone")], "an element listener misses the final step of a form the swap removed");
        const nativeFinal = (await page.evaluate(() => window.__native)).at(-1);
        assert.equal(nativeFinal.id, "gone");
        assert.equal(nativeFinal.hasSource, true);
        assert.equal(nativeFinal.sameTarget, false, "final event fell back to document while keeping source");

        await resetActions();
        await page.getByRole("button", { name: "Validate" }).click();
        await page.locator("#invalid-error").waitFor();
        await page.waitForFunction(() => window.Alpine.$data(document.querySelector("#app")).heard.length === 2);
        state = await data();
        assert.deepEqual(state.local, [pending("invalid"), settled("invalid", "rejected", 422)], "an ancestor hears the final step from the replacement form");
        assert.deepEqual(state.heard, state.local);

        await resetActions();
        await page.getByRole("button", { name: "Reject action" }).click();
        await page.waitForFunction(() => window.Alpine.$data(document.querySelector("#app")).heard.length === 2);
        state = await data();
        assert.deepEqual(state.local, [pending("act-reject"), settled("act-reject", "rejected", 403, "Forbidden")]);

        await resetActions();
        await page.getByRole("button", { name: "Unknown action" }).click();
        await page.waitForFunction(() => window.Alpine.$data(document.querySelector("#app")).heard.length === 2);
        state = await data();
        assert.equal(state.local[0].id, "act-unknown");
        assert.equal(state.local[1].state, "unknown");
        assert.equal(state.local[1].status, 503);
        assert.equal(state.local[1].id, "act-unknown");

        await resetActions();
        await page.getByRole("button", { name: "Swap action" }).click();
        await page.waitForFunction(() => window.Alpine.$data(document.querySelector("#app")).heard.length === 2);
        state = await data();
        assert.equal(state.local.length, 1);
        assert.equal(state.heard[1].state, "succeeded");
        assert.equal(state.heard[1].id, "act-gone");
        assert.equal(state.heard[1].hasSource, true);
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

      await t.test("e: combobox emits mero:select and updates x-model.lazy without re-querying remote options", async () => {
        const combo = page.getByRole("combobox", { name: "Project", exact: true });
        await combo.fill("Be");
        await page.locator("#combo-options").getByRole("option", { name: "Beacon" }).click();
        assert.equal(await combo.inputValue(), "beacon");
        const state = await data();
        assert.equal(state.choice, "beacon");
        assert.deepEqual(state.comboEvent, { value: "beacon", label: "Beacon", optionId: "proj-2" });
        assert.equal(state.typed, "Be", "choosing fires change and mero:select, not input");

        const remote = page.getByRole("combobox", { name: "Remote project" });
        await remote.fill("Mer");
        await page.locator("#remote-combo-options").getByRole("option", { name: "Mercury" }).waitFor();
        const hitsBefore = remoteHits;
        await page.locator("#remote-combo-options").getByRole("option", { name: "Mercury" }).click();
        assert.equal(await remote.inputValue(), "Mercury");
        await page.waitForTimeout(120);
        assert.equal(remoteHits, hitsBefore, "selecting a remote option never triggers a redundant search");
        assert.equal(await page.locator("#remote-combo-options").isHidden(), true);
      });

      await t.test("f: Mero initialises swapped tabs and Alpine state survives innerHTML, innerMorph and outerMorph swaps", async () => {
        await page.locator("#n").click({ clickCount: 3 });
        for (const [button, count] of [["#inner", "2"], ["#inner-morph", "3"], ["#morph", "4"]]) {
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

      await t.test("g: MeroUI.init sets up tabs, forms and live polling inserted by x-if, and MeroUI.cleanup stops live polls", async () => {
        await page.evaluate(() => { window.Alpine.$data(document.querySelector("#app")).show = true; });
        await page.locator("#late-block").waitFor();
        assert.equal(await page.locator("#late").getAttribute("data-mero-tabs-ready"), null, "Mero does not watch Alpine's insertions");
        assert.equal(await page.locator("#late-save").isDisabled(), false, "late dirty form is not initialized before MeroUI.init");
        const html = () => page.locator("#late").evaluate(node => node.outerHTML);
        await page.evaluate(() => window.MeroUI.init(document.querySelector("#late-block")));
        assert.equal(await page.locator("#late").getAttribute("data-mero-tabs-ready"), "");
        assert.equal(await tab("late-tab-one").getAttribute("aria-selected"), "true");
        assert.equal(await tab("late-panel-two").isHidden(), true);
        assert.equal(await page.locator("#late-save").isDisabled(), true, "MeroUI.init initializes data-mero-dirty");
        assert.equal(await page.locator("#late-branch").isHidden(), true, "MeroUI.init initializes data-mero-show-when");
        await selectsSecondTab("late");
        assert.equal((await data()).tab.id, "late-tab-two");
        const once = await html();
        await page.evaluate(() => window.MeroUI.init(document.querySelector("#late-block")));
        assert.equal(await html(), once, "a second init keeps the tab the person selected");
        assert.deepEqual((await data()).dirtyLog, [], "init never emits mero:dirty");

        liveHits = 0;
        await page.evaluate(() => { window.Alpine.$data(document.querySelector("#app")).showLive = true; });
        await page.locator("#late-live").waitFor();
        await page.evaluate(() => {
          const wrap = document.querySelector("#late-live-wrap");
          window.MeroUI.init(wrap);
        });
        await page.waitForFunction(() => document.querySelector("#late-live [data-mero-live-status]")?.textContent.includes("Tick"));
        await page.evaluate(() => {
          window.MeroUI.cleanup(document.querySelector("#late-live-wrap"));
          window.Alpine.$data(document.querySelector("#app")).showLive = false;
        });
        const hitsAfterCleanup = liveHits;
        await page.waitForTimeout(180);
        assert.equal(liveHits, hitsAfterCleanup, "MeroUI.cleanup stops polling immediately");
      });

      await t.test("h: mero:dirty fires on transitions, including after Alpine writes + bubbling change", async () => {
        assert.equal(await page.locator("#apply").isDisabled(), true);
        await page.locator("#write").click();
        assert.equal(await page.locator("#dirty-name").inputValue(), "b");
        assert.equal(await page.locator("#apply").isDisabled(), true, "a programmatic write fires no event");
        assert.equal(await page.locator("#branch").isHidden(), true);
        assert.deepEqual((await data()).dirtyLog, []);
        await page.locator("#tell").click();
        assert.equal(await page.locator("#apply").isDisabled(), false);
        assert.equal(await page.locator("#branch").isVisible(), true);
        assert.equal(await page.locator("#branch").isDisabled(), false);
        assert.deepEqual((await data()).dirtyLog, [{ dirty: true, id: "dirty" }]);
        await page.locator("#dirty-name").fill("a");
        assert.deepEqual((await data()).dirtyLog, [{ dirty: true, id: "dirty" }, { dirty: false, id: "dirty" }]);
      });

      await t.test("i: mero:dialog bubbles from standard and x-teleport dialogs, and preserveToasts keeps feedback visible", async () => {
        await page.locator("#open-dlg").click();
        await page.locator("#alpine-dialog[open]").waitFor();
        await page.evaluate(() => window.MeroUI.toast("Recovered cleanly", { duration: 0, trigger: document.querySelector("#close-dlg") }));
        await page.locator("#alpine-dialog .mero-toast", { hasText: "Recovered cleanly" }).waitFor();
        await page.evaluate(() => window.MeroUI.close("alpine-dialog", { value: "saved", preserveToasts: true }));
        await page.locator("body > .mero-toast-region .mero-toast", { hasText: "Recovered cleanly" }).waitFor();

        await page.evaluate(() => {
          window.Alpine.$data(document.querySelector("#app")).showTeleport = true;
          window.MeroUI.open("teleported-dialog");
        });
        await page.locator("#teleported-dialog[open]").waitFor();
        await page.locator("#close-teleported").click();
        await page.waitForFunction(() => window.Alpine.$data(document.querySelector("#app")).dialogs.length === 4);
        assert.deepEqual((await data()).dialogs, [
          { open: true, id: "alpine-dialog", returnValue: "" },
          { open: false, id: "alpine-dialog", returnValue: "saved" },
          { open: true, id: "teleported-dialog", returnValue: "" },
          { open: false, id: "teleported-dialog", returnValue: "done" },
        ]);
      });

      await t.test("j: no page error and no Alpine warning during the cases above", () => {
        assert.deepEqual(errors, []);
      });
    });
}
