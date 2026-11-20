import { groups as core } from "./components.mjs";
import { groups as galleries } from "./gallery-components.mjs";
import { groups as collections } from "./collection-components.mjs";
import { groups as workspace } from "./workspace-components.mjs";
import { groups as insights } from "./insight-components.mjs";

import { groups as composition } from "./composition-components.mjs";

const modules = [
  { name: "gallery", groups: galleries },
  { name: "collections", groups: collections },
  { name: "workspace", groups: workspace },
  { name: "insights", groups: insights },
  { name: "core", groups: core },
  { name: "composition", groups: composition },
];

export const groups = [];
export const components = new Map();
for (const module of modules) {
  for (const group of module.groups) {
    let category = groups.find((entry) => entry.name.toLowerCase() === group.name.toLowerCase());
    if (!category) {
      category = { name: group.name, items: [] };
      groups.push(category);
    }
    for (const item of group.items) {
      if (components.has(item.id)) throw new Error(`Duplicate component ID: ${item.id}`);
      const component = { ...item, module: module.name, category: group.name };
      components.set(item.id, component);
      category.items.push(component);
    }
  }
}

export function moduleAssets(module) {
  if (!module || module === "core") return [];
  return [`mero-${module}.css`, `mero-${module}.js`];
}

export function catalogGroupId(name) {
  return "group-" + name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/-$/, "");
}
