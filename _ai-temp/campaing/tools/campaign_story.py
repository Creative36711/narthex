# -*- coding: utf-8 -*-
"""Сюжетная механика Медного Хода: правила, квесты, арены, катсцены,
таблицы встреч, рецепты, кодекс и генераторы событий."""


def rule(rid, label, conditions, effects, once=False, manual=False, chapter=None, conditions_any=None):
    r = {"id": rid, "label": label, "once": once, "conditions": conditions, "effects": effects}
    if manual:
        r["manual"] = True
    if conditions_any:
        r["conditions_any"] = conditions_any
    if chapter:
        r["chapter"] = chapter
    return r


def F(f):
    return {"type": "flag_set", "flag": f}


def NF(f):
    return {"type": "flag_not_set", "flag": f}


def ENTER_SCENE(s):
    return {"type": "player_enters_scene", "scene": s}


def ENTER_LOC(l):
    return {"type": "player_enters_location", "location": l}


def MSG(text, portrait=None):
    e = {"type": "show_message", "text": text}
    if portrait:
        e["portrait"] = portrait
    return e


def RULES():
    return [
        rule("rule_intro", "Пролог: пепельные ворота",
             [{"type": "tick_elapsed", "min_tick": 0}],
             [{"type": "play_cutscene", "cutscene": "cutscene_intro"},
              {"type": "set_flag", "flag": "intro_seen"},
              {"type": "banner", "text": "Медный Ход, год Ржави 61-й", "preset": "глава",
               "seconds": 4, "position": "верх", "enter": "тянуть"}],
             once=True, chapter="ch_prologue"),

        rule("rule_clock_warning", "Город гаснет",
             [{"type": "tick_elapsed", "min_tick": 12}, NF("night_passed")],
             [MSG("За окнами гаснут окна: смена кончается, а дело Гарна ещё не закрыто."),
              {"type": "unlock_codex", "entry": "codex_lower"}],
             once=True, chapter="ch_case"),

        rule("rule_deadline_warn", "Ход сбивается",
             [{"type": "tick_elapsed", "min_tick": 48}, NF("deadline_warned")],
             [{"type": "set_flag", "flag": "deadline_warned"},
              {"type": "banner", "text": "Ход сбивается", "preset": "проклятье", "seconds": 4, "enter": "всплеск"},
              MSG("Стены гудят на низкой ноте: Ход сбивается, и Дирекция больше не будет ждать.")],
             once=True, chapter="ch_heart"),

        rule("rule_deadline", "Ход встал",
             [{"type": "tick_elapsed", "min_tick": 96}, NF("machine_open")],
             [{"type": "banner", "text": "Ход встал", "preset": "проклятье", "seconds": 5, "enter": "всплеск"},
              MSG("Трубы глохнут одна за другой. Медный Ход замерзает, а дело Гарна так и осталось в бумагах."),
              {"type": "game_over_death", "reason": "Ход встал до того, как правда нашлась"}],
             once=True, chapter="ch_heart"),

        rule("rule_market_first", "Первый выход на рынок",
             [ENTER_SCENE("scene_market")],
             [{"type": "unlock_codex", "entry": "codex_directorate"},
              {"type": "banner", "text": "Ржавый рынок", "preset": "заголовок", "seconds": 3, "enter": "сбоку"},
              MSG("Рынок гудит под навесами. В участке напротив сидит сержант, в лечебнице — лекарка, а ниже начинается Нижняя улица."),
              {"type": "journal_update", "quest": "quest_garn", "text_key": "j_market"}],
             once=True, chapter="ch_case"),

        rule("rule_lower_first", "Первый спуск вниз",
             [ENTER_LOC("loc_lower")],
             [{"type": "unlock_codex", "entry": "codex_lower"},
              {"type": "banner", "text": "Нижняя улица", "preset": "заголовок", "seconds": 3, "enter": "сбоку"},
              MSG("Под рынком пахнет горячим шлаком. В лужах радужная плёнка — вода из штрека."),
              {"type": "start_quest", "quest": "quest_names"}],
             once=True, chapter="ch_works"),

        rule("rule_slag_first", "Первое спускание в шлаковые ямы",
             [ENTER_SCENE("scene_slag")],
             [{"type": "set_flag", "flag": "bossar_met"},
              {"type": "unlock_codex", "entry": "codex_lower"},
              {"type": "banner", "text": "Шлаковые ямы", "preset": "заголовок", "seconds": 3, "enter": "сбоку"},
              MSG("Над отвалом стоит бригадир Боссар. За его спиной — решётка Глубокого штрека."),
              {"type": "journal_update", "quest": "quest_garn", "text_key": "j_track"}],
             once=True, chapter="ch_slag"),

        rule("rule_deep_without_filter", "Дыхание без фильтра",
             [F("deep_pass"), NF("filter_known"), ENTER_LOC("loc_deep")],
             [{"type": "apply_status", "target": "player", "status": "status_fume", "duration": 8},
              {"type": "set_flag", "flag": "fume_first"},
              MSG("Угар входит в грудь тёплым дымом. Без фильтр-маски здесь долго не продержаться."),
              {"type": "unlock_codex", "entry": "codex_rust"}],
             once=True, chapter="ch_deep"),

        rule("rule_examine_body", "Осмотр тела Гарна",
             [], [{"type": "set_flag", "flag": "garn_body_found"},
                  {"type": "journal_update", "quest": "quest_garn", "text_key": "j_body"},
                  {"type": "unlock_codex", "entry": "codex_garn_case"},
                  MSG("Под ногтями Гарна — латунная стружка. Лицо спилено уже после смерти: кто-то очень не хотел, чтобы его узнали."),
                  {"type": "change_sanity", "delta": -3}],
             manual=True, chapter="ch_deep"),

        rule("rule_take_ledger", "Гроссбух в рогоже",
             [], [{"type": "add_item", "item": "item_garn_ledger", "quantity": 1},
                  {"type": "set_flag", "flag": "ledger_taken"},
                  {"type": "journal_update", "quest": "quest_garn", "text_key": "j_ledger"},
                  {"type": "unlock_codex", "entry": "codex_garn_case"},
                  MSG("В гроссбухе — колонки имён и даты «поставки». Последняя строка подписана рукой Валента."),
                  {"type": "fire_rule", "rule": "rule_quiet_comes"}],
             manual=True, chapter="ch_deep"),

        rule("rule_quiet_comes", "«Тихая» пошла по следу",
             [], [{"type": "set_flag", "flag": "quiet_met"},
                  MSG("За спиной, в темноте, кто-то шагнул беззвучно. Пора уходить."),
                  {"type": "start_pursuit", "label": "«Тихая» идёт по следу", "skill": "stealth",
                   "every_ticks": 3, "fails_to_catch": 1,
                   "on_fail": [{"type": "show_message",
                                "text": "Серая тень обгоняет и разворачивается навстречу."},
                               {"type": "start_combat",
                                "enemies": [{"entity": "npc_quiet", "count": 1}],
                                "arena": "arena_deep", "intro": "«Тихая» бьёт без замаха.",
                                "on_victory": [{"type": "set_flag", "flag": "quiet_defeated"},
                                               {"type": "unlock_codex", "entry": "codex_quiet"},
                                               {"type": "meta_currency", "id": "meta_slag", "amount": 3},
                                               MSG("Серая фигура оседает у крепи. В складках плаща — приказ с печатью Дирекции.")]}]}],
             manual=True, chapter="ch_deep"),

        rule("rule_escape_deep", "Из штрека наверх",
             [F("quiet_met"), ENTER_LOC("loc_machine")],
             [{"type": "stop_pursuit"},
              {"type": "set_flag", "flag": "quiet_defeated"},
              {"type": "unlock_codex", "entry": "codex_quiet"},
              MSG("Лязг за спиной смолкает: «Тихая» не пошла в машинный зал.")],
             once=True, chapter="ch_deep"),

        rule("rule_ambush_machine", "Засада у сердца",
             [F("machine_open"), NF("quiet_met"), ENTER_SCENE("scene_machine")],
             [{"type": "set_flag", "flag": "quiet_met"},
              MSG("У трубы стоит серая фигура: Дирекция не любит гостей."),
              {"type": "start_combat", "enemies": [{"entity": "npc_quiet", "count": 1}],
               "arena": "arena_machine", "intro": "«Тихая» перекрывает обходную трубу.",
               "on_victory": [{"type": "set_flag", "flag": "quiet_defeated"},
                              {"type": "unlock_codex", "entry": "codex_quiet"},
                              {"type": "meta_currency", "id": "meta_slag", "amount": 3},
                              MSG("Плащ серой фигуры пропитан угарным туманом. Приказ подписан Валентом.")]}],
             once=True, chapter="ch_heart"),

        rule("rule_valve_fixed", "Давление восстановлено",
             [], [{"type": "set_flag", "flag": "valve_fixed"},
                  {"type": "set_flag", "flag": "machine_open"},
                  {"type": "banner", "text": "Давление восстановлено", "preset": "глава", "seconds": 4, "enter": "молниеносно"},
                  {"type": "unlock_codex", "entry": "codex_hod"},
                  {"type": "journal_update", "quest": "quest_pressure", "text_key": "j_valve"},
                  MSG("Трубы выравнивают дыхание. Обходной патрубок открыт, машинный зал ждёт.")],
             manual=True, chapter="ch_heart"),

        rule("rule_irena_teaches", "Урок Ирены",
             [], [{"type": "unlock_recipe", "recipe": "recipe_filter"},
                  {"type": "set_flag", "flag": "filter_known"},
                  {"type": "change_skill", "skill": "mechanics", "delta": 5},
                  {"type": "unlock_codex", "entry": "codex_hod"},
                  MSG("Ирена кладёт в ладонь уголь и ткань: «Сложишь сам. Дыши через ткань, а не через страх».")],
             manual=True, chapter="ch_works"),

        rule("rule_medic_help", "Ханна взялась за дело",
             [], [{"type": "change_hp", "delta": 6},
                  {"type": "remove_status", "target": "player", "status": "status_fume"},
                  {"type": "remove_status", "target": "player", "status": "status_bleed"},
                  {"type": "set_flag", "flag": "clinic_helped"},
                  {"type": "unlock_recipe", "recipe": "recipe_tonic"},
                  {"type": "change_disposition", "target": "npc_medic", "delta": 10},
                  MSG("Ханна промывает угар и зашивает, что можно зашить: «Ржавь — не болезнь. Это счёт, который тебе выставили».")],
             manual=True, chapter="ch_case"),

        rule("rule_marta_debt_cleared", "Долг Марты закрыт",
             [], [{"type": "set_flag", "flag": "debt_paid"},
                  {"type": "give_reward", "items": [{"item": "item_silver", "quantity": 15},
                                                     {"item": "item_stew", "quantity": 1}]},
                  {"type": "clear_flag", "flag": "slagger_debt"},
                  {"type": "change_disposition", "target": "npc_marta", "delta": 15},
                  {"type": "journal_update", "quest": "quest_debt", "text_key": "j_paid"},
                  MSG("Марта вытирает стойку: «Вот теперь ты в этом городе не чужой».")],
             manual=True, chapter="ch_slag"),

        rule("rule_thugs_on_street", "Вышибала пришёл за долгом",
             [F("slagger_debt"), NF("debt_paid"), ENTER_SCENE("scene_lower")],
             [MSG("Из-за телеги поднимается человек с ключом в руке: «Боссар ждёт свою марку»."),
              {"type": "start_combat", "enemies": [{"entity": "npc_thug", "count": 1}],
               "arena": "arena_lower", "intro": "Вышибала бьёт первым, без разговоров.",
               "on_victory": [{"type": "set_flag", "flag": "encounter_won"},
                              MSG("Тело оттаскивают в тень сами жители: здесь не любят вопросов.")]}],
             once=True, chapter="ch_slag"),

        rule("rule_bossar_paid", "Боссару заплачено",
             [], [{"type": "remove_item", "item": "item_silver", "quantity": 15},
                  {"type": "set_flag", "flag": "deep_pass"},
                  {"type": "set_flag", "flag": "bossar_paid"},
                  {"type": "add_item", "item": "item_permit", "quantity": 1},
                  {"type": "change_disposition", "target": "npc_bossar", "delta": 15},
                  {"type": "journal_update", "quest": "quest_garn", "text_key": "j_pass"},
                  MSG("Боссар бросает жестянку с клеймом: «Штрек за решёткой. Вернёшься — расскажешь, что там нашёл».")],
             manual=True, chapter="ch_slag"),

        rule("rule_bossar_debt", "Допуск в долг",
             [], [{"type": "set_flag", "flag": "deep_pass"},
                  {"type": "set_flag", "flag": "slagger_debt"},
                  {"type": "add_item", "item": "item_permit", "quantity": 1},
                  {"type": "journal_update", "quest": "quest_garn", "text_key": "j_pass"},
                  MSG("Боссар усмехается: «Иди. Потом отдашь — или за тобой придут».")],
             manual=True, chapter="ch_slag"),

        rule("rule_bossar_fight", "Боссар взят силой",
             [], [{"type": "set_flag", "flag": "deep_pass"},
                  {"type": "start_combat",
                   "enemies": [{"entity": "npc_bossar", "count": 1}, {"entity": "npc_thug", "count": 1}],
                   "arena": "arena_slag", "intro": "Боссар поднимает ключ: «Значит, по-плохому».",
                   "on_victory": [{"type": "set_flag", "flag": "bossar_fought"},
                                  {"type": "add_item", "item": "item_permit", "quantity": 1},
                                  {"type": "commit_crime", "id": "crime_assault", "bounty": 20},
                                  {"type": "change_disposition", "target": "faction_lower", "delta": -20},
                                  {"type": "meta_currency", "id": "meta_slag", "amount": 2},
                                  {"type": "journal_update", "quest": "quest_garn", "text_key": "j_pass"},
                                  MSG("Боссар сплёвывает кровью: «Забирай жестянку. Нижний город запомнит».")]}],
             manual=True, chapter="ch_slag"),

        rule("rule_lissa_calm", "Лисса успокоилась",
             [], [{"type": "set_flag", "flag": "lissa_found"},
                  {"type": "start_quest", "quest": "quest_lissa"},
                  {"type": "journal_update", "quest": "quest_lissa", "text_key": "j_found"},
                  {"type": "set_entity_state", "entity": "npc_lissa", "state": "friendly"},
                  MSG("Лисса выходит из дверного проёма и говорит быстро, глядя в пол.")],
             manual=True, chapter="ch_slag"),

        rule("rule_lissa_saved", "Лисса укрыта",
             [], [{"type": "set_flag", "flag": "lissa_saved"},
                  {"type": "clear_flag", "flag": "lissa_lost"},
                  {"type": "add_item", "item": "item_lissa_note", "quantity": 1},
                  {"type": "journal_update", "quest": "quest_lissa", "text_key": "j_saved"},
                  {"type": "change_disposition", "target": "npc_irena", "delta": 10},
                  {"type": "unlock_codex", "entry": "codex_directorate"},
                  MSG("Ирена уводит Лиссу через двор литейной: «Никто её здесь не найдёт».")],
             manual=True, chapter="ch_slag"),

        rule("rule_lissa_abandoned", "Лисса осталась на улице",
             [], [{"type": "set_flag", "flag": "lissa_lost"},
                  {"type": "clear_flag", "flag": "lissa_saved"},
                  {"type": "journal_update", "quest": "quest_lissa", "text_key": "j_lost"},
                  MSG("Лисса кивает и остаётся в проёме. Утром её там уже не будет.")],
             manual=True, chapter="ch_slag"),

        rule("rule_lissa_fate", "Что стало с Лиссой",
             [F("lissa_found"), NF("lissa_saved"), NF("lissa_lost"), ENTER_LOC("loc_machine")],
             [{"type": "set_flag", "flag": "lissa_lost"},
              {"type": "journal_update", "quest": "quest_lissa", "text_key": "j_lost"},
              MSG("По дороге вниз видно: в проёме Нижней улицы пусто, и торговка отводит взгляд.")],
             once=True, chapter="ch_heart"),

        rule("rule_hod_spoken", "Голос услышан",
             [], [{"type": "set_flag", "flag": "hod_spoken"},
                  {"type": "unlock_codex", "entry": "codex_conductor"},
                  {"type": "change_skill", "skill": "lore", "delta": 5},
                  MSG("Голос в трубах говорит медленно, как машина, которой некуда спешить.")],
             manual=True, chapter="ch_heart"),

        rule("rule_valent_met", "Управляющий вышел говорить",
             [], [{"type": "set_flag", "flag": "valent_met"},
                  {"type": "start_quest", "quest": "quest_heart"},
                  MSG("Валент Корр вытирает руки о платок: «Инспектор. Вы быстро».")],
             manual=True, chapter="ch_heart"),

        rule("rule_choice_truth", "Дело вынесено на суд",
             [], [{"type": "set_flag", "flag": "truth_exposed"},
                  {"type": "play_cutscene", "cutscene": "cutscene_truth"},
                  {"type": "meta_currency", "id": "meta_brass", "amount": 5},
                  {"type": "game_over_victory"}],
             manual=True, chapter="ch_heart"),

        rule("rule_choice_conductor", "Герой встал в ложе",
             [], [{"type": "set_flag", "flag": "became_conductor"},
                  {"type": "play_cutscene", "cutscene": "cutscene_conductor"},
                  {"type": "meta_currency", "id": "meta_slag", "amount": 8},
                  {"type": "game_over_victory"}],
             manual=True, chapter="ch_heart"),

        rule("rule_choice_flee", "Герой уходит из города",
             [], [{"type": "set_flag", "flag": "fled_with_ledger"},
                  {"type": "postcard", "image": "assets/img/scenes/scene_gate_day.jpg",
                   "text": "Пепел закрывает ворота за спиной.", "seconds": 6},
                  {"type": "meta_currency", "id": "meta_slag", "amount": 5},
                  {"type": "game_over_victory"}],
             manual=True, chapter="ch_heart"),

        rule("rule_choice_deal", "Договор принят",
             [], [{"type": "set_flag", "flag": "took_deal"},
                  {"type": "add_item", "item": "item_silver", "quantity": 40},
                  {"type": "postcard", "image": "assets/img/end.jpg",
                   "text": "Дело Гарна легло в архив как несчастный случай.", "seconds": 6},
                  {"type": "meta_currency", "id": "meta_slag", "amount": 4},
                  {"type": "game_over_victory"}],
             manual=True, chapter="ch_heart"),

        rule("rule_rust_warning", "Ржавь подошла к сердцу",
             [{"type": "has_status", "status": "status_rust"}, {"type": "hp_le", "threshold": 12}],
             [{"type": "set_flag", "flag": "rust_heavy"},
              {"type": "banner", "text": "Ржавь в крови", "preset": "проклятье", "seconds": 4, "enter": "всплеск"},
              MSG("Пальцы не разгибаются: ржавь добралась до суставов. Ещё немного — и она возьмёт своё.")],
             once=True, chapter="ch_deep"),

        rule("rule_camp_ambush", "Ночная вылазка",
             [], [{"type": "start_combat", "enemies": [{"entity": "npc_rusty", "count": 1}],
                   "arena": "arena_lower", "intro": "Лагерь выдают дымом: из темноты идёт ржавый.",
                   "on_victory": [{"type": "meta_currency", "id": "meta_slag", "amount": 1},
                                  MSG("Тварь оседает у костра. Смена продолжается.")]}],
             manual=True, chapter="ch_slag"),

        # --- события таблиц -------------------------------------------------
        rule("rule_ev_patrol", "Патруль караула",
             [], [MSG("По улице идёт патруль: фонарь, кашель, лязг. Бумаги спрашивают через одного."),
                  {"type": "change_need", "need": "need_rest", "delta": -4}],
             manual=True),
        rule("rule_ev_goods", "Пропали поставки",
             [], [{"type": "set_price_event", "id": "price_blockade"},
                  MSG("Лавки закрываются раньше: в город не пришёл караван, цены пошли вверх."),
                  {"type": "unlock_codex", "entry": "codex_directorate"}],
             manual=True),
        rule("rule_ev_rusty", "Ржавые из-под настила",
             [], [MSG("Из-под настила выбираются двое — вернее, то, что от них осталось."),
                  {"type": "start_combat",
                   "enemies": [{"entity": "npc_rusty", "count": 1}, {"entity": "npc_rat", "count": 2}],
                   "arena": "arena_lower", "intro": "Ржавь идёт на запах живого.",
                   "on_victory": [{"type": "set_flag", "flag": "encounter_won"},
                                  {"type": "meta_currency", "id": "meta_slag", "amount": 1},
                                  {"type": "unlock_codex", "entry": "codex_rust"}]}],
             manual=True),
        rule("rule_ev_ash", "Пеплопад усилился",
             [], [{"type": "set_weather", "weather": "weather_ash"},
                  MSG("Пепел идёт плотнее: дышать тяжело, а свет становится серым.")],
             manual=True),
        rule("rule_ev_fume", "Угар поднялся",
             [], [{"type": "set_weather", "weather": "weather_fume"},
                  MSG("Угар поднимается из штрека: туман стекает по ступеням.")],
             manual=True),
        rule("rule_ev_drizzle", "Морось",
             [], [{"type": "set_weather", "weather": "weather_drizzle"},
                  MSG("Сверху сеет мелкий дождь: на металле проступает ржавая испарина.")],
             manual=True),
    ]


