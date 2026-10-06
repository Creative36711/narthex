#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""Синхронизирует условия выборов из .ink в .dlg.json.

Движок исполняет .ink, но конструктор показывает .dlg.json: если условия
в конструкторе не прописаны, ветка «предъявить улику» выглядит доступной
всегда. Скрипт читает `.ink`, достаёт условия из записей
`+ { ... } [текст]` и проставляет их в те же выборы `.dlg.json`,
если тамconditions пустые.

Поддерживаются: `has_item("…")`, `get_flag("…")`, `not (…)`, `and`.
Всё остальное (например `item_count("item_mark") >= 34`) пропускается:
в конструкторе такому условию нет точного аналога.

Запуск: python3 tools/sync_conditions.py
"""
import json
import os
import re
import sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
HAS_ITEM = re.compile(r'has_item\("([^"]+)"\)')
ITEM_GE = re.compile(r'item_count\("([^"]+)"\)\s*>=\s*(\d+)')
GET_FLAG = re.compile(r'get_flag\("([^"]+)"\)')


def parse_cond(expr):
    """Строка условия ink -> список условий конструктора (поле `conds`)."""
    parts = [p.strip() for p in expr.split(" and ") if p.strip()]
    out = []
    for p in parts:
        neg = p.startswith("not (") and p.endswith(")")
        if neg:
            p = p[5:-1].strip()
        cond = None
        m = HAS_ITEM.fullmatch(p)
        if m:
            cond = {"type": "has_item", "item": m.group(1)}
        else:
            m = GET_FLAG.fullmatch(p)
            if m:
                cond = {"type": "flag", "flag": m.group(1)}
            else:
                m = ITEM_GE.fullmatch(p)
                if m:
                    cond = {"type": "item_ge", "item": m.group(1),
                            "count": int(m.group(2))}
        if cond is None:
            return None
        if neg:
            cond["not"] = True
        out.append(cond)
    return out or None


def ink_choices(text):
    """узел ink -> [(текст выбора, исходная строка условия)]"""
    res = {}
    node = None
    for line in text.split("\n"):
        s = line.strip()
        if s.startswith("==="):
            node = s.strip("= ").strip()
            res[node] = []
            continue
        if node and (s.startswith("+ ") or s.startswith("* ")):
            m = re.search(r"\{(.+?)\}\s*\[(.+?)\]", s)
            if m:
                res[node].append((m.group(2).strip(), m.group(1).strip()))
            else:
                m2 = re.search(r"\[(.+?)\]", s)
                if m2:
                    res[node].append((m2.group(1).strip(), None))
    return res


def main():
    total = 0
    for name in sorted(f[:-4] for f in os.listdir(os.path.join(ROOT, "dialogues"))
                       if f.endswith(".ink")):
        ipath = os.path.join(ROOT, "dialogues", name + ".ink")
        dpath = os.path.join(ROOT, "dialogues", name + ".dlg.json")
        if not os.path.exists(dpath):
            continue
        tree = ink_choices(open(ipath, encoding="utf-8").read())
        doc = json.load(open(dpath, encoding="utf-8"))
        changed = 0
        for node in doc["nodes"]:
            # в .ink у хаба суффикс _hub, в конструкторе его нет
            src = tree.get(node["id"]) or tree.get(node["id"] + "_hub") or []
            for ch in node.get("choices", []):
                if ch.get("conds") or ch.get("check"):
                    continue
                for text, expr in src:
                    if text == ch["text"].strip() and expr:
                        cond = parse_cond(expr)
                        if cond:
                            ch["conds"] = cond
                            changed += 1
                        break
        if changed:
            with open(dpath, "w", encoding="utf-8") as f:
                json.dump(doc, f, ensure_ascii=False, indent=1)
                f.write("\n")
            print(f"{name:12s} проставлено условий: {changed}")
            total += changed
    print(f"итого: {total}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
