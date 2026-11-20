import { browserConfig } from "../scripts/browser-config.mjs";
import assert from "node:assert/strict";
import test from "node:test";
import { createApp } from "../server.mjs";

const playwright = await import(browserConfig.playwrightModule || "playwright").catch(error => {
  if (error.code === "ERR_MODULE_NOT_FOUND" && !browserConfig.playwrightModule) return null;
  throw error;
});

const browserOptions = { skip: !playwright && "Install Playwright for browser checks" };

async function fixture(t, viewport) {
  const app = createApp();
  await new Promise(resolve => app.listen(0,"127.0.0.1",resolve));
  const engine = browserConfig.engine || "chromium";
  const browser = await playwright[engine].launch({
    executablePath:engine === "chromium" ? browserConfig.chromeExecutable : undefined,
  });
  t.after(async () => {
    await browser.close();
    await new Promise(resolve => app.close(resolve));
  });
  const base = "http://127.0.0.1:" + app.address().port;
  const page = await browser.newPage({viewport,reducedMotion:"reduce"});
  page.setDefaultTimeout(8_000);
  return { page, base };
}

test("workspace and gallery interactions survive hidden panels, resized viewports and delayed responses", browserOptions, async t => {
  const { page, base } = await fixture(t, {width:390,height:844});
  const errors = [];
  page.on("pageerror",error => errors.push(error.message));

  await page.goto(base + "/components/command");
  await page.getByRole("tab",{name:"Template"}).click();
  await page.keyboard.press("Control+k");
  assert.equal(await page.locator("dialog[open]").count(),0);
  const preview = page.getByRole("tab",{name:"Preview"});
  await preview.click();
  await page.keyboard.press("Control+k");
  await page.getByRole("dialog",{name:"Workspace commands"}).waitFor();
  await page.keyboard.press("Escape");
  await page.waitForFunction(() => document.activeElement?.textContent.trim() === "Preview");

  await page.goto(base + "/preview/emoji-picker");
  await page.getByRole("button",{name:"Choose a reaction"}).click();
  await page.getByRole("searchbox").press("ArrowDown");
  await page.keyboard.press("ArrowRight");
  await page.keyboard.press("ArrowDown");
  assert.equal(await page.evaluate(() => document.activeElement.getAttribute("aria-label")),"watching");
  await page.keyboard.press("Enter");
  assert.match(await page.locator("output").textContent(),/watching/);

  await page.goto(base + "/preview/context-menu");
  const actions = page.getByRole("button",{name:"Actions"});
  await actions.click();
  await page.getByRole("menu").waitFor();
  await page.setViewportSize({width:320,height:650});
  await page.getByRole("menu").waitFor({state:"hidden"});
  assert.equal(await actions.evaluate(el => el === document.activeElement),true);

  await page.goto(base + "/preview/drop-zone");
  let completeUpload;
  const delayed = new Promise(resolve => { completeUpload = resolve; });
  await page.route("**/demo/workspace/upload",async route => {
    await delayed;
    await route.fulfill({body:"A.png passed the image check."});
  });
  const file = {name:"A.png",mimeType:"image/png",buffer:Buffer.from([137,80,78,71,13,10,26,10])};
  const picker = page.locator('input[type="file"]');
  await picker.setInputFiles(file);
  await Promise.all([page.waitForRequest("**/demo/workspace/upload"),page.getByText("Check image").click()]);
  await picker.setInputFiles({...file,name:"B.png"});
  await page.evaluate(() => document.addEventListener("htmx:afterRequest",() => { document.body.dataset.uploadSettled = "true"; },{once:true}));
  completeUpload();
  await page.waitForFunction(() => document.body.dataset.uploadSettled === "true");
  assert.equal(await page.locator("output").textContent(),"");
  assert.equal(await page.locator(".rlw-file-name").textContent(),"B.png");

  await page.goto(base + "/preview/carousel");
  await page.evaluate(() => {
    const gallery = document.querySelector("mero-gallery");
    const panel = document.createElement("section");
    panel.hidden = true;
    gallery.before(panel);
    gallery.remove();
    gallery.querySelector('input[value="sand"]').checked = true;
    panel.append(gallery);
    requestAnimationFrame(() => { panel.hidden = false; });
  });
  await page.waitForFunction(() => {
    const gallery = document.querySelector("mero-gallery");
    const track = gallery.querySelector(".mero-gallery-track").getBoundingClientRect();
    const selected = gallery.querySelector('[data-mero-slide="sand"]').getBoundingClientRect();
    return track.width > 0 && Math.abs(track.left - selected.left) < 2;
  });
  assert.equal(await page.locator("mero-gallery output").textContent(),"Warm sand");

  await page.goto(base + "/preview/diff");
  await page.locator("html").evaluate(el => { el.dir = "rtl"; });
  const captions = await page.locator(".mero-diff-caption span").evaluateAll(items => items.map(el => el.getBoundingClientRect().left));
  assert.ok(captions[0] < captions[1],"the ivory caption should match the physical left side of the photographs");
  assert.deepEqual(errors,[]);
});

