"""Метаданные кампании: реестры, баланс, тема, создание персонажа."""

from c_design_doc import DESIGN_DOC

CAMPAIGN_ID = "a725c985-8d87-4575-9a41-c3809a86d076"
ENGINE = "0.8.0"

# ----------------------------------------------------------------------
# навыки
# ----------------------------------------------------------------------

SKILL_CATEGORIES = [
    {"id": "skat_combat", "label": "Бой"},
    {"id": "skat_social", "label": "Разговор"},
    {"id": "skat_craft", "label": "Ремесло"},
    {"id": "skat_lore", "label": "Знание"},
    {"id": "skat_wild", "label": "Улица и тьма"},
]

SKILLS = [
    {"id": "melee", "label": "Тяжёлое оружие", "category": "skat_combat"},
    {"id": "blades", "label": "Клинковое оружие", "category": "skat_combat"},
    {"id": "brawl", "label": "Кулачный бой", "category": "skat_combat"},
    {"id": "pistol", "label": "Паровой пистоль", "category": "skat_combat"},
    {"id": "dodge", "label": "Уклонение", "category": "skat_combat"},
    {"id": "persuade", "label": "Убеждение", "category": "skat_social"},
    {"id": "bargain", "label": "Торг", "category": "skat_social"},
    {"id": "intimidate", "label": "Запугивание", "category": "skat_social"},
    {"id": "lie", "label": "Ложь", "category": "skat_social"},
    {"id": "mechanics", "label": "Механика", "category": "skat_craft"},
    {"id": "craft", "label": "Ремесло", "category": "skat_craft"},
    {"id": "lockpick", "label": "Отмычки", "category": "skat_craft"},
    {"id": "investigate", "label": "Дознание", "category": "skat_lore"},
    {"id": "perceive", "label": "Наблюдательность", "category": "skat_lore"},
    {"id": "lore_ether", "label": "Знание эфира", "category": "skat_lore"},
    {"id": "medicine", "label": "Медицина", "category": "skat_lore"},
    {"id": "first_aid", "label": "Первая помощь", "category": "skat_lore"},
    {"id": "stealth", "label": "Скрытность", "category": "skat_wild"},
    {"id": "athletics", "label": "Лазание", "category": "skat_wild"},
]

# ----------------------------------------------------------------------
# потребности (подписи короткие — их видно в узком HUD)
# ----------------------------------------------------------------------

NEEDS = [
    {
        "id": "need_hunger", "label": "Голод", "short_label": "Голод",
        "description": "Сытость. Падает сама по себе; еда в корчме и сухари её поднимают.",
        "max": 100, "decay_per_tick": 1.1, "critical_threshold": 20,
    },
    {
        "id": "need_warmth", "label": "Тепло", "short_label": "Тепло",
        "description": "Тепло тела. Тратится вечером и ночью на улице, возвращается у печей, в корчме и часовне.",
        "max": 100, "decay_per_tick": 1.4, "critical_threshold": 20,
        "decay_when": [
            {"type": "time_of_day", "values": ["evening", "night"]},
            {"type": "in_location", "locations": ["loc_tavern", "loc_chapel", "loc_quarantine",
                                                  "loc_copperyard", "loc_pumphouse"], "not": True},
        ],
        "restore_per_tick": 7,
        "restore_when": [
            {"type": "in_location", "locations": ["loc_tavern", "loc_chapel", "loc_quarantine",
                                                  "loc_copperyard", "loc_pumphouse"]},
        ],
    },
    {
        "id": "need_rest", "label": "Отдых", "short_label": "Отдых",
        "description": "Силы. Копятся в кровати, в бане и на лагере у пепельной пустоши.",
        "max": 100, "decay_per_tick": 0.7, "critical_threshold": 15,
    },
    {
        "id": "need_nerve", "label": "Нервы", "short_label": "Нервы",
        "description": "Крепость духа. Шёпот, кровь и темнота едят её; чай, разговор и обряд — возвращают.",
        "max": 100, "decay_per_tick": 0.35, "critical_threshold": 15,
        "on_zero_effect": "rule_nerve_break",
    },
]

# ----------------------------------------------------------------------
# статусы
# ----------------------------------------------------------------------

STATUSES = [
    {
        "id": "status_ash_lung", "label": "Пепел в лёгких", "short_label": "Пепел",
        "description": "Пеплопад Котла оседает в груди: трудно дышать, трудно бежать.",
        "scope": "world", "duration": 12,
        "dot": {"hp": 1},
        "skill_mods": [{"skill": "athletics", "delta": -10}, {"skill": "perceive", "delta": -5}],
        "apply_message": "Горло дерёт, в груди хрипит пепел.",
        "expire_message": "Дыхание выровнялось.",
    },
    {
        "id": "status_bleeding", "label": "Кровотечение", "short_label": "Кровь",
        "description": "Рана не закрывается: сила уходит каплей за каплей.",
        "scope": "both", "duration": 6,
        "dot": {"hp": 2},
        "apply_message": "Кровь идёт по рукаву.",
    },
    {
        "id": "status_rust_fever", "label": "Ржавая лихорадка", "short_label": "Лихорадка",
        "description": "Литейная зараза: жар, дрожь, металлический вкус во рту. Лечится настоем или временем.",
        "scope": "world", "duration": 30,
        "dot": {"hp": 1},
        "skill_mods": [{"skill": "mechanics", "delta": -15}, {"skill": "perceive", "delta": -10}],
        "disease": {"interval_ticks": 6, "con_multiplier": 5, "severity_max": 4},
        "apply_message": "Жар поднимается от кистей к лицу.",
        "expire_message": "Жар отпустил.",
    },
    {
        "id": "status_under_current", "label": "Под напряжением", "short_label": "Напряжение",
        "description": "Кровь поёт от эфира: удар сильнее, шаг быстрее — и так недолго.",
        "scope": "both", "duration": 4,
        "skill_mods": [{"skill": "melee", "delta": 20}, {"skill": "blades", "delta": 20}],
        "mov_mod": 1,
        "apply_message": "Пальцы гудят, как провод.",
    },
    {
        "id": "status_whisper", "label": "Шёпот в голове", "short_label": "Шёпот",
        "description": "Машины говорят с героем: слова мешают думать и разговаривать.",
        "scope": "world", "duration": 18,
        "skill_mods": [{"skill": "persuade", "delta": -15}, {"skill": "lie", "delta": -15},
                       {"skill": "perceive", "delta": -10}],
        "apply_message": "В ушах поднимается ровный латунный шёпот.",
    },
    {
        "id": "status_scalded", "label": "Ошпарен", "short_label": "Ожог",
        "description": "Кипяток и пар сварили кожу на плече.",
        "scope": "combat", "duration": 3,
        "skill_mods": [{"skill": "dodge", "delta": -15}, {"skill": "melee", "delta": -10}],
        "apply_message": "Пар обжигает лицо и руки.",
    },
]

