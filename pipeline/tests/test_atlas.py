from PIL import Image

from oldcape.atlas import ATLAS_COLS, PER_SHEET, build_atlases, cell_origin
from oldcape.texture import REGION_SIZE


def solid(i: int) -> Image.Image:
    return Image.new("RGBA", REGION_SIZE, (i, 255 - i, 7, 255))


def test_constants():
    assert (ATLAS_COLS, PER_SHEET) == (8, 64)


def test_cell_origin():
    assert cell_origin(0) == (0, 0, 0)
    assert cell_origin(9) == (0, 22, 17)
    assert cell_origin(63) == (0, 154, 119)
    assert cell_origin(64) == (1, 0, 0)


def test_build_atlases_layout(tmp_path):
    paths = build_atlases([solid(i) for i in range(65)], tmp_path)
    assert [p.name for p in paths] == ["atlas-000.png", "atlas-001.png"]
    sheet0 = Image.open(paths[0])
    assert sheet0.size == (176, 136)
    assert Image.open(paths[1]).size == (176, 136)
    assert sheet0.getpixel((22, 17)) == (9, 246, 7, 255)
    assert sheet0.getpixel((43, 33)) == (9, 246, 7, 255)
    assert Image.open(paths[1]).getpixel((0, 0)) == (64, 191, 7, 255)
    assert Image.open(paths[1]).getpixel((30, 0))[3] == 0


def test_build_atlases_removes_stale_sheets(tmp_path):
    (tmp_path / "atlas-005.png").write_bytes(b"old")
    build_atlases([solid(1)], tmp_path)
    assert sorted(p.name for p in tmp_path.iterdir()) == ["atlas-000.png"]
