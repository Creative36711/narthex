"""Предметы и «пропы» кампании."""

from common import (eff_item, eff_take, eff_msg, eff_need, eff_hp, eff_status,
                    eff_unstatus, eff_set_flag, eff_sanity, eff_fire, eff_codex,
                    eff_craft, eff_recipe, eff_quest, eff_advance, C)


def use(effects, consume=True, message=None):
    u = {"effects": effects, "consume": consume}
    if message:
        u["message"] = message
    return u


def weapon(skill, damage, damage_bonus=True, rng=1, attacks=1, parry=True,
           label=None, durability=None, ammo_item=None):
    w = {"skill": skill, "damage": damage, "damage_bonus": damage_bonus,
         "range": rng, "attacks_per_round": attacks, "parry_capable": parry}
    if label:
        w["label"] = label
    if durability is not None:
        w["durability"] = durability
    if ammo_item:
        w["ammo_item"] = ammo_item
    return w


def item(ident, category, label, description, weight=1.0, stackable=True,
         value=None, on_use=None, on_interact=None, image="", slot_type=None,
         equip_slot=None, weapon_data=None, armor_data=None, sounds=None,
         portrait=None, scene_sprite=None, interact_options=None,
         interactable_when=None, durability=None):
    it = {"id": ident, "type": "item", "category": category, "label": label,
          "description": description, "weight": weight, "stackable": stackable,
          "image": image}
    if slot_type:
        it["slot_type"] = slot_type
    if value:
        it["value"] = value
    if on_use:
        it["on_use"] = on_use
    if on_interact:
        it["on_interact"] = on_interact
    if interact_options is not None:
        it["interact_options"] = interact_options
    if interactable_when is not None:
        it["interactable_when"] = interactable_when
    if weapon_data:
        it["weapon_data"] = weapon_data
    if armor_data:
        it["armor_data"] = armor_data
    if equip_slot:
        it["equip_slot"] = equip_slot
    if sounds:
        it["sounds"] = sounds
    if portrait is not None:
        it["portrait"] = portrait
    if scene_sprite:
        it["scene_sprite"] = scene_sprite
    if durability is not None:
        it["durability"] = durability
    return it


def prop(ident, label, description, options=None, on_interact=None, weight=18.0,
         interactable_when=None, sounds=None, portrait=None):
    return item(ident, "prop", label, description, weight=weight, stackable=False,
                interact_options=options, on_interact=on_interact,
                interactable_when=interactable_when, sounds=sounds or {"open": "sfx_gear"},
                slot_type="prop", portrait=portrait if portrait is not None else {})


MARK = "item_mark"

ITEMS = {}


def add(it):
    ITEMS[it["id"]] = it


# ---------------------------------------------------------------- валюта

add(item(MARK, "currency", "Медная марка",
         "Круглая пластинка с оттиском трубы. Такой расплачиваются в Котле.",
         weight=0.01, value={"mark": 1}, sounds={"pickup": "sfx_coin"}))

# ---------------------------------------------------------------- еда и питьё

add(item("item_stew", "food", "Похлёбка с кореньями",
         "Густой варев из репы, требухи и того, что дал день. Марла варит так, что и не спросишь.",
         weight=0.5, value={"mark": 6},
         on_use=use([eff_need("need_hunger", 35), eff_need("need_warmth", 10)],
                    message="Похлёбка разливается теплом.")))

add(item("item_bread", "food", "Ржаной сухарь",
         "Твёрдый, как кирпич, и держит дольше кирпича.",
         weight=0.3, value={"mark": 2},
         on_use=use([eff_need("need_hunger", 18)], message="Сухарь хрустит и размокает во рту.")))

add(item("item_kvass", "drink", "Квас с окалиной",
         "Тёмный, кислый, с металлическим привкусом. Бодрит, пока не подумаешь, из чего он.",
         weight=0.5, value={"mark": 3},
         on_use=use([eff_need("need_hunger", 8), eff_need("need_nerve", 6)],
                    message="Квас бьёт в нос и прогоняет сон.")))

