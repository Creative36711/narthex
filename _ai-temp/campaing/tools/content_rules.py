"""Правила, квесты, арены, катсцены, встречи, рецепты, кодекс."""

from artlib import PAL, W, H, rect, ellipse, poly, line, text, grad, tunnel, \
    furnace_hall, machine_core, ash_yard, interior

# ---------------------------------------------------------------- правила


def rule(id, label, conditions, effects, once=True, manual=False, chapter=None,
         conditions_any=None):
    r = {"id": id, "label": label, "once": once, "conditions": conditions,
         "effects": effects}
    if manual:
        r["manual"] = True
    if conditions_any:
        r["conditions_any"] = conditions_any
    if chapter:
        r["chapter"] = chapter
    return r


RULES = []


def add_rule(r):
    RULES.append(r)
    return r


add_rule(rule(
    "rule_intro", "Пролог: ночной вызов",
    [{"type": "tick_elapsed", "min_tick": 0}],
    [{"type": "play_cutscene", "cutscene": "cutscene_intro"},
     {"type": "set_flag", "flag": "intro_seen"},
     {"type": "start_dialogue", "entity": "npc_stroy"}],
    chapter="ch_prologue"))

add_rule(rule(
    "rule_hint", "Первая подсказка по делу",
    [{"type": "tick_elapsed", "min_tick": 2},
     {"type": "flag_not_set", "flag": "gear_intro_done"}],
    [{"type": "set_flag", "flag": "gear_intro_done"},
     {"type": "banner", "text": "Дело № 14. Срок — четырнадцать суток.", "seconds": 5},
     {"type": "show_message",
      "text": "Дознаватель Надзора: тело в смотровой, улики в трубах, срок — четырнадцать суток. "
              "Есть, пить и дышать нужно каждый час, а маска без фильтра держит недолго."}],
    chapter="ch_prologue"))

add_rule(rule(
    "rule_clues_done", "Улики сошлись",
    [{"type": "flag_set", "flag": "clue_shavings"},
     {"type": "flag_set", "flag": "clue_token"},
     {"type": "flag_set", "flag": "clue_shard"},
     {"type": "flag_not_set", "flag": "clues_done"}],
    [{"type": "set_flag", "flag": "clues_done"},
     {"type": "advance_quest", "quest": "quest_main", "stage": "stage_clues"},
     {"type": "journal_update", "quest": "quest_main", "text_key": "j_clues"},
     {"type": "grant_xp", "points": 50},
     {"type": "show_message",
      "text": "Стружка, жетон и зеркальный скол лежат рядом на столе. Резали инструментом, "
              "убитый был со Спуска, а убийца носит зеркальную маску."},
     {"type": "unlock_codex", "entry": "codex_descent"}],
    chapter="ch_pipes"))

add_rule(rule(
    "rule_crew_reveal", "Список бригады открывает шахту",
    [{"type": "flag_set", "flag": "crew_list_found"},
     {"type": "flag_not_set", "flag": "shaft_revealed"}],
    [{"type": "reveal_location", "location": "loc_shaft"},
     {"type": "set_flag", "flag": "shaft_revealed"},
     {"type": "reveal_location", "location": "loc_core"} if False else
     {"type": "journal_update", "quest": "quest_main", "text_key": "j_shaft"},
     {"type": "show_message",
      "text": "Журнал Вета вывел к цистерне: там, за затвором, начинается спуск, который официально заварен."}],
    chapter="ch_shaft"))

add_rule(rule(
    "rule_shaft_reveal_core", "Поддон на карте",
    [{"type": "flag_set", "flag": "descent_started"},
     {"type": "flag_not_set", "flag": "core_known"}],
    [{"type": "set_flag", "flag": "core_known"},
     {"type": "reveal_location", "location": "loc_core"},
     {"type": "show_message", "text": "Ниже Спуска, по графиту на стене, — ещё один ярус. Поддон."}],
    chapter="ch_shaft"))

add_rule(rule(
    "rule_watch_warning", "Срок поджимает",
    [{"type": "tick_elapsed", "min_tick": 30},
     {"type": "flag_not_set", "flag": "watch_warned"}],
    [{"type": "set_flag", "flag": "watch_warned"},
     {"type": "banner", "text": "Капитан Строй ждёт ответа к вечеру", "seconds": 4},
     {"type": "show_message",
      "text": "Строй не звонил, но ты его знаешь: если к вечеру списка бригады не будет, "
              "дело закроют «по недостатку улик»."}]))

add_rule(rule(
    "rule_second_murder", "Второе убийство",
    [{"type": "tick_elapsed", "min_tick": 56},
     {"type": "flag_not_set", "flag": "crew_list_found"},
     {"type": "flag_not_set", "flag": "grist_dead"}],
    [{"type": "set_flag", "flag": "grist_dead"},
     {"type": "remove_entity", "entity": "npc_grist"},
     {"type": "set_description", "entity": "npc_grist",
      "text": "Мастер Грист, найденный у печи. Грудь вскрыта так же, как у Вета. Он так и не назвал имён."},
     {"type": "change_scene_state", "scene": "scene_foundry_floor", "state": "state_blood"},
     {"type": "play_cutscene", "cutscene": "cutscene_second"},
     {"type": "set_price_event", "id": "price_blockade"},
     {"type": "set_flag", "flag": "blockade_on"},
     {"type": "journal_update", "quest": "quest_main", "text_key": "j_second"},
     {"type": "change_disposition", "target": "faction_undercity", "delta": -10},
     {"type": "unlock_codex", "entry": "codex_mirror"},
     {"type": "grant_xp", "points": 30}],
    chapter="ch_foundry"))

add_rule(rule(
    "rule_third_murder", "Убийца уходит",
    [{"type": "tick_elapsed", "min_tick": 96},
     {"type": "flag_not_set", "flag": "descent_started"},
     {"type": "flag_not_set", "flag": "killer_escaped"}],
    [{"type": "set_flag", "flag": "killer_escaped"},
     {"type": "banner", "text": "В трубах нашли ещё одно тело", "seconds": 5},
     {"type": "set_description", "entity": "npc_volt",
      "text": "Вольт собирает ящики и ни с кем не прощается: он знает, что ты опоздал."},
     {"type": "journal_update", "quest": "quest_main", "text_key": "j_escaped"},
     {"type": "change_disposition", "target": "faction_undercity", "delta": -15},
     {"type": "show_message",
      "text": "След ушёл по жилам, которых ты не видел. Дело № 14 готовят к списанию."}],
    chapter="ch_core"))

