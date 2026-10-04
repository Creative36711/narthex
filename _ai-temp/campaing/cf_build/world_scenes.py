# -*- coding: utf-8 -*-
"""Мир и сцены кампании «Ржавая литургия»."""

WORLD = {
    "regions": [
        {
            "id": "region_okovina",
            "label": "Оковина",
            "map_image": "",
            "map_size": {"w": 1280, "h": 720},
            "parent_region": None,
            "map_art": {
                "canvas": {"w": 1280, "h": 720},
                "background": "#10151b",
                "layers": [
                    {"label": "снега", "shape": {"type": "rect", "x": 0, "y": 0, "w": 1280, "h": 720,
                     "fill": {"gradient": {"from": "#141a22", "to": "#202a35", "angle": 90}}}},
                    {"label": "река льда", "shape": {"type": "polygon", "points": [0, 620, 420, 560, 900, 640, 1280, 600, 1280, 720, 0, 720], "fill": "#1a2530"}},
                    {"label": "тракт верх-завод", "shape": {"type": "line", "x1": 300, "y1": 240, "x2": 700, "y2": 420, "color": "#4a3b2a", "width": 10}},
                    {"label": "тракт завод-низы", "shape": {"type": "line", "x1": 700, "y1": 420, "x2": 1000, "y2": 560, "color": "#3a2f24", "width": 8}},
                    {"label": "верхний город", "shape": {"type": "ellipse", "cx": 300, "cy": 240, "rx": 90, "ry": 60, "fill": "#2c3542", "stroke": "#5b6c80", "stroke_width": 3}},
                    {"label": "литейный", "shape": {"type": "ellipse", "cx": 700, "cy": 420, "rx": 100, "ry": 66, "fill": "#33291f", "stroke": "#7a5a33", "stroke_width": 3}},
                    {"label": "низы", "shape": {"type": "ellipse", "cx": 1000, "cy": 560, "rx": 80, "ry": 52, "fill": "#191419", "stroke": "#513a4a", "stroke_width": 3}},
                    {"label": "дым очага", "shape": {"type": "ellipse", "cx": 700, "cy": 330, "rx": 26, "ry": 60, "fill": "#8a8a8a", "opacity": 0.25}},
                    {"label": "подпись верх", "shape": {"type": "text", "x": 300, "y": 150, "text": "Верхний город", "size": 26, "color": "#9fb2c8", "align": "middle"}},
                    {"label": "подпись завод", "shape": {"type": "text", "x": 700, "y": 520, "text": "Литейный квартал", "size": 26, "color": "#c8a878", "align": "middle"}},
                    {"label": "подпись низы", "shape": {"type": "text", "x": 1010, "y": 660, "text": "Низы", "size": 26, "color": "#a887a0", "align": "middle"}},
                ],
            },
            "locations": [
                {
                    "id": "loc_verkh", "label": "Верхний город",
                    "position": {"x": 300, "y": 240},
                    "travel_connections": [
                        {"to": "loc_zavod", "cost_ticks": 2},
                    ],
                    "scenes": ["scene_office", "scene_archive", "scene_square", "scene_hospice"],
                    "arrival_scene": "scene_office",
                    "music": [{"tracks": ["music_office"], "conditions": []}],
                },
                {
                    "id": "loc_zavod", "label": "Литейный квартал",
                    "position": {"x": 700, "y": 420},
                    "travel_connections": [
                        {"to": "loc_verkh", "cost_ticks": 2},
                        {"to": "loc_nizy", "cost_ticks": 3,
                         "requirements": [{"type": "flag_set", "flag": "gate_open"}],
                         "random_encounter_table": "enc_road"},
                    ],
                    "scenes": ["scene_tavern", "scene_foundry"],
                    "arrival_scene": "scene_tavern",
                    "music": [{"tracks": ["music_foundry"], "conditions": []}],
                },
                {
                    "id": "loc_nizy", "label": "Низы",
                    "position": {"x": 1000, "y": 560},
                    "hidden": True,
                    "travel_connections": [
                        {"to": "loc_zavod", "cost_ticks": 3},
                    ],
                    "scenes": ["scene_under", "scene_heart"],
                    "arrival_scene": "scene_under",
                    "music": [{"tracks": ["music_under"], "conditions": []}],
                },
            ],
        }
    ]
}


def _art(bg, layers):
    return {"canvas": {"w": 1280, "h": 720}, "background": bg, "layers": layers}


