"""Помощники для ArtDoc: примитивы и составные элементы тёмного техно-фэнтези.

Все координаты — холст 1280×720. Каждая функция возвращает СПИСОК слоёв,
чтобы сцены собирались конкатенацией.
"""
import math

W, H = 1280, 720


def _layer(shape, label=None, opacity=None, rotate=None):
    lay = {"shape": shape}
    if label:
        lay["label"] = label
    if opacity is not None:
        lay["opacity"] = opacity
    if rotate is not None:
        lay["rotate"] = rotate
    return lay


def grad(a, b, angle=90):
    return {"gradient": {"from": a, "to": b, "angle": angle}}


def rect(x, y, w, h, fill, label=None, stroke=None, sw=None, radius=None, opacity=None, rotate=None):
    s = {"type": "rect", "x": x, "y": y, "w": w, "h": h, "fill": fill}
    if stroke:
        s["stroke"] = stroke
        s["stroke_width"] = sw or 2
    if radius:
        s["radius"] = radius
    return [_layer(s, label, opacity, rotate)]


def ell(cx, cy, rx, ry, fill, label=None, stroke=None, sw=None, opacity=None):
    s = {"type": "ellipse", "cx": cx, "cy": cy, "rx": rx, "ry": ry, "fill": fill}
    if stroke:
        s["stroke"] = stroke
        s["stroke_width"] = sw or 2
    return [_layer(s, label, opacity)]


def poly(points, fill, label=None, stroke=None, opacity=None):
    s = {"type": "polygon", "points": points, "fill": fill}
    if stroke:
        s["stroke"] = stroke
    return [_layer(s, label, opacity)]


def line(x1, y1, x2, y2, color, width=2, label=None, opacity=None):
    return [_layer({"type": "line", "x1": x1, "y1": y1, "x2": x2, "y2": y2, "color": color, "width": width}, label, opacity)]


def text(x, y, t, size=18, color="#c9b48a", align="middle", bold=False, label=None, opacity=None, italic=False):
    s = {"type": "text", "x": x, "y": y, "text": t, "size": size, "color": color, "align": align}
    if bold:
        s["bold"] = True
    if italic:
        s["italic"] = True
    return [_layer(s, label, opacity)]


# ---------- составные элементы ----------

def sky(top, bottom, h=H, label="небо"):
    return rect(0, 0, W, h, grad(top, bottom, 90), label)


def floor(y, top, bottom, label="пол"):
    return rect(0, y, W, H - y, grad(top, bottom, 90), label)


def fog(y, h, color="#8a9a86", opacity=0.18, label="хмарь"):
    out = []
    out += rect(0, y, W, h, grad(color, "#00000000", 90), label, opacity=opacity)
    for i, cx in enumerate(range(80, W, 260)):
        out += ell(cx + (i % 2) * 70, y + h * 0.4, 220, h * 0.35, color, label + " клуб", opacity=opacity * 0.7)
    return out


def vignette(opacity=0.45):
    return (rect(0, 0, W, 90, grad("#000000", "#00000000", 90), "виньетка верх", opacity=opacity)
            + rect(0, H - 110, W, 110, grad("#00000000", "#000000", 90), "виньетка низ", opacity=opacity))