add_rule(rule(
    "rule_weather_ash_on", "Начался пеплопад",
    [{"type": "tick_elapsed", "min_tick": 10},
     {"type": "flag_not_set", "flag": "ashfall_on"},
     {"type": "random_chance", "probability": 0.5}],
    [{"type": "set_weather", "weather": "weather_ashfall"},
     {"type": "set_flag", "flag": "ashfall_on"},
     {"type": "show_message",
      "text": "Венты выдохнули: серое пошло вниз, и через полчаса город перестал видеть дальше вытянутой руки."}],
    once=False))

add_rule(rule(
    "rule_weather_ash_off", "Пеплопад кончился",
    [{"type": "flag_set", "flag": "ashfall_on"},
     {"type": "random_chance", "probability": 0.22}],
    [{"type": "set_weather", "weather": ""},
     {"type": "clear_flag", "flag": "ashfall_on"},
     {"type": "show_message", "text": "Ветер переменился: пепел потянуло вверх, к сводам."}],
    once=False))

for need_id, status, msg in (
    ("need_food", "status_hunger", "Голод уже не отпускает: руки делаются слабее."),
    ("need_water", "status_dry", "Воды нет. Язык распух, в глазах рябит."),
    ("need_warmth", "status_cold", "Ты продрог до костей: пальцы не слушаются."),
    ("need_breath", "status_ash_lung", "Маска не держит: пепел прошёл внутрь, грудь горит."),
):
    add_rule(rule(
        f"rule_need_{need_id.replace('need_', '')}_zero", f"Потребность на нуле: {need_id}",
        [],
        [{"type": "apply_status", "target": "player", "status": status},
         {"type": "show_message", "text": msg}],
        manual=True))

add_rule(rule(
    "rule_camp_ambush", "Вылазка на стоянке",
    [],
    [{"type": "start_combat",
      "enemies": [{"entity": "npc_ash_hound", "count": 2}],
      "arena": "arena_ash",
      "intro": "Зола шевельнулась, и из неё вышли двое: серые, узкие, с пеплом на клыках.",
      "on_victory": [{"type": "show_message", "text": "Зола снова неподвижна. Спать всё равно стоит в очередь."}]}],
    manual=True))

add_rule(rule(
    "rule_chase", "Погоня по дымовому ярусу",
    [],
    [{"type": "show_message",
      "text": "Ты выходил из плавильного зала, когда в дымовом ярусе хлопнуло: кто-то пошёл по трубе, "
              "не разбирая дороги. Теперь он знает, что ты рядом."},
     {"type": "start_pursuit", "label": "Погоня по дымовому ярусу", "skill": "stealth",
      "every_ticks": 3, "fails_to_catch": 2,
      "on_fail": [{"type": "start_combat",
                   "enemies": [{"entity": "npc_boltnik", "count": 1},
                               {"entity": "npc_mirror_thrall", "count": 1}],
                   "arena": "arena_ash",
                   "intro": "Зеркальный ждал за поворотом, а лом болтника вынырнул из дыма справа.",
                   "on_victory": [{"type": "unlock_codex", "entry": "codex_mirror"},
                                  {"type": "grant_xp", "points": 40}]}]}],
    manual=True, chapter="ch_foundry"))

add_rule(rule(
    "rule_chase_stop", "Оторвались",
    [{"type": "player_enters_location", "location": "loc_shaft"}],
    [{"type": "stop_pursuit"},
     {"type": "show_message", "text": "За спиной больше никого. Только жар, который поднимается снизу."}],
    once=False, chapter="ch_shaft"))

add_rule(rule(
    "rule_shaft_heat", "Спуск в шахту",
    [{"type": "player_enters_location", "location": "loc_shaft"},
     {"type": "flag_not_set", "flag": "descent_started"}],
    [{"type": "set_flag", "flag": "descent_started"},
     {"type": "play_cutscene", "cutscene": "cutscene_descent"},
     {"type": "change_fatigue", "delta": 10},
     {"type": "journal_update", "quest": "quest_main", "text_key": "j_descent"},
     {"type": "unlock_codex", "entry": "codex_shaft"}],
    chapter="ch_shaft"))

add_rule(rule(
    "rule_codex_city", "Первые записи кодекса",
    [{"type": "player_enters_location", "location": "loc_underpipes"},
     {"type": "flag_not_set", "flag": "codex_started"}],
    [{"type": "set_flag", "flag": "codex_started"},
     {"type": "unlock_codex", "entry": "codex_karkas"},
     {"type": "unlock_codex", "entry": "codex_undercity"}],
    chapter="ch_pipes"))

add_rule(rule(
    "rule_core_enter", "Зал Сердца",
    [{"type": "player_enters_scene", "scene": "scene_core_hall"},
     {"type": "flag_not_set", "flag": "core_entered"}],
    [{"type": "set_flag", "flag": "core_entered"},
     {"type": "play_cutscene", "cutscene": "cutscene_core"},
     {"type": "unlock_codex", "entry": "codex_heart"},
     {"type": "start_dialogue", "entity": "npc_ilaria"}],
    chapter="ch_core"))

add_rule(rule(
    "rule_heart_codex", "Кожух Сердца",
    [{"type": "player_enters_scene", "scene": "scene_core_heart"}],
    [{"type": "set_flag", "flag": "codex_heart"},
     {"type": "unlock_codex", "entry": "codex_veins"},
     {"type": "show_message",
      "text": "Под кожухом не механизм. Под ним — то, что считает и ждёт, когда его досчитают."}],
    chapter="ch_core"))

add_rule(rule(
    "rule_ash_yard_beasts", "Свалка не пуста",
    [{"type": "player_enters_scene", "scene": "scene_ash_dump"},
     {"type": "flag_not_set", "flag": "beasts_seen"}],
    [{"type": "set_flag", "flag": "beasts_seen"},
     {"type": "unlock_codex", "entry": "codex_hound"},
     {"type": "show_message",
      "text": "В золе кто-то есть: серые, с пеплом на шерсти. Обычно они не лезут первыми — "
              "если только за ними не идут."}],
    chapter="ch_foundry"))

add_rule(rule(
    "rule_automaton_codex", "Сторожевой автомат",
    [{"type": "player_enters_location", "location": "loc_foundry"},
     {"type": "flag_not_set", "flag": "automaton_seen"}],
    [{"type": "set_flag", "flag": "automaton_seen"},
     {"type": "unlock_codex", "entry": "codex_automaton"},
     {"type": "show_message",
      "text": "У дальней стены стоит автомат на трёх ногах: пар из клапанов идёт ровно. "
              "Он охраняет то, чего здесь давно нет."}],
    chapter="ch_foundry"))