# ----------------------------------------------------------------------
# боевые способности
# ----------------------------------------------------------------------

ABILITIES = [
    {
        "id": "ability_brass_fist", "label": "Латунный кулак",
        "description": "Заводной бьёт поршнем вместо кулака.",
        "mp_cost": 0, "cooldown_rounds": 1, "range": 1, "skill": "brawl",
        "kind": "damage", "damage": "1d6+2",
    },
    {
        "id": "ability_needle_shot", "label": "Игольный залп",
        "description": "Пучок стальных игл из рукава — коротко и грязно.",
        "mp_cost": 0, "cooldown_rounds": 2, "range": 3, "skill": "pistol",
        "kind": "damage", "damage": "1d6",
    },
    {
        "id": "ability_steam_vent", "label": "Клуб пара",
        "description": "Котёл под кожей сбрасывает давление в лицо врагу.",
        "mp_cost": 0, "cooldown_rounds": 3, "range": 1, "skill": "pistol",
        "kind": "status", "status": "status_scalded", "status_duration": 3,
    },
    {
        "id": "ability_whisper_lash", "label": "Хлыст шёпота",
        "description": "Машина говорит — у человека глохнут мысли.",
        "mp_cost": 0, "cooldown_rounds": 4, "range": 2, "skill": "lore_ether",
        "kind": "status", "status": "status_whisper", "status_duration": 4,
    },
    {
        "id": "ability_field_weld", "label": "Полевая сварка",
        "description": "Живая заплатка из ветоши, масла и латуни.",
        "mp_cost": 0, "cooldown_rounds": 3, "range": 1, "skill": "first_aid",
        "kind": "heal", "heal": "1d6",
    },
    {
        "id": "ability_tox_cloud", "label": "Угарный выдох",
        "description": "Тварь из трубы выдыхает дым той самой гарью, которой её кормили.",
        "mp_cost": 0, "cooldown_rounds": 3, "range": 2, "skill": "",
        "kind": "status", "status": "status_ash_lung", "status_duration": 4,
    },
]

# ----------------------------------------------------------------------
# фракции, валюты, эмоции, категории
# ----------------------------------------------------------------------

FACTIONS = [
    {"id": "faction_ceh", "label": "Литая Курия", "base_disposition": 0,
     "description": "Управляющая цехами Курия Котла. Ей нужен порядок и ровный выхлоп."},
    {"id": "faction_strazha", "label": "Стража Котла", "base_disposition": 5,
     "description": "Патрули, пропускной двор и комендантский час."},
    {"id": "faction_plamya", "label": "Остывшее Пламя", "base_disposition": 10,
     "description": "Согласие гасильщиков: машины, по их вере, надо отпускать, а не доить."},
    {"id": "faction_okolina", "label": "Окалинские", "base_disposition": 0,
     "description": "Трущобная вольница, контрабандисты и трубочисты."},
    {"id": "faction_kukly", "label": "Кукловоды", "base_disposition": -20, "hidden": True,
     "description": "Служебная фракция Кляйна: слова «нет» они не слышат."},
]

CURRENCIES = [
    {"id": "mark", "label": "Медная марка", "symbol": "м", "item_id": "item_mark"},
]

EMOTIONS = [
    {"id": "neutral", "label": "Обычный"},
    {"id": "angry", "label": "Сердит"},
    {"id": "scared", "label": "Испуган"},
    {"id": "tired", "label": "Устал"},
    {"id": "kind", "label": "Добр"},
    {"id": "hurt", "label": "Ранен"},
    {"id": "thinking", "label": "Задумался"},
]

ITEM_CATEGORIES = [
    {"id": "currency", "label": "Валюта"},
    {"id": "food", "label": "Еда", "restores_needs": ["need_hunger"],
     "sounds": {"use": "sfx_coin"}},
    {"id": "drink", "label": "Питьё", "restores_needs": ["need_hunger", "need_nerve"],
     "sounds": {"use": "sfx_steam"}},
    {"id": "medicine", "label": "Лекарства", "restores_hp": True,
     "sounds": {"use": "sfx_paper"}},
    {"id": "tool", "label": "Инструмент", "sounds": {"pickup": "sfx_metal_step"}},
    {"id": "part", "label": "Деталь и материал", "sounds": {"pickup": "sfx_gear"}},
    {"id": "weapon", "label": "Оружие", "is_weapon": True, "sounds": {"use": "sfx_hammer"}},
    {"id": "armor", "label": "Защита", "is_armor": True, "sounds": {"use": "sfx_metal_step"}},
    {"id": "quest", "label": "Дело", "sounds": {"pickup": "sfx_paper"}},
    {"id": "prop", "label": "Обстановка"},
    {"id": "misc", "label": "Разное"},
]

SLOT_TYPES = [
    {"id": "person", "label": "Человек", "sounds": {"talk": "sfx_click"}},
    {"id": "prop", "label": "Устройство", "sounds": {"open": "sfx_gear"}},
    {"id": "item", "label": "Предмет", "sounds": {"pickup": "sfx_metal_step"}},
    {"id": "container", "label": "Хранилище", "sounds": {"open": "sfx_door"}},
    {"id": "animal", "label": "Животное"},
]

EQUIPMENT_SLOTS = [
    {"id": "weapon", "label": "Оружие"},
    {"id": "armor", "label": "Броня"},
    {"id": "amulet", "label": "Оберег"},
]

# ----------------------------------------------------------------------
# флаги: у каждого — «для чего нужен»
# ----------------------------------------------------------------------

