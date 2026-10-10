"""Generate delivery partner app launcher icons using the shared Easy Mandi symbol.

Run from partner_app/ after flutter create. Requires Pillow.
"""
import base64
from io import BytesIO
from pathlib import Path
import re
from PIL import Image

source = Path("icon/brand-symbol.svg").read_text(encoding="utf-8")
match = re.search(r"data:image/png;base64,([A-Za-z0-9+/=]+)", source)
if not match:
    raise SystemExit("Missing Easy Mandi approved cart icon")

image = Image.open(BytesIO(base64.b64decode(match.group(1), validate=True))).convert("RGBA")
if image.width != image.height or image.width < 128:
    raise SystemExit("Invalid Easy Mandi brand icon")

asset = Path("assets/brand-symbol.png")
asset.parent.mkdir(parents=True, exist_ok=True)
image.resize((512, 512), Image.Resampling.LANCZOS).save(asset, optimize=True)

base = Path("android/app/src/main/res")
for density, size in {"mdpi": 48, "hdpi": 72, "xhdpi": 96, "xxhdpi": 144, "xxxhdpi": 192}.items():
    out = base / f"mipmap-{density}"
    out.mkdir(parents=True, exist_ok=True)
    image.resize((size, size), Image.Resampling.LANCZOS).save(out / "ic_launcher.png", optimize=True)

print("Easy Mandi delivery launcher and app header generated from shared brand.")
