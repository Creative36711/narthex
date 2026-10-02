"""Правила, квесты, арены, катсцены, встречи, рецепты и кодекс."""
from entities import F, NF, HAS, NOT, setf, msg, add, rem, check, codex, sanity, time, fire
from art import *  # noqa: F401,F403

DEADLINE = 142  # ночь шестого дня (5×24 + 22)


def rule(id_, label, conditions, effects, once=True, manual=False, chapter=None, any_=None):
    r = {"id": id_, "label": label, "once": once, "conditions": conditions, "effects": effects}
    if manual:
        r["manual"] = True
    if any_:
        r["conditions_any"] = any_
    if chapter:
        r["chapter"] = chapter
    return r


def banner(t, s=4):
    return {"type": "banner", "text": t, "seconds": s}


def combat(enemies, arena, intro=None, on_victory=None, no_flee=False, on_defeat=None, on_fled=None):
    e = {"type": "start_combat", "enemies": [{"entity": k, "count": v} for k, v in enemies], "arena": arena}
    if intro:
        e["intro"] = intro
    if on_victory:
        e["on_victory"] = on_victory
    if no_flee:
        e["no_flee"] = True
    if on_defeat:
        e["on_defeat"] = on_defeat
    if on_fled:
        e["on_fled"] = on_fled
    return e


def jr(q, k):
    return {"type": "journal_update", "quest": q, "text_key": k}