FLAGS = [
    {"id": "met_sera", "label": "Знакомство с Серой",
     "description": "Запоминает первый разговор с дознавательницей Сера Дольной; читается в её диалоге и в приветствии стражи."},
    {"id": "case_taken", "label": "Дело о тихом море взято",
     "description": "Герой взял дело у Серы; открывает главу расследования, реплики свидетелей и правила ночных событий."},
    {"id": "body_examined", "label": "Тело осмотрено",
     "description": "Тело в Медной литейной осмотрено, найдена латунь; условие разговоров о природе смерти."},
    {"id": "brass_found", "label": "Латунная вставка",
     "description": "Кусок латуни из позвонков жертвы; нужен Клепе для опознания состава и Ржаву для разговора об обряде."},
    {"id": "knows_witness", "label": "Известен свидетель",
     "description": "Герой знает про подмастерье Гната; открывает мастерскую Шпильки и квест «Шпилька молчит»."},
    {"id": "gnat_saved", "label": "Гнат выжил",
     "description": "Свидетель спасён; читается в диалогах Кира и Серы, двигает квест и финальные реплики."},
    {"id": "gnat_dead", "label": "Гнат погиб",
     "description": "Свидетель убит заводными; закрывает показания и меняет разговор Серы о деле."},
    {"id": "ledger_known", "label": "Известна долговая книга",
     "description": "Герой знает о гроссбухе Векселя с именами пропавших; открывает Литейную слободу."},
    {"id": "ledger_taken", "label": "Книга в руках",
     "description": "Гроссбух вынесен из дома Векселя; условие выбора: Курия, ростовщик или огонь."},
    {"id": "ledger_ceh", "label": "Книга у Курии",
     "description": "Курия забрала гроссбух и метёт следы; ведёт к концовке «Тихая бумага» и меняет реплики Серы."},
    {"id": "ledger_returned", "label": "Книга у Векселя",
     "description": "Ростовщик обязан герою: скидка в торговле и подсказка о трубах."},
    {"id": "ledger_burned", "label": "Книга сожжена",
     "description": "Должники свободны, доказательств нет; Курия теряет интерес к делу, Ржав доверяет больше."},
    {"id": "quarantine_tonics", "label": "Настои для барака",
     "description": "Три банки настоя переданы Клепе; барак выжил и открыл герою путь в Окалины."},
    {"id": "furnace_fixed", "label": "Печь барака починена",
     "description": "Тепло в карантине; Клепа лечит бесплатно, реплики больных меняются."},
    {"id": "valve_repaired", "label": "Клапан починен",
     "description": "Водонапорная башня снова качает; открывает восстановление воды и часть реплик."},
    {"id": "water_restored", "label": "Вода в Котле",
     "description": "Чистая вода пошла в город; снимает часть урона от жажды, открывает рецепты и реплики."},
    {"id": "lens_built", "label": "Стекло шёпота",
     "description": "Собрана линза, видящая шёпотные метки; нужна для Глубинного хода и финальных проверок."},
    {"id": "vial_taken", "label": "Ампула из ниши",
     "description": "Герой вскрыл нишу в крипте и взял ампулу эфирной крови; читается рецептом линзы и репликами Клепы."},
    {"id": "recipe_lens_found", "label": "Рецепт линзы найден",
     "description": "Отец Ржав отдал рецепт Стекла шёпота; открывает крафт линзы."},
    {"id": "whisper_heard", "label": "Шёпот услышан",
     "description": "Герой впервые услышал машины; включает ночные события, статусы и реплики о голосах."},
    {"id": "tisha_met", "label": "Знакомство с Тихой",
     "description": "Девочка без тени из труб Окалин; открывает проводника и часть подсказок о Кляйне."},
    {"id": "barnaba_met", "label": "Барнаба узнал героя",
     "description": "Заводной патруль опознал героя; меняет стычки в трубах и разговор о пощаде."},
    {"id": "barnaba_freed", "label": "Барнаба освобождён",
     "description": "Заводной выведен из подчинения Кляйна; помогает в финальном бою, читается в концовках."},
    {"id": "barnaba_destroyed", "label": "Барнаба разобран",
     "description": "Заводной уничтожен; даёт осколок сердечника и закрывает ветку пощады."},
    {"id": "crypt_open", "label": "Крипта открыта",
     "description": "Крипта часовни вскрыта; доступ к письму Кляйна и старым механизмам."},
    {"id": "klein_letter", "label": "Письмо Кляйна прочитано",
     "description": "Герой знает про Железную Мать и «дописывание»; нужен для финальных реплик и обряда."},
    {"id": "deep_gate_open", "label": "Глубинный ход открыт",
     "description": "Вход в машинное зало под городом; условие финальной сцены."},
    {"id": "mother_met", "label": "Железная Мать виденa",
     "description": "Герой видел турбину-сердце Котла; открывает финальные ветки разговора."},
    {"id": "klein_defeated", "label": "Кляйн побеждён",
     "description": "Тело Мастера остановлено; первый шаг любой победной концовки."},
    {"id": "mother_pacified", "label": "Мать упокоена",
     "description": "Обряд Остывшего Пламени завершён; главная победная развязка."},
    {"id": "mother_bound", "label": "Мать подчинена",
     "description": "Герой занял место Кляйна у турбины; ведёт к концовке «Новое сердце»."},
    {"id": "city_evacuated", "label": "Квартал выведен",
     "description": "Люди выведены из литейного квартала до пуска пара; спасательная ветка финала."},
    {"id": "curfew_broken", "label": "Комендантский час нарушен",
     "description": "Стража ищет героя; ускоряет патрули и портит отношение фракции."},
    {"id": "guard_alert", "label": "Стража поднята",
     "description": "Тревога на пропускном дворе; учащает патрули и меняет разговор с Пепел."},
    {"id": "crime_trespass", "label": "Взлом цехового помещения",
     "description": "Служебный отпечаток преступления для условий crime_committed у стражи."},
    {"id": "gate_left", "label": "Ушёл за ворота",
     "description": "Герой покинул город; закрывает городские ветки и ведёт к концовке «Тихий тракт»."},
    {"id": "nerve_broken", "label": "Нервы сорвались",
     "description": "Первый перелом: ставится правилом перелома, ведёт к «тихим» концовкам."},
    {"id": "klein_met", "label": "Разговор с Кляйном",
     "description": "Герой говорил с Кляйном лично; открывает финальные реплики и ветку сделки."},
    {"id": "cold_flame_rite", "label": "Обряд Остывшего Пламени",
     "description": "Герой умеет гасить шёпот обрядом; нужен для упокоения Матери."},
    {"id": "guard_pass", "label": "Пропуск стражи",
     "description": "Разрешение выходить за Пепельные ворота; нужно для концовки «Тихий тракт»."},
    {"id": "drain_open", "label": "Сток отжат",
     "description": "Решётка стока в дренажном дворе отжата; читается правилами и сценой дренажа."},
    {"id": "rite_done", "label": "Обряд совершён",
     "description": "В часовне проведён обряд гашения шёпота; читается квестами и концовками."},
    {"id": "met_pepel", "label": "Разговор со стражником Пепелом",
     "description": "Герой говорил с караулом пропускного двора; читается сценой двора и правилами стражи."},
    {"id": "drain_noise_known", "label": "Стук в дренаже",
     "description": "Герой узнал про ровный стук под резным рядом; открывает путь в дренаж."},
    {"id": "roof_path_known", "label": "Дорога по крышам",
     "description": "Кирилл показал обход стражи по крышам складов; используется проверками скрытности."},
    {"id": "tunnel_path_known", "label": "Проводник по трубам",
     "description": "Тиша согласился провести героя к резному ряду; нужен для входа в туннели."},
    {"id": "blood_trail_known", "label": "Кровавый след",
     "description": "Герой нашёл след крови на трубах и знает, где прятался Гнат; диалог свидетеля."},
    {"id": "gvern_known", "label": "Имя Мастера Гверна",
     "description": "Герой знает, что мастер живёт над дренажем; ключ к гроссбуху Векселя."},
    {"id": "klepa_verified", "label": "Латунь подтверждена",
     "description": "Клепа опознала сплав в позвонках; открывает ветку с мастерской в глубине."},
    {"id": "klepa_saved", "label": "Барак выжил",
     "description": "Тоники и печь спасли карантин; влияет на концовки и диалог Клепы."},
    {"id": "recipe_tonic_learned", "label": "Клепа научила тонику",
     "description": "Рецепт тоника открыт от знахарки; читается меню изготовления."},
    {"id": "gnat_under_veksel", "label": "Гнат под рукой Векселя",
     "description": "Ростовщик выкупил долг подмастерья; читается финальными правилами и эпилогом."},
    {"id": "mey_known", "label": "Слепая Мей",
     "description": "Герой знает про девочку, которая считает трубы; нужен для встречи у часовни."},
    {"id": "mey_answer", "label": "Ответ Мей",
     "description": "Мей рассказала про дверь и латунный сад; открывает запись кодекса."},
    {"id": "whisper_rumer", "label": "Слух о списке",
     "description": "Марла проговорилась про счёт и списки; ведёт к разговору о шёпоте."},
    {"id": "lens_taught", "label": "Ржав научил читать метки",
     "description": "Отец Ржав объяснил, как читать шёпотные метки; нужен для крипты и финала."},
    {"id": "barnaba_deal", "label": "Сделка с «Пламенем»",
     "description": "Барнаба ждёт бумаги Цеха; читается правилами концовки «Пепел на площади»."},
    {"id": "barnaba_alliance", "label": "Союз с «Пламенем»",
     "description": "Барнаба дал герою людей; влияет на бой в машинном зале."},
    {"id": "klein_shown", "label": "Кляйн показал перенос",
     "description": "Мастер показал, как вставляет спицы; читается финальными проверками убеждения."},
    {"id": "mother_asked", "label": "Мать просит остановить счёт",
     "description": "Герой услышал просьбу Матери; открывает ветку финала."},
    {"id": "mother_rite_known", "label": "Известен обряд остановки",
     "description": "Мать рассказала, что нужно: молот, вода и имя; условие финальных выборов."},
]

