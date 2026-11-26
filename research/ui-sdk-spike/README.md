# UI SDK spike

Throwaway proof of concept for [docs/research/ui-sdk-behaviour-engine.md](../../docs/research/ui-sdk-behaviour-engine.md). This is not shipped: it sits outside `ui/`, outside the package `files` and outside `npm test`.

It builds three Mero-style components on `@ui-sdk/core` and `@ui-sdk/web` 0.1.0-beta.17:

| File | Component | UI SDK behaviours |
| --- | --- | --- |
| `src/mero-tree.js` | Reorderable category tree | `createTreeReorder`, `createRovingFocus` |
| `src/mero-grid.js` | Grid with keyboard focus and cell ranges | `createGridFocus`, `createCellRange` |
| `src/mero-asset-picker.js` | Asset picker with multi-select and group reorder | `createSelection`, `createReorder`, `createRovingFocus` |

`src/entry.js` bundles all three with the agent bridge. The bridge needs the same `@ui-sdk/core` instance as the components, so they must ship in one bundle.

## Run

```sh
cd research/ui-sdk-spike
npm install
NODE_PATH=$(npm root -g) npm test   # build, then the three Playwright runners
npm run size                        # minified + gzip sizes per entry in size/
```

`NODE_PATH` points at the pre-installed Playwright. The runners print observations; they do not assert. Read them against the evaluation.

| Runner | Checks |
| --- | --- |
| `run-tree.mjs` | Upgrade, keyboard reorder, announcement, `mero:reorder` event, agent `snapshot` and `act`, `innerMorph`, `innerHTML` swap, 50 swaps for leaks |
| `run-morph.mjs` | `innerMorph` with and without UI SDK, with and without a client-side reorder |
| `run-grid-picker.mjs` | Grid navigation and Shift ranges, picker selection and group reorder by key and pointer, agent `act`, axe |