QUESTS = [
    {"id": "quest_garn", "label": "Дело инспектора Гарна",
     "description": "Выяснить, что случилось с инспектором Гарном в Глубоком штреке.",
     "chapter": "ch_case",
     "journal_entries": {
         "j_notice": "У ворот висит казённое объявление: инспектор Гарн найден мёртвым, дело закрыто.",
         "j_market": "Рынок гудит: в участке сидит сержант Гула, в лечебнице — Ханна, в корчме — Марта.",
         "j_case": "В деле Гарна нет свидетелей и есть вкладыш, помеченный «металлолом».",
         "j_track": "На кран-балке — след волокли к решётке штрека. Нужен пропуск вниз.",
         "j_pass": "Пропуск в штрек на руках. За решёткой — то, что искал Гарн.",
         "j_body": "Тело Гарна лежит у крепи лицом вниз. Лицо спилено после смерти, под ногтями — латунная стружка.",
         "j_ledger": "Гроссбух найден: имена, даты и подпись Валента в последней строке.",
         "j_done": "Дело Гарна доведено до конца.",
         "j_failed": "Дело Гарна закрыто не в пользу правды.",
     },
     "stages": [
         {"id": "stage_start", "label": "Начало поисков",
          "on_enter_effects": [{"type": "journal_update", "quest": "quest_garn", "text_key": "j_notice"}],
          "transitions": [{"to": "stage_body", "conditions": [F("garn_body_found")]}]},
         {"id": "stage_body", "label": "Тело в штреке",
          "on_enter_effects": [{"type": "journal_update", "quest": "quest_garn", "text_key": "j_body"}],
          "transitions": [{"to": "stage_ledger", "conditions": [F("ledger_taken")]}]},
         {"id": "stage_ledger", "label": "Гроссбух на руках",
          "on_enter_effects": [{"type": "journal_update", "quest": "quest_garn", "text_key": "j_ledger"}],
          "transitions": [
              {"to": "stage_done", "conditions": [F("truth_exposed")]},
              {"to": "stage_failed", "conditions": [{"type": "or", "conditions": [F("took_deal"), F("fled_with_ledger")]}]},
          ]},
         {"id": "stage_done", "label": "Дело закрыто правдой", "final": True, "outcome": "success",
          "on_enter_effects": [{"type": "journal_update", "quest": "quest_garn", "text_key": "j_done"},
                               {"type": "grant_xp", "points": 40},
                               {"type": "meta_currency", "id": "meta_slag", "amount": 5}]},
         {"id": "stage_failed", "label": "Дело закрыто тихо", "final": True, "outcome": "failure",
          "on_enter_effects": [{"type": "journal_update", "quest": "quest_garn", "text_key": "j_failed"},
                               {"type": "grant_xp", "points": 15}]},
     ]},

    {"id": "quest_names", "label": "Списанные люди",
     "description": "Собрать свидетельства о том, куда пропадают люди из Нижнего города.",
     "chapter": "ch_works",
     "journal_entries": {
         "j_start": "С Нижней улицы за месяц пропали четверо. Никто не подавал бумаг.",
         "j_implant": "В породе найден латунный вкладыш с номером — такие ставят в череп живым.",
         "j_hanna": "Ханна говорит: ржавь — это счёт, который выставляют человеку за чужое тепло.",
         "j_done": "Правда о «поставке» собрана: имена, вкладыши и вклады.",
     },
     "stages": [
         {"id": "stage_start", "label": "Слухи об исчезновениях",
          "on_enter_effects": [{"type": "journal_update", "quest": "quest_names", "text_key": "j_start"}],
          "transitions": [{"to": "stage_evidence", "conditions": [F("implant_found")]}]},
         {"id": "stage_evidence", "label": "Вкладыш на руках",
          "on_enter_effects": [{"type": "journal_update", "quest": "quest_names", "text_key": "j_implant"}],
          "transitions": [{"to": "stage_done", "conditions": [{"type": "or", "conditions": [F("hod_spoken"), F("truth_exposed")]}]}]},
         {"id": "stage_done", "label": "Картина собрана", "final": True, "outcome": "success",
          "on_enter_effects": [{"type": "journal_update", "quest": "quest_names", "text_key": "j_done"},
                               {"type": "grant_xp", "points": 25},
                               {"type": "meta_currency", "id": "meta_slag", "amount": 3}]},
     ]},

    {"id": "quest_debt", "label": "Долг Марты",
     "description": "Боссар требует с корчмы долг; Марта просит уладить дело.",
     "chapter": "ch_slag",
     "journal_entries": {
         "j_debt": "Боссар ждёт пятнадцать марок с корчмы. Марта просит закрыть долг миром.",
         "j_paid": "Долг Марты закрыт. Корчма снова принимает героя как своего.",
         "j_failed": "Корчма закрылась: долг так и не закрыли.",
     },
     "stages": [
         {"id": "stage_start", "label": "Долг взят",
          "on_enter_effects": [{"type": "journal_update", "quest": "quest_debt", "text_key": "j_debt"}],
          "transitions": [{"to": "stage_paid", "conditions": [F("debt_paid")]},
                          {"to": "stage_failed", "conditions": [{"type": "or", "conditions": [F("took_deal"), F("fled_with_ledger")]}]}]},
         {"id": "stage_paid", "label": "Рассчитались", "final": True, "outcome": "success",
          "on_enter_effects": [{"type": "journal_update", "quest": "quest_debt", "text_key": "j_paid"},
                               {"type": "grant_xp", "points": 20},
                               {"type": "meta_currency", "id": "meta_slag", "amount": 2}]},
         {"id": "stage_failed", "label": "Долг остался", "final": True, "outcome": "failure",
          "on_enter_effects": [{"type": "journal_update", "quest": "quest_debt", "text_key": "j_failed"}]},
     ]},

    {"id": "quest_lissa", "label": "Подмастерье Лисса",
     "description": "Найти Лиссу, которая собирала вкладыши для «поставки», и решить её судьбу.",
     "chapter": "ch_slag",
     "journal_entries": {
         "j_found": "Лисса нашлась в проёме Нижней улицы: она собирала вкладыши и видела «Тихую».",
         "j_saved": "Ирена укрыла Лиссу в литейной. Она будет свидетелем на суде.",
         "j_lost": "Лиссу не укрыли. В проёме Нижней улицы пусто.",
     },
     "stages": [
         {"id": "stage_start", "label": "Поиски",
          "on_enter_effects": [{"type": "journal_update", "quest": "quest_lissa", "text_key": "j_found"}],
          "transitions": [{"to": "stage_saved", "conditions": [F("lissa_saved")]},
                          {"to": "stage_lost", "conditions": [F("lissa_lost")]}]},
         {"id": "stage_saved", "label": "Укрыта", "final": True, "outcome": "success",
          "on_enter_effects": [{"type": "journal_update", "quest": "quest_lissa", "text_key": "j_saved"},
                               {"type": "grant_xp", "points": 20}]},
         {"id": "stage_lost", "label": "Потеряна", "final": True, "outcome": "failure",
          "on_enter_effects": [{"type": "journal_update", "quest": "quest_lissa", "text_key": "j_lost"}]},
     ]},

    {"id": "quest_pressure", "label": "Давление",
     "description": "Восстановить давление в насосной станции, чтобы открыть машинный зал.",
     "chapter": "ch_heart",
     "journal_entries": {
         "j_start": "В насосной сорвана резьба на главном клапане: без давления в зал не войти.",
         "j_valve": "Клапан собран, трубы выровняли дыхание. Обходной патрубок открыт.",
     },
     "stages": [
         {"id": "stage_start", "label": "Клапан сорван",
          "on_enter_effects": [{"type": "journal_update", "quest": "quest_pressure", "text_key": "j_start"}],
          "transitions": [{"to": "stage_fixed", "conditions": [F("valve_fixed")]}]},
         {"id": "stage_fixed", "label": "Давление есть", "final": True, "outcome": "success",
          "on_enter_effects": [{"type": "journal_update", "quest": "quest_pressure", "text_key": "j_valve"},
                               {"type": "grant_xp", "points": 25}]},
     ]},

    {"id": "quest_heart", "label": "Судьба Хода",
     "description": "Решить, чем город заплатит за тепло: правдой, человеком, бегством или молчанием.",
     "chapter": "ch_heart",
     "journal_entries": {
         "j_start": "Валент ждёт решения у сердца Хода. Голос в трубах ждёт того же.",
         "j_truth": "Выбрано: вынести дело на суд Ревизии.",
         "j_grey": "Выбрано: город остаётся тёплым — но не по правде.",
     },
     "stages": [
         {"id": "stage_start", "label": "Разговор у сердца",
          "on_enter_effects": [{"type": "journal_update", "quest": "quest_heart", "text_key": "j_start"}],
          "transitions": [
              {"to": "stage_truth", "conditions": [F("truth_exposed")]},
              {"to": "stage_grey", "conditions": [{"type": "or", "conditions": [F("became_conductor"), F("fled_with_ledger"), F("took_deal")]}]},
          ]},
         {"id": "stage_truth", "label": "Правда", "final": True, "outcome": "success",
          "on_enter_effects": [{"type": "journal_update", "quest": "quest_heart", "text_key": "j_truth"},
                               {"type": "grant_xp", "points": 60},
                               {"type": "meta_currency", "id": "meta_slag", "amount": 10}]},
         {"id": "stage_grey", "label": "Серое решение", "final": True, "outcome": "success",
          "on_enter_effects": [{"type": "journal_update", "quest": "quest_heart", "text_key": "j_grey"},
                               {"type": "grant_xp", "points": 40},
                               {"type": "meta_currency", "id": "meta_slag", "amount": 6}]},
     ]},
]