add(item("item_tea", "drink", "Остывший чай Ржава",
         "Настой из пепельного мха с мёдом. Отец Ржав даёт его тем, кто слышит лишнее.",
         weight=0.4, value={"mark": 5},
         on_use=use([eff_need("need_nerve", 18), eff_unstatus("status_whisper")],
                    message="В ушах становится тихо.")))

add(item("item_mushrooms", "food", "Пепельные грибы",
         "Растут в тёплых отвалах. Есть можно, готовить — лучше.",
         weight=0.2, value={"mark": 1},
         on_use=use([eff_need("need_hunger", 12), eff_hp(-1)],
                    message="Грибы отдают землёй и чуть горчат.")))

# ---------------------------------------------------------------- лекарства

add(item("item_bandage", "medicine", "Бинт из ветоши",
         "Полосы старой рубахи, проваренные и высушенные.",
         weight=0.1, value={"mark": 4},
         on_use=use([eff_hp(5), eff_unstatus("status_bleeding")],
                    message="Тугая повязка останавливает кровь.")))

add(item("item_tonic", "medicine", "Травяной настой",
         "Мутная банка с горьким настоем Клепы: жар, лихорадка, дурнота — всё её.",
         weight=0.4, value={"mark": 14},
         on_use=use([eff_hp(6), eff_unstatus("status_rust_fever")],
                    message="Горечь до слёз, а жар отпускает.")))

add(item("item_bitter_drops", "medicine", "Горькие капли",
         "Тёмная склянка жрецов: глушит шёпот в голове, но и голову делает ватной.",
         weight=0.2, value={"mark": 10},
         on_use=use([eff_unstatus("status_whisper"), eff_need("need_nerve", 12),
                     eff_sanity(5)],
                    message="Капли горчат, шёпот уходит на дно.")))

# ---------------------------------------------------------------- инструменты

add(item("item_wrench", "tool", "Разводной ключ",
         "Тяжёлый ключ с выработкой на гайках. Для труб, клапанов и чужих голов.",
         weight=2.5, value={"mark": 18},
         weapon_data=weapon("melee", "1d6", label="Ключ", durability=6),
         equip_slot="weapon", sounds={"use": "sfx_hammer"},
         on_use=use([eff_craft("recipe_gasket")], consume=False,
                    message="Руки сами ищут гайку.")))

add(item("item_tongs", "tool", "Клещи литейщика",
         "Длинные клещи, которыми достают горячее из печи.",
         weight=1.6, value={"mark": 12}, sounds={"pickup": "sfx_metal_step"}))

add(item("item_lockpicks", "tool", "Отмычки",
         "Набор тонких пластин. Гвоздь продаёт их под прилавком и не спрашивает зачем.",
         weight=0.2, value={"mark": 20}))

add(item("item_lantern", "tool", "Латунная лампа",
         "Лампа с решётчатым боком: горит маслом и светит ровно, пока есть топливо.",
         weight=1.2, value={"mark": 15}, sounds={"use": "sfx_steam"}))

add(item("item_ether_lens", "quest", "Стекло шёпота",
         "Работаная линза из сплава, стекла и капли эфирной крови. Сквозь неё видно, что написано на металле.",
         weight=0.3, value={"mark": 60}, sounds={"use": "sfx_whisper"}))

# ---------------------------------------------------------------- материалы

add(item("item_scrap", "part", "Обрезки латуни",
         "Полоски и стружка из-под резца. В Котле это деньги второго сорта.",
         weight=0.3, value={"mark": 2}, sounds={"pickup": "sfx_gear"}))

add(item("item_cloth", "part", "Ветошь",
         "Чистые тряпки в масле или без. Из них выходят бинты и прокладки.",
         weight=0.2, value={"mark": 1}))

