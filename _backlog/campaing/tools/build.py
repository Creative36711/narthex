"""Сборка Campaign Package «Литания ржавых колоколов».

Запуск: python3 tools/build.py [--zip]
Пишет модули в корень репозитория и (с --zip) архив dist/<name>.chronicle.
"""
import json
import os
import re
import shutil
import sys
import zipfile

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(HERE)
sys.path.insert(0, HERE)

import scenes as S  # noqa: E402
import entities as E  # noqa: E402
import logic as L  # noqa: E402
import meta as M  # noqa: E402

MODULE_DIRS = ["scenes", "entities", "rules", "quests", "arenas", "cutscenes", "recipes", "codex"]
ARCHIVE_NAME = "litaniya-rzhavyh-kolokolov.chronicle"


def asset_exists(p):
    return bool(p) and os.path.isfile(os.path.join(ROOT, p))


def blank_missing_images(obj, path=""):
    """Пути к отсутствующим картинкам заменяем на пустую строку."""
    if isinstance(obj, dict):
        for k, v in obj.items():
            if isinstance(v, str) and v.startswith("assets/") and not asset_exists(v):
                obj[k] = ""
            else:
                blank_missing_images(v, path + "/" + k)
    elif isinstance(obj, list):
        for v in obj:
            blank_missing_images(v, path)


def as_dict(x):
    if isinstance(x, dict):
        return x
    return {o["id"]: o for o in x}


def collect(obj, key_names, out):
    if isinstance(obj, dict):
        for k, v in obj.items():
            if k in key_names and isinstance(v, str):
                out.append((k, v))
            elif k in key_names and isinstance(v, list):
                for i in v:
                    if isinstance(i, str):
                        out.append((k, i))
            collect(v, key_names, out)
    elif isinstance(obj, list):
        for v in obj:
            collect(v, key_names, out)


def all_strings(obj, out):
    if isinstance(obj, dict):
        for v in obj.values():
            all_strings(v, out)
    elif isinstance(obj, list):
        for v in obj:
            all_strings(v, out)
    elif isinstance(obj, str):
        out.append(obj)


ID_RE = re.compile(r"^(region|loc|scene|npc|item|player|rule|quest|stage|arena|cutscene|enc|recipe|codex|status|ability|music|amb|sfx|ending|ch|diff|ach|faction|profession|calling|weather)_[a-z0-9_]+$")


