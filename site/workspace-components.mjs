import { escapeHtml as esc } from "./html.mjs";

const actionClass = "rl-button rl-button-sm rl-button-secondary";
const primaryClass = "rl-button rl-button-sm rl-button-primary";

const iconPaths = {
  home: '<path d="m3 10 9-7 9 7v10a1 1 0 0 1-1 1h-5v-7H9v7H4a1 1 0 0 1-1-1Z"/>',
  inventory: '<rect x="3" y="3" width="18" height="18" rx="3"/><path d="M3 9h18M9 9v12"/>',
  settings: '<path d="M4 7h5m4 0h7M4 17h9m4 0h3"/><circle cx="11" cy="7" r="2"/><circle cx="15" cy="17" r="2"/>',
  plus: '<path d="M5 12h14m-7-7v14"/>',
  minus: '<path d="M5 12h14"/>',
  close: '<path d="m6 6 12 12M18 6 6 18"/>',
  chevron: '<path d="m6 9 6 6 6-6"/>',
};
function icon(name) {
  return `<svg class="rlw-icon" aria-hidden="true" focusable="false" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round">${iconPaths[name]}</svg>`;
}

function component(id, name, description, demo, notes) {
  const html = demo.trim();
  return { id, name, description, demo: html, code: html, notes };
}

const cellInfo = {
  color: { title: "Workspace accent", hint: "Used for team labels and highlights." },
  select: { title: "Start of week", hint: "The first day in your planning calendar." },
  slider: { title: "Preview size", hint: "Scale the thumbnails in your library." },
  switch: { title: "Release notifications", hint: "Receive an update when a release is ready." },
};

function cellControl(key) {
  if (key === "color") return '<input class="rlw-color" type="color" name="value" value="#56846f" aria-label="Workspace accent">';
  if (key === "select") return '<select class="rl-select" name="value" aria-label="Start of week"><option>Monday</option><option>Sunday</option><option>Saturday</option></select>';
  if (key === "slider") return '<input class="rl-slider" type="range" name="value" min="60" max="120" step="5" value="80" aria-label="Preview size">';
  return '<input class="rl-switch" type="checkbox" role="switch" name="value" value="on" aria-label="Release notifications" checked>';
}

function cell(key) {
  const { title, hint } = cellInfo[key];
  return `<form class="rlw-cell" hx-post="/demo/workspace/cell/${key}" hx-trigger="change" hx-target="find output" hx-sync="this:replace">
  <label class="rlw-cell-row"><span><strong>${title}</strong><small>${hint}</small></span>
    ${cellControl(key)}
  </label>
  <output role="status" class="rlw-status"></output>
</form>`;
}

function choiceGroup(type, name, title, choices) {
  return `<form class="rlw-cardform"><fieldset class="rlw-choices">
  <legend>${title}</legend>
  ${choices.map(([label, detail, value], index) => `<label class="rlw-choice"><input class="rl-${type}" type="${type}" name="${name}" value="${value}"${index === 0 ? " checked" : ""}><span><strong>${label}</strong><small>${detail}</small></span></label>`).join("\n  ")}
</fieldset></form>`;
}

function fileForm(drop) {
  return `<form class="rlw-upload" method="post" enctype="multipart/form-data" hx-post="/demo/workspace/upload" hx-encoding="multipart/form-data" hx-target="find output" hx-sync="this:replace" data-rlw-upload>
  <label class="${drop ? "rlw-drop" : "rlw-file"}">${drop ? '<span aria-hidden="true" class="rlw-upload-icon">↑</span><strong>Drop a product image</strong><small>or choose a file · PNG or JPEG, up to 2 MB</small>' : '<strong>Product photography</strong><small>Choose a PNG or JPEG up to 2 MB.</small>'}
    <input name="photo" type="file" accept="image/png,image/jpeg" required aria-label="Product image">
  </label>
  ${drop ? '<span class="rlw-file-name" aria-live="polite"></span>' : ""}
  <button class="${actionClass}" type="submit">Check image</button>
  <output class="rlw-status" role="status"></output>
</form>`;
}

const inlineSelect = `<label class="rlw-inline">Publish to
  <select class="rl-select rlw-inline-select" name="audience"><option>Team only</option><option>Everyone</option><option>Just me</option></select>
</label>`;

const stepperNumber = `<div class="rlw-labeled"><strong>Seats</strong>
  <span class="rlw-step-number" data-rlw-number>
    <button type="button" aria-label="Remove one seat" data-step="-1">${icon("minus")}</button>
    <input type="number" name="seats" aria-label="Seats" min="1" max="12" step="1" value="3" inputmode="numeric">
    <button type="button" aria-label="Add one seat" data-step="1">${icon("plus")}</button>
  </span>
  <small>1 to 12 seats per workspace</small>
</div>`;