def build_rules():
    R = {}

    def put(r):
        assert r["id"] not in R, r["id"]
        R[r["id"]] = r

    # ---------------- старт и хроника
    put(rule("rule_intro", "Пролог: прибытие в Карст-Гальвану", [{"type": "tick_elapsed", "min_tick": 0}],
             [{"type": "play_cutscene", "cutscene": "cutscene_intro"}, {"type": "start_quest", "quest": "quest_main"},
              codex("codex_city"), codex("codex_chamber"), {"type": "set_weather", "weather": "weather_smog"}], chapter="ch_prologue"))
    put(rule("rule_ng_echo", "Хроника: эхо прошлых забегов", [{"type": "meta_counter", "key": "endings_seen", "ge": 1}],
             [setf("ng_echo"), msg("Вам снится зелёный огонёк за решёткой. Он помнит вас. Откуда?")], chapter="ch_prologue"))
    put(rule("rule_ng_veteran", "Хроника: ветеран дела", [{"type": "meta_counter", "key": "endings_seen", "ge": 3}],
             [add("item_stim"), add("item_filter", 2), msg("В кармане плаща — ампула и два фильтра, о которых вы не помните. Почерк на записке — ваш собственный: «Не верь Голосу».")],
             chapter="ch_prologue"))

    # ---------------- сроки
    put(rule("rule_warn_day3", "Срок: осталось четыре дня", [{"type": "tick_elapsed", "min_tick": 56}],
             [banner("До Великого Завода — четыре дня"), {"type": "set_weather", "weather": ""}]))
    put(rule("rule_acid_rain", "Погода: кислотная морось", [{"type": "tick_elapsed", "min_tick": 80}],
             [{"type": "set_weather", "weather": "weather_acid"}, msg("С неба сыплется жёлтая морось. Без плаща в Нижнем городе лучше не показываться.")]))
    put(rule("rule_acid_stop", "Погода: морось кончилась", [{"type": "tick_elapsed", "min_tick": 94}], [{"type": "set_weather", "weather": "weather_smog"}]))
    put(rule("rule_warn_day5", "Срок: завтра ночью", [{"type": "tick_elapsed", "min_tick": 104}],
             [banner("Завтра ночью — Великий Завод")]))
    put(rule("rule_winding_eve", "Срок: канун Завода", [{"type": "tick_elapsed", "min_tick": 128}],
             [{"type": "set_weather", "weather": "weather_ash"}, banner("Сегодня ночью Сердце будут заводить"),
              msg("С утра над городом сыплется пепел. Колокола собора бьют каждые полчаса — отсчёт до Завода.")]))
    put(rule("rule_deadline", "Срок: Великий Завод свершился", [{"type": "tick_elapsed", "min_tick": DEADLINE}, NF("venn_defeated")],
             [setf("deadline_passed"), {"type": "play_cutscene", "cutscene": "cutscene_winding"}, {"type": "fail_quest", "quest": "quest_main"},
              {"type": "game_over_death", "reason": "Великий Завод свершился. Город запел чужим голосом."}], chapter="ch_finale"))

    # ---------------- выживание
    put(rule("rule_starving", "Голод: истощение", [], [{"type": "change_hp", "delta": -1}, msg("Желудок сводит судорогой. Нужно поесть.")], once=False, manual=True))
    put(rule("rule_choking", "Хмарь: удушье", [], [{"type": "change_hp", "delta": -2}, sanity(-1), msg("Хмарь режет лёгкие. Смените фильтр или уходите в чистые кварталы!")], once=False, manual=True))
    put(rule("rule_acid_burn", "Кислотная морось обжигает", [{"type": "weather_is", "weather": "weather_acid"}, NOT(HAS("item_coat"))],
             [{"type": "apply_status", "target": "player", "status": "status_burns"}], once=False,
             any_=[[{"type": "player_enters_location", "location": "loc_lower"}], [{"type": "player_enters_location", "location": "loc_foundry"}]]))
    put(rule("rule_mind_cracked", "Рассудок дал трещину", [{"type": "sanity_le", "threshold": 25}, F("entered_undercity")],
             [setf("mind_cracked"), msg("Тиканье в висках не стихает. Вы понимаете язык труб. Это пугает меньше, чем должно.")]))

    # ---------------- погоня агентов
    put(rule("rule_agents_pursuit", "Агенты Шпиля выходят на след", [], [
        setf("pursued"),
        {"type": "start_pursuit", "label": "Агенты Шпиля", "skill": "stealth", "every_ticks": 3, "fails_to_catch": 1,
         "on_fail": [clear("pursued"), combat([("npc_spire_agent", 2)], "arena_alley", "Серые плащи выходят из тумана. Пистолеты с глушителями уже подняты.",
                                              [msg("Агенты лежат на мостовой. На их перчатках — печать канцелярии."), add("item_cartridge", 3)])]}],
        manual=True))
    put(rule("rule_sanctuary", "Собор — убежище", [{"type": "player_enters_location", "location": "loc_cathedral"}, F("pursued")],
             [{"type": "stop_pursuit"}, clear("pursued"), msg("Под сводами Собора серые плащи отстают. Даже Совет не входит сюда с оружием.")], once=False))

    # ---------------- Марроу
    put(rule("rule_marrow_ambush", "Засада у мастерской Марроу", [], [
        time(3), banner("Ночь в мастерской"),
        combat([("npc_spire_agent", 2)], "arena_alley", "Дверь вылетает с петель. Двое в стеклянных масках: «Доктор, вам пора на покой».",
               [setf("marrow_saved"), add("item_ev_ledger"), {"type": "unlock_recipe", "recipe": "recipe_stim"}, add("item_stim", 2),
                {"type": "change_disposition", "target": "npc_marrow", "delta": 25},
                msg("Марроу, бледная, протягивает журнал заказов: «Берите. Пусть хоть кто-то знает, что я делала и для кого»."),
                {"type": "set_description", "entity": "npc_marrow", "text": "Доктор Илзе Марроу. Обязана вам жизнью и больше не прячет глаза."}],
               no_flee=True)], manual=True, chapter="ch_city"))
    put(rule("rule_marrow_ambush_nl", "Засада у мастерской Марроу (без журнала)", [], [
        time(3), banner("Ночь в мастерской"),
        combat([("npc_spire_agent", 2)], "arena_alley", "Дверь вылетает с петель. Двое в стеклянных масках: «Доктор, где журнал?»",
               [setf("marrow_saved"), {"type": "unlock_recipe", "recipe": "recipe_stim"}, add("item_stim", 2),
                {"type": "change_disposition", "target": "npc_marrow", "delta": 15},
                msg("Марроу долго молчит, потом протягивает вам два стимулятора: «Журнал вы и так забрали. Возьмите хоть это»."),
                {"type": "set_description", "entity": "npc_marrow", "text": "Доктор Илзе Марроу. Обязана вам жизнью, хотя и не простила кражу."}],
               no_flee=True)], manual=True, chapter="ch_city"))
    put(rule("rule_marrow_killed", "Расплата за кражу журнала", [{"type": "player_enters_location", "location": "loc_lower"}, F("marrow_doomed"), NF("marrow_saved")],
             [{"type": "remove_entity", "entity": "npc_marrow"}, setf("marrow_dead"), sanity(-5), {"type": "fail_quest", "quest": "quest_marrow"},
              msg("Дверь мастерской Марроу сорвана с петель. Внутри — разгром и тишина. Пропажу журнала заметили, но спросили не с вас.")], chapter="ch_city"))

    # ---------------- колокольня
    put(rule("rule_bell_fight", "Часовщик-звонарь", [{"type": "player_enters_scene", "scene": "scene_belltower"}, HAS("item_bell_key"), NF("belltower_cleared")], [
        combat([("npc_ansel", 1)], "arena_bell", "Из-за колокола выходит фигура в истлевшей рясе. В груди у неё тикает.",
               [setf("belltower_cleared"), codex("codex_clockman"), sanity(-3), msg("Ансель оседает у колокола. Тиканье в груди замирает последним.")])],
        chapter="ch_city"))

    # ---------------- Шпиль
    put(rule("rule_expose_venn", "Разоблачение Венн", [NF("venn_exposed")], [
        setf("venn_exposed"), {"type": "play_cutscene", "cutscene": "cutscene_exposure"},
        {"type": "remove_entity", "entity": "npc_venn"}, {"type": "change_reputation", "delta": 10},
        combat([("npc_spire_agent", 2)], "arena_spire", "Венн исчезает в лифтовой клети. Двое агентов заступают вам дорогу.",
               [setf("heart_revealed"), {"type": "reveal_location", "location": "loc_heart"}, codex("codex_venn"),
                banner("Венн бежала к Сердцу-Двигателю"), msg("Лифт Совета идёт вниз, к самому Сердцу. Теперь путь открыт и вам.")],
               no_flee=True)], manual=True, chapter="ch_city"))
    put(rule("rule_accusation_failed", "Обвинение отвергнуто", [], [
        setf("accusation_failed"), sanity(-5), banner("Обвинение отвергнуто"),
        msg("Совет смеётся. Венн качает головой: «Бедный переутомлённый дознаватель». Гвардейцы вышвыривают вас из Шпиля. Путь туда закрыт."),
        {"type": "block_path", "from": "loc_station", "to": "loc_spire"}, {"type": "block_path", "from": "loc_cathedral", "to": "loc_spire"},
        {"type": "teleport_player", "location": "loc_lower", "scene": "scene_lower_street"}, time(4)], manual=True, chapter="ch_city"))

    # ---------------- глубины
    put(rule("rule_enter_undercity", "Первый спуск в отстойники", [{"type": "player_enters_location", "location": "loc_undercity"}],
             [setf("entered_undercity"), sanity(-4), codex("codex_undercity"),
              msg("Лестница уходит в темноту. Внизу пахнет медью и гнилью. Где-то за стеной тикает — сотни механизмов вразнобой.")], chapter="ch_depths"))
    put(rule("rule_jens_fight", "Йенс-Часовщик нападает", [NF("jens_found")], [
        combat([("npc_jens", 1)], "arena_tunnel", "Из воды поднимается Йенс. Латунное сердце тикает в распоротой груди.",
               [setf("jens_found"), add("item_locket"), sanity(-6),
                msg("Йенс падает в воду. В его кулаке — жестяной медальон. Он держал его до конца.")])], manual=True, chapter="ch_depths"))
    put(rule("rule_jens_peace", "Йенс узнаёт своё имя", [NF("jens_found")], [
        setf("jens_found"), setf("jens_peace"), add("item_locket"), sanity(-2),
        msg("Вы напеваете колыбельную, о которой говорила Марта. Йенс замирает. Механизм в груди сбивается, замедляется… Он протягивает вам медальон и закрывает глаза.")],
        manual=True, chapter="ch_depths"))
    put(rule("rule_open_deep_lock", "Глубокий шлюз открыт", [NF("deep_lock_open")], [
        setf("deep_lock_open"), setf("heart_revealed"), {"type": "reveal_location", "location": "loc_heart"}, codex("codex_heart"),
        banner("Путь к Сердцу открыт"), msg("Вода уходит в открывшийся колодец. Внизу, в зелёном свете, ворочается Сердце-Двигатель.")], manual=True, chapter="ch_depths"))

    # ---------------- финал
    put(rule("rule_heart_enter", "Битва у Сердца", [{"type": "player_enters_scene", "scene": "scene_engine_hall"}, NF("venn_defeated")], [
        setf("at_heart"), sanity(-5), {"type": "play_cutscene", "cutscene": "cutscene_heart"},
        {"type": "remove_entity", "entity": "npc_venn"},
        combat([("npc_venn_boss", 1), ("npc_clockman", 2)], "arena_heart", "«Ты опоздал, дознаватель. Сердце уже слышит меня».",
               [setf("venn_defeated"), codex("codex_litany"), banner("Голос Венн умолк"),
                msg("Кабели отпускают тело советницы. В наступившей тишине Сердце бьётся громче — и зовёт вас к ядру.")],
               no_flee=True)], chapter="ch_finale"))
    put(rule("rule_seal_blessed", "Печать с благословением Галлиана", [], [check("occult", 30,
        [setf("ending_sealed"), {"type": "game_over_victory"}],
        [sanity(-6), msg("Слова рассыпаются, ядро ревёт. Соберитесь и попробуйте снова.")])], once=False, manual=True, chapter="ch_finale"))
    put(rule("rule_seal_alone", "Печать без благословения", [], [check("occult", 55,
        [setf("ending_sealed"), {"type": "game_over_victory"}],
        [sanity(-8), msg("Строки литании жгут язык. Ядро отталкивает вас. Ещё попытка — или другой путь.")])], once=False, manual=True, chapter="ch_finale"))
    put(rule("rule_end_destroyed", "Финал: Сердце остановлено", [], [setf("ending_destroyed"), {"type": "game_over_victory"}], manual=True, chapter="ch_finale"))
    put(rule("rule_end_voice", "Финал: новый Голос", [], [setf("ending_voice"), {"type": "game_over_victory"}], manual=True, chapter="ch_finale"))

    # ---------------- служебные для диалогов (то, чего нет среди эффектов реплик)
    put(rule("rule_venn_insight", "Чутьё: Венн лжёт", [], [check("insight", 55,
        [setf("venn_suspected"), msg("Улыбка не доходит до глаз. Она слишком хорошо знает, куда вам не надо смотреть.")],
        [msg("Безупречная любезность. Ни одной трещины.")])], manual=True))
    put(rule("rule_drew_intimidate", "Давление на секретаря", [], [check("intimidate", 50,
        [add("item_ev_seal"), setf("seal_taken"), msg("Дрю трясущимися руками протягивает копию ордера: «Я вас не видел. Вы меня — тоже»."),
         {"type": "change_disposition", "target": "npc_drew", "delta": -20}],
        [setf("drew_alarmed"), {"type": "change_disposition", "target": "npc_drew", "delta": -15},
         msg("Дрю бледнеет — и хватается за шнур звонка. «Ещё слово, и здесь будет стража»."), fire("rule_agents_pursuit")])], manual=True))
    put(rule("rule_bruno_intimidate", "Давление на Бруно", [], [check("intimidate", 65,
        [setf("bruno_cowed"), msg("Бруно сжимает кулаки — и медленно разжимает. «Ладно, ищейка. Спрашивай»."),
         {"type": "change_disposition", "target": "npc_bruno", "delta": -5}],
        [{"type": "change_hp", "delta": -2}, {"type": "change_disposition", "target": "npc_bruno", "delta": -10},
         msg("Кулак Бруно встречается с вашей скулой. «Пошёл вон из моего цеха»."),])], manual=True))
    put(rule("rule_tobias_reads", "Тобиас читает литанию", [], [sanity(-2), codex("codex_litany"), setf("tobias_told")], manual=True))
    put(rule("rule_grille_whisper", "Шёпот из решётки", [], [sanity(-3), setf("litany_met"), codex("codex_engine")], manual=True))
    put(rule("rule_hesk_story", "Рассказ Хеска", [], [setf("hesk_told"), sanity(-1)], manual=True))
    put(rule("rule_venn_confront", "Венн угрожает", [], [setf("venn_warned"), sanity(-2), fire("rule_agents_pursuit")], manual=True))
    put(rule("rule_vale_report", "Доклад сестре Вейл", [], [setf("vale_reported"), add("item_antidote", 2), {"type": "unlock_recipe", "recipe": "recipe_antidote"}], manual=True))
    put(rule("rule_osric_pay", "Аванс от Озрика", [], [add("item_token", 15), add("item_ration", 2), setf("osric_paid")], manual=True))
    put(rule("rule_martha_reward", "Благодарность Марты", [], [setf("martha_mourned"), add("item_filter", 3), {"type": "change_disposition", "target": "faction_union", "delta": 15},
                                                               {"type": "grant_xp", "points": 20}], manual=True))
    put(rule("rule_bruno_key", "Бруно отдаёт ключ", [], [add("item_valve_key"), setf("bruno_trust"), {"type": "unlock_recipe", "recipe": "recipe_cartridges"},
                                                         add("item_powder", 2)], manual=True))
    put(rule("rule_martha_key", "Марта отдаёт ключ брата", [], [add("item_valve_key"), setf("martha_gave_key")], manual=True))
    put(rule("rule_gallian_bless", "Благословение Галлиана", [], [setf("gallian_blessing"), add("item_incense", 2), {"type": "apply_status", "target": "player", "status": "status_clarity"}], manual=True))
    put(rule("rule_pik_join", "Пик присоединяется", [], [setf("pik_joined"), {"type": "join_party", "entity": "npc_pik"}], manual=True))
    return R