add(item("item_oil", "part", "Скважинное масло",
         "Густая тёмная жидкость по запаху похожая на эфирную кровь, только мёртвая.",
         weight=0.6, value={"mark": 6}, sounds={"use": "sfx_steam"}))

add(item("item_gear", "part", "Шестерня",
         "Ровная шестерня без задиров. Сгодится и в станок, и в обряд.",
         weight=0.4, value={"mark": 8}, sounds={"pickup": "sfx_gear"}))

add(item("item_coal", "part", "Кулек угля",
         "Сухой уголь для печи и для костра.",
         weight=1.0, value={"mark": 3}))

add(item("item_moss", "part", "Пепельный мох",
         "Серо-зелёные пряди с тёплых отвалов. Основа настоев и капель.",
         weight=0.1, value={"mark": 2}))

add(item("item_clean_water", "part", "Чистая вода",
         "Фляга воды из новой водонапорной линии. Пока линия жива — вода есть.",
         weight=1.2, value={"mark": 4}, sounds={"use": "sfx_water"}))

add(item("item_gasket", "part", "Прокладка для клапана",
         "Мятая, но плотная прокладка из ветоши, пропитанной маслом. Ровно на это седло.",
         weight=0.2, value={"mark": 10}))

add(item("item_ether_vial", "quest", "Ампула эфирной крови",
         "Толстое стекло, внутри — тёмное шевелящееся. Слушать долго нельзя.",
         weight=0.3, value={"mark": 40},
         on_use=use([eff_sanity(-6), eff_status("status_under_current")], consume=True,
                    message="Кровь гудят в стекле и гудят в тебе.")))

add(item("item_core_shard", "quest", "Осколок сердечника",
         "Кусок турбинного сердечника: тёплый, с готовыми к работе шёпотными метками.",
         weight=1.4, value={"mark": 80}))

# ---------------------------------------------------------------- оружие и броня

add(item("item_hammer", "weapon", "Молоток литейщика",
         "Короткая рукоять, тяжёлая голова, выщербленный боёк. Держит удар и руку хозяина.",
         weight=1.8, value={"mark": 22},
         weapon_data=weapon("melee", "1d6+1", label="Молоток", durability=8),
         equip_slot="weapon", sounds={"use": "sfx_hammer"}))

add(item("item_pipe", "weapon", "Обрезок трубы",
         "Кусок водовода длиной в руку. Дешёвое решение всех уличных споров.",
         weight=2.2, value={"mark": 5},
         weapon_data=weapon("melee", "1d6", label="Труба", durability=5),
         equip_slot="weapon", sounds={"use": "sfx_hammer"}))

add(item("item_knife", "weapon", "Шило-нож",
         "Тонкое лезвие без рукояти в оплётке из проволоки. Ночная работа контрабандиста.",
         weight=0.5, value={"mark": 16},
         weapon_data=weapon("blades", "1d4+1", label="Шило", durability=6),
         equip_slot="weapon", sounds={"use": "sfx_metal_step"}))

add(item("item_needler", "weapon", "Игольник",
         "Латунная труба с пружиной и магазином под иглы. Стража изымает такие при входе.",
         weight=1.4, value={"mark": 45},
         weapon_data=weapon("pistol", "1d6", rng=3, parry=False, label="Игольник",
                            durability=5, ammo_item="item_needles"),
         equip_slot="weapon", sounds={"use": "sfx_steam"}))

add(item("item_needles", "part", "Пучок игл",
         "Двадцать стальных игл в холщовом чехле.",
         weight=0.2, value={"mark": 8}))

add(item("item_apron", "armor", "Кожаный фартук",
         "Толстая кожа, прожжённая в трёх местах. Держит искры и не только.",
         weight=3.0, value={"mark": 20},
         armor_data={"points": 1, "durability": 10}, equip_slot="armor",
         sounds={"use": "sfx_gear"}))

