(() => {
  "use strict";

  const buttonSelector = "button:not(:disabled), a[href]";
  const closers = new WeakMap();
  const uploadFiles = new WeakMap();
  let activeMenu = null;

  function openDialog(container, opener) {
    const dialog = container.querySelector("dialog");
    if (!dialog || dialog.open) return;
    closers.set(dialog, opener);
    dialog.showModal();
    const search = dialog.querySelector('input[type="search"]');
    if (search) {
      search.value = "";
      filterItems(dialog);
      search.focus();
    }
  }

  function matchingButtons(dialog) {
    const items = dialog.querySelector(".rlw-command-items, .rlw-emoji-grid");
    return items ? [...items.querySelectorAll(buttonSelector)].filter(button => !button.hidden) : [];
  }

  function filterItems(dialog) {
    const search = dialog.querySelector('input[type="search"]');
    const list = dialog.querySelector(".rlw-command-items, .rlw-emoji-grid");
    if (!search || !list) return;
    const query = search.value.trim().toLocaleLowerCase();
    for (const item of list.querySelectorAll(buttonSelector)) {
      const name = item.getAttribute("aria-label") || item.textContent;
      item.hidden = !name.toLocaleLowerCase().includes(query);
    }
    dialog.querySelector(".rlw-command-empty").hidden = matchingButtons(dialog).length > 0;
  }

  function showMenu(component, opener, point) {
    closeMenu(false);
    const menu = component.querySelector('[role="menu"]');
    const button = component.querySelector("[data-rlw-context-open]");
    menu.hidden = false;
    const bounds = opener.getBoundingClientRect();
    menu.style.left = Math.max(4, Math.min(point?.x ?? bounds.left, window.innerWidth - menu.offsetWidth - 4)) + "px";
    menu.style.top = Math.max(4, Math.min(point?.y ?? bounds.bottom, window.innerHeight - menu.offsetHeight - 4)) + "px";
    button.setAttribute("aria-expanded", "true");
    activeMenu = { menu, opener, button };
    menu.querySelector('[role="menuitem"]').focus();
  }

  function closeMenu(restore = true) {
    if (!activeMenu) return;
    const { menu, opener, button } = activeMenu;
    activeMenu = null;
    menu.hidden = true;
    button.setAttribute("aria-expanded", "false");
    if (restore && opener.isConnected) opener.focus({ preventScroll:true });
  }

  function updateStepper(field) {
    const input = field.querySelector('input[type="number"]');
    field.querySelector('[data-step="-1"]').disabled = input.disabled || (input.min !== "" && input.valueAsNumber <= Number(input.min));
    field.querySelector('[data-step="1"]').disabled = input.disabled || (input.max !== "" && input.valueAsNumber >= Number(input.max));
  }

  function wizardIndex(wizard) {
    return [...wizard.querySelectorAll(":scope > section")].findIndex(panel => !panel.hidden);
  }

  function moveWizard(wizard, delta) {
    const panels = [...wizard.querySelectorAll(":scope > section")];
    const current = wizardIndex(wizard);
    const next = current + delta;
    if (next < 0 || next >= panels.length) return;
    if (delta > 0) {
      for (const field of panels[current].querySelectorAll("input, select, textarea")) {
        if (!field.reportValidity()) return;
      }
    }
    panels.forEach((panel, index) => { panel.hidden = index !== next; });
    wizard.querySelectorAll("ol li").forEach((label, index) => {
      if (index === next) label.setAttribute("aria-current", "step");
      else label.removeAttribute("aria-current");
    });
    wizard.querySelector("[data-rlw-back]").hidden = next === 0;
    wizard.querySelector("[data-rlw-next]").hidden = next === panels.length - 1;
    wizard.querySelector("[data-rlw-finish]").hidden = next !== panels.length - 1;
    wizard.querySelector("[data-rlw-review]").textContent = wizard.elements.project.value + " · " + wizard.elements.access.value;
    wizard.querySelector("output").textContent = "";
    panels[next].querySelector("h2").focus();
  }

  function setSplit(split, value) {
    const handle = split.querySelector('[role="separator"]');
    const percent = Math.min(+handle.ariaValueMax, Math.max(+handle.ariaValueMin, Math.round(value)));
    split.style.setProperty("--rlw-first", percent + "%");
    handle.ariaValueNow = String(percent);
  }

  function pointerPercent(event, split) {
    const box = split.getBoundingClientRect();
    const rtl = getComputedStyle(split).direction === "rtl";
    return 100 * (rtl ? box.right - event.clientX : event.clientX - box.left) / box.width;
  }

  const snapSplits = new WeakMap();
  const namedPreferences = new Map();
  const snapRadius = 10;
  const escapeRadius = 16;
  const maxSamples = 32;
  let resizing = null;

  // Score actual stopping positions. Three nearby recent releases carry enough
  // weight to establish a point, while an isolated release cannot establish one.
  function learnedPoint(samples, previous) {
    let best = null;
    let bestScore = 2;
    for (const center of samples) {
      let score = 0, total = 0;
      samples.forEach((width, index) => {
        const proximity = Math.max(0, 1 - Math.abs(width - center) / 24);
        const weight = proximity * 0.5 ** ((samples.length - 1 - index) / 5);
        score += weight;
        total += weight * width;
      });
      if (score > bestScore) {
        best = Math.round(total / score);
        bestScore = score;
      }
    }
    if (best !== null && previous !== null && Math.abs(best - previous) <= snapRadius) return previous;
    return best;
  }

  function splitPreference(key) {
    if (key && namedPreferences.has(key)) return namedPreferences.get(key);
    const preference = { width: null, samples: [], point: null };
    if (key) {
      try {
        const saved = JSON.parse(sessionStorage.getItem("mero.split." + key));
        if (saved?.width > 0 && Number.isFinite(saved.width)) preference.width = saved.width;
        if (Array.isArray(saved?.samples)) preference.samples = saved.samples.slice(-maxSamples).filter(n => Number.isFinite(n) && n > 0);
        preference.point = learnedPoint(preference.samples, null);
      } catch { /* Private browsing or invalid stored data. */ }
      namedPreferences.set(key, preference);
    }
    return preference;
  }

  function saveSplit(state, learn) {
    const pref = state.preference;
    pref.width = state.width;
    if (learn) {
      pref.samples.push(Math.round(state.width));
      if (pref.samples.length > maxSamples) pref.samples.shift();
      pref.point = learnedPoint(pref.samples, pref.point);
    }
    if (state.key) {
      try { sessionStorage.setItem("mero.split." + state.key, JSON.stringify({ width: pref.width, samples: pref.samples })); } catch {}
    }
  }

  function setSnapWidth(state, width) {
    if (!state.available) return;
    const { handle, available } = state;
    const min = available * Number(handle.ariaValueMin) / 100;
    const max = available * Number(handle.ariaValueMax) / 100;
    state.width = Math.max(min, Math.min(max, width));
    state.split.style.setProperty("--rlw-first", state.width + "px");
    handle.ariaValueNow = String(Math.round(100 * state.width / available));
    handle.setAttribute("aria-valuetext", Math.round(state.width) + " pixels");
    handle.dataset.rlwWidth = Math.round(state.width) + " px";
  }

  function initSnapSplit(split) {
    if (snapSplits.has(split)) return;
    const handle = split.querySelector(":scope > .rlw-split-handle[role=separator]");
    if (!handle) return;
    const key = split.dataset.rlwSnapKey;
    const state = { split, handle, key, preference: splitPreference(key), initial: Number(handle.getAttribute("aria-valuenow")), available: 0 };
    snapSplits.set(split, state);
    split.setAttribute("data-rlw-split-ready", "");
    delete handle.dataset.rlwDragging;
    delete handle.dataset.rlwSnapped;
    function fit(width) {
      if (width === state.available) return;
      state.available = width;
      setSnapWidth(state, state.preference.width ?? width * state.initial / 100);
    }
    const style = getComputedStyle(split);
    fit(split.clientWidth - parseFloat(style.paddingLeft) - parseFloat(style.paddingRight));
    state.observer = new ResizeObserver(([entry]) => fit(entry.contentRect.width));
    state.observer.observe(split);
  }

  function beginResize(state, event) {
    const { split, handle } = state;
    const bounds = split.getBoundingClientRect();
    if (!state.available || !bounds.width || resizing) return false;
    const direction = getComputedStyle(split).direction === "rtl" ? -1 : 1;
    resizing = {
      state, pointer: event.pointerId, originX: event.clientX, x: event.clientX, originWidth: state.width,
      scale: direction * split.offsetWidth / bounds.width, moved: false, unlocked: false, timer: null,
    };
    handle.dataset.rlwDragging = "";
    return true;
  }

  function moveResize(drag, clientX) {
    if (drag.x === clientX) return;
    drag.x = clientX;
    drag.moved = true;
    const { state } = drag;
    const { handle, preference } = state;
    const width = drag.originWidth + (clientX - drag.originX) * drag.scale;
    const point = preference.point;
    const distance = Math.abs(width - point);
    clearTimeout(drag.timer);
    if (distance > escapeRadius) drag.unlocked = false;
    const inBounds = point !== null && point >= state.available * +handle.ariaValueMin / 100 && point <= state.available * +handle.ariaValueMax / 100;
    const radius = handle.hasAttribute("data-rlw-snapped") ? escapeRadius : snapRadius;
    if (!drag.unlocked && inBounds && distance <= radius) {
      setSnapWidth(state, point);
      handle.dataset.rlwSnapped = "";
      drag.timer = setTimeout(() => {
        delete handle.dataset.rlwSnapped;
        // Use the settled edge as the new origin so pausing never jumps the panel.
        drag.originWidth = state.width;
        drag.originX = drag.x;
        drag.unlocked = true;
      }, 320);
    } else {
      delete handle.dataset.rlwSnapped;
      setSnapWidth(state, width);
    }
  }

  function finishResize(commit) {
    const drag = resizing;
    if (!drag) return;
    resizing = null;
    clearTimeout(drag.timer);
    const { state } = drag;
    delete state.handle.dataset.rlwDragging;
    delete state.handle.dataset.rlwSnapped;
    if (commit && drag.moved) saveSplit(state, true);
    else setSnapWidth(state, state.preference.width ?? state.available * state.initial / 100);
  }

  function textRuns(editor) {
    const runs = [];
    function append(text, bold, italic) {
      if (!text) return;
      const last = runs.at(-1);
      if (last && last.bold === bold && last.italic === italic) last.text += text;
      else runs.push({ text, bold, italic });
    }
    function walk(node, bold, italic) {
      if (node.nodeType === Node.TEXT_NODE) return append(node.textContent, bold, italic);
      if (!(node instanceof Element)) return;
      if (node.tagName === "BR") return append("\n", bold, italic);
      if (["P","DIV"].includes(node.tagName) && node.previousSibling) append("\n", bold, italic);
      const isBold = bold || node.matches("b,strong") || ["bold","700"].includes(node.style.fontWeight);
      const isItalic = italic || node.matches("i,em") || node.style.fontStyle === "italic";
      node.childNodes.forEach(child => walk(child, isBold, isItalic));
    }
    editor.childNodes.forEach(child => walk(child, false, false));
    return runs;
  }

  function syncEditor(editor) {
    const form = editor.closest("[data-rlw-editor]");
    const runs = textRuns(editor);
    form.elements.runs.value = JSON.stringify(runs);
    form.elements.body.value = runs.map(run => run.text).join("");
  }

  function initEditor(form) {
    const textarea = form.querySelector("textarea");
    if (!textarea || textarea.matches(":disabled, [readonly]") || form.querySelector(".rlw-writing")) return;
    const editor = document.createElement("div");
    editor.className = "rlw-writing";
    editor.contentEditable = "true";
    editor.setAttribute("role", "textbox");
    editor.setAttribute("aria-multiline", "true");
    editor.setAttribute("aria-label", textarea.getAttribute("aria-label"));
    editor.textContent = textarea.value;
    const runs = document.createElement("input");
    runs.type = "hidden";
    runs.name = "runs";
    textarea.after(editor, runs);
    textarea.hidden = true;
    form.querySelector(".rlw-editor-tools").hidden = false;
    syncEditor(editor);
  }

  function init(root) {
    if (!(root instanceof Element || root instanceof Document)) return;
    const splitSelector = "[data-rlw-split][data-rlw-snap]";
    if (root.matches?.(splitSelector)) initSnapSplit(root);
    root.querySelectorAll(splitSelector).forEach(initSnapSplit);
    if (root.matches?.("[data-rlw-editor]")) initEditor(root);
    root.querySelectorAll("[data-rlw-editor]").forEach(initEditor);
    if (root.matches?.("[data-rlw-number]")) updateStepper(root);
    root.querySelectorAll("[data-rlw-number]").forEach(updateStepper);
  }

  function toggleFormat(button) {
    const form = button.closest("[data-rlw-editor]");
    const editor = form.querySelector(".rlw-writing");
    editor.focus();
    // Native editing commands retain the browser's text selection and undo history.
    document.execCommand(button.dataset.format, false, null);
    syncEditor(editor);
    form.querySelectorAll("[data-format]").forEach(item => {
      item.setAttribute("aria-pressed", String(document.queryCommandState(item.dataset.format)));
    });
  }

  document.addEventListener("selectionchange", () => {
    const editor = document.activeElement?.closest(".rlw-writing");
    if (!editor) return;
    editor.parentElement.querySelectorAll("[data-format]").forEach(item => {
      item.setAttribute("aria-pressed", String(document.queryCommandState(item.dataset.format)));
    });
  });
  document.addEventListener("pointerdown", event => {
    if (event.target.closest("[data-rlw-editor] [data-format]")) event.preventDefault();
    if (activeMenu && !activeMenu.menu.parentElement?.contains(event.target)) closeMenu(false);
    const handle = event.target.closest(".rlw-split-handle");
    if (!handle || event.button !== 0 || !event.isPrimary) return;
    const state = snapSplits.get(handle.closest("[data-rlw-split]"));
    if (state && !beginResize(state, event)) return;
    handle.focus({ preventScroll: true });
    handle.setPointerCapture(event.pointerId);
    event.preventDefault();
  });
  document.addEventListener("pointermove", event => {
    const handle = event.target.closest(".rlw-split-handle");
    if (!handle?.hasPointerCapture(event.pointerId)) return;
    const split = handle.closest("[data-rlw-split]");
    if (resizing?.state.split === split && resizing.pointer === event.pointerId) moveResize(resizing, event.clientX);
    else if (!snapSplits.has(split)) setSplit(split, pointerPercent(event, split));
  });
  document.addEventListener("pointerup", event => {
    if (resizing?.pointer !== event.pointerId) return;
    moveResize(resizing, event.clientX);
    finishResize(true);
  });
  for (const type of ["pointercancel", "lostpointercapture"]) {
    document.addEventListener(type, event => {
      if (resizing?.pointer === event.pointerId) finishResize(false);
    });
  }
  document.addEventListener("paste", event => {
    if (!event.target.closest(".rlw-writing")) return;
    event.preventDefault();
    document.execCommand("insertText", false, event.clipboardData?.getData("text/plain") || "");
  });
  document.addEventListener("drop", event => {
    if (event.target.closest(".rlw-writing")) event.preventDefault();
    event.target.closest(".rlw-drop")?.removeAttribute("data-dragging");
  });
  document.addEventListener("dragenter", event => { event.target.closest(".rlw-drop")?.setAttribute("data-dragging", ""); });
  document.addEventListener("dragleave", event => {
    const zone = event.target.closest(".rlw-drop");
    if (zone && !zone.contains(event.relatedTarget)) zone.removeAttribute("data-dragging");
  });
  document.addEventListener("input", event => {
    const target = event.target;
    if (target.closest("[data-rlw-number]")) updateStepper(target.closest("[data-rlw-number]"));
    const editor = target.closest(".rlw-writing");
    if (editor) syncEditor(editor);
    if (target.matches('.rlw-command input[type="search"], .rlw-emoji input[type="search"]')) filterItems(target.closest("dialog"));
  });
  document.addEventListener("change", event => {
    if (event.target.matches("[data-rlw-upload] input[type=file]")) {
      const form = event.target.closest("form");
      const filename = form.querySelector(".rlw-file-name");
      if (filename) filename.textContent = event.target.files[0]?.name || "";
      form.querySelector("output").textContent = "";
    }
  });
  document.addEventListener("click", async event => {
    const target = event.target;
    if (target.closest("[data-rlw-open]")) {
      const opener = target.closest("[data-rlw-open]");
      openDialog(opener.closest("[data-rlw-shell],[data-rlw-command],[data-rlw-emoji]"), opener);
    }
    const step = target.closest("[data-rlw-number] [data-step]");
    if (step) {
      const field = step.closest("[data-rlw-number]");
      const input = field.querySelector("input");
      if (step.dataset.step === "1") input.stepUp();
      else input.stepDown();
      input.dispatchEvent(new Event("input", { bubbles:true }));
      input.dispatchEvent(new Event("change", { bubbles:true }));
    }
    const copy = target.closest("[data-command-copy]");
    if (copy) {
      const output = copy.closest("[data-rlw-command]").querySelector("output");
      try { await navigator.clipboard.writeText(location.href); output.textContent = "Page link copied."; }
      catch { output.textContent = "Page link: " + location.href; }
      copy.closest("dialog").close();
    }
    const contextButton = target.closest("[data-rlw-context-open]");
    if (contextButton) {
      if (activeMenu?.button === contextButton) closeMenu();
      else showMenu(contextButton.closest("[data-rlw-context]"), contextButton);
    }
    const pin = target.closest("[data-rlw-action=pin]");
    if (pin) {
      const pinned = pin.getAttribute("data-pinned") !== "true";
      pin.dataset.pinned = String(pinned);
      pin.textContent = pinned ? "Unpin document" : "Pin document";
      pin.closest("[data-rlw-context]").querySelector("output").textContent = pinned ? "Document pinned" : "Document unpinned";
      closeMenu();
    }
    const format = target.closest("[data-rlw-editor] [data-format]");
    if (format) toggleFormat(format);
    const wizard = target.closest("[data-rlw-wizard]");
    if (wizard && target.closest("[data-rlw-next],[data-rlw-back]")) moveWizard(wizard, target.closest("[data-rlw-back]") ? -1 : 1);
    const emoji = target.closest(".rlw-emoji-grid button");
    if (emoji) {
      const root = emoji.closest("[data-rlw-emoji]");
      const input = root.querySelector('input[type="hidden"]');
      input.value = emoji.textContent;
      input.dispatchEvent(new Event("change",{bubbles:true}));
      root.querySelector("output").textContent = emoji.textContent + " " + emoji.getAttribute("aria-label");
      root.querySelectorAll(".rlw-emoji-grid button").forEach(item => item.setAttribute("aria-pressed",String(item === emoji)));
      emoji.closest("dialog").close();
    }
  });
  document.addEventListener("contextmenu", event => {
    const row = event.target.closest(".rlw-context-row");
    if (!row) return;
    event.preventDefault();
    showMenu(row.closest("[data-rlw-context]"),row,{x:event.clientX,y:event.clientY});
  });
  document.addEventListener("keydown", event => {
    if (event.isComposing) return;
    const target = event.target;
    const key = event.key;
    if ((event.metaKey || event.ctrlKey) && key.toLowerCase() === "k" && !event.altKey) {
      const triggers = document.querySelectorAll("[data-rlw-command] [data-rlw-open]");
      const trigger = target.closest("[data-rlw-command]")?.querySelector("[data-rlw-open]") ||
        [...triggers].find(button => button.checkVisibility({ visibilityProperty:true }) && !button.closest("[inert]"));
      if (trigger && !document.querySelector("dialog[open]")) {
        event.preventDefault();
        event.stopImmediatePropagation();
        const origin = document.activeElement;
        openDialog(trigger.closest("[data-rlw-command]"), origin && origin !== document.body ? origin : trigger);
      }
      return;
    }
    const row = target.closest(".rlw-context-row");
    if (row && (key === "ContextMenu" || (event.shiftKey && key === "F10"))) {
      event.preventDefault();
      showMenu(row.closest("[data-rlw-context]"),row);
      return;
    }
    if (activeMenu?.menu.contains(target)) {
      if (key === "Escape" || key === "Tab") {
        if (key === "Escape") event.preventDefault();
        closeMenu();
      } else moveFocus(event,[...activeMenu.menu.querySelectorAll('[role="menuitem"]')]);
      return;
    }
    const dialog = target.closest(".rlw-command-dialog, .rlw-emoji dialog");
    if (dialog) {
      const buttons = matchingButtons(dialog);
      if (key === "Enter" && target.type === "search" && buttons[0]) {
        event.preventDefault();
        buttons[0].click();
      } else {
        const grid = dialog.querySelector(".rlw-emoji-grid");
        if (grid && grid.contains(target)) moveEmojiFocus(event,buttons,grid);
        else moveFocus(event,buttons);
      }
      return;
    }
    const split = target.closest("[data-rlw-split]");
    if (split && target.matches('[role="separator"]')) {
      const rtl = getComputedStyle(split).direction === "rtl";
      const increment = (event.shiftKey ? 10 : 2) * (rtl ? -1 : 1);
      const state = snapSplits.get(split);
      if (state && ["ArrowLeft", "ArrowRight", "Home", "End"].includes(key)) {
        event.preventDefault();
        if (resizing?.state === state) return;
        const step = (event.shiftKey ? 10 : 1) * (rtl ? -1 : 1);
        const widths = { ArrowLeft: state.width - step, ArrowRight: state.width + step,
          Home: state.available * +target.ariaValueMin / 100, End: state.available * +target.ariaValueMax / 100 };
        setSnapWidth(state, widths[key]);
        saveSplit(state, false);
        return;
      }
      const current = +target.ariaValueNow;
      const values = { ArrowLeft:current-increment, ArrowRight:current+increment, Home:+target.ariaValueMin, End:+target.ariaValueMax };
      if (Object.hasOwn(values,key)) { event.preventDefault(); setSplit(split,values[key]); }
    }
    const wizard = target.closest("[data-rlw-wizard]");
    if (wizard && key === "Enter" && target.matches("input") && !wizard.querySelector("[data-rlw-next]").hidden) {
      event.preventDefault();
      moveWizard(wizard,1);
    }
  }, true);

  function moveFocus(event,buttons) {
    const isSearch = event.target.type === "search";
    if (!buttons.length || (isSearch && !["ArrowDown","ArrowUp"].includes(event.key))) return;
    const index = buttons.indexOf(event.target);
    let next;
    if (event.key === "ArrowDown") next = (index+1) % buttons.length;
    else if (event.key === "ArrowUp") next = index < 0 ? buttons.length-1 : (index-1+buttons.length) % buttons.length;
    else if (event.key === "Home") next = 0;
    else if (event.key === "End") next = buttons.length-1;
    else return;
    event.preventDefault();
    buttons[next].focus();
  }

  function moveEmojiFocus(event, buttons, grid) {
    const index = buttons.indexOf(event.target);
    const style = getComputedStyle(grid);
    const columns = style.gridTemplateColumns.split(" ").length;
    const forward = style.direction === "rtl" ? -1 : 1;
    const destinations = {
      ArrowLeft: index - forward, ArrowRight: index + forward,
      ArrowUp: index - columns, ArrowDown: index + columns,
      Home: 0, End: buttons.length - 1,
    };
    if (!Object.hasOwn(destinations,event.key)) return;
    event.preventDefault();
    buttons[destinations[event.key]]?.focus();
  }

  document.addEventListener("close", event => {
    const opener = closers.get(event.target);
    if (opener?.isConnected) opener.focus({ preventScroll:true });
    closers.delete(event.target);
  }, true);
  document.addEventListener("focusin", event => {
    if (activeMenu && !activeMenu.menu.parentElement?.contains(event.target)) closeMenu(false);
  });
  window.addEventListener("resize", () => closeMenu());
  document.addEventListener("scroll", event => {
    if (activeMenu && !activeMenu.menu.contains(event.target)) closeMenu();
  }, { capture:true, passive:true });
  document.addEventListener("htmx:beforeCleanupElement", event => {
    if (activeMenu && event.target.contains(activeMenu.menu)) closeMenu(false);
    const state = snapSplits.get(event.target);
    if (!state) return;
    if (resizing?.state === state) finishResize(false);
    state.observer.disconnect();
    snapSplits.delete(event.target);
  });
  document.addEventListener("htmx:beforeRequest", event => {
    const form = event.detail.elt.closest("[data-rlw-upload]");
    if (form) uploadFiles.set(event.detail.xhr, form.elements.photo.files[0]);
  });
  function staleUpload(form, xhr) {
    return form.matches("[data-rlw-upload]") && uploadFiles.has(xhr) && form.elements.photo.files[0] !== uploadFiles.get(xhr);
  }
  document.addEventListener("htmx:beforeSwap", event => {
    const form = event.detail.requestConfig?.elt?.closest("form");
    if (!form?.matches("[data-rlw-upload],[data-rlw-editor],[data-rlw-wizard],.rlw-cell")) return;
    if (staleUpload(form,event.detail.xhr)) {
      event.detail.shouldSwap = false;
      event.detail.isError = false;
      return;
    }
    if ([413,422].includes(event.detail.xhr.status)) {
      event.detail.shouldSwap = true;
      event.detail.isError = false;
    }
  });
  document.addEventListener("htmx:afterRequest", event => {
    const form = event.detail.requestConfig?.elt?.closest("form");
    if (!form?.matches("[data-rlw-upload],[data-rlw-editor],[data-rlw-wizard],.rlw-cell,.rlw-filter")) return;
    if (staleUpload(form,event.detail.xhr)) return;
    if (event.detail.failed && ![413,422].includes(event.detail.xhr.status)) {
      form.querySelector("output").textContent = "Request failed. Check the connection and try again.";
    }
  });
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", () => init(document), { once:true });
  else init(document);
  document.addEventListener("htmx:load", event => init(event.detail.elt));
})();