# ----------------------------------------------------------------------
# погода, слои, календарь, кодекс
# ----------------------------------------------------------------------

OVERLAY_LAYERS = [
    {"id": "ash", "label": "Пеплопад"},
    {"id": "fog", "label": "Угарный туман"},
    {"id": "rain", "label": "Морось"},
]

WEATHERS = [
    {"id": "weather_ashfall", "label": "Пеплопад", "overlay": "ash",
     "ambient": ["snd_ash_wind"],
     "combat": {"skill_mods": [{"skill": "pistol", "delta": -10}], "mov_penalty": 0}},
    {"id": "weather_smog", "label": "Угар", "overlay": "fog",
     "ambient": ["snd_boiler"],
     "combat": {"skill_mods": [{"skill": "perceive", "delta": -10}], "mov_penalty": 0,
                "range_penalty": 1}},
    {"id": "weather_drizzle", "label": "Морось", "overlay": "rain",
     "ambient": ["snd_rain"]},
]

CODEX_CATEGORIES = [
    {"id": "creatures", "label": "Существа"},
    {"id": "places", "label": "Места"},
    {"id": "chronicles", "label": "Хроники"},
    {"id": "people", "label": "Люди"},
]

CALENDAR = {
    "year_label": "год Гари",
    "start_year": 612,
    "days_per_month": 30,
    "months": ["Пепель", "Углемес", "Кипень", "Окалин", "Гаревей", "Морозень",
               "Слюда", "Водень", "Жаровень", "Смолень", "Ржавень", "Тишень"],
    "day_names": ["Первица", "Сменка", "Середка", "Поздень", "Гаре", "Тих"],
}

# ----------------------------------------------------------------------
# звук и музыка (синтез, без файлов)
# ----------------------------------------------------------------------

MUSIC_TRACKS = [
    {"id": "music_menu", "label": "Котёл дышит", "loop": True, "volume": 0.7,
     "src": {"mood": "таинственная", "tempo": 58, "key": "A", "scale": "фригийский",
             "layers": ["пад-аккорды", "бас"], "progression": ["i", "VI", "VII", "i"], "seed": 11}},
    {"id": "music_city", "label": "Улицы Котла", "loop": True, "volume": 0.6,
     "src": {"mood": "спокойная", "tempo": 76, "key": "D", "scale": "дорийский",
             "layers": ["арпеджио", "бас"], "progression": ["i", "IV", "VII", "III"], "seed": 3}},
    {"id": "music_forge", "label": "Медная литейная", "loop": True, "volume": 0.65,
     "src": {"mood": "тревожная", "tempo": 92, "key": "E", "scale": "минор",
             "layers": ["перкуссия", "бас", "пад-аккорды"], "progression": ["i", "i", "VI", "VII"], "seed": 17}},
    {"id": "music_market", "label": "Ржавый рынок", "loop": True, "volume": 0.55,
     "src": {"mood": "спокойная", "tempo": 84, "key": "G", "scale": "мажор",
             "layers": ["арпеджио", "перкуссия"], "progression": ["I", "V", "vi", "IV"], "seed": 21}},
    {"id": "music_tavern", "label": "Тёплый шов", "loop": True, "volume": 0.6,
     "src": {"mood": "спокойная", "tempo": 70, "key": "F", "scale": "мажор",
             "layers": ["пад-аккорды", "бас"], "progression": ["I", "IV", "I", "V"], "seed": 5}},
    {"id": "music_chapel", "label": "Остывшее Пламя", "loop": True, "volume": 0.6,
     "src": {"mood": "торжественная", "tempo": 52, "key": "C", "scale": "минор",
             "layers": ["пад-аккорды"], "progression": ["i", "VII", "VI", "VII"], "seed": 29}},
    {"id": "music_tunnels", "label": "Трубы Окалин", "loop": True, "volume": 0.62,
     "src": {"mood": "таинственная", "tempo": 62, "key": "H", "scale": "фригийский",
             "layers": ["бас", "арпеджио"], "progression": ["i", "II", "i", "VII"], "seed": 41}},
    {"id": "music_deep", "label": "Глубинное зало", "loop": True, "volume": 0.7,
     "src": {"mood": "таинственная", "tempo": 48, "key": "C#", "scale": "минор",
             "layers": ["пад-аккорды", "перкуссия"], "progression": ["i", "VI", "iv", "V"], "seed": 53}},
    {"id": "music_battle", "label": "Бой в Котле", "loop": True, "volume": 0.75,
     "src": {"mood": "боевая", "tempo": 118, "key": "A", "scale": "минор",
             "layers": ["перкуссия", "бас", "пад-аккорды"], "progression": ["i", "VII", "VI", "V"], "seed": 67}},
    {"id": "music_finale", "label": "Пепельное согласие", "loop": False, "volume": 0.7,
     "src": {"mood": "торжественная", "tempo": 60, "key": "D", "scale": "дорийский",
             "layers": ["пад-аккорды", "арпеджио"], "progression": ["i", "VI", "III", "VII"], "seed": 71}},
]