add(item("item_wire_shirt", "armor", "Проволочная рубаха",
         "Кольца из тонкой латунной проволоки под сукном. Работа стражи.",
         weight=4.0, value={"mark": 38},
         armor_data={"points": 2, "durability": 12}, equip_slot="armor"))

add(item("item_brass_charm", "armor", "Латунный оберег",
         "Пластина с процарапанным пламенем на шнуре. Остывшее Пламя говорит — помогает от шёпота.",
         weight=0.3, value={"mark": 26},
         armor_data={"points": 1}, equip_slot="amulet",
         sounds={"use": "sfx_click"}))

# ---------------------------------------------------------------- сюжетные предметы

add(item("item_ledger", "quest", "Гроссбух Векселя",
         "Тяжёлая книга в кожаных завязках: имена, суммы, даты. Три имени из неё уже никого не встретят дома.",
         weight=2.4, value={"mark": 0}, sounds={"pickup": "sfx_paper"}))

add(item("item_brass_token", "quest", "Латунный жетон",
         "Пропуск подмастерья: круглая пластина с выбитой шестерёнкой. Ночью его показывают вместо лица.",
         weight=0.1, value={"mark": 0}))

add(item("item_letter_klein", "quest", "Письмо Кляйна",
         "Страницы, выдранные из журнала: почерк ровный, будто писали не рукой, а станком.",
         weight=0.2, value={"mark": 0}, sounds={"pickup": "sfx_paper"}))

add(item("item_tin_doll", "quest", "Кукла-шестерёнка",
         "Игрушка из двух шестерёнок и гайки: одна вертится, когда крутишь другую.",
         weight=0.4, value={"mark": 0}, sounds={"pickup": "sfx_gear"}))

add(item("item_board_order", "quest", "Приказ Курии",
         "Бумага с печатью Литаой Курии: предписано считать смерти угарными и дел не заводить.",
         weight=0.1, value={"mark": 0}, sounds={"pickup": "sfx_paper"}))

add(item("item_writ_pass", "quest", "Пропуск стражи",
         "Мятая бумага с подписью Пепел: выход за Пепельные ворота разрешён до рассвета.",
         weight=0.1, value={"mark": 0}, sounds={"pickup": "sfx_paper"}))

# ---------------------------------------------------------------- пропы сцены

add(prop("item_body_1", "Тело в литейной",
         "Мужчина лет сорока, лицом в шлак. Ни крови, ни масла: только две латунные искры в позвонках.",
         options=[
             {"label": "Осмотреть тело", "effects": [
                 eff_msg("Сера стоит над телом и ждёт."),
                 eff_set_flag("body_examined")],
              "message": "На спине — две латунные вставки между позвонками, аккуратные, как заклёпки.",
              "hint": "дело Цеха"},
             {"label": "Вынуть латунь", "conditions": [C.flag("body_examined")], "once": True,
              "effects": [eff_item("item_scrap"), eff_set_flag("brass_found"),
                          eff_codex("codex_brass"),
                          eff_msg("Кусок латуни ложится в карман — тёплый, будто живой.")],
              "message": "Латунь выходит из тела мягко, как гвоздь из гнилой доски."},
             {"label": "Осмотреть крепления", "conditions": [C.skill("investigate", 45)],
              "effects": [eff_msg("Тонкая гравировка: три черты и точка. Так метит только один человек — тот, кого нет.")],
              "message": "Метка Мастера. Двенадцать лет как мёртвого."},
         ]))

add(prop("item_locker", "Служебный шкаф",
         "Железный шкаф бригадира. Замок простой, но чужой."))

add(prop("item_furnace_forge", "Горн литейной",
         "Открытый горн с застывшей коркой на устье. Жар от него идёт даже в холод.",
         options=[
             {"label": "Раздуть горн", "effects": [eff_need("need_warmth", 25)],
              "message": "Рядом с горном отогреваешь руки.", "once": False},
             {"label": "Открыть изготовление", "effects": [eff_craft()],
              "message": "У горна есть всё, чтобы поработать руками."},
         ]))

