// POC: spreadsheet-like grid. Server renders <mero-grid rows cols><mero-grid-cell row col>…</mero-grid-cell></mero-grid>.
import { definePrimitive, createGridFocus, createCellRange, byCell, byCellRange, selects } from "@ui-sdk/core"
import { createParts } from "@ui-sdk/web"

const meroGrid = definePrimitive({
  name: "mero-grid",
  options: { rows: "number", cols: "number" },
  state: () => ({ active: null, range: null }),
  api: (context) => {
    const grid = createGridFocus(context, { key: "active", rows: () => context.options().rows ?? 0, cols: () => context.options().cols ?? 0 })
    const range = createCellRange(context, { key: "range", grid, rows: () => context.options().rows ?? 0, cols: () => context.options().cols ?? 0 })
    return {
      grid, range,
      selectCells: (top, left, bottom, right) => range.select({ anchor: { row: +top, col: +left }, end: { row: +bottom, col: +right } }),
      selectedBounds: () => range.bounds(context.store.get()),
    }
  },
  agent: { actions: ["selectCells"] },
  slots: (slot) => ({
    root: slot({
      attrs: () => ({ role: "grid", "aria-multiselectable": "true" }),
      bind: (el, part) => {
        let last = null
        return part.store.subscribe(() => {
          const b = part.api.range.bounds(part.store.get()); const key = JSON.stringify(b)
          if (key !== last) { last = key; el.dispatchEvent(new CustomEvent("mero:range", { bubbles: true, detail: b })) }
        })
      },
    }),
    cell: slot({
      props: { id: "string", row: "number", col: "number" },
      selects: selects({ active: byCell, range: byCellRange }),
      attrs: (state, { props, api }) => ({ role: "gridcell", tabindex: api.grid.tabIndex(state, props), ...api.range.cellAttrs(state, props) }),
      on: {
        keydown: (event, { api }) => api.range.keydown(event),
        pointerdown: (event, { api, props }) => api.range.pointerdown(event, props),
      },
      bind: (el, { api, props }) => api.range.bind(el, props),
    }),
  }),
})

createParts(meroGrid, {
  root: { tag: "mero-grid", display: "block", api: ["selectCells", "selectedBounds"] },
  cell: { tag: "mero-grid-cell", context: (el) => ({ id: `${el.getAttribute("row")}:${el.getAttribute("col")}` }) },
})
