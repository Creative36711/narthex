"""Сущности: НПС, твари, предметы и реквизит сцен."""

IMG = "assets/img/"

# ---------------------------------------------------------------- НПС


def npc(id, label, desc, stats, skills, portrait, dialogue=None, slot_type="person",
        schedule=None, presence=None, faction=None, base_disposition=None, trader=None,
        inventory=None, equipment=None, natural_weapon=None, abilities=None, morale=None,
        armor=None, loot=None, combat_figure=None, scene_sprite=None, sounds=None,
        figure_mode=None, perception=None):
    e = {
        "id": id, "type": "npc", "label": label, "description": desc,
        "portrait": portrait, "stats": stats, "skills": skills,
        "slot_type": slot_type, "schedule": schedule if schedule is not None else [],
    }
    if dialogue:
        e["dialogue"] = dialogue
    if presence:
        e["presence_overrides"] = presence
    if faction:
        e["faction"] = faction
    if base_disposition is not None:
        e["base_disposition"] = base_disposition
    if trader:
        e["trader"] = trader
    if inventory:
        e["inventory"] = inventory
    if equipment:
        e["equipment"] = equipment
    if natural_weapon:
        e["natural_weapon"] = natural_weapon
    if abilities:
        e["abilities"] = abilities
    if morale:
        e["morale"] = morale
    if armor is not None:
        e["armor"] = armor
    if loot:
        e["loot_table"] = loot
    if combat_figure:
        e["combat_figure"] = combat_figure
    if scene_sprite:
        e["scene_sprite"] = scene_sprite
    if sounds:
        e["sounds"] = sounds
    if figure_mode:
        e["figure_mode"] = figure_mode
    if perception is not None:
        e["perception"] = perception
    return e


def port(name):
    """Портрет: один файл на все состояния, чтобы облик героя/NPC не ломался."""
    p = IMG + f"npc_{name}.jpg"
    return {"neutral": p, "angry": p, "afraid": p, "sad": p, "calm": p}


HERO_SKILLS = {
    "spot": 65, "search": 70, "persuade": 70, "pressure": 35, "stealth": 30,
    "dodge": 45, "brawl": 20, "melee": 20, "crossbow": 25, "repair": 15,
    "survival": 30, "bargain": 25, "first_aid": 15, "lockpick": 15,
    "tech_lore": 15, "whisper": 15,
}

WATCH_STATS = {"STR": 11, "CON": 12, "SIZ": 11, "DEX": 10, "INT": 12, "POW": 11, "CHA": 12}

ENTITIES = []


def add(e):
    ENTITIES.append(e)
    return e


add(npc(
    "player_hero", "Дознаватель", "Дознаватель Надзора. В груди — опытное медное сердце той же серии, что у убитых.",
    WATCH_STATS, HERO_SKILLS, {},
    inventory=[{"item": "item_mark", "quantity": 30}, {"item": "item_ration", "quantity": 2},
               {"item": "item_water", "quantity": 1}, {"item": "item_filter", "quantity": 1},
               {"item": "item_badge", "quantity": 1}],
    equipment={"weapon": "item_wrench", "armor": "item_coat", "mask": "item_respirator"},
    sounds={"talk": "sfx_talk"},
))

add(npc(
    "npc_stroy", "Капитан Строй",
    "Капитан городского Надзора. Двадцать лет службы, усталые глаза и привычка закрывать дела, а не раскрывать их.",
    {"STR": 12, "CON": 12, "SIZ": 13, "DEX": 9, "INT": 12, "POW": 12, "CHA": 11},
    {"spot": 55, "search": 45, "persuade": 60, "pressure": 70, "bargain": 40, "stealth": 20,
     "dodge": 35, "brawl": 45, "melee": 55, "crossbow": 40, "repair": 15, "first_aid": 25,
     "lockpick": 15, "tech_lore": 25, "survival": 40, "whisper": 5},
    port("stroy"), dialogue="dialogues/stroy.ink", faction="faction_watch",
    base_disposition=10,
    inventory=[{"item": "item_mark", "quantity": 40}],
    equipment={"weapon": "item_rebar", "armor": "item_coat"},
    loot=[{"item": "item_mark", "chance": 1, "min": 10, "max": 25}],
    sounds={"talk": "sfx_talk"},
))

add(npc(
    "npc_karna", "Карна Вет",
    "Огранщица из Медного ряда, вдова Эрдала Вета. Пальцы в медной пыли, голос ровный до тех пор, пока не спросят о муже.",
    {"STR": 9, "CON": 10, "SIZ": 9, "DEX": 14, "INT": 13, "POW": 12, "CHA": 11},
    {"spot": 60, "search": 45, "persuade": 50, "pressure": 35, "bargain": 55, "stealth": 30,
     "dodge": 35, "brawl": 20, "melee": 20, "crossbow": 15, "repair": 45, "first_aid": 25,
     "lockpick": 20, "tech_lore": 45, "survival": 30, "whisper": 10},
    port("karna"), dialogue="dialogues/karna.ink", faction="faction_guild",
    base_disposition=-5,
    inventory=[{"item": "item_mark", "quantity": 60}, {"item": "item_lens", "quantity": 1}],
    sounds={"talk": "sfx_talk"},
))

add(npc(
    "npc_grist", "Мастер Грист",
    "Литейщик, старший по плавильному залу. Руки как ковши, взгляд бегает. Один из тех, кто спускался к Сердцу.",
    {"STR": 15, "CON": 14, "SIZ": 15, "DEX": 8, "INT": 10, "POW": 9, "CHA": 9},
    {"spot": 35, "search": 30, "persuade": 30, "pressure": 40, "bargain": 30, "stealth": 15,
     "dodge": 25, "brawl": 60, "melee": 55, "crossbow": 15, "repair": 55, "first_aid": 20,
     "lockpick": 10, "tech_lore": 50, "survival": 45, "whisper": 5},
    port("grist"), dialogue="dialogues/grist.ink", faction="faction_guild",
    base_disposition=0,
    inventory=[{"item": "item_mark", "quantity": 35}, {"item": "item_scrap", "quantity": 2}],
    equipment={"weapon": "item_rebar", "armor": "item_coat"},
    loot=[{"item": "item_mark", "chance": 1, "min": 5, "max": 15},
          {"item": "item_scrap", "chance": 0.6, "min": 1, "max": 2}],
    sounds={"talk": "sfx_talk"},
))

add(npc(
    "npc_vergo", "Писарь Верго",
    "Цеховой писарь. Носит очки на шнурке и считает, что бумага важнее человека, потому что бумага остаётся.",
    {"STR": 7, "CON": 9, "SIZ": 10, "DEX": 10, "INT": 14, "POW": 10, "CHA": 10},
    {"spot": 45, "search": 55, "persuade": 45, "pressure": 20, "bargain": 60, "stealth": 25,
     "dodge": 25, "brawl": 10, "melee": 10, "crossbow": 10, "repair": 20, "first_aid": 20,
     "lockpick": 30, "tech_lore": 60, "survival": 20, "whisper": 5},
    port("vergo"), dialogue="dialogues/vergo.ink", faction="faction_guild",
    base_disposition=0,
    inventory=[{"item": "item_mark", "quantity": 90}],
    sounds={"talk": "sfx_talk"},
))

