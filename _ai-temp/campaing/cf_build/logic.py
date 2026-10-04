# -*- coding: utf-8 -*-
"""Правила, квесты, арены, катсцены, встречи, рецепты, кодекс."""

RULES = {
    "rule_intro": {
        "id": "rule_intro", "label": "Пролог", "once": True, "manual": False,
        "chapter": "ch_1",
        "conditions": [{"type": "tick_elapsed", "min_tick": 0}],
        "effects": [{"type": "play_cutscene", "cutscene": "cutscene_intro"}],
    },
    "rule_luka_talk": {
        "id": "rule_luka_talk", "label": "Показания Луки", "once": False, "manual": True,
        "conditions": [],
        "effects": [{"type": "skill_check_gate", "skill": "persuade", "difficulty": 35,
                     "success_effects": [
                         {"type": "set_flag", "flag": "luka_talked"},
                         {"type": "start_quest", "quest": "quest_hymn"},
                         {"type": "set_entity_state", "entity": "npc_luka", "state": "calm"},
                         {"type": "show_message", "text": "«Меня тащили вниз, где поёт железо. Их плащи пахли холодной солью»."}],
                     "fail_effects": [
                         {"type": "show_message", "text": "Лука отворачивается к стене и стонет. Не сегодня."}]}],
    },
    "rule_press_iletta": {
        "id": "rule_press_iletta", "label": "Давление на Илетту", "once": False, "manual": True,
        "conditions": [],
        "effects": [{"type": "skill_check_gate", "skill": "persuade", "difficulty": 45,
                     "success_effects": [
                         {"type": "set_flag", "flag": "iletta_confessed"},
                         {"type": "add_item", "item": "item_hymnal", "quantity": 1},
                         {"type": "set_entity_state", "entity": "npc_iletta", "state": "afraid"},
                         {"type": "set_description", "entity": "npc_iletta",
                          "text": "Призналась, что переписывала гимны Тишины. Испугана, но сотрудничает."},
                         {"type": "show_message", "text": "«Бери! Только не выдавай меня гильдии». Она суёт тебе псалтырь."}],
                     "fail_effects": [
                         {"type": "set_entity_state", "entity": "npc_iletta", "state": "angry"},
                         {"type": "show_message", "text": "«Не знаю, о чём вы». Илетта указывает на дверь."}]}],
    },
    "rule_press_drogan": {
        "id": "rule_press_drogan", "label": "Допрос Дрогана", "once": False, "manual": True,
        "conditions": [],
        "effects": [{"type": "skill_check_gate", "skill": "persuade", "difficulty": 50,
                     "success_effects": [
                         {"type": "set_flag", "flag": "drogan_confessed"},
                         {"type": "set_flag", "flag": "drogan_key"},
                         {"type": "set_entity_state", "entity": "npc_drogan", "state": "afraid"},
                         {"type": "set_description", "entity": "npc_drogan",
                          "text": "Сознался в недостаче латуни. Видел, как Варга открывает решётку серым плащам."},
                         {"type": "show_message", "text": "«Ладно! Латунь я списывал. Но ночью решётку открывает сам мастер — серым плащам. Я лишь отводил глаза!»"}],
                     "fail_effects": [
                         {"type": "show_message", "text": "«Это не моя книга. Мне её подбросили». Дроган упрямо молчит дальше."}]}],
    },
    "rule_guard_key": {
        "id": "rule_guard_key", "label": "Ключ от решётки", "once": False, "manual": True,
        "conditions": [],
        "effects": [{"type": "skill_check_gate", "skill": "persuade", "difficulty": 45,
                     "success_effects": [
                         {"type": "set_flag", "flag": "gate_open"},
                         {"type": "add_item", "item": "item_key_under", "quantity": 1},
                         {"type": "start_quest", "quest": "quest_under"},
                         {"type": "show_message", "text": "«…Как скажешь. Ключ твой и ответственность твоя. Низы — не для живых»."}],
                     "fail_effects": [
                         {"type": "show_message", "text": "«Печать сильнее жетона. Принеси приказ конторы»."}]}],
    },
    "rule_reveal": {
        "id": "rule_reveal", "label": "Дорога в Низы", "once": True, "manual": False,
        "chapter": "ch_2",
        "conditions": [{"type": "flag_set", "flag": "gate_open"}],
        "effects": [
            {"type": "reveal_location", "location": "loc_nizy"},
            {"type": "banner", "text": "Дорога в Низы открыта.", "preset": "заголовок"},
        ],
    },
    "rule_deadline": {
        "id": "rule_deadline", "label": "Одиннадцатые сутки", "once": True, "manual": False,
        "chapter": "ch_3",
        "conditions": [
            {"type": "tick_elapsed", "min_tick": 264},
            {"type": "flag_not_set", "flag": "heart_saved"},
            {"type": "flag_not_set", "flag": "deal_varga"},
        ],
        "effects": [
            {"type": "set_flag", "flag": "city_frozen"},
            {"type": "banner", "text": "Одиннадцатые сутки. Очаг остывает.", "preset": "проклятье"},
            {"type": "game_over_death", "reason": "Город замёрз раньше, чем закрылось дело."},
        ],
    },
    "rule_zero_warmth": {
        "id": "rule_zero_warmth", "label": "Тепло на нуле", "once": False, "manual": True,
        "conditions": [],
        "effects": [
            {"type": "change_hp", "delta": -1},
            {"type": "show_message", "text": "Тепло на нуле: тело отдаёт последнее. Найди печь, плащ или уголёк."},
        ],
    },
    "rule_zero_food": {
        "id": "rule_zero_food", "label": "Голод", "once": False, "manual": True,
        "conditions": [],
        "effects": [
            {"type": "change_hp", "delta": -1},
            {"type": "show_message", "text": "Желудок пуст. Похлёбка или хлеб — иначе ноги откажут."},
        ],
    },
    "rule_frost": {
        "id": "rule_frost", "label": "Холод берёт своё", "once": True, "manual": False,
        "conditions": [{"type": "need_le", "need": "need_warmth", "threshold": 20}],
        "effects": [
            {"type": "apply_status", "target": "player", "status": "status_frost", "duration": 8},
            {"type": "show_message", "text": "Холод забрался под одежду. Нужно тепло: печь, плащ или уголёк."},
        ],
    },
    "rule_ash": {
        "id": "rule_ash", "label": "Пеплопад", "once": True, "manual": False,
        "conditions": [{"type": "tick_elapsed", "min_tick": 30}],
        "effects": [{"type": "set_weather", "weather": "weather_ashfall"}],
    },
    "rule_sky": {
        "id": "rule_sky", "label": "Ясное небо", "once": True, "manual": False,
        "conditions": [{"type": "tick_elapsed", "min_tick": 78}],
        "effects": [{"type": "set_weather", "weather": ""}],
    },
    "rule_snow": {
        "id": "rule_snow", "label": "Метель", "once": True, "manual": False,
        "conditions": [{"type": "tick_elapsed", "min_tick": 150}],
        "effects": [{"type": "set_weather", "weather": "weather_snow"}],
    },
    "rule_pursuit": {
        "id": "rule_pursuit", "label": "Сторожа Тишины", "once": True, "manual": False,
        "chapter": "ch_3",
        "conditions": [
            {"type": "player_enters_scene", "scene": "scene_under"},
            {"type": "flag_not_set", "flag": "under_cleared"},
        ],
        "effects": [{"type": "start_pursuit", "label": "Сторожа Тишины", "skill": "stealth",
                     "every_ticks": 3, "fails_to_catch": 1,
                     "on_fail": [
                         {"type": "start_combat",
                          "enemies": [{"entity": "npc_cultist", "count": 2}],
                          "arena": "arena_under",
                          "intro": "Из тьмы выходят серые плащи — тихо, как падает пепел.",
                          "on_victory": [
                              {"type": "set_flag", "flag": "under_cleared"},
                              {"type": "show_message", "text": "Туннели пусты. Только пепел шуршит."}]}]}],
    },
    "rule_stop_pursuit": {
        "id": "rule_stop_pursuit", "label": "Отрыв от погони", "once": True, "manual": False,
        "conditions": [{"type": "player_enters_scene", "scene": "scene_heart"}],
        "effects": [{"type": "stop_pursuit"}],
    },
    "rule_heart_fight": {
        "id": "rule_heart_fight", "label": "Страж Сердца", "once": True, "manual": False,
        "chapter": "ch_3",
        "conditions": [
            {"type": "player_enters_scene", "scene": "scene_heart"},
            {"type": "flag_not_set", "flag": "automaton_down"},
        ],
        "effects": [{"type": "start_combat",
                     "enemies": [{"entity": "npc_automaton", "count": 1}],
                     "arena": "arena_heart",
                     "intro": "Латунный страж срывается с цепей. Сердце гудит тревожно.",
                     "on_victory": [
                         {"type": "set_flag", "flag": "automaton_down"},
                         {"type": "unlock_codex", "entry": "codex_automaton"},
                         {"type": "show_message", "text": "Автоматон застывает на полувзмахе. Пар выходит из сочленений."}]}],
    },
    "rule_varga_reveal": {
        "id": "rule_varga_reveal", "label": "Варга выходит", "once": True, "manual": False,
        "chapter": "ch_3",
        "conditions": [
            {"type": "flag_set", "flag": "automaton_down"},
            {"type": "flag_not_set", "flag": "varga_hostile"},
        ],
        "effects": [
            {"type": "set_flag", "flag": "varga_hostile"},
            {"type": "banner", "text": "Варга выходит из-за обратного сердца.", "preset": "шёпот"},
        ],
    },
    "rule_final": {
        "id": "rule_final", "label": "Финал", "once": True, "manual": False,
        "chapter": "ch_3",
        "conditions": [],
        "conditions_any": [
            [{"type": "flag_set", "flag": "heart_saved"}],
            [{"type": "flag_set", "flag": "deal_varga"}],
        ],
        "effects": [
            {"type": "play_cutscene", "cutscene": "cutscene_end"},
            {"type": "game_over_victory"},
        ],
    },
    "rule_codex_nizy": {
        "id": "rule_codex_nizy", "label": "Запах Нижних ярусов", "once": True, "manual": False,
        "conditions": [{"type": "player_enters_location", "location": "loc_nizy"}],
        "effects": [{"type": "unlock_codex", "entry": "codex_ash"}],
    },
    "rule_ng": {
        "id": "rule_ng", "label": "Память круга", "once": True, "manual": False,
        "conditions": [
            {"type": "meta_counter", "key": "endings_seen", "ge": 1},
            {"type": "player_enters_scene", "scene": "scene_office"},
        ],
        "effects": [{"type": "show_message", "text": "Сердце помнит тебя, следователь. Этот круг — не первый."}],
    },
}

