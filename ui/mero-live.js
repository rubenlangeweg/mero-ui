/*! @rubenlangeweg/mero-ui 0.6.1 | MIT */
// Optional polling for a read-only status fragment. htmx owns each GET and swap.
(() => {
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
    const interval = Number(region.dataset.meroLive);
    state.timer = setTimeout(() => refresh(region), Number.isFinite(interval) && interval > 0 ? interval : 3000);
  }

  function init(region) {
    if (states.has(region)) return;
    const state = { timer: null, request: null };
    states.set(region, state);
    schedule(region, state);
  }

  document.addEventListener("htmx:after:init", event => {
    if (event.target.matches?.(selector)) init(event.target);
  });
  // The optional script can also load after htmx processed the page.
  document.querySelectorAll(selector).forEach(init);

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
    if (region) refresh(region);
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
    // Stop before htmx interprets swap or redirect headers from an error response.
    if (states.get(ctx.sourceElement)?.request !== ctx || !ctx.response.raw.ok) event.preventDefault();
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
    // A cancelled before:request also fires finally in htmx 4.
    if (ctx.response || String(ctx.status).startsWith("error")) {
      const failed = !ctx.response?.raw.ok || String(ctx.status).startsWith("error");
      const error = region.querySelector("[data-mero-live-error]");
      const message = failed ? "Couldn't refresh. Retrying…" : "";
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
