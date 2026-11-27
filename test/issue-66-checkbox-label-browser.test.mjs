import { browserConfig } from "../scripts/browser-config.mjs";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const root = new URL("../", import.meta.url);
const playwright = await import(browserConfig.playwrightModule || "playwright").catch(error => {
  if (error.code === "ERR_MODULE_NOT_FOUND" && !browserConfig.playwrightModule) return null;
  throw error;
});

test("issue #66: standalone checkbox and radio labels get inline-flex gap without relying on whitespace",
  { skip: !playwright && "Install Playwright to run the browser regression" }, async t => {
    const engine = browserConfig.engine || "chromium";
    const browser = await playwright[engine].launch({ executablePath: engine === "chromium" ? browserConfig.chromeExecutable : undefined });
    t.after(() => browser.close());
    const page = await browser.newPage({ reducedMotion: "reduce" });
    page.setDefaultTimeout(5000);

    // Deliberately omit whitespace between <input> and <span> / text (matches JSX renderers that strip whitespace).
    const html = `<!doctype html><html lang="en"><head>
      <link rel="stylesheet" href="/mero.css">
    </head><body>
      <label id="single-cb"><input id="cb-box" class="mero-checkbox" type="checkbox"><span id="cb-text">Save without translation</span></label>
      <label id="single-radio"><input id="radio-box" class="mero-radio" type="radio" name="r"><span id="radio-text">Option A</span></label>
      <label id="disabled-cb"><input class="mero-checkbox" type="checkbox" disabled><span>Disabled</span></label>
      <label id="hidden-cb" hidden><input class="mero-checkbox" type="checkbox"><span>Hidden checkbox</span></label>
      <label id="hidden-radio" hidden><input class="mero-radio" type="radio" name="h"><span>Hidden radio</span></label>
      <div class="mero-checkbox-group">
        <label id="group-cb"><input class="mero-checkbox" type="checkbox"><span>Grouped</span></label>
      </div>
    </body></html>`;

    await page.route("http://mero.test/**", async route => {
      const { pathname } = new URL(route.request().url());
      if (pathname === "/") return route.fulfill({ contentType: "text/html", body: html });
      if (pathname === "/mero.css") return route.fulfill({ contentType: "text/css", body: await readFile(new URL("ui/mero.css", root)) });
      return route.fulfill({ status: 404, body: "" });
    });

    await page.goto("http://mero.test/");

    const metrics = await page.evaluate(() => {
      const gapBetween = (aId, bId) => {
        const a = document.getElementById(aId).getBoundingClientRect();
        const b = document.getElementById(bId).getBoundingClientRect();
        return Math.round(b.left - a.right);
      };
      const styleOf = id => {
        const s = getComputedStyle(document.getElementById(id));
        return { display: s.display, alignItems: s.alignItems, gap: s.columnGap, cursor: s.cursor };
      };
      return {
        cbGap: gapBetween("cb-box", "cb-text"),
        radioGap: gapBetween("radio-box", "radio-text"),
        singleCb: styleOf("single-cb"),
        singleRadio: styleOf("single-radio"),
        disabledCb: styleOf("disabled-cb"),
        hiddenCb: { display: getComputedStyle(document.getElementById("hidden-cb")).display, rects: document.getElementById("hidden-cb").getClientRects().length },
        hiddenRadio: { display: getComputedStyle(document.getElementById("hidden-radio")).display, rects: document.getElementById("hidden-radio").getClientRects().length },
        groupCb: styleOf("group-cb"),
      };
    });

    assert.equal(metrics.singleCb.display, "inline-flex");
    assert.equal(metrics.singleCb.alignItems, "center");
    assert.equal(metrics.singleCb.cursor, "pointer");
    assert.ok(metrics.cbGap >= 7 && metrics.cbGap <= 9, `checkbox-to-text gap should be ~8px (.5rem), got ${metrics.cbGap}px`);

    assert.equal(metrics.singleRadio.display, "inline-flex");
    assert.ok(metrics.radioGap >= 7 && metrics.radioGap <= 9, `radio-to-text gap should be ~8px (.5rem), got ${metrics.radioGap}px`);

    assert.equal(metrics.disabledCb.cursor, "not-allowed", "disabled checkbox label uses not-allowed cursor");
    assert.deepEqual(metrics.hiddenCb, { display: "none", rects: 0 }, "hidden standalone checkbox label stays hidden");
    assert.deepEqual(metrics.hiddenRadio, { display: "none", rects: 0 }, "hidden standalone radio label stays hidden");
    assert.equal(metrics.groupCb.display, "flex", "checkbox-group labels preserve full-row flex layout");
  });
