# -*- coding: utf-8 -*-
"""Мир Медного Хода: регион, локации, карта и 11 сцен."""

IMG = "assets/img/scenes/"

# --- вспомогательные условия ------------------------------------------------
def day():
    return {"time_of_day": ["morning", "day"]}


def night():
    return {"time_of_day": ["evening", "night"]}


def flag(f):
    return {"flag": f}


def not_flag(f):
    return {"not_flag": f}


REGIONS = [
    {
        "id": "region_copper",
        "label": "Медный Ход",
        "map_image": "",
        "map_size": {"w": 1280, "h": 720},
        "parent_region": None,
        "map_art": {
            "canvas": {"w": 1280, "h": 720},
            "background": "#14100d",
            "layers": [
                {"label": "небо", "shape": {"type": "rect", "x": 0, "y": 0, "w": 1280, "h": 720,
                                            "fill": {"gradient": {"from": "#221b15", "to": "#0d0a08", "angle": 90}}}},
                {"label": "верхняя терраса", "shape": {"type": "rect", "x": 380, "y": 120, "w": 520, "h": 90,
                                                       "fill": "#2e2620", "stroke": "#4a3a28", "stroke_width": 3, "radius": 12}},
                {"label": "подпись террасы", "shape": {"type": "text", "x": 640, "y": 172, "text": "ВЕРХНЯЯ ТЕРРАСА",
                                                       "size": 24, "color": "#c8873a", "align": "middle"}},
                {"label": "рынок", "shape": {"type": "rect", "x": 330, "y": 300, "w": 620, "h": 100,
                                             "fill": "#33291f", "stroke": "#5a4529", "stroke_width": 3, "radius": 12}},
                {"label": "подпись рынка", "shape": {"type": "text", "x": 640, "y": 356, "text": "РЖАВЫЙ РЫНОК",
                                                      "size": 24, "color": "#c8873a", "align": "middle"}},
                {"label": "нижний город", "shape": {"type": "rect", "x": 250, "y": 500, "w": 780, "h": 110,
                                                    "fill": "#2a221a", "stroke": "#6b4f2a", "stroke_width": 3, "radius": 12}},
                {"label": "подпись низа", "shape": {"type": "text", "x": 640, "y": 560, "text": "ШЛАКОВЫЕ ЯМЫ И ШТРЕК",
                                                     "size": 24, "color": "#c8873a", "align": "middle"}},
                {"label": "шахта", "shape": {"type": "polygon", "points": [940, 430, 1010, 430, 1090, 660, 860, 660],
                                             "fill": "#1c1712", "stroke": "#4a3a28", "stroke_width": 3}},
                {"label": "дым", "shape": {"type": "ellipse", "cx": 1010, "cy": 420, "rx": 90, "ry": 40,
                                           "fill": "#3a3630", "opacity": 0.45}},
                {"label": "трубы", "shape": {"type": "line", "x1": 420, "y1": 210, "x2": 420, "y2": 300,
                                             "color": "#6b4f2a", "width": 6}},
                {"label": "трубы 2", "shape": {"type": "line", "x1": 860, "y1": 210, "x2": 860, "y2": 300,
                                               "color": "#6b4f2a", "width": 6}},
            ],
        },
        "locations": [
            {
                "id": "loc_gate", "label": "Западные ворота",
                "position": {"x": 640, "y": 660},
                "travel_connections": [
                    {"to": "loc_market", "cost_ticks": 1,
                     "requirements": [{"type": "flag_set", "flag": "guard_let_in"}]},
                ],
                "scenes": ["scene_gate"], "arrival_scene": "scene_gate",
                "ambient": ["amb_wind"],
                "music": [{"tracks": ["music_gate"], "conditions": []}],
            },
            {
                "id": "loc_market", "label": "Ржавый рынок",
                "position": {"x": 640, "y": 350},
                "travel_connections": [
                    {"to": "loc_gate", "cost_ticks": 1, "random_encounter_table": "enc_market"},
                    {"to": "loc_tavern", "cost_ticks": 1},
                    {"to": "loc_works", "cost_ticks": 2, "random_encounter_table": "enc_market"},
                    {"to": "loc_lower", "cost_ticks": 3, "random_encounter_table": "enc_lower"},
                ],
                "scenes": ["scene_market", "scene_watch", "scene_clinic"],
                "arrival_scene": "scene_market",
                "music": [{"tracks": ["music_market"], "conditions": [{"time_of_day": ["morning", "day"]}]},
                          {"tracks": ["music_lower"], "conditions": []}],
            },
            {
                "id": "loc_tavern", "label": "Корчма «Сухой патрубок»",
                "position": {"x": 400, "y": 240},
                "travel_connections": [
                    {"to": "loc_market", "cost_ticks": 1},
                ],
                "scenes": ["scene_tavern"], "arrival_scene": "scene_tavern",
                "camp": True,
                "music": [{"tracks": ["music_tavern"], "conditions": []}],
            },
            {
                "id": "loc_works", "label": "Литейная мастерская",
                "position": {"x": 880, "y": 240},
                "travel_connections": [
                    {"to": "loc_market", "cost_ticks": 2},
                    {"to": "loc_lower", "cost_ticks": 2, "random_encounter_table": "enc_lower"},
                ],
                "scenes": ["scene_works"], "arrival_scene": "scene_works",
                "ambient": ["amb_forge"],
                "music": [{"tracks": ["music_works"], "conditions": []}],
            },
            {
                "id": "loc_lower", "label": "Шлаковые ямы",
                "position": {"x": 640, "y": 560},
                "travel_connections": [
                    {"to": "loc_market", "cost_ticks": 3, "random_encounter_table": "enc_lower"},
                    {"to": "loc_works", "cost_ticks": 2, "random_encounter_table": "enc_lower"},
                    {"to": "loc_deep", "cost_ticks": 2, "random_encounter_table": "enc_deep",
                     "requirements": [{"type": "flag_set", "flag": "deep_pass"}]},
                    {"to": "loc_machine", "cost_ticks": 3,
                     "requirements": [{"type": "flag_set", "flag": "deep_pass"}]},
                ],
                "scenes": ["scene_lower", "scene_slag"], "arrival_scene": "scene_lower",
                "camp": True,
                "ambient": ["amb_hum"],
                "music": [{"tracks": ["music_lower"], "conditions": []}],
            },
            {
                "id": "loc_machine", "label": "Машинный зал",
                "position": {"x": 1010, "y": 520},
                "travel_connections": [
                    {"to": "loc_lower", "cost_ticks": 3},
                    {"to": "loc_deep", "cost_ticks": 2,
                     "requirements": [{"type": "flag_set", "flag": "valve_fixed"}]},
                ],
                "scenes": ["scene_pump", "scene_machine"], "arrival_scene": "scene_pump",
                "ambient": ["amb_hum"],
                "music": [{"tracks": ["music_machine"], "conditions": []}],
            },
            {
                "id": "loc_deep", "label": "Глубокий штрек",
                "position": {"x": 950, "y": 640},
                "travel_connections": [
                    {"to": "loc_lower", "cost_ticks": 2, "random_encounter_table": "enc_deep"},
                    {"to": "loc_machine", "cost_ticks": 2,
                     "requirements": [{"type": "flag_set", "flag": "valve_fixed"}]},
                ],
                "scenes": ["scene_deep"], "arrival_scene": "scene_deep",
                "camp": True,
                "music": [{"tracks": ["music_deep"], "conditions": []}],
            },
        ],
    }
]


