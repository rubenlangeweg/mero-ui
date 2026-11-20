// Local contributor check. The library itself has no browser-test dependencies.
import { browserConfig } from "./browser-config.mjs";
import { createRequire } from "node:module";
import { createApp } from "../server.mjs";
import { captureExample, writeReviewIndex } from "./review-captures.mjs";
import { components } from "../site/catalog.mjs";
import { showcaseApps } from "../site/app-examples.mjs";
import { studioViews } from "../site/studio.mjs";

const require = createRequire(import.meta.url);
const { chromium } = await import(browserConfig.playwrightModule || "playwright");
const axe = process.env.MERO_AXE_PATH || require.resolve("axe-core/axe.min.js");
const requested = process.argv.slice(2);
const captures = [];
const captureDir = process.env.MERO_REVIEW_DIR;
const examples = [...components.values()].flatMap(item => [
  item.id,
  ...(item.variants || []).map(variant => item.id + "?variant=" + encodeURIComponent(variant.name)),
]);
const siteRoutes = [
  "/", "/start", "/docs/design-principles", "/docs/responsive-layouts", "/components", "/playground", "/playground?scenario=settings", "/playground?scenario=report", "/themes", "/layouts",
  ...[...showcaseApps.map(app => app.id), "settings"].flatMap(id => ["/layouts/" + id, "/layouts/" + id + "?embed=1"]),
  ...Object.keys(studioViews).filter(view => view !== "overview").map(view => "/layouts/dashboard?view=" + view),
  "/layouts/dashboard?view=companies&company=forma", "/layouts/dashboard?view=board&display=list&task=ST-103",
  "/layouts/dashboard?view=calendar&display=agenda", "/docs/responsive-layouts?width=360&company=forma",
];
function viewportIssues() {
  const issues = [];
  const overflow = document.documentElement.scrollWidth - innerWidth;
  if (overflow > 1) issues.push({ overflow });
  if (location.pathname.startsWith("/layouts/")) {
    const canvas = document.querySelector(".app-example-stage [data-sample-scope], .layout-embed > main");
    const available = canvas?.clientWidth || 0;
    const appWidth = canvas?.firstElementChild?.getBoundingClientRect().width || 0;
    if (!available || appWidth < available / 2) issues.push({ appWidth, available });
  }
  return issues;
}
async function checkNarrowReflow(page) {
  const viewport = page.viewportSize();
  const problems = [];
  try {
    await page.setViewportSize({ width: 320, height: viewport.height });
    for (const direction of ["ltr", "rtl"]) {
      await page.evaluate(async dir => {
        const root = document.documentElement;
        root.dir = dir;
        root.style.fontSize = "125%";
        await document.fonts.ready;
      }, direction);
      for (const issue of await page.evaluate(viewportIssues)) problems.push({ width: 320, textSize: "125%", direction, ...issue });
    }
  } finally {
    await page.setViewportSize(viewport);
  }
  return problems;
}

const routes = requested.length === 1 && requested[0] === "--all"
  ? [...siteRoutes, ...examples.map(id => "/components/" + id), ...examples.map(id => "/preview/" + id)]
  : requested.length ? requested : examples.map(id => "/preview/" + id);
if (!routes.every(route => /^\/[a-z0-9/-]*(?:\?[a-z0-9=&%-]*)?$/i.test(route))) {
  throw new Error("Use local routes such as /preview/carousel.");
}
const server = createApp();
const browser = await chromium.launch({ executablePath: browserConfig.chromeExecutable });
try {
  await new Promise((resolve, reject) => server.once("error", reject).listen(0, "127.0.0.1", resolve));
  const base = "http://127.0.0.1:" + server.address().port;
  const failures = [];
  const scenarios = [
    { width: 360, height: 800, theme: "dark" },
    { width: 1280, height: 900, theme: "light" },
  ];
  for (const { width, height, theme } of scenarios) {
    const context = await browser.newContext({ viewport: { width, height }, reducedMotion: "reduce" });
    await context.addInitScript(value => localStorage.setItem("mero-theme", value), theme);
    const queue = [...routes];
    await Promise.all(Array.from({ length: Math.min(4, queue.length) }, async () => {
      const page = await context.newPage();
      let problems = [];
      page.on("pageerror", error => problems.push(error.message));
      page.on("response", response => {
        if (response.status() >= 400) problems.push(response.status() + " " + response.url());
      });
      while (queue.length) {
        const route = queue.shift();
        problems = [];
        try {
          const url = new URL(route, base);
          if (url.pathname.startsWith("/preview/") || url.searchParams.get("embed") === "1") url.searchParams.set("theme", theme);
          await page.goto(url.href);
          await page.evaluate(() => document.fonts.ready);
          await page.addScriptTag({ path: axe });
          const checks = await page.evaluate(async () => {
            const { violations } = await window.axe.run(document, { resultTypes: ["violations"] });
            const missingReferences = [];
            for (const attr of ["aria-labelledby", "aria-describedby", "aria-controls", "for"]) {
              for (const el of document.querySelectorAll("[" + attr + "]")) {
                for (const id of el.getAttribute(attr).trim().split(/\s+/).filter(Boolean)) {
                  if (!document.getElementById(id)) missingReferences.push({ attr, id, element: el.localName });
                }
              }
            }
            return {
              missingReferences,
              violations: violations.map(rule => ({
                rule: rule.id, impact: rule.impact,
                nodes: rule.nodes.map(node => ({ target: node.target, description: node.failureSummary })),
              })),
            };
          });
          if (captureDir && url.pathname.startsWith("/preview/")) {
            captures.push(await captureExample(page, route, captureDir, { width, theme }));
          }
          const geometry = await page.evaluate(viewportIssues);
          const reflow = width === 360 && /^\/(preview|layouts)\//.test(url.pathname) ? await checkNarrowReflow(page) : [];
          if (geometry.length || checks.violations.length || checks.missingReferences.length || reflow.length || problems.length) {
            failures.push({ route, width, theme, ...checks, geometry, reflow, errors: problems });
          }
        } catch (error) {
          failures.push({ route, width, theme, errors: [error.message] });
        }
      }
      await page.close();
    }));
    await context.close();
    console.error(`${routes.length} routes checked at ${width}px in ${theme} theme`);
  }
  const audit = { pagesChecked: routes.length * scenarios.length, failures };
  if (captureDir) await writeReviewIndex(captureDir, captures, audit);
  console.log(JSON.stringify(audit, null, 2));
  if (failures.length) process.exitCode = 1;
} finally {
  await browser.close();
  if (server.listening) await new Promise(resolve => server.close(resolve));
}
