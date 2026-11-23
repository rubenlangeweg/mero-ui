import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";

async function main([command, id, variant = "Default", ...extra]) {
  if (extra.length || !(command === "list" && !id || command === "show" && id)) {
    throw new Error("Usage from a Mero source checkout: catalog.mjs list | show <id> [variant]");
  }

  const pkg = JSON.parse(await readFile("package.json", "utf8").catch(() => "null"));
  if (pkg?.name !== "@rubenlangeweg/mero-ui") {
    throw new Error("Run from the root of the Mero UI source checkout for the app's release.");
  }
  const source = file => pathToFileURL(resolve("site", file)).href;
  const { components } = await import(source("catalog.mjs"));
  if (command === "list") {
    for (const item of components.values()) {
      const variants = (item.variants ?? []).map(option => option.name);
      console.log([item.id, item.name, ...variants].join("\t"));
    }
    return;
  }

  const item = components.get(id);
  if (!item) throw new Error(`Unknown component "${id}". Run list to see component IDs.`);
  const variants = ["Default", ...(item.variants ?? []).map(option => option.name)];
  if (!variants.includes(variant)) throw new Error(`Available variants for ${id}: ${variants.join(", ")}`);

  const { selectVariant } = await import(source("examples.mjs"));
  const { exampleAssets } = await import(source("catalog-pages.mjs"));
  const sample = selectVariant(item, new URLSearchParams({ variant }));
  const assets = exampleAssets(item, sample.demo);
  if (sample.demo.includes("studio-lamp.webp")) assets.push("studio-lamp.webp");
  console.log(JSON.stringify({
    version: pkg.version, id, variant, description: sample.description, notes: sample.notes,
    assets, serverHelper: item.serverHelper, template: sample.code,
  }, null, 2));
}

main(process.argv.slice(2)).catch(error => {
  console.error(error.message);
  process.exitCode = 1;
});
