#!/usr/bin/env python3
"""
scripts/cutout-chromakey.py

Утилита удаления хромакея (зелёного фона #00FF00) для спрайтов, эмблем и боевых фигурок.
Поддерживает удаление фона снаружи, а также зачистку внутренних замкнутых полостей
(отверстия в шестерёнках, ручки предметов, буквы логотипов A/O/P/D/B, просветы между конечностями).

Использование:
  python3 scripts/cutout-chromakey.py input.png output.png [опции]

Опции:
  --mode {auto, color, flood, points}
      auto    - (по умолчанию) удаляет внешний фон + зачищает все внутренние замкнутые зелёные полости + despill ореола.
      color   - глобальный цветовой кеинг по всему изображению (удаляет зелёный везде, идеально для логотипов без зелёных деталей).
      flood   - только внешний заливной контур от краёв (0,0).
      points  - зачистка конкретных полостей по координатам X,Y (через запятую или пробел).
  --tol <int>
      Порог чувствительности к зелёному (по умолчанию 35; для тусклого/тёмного хромакея снижайте до 20-25).
  --despill
      Подавление паразитного зелёного ореола на кромках (включено по умолчанию в auto и color).
  --points "X1,Y1 X2,Y2 ..."
      Список координат внутренних полостей для точечного удаления.
"""

import sys
import os
import argparse
import subprocess

def run_imagemagick(input_path, output_path, mode, tol, points_list):
    """Fallback через ImageMagick convert, если PIL/Pillow не установлен."""
    fuzz = f"{int(tol * 100 / 255)}%"
    if mode == "color" or mode == "auto":
        # Глобальное удаление цвета #00FF00 по всему изображению
        cmd = [
            "convert", input_path,
            "-fuzz", fuzz,
            "-transparent", "#00FF00",
            output_path
        ]
        return subprocess.run(cmd, check=True)
    elif mode == "flood":
        cmd = [
            "convert", input_path,
            "-fuzz", fuzz,
            "-fill", "none",
            "-draw", "matte 0,0 floodfill",
            output_path
        ]
        return subprocess.run(cmd, check=True)
    elif mode == "points" and points_list:
        draw_cmds = []
        for x, y in points_list:
            draw_cmds.extend(["-draw", f"matte {x},{y} floodfill"])
        cmd = ["convert", input_path, "-fuzz", fuzz, "-fill", "none"] + draw_cmds + [output_path]
        return subprocess.run(cmd, check=True)
    return None

