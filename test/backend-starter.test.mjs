import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { Readable } from "node:stream";
import test from "node:test";
import { runCli } from "../bin/mero-ui.mjs";
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
  const chunks = [];
  const res = {
    headersSent: false,
    writeHead(code, hdrs = {}) {
      this.headersSent = true;
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

function extractCookieAndToken(res) {
  const setCookie = res.headers["Set-Cookie"] || "";
  const match = setCookie.match(/mero_csrf=([^;]+)/);
  assert.ok(match, "response must set mero_csrf cookie");
  const token = decodeURIComponent(match[1]);
  return { cookie: `mero_csrf=${match[1]}`, token };
}

test("full-flow Node starter enforces per-session CSRF cookie, Unicode headers, bad input safety, 422, 409, delete and 401 redirect", async () => {
  const { handler, store } = createStarterApp();

  // 1. Index issues per-client CSRF session cookie
  const home = await callHandler(handler, { url: "/" });
  assert.equal(home.status, 200);
  const { cookie, token } = extractCookieAndToken(home);
  assert.match(home.body, /Arc Task Lamp/);
  assert.match(home.body, /data-mero-boost="#app-main"/);

  // Second anonymous client receives a distinct session token
  const home2 = await callHandler(handler, { url: "/" });
  const client2 = extractCookieAndToken(home2);
  assert.notEqual(client2.token, token, "each client session gets its own CSRF token");

  // 2. CSRF checks: missing cookie -> 403, mismatched cookie -> 403, missing token -> 403
  const noCookie = await callHandler(handler, {
    method: "POST",
    url: "/products/1",
    body: new URLSearchParams({ csrf: token, name: "Test", sku: "RL-1001", version: "1", channels: "web" }).toString(),
  });
  assert.equal(noCookie.status, 403);
  assert.equal(noCookie.headers["Mero-Action-Outcome"], "rejected");

  const wrongCookie = await callHandler(handler, {
    method: "POST",
    url: "/products/1",
    headers: { Cookie: client2.cookie },
    body: new URLSearchParams({ csrf: token, name: "Test", sku: "RL-1001", version: "1", channels: "web" }).toString(),
  });
  assert.equal(wrongCookie.status, 403);

  const noToken = await callHandler(handler, {
    method: "POST",
    url: "/products/1",
    headers: { Cookie: cookie },
    body: new URLSearchParams({ name: "Test", sku: "RL-1001", version: "1", channels: "web" }).toString(),
  });
  assert.equal(noToken.status, 403);

  // Malformed cookie (%) and oversized body (>32KB) answer cleanly without throwing
  const badCookie = await callHandler(handler, { url: "/", headers: { Cookie: "mero_csrf=%" } });
  assert.equal(badCookie.status, 200);
  const tooLarge = await callHandler(handler, {
    method: "POST",
    url: "/products/1",
    headers: { Cookie: cookie },
    body: "x".repeat(40_000),
  });
  assert.equal(tooLarge.status, 413);

  // 3. Invalid SKU + missing channels -> 422 with aria-invalid and preserved dirty guard
  const invalid = await callHandler(handler, {
    method: "POST",
    url: "/products/1",
    headers: { Cookie: cookie },
    body: new URLSearchParams({ csrf: token, name: "Arc Task Lamp", sku: "bad-sku", status: "Active", version: "1" }).toString(),
  });
  assert.equal(invalid.status, 422);
  assert.match(invalid.body, /aria-invalid="true"/);
  assert.match(invalid.body, /id="channels-input"[^>]*aria-invalid="true" aria-describedby="err-channels"/);
  assert.match(invalid.body, /data-mero-dirty="dirty"/);
  assert.match(invalid.body, /data-mero-dirty-guard=/);

  // 4. Simulate external edit -> version bumps to 2 -> stale save gets 409 with conflict focus
  const bump = await callHandler(handler, {
    method: "POST",
    url: "/products/1/bump",
    headers: { Cookie: cookie, "X-CSRF-Token": token },
  });
  assert.equal(bump.status, 200);
  assert.equal(store.products[0].version, 2);

  const stale = await callHandler(handler, {
    method: "POST",
    url: "/products/1",
    headers: { Cookie: cookie },
    body: new URLSearchParams([
      ["csrf", token], ["name", "Desk lamp – blue’s edition"], ["sku", "RL-1001"],
      ["status", "Active"], ["version", "1"], ["channels", "web"], ["channels", "pos"],
    ]).toString(),
  });
  assert.equal(stale.status, 409);
  assert.match(stale.headers["Mero-Form-Error"], /Record changed/);
  assert.match(stale.body, /data-mero-conflict-focus/);
  assert.match(stale.body, /data-mero-dirty="dirty"/);
  assert.match(stale.body, /data-mero-dirty-guard=/);

  // 5. Resubmitting with Unicode name succeeds with pure-ASCII HX-Trigger header JSON
  const saved = await callHandler(handler, {
    method: "POST",
    url: "/products/1",
    headers: { Cookie: cookie },
    body: new URLSearchParams([
      ["csrf", token], ["name", "Desk lamp – blue’s edition"], ["sku", "RL-1001"],
      ["status", "Active"], ["version", "2"], ["channels", "web"], ["channels", "pos"],
    ]).toString(),
  });
  assert.equal(saved.status, 200);
  assert.doesNotMatch(saved.headers["HX-Trigger"], /[^\x20-\x7e]/, "HX-Trigger header is pure ASCII");
  const trigger = JSON.parse(saved.headers["HX-Trigger"]);
  assert.match(trigger["mero:form-saved"].message, /Saved Desk lamp – blue’s edition \(v3\)/);
  assert.deepEqual(store.products[0].channels, ["web", "pos"]);

  // 6. Typed confirmation delete: auto-open dialog, 422 form-only swap, 200 OOB table + HX-Reswap: none
  const delDialog = await callHandler(handler, { url: "/products/2/delete", headers: { Cookie: cookie } });
  assert.equal(delDialog.status, 200);
  assert.match(delDialog.body, /aria-labelledby="delete-dialog-title"/);
  assert.match(delDialog.body, /id="delete-dialog-title"/);
  assert.match(delDialog.body, /data-mero-autoopen/);
  assert.match(delDialog.body, /hx-target="this"/);

  const delInvalid = await callHandler(handler, {
    method: "POST",
    url: "/products/2/delete",
    headers: { Cookie: cookie },
    body: new URLSearchParams({ csrf: token, phrase: "delete RL-1002", reason: "short" }).toString(),
  });
  assert.equal(delInvalid.status, 422);
  assert.doesNotMatch(delInvalid.body, /<dialog\b/);
  assert.match(delInvalid.body, /at least 8 characters/);

  const delOk = await callHandler(handler, {
    method: "POST",
    url: "/products/2/delete",
    headers: { Cookie: cookie },
    body: new URLSearchParams({ csrf: token, phrase: "delete RL-1002", reason: "Discontinued seasonal SKU" }).toString(),
  });
  assert.equal(delOk.status, 200);
  assert.equal(delOk.headers["HX-Reswap"], "none");
  assert.match(delOk.body, /hx-swap-oob="outerHTML"/);
  assert.equal(store.products.length, 1);

  // 7. Live export: Mero-Live-Interval -> Mero-Live: done, and 401 HX-Redirect
  const startJob = await callHandler(handler, {
    method: "POST",
    url: "/exports",
    headers: { Cookie: cookie, "X-CSRF-Token": token },
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

test("full-flow Node starter browser journey using CLI-vendored assets: multiselect, dirty guard, 422, 409, delete dialog and live done",
  { skip: !playwright && "Install Playwright to run the browser test" }, async t => {
    const vendoredDir = await mkdtemp(join(tmpdir(), "mero-starter-vendor-"));
    t.after(() => rm(vendoredDir, { recursive: true, force: true }));
    const cliCode = await runCli(["init", vendoredDir], { stdout() {}, stderr() {} });
    assert.equal(cliCode, 0);

    const { handler, store } = createStarterApp({ assetsDir: vendoredDir });
    const engine = browserConfig.engine || "chromium";
    const browser = await playwright[engine].launch({
      executablePath: engine === "chromium" ? browserConfig.chromeExecutable : undefined,
    });
    t.after(() => browser.close());
    const page = await browser.newPage({ reducedMotion: "reduce" });
    page.setDefaultTimeout(5000);
    const errors = [];
    page.on("pageerror", err => errors.push(err.message));

    let cookieJar = "";
    await page.route("http://starter.test/**", async route => {
      const req = route.request();
      const url = new URL(req.url());
      const reqHeaders = { ...req.headers() };
      if (cookieJar) reqHeaders.cookie = cookieJar;
      const res = await callHandler(handler, {
        method: req.method(),
        url: url.pathname + url.search,
        headers: reqHeaders,
        body: req.postDataBuffer() || "",
      });
      if (res.headers["Set-Cookie"]) {
        cookieJar = res.headers["Set-Cookie"].split(";")[0];
      }
      await route.fulfill({
        status: res.status,
        headers: res.headers,
        body: res.rawBody,
      });
    });

    await page.goto("http://starter.test/products/1/edit");
    await page.waitForFunction(() => Boolean(window.MeroUI && window.htmx));
    await page.evaluate(() => {
      window.confirmCalls = [];
      window.confirm = text => { window.confirmCalls.push(text); return false; };
    });

    // Add POS channel via multi-select combobox, then close listbox before clicking Back
    await page.locator("#channels-input").fill("PO");
    await page.locator("#opt-ch-pos").click();
    await page.locator("#channels-input").press("Escape");
    assert.deepEqual(
      await page.locator('#channels-picker input[type="hidden"][name="channels"]').evaluateAll(els => els.map(e => e.value)),
      ["web", "b2b", "pos"]
    );

    // Clicking in-form "Back to products" link prompts and cancels navigation while dirty
    await page.locator('a:has-text("Back to products")').click();
    assert.equal(await page.evaluate(() => window.confirmCalls.length), 1, "in-form Back link triggers dirty guard");
    assert.match(page.url(), /\/products\/1\/edit$/);

    // Trigger 422 validation error -> focus moves to invalid SKU field AND dirty guard stays armed
    await page.locator("#field-sku").fill("bad");
    await page.locator('button[type="submit"]').click();
    await page.waitForSelector("#err-sku");
    assert.equal(await page.evaluate(() => document.activeElement?.id), "field-sku");
    await page.locator('a:has-text("Back to products")').click();
    assert.equal(await page.evaluate(() => window.confirmCalls.length), 2, "422 draft keeps dirty guard active");

    // Simulate external edit while user fixes SKU -> 409 conflict swaps & focuses conflict callout
    store.products[0].version = 2;
    store.products[0].name = "Arc Task Lamp (external)";
    await page.locator("#field-sku").fill("RL-2001");
    await page.locator('button[type="submit"]').click();
    await page.waitForSelector("[data-mero-conflict-focus]");
    assert.equal(await page.evaluate(() => document.activeElement?.hasAttribute("data-mero-conflict-focus")), true);

    // Resubmit conflict form with Unicode product name -> 200 save succeeds
    await page.locator("#field-name").fill("Arc Task Lamp – Resolved");
    await page.locator('button[type="submit"]').click();
    await page.waitForFunction(() => document.body.textContent.includes("Saved revision v3."));
    assert.equal(store.products[0].version, 3);
    assert.equal(store.products[0].name, "Arc Task Lamp – Resolved");

    // Navigate back to products, exercise full Delete dialog (autoopen + 422 in-place + 200 OOB remove)
    await page.goto("http://starter.test/");
    await page.locator('#product-row-2 button:has-text("Delete")').click();
    await page.locator("#delete-dialog[open]").waitFor();
    await page.locator("#confirm-phrase").fill("delete RL-1002");
    await page.locator("#confirm-reason").fill("short");
    await page.locator("#delete-form button[type='submit']").click();
    await page.waitForSelector("#err-reason");
    assert.equal(await page.locator("#delete-form").count(), 1, "422 swaps delete form in place without duplicating it");
    assert.equal(await page.locator("#product-table").count(), 1, "422 preserves product table");

    await page.locator("#confirm-reason").fill("Retiring seasonal SKU");
    await page.locator("#delete-form button[type='submit']").click();
    await page.waitForFunction(() => !document.getElementById("product-row-2"));
    assert.equal(await page.locator("#delete-dialog[open]").count(), 0, "successful delete closes dialog");

    // Start live export and poll to completion
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
