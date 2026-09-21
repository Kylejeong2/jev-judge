"""Render the courtroom seal (TypeSafe mark on a brass disc) as favicon assets.

Mirrors the `Seal` component in src/components/Bench.tsx and the `.brass`
gradient in src/app/globals.css. Usage: python3 scripts/build-favicon.py
"""

from pathlib import Path

from PIL import Image, ImageDraw

ROOT = Path(__file__).resolve().parent.parent
MARK = ROOT / "public" / "typesafe-mark.png"

S = 512  # render size; downsampled for the .ico
HIGHLIGHT = (0xF3, 0xDC, 0x9C)
BRASS = (0xB8, 0x92, 0x3A)
SHADOW = (0x8A, 0x6A, 0x22)
RING = (0x3F, 0x24, 0x12, 0x66)  # oak-900 at 40%


def lerp(a, b, t):
    return tuple(int(a[i] + (b[i] - a[i]) * t) for i in range(3))


def brass_disc(size: int) -> Image.Image:
    img = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    px = img.load()
    cx, cy = size * 0.30, size * 0.25  # radial-gradient(circle at 30% 25%)
    r_max = max(((size - cx) ** 2 + (size - cy) ** 2) ** 0.5, 1)
    for y in range(size):
        for x in range(size):
            d = ((x - cx) ** 2 + (y - cy) ** 2) ** 0.5 / r_max
            if d < 0.55:
                c = lerp(HIGHLIGHT, BRASS, d / 0.55)
            else:
                c = lerp(BRASS, SHADOW, min((d - 0.55) / 0.45, 1))
            px[x, y] = (*c, 255)
    mask = Image.new("L", (size, size), 0)
    ImageDraw.Draw(mask).ellipse((0, 0, size - 1, size - 1), fill=255)
    img.putalpha(mask)
    return img


def seal(size: int) -> Image.Image:
    img = brass_disc(size)
    ring = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    inset = size * 0.07
    ImageDraw.Draw(ring).ellipse(
        (inset, inset, size - inset, size - inset), outline=RING, width=max(2, size // 44)
    )
    img.alpha_composite(ring)
    mark = Image.open(MARK).convert("RGBA")
    m = round(size * 0.55)
    mark = mark.resize((m, m), Image.LANCZOS)
    a = mark.getchannel("A").point(lambda v: int(v * 0.9))
    mark.putalpha(a)
    img.alpha_composite(mark, ((size - m) // 2, (size - m) // 2))
    return img


def main() -> None:
    big = seal(S)
    big.save(ROOT / "src" / "app" / "icon.png")
    big.resize((180, 180), Image.LANCZOS).save(ROOT / "src" / "app" / "apple-icon.png")
    big.save(
        ROOT / "src" / "app" / "favicon.ico",
        sizes=[(16, 16), (32, 32), (48, 48), (64, 64)],
    )
    print("wrote src/app/{icon.png,apple-icon.png,favicon.ico}")


if __name__ == "__main__":
    main()
