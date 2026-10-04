# -*- coding: utf-8 -*-
"""Проверка собранного Campaign Package: схема, ссылки, бюджеты, медиа.

Запуск: python3 tools/validate_campaign.py [путь к распакованному пакету]
Печатает отчёт и возвращает код 1, если есть ошибки.
"""
import json
import re
import sys
from pathlib import Path

from jsonschema import Draft202012Validator

ROOT = Path(__file__).resolve().parent.parent
SCHEMA_PATH = ROOT / "__chronicle_ai__" / "campaign.schema.json"
PKG = Path(sys.argv[1]) if len(sys.argv) > 1 else ROOT / "campaign_package"

errors, warnings, notes = [], [], []


def err(msg):
    errors.append(msg)


def warn(msg):
    warnings.append(msg)


def load(p):
    return json.loads(Path(p).read_text(encoding="utf-8"))


def schema_validate():
    schema = load(SCHEMA_PATH)
    defs = {"#/$defs/" + k: v for k, v in schema["$defs"].items()}
    model = dict(schema)
    model.update(defs)

    def check(rel_path, def_name, quiet=False):
        path = PKG / rel_path
        data = load(path)
        inner = {"$ref": "#/$defs/" + def_name}
        sub = dict(model)
        sub.update(inner)
        v = Draft202012Validator(sub)
        bad = sorted(v.iter_errors(data), key=lambda e: list(e.path))
        for e in bad:
            where = "/".join(str(x) for x in e.path) or "(корень)"
            err("%s → %s: %s [%s]" % (rel_path, where, e.message[:200], def_name))
        return data

    campaign = check("campaign.json", "CampaignMeta")
    check("world.json", "WorldDef")
    check("manifest.json", "CampaignManifest")

    manifest = load(PKG / "manifest.json")
    for name in manifest["scenes"]:
        check("scenes/" + name, "SceneDef")
    for name in manifest["entities"]:
        check("entities/" + name, "EntityDef")
    for name in manifest["rules"]:
        check("rules/" + name, "RuleDef")
    for name in manifest["encounters"]:
        check("rules/" + name, "EncounterFileDef")
    for name in manifest["quests"]:
        check("quests/" + name, "QuestDef")
    for name in manifest["arenas"]:
        check("arenas/" + name, "ArenaDef")
    for name in manifest["cutscenes"]:
        check("cutscenes/" + name, "CutsceneDef")
    for name in manifest["recipes"]:
        check("recipes/" + name, "RecipeDef")
    for name in manifest["codex"]:
        check("codex/" + name, "CodexEntryDef")
    for name in manifest["dialogues"]:
        check("dialogues/" + name.replace(".ink", ".dlg.json"), "DlgDoc")
    return campaign, manifest


