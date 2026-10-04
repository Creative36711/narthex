"""Общие помощники генератора кампании «Шёпот в шестернях».

Арт-документы (ArtDoc) рисуются из примитивов: холст 1280x720.
Правило слотов: сначала рисуем объект — потом ставим слот по его координатам.
"""

CANVAS_W = 1280
CANVAS_H = 720


# ---------- примитивы ----------

def grad(color_from, color_to, angle=90):
    return {"gradient": {"from": color_from, "to": color_to, "angle": angle}}


def rect(x, y, w, h, fill, radius=None, opacity=None, rotate=None,
         stroke=None, stroke_width=None):
    s = {"type": "rect", "x": x, "y": y, "w": w, "h": h, "fill": fill}
    if radius is not None:
        s["radius"] = radius
    if opacity is not None:
        s["opacity"] = opacity
    if rotate is not None:
        s["rotate"] = rotate
    if stroke is not None:
        s["stroke"] = stroke
    if stroke_width is not None:
        s["stroke_width"] = stroke_width
    return s


def ell(cx, cy, rx, ry, fill, opacity=None, rotate=None, stroke=None, stroke_width=None):
    s = {"type": "ellipse", "cx": cx, "cy": cy, "rx": rx, "ry": ry, "fill": fill}
    if opacity is not None:
        s["opacity"] = opacity
    if rotate is not None:
        s["rotate"] = rotate
    if stroke is not None:
        s["stroke"] = stroke
    if stroke_width is not None:
        s["stroke_width"] = stroke_width
    return s


def poly(points, fill, opacity=None, rotate=None, stroke=None, stroke_width=None):
    s = {"type": "polygon", "points": points, "fill": fill}
    if opacity is not None:
        s["opacity"] = opacity
    if rotate is not None:
        s["rotate"] = rotate
    if stroke is not None:
        s["stroke"] = stroke
    if stroke_width is not None:
        s["stroke_width"] = stroke_width
    return s


def line(x1, y1, x2, y2, color="#2a2118", width=2, opacity=None):
    s = {"type": "line", "x1": x1, "y1": y1, "x2": x2, "y2": y2,
         "color": color, "width": width}
    if opacity is not None:
        s["opacity"] = opacity
    return s


def text(x, y, txt, size=20, color="#d8cdba", align="start", bold=False,
         italic=False, opacity=None, font=None):
    s = {"type": "text", "x": x, "y": y, "text": txt, "size": size,
         "color": color, "align": align}
    if bold:
        s["bold"] = True
    if italic:
        s["italic"] = True
    if opacity is not None:
        s["opacity"] = opacity
    if font:
        s["font"] = font
    return s


def layer(label, shape, opacity=None, rotate=None):
    if isinstance(shape, dict) and "shape" in shape and "type" not in shape:
        # это уже готовый слой (или группа слоёв), а не примитив
        if opacity is not None:
            shape.setdefault("opacity", opacity)
        if rotate is not None:
            shape.setdefault("rotate", rotate)
        return shape
    if isinstance(shape, (list, tuple)):
        out = []
        for sh in shape:
            r = layer(label, sh, opacity, rotate)
            out.extend(r if isinstance(r, list) else [r])
        return out
    l = {"label": label, "shape": shape}
    if opacity is not None:
        l["opacity"] = opacity
    if rotate is not None:
        l["rotate"] = rotate
    return l


def _flat(items):
    out = []
    for it in items:
        if isinstance(it, (list, tuple)):
            out.extend(_flat(it))
        elif it is not None:
            out.append(it)
    return out


def art(background, *layers, w=CANVAS_W, h=CANVAS_H):
    return {"canvas": {"w": w, "h": h}, "background": background,
            "layers": _flat(layers)}


# ---------- частые детали ----------

def lamp(cx, cy, glow="#ffca7a", r=62, core_r=11):
    """Лампа: пятно света + раскалённая нить."""
    return [
        layer("пятно света", ell(cx, cy, r, r * 0.78, glow, 0.14)),
        layer("свет", ell(cx, cy, r * 0.5, r * 0.4, glow, 0.24)),
        layer("нить лампы", ell(cx, cy, core_r, core_r, "#ffe9b8", 0.9)),
    ]


