"""Мир, локации и сцены «Литании ржавых колоколов» (ArtDoc + слоты по нарисованным объектам)."""
from art import *  # noqa: F401,F403
from art import shade

SMOG = ["loc_lower", "loc_foundry", "loc_undercity", "loc_heart"]
CLEAN = ["loc_station", "loc_cathedral", "loc_spire"]


def slot(id_, label, types, x, y, w, h, entity=None, cond=None, use_with=None, scale=None):
    s = {"id": id_, "label": label, "type": types, "shape": "rect", "x": x, "y": y, "w": w, "h": h, "condition": cond}
    if entity:
        s["default_entity"] = entity
    if use_with:
        s["use_with"] = use_with
    if scale:
        s["sprite_scale"] = scale
    return s


def nav(label, area, scene=None, open_map=False, cost=None):
    z = {"label": label, "area": {"x": area[0], "y": area[1], "w": area[2], "h": area[3]}}
    if scene:
        z["go_to_scene"] = scene
    if open_map:
        z["open_map"] = True
    if cost:
        z["cost_ticks"] = cost
    return z


def standing_spot(x, y, w, label="место"):
    return ell(x + w / 2, y, w * 0.55, 14, "#000000", label + " тень", opacity=0.35)


def state(id_, label, art, cond=None):
    return {"id": id_, "label": label, "art": art, "condition": cond}


# ============================================================ ВОКЗАЛ ПАЛАТЫ

def art_office(night=False):
    L = []
    L += brick_wall(0, 0, 1280, 470, "#3a2c26", "#1c1512", "стена конторы")
    L += rect(0, 440, 1280, 34, "#2a1f19", "плинтус")
    L += plank_floor(470, "#3b2a1f")
    # доска улик
    L += rect(70, 130, 330, 240, grad("#6a4c30", "#4a331f"), "доска улик", stroke="#24170e", sw=8)
    for i, (x, y, c) in enumerate([(95, 150, "#d8cfb4"), (190, 175, "#cfc3a0"), (300, 150, "#e0d6bc"), (110, 270, "#d2c7aa"), (230, 280, "#d9ceb0"), (320, 260, "#cbbf9c")]):
        L += rect(x, y, 62, 58, c, "записка на доске", rotate=(i * 7) % 11 - 5)
        L += ell(x + 31, y + 6, 5, 5, "#9a2a22", "кнопка")
    L += line(126, 160, 221, 185, "#a02a22", 2, "красная нить")
    L += line(221, 185, 331, 160, "#a02a22", 2, "красная нить")
    L += line(141, 280, 261, 290, "#a02a22", 2, "красная нить")
    L += line(261, 290, 221, 185, "#a02a22", 2, "красная нить")
    L += line(351, 270, 331, 160, "#a02a22", 2, "красная нить")
    # дверь в мертвецкую
    L += door(455, 330, 90, 270, "#2e2a2a", "дверь в мертвецкую", glow="#6fb0a0")
    L += rect(470, 300, 60, 18, "#1e1a17", "табличка над дверью")
    # окно
    L += window(800, 90, 200, 240, glow="#3a4a5c" if night else "#a8b0a0", label="окно на город")
    L += rect(806, 230, 188, 94, grad("#1e2630", "#0e1218"), "город за стеклом", opacity=0.85)
    for x in (820, 850, 905, 940, 975):
        L += rect(x, 250 + (x % 40), 6, 8, "#f0b860", "огонёк в окне", opacity=0.9)
    # карта города на стене
    L += rect(1110, 120, 120, 130, "#c9b88e", "карта города", stroke="#3a2a1a", sw=6)
    L += line(1125, 140, 1215, 230, "#6a4a2a", 3, "русло каньона")
    L += ell(1170, 160, 6, 6, "#a02a22", "отметка Шпиля")
    L += ell(1150, 210, 6, 6, "#a02a22", "отметка Нижнего Ряда")
    # дверь на перрон
    L += door(1110, 300, 120, 300, "#4a3424", "дверь на перрон", glow="#e3a24a")
    # стол и инспектор
    L += standing_spot(580, 600, 150)
    L += table(540, 470, 270, "#4e3626", "письменный стол", h=22, legs=110)
    L += rect(560, 445, 80, 25, "#d8cfb4", "стопка дел")
    L += rect(700, 430, 30, 40, "#2a2622", "лампа на столе")
    L += ell(715, 430, 60, 40, "#f0c070", "свет лампы", opacity=0.25)
    L += rect(645, 452, 40, 18, "#3a3a3a", "печатная машинка")
    # койка
    L += rect(820, 500, 260, 70, grad("#5a5a52", "#3a3a34"), "койка", radius=6)
    L += rect(830, 488, 70, 26, "#c8c2b0", "подушка", radius=8)
    L += rect(820, 570, 14, 40, "#2a2622", "ножка койки")
    L += rect(1066, 570, 14, 40, "#2a2622", "ножка койки")
    L += pipe_h(0, 30, 1280, 22, "#5a4a3a", "отопительная труба")
    L += vignette(0.4 if not night else 0.6)
    return doc("#1a1412", L)


def art_platform(night=True):
    L = []
    L += sky("#0e1218" if night else "#4a5248", "#3a4038" if night else "#8a8e7a", 360)
    L += skyline(330, "#151a1c", 7, "силуэт города")
    L += chimneys([150, 420, 990, 1150], 330, "#121414")
    L += fog(240, 140, "#7a8a74", 0.25)
    # навес
    L += rect(0, 60, 1280, 40, grad("#3a3430", "#22201c"), "навес перрона")
    for x in (80, 380, 760, 1060):
        L += rect(x, 100, 22, 380, grad("#4a4038", "#24201c", 0), "колонна навеса")
        L += gear(x + 11, 110, 26, "#6a5a40", 8, "кованая шестерня")
    # фасад вокзала с дверью
    L += rect(470, 220, 280, 260, grad("#4a3a30", "#2a201a"), "фасад вокзала")
    L += door(560, 330, 100, 270, "#3d2c20", "дверь конторы", glow="#e3a24a")
    L += rect(540, 250, 140, 40, "#1c1612", "вывеска Палаты")
    L += text(610, 277, "ПАЛАТА ТИШИНЫ", 16, "#c9a24a", bold=True, label="вывеска")
    L += lamp(510, 300, post=False)
    L += lamp(710, 300, post=False)
    # поезд
    L += rect(780, 250, 520, 200, grad("#2c3a34", "#151c18"), "вагон")
    for x in (810, 920, 1030, 1140):
        L += window(x, 280, 80, 70, "#c08a3a" if night else "#8a9488", label="окно вагона")
    L += rect(780, 440, 520, 20, "#111", "подножка вагона")
    L += steam(1180, 240, 160, "пар паровоза", 0.25)
    L += floor(470, "#3a3632", "#1c1a18")
    L += rail(600)
    # автомат-раздатчик
    L += standing_spot(160, 600, 140)
    L += rect(165, 300, 130, 300, grad("#6a4a2a", "#3a2814", 0), "автомат-раздатчик", radius=10, stroke="#24160a", sw=5)
    L += rect(185, 330, 90, 70, "#0e1410", "стекло автомата")
    L += ell(230, 365, 22, 22, "#e0a040", "глаз автомата", opacity=0.85)
    L += rect(195, 430, 70, 14, "#1a120a", "щель для жетонов")
    L += rect(195, 470, 70, 60, "#2a1c10", "лоток автомата")
    L += gear(270, 560, 18, "#a07a3a", 8, "рычаг автомата")
    # выход в город
    L += poly([1130, 620, 1260, 620, 1260, 300, 1200, 300], "#2a2420", "лестница в город")
    for i, y in enumerate(range(330, 620, 36)):
        L += line(1200 - i * 8 + 10, y, 1260, y, "#463c34", 4, "ступень")
    L += lamp(1150, 300, post=True, post_h=320)
    L += vignette(0.5)
    return doc("#0e1012", L)


