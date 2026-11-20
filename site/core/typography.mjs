import { item, section } from "./helpers.mjs"

export const groups = [
  section("Typography", [
    item("kbd", "Kbd", "Format a keyboard shortcut with native semantics.", `
      <p class="mero-text">Use <kbd class="mero-kbd">Tab</kbd> to move to the next control.</p>`),
    item("typography", "Typography", "Apply the type scale to semantic content.", `
      <article class="mero-stack">
        <h2 class="mero-heading">Release notes</h2>
        <p class="mero-text">The staging deployment is ready for review.</p>
        <p class="mero-description">Published by the platform team.</p>
      </article>`),
  ]),
]