const nativeSelect = `<label class="rlw-labeled rlw-workspace-picker"><strong>Default workspace</strong>
  <select class="rl-select" name="workspace"><optgroup label="Design"><option>Studio North</option><option>Archive</option></optgroup><optgroup label="Operations"><option>Production</option></optgroup></select>
</label>`;

const richEditor = `<form class="rlw-editor" data-rlw-editor hx-post="/demo/workspace/preview" hx-target="find output">
  <div class="rlw-editor-tools" role="group" aria-label="Text formatting" hidden>
    <button type="button" data-format="bold" aria-label="Bold" aria-pressed="false"><b>B</b></button>
    <button type="button" data-format="italic" aria-label="Italic" aria-pressed="false"><i>I</i></button>
  </div>
  <textarea class="rl-input" name="body" aria-label="Product description" maxlength="4000">A lamp for the quiet hours.</textarea>
  <button class="${actionClass}" type="submit">Preview description</button>
  <output class="rlw-rich-preview" aria-live="polite"></output>
</form>`;

const navLinks = [["Overview", "/layouts/dashboard"], ["Inventory", "/layouts/dashboard?view=inventory"], ["Settings", "/layouts/dashboard?view=settings"]];
function nav(label, links = navLinks) {
  return `<nav aria-label="${label}">${links.map(([text, href]) => `<a href="${href}">${text}</a>`).join("")}</nav>`;
}

function appLayout(sidebarOnly = false) {
  return `<section class="rlw-shell" data-rlw-shell aria-label="Studio workspace">
  <aside class="rlw-side"><strong>Studio North</strong>${nav("Workspace sidebar")}</aside>
  <div class="rlw-shell-main">
    <button class="${actionClass} rlw-mobile-nav" type="button" data-rlw-open>Open navigation</button>
    <header><small>Studio North</small><h2>${sidebarOnly ? "Workspace" : "Release room"}</h2></header>
    <div class="rlw-summary"><span class="rlw-dot"></span><div><strong>Spring collection</strong><small>Photography approved</small></div></div>
    <a class="rl-link" href="/layouts/dashboard?view=inventory">Open inventory →</a>
  </div>
  <dialog class="rl-dialog rlw-drawer" aria-label="Workspace navigation"><div class="rl-dialog-body">
    <button class="${actionClass}" type="button" data-rl-close autofocus>Close navigation</button>
    ${nav("Mobile workspace")}
  </div></dialog>
</section>`;
}

const command = `<section class="rlw-command" data-rlw-command>
  <button class="rlw-launch" type="button" data-rlw-open><span>Search commands</span><kbd>⌘ / Ctrl K</kbd></button>
  <dialog class="rl-dialog rlw-command-dialog" aria-label="Workspace commands">
    <div class="rlw-command-head"><input type="search" data-command-search placeholder="Search pages and actions…" aria-label="Search commands" autofocus><button type="button" data-rl-close aria-label="Close commands">${icon("close")}</button></div>
    <div class="rlw-command-items">
      <a href="/layouts/dashboard?view=inventory"><strong>Open inventory</strong><small>Workspace</small></a>
      <a href="/layouts/dashboard?view=settings"><strong>Workspace settings</strong><small>Workspace</small></a>
      <button type="button" data-command-copy><strong>Copy page link</strong><small>Action</small></button>
    </div>
    <p class="rlw-command-empty" hidden>No matching commands</p>
  </dialog>
  <output class="rlw-status" role="status"></output>
</section>`;

const contextMenu = `<section class="rlw-context" data-rlw-context>
  <div class="rlw-context-row" tabindex="0" aria-label="Product sheet. Press Shift F10 for actions"><span><strong>Product sheet</strong><small>Studio documents</small></span><button class="${actionClass}" type="button" data-rlw-context-open aria-haspopup="menu" aria-expanded="false">Actions</button></div>
  <div class="rlw-menu" role="menu" aria-label="Product sheet actions" hidden>
    <button role="menuitem" tabindex="-1" type="button" data-rlw-action="pin">Pin document</button>
    <a role="menuitem" tabindex="-1" href="/layouts/dashboard?view=inventory">Open inventory</a>
  </div>
  <output class="rlw-status" role="status"></output>
</section>`;

const segment = `<form><fieldset class="rlw-segment"><legend class="rlw-sr">Preview density</legend>
  <label><input name="density" type="radio" value="compact">Compact</label>
  <label><input name="density" type="radio" value="regular" checked>Regular</label>
  <label><input name="density" type="radio" value="spacious">Spacious</label>
</fieldset></form>`;

