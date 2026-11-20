import { escapeHtml as esc } from "./html.mjs";
import { fonts, iframeURL, presets, previews, radiusOptions, readTheme, themeCSS, themeTokens } from "../public/theme-model.mjs";

export const themeAssets = ["themes.css", "themes.js"];

const symbols = {
  share: '<path d="M10 13a4.5 4.5 0 0 0 6.4 0l3-3a4.5 4.5 0 0 0-6.4-6.4l-1.7 1.7M14 11a4.5 4.5 0 0 0-6.4 0l-3 3a4.5 4.5 0 0 0 6.4 6.4l1.7-1.7"/>',
  code: '<path d="m8 7-5 5 5 5m8-10 5 5-5 5m-3-15-2 20"/>',
  reset: '<path d="M4 9a8 8 0 1 1-.2 5M4 4v5h5"/>',
  light: '<circle cx="12" cy="12" r="4"/><path d="M12 2v2m0 16v2M2 12h2m16 0h2M5 5l1.5 1.5m11 11L19 19M5 19l1.5-1.5m11-11L19 5"/>',
  dark: '<path d="M20.8 14.5A9 9 0 0 1 9.5 3.2 9 9 0 1 0 20.8 14.5Z"/>',
};
function icon(key) {
  return `<svg aria-hidden="true" viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="1.65" stroke-linecap="round" stroke-linejoin="round">${symbols[key]}</svg>`;
}
function menu(name, label, choices, value) {
  return `<label class="ts-menu"><span>${label}</span><select class="rl-select" name="${name}">${Object.entries(choices).map(([key, text]) =>
    `<option value="${key}"${key === value ? " selected" : ""}>${text}</option>`).join("")}</select></label>`;
}
function slider(state, key, label, max, step) {
  const value = state[key];
  return `<div class="ts-slider"><label for="ts-${key}">${label}</label><span aria-hidden="true" data-value="${key}">${value}${key === "hue" ? "°" : ""}</span>
    <input id="ts-${key}" type="range" name="${key}" min="0" max="${max}" step="${step}" value="${value}"></div>`;
}
function selectedPreset(state, color) {
  return Object.entries(color).every(([key, value]) => state[key] === value);
}

const weekBars = [32, 43, 36, 57, 41, 46, 67, 54, 63, 59, 48, 76, 66, 58, 72, 83, 61, 77, 71, 89, 84, 94, 78, 100];
function specimens() {
  return `<div class="ts-specimens">
    <article class="rl-card ts-chart">
      <div class="ts-card-heading"><h3>Workspace activity</h3><span class="ts-period">Last 24 hours</span></div>
      <div class="ts-metric"><strong>2,480</strong><span class="rl-badge rl-badge-accent">+12.6%</span></div>
      <figure class="ts-chart-figure" aria-label="Hourly requests rose from 32 at midnight to 100 at 11 PM."><div class="ts-bars" aria-hidden="true">${weekBars.map(n => `<i style="--ts-value:${n}%"></i>`).join("")}</div>
      <figcaption><span>00:00</span><span>06:00</span><span>12:00</span><span>18:00</span><span>23:00</span></figcaption></figure>
    </article>
    <article class="rl-card ts-invite"><h3>Invite a teammate</h3>
      <form data-ts-invite><label class="rl-field"><span>Email address</span><input required class="rl-input" name="email" type="email" placeholder="name@studio.co" autocomplete="off"></label>
      <label class="rl-field"><span>Role</span><select class="rl-select" name="role"><option>Member</option><option>Admin</option><option>Viewer</option></select></label>
      <button class="rl-button rl-button-primary">Preview invitation</button><output class="ts-invite-status"></output></form>
    </article>
    <article class="rl-card ts-prefs"><h3>Notifications</h3>
      <label class="ts-preference"><span><strong>Product updates</strong><small>New releases and improvements</small></span><input type="checkbox" role="switch" class="rl-switch" checked></label>
      <label class="ts-preference"><span><strong>Weekly digest</strong><small>A summary every Friday</small></span><input type="checkbox" role="switch" class="rl-switch"></label>
    </article></div>`;
}

