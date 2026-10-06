#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""Правки под обновлённый движок и пакеты Kenney.

1. **Мимика портретов.** Движок переключает эмоции на ходу, поэтому у ключевых
   персонажей разные кадры, а не одна картинка на все состояния. Какие эмоции
   реально встречаются в диалогах, видно по тегам `# emotion:` в `.ink`.
2. **Освещение сцен (`lighting`).** Каркас — город под землёй: все сцены
   помещения, суточный фильтр им не нужен.
3. **Качество звуков удара.** Звуки боя заменены на более подходящие сэмплы
   из наборов Kenney «Impact Sounds» и «Sci-Fi Sounds» (CC0).

Запуск: python3 tools/patch_engine.py
"""
import json
import os
import shutil
import sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SFX_DIR = os.environ.get("SFX_DIR", "/tmp/sfx")
SCIFI = os.path.join(SFX_DIR, "sounds", "sci-fi-sounds")
IMPACT = os.path.join(SFX_DIR, "sounds", "impact-sounds")

# персонаж -> {состояние: файл}. Не указанные состояния остаются как есть.
PORTRAITS = {
    "npc_resh": {"neutral": "assets/img/npc/resh_neutral.jpg",
                 "calm": "assets/img/npc/resh_calm.jpg",
                 "thoughtful": "assets/img/npc/resh_thoughtful.jpg",
                 "angry": "assets/img/npc/resh_angry.jpg",
                 "sad": "assets/img/npc/resh_sad.jpg",
                 "afraid": "assets/img/npc/resh_thoughtful.jpg"},
    "npc_kast": {"neutral": "assets/img/npc/kast_neutral.jpg",
                 "calm": "assets/img/npc/kast_calm.jpg",
                 "angry": "assets/img/npc/kast_angry.jpg",
                 "thoughtful": "assets/img/npc/kast_neutral.jpg",
                 "sad": "assets/img/npc/kast_calm.jpg",
                 "afraid": "assets/img/npc/kast_neutral.jpg"},
    "npc_ira": {"neutral": "assets/img/npc/ira_neutral.jpg",
                "thoughtful": "assets/img/npc/ira_thoughtful.jpg",
                "angry": "assets/img/npc/ira_angry.jpg",
                "sad": "assets/img/npc/ira_sad.jpg",
                "calm": "assets/img/npc/ira_neutral.jpg",
                "afraid": "assets/img/npc/ira_thoughtful.jpg"},
    "npc_kell": {"neutral": "assets/img/npc/kell_neutral.jpg",
                 "calm": "assets/img/npc/kell_calm.jpg",
                 "thoughtful": "assets/img/npc/kell_thoughtful.jpg",
                 "angry": "assets/img/npc/kell_angry.jpg",
                 "sad": "assets/img/npc/kell_thoughtful.jpg",
                 "afraid": "assets/img/npc/kell_neutral.jpg"},
    "npc_vein": {"neutral": "assets/img/npc/vein_neutral.jpg",
                 "calm": "assets/img/npc/vein_calm.jpg",
                 "thoughtful": "assets/img/npc/vein_thoughtful.jpg",
                 "angry": "assets/img/npc/vein_calm.jpg",
                 "sad": "assets/img/npc/vein_thoughtful.jpg",
                 "afraid": "assets/img/npc/vein_neutral.jpg"},
    "npc_vex": {"neutral": "assets/img/npc/vex_neutral.jpg"},
    "npc_dozh": {"neutral": "assets/img/npc/dozh_neutral.jpg",
                 "calm": "assets/img/npc/dozh_calm.jpg",
                 "thoughtful": "assets/img/npc/dozh_thoughtful.jpg",
                 "angry": "assets/img/npc/dozh_thoughtful.jpg",
                 "sad": "assets/img/npc/dozh_neutral.jpg",
                 "afraid": "assets/img/npc/dozh_neutral.jpg"},
    "npc_ayla": {"neutral": "assets/img/npc/ayla_neutral.jpg",
                 "calm": "assets/img/npc/ayla_calm.jpg",
                 "thoughtful": "assets/img/npc/ayla_thoughtful.jpg",
                 "angry": "assets/img/npc/ayla_thoughtful.jpg",
                 "sad": "assets/img/npc/ayla_neutral.jpg",
                 "afraid": "assets/img/npc/ayla_neutral.jpg"},
    "npc_zhuk": {"neutral": "assets/img/npc/zhuk_neutral.jpg",
                 "calm": "assets/img/npc/zhuk_calm.jpg",
                 "thoughtful": "assets/img/npc/zhuk_thoughtful.jpg",
                 "angry": "assets/img/npc/zhuk_angry.jpg",
                 "sad": "assets/img/npc/zhuk_thoughtful.jpg",
                 "afraid": "assets/img/npc/zhuk_angry.jpg"},
}

# звук кампании -> файл Kenney (набор, подпись)
SOUND_SWAP = {
    "sfx_hit": (os.path.join(IMPACT, "impactpunch-medium-000.ogg"), "Удар"),
    "sfx_crit": (os.path.join(IMPACT, "impactmetal-heavy-000.ogg"), "Тяжёлый удар"),
    "sfx_steam": (os.path.join(SCIFI, "thrusterfire-000.ogg"), "Выхлоп пара"),
}
SOUND_ADD = {
    "sfx_miss": (os.path.join(IMPACT, "impactgeneric-light-000.ogg"), "Промах"),
}


def load(p):
    return json.load(open(os.path.join(ROOT, p), encoding="utf-8"))


def save(p, o):
    full = os.path.join(ROOT, p)
    with open(full, "w", encoding="utf-8") as f:
        json.dump(o, f, ensure_ascii=False, indent=2)
        f.write("\n")


def main():
    # ------------------------------------------------------------ портреты
    print("== мимика портретов:")
    for eid, frames in PORTRAITS.items():
        p = f"entities/{eid}.json"
        d = load(p)
        missing = [f for f in frames.values() if not os.path.exists(os.path.join(ROOT, f))]
        if missing:
            print(f"   ПРОПУСК {eid}: нет файлов {missing}")
            continue
        d.setdefault("portrait", {}).update(frames)
        save(p, d)
        uniq = len(set(d["portrait"].values()))
        print(f"   {eid:10s} кадров {len(d['portrait'])}, разных файлов {uniq}")

    # ---------------------------------------------------------- освещение
    print("== освещение сцен:")
    man = load("manifest.json")
    for f in man["scenes"]:
        d = load("scenes/" + f)
        d["lighting"] = "indoor"
        save("scenes/" + f, d)
    print(f"   проставлено indoor: {len(man['scenes'])} сцен")

    # -------------------------------------------------------------- звуки
    print("== звуки боя (наборы Kenney):")
    camp = load("campaign.json")
    by_id = {s["id"]: s for s in camp["sounds"]}
    for sid, (src, label) in {**SOUND_SWAP, **SOUND_ADD}.items():
        if not os.path.exists(src):
            print(f"   ПРОПУСК {sid}: нет {src}")
            continue
        dst = os.path.join(ROOT, "assets", "audio", "sfx", sid + ".ogg")
        shutil.copyfile(src, dst)
        entry = {"id": sid, "label": label, "src": f"assets/audio/sfx/{sid}.ogg"}
        if sid in by_id:
            camp["sounds"] = [entry if s["id"] == sid else s for s in camp["sounds"]]
        else:
            camp["sounds"].append(entry)
        print(f"   {sid:10s} {label} — {os.path.getsize(dst)/1024:.1f} КБ")
    ui = camp.setdefault("ui_sounds", {})
    if "sfx_miss" in {s["id"] for s in camp["sounds"]}:
        ui["miss"] = "sfx_miss"
    save("campaign.json", camp)
    print("   ui_sounds.miss →", ui.get("miss"))
    return 0


if __name__ == "__main__":
    sys.exit(main())
