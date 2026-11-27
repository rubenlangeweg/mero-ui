# Full-flow Node starter

Zero-dependency Node.js 22+ server implementing the complete production Mero UI + HTMX 4 server contract:

- **Boosted navigation:** `data-mero-boost="#app-main"` with `hx-boost:inherited="true"`
- **CSRF protection:** `HttpOnly` cookie + `X-CSRF-Token` header / hidden input (HTTP 403 + `Mero-Action-Outcome: rejected`)
- **Validation:** HTTP 422 returning the filled-in form with `aria-invalid="true"` and `aria-describedby`
- **Optimistic concurrency:** HTTP 409 returning a conflict fragment with `data-mero-conflict-swap` and `data-mero-conflict-focus`
- **Form primitives:** `data-mero-dirty`, `data-mero-dirty-guard`, `data-mero-show-when="status!=Draft"`, `data-mero-multiselect`
- **Destructive delete:** `data-mero-confirm` typed phrase + required reason
- **Live progress:** `data-mero-live`, `data-mero-live-follow`, `Mero-Live-Interval`, `Mero-Live: done`, and 401 `HX-Redirect`

## Run

From the repository root:

```sh
node examples/backends/node/server.mjs
```

Open <http://127.0.0.1:4181>.
