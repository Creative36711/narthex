#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""Собирает архив кампании campaign-1.chronicle.

В архив кладутся: campaign.json, world.json, manifest.json, все модули
по манифесту, все диалоги (.ink + .dlg.json) и каталог assets/.
Служебная папка __chronicle_ai__ и инструменты tools/ внутрь не попадают.

Запуск: python3 tools/pack.py
"""
import json
import os
import sys
import zipfile

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT = os.path.join(ROOT, "campaign-1.chronicle")

MODULES = {
    "scenes": "scenes",
    "entities": "entities",
    "rules": "rules",
    "arenas": "arenas",
    "quests": "quests",
    "cutscenes": "cutscenes",
    "recipes": "recipes",
    "codex": "codex",
    "encounters": "encounters",
}


def main():
    manifest = json.load(open(os.path.join(ROOT, "manifest.json"), encoding="utf-8"))
    files = ["campaign.json", "world.json", "manifest.json"]
    missing = []

    for key, sub in MODULES.items():
        for name in manifest.get(key, []):
            for cand in (os.path.join(sub, name),
                         os.path.join("rules", name),
                         os.path.join("encounters", name)):
                if os.path.exists(os.path.join(ROOT, cand)):
                    files.append(cand)
                    break
            else:
                missing.append(f"{sub}/{name}")

    for name in manifest.get("dialogues", []):
        stem = name[:-4] if name.endswith(".ink") else name
        for cand in (os.path.join("dialogues", stem + ".ink"),
                     os.path.join("dialogues", stem + ".dlg.json")):
            if os.path.exists(os.path.join(ROOT, cand)):
                files.append(cand)
            else:
                missing.append(cand)

    for base, _, names in os.walk(os.path.join(ROOT, "assets")):
        for n in sorted(names):
            files.append(os.path.relpath(os.path.join(base, n), ROOT))

    if missing:
        print("НЕ НАЙДЕНЫ:", ", ".join(missing))
        return 1

    files = sorted(set(files))
    with zipfile.ZipFile(OUT, "w", zipfile.ZIP_DEFLATED) as z:
        for rel in files:
            z.write(os.path.join(ROOT, rel), rel.replace(os.sep, "/"))

    size = os.path.getsize(OUT)
    print(f"архив: campaign-1.chronicle — {len(files)} файлов, {size/1048576:.2f} МБ")
    return 0


if __name__ == "__main__":
    sys.exit(main())