add(npc(
    "npc_moth", "Щепка",
    "Подросток из Нижних труб, худой и быстрый. Видел у решётки то, о чём лучше молчать, и торгует этим за еду.",
    {"STR": 8, "CON": 10, "SIZ": 8, "DEX": 15, "INT": 11, "POW": 10, "CHA": 10},
    {"spot": 60, "search": 60, "persuade": 35, "pressure": 15, "bargain": 50, "stealth": 65,
     "dodge": 60, "brawl": 30, "melee": 25, "crossbow": 20, "repair": 20, "first_aid": 20,
     "lockpick": 45, "tech_lore": 20, "survival": 55, "whisper": 10},
    port("moth"), dialogue="dialogues/moth.ink", faction="faction_undercity",
    base_disposition=-5,
    inventory=[{"item": "item_mark", "quantity": 6}, {"item": "item_cloth", "quantity": 1}],
    equipment={"weapon": "item_knife_small"},
    sounds={"talk": "sfx_talk"},
))

add(npc(
    "npc_mira", "Мира",
    "Сестра Щепки. Лежит на тюфяке и дышит так, будто каждое дыхание приходится занимать.",
    {"STR": 6, "CON": 7, "SIZ": 8, "DEX": 9, "INT": 10, "POW": 9, "CHA": 9},
    {"spot": 30, "search": 25, "persuade": 40, "pressure": 10, "bargain": 20, "stealth": 25,
     "dodge": 20, "brawl": 10, "melee": 10, "crossbow": 10, "repair": 15, "first_aid": 20,
     "lockpick": 15, "tech_lore": 15, "survival": 30, "whisper": 15},
    port("mira"), dialogue="dialogues/mira.ink", faction="faction_undercity",
    base_disposition=5,
    sounds={"talk": "sfx_talk"},
))

add(npc(
    "npc_era", "Старая Эра",
    "Проводница: слышит ток в жилах Сердца и говорит о нём так, будто это сосед по лестнице.",
    {"STR": 6, "CON": 8, "SIZ": 9, "DEX": 7, "INT": 14, "POW": 16, "CHA": 11},
    {"spot": 50, "search": 35, "persuade": 55, "pressure": 25, "bargain": 30, "stealth": 20,
     "dodge": 20, "brawl": 10, "melee": 10, "crossbow": 10, "repair": 25, "first_aid": 35,
     "lockpick": 15, "tech_lore": 55, "survival": 50, "whisper": 75},
    port("era"), dialogue="dialogues/era.ink", faction="faction_conductors",
    base_disposition=0,
    inventory=[{"item": "item_cog", "quantity": 1}, {"item": "item_cloth", "quantity": 2}],
    sounds={"talk": "sfx_talk"},
))

add(npc(
    "npc_volt", "Вольт",
    "Зольный скупщик. Улыбается так, будто всё на свете уже куплено и осталось только назвать цену.",
    {"STR": 11, "CON": 12, "SIZ": 12, "DEX": 11, "INT": 13, "POW": 10, "CHA": 13},
    {"spot": 50, "search": 45, "persuade": 60, "pressure": 45, "bargain": 80, "stealth": 40,
     "dodge": 40, "brawl": 40, "melee": 45, "crossbow": 50, "repair": 40, "first_aid": 25,
     "lockpick": 35, "tech_lore": 40, "survival": 45, "whisper": 5},
    {}, dialogue="dialogues/volt.ink", faction="faction_undercity",
    base_disposition=0,
    trader={"sells": [
        {"item": "item_crossbow", "price": 85, "stock": 1},
        {"item": "item_bolt", "price": 1, "stock": 24},
        {"item": "item_medicine", "price": 26, "stock": 2},
        {"item": "item_tea", "price": 5, "stock": 4},
        {"item": "item_filter", "price": 10, "stock": 3},
        {"item": "item_scrap", "price": 3, "stock": 6},
        {"item": "item_ration", "price": 7, "stock": 4},
    ], "buys": True, "buy_rate": 0.6},
    inventory=[{"item": "item_mark", "quantity": 220}, {"item": "item_heart_copper", "quantity": 1}],
    equipment={"weapon": "item_knife_small"},
    loot=[{"item": "item_mark", "chance": 1, "min": 20, "max": 60},
          {"item": "item_heart_copper", "chance": 0.8, "min": 1, "max": 1}],
    sounds={"talk": "sfx_talk"},
))

add(npc(
    "npc_kotel", "Хозяин Котла",
    "Трактирщик Медного ряда. Держит печь, похлёбку и чужую память — в этом порядке.",
    {"STR": 13, "CON": 13, "SIZ": 14, "DEX": 9, "INT": 12, "POW": 11, "CHA": 12},
    {"spot": 45, "search": 30, "persuade": 55, "pressure": 50, "bargain": 60, "stealth": 15,
     "dodge": 30, "brawl": 55, "melee": 50, "crossbow": 20, "repair": 30, "first_aid": 25,
     "lockpick": 10, "tech_lore": 25, "survival": 45, "whisper": 5},
    {}, dialogue="dialogues/kotel.ink", faction="faction_guild",
    base_disposition=5,
    trader={"sells": [
        {"item": "item_ration", "price": 6, "stock": 8},
        {"item": "item_water", "price": 3, "stock": 8},
        {"item": "item_tea", "price": 4, "stock": 6},
        {"item": "item_medicine", "price": 32, "stock": 2},
        {"item": "item_cloth", "price": 4, "stock": 4},
    ], "buys": True, "buy_rate": 0.5},
    inventory=[{"item": "item_mark", "quantity": 120}],
    equipment={"weapon": "item_rebar"},
    sounds={"talk": "sfx_talk"},
))

add(npc(
    "npc_hawker", "Торговка Аглая",
    "Держит лоток на Медном ряду: пайки, вода, тряпьё и новости, которые нигде не печатают.",
    {"STR": 10, "CON": 11, "SIZ": 11, "DEX": 11, "INT": 12, "POW": 10, "CHA": 13},
    {"spot": 50, "search": 40, "persuade": 55, "pressure": 25, "bargain": 75, "stealth": 30,
     "dodge": 35, "brawl": 25, "melee": 20, "crossbow": 15, "repair": 25, "first_aid": 20,
     "lockpick": 20, "tech_lore": 25, "survival": 45, "whisper": 5},
    {}, dialogue="dialogues/hawker.ink", faction="faction_guild",
    base_disposition=0,
    schedule=[
        {"time_range": [6, 20], "location": "loc_copper_row", "scene": "scene_copper_market",
         "slot": "slot_hawker"},
        {"time_range": [20, 24], "location": "loc_copper_row", "scene": "scene_copper_kettle",
         "slot": "slot_guest"},
        {"time_range": [0, 6], "location": "loc_copper_row", "scene": "scene_copper_kettle",
         "slot": "slot_guest"},
    ],
    trader={"sells": [
        {"item": "item_ration", "price": 6, "stock": 6},
        {"item": "item_water", "price": 3, "stock": 6},
        {"item": "item_filter", "price": 12, "stock": 2},
        {"item": "item_cloth", "price": 4, "stock": 3},
        {"item": "item_scrap", "price": 3, "stock": 4},
        {"item": "item_bolt", "price": 2, "stock": 12},
    ], "buys": True, "buy_rate": 0.5},
    inventory=[{"item": "item_mark", "quantity": 80}],
    sounds={"talk": "sfx_talk"},
))