add_rule(rule(
    "rule_ilaria_fight", "Схватка в зале Сердца",
    [],
    [{"type": "start_combat",
      "enemies": [{"entity": "npc_ilaria", "count": 1},
                  {"entity": "npc_mirror_thrall", "count": 1}],
      "arena": "arena_core",
      "intro": "Илария сняла маску. Под ней — лицо, которое двенадцать лет не видело ламп.",
      "on_victory": [{"type": "set_flag", "flag": "ilaria_dead"},
                     {"type": "change_scene_state", "scene": "scene_core_hall", "state": "state_main"},
                     {"type": "journal_update", "quest": "quest_main", "text_key": "j_ilaria_dead"},
                     {"type": "unlock_codex", "entry": "codex_mirror"},
                     {"type": "grant_xp", "points": 80},
                     {"type": "show_message",
                      "text": "Она упала на решётку Поддона и смотрела, как ты уходишь. "
                              "Сердца остались лежать в медном ящике — ничьи."}]}],
    manual=True, chapter="ch_core"))


add_rule(rule(
    "rule_journal_crew", "Запись: список бригады",
    [],
    [{"type": "journal_update", "quest": "quest_main", "text_key": "j_crew"}],
    manual=True, chapter="ch_foundry"))

add_rule(rule(
    "rule_era_hint", "Подсказка проводницы",
    [],
    [{"type": "set_flag", "flag": "era_hint"},
     {"type": "journal_update", "quest": "quest_main", "text_key": "j_shaft"},
     {"type": "unlock_codex", "entry": "codex_veins"},
     {"type": "show_message",
      "text": "Эра приложила ладонь к трубе и кивнула: «Иди, пока жар идёт вниз. И считай вдохи»."}],
    manual=True, chapter="ch_shaft"))

add_rule(rule(
    "rule_end_wrong", "Чужой приговор",
    [],
    [{"type": "set_flag", "flag": "wrong_verdict"},
     {"type": "change_disposition", "target": "faction_undercity", "delta": -25},
     {"type": "play_cutscene", "cutscene": "cutscene_surface"},
     {"type": "game_over_victory"}],
    manual=True, chapter="ch_core"))

add_rule(rule(
    "rule_end_fled", "Уйти из города",
    [],
    [{"type": "set_flag", "flag": "fled_city"},
     {"type": "play_cutscene", "cutscene": "cutscene_surface"},
     {"type": "game_over_victory"}],
    manual=True, chapter="ch_core"))

add_rule(rule(
    "rule_end_arrest", "Илария сдана Надзору",
    [],
    [{"type": "set_flag", "flag": "ilaria_arrested"},
     {"type": "change_disposition", "target": "faction_watch", "delta": 20},
     {"type": "play_cutscene", "cutscene": "cutscene_surface"},
     {"type": "game_over_victory"}],
    manual=True, chapter="ch_core"))


add_rule(rule(
    "rule_mira_lost", "Мира не дождалась",
    [{"type": "and", "conditions": [
        {"type": "quest_at_stage", "quest": "quest_medicine", "stage": "stage_start"},
        {"type": "tick_elapsed", "min_tick": 54},
        {"type": "entity_alive", "entity": "npc_mira"}]}],
    [{"type": "set_flag", "flag": "mira_lost"},
     {"type": "set_entity_state", "entity": "npc_mira", "state": "sad"},
     {"type": "change_disposition", "target": "npc_moth", "delta": -40},
     {"type": "change_disposition", "target": "faction_undercity", "delta": -20},
     {"type": "fail_quest", "quest": "quest_medicine"},
     {"type": "banner", "text": "Мира не дождалась настойки. В Нижних трубах теперь считают ещё одну пустую койку."}],
    manual=True, chapter="ch_pipes"))


def rules():
    return {r["id"]: r for r in RULES}


ENCOUNTER_TABLES = [
    {"id": "enc_street", "rolls": 1, "entries": [
        {"weight": 6, "type": "nothing"},
        {"weight": 2, "type": "combat",
         "enemies": [{"entity": "npc_scav", "count_min": 1, "count_max": 2}],
         "arena": "arena_copper",
         "intro": "Из подворотни вышли двое с арматурой и попросили «налог за проход»."},
        {"weight": 1, "type": "dialogue", "entity": "npc_hawker"},
        {"weight": 1, "type": "skill_check", "skill": "spot", "difficulty": 45,
         "message": "На мостовой — свежая медная стружка, будто кто-то пронёс здесь опилки.",
         "success_effects": [{"type": "add_item", "item": "item_scrap", "quantity": 1},
                             {"type": "show_message", "text": "Стружка ещё не остыла от трения."}],
         "fail_effects": []},
    ]},
    {"id": "enc_yard", "rolls": 1, "entries": [
        {"weight": 5, "type": "nothing"},
        {"weight": 3, "type": "combat",
         "enemies": [{"entity": "npc_ash_hound", "count_min": 1, "count_max": 2}],
         "arena": "arena_ash",
         "intro": "Из золы поднялись пепельные псы."},
        {"weight": 2, "type": "combat",
         "enemies": [{"entity": "npc_boltnik", "count_min": 1, "count_max": 1}],
         "arena": "arena_pipes",
         "intro": "Из-за трубы вышел болтник: лом примотан к руке проволокой."},
        {"weight": 1, "type": "event",
         "message": "У стока кто-то оставил флягу воды и поспешно ушёл.",
         "effects": [{"type": "add_item", "item": "item_water", "quantity": 1}]},
    ]},
    {"id": "enc_shaft", "rolls": 1, "entries": [
        {"weight": 4, "type": "nothing"},
        {"weight": 3, "type": "combat",
         "enemies": [{"entity": "npc_mirror_thrall", "count_min": 1, "count_max": 1}],
         "arena": "arena_shaft",
         "intro": "Зеркальный стоял у лестницы, как будто ждал именно тебя."},
        {"weight": 2, "type": "combat",
         "enemies": [{"entity": "npc_automaton", "count_min": 1, "count_max": 1}],
         "arena": "arena_shaft",
         "intro": "Автомат развернулся на трёх ногах и выпустил струю пара."},
        {"weight": 1, "type": "skill_check", "skill": "survival", "difficulty": 50,
         "message": "Жар поднимается снизу: здесь легко потерять воду и не заметить.",
         "success_effects": [{"type": "show_message",
                              "text": "Ты смочил тряпку и прикрыл лицо: вода осталась при тебе."},
                             {"type": "change_need", "need": "need_water", "delta": -5}],
         "fail_effects": [{"type": "change_need", "need": "need_water", "delta": -15},
                          {"type": "change_fatigue", "delta": 5}]},
    ]},
]


# ---------------------------------------------------------------- квесты

