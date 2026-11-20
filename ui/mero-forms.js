/**
 * Optional HTMX form behavior. Server responses:
 * 422 + replacement form for validation, or HX-Trigger-After-Settle:
 * {"mero:form-saved":{"message":"Saved"}} after any successful swap.
 * Runs on htmx 2 and htmx 4: mero.js relays the htmx 4 events and that header.
 */
(() => {
  const formSelector = "form[data-mero-form]";
  const requesting = new WeakMap();

  function requestForm(event) {
    const source = event.detail.requestConfig?.elt;
    if (source?.matches(formSelector)) return source;
    // A combobox or other independent request inside a form must not put the
    // whole form into its submission state or replace it on a field error.
    if (source?.matches("button:not([type]), [type=submit], input[type=image]") && source.form?.matches(formSelector)) {
      return source.form;
    }
  }

  document.addEventListener("htmx:beforeRequest", (event) => {
    const form = requestForm(event);
    if (!form) return;
    if (requesting.has(form)) {
      event.preventDefault();
      return;
    }
    const buttons = [...form.elements].filter(control => !control.disabled && (control.type === "submit" || control.type === "image"));
    requesting.set(form, buttons);
    form.setAttribute("aria-busy", "true");
    buttons.forEach((button) => { button.disabled = true; });
    const error = form.querySelector("[data-mero-form-error]");
    if (error) error.hidden = true;
  });

  document.addEventListener("htmx:beforeSwap", (event) => {
    const status = event.detail.xhr.status;
    if (status < 400 || !requestForm(event)) return;
    // htmx 4 swaps every error response. Only a 422 carries a replacement form.
    event.detail.shouldSwap = status === 422;
    if (status === 422) event.detail.isError = false;
  });

  document.addEventListener("htmx:afterSettle", (event) => {
    if (event.detail.xhr?.status !== 422) return;
    const form = event.target.closest(formSelector);
    const field = form?.querySelector('[aria-invalid="true"]');
    field?.focus();
  });

  function showError(form, message) {
    const error = form.querySelector("[data-mero-form-error]");
    if (error) {
      error.textContent = message;
      error.hidden = false;
    }
  }

  for (const errorEvent of ["htmx:sendError", "htmx:timeout"]) {
    document.addEventListener(errorEvent, (event) => {
      const form = requestForm(event);
      if (form) showError(form, "The server could not be reached. Check whether the change was saved before retrying.");
    });
  }

  document.addEventListener("htmx:afterRequest", (event) => {
    const form = requestForm(event);
    if (!form) return;
    form.removeAttribute("aria-busy");
    requesting.get(form)?.forEach((button) => { button.disabled = false; });
    requesting.delete(form);
    if (!event.detail.failed || event.detail.xhr.status === 422) return;
    showError(form, event.detail.xhr.getResponseHeader("Mero-Form-Error") || "The request could not be completed. Check the current state and try again.");
  });

  document.addEventListener("mero:form-saved", (event) => {
    const form = event.target.closest(formSelector);
    if (!form) return;
    const focus = [form.dataset.meroReturnFocus, form.dataset.meroFallbackFocus]
      .filter(Boolean).map((selector) => document.querySelector(selector)).find(Boolean);
    let dialog = form.closest("dialog");
    while (dialog) {
      const parent = form.hasAttribute("data-mero-close-all") ? dialog.parentElement.closest("dialog") : null;
      window.MeroUI.close(dialog, { focus: parent ? null : focus });
      dialog = parent;
    }
    focus?.focus({ preventScroll: true });
    if (event.detail.message) window.MeroUI.toast(event.detail.message, { tone: "success" });
  });
})();
