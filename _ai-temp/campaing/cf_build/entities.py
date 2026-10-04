# -*- coding: utf-8 -*-
"""НПС и предметы кампании «Ржавая литургия»."""

P = {"neutral": ""}

ENTITIES = {}

def npc(id, label, desc, stats, skills, **kw):
    e = {"id": id, "type": "npc", "label": label, "description": desc,
         "portrait": dict(P), "stats": stats, "skills": skills}
    e.update(kw)
    ENTITIES[id] = e
    return e

S = lambda STR,CON,SIZ,DEX,INT,POW,CHA: {"STR":STR,"CON":CON,"SIZ":SIZ,"DEX":DEX,"INT":INT,"POW":POW,"CHA":CHA}

npc("player_hero", "Следователь", "Следователь Пепельной конторы. Имя впишут в протокол позже.",
    S(10, 11, 10, 10, 12, 10, 10),
    {"spot": 35, "persuade": 30, "dodge": 25, "shoot": 25},
    inventory=[{"item": "item_silver", "quantity": 15}, {"item": "item_badge", "quantity": 1}],
    equipment={"weapon": "item_revolver", "armor": "item_coat"})

npc("npc_clerk", "Клерк Бюро", "Ведёт реестр исчезновений и считает, что порядок спасает от холода.",
    S(8, 9, 9, 9, 13, 10, 11), {"persuade": 40, "spot": 45},
    dialogue="dialogues/clerk.ink", slot_type="person",
    schedule=[{"time_range": [6, 22], "location": "loc_verkh", "scene": "scene_office", "slot": "slot_clerk"}],
    faction="faction_kontora", base_disposition=10)

npc("npc_varga", "Мастер Варга Рец", "Старший инженер Очага. Говорит тихо, как человек, который уже всё решил.",
    S(10, 12, 11, 11, 15, 14, 12), {"persuade": 55, "mechanics": 70, "brawl": 35},
    dialogue="dialogues/varga.ink", slot_type="person",
    schedule=[{"time_range": [8, 20], "location": "loc_zavod", "scene": "scene_foundry", "slot": "slot_varga"}],
    presence_overrides=[{"flag": "varga_hostile", "location": "loc_nizy", "scene": "scene_heart", "slot": "slot_varga_final"}],
    faction="faction_guild", base_disposition=0,
    portrait={"neutral": "", "angry": "", "calm": ""})

npc("npc_drogan", "Фореман Дроган", "Начальник смены. Потный, виноватый, но не в том, в чём кажется.",
    S(12, 11, 12, 9, 9, 9, 9), {"persuade": 30, "brawl": 40},
    dialogue="dialogues/drogan.ink", slot_type="person",
    schedule=[{"time_range": [8, 18], "location": "loc_zavod", "scene": "scene_foundry", "slot": "slot_drogan_f"},
              {"time_range": [18, 24], "location": "loc_zavod", "scene": "scene_tavern", "slot": "slot_drogan"}],
    faction="faction_guild", base_disposition=0,
    portrait={"neutral": "", "afraid": ""})

npc("npc_iletta", "Сестра Илетта", "Целительница приюта. Молится странным словам и прячет глаза.",
    S(8, 9, 9, 10, 12, 13, 12), {"persuade": 45, "first_aid": 55},
    dialogue="dialogues/iletta.ink", slot_type="person",
    schedule=[{"time_range": [8, 20], "location": "loc_verkh", "scene": "scene_hospice", "slot": "slot_iletta"}],
    base_disposition=0,
    portrait={"neutral": "", "afraid": "", "angry": ""})

npc("npc_greta", "Грета, хозяйка", "Хозяйка «Гайки и фитиля». Знает цену всему, включая молчание.",
    S(9, 10, 10, 10, 11, 10, 13), {"persuade": 50, "spot": 40},
    dialogue="dialogues/greta.ink", slot_type="person",
    schedule=[{"time_range": [8, 24], "location": "loc_zavod", "scene": "scene_tavern", "slot": "slot_greta"}],
    base_disposition=5,
    trader={"sells": [{"item": "item_bread", "price": 2}, {"item": "item_stew", "price": 6},
                      {"item": "item_herb", "price": 3}, {"item": "item_cloth", "price": 2},
                      {"item": "item_coal", "price": 4}], "buys": True, "buy_rate": 0.5})

