import { field, item, section } from "./helpers.mjs"

export const groups = [
  section("Buttons", [
    item("button", "Button", "Trigger an action with a consistent hierarchy of visual emphasis.", `
      <div class="mero-row">
        <button class="mero-button mero-button-primary" type="button" data-mero-toast="Draft saved" data-mero-tone="success">Save draft</button>
        <button class="mero-button mero-button-secondary" type="button" data-mero-toast="Draft kept">Cancel</button>
        <button class="mero-button mero-button-ghost" type="button" disabled>Unavailable</button>
      </div>`, undefined, [
        ["Compact actions", `<div class="mero-button-group" role="group" aria-label="Draft actions">
          <button class="mero-button mero-button-sm mero-button-secondary" type="button" data-mero-toast="Draft saved">Save draft</button>
          <button class="mero-button mero-button-sm mero-button-outline" type="button" data-mero-toast="Draft copied">Copy</button>
        </div>`],
        ["Pending request", `
          <form class="mero-stack" method="get" action="/demo/stock-summary" data-mero-form
                hx-get="/demo/stock-summary" hx-target="find output">
            <div class="mero-row">
              <button class="mero-button mero-button-primary" type="submit">
                <span class="mero-button-label">Check inventory</span>
                <span class="mero-indicator mero-spinner" aria-hidden="true"></span>
              </button>
              <output class="mero-description mero-form-status" aria-live="polite"></output>
            </div>
            <p class="mero-field-error" data-mero-form-error role="alert" hidden></p>
          </form>`, {
          description: "Check current stock. While the request runs, the button shows a spinner and blocks a second submission.",
          notes: "The server returns an HTML fragment for the live output. After a failed request the form shows an inline error and enables the button for a retry.",
        }],
      ]),
    item("button-group", "Button Group", "Keep related actions together while preserving each button’s own label and focus.", `
      <div class="mero-button-group" role="group" aria-label="Document actions">
        <button class="mero-button mero-button-outline" type="button" data-mero-toast="Document copied">Copy</button>
        <button class="mero-button mero-button-outline" type="button" data-mero-toast="Export requested">Export</button>
        <button class="mero-button mero-button-outline" type="button" data-mero-toast="Link ready">Share</button>
      </div>`),
    item("close-button", "Close Button", "Give a dialog an icon-only close action with an accessible name.", `
      <button class="mero-button mero-button-primary" type="button" data-mero-open="demo-close">Open dialog</button>
      <dialog class="mero-dialog" id="demo-close" aria-labelledby="demo-close-title">
        <div class="mero-dialog-body">
          <div class="mero-dialog-header">
            <h2 class="mero-dialog-title" id="demo-close-title">Release details</h2>
            <button class="mero-button mero-close-button" type="button" aria-label="Close release details" data-mero-close><span class="mero-dismiss-mark" aria-hidden="true"></span></button>
          </div>
          <p class="mero-description">The preview has been updated to the latest build.</p>
        </div>
      </dialog>`),
    item("toggle-button", "Toggle Button", "Represent a persistent on or off state with a pressed button.", `
      <button class="mero-button mero-button-outline" type="button" aria-pressed="false" data-mero-toggle>Pin item</button>`,
      "Keep the visible label stable so assistive technology can announce the pressed state."),
    item("toggle-button-group", "Toggle Button Group", "Select one presentation mode from a connected set of controls.", `
      <fieldset class="mero-toggle-fieldset" data-mero-radio-group>
        <legend class="mero-label">View as</legend>
        <div class="mero-toggle-button-group">
          <label><input type="radio" name="demo-view" value="list" checked>List</label>
          <label><input type="radio" name="demo-view" value="grid">Grid</label>
          <label><input type="radio" name="demo-view" value="compact">Compact</label>
        </div>
      </fieldset>`,
      "Native radio controls provide one selection per group and arrow-key navigation."),
  ]),
]
