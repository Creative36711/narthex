"""Сборка Campaign Package «Шёпот в шестернях» + валидация по схеме.

Запуск:  cd tools && python3 build.py
Результат: /home/user/campaign-1/package/  (campaign.json, world.json, manifest.json, модули)
"""
import json
import os
import re
import shutil
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)

import c_meta
import c_world
import c_scenes
import c_entities
import c_rules
import c_quests
import c_arenas
import c_extra
from validate import validate

ROOT = os.path.dirname(HERE)
PKG = os.path.join(ROOT, "package")
INK_SRC = os.path.join(HERE, "ink")

ERRORS = []


def dump(relpath, obj, expect=None, defname=None):
    path = os.path.join(PKG, relpath)
    os.makedirs(os.path.dirname(path), exist_ok=True)
    with open(path, "w", encoding="utf-8") as fh:
        json.dump(obj, fh, ensure_ascii=False, indent=1)
        fh.write("\n")
    if defname:
        for e in validate(obj, defname, "%s" % relpath):
            ERRORS.append("%s%s" % (relpath, e))
    return path


def main():
    if os.path.isdir(PKG):
        shutil.rmtree(PKG)
    os.makedirs(PKG)

    meta = c_meta.build_meta()
    world = c_world.build_world()
    scenes = c_scenes.SCENES
    entities = c_entities.build_entities()
    rules = c_rules.build_rules()
    quests = c_quests.build_quests()
    arenas = c_arenas.build_arenas()
    cutscenes = c_extra.build_cutscenes()
    recipes = c_extra.build_recipes()
    codex = c_extra.build_codex()
    encounters = c_extra.ENCOUNTERS

    # ---------------- корневые файлы
    dump("campaign.json", meta, defname="CampaignMeta")
    dump("world.json", world, defname="WorldDef")

    manifest = {
        "scenes": [], "entities": [], "rules": [], "dialogues": [],
        "arenas": [], "quests": [], "encounters": [], "cutscenes": [],
        "recipes": [], "codex": [],
    }
    for sid, s in scenes.items():
        fn = sid + ".json"
        dump("scenes/" + fn, s, defname="SceneDef")
        manifest["scenes"].append(fn)
    for eid, e in entities.items():
        fn = eid + ".json"
        dump("entities/" + fn, e, defname="NpcDef" if e.get("type") == "npc" else "ItemDef")
        manifest["entities"].append(fn)
    for rid, r in rules.items():
        fn = rid + ".json"
        dump("rules/" + fn, r, defname="RuleDef")
        manifest["rules"].append(fn)
    for aid, a in arenas.items():
        fn = aid + ".json"
        dump("arenas/" + fn, a, defname="ArenaDef")
        manifest["arenas"].append(fn)
    for qid, q in quests.items():
        fn = qid + ".json"
        dump("quests/" + fn, q, defname="QuestDef")
        manifest["quests"].append(fn)
    for cid, c in cutscenes.items():
        fn = cid + ".json"
        dump("cutscenes/" + fn, c, defname="CutsceneDef")
        manifest["cutscenes"].append(fn)
    for rid, r in recipes.items():
        fn = rid + ".json"
        dump("recipes/" + fn, r, defname="RecipeDef")
        manifest["recipes"].append(fn)
    for cid, c in codex.items():
        fn = cid + ".json"
        dump("codex/" + fn, c, defname="CodexEntryDef")
        manifest["codex"].append(fn)
    for eid, tables in encounters.items():
        fn = eid + ".json"
        dump("rules/" + fn, {"encounter_tables": tables} if isinstance(tables, list) else tables,
             defname="EncounterFileDef")
        manifest["encounters"].append(fn)

    # ---------------- диалоги (ink)
    os.makedirs(os.path.join(PKG, "dialogues"), exist_ok=True)
    for name in sorted(os.listdir(INK_SRC)):
        if not name.endswith(".ink"):
            continue
        shutil.copy(os.path.join(INK_SRC, name), os.path.join(PKG, "dialogues", name))
        manifest["dialogues"].append(name)

    # ---------------- медиа
    media_root = os.path.join(HERE, "media")
    if os.path.isdir(media_root):
        shutil.copytree(media_root, os.path.join(PKG, "assets"))

    with open(os.path.join(PKG, "manifest.json"), "w", encoding="utf-8") as fh:
        json.dump(manifest, fh, ensure_ascii=False, indent=1)
        fh.write("\n")

    print("files:", sum(len(f) for _, _, f in os.walk(PKG)))
    return ERRORS


