import { mkdir, readdir, unlink, writeFile } from "node:fs/promises";
import { components } from "../site/catalog.mjs";
import { agentDocument, agentIndexes } from "../site/agent-docs.mjs";

const directory = new URL("../agent-docs/", import.meta.url);
const componentDir = new URL("components/", directory);
await mkdir(componentDir, { recursive: true });
const componentFiles = new Set(Array.from(components.keys(), id => id + ".md"));
for (const old of await readdir(componentDir)) {
  if (old.endsWith(".md") && !componentFiles.has(old)) await unlink(new URL(old, componentDir));
}
for (const file of [...agentIndexes, ...Array.from(componentFiles, name => "components/" + name)]) {
  await writeFile(new URL(file, directory), agentDocument(file));
}
