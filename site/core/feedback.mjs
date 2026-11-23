import { item, section } from "./helpers.mjs"

export const groups = [
  section("Feedback", [
    item("alert", "Alert", "Place status or guidance alongside the content it describes.", `
      <div class="mero-alert mero-alert-warning">
        <strong>Preview expires soon</strong>
        <p>Publish the draft before Friday to retain this URL.</p>
      </div>`),
    item("empty-state", "Empty State", "Explain an empty result and give the user a relevant next action.", `
      <section class="mero-empty-state" aria-labelledby="empty-environments-title">
        <span class="mero-empty-glyph" aria-hidden="true"></span>
        <h2 id="empty-environments-title">No environments yet</h2>
        <p>Create the first environment to deploy a release to it.</p>
        <a class="mero-button mero-button-primary mero-button-sm" href="/components/form">New environment</a>
      </section>`,
      "Use a heading at the level the page needs, so the empty result appears in the heading outline. Inside a table cell or a list, where a heading would break the outline, use strong instead. Put one action after the description, or several in a mero-row. The glyph is decorative and hidden from screen readers.", [
      ["No matches", `
      <div class="mero-empty-state">
        <strong>No operations match these filters</strong>
        <p>Remove a filter or search for another environment.</p>
        <div class="mero-row">
          <a class="mero-button mero-button-outline mero-button-sm" href="/components/filter-chips">Clear filters</a>
        </div>
      </div>`, { description: "Explain why a filtered list is empty and how to widen it." }],
    ]),
    item("meter", "Meter", "Show a measurement between known bounds.", `
      <div class="mero-field">
        <label class="mero-label" for="demo-meter">Storage used</label>
        <meter class="mero-meter" id="demo-meter" min="0" max="100" value="64" high="80">64%</meter>
        <p class="mero-description">64 GB of 100 GB</p>
      </div>`),
    item("live-progress", "Live Progress", "Follow a deployment through to its final status.", `
      <section class="mero-card mero-live" aria-labelledby="deployment-title" tabindex="-1" data-mero-live="3000"
        hx-get="/demo/catalog/live-progress" hx-trigger="mero:refresh"
        hx-target="find [data-mero-live-status]" hx-swap="innerHTML" hx-include="find input">
        <h2 class="mero-card-title" id="deployment-title">Production deployment</h2>
        <div class="mero-live-status" data-mero-live-status role="status" aria-atomic="true">
          <span class="mero-badge mero-badge-dot">Queued</span>
          <input type="hidden" name="started" value="">
        </div>
        <p class="mero-form-status" role="status" data-mero-live-error></p>
        <button type="button" class="mero-button mero-button-secondary" data-mero-live-retry hidden>Retry now</button>
      </section>`,
      "Return an HTML fragment with the current status. Send Mero-Live: done with the final status to stop polling. A failed read keeps the last status and offers a retry. Polling pauses in background tabs and refreshes when the tab becomes visible. The hidden started field drives this demo. In your app, point hx-get at the operation and omit that field and hx-include.", [
        ["Stale status", `
          <section class="mero-card mero-live" aria-labelledby="stale-deployment-title" tabindex="-1" data-mero-live="3000" data-mero-live-follow
            hx-get="/demo/catalog/live-progress?outage=1" hx-trigger="mero:refresh"
            hx-target="find [data-mero-live-status]" hx-swap="innerHTML" hx-include="find input">
            <h2 class="mero-card-title" id="stale-deployment-title">Production deployment</h2>
            <div class="mero-live-status" data-mero-live-status role="status" aria-atomic="true">
              <span class="mero-badge mero-badge-dot">Queued</span>
              <input type="hidden" name="started" value="">
            </div>
            <p class="mero-form-status" role="status" data-mero-live-error="Couldn't refresh. This is the status from {time}. Retrying…"></p>
            <button type="button" class="mero-button mero-button-secondary" data-mero-live-retry hidden>Retry now</button>
          </section>`, {
          description: "Keep showing the last confirmed status, with its time, while reads fail.",
          notes: "This demo endpoint fails every read after the first. data-mero-live-error fills {time} with the time of the last good read, in the browser's locale. data-mero-live-follow hands an error response with HX-Redirect, HX-Location or HX-Refresh to htmx and stops polling, so an expired session answered with 401 and HX-Redirect: /login goes to the login page instead of retrying forever.",
        }],
      ]),
    item("progress-bar", "Progress Bar", "Report measurable progress toward completion.", `
      <div class="mero-field">
        <div class="mero-measure-label"><label class="mero-label" for="demo-progress">Uploading assets</label><span class="mero-description" aria-hidden="true">68%</span></div>
        <progress class="mero-progress" id="demo-progress" max="100" value="68">68%</progress>
      </div>`),
    item("progress-circle", "Progress Circle", "Show a completion value in a compact circular display.", `
      <span class="mero-progress-circle" style="--mero-value:70" role="progressbar"
        aria-label="Import progress" aria-valuemin="0" aria-valuemax="100" aria-valuenow="70">70%</span>`),
    item("skeleton", "Skeleton", "Reserve space for content while its HTML is loading.", `
      <div class="mero-stack" role="group" aria-busy="true" aria-label="Loading release information" style="inline-size:min(100%,16rem)">
        <div class="mero-skeleton" aria-hidden="true" style="inline-size:62.5%;block-size:1.2rem"></div>
        <div class="mero-skeleton" aria-hidden="true"></div>
        <div class="mero-skeleton" aria-hidden="true" style="inline-size:81.25%"></div>
      </div>`),
    item("spinner", "Spinner", "Indicate that work is underway when the completion time is unknown.", `
      <span class="mero-row" role="status">
        <span class="mero-spinner" aria-hidden="true"></span>
        Syncing workspace
      </span>`),
  ]),
]