const flowSteps = [
  ["Details", '<label class="rlw-labeled"><strong>Project name</strong><input class="rl-input" name="project" required maxlength="80" placeholder="Spring collection"></label>'],
  ["Access", '<label class="rlw-labeled"><strong>Access level</strong><select class="rl-select" name="access"><option>Team only</option><option>Private</option></select></label>'],
  ["Review", '<p data-rlw-review></p>'],
];
const stepper = `<form class="rlw-wizard" data-rlw-wizard hx-post="/demo/workspace/project" hx-target="find output">
  <ol aria-label="Project setup">${flowSteps.map(([name], i) => `<li${i === 0 ? ' aria-current="step"' : ""}>${name}</li>`).join("")}</ol>
  ${flowSteps.map(([title, fields], i) => `<section${i !== 0 ? " hidden" : ""}><h2 tabindex="-1">${title}</h2>${fields}</section>`).join("\n  ")}
  <footer><button class="${actionClass}" data-rlw-back type="button" hidden>Back</button><button class="${primaryClass}" data-rlw-next type="button">Continue</button><button class="${primaryClass}" data-rlw-finish type="submit" hidden>Confirm setup</button></footer>
  <output role="status" class="rlw-status"></output>
</form>`;

function resizable(adaptive = false) {
  return `<div class="rlw-split" data-rlw-split${adaptive ? ' data-rlw-snap data-rlw-snap-key="catalog-collection"' : ""}>
  <section id="lighting-collection"><small>Collection</small><h2>Lighting</h2><p>Pendant lights<br>Table lamps<br>Wall lights</p></section>
  <div class="rlw-split-handle" role="separator" aria-label="Resize collection and details" aria-controls="lighting-collection" aria-orientation="vertical" aria-valuemin="20" aria-valuemax="80" aria-valuenow="40" tabindex="0"></div>
  <section><small>Selected item</small><h2>Arc Task Lamp</h2><p>${adaptive ? "Drag the divider and release it near the same width three times. On the next pass, feel where it catches." : "Adjust the divider to change the space available to each panel."}</p></section>
</div>`;
}

const emojiChoices = [["✳️","spark"],["👍","thumbs up"],["❤️","heart"],["🎉","celebrate"],["✅","done"],["👀","watching"],["💡","idea"],["🌿","leaf"],["⭐","star"],["🔥","fire"],["🚀","rocket"],["☕","coffee"]];
const emojiPicker = `<div class="rlw-emoji" data-rlw-emoji>
  <button class="${actionClass}" type="button" data-rlw-open>Choose a reaction</button>
  <dialog class="rl-dialog" aria-label="Choose an emoji"><div class="rl-dialog-body">
    <div class="rlw-command-head"><input type="search" placeholder="Find an emoji" aria-label="Search emoji" autofocus><button type="button" aria-label="Close picker" data-rl-close>${icon("close")}</button></div>
    <div class="rlw-emoji-grid">${emojiChoices.map(([emoji, label]) => `<button type="button" aria-label="${label}">${emoji}</button>`).join("")}</div><p class="rlw-command-empty" hidden>No matching emoji</p>
  </div></dialog>
  <input type="hidden" name="reaction" value=""><output role="status" class="rlw-status"></output>
</div>`;

const joinedFilter = `<form class="rlw-filter" hx-get="/demo/workspace/filter" hx-target="find output" hx-sync="this:replace">
  <div class="rlw-join"><input type="search" name="q" class="rl-input" placeholder="Find a product" aria-label="Search products"><select name="status" class="rl-select" aria-label="Filter by status"><option value="">All states</option><option>Draft</option><option>Ready</option></select><button class="${primaryClass}" type="submit">Filter</button></div>
  <output class="rlw-results" aria-live="polite">${filterResults(new URLSearchParams())}</output>
</form>`;

const menu = `<details class="rlw-mega"><summary>Browse the library ${icon("chevron")}</summary>
  <div><section><strong>Components</strong>${nav("Component categories", [["Form controls","/components/native-select"],["Navigation","/components/sidebar"],["Overlays","/components/emoji-picker"]])}</section><section><strong>Workspaces</strong>${nav("Workspace examples")}</section></div>
</details>`;
const dock = `<nav class="rlw-dock" aria-label="Workspace shortcuts">
  <a href="/layouts/dashboard">${icon("home")}Overview</a><a href="/layouts/dashboard?view=inventory">${icon("inventory")}Inventory</a><a href="/layouts/dashboard?view=settings">${icon("settings")}Settings</a>
</nav>`;
const fab = `<details class="rlw-fab"><summary aria-label="Quick actions">${icon("plus")}</summary>
  <nav aria-label="Quick actions"><a href="/layouts/dashboard?view=inventory">Manage inventory</a><a href="/layouts/dashboard?view=settings">Workspace settings</a></nav>
</details>`;

