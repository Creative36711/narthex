#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""Подключает новую графику к пакету: id кампании, портреты NPC, экраны концовок.

Запуск: python3 tools/patch_media.py
"""
import json
import os

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
CAMP = os.path.join(ROOT, "campaign.json")
ENT = os.path.join(ROOT, "entities")

CAMPAIGN_ID = "6c832013-0853-4dd7-b975-4d8e55d22c40"

# портреты: один файл на все состояния облика (эмоции переключаются репликой)
PORTRAITS = {
    "npc_dozh": "assets/img/npc/dozh.jpg",
    "npc_ayla": "assets/img/npc/ayla.jpg",
    "npc_resh": "assets/img/npc/resh.jpg",
    "npc_kast": "assets/img/npc/kast.jpg",
    "npc_zhuk": "assets/img/npc/zhuk.jpg",
    "npc_registrar": "assets/img/npc/registrar.jpg",
    "npc_vein": "assets/img/npc/vein.jpg",
}

STATES = ("neutral", "angry", "afraid", "thoughtful", "sad", "calm")

ENDING_IMAGES = {
    "ending_pump": "assets/img/end_pump.jpg",
    "ending_silence": "assets/img/end_silence.jpg",
    "ending_vein": "assets/img/end_vein.jpg",
    "ending_flood": "assets/img/end_silence.jpg",
    "ending_closed": "assets/img/end.jpg",
    "ending_death": "assets/img/end.jpg",
}


def load(p):
    return json.load(open(p, encoding="utf-8"))


def save(p, obj):
    with open(p, "w", encoding="utf-8") as f:
        json.dump(obj, f, ensure_ascii=False, indent=1)


def main():
    c = load(CAMP)
    c["id"] = CAMPAIGN_ID
    for e in c["endings"]:
        img = ENDING_IMAGES.get(e["id"])
        if img and os.path.exists(os.path.join(ROOT, img)):
            e["image"] = img
    save(CAMP, c)
    print(f"id кампании: {c['id']}")
    print("концовки:", [(e["id"], e["image"]) for e in c["endings"]])

    for nid, path in PORTRAITS.items():
        f = os.path.join(ENT, nid + ".json")
        if not os.path.exists(f):
            print("нет файла", nid)
            continue
        if not os.path.exists(os.path.join(ROOT, path)):
            print("нет картинки", path)
            continue
        e = load(f)
        e["portrait"] = {k: path for k in STATES}
        save(f, e)
        print(f"портрет {nid} -> {path}")


if __name__ == "__main__":
    main()
