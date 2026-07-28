"""Compose the generated artwork and exact RLT branding into a Play feature graphic."""

from argparse import ArgumentParser
from pathlib import Path

from PIL import Image, ImageDraw, ImageFilter, ImageFont


WIDTH, HEIGHT = 1024, 500


def cover(image: Image.Image, width: int, height: int) -> Image.Image:
    scale = max(width / image.width, height / image.height)
    resized = image.resize((round(image.width * scale), round(image.height * scale)), Image.Resampling.LANCZOS)
    left = (resized.width - width) // 2
    top = (resized.height - height) // 2
    return resized.crop((left, top, left + width, top + height))


def font(size: int) -> ImageFont.FreeTypeFont:
    candidates = [
        Path(r"C:\Windows\Fonts\bahnschrift.ttf"),
        Path(r"C:\Windows\Fonts\arialbd.ttf"),
    ]
    for candidate in candidates:
        if candidate.exists():
            return ImageFont.truetype(str(candidate), size=size)
    return ImageFont.load_default(size=size)


def main() -> None:
    parser = ArgumentParser()
    parser.add_argument("background", type=Path)
    parser.add_argument("--logo", type=Path, default=Path("public/icons/icon-512.png"))
    parser.add_argument("--output", type=Path, default=Path("play-assets/feature-graphic-1024x500.png"))
    args = parser.parse_args()

    base = cover(Image.open(args.background).convert("RGB"), WIDTH, HEIGHT).convert("RGBA")

    # Deepen the generated negative space so the exact logo remains readable.
    shade = Image.new("RGBA", (WIDTH, HEIGHT), (0, 0, 0, 0))
    shade_pixels = shade.load()
    for x in range(WIDTH):
        strength = max(0.0, min(1.0, (610 - x) / 420))
        alpha = round(185 * strength)
        for y in range(HEIGHT):
            shade_pixels[x, y] = (1, 7, 19, alpha)
    base = Image.alpha_composite(base, shade)

    logo = Image.open(args.logo).convert("RGBA").resize((348, 348), Image.Resampling.LANCZOS)
    shadow = Image.new("RGBA", base.size, (0, 0, 0, 0))
    shadow_logo = Image.new("RGBA", logo.size, (255, 88, 20, 0))
    shadow_logo.putalpha(logo.getchannel("A").point(lambda value: round(value * 0.55)))
    shadow.paste(shadow_logo, (50, 54), shadow_logo)
    shadow = shadow.filter(ImageFilter.GaussianBlur(22))
    base = Image.alpha_composite(base, shadow)
    base.alpha_composite(logo, (50, 54))

    draw = ImageDraw.Draw(base)
    label = "THE FAN HUB FOR LAS VEGAS 2027"
    label_font = font(19)
    draw.text((66, 423), label, font=label_font, fill=(255, 242, 230, 255), stroke_width=1, stroke_fill=(4, 11, 25, 255))
    draw.rectangle((66, 455, 365, 459), fill=(249, 88, 22, 255))

    args.output.parent.mkdir(parents=True, exist_ok=True)
    base.convert("RGB").save(args.output, "PNG", optimize=True)


if __name__ == "__main__":
    main()