def _arena(aid, label, cols, rows, size, player_hexes, enemy_hexes,
           blocked=None, difficult=None, cover=None, music="music_battle", ambient="amb_hum"):
    return {"id": aid, "label": label, "image": "",
            "canvas": {"w": 1280, "h": 720},
            "hex_grid": {"cols": cols, "rows": rows, "hex_size": size, "offset": "odd-r",
                         "blocked_hexes": blocked or [], "difficult_terrain": difficult or [],
                         "cover_hexes": cover or []},
            "spawn_zones": {"player": {"hexes": player_hexes}, "enemy": {"hexes": enemy_hexes}},
            "ambient_audio": ambient, "music": music}


ARENAS = [
    _arena("arena_market", "Тёмный переулок у рынка", 12, 7, 40,
           [[0, 1], [0, 2], [0, 3]], [[11, 1], [11, 2], [11, 3], [10, 2]],
           blocked=[[4, 0], [5, 6], [6, 3], [7, 4]], difficult=[[5, 2], [6, 2]],
           cover=[[3, 5], [8, 1]]),
    _arena("arena_lower", "Нижняя улица", 12, 7, 40,
           [[0, 1], [0, 2], [0, 3]], [[11, 1], [11, 2], [11, 3], [10, 2], [10, 4]],
           blocked=[[3, 0], [4, 6], [8, 3], [9, 5]], difficult=[[5, 1], [5, 2], [6, 3]],
           cover=[[2, 5], [9, 1]]),
    _arena("arena_slag", "Шлаковые ямы", 14, 8, 38,
           [[0, 2], [0, 3], [0, 4]], [[13, 2], [13, 3], [13, 4], [12, 3], [12, 5]],
           blocked=[[5, 1], [6, 6], [9, 2], [4, 5]], difficult=[[6, 3], [7, 3], [8, 4], [5, 4]],
           cover=[[3, 6], [10, 1]]),
    _arena("arena_deep", "Глубокий штрек", 10, 6, 40,
           [[0, 1], [0, 2], [0, 3]], [[9, 1], [9, 2], [9, 3]],
           blocked=[[3, 0], [4, 5], [6, 2]], difficult=[[2, 2], [7, 3]],
           cover=[[4, 3], [6, 1]]),
    _arena("arena_machine", "Машинный зал", 12, 8, 38,
           [[0, 2], [0, 3], [0, 4]], [[11, 2], [11, 3], [11, 4], [10, 3]],
           blocked=[[3, 1], [4, 6], [7, 4], [8, 2]], difficult=[[5, 3], [6, 3], [6, 4]],
           cover=[[3, 4], [8, 1]]),
]