export const groups = [
  { name: "Workspace forms", items: [
    ...[["color","Color Picker"],["select","Select"],["slider","Slider"],["switch","Switch"]].map(([key,name]) => component(`cell-${key === "color" ? "color-picker" : key}`, `Cell ${name}`, "Change one preference and receive inline confirmation from the server.", cell(key), "The local endpoint validates the value and returns a status fragment. Persist it in your own settings handler.")),
    component("checkbox-button-group", "Checkbox Button Group", "Select several release channels using native checkboxes.", choiceGroup("checkbox","channels","Release channels",[["Email","Send the launch email","email"],["Storefront","Publish on the storefront","web"],["Mobile","Notify app subscribers","mobile"]])),
    component("radio-button-group", "Radio Button Group", "Choose one release schedule with labelled option cards.", choiceGroup("radio","schedule","Release schedule",[["Manual","Publish when the collection is ready","manual"],["Scheduled","Use the workspace calendar","scheduled"]])),
    component("native-select", "Native Select", "Choose a workspace from labelled option groups.", nativeSelect),
    component("inline-select", "Inline Select", "Change an audience within the sentence that describes it.", inlineSelect),
    component("number-stepper", "Number Stepper", "Change a bounded quantity with the keyboard or step buttons.", stepperNumber),
    component("file-input", "File Input", "Choose a local product image and validate it on the server.", fileForm(false)),
    component("drop-zone", "Drop Zone", "Drop an image or use the native file picker and check the file.", fileForm(true), "The local server checks the file signature and 2 MB limit, then discards the bytes. Your endpoint controls storage."),
    component("rich-text-editor", "Rich Text Editor", "Edit a short description with bold and italic text and preview the submitted result.", richEditor, "The server receives text runs with bold and italic flags and escapes their contents. Pasted content is plain text."),
    component("joined-filter", "Joined Filter", "Search and filter releases with one server request.", joinedFilter),
  ]},
  { name: "Workspace navigation", items: [
    component("app-layout","App Layout","A responsive workspace with a sidebar, content area and mobile navigation drawer.",appLayout()),
    component("sidebar","Sidebar","Navigate the workspace from a side rail that becomes a drawer at narrow widths.",appLayout(true)),
    component("navbar","Navbar","Place the workspace name and destinations in a wrapping top bar.",`<header class="rlw-navbar"><strong>Studio North</strong>${nav("Primary navigation")}</header>`),
    component("command","Command","Search destinations and actions, then use the arrows and Enter to execute.",command,"Click the trigger or press Cmd/Ctrl K. Escape returns focus to where you were working."),
    component("context-menu","Context Menu","Open item actions with the visible button, a secondary click, or Shift F10.",contextMenu),
    component("segment","Segment","Choose one display density in a compact segmented control.",segment),
    component("stepper","Stepper","Move through validated project details and review the values before submitting.",stepper),
    component("dock","Dock","Group frequently used workspace destinations in a compact navigation dock.",dock),
    component("megamenu","Megamenu","Explore grouped destinations from a native disclosure.",menu),
    component("fab","Floating Action Button","Reveal a small set of workspace shortcuts.",fab),
  ]},
  { name: "Workspace tools", items: [
    {
      ...component("resizable","Resizable","Resize two adjacent panels by dragging the divider or using the arrow keys.",resizable(),"Home and End choose the minimum and maximum panel widths."),
      variants: [{
        name: "Adaptive",
        description: "The divider learns where you usually release it and snaps to that width. Recent drags count more.",
        demo: resizable(true),
        notes: "For a precise width, hold the divider still when it snaps, then keep dragging. Arrow keys move one pixel at a time. Hold Shift for ten pixels. Add data-rlw-snap to enable snapping. Give each divider its own data-rlw-snap-key to remember its width and recent stops across reloads and HTMX swaps in this tab.",
      }],
      relatedExample: { href: "/layouts/mail", label: "Try the divider in Mail" },
    },
    component("emoji-picker","Emoji Picker","Search named reactions and submit the selected emoji as a form value.",emojiPicker),
  ]},
];

