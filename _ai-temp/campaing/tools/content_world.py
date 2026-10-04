"""Мир: регион, локации, сцены (world.json + scenes/*.json)."""

from artlib import PAL, W, H, rect, ellipse, poly, line, text, grad, interior, street, \
    tunnel, furnace_hall, machine_core, ash_yard, water_gallery, map_art

IMG = "assets/img/"


def st(sid, label, condition=None, image=None, art=None, camera=None):
    s = {"id": sid, "label": label, "condition": condition}
    if image:
        s["image"] = image
    if art:
        s["art"] = art
    if camera:
        s["camera"] = camera
    return s


def slot(sid, label, types, x, y, w, h, entity=None, use_with=None, sprite_scale=None,
         sprite_state=None, condition=None):
    s = {"id": sid, "label": label, "type": types, "shape": "rect",
         "x": x, "y": y, "w": w, "h": h, "condition": condition}
    if entity:
        s["default_entity"] = entity
    if use_with:
        s["use_with"] = use_with
    if sprite_scale is not None:
        s["sprite_scale"] = sprite_scale
    if sprite_state is not None:
        s["sprite_state"] = sprite_state
    return s


def nav(label, area, go_to_scene=None, open_map=False, cost=None, hide=False):
    n = {"label": label, "area": {"x": area[0], "y": area[1], "w": area[2], "h": area[3]}}
    if go_to_scene:
        n["go_to_scene"] = go_to_scene
        if cost:
            n["cost_ticks"] = cost
    if open_map:
        n["open_map"] = True
    if hide:
        n["hide_label"] = True
    return n


MAP_EXIT = (1105, 20, 150, 92)
LEFT = (30, 330, 150, 300)
RIGHT = (1100, 330, 150, 300)


# ------------------------------------------------------------------ сцены

def scene_watch_office():
    pal = PAL["watch"]
    props = [
        rect(700, 420, 420, 140, pal["metal"], radius=8, label="стол дежурного"),
        rect(720, 470, 380, 14, pal["wall2"], opacity=0.8),
        rect(150, 250, 180, 320, pal["wall2"], radius=6, label="шкаф"),
        rect(150, 300, 180, 6, pal["metal"], opacity=0.9),
        rect(150, 380, 180, 6, pal["metal"], opacity=0.9),
        rect(330, 130, 330, 230, "#2f2519", radius=4, stroke=pal["metal"], label="доска"),
        rect(352, 152, 286, 186, "#3b3020", opacity=0.8),
        rect(380, 180, 60, 80, "#d8cdb8", opacity=0.55),
        rect(455, 186, 70, 74, "#cbbba0", opacity=0.4),
        rect(540, 176, 50, 86, "#d8cdb8", opacity=0.5),
        ellipse(760, 330, 26, 26, pal["accent"], opacity=0.7),
    ]
    art = interior(pal, props=props, lamps=[(320, 120), (900, 120)], floor_y=470)
    return {
        "id": "scene_watch_office", "label": "Дежурка", "location": "loc_watch",
        "canvas": {"w": W, "h": H},
        "chapter": "ch_prologue",
        "states": [
            st("state_day", "Днём", {"time_of_day": ["morning", "day"]}, art=art),
            st("state_night", "Ночью", None,
               art=interior(pal, props=props, lamps=[(320, 120), (900, 120)],
                            floor_y=470, background="#0f1318")),
        ],
        "slots": [
            slot("slot_stroy", "За столом дежурного", ["person"], 762, 286, 196, 264,
                 entity="npc_stroy", sprite_scale=0.95),
            slot("slot_board", "Оперативная доска", ["item"], 330, 130, 330, 230,
                 entity="item_board"),
        ],
        "navigation": [
            nav("В архив", RIGHT, go_to_scene="scene_watch_archive"),
            nav("В смотровую", LEFT, go_to_scene="scene_watch_coldroom"),
            nav("На карту города", MAP_EXIT, open_map=True),
        ],
        "music": [{"tracks": ["music_watch"], "conditions": []}],
        "ambient": ["sfx_hum"],
    }


