"""Key green chroma from combat sprites and export engine-ready PNGs."""
from pathlib import Path
from PIL import Image

SESSION = Path(
    r"C:\Users\adeni\.grok\sessions\C%3A%5CProjetoJogo\019f813d-41ee-7293-80e7-a8bf99a96381\images"
)
ROOT = Path(__file__).resolve().parents[1]
OUT_R = ROOT / "assets/combat/fighters/red"
OUT_B = ROOT / "assets/combat/fighters/blue"
OUT_A = ROOT / "assets/combat/arena"
OUT_R.mkdir(parents=True, exist_ok=True)
OUT_B.mkdir(parents=True, exist_ok=True)
OUT_A.mkdir(parents=True, exist_ok=True)

# session file -> (corner, pose) — mapped from generation order
MAP = {
    "1.jpg": ("red", "idle"),
    "5.jpg": ("red", "jab"),
    "7.jpg": ("red", "power"),
    "4.jpg": ("red", "kick"),
    "8.jpg": ("red", "takedown"),
    "9.jpg": ("red", "defense"),
    "6.jpg": ("red", "hit"),
    "10.jpg": ("red", "groundTop"),
    "15.jpg": ("red", "groundGuard"),
    "3.jpg": ("blue", "idle"),
    "13.jpg": ("blue", "jab"),
    "12.jpg": ("blue", "power"),
    "14.jpg": ("blue", "kick"),
    "11.jpg": ("blue", "takedown"),
    "19.jpg": ("blue", "defense"),
    "17.jpg": ("blue", "hit"),
    "18.jpg": ("blue", "groundTop"),
    "16.jpg": ("blue", "groundGuard"),
}


def key_green(im: Image.Image) -> Image.Image:
    im = im.convert("RGBA")
    px = im.load()
    w, h = im.size
    for y in range(h):
        for x in range(w):
            r, g, b, a = px[x, y]
            if g > 140 and g > r + 40 and g > b + 40:
                px[x, y] = (0, 0, 0, 0)
            elif g > 100 and r < 80 and b < 80:
                px[x, y] = (0, 0, 0, 0)
    return im


def crop_content(im: Image.Image, pad: int = 8) -> Image.Image:
    bbox = im.getbbox()
    if not bbox:
        return im
    x0, y0, x1, y1 = bbox
    x0 = max(0, x0 - pad)
    y0 = max(0, y0 - pad)
    x1 = min(im.width, x1 + pad)
    y1 = min(im.height, y1 + pad)
    return im.crop((x0, y0, x1, y1))


def fit_canvas(im: Image.Image, tw: int = 256, th: int = 320) -> Image.Image:
    canvas = Image.new("RGBA", (tw, th), (0, 0, 0, 0))
    scale = min((tw - 16) / im.width, (th - 16) / im.height)
    nw = max(1, int(im.width * scale))
    nh = max(1, int(im.height * scale))
    im2 = im.resize((nw, nh), Image.NEAREST)
    x = (tw - nw) // 2
    y = th - nh - 8
    canvas.paste(im2, (x, y), im2)
    return canvas


def main() -> None:
    for src, (corner, pose) in MAP.items():
        p = SESSION / src
        if not p.exists():
            print("MISSING", src)
            continue
        im = Image.open(p)
        im = key_green(im)
        im = crop_content(im)
        im = fit_canvas(im)
        out = (OUT_R if corner == "red" else OUT_B) / f"{pose}.png"
        im.save(out, "PNG")
        print("saved", out.relative_to(ROOT), im.size)

    arena_src = SESSION / "2.jpg"
    if arena_src.exists():
        a = Image.open(arena_src).convert("RGB")
        a.thumbnail((1280, 720), Image.LANCZOS)
        dest = OUT_A / "gym.png"
        a.save(dest, "PNG", optimize=True)
        print("arena", dest.relative_to(ROOT), a.size)
    print("done")


if __name__ == "__main__":
    main()
