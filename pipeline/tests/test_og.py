from pathlib import Path

import pytest
from PIL import Image

from oldcape.og import OG_SIZE, render_og

ROOT = Path(__file__).resolve().parents[2]
DATA = ROOT / "web" / "public" / "data"
FONTS = ROOT / "vendor" / "fonts"
BG = (13, 15, 18)

needs_assets = pytest.mark.skipif(
    not (DATA / "index.json").exists() or not (FONTS / "NotoSerifTC[wght].ttf").exists(),
    reason="built cape data or vendor fonts missing",
)


@needs_assets
def test_renders_a_1200x630_card_with_real_capes_and_text():
    img = render_og(DATA, FONTS, cape_ids=[12, 15, 9])
    assert img.size == OG_SIZE == (1200, 630)
    assert img.mode == "RGB"
    assert img.getpixel((5, 5)) == BG
    # the capes sit on the right half; text on the left: both differ from the plain background
    right = img.crop((640, 0, 1200, 630)).getcolors(1 << 20)
    left = img.crop((0, 0, 600, 630)).getcolors(1 << 20)
    assert len(right) > 20 and len(left) > 20


@needs_assets
def test_unknown_cape_ids_are_an_error():
    with pytest.raises(KeyError):
        render_og(DATA, FONTS, cape_ids=[999_999_999])