SCENE_OFFICE = {
    "id": "scene_office", "label": "Кабинет следователя", "location": "loc_verkh",
    "chapter": "ch_1",
    "canvas": {"w": 1280, "h": 720},
    "states": [
        {"id": "state_day", "label": "Днём", "condition": {"time_of_day": ["morning", "day"]},
         "art": _art("#1a1d22", [
            {"label": "стена", "shape": {"type": "rect", "x": 0, "y": 0, "w": 1280, "h": 520, "fill": {"gradient": {"from": "#232830", "to": "#181c22", "angle": 90}}}},
            {"label": "пол", "shape": {"type": "rect", "x": 0, "y": 520, "w": 1280, "h": 200, "fill": "#2a2622"}},
            {"label": "окно", "shape": {"type": "rect", "x": 880, "y": 120, "w": 240, "h": 280, "fill": {"gradient": {"from": "#9db4c8", "to": "#5c7186", "angle": 90}}, "stroke": "#3a2f24", "stroke_width": 8}},
            {"label": "иней", "shape": {"type": "rect", "x": 880, "y": 330, "w": 240, "h": 70, "fill": "#e8f0f6", "opacity": 0.5}},
            {"label": "печь", "shape": {"type": "rect", "x": 110, "y": 300, "w": 150, "h": 220, "fill": "#3a2a22", "radius": 10}},
            {"label": "топка", "shape": {"type": "ellipse", "cx": 185, "cy": 470, "rx": 42, "ry": 30, "fill": "#d0722f"}},
            {"label": "труба", "shape": {"type": "rect", "x": 165, "y": 120, "w": 40, "h": 190, "fill": "#2c211a"}},
            {"label": "стол", "shape": {"type": "rect", "x": 500, "y": 400, "w": 340, "h": 130, "fill": "#4a3626", "radius": 6}},
            {"label": "бумаги", "shape": {"type": "rect", "x": 560, "y": 386, "w": 90, "h": 16, "fill": "#cfc6b0"}},
            {"label": "лампа", "shape": {"type": "ellipse", "cx": 750, "cy": 380, "rx": 26, "ry": 18, "fill": "#e8c060"}},
            {"label": "стул клерка", "shape": {"type": "rect", "x": 600, "y": 300, "w": 120, "h": 100, "fill": "#332619"}},
            {"label": "дверь архив", "shape": {"type": "rect", "x": 40, "y": 300, "w": 100, "h": 220, "fill": "#3d2e1f", "radius": 6}},
            {"label": "дверь площадь", "shape": {"type": "rect", "x": 1140, "y": 300, "w": 100, "h": 220, "fill": "#3d2e1f", "radius": 6}},
            {"label": "карта города", "shape": {"type": "rect", "x": 1170, "y": 60, "w": 90, "h": 70, "fill": "#8d8268", "stroke": "#3a2f24", "stroke_width": 4}},
         ])},
        {"id": "state_night", "label": "Вечером и ночью", "condition": None,
         "art": _art("#121418", [
            {"label": "стена", "shape": {"type": "rect", "x": 0, "y": 0, "w": 1280, "h": 520, "fill": {"gradient": {"from": "#181c22", "to": "#101318", "angle": 90}}}},
            {"label": "пол", "shape": {"type": "rect", "x": 0, "y": 520, "w": 1280, "h": 200, "fill": "#221e1a"}},
            {"label": "окно", "shape": {"type": "rect", "x": 880, "y": 120, "w": 240, "h": 280, "fill": {"gradient": {"from": "#1c2634", "to": "#0c1118", "angle": 90}}, "stroke": "#3a2f24", "stroke_width": 8}},
            {"label": "месяц", "shape": {"type": "ellipse", "cx": 990, "cy": 200, "rx": 30, "ry": 30, "fill": "#d8dce2", "opacity": 0.7}},
            {"label": "печь", "shape": {"type": "rect", "x": 110, "y": 300, "w": 150, "h": 220, "fill": "#3a2a22", "radius": 10}},
            {"label": "топка", "shape": {"type": "ellipse", "cx": 185, "cy": 470, "rx": 46, "ry": 34, "fill": "#e0813a"}},
            {"label": "труба", "shape": {"type": "rect", "x": 165, "y": 120, "w": 40, "h": 190, "fill": "#2c211a"}},
            {"label": "стол", "shape": {"type": "rect", "x": 500, "y": 400, "w": 340, "h": 130, "fill": "#3d2c1f", "radius": 6}},
            {"label": "лампа", "shape": {"type": "ellipse", "cx": 750, "cy": 380, "rx": 30, "ry": 20, "fill": "#f0d080"}},
            {"label": "свет лампы", "shape": {"type": "ellipse", "cx": 750, "cy": 420, "rx": 180, "ry": 90, "fill": "#e8c060", "opacity": 0.12}},
            {"label": "стул клерка", "shape": {"type": "rect", "x": 600, "y": 300, "w": 120, "h": 100, "fill": "#2a1f14"}},
            {"label": "дверь архив", "shape": {"type": "rect", "x": 40, "y": 300, "w": 100, "h": 220, "fill": "#332619", "radius": 6}},
            {"label": "дверь площадь", "shape": {"type": "rect", "x": 1140, "y": 300, "w": 100, "h": 220, "fill": "#332619", "radius": 6}},
            {"label": "карта города", "shape": {"type": "rect", "x": 1170, "y": 60, "w": 90, "h": 70, "fill": "#6d6450", "stroke": "#3a2f24", "stroke_width": 4}},
         ])},
    ],
    "slots": [
        {"id": "slot_clerk", "label": "За столом", "type": ["person"], "shape": "rect",
         "x": 600, "y": 210, "w": 130, "h": 190, "condition": None},
    ],
    "navigation": [
        {"label": "В архив", "go_to_scene": "scene_archive", "area": {"x": 40, "y": 300, "w": 100, "h": 220}},
        {"label": "На площадь", "go_to_scene": "scene_square", "area": {"x": 1140, "y": 300, "w": 100, "h": 220}},
        {"label": "На карту", "open_map": True, "area": {"x": 1170, "y": 60, "w": 90, "h": 70}},
    ],
}

