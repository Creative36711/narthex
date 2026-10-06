#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""Пятая волна звука: закрываем последние «молчащие» действия.

В кампании осталось семь действий предметов без звука (`interact_options[].sound`).
Берём четыре записи из CC0-набора Kenney (подборка Cy4nWare/sfx-api),
кладём рядом с остальными звуками, регистрируем в `campaign.sounds` и
развешиваем по действиям. Ничего не синтезируем: только копии записей.

Запуск: python3 tools/audio_build5.py
"""
import json
import os
import shutil
import sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SFX = "/tmp/sfx/sounds"  # Kenney CC0 (клон Cy4nWare/sfx-api)

NEW = [
    # id          файл Kenney                              подпись
    ("snd_knock", "impact-sounds/impactmetal-heavy-000.ogg", "Стук в металл"),
    ("snd_charge", "rpg-audio/metallatch.ogg", "Защёлка заряда"),
    ("snd_vent", "sci-fi-sounds/dooropen-000.ogg", "Воздух в вентиляции"),
    ("snd_tag", "rpg-audio/metalclick.ogg", "Метка на металле"),
]

# действие → звук (id предмета, подпись действия, звук)
WIRE = [
    ("item_brazier", "Согреться у жаровни", "snd_pot"),
    ("item_dead_guard", "Обыскать карманы", "snd_cloth"),
    ("item_desk", "Проверить снаряжение", "snd_latch"),
    ("item_marker", "Прочесть метку", "snd_tag"),
    ("item_resh_door", "Постучать", "snd_knock"),
    ("item_sluice_mech", "Заложить заряд", "snd_charge"),
    ("item_vent", "Прислушаться", "snd_vent"),
]


def main():
    os.chdir(ROOT)
    if not os.path.isdir(SFX):
        sys.exit(f"нет каталога {SFX}: git clone --depth 1 "
                 "https://github.com/Cy4nWare/sfx-api.git /tmp/sfx")

    dst_dir = os.path.join(ROOT, "assets/audio/sfx")
    os.makedirs(dst_dir, exist_ok=True)
    reg = []
    for sid, src, label in NEW:
        src_p = os.path.join(SFX, src)
        if not os.path.exists(src_p):
            sys.exit(f"нет файла {src_p}")
        dst = os.path.join(dst_dir, sid + ".ogg")
        shutil.copyfile(src_p, dst)
        reg.append({"id": sid, "label": label, "src": "assets/audio/sfx/" + sid + ".ogg"})
        print(f"{sid:10s} {os.path.getsize(dst) / 1024:6.1f} КБ  {label}")

    camp_path = os.path.join(ROOT, "campaign.json")
    camp = json.load(open(camp_path, encoding="utf-8"))
    have = {s["id"] for s in camp["sounds"]}
    for item in reg:
        if item["id"] not in have:
            camp["sounds"].append(item)
    print(f"звуков в реестре: {len(camp['sounds'])}")

    wired = 0
    for eid, label, snd in WIRE:
        p = os.path.join(ROOT, "entities", eid + ".json")
        d = json.load(open(p, encoding="utf-8"))
        for io in d.get("interact_options", []):
            if io.get("label") == label and not io.get("sound"):
                io["sound"] = snd
                wired += 1
        with open(p, "w", encoding="utf-8") as f:
            json.dump(d, f, ensure_ascii=False, indent=2)
            f.write("\n")
    print(f"привязано звуков к действиям: {wired} из {len(WIRE)}")

    with open(camp_path, "w", encoding="utf-8") as f:
        json.dump(camp, f, ensure_ascii=False, indent=2)
        f.write("\n")

    # проверка: не осталось ли действий без звука
    left = 0
    for fn in sorted(os.listdir(os.path.join(ROOT, "entities"))):
        d = json.load(open(os.path.join(ROOT, "entities", fn), encoding="utf-8"))
        for io in d.get("interact_options", []) or []:
            if not io.get("sound"):
                left += 1
                print(f"  без звука: {d['id']} — {io.get('label')}")
    print(f"действий без звука осталось: {left}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