def clear(f):
    return {"type": "clear_flag", "flag": f}


def build_quests():
    Q = {}

    def stage(id_, label, journal=None, q=None, to=None, final=False, outcome=None, extra=None):
        s = {"id": id_, "label": label}
        eff = []
        if journal:
            eff.append(jr(q, journal))
        if extra:
            eff += extra
        if eff:
            s["on_enter_effects"] = eff
        if to:
            s["transitions"] = [{"to": t, "conditions": c} for t, c in to]
        if final:
            s["final"] = True
            s["outcome"] = outcome or "success"
        return s

    q = "quest_main"
    Q[q] = {"id": q, "label": "Часовые сердца", "chapter": "ch_prologue",
            "description": "Шесть кочегаров найдены с латунными механизмами вместо сердец. До Великого Завода — шесть дней.",
            "journal_entries": {
                "j_evidence": "Озрик поручил дело о «часовых сердцах». Начать с мертвецкой под конторой: тело Томаса Сола ещё на столе. Улики сводить на доске в конторе.",
                "j_threads": "Сердца делала доктор Марроу — по заказу сверху. Нужно понять, зачем нужны семь сердец, кто платит и куда пропадают люди с ночной смены клапана №7.",
                "j_accuse": "Заказчик и смысл обряда известны. Обвинить Венн можно с кафедры в Зале Совета — днём, пока идёт заседание. Валик с её голосом сделает обвинение неопровержимым.",
                "j_depths": "Путь к Сердцу-Двигателю открыт. Венн там — или скоро будет. Запастись фильтрами, бинтами и патронами: назад дороги может не быть.",
                "j_core": "Венн повержена. Сердце-Двигатель ждёт у ядра. Решить, что будет с городом: запечатать Литанию, остановить машину — или…",
            },
            "stages": [
                stage("stage_evidence", "Первые улики", "j_evidence", q, [("stage_threads", [F("ded_maker")])]),
                stage("stage_threads", "Нити заговора", "j_threads", q, [("stage_depths", [F("heart_revealed")]), ("stage_accuse", [F("ded_payer"), F("ded_ritual")])]),
                stage("stage_accuse", "Обвинение", "j_accuse", q, [("stage_depths", [F("heart_revealed")])]),
                stage("stage_depths", "Спуск к Сердцу", "j_depths", q, [("stage_core", [F("venn_defeated")])]),
                stage("stage_core", "У ядра", "j_core", q, [("stage_resolved", [{"type": "or", "conditions": [F("ending_sealed"), F("ending_destroyed"), F("ending_voice")]}])]),
                stage("stage_resolved", "Дело закрыто", final=True, outcome="success"),
            ]}

    q = "quest_morgue"
    Q[q] = {"id": q, "label": "Тело на столе", "chapter": "ch_prologue",
            "description": "Сестра Вейл просит осмотреть тело Томаса Сола вместе с ней.",
            "journal_entries": {
                "j_m_start": "Осмотреть тело Томаса Сола в мертвецкой: извлечь механизм, осмотреть руки и одежду, прочесть гравировку на латуни.",
                "j_m_report": "Тело осмотрено. Вернуться к сестре Вейл и рассказать, что удалось найти.",
                "j_m_done": "Вейл выслушала доклад и поделилась рецептом тлен-отвара. «Дышите реже там, куда идёте», — сказала она.",
            },
            "stages": [
                stage("stage_m_examine", "Осмотр", "j_m_start", q, [("stage_m_report", [F("body_heart_taken"), F("body_soot_found"), F("body_engraving_read")])]),
                stage("stage_m_report", "Доклад", "j_m_report", q, [("stage_m_done", [F("vale_reported")])]),
                stage("stage_m_done", "Отчёт принят", "j_m_done", q, final=True),
            ]}

    q = "quest_marrow"
    Q[q] = {"id": q, "label": "Долг хирурга", "chapter": "ch_city",
            "description": "Илзе Марроу делала сердца по заказу Совета. Теперь за ней придут.",
            "journal_entries": {
                "j_mar_start": "Марроу призналась: семь сердец заказала канцелярия Совета. Она отдаст журнал заказов, если её защитить — люди Шпиля придут этой ночью.",
                "j_mar_saved": "Агенты Шпиля мертвы, Марроу жива. Журнал заказов у меня, а доктор научила готовить свой стимулятор.",
                "j_mar_dead": "Марроу убили. Тот, кто взял журнал, привёл к ней смерть. Это был я.",
            },
            "stages": [
                stage("stage_mar_protect", "Защитить Марроу", "j_mar_start", q, [("stage_mar_saved", [F("marrow_saved")]), ("stage_mar_dead", [F("marrow_dead")])]),
                stage("stage_mar_saved", "Марроу спасена", "j_mar_saved", q, final=True),
                stage("stage_mar_dead", "Марроу мертва", "j_mar_dead", q, final=True, outcome="failure"),
            ]}

    q = "quest_widow"
    Q[q] = {"id": q, "label": "Вдова кочегара", "chapter": "ch_city",
            "description": "Марта Сол потеряла мужа и ждёт вестей о брате.",
            "journal_entries": {
                "j_w_start": "Йенс, брат Марты, пропал неделю назад после ночной смены у клапана №7. Найти его — живым или нет.",
                "j_w_return": "У меня медальон Йенса. Марта должна узнать правду.",
                "j_w_done": "Марта похоронит пустой гроб с медальоном внутри. Союз кочегаров запомнит, кто принёс весть.",
            },
            "stages": [
                stage("stage_w_search", "Поиски Йенса", "j_w_start", q, [("stage_w_return", [HAS("item_locket")])]),
                stage("stage_w_return", "Весть для Марты", "j_w_return", q, [("stage_w_done", [F("martha_mourned")])]),
                stage("stage_w_done", "Весть принесена", "j_w_done", q, final=True),
            ]}

    q = "quest_archive"
    Q[q] = {"id": q, "label": "Запретная литания", "chapter": "ch_city",
            "description": "Из скриптория пропала страница запретного свода. Брат Тобиас знает, где её искать.",
            "journal_entries": {
                "j_a_start": "Тобиас уверен: брат Ансель, звонарь, спрятал украденную страницу в своём сундуке на колокольне. Ансель пропал первым. Ключ от сундука — у меня.",
                "j_a_return": "Страница «Литании Пробуждения» у меня. Тобиас сможет прочесть её.",
                "j_a_done": "Тобиас прочёл литанию: обряд Пробуждения и слова, которыми Орден когда-то запечатал Сердце.",
            },
            "stages": [
                stage("stage_a_tower", "Колокольня", "j_a_start", q, [("stage_a_return", [HAS("item_ev_litany")])]),
                stage("stage_a_return", "Вернуться к Тобиасу", "j_a_return", q, [("stage_a_done", [F("tobias_told")])]),
                stage("stage_a_done", "Литания прочитана", "j_a_done", q, final=True),
            ]}

    q = "quest_union"
    Q[q] = {"id": q, "label": "Глухой клапан", "chapter": "ch_city",
            "description": "Бруно Кальд не станет говорить с Палатой просто так.",
            "journal_entries": {
                "j_u_start": "Бруно готов говорить, если я стравлю давление на клапане №7, пока он не рванул. Посмотрим, умеет ли ищейка держать маховик.",
                "j_u_proof": "Клапан держит. Бруно хочет доказательство, что я ищу убийц, а не повод разогнать Союз: найти общую нить жертв.",
                "j_u_done": "Бруно отдал ключ-шестерню от Глубокого шлюза. Кочегары больше не стоят у меня на пути.",
                "j_u_broken": "Бруно арестован по моему обвинению. Союз кочегаров для меня закрыт.",
            },
            "stages": [
                stage("stage_u_valve", "Клапан №7", "j_u_start", q, [("stage_u_broken", [F("bruno_arrested")]), ("stage_u_proof", [F("valve_fixed")])]),
                stage("stage_u_proof", "Доказательство", "j_u_proof", q, [("stage_u_broken", [F("bruno_arrested")]), ("stage_u_done", [F("bruno_trust")])]),
                stage("stage_u_done", "Ключ получен", "j_u_done", q, final=True),
                stage("stage_u_broken", "Союз потерян", "j_u_broken", q, final=True, outcome="failure"),
            ]}

    q = "quest_pik"
    Q[q] = {"id": q, "label": "Глаза улиц", "chapter": "ch_city",
            "description": "Пик знает Нижний Ряд лучше любой карты. Но бесплатно глаза улиц не смотрят.",
            "journal_entries": {
                "j_p_start": "Пик хочет горячего — похлёбку из угря — и угольный фильтр. Тогда расскажет, что видела ночью у клапана.",
                "j_p_trust": "Пик рассказала о серых плащах у клапана №7. Она пойдёт со мной, когда я пойму, кто стоит за сердцами.",
                "j_p_done": "Пик идёт со мной. Глаза улиц открыты.",
            },
            "stages": [
                stage("stage_p_feed", "Накормить Пик", "j_p_start", q, [("stage_p_trust", [F("pik_fed")])]),
                stage("stage_p_trust", "Доверие", "j_p_trust", q, [("stage_p_done", [F("pik_joined")])]),
                stage("stage_p_done", "Вместе", "j_p_done", q, final=True),
            ]}
    return Q