def scene_watch_archive():
    pal = PAL["watch"]
    props = []
    for i, y in enumerate((220, 320, 420)):
        props.append(rect(120, y, 1040, 78, pal["wall2"], radius=4, label="полка"))
        for k in range(14):
            x = 136 + k * 72
            props.append(rect(x, y + 10, 46, 62, "#4a3c26", opacity=0.9))
            props.append(rect(x + 6, y + 16, 34, 8, pal["accent"], opacity=0.35))
    props.append(rect(520, 520, 320, 120, pal["metal"], radius=6, label="стол для бумаг"))
    art = interior(pal, props=props, lamps=[(300, 100), (980, 100)], floor_y=560)
    return {
        "id": "scene_watch_archive", "label": "Архив картотек", "location": "loc_watch",
        "canvas": {"w": W, "h": H},
        "chapter": "ch_copper",
        "states": [st("state_main", "Обычное", None, art=art)],
        "slots": [
            slot("slot_archive", "Картотека Спуска", ["container"], 120, 200, 420, 300,
                 entity="item_archive"),
        ],
        "navigation": [
            nav("В дежурку", LEFT, go_to_scene="scene_watch_office"),
            nav("На карту города", MAP_EXIT, open_map=True),
        ],
        "music": [{"tracks": ["music_watch"], "conditions": []}],
        "ambient": ["sfx_paper"],
    }


def scene_watch_coldroom():
    pal = PAL["pipes"]
    props = [
        rect(430, 380, 430, 150, "#3d4348", radius=8, label="смотровой стол"),
        rect(430, 380, 430, 18, "#575f66", opacity=0.9),
        rect(452, 398, 386, 110, "#2a3034", opacity=0.9),
        rect(1180, 250, 60, 300, pal["metal"], radius=6, label="стойка с крюками"),
        ellipse(645, 300, 150, 90, "#9fd6cc", opacity=0.10),
    ]
    art = interior(pal, props=props, lamps=[(640, 120)], floor_y=530, background="#0d1114")
    return {
        "id": "scene_watch_coldroom", "label": "Смотровая", "location": "loc_watch",
        "canvas": {"w": W, "h": H},
        "chapter": "ch_prologue",
        "states": [
            st("state_main", "Обычное", None, art=art),
        ],
        "slots": [
            slot("slot_body", "Тело на столе", ["item"], 430, 360, 430, 190,
                 entity="item_body"),
        ],
        "navigation": [
            nav("В дежурку", RIGHT, go_to_scene="scene_watch_office"),
            nav("На карту города", MAP_EXIT, open_map=True),
        ],
        "music": [{"tracks": ["music_watch"], "conditions": []}],
        "ambient": ["sfx_drip"],
    }


def scene_copper_market():
    pal = PAL["copper"]
    art = street(pal, stalls=True, chimneys=True, crowd=True)
    return {
        "id": "scene_copper_market", "label": "Медный ряд", "location": "loc_copper_row",
        "canvas": {"w": W, "h": H},
        "chapter": "ch_copper",
        "states": [
            st("state_day", "Днём", {"time_of_day": ["morning", "day"]}, art=art),
            st("state_night", "Вечером", None,
               art=street(pal, stalls=True, chimneys=True, crowd=False,
                          background="#120e0b")),
        ],
        "slots": [
            slot("slot_hawker", "За лотком", ["person"], 140, 300, 190, 270,
                 sprite_scale=0.9),
            slot("slot_notice", "Доска Цехa", ["item"], 880, 300, 190, 250,
                 entity="item_notice"),
        ],
        "navigation": [
            nav("В мастерскую", LEFT, go_to_scene="scene_copper_workshop"),
            nav("В харчевню", RIGHT, go_to_scene="scene_copper_kettle"),
            nav("На карту города", MAP_EXIT, open_map=True),
        ],
        "music": [{"tracks": ["music_copper"], "conditions": []}],
        "ambient": ["sfx_hum"],
    }


def scene_copper_workshop():
    pal = PAL["copper"]
    props = [
        rect(800, 400, 380, 130, "#4a3626", radius=6, label="верстак"),
        rect(830, 430, 120, 60, "#6b5340", radius=4),
        ellipse(1010, 470, 60, 34, "#8d6a45", opacity=0.9),
        rect(160, 300, 220, 240, "#3b2c20", radius=8, label="печь отжига"),
        ellipse(270, 420, 60, 46, "#ff8b3d", opacity=0.55),
        rect(430, 250, 250, 190, "#33281d", radius=4, stroke=pal["metal"], label="стеллаж"),
    ]
    art = interior(pal, props=props, lamps=[(560, 110), (980, 110)], floor_y=530)
    return {
        "id": "scene_copper_workshop", "label": "Огранная мастерская",
        "location": "loc_copper_row",
        "canvas": {"w": W, "h": H},
        "chapter": "ch_copper",
        "states": [
            st("state_main", "Обычное", None, art=art),
        ],
        "slots": [
            slot("slot_karna", "У верстака", ["person"], 540, 290, 200, 280,
                 entity="npc_karna", sprite_scale=0.95),
            slot("slot_bench", "Верстак", ["item"], 800, 380, 380, 160,
                 entity="item_bench"),
        ],
        "navigation": [
            nav("На ряд", RIGHT, go_to_scene="scene_copper_market"),
            nav("На карту города", MAP_EXIT, open_map=True),
        ],
        "music": [{"tracks": ["music_copper"], "conditions": []}],
        "ambient": ["sfx_gear"],
    }


