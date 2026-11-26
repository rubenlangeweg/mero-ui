import assert from "node:assert/strict";
import { Readable } from "node:stream";
import test from "node:test";
import { browserConfig } from "../scripts/browser-config.mjs";
import { createStarterApp } from "../examples/backends/node/server.mjs";

const playwright = await import(browserConfig.playwrightModule || "playwright").catch(error => {
  if (error.code === "ERR_MODULE_NOT_FOUND" && !browserConfig.playwrightModule) return null;
  throw error;
});

async function callHandler(handler, { method = "GET", url = "/", headers = {}, body = "" } = {}) {
  const buf = Buffer.isBuffer(body) ? body : Buffer.from(body);
  const req = Object.assign(Readable.from(buf.length ? [buf] : []), {
    method,
    url,
    headers: Object.fromEntries(Object.entries(headers).map(([k, v]) => [k.toLowerCase(), v])),
  });
  let status = 200;
  let resHeaders = {};
  let chunks = [];
  const res = {
    writeHead(code, hdrs = {}) {
      status = code;
      resHeaders = hdrs;
    },
    end(payload = "") {
      chunks.push(Buffer.isBuffer(payload) ? payload : Buffer.from(String(payload)));
    },
  };
  await handler(req, res);
  const rawBody = Buffer.concat(chunks);
  return { status, headers: resHeaders, body: rawBody.toString("utf8"), rawBody };
}

test("full-flow Node starter enforces CSRF 403, 422 validation, 409 conflict, 200 save, typed delete and live 401 redirect", async () => {
  const { handler, store, csrfToken } = createStarterApp();

  // 1. Index renders products, export card and CSRF cookie
  const home = await callHandler(handler, { url: "/" });
  assert.equal(home.status, 200);
  assert.match(home.headers["Set-Cookie"], /mero_csrf=/);
  assert.match(home.body, /Arc Task Lamp/);
  assert.match(home.body, /data-mero-boost="#app-main"/);

  // 2. Missing CSRF -> 403 rejected
  const noCsrf = await callHandler(handler, {
    method: "POST",
    url: "/products/1",
    body: new URLSearchParams({ name: "Test", sku: "RL-1001", version: "1", channels: "web" }).toString(),
  });
  assert.equal(noCsrf.status, 403);
  assert.equal(noCsrf.headers["Mero-Action-Outcome"], "rejected");

  // 3. Invalid SKU + missing channels -> 422 with aria-invalid
  const invalid = await callHandler(handler, {
    method: "POST",
    url: "/products/1",
    body: new URLSearchParams({ csrf: csrfToken, name: "Arc Task Lamp", sku: "bad-sku", status: "Active", version: "1" }).toString(),
  });
  assert.equal(invalid.status, 422);
  assert.match(invalid.body, /aria-invalid="true"/);
  assert.match(invalid.body, /Select at least one sales channel/);

  // 4. Simulate external edit -> version bumps to 2 -> stale save gets 409 with conflict focus
  const bump = await callHandler(handler, {
    method: "POST",
    url: "/products/1/bump",
    headers: { "X-CSRF-Token": csrfToken },
  });
  assert.equal(bump.status, 200);
  assert.equal(store.products[0].version, 2);

  const stale = await callHandler(handler, {
    method: "POST",
    url: "/products/1",
    body: new URLSearchParams([
      ["csrf", csrfToken], ["name", "My Lamp Draft"], ["sku", "RL-1001"],
      ["status", "Active"], ["version", "1"], ["channels", "web"], ["channels", "pos"],
    ]).toString(),
  });
  assert.equal(stale.status, 409);
  assert.match(stale.headers["Mero-Form-Error"], /Record changed/);
  assert.match(stale.body, /data-mero-conflict-focus/);
  assert.match(stale.body, /name="version" value="2"/);
  assert.match(stale.body, /value="My Lamp Draft"/);

  // 5. Resubmitting with version 2 succeeds with HX-Trigger mero:form-saved
  const saved = await callHandler(handler, {
    method: "POST",
    url: "/products/1",
    body: new URLSearchParams([
      ["csrf", csrfToken], ["name", "My Lamp Draft"], ["sku", "RL-1001"],
      ["status", "Active"], ["version", "2"], ["channels", "web"], ["channels", "pos"],
    ]).toString(),
  });
  assert.equal(saved.status, 200);
  const trigger = JSON.parse(saved.headers["HX-Trigger"]);
  assert.match(trigger["mero:form-saved"].message, /Saved My Lamp Draft \(v3\)/);
  assert.deepEqual(store.products[0].channels, ["web", "pos"]);

  // 6. Typed confirmation delete: 422 returns <form> only, valid submission deletes product
  const delDialog = await callHandler(handler, { url: "/products/2/delete" });
  assert.equal(delDialog.status, 200);
  assert.match(delDialog.body, /data-mero-confirm-phrase>delete RL-1002</);

  const delInvalid = await callHandler(handler, {
    method: "POST",
    url: "/products/2/delete",
    body: new URLSearchParams({ csrf: csrfToken, phrase: "delete RL-1002", reason: "short" }).toString(),
  });
  assert.equal(delInvalid.status, 422);
  assert.doesNotMatch(delInvalid.body, /<dialog\b/);
  assert.match(delInvalid.body, /at least 8 characters/);

  const delOk = await callHandler(handler, {
    method: "POST",
    url: "/products/2/delete",
    body: new URLSearchParams({ csrf: csrfToken, phrase: "delete RL-1002", reason: "Discontinued seasonal SKU" }).toString(),
  });
  assert.equal(delOk.status, 200);
  assert.equal(store.products.length, 1);

  // 7. Live export: Mero-Live-Interval -> Mero-Live: done, and 401 HX-Redirect
  const startJob = await callHandler(handler, {
    method: "POST",
    url: "/exports",
    headers: { "X-CSRF-Token": csrfToken },
  });
  assert.equal(startJob.status, 200);
  assert.match(startJob.body, /data-mero-live="1500" data-mero-live-follow/);

  const poll1 = await callHandler(handler, { url: "/exports/1/status" });
  assert.equal(poll1.status, 200);
  assert.equal(poll1.headers["Mero-Live-Interval"], "800");

  const poll2 = await callHandler(handler, { url: "/exports/1/status" });
  assert.equal(poll2.status, 200);
  assert.equal(poll2.headers["Mero-Live"], "done");

  const expired = await callHandler(handler, { url: "/exports/1/status?expired=1" });
  assert.equal(expired.status, 401);
  assert.equal(expired.headers["HX-Redirect"], "/login");
});

