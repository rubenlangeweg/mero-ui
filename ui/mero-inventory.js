// Optional behavior for the Studio Inventory block. HTMX owns all requests and swaps.
(() => {
  function workbench(event) {
    return event.detail.requestConfig?.elt?.closest("[data-lab]") ?? event.target.closest?.("[data-lab]");
  }
  function showLoadError(event, message) {
    if (event.detail.requestConfig?.elt?.closest("[data-mero-form]")) return;
    const error = workbench(event)?.querySelector("[data-lab-request-error]");
    if (error) {
      error.textContent = message;
      error.hidden = !message;
    }
  }

  document.addEventListener("htmx:configRequest", (event) => {
    const form = event.detail.elt;
    if (!form.matches(".lab-form")) return;
    const scenario = form.closest("[data-lab]")?.querySelector("[data-inventory-scenario]");
    if (scenario?.value) {
      event.detail.parameters.scenario = scenario.value;
      scenario.value = "";
    }
  });
  document.addEventListener("htmx:beforeRequest", event => showLoadError(event, ""));
  document.addEventListener("htmx:responseError", event => showLoadError(event, "Could not load products. Try again."));
  document.addEventListener("htmx:sendError", event => showLoadError(event, "Could not reach the server. Try again."));
  document.addEventListener("htmx:beforeSwap", event => {
    const version = event.detail.xhr.getResponseHeader("Inventory-Revision");
    const lab = workbench(event);
    if (version === null || !lab) return;
    const request = event.detail.requestConfig;
    if (request?.verb === "get") {
      // An older response can arrive while the next keystroke is still debouncing.
      const filters = request.elt;
      const changedQuery = filters?.matches(".lab-toolbar") && ["q", "filterCategory", "order"].some(name =>
        (request.parameters[name] ?? "") !== (filters.elements.namedItem(name)?.value ?? ""));
      if (changedQuery || Number(version) < Number(lab.dataset.inventoryRevision)) {
        event.detail.shouldSwap = false;
        return;
      }
    }
    lab.dataset.inventoryRevision = String(Math.max(Number(version), Number(lab.dataset.inventoryRevision || 0)));
  });
})();
