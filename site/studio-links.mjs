import { escapeHtml as esc } from "./html.mjs";

const path = "/layouts/dashboard";
const appearance = ["embed", "theme", "studio", "mode", "base", "hue", "chroma", "lightness", "radius", "formRadius", "font"];
const target = 'hx-target="#studio-workspace" hx-swap="outerHTML show:none"';

function appearanceParams(context) {
  const params = new URLSearchParams();
  for (const key of appearance) {
    const value = context?.get(key);
    if (value) params.set(key, value);
  }
  return params;
}

export function studioUrl(view, values = {}, context) {
  const params = appearanceParams(context);
  if (view !== "overview") params.set("view", view);
  for (const [key, value] of values instanceof URLSearchParams ? values : Object.entries(values)) {
    if (value != null && value !== "") params.set(key, value);
  }
  const query = params.toString();
  return path + (query ? "?" + query : "");
}

export function studioLink(view, values, context) {
  const url = esc(studioUrl(view, values, context));
  return `href="${url}" hx-get="${url}" ${target} hx-push-url="true" hx-sync="#studio-workspace:replace"`;
}

export function studioContextFields(context) {
  return [...appearanceParams(context)].map(([key, value]) =>
    `<input type="hidden" name="${key}" value="${esc(value)}">`).join("");
}

export function studioSearch() {
  return `action="${path}" method="get" hx-get="${path}" ${target} hx-push-url="true" hx-sync="#studio-workspace:replace"`;
}

export function studioForm(action, context) {
  const params = appearanceParams(context);
  const url = esc(action + (params.size ? "?" + params.toString() : ""));
  return `action="${url}" method="post" hx-post="${url}" ${target} data-rl-form`;
}
