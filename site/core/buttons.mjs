import { item, section } from "./helpers.mjs"

export const groups = [
  section("Buttons", [
    item("button", "Button", "Trigger an action with a consistent hierarchy of visual emphasis.", `
      <div class="mero-row">
        <button class="mero-button mero-button-primary" type="button" data-mero-toast="Draft saved" data-mero-tone="success">Save draft</button>
        <button class="mero-button mero-button-secondary" type="button" data-mero-toast="Draft kept">Cancel</button>
        <button class="mero-button mero-button-ghost" type="button" disabled>Unavailable</button>
      </div>`, undefined, [
        ["Copy to clipboard", `
          <div class="mero-stack">
            <div class="mero-field">
              <label class="mero-label" for="copy-demo-key">Publishable key</label>
              <div class="mero-row">
                <input class="mero-input" id="copy-demo-key" value="pk_live_51HcX2eDeploy" readonly>
                <button class="mero-button mero-button-outline" type="button" data-mero-copy-target="#copy-demo-key" aria-label="Copy publishable key">Copy</button>
              </div>
            </div>
            <p class="mero-row">Environment <code>env_7f3a91</code>
              <button class="mero-button mero-button-ghost mero-button-sm" type="button" data-mero-copy="env_7f3a91" aria-label="Copy environment ID">Copy</button></p>
          </div>`, {
          description: "Copy an ID or a field’s value and confirm it with a notification.",
          notes: "data-mero-copy holds the text to copy. data-mero-copy-target names an input, textarea or element whose value or text to copy, which suits secrets, because nothing is repeated in the markup and the text can be selected when the browser blocks clipboard access. data-mero-copy-message replaces the “Copied” notification. The label stays the same, so an aria-label keeps working.",
        }],
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
    item("action-button", "Action Button", "Run a server action and report whether it succeeded, was refused or has an unknown result.", `
      <div class="mero-stack">
        <span class="mero-row">
          <button class="mero-button mero-button-secondary" type="button" hx-post="/demo/catalog/action-button?outcome=succeeded" hx-swap="none" data-mero-action>
            <span class="mero-button-label">Retry export</span><span class="mero-indicator mero-spinner" aria-hidden="true"></span></button>
          <span class="mero-action-status" data-mero-action-status role="status"></span>
        </span>
        <span class="mero-row">
          <button class="mero-button mero-button-danger" type="button" hx-post="/demo/catalog/action-button?outcome=rejected" hx-swap="none" data-mero-action>
            <span class="mero-button-label">Revoke key</span><span class="mero-indicator mero-spinner" aria-hidden="true"></span></button>
          <span class="mero-action-status" data-mero-action-status role="status"></span>
        </span>
        <span class="mero-row">
          <button class="mero-button mero-button-outline" type="button" hx-post="/demo/catalog/action-button?outcome=unknown" hx-swap="none" data-mero-action>
            <span class="mero-button-label">Halt run</span><span class="mero-indicator mero-spinner" aria-hidden="true"></span></button>
          <span class="mero-action-status" data-mero-action-status role="status"></span>
        </span>
      </div>`,
      "The button shows pending while the request runs and ignores further clicks. A 2xx response means succeeded. A 4xx response other than 408 means rejected: the server refused and nothing changed. A 5xx, 408, timeout or network error means unknown: the action may have happened, so check the current state before you retry. The Mero-Action-Outcome header overrides the state and Mero-Action-Message overrides the text. Each step dispatches a bubbling mero:action event, and data-mero-action-state exposes the state for styling."),
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
