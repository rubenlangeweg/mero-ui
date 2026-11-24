import test from "node:test";
import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import { appendFile, cp, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { promisify } from "node:util";

const root = new URL("../", import.meta.url);
const snapshot = async () => JSON.parse(await readFile(new URL("test/api-surface.json", root), "utf8"));

test("the public names in ui/ match the reviewed snapshot", async () => {
  // Fails with the removed and added names. A removal needs a deprecation first, see Stability in the README.
  await promisify(execFile)(process.execPath, ["scripts/api-surface.mjs", "--check"], { cwd: root });
});

test("the snapshot covers every gated surface, sorted", async () => {
  const surface = await snapshot();
  assert.deepEqual(Object.keys(surface), ["attributes", "events", "api", "headers", "tokens", "exports"]);
  for (const [kind, names] of Object.entries(surface)) {
    assert.ok(names.length, kind);
    assert.deepEqual(names, [...new Set(names)].sort(), kind);
  }
});

test("event names are lowercase kebab-case, so any attribute-based listener can name them", async () => {
  for (const name of (await snapshot()).events) assert.match(name, /^mero:[a-z]+(-[a-z]+)*$/);
});

// Runs the check against a copy of ui/ after `change(dir)` edits it, and returns what the check reported.
const checkAfter = async change => {
  const dir = await mkdtemp(join(tmpdir(), "mero-api-surface-"));
  try {
    for (const path of ["ui", "scripts/api-surface.mjs", "test/api-surface.json"]) await cp(new URL(path, root), join(dir, path), { recursive: true });
    await change(dir);
    return await promisify(execFile)(process.execPath, ["scripts/api-surface.mjs"], { cwd: dir }).then(() => "", error => error.stderr);
  } finally {
    await rm(dir, { recursive: true });
  }
};

test("a renamed event is reported even when the old name is a prefix of the new one", async () => {
  const report = await checkAfter(async dir => {
    const path = join(dir, "ui/mero.js");
    await writeFile(path, (await readFile(path, "utf8")).replaceAll('"mero:query"', '"mero:queryReady"'));
  });
  assert.match(report, /Removed from the public API: mero:query\./);
  assert.match(report, /New public names: mero:queryReady\./);
});

test("names added in a module are reported", async () => {
  const report = await checkAfter(dir => appendFile(join(dir, "ui/insight-charts.mjs"), `
const grouped = () => new CustomEvent("mero:chart-ready");
export const HEADER = "Mero-Chart-State";
export {
  grouped,
  grouped as aliased
};
`));
  assert.match(report, /New public names: mero:chart-ready, Mero-Chart-State, HEADER, aliased, grouped\./);
});
