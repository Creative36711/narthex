#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""Шестая волна звука: звуки панелей интерфейса.

Мастер пожаловался, что у панелей «Дело №137» (журнал расследования) и
«Хроника» (журнал событий) звуки не отличаются от общих, а открытие и
закрытие звучат одинаково. Движок умеет хуки `panel:<панель>` и
`panel:<панель>:close`, поэтому каждой панели нужен свой звук на открытие
и свой — на закрытие.

Всё — реальные записи из набора Kenney (раздача Cy4nWare/sfx-api, CC0 1.0),
обрезанные, выровненные по громкости и сведённые между собой. Ни одного
синтезированного звука.

Запуск: python3 tools/audio_build6.py
"""
import os
import subprocess
import sys

import imageio_ffmpeg

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT = os.path.join(ROOT, "assets", "audio", "sfx")
STAGE = os.environ.get("CF_SND_STAGE", "/tmp/snd3")

BASE = "https://api.github.com/repos/Cy4nWare/sfx-api/contents/sounds"

# имя исходника -> что делаем
# (trim_start, trim_dur, volume, extra_filter)
SRC = {
    "rpg-audio/bookopen.ogg": (0.0, 0.15, 1.3, ""),
    "rpg-audio/bookplace1.ogg": (0.0, 0.28, 1.2, ""),
    "rpg-audio/dropleather.ogg": (0.0, 0.42, 1.1, ""),
    "rpg-audio/handlesmallleather.ogg": (0.0, 0.34, 1.2, ""),
    "casino-audio/card-slide-1.ogg": (0.0, 0.35, 1.1, ""),
    "casino-audio/card-place-1.ogg": (0.0, 0.30, 1.1, ""),
    "casino-audio/card-shove-1.ogg": (0.0, 0.45, 1.2, ""),
    "rpg-audio/cloth2.ogg": (0.0, 0.42, 1.1, ""),
}

FF = imageio_ffmpeg.get_ffmpeg_exe()


def fetch(name):
    """Скачать исходник (GitHub API отдаёт бинарник по Accept: raw)."""
    dst = os.path.join(STAGE, os.path.basename(name))
    if os.path.exists(dst) and os.path.getsize(dst) > 1000:
        return dst
    os.makedirs(STAGE, exist_ok=True)
    subprocess.run(
        ["curl", "-sL", "-H", "Accept: application/vnd.github.raw",
         "-H", "User-Agent: arena-agent", "-o", dst,
         BASE + "/" + name.replace(" ", "%20")],
        check=True,
    )
    return dst


def build(srcs, out, filt_extra="", mix=False):
    cmd = [FF, "-hide_banner", "-loglevel", "error", "-y"]
    for s in srcs:
        cmd += ["-i", s]
    cmd += ["-filter_complex", filt_extra, "-map", "[out]", "-ar", "44100",
            "-c:a", "libvorbis", "-q:a", "5", os.path.join(OUT, out)]
    subprocess.run(cmd, check=True)
    size = os.path.getsize(os.path.join(OUT, out))
    dur = subprocess.run(
        [FF, "-hide_banner", "-i", os.path.join(OUT, out), "-f", "null", "-"],
        capture_output=True, text=True,
    ).stderr
    d = ""
    for line in dur.splitlines():
        if "Duration:" in line:
            d = line.strip().split(",")[0]
    print(f"  {out:24} {size/1024:6.1f} КБ  {d}")


def main():
    os.makedirs(OUT, exist_ok=True)
    paths = {k: fetch(k) for k in SRC}

    def trim(p, start, dur, vol):
        f = (f"[0:a]atrim=start={start}:duration={dur},asetpts=PTS-STARTPTS,"
             f"volume={vol},afade=t=in:st=0:d=0.01,"
             f"afade=t=out:st={max(dur-0.06,0.01)}:d=0.06[out]")
        return f

    s = SRC
    # дело: папка открывается и по ней идёт лист
    build([paths["rpg-audio/bookopen.ogg"], paths["casino-audio/card-slide-1.ogg"]],
          "sfx_journal_open.ogg",
          "[0:a]atrim=start=0:duration=0.15,asetpts=PTS-STARTPTS,volume=1.4,"
          "afade=t=out:st=0.09:d=0.06[a];"
          "[1:a]atrim=start=0.02:duration=0.40,asetpts=PTS-STARTPTS,volume=0.55,"
          "adelay=90|90,afade=t=out:st=0.30:d=0.10[b];"
          "[a][b]amix=inputs=2:duration=longest:dropout_transition=0,alimiter=limit=0.95[out]")

    build([paths["rpg-audio/bookplace1.ogg"]], "sfx_journal_close.ogg",
          trim(None, *s["rpg-audio/bookplace1.ogg"][:2], 1.3))
    build([paths["rpg-audio/dropleather.ogg"]], "sfx_archive_open.ogg",
          trim(None, *s["rpg-audio/dropleather.ogg"][:2], 1.2))
    build([paths["rpg-audio/handlesmallleather.ogg"]], "sfx_archive_close.ogg",
          trim(None, *s["rpg-audio/handlesmallleather.ogg"][:2], 1.3))
    build([paths["casino-audio/card-slide-1.ogg"]], "sfx_log_open.ogg",
          trim(None, *s["casino-audio/card-slide-1.ogg"][:2], 1.2))
    build([paths["casino-audio/card-place-1.ogg"]], "sfx_log_close.ogg",
          trim(None, *s["casino-audio/card-place-1.ogg"][:2], 1.2))
    build([paths["casino-audio/card-shove-1.ogg"]], "sfx_file.ogg",
          trim(None, *s["casino-audio/card-shove-1.ogg"][:2], 1.3))
    build([paths["rpg-audio/cloth2.ogg"]], "sfx_bag_close.ogg",
          trim(None, *s["rpg-audio/cloth2.ogg"][:2], 1.2))
    print("готово")


if __name__ == "__main__":
    sys.exit(main())
