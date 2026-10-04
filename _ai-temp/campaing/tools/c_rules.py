"""Правила кампании: события улиц, квестовые триггеры, финальные ветки."""

from common import (eff_set_flag, eff_clear_flag, eff_msg, eff_banner, eff_codex,
                    eff_recipe, eff_quest, eff_advance, eff_fail, eff_journal,
                    eff_item, eff_take, eff_need, eff_hp, eff_sanity, eff_status,
                    eff_disp, eff_weather, eff_time, eff_fire, eff_cutscene,
                    eff_teleport, eff_reveal, eff_combat, eff_dialogue, eff_craft,
                    eff_description, eff_state, eff_scene_state, C)

RULES = {}


def rule(ident, label, conditions, effects, once=False, manual=False, chapter=None):
    r = {"id": ident, "label": label, "once": once, "conditions": conditions,
         "effects": effects}
    if manual:
        r["manual"] = True
    if chapter:
        r["chapter"] = chapter
    return r


def add(r):
    RULES[r["id"]] = r


def enemies(*pairs):
    return [{"entity": e, "count": n} for e, n in pairs]


# ---------------------------------------------------------------- пролог

add(rule(
    "rule_intro", "Пролог: смена началась", [C.tick(0)],
    [eff_cutscene("cutscene_intro"),
     eff_banner("Котёл. Четвёртое тело", preset="глава", position="центр"),
     eff_codex("codex_cauldron"),
     eff_msg("Смена началась в шесть. К восьми в Медном цеху уже лежал человек."),
     eff_weather("weather_ashfall")],
    once=True, chapter="ch_prologue"))

add(rule(
    "rule_first_forge", "Первая встреча с Серой",
    [C.enters_scene("scene_forgehall"), C.noflag("met_sera")],
    [eff_set_flag("met_sera"), eff_dialogue("npc_sera"),
     eff_need("need_nerve", -4)],
    once=True, chapter="ch_prologue"))

add(rule(
    "rule_weather_ash", "С утра пошёл пеплопад",
    [C.tick(4)],
    [eff_weather("weather_ashfall"),
     eff_msg("С труб пошёл пепел: дышать можно, но не стоит.")],
    once=True, chapter="ch_prologue"))

# ---------------------------------------------------------------- улицы

add(rule(
    "rule_drain_patrol", "Патруль в лотках",
    [C.enters_scene("scene_drains"), C.chance(0.6), C.noflag("guard_alert")],
    [eff_combat(enemies(("npc_strazh", 1)), "arena_forge",
                intro="Сверху по лестнице спускается патруль с фонарём: «Стоять! Кто в лотках?»",
                on_victory=[eff_set_flag("curfew_broken"),
                            eff_set_flag("guard_alert"),
                            {"type": "commit_crime", "id": "crime_assault", "bounty": 15},
                            {"type": "change_reputation", "delta": -10},
                            eff_msg("Патруль остался в лотках. Теперь стража ищет кого-то с разбитым фонарём.")])],
    once=True, chapter="ch_investigation"))

add(rule(
    "rule_gate_warning", "За Пепельными воротами",
    [C.enters_location("loc_ashflats")],
    [eff_msg("За воротами Котёл дышит в спину тёплым пеплом."),
     eff_status("status_ash_lung", 6),
     eff_sanity(-2)],
    once=True, chapter="ch_depths"))

# ---------------------------------------------------------------- свидетель

add(rule(
    "rule_gnat_ambush", "Заводные приходят за свидетелем",
    [C.enters_scene("scene_gnat_hut"),
     C.quest("quest_witness", "stage_search")],
    [eff_combat(enemies(("npc_zavodnoy", 2)), "arena_forge",
                intro="Дверь мастерской срывает с петель: двое в латунных масках входят без стука.",
                on_victory=[eff_set_flag("gnat_saved"),
                            eff_msg("Гнат выбирается из-под верстака и долго не может говорить."),
                            eff_disp("npc_gnat", 15),
                            eff_reveal("loc_chapel")],
                on_defeat=[eff_set_flag("gnat_dead"), eff_fail("quest_witness")])],
    once=True, chapter="ch_investigation"))

