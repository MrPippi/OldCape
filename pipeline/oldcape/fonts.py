"""Subset the site's two display fonts to the few characters they render.

Usage: python -m oldcape.fonts            (writes both into web/public/fonts)
       python -m oldcape.fonts SRC OUT    (Cubic 11 accent subset only)
"""

from __future__ import annotations

import sys
from pathlib import Path

from fontTools import subset
from fontTools.ttLib import TTFont
from fontTools.varLib import instancer

ROOT = Path(__file__).resolve().parents[2]
VENDOR = ROOT / "vendor" / "fonts"
OUT_DIR = ROOT / "web" / "public" / "fonts"

# Logo, cape numbers and homepage stats (Cubic 11 pixel font).
ACCENT_TEXT = "老披風OldCape#0123456789,×件今日展出"
# Hero title and section headings (Noto Serif TC Black). Keep in sync with index.html.
TITLE_TEXT = "那些年，我們披在背上的回憶怎麼穿上？關於老披風聊天室"

TARGETS = (
    (VENDOR / "Cubic_11.ttf", OUT_DIR / "cubic11-subset.woff2", ACCENT_TEXT, None),
    (VENDOR / "NotoSerifTC[wght].ttf", OUT_DIR / "noto-serif-tc-900-subset.woff2", TITLE_TEXT, 900),
)


def subset_font(src: Path, out: Path, text: str, wght: int | None = None) -> None:
    """Write a woff2 holding only `text`; a variable font is first pinned to `wght`."""
    options = subset.Options()
    options.flavor = "woff2"
    options.layout_features = ["*"]
    font = TTFont(str(src))
    if wght is not None and "fvar" in font:
        font = instancer.instantiateVariableFont(font, {"wght": wght}, updateFontNames=False)
        font["OS/2"].usWeightClass = wght
    subsetter = subset.Subsetter(options)
    subsetter.populate(text=text)
    subsetter.subset(font)
    out.parent.mkdir(parents=True, exist_ok=True)
    subset.save_font(font, str(out), options)


def main(argv: list[str] | None = None) -> int:
    args = sys.argv[1:] if argv is None else argv
    if len(args) == 2:
        subset_font(Path(args[0]), Path(args[1]), ACCENT_TEXT)
        return 0
    if args:
        print(__doc__, file=sys.stderr)
        return 2
    for src, out, text, wght in TARGETS:
        if not src.exists():
            print(f"missing {src} — see README for the download link", file=sys.stderr)
            return 1
        subset_font(src, out, text, wght)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