def boiler(x, y, w, h, body="#4a4137", ribs="#2f2a23", glow=None):
    """Котёл/бак с рёбрами."""
    out = [
        layer("котёл", rect(x, y, w, h, grad(body, "#241f1a", 90), radius=int(w * 0.12))),
        layer("верх котла", ell(x + w / 2, y + 6, w / 2, w * 0.12, "#5b5145")),
    ]
    n = max(3, int(h / 34))
    for i in range(n):
        yy = y + 20 + i * (h - 30) / max(1, n - 1)
        out.append(layer("ребро жёсткости", rect(x + 5, yy, w - 10, 4, ribs, opacity=0.75)))
    if glow:
        out += lamp(x + w / 2, y + h * 0.62, glow=glow, r=w * 0.9)
    return out


def pipe_run(x1, y1, x2, y2, color="#5a5045", width=14, rivets=True):
    out = [layer("труба", line(x1, y1, x2, y2, color, width))]
    if rivets:
        steps = 7
        for i in range(1, steps):
            t = i / steps
            px = x1 + (x2 - x1) * t
            py = y1 + (y2 - y1) * t
            out.append(layer("хомут", ell(px, py, width * 0.42, width * 0.42, "#6d6153", 0.9)))
    return out


def gear(cx, cy, r, color="#7a6a52", teeth=10, opacity=None):
    out = []
    for i in range(teeth):
        ang = i * 360.0 / teeth
        out.append(layer("зуб шестерни", rect(cx - 4, cy - r - 12, 8, 14, color, rotate=ang)))
    out.append(layer("шестерня", ell(cx, cy, r, r, color, opacity=opacity)))
    out.append(layer("втулка", ell(cx, cy, r * 0.28, r * 0.28, "#241f1a")))
    return out


def window(x, y, w, h, glass="#c9a06a", frame="#3b332a"):
    return [
        layer("окно", rect(x, y, w, h, glass, radius=4, opacity=0.85, stroke=frame, stroke_width=5)),
        layer("переплёт", line(x + w / 2, y, x + w / 2, y + h, frame, 4)),
        layer("переплёт", line(x, y + h / 2, x + w, y + h / 2, frame, 4)),
    ]


def crate(x, y, w, h, body="#5b4a33", plank="#3d3122"):
    return [
        layer("ящик", rect(x, y, w, h, grad(body, "#33291c", 90), radius=3)),
        layer("доска", rect(x + 6, y + 6, w - 12, h - 12, plank, opacity=0.35)),
        layer("кант", line(x, y + h * 0.35, x + w, y + h * 0.35, plank, 3)),
    ]


def floor_boards(y_top, y_bottom, color_a="#3b332a", color_b="#332c24", planks=9):
    """Пол в лёгкой перспективе: горизонтальные доски, сходящиеся к горизонту."""
    out = []
    out.append(layer("пол", rect(0, y_top, CANVAS_W, y_bottom - y_top,
                                 grad(color_a, color_b, 90))))
    for i in range(1, planks):
        t = i / planks
        yy = y_top + (y_bottom - y_top) * (t ** 1.6)
        out.append(layer("шов пола", line(0, yy, CANVAS_W, yy, "#221d17", 2, opacity=0.6)))
    for i in range(1, 6):
        xx = CANVAS_W * i / 6
        out.append(layer("шов пола", line(xx - 200, y_top, xx + 200, y_bottom, "#221d17", 2, opacity=0.35)))
    return out


def wall_panels(y_top, y_bottom, base="#4a4038", panel="#3c342c", lamps=None):
    out = [layer("стена", rect(0, y_top, CANVAS_W, y_bottom - y_top,
                               grad("#544940", base, 90)))]
    x = 90
    while x < CANVAS_W - 40:
        out.append(layer("панель", rect(x, y_top + 26, 150, y_bottom - y_top - 52, panel,
                                        radius=4, opacity=0.55)))
        x += 210
    out.append(layer("карниз", rect(0, y_top, CANVAS_W, 16, "#241f1a", opacity=0.8)))
    for l in (lamps or []):
        out += lamp(l[0], l[1])
    return out


def fog_band(y, h, color="#8b8c86", opacity=0.12):
    return layer("дым", rect(0, y, CANVAS_W, h, color, opacity=opacity))


