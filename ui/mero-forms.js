/**
 * Optional HTMX form behavior. Server responses:
 * 422 + replacement form for validation, or HX-Trigger-After-Settle:
 * {"mero:form-saved":{"message":"Saved"}} after any successful swap.
 * Standalone [data-mero-action] buttons get data-mero-action-state
 * pending|succeeded|rejected|unknown: 2xx succeeded, 4xx (not 408) rejected,
 * anything else unknown. Mero-Action-Outcome and Mero-Action-Message headers
 * override the state and text; a bubbling mero:action event reports each step.
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
    if (event.detail.xhr.status !== 422 || !requestForm(event)) return;
    event.detail.shouldSwap = true;
    event.detail.isError = false;
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

  const actionOf = event => event.detail.elt?.closest?.("[data-mero-action]");
  const actionMessages = {
    succeeded: ["Done.", "success"],
    rejected: ["The server refused this action. Nothing changed.", "warning"],
    unknown: ["The result is unknown. Check the current state before you try again.", "danger"],
  };
  const actionStatus = action => action.parentElement?.querySelector("[data-mero-action-status]");

  // htmx queues a click made during a request and sends it later, so the guard runs before its sync logic.
  // aria-disabled instead of disabled keeps focus on the button.
  document.addEventListener("htmx:confirm", (event) => {
    if (actionOf(event)?.dataset.meroActionState === "pending") event.preventDefault();
  });

  // A swap can detach the button before afterRequest, so the request remembers its button and status.
  const actionRequests = new WeakMap();

  // beforeSend, not beforeRequest: a cancelled request never fires afterRequest and would stay pending.
  document.addEventListener("htmx:beforeSend", (event) => {
    const action = actionOf(event);
    if (!action || !event.detail.xhr) return;
    const output = actionStatus(action);
    actionRequests.set(event.detail.xhr, { action, output });
    action.dataset.meroActionState = "pending";
    action.setAttribute("aria-busy", "true");
    action.setAttribute("aria-disabled", "true");
    if (output) { output.textContent = ""; delete output.dataset.tone; }
    action.dispatchEvent(new CustomEvent("mero:action", { bubbles: true, detail: { state: "pending" } }));
  });

  // htmx fires afterRequest after load, error, abort and timeout alike.
  document.addEventListener("htmx:afterRequest", (event) => {
    const xhr = event.detail.xhr;
    const request = xhr && actionRequests.get(xhr);
    if (!request) return;
    actionRequests.delete(xhr); // htmx fires afterRequest again on a connected element after a detaching swap
    const { action, output } = request;
    const status = xhr.status;
    const header = xhr.getResponseHeader("Mero-Action-Outcome");
    const state = Object.hasOwn(actionMessages, header) ? header
      : status >= 200 && status < 300 ? "succeeded"
      : status >= 400 && status < 500 && status !== 408 ? "rejected" : "unknown";
    const [fallback, tone] = actionMessages[state];
    const message = xhr.getResponseHeader("Mero-Action-Message") || fallback;
    action.removeAttribute("aria-busy");
    action.removeAttribute("aria-disabled");
    action.dataset.meroActionState = state;
    if (output?.isConnected) {
      // Clearing first makes a repeated message announce again.
      output.textContent = "";
      output.textContent = message;
      output.dataset.tone = tone;
    } else {
      window.MeroUI?.toast(message, { tone, trigger: action.isConnected ? action : event.target });
    }
    (action.isConnected ? action : document).dispatchEvent(new CustomEvent("mero:action", { bubbles: true, detail: { state, status, message } }));
  });
})();