export function themesPage(params = new URLSearchParams()) {
  const state = readTheme(params);
  const variables = Object.entries(themeTokens(state)).map(([k, v]) => k + ":" + v).join(";");
  return `<div class="site-wrap ts-page" data-theme-studio>
    <header class="ts-title"><div><h1>Theme studio</h1><p>Style Mero components and try your theme on a working app.</p></div>
      <div class="ts-actions"><button type="button" class="rl-button rl-button-outline" data-ts-share>${icon("share")}Share link</button>
      <button type="button" class="rl-button rl-button-primary" data-ts-export>${icon("code")}Export CSS</button></div></header>
    <output data-ts-notice class="ts-notice" aria-live="polite"></output>
    <div class="ts-workbench">
      <form class="ts-settings" action="/themes" method="get" id="ts-settings">
        <div class="ts-settings-heading"><h2>Theme settings</h2><button type="button" class="rl-button rl-button-sm ts-customize" data-ts-customize aria-controls="ts-settings-fields" aria-expanded="false">Customize</button><button type="button" class="rl-button rl-button-ghost rl-button-sm rl-button-icon" data-ts-reset title="Reset theme" aria-label="Reset theme">${icon("reset")}</button></div>
        <div class="ts-settings-fields" id="ts-settings-fields">
        <fieldset class="ts-presets"><legend>Preset</legend><div>${Object.entries(presets).map(([name, values]) => `<button class="ts-preset" type="button" data-ts-preset="${name}" aria-pressed="${selectedPreset(state,values)}" style="--ts-swatch:oklch(.76 ${values.chroma} ${values.hue})"><span></span>${name}</button>`).join("")}</div></fieldset>
        ${menu("base", "Base", { "0": "Neutral", "1": "Slate", "2": "Sand" }, state.base)}
        <div class="ts-sliders">${slider(state, "hue", "Hue", 360, 1)}${slider(state, "chroma", "Chroma", .25, .01)}${slider(state, "lightness", "Lightness", 1, .01)}</div>
        ${menu("font", "Font family", Object.fromEntries(Object.entries(fonts).map(([k,v]) => [k,v[0]])), state.font)}
        <div class="ts-radius">${menu("radius", "Surface radius", radiusOptions, state.radius)}${menu("formRadius", "Form radius", radiusOptions, state.formRadius)}</div>
        <input type="hidden" name="view" value="${state.view}"><noscript><button class="rl-button" type="submit">Update preview</button></noscript>
        <a class="ts-mobile-link" href="#ts-preview">View preview ↓</a></div>
      </form>
      <section class="ts-preview" id="ts-preview" aria-label="Live preview">
        <div class="ts-preview-head"><nav aria-label="Preview screens">${Object.entries(previews).map(([key, label]) => {
          const search = new URLSearchParams({...state, view:key});
          return `<a data-ts-view="${key}" href="/themes?${esc(search)}"${key === state.view ? ' aria-current="page"' : ''}>${label}</a>`;
        }).join("")}</nav>
        <fieldset class="ts-modes"><legend class="ts-sr">Preview appearance</legend>${["light","dark"].map(mode => `<label title="${mode === "dark" ? "Dark" : "Light"} preview"><input type="radio" name="mode" value="${mode}" form="ts-settings" aria-label="${mode === "dark" ? "Dark" : "Light"} preview"${state.mode === mode ? " checked" : ""}>${icon(mode)}</label>`).join("")}</fieldset></div>
        <div class="ts-canvas" data-ts-canvas data-sample-scope data-theme="${state.mode}" style="${esc(variables)}">
           <div data-ts-components${state.view === "components" ? "" : " hidden"}>${specimens()}</div>
           <div data-ts-app${state.view === "components" ? " hidden" : ""}>${state.view === "components" ? "" : `<iframe title="${previews[state.view]} theme preview" src="${esc(iframeURL(state))}" data-view="${state.view}"></iframe>`}</div>
        </div>
      </section>
    </div>
    <dialog class="ts-dialog" data-ts-dialog aria-labelledby="ts-export-title"><header><h2 id="ts-export-title">Export theme</h2>
      <form method="dialog"><button type="submit" class="rl-button rl-button-ghost rl-button-icon" aria-label="Close export"><span class="rl-dismiss-mark" aria-hidden="true"></span></button></form></header>
      <p>Load these tokens after <code>mero.css</code>. Both appearances are included.</p>
      <label class="ts-sr" for="ts-css">Theme CSS</label><textarea id="ts-css" readonly spellcheck="false">${esc(themeCSS(state))}</textarea>
      <footer><output data-ts-export-notice aria-live="polite"></output><button class="rl-button rl-button-outline" type="button" data-ts-download>Download CSS</button><button class="rl-button rl-button-primary" type="button" data-ts-copy>Copy CSS</button></footer></dialog>
    </div>`;
}
