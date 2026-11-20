import { browserConfig } from "../scripts/browser-config.mjs";
import assert from "node:assert/strict";
import test from "node:test";
import { createApp } from "../server.mjs";
import { components } from "../site/catalog.mjs";

const playwright = await import(browserConfig.playwrightModule || "playwright").catch(error => {
  if (error.code === "ERR_MODULE_NOT_FOUND" && !browserConfig.playwrightModule) return null;
  throw error;
});

// Compare the pixels with and without the indicator. This measures the part that
// is actually painted, including its path, borders, writing direction and zoom.
async function indicatorBounds(control, property) {
  const capture = { scale: "css", animations: "disabled" };
  const visible = await control.screenshot(capture);
  const css = property === "thumb"
    ? ".mero-switch::before { visibility: hidden !important }"
    : ".mero-select { background-image: none !important }";
  const override = await control.page().addStyleTag({ content: css });
  let hidden;
  try {
    hidden = await control.screenshot(capture);
  } finally {
    await override.evaluate(element => element.remove());
  }
  return control.evaluate(async (_, { sources, property }) => {
    async function pixels(source) {
      const img = new Image();
      img.src = "data:image/png;base64," + source;
      await img.decode();
      const canvas = document.createElement("canvas");
      canvas.width = img.width;
      canvas.height = img.height;
      const ctx = canvas.getContext("2d");
      ctx.drawImage(img, 0, 0);
      return { width: img.width, height: img.height, data: ctx.getImageData(0, 0, img.width, img.height).data };
    }
    const [on, off] = await Promise.all(sources.map(pixels));
    const columns = new Uint32Array(on.width);
    const rows = new Uint32Array(on.height);
    for (let y = 0; y < on.height; y++) {
      // A native select's rounded outer border can be composited differently by
      // WebKit between screenshots. Its centered indicator lies in this band.
      if (property === "chevron" && (y < on.height * .3 || y > on.height * .7)) continue;
      for (let x = 0; x < on.width; x++) {
        const start = (y * on.width + x) * 4;
        if (on.data[start + 3] < 250 || off.data[start + 3] < 250) continue;
        if (![0, 1, 2].some(channel => Math.abs(on.data[start + channel] - off.data[start + channel]) > 12)) continue;
        columns[x]++;
        rows[y]++;
      }
    }
    // A fractional crop can change one antialiased border pixel between shots.
    const hasInk = count => count >= 2;
    const left = columns.findIndex(hasInk), right = columns.findLastIndex(hasInk);
    const top = rows.findIndex(hasInk), bottom = rows.findLastIndex(hasInk);
    return { left, right: on.width - 1 - right, top, bottom: on.height - 1 - bottom,
      width: right - left + 1, height: bottom - top + 1 };
  }, { sources: [visible.toString("base64"), hidden.toString("base64")], property });
}

function near(actual, expected, name, tolerance = 1.5) {
  assert.ok(Math.abs(actual - expected) <= tolerance, name + ": " + actual + "px, expected " + expected + "px");
}