def collect_ids(campaign, manifest):
    ids = {
        "scene": set(), "entity": set(), "rule": set(), "quest": set(), "arena": set(),
        "cutscene": set(), "recipe": set(), "codex": set(), "encounter": set(),
        "status": {s["id"] for s in campaign.get("statuses", [])},
        "ability": {a["id"] for a in campaign.get("abilities", [])},
        "skill": {s["id"] for s in campaign.get("skills", [])},
        "flag": {f["id"] for f in campaign.get("flags", [])},
        "faction": {f["id"] for f in campaign.get("factions", [])},
        "need": {n["id"] for n in campaign.get("needs", [])},
        "item_category": {c["id"] for c in campaign.get("item_categories", [])},
        "slot_type": {s["id"] for s in campaign.get("slot_types", [])},
        "equipment_slot": {s["id"] for s in campaign.get("equipment_slots", [])},
        "music": {m["id"] for m in campaign.get("music_tracks", [])},
        "sound": {s["id"] for s in campaign.get("sounds", [])},
        "emotion": {e["id"] for e in campaign.get("emotions", [])},
        "chapter": {c["id"] for c in campaign.get("chapters", [])},
        "currency": {c["id"] for c in campaign.get("currencies", [])},
        "weather": {w["id"] for w in campaign.get("weathers", [])},
        "overlay": {o["id"] for o in campaign.get("overlay_layers", [])},
        "codex_category": {c["id"] for c in campaign.get("codex_categories", [])},
        "ending": {e["id"] for e in campaign.get("endings", [])},
        "difficulty": {d["id"] for d in campaign.get("difficulties", [])},
        "quest_stage": set(),
        "dialogue": {n.replace(".ink", "") for n in manifest["dialogues"]},
        "location": set(),
        "region": set(),
        "generator": {g["id"] for g in campaign.get("generators", {}).get("event_tables", [])},
        "meta_currency": {c["id"] for c in campaign.get("metaprogress", {}).get("currencies", [])},
        "feat": {f["id"] for f in campaign.get("progression", {}).get("feats", [])} if campaign.get("progression") else set(),
        "crime": {c["id"] for c in campaign.get("crimes", [])},
        "price_event": {p["id"] for p in campaign.get("price_events", [])},
        "profession": {p["id"] for p in campaign["char_creation"]["professions"]},
        "calling": {c["id"] for c in campaign["char_creation"]["callings"]},
    }
    for name in manifest["scenes"]:
        ids["scene"].add(name.replace(".json", ""))
    for name in manifest["entities"]:
        ids["entity"].add(name.replace(".json", ""))
    for name in manifest["rules"]:
        ids["rule"].add(name.replace(".json", ""))
    for name in manifest["quests"]:
        ids["quest"].add(name.replace(".json", ""))
    for name in manifest["arenas"]:
        ids["arena"].add(name.replace(".json", ""))
    for name in manifest["cutscenes"]:
        ids["cutscene"].add(name.replace(".json", ""))
    for name in manifest["recipes"]:
        ids["recipe"].add(name.replace(".json", ""))
    for name in manifest["codex"]:
        ids["codex"].add(name.replace(".json", ""))
    for name in manifest["encounters"]:
        ids["encounter"].add(name.replace(".json", ""))
    for r in ids["region"] if False else []:
        pass
    world = load(PKG / "world.json")
    for reg in world["regions"]:
        ids["region"].add(reg["id"])
        for loc in reg["locations"]:
            ids["location"].add(loc["id"])
            for sub in loc.get("scenes", []):
                ids["scene"].add(sub)
    for name in manifest["quests"]:
        q = load(PKG / "quests" / name)
        for st in q["stages"]:
            ids["quest_stage"].add("%s::%s" % (q["id"], st["id"]))
    return ids


EFFECT_ITEM_FIELDS = {
    "add_item": ("item", "item"), "remove_item": ("item", "item"),
    "give_reward": ("items", "item_list"), "use_item": ("item", "item"),
}
TEXT_FIELDS_FOR_IDS = {}


def walk(node, path, found):
    if isinstance(node, dict):
        t = node.get("type")
        if isinstance(t, str) and "ref" not in node:
            found.append((t, node, path))
        for k, v in node.items():
            walk(v, path + "/" + k, found)
    elif isinstance(node, list):
        for i, v in enumerate(node):
            walk(v, path + "/%d" % i, found)


