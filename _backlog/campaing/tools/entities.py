"""НПС, враги и предметы."""


def stats(STR, CON, SIZ, DEX, INT, POW, CHA):
    return {"STR": STR, "CON": CON, "SIZ": SIZ, "DEX": DEX, "INT": INT, "POW": POW, "CHA": CHA}


def portrait(name):
    return {"neutral": f"assets/img/npc/{name}.jpg"}


def npc(id_, label, desc, st, skills, dialogue=None, img=None, slot_type="person", schedule=None, **kw):
    e = {"id": id_, "type": "npc", "label": label, "description": desc,
         "portrait": portrait(img) if img else {}, "stats": st, "skills": skills,
         "inventory": kw.pop("inventory", []), "equipment": kw.pop("equipment", {}),
         "slot_type": slot_type, "schedule": schedule if schedule is not None else []}
    if dialogue:
        e["dialogue"] = f"dialogues/{dialogue}.ink"
    e.update(kw)
    return e


def item(id_, cat, label, desc, weight=0.1, stackable=True, value=None, **kw):
    e = {"id": id_, "type": "item", "category": cat, "label": label, "description": desc,
         "weight": weight, "stackable": stackable}
    if value is not None:
        e["value"] = {"token": value}
    e.update(kw)
    return e


def use(effects, consume=True, message=None):
    u = {"effects": effects, "consume": consume}
    if message:
        u["message"] = message
    return u


def opt(label, effects, conditions=None, hint=None, message=None, consume=None, sound=None):
    o = {"label": label, "effects": effects}
    if conditions:
        o["conditions"] = conditions
    if hint:
        o["hint"] = hint
    if message:
        o["message"] = message
    if consume is not None:
        o["consume"] = consume
    if sound:
        o["sound"] = sound
    return o


def F(flag):
    return {"type": "flag_set", "flag": flag}


def NF(flag):
    return {"type": "flag_not_set", "flag": flag}


def HAS(it, n=None):
    c = {"type": "has_item", "item": it}
    if n:
        c["min_quantity"] = n
    return c


def NOT(c):
    return {"type": "not", "condition": c}


def setf(flag):
    return {"type": "set_flag", "flag": flag}


def msg(t):
    return {"type": "show_message", "text": t}


def add(it, q=1):
    return {"type": "add_item", "item": it, "quantity": q}


def rem(it, q=1):
    return {"type": "remove_item", "item": it, "quantity": q}


def check(skill, diff, ok, fail):
    return {"type": "skill_check_gate", "skill": skill, "difficulty": diff, "success_effects": ok, "fail_effects": fail}


def codex(e):
    return {"type": "unlock_codex", "entry": e}


def sanity(d):
    return {"type": "change_sanity", "delta": d}


def time(t):
    return {"type": "advance_time", "ticks": t}


def fire(r):
    return {"type": "fire_rule", "rule": r}


