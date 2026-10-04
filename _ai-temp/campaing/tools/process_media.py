# -*- coding: utf-8 -*-
"""Обработка сгенерированных картинок: вырезание зелёного фона, кроп,
спрайты/портреты/фигурки, полноэкранные фоны, нарезка листов предметов.

Исходники лежат в assets_raw/, результат — в campaign_package/assets/.
Скрипт идемпотентен: можно запускать после каждой новой партии картинок.
"""
import sys
from pathlib import Path

from PIL import Image

ROOT = Path(__file__).resolve().parent.parent
RAW = ROOT / "assets_raw"
OUT = ROOT / "campaign_package" / "assets"


def key_green(img: Image.Image, tol=46) -> Image.Image:
    """Убирает равномерный зелёный фон, оставляя мягкий край."""
    img = img.convert("RGBA")
    px = img.load()
    w, h = img.size
    for y in range(h):
        for x in range(w):
            r, g, b, a = px[x, y]
            if g > 70 and g - max(r, b) > tol:
                px[x, y] = (r, min(g, max(r, b) + 8), b, 0)
            elif g > 70 and g - max(r, b) > 18:
                # полупрозрачная кромка + подавление зелёного ореола
                k = (g - max(r, b) - 18) / (tol - 18)
                px[x, y] = (r, min(g, max(r, b) + 6), b, int(a * max(0.0, 1.0 - k)))
    return img


def bbox_of_alpha(img: Image.Image, threshold=10):
    alpha = img.getchannel("A")
    return alpha.point(lambda v: 255 if v > threshold else 0).getbbox()


def trim(img: Image.Image, margin=0.02) -> Image.Image:
    box = bbox_of_alpha(img)
    if not box:
        return img
    x0, y0, x1, y1 = box
    m = int(max(x1 - x0, y1 - y0) * margin)
    return img.crop((max(0, x0 - m), max(0, y0 - m),
                     min(img.width, x1 + m), min(img.height, y1 + m)))


def fit(img: Image.Image, size, mode="height") -> Image.Image:
    if mode == "height":
        k = size / img.height
    else:
        k = size / img.width
    return img.resize((max(1, round(img.width * k)), max(1, round(img.height * k))), Image.LANCZOS)