SCENE_ARCHIVE = {
    "id": "scene_archive", "label": "Архив конторы", "location": "loc_verkh",
    "chapter": "ch_1",
    "canvas": {"w": 1280, "h": 720},
    "states": [
        {"id": "state_main", "label": "Архив", "condition": None,
         "art": _art("#15130f", [
            {"label": "стена", "shape": {"type": "rect", "x": 0, "y": 0, "w": 1280, "h": 560, "fill": "#1d1a14"}},
            {"label": "пол", "shape": {"type": "rect", "x": 0, "y": 560, "w": 1280, "h": 160, "fill": "#26211a"}},
            {"label": "стеллаж 1", "shape": {"type": "rect", "x": 120, "y": 120, "w": 260, "h": 440, "fill": "#3a2d1d"}},
            {"label": "полки 1", "shape": {"type": "line", "x1": 130, "y1": 240, "x2": 370, "y2": 240, "color": "#241a10", "width": 8}},
            {"label": "полки 1б", "shape": {"type": "line", "x1": 130, "y1": 380, "x2": 370, "y2": 380, "color": "#241a10", "width": 8}},
            {"label": "подшивка", "shape": {"type": "rect", "x": 180, "y": 300, "w": 120, "h": 70, "fill": "#8d8268"}},
            {"label": "стеллаж 2", "shape": {"type": "rect", "x": 480, "y": 120, "w": 260, "h": 440, "fill": "#3a2d1d"}},
            {"label": "стеллаж 3", "shape": {"type": "rect", "x": 840, "y": 120, "w": 260, "h": 440, "fill": "#332818"}},
            {"label": "свеча", "shape": {"type": "ellipse", "cx": 660, "cy": 480, "rx": 16, "ry": 22, "fill": "#e8c060"}},
            {"label": "стол чтения", "shape": {"type": "rect", "x": 560, "y": 500, "w": 220, "h": 90, "fill": "#4a3626"}},
            {"label": "дверь", "shape": {"type": "rect", "x": 1150, "y": 320, "w": 100, "h": 220, "fill": "#3d2e1f", "radius": 6}},
         ])},
    ],
    "slots": [
        {"id": "slot_shelf", "label": "Стеллаж с подшивкой", "type": ["item"], "shape": "rect",
         "x": 180, "y": 300, "w": 120, "h": 70, "default_entity": "item_shelf", "condition": None},
    ],
    "navigation": [
        {"label": "В кабинет", "go_to_scene": "scene_office", "area": {"x": 1150, "y": 320, "w": 100, "h": 220}},
    ],
}