def build_entities():
    E = {}

    def put(e):
        assert e["id"] not in E, e["id"]
        E[e["id"]] = e

    # ------------------------------------------------------------ ГЕРОЙ
    put(npc("player_hero", "Дознаватель", "Дознаватель Палаты Тишины. Латунный жетон на лацкане, револьвер под плащом и бессонница вместо семьи.",
            stats(11, 12, 10, 13, 10, 9, 6),
            {"spot": 60, "insight": 40, "persuade": 35, "stealth": 20, "lockpick": 20, "melee": 20, "occult": 25,
             "mechanics": 20, "medicine": 15, "firearms": 25, "intimidate": 20, "dodge": 30},
            inventory=[{"item": "item_token", "quantity": 20}, {"item": "item_revolver", "quantity": 1},
                       {"item": "item_cartridge", "quantity": 8}, {"item": "item_filter", "quantity": 2},
                       {"item": "item_ration", "quantity": 1}, {"item": "item_bandage", "quantity": 1},
                       {"item": "item_badge", "quantity": 1}, {"item": "item_coat", "quantity": 1}],
            equipment={"weapon": "item_revolver", "armor": "item_coat"},
            abilities=["ability_magnesium"]))

    # ------------------------------------------------------------ ВОКЗАЛ
    put(npc("npc_osric", "Старший дознаватель Озрик Тальм",
            "Седой начальник отдела. Курит трубку с угольным фильтром и не верит в совпадения. Ждёт доклада.",
            stats(10, 11, 12, 9, 15, 13, 12), {"insight": 65, "persuade": 50, "firearms": 45},
            dialogue="osric", img="osric", faction="faction_chamber", base_disposition=20))
    put(npc("npc_vale", "Сестра Вейл, прозектор",
            "Монахиня-механик из Ордена, приписанная к мертвецкой Палаты. Половина лица — латунная маска, голос — ровный, как метроном.",
            stats(9, 12, 10, 14, 16, 14, 9), {"medicine": 75, "occult": 50, "mechanics": 55},
            dialogue="vale", img="vale", faction="faction_order", base_disposition=10))
    put(npc("npc_vendor", "Автомат «Щедрый клапан»",
            "Латунный раздатчик довоенной сборки. Принимает жетоны, хрипит рекламные гимны и иногда говорит то, чего не должен знать.",
            stats(8, 8, 8, 8, 8, 8, 8), {}, dialogue="vendor", img="vendor", slot_type="prop",
            trader={"sells": [{"item": "item_filter", "price": 6}, {"item": "item_bread", "price": 3},
                              {"item": "item_cartridge", "price": 2}, {"item": "item_bandage", "price": 4}],
                    "buys": False}))

    # ------------------------------------------------------------ НИЖНИЙ РЯД
    put(npc("npc_pik", "Пик, уличная девчонка",
            "Тощая беспризорница в огромных лётных очках. Знает каждый люк Нижнего Ряда и продаёт сведения за еду.",
            stats(8, 10, 7, 16, 13, 11, 12), {"stealth": 70, "spot": 65, "melee": 35, "dodge": 60, "lockpick": 55},
            dialogue="pik", img="pik", faction="faction_lower", base_disposition=0,
            equipment={"weapon": "item_shiv"}))
    put(npc("npc_grimm", "Гримм, хозяин «Мятого клапана»",
            "Огромный трактирщик с паровой рукой. Наливает в долг тем, кто платит слухами, и выставляет тех, кто задаёт много вопросов.",
            stats(15, 14, 16, 9, 11, 10, 11), {"persuade": 55, "melee": 50, "insight": 45},
            dialogue="grimm", img="grimm", faction="faction_lower", base_disposition=0,
            trader={"sells": [{"item": "item_stew", "price": 5}, {"item": "item_bread", "price": 3},
                              {"item": "item_gin", "price": 3}, {"item": "item_tlen_moss", "price": 4},
                              {"item": "item_powder", "price": 4}, {"item": "item_filter", "price": 7}],
                    "buys": True, "buy_rate": 0.5}))
    put(npc("npc_hesk", "Одноглазый Хеск",
            "Отставной кочегар, лишившийся глаза у клапана №7. Пьёт можжевеловый ёрш и боится темноты под литейными.",
            stats(12, 9, 12, 8, 10, 7, 8), {"mechanics": 50, "insight": 30},
            dialogue="hesk", img="hesk", faction="faction_union", base_disposition=-5))
    put(npc("npc_marrow", "Доктор Илзе Марроу",
            "Хирург-аугментатор Нижнего Ряда. Её латунные протезы ходят по всему городу. Пальцы в шрамах от пайки, глаза — от бессонницы.",
            stats(9, 10, 9, 15, 17, 12, 10), {"medicine": 80, "mechanics": 75, "insight": 50},
            dialogue="marrow", img="marrow", faction="faction_lower", base_disposition=-10))

    # ------------------------------------------------------------ ЛИТЕЙНЫЕ
    put(npc("npc_bruno", "Бруно Кальд, бригадир кочегаров",
            "Широкоплечий вожак Союза кочегаров. Не любит Палату, Орден и Совет — в этом порядке. Скоро Великий Завод, и он готовит своих людей.",
            stats(16, 15, 15, 10, 11, 12, 13), {"intimidate": 60, "mechanics": 65, "melee": 55},
            dialogue="bruno", img="bruno", faction="faction_union", base_disposition=-20))
    put(npc("npc_martha", "Марта Сол, вдова кочегара",
            "Жена Томаса Сола, пятой жертвы. Чинит робы кочегаров и ждёт вестей о младшем брате Йенсе, пропавшем неделю назад.",
            stats(10, 12, 10, 11, 11, 13, 11), {"medicine": 30, "insight": 40},
            dialogue="martha", img="martha", faction="faction_union", base_disposition=0))

    # ------------------------------------------------------------ СОБОР
    put(npc("npc_gallian", "Архимеханик Ворс Галлиан",
            "Глава Ордена Святой Шестерни. Высокий, сухой, в рясе с латунными рёбрами. Считает Сердце-Двигатель святыней, а вопросы — богохульством.",
            stats(10, 11, 13, 9, 16, 17, 13), {"occult": 80, "persuade": 60, "mechanics": 60},
            dialogue="gallian", img="gallian", faction="faction_order", base_disposition=-10))
    put(npc("npc_tobias", "Брат Тобиас, архивариус",
            "Подслеповатый хранитель скриптория. Носит три пары очков сразу и помнит, где лежит каждая страница за последние четыреста лет — кроме одной.",
            stats(7, 9, 8, 10, 17, 14, 10), {"occult": 70, "spot": 55},
            dialogue="tobias", img="tobias", faction="faction_order", base_disposition=10))

    # ------------------------------------------------------------ ШПИЛЬ
    put(npc("npc_venn", "Советница Лиара Венн",
            "Голос Совета Шпиля, распорядительница Великого Завода. Безупречна, любезна и всегда на шаг впереди.",
            stats(10, 12, 10, 12, 17, 18, 17), {"persuade": 80, "insight": 70, "occult": 75},
            dialogue="venn", img="venn", faction="faction_council", base_disposition=10,
            schedule=[{"time_range": [8, 20], "location": "loc_spire", "scene": "scene_council_hall", "slot": "slot_venn"}]))
    put(npc("npc_drew", "Кассиан Дрю, секретарь Совета",
            "Нервный секретарь канцелярии в слишком дорогом сюртуке. Пальцы в чернилах, долги в карточных клубах.",
            stats(9, 9, 10, 11, 14, 8, 10), {"persuade": 40, "insight": 35},
            dialogue="drew", img="drew", faction="faction_council", base_disposition=0,
            schedule=[{"time_range": [8, 20], "location": "loc_spire", "scene": "scene_chancery", "slot": "slot_drew"}]))

    # ------------------------------------------------------------ ГЛУБИНЫ
    put(npc("npc_grille", "Решётка в стене коллектора",
            "Ржавая решётка старого воздуховода. Из-за неё тянет тёплым ветром, а в глубине мерцает зелёный огонёк. Иногда он говорит.",
            stats(8, 8, 8, 8, 8, 8, 8), {}, dialogue="grille", img="grille", slot_type="prop"))
    put(npc("npc_litany", "Литания, дух Сердца-Двигателя",
            "Ядро машины, которая греет город четыреста лет. Внутри бьётся что-то живое, скованное литургией и сталью.",
            stats(8, 8, 8, 8, 20, 25, 18), {}, dialogue="litany", img="litany", slot_type="prop"))

    # ------------------------------------------------------------ ВРАГИ
    claws = {"skill": "melee", "damage": "1d6", "damage_bonus": True, "range": 1, "attacks_per_round": 1, "parry_capable": True, "label": "ржавый тесак"}
    put(npc("npc_scavenger", "Ржавый падальщик",
            "Сборщик металлолома, озверевший от хмари. Лицо замотано тряпьём, в руке — заточенный обрезок трубы.",
            stats(11, 10, 10, 12, 8, 7, 5), {"melee": 40, "dodge": 25},
            natural_weapon=claws, combat_ai="aggressive",
            loot_table=[{"item": "item_brass_scrap", "chance": 0.6, "min": 1, "max": 2}, {"item": "item_rag", "chance": 0.5},
                        {"item": "item_token", "chance": 0.5, "min": 1, "max": 4}],
            morale={"below_hp_pct": 40, "flee_chance": 50}))
    put(npc("npc_hound", "Тлен-гончая",
            "Собака, вросшая в обломки дыхательного аппарата. Дышит ядом и бегает быстрее паровоза.",
            stats(10, 11, 8, 15, 5, 8, 3), {"bite": 45, "dodge": 40},
            natural_weapon={"skill": "bite", "damage": "1d6", "damage_bonus": False, "range": 1, "attacks_per_round": 1, "parry_capable": False, "label": "клыки"},
            abilities=["ability_tlen_bite"], combat_ai="aggressive",
            loot_table=[{"item": "item_tlen_moss", "chance": 0.5}]))
    clock_fist = {"skill": "melee", "damage": "1d6", "damage_bonus": True, "range": 1, "attacks_per_round": 1, "parry_capable": False, "label": "латунные кулаки"}
    put(npc("npc_clockman", "Часовщик",
            "Бывший человек с латунным сердцем вместо живого. Двигается рывками, в такт чужому механизму. В глазах — ни боли, ни памяти.",
            stats(15, 14, 13, 8, 6, 5, 3), {"melee": 45}, natural_weapon=clock_fist, armor=2, combat_ai="aggressive",
            loot_table=[{"item": "item_brass_scrap", "chance": 0.8, "min": 1, "max": 3}]))
    put(npc("npc_ansel", "Брат Ансель, Часовщик-звонарь",
            "Бывший звонарь собора и первая жертва. Ряса истлела, сквозь рёбра просвечивает латунь. Он всё ещё сторожит колокол.",
            stats(15, 15, 12, 9, 6, 9, 3), {"melee": 50}, natural_weapon=clock_fist, armor=2, combat_ai="aggressive"))
    put(npc("npc_jens", "Йенс, брат Марты",
            "Молодой кочегар, ставший Часовщиком. Сердце-механизм ещё не прижилось: он вздрагивает, когда слышит своё имя.",
            stats(14, 13, 12, 10, 8, 10, 6), {"melee": 40}, natural_weapon=clock_fist, armor=1, combat_ai="aggressive"))
    put(npc("npc_spire_agent", "Агент Шпиля",
            "Серый плащ, стеклянная маска, пистолет с глушителем. Люди Совета, которых официально не существует.",
            stats(12, 12, 11, 13, 11, 10, 8), {"firearms": 45, "melee": 40, "dodge": 35},
            natural_weapon={"skill": "firearms", "damage": "1d8", "damage_bonus": False, "range": 6, "attacks_per_round": 1, "parry_capable": False, "label": "пистолет с глушителем"},
            combat_ai="aggressive", faction="faction_council",
            loot_table=[{"item": "item_cartridge", "chance": 0.7, "min": 2, "max": 4}, {"item": "item_token", "chance": 0.6, "min": 3, "max": 6},
                        {"item": "item_filter", "chance": 0.3}],
            morale={"below_hp_pct": 30, "flee_chance": 40}))
    put(npc("npc_venn_boss", "Венн — Голос Сердца",
            "Советница, вросшая в пульсирующие кабели ядра. Её голос звучит из каждой трубы зала сразу.",
            stats(16, 18, 14, 12, 17, 20, 17), {"melee": 55, "occult": 80, "dodge": 40},
            img="venn",
            natural_weapon={"skill": "melee", "damage": "1d8", "damage_bonus": True, "range": 2, "attacks_per_round": 1, "parry_capable": True, "label": "кабели-плети"},
            abilities=["ability_steam_burst", "ability_litany_whisper"], armor=3, combat_ai="aggressive"))

    # ------------------------------------------------------------ ПРЕДМЕТЫ: валюта, еда, лекарства
    put(item("item_token", "currency", "Латунный жетон", "Городская монета с выбитой шестернёй. Ими платят за хлеб, фильтры и молчание.", 0.01, value=1))
    put(item("item_bread", "food", "Чёрный хлеб", "Плотный хлеб из угольной муки. Скрипит на зубах, но держит.", 0.3, value=3,
             on_use=use([{"type": "change_need", "need": "need_food", "delta": 30}])))
    put(item("item_stew", "food", "Похлёбка из угря", "Горячее варево из трубного угря в жестяной миске. Лучшее, что есть в Нижнем Ряду.", 0.5, value=5,
             on_use=use([{"type": "change_need", "need": "need_food", "delta": 50}, {"type": "change_hp", "delta": 1}])))
    put(item("item_ration", "food", "Паёк Палаты", "Брикет прессованной каши в вощёной бумаге со штампом Палаты Тишины.", 0.3, value=4,
             on_use=use([{"type": "change_need", "need": "need_food", "delta": 40}])))
    put(item("item_gin", "drink", "Можжевеловый ёрш", "Мутный самогон с можжевельником. Греет и глушит шёпот в трубах.", 0.4, value=3,
             on_use=use([sanity(4), {"type": "apply_status", "target": "player", "status": "status_drunk"}],
                        message="Ёрш обжигает горло. Шёпот в трубах стихает.")))
    put(item("item_bandage", "medicine", "Бинт с карболкой", "Стерильная повязка, пропитанная едким раствором.", 0.1, value=4,
             on_use=use([{"type": "change_hp", "delta": 3}])))
    put(item("item_antidote", "medicine", "Тлен-отвар", "Горький отвар из мха, выводящий тлен из лёгких.", 0.2, value=6,
             on_use=use([{"type": "remove_status", "target": "player", "status": "status_tlen"}, {"type": "change_hp", "delta": 1}])))
    put(item("item_stim", "medicine", "Стимулятор Марроу", "Ампула с мерцающей жидкостью. Обостряет чувства на несколько часов — и бьёт по нервам.", 0.1, value=10,
             on_use=use([{"type": "apply_status", "target": "player", "status": "status_stim"}, sanity(-1)])))
    put(item("item_incense", "medicine", "Ладанное масло", "Масло, которым монахи смазывают молитвенные барабаны. Его запах проясняет мысли.", 0.1, value=5,
             on_use=use([{"type": "apply_status", "target": "player", "status": "status_clarity"}, sanity(2)])))
    put(item("item_filter", "consumable", "Угольный фильтр", "Сменная кассета для респиратора. Без неё хмарь Нижнего города съедает лёгкие за пару дней.", 0.2, value=6,
             on_use=use([{"type": "change_need", "need": "need_air", "delta": 45}], message="Щелчок кассеты. Воздух снова пахнет углём, а не смертью.")))
    put(item("item_good_filter", "consumable", "Фильтр Томаса", "Самодельная кассета Томаса Сола: тройной уголь и вощёная ткань. Держит вдвое дольше.", 0.2, value=12,
             on_use=use([{"type": "change_need", "need": "need_air", "delta": 90}])))

    # материалы
    put(item("item_rag", "material", "Ветошь", "Промасленные тряпки. Годятся на бинты и фильтры.", 0.1, value=1))
    put(item("item_charcoal", "material", "Древесный уголь", "Горсть угля для фильтров.", 0.2, value=1))
    put(item("item_brass_scrap", "material", "Латунный лом", "Обрезки латуни: гильзы, шестерёнки, пружины.", 0.3, value=1))
    put(item("item_powder", "material", "Порох в жестянке", "Чёрный порох из-под прилавка Гримма.", 0.2, value=4))
    put(item("item_tlen_moss", "material", "Тлен-мох", "Бледный мох с труб Нижнего города. Ядовит сам по себе, но лечит в отваре.", 0.1, value=4))

    # оружие и одежда
    put(item("item_revolver", "weapon", "Табельный револьвер", "Шестизарядный револьвер Палаты с латунной рукоятью.", 1.2, False, 30,
             equip_slot="weapon",
             weapon_data={"skill": "firearms", "damage": "1d8", "damage_bonus": False, "range": 8, "attacks_per_round": 1,
                          "parry_capable": False, "ammo_item": "item_cartridge", "label": "револьвер"}))
    put(item("item_cartridge", "ammo", "Патрон", "Латунный патрон к табельному револьверу.", 0.02, value=2))
    put(item("item_baton", "weapon", "Дубинка с набалдашником", "Окованная латунью дубинка. Не убивает — убеждает.", 0.8, False, 8,
             equip_slot="weapon",
             weapon_data={"skill": "melee", "damage": "1d6", "damage_bonus": True, "range": 1, "attacks_per_round": 1, "parry_capable": True, "label": "дубинка"}))
    put(item("item_sabre", "weapon", "Гвардейская сабля", "Сабля Гвардии Шпиля с гравировкой полка. Память о прежней службе.", 1.4, False, 20,
             equip_slot="weapon",
             weapon_data={"skill": "melee", "damage": "1d8", "damage_bonus": True, "range": 1, "attacks_per_round": 1, "parry_capable": True, "label": "сабля"}))
    put(item("item_shiv", "weapon", "Заточка", "Заострённая спица от зонта.", 0.2, False, 1, equip_slot="weapon",
             weapon_data={"skill": "melee", "damage": "1d4", "damage_bonus": True, "range": 1, "attacks_per_round": 1, "parry_capable": False, "label": "заточка"}))
    put(item("item_coat", "armor", "Прорезиненный плащ", "Плащ дознавателя: держит кислотную морось и немного — нож.", 2.0, False, 15,
             equip_slot="armor", armor_data={"points": 1}))
    put(item("item_badge", "key", "Жетон Палаты Тишины", "Латунный знак дознавателя. Открывает двери в чистых кварталах и закрывает рты — в грязных.", 0.1, False))

    # улики
    put(item("item_ev_heart", "evidence", "Часовое сердце", "Латунный механизм размером с кулак, извлечённый из груди Томаса Сола. Клеймо «И.М.» и строка литургического шрифта по ободу.", 0.6, False))
    put(item("item_ev_valve_tag", "evidence", "Журнал спусков клапана №7", "Жестяные бирки со стойки клапана. Семь ночных спусков в шлюз — и даты совпадают с днями пропажи жертв.", 0.2, False))
    put(item("item_ev_shift_list", "evidence", "Табель ночной смены", "Записка из шкафчика Томаса: список кочегаров ночной смены у клапана №7. Пять имён зачёркнуты, его — шестое.", 0.05, False))
    put(item("item_ev_ledger", "evidence", "Журнал заказов Марроу", "Аккуратная книга заказов: семь «кардиомеханизмов особой серии». Оплачено канцелярией Совета, номер ордера указан.", 0.5, False))
    put(item("item_ev_seal", "evidence", "Ордер с печатью Совета", "Копия ордера канцелярии на «особую серию» с личной печатью Голоса Совета — Лиары Венн.", 0.05, False))
    put(item("item_ev_litany", "evidence", "Страница «Литании Пробуждения»", "Пергамент, вырванный из запретного свода Ордена: обряд, дающий голос тому, кто встанет у ядра в ночь Великого Завода. На обороте — слова печати.", 0.05, False))
    put(item("item_ev_recording", "evidence", "Валик фонографа", "Восковой валик. На нём — голос Венн, обещающий машине свободу в обмен на «седьмое сердце».", 0.3, False))
    put(item("item_locket", "key", "Медальон Йенса", "Жестяной медальон с выцветшим портретом двух детей: мальчика и девочки постарше.", 0.05, False))
    put(item("item_bell_key", "key", "Ключ от сундука звонаря", "Длинный ключ с бородкой в виде колокола.", 0.1, False))
    put(item("item_valve_key", "key", "Ключ-шестерня шлюза", "Бронзовая шестерня с рукоятью: ею кочегары открывали Глубокий шлюз под клапаном №7.", 0.4, False))

    # ------------------------------------------------------------ ОБСТАНОВКА СЦЕН (осматриваемые объекты)
    board_opts = [
        opt("Связать: «Мастер сердец»",
            [setf("ded_maker"), codex("codex_case_maker"),
             msg("Клеймо «И.М.» на латуни и признание Марроу сходятся: сердца делала она — по заказу, который пришёл сверху. Нить тянется к канцелярии Совета.")],
            [HAS("item_ev_heart"), F("marrow_admitted"), NF("ded_maker")], hint="нужны: часовое сердце и признание мастера"),
        opt("Связать: «Общая нить жертв»",
            [setf("ded_victims"), codex("codex_case_victims"), {"type": "reveal_location", "location": "loc_undercity"},
             msg("Все жертвы — из ночной смены у клапана №7. Даты спусков в шлюз совпадают с датами пропаж. Под литейными есть отстойники — и кто-то водит туда людей.")],
            [HAS("item_ev_valve_tag"), HAS("item_ev_shift_list"), NF("ded_victims")], hint="нужны: журнал спусков и табель смены"),
        opt("Связать: «Смысл обряда»",
            [setf("ded_ritual"), codex("codex_winding"),
             msg("Семь сердец — семь колоколов Великого Завода. Гравировка на латуни — строка из «Литании Пробуждения». В ночь Завода тот, кто встанет у ядра, получит Голос машины.")],
            [HAS("item_ev_litany"), F("body_engraving_read"), NF("ded_ritual")], hint="нужны: страница литании и прочитанная гравировка"),
        opt("Связать: «Заказчик»",
            [setf("ded_payer"), codex("codex_case_payer"),
             msg("Номер ордера в журнале Марроу совпадает с ордером, на котором стоит личная печать Голоса Совета. Заказчик — советница Лиара Венн.")],
            [HAS("item_ev_ledger"), HAS("item_ev_seal"), NF("ded_payer")], hint="нужны: журнал заказов и ордер с печатью"),
        opt("Связать: «Голос в трубах»",
            [setf("ded_motive"), codex("codex_venn"),
             msg("Голос на валике — Венн. Она не освобождает машину: она хочет стать её голосом. Город будет дышать по её слову.")],
            [HAS("item_ev_recording"), F("ded_ritual"), NF("ded_motive")], hint="нужны: валик фонографа и разгаданный обряд"),
        opt("Перечитать дело",
            [msg("Улики приколоты к доске, нити натянуты. Чего не хватает — подскажут подсказки под кнопками. Записи о деле — в кодексе.")],
            hint="ничего не меняет"),
    ]
    put(item("item_evidence_board", "scenery", "Доска улик",
             "Пробковая доска с записками и красными нитями. Здесь улики складываются в выводы.", 30, False,
             portrait={}, interact_options=board_opts))
    put(item("item_cot", "scenery", "Койка в конторе", "Продавленная казённая койка. Спать на ней можно, высыпаться — нет.", 30, False,
             interact_options=[
                 opt("Поспать до утра (8 часов)", [time(8), {"type": "change_hp", "delta": 2}, sanity(2), msg("Сон без снов. Только тиканье стенных часов.")],
                     hint="8 часов; восстанавливает немного здоровья и рассудка"),
                 opt("Вздремнуть (3 часа)", [time(3), {"type": "change_hp", "delta": 1}], hint="3 часа"),
             ]))
    put(item("item_corpse", "scenery", "Тело Томаса Сола",
             "Кочегар, тридцать восемь лет. Грудь вскрыта и зашита латунной проволокой. Под швом что-то мерно тикает.", 70, False,
             interact_options=[
                 opt("Извлечь механизм из груди", [check("medicine", 50,
                     [add("item_ev_heart"), setf("body_heart_taken"), codex("codex_clock_heart"),
                      msg("Вы перерезаете латунные жилы. Механизм в ладони ещё тёплый — и всё ещё тикает.")],
                     [time(1), sanity(-2), msg("Пальцы соскальзывают с проволоки. Механизм дёргается, как живой. Нужна передышка.")])],
                     [NF("body_heart_taken")], hint="проверка Медицины; провал стоит часа и капли рассудка"),
                 opt("Осмотреть руки и одежду", [check("spot", 45,
                     [setf("body_soot_found"), msg("Под ногтями — жирная сажа паропровода высокого давления. На запястье — затёртая бирка смены: «Кл. 7, ночь».")],
                     [time(1), msg("Обычная сажа, обычные мозоли. Взгляд скользит. Стоит посмотреть ещё раз.")])],
                     [NF("body_soot_found")], hint="проверка Внимательности"),
                 opt("Прочесть гравировку на латуни", [check("occult", 40,
                     [setf("body_engraving_read"), codex("codex_order"),
                      msg("Литургический шрифт Ордена: «И СЕДЬМОЙ КОЛОКОЛ ОБРЕТЁТ ГОЛОС». Это не молитва Шестерни — это строка из запретного свода.")],
                     [time(1), sanity(-1), msg("Буквы плывут, сплетаясь в шестерни. Голова гудит.")])],
                     [F("body_heart_taken"), NF("body_engraving_read")], hint="нужно извлечённое сердце; проверка Литургики"),
             ]))
    put(item("item_trash_heap", "scenery", "Куча хлама", "Ржавые обрезки, тряпьё, битое стекло. Кто-то здесь уже рылся — но не всё нашёл.", 50, False,
             interact_options=[
                 opt("Порыться в хламе (1 час)", [time(1), add("item_rag"), add("item_charcoal"),
                     check("spot", 50, [add("item_brass_scrap", 2), msg("Среди тряпья — горсть латунного лома.")],
                           [msg("Только тряпки и уголь. Пальцы чёрные до локтей.")])],
                     hint="ветошь, уголь и, если повезёт, латунь"),
             ]))
    put(item("item_marrow_cabinet", "scenery", "Запертый шкаф Марроу", "Тяжёлый шкаф с кодовым замком-шестернёй. Марроу не сводит с него глаз.", 80, False,
             interact_options=[
                 opt("Вскрыть замок, пока Марроу не смотрит", [check("lockpick", 45,
                     [add("item_ev_ledger"), setf("ledger_stolen"), setf("marrow_doomed"),
                      {"type": "commit_crime", "id": "crime_theft"},
                      msg("Диск щёлкает. Внутри — журнал заказов. Вы прячете его под плащ. Марроу ничего не заметила… кажется.")],
                     [time(1), {"type": "change_disposition", "target": "npc_marrow", "delta": -15},
                      msg("Замок скрежещет. Марроу оборачивается: «Руки прочь от моих бумаг!»")])],
                     [NF("ledger_stolen"), NF("marrow_saved"), NF("marrow_dead")], hint="проверка Взлома; кража — преступление"),
                 opt("Забрать журнал из разгромленной мастерской", [add("item_ev_ledger"), setf("ledger_stolen"),
                     msg("Среди осколков — журнал заказов. Те, кто приходил за Марроу, искали не его.")],
                     [F("marrow_dead"), NOT(HAS("item_ev_ledger"))]),
             ]))
    put(item("item_valve7", "scenery", "Клапан №7", "Маховик главного паропровода. Стрелка манометра пляшет у красной черты, бирки на стойке звенят от вибрации.", 500, False,
             interact_options=[
                 opt("Снять бирки со стойки", [add("item_ev_valve_tag"), setf("valve_tags_taken"),
                     msg("На жестяных бирках — отметки спусков в Глубокий шлюз. Семь ночных спусков за месяц, последний — три дня назад.")],
                     [NF("valve_tags_taken")]),
                 opt("Стравить давление", [check("mechanics", 45,
                     [setf("valve_fixed"), {"type": "change_disposition", "target": "faction_union", "delta": 10},
                      msg("Вы налегаете на маховик. Пар уходит со свистом, стрелка отползает от красной черты. Кочегары у печей переглядываются.")],
                     [{"type": "change_hp", "delta": -2}, msg("Струя пара бьёт в рукав. Ожог. Маховик не поддаётся.")])],
                     [NF("valve_fixed")], hint="проверка Механики; провал обжигает"),
             ]))
    put(item("item_lockers", "scenery", "Шкафчики кочегаров", "Жестяные шкафчики ночной смены. На одном сорвана пломба — шкафчик Томаса Сола.", 100, False,
             interact_options=[
                 opt("Открыть шкафчик Томаса (с разрешения Марты)", [add("item_ev_shift_list"), add("item_good_filter"), setf("lockers_opened"),
                     msg("Внутри — запасная роба, самодельный фильтр и записка: табель ночной смены у клапана №7. Пять имён зачёркнуто.")],
                     [F("martha_permission"), NF("lockers_opened")]),
                 opt("Взломать шкафчик Томаса", [check("lockpick", 35,
                     [add("item_ev_shift_list"), setf("lockers_opened"), setf("lockers_forced"),
                      {"type": "change_disposition", "target": "npc_martha", "delta": -15},
                      msg("Дверца поддаётся с визгом. Табель ночной смены — у вас. Марта смотрит молча.")],
                     [time(1), msg("Замок старый, но упрямый.")])],
                     [NF("martha_permission"), NF("lockers_opened")], hint="проверка Взлома; Марте это не понравится"),
             ]))
    put(item("item_prayer_engine", "scenery", "Молитвенный механизм", "Латунные барабаны с выбитыми молитвами. За два жетона монах зажжёт свечу и повернёт их за вас.", 200, False,
             interact_options=[
                 opt("Поставить свечу (2 жетона)", [rem("item_token", 2), sanity(6), {"type": "apply_status", "target": "player", "status": "status_clarity"},
                     msg("Барабаны вращаются с мерным шорохом. Шёпот в голове стихает, мысли выстраиваются, как зубцы.")],
                     [HAS("item_token", 2)], hint="+рассудок, ясность мыслей"),
             ]))
    put(item("item_bell_chest", "scenery", "Окованный сундук звонаря", "Сундук брата Анселя. Замок в форме колокола.", 60, False,
             interact_options=[
                 opt("Открыть ключом звонаря", [add("item_ev_litany"), setf("litany_page_found"),
                     msg("Под истлевшей рясой — пергамент с выжженной печатью Ордена. «Литания Пробуждения». Ансель спрятал её здесь — и поплатился.")],
                     [HAS("item_bell_key"), F("belltower_cleared"), NF("litany_page_found")]),
                 opt("Осмотреть замок", [msg("Замок в форме колокола. Без ключа звонаря его не открыть — разве что вместе с крышкой.")],
                     [NOT(HAS("item_bell_key"))]),
             ]))
    put(item("item_tribune", "scenery", "Кафедра обвинения", "Отсюда по древнему праву любой может обвинить члена Совета — если готов поставить на кон свою голову.", 200, False,
             interact_options=[
                 opt("Обвинить советницу Венн — предъявить запись", [fire("rule_expose_venn")],
                     [F("ded_payer"), F("ded_ritual"), HAS("item_ev_recording"), NF("venn_exposed"), NF("accusation_failed"), {"type": "time_of_day", "value": ["morning", "day", "evening"]}],
                     hint="ордер, обряд и голос Венн на валике — неопровержимо"),
                 opt("Обвинить советницу Венн — без записи", [check("persuade", 45, [fire("rule_expose_venn")], [fire("rule_accusation_failed")])],
                     [F("ded_payer"), F("ded_ritual"), NOT(HAS("item_ev_recording")), NF("venn_exposed"), NF("accusation_failed"), {"type": "time_of_day", "value": ["morning", "day", "evening"]}],
                     hint="проверка Убеждения; провал — изгнание из Шпиля"),
                 opt("Обвинить Архимеханика Галлиана", [setf("wrong_accused"), setf("gallian_arrested"),
                     {"type": "banner", "text": "Галлиан взят под стражу", "seconds": 3},
                     msg("Гвардейцы уводят Архимеханика. Венн благодарно кивает вам с подиума. Почему-то от этого кивка холодеет спина."), sanity(-3)],
                     [F("ded_maker"), NF("ded_payer"), NF("wrong_accused"), NF("venn_exposed")], hint="литургический шрифт — его Орден…"),
                 opt("Обвинить бригадира Кальда", [setf("wrong_accused"), setf("bruno_arrested"),
                     {"type": "banner", "text": "Бруно Кальд взят под стражу", "seconds": 3},
                     msg("За Бруно приходят ночью. Литейные гудят, как растревоженный улей. Венн улыбается."), sanity(-3)],
                     [F("ded_maker"), NF("ded_payer"), NF("wrong_accused"), NF("venn_exposed")], hint="все жертвы — его люди…"),
                 opt("Осмотреть кафедру", [msg("Латунный рупор, отполированный тысячами рук. Обвинение без доказательств здесь стоит головы обвинителя.")]),
             ]))
    put(item("item_drew_desk", "scenery", "Стол секретаря", "Заваленный бумагами стол Кассиана Дрю. Нижний ящик заперт, рядом — печать Совета в бархатном футляре.", 60, False,
             interact_options=[
                 opt("Обыскать ящик (пока секретаря нет)", [check("lockpick", 50,
                     [add("item_ev_seal"), setf("seal_taken"), {"type": "commit_crime", "id": "crime_burglary"},
                      msg("В ящике — копии ордеров «особой серии». На каждом — личная печать Голоса Совета. Одну копию вы забираете.")],
                     [time(1), msg("Где-то в коридоре шаги. Вы отдёргиваете руку от ящика.")])],
                     [NF("seal_taken"), {"type": "time_of_day", "value": ["night"]}], hint="только ночью; проверка Взлома; кража со взломом"),
                 opt("Осмотреть бумаги на столе", [msg("Счета карточного клуба «Золотой поршень». Расписание Великого Завода. Ничего, что можно унести без ордера.")]),
             ]))
    put(item("item_phonograph", "scenery", "Брошенный фонограф", "Фонограф в жестяном ящике, раструб облеплен мхом. На валике — свежий воск.", 15, False,
             interact_options=[
                 opt("Прокрутить валик", [add("item_ev_recording"), setf("heard_recording"), sanity(-2),
                     msg("Треск. Женский голос, спокойный и ласковый: «Седьмое сердце будет в ночь Завода. Ты получишь свободу, а я — твой голос». Голос Лиары Венн.")],
                     [NF("heard_recording")]),
             ]))
    put(item("item_jens_jacket", "scenery", "Брошенная куртка кочегара", "Куртка на обломках мостков. Из воды рядом торчит латунная рука — и шевелит пальцами.", 5, False,
             interact_options=[
                 opt("Позвать Йенса по имени", [check("persuade", 45, [fire("rule_jens_peace")], [fire("rule_jens_fight")])],
                     [F("jens_song"), NF("jens_found")], hint="Марта рассказала о колыбельной; проверка Убеждения"),
                 opt("Подойти ближе", [fire("rule_jens_fight")], [NF("jens_found")], hint="будет бой"),
                 opt("Осмотреть мостки", [msg("Здесь Йенс отдал свой медальон Марте. Больше ничего не осталось.")], [F("jens_found")]),
             ]))
    put(item("item_deep_lock", "scenery", "Глубокий шлюз", "Круглая гермодверь с запорными спицами. Из-за неё доносится ровный гул — как дыхание огромного зверя. Нужен ключ-шестерня кочегаров.", 900, False,
             interact_options=[
                 opt("Послушать гул", [sanity(-1), msg("Сквозь металл — удары. Медленные, тяжёлые. Сердце города бьётся совсем рядом.")]),
             ]))
    return E
