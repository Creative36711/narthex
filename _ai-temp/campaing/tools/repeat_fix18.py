#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""Ход 18: действия, которые можно нажимать бесконечно.

Мастер поймал: «Стол дознавателя → Разобрать бумаги» стоит час и
нажимается сколько угодно. Новичок жмёт несколько раз, тратит часы и сам
себе портит проход, не понимая этого.

Разбор всех 52 действий предметов показал одиннадцать платных бесконечных.
Они делятся на две группы.

**Выживание — повторять осмысленно, оставляем**: согреться у жаровни,
согреться у печи, вскипятить воду, поспать восемь часов. Потребности
падают со временем, поэтому греться и спать надо снова и снова; час —
честная цена. Им дописаны подсказки с явной ценой, чтобы час был виден
до нажатия.

**Информация и прогресс — повторять нечего, а час списывался**: разбор
бумаг, дело №136 (дважды: в шкафу и на полке), сводка по помпам, осмотр
механизма затвора, взлом крышки схрона, перекрытие узла. Первый раз стоит
часа — бумаги в самом деле лежат внавалку, — а вот второй раз ничего не
даёт. Здесь два приёма:
  * `once: true` — действие исчезает после первого раза (для тех, где
    результат остаётся навсегда: запись кодекса, улика, открытый схрон);
  * «платно в первый раз, бесплатно потом» — к осмотру добавляется
    короткий бесплатный повтор, чтобы важную подсказку (про пустую колодку
    затвора, про срок дела) можно было перечитать, не платя часом.

Отдельно: «Перекрыть узел» теперь ставит флаг `pipes_closed` — раньше
успех вообще нигде не отмечался, и узел можно было «перекрывать» бесконечно,
каждый раз рискуя порезать ладонь. «Спуститься по лестнице» прячется после
того, как клапан найден: иначе клапан выдавался по новому на каждый спуск.

Скрипт перезапускаемый.

Запуск: python3 tools/repeat_fix18.py
"""
import json
import os

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))

FLAGS = [
    ("desk_sorted", "Бумаги разобраны",
     "Дознаватель разобрал стол: час ушёл на чужие бумаги, шапку дела можно перечитывать бесплатно."),
    ("pipes_closed", "Узел перекрыт",
     "Дознаватель перекрыл узел на трубе: испарения ушли вверх, нижний ярус стало можно дышать."),
]

# что дописать к действиям
ONCE = [
    ("item_case", "Поднять дело №136"),
    ("item_shelf", "Взять сводку по седьмой помпе"),
    ("item_shelf", "Прочитать дело №136"),
    ("item_sluice_mech", "Осмотреть механизм"),
    ("item_desk", "Разобрать бумаги"),
]

COND_NOT_SET = [
    ("item_cache", "Взломать крышку", "cache_open"),
    ("item_pipes", "Перекрыть узел", "pipes_closed"),
    ("item_ladder", "Спуститься по лестнице", "valve_found"),
]

HINTS = [
    ("item_brazier", "Согреться у жаровни", "час у жаровни: +35 к теплу"),
    ("item_stove", "Согреться", "час у печи: +40 к теплу, от гнильца не лечит"),
    ("item_stove", "Вскипятить воду", "час на кипяток: снимает жажду"),
    ("item_cot", "Поспать восемь часов",
     "восемь часов из семидесяти двух: сон лечит, снимает усталость и восполняет удачу"),
    ("item_desk", "Разобрать бумаги", "час на разбор: бумаги лежат внавалку с прошлого дознавателя"),
    ("item_shelf", "Прочитать дело №136", "час на чужое дело"),
    ("item_pipes", "Перекрыть узел",
     "ремонт 45: перекроешь — воздух станет чище, сорвёшь — порежешься. Повторно не нужно"),
]

DEADLINE = ("Семьдесят два часа на дело. Счёт пошёл в семь утра, когда ты сошёл с клетки "
            "на седьмой ярус: полтора суток после того, как помпа встала. У Надзора это "
            "называется «срок дознания», и его не продлевают.")

# бесплатные повторы (добавляются после платного действия)
FREE_REPEATS = [
    ("item_desk", {
        "label": "Перечитать шапку дела",
        "conditions": [{"type": "flag_set", "flag": "desk_sorted"}],
        "effects": [{"type": "show_message", "text": DEADLINE}],
        "sound": "snd_paper",
        "hint": "перечитать можно бесплатно: срок и фабула",
    }),
    ("item_sluice_mech", {
        "label": "Ещё раз осмотреть колодку",
        "conditions": [{"type": "flag_set", "flag": "sluice_seen"}],
        "effects": [{"type": "show_message",
                     "text": "Колодка под клапан пуста и стоит так не первый месяц: кто-то вынул "
                             "клапан заранее и положил туда, где его найдут не сразу."}],
        "sound": "snd_chain",
        "hint": "перечитать можно бесплатно: без клапана затвор не закрыть",
    }),
]


def load(rel):
    with open(os.path.join(ROOT, rel), encoding="utf-8") as f:
        return json.load(f)


def save(rel, data):
    with open(os.path.join(ROOT, rel), "w", encoding="utf-8") as f:
        json.dump(data, f, ensure_ascii=False, indent=2)
        f.write("\n")


def find(doc, label):
    for i, o in enumerate(doc.get("interact_options") or []):
        if o.get("label") == label:
            return i, o
    return None, None


def main():
    cam = load("campaign.json")
    for fid, label, desc in FLAGS:
        if not any(f["id"] == fid for f in cam["flags"]):
            cam["flags"].append({"id": fid, "label": label, "description": desc})
    cam["flags"].sort(key=lambda f: f["id"])
    save("campaign.json", cam)
    print("флагов:", len(cam["flags"]))

    for ent, label in ONCE:
        path = "entities/%s.json" % ent
        d = load(path)
        i, o = find(d, label)
        if o is None:
            print("  НЕ НАЙДЕНО", ent, label)
            continue
        o["once"] = True
        if ent == "item_desk":  # результат разбора остаётся навсегда
            o["effects"].insert(1, {"type": "set_flag", "flag": "desk_sorted"})
        save(path, d)
        print(f"  once: {ent} / {label}")

    for ent, label, flag in COND_NOT_SET:
        path = "entities/%s.json" % ent
        d = load(path)
        i, o = find(d, label)
        if o is None:
            print("  НЕ НАЙДЕНО", ent, label)
            continue
        o["conditions"] = [{"type": "flag_not_set", "flag": flag}]
        if ent == "item_pipes":  # успех теперь отмечается
            for e in o.get("effects") or []:
                if e.get("type") == "skill_check_gate":
                    se = e.setdefault("success_effects", [])
                    if not any(x.get("type") == "set_flag" for x in se):
                        se.insert(0, {"type": "set_flag", "flag": "pipes_closed"})
                        se.insert(1, {"type": "grant_xp", "points": 10})
        save(path, d)
        print(f"  условие {flag}: {ent} / {label}")

    for ent, label, hint in HINTS:
        path = "entities/%s.json" % ent
        d = load(path)
        i, o = find(d, label)
        if o is not None:
            o["hint"] = hint
            save(path, d)
    print("подсказок с ценой:", len(HINTS))

    for ent, opt in FREE_REPEATS:
        path = "entities/%s.json" % ent
        d = load(path)
        opts = d.setdefault("interact_options", [])
        if not any(o.get("label") == opt["label"] for o in opts):
            opts.append(opt)
            save(path, d)
            print(f"  бесплатный повтор: {ent} / {opt['label']}")


if __name__ == "__main__":
    main()
