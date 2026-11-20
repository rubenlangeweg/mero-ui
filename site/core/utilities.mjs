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
  ]),
]
