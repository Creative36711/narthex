#!/usr/bin/env python3
"""
Инструмент чемодана ИИ Chronicle Forge для автоматического вырезания фона и хромакея.

Проблема: диффузионные нейросети не поддерживают реальный альфа-канал и рисуют
фейковую шахматку или монохромные квадраты вокруг спрайтов.
Решение: генерация на однородном контрастном фоне (хромакей: зеленый #00FF00, маджента #FF00FF)
с последующей пакетной обработкой данным скриптом.

Работает как через системный ImageMagick (convert), так и через Python Pillow.
"""

import sys
import os
import glob
import argparse
import subprocess
import shutil

def cutout_via_imagemagick(img_path: str, out_path: str, color: str = "#00FF00", fuzz: int = 25, use_floodfill: bool = True) -> bool:
    """Вырезание фона через предустановленный системный ImageMagick (convert)."""
    convert_bin = shutil.which("convert")
    if not convert_bin:
        return False

    try:
        if use_floodfill:
            # Заливка от границ внутрь (защищает зеленые детали внутри силуэта)
            cmd = [
                convert_bin,
                img_path,
                "-bordercolor", color,
                "-border", "1x1",
                "-fuzz", f"{fuzz}%",
                "-fill", "none",
                "-floodfill", "+0+0", color,
                "-shave", "1x1",
                out_path
            ]
        else:
            cmd = [
                convert_bin,
                img_path,
                "-fuzz", f"{fuzz}%",
                "-transparent", color,
                out_path
            ]
        res = subprocess.run(cmd, capture_output=True, text=True)
        return res.returncode == 0
    except Exception as e:
        return False

def cutout_via_pillow(img_path: str, out_path: str, color: str = "#00FF00", fuzz: int = 25, use_floodfill: bool = True) -> bool:
    """Вырезание фона через Pillow (если установлен)."""
    try:
        from PIL import Image, ImageDraw, ImageFilter
    except ImportError:
        return False

    try:
        s = color.lstrip('#')
        rgb_color = (int(s[0:2], 16), int(s[2:4], 16), int(s[4:6], 16))
        orig = Image.open(img_path).convert('RGBA')
        w, h = orig.size
        rgb = orig.convert('RGB')
        mask = Image.new('L', (w, h), 255)

        diff_map = Image.new('L', (w, h), 0)
        diff_pixels = diff_map.load()
        rgb_pixels = rgb.load()
        dist_threshold = (fuzz / 100.0) * 441.67 # макс расстояние RGB

        for y in range(h):
            for x in range(w):
                c = rgb_pixels[x, y]
                dist = ((c[0]-rgb_color[0])**2 + (c[1]-rgb_color[1])**2 + (c[2]-rgb_color[2])**2)**0.5
                if dist <= dist_threshold:
                    diff_pixels[x, y] = 255

        if use_floodfill:
            ImageDraw.floodfill(diff_map, (0, 0), 128)
            if diff_pixels[w - 1, 0] == 255: ImageDraw.floodfill(diff_map, (w - 1, 0), 128)
            if diff_pixels[0, h - 1] == 255: ImageDraw.floodfill(diff_map, (0, h - 1), 128)
            if diff_pixels[w - 1, h - 1] == 255: ImageDraw.floodfill(diff_map, (w - 1, h - 1), 128)

            mask_pixels = mask.load()
            diff_data = diff_map.load()
            for y in range(h):
                for x in range(w):
                    if diff_data[x, y] == 128:
                        mask_pixels[x, y] = 0
        else:
            mask_pixels = mask.load()
            for y in range(h):
                for x in range(w):
                    if diff_pixels[x, y] == 255:
                        mask_pixels[x, y] = 0

        mask = mask.filter(ImageFilter.SMOOTH_MORE)
        orig.putalpha(mask)
        orig.save(out_path, format='PNG')
        return True
    except Exception:
        return False

def remove_background(img_path: str, out_path: str, color: str = "#00FF00", fuzz: int = 25, use_floodfill: bool = True) -> bool:
    dest = out_path or img_path
    # Сначала пробуем системный ImageMagick (convert), затем Pillow
    ok = cutout_via_imagemagick(img_path, dest, color=color, fuzz=fuzz, use_floodfill=use_floodfill)
    if not ok:
        ok = cutout_via_pillow(img_path, dest, color=color, fuzz=fuzz, use_floodfill=use_floodfill)

    if ok:
        print(f"[✓] Успешно вырезан фон: {dest}")
        return True
    else:
        print(f"[!] Не удалось обработать {img_path} (нужен convert ImageMagick или python3-pillow)")
        return False

def main():
    parser = argparse.ArgumentParser(description="Автоматическое вырезание хромакея для спрайтов Chronicle Forge.")
    parser.add_argument("input", help="Файл или маска glob (например 'public/**/fig_*.png')")
    parser.add_argument("output", nargs="?", help="Куда сохранить результат (по умолчанию перезаписывает исходный)")
    parser.add_argument("--color", default="#00FF00", help="HEX цвет хромакея (#00FF00 зеленый, #FF00FF маджента). По умолчанию #00FF00.")
    parser.add_argument("--fuzz", type=int, default=25, help="Допуск разброса оттенка в процентах (по умолчанию 25%%)")
    parser.add_argument("--no-floodfill", action="store_true", help="Отключить заливку от углов (вырезать цвет по всей площади)")

    args = parser.parse_args()

    files = glob.glob(args.input, recursive=True)
    if not files and os.path.exists(args.input):
        files = [args.input]

    if not files:
        print(f"[!] Файлы по шаблону '{args.input}' не найдены.")
        sys.exit(1)

    print(f"Обработка {len(files)} изображений (хромакей {args.color})...")
    count = 0
    for f in files:
        out = args.output if (len(files) == 1 and args.output) else f
        if remove_background(f, out, color=args.color, fuzz=args.fuzz, use_floodfill=not args.no_floodfill):
            count += 1

    print(f"Готово! Обработано файлов: {count}/{len(files)}")

if __name__ == "__main__":
    main()
