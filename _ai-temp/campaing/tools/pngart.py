"""Минимальный PNG-рендер: прозрачные жетоны существ без внешних библиотек.

Рисуем силуэт с подсветкой контура — стиль «фишки на столе»: читается на
гексагональной сетке любого размера и не зависит от генеративных моделей.
"""

import math
import struct
import zlib

W, H = 160, 200


class Canvas:
    def __init__(self, w=W, h=H):
        self.w, self.h = w, h
        self.px = [[(0, 0, 0, 0)] * w for _ in range(h)]

    def blend(self, x, y, rgba):
        if not (0 <= x < self.w and 0 <= y < self.h):
            return
        r, g, b, a = rgba
        if a <= 0:
            return
        if a >= 255:
            self.px[y][x] = (r, g, b, a)
            return
        pr, pg, pb, pa = self.px[y][x]
        k = a / 255
        self.px[y][x] = (int(pr * (1 - k) + r * k), int(pg * (1 - k) + g * k),
                         int(pb * (1 - k) + b * k), max(pa, a))

    def poly(self, pts, color):
        ys = [p[1] for p in pts]
        for y in range(int(min(ys)), int(max(ys)) + 1):
            xs = []
            n = len(pts)
            for i in range(n):
                x1, y1 = pts[i]
                x2, y2 = pts[(i + 1) % n]
                if (y1 <= y < y2) or (y2 <= y < y1):
                    t = (y - y1) / (y2 - y1)
                    xs.append(x1 + t * (x2 - x1))
            xs.sort()
            for i in range(0, len(xs) - 1, 2):
                for x in range(int(math.ceil(xs[i])), int(xs[i + 1]) + 1):
                    self.blend(x, y, color + (255,) if len(color) == 3 else color)

    def ellipse(self, cx, cy, rx, ry, color):
        for y in range(int(cy - ry), int(cy + ry) + 1):
            for x in range(int(cx - rx), int(cx + rx) + 1):
                if ((x - cx) / rx) ** 2 + ((y - cy) / ry) ** 2 <= 1:
                    self.blend(x, y, color + (255,) if len(color) == 3 else color)

    def line(self, x1, y1, x2, y2, color, thick=3):
        steps = int(max(abs(x2 - x1), abs(y2 - y1)) * 2) + 1
        for i in range(steps + 1):
            t = i / steps
            x, y = x1 + (x2 - x1) * t, y1 + (y2 - y1) * t
            for dx in range(-thick // 2, thick // 2 + 1):
                for dy in range(-thick // 2, thick // 2 + 1):
                    if dx * dx + dy * dy <= (thick / 2) ** 2:
                        self.blend(int(x + dx), int(y + dy),
                                   color + (255,) if len(color) == 3 else color)

    def rim(self, color, width=2):
        """Контурная подсветка по краю альфы — читается на тёмном фоне."""
        solid = [[self.px[y][x][3] > 40 for x in range(self.w)] for y in range(self.h)]
        for y in range(self.h):
            for x in range(self.w):
                if solid[y][x]:
                    continue
                near = any(solid[min(self.h - 1, max(0, y + dy))][min(self.w - 1, max(0, x + dx))]
                           for dy in (-1, 0, 1) for dx in (-1, 0, 1))
                if near:
                    self.blend(x, y, color + (255,) if len(color) == 3 else color)
        return self

    def save(self, path):
        raw = bytearray()
        for row in self.px:
            raw.append(0)
            for r, g, b, a in row:
                raw += bytes((r, g, b, a))

        def chunk(tag, data):
            c = struct.pack(">I", len(data)) + tag + data
            return c + struct.pack(">I", zlib.crc32(tag + data) & 0xFFFFFFFF)

        png = b"\x89PNG\r\n\x1a\n"
        png += chunk(b"IHDR", struct.pack(">IIBBBBB", self.w, self.h, 8, 6, 0, 0, 0))
        png += chunk(b"IDAT", zlib.compress(bytes(raw), 9))
        png += chunk(b"IEND", b"")
        with open(path, "wb") as f:
            f.write(png)


def base(cy=176):
    """Общая тень-подложка под жетоном."""
    c = Canvas()
    c.ellipse(80, cy, 46, 9, (8, 9, 12, 150))
    return c


def hound(path):
    c = base(180)
    body = (58, 56, 60)
    dark = (40, 39, 44)
    c.poly([(30, 150), (52, 108), (104, 100), (126, 116), (130, 148), (104, 156), (56, 158)], body)
    c.poly([(104, 100), (126, 84), (146, 78), (150, 92), (132, 108), (124, 118)], body)  # шея/голова
    c.poly([(140, 80), (158, 74), (156, 86), (142, 90)], dark)  # морда
    c.poly([(126, 78), (134, 58), (142, 80)], dark)  # ухо
    for x, y in ((38, 152), (52, 156), (104, 152), (118, 154)):  # лапы
        c.poly([(x - 7, y + 14), (x - 5, y - 14), (x + 5, y - 14), (x + 7, y + 14)], dark)
    c.poly([(26, 132), (14, 108), (22, 100), (34, 124)], dark)  # хвост
    c.ellipse(146, 82, 4, 4, (196, 116, 44))  # глаз
    c.ellipse(150, 84, 2, 2, (255, 176, 92))
    for i in range(9):  # пепел с шерсти
        c.ellipse(40 + i * 12, 96 + (i % 3) * 9, 3, 3, (150, 150, 148, 120))
    c.rim((120, 124, 132), 2)
    c.save(path)


def boltnik(path):
    c = base(182)
    cloth = (62, 54, 46)
    skin = (128, 104, 84)
    iron = (78, 72, 68)
    c.poly([(56, 176), (60, 120), (100, 120), (104, 176)], cloth)  # тело
    c.poly([(52, 124), (108, 124), (104, 152), (56, 152)], cloth)
    c.ellipse(80, 96, 17, 20, skin)  # голова
    c.poly([(62, 92), (98, 92), (96, 80), (64, 80)], (46, 42, 40))  # повязка
    c.ellipse(73, 96, 3, 3, (20, 18, 20))
    c.ellipse(87, 96, 3, 3, (20, 18, 20))
    c.line(104, 128, 138, 66, iron, 7)  # лом
    c.poly([(134, 74), (146, 58), (152, 66), (140, 82)], (96, 88, 80))
    c.line(104, 132, 118, 130, (150, 128, 70), 4)  # проволока
    c.line(96, 138, 110, 142, (150, 128, 70), 4)
    c.poly([(56, 156), (104, 156), (100, 172), (60, 172)], (48, 42, 38))
    c.rim((126, 112, 88), 2)
    c.save(path)


def automaton(path):
    c = base(184)
    iron = (86, 66, 50)
    dark = (54, 42, 34)
    hot = (196, 104, 44)
    c.poly([(56, 108), (104, 108), (116, 138), (44, 138)], iron)  # корпус
    c.ellipse(80, 132, 26, 10, dark)
    c.ellipse(80, 92, 14, 14, iron)  # башка
    c.ellipse(74, 90, 4, 4, hot)
    c.ellipse(86, 90, 4, 4, hot)
    for a in (-24, 24):  # три ноги
        c.line(80 + a * 0.4, 138, 80 + a, 182, dark, 6)
    c.line(80, 138, 80, 182, dark, 6)
    c.line(56, 112, 26, 96, iron, 6)  # клешня
    c.line(26, 96, 18, 76, iron, 5)
    c.line(26, 96, 36, 74, iron, 5)
    c.line(104, 112, 134, 98, iron, 6)
    c.ellipse(80, 150, 6, 6, hot)  # топка
    c.ellipse(80, 150, 3, 3, (255, 186, 96))
    c.poly([(64, 76), (96, 76), (92, 66), (68, 66)], dark)  # труба
    for i in range(6):  # пар
        c.ellipse(70 + i * 5, 58 - i * 6 - (i % 2) * 4, 5, 5, (170, 176, 180, 70))
    c.rim((132, 116, 96), 2)
    c.save(path)


def mirror(path):
    c = base(182)
    cloth = (44, 48, 58)
    glass = (188, 196, 206)
    c.poly([(56, 176), (60, 116), (100, 116), (104, 176)], cloth)
    c.poly([(52, 122), (108, 122), (104, 150), (56, 150)], cloth)
    c.ellipse(80, 94, 16, 19, cloth)
    c.poly([(66, 84), (94, 84), (92, 108), (68, 108)], glass)  # лицо-зеркало
    c.poly([(72, 96), (88, 96), (86, 104), (74, 104)], (28, 32, 40))  # отражение-провал
    c.line(70, 88, 90, 100, (255, 255, 255, 180), 2)
    c.line(60, 118, 40, 148, cloth, 6)  # рука с осколком
    c.poly([(34, 140), (46, 150), (40, 160), (28, 150)], glass)
    c.line(100, 118, 120, 144, cloth, 6)
    c.ellipse(120, 150, 5, 8, glass)
    c.rim((176, 190, 206), 2)
    c.save(path)


def scav(path):
    c = base(182)
    cloth = (66, 58, 44)
    skin = (132, 110, 88)
    c.poly([(58, 176), (62, 122), (98, 122), (102, 176)], cloth)
    c.ellipse(80, 100, 16, 18, skin)
    c.poly([(62, 98), (98, 98), (96, 84), (64, 84)], (58, 52, 40))  # капюшон
    c.ellipse(74, 100, 3, 3, (18, 18, 20))
    c.ellipse(86, 100, 3, 3, (18, 18, 20))
    c.line(60, 130, 34, 152, cloth, 7)  # рука
    c.line(34, 152, 20, 132, (92, 86, 78), 5)  # арматура
    c.line(100, 130, 118, 150, cloth, 7)
    c.ellipse(124, 158, 10, 12, (72, 66, 56))  # мешок добычи
    c.poly([(118, 166), (132, 166), (128, 176), (122, 176)], (52, 48, 42))
    c.rim((130, 120, 96), 2)
    c.save(path)


TOKENS = {
    "fig_hound": hound,
    "fig_boltnik": boltnik,
    "fig_automaton": automaton,
    "fig_mirror": mirror,
    "fig_scav": scav,
}


def render_all(out_dir):
    import os
    os.makedirs(out_dir, exist_ok=True)
    for name, fn in TOKENS.items():
        fn(os.path.join(out_dir, name + ".png"))


if __name__ == "__main__":
    import sys
    render_all(sys.argv[1] if len(sys.argv) > 1 else "../assets/img")
