#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""Третья волна звука: только реальные записи, без синтеза.

Заменяет петли, собранные из шумовых генераторов, на настоящие записи:

  `snd_water_amb`  — вода в затопленных выработках: фрагмент дорожки
                     «River Meditation» (CC0 Music) — реальная запись воды;
  `snd_deep_drone` — гул нижних ярусов: фрагмент «Deep Tones» (CC0 Music);
  `snd_pump_amb`   — работа помп: реальные сэмплы Kenney «Sci-Fi Sounds»
                     (spaceenginelow + enginecircular), зацикленные в длинную
                     петлю. Исходник — запись, а не синтез.

Петли `snd_drip` и `snd_fire` удаляются: подходящих реальных записей
капель и огня в доступных CC0-наборах нет, а собирать их из шума —
значит подсовывать игроку синтетику.

Источники (CC0 1.0 Universal, прав не заявляем):
  * CC0 Music — репозиторий meme2-cmd2/CC0-Music;
  * Kenney «Sci-Fi Sounds» — из набора Cy4nWare/sfx-api (все звуки Kenney);
  * клон Kenney/Sci-Fi ожидается в /tmp/sfx (или укажите SFX_DIR).

Запуск: python3 tools/audio_build3.py
"""
import base64
import json
import os
import shutil
import subprocess
import sys
import urllib.parse

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
WORK = "/tmp/cf_audio3"
OUT = os.path.join(ROOT, "assets", "audio")
AMB = os.path.join(OUT, "amb")
MUSIC_REPO = "meme2-cmd2/CC0-Music"
SFX_DIR = os.environ.get("SFX_DIR", "/tmp/sfx")
SCIFI = os.path.join(SFX_DIR, "sounds", "sci-fi-sounds")

# петля -> (категория CC0 Music, файл, старт, длина, фильтр, громкость)
FROM_MUSIC = {
    "snd_water_amb": ("Ambient, Calm & Meditative", "River Meditation.opus",
                      20, 42, "lowpass=f=1400,highpass=f=60", 0.40),
    "snd_deep_drone": ("Ambient, Calm & Meditative", "Deep Tones.opus",
                       10, 36, "lowpass=f=420,highpass=f=35", 0.55),
}

# петля -> (основной сэмпл, второй слой, длина, фильтр, громкость)
FROM_KENNEY = {
    "snd_pump_amb": ("spaceenginelow-000.ogg", "enginecircular-000.ogg",
                     18.0, "lowpass=f=2200,highpass=f=45", 0.5),
}

# петли, которые надо убрать из пакета и из реестра
DROP = ["snd_drip", "snd_fire"]

# где звучит что (строки — всегда, объекты — по условию)
SCENE_AMBIENT = {
    "scene_gate_hall": ["snd_wind"],
    "scene_gate_office": [],
    "scene_pump_hall": ["snd_pump_amb"],
    "scene_pump_shaft": ["snd_water_amb"],
    "scene_pump_room": [],
    "scene_dry_row": [],
    "scene_flood_gallery": ["snd_water_amb"],
    "scene_sluice": ["snd_water_amb"],
    "scene_drift": ["snd_deep_drone"],
    "scene_face": ["snd_deep_drone"],
    "scene_office": [],
    "scene_archive": [],
}

LOCATION_AMBIENT = {
    "loc_surface": ["snd_wind"],
    "loc_gate": ["snd_wind"],
    "loc_pump7": ["snd_pump_amb"],
    "loc_ward8": [{"conditions": [{"type": "flag_set", "flag": "flood"}],
                   "sounds": ["snd_water_amb"], "volume": 0.9}],
    "loc_deep9": ["snd_deep_drone"],
}


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


def encode(ff, args, dst, extra=None):
    cmd = [ff, "-y", "-v", "error"] + args
    if extra:
        cmd += extra
    cmd += ["-codec:a", "libmp3lame", "-b:a", "64k", "-ar", "44100", dst]
    r = sh(cmd)
    if r.returncode:
        print("ОШИБКА ffmpeg:\n", r.stderr[-800:])
        return False
    return True


def main():
    ff = ffmpeg()
    os.makedirs(WORK, exist_ok=True)
    os.makedirs(AMB, exist_ok=True)

    print("== петли из настоящих записей воды и гула (CC0 Music):")
    for sid, (cat, name, start, length, filt, vol) in FROM_MUSIC.items():
        src = os.path.join(WORK, sid + ".opus")
        if not os.path.exists(src) or os.path.getsize(src) < 65536:
            size = fetch_blob(MUSIC_REPO, f"CC0 For folyo/categorized/{cat}/{name}", src)
            print(f"   скачано {name} — {size // 1024} КБ")
        dst = os.path.join(AMB, sid + ".mp3")
        ok = encode(ff, ["-ss", str(start), "-t", str(length), "-i", src,
                         "-af", f"{filt},volume={vol},afade=t=in:d=3,"
                                f"afade=t=out:st={length - 4}:d=3,"
                                f"loudnorm=I=-27:TP=-6", "-ac", "2"], dst)
        if not ok:
            return 1
        print(f"   {sid:16s} {os.path.getsize(dst)/1024:6.1f} КБ  ({length} с из «{name}»)")

    print("== петля работы помп (реальные сэмплы Kenney, зациклены):")
    for sid, (main_, layer, dur, filt, vol) in FROM_KENNEY.items():
        a = os.path.join(SCIFI, main_)
        b = os.path.join(SCIFI, layer)
        if not os.path.exists(a):
            sys.exit(f"нет файла {a} — укажите SFX_DIR с клоном Cy4nWare/sfx-api")
        layer_args = []
        fc = (f"[0:a]aloop=loop=-1:size=2e9,atrim=0:{dur},{filt},volume={vol}[m];")
        if os.path.exists(b):
            layer_args = ["-i", b]
            fc += (f"[1:a]aloop=loop=-1:size=2e9,atrim=0:{dur},"
                   f"lowpass=f=1600,highpass=f=60,volume=0.22[l];"
                   f"[m][l]amix=inputs=2:normalize=0,afade=t=in:d=2,"
                   f"afade=t=out:st={dur - 3}:d=3,loudnorm=I=-28:TP=-6[out]")
        else:
            fc += (f"[m]afade=t=in:d=2,afade=t=out:st={dur - 3}:d=3,"
                   f"loudnorm=I=-28:TP=-6[out]")
        dst = os.path.join(AMB, sid + ".mp3")
        ok = encode(ff, ["-i", a] + layer_args +
                    ["-filter_complex", fc, "-map", "[out]", "-t", str(dur)], dst)
        if not ok:
            return 1
        print(f"   {sid:16s} {os.path.getsize(dst)/1024:6.1f} КБ  ({dur:.0f} с из {main_} + {layer})")

    # ------------------------------------------------------------ реестр
    camp_path = os.path.join(ROOT, "campaign.json")
    camp = json.load(open(camp_path, encoding="utf-8"))
    for sid in DROP:
        p = os.path.join(AMB, sid + ".mp3")
        if os.path.exists(p):
            os.remove(p)
            print(f"   удалён синтезированный файл: assets/audio/amb/{sid}.mp3")
    camp["sounds"] = [s for s in camp["sounds"] if s["id"] not in DROP]
    labels = {"snd_water_amb": "Вода в галерее (фон)",
              "snd_deep_drone": "Гул нижних ярусов (фон)",
              "snd_pump_amb": "Работа помп (фон)"}
    for sid in list(FROM_MUSIC) + list(FROM_KENNEY):
        entry = {"id": sid, "label": labels[sid], "loop": True,
                 "src": f"assets/audio/amb/{sid}.mp3"}
        camp["sounds"] = [s for s in camp["sounds"] if s["id"] != sid] + [entry]
    json.dump(camp, open(camp_path, "w", encoding="utf-8"),
              ensure_ascii=False, indent=2)
    open(camp_path, "a").write("\n")
    print(f"\nзвуков в реестре: {len(camp['sounds'])}")

    # ------------------------------------------------------------ ambient
    print("== ambient сцен:")
    for sid, amb in SCENE_AMBIENT.items():
        p = os.path.join(ROOT, "scenes", sid + ".json")
        d = json.load(open(p, encoding="utf-8"))
        d["ambient"] = amb
        json.dump(d, open(p, "w", encoding="utf-8"), ensure_ascii=False, indent=2)
        open(p, "a").write("\n")
        print(f"   {sid:20s} {amb or '—'}")

    print("== ambient локаций:")
    w = json.load(open(os.path.join(ROOT, "world.json"), encoding="utf-8"))
    for r in w["regions"]:
        for l in r["locations"]:
            if l["id"] in LOCATION_AMBIENT:
                l["ambient"] = LOCATION_AMBIENT[l["id"]]
                print(f"   {l['id']:14s} {json.dumps(l['ambient'], ensure_ascii=False)}")
    json.dump(w, open(os.path.join(ROOT, "world.json"), "w", encoding="utf-8"),
              ensure_ascii=False, indent=2)
    open(os.path.join(ROOT, "world.json"), "a").write("\n")
    print("\nготово")
    return 0


if __name__ == "__main__":
    sys.exit(main())
