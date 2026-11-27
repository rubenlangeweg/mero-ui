#!/usr/bin/env node
import { createHash } from "node:crypto";
import { realpathSync } from "node:fs";
import { copyFile, lstat, mkdir, readFile, rm, stat, writeFile } from "node:fs/promises";
import { basename, dirname, join, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const pkgRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");

export const FAMILIES = {
  core: ["mero.css", "mero.js", "mero-forms.js", "mero-live.js"],
  themes: ["mero-themes.css"],
  gallery: ["mero-gallery.css", "mero-gallery.js"],
  layouts: ["mero-layouts.css"],
  collections: ["mero-collections.css", "mero-collections.js"],
  workspace: ["mero-workspace.css", "mero-workspace.js"],
  insights: ["mero-insights.css", "mero-insights.js"],
  composition: ["mero-composition.css", "mero-composition.js"],
  charts: ["insight-charts.mjs"],
  markdown: ["insight-markdown.mjs"],
  types: ["mero.d.ts", "insight-charts.d.ts", "insight-markdown.d.ts"],
};

const BROWSER_OPTIONAL = ["themes", "gallery", "layouts", "collections", "workspace", "insights", "composition"];

const USAGE = `Usage:
  mero-ui init <dir> [--with <families>] [--minified] [--base-url <path>]
  mero-ui verify <dir> [--strict-version]
  mero-ui upgrade <dir> [--with <families>] [--minified | --unminified] [--base-url <path>]

Commands:
  init      Copy Core 4 (plus optional --with families) and LICENSE.txt, and write MERO.json.
  verify    Check that every file in <dir>/MERO.json exists, matches its SHA-256 checksum,
            and (when versions match) is byte-identical to the installed package.
  upgrade   Re-copy managed assets from the installed package, update MERO.json, and print
            any Breaking or Deprecated changelog entries since the previous version.

Optional families (--with, comma-separated or repeated):
  ${Object.keys(FAMILIES).filter(name => name !== "core").join(", ")}, all

Options:
  --with <list>       Include optional families alongside core.
  --minified          Copy minified dist/ui/*.min.{css,js} files (requires built dist/).
  --unminified        Switch back to readable ui/*.{css,js} files during upgrade.
  --base-url <path>   Prefix used in the printed HTML snippet (default: /mero).
  --strict-version    Fail verify if MERO.json version differs from installed package.
  -v, --version       Print package name and version.
  -h, --help          Show this help text.
`;

function sha256Hex(buffer) {
  return createHash("sha256").update(buffer).digest("hex");
}

function sha384Sri(buffer) {
  return "sha384-" + createHash("sha384").update(buffer).digest("base64");
}

function parseSemver(version) {
  const match = String(version || "").trim().match(/^(\d+)\.(\d+)\.(\d+)(?:-([0-9A-Za-z.-]+))?$/);
  if (!match) return null;
  return { major: Number(match[1]), minor: Number(match[2]), patch: Number(match[3]), pre: match[4] || "" };
}

function comparePrerelease(a, b) {
  const pa = a.split(".");
  const pb = b.split(".");
  const len = Math.max(pa.length, pb.length);
  for (let i = 0; i < len; i++) {
    if (i >= pa.length) return -1;
    if (i >= pb.length) return 1;
    if (pa[i] === pb[i]) continue;
    const numA = /^\d+$/.test(pa[i]);
    const numB = /^\d+$/.test(pb[i]);
    if (numA && numB) return Number(pa[i]) > Number(pb[i]) ? 1 : -1;
    if (numA) return -1;
    if (numB) return 1;
    return pa[i] > pb[i] ? 1 : -1;
  }
  return 0;
}

export function compareSemver(a, b) {
  const pa = parseSemver(a);
  const pb = parseSemver(b);
  if (!pa || !pb) return 0;
  for (const key of ["major", "minor", "patch"]) {
    if (pa[key] !== pb[key]) return pa[key] > pb[key] ? 1 : -1;
  }
  if (pa.pre === pb.pre) return 0;
  if (!pa.pre) return 1;
  if (!pb.pre) return -1;
  return comparePrerelease(pa.pre, pb.pre);
}

export function extractChangelogNotices(changelogText, previousVersion, currentVersion) {
  const sections = [];
  let current = null;
  for (const rawLine of changelogText.split(/\r?\n/)) {
    const heading = rawLine.match(/^##\s+(.+?)\s*$/);
    if (heading) {
      const label = heading[1].trim();
      const versionMatch = label.match(/^(\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?)\b/);
      const isUnreleased = /^unreleased\b/i.test(label);
      const version = versionMatch ? versionMatch[1] : null;
      const include = isUnreleased
        ? true
        : version !== null && compareSemver(version, previousVersion) > 0 &&
          (!currentVersion || compareSemver(version, currentVersion) <= 0);
      current = include ? { heading: label, notices: [] } : null;
      if (current) sections.push(current);
      continue;
    }
    if (!current) continue;
    const trimmed = rawLine.trim();
    if (/^-\s+\*\*(?:Breaking|Deprecated):\*\*/i.test(trimmed)) {
      current.notices.push(trimmed);
    }
  }
  return sections.filter(section => section.notices.length > 0);
}

function isSafeFilename(name) {
  return typeof name === "string" && name.length > 0 && basename(name) === name &&
    !name.includes("..") && !name.includes("/") && !name.includes("\\");
}

function safeTargetPath(targetDir, name) {
  if (!isSafeFilename(name)) return null;
  const full = resolve(targetDir, name);
  return relative(targetDir, full) === name ? full : null;
}

function parseArgs(argv) {
  const positionals = [];
  const withFamilies = [];
  let minified;
  let baseUrl = "/mero";
  let strictVersion = false;
  let help = false;
  let version = false;

  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === "-h" || arg === "--help") {
      help = true;
    } else if (arg === "-v" || arg === "--version") {
      version = true;
    } else if (arg === "--minified") {
      minified = true;
    } else if (arg === "--unminified") {
      minified = false;
    } else if (arg === "--strict-version") {
      strictVersion = true;
    } else if (arg === "--with" || arg.startsWith("--with=")) {
      const value = arg === "--with" ? argv[++i] : arg.slice("--with=".length);
      if (!value || value.startsWith("-")) throw new Error("Option --with requires a comma-separated family list.");
      for (const item of value.split(",")) {
        const name = item.trim().toLowerCase();
        if (name) withFamilies.push(name);
      }
    } else if (arg === "--base-url" || arg.startsWith("--base-url=")) {
      const value = arg === "--base-url" ? argv[++i] : arg.slice("--base-url=".length);
      if (!value) throw new Error("Option --base-url requires a URL prefix.");
      baseUrl = value;
    } else if (arg.startsWith("-")) {
      throw new Error(`Unknown option: ${arg}`);
    } else {
      positionals.push(arg);
    }
  }
  return { positionals, withFamilies, minified, baseUrl, strictVersion, help, version };
}

