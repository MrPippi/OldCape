import os
import random
from pathlib import Path

import pytest
from PIL import Image

from oldcape.scan import scan_source
from oldcape.texture import (
    PREVIEW_SCALE,
    PREVIEW_SIZE,
    REGION_SIZE,
    TEXTURE_SIZE,
    UnsupportedSizeError,
    extract_native,
    load_region,
    recover_preview,
    to_texture,
)


def random_region(seed: int = 1) -> Image.Image:
    rng = random.Random(seed)
    img = Image.new("RGBA", REGION_SIZE)
    img.putdata([(rng.randrange(256), rng.randrange(256), rng.randrange(256), 255)
                 for _ in range(REGION_SIZE[0] * REGION_SIZE[1])])
    return img


def upscale(region: Image.Image) -> Image.Image:
    return region.resize(PREVIEW_SIZE, Image.NEAREST)


def test_recover_exact():
    region = random_region()
    assert recover_preview(upscale(region)).tobytes() == region.tobytes()


def test_recover_with_noise():
    region = random_region(2)
    preview = upscale(region)
    px = preview.load()
    rng = random.Random(3)
    for cy in range(REGION_SIZE[1]):
        for cx in range(REGION_SIZE[0]):
            cells = [(cx * PREVIEW_SCALE + i, cy * PREVIEW_SCALE + j)
                     for i in range(PREVIEW_SCALE) for j in range(PREVIEW_SCALE)]
            for x, y in rng.sample(cells, 14):  # 14/36 ≈ 39% of the cell
                r, g, b, a = px[x, y]
                d = rng.choice((-3, -2, -1, 1, 2, 3))
                px[x, y] = (max(0, min(255, r + d)), max(0, min(255, g - d)), b, a)
    assert recover_preview(preview).tobytes() == region.tobytes()


def test_recover_normalises_transparent():
    preview = Image.new("RGBA", PREVIEW_SIZE, (0, 0, 0, 0))
    px = preview.load()
    for i in range(PREVIEW_SCALE):
        for j in range(PREVIEW_SCALE):
            px[i, j] = (i * 40, j * 40, 7, 0)
    assert recover_preview(preview).getpixel((0, 0)) == (0, 0, 0, 0)


def test_recover_rgb_mode():
    preview = upscale(random_region(4)).convert("RGB")
    out = recover_preview(preview)
    assert out.mode == "RGBA"
    assert out.getpixel((5, 5))[3] == 255


def test_extract_native():
    native = Image.new("RGBA", TEXTURE_SIZE, (9, 9, 9, 255))
    region = random_region(5)
    native.paste(region, (0, 0))
    assert extract_native(native).tobytes() == region.tobytes()


def test_to_texture():
    region = random_region(6)
    tex = to_texture(region)
    assert tex.size == (64, 32)
    assert tex.crop((0, 0, *REGION_SIZE)).tobytes() == region.tobytes()
    assert tex.getpixel((30, 20))[3] == 0


def test_load_region_dispatches(tmp_path):
    region = random_region(7)
    p = tmp_path / "a.png"
    upscale(region).save(p)
    assert load_region(p).tobytes() == region.tobytes()


def test_load_region_rejects_size(tmp_path):
    p = tmp_path / "bad.png"
    Image.new("RGBA", (100, 100)).save(p)
    with pytest.raises(UnsupportedSizeError):
        load_region(p)


def _is_perfect_grid(img: Image.Image) -> bool:
    px = img.load()
    for cy in range(REGION_SIZE[1]):
        for cx in range(REGION_SIZE[0]):
            ref = px[cx * PREVIEW_SCALE, cy * PREVIEW_SCALE]
            for i in range(PREVIEW_SCALE):
                for j in range(PREVIEW_SCALE):
                    c = px[cx * PREVIEW_SCALE + i, cy * PREVIEW_SCALE + j]
                    if c != ref and not (c[3] == 0 and ref[3] == 0):
                        return False
    return True


@pytest.mark.skipif(not os.environ.get("OLDCAPE_SRC"), reason="OLDCAPE_SRC not set")
def test_real_perfect_grid():
    checked = 0
    for cape in scan_source(Path(os.environ["OLDCAPE_SRC"])).capes:
        img = Image.open(cape.path).convert("RGBA")
        if img.size != PREVIEW_SIZE or not _is_perfect_grid(img):
            continue
        restored = recover_preview(img).resize(PREVIEW_SIZE, Image.NEAREST)
        expected = [(0, 0, 0, 0) if c[3] == 0 else c for c in img.get_flattened_data()]
        assert list(restored.get_flattened_data()) == expected, cape.path
        checked += 1
        if checked == 50:
            break
    assert checked == 50
