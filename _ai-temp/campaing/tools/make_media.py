"""Процедурная генерация медиа кампании (ImageMagick): портреты НПС, бойцы, фоны меню и концовок.

Всё рисуется с нуля этим скриптом: сторонние материалы не используются,
права не нарушаются. Палитра — «тёмное техно-фэнтези»: чугун, латунь, пепел.
"""
import os
import subprocess

OUT = "/home/user/campaign-1/tools/media"

COAL = "#14100d"
BRASS = "#b08a3e"
BRASS_D = "#7c5f27"
COPPER = "#8a4a2a"
ASH = "#cfc4b0"
COLD = "#5f6f8a"
EMBER = "#a33c1e"

FONTS = "DejaVu-Sans"
FONTSB = "DejaVu-Sans-Bold"


def run(*args):
    cmd = ["convert"] + list(args)
    r = subprocess.run(cmd, capture_output=True, text=True)
    if r.returncode != 0:
        raise RuntimeError(" ".join(cmd) + "\n" + r.stderr)


def gear_path(cx, cy, r, teeth=12, depth=0.22):
    """SVG-like path для шестерни через polygon-точки."""
    import math
    pts = []
    for i in range(teeth * 4):
        a = 2 * math.pi * i / (teeth * 4)
        rr = r * (1 + depth if (i % 4 in (0, 1)) else 1 - depth * 0.35)
        pts.append((cx + rr * math.cos(a), cy + rr * math.sin(a)))
    return pts


def pts_arg(pts):
    return " ".join("%.1f,%.1f" % p for p in pts)


# ------------------------------------------------------------------ портреты НПС

NPC_STYLE = {
    "pepel": dict(tint="#4a5560", accent=BRASS, hat="helmet", gear=False),
    "sera": dict(tint="#3d4436", accent="#c9b47a", hat="hood", gear=False),
    "gvozd": dict(tint="#5a4632", accent=BRASS, hat="cap", gear=True),
    "marla": dict(tint="#6b3a34", accent="#d8b06a", hat="kerchief", gear=False),
    "kir": dict(tint="#33383e", accent="#8fa3ad", hat="hood", gear=False),
    "veksel": dict(tint="#4a4030", accent="#c8a54e", hat=None, gear=True),
    "gnat": dict(tint="#3f4a44", accent="#9bb0a0", hat="cap", gear=False),
    "klepa": dict(tint="#4a3b46", accent="#c0a1b8", hat="kerchief", gear=False),
    "ryab": dict(tint="#39322a", accent="#b8a173", hat="hood", gear=False),
    "tisha": dict(tint="#3a4642", accent="#7fa39a", hat="cap", gear=True),
    "mey": dict(tint="#4a4a56", accent="#aab6c8", hat="kerchief", gear=False),
    "barnaba": dict(tint="#552b22", accent=EMBER, hat=None, gear=False),
    "klein": dict(tint="#3b3a42", accent="#9fb0c0", hat="goggles", gear=True),
    "ironmother": dict(tint="#3a3630", accent=BRASS_D, hat="boiler", gear=True),
}

# бойцы: описываются отдельно
FIGHTERS = {
    "zavodnoy": dict(mode="topdown", tint="#4a4a52", accent=BRASS),
    "strazh": dict(mode="topdown", tint="#3f4a56", accent="#7d8f9e"),
    "beast": dict(mode="side", tint="#41372f", accent=EMBER),
}