add(npc(
    "npc_ilaria", "Илария Грант",
    "Инженер бригады Спуска. Её лицо закрыто отполированной маской: в ней отражается не комната, а ты.",
    {"STR": 12, "CON": 14, "SIZ": 11, "DEX": 13, "INT": 16, "POW": 15, "CHA": 12},
    {"spot": 60, "search": 55, "persuade": 65, "pressure": 40, "bargain": 30, "stealth": 55,
     "dodge": 60, "brawl": 45, "melee": 55, "crossbow": 40, "repair": 80, "first_aid": 45,
     "lockpick": 35, "tech_lore": 85, "survival": 60, "whisper": 90},
    port("ilaria"), dialogue="dialogues/ilaria.ink", faction="faction_conductors",
    base_disposition=0, figure_mode="side", armor=2,
    abilities=["ability_mirror_gaze"],
    inventory=[{"item": "item_key_shaft", "quantity": 1},
               {"item": "item_heart_copper", "quantity": 1}],
    equipment={"weapon": "item_stiletto", "mask": "item_respirator"},
    loot=[{"item": "item_key_shaft", "chance": 1, "min": 1, "max": 1},
          {"item": "item_heart_copper", "chance": 1, "min": 1, "max": 1}],
    morale={"below_hp_pct": 20, "flee_chance": 0},
    perception=70,
    sounds={"talk": "sfx_talk"},
))

# ---------------------------------------------------------------- твари

add(npc(
    "npc_ash_hound", "Пепельный пёс",
    "Живёт в золе и дышит ею. Шерсть спеклась серыми комьями, в пасти — пепел вместо слюны.",
    {"STR": 11, "CON": 13, "SIZ": 9, "DEX": 14, "INT": 4, "POW": 10, "CHA": 3},
    {"brawl": 55, "dodge": 45, "stealth": 40, "spot": 45, "survival": 50},
    {"neutral": IMG + "fig_hound.png"}, slot_type="animal",
    combat_figure=IMG + "fig_hound.png", armor=1,
    natural_weapon={"skill": "brawl", "damage": "1d6", "damage_bonus": True, "range": 1,
                    "attacks_per_round": 1, "parry_capable": False},
    abilities=["ability_ash_breath"],
    morale={"below_hp_pct": 30, "flee_chance": 45},
    loot=[{"item": "item_scrap", "chance": 0.3, "min": 1, "max": 1}],
    perception=55, sounds={"talk": "sfx_growl"},
))

add(npc(
    "npc_boltnik", "Болтник",
    "Человек, сросшийся с ломом: рука примотана проволокой к железу так давно, что уже непонятно, где чья плоть.",
    {"STR": 14, "CON": 14, "SIZ": 13, "DEX": 10, "INT": 7, "POW": 8, "CHA": 4},
    {"melee": 60, "brawl": 50, "dodge": 35, "spot": 40, "survival": 45},
    {"neutral": IMG + "fig_boltnik.png"}, slot_type="person",
    combat_figure=IMG + "fig_boltnik.png", armor=2,
    equipment={"weapon": "item_rebar"},
    abilities=["ability_wire_whip"],
    morale={"below_hp_pct": 25, "flee_chance": 20},
    loot=[{"item": "item_scrap", "chance": 0.7, "min": 1, "max": 2},
          {"item": "item_cog", "chance": 0.4, "min": 1, "max": 1},
          {"item": "item_mark", "chance": 0.5, "min": 2, "max": 9}],
    perception=45, sounds={"talk": "sfx_growl"},
))

add(npc(
    "npc_automaton", "Сторожевой автомат",
    "Ржавая машина Цехa на трёх ногах. Охраняет то, чего давно нет, и греет пар до красна.",
    {"STR": 16, "CON": 16, "SIZ": 15, "DEX": 7, "INT": 3, "POW": 3, "CHA": 1},
    {"melee": 55, "brawl": 55, "dodge": 15, "spot": 35, "survival": 60},
    {"neutral": IMG + "fig_automaton.png"}, slot_type="prop",
    combat_figure=IMG + "fig_automaton.png", armor=4,
    natural_weapon={"skill": "brawl", "damage": "1d8", "damage_bonus": True, "range": 1,
                    "attacks_per_round": 1, "parry_capable": False},
    abilities=["ability_steam_vent"],
    morale={"below_hp_pct": 0, "flee_chance": 0},
    loot=[{"item": "item_scrap", "chance": 1, "min": 1, "max": 3},
          {"item": "item_cog", "chance": 0.8, "min": 1, "max": 2}],
    perception=35, sounds={"talk": "sfx_gear"},
))

add(npc(
    "npc_scav", "Зольник-грабитель",
    "Обитатель свалки с арматурой в руке. Убеждения у него нет, зато есть аппетит.",
    {"STR": 12, "CON": 12, "SIZ": 12, "DEX": 11, "INT": 9, "POW": 9, "CHA": 8},
    {"melee": 45, "brawl": 45, "dodge": 40, "spot": 40, "stealth": 40, "survival": 45,
     "bargain": 35, "persuade": 30},
    {"neutral": IMG + "fig_scav.png"}, slot_type="person",
    combat_figure=IMG + "fig_scav.png", armor=1,
    equipment={"weapon": "item_rebar"},
    morale={"below_hp_pct": 35, "flee_chance": 55},
    loot=[{"item": "item_mark", "chance": 0.9, "min": 3, "max": 18},
          {"item": "item_scrap", "chance": 0.5, "min": 1, "max": 2},
          {"item": "item_cloth", "chance": 0.4, "min": 1, "max": 1}],
    perception=45, sounds={"talk": "sfx_growl"},
))

add(npc(
    "npc_mirror_thrall", "Зеркальный",
    "Тот, кого Илария собрала из оставшихся. Лицо — полированный лист, и в нём отражается не комната, а ты.",
    {"STR": 14, "CON": 13, "SIZ": 12, "DEX": 12, "INT": 8, "POW": 12, "CHA": 5},
    {"melee": 65, "brawl": 50, "dodge": 50, "spot": 45, "stealth": 50, "survival": 50,
     "whisper": 55},
    {"neutral": IMG + "fig_mirror.png"}, slot_type="person",
    combat_figure=IMG + "fig_mirror.png", armor=2,
    natural_weapon={"skill": "melee", "damage": "1d8", "damage_bonus": True, "range": 1,
                    "attacks_per_round": 1, "parry_capable": True},
    abilities=["ability_mirror_gaze"],
    morale={"below_hp_pct": 0, "flee_chance": 0},
    loot=[{"item": "item_shard_mirror", "chance": 0.5, "min": 1, "max": 1},
          {"item": "item_scrap", "chance": 0.6, "min": 1, "max": 2}],
    perception=55, sounds={"talk": "sfx_growl"},
))


# ---------------------------------------------------------------- предметы

def item(id, label, cat, desc, weight=0.0, stackable=False, value=None, image="",
         on_use=None, weapon_data=None, armor_data=None, equip_slot=None,
         interact_options=None, on_interact=None, interactable_when=None,
         scene_sprite=None, portrait=None, sounds=None, ammo=None):
    e = {"id": id, "type": "item", "category": cat, "label": label, "description": desc,
         "image": image, "weight": weight, "stackable": stackable}
    if value is not None:
        e["value"] = value
    if on_use:
        e["on_use"] = on_use
    if weapon_data:
        e["weapon_data"] = weapon_data
    if armor_data:
        e["armor_data"] = armor_data
    if equip_slot:
        e["equip_slot"] = equip_slot
    if interact_options:
        e["interact_options"] = interact_options
    if on_interact:
        e["on_interact"] = on_interact
    if interactable_when:
        e["interactable_when"] = interactable_when
    if scene_sprite:
        e["scene_sprite"] = scene_sprite
    if portrait is not None:
        e["portrait"] = portrait
    if sounds:
        e["sounds"] = sounds
    return add(e)


def use(effects, consume=False, message=None):
    d = {"effects": effects}
    if consume:
        d["consume"] = True
    if message:
        d["message"] = message
    return d


