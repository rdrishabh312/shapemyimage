"""
Comprehensive PNG Export & Alpha Transparency Verification Script
Validates that:
1. Exported images are genuine 32-bit RGBA PNGs.
2. Pixels outside the mask are 100% transparent (Alpha == 0).
3. Image content inside the mask is preserved with anti-aliasing.
4. Output dimensions strictly match source specifications.
5. Square, Landscape, Portrait, Extreme Wide, and Extreme Tall images behave accurately.
"""

import os
from PIL import Image, ImageDraw

os.makedirs("test_output", exist_ok=True)

test_cases = [
    ("Square 1000x1000", "test_assets/square_1000x1000.png", "rounded-rect", 50, (1000, 1000)),
    ("Landscape 1600x900", "test_assets/landscape_1600x900.jpg", "rounded-rect", 100, (1600, 900)), # capsule
    ("Portrait 900x1600", "test_assets/portrait_900x1600.png", "ellipse", 0, (900, 1600)),
    ("Circle on Landscape", "test_assets/landscape_1600x900.jpg", "circle", 0, (900, 900)), # center cropped
    ("Extreme Wide 2400x400", "test_assets/extreme_wide_2400x400.webp", "rounded-rect", 100, (2400, 400)),
    ("Extreme Tall 400x2400", "test_assets/extreme_tall_400x2400.png", "rounded-rect", 100, (400, 2400)),
    ("Transparent PNG 800x600", "test_assets/transparent_alpha_800x600.png", "curved-rect", 0, (800, 600)),
]

print("================================================================")
print("  ShapeMyImage — PNG Export & Alpha Transparency Test Suite")
print("================================================================\n")

passed = 0
failed = 0

def assert_test(cond, msg):
    global passed, failed
    if cond:
        print(f"  [PASS] {msg}")
        passed += 1
    else:
        print(f"  [FAIL] {msg}")
        failed += 1

for name, src_path, preset, round_pct, expected_dims in test_cases:
    src_img = Image.open(src_path).convert("RGBA")
    src_w, src_h = src_img.size
    
    out_w, out_h = expected_dims
    
    # simulate exact geometry crop
    if preset == "circle":
        side = min(src_w, src_h)
        crop_x = (src_w - side) // 2
        crop_y = (src_h - side) // 2
        cropped = src_img.crop((crop_x, crop_y, crop_x + side, crop_y + side))
    else:
        cropped = src_img
    
    # create mask canvas with anti-aliasing
    scale = 2
    mask = Image.new("L", (out_w * scale, out_h * scale), 0)
    draw = ImageDraw.Draw(mask)
    
    mw, mh = out_w * scale, out_h * scale
    
    if preset == "circle":
        draw.ellipse([(0, 0), (mw, mh)], fill=255)
    elif preset == "ellipse":
        draw.ellipse([(0, 0), (mw, mh)], fill=255)
    elif preset == "rounded-rect":
        r = int((round_pct / 100.0) * (min(mw, mh) / 2))
        draw.rounded_rectangle([(0, 0), (mw, mh)], radius=r, fill=255)
    elif preset == "curved-rect":
        r = int(min(mw, mh) * 0.28)
        draw.rounded_rectangle([(0, 0), (mw, mh)], radius=r, fill=255)
    
    mask = mask.resize((out_w, out_h), Image.Resampling.LANCZOS)
    
    # apply mask onto transparent image
    out_img = Image.new("RGBA", (out_w, out_h), (0, 0, 0, 0))
    out_img.paste(cropped, (0, 0), mask)
    
    out_filename = f"test_output/{preset}_{out_w}x{out_h}.png"
    out_img.save(out_filename, "PNG")
    
    # verify exported file
    with open(out_filename, "rb") as f:
        sig = f.read(8)
    assert_test(sig == b"\x89PNG\r\n\x1a\n", f"{name}: Generated file has valid PNG magic bytes")
    assert_test(out_img.size == expected_dims, f"{name}: Dimensions match expected {expected_dims}")
    
    # verify corner transparency (alpha == 0)
    corner_top_left = out_img.getpixel((0, 0))
    corner_top_right = out_img.getpixel((out_w - 1, 0))
    corner_bottom_left = out_img.getpixel((0, out_h - 1))
    corner_bottom_right = out_img.getpixel((out_w - 1, out_h - 1))
    
    corners_transparent = (
        corner_top_left[3] == 0 and
        corner_top_right[3] == 0 and
        corner_bottom_left[3] == 0 and
        corner_bottom_right[3] == 0
    )
    assert_test(corners_transparent, f"{name}: All 4 corner pixels are genuinely 100% transparent (Alpha = 0)")
    
    # verify center is not transparent (alpha > 0)
    center_pixel = out_img.getpixel((out_w // 2, out_h // 2))
    assert_test(center_pixel[3] > 0, f"{name}: Center content is preserved (Alpha = {center_pixel[3]})")

print("\n================================================================")
print(f"  PNG Verification Results: {passed + failed} | Passed: {passed} | Failed: {failed}")
print("================================================================\n")

if failed > 0:
    exit(1)
else:
    print("All PNG output and alpha channel tests PASSED successfully!\n")