function filterResults(params) {
  const products = [["Arc Task Lamp","Ready"],["Studio stool","Draft"],["Field notebook","Ready"]];
  const query = (params.get("q") ?? "").trim().toLowerCase();
  const status = params.get("status");
  const filtered = products.filter(([name,state]) => name.toLowerCase().includes(query) && (!status || state === status));
  return filtered.length ? filtered.map(([name,state]) => `<span><strong>${name}</strong> <small>${state}</small></span>`).join("") : "No matching products.";
}

function send(response, body, status = 200) {
  response.writeHead(status, { "Content-Type": "text/html; charset=utf-8", "X-Content-Type-Options": "nosniff", "Cache-Control":"no-store" });
  response.end(body);
  return true;
}

async function readBody(request, limit) {
  if (Number(request.headers["content-length"]) > limit) {
    request.resume();
    return null;
  }
  const chunks = [];
  let total = 0;
  for await (const chunk of request) {
    total += chunk.length;
    if (total <= limit) chunks.push(chunk);
  }
  return total > limit ? null : Buffer.concat(chunks);
}

function validCell(key, value) {
  if (key === "color") return /^#[a-f0-9]{6}$/i.test(value);
  if (key === "select") return ["Monday","Sunday","Saturday"].includes(value);
  if (key === "slider") return /^(60|65|70|75|80|85|90|95|100|105|110|115|120)$/.test(value);
  return key === "switch" && ["on","off"].includes(value);
}

async function checkUpload(request, response) {
  const limit = 2 * 1024 * 1024;
  const bytes = await readBody(request, limit + 65536);
  if (!bytes) return send(response, "Choose an image up to 2 MB.", 413);
  let file;
  try {
    const form = await new Response(bytes, { headers: { "content-type": request.headers["content-type"] || "" } }).formData();
    file = form.get("photo");
  } catch { return send(response, "Choose a PNG or JPEG file.", 422); }
  if (!(file instanceof File) || !file.size || file.size > limit) return send(response, "Choose one PNG or JPEG up to 2 MB.", 422);
  const head = Buffer.from(await file.slice(0,8).arrayBuffer());
  const png = head.equals(Buffer.from([137,80,78,71,13,10,26,10]));
  const jpeg = head[0] === 255 && head[1] === 216 && head[2] === 255;
  if (!png && !jpeg) return send(response,"The file signature must match PNG or JPEG.",422);
  return send(response, `${esc(file.name)} passed the ${png ? "PNG" : "JPEG"} signature and size checks.`);
}

export async function handleWorkspaceRequest(request, response, url) {
  if (!url.pathname.startsWith("/demo/workspace/")) return false;
  const route = url.pathname.slice("/demo/workspace/".length);
  if (route === "filter" && request.method === "GET") return send(response, filterResults(url.searchParams));
  if (request.method !== "POST") return send(response, "Method unavailable.", 405);
  if (route === "upload") return checkUpload(request, response);
  // Form-encoded Unicode and formatting per character can be much larger than the edited text.
  const bytes = await readBody(request, route === "preview" ? 1024 * 1024 : 32768);
  if (!bytes) return send(response,"The form is too large.",413);
  const params = new URLSearchParams(bytes.toString("utf8"));
  if (route.startsWith("cell/")) {
    const key = route.slice(5);
    const value = params.get("value") ?? (key === "switch" ? "off" : "");
    if (!Object.hasOwn(cellInfo, key)) return send(response,"Unknown preference.",404);
    if (!validCell(key,value)) return send(response,"Choose a supported value.",422);
    return send(response,`${cellInfo[key].title}: ${esc(value)}${key === "slider" ? "%" : ""}`);
  }
  if (route === "project") {
    const project = (params.get("project") ?? "").trim();
    const access = params.get("access");
    if (!project || project.length > 80 || !["Private","Team only"].includes(access)) return send(response,"Enter a project name and choose an access level.",422);
    return send(response,`Setup confirmed for ${esc(project)} · ${esc(access)}.`);
  }
  if (route === "preview") {
    let runs;
    try { runs = params.has("runs") ? JSON.parse(params.get("runs")) : [{ text:params.get("body") || "" }]; }
    catch { return send(response,"Invalid text format.",422); }
    if (!Array.isArray(runs) || runs.some(r => !r || typeof r.text !== "string") || runs.reduce((sum,r) => sum + r.text.length,0) > 4000) return send(response,"Use up to 4,000 characters.",422);
    return send(response, runs.map(r => {
      let text = esc(r.text);
      if (r.bold === true) text = `<strong>${text}</strong>`;
      if (r.italic === true) text = `<em>${text}</em>`;
      return text;
    }).join("") || "Empty description.");
  }
  return send(response,"Example endpoint unavailable.",404);
}