QUESTS = {
    "quest_case": {
        "id": "quest_case", "label": "Дело «Ржавая литургия»", "chapter": "ch_1",
        "description": "Выяснить, кто убирает инженеров Очага, и не дать городу замёрзнуть.",
        "journal_entries": {
            "j_take": "Клерк передал дело о пропавших инженерах. Срок — одиннадцатые сутки.",
            "j_luka": "Лука выжил: людей в серых плащах уводит вниз, «где поёт железо».",
            "j_ev": "Три улики в деле: гроссбух, псалтырь и мёртвая гарь. Все нити ведут к решётке.",
            "j_under": "Решётка в Низы открыта. Внизу кто-то поёт обратную песнь.",
            "j_heart": "Сердце назвало имя: Варга. Осталось остановить обратное сердце.",
            "j_done": "Варга изобличён. Очаг будет жить.",
            "j_deal": "Варга ушёл на волю. Тепло — ценой правды.",
        },
        "stages": [
            {"id": "stage_take", "label": "Дело принято",
             "on_enter_effects": [{"type": "journal_update", "quest": "quest_case", "text_key": "j_take"}],
             "transitions": [{"to": "stage_luka", "conditions": [{"type": "flag_set", "flag": "luka_talked"}]}]},
            {"id": "stage_luka", "label": "Выживший",
             "on_enter_effects": [{"type": "journal_update", "quest": "quest_case", "text_key": "j_luka"}],
             "transitions": [{"to": "stage_evidence", "conditions": [{"type": "and", "conditions": [
                 {"type": "flag_set", "flag": "ev_ledger"},
                 {"type": "flag_set", "flag": "ev_hymn"},
                 {"type": "flag_set", "flag": "ev_vial"}]}]}]},
            {"id": "stage_evidence", "label": "Три улики",
             "on_enter_effects": [{"type": "journal_update", "quest": "quest_case", "text_key": "j_ev"}],
             "transitions": [{"to": "stage_under", "conditions": [{"type": "flag_set", "flag": "gate_open"}]}]},
            {"id": "stage_under", "label": "Спуск",
             "on_enter_effects": [{"type": "journal_update", "quest": "quest_case", "text_key": "j_under"}],
             "transitions": [{"to": "stage_heart", "conditions": [{"type": "flag_set", "flag": "varga_hostile"}]}]},
            {"id": "stage_heart", "label": "Сердце Очага",
             "on_enter_effects": [{"type": "journal_update", "quest": "quest_case", "text_key": "j_heart"}],
             "transitions": [
                 {"to": "stage_done", "conditions": [{"type": "flag_set", "flag": "heart_saved"}]},
                 {"to": "stage_deal", "conditions": [{"type": "flag_set", "flag": "deal_varga"}]}]},
            {"id": "stage_done", "label": "Изобличение", "final": True, "outcome": "success",
             "on_enter_effects": [{"type": "journal_update", "quest": "quest_case", "text_key": "j_done"}]},
            {"id": "stage_deal", "label": "Сделка", "final": True, "outcome": "success",
             "on_enter_effects": [{"type": "journal_update", "quest": "quest_case", "text_key": "j_deal"}]},
        ],
    },
    "quest_warmth": {
        "id": "quest_warmth", "label": "Тёплый ночлег", "chapter": "ch_1",
        "description": "Купить плащ и горячую еду, пока не стемнело.",
        "journal_entries": {
            "j_w1": "Клерк выдал аванс. До ночи нужны плащ и горячая еда.",
            "j_w2": "Припасы собраны. Контора доплачивает пять марок.",
        },
        "stages": [
            {"id": "stage_start", "label": "Аванс",
             "on_enter_effects": [{"type": "journal_update", "quest": "quest_warmth", "text_key": "j_w1"}],
             "transitions": [{"to": "stage_done", "conditions": [{"type": "and", "conditions": [
                 {"type": "has_item", "item": "item_coat"},
                 {"type": "has_item", "item": "item_stew"}]}]}]},
            {"id": "stage_done", "label": "Сыт и тёпл", "final": True, "outcome": "success",
             "on_enter_effects": [
                 {"type": "journal_update", "quest": "quest_warmth", "text_key": "j_w2"},
                 {"type": "give_reward", "items": [{"item": "item_silver", "quantity": 5}]}]},
        ],
    },
    "quest_ledger": {
        "id": "quest_ledger", "label": "Гроссбух Дрогана", "chapter": "ch_2",
        "description": "Найти книгу, которую фореман прячет в цехе.",
        "journal_entries": {
            "j_l1": "Грета видела, как Дроган прятал что-то в ящики за цехом.",
            "j_l2": "Гроссбух у меня: недостача латуни и ночи, помеченные знаком Тишины.",
        },
        "stages": [
            {"id": "stage_start", "label": "Слух",
             "on_enter_effects": [{"type": "journal_update", "quest": "quest_ledger", "text_key": "j_l1"}],
             "transitions": [{"to": "stage_done", "conditions": [{"type": "has_item", "item": "item_ledger"}]}]},
            {"id": "stage_done", "label": "Книга", "final": True, "outcome": "success",
             "on_enter_effects": [
                 {"type": "journal_update", "quest": "quest_ledger", "text_key": "j_l2"},
                 {"type": "set_flag", "flag": "ev_ledger"}]},
        ],
    },
    "quest_hymn": {
        "id": "quest_hymn", "label": "Псалтырь Тишины", "chapter": "ch_2",
        "description": "Достать книгу гимнов, которую прячет Илетта.",
        "journal_entries": {
            "j_h1": "Лука слышал гимн, который пели похитители. Такой поёт Илетта.",
            "j_h2": "Псалтырь у меня: гимн «Обратному сердцу», переписанный рукой Илетты.",
        },
        "stages": [
            {"id": "stage_start", "label": "Мел на подоле",
             "on_enter_effects": [{"type": "journal_update", "quest": "quest_hymn", "text_key": "j_h1"}],
             "transitions": [{"to": "stage_done", "conditions": [{"type": "has_item", "item": "item_hymnal"}]}]},
            {"id": "stage_done", "label": "Псалтырь", "final": True, "outcome": "success",
             "on_enter_effects": [
                 {"type": "journal_update", "quest": "quest_hymn", "text_key": "j_h2"},
                 {"type": "set_flag", "flag": "ev_hymn"}]},
        ],
    },
    "quest_vial": {
        "id": "quest_vial", "label": "Мёртвая гарь", "chapter": "ch_2",
        "description": "Взять пробу гари из ящика в цехе.",
        "journal_entries": {
            "j_v1": "Прохор говорит: гарь с нижних ярусов пахнет холодной солью.",
            "j_v2": "Проба в флаконе. Мёртвая гарь не греет — она консервирует холод.",
        },
        "stages": [
            {"id": "stage_start", "label": "Проба",
             "on_enter_effects": [{"type": "journal_update", "quest": "quest_vial", "text_key": "j_v1"}],
             "transitions": [{"to": "stage_done", "conditions": [{"type": "has_item", "item": "item_vial"}]}]},
            {"id": "stage_done", "label": "Флакон", "final": True, "outcome": "success",
             "on_enter_effects": [
                 {"type": "journal_update", "quest": "quest_vial", "text_key": "j_v2"},
                 {"type": "set_flag", "flag": "ev_vial"}]},
        ],
    },
    "quest_under": {
        "id": "quest_under", "label": "Спуск в Низы", "chapter": "ch_3",
        "description": "Пройти решётку и туннели, добраться до Сердца.",
        "journal_entries": {
            "j_u1": "Ключ от решётки у меня. Низы ждут.",
            "j_u2": "Я в Низах. Сторожа Тишины идут по следу.",
            "j_u3": "Туннели позади. Впереди гудит Сердце.",
        },
        "stages": [
            {"id": "stage_start", "label": "Решётка",
             "on_enter_effects": [{"type": "journal_update", "quest": "quest_under", "text_key": "j_u1"}],
             "transitions": [{"to": "stage_enter", "conditions": [
                 {"type": "player_enters_location", "location": "loc_nizy"}]}]},
            {"id": "stage_enter", "label": "Туннели",
             "on_enter_effects": [{"type": "journal_update", "quest": "quest_under", "text_key": "j_u2"}],
             "transitions": [{"to": "stage_clear", "conditions": [{"type": "or", "conditions": [
                 {"type": "flag_set", "flag": "under_cleared"},
                 {"type": "flag_set", "flag": "heart_saved"}]}]}]},
            {"id": "stage_clear", "label": "У Сердца", "final": True, "outcome": "success",
             "on_enter_effects": [{"type": "journal_update", "quest": "quest_under", "text_key": "j_u3"}]},
        ],
    },
}