def brick_wall(x, y, w, h, base, mortar, label="кирпичная стена", rows=None):
    out = rect(x, y, w, h, grad(base, _shade(base, -0.25), 90), label)
    step = 34
    n = rows or int(h // step)
    for i in range(1, n):
        yy = y + i * step
        if yy >= y + h:
            break
        out += line(x, yy, x + w, yy, mortar, 2, label + " шов", opacity=0.55)
        off = 0 if i % 2 else 40
        for xx in range(x + off + 40, x + w, 120):
            out += line(xx, yy - step, xx, yy, mortar, 2, None, opacity=0.35)
    return out


def plank_floor(y, base, label="дощатый пол"):
    out = floor(y, base, _shade(base, -0.4), label)
    for i, yy in enumerate(range(y + 22, H, 30)):
        out += line(0, yy, W, yy, _shade(base, -0.5), 2, None, opacity=0.6)
    return out


def pipe_h(x, y, length, th, color, label="труба", rivets=True):
    out = rect(x, y, length, th, grad(_shade(color, 0.25), _shade(color, -0.35), 90), label, radius=th // 3)
    if rivets:
        for xx in range(x + 30, x + length - 10, 110):
            out += rect(xx, y - 4, 14, th + 8, _shade(color, -0.2), label + " фланец", radius=3)
    return out


def pipe_v(x, y, length, th, color, label="труба", rivets=True):
    out = rect(x, y, th, length, grad(_shade(color, 0.25), _shade(color, -0.35), 0), label, radius=th // 3)
    if rivets:
        for yy in range(y + 30, y + length - 10, 110):
            out += rect(x - 4, yy, th + 8, 14, _shade(color, -0.2), label + " фланец", radius=3)
    return out


def gear(cx, cy, r, color, teeth=10, label="шестерня", opacity=None):
    out = []
    tw = max(8, r * 0.35)
    for i in range(teeth):
        a = 360 / teeth * i
        rad = math.radians(a)
        tx = cx + math.cos(rad) * (r + tw * 0.25)
        ty = cy + math.sin(rad) * (r + tw * 0.25)
        out += rect(round(tx - tw / 2), round(ty - tw / 2), round(tw), round(tw), _shade(color, -0.1), label + " зуб",
                    rotate=round(a), opacity=opacity)
    out += ell(cx, cy, r, r, color, label, stroke=_shade(color, -0.4), sw=3, opacity=opacity)
    out += ell(cx, cy, r * 0.55, r * 0.55, _shade(color, -0.35), label + " обод", opacity=opacity)
    out += ell(cx, cy, r * 0.18, r * 0.18, _shade(color, 0.3), label + " ось", opacity=opacity)
    return out


def window(x, y, w, h, glow="#e3a24a", frame="#2a2420", label="окно", lit=True, arch=False):
    out = []
    if arch:
        out += ell(x + w / 2, y, w / 2, w / 2, frame, label + " арка")
        out += ell(x + w / 2, y, w / 2 - 6, w / 2 - 6, grad(glow, _shade(glow, -0.5), 90) if lit else "#141820", label + " стекло арки")
    out += rect(x, y, w, h, frame, label + " рама")
    out += rect(x + 6, y + 6, w - 12, h - 12, grad(glow, _shade(glow, -0.5), 90) if lit else grad("#1a2230", "#0c1016"), label + " стекло")
    out += line(x + w / 2, y + 6, x + w / 2, y + h - 6, frame, 4)
    out += line(x + 6, y + h / 2, x + w - 6, y + h / 2, frame, 4)
    if lit:
        out += ell(x + w / 2, y + h / 2, w * 0.9, h * 0.7, glow, label + " свечение", opacity=0.12)
    return out


def lamp(x, y, color="#f0b860", label="фонарь", post=True, post_h=260):
    out = []
    if post:
        out += rect(x - 5, y, 10, post_h, "#1d1a18", label + " столб")
    out += ell(x, y, 70, 70, color, label + " ореол", opacity=0.13)
    out += rect(x - 14, y - 26, 28, 34, "#2a2622", label + " корпус", radius=4)
    out += rect(x - 9, y - 20, 18, 22, color, label + " огонь", radius=3)
    return out


def door(x, y, w, h, color="#3b2a1e", label="дверь", glow=None):
    out = rect(x - 8, y - 8, w + 16, h + 8, "#1a1512", label + " проём")
    out += rect(x, y, w, h, grad(_shade(color, 0.15), _shade(color, -0.35), 0), label, radius=4)
    out += line(x + w / 2, y + 6, x + w / 2, y + h, _shade(color, -0.5), 2)
    out += ell(x + w - 14, y + h * 0.55, 5, 5, "#b08d4a", label + " ручка")
    if glow:
        out += rect(x, y + h - 6, w, 6, glow, label + " полоса света", opacity=0.6)
    return out


def arch_door(x, y, w, h, color="#2a1e18", label="арка"):
    out = ell(x + w / 2, y, w / 2 + 10, w / 2 + 10, "#1a1512", label + " свод")
    out += rect(x - 10, y, w + 20, h, "#1a1512", label + " проём")
    out += ell(x + w / 2, y, w / 2, w / 2, _shade(color, 0.1), label + " створка верх")
    out += rect(x, y, w, h, grad(_shade(color, 0.1), _shade(color, -0.4), 0), label)
    return out


def table(x, y, w, color="#4a3426", label="стол", h=18, legs=70):
    out = rect(x, y, w, h, grad(_shade(color, 0.2), _shade(color, -0.3), 90), label, radius=3)
    out += rect(x + 10, y + h, 12, legs, _shade(color, -0.4), label + " ножка")
    out += rect(x + w - 22, y + h, 12, legs, _shade(color, -0.4), label + " ножка")
    return out


def crate(x, y, s, color="#5a4430", label="ящик"):
    out = rect(x, y, s, s, grad(_shade(color, 0.15), _shade(color, -0.3), 90), label, stroke=_shade(color, -0.5), sw=3)
    out += line(x, y, x + s, y + s, _shade(color, -0.45), 3, None, 0.7)
    out += line(x + s, y, x, y + s, _shade(color, -0.45), 3, None, 0.7)
    return out


def barrel(x, y, w, h, color="#4b3a2a", label="бочка"):
    out = rect(x, y, w, h, grad(_shade(color, 0.2), _shade(color, -0.35), 0), label, radius=w // 4)
    out += rect(x - 3, y + h * 0.2, w + 6, 8, "#2b2b2b", label + " обруч")
    out += rect(x - 3, y + h * 0.72, w + 6, 8, "#2b2b2b", label + " обруч")
    return out


def steam(x, y, h=140, label="пар", opacity=0.18):
    out = []
    for i in range(4):
        out += ell(x + (i % 2) * 18 - 9, y - i * h / 4, 26 + i * 10, 20 + i * 8, "#d8dccf", label, opacity=opacity * (1 - i * 0.15))
    return out


def chains(x, y, length, color="#2c2a28", label="цепь"):
    out = []
    for yy in range(y, y + length, 18):
        out += ell(x, yy, 5, 9, "#00000000", label, stroke=color, sw=3)
    return out


def skyline(base_y, color, seed=1, label="силуэт города", spires=True):
    pts = [0, base_y]
    x = 0
    k = seed
    while x < W:
        k = (k * 1103515245 + 12345) % 2147483648
        w = 40 + k % 70
        hh = 40 + (k // 7) % 140
        pts += [x, base_y - hh, x + w, base_y - hh]
        if spires and (k // 13) % 5 == 0:
            pts += [x + w, base_y - hh, x + w + 12, base_y - hh - 70, x + w + 24, base_y - hh]
            w += 24
        x += w
    pts += [W, base_y]
    return poly(pts, color, label)


def chimneys(xs, base_y, color="#1c1a19", smoke=True, label="трубы"):
    out = []
    for i, x in enumerate(xs):
        hh = 140 + (i * 47) % 90
        out += rect(x, base_y - hh, 26, hh, color, label)
        out += rect(x - 4, base_y - hh, 34, 10, _shade(color, 0.2), label + " оголовок")
        if smoke:
            out += steam(x + 13, base_y - hh - 20, 120, label + " дым", 0.22)
    return out


def rail(y, label="рельсы"):
    out = rect(0, y, W, 10, "#3a3632", label)
    out += rect(0, y + 34, W, 10, "#3a3632", label)
    for x in range(10, W, 46):
        out += rect(x, y - 4, 22, 52, "#2a211b", label + " шпала", opacity=0.9)
    return out


def bookshelf(x, y, w, h, label="стеллаж"):
    out = rect(x, y, w, h, grad("#3a2a1e", "#20160f", 0), label, stroke="#160f0a", sw=4)
    colors = ["#6b2a22", "#2f4a3a", "#3f3a5a", "#7a5a2a", "#4a2a3a", "#5a5a4a"]
    shelf_h = 56
    for row, yy in enumerate(range(y + 10, y + h - shelf_h + 10, shelf_h)):
        xx = x + 10
        i = row
        while xx < x + w - 20:
            bw = 10 + (i * 7) % 12
            bh = 36 + (i * 5) % 14
            out += rect(xx, yy + shelf_h - 10 - bh, bw, bh, colors[i % len(colors)], label + " книга")
            xx += bw + 2
            i += 1
        out += rect(x + 4, yy + shelf_h - 10, w - 8, 6, "#1a120c", label + " полка")
    return out


def stained_glass(cx, top, w, h, label="витраж"):
    out = ell(cx, top + w / 2, w / 2, w / 2, "#1a1414", label + " свод")
    out += rect(cx - w / 2, top + w / 2, w, h - w / 2, "#1a1414", label + " рама")
    cols = ["#8a2a2a", "#c08a2a", "#2a4a8a", "#3a7a5a", "#7a3a7a"]
    for i in range(5):
        out += rect(cx - w / 2 + 8 + i * (w - 16) / 5, top + w / 2, (w - 16) / 5 - 3, h - w / 2 - 8, cols[i], label + " стекло", opacity=0.75)
    out += gear(cx, top + w / 2, w * 0.28, "#c9a24a", 12, label + " шестерня", opacity=0.85)
    out += ell(cx, top + h / 2, w, h * 0.6, "#e0b060", label + " свет", opacity=0.08)
    return out


def _shade(hexcolor, k):
    """k>0 — светлее, k<0 — темнее."""
    h = hexcolor.lstrip("#")
    if len(h) == 3:
        h = "".join(c * 2 for c in h)
    if len(h) == 8:
        h = h[:6]
    r, g, b = int(h[0:2], 16), int(h[2:4], 16), int(h[4:6], 16)
    if k >= 0:
        r, g, b = [round(c + (255 - c) * k) for c in (r, g, b)]
    else:
        r, g, b = [round(c * (1 + k)) for c in (r, g, b)]
    return "#%02x%02x%02x" % (r, g, b)


shade = _shade


def doc(background, layers):
    return {"canvas": {"w": W, "h": H}, "background": background, "layers": layers}
