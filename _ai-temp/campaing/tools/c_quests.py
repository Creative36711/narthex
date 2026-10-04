"""Квесты: стадии, записи журнала и переходы."""

from common import eff_journal


def stage(ident, label, jkey=None, transitions=None, final=None, outcome=None,
          effects=None, quest=None):
    s = {"id": ident, "label": label}
    if final:
        s["final"] = True
    if outcome:
        s["outcome"] = outcome
    effs = list(effects or [])
    if jkey and quest:
        effs = [eff_journal(quest, jkey)] + effs
    if effs:
        s["on_enter_effects"] = effs
    if transitions:
        s["transitions"] = [{"to": t, "conditions": c} for t, c in transitions]
    return s


def transition(to, *conditions):
    return (to, list(conditions))


def flag(f):
    return {"type": "flag_set", "flag": f}


QUESTS = {}


def add(q):
    QUESTS[q["id"]] = q


# ------------------------------------------------------------------ главный

add({
    "id": "quest_silent_plague", "label": "Тихий мор",
    "description": "Четвёртое тело в Медном цеху, латунь в позвонках и подпись мастера, которого нет двенадцать лет.",
    "journal_entries": {
        "j_start": "Сера Дольная просит осмотреть четвёртое тело в Медном цеху: три смерти уже списали на угар.",
        "j_body": "В позвонках — латунные вставки, тёплые и аккуратные. Такие не бывают случайными.",
        "j_names": "У мертвеца есть имя и долг: список пропавших лежит у ростовщика Векселя. Пора читать.",
        "j_deep": "Глубинный ход открыт: под часовней — машинное зало, и там кто-то ждёт.",
        "j_done": "Мастер Кляйн остановлен. Сердце Котла решило свою судьбу.",
    },
    "stages": [
        stage("stage_start", "Тело в цеху", "j_start", quest="quest_silent_plague",
              transitions=[transition("stage_bodies", flag("body_examined"))]),
        stage("stage_bodies", "Что в позвонках", "j_body", quest="quest_silent_plague",
              transitions=[transition("stage_names", flag("ledger_known")),
                           transition("stage_names", flag("gnat_saved"))]),
        stage("stage_names", "Имена и свидетели", "j_names", quest="quest_silent_plague",
              transitions=[transition("stage_deep", flag("deep_gate_open"))]),
        stage("stage_deep", "Под городом", "j_deep", quest="quest_silent_plague",
              transitions=[transition("stage_done", flag("klein_defeated"))]),
        stage("stage_done", "Дело закрыто", "j_done", quest="quest_silent_plague",
              final=True, outcome="success"),
    ],
})

# ------------------------------------------------------------------ свидетель

add({
    "id": "quest_witness", "label": "Шпилька молчит",
    "description": "Подмастерье часовщика видел то, чего Цеху знать не нужно. Пока он жив — есть показания.",
    "journal_entries": {
        "j_ask": "Гвоздь сказал: подмастерье часовщика Гнат видел, как уводили человека. Он прячется в мастерской на слободе.",
        "j_saved": "Гнат жив и рассказал про латунных людей и трубу за цехом. Жетон подмастерья теперь у героя.",
        "j_lost": "Гнат погиб. Свидетель потерян, показания не собрать.",
    },
    "stages": [
        stage("stage_search", "Найти свидетеля", "j_ask", quest="quest_witness",
              transitions=[transition("stage_saved", flag("gnat_saved")),
                           transition("stage_failed", flag("gnat_dead"))]),
        stage("stage_saved", "Показания", "j_saved", quest="quest_witness",
              final=True, outcome="success"),
        stage("stage_failed", "Свидетель потерян", "j_lost", quest="quest_witness",
              final=True, outcome="failure"),
    ],
})

# ------------------------------------------------------------------ книга

add({
    "id": "quest_ledger", "label": "Долговая книга",
    "description": "Гроссбух Векселя: имена, суммы, даты. Три имени уже никого не встретят дома.",
    "journal_entries": {
        "j_start": "Вексель ведёт книгу должников. В ней имена пропавших — и, кажется, подпись того, кто их вычёркивал.",
        "j_got": "Гроссбух у героя. Что с ним делать — Курия, ростовщик или огонь?",
        "j_ceh": "Курия забрала книгу. Дело закроют бумагой, а имена — угарными списками.",
        "j_veksel": "Книга вернулась к Векселю. Долги остались, но ростовщик теперь обязан герою.",
        "j_burned": "Книга сожжена. Должники свободны, доказательств больше нет.",
    },
    "stages": [
        stage("stage_find", "Гроссбух", "j_start", quest="quest_ledger",
              transitions=[transition("stage_decide", flag("ledger_taken")),
                           transition("stage_burned", flag("ledger_burned")),
                           transition("stage_veksel", flag("ledger_returned")),
                           transition("stage_ceh", flag("ledger_ceh"))]),
        stage("stage_decide", "Судьба книги", "j_got", quest="quest_ledger"),
        stage("stage_ceh", "У Курии", "j_ceh", quest="quest_ledger", final=True, outcome="success"),
        stage("stage_veksel", "У Векселя", "j_veksel", quest="quest_ledger", final=True, outcome="success"),
        stage("stage_burned", "Пепел в очаге", "j_burned", quest="quest_ledger", final=True, outcome="success"),
    ],
})

