/*! @rubenlangeweg/mero-ui 0.9.0 | MIT */
(() => {
  "use strict";

  const lifecycle = (globalThis[Symbol.for("mero.lifecycle")] ??= { init: new Set(), cleanup: new Set(), config: { locale: null, dialogBackdrop: "all", messages: {} } });
  const config = (lifecycle.config ??= { locale: null, dialogBackdrop: "all", messages: {} });
  const defaultMessages = {
    notificationsLabel: "Notifications",
    dismissNotification: "Dismiss notification",
    copied: "Copied",
    copySelectPrompt: "Press Ctrl+C or ⌘C to copy the selected text.",
    copyBlocked: "Couldn't copy. Your browser blocked clipboard access.",
    previewLabel: "Preview",
    closePreview: "Close preview",
    openPreview: "Open",
    previewHint: "Space or Esc closes · ↑ ↓ move",
    comboLoading: "Loading…",
    comboEmpty: "No matching options",
    comboError: "Could not load suggestions. Edit the search to try again.",
    comboResultOne: "{count} result",
    comboResultMany: "{count} results",
    comboSuggestionOne: "{count} suggestion",
    comboSuggestionMany: "{count} suggestions",
    shortcutsOn: "Keyboard shortcuts on",
    shortcutsOff: "Keyboard shortcuts off",
  };
  function msg(key, vars) {
    let text = config.messages[key] ?? defaultMessages[key] ?? "";
    if (vars) for (const [name, value] of Object.entries(vars)) text = text.replaceAll("{" + name + "}", String(value));
    return text;
  }
  function resolveLocale(node) {
    const explicit = node.closest("[data-mero-locale]")?.getAttribute("data-mero-locale") || config.locale;
    if (explicit === "browser") return undefined;
    if (explicit && explicit !== "document") return explicit;
    const lang = node.closest("[lang]")?.getAttribute("lang")?.trim();
    if (!lang) return undefined;
    if (explicit === "document" || lang.includes("-")) return lang;
    const reader = (typeof navigator !== "undefined" && navigator.language || "").split("-")[0].toLowerCase();
    return lang.toLowerCase() !== reader ? lang : undefined;
  }
  function handlesDialog(dialog) {
    return config.dialogBackdrop === "all" || dialog.matches(".mero-dialog, [data-mero-dialog]") || dialogOpeners.has(dialog);
  }
  const dialogOpeners = new WeakMap();
  const dialogFocus = new WeakMap();
  const dialogClosed = new WeakSet();
  const autoOpened = new WeakSet();
  const menuFocusLast = new WeakSet();
  const tabbedMenus = new WeakSet();
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
  const menuItemSelector = '[role="menuitem"], [role="menuitemradio"], [role="menuitemcheckbox"]';
  const popupMenuItemSelector = `[popover][role="menu"] :is(${menuItemSelector})`;

  function element(ref) {
    return typeof ref === "string" ? document.getElementById(ref.replace(/^#/, "")) : ref;
  }

  function open(ref, { trigger = document.activeElement } = {}) {
    const dialog = element(ref);
    if (!(dialog instanceof HTMLDialogElement) || dialog.open || !dialog.isConnected) return;
    dialogOpeners.set(dialog, { trigger, previouslyFocused: document.activeElement });
    dialogClosed.delete(dialog);
    dialog.showModal();
    const input = dialog.matches("[data-mero-command]") && dialog.querySelector('[role="combobox"]');
    if (input) {
      input.value = "";
      input.removeAttribute("data-mero-combo-dismissed");
      input.removeAttribute("data-mero-combo-error");
      setComboOpen(input, false);
      input.dispatchEvent(new CustomEvent("mero:query", { bubbles: true }));
    }
    dialog.dispatchEvent(new CustomEvent("mero:dialog", { bubbles: true, detail: { open: true, dialog, returnValue: "" } }));
  }

  function clearDialogToasts(dialog, preserve = false) {
    const region = dialog.querySelector(":scope > .mero-toast-region");
    if (!region) return;
    if (preserve && region.children.length) toastRegion(document.body).append(...region.children);
    region.remove();
  }

  function emitDialogClose(dialog) {
    dialog.dispatchEvent(new CustomEvent("mero:dialog", {
      bubbles: true,
      detail: { open: false, dialog, returnValue: dialog.returnValue },
    }));
  }

  function close(ref, { focus, value, preserveToasts } = {}) {
    const dialog = element(ref);
    if (!(dialog instanceof HTMLDialogElement) || !dialog.open) return;
    if (focus) dialogFocus.set(dialog, focus);
    clearDialogToasts(dialog, Boolean(preserveToasts));
    dialogClosed.add(dialog);
    dialog.close(value);
    emitDialogClose(dialog);
  }

  function returnFocus(dialog) {
    const opener = dialogOpeners.get(dialog);
    const focus = element(dialogFocus.get(dialog) ?? opener?.trigger);
    dialogFocus.delete(dialog);
    dialogOpeners.delete(dialog);
    if (!focus?.isConnected || focus.matches(":disabled") || dialog.contains(focus)) return;
    // Let native restoration finish. If the user already moved to another
    // field, taking focus back would also dismiss that field's suggestions.
    requestAnimationFrame(() => {
      const active = document.activeElement;
      if (focus.isConnected && !dialog.open && active !== focus &&
        (active === document.body || active === opener?.previouslyFocused || active === element(opener?.trigger) || dialog.contains(active))) {
        focus.focus({ preventScroll: true });
      }
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
      const selectors = ["hx-target", "data-mero-return-focus", "data-mero-fallback-focus", "data-mero-ephemeral-dismiss", "data-mero-action-unknown", "data-mero-action-reread"];
      const attributes = ["for", "aria-controls", "aria-labelledby", "aria-describedby", "aria-activedescendant", "popovertarget", "data-mero-open", ...selectors];
      for (const node of scope.querySelectorAll(attributes.map(attr => "[" + attr + "]").join(","))) {
        if (node.closest(selector) !== scope) continue;
        for (const attr of attributes) {
          const value = node.getAttribute(attr);
          if (!value) continue;
          const updated = selectors.includes(attr) ? (value[0] === "#" && aliases.has(value.slice(1)) ? "#" + aliases.get(value.slice(1)) : value)
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

  function selectTab(tab) {
    const list = tab.closest('[role="tablist"]');
    if (!list || disabled(tab)) return false;
    const changed = tab.getAttribute("aria-selected") !== "true";
    for (const item of tabsFor(list)) {
      const selected = item === tab;
      item.tabIndex = selected ? 0 : -1;
      item.setAttribute("aria-selected", String(selected));
      const panel = element(item.getAttribute("aria-controls"));
      if (panel) panel.hidden = !selected;
    }
    return changed;
  }

  // A person chose the tab. initTabs calls selectTab directly, so nothing fires at init.
  function chooseTab(tab, focus) {
    if (selectTab(tab)) tab.dispatchEvent(new CustomEvent("mero:tab", { bubbles: true, detail: { tab, panel: element(tab.getAttribute("aria-controls")) } }));
    // Focus last, and only if a listener left this tab selected: a focus handler can select another tab.
    if (focus && tab.getAttribute("aria-selected") === "true") tab.focus();
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

  function menuItems(menu) {
    // Disabled items stay focusable (APG) so screen-reader users learn they exist; the click guard blocks them.
    return [...menu.querySelectorAll(menuItemSelector)].filter(item => !item.hidden);
  }

  function menuButton(menu) {
    return document.querySelector('[popovertarget="' + CSS.escape(menu.id) + '"]');
  }

  function optionsFor(list) {
    return [...(list?.querySelectorAll(optionSelector) ?? [])].filter(option => !option.hidden && !option.closest('[role="group"][hidden]') && !disabled(option));
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
      clearComboActive(input, list);
    }
  }

  function clearComboActive(input, list) {
    input.removeAttribute("aria-activedescendant");
    for (const item of list.querySelectorAll("[data-mero-active]")) item.removeAttribute("data-mero-active");
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
    const options = optionsFor(list);
    const current = element(input.getAttribute("aria-activedescendant"));
    if (!options.includes(current)) clearComboActive(input, list);
    const count = options.length;
    const empty = list.querySelector('[aria-disabled="true"]:not([hidden])');
    setComboOpen(input, Boolean(count || empty));
    const isCommand = Boolean(input.closest("[data-mero-command]"));
    const key = isCommand ? (count === 1 ? "comboResultOne" : "comboResultMany") : (count === 1 ? "comboSuggestionOne" : "comboSuggestionMany");
    comboStatus(input, count ? msg(key, { count }) : empty?.textContent ?? msg("comboEmpty"));
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
    // Command options act through their own click: link navigation, hx-*, or data-mero-toast.
    const command = input?.closest("dialog[data-mero-command]");
    if (command) {
      if (!disabled(option)) { setComboOpen(input, false); close(command); }
      return;
    }
    if (!input || !option || disabled(option)) return;
    const value = option.dataset.value ?? option.textContent.trim();
    const label = option.textContent.trim();
    input.value = value;
    setComboOpen(input, false);
    markComboChoice(option.closest('[role="listbox"]'), option);
    input.focus();
    input.dispatchEvent(new Event("change", { bubbles: true }));
    input.dispatchEvent(new CustomEvent("mero:select", { bubbles: true, detail: { value, label, option } }));
  }

  function isCurrentQuery(query) {
    return currentQueries.get(query.input) === query && query.input.value === query.value && query.input.isConnected;
  }

  function showComboResults(input) {
    if (input !== document.activeElement) return;
    const list = element(input.getAttribute("aria-controls"));
    if (!list) return;
    filterCombo(input);
    if (input.closest("[data-mero-command]") && !input.hasAttribute("aria-activedescendant")) activateCombo(input, list, optionsFor(list)[0]);
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
      showComboResults(input);
    }
  }

  function toastRegion(host) {
    let region = host.querySelector(":scope > .mero-toast-region");
    if (!region) {
      region = document.createElement("div");
      region.className = "mero-toast-region";
      region.setAttribute("role", "region");
      region.setAttribute("aria-label", msg("notificationsLabel"));
      host.append(region);
    }
    return region;
  }

  function toast(message, { tone = "accent", duration = 4800, trigger = document.activeElement } = {}) {
    if (!String(message ?? "").trim()) return;
    const region = toastRegion(trigger?.closest?.("dialog[open]") ?? document.body);
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
    dismiss.setAttribute("aria-label", msg("dismissNotification"));
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
      if (focused && previousFocus?.isConnected && !previousFocus.closest?.("dialog:not([open])")) previousFocus.focus({ preventScroll: true });
    });
    item.addEventListener("mouseenter", clear);
    item.addEventListener("mouseleave", () => { if (!item.contains(document.activeElement)) start(); });
    item.addEventListener("focusin", clear);
    item.addEventListener("focusout", () => { if (!item.matches(":hover")) start(); });
    start();
    return item;
  }

  // Copy a literal value (data-mero-copy="…") or a target's value or text (data-mero-copy-target="#id").
  // An empty data-mero-copy without a target belongs to the code block and chat copy in mero-insights.js.
  async function copy(button) {
    const target = button.hasAttribute("data-mero-copy-target") ? document.querySelector(button.getAttribute("data-mero-copy-target")) : null;
    const text = target ? ("value" in target && target.matches("input, textarea, select, output") ? target.value : target.innerText)
      : button.getAttribute("data-mero-copy");
    if (!text) return;
    try {
      await navigator.clipboard.writeText(text);
      toast(button.dataset.meroCopyMessage || msg("copied"), { tone: "success", duration: 2400, trigger: button });
    } catch {
      // Without clipboard access, select the text so the person can copy it themselves.
      if (target?.select) target.select();
      else if (target) getSelection().selectAllChildren(target);
      toast(target ? msg("copySelectPrompt") : msg("copyBlocked"), { tone: target ? "accent" : "warning", trigger: button });
    }
  }

  // Row peek: one preview at a time, keyed by the row's id (or the link's href) so it can follow the row through swaps.
  let peek = null;
  const peekRegion = node => node?.closest?.("[data-mero-peek]");
  const peekRow = link => link.closest('tr, [role="row"]');
  const peekKey = link => peekRow(link)?.id || link.getAttribute("href");
  const peekTemplate = link => peekRow(link)?.querySelector("template[data-mero-peek-body]");
  const peekLinks = region => [...region.querySelectorAll(".mero-row-link")].filter(link => peekRegion(link) === region && link.getClientRects().length);

  function peekLink(region = peek?.panel.parentElement) {
    return region && [...region.querySelectorAll(".mero-row-link")].find(link => peekKey(link) === peek.key);
  }

  function peekPanel(region) {
    const existing = region.querySelector(":scope > .mero-peek");
    if (existing) return existing;
    const panel = document.createElement("aside");
    panel.className = "mero-peek";
    panel.setAttribute("aria-label", msg("previewLabel"));
    panel.setAttribute("aria-live", "polite");
    panel.innerHTML = '<div class="mero-peek-header"><h2 class="mero-peek-title"></h2>' +
      '<button class="mero-button mero-button-ghost mero-button-sm" type="button" data-mero-peek-close>' +
      '<span class="mero-dismiss-mark" aria-hidden="true"></span></button></div><div class="mero-peek-body"></div>' +
      '<div class="mero-peek-footer"><a class="mero-button mero-button-primary mero-button-sm"></a>' +
      '<span class="mero-peek-hint"></span></div>';
    panel.querySelector("[data-mero-peek-close]").setAttribute("aria-label", msg("closePreview"));
    panel.querySelector(".mero-peek-footer a").textContent = msg("openPreview");
    panel.querySelector(".mero-peek-hint").textContent = msg("previewHint");
    region.append(panel);
    return panel;
  }

  function showPeek(link, notify = true) {
    const region = peekRegion(link), template = peekTemplate(link);
    if (!region || !template) return false;
    const nextKey = peekKey(link);
    const changed = notify && (!peek || peek.key !== nextKey || peek.panel.parentElement !== region);
    const panel = peekPanel(region);
    if (peek && peek.panel !== panel) peek.panel.remove();
    // Keep the header and footer nodes so focus on Close or Open survives an update.
    const body = panel.querySelector(".mero-peek-body");
    panel.querySelector(".mero-peek-title").textContent = link.textContent.trim();
    panel.querySelector(".mero-peek-footer a").setAttribute("href", link.getAttribute("href"));
    body.replaceChildren(template.content.cloneNode(true));
    window.htmx?.process?.(body);
    init(body);
    peek = { panel, key: nextKey };
    if (changed) {
      region.dispatchEvent(new CustomEvent("mero:peek", {
        bubbles: true,
        detail: { open: true, key: nextKey, href: link.getAttribute("href"), link, panel },
      }));
    }
    // The bottom sheet's scroll padding keeps the row above it on phones.
    if (document.activeElement === link) link.scrollIntoView({ block: "nearest" });
    return true;
  }

  function closePeek(focusRow) {
    if (!peek) return;
    const { panel, key } = peek;
    const region = panel.parentElement;
    const link = peekLink();
    const focusLost = panel.contains(document.activeElement);
    panel.remove();
    peek = null;
    if (focusRow || focusLost) link?.focus();
    (region?.isConnected ? region : document).dispatchEvent(new CustomEvent("mero:peek", {
      bubbles: true,
      detail: { open: false, key, href: null, link: null, panel: null },
    }));
  }

  // After a swap or morph, show the same row from the new markup, or close when it is gone.
  function refreshPeek() {
    const region = peek.panel.isConnected ? peek.panel.parentElement : null;
    const link = peekLink(region) ?? [...document.querySelectorAll("[data-mero-peek]")].map(peekLink).find(Boolean);
    if (link && showPeek(link, false)) return;
    const { key } = peek;
    peek.panel.remove();
    peek = null;
    if (document.activeElement === document.body) region?.querySelector(".mero-row-link")?.focus({ preventScroll: true });
    (region?.isConnected ? region : document).dispatchEvent(new CustomEvent("mero:peek", {
      bubbles: true,
      detail: { open: false, key, href: null, link: null, panel: null },
    }));
  }

  // time[data-mero-time]: show the datetime attribute in the reader's locale and time zone.
  // relative: "3 minutes ago", refreshed every minute, with the full date in title. absolute, date, time: formatted.
  const timeUnits = [["year", 31536e6], ["month", 2592e6], ["week", 6048e5], ["day", 864e5], ["hour", 36e5], ["minute", 6e4], ["second", 1e3]];
  function localizeTimes(root = document) {
    for (const node of matching(root, "time[data-mero-time]")) {
      const date = new Date(node.getAttribute("datetime"));
      if (Number.isNaN(date.getTime())) continue;
      const style = node.dataset.meroTime;
      const locale = resolveLocale(node);
      const full = date.toLocaleString(locale, { dateStyle: "medium", timeStyle: "short" });
      let text = full;
      if (style === "date") text = date.toLocaleDateString(locale, { dateStyle: "medium" });
      else if (style === "time") text = date.toLocaleTimeString(locale, { timeStyle: "short" });
      else if (style === "relative") {
        const delta = date.getTime() - Date.now();
        const [unit, size] = timeUnits.find(([, size]) => Math.abs(delta) >= size) ?? ["second", 1e3];
        text = new Intl.RelativeTimeFormat(locale, { numeric: "auto" }).format(Math.round(delta / size), unit);
        if (node.title !== full) node.title = full;
      }
      if (node.textContent !== text) node.textContent = text;
    }
  }
  setInterval(() => document.querySelector('time[data-mero-time="relative"]') && localizeTimes(), 60000);

  // Single-key shortcuts. WCAG 2.1.4: a [data-mero-shortcuts-toggle] control turns them off, remembered per browser.
  const shortcutStore = "mero-shortcuts";
  const shortcutsOn = () => { try { return localStorage.getItem(shortcutStore) !== "off"; } catch { return true; } };
  function syncShortcuts(root = document) {
    const on = shortcutsOn();
    for (const node of matching(root, "[data-mero-shortcut]")) {
      const keys = node.dataset.meroShortcut.trim();
      // aria-keyshortcuts has no notation for sequences, so only single keys are announced.
      if (on && !/\s/.test(keys)) node.setAttribute("aria-keyshortcuts", keys);
      else if (node.getAttribute("aria-keyshortcuts") === keys) node.removeAttribute("aria-keyshortcuts");
    }
    for (const toggle of matching(root, "[data-mero-shortcuts-toggle]")) {
      if (toggle.matches("input[type=checkbox]")) toggle.checked = on;
      else toggle.setAttribute(toggle.matches('[role="menuitemcheckbox"], [role="switch"], [role="checkbox"]') ? "aria-checked" : "aria-pressed", String(on));
    }
  }

  function init(root = document, trigger, request) {
    if (!(root instanceof Element || root instanceof Document)) return;
    scopeIds(root);
    initNativeGroups(root);
    initTabs(root);
    initListboxes(root);
    reconcileCombos(root, request);
    localizeTimes(root);
    syncShortcuts(root);
    for (const dialog of matching(root, "dialog[data-mero-autoopen]")) {
      if (autoOpened.has(dialog)) continue;
      autoOpened.add(dialog);
      open(dialog, { trigger });
    }
    for (const fn of lifecycle.init) fn(root);
  }

  function cleanup(root = document) {
    if (!(root instanceof Element || root instanceof Document)) return;
    for (const tooltip of visibleTooltips) {
      if (root === document || root === tooltip || root.contains(tooltip)) visibleTooltips.delete(tooltip);
    }
    if (peek && (root === document || root.contains(peek.panel) || root.contains(peek.panel.parentElement))) {
      const { panel, key } = peek;
      const region = panel.parentElement;
      panel.remove();
      peek = null;
      (region?.isConnected ? region : document).dispatchEvent(new CustomEvent("mero:peek", {
        bubbles: true,
        detail: { open: false, key, href: null, link: null, panel: null },
      }));
    }
    for (const fn of lifecycle.cleanup) fn(root);
  }

  document.addEventListener("pointerdown", event => {
    const target = event.target;
    if (target instanceof HTMLDialogElement && handlesDialog(target)) pointerStarts.set(target, outsideDialog(event, target));
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

  // toggle does not bubble.
  document.addEventListener("toggle", event => {
    const menu = event.target;
    if (!menu.matches?.('[popover][role="menu"]')) return;
    const button = menuButton(menu);
    button?.setAttribute("aria-expanded", String(event.newState === "open"));
    if (event.newState === "open") {
      const items = menuItems(menu);
      // A single-choice menu opens on its current choice, as a select does.
      const checked = items.find(item => item.matches('[role="menuitemradio"][aria-checked="true"]'));
      (menuFocusLast.has(menu) ? items.at(-1) : checked ?? items[0])?.focus();
      menuFocusLast.delete(menu);
      tabbedMenus.delete(menu);
    } else if (!tabbedMenus.delete(menu) && (document.activeElement === document.body || menu.contains(document.activeElement)) && button?.isConnected) {
      button.focus({ preventScroll: true });
    }
  }, true);

  document.addEventListener("click", event => {
    const target = event.target;
    if (!(target instanceof Element)) return;
    const menuItem = target.closest(popupMenuItemSelector);
    if (menuItem && disabled(menuItem)) {
      event.preventDefault();
      return;
    }
    if (menuItem) menuItem.closest('[popover][role="menu"]').hidePopover();
    if (target.closest("[data-mero-peek-close]")) closePeek(true);
    // No defaultPrevented check: hx-boost cancels the click but still navigates.
    const opened = target.closest("[data-mero-restore-focus] a[href]");
    if (opened && event.button === 0 && !(event.metaKey || event.ctrlKey || event.shiftKey || event.altKey)) {
      try { sessionStorage.setItem(focusStore(), opened.getAttribute("href")); } catch {}
    }
    const trigger = target.closest("[data-mero-open]");
    const closer = target.closest("[data-mero-close]");
    const tab = target.closest(tabSelector);
    const option = target.closest(optionSelector);
    const toggle = target.closest("[data-mero-toggle]");
    const notifier = target.closest("[data-mero-toast]");
    const removable = target.closest("[data-mero-remove]");
    const copier = target.closest("[data-mero-copy-target], [data-mero-copy]:not([data-mero-copy=''])");
    const shortcutToggle = target.closest("[data-mero-shortcuts-toggle]");
    if (trigger && !disabled(trigger)) {
      open(trigger.dataset.meroOpen, { trigger });
    }
    if (closer) {
      event.preventDefault();
      close(closer.closest("dialog"), { value: closer.dataset.meroClose });
    }
    if (target instanceof HTMLDialogElement && target.open && handlesDialog(target) && !target.matches("[data-mero-static], [role='alertdialog']")) {
      const beganOutside = pointerStarts.get(target);
      pointerStarts.delete(target);
      if (beganOutside && outsideDialog(event, target)) close(target);
    }
    if (tab?.closest("[data-mero-tabs]")) chooseTab(tab);
    const combo = option?.closest("[data-mero-combo]");
    const list = !combo && option?.closest("[data-mero-listbox]");
    if (combo) selectCombo(combo.querySelector('[role="combobox"]'), option);
    if (list && !disabled(option)) chooseOption(list, option);
    if (toggle && !disabled(toggle)) {
      const pressed = toggle.getAttribute("aria-pressed") !== "true";
      toggle.setAttribute("aria-pressed", String(pressed));
      toggle.dispatchEvent(new CustomEvent("mero:toggle", { bubbles: true, detail: { pressed } }));
    }
    if (notifier && !disabled(notifier)) toast(notifier.dataset.meroToast, { tone: notifier.dataset.meroTone, trigger: notifier });
    if (copier && !disabled(copier)) copy(copier);
    if (shortcutToggle && !disabled(shortcutToggle)) {
      // A checkbox has already changed; other controls flip the stored state.
      const on = shortcutToggle.matches("input[type=checkbox]") ? shortcutToggle.checked : !shortcutsOn();
      try { localStorage.setItem(shortcutStore, on ? "on" : "off"); } catch {}
      syncShortcuts();
      toast(msg(on ? "shortcutsOn" : "shortcutsOff"), { trigger: shortcutToggle, duration: 2400 });
    }
    if (removable && !disabled(removable)) {
      const chip = removable.closest(".mero-chip");
      const next = chip?.nextElementSibling?.querySelector(focusable) ?? chip?.previousElementSibling?.querySelector(focusable);
      chip?.remove();
      next?.focus();
    }
  });

  let shortcutPrefix = null;
  function runShortcut(event) {
    const target = event.target;
    if (event.defaultPrevented || event.key.length !== 1 || !shortcutsOn()) return false;
    // Typing, menus, lists and grids own their letter keys.
    if (target.isContentEditable || target.matches("input, textarea, select") ||
      target.closest('[role="menu"], [role="listbox"], [role="tablist"], [role="grid"], [role="combobox"]')) return false;
    const key = event.key.toLowerCase();
    const sequence = shortcutPrefix && Date.now() - shortcutPrefix.at < 1500 ? shortcutPrefix.key + " " + key : null;
    shortcutPrefix = null;
    const modal = document.querySelector("dialog:modal");
    const candidates = [...document.querySelectorAll("[data-mero-shortcut]")]
      .filter(node => !node.closest("[inert]") && (!modal || modal.contains(node)) && node.getClientRects().length && !disabled(node));
    const match = keys => candidates.find(node => node.dataset.meroShortcut.trim().toLowerCase().split(/\s+/).join(" ") === keys);
    const found = (sequence && match(sequence)) || match(key);
    if (!found) {
      if (candidates.some(node => node.dataset.meroShortcut.trim().toLowerCase().startsWith(key + " "))) {
        shortcutPrefix = { key, at: Date.now() };
        event.preventDefault();
        return true;
      }
      return false;
    }
    event.preventDefault();
    if (found.matches("input, textarea, select")) found.focus();
    else found.click();
    return true;
  }

  document.addEventListener("keydown", event => {
    const target = event.target;
    if ((event.metaKey || event.ctrlKey) && !event.altKey && !event.shiftKey && event.key.toLowerCase() === "k" &&
      !event.defaultPrevented && !event.isComposing && !target.isContentEditable && !document.querySelector("dialog[open]") &&
      // mero-workspace.js loads later and owns the shortcut when its command is on the page.
      ![...document.querySelectorAll("[data-mero-ws-command]")].some(node => !node.closest("[inert]"))) {
      const dialog = [...document.querySelectorAll("dialog[data-mero-command]")].find(node => !node.closest("[inert]"));
      if (dialog) {
        event.preventDefault();
        const active = document.activeElement;
        open(dialog, { trigger: active && active !== document.body ? active : document.querySelector('[data-mero-open="' + CSS.escape(dialog.id) + '"]') });
        return;
      }
    }
    if (!(target instanceof Element) || event.altKey || event.ctrlKey || event.metaKey || event.isComposing) return;
    if (runShortcut(event)) return;
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
        chooseTab(candidate, true);
      }
      return;
    }
    const region = peekRegion(target);
    if (region && target.matches(".mero-row-link") && peekTemplate(target)) {
      if (event.key === " ") {
        event.preventDefault();
        if (peek && peekLink() === target) closePeek();
        else showPeek(target);
        return;
      }
      if ((event.key === "ArrowDown" || event.key === "ArrowUp") && peek) {
        const links = peekLinks(region);
        const next = links[links.indexOf(target) + (event.key === "ArrowDown" ? 1 : -1)];
        if (next) {
          event.preventDefault();
          next.focus();
        }
        return;
      }
    }
    if (event.key === "Escape" && peek && (peek.panel.contains(target) || (target.matches(".mero-row-link") && region === peek.panel.parentElement))) {
      event.preventDefault();
      closePeek(true);
      return;
    }
    const popup = target.popoverTargetElement;
    if ((event.key === "ArrowDown" || event.key === "ArrowUp") && target.matches('[aria-haspopup="menu"][popovertarget]') &&
      popup?.matches('[role="menu"]:not(:popover-open)')) {
      event.preventDefault();
      if (event.key === "ArrowUp") menuFocusLast.add(popup);
      // A click keeps the implicit anchor that position-area uses.
      target.click();
      return;
    }
    const menu = target.matches(menuItemSelector) && target.closest('[popover][role="menu"]');
    if (menu) {
      const items = menuItems(menu);
      let next = step(target, items, event.key);
      if (!next && event.key.length === 1 && /\S/.test(event.key)) {
        // shortcut: single-key typeahead with no buffer; add a 500 ms buffer if menus get long
        const index = items.indexOf(target);
        next = [...items.slice(index + 1), ...items.slice(0, index + 1)]
          .find(item => item.textContent.trim().toLowerCase().startsWith(event.key.toLowerCase()));
      }
      if (next) {
        event.preventDefault();
        next.focus();
      } else if (event.key === " " && target.matches("a")) {
        event.preventDefault();
        target.click();
      } else if (event.key === "Tab") {
        // Let native Tab leave the menu, including when focus moves to browser chrome.
        tabbedMenus.add(menu);
        menu.hidePopover();
        menuButton(menu)?.focus();
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
      } else if (event.key === "Enter" && active && !list.hidden && !target.hasAttribute("data-mero-combo-pending")) {
        event.preventDefault();
        if (target.closest("[data-mero-command]")) active.click();
        else selectCombo(target, active);
      } else if (event.key === "ArrowUp" || event.key === "ArrowDown" ||
        (!list.hidden && target.closest("[data-mero-command]") && (event.key === "Home" || event.key === "End"))) {
        event.preventDefault();
        if (target.hasAttribute("data-mero-combo-pending")) return;
        if (target.closest("[data-mero-combo-remote]") && (target.hasAttribute("data-mero-combo-error") ||
          target.value !== displayedQueries.get(target))) {
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
      const query = currentQueries.get(input);
      if (query?.value === input.value && input.hasAttribute("data-mero-combo-pending")) return;
      currentQueries.delete(input);
      input.removeAttribute("data-mero-combo-dismissed");
      input.removeAttribute("data-mero-combo-error");
      // htmx's changed modifier suppresses the request if the user returns
      // to the same query before the debounce expires. Its results are still here.
      if (displayedQueries.get(input) === input.value) {
        input.removeAttribute("data-mero-combo-pending");
        input.removeAttribute("aria-busy");
        showComboResults(input);
        return;
      }
      input.setAttribute("data-mero-combo-pending", "");
      input.setAttribute("aria-busy", "true");
      comboStatus(input, msg("comboLoading"));
      setComboOpen(input, false);
    } else {
      filterCombo(input);
    }
  });

  // An open preview follows focus to another row of the same table.
  document.addEventListener("focusin", event => {
    const link = event.target.closest?.(".mero-row-link");
    if (peek && link && peekRegion(link) === peek.panel.parentElement && peekLink() !== link) showPeek(link);
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
      clearDialogToasts(event.target, false);
      returnFocus(event.target);
      if (!dialogClosed.delete(event.target)) emitDialogClose(event.target);
    }
  }, true);

  document.addEventListener("mero:toast", event => {
    if (event.detail?.message) toast(event.detail.message, event.detail);
  });

  // hx-params is Mero's own attribute: htmx 4 dropped it, and the collection markup uses it
  // to keep drafts out of a request. closest() inherits it without implicitInheritance.
  // config:request is the last point where the body is still a FormData, even for GET.
  document.addEventListener("htmx:config:request", event => {
    const body = event.detail.ctx.request.body;
    const params = event.target.closest?.("[hx-params]")?.getAttribute("hx-params");
    if (!params || params === "*" || !body) return;
    const not = params.startsWith("not ");
    const names = params === "none" ? [] : params.replace(/^not /, "").split(",").map(name => name.trim());
    for (const key of new Set(body.keys())) if (names.includes(key) === not) body.delete(key);
  });

  const swapTarget = ctx => typeof ctx.target === "string" ? document.querySelector(ctx.target) : ctx.target;
  const taskRequests = new WeakMap();

  document.addEventListener("htmx:before:request", event => {
    const { ctx } = event.detail;
    const elt = ctx.sourceElement;
    if (elt?.matches?.('[data-mero-combo-remote] [role="combobox"]')) {
      if (elt.hasAttribute("data-mero-combo-dismissed")) {
        event.preventDefault();
        return;
      }
      const query = { input: elt, value: elt.value };
      remoteQueries.set(ctx, query);
      currentQueries.set(elt, query);
      elt.setAttribute("data-mero-combo-pending", "");
      elt.setAttribute("aria-busy", "true");
      elt.removeAttribute("data-mero-combo-error");
      comboStatus(elt, msg("comboLoading"));
    }
  });

  document.addEventListener("htmx:before:swap", event => {
    const { ctx, tasks } = event.detail;
    for (const task of tasks) taskRequests.set(task, ctx);
    const query = remoteQueries.get(ctx);
    // htmx 4 would swap an error page into the list of suggestions.
    if (query) {
      if (!isCurrentQuery(query) || ctx.response?.status >= 400) event.preventDefault();
      else displayedQueries.delete(query.input);
    }
    const active = document.activeElement;
    const scope = active?.closest("[data-mero-scope]");
    if (scope && active.id && scopeAliases.has(scope) && !event.defaultPrevented && swapTarget(ctx)?.contains(active)) {
      for (const task of tasks) swappedFocus.set(task, { scope, id: active.id });
    }
  });

  document.addEventListener("htmx:finally:request", event => {
    const { ctx } = event.detail;
    const query = remoteQueries.get(ctx);
    if (!query || !isCurrentQuery(query) || (ctx.response && ctx.response.status < 400)) return;
    query.input.removeAttribute("data-mero-combo-pending");
    query.input.removeAttribute("aria-busy");
    query.input.setAttribute("data-mero-combo-error", "");
    setComboOpen(query.input, false);
    comboStatus(query.input, msg("comboError"), true);
  });

  document.addEventListener("htmx:after:settle", event => {
    const { task } = event.detail;
    // task.sourceElement stays the original opener; ctx.sourceElement moves to new content after an outerHTML swap.
    const opener = task.sourceElement;
    init(event.target, opener, remoteQueries.get(taskRequests.get(task)));
    const peeked = peek?.panel.parentElement;
    if (peek && (!peek.panel.isConnected || event.target.contains?.(peeked) || (peeked.contains(event.target) && !peek.panel.contains(event.target)))) refreshPeek();
    // HTMX restores focus before repeated fragment IDs receive their scoped names.
    const saved = swappedFocus.get(task);
    if (saved && document.activeElement === document.body) {
      const replacement = element(saved.id);
      if (replacement && saved.scope.contains(replacement)) replacement.focus({ preventScroll: true });
    }
    // The detached opener still answers closest() through its old subtree.
    const region = event.target.closest?.("[data-mero-restore-focus]");
    if (region && document.activeElement === document.body && opener?.closest?.("[data-mero-restore-focus]")) {
      // Some browsers leave pointer-activated links unfocused. Keep the triggering
      // control when its ID survives the swap, then use the designated fallback.
      if (opener.id) region.querySelector("#" + CSS.escape(opener.id))?.focus({ preventScroll: true });
      if (document.activeElement === document.body) region.querySelector("[data-mero-focus-fallback]")?.focus({ preventScroll: true });
    }
  });

  // data-mero-boost="#main" on a boosted container: the newest boosted GET wins, a response without the
  // region (and without an htmx redirect header) or a failed GET becomes a full page load, open
  // non-static dialogs such as a navigation drawer close, and focus moves to the new region.
  const boostRequests = new Set();
  const supersededBoosts = new WeakSet();
  const boostFocus = new WeakMap();
  const unswappedBoosts = new WeakSet();
  const boostRegion = ctx => ctx.request?.headers?.["HX-Boosted"] && ctx.sourceElement?.closest?.("[data-mero-boost]")?.getAttribute("data-mero-boost");
  const isGet = ctx => ctx.request.method.toUpperCase() === "GET";

  document.addEventListener("htmx:before:request", event => {
    const { ctx } = event.detail;
    if (event.defaultPrevented || !boostRegion(ctx)) return;
    boostFocus.set(ctx, document.activeElement);
    if (!isGet(ctx)) return;
    // Only navigations are aborted, never a boosted form that changes data.
    for (const older of boostRequests) {
      supersededBoosts.add(older);
      older.request.abort();
    }
    boostRequests.clear();
    boostRequests.add(ctx);
  });

  document.addEventListener("htmx:before:swap", event => {
    const { ctx } = event.detail;
    const selector = boostRegion(ctx);
    if (!selector || event.defaultPrevented) return;
    if (supersededBoosts.has(ctx)) {
      unswappedBoosts.add(ctx);
      return event.preventDefault();
    }
    const page = document.createElement("template");
    page.innerHTML = ctx.text ?? "";
    let found;
    try { found = page.content.querySelector(selector); } catch {}
    if (!found) {
      // A login page, an error page from a proxy or any other document: let the browser show it.
      event.preventDefault();
      unswappedBoosts.add(ctx);
      location.assign(ctx.response?.raw?.url || ctx.request.action);
      return;
    }
    const open = [...document.querySelectorAll("dialog[open]:not([data-mero-static], [role='alertdialog'])")];
    // Closing a dialog moves focus to its opener; that move is Mero's, not the person's.
    if (open.some(dialog => dialog.contains(boostFocus.get(ctx)))) boostFocus.set(ctx, null);
    for (const dialog of open) close(dialog);
  });

  document.addEventListener("htmx:finally:request", event => {
    const { ctx } = event.detail;
    if (!boostRequests.delete(ctx) || supersededBoosts.has(ctx)) return;
    // No response and not cancelled before sending: the network failed or timed out.
    if (!ctx.response && String(ctx.status).startsWith("error") && isGet(ctx)) location.assign(ctx.request.action);
  });

  // After htmx's [autofocus]. Focus that the person moved during the load stays where they put it.
  document.addEventListener("htmx:finally:swap", event => {
    const { ctx } = event.detail;
    const selector = boostRegion(ctx);
    const before = boostFocus.get(ctx);
    boostFocus.delete(ctx);
    if (!selector || unswappedBoosts.has(ctx)) return;
    const region = document.querySelector(selector);
    const active = document.activeElement;
    // null: focus was in a dialog Mero closed, so wherever the browser put it is not the person's choice.
    if (!region || region.contains(active) || (before !== null && active && active !== document.body && active !== before && active.isConnected)) return;
    if (!region.hasAttribute("tabindex")) region.tabIndex = -1;
    region.focus({ preventScroll: true });
  });

  // Focus continuity: when a swap or morph removes the focused element, focus would fall to <body>.
  // Mero puts it back on the same element, else the element with its ID, else the swapped region's
  // [data-mero-focus-fallback]. It only acts when focus was inside a swap target as the swap began and
  // is on <body> once every task has settled, so it never moves focus the person put somewhere else.
  const lostFocus = new WeakMap();
  const focusLost = () => !document.activeElement || document.activeElement === document.body;
  document.addEventListener("htmx:before:swap", event => {
    const { ctx, tasks } = event.detail;
    const active = document.activeElement;
    if (focusLost() || event.defaultPrevented) return;
    const targets = tasks.map(task => typeof task.target === "string" ? document.querySelector(task.target) : task.target)
      .filter(target => target?.contains(active) && !target.closest("[data-mero-focus-manual]"));
    if (targets.length) lostFocus.set(ctx, { element: active, id: active.id, targets });
  });
  // finally:swap follows every task's settle and htmx's own [autofocus], so both keep precedence.
  document.addEventListener("htmx:finally:swap", event => {
    const saved = lostFocus.get(event.detail.ctx);
    lostFocus.delete(event.detail.ctx);
    if (!saved || !focusLost()) return;
    const regions = saved.targets.map(target => target.isConnected ? target : target.id && document.getElementById(target.id)).filter(Boolean);
    const candidates = [saved.element, saved.id && document.getElementById(saved.id),
      ...regions.map(region => region.querySelector("[data-mero-focus-fallback]"))];
    for (const candidate of candidates) {
      if (!candidate?.isConnected || !candidate.getClientRects().length) continue;
      candidate.focus({ preventScroll: true });
      if (document.activeElement === candidate) return;
    }
  });

  const focusStore = () => "mero-focus:" + location.pathname + location.search;
  // The key is per URL, not per history entry, so every visit consumes it and only a traversal applies it.
  function restoreFocus(apply = true) {
    let key;
    try { key = sessionStorage.getItem(focusStore()); sessionStorage.removeItem(focusStore()); } catch {}
    if (!apply || !key || (document.activeElement && document.activeElement !== document.body)) return;
    // shortcut: the first matching href in the document wins; keep row hrefs unique per page.
    [...document.querySelectorAll("[data-mero-restore-focus] a[href]")].find(a => a.getAttribute("href") === key)?.focus();
  }
  addEventListener("pageshow", event => {
    restoreFocus(event.persisted || performance.getEntriesByType("navigation")[0]?.type === "back_forward");
  });
  // htmx 4 restores inside a Navigation API transition. The browser resets focus
  // and scroll when that ends, so the restore has to run afterwards.
  document.addEventListener("htmx:after:swap", event => {
    if (!event.detail.ctx.request?.headers?.["HX-History-Restore-Request"]) return;
    const done = () => restoreFocus();
    (window.navigation?.transition?.finished ?? Promise.resolve()).then(done, done);
  });

  document.addEventListener("htmx:before:cleanup", event => {
    visibleTooltips.delete(event.target);
  });

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", () => init(), { once: true });
  } else {
    init();
  }

  function configure({ messages, locale, dialogBackdrop } = {}) {
    if (messages && typeof messages === "object") Object.assign(config.messages, messages);
    if (locale !== undefined) {
      config.locale = locale ? String(locale) : null;
      localizeTimes();
    }
    if (dialogBackdrop === "all" || dialogBackdrop === "mero-only") config.dialogBackdrop = dialogBackdrop;
    return Object.freeze({
      locale: config.locale,
      dialogBackdrop: config.dialogBackdrop,
      messages: Object.freeze({ ...defaultMessages, ...config.messages }),
    });
  }

  window.MeroUI = Object.freeze({ open, close, toast, init, cleanup, configure });
})();
