"""Процедурные ArtDoc-фоны для кампании «Каркас: Медное сердце».

Холст сцены — 1280x720. Слоты и зоны переходов ставятся по тем же координатам,
поэтому каждый построитель возвращает и картинку, и «якоря» (anchor) для слотов.
"""

W, H = 1280, 720


def L(shape, label=None, opacity=None, rotate=None):
    layer = {"shape": shape}
    if label:
        layer["label"] = label
    if opacity is not None:
        layer["opacity"] = opacity
    if rotate is not None:
        layer["rotate"] = rotate
    return layer


def rect(x, y, w, h, fill, stroke=None, radius=None, opacity=None, stroke_width=None,
         rotate=None, label=None):
    s = {"type": "rect", "x": x, "y": y, "w": w, "h": h, "fill": fill}
    if stroke:
        s["stroke"] = stroke
        s["stroke_width"] = stroke_width or 2
    if radius is not None:
        s["radius"] = radius
    return L(s, label=label, opacity=opacity, rotate=rotate)


def ellipse(cx, cy, rx, ry, fill, opacity=None, stroke=None, label=None, rotate=None):
    s = {"type": "ellipse", "cx": cx, "cy": cy, "rx": rx, "ry": ry, "fill": fill}
    if stroke:
        s["stroke"] = stroke
        s["stroke_width"] = 2
    return L(s, label=label, opacity=opacity, rotate=rotate)


def poly(points, fill, opacity=None, stroke=None, label=None, rotate=None):
    s = {"type": "polygon", "points": points, "fill": fill}
    if stroke:
        s["stroke"] = stroke
        s["stroke_width"] = 2
    return L(s, label=label, opacity=opacity, rotate=rotate)


def line(x1, y1, x2, y2, color, width=2, opacity=None, label=None):
    s = {"type": "line", "x1": x1, "y1": y1, "x2": x2, "y2": y2, "color": color,
         "width": width}
    return L(s, label=label, opacity=opacity)


def text(x, y, t, size=28, color="#c8b89a", align="middle", bold=False, opacity=None,
         label=None):
    s = {"type": "text", "x": x, "y": y, "text": t, "size": size, "color": color,
         "align": align, "bold": bold}
    return L(s, label=label, opacity=opacity)


def grad(frm, to, angle=90):
    return {"gradient": {"from": frm, "to": to, "angle": angle}}


# ---------------------------------------------------------------- палитры

PAL = {
    "watch": {"bg": "#161a20", "wall": "#232a33", "wall2": "#1b2027", "floor": "#2c241c",
              "dark": "#0d1014", "accent": "#c08a3e", "light": "#ffd9a0", "metal": "#3a4149"},
    "copper": {"bg": "#1b1512", "wall": "#2a2018", "wall2": "#201812", "floor": "#33261c",
               "dark": "#100c09", "accent": "#d08a44", "light": "#ffcf8c", "metal": "#4a3a2a"},
    "pipes": {"bg": "#101418", "wall": "#1c232a", "wall2": "#151a20", "floor": "#232a2c",
              "dark": "#080b0d", "accent": "#7fb0a8", "light": "#bfe6dd", "metal": "#37434a"},
    "foundry": {"bg": "#1a100c", "wall": "#2b1a12", "wall2": "#20130d", "floor": "#3a2418",
                "dark": "#0d0705", "accent": "#ff7a2e", "light": "#ffc46b", "metal": "#4d3524"},
    "ash": {"bg": "#191719", "wall": "#26222a", "wall2": "#1d1a1f", "floor": "#2e2a2c",
            "dark": "#0e0d0f", "accent": "#8d7f6a", "light": "#d8cdb8", "metal": "#3d3740"},
    "water": {"bg": "#0d1418", "wall": "#16232a", "wall2": "#101a20", "floor": "#1b2b31",
              "dark": "#060b0e", "accent": "#4fa3b8", "light": "#a8e3f0", "metal": "#2c4048"},
    "shaft": {"bg": "#0f0d10", "wall": "#1e1a20", "wall2": "#171320", "floor": "#241d24",
              "dark": "#07060a", "accent": "#b06fd0", "light": "#e6c2ff", "metal": "#3a3040"},
    "core": {"bg": "#120e14", "wall": "#231a28", "wall2": "#1a1220", "floor": "#2a2030",
             "dark": "#08060c", "accent": "#ff5f7a", "light": "#ffb9c9", "metal": "#463250"},
}


