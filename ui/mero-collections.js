/*! @rubenlangeweg/mero-ui 0.9.0 | MIT */
/* Optional Studio collection interactions. HTMX owns requests and swaps. */
(() => {
  const gridSelector = '[data-mero-grid]';
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
    const key = grid.dataset.meroGridFocus;
    if (!key) return;
    const selectors = { field: '.mero-collection-editor input:not([type=hidden])', cancel: '[data-grid-cancel]', invalid:'[aria-invalid="true"]', add:'[data-grid-add]', search:'input[name=q]', filter:'[data-grid-filter]', 'sort-name':'[data-grid-sort=name]', 'sort-status':'[data-grid-sort=status]' };
    // edit-ID and delete-ID return to the row's Actions menu button.
    const row = /^(?:edit|delete)-(\d+)$/.exec(key);
    const selector = Object.hasOwn(selectors, key) ? selectors[key] : (row ? `[data-grid-actions="${row[1]}"]` : '');
    if (!selector) return;
    delete grid.dataset.meroGridFocus;
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
  const mountSelector = '.mero-grid-mount,.mero-agenda-mount';
  document.addEventListener('htmx:before:request', event => {
    const source = event.target;
    const mount = source.closest?.(mountSelector);
    if (mount === source) delete mount.dataset.meroLoadSuperseded;
    else if (mount) mount.dataset.meroLoadSuperseded = '';
  });
  document.addEventListener('htmx:after:settle', event => {
    const root = event.target;
    syncGrids(root, true);
    if (!root.matches?.('[data-mero-agenda][data-agenda-focus]')) return;
    const action = root.dataset.agendaFocus;
    delete root.dataset.agendaFocus;
    const control = action === 'invalid' ? root.querySelector('[aria-invalid=true]') : [...root.querySelectorAll('[data-agenda-action]:not(:disabled)')].find(item => item.dataset.agendaAction === action);
    (control || root.querySelector('[data-agenda-action]:not(:disabled)'))?.focus();
  });
  document.addEventListener('htmx:before:swap', event => {
    const { ctx } = event.detail;
    const target = typeof ctx.target === 'string' ? document.querySelector(ctx.target) : ctx.target;
    const status = ctx.response?.status;
    if (!target) return;
    if (target.matches?.(mountSelector) && (target.contains(document.activeElement) || target.hasAttribute('data-mero-load-superseded') || status >= 400)) {
      // Keep an edit or navigation made while the initial refresh was in flight.
      // A failed refresh keeps the server-rendered fallback, which htmx 4 would replace.
      event.preventDefault();
      return;
    }
    // htmx 4 swaps every error response. Only these carry a replacement.
    if (target.matches?.('[data-mero-agenda]')) {
      if (status >= 400 && status !== 422) event.preventDefault();
      return;
    }
    if (!target.matches?.(gridSelector)) return;
    const revision = ctx.response?.headers.get('Inventory-Revision') ?? null;
    if ((revision !== null && Number(revision) < Number(target.dataset.inventoryRevision)) || (status >= 400 && status !== 409 && status !== 422)) {
      event.preventDefault();
    }
  });
  document.addEventListener('htmx:finally:request', event => {
    const { ctx } = event.detail;
    const status = ctx.response?.status;
    const grid = event.target.closest?.('[data-mero-grid],[data-mero-agenda]');
    // Cancelled requests have no response and are still "issuing"; 422, and 409 in a grid, carry a replacement.
    if (ctx.response ? status < 400 || status === 422 || (status === 409 && grid?.matches(gridSelector)) : !String(ctx.status).startsWith('error')) return;
    const error = grid?.querySelector('[data-grid-error],[data-agenda-error]');
    if (error) {
      error.hidden = false;
      error.textContent = 'The request failed. Check the current state before trying again.';
    }
  });
  function moveCard(card, lane) {
    if (!card || !lane) return;
    const board = card.closest('[data-mero-kanban]');
    if (lane.closest('[data-mero-kanban]') !== board) return;
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
    card.dispatchEvent(new CustomEvent('mero:kanban-move',{bubbles:true,detail:{card,from:previousLane.dataset.lane,to:lane.dataset.lane}}));
  }
  document.addEventListener('change', event => {
    const input = event.target;
    const grid = input.closest(gridSelector);
    if (grid && input.matches(`${rowSelector},[data-grid-all]`)) {
      if (input.matches('[data-grid-all]')) grid.querySelectorAll(rowSelector).forEach(row => {row.checked = input.checked;});
      updateSelection(grid);
    }
    const widget = input.closest('[data-mero-widget]');
    if (widget && input.matches('input[type=checkbox]')) {
      const total = widget.querySelectorAll('input[type=checkbox]');
      const count = [...total].filter(box => box.checked).length;
      widget.querySelector('progress').value = count;
      widget.querySelector('output').value = `${count} of ${total.length}`;
    }
    if (input.matches('[data-kanban-move]')) {
      const lanes = input.closest('[data-mero-kanban]').querySelectorAll('[data-lane]');
      moveCard(input.closest('.mero-kanban-card'), [...lanes].find(lane => lane.dataset.lane === input.value));
    }
  });
  let draggedCard;
  document.addEventListener('dragstart', event => {
    const card = event.target.closest('.mero-kanban-card[draggable=true]');
    if (!card) return;
    draggedCard = card;
    event.dataTransfer.setData('text/plain', card.querySelector('strong').textContent);
    event.dataTransfer.effectAllowed = 'move';
    card.classList.add('is-dragging');
  });
  document.addEventListener('dragover', event => {
    const lane = event.target.closest('[data-lane]');
    if (lane && draggedCard && lane.closest('[data-mero-kanban]') === draggedCard.closest('[data-mero-kanban]')) event.preventDefault();
  });
  document.addEventListener('drop', event => {
    const lane = event.target.closest('[data-lane]');
    if (!lane || !draggedCard || lane.closest('[data-mero-kanban]') !== draggedCard.closest('[data-mero-kanban]')) return;
    event.preventDefault();
    moveCard(draggedCard,lane);
  });
  function releaseDrag() {
    draggedCard?.classList.remove('is-dragging');
    draggedCard = null;
  }
  document.addEventListener('dragend', releaseDrag);
  document.addEventListener('htmx:before:cleanup', event => {
    if (draggedCard && event.target.contains(draggedCard)) releaseDrag();
  });
  function positionCard(card, panel) {
    const bounds = card.querySelector('.mero-hover-trigger').getBoundingClientRect();
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
    document.querySelectorAll('.mero-hover-content:not([hidden])').forEach(panel => {
      const card = panel.closest('[data-mero-hover-card]');
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
    const trigger = card.querySelector('.mero-hover-trigger');
    const panel = card.querySelector('.mero-hover-content');
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
    const card = event.target.closest('[data-mero-hover-card]');
    if (card && !card.contains(event.relatedTarget)) setCardOpen(card,true);
  });
  document.addEventListener('pointerout', event => {
    if (event.pointerType !== 'mouse') return;
    const card = event.target.closest('[data-mero-hover-card]');
    if (card && !card.dataset.pinned && !card.contains(event.relatedTarget) && !card.contains(document.activeElement)) setCardOpen(card,false);
  });
  document.addEventListener('focusin', event => {
    const card = event.target.closest('[data-mero-hover-card]');
    if (card) setCardOpen(card,true);
  });
  document.addEventListener('focusout', event => {
    const card = event.target.closest('[data-mero-hover-card]');
    if (card && !card.contains(event.relatedTarget)) setCardOpen(card,false);
  });
  document.addEventListener('keydown', event => {
    if (event.key !== 'Escape') return;
    const card = event.target.closest('[data-mero-hover-card]') || [...document.querySelectorAll('[data-mero-hover-card]:hover')].pop();
    if (card && !card.querySelector('.mero-hover-content').hidden) {
      if (card.contains(document.activeElement)) card.querySelector('.mero-hover-trigger').focus();
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
    if (!scroller.matches?.('.mero-toc-scroll')) return;
    const top = scroller.getBoundingClientRect().top + 4;
    const sections = [...scroller.querySelectorAll('[data-toc-section]')];
    const current = sections.filter(section => section.getBoundingClientRect().top <= top).at(-1) || sections[0];
    if (current) markTocLink(scroller.closest('[data-mero-toc]'),current.dataset.tocSection);
  },true);
  document.addEventListener('click', event => {
    const el = event.target;
    if (el.closest('[data-grid-clear]')) {
      const grid = el.closest(gridSelector);
      grid.querySelectorAll(rowSelector).forEach(box => {box.checked=false;});
      updateSelection(grid);
      grid.querySelector('[data-grid-all]').focus();
    }
    const trigger = el.closest('.mero-hover-trigger');
    if (trigger) {
      const card = trigger.closest('[data-mero-hover-card]');
      const open = !card.dataset.pinned;
      if (open) card.dataset.pinned='true';
      setCardOpen(card,open);
    }
    const file = el.closest('[data-file-preview]');
    if (file) {
      const tree = file.closest('.mero-file-tree');
      tree.querySelectorAll('[aria-current]').forEach(item => item.removeAttribute('aria-current'));
      file.setAttribute('aria-current','true');
      tree.querySelector('output').value = file.dataset.filePreview;
    }
    const pin = el.closest('[data-place]');
    if (pin) {
      const map = pin.closest('[data-mero-place-map]');
      map.querySelectorAll('[data-place]').forEach(item => item.setAttribute('aria-pressed', String(item===pin)));
      map.querySelectorAll('[data-place-detail]').forEach(detail => {
        detail.hidden = detail.dataset.placeDetail !== pin.dataset.place;
        if (!detail.hidden) map.querySelector('output').value = [...detail.children].map(part=>part.textContent).join(', ');
      });
    }
    const link = el.closest('[data-toc-link]');
    if (link) {
      const toc = link.closest('[data-mero-toc]');
      const scroll = toc.querySelector('.mero-toc-scroll');
      const section = [...scroll.children].find(item => item.dataset.tocSection===link.dataset.tocLink);
      if (!section) return;
      scroll.scrollTop += section.getBoundingClientRect().top - scroll.getBoundingClientRect().top;
      markTocLink(toc,link.dataset.tocLink);
      section.querySelector('h2').focus({preventScroll:true});
    }
  });
})();
