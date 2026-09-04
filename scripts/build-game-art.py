"""
Fit the client's official game covers to the two art slots the site uses.

SOURCES ARE OFFICIAL PRESS KEY ART (4500x5000 from EA's newsroom, 2160x2160
from 2K's), so everything below is now a DOWNSCALE. The earlier versions of this
script were fighting 446-592px thumbnails blown up 3-4.5x, which is why the
cards looked soft at hero size while looking fine as small grid tiles.

    card-<game>.jpg   1920x1080  16:9  — marketplace + homepage cards, CTA,
                                          Stats, and the hero slideshow
    game-<game>.jpg    800x1000   4:5  — the Games grid tile

BOTH SLOTS FILL THE FRAME. No letterboxing, no blurred side panels.

An earlier version of this script centred the whole portrait cover over a
blurred blow-up of itself. That kept every pixel of the box art, but left the
cover as a narrow strip with dead space either side — and sitting next to the
MLB card, which fills its frame, it read as broken rather than deliberate.
Filling is the right call here: these live in a row of cards where consistency
matters more than completeness. A cover that fills its frame reads as artwork;
one floating in a letterbox reads as a mistake.

The cost of filling is that roughly half a portrait cover's height is discarded,
so FOCUS_Y per game decides what survives. It is tuned so the wordmark — the
part that tells a player which game they are looking at — sits near the top of
the frame with the cover athlete filling the rest. Values were set by rendering
and looking at them, not by arithmetic.

TRIM removes retail packaging before any of that: ESRB blocks, "PC / DIGITAL
DOWNLOAD" badges, activation small print, NFLPA, and on the NCAA scan the edge
of the PlayStation case itself.

⚠️ ONE IMAGE, ONE FILE. Do not add a second output byte-identical to another —
Vite dedupes on content and the SSR build then references a filename that was
never written, which 404s on first paint. This project shipped that bug once;
scripts/check-assets.mjs guards it now.

Run: python scripts/build-game-art.py
"""

from PIL import Image, ImageFilter

# slug -> source, trim (l, t, r, b as fractions), 16:9 focus_y, 4:5 focus_y.
#
# focus_y picks which horizontal band survives the crop: 0 keeps the top edge,
# 1 keeps the bottom. All three sit at or near 0 because on official key art the
# wordmark is right at the top — anything higher clips it. (These values are NOT
# transferable from the old box-photo sources: those had different proportions,
# so the same number cropped to a completely different place.)
GAMES = [
    # Official press key art, 4500x5000, from EA's newsroom. Only the ESRB /
    # NFLPA strip along the bottom needs removing — key art has no case edge and
    # no platform badges, unlike the box photos this replaced.
    ("_src-madden-cover.jpg", "madden", (0.0, 0.0, 0.0, 0.115), 0.02, 0.30),
    # Official press key art, 4500x5000. ESRB block bottom-left.
    ("_src-ncaa-cover.jpg", "ncaa", (0.0, 0.0, 0.0, 0.10), 0.0, 0.24),
    # Official Ultra Edition cover, 2160x2160, from 2K's newsroom. Carries an
    # "ULTRA EDITION" line across the top that is an edition label rather than
    # part of the artwork, so it comes off.
    ("_src-nba2k-cover.jpg", "nba2k", (0.0, 0.085, 0.0, 0.0), 0.0, 0.14),
]

CARD_W, CARD_H = 1920, 1080  # 16:9
TILE_W, TILE_H = 800, 1000  # 4:5


def load(name, trim=(0.0, 0.0, 0.0, 0.0)):
    """Open a cover and cut the retail packaging off it."""
    im = Image.open(f"src/assets/{name}").convert("RGB")
    left, top, right, bottom = trim
    if any(trim):
        im = im.crop(
            (
                round(im.width * left),
                round(im.height * top),
                round(im.width * (1 - right)),
                round(im.height * (1 - bottom)),
            )
        )
    return im


def fill_crop(src, out_name, W, H, focus_y):
    """Scale to cover W x H, then crop. Same approach as build-mlb-art.py."""
    s = max(W / src.width, H / src.height)
    r = src.resize((round(src.width * s), round(src.height * s)), Image.LANCZOS)
    x = round((r.width - W) * 0.5)
    y = round((r.height - H) * focus_y)
    out = r.crop((x, y, x + W, y + H))

    # Acutance. LANCZOS is correct interpolation but leaves no edge contrast, and
    # that absence is what a viewer reads as "blurry" — in BOTH directions.
    #
    #   downscale (s < 1): the sources are now 2160-4500px press key art being
    #     reduced to 1920 or 800. Real detail is being thrown away, so a light
    #     touch restores the crispness the resample softened.
    #   upscale (s > 1.2): nothing can invent detail that was never captured,
    #     but restoring edge contrast still helps a lot. Scaled to the factor so
    #     art that barely needed enlarging never gets over-sharpened into halos.
    #
    # The threshold keeps flat areas (sky, studio backdrops) from growing noise.
    if s < 1.0:
        out = out.filter(ImageFilter.UnsharpMask(radius=0.8, percent=65, threshold=3))
    elif s > 1.2:
        amount = min(150, int(60 * s))
        out = out.filter(ImageFilter.UnsharpMask(radius=1.6, percent=amount, threshold=3))

    out.save(f"src/assets/{out_name}", "JPEG", quality=92, subsampling=0)
    kept = round(H / r.height * 100)
    print(
        f"  wrote src/assets/{out_name:22s} {W}x{H}  focus_y={focus_y}  "
        f"upscale={s:.1f}x  keeps {kept}% of height"
    )


if __name__ == "__main__":
    for src_name, slug, trim, card_focus, tile_focus in GAMES:
        print(f"{slug}:")
        cover = load(src_name, trim)
        fill_crop(cover, f"card-{slug}.jpg", CARD_W, CARD_H, card_focus)
        fill_crop(cover, f"game-{slug}.jpg", TILE_W, TILE_H, tile_focus)