# --- валюта и расходники
item("item_mark", "Марка", "currency",
     "Железная марка Цехa с клеймом шестерни. На неё покупают паёк, воду и чужую память.",
     weight=0.01, stackable=True, value={"mark": 1}, sounds={"pickup": "sfx_coin"})

item("item_ration", "Сухой паёк", "food",
     "Плитка из овсяной муки, сала и копоти. Держит сытость полдня, если не думать о вкусе.",
     weight=0.4, stackable=True, value={"mark": 6},
     on_use=use([{"type": "change_need", "need": "need_food", "delta": 35}], consume=True))

item("item_water", "Фляга воды", "drink",
     "Жестяная фляга с водой из цистерны. На дне — осадок, но пить можно.",
     weight=0.6, stackable=True, value={"mark": 3},
     on_use=use([{"type": "change_need", "need": "need_water", "delta": 40}], consume=True))

item("item_tea", "Горячий настой", "drink",
     "Кипяток с кипреем и щепотью сажи. Греет руки и голову, но ненадолго.",
     weight=0.4, stackable=True, value={"mark": 4},
     on_use=use([{"type": "change_need", "need": "need_water", "delta": 20},
                 {"type": "change_need", "need": "need_warmth", "delta": 40},
                 {"type": "apply_status", "target": "player", "status": "status_wired",
                  "duration": 6}], consume=True))

item("item_medicine", "Настойка для лёгких", "medicine",
     "Тёмная бутылочка из-под машинного масла. Пахнет хвоей и спиртом, помогает дышать.",
     weight=0.2, stackable=True, value={"mark": 30},
     on_use=use([{"type": "change_hp", "delta": 10},
                 {"type": "remove_status", "target": "player", "status": "status_ash_lung"}],
                consume=True))

item("item_filter", "Сменный фильтр", "tool",
     "Кольцо прессованного угля и войлока. Вставляется в маску и задерживает пепел.",
     weight=0.15, stackable=True, value={"mark": 12},
     on_use=use([{"type": "change_need", "need": "need_breath", "delta": 45},
                 {"type": "remove_status", "target": "player", "status": "status_ash_lung"}],
                consume=True))

item("item_bolt", "Болт", "misc",
     "Короткий стальной болт для пружинного арбалета. Тяжёлый, но летит ровно.",
     weight=0.05, stackable=True, value={"mark": 1})

# --- снаряжение
item("item_wrench", "Лом-ключ", "weapon",
     "Тяжёлый цеховой ключ на длинной рукояти. Им открывают задвижки — и иногда головы.",
     weight=2.4, value={"mark": 25}, equip_slot="weapon",
     weapon_data={"skill": "melee", "damage": "1d8", "damage_bonus": True, "range": 1,
                  "attacks_per_round": 1, "parry_capable": True, "durability": 30},
     sounds={"use": "sfx_metal"})

item("item_rebar", "Арматурный лом", "weapon",
     "Кусок арматуры с загнутым концом. Оружие тех, у кого нет денег на оружие.",
     weight=1.8, value={"mark": 8}, equip_slot="weapon",
     weapon_data={"skill": "melee", "damage": "1d8", "damage_bonus": True, "range": 1,
                  "attacks_per_round": 1, "parry_capable": True, "durability": 20})

item("item_knife_small", "Короткий нож", "weapon",
     "Нож с обмотанной рукоятью. Держит за поясом каждый, кто живёт ниже рынка.",
     weight=0.3, value={"mark": 12}, equip_slot="weapon",
     weapon_data={"skill": "melee", "damage": "1d4+1", "damage_bonus": True, "range": 1,
                  "attacks_per_round": 1, "parry_capable": True, "durability": 15})

item("item_stiletto", "Медный стилет", "weapon",
     "Тонкий стилет с медной рукоятью. Сделан не для боя, а для работы с машиной.",
     weight=0.4, value={"mark": 60}, equip_slot="weapon",
     weapon_data={"skill": "melee", "damage": "1d6+1", "damage_bonus": False, "range": 1,
                  "attacks_per_round": 1, "parry_capable": True, "durability": 20})

item("item_crossbow", "Пружинный арбалет", "weapon",
     "Складной арбалет на витой пружине. Бьёт больно, но после каждого выстрела его надо взводить.",
     weight=2.2, value={"mark": 85}, equip_slot="weapon",
     weapon_data={"skill": "crossbow", "damage": "1d8", "damage_bonus": False, "range": 7,
                  "attacks_per_round": 1, "parry_capable": False, "durability": 25,
                  "ammo_item": "item_bolt"})

item("item_coat", "Ватная куртка", "armor",
     "Стёганая куртка с цеховыми заплатами. Держит тепло лучше, чем выглядит.",
     weight=2.0, value={"mark": 18}, equip_slot="armor", armor_data={"points": 1})

item("item_boots", "Цеховые сапоги", "armor",
     "Сапоги с медной оковкой на носу. По подошве видно, что их владелец много ходил.",
     weight=1.6, value={"mark": 22}, equip_slot="boots", armor_data={"points": 1})

item("item_respirator", "Респиратор", "misc",
     "Медная маска с фильтром: два клапана, ремень на затылке, запах угля. Без неё нижние ярусы не пройти.",
     weight=0.8, value={"mark": 45}, equip_slot="mask",
     interactable_when=None,
     on_use=use([{"type": "change_need", "need": "need_breath", "delta": 20}]))

item("item_lantern", "Масляный фонарь", "tool",
     "Жестяной фонарь с медным отражателем. Светит на два шага вперёд — и туда, куда не хочешь смотреть.",
     weight=1.2, value={"mark": 35})

item("item_badge", "Жетон дознавателя", "misc",
     "Медный жетон Надзора с номером. Открывает двери, которые без него не открываются, и закрывает рты, которые без него говорят.",
     weight=0.05, value={"mark": 0})

# --- материалы
item("item_scrap", "Медный лом", "material",
     "Обрезки меди и железа. Из него вытачивают болты и латают маски.",
     weight=0.5, stackable=True, value={"mark": 3})
item("item_cloth", "Тряпьё", "material",
     "Кусок грубого полотна. На фильтр сойдёт, на одежду — едва.",
     weight=0.2, stackable=True, value={"mark": 4})
item("item_cog", "Шестерня Предтеч", "material",
     "Небольшая шестерня из сплава, который не ржавеет. Зубцы сточены не так, как делают в Цехe.",
     weight=0.3, stackable=True, value={"mark": 25})
item("item_glass_blank", "Заготовка линзы", "material",
     "Мутный стеклянный кружок. Эрдал Вет оставил её недоточенной.",
     weight=0.1, value={"mark": 15})

# --- улики
item("item_shavings", "Медная стружка", "evidence",
     "Горсть стружки из-под груди убитого. Резали не ножом: резали тем, чем режут металл.",
     weight=0.02, value={"mark": 0})
item("item_token_crew", "Жетон бригады", "evidence",
     "Медный кружок с номером 7 и выцарапанным словом «СПУСК». Такие выдавали только тем, кто шёл вниз.",
     weight=0.02, value={"mark": 0})
item("item_shard_mirror", "Зеркальный скол", "evidence",
     "Треугольный скол отполированного до зеркала металла. С одной стороны — нагар, с другой — чьё-то отражение.",
     weight=0.02, value={"mark": 0})
item("item_ledger", "Журнал Вета", "evidence",
     "Тонкая тетрадь в масляных пятнах. Список имён, даты, пометки «был» и «не вышел».",
     weight=0.3, value={"mark": 0})
