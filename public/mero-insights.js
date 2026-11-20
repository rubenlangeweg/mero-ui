// Optional delegated behaviors. They also work on fragments added by HTMX.
(() => {
  function showValue(mark) {
    const plot = mark.closest('.rl-plot');
    const readout = plot?.querySelector('[data-rl-plot-readout]');
    if (!readout) return;
    if (!readout.hasAttribute('data-active')) readout.dataset.instruction = readout.textContent;
    readout.textContent = mark.getAttribute('data-rl-plot-value');
    readout.setAttribute('data-active', '');
    const tooltip = plot.querySelector('[data-rl-plot-tooltip]');
    if (!tooltip) return;
    tooltip.textContent = readout.textContent;
    tooltip.hidden = false;
    const box = mark.getBoundingClientRect();
    const frame = plot.getBoundingClientRect();
    const half = tooltip.offsetWidth / 2;
    const x = Math.max(half + 4, Math.min(frame.width - half - 4, box.left + box.width / 2 - frame.left));
    tooltip.style.left = x + 'px';
    tooltip.style.top = Math.max(tooltip.offsetHeight + 4, box.top - frame.top - 5) + 'px';
  }
  function clearValue(mark) {
    const plot = mark.closest('.rl-plot');
    const active = plot?.querySelector('[data-rl-plot-value]:focus, [data-rl-plot-value]:hover');
    if (active) return showValue(active);
    const readout = plot?.querySelector('[data-rl-plot-readout]');
    if (!readout) return;
    if (readout.hasAttribute('data-active')) readout.textContent = readout.dataset.instruction;
    readout.removeAttribute('data-active');
    const tooltip = plot.querySelector('[data-rl-plot-tooltip]');
    if (tooltip) tooltip.hidden = true;
  }
  document.addEventListener('keydown', event => {
    if (event.key === 'Escape') document.querySelectorAll('[data-rl-plot-tooltip]:not([hidden])').forEach(tip => { tip.hidden = true; });
    const mark = event.target.closest?.('[data-rl-plot-value]');
    if (!mark || event.altKey || event.ctrlKey || event.metaKey || !['ArrowLeft','ArrowRight','ArrowUp','ArrowDown','Home','End'].includes(event.key)) return;
    const marks = Array.from(mark.closest('svg').querySelectorAll('[data-rl-plot-value]'));
    const series = marks.filter(point => point.dataset.rlSeries === mark.dataset.rlSeries);
    const index = series.indexOf(mark);
    let target;
    if (event.key === 'Home') target = series[0];
    else if (event.key === 'End') target = series.at(-1);
    else if (series.length < marks.length && ['ArrowUp','ArrowDown'].includes(event.key)) {
      const step = event.key === 'ArrowDown' ? 1 : -1;
      target = marks[marks.indexOf(mark) + step * series.length];
    } else {
      const step = ['ArrowRight','ArrowDown'].includes(event.key) ? 1 : -1;
      target = series[index + step];
    }
    event.preventDefault();
    target?.focus();
  });
  for (const name of ['pointerover','focusin']) document.addEventListener(name, event => {
    const mark = event.target.closest?.('[data-rl-plot-value]');
    if (!mark) return;
    if (name === 'focusin') {
      const previous = mark.closest('svg').querySelector('[data-rl-plot-value][tabindex="0"]');
      if (previous !== mark) {
        previous?.setAttribute('tabindex','-1');
        mark.setAttribute('tabindex','0');
      }
    }
    showValue(mark);
  });
  for (const name of ['pointerout','focusout']) document.addEventListener(name, event => {
    const mark = event.target.closest?.('[data-rl-plot-value]');
    if (mark && !mark.contains(event.relatedTarget)) requestAnimationFrame(() => clearValue(mark));
  });
  const copyTimers = new WeakMap();
  async function copy(button) {
    const target = button.closest('.rl-code-block')?.querySelector('code') || button.closest('.rl-chat-message')?.querySelector('[data-rl-message-text]');
    if (!target) return;
    const label = button.dataset.rlCopyLabel || button.textContent;
    button.dataset.rlCopyLabel = label;
    try {
      await navigator.clipboard.writeText(target.innerText);
      button.textContent = 'Copied';
    } catch {
      const selection = window.getSelection();
      const range = document.createRange();
      range.selectNodeContents(target);
      selection.removeAllRanges();
      selection.addRange(range);
      button.textContent = 'Use Ctrl+C or ⌘C';
    }
    clearTimeout(copyTimers.get(button));
    copyTimers.set(button, setTimeout(() => { button.textContent = label; }, 1800));
  }
  document.addEventListener('click', event => {
    const mark = event.target.closest?.('[data-rl-plot-value]');
    if (mark) mark.focus({preventScroll:true});
    const button = event.target.closest?.('button');
    if (!button || button.disabled) return;
    if (button.hasAttribute('data-rl-copy')) copy(button);
    if (button.hasAttribute('data-rl-reaction')) {
      const countElement = button.querySelector('[data-rl-count]');
      if (!countElement) return;
      const pressed = button.getAttribute('aria-pressed') !== 'true';
      const count = Number(countElement.textContent) + (pressed ? 1 : -1);
      button.setAttribute('aria-pressed', String(pressed));
      countElement.textContent = String(count);
      const label = button.dataset.label;
      button.setAttribute('aria-label', `${label}, ${count} ${count === 1 ? 'reaction':'reactions'}`);
      button.dispatchEvent(new CustomEvent('relay:reaction',{bubbles:true, detail:{label,pressed}}));
    }
    if (button.hasAttribute('data-rl-pressable')) {
      const pressed = button.getAttribute('aria-pressed') !== 'true';
      button.setAttribute('aria-pressed', String(pressed));
      const icon = button.querySelector('[data-rl-press-icon]');
      if (icon) icon.textContent = pressed ? '★' : '☆';
    }
    if (button.hasAttribute('data-rl-suggest')) {
      const input = button.closest('form')?.querySelector('textarea');
      if (!input) return;
      input.value = button.textContent.trim();
      input.dispatchEvent(new Event('input',{bubbles:true}));
      input.focus();
    }
  });
  const drafts = new WeakMap();
  const pinnedLogs = new WeakSet();
  document.addEventListener('htmx:beforeSwap', event => {
    const target = event.detail.target;
    if (!event.detail.shouldSwap || !target?.matches('.rl-chat-history')) return;
    if (target.scrollHeight - target.clientHeight - target.scrollTop <= 4) pinnedLogs.add(target);
    else pinnedLogs.delete(target);
  });
  document.addEventListener('htmx:afterSwap', event => {
    const target = event.detail.target;
    if (pinnedLogs.delete(target)) target.scrollTop = target.scrollHeight;
    if (!target?.matches('.rl-chat-thread')) return;
    const current = target.querySelector('[data-rl-current-topic]')?.dataset.rlCurrentTopic;
    const inbox = target.closest('.rl-chat-inbox');
    if (!inbox || !current) return;
    for (const link of inbox.querySelectorAll('[data-rl-topic]')) {
      if (link.dataset.rlTopic === current) link.setAttribute('aria-current','true');
      else link.removeAttribute('aria-current');
    }
  });
  document.addEventListener('input', event => {
    if (event.target.matches?.('[data-rl-compose] textarea[aria-invalid]')) {
      event.target.removeAttribute('aria-invalid');
      event.target.form.querySelector('[data-rl-chat-status]').textContent = '';
    }
  });
  document.addEventListener('htmx:beforeRequest', event => {
    const form = event.detail.elt.closest?.('[data-rl-compose]');
    if (!form) return;
    drafts.set(event.detail.xhr, form.elements.message.value);
    form.setAttribute('aria-busy','true');
    form.querySelector('button[type=submit]').disabled = true;
    form.querySelector('[data-rl-chat-status]').textContent = 'Preparing reply…';
  });
  document.addEventListener('htmx:afterRequest', event => {
    const form = event.detail.elt.closest?.('[data-rl-compose]');
    if (!form) return;
    form.removeAttribute('aria-busy');
    form.querySelector('button[type=submit]').disabled = false;
    const input = form.elements.message;
    const status = form.querySelector('[data-rl-chat-status]');
    if (event.detail.successful) {
      if (input.value === drafts.get(event.detail.xhr)) input.value = '';
      input.removeAttribute('aria-invalid');
      status.textContent = '';
      if (document.activeElement === document.body || form.contains(document.activeElement)) input.focus({preventScroll:true});
    } else if (event.detail.xhr.status === 422 && input.value === drafts.get(event.detail.xhr)) {
      status.textContent = 'Enter a question between 1 and 1,000 characters.';
      input.setAttribute('aria-invalid','true');
      if (document.activeElement === document.body || form.contains(document.activeElement)) input.focus({preventScroll:true});
    } else status.textContent = 'Could not send. Try again.';
    drafts.delete(event.detail.xhr);
  });
  document.addEventListener('htmx:afterRequest', event => {
    const panel = event.detail.elt.closest?.('.rl-chat-inbox, .rl-markdown-editor, .rl-report-period');
    const status = panel?.querySelector('[data-rl-report-status]');
    if (!status) return;
    if (event.detail.successful) status.textContent = panel.matches('.rl-markdown-editor') ? 'Preview updated.' : '';
    else if (event.detail.failed) status.textContent = 'Could not load the update. Try again.';
  });
})();
