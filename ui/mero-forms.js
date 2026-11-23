/*! @rubenlangeweg/mero-ui 0.8.0 | MIT */
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
  // Form state helpers. [data-mero-show-when="field=value other"] shows a branch only while the form's
  // field has one of the values, and disables its controls while hidden so they neither validate nor submit.
  // form[data-mero-dirty] keeps its submit buttons disabled until a control differs from the rendered value.
  const disabledByBranch = new WeakSet();
  function fieldValues(form, name) {
    const values = [];
    for (const control of form.elements) {
      if (control.name !== name || control.disabled) continue;
      if (control.matches("input[type=checkbox], input[type=radio]")) { if (control.checked) values.push(control.value); }
      else if (control.matches("select")) values.push(...[...control.selectedOptions].map(option => option.value));
      else values.push(control.value);
    }
    return values;
  }
  function changed(form) {
    return [...form.elements].some(control => {
      if (control.matches("input[type=checkbox], input[type=radio]")) return control.checked !== control.defaultChecked;
      if (control.matches("select")) return [...control.options].some(option => option.selected !== option.defaultSelected);
      return control.matches("input, textarea") && !control.matches("[type=submit], [type=button], [type=reset], [type=image]") && control.value !== control.defaultValue;
    });
  }
  function updateForm(form) {
    // Outer branches first, so a nested branch reads the state its parent left.
    for (const branch of form.querySelectorAll("[data-mero-show-when]")) {
      const [name, wanted = ""] = branch.getAttribute("data-mero-show-when").split("=");
      const values = fieldValues(form, name.trim());
      const show = wanted.trim().split(/\s+/).some(value => values.includes(value)) && !branch.parentElement.closest("[data-mero-show-when][hidden]");
      branch.hidden = !show;
      if (branch.matches("fieldset")) branch.disabled = !show;
      else for (const control of branch.querySelectorAll("input, select, textarea, button")) {
        if (!show && !control.disabled) { control.disabled = true; disabledByBranch.add(control); }
        else if (show && disabledByBranch.delete(control)) control.disabled = false;
      }
    }
    if (form.matches("[data-mero-dirty]") && !requesting.has(form)) {
      const clean = !changed(form);
      for (const button of form.querySelectorAll("button:not([type]), [type=submit], [type=image]")) {
        if (!button.closest("[data-mero-show-when][hidden]")) button.disabled = clean;
      }
    }
  }
  const stateForms = root => [...(root.matches?.("form") ? [root] : []), ...(root.querySelectorAll?.("form") ?? [])]
    .filter(form => form.matches("[data-mero-dirty]") || form.querySelector("[data-mero-show-when]"));
  for (const type of ["input", "change"]) document.addEventListener(type, event => {
    const form = event.target.form ?? event.target.closest?.("form");
    if (form && stateForms(form).length) updateForm(form);
  });
  document.addEventListener("reset", event => {
    if (stateForms(event.target).length) setTimeout(() => updateForm(event.target));
  });
  // Swapped-in forms, and forms released after a request, which re-enables their submit buttons.
  document.addEventListener("htmx:after:settle", event => stateForms(event.target).forEach(updateForm));
  document.addEventListener("htmx:finally:request", event => {
    const form = event.detail.ctx.sourceElement?.closest?.("form");
    if (form && stateForms(form).length) queueMicrotask(() => updateForm(form));
  });
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", () => stateForms(document).forEach(updateForm), { once: true });
  else stateForms(document).forEach(updateForm);
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
        "Couldn't update the results. The list still shows the previous results.";
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