def check_references(campaign, manifest, ids):
    """Собираем все ссылки известных типов и сверяем с реестрами."""
    refs = []  # (what, id, where)

    def scan(obj, where):
        if isinstance(obj, dict):
            for k, v in obj.items():
                scan_ref(k, v, where)
                scan(v, where)
        elif isinstance(obj, list):
            for v in obj:
                scan(v, where)

    SCALAR = {
        "location": "location", "scene": "scene", "quest": "quest", "stage": "quest_stage_raw",
        "arena": "arena", "cutscene": "cutscene", "recipe": "recipe", "entry": "codex",
        "status": "status", "skill": "skill", "need": "need", "weather": "weather",
        "flag": "flag", "region": "region", "entity": "entity", "cutscene_id": "cutscene",
        "table": "generator", "generator": "generator",
    }
    LIST_KEYS = {"enemies": "entity", "allies": "entity", "items": "item", "tracks": "music",
                 "conditions": None, "effects": None, "rules": "rule", "ambient": "sound",
                 "ambient_audio": "sound", "scenes": "scene", "recipe": "recipe"}

    def scan_ref(k, v, where):
        if isinstance(v, (dict, list)) and k in ("item", "entity", "scene", "location", "quest",
                                                 "arena", "cutscene", "recipe", "entry",
                                                 "status", "skill", "need", "weather", "flag",
                                                 "faction", "rules", "rule", "music"):
            return
        if k == "item" and isinstance(v, str):
            refs.append(("item", v, where))
        elif k == "items" and isinstance(v, list):
            for x in v:
                if isinstance(x, str):
                    refs.append(("item", x, where))
                elif isinstance(x, dict) and isinstance(x.get("item"), str):
                    refs.append(("item", x["item"], where))
        elif k == "entity" and isinstance(v, str):
            refs.append(("entity", v, where))
        elif k == "scene" and isinstance(v, str):
            refs.append(("scene", v, where))
        elif k == "location" and isinstance(v, str):
            refs.append(("location", v, where))
        elif k == "quest" and isinstance(v, str):
            refs.append(("quest", v, where))
        elif k == "arena" and isinstance(v, str) and v:
            refs.append(("arena", v, where))
        elif k == "cutscene" and isinstance(v, str):
            refs.append(("cutscene", v, where))
        elif k == "recipe" and isinstance(v, str):
            refs.append(("recipe", v, where))
        elif k in ("rule", "rules") :
            if isinstance(v, str):
                refs.append(("rule", v, where))
            elif isinstance(v, list):
                for x in v:
                    if isinstance(x, str):
                        refs.append(("rule", x, where))
        elif k == "entry" and isinstance(v, str):
            refs.append(("codex", v, where))
        elif k == "status" and isinstance(v, str):
            refs.append(("status", v, where))
        elif k in ("skill", "against_skill") and isinstance(v, str) and v:
            refs.append(("skill", v, where))
        elif k == "need" and isinstance(v, str):
            refs.append(("need", v, where))
        elif k == "weather" and isinstance(v, str) and v:
            refs.append(("weather", v, where))
        elif k == "flag" and isinstance(v, str):
            refs.append(("flag", v, where))
        elif k in ("not_flag",) and isinstance(v, str):
            refs.append(("flag", v, where))
        elif k == "faction" and isinstance(v, str) and v:
            refs.append(("faction", v, where))
        elif k == "target" and isinstance(v, str) and v.startswith(("npc_", "faction_")):
            refs.append(("faction_or_entity", v, where))
        elif k == "slot" and isinstance(v, str) and v:
            refs.append(("slot", v, where))
        elif k == "music" and isinstance(v, str) and v:
            refs.append(("music", v, where))
        elif k == "tracks" and isinstance(v, list):
            for x in v:
                refs.append(("music", x, where))
        elif k == "image" and isinstance(v, str) and v.startswith("assets/"):
            refs.append(("image", v, where))
        elif k == "portrait" and isinstance(v, dict):
            for _, iv in v.items():
                _img(iv, refs, where)
        elif k in ("scene_sprite", "combat_figure", "map_image", "token", "icon",
                   "background", "title_art", "frame") :
            _img(v, refs, where)
        elif k in ("ambient", "ambient_audio") and isinstance(v, str) and v:
            refs.append(("sound", v, where))
        elif k == "abilities" and isinstance(v, list):
            for x in v:
                refs.append(("ability", x, where))
        elif k == "id" and isinstance(v, str):
            pass

    def _img(v, refs, where):
        if isinstance(v, str) and v.startswith("assets/"):
            refs.append(("image", v, where))
        elif isinstance(v, list):
            for x in v:
                _img(x, refs, where)
        elif isinstance(v, dict):
            for x in v.get("frames", []):
                _img(x, refs, where)

    files = ["campaign.json", "world.json"]
    for key in ("scenes", "entities", "rules", "quests", "arenas", "cutscenes", "recipes", "codex"):
        files += [key + "/" + n for n in manifest[key]]
    files += ["dialogues/" + n.replace(".ink", ".dlg.json") for n in manifest["dialogues"]]

    for f in files:
        scan(load(PKG / f), f)

    # отдельно: интерактив предметов и сцены
    for name in manifest["entities"]:
        e = load(PKG / "entities" / name)
        for io in e.get("interact_options", []) or []:
            scan({"effects": io.get("effects", []), "conditions": io.get("conditions", [])},
                 "entities/" + name + "/interact_options")
    for name in manifest["scenes"]:
        sc = load(PKG / "scenes" / name)
        for slot in sc.get("slots", []):
            if slot.get("default_entity"):
                refs.append(("entity", slot["default_entity"], "scenes/" + name))
            for uw in slot.get("use_with", []) or []:
                refs.append(("item", uw["item"], "scenes/" + name))
                scan({"effects": uw.get("effects", [])}, "scenes/" + name + "/use_with")

    def resolve(kind, value):
        if kind == "image":
            return None
        if kind == "faction_or_entity":
            return value in ids["faction"] or value in ids["entity"]
        if kind == "quest_stage_raw":
            return any(v.startswith(value + "::") or v.endswith("::" + value)
                       for v in ids["quest_stage"]) or value in ids["quest_stage"]
        if kind in ids:
            return value in ids[kind]
        return True

    unknown = {}
    refs = [(k, v, w) for (k, v, w) in refs if isinstance(v, str)]
    for kind, value, where in refs:
        if kind == "slot":
            continue
        if not resolve(kind, value):
            unknown.setdefault((kind, value), []).append(where)

    for (kind, value), wheres in sorted(unknown.items()):
        if kind == "image":
            continue
        warn("неизвестная ссылка (%s): %s — %s" % (kind, value, wheres[0]))

    # слоты: default_entity ссылается на сцену, где слот есть
    for name in manifest["scenes"]:
        sc = load(PKG / "scenes" / name)
        slot_ids = {s["id"] for s in sc["slots"]}
        for z in sc.get("navigation", []):
            if z.get("go_to_scene") and z["go_to_scene"] not in ids["scene"]:
                err("навигация ведёт в неизвестную сцену: %s (%s)" % (z["go_to_scene"], name))
        for slot in sc["slots"]:
            for t in slot["type"]:
                if t not in ids["slot_type"]:
                    warn("тип слота вне реестра: %s (%s)" % (t, name))
    return refs


