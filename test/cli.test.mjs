import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import { createHash } from "node:crypto";
import { mkdtemp, readFile, rm, stat, symlink, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { promisify } from "node:util";
import test from "node:test";
import { compareSemver, extractChangelogNotices } from "../bin/mero-ui.mjs";

const execFileAsync = promisify(execFile);
const repoRoot = fileURLToPath(new URL("../", import.meta.url));
const cliPath = join(repoRoot, "bin/mero-ui.mjs");
const pkg = JSON.parse(await readFile(join(repoRoot, "package.json"), "utf8"));

async function runBinary(binPath, args, cwd = repoRoot) {
  try {
    const { stdout, stderr } = await execFileAsync(process.execPath, [binPath, ...args], { cwd });
    return { code: 0, stdout, stderr };
  } catch (error) {
    return { code: error.code ?? 1, stdout: error.stdout || "", stderr: error.stderr || "" };
  }
}

const runMeroCli = args => runBinary(cliPath, args);

test.before(async () => {
  // Ensure dist/ui exists even on a fresh checkout where build:ui has not been run yet.
  try {
    await stat(join(repoRoot, "dist/ui/mero.min.js"));
  } catch {
    await execFileAsync(process.execPath, [join(repoRoot, "scripts/build-ui.mjs")], { cwd: repoRoot });
  }
});

test("mero-ui CLI prints help and version and works when invoked through a symlink (like npx / node_modules/.bin)", async t => {
  const help = await runMeroCli(["--help"]);
  assert.equal(help.code, 0);
  assert.match(help.stdout, /mero-ui init <dir>/);
  assert.match(help.stdout, /mero-ui verify <dir>/);
  assert.match(help.stdout, /mero-ui upgrade <dir>/);

  const ver = await runMeroCli(["--version"]);
  assert.equal(ver.code, 0);
  assert.equal(ver.stdout.trim(), `${pkg.name} ${pkg.version}`);

  // Simulate npm's node_modules/.bin/mero-ui symlink invocation
  const dir = await mkdtemp(join(tmpdir(), "mero-cli-symlink-"));
  t.after(() => rm(dir, { recursive: true, force: true }));
  const binLink = join(dir, "mero-ui");
  await symlink(cliPath, binLink);
  const outDir = join(dir, "public/mero");
  const init = await runBinary(binLink, ["init", outDir], dir);
  assert.equal(init.code, 0, init.stderr);
  assert.match(init.stdout, /Copied 5 files/);
  assert.ok(await stat(join(outDir, "MERO.json")));
  assert.ok(await stat(join(outDir, "mero.js")));
  const verify = await runBinary(binLink, ["verify", outDir], dir);
  assert.equal(verify.code, 0, verify.stderr);
  assert.match(verify.stdout, /OK: verified 5 files/);
});

test("mero-ui init and verify copy Core 4, write MERO.json and catch tampering, drift, missing sources or missing family entries", async t => {
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
  const drifted = await readFile(jsPath);
  manifest.files["mero.js"].sha256 = createHash("sha256").update(drifted).digest("hex");
  manifest.files["mero.js"].bytes = drifted.byteLength;
  await writeFile(join(target, "MERO.json"), JSON.stringify(manifest, null, 2));
  const driftCheck = await runMeroCli(["verify", target]);
  assert.notEqual(driftCheck.code, 0);
  assert.match(driftCheck.stderr, /Package drift for mero\.js/);

  // Missing package source in same-version verify must fail (never silently skip)
  const bogus = structuredClone(manifest);
  bogus.files["mero.js"].source = "ui/does-not-exist.js";
  await writeFile(join(target, "MERO.json"), JSON.stringify(bogus, null, 2));
  const badSource = await runMeroCli(["verify", target]);
  assert.notEqual(badSource.code, 0);
  assert.match(badSource.stderr, /Source mismatch for mero\.js/);

  // Dropping a required family file from MERO.json must fail verify
  const dropped = structuredClone(manifest);
  delete dropped.files["mero-live.js"];
  await writeFile(join(target, "MERO.json"), JSON.stringify(dropped, null, 2));
  const missingEntry = await runMeroCli(["verify", target]);
  assert.notEqual(missingEntry.code, 0);
  assert.match(missingEntry.stderr, /missing expected family file: mero-live\.js/);

  // Missing file on disk check
  await writeFile(join(target, "MERO.json"), JSON.stringify(manifest, null, 2));
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

  const init = await runMeroCli(["init", target, "--with", "themes,gallery,layouts", "--minified", "--base-url", "/static/ui"]);
  assert.equal(init.code, 0, init.stderr);
  assert.match(init.stdout, /href="\/static\/ui\/mero\.min\.css"/);
  assert.match(init.stdout, /href="\/static\/ui\/mero-themes\.min\.css"/);
  assert.match(init.stdout, /href="\/static\/ui\/mero-gallery\.min\.css"/);
  assert.match(init.stdout, /href="\/static\/ui\/mero-layouts\.min\.css"/);
  assert.match(init.stdout, /src="\/static\/ui\/mero-gallery\.min\.js"/);

  const manifest = JSON.parse(await readFile(join(target, "MERO.json"), "utf8"));
  assert.equal(manifest.minified, true);
  assert.deepEqual(manifest.families, ["core", "themes", "gallery", "layouts"]);
  assert.ok(manifest.files["mero.min.css"]);
  assert.ok(manifest.files["mero-themes.min.css"]);
  assert.ok(manifest.files["mero-gallery.min.js"]);
  assert.ok(manifest.files["mero-layouts.min.css"]);

  const verify = await runMeroCli(["verify", target]);
  assert.equal(verify.code, 0, verify.stderr);

  // Destination symlink must be rejected (CWE-59 protection: never overwrite outside targetDir)
  const victim = join(dir, "outside.css");
  await writeFile(victim, "/* victim */\n");
  await rm(join(target, "mero.min.css"));
  await symlink(victim, join(target, "mero.min.css"));
  const symlinkUpgrade = await runMeroCli(["upgrade", target]);
  assert.notEqual(symlinkUpgrade.code, 0);
  assert.match(symlinkUpgrade.stderr, /symlink destination/i);
  assert.equal(await readFile(victim, "utf8"), "/* victim */\n");
});

test("mero-ui upgrade refreshes drifted files, rejects path traversal, prints Breaking/Deprecated notes and preserves user files", async t => {
  const dir = await mkdtemp(join(tmpdir(), "mero-cli-upgrade-"));
  t.after(() => rm(dir, { recursive: true, force: true }));
  const target = join(dir, "vendor");
  const outsideFile = join(dir, "keep-me.txt");
  await writeFile(outsideFile, "precious\n");

  assert.equal((await runMeroCli(["init", target, "--with", "layouts"])).code, 0);

  // Path-traversal entry in MERO.json must be rejected by both verify and upgrade without deleting outsideFile
  const manifestPath = join(target, "MERO.json");
  const poisoned = JSON.parse(await readFile(manifestPath, "utf8"));
  poisoned.files["../keep-me.txt"] = { source: "ui/mero.js", bytes: 1, sha256: "00" };
  await writeFile(manifestPath, JSON.stringify(poisoned, null, 2));
  const poisonedVerify = await runMeroCli(["verify", target]);
  assert.notEqual(poisonedVerify.code, 0);
  assert.match(poisonedVerify.stderr, /Invalid manifest path/);
  const poisonedUpgrade = await runMeroCli(["upgrade", target]);
  assert.notEqual(poisonedUpgrade.code, 0);
  assert.match(poisonedUpgrade.stderr, /unsafe file path/);
  assert.equal(await readFile(outsideFile, "utf8"), "precious\n");

  // Restore clean older manifest (0.4.0) with stale file + unrelated user file
  assert.equal((await runMeroCli(["init", target, "--with", "layouts"])).code, 0);
  const customFile = join(target, "app-overrides.css");
  await writeFile(customFile, "body { color: inherit; }\n");
  await writeFile(join(target, "mero.js"), "// old 0.4.0 build\n");
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

test("compareSemver orders numeric prerelease identifiers per SemVer 2.0.0", () => {
  assert.equal(compareSemver("1.0.0-rc.10", "1.0.0-rc.2"), 1);
  assert.equal(compareSemver("1.0.0-rc.2", "1.0.0-rc.10"), -1);
  assert.equal(compareSemver("1.0.0", "1.0.0-rc.10"), 1);
  assert.equal(compareSemver("1.0.0-alpha.1", "1.0.0-alpha.beta"), -1);
  const notes = extractChangelogNotices(
    "## 1.0.0-rc.10\n- **Breaking:** Changed X.\n## 1.0.0-rc.2\n- **Breaking:** Old Y.\n",
    "1.0.0-rc.2",
    "1.0.0-rc.10"
  );
  assert.equal(notes.length, 1);
  assert.equal(notes[0].heading, "1.0.0-rc.10");
});

test("packed npm tarball installs cleanly as a standalone consumer with symlinked CLI and self-contained CSS", async t => {
  const work = await mkdtemp(join(tmpdir(), "mero-consumer-pack-"));
  t.after(() => rm(work, { recursive: true, force: true }));
  const cacheDir = join(work, "npm-cache");
  const packRes = await execFileAsync("npm", ["pack", "--pack-destination", work, "--cache", cacheDir], { cwd: repoRoot });
  const tgz = packRes.stdout.trim().split(/\r?\n/).pop();
  assert.ok(tgz && tgz.endsWith(".tgz"), `expected tarball name, got ${tgz}`);

  const extracted = join(work, "node_modules/@rubenlangeweg/mero-ui");
  const binDir = join(work, "node_modules/.bin");
  const { mkdir } = await import("node:fs/promises");
  await mkdir(extracted, { recursive: true });
  await mkdir(binDir, { recursive: true });
  await execFileAsync("tar", ["-xzf", join(work, tgz), "--strip-components=1", "-C", extracted]);

  const installedPkg = JSON.parse(await readFile(join(extracted, "package.json"), "utf8"));
  const installedBin = join(extracted, installedPkg.bin["mero-ui"]);
  const binLink = join(binDir, "mero-ui");
  await symlink(installedBin, binLink);

  const vendored = join(work, "public/mero");
  const init = await runBinary(binLink, ["init", vendored, "--with", "gallery", "--minified"], work);
  assert.equal(init.code, 0, init.stderr);
  assert.match(init.stdout, /Copied 7 files/);
  const verify = await runBinary(binLink, ["verify", vendored, "--strict-version"], work);
  assert.equal(verify.code, 0, verify.stderr);

  // Verify gallery CSS inside the packed artifact has no dangling relative asset URLs
  const galleryCss = await readFile(join(vendored, "mero-gallery.min.css"), "utf8");
  assert.doesNotMatch(galleryCss, /studio-lamp\.webp/);
});