def build_arenas():
    def arena(id_, label, cols, rows, blocked, difficult, music=None, cover=None):
        a = {"id": id_, "label": label, "image": "",
             "hex_grid": {"cols": cols, "rows": rows, "hex_size": 40, "offset": "odd-r", "blocked_hexes": blocked, "difficult_terrain": difficult},
             "spawn_zones": {"player": {"hexes": [[0, r] for r in range(1, rows - 1)] + [[1, r] for r in range(2, rows - 2)]},
                             "enemy": {"hexes": [[cols - 1, r] for r in range(1, rows - 1)] + [[cols - 2, r] for r in range(2, rows - 2)]}}}
        if cover:
            a["hex_grid"]["cover_hexes"] = cover
        if music:
            a["music"] = music
        return a
    return {
        "arena_alley": arena("arena_alley", "Проулок Нижнего Ряда", 12, 8, [[5, 0], [5, 1], [6, 6], [6, 7]], [[3, 4], [4, 4], [8, 3]], cover=[[4, 2], [7, 5]]),
        "arena_tunnel": arena("arena_tunnel", "Затопленный тоннель", 12, 7, [[4, 0], [7, 6], [8, 6]], [[3, 3], [4, 3], [5, 3], [6, 3], [7, 3]]),
        "arena_bell": arena("arena_bell", "Колокольня", 10, 7, [[5, 3]], [[2, 1], [7, 5]]),
        "arena_spire": arena("arena_spire", "Зал Совета", 12, 8, [[6, 3], [6, 4]], [], cover=[[3, 2], [3, 5], [8, 2], [8, 5]]),
        "arena_heart": arena("arena_heart", "Машинный зал Сердца", 13, 9, [[6, 0], [6, 8], [4, 4], [8, 4]], [[5, 2], [7, 6], [6, 4]], music="music_boss"),
    }


