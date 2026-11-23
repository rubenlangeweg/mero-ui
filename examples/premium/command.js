(() => {
  const scope = document.querySelector("#cmd-work");
  if (!scope) return;
  const dialog = scope.querySelector("#cmd-dialog");
  const input = scope.querySelector("#cmd-search");
  const list = scope.querySelector("#cmd-options");
  const stage = scope.querySelector("#cmd-step");
  const back = scope.querySelector("#cmd-back");
  const form = scope.querySelector("#cmd-assign-form");
  const error = scope.querySelector("#cmd-error");
  let saving = false;
  let shortcutOpener = null;
  const selectedCount = () => scope.querySelectorAll('input[name="record"]:checked').length;

  function syncSelection() {
    const count = selectedCount();
    const all = scope.querySelector("#cmd-all");
    const total = scope.querySelectorAll('input[name="record"]').length;
    all.checked = count === total;
    all.indeterminate = count > 0 && count < total;
    scope.querySelector("#cmd-count").textContent = count + " selected";
    scope.querySelector("#cmd-context").textContent = count + (count === 1 ? " record selected" : " records selected");
    if (/Mac|iPhone|iPad/.test(navigator.platform)) scope.querySelector("[data-cmd-shortcut]").textContent = "⌘ K";
  }
  function setStep(step, request = true) {
    stage.value = step;
    const assign = step === "assignee";
    scope.querySelector("#cmd-heading").textContent = assign ? "Assign to teammate" : "Run a command";
    back.hidden = !assign;
    input.placeholder = assign ? "Search teammates…" : "Search commands…";
    list.hidden = true;
    list.replaceChildren();
    input.value = "";
    input.removeAttribute("aria-activedescendant");
    input.removeAttribute("data-mero-combo-dismissed");
    input.setAttribute("aria-expanded", "false");
    error.textContent = "";
    if (request) {
      input.focus();
      input.dispatchEvent(new CustomEvent("mero:query", { bubbles: true }));
    }
  }
  scope.addEventListener("change", event => {
    if (event.target.id === "cmd-all") {
      scope.querySelectorAll('input[name="record"]').forEach(box => { box.checked = event.target.checked; });
    }
    if (event.target.id === "cmd-all" || event.target.name === "record") syncSelection();
  });
  // Mero owns focus, arrow keys, activation and request freshness. Choices advance this dialog.
  dialog.addEventListener("click", event => {
    const option = event.target.closest("[data-cmd-choice]");
    if (!option) return;
    event.stopPropagation();
    if (saving || list.hidden || input.hasAttribute("data-mero-combo-pending")) return;
    if (stage.value === "action") {
      setStep("assignee");
      return;
    }
    saving = true;
    dialog.setAttribute("aria-busy", "true");
    scope.querySelector("#cmd-assignee").value = option.dataset.cmdChoice;
    form.requestSubmit();
  });
  dialog.addEventListener("keydown", event => {
    if (!event.isComposing && event.target === input && event.key === "Backspace" && !input.value && stage.value === "assignee" && !saving) {
      event.preventDefault();
      setStep("action");
    }
  });
  back.addEventListener("click", () => { if (!saving) setStep("action"); });
  dialog.addEventListener("close", () => { if (!saving) setStep("action", false); });
  // The assignment response replaces the table, including the original opener.
  document.addEventListener("focusin", event => {
    if (dialog.open || !scope.contains(event.target)) return;
    shortcutOpener = event.target.matches('[name="record"]') ? event.target.value : event.target.id || null;
  });
  document.addEventListener("cmd:assigned", () => {
    saving = false;
    dialog.removeAttribute("aria-busy");
    const returnTo = [...scope.querySelectorAll('[name="record"]')].find(box => box.value === shortcutOpener)
      || (shortcutOpener && document.getElementById(shortcutOpener)) || scope.querySelector("#cmd-launch");
    window.MeroUI.close(dialog, { focus: returnTo });
    syncSelection();
    returnTo.focus();
  });
  form.addEventListener("htmx:before:swap", event => {
    if (event.detail.ctx.response?.raw?.status >= 400) event.preventDefault();
  });
  form.addEventListener("htmx:finally:request", event => {
    if (event.detail.ctx.response?.raw?.ok) return;
    saving = false;
    dialog.removeAttribute("aria-busy");
    error.textContent = "Assignment could not be confirmed. Retry to assign these records to the same teammate.";
  });
  syncSelection();
})();
