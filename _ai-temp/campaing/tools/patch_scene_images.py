#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""Подключает отрисованные фоны к состояниям сцен.

Фон кладётся в `states[0].image`; нарисованный примитивами `art` остаётся
в состоянии как запасной вид для редактора (движок показывает image).
Запуск: python3 tools/patch_scene_images.py
"""
import json
import os

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SCENES = os.path.join(ROOT, "scenes")
IMG = "assets/img/scenes/{sid}.jpg"


def main():
    done, skipped = [], []
    for f in sorted(os.listdir(SCENES)):
        if not f.endswith(".json"):
            continue
        sid = f[:-5]
        path = IMG.format(sid=sid)
        if not os.path.exists(os.path.join(ROOT, path)):
            skipped.append(sid)
            continue
        p = os.path.join(SCENES, f)
        s = json.load(open(p, encoding="utf-8"))
        if not s.get("states"):
            skipped.append(sid + " (нет состояний)")
            continue
        s["states"][0]["image"] = path
        with open(p, "w", encoding="utf-8") as fh:
            json.dump(s, fh, ensure_ascii=False, indent=1)
        done.append(sid)
    print("фоны подключены:", ", ".join(done))
    print("без фона:", ", ".join(skipped) or "нет")


if __name__ == "__main__":
    main()
