import { escapeHtml } from "../html.mjs"
import { item } from "./helpers.mjs"

const phrase = "acme/production/delete"

function confirmationForm({ typed = "", reason = "", invalid, outcome } = {}) {
  const endpoint = "/demo/catalog/typed-confirmation" + (outcome ? "?outcome=" + outcome : "")
  return `<form method="post" action="${endpoint}" hx-post="${endpoint}" hx-target="this" hx-swap="outerHTML"
      class="mero-stack" data-mero-form data-mero-confirm data-mero-return-focus="#confirm-environment-opener">
      <div class="mero-field">
        <label class="mero-label" for="confirm-environment-input">Confirmation phrase</label>
        <code class="mero-confirm-phrase" id="confirm-environment-phrase" data-mero-confirm-phrase>${phrase}</code>
        <input class="mero-input" id="confirm-environment-input" name="phrase" autocomplete="off" spellcheck="false"
          aria-describedby="confirm-environment-phrase confirm-environment-hint${invalid === "phrase" ? " confirm-environment-error" : ""}" data-mero-confirm-input required
          value="${escapeHtml(typed)}"${invalid === "phrase" ? ' aria-invalid="true"' : ""}${invalid !== "reason" ? " autofocus" : ""}>
        ${invalid === "phrase" ? `<p class="mero-field-error" id="confirm-environment-error">Type the displayed phrase exactly.</p>` : ""}
      </div>
      <div class="mero-field">
        <label class="mero-label" for="confirm-environment-reason">Reason</label>
        <textarea class="mero-textarea" id="confirm-environment-reason" name="reason" rows="2" data-mero-confirm-reason required${invalid === "reason" ? ' aria-invalid="true" aria-describedby="confirm-environment-error" autofocus' : ""}>${escapeHtml(reason)}</textarea>
        ${invalid === "reason" ? `<p class="mero-field-error" id="confirm-environment-error">Give a reason of at least 8 characters.</p>` : ""}
      </div>
      <p class="mero-description" id="confirm-environment-hint" data-mero-confirm-hint role="status">Type the phrase exactly to enable confirmation.</p>
      <p class="mero-field-error" data-mero-form-error role="alert" hidden></p>
      <div class="mero-dialog-footer">
        <button class="mero-button mero-button-secondary" type="button" data-mero-close>Cancel</button>
        <button class="mero-button mero-button-danger" type="submit" data-mero-confirm-submit aria-describedby="confirm-environment-hint" disabled>Delete environment</button>
      </div>
    </form>`
}

export function confirmationResponse(params, outcome) {
  const typed = params.get("phrase") ?? ""
  const reason = params.get("reason") ?? ""
  const invalid = typed.trim() !== phrase ? "phrase" : reason.trim().length < 8 ? "reason" : null
  if (invalid) return { body: confirmationForm({ typed, reason, invalid, outcome }), status: 422 }
  if (outcome === "rejected") return { status: 403 }
  if (outcome === "unknown") return { status: 503 }
  return { headers: { "HX-Reswap": "none", "HX-Trigger": JSON.stringify({ "mero:form-saved": { message: "Demo deletion confirmed." } }) } }
}

function example(outcome) {
  return `
    <button class="mero-button mero-button-danger" type="button" id="confirm-environment-opener" data-mero-open="confirm-environment">Delete environment</button>
    <dialog class="mero-dialog" id="confirm-environment" role="alertdialog" data-mero-static aria-labelledby="confirm-environment-title" aria-describedby="confirm-environment-description">
      <div class="mero-dialog-body mero-stack">
        <div>
          <h2 class="mero-dialog-title" id="confirm-environment-title">Delete environment?</h2>
          <p class="mero-description" id="confirm-environment-description">Confirm deletion of the Acme production environment. This demo simulates the request.</p>
        </div>
        ${confirmationForm({ outcome })}
      </div>
    </dialog>`
}

const guidance = "Typed confirmation is a UX guard only. The server must re-check the phrase and permissions before acting. This demo also requires a reason of at least 8 characters on the server. To make the reason optional, remove required from that field and update the server validation."

export const typedConfirmation = item("typed-confirmation", "Typed Confirmation", "Require an exact phrase before submitting a destructive action.", example(), guidance, [
  ["Rejected", example("rejected"), { notes: guidance + " This endpoint returns HTTP 403 after validation." }],
  ["Unknown outcome", example("unknown"), { notes: guidance + " This endpoint returns HTTP 503 after validation. Check the operation before retrying." }],
])