add(rule(
    "rule_gnat_dead_news", "Свидетель потерян",
    [C.flag("gnat_dead")],
    [eff_fail("quest_witness"),
     eff_msg("К мастерской больше некому идти. Свидетель остался в ней навсегда."),
     eff_disp("npc_sera", -5)],
    once=True, chapter="ch_investigation"))

# ---------------------------------------------------------------- трубы

add(rule(
    "rule_tunnel_meet", "Кто-то сидит на мостках",
    [C.enters_scene("scene_tunnels"), C.noflag("tisha_met")],
    [eff_set_flag("tisha_met"), eff_dialogue("npc_tisha"),
     eff_sanity(-4), eff_need("need_nerve", -5)],
    once=True, chapter="ch_depths"))

add(rule(
    "rule_barnaba_patrol", "Заводной патруль",
    [C.enters_scene("scene_tunnels"), C.flag("lens_built"), C.noflag("barnaba_met")],
    [eff_set_flag("barnaba_met"), eff_dialogue("npc_barnaba")],
    once=True, chapter="ch_depths"))

add(rule(
    "rule_barnaba_fight", "Бой с Барнабой",
    [], [eff_combat(enemies(("npc_barnaba", 1)), "arena_tunnels",
                    intro="Барнаба снимает с плеча молот и заводит пружину до щелчка.",
                    on_victory=[eff_set_flag("barnaba_destroyed"),
                                eff_item("item_core_shard", 1),
                                eff_codex("codex_zavodnoy"),
                                eff_msg("В груди заводного остался только тёплый осколок сердечника.")])],
    manual=True, chapter="ch_depths"))

add(rule(
    "rule_barnaba_mercy", "Барнаба освобождён",
    [], [eff_set_flag("barnaba_freed"),
         eff_disp("npc_barnaba", 40),
         eff_sanity(6),
         eff_msg("Пружина в груди заводного щёлкает вхолостую — и он впервые за двенадцать лет делает вдох.")],
    manual=True, chapter="ch_depths"))

# ---------------------------------------------------------------- вода и барак

add(rule(
    "rule_water_restored", "Вода пошла в Котёл",
    [], [eff_set_flag("water_restored"),
         eff_recipe("recipe_tonic"),
         eff_banner("Вода пошла", preset="заголовок", position="верх"),
         eff_msg("В трубах за спиной поднимается ровный шум: город снова пьёт."),
         {"type": "change_reputation", "delta": 5},
         eff_fire("rule_price_clear")],
    manual=True, chapter="ch_depths"))

add(rule(
    "rule_price_clear", "Цены откатились",
    [], [{"type": "clear_price_event", "id": "price_blockade"},
         eff_msg("К утру цены на воду вернулись к обычным.")],
    manual=True, chapter="ch_depths"))

add(rule(
    "rule_barrack_warm", "В бараке стало тепло",
    [], [eff_set_flag("furnace_fixed"),
         eff_journal("quest_quarantine", "j_warm"),
         eff_disp("npc_klepa", 15),
         eff_msg("Клепа трогает трубу ладонью и молча кивает.")],
    manual=True, chapter="ch_investigation"))

add(rule(
    "rule_quarantine_done", "Барак выжил",
    [C.flag("quarantine_tonics"), C.flag("furnace_fixed")],
    [eff_advance("quest_quarantine", "stage_done"),
     eff_disp("npc_klepa", 10),
     {"type": "change_reputation", "delta": 5},
     {"type": "change_reputation", "delta": 4},
     eff_msg("Клепа впервые за неделю садится на табурет: пятеро дышат, печь гудит.")],
    once=True, chapter="ch_investigation"))

# ---------------------------------------------------------------- книга

add(rule(
    "rule_veksel_ledger_talk", "Разговор о книге",
    [], [eff_dialogue("npc_veksel", "ledger")],
    manual=True, chapter="ch_investigation"))

