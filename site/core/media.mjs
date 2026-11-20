import { item, section } from "./helpers.mjs"

function avatar(initials, label, color) {
  return `<span class="mero-avatar" role="img" aria-label="${label}"${color ? ` style="background:${color};color:#201630"` : ""}>${initials}</span>`
}

export const groups = [
  section("Media", [
    item("avatar", "Avatar", "Represent a person with initials and an accessible name.", `
      <div class="mero-row">
        ${avatar("SR", "Sam Rivera")}
        <span>Workspace owner</span>
      </div>`),
    item("avatar-group", "Avatar Group", "Show a compact cluster of people associated with a workspace.", `
      <div class="mero-avatar-group" role="group" aria-label="Collaborators">
        ${avatar("SR", "Sam Rivera", "#b9a5ff")}
        ${avatar("MK", "Mila Khan", "#95e2c0")}
        ${avatar("AL", "Alex Lee", "#f5ca9d")}
      </div>`),
  ]),
]