def build_encounters():
    return {
        "enc_lower": {"id": "enc_lower", "rolls": 1, "entries": [
            {"weight": 7, "type": "nothing"},
            {"weight": 2, "type": "combat", "enemies": [{"entity": "npc_scavenger", "count_min": 1, "count_max": 2}], "arena": "arena_alley",
             "intro": "Из подворотни выходят фигуры с обрезками труб."},
            {"weight": 1, "type": "skill_check", "skill": "spot", "difficulty": 50, "message": "В давке у паровой конки кто-то трётся о ваш карман.",
             "success_effects": [msg("Вы перехватываете тонкое запястье. Воришка вырывается и исчезает в хмари.")],
             "fail_effects": [rem("item_token", 3), msg("Кошель стал легче на три жетона.")]},
            {"weight": 1, "type": "event", "message": "У стены — брошенный ящик патрульных.", "effects": [add("item_filter"), msg("В ящике нашёлся почти целый фильтр.")]},
        ]},
        "enc_undercity": {"id": "enc_undercity", "rolls": 1, "entries": [
            {"weight": 4, "type": "nothing"},
            {"weight": 2, "type": "combat", "enemies": [{"entity": "npc_hound", "count_min": 1, "count_max": 2}], "arena": "arena_tunnel",
             "intro": "Хриплое дыхание в темноте. Тлен-гончие вышли на запах."},
            {"weight": 1, "type": "combat", "enemies": [{"entity": "npc_scavenger", "count_min": 2, "count_max": 2}], "arena": "arena_tunnel"},
            {"weight": 1, "type": "event", "message": "Из трубы доносится тиканье — сотни механизмов вразнобой.", "effects": [sanity(-3)]},
        ]},
    }


