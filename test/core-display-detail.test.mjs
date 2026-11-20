import { browserConfig } from "../scripts/browser-config.mjs";
import assert from "node:assert/strict";
import test from "node:test";
import { createApp } from "../server.mjs";

const playwright = await import(browserConfig.playwrightModule || "playwright").catch(error => {
  if (error.code === "ERR_MODULE_NOT_FOUND" && !browserConfig.playwrightModule) return null;
  throw error;
});

test("core display controls keep their geometry through keyboard, pointer and direction changes", {
  skip: !playwright && "Install Playwright for this browser check",
}, async t => {
  const server = createApp();
  await new Promise((resolve, reject) => server.once("error", reject).listen(0, "127.0.0.1", resolve));
  t.after(() => new Promise(resolve => server.close(resolve)));
  const engine = browserConfig.engine || "chromium";
  const browser = await playwright[engine].launch({ executablePath: engine === "chromium" ? browserConfig.chromeExecutable : undefined });
  t.after(() => browser.close());
  const page = await browser.newPage({ viewport: { width: 360, height: 700 }, reducedMotion: "reduce" });
  const preview = (id, theme = "dark") => page.goto("http://127.0.0.1:" + server.address().port + "/preview/" + id + "?theme=" + theme);
  const rect = locator => locator.boundingBox();
  const middle = (box, axis) => box[axis] + box[axis === "x" ? "width" : "height"] / 2;

  for (const theme of ["dark", "light"]) {
    await preview("close-button", theme);
    await page.locator("[data-rl-open]").click();
    const close = page.getByRole("button", { name: "Close release details" });
    const button = await rect(close);
    const mark = await rect(close.locator(".rl-dismiss-mark"));
    assert.ok(button.width >= 32 && Math.abs(button.width - button.height) < 1);
    assert.ok(mark.width >= 14 && mark.height >= 14);
    for (const axis of ["x", "y"]) assert.ok(Math.abs(middle(button, axis) - middle(mark, axis)) < 1);
    await close.press("Enter");
    await page.locator("dialog").waitFor({ state: "hidden" });

    await preview("separator", theme);
    const rule = await rect(page.getByRole("separator"));
    const stack = await rect(page.locator(".rl-stack"));
    assert.ok(rule.width > 100 && Math.abs(stack.width - rule.width) < 1);
    assert.equal(rule.height, 1);

    await preview("tag-group", theme);
    const topics = page.getByRole("list", { name: "Topics" });
    const bounds = await rect(topics);
    const firstTag = await rect(topics.getByRole("listitem").first());
    assert.ok(Math.abs(firstTag.x - bounds.x) < 1);

    await preview("toggle-button-group", theme);
    const list = page.getByRole("radio", { name: "List", exact: true });
    const grid = page.getByRole("radio", { name: "Grid", exact: true });
    await list.focus();
    await list.press("ArrowRight");
    assert.ok(await grid.isChecked());
    assert.equal(await list.isChecked(), false);
    const segment = await rect(grid);
    assert.ok(segment.width >= 32 && segment.height >= 32);
    assert.ok(await grid.evaluate(el => getComputedStyle(el.parentElement).outlineStyle !== "none"));
    await grid.press("ArrowLeft");
    assert.ok(await list.isChecked());

    await preview("list-box", theme);
    const options = page.getByRole("option");
    await options.first().focus();
    await options.first().press("ArrowDown");
    await options.nth(1).press("Enter");
    assert.equal(await options.nth(1).getAttribute("aria-selected"), "true");
    assert.equal(await options.nth(1).evaluate(el => getComputedStyle(el, "::after").content), '""');
    assert.equal(await options.first().evaluate(el => getComputedStyle(el, "::after").content), "none");

    await preview("dropdown", theme);
    const opener = page.getByRole("button", { name: "Open menu" });
    await opener.press("Enter");
    const popup = page.locator(":popover-open");
    await popup.waitFor();
    const trigger = await rect(opener);
    const menu = await rect(popup);
    if (await page.evaluate(() => CSS.supports("position-area", "block-end"))) {
      const gap = menu.y - (trigger.y + trigger.height);
      assert.ok(gap >= 4 && gap <= 12, "menu gap is " + gap);
    }
    await page.keyboard.press("Escape");
    await popup.waitFor({ state: "hidden" });
  }

  await page.setViewportSize({ width: 320, height: 700 });
  await preview("skeleton");
  for (const scale of ["125%", "200%"]) {
    for (const dir of ["ltr", "rtl"]) {
      const sizes = await page.evaluate(({ scale, dir }) => {
        document.documentElement.style.fontSize = scale;
        document.documentElement.dir = dir;
        return {
          viewport: innerWidth,
          document: document.documentElement.scrollWidth,
          group: document.querySelector('[aria-busy="true"]').getBoundingClientRect().width,
          bars: [...document.querySelectorAll(".rl-skeleton")].map(el => el.getBoundingClientRect().width),
        };
      }, { scale, dir });
      assert.equal(sizes.document, sizes.viewport);
      assert.ok(sizes.group <= sizes.viewport && sizes.bars.every(w => w > 0 && w <= sizes.group));
    }
  }

  await page.setViewportSize({ width: 960, height: 700 });
  await preview("drawer");
  await page.evaluate(() => { document.documentElement.dir = "rtl"; });
  await page.locator("[data-rl-open]").click();
  const drawer = page.getByRole("dialog");
  const drawerRect = await rect(drawer);
  assert.ok(drawerRect.x < 1 && drawerRect.width < 960);
  const radii = await drawer.evaluate(el => [getComputedStyle(el).borderTopLeftRadius, getComputedStyle(el).borderTopRightRadius]);
  assert.equal(parseFloat(radii[0]), 0);
  assert.ok(parseFloat(radii[1]) > 0);
});