SOUNDS = [
    {"id": "sfx_click", "label": "Щелчок", "src": {"zzfx": [1, 0, 900, 0, 0.01, 0.03, 1, 1.5, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0.4, 0, 0]}},
    {"id": "sfx_hammer", "label": "Удар по металлу", "src": {"zzfx": [1.4, 0, 220, 0, 0.02, 0.25, 4, 2.2, -40, 0, 0, 0, 0, 1.2, 0, 0, 0.12, 0.5, 0.1, 0]}},
    {"id": "sfx_gear", "label": "Скрип шестерни", "src": {"zzfx": [0.8, 0, 1300, 0, 0.02, 0.12, 3, 1.2, 300, 0.03, 0, 0, 3, 0, 0, 0, 0.2, 0.3, 0, 0]}},
    {"id": "sfx_whisper", "label": "Шёпот машин", "src": {"zzfx": [0.6, 0, 320, 0.4, 0.6, 1.2, 4, 0.4, -120, 0.02, 0, 0, 0, 2.2, 4, 0.2, 0.6, 0.5, 0.2, 0]}},
    {"id": "sfx_metal_step", "label": "Шаг по железу", "src": {"zzfx": [0.9, 0.05, 160, 0, 0.01, 0.2, 1, 1.1, -60, 0, 0, 0, 0, 0.6, 0, 0, 0.15, 0.4, 0, 0]}},
    {"id": "sfx_door", "label": "Дверь на рельсе", "src": {"zzfx": [1, 0, 90, 0.02, 0.3, 0.6, 3, 0.8, 40, 0.01, 0, 0, 0, 1.5, 0, 0, 0.3, 0.4, 0, 0]}},
    {"id": "sfx_coin", "label": "Звон марок", "src": {"zzfx": [1, 0, 2400, 0, 0.03, 0.18, 0, 1, 800, 0.1, 0, 0, 0, 0, 0, 0, 0.2, 0.5, 0.1, 0]}},
    {"id": "sfx_steam", "label": "Сброс пара", "src": {"zzfx": [1.1, 0, 700, 0.01, 0.5, 0.9, 4, 0.6, -400, 0, 0, 0, 0, 3.2, 0, 0, 0.4, 0.3, 0, 0]}},
    {"id": "sfx_heart", "label": "Гул под полом", "src": {"zzfx": [0.9, 0, 60, 0, 0.05, 0.4, 0, 1.2, 0, 0, 0, 0, 2, 0, 0, 0, 0.3, 0.6, 0, 0]}},
    {"id": "sfx_paper", "label": "Шорох бумаги", "src": {"zzfx": [0.7, 0, 1600, 0, 0.02, 0.08, 4, 1, 0, 0, 0, 0, 0, 1.8, 0, 0, 0.1, 0.3, 0, 0]}},
    {"id": "sfx_alarm", "label": "Рында стражи", "src": {"zzfx": [1.3, 0, 420, 0, 0.4, 0.9, 2, 0.7, 120, 0.05, 0, 0, 2, 0, 0, 0, 0.4, 0.5, 0, 0]}},
    {"id": "sfx_water", "label": "Вода в трубе", "src": {"zzfx": [0.8, 0, 480, 0.1, 0.5, 1.1, 1, 1.4, -200, 0, 0, 0, 0, 2.4, 0, 0, 0.3, 0.5, 0, 0]}},
    {"id": "sfx_ash_wind", "label": "Ветер с пеплом", "loop": True, "src": {"zzfx": [0.5, 0, 180, 0.6, 0.8, 1.6, 4, 0.5, -60, 0.02, 0, 0, 0, 2.8, 0, 0, 0.5, 0.4, 0.2, 0]}},
    {"id": "sfx_boiler", "label": "Гул котлов", "loop": True, "src": {"zzfx": [0.45, 0, 70, 0.5, 0.9, 1.4, 0, 1.1, 20, 0.01, 0, 0, 0, 1.1, 0, 0, 0.4, 0.5, 0, 0]}},
    {"id": "sfx_rain", "label": "Морось по железу", "loop": True, "src": {"zzfx": [0.4, 0, 2200, 0.2, 0.7, 1.0, 4, 1.0, 0, 0, 0, 0, 0, 1.6, 0, 0, 0.2, 0.3, 0, 0]}},
]

UI_SOUNDS = {
    "menu_music": "music_menu",
    "click": "sfx_click",
    "panel_open": "sfx_gear",
    "panel_close": "sfx_click",
    "message": "sfx_paper",
    "travel_depart": "sfx_metal_step",
    "travel_arrive": "sfx_metal_step",
    "scene_transition": "sfx_door",
    "combat_start": "sfx_alarm",
    "hit": "sfx_hammer",
    "miss": "sfx_metal_step",
    "crit": "sfx_steam",
    "parry": "sfx_gear",
    "death": "sfx_heart",
    "victory": "music_finale",
    "defeat": "sfx_heart",
    "quest_started": "sfx_paper",
    "quest_completed": "sfx_coin",
    "skill_up": "sfx_gear",
    "coin": "sfx_coin",
}

# ----------------------------------------------------------------------
# создание персонажа: бюджеты посчитаны точно, проверяются tools/validate.py
# ----------------------------------------------------------------------