def _slide(art, text, transition="fade", duration=None):
    s = {"art": art, "text": text, "transition": transition}
    if duration:
        s["duration"] = duration
    return s


def _art(bg, layers):
    return {"canvas": {"w": 1280, "h": 720}, "background": bg, "layers": layers}


CUTSCENES = [
    {"id": "cutscene_intro", "label": "Пролог: пепельные ворота", "music": "music_menu",
     "chapter": "ch_prologue",
     "slides": [
         _slide(_art("#1a1512", [
             {"label": "пепел", "shape": {"type": "ellipse", "cx": 640, "cy": 300, "rx": 420, "ry": 200,
                                          "fill": "#3a322a", "opacity": 0.5}},
             {"label": "дорога", "shape": {"type": "polygon", "points": [420, 720, 560, 380, 720, 380, 900, 720],
                                           "fill": "#241d18"}},
             {"label": "ворота", "shape": {"type": "rect", "x": 540, "y": 300, "w": 200, "h": 260,
                                           "fill": "#12100e", "stroke": "#c8873a", "stroke_width": 4, "radius": 10}},
         ]), "Пепельная зима пришла в Медный Ход третью неделю назад. Город грелся об машину, машина — об людей.", "panzoom", 7),
         _slide(_art("#141110", [
             {"label": "террасы", "shape": {"type": "rect", "x": 120, "y": 420, "w": 1040, "h": 60,
                                            "fill": "#241d18", "stroke": "#6b4f2a", "stroke_width": 3}},
             {"label": "трубы", "shape": {"type": "line", "x1": 300, "y1": 300, "x2": 300, "y2": 420,
                                          "color": "#6b4f2a", "width": 8}},
             {"label": "трубы 2", "shape": {"type": "line", "x1": 980, "y1": 250, "x2": 980, "y2": 420,
                                            "color": "#6b4f2a", "width": 8}},
             {"label": "свет", "shape": {"type": "ellipse", "cx": 640, "cy": 200, "rx": 300, "ry": 120,
                                         "fill": "#4a3a28", "opacity": 0.35}},
         ]), "Инспектора Ревизии Гарна достали из шлаковых ям. Лицо ему спилили уже после смерти.", "fade", 7),
         _slide(_art("#0f0d0c", [
             {"label": "бумага", "shape": {"type": "rect", "x": 420, "y": 220, "w": 440, "h": 300,
                                           "fill": "#d8cfc0", "stroke": "#8a7a63", "stroke_width": 3}},
             {"label": "печать", "shape": {"type": "ellipse", "cx": 800, "cy": 460, "rx": 34, "ry": 34,
                                           "fill": "#8a2b1f", "opacity": 0.8}},
             {"label": "строки", "shape": {"type": "line", "x1": 460, "y1": 280, "x2": 820, "y2": 280,
                                           "color": "#5a5040", "width": 4}},
             {"label": "строки 2", "shape": {"type": "line", "x1": 460, "y1": 320, "x2": 760, "y2": 320,
                                             "color": "#5a5040", "width": 4}},
             {"label": "строки 3", "shape": {"type": "line", "x1": 460, "y1": 360, "x2": 800, "y2": 360,
                                             "color": "#5a5040", "width": 4}},
         ]), "Дело закрыли за один день — и подписали так, будто торопились забыть.", "slide", 7),
         _slide(_art("#1c1713", [
             {"label": "город", "shape": {"type": "rect", "x": 0, "y": 560, "w": 1280, "h": 160, "fill": "#100d0b"}},
             {"label": "окна", "shape": {"type": "ellipse", "cx": 300, "cy": 520, "rx": 12, "ry": 8,
                                         "fill": "#c8873a", "opacity": 0.8}},
             {"label": "окна 2", "shape": {"type": "ellipse", "cx": 340, "cy": 530, "rx": 10, "ry": 6,
                                           "fill": "#c8873a", "opacity": 0.6}},
             {"label": "окна 3", "shape": {"type": "ellipse", "cx": 900, "cy": 525, "rx": 12, "ry": 8,
                                           "fill": "#c8873a", "opacity": 0.7}},
         ]), "Новый инспектор въехал в город утром, с бумагой и правом задавать вопросы.", "fade", 6),
     ]},

    {"id": "cutscene_vision", "label": "Что помнит Ход", "music": "music_deep", "chapter": "ch_heart",
     "slides": [
         _slide(_art("#0d0c0b", [
             {"label": "трубы", "shape": {"type": "polygon", "points": [0, 720, 200, 260, 420, 720],
                                          "fill": "#1c1712", "stroke": "#4a3a28", "stroke_width": 3}},
             {"label": "искры", "shape": {"type": "ellipse", "cx": 300, "cy": 300, "rx": 160, "ry": 90,
                                          "fill": "#c8873a", "opacity": 0.15}},
         ]), "«Я помню восемь. Седьмой держался три зимы и просил воды».", "fade", 7),
         _slide(_art("#12100e", [
             {"label": "ложе", "shape": {"type": "rect", "x": 460, "y": 380, "w": 360, "h": 180,
                                         "fill": "#2a221a", "stroke": "#c8873a", "stroke_width": 3, "radius": 20}},
             {"label": "трубки", "shape": {"type": "line", "x1": 560, "y1": 380, "x2": 560, "y2": 240,
                                           "color": "#6b4f2a", "width": 6}},
             {"label": "трубки 2", "shape": {"type": "line", "x1": 720, "y1": 380, "x2": 720, "y2": 240,
                                             "color": "#6b4f2a", "width": 6}},
         ]), "«Город просит тепла. Я беру, что дают. Мне не жаль — я не умею жалеть».", "fade", 7),
         _slide(_art("#151210", [
             {"label": "стена", "shape": {"type": "rect", "x": 0, "y": 0, "w": 1280, "h": 720, "fill": "#151210"}},
             {"label": "надпись", "shape": {"type": "text", "x": 640, "y": 360, "text": "ИМЯ", "size": 120,
                                            "color": "#c8873a", "align": "middle"}},
             {"label": "царапины", "shape": {"type": "line", "x1": 420, "y1": 420, "x2": 860, "y2": 420,
                                             "color": "#4a3a28", "width": 3}},
         ]), "«Скажи имя — и я запомню тебя, как помню остальных».", "fade", 6),
     ]},

    {"id": "cutscene_truth", "label": "Гласность", "music": "music_ending", "chapter": "ch_heart",
     "slides": [
         _slide(_art("#1a1714", [
             {"label": "стол", "shape": {"type": "rect", "x": 240, "y": 420, "w": 800, "h": 40,
                                         "fill": "#33291f", "stroke": "#8a7a63", "stroke_width": 3}},
             {"label": "гроссбух", "shape": {"type": "rect", "x": 540, "y": 340, "w": 200, "h": 80,
                                             "fill": "#5a3a22", "stroke": "#c8873a", "stroke_width": 2}},
             {"label": "свет", "shape": {"type": "ellipse", "cx": 640, "cy": 200, "rx": 260, "ry": 140,
                                         "fill": "#c8873a", "opacity": 0.12}},
         ]), "Гроссбух, вкладыш и показания легли на стол Ревизии.", "fade", 7),
         _slide(_art("#141110", [
             {"label": "терраса", "shape": {"type": "rect", "x": 100, "y": 460, "w": 1080, "h": 50,
                                            "fill": "#241d18", "stroke": "#6b4f2a", "stroke_width": 3}},
             {"label": "люди", "shape": {"type": "ellipse", "cx": 400, "cy": 430, "rx": 22, "ry": 34, "fill": "#2e2620"}},
             {"label": "люди 2", "shape": {"type": "ellipse", "cx": 640, "cy": 430, "rx": 22, "ry": 34, "fill": "#2e2620"}},
             {"label": "люди 3", "shape": {"type": "ellipse", "cx": 880, "cy": 430, "rx": 22, "ry": 34, "fill": "#2e2620"}},
         ]), "Валента сместили. Ход перевели на холодный режим — и первая зима собрала свою цену по именам.", "fade", 8),
     ]},

    {"id": "cutscene_conductor", "label": "Новый проводник", "music": "music_machine", "chapter": "ch_heart",
     "slides": [
         _slide(_art("#12100e", [
             {"label": "ложе", "shape": {"type": "rect", "x": 440, "y": 360, "w": 400, "h": 200,
                                         "fill": "#2a221a", "stroke": "#c8873a", "stroke_width": 3, "radius": 24}},
             {"label": "свет", "shape": {"type": "ellipse", "cx": 640, "cy": 320, "rx": 320, "ry": 160,
                                         "fill": "#c8873a", "opacity": 0.15}},
         ]), "Герой сам лёг в латунное ложе. Трубки вошли легко, как в сырую землю.", "fade", 7),
         _slide(_art("#1a1512", [
             {"label": "город", "shape": {"type": "rect", "x": 0, "y": 560, "w": 1280, "h": 160, "fill": "#100d0b"}},
             {"label": "окна", "shape": {"type": "ellipse", "cx": 420, "cy": 520, "rx": 14, "ry": 9,
                                         "fill": "#e0b060", "opacity": 0.9}},
             {"label": "окна 2", "shape": {"type": "ellipse", "cx": 720, "cy": 530, "rx": 12, "ry": 8,
                                           "fill": "#e0b060", "opacity": 0.8}},
         ]), "Ход выровнялся на его пульсе. Город спал в тепле и не спрашивал, чьим дыханием оно держится.", "fade", 8),
     ]},
]