def _slot(sid, label, types, x, y, w, h, entity=None, condition=None, scale=None, use_with=None, state=None):
    s = {"id": sid, "label": label, "type": types, "shape": "rect", "x": x, "y": y, "w": w, "h": h,
         "condition": condition}
    if entity:
        s["default_entity"] = entity
    if scale is not None:
        s["sprite_scale"] = scale
    if use_with:
        s["use_with"] = use_with
    if state:
        s["sprite_state"] = state
    return s


def _nav(label, x, y, w, h, scene=None, open_map=False):
    z = {"label": label, "area": {"x": x, "y": y, "w": w, "h": h}}
    if scene:
        z["go_to_scene"] = scene
    if open_map:
        z["open_map"] = True
    return z


SCENES = {
    "scene_gate": {
        "id": "scene_gate", "label": "Западные ворота", "location": "loc_gate",
        "canvas": {"w": 1280, "h": 720}, "chapter": "ch_prologue",
        "states": [
            {"id": "state_ash", "label": "Пеплопад", "image": IMG + "scene_gate_day.jpg",
             "condition": {"weather": "weather_ash"}},
            {"id": "state_day", "label": "День", "image": IMG + "scene_gate_day.jpg", "condition": None},
        ],
        "slots": [
            _slot("slot_guard", "Караульный у будки", ["person"], 500, 300, 190, 340, "npc_guard", None, 1.0),
            _slot("slot_notice", "Объявление у ворот", ["item"], 236, 250, 168, 208, "item_notice", None),
        ],
        "navigation": [
            _nav("Дорога в город", 40, 300, 170, 320, open_map=True),
            _nav("Карта", 1140, 40, 110, 110, open_map=True),
        ],
        "ambient": ["amb_wind"],
        "music": [{"tracks": ["music_gate"], "conditions": []}],
    },
    "scene_market": {
        "id": "scene_market", "label": "Ржавый рынок", "location": "loc_market",
        "canvas": {"w": 1280, "h": 720}, "chapter": "ch_case",
        "states": [
            {"id": "state_day", "label": "День", "image": IMG + "scene_market_day.jpg", "condition": day()},
            {"id": "state_night", "label": "Вечер и ночь", "image": IMG + "scene_market_night.jpg", "condition": None},
        ],
        "slots": [
            _slot("slot_vein", "Прилавок Клёпа", ["person"], 380, 300, 200, 330, "npc_vein", None, 1.0),
            _slot("slot_board", "Доска объявлений", ["item"], 900, 240, 180, 200, "item_board", None),
        ],
        "navigation": [
            _nav("В участок стражи", 40, 300, 150, 320, scene="scene_watch"),
            _nav("В лечебницу", 1120, 300, 150, 320, scene="scene_clinic"),
            _nav("На карту города", 560, 640, 220, 70, open_map=True),
        ],
        "music": [{"tracks": ["music_market"], "conditions": [{"time_of_day": ["morning", "day"]}]},
                  {"tracks": ["music_lower"], "conditions": []}],
    },
    "scene_watch": {
        "id": "scene_watch", "label": "Участок караула", "location": "loc_market",
        "canvas": {"w": 1280, "h": 720}, "chapter": "ch_case",
        "states": [
            {"id": "state_day", "label": "Смена", "image": IMG + "scene_watch_day.jpg", "condition": None},
        ],
        "slots": [
            _slot("slot_sergeant", "Стол сержанта", ["person"], 880, 300, 210, 330, "npc_sergeant", None, 1.0),
            _slot("slot_shelf", "Полка улик", ["item"], 300, 250, 200, 210, "item_case_shelf", None),
            _slot("slot_locker", "Личный шкафчик Гарна", ["container"], 600, 360, 170, 230, "item_locker", None),
        ],
        "navigation": [
            _nav("На рынок", 40, 300, 150, 320, scene="scene_market"),
        ],
        "music": [{"tracks": ["music_market"], "conditions": []}],
    },
    "scene_clinic": {
        "id": "scene_clinic", "label": "Лечебница", "location": "loc_market",
        "canvas": {"w": 1280, "h": 720}, "chapter": "ch_case",
        "states": [
            {"id": "state_day", "label": "Смена", "image": IMG + "scene_clinic_day.jpg", "condition": None},
        ],
        "slots": [
            _slot("slot_hanna", "Ханна у стола", ["person"], 840, 300, 200, 330, "npc_medic", None, 1.0),
            _slot("slot_cabinet", "Шкаф с лекарствами", ["item"], 240, 260, 190, 240, "item_cabinet", None),
        ],
        "navigation": [
            _nav("На рынок", 40, 300, 150, 320, scene="scene_market"),
        ],
        "music": [{"tracks": ["music_market"], "conditions": []}],
    },
    "scene_tavern": {
        "id": "scene_tavern", "label": "Корчма «Сухой патрубок»", "location": "loc_tavern",
        "canvas": {"w": 1280, "h": 720}, "chapter": "ch_case",
        "states": [
            {"id": "state_day", "label": "Днём", "image": IMG + "scene_tavern_day.jpg", "condition": day()},
            {"id": "state_night", "label": "Вечером", "image": IMG + "scene_tavern_night.jpg", "condition": None},
        ],
        "slots": [
            _slot("slot_marta", "Марта за стойкой", ["person"], 520, 300, 200, 330, "npc_marta", None, 1.0),
            _slot("slot_hearth", "Очаг", ["item"], 180, 330, 190, 200, "item_hearth", None),
            _slot("slot_bed", "Койка в углу", ["item"], 980, 340, 200, 260, "item_bed", None),
        ],
        "navigation": [
            _nav("На карту города", 560, 640, 220, 70, open_map=True),
        ],
        "music": [{"tracks": ["music_tavern"], "conditions": []}],
    },
    "scene_works": {
        "id": "scene_works", "label": "Литейная мастерская", "location": "loc_works",
        "canvas": {"w": 1280, "h": 720}, "chapter": "ch_works",
        "states": [
            {"id": "state_day", "label": "Работа", "image": IMG + "scene_works_day.jpg", "condition": None},
        ],
        "slots": [
            _slot("slot_irena", "Ирена у горна", ["person"], 940, 290, 200, 340, "npc_irena", None, 1.0),
            _slot("slot_bench", "Верстак", ["item"], 600, 390, 220, 190, "item_bench", None),
            _slot("slot_forge", "Горн", ["item"], 170, 300, 210, 240, "item_forge", None),
        ],
        "navigation": [
            _nav("На карту города", 560, 640, 220, 70, open_map=True),
        ],
        "ambient": ["amb_forge"],
        "music": [{"tracks": ["music_works"], "conditions": []}],
    },
    "scene_lower": {
        "id": "scene_lower", "label": "Нижняя улица", "location": "loc_lower",
        "canvas": {"w": 1280, "h": 720}, "chapter": "ch_works",
        "states": [
            {"id": "state_day", "label": "Смена", "image": IMG + "scene_lower_day.jpg", "condition": None},
        ],
        "slots": [
            _slot("slot_puddle", "Лужа с осадком", ["item"], 380, 500, 200, 130, "item_puddle", None),
            _slot("slot_lissa", "Дверной проём", ["person"], 880, 320, 190, 320, "npc_lissa",
                  flag("lissa_found"), 1.0),
            _slot("slot_cart", "Брошенная телега", ["container"], 170, 380, 200, 200, "item_cart", None),
        ],
        "navigation": [
            _nav("В шлаковые ямы", 1050, 380, 200, 300, scene="scene_slag"),
            _nav("Подняться на рынок", 40, 300, 150, 320, open_map=True),
        ],
        "ambient": ["amb_hum"],
        "music": [{"tracks": ["music_lower"], "conditions": []}],
    },
    "scene_slag": {
        "id": "scene_slag", "label": "Шлаковые ямы", "location": "loc_lower",
        "canvas": {"w": 1280, "h": 720}, "chapter": "ch_slag",
        "states": [
            {"id": "state_day", "label": "Смена", "image": IMG + "scene_slag_day.jpg", "condition": None},
        ],
        "slots": [
            _slot("slot_bossar", "Боссар у отвала", ["person"], 300, 300, 210, 330, "npc_bossar", None, 1.0),
            _slot("slot_pit", "Свежий отвал", ["item"], 600, 470, 220, 150, "item_pit", None),
            _slot("slot_crane", "Кран-балка", ["item"], 980, 240, 220, 260, "item_crane", None),
        ],
        "navigation": [
            _nav("К Нижней улице", 40, 320, 150, 300, scene="scene_lower"),
        ],
        "ambient": ["amb_hum"],
        "music": [{"tracks": ["music_lower"], "conditions": []}],
    },
    "scene_pump": {
        "id": "scene_pump", "label": "Насосная станция", "location": "loc_machine",
        "canvas": {"w": 1280, "h": 720}, "chapter": "ch_heart",
        "states": [
            {"id": "state_fume", "label": "Угарный туман", "image": IMG + "scene_pump_day.jpg",
             "condition": {"weather": "weather_fume"}},
            {"id": "state_day", "label": "Смена", "image": IMG + "scene_pump_day.jpg", "condition": None},
        ],
        "slots": [
            _slot("slot_valve", "Главный клапан", ["item"], 560, 320, 220, 230, "item_valve", None),
            _slot("slot_gauge", "Манометр", ["item"], 900, 280, 170, 180, "item_gauge", None),
        ],
        "navigation": [
            _nav("В машинный зал", 1040, 380, 200, 300, scene="scene_machine"),
        ],
        "ambient": ["amb_hum"],
        "music": [{"tracks": ["music_machine"], "conditions": []}],
    },
    "scene_machine": {
        "id": "scene_machine", "label": "Сердце Хода", "location": "loc_machine",
        "canvas": {"w": 1280, "h": 720}, "chapter": "ch_heart",
        "states": [
            {"id": "state_fume", "label": "Угарный туман", "image": IMG + "scene_machine_day.jpg",
             "condition": {"weather": "weather_fume"}},
            {"id": "state_day", "label": "Смена", "image": IMG + "scene_machine_day.jpg", "condition": None},
        ],
        "slots": [
            _slot("slot_hod", "Трубы у сердца", ["prop"], 200, 280, 220, 300, "npc_hod", None),
            _slot("slot_cradle", "Ложе проводника", ["item"], 560, 360, 240, 230, "item_cradle", None),
            _slot("slot_pipes", "Обходной патрубок", ["item"], 860, 300, 200, 200, "item_pipes",
                  flag("valve_fixed")),
            _slot("slot_valent", "Управляющий", ["person"], 1050, 290, 200, 340, "npc_valent",
                  flag("valve_fixed"), 1.0),
        ],
        "navigation": [
            _nav("К насосной", 40, 320, 150, 300, scene="scene_pump"),
            _nav("На карту", 1140, 40, 110, 110, open_map=True),
        ],
        "ambient": ["amb_hum"],
        "music": [{"tracks": ["music_machine"], "conditions": []}],
    },
    "scene_deep": {
        "id": "scene_deep", "label": "Глубокий штрек", "location": "loc_deep",
        "canvas": {"w": 1280, "h": 720}, "chapter": "ch_deep",
        "states": [
            {"id": "state_fume", "label": "Угар", "image": IMG + "scene_deep_day.jpg",
             "condition": {"weather": "weather_fume"}},
            {"id": "state_day", "label": "Тьма", "image": IMG + "scene_deep_day.jpg", "condition": None},
        ],
        "slots": [
            _slot("slot_body", "Тело у крепи", ["item"], 520, 430, 260, 200, "item_garn_body", None),
            _slot("slot_ledger", "Ящик с бумагами", ["item"], 950, 400, 190, 180, "item_ledger_crate", None),
            _slot("slot_debris", "Обвал породы", ["item"], 240, 400, 200, 180, "item_debris", None),
        ],
        "navigation": [
            _nav("Уйти из штрека", 40, 320, 150, 300, open_map=True),
        ],
        "ambient": ["amb_hum"],
        "music": [{"tracks": ["music_deep"], "conditions": []}],
    },
}


def world():
    return {"regions": REGIONS}
