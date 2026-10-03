"""Crop figures/tables from the original paper into PNGs used by the website and the reading guide.

Usage: python3 tools/extract_figures.py   (requires: pip install pymupdf)
Rects are in PDF points (1/72 inch), measured on the SIGMOD-Companion '24 camera-ready PDF.
"""
from pathlib import Path

import fitz  # PyMuPDF

ROOT = Path(__file__).resolve().parent.parent
PAPER = ROOT / "00-paper" / "Apache_Arrow_DataFusion.pdf"
OUT = ROOT / "03-website" / "assets" / "img" / "figures"
DPI = 220

# name: (page index starting at 0, (x0, y0, x1, y1))
CROPS = {
    "fig1-use-cases": (0, (52, 249, 561, 379)),
    "fig2-architecture": (3, (52, 82, 560, 305)),
    "fig3-stream-code": (4, (314, 174, 562, 322)),
    "fig4-partitions": (5, (54, 82, 296, 361)),
    "table1-clickbench": (8, (54, 82, 296, 540)),
    "fig5-tpch": (8, (316, 82, 572, 180)),
    "fig6-h2o": (8, (316, 205, 572, 313)),
    "fig7-scaling": (10, (54, 82, 560, 382)),
}


def main() -> None:
    OUT.mkdir(parents=True, exist_ok=True)
    doc = fitz.open(PAPER)
    for name, (page_index, rect) in CROPS.items():
        pix = doc[page_index].get_pixmap(dpi=DPI, clip=fitz.Rect(*rect))
        pix.save(OUT / f"{name}.png")
        print(f"{name}.png  {pix.width}x{pix.height}")


if __name__ == "__main__":
    main()
