"""Метаданные кампании: campaign.json."""

import os

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(HERE)

CAMPAIGN_ID = "64a30c0e-3767-4412-9a09-326c69805f6f"


def zz(volume=1, rnd=0, freq=440, attack=0.01, sustain=0.05, decay=0.2, wave=0,
       shape_curve=0, slide=0, delta_slide=0, pitch_jump=0, pitch_jump_time=0,
       repeat_time=0, noise=0, modulation=0, bit_crush=0, delay=0, sustain_volume=0,
       decay_curve=0, clipping=0):
    return [volume, rnd, freq, attack, sustain, decay, wave, shape_curve, slide,
            delta_slide, pitch_jump, pitch_jump_time, repeat_time, noise, modulation,
            bit_crush, delay, sustain_volume, decay_curve, clipping]


def design_doc():
    with open(os.path.join(HERE, "design_doc.md"), encoding="utf-8") as f:
        return f.read().strip()


SKILL_CATEGORIES = [
    {"id": "cat_combat", "label": "Бой"},
    {"id": "cat_social", "label": "Общение"},
    {"id": "cat_knowledge", "label": "Знания"},
    {"id": "cat_craft", "label": "Ремесло и выживание"},
]

SKILLS = [
    {"id": "spot", "label": "Наблюдение", "category": "cat_knowledge"},
    {"id": "search", "label": "Обыск", "category": "cat_knowledge"},
    {"id": "persuade", "label": "Убеждение", "category": "cat_social"},
    {"id": "pressure", "label": "Давление", "category": "cat_social"},
    {"id": "bargain", "label": "Торговля", "category": "cat_social"},
    {"id": "stealth", "label": "Скрытность", "category": "cat_craft"},
    {"id": "dodge", "label": "Уклонение", "category": "cat_combat"},
    {"id": "brawl", "label": "Кулачный бой", "category": "cat_combat"},
    {"id": "melee", "label": "Ближний бой", "category": "cat_combat"},
    {"id": "crossbow", "label": "Арбалет", "category": "cat_combat"},
    {"id": "repair", "label": "Ремонт", "category": "cat_craft"},
    {"id": "first_aid", "label": "Медицина", "category": "cat_craft"},
    {"id": "lockpick", "label": "Взлом", "category": "cat_craft"},
    {"id": "tech_lore", "label": "Механизмы", "category": "cat_knowledge"},
    {"id": "survival", "label": "Выживание", "category": "cat_craft"},
    {"id": "whisper", "label": "Шёпот", "category": "cat_knowledge"},
]

ITEM_CATEGORIES = [
    {"id": "food", "label": "Еда", "restores_needs": ["need_food"],
     "sounds": {"use": "sfx_eat"}},
    {"id": "drink", "label": "Питьё", "restores_needs": ["need_water"],
     "sounds": {"use": "sfx_drink"}},
    {"id": "medicine", "label": "Лекарства", "restores_hp": True,
     "sounds": {"use": "sfx_drink"}},
    {"id": "weapon", "label": "Оружие", "is_weapon": True,
     "sounds": {"use": "sfx_metal"}},
    {"id": "armor", "label": "Броня и одежда", "is_armor": True,
     "sounds": {"use": "sfx_cloth"}},
    {"id": "tool", "label": "Инструмент", "sounds": {"use": "sfx_metal"}},
    {"id": "material", "label": "Материалы", "sounds": {"pickup": "sfx_metal"}},
    {"id": "evidence", "label": "Улики", "sounds": {"pickup": "sfx_paper"}},
    {"id": "currency", "label": "Валюта", "sounds": {"pickup": "sfx_coin"}},
    {"id": "container", "label": "Контейнер", "sounds": {"open": "sfx_door"}},
    {"id": "misc", "label": "Разное", "sounds": {"pickup": "sfx_pickup"}},
]

SLOT_TYPES = [
    {"id": "person", "label": "Человек", "sounds": {"talk": "sfx_talk"}},
    {"id": "prop", "label": "Объект", "sounds": {"talk": "sfx_gear"}},
    {"id": "item", "label": "Предмет", "sounds": {"pickup": "sfx_pickup"}},
    {"id": "container", "label": "Контейнер", "sounds": {"open": "sfx_door"}},
    {"id": "animal", "label": "Тварь", "sounds": {"talk": "sfx_growl"}},
]

EQUIPMENT_SLOTS = [
    {"id": "weapon", "label": "Оружие"},
    {"id": "armor", "label": "Одежда и броня"},
    {"id": "mask", "label": "Маска"},
    {"id": "boots", "label": "Обувь"},
]

FACTIONS = [
    {"id": "faction_watch", "label": "Надзор", "base_disposition": 5,
     "description": "Городской надзор: порядок, протоколы и страх перед начальством."},
    {"id": "faction_guild", "label": "Цех", "base_disposition": 0,
     "description": "Союз мастеровых и инженеров. Держит машины, а значит — город."},
    {"id": "faction_undercity", "label": "Нижние", "base_disposition": -10,
     "description": "Жители нижних ярусов: зольники, скупщики, подростки без имени."},
    {"id": "faction_conductors", "label": "Проводники", "base_disposition": -15,
     "description": "Те, кто слышит ток в жилах Сердца. Цех называет это ересью, нижние — надеждой."},
]

EMOTIONS = [
    {"id": "neutral", "label": "Обычный"},
    {"id": "angry", "label": "Зол"},
    {"id": "afraid", "label": "Испуган"},
    {"id": "sad", "label": "Печален"},
    {"id": "calm", "label": "Спокоен"},
]

WEATHERS = [
    {"id": "weather_ashfall", "label": "Пеплопад", "overlay": "ash",
     "ambient": ["sfx_wind"]},
    {"id": "weather_fog", "label": "Мокрый туман", "overlay": "fog",
     "ambient": ["sfx_drip"]},
]

OVERLAY_LAYERS = [
    {"id": "ash", "label": "Пепел"},
    {"id": "fog", "label": "Туман"},
    {"id": "rain", "label": "Дождь"},
    {"id": "snow", "label": "Снег"},
    {"id": "steam", "label": "Пар"},
]

