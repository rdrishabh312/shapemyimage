use serde::{Deserialize, Serialize};

pub const MAX_IMAGE_FILE_SIZE: usize = 50 * 1024 * 1024; // 50MB
pub const MAX_IMAGE_DIMENSION: u32 = 12_000; // 12,000 px
pub const MAX_IMAGE_MEGAPIXELS: f64 = 48.0;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ValidationResult {
    pub is_valid: bool,
    pub format: Option<String>,
    pub width: Option<u32>,
    pub height: Option<u32>,
    pub error_message: Option<String>,
}

// validates raw file bytes using magic byte signatures
pub fn validate_file_signature(bytes: &[u8]) -> Result<&'static str, &'static str> {
    if bytes.len() < 4 {
        return Err("File payload is empty or too small.");
    }

    // png signature: 89 50 4E 47 0D 0A 1A 0A
    if bytes.len() >= 8
        && bytes[0..8] == [0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A]
    {
        return Ok("PNG");
    }

    // jpeg signature: FF D8 FF
    if bytes[0..3] == [0xFF, 0xD8, 0xFF] {
        return Ok("JPEG");
    }

    // webp signature: RIFF .... WEBP
    if bytes.len() >= 12
        && &bytes[0..4] == b"RIFF"
        && &bytes[8..12] == b"WEBP"
    {
        return Ok("WebP");
    }

    // bmp signature: 'BM'
    if bytes[0..2] == [0x42, 0x4D] {
        return Ok("BMP");
    }

    // gif signature: 'GIF87a' or 'GIF89a'
    if bytes.len() >= 6
        && (&bytes[0..6] == b"GIF87a" || &bytes[0..6] == b"GIF89a")
    {
        return Ok("GIF");
    }

    // svg: check textual starts
    if let Ok(text) = std::str::from_utf8(&bytes[..bytes.len().min(1024)]) {
        let trimmed = text.trim();
        if trimmed.contains("<svg") || (trimmed.starts_with("<?xml") && trimmed.contains("<svg")) {
            return Ok("SVG");
        }
    }

    Err("Unsupported file format. Allowed formats: PNG, JPG, WebP, BMP, GIF, SVG.")
}

// validates image dimensions against memory exhaustion / decompression bomb bounds
pub fn validate_dimensions(width: u32, height: u32) -> Result<(), &'static str> {
    if width == 0 || height == 0 {
        return Err("Image has zero width or height.");
    }
    if width > MAX_IMAGE_DIMENSION || height > MAX_IMAGE_DIMENSION {
        return Err("Image dimensions exceed 12,000 px limit.");
    }
    let mp = (width as f64 * height as f64) / 1_000_000.0;
    if mp > MAX_IMAGE_MEGAPIXELS {
        return Err("Image pixel count exceeds 48 megapixels limit.");
    }
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_valid_magic_bytes() {
        let png_bytes = [0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A, 0x00, 0x00];
        assert_eq!(validate_file_signature(&png_bytes), Ok("PNG"));

        let jpeg_bytes = [0xFF, 0xD8, 0xFF, 0xE0, 0x00, 0x10];
        assert_eq!(validate_file_signature(&jpeg_bytes), Ok("JPEG"));

        let invalid_bytes = [0x00, 0x01, 0x02, 0x03];
        assert!(validate_file_signature(&invalid_bytes).is_err());
    }

    #[test]
    fn test_dimension_limits() {
        assert!(validate_dimensions(1920, 1080).is_ok());
        assert!(validate_dimensions(15000, 200).is_err());
        assert!(validate_dimensions(8000, 8000).is_err()); // 64 MP > 48 MP
    }
}
