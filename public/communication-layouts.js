(() => {
  const unsavedDrafts = new Map();

  function draftKey(frame, conversation) {
    return `mero:draft:${frame.dataset.draftScope}:${frame.dataset.communication}:${conversation}`;
  }
  function readDraft(key) {
    if (unsavedDrafts.has(key)) return unsavedDrafts.get(key);
    try { return sessionStorage.getItem(key); } catch { return null; }
  }
  function saveDraft(key, text) {
    try {
      if (text) sessionStorage.setItem(key, text);
      else sessionStorage.removeItem(key);
      unsavedDrafts.delete(key);
    } catch {
      // Navigation within the demo still keeps drafts when browser storage is unavailable.
      unsavedDrafts.set(key, text);
    }
  }
  function prepare(frame, swapped) {
    const form = frame.querySelector("[data-comm-compose]");
    if (form) {
      const draft = readDraft(draftKey(frame, form.dataset.commCompose));
      if (draft !== null) form.elements.message.value = draft;
    }
    for (const marker of frame.querySelectorAll("[data-comm-draft-for]")) {
      marker.hidden = !readDraft(draftKey(frame, marker.dataset.commDraftFor))?.trim();
    }
    const feed = frame.querySelector(".comm-feed");
    if (feed) feed.scrollTop = feed.scrollHeight;
    if (!swapped || !frame.dataset.commFocus || frame.contains(document.activeElement)) return;
    const focus = {
      heading: "[data-comm-heading]",
      composer: "textarea",
      list: ".comm-folders [aria-current], .comm-room-link[aria-current]",
    }[frame.dataset.commFocus];
    const control = focus && frame.querySelector(focus);
    if (control?.getClientRects().length) control.focus({preventScroll:true});
  }
  document.addEventListener("input", event => {
    const field = event.target;
    if (!field.matches("[data-comm-compose] textarea[name=message]")) return;
    const frame = field.closest("[data-communication]");
    const id = field.form.dataset.commCompose;
    saveDraft(draftKey(frame, id), field.value);
    const marker = frame.querySelector(`[data-comm-draft-for="${CSS.escape(id)}"]`);
    if (marker) marker.hidden = !field.value.trim();
  });
  document.addEventListener("htmx:before:swap", event => {
    const { ctx } = event.detail;
    const form = ctx.sourceElement;
    if (ctx.response?.status !== 200 || !form?.matches?.("form[data-comm-compose]")) return;
    const key = draftKey(form.closest("[data-communication]"), form.dataset.commCompose);
    if (readDraft(key) === ctx.request?.body?.get("message")) saveDraft(key, "");
  });
  function restoreFrames() {
    for (const frame of document.querySelectorAll("[data-communication]")) prepare(frame, false);
  }
  restoreFrames();
  // htmx 4 restores history inside a Navigation API transition; the browser resets focus when it ends.
  document.addEventListener("htmx:after:swap", event => {
    if (event.detail.ctx.request?.headers?.["HX-History-Restore-Request"]) (window.navigation?.transition?.finished ?? Promise.resolve()).then(restoreFrames, restoreFrames);
  });
  document.addEventListener("htmx:after:settle", event => {
    if (event.target.matches?.("[data-communication]")) prepare(event.target, true);
  });
})();