add(rule(
    "rule_ledger_ceh", "Книга уходит в Курию",
    [], [eff_set_flag("ledger_ceh"),
         {"type": "change_reputation", "delta": 10},
         eff_disp("npc_sera", 10),
         eff_msg("Сера забирает гроссбух и обещает: имена попадут в бумагу, а бумага — в дело.")],
    manual=True, chapter="ch_investigation"))

add(rule(
    "rule_ledger_returned", "Книга вернулась к Векселю",
    [], [eff_set_flag("ledger_returned"),
         eff_disp("npc_veksel", 20),
         eff_item("item_mark", 15),
         eff_msg("Вексель отсчитывает пятнадцать марок и впервые не проверяет, не фальшивые ли они.")],
    manual=True, chapter="ch_investigation"))

add(rule(
    "rule_ledger_burned", "Книга сожжена",
    [], [eff_set_flag("ledger_burned"),
         {"type": "change_reputation", "delta": -10},
         eff_sanity(4),
         eff_msg("Бумага горит быстро: десять лет долгов — на две минуты тепла.")],
    manual=True, chapter="ch_investigation"))

# ---------------------------------------------------------------- шёпот

add(rule(
    "rule_whisper_reveal", "Стены заговорили",
    [], [eff_cutscene("cutscene_mid"),
         eff_set_flag("whisper_heard"),
         eff_status("status_whisper", 10),
         eff_codex("codex_ether"),
         eff_sanity(-6),
         eff_msg("Труба говорит ровно и ласково, как машина, которой долго не отвечали.")],
    manual=True, chapter="ch_depths"))

add(rule(
    "rule_nerve_break", "Нервы сорвались",
    [], [eff_set_flag("nerve_broken"),
         eff_set_flag("whisper_heard"),
         eff_status("status_whisper", 12),
         eff_sanity(-8),
         eff_banner("Шёпот", preset="шёпот", position="верх"),
         eff_msg("В ушах поднимается ровный латунный голос и не собирается замолкать.")],
    manual=True, chapter="ch_depths"))

add(rule(
    "rule_mind_gone", "Рассудок не выдержал",
    [{"type": "sanity_le", "threshold": 1}, C.flag("whisper_heard")],
    [{"type": "game_over_death", "reason": "Шёпот забрал героя под городом"}],
    once=True, chapter="ch_finale"))

# ---------------------------------------------------------------- глубина

add(rule(
    "rule_deep_arrival", "Глубинное зало",
    [C.enters_location("loc_deeps")],
    [eff_codex("codex_deep"),
     eff_banner("Глубинное зало", preset="заголовок", position="верх"),
     eff_sanity(-6),
     eff_msg("Под городом пахнет горячим железом и старой водой.")],
    once=True, chapter="ch_finale"))

add(rule(
    "rule_deep_klein", "Здесь кто-то ждёт",
    [C.enters_scene("scene_deepcore"), C.noflag("klein_met")],
    [eff_set_flag("klein_met"), eff_dialogue("npc_klein")],
    once=True, chapter="ch_finale"))

add(rule(
    "rule_turbine_surge", "Сердце проснулось",
    [], [eff_scene_state("scene_deepcore", "state_mother"),
         eff_set_flag("mother_met"),
         eff_banner("Сердце проснулось", preset="глава", position="центр"),
         eff_status("status_under_current", 5),
         eff_codex("codex_mother"),
         eff_sanity(-5),
         eff_dialogue("npc_ironmother")],
    manual=True, chapter="ch_finale"))

add(rule(
    "rule_evacuate", "Квартал уходит наверх",
    [], [eff_set_flag("city_evacuated"),
         eff_banner("Квартал уходит", preset="заголовок", position="верх"),
         eff_msg("Люди идут по мосткам к лифту: с детьми, с узлами, не оглядываясь."),
         {"type": "change_reputation", "delta": 10},
         {"type": "change_reputation", "delta": 15}],
    manual=True, chapter="ch_finale"))

# ---------------------------------------------------------------- финальные ветки