def main(do_zip):
    world = S.build_world()
    scenes = as_dict(S.build_scenes())
    ents = as_dict(E.build_entities())
    rules = as_dict(L.build_rules())
    quests = as_dict(L.build_quests())
    arenas = as_dict(L.build_arenas())
    cuts = as_dict(L.build_cutscenes())
    recipes = as_dict(L.build_recipes())
    codex = as_dict(L.build_codex())
    enc = {k: (v if isinstance(v, list) else [v]) for k, v in L.build_encounters().items()}
    with open(os.path.join(HERE, "design_doc.md"), encoding="utf-8") as f:
        design_doc = f.read()
    camp = M.build_meta(design_doc, asset_exists)

    dialogues = sorted(fn for fn in os.listdir(os.path.join(ROOT, "dialogues")) if fn.endswith(".ink"))

    for blob in (world, scenes, ents, rules, quests, arenas, cuts, recipes, codex, camp):
        blank_missing_images(blob)

    # ---------------- проверки ссылок
    errs = []
    defined = set(scenes) | set(ents) | set(rules) | set(quests) | set(arenas) | set(cuts) | set(recipes) | set(codex)
    for r in world["regions"]:
        defined.add(r["id"])
        for loc in r.get("locations", []):
            defined.add(loc["id"])
    for q in quests.values():
        for st in q.get("stages", []):
            defined.add(st["id"])
    for stem, tables in enc.items():
        for t in tables:
            defined.add(t["id"])
    for key in ("statuses", "abilities", "music_tracks", "sounds", "endings", "chapters", "difficulties", "factions", "weathers"):
        for o in camp.get(key, []):
            defined.add(o["id"])
    for o in camp.get("metaprogress", {}).get("achievements", []):
        defined.add(o["id"])
    cc = camp.get("char_creation", {})
    for o in cc.get("professions", []) + cc.get("callings", []):
        defined.add(o["id"])
    ambient_ids = {s["id"] for s in camp.get("sounds", [])}
    defined |= ambient_ids

    everything = [world, scenes, ents, rules, quests, arenas, cuts, recipes, codex, enc, camp]
    strs = []
    all_strings(everything, strs)
    types = []
    collect(everything, {"type"}, types)
    skip = set(M.FLAG_LABELS) | {t for _, t in types}
    for s in set(strs):
        if ID_RE.match(s) and s not in defined and s not in skip:
            errs.append(f"не определён id: {s}")

    flags = []
    collect(everything, {"flag"}, flags)
    for _, fl in flags:
        if fl not in M.FLAG_LABELS:
            errs.append(f"флаг вне реестра: {fl}")

    ink_flags, ink_ids = set(), set()
    for fn in dialogues:
        src = open(os.path.join(ROOT, "dialogues", fn), encoding="utf-8").read()
        ink_flags |= set(re.findall(r'(?:get_flag|set_flag)\("([^"]+)"\)', src))
        ink_ids |= set(re.findall(r'"([a-z]+_[a-z0-9_]+)"', src))
    for fl in ink_flags:
        if fl not in M.FLAG_LABELS:
            errs.append(f"флаг из диалога вне реестра: {fl}")
    for i in ink_ids - ink_flags:
        if ID_RE.match(i) and i not in defined:
            errs.append(f"диалог ссылается на неизвестный id: {i}")
    for e in ents.values():
        d = e.get("dialogue")
        if d and (not d.startswith("dialogues/") or d[len("dialogues/"):] not in dialogues):
            errs.append(f"{e['id']}: нет диалога {d}.ink")

    used_flags = {f for _, f in flags} | ink_flags
    unused = sorted(set(M.FLAG_LABELS) - used_flags)
    if unused:
        print("флаги реестра без использования:", unused)

    # ---------------- запись
    for d in MODULE_DIRS:
        p = os.path.join(ROOT, d)
        if os.path.isdir(p):
            shutil.rmtree(p)
        os.makedirs(p)

    def dump(rel, obj):
        with open(os.path.join(ROOT, rel), "w", encoding="utf-8") as f:
            json.dump(obj, f, ensure_ascii=False, indent=2)
            f.write("\n")

    manifest = {"scenes": [], "entities": [], "rules": [], "dialogues": dialogues,
                "arenas": [], "quests": [], "encounters": [], "cutscenes": [], "recipes": [], "codex": []}
    for d, blob in (("scenes", scenes), ("entities", ents), ("rules", rules), ("quests", quests), ("arenas", arenas),
                    ("cutscenes", cuts), ("recipes", recipes), ("codex", codex)):
        for k, v in blob.items():
            assert v["id"] == k
            dump(f"{d}/{k}.json", v)
            manifest[d].append(f"{k}.json")
    for stem, tables in enc.items():
        dump(f"rules/{stem}.json", {"encounter_tables": tables})
        manifest["encounters"].append(f"{stem}.json")
    dump("campaign.json", camp)
    dump("world.json", world)
    dump("manifest.json", manifest)

    # ---------------- схема
    try:
        import jsonschema
    except ImportError:
        jsonschema = None
        print("jsonschema не установлен — проверка схемы пропущена")
    if jsonschema:
        schema = json.load(open(os.path.join(ROOT, "__chronicle_ai__", "campaign.schema.json"), encoding="utf-8"))
        defs = schema.get("$defs") or schema.get("definitions")

        def check(obj, name, where):
            sch = {"$schema": schema.get("$schema", "http://json-schema.org/draft-07/schema#"), "$ref": f"#/$defs/{name}", "$defs": defs}
            v = jsonschema.Draft7Validator(sch) if "draft-07" in sch["$schema"] else jsonschema.validators.validator_for(sch)(sch)
            for er in sorted(v.iter_errors(obj), key=lambda e: list(e.path)):
                errs.append(f"схема {where} {'/'.join(map(str, er.path))}: {er.message[:300]}")

        check(camp, "CampaignMeta", "campaign.json")
        check(world, "WorldDef", "world.json")
        check(manifest, "CampaignManifest", "manifest.json")
        for k, v in scenes.items():
            check(v, "SceneDef", k)
        for k, v in ents.items():
            check(v, "EntityDef", k)
        for k, v in rules.items():
            check(v, "RuleDef", k)
        for k, v in quests.items():
            check(v, "QuestDef", k)
        for k, v in arenas.items():
            check(v, "ArenaDef", k)
        for k, v in cuts.items():
            check(v, "CutsceneDef", k)
        for k, v in recipes.items():
            check(v, "RecipeDef", k)
        for k, v in codex.items():
            check(v, "CodexEntryDef", k)
        for stem, tables in enc.items():
            check({"encounter_tables": tables}, "EncounterFileDef", stem)

    if errs:
        print(f"ОШИБОК: {len(errs)}")
        for e in errs[:200]:
            print(" -", e)
        sys.exit(1)

    print(f"OK: сцен {len(scenes)}, сущностей {len(ents)}, правил {len(rules)}, квестов {len(quests)}, арен {len(arenas)}, "
          f"катсцен {len(cuts)}, рецептов {len(recipes)}, кодекса {len(codex)}, диалогов {len(dialogues)}")

    if do_zip:
        os.makedirs(os.path.join(ROOT, "dist"), exist_ok=True)
        out = os.path.join(ROOT, ARCHIVE_NAME)
        files = ["campaign.json", "world.json", "manifest.json"]
        for d in MODULE_DIRS + ["dialogues"]:
            for fn in sorted(os.listdir(os.path.join(ROOT, d))):
                files.append(f"{d}/{fn}")
        assets = os.path.join(ROOT, "assets")
        if os.path.isdir(assets):
            for dp, _, fns in os.walk(assets):
                for fn in sorted(fns):
                    files.append(os.path.relpath(os.path.join(dp, fn), ROOT))
        with zipfile.ZipFile(out, "w", zipfile.ZIP_DEFLATED) as z:
            for rel in files:
                z.write(os.path.join(ROOT, rel), rel)
        print("архив:", out, os.path.getsize(out), "байт,", len(files), "файлов")


if __name__ == "__main__":
    main("--zip" in sys.argv)
