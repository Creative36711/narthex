#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""Подключает шрифты кампании: реестр campaign.fonts и роли theme.fonts.

Роли: display (заголовки), body (основной текст), hand (записки и журнал).
Все гарнитуры — с кириллицей, файлы лежат в assets/fonts/ (woff2),
лицензии OFL 1.1 — там же.

Запуск: python3 tools/patch_fonts.py
"""
import json
import os
import sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
PATH = os.path.join(ROOT, "campaign.json")

FONTS = [
    {"id": "font_display", "label": "Russo One",
     "src": "assets/fonts/russo-one-400.woff2", "weight": "400", "style": "normal"},
    {"id": "font_body", "label": "PT Serif",
     "src": "assets/fonts/pt-serif-400.woff2", "weight": "400", "style": "normal"},
    {"id": "font_body_bold", "label": "PT Serif",
     "src": "assets/fonts/pt-serif-700.woff2", "weight": "700", "style": "normal"},
    {"id": "font_body_italic", "label": "PT Serif",
     "src": "assets/fonts/pt-serif-400-italic.woff2", "weight": "400", "style": "italic"},
    {"id": "font_hand", "label": "Marck Script",
     "src": "assets/fonts/marck-script-400.woff2", "weight": "400", "style": "normal"},
]

ROLES = {"display": "font_display", "body": "font_body", "hand": "font_hand"}

FONT_NOTE = (
    "Шрифты: Russo One (заголовки), PT Serif (основной текст, 3 начертания) "
    "и Marck Script (записки и журнал) — из репозитория google/fonts, "
    "лицензия SIL Open Font License 1.1; файлы лицензий лежат рядом со "
    "шрифтами в assets/fonts/ (OFL-RussoOne.txt, OFL-PTSerif.txt, "
    "OFL-MarckScript.txt). Гарнитуры не изменены, названия сохранены, "
    "прав на шрифты не заявляем."
)


def main():
    data = json.load(open(PATH, encoding="utf-8"))
    data["fonts"] = FONTS
    theme = data.setdefault("theme", {})
    theme["fonts"] = ROLES
    theme.pop("custom_css", None)  # custom_css — только для мастера, агенту нельзя

    attr = data.setdefault("attribution", {})
    note = attr.get("note", "")
    if "Russo One" not in note:
        attr["note"] = (note.rstrip() + "\n" + FONT_NOTE).strip()

    with open(PATH, "w", encoding="utf-8") as f:
        json.dump(data, f, ensure_ascii=False, indent=2)
        f.write("\n")

    missing = [f["src"] for f in FONTS if not os.path.exists(os.path.join(ROOT, f["src"]))]
    print(f"шрифтов в реестре: {len(FONTS)}, файлов не найдено: {missing or 'нет'}")
    print("роли:", ROLES)
    return 1 if missing else 0


if __name__ == "__main__":
    sys.exit(main())