QUESTS = [
    {
        "id": "quest_main", "label": "Медное сердце",
        "description": "Кто вынимает медные сердца у тех, кто спускался к Сердцу, и зачем ему именно эти люди.",
        "chapter": "ch_prologue",
        "journal_entries": {
            "j_start": "Капитан Строй отдал дело № 14: Эрдал Вет, грудь вскрыта, сердце вынуто. Срок — четырнадцать суток.",
            "j_body": "Тело осмотрено: резали инструментом, в ране медная стружка.",
            "j_token": "В нише трубы нашёлся жетон бригады Спуска, номер семь.",
            "j_shard": "В решётке стока застрял скол зеркальной маски.",
            "j_clues": "Все три улики сошлись: резали инструментом, убитый был со Спуска, убийца носит маску.",
            "j_crew": "Список бригады Спуска найден. Трое не вышли наверх; Илария Грант помечена «убыла».",
            "j_shaft": "За затвором цистерны начинается спуск, который официально заварен. Нужен ключ или лом.",
            "j_shaft_open": "Шлюз открыт. Внизу жар и запах озона.",
            "j_valves": "Вентили выставлены: путь к Сердцу открыт.",
            "j_descent": "Ты в шахте. Здесь считают не часы, а вдохи.",
            "j_core": "Зал Сердца. Илария Грант жива — и она всё ещё инженер.",
            "j_second": "Мастер Грист найден у печи. Он так и не назвал имён, и теперь уже не назовёт.",
            "j_escaped": "След ушёл по жилам. Дело № 14 готовят к списанию.",
            "j_ilaria_dead": "Илария Грант мертва. Сердца остались лежать в медном ящике — ничьи.",
            "j_done": "Дело № 14 закрыто. Каркас продолжает дымить.",
        },
        "stages": [
            {"id": "stage_start", "label": "Дело принято",
             "on_enter_effects": [{"type": "journal_update", "quest": "quest_main",
                                   "text_key": "j_start"}],
             "transitions": [
                 {"to": "stage_failed",
                  "conditions": [{"type": "flag_set", "flag": "killer_escaped"}]},
                 {"to": "stage_clues",
                  "conditions": [{"type": "flag_set", "flag": "clues_done"}]}]},
            {"id": "stage_clues", "label": "Улики",
             "transitions": [
                 {"to": "stage_failed",
                  "conditions": [{"type": "flag_set", "flag": "killer_escaped"}]},
                 {"to": "stage_crew",
                  "conditions": [{"type": "flag_set", "flag": "crew_list_found"}]}]},
            {"id": "stage_crew", "label": "Бригада Спуска",
             "transitions": [
                 {"to": "stage_failed",
                  "conditions": [{"type": "flag_set", "flag": "killer_escaped"}]},
                 {"to": "stage_shaft",
                  "conditions": [{"type": "flag_set", "flag": "shaft_open"}]}]},
            {"id": "stage_shaft", "label": "Шлюз",
             "transitions": [
                 {"to": "stage_failed",
                  "conditions": [{"type": "flag_set", "flag": "killer_escaped"}]},
                 {"to": "stage_valves",
                  "conditions": [{"type": "flag_set", "flag": "valves_fixed"}]}]},
            {"id": "stage_valves", "label": "Вентили",
             "transitions": [
                 {"to": "stage_failed",
                  "conditions": [{"type": "flag_set", "flag": "killer_escaped"}]},
                 {"to": "stage_core",
                  "conditions": [{"type": "flag_set", "flag": "core_entered"}]}]},
            {"id": "stage_core", "label": "Поддон",
             "transitions": [
                 {"to": "stage_failed",
                  "conditions": [{"type": "flag_set", "flag": "killer_escaped"},
                                 {"type": "flag_not_set", "flag": "sealed"},
                                 {"type": "flag_not_set", "flag": "joined_ilaria"}]},
                 {"to": "stage_done",
                  "conditions": [{"type": "flag_set", "flag": "sealed"}]},
                 {"to": "stage_done",
                  "conditions": [{"type": "flag_set", "flag": "joined_ilaria"}]},
                 {"to": "stage_done",
                  "conditions": [{"type": "flag_set", "flag": "ilaria_arrested"}]},
                 {"to": "stage_done",
                  "conditions": [{"type": "flag_set", "flag": "ilaria_dead"}]},
                 {"to": "stage_done",
                  "conditions": [{"type": "flag_set", "flag": "case_closed"}]},
                 {"to": "stage_done",
                  "conditions": [{"type": "flag_set", "flag": "fled_city"}]},
                 {"to": "stage_done",
                  "conditions": [{"type": "flag_set", "flag": "wrong_verdict"}]}]},
            {"id": "stage_done", "label": "Дело закрыто", "final": True, "outcome": "success",
             "on_enter_effects": [{"type": "journal_update", "quest": "quest_main",
                                   "text_key": "j_done"},
                                  {"type": "grant_xp", "points": 100}]},
            {"id": "stage_failed", "label": "Холодное дело", "final": True, "outcome": "failure"},
        ],
    },
    {
        "id": "quest_lens", "label": "Линза для вдовы",
        "description": "Эрдал нёс жене недоточенную линзу. Доделать её — значит поговорить с Карной не как дознаватель.",
        "chapter": "ch_copper",
        "journal_entries": {
            "j_lens_start": "В кармане убитого — мутная заготовка линзы. Карна узнает её.",
            "j_lens_done": "Линза обточена и отдана вдове. Она смотрит на тебя иначе.",
        },
        "stages": [
            {"id": "stage_start", "label": "Заготовка",
             "on_enter_effects": [{"type": "journal_update", "quest": "quest_lens",
                                   "text_key": "j_lens_start"}],
             "transitions": [{"to": "stage_done",
                              "conditions": [{"type": "flag_set", "flag": "karna_lens"}]}]},
            {"id": "stage_done", "label": "Отдано", "final": True, "outcome": "success",
             "on_enter_effects": [{"type": "journal_update", "quest": "quest_lens",
                                   "text_key": "j_lens_done"},
                                  {"type": "give_reward", "items": [
                                      {"item": "item_mark", "quantity": 20}]},
                                  {"type": "grant_xp", "points": 40}]},
        ],
    },
    {
        "id": "quest_medicine", "label": "Лекарство для Миры",
        "description": "Сестра Щепки задыхается. Настойка стоит тридцать марок — или одну услугу.",
        "chapter": "ch_pipes",
        "journal_entries": {
            "j_med_start": "Мира не дышит полно. Щепка просит настойку для лёгких.",
            "j_med_done": "Настойка у Миры. Щепка смотрит на тебя так, будто ты первый взрослый, который вернулся.",
            "j_med_lost": "Ты не успел. Каморка пуста, Миру унесли.",
        },
        "stages": [
            {"id": "stage_start", "label": "Настойка",
             "on_enter_effects": [{"type": "journal_update", "quest": "quest_medicine",
                                   "text_key": "j_med_start"}],
             "transitions": [{"to": "stage_done",
                              "conditions": [{"type": "flag_set", "flag": "medicine_given"}]}]},
            {"id": "stage_done", "label": "Помог", "final": True, "outcome": "success",
             "on_enter_effects": [{"type": "journal_update", "quest": "quest_medicine",
                                   "text_key": "j_med_done"},
                                  {"type": "change_disposition", "target": "faction_undercity",
                                   "delta": 15},
                                  {"type": "grant_xp", "points": 40}]},
        ],
    },
    {
        "id": "quest_volt", "label": "Долг Вольту",
        "description": "Скупщик знает, кому сбывал сердца. Плата — марки, молчание или чужая свобода.",
        "chapter": "ch_foundry",
        "journal_entries": {
            "j_volt_start": "Вольт торгует крадеными сердцами. С ним можно договориться или его можно сдать.",
            "j_volt_deal": "Вольт показал, кому сбывал сердца, и дал ключ от шлюза.",
            "j_volt_arrest": "Вольт сдан Надзору: в камере он говорит охотнее, чем на свалке.",
        },
        "stages": [
            {"id": "stage_start", "label": "Разговор с Вольтом",
             "on_enter_effects": [{"type": "journal_update", "quest": "quest_volt",
                                   "text_key": "j_volt_start"}],
             "transitions": [
                 {"to": "stage_deal",
                  "conditions": [{"type": "flag_set", "flag": "volt_deal"}]},
                 {"to": "stage_arrest",
                  "conditions": [{"type": "flag_set", "flag": "volt_arrested"}]}]},
            {"id": "stage_deal", "label": "Сделка",
             "on_enter_effects": [{"type": "journal_update", "quest": "quest_volt",
                                   "text_key": "j_volt_deal"},
                                  {"type": "add_item", "item": "item_key_shaft", "quantity": 1},
                                  {"type": "set_flag", "flag": "shaft_key"},
                                  {"type": "grant_xp", "points": 35}],
             "transitions": []},
            {"id": "stage_arrest", "label": "Сдан Надзору", "final": True, "outcome": "success",
             "on_enter_effects": [{"type": "journal_update", "quest": "quest_volt",
                                   "text_key": "j_volt_arrest"},
                                  {"type": "change_disposition", "target": "faction_watch",
                                   "delta": 15},
                                  {"type": "change_disposition", "target": "faction_undercity",
                                   "delta": -20},
                                  {"type": "give_reward", "items": [
                                      {"item": "item_mark", "quantity": 25}]},
                                  {"type": "grant_xp", "points": 35}]},
        ],
    },
    {
        "id": "quest_breath", "label": "Дыхание города",
        "description": "Без фильтра маска держит час. Фильтр можно купить — а можно сделать.",
        "chapter": "ch_pipes",
        "journal_entries": {
            "j_breath_start": "В нижних ярусах без фильтра не продохнуть. Нужен сменный фильтр.",
            "j_breath_done": "Фильтр есть: маска снова держит пепел.",
        },
        "stages": [
            {"id": "stage_start", "label": "Нужен фильтр",
             "on_enter_effects": [{"type": "journal_update", "quest": "quest_breath",
                                   "text_key": "j_breath_start"}],
             "transitions": [{"to": "stage_done",
                              "conditions": [{"type": "has_item", "item": "item_filter",
                                              "min_quantity": 2}]}]},
            {"id": "stage_done", "label": "Дышится", "final": True, "outcome": "success",
             "on_enter_effects": [{"type": "journal_update", "quest": "quest_breath",
                                   "text_key": "j_breath_done"},
                                  {"type": "unlock_recipe", "recipe": "recipe_filter"},
                                  {"type": "grant_xp", "points": 25}]},
        ],
    },
    {
        "id": "quest_codex", "label": "Что осталось от Сердца",
        "description": "Город не помнит, что с ним случилось. Записи кодекса — единственный чертёж того, что внизу.",
        "chapter": "ch_shaft",
        "journal_entries": {
            "j_codex_start": "Ты собираешь всё, что город забыл о Сердце.",
            "j_codex_done": "Кожух Сердца осмотрен: ты знаешь о нём больше, чем Цех.",
        },
        "stages": [
            {"id": "stage_start", "label": "Записи",
             "on_enter_effects": [{"type": "journal_update", "quest": "quest_codex",
                                   "text_key": "j_codex_start"}],
             "transitions": [{"to": "stage_done",
                              "conditions": [{"type": "flag_set", "flag": "codex_heart"}]}]},
            {"id": "stage_done", "label": "Чертёж понятен", "final": True, "outcome": "success",
             "on_enter_effects": [{"type": "journal_update", "quest": "quest_codex",
                                   "text_key": "j_codex_done"},
                                  {"type": "grant_xp", "points": 40}]},
        ],
    },
]


