import json
import zipfile

from PIL import Image

import pytest

from oldcape.build import main, read_removed, run_build
from oldcape.texture import PREVIEW_SIZE, REGION_SIZE

PREFIX = "台灣麥塊www.minecraft.com.tw"


def patterned(seed: int) -> Image.Image:
    img = Image.new("RGBA", REGION_SIZE, (0, 0, 0, 0))
    for x in range(1, 11):
        for y in range(1, 17):
            img.putpixel((x, y), ((x * 20 + seed) % 256, (y * 13) % 256, seed % 256, 255))
    return img


def write_preview(path, region):
    path.parent.mkdir(parents=True, exist_ok=True)
    region.resize(PREVIEW_SIZE, Image.NEAREST).save(path)


def make_source(root):
    write_preview(root / "1" / f"{PREFIX}10.png", patterned(1))
    write_preview(root / "1" / f"{PREFIX}4.png", patterned(1))           # duplicate of 10
    write_preview(root / "2" / f"{PREFIX}7.png", Image.new("RGBA", REGION_SIZE, (5, 5, 5, 255)))
    write_preview(root / "2" / f"{PREFIX}2.png", patterned(2))
    write_preview(root / "2" / f"{PREFIX}2 - 複製.png", patterned(2))
    Image.new("RGBA", (100, 100)).save(root / "2" / f"{PREFIX}99.png")


def test_run_build(tmp_path):
    src, out, zp = tmp_path / "src", tmp_path / "out", tmp_path / "rel" / "capes.zip"
    make_source(src)
    report = run_build(src, out, zp)
    assert report.scanned == 5
    assert report.skipped == {"copy": 1}
    assert [p.name for p in report.unsupported] == [f"{PREFIX}99.png"]
    assert (report.canonical, report.aliases, report.blank, report.sheets) == (3, 1, 1, 1)

    idx = json.loads((out / "index.json").read_text(encoding="utf-8"))
    assert idx["total"] == 3
    assert [c[0] for c in idx["capes"]] == [2, 4, 7]
    assert idx["capes"][2][2] == 1
    assert idx["aliases"] == [[10, 4]]
    assert (out / "atlas" / "atlas-000.png").exists()

    with zipfile.ZipFile(zp) as z:
        assert sorted(z.namelist()) == ["oldcape-2.png", "oldcape-4.png", "oldcape-7.png"]
        with z.open("oldcape-4.png") as f:
            tex = Image.open(f)
            assert tex.size == (64, 32)
            assert tex.convert("RGBA").getpixel((1, 1)) == patterned(1).getpixel((1, 1))


def test_main_cli(tmp_path, capsys):
    src, out = tmp_path / "src", tmp_path / "out"
    make_source(src)
    assert main(["--src", str(src), "--out", str(out)]) == 0
    printed = capsys.readouterr().out
    assert "canonical: 3" in printed
    assert "unsupported: 1" in printed


def test_removed_artwork_leaves_index_atlas_and_zip(tmp_path):
    src, out, zp = tmp_path / "src", tmp_path / "out", tmp_path / "capes.zip"
    make_source(src)
    # 10 is a duplicate of 4: asking to remove either removes that artwork entirely
    report = run_build(src, out, zp, removed=frozenset({10}))
    idx = json.loads((out / "index.json").read_text(encoding="utf-8"))
    assert [c[0] for c in idx["capes"]] == [2, 7]
    assert idx["aliases"] == []
    assert report.removed == 2
    assert "removed: 2" in report.lines()
    with zipfile.ZipFile(zp) as z:
        assert sorted(z.namelist()) == ["oldcape-2.png", "oldcape-7.png"]


def test_read_removed_file(tmp_path):
    f = tmp_path / "removed.txt"
    f.write_text("# 下架申請，一行一個編號\n123  # issue #5\n\n456\n", encoding="utf-8")
    assert read_removed(f) == frozenset({123, 456})
    assert read_removed(tmp_path / "missing.txt") == frozenset()
    f.write_text("123\nabc\n", encoding="utf-8")
    with pytest.raises(ValueError, match="line 2"):
        read_removed(f)


def test_cli_reads_the_removed_list(tmp_path):
    src, out = tmp_path / "src", tmp_path / "out"
    make_source(src)
    removed = tmp_path / "removed.txt"
    removed.write_text("2\n", encoding="utf-8")
    assert main(["--src", str(src), "--out", str(out), "--removed", str(removed)]) == 0
    idx = json.loads((out / "index.json").read_text(encoding="utf-8"))
    assert 2 not in [c[0] for c in idx["capes"]]
