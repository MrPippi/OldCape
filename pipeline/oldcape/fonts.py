"""Subset the Cubic 11 pixel font to the few accent characters the site uses.

Usage: python -m oldcape.fonts SRC.ttf OUT.woff2
"""

from __future__ import annotations

import sys
from pathlib import Path

from fontTools import subset

# Logo, cape numbers and homepage stats.
ACCENT_TEXT = "老披風OldCape#0123456789,×件今日展出"


def subset_font(src: Path, out: Path, text: str) -> None:
    options = subset.Options()
    options.flavor = "woff2"
    options.layout_features = ["*"]
    font = subset.load_font(str(src), options)
    subsetter = subset.Subsetter(options)
    subsetter.populate(text=text)
    subsetter.subset(font)
    out.parent.mkdir(parents=True, exist_ok=True)
    subset.save_font(font, str(out), options)


def main(argv: list[str] | None = None) -> int:
    args = sys.argv[1:] if argv is None else argv
    if len(args) != 2:
        print(__doc__, file=sys.stderr)
        return 2
    subset_font(Path(args[0]), Path(args[1]), ACCENT_TEXT)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