function resolveFamilies(requested) {
  const ordered = ["core"];
  for (const name of requested) {
    if (name === "core") continue;
    if (name === "all") {
      for (const opt of BROWSER_OPTIONAL) {
        if (!ordered.includes(opt)) ordered.push(opt);
      }
      continue;
    }
    if (!Object.hasOwn(FAMILIES, name)) {
      throw new Error(`Unknown family "${name}". Available: ${Object.keys(FAMILIES).join(", ")}, all.`);
    }
    if (!ordered.includes(name)) ordered.push(name);
  }
  return ordered;
}

function assetDescriptor(file, minified) {
  if (minified && /\.(?:css|js)$/.test(file)) {
    const minName = file.replace(/\.(css|js)$/, ".min.$1");
    return { destName: minName, sourceRel: "dist/ui/" + minName };
  }
  return { destName: file, sourceRel: "ui/" + file };
}

function expectedBundlePlan(families, minified) {
  const plan = [];
  const seen = new Set();
  for (const family of families) {
    for (const file of FAMILIES[family]) {
      const desc = assetDescriptor(file, minified);
      if (seen.has(desc.destName)) continue;
      seen.add(desc.destName);
      plan.push({ ...desc, srcAbs: join(pkgRoot, desc.sourceRel) });
    }
  }
  plan.push({ destName: "LICENSE.txt", sourceRel: "LICENSE", srcAbs: join(pkgRoot, "LICENSE") });
  return plan;
}

