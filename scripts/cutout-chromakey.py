#!/usr/bin/env python3
"""
Инструмент чемодана ИИ Chronicle Forge для автоматического вырезания фона и хромакея.

Проблема: диффузионные нейросети не поддерживают реальный альфа-канал и рисуют
фейковую шахматку или монохромные квадраты вокруг спрайтов.
Решение: генерация на однородном контрастном фоне (хромакей: зеленый, маджента, белый)
с последующей пакетной обработкой данным скриптом.

Использование:
  python3 scripts/cutout-chromakey.py input.png [output.png] [--color #00FF00] [--fuzz 30] [--floodfill]
  python3 scripts/cutout-chromakey.py "public/campaigns/**/fig_*.png"
"""

import sys
import os
import glob
import argparse
from PIL import Image, ImageFilter

def parse_hex_color(hex_str: str) -> tuple[int, int, int]:
    s = hex_str.strip().lstrip('#')
    if len(s) == 3:
        s = ''.join([c * 2 for c in s])
    if len(s) != 6:
        raise ValueError(f"Invalid hex color: {hex_str}")
    return (int(s[0:2], 16), int(s[2:4], 16), int(s[4:6], 16))

def color_dist(c1: tuple[int, int, int], c2: tuple[int, int, int]) -> float:
    # Евклидово расстояние в пространстве RGB
    return ((c1[0] - c2[0]) ** 2 + (c1[1] - c2[1]) ** 2 + (c1[2] - c2[2]) ** 2) ** 0.5

def detect_corner_color(img: Image.Image) -> tuple[int, int, int]:
    w, h = img.size
    corners = [(0, 0), (w - 1, 0), (0, h - 1), (w - 1, h - 1), (2, 2), (w - 3, 2)]
    rgb_img = img.convert('RGB')
    pixels = [rgb_img.getpixel(pos) for pos in corners]
    # Находим самый частый цвет или среднее
    return pixels[0]

def is_checkerboard(img: Image.Image) -> bool:
    """Проверяет, нарисована ли в углах фейковая шахматная сетка."""
    rgb = img.convert('RGB')
    w, h = img.size
    sample = [rgb.getpixel((x, 0)) for x in range(min(32, w))]
    has_white = any(c[0] > 240 and c[1] > 240 and c[2] > 240 for c in sample)
    has_gray = any(190 < c[0] < 235 and 190 < c[1] < 235 and 190 < c[2] < 235 for c in sample)
    return has_white and has_gray

def remove_background(
    img_path: str,
    out_path: str | None = None,
    target_color: tuple[int, int, int] | None = None,
    fuzz: float = 35.0,
    use_floodfill: bool = True,
    despill: bool = True
) -> bool:
    try:
        orig = Image.open(img_path).convert('RGBA')
    except Exception as e:
        print(f"[!] Ошибка открытия {img_path}: {e}")
        return False

    w, h = orig.size
    rgb = orig.convert('RGB')

    # Определение цвета фона
    if target_color is None:
        if is_checkerboard(orig):
            print(f"[*] {os.path.basename(img_path)}: обнаружена нарисованная шахматка (fake checkerboard), удаляем светлые квадраты...")
            # Удаление шахматки по порогу яркости в углах
            bg_color = (255, 255, 255)
            fuzz = 65.0
        else:
            bg_color = detect_corner_color(orig)
    else:
        bg_color = target_color

    mask = Image.new('L', (w, h), 255)

    if use_floodfill:
        # Заливка от углов с допуском: защищает внутренние элементы персонажа того же цвета
        # Используем Image.floodfill (Pillow 8.0+)
        from PIL import ImageDraw
        # Создаем временную карту схожести с фоном
        diff_map = Image.new('L', (w, h), 0)
        diff_pixels = diff_map.load()
        rgb_pixels = rgb.load()

        for y in range(h):
            for x in range(w):
                if color_dist(rgb_pixels[x, y], bg_color) <= fuzz:
                    diff_pixels[x, y] = 255

        # Заливаем от всех 4 углов
        fill_mask = Image.new('L', (w + 2, h + 2), 0)
        # В Pillow ImageDraw.floodfill работает по равенству цветов
        # Заливаем соединенные области фона
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
        # Глобальное вырезание по цвету
        rgb_pixels = rgb.load()
        mask_pixels = mask.load()
        for y in range(h):
            for x in range(w):
                d = color_dist(rgb_pixels[x, y], bg_color)
                if d <= fuzz:
                    mask_pixels[x, y] = 0
                elif d <= fuzz + 15:
                    # Мягкий антиалиасинг границы
                    alpha = int(((d - fuzz) / 15.0) * 255)
                    mask_pixels[x, y] = alpha

    # Сглаживание края альфа-канала (Feathering 1px)
    mask = mask.filter(ImageFilter.SMOOTH_MORE)

    # Применение деспиллинга (убирает зеленый/цветной ореол на краях)
    result = orig.copy()
    if despill and (bg_color[1] > bg_color[0] + 50 and bg_color[1] > bg_color[2] + 50):
        # Зеленый хромакей: подавляем зеленый оттенок на краевых пикселях
        r_pixels = result.load()
        m_pixels = mask.load()
        for y in range(h):
            for x in range(w):
                if m_pixels[x, y] > 0 and m_pixels[x, y] < 250:
                    r, g, b, a = r_pixels[x, y]
                    max_rb = max(r, b)
                    if g > max_rb:
                        r_pixels[x, y] = (r, max_rb, b, a)

    result.putalpha(mask)

    dest = out_path or img_path
    result.save(dest, format='PNG')
    print(f"[✓] Успешно обработано: {dest} (размер: {w}x{h})")
    return True

def main():
    parser = argparse.ArgumentParser(description="Автоматическое вырезание фона / хромакея для спрайтов Chronicle Forge.")
    parser.add_argument("input", help="Путь к файлу картинки или маске glob (например 'public/**/fig_*.png')")
    parser.add_argument("output", nargs="?", help="Куда сохранить результат (по умолчанию перезаписывает исходный)")
    parser.add_argument("--color", help="HEX цвет хромакея (например #00FF00 для зеленого, #FF00FF для мадженты). По умолчанию — автоопределение по углам.")
    parser.add_argument("--fuzz", type=float, default=38.0, help="Допуск разброса цвета (0-100, по умолчанию 38)")
    parser.add_argument("--no-floodfill", action="store_true", help="Отключить заливку от углов (вырезать цвет везде)")
    parser.add_argument("--no-despill", action="store_true", help="Отключить подавление зеленого ореола на контурах")

    args = parser.parse_args()

    target_color = parse_hex_color(args.color) if args.color else None

    # Поддержка glob
    files = glob.glob(args.input, recursive=True)
    if not files and os.path.exists(args.input):
        files = [args.input]

    if not files:
        print(f"[!] Файлы по шаблону '{args.input}' не найдены.")
        sys.exit(1)

    print(f"Обработка {len(files)} изображений...")
    count = 0
    for f in files:
        out = args.output if (len(files) == 1 and args.output) else f
        if remove_background(
            f,
            out,
            target_color=target_color,
            fuzz=args.fuzz,
            use_floodfill=not args.no_floodfill,
            despill=not args.no_despill
        ):
            count += 1

    print(f"Готово! Обработано файлов: {count}/{len(files)}")

if __name__ == "__main__":
    main()
