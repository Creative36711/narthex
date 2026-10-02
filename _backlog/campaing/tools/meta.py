"""campaign.json: метаданные, реестры, создание персонажа, звук и музыка."""
import os

CAMPAIGN_ID = "9002b55f-286c-4380-bf9f-0a42ef284a61"

SKILLS = [("spot", "Внимательность"), ("insight", "Чутьё"), ("persuade", "Убеждение"), ("intimidate", "Запугивание"),
          ("mechanics", "Механика"), ("occult", "Литургика"), ("medicine", "Медицина"), ("stealth", "Скрытность"),
          ("lockpick", "Взлом"), ("firearms", "Стрельба"), ("melee", "Ближний бой"), ("dodge", "Уклонение"), ("bite", "Укус")]

SMOG = ["loc_lower", "loc_foundry", "loc_undercity", "loc_heart"]
CLEAN = ["loc_station", "loc_cathedral", "loc_spire"]

FLAG_LABELS = {
    "body_heart_taken": "Сердце извлечено из тела Томаса", "body_soot_found": "Найдена сажа клапана на теле",
    "body_engraving_read": "Прочитана гравировка на сердце", "vale_reported": "Доклад сестре Вейл сделан",
    "osric_paid": "Озрик выдал аванс", "briefed": "Получено задание Озрика",
    "ded_maker": "Вывод: мастер сердец", "ded_victims": "Вывод: общая нить жертв", "ded_ritual": "Вывод: смысл обряда",
    "ded_payer": "Вывод: заказчик", "ded_motive": "Вывод: голос в трубах",
    "marrow_admitted": "Марроу призналась", "marrow_saved": "Марроу спасена", "marrow_doomed": "Журнал украден — Марроу в опасности",
    "marrow_dead": "Марроу убита", "ledger_stolen": "Журнал заказов взят без спроса",
    "valve_tags_taken": "Бирки клапана сняты", "valve_fixed": "Давление клапана стравлено",
    "martha_permission": "Марта разрешила открыть шкафчик", "lockers_opened": "Шкафчик Томаса открыт", "lockers_forced": "Шкафчик взломан",
    "jens_song": "Марта рассказала колыбельную Йенса", "jens_found": "Йенс найден", "jens_peace": "Йенс ушёл с миром",
    "martha_mourned": "Марта узнала правду", "martha_gave_key": "Марта отдала ключ брата",
    "bruno_cowed": "Бруно запуган", "bruno_trust": "Бруно доверяет", "bruno_arrested": "Бруно арестован",
    "bruno_talked": "Бруно рассказал о клапане",
    "gallian_arrested": "Галлиан арестован", "gallian_blessing": "Благословение Галлиана", "gallian_engraving": "Галлиан видел гравировку",
    "tobias_quest": "Тобиас дал ключ звонаря", "tobias_told": "Тобиас прочёл литанию", "belltower_cleared": "Колокольня очищена",
    "litany_page_found": "Страница литании найдена",
    "venn_suspected": "Венн под подозрением", "venn_warned": "Венн пригрозила", "venn_bribed": "Взята подачка Венн",
    "venn_exposed": "Венн разоблачена", "accusation_failed": "Обвинение отвергнуто", "wrong_accused": "Обвинён невиновный",
    "drew_alarmed": "Дрю поднял тревогу", "seal_taken": "Ордер с печатью добыт", "drew_bribed": "Дрю подкуплен",
    "pursued": "За героем погоня", "pik_fed": "Пик накормлена", "pik_joined": "Пик в отряде",
    "hesk_told": "Хеск рассказал о шлюзе", "hesk_gin": "Хеск получил ёрш",
    "entered_undercity": "Был в отстойниках", "litany_met": "Говорил с Литанией", "heard_recording": "Прослушан валик",
    "deep_lock_open": "Глубокий шлюз открыт", "heart_revealed": "Путь к Сердцу открыт",
    "at_heart": "Герой у Сердца", "venn_defeated": "Венн повержена", "mind_cracked": "Рассудок дал трещину",
    "ending_sealed": "Финал: Литания запечатана", "ending_destroyed": "Финал: Сердце остановлено", "ending_voice": "Финал: новый Голос",
    "deadline_passed": "Великий Завод свершился", "ng_echo": "Эхо прошлых забегов",
    "grimm_rumors": "Гримм рассказал слухи", "pik_quest": "Пик попросила еды", "vale_quest": "Вейл поручила осмотр",
    "widow_quest": "Марта просит найти Йенса", "union_quest": "Бруно поставил условие", "bruno_spared_order": "Бруно остыл к Ордену",
    "bruno_threatened": "Бруно пытались запугать", "venn_studied": "Венн изучена взглядом", "litany_promise": "Литания просила свободы",
}