def quests():
    return {q["id"]: q for q in QUESTS}


# ---------------------------------------------------------------- арены


def arena(id, label, cols=12, rows=8, blocked=(), difficult=(), cover=(), music=None,
          image=""):
    return {
        "id": id, "label": label, "image": image,
        "canvas": {"w": W, "h": H},
        "hex_grid": {"cols": cols, "rows": rows, "hex_size": 42, "offset": "odd-r",
                     "blocked_hexes": [list(b) for b in blocked],
                     "difficult_terrain": [list(d) for d in difficult],
                     "cover_hexes": [list(c) for c in cover]},
        "spawn_zones": {
            "player": {"hexes": [[0, 3], [0, 4], [1, 3], [1, 4]]},
            "enemy": {"hexes": [[cols - 1, 3], [cols - 1, 4], [cols - 2, 2], [cols - 2, 5]]},
        },
        "music": music or "music_battle",
    }


ARENAS = [
    arena("arena_watch", "Дом Надзора (бой)", blocked=[(5, 0), (5, 7)],
          cover=[(3, 2), (3, 5), (8, 2), (8, 5)], music="music_battle"),
    arena("arena_copper", "Медный ряд (бой)", blocked=[(6, 1), (6, 6)],
          cover=[(2, 1), (2, 6), (9, 3), (9, 4)], difficult=[(5, 3), (6, 3)]),
    arena("arena_pipes", "Нижние трубы (бой)", cols=14, rows=7,
          blocked=[(4, 0), (4, 6), (9, 0), (9, 6)],
          cover=[(3, 2), (3, 4), (10, 2), (10, 4)], difficult=[(6, 3), (7, 3), (6, 2)]),
    arena("arena_foundry", "Литейный пролёт (бой)", blocked=[(6, 0), (6, 7)],
          cover=[(4, 2), (4, 5)], difficult=[(5, 3), (6, 3), (7, 3)], music="music_foundry"),
    arena("arena_ash", "Зольный двор (бой)", cols=13, rows=8,
          blocked=[(6, 4)], difficult=[(4, 2), (5, 5), (8, 2), (9, 5)],
          cover=[(2, 3), (10, 4)]),
    arena("arena_cistern", "Цистерна (бой)", blocked=[(3, 0), (3, 7)],
          difficult=[(5, 2), (6, 5), (7, 3)], cover=[(8, 2), (8, 5)]),
    arena("arena_shaft", "Шахта Сердца (бой)", cols=10, rows=8,
          blocked=[(4, 0), (5, 7)],
          difficult=[(3, 3), (6, 4)], cover=[(2, 2), (7, 5)], music="music_shaft"),
    arena("arena_core", "Поддон (бой)", cols=12, rows=9,
          blocked=[(5, 0), (6, 8)],
          difficult=[(4, 4), (7, 4)], cover=[(3, 2), (8, 6)], music="music_core"),
]


