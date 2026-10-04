"""Сцены: ArtDoc-фоны, слоты поверх нарисованных объектов, зоны переходов."""

from common import (art, layer, rect, ell, poly, line, text, grad, lamp, boiler,
                    pipe_run, gear, window, crate, floor_boards, wall_panels,
                    fog_band, slot, nav, state, scene, CANVAS_W, CANVAS_H)
from c_items import ITEMS

SCENES = {}


def add(s):
    SCENES[s["id"]] = s


def use_with(item_id, effects, consume=False, message=None):
    u = {"item": item_id, "effects": effects}
    if consume:
        u["consume"] = True
    if message:
        u["message"] = message
    return u


# ======================================================================
# 1. Пропускной двор
# ======================================================================

def passcourt_art(night=False):
    sky = grad("#0f1a24", "#3a2c22", 90) if night else grad("#4b5b6b", "#8a7a5f", 90)
    L = [layer("небо", rect(0, 0, CANVAS_W, 300, sky)),
         layer("дым над городом", rect(0, 180, CANVAS_W, 130, "#7d766c", opacity=0.28)),
         layer("стена", rect(0, 210, CANVAS_W, 260, grad("#5a5045", "#3b342c", 90)))]
    x = 0
    while x < CANVAS_W:
        h = 120 + (x // 160) % 3 * 26
        L.append(layer("зубец стены", rect(x, 210 - h // 4, 96, h, "#4d443a")))
        x += 160
    L.append(layer("ворота", rect(120, 250, 250, 300, grad("#6d5a3c", "#33291d", 90), radius=6)))
    L.append(layer("створка", rect(140, 268, 100, 282, "#57472f", radius=3)))
    L.append(layer("створка", rect(248, 268, 100, 282, "#57472f", radius=3)))
    L.append(layer("засов", rect(146, 396, 196, 14, "#7d6a4a")))
    L += gear(330, 330, 46, "#6f5c3d")
    L.append(layer("башня", rect(960, 120, 250, 400, grad("#57493c", "#2f2921", 90))))
    L.append(layer("зубцы башни", rect(944, 100, 282, 28, "#453a2f")))
    L += window(1000, 180, 60, 90, "#c9a06a")
    L += window(1110, 180, 60, 90, "#7a6242")
    L.append(layer("пол", rect(0, 470, CANVAS_W, 250, grad("#3f382f", "#2b251f", 90))))
    for i in range(1, 8):
        L.append(layer("шов мостовой", line(0, 470 + i * 32, CANVAS_W, 470 + i * 32, "#241f19", 3, opacity=0.55)))
    L.append(layer("лужа", ell(700, 610, 130, 26, "#5c6b74", opacity=0.35)))
    L.append(layer("лужа", ell(420, 660, 90, 20, "#5c6b74", opacity=0.3)))
    # доска объявлений
    L.append(layer("столб доски", rect(596, 340, 16, 132, "#4a3d2c")))
    L.append(layer("доска", rect(548, 300, 190, 140, grad("#7a6440", "#4f4029", 90), radius=4)))
    L.append(layer("лист", rect(566, 318, 70, 46, "#d9cdb2", opacity=0.85)))
    L.append(layer("лист", rect(648, 326, 74, 60, "#cfc2a6", opacity=0.8)))
    L.append(layer("лист", rect(572, 376, 100, 44, "#c6b89b", opacity=0.75)))
    # бочки и ящики
    L.append(layer("бочка", rect(830, 470, 74, 96, grad("#57462f", "#2f2618", 90), radius=10)))
    L.append(layer("обруч", line(830, 500, 904, 500, "#8a6f3f", 4)))
    L += crate(920, 500, 110, 76)
    L += crate(300, 520, 90, 60)
    if night:
        for lx, ly in ((700, 300), (1050, 250), (250, 300)):
            L += lamp(lx, ly, glow="#ffb765", r=95)
    L.append(fog_band(240, 90, "#8f8a80", 0.16))
    return art("#1a1714", *L)


add(scene(
    "scene_passcourt", "Пропускной двор", "loc_passcourt",
    states=[
        state("state_day", "Днём", passcourt_art(False),
              condition={"time_of_day": ["morning", "day"]}),
        state("state_night", "Ночью", passcourt_art(True), condition=None),
    ],
    slots=[
        slot("slot_pepel", "У ворот", ["person"], 372, 296, 150, 340,
             default_entity="npc_pepel", sprite_scale=0.95),
        slot("slot_board", "Доска объявлений", ["item"], 548, 300, 190, 140,
             default_entity="item_board_passcourt"),
        slot("slot_barrel", "Бочка", ["container"], 830, 470, 74, 96),
    ],
    navigation=[
        nav("За ворота", {"x": 120, "y": 250, "w": 250, "h": 300}, open_map=True),
        nav("В город", {"x": 1040, "y": 470, "w": 240, "h": 250}, open_map=True),
    ],
    ambient=["sfx_ash_wind"],
    chapter="ch_prologue",
))

# ======================================================================
# 2. Медная литейная
# ======================================================================

def forgehall_art(dark=False):
    glow = "#e08a3c" if not dark else "#b4622a"
    L = [layer("свод", rect(0, 0, CANVAS_W, 110, grad("#241f1b", "#151210", 90)))]
    L += wall_panels(96, 470, base="#4a3f34", panel="#3a3129",
                     lamps=[(360, 150), (1000, 150)] if dark else [])
    L.append(layer("дымоход", rect(560, 0, 200, 120, "#2a241f")))
    # горн
    L.append(layer("горн", rect(70, 190, 300, 300, grad("#5b4a38", "#241d17", 90), radius=12)))
    L.append(layer("устье горна", ell(220, 330, 96, 74, grad("#f0a24a", "#8a3f18", 90))))
    L.append(layer("жар", ell(220, 330, 150, 116, glow, opacity=0.22)))
    L.append(layer("козырёк горна", rect(40, 160, 360, 40, "#4d3f31", radius=6)))
    L += pipe_run(220, 190, 220, 40, "#5a4c3d", 16)
    L += pipe_run(370, 240, 620, 200, "#5a4c3d", 12)
    # ковш и рельсы
    L.append(layer("ковш", poly([430, 470, 560, 470, 540, 540, 450, 540], "#4a3f34")))
    L.append(layer("струя", rect(492, 500, 10, 60, "#f0a24a", opacity=0.7)))
    L.append(layer("рельс", line(0, 600, CANVAS_W, 586, "#6a5b47", 6)))
    # шкаф
    L.append(layer("шкаф", rect(980, 250, 170, 270, grad("#57493a", "#302820", 90), radius=4)))
    L.append(layer("дверца шкафа", rect(996, 268, 68, 234, "#43382c", radius=3)))
    L.append(layer("дверца шкафа", rect(1078, 268, 60, 234, "#43382c", radius=3)))
    L.append(layer("замок", rect(1056, 372, 12, 26, "#b39147")))
    # тело
    L.append(layer("пятно шлака", ell(700, 620, 210, 60, "#2a241d", opacity=0.8)))
    L.append(layer("тело", poly([600, 596, 760, 570, 830, 604, 700, 630], "#3b3229")))
    L.append(layer("голова", ell(600, 596, 30, 24, "#6b5a49")))
    L.append(layer("рука", line(690, 600, 640, 636, "#6b5a49", 12)))
    L += floor_boards(470, 720, "#3a322a", "#2b251f", 7)
    L.append(layer("кольцо подъёмника", ell(760, 120, 60, 26, "#3a332b")))
    L.append(layer("цепь", line(760, 120, 760, 240, "#6a5b47", 4)))
    L.append(layer("крюк", ell(760, 250, 14, 14, "#6a5b47")))
    L.append(layer("лестница", rect(40, 556, 200, 150, "#221c17", opacity=0.55)))
    for i in range(6):
        L.append(layer("ступень", line(44, 570 + i * 24, 236, 570 + i * 24, "#5b4a35", 5)))
    L.append(fog_band(430, 100, "#8f8a80", 0.12))
    return art("#151210", *L)


add(scene(
    "scene_forgehall", "Медная литейная", "loc_copperyard",
    states=[
        state("state_work", "Смена", forgehall_art(False),
              condition={"time_of_day": ["morning", "day"]}),
        state("state_night", "Ночью", forgehall_art(True), condition=None),
    ],
    slots=[
        slot("slot_sera", "У тела", ["person"], 470, 300, 150, 340,
             default_entity="npc_sera", sprite_scale=0.95),
        slot("slot_body", "Тело", ["item"], 600, 560, 240, 90, default_entity="item_body_1"),
        slot("slot_furnace", "Горн", ["prop"], 70, 190, 300, 300, default_entity="item_furnace_forge"),
        slot("slot_locker", "Служебный шкаф", ["container"], 980, 250, 170, 270,
             default_entity="item_locker",
             use_with=[use_with("item_lockpicks",
                                [{"type": "add_item", "item": "item_board_order", "quantity": 1},
                                 {"type": "set_flag", "flag": "crime_trespass"},
                                 {"type": "commit_crime", "id": "crime_trespass"},
                                 {"type": "show_message", "text": "В шкафу — приказ Курии и чужие сапоги."}],
                                message="Замок поддался отмычкам."),
                       use_with("item_wrench",
                                [{"type": "show_message", "text": "Шкаф заперт на висячий замок: нужны отмычки или лом."}])]),
    ],
    navigation=[
        nav("К сливным лоткам", {"x": 40, "y": 556, "w": 200, "h": 150},
            go_to_scene="scene_drains"),
        nav("На карту", {"x": 1080, "y": 40, "w": 180, "h": 110}, open_map=True),
    ],
    ambient=["sfx_boiler"],
    chapter="ch_prologue",
))

# ======================================================================
# 3. Сливные лотки
# ======================================================================

def drains_art():
    L = [layer("свод", ell(640, 700, 900, 640, grad("#2a2620", "#141210", 90)))]
    L.append(layer("кирпич свода", poly([0, 720, 0, 300, 240, 130, 640, 60, 1040, 130, 1280, 300, 1280, 720],
                                        "#2f2a23")))
    for i in range(7):
        L.append(layer("шов кладки", line(60 + i * 190, 90 + (i % 3) * 40, 60 + i * 190, 460, "#221e19", 4, opacity=0.6)))
    L += pipe_run(120, 200, 1180, 170, "#4d4438", 18)
    L += pipe_run(180, 250, 1100, 236, "#443c32", 12)
    L.append(layer("канал", rect(0, 560, CANVAS_W, 160, grad("#20242a", "#141719", 90))))
    L.append(layer("вода", rect(0, 596, CANVAS_W, 124, grad("#26333b", "#182228", 90), opacity=0.95)))
    for i in range(9):
        L.append(layer("волна", line(60 + i * 150, 620 + (i % 4) * 20, 190 + i * 150, 620 + ((i + 2) % 4) * 20,
                                      "#48606c", 3, opacity=0.5)))
    L.append(layer("мостки", rect(80, 470, 460, 26, "#4a3e30")))
    L.append(layer("опора", rect(120, 470, 16, 100, "#3b3227")))
    L.append(layer("опора", rect(500, 470, 16, 100, "#3b3227")))
    L.append(layer("решётка", rect(880, 370, 190, 190, "#3b332a", radius=6)))
    for i in range(5):
        L.append(layer("прут", line(890 + i * 40, 380, 890 + i * 40, 550, "#6b5c46", 7)))
    for i in range(4):
        L.append(layer("прут", line(886, 388 + i * 46, 1064, 388 + i * 46, "#6b5c46", 7)))
    L.append(layer("свет из решётки", ell(975, 470, 130, 120, "#c9a06a", opacity=0.16)))
    L += lamp(300, 300, glow="#7fa7b8", r=70, core_r=9)
    L.append(layer("лампа", rect(292, 236, 18, 40, "#3b332a")))
    L.append(fog_band(430, 120, "#8f8a80", 0.14))
    return art("#121011", *L)


add(scene(
    "scene_drains", "Сливные лотки", "loc_copperyard",
    states=[state("state_night", "Под цехом", drains_art(), condition=None)],
    slots=[
        slot("slot_grating", "Решётка стока", ["prop"], 880, 370, 190, 190,
             default_entity="item_grating"),
    ],
    navigation=[
        nav("Наверх, в литейную", {"x": 44, "y": 300, "w": 190, "h": 300},
            go_to_scene="scene_forgehall"),
        nav("На карту", {"x": 1100, "y": 60, "w": 160, "h": 120}, open_map=True),
    ],
    ambient=["sfx_water", "sfx_boiler"],
    chapter="ch_prologue",
))

# ======================================================================
# 4. Ржавый рынок
# ======================================================================

def market_art(night=False):
    sky = grad("#101a22", "#332a22", 90) if night else grad("#59677a", "#8d7c60", 90)
    L = [layer("небо", rect(0, 0, CANVAS_W, 260, sky))]
    L.append(layer("дома", rect(0, 150, 380, 330, "#453b31")))
    L.append(layer("дом", rect(900, 120, 380, 360, "#4b4036")))
    L += window(60, 200, 70, 100, "#c9a06a")
    L += window(200, 190, 70, 100, "#a8845a")
    L += window(980, 200, 80, 110, "#c9a06a")
    L += window(1120, 210, 80, 110, "#8f7248")
    # прилавки
    L.append(layer("прилавок", rect(620, 430, 330, 120, grad("#5f4c33", "#382c1d", 90), radius=6)))
    L.append(layer("полка", rect(620, 330, 330, 110, "#4a3a26")))
    for i in range(5):
        L.append(layer("товар", rect(640 + i * 60, 350, 40, 40, "#7a6338", radius=4)))
        L.append(layer("товар", rect(650 + i * 60, 400, 26, 32, "#6a5a3a", radius=3)))
    L.append(layer("навес", poly([596, 300, 976, 300, 1010, 260, 566, 260], "#7a3f2c")))
    L.append(layer("стойка навеса", rect(600, 300, 12, 130, "#4a3a26")))
    L.append(layer("стойка навеса", rect(960, 300, 12, 130, "#4a3a26")))
    L.append(layer("прилавок малый", rect(180, 470, 260, 90, "#544630", radius=5)))
    L.append(layer("навес малый", poly([160, 350, 460, 350, 490, 320, 130, 320], "#3f5a4a")))
    L.append(layer("пол", rect(0, 480, CANVAS_W, 240, grad("#443b30", "#2c261f", 90))))
    for i in range(1, 7):
        L.append(layer("шов", line(0, 480 + i * 34, CANVAS_W, 480 + i * 34, "#241f19", 3, opacity=0.5)))
    L += crate(500, 508, 96, 66)
    L += crate(1130, 520, 110, 80)
    L += boiler(120, 560, 90, 150, glow=None)
    if night:
        L += lamp(700, 330, glow="#ffb765", r=110)
        L += lamp(300, 380, glow="#ffb765", r=90)
    L.append(fog_band(200, 100, "#8f8a80", 0.14))
    return art("#171512", *L)


add(scene(
    "scene_market", "Ржавый рынок", "loc_market",
    states=[
        state("state_day", "Днём", market_art(False), condition={"time_of_day": ["morning", "day"]}),
        state("state_night", "Вечером", market_art(True), condition=None),
    ],
    slots=[
        slot("slot_gvozd", "За прилавком", ["person"], 780, 290, 150, 340,
             default_entity="npc_gvozd", sprite_scale=0.95),
        slot("slot_board_market", "Рыночная доска", ["item"], 180, 470, 260, 90,
             default_entity="item_board_market"),
        slot("slot_crate", "Ящик у прилавка", ["container"], 500, 508, 96, 66),
    ],
    navigation=[
        nav("На задворки", {"x": 40, "y": 300, "w": 150, "h": 330},
            go_to_scene="scene_marketback"),
        nav("На карту", {"x": 1100, "y": 40, "w": 160, "h": 120}, open_map=True),
    ],
    ambient=["sfx_click"],
    chapter="ch_investigation",
))

# ======================================================================
# 5. Задворки рынка
# ======================================================================

def marketback_art():
    L = [layer("стена дома", rect(0, 0, CANVAS_W, 470, grad("#4a4036", "#2e2822", 90)))]
    for i in range(4):
        L += window(120 + i * 280, 90, 90, 120, "#8f7248" if i % 2 else "#b08c56")
    L.append(layer("двери", rect(300, 300, 130, 170, "#3a2f24", radius=4)))
    L.append(layer("двери", rect(880, 320, 130, 150, "#3a2f24", radius=4)))
    L += pipe_run(0, 260, 1280, 250, "#4f453a", 14)
    L.append(layer("верёвка", line(0, 200, CANVAS_W, 190, "#6a5f4a", 3)))
    for i in range(5):
        L.append(layer("бельё", rect(120 + i * 240, 200, 90, 70, "#7d7466", opacity=0.75)))
    L += floor_boards(470, 720, "#3d352c", "#2a241e", 8)
    L.append(layer("отвал", ell(950, 560, 210, 90, "#39322a")))
    L.append(layer("отвал", poly([770, 560, 1130, 560, 1090, 640, 810, 640], "#332c25")))
    for i in range(12):
        L.append(layer("шлак", ell(800 + i * 28, 580 + (i % 5) * 12, 12, 8, "#5b5045", opacity=0.8)))
    L += crate(300, 508, 110, 76)
    L += crate(430, 530, 90, 60)
    L.append(layer("ящик", rect(560, 470, 120, 110, "#4a3c2b", radius=4)))
    L.append(layer("крышка", line(560, 500, 680, 500, "#2c241a", 4)))
    L += lamp(160, 260, glow="#ffb765", r=70)
    L.append(fog_band(420, 110, "#8f8a80", 0.12))
    return art("#141210", *L)


add(scene(
    "scene_marketback", "Задворки рынка", "loc_market",
    states=[state("state_one", "Задворки", marketback_art(), condition=None)],
    slots=[
        slot("slot_kir", "На ящике", ["person"], 540, 330, 150, 260,
             default_entity="npc_kir", sprite_scale=0.9),
        slot("slot_dump", "Отвал шлака", ["prop"], 770, 490, 360, 150,
             default_entity="item_dump_market"),
    ],
    navigation=[
        nav("К прилавкам", {"x": 0, "y": 300, "w": 120, "h": 330},
            go_to_scene="scene_market"),
        nav("На карту", {"x": 1140, "y": 40, "w": 140, "h": 110}, open_map=True),
    ],
    ambient=["sfx_metal_step"],
    chapter="ch_investigation",
))

# ======================================================================
# 6. Корчма «Тёплый шов»
# ======================================================================

def tavern_art(night=True):
    L = [layer("потолок", rect(0, 0, CANVAS_W, 130, grad("#2b231c", "#171310", 90)))]
    for i in range(6):
        L.append(layer("балка", rect(i * 220, 0, 26, 140, "#3a2d22")))
    L += wall_panels(110, 470, base="#4b3d2f", panel="#413427")
    L += window(1080, 160, 90, 110, "#5b6a72")
    L.append(layer("очаг", rect(800, 240, 260, 240, grad("#5a4636", "#2b2016", 90), radius=10)))
    L.append(layer("устье очага", ell(930, 400, 90, 70, grad("#f0b055", "#8a3f18", 90))))
    L.append(layer("жар", ell(930, 400, 150, 116, "#e08a3c", opacity=0.22)))
    L.append(layer("котёл над огнём", ell(930, 300, 52, 34, "#2f2a24")))
    L.append(layer("дымоход", rect(860, 0, 140, 240, "#2f2721")))
    L.append(layer("стойка", rect(480, 420, 300, 90, grad("#6a5334", "#3a2c1c", 90), radius=6)))
    L.append(layer("полка", rect(430, 250, 400, 120, "#4c3b28")))
    for i in range(6):
        L.append(layer("кружка", rect(450 + i * 62, 290, 34, 46, "#7d6a4a", radius=4)))
    L.append(layer("стол", poly([60, 500, 420, 480, 460, 560, 30, 580], "#4e3d2a")))
    L.append(layer("лавка", poly([40, 570, 470, 552, 490, 596, 20, 616], "#3a2d20")))
    L.append(layer("стол", poly([1000, 470, 1240, 490, 1250, 560, 990, 545], "#4e3d2a")))
    L.append(layer("лавка", poly([990, 545, 1250, 560, 1250, 600, 980, 588], "#3a2d20")))
    L.append(layer("гость", ell(1080, 452, 26, 30, "#3a3129")))
    L.append(layer("гость", ell(1160, 462, 26, 30, "#332b24")))
    L.append(layer("пол", rect(0, 470, CANVAS_W, 250, grad("#3f3227", "#251c15", 90))))
    for i in range(6):
        L.append(layer("шов", line(0, 486 + i * 38, CANVAS_W, 486 + i * 38, "#1e1712", 3, opacity=0.5)))
    L.append(layer("лестница", rect(990, 150, 240, 330, "#2b241c", opacity=0.9)))
    for i in range(8):
        L.append(layer("ступень", line(1000, 180 + i * 38, 1226, 180 + i * 38, "#5b4632", 6)))
    L += lamp(360, 220, glow="#ffb765", r=120)
    L += lamp(700, 250, glow="#ffb765", r=100)
    L += lamp(120, 300, glow="#ffb765", r=80)
    L.append(fog_band(420, 90, "#9b8b74", 0.12))
    return art("#161210", *L)


add(scene(
    "scene_tavern", "Зал «Тёплого шва»", "loc_tavern",
    states=[state("state_inside", "Вечер", tavern_art(), condition=None)],
    slots=[
        slot("slot_marla", "За стойкой", ["person"], 520, 280, 150, 340,
             default_entity="npc_marla", sprite_scale=0.95),
        slot("slot_hearth", "Очаг", ["prop"], 800, 240, 260, 240,
             default_entity="item_hearth"),
        slot("slot_table", "Дальний стол", ["item"], 1000, 470, 250, 120),
    ],
    navigation=[
        nav("В комнату наверху", {"x": 990, "y": 150, "w": 240, "h": 330},
            go_to_scene="scene_room"),
        nav("На рынок", {"x": 40, "y": 300, "w": 130, "h": 280}, open_map=True),
    ],
    ambient=["sfx_boiler"],
    chapter="ch_investigation",
))

# ======================================================================
# 7. Комната над корчмой
# ======================================================================

def room_art():
    L = [layer("потолок", rect(0, 0, CANVAS_W, 120, "#241d17")),
         layer("стена", rect(0, 100, CANVAS_W, 380, grad("#4a3d30", "#332a21", 90)))]
    L += window(900, 160, 150, 130, "#4e5a63")
    L.append(layer("ставень", rect(880, 150, 20, 150, "#3a2d20")))
    L.append(layer("шкаф", rect(120, 200, 220, 280, "#4a3a29", radius=4)))
    L.append(layer("полка", line(120, 300, 340, 300, "#2b2016", 6)))
    L.append(layer("труба", line(430, 0, 430, 470, "#5a4c3d", 20)))
    L.append(layer("задвижка", rect(400, 300, 60, 26, "#7d6a4a", radius=4)))
    L.append(layer("кровать", rect(560, 430, 520, 200, grad("#5a4a36", "#302619", 90), radius=8)))
    L.append(layer("подушка", rect(600, 400, 150, 60, "#8d7f68", radius=10)))
    L.append(layer("одеяло", rect(760, 410, 300, 190, "#5f5240", radius=8)))
    L.append(layer("стол", rect(380, 420, 150, 110, "#4a3a29", radius=5)))
    L.append(layer("свеча", rect(444, 372, 16, 50, "#d8cbaa")))
    L.append(layer("огонёк", ell(452, 364, 10, 16, "#ffca7a", 0.9)))
    L.append(layer("пол", rect(0, 470, CANVAS_W, 250, grad("#3a2f24", "#231b14", 90))))
    for i in range(6):
        L.append(layer("шов", line(0, 486 + i * 40, CANVAS_W, 486 + i * 40, "#1d1610", 3, opacity=0.5)))
    L.append(layer("умывальник", rect(1100, 430, 110, 120, "#43372a", radius=4)))
    L.append(layer("таз", ell(1155, 430, 46, 16, "#8d7f68")))
    L += lamp(452, 300, glow="#ffb765", r=110)
    return art("#161210", *L)


add(scene(
    "scene_room", "Комната над корчмой", "loc_tavern",
    states=[state("state_room", "Комната", room_art(), condition=None)],
    slots=[
        slot("slot_bed", "Кровать", ["prop"], 560, 400, 520, 230, default_entity="item_bed"),
        slot("slot_wash", "Умывальник", ["prop"], 1100, 420, 110, 130,
             default_entity="item_washstand"),
    ],
    navigation=[
        nav("Вниз, в зал", {"x": 40, "y": 300, "w": 140, "h": 300}, go_to_scene="scene_tavern"),
        nav("На карту", {"x": 1100, "y": 60, "w": 160, "h": 120}, open_map=True),
    ],
    ambient=["sfx_boiler"],
    chapter="ch_investigation",
))

# ======================================================================
# 8. Литейная слобода
# ======================================================================

def sloboda_art(night=False):
    sky = grad("#0f1a22", "#2e2620", 90) if night else grad("#5a6878", "#8a7a5f", 90)
    L = [layer("небо", rect(0, 0, CANVAS_W, 220, sky)),
         layer("дом", rect(0, 100, 430, 400, "#4b4034")),
         layer("дом", rect(430, 60, 340, 440, "#42382e")),
         layer("дом Векселя", rect(770, 90, 510, 410, "#4e4234"))]
    for i in range(3):
        L += window(60 + i * 130, 160, 80, 110, "#c9a06a" if not night else "#8f6a3a")
    for i in range(2):
        L += window(500 + i * 130, 130, 80, 110, "#b08c56")
    L += window(830, 160, 90, 120, "#c9a06a")
    L += window(1180, 160, 80, 110, "#8f7248")
    L.append(layer("крыша", poly([0, 100, 430, 100, 400, 60, 30, 60], "#332b23")))
    L.append(layer("крыша", poly([430, 60, 770, 60, 740, 20, 460, 20], "#2f2820")))
    L.append(layer("крыша", poly([770, 90, 1280, 90, 1260, 50, 790, 50], "#332b23")))
    L.append(layer("дверной проём", rect(880, 300, 150, 200, "#241d17")))
    L.append(layer("косяк", rect(866, 290, 20, 210, "#5a4a36")))
    L.append(layer("косяк", rect(1024, 290, 20, 210, "#5a4a36")))
    L.append(layer("сейф", rect(900, 360, 120, 120, grad("#5a5045", "#2e2a24", 90), radius=6)))
    L.append(layer("дверца сейфа", rect(912, 372, 96, 96, "#463f37", radius=4)))
    L.append(layer("колесо сейфа", ell(960, 420, 22, 22, "#8a7a58")))
    L.append(layer("проём", rect(180, 320, 130, 180, "#2a231c")))
    L.append(layer("пол", rect(0, 450, CANVAS_W, 270, grad("#413830", "#2a241e", 90))))
    for i in range(1, 7):
        L.append(layer("шов", line(0, 450 + i * 38, CANVAS_W, 450 + i * 38, "#241f19", 3, opacity=0.5)))
    L.append(layer("колодец", rect(1180, 470, 90, 150, "#4a4038", radius=6)))
    L.append(layer("колодец, ворот", line(1190, 490, 1260, 490, "#7d6a4a", 8)))
    L += crate(300, 520, 110, 80)
    L += pipe_run(0, 250, 1280, 240, "#4f453a", 12)
    if night:
        L += lamp(700, 250, glow="#ffb765", r=110)
        L += lamp(300, 220, glow="#ffb765", r=90)
    L.append(fog_band(180, 90, "#8f8a80", 0.14))
    return art("#171512", *L)


add(scene(
    "scene_sloboda", "Литейная слобода", "loc_sloboda",
    states=[
        state("state_day", "Днём", sloboda_art(False), condition={"time_of_day": ["morning", "day"]}),
        state("state_night", "Вечером", sloboda_art(True), condition=None),
    ],
    slots=[
        slot("slot_veksel", "У крыльца", ["person"], 640, 300, 160, 320,
             default_entity="npc_veksel", sprite_scale=0.95),
        slot("slot_safe", "Сейф в доме", ["container"], 900, 360, 120, 120,
             default_entity="item_safe_veksel"),
        slot("slot_well", "Колодец", ["prop"], 1180, 470, 90, 150),
    ],
    navigation=[
        nav("К мастерской Шпильки", {"x": 180, "y": 320, "w": 130, "h": 180},
            go_to_scene="scene_gnat_hut"),
        nav("На карту", {"x": 20, "y": 40, "w": 150, "h": 120}, open_map=True),
    ],
    ambient=["sfx_metal_step"],
    chapter="ch_investigation",
))

# ======================================================================
# 9. Мастерская Шпильки
# ======================================================================

def gnat_art():
    L = [layer("стена", rect(0, 0, CANVAS_W, 470, grad("#453b31", "#2b241e", 90)))]
    for i in range(3):
        L += window(140 + i * 380, 120, 110, 120, "#6b5a44")
    L.append(layer("доски на окне", rect(150, 170, 110, 18, "#3a2d20", rotate=8)))
    L.append(layer("верстак", rect(120, 380, 620, 90, grad("#6a5334", "#3a2c1c", 90), radius=5)))
    L.append(layer("тиски", rect(180, 340, 80, 44, "#5a5045", radius=4)))
    for i in range(7):
        L.append(layer("инструмент", rect(300 + i * 46, 344, 10, 40, "#7d6a4a")))
    L.append(layer("станок", rect(800, 300, 300, 170, grad("#4f463c", "#2a251f", 90), radius=8)))
    L.append(layer("патрон станка", ell(880, 380, 46, 46, "#5d5245")))
    L.append(layer("маховик", ell(1050, 400, 40, 40, "#6d6153")))
    L.append(layer("станина", rect(820, 470, 260, 40, "#3a332b")))
    L.append(layer("полка с часами", rect(40, 150, 260, 140, "#4a3a29")))
    for i in range(3):
        L.append(layer("часы", ell(90 + i * 80, 220, 30, 30, "#7d6a4a")))
        L.append(layer("стрелка", line(90 + i * 80, 220, 90 + i * 80, 200, "#241f19", 3)))
    L += floor_boards(470, 720, "#3a322a", "#282219", 7)
    L.append(layer("стружка", ell(560, 560, 130, 30, "#514840", opacity=0.7)))
    L += lamp(640, 220, glow="#ffb765", r=120)
    L.append(fog_band(430, 100, "#8f8a80", 0.1))
    return art("#151210", *L)


add(scene(
    "scene_gnat_hut", "Мастерская Шпильки", "loc_sloboda",
    states=[state("state_shop", "Мастерская", gnat_art(), condition=None)],
    slots=[
        slot("slot_gnat", "У верстака", ["person"], 420, 300, 150, 340,
             default_entity="npc_gnat", sprite_scale=0.95),
        slot("slot_lathe", "Токарный станок", ["prop"], 800, 300, 300, 170,
             default_entity="item_lathe"),
    ],
    navigation=[
        nav("На улицу", {"x": 40, "y": 300, "w": 140, "h": 300},
            go_to_scene="scene_sloboda"),
        nav("На карту", {"x": 1120, "y": 40, "w": 140, "h": 110}, open_map=True),
    ],
    ambient=["sfx_gear"],
    chapter="ch_investigation",
))

# ======================================================================
# 10. Карантинный барак
# ======================================================================

def quarantine_art():
    L = [layer("потолок", rect(0, 0, CANVAS_W, 120, grad("#2a241e", "#161310", 90)))]
    for i in range(8):
        L.append(layer("балка", rect(i * 170, 0, 20, 130, "#3a2d22")))
    L.append(layer("стена", rect(0, 110, CANVAS_W, 380, grad("#4a4238", "#2f2a24", 90))))
    L += window(900, 150, 120, 110, "#63707a")
    L.append(layer("кровать", rect(60, 400, 200, 220, "#4a3f34", radius=6)))
    L.append(layer("кровать", rect(280, 400, 200, 220, "#4a3f34", radius=6)))
    L.append(layer("кровать", rect(500, 400, 200, 220, "#4a3f34", radius=6)))
    L.append(layer("матрас", rect(70, 410, 180, 60, "#6a5f4c", radius=8)))
    L.append(layer("матрас", rect(290, 410, 180, 60, "#6a5f4c", radius=8)))
    L.append(layer("матрас", rect(510, 410, 180, 60, "#6a5f4c", radius=8)))
    L.append(layer("больной", ell(350, 392, 30, 26, "#7a6a56")))
    L.append(layer("больной", ell(570, 396, 28, 24, "#6d5d4b")))
    L.append(layer("печь", rect(980, 250, 240, 230, grad("#5b4a38", "#2a2016", 90), radius=10)))
    L.append(layer("устье печи", rect(1010, 300, 120, 90, "#241c14", radius=6)))
    L.append(layer("огонь", ell(1070, 344, 40, 30, "#e08a3c", opacity=0.75)))
    L.append(layer("труба печи", rect(1060, 130, 60, 130, "#4a3f34")))
    L.append(layer("вьюшка", ell(1090, 250, 24, 12, "#7d6a4a")))
    L.append(layer("пол", rect(0, 470, CANVAS_W, 250, grad("#3d352c", "#282219", 90))))
    for i in range(1, 6):
        L.append(layer("шов", line(0, 470 + i * 42, CANVAS_W, 470 + i * 42, "#221c16", 3, opacity=0.5)))
    L.append(layer("таз", ell(880, 600, 56, 20, "#8d7f68")))
    L.append(layer("ведро", rect(820, 560, 50, 60, "#4f463c", radius=4)))
    L += lamp(760, 200, glow="#ffb765", r=110)
    L.append(fog_band(400, 110, "#9b8b74", 0.12))
    return art("#171410", *L)


add(scene(
    "scene_quarantine", "Карантинный барак", "loc_quarantine",
    states=[state("state_ward", "Барак", quarantine_art(), condition=None)],
    slots=[
        slot("slot_klepa", "У печи", ["person"], 780, 300, 150, 340,
             default_entity="npc_klepa", sprite_scale=0.95),
        slot("slot_bunks", "Койки", ["prop"], 60, 400, 640, 220, default_entity="item_bunks"),
        slot("slot_stove", "Печь барака", ["prop"], 980, 250, 240, 230,
             default_entity="item_stove_barrack"),
    ],
    navigation=[
        nav("На карту", {"x": 40, "y": 40, "w": 160, "h": 120}, open_map=True),
    ],
    ambient=["sfx_boiler"],
    chapter="ch_investigation",
))

# ======================================================================
# 11. Часовня Остывшего Пламени
# ======================================================================

def chapel_art():
    L = [layer("свод", ell(640, 300, 620, 340, grad("#2a2a2e", "#12100f", 90))),
         layer("стена", rect(0, 120, CANVAS_W, 380, grad("#3b3a3a", "#232120", 90)))]
    for i in range(2):
        L.append(layer("колонна", rect(200 + i * 880, 120, 90, 400, grad("#4a4741", "#2b2926", 90))))
        L.append(layer("капитель", rect(180 + i * 880, 110, 130, 30, "#565248")))
    for i in range(3):
        L += window(340 + i * 220, 150, 90, 200, ["#5f6f8a", "#8a5f5f", "#6f7f5f"][i])
    L.append(layer("алтарь", rect(520, 330, 260, 140, grad("#5c5548", "#2e2a25", 90), radius=8)))
    L.append(layer("плита", rect(540, 310, 220, 30, "#6d6558", radius=4)))
    L.append(layer("чаша", ell(650, 300, 44, 16, "#8a7a58")))
    L.append(layer("остывшее пламя", poly([650, 250, 672, 300, 650, 292, 628, 300], "#7fa7b8", opacity=0.85)))
    L.append(layer("свет чаши", ell(650, 280, 130, 110, "#7fa7b8", opacity=0.14)))
    for i in range(6):
        L.append(layer("свеча", rect(120 + i * 200, 420, 14, 50, "#d8cbaa")))
        L.append(layer("огонёк", ell(127 + i * 200, 412, 8, 14, "#ffca7a", 0.85)))
    L.append(layer("пол", rect(0, 500, CANVAS_W, 220, grad("#3b3630", "#26231f", 90))))
    for i in range(4):
        L.append(layer("плита пола", rect(0, 520 + i * 46, CANVAS_W, 6, "#1f1c18", opacity=0.6)))
    L.append(layer("ступени вниз", poly([980, 500, 1180, 500, 1180, 720, 940, 720], "#1d1a17")))
    for i in range(4):
        L.append(layer("ступень", line(960 - i * 6, 530 + i * 46, 1180, 530 + i * 46, "#4a443b", 5)))
    L += lamp(360, 240, glow="#a8c0cc", r=100)
    L += lamp(920, 240, glow="#a8c0cc", r=100)
    return art("#121112", *L)


add(scene(
    "scene_chapel", "Часовня Остывшего Пламени", "loc_chapel",
    states=[state("state_nave", "Неф", chapel_art(), condition=None)],
    slots=[
        slot("slot_ryab", "У алтаря", ["person"], 400, 300, 150, 340,
             default_entity="npc_ryab", sprite_scale=0.95),
        slot("slot_altar", "Алтарь", ["prop"], 520, 300, 260, 170,
             default_entity="item_altar"),
        slot("slot_mey", "У окна", ["person"], 830, 300, 150, 340,
             default_entity="npc_mey", sprite_scale=0.8),
    ],
    navigation=[
        nav("В крипту", {"x": 980, "y": 500, "w": 200, "h": 220},
            go_to_scene="scene_crypt"),
        nav("На карту", {"x": 40, "y": 40, "w": 150, "h": 120}, open_map=True),
    ],
    ambient=["sfx_whisper"],
    chapter="ch_investigation",
))

# ======================================================================
# 12. Крипта часовни
# ======================================================================

def crypt_art():
    L = [layer("свод", ell(640, 400, 700, 400, grad("#241f1c", "#100e0d", 90))),
         layer("стена", rect(0, 180, CANVAS_W, 340, grad("#3a332c", "#221e1a", 90)))]
    L.append(layer("полка", rect(80, 220, 420, 40, "#4a3f31")))
    L.append(layer("полка", rect(80, 360, 420, 40, "#4a3f31")))
    L.append(layer("полка", rect(80, 500, 420, 40, "#4a3f31")))
    for i in range(7):
        L.append(layer("механизм", rect(110 + i * 52, 170, 34, 50, "#5a5045", radius=4)))
        L.append(layer("механизм", rect(130 + i * 52, 310, 30, 50, "#4f463c", radius=4)))
    L.append(layer("турбина", gear(300, 420, 60, "#6a5c46")))
    L.append(layer("люк", ell(880, 560, 130, 70, grad("#6a6046", "#2f2c22", 90))))
    L.append(layer("луч люка", line(880, 490, 880, 630, "#8a7a58", 4)))
    for i in range(6):
        L.append(layer("луч люка", line(880, 560, 880 + 120 * (1 if i % 3 else -1), 560 + (i - 3) * 22,
                                         "#8a7a58", 3, opacity=0.5)))
    L.append(layer("пол", rect(0, 520, CANVAS_W, 200, grad("#332e28", "#1e1b17", 90))))
    L += pipe_run(520, 200, 520, 520, "#443c32", 16)
    L += pipe_run(560, 220, 1180, 210, "#3f382f", 12)
    L.append(layer("капель", line(700, 220, 700, 300, "#6f8a94", 3, opacity=0.6)))
    L.append(layer("капель", line(760, 210, 760, 260, "#6f8a94", 3, opacity=0.5)))
    L += lamp(620, 300, glow="#7fa7b8", r=120, core_r=9)
    L.append(fog_band(460, 140, "#8f8a80", 0.16))
    return art("#100e0d", *L)


add(scene(
    "scene_crypt", "Крипта часовни", "loc_chapel",
    states=[state("state_crypt", "Крипта", crypt_art(), condition=None)],
    slots=[
        slot("slot_shelf", "Полки с механизмами", ["prop"], 80, 220, 420, 320,
             default_entity="item_crypt_shelf"),
        slot("slot_hatch", "Глубинный люк", ["prop"], 760, 490, 240, 140,
             default_entity="item_hatch_deep"),
    ],
    navigation=[
        nav("Наверх, в часовню", {"x": 40, "y": 300, "w": 150, "h": 300},
            go_to_scene="scene_chapel"),
        nav("На карту", {"x": 1120, "y": 60, "w": 140, "h": 110}, open_map=True),
    ],
    ambient=["sfx_water", "sfx_whisper"],
    chapter="ch_investigation",
))

# ======================================================================
# 13. Водонапорная башня
# ======================================================================

def pumphouse_art():
    L = [layer("башня", rect(0, 0, CANVAS_W, 720, grad("#2f2a24", "#151310", 90)))]
    L.append(layer("кольцо башни", ell(640, 300, 420, 300, "#3a332c", opacity=0.7)))
    L.append(layer("кольцо башни", ell(640, 300, 340, 240, "#26221d", opacity=0.8)))
    L += pipe_run(640, 60, 640, 640, "#5a5045", 60)
    L += pipe_run(640, 300, 1080, 300, "#4f463c", 26)
    L += pipe_run(200, 300, 640, 300, "#4f463c", 26)
    L.append(layer("хомут", rect(600, 250, 80, 30, "#7d6a4a", radius=4)))
    L.append(layer("клапан", rect(590, 380, 110, 90, grad("#6a6046", "#332e24", 90), radius=8)))
    L.append(layer("колесо клапана", ell(645, 424, 40, 40, "#8a7a58")))
    L.append(layer("спица", line(605, 424, 685, 424, "#3a332a", 5)))
    L.append(layer("спица", line(645, 384, 645, 464, "#3a332a", 5)))
    L.append(layer("струя", rect(636, 470, 20, 90, "#7fa7b8", opacity=0.7)))
    L.append(layer("лужа", ell(646, 610, 210, 46, "#41525c", opacity=0.75)))
    L.append(layer("мостик", rect(0, 520, 400, 26, "#4a3e30")))
    L.append(layer("мостик", rect(880, 520, 400, 26, "#4a3e30")))
    L.append(layer("перила", line(0, 470, 400, 470, "#6a5b47", 5)))
    L.append(layer("перила", line(880, 470, 1280, 470, "#6a5b47", 5)))
    for i in range(6):
        L.append(layer("стойка перил", rect(40 + i * 70, 470, 8, 54, "#5a4c3d")))
        L.append(layer("стойка перил", rect(900 + i * 70, 470, 8, 54, "#5a4c3d")))
    L.append(layer("лестница", rect(1140, 560, 140, 160, "#2a251f")))
    for i in range(5):
        L.append(layer("ступень", line(1150, 580 + i * 30, 1270, 580 + i * 30, "#5b4a35", 5)))
    L.append(layer("манометр", ell(420, 200, 46, 46, "#5d5245")))
    L.append(layer("стрелка", line(420, 200, 448, 176, "#c98b3a", 4)))
    L += lamp(420, 130, glow="#ffb765", r=90)
    L += lamp(900, 130, glow="#ffb765", r=90)
    L.append(fog_band(400, 130, "#9bb0b8", 0.16))
    return art("#121110", *L)


add(scene(
    "scene_pumphouse", "Водонапорная башня", "loc_pumphouse",
    states=[state("state_tower", "Башня", pumphouse_art(), condition=None)],
    slots=[
        slot("slot_valve", "Клапан", ["prop"], 570, 370, 150, 200,
             default_entity="item_valve_tower"),
        slot("slot_gauge", "Манометр", ["prop"], 374, 154, 92, 92),
    ],
    navigation=[
        nav("На карту", {"x": 1160, "y": 40, "w": 120, "h": 110}, open_map=True),
    ],
    ambient=["sfx_water", "sfx_steam"],
    chapter="ch_depths",
))

# ======================================================================
# 14. Трубы Окалин
# ======================================================================

def tunnels_art():
    L = [layer("труба", ell(640, 400, 760, 420, grad("#2c2721", "#100e0d", 90)))]
    L.append(layer("внутренняя труба", ell(640, 400, 700, 370, "#241f1b", opacity=0.9)))
    for i in range(9):
        L.append(layer("шов трубы", line(0 + i * 160, 60 + (i % 3) * 30, 0 + i * 160, 720, "#1b1815", 4, opacity=0.5)))
    L.append(layer("пол-лоток", rect(0, 520, CANVAS_W, 200, grad("#332d26", "#1e1a16", 90))))
    L.append(layer("вода", rect(0, 600, CANVAS_W, 120, "#20303a", opacity=0.8)))
    L.append(layer("мостик", rect(120, 470, 420, 24, "#4a3e30")))
    L.append(layer("опора", rect(160, 470, 14, 90, "#3b3227")))
    L.append(layer("опора", rect(480, 470, 14, 90, "#3b3227")))
    L.append(layer("ответвление", rect(900, 240, 300, 260, "#241f1b", radius=120)))
    L.append(layer("отверстие", ell(1050, 370, 110, 110, "#0d0b0a")))
    L.append(layer("труба в стене", rect(840, 500, 120, 60, "#3f3830", radius=10)))
    L.append(layer("дыра", ell(900, 530, 34, 26, "#131110")))
    L.append(layer("пар", ell(900, 480, 60, 30, "#8f8a80", opacity=0.28)))
    L.append(layer("отвал", poly([60, 600, 300, 600, 280, 660, 90, 660], "#2f2a24")))
    for i in range(10):
        L.append(layer("шлак", ell(90 + i * 20, 612 + (i % 4) * 8, 10, 7, "#544b41", opacity=0.85)))
    L += lamp(200, 200, glow="#7fa7b8", r=90)
    L += lamp(760, 180, glow="#7fa7b8", r=80)
    L.append(layer("капель", line(420, 240, 420, 330, "#6f8a94", 3, opacity=0.55)))
    L.append(layer("капель", line(660, 260, 660, 340, "#6f8a94", 3, opacity=0.5)))
    L.append(fog_band(420, 160, "#8f8a80", 0.18))
    return art("#0f0d0c", *L)


add(scene(
    "scene_tunnels", "Трубы Окалин", "loc_okaliny",
    states=[state("state_tunnels", "Трубы", tunnels_art(), condition=None)],
    slots=[
        slot("slot_tisha", "На мостках", ["person"], 300, 280, 140, 340,
             default_entity="npc_tisha", sprite_scale=0.85),
        slot("slot_pipe_hole", "Пробитая труба", ["prop"], 840, 480, 180, 90,
             default_entity="item_pipe_hole"),
        slot("slot_dump_t", "Отвал шлака", ["prop"], 60, 590, 240, 80,
             default_entity="item_dump_tunnels"),
    ],
    navigation=[
        nav("На карту", {"x": 1150, "y": 60, "w": 110, "h": 110}, open_map=True),
    ],
    ambient=["sfx_water", "sfx_boiler"],
    chapter="ch_depths",
))

# ======================================================================
# 15. Пепельная пустошь
# ======================================================================

def ashflats_art(night=False):
    sky = grad("#0e1216", "#2a2620", 90) if night else grad("#5a5348", "#8a7860", 90)
    L = [layer("небо", rect(0, 0, CANVAS_W, 300, sky)),
         layer("далёкие трубы", poly([0, 260, 180, 220, 300, 260, 420, 210, 560, 250, 700, 200,
                                      860, 250, 1000, 220, 1280, 260, 1280, 320, 0, 320], "#3a352e")),
         layer("дым", rect(0, 250, CANVAS_W, 90, "#8f8a80", opacity=0.22)),
         layer("земля", rect(0, 330, CANVAS_W, 390, grad("#4a4238", "#241f1a", 90)))]
    L.append(layer("дюна", ell(300, 480, 340, 90, "#544b40", opacity=0.8)))
    L.append(layer("дюна", ell(980, 520, 380, 100, "#4c4439", opacity=0.8)))
    L.append(layer("дюна", ell(640, 620, 520, 110, "#3f382f", opacity=0.85)))
    for i in range(7):
        x = 120 + i * 170
        L.append(layer("сухое дерево", line(x, 470, x + 10, 360, "#2f2a24", 7)))
        L.append(layer("ветвь", line(x + 6, 400, x - 34, 366, "#2f2a24", 5)))
        L.append(layer("ветвь", line(x + 8, 388, x + 46, 344, "#2f2a24", 5)))
    # арба
    L.append(layer("арба", poly([420, 470, 620, 466, 640, 540, 400, 546], "#4a3a26")))
    L.append(layer("борт", rect(420, 430, 200, 46, "#5a4630", radius=4)))
    L.append(layer("колесо", ell(450, 560, 46, 46, "#3a2f24")))
    L.append(layer("колесо", ell(590, 556, 46, 46, "#3a2f24")))
    L.append(layer("спица", line(404, 560, 496, 560, "#6a5b47", 4)))
    L.append(layer("спица", line(450, 514, 450, 606, "#6a5b47", 4)))
    L.append(layer("полог", line(430, 430, 380, 380, "#6a5f4a", 5)))
    L.append(layer("костровище", ell(900, 620, 70, 26, "#2a241e")))
    L.append(layer("уголь", ell(880, 612, 12, 8, "#4a3a26", opacity=0.9)))
    L.append(layer("уголь", ell(920, 616, 14, 9, "#3f3222", opacity=0.9)))
    if night:
        L += lamp(900, 600, glow="#ffb765", r=140)
    L.append(fog_band(300, 120, "#9b9a94", 0.2))
    return art("#171512", *L)


add(scene(
    "scene_ashflats", "Пепельная пустошь", "loc_ashflats",
    states=[
        state("state_day", "Днём", ashflats_art(False), condition={"time_of_day": ["morning", "day"]}),
        state("state_night", "Ночью", ashflats_art(True), condition=None),
    ],
    slots=[
        slot("slot_wreck", "Разбитая арба", ["prop"], 380, 430, 260, 150,
             default_entity="item_wreck_cart"),
        slot("slot_campfire", "Костровище", ["prop"], 820, 590, 170, 70,
             default_entity="item_campfire"),
    ],
    navigation=[
        nav("На карту", {"x": 40, "y": 40, "w": 160, "h": 120}, open_map=True),
    ],
    ambient=["sfx_ash_wind"],
    chapter="ch_depths",
))

# ======================================================================
# 16. Глубинное машинное зало
# ======================================================================

def deepcore_art(mother=False):
    L = [layer("свод", rect(0, 0, CANVAS_W, 140, grad("#231f1b", "#0e0d0c", 90))),
         layer("стена", rect(0, 120, CANVAS_W, 420, grad("#3a332b", "#1d1a16", 90)))]
    L.append(layer("опора", rect(140, 120, 90, 480, grad("#4a4238", "#26221d", 90))))
    L.append(layer("опора", rect(1060, 120, 90, 480, grad("#4a4238", "#26221d", 90))))
    L.append(layer("шестерня", gear(340, 300, 130, "#5a5045")))
    L.append(layer("шестерня", gear(1010, 250, 100, "#4f463c")))
    L.append(layer("шестерня", gear(760, 190, 80, "#544a3e")))
    L += pipe_run(0, 470, 1280, 460, "#4f463c", 30)
    L += pipe_run(230, 120, 230, 600, "#443c32", 20)
    L += pipe_run(1050, 120, 1050, 600, "#443c32", 20)
    L.append(layer("мостик", rect(0, 520, 1280, 30, "#4a3e30")))
    L.append(layer("перила", line(0, 470, 1280, 470, "#6a5b47", 6)))
    for i in range(10):
        L.append(layer("стойка", rect(40 + i * 130, 470, 10, 52, "#5a4c3d")))
    L.append(layer("пол", rect(0, 550, CANVAS_W, 170, grad("#2b2620", "#15120f", 90))))
    L.append(layer("пульт", rect(500, 470, 280, 110, grad("#544a3c", "#2c2620", 90), radius=6)))
    for i in range(6):
        L.append(layer("рычаг", rect(530 + i * 42, 430, 14, 50, "#7d6a4a", radius=3)))
        L.append(layer("лампа", ell(537 + i * 42, 424, 8, 8, "#c98b3a")))
    L.append(layer("чертежи", rect(850, 300, 150, 170, "#4a3f34", radius=4)))
    L.append(layer("лист", rect(864, 314, 122, 60, "#cfc2a6", opacity=0.8)))
    L.append(layer("лист", rect(864, 388, 122, 66, "#c6b89b", opacity=0.75)))
    L.append(layer("лифт", rect(30, 200, 90, 300, "#2f2a24", radius=6)))
    L.append(layer("решётка лифта", rect(40, 220, 70, 260, "#4a4238", opacity=0.7)))
    if mother:
        L.append(layer("мать", ell(640, 380, 420, 330, grad("#4a5040", "#1c1c18", 90), opacity=0.95)))
        L.append(layer("кольцо матери", ell(640, 380, 300, 260, "#2b2f26", opacity=0.9)))
        for i in range(12):
            ang = i * 30
            L.append(layer("лопасть", rect(634, 120, 18, 150, "#5f6650", rotate=ang, opacity=0.9)))
        L.append(layer("сердце матери", ell(640, 380, 110, 110, "#8aa08a", opacity=0.7)))
        L.append(layer("жила", line(640, 380, 420, 520, "#8aa08a", 6, opacity=0.6)))
        L.append(layer("жила", line(640, 380, 900, 500, "#8aa08a", 6, opacity=0.6)))
        L.append(layer("свет матери", ell(640, 380, 380, 320, "#a8c0b8", opacity=0.12)))
        L.append(layer("алтарь", rect(380, 560, 200, 90, "#4a4438", radius=6)))
        L.append(layer("чаша алтаря", ell(480, 556, 50, 16, "#8a7a58")))
    L += lamp(300, 200, glow="#7fa7b8", r=120)
    L += lamp(980, 200, glow="#7fa7b8", r=120)
    L.append(fog_band(430, 150, "#9bb0b8", 0.14))
    return art("#0f0e0c", *L)


add(scene(
    "scene_deepcore", "Глубинное зало", "loc_deeps",
    states=[
        state("state_hall", "Зало", deepcore_art(False),
              condition={"not_flag": "mother_met"}),
        state("state_mother", "Сердце", deepcore_art(True), condition=None),
    ],
    slots=[
        slot("slot_console", "Пульт зала", ["prop"], 500, 420, 290, 190,
             default_entity="item_console_deep"),
        slot("slot_plans", "Чертежи Кляйна", ["prop"], 860, 300, 170, 150,
             default_entity="item_ark_plans"),
        slot("slot_mother", "Железная Мать", ["person"], 130, 150, 360, 380,
             default_entity="npc_ironmother",
             condition={"flag": "mother_met"}),
        slot("slot_klein_deep", "Мастер Кляйн", ["person"], 830, 480, 170, 230,
             default_entity="npc_klein",
             condition={"flag": "klein_met"}),
        slot("slot_lift", "Грузовой лифт", ["prop"], 30, 200, 90, 300),
    ],
    navigation=[
        nav("На карту", {"x": 1120, "y": 560, "w": 140, "h": 140}, open_map=True),
    ],
    ambient=["sfx_heart"],
    chapter="ch_finale",
))


def build_scenes():
    return SCENES