CODEX_CATEGORIES = [
    {"id": "creatures", "label": "Существа"},
    {"id": "places", "label": "Места"},
    {"id": "chronicles", "label": "Хроники"},
    {"id": "machines", "label": "Машины"},
]

STATUSUSES = [
    {"id": "status_ash_lung", "label": "Пепельная хрипота", "short_label": "Хрипота",
     "description": "Пепел осел в лёгких: каждый вдох даётся с хрипом.",
     "scope": "world", "duration": 24, "dot": {"hp": 1},
     "skill_mods": [{"skill": "survival", "delta": -10}, {"skill": "spot", "delta": -5}],
     "apply_message": "Грудь горит: фильтр не держит, пепел прошёл внутрь.",
     "expire_message": "Дышать стало легче."},
    {"id": "status_cold", "label": "Остывание", "short_label": "Остывание",
     "description": "Тело не держит тепло: пальцы не слушаются.",
     "scope": "world", "duration": 18, "dot": {"hp": 1},
     "skill_mods": [{"skill": "dodge", "delta": -10}],
     "apply_message": "Холод забирается под одежду."},
    {"id": "status_dry", "label": "Сухая кровь", "short_label": "Жажда",
     "description": "Воды не хватает: в глазах рябит, внимание плывёт.",
     "scope": "world", "duration": 12, "dot": {"hp": 1},
     "skill_mods": [{"skill": "spot", "delta": -10}],
     "apply_message": "Горло сухое, язык не ворочается."},
    {"id": "status_hunger", "label": "Голодная слабость", "short_label": "Голод",
     "description": "Руки дрожат от голода, удар вышел слабым.",
     "scope": "world", "duration": 24,
     "skill_mods": [{"skill": "brawl", "delta": -10}, {"skill": "melee", "delta": -10}],
     "apply_message": "Желудок сводит от голода."},
    {"id": "status_steam_burn", "label": "Ожог паром", "short_label": "Ожог",
     "description": "Кожа под одеждой красная и мокрая на ощупь.",
     "scope": "combat", "duration": 3, "dot": {"hp": 2},
     "apply_message": "Струя пара обожгла плечо!"},
    {"id": "status_whisper", "label": "Шёпот в голове", "short_label": "Шёпот",
     "description": "Ток в жилах шепчет чужим голосом, сосредоточиться трудно.",
     "scope": "world", "duration": 20,
     "skill_mods": [{"skill": "spot", "delta": -5}, {"skill": "persuade", "delta": -5}],
     "apply_message": "В голове зашевелились чужие слова."},
    {"id": "status_wired", "label": "Заведённый", "short_label": "Заведён",
     "description": "Горячий настой прогнал сон: руки работают точнее.",
     "scope": "world", "duration": 6,
     "skill_mods": [{"skill": "repair", "delta": 10}],
     "apply_message": "Тепло разлилось по рукам."},
]

ABILITIES = [
    {"id": "ability_steam_vent", "label": "Паровой выброс",
     "description": "Автомат выпускает струю перегретого пара.",
     "mp_cost": 0, "cooldown_rounds": 3, "range": 2, "skill": "crossbow",
     "kind": "damage", "damage": "1d8"},
    {"id": "ability_ash_breath", "label": "Пепельный выдох",
     "description": "Тварь выдыхает клубы пепла прямо в лицо.",
     "mp_cost": 0, "cooldown_rounds": 4, "range": 1, "skill": "brawl",
     "kind": "status", "status": "status_ash_lung", "status_duration": 3},
    {"id": "ability_wire_whip", "label": "Проволочный хлыст",
     "description": "Болтник бьёт обмотанным проволокой ломом — больно и цепко.",
     "mp_cost": 0, "cooldown_rounds": 2, "range": 1, "skill": "melee",
     "kind": "damage", "damage": "1d8"},
    {"id": "ability_mirror_gaze", "label": "Зеркальный взгляд",
     "description": "В отполированном лице отражается не комната, а ты.",
     "mp_cost": 0, "cooldown_rounds": 4, "range": 2, "skill": "whisper",
     "kind": "status", "status": "status_whisper", "status_duration": 4},
]

NEEDS = [
    {"id": "need_food", "label": "Еда", "short_label": "Еда",
     "description": "Сухой паёк и горячая похлёбка держат человека на ногах.",
     "max": 100, "decay_per_tick": 1.0, "critical_threshold": 20,
     "on_zero_effect": "rule_need_food_zero"},
    {"id": "need_water", "label": "Вода", "short_label": "Вода",
     "description": "Чистая вода из цистерны; в трубах она на вкус ржавая.",
     "max": 100, "decay_per_tick": 1.2, "critical_threshold": 20,
     "on_zero_effect": "rule_need_water_zero"},
    {"id": "need_warmth", "label": "Тепло", "short_label": "Тепло",
     "description": "Ночью и в сырых трубах город вытягивает тепло быстро.",
     "max": 100, "decay_per_tick": 0.9, "critical_threshold": 25,
     "decay_when": [
         {"type": "time_of_day", "values": ["evening", "night"]},
         {"type": "in_location", "locations": ["loc_watch", "loc_copper_row", "loc_foundry"], "not": True},
         {"type": "equipped", "items": ["item_coat"], "not": True},
     ],
     "restore_per_tick": 7,
     "restore_when": [
         {"type": "in_location", "locations": ["loc_watch", "loc_copper_row", "loc_foundry"]},
     ],
     "on_zero_effect": "rule_need_warmth_zero"},
    {"id": "need_breath", "label": "Воздух", "short_label": "Воздух",
     "description": "Без маски в нижних ярусах пепел забивает лёгкие за час.",
     "max": 100, "decay_per_tick": 1.6, "critical_threshold": 25,
     "decay_when": [
         {"type": "in_location", "locations": ["loc_underpipes", "loc_ash_yard", "loc_shaft", "loc_core"]},
         {"type": "equipped", "items": ["item_respirator"], "not": True},
     ],
     "restore_per_tick": 9,
     "restore_when": [
         {"type": "in_location", "locations": ["loc_watch", "loc_copper_row", "loc_cistern"]},
     ],
     "on_zero_effect": "rule_need_breath_zero"},
]