def slot(ident, label, types, x, y, w, h, default_entity=None, condition=None,
         sprite_scale=None, sprite_state=None, use_with=None):
    s = {"id": ident, "label": label, "type": types, "shape": "rect",
         "x": x, "y": y, "w": w, "h": h, "condition": condition}
    if default_entity:
        s["default_entity"] = default_entity
    if sprite_scale is not None:
        s["sprite_scale"] = sprite_scale
    if sprite_state is not None:
        s["sprite_state"] = sprite_state
    if use_with is not None:
        s["use_with"] = use_with
    return s


def nav(label, area, go_to_scene=None, open_map=False, cost_ticks=None, hide_label=None):
    z = {"area": area, "label": label}
    if go_to_scene:
        z["go_to_scene"] = go_to_scene
    if open_map:
        z["open_map"] = True
    if cost_ticks is not None:
        z["cost_ticks"] = cost_ticks
    if hide_label:
        z["hide_label"] = True
    return z


def state(ident, label, art_doc=None, image=None, condition="__null__", camera=None):
    st = {"id": ident, "label": label}
    if art_doc is not None:
        st["art"] = art_doc
    if image is not None:
        st["image"] = image
    st["condition"] = None if condition == "__null__" else condition
    if camera:
        st["camera"] = camera
    return st


def scene(ident, label, location, states, slots=None, navigation=None,
          music=None, ambient=None, chapter=None):
    s = {"id": ident, "label": label, "location": location,
         "canvas": {"w": CANVAS_W, "h": CANVAS_H},
         "states": states, "slots": slots or [], "navigation": navigation or []}
    if music:
        s["music"] = music
    if ambient:
        s["ambient"] = ambient
    if chapter:
        s["chapter"] = chapter
    return s


# ---------- эффекты и условия ----------

def eff_set_flag(flag):
    return {"type": "set_flag", "flag": flag}


def eff_clear_flag(flag):
    return {"type": "clear_flag", "flag": flag}


def eff_msg(text, portrait=None):
    e = {"type": "show_message", "text": text}
    if portrait:
        e["portrait"] = portrait
    return e


def eff_banner(text, preset=None, seconds=None, position=None, accent=None, enter=None):
    e = {"type": "banner", "text": text}
    if preset:
        e["preset"] = preset
    if seconds is not None:
        e["seconds"] = seconds
    if position:
        e["position"] = position
    if accent:
        e["accent"] = accent
    if enter:
        e["enter"] = enter
    return e


def eff_codex(entry):
    return {"type": "unlock_codex", "entry": entry}


def eff_recipe(recipe):
    return {"type": "unlock_recipe", "recipe": recipe}


def eff_quest(quest):
    return {"type": "start_quest", "quest": quest}


def eff_advance(quest, stage):
    return {"type": "advance_quest", "quest": quest, "stage": stage}


def eff_fail(quest):
    return {"type": "fail_quest", "quest": quest}


def eff_journal(quest, key):
    return {"type": "journal_update", "quest": quest, "text_key": key}


def eff_item(item, qty=1):
    return {"type": "add_item", "item": item, "quantity": qty}


def eff_take(item, qty=1):
    return {"type": "remove_item", "item": item, "quantity": qty}


def eff_need(need, delta):
    return {"type": "change_need", "need": need, "delta": delta}


def eff_hp(delta):
    return {"type": "change_hp", "delta": delta}


def eff_sanity(delta):
    return {"type": "change_sanity", "delta": delta}


def eff_fatigue(delta):
    return {"type": "change_fatigue", "delta": delta}


def eff_status(status, duration=None, target="player"):
    e = {"type": "apply_status", "target": target, "status": status}
    if duration is not None:
        e["duration"] = duration
    return e


def eff_unstatus(status, target="player"):
    return {"type": "remove_status", "target": target, "status": status}


def eff_disp(target, delta):
    return {"type": "change_disposition", "target": target, "delta": delta}


def eff_weather(w):
    return {"type": "set_weather", "weather": w}


def eff_time(ticks):
    return {"type": "advance_time", "ticks": ticks}


def eff_fire(rule):
    return {"type": "fire_rule", "rule": rule}


