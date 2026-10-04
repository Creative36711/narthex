"""Катсцены, рецепты, кодекс и таблицы случайных встреч."""

from common import art, layer, rect, ell, poly, line, text, grad, lamp, pipe_run, gear, crate
from c_scenes import (passcourt_art, forgehall_art, drains_art, tunnels_art,
                      deepcore_art, ashflats_art, chapel_art, market_art)

# ======================================================================
# катсцены
# ======================================================================


def skyline_art(night=True):
    L = [layer("небо", rect(0, 0, 1280, 720, grad("#0d1319", "#3a2c22", 90))),
         layer("пепел", rect(0, 0, 1280, 720, "#8f8a80", opacity=0.10))]
    for i in range(9):
        x = 40 + i * 140
        h = 220 + (i % 4) * 90
        L.append(layer("корпус", rect(x, 620 - h, 110, h, grad("#221e1a", "#131110", 90))))
        L.append(layer("крыша", poly([x - 10, 620 - h, x + 55, 620 - h - 46, x + 120, 620 - h],
                                     "#2a241f")))
        L.append(layer("окно", rect(x + 26, 620 - h + 40, 26, 34, "#c98b3a", opacity=0.8)))
        L.append(layer("окно", rect(x + 66, 620 - h + 96, 26, 34, "#8a5a2a", opacity=0.7)))
        L.append(layer("дым", ell(x + 55, 620 - h - 80, 46, 30, "#6f6a63", opacity=0.22)))
    L.append(layer("трубы вдали", rect(1140, 200, 30, 420, "#1d1a16")))
    L.append(layer("трубы вдали", rect(1200, 260, 30, 360, "#1d1a16")))
    L.append(layer("земля", rect(0, 620, 1280, 100, grad("#2b2620", "#141210", 90))))
    L.append(layer("огонь вдали", ell(640, 620, 300, 60, "#c98b3a", opacity=0.18)))
    return art("#0d0f12", *L)


def mark_art():
    L = [layer("металл", rect(0, 0, 1280, 720, grad("#3a3630", "#191715", 90)))]
    for i in range(30):
        L.append(layer("риска", line(0, i * 26, 1280, i * 26 + 8, "#2a2622", 3, opacity=0.6)))
    L.append(layer("вставка", rect(420, 220, 440, 280, grad("#8a7a58", "#4a3f2a", 90), radius=10)))
    for i in range(3):
        L.append(layer("гравировка", line(480 + i * 120, 280, 520 + i * 120, 440, "#e0d3b0", 6, opacity=0.85)))
    L.append(layer("гравировка", ell(760, 360, 12, 12, "#e0d3b0", opacity=0.9)))
    L.append(layer("свет", ell(640, 360, 420, 300, "#c98b3a", opacity=0.10)))
    return art("#141210", *L)


CUTSCENES = {
    "cutscene_intro": {
        "id": "cutscene_intro", "label": "Пролог. Смена началась", "music": "music_menu",
        "chapter": "ch_prologue",
        "slides": [
            {"art": skyline_art(), "duration": 7, "transition": "panzoom",
             "text": "Котёл просыпается сменой: двенадцать труб, одна река и одна на всех вода."},
            {"art": forgehall_art(False), "duration": 6, "transition": "fade",
             "text": "Двенадцать лет назад в глубинном зале обвалилась штольня. Мастера Кляйна объявили погибшим."},
            {"art": mark_art(), "duration": 6, "transition": "fade",
             "text": "Три недели в городе тихо умирают люди. Без крови, без масла — с латунью в позвонках."},
            {"art": tunnels_art(), "duration": 6, "transition": "slide",
             "text": "Стража пишет в списках «угар». Списки читают только те, кто их пишет."},
            {"art": passcourt_art(True), "duration": 6, "transition": "panzoom",
             "text": "Четвёртое тело ждёт в Медном цеху. Дознавательница уже стоит над ним."},
        ],
    },
    "cutscene_mid": {
        "id": "cutscene_mid", "label": "Шёпот в трубе", "music": "music_tunnels",
        "chapter": "ch_depths",
        "slides": [
            {"art": tunnels_art(), "duration": 5, "transition": "panzoom",
             "text": "В трубе тепло и тесно. Вода идёт вниз, а голос — вверх."},
            {"art": mark_art(), "duration": 5, "transition": "fade",
             "text": "На металле — метки. Три черты и точка: подпись мастера, которого нет двенадцать лет."},
            {"art": drains_art(), "duration": 5, "transition": "slide",
             "text": "«Дописать», — говорит труба. «Дописать всех», — повторяет кто-то живой."},
        ],
    },
    "cutscene_deep": {
        "id": "cutscene_deep", "label": "Спуск", "music": "music_deep",
        "chapter": "ch_finale",
        "slides": [
            {"art": chapel_art(), "duration": 5, "transition": "fade",
             "text": "Под алтарём пахнет горячим железом и старой водой."},
            {"art": tunnels_art(), "duration": 5, "transition": "slide",
             "text": "Вниз ведёт ход, которого нет ни на одной карте Котла."},
            {"art": deepcore_art(False), "duration": 6, "transition": "panzoom",
             "text": "Здесь город не строил — здесь он вырос сам: зало, шестерни и пульт под потолком."},
        ],
    },
}