CURRENCIES = [
    {"id": "mark", "label": "Марка", "symbol": "мк", "item_id": "item_mark"},
]

WEALTH_LEVELS = ["Нищий", "Бедный", "Свободный", "Зажиточный", "Знатный"]

CRIMES = [
    {"id": "crime_bribe", "label": "Подкуп должностного лица"},
    {"id": "crime_search", "label": "Обыск без ордера"},
    {"id": "crime_theft", "label": "Кража имущества Цехa"},
]

PRICE_EVENTS = [
    {"id": "price_blockade", "label": "Перекрытые поставки", "multiplier": 1.4,
     "categories": ["food", "drink", "medicine"]},
]

FLAGS = [
    ("case_opened", "Дело принято", "Пролог завершён: Строй отдал дело дознавателю. Читается в диалогах Строя и в правилах журнала."),
    ("intro_seen", "Вступление показано", "Стартовая катсцена отыграна правилом пролога (один раз за забег)."),
    ("body_examined", "Тело осмотрено", "Тело Эрдала Вета осмотрено в смотровой; открывает улику «медная стружка»."),
    ("clue_shavings", "Улика: медная стружка", "Стружка с груди убитого. Читается в разговоре с Карной и Эрой."),
    ("clue_token", "Улика: жетон бригады", "Жетон участника Спуска с места находки. Открывает реплики Гриста и Эры."),
    ("clue_shard", "Улика: зеркальный скол", "Скол зеркальной маски. Читается в мастерской Карны и в Поддоне."),
    ("clues_done", "Улики собраны", "Все три улики в деле; правило продвигает сюжетный квест и даёт запись в журнале."),
    ("kid_talked", "Щепка опрошен", "Подросток рассказал, что видел у решётки. Открывает побочное дело с лекарством."),
    ("kid_joined", "Щепка в отряде", "Подросток пошёл с героем; даёт сцепленные проверки и реплики в шахте."),
    ("medicine_given", "Лекарство доставлено", "Настойка для Миры передана: сестра вне опасности, Щепка благодарен."),
    ("mira_lost", "Мира не дождалась", "Герой не принёс лекарство вовремя; Щепка уходит со свалки."),
    ("era_met", "Разговор с Эрой", "Старая проводница объяснила, как убийца ходит по жилам Сердца."),
    ("era_token_given", "Жетон отдан Эре", "Эра прочитала жетон; открыта запись кодекса о Спуске."),
    ("crew_list_found", "Список бригады найден", "Имена участников Спуска получены; снимает дедлайн второго убийства."),
    ("karna_lens", "Линза возвращена", "Карна получила обточенную линзу мужа: доверяет, отдаёт журнал без взятки."),
    ("karna_hostile", "Карна замкнулась", "Вдова отказалась говорить; путь к журналу — только через обыск."),
    ("grist_talked", "Грист допрошен", "Литейщик назвал имена; открывает контору Верго."),
    ("grist_dead", "Грист убит", "Второе убийство по дедлайну: сцена литейного зала меняет состояние, показания потеряны."),
    ("vergo_bribed", "Верго взял марки", "Писарь выдал бумаги за взятку; альтернатива обыску."),
    ("vergo_searched", "Ящик Верго обыскан", "Обыск конторы без ордера: улика взята, записано преступление."),
    ("volt_deal", "Сделка с Вольтом", "Скупщик показал, кому сбывал сердца; открывает ключ шлюза."),
    ("volt_arrested", "Вольт сдан Надзору", "Скупщик арестован: Надзор доволен, нижние ярусы — нет."),
    ("shaft_key", "Ключ шлюза", "Ключ от шлюза шахты получен у Вольта или в цистерне."),
    ("shaft_revealed", "Шахта на карте", "Локация шахты открыта правилом после списка бригады."),
    ("shaft_open", "Шлюз открыт", "Шлюз шахты отперт ключом; открыт путь вниз."),
    ("descent_started", "Спуск начат", "Герой вошёл в шахту; снимает дедлайн третьего убийства."),
    ("valves_fixed", "Вентили выставлены", "Вентильный ярус настроен: проход к Сердцу открыт, кодекс пополнен."),
    ("core_entered", "Зал Сердца", "Герой спустился в Поддон: играется катсцена и финальная сцена."),
    ("ilaria_met", "Разговор с Иларией", "Разговор в зале Сердца состоялся; открывает выбор финала."),
    ("ilaria_dead", "Илария убита", "Убийца убита в Поддоне; ведёт к концовке «Зола»."),
    ("ilaria_arrested", "Илария выдана Надзору", "Убийца жива и отдана под суд; ведёт к концовке «Приговор»."),
    ("joined_ilaria", "Сердце запущено", "Герой помог Иларии; ведёт к концовке «Ток»."),
    ("sealed", "Сердце запечатано", "Герой заглушил Сердце; ведёт к концовке «Печать»."),
    ("fled_city", "Герой ушёл из города", "Герой отказался от дела и ушёл; ведёт к концовке «Чужой приговор»."),
    ("killer_escaped", "Убийца ушла", "Дедлайн третьего убийства прошёл: Илария ушла из города, дело списывают."),
    ("wrong_verdict", "Чужой приговор", "Дело закрыто на Вольте; ведёт к концовке «Чужой приговор»."),
    ("ashfall_on", "Пеплопад", "Стоит пеплопад; правило погоды пишет флаг, музыка и потребности читают его."),
    ("blockade_on", "Поставки перекрыты", "Ценовое событие включено после второго убийства: еда и вода дороже."),
    ("watch_warned", "Строй предупредил", "Капитан озвучил срок; включается мягкий дедлайн второго убийства."),
    ("codex_started", "Кодекс открыт", "Открыта первая запись кодекса; счётчик для квеста коллекционера."),
    ("case_closed", "Дело закрыто", "Герой выбрал «уйти и закрыть дело» в Поддоне; правило финала завершает забег."),
    ("beasts_seen", "Свалка встретила", "Первый вход на зольную свалку: открыта запись о пепельных псах."),
    ("automaton_seen", "Автомат замечен", "Первый вход в литейный пролёт: открыта запись о сторожевом автомате."),
    ("core_known", "Поддон известен", "Поддон открыт на карте после начала спуска (правило перед финалом)."),
    ("codex_heart", "Запись о Сердце", "Открыта запись кодекса о Сердце; закрывает квест коллекционера."),
    ("stroy_money", "Марки на расходы", "Строй выдал хозяйственные марки один раз; повторный запрос закрыт флагом."),
    ("karna_talked", "Разговор о муже", "Карна рассказала о последнем месяце мужа; открывает вопросы о журнале."),
    ("karna_hostile_clear", "Карна отошла", "Извинение после давления: вдова снова разговаривает."),
    ("medicine_asked", "Спрошено о лекарстве", "Щепка или Мира назвали цену настойки; запускает побочное дело."),
    ("mira_voice", "Голос в коридоре", "Мира рассказала, что слышала женский голос и счёт «семь»."),
    ("moth_scared", "Щепка напуган описанием", "Подросток дал подробное описание маски; усиливает тему зеркальных."),
    ("grist_warned", "Грист предупреждён", "Герой предупредил Гриста по списку бригады; снимает часть вины в финале."),
    ("grist_closed", "Грист замолчал", "Допрос провален по таймеру: Грист не назвал имён."),
    ("chase_done", "Погоня начата", "Сцена с погоней по дымовому ярусу отыграна один раз."),
    ("vergo_looked_away", "Верго отвернулся", "Писарь «вышел проверить коридор»: шкаф можно обыскать без свидетеля."),
    ("hawker_mask", "Аглая видела маску", "Торговка подтвердила, что человек в маске ходит по рынку."),
    ("ilaria_offer", "Илария предложила союз", "Она согласна принять помощь; открывает вариант запуска Сердца."),
    ("era_hint", "Эра указала путь", "Проводница дала подсказку о спуске; запись в журнале и кодекс о жилах."),
    ("gear_intro_done", "Вводная справка", "Первая подсказка по делу показана, чтобы не повторять её."),
    ("moth_scared", "Щепка напуган", "Подросток испуган давлением; торг идёт хуже."),
    ("grist_drunk", "Грист пьян", "Литейщик выпил перед допросом: говорит охотнее, но путается."),
    ("kettle_slept", "Ночевал в Котле", "Герой спал в харчевне; утро восстановило силы."),
]