# ---------------------------------------------------------------- детали

def _lamp(pal, cx, cy, r=90, intensity=0.30, label=None):
    """Подвесная лампа: цепь, колпак, световое пятно."""
    out = []
    out.append(line(cx, 0, cx, cy - 26, pal["metal"], width=3, opacity=0.8))
    out.append(poly([cx - 26, cy - 24, cx + 26, cy - 24, cx + 14, cy + 4, cx - 14, cy + 4],
                    pal["metal"], label=label or "лампа"))
    out.append(ellipse(cx, cy + 8, 12, 8, pal["light"], opacity=0.95))
    out.append(ellipse(cx, cy + 40, r, int(r * 0.62), pal["light"], opacity=intensity))
    out.append(ellipse(cx, cy + 40, int(r * 0.45), int(r * 0.28), pal["light"],
                       opacity=min(0.9, intensity + 0.25)))
    return out


def _pipes_row(pal, y, x0=0, x1=W, count=4, thick=22, opacity=0.9, color=None):
    out = []
    c = color or pal["metal"]
    step = (x1 - x0) / max(1, count)
    for i in range(count):
        yy = y + (i % 2) * (thick + 6)
        out.append(rect(x0, yy, x1 - x0, thick, c, radius=8, opacity=opacity,
                        label="труба"))
        for k in range(int(x0) + 60, int(x1), 260):
            out.append(rect(k, yy - 3, 14, thick + 6, pal["wall2"], radius=3, opacity=0.85))
    return out


def _grime(pal, seed=1, count=14, alpha=0.10):
    """Пятна копоти по стенам — чтобы плоскости не выглядели плашкой."""
    out = []
    xs = [40, 150, 260, 380, 500, 620, 740, 860, 980, 1100, 1200, 90, 430, 700]
    ys = [120, 200, 260, 150, 320, 210, 280, 170, 240, 300, 190, 350, 90, 330]
    for i in range(count):
        x = (xs[i % len(xs)] + seed * 37 * (i + 1)) % (W - 120) + 40
        y = (ys[i % len(ys)] + seed * 19 * (i + 1)) % 380 + 60
        r = 40 + ((i * 17 + seed * 11) % 90)
        out.append(ellipse(x, y, r, r * 0.55, pal["dark"], opacity=alpha))
    return out


# ---------------------------------------------------------------- построители