SCENE_SQUARE = {
    "id": "scene_square", "label": "Площадь Очага", "location": "loc_verkh",
    "chapter": "ch_1",
    "canvas": {"w": 1280, "h": 720},
    "states": [
        {"id": "state_ash", "label": "Пеплопад", "condition": {"weather": "weather_ashfall"},
         "art": _art("#20242a", [
            {"label": "небо", "shape": {"type": "rect", "x": 0, "y": 0, "w": 1280, "h": 460, "fill": {"gradient": {"from": "#3a3f47", "to": "#20242a", "angle": 90}}}},
            {"label": "мостовая", "shape": {"type": "rect", "x": 0, "y": 460, "w": 1280, "h": 260, "fill": "#2b2b2e"}},
            {"label": "зола на камнях", "shape": {"type": "rect", "x": 0, "y": 460, "w": 1280, "h": 40, "fill": "#7d7d80", "opacity": 0.5}},
            {"label": "памятник-шестерня", "shape": {"type": "ellipse", "cx": 640, "cy": 330, "rx": 130, "ry": 130, "fill": "#4a4038", "stroke": "#6b5a44", "stroke_width": 10}},
            {"label": "сердцевина", "shape": {"type": "ellipse", "cx": 640, "cy": 330, "rx": 46, "ry": 46, "fill": "#2a2119"}},
            {"label": "постамент", "shape": {"type": "rect", "x": 560, "y": 450, "w": 160, "h": 90, "fill": "#3a3430"}},
            {"label": "дом слева", "shape": {"type": "rect", "x": 0, "y": 160, "w": 260, "h": 320, "fill": "#232830"}},
            {"label": "дом справа", "shape": {"type": "rect", "x": 1020, "y": 160, "w": 260, "h": 320, "fill": "#232830"}},
            {"label": "ворота стражи", "shape": {"type": "rect", "x": 60, "y": 300, "w": 110, "h": 180, "fill": "#3d2e1f"}},
            {"label": "проулок к приюту", "shape": {"type": "rect", "x": 1110, "y": 300, "w": 110, "h": 180, "fill": "#191d24"}},
            {"label": "нищенка у стены", "shape": {"type": "rect", "x": 880, "y": 420, "w": 90, "h": 60, "fill": "#33383f"}},
         ])},
        {"id": "state_day", "label": "Днём", "condition": {"time_of_day": ["morning", "day"]},
         "art": _art("#2a3038", [
            {"label": "небо", "shape": {"type": "rect", "x": 0, "y": 0, "w": 1280, "h": 460, "fill": {"gradient": {"from": "#7d90a4", "to": "#39424d", "angle": 90}}}},
            {"label": "мостовая", "shape": {"type": "rect", "x": 0, "y": 460, "w": 1280, "h": 260, "fill": "#3a3a3e"}},
            {"label": "снег по краям", "shape": {"type": "rect", "x": 0, "y": 460, "w": 1280, "h": 24, "fill": "#dfe7ee", "opacity": 0.7}},
            {"label": "памятник-шестерня", "shape": {"type": "ellipse", "cx": 640, "cy": 330, "rx": 130, "ry": 130, "fill": "#5a4f42", "stroke": "#8a7454", "stroke_width": 10}},
            {"label": "сердцевина", "shape": {"type": "ellipse", "cx": 640, "cy": 330, "rx": 46, "ry": 46, "fill": "#33291d"}},
            {"label": "постамент", "shape": {"type": "rect", "x": 560, "y": 450, "w": 160, "h": 90, "fill": "#4a4440"}},
            {"label": "дом слева", "shape": {"type": "rect", "x": 0, "y": 160, "w": 260, "h": 320, "fill": "#2c3542"}},
            {"label": "окна", "shape": {"type": "rect", "x": 40, "y": 220, "w": 60, "h": 80, "fill": "#c8b070", "opacity": 0.8}},
            {"label": "дом справа", "shape": {"type": "rect", "x": 1020, "y": 160, "w": 260, "h": 320, "fill": "#2c3542"}},
            {"label": "ворота стражи", "shape": {"type": "rect", "x": 60, "y": 300, "w": 110, "h": 180, "fill": "#4a3a26"}},
            {"label": "проулок к приюту", "shape": {"type": "rect", "x": 1110, "y": 300, "w": 110, "h": 180, "fill": "#20262e"}},
            {"label": "скамья", "shape": {"type": "rect", "x": 860, "y": 470, "w": 140, "h": 40, "fill": "#4a3626"}},
         ])},
        {"id": "state_night", "label": "Ночью", "condition": None,
         "art": _art("#141820", [
            {"label": "небо", "shape": {"type": "rect", "x": 0, "y": 0, "w": 1280, "h": 460, "fill": {"gradient": {"from": "#1a2130", "to": "#10141c", "angle": 90}}}},
            {"label": "мостовая", "shape": {"type": "rect", "x": 0, "y": 460, "w": 1280, "h": 260, "fill": "#232326"}},
            {"label": "памятник-шестерня", "shape": {"type": "ellipse", "cx": 640, "cy": 330, "rx": 130, "ry": 130, "fill": "#3a332c", "stroke": "#57493a", "stroke_width": 10}},
            {"label": "сердцевина", "shape": {"type": "ellipse", "cx": 640, "cy": 330, "rx": 46, "ry": 46, "fill": "#201913"}},
            {"label": "постамент", "shape": {"type": "rect", "x": 560, "y": 450, "w": 160, "h": 90, "fill": "#2e2a26"}},
            {"label": "дом слева", "shape": {"type": "rect", "x": 0, "y": 160, "w": 260, "h": 320, "fill": "#1a2029"}},
            {"label": "дом справа", "shape": {"type": "rect", "x": 1020, "y": 160, "w": 260, "h": 320, "fill": "#1a2029"}},
            {"label": "фонарь", "shape": {"type": "ellipse", "cx": 420, "cy": 300, "rx": 18, "ry": 24, "fill": "#e8c060"}},
            {"label": "свет фонаря", "shape": {"type": "ellipse", "cx": 420, "cy": 380, "rx": 140, "ry": 110, "fill": "#e8c060", "opacity": 0.1}},
            {"label": "ворота стражи", "shape": {"type": "rect", "x": 60, "y": 300, "w": 110, "h": 180, "fill": "#2e2418"}},
            {"label": "проулок к приюту", "shape": {"type": "rect", "x": 1110, "y": 300, "w": 110, "h": 180, "fill": "#12161d"}},
         ])},
    ],
    "slots": [
        {"id": "slot_guard", "label": "Стражник у ворот", "type": ["person"], "shape": "rect",
         "x": 70, "y": 240, "w": 100, "h": 240, "condition": None},
        {"id": "slot_beggar", "label": "Нищенка Ашта", "type": ["person"], "shape": "rect",
         "x": 870, "y": 330, "w": 110, "h": 150, "condition": None},
        {"id": "slot_monument", "label": "Памятник Очагу", "type": ["prop"], "shape": "rect",
         "x": 510, "y": 200, "w": 260, "h": 340, "default_entity": "item_monument", "condition": None},
    ],
    "navigation": [
        {"label": "В кабинет", "go_to_scene": "scene_office", "area": {"x": 60, "y": 300, "w": 110, "h": 180}},
        {"label": "К приюту", "go_to_scene": "scene_hospice", "area": {"x": 1110, "y": 300, "w": 110, "h": 180}},
        {"label": "На карту", "open_map": True, "area": {"x": 20, "y": 20, "w": 110, "h": 90}},
    ],
}

