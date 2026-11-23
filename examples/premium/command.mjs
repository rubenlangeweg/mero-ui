const prefix = "/premium/command";
const teammates = [
  { id: "amara", name: "Amara Chen", team: "Merchandising" },
  { id: "jules", name: "Jules Turner", team: "Operations" },
  { id: "noor", name: "Noor Bakker", team: "Buying" },
];
const initialRecords = [
  ["P-104", "Linen lounge chair"], ["P-108", "Turned oak stool"], ["P-113", "Stoneware bowl"],
  ["P-117", "Pleated desk lamp"], ["P-125", "Folding side table"], ["P-132", "Canvas daybed"],
];
const plural = count => count === 1 ? "record" : "records";

function search(step, query, count) {
  const options = step === "assignee" ? teammates : count ? [{ id: "assign", name: "Assign", team: "Choose a teammate" }] : [];
  const normalized = query.toLocaleLowerCase().trim();
  const matched = options.filter(option => (option.name + " " + option.team).toLocaleLowerCase().includes(normalized));
  if (!matched.length) {
    const reason = !count ? "Select at least one record to use commands." : "No matching results.";
    return '<div role="option" aria-disabled="true">' + reason + '</div>';
  }
  return matched.map(option => `<button type="button" role="option" tabindex="-1" id="cmd-opt-${option.id}"
    aria-selected="false" data-cmd-choice="${option.id}" class="cmd-choice"><strong>${option.name}</strong>
    <small>${option.team}</small><span aria-hidden="true">${step === "assignee" ? "↵" : "→"}</span></button>`).join("");
}

async function assignmentParams(req) {
  const chunks = [];
  let size = 0;
  for await (const chunk of req) {
    size += chunk.length;
    if (size > 8192) return null;
    chunks.push(chunk);
  }
  return new URLSearchParams(Buffer.concat(chunks).toString());
}

export function createFeature(saved) {
  const assignments = new Map(saved?.assignments);
  const records = initialRecords.map(([id, name]) => ({ id, name }));
  function table(checked = new Set(), message = "") {
    return `<div class="cmd-toolbar"><div><strong>Catalog inventory</strong><span id="cmd-count" aria-live="polite">${checked.size} selected</span></div>
      <button id="cmd-launch" type="button" class="mero-button mero-button-outline" data-mero-open="cmd-dialog"
        aria-keyshortcuts="Meta+K Control+K">Commands <kbd class="mero-kbd" data-cmd-shortcut>Ctrl K</kbd></button></div>
      <table class="mero-table cmd-table"><thead><tr><th scope="col"><input type="checkbox" aria-label="Select all six records" id="cmd-all" ${checked.size === records.length ? "checked" : ""}></th>
        <th scope="col">Product</th><th scope="col">Assignee</th></tr></thead><tbody>${records.map(row => `<tr><td><input type="checkbox" name="record"
         value="${row.id}" aria-label="Select ${row.name}" ${checked.has(row.id) ? "checked" : ""}></td>
        <th scope="row">${row.name}<small>${row.id}</small></th><td><span class="cmd-owner">${teammates.find(person => person.id === assignments.get(row.id))?.name ?? "Unassigned"}</span></td></tr>`).join("")}</tbody></table>
        <div class="cmd-message" role="status">${message}</div>`;
  }

  function render() {
    return `<section id="cmd-work"><header class="cmd-heading"><h1>Product assignments</h1><p>Select records and open Commands to assign them to a teammate.</p></header><div id="cmd-records">${table()}</div>
      <dialog class="mero-dialog mero-command" data-mero-command id="cmd-dialog" aria-labelledby="cmd-heading">
        <div class="cmd-dialog-header"><div><small id="cmd-context"></small><h2 id="cmd-heading">Run a command</h2></div>
          <button type="button" class="mero-button mero-button-outline" data-mero-close aria-label="Close commands">Close</button></div>
        <div class="mero-combo" data-mero-combo data-mero-combo-remote>
          <input type="hidden" name="step" id="cmd-step" value="action">
          <label for="cmd-search" class="cmd-sr">Search commands or teammates</label>
          <input class="mero-input" type="text" role="combobox" aria-expanded="false" aria-autocomplete="list"
            aria-controls="cmd-options" id="cmd-search" name="q" autocomplete="off" placeholder="Search commands…" autofocus
            hx-get="${prefix}/options" hx-trigger="input changed delay:100ms, mero:query" hx-sync="this:replace"
            hx-include="#cmd-step, #cmd-records input[name=record]:checked" hx-target="#cmd-options" hx-swap="innerHTML">
          <div id="cmd-options" class="mero-listbox mero-combo-list" role="listbox" aria-label="Results" hidden></div>
          <span class="mero-description" data-mero-combo-status role="status"></span>
        </div>
        <button type="button" id="cmd-back" class="mero-button mero-button-outline" hidden>← Back to commands</button>
        <p id="cmd-error" role="alert"></p>
        <form id="cmd-assign-form" hx-post="${prefix}/assign" hx-include="#cmd-records input[name=record]:checked" hx-target="#cmd-records" hx-swap="innerHTML">
          <input type="hidden" id="cmd-assignee" name="assignee"></form>
      </dialog></section>`;
  }

  async function handle(req, res, url) {
    if (url.pathname === prefix + "/options" && req.method === "GET") {
      res.writeHead(200, { "Content-Type": "text/html; charset=utf-8", "Cache-Control": "no-store" });
      res.end(search(url.searchParams.get("step"), url.searchParams.get("q") || "", url.searchParams.getAll("record").length));
      return;
    }
    if (url.pathname === prefix + "/assign" && req.method === "POST") {
      const data = await assignmentParams(req);
      if (!data) {
        res.writeHead(413).end("The assignment form is too large.");
        return;
      }
      const selected = new Set(data.getAll("record"));
      const member = teammates.find(person => person.id === data.get("assignee"));
      if (!member || !selected.size || [...selected].some(id => !records.some(row => row.id === id))) {
        res.writeHead(422).end("Choose existing records and a teammate.");
        return;
      }
      for (const id of selected) assignments.set(id, member.id);
      res.writeHead(200, { "Content-Type": "text/html; charset=utf-8", "HX-Trigger": "cmd:assigned" });
      res.end(table(selected, `Assigned ${selected.size} ${plural(selected.size)} to ${member.name}.`));
      return;
    }
    res.writeHead(404).end();
  }
  return { render, handle, snapshot: () => ({ assignments: [...assignments] }) };
}