add(item("item_brass_sliver", "quest", "Кусок эфирной латуни",
         "Тёплая пластина, снятая с позвонка. Металл медленно растёт, если держать его в темноте.",
         weight=0.3, value={"mark": 35},
         on_use=use([eff_sanity(-2), eff_msg("Латунь в ладони чуть заметно теплеет — будто отвечает.")],
                    consume=False)))

add(item("item_herbs", "food", "Пучок полынной травы",
         "Горькая трава с верхних ярусов. Годится и в отвар, и в припарку.",
         weight=0.4, value={"mark": 4},
         on_use=use([eff_need("need_hunger", 4), eff_need("need_nerve", 3)],
                    message="Трава горчит, но в голове проясняется.")))

add(item("item_sweet", "food", "Карамельный леденец",
         "Редкая роскошь: сахар в Котле дороже меди.",
         weight=0.1, value={"mark": 6},
         on_use=use([eff_need("need_warmth", 5)], message="Во рту становится тепло и сладко.")))

add(item("item_promissory", "quest", "Расписка Курии",
         "Бумага на три сотни марок с гербовой печатью. Курс в слободе — вопрос разговора.",
         weight=0.1, value={"mark": 200}))

add(prop("item_hearth", "Очаг корчмы",
         "Сложенный из битого кирпича очаг. Марла держит в нём жар круглые сутки — за это в Котле её и терпят.",
         options=[
             {"label": "Погреться", "once": False,
              "effects": [eff_need("need_warmth", 20)],
              "message": "От очага идёт ровное тепло, и на минуту перестаёт тянуть холодом от труб."},
             {"label": "Посмотреть на огонь", "once": False,
              "effects": [eff_need("need_nerve", 5)],
              "message": "Огонь ровный. В Котле мало что бывает ровным."},
         ]))

add(prop("item_bed", "Койка в комнате",
         "Узкая койка с шерстяным одеялом, пропахшим дымом. За марку Марла пускает сюда до рассвета.",
         options=[
             {"label": "Лечь спать", "once": False,
              "effects": [eff_msg("Сон в Котле — короткий и чуткий.")],
              "message": "Одеяло колется, но греет."},
         ]))

add(prop("item_washstand", "Умывальник",
         "Медный таз и кувшин с водой. Вода отдаёт железом, как и всё, что течёт по верхним трубам.",
         options=[
             {"label": "Умыться", "once": False,
              "effects": [eff_need("need_nerve", 4), eff_msg("Вода стылая, но голова проясняется.")],
              "message": "Смываешь с лица копоть и половину усталости."},
         ]))

add(prop("item_dump_tunnels", "Завал в трубе",
         "Обвал породы и ржавых труб: кто-то расчищал его вручную, снизу вверх.",
         options=[
             {"label": "Разобрать завал", "once": True,
              "conditions": [C.stat("STR", 11)],
              "effects": [eff_item("item_scrap"), eff_msg("Из-под завала тянет тёплым воздухом: за ним пустота.")],
              "message": "Камни расходятся, и вниз уходит узкий лаз."},
             {"label": "Прислушаться", "once": False,
              "effects": [eff_sanity(-3), eff_msg("Из-под завала доносится ровный счёт: «первый, второй, третий».")],
              "message": "Счёт идёт снизу, медленный и очень спокойный."},
         ]))

add(prop("item_grating", "Решётка стока",
         "Чугунная решётка в пол, из-под неё тянет угаром и тёплым дыханием труб.",
         options=[
             {"label": "Осмотреть решётку", "effects": [
                 eff_msg("Прутья отогнуты: кто-то ходит тут вниз и обратно.")],
              "message": "Между прутьями — свежие царапины от сапог."},
             {"label": "Отжать прутья", "conditions": [C.stat("STR", 12)], "once": True,
              "effects": [eff_set_flag("drain_open"), eff_codex("codex_drains")],
              "message": "Прутья поддаются со стоном."},
         ]))

