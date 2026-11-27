# Mero UI Backend Starters

Run the minimal inventory button with Go’s standard library or Rust’s Axum, or run the full-flow Node starter for CRUD, validation (422), optimistic concurrency (409), CSRF (403), multi-select, typed confirmation and live polling.

From the repository root (or the extracted Mero UI source archive), choose one command.

| Backend | Scope | Command |
| --- | --- | --- |
| [Go 1.22+ with net/http and html/template](go/main.go) | Minimal HTMX fragment (no Node.js) | `cd examples/backends && go run ./go/main.go` |
| [Rust stable with Cargo and Axum](rust/src/main.rs) | Minimal HTMX fragment (no Node.js) | `cd examples/backends && cargo run --locked --manifest-path rust/Cargo.toml` |
| [Node 22+ zero-dependency HTTP server](node/server.mjs) | Full-flow CRUD, 422, 409, 403 CSRF, 401 live redirect | `node examples/backends/node/server.mjs` |

For Go or Rust, open <http://127.0.0.1:4180> and choose **Check inventory** to see **6 products · 4 active**. Stop the server with Ctrl+C before trying the other one.

To inspect the minimal response directly, run `curl -i http://127.0.0.1:4180/demo/stock-summary`. The handler returns HTTP 200 and a `text/html` fragment. HTMX puts that fragment in the button’s adjacent `<output>`.

For the full-flow starter, open <http://127.0.0.1:4181>. See [node/README.md](node/README.md) for the complete route and header checklist.

[Use Mero UI in an existing app](https://mero-ui.rubenlangeweg.com/start)
