import { browserConfig } from "../scripts/browser-config.mjs";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const root = new URL("../", import.meta.url);
const playwright = await import(browserConfig.playwrightModule || "playwright").catch(error => {
  if (error.code === "ERR_MODULE_NOT_FOUND" && !browserConfig.playwrightModule) return null;
  throw error;
});

test("v0.13 primitives & peer-review regressions: multiselect, 3-state dirty/guard, passwords, 409 focus/source, dialog reopen and live init/backoff",
  { skip: !playwright && "Install Playwright to run the browser regression" }, async t => {
    const engine = browserConfig.engine || "chromium";
    const browser = await playwright[engine].launch({ executablePath: engine === "chromium" ? browserConfig.chromeExecutable : undefined });
    t.after(() => browser.close());
    const page = await browser.newPage({ reducedMotion: "reduce" });
    page.setDefaultTimeout(5000);
    const errors = [];
    page.on("pageerror", err => errors.push(err.message));

    const assets = {
      "/mero.css": ["text/css", "ui/mero.css"],
      "/mero.js": ["text/javascript", "ui/mero.js"],
      "/mero-forms.js": ["text/javascript", "ui/mero-forms.js"],
      "/mero-live.js": ["text/javascript", "ui/mero-live.js"],
      "/htmx.js": ["text/javascript", "public/vendor/htmx.min.js"],
    };

    const editMain = `<main id="main">
      <form id="edit-form" data-mero-form data-mero-dirty data-mero-dirty-guard="Unsaved draft!" data-mero-clear-passwords data-mero-conflict-swap
            hx-post="/save" hx-target="this" hx-swap="outerHTML">
        <input id="title" name="title" value="Lamp" aria-label="Title">
        <input id="hidden-rev" type="hidden" name="rev" value="1">
        <input id="pwd" type="password" name="secret" value="" aria-label="Password">
        <select id="implicit-select" name="tier" aria-label="Tier">
          <option value="std">Standard</option>
          <option value="pro">Pro</option>
        </select>
        <select id="mode" name="mode" aria-label="Mode">
          <option value="" selected>Empty</option>
          <option value="scheduled">Scheduled</option>
          <option value="manual">Manual</option>
        </select>
        <fieldset id="is-empty" data-mero-show-when="mode=">
          <input id="empty-note" name="emptyNote" value="a" aria-label="Empty note">
        </fieldset>
        <fieldset id="not-empty" data-mero-show-when="mode!=" hidden disabled>
          <input id="non-empty-note" name="nonEmptyNote" value="b" aria-label="Non-empty note">
        </fieldset>
        <div id="keep-enabled" data-mero-show-when="mode=manual" data-mero-show-when-keep-enabled hidden>
          <input id="kept-input" name="kept" value="preserved" aria-label="Kept">
        </div>
        <div id="channels" class="mero-multiselect" data-mero-multiselect data-mero-combo data-mero-multiselect-name="channels">
          <div class="mero-multiselect-control">
            <ul class="mero-tag-group mero-multiselect-chips" data-mero-multiselect-chips>
              <li class="mero-chip" data-value="web">Web<input type="hidden" name="channels" value="web"><button type="button" aria-label="Remove Web" data-mero-multiselect-remove>×</button></li>
            </ul>
            <input id="ch-input" name="search_unused" class="mero-multiselect-input" type="text" role="combobox" aria-label="Channels"
                   aria-expanded="false" aria-controls="ch-list" aria-autocomplete="list" autocomplete="off">
          </div>
          <ul id="ch-list" class="mero-listbox mero-combo-list" role="listbox" aria-multiselectable="true" hidden>
            <li id="opt-web" role="option" data-value="web" aria-selected="true">Web</li>
            <li id="opt-b2b" role="option" data-value="b2b" aria-selected="false">B2B</li>
            <li id="opt-pos" role="option" data-value="pos" aria-selected="false">POS</li>
          </ul>
          <span data-mero-combo-status role="status"></span>
        </div>
        <p data-mero-form-error hidden></p>
        <button id="save-btn" type="submit">Save</button>
        <a id="in-form-leave" href="/away">Back inside form</a>
      </form>
      <div id="live-slot"></div>
      <dialog id="dlg-1" class="mero-dialog"><p>Dialog 1</p></dialog>
      <dialog id="dlg-2" class="mero-dialog"><p>Dialog 2</p></dialog>
    </main>`;

    const shell = main => `<!doctype html><html lang="en"><head>
      <link rel="stylesheet" href="/mero.css">
      <script src="/htmx.js"></script>
      <script defer src="/mero.js"></script>
      <script defer src="/mero-forms.js"></script>
      <script defer src="/mero-live.js"></script>
    </head><body hx-boost:inherited="true">
      <a id="leave-link" href="/away">Leave page</a>
      ${main}
    </body></html>`;

    let saveMode = "saved";
    let saveArrived = null;
    let releaseSave = null;
    let awayHits = 0;
    const liveResponses = [
      { status: 503, body: "err1" },
      { status: 503, body: "err2" },
      { status: 200, headers: { "Mero-Live-Interval": "5000" }, body: "<span>Running</span>" },
      { status: 200, headers: { "Mero-Live": "done" }, body: "<span>Done</span>" },
    ];
    let liveHits = 0;

    await page.route("http://mero.test/**", async route => {
      const { pathname } = new URL(route.request().url());
      if (pathname === "/list") return route.fulfill({ contentType: "text/html", body: shell(`<main id="main"><a id="go-edit" href="/edit">Open edit</a></main>`) });
      if (pathname === "/edit") return route.fulfill({ contentType: "text/html", body: shell(editMain) });
      if (assets[pathname]) {
        const [contentType, file] = assets[pathname];
        return route.fulfill({ contentType, body: await readFile(new URL(file, root)) });
      }
      if (pathname === "/away") {
        awayHits += 1;
        return route.fulfill({ contentType: "text/html", body: shell(`<main id="main"><p id="away-page">Away</p></main>`) });
      }
      if (pathname === "/save") {
        if (saveMode === "delayed-saved") {
          saveArrived?.();
          await new Promise(resolve => { releaseSave = resolve; });
        }
        if (saveMode === "conflict") {
          return route.fulfill({
            status: 409,
            contentType: "text/html",
            body: `<form id="edit-form" data-mero-form data-mero-dirty="dirty" data-mero-conflict-swap hx-post="/save" hx-target="this" hx-swap="outerHTML">
              <input id="invalid-first" aria-invalid="true" value="bad">
              <div id="conflict-banner">Someone else updated this record.</div>
              <button id="conflict-merge" type="button" data-mero-conflict-focus>Review conflict</button>
              <p data-mero-form-error hidden></p>
              <button id="save-btn" type="submit">Overwrite</button>
            </form>`,
          });
        }
        return route.fulfill({
          status: 200,
          headers: { "Content-Type": "text/html", "HX-Reswap": "none", "HX-Trigger": JSON.stringify({ "mero:form-saved": { message: "Saved!" } }) },
          body: "",
        });
      }
      if (pathname === "/live") {
        liveHits += 1;
        const next = liveResponses.shift() ?? { status: 200, headers: { "Mero-Live": "done" }, body: "<span>Done</span>" };
        return route.fulfill({ contentType: "text/html", ...next });
      }
      return route.fulfill({ status: 404, body: "" });
    });

    // Navigate /list -> /edit via boosted link so Back button has a real history entry to traverse.
    await page.goto("http://mero.test/list");
    await page.waitForFunction(() => Boolean(window.MeroUI && window.htmx));
    await page.locator("#go-edit").click();
    await page.locator("#edit-form").waitFor();

    await page.evaluate(() => {
      window.selections = [];
      window.actions = [];
      window.originalForm = document.getElementById("edit-form");
      document.addEventListener("mero:selection", e => window.selections.push({ values: e.detail.values, added: e.detail.added, removed: e.detail.removed }));
      document.addEventListener("mero:action", e => window.actions.push({ state: e.detail.state, status: e.detail.status, sameSource: e.detail.source === window.originalForm, id: e.detail.id }));
      window.confirmCalls = [];
      window.confirmAnswer = false;
      window.confirm = text => { window.confirmCalls.push(text); return window.confirmAnswer; };
    });

    // 1. Untouched select (no explicit `selected` attribute) stays clean.
    assert.equal(await page.locator("#save-btn").isDisabled(), true, "untouched implicit select must not mark form dirty");

    // 2. show-when empty comparison (mode= and mode!=), keep-enabled, and dynamically inserted fieldset init.
    assert.equal(await page.locator("#is-empty").isVisible(), true, "mode= shows when mode is empty");
    assert.equal(await page.locator("#not-empty").isHidden(), true, "mode!= hides when mode is empty");
    assert.equal(await page.locator("#keep-enabled").isHidden(), true);
    assert.equal(await page.locator("#kept-input").isDisabled(), false, "keep-enabled keeps hidden input enabled");

    // Insert a conditional fieldset inside the existing form and call MeroUI.init(branch).
    await page.evaluate(() => {
      const fs = document.createElement("fieldset");
      fs.id = "dynamic-branch";
      fs.setAttribute("data-mero-show-when", "mode=manual");
      fs.innerHTML = '<input id="dyn-in" name="dyn" value="1">';
      document.getElementById("edit-form").append(fs);
      window.MeroUI.init(fs);
    });
    assert.equal(await page.locator("#dynamic-branch").isHidden(), true, "MeroUI.init(branch) evaluates ancestor form show-when");
    assert.equal(await page.locator("#dynamic-branch").evaluate(el => el.disabled), true);
    assert.equal(await page.locator("#dyn-in").isDisabled(), true);

    await page.locator("#mode").selectOption("scheduled");
    assert.equal(await page.locator("#is-empty").isHidden(), true);
    assert.equal(await page.locator("#not-empty").isVisible(), true);
    assert.equal(await page.locator("#save-btn").isDisabled(), false);
    await page.locator("#mode").selectOption("");
    assert.equal(await page.locator("#save-btn").isDisabled(), true, "back to clean");

    // 3. Multi-select: arrow focus keeps aria-selected accurate, ignores search input name, resets on form.reset().
    const chInput = page.locator("#ch-input");
    await chInput.focus();
    await chInput.press("ArrowDown");
    await chInput.press("ArrowDown");
    assert.equal(await chInput.getAttribute("aria-activedescendant"), "opt-b2b");
    assert.equal(await page.locator("#opt-b2b").getAttribute("aria-selected"), "false", "arrowing must not mark unselected option as aria-selected=true");
    assert.equal(await page.locator("#opt-web").getAttribute("aria-selected"), "true");

    await chInput.fill("B2");
    await page.locator("#opt-b2b").click();
    await chInput.fill("uncommitted-search");
    assert.deepEqual(await page.evaluate(() => new FormData(document.getElementById("edit-form")).getAll("channels")), ["web", "b2b"]);
    assert.equal(await page.locator("#opt-b2b").getAttribute("aria-selected"), "true");

    // Canceled form reset must NOT wipe multiselect chips.
    await page.evaluate(() => {
      const form = document.getElementById("edit-form");
      const cancel = e => e.preventDefault();
      form.addEventListener("reset", cancel, { once: true });
      form.reset();
    });
    await page.waitForTimeout(10);
    assert.deepEqual(await page.evaluate(() => new FormData(document.getElementById("edit-form")).getAll("channels")), ["web", "b2b"], "canceled reset keeps chips");

    // Native form.reset() restores original chips.
    await page.evaluate(() => document.getElementById("edit-form").reset());
    await page.waitForFunction(() => new FormData(document.getElementById("edit-form")).getAll("channels").length === 1);
    assert.deepEqual(await page.evaluate(() => new FormData(document.getElementById("edit-form")).getAll("channels")), ["web"]);
    assert.equal(await page.locator("#opt-b2b").getAttribute("aria-selected"), "false");

    // Backspace & remove button still work.
    await chInput.fill("PO");
    await page.locator("#opt-pos").click();
    await chInput.press("Backspace");
    assert.deepEqual(await page.evaluate(() => new FormData(document.getElementById("edit-form")).getAll("channels")), ["web"]);
    await chInput.fill("PO");
    await page.locator("#opt-pos").click();
    await page.locator('[aria-label="Remove POS"]').click();
    assert.deepEqual(await page.evaluate(() => window.selections.at(-1)), { values: ["web"], added: null, removed: "pos" });

    // 4. 3-state save ownership, hidden inputs, multiselect saved baseline & data-mero-clear-passwords.
    await page.locator("#title").fill("Lamp v1");
    await page.locator("#pwd").fill("top-secret");
    await page.evaluate(() => { document.getElementById("hidden-rev").value = "2"; });
    await chInput.fill("B2");
    await page.locator("#opt-b2b").click();
    await chInput.press("Escape");
    saveMode = "delayed-saved";
    const arrived = new Promise(resolve => { saveArrived = resolve; });
    await page.locator("#save-btn").click();
    await arrived;
    // Editable fields & multiselect are inert to user input while pending; scripted/programmatic mutations stay protected by 3-state snapshots.
    assert.equal(await page.locator("#title").evaluate(el => el.inert), true, "editable fields become inert while request is pending");
    assert.equal(await page.locator("#channels").evaluate(el => el.inert), true, "multiselect becomes inert while request is pending");
    await page.evaluate(() => {
      const t = document.getElementById("title");
      t.value = "Lamp v2";
      t.dispatchEvent(new Event("input", { bubbles: true }));
      document.getElementById("hidden-rev").value = "3";
      const li = document.createElement("li");
      li.className = "mero-chip";
      li.dataset.value = "pos";
      li.innerHTML = 'POS<input type="hidden" name="channels" value="pos"><button type="button" data-mero-multiselect-remove>×</button>';
      document.querySelector("[data-mero-multiselect-chips]").append(li);
    });
    releaseSave();
    await page.locator(".mero-toast", { hasText: "Saved!" }).waitFor();
    assert.equal(await page.locator("#title").evaluate(el => el.inert), false, "inert is cleared once pending request settles");
    assert.equal(await page.locator("#channels").evaluate(el => el.inert), false);
    assert.equal(await page.locator("#save-btn").isDisabled(), false, "mid-flight edit stays dirty after earlier save settles");
    const postSaveState = await page.evaluate(async () => {
      const form = document.getElementById("edit-form");
      const p = document.getElementById("pwd");
      const hidden = document.getElementById("hidden-rev");
      const before = { val: p.value, def: p.defaultValue, hiddenVal: hidden.value };
      form.reset();
      await new Promise(r => setTimeout(r, 15));
      const afterReset = {
        pwd: p.value,
        title: document.getElementById("title").value,
        hiddenVal: hidden.value,
        channels: new FormData(form).getAll("channels"),
      };
      // Align hidden input with saved rev "2" -> reset form must now be clean (saved chips + saved title match baseline).
      hidden.value = "2";
      hidden.dispatchEvent(new Event("input", { bubbles: true }));
      const cleanAfterReset = document.getElementById("save-btn").disabled;
      // Re-dirty for step 5.
      document.getElementById("title").value = "Lamp v2";
      document.getElementById("title").dispatchEvent(new Event("input", { bubbles: true }));
      return { before, afterReset, cleanAfterReset };
    });
    assert.deepEqual(
      postSaveState,
      {
        before: { val: "", def: "", hiddenVal: "3" },
        afterReset: { pwd: "", title: "Lamp v1", hiddenVal: "3", channels: ["web", "b2b"] },
        cleanAfterReset: true,
      },
      "mid-flight hidden value survives save, cleared password never survives, and reset restores last saved title + multiselect chips",
    );

    // 5. Dirty guard: iframe-targeted submit keeps beforeunload armed; same-document submit suppresses beforeunload.
    const submitGuardChecks = await page.evaluate(() => {
      const edit = document.getElementById("edit-form");
      const savedGuard = edit.getAttribute("data-mero-dirty-guard");
      edit.removeAttribute("data-mero-dirty-guard");
      // Cancel default navigation at window (after document's mero-forms.js submit listener runs) so Firefox
      // does not perform a real document reload on untrusted synthetic submit events.
      const stopNav = e => e.preventDefault();
      window.addEventListener("submit", stopNav);
      try {
        const iframeForm = document.createElement("form");
        iframeForm.setAttribute("data-mero-dirty", "dirty");
        iframeForm.setAttribute("data-mero-dirty-guard", "Leave?");
        iframeForm.target = "noop-frame";
        document.body.append(iframeForm);
        iframeForm.dispatchEvent(new Event("submit", { bubbles: true, cancelable: true }));
        const evIframe = new Event("beforeunload", { cancelable: true });
        window.dispatchEvent(evIframe);
        iframeForm.remove();

        const selfForm = document.createElement("form");
        selfForm.setAttribute("data-mero-dirty", "dirty");
        selfForm.setAttribute("data-mero-dirty-guard", "Leave?");
        document.body.append(selfForm);
        selfForm.dispatchEvent(new Event("submit", { bubbles: true, cancelable: true }));
        const evSelf = new Event("beforeunload", { cancelable: true });
        window.dispatchEvent(evSelf);
        selfForm.remove();

        return { iframeBlocked: evIframe.defaultPrevented, selfBlocked: evSelf.defaultPrevented };
      } finally {
        window.removeEventListener("submit", stopNav);
        edit.setAttribute("data-mero-dirty-guard", savedGuard);
      }
    });
    assert.deepEqual(submitGuardChecks, { iframeBlocked: true, selfBlocked: false }, "iframe submit keeps guard armed; same-document submit skips prompt");

    await page.locator("#in-form-leave").click();
    assert.equal(await page.evaluate(() => window.confirmCalls.length), 1, "in-form link prompts when dirty");
    assert.equal(awayHits, 0);

    await page.evaluate(() => history.back());
    await page.waitForFunction(() => window.confirmCalls.length >= 2);
    await page.waitForTimeout(80);
    assert.equal(new URL(page.url()).pathname, "/edit", "declined Back traversal restores /edit URL");
    assert.equal(await page.locator("#edit-form").count(), 1);

    // Save current Lamp v2 without mid-flight edits -> wait for action settlement, then verify Save is disabled.
    saveMode = "saved";
    const beforeActions = await page.evaluate(() => window.actions.length);
    await page.locator("#save-btn").click();
    await page.waitForFunction(n => window.actions.length >= n + 2 && window.actions.at(-1).state === "succeeded", beforeActions);
    assert.equal(await page.locator("#save-btn").isDisabled(), true, "Save stays disabled after clean save settles");

    // 6. HTTP 409: [data-mero-conflict-focus] beats earlier [aria-invalid="true"] AND mero:action keeps original source.
    saveMode = "conflict";
    await page.locator("#title").fill("Lamp v3");
    await page.locator("#save-btn").click();
    await page.locator("#conflict-banner").waitFor();
    assert.equal(await page.locator("#conflict-merge").evaluate(el => el === document.activeElement), true, "explicit conflict focus beats earlier aria-invalid");
    const lastAction = await page.evaluate(() => window.actions.at(-1));
    assert.deepEqual(lastAction, { state: "rejected", status: 409, sameSource: true, id: "edit-form" });

    // 7. Dialog reopen race + preserved toasts carried into next dialog.
    const dlgEvents = await page.evaluate(async () => {
      const log = [];
      const d1 = document.getElementById("dlg-1");
      const d2 = document.getElementById("dlg-2");
      document.addEventListener("mero:dialog", e => log.push({ open: e.detail.open, id: e.detail.dialog.id }));
      window.MeroUI.open(d1);
      window.MeroUI.close(d1);
      window.MeroUI.open(d1);
      window.MeroUI.toast("Still alive", { duration: 0, trigger: d1 });
      await new Promise(r => setTimeout(r, 20));
      const aliveCount = d1.querySelectorAll(".mero-toast").length;
      window.MeroUI.close(d1, { preserveToasts: true });
      window.MeroUI.open(d2);
      const movedIntoD2 = d2.querySelectorAll(".mero-toast").length;
      return { log, aliveCount, movedIntoD2 };
    });
    assert.deepEqual(dlgEvents.log, [
      { open: true, id: "dlg-1" },
      { open: false, id: "dlg-1" },
      { open: true, id: "dlg-1" },
      { open: false, id: "dlg-1" },
      { open: true, id: "dlg-2" },
    ]);
    assert.equal(dlgEvents.aliveCount, 1, "reopened dialog keeps its toast after queued native close");
    assert.equal(dlgEvents.movedIntoD2, 1, "preserved toast moves into newly opened dialog top layer");
    await page.locator("#dlg-2 .mero-toast button").click();
    assert.equal(await page.locator("#dlg-2 .mero-toast").count(), 0, "preserved toast dismiss button is clickable inside dialog 2");
    await page.evaluate(() => window.MeroUI.close("dlg-2"));

    // 8. Dynamically inserted live region with MeroUI.init(el) ONLY (no manual htmx.process), plus backoff & Mero-Live-Interval.
    const pauseTarget = Date.now() + 5000;
    await page.clock.install({ time: pauseTarget - 2000 });
    await page.clock.pauseAt(pauseTarget);
    await page.evaluate(() => {
      window.liveReads = 0;
      document.addEventListener("htmx:finally:request", e => {
        if (e.detail.ctx.sourceElement?.id === "live-box") window.liveReads += 1;
      });
      const slot = document.getElementById("live-slot");
      slot.innerHTML = `<div id="live-box" data-mero-live="1000" hx-get="/live" hx-trigger="mero:refresh" hx-target="find [data-mero-live-status]">
        <div data-mero-live-status>Queued</div>
        <span data-mero-live-error></span>
        <button id="live-retry" type="button" data-mero-live-retry hidden>Retry</button>
      </div>`;
      window.MeroUI.init(slot);
    });
    assert.equal(liveHits, 0);
    await page.clock.fastForward(1100);
    await page.waitForFunction(() => window.liveReads === 1);
    assert.equal(liveHits, 1, "MeroUI.init(slot) alone started live polling");
    await page.clock.fastForward(1100);
    await page.waitForFunction(() => window.liveReads === 2);
    assert.equal(liveHits, 2, "1st failure retries at base interval");
    await page.clock.fastForward(1100);
    await page.waitForTimeout(50);
    assert.equal(liveHits, 2, "2nd failure backs off beyond 1000ms");
    await page.clock.fastForward(1100);
    await page.waitForFunction(() => window.liveReads === 3);
    await page.locator("[data-mero-live-status]", { hasText: "Running" }).waitFor();
    await page.clock.fastForward(2500);
    await page.waitForTimeout(50);
    assert.equal(liveHits, 3, "honors Mero-Live-Interval: 5000");
    await page.clock.fastForward(2700);
    await page.waitForFunction(() => window.liveReads === 4);
    await page.locator("[data-mero-live-status]", { hasText: "Done" }).waitFor();
    assert.equal(liveHits, 4);
    assert.deepEqual(errors, []);
  });