ENCOUNTER_TABLES = [
    {"id": "enc_market", "rolls": 1,
     "entries": [
         {"weight": 6, "type": "nothing"},
         {"weight": 2, "type": "event", "message": "Мимо проходит патруль с фонарём.",
          "effects": [{"type": "show_message", "text": "Патруль смотрит на бумаги, но не находит печати."}]},
         {"weight": 1, "type": "dialogue", "entity": "npc_vein"},
     ]},
    {"id": "enc_lower", "rolls": 1,
     "entries": [
         {"weight": 5, "type": "nothing"},
         {"weight": 2, "type": "combat", "enemies": [{"entity": "npc_rat", "count_min": 1, "count_max": 3}],
          "arena": "arena_lower", "intro": "Из-под настила выкатывается стая шестерённых крыс."},
         {"weight": 2, "type": "event", "message": "Угар поднимается из штрека.",
          "effects": [{"type": "set_weather", "weather": "weather_fume"},
                      {"type": "change_need", "need": "need_breath", "delta": -10}]},
         {"weight": 1, "type": "skill_check", "skill": "spot", "difficulty": 40,
          "message": "В темноте что-то блестит.",
          "success_effects": [{"type": "add_item", "item": "item_brass", "quantity": 2},
                              {"type": "show_message", "text": "В щебне — латунная стружка: кто-то недавно чинил здесь машину."}],
          "fail_effects": [{"type": "show_message", "text": "Блеск оказался мокрым камнем."}]},
     ]},
    {"id": "enc_deep", "rolls": 1,
     "entries": [
         {"weight": 4, "type": "nothing"},
         {"weight": 3, "type": "combat", "enemies": [{"entity": "npc_rusty", "count_min": 1, "count_max": 2}],
          "arena": "arena_deep", "intro": "В темноте кто-то поднимается на звук шагов."},
         {"weight": 2, "type": "event", "message": "Своды дрожат.",
          "effects": [{"type": "apply_status", "target": "player", "status": "status_bleed", "duration": 3},
                      {"type": "change_hp", "delta": -2},
                      {"type": "show_message", "text": "С потолка сыплется порода: мелкий камень рассекает плечо."}]},
         {"weight": 2, "type": "dialogue", "entity": "npc_quiet"},
         {"weight": 1, "type": "skill_check", "skill": "stealth", "difficulty": 50,
          "message": "Впереди слышны шаги.",
          "success_effects": [{"type": "show_message", "text": "Шаги проходят мимо: удалось слиться с крепью."}],
          "fail_effects": [{"type": "start_combat", "enemies": [{"entity": "npc_quiet", "count": 1}],
                            "arena": "arena_deep", "intro": "«Тихая» выходит из темноты навстречу."}]},
     ]},
]