async function fileExists(path) {
  try {
    await stat(path);
    return true;
  } catch {
    return false;
  }
}

async function readPkg() {
  return JSON.parse(await readFile(join(pkgRoot, "package.json"), "utf8"));
}

async function rejectSymlink(path, label) {
  try {
    const info = await lstat(path);
    if (info.isSymbolicLink()) throw new Error(`Refusing to write through symlink destination: ${label}`);
  } catch (error) {
    if (error?.code !== "ENOENT") throw error;
  }
}

async function writeBundle(targetDir, pkg, families, minified) {
  const plan = expectedBundlePlan(families, minified);
  for (const item of plan) {
    if (!await fileExists(item.srcAbs)) {
      throw new Error(
        minified
          ? `Minified asset ${item.sourceRel} is not present in the installed package. Run "npm run build:ui" or omit --minified.`
          : `Package asset ${item.sourceRel} was not found.`
      );
    }
  }

  await mkdir(targetDir, { recursive: true });
  const manifestPath = join(targetDir, "MERO.json");
  await rejectSymlink(manifestPath, "MERO.json");
  const filesManifest = {};
  for (const item of plan) {
    const destAbs = safeTargetPath(targetDir, item.destName);
    if (!destAbs) throw new Error(`Refusing to write unsafe destination filename: ${item.destName}`);
    await rejectSymlink(destAbs, item.destName);
    await copyFile(item.srcAbs, destAbs);
    const bytes = await readFile(destAbs);
    filesManifest[item.destName] = {
      source: item.sourceRel,
      bytes: bytes.byteLength,
      sha256: sha256Hex(bytes),
      integrity: sha384Sri(bytes),
    };
  }

  const sortedFiles = Object.fromEntries(Object.entries(filesManifest).sort(([a], [b]) => a.localeCompare(b)));
  const manifest = {
    package: pkg.name,
    version: pkg.version,
    minified,
    families,
    files: sortedFiles,
  };
  await writeFile(manifestPath, JSON.stringify(manifest, null, 2) + "\n", "utf8");
  return { manifest, orderedAssets: plan.map(item => item.destName).filter(name => name !== "LICENSE.txt") };
}

function renderHtmlSnippet(orderedAssets, baseUrl) {
  const prefix = baseUrl.endsWith("/") ? baseUrl.slice(0, -1) : baseUrl;
  const css = orderedAssets.filter(name => name.endsWith(".css"));
  const js = orderedAssets.filter(name => name.endsWith(".js"));
  const lines = [
    ...css.map(name => `<link rel="stylesheet" href="${prefix}/${name}">`),
    `<script defer src="/vendor/htmx.min.js"></script>`,
    ...js.map(name => `<script defer src="${prefix}/${name}"></script>`),
  ];
  return lines.join("\n");
}

async function cmdInit(targetArg, options, io) {
  if (!targetArg) throw new Error("Missing target directory. Usage: mero-ui init <dir> [--with ...] [--minified]");
  const targetDir = resolve(targetArg);
  const pkg = await readPkg();
  const families = resolveFamilies(options.withFamilies);
  const minified = Boolean(options.minified);
  const { manifest, orderedAssets } = await writeBundle(targetDir, pkg, families, minified);
  io.stdout(`Copied ${Object.keys(manifest.files).length} files (${pkg.name} ${pkg.version}) to ${targetDir}\n`);
  io.stdout(`Wrote ${join(targetDir, "MERO.json")}\n\n`);
  io.stdout(`Add to your HTML <head>:\n${renderHtmlSnippet(orderedAssets, options.baseUrl)}\n`);
  return 0;
}

