import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import { mkdtemp, readFile, rm, stat, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { promisify } from "node:util";
import test from "node:test";

const execFileAsync = promisify(execFile);
const repoRoot = fileURLToPath(new URL("../", import.meta.url));
const cliPath = join(repoRoot, "bin/mero-ui.mjs");
const pkg = JSON.parse(await readFile(join(repoRoot, "package.json"), "utf8"));

async function runMeroCli(args) {
  try {
    const { stdout, stderr } = await execFileAsync(process.execPath, [cliPath, ...args], { cwd: repoRoot });
    return { code: 0, stdout, stderr };
  } catch (error) {
    return { code: error.code ?? 1, stdout: error.stdout || "", stderr: error.stderr || "" };
  }
}

test("mero-ui CLI prints help and version", async () => {
  const help = await runMeroCli(["--help"]);
  assert.equal(help.code, 0);
  assert.match(help.stdout, /mero-ui init <dir>/);
  assert.match(help.stdout, /mero-ui verify <dir>/);
  assert.match(help.stdout, /mero-ui upgrade <dir>/);

  const ver = await runMeroCli(["--version"]);
  assert.equal(ver.code, 0);
  assert.equal(ver.stdout.trim(), `${pkg.name} ${pkg.version}`);
});

test("mero-ui init and verify copy Core 4, write MERO.json and catch tampering or missing files", async t => {
  const dir = await mkdtemp(join(tmpdir(), "mero-cli-core-"));
  t.after(() => rm(dir, { recursive: true, force: true }));
  const target = join(dir, "public/mero");

  const init = await runMeroCli(["init", target]);
  assert.equal(init.code, 0, init.stderr);
  assert.match(init.stdout, /<link rel="stylesheet" href="\/mero\/mero\.css">/);
  assert.match(init.stdout, /<script defer src="\/mero\/mero\.js"><\/script>/);
  assert.match(init.stdout, /<script defer src="\/mero\/mero-forms\.js"><\/script>/);
  assert.match(init.stdout, /<script defer src="\/mero\/mero-live\.js"><\/script>/);

  const manifest = JSON.parse(await readFile(join(target, "MERO.json"), "utf8"));
  assert.equal(manifest.package, pkg.name);
  assert.equal(manifest.version, pkg.version);
  assert.equal(manifest.minified, false);
  assert.deepEqual(manifest.families, ["core"]);
  assert.deepEqual(
    Object.keys(manifest.files).sort(),
    ["LICENSE.txt", "mero-forms.js", "mero-live.js", "mero.css", "mero.js"]
  );
  assert.match(manifest.files["mero.js"].integrity, /^sha384-/);

  const verified = await runMeroCli(["verify", target, "--strict-version"]);
  assert.equal(verified.code, 0, verified.stderr);
  assert.match(verified.stdout, /OK: verified 5 files/);

  // Tamper with a vendored file -> verify fails with checksum mismatch
  const jsPath = join(target, "mero.js");
  const original = await readFile(jsPath);
  await writeFile(jsPath, Buffer.concat([original, Buffer.from("\n// drift\n")]));
  const tampered = await runMeroCli(["verify", target]);
  assert.notEqual(tampered.code, 0);
  assert.match(tampered.stderr, /Checksum mismatch for mero\.js/);

  // Even if MERO.json checksum is rewritten, same-version package drift is caught
  const { createHash } = await import("node:crypto");
  const drifted = await readFile(jsPath);
  manifest.files["mero.js"].sha256 = createHash("sha256").update(drifted).digest("hex");
  manifest.files["mero.js"].bytes = drifted.byteLength;
  await writeFile(join(target, "MERO.json"), JSON.stringify(manifest, null, 2));
  const driftCheck = await runMeroCli(["verify", target]);
  assert.notEqual(driftCheck.code, 0);
  assert.match(driftCheck.stderr, /Package drift for mero\.js/);

  // Missing file check
  await rm(join(target, "mero-live.js"));
  const missing = await runMeroCli(["verify", target]);
  assert.notEqual(missing.code, 0);
  assert.match(missing.stderr, /Missing file: mero-live\.js/);

  // Unknown family fails cleanly
  const bad = await runMeroCli(["init", target, "--with", "nonexistent"]);
  assert.notEqual(bad.code, 0);
  assert.match(bad.stderr, /Unknown family "nonexistent"/);
});

test("mero-ui init supports --with optional families, --minified and --base-url", async t => {
  const dir = await mkdtemp(join(tmpdir(), "mero-cli-min-"));
  t.after(() => rm(dir, { recursive: true, force: true }));
  const target = join(dir, "assets");

  const init = await runMeroCli(["init", target, "--with", "gallery,layouts", "--minified", "--base-url", "/static/ui"]);
  assert.equal(init.code, 0, init.stderr);
  assert.match(init.stdout, /href="\/static\/ui\/mero\.min\.css"/);
  assert.match(init.stdout, /href="\/static\/ui\/mero-gallery\.min\.css"/);
  assert.match(init.stdout, /href="\/static\/ui\/mero-layouts\.min\.css"/);
  assert.match(init.stdout, /src="\/static\/ui\/mero-gallery\.min\.js"/);

  const manifest = JSON.parse(await readFile(join(target, "MERO.json"), "utf8"));
  assert.equal(manifest.minified, true);
  assert.deepEqual(manifest.families, ["core", "gallery", "layouts"]);
  assert.ok(manifest.files["mero.min.css"]);
  assert.ok(manifest.files["mero-gallery.min.js"]);
  assert.ok(manifest.files["mero-layouts.min.css"]);

  const verify = await runMeroCli(["verify", target]);
  assert.equal(verify.code, 0, verify.stderr);
});

test("mero-ui upgrade refreshes drifted files, prints Breaking/Deprecated notes and preserves unrelated files", async t => {
  const dir = await mkdtemp(join(tmpdir(), "mero-cli-upgrade-"));
  t.after(() => rm(dir, { recursive: true, force: true }));
  const target = join(dir, "vendor");

  assert.equal((await runMeroCli(["init", target, "--with", "layouts"])).code, 0);
  // Simulate an older vendored version with stale file contents + an unrelated user file
  const customFile = join(target, "app-overrides.css");
  await writeFile(customFile, "body { color: inherit; }\n");
  await writeFile(join(target, "mero.js"), "// old 0.4.0 build\n");
  const manifestPath = join(target, "MERO.json");
  const oldManifest = JSON.parse(await readFile(manifestPath, "utf8"));
  oldManifest.version = "0.4.0";
  await writeFile(manifestPath, JSON.stringify(oldManifest, null, 2));

  const strictBefore = await runMeroCli(["verify", target, "--strict-version"]);
  assert.notEqual(strictBefore.code, 0);

  const upgraded = await runMeroCli(["upgrade", target]);
  assert.equal(upgraded.code, 0, upgraded.stderr);
  assert.match(upgraded.stdout, new RegExp(`0\\.4\\.0 -> ${pkg.version.replaceAll(".", "\\.")}`));
  assert.match(upgraded.stdout, /\*\*Breaking:\*\*/);
  assert.match(upgraded.stdout, /\*\*Deprecated:\*\*/);

  assert.equal((await runMeroCli(["verify", target, "--strict-version"])).code, 0);
  assert.equal(await readFile(customFile, "utf8"), "body { color: inherit; }\n");

  // Upgrade switching to --minified removes old unminified managed files cleanly
  const toMin = await runMeroCli(["upgrade", target, "--minified"]);
  assert.equal(toMin.code, 0, toMin.stderr);
  await assert.rejects(stat(join(target, "mero.js")));
  assert.ok(await stat(join(target, "mero.min.js")));
  assert.equal(await readFile(customFile, "utf8"), "body { color: inherit; }\n");
  assert.equal((await runMeroCli(["verify", target])).code, 0);
});