def zz(*a):
    v = list(a) + [0] * (20 - len(a))
    return {"zzfx": v[:20]}


def music(id_, label, mood, tempo, key, scale, layers, prog, seed, vol=0.7):
    return {"id": id_, "label": label, "loop": True, "volume": vol,
            "src": {"mood": mood, "tempo": tempo, "key": key, "scale": scale, "layers": layers, "progression": prog, "seed": seed}}


def char_creation():
    cc = {
        "total_points": 50, "stat_limits": {"min": 3, "max": 18},
        "skill_points": 150, "skill_cap": 75, "skill_floor": 10,
        "mandatory_skills": ["spot", "dodge"], "forbidden_skills": ["bite"],
        "choose_name": True, "choose_bio": True,
        "professions": [
            {"id": "profession_lower", "label": "Уроженец Нижнего Ряда",
             "description": "Вырос в хмари среди ржавых труб. Крепкие лёгкие, быстрые руки и умение исчезать в подворотне.",
             "stats": {"STR": 11, "CON": 12, "SIZ": 10, "DEX": 13, "INT": 10, "POW": 9, "CHA": 6},
             "skill_bonus": {"stealth": 10, "lockpick": 10, "melee": 10},
             "items": [{"item": "item_baton", "quantity": 1}, {"item": "item_filter", "quantity": 1}]},
            {"id": "profession_seminary", "label": "Недоучка Семинарии Шестерни",
             "description": "Ушёл из Ордена за год до посвящения. Помнит литургию, устройство машин и запах ладанного масла.",
             "stats": {"STR": 8, "CON": 9, "SIZ": 9, "DEX": 10, "INT": 14, "POW": 14, "CHA": 7},
             "skill_bonus": {"occult": 15, "mechanics": 10, "medicine": 5},
             "items": [{"item": "item_incense", "quantity": 2}]},
            {"id": "profession_guard", "label": "Бывший гвардеец Шпиля",
             "description": "Служил в почётной страже Совета, пока не задал не тот вопрос. Стреляет метко, смотрит тяжело.",
             "stats": {"STR": 13, "CON": 12, "SIZ": 11, "DEX": 11, "INT": 8, "POW": 8, "CHA": 8},
             "skill_bonus": {"firearms": 15, "intimidate": 10, "dodge": 5},
             "items": [{"item": "item_sabre", "quantity": 1}]},
        ],
        "callings": [
            {"id": "calling_sleuth", "label": "Сыщик",
             "description": "Видит то, что другие пропускают, и слышит ложь в любезностях.",
             "skills": {"spot": 60, "insight": 40, "persuade": 35, "stealth": 20, "lockpick": 20, "melee": 20, "occult": 25,
                        "mechanics": 20, "medicine": 15, "firearms": 25, "intimidate": 20, "dodge": 30}},
            {"id": "calling_tinker", "label": "Механик-ищейка",
             "description": "Разбирает улики как механизмы: винтик к винтику. Замки для него — головоломки.",
             "skills": {"spot": 45, "insight": 25, "mechanics": 45, "lockpick": 35, "stealth": 20, "melee": 20, "occult": 30,
                        "medicine": 25, "firearms": 25, "intimidate": 20, "dodge": 30}},
            {"id": "calling_enforcer", "label": "Каратель Палаты",
             "description": "Палата посылает его, когда вопросы задавать уже поздно.",
             "skills": {"spot": 35, "firearms": 50, "melee": 40, "intimidate": 40, "dodge": 40, "stealth": 20, "lockpick": 20,
                        "occult": 25, "mechanics": 20, "medicine": 15, "persuade": 15}},
        ],
    }
    return cc


