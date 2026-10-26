from pathlib import Path

import pytest
from fontTools.ttLib import TTFont

from oldcape.fonts import ACCENT_TEXT, TITLE_TEXT, subset_font

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


NOTO_SERIF = CUBIC.parent / "NotoSerifTC[wght].ttf"


@pytest.mark.skipif(not NOTO_SERIF.exists(), reason="vendor font missing")
def test_subset_variable_font_pinned_to_black(tmp_path):
    out = tmp_path / "title.woff2"
    subset_font(NOTO_SERIF, out, TITLE_TEXT, wght=900)
    font = TTFont(out)
    assert "fvar" not in font
    assert font["OS/2"].usWeightClass == 900
    cmap = font.getBestCmap()
    assert all(ord(ch) in cmap for ch in "我們披在背上的回憶")
    assert out.stat().st_size < 40_000


def test_title_text_covers_headings():
    for ch in "那些年，我們披在背上的回憶怎麼穿上？關於老披風":
        assert ch in TITLE_TEXT