def eff_cutscene(cut):
    return {"type": "play_cutscene", "cutscene": cut}


def eff_teleport(location, scene=None):
    e = {"type": "teleport_player", "location": location}
    if scene:
        e["scene"] = scene
    return e


def eff_reveal(location):
    return {"type": "reveal_location", "location": location}


def eff_combat(enemies, arena, intro=None, on_victory=None, on_defeat=None, allies=None):
    e = {"type": "start_combat", "enemies": enemies, "arena": arena}
    if intro:
        e["intro"] = intro
    if on_victory:
        e["on_victory"] = on_victory
    if on_defeat:
        e["on_defeat"] = on_defeat
    if allies:
        e["allies"] = allies
    return e


def eff_dialogue(entity, knot=None):
    e = {"type": "start_dialogue", "entity": entity}
    if knot:
        e["dialogue_knot"] = knot
    return e


def eff_craft(recipe=None):
    e = {"type": "open_craft"}
    if recipe:
        e["recipe"] = recipe
    return e


def eff_trade(npc):
    return {"type": "open_trade", "npc": npc}


def eff_description(entity, text):
    return {"type": "set_description", "entity": entity, "text": text}


def eff_state(entity, st):
    return {"type": "set_entity_state", "entity": entity, "state": st}


def eff_scene_state(scene_id, st):
    return {"type": "change_scene_state", "scene": scene_id, "state": st}


def cond(kind, **kw):
    c = {"type": kind}
    c.update(kw)
    return c


class C:
    """Короткие конструкторы условий."""

    @staticmethod
    def flag(f):
        return {"type": "flag_set", "flag": f}

    @staticmethod
    def noflag(f):
        return {"type": "flag_not_set", "flag": f}

    @staticmethod
    def enters_location(loc):
        return {"type": "player_enters_location", "location": loc}

    @staticmethod
    def enters_scene(sc):
        return {"type": "player_enters_scene", "scene": sc}

    @staticmethod
    def time(*values):
        return {"type": "time_of_day", "value": list(values)}

    @staticmethod
    def tick(min_tick):
        return {"type": "tick_elapsed", "min_tick": min_tick}

    @staticmethod
    def item(item, min_quantity=None):
        c = {"type": "has_item", "item": item}
        if min_quantity is not None:
            c["min_quantity"] = min_quantity
        return c

    @staticmethod
    def quest(quest, stage):
        return {"type": "quest_at_stage", "quest": quest, "stage": stage}

    @staticmethod
    def weather(w):
        return {"type": "weather_is", "weather": w}

    @staticmethod
    def chance(p):
        return {"type": "random_chance", "probability": p}

    @staticmethod
    def skill(skill, threshold):
        return {"type": "skill_ge", "skill": skill, "threshold": threshold}

    @staticmethod
    def stat(name, threshold):
        return {"type": "stat_ge", "stat": name, "threshold": threshold}

    @staticmethod
    def need_le(need, threshold):
        return {"type": "need_le", "need": need, "threshold": threshold}

    @staticmethod
    def hp_le(threshold):
        return {"type": "hp_le", "threshold": threshold}

    @staticmethod
    def sanity_le(threshold):
        return {"type": "sanity_le", "threshold": threshold}

    @staticmethod
    def status(s):
        return {"type": "has_status", "status": s}

    @staticmethod
    def meta(key, ge):
        return {"type": "meta_counter", "key": key, "ge": ge}

    @staticmethod
    def dead(entity):
        return {"type": "entity_dead", "entity": entity}

    @staticmethod
    def alive(entity):
        return {"type": "entity_alive", "entity": entity}

    @staticmethod
    def disp(target, threshold):
        return {"type": "disposition_ge", "target": target, "threshold": threshold}

    @staticmethod
    def party(entity):
        return {"type": "in_party", "entity": entity}

    @staticmethod
    def var(name, operator, value):
        return {"type": "variable_compare", "var": name, "operator": operator, "value": value}

    @staticmethod
    def ALL(*conds):
        return {"type": "and", "conditions": list(conds)}

    @staticmethod
    def ANY(*conds):
        return {"type": "or", "conditions": list(conds)}

    @staticmethod
    def NOT(c):
        return {"type": "not", "condition": c}