SCENE_HOSPICE = {
    "id": "scene_hospice", "label": "Приют милосердия", "location": "loc_verkh",
    "chapter": "ch_1",
    "canvas": {"w": 1280, "h": 720},
    "states": [
        {"id": "state_main", "label": "Палата", "condition": None,
         "art": _art("#1c1a18", [
            {"label": "стены", "shape": {"type": "rect", "x": 0, "y": 0, "w": 1280, "h": 520, "fill": "#26221e"}},
            {"label": "пол", "shape": {"type": "rect", "x": 0, "y": 520, "w": 1280, "h": 200, "fill": "#2e2a24"}},
            {"label": "окно", "shape": {"type": "rect", "x": 560, "y": 100, "w": 180, "h": 220, "fill": {"gradient": {"from": "#8fa5b8", "to": "#54687c", "angle": 90}}, "stroke": "#3a2f24", "stroke_width": 6}},
            {"label": "кровать луки", "shape": {"type": "rect", "x": 160, "y": 420, "w": 260, "h": 110, "fill": "#4a4038", "radius": 8}},
            {"label": "одеяло", "shape": {"type": "rect", "x": 160, "y": 450, "w": 260, "h": 60, "fill": "#5d4a3a"}},
            {"label": "кровать пустая", "shape": {"type": "rect", "x": 880, "y": 420, "w": 260, "h": 110, "fill": "#403830", "radius": 8}},
            {"label": "печь", "shape": {"type": "rect", "x": 1160, "y": 260, "w": 100, "h": 200, "fill": "#3a2a22"}},
            {"label": "топка", "shape": {"type": "ellipse", "cx": 1210, "cy": 420, "rx": 28, "ry": 20, "fill": "#d0722f"}},
            {"label": "шкаф с травами", "shape": {"type": "rect", "x": 460, "y": 340, "w": 120, "h": 180, "fill": "#3a2d1d"}},
            {"label": "пучки трав", "shape": {"type": "line", "x1": 480, "y1": 360, "x2": 560, "y2": 360, "color": "#5d7a4a", "width": 6}},
            {"label": "дверь", "shape": {"type": "rect", "x": 40, "y": 300, "w": 100, "h": 220, "fill": "#3d2e1f", "radius": 6}},
         ])},
    ],
    "slots": [
        {"id": "slot_luka", "label": "Инженер Лука", "type": ["person"], "shape": "rect",
         "x": 220, "y": 300, "w": 140, "h": 150, "default_entity": "npc_luka", "condition": None},
        {"id": "slot_iletta", "label": "Сестра Илетта", "type": ["person"], "shape": "rect",
         "x": 640, "y": 260, "w": 120, "h": 260, "condition": None},
    ],
    "navigation": [
        {"label": "На площадь", "go_to_scene": "scene_square", "area": {"x": 40, "y": 300, "w": 100, "h": 220}},
        {"label": "На карту", "open_map": True, "area": {"x": 1180, "y": 40, "w": 80, "h": 80}},
    ],
}

