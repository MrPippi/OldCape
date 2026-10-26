from pathlib import Path

import pytest

from oldcape.scan import DuplicateIdError, RawCape, scan_source

PREFIX = "台灣麥塊www.minecraft.com.tw"


def touch(root: Path, rel: str) -> Path:
    p = root / rel
    p.parent.mkdir(parents=True, exist_ok=True)
    p.write_bytes(b"x")
    return p


def test_parses_id_from_filename(tmp_path):
    p = touch(tmp_path, f"1/{PREFIX}113.png")
    result = scan_source(tmp_path)
    assert result.capes == [RawCape(113, p)]


def test_skips_copy_files(tmp_path):
    p = touch(tmp_path, f"2/{PREFIX}8706 - 複製.png")
    result = scan_source(tmp_path)
    assert result.capes == []
    assert result.skipped == [(p, "copy")]


def test_skips_non_png(tmp_path):
    p = touch(tmp_path, "2/Thumbs.db")
    assert scan_source(tmp_path).skipped == [(p, "not-png")]


def test_skips_png_without_id(tmp_path):
    p = touch(tmp_path, "3/readme.png")
    assert scan_source(tmp_path).skipped == [(p, "no-id")]


def test_duplicate_id_raises(tmp_path):
    touch(tmp_path, f"1/{PREFIX}55.png")
    touch(tmp_path, f"2/{PREFIX}55.png")
    with pytest.raises(DuplicateIdError):
        scan_source(tmp_path)


def test_capes_sorted_by_id(tmp_path):
    touch(tmp_path, f"2/{PREFIX}900.png")
    touch(tmp_path, f"1/{PREFIX}12.png")
    touch(tmp_path, f"1/{PREFIX}300.png")
    assert [c.id for c in scan_source(tmp_path).capes] == [12, 300, 900]
