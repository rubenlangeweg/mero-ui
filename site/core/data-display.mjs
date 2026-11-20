import { item, section } from "./helpers.mjs"

export const groups = [
  section("Data display", [
    item("badge", "Badge", "Label a status using text and a semantic tone.", `
      <div class="mero-row">
        <span class="mero-badge mero-badge-success">Published</span>
        <span class="mero-badge mero-badge-warning">In review</span>
        <span class="mero-badge mero-badge-accent">Draft</span>
      </div>`),
    item("chip", "Chip", "Display a lightweight label for an attribute or filter value.", `
      <span class="mero-chip">Europe West</span>`),
    item("table", "Table", "Show comparable records in a native table with column headers.", `
      <div class="mero-table-wrap">
        <table class="mero-table">
          <caption>Workspace releases</caption>
          <thead><tr><th scope="col">Version</th><th scope="col">Environment</th><th scope="col">Status</th></tr></thead>
          <tbody>
            <tr><td>v1.3.0</td><td>Production</td><td><span class="mero-badge mero-badge-success">Live</span></td></tr>
            <tr><td>v1.4.0</td><td>Staging</td><td><span class="mero-badge mero-badge-warning">Review</span></td></tr>
          </tbody>
        </table>
      </div>`),
  ]),
]
