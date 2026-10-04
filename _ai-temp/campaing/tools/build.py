"""Сборка пакета кампании: запись модулей, manifest.json и .chronicle архива."""

import json
import os
import shutil
import sys
import zipfile

import content_meta
import content_world
import content_entities
import content_rules
import content_dialogues

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.normpath(os.path.join(HERE, ".."))
PKG = os.path.join(ROOT, "package")
ARCHIVE = os.path.join(ROOT, "karkas_mednoe_serdce.chronicle")


def w(rel, data):
    path = os.path.join(PKG, rel)
    os.makedirs(os.path.dirname(path), exist_ok=True)
    with open(path, "w", encoding="utf-8") as f:
        json.dump(data, f, ensure_ascii=False, indent=2)
        f.write("\n")


def wtxt(rel, data):
    path = os.path.join(PKG, rel)
    os.makedirs(os.path.dirname(path), exist_ok=True)
    with open(path, "w", encoding="utf-8") as f:
        f.write(data)


def sorted_ids(d):
    return [d[k] for k in sorted(d)]


def main():
    if os.path.isdir(PKG):
        shutil.rmtree(PKG)
    os.makedirs(PKG)

    campaign = content_meta.build()

    world_doc = content_world.world()
    scenes = content_world.scenes()

    all_entities = content_entities.entities()

    rules = content_rules.rules()
    quests = content_rules.quests()
    arenas = content_rules.arenas()
    cutscenes = content_rules.cutscenes()
    recipes = content_rules.recipes()
    codex = content_rules.codex()
    tables = content_rules.encounter_tables()

    w("campaign.json", campaign)
    w("world.json", world_doc)

    for sid in sorted(scenes):
        w(f"scenes/{sid}.json", scenes[sid])
    for eid in sorted(all_entities):
        w(f"entities/{eid}.json", all_entities[eid])
    for rid in sorted(rules):
        w(f"rules/{rid}.json", rules[rid])
    w("rules/encounters.json", {"encounter_tables": sorted_ids(tables)})
    for qid in sorted(quests):
        w(f"quests/{qid}.json", quests[qid])
    for aid in sorted(arenas):
        w(f"arenas/{aid}.json", arenas[aid])
    for cid in sorted(cutscenes):
        w(f"cutscenes/{cid}.json", cutscenes[cid])
    for rid in sorted(recipes):
        w(f"recipes/{rid}.json", recipes[rid])
    for cid in sorted(codex):
        w(f"codex/{cid}.json", codex[cid])
    dlg_text = content_dialogues.dialogues()
    for name in sorted(dlg_text):
        wtxt(f"dialogues/{name}.ink", dlg_text[name])

    manifest = {
        "scenes": [f"{sid}.json" for sid in sorted(scenes)],
        "entities": [f"{eid}.json" for eid in sorted(all_entities)],
        "rules": [f"{rid}.json" for rid in sorted(rules)],
        "arenas": [f"{aid}.json" for aid in sorted(arenas)],
        "quests": [f"{qid}.json" for qid in sorted(quests)],
        "encounters": ["encounters.json"],
        "cutscenes": [f"{cid}.json" for cid in sorted(cutscenes)],
        "recipes": [f"{rid}.json" for rid in sorted(recipes)],
        "codex": [f"{cid}.json" for cid in sorted(codex)],
        "dialogues": [f"{name}.ink" for name in sorted(content_dialogues.dialogues())],
    }
    w("manifest.json", manifest)

    assets = os.path.join(ROOT, "assets")
    if os.path.isdir(assets):
        shutil.copytree(assets, os.path.join(PKG, "assets"))

    if os.path.exists(ARCHIVE):
        os.remove(ARCHIVE)
    with zipfile.ZipFile(ARCHIVE, "w", zipfile.ZIP_DEFLATED) as z:
        for dirpath, dirnames, filenames in os.walk(PKG):
            dirnames[:] = [d for d in dirnames if d != "__chronicle_ai__"]
            for fn in sorted(filenames):
                full = os.path.join(dirpath, fn)
                z.write(full, os.path.relpath(full, PKG))

    total = sum(len(v) for v in manifest.values())
    print(f"сцен: {len(scenes)}, сущностей: {len(all_entities)}, правил: {len(rules)}, "
          f"квестов: {len(quests)}, арен: {len(arenas)}, катсцен: {len(cutscenes)}, "
          f"рецептов: {len(recipes)}, кодекс: {len(codex)}, диалогов: {len(manifest['dialogues'])}")
    print(f"файлов в пакете: {total + 3}, архив: {os.path.getsize(ARCHIVE) / 1024:.0f} КБ")


if __name__ == "__main__":
    main()