def build_recipes():
    return {
        "recipe_filter": {"id": "recipe_filter", "label": "Угольный фильтр", "description": "Кассета из ветоши и угля. Держит хуже заводской, но держит.",
                          "inputs": [{"item": "item_rag", "quantity": 1}, {"item": "item_charcoal", "quantity": 2}], "time_ticks": 1,
                          "output": {"item": "item_filter", "quantity": 1}, "message": "Самодельный фильтр щёлкает в респираторе."},
        "recipe_bandage": {"id": "recipe_bandage", "label": "Бинт с карболкой", "description": "Ветошь, вываренная в ерше.",
                           "inputs": [{"item": "item_rag", "quantity": 2}, {"item": "item_gin", "quantity": 1}], "skill": {"id": "medicine", "difficulty": 25},
                           "time_ticks": 1, "output": {"item": "item_bandage", "quantity": 2}},
        "recipe_cartridges": {"id": "recipe_cartridges", "label": "Патроны кочегаров", "description": "Гильзы из латунного лома, порох Гримма и терпение.", "known": False,
                              "inputs": [{"item": "item_brass_scrap", "quantity": 2}, {"item": "item_powder", "quantity": 1}],
                              "skill": {"id": "mechanics", "difficulty": 35}, "time_ticks": 1, "output": {"item": "item_cartridge", "quantity": 5},
                              "message": "Пять кривоватых, но рабочих патронов."},
        "recipe_antidote": {"id": "recipe_antidote", "label": "Тлен-отвар", "description": "Рецепт сестры Вейл: мох, вываренный в ерше.", "known": False,
                            "inputs": [{"item": "item_tlen_moss", "quantity": 1}, {"item": "item_gin", "quantity": 1}],
                            "skill": {"id": "medicine", "difficulty": 30}, "time_ticks": 1, "output": {"item": "item_antidote", "quantity": 1}},
        "recipe_stim": {"id": "recipe_stim", "label": "Стимулятор Марроу", "description": "Двойная вытяжка тлен-мха в латунной ампуле.", "known": False,
                        "inputs": [{"item": "item_tlen_moss", "quantity": 2}, {"item": "item_gin", "quantity": 1}, {"item": "item_brass_scrap", "quantity": 1}],
                        "skill": {"id": "medicine", "difficulty": 45}, "time_ticks": 2, "output": {"item": "item_stim", "quantity": 1}},
    }


