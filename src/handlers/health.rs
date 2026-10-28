use axum::{response::IntoResponse, Json};
use serde::Serialize;
use std::sync::atomic::{AtomicU64, Ordering};
use std::time::Instant;

static START_TIME: std::sync::OnceLock<Instant> = std::sync::OnceLock::new();
static REQUEST_COUNT: AtomicU64 = AtomicU64::new(0);

pub fn init_start_time() {
    START_TIME.get_or_init(Instant::now);
}

#[derive(Serialize)]
pub struct HealthResponse {
    pub status: &'static str,
    pub app: &'static str,
    pub version: &'static str,
    pub uptime_seconds: u64,
    pub total_requests: u64,
}

pub async fn health_handler() -> impl IntoResponse {
    let start = START_TIME.get_or_init(Instant::now);
    let uptime = start.elapsed().as_secs();
    let requests = REQUEST_COUNT.fetch_add(1, Ordering::Relaxed) + 1;

    Json(HealthResponse {
        status: "ok",
        app: "shapemyimage",
        version: env!("CARGO_PKG_VERSION"),
        uptime_seconds: uptime,
        total_requests: requests,
    })
}