def process_with_pillow(input_path, output_path, mode="auto", tol=35, despill=True, points_list=None):
    from PIL import Image
    from collections import deque

    img = Image.open(input_path).convert("RGBA")
    w, h = img.size
    px = img.load()

    def is_green(r, g, b):
        # Зелёный доминирует над красным и синим
        return g > 55 and (g - max(r, b)) > tol

    def is_semi_green(r, g, b):
        return g > 50 and (g - max(r, b)) > max(12, tol // 2)

    if mode == "color":
        # Глобальный проход: вырезает зелёный во всём изображении (включая все внутренние полости)
        for y in range(h):
            for x in range(w):
                r, g, b, a = px[x, y]
                if a == 0:
                    continue
                diff = g - max(r, b)
                if g > 55 and diff > tol:
                    # Полная прозрачность
                    px[x, y] = (r, min(g, max(r, b)), b, 0)
                elif despill and g > 50 and diff > 15:
                    # Полупрозрачная граница и подавление ореола
                    k = (diff - 15) / max(1, tol - 15)
                    new_a = int(a * max(0.0, 1.0 - k))
                    new_g = min(g, max(r, b) + 4)
                    px[x, y] = (r, new_g, b, new_a)

    elif mode == "auto":
        # Умный режим:
        # 1. Заливка от границ (внешний фон)
        visited = set()
        queue = deque()

        # Стартуем со всех граничных пикселей
        for x in range(w):
            for y in (0, h - 1):
                r, g, b, a = px[x, y]
                if is_green(r, g, b) or a == 0:
                    queue.append((x, y))
                    visited.add((x, y))
        for y in range(h):
            for x in (0, w - 1):
                if (x, y) not in visited:
                    r, g, b, a = px[x, y]
                    if is_green(r, g, b) or a == 0:
                        queue.append((x, y))
                        visited.add((x, y))

        while queue:
            cx, cy = queue.popleft()
            r, g, b, a = px[cx, cy]
            px[cx, cy] = (r, min(g, max(r, b)), b, 0)

            for dx, dy in ((-1, 0), (1, 0), (0, -1), (0, 1)):
                nx, ny = cx + dx, cy + dy
                if 0 <= nx < w and 0 <= ny < h and (nx, ny) not in visited:
                    nr, ng, nb, na = px[nx, ny]
                    if is_green(nr, ng, nb):
                        visited.add((nx, ny))
                        queue.append((nx, ny))

        # 2. Поиск и зачистка внутренних замкнутых полостей
        # Сканируем оставшиеся пиксели: если внутри остался зелёный остров, очищаем его
        for y in range(h):
            for x in range(w):
                if (x, y) not in visited:
                    r, g, b, a = px[x, y]
                    if a > 0 and is_green(r, g, b):
                        # Нашли внутреннюю зелёную полость! Заливаем её в прозрачность
                        island_q = deque([(x, y)])
                        visited.add((x, y))
                        while island_q:
                            ix, iy = island_q.popleft()
                            ir, ig, ib, ia = px[ix, iy]
                            px[ix, iy] = (ir, min(ig, max(ir, ib)), ib, 0)
                            for dx, dy in ((-1, 0), (1, 0), (0, -1), (0, 1)):
                                nx, ny = ix + dx, iy + dy
                                if 0 <= nx < w and 0 <= ny < h and (nx, ny) not in visited:
                                    nr, ng, nb, na = px[nx, ny]
                                    if is_green(nr, ng, nb):
                                        visited.add((nx, ny))
                                        island_q.append((nx, ny))

        # 3. Деспилл ореола на границах
        if despill:
            for y in range(h):
                for x in range(w):
                    r, g, b, a = px[x, y]
                    if a > 0 and is_semi_green(r, g, b):
                        diff = g - max(r, b)
                        k = (diff - 12) / max(1, tol - 12)
                        new_a = int(a * max(0.0, 1.0 - k * 0.7))
                        new_g = min(g, max(r, b) + 3)
                        px[x, y] = (r, new_g, b, new_a)

    elif mode == "points" and points_list:
        visited = set()
        queue = deque(points_list)
        for pt in points_list:
            visited.add(pt)

        while queue:
            cx, cy = queue.popleft()
            r, g, b, a = px[cx, cy]
            px[cx, cy] = (r, min(g, max(r, b)), b, 0)
            for dx, dy in ((-1, 0), (1, 0), (0, -1), (0, 1)):
                nx, ny = cx + dx, cy + dy
                if 0 <= nx < w and 0 <= ny < h and (nx, ny) not in visited:
                    nr, ng, nb, na = px[nx, ny]
                    if is_green(nr, ng, nb):
                        visited.add((nx, ny))
                        queue.append((nx, ny))

    img.save(output_path, "PNG")

def main():
    parser = argparse.ArgumentParser(description="Вырезание хромакея (#00FF00) и зачистка полостей")
    parser.add_argument("input", help="Путь к исходному файлу (.png/.jpg)")
    parser.add_argument("output", help="Путь к результирующему PNG")
    parser.add_argument("--mode", choices=["auto", "color", "flood", "points"], default="auto",
                        help="Режим: auto (снаружи + внутри), color (глобальный), points (по координатам)")
    parser.add_argument("--tol", type=int, default=35, help="Порог чувствительности (по умолчанию 35)")
    parser.add_argument("--despill", action="store_true", default=True, help="Подавление паразитного ореола")
    parser.add_argument("--points", type=str, default="", help="Координаты внутренних точек 'X1,Y1 X2,Y2'")

    args = parser.parse_args()

    pts = []
    if args.points:
        raw_pts = args.points.replace(";", " ").replace(",", " ").split()
        for i in range(0, len(raw_pts), 2):
            if i + 1 < len(raw_pts):
                pts.append((int(raw_pts[i]), int(raw_pts[i+1])))

    try:
        import PIL
        process_with_pillow(args.input, args.output, mode=args.mode, tol=args.tol, despill=args.despill, points_list=pts)
        print(f"✓ Успешно обработано через Pillow: {args.output} (режим {args.mode})")
    except ImportError:
        print("Pillow не найден, используется ImageMagick fallback...")
        run_imagemagick(args.input, args.output, mode=args.mode, tol=args.tol, points_list=pts)
        print(f"✓ Успешно обработано через ImageMagick: {args.output} (режим {args.mode})")

if __name__ == "__main__":
    main()
