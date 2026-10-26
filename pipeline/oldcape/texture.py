"""Recover the 22x17 cape region from the server's previews and native textures."""

from __future__ import annotations

from collections import Counter
from pathlib import Path

from PIL import Image

REGION_SIZE = (22, 17)
PREVIEW_SCALE = 6
PREVIEW_SIZE = (REGION_SIZE[0] * PREVIEW_SCALE, REGION_SIZE[1] * PREVIEW_SCALE)
TEXTURE_SIZE = (64, 32)
TRANSPARENT = (0, 0, 0, 0)


class UnsupportedSizeError(Exception):
    """Image is neither a 132x102 preview nor a 64x32 native texture."""


def _normalise(pixel: tuple[int, int, int, int]) -> tuple[int, int, int, int]:
    return TRANSPARENT if pixel[3] == 0 else pixel


def recover_preview(img: Image.Image) -> Image.Image:
    """Take the most common colour of each 6x6 cell; absorbs the previews' ±3 noise."""
    src = img.convert("RGBA").load()
    region = Image.new("RGBA", REGION_SIZE)
    for cy in range(REGION_SIZE[1]):
        for cx in range(REGION_SIZE[0]):
            cell = Counter(
                _normalise(src[cx * PREVIEW_SCALE + i, cy * PREVIEW_SCALE + j])
                for i in range(PREVIEW_SCALE)
                for j in range(PREVIEW_SCALE)
            )
            region.putpixel((cx, cy), cell.most_common(1)[0][0])
    return region


def extract_native(img: Image.Image) -> Image.Image:
    """Keep only the cape region of a 64x32 texture; the rest is junk pixels."""
    return img.convert("RGBA").crop((0, 0, *REGION_SIZE))


def load_region(path: Path) -> Image.Image:
    with Image.open(path) as img:
        if img.size == PREVIEW_SIZE:
            return recover_preview(img)
        if img.size == TEXTURE_SIZE:
            return extract_native(img)
        raise UnsupportedSizeError(f"{path}: {img.size[0]}x{img.size[1]}")


def to_texture(region: Image.Image) -> Image.Image:
    texture = Image.new("RGBA", TEXTURE_SIZE, TRANSPARENT)
    texture.paste(region, (0, 0))
    return texture