npc("npc_stoker", "Кочегар Прохор", "Тридцать лет у топки. Верит носу больше, чем глазам.",
    S(13, 12, 12, 9, 10, 9, 9), {"mechanics": 50, "spot": 35},
    dialogue="dialogues/stoker.ink", slot_type="person",
    schedule=[{"time_range": [6, 20], "location": "loc_zavod", "scene": "scene_foundry", "slot": "slot_stoker_f"},
              {"time_range": [20, 24], "location": "loc_zavod", "scene": "scene_tavern", "slot": "slot_stoker"}],
    faction="faction_guild", base_disposition=5)

npc("npc_luka", "Инженер Лука", "Единственный выживший. Руки дрожат, глаза помнят.",
    S(9, 8, 10, 9, 12, 10, 9), {"mechanics": 55},
    dialogue="dialogues/luka.ink", slot_type="person",
    schedule=[], base_disposition=10,
    portrait={"neutral": "", "calm": "", "afraid": ""})

npc("npc_beggar", "Нищенка Ашта", "Сидит у памятника и видит больше, чем стража.",
    S(7, 8, 8, 10, 11, 9, 10), {"spot": 60, "stealth": 40},
    dialogue="dialogues/beggar.ink", slot_type="person",
    schedule=[{"time_range": [8, 22], "location": "loc_verkh", "scene": "scene_square", "slot": "slot_beggar"}],
    base_disposition=-5,
    portrait={"neutral": "", "happy": ""})

npc("npc_guard", "Стражник Бран", "Стоит у памятника и стережёт решётку в Низы. Служба — закон.",
    S(12, 12, 12, 10, 9, 9, 9), {"brawl": 45, "shoot": 40},
    dialogue="dialogues/guard.ink", slot_type="person",
    schedule=[{"time_range": [0, 24], "location": "loc_verkh", "scene": "scene_square", "slot": "slot_guard"}],
    faction="faction_kontora", base_disposition=0)

npc("npc_oracle", "Сердце Очага", "Полуживой механизм. Говорит гулом и знает, кто поёт обратную песнь.",
    S(20, 20, 20, 5, 16, 18, 8), {"mechanics": 0},
    dialogue="dialogues/oracle.ink", slot_type="prop",
    schedule=[])

npc("npc_cultist", "Культист Тишины", "Серый плащ, холодная соль на губах. Верит, что Очаг должен умереть.",
    S(11, 11, 11, 11, 9, 12, 8), {"brawl": 40, "stealth": 40},
    natural_weapon={"skill": "brawl", "damage": "1d6", "damage_bonus": True, "range": 1,
                    "attacks_per_round": 1, "parry_capable": False},
    morale={"below_hp_pct": 25, "flee_chance": 60},
    faction="faction_silence", base_disposition=-30)

npc("npc_automaton", "Автоматон-страж", "Латунный страж Сердца. Не предаёт и не устаёт.",
    S(16, 16, 14, 9, 6, 6, 4), {"brawl": 50},
    abilities=["ability_steam"], armor=3,
    natural_weapon={"skill": "brawl", "damage": "1d8", "damage_bonus": True, "range": 1,
                    "attacks_per_round": 1, "parry_capable": True},
    faction="faction_silence", base_disposition=-30)


def item(id, cat, label, desc, weight, stack=True, **kw):
    e = {"id": id, "type": "item", "category": cat, "label": label, "description": desc,
         "image": "", "weight": weight, "stackable": stack}
    e.update(kw)
    ENTITIES[id] = e
    return e

item("item_silver", "currency", "Латунная марка", "Монета Оковины с шестернёй на аверсе.", 0.01)
item("item_bread", "food", "Хлеб с отрубями", "Чёрствый, но честный.", 0.3,
     value={"brass": 2},
     on_use={"effects": [{"type": "change_need", "need": "need_food", "delta": 15}], "consume": True})
