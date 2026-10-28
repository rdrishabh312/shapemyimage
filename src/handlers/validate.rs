use axum::{body::Bytes, http::StatusCode, response::IntoResponse, Json};
use serde::Serialize;
use crate::geometry::analyze_dimensions;
use crate::security::{validate_dimensions, validate_file_signature};

#[derive(Serialize)]
pub struct ValidateResponse {
    pub success: bool,
    pub format: Option<String>,
    pub width: Option<u32>,
    pub height: Option<u32>,
    pub category: Option<String>,
    pub ratio_label: Option<String>,
    pub error: Option<String>,
}

pub async fn validate_image_handler(body: Bytes) -> impl IntoResponse {
    if body.is_empty() {
        return (
            StatusCode::BAD_REQUEST,
            Json(ValidateResponse {
                success: false,
                format: None,
                width: None,
                height: None,
                category: None,
                ratio_label: None,
                error: Some("Request body is empty.".to_string()),
            }),
        );
    }

    let format_str = match validate_file_signature(&body) {
        Ok(fmt) => fmt,
        Err(err) => {
            return (
                StatusCode::UNSUPPORTED_MEDIA_TYPE,
                Json(ValidateResponse {
                    success: false,
                    format: None,
                    width: None,
                    height: None,
                    category: None,
                    ratio_label: None,
                    error: Some(err.to_string()),
                }),
            );
        }
    };

    // decode dimensions for raster images
    if format_str != "SVG" {
        match image::load_from_memory(&body) {
            Ok(img) => {
                let (w, h) = (img.width(), img.height());
                if let Err(dim_err) = validate_dimensions(w, h) {
                    return (
                        StatusCode::BAD_REQUEST,
                        Json(ValidateResponse {
                            success: false,
                            format: Some(format_str.to_string()),
                            width: Some(w),
                            height: Some(h),
                            category: None,
                            ratio_label: None,
                            error: Some(dim_err.to_string()),
                        }),
                    );
                }

                let analysis = analyze_dimensions(w, h);
                (
                    StatusCode::OK,
                    Json(ValidateResponse {
                        success: true,
                        format: Some(format_str.to_string()),
                        width: Some(w),
                        height: Some(h),
                        category: Some(format!("{:?}", analysis.category)),
                        ratio_label: Some(analysis.ratio_label),
                        error: None,
                    }),
                )
            }
            Err(e) => (
                StatusCode::BAD_REQUEST,
                Json(ValidateResponse {
                    success: false,
                    format: Some(format_str.to_string()),
                    width: None,
                    height: None,
                    category: None,
                    ratio_label: None,
                    error: Some(format!("Failed to parse image dimensions: {}", e)),
                }),
            ),
        }
    } else {
        // svg format
        (
            StatusCode::OK,
            Json(ValidateResponse {
                success: true,
                format: Some("SVG".to_string()),
                width: None,
                height: None,
                category: None,
                ratio_label: None,
                error: None,
            }),
        )
    }
}
