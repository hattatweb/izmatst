#!/usr/bin/env python3
"""Erzeugt optimierte WebP-Varianten aus Originalbildern (JPG/PNG).
Aufruf: python3 tools/images.py <Originalordner>   (Ordner mit assets/… wie im Repo)
Nur für die Agentur nötig; Gerichtfotos aus der Verwaltung werden im Browser automatisch verkleinert."""
import sys, pathlib
from PIL import Image
SRC = pathlib.Path(sys.argv[1] if len(sys.argv) > 1 else ".")
DST = pathlib.Path(__file__).resolve().parent.parent

def out(src_rel, dst_rel, width, q=80):
    im = Image.open(SRC / src_rel)
    im = im.convert("RGBA" if im.mode in ("P", "LA", "RGBA") else "RGB")
    if im.width > width:
        im = im.resize((width, round(im.height * width / im.width)), Image.LANCZOS)
    (DST / dst_rel).parent.mkdir(parents=True, exist_ok=True)
    im.save(DST / dst_rel, "WEBP", quality=q, method=6)
    print(f"{dst_rel:45} {im.size[0]}x{im.size[1]}  {(DST/dst_rel).stat().st_size//1024} KB")

for n in ("hero1", "hero2"):
    out(f"assets/images/extra/{n}.jpg", f"assets/images/extra/{n}-800.webp", 800, 72)
    out(f"assets/images/extra/{n}.jpg", f"assets/images/extra/{n}.webp", 1400, 76)
out("assets/images/extra/gallery4.jpg", "assets/images/extra/gallery4-800.webp", 800, 72)
out("assets/images/background.jpg", "assets/images/background-900.webp", 900, 60)
out("assets/images/background.jpg", "assets/images/background.webp", 1600, 62)
# Galerie: Vorschaubilder (Raster) + große Fassung (Lightbox)
for f in ["extra/gallery1", "extra/gallery2", "extra/gallery3", "extra/gallery4", "extra/hero1", "extra/hero2",
          "extra/hero3", "interior1", "interior2", "interior3", "interior4", "interior5", "interior6"]:
    out(f"assets/images/{f}.jpg", f"assets/images/{f}-thumb.webp", 640, 74)