# ======================================================================
# рецепты
# ======================================================================


def recipe(ident, label, description, inputs, output, tools=None, requires=None,
           skill=None, time_ticks=1, message=None, known=None, repair=False):
    r = {"id": ident, "label": label, "description": description,
         "inputs": [{"item": i, "quantity": q} for i, q in inputs],
         "output": {"item": output[0], "quantity": output[1]}}
    if tools:
        r["tools"] = tools
    if requires is not None:
        r["requires"] = requires
    if skill:
        r["skill"] = {"id": skill[0], "difficulty": skill[1]}
    if time_ticks:
        r["time_ticks"] = time_ticks
    if message:
        r["message"] = message
    if known is not None:
        r["known"] = known
    if repair:
        r["repair"] = True
    return r


RECIPES = {
    "recipe_bandage": recipe(
        "recipe_bandage", "Бинт из ветоши",
        "Проварить тряпки, высушить у горна и свернуть плотно, в палец толщиной.",
        [("item_cloth", 2)], ("item_bandage", 1),
        skill=("first_aid", 30), time_ticks=1,
        message="Бинт свёрнут ровно, как учила Клепа."),
    "recipe_ash_bread": recipe(
        "recipe_ash_bread", "Пепельный хлеб",
        "Грибы, угольная крошка и вода: тесто выходит серым, зато горячим.",
        [("item_mushrooms", 2), ("item_clean_water", 1)], ("item_bread", 2),
        skill=("craft", 25), time_ticks=1,
        message="Каравай вышел серым и тёплым."),
    "recipe_gasket": recipe(
        "recipe_gasket", "Прокладка для клапана",
        "Ветошь, пропитанная маслом, — ровно по седло водонапорного клапана.",
        [("item_cloth", 2), ("item_oil", 1)], ("item_gasket", 1),
        tools=["item_wrench"], skill=("mechanics", 30), time_ticks=1,
        message="Прокладка лежит в руке плотным блином."),
    "recipe_tonic": recipe(
        "recipe_tonic", "Травяной настой",
        "Мох, чистая вода и терпение. Рецепт Клепы — настой против ржавой лихорадки.",
        [("item_moss", 2), ("item_clean_water", 1)], ("item_tonic", 1),
        requires=[{"type": "flag_set", "flag": "water_restored"}],
        skill=("first_aid", 40), time_ticks=2, known=False,
        message="Настой получился мутным, но горьким — значит, работает."),
    "recipe_bitter_drops": recipe(
        "recipe_bitter_drops", "Горькие капли",
        "Жреческий состав: мох, вода и щепоть пепла. Глушит шёпот в голове.",
        [("item_moss", 3), ("item_clean_water", 1)], ("item_bitter_drops", 1),
        requires=[{"type": "flag_set", "flag": "cold_flame_rite"}],
        skill=("medicine", 35), time_ticks=2, known=False,
        message="Капли отдают горечью и гарью."),
    "recipe_ether_lens": recipe(
        "recipe_ether_lens", "Стекло шёпота",
        "Сплав, стекло и капля эфирной крови: линза, читающая метки машин.",
        [("item_gear", 1), ("item_scrap", 3), ("item_ether_vial", 1)],
        ("item_ether_lens", 1), tools=["item_wrench"],
        requires=[{"type": "flag_set", "flag": "recipe_lens_found"}],
        skill=("mechanics", 45), time_ticks=3, known=False,
        message="Линза тёплая. В ней дрожит латунная нить."),
}

