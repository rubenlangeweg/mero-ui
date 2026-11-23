/*! @rubenlangeweg/mero-ui 0.6.1 | MIT */
// Optional delegated behaviors. They also work on fragments added by HTMX.
(() => {
  function showValue(mark) {
    const plot = mark.closest('.mero-plot');
    const readout = plot?.querySelector('[data-mero-plot-readout]');
    if (!readout) return;
    if (!readout.hasAttribute('data-active')) readout.dataset.instruction = readout.textContent;
    readout.textContent = mark.getAttribute('data-mero-plot-value');
    readout.setAttribute('data-active', '');
    const tooltip = plot.querySelector('[data-mero-plot-tooltip]');
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
    const plot = mark.closest('.mero-plot');
    const active = plot?.querySelector('[data-mero-plot-value]:focus, [data-mero-plot-value]:hover');
    if (active) return showValue(active);
    const readout = plot?.querySelector('[data-mero-plot-readout]');
    if (!readout) return;
    if (readout.hasAttribute('data-active')) readout.textContent = readout.dataset.instruction;
    readout.removeAttribute('data-active');
    const tooltip = plot.querySelector('[data-mero-plot-tooltip]');
    if (tooltip) tooltip.hidden = true;
  }
  document.addEventListener('keydown', event => {
    if (event.key === 'Escape') document.querySelectorAll('[data-mero-plot-tooltip]:not([hidden])').forEach(tip => { tip.hidden = true; });
    const mark = event.target.closest?.('[data-mero-plot-value]');
    if (!mark || event.altKey || event.ctrlKey || event.metaKey || !['ArrowLeft','ArrowRight','ArrowUp','ArrowDown','Home','End'].includes(event.key)) return;
    const marks = Array.from(mark.closest('svg').querySelectorAll('[data-mero-plot-value]'));
    const series = marks.filter(point => point.dataset.meroSeries === mark.dataset.meroSeries);
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
    const mark = event.target.closest?.('[data-mero-plot-value]');
    if (!mark) return;
    if (name === 'focusin') {
      const previous = mark.closest('svg').querySelector('[data-mero-plot-value][tabindex="0"]');
      if (previous !== mark) {
        previous?.setAttribute('tabindex','-1');
        mark.setAttribute('tabindex','0');
      }
    }
    showValue(mark);
  });
  for (const name of ['pointerout','focusout']) document.addEventListener(name, event => {
    const mark = event.target.closest?.('[data-mero-plot-value]');
    if (mark && !mark.contains(event.relatedTarget)) requestAnimationFrame(() => clearValue(mark));
  });
  const copyTimers = new WeakMap();
  async function copy(button) {
    const target = button.closest('.mero-code-block')?.querySelector('code') || button.closest('.mero-chat-message')?.querySelector('[data-mero-message-text]');
    if (!target) return;
    const label = button.dataset.meroCopyLabel || button.textContent;
    button.dataset.meroCopyLabel = label;
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
    const mark = event.target.closest?.('[data-mero-plot-value]');
    if (mark) mark.focus({preventScroll:true});
    const button = event.target.closest?.('button');
    if (!button || button.disabled) return;
    if (button.hasAttribute('data-mero-copy')) copy(button);
    if (button.hasAttribute('data-mero-reaction')) {
      const countElement = button.querySelector('[data-mero-count]');
      if (!countElement) return;
      const pressed = button.getAttribute('aria-pressed') !== 'true';
      const count = Number(countElement.textContent) + (pressed ? 1 : -1);
      button.setAttribute('aria-pressed', String(pressed));
      countElement.textContent = String(count);
      const label = button.dataset.label;
      button.setAttribute('aria-label', `${label}, ${count} ${count === 1 ? 'reaction':'reactions'}`);
      button.dispatchEvent(new CustomEvent('mero:reaction',{bubbles:true, detail:{label,pressed}}));
    }
    if (button.hasAttribute('data-mero-pressable')) {
      const pressed = button.getAttribute('aria-pressed') !== 'true';
      button.setAttribute('aria-pressed', String(pressed));
      const icon = button.querySelector('[data-mero-press-icon]');
      if (icon) icon.textContent = pressed ? '★' : '☆';
    }
    if (button.hasAttribute('data-mero-suggest')) {
      const input = button.closest('form')?.querySelector('textarea');
      if (!input) return;
      input.value = button.textContent.trim();
      input.dispatchEvent(new Event('input',{bubbles:true}));
      input.focus();
    }
  });
  const drafts = new WeakMap();
  const pinnedLogs = new WeakSet();
  const swapTarget = ctx => typeof ctx.target === 'string' ? document.querySelector(ctx.target) : ctx.target;
  // htmx 4 also reports requests a before:request listener cancelled: no response, still "issuing".
  const cancelled = ctx => !ctx.response && !String(ctx.status).startsWith('error');
  document.addEventListener('htmx:before:swap', event => {
    const { ctx } = event.detail;
    const target = swapTarget(ctx);
    // htmx 4 would swap an error response into the conversation or report.
    if (ctx.response?.status >= 400 && ctx.sourceElement?.closest?.('[data-mero-compose], .mero-chat-inbox, .mero-markdown-editor, .mero-report-period')) event.preventDefault();
    if (event.defaultPrevented || !target?.matches?.('.mero-chat-history')) return;
    if (target.scrollHeight - target.clientHeight - target.scrollTop <= 4) pinnedLogs.add(target);
    else pinnedLogs.delete(target);
  });
  document.addEventListener('htmx:after:swap', event => {
    const target = swapTarget(event.detail.ctx);
    if (pinnedLogs.delete(target)) target.scrollTop = target.scrollHeight;
    if (!target?.matches?.('.mero-chat-thread')) return;
    const current = target.querySelector('[data-mero-current-topic]')?.dataset.meroCurrentTopic;
    const inbox = target.closest('.mero-chat-inbox');
    if (!inbox || !current) return;
    for (const link of inbox.querySelectorAll('[data-mero-topic]')) {
      if (link.dataset.meroTopic === current) link.setAttribute('aria-current','true');
      else link.removeAttribute('aria-current');
    }
  });
  document.addEventListener('input', event => {
    if (event.target.matches?.('[data-mero-compose] textarea[aria-invalid]')) {
      event.target.removeAttribute('aria-invalid');
      event.target.form.querySelector('[data-mero-chat-status]').textContent = '';
    }
  });
  document.addEventListener('htmx:before:request', event => {
    const form = event.target.closest?.('[data-mero-compose]');
    if (!form) return;
    drafts.set(event.detail.ctx, form.elements.message.value);
    form.setAttribute('aria-busy','true');
    form.querySelector('button[type=submit]').disabled = true;
    form.querySelector('[data-mero-chat-status]').textContent = 'Preparing reply…';
  });
  document.addEventListener('htmx:finally:request', event => {
    const { ctx } = event.detail;
    const form = event.target.closest?.('[data-mero-compose]');
    if (!form || cancelled(ctx)) return;
    form.removeAttribute('aria-busy');
    form.querySelector('button[type=submit]').disabled = false;
    const input = form.elements.message;
    const status = form.querySelector('[data-mero-chat-status]');
    if (ctx.response?.status < 400) {
      if (input.value === drafts.get(ctx)) input.value = '';
      input.removeAttribute('aria-invalid');
      status.textContent = '';
      if (document.activeElement === document.body || form.contains(document.activeElement)) input.focus({preventScroll:true});
    } else if (ctx.response?.status === 422 && input.value === drafts.get(ctx)) {
      status.textContent = 'Enter a question between 1 and 1,000 characters.';
      input.setAttribute('aria-invalid','true');
      if (document.activeElement === document.body || form.contains(document.activeElement)) input.focus({preventScroll:true});
    } else status.textContent = 'Could not send. Try again.';
    drafts.delete(ctx);
  });
  document.addEventListener('htmx:finally:request', event => {
    const { ctx } = event.detail;
    const panel = event.target.closest?.('.mero-chat-inbox, .mero-markdown-editor, .mero-report-period');
    const status = panel?.querySelector('[data-mero-report-status]');
    if (!status || cancelled(ctx)) return;
    if (ctx.response?.status < 400) status.textContent = panel.matches('.mero-markdown-editor') ? 'Preview updated.' : '';
    else status.textContent = 'Could not load the update. Try again.';
  });
})();