item("item_lens", "Огранная линза", "misc",
     "Линза, которую Эрдал не успел доделать. Через неё видно то, что обычно не попадает в фокус.",
     weight=0.1, value={"mark": 40})
item("item_key_shaft", "Ключ шлюза", "tool",
     "Длинный ключ с тремя бородками и клеймом Цехa. От шлюза, который официально заварен двенадцать лет назад.",
     weight=0.6, value={"mark": 40})
item("item_heart_copper", "Медное сердце", "misc",
     "Регулятор дыхания размером с кулак. Тёплый. Его ещё недавно кто-то носил в груди.",
     weight=0.5, value={"mark": 120})

# --- реквизит сцен
item("item_board", "Оперативная доска", "misc",
     "Доска с приколотыми листами: дела, сроки, подписи. Сверху — свежий приказ по Надзору.",
     weight=20, interact_options=[{
         "label": "Прочитать доску", "once": True, "sound": "use",
         "effects": [{"type": "show_message",
                      "text": "Сверху приказ: «Дело о находке в Нижних трубах — дознавателю, срок четырнадцать суток». "
                              "Ниже — список пропавших сердец: три строки, все из нижних ярусов."},
                     {"type": "unlock_codex", "entry": "codex_watch"}],
         "message": "Ты пробежал доску глазами."}])

item("item_archive", "Картотека", "container",
     "Дубовые ящики с карточками. Пахнет пылью и клеем; порядок здесь держат лучше, чем в городе.",
     weight=60, interact_options=[
         {"label": "Поднять карточки Спуска", "hint": "Обыск, порог 55", "sound": "open",
          "conditions": [{"type": "flag_not_set", "flag": "crew_list_found"}],
          "effects": [{"type": "skill_check_gate", "skill": "search", "difficulty": 55,
                       "success_effects": [
                           {"type": "add_item", "item": "item_ledger", "quantity": 1},
                           {"type": "set_flag", "flag": "crew_list_found"},
                           {"type": "journal_update", "quest": "quest_main",
                            "text_key": "j_crew"},
                           {"type": "unlock_codex", "entry": "codex_descent"},
                           {"type": "show_message",
                            "text": "Карточка Спуска нашлась под чужой буквой: семь имён, три пометки «не вышел»."}],
                       "fail_effects": [{"type": "show_message",
                                         "text": "Ящики стоят не по алфавиту, а по чьей-то памяти. С первого раза не вышло."}]}],
          "message": "Ты выдвинул ящик."},
         {"label": "Просмотреть личные дела", "once": True,
          "effects": [{"type": "show_message",
                       "text": "Эрдал Вет, монтажник, сорок один год, медное сердце серии М-9. "
                               "Грист, Вольт, Карна — все числятся по Цехy. Илария Грант помечена как «убыла»."},
                      {"type": "unlock_codex", "entry": "codex_hearts"}]}])

item("item_body", "Тело Эрдала Вета", "misc",
     "На смотровом столе — мужчина лет сорока. Грудь вскрыта ровным разрезом, рёбра разведены: медного сердца нет.",
     weight=70, interact_options=[
         {"label": "Осмотреть грудь", "once": True, "hint": "Наблюдение",
          "effects": [{"type": "skill_check_gate", "skill": "spot", "difficulty": 45,
                       "success_effects": [
                           {"type": "add_item", "item": "item_shavings", "quantity": 1},
                           {"type": "set_flag", "flag": "clue_shavings"},
                           {"type": "set_flag", "flag": "body_examined"},
                           {"type": "show_message",
                            "text": "Резали не ножом: края рёбер опилены, в глубине — медная стружка. "
                                    "Тот, кто это делал, работал спокойно и знал, где резать."}],
                       "fail_effects": [{"type": "set_flag", "flag": "body_examined"},
                                        {"type": "show_message",
                                         "text": "Разрез ровный, но стружку ты замечаешь только на ощупь: "
                                                 "мелкая, медная, в складках одежды."},
                                        {"type": "add_item", "item": "item_shavings", "quantity": 1},
                                        {"type": "set_flag", "flag": "clue_shavings"}]}],
          "message": "Ты склонился над столом."},
         {"label": "Обыскать одежду", "once": True, "hint": "Обыск, порог 45", "sound": "use",
          "effects": [{"type": "skill_check_gate", "skill": "search", "difficulty": 45,
                       "success_effects": [{"type": "add_item", "item": "item_mark", "quantity": 12},
                                           {"type": "add_item", "item": "item_glass_blank", "quantity": 1},
                                           {"type": "show_message",
                                            "text": "В подкладке — двенадцать марок и мутный стеклянный кружок: "
                                                    "заготовка линзы, которую он нёс жене."}],
                       "fail_effects": [{"type": "show_message",
                                         "text": "Карманы вывернуты: кто-то уже был здесь раньше тебя."}]}]},
         {"label": "Осмотреть руки", "once": True,
          "effects": [{"type": "show_message",
                       "text": "Ладонь правая в медной пыли, на запястье — две царапины, словно его держали. "
                               "Он не кричал: ногти целые."},
                      {"type": "change_sanity", "delta": -2}]}])

item("item_notice", "Доска Цехa", "misc",
     "Свежие приказы Цехa под стеклом: талоны на воду, штрафы за самовольный спуск, расценки на лом.",
     weight=25, interact_options=[{
         "label": "Прочитать приказы", "once": True,
         "effects": [{"type": "show_message",
                      "text": "«Спуск в шахты ниже четвёртого шлюза воспрещён. Виновные лишаются талонов». "
                              "Ниже — расценки: медный лом принимают по три марки, сердца не принимают вовсе."},
                     {"type": "unlock_codex", "entry": "codex_guild"}]}])

item("item_bench", "Верстак", "misc",
     "Тяжёлый верстак с тисками, абразивным кругом и рядом надфилей. Всё лежит на своих местах — так кладут только мастера.",
     weight=90, interact_options=[
         {"label": "Обточить линзу", "hint": "Открыть изготовление с этим рецептом",
          "conditions": [{"type": "has_item", "item": "item_glass_blank"}],
          "effects": [{"type": "open_craft", "recipe": "recipe_lens"}],
          "message": "Тиски приняли заготовку."},
         {"label": "Осмотреть инструменты", "once": True,
          "effects": [{"type": "show_message",
                       "text": "Надфили, абразив, медная проволока. На круге — свежая пыль: кто-то работал сегодня."}]},
         {"label": "Обыскать ящик верстака", "once": True, "hint": "Обыск, порог 50",
          "effects": [{"type": "skill_check_gate", "skill": "search", "difficulty": 50,
                       "success_effects": [{"type": "add_item", "item": "item_ledger", "quantity": 1},
                                           {"type": "set_flag", "flag": "crew_list_found"},
                                           {"type": "journal_update", "quest": "quest_main",
                                            "text_key": "j_crew"},
                                           {"type": "unlock_codex", "entry": "codex_descent"},
                                           {"type": "show_message",
                                            "text": "Под стружкой — тетрадь Вета. Семь имён, три пометки «не вышел»."}],
                       "fail_effects": [{"type": "show_message",
                                         "text": "Ящик заклинило. Карна смотрит в спину, и ты убираешь руки."},
                                        {"type": "change_disposition", "target": "npc_karna",
                                         "delta": -10}]}]}])

