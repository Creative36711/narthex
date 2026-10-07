#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""Ход 19: движок обновился — подключаем новые поля.

Что дал движок и что из этого берём:

1. **`meta.deadline_ticks` и `meta.deadline_label`** — обратный отсчёт в HUD
   (`⏳ 48 ч`), подсветка янтарным за сутки до срока и пульсация красным
   после. Кампания вся держится на семидесяти двух часах, а увидеть остаток
   игрок не мог никак: срок жил в правилах и в записи журнала. Теперь он на
   экране. Дедлайн — 72 тика: старт в семь утра (тик 7), вода идёт на
   семьдесят девятом тику; 79 − 7 = 72.
2. **Типографика**: `theme.font_scale`, `theme.font_sizes` (body/display/
   dialogue/ui), `theme.line_height`, `theme.letter_spacing` и `size_adjust`
   у отдельной гарнитуры. Ровно то, чего не хватало с прошлого хода: раньше
   мелкий рукописный шрифт можно было вылечить только заменой гарнитуры.
   Теперь кегли заданы явно, а рукописной Neucha добавлен масштаб 1,2 —
   строчная у неё крупная, но сам почерк визуально легче наборного.
3. **Звуки панелей: уточнённые ключи.** Выяснилось, что `panel:log` и
   `panel:journal` — синонимы одной панели (журнал расследования, он же
   хроника событий): из-за этого «Дело №137» и «Хроника» в прошлом ходу
   получили разные звуки и звучали кто во что горазд. Теперь оба ключа ведут
   к одному звуку. Добавились `panel:meta` (хроника забегов), `panel:saves`,
   `panel:help` и боевой хук `error` — невозможное действие.
4. **История разговора** (кнопка «История» в диалоге) делается движком сама,
   данных не требует.

Скрипт перезапускаемый.

Запуск: python3 tools/engine19.py
"""
import json
import os

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))

DEADLINE_TICKS = 72
DEADLINE_LABEL = "До срока"

TYPO = {
    "font_scale": 1.05,
    "font_sizes": {"body": 16, "display": 21, "dialogue": 16, "ui": 14},
    "line_height": 1.6,
    "letter_spacing": "0.01em",
}

# id гарнитуры -> size_adjust
SIZE_ADJUST = {
    "font_display": 0.95,        # Russo One: широкий тяжёлый гротеск
    "font_body": 1.0,
    "font_body_bold": 1.0,
    "font_body_italic": 1.0,
    "font_hand": 1.2,            # Neucha: рукописная, визуально легче наборной
    "font_hand_cursive": 1.3,    # Marck Script в запасе: совсем мелкая
}

# ключи панелей: один и тот же звук на журнал расследования и его синоним
PANELS = {
    "panel:journal": "sfx_journal_open",
    "panel:journal:close": "sfx_journal_close",
    "panel:log": "sfx_journal_open",
    "panel:log:close": "sfx_journal_close",
    "panel:codex": "sfx_archive_open",
    "panel:codex:close": "sfx_archive_close",
    "panel:meta": "snd_page",
    "panel:meta:close": "snd_paper",
    "panel:chronicle": "snd_page",
    "panel:chronicle:close": "snd_paper",
    "panel:map": "snd_paper",
    "panel:map:close": "sfx_flip",
    "panel:inventory": "snd_cloth",
    "panel:inventory:close": "sfx_bag_close",
    "panel:character": "snd_cloth",
    "panel:character:close": "sfx_bag_close",
    "panel:craft": "sfx_anvil",
    "panel:craft:close": "snd_latch",
    "panel:saves": "snd_latch",
    "panel:saves:close": "snd_latch",
    "panel:help": "snd_paper",
    "panel:help:close": "snd_paper",
    "panel:open": "sfx_door",
    "panel:close": "snd_cloth",
    "error": "sfx_error",
}

# догадки прошлого хода: движок их не знает, убираем, чтобы карта была честной
DROP = ("panel:quest", "panel:quest:close", "panel:quests", "panel:quests:close")


def load(rel):
    with open(os.path.join(ROOT, rel), encoding="utf-8") as f:
        return json.load(f)


def save(rel, data):
    with open(os.path.join(ROOT, rel), "w", encoding="utf-8") as f:
        json.dump(data, f, ensure_ascii=False, indent=2)
        f.write("\n")


def main():
    cam = load("campaign.json")

    # 1. дедлайн в HUD
    cam["deadline_ticks"] = DEADLINE_TICKS
    cam["deadline_label"] = DEADLINE_LABEL
    print(f"дедлайн: {DEADLINE_TICKS} тиков, подпись «{DEADLINE_LABEL}» "
          f"(старт {cam['starting_tick']}, вода на {cam['starting_tick'] + DEADLINE_TICKS}-м тику)")

    # 2. типографика
    theme = cam.setdefault("theme", {})
    for k, v in TYPO.items():
        theme[k] = v
    print("типографика:", json.dumps({k: theme[k] for k in TYPO}, ensure_ascii=False))

    for f in cam.get("fonts", []):
        if f["id"] in SIZE_ADJUST:
            f["size_adjust"] = SIZE_ADJUST[f["id"]]
    print("масштаб гарнитур:", ", ".join(
        f"{i}={SIZE_ADJUST[i]}" for i in SIZE_ADJUST))

    # 3. звуки панелей
    ui = cam.setdefault("ui_sounds", {})
    for k in DROP:
        ui.pop(k, None)
    ui.update(PANELS)
    print("хуков панелей:", len(ui))

    save("campaign.json", cam)


if __name__ == "__main__":
    main()