CHAPTERS = [
    {"id": "ch_prologue", "label": "Пролог. Ночной вызов", "order": 1,
     "description": "Находка в Нижних трубах, разговор с капитаном Строем, первая улика."},
    {"id": "ch_pipes", "label": "Глава 1. Нижние трубы", "order": 2,
     "description": "Осмотр места находки, свидетель, больная сестра, старая проводница."},
    {"id": "ch_copper", "label": "Глава 2. Медный ряд", "order": 3,
     "description": "Вдова-огранщица, харчевня, торг и поиск списка бригады Спуска."},
    {"id": "ch_foundry", "label": "Глава 3. Литейный пролёт", "order": 4,
     "description": "Допрос мастера Гриста, бумаги писаря Верго, второе убийство и погоня."},
    {"id": "ch_shaft", "label": "Глава 4. Шахта Сердца", "order": 5,
     "description": "Шлюз, спуск по жилам машины, жар и вентили."},
    {"id": "ch_core", "label": "Глава 5. Поддон", "order": 6,
     "description": "Зал Сердца, встреча с Иларией Грант и выбор, чем всё закончится."},
]

ENDINGS = [
    {"id": "ending_seal", "label": "Печать", "title": "Печать на Сердце",
     "text": "Ты повернул последний вентиль не туда, куда просила Илария, а туда, куда велела совесть. "
             "Жилы остыли, шепот стих, и город впервые за двенадцать лет уснул без гула в трубах. "
             "В рапорте это записали как «обрушение шлюза». Тебе никто не поверил — и никто не узнал, "
             "сколько именно ты отдал за то, чтобы Каркас просто дожил до утра.",
     "tone": "victory", "on": "victory",
     "conditions": [{"type": "flag_set", "flag": "sealed"}]},
    {"id": "ending_current", "label": "Ток", "title": "Ток пошёл",
     "text": "Ты положил руку на холодный кожух и позволил току идти через своё медное сердце. "
             "Где-то над головой дрогнули лампы Медного ряда, в трубах загудело, и город впервые "
             "после Замирания вздохнул полной грудью. Илария смотрела на тебя и улыбалась так, "
             "будто ты наконец вернулся. Что именно ты запустил — двигатель или что-то, "
             "что двенадцать лет ждало внутри, — станет известно не тебе.",
     "tone": "victory", "on": "victory",
     "conditions": [{"type": "flag_set", "flag": "joined_ilaria"}]},
    {"id": "ending_verdict", "label": "Приговор", "title": "Приговор по протоколу",
     "text": "Илария Грант шла между двумя надзирателями и не сопротивлялась. На суде она сказала только: "
             "«Оно не умерло. Я просто была единственной, кто остался рядом». Приговор занял полстраницы. "
             "Дело закрыто, ордера подшиты, Надзор доволен. В Нижних трубах по-прежнему нечем дышать, "
             "но теперь хотя бы известно, кого в этом винить.",
     "tone": "victory", "on": "victory",
     "conditions": [{"type": "flag_set", "flag": "ilaria_arrested"}]},
    {"id": "ending_ashes", "label": "Зола", "title": "Зола к золе",
     "text": "Она не стала драться до конца: просто упала на решётку Поддона и смотрела, как ты уходишь. "
             "Сердца, которые она собирала, остались лежать в медном ящике — ничьи. Ты вынес их наверх, "
             "сдал в контору и подписал протокол. Каркас будет остывать дальше, но счёт убийств закрыт.",
     "tone": "neutral", "on": "victory",
     "conditions": [{"type": "flag_set", "flag": "ilaria_dead"}]},
    {"id": "ending_wrong", "label": "Чужой приговор", "title": "Не тот человек",
     "text": "Вольт кричал, что сердца ему приносил человек в зеркальной маске, но протокол уже был написан. "
             "Дело закрыли за два дня: скупщик, краденые сердца, понятые из Цехa. Тебе выдали премию и следующий "
             "наряд. Только зольники в Нижних трубах теперь молчат при виде твоего жетона — и это молчание "
             "говорит больше любого рапорта.",
     "tone": "neutral", "on": "victory",
     "conditions": [{"type": "flag_set", "flag": "wrong_verdict"}]},
    {"id": "ending_fled", "label": "Ушёл", "title": "На тракт",
     "text": "Ты сдал жетон в окошко, не дожидаясь разговора со Строем, и вышел из ворот до рассвета. "
             "Кто-то другой найдёт Эрдала Вета без сердца и поставит галочку в журнале. Каркас остался позади — "
             "тёплый, дымный и с чужой смертью внутри.",
     "tone": "neutral", "on": "victory",
     "conditions": [{"type": "flag_set", "flag": "fled_city"}]},
    {"id": "ending_cold_case", "label": "Холодное дело", "title": "Холодное дело",
     "text": "На четырнадцатые сутки папку списали в архив. Убийца ушла по жилам, о которых ты узнал слишком "
             "поздно, и унесла с собой имена всех, кто спускался к Сердцу двенадцать лет назад. "
             "В Каркасе и без того хватает мёртвых, которым не задали вопросов.",
     "tone": "neutral", "on": "victory",
     "conditions": [{"type": "flag_set", "flag": "killer_escaped"}]},
    {"id": "ending_unfinished", "label": "Дело сдано", "title": "Дело сдано",
     "text": "Ты сделал что мог: улики подшиты, показания сняты, виновные названы. Каркас принял ещё одну "
             "папку в архив Надзора и продолжил дымить. В нижних ярусах всё так же считают воду по глоткам, "
             "но у кого-то теперь есть строчка в протоколе и имя, которое произнесут вслух.",
     "tone": "neutral", "on": "victory"},
    {"id": "ending_death", "label": "Гибель", "title": "Пепел принял ещё одного",
     "text": "Свет фонаря качнулся и погас. Где-то наверху чужими руками закрыли крышку медного ящика и "
             "поставили номер. Каркас не заметил: у него своих мёртвых хватает.",
     "tone": "death", "on": "death"},
]