def check_flags_and_budgets(campaign, manifest):
    used_flags = set()
    text = ""
    for p in PKG.rglob("*.json"):
        text += p.read_text(encoding="utf-8")
    for f in campaign["flags"]:
        if f["id"] not in text:
            warn("флаг реестра не используется: %s" % f["id"])
        if not f.get("description"):
            err("у флага нет описания: %s" % f["id"])
    # флаги, которые ставятся, но не описаны
    for m in re.finditer(r'"flag":\s*"([a-z0-9_]+)"', text):
        used_flags.add(m.group(1))
    for m in re.finditer(r'"not_flag":\s*"([a-z0-9_]+)"', text):
        used_flags.add(m.group(1))
    for m in re.finditer(r'set_flag\("([a-z0-9_]+)"\)', text):
        used_flags.add(m.group(1))
    registry = {f["id"] for f in campaign["flags"]}
    for f in sorted(used_flags - registry):
        warn("флаг используется, но не в реестре: %s" % f)

    cc = campaign["char_creation"]
    lim = cc["stat_limits"]
    total = cc["total_points"]
    for p in cc["professions"]:
        for st in ("STR", "CON", "SIZ", "DEX", "INT", "POW", "CHA"):
            if st not in p.get("stats", {}):
                err("у происхождения %s нет характеристики %s" % (p["id"], st))
            else:
                v = p["stats"][st]
                if not (lim["min"] <= v <= lim["max"]):
                    err("характеристика вне лимитов: %s %s=%s" % (p["id"], st, v))
        spent = sum(max(0, v - lim["min"]) for v in p.get("stats", {}).values())
        if spent != total:
            err("происхождение %s распределяет %d из %d очков" % (p["id"], spent, total))
        if len(p.get("stats", {})) != 7:
            err("у происхождения %s не семь характеристик" % p["id"])

    cap = cc.get("skill_cap", 10 ** 6)
    floor = cc.get("skill_floor", 0)
    mandatory = set(cc.get("mandatory_skills", []))
    points = cc.get("skill_points", 0)
    for p in cc["professions"]:
        for c in cc["callings"]:
            spent = 0.0
            for sk, val in c["skills"].items():
                if sk not in {s["id"] for s in campaign["skills"]}:
                    err("навык призвания вне реестра: %s (%s)" % (sk, c["id"]))
                base = max(floor, 25 if sk in mandatory else 0) + p.get("skill_bonus", {}).get(sk, 0)
                spent += max(0, min(cap, val) - base)
                if val > cap:
                    err("навык выше потолка: %s %s=%s" % (c["id"], sk, val))
            if abs(spent - points) > 1e-6:
                err("сочетание %s × %s тратит %s из %s очков навыков" % (p["id"], c["id"], spent, points))
        bonus_sum = sum(p.get("skill_bonus", {}).values())
        notes.append("происхождение %s: бонусы навыков %s" % (p["id"], bonus_sum))

    for n in campaign["needs"]:
        label = n["label"]
        if len(label) > 18:
            warn("длинная подпись потребности: %s (%d знаков)" % (label, len(label)))
        if any(ch.isdigit() for ch in label):
            warn("в подписи потребности есть цифра: %s" % label)
    if not campaign.get("design_doc"):
        err("в кампании нет дизайн-документа")

    # манифест: файлы встреч не должны попадать в rules
    for n in manifest["encounters"]:
        if n in manifest["rules"]:
            err("файл встреч %s попал в manifest.rules" % n)
    for n in manifest["dialogues"]:
        if not n.endswith(".ink"):
            err("в manifest.dialogues не .ink: %s" % n)
    for n in manifest["rules"]:
        r = load(PKG / "rules" / n)
        if not isinstance(r.get("conditions"), list) or not isinstance(r.get("effects"), list):
            err("правило без обязательных массивов conditions/effects: %s" % n)


