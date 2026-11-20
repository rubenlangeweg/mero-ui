// Shared by every core catalog family.
function exampleMarkup(markup) {
  const lines = markup.trimEnd().replace(/^\n/, "").split("\n")
  const indent = Math.min(...lines.filter(line => line.trim()).map(line => line.match(/^ */)[0].length))
  const demo = lines.map(line => line.slice(indent)).join("\n")
  if (/\bid="/.test(demo) && !demo.includes("data-mero-tabs")) {
    return '<div class="mero-scope" data-mero-scope>\n' + demo.replace(/^/gm, "  ") + '\n</div>'
  }
  return demo
}

export function item(id, name, description, markup, notes, variants = []) {
  const demo = exampleMarkup(markup)
  return { id, name, description, demo, code: demo, notes,
    variants: variants.map(([name, markup, guidance]) => {
      const demo = exampleMarkup(markup)
      return { name, demo, code: demo, ...guidance }
    }) }
}

// Default markup comes from empty params; previews pass the request query so ?links render server-side.
export function rendered(id, name, description, render, notes) {
  return { ...item(id, name, description, render(new URLSearchParams()), notes),
    render: params => exampleMarkup(render(params)) }
}

export function section(name, items) {
  return { name, items }
}

export function field(id, label, attributes, { type = "text", hint, className = "" } = {}) {
  return `
    <div class="mero-field">
      <label class="mero-label" for="${id}">${label}</label>
      <input class="mero-input${className ? ` ${className}` : ""}" id="${id}" type="${type}"${hint ? ` aria-describedby="${id}-hint"` : ""}${attributes ? ` ${attributes}` : ""}>
      ${hint ? `<p class="mero-description" id="${id}-hint">${hint}</p>` : ""}
    </div>`
}
