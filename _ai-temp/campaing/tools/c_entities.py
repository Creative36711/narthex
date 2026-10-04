"""Сущности кампании: герой, НПС, противники, «говорящие» устройства."""

from c_items import ITEMS


def portrait(name, states=None):
    p = {"neutral": "" if name is None else "assets/img/npc/%s.png" % name}
    if states:
        p.update(states)
    return p


def npc(ident, label, description, stats, skills, portrait_img="", **kw):
    e = {"id": ident, "type": "npc", "label": label, "description": description,
         "portrait": portrait(portrait_img), "stats": stats, "skills": skills}
    if portrait_img:
        e["scene_sprite"] = "assets/img/npc/%s.png" % portrait_img
    e.update(kw)
    return e


S = lambda a, b, c, d, e, f, g: {"STR": a, "CON": b, "SIZ": c, "DEX": d,
                                 "INT": e, "POW": f, "CHA": g}

PLAYER = {
    "id": "player_hero",
    "type": "npc",
    "label": "Дознаватель",
    "description": "Работник Цеха без громкого имени. Идёт туда, куда зовут, и задаёт вопросы, которых не любят.",
    "portrait": {},
    "stats": S(11, 11, 11, 11, 11, 11, 11),
    "skills": {"dodge": 25, "first_aid": 25, "mechanics": 20, "perceive": 20,
               "investigate": 20, "persuade": 20, "melee": 20},
    "equipment": {},
    "inventory": [{"item": "item_mark", "quantity": 12},
                  {"item": "item_hammer", "quantity": 1},
                  {"item": "item_bandage", "quantity": 2}],
    "sounds": {"talk": "sfx_click"},
}

NPCS = {}


def add(e):
    NPCS[e["id"]] = e


add(PLAYER)

# ------------------------------------------------------------------ пролог

add(npc(
    "npc_pepel", "Стражник Пепел",
    "Стражник пропускного двора: сонный, честный по уставу и по-человечески подкупный. Ночью он решает, кто войдёт в Котёл.",
    S(12, 11, 12, 10, 9, 8, 9), {"melee": 42, "brawl": 38, "dodge": 30, "perceive": 30},
    "pepel", dialogue="dialogues/pepel.ink", slot_type="person", schedule=[],
    faction="faction_strazha", base_disposition=0, armor=2,
    equipment={"weapon": "item_pipe"}, inventory=[],
    sounds={"talk": "sfx_click"},
))

add(npc(
    "npc_sera", "Сера Дольная",
    "Дознавательница Литаой Курии. Двенадцать лет закрывает чужие дела и впервые не может закрыть это. Ходит в стоптанных сапогах и с чужим гроссбухом под мышкой.",
    S(10, 11, 10, 12, 14, 12, 11),
    {"investigate": 60, "perceive": 50, "persuade": 45, "lie": 30, "dodge": 35,
     "first_aid": 35, "mechanics": 25, "melee": 30},
    "sera", dialogue="dialogues/sera.ink", slot_type="person", schedule=[],
    faction="faction_ceh", base_disposition=15, armor=1,
    equipment={"weapon": "item_knife"}, inventory=[{"item": "item_mark", "quantity": 14}],
    sounds={"talk": "sfx_click"},
))

# ------------------------------------------------------------------ рынок и корчма

add(npc(
    "npc_gvozd", "Гвоздь",
    "Торговец железом на Ржавом рынке. Продаёт всё, что не удалось вынести с работы, и не задаёт вопросов, на которые не хочет слышать ответ.",
    S(11, 11, 12, 10, 11, 9, 12),
    {"bargain": 55, "persuade": 40, "lie": 35, "perceive": 35, "melee": 30},
    "gvozd", dialogue="dialogues/gvozd.ink", slot_type="person", schedule=[],
    faction="faction_okolina", base_disposition=0,
    trader={
        "sells": [
            {"item": "item_bread", "price": 3},
            {"item": "item_clean_water", "price": 5},
            {"item": "item_cloth", "price": 2},
            {"item": "item_coal", "price": 4},
            {"item": "item_oil", "price": 7},
            {"item": "item_bandage", "price": 6},
            {"item": "item_lockpicks", "price": 20},
            {"item": "item_wrench", "price": 18},
            {"item": "item_tongs", "price": 12},
            {"item": "item_lantern", "price": 15},
            {"item": "item_pipe", "price": 5},
            {"item": "item_apron", "price": 20},
            {"item": "item_brass_charm", "price": 26},
            {"item": "item_needles", "price": 8},
        ],
        "buys": True, "buy_rate": 0.5,
    },
    inventory=[{"item": "item_mark", "quantity": 60}],
    sounds={"talk": "sfx_coin"},
))