ARENAS = {
    "arena_under": {
        "id": "arena_under", "label": "Туннели (бой)", "image": "",
        "hex_grid": {"cols": 10, "rows": 6, "hex_size": 40, "offset": "odd-r",
                     "blocked_hexes": [[4, 2], [5, 3]], "difficult_terrain": [[3, 1], [6, 4]]},
        "spawn_zones": {"player": {"hexes": [[0, 2], [0, 3], [1, 2]]},
                        "enemy": {"hexes": [[9, 2], [9, 3]]}},
        "music": "music_under",
    },
    "arena_heart": {
        "id": "arena_heart", "label": "Зал Сердца (бой)", "image": "",
        "hex_grid": {"cols": 10, "rows": 6, "hex_size": 40, "offset": "odd-r",
                     "blocked_hexes": [[4, 2], [5, 2], [4, 3], [5, 3]], "difficult_terrain": [[2, 4], [7, 1]]},
        "spawn_zones": {"player": {"hexes": [[0, 2], [0, 3], [1, 3]]},
                        "enemy": {"hexes": [[9, 2], [9, 3]]}},
        "music": "music_heart",
    },
}

CUTSCENES = {
    "cutscene_intro": {
        "id": "cutscene_intro", "label": "Пролог", "chapter": "ch_1", "music": "music_menu",
        "slides": [
            {"transition": "panzoom", "duration": 6,
             "text": "Оковина стоит посреди Пепельной зимы, и только Очаг держит её живой.",
             "art": {"canvas": {"w": 1280, "h": 720}, "background": "#10151b", "layers": [
                 {"label": "небо", "shape": {"type": "rect", "x": 0, "y": 0, "w": 1280, "h": 480, "fill": {"gradient": {"from": "#1a2130", "to": "#0c1016", "angle": 90}}}},
                 {"label": "снега", "shape": {"type": "rect", "x": 0, "y": 480, "w": 1280, "h": 240, "fill": "#232b36"}},
                 {"label": "силуэт города", "shape": {"type": "polygon", "points": [0, 480, 160, 380, 300, 460, 470, 340, 640, 440, 820, 320, 980, 430, 1140, 360, 1280, 470, 1280, 720, 0, 720], "fill": "#151b24"}},
                 {"label": "трубы", "shape": {"type": "rect", "x": 780, "y": 180, "w": 40, "h": 200, "fill": "#10141b"}},
                 {"label": "дым", "shape": {"type": "ellipse", "cx": 800, "cy": 140, "rx": 60, "ry": 30, "fill": "#8a8a8a", "opacity": 0.3}},
                 {"label": "огни", "shape": {"type": "ellipse", "cx": 470, "cy": 400, "rx": 8, "ry": 8, "fill": "#e8c060"}},
                 {"label": "огни 2", "shape": {"type": "ellipse", "cx": 980, "cy": 450, "rx": 8, "ry": 8, "fill": "#e8c060"}}]}},
            {"transition": "fade", "duration": 6,
             "text": "Последнюю неделю Сердце Очага остывает на час больше обычного.",
             "art": {"canvas": {"w": 1280, "h": 720}, "background": "#160f0c", "layers": [
                 {"label": "зал", "shape": {"type": "rect", "x": 0, "y": 0, "w": 1280, "h": 720, "fill": {"gradient": {"from": "#241511", "to": "#120b08", "angle": 90}}}},
                 {"label": "сердце", "shape": {"type": "ellipse", "cx": 640, "cy": 360, "rx": 240, "ry": 240, "fill": "#3a2a22", "stroke": "#7a5a33", "stroke_width": 14}},
                 {"label": "пламя", "shape": {"type": "ellipse", "cx": 640, "cy": 360, "rx": 70, "ry": 70, "fill": "#a03a1a"}},
                 {"label": "иней", "shape": {"type": "ellipse", "cx": 640, "cy": 220, "rx": 160, "ry": 40, "fill": "#b8d0e0", "opacity": 0.4}}]}},
            {"transition": "fade", "duration": 6,
             "text": "Инженеры, которые служат ему, исчезают. Контора открывает дело.",
             "art": {"canvas": {"w": 1280, "h": 720}, "background": "#14161a", "layers": [
                 {"label": "стена", "shape": {"type": "rect", "x": 0, "y": 0, "w": 1280, "h": 720, "fill": "#181c22"}},
                 {"label": "стол", "shape": {"type": "rect", "x": 320, "y": 430, "w": 640, "h": 140, "fill": "#3d2c1f"}},
                 {"label": "папка", "shape": {"type": "rect", "x": 560, "y": 400, "w": 180, "h": 40, "fill": "#8d8268"}},
                 {"label": "печать", "shape": {"type": "ellipse", "cx": 700, "cy": 420, "rx": 24, "ry": 24, "fill": "#7a2a1a"}},
                 {"label": "лампа", "shape": {"type": "ellipse", "cx": 640, "cy": 300, "rx": 200, "ry": 90, "fill": "#e8c060", "opacity": 0.15}}]}},
        ],
    },
    "cutscene_end": {
        "id": "cutscene_end", "label": "Эпилог", "chapter": "ch_3", "music": "music_heart",
        "slides": [
            {"transition": "panzoom", "duration": 6,
             "text": "Над Оковиной снова стоит тёплый дым.",
             "art": {"canvas": {"w": 1280, "h": 720}, "background": "#1a2130", "layers": [
                 {"label": "небо", "shape": {"type": "rect", "x": 0, "y": 0, "w": 1280, "h": 480, "fill": {"gradient": {"from": "#31405a", "to": "#141a24", "angle": 90}}}},
                 {"label": "город", "shape": {"type": "polygon", "points": [0, 480, 200, 400, 420, 470, 640, 380, 860, 460, 1080, 400, 1280, 480, 1280, 720, 0, 720], "fill": "#1a2129"}},
                 {"label": "тёплый дым", "shape": {"type": "ellipse", "cx": 640, "cy": 240, "rx": 70, "ry": 40, "fill": "#c8a878", "opacity": 0.4}},
                 {"label": "огни", "shape": {"type": "ellipse", "cx": 420, "cy": 470, "rx": 10, "ry": 10, "fill": "#e8c060"}},
                 {"label": "огни 2", "shape": {"type": "ellipse", "cx": 860, "cy": 470, "rx": 10, "ry": 10, "fill": "#e8c060"}}]}},
            {"transition": "fade", "duration": 6,
             "text": "Дело сдано в архив. Литургия шестерён продолжается.",
             "art": {"canvas": {"w": 1280, "h": 720}, "background": "#15130f", "layers": [
                 {"label": "стена", "shape": {"type": "rect", "x": 0, "y": 0, "w": 1280, "h": 720, "fill": "#1d1a14"}},
                 {"label": "стеллаж", "shape": {"type": "rect", "x": 420, "y": 140, "w": 440, "h": 440, "fill": "#3a2d1d"}},
                 {"label": "папка дела", "shape": {"type": "rect", "x": 560, "y": 300, "w": 160, "h": 60, "fill": "#8d8268"}},
                 {"label": "печать", "shape": {"type": "ellipse", "cx": 680, "cy": 330, "rx": 22, "ry": 22, "fill": "#7a2a1a"}}]}},
        ],
    },
}