add(rule(
    "rule_klein_fight", "Бой в машинном зале",
    [], [eff_combat(enemies(("npc_klein", 1), ("npc_zavodnoy", 2)), "arena_core",
                    intro="Кляйн поднимает руку, и латунь в стенах отвечает ему гулом.",
                    allies=[{"entity": "npc_barnaba", "count": 1}],
                    on_victory=[eff_set_flag("klein_defeated"),
                                eff_codex("codex_klein"),
                                eff_msg("Мастер садится на мостки, будто устал, и перестаёт быть."),
                                eff_scene_state("scene_deepcore", "state_mother")],
                    on_defeat=[])],
    manual=True, chapter="ch_finale"))

add(rule(
    "rule_fight_without_barnaba", "Бой с Кляйном без союзника",
    [], [eff_combat(enemies(("npc_klein", 1), ("npc_zavodnoy", 2)), "arena_core",
                    intro="Кляйн поднимает руку, и латунь в стенах отвечает ему гулом.",
                    on_victory=[eff_set_flag("klein_defeated"),
                                eff_msg("Мастер садится на мостки, будто устал, и перестаёт быть.")],
                    on_defeat=[])],
    manual=True, chapter="ch_finale"))

add(rule(
    "rule_ending_peace", "Пепельное согласие",
    [], [eff_set_flag("mother_pacified"),
         eff_advance("quest_mother", "stage_peace"),
         {"type": "game_over_victory"}],
    manual=True, chapter="ch_finale"))

add(rule(
    "rule_ending_heart", "Новое сердце",
    [], [eff_set_flag("mother_bound"),
         eff_advance("quest_mother", "stage_bound"),
         {"type": "game_over_victory"}],
    manual=True, chapter="ch_finale"))

add(rule(
    "rule_ending_outer", "Тихий тракт",
    [], [eff_set_flag("gate_left"),
         {"type": "game_over_victory"}],
    manual=True, chapter="ch_finale"))

add(rule(
    "rule_ending_ceh", "Тихая бумага",
    [], [eff_set_flag("ledger_ceh"),
         {"type": "game_over_victory"}],
    manual=True, chapter="ch_finale"))

# ---------------------------------------------------------------- события города

add(rule(
    "rule_night_patrol", "Ночной патруль на улице",
    [C.flag("case_taken"), C.NOT(C.flag("curfew_broken"))],
    [{"type": "start_pursuit", "label": "Патруль стражи", "skill": "stealth",
      "every_ticks": 3, "fails_to_catch": 1,
      "on_fail": [eff_combat(enemies(("npc_strazh", 2)), "arena_yard",
                             intro="Фонарь бьёт в лицо: «Стоять! Комендантский час!»",
                             on_victory=[eff_set_flag("curfew_broken"),
                                         eff_set_flag("guard_alert"),
                                         {"type": "commit_crime", "id": "crime_assault", "bounty": 20},
                                         {"type": "change_reputation", "delta": -10},
                                         eff_msg("Улица снова пуста, но рында уже звенит.")])]},
     eff_msg("За спиной стучат шаги и скрипит рында.")],
    manual=True, chapter="ch_depths"))

add(rule(
    "rule_ash_gust", "Пепельный шквал",
    [C.weather("weather_ashfall")],
    [eff_status("status_ash_lung", 8),
     eff_msg("Ветер несёт пепел стеной: дышать через платок, идти быстро.")],
    manual=True, chapter="ch_depths"))

add(rule(
    "rule_whisper_night", "Шёпот по ночам",
    [C.flag("case_taken")],
    [eff_set_flag("whisper_heard"),
     eff_status("status_whisper", 6),
     eff_codex("codex_ether"),
     eff_sanity(-4),
     eff_msg("В вечерней тишине слышно, как трубы переговариваются между собой.")],
    manual=True, chapter="ch_depths"))

add(rule(
    "rule_day_works", "Дневная смена",
    [],
    [eff_msg("Где-то сбрасывают пар, где-то тянут кабель: Котёл работает."),
     eff_need("need_rest", -4)],
    manual=True, chapter="ch_investigation"))