def art_morgue():
    L = []
    L += rect(0, 0, 1280, 480, grad("#2a3a36", "#16211e"), "кафельная стена")
    for y in range(20, 480, 46):
        L += line(0, y, 1280, y, "#3a504a", 2, "шов кафеля", opacity=0.5)
    for x in range(0, 1280, 46):
        L += line(x, 0, x, 480, "#3a504a", 1, None, opacity=0.35)
    # ячейки холодильника
    L += rect(240, 80, 300, 300, "#5a6460", "стена ячеек")
    for r in range(3):
        for c in range(3):
            L += rect(250 + c * 98, 90 + r * 96, 90, 88, grad("#8a948e", "#5a625e"), "дверца ячейки", stroke="#2a302e", sw=3)
            L += rect(285 + c * 98, 130 + r * 96, 20, 8, "#2a2a2a", "ручка ячейки")
    L += floor(480, "#2a3330", "#101614")
    for x in range(0, 1280, 80):
        L += line(x, 480, x - 120 + (x // 4), 720, "#1a2220", 2, None, opacity=0.6)
    # лампы
    for x in (450, 840):
        L += line(x, 0, x, 110, "#222", 3, "провод лампы")
        L += poly([x - 50, 150, x + 50, 150, x + 24, 110, x - 24, 110], "#3a4440", "абажур")
        L += ell(x, 160, 230, 120, "#bfe8dc", "холодный свет", opacity=0.10)
    # стол с телом
    L += rect(450, 470, 400, 32, grad("#a8b2ae", "#6a7470"), "секционный стол", radius=6)
    L += rect(470, 502, 20, 120, "#3a4240", "опора стола")
    L += rect(810, 502, 20, 120, "#3a4240", "опора стола")
    L += poly([480, 470, 820, 470, 800, 430, 500, 430], "#d8dad0", "простыня с телом")
    L += ell(520, 438, 34, 22, "#c8c4b4", "голова под простынёй")
    L += rect(620, 440, 60, 22, "#7a2a22", "вскрытая грудь", opacity=0.75)
    L += gear(650, 450, 12, "#b08d4a", 8, "латунный блеск")
    # стол с инструментами
    L += table(960, 470, 150, "#5a625e", "столик с инструментами", legs=130)
    L += line(980, 462, 1020, 462, "#c0c8c4", 3, "скальпель")
    L += rect(1040, 446, 20, 24, "#3a6a5a", "склянка", radius=4)
    L += standing_spot(890, 610, 150)
    # лестница наверх
    L += rect(40, 260, 140, 360, "#141b19", "лестничный проём")
    for i, y in enumerate(range(600, 260, -40)):
        L += rect(40 + i * 6, y, 140 - i * 6, 10, "#2e3a36", "ступень")
    L += vignette(0.55)
    return doc("#0c1210", L)


# ============================================================ НИЖНИЙ РЯД

def art_lower_street(night=False):
    L = []
    L += sky("#1a1e1a" if night else "#4a4e3e", "#5a5a44" if night else "#8a8460", 300)
    L += fog(120, 200, "#8a8a64", 0.28)
    # левый дом (кабак)
    L += brick_wall(0, 80, 420, 560, "#4a2e24", "#24140e", "дом кабака")
    L += door(120, 330, 120, 270, "#3a2414", "дверь кабака", glow="#e3a24a")
    L += rect(90, 270, 180, 44, "#1c120c", "вывеска кабака", radius=4)
    L += text(180, 299, "МЯТЫЙ КЛАПАН", 18, "#e0a040", bold=True, label="вывеска")
    L += window(290, 160, 90, 110, "#d08a3a" if night else "#7a6a4a", label="окно кабака")
    # правый дом (мастерская)
    L += brick_wall(900, 60, 380, 580, "#3a3430", "#1a1612", "дом мастерской")
    L += door(1020, 340, 110, 260, "#2a2e2a", "дверь мастерской", glow="#7ad0b0")
    L += gear(1075, 300, 26, "#8a7a4a", 10, "вывеска-шестерня")
    L += window(940, 150, 80, 100, "#7ad0b0" if night else "#6a7a6a", label="окно мастерской")
    L += window(1150, 150, 80, 100, "#7ad0b0", lit=night, label="окно мастерской")
    # проулок в глубине
    L += rect(420, 200, 480, 330, grad("#2a2a24", "#1a1a16"), "глубина улицы")
    L += poly([780, 520, 940, 520, 900, 300, 820, 300], "#121210", "проход в проулок")
    L += lamp(860, 290, "#e0a040", post=False)
    # трубы над улицей
    L += pipe_h(0, 40, 1280, 28, "#5a4a36", "магистраль над улицей")
    L += pipe_v(430, 40, 300, 22, "#5a4a36", "стояк")
    L += steam(441, 330, 120, "свищ пара", 0.3)
    L += floor(530, "#3a3428", "#14120e", "булыжная мостовая")
    for x in range(0, 1280, 70):
        L += ell(x + 20, 600 + (x % 3) * 30, 26, 8, "#24201a", "булыжник", opacity=0.6)
    # куча хлама
    L += poly([330, 640, 520, 640, 500, 560, 440, 520, 380, 545, 345, 590], "#3a3226", "куча хлама")
    L += crate(395, 545, 50, "#5a4430", "разбитый ящик")
    L += gear(470, 580, 20, "#6a5a3a", 8, "ржавая шестерня")
    L += rect(350, 600, 60, 18, "#5a5a4a", "тряпьё", rotate=-12)
    # бочка у места Пик
    L += barrel(780, 520, 60, 100, "#4a3626", "бочка с дождевой водой")
    L += standing_spot(640, 620, 130)
    L += lamp(600, 270, "#e0a040", post=True, post_h=350)
    L += vignette(0.5 if not night else 0.7)
    return doc("#121210", L)


def art_tavern():
    L = []
    L += rect(0, 0, 1280, 460, grad("#3a2418", "#1e120c"), "стена кабака")
    for x in range(0, 1280, 90):
        L += rect(x, 0, 12, 460, "#2a180e", "балка")
    L += rect(0, 90, 1280, 16, "#24140c", "поперечная балка")
    # полки с бутылками
    L += rect(440, 120, 400, 12, "#2a180e", "полка")
    L += rect(440, 200, 400, 12, "#2a180e", "полка")
    for i, x in enumerate(range(455, 830, 28)):
        L += rect(x, 78 + (i % 3) * 4, 16, 42 - (i % 3) * 4, ["#3a6a3a", "#6a3a2a", "#8a7a3a", "#2a3a5a"][i % 4], "бутылка", radius=4, opacity=0.9)
        L += rect(x + 2, 160 + (i % 2) * 4, 14, 40 - (i % 2) * 4, ["#5a2a2a", "#3a5a3a", "#7a6a2a"][i % 3], "бутылка", radius=4, opacity=0.9)
    # котёл-самогонка
    L += ell(1000, 230, 90, 110, grad("#a07040", "#5a3a1a"), "медный перегонный куб")
    L += pipe_v(990, 60, 80, 20, "#a07040", "змеевик", rivets=False)
    L += steam(1000, 110, 100, "пар куба", 0.2)
    L += plank_floor(460, "#3a2618")
    # стойка
    L += standing_spot(545, 560, 140)
    L += rect(380, 400, 520, 160, grad("#5a3820", "#2a180c"), "барная стойка", radius=6)
    L += rect(370, 390, 540, 22, "#6a4428", "столешница стойки", radius=4)
    L += rect(420, 360, 30, 32, "#b08d4a", "кружка", radius=5)
    L += rect(820, 350, 50, 42, "#7a6a4a", "бочонок на стойке", radius=8)
    # стол Хеска
    L += standing_spot(950, 620, 140)
    L += table(900, 500, 230, "#4a3020", "стол в углу", legs=110)
    L += rect(1080, 470, 22, 30, "#3a6a3a", "бутылка ерша", radius=5)
    L += lamp(1010, 420, "#e0a040", post=False)
    # дверь
    L += door(40, 300, 120, 300, "#3a2414", "дверь на улицу", glow="#a8a070")
    L += ell(640, 60, 400, 120, "#f0a050", "тёплый свет", opacity=0.07)
    L += vignette(0.5)
    return doc("#140c08", L)


def art_workshop():
    L = []
    L += rect(0, 0, 1280, 470, grad("#2a3230", "#141a18"), "стена мастерской")
    L += pipe_h(0, 50, 1280, 18, "#5a6a5a", "труба вдоль стены")
    # банки с органами
    for i, x in enumerate(range(200, 380, 60)):
        L += rect(x, 120, 44, 70, "#5a8a7a", "банка с раствором", radius=8, opacity=0.7)
        L += ell(x + 22, 160, 12, 14, "#8a4a3a", "что-то в растворе", opacity=0.8)
    L += rect(180, 196, 220, 10, "#2a2016", "полка с банками")
    # чертежи
    L += rect(620, 90, 200, 140, "#2a4a6a", "чертёж сердца", stroke="#1a2a3a", sw=4)
    L += ell(720, 160, 40, 46, "#00000000", "контур сердца на чертеже", stroke="#c8d8e8", sw=2)
    L += gear(720, 160, 16, "#c8d8e8", 8, "шестерня на чертеже", opacity=0.6)
    L += floor(470, "#2a2a24", "#0e0e0c", "каменный пол")
    # операционное кресло
    L += rect(640, 400, 200, 40, grad("#6a5a4a", "#3a2a1a"), "операционное кресло", radius=10)
    L += rect(780, 280, 40, 140, "#5a4a3a", "спинка кресла", radius=8)
    L += rect(700, 440, 20, 150, "#2a2a2a", "опора кресла")
    L += line(820, 260, 900, 150, "#4a4a4a", 4, "манипулятор")
    L += ell(700, 260, 70, 50, "#d0f0e0", "операционная лампа", opacity=0.12)
    # Марроу
    L += standing_spot(420, 610, 140)
    # шкаф
    L += rect(900, 220, 160, 300, grad("#4a3a2a", "#2a1e14", 0), "запертый шкаф", stroke="#1a120a", sw=5, radius=4)
    L += line(980, 230, 980, 510, "#1a120a", 3)
    L += rect(965, 350, 30, 36, "#b08d4a", "кодовый замок шкафа", radius=4)
    L += gear(980, 368, 10, "#e0c070", 8, "диск замка")
    # верстак
    L += table(120, 470, 230, "#4a3a2a", "верстак", legs=120)
    L += gear(180, 450, 18, "#b08d4a", 10, "латунная шестерня на верстаке")
    L += rect(240, 440, 60, 28, "#7a2a22", "латунное сердце-заготовка", radius=10)
    L += door(40, 300, 110, 300, "#2a2e2a", "дверь на улицу", glow="#a8a070")
    L += vignette(0.55)
    return doc("#0c100e", L)


# ============================================================ ЛИТЕЙНЫЕ

def art_foundry():
    L = []
    L += rect(0, 0, 1280, 460, grad("#2a1a14", "#120a08"), "закопчённые своды")
    for x in range(0, 1280, 160):
        L += poly([x, 0, x + 160, 0, x + 80, 70], "#1a100c", "ферма свода")
    # печи
    for i, x in enumerate((420, 620)):
        L += rect(x, 150, 160, 290, grad("#4a3a30", "#24180e"), "плавильная печь", radius=12)
        L += rect(x + 30, 290, 100, 90, grad("#ffcc66", "#e04a1a"), "жерло печи", radius=40)
        L += ell(x + 80, 330, 140, 120, "#ff7a2a", "жар печи", opacity=0.18)
        L += chimneys([x + 67], 150, "#24180e", smoke=True, label="дымоход печи")
    # ковш
    L += chains(560, 60, 160, "#3a3028", "цепь ковша")
    L += poly([520, 220, 600, 220, 590, 270, 530, 270], "#3a2a20", "ковш")
    L += ell(560, 222, 40, 8, "#ffaa44", "расплав", opacity=0.9)
    # клапан №7
    L += pipe_h(760, 360, 520, 50, "#6a5040", "главная паровая магистраль")
    L += pipe_v(880, 0, 360, 40, "#6a5040", "вертикальный паропровод")
    L += ell(900, 380, 80, 80, "#00000000", "маховик клапана №7", stroke="#a07a3a", sw=12)
    L += line(820, 380, 980, 380, "#a07a3a", 8, "спица маховика")
    L += line(900, 300, 900, 460, "#a07a3a", 8, "спица маховика")
    L += ell(900, 380, 16, 16, "#c09a4a", "ступица маховика")
    L += rect(870, 448, 60, 22, "#c8b070", "бирка клапана")
    L += text(900, 465, "№7", 16, "#2a1a0a", bold=True, label="номер клапана")
    L += steam(1010, 350, 120, "утечка пара", 0.3)
    L += floor(460, "#2a1e16", "#0e0806", "чугунный пол")
    for x in range(0, 1280, 64):
        L += line(x, 460, x, 720, "#1a120c", 2, None, opacity=0.5)
    # Бруно
    L += standing_spot(250, 620, 140)
    L += rect(140, 520, 80, 100, "#3a3a3a", "наковальня")
    # ворота
    L += rect(10, 270, 130, 350, grad("#3a3028", "#1a140e", 0), "ворота цеха")
    for y in range(290, 610, 40):
        L += line(10, y, 140, y, "#24180e", 3)
    # дверь казармы
    L += door(1120, 330, 120, 280, "#3a2a1c", "дверь в казарму", glow="#d08a3a")
    L += vignette(0.5)
    return doc("#0e0806", L)


def art_barracks():
    L = []
    L += brick_wall(0, 0, 1280, 470, "#3a2e28", "#1a1410", "стена казармы")
    L += plank_floor(470, "#34261c")
    # нары
    for x in (170, 1000 - 800):
        pass
    for x in (170,):
        L += rect(x, 230, 300, 20, "#4a3a2a", "верхние нары")
        L += rect(x, 420, 300, 20, "#4a3a2a", "нижние нары")
        L += rect(x, 210, 300, 22, "#6a6a5a", "тюфяк", radius=6)
        L += rect(x, 400, 300, 22, "#5a5a4a", "тюфяк", radius=6)
        L += rect(x, 200, 14, 400, "#2a1e14", "стойка нар")
        L += rect(x + 286, 200, 14, 400, "#2a1e14", "стойка нар")
    # Марта
    L += standing_spot(560, 620, 140)
    L += rect(520, 540, 80, 40, "#3a3a3a", "табурет", radius=4)
    # шкафчики
    L += rect(900, 200, 280, 360, "#3a4038", "ряд шкафчиков")
    for i in range(4):
        x = 906 + i * 69
        L += rect(x, 206, 63, 348, grad("#5a6458", "#343a32", 0), "шкафчик", stroke="#1e221c", sw=3)
        for yy in (230, 245, 260):
            L += line(x + 14, yy, x + 49, yy, "#1e221c", 2)
    L += rect(1044, 360, 10, 26, "#a02a22", "сорванная пломба")
    L += lamp(740, 120, "#e0a040", post=False)
    L += ell(740, 180, 260, 160, "#e0a040", "свет лампы", opacity=0.06)
    L += door(40, 300, 110, 300, "#3a2a1c", "дверь в цех", glow="#ff8a3a")
    L += vignette(0.5)
    return doc("#100c0a", L)


# ============================================================ СОБОР

def art_nave():
    L = []
    L += rect(0, 0, 1280, 500, grad("#1e1a24", "#0e0c12"), "своды собора")
    L += stained_glass(640, 40, 260, 330, "большой витраж")
    for x in (230, 400, 880, 1050):
        L += rect(x, 0, 60, 520, grad("#4a4250", "#24202a", 0), "колонна")
        L += rect(x - 10, 500, 80, 30, "#2a2430", "база колонны")
    L += floor(500, "#2a2430", "#0c0a10", "плиты нефа")
    for i in range(8):
        L += line(640, 500, i * 180 - 20, 720, "#1a1620", 2, "шов плит", opacity=0.6)
    # алтарь-шестерня
    L += gear(640, 420, 110, "#8a6a2a", 16, "алтарь-шестерня", opacity=0.95)
    L += rect(560, 500, 160, 40, "#3a2a1a", "ступень алтаря")
    L += standing_spot(570, 615, 150)
    # молитвенный механизм
    L += rect(860, 380, 150, 180, grad("#6a5a3a", "#3a2a14", 0), "молитвенный механизм", radius=8)
    for j in range(3):
        L += ell(900 + j * 35, 430, 14, 14, "#c9a24a", "молитвенный барабан")
    L += rect(880, 480, 110, 50, "#1a120a", "щель для свечей")
    for j in range(5):
        L += rect(888 + j * 20, 470, 6, 16, "#e8e0c0", "свеча")
        L += ell(891 + j * 20, 466, 4, 6, "#ffcc66", "огонёк", opacity=0.9)
    # выход и боковые двери
    L += arch_door(40, 360, 130, 250, "#2a1e18", "главные врата")
    L += arch_door(260, 380, 90, 230, "#2a2018", "дверь скриптория")
    L += arch_door(1120, 360, 110, 250, "#2a2018", "лестница на колокольню")
    L += ell(640, 200, 500, 300, "#c9a24a", "свет витража", opacity=0.05)
    L += vignette(0.55)
    return doc("#0a080c", L)


def art_archive():
    L = []
    L += rect(0, 0, 1280, 480, grad("#2a2018", "#140e0a"), "стена скриптория")
    L += bookshelf(170, 60, 300, 420, "стеллаж слева")
    L += bookshelf(880, 60, 340, 420, "стеллаж справа")
    L += window(560, 60, 160, 200, "#7a8aa0", arch=True, label="стрельчатое окно")
    L += plank_floor(480, "#2a1c12")
    L += table(540, 470, 300, "#4a3020", "пюпитр писца", legs=110)
    L += rect(580, 440, 120, 30, "#d8cfb4", "раскрытый фолиант")
    L += rect(780, 430, 10, 40, "#e8e0c0", "свеча")
    L += ell(785, 426, 6, 9, "#ffcc66", "пламя свечи")
    L += ell(785, 440, 90, 70, "#ffcc66", "свет свечи", opacity=0.12)
    L += standing_spot(640, 615, 140)
    L += door(40, 300, 110, 300, "#2a2018", "дверь в неф", glow="#c9a24a")
    L += vignette(0.55)
    return doc("#0e0a08", L)


def art_belltower(cleared=False):
    L = []
    L += sky("#0a0e18", "#2a3448", 720, "ночное небо")
    L += skyline(560, "#0a0c10", 21, "город внизу")
    L += fog(450, 160, "#6a7a74", 0.25)
    # каменные арки
    L += rect(0, 0, 1280, 60, "#1a1820", "перекрытие")
    for x in (0, 420, 860):
        L += rect(x, 0, 60, 720, grad("#3a3640", "#1a1820", 0), "каменный столб")
    L += rect(1220, 0, 60, 720, "#1a1820", "каменный столб")
    # колокол
    L += line(640, 60, 640, 120, "#2a2a2a", 10, "ось колокола")
    L += poly([540, 380, 740, 380, 710, 180, 690, 130, 590, 130, 570, 180], grad("#a0783a", "#5a3a14", 0), "большой колокол")
    L += ell(640, 382, 104, 18, "#4a2a0a", "край колокола")
    L += ell(640, 400, 18, 18, "#3a2a1a", "язык колокола")
    L += gear(770, 140, 50, "#5a4a3a", 12, "часовой механизм")
    L += gear(840, 210, 30, "#5a4a3a", 9, "часовой механизм")
    L += floor(600, "#2a2630", "#0e0c12", "дощатый настил")
    # сундук
    L += rect(820, 480, 160, 100, grad("#5a3a20", "#2a1a0a"), "окованный сундук", radius=6, stroke="#1a0e04", sw=4)
    L += rect(820, 470, 160, 24, "#4a2e16", "крышка сундука", radius=6)
    L += rect(888, 510, 24, 30, "#b08d4a", "замок сундука")
    if not cleared:
        L += rect(300, 560, 120, 30, "#3a2a1a", "следы смазки на настиле", opacity=0.6)
    L += rect(40, 380, 130, 240, "#0e0c12", "люк вниз")
    for i, y in enumerate(range(600, 380, -36)):
        L += rect(50, y, 110, 8, "#2a2630", "перекладина")
    L += vignette(0.6)
    return doc("#06080e", L)


# ============================================================ ШПИЛЬ

def art_council(broken=False):
    L = []
    L += rect(0, 0, 1280, 460, grad("#2a2a34", "#14141c"), "стены зала")
    for x in range(120, 1200, 160):
        L += window(x, 40, 70, 230, "#a8b4c8", arch=True, label="высокое окно") if x not in (600,) else []
    # органные трубы
    for i, x in enumerate(range(520, 780, 22)):
        hh = 160 + (abs(i - 6)) * -12 + 120
        L += rect(x, 300 - hh, 16, hh, grad("#d0b060", "#7a5a20", 0), "трубы органа", radius=6)
    L += floor(460, "#3a2a2a", "#140c0c", "мраморный пол")
    L += rect(0, 460, 1280, 6, "#c9a24a", "латунный бордюр", opacity=0.6)
    # подиум
    L += rect(560, 540, 220, 40, "#4a2a2a", "подиум совета", radius=4)
    L += rect(540, 570, 260, 30, "#3a2020", "ступень подиума")
    L += standing_spot(600, 560, 140)
    # скамьи
    for x in (60, 900):
        L += rect(x, 520, 320, 40, "#3a241c", "скамья советников", radius=6)
        L += rect(x, 470, 320, 50, "#2a1810", "спинка скамьи", radius=6)
    # кафедра обвинения
    L += poly([300, 600, 440, 600, 420, 430, 320, 430], grad("#5a3a2a", "#2a1a10"), "кафедра обвинения")
    L += rect(310, 420, 120, 16, "#6a4a30", "пюпитр кафедры")
    L += ell(370, 410, 14, 8, "#b08d4a", "латунный рупор")
    # двери
    L += door(1100, 300, 120, 310, "#3a2424", "дверь канцелярии", glow="#c9a24a")
    L += rect(30, 300, 120, 310, grad("#4a4a50", "#24242a", 0), "лифтовая клеть", stroke="#c9a24a", sw=3)
    for y in range(320, 600, 30):
        L += line(30, y, 150, y, "#c9a24a", 1, None, opacity=0.4)
    if broken:
        L += line(250, 0, 420, 300, "#c8c8d0", 3, "трещина в окне", opacity=0.6)
        L += rect(600, 300, 140, 240, "#0a0a0e", "пустое место Венн", opacity=0.0)
        L += fog(380, 120, "#4a3a5a", 0.25, "дым после схватки")
    L += vignette(0.45)
    return doc("#0e0e14", L)


def art_chancery():
    L = []
    L += rect(0, 0, 1280, 470, grad("#3a3428", "#1c1a14"), "обшитые стены")
    for x in range(0, 1280, 120):
        L += rect(x, 0, 6, 470, "#2a2418", "панель стены")
    # пневмопочта
    for x in (200, 260, 320):
        L += pipe_v(x, 0, 330, 24, "#b08d4a", "труба пневмопочты", rivets=False)
    L += rect(180, 330, 180, 60, "#5a4a2a", "приёмник пневмопочты", radius=6)
    # картотека
    L += rect(620, 120, 220, 330, "#4a3a24", "картотека")
    for r in range(5):
        for c in range(3):
            L += rect(630 + c * 70, 130 + r * 62, 62, 54, "#6a5434", "ящик картотеки", stroke="#2a1e10", sw=2)
            L += rect(652 + c * 70, 152 + r * 62, 18, 6, "#b08d4a", "ручка")
    L += floor(470, "#3a2a1e", "#120c08", "паркет")
    L += standing_spot(420, 610, 140)
    # стол Дрю
    L += rect(800, 430, 260, 30, grad("#6a4a2a", "#3a2a14"), "стол секретаря", radius=4)
    L += rect(810, 460, 240, 110, "#3a2a14", "тумба стола")
    L += rect(1000, 485, 30, 10, "#b08d4a", "ручка ящика стола")
    L += rect(840, 400, 90, 30, "#d8cfb4", "бумаги")
    L += rect(960, 390, 26, 40, "#7a2a22", "печать совета", radius=4)
    L += door(40, 300, 110, 300, "#3a2424", "дверь в зал", glow="#c9a24a")
    L += lamp(900, 330, "#f0c070", post=False)
    L += vignette(0.45)
    return doc("#100c08", L)


# ============================================================ ОТСТОЙНИКИ

def art_collector():
    L = []
    L += rect(0, 0, 1280, 720, grad("#1a201a", "#060806"), "тоннель")
    L += ell(640, 300, 700, 380, "#0a0c0a", "свод тоннеля", opacity=0.9)
    for x in range(0, 1280, 140):
        L += rect(x, 0, 18, 520, "#2a3028", "ребро свода")
    L += pipe_h(0, 80, 1280, 36, "#4a4232", "ржавая магистраль")
    L += pipe_h(0, 150, 900, 20, "#3a3a2a", "кабель-труба", rivets=False)
    # решётка
    L += rect(560, 200, 160, 160, "#0e100c", "ниша решётки", radius=8)
    for x in range(570, 720, 20):
        L += line(x, 205, x, 355, "#6a6a5a", 4, "прут решётки")
    L += ell(640, 280, 60, 60, "#7ad0b0", "мерцание за решёткой", opacity=0.25)
    L += ell(640, 280, 14, 14, "#bff0e0", "огонёк за решёткой", opacity=0.8)
    # канал
    L += floor(520, "#202418", "#0a0c08", "уступ")
    L += rect(0, 600, 1280, 120, grad("#1a3a30", "#081410"), "сточный канал", opacity=0.95)
    for x in range(0, 1280, 90):
        L += line(x, 630 + (x % 3) * 20, x + 50, 630 + (x % 3) * 20, "#3a6a5a", 2, "блик воды", opacity=0.5)
    # фонограф
    L += rect(900, 520, 120, 60, "#3a2a1a", "ящик фонографа", radius=4)
    L += poly([960, 520, 1040, 440, 1060, 470, 980, 525], "#b08d4a", "раструб фонографа")
    L += ell(930, 518, 26, 6, "#1a1a1a", "валик")
    # проходы
    L += poly([1120, 560, 1260, 560, 1260, 260, 1160, 300], "#030403", "проход в затопленную галерею")
    L += rect(40, 140, 80, 460, "#0a0c0a", "шахта лестницы")
    for y in range(160, 600, 34):
        L += rect(48, y, 64, 6, "#5a5a4a", "скоба лестницы")
    L += fog(380, 200, "#5a7a5a", 0.25, "ядовитые испарения")
    L += vignette(0.7)
    return doc("#040604", L)


def art_flooded(drained=False):
    L = []
    L += rect(0, 0, 1280, 720, grad("#14201c", "#040806"), "галерея")
    for x in (180, 520, 860):
        L += ell(x + 120, 120, 170, 160, "#0a100e", "арка", stroke="#2a3a34", sw=10)
        L += rect(x - 50, 120, 30, 480, "#2a3a34", "столб арки")
    L += rect(1210, 120, 30, 480, "#2a3a34", "столб арки")
    # глубокий шлюз
    L += ell(1010, 360, 120, 120, grad("#6a5a3a", "#2a2010"), "глубокий шлюз", stroke="#1a140a", sw=8)
    L += ell(1010, 360, 80, 80, "#3a2e1a", "крышка шлюза")
    for a in range(0, 360, 45):
        pass
    L += line(940, 360, 1080, 360, "#b08d4a", 8, "запорная спица")
    L += line(1010, 290, 1010, 430, "#b08d4a", 8, "запорная спица")
    L += rect(985, 335, 50, 50, "#1a140a", "замочная скважина-шестерня", radius=6)
    L += ell(1010, 360, 180, 180, "#7ad0b0", "гул из-за шлюза", opacity=0.06)
    # вода
    lvl = 610 if drained else 540
    L += rect(0, lvl, 1280, 720 - lvl, grad("#1a4a3a", "#061410"), "стоячая вода", opacity=0.92)
    for x in range(0, 1280, 110):
        L += line(x, lvl + 20 + (x % 4) * 18, x + 60, lvl + 20 + (x % 4) * 18, "#4a8a7a", 2, "рябь", opacity=0.45)
    # останки
    L += rect(380, 550, 180, 50, "#3a3428", "обломки мостков", rotate=-4)
    L += ell(470, 545, 40, 14, "#5a5040", "брошенная куртка кочегара")
    L += ell(500, 548, 8, 8, "#c9a24a", "блеск медальона", opacity=0.9)
    L += rect(20, 300, 120, 300, "#030504", "проход в коллектор")
    L += fog(300, 260, "#4a6a5a", 0.25, "испарения")
    L += vignette(0.7)
    return doc("#030604", L)


# ============================================================ СЕРДЦЕ

def art_engine_hall():
    L = []
    L += rect(0, 0, 1280, 720, grad("#1a1010", "#060404"), "машинный зал")
    L += gear(200, 200, 170, "#5a4030", 18, "гигантская шестерня")
    L += gear(1080, 180, 140, "#5a4030", 16, "гигантская шестерня")
    L += gear(420, 120, 70, "#6a5038", 12, "шестерня")
    L += gear(900, 360, 80, "#6a5038", 12, "шестерня")
    for x in (330, 950):
        L += rect(x, 280, 50, 300, grad("#8a7a6a", "#3a2a1a", 0), "поршень")
        L += rect(x - 15, 260, 80, 30, "#2a1e14", "головка поршня")
    L += pipe_h(0, 600, 1280, 40, "#5a3a2a", "главная магистраль")
    L += floor(640, "#2a1a14", "#0a0604", "решётчатый настил")
    # дверь к ядру
    L += rect(540, 230, 200, 320, "#0a0604", "проём к ядру", radius=12)
    L += ell(640, 390, 100, 160, "#7ad0b0", "сияние ядра", opacity=0.3)
    L += ell(640, 390, 40, 70, "#d0fff0", "сердцевина света", opacity=0.5)
    L += steam(500, 560, 150, "пар", 0.25)
    L += steam(780, 560, 150, "пар", 0.25)
    L += rect(20, 300, 120, 320, grad("#4a4a50", "#24242a", 0), "грузовой подъёмник", stroke="#c9a24a", sw=3)
    L += vignette(0.65)
    return doc("#060404", L)


def art_core(dim=False):
    L = []
    L += rect(0, 0, 1280, 720, grad("#081412", "#020404"), "ядро")
    for i, r in enumerate((330, 270, 210)):
        L += ell(640, 320, r, r, "#00000000", "кольцо ядра", stroke=shade("#7ad0b0", -0.3 - i * 0.15), sw=6, opacity=0.8)
    L += gear(640, 320, 150, "#4a3a2a", 20, "венец ядра")
    L += ell(640, 320, 110, 130, grad("#e0fff4" if not dim else "#5a6a64", "#3a8a74" if not dim else "#1a2a24"), "Сердце-Двигатель")
    L += ell(640, 320, 220, 220, "#7ad0b0", "сияние", opacity=0.10 if not dim else 0.03)
    for a in range(0, 360, 30):
        import math as _m
        x2 = 640 + _m.cos(_m.radians(a)) * 600
        y2 = 320 + _m.sin(_m.radians(a)) * 600
        L += line(640, 320, round(x2), round(y2), "#7ad0b0", 2, "силовая жила", opacity=0.12 if not dim else 0.04)
    # семь колоколов-сердец
    for i in range(7):
        import math as _m
        a = _m.radians(200 + i * 23)
        x = 640 + _m.cos(a) * 420
        y = 560 + _m.sin(a) * 120
        L += ell(round(x), round(y), 26, 30, "#7a3a2a", "латунное сердце жертвы", stroke="#b08d4a", sw=3)
    L += floor(600, "#101a18", "#020404", "кольцевой мост")
    L += rect(20, 300, 120, 300, "#030504", "проход в машинный зал")
    L += vignette(0.6)
    return doc("#020404", L)


# ============================================================ МИР

def build_world():
    def conn(to, cost, enc=None, req=None):
        c = {"to": to, "cost_ticks": cost}
        if enc:
            c["random_encounter_table"] = enc
        if req:
            c["requirements"] = req
        return c

    mus = lambda *t: [{"tracks": list(t)}]  # noqa: E731
    locations = [
        {"id": "loc_station", "label": "Вокзал Палаты Тишины", "position": {"x": 960, "y": 300},
         "travel_connections": [conn("loc_lower", 2, "enc_lower"), conn("loc_cathedral", 2), conn("loc_spire", 3)],
         "scenes": ["scene_office", "scene_platform", "scene_morgue"], "arrival_scene": "scene_platform",
         "camp": True,
         "music": [{"tracks": ["music_station_night"], "conditions": [{"time_of_day": ["evening", "night"]}]}, {"tracks": ["music_station"]}],
         "ambient": ["amb_steam"]},
        {"id": "loc_lower", "label": "Нижний Ряд", "position": {"x": 790, "y": 510},
         "travel_connections": [conn("loc_station", 2, "enc_lower"), conn("loc_foundry", 1, "enc_lower"), conn("loc_undercity", 2, "enc_undercity")],
         "scenes": ["scene_lower_street", "scene_tavern", "scene_workshop"], "arrival_scene": "scene_lower_street",
         "music": mus("music_lower"), "ambient": ["amb_drip"]},
        {"id": "loc_foundry", "label": "Литейные кварталы", "position": {"x": 330, "y": 480},
         "travel_connections": [conn("loc_lower", 1, "enc_lower"), conn("loc_undercity", 2, "enc_undercity"), conn("loc_cathedral", 2)],
         "scenes": ["scene_foundry_floor", "scene_barracks"], "arrival_scene": "scene_foundry_floor",
         "music": mus("music_foundry"), "ambient": ["amb_furnace"]},
        {"id": "loc_cathedral", "label": "Собор Святой Шестерни", "position": {"x": 300, "y": 230},
         "travel_connections": [conn("loc_station", 2), conn("loc_spire", 2), conn("loc_foundry", 2)],
         "scenes": ["scene_nave", "scene_archive", "scene_belltower"], "arrival_scene": "scene_nave",
         "music": mus("music_cathedral")},
        {"id": "loc_spire", "label": "Верхний Шпиль", "position": {"x": 640, "y": 100},
         "travel_connections": [conn("loc_station", 3), conn("loc_cathedral", 2), conn("loc_heart", 2)],
         "scenes": ["scene_council_hall", "scene_chancery"], "arrival_scene": "scene_council_hall",
         "music": mus("music_spire")},
        {"id": "loc_undercity", "label": "Отстойники под клапаном №7", "position": {"x": 560, "y": 620}, "hidden": True,
         "travel_connections": [conn("loc_lower", 2, "enc_undercity"), conn("loc_foundry", 2, "enc_undercity"), conn("loc_heart", 2)],
         "scenes": ["scene_collector", "scene_flooded"], "arrival_scene": "scene_collector",
         "music": mus("music_undercity"), "ambient": ["amb_drip"]},
        {"id": "loc_heart", "label": "Сердце-Двигатель", "position": {"x": 640, "y": 380}, "hidden": True,
         "travel_connections": [conn("loc_undercity", 2), conn("loc_spire", 2)],
         "scenes": ["scene_engine_hall", "scene_core"], "arrival_scene": "scene_engine_hall",
         "music": mus("music_heart"), "ambient": ["amb_heartbeat"]},
    ]
    region = {"id": "region_karst", "label": "Карст-Гальвана", "map_image": "", "map_art": art_map(),
              "map_size": {"w": 1280, "h": 720}, "parent_region": None, "locations": locations}
    return {"regions": [region]}


def art_map():
    L = []
    L += rect(0, 0, 1280, 720, grad("#2a2418", "#141008"), "пергамент")
    L += rect(20, 20, 1240, 680, "#3a3020", "поле карты", stroke="#8a6a3a", sw=4, opacity=0.6)
    # каньон
    L += poly([420, 0, 860, 0, 900, 200, 1040, 420, 900, 720, 380, 720, 220, 420, 360, 200], "#1e1a12", "каньон", opacity=0.85)
    L += poly([560, 0, 720, 0, 700, 300, 760, 520, 700, 720, 560, 720, 520, 520, 580, 300], "#14110a", "русло", opacity=0.9)
    # дороги
    for a, b in [((960, 300), (790, 510)), ((960, 300), (300, 230)), ((960, 300), (640, 100)), ((790, 510), (330, 480)),
                 ((300, 230), (640, 100)), ((330, 480), (300, 230)), ((790, 510), (560, 620)), ((330, 480), (560, 620)),
                 ((560, 620), (640, 380)), ((640, 100), (640, 380))]:
        L += line(a[0], a[1], b[0], b[1], "#8a6a3a", 3, "дорога", opacity=0.55)
    L += gear(640, 380, 46, "#5a4a2a", 14, "знак Сердца", opacity=0.6)
    L += gear(1150, 600, 50, "#6a5030", 12, "роза ветров", opacity=0.5)
    L += fog(420, 300, "#7a8a64", 0.18, "хмарь над нижним городом")
    return doc("#1a140c", L)


def build_scenes():
    S = {}

    def add(id_, label, loc, states, slots, navs, chapter, music=None):
        sc = {"id": id_, "label": label, "location": loc, "canvas": {"w": 1280, "h": 720},
              "states": states, "slots": slots, "navigation": navs, "chapter": chapter}
        if music:
            sc["music"] = music
        S[id_] = sc

    P = ["person"]
    I = ["item"]
    PR = ["prop"]
    add("scene_office", "Контора дознавателя", "loc_station",
        [state("state_office_night", "Ночью", art_office(True), {"time_of_day": ["evening", "night"]}),
         state("state_office_day", "Днём", art_office(False))],
        [slot("slot_osric", "За столом", P, 580, 270, 150, 330, "npc_osric"),
         slot("slot_board", "Доска улик", I, 70, 130, 330, 240, "item_evidence_board"),
         slot("slot_cot", "Койка", I, 820, 488, 260, 90, "item_cot")],
        [nav("На перрон", (1110, 300, 120, 300), "scene_platform"),
         nav("Вниз, в мертвецкую", (455, 330, 90, 270), "scene_morgue"),
         nav("Карта города", (1110, 120, 120, 130), open_map=True)], "ch_prologue")
    add("scene_platform", "Перрон", "loc_station",
        [state("state_platform_day", "Днём", art_platform(False), {"time_of_day": ["morning", "day"]}),
         state("state_platform_night", "Ночью", art_platform(True))],
        [slot("slot_vendor", "Автомат-раздатчик", PR, 165, 300, 130, 300, "npc_vendor")],
        [nav("В контору", (560, 330, 100, 270), "scene_office"),
         nav("В город", (1130, 300, 130, 320), open_map=True)], "ch_prologue")
    add("scene_morgue", "Мертвецкая", "loc_station",
        [state("state_morgue", "Обычно", art_morgue())],
        [slot("slot_vale", "У инструментов", P, 890, 280, 150, 330, "npc_vale"),
         slot("slot_corpse", "Секционный стол", I, 450, 420, 400, 90, "item_corpse")],
        [nav("Наверх, в контору", (40, 260, 140, 360), "scene_office")], "ch_prologue")

    add("scene_lower_street", "Улица Заклёпок", "loc_lower",
        [state("state_street_night", "Ночью", art_lower_street(True), {"time_of_day": ["evening", "night"]}),
         state("state_street_day", "Днём", art_lower_street(False))],
        [slot("slot_pik", "У бочки", P, 640, 300, 130, 320, "npc_pik", cond={"not_flag": "pik_joined"}),
         slot("slot_trash", "Куча хлама", I, 330, 520, 190, 120, "item_trash_heap")],
        [nav("В кабак «Мятый клапан»", (120, 330, 120, 270), "scene_tavern"),
         nav("В мастерскую Марроу", (1020, 340, 110, 260), "scene_workshop"),
         nav("Проулком — на карту", (780, 300, 160, 220), open_map=True)], "ch_city")
    add("scene_tavern", "Кабак «Мятый клапан»", "loc_lower",
        [state("state_tavern", "Обычно", art_tavern())],
        [slot("slot_grimm", "За стойкой", P, 545, 230, 140, 330, "npc_grimm"),
         slot("slot_hesk", "Стол в углу", P, 950, 290, 140, 330, "npc_hesk")],
        [nav("На улицу", (40, 300, 120, 300), "scene_lower_street")], "ch_city")
    add("scene_workshop", "Мастерская Марроу", "loc_lower",
        [state("state_workshop", "Обычно", art_workshop())],
        [slot("slot_marrow", "У верстака", P, 420, 280, 140, 330, "npc_marrow"),
         slot("slot_cabinet", "Запертый шкаф", I, 900, 220, 160, 300, "item_marrow_cabinet")],
        [nav("На улицу", (40, 300, 110, 300), "scene_lower_street")], "ch_city")

    add("scene_foundry_floor", "Литейный цех", "loc_foundry",
        [state("state_foundry", "Обычно", art_foundry())],
        [slot("slot_bruno", "У наковальни", P, 250, 290, 140, 330, "npc_bruno"),
         slot("slot_valve", "Клапан №7", I, 820, 300, 160, 170, "item_valve7")],
        [nav("В казарму кочегаров", (1120, 330, 120, 280), "scene_barracks"),
         nav("Через ворота — на карту", (10, 270, 130, 350), open_map=True)], "ch_city")
    add("scene_barracks", "Казарма кочегаров", "loc_foundry",
        [state("state_barracks", "Обычно", art_barracks())],
        [slot("slot_martha", "У нар", P, 560, 290, 140, 330, "npc_martha"),
         slot("slot_lockers", "Шкафчики", I, 900, 200, 280, 360, "item_lockers")],
        [nav("В цех", (40, 300, 110, 300), "scene_foundry_floor")], "ch_city")

    add("scene_nave", "Неф Собора", "loc_cathedral",
        [state("state_nave", "Обычно", art_nave())],
        [slot("slot_gallian", "Перед алтарём", P, 570, 280, 150, 330, "npc_gallian", cond={"not_flag": "gallian_arrested"}),
         slot("slot_prayer", "Молитвенный механизм", I, 860, 380, 150, 180, "item_prayer_engine")],
        [nav("В скрипторий", (260, 380, 90, 230), "scene_archive"),
         nav("На колокольню", (1120, 360, 110, 250), "scene_belltower"),
         nav("Главные врата — на карту", (40, 360, 130, 250), open_map=True)], "ch_city")
    add("scene_archive", "Скрипторий", "loc_cathedral",
        [state("state_archive", "Обычно", art_archive())],
        [slot("slot_tobias", "У пюпитра", P, 640, 280, 140, 330, "npc_tobias")],
        [nav("В неф", (40, 300, 110, 300), "scene_nave")], "ch_city")
    add("scene_belltower", "Колокольня", "loc_cathedral",
        [state("state_bell_clear", "После схватки", art_belltower(True), {"flag": "belltower_cleared"}),
         state("state_bell", "Тревожно", art_belltower(False))],
        [slot("slot_bell_chest", "Окованный сундук", I, 820, 470, 160, 110, "item_bell_chest")],
        [nav("Вниз, в неф", (40, 380, 130, 240), "scene_nave")], "ch_city")

    add("scene_council_hall", "Зал Совета", "loc_spire",
        [state("state_council_broken", "После разоблачения", art_council(True), {"flag": "venn_exposed"}),
         state("state_council", "Заседание", art_council(False))],
        [slot("slot_venn", "На подиуме", P, 600, 220, 140, 340, "npc_venn", cond={"not_flag": "venn_exposed"}),
         slot("slot_tribune", "Кафедра обвинения", I, 300, 410, 140, 190, "item_tribune")],
        [nav("В канцелярию", (1100, 300, 120, 310), "scene_chancery"),
         nav("Лифт вниз — на карту", (30, 300, 120, 310), open_map=True)], "ch_city")
    add("scene_chancery", "Канцелярия Совета", "loc_spire",
        [state("state_chancery", "Обычно", art_chancery())],
        [slot("slot_drew", "У картотеки", P, 420, 280, 140, 330, "npc_drew"),
         slot("slot_drew_desk", "Стол секретаря", I, 800, 390, 260, 180, "item_drew_desk")],
        [nav("В зал Совета", (40, 300, 110, 300), "scene_council_hall")], "ch_city")

    add("scene_collector", "Коллектор №7", "loc_undercity",
        [state("state_collector", "Обычно", art_collector())],
        [slot("slot_grille", "Решётка в стене", PR, 560, 200, 160, 160, "npc_grille"),
         slot("slot_phonograph", "Фонограф", I, 900, 440, 160, 145, "item_phonograph")],
        [nav("В затопленную галерею", (1120, 260, 140, 300), "scene_flooded"),
         nav("Лестница наверх — на карту", (40, 140, 80, 460), open_map=True)], "ch_depths")
    add("scene_flooded", "Затопленная галерея", "loc_undercity",
        [state("state_flooded_open", "Шлюз открыт", art_flooded(True), {"flag": "deep_lock_open"}),
         state("state_flooded", "Обычно", art_flooded(False))],
        [slot("slot_remains", "Обломки мостков", I, 380, 520, 180, 90, "item_jens_jacket"),
         slot("slot_deep_lock", "Глубокий шлюз", I, 890, 240, 240, 240, "item_deep_lock",
              use_with=[{"item": "item_valve_key", "consume": False,
                         "effects": [{"type": "fire_rule", "rule": "rule_open_deep_lock"}],
                         "message": "Ключ-шестерня входит в скважину. Механизм шлюза нехотя проворачивается."}])],
        [nav("Назад, в коллектор", (20, 300, 120, 300), "scene_collector")], "ch_depths")

    add("scene_engine_hall", "Машинный зал", "loc_heart",
        [state("state_engine", "Обычно", art_engine_hall())],
        [],
        [nav("К ядру", (540, 230, 200, 320), "scene_core"),
         nav("Подъёмник — на карту", (20, 300, 120, 320), open_map=True)], "ch_finale")
    add("scene_core", "Ядро Сердца", "loc_heart",
        [state("state_core", "Сердце бьётся", art_core(False))],
        [slot("slot_litany", "Сердце-Двигатель", PR, 520, 180, 240, 280, "npc_litany")],
        [nav("Назад, в машинный зал", (20, 300, 120, 300), "scene_engine_hall")], "ch_finale")
    return S