MUSIC_TRACKS = [
    {"id": "music_menu", "label": "Каркас издалека", "loop": True,
     "src": {"mood": "таинственная", "tempo": 62, "key": "D", "scale": "минор",
             "layers": ["пад-аккорды", "арпеджио"], "progression": ["i", "VI", "III", "VII"],
             "seed": 1101}},
    {"id": "music_watch", "label": "Дежурка Надзора", "loop": True,
     "src": {"mood": "спокойная", "tempo": 70, "key": "A", "scale": "минор",
             "layers": ["пад-аккорды", "бас"], "progression": ["i", "iv", "VI", "V"],
             "seed": 2102}},
    {"id": "music_copper", "label": "Медный ряд", "loop": True,
     "src": {"mood": "спокойная", "tempo": 88, "key": "G", "scale": "дорийский",
             "layers": ["арпеджио", "бас", "перкуссия"], "progression": ["i", "IV", "VII", "III"],
             "seed": 3103}},
    {"id": "music_pipes", "label": "Нижние трубы", "loop": True,
     "src": {"mood": "тревожная", "tempo": 66, "key": "C", "scale": "фригийский",
             "layers": ["пад-аккорды", "бас"], "progression": ["i", "II", "i", "VII"],
             "seed": 4104}},
    {"id": "music_foundry", "label": "Литейный пролёт", "loop": True,
     "src": {"mood": "боевая", "tempo": 96, "key": "E", "scale": "минор",
             "layers": ["бас", "перкуссия", "арпеджио"], "progression": ["i", "VII", "VI", "V"],
             "seed": 5105}},
    {"id": "music_ash", "label": "Зольный двор", "loop": True,
     "src": {"mood": "тревожная", "tempo": 58, "key": "F", "scale": "пентатоника",
             "layers": ["пад-аккорды"], "progression": ["i", "VII", "iv", "i"],
             "seed": 6106}},
    {"id": "music_water", "label": "Цистерна", "loop": True,
     "src": {"mood": "спокойная", "tempo": 60, "key": "A", "scale": "мажор",
             "layers": ["пад-аккорды", "арпеджио"], "progression": ["I", "V", "vi", "IV"],
             "seed": 7107}},
    {"id": "music_shaft", "label": "Шахта Сердца", "loop": True,
     "src": {"mood": "таинственная", "tempo": 54, "key": "H", "scale": "фригийский",
             "layers": ["пад-аккорды", "бас"], "progression": ["i", "II", "VII", "i"],
             "seed": 8108}},
    {"id": "music_core", "label": "Поддон", "loop": True,
     "src": {"mood": "торжественная", "tempo": 72, "key": "Cis", "scale": "минор",
             "layers": ["пад-аккорды", "арпеджио", "бас"], "progression": ["i", "VI", "iv", "V"],
             "seed": 9109}},
    {"id": "music_battle", "label": "Схватка", "loop": True,
     "src": {"mood": "боевая", "tempo": 124, "key": "D", "scale": "минор",
             "layers": ["бас", "перкуссия", "арпеджио"], "progression": ["i", "VII", "i", "VI"],
             "seed": 1010}},
    {"id": "music_chase", "label": "Погоня", "loop": True,
     "src": {"mood": "тревожная", "tempo": 138, "key": "E", "scale": "фригийский",
             "layers": ["перкуссия", "бас"], "progression": ["i", "i", "VII", "i"],
             "seed": 1111}},
]

