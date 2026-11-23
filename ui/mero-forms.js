/*! @rubenlangeweg/mero-ui 0.7.0 | MIT */
/**
 * Optional HTMX form behavior. Server responses:
 * 422 + replacement form for validation, or HX-Trigger:
 * {"mero:form-saved":{"message":"Saved"}}, which htmx 4 fires after the swap settles.
 * Standalone [data-mero-action] buttons, and the submitter of a data-mero-form,
 * get data-mero-action-state pending|succeeded|rejected|unknown: 2xx succeeded,
 * 4xx (not 408) rejected, anything else unknown, including a request aborted
 * after it was sent. Mero-Action-Outcome and Mero-Action-Message headers
 * override the state and text; a bubbling mero:action event reports each step.
 * data-mero-action-expect turns a success without the expected content into unknown.
 */
(() => {
  const formSelector = "form[data-mero-form]";
  const confirmSelector = "form[data-mero-form][data-mero-confirm]";
  const requesting = new WeakMap();
  const formRequests = new WeakMap();
  // A swap can detach the button before finally:request, so the request remembers its button and status.
  const actionRequests = new WeakMap();
  // htmx 4 also reports requests a before:request listener cancelled: no response, still "issuing".
  // Once fetch has started, an abort (hx-sync, htmx:abort, timeout) lands in htmx's catch as "error: AbortError…",
  // so a request that may have reached the server never counts as cancelled.
  const cancelled = ctx => !ctx.response && !String(ctx.status).startsWith("error");
  const outcomes = ["succeeded", "rejected", "unknown"];
  // A knob on the submitter wins over the same knob on its form.
  const knob = (owners, name) => owners.find(owner => owner?.hasAttribute(name))?.getAttribute(name) ?? null;

  // Outcome of a request that was sent. The client-side expect check can only lower success to unknown,
  // and then the server's success message is not shown.
  function serverOutcome(ctx) {
    const status = ctx.response?.status ?? 0;
    const header = ctx.response?.headers.get("Mero-Action-Outcome");
    return outcomes.includes(header) ? header
      : status >= 200 && status < 300 ? "succeeded"
      : status >= 400 && status < 500 && status !== 408 ? "rejected" : "unknown";
  }
  function outcomeOf(ctx, owners) {
    const state = serverOutcome(ctx);
    const expect = knob(owners, "data-mero-action-expect");
    if (state !== "succeeded" || !expect) return state;
    const template = document.createElement("template");
    template.innerHTML = ctx.text ?? "";
    try { return template.content.querySelector(expect) ? state : "unknown"; } catch { return "unknown"; }
  }

  // data-mero-action-unknown is either the text to show or "#id" of a hidden recovery panel to reveal.
  function unknownPanel(owners) {
    const value = knob(owners, "data-mero-action-unknown");
    return value?.startsWith("#") ? document.getElementById(value.slice(1)) : null;
  }
  function unknownText(owners) {
    const value = knob(owners, "data-mero-action-unknown");
    return value && !value.startsWith("#") ? value : null;
  }

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
    const { ctx } = event.detail;
    formRequests.set(ctx, form);
    const buttons = [...form.elements].filter(control => !control.disabled && (control.type === "submit" || control.type === "image"));
    const submitter = ctx.request.submitter?.form === form ? ctx.request.submitter : null;
    requesting.set(form, { buttons, ctx, owners: [submitter, form] });
    form.setAttribute("aria-busy", "true");
    buttons.forEach((button) => { button.disabled = true; });
    const error = form.querySelector("[data-mero-form-error]");
    if (error) error.hidden = true;
    const panel = unknownPanel([submitter, form]);
    if (panel) panel.hidden = true;
    (submitter ?? form).dataset.meroActionState = "pending";
    form.dispatchEvent(new CustomEvent("mero:action", { bubbles: true, detail: { state: "pending" } }));
  });

  // Decide before htmx applies HX-Trigger: a response that is not a confirmed
  // success must never close the dialog or announce "saved".
  document.addEventListener("htmx:after:request", (event) => {
    const { ctx } = event.detail;
    const form = formRequests.get(ctx);
    if (!form || !ctx.hx?.trigger) return;
    if (outcomeOf(ctx, requesting.get(form)?.owners ?? [form]) === "succeeded") return;
    try {
      const triggers = JSON.parse(ctx.hx.trigger);
      delete triggers["mero:form-saved"];
      ctx.hx.trigger = JSON.stringify(triggers);
    } catch {
      ctx.hx.trigger = ctx.hx.trigger.split(",").map(name => name.trim()).filter(name => name !== "mero:form-saved").join(", ");
    }
  });

  document.addEventListener("htmx:before:swap", (event) => {
    const { ctx } = event.detail;
    const form = formRequests.get(ctx);
    const owners = form ? requesting.get(form)?.owners : actionRequests.get(ctx) && [actionRequests.get(ctx).action];
    // A response that fails its expect check is not the page the server meant to send.
    if (owners && knob(owners, "data-mero-action-expect") && serverOutcome(ctx) === "succeeded" && outcomeOf(ctx, owners) === "unknown") {
      event.preventDefault();
      return;
    }
    const status = ctx.response?.status;
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
    const owners = requesting.get(form)?.owners ?? [form];
    const holder = owners.find(Boolean);
    form.removeAttribute("aria-busy");
    requesting.get(form)?.buttons.forEach((button) => { button.disabled = false; });
    requesting.delete(form);
    const typed = form.matches(confirmSelector);
    if (typed) checkConfirmation(form);
    if (cancelled(ctx)) {
      delete holder.dataset.meroActionState;
      return;
    }
    // After a 422 swap htmx points the source at the replacement form.
    const live = form.isConnected ? form : ctx.sourceElement?.matches?.(formSelector) && ctx.sourceElement.isConnected ? ctx.sourceElement : null;
    if (form.hasAttribute("data-mero-clear-passwords")) {
      for (const node of new Set([form, live])) {
        node?.querySelectorAll('input[type="password"]').forEach(input => { input.value = ""; });
      }
    }
    const state = outcomeOf(ctx, owners);
    const status = ctx.response?.status ?? 0;
    const headerMessage = state === serverOutcome(ctx) && ctx.response?.headers.get("Mero-Action-Message") || null;
    if (holder.isConnected) holder.dataset.meroActionState = state;
    const explicit = outcomes.includes(ctx.response?.headers.get("Mero-Action-Outcome"));
    let message = headerMessage;
    if (state === "succeeded") {
      if (message) window.MeroUI?.toast(message, { tone: "success", trigger: live ?? undefined });
    } else if (state === "rejected" && status === 422 && !explicit) {
      // The replacement form shows its own field errors.
    } else {
      if (state === "unknown") {
        message ||= unknownText(owners);
        const panel = unknownPanel(owners);
        if (panel) panel.hidden = false;
      }
      message ||= ctx.response?.headers.get("Mero-Form-Error") || null;
      if (!message) {
        const signal = ctx.request.signal;
        message = typed
          ? (state === "unknown" ? "Outcome unknown. Check the current state before retrying." : "The server rejected this action.")
          : !ctx.response && (signal?.reason === "timeout" || !signal?.aborted)
            ? "The server could not be reached. Check whether the change was saved before retrying."
            : "The request could not be completed. Check the current state and try again.";
      }
      if (live) showError(live, message);
    }
    (live ?? document).dispatchEvent(new CustomEvent("mero:action", { bubbles: true, detail: { state, status, message } }));
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


  document.addEventListener("htmx:before:request", (event) => {
    const action = actionOf(event);
    if (!action || event.defaultPrevented) return;
    const output = actionStatus(action);
    actionRequests.set(event.detail.ctx, { action, output });
    action.dataset.meroActionState = "pending";
    action.setAttribute("aria-busy", "true");
    action.setAttribute("aria-disabled", "true");
    if (output) { output.textContent = ""; delete output.dataset.tone; }
    const panel = unknownPanel([action]);
    if (panel) panel.hidden = true;
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
    const state = outcomeOf(ctx, [action]);
    const [fallback, tone] = actionMessages[state];
    const headerMessage = state === serverOutcome(ctx) && ctx.response?.headers.get("Mero-Action-Message");
    const message = headerMessage || (state === "unknown" && unknownText([action])) || fallback;
    if (state === "unknown") {
      const panel = unknownPanel([action]);
      if (panel) panel.hidden = false;
    }
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