SCENE_TAVERN = {
    "id": "scene_tavern", "label": "Таверна «Гайка и фитиль»", "location": "loc_zavod",
    "chapter": "ch_1",
    "canvas": {"w": 1280, "h": 720},
    "states": [
        {"id": "state_main", "label": "Зал", "condition": None,
         "art": _art("#1d1712", [
            {"label": "стены", "shape": {"type": "rect", "x": 0, "y": 0, "w": 1280, "h": 520, "fill": {"gradient": {"from": "#2c2118", "to": "#1d1712", "angle": 90}}}},
            {"label": "пол", "shape": {"type": "rect", "x": 0, "y": 520, "w": 1280, "h": 200, "fill": "#33291d"}},
            {"label": "стойка", "shape": {"type": "rect", "x": 840, "y": 380, "w": 360, "h": 140, "fill": "#4a3626", "radius": 8}},
            {"label": "полки за стойкой", "shape": {"type": "rect", "x": 900, "y": 160, "w": 260, "h": 160, "fill": "#3a2d1d"}},
            {"label": "бутыли", "shape": {"type": "line", "x1": 920, "y1": 240, "x2": 1140, "y2": 240, "color": "#7a8a5a", "width": 8}},
            {"label": "очаг", "shape": {"type": "rect", "x": 80, "y": 260, "w": 160, "h": 220, "fill": "#3a2a22"}},
            {"label": "пламя", "shape": {"type": "ellipse", "cx": 160, "cy": 430, "rx": 46, "ry": 34, "fill": "#e0813a"}},
            {"label": "стол левый", "shape": {"type": "ellipse", "cx": 420, "cy": 520, "rx": 110, "ry": 46, "fill": "#4a3626"}},
            {"label": "стол правый", "shape": {"type": "ellipse", "cx": 700, "cy": 560, "rx": 110, "ry": 46, "fill": "#4a3626"}},
            {"label": "лампы", "shape": {"type": "ellipse", "cx": 640, "cy": 140, "rx": 220, "ry": 60, "fill": "#e8c060", "opacity": 0.12}},
            {"label": "дверь наружу", "shape": {"type": "rect", "x": 40, "y": 60, "w": 90, "h": 160, "fill": "#3d2e1f"}},
            {"label": "дверь в цех", "shape": {"type": "rect", "x": 1160, "y": 60, "w": 90, "h": 160, "fill": "#3d2e1f"}},
         ])},
    ],
    "slots": [
        {"id": "slot_greta", "label": "Хозяйка за стойкой", "type": ["person"], "shape": "rect",
         "x": 960, "y": 200, "w": 130, "h": 190, "condition": None},
        {"id": "slot_stoker", "label": "Кочегар у стола", "type": ["person"], "shape": "rect",
         "x": 350, "y": 300, "w": 130, "h": 220, "condition": None},
        {"id": "slot_drogan", "label": "Дроган за столом", "type": ["person"], "shape": "rect",
         "x": 630, "y": 340, "w": 130, "h": 220, "condition": None},
    ],
    "navigation": [
        {"label": "На карту", "open_map": True, "area": {"x": 40, "y": 60, "w": 90, "h": 160}},
        {"label": "В цех", "go_to_scene": "scene_foundry", "area": {"x": 1160, "y": 60, "w": 90, "h": 160}},
    ],
}