add(prop("item_dump_market", "Отвал шлака",
         "Тёплая куча шлака, в которой копаются и люди, и крысы.",
         options=[
             {"label": "Порыться в шлаке", "once": False,
              "conditions": [C.chance(0.75)],
              "effects": [eff_item("item_scrap"), eff_msg("В шлаке блеснула латунь.")],
              "message": "Латунная стружка, кусок ветоши."},
             {"label": "Порыться ещё раз", "conditions": [C.skill("perceive", 40)],
              "effects": [eff_item("item_gear", 1)],
              "message": "Под шлаком — целая шестерня, кто-то выбросил дорогую вещь."},
         ]))

add(prop("item_board_passcourt", "Доска объявлений",
         "Доска стражи: указы, списки дезертиров и приказ, который лучше не читать вслух.",
         options=[
             {"label": "Прочитать приказ Курии",
              "effects": [eff_item("item_board_order"), eff_codex("codex_curia"),
                          eff_msg("Приказ: смерти считать угарными, дел не заводить.")],
              "message": "Печать Курии, число позавчерашнее."},
             {"label": "Прочитать списки",
              "effects": [eff_msg("Три имени вычеркнуты, четвёртое — свежее.")],
              "message": "Пропавшие без вести: двое литейщиков, трубочист, часовщик."},
         ]))

add(prop("item_board_market", "Рыночная доска",
         "Кусок жести, где мелом пишут цены и долги.",
         options=[
             {"label": "Прочитать цены",
              "effects": [eff_msg("Хлеб — два, похлёбка — шесть, вода — четыре. С карантина дороже.")],
              "message": "Кто-то приписал снизу: «за ворота не ходить»."},
         ]))

add(prop("item_safe_veksel", "Сейф Векселя",
         "Пристенный сейф с погнутой дверцей — но замок держит.",
         options=[
             {"label": "Вскрыть отмычками",
              "conditions": [C.item("item_lockpicks")],
              "effects": [{"type": "skill_check_gate", "skill": "lockpick", "difficulty": 50,
                           "success_effects": [eff_item("item_ledger"),
                                               eff_set_flag("ledger_taken"),
                                               eff_msg("Гроссбух выходит из сейфа туго, как зуб.")],
                           "fail_effects": [eff_msg("Замок щёлкнул и не поддался. Вексель услышал.")]}],
              "message": "Работа для тонких рук."},
             {"label": "Спросить Векселя о книге",
              "conditions": [C.flag("ledger_known")],
              "effects": [eff_fire("rule_veksel_ledger_talk")],
              "message": "Разговор иногда короче отмычек."},
         ]))

add(prop("item_lathe", "Токарный станок",
         "Станок с ножным приводом: резец, патрон, стружка под ногами.",
         options=[
             {"label": "Поработать за станком",
              "effects": [eff_craft()],
              "message": "На станке можно выточить что угодно — были бы детали."},
             {"label": "Осмотреть патрон",
              "conditions": [C.skill("mechanics", 35)],
              "effects": [eff_msg("В патроне зажата заготовка из эфирной стали. Такая не для часов.")],
              "message": "Металл с метками шёпота."},
         ]))

add(prop("item_stove_barrack", "Печь барака",
         "Большая печь карантина: труба снята, вьюшка сорвана, дымоход забит сажей.",
         options=[
             {"label": "Починить печь",
              "conditions": [C.item("item_wrench"), C.skill("mechanics", 35)],
              "effects": [eff_set_flag("furnace_fixed"), eff_fire("rule_barrack_warm"),
                          eff_msg("Вьюшка встаёт на место, тяга оживает.")],
              "message": "Печь дышит, как человек после бега."},
             {"label": "Починить грубо",
              "conditions": [C.skill("mechanics", 20)],
              "effects": [eff_msg("Пока держится, но вьюшку придётся менять.")],
              "message": "Тяга есть, но вьюшка ходит ходуном."},
         ]))