ENCOUNTERS = {
    "enc_road": {
        "id": "enc_road", "rolls": 1,
        "entries": [
            {"weight": 5, "type": "nothing"},
            {"weight": 2, "type": "combat",
             "enemies": [{"entity": "npc_cultist", "count_min": 1, "count_max": 2}],
             "arena": "arena_under"},
        ],
    },
}

RECIPES = {
    "recipe_bandage": {
        "id": "recipe_bandage", "label": "Бинт из ветоши",
        "description": "Чистая повязка из подручной ткани.",
        "inputs": [{"item": "item_cloth", "quantity": 2}],
        "skill": {"id": "first_aid", "difficulty": 30},
        "time_ticks": 1,
        "output": {"item": "item_bandage", "quantity": 1},
        "message": "Бинт свернут ровно, как в приюте.",
    },
    "recipe_tonic": {
        "id": "recipe_tonic", "label": "Согревающий настой", "known": False,
        "description": "Полынь и тёплый уголёк: проясняет голову и гонит кровь.",
        "inputs": [{"item": "item_herb", "quantity": 2}, {"item": "item_coal", "quantity": 1}],
        "skill": {"id": "first_aid", "difficulty": 35},
        "time_ticks": 1,
        "output": {"item": "item_tonic", "quantity": 1},
        "message": "Настой пахнет горечью и теплом.",
    },
}