def square_canvas(img: Image.Image, size) -> Image.Image:
    canvas = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    k = min(size / img.width, size / img.height)
    new = img.resize((max(1, round(img.width * k)), max(1, round(img.height * k))), Image.LANCZOS)
    canvas.paste(new, ((size - new.width) // 2, (size - new.height) // 2), new)
    return canvas


def crop_fullscreen(path: Path, out: Path, size=(1600, 900)):
    img = Image.open(path).convert("RGB")
    target = size[0] / size[1]
    w, h = img.size
    if w / h > target:
        nw = int(h * target)
        img = img.crop(((w - nw) // 2, 0, (w + nw) // 2, h))
    else:
        nh = int(w / target)
        img = img.crop((0, (h - nh) // 2, w, (h + nh) // 2))
    img = img.resize(size, Image.LANCZOS)
    out.parent.mkdir(parents=True, exist_ok=True)
    img.save(out, "JPEG", quality=86, optimize=True)
    return out


def process_character(name: str):
    src = RAW / ("%s.png" % name)
    if not src.exists():
        return None
    img = trim(key_green(Image.open(src)))
    npc_dir = OUT / "img" / "npc"
    fig_dir = OUT / "img" / "figures"
    npc_dir.mkdir(parents=True, exist_ok=True)
    fig_dir.mkdir(parents=True, exist_ok=True)

    base = name.replace("npc_", "")
    sprite = fit(img, 760)
    sprite.save(npc_dir / ("%s_sprite.png" % base), "PNG", optimize=True)

    head_h = int(img.height * 0.52)
    head = img.crop((0, 0, img.width, head_h))
    square_canvas(head, 512).save(npc_dir / ("%s.png" % base), "PNG", optimize=True)

    fit(img, 260).save(fig_dir / ("%s.png" % base), "PNG", optimize=True)
    return name


def split_sheet(name: str, columns: int, out_names, out_dir: Path, size=460, margin=6):
    """Режет лист «в ряд» на отдельные прозрачные объекты."""
    src = RAW / ("%s.png" % name)
    if not src.exists():
        return []
    img = key_green(Image.open(src))
    w, h = img.size
    made = []
    for i, out_name in enumerate(out_names):
        band = img.crop((int(w * i / columns), 0, int(w * (i + 1) / columns), h))
        box = bbox_of_alpha(band, 12)
        if box:
            band = band.crop((max(0, box[0] - margin), max(0, box[1] - margin),
                              min(band.width, box[2] + margin), min(band.height, box[3] + margin)))
        out_dir.mkdir(parents=True, exist_ok=True)
        fit(band, size).save(out_dir / ("%s.png" % out_name), "PNG", optimize=True)
        made.append(out_name)
    return made


def main():
    characters = ["npc_hero", "npc_guard", "npc_vein", "npc_sergeant", "npc_medic", "npc_marta",
                  "npc_irena", "npc_bossar", "npc_lissa", "npc_valent", "npc_quiet", "npc_rusty",
                  "npc_rat"]
    done = []
    for name in characters:
        if name == "npc_guard":
            continue
        r = process_character(name)
        if r:
            done.append(r)
    if (RAW / "test_sprite.png").exists():
        npc_dir = OUT / "img" / "npc"
        fig_dir = OUT / "img" / "figures"
        npc_dir.mkdir(parents=True, exist_ok=True)
        fig_dir.mkdir(parents=True, exist_ok=True)
        img = trim(key_green(Image.open(RAW / "test_sprite.png")))
        fit(img, 760).save(npc_dir / "guard_sprite.png", "PNG", optimize=True)
        square_canvas(img.crop((0, 0, img.width, int(img.height * 0.52))), 512).save(
            npc_dir / "guard.png", "PNG", optimize=True)
        fit(img, 260).save(fig_dir / "guard.png", "PNG", optimize=True)
        done.append("npc_guard")

    # фигурки боя: вышибала использует фигурку бригадира
    fig = OUT / "img" / "figures"
    fig.mkdir(parents=True, exist_ok=True)
    for alias, source in (("thug", "bossar"),):
        src = fig / ("%s.png" % source)
        dst = fig / ("%s.png" % alias)
        if src.exists() and not dst.exists():
            Image.open(src).save(dst, "PNG", optimize=True)

    # листы предметов
    sheets = {
        "props_sheet_1": (5, ["notice", "board", "shelf", "locker", "cabinet"]),
        "props_sheet_2": (5, ["hearth", "bed", "forge", "bench", "cart"]),
        "props_sheet_3": (5, ["puddle", "pit", "crane", "valve", "gauge"]),
        "props_sheet_4": (5, ["cradle", "pipes", "body", "ledger", "debris"]),
        "items_sheet_1": (5, ["item_filter", "item_implant", "item_ledger", "item_flask",
                              "item_wrench"]),
    }
    for sheet, (cols, names) in sheets.items():
        target = (OUT / "img" / "props") if sheet.startswith("props") else (OUT / "img" / "items")
        made = split_sheet(sheet, cols, names, target)
        if made:
            done.append("%s(%d)" % (sheet, len(made)))

    # полноэкранные картинки
    for raw_name, out_rel in (
        ("menu", "img/menu.jpg"), ("end", "img/end.jpg"),
        ("scene_gate_day", "img/scenes/scene_gate_day.jpg"),
        ("scene_market_day", "img/scenes/scene_market_day.jpg"),
        ("scene_works_day", "img/scenes/scene_works_day.jpg"),
    ):
        p = RAW / ("%s.png" % raw_name)
        if p.exists():
            crop_fullscreen(p, OUT / out_rel)
            done.append(raw_name)

    print("обработано:", ", ".join(done) if done else "нечего")


if __name__ == "__main__":
    sys.exit(main())
