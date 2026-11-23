// Stamps every script and stylesheet in ui/ with the package name and version, so a vendored copy says which release it is.
// npm version runs this. After editing the version by hand, run `npm run banner`. `--check` only reports stale files.
import { readdir, readFile, writeFile } from "node:fs/promises";

const root = new URL("../", import.meta.url);
const { name, version, license } = JSON.parse(await readFile(new URL("package.json", root), "utf8"));
const banner = `/*! ${name} ${version} | ${license} */\n`;
const check = process.argv.includes("--check");
const stale = [];

for (const file of (await readdir(new URL("ui/", root))).filter(file => /\.(m?js|css)$/.test(file)).sort()) {
  const path = new URL("ui/" + file, root);
  const source = await readFile(path, "utf8");
  if (source.startsWith(banner)) continue;
  stale.push("ui/" + file);
  if (!check) await writeFile(path, banner + source.replace(/^\/\*! \S+ \S+ \| \S+ \*\/\n/, ""));
}

if (check && stale.length) {
  console.error(`Missing the ${version} banner: ${stale.join(", ")}. Run npm run banner.`);
  process.exitCode = 1;
} else if (stale.length) {
  console.log(`Stamped ${stale.length} file${stale.length === 1 ? "" : "s"} with ${name} ${version}.`);
}
