import pkg from "../package.json" with { type: "json" };
import { components, groups } from "./catalog.mjs";
import { exampleAssets } from "./catalog-pages.mjs";
import { selectVariant } from "./examples.mjs";
import { assetStyles, assetScripts } from "./shell.mjs";
import { referenceMarkdown } from "./reference.mjs";

const release = `Mero UI ${pkg.version}`;
const patternsFile = "llms-patterns.txt";
export const agentIndexes = ["llms.txt", patternsFile, "llms-components.txt", "llms-full.txt"];

function index() {
  const sections = groups.map(group => [
    "## " + group.name,
    group.items.map(item => `- [${item.name}](components/${item.id}.md) — ${item.description}`).join("\n"),
  ].join("\n\n"));
  return [
    "# Mero UI",
    `> ${release} provides HTML components and HTMX 4 patterns for server-rendered applications.`,
    "Choose a component to find its variants, templates and required assets. Use the bundled index for the release installed in your application.",
    "## Guides",
    "- [Integration patterns and API reference](llms-patterns.txt)\n- [All component templates](llms-components.txt)\n- [Patterns, reference and all templates in one file](llms-full.txt)",
    ...sections,
  ].join("\n\n") + "\n";
}

function patterns() {
  return [
    `# ${release} integration patterns`,
    "## Install a component",
    "Copy the selected HTML template into your server-rendered page. Serve the listed Mero scripts, stylesheets and media from your static directory. The release package keeps these files in ui/. For requests, serve htmx.org@4’s dist/htmx.min.js at the path used by the template. Load HTMX before mero.js, followed by the listed family scripts.",
    "## Connect an HTML endpoint",
    "Replace demonstration URLs with your routes and render user data with your template engine’s HTML escaping. Return the fragment expected by hx-target and hx-swap. Preserve explicit wrapper inheritance such as hx-target:inherited. Keep validation, permissions and persistence in your handler.",
    "For a validating data-mero-form, return the filled form with HTTP 422 and mark the invalid field. For Typed Confirmation, keep the original form on a successful save using the response headers under mero:form-saved below.",
    "## Apply a theme and coexist with Tailwind CSS v4",
    "Load optional ui/mero-themes.css after mero.css for composable presets (cobalt, fern, clay, editorial) and structural modifiers (compact, flat, crisp) alongside light, dark or auto on data-theme (e.g. data-theme=\"cobalt dark compact\"), or override --mero-* tokens including --mero-border-width and --mero-depth. For zero-JS constraint validation hints, add .mero-validator on an input/select/textarea with a sibling .mero-validator-hint. When using Tailwind CSS v4 alongside Mero, declare `@layer theme, base, mero, components, utilities;` before importing Tailwind and mero.css.",
    referenceMarkdown(),
  ].join("\n\n") + "\n";
}

function componentDocument(item, standalone) {
  const blocks = ["# " + item.name, `${release} · ${item.category}`, item.description];
  if (standalone) blocks.push("[Integration patterns and API reference](../llms-patterns.txt)");
  if (item.serverHelper) blocks.push(`Optional server helper: \`ui/${item.serverHelper}\`.`);
  for (const variant of ["Default", ...(item.variants ?? []).map(option => option.name)]) {
    const sample = selectVariant(item, new URLSearchParams({ variant }));
    const assets = exampleAssets(item, sample.demo);
    blocks.push("## " + variant);
    if (sample.description !== item.description) blocks.push(sample.description);
    if (sample.notes) blocks.push([sample.notes].flat().join(" "));
    if (sample.demo.includes("studio-lamp.webp")) blocks.push("Serve studio-lamp.webp for the sample image.");
    const head = [assetStyles(assets), assetScripts(assets)].filter(Boolean).join("\n");
    blocks.push("Page assets", "```html\n" + head + "\n```", "Template", "````html\n" + sample.code + "\n````");
  }
  return blocks.join("\n\n") + "\n";
}

// Both the HTTP routes and npm prepack consume these release-specific documents.
export function agentDocument(file) {
  if (file === "llms.txt") return index();
  if (file === patternsFile) return patterns();
  if (file === "llms-components.txt" || file === "llms-full.txt") {
    const intro = file === "llms-full.txt" ? patterns() : `# ${release} component templates\n`;
    return intro + "\n" + Array.from(components.values(), item => componentDocument(item, false)).join("\n");
  }
  const id = /^components\/([a-z0-9-]+)\.md$/.exec(file)?.[1];
  const item = components.get(id);
  return item && componentDocument(item, true);
}
