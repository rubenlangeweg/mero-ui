import { field, item, section } from "./helpers.mjs"

export const groups = [
  section("Feedback", [
    item("alert", "Alert", "Place status or guidance alongside the content it describes.", `
      <div class="mero-alert mero-alert-warning">
        <strong>Preview expires soon</strong>
        <p>Publish the draft before Friday to retain this URL.</p>
      </div>`),
    item("meter", "Meter", "Show a measurement between known bounds.", `
      <div class="mero-field">
        <label class="mero-label" for="demo-meter">Storage used</label>
        <meter class="mero-meter" id="demo-meter" min="0" max="100" value="64" high="80">64%</meter>
        <p class="mero-description">64 GB of 100 GB</p>
      </div>`),
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