RECIPES = [
    {"id": "recipe_filter", "label": "Фильтр-маска", "known": False,
     "description": "Уголь в ткани и проволочный каркас: пропускает воздух, держит угар.",
     "inputs": [{"item": "item_cloth", "quantity": 2}, {"item": "item_charcoal", "quantity": 2},
                {"item": "item_wire", "quantity": 1}],
     "tools": ["item_toolkit"],
     "requires": [{"type": "flag_set", "flag": "filter_known"}],
     "skill": {"id": "mechanics", "difficulty": 40},
     "time_ticks": 2,
     "output": {"item": "item_filter", "quantity": 1},
     "message": "Маска садится плотно. Дышать через ткань непривычно, но дышится."},

    {"id": "recipe_tonic", "label": "Осадок от ржави", "known": False,
     "description": "Настойка, которая связывает металл в тканях.",
     "inputs": [{"item": "item_herb", "quantity": 2}, {"item": "item_spirt", "quantity": 1}],
     "tools": [],
     "requires": [{"type": "flag_set", "flag": "clinic_helped"}],
     "skill": {"id": "medicine", "difficulty": 40},
     "time_ticks": 2,
     "output": {"item": "item_tonic", "quantity": 1},
     "message": "Настойка горчит, зато руки снова слушаются."},

    {"id": "recipe_stimm", "label": "Стим-ампула", "known": True,
     "description": "Аптечный стим: держит руки и ноги, пока не выгорел.",
     "inputs": [{"item": "item_brass", "quantity": 1}, {"item": "item_herb", "quantity": 1},
                {"item": "item_spirt", "quantity": 1}],
     "tools": ["item_toolkit"],
     "requires": [],
     "skill": {"id": "medicine", "difficulty": 35},
     "time_ticks": 1,
     "output": {"item": "item_stimm", "quantity": 1},
     "message": "Ампула выходит мутной, но рабочей."},

    {"id": "recipe_repair_tools", "label": "Починка инструмента", "known": True, "repair": True,
     "description": "Латунь и проволока возвращают инструменту твёрдость.",
     "inputs": [{"item": "item_brass", "quantity": 1}, {"item": "item_wire", "quantity": 1}],
     "tools": [],
     "requires": [],
     "skill": {"id": "mechanics", "difficulty": 30},
     "time_ticks": 1,
     "output": {"item": "item_wrench", "quantity": 1},
     "message": "Инструмент снова держит нагрузку."},
]


CODEX = [
    {"id": "codex_hod", "label": "Ход", "category": "machines",
     "text": ("Сердце Медного Хода — машина древнее самого города. Она поднимает руду, греет воду и держит "
              "тепло в террасах. Ход не быстрый и не злой: он просто работает, пока в нём есть проводник. "
              "Когда проводник слабеет, машина сбивается, и город начинает мёрзнуть изнутри.")},
    {"id": "codex_conductor", "label": "Проводники", "category": "machines",
     "creature_entity": "npc_hod",
     "text": ("Живой человек в латунном ложе — регулятор Хода. Проводник чувствует машину телом: гул, давление, "
              "жар. Их было восемь. Седьмой держался три зимы. Восьмого выбирает Дирекция — и никто из выбранных "
              "не выходил из зала сам.")},
    {"id": "codex_rust", "label": "Ржавь", "category": "creatures",
     "creature_entity": "npc_rusty",
     "text": ("Металл в тканях. Начинается с холода в суставах и серой испарины, кончается тем, что человек "
              "перестаёт быть человеком. Ржавь не заразна: её выставляет счёт вода из штрека и угарный туман. "
              "Чистый спирт, трава-жгунец и осадок Ханны снимают начало, но не долг.")},
    {"id": "codex_lower", "label": "Шлаковые ямы", "category": "places",
     "text": ("Нижний город живёт под рынком: бригады, шлак, вагонетки и корчмы без вывесок. Здесь не спрашивают "
              "бумаг и не любят Дирекцию. За месяц с Нижней улицы пропали четверо — и ни по одному не завели дела.")},
    {"id": "codex_quiet", "label": "Тихая стража", "category": "chronicles",
     "creature_entity": "npc_quiet",
     "text": ("Служба Дирекции, которая не носит формы. «Тихие» не спорят и не угрожают: они приходят, когда "
              "дело нужно закрыть, а не раскрыть. Их приказы подписаны тем же человеком, что подписывает поставки "
              "в Ход.")},
    {"id": "codex_garn_case", "label": "Дело Гарна", "category": "chronicles",
     "text": ("Инспектор Ревизии Гарн вёл ревизию поставок и нашёл колонку имён без объяснений. Его тело нашли "
              "в Глубоком штреке: лицо спилено, под ногтями латунная стружка, в бумагах — ни одного свидетеля. "
              "Дело закрыли за день и подписали в двух местах разными руками.")},
    {"id": "codex_directorate", "label": "Дирекция Коллегии Шестерни", "category": "chronicles",
     "text": ("Верхняя терраса: инженеры, надзор и управляющий Валент Корр. Дирекция держит цены, поставки, "
              "спуски и молчание. Формально она отвечает за тепло в городе; фактически — за то, чтобы никто "
              "не считал, сколько это тепло стоит в людях.")},
]


GENERATORS = {
    "event_tables": [
        {"id": "ev_market", "label": "События рынка", "interval_ticks": 10, "chance": 0.5,
         "locations": ["loc_market", "loc_gate"], "time_of_day": ["morning", "day", "evening"],
         "rules": ["rule_ev_patrol", "rule_ev_goods", "rule_ev_drizzle"]},
        {"id": "ev_lower", "label": "События Нижней улицы", "interval_ticks": 8, "chance": 0.6,
         "locations": ["loc_lower", "loc_works"],
         "rules": ["rule_ev_rusty", "rule_ev_ash", "rule_ev_patrol"]},
        {"id": "ev_deep", "label": "События штрека", "interval_ticks": 6, "chance": 0.7,
         "locations": ["loc_deep", "loc_machine"],
         "rules": ["rule_ev_fume", "rule_ev_rusty", "rule_ev_ash"]},
    ]
}


