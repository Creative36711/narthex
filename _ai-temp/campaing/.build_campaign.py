from __future__ import annotations

import json
import shutil
import zipfile
from pathlib import Path

ROOT = Path(__file__).resolve().parent
STAGE = ROOT / ".campaign_build"
OUT = ROOT / "kolokol-bez-imeni.chronicle"
if STAGE.exists():
    shutil.rmtree(STAGE)
STAGE.mkdir(parents=True)


def write_json(rel: str, data: object) -> None:
    path = STAGE / rel
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(data, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")


def write_text(rel: str, data: str) -> None:
    path = STAGE / rel
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(data.strip() + "\n", encoding="utf-8")


def layer(label: str, shape: dict) -> dict:
    return {"label": label, "shape": shape}


def rect(x: int, y: int, w: int, h: int, fill: object, **extra) -> dict:
    return {"type": "rect", "x": x, "y": y, "w": w, "h": h, "fill": fill, **extra}


def ellipse(cx: int, cy: int, rx: int, ry: int, fill: object = None, **extra) -> dict:
    data = {"type": "ellipse", "cx": cx, "cy": cy, "rx": rx, "ry": ry, **extra}
    if fill is not None:
        data["fill"] = fill
    return data


def polygon(points: list[int], fill: object, **extra) -> dict:
    return {"type": "polygon", "points": points, "fill": fill, **extra}


def line(x1: int, y1: int, x2: int, y2: int, color: str, width: int = 2, **extra) -> dict:
    return {"type": "line", "x1": x1, "y1": y1, "x2": x2, "y2": y2, "color": color, "width": width, **extra}


def person_shapes(cx: int, floor_y: int, color: str = "#172128", accent: str = "#9b6648") -> list[dict]:
    return [
        ellipse(cx, floor_y - 275, 35, 40, "#b28b70"),
        polygon([cx - 37, floor_y - 234, cx + 38, floor_y - 234, cx + 62, floor_y - 58, cx - 57, floor_y - 58], color),
        polygon([cx - 55, floor_y - 214, cx - 91, floor_y - 115, cx - 72, floor_y - 104, cx - 29, floor_y - 171], color),
        polygon([cx + 50, floor_y - 214, cx + 93, floor_y - 126, cx + 75, floor_y - 111, cx + 31, floor_y - 175], color),
        line(cx - 23, floor_y - 54, cx - 31, floor_y, color, 17),
        line(cx + 25, floor_y - 54, cx + 32, floor_y, color, 17),
        line(cx - 20, floor_y - 206, cx + 22, floor_y - 206, accent, 5),
    ]


def prop_shapes(kind: str) -> list[dict]:
    if kind == "clock":
        return [
            ellipse(620, 257, 125, 125, "#161d25", stroke="#b18455", stroke_width=10),
            ellipse(620, 257, 93, 93, "#a99678", stroke="#e0c997", stroke_width=3),
            line(620, 180, 620, 196, "#48392f", 5), line(620, 318, 620, 334, "#48392f", 5),
            line(543, 257, 559, 257, "#48392f", 5), line(681, 257, 697, 257, "#48392f", 5),
            line(620, 257, 620, 205, "#352d29", 6), line(620, 257, 666, 276, "#352d29", 5),
            line(615, 261, 720, 404, "#c5a070", 3),
        ]
    if kind == "heater":
        return [rect(195, 410, 250, 165, "#293038", stroke="#aa7447", stroke_width=6, radius=18),
                rect(220, 433, 200, 110, {"gradient": {"from": "#5b2d27", "to": "#d17b42", "angle": 90}}, radius=15),
                line(245, 458, 397, 458, "#f0a65d", 5), line(245, 495, 397, 495, "#f0a65d", 5)]
    if kind == "shelves":
        return [rect(230, 145, 132, 376, "#30251f", stroke="#8c6642", stroke_width=5),
                rect(392, 145, 132, 376, "#30251f", stroke="#8c6642", stroke_width=5),
                rect(234, 258, 124, 15, "#9b744d"), rect(234, 378, 124, 15, "#9b744d"),
                rect(396, 258, 124, 15, "#9b744d"), rect(396, 378, 124, 15, "#9b744d"),
                rect(249, 195, 33, 58, "#52626a"), rect(290, 189, 49, 64, "#713c36"),
                rect(402, 301, 45, 70, "#836243"), rect(458, 287, 51, 84, "#40545b")]
    if kind == "market":
        return [polygon([250, 330, 531, 330, 506, 247, 275, 247], "#85463a"),
                polygon([285, 247, 340, 247, 325, 330, 270, 330], "#bc8a55"),
                polygon([395, 247, 448, 247, 462, 330, 410, 330], "#a95e42"),
                rect(276, 330, 230, 175, "#3b3029", stroke="#a5794e", stroke_width=4),
                ellipse(370, 403, 45, 25, "#70604b"), ellipse(442, 413, 37, 20, "#72613f"),
                line(294, 505, 484, 505, "#d1a872", 7)]
    if kind == "clinic":
        return [rect(270, 358, 265, 110, "#7d7466", stroke="#b9a98d", stroke_width=5, radius=22),
                rect(291, 339, 85, 33, "#d1c4ad", radius=13),
                rect(300, 469, 18, 84, "#413d3a"), rect(492, 469, 18, 84, "#413d3a"),
                rect(592, 240, 75, 155, "#27343a", stroke="#81a6a0", stroke_width=5, radius=28),
                ellipse(629, 265, 22, 22, "#c7aa70"), line(629, 292, 629, 363, "#6ea18f", 7)]
    if kind == "scrap":
        return [polygon([244, 525, 294, 392, 357, 525], "#48504d"),
                polygon([335, 525, 391, 358, 454, 525], "#604b3c"),
                polygon([426, 525, 479, 422, 545, 525], "#424e54"),
                ellipse(367, 394, 37, 22, "#a5794e"),
                line(254, 450, 339, 480, "#c18d58", 10), line(406, 456, 489, 431, "#78908a", 9)]
    if kind == "pump":
        return [rect(678, 329, 236, 202, "#293236", stroke="#9b7955", stroke_width=6, radius=18),
                ellipse(795, 423, 71, 71, "#574d41", stroke="#c39559", stroke_width=9),
                ellipse(795, 423, 27, 27, "#a87d4d"),
                line(795, 354, 795, 492, "#b68c59", 9), line(727, 423, 863, 423, "#b68c59", 9),
                line(914, 362, 1010, 289, "#657e79", 14), line(914, 485, 1022, 558, "#657e79", 14)]
    if kind == "bell":
        return [line(712, 110, 712, 220, "#8f704e", 14),
                polygon([610, 270, 645, 198, 679, 176, 747, 176, 780, 198, 816, 270, 800, 305, 628, 305], "#9a7145", stroke="#d3aa68", stroke_width=6),
                ellipse(714, 311, 27, 23, "#453b31"),
                line(712, 305, 712, 355, "#c09a5d", 7),
                line(612, 155, 814, 155, "#785d42", 9)]
    if kind == "water":
        return [polygon([0, 475, 260, 458, 455, 482, 672, 456, 875, 480, 1100, 453, 1280, 475, 1280, 545, 0, 545], {"gradient": {"from": "#213d48", "to": "#41645f", "angle": 0}}),
                line(65, 500, 255, 495, "#a3aaa0", 3), line(478, 514, 708, 504, "#99a9a4", 3),
                line(896, 494, 1160, 506, "#a3aaa0", 3)]
    if kind == "furnace":
        return [polygon([185, 521, 302, 291, 450, 521], "#373536", stroke="#8d6747", stroke_width=7),
                ellipse(318, 397, 74, 105, "#c35f35", stroke="#e29a52", stroke_width=8),
                ellipse(318, 414, 43, 68, "#f2ad5e"),
                line(507, 507, 703, 336, "#98754f", 17), line(709, 337, 815, 495, "#98754f", 17)]
    if kind == "spindle":
        return [ellipse(690, 355, 165, 165, "#20252b", stroke="#bd8e58", stroke_width=15),
                ellipse(690, 355, 118, 118, "#342e2e", stroke="#d8b875", stroke_width=8),
                ellipse(690, 355, 62, 62, "#161d22", stroke="#b06d49", stroke_width=7),
                line(690, 177, 690, 240, "#d8b875", 8), line(690, 470, 690, 535, "#d8b875", 8),
                line(512, 355, 575, 355, "#d8b875", 8), line(805, 355, 868, 355, "#d8b875", 8)]
    if kind == "desk":
        return [rect(570, 395, 285, 38, "#684a35", stroke="#a67a4a", stroke_width=5),
                rect(599, 431, 28, 112, "#44362d"), rect(805, 431, 28, 112, "#44362d"),
                rect(620, 346, 162, 44, "#30383a", stroke="#c09c68", stroke_width=4, radius=5),
                rect(640, 357, 123, 21, "#70a195")]
    return []


PALETTES = {
    "clock": ("#1b252f", "#45443f", "#75705e", "#8c7156"),
    "nook": ("#222a2d", "#3d4140", "#6d5540", "#bf7845"),
    "archive": ("#22252b", "#403a35", "#6e5b45", "#7c9a8f"),
    "market": ("#2c2828", "#49403a", "#8d6343", "#d2a05e"),
    "clinic": ("#29333a", "#414c4a", "#8a887b", "#a5c0ad"),
    "yard": ("#283035", "#3c4545", "#695443", "#9d8159"),
    "flood": ("#17252e", "#273a42", "#49645d", "#799389"),
    "chapel": ("#20272f", "#343a3b", "#766044", "#c5a26a"),
    "bridge": ("#17232b", "#394442", "#7d644b", "#9da99d"),
    "mill": ("#262a2c", "#41403a", "#8a6644", "#d69a54"),
    "gallery": ("#232830", "#393a3a", "#89704f", "#c39a5d"),
    "foundry": ("#211f24", "#403334", "#77513c", "#d6753f"),
    "spine": ("#1b2028", "#36383a", "#68533d", "#b48755"),
    "vault": ("#12171d", "#252b31", "#684b3d", "#c18b53"),
}


def scene_art(scene_key: str, kind: str, people: list[tuple[int, int, str, str]] = None,
              route_count: int = 1, item_shapes: list[dict] = None, extra_shapes: list[dict] = None) -> dict:
    wall, shadow, stone, glow = PALETTES[kind]
    layers = [
        layer("дымный свод", rect(0, 0, 1280, 720, {"gradient": {"from": wall, "to": shadow, "angle": 90}})),
        layer("дальний карниз", polygon([0, 340, 130, 260, 280, 332, 460, 238, 645, 331, 838, 235, 1010, 318, 1150, 240, 1280, 310, 1280, 420, 0, 420], stone, opacity=0.45)),
        layer("левый контрфорс", rect(42, 0, 48, 537, "#191f25", opacity=0.82)),
        layer("центральная опора", rect(416, 0, 35, 526, "#20272c", opacity=0.70)),
        layer("правый контрфорс", rect(1212, 0, 37, 526, "#191f25", opacity=0.76)),
        layer("пол из плит", polygon([0, 494, 1280, 465, 1280, 720, 0, 720], {"gradient": {"from": "#343638", "to": "#171d22", "angle": 90}})),
        layer("шов плиты", line(0, 592, 1280, 558, "#5d5750", 3, opacity=0.55)),
        layer("шов плиты", line(70, 687, 1190, 633, "#5d5750", 2, opacity=0.43)),
        layer("медная жила", line(0, 147, 354, 147, glow, 5, opacity=0.65)),
        layer("медная жила", line(452, 102, 916, 102, glow, 4, opacity=0.45)),
    ]
    # A warm, textured map plaque anchors the open-map hotspot in every scene.
    layers.extend([
        layer("табличка перехода", rect(54, 554, 138, 106, "#493729", stroke="#b18550", stroke_width=5, radius=10)),
        layer("металлический знак", ellipse(122, 601, 29, 29, "#20282c", stroke="#d0a261", stroke_width=5)),
        layer("стрелка знака", polygon([122, 581, 137, 603, 122, 622, 107, 603], "#d0a261")),
        layer("подпись без букв", line(80, 641, 164, 641, "#c4a578", 3, opacity=0.8)),
    ])
    if route_count >= 1:
        layers += [
            layer("переходная арка", ellipse(1092, 386, 100, 200, "#171c21", stroke="#88704f", stroke_width=8)),
            layer("внутренность арки", ellipse(1092, 405, 72, 161, wall)),
            layer("дверь", rect(1032, 404, 120, 163, "#302a26", stroke="#9f7c51", stroke_width=4, radius=6)),
            layer("латунная ручка", ellipse(1127, 485, 7, 7, "#d6a85e")),
        ]
    if route_count >= 2:
        layers += [
            layer("вторая арка", ellipse(890, 385, 84, 177, "#171c21", stroke="#776346", stroke_width=7)),
            layer("вторая дверь", rect(840, 412, 100, 145, "#302a26", stroke="#90724e", stroke_width=4, radius=5)),
            layer("вторая ручка", ellipse(919, 486, 6, 6, "#d6a85e")),
        ]
    # The same material language binds the 14 locations; individual landmarks make each room legible.
    landmarks = prop_shapes({
        "scene_clock_dock": "clock", "scene_crow_nook": "heater", "scene_census_hall": "shelves",
        "scene_scrip_market": "market", "scene_infirmary": "clinic", "scene_tin_yard": "scrap",
        "scene_flood_steps": "pump", "scene_drowned_chapel": "bell", "scene_sump_bridge": "water",
        "scene_lamp_mill": "spindle", "scene_bell_gallery": "bell", "scene_ash_foundry": "furnace",
        "scene_ledger_spine": "shelves", "scene_black_vault": "spindle",
    }[scene_key])
    for i, shape in enumerate(landmarks):
        layers.append(layer(f"узнаваемая деталь {i + 1}", shape))
    if scene_key in ("scene_census_hall", "scene_infirmary", "scene_scrip_market", "scene_tin_yard", "scene_ledger_spine"):
        layers.extend(layer(f"стол или консоль {i+1}", s) for i, s in enumerate(prop_shapes("desk")))
    if scene_key in ("scene_drowned_chapel", "scene_sump_bridge", "scene_flood_steps"):
        layers.extend(layer(f"водяной след {i+1}", s) for i, s in enumerate(prop_shapes("water")))
    if scene_key in ("scene_ash_foundry", "scene_lamp_mill", "scene_black_vault"):
        layers.extend(layer(f"тепловой отблеск {i+1}", s) for i, s in enumerate([
            ellipse(1040, 240, 115, 92, glow, opacity=0.12),
            line(942, 540, 1218, 408, glow, 8, opacity=0.50),
            ellipse(1050, 525, 32, 14, "#d77d43", opacity=0.46),
        ]))
    for i, shape in enumerate(item_shapes or []):
        layers.append(layer(f"предмет осмотра {i+1}", shape))
    for i, shape in enumerate(extra_shapes or []):
        layers.append(layer(f"деталь комнаты {i+1}", shape))
    for cx, floor_y, color, accent in people or []:
        layers.extend(layer("силуэт жителя", s) for s in person_shapes(cx, floor_y, color, accent))
    # Soft lamps, reflections and pipe seams make every flat primitive scene read as a built place.
    layers.extend([
        layer("фонарь", ellipse(253, 174, 44, 57, glow, opacity=0.12)),
        layer("фонарь стекло", ellipse(253, 174, 14, 31, "#e4b36a", opacity=0.64)),
        layer("труба над головой", line(44, 78, 1220, 78, "#74614b", 8, opacity=0.65)),
        layer("стружка света", line(470, 674, 734, 655, glow, 2, opacity=0.4)),
    ])
    return {"canvas": {"w": 1280, "h": 720}, "background": wall, "layers": layers}


def slot(slot_id: str, label: str, kind: str, x: int, y: int, w: int, h: int, entity: str,
         condition=None, use_with=None) -> dict:
    result = {"id": slot_id, "label": label, "type": [kind], "shape": "rect", "x": x, "y": y,
              "w": w, "h": h, "default_entity": entity, "condition": condition}
    if use_with:
        result["use_with"] = use_with
    return result


def nav_map() -> dict:
    return {"label": "Карта ярусов", "open_map": True, "area": {"x": 54, "y": 554, "w": 138, "h": 106}}


scene_specs = [
    {"id": "scene_clock_dock", "label": "Часовая пристань", "location": "loc_clock_dock", "chapter": "chapter_one",
     "kind": "clock", "routes": [{"label": "В служебный коридор", "go_to_scene": "scene_crow_nook", "area": {"x": 1022, "y": 397, "w": 140, "h": 173}}],
     "slots": [slot("slot_courier_body", "Тело курьера", "item", 592, 427, 184, 178, "item_courier_body"), slot("slot_irma", "Дознавательница Ирина", "person", 873, 296, 150, 336, "npc_irma")],
     "people": [(946, 625, "#18222a", "#a9774d")], "items": [ellipse(680, 564, 58, 21, "#4c4741"), rect(628, 509, 104, 61, "#394044", radius=16), ellipse(679, 504, 28, 28, "#a78b70")],
     "extras": [line(114, 475, 516, 474, "#9c754d", 9), line(114, 495, 516, 494, "#9c754d", 5)]},
    {"id": "scene_crow_nook", "label": "Гнездо ворона", "location": "loc_clock_dock", "chapter": "chapter_one",
     "kind": "nook", "routes": [{"label": "К пристани", "go_to_scene": "scene_clock_dock", "area": {"x": 1022, "y": 397, "w": 140, "h": 173}}],
     "slots": [slot("slot_old_radio", "Старый приёмник", "item", 687, 408, 137, 126, "item_radio_box"), slot("slot_unposted_letter", "Сложенное письмо", "item", 536, 435, 142, 105, "item_unposted_letter_prop")],
     "items": [rect(687, 408, 137, 126, "#263239", stroke="#a48154", stroke_width=6, radius=12), ellipse(754, 460, 32, 32, "#a5533a", stroke="#dab873", stroke_width=4), line(705, 510, 804, 510, "#8fa39a", 4), polygon([552, 464, 648, 451, 661, 516, 563, 528], "#c2b68e", stroke="#695743", stroke_width=4), line(565, 484, 643, 474, "#7f7056", 2), line(570, 503, 646, 493, "#7f7056", 2)],
     "extras": [rect(925, 466, 200, 38, "#574332", radius=8), rect(943, 503, 17, 82, "#392f28"), rect(1090, 503, 17, 82, "#392f28")]},
    {"id": "scene_census_hall", "label": "Палата переписи", "location": "loc_census", "chapter": "chapter_two",
     "kind": "archive", "routes": [
         {"label": "К рынку квот", "go_to_scene": "scene_scrip_market", "area": {"x": 1080, "y": 397, "w": 140, "h": 173}},
         {"label": "В лазарет", "go_to_scene": "scene_infirmary", "area": {"x": 840, "y": 410, "w": 102, "h": 147}}],
     "slots": [slot("slot_mika", "Архивный писарь Мика", "person", 864, 295, 142, 330, "npc_mika"), slot("slot_census_terminal", "Счётный стол", "item", 558, 386, 176, 134, "item_census_terminal")],
     "people": [(927, 620, "#263039", "#74877d")], "items": [rect(571, 409, 150, 89, "#202b31", stroke="#8f7757", stroke_width=5, radius=8), rect(594, 429, 104, 33, "#719287", radius=4)],
     "extras": [line(97, 212, 1132, 212, "#9d7853", 6), ellipse(1172, 170, 32, 32, "#a66b43", opacity=0.7)]},
    {"id": "scene_scrip_market", "label": "Рынок квот", "location": "loc_census", "chapter": "chapter_two",
     "kind": "market", "routes": [{"label": "К палате переписи", "go_to_scene": "scene_census_hall", "area": {"x": 1022, "y": 397, "w": 140, "h": 173}}],
     "slots": [slot("slot_ove", "Овель «Жесть»", "person", 827, 296, 154, 336, "npc_ove")],
     "people": [(902, 625, "#243039", "#bc8a55")], "extras": [line(195, 546, 791, 530, "#bb8951", 10), ellipse(352, 542, 51, 18, "#937348"), ellipse(478, 538, 42, 15, "#c09c62")]},
    {"id": "scene_infirmary", "label": "Лазарет второго яруса", "location": "loc_census", "chapter": "chapter_two",
     "kind": "clinic", "routes": [{"label": "К палате переписи", "go_to_scene": "scene_census_hall", "area": {"x": 1022, "y": 397, "w": 140, "h": 173}}],
     "slots": [slot("slot_daya", "Доктор Эда", "person", 849, 297, 144, 334, "npc_daya"), slot("slot_ash_tray", "Поднос с образцами", "item", 552, 387, 142, 125, "item_ash_tray")],
     "people": [(920, 623, "#2a353a", "#8ba69a")], "items": [rect(572, 414, 100, 46, "#344448", stroke="#a5b2a4", stroke_width=4, radius=8), ellipse(622, 402, 22, 15, "#915b40")]},
    {"id": "scene_tin_yard", "label": "Двор жестянщика", "location": "loc_flood_ward", "chapter": "chapter_three",
     "kind": "yard", "routes": [{"label": "К сливной лестнице", "go_to_scene": "scene_flood_steps", "area": {"x": 1022, "y": 397, "w": 140, "h": 173}}],
     "slots": [slot("slot_wire_heap", "Медный моток", "item", 543, 430, 164, 115, "item_wire_heap"), slot("slot_filter_felt", "Сухой фильтровой войлок", "item", 752, 449, 155, 98, "item_filter_felt_prop")],
     "items": [line(559, 493, 664, 460, "#bb8750", 15), ellipse(603, 473, 51, 33, "#9f7548", stroke="#d1a367", stroke_width=5), rect(785, 467, 94, 52, "#7b6e54", stroke="#c1a77c", stroke_width=4, radius=10)],
     "extras": [line(205, 353, 491, 269, "#657d78", 13), line(229, 382, 477, 307, "#a1764e", 8)]},
    {"id": "scene_flood_steps", "label": "Сливная лестница", "location": "loc_flood_ward", "chapter": "chapter_three",
     "kind": "flood", "routes": [
         {"label": "Во двор жестянщика", "go_to_scene": "scene_tin_yard", "area": {"x": 1080, "y": 397, "w": 140, "h": 173}},
         {"label": "В подводную часовню", "go_to_scene": "scene_drowned_chapel", "area": {"x": 840, "y": 410, "w": 102, "h": 147}}],
     "slots": [slot("slot_sump_pump", "Сливной насос", "item", 679, 322, 241, 218, "item_sump_pump", use_with=[{"item": "item_resonance_coil", "consume": False, "effects": [{"type": "set_flag", "flag": "pump_open"}, {"type": "show_message", "text": "Катушка поймала низкий тон. Заслонка отходит, и в стене открывается сухая ниша."}], "message": "Резонансная катушка подхватывает гул насоса."}])],
     "items": [rect(693, 335, 208, 184, "#29343a", stroke="#a17b50", stroke_width=7, radius=17), ellipse(796, 427, 64, 64, "#594c3b", stroke="#c49a5c", stroke_width=8), ellipse(796, 427, 20, 20, "#b57d4a"), line(796, 363, 796, 491, "#c49a5c", 8), line(732, 427, 860, 427, "#c49a5c", 8)],
     "extras": [line(179, 319, 445, 319, "#6d8c86", 9), line(163, 356, 428, 356, "#6d8c86", 8), ellipse(352, 562, 200, 21, "#28434a", opacity=0.68)]},
    {"id": "scene_drowned_chapel", "label": "Часовня под водой", "location": "loc_flood_ward", "chapter": "chapter_three",
     "kind": "chapel", "routes": [
         {"label": "К сливной лестнице", "go_to_scene": "scene_flood_steps", "area": {"x": 1080, "y": 397, "w": 140, "h": 173}},
         {"label": "К шлюзовому мосту", "go_to_scene": "scene_sump_bridge", "area": {"x": 840, "y": 410, "w": 102, "h": 147}}],
     "slots": [slot("slot_mira", "Сестра Мира", "person", 868, 292, 146, 340, "npc_mira"), slot("slot_black_bell", "Чёрный колокол", "item", 568, 175, 214, 210, "item_black_bell")],
     "people": [(940, 624, "#20272d", "#9b7b55")], "items": [polygon([610, 283, 640, 209, 675, 187, 730, 187, 763, 210, 796, 283, 781, 306, 625, 306], "#a2814c", stroke="#d3ae6d", stroke_width=6)],
     "extras": [ellipse(700, 360, 235, 254, "#151c22", stroke="#776349", stroke_width=8), ellipse(700, 362, 202, 218, "#333536", stroke="#8c7351", stroke_width=6)]},
    {"id": "scene_sump_bridge", "label": "Шлюзовой мост", "location": "loc_flood_ward", "chapter": "chapter_three",
     "kind": "bridge", "routes": [{"label": "К часовне", "go_to_scene": "scene_drowned_chapel", "area": {"x": 1022, "y": 397, "w": 140, "h": 173}}],
     "slots": [slot("slot_child_charm", "Детский медальон", "item", 688, 468, 118, 94, "item_child_charm_prop")],
     "items": [ellipse(747, 508, 38, 22, "#a4824f", stroke="#d1b36d", stroke_width=6), ellipse(747, 508, 14, 9, "#2b3b3c"), line(746, 489, 766, 465, "#d3b46f", 4)],
     "extras": [line(207, 384, 1017, 368, "#8c7456", 12), line(206, 410, 1017, 395, "#8c7456", 8), polygon([176, 515, 990, 497, 1020, 552, 169, 568], "#3b3d3a", opacity=0.8)]},
    {"id": "scene_lamp_mill", "label": "Ламповая мельница", "location": "loc_foundry", "chapter": "chapter_four",
     "kind": "mill", "routes": [{"label": "В галерею колоколов", "go_to_scene": "scene_bell_gallery", "area": {"x": 1022, "y": 397, "w": 140, "h": 173}}],
     "slots": [slot("slot_lamp_panel", "Щит распределения", "item", 548, 393, 174, 129, "item_lamp_panel")],
     "items": [rect(564, 410, 142, 94, "#263037", stroke="#b1824e", stroke_width=6, radius=8), ellipse(600, 445, 15, 15, "#c8874b"), ellipse(648, 445, 15, 15, "#6ea090"), line(581, 478, 683, 478, "#a1b6a0", 4)],
     "extras": [ellipse(298, 266, 104, 104, "#272d30", stroke="#a77847", stroke_width=9), ellipse(298, 266, 45, 45, "#bd7744"), line(195, 266, 397, 266, "#9b7548", 8)]},
    {"id": "scene_bell_gallery", "label": "Галерея малых колоколов", "location": "loc_foundry", "chapter": "chapter_four",
     "kind": "gallery", "routes": [
         {"label": "К ламповой мельнице", "go_to_scene": "scene_lamp_mill", "area": {"x": 1080, "y": 397, "w": 140, "h": 173}},
         {"label": "В зольную литейную", "go_to_scene": "scene_ash_foundry", "area": {"x": 840, "y": 410, "w": 102, "h": 147}}],
     "slots": [slot("slot_sel", "Смотритель Сел", "person", 864, 293, 145, 339, "npc_sel"), slot("slot_gallery_bell", "Ряд колоколов", "item", 503, 229, 234, 190, "item_gallery_bell")],
     "people": [(935, 624, "#232c32", "#bc915b")], "items": [polygon([526, 349, 555, 293, 579, 277, 664, 277, 687, 293, 716, 349, 700, 370, 542, 370], "#9a754b", stroke="#d4b474", stroke_width=5)],
     "extras": [line(496, 144, 755, 144, "#a47b4a", 6), line(520, 179, 733, 179, "#a47b4a", 5), ellipse(635, 188, 22, 22, "#c09358")]},
    {"id": "scene_ash_foundry", "label": "Зольная литейная", "location": "loc_foundry", "chapter": "chapter_four",
     "kind": "foundry", "routes": [
         {"label": "В галерею", "go_to_scene": "scene_bell_gallery", "area": {"x": 1080, "y": 397, "w": 140, "h": 173}},
         {"label": "К позвоночному архиву", "go_to_scene": "scene_ledger_spine", "area": {"x": 840, "y": 410, "w": 102, "h": 147}}],
     "slots": [slot("slot_foundry_console", "Распределительный стол", "item", 571, 398, 168, 121, "item_foundry_console")],
     "items": [rect(588, 417, 135, 79, "#273035", stroke="#a77d4c", stroke_width=5, radius=8), ellipse(623, 453, 15, 15, "#ce7641"), ellipse(676, 453, 15, 15, "#c8ac74"), line(607, 481, 704, 481, "#778983", 3)],
     "extras": [polygon([870, 530, 954, 268, 1069, 530], "#463535", stroke="#a46440", stroke_width=8), ellipse(970, 413, 53, 80, "#d27a43", opacity=0.75)]},
    {"id": "scene_ledger_spine", "label": "Позвоночный архив", "location": "loc_foundry", "chapter": "chapter_four",
     "kind": "spine", "routes": [{"label": "В литейную", "go_to_scene": "scene_ash_foundry", "area": {"x": 1022, "y": 397, "w": 140, "h": 173}}],
     "slots": [slot("slot_spindle_manifest", "Пакет приказов", "item", 622, 333, 181, 145, "item_spindle_manifest")],
     "items": [rect(641, 358, 144, 98, "#362d27", stroke="#c0935b", stroke_width=6, radius=7), line(663, 383, 760, 383, "#d0b27c", 3), line(663, 405, 760, 405, "#d0b27c", 3), line(663, 427, 760, 427, "#d0b27c", 3)],
     "extras": [rect(170, 136, 116, 391, "#2c2928", stroke="#876447", stroke_width=5), rect(311, 136, 116, 391, "#2c2928", stroke="#876447", stroke_width=5), rect(453, 136, 116, 391, "#2c2928", stroke="#876447", stroke_width=5)]},
    {"id": "scene_black_vault", "label": "Чёрный свод", "location": "loc_core", "chapter": "chapter_five",
     "kind": "vault", "routes": [],
     "slots": [slot("slot_sava", "Главный архивист Сава", "person", 805, 296, 148, 338, "npc_sava"), slot("slot_bell_voice", "Голос колокола", "person", 431, 310, 150, 313, "npc_bell_voice")],
     "people": [(878, 625, "#1d252a", "#bf8050"), (505, 620, "#293135", "#74958e")],
     "extras": [ellipse(639, 357, 276, 264, "#14191e", stroke="#865d45", stroke_width=14), ellipse(639, 357, 220, 209, "#202a2f", stroke="#b08353", stroke_width=8), ellipse(639, 357, 153, 147, "#12191e", stroke="#59857a", stroke_width=6), ellipse(639, 357, 57, 57, "#d1874a", opacity=0.73), line(354, 357, 431, 357, "#aa7c4a", 7), line(858, 357, 952, 357, "#aa7c4a", 7)]},
]

scenes_manifest = []
for spec in scene_specs:
    scene_id = spec["id"]
    art = scene_art(scene_id, spec["kind"], spec.get("people"), len(spec.get("routes", [])), spec.get("items"), spec.get("extras"))
    states = [{"id": f"state_{scene_id.removeprefix('scene_')}", "label": "Обычный свет", "art": art, "condition": None}]
    navigation = list(spec.get("routes", [])) + [nav_map()]
    scene = {"id": scene_id, "label": spec["label"], "location": spec["location"], "canvas": {"w": 1280, "h": 720},
             "states": states, "slots": spec.get("slots", []), "navigation": navigation, "chapter": spec["chapter"]}
    write_json(f"scenes/{scene_id}.json", scene)
    scenes_manifest.append(f"{scene_id}.json")

# A hand-drawn map: the routes are visible as copper conduits rather than a generic grid.
map_layers = [
    layer("подложка карты", rect(0, 0, 1280, 720, {"gradient": {"from": "#151d25", "to": "#302c2a", "angle": 90}})),
    layer("внешнее кольцо", ellipse(660, 360, 530, 286, None, stroke="#65543e", stroke_width=8)),
    layer("ярусные пролёты", line(205, 372, 462, 276, "#b07e4d", 12)),
    layer("ярусные пролёты", line(462, 276, 510, 557, "#b07e4d", 12)),
    layer("ярусные пролёты", line(510, 557, 858, 446, "#b07e4d", 12)),
    layer("служебная линия", line(462, 276, 858, 446, "#8c7050", 8)),
    layer("линия к сердцу", line(858, 446, 1086, 257, "#bb6848", 10, opacity=0.65)),
    layer("пристань", ellipse(205, 372, 50, 50, "#8b6044", stroke="#d2a964", stroke_width=7)),
    layer("палата переписи", ellipse(462, 276, 52, 52, "#7f8877", stroke="#d2a964", stroke_width=7)),
    layer("затопленный ярус", ellipse(510, 557, 53, 53, "#41645f", stroke="#d2a964", stroke_width=7)),
    layer("литейная", ellipse(858, 446, 56, 56, "#b45f3e", stroke="#d2a964", stroke_width=7)),
    layer("скрытый свод", ellipse(1086, 257, 49, 49, "#261d20", stroke="#a74b43", stroke_width=7)),
    layer("надпись города как печать", ellipse(664, 360, 19, 19, "#d0ae6c")),
    layer("тонкие улицы", line(73, 154, 323, 612, "#72716a", 3, opacity=0.45)),
    layer("тонкие улицы", line(334, 170, 821, 633, "#72716a", 3, opacity=0.35)),
]
world = {"regions": [{
    "id": "region_nizhny_liorn", "label": "Нижний Лиорн", "map_image": "", "map_size": {"w": 1280, "h": 720},
    "map_art": {"canvas": {"w": 1280, "h": 720}, "background": "#151d25", "layers": map_layers},
    "parent_region": None,
    "locations": [
        {"id": "loc_clock_dock", "label": "Часовая пристань", "position": {"x": 205, "y": 372},
         "travel_connections": [{"to": "loc_census", "cost_ticks": 2}], "scenes": ["scene_clock_dock", "scene_crow_nook"], "arrival_scene": "scene_clock_dock",
         "camp": True, "music": [{"tracks": ["music_dock"], "conditions": []}], "ambient": ["snd_clockwork"]},
        {"id": "loc_census", "label": "Палата переписи", "position": {"x": 462, "y": 276},
         "travel_connections": [{"to": "loc_clock_dock", "cost_ticks": 2}, {"to": "loc_flood_ward", "cost_ticks": 2}, {"to": "loc_foundry", "cost_ticks": 3}],
         "scenes": ["scene_census_hall", "scene_scrip_market", "scene_infirmary"], "arrival_scene": "scene_census_hall", "camp": True,
         "music": [{"tracks": ["music_records"], "conditions": []}], "ambient": ["snd_archive_hum"]},
        {"id": "loc_flood_ward", "label": "Затопленный ярус", "position": {"x": 510, "y": 557},
         "travel_connections": [{"to": "loc_census", "cost_ticks": 2}, {"to": "loc_foundry", "cost_ticks": 2, "random_encounter_table": "enc_sluice_route"}],
         "scenes": ["scene_tin_yard", "scene_flood_steps", "scene_drowned_chapel", "scene_sump_bridge"], "arrival_scene": "scene_tin_yard",
         "music": [{"tracks": ["music_tunnels"], "conditions": []}], "ambient": ["snd_water_drip"]},
        {"id": "loc_foundry", "label": "Зольная литейная", "position": {"x": 858, "y": 446},
         "travel_connections": [{"to": "loc_census", "cost_ticks": 3}, {"to": "loc_flood_ward", "cost_ticks": 2},
                                 {"to": "loc_core", "cost_ticks": 1, "requirements": [{"type": "flag_set", "flag": "core_open"}, {"type": "flag_set", "flag": "clue_body_seal"}, {"type": "flag_set", "flag": "clue_duplicate_record"}, {"type": "flag_set", "flag": "clue_transit"}, {"type": "flag_set", "flag": "clue_echo"}]}],
         "scenes": ["scene_lamp_mill", "scene_bell_gallery", "scene_ash_foundry", "scene_ledger_spine"], "arrival_scene": "scene_lamp_mill",
         "music": [{"tracks": ["music_foundry"], "conditions": []}], "ambient": ["snd_furnace_breath"]},
        {"id": "loc_core", "label": "Чёрный свод", "position": {"x": 1086, "y": 257},
         "travel_connections": [{"to": "loc_foundry", "cost_ticks": 1, "requirements": [{"type": "flag_set", "flag": "core_open"}]}],
         "scenes": ["scene_black_vault"], "arrival_scene": "scene_black_vault", "hidden": True,
         "music": [{"tracks": ["music_core"], "conditions": []}], "ambient": ["snd_resonance"]},
    ]
}]}
write_json("world.json", world)

# Human-readable design document, kept inside the campaign package.
design_doc = r'''# Гейм-дизайнерский документ кампании

## 1. Паспорт

- **Название:** Колокол без имени
- **Жанр и тон:** тёмное техно-фэнтези, камерный детектив и выживание; сырой металл, тихая жалость и выбор без чистых рук.
- **Объём:** 14 сцен — 8 НПС — 4 квеста — 5 концовок (четыре исхода расследования и гибель героя).
- **Расчётное время:** 5–7 часов с исследованием районов и дополнительными поручениями; обязательный путь с ключевыми уликами занимает около 4 ч 25 мин — 5 ч 35 мин.
- **Ключевая идея:** расследование выясняет не только, кто подделывает записи о смерти, но и какую цену город платит за свет. Важнее не «победить злодея», а решить, кто вправе отдать чужое имя в уплату за безопасность.

## 2. Завязка и мир

Нижний Лиорн выстроен внутри погребённого собора-механизма. Над его куполом лежит пепельная буря, а город освещает древний Чёрный звон: каждую ночь он удерживает защитный свод над жилыми ярусами. После каждого удара кто-то исчезает, а перепись заранее объявляет этого человека умершим. В час перед новым звоном у платформы находят курьера с остановленными часами и свежей печатью архива.

Действие проходит за одну долгую ночь и следующий день в пяти связанных ярусах Нижнего Лиорна. Герой — полевой дознаватель, которому поручено проверить смерть курьера и пропажу людей. Помогают ему дознавательница Ирина, врач Эда, писарь Мика, механик Овель и сестра Мира; мешают страх, нехватка тепла и главный архивист Сава Рейн, который считает жертвы единственным способом не дать буре поглотить город.

## 3. Главы

| Глава | Что происходит | Сцены |
| --- | --- | --- |
| I. Полый час | Герой осматривает тело курьера, получает дело и находит место для короткой передышки. | Часовая пристань; Гнездо ворона |
| II. Чёрная строка | Архив, рынок и лазарет показывают, что перепись записывает людей умершими до их исчезновения. | Палата переписи; Рынок квот; Лазарет второго яруса |
| III. Вода помнит | В затопленном ярусе герой находит след переноса и голоса тех, чьи имена вычеркнули. | Двор жестянщика; Сливная лестница; Часовня под водой; Шлюзовой мост |
| IV. Цена света | Устройства и свидетельства выводят к распоряжению Савы и скрытому сердцу свода. | Ламповая мельница; Галерея малых колоколов; Зольная литейная; Позвоночный архив |
| V. Имя под печатью | В Чёрном своде герой решает судьбу города и людей, оставшихся в колоколе. | Чёрный свод |

**Оценка темпа:**

| Глава | Основной путь | Время |
| --- | --- | --- |
| I. Полый час | Осмотр тела, разговор с Ириной, первое возвращение в безопасную комнату. | 35–45 мин |
| II. Чёрная строка | Архивная улика, знакомство с рынком и проверка в лазарете. | 60–75 мин |
| III. Вода помнит | Поиск деталей, маршрут через затопленный ярус, насос и голос в часовне. | 75–90 мин |
| IV. Цена света | Осмотр энергетического яруса, разговор с Селом и подтверждение распоряжения. | 60–75 мин |
| V. Имя под печатью | Вход в сердце, финальный разговор и выбор исхода. | 35–50 мин |
| **Итого: обязательное расследование** | **Без учёта необязательных поручений и повторных проверок.** | **4 ч 25 мин — 5 ч 35 мин** |

Три необязательных поручения, короткие отклонения за припасами и дополнительные осмотры добавляют примерно 35–85 минут. Итоговый ожидаемый диапазон — **5–7 часов**; точное время зависит от того, сколько проверок и веток читает группа, и от длительности добровольного финального боя.

## 4. Сцены

| Название | Место | Роль в истории | Что можно сделать |
| --- | --- | --- | --- |
| Часовая пристань | Нижняя платформа | Завязка и первое вещественное доказательство. | Осмотреть тело, снять жетон, поговорить с Ириной, уйти в безопасную комнату. |
| Гнездо ворона | Служебная комната | Небольшой островок тепла между ярусами и тайник с непосланным письмом. | Отдохнуть, осмотреть приёмник, найти письмо Мики и сверить заметки. |
| Палата переписи | Архивный ярус | Улика о записях, сделанных до смерти. | Поговорить с Микой, сверить строки и копии, перейти к рынку или в лазарет. |
| Рынок квот | Торговый ярус | Выживание и практическая помощь механика. | Торговать, попросить Овеля собрать катушку, отправиться к складам. |
| Лазарет второго яруса | Медицинский ярус | Независимая проверка того, что перепись называет «смертью». | Поговорить с Эдой, исследовать пепельный образец, взять работу с фильтром. |
| Двор жестянщика | Затопленный ярус | Источник деталей для ремонта и фильтра. | Забрать медь и сухой войлок, вернуться к Овелю, спуститься к насосу. |
| Сливная лестница | Подземный коллектор | Необязательная механическая задача и путь к часовне. | Повернуть насос проверкой механики или собрать катушку и применить её к насосу. |
| Часовня под водой | Старый культовый зал | Главная улика о памяти, заключённой в звоне. | Поговорить с Мирой, услышать имя, открыть запись кодекса. |
| Шлюзовой мост | Переход над коллектором | Место личной потери среди большого дела. | Поднять детский медальон и отнести его Мире. |
| Ламповая мельница | Энергетический ярус | Показывает, что городской свет и Чёрный звон связаны одной сетью. | Осмотреть распределительный щит, перейти в галерею. |
| Галерея малых колоколов | Порог архивного сектора | Проверка решимости и возможность получить свидетеля вместо ключа. | Поговорить со Селом, предъявить улики, осмотреть ряд колоколов. |
| Зольная литейная | Машинный зал | Показывает нагрузку на защитный свод и ведёт к архиву приказов. | Проверить консоль и перейти в позвоночный архив. |
| Позвоночный архив | Запретный зал | Вещественное доказательство приказа Савы; открывает путь к сердцу. | Сверить печать, открыть скрытую точку на карте. |
| Чёрный свод | Сердце города | Финальное столкновение и четыре способа завершить дело. | Представить полное доказательство, отключить механизм, скрыть правду или вступить в бой. |

## 5. Персонажи

| Имя и кто | Чего хочет | Что знает | Где стоит | В каком настроении бывает |
| --- | --- | --- | --- | --- |
| Ирина Вель, дознавательница | Найти пропавших, не отдать дело городской страже. | Курьер принёс опечатанный список; чиновники заранее закрыли его дело. | Часовая пристань | Сдержанная, настороженная, после принятия дела — чуть мягче. |
| Мика Орн, архивный писарь | Не стать следующим именем в ведомости. | Перепись выдаёт свидетельства о смерти до удара колокола; часть приказов подписана Савой. | Палата переписи | Испуганный, виноватый, временами упрямый. |
| Эда Лин, врач | Сохранить пациентов и достать фильтр от пепла. | В лазарете лежат люди, официально умершие; у них сохраняется дыхание и память. | Лазарет | Усталая, заботливая, решительная. |
| Овель «Жесть», механик и торговец | Поддерживать насосы и не отдавать последние детали стражам. | Старый резонатор способен открыть сухую нишу в коллекторе; свод питается не обычным топливом. | Рынок квот | Насмешливый, деловой, благодарный за помощь. |
| Сестра Мира, хранительница часовни | Вернуть хотя бы одно имя из хора. | Чёрный звон хранит отпечатки людей, а не только звук. | Часовня под водой | Спокойная, скорбная, надеющаяся. |
| Сел, смотритель галереи | Не дать толпе добраться до опасного механизма. | Его пост получил приказ закрыть зал до очередной переписи; он видел, как Сава входил в архив. | Галерея малых колоколов | Жёсткий, тревожный, способен уступить фактам. |
| Сава Рейн, главный архивист | Сохранить защитный свод любой ценой. | Он подписал тайный перенос людей в сердце механизма и знает, что есть другой, более рискованный способ. | Чёрный свод | Измотанный, властный, в конце — почти просит оставить всё как есть. |
| Голос колокола, коллективный отпечаток | Быть услышанным, не стать вечной квитанцией. | Имена можно освободить; цена и последствия зависят от решения героя. | Чёрный свод | Несколько голосов: ровный, сбивчивый, постепенно ясный. |

## 6. Квесты и концовки

| Квест | Как проходит | Как завершается успехом | Как завершается провалом | Что даёт |
| --- | --- | --- | --- | --- |
| Дело о пустом имени | Найти след на теле, проверить перепись, подтвердить слова врача и часовни, добыть распоряжение. | Любая из четырёх финальных развязок закрывает дело своим исходом. | Гибель дознавателя до решения — трагический финал. | Доступ к правде о Чёрном звоне и выбор судьбы города. |
| Фильтр для лазарета | Эда просит сухой войлок; его можно забрать во дворе жестянщика и принести назад. | Эда изготавливает запас тепловых капсул и помогает пациентам. | Жёсткого провала нет: поручение можно оставить незавершённым. | Запас тепла и свидетельство о тех, кого перепись уже вычеркнула. |
| Имя в воде | Мира просит вернуть медальон с моста и произнести имя, пока голос ещё слышен. | Герой отдаёт медальон и признаёт человека по имени. | Жёсткого провала нет; молчание оставляет голос в колоколе. | Личное завершение линии Миры и дополнительная поддержка в финале. |
| Письмо без адреса | Мика просит найти письмо в комнате дознавателя и принести его в архив. | Мика решается подтвердить приказ Савы; его свидетельство заменяет архивный пропуск как доказательство допуска. | Жёсткого провала нет; письмо можно оставить у себя. | Альтернативная улика об авторе приказа и запись о жителях, чьи имена исчезли. |

- **Концовки:** «Общий голос» — доказательства предъявлены, имена освобождены и нагрузка свода разделена; «Долгая ночь» — сердце отключено, город теряет свет, но протокол прекращается; «Тихая подпись» — дело скрыто и нынешний порядок сохранён ценой продолжения жертв; «Сталь вместо слова» — Сава побеждён в бою, а сердце остаётся без управляющего; «Пепел без свидетеля» — герой погибает.
- **Новая игра+ / хроника:** намеренно не используется. Это законченная история на один забег; между забегами не переносится ни снаряжение, ни улики, а все развязки доступны без обязательного повторного прохождения.

## 7. Какие механики задействованы

- Проверки навыков наблюдения, механики, скрытности, убеждения и боя; отдельные провалы добавляют цену, но не прячут обязательную основную улику.
- Карта ярусов и поездки между районами; внутри района — переходы между сценами.
- Две потребности: голод убывает всегда, тепло уходит только в пепельную бурю вне укрытий. Еда и тепловые капсулы помогают пережить путь.
- Обычный отдых в комнате дознавателя и тёплых районах; холод и голод дают временные помехи, а не мгновенно убивают героя.
- Предметы-улики и места для осмотра; кодекс фиксирует сведения о своде и пропавших.
- Ремесло: простую резонансную катушку можно собрать из меди и пепельной пыли и применить к насосу. Изготовление вызывается у Овеля и прямо у насоса.
- Пеплопад задаёт визуальный и звуковой фон. В звуке и музыке используются встроенная генерация; рисунки сцен созданы из встроенных примитивов.
- Персонажи меняют тон реплик; в часовне есть дедлайн на ответ голосу, чтобы молчание стало осознанным выбором.
- Один необязательный к финалу бой. Его можно избежать; основная история решается уликами, разговором и распоряжением Савы.

## 8. Рамки баланса

- Один тик равен часу. Дорога между ярусами занимает 1–3 часа; отдых в безопасной комнате — 6 часов. Точная длина боёв не задана: финальный бой добровольный, у каждого бойца обычная очередь действий, отступление доступно.
- Валюта — медные марки. Паёк стоит 2 марки, тепловая капсула — 3; у героя в начале 8 марок, два пайка и одна капсула. Укрытия не требуют платы.
- Голод убывает на 2 пункта за час; паёк возвращает 35. На открытом пепельном ярусе тепло убывает на 4 пункта за час, в крытых районах восстанавливается на 5; капсула возвращает 30.
- Нулевой голод или тепло накладывает временную помеху к нескольким навыкам; прямого автоматического урона нет. Базовый герой выдерживает один удар средней силы хуже, чем бронированный Сава, поэтому бой — рискованный выбор, не обязательная проверка.
- Для финального решения не нужно собирать все необязательные вещи; полное доказательство требует пяти основных следов из разных районов.

## 9. Что пока нельзя сделать в движке

Свободную настольную доску, куда игрок перетаскивает улики и сам формулирует вывод, движок не моделирует. Здесь выводы собраны через осмотр предметов, реплики свидетелей и записи дела. В кампании нет отдельного обхода через скрытые счётчики: все запоминания — реальные сюжетные события, которые читаются в сценах, разговорах, правилах или концовках. Других нужных, но отсутствующих возможностей нет.

## 10. Журнал решений

| Итерация | Что решили | Почему |
| --- | --- | --- |
| 1 | Сделать историю на одну ночь и один следующий день в пяти ярусах, без обязательного создания персонажа и без обязательного боя. | В задании не были указаны конкретные правила создания героя и доля боёв; фиксированный дознаватель оставляет фокус на расследовании и выживании. |
| 1 | Разделить обязательные пять улик и три необязательных человеческих поручения. Письмо Мики также даёт альтернативный способ получить показания и открыть финальный район. | Это даёт понятный путь к финалу, но оставляет пространство для внимательного исследования, выживания и эмпатии. |
| 1 | Использовать рисунки примитивами и синтезируемую музыку вместо внешних файлов. | В пакете нет исходных медиа, а формат умеет рисовать сцены и озвучивать атмосферу без временных ссылок и сомнительных прав. |

## 11. Приложение «Соответствие разделам JSON»

| Раздел документа | Имена в кампании |
| --- | --- |
| Паспорт и описание | `campaign.json`: `title`, `description`, `design_doc` |
| Главы | `campaign.json`: `chapters`; сцены отмечены главами |
| Мир и карта | `world.json`: `region_nizhny_liorn`, локации `loc_…` |
| Сцены | `scenes/scene_*.json`; состояния рисунка и слоты `slot_…` |
| Персонажи и предметы | `entities/player_hero.json`, `entities/npc_*.json`, `entities/item_*.json` |
| Квесты | `quests/quest_black_case.json`, `quest_filter.json`, `quest_name.json`, `quest_unposted_letter.json` |
| Правила | `rules/rule_*.json`; таблица встреч — `encounters/enc_routes.json` |
| Концовки | `campaign.json`: `endings` |
| Рецепты и кодекс | `recipes/recipe_resonance_coil.json`, `codex/codex_*.json` |
| Диалоги | `dialogues/*.ink` |
| Память событий | `campaign.json`: `flags`; используются в осмотре, репликах, доступе и концовках |
'''

chapters = [
    {"id": "chapter_one", "label": "I. Полый час", "order": 1, "description": "Тело курьера, первое поручение и безопасная комната."},
    {"id": "chapter_two", "label": "II. Чёрная строка", "order": 2, "description": "Перепись, рынок и лазарет."},
    {"id": "chapter_three", "label": "III. Вода помнит", "order": 3, "description": "Затопленный ярус, насос и голоса из колокола."},
    {"id": "chapter_four", "label": "IV. Цена света", "order": 4, "description": "Машинный ярус и приказ главного архивиста."},
    {"id": "chapter_five", "label": "V. Имя под печатью", "order": 5, "description": "Финальное решение в сердце города."},
]

flags_data = [
    ("case_started", "Дело заведено", "Запоминает начало расследования; читается в журнале дела и в финальных правилах."),
    ("case_briefing", "Поручение принято", "Запоминает, что дознаватель принял дело Ирины; читается в её диалоге."),
    ("clue_body_seal", "Пломба на теле", "Запоминает улику с тела курьера; открывает записи дела и условие полного доказательства."),
    ("clue_clock_gap", "Сбой часов", "Запоминает необязательную временную улику; читается в кодексе и выводах героя."),
    ("clue_duplicate_record", "Двойная запись", "Запоминает найденную подмену в переписи; читается в разговоре с Селом и финальном доказательстве."),
    ("clue_transit", "Живые числятся мёртвыми", "Запоминает медицинское подтверждение перевода людей; читается в деле и условии финального доказательства."),
    ("clue_echo", "Голоса в колоколе", "Запоминает, что колокол хранит имена; читается в диалоге Савы и финальном доказательстве."),
    ("clue_authorization", "Приказ Савы", "Запоминает подлинный приказ или свидетельство Мики либо Села о распоряжении; требуется для полного доказательства и допуска в сердце."),
    ("core_open", "Допуск к сердцу получен", "Запоминает получение пропуска или проверенного свидетельства Мики либо Села; вместе с главными уликами позволяет войти в Чёрный свод."),
    ("core_reached", "Сердце найдено", "Запоминает вход в Чёрный свод; обновляет журнал и запускает сцену раскрытия."),
    ("pump_open", "Насос настроен", "Запоминает настройку сливного насоса; открывает нишу и подтверждает, что катушка работает."),
    ("side_letter_started", "Просьба Мики", "Запоминает, что Мика просит найти спрятанное письмо; читается в его диалоге и задании."),
    ("letter_found", "Письмо поднято", "Запоминает, что письмо найдено в комнате дознавателя; проверяется в разговоре с Микой и его поручении."),
    ("side_letter_delivered", "Письмо передано", "Запоминает, что Мика получил письмо и дал свидетельство; это альтернативное подтверждение приказа Савы."),
    ("side_filter_started", "Просьба Эды", "Запоминает, что начата работа для лазарета; проверяется в диалоге Эды и правиле награды."),
    ("side_filter_helped", "Фильтр собран", "Запоминает, что войлок передан врачу; читается в наградном правиле и описании концовок."),
    ("side_name_started", "Имя обещано Мире", "Запоминает обещание вернуть медальон; читается в разговоре Миры и правиле завершения поручения."),
    ("charm_found", "Медальон поднят", "Запоминает находку на шлюзовом мосту; открывает ответ для Миры."),
    ("side_echo_saved", "Имя произнесено", "Запоминает освобождение одного голоса; читается в кодексе и завершении поручения Миры."),
    ("echo_named", "Имя отозвалось", "Запоминает своевременный ответ голосу; читается в сцене часовни и записи кодекса."),
    ("echo_lost", "Ответ запоздал", "Запоминает молчание у часовни; читается в репликах Миры и не блокирует основное дело."),
    ("guard_testimony", "Сел подтвердил приказ", "Запоминает свидетельство смотрителя; читается в правиле, открывающем путь к сердцу."),
    ("ending_communal", "Имена возвращены", "Запоминает развязку с общим голосом; выбирает соответствующий экран финала."),
    ("ending_cut", "Свод отключён", "Запоминает отключение сердца и потерю света; выбирает соответствующий экран финала."),
    ("ending_cover", "Дело скрыто", "Запоминает сохранение тайны и старого порядка; выбирает соответствующий экран финала."),
    ("ending_steel", "Сава побеждён", "Запоминает исход добровольного боя; выбирает соответствующий экран финала."),
]

sound_defs = [
    {"id": "snd_clockwork", "label": "Часовой механизм", "src": {"zzfx": [0.5, 0.1, 190, 0, 0.03, 0.25, 2, 1, 2, 0, 0, 0, 0, 0, 0, 0, 0, 0.5, 1, 0]}, "loop": True},
    {"id": "snd_archive_hum", "label": "Гул переписи", "src": {"zzfx": [0.35, 0.03, 74, 0.1, 0.3, 0.5, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0.5, 1, 0]}, "loop": True},
    {"id": "snd_water_drip", "label": "Капли коллектора", "src": {"zzfx": [0.4, 0.1, 480, 0, 0.02, 0.18, 3, 1, -2, 0, 0, 0.2, 0.03, 0, 0, 0, 0, 0.6, 1, 0]}, "loop": True},
    {"id": "snd_furnace_breath", "label": "Дыхание литейной", "src": {"zzfx": [0.45, 0.08, 98, 0.2, 0.35, 0.65, 3, 1, 1, 0, 0, 0, 0, 0, 0.1, 0, 0, 0.55, 1, 0]}, "loop": True},
    {"id": "snd_resonance", "label": "Резонанс свода", "src": {"zzfx": [0.42, 0.05, 148, 0.15, 0.3, 0.9, 0, 0, 2, 0, 0, 0.1, 0.25, 0, 0, 0, 0.03, 0.55, 1, 0]}, "loop": True},
    {"id": "sfx_click", "label": "Щелчок латунной кнопки", "src": {"zzfx": [0.7, 0.04, 810, 0, 0.02, 0.08, 1, 1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0.5, 1, 0]}},
    {"id": "sfx_door", "label": "Тяжёлая дверь", "src": {"zzfx": [0.55, 0.1, 110, 0, 0.06, 0.28, 3, 0.4, -1, 0, 0, 0, 0.1, 0, 0, 0, 0, 0.55, 1, 0]}},
    {"id": "sfx_pickup", "label": "Поднять улику", "src": {"zzfx": [0.55, 0.02, 540, 0, 0.03, 0.16, 1, 1.5, 2, 0, 0, 0, 0, 0, 0, 0, 0, 0.5, 1, 0]}},
    {"id": "sfx_impact", "label": "Удар по бронзе", "src": {"zzfx": [0.65, 0.08, 180, 0, 0.04, 0.3, 3, 0.7, -3, 0, 0, 0.1, 0.08, 0, 0.2, 0, 0, 0.6, 1, 0]}},
    {"id": "sfx_alarm", "label": "Тревожный звон", "src": {"zzfx": [0.55, 0.04, 620, 0.03, 0.1, 0.42, 2, 0.3, 2, 0, 0, 0.05, 0.2, 0, 0, 0, 0, 0.55, 1, 0]}},
]

music_tracks = [
    {"id": "music_menu", "label": "Тема Нижнего Лиорна", "src": {"mood": "таинственная", "tempo": 62, "key": "D", "scale": "минор", "layers": ["пад-аккорды", "арпеджио"], "progression": ["i", "VI", "iv", "V"], "seed": 411}, "volume": 0.7, "loop": True},
    {"id": "music_dock", "label": "Часовая пристань", "src": {"mood": "тревожная", "tempo": 70, "key": "A", "scale": "фригийский", "layers": ["пад-аккорды", "бас"], "progression": ["i", "II", "i", "v"], "seed": 217}, "volume": 0.72, "loop": True},
    {"id": "music_records", "label": "Архивный гул", "src": {"mood": "таинственная", "tempo": 74, "key": "C", "scale": "минор", "layers": ["пад-аккорды", "арпеджио"], "progression": ["i", "VII", "VI", "VII"], "seed": 963}, "volume": 0.68, "loop": True},
    {"id": "music_tunnels", "label": "Вода и медь", "src": {"mood": "тревожная", "tempo": 58, "key": "E", "scale": "дорийский", "layers": ["пад-аккорды", "бас"], "progression": ["i", "IV", "i", "VII"], "seed": 145}, "volume": 0.72, "loop": True},
    {"id": "music_foundry", "label": "Литейная под кожей", "src": {"mood": "таинственная", "tempo": 78, "key": "F", "scale": "минор", "layers": ["пад-аккорды", "бас", "перкуссия"], "progression": ["i", "VI", "II", "V"], "seed": 329}, "volume": 0.74, "loop": True},
    {"id": "music_core", "label": "Чёрный свод", "src": {"mood": "торжественная", "tempo": 54, "key": "B", "scale": "фригийский", "layers": ["пад-аккорды", "арпеджио", "бас"], "progression": ["i", "II", "VI", "V"], "seed": 808}, "volume": 0.78, "loop": True},
    {"id": "music_fight", "label": "Сталь и печать", "src": {"mood": "боевая", "tempo": 96, "key": "G", "scale": "минор", "layers": ["бас", "перкуссия", "пад-аккорды"], "progression": ["i", "VII", "VI", "V"], "seed": 505}, "volume": 0.8, "loop": True},
]

ends = [
    {"id": "ending_communal", "label": "Общий голос", "title": "Имена возвращаются", "text": "Печати теряют силу. Голоса выходят из бронзового сердца и распределяют нагрузку свода между теми, кто согласился услышать их. На ярусах гаснут лампы, но впервые люди знают, что именно поддерживало свет.", "tone": "victory", "on": "victory", "conditions": [{"type": "flag_set", "flag": "ending_communal"}]},
    {"id": "ending_cut", "label": "Долгая ночь", "title": "Свод погас", "text": "Герой размыкает сердечник. Колокол умолкает, перепись перестаёт терять людей, и над городом впервые слышна буря. В темноте Нижний Лиорн должен будет заново решить, чего стоит его безопасность.", "tone": "neutral", "on": "victory", "conditions": [{"type": "flag_set", "flag": "ending_cut"}]},
    {"id": "ending_cover", "label": "Тихая подпись", "title": "Город просыпается прежним", "text": "Дело исчезает в архиве вместе с доказательствами. Лампы горят, улицы получают тепло, а следующая перепись уже ждёт своей печати. Сава благодарит героя так, будто прощает его.", "tone": "neutral", "on": "victory", "conditions": [{"type": "flag_set", "flag": "ending_cover"}]},
    {"id": "ending_steel", "label": "Сталь вместо слова", "title": "Сердце без хранителя", "text": "Сава падает у панели. Защитный свод ещё держится, но голос колокола больше некому направлять. На рассвете Ирина уносит копии приказа; никто не знает, сколько времени осталось у света.", "tone": "victory", "on": "victory", "conditions": [{"type": "flag_set", "flag": "ending_steel"}]},
    {"id": "ending_death", "label": "Пепел без свидетеля", "title": "Дело оборвано", "text": "В журнале появляется ещё одна короткая запись. На этот раз её никто не успевает вычеркнуть.", "tone": "death", "on": "death"},
]

campaign = {
    "id": "9fddf7e4-2333-4526-885b-8dea00c0b743",
    "title": "Колокол без имени",
    "version": "0.1.0",
    "engine_version": "0.8.0",
    "min_engine": "0.8.0",
    "package_format": 1,
    "author": "Создано по заданию мастера",
    "description": "Кампания на 5–7 часов: детектив о вычеркнутых жителях Нижнего Лиорна, чьи имена поддерживают защитный свод над городом.",
    "design_doc": design_doc,
    "tick_label": "час",
    "ticks_per_day": 24,
    "time_of_day": {"morning": 6, "day": 10, "evening": 18, "night": 22},
    "starting_region": "region_nizhny_liorn",
    "starting_location": "loc_clock_dock",
    "starting_scene": "scene_clock_dock",
    "starting_tick": 19,
    "needs": [
        {"id": "need_hunger", "label": "Голод", "short_label": "Голод", "description": "Сколько сил осталось после долгого пути без еды.", "max": 100, "decay_per_tick": 2, "critical_threshold": 20, "on_zero_effect": "rule_hunger_zero"},
        {"id": "need_warmth", "label": "Тепло", "short_label": "Тепло", "description": "Сопротивление холоду и пепельной буре.", "max": 100, "decay_per_tick": 4, "critical_threshold": 25,
         "decay_when": [{"type": "weather", "weather": "weather_ashfall"}, {"type": "in_location", "locations": ["loc_clock_dock", "loc_census", "loc_foundry"], "not": True}],
         "restore_per_tick": 5, "restore_when": [{"type": "in_location", "locations": ["loc_clock_dock", "loc_census", "loc_foundry"]}], "on_zero_effect": "rule_cold_zero"},
    ],
    "statuses": [
        {"id": "status_ravenous", "label": "Истощение", "short_label": "Истощён", "description": "Долгий голод делает каждое наблюдение тяжелее.", "scope": "world", "duration": 8, "skill_mods": [{"skill": "observation", "delta": -10}, {"skill": "stealth", "delta": -10}], "apply_message": "Голод мешает сосредоточиться."},
        {"id": "status_frostbite", "label": "Сильный озноб", "short_label": "Озноб", "description": "Пепельный холод мешает работать руками и держать клинок.", "scope": "world", "duration": 8, "skill_mods": [{"skill": "engineering", "delta": -10}, {"skill": "blade", "delta": -10}], "apply_message": "Пальцы немеют от холода."},
    ],
    "weathers": [{"id": "weather_ashfall", "label": "Пеплопад", "overlay": "ash", "ambient": ["snd_clockwork"]}],
    "overlay_layers": [{"id": "ash", "label": "Пепельная взвесь"}],
    "currencies": [{"id": "mark", "label": "Медная марка", "symbol": "м.", "item_id": "item_coin"}],
    "skills": [
        {"id": "observation", "label": "Наблюдательность"}, {"id": "forensics", "label": "Судебное дело"},
        {"id": "engineering", "label": "Механика"}, {"id": "stealth", "label": "Скрытность"},
        {"id": "persuade", "label": "Убеждение"}, {"id": "medicine", "label": "Первая помощь"},
        {"id": "blade", "label": "Клинок"}, {"id": "brawl", "label": "Драка"},
        {"id": "listen", "label": "Слух"}, {"id": "bargain", "label": "Торг"},
    ],
    "skill_categories": [{"id": "investigation", "label": "Расследование"}, {"id": "social", "label": "Общение"}, {"id": "survival", "label": "Выживание"}, {"id": "combat", "label": "Бой"}],
    "item_categories": [
        {"id": "food", "label": "Еда", "restores_needs": ["need_hunger"]},
        {"id": "medicine", "label": "Медицина", "restores_hp": True},
        {"id": "supply", "label": "Припасы"}, {"id": "evidence", "label": "Улики"},
        {"id": "tool", "label": "Инструменты"}, {"id": "currency", "label": "Валюта"},
        {"id": "weapon", "label": "Оружие", "is_weapon": True}, {"id": "armor", "label": "Броня", "is_armor": True},
        {"id": "misc", "label": "Разное"},
    ],
    "equipment_slots": [{"id": "weapon", "label": "Оружие"}, {"id": "armor", "label": "Броня"}],
    "slot_types": [{"id": "person", "label": "Персонаж"}, {"id": "item", "label": "Предмет"}, {"id": "prop", "label": "Механизм"}],
    "flags": [{"id": fid, "label": label, "description": desc} for fid, label, desc in flags_data],
    "emotions": [{"id": "neutral", "label": "Обычное"}, {"id": "tense", "label": "Напряжён"}, {"id": "angry", "label": "Сердит"}, {"id": "afraid", "label": "Испуган"}, {"id": "relieved", "label": "Облегчён"}, {"id": "tired", "label": "Устал"}, {"id": "calm", "label": "Спокоен"}, {"id": "amused", "label": "Насмешлив"}, {"id": "hopeful", "label": "Надеется"}],
    "factions": [
        {"id": "faction_census", "label": "Палата переписи", "base_disposition": -5, "description": "Служащие, которые ведут учёт жителей и пропусков."},
        {"id": "faction_workers", "label": "Рабочие ярусов", "base_disposition": 5, "description": "Механики, врачи и жители, поддерживающие жизнь районов."},
    ],
    "chapters": chapters,
    "dice_rules": {"critical_divisor": 5, "special_divisor": 2, "fumble_from": 96},
    "theme": {"profile": "dark-fantasy", "accent": "#bc8050", "atmosphere": True, "tokens": {"panel": "#20252b", "cards": "#343234", "inset": "#171d22", "log": "#1c2228"}},
    "music_tracks": music_tracks,
    "sounds": sound_defs,
    "ui_sounds": {"menu_music": "music_menu", "click": "sfx_click", "panel_open": "sfx_door", "panel_close": "sfx_door", "message": "sfx_click", "travel_depart": "sfx_door", "travel_arrive": "sfx_door", "scene_transition": "sfx_door", "combat_start": "sfx_alarm", "hit": "sfx_impact", "crit": "sfx_impact", "coin": "sfx_click", "quest_started": "sfx_alarm", "quest_completed": "sfx_pickup"},
    "ui_labels": {"inventory": "Полевой набор", "journal": "Дело", "map": "Ярусы", "camp": "Передышка", "codex": "Архив", "pass_turn": "Выждать", "flee": "Отступить"},
    "default_music": ["music_dock"], "combat_music": ["music_fight"],
    "max_companions": 2, "default_player": "player_hero",
    "combat": {"flee": True, "opportunity_attacks": False},
    "rest": {"hp": "1d3", "mp_full": True},
    "camping": {"ticks": 6, "ambush_chance": 0},
    "endings": ends,
}
write_json("campaign.json", campaign)

# Entities. All visual assets are native ArtDoc layers; blank portrait paths intentionally use the engine placeholder.
entities: dict[str, dict] = {}

def npc(eid: str, label: str, description: str, stats: dict, skills: dict, dialogue: str = None,
        faction: str = None, disposition: int = 0, states: list[str] = None, **more) -> dict:
    emotions = {"neutral": ""}
    for state in states or []:
        emotions[state] = ""
    data = {"id": eid, "type": "npc", "label": label, "description": description,
            "portrait": emotions, "stats": stats, "skills": skills, "equipment": {}, "inventory": [], "schedule": []}
    if dialogue:
        data["dialogue"] = f"dialogues/{dialogue}.ink"
    if faction:
        data["faction"] = faction
    if disposition:
        data["base_disposition"] = disposition
    data.update(more)
    return data


def item(eid: str, label: str, description: str, category: str, weight: float, stackable: bool,
         value: dict = None, **more) -> dict:
    data = {"id": eid, "type": "item", "category": category, "label": label, "description": description,
            "weight": weight, "stackable": stackable}
    if value is not None:
        data["value"] = value
    data.update(more)
    return data

entities["player_hero"] = npc("player_hero", "Полевой дознаватель", "Новый дознаватель Нижнего Лиорна. Знает, как читать улику, но ещё не знает, какую цену город за неё попросит.",
    {"STR": 11, "CON": 11, "SIZ": 10, "DEX": 12, "INT": 13, "POW": 12, "CHA": 11},
    {"observation": 55, "forensics": 45, "engineering": 35, "stealth": 35, "persuade": 40, "medicine": 25, "blade": 35, "brawl": 30, "listen": 45, "bargain": 30},
    states=["tense", "afraid"], inventory=[{"item": "item_coin", "quantity": 8}, {"item": "item_ration", "quantity": 2}, {"item": "item_heat_cell", "quantity": 1}, {"item": "item_inspector_baton", "quantity": 1}, {"item": "item_inspector_coat", "quantity": 1}, {"item": "item_field_lens", "quantity": 1}],
    equipment={"weapon": "item_inspector_baton", "armor": "item_inspector_coat"})

entities["npc_irma"] = npc("npc_irma", "Ирина Вель", "Дознавательница с мокрым плащом и сухим голосом. Не доверяет архиву, но не хочет превращать расследование в бунт.",
    {"STR": 10, "CON": 12, "SIZ": 10, "DEX": 13, "INT": 14, "POW": 12, "CHA": 13},
    {"observation": 50, "forensics": 45, "persuade": 55, "blade": 30, "listen": 45}, "ira", "faction_census", 10, ["tense", "relieved"], slot_type="person")
entities["npc_mika"] = npc("npc_mika", "Мика Орн", "Писарь переписи. Пальцы в чернилах, рукав надорван на месте, где обычно носят ключ от хранилища.",
    {"STR": 8, "CON": 10, "SIZ": 9, "DEX": 12, "INT": 15, "POW": 11, "CHA": 10},
    {"observation": 50, "forensics": 55, "stealth": 25, "persuade": 35, "listen": 40}, "mika", "faction_census", -15, ["afraid", "tense"], slot_type="person")
entities["npc_daya"] = npc("npc_daya", "Доктор Эда Лин", "Врач лазарета второго яруса. Работает в тепле от труб и не позволяет бумаге решать, кто ещё дышит.",
    {"STR": 9, "CON": 12, "SIZ": 10, "DEX": 12, "INT": 15, "POW": 14, "CHA": 12},
    {"medicine": 65, "observation": 45, "persuade": 45, "forensics": 40}, "daya", "faction_workers", 25, ["tired", "relieved"], slot_type="person")
entities["npc_ove"] = npc("npc_ove", "Овель «Жесть»", "Рыночный механик с медной стружкой в бороде. Продаёт то, что сам сумел починить, и цену называет до улыбки.",
    {"STR": 12, "CON": 13, "SIZ": 12, "DEX": 11, "INT": 13, "POW": 10, "CHA": 11},
    {"engineering": 65, "bargain": 55, "brawl": 40, "observation": 40}, "ove", "faction_workers", 10, ["amused", "tense"], slot_type="person",
    trader={"sells": [{"item": "item_ration", "price": 2, "stock": 6}, {"item": "item_heat_cell", "price": 3, "stock": 4}, {"item": "item_brass_wire", "price": 2, "stock": 3}, {"item": "item_bandage", "price": 2, "stock": 4}], "buys": True, "buy_rate": 0.4})
entities["npc_mira"] = npc("npc_mira", "Сестра Мира", "Хранительница подводной часовни. Говорит тихо, потому что когда-то здесь отвечали слишком многие.",
    {"STR": 8, "CON": 11, "SIZ": 9, "DEX": 11, "INT": 14, "POW": 16, "CHA": 14},
    {"listen": 70, "medicine": 35, "persuade": 55, "observation": 45}, "mira", "faction_workers", 20, ["calm", "afraid", "hopeful"], slot_type="person")
entities["npc_sel"] = npc("npc_sel", "Смотритель Сел", "Сторож галереи. Стоит слишком близко к закрытой двери и слишком далеко от своего поста.",
    {"STR": 13, "CON": 13, "SIZ": 12, "DEX": 12, "INT": 11, "POW": 12, "CHA": 9},
    {"blade": 50, "brawl": 45, "observation": 50, "persuade": 25, "stealth": 30}, "sel", "faction_census", -10, ["angry", "tense", "relieved"], slot_type="person",
    equipment={"weapon": "item_archive_knife"}, armor=1)
entities["npc_sava"] = npc("npc_sava", "Сава Рейн", "Главный архивист. Его одежда сшита лучше, чем всё вокруг, но под воротом видна полоса ожога от старой печати.",
    {"STR": 12, "CON": 12, "SIZ": 12, "DEX": 13, "INT": 16, "POW": 15, "CHA": 13},
    {"blade": 52, "brawl": 35, "persuade": 65, "observation": 55, "engineering": 40}, "sava", "faction_census", -65, ["tired", "angry", "tense"], slot_type="person",
    equipment={"weapon": "item_archive_knife"}, armor=1, morale={"below_hp_pct": 20, "flee_chance": 0})
entities["npc_bell_voice"] = npc("npc_bell_voice", "Голос колокола", "Несколько голосов, сложенных в один низкий тон. Ни один из них не помнит, сколько времени прошло.",
    {"STR": 8, "CON": 8, "SIZ": 8, "DEX": 8, "INT": 15, "POW": 18, "CHA": 14},
    {"listen": 70, "persuade": 40, "observation": 50}, "bell_voice", None, 0, ["calm", "hopeful"], slot_type="person")

# Items and interaction effects.
entities["item_coin"] = item("item_coin", "Медная марка", "Тяжёлая квадратная монета, чеканенная до того, как перестал работать верхний монетный двор.", "currency", 0.01, True, {"mark": 1})
entities["item_ration"] = item("item_ration", "Сухой паёк", "Прессованная крупа и соль в промасленной бумаге. На вкус как архивная пыль, зато не замерзает.", "food", 0.4, True, {"mark": 2},
    on_use={"effects": [{"type": "change_need", "need": "need_hunger", "delta": 35}], "consume": True, "message": "Паёк возвращает силы."}, sounds={"use": "sfx_pickup"})
entities["item_heat_cell"] = item("item_heat_cell", "Тепловая капсула", "Медная ампула с химическим сердечником. Греет ладони и дыхание несколько часов.", "medicine", 0.2, True, {"mark": 3},
    on_use={"effects": [{"type": "change_need", "need": "need_warmth", "delta": 30}, {"type": "remove_status", "target": "player", "status": "status_frostbite"}], "consume": True, "message": "Тепло возвращается в пальцы."}, sounds={"use": "sfx_pickup"})
entities["item_bandage"] = item("item_bandage", "Чистый бинт", "Скрученная полоса льняной ткани, запечатанная от пепла.", "medicine", 0.1, True, {"mark": 2}, on_use={"effects": [{"type": "change_hp", "delta": 3}], "consume": True, "message": "Бинт останавливает кровь."})
entities["item_inspector_baton"] = item("item_inspector_baton", "Дознавательская дубинка", "Короткая латунная дубинка с потёртым знаком службы.", "weapon", 1.1, False, {"mark": 1}, equip_slot="weapon", weapon_data={"skill": "blade", "damage": "1d6", "damage_bonus": False, "range": 1, "attacks_per_round": 1, "parry_capable": True, "label": "Латунная дубинка"})
entities["item_inspector_coat"] = item("item_inspector_coat", "Плотный плащ дознавателя", "Тяжёлый плащ с подкладкой из промасленного войлока.", "armor", 2.2, False, {"mark": 3}, equip_slot="armor", armor_data={"points": 1})
entities["item_archive_knife"] = item("item_archive_knife", "Архивный нож", "Узкий служебный клинок с тонким резонатором в рукояти.", "weapon", 0.8, False, {"mark": 5}, equip_slot="weapon", weapon_data={"skill": "blade", "damage": "1d6+1", "damage_bonus": False, "range": 1, "attacks_per_round": 1, "parry_capable": True, "label": "Нож с резонатором"})
entities["item_field_lens"] = item("item_field_lens", "Полевой окуляр", "Складная линза с треснутой оправой. Увеличивает следы, но не объясняет их.", "tool", 0.3, False, {"mark": 4})
entities["item_courier_body"] = item("item_courier_body", "Курьер Павел Соль", "Тело ещё не остыло. Под воротником — свежий ожог от архивной пломбы; на запястье остановившиеся часы.", "misc", 60, False,
    interact_options=[
        {"label": "Осмотреть пломбу и снять жетон", "hint": "Вещественная улика для дела.", "once": True, "effects": [{"type": "set_flag", "flag": "clue_body_seal"}, {"type": "add_item", "item": "item_sealed_token", "quantity": 1}, {"type": "add_item", "item": "item_bell_dust", "quantity": 1}, {"type": "journal_update", "quest": "quest_black_case", "text_key": "j_body"}, {"type": "unlock_codex", "entry": "codex_black_protocol"}], "message": "На обратной стороне жетона — след второго, стёртого штампа.", "sound": "pickup"},
        {"label": "Сверить остановку часов", "hint": "Наблюдательность: понять, когда часы были остановлены.", "once": True, "effects": [{"type": "skill_check_gate", "skill": "observation", "difficulty": "normal", "success_effects": [{"type": "set_flag", "flag": "clue_clock_gap"}, {"type": "add_item", "item": "item_clockwork_chip", "quantity": 1}, {"type": "show_message", "text": "Часы остановились после внесения Павла в реестр, а не до его смерти."}], "fail_effects": [{"type": "show_message", "text": "Пепел забил механизм. Одного взгляда недостаточно."}]}], "sound": "use"},
    ])
entities["item_sealed_token"] = item("item_sealed_token", "Жетон курьера", "Латунный жетон Павла Соля с двумя слоями сургуча: поверх старой отметки поставлена новая.", "evidence", 0.05, False)
entities["item_bell_dust"] = item("item_bell_dust", "Чёрная звонкая пыль", "Мелкая бронзово-серая пыль, которая вибрирует рядом с работающим механизмом.", "evidence", 0.02, True)
entities["item_clockwork_chip"] = item("item_clockwork_chip", "Осколок часовой пружины", "Сломанная пружина с отметкой мастерской подземной пристани.", "evidence", 0.03, False)
entities["item_census_terminal"] = item("item_census_terminal", "Счётный стол", "Панель переписи; карточки на ней заполняются раньше, чем люди успевают исчезнуть.", "misc", 18, False,
    interact_options=[{"label": "Сверить дублирующие строки", "hint": "Найти расхождение между переписью и лазаретом.", "once": True, "effects": [{"type": "set_flag", "flag": "clue_duplicate_record"}, {"type": "add_item", "item": "item_ledger_copy", "quantity": 1}, {"type": "journal_update", "quest": "quest_black_case", "text_key": "j_register"}, {"type": "unlock_codex", "entry": "codex_duplicate_entries"}], "message": "Три человека внесены в книгу перевода за часы до появления свидетельств о смерти.", "sound": "use"}])
entities["item_ledger_copy"] = item("item_ledger_copy", "Копия двойной строки", "Складная бумажная копия, где одна и та же подпись стоит в графах «переведён» и «умер».", "evidence", 0.04, False)
entities["item_ash_tray"] = item("item_ash_tray", "Поднос с образцом", "На ткани из лазарета остался серый осадок, похожий на звонкую пыль с тела курьера.", "misc", 2, False,
    interact_options=[{"label": "Сопоставить следы", "hint": "Сравнить медицинскую карту и образец.", "once": True, "effects": [{"type": "set_flag", "flag": "clue_transit"}, {"type": "add_item", "item": "item_ash_sample", "quantity": 1}, {"type": "journal_update", "quest": "quest_black_case", "text_key": "j_clinic"}, {"type": "unlock_codex", "entry": "codex_transit_ward"}], "message": "Образец совпадает с налётом на людях, которых в переписи называют умершими.", "sound": "use"}])
entities["item_ash_sample"] = item("item_ash_sample", "Пепельный образец", "Проба с кожи пациента, официально умершего до поступления в лазарет.", "evidence", 0.02, True)
entities["item_wire_heap"] = item("item_wire_heap", "Медный моток", "Короткий, но цельный отрезок медной проволоки среди деталей старого насоса.", "misc", 0.4, False,
    interact_options=[{"label": "Вытащить проволоку", "hint": "Компонент для резонансной катушки.", "once": True, "effects": [{"type": "add_item", "item": "item_brass_wire", "quantity": 1}, {"type": "show_message", "text": "Проволока сохранила изоляцию."}], "message": "Вы вытягиваете целый отрезок.", "sound": "pickup"}])
entities["item_brass_wire"] = item("item_brass_wire", "Медная проволока", "Кусок целой проволоки, годной для низкочастотного резонатора.", "supply", 0.2, True, {"mark": 2})
entities["item_filter_felt"] = item("item_filter_felt", "Сухой фильтровой войлок", "Чистый кусок войлока, не пропитанный пеплом. Эда может вырезать из него фильтр.", "supply", 0.3, False,
    interact_options=[{"label": "Взять войлок", "hint": "Нужен доктору в лазарете.", "once": True, "effects": [{"type": "add_item", "item": "item_filter_felt", "quantity": 1}, {"type": "show_message", "text": "Сухой войлок можно отнести Эде."}], "message": "Войлок свёрнут в промасленную бумагу.", "sound": "pickup"}])
# The scene prop is separate from the inventory component above, but IDs may not be shared. Use a scene-only pickup entity instead.
# Correct the prop/resource split with distinct IDs so the player can carry the material.
entities["item_filter_felt_prop"] = item("item_filter_felt_prop", "Сухой фильтровой войлок", "Свернутый кусок сухого фильтрового войлока, забытый среди лома.", "misc", 0.3, False,
    interact_options=[{"label": "Взять войлок", "hint": "Нужен доктору в лазарете.", "once": True, "consume": True, "effects": [{"type": "add_item", "item": "item_filter_felt", "quantity": 1}, {"type": "show_message", "text": "Сухой войлок можно отнести Эде."}], "message": "Войлок свёрнут в промасленную бумагу.", "sound": "pickup"}])
# Replace the player-carryable felt definition with a plain inventory component.
entities["item_filter_felt"] = item("item_filter_felt", "Сухой фильтровой войлок", "Чистый кусок войлока, не пропитанный пеплом. Эда может вырезать из него фильтр.", "supply", 0.3, False)
entities["item_sump_pump"] = item("item_sump_pump", "Сливной насос", "Старый насос застыл на пол-оборота. На оси есть паз для резонансной катушки.", "misc", 25, False,
    interact_options=[{"label": "Повернуть заслонку вручную", "hint": "Механика: успех откроет сухую нишу; провал всё равно откроет её, но может поранить.", "once": True,
        "effects": [{"type": "skill_check_gate", "skill": "engineering", "difficulty": "normal", "success_effects": [{"type": "set_flag", "flag": "pump_open"}, {"type": "show_message", "text": "Насос проворачивается. За стенкой открывается сухая ниша."}], "fail_effects": [{"type": "set_flag", "flag": "pump_open"}, {"type": "change_hp", "delta": -1}, {"type": "show_message", "text": "Рычаг срывается, но заслонка открывается. Ладонь рассечена."}]}]},
     {"label": "Открыть верстак катушки", "hint": "Изготовление можно открыть и у Овеля.", "effects": [{"type": "open_craft", "recipe": "recipe_resonance_coil"}]}])
entities["item_resonance_coil"] = item("item_resonance_coil", "Резонансная катушка", "Самодельная катушка из меди и звонкой пыли. Подходит к низкочастотным насосам.", "tool", 0.5, False)
entities["item_child_charm"] = item("item_child_charm", "Детский медальон", "На внутренней стороне выцарапано одно имя: Лин.", "evidence", 0.03, False)
entities["item_child_charm_prop"] = item("item_child_charm_prop", "Детский медальон", "Медальон застрял между камнями шлюзового моста.", "misc", 0.05, False,
    interact_options=[{"label": "Поднять медальон", "hint": "Вернуть его можно сестре Мире.", "once": True, "consume": True, "effects": [{"type": "add_item", "item": "item_child_charm", "quantity": 1}, {"type": "set_flag", "flag": "charm_found"}], "message": "Под крышкой видна царапина: «Лин». ", "sound": "pickup"}])
entities["item_black_bell"] = item("item_black_bell", "Чёрный колокол", "Бронзовый колокол под водой; язык не касается стенок, но каждый удар слышен в груди.", "misc", 100, False,
    interact_options=[{"label": "Прислушаться, не касаясь", "hint": "Запомнить голоса изнутри.", "once": True, "effects": [{"type": "set_flag", "flag": "clue_echo"}, {"type": "journal_update", "quest": "quest_black_case", "text_key": "j_echo"}, {"type": "unlock_codex", "entry": "codex_gone_names"}, {"type": "play_cutscene", "cutscene": "cutscene_echo"}], "message": "Среди гулов проступает имя Лин.", "sound": "use"}])
entities["item_gallery_bell"] = item("item_gallery_bell", "Малый колокол", "Небольшой сигнальный колокол без языка. На креплении — свежие царапины от гаечного ключа.", "misc", 10, False,
    interact_options=[{"label": "Осмотреть крепление", "hint": "Следы говорят, что ряд готовили к внеплановому звону.", "once": True, "effects": [{"type": "set_flag", "flag": "clue_clock_gap"}, {"type": "unlock_codex", "entry": "codex_clock_lattice"}], "message": "Крепление подключено к главному реле, а не к часовне."}])
entities["item_lamp_panel"] = item("item_lamp_panel", "Щит распределения", "Три цепи сходятся к одной медной жиле, уходящей ниже литейной.", "misc", 12, False,
    interact_options=[{"label": "Проследить общую линию", "hint": "Увидеть, что свет и колокол питаются от одного источника.", "once": True, "effects": [{"type": "unlock_codex", "entry": "codex_ley_lattice"}, {"type": "show_message", "text": "Нить питания уходит под архивный ярус, к Чёрному своду."}], "message": "На схеме нет отдельного источника для колокола."}])
entities["item_foundry_console"] = item("item_foundry_console", "Консоль литейной", "Счётчик нагрузки дрожит на границе красного сектора.", "misc", 16, False,
    interact_options=[{"label": "Сверить нагрузку", "hint": "Проверить, как свод удерживает пепельную бурю.", "once": True, "effects": [{"type": "unlock_codex", "entry": "codex_ley_lattice"}, {"type": "show_message", "text": "Каждый ночной удар снимает нагрузку с города, но запись списывает её с конкретных имён."}], "message": "Свод использует память как топливо."}])
entities["item_spindle_manifest"] = item("item_spindle_manifest", "Пакет распоряжений", "Папка для приказов, где часть листов переписана тонкой бумагой.", "misc", 4, False,
    interactable_when=[{"type": "flag_set", "flag": "clue_duplicate_record"}],
    interact_options=[{"label": "Сверить подпись с двойной записью", "hint": "Сначала нужно найти подмену в переписи.", "once": True, "effects": [{"type": "set_flag", "flag": "clue_authorization"}, {"type": "set_flag", "flag": "core_open"}, {"type": "add_item", "item": "item_core_pass", "quantity": 1}, {"type": "reveal_location", "location": "loc_core"}, {"type": "journal_update", "quest": "quest_black_case", "text_key": "j_authorization"}, {"type": "unlock_codex", "entry": "codex_sava_order"}], "message": "Сава подписал перенос жителей. На обороте — пропуск к сердцу свода."}])
entities["item_core_pass"] = item("item_core_pass", "Пропуск к сердцу", "Печать с личной подписью Савы Рейна. Защитная пластина пропуска ещё тёплая.", "evidence", 0.05, False)
entities["item_radio_box"] = item("item_radio_box", "Старый приёмник", "Приёмник ловит только механический фон колокола; иногда между щелчками слышно дыхание.", "misc", 4, False,
    interact_options=[{"label": "Поймать частоту ночного сигнала", "hint": "Послушать запись до начала дела.", "once": True, "effects": [{"type": "unlock_codex", "entry": "codex_clock_lattice"}, {"type": "show_message", "text": "Каждый удар состоит из коротких пауз, похожих на попытки назвать имя."}], "message": "В помехах на мгновение слышится чей-то вдох."}])
entities["item_unposted_letter"] = item("item_unposted_letter", "Непосланное письмо", "Письмо жителя, которого перепись перевела в другой ярус. В конце осталось место для имени, но подпись отсутствует.", "evidence", 0.04, False)
entities["item_unposted_letter_prop"] = item("item_unposted_letter_prop", "Сложенное письмо", "Пожелтевший лист спрятан под краем стола в комнате дознавателя.", "misc", 0.02, False,
    interact_options=[
        {"label": "Поднять письмо и внести в дело", "hint": "Если Мика уже просил помощи, запись появится в его поручении.", "conditions": [{"type": "flag_set", "flag": "side_letter_started"}], "once": True, "consume": True, "effects": [{"type": "add_item", "item": "item_unposted_letter", "quantity": 1}, {"type": "set_flag", "flag": "letter_found"}, {"type": "journal_update", "quest": "quest_unposted_letter", "text_key": "j_letter_found"}], "message": "Письмо не отправлено; на полях видна пометка Мики."},
        {"label": "Спрятать письмо в папку", "hint": "Можно разобраться с ним позже.", "conditions": [{"type": "flag_not_set", "flag": "side_letter_started"}], "once": True, "consume": True, "effects": [{"type": "add_item", "item": "item_unposted_letter", "quantity": 1}, {"type": "set_flag", "flag": "letter_found"}], "message": "Вы убираете письмо в полевую папку."},
    ])
for eid, data in entities.items():
    write_json(f"entities/{eid}.json", data)
entities_manifest = [f"{eid}.json" for eid in entities]

# Quests; journal keys are deliberately independent from stage ids.
quests = {
    "quest_black_case": {
        "id": "quest_black_case", "label": "Дело о пустом имени", "description": "Установить, почему жители исчезают из Нижнего Лиорна, и решить судьбу Чёрного звона.",
        "chapter": "chapter_one",
        "journal_entries": {
            "j_open": "Ирина поручила проверить смерть курьера Павла Соля и пропажу людей из переписи.",
            "j_body": "На теле курьера — свежая архивная пломба. Его часы остановились после записи о смерти.",
            "j_register": "В переписи одни и те же жители числятся переведёнными и умершими до того, как их нашли.",
            "j_clinic": "Врач подтверждает: часть «умерших» ещё дышит. Пепельный след совпадает с уликой курьера.",
            "j_echo": "Чёрный колокол хранит голоса людей, чьи имена вычеркнули.",
            "j_authorization": "Архивная копия или свидетельство подтверждает, что Сава распорядился о переносе людей. Получен проверенный допуск к сердцу свода.",
            "j_core": "В Чёрном своде выяснилось, что память пропавших поддерживает защитный купол.",
            "j_end_communal": "Имена освобождены, а будущая защита города больше не принадлежит одному архиву.",
            "j_end_cut": "Свод отключён. Тайная перепись остановлена, но город остался без света и защиты.",
            "j_end_cover": "Доказательства спрятаны. Город сохранит порядок и прежнюю цену за тепло.",
            "j_end_steel": "Сава пал в бою. Чёрный свод остался без хранителя.",
            "j_end_death": "Дознаватель погиб, не успев закрыть дело.",
        },
        "stages": [
            {"id": "stage_case_active", "label": "Расследование открыто", "on_enter_effects": [{"type": "journal_update", "quest": "quest_black_case", "text_key": "j_open"}]},
            {"id": "stage_case_communal", "label": "Общий голос", "final": True, "outcome": "success", "on_enter_effects": [{"type": "journal_update", "quest": "quest_black_case", "text_key": "j_end_communal"}]},
            {"id": "stage_case_cut", "label": "Долгая ночь", "final": True, "outcome": "success", "on_enter_effects": [{"type": "journal_update", "quest": "quest_black_case", "text_key": "j_end_cut"}]},
            {"id": "stage_case_cover", "label": "Тихая подпись", "final": True, "outcome": "success", "on_enter_effects": [{"type": "journal_update", "quest": "quest_black_case", "text_key": "j_end_cover"}]},
            {"id": "stage_case_steel", "label": "Сталь вместо слова", "final": True, "outcome": "success", "on_enter_effects": [{"type": "journal_update", "quest": "quest_black_case", "text_key": "j_end_steel"}]},
            {"id": "stage_case_death", "label": "Дело оборвано", "final": True, "outcome": "failure", "on_enter_effects": [{"type": "journal_update", "quest": "quest_black_case", "text_key": "j_end_death"}]},
        ]
    },
    "quest_filter": {
        "id": "quest_filter", "label": "Фильтр для лазарета", "description": "Найти сухой войлок и помочь Эде подготовить запасной пепельный фильтр.", "chapter": "chapter_two",
        "journal_entries": {"j_filter_start": "Эда просит сухой войлок для фильтра лазарета.", "j_filter_done": "Войлок передан Эде. Пациенты получат ещё несколько часов чистого воздуха."},
        "stages": [
            {"id": "stage_filter_active", "label": "Найти войлок", "on_enter_effects": [{"type": "journal_update", "quest": "quest_filter", "text_key": "j_filter_start"}]},
            {"id": "stage_filter_done", "label": "Фильтр собран", "final": True, "outcome": "success", "on_enter_effects": [{"type": "journal_update", "quest": "quest_filter", "text_key": "j_filter_done"}]},
        ]
    },
    "quest_name": {
        "id": "quest_name", "label": "Имя в воде", "description": "Вернуть сестре Мире медальон и произнести имя, пока голос ещё слышен.", "chapter": "chapter_three",
        "journal_entries": {"j_name_start": "Мира просит найти на шлюзовом мосту медальон с именем ребёнка.", "j_name_charm": "На медальоне выцарапано имя Лин.", "j_name_done": "Мира приняла медальон. Один голос в колоколе впервые ответил сам себе."},
        "stages": [
            {"id": "stage_name_active", "label": "Найти имя", "on_enter_effects": [{"type": "journal_update", "quest": "quest_name", "text_key": "j_name_start"}]},
            {"id": "stage_name_done", "label": "Имя возвращено", "final": True, "outcome": "success", "on_enter_effects": [{"type": "journal_update", "quest": "quest_name", "text_key": "j_name_done"}]},
        ]
    },
    "quest_unposted_letter": {
        "id": "quest_unposted_letter", "label": "Письмо без адреса", "description": "Вернуть Мике письмо, которое он спрятал после того, как перепись закрыла дело его автора.", "chapter": "chapter_two",
        "journal_entries": {"j_letter_start": "Мика просит проверить комнату дознавателя: туда принесли письмо, которого не должно быть в архиве.", "j_letter_found": "Письмо найдено. В нём житель просил не стирать имя своей сестры.", "j_letter_done": "Мика принимает письмо и даёт показания о распоряжении Савы."},
        "stages": [
            {"id": "stage_letter_active", "label": "Найти письмо", "on_enter_effects": [{"type": "journal_update", "quest": "quest_unposted_letter", "text_key": "j_letter_start"}]},
            {"id": "stage_letter_done", "label": "Мика свидетельствует", "final": True, "outcome": "success", "on_enter_effects": [{"type": "journal_update", "quest": "quest_unposted_letter", "text_key": "j_letter_done"}]},
        ]
    },
}
for qid, q in quests.items():
    write_json(f"quests/{qid}.json", q)

# Rules. Encounter tables are in their own section and never appear in this manifest list.
rules = {
    "rule_opening": {"id": "rule_opening", "label": "Начало ночного дела", "once": True, "conditions": [{"type": "tick_elapsed", "min_tick": 0}], "effects": [{"type": "set_weather", "weather": "weather_ashfall"}, {"type": "set_flag", "flag": "case_started"}, {"type": "start_quest", "quest": "quest_black_case"}, {"type": "play_cutscene", "cutscene": "cutscene_intro"}], "chapter": "chapter_one"},
    "rule_hunger_zero": {"id": "rule_hunger_zero", "label": "Сильный голод", "once": True, "manual": True, "conditions": [], "effects": [{"type": "apply_status", "target": "player", "status": "status_ravenous", "duration": 8}, {"type": "show_message", "text": "На пустой желудок труднее замечать детали."}]},
    "rule_cold_zero": {"id": "rule_cold_zero", "label": "Сильный озноб", "once": True, "manual": True, "conditions": [], "effects": [{"type": "apply_status", "target": "player", "status": "status_frostbite", "duration": 8}, {"type": "show_message", "text": "Холод сводит пальцы; лучше найти крышу или тепло."}]},
    "rule_filter_complete": {"id": "rule_filter_complete", "label": "Передать войлок Эде", "once": True, "manual": True, "conditions": [{"type": "quest_at_stage", "quest": "quest_filter", "stage": "stage_filter_active"}, {"type": "has_item", "item": "item_filter_felt"}], "effects": [{"type": "remove_item", "item": "item_filter_felt", "quantity": 1}, {"type": "add_item", "item": "item_heat_cell", "quantity": 2}, {"type": "set_flag", "flag": "side_filter_helped"}, {"type": "advance_quest", "quest": "quest_filter", "stage": "stage_filter_done"}, {"type": "show_message", "text": "Эда собрала фильтр и отдаёт две тепловые капсулы."}], "chapter": "chapter_two"},
    "rule_letter_return": {"id": "rule_letter_return", "label": "Мика принимает письмо", "once": True, "manual": True, "conditions": [{"type": "quest_at_stage", "quest": "quest_unposted_letter", "stage": "stage_letter_active"}, {"type": "has_item", "item": "item_unposted_letter"}], "effects": [{"type": "remove_item", "item": "item_unposted_letter", "quantity": 1}, {"type": "set_flag", "flag": "side_letter_delivered"}, {"type": "advance_quest", "quest": "quest_unposted_letter", "stage": "stage_letter_done"}, {"type": "change_disposition", "target": "npc_mika", "delta": 15}, {"type": "set_flag", "flag": "clue_authorization"}, {"type": "set_flag", "flag": "core_open"}, {"type": "reveal_location", "location": "loc_core"}, {"type": "journal_update", "quest": "quest_black_case", "text_key": "j_authorization"}, {"type": "unlock_codex", "entry": "codex_sava_order"}, {"type": "unlock_codex", "entry": "codex_unposted_names"}, {"type": "show_message", "text": "Мика подписывает показания о приказе Савы и подтверждает безопасный маршрут к сердцу свода."}], "chapter": "chapter_two"},
    "rule_name_return": {"id": "rule_name_return", "label": "Вернуть медальон Мире", "once": True, "manual": True, "conditions": [{"type": "quest_at_stage", "quest": "quest_name", "stage": "stage_name_active"}, {"type": "has_item", "item": "item_child_charm"}], "effects": [{"type": "remove_item", "item": "item_child_charm", "quantity": 1}, {"type": "set_flag", "flag": "side_echo_saved"}, {"type": "advance_quest", "quest": "quest_name", "stage": "stage_name_done"}, {"type": "unlock_codex", "entry": "codex_gone_names"}, {"type": "show_message", "text": "Мира прижимает медальон к колоколу. Один голос называет себя Лином."}], "chapter": "chapter_three"},
    "rule_record_echo": {"id": "rule_record_echo", "label": "Записать услышанный голос", "once": True, "manual": True, "conditions": [{"type": "flag_set", "flag": "clue_echo"}], "effects": [{"type": "journal_update", "quest": "quest_black_case", "text_key": "j_echo"}], "chapter": "chapter_three"},
    "rule_guard_access": {"id": "rule_guard_access", "label": "Свидетельство Села", "once": True, "manual": True, "conditions": [{"type": "flag_set", "flag": "clue_duplicate_record"}, {"type": "flag_set", "flag": "clue_echo"}], "effects": [{"type": "set_flag", "flag": "guard_testimony"}, {"type": "set_flag", "flag": "clue_authorization"}, {"type": "set_flag", "flag": "core_open"}, {"type": "add_item", "item": "item_core_pass", "quantity": 1}, {"type": "reveal_location", "location": "loc_core"}, {"type": "journal_update", "quest": "quest_black_case", "text_key": "j_authorization"}, {"type": "show_message", "text": "Сел подтверждает приказ и выдаёт пропуск, оставленный у его поста."}], "chapter": "chapter_four"},
    "rule_core_arrival": {"id": "rule_core_arrival", "label": "Первый вход в Чёрный свод", "once": True, "conditions": [{"type": "player_enters_location", "location": "loc_core"}], "effects": [{"type": "set_flag", "flag": "core_reached"}, {"type": "journal_update", "quest": "quest_black_case", "text_key": "j_core"}, {"type": "play_cutscene", "cutscene": "cutscene_core"}], "chapter": "chapter_five"},
    "rule_end_communal": {"id": "rule_end_communal", "label": "Развязка: общий голос", "once": True, "manual": True, "conditions": [], "effects": [{"type": "set_flag", "flag": "ending_communal"}, {"type": "advance_quest", "quest": "quest_black_case", "stage": "stage_case_communal"}, {"type": "game_over_victory"}], "chapter": "chapter_five"},
    "rule_end_cut": {"id": "rule_end_cut", "label": "Развязка: отключить свод", "once": True, "manual": True, "conditions": [], "effects": [{"type": "set_flag", "flag": "ending_cut"}, {"type": "set_weather", "weather": ""}, {"type": "advance_quest", "quest": "quest_black_case", "stage": "stage_case_cut"}, {"type": "game_over_victory"}], "chapter": "chapter_five"},
    "rule_end_cover": {"id": "rule_end_cover", "label": "Развязка: скрыть дело", "once": True, "manual": True, "conditions": [], "effects": [{"type": "set_flag", "flag": "ending_cover"}, {"type": "advance_quest", "quest": "quest_black_case", "stage": "stage_case_cover"}, {"type": "game_over_victory"}], "chapter": "chapter_five"},
    "rule_end_fight": {"id": "rule_end_fight", "label": "Стычка с главным архивистом", "once": False, "manual": True, "conditions": [{"type": "flag_not_set", "flag": "ending_steel"}], "effects": [{"type": "start_combat", "enemies": [{"entity": "npc_sava", "count": 1}], "arena": "arena_black_vault", "intro": "Сава запечатывает дверь и поднимает нож к панели Чёрного свода.", "on_victory": [{"type": "set_flag", "flag": "ending_steel"}, {"type": "advance_quest", "quest": "quest_black_case", "stage": "stage_case_steel"}, {"type": "game_over_victory"}], "on_fled": [{"type": "show_message", "text": "Сава не преследует вас за порогом. Вы можете вернуться к разговору."}]}], "chapter": "chapter_five"},
}
for rid, rule in rules.items():
    write_json(f"rules/{rid}.json", rule)

arena = {"id": "arena_black_vault", "label": "Чёрный свод", "image": "", "canvas": {"w": 1280, "h": 720},
         "hex_grid": {"cols": 10, "rows": 6, "hex_size": 42, "offset": "odd-r", "blocked_hexes": [[4, 2], [5, 2]], "difficult_terrain": [[3, 1], [3, 4], [6, 1], [6, 4]], "cover_hexes": [[2, 2], [7, 3]]},
         "spawn_zones": {"player": {"hexes": [[1, 2], [1, 3], [2, 2]]}, "enemy": {"hexes": [[8, 2], [8, 3]]}}, "music": "music_fight"}
write_json("arenas/arena_black_vault.json", arena)

cutscene_intro = {"id": "cutscene_intro", "label": "Полый час", "music": "music_dock", "chapter": "chapter_one", "slides": [
    {"art": {"canvas": {"w": 1280, "h": 720}, "background": "#151d25", "layers": [layer("город в куполе", rect(0, 0, 1280, 720, {"gradient": {"from": "#1b2631", "to": "#10161b", "angle": 90}})), layer("купольные рёбра", ellipse(660, 830, 560, 690, None, stroke="#736147", stroke_width=13)), layer("ярусные огни", line(0, 486, 1280, 486, "#c4824a", 7)), layer("пепельный след", polygon([0, 110, 520, 214, 1010, 93, 1280, 152, 1280, 234, 730, 274, 200, 228, 0, 312], "#736f68", opacity=0.32)), layer("дальний шпиль", polygon([585, 483, 617, 198, 660, 126, 706, 198, 744, 483], "#272d32", stroke="#9c7a50", stroke_width=5)), layer("свет в окнах", ellipse(660, 323, 31, 42, "#ce8b4a", opacity=0.68))]}, "text": "Под куполом Нижнего Лиорна ночь измеряют не часами, а ударами колокола.", "duration": 7, "transition": "panzoom"},
    {"art": scene_art("scene_clock_dock", "clock", [(946, 625, "#18222a", "#a9774d")], 0, [ellipse(680, 564, 58, 21, "#4c4741"), rect(628, 509, 104, 61, "#394044", radius=16), ellipse(679, 504, 28, 28, "#a78b70")]), "text": "Сегодняшний курьер уже числится умершим. Его часы остановились позже.", "duration": 6, "transition": "fade"},
    {"art": {"canvas": {"w": 1280, "h": 720}, "background": "#181e24", "layers": [layer("пломба крупным планом", ellipse(640, 356, 193, 193, "#392e28", stroke="#b28450", stroke_width=14)), layer("двойная печать", ellipse(640, 356, 132, 132, "#8f5740", stroke="#ddbc7a", stroke_width=9)), layer("стёртый круг", ellipse(640, 356, 76, 76, "#503b32", stroke="#d9bd83", stroke_width=4)), layer("трещина", line(602, 265, 680, 451, "#272a29", 7)), layer("пепел на металле", polygon([0, 512, 248, 445, 512, 515, 837, 452, 1280, 510, 1280, 720, 0, 720], "#2a3335"))]}, "text": "Кто-то успел написать приговор раньше, чем нашёлся свидетель.", "duration": 6, "transition": "fade"},
]}
write_json("cutscenes/cutscene_intro.json", cutscene_intro)
cutscene_echo = {"id": "cutscene_echo", "label": "Голоса в бронзе", "music": "music_tunnels", "chapter": "chapter_three", "slides": [
    {"art": {"canvas": {"w": 1280, "h": 720}, "background": "#19242a", "layers": [layer("вода", polygon([0, 450, 1280, 420, 1280, 720, 0, 720], "#1c343b")), layer("бронзовый колокол", polygon([486, 316, 532, 203, 591, 164, 689, 164, 749, 203, 795, 316, 770, 355, 510, 355], "#927146", stroke="#d4ad69", stroke_width=8)), layer("отражение", ellipse(641, 488, 207, 44, "#827053", opacity=0.38)), layer("свет из щели", ellipse(644, 272, 34, 84, "#b7d1b3", opacity=0.5)), layer("эхо", ellipse(640, 356, 315, 268, None, stroke="#75958d", stroke_width=4, opacity=0.38)), layer("эхо", ellipse(640, 356, 400, 315, None, stroke="#75958d", stroke_width=3, opacity=0.25))]}, "text": "Внутри колокола слышится не удар, а дыхание людей, которых город назвал мёртвыми.", "duration": 8, "transition": "panzoom"},
]}
write_json("cutscenes/cutscene_echo.json", cutscene_echo)
cutscene_core = {"id": "cutscene_core", "label": "Подпись Савы", "music": "music_core", "chapter": "chapter_five", "slides": [
    {"art": {"canvas": {"w": 1280, "h": 720}, "background": "#10171c", "layers": [layer("медная схема", ellipse(640, 350, 245, 245, "#1c252a", stroke="#aa8051", stroke_width=13)), layer("сердцевина", ellipse(640, 350, 157, 157, "#202e31", stroke="#83a89c", stroke_width=8)), layer("центр", ellipse(640, 350, 59, 59, "#c57a48", opacity=0.84)), layer("жила слева сверху", line(170, 200, 487, 300, "#a87647", 9)), layer("жила справа сверху", line(790, 305, 1110, 190, "#a87647", 9)), layer("жила слева снизу", line(180, 510, 482, 408, "#a87647", 9)), layer("жила справа снизу", line(800, 409, 1097, 529, "#a87647", 9)), layer("пепельный свет", ellipse(643, 350, 322, 324, "#b27b48", opacity=0.1))]}, "text": "Здесь становится ясно: Чёрный звон держится на именах и памяти людей.", "duration": 8, "transition": "fade"},
    {"art": {"canvas": {"w": 1280, "h": 720}, "background": "#161a1f", "layers": [layer("два силуэта у панели", polygon([335, 618, 395, 342, 469, 311, 534, 618], "#1b2429")), layer("силуэт архивиста", polygon([794, 619, 828, 334, 913, 295, 990, 619], "#25272a")), layer("свет печати", ellipse(642, 383, 135, 135, "#b9814a", opacity=0.26)), layer("провода", line(126, 220, 1150, 531, "#8f704d", 6)), layer("провода", line(122, 513, 1127, 202, "#69877e", 5)), layer("внутренний огонь", ellipse(640, 376, 44, 44, "#db9954", opacity=0.76))]}, "text": "Решение не исправит прошлое. Оно только определит, кто услышит следующий удар.", "duration": 8, "transition": "fade"},
]}
write_json("cutscenes/cutscene_core.json", cutscene_core)

# Codex entries unlock as the player finds evidence.
codex = {
    "codex_black_protocol": {"id": "codex_black_protocol", "label": "Чёрный протокол", "category": "chronicles", "text": "Ведомость смерти иногда появляется раньше самой смерти. Служебная печать стирает старую запись, но под сургучом остаётся двойной круг."},
    "codex_duplicate_entries": {"id": "codex_duplicate_entries", "label": "Двойная строка", "category": "chronicles", "text": "Перевод и смерть — две отметки в одной книге. Имена людей попадают в обе графы до ночного звона; рядом стоит один и тот же архивный знак."},
    "codex_transit_ward": {"id": "codex_transit_ward", "label": "Лазарет перевода", "category": "places", "text": "Пациенты, которых перепись объявила умершими, продолжают дышать. Их пепельный след совпадает с бронзовой пылью на теле курьера."},
    "codex_gone_names": {"id": "codex_gone_names", "label": "Имена в воде", "category": "chronicles", "text": "Чёрный колокол удерживает голоса вычеркнутых жителей. Когда кто-то называет одно из имён без приказа и печати, голос отвечает сам."},
    "codex_clock_lattice": {"id": "codex_clock_lattice", "label": "Часовая решётка", "category": "places", "text": "Малые колокола соединены с главным часовым реле. Они не задают время: они распределяют нагрузку и короткие сигналы по ярусам."},
    "codex_ley_lattice": {"id": "codex_ley_lattice", "label": "Сеть света", "category": "places", "text": "Лампы и защитный свод запитаны от одной глубокой жилы. Чёрный звон не освещает город напрямую — он несёт его память в старую систему защиты."},
    "codex_sava_order": {"id": "codex_sava_order", "label": "Приказ Савы", "category": "chronicles", "text": "Архивная копия, показания Мики и свидетельство Села сходятся: главный архивист распорядился перенести людей в сердце свода. Решение можно отменить, если город разделит нагрузку и примет память добровольно."},
    "codex_unposted_names": {"id": "codex_unposted_names", "label": "Непосланное письмо", "category": "chronicles", "text": "Автор письма не просил вернуть тело. Он просил, чтобы его сестра оставалась записанной живой, пока сама не согласится уйти. Архивный ответ на такую просьбу был вырезан, но почерк Мики остался на полях."},
}
for cid, doc in codex.items():
    write_json(f"codex/{cid}.json", doc)

recipe = {"id": "recipe_resonance_coil", "label": "Резонансная катушка", "description": "Катушка для низкочастотных механизмов из медной проволоки и звонкой пыли.",
          "inputs": [{"item": "item_brass_wire", "quantity": 1}, {"item": "item_bell_dust", "quantity": 1}], "tools": ["item_field_lens"],
          "skill": {"id": "engineering", "difficulty": "normal"}, "time_ticks": 1,
          "output": {"item": "item_resonance_coil", "quantity": 1}, "message": "Медная жила ловит ритм старого насоса."}
write_json("recipes/recipe_resonance_coil.json", recipe)

encounters = {"encounter_tables": [{"id": "enc_sluice_route", "rolls": 1, "entries": [
    {"weight": 6, "type": "nothing"},
    {"weight": 2, "type": "event", "effects": [{"type": "change_need", "need": "need_warmth", "delta": -8}, {"type": "show_message", "text": "Пепельный сквозняк проходит по переходу; тепло уходит быстрее."}], "message": "Пепельный сквозняк."},
    {"weight": 1, "type": "skill_check", "skill": "observation", "difficulty": "normal", "message": "Под камнем блеснуло что-то бронзовое.", "success_effects": [{"type": "add_item", "item": "item_bell_dust", "quantity": 1}], "fail_effects": [{"type": "change_need", "need": "need_warmth", "delta": -5}]},
]}]}
write_json("encounters/enc_routes.json", encounters)

# Ink dialogue sources. All choices use conditions before brackets; remarks/emotions are tagged.
dialogues = {
"ira": r'''EXTERNAL get_flag(flag)
EXTERNAL set_flag(flag)
EXTERNAL change_disposition(target, delta)

=== Начало ===
Ирина: «Вы из дознавателей? Хорошо. Пока этот состав не ушёл, у нас есть минут десять до того, как кто-нибудь назовёт тело несчастным случаем.» # emotion: tense
-> Варианты_у_платформы

=== Варианты_у_платформы ===
+ { not (get_flag("case_briefing")) } [Я принимаю поручение.]
    ~ set_flag("case_briefing")
    ~ change_disposition("npc_irma", 5)
    Ирина выдыхает и передаёт вам мокрую папку. # action
    Ирина: «Тогда смотрите не на то, что написано. Смотрите, кто успел это написать.» # emotion: relieved
    -> Варианты_у_платформы
+ [Что было с курьером?]
    Ирина: «Павел Соль. Он носил сообщения между ярусами. Последний раз его видели у палаты переписи; официальный журнал утверждает, что он умер раньше.»
    -> Варианты_у_платформы
+ { get_flag("clue_body_seal") } [Я нашёл двойную пломбу.]
    Ирина: «Значит, он вёз что-то, чего не должно существовать. Не отдавайте жетон архиву.»
    -> Варианты_у_платформы
+ [Почему люди исчезают после звона?]
    Ирина: «После удара кого-то не находят. После второго уже никто не спрашивает. Не верьте словам “переведён” и “умер” без свидетеля.»
    -> Варианты_у_платформы
+ [Куда идти сначала?]
    Ирина: «В перепись. Потом — к врачу. Если оба говорят одно и то же, значит кто-то заранее раздал им одну и ту же ложь.»
    -> Варианты_у_платформы
+ [Уйти в служебный коридор.]
    -> DONE
''',
"mika": r'''EXTERNAL get_flag(flag)
EXTERNAL set_flag(flag)
EXTERNAL start_quest(quest)
EXTERNAL has_item(item)
EXTERNAL fire_rule(rule)
EXTERNAL change_disposition(target, delta)

=== Начало ===
Мика: «Если вы пришли за печатью, очередь у двери. Если за правдой — её здесь не выдают.» # emotion: afraid
-> Варианты_архива

=== Варианты_архива ===
+ [Как устроена перепись?]
    Мика: «Сначала вносят перевод. Потом приходит отметка о смерти. Между ними должны быть подпись врача и имя свидетеля.»
    -> Варианты_архива
+ { get_flag("clue_duplicate_record") } [Я видел двойную строку.]
    ~ change_disposition("npc_mika", 5)
    Мика: «Тогда вы видели и мой почерк. Я переписывал только даты. Имена выбирал не я.» # emotion: tense
    -> Варианты_архива
+ [Кто подписывает перенос?]
    Мика медлит, затем указывает на пустую графу в журнале. # action
    Мика: «Архивист. Но подпись ставят на отдельном листе; потом его уносят вниз.»
    -> Варианты_архива
+ [Вы боитесь Саву?]
    Мика: «Я боюсь, что он прав. От этого его приказ не становится законным.»
    -> Варианты_архива
+ { get_flag("clue_duplicate_record") and not (get_flag("side_letter_started")) } [Есть другой свидетель?]
    ~ set_flag("side_letter_started")
    ~ start_quest("quest_unposted_letter")
    Мика: «В вашей комнате лежит письмо. Его автор умер только в переписи. Я спрятал его, потому что не решился оставить в архиве.» # emotion: tense
    -> Варианты_архива
+ { get_flag("side_letter_started") and get_flag("letter_found") and has_item("item_unposted_letter") } [Я нашёл письмо.]
    ~ fire_rule("rule_letter_return")
    Мика: «Теперь я подпишу показания. Не потому что перестал бояться — потому что письмо нельзя снова отложить.» # emotion: relieved
    -> Варианты_архива
+ { get_flag("side_letter_delivered") } [Что было в письме?]
    Мика: «Автор просил оставить сестру в живых хотя бы на бумаге. Я спрятал письмо, а должен был приложить его к делу.»
    -> Варианты_архива
+ [К рынку квот.]
    -> DONE
''',
"daya": r'''EXTERNAL get_flag(flag)
EXTERNAL set_flag(flag)
EXTERNAL start_quest(quest)
EXTERNAL has_item(item)
EXTERNAL fire_rule(rule)

=== Начало ===
Эда: «Не называйте их мёртвыми при мне. Они просто перестали числиться живыми в нужной книге.» # emotion: tired
-> Варианты_лазарета

=== Варианты_лазарета ===
+ [Что вы можете подтвердить?]
    Эда: «У троих пациентов нет сознания, но есть дыхание. Пепельный осадок на коже совпадает с тем, что принесли на пристань.»
    -> Варианты_лазарета
+ { not (get_flag("side_filter_started")) } [Помочь с фильтром.]
    ~ set_flag("side_filter_started")
    ~ start_quest("quest_filter")
    Эда: «Во дворе жестянщика есть сухой войлок. Принесите кусок — я дам вам тепловые капсулы.»
    -> Варианты_лазарета
+ { get_flag("side_filter_started") and has_item("item_filter_felt") } [Вот сухой войлок.]
    ~ fire_rule("rule_filter_complete")
    Эда: «Этого хватит. Подождите у двери, я не хочу, чтобы вы дышали этой пылью.»
    -> Варианты_лазарета
+ [Почему перепись ставит отметку заранее?]
    Эда: «Потому что это не медицинская запись. Кто-то готовит пустую койку до того, как в неё положат человека.»
    -> Варианты_лазарета
+ [Вернуться в палату переписи.]
    -> DONE
''',
"ove": r'''EXTERNAL get_flag(flag)
EXTERNAL open_trade(npc)
EXTERNAL open_craft(recipe)
EXTERNAL change_disposition(target, delta)

=== Начало ===
Овель: «Сразу предупреждаю: мои вещи не греют бесплатно. Мои советы — иногда.» # emotion: amused
-> Варианты_рынка

=== Варианты_рынка ===
+ [Покажи припасы.]
    ~ open_trade("npc_ove")
    -> DONE
+ [Собрать резонансную катушку.]
    ~ open_craft("recipe_resonance_coil")
    -> DONE
+ [Что не так со сливным насосом?]
    Овель: «Его нельзя тянуть силой. Он слушает низкий тон. Медная жила, звонкая пыль — и, если повезёт, он вспомнит свою работу.»
    -> Варианты_рынка
+ { get_flag("clue_body_seal") } [На жетоне курьера двойной сургуч.]
    ~ change_disposition("npc_ove", 5)
    Овель: «Значит, это уже не слух. Такой сургуч ставят только в палате переписи.»
    -> Варианты_рынка
+ [Почему вы остались здесь?]
    Овель: «Пока насос дышит, люди могут пить. Пока люди могут пить, рынку есть кому платить.»
    -> Варианты_рынка
+ [Уйти во двор с ломом.]
    -> DONE
''',
"mira": r'''EXTERNAL get_flag(flag)
EXTERNAL set_flag(flag)
EXTERNAL start_quest(quest)
EXTERNAL has_item(item)
EXTERNAL fire_rule(rule)
EXTERNAL change_disposition(target, delta)
EXTERNAL set_dialogue_timer(seconds, node)
EXTERNAL unlock_codex(entry)

=== Начало ===
Мира: «Если вы слышите звон — не отвечайте сразу. Сначала спросите, кто ещё его слышит.» # emotion: calm
-> Варианты_часовни

=== Варианты_часовни ===
+ [Что находится внутри колокола?]
    Мира: «То, что осталось от людей, когда перепись закрыла их имена. Не души, наверное. Но и не пустота.»
    -> Варианты_часовни
+ [Какой голос вы ждёте?]
    Мира: «Лин. Его медальон пропал на шлюзовом мосту. Я не прошу вернуть ребёнка. Я прошу вернуть имя.»
    -> Варианты_часовни
+ { not (get_flag("side_name_started")) } [Я поищу медальон.]
    ~ set_flag("side_name_started")
    ~ start_quest("quest_name")
    ~ change_disposition("npc_mira", 5)
    Мира закрывает глаза, будто слышит далёкий ответ. # action
    Мира: «Тогда не торопитесь. Здесь спешка звучит как приказ.»
    -> Варианты_часовни
+ { get_flag("side_name_started") and has_item("item_child_charm") } [Отдать медальон с именем Лин.]
    ~ fire_rule("rule_name_return")
    Мира: «Теперь у него есть имя, которое принадлежит не переписи.» # emotion: hopeful
    -> Варианты_часовни
+ { not (get_flag("clue_echo")) and not (get_flag("echo_lost")) } [Послушать голос ближе.]
    -> Имя_в_тумане
+ [Уйти к шлюзу.]
    -> DONE

=== Имя_в_тумане ===
Вода поднимается на один палец. Из колокола доносится короткий вдох. # action
-> Выбор_имени

=== Выбор_имени ===
~ set_dialogue_timer(15, "Тишина")
+ [Лин. Я слышу тебя.]
    ~ set_dialogue_timer(0, "")
    ~ set_flag("clue_echo")
    ~ fire_rule("rule_record_echo")
    ~ set_flag("echo_named")
    ~ unlock_codex("codex_gone_names")
    Мира: «Он ответил. Запишите это, пока кто-нибудь не решил, что ответа не было.» # emotion: hopeful
    -> Варианты_часовни
+ [Я не буду говорить за него.]
    ~ set_dialogue_timer(0, "")
    Мира: «Тогда хотя бы запомните тишину. Она тоже свидетель.»
    -> Варианты_часовни

=== Тишина ===
~ set_flag("echo_lost")
Мира: «Голос ушёл глубже. Я не стану говорить, что он простил нас.» # emotion: afraid
-> Варианты_часовни
''',
"sel": r'''EXTERNAL get_flag(flag)
EXTERNAL set_flag(flag)
EXTERNAL fire_rule(rule)
EXTERNAL change_disposition(target, delta)

=== Начало ===
Сел: «Эта галерея закрыта. Не из-за тайны. Из-за того, что тайны любят толпу.» # emotion: tense
-> Варианты_галереи

=== Варианты_галереи ===
+ [Кто приказал закрыть проход?]
    Сел: «Архив. Приказ пришёл до того, как город услышал последний удар.»
    -> Варианты_галереи
+ { get_flag("clue_duplicate_record") and get_flag("clue_echo") } [Двойная запись и голоса подтверждают приказ.]
    ~ set_flag("guard_testimony")
    ~ fire_rule("rule_guard_access")
    ~ change_disposition("npc_sel", 10)
    Сел: «Я не подпишу ваш вывод. Но пропуск на панели я тоже не замечал.»
    -> Варианты_галереи
+ { get_flag("clue_authorization") } [У меня есть подтверждение приказа Савы.]
    Сел: «Тогда спорить не с кем. Спуститесь ниже и не трогайте реле.»
    -> Варианты_галереи
+ [Вы правда верите, что город защищён?]
    Сел: «Я верю, что купол ещё держится. Для чего он держится — это уже не моя форма.»
    -> Варианты_галереи
+ [Уйти к литейной.]
    -> DONE
''',
"sava": r'''EXTERNAL get_flag(flag)
EXTERNAL fire_rule(rule)

=== Начало ===
Сава: «Вы принесли пять листов и называете их доказательством. А я принёс сюда весь город.» # emotion: tired
-> Решение

=== Решение ===
+ { get_flag("clue_body_seal") and get_flag("clue_duplicate_record") and get_flag("clue_transit") and get_flag("clue_echo") and get_flag("clue_authorization") } [Освободить имена и разделить нагрузку свода.]
    Сава долго смотрит на вашу копию приказа. # action
    ~ fire_rule("rule_end_communal")
    -> DONE
+ [Отключить сердце, даже если город погаснет.]
    ~ fire_rule("rule_end_cut")
    -> DONE
+ [Спрятать доказательства и сохранить нынешний порядок.]
    ~ fire_rule("rule_end_cover")
    -> DONE
+ [Я больше не буду слушать. Сталь вместо слов.]
    ~ fire_rule("rule_end_fight")
    -> DONE
''',
"bell_voice": r'''EXTERNAL get_flag(flag)
EXTERNAL set_flag(flag)
EXTERNAL fire_rule(rule)
EXTERNAL unlock_codex(entry)

=== Начало ===
Голос колокола: «Мы помним имена, но не помним, кто произнёс их первым.» # emotion: calm
-> Варианты_свода

=== Варианты_свода ===
+ [Вы хотите выйти наружу?]
    Голос колокола: «Мы хотим перестать быть расходной строкой.»
    -> Варианты_свода
+ { not (get_flag("clue_echo")) } [Я сохраню то, что услышал.]
    ~ set_flag("clue_echo")
    ~ fire_rule("rule_record_echo")
    ~ unlock_codex("codex_gone_names")
    Голос колокола: «Тогда у нас снова есть свидетель.» # emotion: hopeful
    -> Варианты_свода
+ [Кто решил связать вас с защитным сводом?]
    Голос колокола: «Мы не знаем первого имени. Мы знаем последнюю подпись.»
    -> Варианты_свода
+ [Оставить голоса в покое.]
    -> DONE
''',
}
for did, ink in dialogues.items():
    write_text(f"dialogues/{did}.ink", ink)

manifest = {
    "scenes": scenes_manifest,
    "entities": entities_manifest,
    "rules": [f"{rid}.json" for rid in rules],
    "arenas": ["arena_black_vault.json"],
    "quests": [f"{qid}.json" for qid in quests],
    "encounters": ["enc_routes.json"],
    "cutscenes": ["cutscene_intro.json", "cutscene_echo.json", "cutscene_core.json"],
    "recipes": ["recipe_resonance_coil.json"],
    "codex": [f"{cid}.json" for cid in codex],
    "dialogues": [f"{did}.ink" for did in dialogues],
}
write_json("manifest.json", manifest)

# Package root is the archive root: there is no source/instruction folder in the deliverable.
if OUT.exists():
    OUT.unlink()
with zipfile.ZipFile(OUT, "w", compression=zipfile.ZIP_DEFLATED, compresslevel=9) as zf:
    for path in sorted(STAGE.rglob("*")):
        if path.is_file():
            zf.write(path, path.relative_to(STAGE).as_posix())
print(f"Wrote {OUT} ({OUT.stat().st_size} bytes), {sum(1 for p in STAGE.rglob('*') if p.is_file())} package files")
