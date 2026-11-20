/* Optional Studio collection interactions. HTMX owns requests and swaps. */
(() => {
  const gridSelector = '[data-rl-grid]';
  const rowSelector = 'input[type="checkbox"][name="row"]';
  function updateSelection(grid) {
    const boxes = [...grid.querySelectorAll(rowSelector)];
    const selected = boxes.filter(box => box.checked);
    const all = grid.querySelector('[data-grid-all]');
    if (!all) return;
    all.checked = boxes.length > 0 && boxes.length === selected.length;
    all.indeterminate = selected.length > 0 && selected.length < boxes.length;
    grid.querySelector('[data-grid-bar]').hidden = selected.length === 0;
    grid.querySelector('[data-grid-count]').textContent = `${selected.length} selected`;
  }
  function focusGrid(grid) {
    const key = grid.dataset.rlGridFocus;
    if (!key) return;
    const selectors = { field: '.rl-collection-editor input:not([type=hidden])', cancel: '[data-grid-cancel]', invalid:'[aria-invalid="true"]', add:'[data-grid-add]', search:'input[name=q]' };
    const rowAction = /^(edit|delete)-(\d+)$/.exec(key);
    const selector = Object.hasOwn(selectors, key) ? selectors[key] : (rowAction ? `[data-grid-${rowAction[1]}="${rowAction[2]}"]` : '');
    if (!selector) return;
    delete grid.dataset.rlGridFocus;
    (grid.querySelector(selector) || grid.querySelector('[data-grid-add]'))?.focus();
  }
  function syncGrids(root, focus = false) {
    const grids = root.matches?.(gridSelector) ? [root] : root.querySelectorAll?.(gridSelector) || [];
    for (const grid of grids) {
      updateSelection(grid);
      if (focus) focusGrid(grid);
    }
  }
  syncGrids(document);
  const mountSelector = '.rl-grid-mount,.rl-agenda-mount';
  document.addEventListener('htmx:beforeRequest', event => {
    const source = event.detail.elt;
    const mount = source.closest(mountSelector);
    if (mount === source) delete mount.dataset.rlLoadSuperseded;
    else if (mount) mount.dataset.rlLoadSuperseded = '';
  });
  document.addEventListener('htmx:afterSettle', event => {
    const root = event.detail.elt;
    syncGrids(root, true);
    if (!root.matches?.('[data-rl-agenda][data-agenda-focus]')) return;
    const action = root.dataset.agendaFocus;
    delete root.dataset.agendaFocus;
    const control = action === 'invalid' ? root.querySelector('[aria-invalid=true]') : [...root.querySelectorAll('[data-agenda-action]:not(:disabled)')].find(item => item.dataset.agendaAction === action);
    (control || root.querySelector('[data-agenda-action]:not(:disabled)'))?.focus();
  });
  document.addEventListener('htmx:beforeSwap', event => {
    const target = event.detail.target;
    if (target.matches?.(mountSelector) && (target.contains(document.activeElement) || target.hasAttribute('data-rl-load-superseded'))) {
      // Keep an edit or navigation made while the initial refresh was in flight.
      event.detail.shouldSwap = false;
      return;
    }
    if (event.detail.target.matches?.('[data-rl-agenda]') && event.detail.xhr.status === 422) {
      event.detail.shouldSwap = true;
      event.detail.isError = false;
      return;
    }
    if (!event.detail.target.matches?.(gridSelector)) return;
    const revision = event.detail.xhr.getResponseHeader('Inventory-Revision');
    if (revision !== null && Number(revision) < Number(event.detail.target.dataset.inventoryRevision)) {
      event.detail.shouldSwap = false;
      return;
    }
    if (event.detail.xhr.status === 422 || event.detail.xhr.status === 409) {
      event.detail.shouldSwap = true;
      event.detail.isError = false;
    }
  });
  document.addEventListener('htmx:afterRequest', event => {
    if (!event.detail.failed) return;
    const grid = event.target.closest?.('[data-rl-grid],[data-rl-agenda]');
    const error = grid?.querySelector('[data-grid-error],[data-agenda-error]');
    if (error) {
      error.hidden = false;
      error.textContent = 'The request failed. Check the current state before trying again.';
    }
  });
  function moveCard(card, lane) {
    if (!card || !lane) return;
    const board = card.closest('[data-rl-kanban]');
    if (lane.closest('[data-rl-kanban]') !== board) return;
    const select = card.querySelector('[data-kanban-move]');
    const previousLane = card.closest('[data-lane]');
    if (previousLane === lane) return;
    const returnFocus = card.contains(document.activeElement);
    lane.querySelector('[data-lane-cards]').append(card);
    select.value = lane.dataset.lane;
    for (const column of [previousLane,lane]) {
      column.querySelector('[data-lane-count]').textContent = column.querySelector('[data-lane-cards]').children.length;
    }
    board.querySelector('output').textContent = `${card.querySelector('strong').textContent} moved to ${lane.dataset.lane}.`;
    if (returnFocus) select.focus({preventScroll:true});
    card.dispatchEvent(new CustomEvent('relay:kanban-move',{bubbles:true,detail:{card,from:previousLane.dataset.lane,to:lane.dataset.lane}}));
  }
  document.addEventListener('change', event => {
    const input = event.target;
    const grid = input.closest(gridSelector);
    if (grid && input.matches(`${rowSelector},[data-grid-all]`)) {
      if (input.matches('[data-grid-all]')) grid.querySelectorAll(rowSelector).forEach(row => {row.checked = input.checked;});
      updateSelection(grid);
    }
    const widget = input.closest('[data-rl-widget]');
    if (widget && input.matches('input[type=checkbox]')) {
      const total = widget.querySelectorAll('input[type=checkbox]');
      const count = [...total].filter(box => box.checked).length;
      widget.querySelector('progress').value = count;
      widget.querySelector('output').value = `${count} of ${total.length}`;
    }
    if (input.matches('[data-kanban-move]')) {
      const lanes = input.closest('[data-rl-kanban]').querySelectorAll('[data-lane]');
      moveCard(input.closest('.rl-kanban-card'), [...lanes].find(lane => lane.dataset.lane === input.value));
    }
  });
  let draggedCard;
  document.addEventListener('dragstart', event => {
    const card = event.target.closest('.rl-kanban-card[draggable=true]');
    if (!card) return;
    draggedCard = card;
    event.dataTransfer.setData('text/plain', card.querySelector('strong').textContent);
    event.dataTransfer.effectAllowed = 'move';
    card.classList.add('is-dragging');
  });
  document.addEventListener('dragover', event => {
    const lane = event.target.closest('[data-lane]');
    if (lane && draggedCard && lane.closest('[data-rl-kanban]') === draggedCard.closest('[data-rl-kanban]')) event.preventDefault();
  });
  document.addEventListener('drop', event => {
    const lane = event.target.closest('[data-lane]');
    if (!lane || !draggedCard || lane.closest('[data-rl-kanban]') !== draggedCard.closest('[data-rl-kanban]')) return;
    event.preventDefault();
    moveCard(draggedCard,lane);
  });
  function releaseDrag() {
    draggedCard?.classList.remove('is-dragging');
    draggedCard = null;
  }
  document.addEventListener('dragend', releaseDrag);
  document.addEventListener('htmx:beforeCleanupElement', event => {
    if (draggedCard && event.detail.elt.contains(draggedCard)) releaseDrag();
  });
  function positionCard(card, panel) {
    const bounds = card.querySelector('.rl-hover-trigger').getBoundingClientRect();
    const width = panel.offsetWidth;
    const height = panel.offsetHeight;
    const viewportWidth = document.documentElement.clientWidth;
    const viewportHeight = document.documentElement.clientHeight;
    const left = Math.max(8, Math.min(bounds.left+(bounds.width-width)/2, viewportWidth-width-8));
    const above = bounds.bottom+height > viewportHeight-8 && bounds.top >= height+8;
    const top = Math.max(8, Math.min(above ? bounds.top-height : bounds.bottom, viewportHeight-height-8));
    const fixed = typeof panel.showPopover === 'function';
    const origin = fixed ? {left:0, top:0} : card.getBoundingClientRect();
    panel.style.left = `${left-origin.left}px`;
    panel.style.top = `${top-origin.top}px`;
  }
  function positionOpenCards() {
    document.querySelectorAll('.rl-hover-content:not([hidden])').forEach(panel => {
      const card = panel.closest('[data-rl-hover-card]');
      const bounds = card.getBoundingClientRect();
      if (!panel.contains(document.activeElement) && (bounds.bottom <= 0 || bounds.top >= document.documentElement.clientHeight)) {
        setCardOpen(card,false);
      } else {
        positionCard(card,panel);
      }
    });
  }
  window.addEventListener('resize', positionOpenCards);
  document.addEventListener('scroll', positionOpenCards, {capture:true, passive:true});
  function setCardOpen(card, open) {
    const trigger = card.querySelector('.rl-hover-trigger');
    const panel = card.querySelector('.rl-hover-content');
    trigger.setAttribute('aria-expanded', String(open));
    if (open) {
      panel.hidden = false;
      if (panel.showPopover && !panel.matches(':popover-open')) panel.showPopover({source:trigger});
      positionCard(card,panel);
    } else {
      panel.hidePopover?.();
      panel.hidden = true;
      delete card.dataset.pinned;
    }
  }
  document.addEventListener('pointerover', event => {
    if (event.pointerType !== 'mouse') return;
    const card = event.target.closest('[data-rl-hover-card]');
    if (card && !card.contains(event.relatedTarget)) setCardOpen(card,true);
  });
  document.addEventListener('pointerout', event => {
    if (event.pointerType !== 'mouse') return;
    const card = event.target.closest('[data-rl-hover-card]');
    if (card && !card.dataset.pinned && !card.contains(event.relatedTarget) && !card.contains(document.activeElement)) setCardOpen(card,false);
  });
  document.addEventListener('focusin', event => {
    const card = event.target.closest('[data-rl-hover-card]');
    if (card) setCardOpen(card,true);
  });
  document.addEventListener('focusout', event => {
    const card = event.target.closest('[data-rl-hover-card]');
    if (card && !card.contains(event.relatedTarget)) setCardOpen(card,false);
  });
  document.addEventListener('keydown', event => {
    if (event.key !== 'Escape') return;
    const card = event.target.closest('[data-rl-hover-card]') || [...document.querySelectorAll('[data-rl-hover-card]:hover')].pop();
    if (card && !card.querySelector('.rl-hover-content').hidden) {
      if (card.contains(document.activeElement)) card.querySelector('.rl-hover-trigger').focus();
      setCardOpen(card,false);
      event.preventDefault();
    }
  });
  function markTocLink(toc,index) {
    toc.querySelectorAll('[data-toc-link]').forEach(link => {
      if (link.dataset.tocLink === index) link.setAttribute('aria-current','location');
      else link.removeAttribute('aria-current');
    });
  }
  document.addEventListener('scroll', event => {
    const scroller = event.target;
    if (!scroller.matches?.('.rl-toc-scroll')) return;
    const top = scroller.getBoundingClientRect().top + 4;
    const sections = [...scroller.querySelectorAll('[data-toc-section]')];
    const current = sections.filter(section => section.getBoundingClientRect().top <= top).at(-1) || sections[0];
    if (current) markTocLink(scroller.closest('[data-rl-toc]'),current.dataset.tocSection);
  },true);
  document.addEventListener('click', event => {
    const el = event.target;
    if (el.closest('[data-grid-clear]')) {
      const grid = el.closest(gridSelector);
      grid.querySelectorAll(rowSelector).forEach(box => {box.checked=false;});
      updateSelection(grid);
      grid.querySelector('[data-grid-all]').focus();
    }
    const trigger = el.closest('.rl-hover-trigger');
    if (trigger) {
      const card = trigger.closest('[data-rl-hover-card]');
      const open = !card.dataset.pinned;
      if (open) card.dataset.pinned='true';
      setCardOpen(card,open);
    }
    const file = el.closest('[data-file-preview]');
    if (file) {
      const tree = file.closest('.rl-file-tree');
      tree.querySelectorAll('[aria-current]').forEach(item => item.removeAttribute('aria-current'));
      file.setAttribute('aria-current','true');
      tree.querySelector('output').value = file.dataset.filePreview;
    }
    const pin = el.closest('[data-place]');
    if (pin) {
      const map = pin.closest('[data-rl-place-map]');
      map.querySelectorAll('[data-place]').forEach(item => item.setAttribute('aria-pressed', String(item===pin)));
      map.querySelectorAll('[data-place-detail]').forEach(detail => {
        detail.hidden = detail.dataset.placeDetail !== pin.dataset.place;
        if (!detail.hidden) map.querySelector('output').value = [...detail.children].map(part=>part.textContent).join(', ');
      });
    }
    const link = el.closest('[data-toc-link]');
    if (link) {
      const toc = link.closest('[data-rl-toc]');
      const scroll = toc.querySelector('.rl-toc-scroll');
      const section = [...scroll.children].find(item => item.dataset.tocSection===link.dataset.tocLink);
      if (!section) return;
      scroll.scrollTop += section.getBoundingClientRect().top - scroll.getBoundingClientRect().top;
      markTocLink(toc,link.dataset.tocLink);
      section.querySelector('h2').focus({preventScroll:true});
    }
  });
})();
