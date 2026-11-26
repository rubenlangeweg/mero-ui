// POC: Mero tree reorder on top of @ui-sdk/core + @ui-sdk/web.
// Server renders <mero-tree><mero-tree-row value depth>…</mero-tree-row></mero-tree>.
import { definePrimitive, createChange, createRovingFocus, createTreeReorder } from "@ui-sdk/core"
import { createParts } from "@ui-sdk/web"

const readRows = (el) =>
  [...el.querySelectorAll("mero-tree-row")].map((row) => ({ key: row.getAttribute("value"), depth: Number(row.getAttribute("depth") || 0) }))

const meroTree = definePrimitive({
  name: "mero-tree",
  options: { defaultRows: "value", onRowsChange: "callback" },
  controlled: ["rows"],
  state: (options) => ({ rows: options.defaultRows ?? [], moving: null, focused: null }),
  api: (context) => {
    const change = createChange(context)
    const tree = createTreeReorder(context, {
      key: "rows",
      draft: "moving",
      set: (value, details) => change("rows", value, details),
      indent: () => 24,
    })
    const roving = createRovingFocus(context, { slot: "row", key: "focused" })
    return {
      tree,
      roving,
      // Agent-callable: move a category (and its subtree) before another, at a depth.
      moveCategory: (key, before, depth) => tree.move(key, before ?? null, Number(depth)),
      // NB: no `rows` method here — the agent bridge's "guess by name" turns a `rows` getter into an action.
    }
  },
  agent: { actions: ["moveCategory"] },
  slots: (slot) => ({
    root: slot({
      attrs: () => ({ role: "tree", "aria-roledescription": "sortable tree" }),
      bind: (el, part) => {
        // The adapter does not render children on web components: Mero must move the DOM itself.
        const apply = () => {
          const state = part.store.get()
          const rows = part.api.tree.rows(state)
          const byKey = new Map([...el.querySelectorAll("mero-tree-row")].map((n) => [n.getAttribute("value"), n]))
          let prev = null
          for (const { key, depth } of rows) {
            const node = byKey.get(key)
            if (!node) continue
            node.setAttribute("depth", String(depth))
            const want = prev ? prev.nextElementSibling : el.firstElementChild
            if (want !== node) {
              const move = el.moveBefore ? "moveBefore" : "insertBefore"
              el[move](node, want)
            }
            prev = node
          }
        }
        apply()
        return part.store.subscribe(apply)
      },
    }),
    row: slot({
      props: { value: "string", depth: "number" },
      attrs: (state, part) => {
        const row = part.api.tree.rows(state).find((r) => r.key === part.key)
        return {
          role: "treeitem",
          "aria-level": String((row?.depth ?? 0) + 1),
          tabindex: part.api.roving.tabIndex(state, part),
          "data-moving": part.api.tree.moving(state, part.key) ? "" : undefined,
        }
      },
      on: {
        keydown: (event, { el, api, key }) => api.tree.keydown(event, key) || api.roving.keydown(event, el),
        pointerdown: (event, { api, key }) => api.tree.pointerdown(event, key),
      },
      bind: (el, part) => {
        const cleanups = [part.api.roving.bind(el, part), part.api.tree.bind(el, part.key)]
        return () => cleanups.forEach((c) => c())
      },
    }),
  }),
})

createParts(meroTree, {
  root: {
    tag: "mero-tree",
    display: "block",
    options: (el) => ({ defaultRows: readRows(el) }),
    api: ["moveCategory"],
  },
  row: { tag: "mero-tree-row", display: "block" },
})

// Mero contract: re-emit as a bubbling mero:* event so Alpine/x-on and document listeners hear it.
for (const type of ["rowschange"]) {
  document.addEventListener(type, (event) => {
    const { value, reason, key, parent, index } = event.detail ?? {}
    event.target.dispatchEvent(new CustomEvent("mero:reorder", { bubbles: true, detail: { order: value, reason, key, parent, index } }))
  }, true)
}
export { meroTree }