def scene_copper_kettle():
    pal = PAL["copper"]
    props = [
        rect(760, 340, 300, 260, "#3a2a1c", radius=10, label="печь"),
        ellipse(910, 470, 90, 60, "#ff7a2e", opacity=0.5),
        ellipse(910, 440, 60, 34, "#ffc46b", opacity=0.6),
        rect(880, 300, 60, 60, "#4a3a2a", radius=4),
        rect(180, 470, 300, 120, "#4a3626", radius=6, label="стол"),
        rect(560, 480, 150, 110, "#4a3626", radius=6),
        ellipse(430, 300, 120, 70, pal["accent"], opacity=0.18),
    ]
    art = interior(pal, props=props, lamps=[(420, 110), (1020, 110)], floor_y=580)
    return {
        "id": "scene_copper_kettle", "label": "Харчевня «Котёл»", "location": "loc_copper_row",
        "canvas": {"w": W, "h": H},
        "chapter": "ch_copper",
        "states": [st("state_main", "Обычное", None, art=art)],
        "slots": [
            slot("slot_kotel", "За стойкой", ["person"], 480, 300, 190, 280,
                 entity="npc_kotel", sprite_scale=0.95),
            slot("slot_guest", "У печи", ["person"], 900, 330, 180, 260),
            slot("slot_stove", "Печь", ["item"], 760, 340, 300, 200,
                 entity="item_stove"),
        ],
        "navigation": [
            nav("На ряд", LEFT, go_to_scene="scene_copper_market"),
            nav("На карту города", MAP_EXIT, open_map=True),
        ],
        "music": [{"tracks": ["music_copper"], "conditions": []}],
        "ambient": ["sfx_fire"],
    }


def scene_pipes_crime():
    pal = PAL["pipes"]
    props = [
        rect(170, 360, 170, 190, "#1a2126", stroke="#5c6a70", radius=6, label="ниша в стене"),
        rect(196, 386, 118, 138, "#0b0f12", opacity=0.9),
        poly([205, 500, 305, 470, 300, 524], "#7fb0a8", opacity=0.35),
    ]
    art = tunnel(pal, props=props, puddle=True, grating=True, glow_color="#7fb0a8")
    return {
        "id": "scene_pipes_crime", "label": "Место находки", "location": "loc_underpipes",
        "canvas": {"w": W, "h": H},
        "chapter": "ch_pipes",
        "states": [
            st("state_main", "Обычное", None, art=art),
        ],
        "slots": [
            slot("slot_crack", "Ниша в стене", ["item"], 170, 360, 170, 190,
                 entity="item_crack"),
            slot("slot_grate", "Решётка стока", ["item"], 552, 540, 190, 100,
                 entity="item_grate"),
            slot("slot_puddle", "Лужа у стока", ["item"], 640, 596, 220, 84,
                 entity="item_puddle"),
        ],
        "navigation": [
            nav("В каморки", LEFT, go_to_scene="scene_pipes_hovels"),
            nav("К шёпотному углу", RIGHT, go_to_scene="scene_pipes_shrine"),
            nav("На карту города", MAP_EXIT, open_map=True),
        ],
        "music": [{"tracks": ["music_pipes"], "conditions": []}],
        "ambient": ["sfx_drip"],
    }