test("workspace control rows, icon buttons and disclosures keep their hit areas and alignment", browserOptions, async t => {
  const { page, base } = await fixture(t, {width:360,height:750});
  const open = id => page.goto(base + "/preview/" + id);
  await open("cell-switch");
  const row = page.locator(".rlw-cell-row");
  const toggle = page.getByRole("switch");
  const bounds = await row.boundingBox();
  const control = await toggle.boundingBox();
  assert.ok(Math.abs(bounds.y + bounds.height / 2 - control.y - control.height / 2) < 1);
  // Tapping the description is a real native-label activation, including the HTMX change request.
  await row.getByText("Receive an update when a release is ready.").click();
  await page.getByText("Release notifications: off").waitFor();
  assert.equal(await toggle.isChecked(), false);
  await toggle.press("Space");
  await page.getByText("Release notifications: on").waitFor();

  await open("cell-color-picker");
  await page.locator('input[type=color]').fill("#357b80");
  await page.getByText("Workspace accent: #357b80").waitFor();
  await open("cell-select");
  await page.getByRole("combobox").selectOption("Sunday");
  await page.getByText("Start of week: Sunday").waitFor();
  await open("cell-slider");
  await page.getByRole("slider").press("ArrowRight");
  await page.getByText("Preview size: 85%").waitFor();
  for (const [id, value] of [["native-select","Production"], ["inline-select","Everyone"]]) {
    await open(id);
    const select = page.getByRole("combobox");
    await select.selectOption(value);
    assert.equal(await select.inputValue(),value);
    assert.ok(await select.evaluate(el => el.classList.contains("mero-select")));
  }

  await open("checkbox-button-group");
  await page.getByText("Publish on the storefront").click();
  assert.equal(await page.getByRole("checkbox", {checked:true}).count(), 2);
  await open("radio-button-group");
  await page.getByText("Use the workspace calendar").click();
  assert.equal(await page.locator("input:checked").inputValue(), "scheduled");
  await open("segment");
  await page.getByText("Spacious").click();
  assert.equal(await page.locator("input:checked").inputValue(), "spacious");
  await open("number-stepper");
  await page.getByRole("button",{name:"Add one seat"}).click();
  assert.equal(await page.getByRole("spinbutton").inputValue(), "4");
  await open("rich-text-editor");
  const bold = await page.getByRole("button",{name:"Bold",exact:true}).boundingBox();
  const italic = await page.getByRole("button",{name:"Italic",exact:true}).boundingBox();
  assert.ok(Math.abs(bold.width - italic.width) < .1 && Math.abs(bold.height - italic.height) < .1);
  assert.ok(bold.width >= 36);
  await open("dock");
  const widths = await page.locator(".rlw-dock a").evaluateAll(items => items.map(el => el.getBoundingClientRect().width));
  assert.ok(Math.max(...widths) - Math.min(...widths) < 1);
  await page.getByRole("link",{name:"Inventory"}).click();
  assert.equal(page.url(), base + "/layouts/dashboard?view=inventory");
  await open("megamenu");
  const summary = page.locator("summary");
  assert.ok((await summary.boundingBox()).height >= 44);
  await summary.click({position:{x:4,y:4}});
  await page.getByRole("link",{name:"Form controls"}).click();
  assert.equal(new URL(page.url()).pathname, "/components/native-select");
  await open("fab");
  await page.locator("summary").press("Enter");
  await page.getByRole("link",{name:"Workspace settings"}).click();
  assert.equal(page.url(), base + "/layouts/dashboard?view=settings");
  for (const id of ["app-layout","sidebar"]) {
    await open(id);
    await page.getByRole("button",{name:"Open navigation"}).click();
    await page.getByRole("dialog").getByRole("link",{name:"Inventory"}).click();
    assert.equal(page.url(), base + "/layouts/dashboard?view=inventory");
  }
  await open("navbar");
  await page.getByRole("link",{name:"Overview"}).click();
  assert.equal(new URL(page.url()).pathname, "/layouts/dashboard");
  await open("file-input");
  await page.locator('input[type=file]').setInputFiles({name:"sample.png",mimeType:"image/png",buffer:Buffer.from([137,80,78,71,13,10,26,10])});
  assert.equal(await page.locator(".rlw-file-name").count(),0);
  await page.getByRole("button",{name:"Check image"}).click();
  await page.locator("output").filter({hasText:"sample.png"}).waitFor();
});