CODEX = {
    "codex_ash": {
        "id": "codex_ash", "label": "Пепельная зима", "category": "chronicles",
        "text": "Третий год после Великой гари снег над Оковиной идёт серым: зола сгоревших лесов держится в небе и не даёт солнцу греть. Выживают города с печью-сердцем. Остальные — тихо.",
    },
    "codex_silence": {
        "id": "codex_silence", "label": "Тишина Горнила", "category": "chronicles",
        "text": "Секта, верящая, что Очаг — клетка для бога огня, а тепло — его пленение. Их обряды пахнут холодной солью: соль консервирует, соль гасит. Контора считала их сказкой до этой зимы.",
    },
    "codex_hearth": {
        "id": "codex_hearth", "label": "Сердце Очага", "category": "places",
        "text": "Аркано-механическая печь в Нижних ярусах. Латунное кольцо зубьев и живое пламя внутри. Старики говорят, что пламя — не топливо, а узник.",
    },
    "codex_automaton": {
        "id": "codex_automaton", "label": "Автоматон-страж", "category": "creatures",
        "text": "Латунный страж старой постройки: пар в сочленениях, ни усталости, ни жалости. Таких ставили у Сердца до того, как Очаг стал «просто печью».",
    },
}

ABILITIES = [
    {"id": "ability_steam", "label": "Паровой залп",
     "description": "Автоматон бьёт струей перегретого пара.",
     "mp_cost": 0, "cooldown_rounds": 2, "range": 2,
     "kind": "damage", "damage": "1d6+2"},
]
