"""Generate partner launcher and Flutter header assets from official ईज़ीमंडी SVG.
Run from partner_app/ after flutter create; requires Pillow and CairoSVG.
"""
from io import BytesIO
from pathlib import Path
from PIL import Image
import cairosvg

artwork = Path("icon/brand-symbol.svg").read_bytes()
source = Image.open(BytesIO(cairosvg.svg2png(bytestring=artwork, output_width=512))).convert("RGBA")
source.thumbnail((430, 430), Image.Resampling.LANCZOS)
icon = Image.new("RGBA", (512, 512), (0, 0, 0, 0))
icon.alpha_composite(source, ((512 - source.width) // 2, (512 - source.height) // 2))
asset = Path("assets/brand-symbol.png")
asset.parent.mkdir(parents=True, exist_ok=True)
icon.save(asset, optimize=True)
for density, size in {"mdpi": 48, "hdpi": 72, "xhdpi": 96, "xxhdpi": 144, "xxxhdpi": 192}.items():
    directory = Path(f"android/app/src/main/res/mipmap-{density}")
    directory.mkdir(parents=True, exist_ok=True)
    icon.resize((size, size), Image.Resampling.LANCZOS).save(directory / "ic_launcher.png", optimize=True)
print("Official Easy Mandi stacked Hindi logo generated for partner Android.")
