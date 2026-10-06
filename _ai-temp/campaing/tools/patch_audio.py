#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""Подключает реальные аудиофайлы к campaign.json: музыка, звуки, фоны, атрибуция.

Было: синтез из JSON (MusicDoc/SoundDoc, zzfx).
Стало: файлы пакета assets/audio/… (CC0). Запуск: python3 tools/patch_audio.py
"""
import json
import os

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
CAMP = os.path.join(ROOT, "campaign.json")

MUSIC_SRC = {t: f"assets/audio/music/{t}.mp3" for t in
             ("music_menu", "music_gate", "music_pump", "music_deep",
              "music_office", "music_battle", "music_end")}

SOUND_SRC = {
    "sfx_click":  "assets/audio/sfx/sfx_click.ogg",
    "sfx_coin":   "assets/audio/sfx/sfx_coin.ogg",
    "sfx_door":   "assets/audio/sfx/sfx_door.ogg",
    "sfx_gear":   "assets/audio/sfx/sfx_gear.ogg",
    "sfx_hit":    "assets/audio/sfx/sfx_hit.ogg",
    "sfx_crit":   "assets/audio/sfx/sfx_crit.ogg",
    "sfx_lamp":   "assets/audio/sfx/sfx_lamp.ogg",
    "sfx_pickup": "assets/audio/sfx/sfx_pickup.ogg",
    "sfx_horn":   "assets/audio/sfx/sfx_horn.ogg",
    "sfx_steam":  "assets/audio/sfx/sfx_steam.ogg",
    "sfx_water":  "assets/audio/sfx/sfx_water.mp3",
    "snd_wind":      "assets/audio/amb/snd_wind.mp3",
    "snd_water_amb": "assets/audio/amb/snd_water_amb.mp3",
}

ATTRIBUTION_NOTE = (
    "Оригинальная кампания: тексты, дизайн и сборка — ИИ-агент Chronicle Forge по брифу мастера. "
    "Графика (обложка меню, эмблема, кадры катсцен, портреты персонажей, финальные экраны) "
    "сгенерирована нейросетью по запросу сборщика и используется без ограничений. "
    "Музыка: CC0-подборка «CC0 Music» (GitHub meme2-cmd2/CC0-Music, сборка chosic.com), "
    "CC0 1.0 Universal; дорожки обрезаны, нормализованы и перекодированы в mp3. "
    "Звуки: Kenney «Audio (295 files)» (GitHub iwenzhou/kenney), CC0 1.0 Universal, "
    "файлы .ogg использованы без изменений. Фоновые петли «ветер» и «вода» и короткий звук воды "
    "нарезаны из тех же CC0-дорожек (lowpass/highpass + фейды). "
    "Озвучка реплик синтезирована голосовым движком платформы. "
    "Ни на один из перечисленных материалов кампания не претендует: права принадлежат "
    "исходным авторам, всё используется на условиях CC0."
)


def main():
    c = json.load(open(CAMP, encoding="utf-8"))

    missing = []
    for t in c["music_tracks"]:
        src = MUSIC_SRC.get(t["id"])
        if not src or not os.path.exists(os.path.join(ROOT, src)):
            missing.append(t["id"])
            continue
        t["src"] = src
        t["label"] = t["label"] + " (CC0)"
    for s in c["sounds"]:
        src = SOUND_SRC.get(s["id"])
        if not src or not os.path.exists(os.path.join(ROOT, src)):
            missing.append(s["id"])
            continue
        s["src"] = src
        if s["id"].startswith("snd_"):
            s["loop"] = True
        else:
            s.pop("loop", None)

    c["attribution"].update({
        "note": ATTRIBUTION_NOTE,
        "published_at": "2026-10-05",
    })

    with open(CAMP, "w", encoding="utf-8") as f:
        json.dump(c, f, ensure_ascii=False, indent=1)
    print("музыка треков:", len(c["music_tracks"]), "| звуков:", len(c["sounds"]))
    print("файлов не найдено:", missing or "нет")


if __name__ == "__main__":
    main()