SCENE_FOUNDRY = {
    "id": "scene_foundry", "label": "Сборочный цех", "location": "loc_zavod",
    "chapter": "ch_2",
    "canvas": {"w": 1280, "h": 720},
    "states": [
        {"id": "state_main", "label": "Цех", "condition": None,
         "art": _art("#171412", [
            {"label": "стены", "shape": {"type": "rect", "x": 0, "y": 0, "w": 1280, "h": 540, "fill": {"gradient": {"from": "#241d18", "to": "#171412", "angle": 90}}}},
            {"label": "пол", "shape": {"type": "rect", "x": 0, "y": 540, "w": 1280, "h": 180, "fill": "#2b2521"}},
            {"label": "горнило", "shape": {"type": "rect", "x": 60, "y": 180, "w": 260, "h": 360, "fill": "#3a2a22", "radius": 12}},
            {"label": "отсвет горнила", "shape": {"type": "ellipse", "cx": 190, "cy": 420, "rx": 70, "ry": 50, "fill": "#e0813a", "opacity": 0.8}},
            {"label": "балки", "shape": {"type": "line", "x1": 0, "y1": 120, "x2": 1280, "y2": 120, "color": "#241d18", "width": 20}},
            {"label": "крюк", "shape": {"type": "line", "x1": 640, "y1": 120, "x2": 640, "y2": 260, "color": "#3a332c", "width": 8}},
            {"label": "пульт", "shape": {"type": "rect", "x": 480, "y": 380, "w": 200, "h": 160, "fill": "#33404a", "radius": 8}},
            {"label": "стрелки пульта", "shape": {"type": "line", "x1": 510, "y1": 420, "x2": 650, "y2": 420, "color": "#7ab0c8", "width": 6}},
            {"label": "ящик с гарью", "shape": {"type": "rect", "x": 950, "y": 460, "w": 150, "h": 110, "fill": "#3d332a", "stroke": "#241d18", "stroke_width": 6}},
            {"label": "верстак", "shape": {"type": "rect", "x": 760, "y": 300, "w": 180, "h": 100, "fill": "#4a3626"}},
            {"label": "дверь в таверну", "shape": {"type": "rect", "x": 40, "y": 60, "w": 90, "h": 160, "fill": "#3d2e1f"}},
            {"label": "выход", "shape": {"type": "rect", "x": 1160, "y": 60, "w": 90, "h": 160, "fill": "#3d2e1f"}},
         ])},
    ],
    "slots": [
        {"id": "slot_varga", "label": "Мастер Варга", "type": ["person"], "shape": "rect",
         "x": 520, "y": 200, "w": 130, "h": 190, "condition": None},
        {"id": "slot_drogan_f", "label": "Фореман у ящиков", "type": ["person"], "shape": "rect",
         "x": 950, "y": 280, "w": 130, "h": 190, "condition": None},
        {"id": "slot_stoker_f", "label": "Кочегар у горнила", "type": ["person"], "shape": "rect",
         "x": 250, "y": 300, "w": 130, "h": 220, "condition": None},
        {"id": "slot_console", "label": "Пульт Очага", "type": ["prop"], "shape": "rect",
         "x": 480, "y": 380, "w": 200, "h": 160, "default_entity": "item_console", "condition": None},
        {"id": "slot_crate", "label": "Ящик с гарью", "type": ["item"], "shape": "rect",
         "x": 950, "y": 460, "w": 150, "h": 110, "default_entity": "item_crate", "condition": None},
    ],
    "navigation": [
        {"label": "В таверну", "go_to_scene": "scene_tavern", "area": {"x": 40, "y": 60, "w": 90, "h": 160}},
        {"label": "На карту", "open_map": True, "area": {"x": 1160, "y": 60, "w": 90, "h": 160}},
    ],
}

SCENE_UNDER = {
    "id": "scene_under", "label": "Туннели Низов", "location": "loc_nizy",
    "chapter": "ch_3",
    "canvas": {"w": 1280, "h": 720},
    "states": [
        {"id": "state_clear", "label": "После зачистки", "condition": {"flag": "under_cleared"},
         "art": _art("#151216", [
            {"label": "свод", "shape": {"type": "polygon", "points": [0, 720, 0, 300, 640, 80, 1280, 300, 1280, 720], "fill": "#1d181d"}},
            {"label": "пол", "shape": {"type": "rect", "x": 0, "y": 560, "w": 1280, "h": 160, "fill": "#241e24"}},
            {"label": "арка влево", "shape": {"type": "rect", "x": 60, "y": 320, "w": 130, "h": 240, "fill": "#0e0b0e"}},
            {"label": "арка к сердцу", "shape": {"type": "rect", "x": 1090, "y": 320, "w": 130, "h": 240, "fill": "#241a14"}},
            {"label": "факел", "shape": {"type": "ellipse", "cx": 640, "cy": 300, "rx": 20, "ry": 30, "fill": "#e0813a"}},
            {"label": "свет факела", "shape": {"type": "ellipse", "cx": 640, "cy": 400, "rx": 260, "ry": 160, "fill": "#e0813a", "opacity": 0.1}},
            {"label": "тайник", "shape": {"type": "rect", "x": 420, "y": 470, "w": 150, "h": 100, "fill": "#33291d", "stroke": "#241a10", "stroke_width": 6}},
         ])},
        {"id": "state_dark", "label": "Тёмный туннель", "condition": None,
         "art": _art("#0e0b0e", [
            {"label": "свод", "shape": {"type": "polygon", "points": [0, 720, 0, 300, 640, 80, 1280, 300, 1280, 720], "fill": "#151115"}},
            {"label": "пол", "shape": {"type": "rect", "x": 0, "y": 560, "w": 1280, "h": 160, "fill": "#1b161b"}},
            {"label": "арка влево", "shape": {"type": "rect", "x": 60, "y": 320, "w": 130, "h": 240, "fill": "#080608"}},
            {"label": "арка к сердцу", "shape": {"type": "rect", "x": 1090, "y": 320, "w": 130, "h": 240, "fill": "#1c130e"}},
            {"label": "тусклый фонарь", "shape": {"type": "ellipse", "cx": 640, "cy": 300, "rx": 14, "ry": 20, "fill": "#a86a2f", "opacity": 0.8}},
            {"label": "тени", "shape": {"type": "rect", "x": 0, "y": 0, "w": 1280, "h": 720, "fill": "#000000", "opacity": 0.25}},
            {"label": "тайник", "shape": {"type": "rect", "x": 420, "y": 470, "w": 150, "h": 100, "fill": "#241d14", "stroke": "#171008", "stroke_width": 6}},
         ])},
    ],
    "slots": [
        {"id": "slot_cache", "label": "Тайник культистов", "type": ["item"], "shape": "rect",
         "x": 420, "y": 470, "w": 150, "h": 100, "default_entity": "item_cache", "condition": None},
    ],
    "navigation": [
        {"label": "К Сердцу", "go_to_scene": "scene_heart", "area": {"x": 1090, "y": 320, "w": 130, "h": 240}},
        {"label": "Наверх", "open_map": True, "area": {"x": 60, "y": 320, "w": 130, "h": 240}},
    ],
}