SOUNDS = [
    {"id": "sfx_click", "label": "Щелчок", "src": {"zzfx": zz(0.35, 0, 900, 0.005, 0.01, 0.04, 1, 1)}},
    {"id": "sfx_coin", "label": "Звон марки", "src": {"zzfx": zz(0.5, 0.02, 1400, 0.002, 0.03, 0.18, 2, 1.4, 0, 0, 600, 0.03)}},
    {"id": "sfx_paper", "label": "Шорох бумаги", "src": {"zzfx": zz(0.25, 0.05, 2400, 0.01, 0.02, 0.12, 4, 1.2)}},
    {"id": "sfx_door", "label": "Скрип двери",
     "src": {"zzfx": zz(0.35, 0.05, 300, 0.02, 0.13, 0.32, 3, 1.5, 0.55)}},
    {"id": "sfx_steps", "label": "Шаги", "src": {"zzfx": zz(0.3, 0.08, 180, 0.01, 0.05, 0.16, 4, 1.1)}},
    {"id": "sfx_gear", "label": "Скрип шестерни", "src": {"zzfx": zz(0.3, 0.03, 420, 0.01, 0.08, 0.2, 3, 1.3, 0.4)}},
    {"id": "sfx_metal", "label": "Лязг железа", "src": {"zzfx": zz(0.45, 0.06, 1100, 0.002, 0.04, 0.22, 2, 1.2, 0, 0, 400, 0.02)}},
    {"id": "sfx_cloth", "label": "Шорох ткани", "src": {"zzfx": zz(0.2, 0.1, 900, 0.02, 0.03, 0.14, 4, 1.1)}},
    {"id": "sfx_growl", "label": "Рычание", "src": {"zzfx": zz(0.5, 0.05, 150, 0.05, 0.2, 0.4, 3, 1.5, 0.2)}},
    {"id": "sfx_talk", "label": "Голос", "src": {"zzfx": zz(0.18, 0.12, 420, 0.01, 0.03, 0.1, 1, 1)}},
    {"id": "sfx_eat", "label": "Еда", "src": {"zzfx": zz(0.3, 0.15, 320, 0.02, 0.04, 0.14, 4, 1.1)}},
    {"id": "sfx_drink", "label": "Глоток", "src": {"zzfx": zz(0.35, 0.05, 500, 0.01, 0.06, 0.18, 1, 1.2, -0.6)}},
    {"id": "sfx_pickup", "label": "Взял вещь", "src": {"zzfx": zz(0.3, 0.02, 700, 0.005, 0.04, 0.1, 1, 1.2)}},
    {"id": "sfx_horn", "label": "Гудок тревоги", "src": {"zzfx": zz(0.6, 0, 220, 0.05, 0.5, 0.6, 1, 1.1)}},
    {"id": "sfx_hit", "label": "Удар", "src": {"zzfx": zz(0.6, 0.08, 260, 0.001, 0.03, 0.16, 3, 1.3, -0.8)}},
    {"id": "sfx_miss", "label": "Промах", "src": {"zzfx": zz(0.25, 0.1, 600, 0.005, 0.03, 0.12, 4, 1.1, -0.8)}},
    {"id": "sfx_crit", "label": "Крит", "src": {"zzfx": zz(0.75, 0.05, 180, 0.001, 0.06, 0.34, 3, 1.6, -1.2)}},
    {"id": "sfx_parry", "label": "Блок", "src": {"zzfx": zz(0.5, 0.03, 1600, 0.001, 0.05, 0.2, 2, 1.4)}},
    {"id": "sfx_death", "label": "Смерть", "src": {"zzfx": zz(0.6, 0.02, 120, 0.02, 0.4, 0.7, 1, 1.5, -1)}},
    {"id": "sfx_victory", "label": "Победа", "src": {"zzfx": zz(0.5, 0, 520, 0.01, 0.3, 0.5, 1, 1.2, 0, 0, 400, 0.1)}},
    {"id": "sfx_defeat", "label": "Поражение", "src": {"zzfx": zz(0.5, 0, 160, 0.02, 0.5, 0.8, 1, 1.4, -0.6)}},
    {"id": "sfx_quest", "label": "Запись в журнале", "src": {"zzfx": zz(0.35, 0, 760, 0.01, 0.08, 0.2, 1, 1.1, 0, 0, 300, 0.05)}},
    {"id": "sfx_skill", "label": "Навык вырос", "src": {"zzfx": zz(0.4, 0, 900, 0.01, 0.1, 0.24, 1, 1.2, 0, 0, 500, 0.06)}},
    {"id": "sfx_steam", "label": "Выброс пара", "src": {"zzfx": zz(0.5, 0.1, 1800, 0.01, 0.2, 0.4, 4, 1.2, -0.4)}},
    {"id": "sfx_wind", "label": "Ветер в трубах", "loop": True,
     "src": {"zzfx": zz(0.16, 0.2, 260, 0.4, 0.9, 1.2, 4, 1.1)}},
    {"id": "sfx_drip", "label": "Капли", "loop": True,
     "src": {"zzfx": zz(0.16, 0.02, 900, 0.002, 0.02, 0.09, 1, 1.4, -0.6)}},
    {"id": "sfx_fire", "label": "Гул печи", "loop": True,
     "src": {"zzfx": zz(0.2, 0.15, 120, 0.3, 0.9, 1.0, 4, 1.1)}},
    {"id": "sfx_hum", "label": "Гул машины", "loop": True,
     "src": {"zzfx": zz(0.18, 0.05, 90, 0.5, 1.0, 1.4, 1, 1.0)}},
]