item("item_stew", "food", "Горячая похлёбка", "Греет изнутри почти как печь.", 0.5,
     value={"brass": 6},
     on_use={"effects": [{"type": "change_need", "need": "need_food", "delta": 35},
                         {"type": "change_need", "need": "need_warmth", "delta": 5}], "consume": True})
item("item_tonic", "medicine", "Тёплый настой", "Полынь и мёд: проясняет голову и гонит кровь.", 0.4,
     value={"brass": 8},
     on_use={"effects": [{"type": "change_need", "need": "need_nerves", "delta": 25},
                         {"type": "change_need", "need": "need_warmth", "delta": 10}], "consume": True})
item("item_bandage", "medicine", "Бинт", "Чистая ветошь, свёрнутая умелой рукой.", 0.2,
     value={"brass": 5},
     on_use={"effects": [{"type": "change_hp", "delta": 6},
                         {"type": "remove_status", "target": "player", "status": "status_bleed"}], "consume": True})
item("item_herb", "misc", "Полынь", "Горькая трава с площади; основа настоя.", 0.1, value={"brass": 3})
item("item_cloth", "misc", "Ветошь", "Плотные ленты ткани.", 0.2, value={"brass": 2})
item("item_coal", "misc", "Тёплый уголёк", "Держит жар до полуночи. Сунь в рукавицу — и в путь.", 0.2,
     value={"brass": 4},
     on_use={"effects": [{"type": "change_need", "need": "need_warmth", "delta": 20}], "consume": True})
item("item_coat", "armor", "Зимний плащ", "Мех и промасленная ткань. С ним вечер не страшен.", 2.0, stack=False,
     value={"brass": 18}, armor_data={"points": 1}, equip_slot="armor")
item("item_revolver", "weapon", "Служебный револьвер", "Шесть зарядов конторской латуни.", 1.2, stack=False,
     value={"brass": 30},
     weapon_data={"skill": "shoot", "damage": "1d8", "damage_bonus": False, "range": 4,
                  "attacks_per_round": 1, "parry_capable": False}, equip_slot="weapon")
item("item_wrench", "weapon", "Монтировка", "Инструмент и аргумент.", 1.5, stack=False,
     value={"brass": 12},
     weapon_data={"skill": "brawl", "damage": "1d6", "damage_bonus": True, "range": 1,
                  "attacks_per_round": 1, "parry_capable": True}, equip_slot="weapon")
item("item_badge", "misc", "Жетон следователя", "Латунный жетон Пепельной конторы. Открывает двери и разговоры.", 0.05, stack=False)
item("item_ledger", "evidence", "Гроссбух Дрогана", "Двойная бухгалтерия: латунь уходила налево, а ночи помечены знаком Тишины.", 0.6, stack=False)
item("item_hymnal", "evidence", "Псалтырь Тишины", "Между страниц — гимн «Обратному сердцу», переписанный рукой Илетты.", 0.4, stack=False)
item("item_vial", "evidence", "Флакон с мёртвой гарью", "Гарь с нижних ярусов: пахнет холодной солью и не греет.", 0.2, stack=False)
item("item_key_under", "misc", "Ключ от решётки", "Тяжёлый ключ со штампом конторы. Решётка в Низы послушается его.", 0.1, stack=False)

# --- интерактивные объекты сцен ---
item("item_shelf", "misc", "Стеллаж с подшивкой", "Подшивки «Пепельного вестника» за десять лет.", 50, stack=False,
     scene_sprite="", portrait={"neutral": ""},
     interact_options=[
         {"label": "Прочитать подшивку",
          "hint": "внимательность",
          "conditions": [{"type": "flag_not_set", "flag": "herald_read"}],
          "effects": [{"type": "skill_check_gate", "skill": "spot", "difficulty": 40,
                       "success_effects": [{"type": "set_flag", "flag": "herald_read"},
                                           {"type": "unlock_codex", "entry": "codex_silence"},
                                           {"type": "show_message", "text": "В подшивке за год Пепла: секта «Тишина Горнила» снова вышла из подполья."}],
                       "fail_effects": [{"type": "show_message", "text": "Строки плывут: слишком устал, чтобы читать."}]}],
          "message": "Пыль, газетная труха и одна живая строка."}])
