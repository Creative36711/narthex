#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""Жук больше не продаёт одну и ту же улику дважды (ход 10).

Что было не так: и Жук, и архивный наряд давали флаг `clue_roster` и
увеличивали счётчик улик. Игрок, который прошёл оба пути, получал две улики
за одну — счётчик врал, а порог «три улики» проходился двумя находками.

Что делает скрипт:
  * правило `rule_zhuk_info` срабатывает, только если про наряд ещё ничего
    не известно;
  * вместо него у Жука появляется отдельная ветка для тех, кто наряд уже
    достал: он указывает, где мастер спрятал гроссбух (схрон в штольне) —
    то есть платный путь не обесценивается, а просто даёт другое знание;
  * новый флаг `zhuk_cache_hint` регистрируется в реестре.

Правятся оба представления диалога: `zhuk.ink` (исполняет движок) и
`zhuk.dlg.json` (конструктор).

Запуск: python3 tools/story_add.py
"""
import json
import os
import sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))

INK_CHOICE = '''+ { get_flag("clue_roster") and not (get_flag("zhuk_cache_hint")) } [Ты и сам знаешь, кто стоял. Что ещё?]
    Жук кривится, но рук не прячет: тогда слушай другое. Гроссбух он не в конторе держал и не в каморке: он его в штольне спрятал, там, где спал, под плитой. Ищи, где у мастера была постель. # emotion: thoughtful
    ~ set_flag("zhuk_cache_hint")
    -> Начало_hub'''

DLG_CHOICE = {
    "text": "Ты и сам знаешь, кто стоял. Что ещё?",
    "sections": [{
        "steps": [
            {"kind": "line",
             "line": {"text": "Жук кривится, но рук не прячет: тогда слушай "
                              "другое. Гроссбух он не в конторе держал и не в "
                              "каморке: он его в штольне спрятал, там, где "
                              "спал, под плитой. Ищи, где у мастера была "
                              "постель.",
                      "emotion": "thoughtful"}},
            {"kind": "effect",
             "effect": {"type": "set_flag", "flag": "zhuk_cache_hint"}}]}],
    "goto": "stay",
    "conds": [{"type": "flag", "flag": "clue_roster"},
              {"type": "flag", "flag": "zhuk_cache_hint", "not": True}],
}

FLAG = {"id": "zhuk_cache_hint", "label": "Жук указал на схрон",
        "description": "Жук сказал, где мастер держал гроссбух: не в конторе и "
                       "не в каморке, а в штольне, под плитой у своей постели. "
                       "Читается веткой разговора с Жуком для тех, кто уже "
                       "достал наряд раньше и не нуждается в этой улике."}


def load(p):
    return json.load(open(os.path.join(ROOT, p), encoding="utf-8"))


def save(p, o):
    with open(os.path.join(ROOT, p), "w", encoding="utf-8") as f:
        json.dump(o, f, ensure_ascii=False, indent=1)
        f.write("\n")


def main():
    os.chdir(ROOT)

    # 1. правило: улика выдаётся один раз
    p = "rules/rule_zhuk_info.json"
    r = load(p)
    conds = r.get("conditions") or []
    if not any(c.get("flag") == "clue_roster" for c in conds):
        conds.append({"type": "flag_not_set", "flag": "clue_roster"})
        r["conditions"] = conds
        save(p, r)
        print("rule_zhuk_info: не выдавать улику повторно")
    else:
        print("rule_zhuk_info: условие уже стоит")

    # 2. новая ветка в ink
    p = "dialogues/zhuk.ink"
    s = open(p, encoding="utf-8").read()
    if "zhuk_cache_hint" not in s:
        marker = "* [Где мастер?]"
        assert marker in s, "нет маркера для вставки"
        s = s.replace(marker, INK_CHOICE + "\n" + marker, 1)
        open(p, "w", encoding="utf-8").write(s)
        print("zhuk.ink: ветка добавлена")
    else:
        print("zhuk.ink: ветка уже есть")

    # 3. та же ветка в конструкторе
    p = "dialogues/zhuk.dlg.json"
    d = load(p)
    for node in d["nodes"]:
        if node["id"] != "Начало":
            continue
        if any(c.get("text") == DLG_CHOICE["text"] for c in node.get("choices", [])):
            print("zhuk.dlg.json: ветка уже есть")
            break
        choices = node.setdefault("choices", [])
        # ставим перед «Где мастер?»
        idx = next((i for i, c in enumerate(choices)
                    if c.get("text") == "Где мастер?"), len(choices))
        choices.insert(idx, DLG_CHOICE)
        save(p, d)
        print(f"zhuk.dlg.json: ветка добавлена на место {idx}")
        break

    # 4. флаг в реестр
    c = load("campaign.json")
    if not any(f["id"] == FLAG["id"] for f in c["flags"]):
        c["flags"].append(FLAG)
        save("campaign.json", c)
        print("campaign.json: флаг zhuk_cache_hint записан")
    else:
        print("campaign.json: флаг уже есть")
    return 0


if __name__ == "__main__":
    sys.exit(main())
