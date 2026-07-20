"""Crop 2x3 dark-mat illustration sheets into individual PNG assets."""
from pathlib import Path

from PIL import Image

SESSION = Path(
    r"C:\Users\adenilson.j\.grok\sessions"
    r"\C%3A%5CUsers%5Cadenilson.j%5CDocuments%5CProjetoJogo"
    r"\019f80e9-d206-7142-8771-670ad5579628\images"
)
OUT = Path(__file__).resolve().parents[1] / "assets" / "cards" / "illustrations"


def crop_grid(img, names, rows=2, cols=3, margin_x=0.02, margin_y=0.03, inset=0.02):
    w, h = img.size
    left = int(w * margin_x)
    top = int(h * margin_y)
    right = int(w * (1 - margin_x))
    bottom = int(h * (1 - margin_y))
    usable_w = right - left
    usable_h = bottom - top
    cell_w = usable_w / cols
    cell_h = usable_h / rows
    inset_x = int(cell_w * inset)
    inset_y = int(cell_h * inset)
    results = []
    for i, name in enumerate(names):
        r, c = divmod(i, cols)
        x0 = int(left + c * cell_w) + inset_x
        y0 = int(top + r * cell_h) + inset_y
        x1 = int(left + (c + 1) * cell_w) - inset_x
        y1 = int(top + (r + 1) * cell_h) - inset_y
        crop = img.crop((x0, y0, x1, y1))
        path = OUT / f"{name}.png"
        crop.save(path)
        results.append((name, crop.size))
    return results


def main():
    OUT.mkdir(parents=True, exist_ok=True)

    sheets = {
        "9.jpg": (
            "sheet-tech-core.jpg",
            ["jab", "double-leg", "sprawl", "low-kick", "ground-and-pound", "cross"],
        ),
        "10.jpg": (
            "sheet-strategy-traits.jpg",
            [
                "pressure",
                "fight-at-range",
                "attack-the-body",
                "film-study",
                "heavy-hands",
                "elite-cardio",
            ],
        ),
        "12.jpg": (
            "sheet-tech-more.jpg",
            ["overhand", "high-kick", "clinch-knee", "single-leg", "rear-naked", "armbar"],
        ),
        "11.jpg": (
            "sheet-training-traits.jpg",
            [
                "boxing-camp",
                "wrestling-camp",
                "cardio-training",
                "iron-chin",
                "clutch-fighter",
                "veteran-experience",
            ],
        ),
    }

    for src, (board_name, names) in sheets.items():
        path = SESSION / src
        if not path.exists():
            print("missing", src)
            continue
        img = Image.open(path).convert("RGB")
        img.save(OUT / board_name, quality=92)
        for name, size in crop_grid(img, names):
            print(f"{name:22} {size[0]}x{size[1]}")
        print("---", board_name)


if __name__ == "__main__":
    main()
