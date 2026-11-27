/*! @rubenlangeweg/mero-ui 0.10.0 | MIT */
// Optional polling for a read-only status fragment. htmx owns each GET and swap.
// With data-mero-live-follow, an error response carrying HX-Redirect, HX-Location or HX-Refresh
// (such as a 401 after the session expired) is handed to htmx instead of retried.
(() => {
  const lifecycle = (globalThis[Symbol.for("mero.lifecycle")] ??= { init: new Set(), cleanup: new Set(), defaults: {}, config: { locale: null, dialogBackdrop: "mero-only", messages: {} } });
  const config = (lifecycle.config ??= { locale: null, dialogBackdrop: "mero-only", messages: {} });
  const defaults = (lifecycle.defaults ??= {});
  const defaultMessages = { liveError: "Couldn't refresh. Retrying…" };
  Object.assign(defaults, defaultMessages);
  const msg = key => config.messages[key] ?? defaultMessages[key] ?? "";
  function validLocale(tag) {
    if (!tag) return null;
    try { return Intl.getCanonicalLocales(tag)[0] ?? null; } catch { return null; }
  }
  function resolveLocale(node) {
    const explicit = node.closest("[data-mero-locale]")?.getAttribute("data-mero-locale")?.trim() || config.locale;
    if (explicit === "browser") return undefined;
    if (explicit && explicit !== "document") return validLocale(explicit) ?? undefined;
    const valid = validLocale(node.closest("[lang]")?.getAttribute("lang")?.trim());
    if (!valid) return undefined;
    if (explicit === "document" || valid.includes("-")) return valid;
    const reader = (typeof navigator !== "undefined" && navigator.language || "").split("-")[0].toLowerCase();
    return valid.toLowerCase() !== reader ? valid : undefined;
  }
  const selector = "[data-mero-live]";
  const states = new WeakMap();

  function refresh(region) {
    if (region.isConnected && document.visibilityState === "visible" && !region.hasAttribute("data-mero-live-done")) {
      region.dispatchEvent(new CustomEvent("mero:refresh", { bubbles: true }));
    }
  }

  function schedule(region, state) {
    clearTimeout(state.timer);
    if (state.request || !region.isConnected || region.hasAttribute("data-mero-live-done") || document.visibilityState !== "visible") return;
    const raw = state.interval ?? Number(region.dataset.meroLive);
    const base = Number.isFinite(raw) && raw > 0 ? raw : 3000;
    const delay = state.failures > 1 ? Math.min(base * 2 ** Math.min(state.failures - 1, 4), Math.max(base * 8, 30000)) : base;
    state.timer = setTimeout(() => refresh(region), delay);
  }

  function init(region) {
    if (states.has(region)) return;
    // Register state before calling htmx.process() so its synchronous htmx:after:init does not double-schedule.
    const state = { timer: null, request: null, goodAt: Date.now(), followed: false, failures: 0, interval: null };
    states.set(region, state);
    if (window.htmx?.process && !region.hasAttribute("data-htmx-powered")) {
      try { window.htmx.process(region); } catch {}
    }
    schedule(region, state);
  }

  function initAll(root = document) {
    if (!(root instanceof Element || root instanceof Document)) return;
    if (root.matches?.(selector)) init(root);
    root.querySelectorAll(selector).forEach(init);
  }

  function cleanupAll(root = document) {
    if (!(root instanceof Element || root instanceof Document)) return;
    const regions = [...(root.matches?.(selector) ? [root] : []), ...root.querySelectorAll(selector)];
    for (const region of regions) {
      const state = states.get(region);
      if (!state) continue;
      pause(region, state);
      states.delete(region);
    }
  }

  lifecycle.init.add(initAll);
  lifecycle.cleanup.add(cleanupAll);

  document.addEventListener("htmx:after:init", event => {
    if (event.target.matches?.(selector)) init(event.target);
  });
  // The optional script can also load after htmx processed the page.
  initAll(document);

  function pause(region, state) {
    clearTimeout(state.timer);
    const pending = state.request;
    state.request = null;
    pending?.request.abort();
    region.removeAttribute("aria-busy");
  }

  document.addEventListener("visibilitychange", () => {
    for (const region of document.querySelectorAll(selector)) {
      const state = states.get(region);
      if (!state) continue;
      if (document.visibilityState === "visible") refresh(region);
      else pause(region, state);
    }
  });

  document.addEventListener("htmx:before:cleanup", event => {
    const region = event.target;
    const state = states.get(region);
    if (!state) return;
    pause(region, state);
    states.delete(region);
  });

  document.addEventListener("click", event => {
    const region = event.target.closest?.("[data-mero-live-retry]")?.closest(selector);
    if (region) {
      const state = states.get(region);
      if (state) state.failures = 0;
      refresh(region);
    }
  });

  document.addEventListener("htmx:config:request", event => {
    const region = event.detail.ctx.sourceElement;
    if (!region?.matches(selector)) return;
    if (document.visibilityState !== "visible" || region.hasAttribute("data-mero-live-done") || states.get(region)?.request) event.preventDefault();
  });

  document.addEventListener("htmx:before:request", event => {
    const { ctx } = event.detail;
    const state = states.get(ctx.sourceElement);
    if (!state || event.defaultPrevented) return;
    clearTimeout(state.timer);
    state.request = ctx;
    ctx.sourceElement.setAttribute("aria-busy", "true");
  });

  document.addEventListener("htmx:before:response", event => {
    const { ctx } = event.detail;
    if (!ctx.sourceElement?.matches(selector)) return;
    const state = states.get(ctx.sourceElement);
    if (state?.request !== ctx) return event.preventDefault();
    if (ctx.response.raw.ok) return;
    // htmx acts on these headers before any swap, so the error body is never shown.
    if (ctx.sourceElement.hasAttribute("data-mero-live-follow") && (ctx.hx?.redirect || ctx.hx?.location || ctx.hx?.refresh === "true")) {
      state.followed = true;
      ctx.hx = { redirect: ctx.hx.redirect, location: ctx.hx.location, refresh: ctx.hx.refresh };
      return;
    }
    // Stop before htmx interprets swap or redirect headers from an error response.
    event.preventDefault();
  });

  document.addEventListener("htmx:before:swap", event => {
    const { ctx, tasks } = event.detail;
    if (!ctx.sourceElement?.matches(selector)) return;
    const main = tasks.find(task => task.type === "main");
    if (states.get(ctx.sourceElement)?.request !== ctx ||
      (main?.target?.matches?.("[data-mero-live-status]") && main.fragment.textContent.trim() === main.target.textContent.trim())) {
      event.preventDefault();
    }
  });

  document.addEventListener("htmx:finally:request", event => {
    const { ctx } = event.detail;
    const region = ctx.sourceElement;
    const state = states.get(region);
    if (!state || state.request !== ctx) return;
    state.request = null;
    region.removeAttribute("aria-busy");
    // The page is leaving or htmx is loading the new location: polling ends here.
    if (state.followed) {
      region.setAttribute("data-mero-live-done", "");
      return;
    }
    // A cancelled before:request also fires finally in htmx 4.
    if (ctx.response || String(ctx.status).startsWith("error")) {
      const failed = !ctx.response?.raw.ok || String(ctx.status).startsWith("error");
      const error = region.querySelector("[data-mero-live-error]");
      if (!failed) {
        state.goodAt = Date.now();
        state.failures = 0;
        const nextInterval = Number(ctx.response.headers.get("Mero-Live-Interval"));
        if (Number.isFinite(nextInterval) && nextInterval > 0) state.interval = nextInterval;
      } else {
        state.failures += 1;
      }
      // The author's text may name the last good read: "Couldn't refresh. Showing the status from {time}."
      const template = error?.getAttribute("data-mero-live-error");
      let time;
      try { time = new Date(state.goodAt).toLocaleTimeString(resolveLocale(region), { hour: "2-digit", minute: "2-digit" }); }
      catch { time = new Date(state.goodAt).toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" }); }
      const message = !failed ? "" : template ? template.replaceAll("{time}", time) : msg("liveError");
      if (error && error.textContent !== message) error.textContent = message;
      const retry = region.querySelector("[data-mero-live-retry]");
      if (retry) {
        if (!failed && retry === document.activeElement) {
          if (!region.hasAttribute("tabindex")) region.tabIndex = -1;
          region.focus({ preventScroll: true });
        }
        retry.hidden = !failed;
      }
      if (!failed && ctx.response.headers.get("Mero-Live") === "done") region.setAttribute("data-mero-live-done", "");
    }
    schedule(region, state);
  });
})();