def check_assets():
    text = ""
    for p in PKG.rglob("*.json"):
        text += p.read_text(encoding="utf-8")
    paths = set(re.findall(r'"(assets/[^"]+)"', text))
    missing = sorted(p for p in paths if not (PKG / p).exists())
    for p in missing:
        err("нет файла: %s" % p)
    notes.append("медиафайлов в пакете: %d, ссылок: %d" % (
        sum(1 for _ in (PKG / "assets").rglob("*") if _.is_file()) if (PKG / "assets").exists() else 0,
        len(paths)))
    return paths


def main():
    campaign, manifest = schema_validate()
    ids = collect_ids(campaign, manifest)
    check_references(campaign, manifest, ids)
    check_flags_and_budgets(campaign, manifest)
    check_assets()

    print("=" * 70)
    print("ПРОВЕРКА КАМПАНИИ «ШЕСТЕРНИ И ПЕПЕЛ»")
    print("=" * 70)
    print("Ошибок: %d, предупреждений: %d" % (len(errors), len(warnings)))
    for e in errors[:80]:
        print("  ОШИБКА:", e)
    for w in warnings[:80]:
        print("  предупреждение:", w)
    for n in notes:
        print("  ·", n)
    return 1 if errors else 0


if __name__ == "__main__":
    sys.exit(main())
