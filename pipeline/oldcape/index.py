"""Build the index.json document consumed by the web app."""

from __future__ import annotations

from collections.abc import Mapping, Sequence
from dataclasses import dataclass

from oldcape.atlas import ATLAS_COLS, PER_SHEET
from oldcape.texture import REGION_SIZE

INDEX_VERSION = 1


@dataclass(frozen=True)
class IndexEntry:
    id: int
    colors: int
    blank: bool


def build_index(entries: Sequence[IndexEntry], aliases: Mapping[int, int]) -> dict:
    """`capes` is sorted by id; its array position is the cape's atlas position."""
    capes = [[e.id, e.colors, int(e.blank)] for e in sorted(entries, key=lambda e: e.id)]
    return {
        "v": INDEX_VERSION,
        "perSheet": PER_SHEET,
        "cols": ATLAS_COLS,
        "cell": list(REGION_SIZE),
        "total": len(capes),
        "capes": capes,
        "aliases": [[a, c] for a, c in sorted(aliases.items())],
    }
