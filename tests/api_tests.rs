use axum::{
    body::Body,
    http::{header, Request, StatusCode},
};
use http_body_util::BodyExt;
use shapemyimage::create_app;
use tower::ServiceExt;

#[tokio::test]
async fn test_health_endpoint() {
    let app = create_app();

    let response = app
        .oneshot(
            Request::builder()
                .uri("/api/health")
                .body(Body::empty())
                .unwrap(),
        )
        .await
        .unwrap();

    assert_eq!(response.status(), StatusCode::OK);

    // verify security headers
    let headers = response.headers();
    assert_eq!(
        headers.get(header::X_CONTENT_TYPE_OPTIONS).unwrap(),
        "nosniff"
    );
    assert_eq!(headers.get(header::X_FRAME_OPTIONS).unwrap(), "DENY");
    assert!(headers.get(header::CONTENT_SECURITY_POLICY).is_some());

    let body = response.into_body().collect().await.unwrap().to_bytes();
    let json: serde_json::Value = serde_json::from_slice(&body).unwrap();

    assert_eq!(json["status"], "ok");
    assert_eq!(json["app"], "shapemyimage");
    assert!(json["uptime_seconds"].as_u64().is_some());
}

#[tokio::test]
async fn test_validate_image_endpoint() {
    let app = create_app();

    // test empty body
    let response = app
        .clone()
        .oneshot(
            Request::builder()
                .method("POST")
                .uri("/api/validate-image")
                .body(Body::empty())
                .unwrap(),
        )
        .await
        .unwrap();

    assert_eq!(response.status(), StatusCode::BAD_REQUEST);

    // test invalid non-image bytes
    let response = app
        .clone()
        .oneshot(
            Request::builder()
                .method("POST")
                .uri("/api/validate-image")
                .body(Body::from(vec![0x01, 0x02, 0x03, 0x04]))
                .unwrap(),
        )
        .await
        .unwrap();

    assert_eq!(response.status(), StatusCode::UNSUPPORTED_MEDIA_TYPE);

    // test valid png file from test assets
    let png_bytes = std::fs::read("test_assets/square_1000x1000.png")
        .expect("Test asset square_1000x1000.png should exist");

    let response = app
        .oneshot(
            Request::builder()
                .method("POST")
                .uri("/api/validate-image")
                .body(Body::from(png_bytes))
                .unwrap(),
        )
        .await
        .unwrap();

    assert_eq!(response.status(), StatusCode::OK);
    let body = response.into_body().collect().await.unwrap().to_bytes();
    let json: serde_json::Value = serde_json::from_slice(&body).unwrap();

    assert_eq!(json["success"], true);
    assert_eq!(json["format"], "PNG");
    assert_eq!(json["width"], 1000);
    assert_eq!(json["height"], 1000);
    assert_eq!(json["category"], "Square");
}

#[tokio::test]
async fn test_static_index_serving() {
    let app = create_app();

    let response = app
        .oneshot(
            Request::builder()
                .uri("/")
                .body(Body::empty())
                .unwrap(),
        )
        .await
        .unwrap();

    assert_eq!(response.status(), StatusCode::OK);
    let body = response.into_body().collect().await.unwrap().to_bytes();
    let html = String::from_utf8_lossy(&body);

    assert!(html.contains("ShapeMyImage"));
    assert!(html.contains("Make every image fit your shape."));
    assert!(html.contains("id=\"preview-canvas\""));
}
