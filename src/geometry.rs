use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
pub enum AspectCategory {
    Square,
    Landscape,
    Portrait,
    Extreme,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DimensionAnalysis {
    pub width: u32,
    pub height: u32,
    pub ratio: f64,
    pub category: AspectCategory,
    pub ratio_label: String,
}

// classifies image dimensions and aspect ratios
pub fn analyze_dimensions(width: u32, height: u32) -> DimensionAnalysis {
    if width == 0 || height == 0 {
        return DimensionAnalysis {
            width,
            height,
            ratio: 1.0,
            category: AspectCategory::Square,
            ratio_label: "1:1".to_string(),
        };
    }

    let ratio = width as f64 / height as f64;
    let category = if ratio >= 3.0 || ratio <= 0.333333 {
        AspectCategory::Extreme
    } else if ratio > 1.01 {
        AspectCategory::Landscape
    } else if ratio < 0.99 {
        AspectCategory::Portrait
    } else {
        AspectCategory::Square
    };

    let gcd = |mut a: u32, mut b: u32| {
        while b != 0 {
            let t = b;
            b = a % b;
            a = t;
        }
        a
    };

    let divisor = gcd(width, height);
    let sim_w = width / divisor;
    let sim_h = height / divisor;

    let ratio_label = if sim_w <= 32 && sim_h <= 32 {
        format!("{}:{}", sim_w, sim_h)
    } else {
        format!("{:.2}:1", ratio)
    };

    DimensionAnalysis {
        width,
        height,
        ratio,
        category,
        ratio_label,
    }
}

// calculates the aspect-ratio-aware corner radius in pixels
// slider percentage: 0 to 100, max radius is min(w, h) / 2
pub fn calculate_smart_radius(width: u32, height: u32, percent: f64) -> f64 {
    let clamped_percent = percent.clamp(0.0, 100.0);
    let shorter_dim = width.min(height) as f64;
    let max_radius = shorter_dim / 2.0;
    (clamped_percent / 100.0) * max_radius
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_square_aspect() {
        let analysis = analyze_dimensions(1000, 1000);
        assert_eq!(analysis.category, AspectCategory::Square);
        assert_eq!(analysis.ratio_label, "1:1");

        // 100% rounding on square gives half width = 500 px (circle)
        let r = calculate_smart_radius(1000, 1000, 100.0);
        assert_eq!(r, 500.0);
    }

    #[test]
    fn test_landscape_aspect() {
        let analysis = analyze_dimensions(1600, 900);
        assert_eq!(analysis.category, AspectCategory::Landscape);
        assert_eq!(analysis.ratio_label, "16:9");

        // 100% rounding on 1600x900 gives radius 450 px (capsule)
        let r = calculate_smart_radius(1600, 900, 100.0);
        assert_eq!(r, 450.0);
    }

    #[test]
    fn test_portrait_aspect() {
        let analysis = analyze_dimensions(900, 1600);
        assert_eq!(analysis.category, AspectCategory::Portrait);
        assert_eq!(analysis.ratio_label, "9:16");

        // 100% rounding on 900x1600 gives radius 450 px (capsule)
        let r = calculate_smart_radius(900, 1600, 100.0);
        assert_eq!(r, 450.0);
    }

    #[test]
    fn test_extreme_aspect() {
        let analysis = analyze_dimensions(2400, 400);
        assert_eq!(analysis.category, AspectCategory::Extreme);

        // max radius must not exceed 200 px (half of 400)
        let r = calculate_smart_radius(2400, 400, 100.0);
        assert_eq!(r, 200.0);
    }
}