def verify_char_creation(cc, skill_ids):
    mn = cc["stat_limits"]["min"]
    mx = cc["stat_limits"]["max"]
    errs = []
    for p in cc["professions"]:
        st = p["stats"]
        assert set(st) == {"STR", "CON", "SIZ", "DEX", "INT", "POW", "CHA"}, p["id"]
        tot = sum(max(0, v - mn) for v in st.values())
        if tot != cc["total_points"] or any(not (mn <= v <= mx) for v in st.values()):
            errs.append(f"{p['id']}: stats spent {tot} != {cc['total_points']}")
    for p in cc["professions"]:
        for c in cc["callings"]:
            spent = 0
            for s in skill_ids:
                if s in cc.get("forbidden_skills", []):
                    if s in c["skills"]:
                        errs.append(f"{c['id']} sets forbidden {s}")
                    continue
                floor = max(cc["skill_floor"], 25 if s in cc["mandatory_skills"] else 0) + p["skill_bonus"].get(s, 0)
                v = c["skills"].get(s, floor)
                if v < floor:
                    errs.append(f"{p['id']}+{c['id']}: {s}={v} below floor {floor}")
                if v > cc["skill_cap"]:
                    errs.append(f"{c['id']}: {s} over cap")
                spent += max(0, min(cc["skill_cap"], v) - floor)
            if spent != cc["skill_points"]:
                errs.append(f"{p['id']}+{c['id']}: skills spent {spent} != {cc['skill_points']}")
    return errs