PROFESSIONS = [
    {
        "id": "prof_foundry", "label": "Литейщик",
        "description": "Смена у печи с двенадцати лет: спина, руки и нюх на горячий металл. Механика — бесплатный бонус.",
        "stats": {"STR": 13, "CON": 12, "SIZ": 11, "DEX": 9, "INT": 5, "POW": 3, "CHA": 3},
        "skill_bonus": {"mechanics": 10},
        "items": [{"item": "item_hammer", "quantity": 1},
                  {"item": "item_apron", "quantity": 1},
                  {"item": "item_mark", "quantity": 8}],
    },
    {
        "id": "prof_watch", "label": "Квартальный стражник",
        "description": "Патрули пропускного двора: держать равновесие на мокром железе и падать правильно. Уклонение — бесплатный бонус.",
        "stats": {"STR": 11, "CON": 10, "SIZ": 10, "DEX": 11, "INT": 6, "POW": 4, "CHA": 4},
        "skill_bonus": {"dodge": 10},
        "items": [{"item": "item_pipe", "quantity": 1},
                  {"item": "item_mark", "quantity": 10}],
    },
    {
        "id": "prof_smuggler", "label": "Контрабандист",
        "description": "Ночные рейсы через Окалины: тихий шаг, острые глаза и умение уговорить трубу открыться. Механика и уклонение — понемногу бесплатно.",
        "stats": {"STR": 7, "CON": 8, "SIZ": 7, "DEX": 12, "INT": 10, "POW": 5, "CHA": 7},
        "skill_bonus": {"mechanics": 5, "dodge": 5},
        "items": [{"item": "item_knife", "quantity": 1},
                  {"item": "item_lockpicks", "quantity": 1},
                  {"item": "item_mark", "quantity": 12}],
    },
    {
        "id": "prof_medic", "label": "Цеховой фельдшер",
        "description": "Барак, ожоги, ржавая лихорадка. Первая помощь — бесплатный бонус, механика — тоже: насосы и жгуты похожи.",
        "stats": {"STR": 6, "CON": 9, "SIZ": 8, "DEX": 10, "INT": 12, "POW": 7, "CHA": 4},
        "skill_bonus": {"mechanics": 5, "first_aid": 5},
        "items": [{"item": "item_bandage", "quantity": 3},
                  {"item": "item_tonic", "quantity": 1},
                  {"item": "item_mark", "quantity": 9}],
    },
]

CALLINGS = [
    {
        "id": "calling_investigator", "label": "Дознаватель",
        "description": "Читать тела, бумаги и людей. Вопрос вместо кулака, но кулак тоже пригодится.",
        "skills": {"mechanics": 25, "dodge": 35, "first_aid": 35,
                   "investigate": 45, "perceive": 35, "persuade": 35, "lie": 15},
    },
    {
        "id": "calling_forgeman", "label": "Литейный мастер",
        "description": "Ремонт, тяжёлое оружие и уверенный вес в драке.",
        "skills": {"mechanics": 45, "melee": 35, "craft": 30,
                   "dodge": 35, "first_aid": 35, "athletics": 30, "intimidate": 15},
    },
    {
        "id": "calling_night_runner", "label": "Ночной бегун",
        "description": "Скрытность, отмычки, торг и умение уйти в трубу раньше, чем тебя увидят.",
        "skills": {"stealth": 45, "lockpick": 35, "dodge": 35, "bargain": 35,
                   "mechanics": 25, "first_aid": 35, "athletics": 15},
    },
]

CHAR_CREATION = {
    "total_points": 35,
    "stat_limits": {"min": 3, "max": 18},
    "skill_points": 90,
    "skill_cap": 75,
    "skill_floor": 15,
    "mandatory_skills": ["dodge", "first_aid"],
    "forbidden_skills": ["pistol"],
    "choose_name": True,
    "professions": PROFESSIONS,
    "callings": CALLINGS,
}

DIFFICULTIES = [
    {"id": "diff_shift", "label": "Обычная смена",
     "description": "Как задумано мастером: враги бьют мягче, потребности падают медленнее.",
     "enemy_damage": 0.8, "need_decay": 0.9, "prices": 1},
    {"id": "diff_night", "label": "Ночная смена",
     "description": "Аудит и настоящая цена ошибки: урон и голод — как в книге.",
     "enemy_damage": 1.0, "need_decay": 1.0, "prices": 1.1},
    {"id": "diff_iron", "label": "Железная смена",
     "description": "Котёл не прощает: жёсткий урон, дорогие припасы, автосохранение выключено.",
     "enemy_damage": 1.4, "need_decay": 1.3, "prices": 1.25, "no_autosave": True},
]

NEW_GAME_PLUS = {
    "label": "Второй круг",
    "keep": ["skills", "skill_marks", "stats", "inventory", "feats"],
    "boost": {"enemy_damage_step": 0.2, "need_decay_step": 0.15, "prices_step": 0.1},
}

META_PROGRESS = {
    "currencies": [
        {"id": "meta_shard", "label": "Осколок эфира",
         "description": "Оседает в карманах после закрытых дел. Тратится на постоянные усиления."},
    ],
    "achievements": [
        {"id": "ach_two_endings", "label": "Дело закрыто дважды",
         "description": "Увидеть две разные концовки «Шёпота в шестернях».",
         "conditions": [{"type": "meta_counter", "key": "endings_seen", "ge": 2}],
         "reward": {"currency": "meta_shard", "amount": 2, "xp": 120}},
        {"id": "ach_ten_deeds", "label": "Своё в Котле",
         "description": "Закрыть десять дел за все забеги.",
         "counter": {"stat": "quests_completed", "target": 10},
         "reward": {"currency": "meta_shard", "amount": 3, "xp": 150}},
        {"id": "ach_deep", "label": "Глубинный ход",
         "description": "Спуститься к Железной Матери своим ходом.",
         "conditions": [{"type": "flag_set", "flag": "deep_gate_open"}],
         "reward": {"currency": "meta_shard", "amount": 1, "xp": 200}},
        {"id": "ach_silent", "label": "Тихий свидетель",
         "description": "Пережить три забега, не потеряв рассудок до конца.",
         "counter": {"stat": "ticks_survived", "target": 600},
         "reward": {"currency": "meta_shard", "amount": 2, "xp": 100}},
    ],
    "unlocks": [
        {"id": "unlock_apron", "label": "Фартук мастера",
         "description": "Каждый забег начинается в кожаном фартуке литейной.",
         "cost": [{"currency": "meta_shard", "amount": 3}],
         "grants": [{"type": "add_item", "item": "item_apron", "quantity": 1}]},
        {"id": "unlock_tonics", "label": "Запас фельдшера",
         "description": "Две банки травяного настоя на старте забега.",
         "cost": [{"currency": "meta_shard", "amount": 2}],
         "grants": [{"type": "add_item", "item": "item_tonic", "quantity": 2}]},
        {"id": "unlock_marks", "label": "Старый долг",
         "description": "Двадцать пять медных марок — будто кто-то вернул давний долг.",
         "cost": [{"currency": "meta_shard", "amount": 4}],
         "grants": [{"type": "add_item", "item": "item_mark", "quantity": 25}]},
    ],
}

