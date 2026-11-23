(() => {
  const board = document.getElementById("planning-board");
  if (!board) return;
  const form = board.querySelector("#board-form");
  const dialog = board.querySelector("dialog");
  const reader = board.querySelector("#board-reader");
  const connection = board.querySelector("#board-connection");
  const feedback = board.querySelector("#board-feedback");
  let drag = null;
  let source;
  let revision = Number(board.dataset.revision);
  let requestedRevision = revision;
  let submitting = false;
  const focusForRequest = new WeakMap();

  function stage(card) {
    form.elements.id.value = card.dataset.boardCard;
    form.elements.version.value = card.dataset.version;
    form.elements.lane.value = card.dataset.lane;
    board.querySelector("#board-dialog-card").textContent = card.querySelector("button").textContent;
  }

  function focusCard(id) {
    document.getElementById("board-move-" + id)?.focus({preventScroll:true});
  }

  board.addEventListener("click", event => {
    const button = event.target.closest("[data-board-move]");
    if (!button || submitting) return;
    stage(button.closest("[data-board-card]"));
    dialog.showModal();
    form.querySelector(":checked")?.focus();
  });

  dialog.addEventListener("close", () => focusCard(form.elements.id.value));
  board.querySelector("#board-cancel").addEventListener("click", () => dialog.close());
  board.addEventListener("dragstart", event => {
    const card = event.target.closest("[data-board-card]");
    if (!card || submitting) { event.preventDefault(); return; }
    drag = {id:card.dataset.boardCard, version:card.dataset.version};
    event.dataTransfer.effectAllowed = "move";
    event.dataTransfer.setData("text/plain", drag.id);
  });
  function clearDropHighlight() {
    board.querySelectorAll("[data-over]").forEach(lane => lane.removeAttribute("data-over"));
  }
  board.addEventListener("dragover", event => {
    const lane = event.target.closest("[data-drop-lane]");
    if (!drag || !lane) return;
    event.preventDefault();
    event.dataTransfer.dropEffect = "move";
    clearDropHighlight();
    lane.dataset.over = "";
  });
  board.addEventListener("dragleave", event => {
    const lane = event.target.closest("[data-drop-lane]");
    if (lane && !lane.contains(event.relatedTarget)) lane.removeAttribute("data-over");
  });
  board.addEventListener("dragend", () => { drag = null; clearDropHighlight(); });
  board.addEventListener("drop", event => {
    const lane = event.target.closest("[data-drop-lane]");
    if (!drag || !lane) return;
    event.preventDefault();
    form.elements.id.value = drag.id;
    form.elements.version.value = drag.version;
    form.elements.lane.value = lane.dataset.dropLane;
    drag = null;
    clearDropHighlight();
    form.requestSubmit();
  });
  board.addEventListener("submit", event => {
    if (event.target !== form) return;
    if (submitting) { event.preventDefault(); event.stopImmediatePropagation(); return; }
    submitting = true;
    form.setAttribute("aria-busy","true");
  },true);

  function refresh() {
    reader.dispatchEvent(new Event("board-refresh",{bubbles:true}));
  }
  function connect() {
    source = new EventSource(board.dataset.boardEvents);
    source.onopen = () => { connection.textContent = "Live"; connection.dataset.live = ""; };
    source.onerror = () => { connection.textContent = "Reconnecting…"; delete connection.dataset.live; };
    source.onmessage = event => {
      const update = JSON.parse(event.data);
      if (update.revision <= revision) return;
      requestedRevision = Math.max(requestedRevision,update.revision);
      if (update.message && !submitting) feedback.textContent = update.message;
      refresh();
    };
  }

  document.addEventListener("htmx:before:swap", event => {
    const { ctx } = event.detail;
    if (ctx.sourceElement !== reader && ctx.sourceElement !== form) return;
    const next = Number(ctx.response?.raw?.headers.get("X-Board-Revision"));
    if (!next || next < revision) { event.preventDefault(); return; }
    const focused = document.activeElement?.closest("[data-board-move]");
    if (focused) focusForRequest.set(ctx,focused.dataset.boardMove);
    revision = next;
  });

  document.addEventListener("htmx:after:swap", event => {
    const id = focusForRequest.get(event.detail.ctx);
    if (id && !dialog.open && document.activeElement === document.body) focusCard(id);
  });

  document.addEventListener("htmx:finally:request", event => {
    const {ctx} = event.detail;
    if (ctx.sourceElement === reader && requestedRevision > revision && ctx.response?.raw?.ok) {
      setTimeout(refresh,0);
    }
    if (ctx.sourceElement !== form) return;
    submitting = false;
    form.removeAttribute("aria-busy");
    const response = ctx.response?.raw;
    feedback.textContent = response?.headers.get("X-Board-Message") || "Move unconfirmed. Check the board and try again.";
    if (response?.ok || response?.status === 409) {
      if (dialog.open) dialog.close();
      focusCard(form.elements.id.value);
    } else if (dialog.open) {
      board.querySelector("#board-dialog-card").textContent = feedback.textContent;
    }
  });

  connect();
  window.addEventListener("pagehide", () => source.close());
  window.addEventListener("pageshow", event => { if (event.persisted) { connect(); refresh(); } });
})();
