"""Pack cape regions into fixed-size atlas sheets (64 per sheet, 8 columns)."""

from __future__ import annotations

from collections.abc import Sequence
from pathlib import Path

from PIL import Image

from oldcape.texture import REGION_SIZE

ATLAS_COLS = 8
PER_SHEET = 64
SHEET_SIZE = (ATLAS_COLS * REGION_SIZE[0], (PER_SHEET // ATLAS_COLS) * REGION_SIZE[1])


def cell_origin(pos: int) -> tuple[int, int, int]:
    """Return (sheet, x, y) of the top-left pixel of atlas position `pos`."""
    sheet, slot = divmod(pos, PER_SHEET)
    row, col = divmod(slot, ATLAS_COLS)
    return sheet, col * REGION_SIZE[0], row * REGION_SIZE[1]


def sheet_name(sheet: int) -> str:
    return f"atlas-{sheet:03d}.png"


def build_atlases(regions: Sequence[Image.Image], out_dir: Path) -> list[Path]:
    out_dir.mkdir(parents=True, exist_ok=True)
    for stale in out_dir.glob("atlas-*.png"):
        stale.unlink()
    sheets: list[Image.Image] = []
    for pos, region in enumerate(regions):
        sheet, x, y = cell_origin(pos)
        if sheet == len(sheets):
            sheets.append(Image.new("RGBA", SHEET_SIZE, (0, 0, 0, 0)))
        sheets[sheet].paste(region, (x, y))
    paths = []
    for i, img in enumerate(sheets):
        path = out_dir / sheet_name(i)
        img.save(path, optimize=True)
        paths.append(path)
    return paths