# ------------------------------------------------------------------ барак

add({
    "id": "quest_quarantine", "label": "Пятеро в бараке",
    "description": "Клепа держит пятерых на мхе и злости. Нужны настои, а печь надо починить.",
    "journal_entries": {
        "j_start": "Клепа просит три банки травяного настоя и починку печи: без тепла барак не вытянет.",
        "j_warm": "Печь барака починена. Тяга есть, на койках стало теплее.",
        "j_done": "Барак выжил: пятеро дышат, печь греет, Клепа больше не говорит «не лезь».",
    },
    "stages": [
        stage("stage_start", "Настои и печь", "j_start", quest="quest_quarantine",
              transitions=[transition("stage_warm", flag("furnace_fixed")),
                           transition("stage_done", flag("quarantine_tonics"), flag("furnace_fixed"))]),
        stage("stage_warm", "Тепло", "j_warm", quest="quest_quarantine",
              transitions=[transition("stage_done", flag("quarantine_tonics"))]),
        stage("stage_done", "Барак выжил", "j_done", quest="quest_quarantine",
              final=True, outcome="success"),
    ],
})

# ------------------------------------------------------------------ вода

add({
    "id": "quest_valve", "label": "Сухая вода",
    "description": "Клапан водонапорной башни выкрошился: город сидит на грязной воде и ждёт, когда кто-нибудь починит.",
    "journal_entries": {
        "j_start": "В башне сдох клапан, прокладка выкрошилась. Без него в Котле останется только ржавая вода.",
        "j_done": "Клапан заменён, вода пошла в город. В бараке и в корчме снова наливают чистое.",
    },
    "stages": [
        stage("stage_start", "Клапан", "j_start", quest="quest_valve",
              transitions=[transition("stage_done", flag("water_restored"))]),
        stage("stage_done", "Вода пошла", "j_done", quest="quest_valve",
              final=True, outcome="success"),
    ],
})

# ------------------------------------------------------------------ линза

add({
    "id": "quest_lens", "label": "Стекло шёпота",
    "description": "Линза из сплава, стекла и капли эфирной крови показывает то, что машины пишут друг на друге.",
    "journal_entries": {
        "j_start": "Отец Ржав знает рецепт линзы, сквозь которую видно шёпотные метки на металле.",
        "j_recipe": "Рецепт взят: нужен сплав, стекло и капля эфирной крови. Без линзы в трубы лучше не ходить.",
        "j_done": "Стекло шёпота собрано. Теперь герой читает слова, которые машины оставляют друг другу.",
    },
    "stages": [
        stage("stage_ask", "Рецепт Ржава", "j_start", quest="quest_lens",
              transitions=[transition("stage_craft", flag("recipe_lens_found"))]),
        stage("stage_craft", "Сборка", "j_recipe", quest="quest_lens",
              transitions=[transition("stage_done", flag("lens_built"))]),
        stage("stage_done", "Линза", "j_done", quest="quest_lens",
              final=True, outcome="success"),
    ],
})

# ------------------------------------------------------------------ финал

add({
    "id": "quest_mother", "label": "Остывшее пламя",
    "description": "Под Котлом спит живое сердце. Его можно упокоить обрядом, подчинить или оставить как есть.",
    "journal_entries": {
        "j_start": "В глубине под часовней — турбина, которую двенадцать лет доили. Машина научилась говорить.",
        "j_meet": "Железная Мать видела героя. Она ждёт решения: огонь, обряд или место хозяина.",
        "j_peace": "Мать упокоена обрядом Остывшего Пламени. Котёл потеряет свет, но останется жив.",
        "j_bound": "Герой занял место у турбины. Теперь шёпот говорит его голосом.",
    },
    "stages": [
        stage("stage_start", "Спуск", "j_start", quest="quest_mother",
              transitions=[transition("stage_meet", flag("mother_met"))]),
        stage("stage_meet", "Разговор с сердцем", "j_meet", quest="quest_mother",
              transitions=[transition("stage_peace", flag("mother_pacified")),
                           transition("stage_bound", flag("mother_bound"))]),
        stage("stage_peace", "Пепельное согласие", "j_peace", quest="quest_mother",
              final=True, outcome="success"),
        stage("stage_bound", "Новое сердце", "j_bound", quest="quest_mother",
              final=True, outcome="success"),
    ],
})


def build_quests():
    return QUESTS