def build_meta(design_doc, asset_exists):
    menu_bg = "assets/img/menu_bg.jpg"
    end_bg = "assets/img/end_bg.jpg"
    theme = {"profile": "dark-fantasy", "accent": "#c9a24a", "menu": {"dim": 0.45, "ken_burns": True}}
    if asset_exists(menu_bg):
        theme["menu"]["background"] = menu_bg
    if asset_exists(end_bg):
        theme["end"] = {"background": end_bg}

    def end_img(name):
        p = f"assets/img/{name}.jpg"
        return p if asset_exists(p) else None

    endings = [
        {"id": "ending_new_voice", "label": "Новый Голос", "title": "Город дышит в такт вашему сердцу", "tone": "neutral", "on": "victory",
         "text": "Вы кладёте ладонь на ядро, и Литания входит в вас, как пар в трубы. Венн ошиблась лишь в одном: Голос выбирает сам. Теперь каждый котёл, каждый фонарь, каждый вдох в Карст-Гальване — ваш. Вы будете справедливым. Наверное. Тиканье в груди говорит, что у вас впереди очень много лет, чтобы это проверить.",
         "conditions": [{"type": "flag_set", "flag": "ending_voice"}]},
        {"id": "ending_justice", "label": "Правосудие Палаты", "title": "Дело о часовых сердцах закрыто", "tone": "victory", "on": "victory",
         "text": "Литания снова спит под печатью Ордена, а имя Лиары Венн вычеркнуто из списков Совета. Город знает, что случилось, — и впервые за четыреста лет спорит о том, кто должен говорить за машину. Озрик молча ставит на ваш стол бутылку ерша и новое дело. В Карст-Гальване не бывает последних дел.",
         "conditions": [{"type": "flag_set", "flag": "ending_sealed"}, {"type": "flag_set", "flag": "venn_exposed"}]},
        {"id": "ending_quiet_seal", "label": "Тихая печать", "title": "Никто не узнает", "tone": "victory", "on": "victory",
         "text": "Литания запечатана. Великий Завод проходит под звон обычных колоколов, и советница Венн «скоропостижно скончалась от переутомления» — так написано в некрологе. Совет благодарит Палату за «рутинную проверку». Только вы и шесть вдов в Литейных знаете правду. Иногда по ночам в трубах конторы тихо тикает.",
         "conditions": [{"type": "flag_set", "flag": "ending_sealed"}]},
        {"id": "ending_cold_dawn", "label": "Холодный рассвет", "title": "Сердце остановилось", "tone": "neutral", "on": "victory",
         "text": "Вы вынимаете из венца ядра семь латунных сердец, одно за другим. Машина вздыхает — и замирает. Литания уходит, не сказав ни слова. Утром трубы Карст-Гальваны впервые за четыреста лет холодны. Город будет мёрзнуть, ругаться и учиться жить без чуда. Но никто больше не будет дышать по чужому слову.",
         "conditions": [{"type": "flag_set", "flag": "ending_destroyed"}]},
        {"id": "ending_false_trail", "label": "Ложный след", "title": "Не того повесили", "tone": "death", "on": "death",
         "text": "Невиновный ждал казни в подвалах Шпиля, пока в ночь Завода не зазвучал новый Голос. Вы поверили простому ответу — и Венн была вам за это очень благодарна.",
         "conditions": [{"type": "flag_set", "flag": "deadline_passed"}, {"type": "flag_set", "flag": "wrong_accused"}]},
        {"id": "ending_winding", "label": "Великий Завод", "title": "Город запел чужим голосом", "tone": "death", "on": "death",
         "text": "Семь колоколов отзвонили. Сердце-Двигатель набрало ход под голос Лиары Венн. Утром жители Карст-Гальваны просыпаются с её словами на губах — и не помнят своих.",
         "conditions": [{"type": "flag_set", "flag": "deadline_passed"}]},
        {"id": "ending_seventh_heart", "label": "Седьмое сердце", "title": "Седьмое сердце", "tone": "death", "on": "death",
         "text": "Вы падаете на решётчатый настил у самого ядра. Последнее, что вы чувствуете, — прохладу латуни там, где только что билось сердце. Седьмой колокол обрёл голос.",
         "conditions": [{"type": "flag_set", "flag": "at_heart"}]},
        {"id": "ending_rust", "label": "Ржавчина приняла", "title": "Ещё одно имя в трубах", "tone": "death", "on": "death",
         "text": "Хмарь, нож или пуля — в Нижнем городе неважно, что именно. Дело о часовых сердцах ляжет на стол другому дознавателю. Может быть, ему повезёт больше."},
    ]
    for e in endings:
        img = end_img({"ending_justice": "ending_justice", "ending_cold_dawn": "ending_cold", "ending_new_voice": "ending_voice"}.get(e["id"], "_none"))
        if img:
            e["image"] = img

    skill_ids = [s for s, _ in SKILLS]
    cc = char_creation()
    errs = verify_char_creation(cc, skill_ids)
    assert not errs, errs

    meta = {
        "id": CAMPAIGN_ID, "title": "Литания ржавых колоколов", "version": "1.0.0",
        "engine_version": "0.7.0", "min_engine": "0.7.0", "package_format": 1,
        "author": "Chronicle Forge ИИ-агент",
        "description": "Тёмное техно-фэнтези с детективом и выживанием. В городе, который греет живая машина, у кочегаров вместо сердец тикают латунные механизмы. Шесть дней до Великого Завода, пять подозреваемых, ядовитая хмарь — и ни одного простого ответа. Кампания на 5–7 часов.",
        "design_doc": design_doc,
        "tick_label": "час", "ticks_per_day": 24,
        "time_of_day": {"morning": 6, "day": 10, "evening": 18, "night": 22},
        "starting_region": "region_karst", "starting_location": "loc_station", "starting_scene": "scene_office", "starting_tick": 8,
        "chapters": [
            {"id": "ch_prologue", "label": "1 — Пролог: шестое тело", "order": 1, "description": "Контора, мертвецкая и первое поручение."},
            {"id": "ch_city", "label": "2 — Город шестерён", "order": 2, "description": "Расследование по всем ярусам: Нижний Ряд, Литейные, Собор и Шпиль."},
            {"id": "ch_depths", "label": "3 — Отстойники", "order": 3, "description": "Спуск под клапан №7, Литания в трубах и путь к Сердцу."},
            {"id": "ch_finale", "label": "4 — Великий Завод", "order": 4, "description": "Битва у Сердца-Двигателя и судьба города."},
        ],
        "needs": [
            {"id": "need_food", "label": "Сытость", "max": 100, "decay_per_tick": 0.8, "critical_threshold": 20, "on_zero_effect": "rule_starving"},
            {"id": "need_air", "label": "Чистый вдох", "max": 100, "decay_per_tick": 2, "critical_threshold": 25, "on_zero_effect": "rule_choking",
             "decay_when": [{"type": "in_location", "locations": SMOG}],
             "restore_per_tick": 6, "restore_when": [{"type": "in_location", "locations": CLEAN}]},
        ],
        "vitals": {"sanity": True},
        "luck": {"multiplier": 5, "reroll_cost": 1, "rest_luck": True},
        "rest": {"hp": "1d3", "mp_full": True},
        "camping": {"ticks": 8, "ambush_chance": 0},
        "reputation": {"label": "Репутация в Палате"},
        "statuses": [
            {"id": "status_tlen", "label": "Тлен в лёгких", "description": "Каждый вдох — с хрипом. Нужен тлен-отвар.", "scope": "both", "duration": 8,
             "dot": {"hp": 1}, "skill_mods": [{"skill": "stealth", "delta": -10}, {"skill": "dodge", "delta": -10}],
             "apply_message": "В лёгких скребёт тлен.", "expire_message": "Кашель отступил."},
            {"id": "status_burns", "label": "Кислотные ожоги", "description": "Морось разъела кожу.", "scope": "world", "duration": 4, "dot": {"hp": 1},
             "apply_message": "Кислотная морось жжёт кожу. Плащ бы сейчас пригодился."},
            {"id": "status_stim", "label": "Стимулятор", "description": "Всё резко, ярко и слишком громко.", "scope": "both", "duration": 6,
             "skill_mods": [{"skill": "spot", "delta": 15}, {"skill": "insight", "delta": 10}, {"skill": "firearms", "delta": 10}, {"skill": "melee", "delta": 10}],
             "apply_message": "Мир становится резким, как стекло."},
            {"id": "status_clarity", "label": "Ясность", "description": "Мысли выстроены, как зубцы шестерни.", "scope": "world", "duration": 12,
             "skill_mods": [{"skill": "occult", "delta": 10}, {"skill": "insight", "delta": 10}]},
            {"id": "status_drunk", "label": "Хмель", "description": "Тепло, смело и немного косо.", "scope": "both", "duration": 4,
             "skill_mods": [{"skill": "persuade", "delta": 5}, {"skill": "spot", "delta": -10}, {"skill": "firearms", "delta": -10}]},
            {"id": "status_blinded", "label": "Ослеплён", "description": "Перед глазами — белое пятно магниевой вспышки.", "scope": "combat", "duration": 2,
             "skill_mods": [{"skill": "melee", "delta": -30}, {"skill": "firearms", "delta": -30}, {"skill": "bite", "delta": -30}]},
            {"id": "status_dread", "label": "Шёпот Литании", "description": "В голове тикает чужой ритм.", "scope": "both", "duration": 3,
             "skill_mods": [{"skill": "firearms", "delta": -15}, {"skill": "melee", "delta": -15}, {"skill": "persuade", "delta": -15}]},
        ],
        "abilities": [
            {"id": "ability_magnesium", "label": "Магниевая вспышка", "description": "Вспышка карманной лампы ослепляет противника.",
             "mp_cost": 0, "cooldown_rounds": 3, "range": 3, "kind": "status", "status": "status_blinded", "status_duration": 2},
            {"id": "ability_tlen_bite", "label": "Тленный укус", "description": "Гончая впрыскивает тлен в рану.",
             "mp_cost": 0, "cooldown_rounds": 2, "range": 1, "skill": "bite", "kind": "status", "status": "status_tlen", "status_duration": 3},
            {"id": "ability_steam_burst", "label": "Паровой выброс", "description": "Трубы зала выплёвывают перегретый пар.",
             "mp_cost": 0, "cooldown_rounds": 2, "range": 3, "kind": "damage", "damage": "2d6"},
            {"id": "ability_litany_whisper", "label": "Шёпот Литании", "description": "Голос из всех труб сразу сбивает ритм сердца.",
             "mp_cost": 0, "cooldown_rounds": 3, "range": 6, "kind": "status", "status": "status_dread", "status_duration": 3},
        ],
        "difficulties": [
            {"id": "diff_normal", "label": "Дознаватель", "description": "Как задумано: хмарь опасна, бой — смертелен."},
            {"id": "diff_story", "label": "Сыщик", "description": "Для тех, кто пришёл за историей: мягче бой, медленнее голод и хмарь.", "enemy_damage": 0.6, "need_decay": 0.7},
            {"id": "diff_hard", "label": "Ржавчина", "description": "Хмарь гуще, враги злее, цены выше. Без автосохранений.", "enemy_damage": 1.3, "need_decay": 1.3, "prices": 1.2, "no_autosave": True},
        ],
        "equipment_slots": [{"id": "weapon", "label": "Оружие"}, {"id": "armor", "label": "Одежда"}],
        "calendar": {"year_label": "год Завода", "start_year": 412, "days_per_month": 30, "months": ["Копотень", "Ржавень", "Звонарь"],
                     "day_names": ["Поршнедень", "Клапанник", "Шестерник", "Литник", "Котельник", "Тишь", "Звонница"]},
        "weathers": [
            {"id": "weather_smog", "label": "Густая хмарь", "overlay": "fog"},
            {"id": "weather_acid", "label": "Кислотная морось", "overlay": "rain", "ambient": ["amb_rain"]},
            {"id": "weather_ash", "label": "Пеплопад", "overlay": "ash"},
        ],
        "overlay_layers": [{"id": "fog", "label": "Туман"}, {"id": "rain", "label": "Дождь"}, {"id": "ash", "label": "Пепел"}],
        "endings": endings,
        "codex_categories": [{"id": "case", "label": "Дело о часовых сердцах"}, {"id": "creatures", "label": "Твари и механизмы"},
                             {"id": "places", "label": "Места"}, {"id": "chronicles", "label": "Хроники"}],
        "dice_rules": {"critical_divisor": 5, "special_divisor": 2, "fumble_from": 96},
        "skills": [{"id": i, "label": l} for i, l in SKILLS],
        "item_categories": [
            {"id": "currency", "label": "Валюта"},
            {"id": "food", "label": "Еда", "restores_needs": ["need_food"]},
            {"id": "drink", "label": "Выпивка"},
            {"id": "medicine", "label": "Лекарства", "restores_hp": True},
            {"id": "consumable", "label": "Расходники", "restores_needs": ["need_air"]},
            {"id": "material", "label": "Материалы"},
            {"id": "weapon", "label": "Оружие", "is_weapon": True},
            {"id": "ammo", "label": "Боеприпасы"},
            {"id": "armor", "label": "Одежда", "is_armor": True},
            {"id": "evidence", "label": "Улики"},
            {"id": "key", "label": "Ключи и памятные вещи"},
            {"id": "scenery", "label": "Обстановка"},
        ],
        "slot_types": [{"id": "person", "label": "Персонаж"}, {"id": "item", "label": "Предмет"}, {"id": "prop", "label": "Говорящий объект"}],
        "flags": [{"id": k, "label": v} for k, v in FLAG_LABELS.items()],
        "emotions": [{"id": "neutral", "label": "Обычный"}],
        "currencies": [{"id": "token", "label": "Латунные жетоны", "symbol": "ж", "item_id": "item_token"}],
        "factions": [
            {"id": "faction_chamber", "label": "Палата Тишины", "base_disposition": 20, "description": "Ведомство дознавателей. Ваши."},
            {"id": "faction_order", "label": "Орден Святой Шестерни", "base_disposition": 0, "description": "Монахи-механики, хранители Сердца."},
            {"id": "faction_union", "label": "Союз кочегаров", "base_disposition": -15, "description": "Рабочие литейных и паровых магистралей. Не любят Палату."},
            {"id": "faction_council", "label": "Совет Шпиля", "base_disposition": 5, "description": "Правители верхнего яруса."},
            {"id": "faction_lower", "label": "Нижний Ряд", "base_disposition": -5, "description": "Трущобы в хмари. Здесь платят слухами."},
        ],
        "crimes": [{"id": "crime_theft", "label": "Кража улики"}, {"id": "crime_burglary", "label": "Кража со взломом в Шпиле"}],
        "default_player": "player_hero",
        "max_companions": 1,
        "combat": {"flee": {"skill": "dodge"}},
        "char_creation": cc,
        "metaprogress": {
            "achievements": [
                {"id": "ach_justice", "label": "Правосудие", "description": "Запечатать Литанию и разоблачить Венн.", "conditions": [{"type": "flag_set", "flag": "ending_sealed"}, {"type": "flag_set", "flag": "venn_exposed"}]},
                {"id": "ach_cold", "label": "Холодный рассвет", "description": "Остановить Сердце-Двигатель.", "conditions": [{"type": "flag_set", "flag": "ending_destroyed"}]},
                {"id": "ach_voice", "label": "Голос", "description": "Принять Голос машины.", "hidden": True, "conditions": [{"type": "flag_set", "flag": "ending_voice"}]},
                {"id": "ach_detective", "label": "Все нити", "description": "Сделать на доске все пять выводов за один забег.",
                 "conditions": [{"type": "flag_set", "flag": f} for f in ("ded_maker", "ded_victims", "ded_ritual", "ded_payer", "ded_motive")]},
                {"id": "ach_mercy", "label": "Колыбельная", "description": "Отпустить Йенса с миром.", "conditions": [{"type": "flag_set", "flag": "jens_peace"}]},
                {"id": "ach_saviour", "label": "Долг уплачен", "description": "Спасти доктора Марроу.", "conditions": [{"type": "flag_set", "flag": "marrow_saved"}]},
            ]
        },
        "music_tracks": [
            music("music_menu", "Литания ржавых колоколов", "таинственная", 60, "D", "фригийский", ["пад-аккорды", "бас"], ["i", "II", "i", "VII"], 412),
            music("music_station", "Вокзал Палаты", "спокойная", 72, "A", "минор", ["пад-аккорды", "арпеджио"], ["i", "VI", "III", "VII"], 11),
            music("music_station_night", "Ночная контора", "таинственная", 58, "A", "минор", ["пад-аккорды"], ["i", "iv", "i", "V"], 12),
            music("music_lower", "Нижний Ряд", "тревожная", 84, "E", "фригийский", ["бас", "перкуссия", "пад-аккорды"], ["i", "II", "VII", "i"], 21),
            music("music_foundry", "Литейные", "тревожная", 96, "C", "минор", ["бас", "перкуссия"], ["i", "VI", "VII", "i"], 31),
            music("music_cathedral", "Собор Шестерни", "торжественная", 54, "F", "дорийский", ["пад-аккорды", "арпеджио"], ["i", "IV", "i", "VII"], 41),
            music("music_spire", "Верхний Шпиль", "торжественная", 66, "Bb", "минор", ["пад-аккорды", "арпеджио", "бас"], ["i", "VI", "iv", "V"], 51),
            music("music_undercity", "Отстойники", "таинственная", 50, "C#", "фригийский", ["пад-аккорды", "бас"], ["i", "II", "i", "II"], 61),
            music("music_heart", "Сердце-Двигатель", "тревожная", 70, "D", "фригийский", ["бас", "перкуссия", "пад-аккорды"], ["i", "II", "VII", "VI"], 71),
            music("music_combat", "Схватка", "боевая", 132, "E", "минор", ["бас", "перкуссия", "арпеджио"], ["i", "VI", "VII", "i"], 81, 0.8),
            music("music_boss", "Голос Сердца", "боевая", 120, "D", "фригийский", ["бас", "перкуссия", "пад-аккорды", "арпеджио"], ["i", "II", "i", "VII"], 91, 0.85),
        ],
        "sounds": [
            {"id": "sfx_click", "label": "Щелчок клапана", "src": zz(1, 0, 400, 0, 0.01, 0.04, 1, 2, 0, 0, 0, 0, 0, 0.1)},
            {"id": "sfx_coin", "label": "Звон жетона", "src": zz(1, 0.05, 1200, 0, 0.03, 0.15, 0, 1, 0, 0, 500, 0.05, 0, 0, 0, 0, 0, 0.6, 0.02)},
            {"id": "sfx_steam", "label": "Шипение пара", "src": zz(0.6, 0.1, 200, 0.05, 0.3, 0.4, 4, 0, 0, 0, 0, 0, 0, 1)},
            {"id": "sfx_bell", "label": "Удар колокола", "src": zz(1, 0, 196, 0, 0.4, 1.6, 0, 1.5, 0, 0, 0, 0, 0, 0, 2, 0, 0.2, 0.5)},
            {"id": "sfx_door", "label": "Скрип двери", "src": [zz(0.7, 0.1, 120, 0.05, 0.2, 0.2, 2, 3, -2), zz(0.7, 0.1, 160, 0.05, 0.25, 0.15, 2, 3, 1)]},
            {"id": "sfx_gear", "label": "Шестерня", "src": zz(0.8, 0.05, 300, 0, 0.05, 0.1, 3, 1, 0, 0, 0, 0, 0.03)},
            {"id": "sfx_hit", "label": "Удар", "src": zz(1, 0.1, 90, 0, 0.02, 0.15, 4, 2)},
            {"id": "sfx_shot", "label": "Выстрел", "src": zz(1.2, 0.05, 60, 0, 0.02, 0.3, 4, 0.5, -10, 0, 0, 0, 0, 1)},
            {"id": "sfx_miss", "label": "Промах", "src": zz(0.5, 0.1, 600, 0, 0.02, 0.08, 0, 1, -40)},
            {"id": "sfx_death", "label": "Остановка механизма", "src": zz(1, 0, 220, 0, 0.3, 0.8, 1, 1, -3)},
            {"id": "sfx_quest", "label": "Новая запись", "src": zz(0.8, 0, 523, 0, 0.08, 0.3, 0, 1, 0, 0, 260, 0.08)},
            {"id": "sfx_paper", "label": "Шорох бумаги", "src": zz(0.4, 0.2, 800, 0, 0.05, 0.08, 4, 0)},
            {"id": "sfx_victory", "label": "Победа", "src": zz(1, 0, 392, 0, 0.2, 0.6, 0, 1, 0, 0, 196, 0.15, 0.2)},
            {"id": "amb_steam", "label": "Пар вокзала (фон)", "loop": True, "src": zz(0.15, 0.3, 100, 0.5, 3, 0.5, 4, 0)},
            {"id": "amb_drip", "label": "Капель (фон)", "loop": True, "src": zz(0.2, 0.4, 900, 0, 0.01, 0.05, 0, 1, 0, 0, 0, 0, 0.9)},
            {"id": "amb_furnace", "label": "Гул печей (фон)", "loop": True, "src": zz(0.2, 0.1, 50, 0.5, 3, 0.5, 4, 0, 0, 0, 0, 0, 0, 0.5)},
            {"id": "amb_heartbeat", "label": "Удары Сердца (фон)", "loop": True, "src": zz(0.5, 0, 55, 0.01, 0.1, 0.3, 0, 1, 0, 0, 0, 0, 1.1)},
            {"id": "amb_rain", "label": "Морось (фон)", "loop": True, "src": zz(0.12, 0.5, 1000, 0.3, 2, 0.3, 4, 0)},
        ],
        "ui_sounds": {"menu_music": "music_menu", "click": "sfx_click", "panel_open": "sfx_paper", "panel_close": "sfx_paper",
                      "message": "sfx_gear", "travel_depart": "sfx_steam", "travel_arrive": "sfx_door", "scene_transition": "sfx_door",
                      "combat_start": "sfx_bell", "hit": "sfx_hit", "miss": "sfx_miss", "crit": "sfx_shot", "parry": "sfx_gear",
                      "death": "sfx_death", "victory": "sfx_victory", "defeat": "sfx_death", "quest_started": "sfx_quest",
                      "quest_completed": "sfx_bell", "skill_up": "sfx_gear", "coin": "sfx_coin"},
        "default_music": ["music_station"], "combat_music": ["music_combat"],
        "theme": theme,
        "attribution": {"author": "Chronicle Forge ИИ-агент (по заданию мастера)",
                        "note": "Иллюстрации в assets/img созданы генератором изображений ИИ специально для этой кампании; сторонних материалов нет. См. assets/CREDITS.md."},
    }
    return meta
