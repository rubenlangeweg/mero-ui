// Refresh the gallery and homepage artwork from a fresh, local example server.
import { browserConfig } from "./browser-config.mjs";
import { writeFile } from "node:fs/promises";
import { createApp } from "../server.mjs";
import { showcaseApps } from "../site/app-examples.mjs";

const { chromium } = await import(browserConfig.playwrightModule || "playwright");
const server = createApp();
const ids = [...showcaseApps.map(app => app.id), "settings"];
const selected = process.argv.slice(2);
if (selected.some(id => !ids.includes(id))) throw new Error("Unknown layout to capture");
const browser = await chromium.launch({ executablePath: browserConfig.chromeExecutable });
const frames = [
  { width: 1120, outputWidth: 1620, outputHeight: 900, scale: 1.5, suffix: "" },
  { width: 390, outputWidth: 780, outputHeight: 640, scale: 2, suffix: "-phone" },
];
try {
  await new Promise((resolve, reject) => server.once("error", reject).listen(0, "127.0.0.1", resolve));
  const base = `http://127.0.0.1:${server.address().port}`;
  for (const frame of frames) {
    const context = await browser.newContext({ viewport: { width: frame.width, height: 900 }, deviceScaleFactor: frame.scale, reducedMotion: "reduce" });
    const page = await context.newPage();
    for (const theme of ["light", "dark"]) {
      for (const id of selected.length ? selected : ids) {
        const response = await page.goto(base + "/layouts/" + id + "?embed=1&theme=" + theme);
        if (!response?.ok()) throw new Error("Could not open " + id);
        await page.evaluate(() => document.fonts.ready);
        const stage = page.locator("main > :first-child");
        const bounds = await stage.boundingBox();
        if (!bounds || bounds.width < frame.width * .8) throw new Error("Missing preview for " + id);
        // Capture the embedded page, including the gutters around its content.
        const image = await page.screenshot({ animations: "disabled", clip: {
          x: 0, y: 0, width: frame.width,
          height: Math.ceil(frame.width * frame.outputHeight / frame.outputWidth),
        } });
        const webp = await page.evaluate(async ({ data, outputWidth, outputHeight }) => {
          const bitmap = new Image();
          bitmap.src = "data:image/png;base64," + data;
          await bitmap.decode();
          const canvas = document.createElement("canvas");
          canvas.width = outputWidth;
          canvas.height = outputHeight;
          const drawing = canvas.getContext("2d");
          drawing.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
          return canvas.toDataURL("image/webp", .91).split(",")[1];
        }, { data: image.toString("base64"), outputWidth: frame.outputWidth, outputHeight: frame.outputHeight });
        await writeFile(new URL(`../public/example-${id}-${theme}${frame.suffix}.webp`, import.meta.url), Buffer.from(webp, "base64"));
      }
    }
    await context.close();
  }
} finally {
  await browser.close();
  if (server.listening) await new Promise(resolve => server.close(resolve));
}
