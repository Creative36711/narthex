#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""Четвёртая волна звука: два новых трека и четыре новых звука.

Музыка (CC0 Music, реальные записи):
  `music_alarm` — «Evil Incoming»: звучит, когда город закрывают
                  («режим тишины», флаг `lockdown`);
  `music_vein`  — «Space Ambience»: девятый ярус и слепой забой, где живая жила.

Звуки (Kenney, CC0):
  `snd_stone` — удар по породе (Impact Sounds);
  `snd_glass` — стекло лампы;
  `snd_cloth` — ткань (одеяло, тряпьё);
  `snd_blade` — клинок из ножен.

Плюс conditional-музыка: у каждой сцены и локации первым правилом встаёт
слой с `music_alarm` по флагу `lockdown`.

Запуск: python3 tools/audio_build4.py
"""
import base64
import json
import os
import shutil
import subprocess
import sys
import urllib.parse

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
WORK = "/tmp/cf_audio4"
OUT = os.path.join(ROOT, "assets", "audio")
MUSIC_DIR = os.path.join(OUT, "music")
SFX_DIR = os.path.join(OUT, "sfx")
MUSIC_REPO = "meme2-cmd2/CC0-Music"
SFX_SRC = os.environ.get("SFX_DIR", "/tmp/sfx")
IMPACT = os.path.join(SFX_SRC, "sounds", "impact-sounds")
RPG = os.path.join(SFX_SRC, "sounds", "rpg-audio")

# id трека -> (категория, файл, длительность, громкость)
MUSIC = {
    "music_alarm": ("Horror, Dark & Suspense", "Evil Incoming.opus", 105, 0.7),
    "music_vein": ("Ambient, Calm & Meditative", "Space Ambience.opus", 120, 0.55),
}
MUSIC_LABELS = {"music_alarm": "Тревога: режим тишины (CC0)",
                "music_vein": "Девятый ярус: жила (CC0)"}

# id звука -> (файл Kenney, подпись)
SOUNDS = {
    "snd_stone": (os.path.join(IMPACT, "impactmining-000.ogg"), "Порода"),
    "snd_glass": (os.path.join(IMPACT, "impactglass-light-000.ogg"), "Стекло лампы"),
    "snd_cloth": (os.path.join(RPG, "cloth1.ogg"), "Ткань"),
    "snd_blade": (os.path.join(RPG, "drawknife1.ogg"), "Клинок"),
}

# предмет -> (часть подписи действия, id звука)
ITEM_SOUNDS = {
    "item_debris": [("Разгрести нанос", "snd_stone")],
    "item_cot": [("Поспать восемь часов", "snd_cloth")],
    "item_lamp": [("Заправить лампу", "snd_glass"), ("Зажечь", "snd_glass")],
    "item_knife": [("Осмотреть", "snd_blade")],
    "item_service_blade": [("Осмотреть", "snd_blade")],
}

# где играет music_vein
VEIN_MUSIC = {"loc_deep9": "music_vein",
              "scene_drift": "music_vein",
              "scene_face": "music_vein"}

ALARM_RULE = {"tracks": ["music_alarm"],
              "conditions": [{"type": "flag_set", "flag": "lockdown"}]}


def sh(cmd):
    return subprocess.run(cmd, capture_output=True, text=True)


def ffmpeg():
    try:
        import imageio_ffmpeg
        return imageio_ffmpeg.get_ffmpeg_exe()
    except ImportError:
        p = shutil.which("ffmpeg")
        if not p:
            sys.exit("нужен ffmpeg: pip install --break-system-packages imageio-ffmpeg")
        return p


def gh_api(url, jq):
    r = sh(["gh", "api", url, "--jq", jq])
    if r.returncode != 0:
        sys.exit(f"gh api не сработал: {url}\n{r.stderr[:300]}")
    return r.stdout.strip()


def fetch_blob(repo, path, dest):
    enc = urllib.parse.quote(path)
    sha = gh_api(f"repos/{repo}/contents/{enc}", ".sha")
    b64 = gh_api(f"repos/{repo}/git/blobs/{sha}", ".content")
    with open(dest, "wb") as f:
        f.write(base64.b64decode("".join(b64.split())))
    return os.path.getsize(dest)


def main():
    ff = ffmpeg()
    os.makedirs(WORK, exist_ok=True)
    camp_path = os.path.join(ROOT, "campaign.json")
    camp = json.load(open(camp_path, encoding="utf-8"))

    print("== музыка (CC0 Music):")
    for tid, (cat, name, dur, vol) in MUSIC.items():
        src = os.path.join(WORK, tid + ".opus")
        if not os.path.exists(src) or os.path.getsize(src) < 65536:
            size = fetch_blob(MUSIC_REPO, f"CC0 For folyo/categorized/{cat}/{name}", src)
            print(f"   скачано {name} — {size // 1024} КБ")
        dst = os.path.join(MUSIC_DIR, tid + ".mp3")
        cmd = [ff, "-y", "-v", "error", "-i", src, "-t", str(dur),
               "-af", f"afade=t=in:d=2,afade=t=out:st={max(dur - 6, 1)}:d=5,"
                      f"loudnorm=I=-18:TP=-2:LRA=11",
               "-codec:a", "libmp3lame", "-b:a", "96k", "-ar", "44100", dst]
        r = sh(cmd)
        if r.returncode:
            print(r.stderr[-600:])
            return 1
        entry = {"id": tid, "label": MUSIC_LABELS[tid], "loop": True,
                 "volume": vol, "src": f"assets/audio/music/{tid}.mp3"}
        camp["music_tracks"] = [t for t in camp["music_tracks"] if t["id"] != tid] + [entry]
        print(f"   {tid:12s} {os.path.getsize(dst)/1024:6.0f} КБ  ({dur} с из «{name}»)")

    print("== короткие звуки (Kenney):")
    for sid, (src, label) in SOUNDS.items():
        if not os.path.exists(src):
            print(f"   ПРОПУСК {sid}: нет {src}")
            continue
        dst = os.path.join(SFX_DIR, sid + ".ogg")
        shutil.copyfile(src, dst)
        camp["sounds"] = [s for s in camp["sounds"] if s["id"] != sid]
        camp["sounds"].append({"id": sid, "label": label,
                               "src": f"assets/audio/sfx/{sid}.ogg"})
        print(f"   {sid:12s} {os.path.getsize(dst)/1024:5.1f} КБ  {label}")

    # ------------------------------------------------------- музыка по местам
    print("== музыка мест:")
    w = json.load(open(os.path.join(ROOT, "world.json"), encoding="utf-8"))
    for r in w["regions"]:
        for l in r["locations"]:
            rules = l.get("music") or []
            rules = [x for x in rules if x.get("tracks") != ["music_alarm"]]
            l["music"] = [ALARM_RULE] + rules
            if l["id"] in VEIN_MUSIC:
                l["music"] = [x for x in l["music"] if VEIN_MUSIC[l["id"]] not in x.get("tracks", [])]
                l["music"].append({"tracks": [VEIN_MUSIC[l["id"]]], "conditions": []})
            print(f"   {l['id']:12s} {[t['tracks'] for t in l['music']]}")
    json.dump(w, open(os.path.join(ROOT, "world.json"), "w", encoding="utf-8"),
              ensure_ascii=False, indent=2)
    open(os.path.join(ROOT, "world.json"), "a").write("\n")

    man = json.load(open(os.path.join(ROOT, "manifest.json"), encoding="utf-8"))
    for f in man["scenes"]:
        p = os.path.join(ROOT, "scenes", f)
        d = json.load(open(p, encoding="utf-8"))
        rules = [x for x in (d.get("music") or []) if x.get("tracks") != ["music_alarm"]]
        d["music"] = [ALARM_RULE] + rules
        if d["id"] in VEIN_MUSIC:
            d["music"] = [x for x in d["music"] if VEIN_MUSIC[d["id"]] not in x.get("tracks", [])]
            d["music"].append({"tracks": [VEIN_MUSIC[d["id"]]], "conditions": []})
        json.dump(d, open(p, "w", encoding="utf-8"), ensure_ascii=False, indent=2)
        open(p, "a").write("\n")
    print(f"   сцен: {len(man['scenes'])} (в каждой первым слоем — тревога по флагу lockdown)")

    # -------------------------------------------------------- звуки предметов
    print("== звуки действий:")
    wired = 0
    for eid, opts in ITEM_SOUNDS.items():
        p = os.path.join(ROOT, "entities", eid + ".json")
        if not os.path.exists(p):
            continue
        d = json.load(open(p, encoding="utf-8"))
        for io in d.get("interact_options", []):
            for part, sid in opts:
                if part.lower() in (io.get("label") or "").lower():
                    io["sound"] = sid
                    wired += 1
        json.dump(d, open(p, "w", encoding="utf-8"), ensure_ascii=False, indent=2)
        open(p, "a").write("\n")
    print(f"   привязано действий: {wired}")

    json.dump(camp, open(camp_path, "w", encoding="utf-8"), ensure_ascii=False, indent=2)
    open(camp_path, "a").write("\n")
    print(f"\nмузыки: {len(camp['music_tracks'])} треков, звуков: {len(camp['sounds'])}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