def interior(pal, props=(), lamps=((320, 150), (960, 150)), floor_y=470,
             ceiling_pipes=True, window=None, background=None):
    """Интерьер: стена, пол перспективой, балки, лампы, реквизит."""
    layers = []
    layers.append(rect(0, 0, W, H, background or pal["wall"], label="стена"))
    layers += _grime(pal, seed=3)
    # потолок и балки
    layers.append(rect(0, 0, W, 90, pal["dark"], opacity=0.85, label="потолок"))
    for x in (120, 520, 920):
        layers.append(rect(x, 60, 60, 26, pal["metal"], radius=6, opacity=0.8))
    if ceiling_pipes:
        layers += _pipes_row(pal, 12, 0, W, count=2, thick=18, opacity=0.75)
    # панели-выступы на стенах
    layers.append(rect(0, 150, 150, 330, pal["wall2"], radius=8, opacity=0.7))
    layers.append(rect(W - 150, 150, 150, 330, pal["wall2"], radius=8, opacity=0.7))
    # пол
    layers.append(poly([0, floor_y, W, floor_y, W, H, 0, H], pal["floor"], label="пол"))
    layers.append(poly([0, floor_y, W, floor_y, W, floor_y + 26, 0, floor_y + 26],
                       pal["dark"], opacity=0.35))
    for i in range(1, 7):
        x = int(W / 7 * i)
        layers.append(line(x, floor_y, int(W / 2 + (x - W / 2) * 1.6), H, pal["dark"], 2,
                           opacity=0.25))
    if window:
        wx, wy, ww, wh = window
        layers.append(rect(wx, wy, ww, wh, grad(pal["bg"], pal["dark"], 90),
                           stroke=pal["metal"], label="окно"))
        layers.append(line(wx + ww // 2, wy, wx + ww // 2, wy + wh, pal["metal"], 3))
    for lx, ly in lamps:
        layers += _lamp(pal, lx, ly)
    layers += list(props)
    return {"canvas": {"w": W, "h": H}, "background": pal["bg"], "layers": layers}


def street(pal, stalls=True, rain=False, chimneys=True, crowd=True, sign=None,
          background=None):
    """Улица/рынок: небо, силуэты, фонари, лотки."""
    layers = []
    layers.append(rect(0, 0, W, 430, grad(background or pal["bg"], pal["wall2"], 90),
                       label="небо"))
    layers.append(ellipse(240, 150, 200, 120, pal["accent"], opacity=0.10))
    # дальние корпуса
    layers.append(poly([0, 430, 0, 180, 120, 150, 240, 210, 240, 430], pal["wall2"]))
    layers.append(poly([240, 430, 240, 230, 380, 190, 470, 260, 470, 430], pal["wall"]))
    layers.append(poly([980, 430, 980, 170, 1080, 140, 1200, 200, 1200, 430], pal["wall2"]))
    layers.append(poly([760, 430, 760, 250, 880, 210, 980, 280, 980, 430], pal["wall"]))
    # окна
    for x in range(60, 460, 60):
        layers.append(rect(x, 260 + (x % 3) * 20, 18, 24, pal["light"], opacity=0.25))
    for x in range(800, 1180, 70):
        layers.append(rect(x, 250 + (x % 4) * 18, 16, 22, pal["accent"], opacity=0.30))
    if chimneys:
        for x, h in ((160, 150), (700, 190), (1040, 130)):
            layers.append(rect(x, 430 - h, 34, h, pal["dark"], label="труба"))
            layers.append(ellipse(x + 17, 430 - h - 40, 60, 36, pal["wall2"], opacity=0.45))
            layers.append(ellipse(x + 17, 430 - h - 90, 90, 54, pal["wall2"], opacity=0.22))
    # мостовая
    layers.append(poly([0, 430, W, 430, W, H, 0, H], pal["floor"], label="мостовая"))
    for i in range(6):
        y = 470 + i * 40
        layers.append(line(0, y, W, y + 6, pal["dark"], 2, opacity=0.18))
    # лотки
    if stalls:
        for x, w in ((120, 220), (430, 180), (900, 240)):
            layers.append(rect(x, 430, w, 26, pal["metal"], radius=4, label="прилавок"))
            layers.append(poly([x, 430, x + w, 430, x + w - 26, 380, x + 26, 380],
                               pal["accent"], opacity=0.35))
            layers.append(rect(x + 10, 456, w - 20, 90, pal["wall2"], opacity=0.9))
            layers.append(line(x + 20, 430, x + 20, 546, pal["dark"], 3, opacity=0.5))
            layers.append(line(x + w - 20, 430, x + w - 20, 546, pal["dark"], 3, opacity=0.5))
    # фонари
    for lx in (300, 660, 1020):
        layers.append(rect(lx - 5, 300, 10, 220, pal["metal"], label="столб"))
        layers.append(ellipse(lx, 300, 26, 30, pal["light"], opacity=0.85))
        layers.append(ellipse(lx, 380, 110, 70, pal["light"], opacity=0.16))
    if crowd:
        for x, s in ((560, 1.0), (600, 0.9), (520, 0.85), (1180, 1.0)):
            layers.append(ellipse(x, 470, 22 * s, 26 * s, pal["dark"], opacity=0.7))
            layers.append(ellipse(x, 420, 16 * s, 20 * s, pal["dark"], opacity=0.8))
    if sign:
        layers.append(text(sign[0], sign[1], sign[2], size=sign[3] if len(sign) > 3 else 34,
                           color=pal["light"], opacity=0.75))
    if rain:
        for i in range(60):
            x = (i * 97) % W
            y = (i * 53) % H
            layers.append(line(x, y, x - 6, y + 26, pal["light"], 1, opacity=0.12))
    return {"canvas": {"w": W, "h": H}, "background": pal["bg"], "layers": layers}


def tunnel(pal, props=(), puddle=True, grating=True, glow_color=None, ceiling=140):
    """Труба/коридор нижних ярусов: арка, трубы, лужи."""
    layers = []
    layers.append(rect(0, 0, W, H, pal["bg"], label="мрак"))
    layers.append(poly([0, 0, W, 0, W, ceiling, W - 120, ceiling + 60, 120, ceiling + 60, 0, ceiling],
                       pal["wall"], label="свод"))
    layers.append(poly([0, H, W, H, W, 560, W - 150, 500, 150, 500, 0, 560],
                       pal["floor"], label="дно"))
    layers.append(poly([0, ceiling, W, ceiling, W - 120, ceiling + 60, 120, ceiling + 60, 0, ceiling],
                       pal["dark"], opacity=0.25))
    layers += _grime(pal, seed=5, count=10, alpha=0.14)
    layers += _pipes_row(pal, 30, 100, W - 100, count=3, thick=20, opacity=0.85)
    layers += _pipes_row(pal, 470, 0, 220, count=2, thick=14, opacity=0.7)
    layers += _pipes_row(pal, 470, W - 220, W, count=2, thick=14, opacity=0.7)
    # боковые рёбра
    for x in (150, 430, 850, 1130):
        layers.append(rect(x, ceiling + 40, 22, 330, pal["metal"], opacity=0.55, radius=4))
    g = glow_color or pal["accent"]
    layers.append(ellipse(640, 300, 200, 140, g, opacity=0.12))
    layers.append(ellipse(640, 600, 320, 70, pal["light"], opacity=0.06))
    if puddle:
        layers.append(ellipse(700, 620, 180, 34, pal["accent"], opacity=0.16))
        layers.append(ellipse(700, 620, 120, 20, pal["light"], opacity=0.10))
    if grating:
        layers.append(rect(560, 556, 170, 70, pal["dark"], stroke=pal["metal"], radius=4,
                           label="решётка"))
        for i in range(6):
            layers.append(line(566 + i * 28, 558, 566 + i * 28, 624, pal["metal"], 3,
                               opacity=0.8))
    for lx, ly in ((320, 120), (980, 120)):
        layers += _lamp(pal, lx, ly, r=70, intensity=0.18)
    layers += list(props)
    return {"canvas": {"w": W, "h": H}, "background": pal["bg"], "layers": layers}


def furnace_hall(pal, props=(), molten=True):
    """Литейный зал: печь, жар, кран-балка."""
    layers = []
    layers.append(rect(0, 0, W, H, pal["bg"], label="стена"))
    layers += _grime(pal, seed=7, count=12, alpha=0.16)
    layers.append(rect(0, 0, W, 110, pal["dark"], opacity=0.9, label="потолок"))
    layers.append(rect(0, 90, W, 26, pal["metal"], opacity=0.8, label="кран-балка"))
    for x in (240, 700):
        layers.append(rect(x, 116, 12, 90, pal["metal"], opacity=0.7))
        layers.append(rect(x - 30, 206, 72, 20, pal["metal"], radius=4, opacity=0.9))
    # печь
    layers.append(poly([420, 560, 420, 300, 520, 240, 760, 240, 860, 300, 860, 560],
                       pal["wall"], label="печь"))
    layers.append(rect(470, 330, 340, 210, pal["dark"], radius=10, opacity=0.95))
    if molten:
        layers.append(ellipse(640, 470, 150, 60, pal["accent"], opacity=0.55))
        layers.append(ellipse(640, 460, 90, 34, pal["light"], opacity=0.6))
        layers.append(ellipse(640, 420, 260, 120, pal["accent"], opacity=0.18))
    layers.append(rect(600, 240, 80, 70, pal["metal"], radius=6, opacity=0.9,
                       label="вытяжка"))
    layers.append(ellipse(640, 200, 120, 70, pal["wall2"], opacity=0.35))
    # пол
    layers.append(poly([0, 560, W, 560, W, H, 0, H], pal["floor"], label="пол"))
    layers.append(poly([0, 560, W, 560, W, 590, 0, 590], pal["dark"], opacity=0.4))
    # ковши и заготовки
    layers.append(rect(140, 500, 120, 60, pal["metal"], radius=10, opacity=0.85))
    layers.append(rect(1020, 490, 140, 70, pal["metal"], radius=8, opacity=0.85))
    for lx, ly in ((260, 140), (1020, 140)):
        layers += _lamp(pal, lx, ly, r=80, intensity=0.14)
    layers += list(props)
    return {"canvas": {"w": W, "h": H}, "background": pal["bg"], "layers": layers}


def machine_core(pal, rings=True, glow=True, catwalk=True):
    """Зал Сердца: гигантская машина, кольца, катком, свет."""
    layers = []
    layers.append(rect(0, 0, W, H, pal["bg"], label="мрак"))
    layers.append(ellipse(640, 360, 520, 420, pal["wall2"], opacity=0.55))
    if rings:
        for i, (rx, ry, op) in enumerate(((470, 380, 0.9), (400, 320, 0.75), (330, 260, 0.6))):
            layers.append(ellipse(640, 360, rx, ry, pal["metal"], opacity=op,
                                  stroke=pal["accent"], label=f"кольцо {i + 1}"))
    layers.append(ellipse(640, 360, 250, 200, pal["dark"], opacity=0.92, label="жерло"))
    if glow:
        layers.append(ellipse(640, 380, 190, 110, pal["accent"], opacity=0.45))
        layers.append(ellipse(640, 380, 110, 60, pal["light"], opacity=0.5))
        layers.append(ellipse(640, 360, 420, 340, pal["accent"], opacity=0.10))
    # лучи-спицы
    for a in range(0, 360, 30):
        import math
        x = 640 + math.cos(math.radians(a)) * 300
        y = 360 + math.sin(math.radians(a)) * 240
        layers.append(line(640, 360, x, y, pal["metal"], 6, opacity=0.35))
    if catwalk:
        layers.append(rect(0, 560, W, 30, pal["metal"], opacity=0.85, label="мостик"))
        for x in range(40, W, 80):
            layers.append(line(x, 590, x, 660, pal["metal"], 4, opacity=0.5))
        layers.append(rect(0, 660, W, 60, pal["dark"], opacity=0.8))
    layers += _pipes_row(pal, 40, 0, 300, count=2, thick=18, opacity=0.6)
    layers += _pipes_row(pal, 40, W - 300, W, count=2, thick=18, opacity=0.6)
    layers += _grime(pal, seed=11, count=8, alpha=0.12)
    return {"canvas": {"w": W, "h": H}, "background": pal["bg"], "layers": layers}


def ash_yard(pal, props=(), fog=True):
    """Зольная свалка: насыпи, остов техники, туман."""
    layers = []
    layers.append(rect(0, 0, W, 420, grad("#1b1a1c", "#2a2629", 90), label="небо"))
    layers.append(ellipse(1000, 120, 180, 90, "#5a4f42", opacity=0.35))
    layers.append(poly([0, 420, 0, 300, 200, 250, 420, 330, 620, 270, 900, 340, 1280, 290, 1280, 420],
                       pal["wall2"], label="дальние кучи"))
    layers.append(poly([0, 460, W, 460, W, H, 0, H], pal["floor"], label="зола"))
    for i in range(9):
        x = 60 + i * 140
        layers.append(ellipse(x, 500 + (i % 3) * 40, 130 - (i % 4) * 15, 40,
                              pal["wall"], opacity=0.55))
    # остов техники
    layers.append(rect(880, 340, 260, 120, pal["metal"], radius=10, opacity=0.9, label="остов"))
    layers.append(ellipse(920, 470, 40, 40, pal["dark"], opacity=0.9))
    layers.append(ellipse(1090, 470, 40, 40, pal["dark"], opacity=0.9))
    layers.append(rect(920, 300, 120, 50, pal["wall"], radius=6, opacity=0.9))
    layers.append(poly([300, 460, 360, 340, 460, 340, 520, 460], pal["metal"], opacity=0.85))
    layers.append(rect(60, 380, 120, 80, pal["metal"], radius=6, opacity=0.7))
    if fog:
        layers.append(ellipse(400, 470, 420, 120, pal["light"], opacity=0.07))
        layers.append(ellipse(900, 500, 380, 110, pal["light"], opacity=0.06))
    layers += list(props)
    return {"canvas": {"w": W, "h": H}, "background": pal["bg"], "layers": layers}


def water_gallery(pal, props=()):
    """Водяная галерея цистерны: аркады, вода, отражения."""
    layers = []
    layers.append(rect(0, 0, W, H, pal["bg"], label="свод"))
    layers.append(poly([0, 0, W, 0, W, 120, W - 160, 200, 160, 200, 0, 120], pal["wall"]))
    for x in (80, 300, 900, 1120):
        layers.append(rect(x, 200, 60, 300, pal["wall2"], opacity=0.85, label="колонна"))
        layers.append(poly([x - 20, 200, x + 80, 200, x + 60, 170, x, 170], pal["metal"],
                           opacity=0.8))
    layers.append(rect(0, 500, W, 220, pal["floor"], label="вода"))
    layers.append(rect(0, 500, W, 26, pal["light"], opacity=0.10))
    for i in range(12):
        x = (i * 107) % W
        y = 520 + (i * 37) % 160
        layers.append(line(x, y, x + 60, y, pal["light"], 2, opacity=0.10))
    layers.append(ellipse(640, 300, 260, 150, pal["accent"], opacity=0.08))
    layers += _pipes_row(pal, 60, 200, W - 200, count=2, thick=16, opacity=0.7)
    for lx, ly in ((220, 170), (1060, 170)):
        layers += _lamp(pal, lx, ly, r=70, intensity=0.15)
    layers += list(props)
    return {"canvas": {"w": W, "h": H}, "background": pal["bg"], "layers": layers}


def slide(background, layers):
    """Кадр катсцены."""
    return {"canvas": {"w": W, "h": H}, "background": background, "layers": layers}


def map_art():
    """Карта города-завода: вертикальные ярусы."""
    layers = []
    layers.append(rect(0, 0, W, H, "#12151a", label="фон"))
    # ярусы
    bands = [(40, "#2a3038", "Верхний ярус"), (200, "#252a31", "Медный ряд"),
             (360, "#20252b", "Литейный"), (520, "#1b2025", "Нижние трубы")]
    for y, c, name in bands:
        layers.append(rect(60, y, 1160, 130, c, radius=10, opacity=0.95, label=name))
        layers.append(text(80, y + 34, name, size=22, color="#7d8894", align="start"))
    # связи
    for x in (200, 520, 860, 1100):
        layers.append(line(x, 170, x, 200, "#5c6672", 3, opacity=0.7))
        layers.append(line(x, 330, x, 360, "#5c6672", 3, opacity=0.7))
        layers.append(line(x, 490, x, 520, "#5c6672", 3, opacity=0.7))
    # Сердце
    layers.append(ellipse(640, 660, 150, 90, "#3a1f2c", opacity=0.9, label="Сердце"))
    layers.append(ellipse(640, 660, 80, 48, "#a13b52", opacity=0.55))
    layers.append(text(640, 668, "Поддон", size=26, color="#e6b9c4"))
    return {"canvas": {"w": W, "h": H}, "background": "#0d1014", "layers": layers}