def arenas():
    return {a["id"]: a for a in ARENAS}


# ---------------------------------------------------------------- катсцены


def slide(text, art=None, image=None, transition="fade", duration=None, camera=None):
    s = {"text": text, "transition": transition}
    if art:
        s["art"] = art
    if image:
        s["image"] = image
    if duration:
        s["duration"] = duration
    if camera:
        s["camera"] = camera
    return s


def sky_slide(text, top, bottom, extras=(), duration=7, transition="fade"):
    layers = [rect(0, 0, W, 460, grad(top, bottom, 90), label="небо")]
    layers += list(extras)
    layers.append(poly([0, 460, W, 460, W, H, 0, H], "#14161a", label="город"))
    return slide(text, art={"canvas": {"w": W, "h": H}, "background": bottom,
                            "layers": layers}, duration=duration, transition=transition)


def skyline(extra_color="#0e1014"):
    out = []
    xs = [40, 170, 300, 430, 560, 690, 820, 950, 1080]
    hs = [260, 190, 320, 150, 240, 300, 180, 260, 210]
    for x, h in zip(xs, hs):
        out.append(rect(x, 460 - h, 90, h, extra_color, label="корпус"))
        for k in range(3):
            out.append(rect(x + 16, 460 - h + 30 + k * 60, 20, 26, "#c9853c", opacity=0.28))
    for x in (210, 620, 1010):
        out.append(rect(x, 460 - 380, 40, 380, "#0b0d10", label="труба"))
        out.append(ellipse(x + 20, 460 - 420, 70, 44, "#2a2d33", opacity=0.5))
        out.append(ellipse(x + 20, 460 - 480, 100, 60, "#23262b", opacity=0.28))
    return out