def build_codex():
    C = {}

    def c(id_, label, cat, txt, creature=None):
        e = {"id": id_, "label": label, "category": cat, "text": txt}
        if creature:
            e["creature_entity"] = creature
        C[id_] = e

    c("codex_city", "Карст-Гальвана", "places",
      "Город в расщелине каньона, выстроенный ярусами вокруг Сердца-Двигателя. Наверху — чистый воздух Шпиля и Собора, внизу — хмарь, литейные и Нижний Ряд. Четыреста лет машина греет город и гонит пар по трубам. Раз в десять лет её заводят заново — это и есть Великий Завод.")
    c("codex_chamber", "Палата Тишины", "chronicles",
      "Ведомство дознавателей. Расследует то, о чём город предпочёл бы молчать: убийства в трубах, ересь в механизмах, исчезновения в хмари. Дознаватель вправе входить в любой квартал — и не вправе рассчитывать, что выйдет.")
    c("codex_smog", "Хмарь", "places",
      "Ядовитый туман нижних ярусов: пар Сердца, угольная копоть и что-то ещё, от чего ржавеют лёгкие. В Нижнем Ряду, литейных и отстойниках без фильтра долго не продержаться. В Шпиле, Соборе и на вокзале воздух чист.")
    c("codex_order", "Орден Святой Шестерни", "chronicles",
      "Монахи-механики, хранители Сердца-Двигателя. Их молитвы — это инструкции, их литургия — уставы обслуживания. Четыреста лет назад Орден запечатал в машине нечто живое и с тех пор запрещает говорить об этом вслух.")
    c("codex_clock_heart", "Часовое сердце", "case",
      "Латунный кардиомеханизм тонкой работы. Вживлённый вместо сердца, он держит тело живым — и послушным. Клеймо «И.М.». По ободу — строка литургического шрифта.")
    c("codex_clockman", "Часовщики", "creatures",
      "Люди с латунным сердцем. Механизм заставляет тело двигаться в такт Сердцу-Двигателю, стирая память и волю. Они сильны, не чувствуют боли и замирают, лишь когда механизм останавливается.", "npc_clockman")
    c("codex_hound", "Тлен-гончие", "creatures",
      "Бродячие псы отстойников, вросшие в обломки дыхательных аппаратов. Их укус заносит тлен в лёгкие. Тлен-отвар помогает.", "npc_hound")
    c("codex_winding", "Великий Завод", "case",
      "Раз в десять лет Орден и Совет заводят Сердце-Двигатель: звонят семь колоколов, и машина набирает ход на следующие годы. «Литания Пробуждения» превращает Завод в обряд: семь живых сердец вместо колоколов — и тот, кто встанет у ядра, получит Голос машины.")
    c("codex_litany", "Литания", "creatures",
      "Дух, скованный в Сердце-Двигателе. Орден называет его «Литанией» — по молитве, которой его связали. Он греет город, потому что не может иначе, и шепчет в трубах, потому что больше ничего не может.", "npc_litany")
    c("codex_engine", "Сердце-Двигатель", "places",
      "Исполинская машина в основании каньона. Её тепло гонит пар по всем трубам города. Внутри — живое ядро. Если оно остановится, Карст-Гальвана замёрзнет за одну зиму.")
    c("codex_venn", "Лиара Венн", "case",
      "Голос Совета Шпиля. Заказала семь часовых сердец через канцелярию, похищала кочегаров ночной смены через Глубокий шлюз и готовила обряд, чтобы стать новым Голосом машины — и городом.")
    c("codex_case_maker", "Дело: мастер сердец", "case",
      "Сердца собирала доктор Илзе Марроу в своей мастерской в Нижнем Ряду. Заказ пришёл через канцелярию Совета — «особая серия» из семи штук. Отказаться ей не позволили.")
    c("codex_case_victims", "Дело: общая нить", "case",
      "Все жертвы — кочегары ночной смены у клапана №7. Под клапаном — Глубокий шлюз в отстойники. Даты спусков совпадают с датами пропаж.")
    c("codex_case_payer", "Дело: заказчик", "case",
      "Номер ордера в журнале Марроу совпадает с ордером канцелярии, на котором стоит личная печать Голоса Совета.")
    c("codex_undercity", "Отстойники", "places",
      "Сточные галереи под литейными. Сюда стекает конденсат Сердца, здесь растёт тлен-мох и бродят тлен-гончие. Где-то в глубине — Глубокий шлюз к самому Сердцу.")
    c("codex_heart", "Глубокий шлюз", "places",
      "Гермодверь кочегаров, через которую когда-то обслуживали нижние контуры Сердца. Ключ-шестерня хранится у бригадира ночной смены.")
    return C