# ======================================================================
# кодекс
# ======================================================================

CODEX = {
    "codex_cauldron": {
        "id": "codex_cauldron", "label": "Котёл", "category": "places",
        "text": "Город-крепость на реке Окалине, построенный вокруг литейных и турбины. "
                "Двенадцать труб, одна вода, комендантский час с десяти вечера. "
                "Всё, что здесь есть, выплавлено из чего-то живого или мертвого — часто не отличить.",
    },
    "codex_ether": {
        "id": "codex_ether", "label": "Эфирная кровь", "category": "chronicles",
        "text": "Тёмная вязкая жидкость, которую качают из живых механизмов в глубинных штольнях. "
                "Крутит турбины, светит улицам, движет лифтами. Плата — шёпот: сначала ты слышишь машины, "
                "потом машины начинают слышать тебя. Врачи называют это «угарной усталостью» и не лечат.",
    },
    "codex_brass": {
        "id": "codex_brass", "label": "Латунные вставки", "category": "chronicles",
        "text": "Две-три латунные шпильки, вбитые в позвонки аккуратно, как заклёпки. "
                "Тело остаётся без крови и без масла, будто из него вычерпали всю жидкость. "
                "Так метит работу один человек — мастер, которого двенадцать лет считают мёртвым.",
    },
    "codex_drains": {
        "id": "codex_drains", "label": "Сливные лотки", "category": "places",
        "text": "Под Медным цехом — сеть лотков и труб, по которым уходит вода и уходит всё остальное. "
                "Прутья стока отогнуты: те, кто уходит вниз, возвращаться не обязаны.",
    },
    "codex_curia": {
        "id": "codex_curia", "label": "Литая Курия", "category": "chronicles",
        "text": "Правит Котлом от имени цехов: считает выхлоп, воду и людей. "
                "Приказ Курии про «угарные смерти» видел каждый, кто умеет читать, "
                "и никто не читал его вслух.",
    },
    "codex_rite": {
        "id": "codex_rite", "label": "Обряд гашения", "category": "chronicles",
        "text": "Остывшее Пламя верит: машину не надо доить, машину надо отпускать. "
                "Обряд прост — кровь в чашу, шлак в воду, слово вслух, — но для него нужно, "
                "чтобы в линзе и в человеке было по капле эфира.",
    },
    "codex_klein": {
        "id": "codex_klein", "label": "Мастер Кляйн", "category": "people",
        "text": "Главный механик Котла, объявленный погибшим при обвале двенадцатилетней давности. "
                "Он выжил в глубинном зале, сросся с эфирной кровью и научился записывать себя в металл. "
                "Его подпись — три черты и точка. Его почерк ровный, будто писала не рука, а станок.",
    },
    "codex_chapel": {
        "id": "codex_chapel", "label": "Часовня Остывшего Пламени", "category": "places",
        "text": "Единственный храм Котла. Курия запретила здесь службы, но отец Ржав всё равно "
                "разбирает по утрам приношения: гайки, шайбы, обломки. Под алтарём — заваленный ход "
                "в глубинное зало, закрытый двенадцать лет назад — и открытый снова.",
    },
    "codex_deep": {
        "id": "codex_deep", "label": "Глубинное зало", "category": "places",
        "text": "Машинное зало под городом: шестерни выше человека, мостки, пульт с шестью рычагами. "
                "Котёл это не строил — это выросло само, вскормленное эфирной кровью.",
    },
    "codex_mother": {
        "id": "codex_mother", "label": "Железная Мать", "category": "creatures",
        "text": "Турбина-сердце Котла, найденная под первым камнем города. "
                "Изначальная машина: её доили двенадцать лет, и она научилась говорить. "
                "Речь её проста: «ещё», «больше», «дописать».",
    },
    "codex_zavodnoy": {
        "id": "codex_zavodnoy", "label": "Заводные", "category": "creatures",
        "text": "Люди, в которых вставили латунный каркас и заводную пружину вместо дыхания. "
                "Двигаются рывками, на вопросы не отвечают, лица у них чужие — чаще всего свои же, "
                "но из прошлой жизни.",
    },
    "codex_tisha": {
        "id": "codex_tisha", "label": "Тихие", "category": "creatures",
        "text": "Дети, которых город не отпустил. Не отбрасывают тени, говорят шёпотом, "
                "ходят дорогами, которых нет на карте. Просят вернуть игрушки и никогда не говорят «спасибо».",
    },
}