add(npc(
    "npc_marla", "Марла Шов",
    "Хозяйка корчмы «Тёплый шов». Кормит всех, кто платит, и некоторых, кто не платит. Знает слухи раньше, чем они случаются.",
    S(12, 12, 12, 10, 12, 11, 13),
    {"persuade": 45, "bargain": 40, "perceive": 35, "first_aid": 30, "brawl": 35},
    "marla", dialogue="dialogues/marla.ink", slot_type="person", schedule=[],
    faction="faction_okolina", base_disposition=10,
    trader={
        "sells": [
            {"item": "item_stew", "price": 6},
            {"item": "item_bread", "price": 2},
            {"item": "item_kvass", "price": 3},
            {"item": "item_tea", "price": 5},
            {"item": "item_mushrooms", "price": 2},
            {"item": "item_clean_water", "price": 4},
        ],
        "buys": True, "buy_rate": 0.5,
    },
    inventory=[{"item": "item_mark", "quantity": 40}],
    sounds={"talk": "sfx_click"},
))

add(npc(
    "npc_kir", "Кир, трубочист",
    "Одиннадцать лет, вечная сажа под ногтями и карта труб в голове. Ищет старшего брата, который ушёл в Окалины и не вернулся.",
    S(6, 8, 6, 13, 10, 9, 11),
    {"stealth": 55, "athletics": 50, "perceive": 40, "lockpick": 30, "dodge": 40},
    "kir", dialogue="dialogues/kir.ink", slot_type="person", schedule=[],
    faction="faction_okolina", base_disposition=5,
    inventory=[{"item": "item_mark", "quantity": 3}],
    sounds={"talk": "sfx_click"},
))

# ------------------------------------------------------------------ слобода

add(npc(
    "npc_veksel", "Вексель",
    "Ростовщик Литейной слободы. Выдаёт марки под расписку и ведёт гроссбух, в котором три имени уже не ответят.",
    S(8, 9, 9, 9, 13, 8, 12),
    {"bargain": 60, "persuade": 45, "lie": 50, "perceive": 40, "dodge": 25},
    "veksel", dialogue="dialogues/veksel.ink", slot_type="person", schedule=[],
    faction="faction_ceh", base_disposition=-5,
    inventory=[{"item": "item_mark", "quantity": 90}],
    sounds={"talk": "sfx_coin"},
))

add(npc(
    "npc_gnat", "Гнат Шпилька",
    "Подмастерье часовщика, 19 лет. Видел, как уводили человека в трубу, и с тех пор спит с молотком под подушкой.",
    S(9, 10, 9, 12, 11, 9, 8),
    {"craft": 55, "mechanics": 50, "lockpick": 35, "stealth": 40, "dodge": 35},
    "gnat", dialogue="dialogues/gnat.ink", slot_type="person", schedule=[],
    faction="faction_okolina", base_disposition=0,
    inventory=[{"item": "item_mark", "quantity": 6}],
    sounds={"talk": "sfx_click"},
))

# ------------------------------------------------------------------ барак и часовня