add(prop("item_bunks", "Койки карантина",
         "Шесть коек, на пяти — люди. Пахнет потом, мхом и ржавой лихорадкой.",
         options=[
             {"label": "Помочь больному", "conditions": [C.skill("first_aid", 35)],
              "effects": [eff_need("need_nerve", -4),
                          eff_msg("Женщина на третьей койке благодарно кивает.")],
              "message": "Жар у неё спадает к утру."},
             {"label": "Забрать пустую банку",
              "effects": [eff_item("item_clean_water", 1)],
              "message": "На подоконнике стоит нетронутая фляга."},
         ]))

add(prop("item_altar", "Алтарь Остывшего Пламени",
         "Плита с вырезанным пламенем и медная чаша, полная остывшего шлака.",
         options=[
             {"label": "Провести обряд гашения",
              "conditions": [C.flag("cold_flame_rite"), C.item("item_ether_vial")],
              "effects": [eff_take("item_ether_vial"), eff_sanity(10),
                          eff_need("need_nerve", 20), eff_set_flag("rite_done"),
                          eff_codex("codex_rite"),
                          eff_msg("Шлак в чаше темнеет, шёпот отходит от стен.")],
              "message": "Пламя остывает, а с ним — голоса."},
             {"label": "Коснуться плиты", "once": False,
              "effects": [eff_need("need_nerve", 6)],
              "message": "Камень тёплый, как остывающая сковорода."},
         ]))

add(prop("item_crypt_shelf", "Полка крипты",
         "Стеллаж со старыми механизмами: сердца насосов, отлитые поршни, что-то в масле.",
         options=[
             {"label": "Разобрать полку",
              "effects": [eff_item("item_gear", 2), eff_item("item_scrap", 2)],
              "message": "Шестерни, стружка, кусок доброй стали."},
             {"label": "Найти журнал",
              "conditions": [C.skill("investigate", 40)],
              "effects": [eff_item("item_letter_klein"), eff_set_flag("klein_letter"),
                          eff_codex("codex_klein")],
              "message": "В переплёте — страницы чужого журнала."},
             {"label": "Вскрыть нишу с ампулами", "once": True,
              "effects": [eff_item("item_ether_vial"), eff_set_flag("vial_taken"),
                          eff_codex("codex_ether"),
                          eff_msg("За полкой — ниша, а в ней ампула эфирной крови: холодная, тяжёлая, чужая.")],
              "message": "Ампула из тёмного стекла; масло на горлышке ещё не высохло."},
         ]))

add(prop("item_hatch_deep", "Глубинный люк",
         "Люк под алтарём: круг из латуни с шестью лучами и следами женских пальцев на масле.",
         options=[
             {"label": "Открыть Стеклом шёпота",
              "conditions": [C.flag("lens_built"), C.item("item_ether_lens")],
              "effects": [eff_set_flag("deep_gate_open"),
                          {"type": "reveal_location", "location": "loc_deeps"},
                          eff_codex("codex_deep"),
                          eff_msg("Метки складываются в слова: «вниз».")],
              "message": "Люк поворачивается без скрипа."},
             {"label": "Ломать ломиком",
              "conditions": [C.skill("mechanics", 60)],
              "effects": [eff_set_flag("deep_gate_open"), eff_status("status_bleeding"),
                          {"type": "reveal_location", "location": "loc_deeps"},
                          eff_msg("Люк сдаётся, но руки в крови.")],
              "message": "Грубо, зато быстро."},
         ]))

