(async () => {
  const studio = document.querySelector("[data-theme-studio]");
  if (!studio) return;
  const { defaults, iframeURL, presets, previews, readTheme, themeTokens, themeCSS } = await import("./theme-model.mjs");
  const form = studio.querySelector("#ts-settings");
  const canvas = studio.querySelector("[data-ts-canvas]");
  const app = studio.querySelector("[data-ts-app]");
  const components = studio.querySelector("[data-ts-components]");
  const dialog = studio.querySelector("[data-ts-dialog]");
  const cssOutput = dialog.querySelector("textarea");
  const notice = studio.querySelector("[data-ts-notice]");
  let state = readTheme(new URLSearchParams(location.search));
  const shellAliases = {
    "--site-bg":"--rl-bg", "--site-panel":"--rl-surface", "--site-raised":"--rl-raised",
    "--site-fg":"--rl-text", "--site-muted":"--rl-muted", "--site-subtle":"--rl-muted",
    "--site-line":"--rl-line", "--site-accent":"--rl-accent", "--site-accent-ink":"--rl-accent-ink",
    "--site-primary":"--rl-primary", "--site-primary-ink":"--rl-primary-ink", "--site-font":"--rl-font",
  };
  function studioURL(settings) {
    const url = new URL(location.href);
    url.search = new URLSearchParams(settings).toString();
    url.hash = "";
    return url;
  }
  function paint(element, tokens) {
    element.dataset.theme = state.mode;
    for (const [key,value] of Object.entries(tokens)) element.style.setProperty(key,value);
  }
  function paintApp() {
    const frame = app.querySelector("iframe");
    const root = frame?.contentDocument?.documentElement;
    if (!root) return;
    paint(root, themeTokens(state));
    for (const [name,token] of Object.entries(shellAliases)) root.style.setProperty(name, "var(" + token + ")");
  }
  function syncPreview() {
    paint(canvas, themeTokens(state));
    const isComponents = state.view === "components";
    app.hidden = isComponents;
    components.hidden = !isComponents;
    if (isComponents) return;
    let frame = app.querySelector("iframe");
    if (!frame || frame.dataset.view !== state.view) {
      frame = document.createElement("iframe");
      frame.dataset.view = state.view;
      frame.title = previews[state.view] + " theme preview";
      frame.src = iframeURL(state);
      app.replaceChildren(frame);
    }
    paintApp();
  }
  function render(historyMethod) {
    for (const [key,value] of Object.entries(state)) form.elements.namedItem(key).value = value;
    for (const output of studio.querySelectorAll("[data-value]")) {
      const key = output.dataset.value;
      output.textContent = state[key] + (key === "hue" ? "°" : "");
    }
    for (const button of studio.querySelectorAll("[data-ts-preset]")) {
      const palette = presets[button.dataset.tsPreset];
      button.setAttribute("aria-pressed", String(Object.entries(palette).every(([key,value]) => state[key] === value)));
    }
    for (const link of studio.querySelectorAll("[data-ts-view]")) {
      const view = link.dataset.tsView;
      if (view === state.view) link.setAttribute("aria-current", "page");
      else link.removeAttribute("aria-current");
      link.href = studioURL({...state, view});
    }
    studio.style.setProperty("--ts-hue", state.hue);
    syncPreview();
    cssOutput.value = themeCSS(state);
    if (historyMethod) {
      history[historyMethod](history.state, "", studioURL(state));
      notice.replaceChildren();
    }
  }
  // A full navigation inside an embedded example produces a new document.
  app.addEventListener("load", event => {
    if (event.target.tagName === "IFRAME") paintApp();
  }, true);
  studio.addEventListener("input", event => {
    if (event.target.form !== form || !event.target.name) return;
    state = readTheme(new URLSearchParams(new FormData(form)));
    render("replaceState");
  });
  form.addEventListener("submit", event => event.preventDefault());
  studio.addEventListener("click", async event => {
    const customize = event.target.closest("[data-ts-customize]");
    if (customize) {
      const expanded = form.toggleAttribute("data-expanded");
      customize.setAttribute("aria-expanded", String(expanded));
      customize.textContent = expanded ? "Done" : "Customize";
      return;
    }
    const preset = event.target.closest("[data-ts-preset]");
    if (preset) {
      state = {...state, ...presets[preset.dataset.tsPreset]};
      render("replaceState");
      return;
    }
    const view = event.target.closest("[data-ts-view]");
    if (view && !event.metaKey && !event.ctrlKey && !event.shiftKey && !event.altKey && event.button === 0) {
      event.preventDefault();
      if (state.view !== view.dataset.tsView) {
        state = {...state, view:view.dataset.tsView};
        render("pushState");
      }
      return;
    }
    if (event.target.closest("[data-ts-reset]")) {
      state = {...defaults, view:state.view};
      render("replaceState");
      notice.textContent = "Theme reset.";
    }
    if (event.target.closest("[data-ts-export]")) {
      dialog.querySelector("[data-ts-export-notice]").textContent = "";
      dialog.showModal();
    }
    if (event.target.closest("[data-ts-copy]")) {
      const status = dialog.querySelector("[data-ts-export-notice]");
      try {
        await navigator.clipboard.writeText(cssOutput.value);
        status.textContent = "CSS copied.";
      } catch {
        cssOutput.focus();
        cssOutput.select();
        status.textContent = "CSS selected. Copy it from the field.";
      }
    }
    if (event.target.closest("[data-ts-share]")) {
      const url = studioURL(state).href;
      try {
        await navigator.clipboard.writeText(url);
        notice.textContent = "Theme link copied.";
      } catch {
        const input = document.createElement("input");
        input.className = "rl-input";
        input.value = url;
        input.readOnly = true;
        input.setAttribute("aria-label", "Theme link");
        notice.replaceChildren(input);
        input.focus();
        input.select();
      }
    }
    if (event.target.closest("[data-ts-download]")) {
      const url = URL.createObjectURL(new Blob([cssOutput.value], {type:"text/css"}));
      const link = document.createElement("a");
      link.href = url;
      link.download = "mero-theme.css";
      link.click();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
    }
  });
  components.querySelector("[data-ts-invite]").addEventListener("submit", event => {
    event.preventDefault();
    const fields = new FormData(event.target);
    event.target.querySelector("output").textContent = fields.get("email") + " · " + fields.get("role") + " invitation ready.";
  });
  window.addEventListener("popstate", () => {
    state = readTheme(new URLSearchParams(location.search));
    render();
  });
  render();
  studio.dataset.ready = "true";
})();
