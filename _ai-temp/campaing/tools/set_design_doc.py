#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""Кладёт tools/design_doc.md в campaign.json → design_doc.

Документ хранится и в репозитории отдельным файлом (удобно править),
и внутри campaign.json (этого требует формат пакета).

Запуск: python3 tools/set_design_doc.py
"""
import json
import os
import sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SRC = os.path.join(ROOT, "tools", "design_doc.md")
DST = os.path.join(ROOT, "campaign.json")


def main():
    text = open(SRC, encoding="utf-8").read().strip() + "\n"
    data = json.load(open(DST, encoding="utf-8"))
    data["design_doc"] = text
    with open(DST, "w", encoding="utf-8") as f:
        json.dump(data, f, ensure_ascii=False, indent=2)
        f.write("\n")
    print(f"design_doc обновлён: {len(text)} знаков, {text.count(chr(10))} строк")
    return 0


if __name__ == "__main__":
    sys.exit(main())
