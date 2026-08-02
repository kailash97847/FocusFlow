#!/usr/bin/env python3
"""Icon pipeline: crop the generated logo, round corners, emit all PWA icon
sizes + the social-share (OG) image. Deterministic, run via `python3 scripts/make_icons.py`."""
import os
from PIL import Image, ImageDraw

SRC = "assets-src/logo-1024.png"
OG_SRC = "assets-src/og-hero.png"
OUT = "app/assets"
LANDING = "landing/assets"
NAVY = (11, 14, 26)  # #0b0e1a


def rounded_mask(size, radius, ss=4):
    s = size * ss
    mask = Image.new("L", (s, s), 0)
    d = ImageDraw.Draw(mask)
    d.rounded_rectangle([0, 0, s - 1, s - 1], radius=radius * ss, fill=255)
    return mask.resize((size, size), Image.LANCZOS)


def crop_logo(img):
    """Bounding box of the dark app-icon area, expanded slightly, squared."""
    rgb = img.convert("RGB")
    gray = rgb.convert("L")
    mask = gray.point(lambda p: 255 if p < 120 else 0)
    bbox = mask.getbbox()
    l, t, r, b = bbox
    cx, cy = (l + r) // 2, (t + b) // 2
    half = int(max(r - l, b - t) * 0.53)
    l, t, r, b = cx - half, cy - half, cx + half, cy + half
    return rgb.crop((max(0, l), max(0, t), min(img.width, r), min(img.height, b)))


def main():
    os.makedirs(OUT, exist_ok=True)
    os.makedirs(LANDING, exist_ok=True)
    logo = crop_logo(Image.open(SRC)).resize((1024, 1024), Image.LANCZOS)

    def save_any(size, path):
        icon = logo.resize((size, size), Image.LANCZOS).convert("RGBA")
        icon.putalpha(rounded_mask(size, int(size * 0.225)))
        icon.save(path)

    def save_square(size, path, scale=1.0):
        canvas = Image.new("RGB", (size, size), NAVY)
        inner = int(size * scale)
        art = logo.resize((inner, inner), Image.LANCZOS).convert("RGBA")
        art.putalpha(rounded_mask(inner, int(inner * 0.225)))
        canvas.paste(art, ((size - inner) // 2, (size - inner) // 2), art)
        canvas.save(path)

    save_any(512, f"{OUT}/icon-512.png")
    save_any(192, f"{OUT}/icon-192.png")
    save_any(32, f"{OUT}/favicon-32.png")
    save_square(180, f"{OUT}/apple-touch-icon.png")          # iOS applies its own mask
    save_square(512, f"{OUT}/icon-maskable-512.png", 0.78)   # safe zone for masks
    save_square(192, f"{OUT}/icon-maskable-192.png", 0.78)

    # Social card: 1200x630 center-crop of the hero art.
    og = Image.open(OG_SRC).convert("RGB")
    target = (1200, 630)
    ratio = max(target[0] / og.width, target[1] / og.height)
    og = og.resize((round(og.width * ratio), round(og.height * ratio)), Image.LANCZOS)
    x, y = (og.width - target[0]) // 2, (og.height - target[1]) // 2
    og.crop((x, y, x + target[0], y + target[1])).save(f"{LANDING}/og-image.jpg", quality=86)

    print("icons written to", OUT, "and", LANDING)


if __name__ == "__main__":
    main()
