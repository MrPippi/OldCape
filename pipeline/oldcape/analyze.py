"""Colour tags, blank detection and duplicate grouping for recovered cape regions."""

from __future__ import annotations

import colorsys
from collections import Counter
from collections.abc import Mapping

from PIL import Image

COLOR_BUCKETS = ("red", "orange", "yellow", "green", "cyan", "blue",
                 "purple", "pink", "brown", "white", "gray", "black")
FRONT_BOX = (1, 1, 11, 17)
OPAQUE_ALPHA = 128
BUCKET_SHARE = 0.15
BLANK_MAX_COLOURS = 2

# (upper bound of hue in degrees, bucket) checked in order after the
# achromatic and brown rules; red also covers h >= 345.
_HUE_BANDS = ((15, "red"), (40, "orange"), (70, "yellow"), (165, "green"),
              (200, "cyan"), (260, "blue"), (290, "purple"), (345, "pink"), (360, "red"))


def _bucket(r: int, g: int, b: int) -> str:
    h, s, v = colorsys.rgb_to_hsv(r / 255, g / 255, b / 255)
    hue = h * 360
    if v < 0.20:
        return "black"
    if s < 0.15:
        return "white" if v > 0.85 else "gray"
    if 15 <= hue < 45 and v < 0.60:
        return "brown"
    return next(name for upper, name in _HUE_BANDS if hue < upper)


def color_mask(region: Image.Image) -> int:
    front = region.convert("RGBA").crop(FRONT_BOX)
    opaque = [p for p in front.get_flattened_data() if p[3] >= OPAQUE_ALPHA]
    if not opaque:
        return 0
    counts = Counter(_bucket(r, g, b) for r, g, b, _a in opaque)
    mask = 0
    for name, n in counts.items():
        if n / len(opaque) >= BUCKET_SHARE:
            mask |= 1 << COLOR_BUCKETS.index(name)
    return mask


def is_blank(region: Image.Image) -> bool:
    pixels = region.convert("RGBA").get_flattened_data()
    distinct = {(0, 0, 0, 0) if p[3] == 0 else p for p in pixels}
    return len(distinct) <= BLANK_MAX_COLOURS


def assign_canonical(region_bytes: Mapping[int, bytes]) -> dict[int, int]:
    """Map every id to the lowest id that has identical region bytes."""
    first: dict[bytes, int] = {}
    for cape_id in sorted(region_bytes):
        first.setdefault(region_bytes[cape_id], cape_id)
    return {cape_id: first[data] for cape_id, data in region_bytes.items()}
