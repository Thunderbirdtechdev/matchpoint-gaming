"""
Fit the client's official game covers to the two art slots the site uses.

Sources are portrait box art at low resolution (446x635 to 592x708). The slots
are:

    card-<game>.jpg   1920x1080  16:9  — marketplace + homepage cards, CTA,
                                          Stats, and the hero slideshow
    game-<game>.jpg    800x1000   4:5  — the Games grid tile

WHY 16:9 IS A BLURRED COMPOSITE AND NOT A CROP
----------------------------------------------
build-mlb-art.py fill-crops its source, which worked because that cover was
near-square (840x845) so only the side panels were lost. These are portrait: to
fill 1920x1080 the cover has to be scaled ~4.3x and then 60% of its height
thrown away, which would upscale it into mush AND cut off the wordmark — and on
a box cover the wordmark ("MADDEN NFL 27") is the part that identifies the game.

So instead the cover is fitted to the frame HEIGHT at close to its native size
and centred, over a blown-up, blurred, darkened copy of itself. The blur hides
the upscaling on the backdrop, where nobody is reading detail, and the cover
itself stays sharp and whole. This is what game storefronts do with box art, and
it is what src/lib/game-art.ts already described.

⚠️ ONE IMAGE, ONE FILE. Do not add a second output that is byte-identical to
another — Vite dedupes on content and the SSR build then references a filename
that was never written, which 404s on first paint. That is the bug this
project already shipped once; scripts/check-assets.mjs guards it now.

Run: python scripts/build-game-art.py
"""

from PIL import Image, ImageEnhance, ImageFilter

# source cover -> output slug, plus how much retail packaging to cut off first.
#
# TRIM removes the things that belong on a shop shelf and not on a competitive
# gaming platform: the ESRB rating block, "PC / DIGITAL DOWNLOAD" badges, the
# "INTERNET CONNECTION REQUIRED" small print, and — on the NCAA scan — the edge
# of the PlayStation case itself. Fractions of the source (left, top, right,
# bottom). This is why build-mlb-art.py cropped rather than composited; the
# difference is that trimming chrome and discarding the wordmark are not the
# same operation.
GAMES = [
    # ESRB + PC badge + activation small print + NFLPA along the bottom.
    ("_src-madden-cover.png", "madden", (0.012, 0.0, 0.012, 0.175)),
    # A photo of the boxed game: case edge down both sides, ESRB bottom-left.
    ("_src-ncaa-cover.png", "ncaa", (0.045, 0.008, 0.035, 0.145)),
    # Promo art, not a box shot — nothing to remove but the 2K logo, which is
    # real branding and stays.
    ("_src-nba2k-cover.png", "nba2k", (0.0, 0.0, 0.0, 0.0)),
]

CARD_W, CARD_H = 1920, 1080  # 16:9
TILE_W, TILE_H = 800, 1000  # 4:5


def load(name, trim=(0.0, 0.0, 0.0, 0.0)):
    """Open a cover and cut the retail packaging off it."""
    im = Image.open(f"src/assets/{name}").convert("RGB")
    l, t, r, b = trim
    if any(trim):
        im = im.crop(
            (
                round(im.width * l),
                round(im.height * t),
                round(im.width * (1 - r)),
                round(im.height * (1 - b)),
            )
        )
    return im


def blurred_backdrop(src, W, H):
    """A blown-up, blurred, darkened copy of the cover, filling W x H."""
    s = max(W / src.width, H / src.height)
    # Extra 1.25x so the blur has material past the edges and does not smear
    # the frame border into a visible halo.
    bg = src.resize((round(src.width * s * 1.25), round(src.height * s * 1.25)), Image.LANCZOS)
    bg = bg.crop(
        (
            (bg.width - W) // 2,
            (bg.height - H) // 2,
            (bg.width - W) // 2 + W,
            (bg.height - H) // 2 + H,
        )
    )
    bg = bg.filter(ImageFilter.GaussianBlur(radius=W // 28))
    # Darkened so the sharp cover in front reads as the subject rather than
    # competing with a bright wash behind it.
    return ImageEnhance.Brightness(bg).enhance(0.45)


def build_card(src_name, out_name, trim):
    """16:9 — full cover, sharp, centred over its own blurred blow-up."""
    src = load(src_name, trim)
    canvas = blurred_backdrop(src, CARD_W, CARD_H)

    # Fit to height. The cover keeps its whole vertical extent, wordmark included.
    s = CARD_H / src.height
    fg = src.resize((round(src.width * s), CARD_H), Image.LANCZOS)
    canvas.paste(fg, ((CARD_W - fg.width) // 2, 0))

    path = f"src/assets/{out_name}"
    canvas.save(path, "JPEG", quality=90, subsampling=1)
    print(f"  wrote {path:34s} {CARD_W}x{CARD_H}  cover {fg.width}px wide, whole")


def build_tile(src_name, out_name, trim, focus_y=0.5):
    """4:5 — close to the source shape already, so a fill-crop keeps it sharp."""
    src = load(src_name, trim)
    s = max(TILE_W / src.width, TILE_H / src.height)
    r = src.resize((round(src.width * s), round(src.height * s)), Image.LANCZOS)
    x = round((r.width - TILE_W) * 0.5)
    y = round((r.height - TILE_H) * focus_y)
    r.crop((x, y, x + TILE_W, y + TILE_H)).save(
        f"src/assets/{out_name}", "JPEG", quality=90, subsampling=1
    )
    print(f"  wrote src/assets/{out_name:28s} {TILE_W}x{TILE_H}  focus_y={focus_y}")


if __name__ == "__main__":
    for src_name, slug, trim in GAMES:
        print(f"{slug}:")
        build_card(src_name, f"card-{slug}.jpg", trim)
        # Bias upward: on all three covers the wordmark sits in the top third,
        # and it is what tells a player which game they are looking at.
        build_tile(src_name, f"game-{slug}.jpg", trim, focus_y=0.30)