item("item_monument", "misc", "Памятник Очагу", "Латунная шестерня на постаменте. Зубья стёрты странно равномерно.", 300, stack=False,
     slot_type="prop", scene_sprite="", portrait={"neutral": ""},
     interact_options=[
         {"label": "Осмотреть зубья",
          "hint": "внимательность",
          "effects": [{"type": "skill_check_gate", "skill": "spot", "difficulty": 35,
                       "success_effects": [{"type": "unlock_codex", "entry": "codex_hearth"},
                                           {"type": "show_message", "text": "Зубья стёрты холодной солью. Той же, что в гарни с Низов."}],
                       "fail_effects": [{"type": "show_message", "text": "Латунь и латунь. Геройство на постаменте."}]}]}])
item("item_console", "misc", "Пульт Очага", "Стрелки давления и расхода тепла. Мастер не любит чужих рук.", 80, stack=False,
     slot_type="prop", scene_sprite="", portrait={"neutral": ""},
     interact_options=[
         {"label": "Считать приборы",
          "hint": "механика",
          "conditions": [{"type": "flag_not_set", "flag": "console_read"}],
          "effects": [{"type": "skill_check_gate", "skill": "mechanics", "difficulty": 45,
                       "success_effects": [{"type": "set_flag", "flag": "console_read"},
                                           {"type": "show_message", "text": "Нагрузка стравливается вниз, в Низы. Кто-то питает машину под Очагом."}],
                       "fail_effects": [{"type": "show_message", "text": "Стрелки дрожат. Без мастера не разобрать."}]}]}])
item("item_crate", "misc", "Ящик с гарью", "Дроган отводит глаза от этого ящика.", 40, stack=False,
     scene_sprite="", portrait={"neutral": ""},
     interact_options=[
         {"label": "Обыскать ящик",
          "hint": "внимательность",
          "conditions": [{"type": "flag_not_set", "flag": "ev_ledger"}],
          "effects": [{"type": "skill_check_gate", "skill": "spot", "difficulty": 50,
                       "success_effects": [{"type": "add_item", "item": "item_ledger", "quantity": 1},
                                           {"type": "show_message", "text": "Под двойным дном — гроссбух Дрогана."}],
                       "fail_effects": [{"type": "show_message", "text": "Гарь и тряпьё. Нужно смотреть внимательнее."}]}]},
         {"label": "Взять пробу гари",
          "hint": "механика",
          "conditions": [{"type": "flag_not_set", "flag": "ev_vial"}],
          "effects": [{"type": "skill_check_gate", "skill": "mechanics", "difficulty": 40,
                       "success_effects": [{"type": "add_item", "item": "item_vial", "quantity": 1},
                                           {"type": "show_message", "text": "Мёртвая гарь ложится во флакон ровным серым слоем."}],
                       "fail_effects": [{"type": "show_message", "text": "Гарь сыпется сквозь пальцы."}]}]}])
item("item_cache", "misc", "Тайник культистов", "Промасленный короб, присыпанный золой.", 30, stack=False,
     scene_sprite="", portrait={"neutral": ""},
     interact_options=[
         {"label": "Открыть тайник",
          "conditions": [{"type": "flag_not_set", "flag": "cache_opened"}],
          "effects": [{"type": "set_flag", "flag": "cache_opened"},
                      {"type": "add_item", "item": "item_herb", "quantity": 2},
                      {"type": "add_item", "item": "item_cloth", "quantity": 2},
                      {"type": "add_item", "item": "item_coal", "quantity": 2},
                      {"type": "remove_entity", "entity": "item_cache"}],
          "message": "Внутри — припасы секты: травы, ветошь и тёплые угольки."}])