CUTSCENES = [
    {
        "id": "cutscene_intro", "label": "Пролог: ночной вызов", "music": "music_menu",
        "chapter": "ch_prologue",
        "slides": [
            sky_slide("Каркас, 137-й год Пепла. Двенадцать лет назад Сердце остановилось, "
                      "и город научился считать воду по глоткам.",
                      "#20242c", "#0d0f13", skyline(), duration=8, transition="panzoom"),
            sky_slide("Ночью в Нижних трубах нашли Эрдала Вета. Грудь вскрыта ровным разрезом, "
                      "медного сердца нет.",
                      "#1a1c22", "#08090c",
                      skyline() + [rect(560, 470, 180, 90, "#20242a", radius=8),
                                   ellipse(650, 500, 40, 26, "#5a2b2b", opacity=0.8)],
                      duration=8, transition="fade"),
            sky_slide("Сердце у него было той же серии, что у тебя. И это — не совпадение, "
                      "а первая улика, которую ты пока не понимаешь.",
                      "#15171c", "#06070a",
                      skyline() + [ellipse(640, 380, 200, 200, "#6b1f2f", opacity=0.20),
                                   ellipse(640, 380, 90, 90, "#c9853c", opacity=0.35)],
                      duration=8, transition="panzoom"),
            sky_slide("Утром капитан Строй положил перед тобой папку с номером четырнадцать "
                      "и сказал: «Закрой её быстро».",
                      "#2a2418", "#0d0b08",
                      [rect(300, 300, 680, 260, "#3a3020", radius=6, label="папка"),
                       rect(340, 330, 600, 200, "#d8cdb8", opacity=0.55)],
                      duration=7, transition="slide"),
        ],
    },
    {
        "id": "cutscene_second", "label": "Второе убийство", "music": "music_foundry",
        "chapter": "ch_foundry",
        "slides": [
            slide("Ты опоздал на полсмены. Мастер Грист лежал у печи лицом в золу, "
                  "а вентиляция выла так, будто забирала не только дым.",
                  art=furnace_hall(PAL["foundry"], molten=True, props=[
                      poly([300, 700, 380, 620, 520, 640, 560, 700], "#2a1a14", label="тело"),
                      ellipse(430, 660, 60, 22, "#6b1f1f", opacity=0.8),
                  ]), duration=7, transition="fade",
                  camera={"zoom": 1.15, "pan_x": -12, "pan_y": 8, "duration": 6}),
            slide("На его ладони было нацарапано одно слово, и оно было не имя. "
                  "Оно было номером — тем же, что на жетоне из трубы.",
                  art={"canvas": {"w": W, "h": H}, "background": "#120a07",
                       "layers": [rect(0, 0, W, H, "#1a100c"),
                                  ellipse(640, 360, 320, 240, "#ff7a2e", opacity=0.18),
                                  rect(480, 300, 320, 220, "#2a1a12", radius=8,
                                       stroke="#6b5340", label="ладонь"),
                                  text(640, 400, "7", size=140, color="#ffb27a",
                                       align="middle", bold=True)]},
                  duration=6, transition="panzoom"),
            slide("С этого утра в Медном ряду не продают воду без талона. "
                  "Город всегда отвечает на смерть ценой.",
                  art=interior(PAL["copper"], floor_y=520,
                               props=[rect(300, 260, 680, 260, "#2a1f16", radius=8,
                                           stroke="#6b5340", label="прилавок"),
                                      text(640, 420, "ВОДА — ПО ТАЛОНАМ", size=44,
                                           color="#d8cdb8", align="middle", bold=True)]),
                  duration=6, transition="slide"),
        ],
    },
    {
        "id": "cutscene_descent", "label": "Спуск", "music": "music_shaft",
        "chapter": "ch_shaft",
        "slides": [
            slide("Лестница уходит вниз дольше, чем должна. На четвёртом пролёте перестаёшь "
                  "слышать город и начинаешь слышать счёт.",
                  art=tunnel(PAL["shaft"], puddle=False, grating=False,
                             glow_color="#b06fd0",
                             props=[rect(520, 160, 240, 560, "#2a2333", radius=8,
                                         label="лестница"),
                                    *[rect(524, 200 + i * 70, 232, 12, "#4a3f5a")
                                      for i in range(7)]]),
                  duration=8, transition="panzoom",
                  camera={"zoom": 1.1, "pan_y": 14, "duration": 8}),
            slide("Жар поднимается навстречу. Кто-то выставил вентили так, чтобы он шёл вниз, "
                  "а не в дома.",
                  art=tunnel(PAL["shaft"], puddle=True, grating=False, glow_color="#ff8b6b",
                             props=[ellipse(640, 520, 300, 120, "#ff7a2e", opacity=0.25)]),
                  duration=7, transition="fade"),
            slide("На стене — графит: семь засечек, три из них перечёркнуты. "
                  "Кто-то считал тех, кто не вышел.",
                  art={"canvas": {"w": W, "h": H}, "background": "#120f16",
                       "layers": [rect(0, 0, W, H, "#1a1620"),
                                  rect(300, 220, 680, 300, "#211b28", radius=6,
                                       stroke="#4a3f5a", label="стена"),
                                  *[line(380 + i * 90, 300, 380 + i * 90, 440, "#b06fd0", 8)
                                    for i in range(7)],
                                  line(360, 370, 920, 350, "#ff5f7a", 6, opacity=0.8),
                                  line(350, 380, 930, 400, "#ff5f7a", 6, opacity=0.7)]},
                  duration=7, transition="slide"),
        ],
    },
    {
        "id": "cutscene_core", "label": "Зал Сердца", "music": "music_core",
        "chapter": "ch_core",
        "slides": [
            slide("Поддон — не подвал. Это колодец, в который город спускал всё, "
                  "что не хотел называть вслух.",
                  art=machine_core(PAL["core"], rings=True, glow=False, catwalk=True),
                  duration=7, transition="panzoom"),
            slide("Посреди зала стоит женщина в зеркальной маске. В маске отражается "
                  "не комната, а ты.",
                  art=machine_core(PAL["core"], rings=True, glow=True, catwalk=True),
                  duration=7, transition="fade",
                  camera={"zoom": 1.25, "pan_y": -6, "duration": 6}),
            slide("— Ты долго шёл, — говорит она. — Я думала, пришлют кого-нибудь "
                  "похуже.",
                  art={"canvas": {"w": W, "h": H}, "background": "#0d0910",
                       "layers": [rect(0, 0, W, H, "#130e18"),
                                  ellipse(640, 340, 260, 320, "#2a2033", opacity=0.9),
                                  ellipse(640, 250, 90, 110, "#3a3040", label="маска"),
                                  ellipse(640, 240, 62, 78, "#c9b8d8", opacity=0.75),
                                  ellipse(640, 400, 150, 200, "#1e1728"),
                                  ellipse(640, 620, 300, 80, "#ff5f7a", opacity=0.12)]},
                  duration=6, transition="slide"),
        ],
    },
    {
        "id": "cutscene_seal", "label": "Печать", "music": "music_core",
        "chapter": "ch_core",
        "slides": [
            slide("Последний вентиль пошёл тяжело. Жилы остыли, счёт оборвался, "
                  "и впервые за двенадцать лет в трубах стало тихо.",
                  art=machine_core(PAL["core"], rings=True, glow=False, catwalk=True),
                  duration=7, transition="fade"),
            slide("Наверху это запишут как обрушение шлюза. Каркас будет остывать дальше, "
                  "но доживёт до утра.",
                  art=sky_slide("", "#1a1c22", "#08090c", skyline(), duration=7)["art"],
                  duration=7, transition="panzoom"),
        ],
    },
    {
        "id": "cutscene_current", "label": "Ток", "music": "music_core",
        "chapter": "ch_core",
        "slides": [
            slide("Ток пошёл через грудь. Лампы Медного ряда дрогнули и загорелись ровно — "
                  "впервые на твоей памяти.",
                  art={"canvas": {"w": W, "h": H}, "background": "#0f0a14",
                       "layers": [rect(0, 0, W, H, "#170f1e"),
                                  ellipse(640, 360, 420, 340, "#ff5f7a", opacity=0.22),
                                  ellipse(640, 360, 220, 180, "#ffb9c9", opacity=0.5),
                                  *[line(640, 360, 640 + (i - 300), 120, "#ffd9e2", 4,
                                         opacity=0.5) for i in range(0, 700, 100)]]},
                  duration=7, transition="fade"),
            slide("Илария смотрела на тебя и улыбалась так, будто ты наконец вернулся. "
                  "Что именно ты запустил — узнает не ты.",
                  art=machine_core(PAL["core"], rings=True, glow=True, catwalk=True),
                  duration=7, transition="panzoom"),
        ],
    },
    {
        "id": "cutscene_surface", "label": "Наверх", "music": "music_watch",
        "chapter": "ch_core",
        "slides": [
            slide("Обратный путь занял вдвое больше: ноги не хотели идти вверх, "
                  "а трубы гудели уже по-другому.",
                  art=tunnel(PAL["shaft"], puddle=True, grating=False, glow_color="#b06fd0"),
                  duration=6, transition="fade"),
            slide("Наверху тебя ждал протокол, подпись и папка с номером четырнадцать. "
                  "Каркас дымил, как ни в чём не бывало.",
                  art=sky_slide("", "#20242c", "#0d0f13", skyline(), duration=7)["art"],
                  duration=7, transition="panzoom"),
        ],
    },
]


def cutscenes():
    return {c["id"]: c for c in CUTSCENES}


# ---------------------------------------------------------------- рецепты

RECIPES = [
    {
        "id": "recipe_filter", "label": "Сменный фильтр",
        "description": "Прессованный уголь и войлок: держит пепел примерно сутки.",
        "inputs": [{"item": "item_cloth", "quantity": 1},
                   {"item": "item_scrap", "quantity": 1}],
        "tools": ["item_wrench"],
        "skill": {"id": "repair", "difficulty": 40},
        "time_ticks": 1,
        "output": {"item": "item_filter", "quantity": 1},
        "message": "Фильтр вышел кривым, но держит.",
    },
    {
        "id": "recipe_bolt", "label": "Выточить болты",
        "description": "Из медного лома выходит горсть болтов к арбалету.",
        "inputs": [{"item": "item_scrap", "quantity": 1}],
        "tools": ["item_wrench"],
        "skill": {"id": "repair", "difficulty": 35},
        "output": {"item": "item_bolt", "quantity": 4},
        "message": "Четыре болта, все кривые, все летят.",
    },
    {
        "id": "recipe_repair_mask", "label": "Починить респиратор",
        "description": "Разобрать маску, прочистить клапаны, заменить прокладку.",
        "inputs": [{"item": "item_scrap", "quantity": 1},
                   {"item": "item_cloth", "quantity": 1}],
        "tools": ["item_wrench"],
        "skill": {"id": "repair", "difficulty": 45},
        "time_ticks": 2,
        "output": {"item": "item_respirator", "quantity": 1},
        "repair": True,
        "message": "Маска снова прилегает к лицу и пахнет углём.",
    },
    {
        "id": "recipe_lens", "label": "Обточить линзу",
        "description": "Довести заготовку Эрдала до фокуса на абразивном круге.",
        "known": False,
        "inputs": [{"item": "item_glass_blank", "quantity": 1}],
        "tools": ["item_wrench"],
        "skill": {"id": "repair", "difficulty": 55},
        "time_ticks": 2,
        "output": {"item": "item_lens", "quantity": 1},
        "message": "Линза стала прозрачной. Через неё видно даже то, что лучше бы не видеть.",
    },
]


