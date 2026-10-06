#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""Привязывает нарисованные картинки к сценам и катсценам.

Фоны сцен пишутся в `states[0].image` (рисованная подложка `art` остаётся
запасником на случай, если файл не загрузится). Кадры катсцен — в
`slides[i].image`.

Запуск: python3 tools/patch_images.py
"""
import json
import os
import sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))

SCENES = {
    "scene_archive": "assets/img/scenes/scene_archive.jpg",
    "scene_gate_office": "assets/img/scenes/scene_gate_office.jpg",
}

CUTSCENES = {
    "cutscene_revelation": ["assets/img/cut_rev_1.jpg",
                            "assets/img/cut_rev_2.jpg",
                            "assets/img/cut_rev_3.jpg"],
    "cutscene_flood": ["assets/img/cut_flood_1.jpg"],
    "cutscene_final_pump": ["assets/img/cut_final_pump_1.jpg"],
    "cutscene_final_silence": ["assets/img/cut_final_silence_1.jpg"],
    "cutscene_final_vein": ["assets/img/cut_final_vein_1.jpg",
                            "assets/img/cut_final_vein_2.jpg"],
}


def load(rel):
    return json.load(open(os.path.join(ROOT, rel), encoding="utf-8"))


def save(rel, data):
    p = os.path.join(ROOT, rel)
    with open(p, "w", encoding="utf-8") as f:
        json.dump(data, f, ensure_ascii=False, indent=2)
        f.write("\n")


def main():
    bad = []
    for sid, img in SCENES.items():
        p = "scenes/%s.json" % sid
        if not os.path.exists(os.path.join(ROOT, img)):
            bad.append(img)
            continue
        d = load(p)
        d["states"][0]["image"] = img
        save(p, d)
        print(f"{sid}: фон {img}")

    for cid, imgs in CUTSCENES.items():
        p = "cutscenes/%s.json" % cid
        d = load(p)
        for i, img in enumerate(imgs):
            if i >= len(d["slides"]):
                bad.append(f"{cid} нет слайда {i}")
                continue
            if not os.path.exists(os.path.join(ROOT, img)):
                bad.append(img)
                continue
            d["slides"][i]["image"] = img
        save(p, d)
        print(f"{cid}: кадров {len(imgs)}")

    # что осталось без картинок
    man = load("manifest.json")
    noimg = [f[:-5] for f in man["scenes"]
             if not load("scenes/" + f)["states"][0].get("image")]
    nosl = []
    for f in man["cutscenes"]:
        d = load("cutscenes/" + f)
        miss = [i for i, s in enumerate(d["slides"]) if not s.get("image")]
        if miss:
            nosl.append(f"{f[:-5]}: слайды {miss}")
    print("\nсцен без фона:", noimg or "нет")
    print("катсцены без кадров:", "; ".join(nosl) or "нет")
    if bad:
        print("ПРОБЛЕМЫ:", bad)
    return 1 if bad else 0


if __name__ == "__main__":
    sys.exit(main())
