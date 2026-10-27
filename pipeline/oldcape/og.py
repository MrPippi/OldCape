"""Link-preview image (og.png, 1200x630): the site's title beside six real capes.

Usage: python -m oldcape.og   (writes web/public/og.png from the built cape data)
"""

from __future__ import annotations

import json
from pathlib import Path

from PIL import Image, ImageDraw, ImageFilter, ImageFont

ROOT = Path(__file__).resolve().parents[2]
OG_SIZE = (1200, 630)
DEFAULT_IDS = (12, 15, 9, 21, 17, 6)

BG = (13, 15, 18)
GOLD = (240, 198, 116)
INK = (255, 255, 255)
SOFT = (169, 163, 151)
WELL = (11, 12, 14)
LINE = (36, 40, 46)
SHADE = (5, 6, 9)

CAPE_SCALE = 10  # 10x16 front face -> 100x160
COLS, GAP = 3, 28
MARGIN = 72


def _front_face(data: Path, index: dict, cape_id: int) -> Image.Image:
    """The 10x16 front face of a cape, cut from its atlas cell."""
    pos = {c[0]: i for i, c in enumerate(index["capes"])}
    canonical = dict(index["aliases"]).get(cape_id, cape_id)
    i = pos[canonical]  # KeyError for an unknown id
    per, cols, (cw, ch) = index["perSheet"], index["cols"], index["cell"]
    sheet = Image.open(data / "atlas" / f"atlas-{i // per:03d}.png").convert("RGBA")
    x, y = (i % per % cols) * cw, (i % per // cols) * ch
    return sheet.crop((x + 1, y + 1, x + 11, y + 17))


def _serif(fonts: Path, size: int, weight: int) -> ImageFont.FreeTypeFont:
    font = ImageFont.truetype(str(fonts / "NotoSerifTC[wght].ttf"), size)
    font.set_variation_by_axes([weight])
    return font


def render_og(data: Path, fonts: Path, cape_ids: list[int] | tuple[int, ...] = DEFAULT_IDS) -> Image.Image:
    index = json.loads((data / "index.json").read_text(encoding="utf-8"))
    faces = [_front_face(data, index, cape_id) for cape_id in cape_ids]

    img = Image.new("RGB", OG_SIZE, BG)
    # a soft gold glow behind the capes, like the hero stage
    glow = Image.new("L", OG_SIZE, 0)
    ImageDraw.Draw(glow).ellipse((700, 60, 1180, 580), fill=60)
    img.paste(Image.new("RGB", OG_SIZE, GOLD), mask=glow.filter(ImageFilter.GaussianBlur(90)))

    draw = ImageDraw.Draw(img)
    pixel = ImageFont.truetype(str(fonts / "Cubic_11.ttf"), 34)
    draw.text((MARGIN, 70), "老披風 OldCape", font=pixel, fill=GOLD)
    title = _serif(fonts, 66, 900)
    draw.text((MARGIN, 160), "那些年，", font=title, fill=INK)
    draw.text((MARGIN, 248), "我們披在背上的回憶", font=title, fill=INK)
    body = _serif(fonts, 26, 500)
    draw.text((MARGIN, 368), "三萬件台灣麥塊玩家披風", font=body, fill=SOFT)
    draw.text((MARGIN, 410), "免費搜尋、下載 64×32 遊戲貼圖", font=body, fill=SOFT)
    draw.text((MARGIN, 520), "oldcape.org", font=ImageFont.truetype(str(fonts / "Cubic_11.ttf"), 30), fill=GOLD)

    w, h = 10 * CAPE_SCALE, 16 * CAPE_SCALE
    rows = (len(faces) + COLS - 1) // COLS
    grid_w, grid_h = COLS * w + (COLS - 1) * GAP, rows * h + (rows - 1) * GAP
    left, top = OG_SIZE[0] - MARGIN - grid_w, (OG_SIZE[1] - grid_h) // 2
    for n, face in enumerate(faces):
        x, y = left + (n % COLS) * (w + GAP), top + (n // COLS) * (h + GAP)
        shadow = Image.new("L", OG_SIZE, 0)
        ImageDraw.Draw(shadow).rectangle((x + 6, y + 14, x + w + 6, y + h + 14), fill=170)
        img.paste(Image.new("RGB", OG_SIZE, SHADE), mask=shadow.filter(ImageFilter.GaussianBlur(10)))
        draw.rectangle((x - 1, y - 1, x + w, y + h), fill=WELL, outline=LINE)
        big = face.resize((w, h), Image.NEAREST)  # pixel art stays crisp
        img.paste(big, (x, y), big)
    return img


def main() -> int:
    out = ROOT / "web" / "public" / "og.png"
    render_og(ROOT / "web" / "public" / "data", ROOT / "vendor" / "fonts").save(out, "PNG", optimize=True)
    print(f"wrote {out} ({out.stat().st_size} bytes)")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
