#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""Новый контент хода 10: улички, которые можно добыть, и записи кодекса.

Зачем: опыта в кампании было 375 при 400 до пятого уровня — максимум уровня
был недостижим ни при какой игре. Пять новых действий с проверками закрывают
разрыв (+50) и заодно дают игроку то, чего не хватало: возможность
самостоятельно добыть знание, а не получить его из реплики.

Что добавляет скрипт:
  * две записи кодекса: «Пломба тринадцать-К» и «Надзор»;
  * пять действий у предметов со проверками навыка, опытом и уличками;
  * два новых события в таблицах встреч (находки в пути).

Скрипт идемпотентен: повторный запуск ничего не дублирует.
Запуск: python3 tools/content_add.py
"""
import json
import os
import sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))

CODEX = [
    {"file": "codex_seal.json",
     "entry": {"id": "codex_seal", "label": "Пломба тринадцать-К",
               "category": "chronicles",
               "text": "Свинцовая пломба стражи: номер наряда и литера яруса. "
                       "Пломбу ставят на рукавицы тем, кому поручено закрыть "
                       "ярус, и снимают только после отчёта. Пломба без наряда "
                       "в ведомости — не улика, а должностное преступление: "
                       "её номер либо выписан задним числом, либо выписан на "
                       "того, кто уже не ответит. Тринадцатая литера означает "
                       "«ночная смена, особый порядок»: такие наряды подписывает "
                       "не старшина, а инспектор."}},
    {"file": "codex_nadzor.json",
     "entry": {"id": "codex_nadzor", "label": "Надзор", "category": "places",
               "text": "Ведомство, которое держит город сухим и держит его в "
                       "страхе. Девять ярусов, семь помп, одна книга расхода на "
                       "каждую. Надзор не решает, кто виноват: он решает, что "
                       "записать. Отсюда формула приёмной — «назовите номер»: "
                       "то, чего нет в книге, в Каркасе не происходило. "
                       "Дознаватель — самая дешёвая должность в ведомстве: его "
                       "посылают туда, куда стражник не пойдёт, и списывают "
                       "первым, если бумага не сойдётся."}},
]

# предмет -> новое действие
OPTIONS = [
    ("item_plate", {
        "label": "Сверить пломбу с ведомостью",
        "hint": "Номер наряда должен быть в книге",
        "sound": "snd_tag", "once": True,
        "effects": [{
            "type": "skill_check_gate", "skill": "lore", "difficulty": 45,
            "success_effects": [
                {"type": "unlock_codex", "entry": "codex_seal"},
                {"type": "grant_xp", "points": 10},
                {"type": "show_message",
                 "text": "Тринадцать-К — литера ночной смены особого порядка. "
                         "Такой наряд подписывает не старшина, а инспектор: "
                         "значит, в ту ночь Келл был не первым, а вторым."}],
            "fail_effects": [
                {"type": "show_message",
                 "text": "Пломба как пломба: свинец, номер, вдавленный край. "
                         "Что с ней делать, ты пока не знаешь."}]}]}),
    ("item_case", {
        "label": "Прочесть устав Надзора",
        "hint": "То, чем тебя три года кормили на службе",
        "sound": "snd_page", "once": True,
        "effects": [{
            "type": "skill_check_gate", "skill": "lore", "difficulty": 50,
            "success_effects": [
                {"type": "unlock_codex", "entry": "codex_nadzor"},
                {"type": "grant_xp", "points": 10},
                {"type": "show_message",
                 "text": "Пункт девятый: в интересах яруса. Пункт двенадцатый: "
                         "дознаватель отвечает за достоверность записи, а не за "
                         "её справедливость. Ты читаешь это впервые за три года "
                         "службы — и понимаешь, зачем тебя сюда послали."}],
            "fail_effects": [
                {"type": "show_message",
                 "text": "Устав напечатан мелко и скучно. Через полстраницы "
                         "глаза начинают искать, чем бы заняться ещё."}]}]}),
    ("item_dead_guard", {
        "label": "Сверить жетон со списком смены",
        "hint": "Номер должен быть в расписании",
        "sound": "snd_paper", "once": True,
        "effects": [{
            "type": "skill_check_gate", "skill": "investigate", "difficulty": 45,
            "success_effects": [
                {"type": "grant_xp", "points": 10},
                {"type": "show_message",
                 "text": "Стась Яров стоит в смене с восемнадцати до двух, "
                         "место — затвор восьмого. В два часа его в списке нет, "
                         "а затвор к утру закрыт. То есть закрывал он, и закрывал "
                         "не по своей смене."}],
            "fail_effects": [
                {"type": "show_message",
                 "text": "Список смены исписан карандашом и потёрт: номер "
                         "Ярова теряется среди чужих фамилий."}]}]}),
    ("item_pump_engine", {
        "label": "Снять слепок с муфты",
        "hint": "Срез что-то скажет о том, кто его делал",
        "sound": "sfx_gear", "once": True,
        "effects": [{
            "type": "skill_check_gate", "skill": "repair", "difficulty": 50,
            "success_effects": [
                {"type": "grant_xp", "points": 10},
                {"type": "show_message",
                 "text": "Срез ровный, по метке, с фаской: её снимали ключом на "
                         "пятьдесят два, а не рвало нагрузкой. Такую работу "
                         "делают не в спешке и не впервые."}],
            "fail_effects": [
                {"type": "show_message",
                 "text": "Мазут забил всё: слепок выходит комом, по нему "
                         "ничего не прочитать."}]}]}),
    ("item_board", {
        "label": "Сверить сводку седьмой помпы",
        "hint": "Сводка висит сверху, поверх объявлений",
        "sound": "snd_paper", "once": True,
        "effects": [{
            "type": "skill_check_gate", "skill": "lore", "difficulty": 40,
            "success_effects": [
                {"type": "grant_xp", "points": 10},
                {"type": "show_message",
                 "text": "Сводка за месяц: расход мазута на седьмой вырос на "
                         "треть, наряд на работы — на девятый. Помпу не "
                         "запускали не потому, что она сломалась: её берегли для "
                         "того, что нашли внизу."}],
            "fail_effects": [
                {"type": "show_message",
                 "text": "Цифры в сводке сходятся, но ты не понимаешь, что "
                         "именно они складывают."}]}]}),
]

# находки в пути: таблица -> новая запись события
EVENTS = [
    ("enc_gallery", {
        "weight": 1, "type": "event",
        "message": "В нише за трубой — чужой тайник: банка с маслом и моток проволоки.",
        "effects": [{"type": "add_item", "item": "item_oil", "quantity": 1},
                    {"type": "add_item", "item": "item_scrap", "quantity": 1}]}),
    ("enc_deep", {
        "weight": 1, "type": "event",
        "message": "У рельса стоит ведро с чистой водой: нижние оставляют его для своих.",
        "effects": [{"type": "add_item", "item": "item_water", "quantity": 1}]}),
]


def load(p):
    return json.load(open(os.path.join(ROOT, p), encoding="utf-8"))


def save(p, o):
    with open(os.path.join(ROOT, p), "w", encoding="utf-8") as f:
        json.dump(o, f, ensure_ascii=False, indent=2)
        f.write("\n")


def main():
    os.chdir(ROOT)

    print("== записи кодекса:")
    man = load("manifest.json")
    for c in CODEX:
        path = "codex/" + c["file"]
        if not os.path.exists(path):
            save(path, c["entry"])
        if c["file"] not in man["codex"]:
            man["codex"].append(c["file"])
        print(f"   {c['entry']['id']:16s} {c['entry']['label']}")
    save("manifest.json", man)

    print("== новые действия:")
    for eid, opt in OPTIONS:
        p = f"entities/{eid}.json"
        d = load(p)
        opts = d.setdefault("interact_options", [])
        if any(o.get("label") == opt["label"] for o in opts):
            print(f"   {eid}: «{opt['label']}» уже есть")
            continue
        opts.append(opt)
        save(p, d)
        print(f"   {eid:18s} «{opt['label']}»")

    print("== события в пути:")
    p = "rules/encounters.json"
    enc = load(p)
    for tid, entry in EVENTS:
        for t in enc["encounter_tables"]:
            if t["id"] != tid:
                continue
            if any(e.get("message") == entry["message"] for e in t["entries"]):
                print(f"   {tid}: уже есть")
                continue
            t["entries"].append(entry)
            total = sum(e.get("weight", 0) for e in t["entries"])
            print(f"   {tid}: +событие (вес {entry['weight']} из {total})")
    save(p, enc)

    # итог по опыту
    import re
    tot = 0
    for root, _, files in os.walk("."):
        if any(x in root for x in ("assets", "__chronicle_ai__", ".git", "tools")):
            continue
        for f in files:
            if f.endswith(".json"):
                s = open(os.path.join(root, f), encoding="utf-8").read()
                tot += sum(int(x) for x in re.findall(r'"grant_xp",\s*"points":\s*(\d+)', s))
    print(f"== опыта в кампании: {tot} (до пятого уровня нужно 400)")
    return 0


if __name__ == "__main__":
    sys.exit(main())