def scene_pipes_hovels():
    pal = PAL["pipes"]
    props = [
        rect(120, 420, 320, 200, "#232c31", radius=6, label="нары"),
        rect(140, 440, 280, 40, "#3a4348", opacity=0.9),
        rect(760, 470, 300, 150, "#232c31", radius=6, label="тюфяк"),
        rect(780, 490, 260, 40, "#3f3a33", opacity=0.9),
        rect(1040, 430, 150, 190, "#2b2118", radius=6, stroke="#4a3a2a", label="ящик"),
        rect(1064, 452, 100, 12, "#5a4a38", opacity=0.9),
    ]
    art = tunnel(pal, props=props, puddle=False, grating=False, glow_color="#8d7f6a")
    return {
        "id": "scene_pipes_hovels", "label": "Каморки", "location": "loc_underpipes",
        "canvas": {"w": W, "h": H},
        "chapter": "ch_pipes",
        "states": [st("state_main", "Обычное", None, art=art)],
        "slots": [
            slot("slot_moth", "У нар", ["person"], 300, 300, 190, 280,
                 entity="npc_moth", sprite_scale=0.9),
            slot("slot_mira", "На тюфяке", ["person"], 900, 380, 200, 230,
                 entity="npc_mira", sprite_scale=0.8),
            slot("slot_moth_chest", "Ящик Щепки", ["container"], 1040, 430, 150, 190,
                 entity="item_moth_chest"),
        ],
        "navigation": [
            nav("К месту находки", RIGHT, go_to_scene="scene_pipes_crime"),
            nav("На карту города", MAP_EXIT, open_map=True),
        ],
        "music": [{"tracks": ["music_pipes"], "conditions": []}],
        "ambient": ["sfx_drip"],
    }


def scene_pipes_shrine():
    pal = PAL["pipes"]
    props = [
        rect(860, 200, 120, 380, "#3d4a50", radius=12, label="говорящая труба"),
        rect(846, 190, 148, 40, "#55646b", radius=8),
        ellipse(920, 560, 90, 30, "#7fb0a8", opacity=0.18),
        poly([420, 200, 660, 200, 700, 640, 380, 640], "#1c2429", opacity=0.6),
        rect(430, 240, 220, 60, "#3a2f3f", opacity=0.8),
        rect(450, 330, 180, 50, "#3a2f3f", opacity=0.7),
        rect(470, 410, 140, 44, "#3a2f3f", opacity=0.6),
    ]
    art = tunnel(pal, props=props, puddle=True, grating=False, glow_color="#9ad7c9")
    return {
        "id": "scene_pipes_shrine", "label": "Шёпотный угол", "location": "loc_underpipes",
        "canvas": {"w": W, "h": H},
        "chapter": "ch_pipes",
        "states": [
            st("state_main", "Обычное", None, art=art),
        ],
        "slots": [
            slot("slot_era", "У трубы", ["person"], 480, 290, 200, 300,
                 entity="npc_era", sprite_scale=0.95),
            slot("slot_pipe", "Говорящая труба", ["item"], 840, 200, 160, 380,
                 entity="item_whisper_pipe"),
        ],
        "navigation": [
            nav("К месту находки", LEFT, go_to_scene="scene_pipes_crime"),
            nav("На карту города", MAP_EXIT, open_map=True),
        ],
        "music": [{"tracks": ["music_pipes"], "conditions": []}],
        "ambient": ["sfx_hum"],
    }


def scene_foundry_floor():
    pal = PAL["foundry"]
    art = furnace_hall(pal, molten=True)
    art_dead = furnace_hall(pal, molten=True, props=[
        poly([300, 700, 380, 620, 520, 640, 560, 700], "#2a1a14", label="тело"),
        ellipse(430, 660, 60, 22, "#6b1f1f", opacity=0.8),
        ellipse(430, 690, 130, 30, "#4a1414", opacity=0.5),
        rect(600, 600, 120, 60, "#5a3a2a", radius=6, opacity=0.8),
    ])
    return {
        "id": "scene_foundry_floor", "label": "Плавильный зал", "location": "loc_foundry",
        "canvas": {"w": W, "h": H},
        "chapter": "ch_foundry",
        "states": [
            st("state_blood", "После находки", {"flag": "grist_dead"}, art=art_dead),
            st("state_main", "Обычное", None, art=art),
        ],
        "slots": [
            slot("slot_grist", "У ковша", ["person"], 150, 320, 200, 290,
                 entity="npc_grist", sprite_scale=0.95),
            slot("slot_furnace", "Печь", ["item"], 470, 330, 340, 240,
                 entity="item_furnace"),
        ],
        "navigation": [
            nav("В контору", RIGHT, go_to_scene="scene_foundry_office"),
            nav("На карту города", MAP_EXIT, open_map=True),
        ],
        "music": [{"tracks": ["music_foundry"], "conditions": []}],
        "ambient": ["sfx_fire"],
    }