UI_SOUNDS = {
    "menu_music": "music_menu",
    "click": "sfx_click",
    "panel_open": "sfx_door",
    "panel_close": "sfx_door",
    "message": "sfx_paper",
    "travel_depart": "sfx_steps",
    "travel_arrive": "sfx_steps",
    "scene_transition": "sfx_door",
    "combat_start": "sfx_horn",
    "hit": "sfx_hit",
    "miss": "sfx_miss",
    "crit": "sfx_crit",
    "parry": "sfx_parry",
    "death": "sfx_death",
    "victory": "sfx_victory",
    "defeat": "sfx_defeat",
    "quest_started": "sfx_quest",
    "quest_completed": "sfx_quest",
    "skill_up": "sfx_skill",
    "coin": "sfx_coin",
}

FEATS = [
    {"id": "feat_keen_eye", "label": "Цепкий глаз", "description": "Привычка читать чужую работу по рукам.",
     "mods": {"skills": {"spot": 10, "search": 5}}},
    {"id": "feat_pipe_lungs", "label": "Трубные лёгкие", "description": "Ты вырос на пепле и дышишь экономнее.",
     "mods": {"skills": {"survival": 10}, "hp": 2}},
    {"id": "feat_wrench_hand", "label": "Рука-ключ", "description": "Лом в руке — продолжение ладони.",
     "mods": {"skills": {"melee": 10, "repair": 5}}},
    {"id": "feat_stone_face", "label": "Каменное лицо", "description": "Тебя трудно вывести из себя — и трудно прочитать.",
     "mods": {"skills": {"persuade": 5, "pressure": 10}}},
]

ACHIEVEMENTS = [
    {"id": "ach_all_clues", "label": "Три улики", "description": "Собрать все три улики с места находки.",
     "conditions": [{"type": "flag_set", "flag": "clues_done"}],
     "reward": {"currency": "legacy", "amount": 2}},
    {"id": "ach_no_bribes", "label": "Без взяток", "description": "Дойти до финала, не дав ни марки писарю и скупщику.",
     "conditions": [{"type": "flag_set", "flag": "core_entered"},
                    {"type": "flag_not_set", "flag": "vergo_bribed"},
                    {"type": "flag_not_set", "flag": "volt_deal"}],
     "reward": {"currency": "legacy", "amount": 3}},
    {"id": "ach_codex", "label": "Всё, что осталось", "description": "Открыть не меньше восьми записей кодекса.",
     "conditions": [{"type": "meta_counter", "key": "codex_opened", "ge": 8}],
     "reward": {"currency": "legacy", "amount": 2}},
    {"id": "ach_survivor", "label": "Дотянул до Поддона", "description": "Дойти до зала Сердца, ни разу не уснув на ходу.",
     "conditions": [{"type": "flag_set", "flag": "core_entered"}],
     "reward": {"currency": "legacy", "amount": 1}},
]

META_UNLOCKS = [
    {"id": "unlock_boots", "label": "Прочная обувь", "description": "Стартовые сапоги с цеховой подошвой.",
     "cost": [{"currency": "legacy", "amount": 3}],
     "grants": [{"type": "add_item", "item": "item_boots", "quantity": 1}]},
    {"id": "unlock_filter", "label": "Запасной фильтр", "description": "Лишний сменный фильтр в кармане.",
     "cost": [{"currency": "legacy", "amount": 2}],
     "grants": [{"type": "add_item", "item": "item_filter", "quantity": 2}]},
    {"id": "unlock_rumors", "label": "Известные слухи", "description": "Нижние трубы знают тебя: разговор начинается мягче.",
     "cost": [{"currency": "legacy", "amount": 4}],
     "grants": [{"type": "change_disposition", "target": "faction_undercity", "delta": 20},
                {"type": "unlock_codex", "entry": "codex_undercity"}]},
]


