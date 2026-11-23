import { item, section } from "./helpers.mjs"

export const groups = [
  section("Utilities", [
    item("scroll-shadow", "Scroll Shadow", "Expose a scrollable region with a visual cue that more content is available.", `
      <div class="mero-scroll-shadow" role="region" aria-label="Recent releases" tabindex="0" style="height:8rem">
        <ul class="mero-stack">
          <li>v1.5.0 • New components</li>
          <li>v1.4.3 • Performance improvements</li>
          <li>v1.4.2 • Navigation polish</li>
          <li>v1.4.1 • Field states</li>
          <li>v1.4.0 • Release tooling</li>
          <li>v1.3.0 • Initial catalog</li>
        </ul>
      </div>`),
    item("visually-hidden", "Visually Hidden", "Give screen readers context that the visible text leaves implied.", `
      <div class="mero-row">
        <button class="mero-button mero-button-outline mero-button-sm" type="button" data-mero-toast="Release ID copied">Copy<span class="mero-sr-only"> release ID</span></button>
        <span class="mero-badge mero-badge-warning">3<span class="mero-sr-only"> environments need attention</span></span>
      </div>`,
      "Put the hidden words inside the element they describe, with a leading space, so the accessible name reads as one phrase: Copy release ID. The text stays in the accessibility tree and in copied text, takes no space and never widens a scrolling container. Don't hide focusable elements this way."),
  ]),
]