test("native select indicators and switch thumbs sit inside the control in both directions", {
  skip: !playwright && "Install Playwright for optical checks",
}, async t => {
  const engine = browserConfig.engine || "chromium";
  const browser = await playwright[engine].launch({ executablePath: engine === "chromium" ? browserConfig.chromeExecutable : undefined });
  const app = createApp();
  await new Promise(resolve => app.listen(0, "127.0.0.1", resolve));
  const base = "http://127.0.0.1:" + app.address().port;
  t.after(async () => { await browser.close(); await new Promise(resolve => app.close(resolve)); });
  const page = await browser.newPage({ viewport: { width: 900, height: 720 }, reducedMotion: "reduce" });
  await page.route(base + "/plain", route => route.fulfill({ contentType: "text/html", body: `<!doctype html>
    <meta name="viewport" content="width=device-width"><link rel="stylesheet" href="/mero.css">
    <link rel="stylesheet" href="/mero-workspace.css"><body>${components.get("native-select").demo}${components.get("cell-switch").demo}
    <select class="mero-select" multiple aria-label="Multiple"><option>North</option><option>West</option></select></body>` }));
  const cases = [
    { pageType: "catalog", theme: "dark", dir: "ltr", zoom: 1 },
    { pageType: "catalog", theme: "light", dir: "rtl", zoom: 1.25 },
    { pageType: "plain", theme: "dark", dir: "rtl", zoom: 1 },
    { pageType: "plain", theme: "light", dir: "ltr", zoom: 2 },
  ];
  for (const config of cases) {
    for (const id of ["native-select", "cell-switch"]) {
      await page.goto(base + (config.pageType === "plain" ? "/plain" : "/components/" + id));
      await page.evaluate(({ theme, dir, zoom }) => {
        document.documentElement.dataset.theme = theme;
        document.documentElement.dir = dir;
        document.body.style.zoom = zoom;
      }, config);
      const subject = config.pageType === "plain" ? page.locator("body") : page.locator("[data-sample-scope]");
      if (id === "native-select") {
        const select = subject.getByRole("combobox", { name: /Default workspace/ });
        await select.selectOption({ label: "Archive" });
        assert.equal(await select.inputValue(), "Archive");
        const chevron = await indicatorBounds(select, "chevron");
        const end = config.dir === "rtl" ? chevron.left : chevron.right;
        near(end, 13 * config.zoom, "native select ink at inline end", 1.75);
        near(chevron.top, chevron.bottom, "vertically centered chevron", 2 * config.zoom);
        near(chevron.width, 10 * config.zoom, "chevron width", 2);
        assert.ok(await select.evaluate(el => parseFloat(getComputedStyle(el).paddingInlineEnd) >= 32));
        await select.evaluate(el => { el.disabled = true; });
        assert.equal(await select.isDisabled(), true);
        assert.equal(await select.evaluate(el => getComputedStyle(el).cursor), "not-allowed");
      } else {
        const toggle = subject.getByRole("switch");
        for (const checked of [true, false]) {
          await toggle.setChecked(checked);
          const contrast = await toggle.evaluate(el => {
            const ctx = document.createElement("canvas").getContext("2d");
            function luminance(color) {
              ctx.fillStyle = color;
              ctx.fillRect(0, 0, 1, 1);
              const rgb = Array.from(ctx.getImageData(0, 0, 1, 1).data).slice(0, 3).map(value => {
                const v = value / 255;
                return v <= .04045 ? v / 12.92 : ((v + .055) / 1.055) ** 2.4;
              });
              return .2126 * rgb[0] + .7152 * rgb[1] + .0722 * rgb[2];
            }
            const track = luminance(getComputedStyle(el).backgroundColor);
            const thumb = luminance(getComputedStyle(el, "::before").backgroundColor);
            return (Math.max(track, thumb) + .05) / (Math.min(track, thumb) + .05);
          });
          assert.ok(contrast >= 3, "thumb contrasts with the track: " + contrast);
          const thumb = await indicatorBounds(toggle, "thumb");
          const nearEdge = checked === (config.dir === "ltr") ? thumb.right : thumb.left;
          near(nearEdge, 3 * config.zoom, "thumb at track end");
          near(thumb.top, 3 * config.zoom, "thumb from top");
          near(thumb.bottom, 3 * config.zoom, "thumb from bottom");
          near(thumb.width, 18 * config.zoom, "thumb width");
          near(thumb.height, 18 * config.zoom, "thumb height");
        }
        await toggle.focus();
        await toggle.press("Space");
        assert.equal(await toggle.isChecked(), true);
        await toggle.evaluate(el => { el.disabled = true; });
        assert.equal(await toggle.isDisabled(), true);
        assert.equal(await toggle.evaluate(el => getComputedStyle(el).cursor), "not-allowed");
      }
    }
  }
  assert.equal(await page.getByRole("listbox", { name: "Multiple" }).evaluate(el => getComputedStyle(el).backgroundImage), "none");
  await page.emulateMedia({ forcedColors: "active" });
  if (await page.evaluate(() => matchMedia("(forced-colors: active)").matches)) {
    const select = page.getByRole("combobox", { name: /Default workspace/ });
    assert.equal(await select.evaluate(el => getComputedStyle(el).backgroundImage), "none");
    assert.equal(await select.evaluate(el => getComputedStyle(el).appearance), "auto");
    const thumb = await indicatorBounds(page.getByRole("switch"), "thumb");
    assert.ok(thumb.width > 0 && thumb.height > 0, "the high-contrast thumb remains visible");
  }
});
