#!/usr/bin/env python3
"""Android asset pipeline: generates branded launcher icons (legacy, round,
adaptive foreground cutout) <https://developer.android.com/develop/ui/views/launch/icon_design_adaptive>
and splash screens for every density from the master FocusFlow logo.
Run: python3 scripts/make_android_icons.py"""
from PIL import Image

SRC = "assets-src/logo-1024.png"
RES = "android/app/src/main/res"
NAVY = (11, 14, 26)

# Launcher icon sizes (legacy/round) and adaptive foreground sizes per density.
ICON_SIZES = {"mdpi": 48, "hdpi": 72, "xhdpi": 96, "xxhdpi": 144, "xxxhdpi": 192}
FOREGROUND_SIZES = {"mdpi": 108, "hdpi": 162, "xhdpi": 216, "xxhdpi": 324, "xxxhdpi": 432}
# Capacitor template splash dimensions (port + land swap).
SPLASHES = {
    "drawable-port-mdpi": (320, 480), "drawable-port-hdpi": (480, 800),
    "drawable-port-xhdpi": (720, 1280), "drawable-port-xxhdpi": (960, 1600),
    "drawable-port-xxxhdpi": (1280, 1920),
    "drawable-land-mdpi": (480, 320), "drawable-land-hdpi": (800, 480),
    "drawable-land-xhdpi": (1280, 720), "drawable-land-xxhdpi": (1600, 960),
    "drawable-land-xxxhdpi": (1920, 1280),
}


def rounded_mask(size, radius, ss=4):
    from PIL import ImageDraw
    s = size * ss
    m = Image.new("L", (s, s), 0)
    ImageDraw.Draw(m).rounded_rectangle([0, 0, s - 1, s - 1], radius=radius * ss, fill=255)
    return m.resize((size, size), Image.LANCZOS)


def circle_mask(size, ss=4):
    from PIL import ImageDraw
    s = size * ss
    m = Image.new("L", (s, s), 0)
    ImageDraw.Draw(m).ellipse([0, 0, s - 1, s - 1], fill=255)
    return m.resize((size, size), Image.LANCZOS)


def crop_logo(img):
    """Bounding box of the dark app-icon area, squared."""
    mask = img.convert("L").point(lambda p: 255 if p < 120 else 0)
    l, t, r, b = mask.getbbox()
    cx, cy = (l + r) // 2, (t + b) // 2
    half = int(max(r - l, b - t) * 0.53)
    return img.convert("RGB").crop((max(0, cx - half), max(0, cy - half),
                                    min(img.width, cx + half), min(img.height, cy + half)))


def main():
    logo = crop_logo(Image.open(SRC)).resize((1024, 1024), Image.LANCZOS)

    # 1. legacy + round launcher icons
    for dpi, size in ICON_SIZES.items():
        icon = logo.resize((size, size), Image.LANCZOS).convert("RGBA")
        icon.putalpha(rounded_mask(size, int(size * 0.225)))
        icon.save(f"{RES}/mipmap-{dpi}/ic_launcher.png")
        rnd = logo.resize((size, size), Image.LANCZOS).convert("RGBA")
        rnd.putalpha(circle_mask(size))
        rnd.save(f"{RES}/mipmap-{dpi}/ic_launcher_round.png")

    # 2. adaptive foreground: brightness-keyed cutout of the glowing ring
    gray = logo.convert("L")
    alpha = gray.point(lambda p: max(0, min(255, (p - 34) * 5)))  # navy→0, glow→255
    cut = logo.convert("RGBA")
    cut.putalpha(alpha)
    for dpi, size in FOREGROUND_SIZES.items():
        canvas = Image.new("RGBA", (size, size), (0, 0, 0, 0))
        inner = int(size * 0.70)
        art = cut.resize((inner, inner), Image.LANCZOS)
        canvas.paste(art, ((size - inner) // 2, (size - inner) // 2), art)
        canvas.save(f"{RES}/mipmap-{dpi}/ic_launcher_foreground.png")

    # 3. splash screens: navy canvas, rounded logo ~40% of short edge, centered
    for folder, (w, h) in SPLASHES.items():
        canvas = Image.new("RGB", (w, h), NAVY)
        side = int(min(w, h) * 0.42)
        art = logo.resize((side, side), Image.LANCZOS).convert("RGBA")
        art.putalpha(rounded_mask(side, int(side * 0.225)))
        canvas.paste(art, ((w - side) // 2, (h - side) // 2), art)
        canvas.save(f"{RES}/{folder}/splash.png")
    # generic drawable/splash.png (large portrait)
    canvas = Image.new("RGB", (960, 1600), NAVY)
    side = int(960 * 0.42)
    art = logo.resize((side, side), Image.LANCZOS).convert("RGBA")
    art.putalpha(rounded_mask(side, int(side * 0.225)))
    canvas.paste(art, ((960 - side) // 2, (1600 - side) // 2), art)
    canvas.save(f"{RES}/drawable/splash.png")

    print("android icons + splashes written to", RES)


if __name__ == "__main__":
    main()
