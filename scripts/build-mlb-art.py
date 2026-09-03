"""
Fit Kevin's official 'MLB The Show 26' cover (near-square, ~840x845) to the art
slots the site uses for games. The card/slide slots are object-cover 16:9, so a
letterboxed image just floats in a box — instead we crop the cover to fill the
frame, biased upward so the 'MLB THE SHOW 26' wordmark and Aaron Judge stay in.

Source : src/assets/_src-mlb-cover.png
Outputs: src/assets/card-mlbshow.jpg  (1920x1080, 16:9 — marketplace/homepage cards, CTA, Stats)
         src/assets/slide-mlb.jpg     (1920x1080, 16:9 — hero slideshow)
         src/assets/game-mlb.jpg      (800x1000,  4:5  — Games grid tile)
"""

from PIL import Image

SRC = "src/assets/_src-mlb-cover.png"


def fill_crop(out_path, W, H, focus_y=0.5, focus_x=0.5):
    """Scale the cover to fill W x H, then crop — focus_y/x pick what survives
    (0 = keep the top/left edge, 1 = keep the bottom/right)."""
    src = Image.open(SRC).convert("RGB")
    s = max(W / src.width, H / src.height)
    r = src.resize((round(src.width * s), round(src.height * s)), Image.LANCZOS)
    x = round((r.width - W) * focus_x)
    y = round((r.height - H) * focus_y)
    r.crop((x, y, x + W, y + H)).save(out_path, "JPEG", quality=92, subsampling=1)
    print(f"wrote {out_path}  {W}x{H}  focus_y={focus_y}")


# 16:9 — bias hard to the top so the wordmark + Judge's head/torso are what's kept.
fill_crop("src/assets/card-mlbshow.jpg", 1920, 1080, focus_y=0.06)
fill_crop("src/assets/slide-mlb.jpg", 1920, 1080, focus_y=0.06)
# 4:5 — near-square already; only the far side panels get trimmed.
fill_crop("src/assets/game-mlb.jpg", 800, 1000, focus_y=0.5)
