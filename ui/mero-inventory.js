// Optional behavior for the Studio Inventory block. HTMX owns all requests and swaps.
(() => {
  function workbench(event) {
    return event.detail.ctx?.sourceElement?.closest?.("[data-lab]") ?? event.target.closest?.("[data-lab]");
  }
  function showLoadError(event, message) {
    if (event.detail.ctx?.sourceElement?.closest?.("[data-mero-form]")) return;
    const error = workbench(event)?.querySelector("[data-lab-request-error]");
    if (error) {
      error.textContent = message;
      error.hidden = !message;
    }
  }

  document.addEventListener("htmx:config:request", (event) => {
    const form = event.target;
    if (!form.matches?.(".lab-form")) return;
    const scenario = form.closest("[data-lab]")?.querySelector("[data-inventory-scenario]");
    if (scenario?.value) {
      event.detail.ctx.request.body.set("scenario", scenario.value);
      scenario.value = "";
    }
  });
  document.addEventListener("htmx:before:request", event => showLoadError(event, ""));
  document.addEventListener("htmx:response:error", event => showLoadError(event, "Could not load products. Try again."));
  // No response, not cancelled (still "issuing"), not a timeout or user abort: the server could not be reached.
  document.addEventListener("htmx:finally:request", event => {
    const { ctx } = event.detail;
    if (ctx.response || !String(ctx.status).startsWith("error") || ctx.request.signal?.aborted) return;
    showLoadError(event, "Could not reach the server. Try again.");
  });
  document.addEventListener("htmx:before:swap", event => {
    const { ctx } = event.detail;
    const version = ctx.response?.headers.get("Inventory-Revision") ?? null;
    const lab = workbench(event);
    // htmx 4 would swap a failed load into the results. Forms handle their own errors.
    if (lab && ctx.response?.status >= 400 && !ctx.sourceElement?.closest?.("[data-mero-form]")) {
      event.preventDefault();
      return;
    }
    if (version === null || !lab) return;
    if (ctx.request?.method === "GET") {
      // An older response can arrive while the next keystroke is still debouncing.
      const filters = ctx.sourceElement;
      const sent = new URL(ctx.request.action, location.href).searchParams;
      const changedQuery = filters?.matches?.(".lab-toolbar") && ["q", "filterCategory", "order"].some(name =>
        (sent.get(name) ?? "") !== (filters.elements.namedItem(name)?.value ?? ""));
      if (changedQuery || Number(version) < Number(lab.dataset.inventoryRevision)) {
        event.preventDefault();
        return;
      }
    }
    lab.dataset.inventoryRevision = String(Math.max(Number(version), Number(lab.dataset.inventoryRevision || 0)));
  });
})();
