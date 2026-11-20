function page(title, description, sections) {
  const body = `<article class="site-wrap info-page" aria-labelledby="info-title">
    <header class="docs-heading"><h1 id="info-title">${title}</h1><p>${description}</p></header>
    ${sections.map(([heading, content]) => `<section><h2>${heading}</h2><div>${content}</div></section>`).join("\n")}
  </article>`;
  return { title, description, body };
}

export const infoPages = new Map([
  ["/about", page("About Mero UI", "Mero UI is a component library for developers who build interfaces with server-rendered HTML and htmx.", [
    ["How the components work", `<p>Choose a component, copy its HTML into your template and load the assets listed with the example. For a button that fetches data or a form that saves a record, point its htmx attributes at a route that returns HTML.</p>
      <p><a href="/start">Follow the quick start</a> or <a href="/components">browse the component catalog</a>.</p>`],
    ["What happens after a save?", `<p>Try an invalid edit in the inventory playground. The server sends back the form with the values you entered. The drawer stays open and focus moves to the field that needs fixing. Open the HTTP exchange to see the response that made it happen.</p>
      <p><a href="/playground">Try the inventory editor</a>.</p>`],
    ["Why Mero?", `<p>The name comes from the Greek <i>méros</i> (<span lang="grc">μέρος</span>), meaning “part.” With htmx, a single row in a table can be the part your server sends back.</p>
      <p>Say you change the quantity of an inventory item and click Save. The form’s <code>hx-post</code> attribute tells htmx where to send the edit. Your server saves the quantity and returns the updated row as HTML. With <code>hx-target</code> pointing to the row and <code>hx-swap="outerHTML"</code>, htmx replaces that row in place.</p>
      <p>Mero gives you the markup and styles for the form and the table. Your server can use the same row template to render the full table on the first visit and a single row after an edit. See the <a href="https://htmx.org/docs/">official htmx documentation</a>.</p>`],
  ])],
  ["/terms", page("Terms of use", "These terms cover the Mero UI documentation, interactive demos and source downloads.", [
    ["Using the demos", `<p>Use sample data when trying the forms, workspace, mail and chat. Some demos share changes with other visitors on the same server. The sample records reset when that server restarts.</p>
      <p><a href="/privacy">See how the demos handle data</a>.</p>`],
    ["Using the source", `<p>Check the license information before using Mero UI code in a project or sharing a copy. The download includes separate notices for htmx and the Geist fonts.</p>
      <p><a href="/license">Read the license information</a>.</p>`],
    ["Running your own application", `<p>The example server demonstrates requests and responses using in-memory data. Your application is responsible for checking permissions, validating incoming data and storing any records you need to keep.</p>`],
  ])],
  ["/license", page("License", "Mero UI code and examples use the MIT license. Bundled dependencies carry their own licenses.", [
    ["Mero UI source", `<p>You can use, modify and distribute Mero UI under the <a href="https://github.com/rubenlangeweg/mero-ui/blob/main/LICENSE">MIT license</a>. Include its copyright and permission notice with copies or substantial portions of the code.</p>`],
    ["htmx", `<p>The bundled htmx JavaScript library uses the Zero-Clause BSD license (0BSD).</p>
      <p><a href="/vendor/HTMX-LICENSE.txt">Read the bundled htmx license</a>.</p>`],
    ["Geist fonts", `<p>Geist and Geist Mono use the SIL Open Font License 1.1. Their notices identify The Geist Project Authors as the copyright holders.</p>
      <ul><li><a href="/fonts/geist-LICENSE.txt">Geist license and copyright notice</a></li><li><a href="/fonts/geist-mono-LICENSE.txt">Geist Mono license and copyright notice</a></li></ul>`],
  ])],
  ["/privacy", page("Privacy", "The Mero UI preview keeps your theme preference in your browser and stores submitted demo edits in the sample server’s memory.", [
    ["What the server receives", `<p>Submitting a demo form sends the entered values to the server running this preview. Inventory records and Studio workspace edits are shared across visitors to that server. Use fictional details in these examples.</p>
      <p>The mail and chat layouts use a session cookie named <code>relay_comm</code> to keep your conversations separate. Sending a message adds it to the demo session. Restarting the sample server clears its in-memory records.</p>`],
    ["What your browser remembers", `<p>The theme switch stores your light or dark preference in local storage. Mail and chat keep unsent drafts in the tab’s session storage. htmx also uses session storage for navigation history.</p>
      <p>To remove the saved preference, drafts and session cookie, clear this site’s data in your browser settings. This removes the browser’s copy. Shared records on the demo server have a separate lifetime.</p>`],
  ])],
]);