def build():
    return {
        "id": CAMPAIGN_ID,
        "title": "Каркас: Медное сердце",
        "version": "1.0.0",
        "engine_version": "0.8.0",
        "min_engine": "0.8.0",
        "package_format": 1,
        "author": "ИИ-агент Chronicle Forge",
        "description": (
            "Двенадцать лет назад Сердце — машина, вокруг которой построен город-завод Каркас, — остановилось. "
            "Теперь кто-то вскрывает грудь тем, кто спускался к Сердцу, и вынимает медные сердца. "
            "Ты — дознаватель Надзора с таким же сердцем в груди. Расследование, выживание на талонах и выбор, "
            "который придётся сделать в Поддоне."
        ),
        "design_doc": design_doc(),
        "tick_label": "час",
        "ticks_per_day": 24,
        "time_of_day": {"morning": 6, "day": 10, "evening": 18, "night": 22},
        "calendar": {
            "year_label": "год Пепла",
            "start_year": 137,
            "days_per_month": 30,
            "months": ["Углемес", "Гаревей", "Жестянник", "Пепельник", "Кузнецов", "Мокрень",
                       "Трубник", "Зольник", "Копоть", "Стыль", "Клещ", "Обрыв"],
            "day_names": ["Пепельник", "Кузнецов", "Трубник", "Зольник", "Мокрень", "Сажевик", "Стыль"],
        },
        "starting_region": "region_karkas",
        "starting_location": "loc_watch",
        "starting_scene": "scene_watch_office",
        "starting_tick": 8,
        "needs": NEEDS,
        "statuses": STATUSUSES,
        "abilities": ABILITIES,
        "currencies": CURRENCIES,
        "skills": SKILLS,
        "skill_categories": SKILL_CATEGORIES,
        "item_categories": ITEM_CATEGORIES,
        "slot_types": SLOT_TYPES,
        "equipment_slots": EQUIPMENT_SLOTS,
        "flags": [{"id": f, "label": lab, "description": desc} for f, lab, desc in FLAGS],
        "factions": FACTIONS,
        "emotions": EMOTIONS,
        "weathers": WEATHERS,
        "overlay_layers": OVERLAY_LAYERS,
        "codex_categories": CODEX_CATEGORIES,
        "crimes": CRIMES,
        "price_events": PRICE_EVENTS,
        "dice_rules": {"critical_divisor": 5, "special_divisor": 2, "fumble_from": 96},
        "vitals": {"fatigue": {"multiplier": 1, "rest_restore": True}, "sanity": {"multiplier": 5}},
        "luck": {"multiplier": 5, "reroll_cost": 1, "rest_luck": True},
        "rest": {"hp": "1d3", "mp_full": True},
        "wealth_levels": WEALTH_LEVELS,
        "reputation": {"label": "Молва"},
        "camping": {"ticks": 8, "ambush_chance": 0.3, "ambush_rule": "rule_camp_ambush"},
        "progression": {"xp_per_level": 100, "feats_per_level": 1, "max_level": 5, "feats": FEATS},
        "metaprogress": {
            "currencies": [{"id": "legacy", "label": "Наследие",
                            "description": "То, что остаётся от забега: увиденные концовки и раскрытые тайны."}],
            "achievements": ACHIEVEMENTS,
            "unlocks": META_UNLOCKS,
        },
        "chapters": CHAPTERS,
        "endings": ENDINGS,
        "music_tracks": MUSIC_TRACKS,
        "sounds": SOUNDS,
        "ui_sounds": UI_SOUNDS,
        "default_music": ["music_watch"],
        "combat_music": ["music_battle"],
        "max_companions": 2,
        "default_player": "player_hero",
        "new_game_plus": {
            "label": "Новый круг",
            "keep": ["skills", "stats", "inventory", "feats"],
            "boost": {"enemy_damage_step": 0.2, "need_decay_step": 0.1, "prices_step": 0.1},
        },
        "combat": {
            "death": {"mode": "brp", "con_multiplier": 5},
            "flee": {"skill": "dodge"},
            "multi_attack_penalty": -20,
            "cover": {"penalty": -20},
        },
        "theme": {
            "profile": "postapocalypse",
            "accent": "#c9853c",
            "menu": {
                "background": "assets/img/menu_bg.jpg",
                "dim": 0.55,
                "ken_burns": True,
            },
            "end": {"background": "assets/img/menu_bg.jpg"},
            "tokens": {
                "panel": "#15171c",
                "cards": "#1e2128",
                "inset": "#0d0f13",
                "log": "#12141a",
            },
        },
        "char_creation": {
            "total_points": 58,
            "stat_limits": {"min": 3, "max": 18},
            "skill_points": 235,
            "skill_cap": 75,
            "skill_floor": 15,
            "mandatory_skills": ["spot", "survival"],
            "forbidden_skills": ["whisper"],
            "choose_name": True,
            "choose_age": True,
            "choose_bio": True,
            "professions": [
                {
                    "id": "prof_watch",
                    "label": "Служитель Надзора",
                    "description": "Ты годы носил жетон: протокол, очерёдность и умение вытянуть признание из молчуна.",
                    "skill_bonus": {"bargain": 10, "survival": 5},
                    "items": [{"item": "item_badge", "quantity": 1},
                              {"item": "item_mark", "quantity": 25},
                              {"item": "item_ration", "quantity": 2}],
                    "stats": {"STR": 11, "CON": 12, "SIZ": 11, "DEX": 10, "INT": 12, "POW": 11, "CHA": 12},
                },
                {
                    "id": "prof_guild",
                    "label": "Цеховой подмастерье",
                    "description": "Ты вырос у верстака: машины понятнее людей, а руки помнят размер резьбы.",
                    "skill_bonus": {"tech_lore": 10, "first_aid": 5},
                    "items": [{"item": "item_wrench", "quantity": 1},
                              {"item": "item_mark", "quantity": 20},
                              {"item": "item_scrap", "quantity": 3}],
                    "stats": {"STR": 12, "CON": 11, "SIZ": 10, "DEX": 12, "INT": 13, "POW": 10, "CHA": 11},
                },
                {
                    "id": "prof_under",
                    "label": "Дитя нижних труб",
                    "description": "Ты из тех, кто считает воду по глоткам и знает, где пепел ложится тише всего.",
                    "skill_bonus": {"lockpick": 10, "bargain": 5},
                    "items": [{"item": "item_coat", "quantity": 1},
                              {"item": "item_mark", "quantity": 15},
                              {"item": "item_cloth", "quantity": 2}],
                    "stats": {"STR": 12, "CON": 14, "SIZ": 10, "DEX": 13, "INT": 10, "POW": 10, "CHA": 10},
                },
            ],
            "callings": [
                {
                    "id": "call_inquirer",
                    "label": "Дознаватель",
                    "description": "Ты видишь то, что люди забыли спрятать: взгляд, след, лишнюю паузу.",
                    "skills": {"spot": 65, "search": 70, "persuade": 70, "pressure": 35,
                               "stealth": 30, "dodge": 45, "brawl": 20, "melee": 20,
                               "crossbow": 25, "repair": 15, "survival": 25},
                },
                {
                    "id": "call_engineer",
                    "label": "Наладчик",
                    "description": "Ты чинишь то, что другие списали, и открываешь то, что заперто на три замка.",
                    "skills": {"spot": 60, "search": 55, "persuade": 35, "pressure": 25,
                               "stealth": 25, "dodge": 30, "brawl": 25, "melee": 35,
                               "crossbow": 30, "repair": 75, "survival": 25},
                },
                {
                    "id": "call_bruiser",
                    "label": "Вышибала",
                    "description": "Ты работаешь плечом и кулаком, а разговор начинаешь с того, что перестаёшь улыбаться.",
                    "skills": {"spot": 40, "search": 30, "persuade": 30, "pressure": 55,
                               "stealth": 25, "dodge": 50, "brawl": 65, "melee": 60,
                               "crossbow": 25, "repair": 15, "survival": 25},
                },
            ],
        },
        "attribution": {
            "author": "ИИ-агент Chronicle Forge по брифу мастера",
            "published_at": "2026-10-04",
            "note": "Тексты, мир, правила, музыка и звуки синтезированы для этой кампании. "
                    "Все изображения пакета (assets/img/**) сгенерированы нейросетью по описанию автора кампании "
                    "и поставляются вместе с ней; чужих материалов и внешних ссылок в пакете нет. "
                    "Медиа можно заменять на свои: пути прописаны в данных кампании относительными.",
        },
    }
