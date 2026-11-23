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
  // One-time credentials. [data-mero-ephemeral] content is cleared when its dialog closes, on a
  // [data-mero-ephemeral-dismiss] click and when the page is hidden. data-mero-hold keeps the page
  // while a held request is pending, or while a held ephemeral element shows content: requests that
  // would replace the page or the held content are cancelled, Back is undone and unload asks first.
  const pendingHolds = new Map();
  let steady = { url: location.href, key: window.navigation?.currentEntry?.key };
  const remember = () => { steady = { url: location.href, key: window.navigation?.currentEntry?.key }; };
  const holdFallback = "Copy what is shown before you leave this page. It cannot be shown again.";
  const shown = node => node.isConnected && (node.childElementCount > 0 || node.textContent.trim() !== "");
  const heldEphemeral = () => [...document.querySelectorAll("[data-mero-ephemeral][data-mero-hold]")].filter(shown);

  function hold() {
    for (const [ctx, owner] of pendingHolds) {
      return { elements: [owner, ...heldEphemeral()], message: owner.getAttribute("data-mero-hold") || holdFallback, ctx };
    }
    const elements = heldEphemeral();
    return elements.length ? { elements, message: elements[0].getAttribute("data-mero-hold") || holdFallback } : null;
  }

  function warnHeld(message) {
    window.MeroUI?.toast(message, { tone: "warning" });
  }

  function clearEphemeral(root) {
    const nodes = root.matches?.("[data-mero-ephemeral]") ? [root] : [...root.querySelectorAll("[data-mero-ephemeral]")];
    for (const node of nodes) node.replaceChildren();
  }

  document.addEventListener("htmx:before:request", event => {
    const { ctx } = event.detail;
    if (event.defaultPrevented) return;
    const owner = ctx.sourceElement?.closest?.("form[data-mero-hold], [data-mero-action][data-mero-hold]");
    if (!owner) return;
    // The entry a held page returns to after Back, even if the app pushed it itself.
    if (!hold()) remember();
    pendingHolds.set(ctx, owner);
  });
  document.addEventListener("htmx:finally:request", event => {
    pendingHolds.delete(event.detail.ctx);
  });

  // config:request runs before htmx queues or sends anything, so a cancel here sends nothing.
  document.addEventListener("htmx:config:request", event => {
    const held = hold();
    const { ctx } = event.detail;
    if (!held || event.defaultPrevented) return;
    const source = ctx.sourceElement;
    // Controls inside the held content may act on it, for example to acknowledge it.
    if (held.elements.some(node => node !== source && node.contains?.(source) && node.matches("[data-mero-ephemeral]"))) return;
    const target = typeof ctx.target === "string" ? document.querySelector(ctx.target) : ctx.target;
    const replacesPage = ctx.request.headers["HX-Boosted"] || ctx.request.headers["HX-History-Restore-Request"] ||
      target === document.body || target === document.documentElement;
    if (replacesPage || (target && held.elements.some(node => target.contains(node)))) {
      event.preventDefault();
      warnHeld(held.message);
    }
  });

  // htmx restores history after the URL has changed, so a held page puts its own entry back.
  // Cancelling the navigate event instead would break htmx's own intercept() in WebKit.
  document.addEventListener("htmx:after:history:push", remember);
  document.addEventListener("htmx:after:history:replace", remember);
  window.navigation?.addEventListener("currententrychange", event => {
    if (event.navigationType !== "traverse") remember();
  });
  // popstate covers every same-document traversal, including entries htmx did not stamp.
  addEventListener("popstate", () => {
    const held = hold();
    if (!held) return remember();
    if (location.href === steady.url) return;
    warnHeld(held.message);
    const entry = steady.key && window.navigation?.entries().find(item => item.key === steady.key);
    // Let the interrupted traversal settle before going back to the held entry.
    setTimeout(() => entry ? window.navigation.traverseTo(entry.key) : history.pushState({ htmx: true }, "", steady.url));
  });
  document.addEventListener("htmx:before:history:restore", event => {
    if (hold()) event.preventDefault();
  });

  addEventListener("beforeunload", event => {
    if (!hold()) return;
    event.preventDefault();
    event.returnValue = "";
  });
  // A page left anyway, or kept in the back-forward cache, must not show the secret again.
  addEventListener("pagehide", () => clearEphemeral(document));

  document.addEventListener("close", event => {
    if (event.target instanceof HTMLDialogElement) clearEphemeral(event.target);
  }, true);

  document.addEventListener("click", event => {
    const dismiss = event.target.closest?.("[data-mero-ephemeral-dismiss]");
    const container = dismiss?.closest("[data-mero-ephemeral]");
    if (!container) return;
    const focused = container.contains(document.activeElement);
    clearEphemeral(container);
    if (!focused && document.activeElement !== document.body) return;
    const next = dismiss.getAttribute("data-mero-ephemeral-dismiss");
    const focus = next ? document.querySelector(next) : null;
    if (focus) {
      focus.focus({ preventScroll: true });
    } else {
      if (!container.hasAttribute("tabindex")) container.tabIndex = -1;
      container.focus({ preventScroll: true });
    }
  });
})();