def portrait(name, style, path):
    t = style["tint"]
    a = style["accent"]
    hat = style["hat"]
    d = []
    CX, CY, R = 256.0, 330.0, 232.0
    # --- латунная тарелка
    d.append("fill '#0c0a08' circle %d,%d %d,%d" % (CX, CY, CX, CY - R))
    d.append("fill 'rgba(120,100,60,0.10)' circle %d,%d %d,%d" % (CX, CY + 20, CX, CY + 20 - R))
    d.append("fill none stroke '%s' stroke-width 16 circle %d,%d %d,%d" % (BRASS_D, CX, CY, CX, CY - R))
    d.append("fill none stroke '%s' stroke-width 5 circle %d,%d %d,%d" % (BRASS, CX, CY, CX, CY - R + 12))
    import math
    for i in range(12):
        ang = 2 * math.pi * i / 12
        d.append("fill '%s' circle %.0f,%.0f %.0f,%.0f" % (
            COPPER, CX + (R - 30) * math.cos(ang), CY + (R - 30) * math.sin(ang),
            CX + (R - 30) * math.cos(ang), CY + (R - 30) * math.sin(ang) - 7))
    # --- фон за головой под головной убор
    if hat == "hood":
        d.append("fill '%s' ellipse 256,296 76,90 0,360" % a)
        d.append("fill '%s' roundrectangle 186,340 326,420 40,40" % a)
    elif hat == "kerchief":
        d.append("fill '%s' ellipse 256,296 74,88 0,360" % a)
        d.append("fill '%s' path 'M 172,360 L 340,360 L 356,446 L 156,446 Z'" % a)
    # --- плечи и корпус
    d.append("fill '%s' roundrectangle 128,452 384,648 64,64" % t)
    d.append("fill 'rgba(0,0,0,0.22)' roundrectangle 128,566 384,648 46,46")
    d.append("fill '%s' roundrectangle 214,410 298,472 30,30" % t)      # воротник
    d.append("fill '%s' roundrectangle 234,356 278,430 20,20" % t)      # шея
    # --- голова
    d.append("fill '%s' ellipse 256,296 62,74 0,360" % t)
    d.append("fill 'rgba(230,215,185,0.10)' ellipse 234,270 40,44 0,360")
    # --- черты: тёмная полоса и искры глаз
    d.append("fill 'rgba(0,0,0,0.40)' roundrectangle 200,290 312,322 15,15")
    d.append("fill '%s' circle 234,305 234,298" % a)
    d.append("fill '%s' circle 278,305 278,298" % a)
    d.append("fill 'rgba(0,0,0,0.30)' path 'M 210,336 Q 256,352 302,336'")
    if hat == "helmet":
        d.append("fill '%s' path 'M 180,272 A 82,82 0 0 1 332,272 L 332,296 L 180,296 Z'" % t)
        d.append("fill '%s' roundrectangle 174,292 338,314 10,10" % a)
    elif hat == "hood":
        d.append("fill 'rgba(0,0,0,0.30)' path 'M 196,300 A 62,62 0 0 1 316,300 L 316,318 L 196,318 Z'")
        d.append("fill '%s' path 'M 178,286 A 80,80 0 0 1 334,286 L 334,300 L 178,300 Z'" % a)
    elif hat == "cap":
        d.append("fill '%s' path 'M 186,258 A 76,76 0 0 1 326,258 L 326,276 L 186,276 Z'" % a)
        d.append("fill '%s' roundrectangle 180,266 332,288 8,8" % t)
        d.append("fill '%s' roundrectangle 318,266 374,282 8,8" % a)
    elif hat == "kerchief":
        d.append("fill '%s' path 'M 186,270 A 76,76 0 0 1 326,270 L 326,292 L 186,292 Z'" % a)
        d.append("fill '%s' roundrectangle 186,286 326,302 8,8" % a)
        d.append("fill '%s' roundrectangle 330,302 358,368 10,10" % a)
    elif hat == "goggles":
        d.append("fill '%s' roundrectangle 188,268 324,326 16,16" % t)
        d.append("fill '%s' circle 230,300 230,272" % a)
        d.append("fill '%s' circle 282,300 282,272" % a)
        d.append("fill 'rgba(18,26,34,0.65)' circle 230,302 230,282")
        d.append("fill 'rgba(18,26,34,0.65)' circle 282,302 282,282")
        d.append("fill '%s' roundrectangle 224,296 288,308 6,6" % t)
        d.append("fill '%s' roundrectangle 300,286 340,300 6,6" % a)
    elif hat == "boiler":
        d.append("fill '%s' roundrectangle 186,196 326,290 20,20" % t)
        d.append("fill '%s' roundrectangle 204,172 308,200 12,12" % a)
        d.append("fill '%s' roundrectangle 222,146 290,176 8,8" % t)
        for i in range(3):
            d.append("fill '%s' circle %d,250 %d,240" % (a, 214 + i * 42, 214 + i * 42))
        d.append("fill 'rgba(0,0,0,0.30)' roundrectangle 206,322 306,338 6,6")
    # --- аксессуар
    if style["gear"]:
        pts = pts_arg(gear_path(378, 470, 46, 10, 0.24))
        d.append("fill '%s' stroke '%s' stroke-width 3 polygon %s" % (BRASS_D, COAL, pts))
        d.append("fill %s circle 378,470 378,460" % COAL)
    else:
        pts = pts_arg(gear_path(136, 486, 30, 8, 0.22))
        d.append("fill 'rgba(140,110,60,0.55)' polygon %s" % pts)
    run("-size", "512x660", "xc:none",
        "-draw", " ".join(d),
        "-blur", "0x0.4",
        str(path))
    return path