add(npc(
    "npc_klepa", "Клепа, цеховая фельдшерица",
    "Фельдшерица карантинного барака. Держит пятерых больных на мхе, настое и злости. Разговаривает короткими фразами, как будто экономит воздух.",
    S(9, 11, 10, 11, 14, 11, 9),
    {"medicine": 60, "first_aid": 65, "perceive": 45, "persuade": 35, "mechanics": 30},
    "klepa", dialogue="dialogues/klepa.ink", slot_type="person", schedule=[],
    faction="faction_ceh", base_disposition=5,
    trader={"sells": [{"item": "item_moss", "price": 4, "stock": 10},
                      {"item": "item_bandage", "price": 8, "stock": 6},
                      {"item": "item_tonic", "price": 14, "stock": 3},
                      {"item": "item_ether_vial", "price": 30, "stock": 2},
                      {"item": "item_clean_water", "price": 5, "stock": 6}],
            "buys": True, "buy_rate": 0.5},
    inventory=[{"item": "item_tonic", "quantity": 2}, {"item": "item_moss", "quantity": 4}],
    sounds={"talk": "sfx_paper"},
))

add(npc(
    "npc_ryab", "Отец Ржав",
    "Жрец Остывшего Пламени. Учит, что машину надо отпускать, а не доить. Двенадцать лет назад исповедовал человека, которого потом объявили погибшим.",
    S(9, 10, 10, 8, 13, 15, 12),
    {"lore_ether": 65, "persuade": 50, "medicine": 40, "perceive": 45, "first_aid": 40},
    "ryab", dialogue="dialogues/ryab.ink", slot_type="person", schedule=[],
    faction="faction_plamya", base_disposition=15,
    inventory=[{"item": "item_tea", "quantity": 3}, {"item": "item_bitter_drops", "quantity": 2}],
    sounds={"talk": "sfx_whisper"},
))

# ------------------------------------------------------------------ трубы и финал

add(npc(
    "npc_tisha", "Тихая",
    "Девочка лет семи в сером платье, босая, без тени. Говорит шёпотом и знает дороги, которых нет на карте.",
    S(3, 8, 4, 10, 11, 14, 12),
    {"lore_ether": 55, "stealth": 70, "perceive": 50, "persuade": 30},
    "tisha", dialogue="dialogues/tisha.ink", slot_type="person", schedule=[],
    faction="faction_plamya", base_disposition=20, shadow=False,
    inventory=[],
    sounds={"talk": "sfx_whisper"},
))

add(npc(
    "npc_barnaba", "Барнаба Заводной",
    "Рука Кляйна: латунный каркас, человеческие глаза и пружина вместо дыхания. Помнит, что был человеком, и ненавидит это воспоминание.",
    S(14, 13, 13, 11, 10, 9, 6),
    {"melee": 60, "brawl": 55, "dodge": 35, "perceive": 40, "intimidate": 50},
    "barnaba", dialogue="dialogues/barnaba.ink", slot_type="person", schedule=[],
    faction="faction_kukly", base_disposition=-30, armor=3,
    equipment={"weapon": "item_hammer"},
    abilities=["ability_brass_fist", "ability_steam_vent"],
    morale={"below_hp_pct": 25, "flee_chance": 0},
    loot_table=[{"item": "item_gear", "chance": 1, "min": 1, "max": 2},
                {"item": "item_scrap", "chance": 0.8, "min": 1, "max": 3}],
    sounds={"talk": "sfx_gear"},
))

add(npc(
    "npc_klein", "Мастер Кляйн",
    "Главный механик Котла, официально погибший двенадцать лет назад. С тех пор он научился говорить с металлом и записывать себя в него.",
    S(12, 13, 12, 11, 18, 16, 13),
    {"lore_ether": 75, "mechanics": 75, "persuade": 60, "investigate": 55, "dodge": 35},
    "klein", dialogue="dialogues/klein.ink", slot_type="person", schedule=[],
    faction="faction_kukly", base_disposition=-20, armor=2,
    abilities=["ability_whisper_lash"],
    inventory=[{"item": "item_ether_vial", "quantity": 2}],
    sounds={"talk": "sfx_whisper"},
))

