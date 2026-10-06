#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""Правка сюжетной логики (ход 10).

Найденное противоречие: катсцена «ночь тринадцатого» рассказывала события в
порядке 18:40 → 20:00 (взвод) → 20:10 (помпа встаёт), а все остальные
источники — Ира, правило rule_ira_story и документ дизайна — говорят, что
помпа встала в 19:10, то есть ДО того, как взвод вошёл в зал. Это важно:
именно дырка между 19:10 и 20:00 и есть дело (правило так и пишет: «дырка в
двадцать минут, в которую поместилось всё дело»).

Что делает скрипт:
  * ставит слайды катсцены в правильный порядок (19:10 → 20:00);
  * правит время в тексте слайда и в описании катсцены.

Внимание: голосовая дорожка третьего слайда (`rev_3.mp3`) была начитана со
старым числом «двадцать десять» — она перезаписывается следующим ходом, в
плане это отмечено отдельной строкой.

Запуск: python3 tools/story_fix.py
"""
import json
import os
import sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))


def load(p):
    return json.load(open(os.path.join(ROOT, p), encoding="utf-8"))


def save(p, o):
    with open(os.path.join(ROOT, p), "w", encoding="utf-8") as f:
        json.dump(o, f, ensure_ascii=False, indent=1)
        f.write("\n")


def main():
    os.chdir(ROOT)
    p = "cutscenes/cutscene_revelation.json"
    c = load(p)
    slides = c["slides"]
    if len(slides) != 3:
        print("неожиданное число слайдов:", len(slides))
        return 1

    pump, squad = None, None
    for s in slides:
        if "Помпа встаёт" in s.get("text", ""):
            pump = s
        if "взвод Келла" in s.get("text", ""):
            squad = s
    if not pump or not squad:
        print("слайды не распознаны")
        return 1

    # верный порядок: 18:40 мастер спускается → 19:10 помпа встаёт → 20:00 взвод
    pump["text"] = pump["text"].replace("Двадцать десять", "Девятнадцать десять")
    ordered = [slides[0], pump, squad]
    if ordered != slides:
        c["slides"] = ordered
        save(p, c)
    print("порядок слайдов:")
    for i, s in enumerate(c["slides"]):
        print(f"   [{i}] {s['text'][:70]}…")
        print(f"        голос: {s.get('voice')}, кадр: {s.get('image')}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