async function cmdVerify(targetArg, options, io) {
  if (!targetArg) throw new Error("Missing target directory. Usage: mero-ui verify <dir> [--strict-version]");
  const targetDir = resolve(targetArg);
  const manifestPath = join(targetDir, "MERO.json");
  let manifest;
  try {
    manifest = JSON.parse(await readFile(manifestPath, "utf8"));
  } catch (error) {
    io.stderr(`Failed to read ${manifestPath}: ${error.message}\n`);
    return 1;
  }
  if (!manifest || typeof manifest !== "object" || !manifest.files || typeof manifest.files !== "object") {
    io.stderr(`Invalid manifest in ${manifestPath}: missing "files" map.\n`);
    return 1;
  }

  const pkg = await readPkg();
  const errors = [];
  if (options.strictVersion && manifest.version !== pkg.version) {
    errors.push(`Version mismatch: MERO.json records ${manifest.version}, installed package is ${pkg.version}.`);
  }
  if (!Object.hasOwn(manifest.files, "LICENSE.txt")) {
    errors.push("Manifest is missing required LICENSE.txt entry.");
  }

  const sameVersion = manifest.version === pkg.version;
  let expectedSources = null;
  if (sameVersion) {
    try {
      const families = resolveFamilies(Array.isArray(manifest.families) ? manifest.families : ["core"]);
      const plan = expectedBundlePlan(families, Boolean(manifest.minified));
      expectedSources = new Map(plan.map(item => [item.destName, item]));
      for (const item of plan) {
        if (!Object.hasOwn(manifest.files, item.destName)) {
          errors.push(`Manifest is missing expected family file: ${item.destName}`);
        }
      }
    } catch (error) {
      errors.push(`Invalid families in MERO.json: ${error.message}`);
    }
  }

  const entries = Object.entries(manifest.files);
  for (const [name, expected] of entries) {
    const filePath = safeTargetPath(targetDir, name);
    if (!filePath) {
      errors.push(`Invalid manifest path: ${name}`);
      continue;
    }
    let actual;
    try {
      actual = await readFile(filePath);
    } catch {
      errors.push(`Missing file: ${name}`);
      continue;
    }
    const actualHash = sha256Hex(actual);
    if (actualHash !== expected?.sha256) {
      errors.push(`Checksum mismatch for ${name}: expected ${expected?.sha256}, got ${actualHash}`);
      continue;
    }
    if (typeof expected.bytes === "number" && actual.byteLength !== expected.bytes) {
      errors.push(`Byte-length mismatch for ${name}: expected ${expected.bytes}, got ${actual.byteLength}`);
      continue;
    }
    if (sameVersion) {
      const planned = expectedSources?.get(name);
      const sourceRel = planned?.sourceRel ?? expected.source;
      if (typeof sourceRel !== "string" || !sourceRel) {
        errors.push(`Missing package source metadata for ${name}`);
        continue;
      }
      if (planned && expected.source && expected.source !== planned.sourceRel) {
        errors.push(`Source mismatch for ${name}: manifest lists ${expected.source}, expected ${planned.sourceRel}`);
        continue;
      }
      const pkgFile = resolve(pkgRoot, sourceRel);
      const relToPkg = relative(pkgRoot, pkgFile);
      if (relToPkg.startsWith("..") || !await fileExists(pkgFile)) {
        errors.push(`Missing package source for ${name}: ${sourceRel} was not found in installed package`);
        continue;
      }
      const pkgBytes = await readFile(pkgFile);
      if (!actual.equals(pkgBytes)) {
        errors.push(`Package drift for ${name}: differs from installed ${sourceRel}`);
      }
    }
  }

  if (errors.length > 0) {
    for (const message of errors) io.stderr(`ERROR: ${message}\n`);
    return 1;
  }
  io.stdout(`OK: verified ${entries.length} files in ${targetDir} (${manifest.package || pkg.name} ${manifest.version})\n`);
  return 0;
}