# ============================================================ КАТСЦЕНЫ

def _slide(art, txt, tr="fade", dur=None):
    s = {"art": art, "text": txt, "transition": tr}
    if dur:
        s["duration"] = dur
    return s


def build_cutscenes():
    from scenes import art_platform, art_morgue, art_council, art_engine_hall, art_core
    canyon = doc("#06080a", sky("#0a0e14", "#3a3a30", 720) + skyline(470, "#101214", 5) + chimneys([180, 380, 860, 1080], 470)
                 + fog(380, 300, "#7a8a6a", 0.35) + gear(640, 600, 120, "#3a2a1a", 18, "Сердце в глубине", opacity=0.6)
                 + ell(640, 600, 260, 120, "#7ad0b0", "зелёное зарево", opacity=0.12) + vignette(0.6))
    hearts = doc("#080404", rect(0, 0, 1280, 720, grad("#1a0a08", "#040202"), "тьма")
                 + [lay for i in range(6) for lay in ell(240 + i * 160, 360, 50, 60, "#7a3a2a", "латунное сердце", stroke="#c9a24a", sw=4)]
                 + ell(640, 360, 600, 200, "#c9a24a", "отблеск", opacity=0.05) + vignette(0.7))
    bells = doc("#06060a", sky("#0a0a14", "#2a2030", 720) + [lay for i in range(7) for lay in
                poly([150 + i * 160, 420, 250 + i * 160, 420, 235 + i * 160, 300, 165 + i * 160, 300], grad("#a07a3a", "#4a2a10"), "колокол")]
                + fog(420, 300, "#5a4a5a", 0.3) + vignette(0.6))
    return {
        "cutscene_intro": {"id": "cutscene_intro", "label": "Пролог: шестое сердце", "music": "music_menu", "chapter": "ch_prologue", "slides": [
            _slide(canyon, "Карст-Гальвана. Город в расщелине, который четыреста лет греет одна машина — Сердце-Двигатель.", "panzoom", 7),
            _slide(hearts, "За месяц в трубах нашли шестерых кочегаров. Вместо сердец у них тикали латунные механизмы.", "fade", 7),
            _slide(art_morgue(), "Шестое тело ещё лежит в мертвецкой Палаты Тишины. Механизм в его груди всё ещё идёт.", "fade", 6),
            _slide(bells, "Через шесть дней — Великий Завод: семь колоколов, и машина набирает ход на следующие десять лет.", "fade", 7),
            _slide(art_platform(True), "Вы — дознаватель Палаты. У вас есть жетон, револьвер и шесть дней.", "slide", 6),
        ]},
        "cutscene_exposure": {"id": "cutscene_exposure", "label": "Разоблачение", "music": "music_spire", "chapter": "ch_city", "slides": [
            _slide(art_council(False), "Вы выкладываете на кафедру ордер, журнал Марроу и страницу литании. Зал замолкает.", "fade", 6),
            _slide(art_council(False), "Венн не оправдывается. Она улыбается: «Вы опоздали. Сердце уже знает мой голос».", "cut", 6),
            _slide(art_council(True), "Лифтовая клеть уносит её вниз. Двери зала захлопываются, и из-за колонн выходят серые плащи.", "fade", 5),
        ]},
        "cutscene_heart": {"id": "cutscene_heart", "label": "Сердце-Двигатель", "music": "music_heart", "chapter": "ch_finale", "slides": [
            _slide(art_engine_hall(), "Машинный зал размером с собор. Поршни ходят медленно, как дыхание спящего зверя.", "panzoom", 6),
            _slide(art_core(False), "В зелёном свете ядра — Венн. Кабели машины вросли в её руки, как корни.", "fade", 6),
            _slide(art_core(False), "«Седьмое сердце — твоё, дознаватель. Подойди ближе»", "cut", 4),
        ]},
        "cutscene_winding": {"id": "cutscene_winding", "label": "Великий Завод", "music": "music_boss", "chapter": "ch_finale", "slides": [
            _slide(bells, "Полночь. Семь колоколов бьют в последний раз — и замолкают.", "fade", 5),
            _slide(art_core(False), "Сердце-Двигатель запускается заново. Его новый ритм совпадает с дыханием Лиары Венн.", "fade", 6),
            _slide(canyon, "Утром весь город говорит одним голосом. Вашим — тоже.", "fade", 6),
        ]},
    }
