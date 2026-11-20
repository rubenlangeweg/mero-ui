import { createStudioTasks, mutateStudioTask, renderStudioBoard } from "./studio-board.mjs";
import { createStudioBookings, mutateStudioBooking, renderStudioBookings } from "./studio-bookings.mjs";
import { createStudioCompanies, mutateStudioCompany, renderStudioCompanies } from "./studio-companies.mjs";
import { renderStudioOverview, renderStudioShell } from "./studio-shell.mjs";
import { studioForm } from "./studio-links.mjs";
import { renderSettingsForm, renderStats } from "./layouts.mjs";
import { renderWorkbench } from "./lab.mjs";

export const studioViews = {
  overview: "Overview", inventory: "Inventory", companies: "Companies", board: "Task board",
  calendar: "Bookings", settings: "Workspace settings",
};

export const studioAssets = [
  "mero.css", "vendor/htmx.min.js", "mero.js", "mero-forms.js", "mero-layouts.css",
  "mero-inventory.css", "mero-inventory.js",
  "studio-workspace.css", "studio-companies.css", "studio-board.css", "studio-bookings.css",
  "studio-board.js", "studio-display.js", "studio-workspace.js",
];

export function createStudio() {
  return { companies: createStudioCompanies(), tasks: createStudioTasks(), bookings: createStudioBookings() };
}

export function studioView(params) {
  const view = params.get("view");
  return Object.hasOwn(studioViews, view) ? view : "overview";
}

export function renderStudio(studio, store, settings, params, options = {}) {
  const view = studioView(params);
  let content;
  switch (view) {
    case "board": content = renderStudioBoard(studio, params, options); break;
    case "calendar": content = renderStudioBookings(studio, params, options); break;
    case "companies": content = renderStudioCompanies(studio, params, options); break;
    case "inventory":
      content = `<header class="mero-page-head"><div><h1>Inventory</h1><p>Products, stock and publication status.</p></div></header>
        ${renderStats(store)}${renderWorkbench(store, { expanded: true, dashboard: true, initial: params, brand: settings.name })}`;
      break;
    case "settings":
      content = `<header class="mero-page-head"><div><h1>Workspace settings</h1></div></header>
        ${renderSettingsForm(options.error ? options.values : settings, options.error, { formAttrs: studioForm("/demo/studio/settings", params) })}`;
      break;
    default: content = renderStudioOverview(studio, store, params, options);
  }
  return renderStudioShell(view, content, studio, { params, brand: settings.name });
}

export const studioActions = {
  "/demo/studio/companies": { view: "companies", mutate: mutateStudioCompany, message: "Company updated" },
  "/demo/studio/tasks": { view: "board", mutate: mutateStudioTask, message: "Task saved" },
  "/demo/studio/bookings": { view: "calendar", mutate: mutateStudioBooking, message: "Booking saved" },
  "/demo/studio/settings": { view: "settings", mutate: (_studio, form, settings) => updateSettings(settings, form), message: "Settings saved" },
};

export function updateSettings(settings, form) {
  const values = { name: (form.get("name") || "").trim(), digest: form.get("digest") === "on" };
  if (!values.name || values.name.length > 48) return { error: "Enter a workspace name up to 48 characters.", values };
  Object.assign(settings, values);
  return {};
}
