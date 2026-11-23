import { item, section } from "./helpers.mjs"

function localTimes() {
  return `
    <dl class="mero-stack">
      <div><dt class="mero-label">Deployed</dt><dd><time datetime="2026-11-23T09:41:00Z" data-mero-time="relative">2026-11-23 09:41 UTC</time></dd></div>
      <div><dt class="mero-label">Created</dt><dd><time datetime="2026-11-21T16:05:00Z" data-mero-time="absolute">2026-11-21 16:05 UTC</time></dd></div>
      <div><dt class="mero-label">Expires</dt><dd><time datetime="2026-12-23T00:00:00Z" data-mero-time="date">2026-12-23 UTC</time></dd></div>
    </dl>`
}

export const groups = [
  section("Typography", [
    item("kbd", "Kbd", "Format a keyboard shortcut with native semantics.", `
      <p class="mero-text">Use <kbd class="mero-kbd">Tab</kbd> to move to the next control.</p>`, undefined, [
        ["Keyboard shortcuts", `
          <div class="mero-stack">
            <div class="mero-field">
              <label class="mero-label" for="shortcut-demo-search">Search <kbd class="mero-kbd">/</kbd></label>
              <input class="mero-input" id="shortcut-demo-search" type="search" data-mero-shortcut="/">
            </div>
            <div class="mero-row">
              <button class="mero-button mero-button-secondary" type="button" data-mero-shortcut="n" data-mero-toast="New draft started">New draft <kbd class="mero-kbd">N</kbd></button>
              <button class="mero-button mero-button-secondary" type="button" data-mero-shortcut="g r" data-mero-toast="Opened reports">Reports <kbd class="mero-kbd">G</kbd> <kbd class="mero-kbd">R</kbd></button>
            </div>
            <label class="mero-row"><input class="mero-checkbox" type="checkbox" data-mero-shortcuts-toggle checked> Single-key shortcuts</label>
          </div>`, {
          description: "Act on single keys and two-key sequences, with a switch to turn them off.",
          notes: "Shortcuts are ignored while the person types in a field, works in a menu, list, tab list or grid, or holds Ctrl, Cmd or Alt. A field takes focus; anything else is clicked. A two-key sequence such as g r must be finished within 1.5 seconds. WCAG 2.1.4 requires a way to turn single-key shortcuts off: the data-mero-shortcuts-toggle control does that for every page in this browser, and Mero updates aria-keyshortcuts to match.",
        }],
      ]),
    item("typography", "Typography", "Apply the type scale to semantic content.", `
      <article class="mero-stack">
        <h2 class="mero-heading">Release notes</h2>
        <p class="mero-text">The staging deployment is ready for review.</p>
        <p class="mero-description">Published by the platform team.</p>
      </article>`, undefined, [
        ["Local time", localTimes(), {
          description: "Show server timestamps in the reader’s locale and time zone.",
          notes: "Render the UTC time as text so the page reads correctly without scripts. Mero rewrites the text from datetime: absolute shows the date and time, date and time show one part, and relative shows how long ago or until, refreshed every minute, with the full date in the title. After a swap or morph Mero formats the new elements again.",
        }],
      ]),
  ]),
]