def fighter(name, style, path):
    t = style["tint"]
    a = style["accent"]
    if style["mode"] == "topdown":
        draw = [
            "fill '%s' circle 128,128 128,54" % t,
            "fill '%s' roundrectangle 84,108 172,196 14,14" % t,
            "fill %s roundrectangle 118,40 138,96 8,8" % a,
            "fill %s roundrectangle 60,120 84,190 10,10" % a,
            "fill %s roundrectangle 172,120 196,190 10,10" % a,
            "fill '%s' circle 128,128 128,96" % COAL,
            "fill %s circle 128,128 128,110" % a,
        ]
    else:
        draw = [
            "fill '%s' ellipse 128,150 96,52 0,360" % t,
            "fill '%s' ellipse 52,128 26,26 0,360" % t,
            "fill %s circle 44,118 44,110" % a,
            "fill %s circle 62,128 62,121" % a,
            "fill '%s' roundrectangle 96,182 110,232 6,6" % t,
            "fill '%s' roundrectangle 146,182 160,232 6,6" % t,
            "fill '%s' roundrectangle 168,150 226,168 8,8" % t,
            "fill %s polygon 226,140 256,158 226,176" % a,
        ]
    run("-size", "256x256", "xc:none", "-draw", " ".join(draw), "-blur", "0x0.4", str(path))
    return path


# ------------------------------------------------------------------ фоны

def skyline(draw, base_y=560, seed=1):
    """Город-котёл: домны, трубы, дым."""
    import random
    rnd = random.Random(seed)
    x = -20
    while x < 1700:
        w = rnd.choice([70, 90, 120, 150])
        h = rnd.choice([120, 180, 240, 320, 400])
        draw.append("fill '#181410' rectangle %d,%d %d,%d" % (x, base_y - h, x + w, base_y + 40))
        draw.append("fill '#221c15' rectangle %d,%d %d,%d" % (x + 8, base_y - h + 12, x + w - 8, base_y + 40))
        if rnd.random() < 0.6:
            chx = x + w // 2
            ch = rnd.choice([60, 110, 170])
            draw.append("fill '#141110' rectangle %d,%d %d,%d" % (chx - 12, base_y - h - ch, chx + 12, base_y - h + 10))
        for i in range(rnd.randint(2, 6)):
            wx = x + 16 + i * 22
            if wx < x + w - 12:
                draw.append("fill 'rgba(200,150,60,0.65)' rectangle %d,%d %d,%d" % (wx, base_y - h + 40, wx + 8, base_y - h + 56))
        x += w + rnd.choice([10, 24, 40])


def smoke(draw, seed=2):
    import random
    rnd = random.Random(seed)
    for i in range(26):
        cx = rnd.randint(0, 1600)
        cy = rnd.randint(120, 520)
        r = rnd.randint(60, 220)
        op = rnd.choice(["0.05", "0.07", "0.09", "0.12"])
        draw.append("fill 'rgba(190,180,160,%s)' circle %d,%d %d,%d" % (op, cx, cy, cx, cy - r))


def menu_background(path):
    draw = ["fill '#0d0b09' rectangle 0,0 1600,900"]
    smoke(draw, 3)
    skyline(draw, 620, 5)
    draw.append("fill 'rgba(163,60,30,0.16)' circle 1180,640 1180,470")
    draw.append("fill 'rgba(240,170,80,0.10)' circle 1180,640 1180,560")
    draw.append("fill 'rgba(30,24,18,0.55)' rectangle 0,760 1600,900")
    pts = pts_arg(gear_path(1290, 250, 170, 16, 0.18))
    draw.append("fill 'rgba(120,95,45,0.18)' stroke 'rgba(190,150,70,0.25)' stroke-width 4 polygon %s" % pts)
    run("-size", "1600x900", "xc:black", "-draw", " ".join(draw), "-blur", "0x1.2",
        "-fill", "rgba(10,9,8,0.25)", "-colorize", "20",
        str(path))
    return path


def title_art(path):
    """Эмблема без букв: шестерня, охваченная трубами."""
    draw = []
    draw.append("fill none stroke %s stroke-width 14 circle 450,130 450,20" % BRASS_D)
    for (cx, cy, r) in ((450, 130, 96), (250, 96, 52), (652, 168, 60)):
        pts = pts_arg(gear_path(cx, cy, r, 14, 0.2))
        draw.append("fill %s stroke %s stroke-width 3 polygon %s" % (BRASS, COAL, pts))
        draw.append("fill %s circle %d,%d %d,%d" % (COAL, cx, cy, cx, cy - int(r * 0.34)))
    draw.append("fill %s roundrectangle 300,150 600,214 14,14" % COPPER)
    for i in range(6):
        draw.append("fill %s circle %d,182 %d,172" % (BRASS_D, 330 + i * 50, 330 + i * 50))
    run("-size", "900x260", "xc:none", "-draw", " ".join(draw), "-blur", "0x0.5", str(path))
    return path


