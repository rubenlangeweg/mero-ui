import { field, item, section } from "./helpers.mjs"

export const groups = [
  section("Forms", [
    item("checkbox", "Checkbox", "Include an independent binary choice in a form.", `
      <label class="mero-row">
        <input class="mero-checkbox" type="checkbox" name="newsletter" value="yes" checked>
        Send release notes
      </label>`),
    item("checkbox-group", "Checkbox Group", "Group related independent choices with a fieldset and legend.", `
      <fieldset class="mero-fieldset">
        <legend class="mero-label">Notifications</legend>
        <div class="mero-checkbox-group">
          <label><input class="mero-checkbox" type="checkbox" name="notify" value="build" checked> Build status</label>
          <label><input class="mero-checkbox" type="checkbox" name="notify" value="review"> Review requests</label>
          <label><input class="mero-checkbox" type="checkbox" name="notify" value="access"> Access changes</label>
        </div>
      </fieldset>`),
    item("description", "Description", "Connect persistent help text to a control.",
      field("demo-description", "Workspace slug", 'value="studio-north"', { hint: "Use lowercase letters and hyphens." })),
    item("error-message", "Error Message", "Present a form-level failure where the user can act on it.", `
      <div class="mero-alert mero-alert-danger" role="alert">
        <strong>Changes could not be saved</strong>
        <p>Reconnect to the workspace and try again.</p>
      </div>`),
    item("field-error", "Field Error", "Associate a validation error with the field that needs attention.", `
      <div class="mero-field">
        <label class="mero-label" for="demo-field-error">Workspace slug</label>
        <input class="mero-input" id="demo-field-error" name="slug" value="studio" aria-invalid="true" aria-describedby="demo-field-error-message">
        <p class="mero-field-error" id="demo-field-error-message">This slug is already in use.</p>
      </div>`,
      "Render the invalid state only when the value has failed validation."),
    item("fieldset", "Fieldset", "Add a shared label to a related set of form controls.", `
      <fieldset class="mero-fieldset">
        <legend class="mero-label">Contact details</legend>
        <div class="mero-stack">
          ${field("demo-fieldset-name", "Name", 'autocomplete="name"').trim()}
          ${field("demo-fieldset-email", "Email address", 'autocomplete="email"', { type: "email" }).trim()}
        </div>
      </fieldset>`),
    item("form", "Form", "Submit native fields to the server and render an HTML response in place.", `
      <form class="mero-stack" action="/demo/catalog/form" method="get"
        hx-get="/demo/catalog/form" hx-target="#catalog-form-result" hx-swap="innerHTML">
        <div class="mero-field">
          <label class="mero-label" for="demo-form-name">Name</label>
          <input class="mero-input" id="demo-form-name" name="name" autocomplete="given-name" required maxlength="80" placeholder="Taylor">
        </div>
        <button class="mero-button mero-button-primary" type="submit">Send to server</button>
        <div class="mero-form-status" id="catalog-form-result" role="status"></div>
      </form>`,
      "This demo uses a read-only GET. Use POST for changes and keep validation on the server.", [
        ["One-time credential", `
          <div class="mero-stack">
          <form class="mero-stack" method="post" action="/demo/catalog/form-credential" hx-post="/demo/catalog/form-credential"
            hx-target="#api-token-secret" data-mero-form data-mero-hold="Wait for the new token. Leaving now would lose it.">
            <div class="mero-field">
              <label class="mero-label" for="api-token-name">Token name</label>
              <input class="mero-input" id="api-token-name" name="name" required maxlength="40" value="Deploy bot">
            </div>
            <p class="mero-field-error" data-mero-form-error role="alert" hidden></p>
            <div class="mero-row">
              <button class="mero-button mero-button-primary" type="submit" id="api-token-create">
                <span class="mero-button-label">Create token</span>
                <span class="mero-indicator mero-spinner" aria-hidden="true"></span>
              </button>
            </div>
          </form>
          <div class="mero-stack" id="api-token-secret" data-mero-ephemeral
            data-mero-hold="Copy the token before you leave. It is shown only once."></div>
          </div>`, {
          description: "Create an API token and keep the page until the person has copied it.",
          notes: "While the request runs, and while the token is shown, Mero cancels boosted navigation and requests that would replace the token, undoes Back and asks before the page unloads. The token is cleared on I copied it, when a surrounding dialog closes and when the page is hidden. Render the secret only in this response, never in a page the server can send again.",
        }],
      ]),
    item("input", "Input", "A styled native input with browser validation and autocomplete.",
      field("demo-input", "Email address", 'name="email" autocomplete="email" placeholder="you@example.com"', { type: "email" })),
    item("input-group", "Input Group", "Combine a control and contextual prefix with a single outline.", `
      <div class="mero-field">
        <label class="mero-label" for="demo-input-group">Project URL</label>
        <div class="mero-input-group">
          <span class="mero-input-prefix" id="demo-project-prefix">mero.example/</span>
          <input class="mero-input" id="demo-input-group" aria-describedby="demo-project-prefix" name="project" placeholder="my-project">
        </div>
      </div>`),
    item("input-otp", "Input OTP", "Collect a six-digit code in one input with mobile autofill.",
      field("demo-otp", "Verification code", 'name="otp" inputmode="numeric" autocomplete="one-time-code" pattern="[0-9]{6}" maxlength="6" placeholder="000000"', { hint: "Enter the six digits from your authenticator.", className: "mero-input-otp" }),
      "A single field supports paste and full-code autofill."),
    item("label", "Label", "Name an input and expand its activation area.",
      field("demo-label", "Display name", 'name="displayName" placeholder="Your name"')),
    item("number-field", "Number Field", "Set numeric bounds and increments for a native field.",
      field("demo-number", "Seats", 'name="seats" min="1" max="50" step="1" value="5"', { type: "number" })),
    item("radio-group", "Radio Group", "Choose exactly one option from a labeled set.", `
      <fieldset class="mero-fieldset" data-mero-radio-group>
        <legend class="mero-label">Visibility</legend>
        <div class="mero-radio-group">
          <label><input class="mero-radio" type="radio" name="demo-visibility" value="private" checked> Private</label>
          <label><input class="mero-radio" type="radio" name="demo-visibility" value="team"> Team</label>
          <label><input class="mero-radio" type="radio" name="demo-visibility" value="public"> Public</label>
        </div>
      </fieldset>`),
    item("search-field", "Search Field", "Use a native search field with the platform’s clear affordance.",
      field("demo-search", "Find a component", 'name="q" placeholder="Buttons, drawers, tabs…"', { type: "search" })),
    item("text-area", "Text Area", "Let users edit multiple lines of text with an optional autosizing surface.", `
      <div class="mero-field">
        <label class="mero-label" for="demo-textarea">Release summary</label>
        <textarea class="mero-textarea mero-textarea-autosize" id="demo-textarea" name="summary" rows="3" placeholder="What changed?"></textarea>
      </div>`),
    item("text-field", "Text Field", "Compose a label, input, and hint into a reusable form field.",
      field("demo-text-field", "Repository name", 'name="repository" required maxlength="64" placeholder="mero-ui"', { hint: "This name is visible in the workspace." })),
  ]),
]
