// Lists the public names Mero ships in ui/ and compares them with the reviewed snapshot in test/api-surface.json.
// `--write` updates the snapshot after an addition. Without it the script only reports what was removed or added.
// Removing or renaming a name is a breaking change: see Stability in the README.
import { readdir, readFile, writeFile } from "node:fs/promises";

const root = new URL("../", import.meta.url);
const files = (await readdir(new URL("ui/", root))).sort();
const read = async pattern => (await Promise.all(files.filter(file => pattern.test(file)).map(file => readFile(new URL("ui/" + file, root), "utf8")))).join("\n");
const scripts = await read(/\.js$/);
const modules = await read(/\.mjs$/);
const code = scripts + "\n" + modules;
const all = code + await read(/\.css$/);
const names = (source, pattern) => [...new Set(source.match(pattern))].sort();

const surface = {
  // dataset.meroReturnFocus is data-mero-return-focus.
  attributes: names(all.replace(/dataset\.(mero[A-Za-z]+)/g, (_, key) => "data-" + key.replace(/[A-Z]/g, letter => "-" + letter.toLowerCase())), /data-mero-[a-z-]*[a-z]/g),
  // The whole name, not its lowercase prefix: a rename to mero:queryReady must show up as a removal.
  events: names(code, /mero:[\w:-]*\w/g),
  api: scripts.match(/window\.MeroUI = Object\.freeze\(\{([^}]+)\}\)/)[1].split(",").map(name => name.split(":")[0].trim()).sort(),
  headers: names(code, /\bMero-[A-Z][A-Za-z]*(?:-[A-Z][A-Za-z]*)*/g),
  tokens: names(all, /--mero-[a-z0-9-]*[a-z0-9]/g),
  exports: [...new Set([
    ...[...modules.matchAll(/^export (?:async )?(?:function\*?|const|let|var|class) (\w+)/gm)].map(match => match[1]),
    // export { a, b as c } exports a and c.
    ...[...modules.matchAll(/^export \{([^}]*)\}/gm)].flatMap(match => match[1].split(",").map(name => name.trim().split(/\s+as\s+/).pop()).filter(Boolean))
  ])].sort()
};

const path = new URL("test/api-surface.json", root);
if (process.argv.includes("--write")) {
  await writeFile(path, JSON.stringify(surface, null, 2) + "\n");
} else {
  const snapshot = JSON.parse(await readFile(path, "utf8"));
  const removed = [], added = [];
  for (const kind of Object.keys(surface)) {
    removed.push(...(snapshot[kind] ?? []).filter(name => !surface[kind].includes(name)));
    added.push(...surface[kind].filter(name => !(snapshot[kind] ?? []).includes(name)));
  }
  if (removed.length) console.error(`Removed from the public API: ${removed.join(", ")}. That is a breaking change: keep the name and deprecate it first (README, Stability).`);
  if (added.length) console.error(`New public names: ${added.join(", ")}. Run node scripts/api-surface.mjs --write and commit test/api-surface.json.`);
  if (removed.length || added.length) process.exitCode = 1;
}