def scene_foundry_office():
    pal = PAL["foundry"]
    props = [
        rect(120, 300, 300, 300, "#3d2a1c", radius=6, label="шкаф с бумагами"),
        rect(148, 330, 244, 8, "#6b5340", opacity=0.9),
        rect(148, 420, 244, 8, "#6b5340", opacity=0.9),
        rect(148, 510, 244, 8, "#6b5340", opacity=0.9),
        rect(760, 400, 400, 140, "#4a3626", radius=6, label="стол писаря"),
        rect(800, 440, 120, 60, "#6b5340", radius=4),
    ]
    art = interior(pal, props=props, lamps=[(300, 110), (960, 110)], floor_y=540)
    return {
        "id": "scene_foundry_office", "label": "Контора Цехa", "location": "loc_foundry",
        "canvas": {"w": W, "h": H},
        "chapter": "ch_foundry",
        "states": [st("state_main", "Обычное", None, art=art)],
        "slots": [
            slot("slot_vergo", "За столом писаря", ["person"], 800, 290, 190, 280,
                 entity="npc_vergo", sprite_scale=0.95),
            slot("slot_cabinet", "Шкаф с бумагами", ["container"], 120, 300, 300, 300,
                 entity="item_guild_cabinet"),
        ],
        "navigation": [
            nav("В плавильный зал", LEFT, go_to_scene="scene_foundry_floor"),
            nav("На карту города", MAP_EXIT, open_map=True),
        ],
        "music": [{"tracks": ["music_foundry"], "conditions": []}],
        "ambient": ["sfx_paper"],
    }


def scene_ash_dump():
    pal = PAL["ash"]
    art = ash_yard(pal, props=[
        rect(300, 400, 260, 160, "#2f2b2d", radius=8, label="куча золы"),
        ellipse(430, 470, 150, 40, "#4a4446", opacity=0.7),
    ])
    return {
        "id": "scene_ash_dump", "label": "Зольная свалка", "location": "loc_ash_yard",
        "canvas": {"w": W, "h": H},
        "chapter": "ch_foundry",
        "states": [
            st("state_main", "Обычное", None, art=art),
        ],
        "slots": [
            slot("slot_pile", "Куча золы", ["item"], 300, 400, 260, 170,
                 entity="item_ash_pile"),
            slot("slot_wreck", "Остов вагона", ["container"], 880, 340, 270, 190,
                 entity="item_wreck"),
        ],
        "navigation": [
            nav("К вагону-притону", RIGHT, go_to_scene="scene_ash_wagon"),
            nav("На карту города", MAP_EXIT, open_map=True),
        ],
        "music": [{"tracks": ["music_ash"], "conditions": []}],
        "ambient": ["sfx_wind"],
    }


def scene_ash_wagon():
    pal = PAL["copper"]
    props = [
        rect(820, 400, 320, 180, "#4a3a2a", radius=8, label="ящик с товаром"),
        rect(850, 430, 260, 20, "#6b5340", opacity=0.9),
        ellipse(480, 640, 120, 30, "#ff8b3d", opacity=0.25),
        rect(420, 620, 130, 60, "#3a2a1c", radius=8, label="жаровня"),
        ellipse(485, 626, 46, 20, "#ff7a2e", opacity=0.7),
    ]
    art = interior(pal, props=props, lamps=[(560, 110)], floor_y=600, window=(120, 200, 200, 160))
    return {
        "id": "scene_ash_wagon", "label": "Вагон-притон", "location": "loc_ash_yard",
        "canvas": {"w": W, "h": H},
        "chapter": "ch_foundry",
        "states": [st("state_main", "Обычное", None, art=art)],
        "slots": [
            slot("slot_volt", "У жаровни", ["person"], 520, 300, 200, 290,
                 entity="npc_volt", sprite_scale=0.95),
            slot("slot_volt_crate", "Ящик с товаром", ["container"], 820, 400, 320, 180,
                 entity="item_volt_crate"),
        ],
        "navigation": [
            nav("На свалку", LEFT, go_to_scene="scene_ash_dump"),
            nav("На карту города", MAP_EXIT, open_map=True),
        ],
        "music": [{"tracks": ["music_ash"], "conditions": []}],
        "ambient": ["sfx_fire"],
    }


def scene_cistern_gallery():
    pal = PAL["water"]
    props = [
        rect(960, 280, 200, 260, "#2c4048", radius=10, stroke="#4fa3b8", label="затвор"),
        ellipse(1060, 410, 60, 60, "#1b2b31", opacity=0.95),
        ellipse(1060, 410, 34, 34, "#4fa3b8", opacity=0.35),
    ]
    art = water_gallery(pal, props=props)
    return {
        "id": "scene_cistern_gallery", "label": "Водяная галерея", "location": "loc_cistern",
        "canvas": {"w": W, "h": H},
        "chapter": "ch_shaft",
        "states": [
            st("state_main", "Обычное", None, art=art),
        ],
        "slots": [
            slot("slot_water", "Вода", ["item"], 380, 500, 520, 170,
                 entity="item_cistern_water"),
            slot("slot_hatch", "Затвор", ["item"], 960, 280, 200, 260,
                 entity="item_hatch"),
        ],
        "navigation": [
            nav("На карту города", MAP_EXIT, open_map=True),
        ],
        "music": [{"tracks": ["music_water"], "conditions": []}],
        "ambient": ["sfx_drip"],
    }


