# Studio Inventory

Run the example from the root of the extracted archive with Node 22 or later.

```sh
node examples/studio-inventory/server.mjs
```

Open [Studio Inventory](http://127.0.0.1:4183/). The download includes HTMX, Mero and the fonts. The sample server stores changes in memory. Use **Request scenarios** to slow a save, force a validation error or try a failed request. **Restore sample products** resets the sample records.

## Use your own backend

Use the HTML from `site/lab.mjs` and the asset tags from the example server. Set `basePath` to your inventory endpoint. For multiple blocks on a page, give each an `instance` such as `studio` or `tenant`. That name travels with requests and scopes DOM IDs in every response. The example at [Two inventories](http://127.0.0.1:4183/two) has independent stores, separate routes and a tenant color override.

| Request | Return |
| --- | --- |
| GET the collection | Filtered results as a replacement HTML fragment. |
| GET `/new`, `/:id/edit` or `/:id/delete` | A named native dialog with a form. |
| POST a valid create, edit or confirmed delete | Updated results and dashboard counters as out-of-band fragments. Send `HX-Reswap: none` and `HX-Trigger-After-Settle: {"mero:form-saved":{"message":"Saved"}}`. |
| POST invalid fields | HTTP 422 with the full form, submitted values and labelled errors. The first invalid field receives focus. |
| POST an edit or deletion after the same record changed elsewhere | HTTP 409. Keep the newer record and the open draft. Send a plain-text `Mero-Form-Error` response header to tell the user how to recover. |
| Request failure | The draft stays in place. The error message prompts the user to check the current record before retrying. |

Return an increasing `Inventory-Revision` on result reads and successful mutations to prevent a delayed read from overwriting a newer save. The bundled helper demonstrates the contract in `site/inventory-routes.mjs`. In a host app, use your own persisted revision and mutation handlers. Set `demoControls: false` on the sample handler to disable scenario injection and fixture resets.

Carry the record’s version in edit and delete forms. Keep that version in the replacement form after a validation error. If a reverse proxy terminates TLS, set the handler’s `origin` option to the public HTTPS origin.

Pass `brand` and `navigation` to `renderLayout` to use the host app’s title, links and active section. Apply `data-theme="light"` or `data-theme="dark"` and override the `--mero-*` CSS variables. The two-inventory example keeps its own accent colors.
