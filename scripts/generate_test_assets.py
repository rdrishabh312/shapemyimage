import os
import math
import random
from PIL import Image, ImageDraw

os.makedirs("static/samples", exist_ok=True)
os.makedirs("test_assets", exist_ok=True)

def create_monochrome_qr_demo(size, path):
    """Creates a high-contrast modern QR / geometric emblem image for square demonstration."""
    img = Image.new("RGBA", (size, size), (248, 248, 250, 255))
    draw = ImageDraw.Draw(img)
    
    pad = size // 10
    grid = 25
    cell = (size - 2 * pad) // grid
    dark = (18, 18, 22)
    light = (248, 248, 250)
    
    # outer finder patterns (top-left, top-right, bottom-left)
    def draw_finder(gx, gy):
        x0, y0 = pad + gx * cell, pad + gy * cell
        w = 7 * cell
        draw.rectangle([x0, y0, x0 + w, y0 + w], fill=dark)
        draw.rectangle([x0 + cell, y0 + cell, x0 + w - cell, y0 + w - cell], fill=light)
        draw.rectangle([x0 + 2 * cell, y0 + 2 * cell, x0 + w - 2 * cell, y0 + w - 2 * cell], fill=dark)
        
    draw_finder(0, 0)
    draw_finder(grid - 7, 0)
    draw_finder(0, grid - 7)
    
    # random-like deterministic geometric data cells
    rng = random.Random(42)
    for r in range(grid):
        for c in range(grid):
            # skip finders
            if (r < 8 and c < 8) or (r < 8 and c >= grid - 8) or (r >= grid - 8 and c < 8):
                continue
            # center logo zone
            if 9 <= r <= 15 and 8 <= c <= 16:
                continue
            if rng.random() > 0.44:
                x0, y0 = pad + c * cell, pad + r * cell
                draw.rectangle([x0, y0, x0 + cell - 1, y0 + cell - 1], fill=dark)
                
    # center brand emblem area
    cx, cy = size // 2, size // 2
    cw, ch = 9 * cell, 5 * cell
    draw.rounded_rectangle([cx - cw // 2, cy - ch // 2, cx + cw // 2, cy + ch // 2], radius=8, fill=light, outline=dark, width=3)
    
    # center monochrome brand badge
    draw.rounded_rectangle([cx - 44, cy - 14, cx + 44, cy + 14], radius=6, fill=dark)
    draw.rectangle([cx - 24, cy - 3, cx + 24, cy + 3], fill=light)
    
    img.save(path)
    print(f"Generated Square Demo: {path} ({size}x{size})")

def create_monochrome_avatar_demo(size, path):
    """Creates a sleek monochrome portrait / avatar graphic for 800x800 square demo."""
    img = Image.new("RGBA", (size, size), (22, 22, 26, 255))
    draw = ImageDraw.Draw(img)
    
    # concentric minimalist rings
    cx, cy = size // 2, size // 2
    for r in range(320, 100, -40):
        alpha = int(30 + (320 - r) * 0.4)
        draw.ellipse([cx - r, cy - r, cx + r, cy + r], outline=(255, 255, 255, alpha), width=2)
    
    # avatar head & shoulders silhouette
    head_r = 90
    draw.ellipse([cx - head_r, cy - 90 - head_r, cx + head_r, cy - 90 + head_r], fill=(240, 240, 245, 255))
    # shoulders
    draw.chord([cx - 210, cy + 20, cx + 210, cy + 420], 180, 360, fill=(240, 240, 245, 255))
    
    img.save(path)
    print(f"Generated Avatar Demo: {path} ({size}x{size})")

def create_monochrome_app_icon_demo(size, path):
    """Creates a minimalist obsidian app icon demo."""
    img = Image.new("RGBA", (size, size), (12, 12, 14, 255))
    draw = ImageDraw.Draw(img)
    
    cx, cy = size // 2, size // 2
    # subtle inner border
    draw.rounded_rectangle([40, 40, size - 40, size - 40], radius=120, outline=(50, 50, 56, 255), width=2)
    
    # minimalist geometric icon (layers/camera/star emblem)
    draw.rounded_rectangle([cx - 120, cy - 120, cx + 120, cy + 120], radius=40, outline=(240, 240, 245, 255), width=12)
    draw.ellipse([cx - 50, cy - 50, cx + 50, cy + 50], outline=(240, 240, 245, 255), width=10)
    draw.ellipse([cx + 60, cy - 65, cx + 78, cy - 47], fill=(240, 240, 245, 255))
    
    img.save(path)
    print(f"Generated App Icon Demo: {path} ({size}x{size})")

def create_monochrome_pattern_demo(size, path, style="waves"):
    """Creates modern monochrome generative abstract textures for 800x800 square demo."""
    img = Image.new("RGBA", (size, size), (16, 16, 19, 255))
    draw = ImageDraw.Draw(img)
    
    cx, cy = size // 2, size // 2
    if style == "waves":
        for i in range(15):
            y_base = 120 + i * 40
            pts = []
            for x in range(0, size + 20, 20):
                y = y_base + math.sin(x * 0.015 + i * 0.5) * 28
                pts.append((x, y))
            draw.line(pts, fill=(200, 200, 210, int(120 + i * 8)), width=3)
    else:
        # spiral/pebble rings
        for step in range(20, 360, 20):
            box = [cx - step, cy - step, cx + step, cy + step]
            draw.arc(box, start=step % 180, end=(step % 180) + 220, fill=(230, 230, 235, 180), width=3)
            
    img.save(path)
    print(f"Generated Pattern Demo: {path} ({size}x{size})")

def create_gradient_image(width, height, c1, c2, path, transparent=False):
    if transparent:
        img = Image.new("RGBA", (width, height), (0, 0, 0, 0))
    else:
        img = Image.new("RGBA", (width, height), (*c1, 255))
    
    draw = ImageDraw.Draw(img)
    for y in range(height):
        t = y / max(height - 1, 1)
        r = int(c1[0] * (1 - t) + c2[0] * t)
        g = int(c1[1] * (1 - t) + c2[1] * t)
        b = int(c1[2] * (1 - t) + c2[2] * t)
        alpha = int(255 * (0.3 + 0.7 * t)) if transparent else 255
        draw.line([(0, y), (width, y)], fill=(r, g, b, alpha))
    
    cx, cy = width // 2, height // 2
    r_max = min(width, height) // 3
    for r in range(r_max, 10, -30):
        draw.ellipse([(cx - r, cy - r), (cx + r, cy + r)], outline=(255, 255, 255, 80), width=2)
    
    if path.lower().endswith(('.jpg', '.jpeg')):
        img = img.convert('RGB')
    img.save(path)
    print(f"Generated {path} ({width}x{height})")

# generate square and rectangular demonstration samples for showcases
create_gradient_image(800, 800, (40, 50, 75), (20, 25, 40), "static/samples/showcase-square.webp")
create_gradient_image(800, 800, (60, 45, 55), (25, 20, 30), "static/samples/showcase-circle.webp")
create_gradient_image(800, 800, (30, 60, 55), (15, 35, 30), "static/samples/showcase-squircle.webp")
# rectangular landscape samples
create_gradient_image(1200, 750, (40, 50, 75), (20, 25, 40), "static/samples/showcase-rounded.webp")
create_gradient_image(1200, 750, (55, 40, 60), (25, 18, 30), "static/samples/showcase-curved.webp")
create_gradient_image(1200, 750, (65, 50, 40), (30, 20, 15), "static/samples/showcase-organic.webp")
create_gradient_image(1200, 750, (40, 50, 75), (20, 25, 40), "static/samples/showcase-landscape.webp")
create_gradient_image(750, 1200, (60, 45, 55), (25, 20, 30), "static/samples/showcase-portrait.webp")
create_gradient_image(700, 900, (45, 55, 75), (20, 25, 40), "static/samples/showcase-passport.webp")

# generate test assets for testing various aspect ratios (square, landscape, portrait, extreme, transparent)
create_gradient_image(1000, 1000, (60, 60, 65), (20, 20, 24), "test_assets/square_1000x1000.png")
create_gradient_image(1600, 900, (70, 70, 75), (25, 25, 30), "test_assets/landscape_1600x900.jpg")
create_gradient_image(900, 1600, (50, 50, 55), (15, 15, 20), "test_assets/portrait_900x1600.png")
create_gradient_image(2400, 400, (40, 40, 45), (18, 18, 22), "test_assets/extreme_wide_2400x400.webp")
create_gradient_image(400, 2400, (45, 45, 50), (16, 16, 20), "test_assets/extreme_tall_400x2400.png")
create_gradient_image(120, 120, (80, 80, 85), (30, 30, 35), "test_assets/small_120x120.png")
create_gradient_image(800, 600, (60, 60, 65), (20, 20, 25), "test_assets/transparent_alpha_800x600.png", transparent=True)

print("All monochrome square demonstration and test assets generated successfully.")