def scene_shaft_gate():
    pal = PAL["shaft"]
    props = [
        ellipse(640, 400, 210, 210, "#2b2433", opacity=0.98, stroke="#6b5a7a",
                label="шлюз"),
        ellipse(640, 400, 150, 150, "#1b1622", opacity=0.98),
        ellipse(640, 400, 60, 60, "#b06fd0", opacity=0.25),
        ellipse(640, 400, 26, 26, "#e6c2ff", opacity=0.5),
        rect(600, 130, 80, 60, "#3a3040", radius=6),
        rect(600, 610, 80, 60, "#3a3040", radius=6),
    ]
    art = tunnel(pal, props=props, puddle=False, grating=False, glow_color="#b06fd0",
                 ceiling=120)
    return {
        "id": "scene_shaft_gate", "label": "Шлюз", "location": "loc_shaft",
        "canvas": {"w": W, "h": H},
        "chapter": "ch_shaft",
        "states": [
            st("state_main", "Обычное", None, art=art),
        ],
        "slots": [
            slot("slot_gate", "Шлюз шахты", ["item"], 470, 240, 340, 340,
                 entity="item_shaft_gate",
                 use_with=[{
                     "item": "item_key_shaft",
                     "consume": True,
                     "message": "Ключ провернулся тяжело, будто сам шлюз не хотел открываться.",
                     "effects": [
                         {"type": "set_flag", "flag": "shaft_open"},
                         {"type": "set_description", "entity": "item_shaft_gate",
                          "text": "Шлюз открыт. Внутри — лестница в жар."},
                         {"type": "journal_update", "quest": "quest_main",
                          "text_key": "j_shaft_open"},
                         {"type": "advance_time", "ticks": 1},
                         {"type": "teleport_player", "location": "loc_shaft",
                          "scene": "scene_shaft_descent"},
                     ],
                 }]),
        ],
        "navigation": [
            nav("На карту города", MAP_EXIT, open_map=True),
        ],
        "music": [{"tracks": ["music_shaft"], "conditions": []}],
        "ambient": ["sfx_hum"],
    }


def scene_shaft_descent():
    pal = PAL["shaft"]
    props = [
        rect(180, 320, 280, 240, "#2b2433", radius=8, stroke="#6b5a7a", label="вентили"),
        ellipse(230, 400, 42, 42, "#3a3040", stroke="#b06fd0"),
        ellipse(320, 400, 42, 42, "#3a3040", stroke="#b06fd0"),
        ellipse(410, 400, 42, 42, "#3a3040", stroke="#b06fd0"),
        rect(212, 460, 36, 70, "#6b5a7a", radius=4),
        rect(302, 460, 36, 70, "#6b5a7a", radius=4),
        rect(392, 460, 36, 70, "#6b5a7a", radius=4),
        poly([860, 560, 940, 500, 1080, 520, 1120, 600], "#241d24", label="тело зольника"),
        ellipse(980, 570, 46, 20, "#3a2f26", opacity=0.9),
    ]
    art = tunnel(pal, props=props, puddle=True, grating=True, glow_color="#b06fd0")
    return {
        "id": "scene_shaft_descent", "label": "Спуск", "location": "loc_shaft",
        "canvas": {"w": W, "h": H},
        "chapter": "ch_shaft",
        "states": [st("state_main", "Обычное", None, art=art)],
        "slots": [
            slot("slot_valves", "Вентильный узел", ["item"], 180, 320, 280, 250,
                 entity="item_valves"),
            slot("slot_corpse", "Тело зольника", ["item"], 860, 500, 280, 140,
                 entity="item_scav_corpse"),
        ],
        "navigation": [
            nav("Наверх, к шлюзу", LEFT, go_to_scene="scene_shaft_gate"),
            nav("На карту города", MAP_EXIT, open_map=True),
        ],
        "music": [{"tracks": ["music_shaft"], "conditions": []}],
        "ambient": ["sfx_hum", "sfx_steam"],
    }


