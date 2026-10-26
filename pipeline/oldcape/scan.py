"""Find cape PNGs in the source folders and read their numeric IDs."""

from __future__ import annotations

import os
import re
from dataclasses import dataclass, field
from pathlib import Path

ID_PATTERN = re.compile(r"(\d+)\.png$", re.IGNORECASE)
COPY_MARKER = " - "


class DuplicateIdError(Exception):
    """Two different files claim the same cape ID."""


@dataclass(frozen=True)
class RawCape:
    id: int
    path: Path


@dataclass(frozen=True)
class ScanResult:
    capes: list[RawCape] = field(default_factory=list)
    skipped: list[tuple[Path, str]] = field(default_factory=list)


def _classify(path: Path) -> tuple[int | None, str | None]:
    """Return (id, None) for a usable cape or (None, reason) for a skipped file."""
    if path.suffix.lower() != ".png":
        return None, "not-png"
    if COPY_MARKER in path.stem:
        return None, "copy"
    match = ID_PATTERN.search(path.name)
    if match is None:
        return None, "no-id"
    return int(match.group(1)), None


def scan_source(src: Path) -> ScanResult:
    found: dict[int, Path] = {}
    skipped: list[tuple[Path, str]] = []
    for root, _dirs, files in os.walk(str(src)):
        for name in sorted(files):
            path = Path(root) / name
            cape_id, reason = _classify(path)
            if reason is not None:
                skipped.append((path, reason))
                continue
            if cape_id in found:
                raise DuplicateIdError(f"ID {cape_id}: {found[cape_id]} and {path}")
            found[cape_id] = path
    capes = [RawCape(i, found[i]) for i in sorted(found)]
    return ScanResult(capes=capes, skipped=skipped)
