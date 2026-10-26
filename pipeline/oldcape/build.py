"""CLI: source folders -> atlases + index.json (+ optional zip of 64x32 textures).

Usage: python -m oldcape.build --src DIR --out DIR [--zip PATH]
"""

from __future__ import annotations

import argparse
import io
import json
import zipfile
from collections import Counter
from concurrent.futures import ProcessPoolExecutor
from dataclasses import dataclass, field
from pathlib import Path

from PIL import Image, UnidentifiedImageError

from oldcape.analyze import assign_canonical, color_mask, is_blank
from oldcape.atlas import build_atlases
from oldcape.index import IndexEntry, build_index
from oldcape.scan import scan_source
from oldcape.texture import REGION_SIZE, UnsupportedSizeError, load_region, to_texture

CHUNK = 64


@dataclass(frozen=True)
class BuildReport:
    scanned: int
    skipped: dict[str, int]
    unsupported: list[Path] = field(default_factory=list)
    canonical: int = 0
    aliases: int = 0
    blank: int = 0
    sheets: int = 0
    files_written: int = 0

    def lines(self) -> list[str]:
        skipped = ", ".join(f"{k}={v}" for k, v in sorted(self.skipped.items())) or "none"
        return [
            f"scanned: {self.scanned}",
            f"skipped: {skipped}",
            f"unsupported: {len(self.unsupported)}",
            *(f"  - {p}" for p in self.unsupported),
            f"canonical: {self.canonical}",
            f"aliases: {self.aliases}",
            f"blank: {self.blank}",
            f"sheets: {self.sheets}",
            f"files written: {self.files_written}",
        ]


def _load(path: Path) -> bytes | None:
    """Worker: region bytes, or None if the file is not a usable cape image."""
    try:
        return load_region(path).tobytes()
    except (UnsupportedSizeError, UnidentifiedImageError, OSError):
        return None


def _region(data: bytes) -> Image.Image:
    return Image.frombytes("RGBA", REGION_SIZE, data)


def _write_zip(regions: dict[int, Image.Image], zip_path: Path) -> None:
    zip_path.parent.mkdir(parents=True, exist_ok=True)
    with zipfile.ZipFile(zip_path, "w", zipfile.ZIP_DEFLATED) as zf:
        for cape_id in sorted(regions):
            buf = io.BytesIO()
            to_texture(regions[cape_id]).save(buf, "PNG")
            zf.writestr(f"oldcape-{cape_id}.png", buf.getvalue())


def run_build(src: Path, out: Path, zip_path: Path | None = None) -> BuildReport:
    scan = scan_source(src)
    paths = [c.path for c in scan.capes]
    with ProcessPoolExecutor() as pool:
        loaded = list(pool.map(_load, paths, chunksize=CHUNK))

    region_bytes: dict[int, bytes] = {}
    unsupported: list[Path] = []
    for cape, data in zip(scan.capes, loaded):
        if data is None:
            unsupported.append(cape.path)
        else:
            region_bytes[cape.id] = data

    canonical_of = assign_canonical(region_bytes)
    canonical_ids = sorted({c for c in canonical_of.values()})
    aliases = {a: c for a, c in canonical_of.items() if a != c}
    regions = {i: _region(region_bytes[i]) for i in canonical_ids}
    entries = [IndexEntry(i, color_mask(regions[i]), is_blank(regions[i])) for i in canonical_ids]

    sheets = build_atlases([regions[i] for i in canonical_ids], out / "atlas")
    index_path = out / "index.json"
    index_path.write_text(
        json.dumps(build_index(entries, aliases), separators=(",", ":")), encoding="utf-8"
    )
    if zip_path is not None:
        _write_zip(regions, zip_path)

    return BuildReport(
        scanned=len(scan.capes),
        skipped=dict(Counter(r for _p, r in scan.skipped)),
        unsupported=unsupported,
        canonical=len(canonical_ids),
        aliases=len(aliases),
        blank=sum(1 for e in entries if e.blank),
        sheets=len(sheets),
        files_written=len(sheets) + 1,
    )


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--src", type=Path, required=True)
    parser.add_argument("--out", type=Path, required=True)
    parser.add_argument("--zip", type=Path, default=None)
    args = parser.parse_args(argv)
    if not args.src.is_dir():
        parser.error(f"--src is not a directory: {args.src}")
    report = run_build(args.src, args.out, args.zip)
    print("\n".join(report.lines()))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
