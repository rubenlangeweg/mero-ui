(() => {
  let dragged;
  let activeLane;
  function clearDrag() {
    dragged?.removeAttribute('data-dragging');
    activeLane?.removeAttribute('data-drop-active');
    dragged = null;
    activeLane = null;
  }
  function dropLane(target) {
    if (!dragged) return null;
    const lane = target.closest?.('[data-studio-lane]');
    if (!lane || lane.contains(dragged) || lane.closest('[data-studio-lanes]') !== dragged.closest('[data-studio-lanes]')) return null;
    return lane;
  }
  document.addEventListener('dragstart', event => {
    const card = event.target.closest?.('[data-studio-task]');
    if (!card || !event.dataTransfer) return;
    dragged = card;
    card.setAttribute('data-dragging', '');
    event.dataTransfer.effectAllowed = 'move';
    event.dataTransfer.setData('text/plain', card.dataset.studioTask);
  });
  document.addEventListener('dragover', event => {
    const lane = dropLane(event.target);
    if (lane !== activeLane) {
      activeLane?.removeAttribute('data-drop-active');
      lane?.setAttribute('data-drop-active', '');
      activeLane = lane;
    }
    if (lane) event.preventDefault();
  });
  document.addEventListener('drop', event => {
    const lane = dropLane(event.target);
    if (!lane) return;
    event.preventDefault();
    const form = lane.closest('.stb-board').querySelector('[data-stb-move]');
    form.elements.id.value = dragged.dataset.studioTask;
    form.elements.status.value = lane.dataset.studioLane;
    clearDrag();
    form.requestSubmit();
  });
  document.addEventListener('dragend', clearDrag);
  document.addEventListener('htmx:beforeCleanupElement', event => {
    if (dragged && event.detail.elt.contains(dragged)) clearDrag();
  });
  document.addEventListener('keydown', event => {
    const filter = event.target.closest?.('.stb-filter[open]');
    if (event.key !== 'Escape' || !filter) return;
    filter.open = false;
    filter.querySelector('summary').focus();
    event.preventDefault();
  });
  document.addEventListener('click', event => {
    for (const filter of document.querySelectorAll('.stb-filter[open]')) {
      if (!filter.contains(event.target)) filter.open = false;
    }
  });
})();