add(npc(
    "npc_ironmother", "Железная Мать",
    "Турбина-сердце Котла: чугунная громада с латунными жилами. Двенадцать лет её доили, и она научилась говорить.",
    S(20, 20, 20, 6, 12, 18, 4),
    {"melee": 50, "brawl": 45, "perceive": 40},
    "ironmother", dialogue="dialogues/ironmother.ink", slot_type="person", schedule=[],
    faction="faction_kukly", base_disposition=-10, armor=6,
    abilities=["ability_steam_vent", "ability_whisper_lash"],
    morale={"below_hp_pct": 10, "flee_chance": 0},
    sounds={"talk": "sfx_heart"},
))

add(npc(
    "npc_mey", "Слепая Мей",
    "Девочка с погоста, которая слышит, в каких трубах стоит вода, а в каких — дыхание. Бродит у часовни и считает вслух.",
    S(6, 7, 6, 9, 13, 15, 12),
    {"perceive": 60, "lore_ether": 45, "investigate": 30, "persuade": 20, "dodge": 25},
    "mey", dialogue="dialogues/mey.ink", slot_type="person", schedule=[],
    faction="faction_okolina", base_disposition=10, armor=0,
    inventory=[{"item": "item_sweet", "quantity": 1}],
    sounds={"talk": "sfx_click"},
))

# ------------------------------------------------------------------ бойцы улиц

add(npc(
    "npc_zavodnoy", "Заводной",
    "Рядовой каркас Кляйна: латунь, кожа, чужие руки. Двигается рывками и не отвечает на вопросы.",
    S(13, 12, 12, 11, 8, 8, 5),
    {"brawl": 50, "melee": 45, "dodge": 30, "perceive": 30},
    None, slot_type="person", schedule=[],
    faction="faction_kukly", base_disposition=-40, armor=2,
    natural_weapon={"skill": "brawl", "damage": "1d6+1", "damage_bonus": True,
                    "range": 1, "attacks_per_round": 1, "parry_capable": True},
    combat_figure="assets/img/npc/zavodnoy.png", figure_mode="topdown",
    abilities=["ability_brass_fist"],
    morale={"below_hp_pct": 20, "flee_chance": 0},
    loot_table=[{"item": "item_scrap", "chance": 0.9, "min": 1, "max": 3},
                {"item": "item_gear", "chance": 0.4, "min": 1, "max": 1}],
    sounds={"talk": "sfx_gear"},
))

add(npc(
    "npc_pipe_beast", "Тварь из трубы",
    "Слепой зверь, выросший на угарном дыме. Идёт на тепло и дышит тем же, чем дышит город.",
    S(15, 13, 14, 12, 3, 10, 2),
    {"brawl": 55, "stealth": 45, "dodge": 35},
    None, slot_type="animal", schedule=[],
    faction="faction_kukly", base_disposition=-50, armor=1,
    natural_weapon={"skill": "brawl", "damage": "1d6", "damage_bonus": True,
                    "range": 1, "attacks_per_round": 2, "parry_capable": False},
    combat_figure="assets/img/npc/beast.png", figure_mode="side",
    abilities=["ability_tox_cloud"],
    morale={"below_hp_pct": 25, "flee_chance": 40},
    loot_table=[{"item": "item_scrap", "chance": 0.5, "min": 1, "max": 2}],
))

add(npc(
    "npc_strazh", "Патрульный стражи",
    "Стражник в кольчуге с дубинкой и фонарём. Ночью он не спрашивает имени, а бьёт по уставу.",
    S(12, 12, 12, 10, 8, 9, 8),
    {"melee": 45, "brawl": 40, "dodge": 35, "perceive": 35},
    "strazh", slot_type="person", schedule=[],
    faction="faction_strazha", base_disposition=0, armor=3,
    equipment={"weapon": "item_pipe"},
    combat_figure="assets/img/npc/strazh.png", figure_mode="topdown",
    morale={"below_hp_pct": 30, "flee_chance": 30},
    loot_table=[{"item": "item_mark", "chance": 0.9, "min": 3, "max": 9},
                {"item": "item_pipe", "chance": 0.4, "min": 1, "max": 1}],
))


def build_entities():
    return dict(NPCS, **ITEMS)
