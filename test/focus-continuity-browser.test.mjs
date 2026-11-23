import { browserConfig } from "../scripts/browser-config.mjs";
import test from "node:test";
import assert from "node:assert/strict";
import { createApp } from "../server.mjs";

const playwright = await import(browserConfig.playwrightModule || "playwright").catch(error => {
  if (error.code === "ERR_MODULE_NOT_FOUND" && !browserConfig.playwrightModule) return null;
  throw error;
});

test("focus survives any swap or morph that removes it, and is never taken from where the person moved it",
  { skip: !playwright && "Install Playwright to run the browser regression" }, async t => {
    const server = createApp();
    await new Promise(resolve => server.listen(0, "127.0.0.1", resolve));
    t.after(() => new Promise(resolve => { server.close(resolve); server.closeAllConnections(); }));
    const base = "http://127.0.0.1:" + server.address().port;
    const engine = browserConfig.engine || "chromium";
    const browser = await playwright[engine].launch({ executablePath: engine === "chromium" ? browserConfig.chromeExecutable : undefined });
    t.after(() => browser.close());
    const page = await browser.newPage();
    page.setDefaultTimeout(5000);
    const errors = [];
    page.on("pageerror", error => errors.push(error.message));

    // Each response is the region's next markup. A held response lets the test act during the request.
    const responses = [];
    let release = () => {};
    await page.route("**/focus-fixture", async route => {
      const { body, hold } = responses.shift();
      if (hold) await new Promise(resolve => { release = resolve; });
      await route.fulfill({ status: 200, contentType: "text/html", body });
    });
    await page.goto(base + "/preview/action-button");
    const fixture = async (swap, inner) => page.evaluate(([swap, inner]) => {
      document.querySelector("main").innerHTML = `
        <input id="outside" aria-label="Outside">
        <section id="region" hx-get="/focus-fixture" hx-trigger="refresh" hx-swap="${swap}">${inner}</section>`;
      window.htmx.process(document.querySelector("main"));
    }, [swap, inner]);
    const refresh = async ({ body, hold = false }) => {
      responses.push({ body, hold });
      await page.evaluate(() => {
        window.swapped = new Promise(resolve => document.addEventListener("htmx:finally:swap", resolve, { once: true }));
        document.querySelector("#region").dispatchEvent(new Event("refresh"));
      });
    };
    const settled = () => page.evaluate(() => window.swapped.then(() => new Promise(requestAnimationFrame)));
    const focused = () => page.evaluate(() => document.activeElement === document.body ? "body" : document.activeElement.id || document.activeElement.tagName);

    // A morph that cannot keep the element (input becomes textarea) moves focus to its replacement by ID.
    await fixture("outerMorph", '<input id="query" aria-label="Query">');
    await page.locator("#query").focus();
    await refresh({ body: '<section id="region" hx-get="/focus-fixture" hx-trigger="refresh" hx-swap="outerMorph"><textarea id="query" aria-label="Query"></textarea></section>' });
    await settled();
    assert.equal(await focused(), "query");
    assert.equal(await page.evaluate(() => document.activeElement.tagName), "TEXTAREA");

    // When the focused control is gone, the region's fallback takes focus.
    await fixture("innerHTML", '<button id="row-7">Row 7</button><h2 tabindex="-1" id="list-title" data-mero-focus-fallback>Rows</h2>');
    await page.locator("#row-7").focus();
    await refresh({ body: '<h2 tabindex="-1" id="list-title" data-mero-focus-fallback>Rows</h2><p>No rows</p>' });
    await settled();
    assert.equal(await focused(), "list-title");

    // Focus moved elsewhere during the request stays there.
    await fixture("innerHTML", '<button id="row-8">Row 8</button><h2 tabindex="-1" id="list-title-2" data-mero-focus-fallback>Rows</h2>');
    await page.locator("#row-8").focus();
    await refresh({ body: '<h2 tabindex="-1" id="list-title-2" data-mero-focus-fallback>Rows</h2>', hold: true });
    await page.locator("#outside").focus();
    release();
    await settled();
    assert.equal(await focused(), "outside", "focus the person moved is never taken back");

    // Focus the person left on the page body stays there.
    await fixture("innerHTML", '<button id="row-9">Row 9</button><h2 tabindex="-1" id="list-title-3" data-mero-focus-fallback>Rows</h2>');
    await page.locator("#row-9").focus();
    await page.evaluate(() => document.activeElement.blur());
    await refresh({ body: '<h2 tabindex="-1" id="list-title-3" data-mero-focus-fallback>Rows</h2>' });
    await settled();
    assert.equal(await focused(), "body", "a background swap never focuses anything by itself");

    // The server's [autofocus] wins over the fallback.
    await fixture("innerHTML", '<button id="row-10">Row 10</button>');
    await page.locator("#row-10").focus();
    await refresh({ body: '<h2 tabindex="-1" id="t" data-mero-focus-fallback>Rows</h2><input id="fix-me" aria-label="Fix me" autofocus>' });
    await settled();
    assert.equal(await focused(), "fix-me");

    // data-mero-focus-manual leaves focus to the app.
    await fixture("innerHTML", '<button id="row-11">Row 11</button><h2 tabindex="-1" id="t2" data-mero-focus-fallback>Rows</h2>');
    await page.evaluate(() => document.querySelector("#region").setAttribute("data-mero-focus-manual", ""));
    await page.locator("#row-11").focus();
    await refresh({ body: '<h2 tabindex="-1" id="t2" data-mero-focus-fallback>Rows</h2>' });
    await settled();
    assert.equal(await focused(), "body");
    assert.deepEqual(errors, []);
  });