def recipes():
    return {r["id"]: r for r in RECIPES}


# ---------------------------------------------------------------- кодекс

CODEX = [
    {"id": "codex_karkas", "label": "Каркас", "category": "places",
     "text": "Город-завод, наросший вокруг Сердца — машины Предтеч, которую никто не умеет чинить. "
             "Сверху живёт Цех и Надзор, снизу — те, кто считает воду по глоткам. "
             "Между ними — трубы, по которым идёт то, что осталось от тепла.",
     "image": ""},
    {"id": "codex_undercity", "label": "Нижние трубы", "category": "places",
     "text": "Семь ярусов под рынком. Здесь не бывает дня, здесь считают часы по смене ламп. "
             "Без маски в трубах не протянуть и часа: пепел ложится на всё, включая легкие. "
             "Нижние не любят Надзор, но помнят лица — это и есть их архив.",
     "image": ""},
    {"id": "codex_shaft", "label": "Шахта Сердца", "category": "places",
     "text": "Официально заварена двенадцать лет назад. Неофициально — шлюз смазывают, "
             "а на стенах кто-то ведёт счёт засечками. За шахтой начинается Поддон, "
             "и оттуда поднимается жар, которого в остывшем городе быть не должно.",
     "image": ""},
    {"id": "codex_guild", "label": "Цех", "category": "chronicles",
     "text": "Союз мастеровых: медь, вода, талоны, протоколы. Цех держит машины, а значит — город. "
             "За это ему прощают почти всё: штрафы, обыски, молчание в накладных. "
             "В бумагах Цехa пропавших людей обычно называют «убывшими».",
     "image": ""},
    {"id": "codex_watch", "label": "Надзор", "category": "chronicles",
     "text": "Порядок в городе, где порядка нет. Надзор ведёт дела, выдаёт ордера и закрывает папки. "
             "Каждому делу дают срок — четырнадцать суток, — и по истечении срока папка "
             "уходит в архив, даже если убийца всё ещё ходит по трубам.",
     "image": ""},
    {"id": "codex_descent", "label": "Спуск", "category": "chronicles",
     "text": "Двенадцать лет назад, за месяц до Замирания, в Сердце спустилась бригада из семи человек. "
             "Наверх вышло четверо. Имена троих оставшихся записаны в журнале Вета, "
             "и одно из них — Илария Грант, инженер, помеченная как «убыла».",
     "image": ""},
    {"id": "codex_hearts", "label": "Медные сердца", "category": "machines",
     "text": "Регулятор дыхания серии М-9: медный корпус, два клапана, угольный фильтр. "
             "В нижних ярусах без него не прожить и суток. В городе их несколько сотен, "
             "и каждое стоит дороже, чем зарабатывает зольник за месяц. "
             "Сердца снимают только с мёртвых — или с тех, кто очень не хочет умирать.",
     "image": ""},
    {"id": "codex_veins", "label": "Жилы Сердца", "category": "machines",
     "text": "Система каналов под городом: по ним шли пар, вода и то, что Цех называет «остаточным током». "
             "Проводники говорят, что жилы не пусты, и что по ним можно ходить — если знать, "
             "где счёт совпадает с твоим дыханием.",
     "image": ""},
    {"id": "codex_whisper", "label": "Шёпот в трубах", "category": "chronicles",
     "text": "Проводники называют это током, нижние — шептуном, Цех — ересью. "
             "В трубах Нижних ярусов можно расслышать счёт: ровный, как будто кто-то "
             "перебирает имена и на каждом третьем спотыкается.",
     "image": ""},
    {"id": "codex_hound", "label": "Пепельный пёс", "category": "creatures",
     "creature_entity": "npc_ash_hound",
     "text": "Живёт в золе и дышит ею. Шерсть спеклась серыми комьями, в пасти — пепел вместо слюны. "
             "Нападает не сразу: сначала дышит, потом бросается. Пепельный выдох забивает лёгкие "
             "быстрее, чем клыки успевают достать.",
     "image": "assets/img/fig_hound.png"},
    {"id": "codex_boltnik", "label": "Болтник", "category": "creatures",
     "creature_entity": "npc_boltnik",
     "text": "Человек, сросшийся с ломом: рука примотана проволокой к железу так давно, "
             "что уже непонятно, где чья плоть. Бьёт хлёстко и цепко, почти не чувствует боли, "
             "а на отходе прикрывает лицо локтем — как будто ещё помнит, что это больно.",
     "image": "assets/img/fig_boltnik.png"},
    {"id": "codex_automaton", "label": "Сторожевой автомат", "category": "creatures",
     "creature_entity": "npc_automaton",
     "text": "Ржавая машина Цехa на трёх ногах с паровым котлом вместо груди. "
             "Программу ему никто не переписывал двенадцать лет, поэтому он охраняет "
             "то, чего здесь давно нет, и греет пар до красна.",
     "image": "assets/img/fig_automaton.png"},
    {"id": "codex_mirror", "label": "Зеркальный", "category": "creatures",
     "creature_entity": "npc_mirror_thrall",
     "text": "Лицо — полированный лист, в котором отражается не комната, а ты. "
             "Зеркальные не разговаривают и не снимают масок; если маску разбить, "
             "под ней оказывается не лицо её носителя, а лицо того, кто смотрит.",
     "image": "assets/img/fig_mirror.png"},
    {"id": "codex_heart", "label": "Сердце", "category": "places",
     "text": "То, вокруг чего построили город. Его не смогли починить и не смогли разобрать: "
             "оно считает. Замирание не остановило этот счёт, а лишь сделал его тише — "
             "и, кажется, счёт идёт по именам тех, кто к нему спускался.",
     "image": ""},
]


def encounter_tables():
    return {t["id"]: t for t in ENCOUNTER_TABLES}


def codex():
    return {c["id"]: c for c in CODEX}