item("item_stove", "Печь «Котла»", "misc",
     "Кирпичная печь с чугунной плитой. У неё греются руки, спины и чужие разговоры.",
     weight=200, interact_options=[
         {"label": "Погреться у печи", "hint": "Тепло +35, час времени",
          "effects": [{"type": "change_need", "need": "need_warmth", "delta": 35},
                      {"type": "advance_time", "ticks": 1}],
          "message": "Тепло заползло под куртку."},
         {"label": "Взять кипятку (2 марки)", "hint": "Нужны марки",
          "conditions": [{"type": "has_item", "item": "item_mark", "min_quantity": 2}],
          "effects": [{"type": "remove_item", "item": "item_mark", "quantity": 2},
                      {"type": "add_item", "item": "item_tea", "quantity": 1},
                      {"type": "advance_time", "ticks": 1}],
          "message": "Хозяин налил кипятку, не поднимая глаз."}])

item("item_crack", "Ниша в стене", "misc",
     "В кладке трубы — старая ниша, забранная ржавой сеткой. Внутри темно и, кажется, не пусто.",
     weight=0, interact_options=[
         {"label": "Запустить руку в нишу", "hint": "Обыск, порог 50", "sound": "open",
          "conditions": [{"type": "flag_not_set", "flag": "clue_token"}],
          "effects": [{"type": "skill_check_gate", "skill": "search", "difficulty": 50,
                       "success_effects": [{"type": "add_item", "item": "item_token_crew", "quantity": 1},
                                           {"type": "set_flag", "flag": "clue_token"},
                                           {"type": "journal_update", "quest": "quest_main",
                                            "text_key": "j_token"},
                                           {"type": "show_message",
                                            "text": "Пальцы нащупали холодный кружок: жетон бригады, номер семь, "
                                                    "царапина «СПУСК»."}],
                       "fail_effects": [{"type": "show_message",
                                         "text": "Сетка режет ладонь, а внутри только мусор и мокрая пыль."},
                                        {"type": "change_hp", "delta": -1}]}]},
         {"label": "Отогнуть сетку", "hint": "Нужен инструмент",
          "conditions": [{"type": "flag_not_set", "flag": "clue_token"},
                         {"type": "has_item", "item": "item_wrench"}],
          "effects": [{"type": "add_item", "item": "item_token_crew", "quantity": 1},
                      {"type": "set_flag", "flag": "clue_token"},
                      {"type": "journal_update", "quest": "quest_main", "text_key": "j_token"},
                      {"type": "advance_time", "ticks": 1}],
          "message": "Лом-ключ согнул сетку за два движения."}])

item("item_grate", "Решётка стока", "misc",
     "Чугунная решётка над стоком. Между прутьями набилось всё, что смывает город.",
     weight=40, interact_options=[
         {"label": "Осмотреть решётку", "hint": "Наблюдение, порог 55",
          "conditions": [{"type": "flag_not_set", "flag": "clue_shard"}],
          "effects": [{"type": "skill_check_gate", "skill": "spot", "difficulty": 55,
                       "success_effects": [{"type": "add_item", "item": "item_shard_mirror", "quantity": 1},
                                           {"type": "set_flag", "flag": "clue_shard"},
                                           {"type": "journal_update", "quest": "quest_main",
                                            "text_key": "j_shard"},
                                           {"type": "unlock_codex", "entry": "codex_mirror"},
                                           {"type": "show_message",
                                            "text": "Между прутьями застрял треугольный скол. Одна сторона — "
                                                    "полированная до зеркала, другая в нагаре."}],
                       "fail_effects": [{"type": "show_message",
                                         "text": "Тёмная вода под решёткой, мусор, тряпка. На первый взгляд — ничего."}]}]},
         {"label": "Поднять решётку", "hint": "Сложение, порог ×5",
          "effects": [{"type": "stat_check", "stat": "STR", "multiplier": 5,
                       "success_effects": [{"type": "add_item", "item": "item_mark", "quantity": 4},
                                           {"type": "add_item", "item": "item_scrap", "quantity": 1},
                                           {"type": "show_message",
                                            "text": "Под решёткой — горсть марок и обрезок меди. Кто-то прятал это наспех."},
                                           {"type": "advance_time", "ticks": 1}],
                       "fail_effects": [{"type": "show_message",
                                         "text": "Решётка примерзла к раме. Сдвинулась на палец и встала."}]}]}])

item("item_puddle", "Лужа у стока", "misc",
     "Мелкая лужа с радужной плёнкой. В ней отражается то, что находится выше уровня глаз.",
     weight=0, interact_options=[{
         "label": "Присмотреться к отражению", "once": True,
         "effects": [{"type": "show_message",
                      "text": "В чёрной воде дрожит свод трубы — и на мгновение кажется, что по нему идёт кто-то "
                              "ещё. Ты моргаешь: свод пуст, только вода шевелится."},
                     {"type": "change_sanity", "delta": -1},
                     {"type": "unlock_codex", "entry": "codex_whisper"}]}])

item("item_moth_chest", "Ящик Щепки", "container",
     "Фанерный ящик с замочком-верёвочкой. Всё имущество подростка из Нижних труб.",
     weight=8, interact_options=[
         {"label": "Заглянуть в ящик", "once": True, "sound": "open",
          "effects": [{"type": "add_item", "item": "item_cloth", "quantity": 1},
                      {"type": "show_message",
                       "text": "Тряпьё, обрывок верёвки, краденая ложка. И аккуратно свёрнутая тряпица, "
                               "которую берегут больше ложки."}]},
         {"label": "Положить в ящик настойку", "once": True,
          "conditions": [{"type": "has_item", "item": "item_medicine"}],
          "effects": [{"type": "remove_item", "item": "item_medicine", "quantity": 1},
                      {"type": "set_flag", "flag": "medicine_given"},
                      {"type": "change_disposition", "target": "npc_moth", "delta": 25},
                      {"type": "show_message", "text": "Бутылочка легла рядом с ложкой."}],
          "message": "Ты поставил настойку так, чтобы её нашли сразу."}])

item("item_whisper_pipe", "Говорящая труба", "misc",
     "Старая медная труба, уходящая в кладку. Снизу, из глубины, в ней шевелится звук, похожий на дыхание.",
     weight=60, interact_options=[
         {"label": "Приложить ухо", "once": True, "sound": "open",
          "effects": [{"type": "show_message",
                       "text": "В трубе не ветер. В трубе — ровный счёт, как будто кто-то на ощупь перебирает "
                               "имена и на каждом третьем спотыкается."},
                      {"type": "change_sanity", "delta": -3},
                      {"type": "unlock_codex", "entry": "codex_whisper"}]},
         {"label": "Прошептать имя убитого", "hint": "Воля, порог ×4", "once": True,
          "conditions": [{"type": "flag_set", "flag": "era_met"}],
          "effects": [{"type": "stat_check", "stat": "POW", "multiplier": 4,
                       "success_effects": [{"type": "set_flag", "flag": "era_token_given"},
                                           {"type": "unlock_codex", "entry": "codex_descent"},
                                           {"type": "show_message",
                                            "text": "Труба ответила не эхом, а паузой: имя Эрдала Вета она "
                                                    "произнесла раньше тебя — и ждала следующего."},
                                           {"type": "change_sanity", "delta": -2}],
                       "fail_effects": [{"type": "show_message",
                                         "text": "Ты шепчешь, а труба молчит. Или ты просто не слышишь ответ."},
                                        {"type": "change_sanity", "delta": -1}]}]}])

