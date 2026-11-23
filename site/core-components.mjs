// Server-rendered catalog examples. Each demo is its own copyable example.
import { escapeHtml } from "./html.mjs"
import { groups as buttons } from "./core/buttons.mjs"
import { groups as forms } from "./core/forms.mjs"
import { groups as dateTime, calendarMarkup } from "./core/date-time.mjs"
import { groups as navigation, pageLinks } from "./core/navigation.mjs"
import { groups as overlays, commandResults, boostPage } from "./core/overlays.mjs"
import { groups as collections } from "./core/collections.mjs"
import { groups as controls } from "./core/controls.mjs"
import { groups as feedback } from "./core/feedback.mjs"
import { groups as layout } from "./core/layout.mjs"
import { groups as media } from "./core/media.mjs"
import { groups as pickers, extractOptions, workspaceNames } from "./core/pickers.mjs"
import { groups as typography } from "./core/typography.mjs"
import { groups as dataDisplay } from "./core/data-display.mjs"
import { groups as colors } from "./core/colors.mjs"
import { groups as utilities } from "./core/utilities.mjs"

export function catalogFragment(id, params) {
  if (id === "autocomplete") {
    const query = (params.get("q") ?? "").trim().toLowerCase()
    return extractOptions(workspaceNames.filter((name) => name.toLowerCase().includes(query)), "demo-autocomplete")
      || '<li class="mero-option" role="option" aria-disabled="true" id="demo-autocomplete-empty">No workspaces found</li>'
  }
  if (id === "form") {
    const name = (params.get("name") ?? "").trim().slice(0, 80)
    return name
      ? `<p class="mero-alert mero-alert-success">Welcome, ${escapeHtml(name)}. Your form reached the server.</p>`
      : '<p class="mero-alert mero-alert-danger">Enter your name and try again.</p>'
  }
  if (id === "boost-page") return boostPage(params.get("page"))
  if (id === "calendar") return calendarMarkup(params)
  if (id === "pagination") {
    const value = Number(params.get("page"))
    const page = Number.isInteger(value) && value >= 1 && value <= 3 ? value : 1
    return pageLinks(page)
  }
  if (id === "command-menu") {
    const query = (params.get("q") ?? "").trim().toLowerCase().slice(0, 80)
    return commandResults(query, groups.flatMap(group => group.items))
  }
  return null
}

export const groups = [
  ...buttons,
  ...forms,
  ...dateTime,
  ...navigation,
  ...overlays,
  ...collections,
  ...controls,
  ...feedback,
  ...layout,
  ...media,
  ...pickers,
  ...typography,
  ...dataDisplay,
  ...colors,
  ...utilities,
]
