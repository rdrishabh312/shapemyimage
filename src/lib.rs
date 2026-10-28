pub mod geometry;
pub mod handlers;
pub mod security;

use axum::{
    http::{header, HeaderValue},
    middleware::{self, Next},
    response::Response,
    routing::{get, post},
    Router,
};
use tower_http::{
    compression::CompressionLayer,
    limit::RequestBodyLimitLayer,
    services::{ServeDir, ServeFile},
    trace::TraceLayer,
};

// security headers middleware for hardened responses
async fn security_headers_middleware(
    req: axum::extract::Request,
    next: Next,
) -> Response {
    let mut response = next.run(req).await;
    let headers = response.headers_mut();

    headers.insert(
        header::X_CONTENT_TYPE_OPTIONS,
        HeaderValue::from_static("nosniff"),
    );
    headers.insert(
        header::X_FRAME_OPTIONS,
        HeaderValue::from_static("DENY"),
    );
    headers.insert(
        header::REFERRER_POLICY,
        HeaderValue::from_static("strict-origin-when-cross-origin"),
    );
    headers.insert(
        header::HeaderName::from_static("permissions-policy"),
        HeaderValue::from_static("camera=(), microphone=(), geolocation=()"),
    );
    headers.insert(
        header::CACHE_CONTROL,
        HeaderValue::from_static("no-cache, must-revalidate"),
    );
    headers.insert(
        header::CONTENT_SECURITY_POLICY,
        HeaderValue::from_static(
            "default-src 'self'; script-src 'self' 'unsafe-inline' https://fonts.googleapis.com; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; font-src 'self' https://fonts.gstatic.com; img-src 'self' blob: data:; connect-src 'self';",
        ),
    );

    response
}

// constructs the application router
pub fn create_app() -> Router {
    handlers::health::init_start_time();

    let static_service = ServeDir::new("static")
        .not_found_service(ServeFile::new("static/index.html"));

    Router::new()
        .route("/api/health", get(handlers::health::health_handler))
        .route("/api/validate-image", post(handlers::validate::validate_image_handler))
        .fallback_service(static_service)
        .layer(middleware::from_fn(security_headers_middleware))
        .layer(CompressionLayer::new())
        .layer(RequestBodyLimitLayer::new(security::MAX_IMAGE_FILE_SIZE))
        .layer(TraceLayer::new_for_http())
}