SPECIES = [
    {"id": "species_zavodnoy", "label": "Заводной человек",
     "description": "Латунный каркас под кожей, заводная пружина вместо дыхания.",
     "stats": {"STR": 13, "CON": 12, "SIZ": 12, "DEX": 11, "INT": 8, "POW": 8, "CHA": 5},
     "skills": {"brawl": 55, "dodge": 40}, "armor": 2,
     "natural_weapon": {"skill": "brawl", "damage": "1d6+1", "label": "Поршень",
                        "damage_bonus": True, "range": 1, "attacks_per_round": 1,
                        "parry_capable": True},
     "abilities": ["ability_brass_fist"], "morale": {"below_hp_pct": 20, "flee_chance": 10}},
    {"id": "species_pipe_beast", "label": "Тварь из трубы",
     "description": "Слепой зверь, выросший на угарном дыме под городом.",
     "stats": {"STR": 15, "CON": 14, "SIZ": 13, "DEX": 12, "INT": 4, "POW": 10, "CHA": 2},
     "skills": {"brawl": 60, "stealth": 40}, "armor": 1,
     "natural_weapon": {"skill": "brawl", "damage": "1d6", "label": "Когти",
                        "damage_bonus": True, "range": 1, "attacks_per_round": 1,
                        "parry_capable": False},
     "abilities": ["ability_tox_cloud"], "morale": {"below_hp_pct": 25, "flee_chance": 35}},
    {"id": "species_guard", "label": "Стражник Котла",
     "description": "Кольчуга, дубинка и устав наизусть.",
     "stats": {"STR": 12, "CON": 12, "SIZ": 12, "DEX": 10, "INT": 8, "POW": 9, "CHA": 8},
     "skills": {"melee": 45, "brawl": 40, "dodge": 35}, "armor": 3,
     "natural_weapon": {"skill": "melee", "damage": "1d6+1", "label": "Дубинка",
                        "damage_bonus": True, "range": 1, "attacks_per_round": 1,
                        "parry_capable": True},
     "morale": {"below_hp_pct": 30, "flee_chance": 25}},
]

# ----------------------------------------------------------------------
# финальные экраны: сначала узкие, общие — в конец
# ----------------------------------------------------------------------

ENDINGS = [
    {
        "id": "ending_ashen_peace", "label": "Пепельное согласие",
        "title": "Город остаётся живым",
        "text": "Железная Мать остывает медленно, как остывает печь после смены. Котёл потеряет свет и воду, но люди в нём останутся людьми. На рассвете над трубами впервые за двенадцать лет не поднимается шёпот — только пар.",
        "tone": "victory", "on": "victory", "image": "assets/img/end_peace.jpg",
        "conditions": [{"type": "flag_set", "flag": "mother_pacified"},
                       {"type": "flag_set", "flag": "klein_defeated"}],
    },
    {
        "id": "ending_new_heart", "label": "Новое сердце",
        "title": "Сердце под городом",
        "text": "Турбина принимает героя так же, как принимала Кляйна. Он говорит с металлом на его языке и слышит, как внизу ворочается город. Наверху начинается смена, и никто не заметит, что в Котле стало на одно сердце больше.",
        "tone": "neutral", "on": "victory", "image": "assets/img/end_heart.jpg",
        "conditions": [{"type": "flag_set", "flag": "mother_bound"}],
    },
    {
        "id": "ending_ceh_quiet", "label": "Тихая бумага",
        "title": "Дело закрыто без шума",
        "text": "Курия берёт гроссбух, ставит печать и объявляет, что тихий мор был плохим воздухом. Жертв запишут в угарные списки, Кляйна назовут обвалом двенадцатилетней давности. Герой получает благодарность, подписанную чернилами, и обещание, что больше ничего не произойдёт.",
        "tone": "neutral", "on": "victory", "image": "assets/img/end_end.jpg",
        "conditions": [{"type": "flag_set", "flag": "ledger_ceh"}],
    },
    {
        "id": "ending_outer_dark", "label": "Тихий тракт",
        "title": "За Пепельными воротами",
        "text": "Герой уходит, пока ворота открыты. Позади остаётся город, который дышит чужим дыханием, впереди — пепельная пустошь и ни одной живой дороги. Иногда ветер доносит оттуда ровный латунный шёпот, и герой идёт быстрее.",
        "tone": "neutral", "on": "victory", "image": "assets/img/end_outer.jpg",
        "conditions": [{"type": "flag_set", "flag": "gate_left"}],
    },
    {
        "id": "ending_whisper_taken", "label": "Стал тихим",
        "title": "Ещё один голос в трубе",
        "text": "Рассудок не выдержал первым. Тело ещё шло какое-то время, потом село у стены, потом легло. Через час из вентиляции в Медном цеху слышался новый ровный голос, который всё повторял чьё-то имя.",
        "tone": "death", "on": "death", "image": "assets/img/end_whisper.jpg",
        "conditions": [{"type": "flag_set", "flag": "nerve_broken"},
                       {"type": "flag_set", "flag": "whisper_heard"}],
    },
    {
        "id": "ending_death_kettle", "label": "Котёл принял",
        "title": "Смена окончена",
        "text": "Кровь смешалась с машинным маслом, и это оказалась та же жидкость. Бригада утренней смены оттащит тело к печи и не станет спрашивать имени: в Котле таких много.",
        "tone": "death", "on": "death", "image": "assets/img/end.jpg",
        "conditions": [],
    },
    {
        "id": "ending_victory_generic", "label": "Дело закрыто",
        "title": "Дело закрыто",
        "text": "Герой уходит из Котла с ощущением, что сделал всё, что мог. Шёпот остаётся, но он хотя бы больше не растёт.",
        "tone": "victory", "on": "victory", "image": "assets/img/end.jpg",
        "conditions": [],
    },
]

COMBAT_RULES = {
    "flee": {"skill": "athletics"},
    "multi_attack_penalty": 20,
    "aim": {"bonus": 20},
    "opportunity_attacks": True,
    "flank": {"arc": 120, "damage_bonus": "1d4"},
    "death": {"mode": "instant"},
}

HAZARDS = {"fall_meters_per_die": 3, "fall_damage": "1d6"}

