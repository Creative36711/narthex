#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""Правки по жалобам мастера (ход 17).

1. Кнопка «Записать в дело №137» в конторе дознавателя: звук был, а
   видимой реакции не было — запись публиковалась, но она уже лежала в
   журнале с самого начала дела (её печатает первая стадия квеста),
   сообщения не было, а час времени, обещанный в подсказке, не списывался.
   Теперь кнопка одноразовая, списывает час, показывает сообщение и даёт
   опыт. Плюс новая механика: улики можно подшивать в дело, а когда их
   наберётся три — сшить дело и открыть запись кодекса.
2. Рукописный шрифт (журнал, архив, кодекс) читался плохо: Marck Script —
   мелкий курсив с росчерками. Заменён на Neucha: та же рукописность, но
   строчные на треть крупнее и контрастнее.
3. У панелей «Дело №137» и «Хроника» не было своих звуков: добавлены
   отдельные записи на открытие и на закрытие для всех шести панелей.

Скрипт перезапускаемый: всё меняется по id, повторный запуск ничего не ломает.

Запуск: python3 tools/ux_fix_17.py
"""
import json
import os

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))


def load(rel):
    with open(os.path.join(ROOT, rel), encoding="utf-8") as f:
        return json.load(f)


def save(rel, data):
    with open(os.path.join(ROOT, rel), "w", encoding="utf-8") as f:
        json.dump(data, f, ensure_ascii=False, indent=2)
        f.write("\n")


def upsert(arr, key, obj):
    for i, item in enumerate(arr):
        if item.get(key) == obj[key]:
            arr[i] = obj
            return False
    arr.append(obj)
    return True


# ── 1. флаги ────────────────────────────────────────────────────────────────
FLAGS = [
    ("case_written", "Шапка дела переписана",
     "Дознаватель сел за бумагу и сформулировал дело №137 своей рукой: час времени, запись в журнале, пять опыта."),
    ("case_filed_token", "В дело подшит жетон",
     "Жетон стража Стася Ярова пришит к делу №137."),
    ("case_filed_ledger", "В дело подшит гроссбух",
     "Лист из гроссбуха седьмой помпы пришит к делу №137: расход на «режим тишины» с подписью Каст."),
    ("case_filed_note", "В дело подшита записка",
     "Записка мастера Реша пришита к делу №137."),
    ("case_filed_roster", "В дело подшит наряд",
     "Наряд стражи на ночь тринадцатого пришит к делу №137."),
    ("case_full", "Дело сшито",
     "Три улики подшиты, дело сшито ниткой: открыта запись кодекса «Дело №137»."),
]

# ── 2. звуки ────────────────────────────────────────────────────────────────
SOUNDS = [
    ("sfx_journal_open", "Дело раскрыто", "assets/audio/sfx/sfx_journal_open.ogg"),
    ("sfx_journal_close", "Дело закрыто", "assets/audio/sfx/sfx_journal_close.ogg"),
    ("sfx_archive_open", "Папка архива", "assets/audio/sfx/sfx_archive_open.ogg"),
    ("sfx_archive_close", "Папка закрыта", "assets/audio/sfx/sfx_archive_close.ogg"),
    ("sfx_log_open", "Хроника: лист", "assets/audio/sfx/sfx_log_open.ogg"),
    ("sfx_log_close", "Хроника: лист убран", "assets/audio/sfx/sfx_log_close.ogg"),
    ("sfx_file", "Бумага в папку", "assets/audio/sfx/sfx_file.ogg"),
    ("sfx_bag_close", "Сумка закрыта", "assets/audio/sfx/sfx_bag_close.ogg"),
]

PANELS = {
    "panel:journal": "sfx_journal_open",
    "panel:journal:close": "sfx_journal_close",
    "panel:quest": "sfx_journal_open",
    "panel:quest:close": "sfx_journal_close",
    "panel:quests": "sfx_journal_open",
    "panel:quests:close": "sfx_journal_close",
    "panel:codex": "sfx_archive_open",
    "panel:codex:close": "sfx_archive_close",
    "panel:log": "sfx_log_open",
    "panel:log:close": "sfx_log_close",
    "panel:chronicle": "sfx_log_open",
    "panel:chronicle:close": "sfx_log_close",
    "panel:map": "snd_paper",
    "panel:map:close": "sfx_flip",
    "panel:inventory": "snd_cloth",
    "panel:inventory:close": "sfx_bag_close",
    "panel:character": "snd_cloth",
    "panel:character:close": "sfx_bag_close",
    "panel:craft": "sfx_anvil",
    "panel:craft:close": "snd_latch",
}

# ── 3. записи журнала ───────────────────────────────────────────────────────
JOURNAL = {
    "j_hand": "Своей рукой: седьмая помпа стоит с девятнадцати десяти тринадцатого, мастер Эрдан Реш ушёл в штольню и не вышел, срок — семьдесят два часа. Пока формулировка твоя, за неё отвечаешь ты. Потом её перепишут.",
    "j_token": "К делу пришит жетон стража Стася Ярова. Номер не списан: человек числится в смене тринадцатого, хотя в сводке его нет.",
    "j_ledger": "К делу пришит лист из гроссбуха седьмой помпы: расход на «режим тишины» выписан за два дня до того, как помпа встала, и подписан инспектором Каст.",
    "j_note": "К делу пришита записка мастера: «Муфту срезали изнутри, а не сорвало. Если со мной что случится — ищите, кто выписал наряд на ночь тринадцатого».",
    "j_roster": "К делу пришит наряд стражи: в ночь тринадцатого на седьмом ярусе стоял взвод Келла Ястреба, двенадцать человек, без пометки о смене.",
    "j_full": "Дело сшито: шапка, улики, подпись дознавателя. Его можно нести наверх — или оставить в шкафу, где лежат остальные. Второй вариант на Надзор действует вернее.",
}

# ── 4. варианты взаимодействия со шкафом ────────────────────────────────────
def filed(flag, key, label, item, message):
    return {
        "label": label,
        "conditions": [
            {"type": "has_item", "item": item},
            {"type": "flag_not_set", "flag": flag},
        ],
        "once": True,
        "effects": [
            {"type": "set_flag", "flag": flag},
            {"type": "journal_update", "quest": "quest_pump", "text_key": key},
            {"type": "grant_xp", "points": 5},
        ],
        "message": message,
        "sound": "sfx_file",
        "sound_volume": 0.8,
        "hint": "улика останется в деле навсегда",
    }


def combo(*flags):
    return {"type": "and", "conditions": [{"type": "flag_set", "flag": f} for f in flags]}


A, B, C, D = ("case_filed_token", "case_filed_ledger",
              "case_filed_note", "case_filed_roster")

OPTIONS = [
    {
        "label": "Поднять дело №136",
        "effects": [
            {"type": "unlock_codex", "entry": "codex_case136"},
            {"type": "advance_time", "ticks": 1},
        ],
        "message": "Папка тонкая: три листа, подпись Каст и пометка «исполнено».",
        "sound": "snd_paper",
        "hint": "час на чужое дело: из него понятно, чем кончают такие бумаги",
    },
    {
        "label": "Записать в дело №137",
        "once": True,
        "effects": [
            {"type": "advance_time", "ticks": 1},
            {"type": "set_flag", "flag": "case_written"},
            {"type": "journal_update", "quest": "quest_pump", "text_key": "j_hand"},
            {"type": "grant_xp", "points": 5},
        ],
        "message": "Час ушёл на бумагу. Ты переписываешь шапку так, как видишь её сам: не «причина уточняется», а «пока стоит — девятый сухой». Запись ложится в журнал дела, и пока она там — за слова отвечаешь ты.",
        "sound": "sfx_flip",
        "sound_volume": 0.7,
        "hint": "час времени и пять опыта: формулировка останется твоей",
    },
    filed(A, "j_token", "Пришить жетон Ярова", "item_guard_token",
          "Жетон ложится в папку тусклой стороной вверх. Тяжёлая вода съела номер наполовину, но прочитать можно: человек числился в смене тринадцатого."),
    filed(B, "j_ledger", "Пришить лист из гроссбуха", "item_ledger",
          "Ты подшиваешь не всю книгу, а один вырванный лист: расход на «режим тишины» и аккуратная подпись Каст. Остальное в деле не нужно — и опасно."),
    filed(C, "j_note", "Пришить записку мастера", "item_note",
          "Записку кладёшь в чистый лист, чтобы не истёрлась на сгибе: «Муфту срезали изнутри, а не сорвало»."),
    filed(D, "j_roster", "Пришить наряд стражи", "item_roster",
          "Наряд ложится последним листом: двенадцать человек, взвод Келла Ястреба, пометки о смене нет."),
    {
        "label": "Сшить дело",
        "conditions": [
            {"type": "flag_not_set", "flag": "case_full"},
            {"type": "or", "conditions": [
                combo(A, B, C), combo(A, B, D), combo(A, C, D), combo(B, C, D),
            ]},
        ],
        "once": True,
        "effects": [
            {"type": "set_flag", "flag": "case_full"},
            {"type": "journal_update", "quest": "quest_pump", "text_key": "j_full"},
            {"type": "unlock_codex", "entry": "codex_case137"},
            {"type": "grant_xp", "points": 20},
            {"type": "play_sound", "sound": "sfx_book", "volume": 0.8},
            {"type": "banner", "text": "Дело сшито", "preset": "записочный", "seconds": 3},
            {"type": "show_message", "text": "Ты прокалываешь листы шилом и протягиваешь суровую нитку — так учили в первый год службы. Дело №137 теперь существует отдельно от тебя: его можно нести наверх или оставить в шкафу, где лежат остальные."},
        ],
        "sound": "sfx_book",
        "sound_volume": 0.8,
        "hint": "три улики подшиты — пора подшивать обложку",
    },
    {
        "label": "Сверить сводку по помпам",
        "effects": [
            {"type": "show_message",
             "text": "Сводка: семь помп, шесть в работе. Седьмая — «причина уточняется», третий день."},
        ],
        "sound": "snd_page",
        "hint": "семь помп: в сводке считают те, что работают",
    },
    {
        "label": "Прочесть устав Надзора",
        "hint": "То, чем тебя три года кормили на службе",
        "sound": "snd_page",
        "once": True,
        "effects": [
            {"type": "skill_check_gate", "skill": "lore", "difficulty": 50,
             "success_effects": [
                 {"type": "unlock_codex", "entry": "codex_nadzor"},
                 {"type": "grant_xp", "points": 10},
                 {"type": "show_message", "text": "Пункт девятый: в интересах яруса. Пункт двенадцатый: дознаватель отвечает за достоверность записи, а не за её справедливость. Ты читаешь это впервые за три года службы — и понимаешь, зачем тебя сюда послали."},
             ],
             "fail_effects": [
                 {"type": "show_message", "text": "Устав напечатан мелко и скучно. Через полстраницы глаза начинают искать, чем бы заняться ещё."},
             ]},
        ],
    },
]

CODEX_137 = {
    "id": "codex_case137",
    "label": "Дело №137",
    "category": "chronicles",
    "text": "Дело, собранное тобой, а не присланное сверху. Три улики сходятся в одну точку: муфту срезали изнутри, наряд на ночь тринадцатого выписан заранее, а жилу на девятом ярусе брали, пока седьмая помпа стояла и считалась мёртвой. "
            "Дело №136 учит, чем это кончается: три листа, ни одной фамилии, пометка «исполнено». У тебя фамилии есть — и поэтому у дела №137 другая судьба.",
}


def main():
    # campaign.json
    cam = load("campaign.json")
    for fid, label, desc in FLAGS:
        upsert(cam["flags"], "id", {"id": fid, "label": label, "description": desc})
    cam["flags"].sort(key=lambda f: f["id"])
    for sid, label, src in SOUNDS:
        upsert(cam["sounds"], "id", {"id": sid, "label": label, "src": src})
    cam["sounds"].sort(key=lambda s: s["id"])
    cam["ui_sounds"].update(PANELS)
    # рукописный шрифт
    upsert(cam["fonts"], "id", {
        "id": "font_hand", "label": "Neucha", "src": "assets/fonts/neucha-400.woff2",
        "weight": "400", "style": "normal"})
    upsert(cam["fonts"], "id", {
        "id": "font_hand_cursive", "label": "Marck Script",
        "src": "assets/fonts/marck-script-400.woff2", "weight": "400", "style": "normal"})
    save("campaign.json", cam)
    print("campaign.json: флагов %d, звуков %d, хуков панелей %d"
          % (len(cam["flags"]), len(cam["sounds"]), len(cam["ui_sounds"])))

    # журнал дела
    q = load("quests/quest_pump.json")
    q["journal_entries"].update(JOURNAL)
    save("quests/quest_pump.json", q)
    print("quest_pump.json: записей в журнале %d" % len(q["journal_entries"]))

    # шкаф с делами
    case = load("entities/item_case.json")
    case["interact_options"] = OPTIONS
    case["interact_hint"] = "Открыть папку дела"
    save("entities/item_case.json", case)
    print("item_case.json: действий %d" % len(OPTIONS))

    # запись кодекса
    save("codex/codex_case137.json", CODEX_137)
    man = load("manifest.json")
    if "codex_case137.json" not in man["codex"]:
        man["codex"].append("codex_case137.json")
        save("manifest.json", man)
    print("кодекс: %d записей" % len(man["codex"]))


if __name__ == "__main__":
    main()