# --- правила, которые зовут диалоги ----------------------------------------
def RULES_EXTRA():
    return [
        rule("rule_guard_papers", "Бумага Ревизии показана",
             [], [{"type": "set_flag", "flag": "guard_let_in"},
                  {"type": "start_quest", "quest": "quest_garn"},
                  {"type": "unlock_codex", "entry": "codex_garn_case"},
                  {"type": "change_disposition", "target": "npc_guard", "delta": 5},
                  MSG("Караульный возвращает бумагу и отступает в сторону: «Вниз не ходите, инспектор».")],
             manual=True, chapter="ch_prologue"),

        rule("rule_guard_press", "Нажим на караульного",
             [], [{"type": "skill_check_gate", "skill": "intimidate", "difficulty": 45,
                   "success_effects": [{"type": "set_flag", "flag": "guard_let_in"},
                                       {"type": "start_quest", "quest": "quest_garn"},
                                       {"type": "journal_update", "quest": "quest_garn", "text_key": "j_track"},
                                       {"type": "change_disposition", "target": "npc_guard", "delta": -10},
                                       MSG("Караульный отступает: «Кран-балку в ямах чинили дважды. Спросите, почему».")],
                   "fail_effects": [{"type": "change_disposition", "target": "npc_guard", "delta": -15},
                                    {"type": "change_need", "need": "need_rest", "delta": -5},
                                    MSG("Караульный смотрит мимо: «Не пугайте, инспектор. Смена длинная».")]}],
             manual=True, chapter="ch_prologue"),

        rule("rule_guard_bribe", "Караульный взял марку",
             [], [{"type": "remove_item", "item": "item_silver", "quantity": 5},
                  {"type": "set_flag", "flag": "guard_let_in"},
                  {"type": "start_quest", "quest": "quest_garn"},
                  {"type": "change_disposition", "target": "npc_guard", "delta": 5},
                  MSG("Марка исчезает в рукавице: «Проходите. И на рынке не шумите».")],
             manual=True, chapter="ch_prologue"),

        rule("rule_vein_hint", "Клёп о Гарне",
             [], [{"type": "journal_update", "quest": "quest_garn", "text_key": "j_case"},
                  MSG("Клёп складывает пальцы: «Гарн три раза ходил вниз. На четвёртый его вытащили кран-балкой».")],
             manual=True, chapter="ch_case"),

        rule("rule_vein_missing", "Клёп о пропажах",
             [], [{"type": "journal_update", "quest": "quest_names", "text_key": "j_start"},
                  {"type": "start_quest", "quest": "quest_names"},
                  MSG("Клёп загибает пальцы: двое бригадных, один бездомный, одна медянка. Бумаг — ни по кому.")],
             manual=True, chapter="ch_case"),

        rule("rule_sergeant_case", "Дело Гарна на руки",
             [], [{"type": "set_flag", "flag": "case_taken"},
                  {"type": "start_quest", "quest": "quest_garn"},
                  {"type": "unlock_codex", "entry": "codex_garn_case"},
                  {"type": "journal_update", "quest": "quest_garn", "text_key": "j_case"},
                  MSG("Гула выкладывает папку: «Полка за вашей спиной. Читайте, потом расспрашивайте».")],
             manual=True, chapter="ch_case"),

        rule("rule_sergeant_squeeze", "Нажать на Гулу",
             [], [{"type": "skill_check_gate", "skill": "persuade", "difficulty": 55,
                   "success_effects": [{"type": "unlock_codex", "entry": "codex_directorate"},
                                       {"type": "journal_update", "quest": "quest_garn", "text_key": "j_track"},
                                       {"type": "change_disposition", "target": "npc_sergeant", "delta": 10},
                                       MSG("Гула понижает голос: «Приказ пришёл с террасы. Печать Валента. Больше я ничего не знаю».")],
                   "fail_effects": [{"type": "change_disposition", "target": "npc_sergeant", "delta": -5},
                                    MSG("Гула поднимает глаза: «Не давите. Я тут не за это деньги получаю».")]}],
             manual=True, chapter="ch_case"),

        rule("rule_sergeant_names", "Гула о пропажах",
             [], [{"type": "journal_update", "quest": "quest_names", "text_key": "j_start"},
                  {"type": "start_quest", "quest": "quest_names"},
                  MSG("Гула читает по своей тетради: четверо, все молодые, все из бригад. Дела не заводили.")],
             manual=True, chapter="ch_case"),

        rule("rule_medic_names", "Ханна о телах",
             [], [{"type": "add_item", "item": "item_herb", "quantity": 2},
                  {"type": "journal_update", "quest": "quest_names", "text_key": "j_hanna"},
                  {"type": "start_quest", "quest": "quest_names"},
                  MSG("Ханна заворачивает сухую траву: «Жгунец. Пригодится, если полезете вниз».")],
             manual=True, chapter="ch_case"),

        rule("rule_marta_rumors", "Слухи Марты",
             [], [{"type": "journal_update", "quest": "quest_garn", "text_key": "j_track"},
                  {"type": "reveal_location", "location": "loc_lower"},
                  MSG("Марта понижает голос: «Кран-балку в ямах чинили дважды. И оба раза ночью».")],
             manual=True, chapter="ch_case"),

        rule("rule_marta_debt", "Долг корчмы взят",
             [], [{"type": "set_flag", "flag": "debt_taken"},
                  {"type": "start_quest", "quest": "quest_debt"},
                  {"type": "journal_update", "quest": "quest_debt", "text_key": "j_debt"},
                  MSG("Марта кивает: «Боссар у отвала в шлаковых ямах. Скажешь, что от меня».")],
             manual=True, chapter="ch_case"),

        rule("rule_marta_hint", "Марта о Ирене и Лиссе",
             [], [{"type": "reveal_location", "location": "loc_works"},
                  {"type": "journal_update", "quest": "quest_lissa", "text_key": "j_found"},
                  MSG("Марта стучит по стойке: «Ирена — литейная. Лисса — внизу. Начинай с Ирены, к ней хотя бы просто войти».")],
             manual=True, chapter="ch_case"),

        rule("rule_irena_met", "Разговор с Иреной",
             [], [{"type": "set_flag", "flag": "met_irena"},
                  {"type": "reveal_location", "location": "loc_machine"},
                  {"type": "change_disposition", "target": "npc_irena", "delta": 5},
                  MSG("Ирена вытирает руки: «Значит, вы не из тех, кто закрывает глаза. Посмотрим».")],
             manual=True, chapter="ch_works"),

        rule("rule_irena_ally", "Ирена идёт с героем",
             [], [{"type": "set_flag", "flag": "irena_joined"},
                  {"type": "change_disposition", "target": "npc_irena", "delta": 10},
                  MSG("Ирена поднимает сумку с инструментом: «Вниз пойдём вместе. И без глупостей».")],
             manual=True, chapter="ch_heart"),

        rule("rule_bossar_supply", "Боссар о поставке",
             [], [{"type": "unlock_codex", "entry": "codex_directorate"},
                  {"type": "journal_update", "quest": "quest_names", "text_key": "j_implant"},
                  MSG("Боссар сплёвывает в шлак: «Приходят с печатью и предлагают выбор: человек или вся бригада».")],
             manual=True, chapter="ch_slag"),

        rule("rule_bossar_garn", "Боссар о Гарне",
             [], [{"type": "journal_update", "quest": "quest_garn", "text_key": "j_track"},
                  MSG("Боссар отворачивается: «Я ему сказал: не лезь один. Он полез».")],
             manual=True, chapter="ch_slag"),

        rule("rule_quiet_talk", "Разговор с «Тихой»",
             [], [{"type": "change_disposition", "target": "faction_quiet", "delta": 5},
                  {"type": "unlock_codex", "entry": "codex_quiet"},
                  MSG("Серая фигура не поднимает лица: «Я не спорю с бумагами. Я их исполняю».")],
             manual=True, chapter="ch_deep"),

        rule("rule_quiet_let_go", "«Тихая» отпустила",
             [], [{"type": "set_flag", "flag": "quiet_defeated"},
                  {"type": "stop_pursuit"},
                  {"type": "meta_currency", "id": "meta_slag", "amount": 2},
                  MSG("Шаги стихают. «Тихая» осталась наверху — на этот раз.")],
             manual=True, chapter="ch_deep"),

        rule("rule_quiet_fight", "Бой в штреке",
             [], [{"type": "start_combat",
                   "enemies": [{"entity": "npc_quiet", "count": 1}],
                   "arena": "arena_deep", "intro": "«Тихая» бьёт без замаха, но и без злобы.",
                   "no_flee": True,
                   "on_fled": [{"type": "set_flag", "flag": "quiet_defeated"},
                               MSG("Удалось уйти в боковой штрек. «Тихая» не пошла следом.")],
                   "on_victory": [{"type": "set_flag", "flag": "quiet_defeated"},
                                  {"type": "unlock_codex", "entry": "codex_quiet"},
                                  {"type": "meta_currency", "id": "meta_slag", "amount": 3},
                                  MSG("Приказ с печатью Дирекции падает из складок плаща.")]}],
             manual=True, chapter="ch_deep"),

        rule("rule_hod_garn", "Голос о Гарне",
             [], [{"type": "journal_update", "quest": "quest_garn", "text_key": "j_body"},
                  {"type": "change_sanity", "delta": -2},
                  MSG("Голос в трубах молчит ровно столько, сколько нужно, чтобы стало страшно.")],
             manual=True, chapter="ch_heart"),

        rule("rule_hod_vision", "Видение Хода",
             [], [{"type": "unlock_codex", "entry": "codex_conductor"},
                  {"type": "play_cutscene", "cutscene": "cutscene_vision"},
                  {"type": "change_sanity", "delta": -3}],
             manual=True, chapter="ch_heart"),
    ]

