/*! @rubenlangeweg/mero-ui 0.7.0 | MIT */
/**
 * Optional HTMX form behavior. Server responses:
 * 422 + replacement form for validation, or HX-Trigger:
 * {"mero:form-saved":{"message":"Saved"}}, which htmx 4 fires after the swap settles.
 * Standalone [data-mero-action] buttons get data-mero-action-state
 * pending|succeeded|rejected|unknown: 2xx succeeded, 4xx (not 408) rejected,
 * anything else unknown. Mero-Action-Outcome and Mero-Action-Message headers
 * override the state and text; a bubbling mero:action event reports each step.
 */
(() => {
  const formSelector = "form[data-mero-form]";
  const confirmSelector = "form[data-mero-form][data-mero-confirm]";
  const requesting = new WeakMap();
  const formRequests = new WeakMap();
  // htmx 4 also reports requests a before:request listener cancelled: no response, still "issuing".
  const cancelled = ctx => !ctx.response && !String(ctx.status).startsWith("error");

  function requestForm(event) {
    const source = event.detail.ctx?.sourceElement;
    if (source?.matches(formSelector)) return source;
    // A combobox or other independent request inside a form must not put the
    // whole form into its submission state or replace it on a field error.
    if (source?.matches("button:not([type]), [type=submit], input[type=image]") && source.form?.matches(formSelector)) {
      return source.form;
    }
  }

  function checkConfirmation(form) {
    const expected = form.querySelector("[data-mero-confirm-phrase]")?.textContent.trim();
    const typed = form.querySelector("[data-mero-confirm-input]")?.value.trim();
    const reason = form.querySelector("[data-mero-confirm-reason][required]");
    const matches = Boolean(expected && typed === expected);
    const ready = matches && (!reason || Boolean(reason.value.trim()));
    for (const button of form.querySelectorAll("[data-mero-confirm-submit]")) {
      button.disabled = !ready || requesting.has(form);
    }
    const hint = form.querySelector("[data-mero-confirm-hint]");
    const message = !matches ? "Type the phrase exactly to enable confirmation."
      : !ready ? "Phrase matches. Enter a reason to enable confirmation." : "Ready to confirm.";
    if (hint && hint.textContent !== message) hint.textContent = message;
    return ready;
  }

  document.addEventListener("input", event => {
    const form = event.target.closest?.(confirmSelector);
    if (form) checkConfirmation(form);
  });
  document.addEventListener("htmx:after:init", event => {
    if (event.target.matches?.(confirmSelector)) checkConfirmation(event.target);
  });
  document.addEventListener("reset", event => {
    if (event.target.matches(confirmSelector)) queueMicrotask(() => checkConfirmation(event.target));
  });
  document.addEventListener("close", event => {
    if (!event.target.matches?.("dialog") || event.target.open) return;
    for (const form of event.target.querySelectorAll(confirmSelector)) {
      const input = form.querySelector("[data-mero-confirm-input]");
      if (input) input.value = "";
      checkConfirmation(form);
    }
  }, true);

  // Guard implicit and scripted submissions too, before htmx can queue a duplicate.
  document.addEventListener("htmx:config:request", event => {
    const form = requestForm(event);
    if (form?.matches(confirmSelector) && (!checkConfirmation(form) || requesting.has(form))) event.preventDefault();
  });

  document.addEventListener("htmx:before:request", (event) => {
    const form = requestForm(event);
    if (!form) return;
    if (requesting.has(form)) {
      event.preventDefault();
      return;
    }
    formRequests.set(event.detail.ctx, form);
    const buttons = [...form.elements].filter(control => !control.disabled && (control.type === "submit" || control.type === "image"));
    requesting.set(form, { buttons, ctx: event.detail.ctx });
    form.setAttribute("aria-busy", "true");
    buttons.forEach((button) => { button.disabled = true; });
    const error = form.querySelector("[data-mero-form-error]");
    if (error) error.hidden = true;
  });

  document.addEventListener("htmx:before:swap", (event) => {
    const status = event.detail.ctx.response?.status;
    if (!(status >= 400) || !requestForm(event)) return;
    // htmx 4 swaps every error response. Only a 422 carries a replacement form.
    if (status !== 422) event.preventDefault();
  });

  // after:swap, not after:settle: htmx 4 applies [autofocus] in the new form after settling.
  // It fires on the source, which htmx points at the new form when the swap replaced it.
  document.addEventListener("htmx:after:swap", (event) => {
    if (event.detail.ctx.response?.status !== 422) return;
    const form = event.target.closest?.(formSelector);
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

  document.addEventListener("htmx:finally:request", (event) => {
    const { ctx } = event.detail;
    const form = formRequests.get(ctx);
    // A cancelled duplicate has no entry, so it never releases the request still in flight.
    if (!form) return;
    form.removeAttribute("aria-busy");
    requesting.get(form)?.buttons.forEach((button) => { button.disabled = false; });
    requesting.delete(form);
    const typed = form.matches(confirmSelector);
    if (typed) checkConfirmation(form);
    if (cancelled(ctx)) return;
    const status = ctx.response?.status;
    if (typed) {
      if (!status || status >= 500 || String(ctx.status).startsWith("error")) {
        showError(form, "Outcome unknown. Check the current state before retrying.");
      } else if (status >= 400 && status !== 422) {
        showError(form, ctx.response.headers.get("Mero-Form-Error") || "The server rejected this action.");
      }
      return;
    }
    const signal = ctx.request.signal;
    if (!ctx.response && (signal?.reason === "timeout" || !signal?.aborted)) {
      showError(form, "The server could not be reached. Check whether the change was saved before retrying.");
    } else if (!ctx.response || (status >= 400 && status !== 422)) {
      showError(form, ctx.response?.headers.get("Mero-Form-Error") || "The request could not be completed. Check the current state and try again.");
    }
  });

  document.addEventListener("mero:form-saved", (event) => {
    const form = event.target.closest?.(formSelector);
    if (!form) return;
    // Typed confirmations keep their form on success (HX-Reswap: none). An
    // error response carrying a stray success trigger must never dismiss it.
    if (form.matches(confirmSelector)) {
      const ctx = requesting.get(form)?.ctx;
      if (!ctx?.response || ctx.response.status < 200 || ctx.response.status >= 300 || String(ctx.status).startsWith("error")) return;
    }
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

  const actionOf = event => event.target.closest?.("[data-mero-action]");
  const actionMessages = {
    succeeded: ["Done.", "success"],
    rejected: ["The server refused this action. Nothing changed.", "warning"],
    unknown: ["The result is unknown. Check the current state before you try again.", "danger"],
  };
  const actionStatus = action => action.parentElement?.querySelector("[data-mero-action-status]");

  // htmx queues a click made during a request and sends it later, so the guard runs before its sync logic.
  // aria-disabled instead of disabled keeps focus on the button.
  // config:request precedes the sync queue, and a cancel there fires no finally:request.
  document.addEventListener("htmx:config:request", (event) => {
    if (actionOf(event)?.dataset.meroActionState === "pending") event.preventDefault();
  });

  // A swap can detach the button before finally:request, so the request remembers its button and status.
  const actionRequests = new WeakMap();

  document.addEventListener("htmx:before:request", (event) => {
    const action = actionOf(event);
    if (!action || event.defaultPrevented) return;
    const output = actionStatus(action);
    actionRequests.set(event.detail.ctx, { action, output });
    action.dataset.meroActionState = "pending";
    action.setAttribute("aria-busy", "true");
    action.setAttribute("aria-disabled", "true");
    if (output) { output.textContent = ""; delete output.dataset.tone; }
    action.dispatchEvent(new CustomEvent("mero:action", { bubbles: true, detail: { state: "pending" } }));
  });

  // htmx fires finally:request after load, error, abort and timeout alike.
  document.addEventListener("htmx:finally:request", (event) => {
    const { ctx } = event.detail;
    const request = actionRequests.get(ctx);
    if (!request) return;
    actionRequests.delete(ctx);
    const { action, output } = request;
    if (cancelled(ctx)) {
      // A later before:request listener cancelled it: nothing was sent.
      action.removeAttribute("aria-busy");
      action.removeAttribute("aria-disabled");
      delete action.dataset.meroActionState;
      return;
    }
    const status = ctx.response?.status ?? 0;
    const header = ctx.response?.headers.get("Mero-Action-Outcome") ?? null;
    const state = Object.hasOwn(actionMessages, header) ? header
      : status >= 200 && status < 300 ? "succeeded"
      : status >= 400 && status < 500 && status !== 408 ? "rejected" : "unknown";
    const [fallback, tone] = actionMessages[state];
    const message = ctx.response?.headers.get("Mero-Action-Message") || fallback;
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
  // data-mero-action-reread="#region": after an unknown outcome, read the current page again with a GET
  // and morph that region, so the person sees what actually happened. Mero never re-sends the action.
  // The answer is dropped when the page moved on, the region is gone or a newer read started.
  let rereads = 0;
  document.addEventListener("mero:action", event => {
    const { state, message } = event.detail;
    const owner = event.target.closest?.("[data-mero-action-reread]");
    if (state !== "unknown" || !owner || !window.htmx) return;
    const selector = owner.getAttribute("data-mero-action-reread");
    let region;
    try { region = document.querySelector(selector); } catch { return; }
    if (!region) return;
    const action = event.target;
    const id = ++rereads;
    const url = location.href;
    region.setAttribute("aria-busy", "true");
    window.htmx.ajax("GET", url, {
      target: region, select: selector, swap: "outerMorph",
      headers: { "Mero-Reread": String(id) },
    }).catch(() => {}).finally(() => {
      region.removeAttribute("aria-busy");
      if (id !== rereads) return;
      // The morph can reset the button and its status to the server's markup: show the outcome again.
      const element = action.isConnected ? action : action.id ? document.getElementById(action.id) : null;
      const button = element?.matches("[data-mero-action]");
      const output = button ? element.parentElement?.querySelector("[data-mero-action-status]") : element?.querySelector("[data-mero-form-error]");
      if (button) element.dataset.meroActionState = "unknown";
      if (output && message) {
        output.hidden = false;
        output.textContent = "";
        output.textContent = message;
        if (button) output.dataset.tone = "danger";
        return;
      }
      // Mero already announced it once; repeat it only when the read removed where it was shown.
      if (message && !element) window.MeroUI?.toast(message, { tone: "danger" });
    });
  });

  document.addEventListener("htmx:before:swap", event => {
    const { ctx, tasks } = event.detail;
    const id = ctx.request.headers?.["Mero-Reread"];
    if (!id) return;
    const target = typeof ctx.target === "string" ? document.querySelector(ctx.target) : ctx.target;
    const url = new URL(ctx.request.action, location.href);
    // Only a successful read of the page still on screen may replace what the person sees.
    if (Number(id) !== rereads || !target?.isConnected || url.href !== location.href.split("#")[0] || !(ctx.response?.status >= 200 && ctx.response.status < 300) ||
      // A page without the region would otherwise morph it away.
      !tasks.find(task => task.type === "main")?.fragment?.firstElementChild) {
      event.preventDefault();
    }
  });
})();
