#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Сборка реального аудио для кампании «Каркас».

Источники (все CC0 1.0 Universal):
  * Музыка — подборка CC0 Music (репозиторий meme2-cmd2/CC0-Music, каталог
    «CC0 For folyo/categorized/…»), сборка chosic.com. Скачивается через
    GitHub API (прямой CDN в песочнице закрыт), конвертируется в mp3.
  * Звуки — Kenney «Audio (295 files)» (репозиторий iwenzhou/kenney),
    лицензия CC0 1.0 Universal. Файлы .ogg берутся как есть.
  * Фоновые петли (ветер, вода) и короткие «водяные» звуки нарезаются
    из тех же реальных CC0-дорожек: lowpass/highpass + плавные фейды.

Запуск:  python3 tools/audio_build.py
Результат: assets/audio/music/*.mp3, assets/audio/sfx/*.ogg, assets/audio/amb/*.mp3
"""
import base64
import json
import os
import shutil
import subprocess
import sys
import urllib.parse

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
WORK = "/tmp/cf_audio"
OUT = os.path.join(ROOT, "assets", "audio")

MUSIC_REPO = "meme2-cmd2/CC0-Music"
KENNEY_REPO = "https://github.com/iwenzhou/kenney.git"

# id трека кампании -> (категория CC0 Music, имя файла, длительность обрезки, сек)
MUSIC = {
    "music_menu":   ("Horror, Dark & Suspense",       "The Abyss.opus",            165),
    "music_gate":   ("Horror, Dark & Suspense",       "Dark Hallway.opus",          46),
    "music_pump":   ("Horror, Dark & Suspense",       "Nightmare.opus",             54),
    "music_deep":   ("Horror, Dark & Suspense",       "Lurking Sloth.opus",        150),
    "music_office": ("Cinematic, Epic & Adventure",   "Hidden Truth.opus",          98),
    "music_battle": ("Cinematic, Epic & Adventure",   "Battle Ready.opus",          77),
    "music_end":    ("Fantasy, Magical & Storybook",  "Night in the Castle.opus",  165),
}

# id звука кампании -> путь внутри «Audio (295 files)/…» (Kenney, CC0)
KENNEY = {
    "sfx_click":  "UI sounds (50 sounds)/click1.ogg",
    "sfx_coin":   "RPG sounds (50 sounds)/handleCoins.ogg",
    "sfx_door":   "RPG sounds (50 sounds)/doorOpen_1.ogg",
    "sfx_gear":   "RPG sounds (50 sounds)/metalLatch.ogg",
    "sfx_hit":    "RPG sounds (50 sounds)/chop.ogg",
    "sfx_crit":   "RPG sounds (50 sounds)/metalPot1.ogg",
    "sfx_lamp":   "UI sounds (50 sounds)/switch7.ogg",
    "sfx_pickup": "RPG sounds (50 sounds)/handleSmallLeather.ogg",
    "sfx_horn":   "Jingle sounds (85 sounds)/jingles_STEEL/jingles_STEEL07.ogg",
    "sfx_steam":  "Digital sounds (60 sounds)/spaceTrash5.ogg",
}

# фоновые петли: (источник-дорожка, старт, длина, фильтр, громкость)
AMBIENT = {
    "snd_wind":      ("music_menu", 40, 42, "lowpass=f=520", 0.42),
    "snd_water_amb": ("music_deep", 25, 46, "lowpass=f=1500,highpass=f=70", 0.40),
}

# короткие звуки воды/пара: нарезаются из реальных дорожек
DERIVED = {
    "sfx_water": ("music_deep", 12.0, 1.6, "lowpass=f=1800,highpass=f=120", 0.9),
}


def sh(cmd, **kw):
    return subprocess.run(cmd, shell=isinstance(cmd, str), capture_output=True,
                          text=True, **kw)


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
    """Скачивает файл из GitHub через API (CDN закрыт) — base64 в JSON."""
    enc = urllib.parse.quote(path)
    sha = gh_api(f"repos/{repo}/contents/{enc}", ".sha")
    b64 = gh_api(f"repos/{repo}/git/blobs/{sha}", ".content")
    with open(dest, "wb") as f:
        f.write(base64.b64decode("".join(b64.split())))
    return os.path.getsize(dest)


def main():
    ff = ffmpeg()
    os.makedirs(WORK, exist_ok=True)
    for sub in ("music", "sfx", "amb"):
        os.makedirs(os.path.join(OUT, sub), exist_ok=True)

    # ---------------------------------------------------------------- музыка
    print("== музыка (CC0 Music):")
    for tid, (cat, name, dur) in MUSIC.items():
        src = os.path.join(WORK, tid + ".opus")
        if not os.path.exists(src):
            path = f"CC0 For folyo/categorized/{cat}/{name}"
            size = fetch_blob(MUSIC_REPO, path, src)
            print(f"   скачано {name} — {size // 1024} КБ")
        dst = os.path.join(OUT, "music", tid + ".mp3")
        cmd = [ff, "-y", "-v", "error", "-i", src, "-t", str(dur),
               "-af", f"afade=t=in:d=2,afade=t=out:st={max(dur - 6, 1)}:d=5,"
                      f"loudnorm=I=-18:TP=-2:LRA=11",
               "-codec:a", "libmp3lame", "-b:a", "96k", "-ar", "44100", dst]
        r = sh(cmd)
        if r.returncode:
            sys.exit(f"ffmpeg не смог: {r.stderr[-400:]}")
        print(f"   {os.path.relpath(dst, ROOT)} — {os.path.getsize(dst) // 1024} КБ")

    # ------------------------------------------------------------- звуки Kenney
    print("== звуки (Kenney, CC0):")
    klone = os.path.join(WORK, "kenney")
    if not os.path.isdir(klone):
        sh(["git", "clone", "-q", "--depth", "1", KENNEY_REPO, klone], check=False)
    base = os.path.join(klone, "Audio (295 files)")
    for sid, rel in KENNEY.items():
        src = os.path.join(base, rel)
        if not os.path.exists(src):
            print(f"   ПРОПУСК (нет файла): {rel}")
            continue
        dst = os.path.join(OUT, "sfx", sid + ".ogg")
        shutil.copyfile(src, dst)
        print(f"   {os.path.relpath(dst, ROOT)} — {os.path.getsize(dst) // 1024} КБ ({rel})")

    # ------------------------------------------------------- фоновые петли
    print("== фоновые петли:")
    for sid, (src_id, start, length, filt, vol) in AMBIENT.items():
        src = os.path.join(OUT, "music", src_id + ".mp3")
        dst = os.path.join(OUT, "amb", sid + ".mp3")
        cmd = [ff, "-y", "-v", "error", "-ss", str(start), "-t", str(length), "-i", src,
               "-af", f"{filt},volume={vol},afade=t=in:d=3,"
                      f"afade=t=out:st={length - 4}:d=3,loudnorm=I=-26:TP=-6",
               "-codec:a", "libmp3lame", "-b:a", "64k", "-ar", "44100", dst]
        r = sh(cmd)
        if r.returncode:
            sys.exit(f"ffmpeg не смог: {r.stderr[-400:]}")
        print(f"   {os.path.relpath(dst, ROOT)} — {os.path.getsize(dst) // 1024} КБ")

    # ------------------------------------------------------- производные звуки
    print("== производные звуки:")
    for sid, (src_id, start, length, filt, vol) in DERIVED.items():
        src = os.path.join(OUT, "music", src_id + ".mp3")
        dst = os.path.join(OUT, "sfx", sid + ".mp3")
        cmd = [ff, "-y", "-v", "error", "-ss", str(start), "-t", str(length), "-i", src,
               "-af", f"{filt},volume={vol},afade=t=in:d=0.05,"
                      f"afade=t=out:st={length - 0.35}:d=0.3",
               "-codec:a", "libmp3lame", "-b:a", "80k", "-ar", "44100", dst]
        r = sh(cmd)
        if r.returncode:
            sys.exit(f"ffmpeg не смог: {r.stderr[-400:]}")
        print(f"   {os.path.relpath(dst, ROOT)} — {os.path.getsize(dst) // 1024} КБ")

    print("\nготово")


if __name__ == "__main__":
    main()
