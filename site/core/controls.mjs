import { field, item, section } from "./helpers.mjs"

export const groups = [
  section("Controls", [
    item("slider", "Slider", "Choose a value from a bounded range.", `
      <div class="mero-field">
        <label class="mero-label" for="demo-slider">Animation speed</label>
        <input class="mero-slider" id="demo-slider" name="speed" type="range" min="50" max="150" step="10" value="100">
      </div>`),
    item("switch", "Switch", "Toggle one setting with a checkbox-backed switch.", `
      <label class="mero-row">
        <input class="mero-switch" type="checkbox" role="switch" name="preview" value="on" checked>
        Enable preview
      </label>`, "Native form submission includes this setting when selected.", [
        ["Notification preference", `<label class="mero-setting-switch">
          <span><strong id="stock-alerts-label">Stock alerts</strong><small id="stock-alerts-hint">Notify me when an item falls below five units.</small></span>
          <input class="mero-switch" type="checkbox" role="switch" name="stock-alerts"
                 aria-labelledby="stock-alerts-label" aria-describedby="stock-alerts-hint" checked>
        </label>`],
        ["Managed preference", `<label class="mero-setting-switch">
          <span><strong id="sign-in-alerts-label">Sign-in alerts</strong><small id="sign-in-alerts-hint">Required by your workspace administrator.</small></span>
          <input class="mero-switch" type="checkbox" role="switch" name="sign-in-alerts"
                 aria-labelledby="sign-in-alerts-label" aria-describedby="sign-in-alerts-hint" checked disabled>
        </label>`, {
          description: "Show a workspace policy with its saved value and the reason it is locked.",
          notes: "Disabled inputs are omitted from form submissions. Apply the workspace policy on the server.",
        }],
      ]),
  ]),
]
