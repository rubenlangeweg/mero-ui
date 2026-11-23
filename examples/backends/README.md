# Mero UI with Go or Rust

Run the same inventory button with Go’s standard library or Rust’s Axum. Each server serves the [HTML page](index.html), Mero assets and bundled HTMX 4 from this repository. Both run without Node.js or npm.

From the repository root (or the extracted Mero UI source archive), choose one command.

| Backend | Command |
| --- | --- |
| [Go 1.22+ with net/http and html/template](go/main.go) | `cd examples/backends && go run ./go/main.go` |
| [Rust stable with Cargo and Axum](rust/src/main.rs) | `cd examples/backends && cargo run --locked --manifest-path rust/Cargo.toml` |

Open <http://127.0.0.1:4180> and choose **Check inventory**. You should see **6 products · 4 active**. Stop the server with Ctrl+C before trying the other one.

To inspect the response directly, run `curl -i http://127.0.0.1:4180/demo/stock-summary`. The handler returns HTTP 200 and a `text/html` fragment. HTMX puts that fragment in the button’s adjacent `<output>`. The counts are sample data. In your app, read them from your inventory store.

[Use Mero UI in an existing app](https://mero-ui.rubenlangeweg.com/start)