# --- реакции на улики: диалоги второго круга --------------------------------
def RULES_EVIDENCE():
    return [
        rule("rule_vein_implant", "Клёп о вкладыше",
             [], [{"type": "journal_update", "quest": "quest_names", "text_key": "j_implant"},
                  {"type": "unlock_codex", "entry": "codex_directorate"},
                  {"type": "change_skill", "skill": "lore", "delta": 3},
                  MSG("Клёп вертит вкладыш на свет: «Партия с цеха. Номера выдают в Дирекции, под наряд».")],
             manual=True, chapter="ch_case"),

        rule("rule_vein_ledger", "Клёп о гроссбухе",
             [], [{"type": "change_disposition", "target": "npc_vein", "delta": 10},
                  {"type": "add_item", "item": "item_wire", "quantity": 2},
                  MSG("Клёп отводит взгляд: «Спрячь. И купи у меня проволоки — бесплатно не дам, "
                      "но и недорого».")],
             manual=True, chapter="ch_deep"),

        rule("rule_sergeant_implant", "Гула сверяет номер",
             [], [{"type": "journal_update", "quest": "quest_names", "text_key": "j_implant"},
                  {"type": "unlock_codex", "entry": "codex_conductor"},
                  MSG("Гула листает журнал нарядов: «Партия из цеха, подпись Валента, "
                      "графа «рабочая сила». Дело пахнет Ревизией, инспектор».")],
             manual=True, chapter="ch_case"),

        rule("rule_sergeant_ledger", "Гула о свидетеле",
             [], [{"type": "journal_update", "quest": "quest_lissa", "text_key": "j_found"},
                  {"type": "change_disposition", "target": "npc_sergeant", "delta": 10},
                  MSG("Гула стучит пальцем по столу: «Бумага без свидетеля — это макулатура. "
                      "Медянка ещё жива? Тогда у вас есть шанс».")],
             manual=True, chapter="ch_deep"),

        rule("rule_medic_recipe", "Ханна учит осадку",
             [], [{"type": "unlock_recipe", "recipe": "recipe_tonic"},
                  {"type": "set_flag", "flag": "recipe_tonic_known"},
                  {"type": "change_skill", "skill": "medicine", "delta": 3},
                  {"type": "add_item", "item": "item_herb", "quantity": 2},
                  MSG("Ханна пишет состав на обрывке: «Трава-жгунец, спирт, две части. "
                      "Не пейте на пустой желудок».")],
             manual=True, chapter="ch_case"),

        rule("rule_medic_lungs", "Ханна слушает дыхание",
             [], [{"type": "remove_status", "target": "player", "status": "status_fume"},
                  {"type": "change_hp", "delta": 2},
                  MSG("Ханна прикладывает ухо к спине: «Угар у вас в верхушках. Меняйте уголь "
                      "в маске каждый день, иначе к зиме станете ходячей трубой».")],
             manual=True, chapter="ch_deep"),

        rule("rule_marta_debt_cleared_choice", "Марта принимает долг",
             [], [{"type": "remove_item", "item": "item_silver", "quantity": 15},
                  {"type": "fire_rule", "rule": "rule_marta_debt_cleared"}],
             manual=True, chapter="ch_slag"),

        rule("rule_marta_hod", "Марта о Ходе",
             [], [{"type": "unlock_codex", "entry": "codex_hod"},
                  {"type": "change_disposition", "target": "npc_marta", "delta": 5},
                  MSG("Марта вытирает стойку: «Дед говорил — когда Ход сбивается, Дирекция "
                      "считает не трубы, а людей. Считай вместе с ней, и ты поймёшь».")],
             manual=True, chapter="ch_works"),

        rule("rule_irena_bypass", "Ирена про обходной патрубок",
             [], [{"type": "unlock_codex", "entry": "codex_hod"},
                  {"type": "reveal_location", "location": "loc_machine"},
                  {"type": "change_skill", "skill": "mechanics", "delta": 3},
                  MSG("Ирена чертит на пыли: «Патрубок за насосной. Сначала давление, потом вентиль».")],
             manual=True, chapter="ch_works"),

        rule("rule_irena_implant", "Ирена о наряде",
             [], [{"type": "journal_update", "quest": "quest_names", "text_key": "j_implant"},
                  {"type": "unlock_codex", "entry": "codex_conductor"},
                  {"type": "change_disposition", "target": "npc_irena", "delta": 5},
                  MSG("Ирена смотрит на вкладыш долго: «Восемь имён. И ни одного с верхней террасы».")],
             manual=True, chapter="ch_works"),

        rule("rule_irena_quiet", "Ирена о «Тихой»",
             [], [{"type": "change_disposition", "target": "npc_irena", "delta": 10},
                  {"type": "grant_xp", "points": 15},
                  MSG("Ирена впервые улыбается: «Хорошо. Значит, и меня они не достанут».")],
             manual=True, chapter="ch_heart"),

        rule("rule_bossar_quiet", "Боссар о свидетелях",
             [], [{"type": "unlock_codex", "entry": "codex_quiet"},
                  MSG("Боссар чешет затылок: «Пьющий — Гнат. Сидит у Марты под столом, "
                      "второй месяц не работает. Скажи, что от меня».")],
             manual=True, chapter="ch_slag"),

        rule("rule_bossar_ledger_hint", "Боссар о бумагах Гарна",
             [], [{"type": "journal_update", "quest": "quest_garn", "text_key": "j_track"},
                  {"type": "reveal_location", "location": "loc_deep"},
                  MSG("Боссар кивает в сторону решётки: «Что не сдал на участке — то под рогожей, "
                      "у третьей крепи. Если не растащили».")],
             manual=True, chapter="ch_slag"),

        rule("rule_lissa_names", "Лисса называет имена",
             [], [{"type": "journal_update", "quest": "quest_names", "text_key": "j_done"},
                  {"type": "grant_xp", "points": 15},
                  MSG("Лисса перечисляет на пальцах: «Тэн, Мирта, Слепой Ерш, Малый. "
                      "Четвёртой была я».")],
             manual=True, chapter="ch_slag"),

        rule("rule_lissa_quiet", "Лисса о «Тихой»",
             [], [{"type": "unlock_codex", "entry": "codex_quiet"},
                  MSG("Лисса обхватывает себя руками: «Она не бежит и не кричит. Просто идёт, "
                      "и от неё не слышно шагов».")],
             manual=True, chapter="ch_slag"),

        rule("rule_quiet_garn", "«Тихая» о Гарне",
             [], [{"type": "journal_update", "quest": "quest_garn", "text_key": "j_body"},
                  {"type": "change_sanity", "delta": -2},
                  MSG("Серая фигура говорит ровно: «Его привели мёртвым. Мне приказали найти "
                      "бумаги, а не человека».")],
             manual=True, chapter="ch_deep"),

        rule("rule_valent_implant", "Валент о подписи",
             [], [{"type": "journal_update", "quest": "quest_names", "text_key": "j_implant"},
                  {"type": "change_disposition", "target": "npc_valent", "delta": -5},
                  MSG("Валент не отводит глаз: «Да. Подписал. И подпишу снова, если придётся "
                      "выбирать между восемью людьми и всем городом».")],
             manual=True, chapter="ch_heart"),

        rule("rule_valent_quiet", "Валент о «Тихой»",
             [], [{"type": "change_disposition", "target": "npc_valent", "delta": 10},
                  {"type": "grant_xp", "points": 10},
                  MSG("Валент отступает на шаг: «Значит, вы её сломали. Что ж. Поговорим "
                      "как двое, у которых испорчен вечер».")],
             manual=True, chapter="ch_heart"),
    ]



def ALL_RULES():
    """Все правила кампании одним списком."""
    return RULES() + RULES_EXTRA() + RULES_EVIDENCE()
