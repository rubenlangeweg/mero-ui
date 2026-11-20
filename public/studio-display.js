(() => {
  const views = { board: ['board', 'list'], calendar: ['week', 'agenda'] };
  const storageKey = screen => 'mero.studio.' + screen + '.display';

  function preferredView(screen, host) {
    const [standard, alternate] = views[screen];
    try {
      const saved = localStorage.getItem(storageKey(screen));
      if (views[screen].includes(saved)) return saved;
    } catch { /* Storage can be disabled. */ }
    if (screen === 'board' && host) {
      const style = getComputedStyle(host);
      const width = host.clientWidth - parseFloat(style.paddingLeft) - parseFloat(style.paddingRight);
      const rem = parseFloat(getComputedStyle(document.documentElement).fontSize);
      if (width > 0 && width <= 33 * rem) return alternate;
    }
    return standard;
  }

  // htmx 4 points ctx.sourceElement at the new workspace after the swap, so remember the choice here.
  const choices = new WeakMap();
  document.addEventListener('htmx:config:request', event => {
    const { ctx } = event.detail;
    const request = ctx.request;
    const workspace = ctx.sourceElement?.closest?.('#studio-workspace');
    if (ctx.sourceElement?.dataset?.studioDisplayChoice) choices.set(ctx, ctx.sourceElement.dataset.studioDisplayChoice);
    if (!workspace || request.method !== 'GET') return;
    const url = new URL(request.action, location.href);
    const screen = url.searchParams.get('view');
    if (url.pathname !== '/layouts/dashboard' || !Object.hasOwn(views, screen)) return;
    if (views[screen].includes(url.searchParams.get('display'))) return;
    url.searchParams.set('display', preferredView(screen, workspace.querySelector('.studio-main')));
    request.action = url.pathname + url.search;
  });

  // Choosing the current view again must not add a Back step.
  document.addEventListener('htmx:before:history:update', event => {
    const link = event.detail.sourceElement;
    if (link?.hasAttribute('data-studio-display-choice') && link.hasAttribute('aria-current')) event.detail.history.type = 'replace';
  });

  document.addEventListener('htmx:after:swap', event => {
    const { ctx } = event.detail;
    const choice = choices.get(ctx);
    const target = typeof ctx.target === 'string' ? document.querySelector(ctx.target) : ctx.target;
    if (!choice || target?.id !== 'studio-workspace') return;
    const screen = document.querySelector('#studio-workspace [data-studio-screen]')?.dataset.studioScreen;
    if (views[screen]?.includes(choice)) {
      try { localStorage.setItem(storageKey(screen), choice); } catch { /* Optional preference. */ }
    }
  });
  // htmx:error covers network errors and timeouts, not user aborts.
  for (const failure of ['htmx:response:error', 'htmx:error']) {
    document.addEventListener(failure, event => {
      if (event.target.hasAttribute?.('data-studio-display-choice')) {
        window.MeroUI?.toast('Could not switch views. Try again.', { tone: 'danger' });
      }
    });
  }

  // A full page (or a history restore) arrives before the server knows the host width.
  // Only request another fragment if the user's view differs from that usable initial HTML.
  function resolveInitialView() {
    const host = document.querySelector('#studio-workspace [data-studio-default-url]');
    if (!host || !window.htmx) return;
    const screen = host.dataset.studioScreen;
    // Back must restore the view the user saw, even after a later choice changes the preference.
    const url = new URL(location.href);
    url.searchParams.set('display', views[screen][0]);
    history.replaceState(history.state, '', url);
    htmx.trigger(document.body, 'htmx:after:history:replace', { path: url.pathname + url.search });
    if (preferredView(screen, host) === views[screen][0]) return;
    const workspace = host.closest('#studio-workspace');
    const source = document.createElement('span');
    source.hidden = true;
    source.dataset.studioAutoDisplay = '';
    source.setAttribute('hx-replace-url', 'true');
    source.setAttribute('hx-sync', '#studio-workspace:abort');
    // htmx.ajax builds the HX-Target header from the source, before its target option applies.
    source.setAttribute('hx-target', '#studio-workspace');
    host.append(source);
    // Typing or clicking before a slow initial response arrives takes priority.
    const listeners = new AbortController();
    // htmx 4 listens for htmx:abort on the requesting element.
    const cancel = () => htmx.trigger(source, 'htmx:abort');
    for (const name of ['pointerdown', 'keydown', 'input']) {
      workspace.addEventListener(name, cancel, { capture: true, once: true, signal: listeners.signal });
    }
    htmx.ajax('GET', host.dataset.studioDefaultUrl, { source, swap: 'outerHTML show:none' })
      .catch(() => { /* The initial server-rendered view remains usable. */ })
      .finally(() => { listeners.abort(); source.remove(); });
  }
  document.addEventListener('DOMContentLoaded', resolveInitialView);
  // htmx 4 restores history inside a Navigation API transition; the browser resets focus when it ends.
  document.addEventListener('htmx:after:swap', event => {
    if (event.detail.ctx.request?.headers?.['HX-History-Restore-Request']) (window.navigation?.transition?.finished ?? Promise.resolve()).then(resolveInitialView, resolveInitialView);
  });
})();
