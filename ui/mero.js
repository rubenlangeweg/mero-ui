(() => {
  "use strict";

  const dialogOpeners = new WeakMap();
  const dialogFocus = new WeakMap();
  const autoOpened = new WeakSet();
  const requestOpeners = new WeakMap();
  const swappedFocus = new WeakMap();
  const remoteQueries = new WeakMap();
  const currentQueries = new WeakMap();
  const displayedQueries = new WeakMap();
  const accordionNames = new WeakMap();
  const scopeAliases = new WeakMap();
  const visibleTooltips = new Set();
  let instanceId = 0;
  const pointerStarts = new WeakMap();
  const focusable = 'button:not(:disabled), input:not(:disabled):not([type="hidden"]), select:not(:disabled), textarea:not(:disabled), a[href], [tabindex="0"]';
  const tabSelector = '[role="tab"]';
  const optionSelector = '[role="option"]';

  function element(ref) {
    return typeof ref === "string" ? document.getElementById(ref.replace(/^#/, "")) : ref;
  }

  function open(ref, { trigger = document.activeElement } = {}) {
    const dialog = element(ref);
    if (!(dialog instanceof HTMLDialogElement) || dialog.open || !dialog.isConnected) return;
    dialogOpeners.set(dialog, trigger);
    dialog.showModal();
  }

  function close(ref, { focus, value } = {}) {
    const dialog = element(ref);
    if (!(dialog instanceof HTMLDialogElement) || !dialog.open) return;
    if (focus) dialogFocus.set(dialog, focus);
    dialog.close(value);
  }

  function returnFocus(dialog) {
    const focus = element(dialogFocus.get(dialog) ?? dialogOpeners.get(dialog));
    dialogFocus.delete(dialog);
    dialogOpeners.delete(dialog);
    if (!focus?.isConnected || focus.matches(":disabled") || dialog.contains(focus)) return;
    // Native dialog restoration also runs on close. Refocus after it completes.
    requestAnimationFrame(() => {
      if (focus.isConnected && !dialog.open) focus.focus({ preventScroll: true });
    });
  }

  function outsideDialog(event, dialog) {
    const { left, right, top, bottom } = dialog.getBoundingClientRect();
    return event.clientX < left || event.clientX > right || event.clientY < top || event.clientY > bottom;
  }

  function placeTooltip(tooltip) {
    const bubble = tooltip.querySelector(".mero-tooltip-content");
    if (!bubble) return;
    const anchor = tooltip.getBoundingClientRect();
    const { width, height } = bubble.getBoundingClientRect();
    if (!width) { visibleTooltips.delete(tooltip); return; }
    const left = anchor.left + (anchor.width - width) / 2;
    const clamped = Math.max(8, Math.min(left, document.documentElement.clientWidth - width - 8));
    bubble.style.setProperty("--mero-tooltip-shift", (clamped - left) + "px");
    tooltip.toggleAttribute("data-mero-tooltip-below", anchor.top < height + 8 && innerHeight - anchor.bottom >= height + 8);
    visibleTooltips.add(tooltip);
  }

  function repositionTooltips() {
    for (const tooltip of visibleTooltips) placeTooltip(tooltip);
  }

  function matching(root, selector, includeContainer = false) {
    const descendants = [...root.querySelectorAll(selector)];
    if (root instanceof Element) {
      const match = includeContainer ? root.closest(selector) : (root.matches(selector) ? root : null);
      if (match) descendants.unshift(match);
    }
    return descendants;
  }

  // Preserve the first instance's public IDs. Repeated snippets and fragments
  // get local references, including the label/ARIA links browsers resolve globally.
  function scopeIds(root) {
    const selector = "[data-mero-scope], [data-mero-tabs]";
    for (const scope of matching(root, selector, true)) {
      const aliases = scopeAliases.get(scope) ?? new Map();
      for (const node of scope.querySelectorAll("[id]")) {
        if (node.closest(selector) !== scope) continue;
        const id = node.id;
        if (!aliases.has(id) && (document.getElementById(id) !== node ||
          (root !== document && document.querySelectorAll("#" + CSS.escape(id)).length > 1))) {
          let unique;
          do { unique = id + "-mero-" + ++instanceId; } while (document.getElementById(unique));
          aliases.set(id, unique);
        }
        if (aliases.has(id)) node.id = aliases.get(id);
      }
      if (!aliases.size) continue;
      scopeAliases.set(scope, aliases);
      const attributes = ["for", "aria-controls", "aria-labelledby", "aria-describedby", "aria-activedescendant", "popovertarget", "data-mero-open", "hx-target"];
      for (const node of scope.querySelectorAll(attributes.map(attr => "[" + attr + "]").join(","))) {
        if (node.closest(selector) !== scope) continue;
        for (const attr of attributes) {
          const value = node.getAttribute(attr);
          if (!value) continue;
          const updated = attr === "hx-target" ? (value[0] === "#" && aliases.has(value.slice(1)) ? "#" + aliases.get(value.slice(1)) : value)
            : value.split(/\s+/).map(id => aliases.get(id) ?? id).join(" ");
          if (updated !== value) node.setAttribute(attr, updated);
        }
      }
    }
  }

  function disabled(node) {
    return node.matches(':disabled, [aria-disabled="true"]');
  }

  function initNativeGroups(root) {
    for (const group of matching(root, "[data-mero-accordion]", true)) {
      const name = accordionNames.get(group) ?? "mero-accordion-" + ++instanceId;
      accordionNames.set(group, name);
      for (const item of group.querySelectorAll(":scope > details")) item.name = name;
    }
    for (const group of matching(root, "[data-mero-radio-group]", true)) {
      if (group.closest("form")) continue;
      const radios = [...group.querySelectorAll('input[type="radio"]:not([form])')];
      if (!radios.length) continue;
      // Native radio groups use their form owner and name. Keep the public field
      // name for submission and give standalone copies independent owners.
      let owner = group.querySelector(":scope > form[data-mero-radio-owner]");
      if (!owner) {
        owner = document.createElement("form");
        owner.hidden = true;
        owner.id = "mero-radio-" + ++instanceId;
        owner.setAttribute("data-mero-radio-owner", "");
        group.append(owner);
      }
      const selected = radios.find(radio => radio.checked) ?? radios.find(radio => radio.defaultChecked);
      for (const radio of radios) radio.setAttribute("form", owner.id);
      if (selected) selected.checked = true;
    }
  }

  function tabsFor(list) {
    return [...list.querySelectorAll(tabSelector)].filter(tab => tab.closest('[role="tablist"]') === list);
  }

  function selectTab(tab, focus = false) {
    const list = tab.closest('[role="tablist"]');
    if (!list || disabled(tab)) return;
    for (const item of tabsFor(list)) {
      const selected = item === tab;
      item.tabIndex = selected ? 0 : -1;
      item.setAttribute("aria-selected", String(selected));
      const panel = element(item.getAttribute("aria-controls"));
      if (panel) panel.hidden = !selected;
    }
    if (focus) tab.focus();
  }

  function initTabs(root) {
    for (const component of matching(root, "[data-mero-tabs]", true)) {
      const list = component.querySelector('[role="tablist"]');
      if (!list) continue;
      const tabs = tabsFor(list);
      const active = tabs.find(tab => tab.getAttribute("aria-selected") === "true" && !disabled(tab));
      const first = active ?? tabs.find(tab => !disabled(tab));
      component.toggleAttribute("data-mero-tabs-ready", Boolean(first));
      if (first) selectTab(first);
    }
  }

  function step(current, candidates, key, previous = "ArrowUp", next = "ArrowDown") {
    if (!candidates.length) return;
    if (key === "Home") return candidates[0];
    if (key === "End") return candidates.at(-1);
    const index = candidates.indexOf(current);
    if (key === previous) return candidates[index > 0 ? index - 1 : candidates.length - 1];
    if (key === next) return candidates[(index + 1) % candidates.length];
  }

  function optionsFor(list) {
    return [...(list?.querySelectorAll(optionSelector) ?? [])].filter(option => !option.hidden && !disabled(option));
  }

  function chooseOption(list, option) {
    for (const item of list.querySelectorAll(optionSelector)) {
      const selected = item === option;
      item.setAttribute("aria-selected", String(selected));
      item.tabIndex = selected ? 0 : -1;
    }
    list.dispatchEvent(new CustomEvent("mero:selection", {
      bubbles: true,
      detail: { value: option.dataset.value ?? option.textContent.trim(), option },
    }));
  }

  function initListboxes(root) {
    for (const list of matching(root, "[data-mero-listbox]", true)) {
      const options = optionsFor(list);
      const active = options.find(option => option.tabIndex === 0)
        ?? options.find(option => option.getAttribute("aria-selected") === "true") ?? options[0];
      for (const option of options) option.tabIndex = option === active ? 0 : -1;
    }
  }

  function setComboOpen(input, isOpen) {
    const list = element(input.getAttribute("aria-controls"));
    if (!list) return;
    list.hidden = !isOpen;
    input.setAttribute("aria-expanded", String(isOpen));
    if (!isOpen) {
      input.removeAttribute("aria-activedescendant");
      list.querySelector("[data-mero-active]")?.removeAttribute("data-mero-active");
    }
  }

  function comboStatus(input, message, error = false) {
    const status = input.closest("[data-mero-combo]")?.querySelector("[data-mero-combo-status]");
    if (!status) return;
    if (status.textContent !== message) status.textContent = message;
    status.toggleAttribute("data-mero-error", error);
  }

  function filterCombo(input) {
    const list = element(input.getAttribute("aria-controls"));
    if (!list) return;
    const query = input.value.trim().toLocaleLowerCase();
    const remote = input.closest("[data-mero-combo-remote]");
    if (!remote) {
      for (const item of list.querySelectorAll('[role="option"]:not([data-mero-empty-option])')) {
        item.hidden = !item.textContent.toLocaleLowerCase().includes(query);
      }
      const empty = list.querySelector("[data-mero-empty-option]");
      if (empty) empty.hidden = optionsFor(list).length > 0;
    }
    const current = element(input.getAttribute("aria-activedescendant"));
    if (current?.hidden) {
      current.removeAttribute("data-mero-active");
      input.removeAttribute("aria-activedescendant");
    }
    const count = optionsFor(list).length;
    const empty = list.querySelector('[aria-disabled="true"]:not([hidden])');
    setComboOpen(input, Boolean(count || empty));
    comboStatus(input, count ? count + (count === 1 ? " suggestion" : " suggestions") : empty?.textContent ?? "No matching options");
  }

  function activateCombo(input, list, option) {
    if (!option) return;
    setComboOpen(input, true);
    list.querySelector("[data-mero-active]")?.removeAttribute("data-mero-active");
    option.setAttribute("data-mero-active", "true");
    markComboChoice(list, option);
    if (option.id) input.setAttribute("aria-activedescendant", option.id);
    option.scrollIntoView({ block: "nearest" });
  }

  function markComboChoice(list, option) {
    for (const other of list.querySelectorAll('[aria-selected="true"]')) other.setAttribute("aria-selected", "false");
    option.setAttribute("aria-selected", "true");
  }

  function selectCombo(input, option) {
    if (!input || !option || disabled(option)) return;
    input.value = option.dataset.value ?? option.textContent.trim();
    setComboOpen(input, false);
    markComboChoice(option.closest('[role="listbox"]'), option);
    input.focus();
    input.dispatchEvent(new Event("change", { bubbles: true }));
  }

  function isCurrentQuery(query) {
    return currentQueries.get(query.input) === query && query.input.value === query.value && query.input.isConnected;
  }

  function reconcileCombos(root, request) {
    const selector = '[data-mero-combo] [role="combobox"]';
    const inputs = matching(root, selector);
    const containingInput = root instanceof Element && root.closest("[data-mero-combo]")?.querySelector('[role="combobox"]');
    if (containingInput && !inputs.includes(containingInput)) inputs.push(containingInput);
    for (const input of inputs) {
      if (input.closest("[data-mero-combo-remote]")) {
        // Delayed input triggers may let an older response arrive before the
        // next request starts. Keep those suggestions closed.
        if (request?.input !== input || !isCurrentQuery(request)) continue;
        displayedQueries.set(input, request.value);
        input.removeAttribute("data-mero-combo-pending");
        input.removeAttribute("aria-busy");
      }
      if (input !== document.activeElement) continue;
      const list = element(input.getAttribute("aria-controls"));
      if (!list || !list.contains(element(input.getAttribute("aria-activedescendant")))) {
        input.removeAttribute("aria-activedescendant");
      }
      filterCombo(input);
    }
  }

  function toast(message, { tone = "accent", duration = 4800, trigger = document.activeElement } = {}) {
    if (!String(message ?? "").trim()) return;
    const host = trigger?.closest?.("dialog[open]") ?? document.body;
    let region = host.querySelector(":scope > .mero-toast-region");
    if (!region) {
      region = document.createElement("div");
      region.className = "mero-toast-region";
      region.setAttribute("role", "region");
      region.setAttribute("aria-label", "Notifications");
      host.append(region);
    }
    const item = document.createElement("div");
    item.className = "mero-toast";
    item.dataset.tone = tone;
    const marker = document.createElement("span");
    marker.className = "mero-toast-mark";
    marker.setAttribute("aria-hidden", "true");
    marker.textContent = { success: "✓", warning: "!", danger: "!" }[tone] ?? "•";
    const text = document.createElement("span");
    text.setAttribute("role", tone === "danger" ? "alert" : "status");
    const dismiss = document.createElement("button");
    dismiss.className = "mero-button mero-button-ghost mero-button-icon mero-button-sm";
    dismiss.type = "button";
    dismiss.setAttribute("aria-label", "Dismiss notification");
    const dismissMark = document.createElement("span");
    dismissMark.className = "mero-dismiss-mark";
    dismissMark.setAttribute("aria-hidden", "true");
    dismiss.append(dismissMark);
    item.append(marker, text, dismiss);
    region.append(item);
    // Connect the live region before populating it so assistive tech sees the update.
    requestAnimationFrame(() => { text.textContent = message; });

    let timer;
    const clear = () => clearTimeout(timer);
    const start = () => {
      clear();
      if (duration > 0) timer = setTimeout(() => item.remove(), duration);
    };
    const previousFocus = document.activeElement;
    dismiss.addEventListener("click", () => {
      clear();
      const focused = item.contains(document.activeElement);
      item.remove();
      if (focused && previousFocus?.isConnected) previousFocus.focus({ preventScroll: true });
    });
    item.addEventListener("mouseenter", clear);
    item.addEventListener("mouseleave", () => { if (!item.contains(document.activeElement)) start(); });
    item.addEventListener("focusin", clear);
    item.addEventListener("focusout", () => { if (!item.matches(":hover")) start(); });
    start();
    return item;
  }

  function init(root = document, trigger, request) {
    scopeIds(root);
    initNativeGroups(root);
    initTabs(root);
    initListboxes(root);
    reconcileCombos(root, request);
    for (const dialog of matching(root, "dialog[data-mero-autoopen]")) {
      if (autoOpened.has(dialog)) continue;
      autoOpened.add(dialog);
      open(dialog, { trigger });
    }
  }

  document.addEventListener("pointerdown", event => {
    const target = event.target;
    if (target instanceof HTMLDialogElement) pointerStarts.set(target, outsideDialog(event, target));
    if (target.closest?.("[data-mero-combo] [role='option']")) event.preventDefault();
  });

  for (const type of ["focusin", "pointerover"]) {
    document.addEventListener(type, event => {
      const tooltip = event.target.closest?.(".mero-tooltip");
      if (tooltip) placeTooltip(tooltip);
    });
  }
  window.addEventListener("resize", repositionTooltips);
  document.addEventListener("scroll", repositionTooltips, { capture: true, passive: true });

  document.addEventListener("click", event => {
    const target = event.target;
    if (!(target instanceof Element)) return;
    const trigger = target.closest("[data-mero-open]");
    const closer = target.closest("[data-mero-close]");
    const tab = target.closest(tabSelector);
    const option = target.closest(optionSelector);
    const toggle = target.closest("[data-mero-toggle]");
    const notifier = target.closest("[data-mero-toast]");
    const removable = target.closest("[data-mero-remove]");
    if (trigger && !disabled(trigger)) {
      open(trigger.dataset.meroOpen, { trigger });
    }
    if (closer) {
      event.preventDefault();
      close(closer.closest("dialog"), { value: closer.dataset.meroClose });
    }
    if (target instanceof HTMLDialogElement && target.open && !target.matches("[data-mero-static], [role='alertdialog']")) {
      const beganOutside = pointerStarts.get(target);
      pointerStarts.delete(target);
      if (beganOutside && outsideDialog(event, target)) close(target);
    }
    if (tab?.closest("[data-mero-tabs]")) selectTab(tab);
    const combo = option?.closest("[data-mero-combo]");
    const list = !combo && option?.closest("[data-mero-listbox]");
    if (combo) selectCombo(combo.querySelector('[role="combobox"]'), option);
    if (list && !disabled(option)) chooseOption(list, option);
    if (toggle && !disabled(toggle)) toggle.setAttribute("aria-pressed", String(toggle.getAttribute("aria-pressed") !== "true"));
    if (notifier && !disabled(notifier)) toast(notifier.dataset.meroToast, { tone: notifier.dataset.meroTone, trigger: notifier });
    if (removable && !disabled(removable)) {
      const chip = removable.closest(".mero-chip");
      const next = chip?.nextElementSibling?.querySelector(focusable) ?? chip?.previousElementSibling?.querySelector(focusable);
      chip?.remove();
      next?.focus();
    }
  });

  document.addEventListener("keydown", event => {
    const target = event.target;
    if (!(target instanceof Element) || event.altKey || event.ctrlKey || event.metaKey || event.isComposing) return;
    if (event.key === "Escape") {
      const tooltip = target.closest(".mero-tooltip") ?? document.querySelector(".mero-tooltip:hover");
      if (tooltip && !tooltip.hasAttribute("data-mero-tooltip-dismissed")) {
        tooltip.setAttribute("data-mero-tooltip-dismissed", "");
        event.preventDefault();
        return;
      }
    }
    const tab = target.closest(tabSelector);
    if (tab?.closest("[data-mero-tabs]")) {
      const list = tab.closest('[role="tablist"]');
      if (!list) return;
      const vertical = list.getAttribute("aria-orientation") === "vertical";
      const rtl = !vertical && getComputedStyle(list).direction === "rtl";
      const previous = vertical ? "ArrowUp" : rtl ? "ArrowRight" : "ArrowLeft";
      const next = vertical ? "ArrowDown" : rtl ? "ArrowLeft" : "ArrowRight";
      const candidate = step(tab, tabsFor(list).filter(item => !disabled(item)), event.key, previous, next);
      if (candidate) {
        event.preventDefault();
        selectTab(candidate, true);
      }
      return;
    }
    if (target.matches('[data-mero-combo] [role="combobox"]')) {
      const list = element(target.getAttribute("aria-controls"));
      if (!list) return;
      const active = element(target.getAttribute("aria-activedescendant"));
      if (event.key === "Escape" && (!list.hidden || target.hasAttribute("data-mero-combo-pending"))) {
        event.preventDefault();
        currentQueries.delete(target);
        target.setAttribute("data-mero-combo-dismissed", "");
        target.removeAttribute("data-mero-combo-pending");
        target.removeAttribute("aria-busy");
        comboStatus(target, "");
        setComboOpen(target, false);
      } else if (event.key === "Enter" && active && !list.hidden) {
        event.preventDefault();
        selectCombo(target, active);
      } else if (event.key === "ArrowUp" || event.key === "ArrowDown") {
        event.preventDefault();
        if (target.hasAttribute("data-mero-combo-pending")) return;
        if (target.closest("[data-mero-combo-remote]") && (target.hasAttribute("data-mero-combo-error") ||
          target.value !== (displayedQueries.get(target) ?? target.defaultValue))) {
          target.removeAttribute("data-mero-combo-dismissed");
          target.dispatchEvent(new CustomEvent("mero:query", { bubbles: true }));
          return;
        }
        const candidate = step(active, optionsFor(list), event.key);
        activateCombo(target, list, candidate);
      }
      return;
    }
    const list = target.closest("[data-mero-listbox]");
    if (!list || !target.matches(optionSelector)) return;
    const candidate = step(target, optionsFor(list), event.key);
    if (candidate) {
      event.preventDefault();
      for (const option of optionsFor(list)) option.tabIndex = option === candidate ? 0 : -1;
      candidate.focus();
    } else if (event.key === " " || event.key === "Enter") {
      event.preventDefault();
      chooseOption(list, target);
    }
  });

  document.addEventListener("input", event => {
    const input = event.target;
    if (!input.matches?.('[data-mero-combo] [role="combobox"]')) return;
    if (input.closest("[data-mero-combo-remote]")) {
      currentQueries.delete(input);
      input.removeAttribute("data-mero-combo-dismissed");
      input.removeAttribute("data-mero-combo-error");
      input.setAttribute("data-mero-combo-pending", "");
      input.setAttribute("aria-busy", "true");
      comboStatus(input, "");
      setComboOpen(input, false);
    } else {
      filterCombo(input);
    }
  });
  document.addEventListener("focusout", event => {
    const combo = event.target.closest?.("[data-mero-combo]");
    if (combo && !combo.contains(event.relatedTarget)) {
      const input = combo.querySelector('[role="combobox"]');
      if (input) setComboOpen(input, false);
    }
    const tooltip = event.target.closest?.(".mero-tooltip");
    if (tooltip && !tooltip.contains(event.relatedTarget) && !tooltip.matches(":hover")) {
      tooltip.removeAttribute("data-mero-tooltip-dismissed");
      visibleTooltips.delete(tooltip);
    }
  });
  document.addEventListener("pointerout", event => {
    const tooltip = event.target.closest?.(".mero-tooltip");
    if (tooltip && !tooltip.contains(event.relatedTarget) && !tooltip.matches(":focus-within")) {
      tooltip.removeAttribute("data-mero-tooltip-dismissed");
      visibleTooltips.delete(tooltip);
    }
  });

  document.addEventListener("close", event => {
    if (event.target instanceof HTMLDialogElement) {
      event.target.querySelector(":scope > .mero-toast-region")?.remove();
      returnFocus(event.target);
    }
  }, true);

  document.addEventListener("mero:toast", event => {
    if (event.detail?.message) toast(event.detail.message, event.detail);
  });

  // htmx 4 renamed its events and replaced the XHR in their detail with a fetch
  // context. Each one is relayed here under its htmx 2 name and shape, so the
  // handlers in every Mero script run unchanged on both versions.
  // shortcut: handlers stay written for htmx 2, invert this when htmx 2 support ends.
  const legacyRequests = new WeakMap();
  const swapRequests = new WeakMap();

  function legacyRequest(ctx) {
    let info = legacyRequests.get(ctx);
    if (!info) {
      // A direct htmx.swap() call has no request.
      const request = ctx.request ?? { method: "GET", action: "" };
      const headers = () => ctx.response?.headers;
      info = {
        xhr: {
          get status() { return ctx.response?.status ?? 0; },
          get responseText() { return ctx.text ?? ""; },
          getResponseHeader: name => headers()?.get(name) ?? null,
          getAllResponseHeaders: () => [...headers() ?? []].map(pair => pair.join(": ")).join("\r\n"),
        },
        requestConfig: {
          // htmx 4 points ctx.sourceElement at the new content after an outerHTML swap.
          elt: ctx.sourceElement,
          verb: request.method.toLowerCase(),
          headers: request.headers,
          get useUrlParams() { return /GET|DELETE/.test(request.method); },
          get path() { return request.action; },
          set path(value) { request.action = value; },
          get formData() { return request.body; },
          get parameters() {
            const values = request.body ?? new URL(request.action, location.href).searchParams;
            return new Proxy({}, {
              get: (_, name) => typeof name === "string" ? values.get(name) ?? undefined : undefined,
              set: (_, name, value) => (values.set(name, value), true),
            });
          },
        },
      };
      legacyRequests.set(ctx, info);
    }
    const target = typeof ctx.target === "string" ? document.querySelector(ctx.target) : ctx.target;
    return { ...info, target, pathInfo: { requestPath: info.requestConfig.path, finalRequestPath: info.requestConfig.path } };
  }

  function relay(event, name, target, detail = {}) {
    const on = target?.isConnected ? target : document;
    detail.elt ??= on;
    const legacy = new CustomEvent(name, { detail, bubbles: true, cancelable: true });
    if (!on.dispatchEvent(legacy)) event.preventDefault();
  }

  function triggerHeader(ctx, name, source) {
    const value = ctx.response?.headers.get(name);
    if (!value) return;
    let events;
    try { events = value.startsWith("{") ? JSON.parse(value) : Object.fromEntries(value.split(",").map(item => [item.trim(), {}])); } catch { return; }
    for (const [type, data] of Object.entries(events)) {
      const detail = data && typeof data === "object" ? data : { value: data };
      const on = (typeof detail.target === "string" && document.querySelector(detail.target)) || (source.isConnected ? source : document.body);
      on.dispatchEvent(new CustomEvent(type, { detail, bubbles: true, cancelable: true }));
    }
  }

  const legacyEvents = {
    "htmx:config:request": event => {
      const { ctx } = event.detail;
      const config = legacyRequest(ctx).requestConfig;
      // htmx 4 removed hx-params, which the collection markup uses to keep drafts out of a request.
      const params = config.elt.closest?.("[hx-params]")?.getAttribute("hx-params");
      if (params && params !== "*" && ctx.request.body) {
        const not = params.startsWith("not ");
        const names = params === "none" ? [] : params.replace(/^not /, "").split(",").map(name => name.trim());
        for (const key of new Set(ctx.request.body.keys())) if (names.includes(key) === not) ctx.request.body.delete(key);
      }
      relay(event, "htmx:configRequest", config.elt, config);
    },
    "htmx:before:request": event => {
      const detail = legacyRequest(event.detail.ctx);
      relay(event, "htmx:beforeRequest", detail.requestConfig.elt, detail);
    },
    "htmx:before:swap": event => {
      const { ctx, tasks } = event.detail;
      for (const task of tasks) swapRequests.set(task, ctx);
      const detail = { ...legacyRequest(ctx), shouldSwap: true, isError: ctx.response?.status >= 400, serverResponse: ctx.text };
      relay(event, "htmx:beforeSwap", detail.target, detail);
      // As in htmx 2, a handler that accepts an error response also clears its failure.
      legacyRequests.get(ctx).failed = detail.isError;
      if (!detail.shouldSwap) event.preventDefault();
    },
    // htmx 4 settles each task before after:swap. htmx 2 settles afterwards, so hold these back.
    "htmx:after:settle": event => {
      const ctx = swapRequests.get(event.detail.task);
      const settle = () => relay(event, "htmx:afterSettle", event.detail.task.target ?? document, ctx ? legacyRequest(ctx) : {});
      const info = ctx && legacyRequests.get(ctx);
      if (info) (info.settles ??= []).push(settle);
      else settle();
    },
    "htmx:finally:swap": event => {
      const { ctx } = event.detail;
      const info = legacyRequests.get(ctx);
      if (!info) return;
      const source = info.requestConfig.elt;
      // htmx 4 dropped these two headers. Mero keeps one server contract for both
      // versions, and like htmx 2 only honours them once a swap was accepted.
      if (info.swapped) triggerHeader(ctx, "HX-Trigger-After-Swap", source);
      for (const settle of info.settles?.splice(0) ?? []) settle();
      if (info.swapped) triggerHeader(ctx, "HX-Trigger-After-Settle", source);
    },
    "htmx:after:swap": event => {
      const { ctx } = event.detail;
      const detail = legacyRequest(ctx);
      legacyRequests.get(ctx).swapped = true;
      relay(event, "htmx:afterSwap", event.target, detail);
      if (!ctx.request?.headers?.["HX-History-Restore-Request"]) return;
      // htmx 4 restores inside a Navigation API transition. The browser resets focus
      // and scroll when that ends, so a restore handler has to run afterwards.
      const restored = () => relay(event, "htmx:historyRestore", document);
      (window.navigation?.transition?.finished ?? Promise.resolve()).then(restored, restored);
    },
    "htmx:response:error": event => {
      const detail = legacyRequest(event.detail.ctx);
      relay(event, "htmx:responseError", detail.requestConfig.elt, detail);
    },
    "htmx:finally:request": event => {
      const { ctx } = event.detail;
      // htmx 4 also reports requests that a before:request listener cancelled.
      if (!ctx.response && !String(ctx.status).startsWith("error")) return;
      const detail = legacyRequest(ctx);
      const source = detail.requestConfig.elt;
      const failed = !ctx.response || (legacyRequests.get(ctx).failed ?? ctx.response.status >= 400);
      const successful = !failed;
      relay(event, "htmx:afterRequest", source, { ...detail, successful, failed });
      // As in htmx 2, the cause of a missing response follows afterRequest.
      const signal = ctx.request.signal;
      if (!ctx.response) relay(event, signal?.reason === "timeout" ? "htmx:timeout" : signal?.aborted ? "htmx:sendAbort" : "htmx:sendError", source, { ...detail });
    },
    "htmx:before:cleanup": event => relay(event, "htmx:beforeCleanupElement", event.target),
    "htmx:after:process": event => relay(event, "htmx:load", event.target),
    "htmx:before:history:update": event => relay(event, "htmx:beforeHistoryUpdate", document,
      Object.assign(event.detail, { requestConfig: { elt: event.detail.sourceElement } })),
    "htmx:after:history:push": event => relay(event, "htmx:pushedIntoHistory", document, event.detail),
    "htmx:after:history:replace": event => relay(event, "htmx:replacedInHistory", document, event.detail),
  };
  for (const [name, handler] of Object.entries(legacyEvents)) document.addEventListener(name, handler);

  document.addEventListener("htmx:beforeRequest", event => {
    const { xhr, elt } = event.detail;
    if (!xhr || !elt) return;
    requestOpeners.set(xhr, elt);
    if (elt.matches?.('[data-mero-combo-remote] [role="combobox"]')) {
      if (elt.hasAttribute("data-mero-combo-dismissed")) {
        event.preventDefault();
        return;
      }
      const query = { input: elt, value: elt.value };
      remoteQueries.set(xhr, query);
      currentQueries.set(elt, query);
      elt.setAttribute("data-mero-combo-pending", "");
      elt.setAttribute("aria-busy", "true");
      elt.removeAttribute("data-mero-combo-error");
      comboStatus(elt, "");
    }
  });

  document.addEventListener("htmx:beforeSwap", event => {
    const query = remoteQueries.get(event.detail.xhr);
    // htmx 4 would swap an error page into the list of suggestions.
    if (query && (!isCurrentQuery(query) || event.detail.xhr.status >= 400)) event.detail.shouldSwap = false;
    const active = document.activeElement;
    const scope = active?.closest("[data-mero-scope]");
    if (scope && active.id && scopeAliases.has(scope) && event.detail.shouldSwap && event.detail.target?.contains(active)) {
      swappedFocus.set(event.detail.xhr, { scope, id: active.id });
    }
  });

  document.addEventListener("htmx:afterRequest", event => {
    const query = remoteQueries.get(event.detail.xhr);
    if (!query || !isCurrentQuery(query) || !event.detail.failed) return;
    query.input.removeAttribute("data-mero-combo-pending");
    query.input.removeAttribute("aria-busy");
    query.input.setAttribute("data-mero-combo-error", "");
    setComboOpen(query.input, false);
    comboStatus(query.input, "Could not load suggestions. Edit the search to try again.", true);
  });

  document.addEventListener("htmx:afterSettle", event => {
    const { xhr, elt } = event.detail;
    init(elt ?? event.target, requestOpeners.get(xhr), remoteQueries.get(xhr));
    // HTMX restores focus before repeated fragment IDs receive their scoped names.
    const saved = swappedFocus.get(xhr);
    if (saved && document.activeElement === document.body) {
      const replacement = element(saved.id);
      if (replacement && saved.scope.contains(replacement)) replacement.focus({ preventScroll: true });
    }
  });

  document.addEventListener("htmx:beforeCleanupElement", event => {
    visibleTooltips.delete(event.target);
  });

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", () => init(), { once: true });
  } else {
    init();
  }

  window.MeroUI = Object.freeze({ open, close, toast, init });
})();