SCENE_HEART = {
    "id": "scene_heart", "label": "Сердце Очага", "location": "loc_nizy",
    "chapter": "ch_3",
    "canvas": {"w": 1280, "h": 720},
    "states": [
        {"id": "state_main", "label": "Зал Сердца", "condition": None,
         "art": _art("#160f0c", [
            {"label": "зал", "shape": {"type": "rect", "x": 0, "y": 0, "w": 1280, "h": 720, "fill": {"gradient": {"from": "#241511", "to": "#120b08", "angle": 90}}}},
            {"label": "сердце-котёл", "shape": {"type": "ellipse", "cx": 640, "cy": 330, "rx": 220, "ry": 220, "fill": "#3a2a22", "stroke": "#7a5a33", "stroke_width": 14}},
            {"label": "зубья", "shape": {"type": "ellipse", "cx": 640, "cy": 330, "rx": 150, "ry": 150, "fill": "none", "stroke": "#57493a", "stroke_width": 18}},
            {"label": "пламя сердца", "shape": {"type": "ellipse", "cx": 640, "cy": 330, "rx": 80, "ry": 80, "fill": {"gradient": {"from": "#f0a050", "to": "#a03a1a", "angle": 90}}}},
            {"label": "свет", "shape": {"type": "ellipse", "cx": 640, "cy": 400, "rx": 420, "ry": 240, "fill": "#e0813a", "opacity": 0.12}},
            {"label": "цепи", "shape": {"type": "line", "x1": 200, "y1": 0, "x2": 420, "y2": 220, "color": "#3a332c", "width": 10}},
            {"label": "цепи 2", "shape": {"type": "line", "x1": 1080, "y1": 0, "x2": 860, "y2": 220, "color": "#3a332c", "width": 10}},
            {"label": "помост", "shape": {"type": "rect", "x": 420, "y": 560, "w": 440, "h": 60, "fill": "#241d18"}},
            {"label": "обратное сердце", "shape": {"type": "rect", "x": 980, "y": 440, "w": 180, "h": 140, "fill": "#232830", "stroke": "#4a5a6a", "stroke_width": 6}},
            {"label": "иней обратного", "shape": {"type": "rect", "x": 980, "y": 440, "w": 180, "h": 30, "fill": "#b8d0e0", "opacity": 0.5}},
            {"label": "вход", "shape": {"type": "rect", "x": 60, "y": 340, "w": 130, "h": 240, "fill": "#0e0b0e"}},
         ])},
    ],
    "slots": [
        {"id": "slot_oracle", "label": "Голос Сердца", "type": ["prop"], "shape": "rect",
         "x": 540, "y": 160, "w": 200, "h": 340, "default_entity": "npc_oracle", "condition": None},
        {"id": "slot_varga_final", "label": "Варга у обратного сердца", "type": ["person"], "shape": "rect",
         "x": 1000, "y": 240, "w": 140, "h": 210, "condition": {"flag": "varga_hostile"}},
    ],
    "navigation": [
        {"label": "В туннели", "go_to_scene": "scene_under", "area": {"x": 60, "y": 340, "w": 130, "h": 240}},
    ],
}

SCENES = {
    "scene_office": SCENE_OFFICE,
    "scene_archive": SCENE_ARCHIVE,
    "scene_square": SCENE_SQUARE,
    "scene_hospice": SCENE_HOSPICE,
    "scene_tavern": SCENE_TAVERN,
    "scene_foundry": SCENE_FOUNDRY,
    "scene_under": SCENE_UNDER,
    "scene_heart": SCENE_HEART,
}