add(prop("item_valve_tower", "Клапан башни",
         "Латунный клапан на седле, из-под гайки сочится вода. Прокладка выкрошилась в труху.",
         options=[
             {"label": "Заменить прокладку",
              "conditions": [C.item("item_gasket")],
              "effects": [{"type": "skill_check_gate", "skill": "mechanics", "difficulty": 40,
                           "success_effects": [eff_take("item_gasket"),
                                               eff_set_flag("valve_repaired"),
                                               eff_fire("rule_water_restored")],
                           "fail_effects": [eff_msg("Прокладка встала криво, вода бьёт в лицо."),
                                            eff_status("status_scalded")]}],
              "message": "Седло ждёт плотной прокладки."},
             {"label": "Сделать прокладку здесь же",
              "effects": [eff_craft("recipe_gasket")],
              "message": "Веток и масла рядом хватает."},
         ]))

add(prop("item_pipe_hole", "Пробитая труба",
         "В трубе дыра с кулак, из неё тянет тёплым и слышно, как внизу что-то шевелится.",
         options=[
             {"label": "Заткнуть ветошью",
              "conditions": [C.item("item_cloth", 2)],
              "effects": [eff_take("item_cloth", 2), eff_msg("Дыра забита, гул стих.")],
              "message": "Сквозь щели больше не тянет."},
             {"label": "Прислушаться", "once": True,
              "effects": [eff_set_flag("whisper_heard"), eff_status("status_whisper"),
                          eff_codex("codex_ether")],
              "message": "Голосов много. Один из них называет имя героя."},
             {"label": "Соскрести мох с трубы", "once": True,
              "effects": [eff_item("item_moss", 3), eff_msg("Полынный мох на тёплой трубе — как раз на отвар.")],
              "message": "Мох отходит пластами, тёплый и пахнет железом."},
             {"label": "Осмотреть потёки на трубе", "once": True,
              "effects": [eff_set_flag("blood_trail_known"), eff_msg("След ведёт к лазу за трубой: там кто-то прятался, и недавно.")],
              "message": "Кровь свежая. Кто-то продирался здесь в спешке."},
         ]))

add(prop("item_wreck_cart", "Разбитая арба",
         "Перевёрнутая арба караванщиков: полог сорван, спицы перебиты, груз растащен.",
         options=[
             {"label": "Обыскать арбу",
              "effects": [eff_item("item_bread", 2), eff_item("item_cloth", 2),
                          eff_item("item_coal", 1)],
              "message": "Сухари, тряпки, кулёк угля."},
             {"label": "Осмотреть следы", "conditions": [C.skill("investigate", 40)],
              "effects": [eff_msg("Следы босых ног идут не к городу, а к трубе. И их слишком много.")],
              "message": "Так не ходят живые."},
         ]))

add(prop("item_campfire", "Костровище",
         "Старое костровище в укрытии из шлака: кто-то ставил тут лагерь до тебя.",
         options=[
             {"label": "Развести лагерь",
              "effects": [eff_need("need_warmth", 30), eff_need("need_rest", 20),
                          eff_msg("Огонь держит пепел в стороне.")],
              "message": "Тепло, тихо, на час можно забыть про город."},
         ]))

add(prop("item_console_deep", "Пульт зала",
         "Пульт с шестью рычагами и мёртвой стрелкой давления. Рычаги ходят с трудом.",
         options=[
             {"label": "Разогнать турбину",
              "conditions": [C.item("item_core_shard")],
              "effects": [eff_fire("rule_turbine_surge")],
              "message": "Стрелка прыгает вверх, где-то внизу ревёт вода."},
             {"label": "Сбросить пар в квартал",
              "conditions": [C.flag("city_evacuated")],
              "effects": [eff_fire("rule_steam_vent_city")],
              "message": "Пар уходит в отводы, квартал пуст."},
         ]))

add(prop("item_ark_plans", "Чертежи Кляйна",
         "Толстая папка чертежей на стене машинного зала: турбина, позвонок, человек. Всё сходится.",
         options=[
             {"label": "Изучить чертежи",
              "effects": [eff_codex("codex_mother"), eff_set_flag("mother_met"),
                          eff_sanity(-4),
                          eff_msg("Кляйн не убивал людей. Он их записывал.")],
              "message": "На последнем листе — пустая рама под будущий «он»."},
         ]))