test("full-flow Node starter browser journey: multiselect, 422 focus, 409 conflict swap and live done",
  { skip: !playwright && "Install Playwright to run the browser test" }, async t => {
    const { handler, store } = createStarterApp();
    const engine = browserConfig.engine || "chromium";
    const browser = await playwright[engine].launch({
      executablePath: engine === "chromium" ? browserConfig.chromeExecutable : undefined,
    });
    t.after(() => browser.close());
    const page = await browser.newPage({ reducedMotion: "reduce" });
    page.setDefaultTimeout(5000);
    const errors = [];
    page.on("pageerror", err => errors.push(err.message));

    await page.route("http://starter.test/**", async route => {
      const req = route.request();
      const url = new URL(req.url());
      const res = await callHandler(handler, {
        method: req.method(),
        url: url.pathname + url.search,
        headers: req.headers(),
        body: req.postDataBuffer() || "",
      });
      await route.fulfill({
        status: res.status,
        headers: res.headers,
        body: res.rawBody,
      });
    });

    await page.goto("http://starter.test/products/1/edit");
    await page.waitForFunction(() => Boolean(window.MeroUI && window.htmx));

    // Add POS channel via multi-select combobox
    await page.locator("#channels-input").fill("PO");
    await page.locator("#opt-ch-pos").click();
    assert.deepEqual(
      await page.locator('#channels-picker input[type="hidden"][name="channels"]').evaluateAll(els => els.map(e => e.value)),
      ["web", "b2b", "pos"]
    );

    // Trigger 422 validation error -> focus moves to invalid SKU field
    await page.locator("#field-sku").fill("bad");
    await page.locator('button[type="submit"]').click();
    await page.waitForSelector("#err-sku");
    assert.equal(await page.evaluate(() => document.activeElement?.id), "field-sku");

    // Simulate external edit while user fixes SKU -> 409 conflict swaps & focuses conflict callout
    store.products[0].version = 2;
    store.products[0].name = "Arc Task Lamp (external)";
    await page.locator("#field-sku").fill("RL-2001");
    await page.locator('button[type="submit"]').click();
    await page.waitForSelector("[data-mero-conflict-focus]");
    assert.equal(await page.evaluate(() => document.activeElement?.hasAttribute("data-mero-conflict-focus")), true);

    // Resubmit conflict form with updated version -> 200 save succeeds & clears dirty state
    await page.locator("#field-name").fill("Arc Task Lamp Resolved");
    await page.locator('button[type="submit"]').click();
    await page.waitForFunction(() => document.body.textContent.includes("Saved revision v3."));
    assert.equal(store.products[0].version, 3);
    assert.equal(store.products[0].sku, "RL-2001");
    assert.deepEqual(store.products[0].channels, ["web", "b2b", "pos"]);

    // Navigate back to products and run live export until Mero-Live: done
    await page.goto("http://starter.test/");
    await page.clock.install();
    await page.locator('button:has-text("Start export")').first().click();
    await page.waitForSelector("[data-mero-live]");
    await page.clock.runFor(1600);
    await page.waitForFunction(() => document.body.textContent.includes("Exporting catalog"));
    await page.clock.runFor(900);
    await page.waitForSelector("[data-mero-live-done]");
    assert.match(await page.locator("[data-mero-live-status]").textContent(), /Export ready/);

    assert.deepEqual(errors, []);
  });
