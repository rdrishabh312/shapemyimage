use shapemyimage::geometry::{analyze_dimensions, calculate_smart_radius, AspectCategory};

#[test]
fn test_geometry_square_1000x1000() {
    let geo = analyze_dimensions(1000, 1000);
    assert_eq!(geo.category, AspectCategory::Square);
    assert_eq!(geo.ratio_label, "1:1");

    // 0% -> sharp corners (0 px)
    assert_eq!(calculate_smart_radius(1000, 1000, 0.0), 0.0);
    // 50% -> 250 px radius
    assert_eq!(calculate_smart_radius(1000, 1000, 50.0), 250.0);
    // 100% -> perfect circle radius: W/2 = 500 px
    assert_eq!(calculate_smart_radius(1000, 1000, 100.0), 500.0);
}

#[test]
fn test_geometry_landscape_1600x900() {
    let geo = analyze_dimensions(1600, 900);
    assert_eq!(geo.category, AspectCategory::Landscape);
    assert_eq!(geo.ratio_label, "16:9");

    // max radius is h/2 = 450 px (capsule)
    assert_eq!(calculate_smart_radius(1600, 900, 0.0), 0.0);
    assert_eq!(calculate_smart_radius(1600, 900, 50.0), 225.0);
    assert_eq!(calculate_smart_radius(1600, 900, 100.0), 450.0);
}

#[test]
fn test_geometry_portrait_900x1600() {
    let geo = analyze_dimensions(900, 1600);
    assert_eq!(geo.category, AspectCategory::Portrait);
    assert_eq!(geo.ratio_label, "9:16");

    // max radius is w/2 = 450 px (capsule)
    assert_eq!(calculate_smart_radius(900, 1600, 0.0), 0.0);
    assert_eq!(calculate_smart_radius(900, 1600, 50.0), 225.0);
    assert_eq!(calculate_smart_radius(900, 1600, 100.0), 450.0);
}

#[test]
fn test_geometry_extreme_wide_2400x400() {
    let geo = analyze_dimensions(2400, 400);
    assert_eq!(geo.category, AspectCategory::Extreme);

    // max radius is min(2400, 400)/2 = 200 px
    assert_eq!(calculate_smart_radius(2400, 400, 100.0), 200.0);
}

#[test]
fn test_geometry_extreme_tall_400x2400() {
    let geo = analyze_dimensions(400, 2400);
    assert_eq!(geo.category, AspectCategory::Extreme);

    // max radius is min(400, 2400)/2 = 200 px
    assert_eq!(calculate_smart_radius(400, 2400, 100.0), 200.0);
}

#[test]
fn test_geometry_small_120x120() {
    let geo = analyze_dimensions(120, 120);
    assert_eq!(geo.category, AspectCategory::Square);
    assert_eq!(calculate_smart_radius(120, 120, 100.0), 60.0);
}