add(rule(
    "rule_steam_release", "Сброс пара",
    [],
    [eff_msg("Труба в квартале сбрасывает пар: теплее, но не видно ни зги."),
     eff_need("need_warmth", 6)],
    manual=True, chapter="ch_investigation"))

add(rule(
    "rule_price_shift", "Комендантские поставки",
    [],
    [{"type": "set_price_event", "id": "price_curfew"},
     eff_msg("С карантина подвезли мало: еда и питьё подорожали.")],
    manual=True, chapter="ch_investigation"))

add(rule(
    "rule_camp_ambush", "Пепел шевелится",
    [],
    [eff_combat(enemies(("npc_pipe_beast", 1)), "arena_yard",
                intro="Пепел на краю лагеря шевелится — и поднимается на четыре лапы.",
                on_victory=[eff_msg("Костёр цел, и до рассвета можно доспать.")])],
    manual=True, chapter="ch_depths"))


add(rule(
    "rule_steam_vent_city", "Городской сброс пара",
    [C.tick(6), C.flag("water_restored")],
    [eff_need("need_warmth", 8),
     eff_msg("Из вентиляционных колодцев ударил тёплый пар: верхние улицы впервые за месяц дышат теплом."),
     eff_banner("Пар пошёл в город", preset="шёпот", seconds=4)],
    once=True, chapter="ch_depths"))


add(rule(
    "rule_ledger_taken", "Гроссбух на руках",
    [],
    [eff_item("item_ledger"),
     eff_msg("Гроссбух пахнет кислой бумагой. На последней странице рукой Векселя: «поставлено — восемь». Живых — семь."),
     eff_codex("codex_curia")],
    manual=True, chapter="ch_investigation"))

add(rule(
    "rule_blessing", "Благословение труб",
    [],
    [eff_need("need_nerve", 15),
     eff_sanity(10),
     eff_msg("Ржав чертит по лбу знак гайки: «Иди и не дай городу сойти с ума по расписанию».")],
    manual=True, chapter="ch_investigation"))


add(rule(
    "rule_quest_valve_start", "Задача о сухой воде",
    [C.enters_scene("scene_pumphouse")],
    [eff_quest("quest_valve"),
     eff_msg("Насосная гудит вхолостую: заслонка забита, а верхние улицы третий день без воды.")],
    once=True, chapter="ch_investigation"))

add(rule(
    "rule_quest_ledger_start", "Задача о книге",
    [C.flag("ledger_known")],
    [eff_quest("quest_ledger"),
     eff_msg("Имена пропавших сходятся в одном месте — в гроссбухе Векселя. Пора его читать.")],
    once=True, chapter="ch_investigation"))

add(rule(
    "rule_quest_mother_start", "Задача о сердце",
    [C.flag("deep_gate_open")],
    [eff_quest("quest_mother"),
     eff_msg("Под часовней что-то дышит в такт с трубами. Это дело нельзя оставить закрытым в бумаге.")],
    once=True, chapter="ch_finale"))

add(rule(
    "rule_lens_built", "Стекло шёпота собрано",
    [C.item("item_ether_lens")],
    [eff_set_flag("lens_built"),
     eff_advance("quest_lens", "stage_done"),
     eff_need("need_nerve", 4),
     eff_msg("Линза в руке холодная и очень тяжёлая. Сквозь неё металл становится читаемым.")],
    once=True, chapter="ch_investigation"))

add(rule(
    "rule_guard_pass", "Пропуск подписан",
    [C.disp("npc_sera", 25), C.flag("ledger_known")],
    [eff_set_flag("guard_pass"),
     eff_item("item_promissory"),
     eff_banner("Пропуск за Пепельные ворота", preset="записочный", seconds=4),
     eff_msg("Сера подписывает пропуск: «Если ты всё-таки уйдёшь — уходи так, чтобы вернуться было куда».")],
    once=True, chapter="ch_depths"))


def build_rules():
    return RULES
