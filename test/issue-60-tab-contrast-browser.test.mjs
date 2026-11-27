import { browserConfig } from "../scripts/browser-config.mjs";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const root = new URL("../", import.meta.url);
const playwright = await import(browserConfig.playwrightModule || "playwright").catch(error => {
  if (error.code === "ERR_MODULE_NOT_FOUND" && !browserConfig.playwrightModule) return null;
  throw error;
});

function parseRgb(color) {
  const m = color.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)/);
  assert.ok(m, `expected rgb() color, got ${color}`);
  return [Number(m[1]), Number(m[2]), Number(m[3])];
}

function luminance([r, g, b]) {
  const c = [r, g, b].map(v => {
    const s = v / 255;
    return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
  });
  return 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2];
}

function contrast(a, b) {
  const l1 = luminance(parseRgb(a));
  const l2 = luminance(parseRgb(b));
  return (Math.max(l1, l2) + 0.05) / (Math.min(l1, l2) + 0.05);
}

test("issue #60: selected button and link tabs paint a 2px inset indicator with >= 3:1 WCAG 1.4.11 contrast",
  { skip: !playwright && "Install Playwright to run the browser regression" }, async t => {
    const engine = browserConfig.engine || "chromium";
    const browser = await playwright[engine].launch({ executablePath: engine === "chromium" ? browserConfig.chromeExecutable : undefined });
    t.after(() => browser.close());
    const page = await browser.newPage({ reducedMotion: "reduce" });
    page.setDefaultTimeout(5000);

    const html = `<!doctype html><html lang="en"><head>
      <link rel="stylesheet" href="/mero.css">
    </head><body>
      ${["light", "dark"].map(theme => `
        <section id="sec-${theme}" data-theme="${theme}">
          <div class="mero-tabs" data-mero-tabs>
            <div class="mero-tabs-list" role="tablist" aria-label="Views ${theme}">
              <button id="btn-sel-${theme}" class="mero-tab" type="button" role="tab" aria-selected="true">Selected</button>
              <button id="btn-unsel-${theme}" class="mero-tab" type="button" role="tab" aria-selected="false" tabindex="-1">Other</button>
            </div>
          </div>
          <nav class="mero-tabs-list" aria-label="Pages ${theme}">
            <a id="link-cur-${theme}" class="mero-tab" href="#" aria-current="page">Current</a>
            <a id="link-other-${theme}" class="mero-tab" href="#">Other</a>
          </nav>
        </section>
      `).join("")}
    </body></html>`;

    await page.route("http://mero.test/**", async route => {
      const { pathname } = new URL(route.request().url());
      if (pathname === "/") return route.fulfill({ contentType: "text/html", body: html });
      if (pathname === "/mero.css") return route.fulfill({ contentType: "text/css", body: await readFile(new URL("ui/mero.css", root)) });
      return route.fulfill({ status: 404, body: "" });
    });

    await page.goto("http://mero.test/");

    for (const theme of ["light", "dark"]) {
      const data = await page.evaluate(name => {
        const read = id => {
          const el = document.getElementById(id);
          const s = getComputedStyle(el);
          return { shadow: s.boxShadow, color: s.color, bg: s.backgroundColor };
        };
        const listBg = getComputedStyle(document.querySelector(`#sec-${name} .mero-tabs-list`)).backgroundColor;
        return {
          listBg,
          btnSel: read(`btn-sel-${name}`),
          btnUnsel: read(`btn-unsel-${name}`),
          linkCur: read(`link-cur-${name}`),
          linkOther: read(`link-other-${name}`),
        };
      }, theme);

      for (const [label, tab] of [["button[aria-selected=true]", data.btnSel], ["a[aria-current=page]", data.linkCur]]) {
        assert.match(tab.shadow, /inset\s+0px\s+-2px\s+0px\s+0px|0px\s+-2px\s+0px\s+0px\s+inset/, `${theme} ${label} has 2px inset bottom bar: ${tab.shadow}`);
        // Indicator layer (first comma-separated shadow) must appear before the 1px inset ring so it paints on top.
        const firstLayer = tab.shadow.split(/,(?![^(]*\))/)[0];
        assert.match(firstLayer, /-2px/, `${theme} ${label} paints 2px bar before 1px ring: ${tab.shadow}`);
        assert.ok(firstLayer.includes(tab.color), `${theme} ${label} bar uses --mero-text (${tab.color}): ${firstLayer}`);
        assert.ok(contrast(tab.color, tab.bg) >= 3, `${theme} ${label} bar contrast vs tab fill >= 3:1`);
        assert.ok(contrast(tab.color, data.listBg) >= 3, `${theme} ${label} bar contrast vs tab list >= 3:1`);
      }

      assert.equal(data.btnUnsel.shadow, "none", `${theme} unselected button tab has no indicator shadow`);
      assert.equal(data.linkOther.shadow, "none", `${theme} non-current link tab has no indicator shadow`);
    }
  });
