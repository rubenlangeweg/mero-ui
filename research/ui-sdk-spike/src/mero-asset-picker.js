// POC: asset picker. Multi-select (click, ctrl/cmd, shift, Space, Ctrl+A) + reorder of the selection group (drag or Space+arrows).
import { definePrimitive, createChange, createRovingFocus, createSelection, createReorder } from "@ui-sdk/core"
import { createParts } from "@ui-sdk/web"

const readKeys = (el) => [...el.querySelectorAll("mero-asset")].map((n) => n.getAttribute("value"))

const meroAssetPicker = definePrimitive({
  name: "mero-asset-picker",
  options: { defaultOrder: "value", selected: "value", defaultSelected: "value", onSelectedChange: "callback" },
  controlled: ["selected"],
  state: (o) => ({ order: o.defaultOrder ?? [], moving: null, selected: o.selected ?? o.defaultSelected ?? [], focused: null }),
  api: (context) => {
    const change = createChange(context)
    const roving = createRovingFocus(context, { slot: "asset", key: "focused", orientation: () => "both" })
    const selection = createSelection(context, { key: "selected", multiple: () => true, set: (v, d) => change("selected", v, d), order: () => context.store.get().order })
    const reorder = createReorder(context, {
      slot: "asset", key: "order", draft: "moving", orientation: () => "grid",
      set: (v, d) => change("order", v, d),
      group: (key) => { const { selected } = context.store.get(); return selected.includes(key) ? selected : [key] },
    })
    reorder.__state = () => context.store.get()
    return {
      roving, selection, reorder,
      selectAssets: (...keys) => change("selected", keys.flat(), { reason: "imperative" }),
      moveAsset: (key, index) => reorder.move(key, Number(index)),
      press(event, key) {
        const d = { reason: "item-press", event }
        if (event.shiftKey) selection.extend(key, { ...d, from: context.store.get().focused })
        else if (event.metaKey || event.ctrlKey) selection.toggle(key, d)
        else selection.choose(key, d)
      },
    }
  },
  agent: { actions: ["selectAssets", "moveAsset"] },
  slots: (slot) => ({
    root: slot({
      attrs: () => ({ role: "listbox", "aria-multiselectable": "true", "aria-orientation": "horizontal", "aria-roledescription": "sortable asset grid" }),
      bind: (el, part) => {
        const apply = () => {
          const s = part.store.get(); const order = part.api.reorder.order(s)
          const byKey = new Map([...el.querySelectorAll("mero-asset")].map((n) => [n.getAttribute("value"), n]))
          let prev = null
          for (const k of order) { const n = byKey.get(k); if (!n) continue; const want = prev ? prev.nextElementSibling : el.firstElementChild; if (want !== n) el[el.moveBefore ? "moveBefore" : "insertBefore"](n, want); prev = n }
        }
        apply(); return part.store.subscribe(apply)
      },
    }),
    asset: slot({
      props: { value: "string" },
      attrs: (state, part) => ({
        role: "option",
        "aria-selected": String(state.selected.includes(part.key)),
        tabindex: part.api.roving.tabIndex(state, part),
        "data-moving": part.api.reorder.moving(state, part.key) ? "" : undefined,
      }),
      on: {
        keydown: (event, { el, api, key }) => {
          // Key decision Mero must own: Space selects, Enter picks up (ui-sdk reorder binds both by default).
          const moving = api.reorder.moving(api.reorder.__state(), key)
          if (event.key === " " && !moving) { event.preventDefault(); return api.selection.toggle(key, { reason: "item-press", event }) }
          if (api.reorder.keydown(event, key)) return
          const moved = api.roving.keydown(event, el)
          if (moved?.shift) api.selection.extend(moved.key, { from: moved.from, reason: "list-navigation", event })
        },
        pointerdown: (event, { api, key }) => { api.press(event, key); api.reorder.pointerdown(event, key) },
      },
      bind: (el, part) => { const c = [part.api.roving.bind(el, part), part.api.reorder.bind(el, part)]; return () => c.forEach((f) => f()) },
    }),
  }),
})

createParts(meroAssetPicker, {
  root: { tag: "mero-asset-picker", display: "grid", options: (el) => ({ defaultOrder: readKeys(el) }), api: ["selectAssets", "moveAsset"] },
  asset: { tag: "mero-asset", display: "block" },
})