item("item_furnace", "Плавильная печь", "misc",
     "Жерло печи дышит жаром так ровно, будто это единственное живое существо в Каркасе, которому не больно.",
     weight=500, interact_options=[
         {"label": "Погреться у жерла", "hint": "Тепло +45, час времени",
          "effects": [{"type": "change_need", "need": "need_warmth", "delta": 45},
                      {"type": "advance_time", "ticks": 1}],
          "message": "Жар обжёг щёки и забрался под одежду."},
         {"label": "Осмотреть золу", "hint": "Наблюдение; после находки — важнее",
          "conditions": [{"type": "flag_set", "flag": "grist_dead"}],
          "effects": [{"type": "skill_check_gate", "skill": "spot", "difficulty": 50,
                       "success_effects": [{"type": "unlock_codex", "entry": "codex_mirror"},
                                           {"type": "show_message",
                                            "text": "В золе — след подошвы, слишком узкий для Гриста, и борозда "
                                                    "от чего-то волочимого к шлюзу цистерны."},
                                           {"type": "set_flag", "flag": "watch_warned"}],
                       "fail_effects": [{"type": "show_message",
                                         "text": "Зола перемолота лопатами: ничего целого."}]}]}])

item("item_guild_cabinet", "Шкаф с бумагами", "container",
     "Высокий шкаф с тремя полками и злым замком. В Цехe бумагу берегут надёжнее, чем людей.",
     weight=70, interact_options=[
         {"label": "Обыскать шкаф", "hint": "Взлом, порог 50; это зарегистрируют", "sound": "open",
          "conditions": [{"type": "flag_not_set", "flag": "vergo_searched"}],
          "effects": [{"type": "skill_check_gate", "skill": "lockpick", "difficulty": 50,
                       "success_effects": [
                           {"type": "add_item", "item": "item_ledger", "quantity": 1},
                           {"type": "add_item", "item": "item_key_shaft", "quantity": 1},
                           {"type": "set_flag", "flag": "vergo_searched"},
                           {"type": "set_flag", "flag": "crew_list_found"},
                           {"type": "set_flag", "flag": "shaft_key"},
                           {"type": "commit_crime", "id": "crime_search", "bounty": 15},
                           {"type": "journal_update", "quest": "quest_main", "text_key": "j_crew"},
                           {"type": "unlock_codex", "entry": "codex_descent"},
                           {"type": "show_message",
                            "text": "В нижнем ящике — журнал Вета и длинный ключ с клеймом Цехa. "
                                    "Тот самый, от шлюза, который якобы заварен."}],
                       "fail_effects": [{"type": "show_message",
                                         "text": "Замок щёлкнул и не поддался; из коридора послышались шаги."},
                                        {"type": "change_disposition", "target": "npc_vergo", "delta": -20},
                                        {"type": "change_disposition", "target": "faction_guild",
                                         "delta": -5}]}]},
         {"label": "Прочитать накладные", "once": True,
          "effects": [{"type": "show_message",
                       "text": "Медь идёт на лотки, вода — по талонам, сердца — никуда. Последняя строка "
                               "зачёркнута: «И. Грант, убыла»."},
                      {"type": "unlock_codex", "entry": "codex_guild"}]}])

item("item_ash_pile", "Куча золы", "misc",
     "Насыпь серой золы, ещё тёплая снизу. В ней находят всё, что город потерял за неделю.",
     weight=0, interact_options=[{
         "label": "Покопаться в золе", "hint": "Обыск, порог 40; пылит",
         "effects": [{"type": "skill_check_gate", "skill": "search", "difficulty": 40,
                      "success_effects": [{"type": "add_item", "item": "item_scrap", "quantity": 2},
                                          {"type": "add_item", "item": "item_mark", "quantity": 3},
                                          {"type": "show_message",
                                           "text": "Под коркой золы — обрезки меди и три марки, "
                                                   "прилипшие к железяке."},
                                          {"type": "change_need", "need": "need_breath", "delta": -12}],
                      "fail_effects": [{"type": "show_message",
                                        "text": "Зола поднялась облаком: ты только наглотался пепла."},
                                       {"type": "change_need", "need": "need_breath", "delta": -15}]}],
         "message": "Ты запустил руки в золу."}])

item("item_wreck", "Остов вагона", "container",
     "Перевёрнутый остов вагонетки с выбитым дном. Внутри сухо, темно и пахнет старой тряпкой.",
     weight=300, interact_options=[{
         "label": "Обыскать остов", "once": True, "hint": "Обыск, порог 45", "sound": "open",
         "effects": [{"type": "skill_check_gate", "skill": "search", "difficulty": 45,
                      "success_effects": [{"type": "add_item", "item": "item_cloth", "quantity": 1},
                                          {"type": "add_item", "item": "item_scrap", "quantity": 2},
                                          {"type": "add_item", "item": "item_bolt", "quantity": 4},
                                          {"type": "show_message",
                                           "text": "Под сиденьем — свёрток: тряпьё, медный лом и горсть болтов "
                                                   "к арбалету."}],
                      "fail_effects": [{"type": "show_message",
                                        "text": "Только крысиный помёт и ржавая пружина."}]}],
         "message": "Ты забрался под остов."}])

item("item_volt_crate", "Ящик с товаром", "container",
     "Ящик с медной оковкой и висячим замком. Пахнет машинным маслом и чем-то сладковатым.",
     weight=40, interact_options=[{
         "label": "Заглянуть в ящик", "hint": "Скрытность, порог 50: Вольт не должен заметить",
         "sound": "open", "once": True,
         "effects": [{"type": "skill_check_gate", "skill": "stealth", "difficulty": 50,
                      "success_effects": [{"type": "set_flag", "flag": "volt_deal"},
                                          {"type": "unlock_codex", "entry": "codex_hearts"},
                                          {"type": "show_message",
                                           "text": "В ящике, в стружке, лежат три медных сердца. Два — с номерами, "
                                                   "одно — без: его ещё не успели вытравить."},
                                          {"type": "change_sanity", "delta": -2}],
                      "fail_effects": [{"type": "show_message",
                                        "text": "- Руки прочь, - говорит Вольт у тебя за спиной. Он улыбается, "
                                                "но глаза уже считают убыток."},
                                       {"type": "change_disposition", "target": "npc_volt", "delta": -20}]}],
         "message": "Крышка подалась на ладонь."}])

item("item_cistern_water", "Вода цистерны", "misc",
     "Медленная тёмная вода под сводом галереи. Чище, чем всё, что течёт в трубах.",
     weight=0, interact_options=[
         {"label": "Набрать воды", "hint": "Пополнить флягу", "sound": "use",
          "effects": [{"type": "add_item", "item": "item_water", "quantity": 1},
                      {"type": "advance_time", "ticks": 1}],
          "message": "Фляга наполнилась с тихим бульканьем."},
         {"label": "Умыться", "once": True,
          "effects": [{"type": "change_need", "need": "need_warmth", "delta": -5},
                      {"type": "change_fatigue", "delta": -5},
                      {"type": "show_message",
                       "text": "Вода ледяная. Зато лицо снова можно показать людям."}]}])