def check_links(meta, world, scenes, entities, rules, quests, arenas, cutscenes, recipes, codex, encounters, manifest):
    def err(msg):
        ERRORS.append("LINK " + msg)

    flags = {f["id"] for f in meta.get("flags", [])}
    items = {i for i, e in entities.items() if e.get("type") == "item"}
    npcs = {i for i, e in entities.items() if e.get("type") == "npc"}
    arenas_i = set(arenas)
    quests_i = set(quests)
    cut_i = set(cutscenes)
    codex_i = set(codex)
    recipes_i = set(recipes)
    scene_i = set(scenes)
    locs_i = set()
    for reg in world["regions"]:
        for loc in reg.get("locations", []):
            locs_i.add(loc["id"])
    fac = {f["id"] for f in meta.get("factions", [])}
    skills = {s["id"] for s in meta.get("skills", [])}
    needs = {n["id"] for n in meta.get("needs", [])}
    statuses = {s["id"] for s in meta.get("statuses", [])}
    music = {m["id"] for m in meta.get("music_tracks", [])}
    sounds = {s["id"] for s in meta.get("sounds", [])}
    currencies = {c["id"] for c in meta.get("currencies", [])}
    weathers = {w["id"] for w in meta.get("weathers", [])}

    def conds(where, cs):
        for c in cs or []:
            t = c.get("type")
            if t == "flag" and c.get("flag") not in flags:
                err("%s: unknown flag %s" % (where, c.get("flag")))
            if t == "has_item" and c.get("item") not in items:
                err("%s: unknown item %s" % (where, c.get("item")))
            if t == "item_ge" and c.get("item") not in items:
                err("%s: unknown item %s" % (where, c.get("item")))
            if t == "skill_ge" and c.get("skill") not in skills:
                err("%s: unknown skill %s" % (where, c.get("skill")))
            if t == "has_status" and c.get("status") not in statuses:
                err("%s: unknown status %s" % (where, c.get("status")))
            if t == "weather_is" and c.get("weather") not in weathers:
                err("%s: unknown weather %s" % (where, c.get("weather")))
            if t == "in_party" and c.get("entity") not in npcs:
                err("%s: unknown npc %s" % (where, c.get("entity")))
            if t == "quest" and c.get("quest") not in quests_i:
                err("%s: unknown quest %s" % (where, c.get("quest")))

    def effs(where, es):
        for e in es or []:
            t = e.get("type")
            if t == "set_flag" and e.get("flag") not in flags:
                err("%s: unknown flag %s" % (where, e.get("flag")))
            if t == "clear_flag" and e.get("flag") not in flags:
                err("%s: unknown flag %s" % (where, e.get("flag")))
            if t in ("add_item", "remove_item") and e.get("item") not in items:
                err("%s: unknown item %s" % (where, e.get("item")))
            if t == "start_combat":
                if e.get("arena") and e["arena"] not in arenas_i:
                    err("%s: unknown arena %s" % (where, e.get("arena")))
                for side in ("enemies", "allies"):
                    for ent in e.get(side, []) or []:
                        if ent.get("entity") not in npcs:
                            err("%s: unknown combat entity %s" % (where, ent.get("entity")))
            if t == "start_quest" and e.get("quest") not in quests_i:
                err("%s: unknown quest %s" % (where, e.get("quest")))
            if t in ("advance_quest", "quest_advance") and e.get("quest") not in quests_i:
                err("%s: unknown quest %s" % (where, e.get("quest")))
            if t == "fire_rule" and e.get("rule") not in rules:
                err("%s: unknown rule %s" % (where, e.get("rule")))
            if t in ("play_cutscene",) and e.get("cutscene") not in cut_i:
                err("%s: unknown cutscene %s" % (where, e.get("cutscene")))
            if t == "unlock_codex" and e.get("entry") not in codex_i:
                err("%s: unknown codex %s" % (where, e.get("entry")))
            if t == "unlock_recipe" and e.get("recipe") not in recipes_i:
                err("%s: unknown recipe %s" % (where, e.get("recipe")))
            if t == "change_need" and e.get("need") not in needs:
                err("%s: unknown need %s" % (where, e.get("need")))
            if t == "apply_status" and e.get("status") not in statuses:
                err("%s: unknown status %s" % (where, e.get("status")))
            if t == "change_reputation" and e.get("faction") not in fac:
                err("%s: unknown faction %s" % (where, e.get("faction")))
            if t == "change_disposition" and e.get("entity") not in npcs:
                err("%s: unknown npc %s" % (where, e.get("entity")))
            if t == "set_entity_state" and e.get("entity") not in npcs:
                err("%s: unknown npc %s" % (where, e.get("entity")))
            if t == "set_description" and e.get("entity") not in npcs:
                err("%s: unknown npc %s" % (where, e.get("entity")))
            if t == "join_party" and e.get("entity") not in npcs:
                err("%s: unknown npc %s" % (where, e.get("entity")))
            if t == "start_dialogue" and e.get("dialogue"):
                d = e["dialogue"]
                if not os.path.exists(os.path.join(PKG, d)):
                    err("%s: missing dialogue %s" % (where, d))
            if t == "set_weather" and e.get("weather") not in weathers:
                err("%s: unknown weather %s" % (where, e.get("weather")))
            if t == "give_reward":
                for it in e.get("items", []) or []:
                    iid = it.get("item") if isinstance(it, dict) else it
                    if iid not in items:
                        err("%s: unknown reward item %s" % (where, iid))
            if t == "roll_event_table" and e.get("table") not in {t2["id"] for tbl in encounters.values() for t2 in (tbl if isinstance(tbl, list) else [])}:
                err("%s: unknown encounter table %s" % (where, e.get("table")))
            if t == "set_price_event" and e.get("event") and e["event"] not in {p["id"] for p in meta.get("price_events", [])}:
                err("%s: unknown price event %s" % (where, e.get("event")))
            if t == "commit_crime" and e.get("crime") and e["crime"] not in {c["id"] for c in meta.get("crimes", [])}:
                err("%s: unknown crime %s" % (where, e.get("crime")))
            if t == "grant_feat" and e.get("feat") and e["feat"] not in {f["id"] for f in meta.get("features", {}).get("feats", []) or []}:
                err("%s: unknown feat %s" % (where, e.get("feat")))
            if "conditions" in e:
                conds(where, e.get("conditions"))
            for k in ("effects", "on_success", "on_fail", "on_victory", "on_defeat", "then"):
                if isinstance(e.get(k), list):
                    effs(where, e[k])

    for rid, r in rules.items():
        conds("rule " + rid, r.get("conditions"))
        effs("rule " + rid, r.get("effects"))
    for qid, q in quests.items():
        for st in q.get("stages", []):
            conds("quest %s/%s" % (qid, st.get("id")), st.get("on_enter_conditions"))
            effs("quest %s/%s" % (qid, st.get("id")), st.get("on_enter"))
            effs("quest %s/%s" % (qid, st.get("id")), st.get("effects"))
            for tr in st.get("transitions", []) or []:
                conds("quest %s/%s" % (qid, st.get("id")), tr.get("conditions"))
                effs("quest %s/%s" % (qid, st.get("id")), tr.get("effects"))
    for sid, s in scenes.items():
        for sl in s.get("slots", []):
            de = sl.get("default_entity")
            if de and de not in npcs and de not in items:
                err("scene %s slot %s: unknown default_entity %s" % (sid, sl.get("id"), de))
            if sl.get("slot_type") and sl["slot_type"] not in {st["id"] for st in meta.get("slot_types", []) if isinstance(st, dict)}:
                pass
        for st in s.get("states", []):
            conds("scene %s state %s" % (sid, st.get("id")), [st["condition"]] if isinstance(st.get("condition"), dict) else [])
    for eid, e in entities.items():
        if e.get("dialogue"):
            if not os.path.exists(os.path.join(PKG, e["dialogue"])):
                err("entity %s: missing dialogue %s" % (eid, e["dialogue"]))
        if e.get("faction") and e["faction"] not in fac:
            err("entity %s: unknown faction %s" % (eid, e["faction"]))
        for it in e.get("inventory", []) or []:
            if it.get("item") not in items:
                err("entity %s: unknown inventory item %s" % (eid, it.get("item")))
        for k, v in (e.get("equipment") or {}).items():
            if v not in items:
                err("entity %s: unknown equipment item %s" % (eid, v))
        for opt in e.get("interact_options", []) or []:
            effs("entity %s option" % eid, opt.get("effects"))
            conds("entity %s option" % eid, opt.get("conditions"))
        for k in ("on_use", "on_interact"):
            if isinstance(e.get(k), dict):
                effs("entity %s %s" % (eid, k), e[k].get("effects"))
    for lid, loc in [(l["id"], l) for reg in world["regions"] for l in reg.get("locations", [])]:
        for sc in loc.get("scenes", []) or []:
            if sc not in scene_i:
                err("location %s: unknown scene %s" % (lid, sc))
        if loc.get("arrival_scene") and loc["arrival_scene"] not in scene_i:
            err("location %s: unknown arrival_scene %s" % (lid, loc["arrival_scene"]))
        if loc.get("arena") and loc["arena"] not in arenas_i:
            err("location %s: unknown arena %s" % (lid, loc.get("arena")))
        for r in loc.get("on_enter_rules", []) or []:
            if r not in rules:
                err("location %s: unknown rule %s" % (lid, r))
        for tc in loc.get("travel_connections", []) or []:
            if tc.get("to") not in locs_i:
                err("location %s: travel to unknown %s" % (lid, tc.get("to")))
            tbl = tc.get("table")
            if tbl and tbl not in {t["id"] for t2 in encounters.values() for t in (t2 if isinstance(t2, list) else [])}:
                err("location %s: unknown encounter table %s" % (lid, tbl))
            conds("location %s travel" % lid, tc.get("conditions"))
    for aid, a in arenas.items():
        for z in (a.get("spawn_zones") or {}).values() if isinstance(a.get("spawn_zones"), dict) else []:
            for ent in z.get("entities", z.get("units", [])) if isinstance(z, dict) else []:
                eid = ent.get("entity") if isinstance(ent, dict) else ent
                if eid not in npcs:
                    err("arena %s: unknown entity %s" % (aid, eid))
    for i, c in [(k, v) for k, v in cutscenes.items()]:
        for sl in c.get("slides", []):
            effs("cutscene %s" % i, sl.get("effects"))
            conds("cutscene %s" % i, sl.get("conditions"))

    # dialogue referenced by rules via start_dialogue — already covered; ink files present
    print("link check: %d issues" % len([e for e in ERRORS if e.startswith("LINK")]))


if __name__ == "__main__":
    errs = main()
    print("---------")
    for e in errs:
        print(e)
    print("TOTAL", len(errs))
    print("(полная перекрёстная проверка: python3 check.py)")