ENDINGS = {
    "end.jpg": dict(mood="город", seed=11),
    "end_peace.jpg": dict(mood="мир", seed=12),
    "end_whisper.jpg": dict(mood="шёпот", seed=13),
    "end_outer.jpg": dict(mood="тракт", seed=14),
    "end_heart.jpg": dict(mood="сердце", seed=15),
    "end_end.jpg": dict(mood="тишина", seed=16),
}


def end_background(path, mood, seed):
    draw = ["fill '#0b0a09' rectangle 0,0 1600,900"]
    if mood == "шёпот":
        smoke(draw, seed)
        draw.append("fill 'rgba(90,110,140,0.10)' rectangle 0,0 1600,900")
        pts = pts_arg(gear_path(800, 430, 300, 20, 0.16))
        draw.append("fill 'rgba(60,70,90,0.35)' stroke 'rgba(150,170,200,0.18)' stroke-width 5 polygon %s" % pts)
        for i in range(9):
            draw.append("fill 'rgba(180,190,210,0.10)' rectangle %d,0 %d,900" % (120 + i * 170, 138 + i * 170))
    elif mood == "сердце":
        draw.append("fill 'rgba(163,60,30,0.20)' circle 800,450 800,120")
        pts = pts_arg(gear_path(800, 450, 260, 18, 0.2))
        draw.append("fill 'rgba(150,100,40,0.55)' stroke '%s' stroke-width 6 polygon %s" % (BRASS, pts))
        draw.append("fill 'rgba(200,60,30,0.55)' circle 800,450 800,150")
        for i in range(10):
            import math
            a = 2 * math.pi * i / 10
            x1 = min(800 + 120 * math.cos(a) - 10, 800 + 300 * math.cos(a) + 10)
            x2 = max(800 + 120 * math.cos(a) - 10, 800 + 300 * math.cos(a) + 10)
            y1 = min(450 + 120 * math.sin(a) - 10, 450 + 300 * math.sin(a) + 10)
            y2 = max(450 + 120 * math.sin(a) - 10, 450 + 300 * math.sin(a) + 10)
            draw.append("fill 'rgba(120,90,40,0.5)' roundrectangle %d,%d %d,%d 8,8" % (x1, y1, x2, y2))
    elif mood == "тракт":
        draw.append("fill '#171310' polygon 0,900 700,380 1600,900")
        draw.append("fill 'rgba(120,150,190,0.10)' rectangle 0,300 1600,560")
        draw.append("fill '#0f0d0b' polygon 0,640 1600,520 1600,900 0,900")
        draw.append("fill 'rgba(220,180,110,0.18)' circle 1180,300 1180,150")
        for i in range(7):
            draw.append("fill '#100e0c' rectangle %d,560 %d,900" % (160 + i * 210, 200 + i * 210))
    elif mood == "мир":
        skyline(draw, 640, seed)
        draw.append("fill 'rgba(200,150,70,0.10)' rectangle 0,0 1600,900")
        smoke(draw, seed + 1)
        draw.append("fill 'rgba(240,190,110,0.16)' circle 320,600 320,430")
    elif mood == "тишина":
        draw.append("fill 'rgba(30,26,22,0.9)' rectangle 0,0 1600,900")
        pts = pts_arg(gear_path(800, 450, 420, 26, 0.1))
        draw.append("fill 'rgba(60,54,46,0.5)' stroke 'rgba(140,120,80,0.2)' stroke-width 6 polygon %s" % pts)
        draw.append("fill '#0b0a09' circle 800,450 800,260")
        draw.append("fill 'rgba(200,180,140,0.06)' circle 800,450 800,180")
    else:
        skyline(draw, 600, seed)
        draw.append("fill 'rgba(20,16,12,0.5)' rectangle 0,700 1600,900")
    run("-size", "1600x900", "xc:black", "-draw", " ".join(draw), "-blur", "0x1.0", str(path))
    return path


def main():
    os.makedirs(os.path.join(OUT, "img", "npc"), exist_ok=True)
    for name, style in NPC_STYLE.items():
        portrait(name, style, os.path.join(OUT, "img", "npc", name + ".png"))
    for name, style in FIGHTERS.items():
        fighter(name, style, os.path.join(OUT, "img", "npc", name + ".png"))
    menu_background(os.path.join(OUT, "img", "menu.jpg"))
    title_art(os.path.join(OUT, "img", "title_art.png"))
    for fn, spec in ENDINGS.items():
        end_background(os.path.join(OUT, "img", fn), spec["mood"], spec["seed"])
    print("media files:", sum(len(f) for _, _, f in os.walk(OUT)))


if __name__ == "__main__":
    main()
