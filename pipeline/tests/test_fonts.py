from pathlib import Path

import pytest
from fontTools.ttLib import TTFont

from oldcape.fonts import ACCENT_TEXT, subset_font

CUBIC = Path(__file__).resolve().parents[2] / "vendor" / "fonts" / "Cubic_11.ttf"


@pytest.mark.skipif(not CUBIC.exists(), reason="vendor font missing")
def test_subset_keeps_only_requested_glyphs(tmp_path):
    out = tmp_path / "sub.woff2"
    subset_font(CUBIC, out, ACCENT_TEXT)
    font = TTFont(out)
    cmap = font.getBestCmap()
    assert ord("披") in cmap
    assert ord("7") in cmap
    assert ord("龍") not in cmap
    assert font.flavor == "woff2"
    assert out.stat().st_size < 20_000


def test_accent_text_covers_logo_and_digits():
    for ch in "老披風OldCape#0123456789,×":
        assert ch in ACCENT_TEXT