item("item_hatch", "Затвор галереи", "misc",
     "Круглый затвор в торце галереи с клеймом Цехa и маховиком. За ним, по слухам, заваренный спуск.",
     weight=300, interact_options=[
         {"label": "Осмотреть затвор", "once": True, "sound": "use",
          "effects": [{"type": "show_message",
                       "text": "Клеймо Цехa, номер шлюза, табличка «Проход закрыт». Маховик не заварен: "
                               "его просто давно не поворачивали."},
                      {"type": "unlock_codex", "entry": "codex_shaft"}]},
         {"label": "Сорвать маховик", "hint": "Сложение, порог ×5",
          "conditions": [{"type": "flag_set", "flag": "shaft_revealed"},
                         {"type": "flag_not_set", "flag": "shaft_open"}],
          "effects": [{"type": "stat_check", "stat": "STR", "multiplier": 5,
                       "success_effects": [
                           {"type": "set_flag", "flag": "shaft_open"},
                           {"type": "journal_update", "quest": "quest_main", "text_key": "j_shaft_open"},
                           {"type": "change_fatigue", "delta": 8},
                           {"type": "advance_time", "ticks": 1},
                           {"type": "teleport_player", "location": "loc_shaft",
                            "scene": "scene_shaft_descent"}],
                       "fail_effects": [{"type": "show_message",
                                         "text": "Маховик провернулся на четверть и заклинил: без ключа или "
                                                 "без лома здесь делать нечего."},
                                        {"type": "change_fatigue", "delta": 4}]}]}])

item("item_shaft_gate", "Шлюз шахты", "misc",
     "Круглая дверь в торец шахты: три задвижки, клеймо Цехa и гнездо ключа, которое кто-то смазывал недавно.",
     weight=500, interact_options=[
         {"label": "Осмотреть шлюз", "once": True, "sound": "use",
          "effects": [{"type": "show_message",
                       "text": "Задвижки не заржавели: их открывали в этом месяце. Кто-то ходит вниз регулярно "
                               "и не хочет, чтобы дверь скрипела."},
                      {"type": "unlock_codex", "entry": "codex_shaft"}]},
         {"label": "Взломать задвижку", "hint": "Взлом, порог 45",
          "conditions": [{"type": "flag_not_set", "flag": "shaft_open"}],
          "effects": [{"type": "skill_check_gate", "skill": "lockpick", "difficulty": 45,
                       "success_effects": [
                           {"type": "set_flag", "flag": "shaft_open"},
                           {"type": "set_description", "entity": "item_shaft_gate",
                            "text": "Шлюз открыт. Внутри — лестница в жар."},
                           {"type": "journal_update", "quest": "quest_main", "text_key": "j_shaft_open"},
                           {"type": "advance_time", "ticks": 1},
                           {"type": "teleport_player", "location": "loc_shaft",
                            "scene": "scene_shaft_descent"}],
                       "fail_effects": [{"type": "show_message",
                                         "text": "Отвёртка сорвалась; костяшки пальцев горят, задвижка стоит."},
                                        {"type": "change_hp", "delta": -2}]}]}])

item("item_valves", "Вентильный узел", "misc",
     "Три маховика на общем коллекторе: пар, вода, возврат. Стрелки на шкалах дрожат несинхронно.",
     weight=120, interact_options=[
         {"label": "Осмотреть шкалы", "once": True, "sound": "use",
          "effects": [{"type": "show_message",
                       "text": "Две шкалы стоят на нуле, третья ползёт. Кто-то выставил их так, чтобы жар "
                               "уходил вниз, а не в город."},
                      {"type": "unlock_codex", "entry": "codex_veins"}]},
         {"label": "Выставить вентили", "hint": "Ремонт, порог 50; ошибка — паром",
          "conditions": [{"type": "flag_not_set", "flag": "valves_fixed"}],
          "effects": [{"type": "skill_check_gate", "skill": "repair", "difficulty": 50,
                       "success_effects": [
                           {"type": "set_flag", "flag": "valves_fixed"},
                           {"type": "journal_update", "quest": "quest_main", "text_key": "j_valves"},
                           {"type": "unlock_codex", "entry": "codex_veins"},
                           {"type": "grant_xp", "points": 40},
                           {"type": "show_message",
                            "text": "Коллектор выровнялся: пар пошёл по кругу, а не в лицо. Где-то внизу "
                                    "открылась тяга — путь к Сердцу свободен."}],
                       "fail_effects": [{"type": "apply_status", "target": "player",
                                         "status": "status_steam_burn", "duration": 3},
                                        {"type": "change_hp", "delta": -3},
                                        {"type": "show_message",
                                         "text": "Маховик сорвался, и струя пара ударила в плечо."}]}]}])

item("item_scav_corpse", "Тело зольника", "misc",
     "Мужчина в ватной куртке, лицом в пыль. Не вскрыт: просто шёл слишком близко к тому, что ходит по жилам.",
     weight=70, interact_options=[{
         "label": "Обыскать тело", "once": True, "sound": "use",
         "effects": [{"type": "add_item", "item": "item_scrap", "quantity": 1},
                     {"type": "add_item", "item": "item_mark", "quantity": 9},
                     {"type": "add_item", "item": "item_cloth", "quantity": 1},
                     {"type": "unlock_codex", "entry": "codex_boltnik"},
                     {"type": "show_message",
                      "text": "Девять марок, медный лом, тряпьё. На ладони — глубокая царапина: он "
                              "царапал что-то гладкое и холодное."},
                     {"type": "change_sanity", "delta": -1}],
         "message": "Ты перевернул тело."}])

item("item_heart_chest", "Медный ящик", "container",
     "Небольшой медный ящик с семью гнёздами. В четырёх — сердца. Они ещё тёплые.",
     weight=12, interact_options=[
         {"label": "Осмотреть ящик", "once": True, "sound": "open",
          "effects": [{"type": "unlock_codex", "entry": "codex_hearts"},
                      {"type": "show_message",
                       "text": "Семь гнёзд, четыре сердца. Три пустых ждут: у всех номеров серии М-9 "
                               "стоит одна и та же пометка «СПУСК»."},
                      {"type": "change_sanity", "delta": -3}]},
         {"label": "Взять одно сердце", "once": True,
          "effects": [{"type": "add_item", "item": "item_heart_copper", "quantity": 1},
                      {"type": "show_message",
                       "text": "Сердце весит больше, чем должно. Оно ещё пытается держать чужой ритм."}]}])

item("item_heart_core", "Кожух Сердца", "misc",
     "Полированный кожух машины Предтеч. Под ним — не механизм: под ним что-то, что считает и ждёт.",
     weight=0, interact_options=[
         {"label": "Повернуть вентиль на глушение", "hint": "Остановить Сердце",
          "conditions": [{"type": "flag_set", "flag": "ilaria_met"},
                         {"type": "flag_not_set", "flag": "sealed"}],
          "effects": [{"type": "set_flag", "flag": "sealed"},
                      {"type": "change_hp", "delta": -4},
                      {"type": "play_cutscene", "cutscene": "cutscene_seal"},
                      {"type": "game_over_victory"}],
          "message": "Последний вентиль пошёл тяжело, как всё, что делается в одиночку."},
         {"label": "Подключить своё сердце к жиле", "hint": "Запустить Сердце",
          "conditions": [{"type": "flag_set", "flag": "ilaria_met"},
                         {"type": "flag_not_set", "flag": "joined_ilaria"},
                         {"type": "flag_not_set", "flag": "sealed"}],
          "effects": [{"type": "set_flag", "flag": "joined_ilaria"},
                      {"type": "change_hp", "delta": -8},
                      {"type": "play_cutscene", "cutscene": "cutscene_current"},
                      {"type": "game_over_victory"}],
          "message": "Ток пошёл через грудь, и на мгновение стало непонятно, чьё сердце бьётся."},
         {"label": "Уйти и закрыть дело", "hint": "Вернуться наверх с рапортом",
          "effects": [{"type": "set_flag", "flag": "case_closed"},
                      {"type": "play_cutscene", "cutscene": "cutscene_surface"},
                      {"type": "game_over_victory"}],
          "message": "Ты развернулся к лестнице."}])


def entities():
    return {e["id"]: e for e in ENTITIES}