def scene_core_hall():
    pal = PAL["core"]
    art = machine_core(pal, rings=True, glow=True, catwalk=True)
    return {
        "id": "scene_core_hall", "label": "Зал Сердца", "location": "loc_core",
        "canvas": {"w": W, "h": H},
        "chapter": "ch_core",
        "states": [
            st("state_main", "Обычное", None, art=art),
        ],
        "slots": [
            slot("slot_ilaria", "У жерла", ["person"], 540, 300, 210, 320,
                 entity="npc_ilaria", sprite_scale=1.0),
            slot("slot_heart_chest", "Медный ящик", ["container"], 960, 470, 230, 160,
                 entity="item_heart_chest"),
        ],
        "navigation": [
            nav("К Сердцу", RIGHT, go_to_scene="scene_core_heart"),
            nav("На карту города", MAP_EXIT, open_map=True),
        ],
        "music": [{"tracks": ["music_core"], "conditions": []}],
        "ambient": ["sfx_hum"],
    }


def scene_core_heart():
    pal = PAL["core"]
    layers = [
        rect(0, 0, W, H, "#0f0b12", label="мрак"),
        ellipse(640, 380, 560, 460, pal["wall2"], opacity=0.6),
        ellipse(640, 380, 430, 350, pal["metal"], opacity=0.85, stroke=pal["accent"]),
        ellipse(640, 380, 320, 260, pal["dark"], opacity=0.95),
        ellipse(640, 400, 240, 150, pal["accent"], opacity=0.35),
        ellipse(640, 400, 140, 80, pal["light"], opacity=0.45),
    ]
    for a in range(0, 360, 24):
        import math
        x = 640 + math.cos(math.radians(a)) * 350
        y = 380 + math.sin(math.radians(a)) * 290
        layers.append(line(640, 380, x, y, pal["metal"], 7, opacity=0.3))
    layers.append(rect(0, 620, W, 100, pal["dark"], opacity=0.85, label="поддон"))
    layers.append(rect(140, 560, 200, 60, pal["metal"], radius=6, opacity=0.8))
    layers.append(rect(940, 560, 200, 60, pal["metal"], radius=6, opacity=0.8))
    art = {"canvas": {"w": W, "h": H}, "background": "#0b0810", "layers": layers}
    return {
        "id": "scene_core_heart", "label": "Сердце", "location": "loc_core",
        "canvas": {"w": W, "h": H},
        "chapter": "ch_core",
        "states": [
            st("state_main", "Обычное", None, art=art),
        ],
        "slots": [
            slot("slot_heart", "Кожух Сердца", ["item"], 460, 220, 360, 360,
                 entity="item_heart_core"),
        ],
        "navigation": [
            nav("В зал Сердца", LEFT, go_to_scene="scene_core_hall"),
            nav("На карту города", MAP_EXIT, open_map=True),
        ],
        "music": [{"tracks": ["music_core"], "conditions": []}],
        "ambient": ["sfx_hum"],
    }


SCENES = [
    scene_watch_office, scene_watch_archive, scene_watch_coldroom,
    scene_copper_market, scene_copper_workshop, scene_copper_kettle,
    scene_pipes_crime, scene_pipes_hovels, scene_pipes_shrine,
    scene_foundry_floor, scene_foundry_office,
    scene_ash_dump, scene_ash_wagon,
    scene_cistern_gallery,
    scene_shaft_gate, scene_shaft_descent,
    scene_core_hall, scene_core_heart,
]


def scenes():
    return {fn.__name__: fn() for fn in SCENES}


# ------------------------------------------------------------------ мир

