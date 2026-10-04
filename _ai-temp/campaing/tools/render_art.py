"""QA-рендер ArtDoc в PNG через ImageMagick (MVG). Только для проверки глазами.

Рисует состояние сцены (или слайд катсцены) и, при --slots, обводит слоты и
зоны навигации, чтобы мастер увидел, попадают ли предметы на нарисованные объекты.
"""
import json
import os
import subprocess
import sys

import c_scenes  # noqa: F401  (нужен путь tools/ в sys.path)


def color(v):
    if isinstance(v, str):
        return v
    if isinstance(v, dict) and "gradient" in v:
        return v["gradient"]["from"]
    return "#888888"


def esc(s):
    return s.replace("'", " ").replace('"', " ")


def shape_mvg(sh):
    t = sh.get("type")
    fill = color(sh.get("fill", sh.get("color", "#000")))
    op = sh.get("opacity")
    extra = ""
    if op is not None:
        rgba = "rgba(%d,%d,%d,%s)" % (int(fill[1:3], 16), int(fill[3:5], 16), int(fill[5:7], 16), op) if fill.startswith("#") and len(fill) == 7 else fill
        fill = rgba
    if sh.get("stroke"):
        extra = "stroke '%s' stroke-width %s" % (color(sh["stroke"]), sh.get("stroke_width", 2))
    if t == "rect":
        r = sh.get("radius")
        if r and isinstance(r, (int, float)) and r > 3:
            return "fill '%s' %s roundrectangle %s,%s %s,%s %s,%s" % (
                fill, extra, sh["x"], sh["y"], sh["x"] + sh["w"], sh["y"] + sh["h"], r, r)
        return "fill '%s' %s rectangle %s,%s %s,%s" % (
            fill, extra, sh["x"], sh["y"], sh["x"] + sh["w"], sh["y"] + sh["h"])
    if t == "ellipse":
        return "fill '%s' %s ellipse %s,%s %s,%s 0,360" % (
            fill, extra, sh["cx"], sh["cy"], sh["rx"], sh["ry"])
    if t == "polygon":
        pts = sh["points"]
        if isinstance(pts, list) and pts and isinstance(pts[0], (int, float)):
            pts = [[pts[i], pts[i + 1]] for i in range(0, len(pts) - 1, 2)]
        p = " ".join("%s,%s" % (x, y) for x, y in pts)
        return "fill '%s' %s polygon %s" % (fill, extra, p)
    if t == "line":
        return "stroke '%s' stroke-width %s line %s,%s %s,%s" % (
            color(sh.get("color", "#000")), sh.get("width", 2), sh["x1"], sh["y1"], sh["x2"], sh["y2"])
    if t == "text":
        size = sh.get("size", 20)
        weight = "-Bold" if sh.get("bold") else ""
        return ("fill '%s' font DejaVu-Sans%s stroke none text %s,%s '%s'" % (
            color(sh.get("color", "#fff")), weight, sh["x"], sh["y"] + size * 0.8, esc(sh.get("text", ""))))
    return ""


def render(art, out, slots=None, navs=None, scale=1.0):
    canvas = art.get("canvas") or {"w": 1280, "h": 720}
    w, h = canvas["w"], canvas["h"]
    cmds = ["fill '%s' rectangle 0,0 %s,%s" % (art.get("background", "#101010"), w, h)]
    for lay in art.get("layers", []):
        sh = lay.get("shape")
        if isinstance(sh, dict):
            m = shape_mvg(sh)
            if m:
                cmds.append(m)
    ww, hh = int(w * scale), int(h * scale)
    args = ["convert", "-size", "%dx%d" % (ww, hh), "xc:black"]
    if scale != 1.0:
        args += ["-draw", "scale %s,%s" % (scale, scale)]
    args += ["-draw", " ".join(cmds)]
    if slots:
        for sl in slots:
            args += ["-fill", "none", "-stroke", "#ff00ff", "-strokewidth", "3",
                     "-draw", "rectangle %s,%s %s,%s" % (sl["x"], sl["y"], sl["x"] + sl["w"], sl["y"] + sl["h"])]
    if navs:
        for n in navs:
            a = n["area"]
            args += ["-fill", "none", "-stroke", "#00e0ff", "-strokewidth", "3",
                     "-draw", "rectangle %s,%s %s,%s" % (a["x"], a["y"], a["x"] + a["w"], a["y"] + a["h"])]
    args += [out]
    r = subprocess.run(args, capture_output=True, text=True)
    if r.returncode:
        raise RuntimeError(r.stderr[:600])
    return out


if __name__ == "__main__":
    sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
    which = sys.argv[1] if len(sys.argv) > 1 else "scene_passcourt"
    outf = sys.argv[2] if len(sys.argv) > 2 else "/tmp/preview.png"
    if which.startswith("scene_"):
        s = c_scenes.SCENES[which]
        st = s["states"][0]
        render(st["art"], outf, s.get("slots"), s.get("navigation"))
    print(outf)
