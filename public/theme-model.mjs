export const presets = {
  Graphite: { base: "0", hue: "0", chroma: "0", lightness: "0" },
  Cobalt: { base: "1", hue: "249", chroma: "0.14", lightness: "0.58" },
  Fern: { base: "0", hue: "155", chroma: "0.13", lightness: "0.55" },
  Clay: { base: "2", hue: "47", chroma: "0.14", lightness: "0.67" },
};
export const radiusOptions = { none: "None", small: "Small", medium: "Medium", large: "Large" };
export const fonts = {
  geist: ["Geist", "Geist, Inter, system-ui, sans-serif"],
  system: ["System sans", "system-ui, -apple-system, sans-serif"],
  mono: ["Geist Mono", '"Geist Mono", ui-monospace, monospace'],
  serif: ["Georgia", "Georgia, ui-serif, serif"],
};
export const previews = {
  components: "Components", dashboard: "Dashboard", mail: "Mail", chat: "Chat", crm: "CRM", finance: "Finance",
};
export const defaults = { ...presets.Cobalt, radius: "medium", formRadius: "medium", font: "geist", mode: "dark", view: "components" };
export function iframeURL(state) {
  return "/layouts/" + state.view + "?" + new URLSearchParams({embed:"1", studio:"1", ...state});
}
const bases = {
  "0": [0, 0],
  "1": [250, 0.013],
  "2": [65, 0.016],
};
const surfaceRadius = { none: "0px", small: "0.5rem", medium: "1rem", large: "1.5rem" };
const controlRadius = { none: "0px", small: "0.375rem", medium: "0.625rem", large: "1.125rem" };

export function readTheme(params) {
  const raw = key => params.get(key);
  function choice(key, allowed) {
    return allowed.includes(raw(key)) ? raw(key) : defaults[key];
  }
  function number(key, max, precision) {
    const value = raw(key);
    if (value === null || value.trim() === "" || !Number.isFinite(Number(value))) return defaults[key];
    return String(Number(Math.max(0, Math.min(max, Number(value))).toFixed(precision)));
  }
  return {
    base: choice("base", Object.keys(bases)), hue: number("hue", 360, 0),
    chroma: number("chroma", 0.25, 2), lightness: number("lightness", 1, 2),
    radius: choice("radius", Object.keys(surfaceRadius)), formRadius: choice("formRadius", Object.keys(controlRadius)),
    font: choice("font", Object.keys(fonts)), mode: choice("mode", ["light", "dark"]), view: choice("view", Object.keys(previews)),
  };
}

export function themeTokens(state, mode = state.mode) {
  const dark = mode === "dark";
  const [baseHue, tint] = bases[state.base];
  const base = lightness => `oklch(${lightness} ${tint} ${baseHue})`;
  const lightness = Number(state.lightness);
  // The foreground range stays legible as the chosen hue and chroma change.
  const accent = `oklch(${(dark ? .72 + .16 * lightness : .30 + .16 * lightness).toFixed(3)} ${state.chroma} ${state.hue})`;
  return {
    "--rl-font": fonts[state.font][1], "--rl-radius-panel": surfaceRadius[state.radius], "--rl-radius": controlRadius[state.formRadius],
    "--rl-bg": base(dark ? .17 : .965), "--rl-surface": base(dark ? .215 : .995),
    "--rl-raised": base(dark ? .265 : .945), "--rl-hover": base(dark ? .31 : .91),
    "--rl-line": base(dark ? .34 : .86), "--rl-control-line": base(dark ? .57 : .54),
    "--rl-text": base(dark ? .965 : .19), "--rl-muted": base(dark ? .77 : .44),
    "--rl-accent": accent, "--rl-primary": accent, "--rl-accent-ink": dark ? "#101216" : "#fff",
    "--rl-primary-ink": dark ? "#101216" : "#fff",
    "--rl-switch-active": dark ? "color-mix(in srgb, var(--rl-accent) 56%, #101216)" : "var(--rl-accent)",
  };
}

export function themeCSS(state) {
  return ["light", "dark"].map(mode => {
    const selector = mode === "light" ? ':root, [data-theme="light"]' : '[data-theme="dark"]';
    const declarations = Object.entries(themeTokens(state, mode)).map(([key, value]) => `  ${key}: ${value};`).join("\n");
    return `${selector} {\n  color-scheme: ${mode};\n${declarations}\n}`;
  }).join("\n\n") + "\n";
}
