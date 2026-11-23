use axum::{response::Html, routing::get, Router};
use tokio::net::TcpListener;
use tower_http::services::{ServeDir, ServeFile};

async fn stock_summary() -> Html<String> {
    let (total, active) = (6_u32, 4_u32);
    Html(format!("<strong>{total} products</strong> · {active} active"))
}

#[tokio::main(flavor = "current_thread")]
async fn main() -> std::io::Result<()> {
    let app = Router::new()
        .route_service("/", ServeFile::new("index.html"))
        .nest_service("/ui", ServeDir::new("../../ui"))
        .nest_service("/vendor", ServeDir::new("../../public/vendor"))
        .route("/demo/stock-summary", get(stock_summary));

    let listener = TcpListener::bind("127.0.0.1:4180").await?;
    axum::serve(listener, app).await
}