async function cmdUpgrade(targetArg, options, io) {
  if (!targetArg) throw new Error("Missing target directory. Usage: mero-ui upgrade <dir> [--with ...] [--minified]");
  const targetDir = resolve(targetArg);
  const manifestPath = join(targetDir, "MERO.json");
  let previous;
  try {
    previous = JSON.parse(await readFile(manifestPath, "utf8"));
  } catch (error) {
    io.stderr(`Failed to read ${manifestPath}: ${error.message}\n`);
    return 1;
  }
  if (!previous || typeof previous !== "object" || !previous.files || typeof previous.files !== "object") {
    io.stderr(`Invalid manifest in ${manifestPath}: missing "files" map.\n`);
    return 1;
  }
  const prevFiles = Object.keys(previous.files);
  for (const oldName of prevFiles) {
    if (!safeTargetPath(targetDir, oldName)) {
      io.stderr(`Error: Refusing upgrade because ${manifestPath} contains an unsafe file path: ${oldName}\n`);
      return 1;
    }
  }

  const pkg = await readPkg();
  const prevVersion = previous.version || "0.0.0";
  const families = options.withFamilies.length > 0
    ? resolveFamilies(options.withFamilies)
    : resolveFamilies(Array.isArray(previous.families) ? previous.families : ["core"]);
  const minified = options.minified !== undefined ? options.minified : Boolean(previous.minified);

  const { manifest, orderedAssets } = await writeBundle(targetDir, pkg, families, minified);
  for (const oldName of prevFiles) {
    if (!Object.hasOwn(manifest.files, oldName)) {
      const safePath = safeTargetPath(targetDir, oldName);
      if (safePath) await rm(safePath, { force: true });
    }
  }

  io.stdout(`Upgraded ${targetDir}: ${prevVersion} -> ${pkg.version} (${Object.keys(manifest.files).length} files)\n`);
  const changelogPath = join(pkgRoot, "CHANGELOG.md");
  if (await fileExists(changelogPath)) {
    const changelog = await readFile(changelogPath, "utf8");
    const sections = extractChangelogNotices(changelog, prevVersion, pkg.version);
    if (sections.length > 0) {
      io.stdout(`\nReview before deploying (Breaking / Deprecated since ${prevVersion}):\n`);
      for (const section of sections) {
        io.stdout(`  ${section.heading}\n`);
        for (const notice of section.notices) {
          io.stdout(`    ${notice}\n`);
        }
      }
    } else {
      io.stdout(`No Breaking or Deprecated changelog entries since ${prevVersion}.\n`);
    }
  }
  if (options.withFamilies.length > 0 || options.minified !== undefined) {
    io.stdout(`\nUpdated HTML <head>:\n${renderHtmlSnippet(orderedAssets, options.baseUrl)}\n`);
  }
  return 0;
}

export async function runCli(argv, io = { stdout: text => process.stdout.write(text), stderr: text => process.stderr.write(text) }) {
  let parsed;
  try {
    parsed = parseArgs(argv);
  } catch (error) {
    io.stderr(`Error: ${error.message}\n`);
    return 1;
  }
  if (parsed.help || parsed.positionals[0] === "help" || (parsed.positionals.length === 0 && !parsed.version)) {
    io.stdout(USAGE);
    return 0;
  }
  if (parsed.version) {
    const pkg = await readPkg();
    io.stdout(`${pkg.name} ${pkg.version}\n`);
    return 0;
  }
  const [command, target] = parsed.positionals;
  try {
    if (command === "init") return await cmdInit(target, parsed, io);
    if (command === "verify") return await cmdVerify(target, parsed, io);
    if (command === "upgrade") return await cmdUpgrade(target, parsed, io);
    io.stderr(`Unknown command: ${command}\n\n${USAGE}`);
    return 1;
  } catch (error) {
    io.stderr(`Error: ${error.message}\n`);
    return 1;
  }
}

function isMainEntry() {
  if (!process.argv[1]) return false;
  try {
    return realpathSync(process.argv[1]) === realpathSync(fileURLToPath(import.meta.url));
  } catch {
    return resolve(process.argv[1]) === resolve(fileURLToPath(import.meta.url));
  }
}

if (isMainEntry()) {
  const code = await runCli(process.argv.slice(2));
  process.exitCode = code;
}
