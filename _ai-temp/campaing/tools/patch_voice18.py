#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""Озвучка хода 18: десять дорожек.

Четыре реплики Жука, три Каст, новая реплика Каст про сшитое дело
(награда за механику подшивки улик из семнадцатого хода) и два слайда
катсцены потопа — они были единственными неозвученными слайдами.

Ремарки (`action: true`) в кампании не озвучиваются никогда: это текст
от автора, а не голос персонажа. Проверено: из 144 реплик ни одна ремарка
не имеет голоса.

Запуск: python3 tools/patch_voice18.py
"""
import json
import os
import sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))

# (диалог, начало текста реплики, файл)
LINES = [
    ("zhuk", "Келл со взводом, двенадцать человек", "assets/voice/zhuk_9.mp3"),
    ("zhuk", "Видел я много. Рассказываю", "assets/voice/zhuk_10.mp3"),
    ("zhuk", "Стража Келла, двенадцать человек", "assets/voice/zhuk_11.mp3"),
    ("zhuk", "Жук кривится, но рук не прячет", "assets/voice/zhuk_12.mp3"),
    ("kast", "Покажи.", "assets/voice/kast_12.mp3"),
    ("kast", "Вот и хорошо. Дело закрыто", "assets/voice/kast_13.mp3"),
    ("kast", "Молчишь? Я запишу", "assets/voice/kast_14.mp3"),
]

# новая ветка: Каст реагирует на сшитое дело
INK_CHOICE = '''+ { get_flag("case_full") } [Показать сшитое дело.]
    Она смотрит на нитку дольше, чем на сами листы. # action
    Ты сшил дело. Я видела три таких за двадцать лет: два закрыли, одно закрыло дознавателя. # emotion: thoughtful # voice: assets/voice/kast_15.mp3
    ~ set_flag("kast_case_shown")
    -> Начало_hub
'''

JSON_CHOICE = {
    "text": "Показать сшитое дело.",
    "sections": [{
        "steps": [
            {"kind": "line", "line": {
                "text": "Она смотрит на нитку дольше, чем на сами листы.",
                "action": True}},
            {"kind": "line", "line": {
                "text": "Ты сшил дело. Я видела три таких за двадцать лет: "
                        "два закрыли, одно закрыло дознавателя.",
                "emotion": "thoughtful",
                "voice": "assets/voice/kast_15.mp3"}},
            {"kind": "effect", "effect": {
                "type": "set_flag", "flag": "kast_case_shown"}},
        ]}],
    "goto": "stay",
    "conds": [{"type": "flag_set", "flag": "case_full"}],
}

FLOOD = ["assets/voice/flood_1.mp3", "assets/voice/flood_2.mp3"]


def load(rel):
    with open(os.path.join(ROOT, rel), encoding="utf-8") as f:
        return json.load(f)


def save(rel, data):
    with open(os.path.join(ROOT, rel), "w", encoding="utf-8") as f:
        json.dump(data, f, ensure_ascii=False, indent=2)
        f.write("\n")


def walk_json(o, out):
    if isinstance(o, dict):
        ln = o.get("line")
        if isinstance(ln, dict) and isinstance(ln.get("text"), str):
            out.append(ln)
        for v in o.values():
            walk_json(v, out)
    elif isinstance(o, list):
        for v in o:
            walk_json(v, out)


def patch_dlg(name, prefix, src):
    path = os.path.join(ROOT, "dialogues", name + ".dlg.json")
    doc = load("dialogues/%s.dlg.json" % name)
    lines = []
    walk_json(doc, lines)
    hits = [l for l in lines if l["text"].startswith(prefix)]
    for l in hits:
        l["voice"] = src
    save("dialogues/%s.dlg.json" % name, doc)
    return len(hits)


def patch_ink(name, prefix, src):
    path = os.path.join(ROOT, "dialogues", name + ".ink")
    with open(path, encoding="utf-8") as f:
        text = f.read()
    out, hits = [], 0
    for line in text.split("\n"):
        body = line.split(" #")[0].strip()
        if body.startswith(prefix) and "# voice:" not in line:
            hits += 1
            line = line.rstrip() + " # voice: " + src
        out.append(line)
    with open(path, "w", encoding="utf-8") as f:
        f.write("\n".join(out))
    return hits


def main():
    bad = 0
    for name, prefix, src in LINES:
        if not os.path.exists(os.path.join(ROOT, src)):
            print("НЕТ ФАЙЛА", src)
            bad += 1
            continue
        a = patch_dlg(name, prefix, src)
        b = patch_ink(name, prefix, src)
        if a < 1 or b < 1:
            bad += 1
        print(f"{name:5} json {a} | ink {b} | {src}")

    # новая ветка Каст
    ink_path = os.path.join(ROOT, "dialogues/kast.ink")
    text = open(ink_path, encoding="utf-8").read()
    if "Показать сшитое дело" not in text:
        anchor = "+ [Мне пора.]"
        text = text.replace(anchor, INK_CHOICE + anchor, 1)
        open(ink_path, "w", encoding="utf-8").write(text)
        print("kast.ink: новая ветка")
    doc = load("dialogues/kast.dlg.json")
    node = [n for n in doc["nodes"] if n["id"] == "Начало"][0]
    if not any(c.get("text") == JSON_CHOICE["text"] for c in node["choices"]):
        node["choices"].insert(len(node["choices"]) - 1, JSON_CHOICE)
        save("dialogues/kast.dlg.json", doc)
        print("kast.dlg.json: новая ветка")

    # слайды катсцены потопа
    cut = load("cutscenes/cutscene_flood.json")
    for slide, src in zip(cut["slides"], FLOOD):
        slide["voice"] = src
    save("cutscenes/cutscene_flood.json", cut)
    print("cutscene_flood: озвучено слайдов", len(FLOOD))

    # флаг ветки
    cam = load("campaign.json")
    if not any(f["id"] == "kast_case_shown" for f in cam["flags"]):
        cam["flags"].append({
            "id": "kast_case_shown",
            "label": "Сшитое дело показано Каст",
            "description": "Дознаватель показал инспектору дело №137, сшитое ниткой: она такие помнит."})
        cam["flags"].sort(key=lambda f: f["id"])
        save("campaign.json", cam)
        print("флаг kast_case_shown добавлен")

    print("проблемных:", bad)
    return 1 if bad else 0


if __name__ == "__main__":
    sys.exit(main())