CAMPING = {"ticks": 8, "ambush_chance": 0.25, "ambush_rule": "rule_camp_ambush"}

CRIMES = [
    {"id": "crime_trespass", "label": "Взлом цехового помещения"},
    {"id": "crime_assault", "label": "Нападение на стражу Котла"},
    {"id": "crime_theft_ledger", "label": "Кража долговой книги"},
]

PRICE_EVENTS = [
    {"id": "price_curfew", "label": "Комендантские поставки", "multiplier": 1.4,
     "categories": ["food", "drink"]},
    {"id": "price_blockade", "label": "Перекрытые трубы", "multiplier": 1.25,
     "items": ["item_clean_water", "item_oil", "item_tonic"]},
]

PASSIONS_LIST = [
    {"id": "passion_truth", "label": "Правда о Котле"},
    {"id": "passion_people", "label": "Люди Котла"},
]

ALLEGIANCES = [
    {"id": "alleg_plamya", "label": "Остывшее Пламя"},
    {"id": "alleg_ceh", "label": "Литая Курия"},
]


def build_meta():
    return {
        "id": CAMPAIGN_ID,
        "title": "Шёпот в шестернях",
        "version": "1.0.0",
        "engine_version": ENGINE,
        "min_engine": ENGINE,
        "package_format": 1,
        "author": "Chronicle Forge AI",
        "description": (
            "Тёмное техно-фэнтези о литейном городе Котле, где машины поют, "
            "а люди глохнут. Детектив о четырёх тихих телах, долговая книга, "
            "карантинный барак и турбина под городом — 5–7 часов игры."
        ),
        "design_doc": DESIGN_DOC,
        "tick_label": "час",
        "ticks_per_day": 24,
        "time_of_day": {"morning": 6, "day": 10, "evening": 18, "night": 22},
        "starting_region": "region_cauldron",
        "starting_location": "loc_passcourt",
        "starting_scene": "scene_passcourt",
        "starting_tick": 8,
        "needs": NEEDS,
        "statuses": STATUSES,
        "abilities": ABILITIES,
        "difficulties": DIFFICULTIES,
        "new_game_plus": NEW_GAME_PLUS,
        "species": SPECIES,
        "equipment_slots": EQUIPMENT_SLOTS,
        "calendar": CALENDAR,
        "weathers": WEATHERS,
        "camping": CAMPING,
        "hazards": HAZARDS,
        "crimes": CRIMES,
        "price_events": PRICE_EVENTS,
        "endings": ENDINGS,
        "overlay_layers": OVERLAY_LAYERS,
        "codex_categories": CODEX_CATEGORIES,
        "dice_rules": {"critical_divisor": 5, "special_divisor": 2, "fumble_from": 96},
        "skills": SKILLS,
        "skill_categories": SKILL_CATEGORIES,
        "vitals": {"fatigue": True, "sanity": True},
        "reputation": {"label": "Известность в Котле"},
        "wealth_levels": ["Нищий", "Бедный", "Свободный", "Зажиточный", "Купеческий"],
        "passions_list": PASSIONS_LIST,
        "allegiances": ALLEGIANCES,
        "power_level": "normal",
        "augments": {"threshold": 50, "bonus": 20},
        "item_categories": ITEM_CATEGORIES,
        "slot_types": SLOT_TYPES,
        "flags": FLAGS,
        "emotions": EMOTIONS,
        "currencies": CURRENCIES,
        "factions": FACTIONS,
        "music_tracks": MUSIC_TRACKS,
        "chapters": [
            {"id": "ch_prologue", "label": "Пролог. Четвёртое тело", "order": 1,
             "description": "Ночь на пропускном дворе и первый вызов в Медную литейную."},
            {"id": "ch_investigation", "label": "Глава 1. Тихие люди", "order": 2,
             "description": "Свидетель, долговая книга, карантин и часовня. Дело обрастает именами."},
            {"id": "ch_depths", "label": "Глава 2. Трубы и долги", "order": 3,
             "description": "Водонапорная башня, Окалины, заводной патруль и Глубинный ход."},
            {"id": "ch_finale", "label": "Глава 3. Сердце Котла", "order": 4,
             "description": "Разговор с Кляйном, Железная Мать и выбор, чем станет город."},
        ],
        "attribution": {
            "author": "Агент Arena.ai (по заданию мастера Chronicle Forge)",
            "note": "Кампания создана целиком с нуля по брифу __chronicle_ai__/TASK.md: тексты, дизайн-документ и "
                    "все id — оригинальные. Медиа (портреты, бойцы, фоны меню и концовок, эмблема) "
                    "сгенерированы процедурно скриптом tools/make_media.py из примитивов ImageMagick; "
                    "сторонние материалы и заимствованные ассеты не использовались, права не заявляются.",
        },
        "sounds": SOUNDS,
        "ui_sounds": UI_SOUNDS,
        "default_music": ["music_city"],
        "combat_music": ["music_battle"],
        "theme": {
            "profile": "dark-fantasy",
            "atmosphere": True,
            "accent": "#c98b3a",
            "menu": {"background": "assets/img/menu.jpg", "dim": 0.55,
                     "ken_burns": True, "title_art": "assets/img/title_art.png"},
            "end": {"background": "assets/img/end.jpg"},
            "tokens": {"panel": "#1c1815", "cards": "#2a231d",
                       "inset": "#14110f", "log": "#191512"},
        },
        "max_load_formula": "str_plus_siz",
        "max_companions": 2,
        "char_creation": CHAR_CREATION,
        "combat": COMBAT_RULES,
        "luck": {"multiplier": 5, "reroll_cost": 1, "rest_luck": True},
        "metaprogress": META_PROGRESS,
        "default_player": "player_hero",
        "roguelike": {"permadeath": False, "meta_progress": ["meta_shard"],
                      "randomize_on_restart": ["encounters"]},
        "save_slots": 3,
        "generators": {
            "event_tables": [
                {
                    "id": "evt_city_night", "label": "Ночная смена Котла",
                    "description": "Раз в шесть часов: патрули, пепел, шёпот в трубах.",
                    "interval_ticks": 6, "chance": 0.45,
                    "time_of_day": ["evening", "night"],
                    "rules": ["rule_night_patrol", "rule_ash_gust", "rule_whisper_night"],
                },
                {
                    "id": "evt_city_day", "label": "Дневная смена Котла",
                    "description": "Раз в восемь часов: работы, рынок, паровые выбросы.",
                    "interval_ticks": 8, "chance": 0.35,
                    "time_of_day": ["morning", "day"],
                    "rules": ["rule_day_works", "rule_steam_release", "rule_price_shift"],
                },
            ],
        },
    }