# ======================================================================
# таблицы встреч (лежат в rules/, но в манифесте — только encounters)
# ======================================================================

ENCOUNTERS = {
    "enc_routes": {"encounter_tables": [{
        "id": "enc_routes", "rolls": 1,
        "entries": [
            {"weight": 4, "type": "nothing"},
            {"weight": 2, "type": "event", "effects": [
                {"type": "show_message", "text": "Мимо проходит смена: шесть человек, никто не смотрит в глаза."},
                {"type": "change_need", "need": "need_rest", "delta": -3}]},
            {"weight": 2, "type": "skill_check", "skill": "perceive", "difficulty": 40,
             "message": "На стене свежие метки: три черты и точка.",
             "success_effects": [{"type": "show_message", "text": "Это подпись мастера. Значит, он ходил здесь."},
                                 {"type": "change_need", "need": "need_nerve", "delta": -3}],
             "fail_effects": [{"type": "show_message", "text": "Только гарь и следы телег."}]},
            {"weight": 1, "type": "combat", "arena": "arena_yard", "intro": "Из-за угла выходят двое с трубами.",
             "enemies": [{"entity": "npc_strazh", "count_min": 1, "count_max": 2}]},
        ],
    }]},
    "enc_tunnels": {"encounter_tables": [{
        "id": "enc_tunnels", "rolls": 1,
        "entries": [
            {"weight": 3, "type": "nothing"},
            {"weight": 2, "type": "event", "effects": [
                {"type": "show_message", "text": "В трубе что-то шевелится и уходит глубже."},
                {"type": "change_need", "need": "need_nerve", "delta": -5}]},
            {"weight": 1, "type": "combat", "arena": "arena_tunnels", "intro": "Тварь выходит из ответвления на четырёх лапах.",
             "enemies": [{"entity": "npc_pipe_beast", "count_min": 1, "count_max": 1}]},
            {"weight": 1, "type": "combat", "arena": "arena_tunnels", "intro": "Латунная фигура перекрывает мостки.",
             "enemies": [{"entity": "npc_zavodnoy", "count_min": 1, "count_max": 1}]},
        ],
    }]},
    "enc_flats": {"encounter_tables": [{
        "id": "enc_flats", "rolls": 1,
        "entries": [
            {"weight": 3, "type": "nothing"},
            {"weight": 2, "type": "event", "effects": [
                {"type": "apply_status", "target": "player", "status": "status_ash_lung", "duration": 6},
                {"type": "show_message", "text": "Ветер поднимает пепел в лицо — дышать нечем."}]},
            {"weight": 1, "type": "skill_check", "skill": "perceive", "difficulty": 45,
             "message": "Пепел заметает следы, но не все.",
             "success_effects": [{"type": "show_message", "text": "Босые следы идут от города к трубе. Слишком много для живых."},
                                 {"type": "unlock_codex", "entry": "codex_tisha"}],
             "fail_effects": [{"type": "show_message", "text": "Только пепел и ветер."}]},
            {"weight": 1, "type": "combat", "arena": "arena_tunnels", "intro": "Слепая тварь идёт на тепло.",
             "enemies": [{"entity": "npc_pipe_beast", "count_min": 1, "count_max": 1}]},
        ],
    }]},
}


def build_cutscenes():
    return CUTSCENES


def build_recipes():
    return RECIPES


def build_codex():
    return CODEX
