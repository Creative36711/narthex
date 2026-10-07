#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""Озвучка хода 17: привязка девяти новых дорожек к репликам.

Дорожки начитаны голосами, которыми уже говорят эти персонажи, — сверено
спектральным отпечатком (новый клип против старых файлов того же героя).
Правятся оба источника: `.dlg.json` (поле `voice` у реплики) и `.ink`
(строчный тег `# voice:`), потому что конструктор диалогов собирает ink
из json, а движок исполняет ink.

Запуск: python3 tools/patch_voice17.py
"""
import json
import os
import sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))

# (диалог, начало текста реплики, файл)
LINES = [
    ("kell", "На седьмом. Стоял, как велено", "assets/voice/kell_11.mp3"),
    ("kell", "Хорошая вещь, если ты не из тех", "assets/voice/kell_12.mp3"),
    ("dozh", "Ну наконец-то. Смотри, не трогай руками", "assets/voice/dozh_10.mp3"),
    ("dozh", "Руки показывай, когда они полные", "assets/voice/dozh_11.mp3"),
    ("ira", "У меня был второй, на случай смены", "assets/voice/ira_12.mp3"),
    ("ira", "У нас был один ключ", "assets/voice/ira_13.mp3"),
    ("ira", "Говори. Ты же не просто так спросил", "assets/voice/ira_14.mp3"),
    ("vex", "Записи я веду, а не пересказываю", "assets/voice/vex_9.mp3"),
    ("resh", "Бери. Только сначала почини затвор", "assets/voice/resh_11.mp3"),
]


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
    with open(path, encoding="utf-8") as f:
        doc = json.load(f)
    lines = []
    walk_json(doc, lines)
    hits = [l for l in lines if l["text"].startswith(prefix)]
    for l in hits:
        l["voice"] = src
    with open(path, "w", encoding="utf-8") as f:
        json.dump(doc, f, ensure_ascii=False, indent=2)
        f.write("\n")
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
            if line.endswith(")"):  # за строкой выбора — не наше
                pass
            line = line.rstrip() + " # voice: " + src
        out.append(line)
    with open(path, "w", encoding="utf-8") as f:
        f.write("\n".join(out))
    return hits


def main():
    bad = 0
    for name, prefix, src in LINES:
        full = os.path.join(ROOT, src)
        if not os.path.exists(full):
            print(f"НЕТ ФАЙЛА {src}")
            bad += 1
            continue
        a = patch_dlg(name, prefix, src)
        b = patch_ink(name, prefix, src)
        flag = "" if a >= 1 and b >= 1 else "  ← ПРОВЕРИТЬ!"
        if a < 1 or b < 1:
            bad += 1
        print(f"{name:5} json {a} | ink {b} | {src}{flag}")
    print("проблемных:", bad)
    return 1 if bad else 0


if __name__ == "__main__":
    sys.exit(main())
