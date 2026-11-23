import test from "node:test";
import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import { readdir, readFile } from "node:fs/promises";
import { promisify } from "node:util";

const root = new URL("../", import.meta.url);

test("every distributed script and stylesheet starts with the package.json version", async () => {
  const { name, version, license, scripts } = JSON.parse(await readFile(new URL("package.json", root), "utf8"));
  const files = (await readdir(new URL("ui/", root))).filter(file => /\.(m?js|css)$/.test(file));
  assert.ok(files.includes("mero.js") && files.includes("mero.css"));
  for (const file of files) {
    const first = (await readFile(new URL("ui/" + file, root), "utf8")).split("\n", 1)[0];
    assert.equal(first, `/*! ${name} ${version} | ${license} */`, `ui/${file}: run npm run banner`);
  }
  assert.match(scripts.version, /scripts\/version-banner\.mjs/, "npm version restamps the files");
  await promisify(execFile)(process.execPath, ["scripts/version-banner.mjs", "--check"], { cwd: root });
});
