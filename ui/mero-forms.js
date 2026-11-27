/*! @rubenlangeweg/mero-ui 1.0.0 | MIT */
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
  const lifecycle = (globalThis[Symbol.for("mero.lifecycle")] ??= { init: new Set(), cleanup: new Set(), defaults: {}, config: { locale: null, dialogBackdrop: "mero-only", messages: {} } });
  const config = (lifecycle.config ??= { locale: null, dialogBackdrop: "mero-only", messages: {} });
  const defaults = (lifecycle.defaults ??= {});
  const defaultMessages = {
    confirmTypePhrase: "Type the phrase exactly to enable confirmation.",
    confirmEnterReason: "Phrase matches. Enter a reason to enable confirmation.",
    confirmReady: "Ready to confirm.",
    confirmUnknown: "Outcome unknown. Check the current state before retrying.",
    confirmRejected: "The server rejected this action.",
    formUnreachable: "The server could not be reached. Check whether the change was saved before retrying.",
    formFailed: "The request could not be completed. Check the current state and try again.",
    actionSucceeded: "Done.",
    actionRejected: "The server refused this action. Nothing changed.",
    actionUnknown: "The result is unknown. Check the current state before you try again.",
    searchError: "Couldn't update the results. The list still shows the previous results.",
    holdWarning: "Copy what is shown before you leave this page. It cannot be shown again.",
    dirtyLeaveWarning: "You have unsaved changes. Leave without saving?",
  };
  Object.assign(defaults, defaultMessages);
  const msg = key => config.messages[key] ?? defaultMessages[key] ?? "";
  const formSelector = "form[data-mero-form]";
  const confirmSelector = "form[data-mero-form][data-mero-confirm]";
  const requesting = new WeakMap();
  const lockedControls = new WeakSet();
  const isLocked = el => {
    for (let node = el; node; node = node.parentElement) if (lockedControls.has(node)) return true;
    return false;
  };
  document.addEventListener("click", event => {
    const label = event.target.closest?.("label");
    if (label?.control && isLocked(label.control) && !event.target.closest?.("a[href], button")) {
      event.preventDefault();
    }
  }, true);
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
    const message = !matches ? msg("confirmTypePhrase")
      : !ready ? msg("confirmEnterReason") : msg("confirmReady");
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
  function clearFormError(form) {
    for (const error of form.querySelectorAll("[data-mero-form-error]")) {
      error.textContent = "";
      error.hidden = true;
    }
  }
  function clearDialogForms(dialog) {
    if (!(dialog instanceof Element)) return;
    for (const form of dialog.querySelectorAll(formSelector)) clearFormError(form);
    for (const form of dialog.querySelectorAll(confirmSelector)) {
      const input = form.querySelector("[data-mero-confirm-input]");
      if (input) input.value = "";
      checkConfirmation(form);
    }
  }

  document.addEventListener("reset", event => {
    const form = event.target;
    if (!(form instanceof HTMLFormElement)) return;
    // Wait for a task so bubbling window reset listeners can cancel before cleanup runs.
    setTimeout(() => {
      if (event.defaultPrevented || !form.isConnected) return;
      if (form.matches(formSelector)) clearFormError(form);
      if (form.matches(confirmSelector)) checkConfirmation(form);
    });
  });
  document.addEventListener("mero:dialog", event => {
    if (event.detail?.open === false) clearDialogForms(event.detail.dialog);
  });
  document.addEventListener("close", event => {
    if (!event.target.matches?.("dialog") || event.target.open) return;
    clearDialogForms(event.target);
  }, true);

  // Guard implicit and scripted submissions too, before htmx can queue a duplicate.
  document.addEventListener("htmx:config:request", event => {
    const form = requestForm(event);
    if (form?.matches(confirmSelector) && (!checkConfirmation(form) || requesting.has(form))) event.preventDefault();
  });

  const lockedWidgets = "[data-mero-combo], [data-mero-multiselect], [data-mero-listbox], [data-mero-ws-number], [data-mero-ws-emoji], [data-mero-ws-editor] [data-format], [contenteditable]:not([contenteditable='false'])";

  document.addEventListener("htmx:before:request", (event) => {
    const form = requestForm(event);
    if (!form) return;
    if (requesting.has(form)) {
      event.preventDefault();
      return;
    }
    const { ctx } = event.detail;
    formRequests.set(ctx, form);
    if (form.matches("[data-mero-dirty]")) submittedSnapshots.set(form, snapshotForm(form));
    const buttons = [...form.elements].filter(control => !control.disabled && (control.type === "submit" || control.type === "image"));
    const keepEditable = (form.getAttribute("data-mero-form") || "").split(/\s+/).includes("keep-editable");
    const widgetNodes = keepEditable ? [] : [...form.querySelectorAll(lockedWidgets)].filter(node => {
      const outer = node.parentElement?.closest?.(lockedWidgets);
      return !node.closest?.("[inert]") && (!outer || outer === form || !form.contains(outer));
    });
    const inertNodes = keepEditable ? [] : [
      ...[...form.elements].filter(control => !control.closest?.("[inert]") && !widgetNodes.some(node => node.contains(control)) &&
        control.matches("input, select, textarea, [type=reset]") && !control.matches("[type=submit], [type=button], [type=image], [type=hidden]")),
      ...widgetNodes,
    ];
    const activeEl = document.activeElement;
    const displacedFocus = activeEl && inertNodes.some(node => node === activeEl || node.contains(activeEl)) ? activeEl : null;
    const submitter = ctx.request.submitter?.form === form ? ctx.request.submitter : null;
    requesting.set(form, { buttons, inertNodes, displacedFocus, ctx, owners: [submitter, form] });
    form.setAttribute("aria-busy", "true");
    buttons.forEach((button) => { button.disabled = true; });
    inertNodes.forEach((node) => { node.inert = true; lockedControls.add(node); });
    clearFormError(form);
    const panel = unknownPanel([submitter, form]);
    if (panel) panel.hidden = true;
    (submitter ?? form).dataset.meroActionState = "pending";
    form.dispatchEvent(new CustomEvent("mero:action", { bubbles: true, detail: { state: "pending", source: form, id: form.id || null } }));
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
    // htmx 4 swaps every error response. Only 422, and 409 when opted in, carry a replacement form.
    if (status !== 422 && !(status === 409 && form?.hasAttribute("data-mero-conflict-swap"))) event.preventDefault();
  });

  // after:swap, not after:settle: htmx 4 applies [autofocus] in the new form after settling.
  // It fires on the source, which htmx points at the new form when the swap replaced it.
  document.addEventListener("htmx:after:swap", (event) => {
    const status = event.detail.ctx.response?.status;
    const form = event.target.closest?.(formSelector);
    if (status !== 422 && !(status === 409 && form?.hasAttribute("data-mero-conflict-swap"))) return;
    const field = (status === 409 && form?.querySelector("[data-mero-conflict-focus]")) || form?.querySelector('[aria-invalid="true"]');
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
    const active = requesting.get(form);
    const owners = active?.owners ?? [form];
    const holder = owners.find(Boolean);
    form.removeAttribute("aria-busy");
    active?.buttons.forEach((button) => { button.disabled = false; });
    active?.inertNodes.forEach((node) => { node.inert = false; lockedControls.delete(node); });
    requesting.delete(form);
    const focusAfter = document.activeElement;
    if (form.isConnected && active?.displacedFocus?.isConnected && (!focusAfter || focusAfter === document.body || focusAfter === form.closest("dialog"))) {
      active.displacedFocus.focus({ preventScroll: true });
    }
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
        node?.querySelectorAll('input[type="password"]').forEach(input => {
          input.value = "";
          input.defaultValue = "";
        });
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
    } else if (state === "rejected" && (status === 422 || (status === 409 && form.hasAttribute("data-mero-conflict-swap"))) && !explicit) {
      // The replacement form shows its own field or conflict details.
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
          ? msg(state === "unknown" ? "confirmUnknown" : "confirmRejected")
          : !ctx.response && (signal?.reason === "timeout" || !signal?.aborted)
            ? msg("formUnreachable")
            : msg("formFailed");
      }
      if (live) showError(live, message);
    }
    (live ?? document).dispatchEvent(new CustomEvent("mero:action", { bubbles: true, detail: { state, status, message, source: form, id: form.id || null } }));
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
    if (form.isConnected && form.matches("[data-mero-dirty]")) {
      if (form.getAttribute("data-mero-dirty") === "dirty") form.setAttribute("data-mero-dirty", "");
      const submitted = submittedSnapshots.get(form) ?? snapshotForm(form);
      submittedSnapshots.delete(form);
      formBaselines.set(form, submitted);
      syncSavedDefaults(form, submitted);
      updateForm(form);
    }
    focus?.focus({ preventScroll: true });
    if (event.detail.message) window.MeroUI.toast(event.detail.message, { tone: "success" });
  });

  const actionOf = event => event.target.closest?.("[data-mero-action]");
  const actionTones = {
    succeeded: ["actionSucceeded", "success"],
    rejected: ["actionRejected", "warning"],
    unknown: ["actionUnknown", "danger"],
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
    action.dispatchEvent(new CustomEvent("mero:action", { bubbles: true, detail: { state: "pending", source: action, id: action.id || null } }));
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
    const [fallbackKey, tone] = actionTones[state];
    const headerMessage = state === serverOutcome(ctx) && ctx.response?.headers.get("Mero-Action-Message");
    const message = headerMessage || (state === "unknown" && unknownText([action])) || msg(fallbackKey);
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
    (action.isConnected ? action : document).dispatchEvent(new CustomEvent("mero:action", { bubbles: true, detail: { state, status, message, source: action, id: action.id || null } }));
  });
  // Form state helpers. [data-mero-show-when="field=value other"] shows a branch only while the form's
  // field has one of the values, and disables its controls while hidden so they neither validate nor submit.
  // form[data-mero-dirty] keeps its submit buttons disabled until a control differs from the acknowledged baseline.
  const disabledByBranch = new WeakSet();
  const dirtyStates = new WeakMap();
  const formBaselines = new WeakMap();
  const submittedSnapshots = new WeakMap();
  const submittingNative = new WeakSet();
  const multiSnapshot = multi => [...multi.querySelectorAll('[data-mero-multiselect-chips] input[type="hidden"]')].map(i => i.value).join("\0");
  const selectSnapshot = select => [...select.selectedOptions].map(option => option.value).join("\0");
  const isTrackableField = control => control.matches("input, select, textarea") && !control.matches("[type=submit], [type=button], [type=reset], [type=image]");

  function syncSavedDefaults(form, snapshot) {
    const clearPwd = form.hasAttribute("data-mero-clear-passwords");
    for (const [control, saved] of snapshot.fields) {
      if (!form.contains(control)) continue;
      if (clearPwd && control.matches("input[type=password]")) continue;
      if (control.matches("input[type=checkbox], input[type=radio]")) {
        control.defaultChecked = Boolean(saved);
      } else if (control.matches("select")) {
        const remaining = saved === "" ? [] : String(saved).split("\0");
        for (const option of control.options) {
          const idx = remaining.indexOf(option.value);
          option.defaultSelected = idx !== -1;
          if (idx !== -1) remaining.splice(idx, 1);
        }
      } else if (control.matches("input, textarea")) {
        // Hidden inputs share value and defaultValue; skip if a mid-flight edit changed value.
        if (control.type === "hidden" && control.value !== String(saved)) continue;
        control.defaultValue = String(saved);
      }
    }
    for (const [multi, chips] of snapshot.multiChips ?? []) {
      if (form.contains(multi)) lifecycle.setMultiBaseline?.(multi, chips);
    }
  }

  function snapshotForm(form) {
    const clearPwd = form.hasAttribute("data-mero-clear-passwords");
    const fields = new Map();
    for (const control of form.elements) {
      if (control.closest?.("[data-mero-multiselect]") || !isTrackableField(control)) continue;
      if (clearPwd && control.matches("input[type=password]")) continue;
      if (control.matches("input[type=checkbox], input[type=radio]")) fields.set(control, control.checked);
      else if (control.matches("select")) fields.set(control, selectSnapshot(control));
      else fields.set(control, control.value);
    }
    const multis = new Map();
    const multiChips = new Map();
    for (const multi of form.querySelectorAll("[data-mero-multiselect]")) {
      multis.set(multi, multiSnapshot(multi));
      const chips = lifecycle.captureMultiChips?.(multi);
      if (chips) multiChips.set(multi, chips);
    }
    return { fields, multis, multiChips };
  }

  function indexFormControls(form, names) {
    const byName = new Map();
    for (const control of form.elements) {
      if (!names.has(control.name)) continue;
      let list = byName.get(control.name);
      if (!list) byName.set(control.name, list = []);
      list.push(control);
    }
    return byName;
  }

  function valuesFor(controls) {
    const values = [];
    for (const control of controls ?? []) {
      if (control.disabled || control.matches(":disabled")) continue;
      if (control.type === "checkbox" || control.type === "radio") { if (control.checked) values.push(control.value); }
      else if (control.tagName === "SELECT") { for (const option of control.selectedOptions) values.push(option.value); }
      else values.push(control.value);
    }
    return values;
  }

  function changed(form) {
    if (form.getAttribute("data-mero-dirty") === "dirty") return true;
    let baseline = formBaselines.get(form);
    if (!baseline) {
      baseline = snapshotForm(form);
      formBaselines.set(form, baseline);
    }
    for (const multi of form.querySelectorAll("[data-mero-multiselect]")) {
      if (!baseline.multis.has(multi)) baseline.multis.set(multi, multiSnapshot(multi));
      if (multiSnapshot(multi) !== baseline.multis.get(multi)) return true;
    }
    const clearPwd = form.hasAttribute("data-mero-clear-passwords");
    return [...form.elements].some(control => {
      if (control.closest?.("[data-mero-multiselect]") || !isTrackableField(control)) return false;
      if (clearPwd && control.matches("input[type=password]")) return control.value !== "";
      if (baseline.fields.has(control)) {
        if (control.matches("input[type=checkbox], input[type=radio]")) return control.checked !== baseline.fields.get(control);
        if (control.matches("select")) return selectSnapshot(control) !== baseline.fields.get(control);
        return control.value !== baseline.fields.get(control);
      }
      if (control.matches("input[type=checkbox], input[type=radio]")) return control.checked !== control.defaultChecked;
      if (control.matches("select")) return [...control.options].some(option => option.selected !== option.defaultSelected);
      return control.value !== control.defaultValue;
    });
  }

  function updateShowWhen(form, changedName = null) {
    const branches = form.querySelectorAll("[data-mero-show-when]");
    if (!branches.length) return;
    const names = new Set();
    const specs = [...branches].map(branch => {
      const expr = branch.getAttribute("data-mero-show-when") || "";
      const negated = expr.includes("!=");
      const [raw, wanted = ""] = expr.split(negated ? "!=" : "=");
      const name = raw.trim();
      const trimmed = wanted.trim();
      names.add(name);
      return [branch, name, negated, trimmed === "" ? [""] : trimmed.split(/\s+/)];
    });
    if (changedName !== null && !names.has(changedName)) return;
    const byName = indexFormControls(form, names);
    const cache = new Map();
    // Outer branches first, so a nested branch reads the state its parent left.
    for (const [branch, name, negated, targets] of specs) {
      let values = cache.get(name);
      if (!values) cache.set(name, values = valuesFor(byName.get(name)));
      const matched = targets.some(value => values.includes(value));
      const show = (negated ? !matched : matched) && !branch.parentElement.closest("[data-mero-show-when][hidden]");
      branch.hidden = !show;
      if (branch.hasAttribute("data-mero-show-when-keep-enabled")) continue;
      if (branch.tagName === "FIELDSET") {
        if (branch.disabled !== !show) {
          branch.disabled = !show;
          for (const control of branch.elements) if (names.has(control.name)) cache.delete(control.name);
        }
      } else {
        for (const control of branch.querySelectorAll("input, select, textarea, button")) {
          if (!show && !control.disabled) { control.disabled = true; disabledByBranch.add(control); if (names.has(control.name)) cache.delete(control.name); }
          else if (show && disabledByBranch.delete(control)) { control.disabled = false; if (names.has(control.name)) cache.delete(control.name); }
        }
      }
    }
  }

  function updateForm(form, changedName = null) {
    updateShowWhen(form, changedName);
    if (form.matches("[data-mero-dirty]")) {
      const dirty = changed(form);
      if (!requesting.has(form)) {
        for (const button of form.querySelectorAll("button:not([type]), [type=submit], [type=image]")) {
          if (!button.closest("[data-mero-show-when][hidden]")) button.disabled = !dirty;
        }
      }
      const previous = dirtyStates.get(form);
      dirtyStates.set(form, dirty);
      if (previous !== undefined && previous !== dirty) {
        form.dispatchEvent(new CustomEvent("mero:dirty", { bubbles: true, detail: { dirty, form } }));
      }
    }
  }

  function dirtyGuardedForms() {
    return [...document.querySelectorAll("form[data-mero-dirty][data-mero-dirty-guard]")]
      .filter(form => form.isConnected && !requesting.has(form) && !submittingNative.has(form) && changed(form));
  }
  const dirtyGuarded = () => dirtyGuardedForms()[0] ?? null;

  let dirtyHistoryDecision = null;
  function setDirtyHistoryDecision(value) {
    dirtyHistoryDecision = value;
    setTimeout(() => { if (dirtyHistoryDecision === value) dirtyHistoryDecision = null; }, 50);
  }
  function confirmLeaveDirty(guarded) {
    return window.confirm(guarded.getAttribute("data-mero-dirty-guard") || msg("dirtyLeaveWarning"));
  }

  document.addEventListener("submit", event => {
    if (event.defaultPrevented || !(event.target instanceof HTMLFormElement)) return;
    const target = (event.submitter?.getAttribute("formtarget") || event.target.getAttribute("target") || "").trim().toLowerCase();
    // Only exempt submissions that navigate this document (not iframe or _blank targets).
    if (target && target !== "_self" && target !== "_top" && target !== "_parent") return;
    submittingNative.add(event.target);
    setTimeout(() => submittingNative.delete(event.target), 2000);
  });
  addEventListener("pageshow", () => {
    for (const form of document.querySelectorAll("form[data-mero-dirty-guard]")) submittingNative.delete(form);
  });

  document.addEventListener("htmx:config:request", event => {
    const { ctx } = event.detail;
    if (event.defaultPrevented || ctx.request.method.toUpperCase() !== "GET") return;
    const candidates = dirtyGuardedForms();
    if (!candidates.length) return;
    const target = typeof ctx.target === "string" ? document.querySelector(ctx.target) : ctx.target;
    const isHistory = Boolean(ctx.request.headers["HX-History-Restore-Request"]);
    const fullLeave = Boolean(ctx.request.headers["HX-Boosted"] || isHistory || target === document.body || target === document.documentElement);
    const guarded = fullLeave ? candidates[0] : candidates.find(form => target?.contains(form));
    if (!guarded) return;
    if (isHistory && dirtyHistoryDecision === "allow") return;
    if (isHistory && dirtyHistoryDecision === "block") { event.preventDefault(); return; }
    if (!confirmLeaveDirty(guarded)) {
      event.preventDefault();
      if (isHistory) {
        setDirtyHistoryDecision("block");
        if (location.href !== steady.url) restoreSteady();
      }
    } else if (isHistory) {
      setDirtyHistoryDecision("allow");
    }
  });
  addEventListener("beforeunload", event => {
    if (!dirtyGuarded()) return;
    event.preventDefault();
    event.returnValue = "";
  });

  const stateForms = root => {
    const found = new Set();
    const ancestor = root instanceof Element ? root.closest("form") : null;
    if (ancestor) found.add(ancestor);
    if (root.matches?.("form")) found.add(root);
    for (const form of root.querySelectorAll?.("form") ?? []) found.add(form);
    return [...found].filter(form => form.matches("[data-mero-dirty]") || form.querySelector("[data-mero-show-when]"));
  };
  function initForms(root = document) {
    if (!(root instanceof Element || root instanceof Document)) return;
    stateForms(root).forEach(form => updateForm(form));
    const confirms = new Set();
    const ancestor = root instanceof Element ? root.closest(confirmSelector) : null;
    if (ancestor) confirms.add(ancestor);
    if (root.matches?.(confirmSelector)) confirms.add(root);
    for (const form of root.querySelectorAll?.(confirmSelector) ?? []) confirms.add(form);
    confirms.forEach(checkConfirmation);
  }
  lifecycle.init.add(initForms);
  for (const type of ["input", "change"]) document.addEventListener(type, event => {
    const form = event.target.form ?? event.target.closest?.("form");
    if (!form || !(form.matches("[data-mero-dirty]") || form.querySelector("[data-mero-show-when]"))) return;
    const multi = event.target.closest?.("[data-mero-multiselect]");
    const changedName = multi
      ? (multi.getAttribute("data-mero-multiselect-name") || null)
      : (typeof event.target.name === "string" && event.target.name !== "" ? event.target.name : null);
    updateForm(form, changedName);
  });
  document.addEventListener("reset", event => {
    if (stateForms(event.target).length) setTimeout(() => updateForm(event.target));
  });
  // Swapped-in forms, and forms released after a request, which re-enables their submit buttons.
  document.addEventListener("htmx:after:settle", event => initForms(event.target));
  document.addEventListener("htmx:finally:request", event => {
    const form = event.detail.ctx.sourceElement?.closest?.("form");
    if (form && stateForms(form).length) queueMicrotask(() => updateForm(form));
  });
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", () => initForms(document), { once: true });
  else initForms(document);
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
    const id = ctx.request?.headers?.["Mero-Reread"];
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

  // form[data-mero-search]: a search or filter form that GETs results into a list. A failed read never
  // replaces the list: Mero skips the swap of a non-2xx response or one without the hx-select region,
  // explains it in [data-mero-search-error], and once nothing is pending puts selects, checkboxes and
  // radios back to the values of the list on screen. A redirect to a page without the region loads fully.
  const searchSelector = "form[data-mero-search]";
  const searchPending = new WeakMap();
  const searchRequests = new WeakMap();
  const searchFailed = new WeakSet();
  const searchFollowed = new WeakSet();
  const searchOf = ctx => {
    const source = ctx.sourceElement;
    return source?.matches?.(searchSelector) ? source : source?.form?.matches(searchSelector) ? source.form : null;
  };
  const choices = form => [...form.elements].filter(control => control.matches("select, input[type=checkbox], input[type=radio]"));

  document.addEventListener("htmx:before:request", event => {
    const form = searchOf(event.detail.ctx);
    if (!form || event.defaultPrevented) return;
    if (!searchPending.has(form)) searchPending.set(form, new Set());
    searchPending.get(form).add(event.detail.ctx);
    searchRequests.set(event.detail.ctx, form);
  });

  document.addEventListener("htmx:before:swap", event => {
    const { ctx, tasks } = event.detail;
    if (!searchRequests.has(ctx) || event.defaultPrevented) return;
    const status = ctx.response?.status;
    const main = tasks.find(task => task.type === "main");
    const missing = Boolean(ctx.select) && !main?.fragment?.firstElementChild;
    if (status >= 200 && status < 300 && !missing) return;
    event.preventDefault();
    if (missing && ctx.response.raw.redirected) {
      // Typically an expired session answered with a login page.
      searchFollowed.add(ctx);
      location.assign(ctx.response.raw.url);
      return;
    }
    searchFailed.add(ctx);
  });

  document.addEventListener("htmx:finally:request", event => {
    const { ctx } = event.detail;
    const form = searchRequests.get(ctx);
    if (!form) return;
    const pending = searchPending.get(form);
    pending.delete(ctx);
    if (searchFollowed.has(ctx) || cancelled(ctx)) return;
    const signal = ctx.request.signal;
    // A newer search replaced this one (hx-sync): that request decides what the list shows.
    const superseded = !ctx.response && signal?.aborted && signal.reason !== "timeout";
    const failed = searchFailed.has(ctx) || (!ctx.response && !superseded);
    const error = form.querySelector("[data-mero-search-error]");
    if (!failed && !superseded) {
      // The list now matches these controls: remember them as the values to return to.
      for (const control of choices(form)) {
        if (control.matches("select")) for (const option of control.options) option.defaultSelected = option.selected;
        else control.defaultChecked = control.checked;
      }
      if (error) { error.textContent = ""; error.hidden = true; }
      return;
    }
    if (failed && error) {
      error.textContent = "";
      error.textContent = error.getAttribute("data-mero-search-error") || ctx.response?.headers.get("Mero-Form-Error") ||
        msg("searchError");
      error.hidden = false;
    }
    if (pending.size) return;
    for (const control of choices(form)) {
      if (control.matches("select")) {
        const fallback = [...control.options].find(option => option.defaultSelected) ?? control.options[0];
        if (fallback) fallback.selected = true;
      } else control.checked = control.defaultChecked;
    }
  });

  // One-time credentials. [data-mero-ephemeral] content is cleared when its dialog closes, on a
  // [data-mero-ephemeral-dismiss] click and when the page is hidden. data-mero-hold keeps the page
  // while a held request is pending, or while a held ephemeral element shows content: requests that
  // would replace the page or the held content are cancelled, Back is undone and unload asks first.
  const pendingHolds = new Map();
  let steady = { url: location.href, key: window.navigation?.currentEntry?.key };
  const remember = () => { steady = { url: location.href, key: window.navigation?.currentEntry?.key }; };
  const holdFallback = () => msg("holdWarning");
  const shown = node => node.isConnected && (node.childElementCount > 0 || node.textContent.trim() !== "");
  const heldEphemeral = () => [...document.querySelectorAll("[data-mero-ephemeral][data-mero-hold]")].filter(shown);

  function hold() {
    for (const [ctx, owner] of pendingHolds) {
      return { elements: [owner, ...heldEphemeral()], message: owner.getAttribute("data-mero-hold") || holdFallback(), ctx };
    }
    const elements = heldEphemeral();
    return elements.length ? { elements, message: elements[0].getAttribute("data-mero-hold") || holdFallback() } : null;
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
  function restoreSteady() {
    const entry = steady.key && window.navigation?.entries().find(item => item.key === steady.key);
    // Let the interrupted traversal settle before going back to the held/guarded entry.
    setTimeout(() => entry ? window.navigation.traverseTo(entry.key) : history.pushState({ htmx: true }, "", steady.url));
  }
  // popstate covers every same-document traversal, including entries htmx did not stamp.
  addEventListener("popstate", () => {
    const held = hold();
    if (held) {
      if (location.href === steady.url) return;
      warnHeld(held.message);
      restoreSteady();
      return;
    }
    const guarded = dirtyGuarded();
    if (!guarded || location.href === steady.url) {
      if (location.href === steady.url) dirtyHistoryDecision = null;
      return remember();
    }
    if (dirtyHistoryDecision === "allow") return remember();
    if (dirtyHistoryDecision === "block") return restoreSteady();
    if (confirmLeaveDirty(guarded)) {
      setDirtyHistoryDecision("allow");
      remember();
    } else {
      setDirtyHistoryDecision("block");
      restoreSteady();
    }
  });
  document.addEventListener("htmx:before:history:restore", event => {
    if (hold()) { event.preventDefault(); return; }
    const guarded = dirtyGuarded();
    if (!guarded) return;
    if (dirtyHistoryDecision === "allow") return;
    if (dirtyHistoryDecision === "block") { event.preventDefault(); return; }
    if (confirmLeaveDirty(guarded)) {
      setDirtyHistoryDecision("allow");
    } else {
      setDirtyHistoryDecision("block");
      event.preventDefault();
      if (location.href !== steady.url) restoreSteady();
    }
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