def world():
    return {"regions": [{
        "id": "region_karkas", "label": "Каркас", "map_image": "",
        "map_art": map_art(), "map_size": {"w": W, "h": H}, "parent_region": None,
        "locations": [
            {
                "id": "loc_watch", "label": "Дом Надзора", "position": {"x": 300, "y": 90},
                "travel_connections": [{"to": "loc_copper_row", "cost_ticks": 2}],
                "scenes": ["scene_watch_office", "scene_watch_archive", "scene_watch_coldroom"],
                "arrival_scene": "scene_watch_office",
                "arena": "arena_watch",
                "ambient": ["sfx_hum"],
                "music": [{"tracks": ["music_watch"], "conditions": []}],
            },
            {
                "id": "loc_copper_row", "label": "Медный ряд", "position": {"x": 640, "y": 200},
                "travel_connections": [
                    {"to": "loc_watch", "cost_ticks": 2},
                    {"to": "loc_underpipes", "cost_ticks": 2,
                     "random_encounter_table": "enc_street"},
                    {"to": "loc_foundry", "cost_ticks": 2,
                     "random_encounter_table": "enc_street"},
                    {"to": "loc_cistern", "cost_ticks": 3},
                ],
                "scenes": ["scene_copper_market", "scene_copper_workshop", "scene_copper_kettle"],
                "arrival_scene": "scene_copper_market",
                "arena": "arena_copper",
                "ambient": ["sfx_hum"],
                "music": [{"tracks": ["music_copper"], "conditions": []}],
            },
            {
                "id": "loc_underpipes", "label": "Нижние трубы", "position": {"x": 420, "y": 400},
                "travel_connections": [
                    {"to": "loc_copper_row", "cost_ticks": 2,
                     "random_encounter_table": "enc_street"},
                    {"to": "loc_ash_yard", "cost_ticks": 2,
                     "random_encounter_table": "enc_yard"},
                    {"to": "loc_cistern", "cost_ticks": 2,
                     "random_encounter_table": "enc_yard"},
                ],
                "scenes": ["scene_pipes_crime", "scene_pipes_hovels", "scene_pipes_shrine"],
                "arrival_scene": "scene_pipes_crime",
                "arena": "arena_pipes",
                "ambient": ["sfx_drip", "sfx_wind"],
                "music": [{"tracks": ["music_pipes"], "conditions": []}],
            },
            {
                "id": "loc_foundry", "label": "Литейный пролёт", "position": {"x": 900, "y": 330},
                "travel_connections": [
                    {"to": "loc_copper_row", "cost_ticks": 2,
                     "random_encounter_table": "enc_street"},
                    {"to": "loc_ash_yard", "cost_ticks": 2,
                     "random_encounter_table": "enc_yard"},
                ],
                "scenes": ["scene_foundry_floor", "scene_foundry_office"],
                "arrival_scene": "scene_foundry_floor",
                "arena": "arena_foundry",
                "ambient": ["sfx_fire"],
                "music": [{"tracks": ["music_foundry"], "conditions": []}],
            },
            {
                "id": "loc_ash_yard", "label": "Зольный двор", "position": {"x": 700, "y": 560},
                "travel_connections": [
                    {"to": "loc_underpipes", "cost_ticks": 2,
                     "random_encounter_table": "enc_yard"},
                    {"to": "loc_foundry", "cost_ticks": 2,
                     "random_encounter_table": "enc_yard"},
                ],
                "scenes": ["scene_ash_dump", "scene_ash_wagon"],
                "arrival_scene": "scene_ash_dump",
                "arena": "arena_ash",
                "camp": True,
                "ambient": ["sfx_wind"],
                "music": [{"tracks": ["music_ash"], "conditions": []}],
            },
            {
                "id": "loc_cistern", "label": "Цистерна", "position": {"x": 220, "y": 600},
                "travel_connections": [
                    {"to": "loc_copper_row", "cost_ticks": 3},
                    {"to": "loc_underpipes", "cost_ticks": 2,
                     "random_encounter_table": "enc_yard"},
                    {"to": "loc_shaft", "cost_ticks": 2,
                     "random_encounter_table": "enc_shaft"}],
                "scenes": ["scene_cistern_gallery"],
                "arrival_scene": "scene_cistern_gallery",
                "arena": "arena_cistern",
                "camp": True,
                "ambient": ["sfx_drip"],
                "music": [{"tracks": ["music_water"], "conditions": []}],
            },
            {
                "id": "loc_shaft", "label": "Шахта Сердца", "position": {"x": 430, "y": 700},
                "hidden": True,
                "travel_connections": [
                    {"to": "loc_cistern", "cost_ticks": 2,
                     "random_encounter_table": "enc_shaft"},
                    {"to": "loc_core", "cost_ticks": 3,
                     "requirements": [{"type": "flag_set", "flag": "valves_fixed"}]},
                ],
                "scenes": ["scene_shaft_gate", "scene_shaft_descent"],
                "arrival_scene": "scene_shaft_gate",
                "arena": "arena_shaft",
                "ambient": ["sfx_hum", "sfx_steam"],
                "music": [{"tracks": ["music_shaft"], "conditions": []}],
            },
            {
                "id": "loc_core", "label": "Поддон", "position": {"x": 640, "y": 710},
                "hidden": True,
                "travel_connections": [
                    {"to": "loc_shaft", "cost_ticks": 3}],
                "scenes": ["scene_core_hall", "scene_core_heart"],
                "arrival_scene": "scene_core_hall",
                "arena": "arena_core",
                "ambient": ["sfx_hum"],
                "music": [{"tracks": ["music_core"], "conditions": []}],
            },
        ],
    }]}
