#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""Шрифты кампании: скачивание из google/fonts и перекодирование в woff2.

Берём гарнитуры с поддержкой кириллицы (текст кампании русский):

  Russo One     — display: заголовки, название в меню, имена в диалогах;
  PT Serif      — body: основной текст, реплики, описания;
  Marck Script  — hand: записки, страницы журнала, свитки кодекса.

Источник — репозиторий google/fonts (лицензия SIL OFL 1.1 на каждую гарнитуру;
файлы OFL.txt кладутся рядом со шрифтами). Прав на шрифты не заявляем,
названия гарнитур сохраняем.

Запуск: python3 tools/fonts_build.py
"""
import os
import shutil
import subprocess
import sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
STAGE = os.environ.get("CF_FONTS_STAGE", "/tmp/fonts")
OUT = os.path.join(ROOT, "assets", "fonts")

# файл в google/fonts -> имя в пакете
TTF = [
    ("ofl/russoone/RussoOne-Regular.ttf", "russo-one-400.woff2"),
    ("ofl/ptserif/PT_Serif-Web-Regular.ttf", "pt-serif-400.woff2"),
    ("ofl/ptserif/PT_Serif-Web-Bold.ttf", "pt-serif-700.woff2"),
    ("ofl/ptserif/PT_Serif-Web-Italic.ttf", "pt-serif-400-italic.woff2"),
    ("ofl/marckscript/MarckScript-Regular.ttf", "marck-script-400.woff2"),
]
LIC = [
    ("ofl/russoone/OFL.txt", "OFL-RussoOne.txt"),
    ("ofl/ptserif/OFL.txt", "OFL-PTSerif.txt"),
    ("ofl/marckscript/OFL.txt", "OFL-MarckScript.txt"),
]


def gh_raw(path, dest):
    """Скачивает один файл из репозитория google/fonts через gh api."""
    with open(dest, "wb") as f:
        r = subprocess.run(["gh", "api", "-H", "Accept: application/vnd.github.raw",
                            "/repos/google/fonts/contents/" + path],
                           stdout=f, stderr=subprocess.PIPE)
    if r.returncode != 0 or os.path.getsize(dest) < 4096:
        if os.path.exists(dest):
            os.remove(dest)
        return False
    return True


def to_woff2(src, dst):
    from fontTools.ttLib import TTFont
    f = TTFont(src)
    f.flavor = "woff2"
    f.save(dst)
    return os.path.getsize(dst)


def main():
    os.makedirs(STAGE, exist_ok=True)
    os.makedirs(OUT, exist_ok=True)
    total = 0
    for path, name in TTF:
        src = os.path.join(STAGE, os.path.basename(path))
        if not os.path.exists(src) or os.path.getsize(src) < 4096:
            print("скачиваю", path)
            if not gh_raw(path, src):
                print("  НЕ ПОЛУЧИЛОСЬ:", path)
                return 1
        size = to_woff2(src, os.path.join(OUT, name))
        total += size
        print(f"  {name:28s} {size/1024:6.1f} КБ")
    for path, name in LIC:
        src = os.path.join(STAGE, os.path.basename(path))
        if not os.path.exists(src) or os.path.getsize(src) < 1024:
            gh_raw(path, src)
        if os.path.exists(src):
            shutil.copy(src, os.path.join(OUT, name))
            print(f"  {name:28s} лицензия")
            total += os.path.getsize(os.path.join(OUT, name))
    print(f"итого: {total/1024:.1f} КБ в assets/fonts/")
    return 0


if __name__ == "__main__":
    sys.exit(main())
