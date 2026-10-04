# -*- coding: utf-8 -*-
"""Сборка Campaign Package «Ржавая литургия»: проверка ссылок, схемы, упаковка."""
import json, os, shutil, sys, zipfile

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from common import CAMPAIGN
from world_scenes import WORLD, SCENES
from entities import ENTITIES
from dialogues import DIALOGUES, gen_ink
from logic import RULES, QUESTS, ARENAS, CUTSCENES, ENCOUNTERS, RECIPES, CODEX, ABILITIES

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SCHEMA = json.load(open(os.path.join(ROOT, "__chronicle_ai__", "campaign.schema.json"), encoding="utf-8"))
PKG = os.path.join(ROOT, "cf_build", "pkg")

CAMPAIGN["abilities"] = ABILITIES

errors = []
def err(msg):
    errors.append(msg)

# ---------- кросс-проверки ----------
ids = {}
def reg(kind, i):
    if i in ids and ids[i] != kind:
        err("id clash: %s (%s vs %s)" % (i, ids[i], kind))
    ids[i] = kind

for loc in [l for r in WORLD["regions"] for l in r["locations"]]:
    reg("location", loc["id"])
for s in SCENES.values():
    reg("scene", s["id"])
for e in ENTITIES.values():
    reg("entity", e["id"])
for q in QUESTS.values():
    reg("quest", q["id"])
for a in ARENAS.values():
    reg("arena", a["id"])
for c in CUTSCENES.values():
    reg("cutscene", c["id"])
for r in RECIPES.values():
    reg("recipe", r["id"])
for c in CODEX.values():
    reg("codex", c["id"])
for r in RULES.values():
    reg("rule", r["id"])
for d in DIALOGUES:
    reg("dialogue", d)

flag_ids = {f["id"] for f in CAMPAIGN["flags"]}
skill_ids = {s["id"] for s in CAMPAIGN["skills"]}
status_ids = {s["id"] for s in CAMPAIGN["statuses"]}
emotion_ids = {e["id"] for e in CAMPAIGN["emotions"]}
weather_ids = {w["id"] for w in CAMPAIGN["weathers"]}
need_ids = {n["id"] for n in CAMPAIGN["needs"]}
loc_ids = {l["id"] for r in WORLD["regions"] for l in r["locations"]}
scene_ids = set(SCENES)
entity_ids = set(ENTITIES)
quest_ids = set(QUESTS)
rule_ids = set(RULES)
arena_ids = set(ARENAS)
cutscene_ids = set(CUTSCENES)
recipe_ids = set(RECIPES)
codex_ids = set(CODEX)
cat_ids = {c["id"] for c in CAMPAIGN["item_categories"]}
slot_type_ids = {t["id"] for t in CAMPAIGN["slot_types"]}
equip_ids = {e["id"] for e in CAMPAIGN["equipment_slots"]}

def check_conds(conds, where):
    for c in conds or []:
        t = c.get("type")
        if t in ("flag_set", "flag_not_set"):
            if c["flag"] not in flag_ids: err("unknown flag %s in %s" % (c["flag"], where))
        elif t in ("and", "or"):
            check_conds(c["conditions"], where)
        elif t == "not":
            check_conds([c["condition"]], where)
        elif t in ("player_enters_location",):
            if c["location"] not in loc_ids: err("unknown location %s in %s" % (c["location"], where))
        elif t in ("player_enters_scene",):
            if c["scene"] not in scene_ids: err("unknown scene %s in %s" % (c["scene"], where))
        elif t == "has_item":
            if c["item"] not in entity_ids: err("unknown item %s in %s" % (c["item"], where))
        elif t == "quest_at_stage":
            if c["quest"] not in quest_ids: err("unknown quest %s in %s" % (c["quest"], where))
        elif t == "weather_is":
            if c["weather"] and c["weather"] not in weather_ids: err("unknown weather %s in %s" % (c["weather"], where))
        elif t == "need_le" or t == "need_ge":
            if c["need"] not in need_ids: err("unknown need %s in %s" % (c["need"], where))
        elif t == "has_status":
            if c["status"] not in status_ids: err("unknown status %s in %s" % (c["status"], where))

def check_effects(effects, where):
    for e in effects or []:
        t = e.get("type")
        if t in ("set_flag", "clear_flag"):
            if e["flag"] not in flag_ids: err("unknown flag %s in %s" % (e["flag"], where))
        elif t in ("add_item", "remove_item"):
            if e["item"] not in entity_ids: err("unknown item %s in %s" % (e["item"], where))
        elif t == "start_quest" or t == "advance_quest" or t == "fail_quest":
            if e["quest"] not in quest_ids: err("unknown quest %s in %s" % (e["quest"], where))
        elif t == "fire_rule":
            if e["rule"] not in rule_ids: err("unknown rule %s in %s" % (e["rule"], where))
        elif t == "play_cutscene":
            if e["cutscene"] not in cutscene_ids: err("unknown cutscene %s in %s" % (e["cutscene"], where))
        elif t == "start_combat":
            if e["arena"] not in arena_ids: err("unknown arena %s in %s" % (e["arena"], where))
            for en in e["enemies"]:
                if en["entity"] not in entity_ids: err("unknown enemy %s in %s" % (en["entity"], where))
            check_effects(e.get("on_victory"), where + ".on_victory")
            check_effects(e.get("on_defeat"), where + ".on_defeat")
            check_effects(e.get("on_fled"), where + ".on_fled")
        elif t in ("apply_status", "remove_status"):
            if e["status"] not in status_ids: err("unknown status %s in %s" % (e["status"], where))
        elif t == "set_entity_state":
            ent = ENTITIES.get(e["entity"])
            if not ent: err("unknown entity %s in %s" % (e["entity"], where))
            elif e["state"] and e["state"] not in ent.get("portrait", {}):
                err("entity %s has no portrait state %s in %s" % (e["entity"], e["state"], where))
        elif t == "set_description":
            if e["entity"] not in entity_ids: err("unknown entity %s in %s" % (e["entity"], where))
        elif t == "unlock_recipe":
            if e["recipe"] not in recipe_ids: err("unknown recipe %s in %s" % (e["recipe"], where))
        elif t == "unlock_codex":
            if e["entry"] not in codex_ids: err("unknown codex %s in %s" % (e["entry"], where))
        elif t == "set_weather":
            if e["weather"] and e["weather"] not in weather_ids: err("unknown weather %s in %s" % (e["weather"], where))
        elif t == "teleport_player" or t == "reveal_location":
            if e["location"] not in loc_ids: err("unknown location %s in %s" % (e["location"], where))
        elif t == "spawn_entity" or t == "remove_entity":
            if e["entity"] not in entity_ids: err("unknown entity %s in %s" % (e["entity"], where))
        elif t == "skill_check_gate" or t == "stat_check" or t == "opposed_check" or t == "group_stat_check":
            if t == "skill_check_gate" and e["skill"] not in skill_ids:
                err("unknown skill %s in %s" % (e["skill"], where))
            check_effects(e.get("success_effects"), where + ".success")
            check_effects(e.get("fail_effects"), where + ".fail")
        elif t == "start_pursuit":
            check_effects(e.get("on_fail"), where + ".on_fail")
        elif t == "change_need":
            if e["need"] not in need_ids: err("unknown need %s in %s" % (e["need"], where))
        elif t == "change_disposition":
            if e["target"] not in entity_ids and e["target"] not in {f["id"] for f in CAMPAIGN["factions"]}:
                err("unknown disposition target %s in %s" % (e["target"], where))
        elif t == "join_party" or t == "leave_party":
            if e["entity"] not in entity_ids: err("unknown entity %s in %s" % (e["entity"], where))

# world
for r in WORLD["regions"]:
    for l in r["locations"]:
        for sc in l["scenes"]:
            if sc not in scene_ids: err("location %s refs unknown scene %s" % (l["id"], sc))
        if l.get("arrival_scene") and l["arrival_scene"] not in l["scenes"]:
            err("arrival_scene %s not in scenes of %s" % (l["arrival_scene"], l["id"]))
        for tc in l["travel_connections"]:
            if tc["to"] not in loc_ids: err("travel to unknown %s" % tc["to"])
            check_conds(tc.get("requirements"), "travel " + l["id"])

# scenes
for s in SCENES.values():
    if s["location"] not in loc_ids: err("scene %s unknown location" % s["id"])
    if not any(st["condition"] is None for st in s["states"]):
        err("scene %s has no fallback state" % s["id"])
    for st in s["states"]:
        cond = st.get("condition")
        if cond:
            if cond.get("flag") and cond["flag"] not in flag_ids: err("scene %s state flag unknown" % s["id"])
            if cond.get("weather") and cond["weather"] not in weather_ids: err("scene %s state weather unknown" % s["id"])
    for slot in s["slots"]:
        for tp in slot["type"]:
            if tp not in slot_type_ids: err("slot %s unknown type %s" % (slot["id"], tp))
        de = slot.get("default_entity")
        if de:
            if de not in entity_ids: err("slot %s unknown default %s" % (slot["id"], de))
            ent = ENTITIES[de]
            stp = ent.get("slot_type", "person" if ent["type"] == "npc" else "item")
            if stp not in slot["type"]: err("slot %s type mismatch with %s" % (slot["id"], de))
            if ent["type"] == "npc" and ent.get("schedule"):
                err("slot %s: default_entity %s has schedule (duplicate)" % (slot["id"], de))
    for nav in s["navigation"]:
        if nav.get("go_to_scene") and nav["go_to_scene"] not in SCENES[s["id"]]["location"] and True:
            tgt = SCENES.get(nav["go_to_scene"])
            if not tgt: err("nav %s unknown scene" % s["id"])
            elif tgt["location"] != s["location"]: err("nav %s crosses location" % s["id"])

# entities
for e in ENTITIES.values():
    if e["type"] == "npc":
        if e.get("dialogue"):
            key = e["dialogue"].replace("dialogues/", "").replace(".ink", "")
            if key not in DIALOGUES: err("npc %s dialogue missing %s" % (e["id"], key))
        for sch in e.get("schedule", []):
            if sch["scene"] not in scene_ids: err("schedule %s unknown scene" % e["id"])
            sc = SCENES.get(sch["scene"])
            if sc and not any(sl["id"] == sch["slot"] for sl in sc["slots"]):
                err("schedule %s unknown slot %s" % (e["id"], sch["slot"]))
            if sch["location"] not in loc_ids: err("schedule %s unknown loc" % e["id"])
        for po in e.get("presence_overrides", []):
            if po["scene"] not in scene_ids: err("override %s unknown scene" % e["id"])
            if po["flag"] not in flag_ids: err("override %s unknown flag" % e["id"])
        if e.get("faction") and e["faction"] not in {f["id"] for f in CAMPAIGN["factions"]}:
            err("npc %s unknown faction" % e["id"])
        for it in e.get("inventory", []):
            if it["item"] not in entity_ids: err("npc %s inventory unknown item" % e["id"])
        for w in e.get("natural_weapon", {}).get("skill", "") and [e["natural_weapon"]["skill"]] or []:
            if w not in skill_ids: err("npc %s natural weapon skill unknown" % e["id"])
        for ab in e.get("abilities", []):
            if ab not in {a["id"] for a in ABILITIES}: err("npc %s unknown ability" % e["id"])
    else:
        if e["category"] not in cat_ids: err("item %s unknown category" % e["id"])
        if e.get("equip_slot") and e["equip_slot"] not in equip_ids: err("item %s unknown equip slot" % e["id"])
        for io in e.get("interact_options", []):
            check_conds(io.get("conditions"), "interact " + e["id"])
            check_effects(io.get("effects"), "interact " + e["id"])
        if e.get("on_use"):
            check_effects(e["on_use"].get("effects"), "on_use " + e["id"])

# rules
for r in RULES.values():
    check_conds(r["conditions"], "rule " + r["id"])
    for g in r.get("conditions_any", []):
        check_conds(g, "rule " + r["id"])
    check_effects(r["effects"], "rule " + r["id"])

# quests
for q in QUESTS.values():
    stage_ids = {st["id"] for st in q["stages"]}
    for key in q["journal_entries"]:
        pass
    for st in q["stages"]:
        check_effects(st.get("on_enter_effects"), "quest %s stage %s" % (q["id"], st["id"]))
        for tr in st.get("transitions", []):
            if tr["to"] not in stage_ids: err("quest %s transition to unknown stage %s" % (q["id"], tr["to"]))
            check_conds(tr["conditions"], "quest %s stage %s" % (q["id"], st["id"]))
    # every journal_update text_key exists
    def scan_eff(effs):
        for e in effs or []:
            if e.get("type") == "journal_update":
                if e["quest"] not in quest_ids: err("journal_update unknown quest in %s" % q["id"])
                elif e["text_key"] not in QUESTS[e["quest"]]["journal_entries"]:
                    err("journal_update unknown text_key %s in %s" % (e["text_key"], q["id"]))
            for k in ("success_effects", "fail_effects", "on_victory", "on_fail"):
                scan_eff(e.get(k))
    for st in q["stages"]:
        scan_eff(st.get("on_enter_effects"))

# encounters
for enc in ENCOUNTERS.values():
    for en in enc["entries"]:
        if en["type"] == "combat":
            if en["arena"] not in arena_ids: err("enc %s unknown arena" % enc["id"])
            for x in en["enemies"]:
                if x["entity"] not in entity_ids: err("enc %s unknown enemy" % enc["id"])

# recipes
for r in RECIPES.values():
    for i in r["inputs"]:
        if i["item"] not in entity_ids: err("recipe %s unknown input" % r["id"])
    if r["output"]["item"] not in entity_ids: err("recipe %s unknown output" % r["id"])
    for t in r.get("tools", []):
        if t not in entity_ids: err("recipe %s unknown tool" % r["id"])
    check_conds(r.get("requires"), "recipe " + r["id"])
    if r.get("skill") and r["skill"]["id"] not in skill_ids: err("recipe %s unknown skill" % r["id"])

# dialogues
for did, doc in DIALOGUES.items():
    node_ids = {n["id"] for n in doc["nodes"]}
    for n in doc["nodes"]:
        for ch in n.get("choices", []):
            g = ch.get("goto", "")
            if g not in ("", "stay", "end") and g not in node_ids:
                err("dialogue %s choice goto unknown %s" % (did, g))
            for c in ch.get("conds", []):
                if c["type"] == "flag" and c["flag"] not in flag_ids:
                    err("dialogue %s cond unknown flag %s" % (did, c["flag"]))
                if c["type"] in ("has_item", "item_ge") and c["item"] not in entity_ids:
                    err("dialogue %s cond unknown item" % did)
            for sec in ch.get("sections", []):
                for st in sec.get("steps", []):
                    if st.get("kind") == "effect":
                        e = st["effect"]
                        check_effects([e], "dialogue " + did)
                        if e["type"] == "fire_rule" and e["rule"] not in rule_ids:
                            err("dialogue %s fire_rule unknown" % did)
                    if st.get("kind") == "line":
                        em = st["line"].get("emotion")
                        if em and em not in emotion_ids:
                            err("dialogue %s unknown emotion %s" % (did, em))

# on_zero_effect — id manual-правила
for n in CAMPAIGN["needs"]:
    oze = n.get("on_zero_effect")
    if isinstance(oze, str) and oze not in RULES:
        err("need %s on_zero_effect unknown rule %s" % (n["id"], oze))
    if isinstance(oze, str) and not RULES[oze].get("manual"):
        err("need %s on_zero_effect rule %s must be manual" % (n["id"], oze))

# campaign-level refs
if CAMPAIGN["starting_region"] not in {r["id"] for r in WORLD["regions"]}: err("starting_region unknown")
if CAMPAIGN["starting_location"] not in loc_ids: err("starting_location unknown")
if CAMPAIGN["starting_scene"] not in scene_ids: err("starting_scene unknown")
if CAMPAIGN["default_player"] not in entity_ids: err("default_player unknown")
for c in CAMPAIGN["currencies"]:
    if c.get("item_id") and c["item_id"] not in entity_ids: err("currency item unknown")
for t in CAMPAIGN["music_tracks"]:
    pass
for m in (CAMPAIGN["ui_sounds"] or {}).values():
    if m not in {t["id"] for t in CAMPAIGN["music_tracks"]} and m not in {s["id"] for s in CAMPAIGN["sounds"]}:
        err("ui_sounds unknown id %s" % m)
for m in CAMPAIGN["default_music"] + CAMPAIGN["combat_music"]:
    if m not in {t["id"] for t in CAMPAIGN["music_tracks"]}: err("default/combat music unknown %s" % m)

# char_creation budgets
cc = CAMPAIGN["char_creation"]
mn, mx = cc["stat_limits"]["min"], cc["stat_limits"]["max"]
for p in cc["professions"]:
    stats = p["stats"]
    if set(stats) != {"STR", "CON", "SIZ", "DEX", "INT", "POW", "CHA"}:
        err("profession %s stats incomplete" % p["id"])
    if any(v < mn or v > mx for v in stats.values()):
        err("profession %s stats out of limits" % p["id"])
    spent = sum(max(0, v - mn) for v in stats.values())
    if spent != cc["total_points"]:
        err("profession %s spent %d != %d" % (p["id"], spent, cc["total_points"]))
for p in cc["professions"]:
    for c in cc["callings"]:
        spent = 0
        for sk, val in c["skills"].items():
            if sk in cc.get("forbidden_skills", []):
                err("calling %s uses forbidden skill %s" % (c["id"], sk))
            floor = max(cc["skill_floor"], 25 if sk in cc["mandatory_skills"] else 0) + p["skill_bonus"].get(sk, 0)
            spent += max(0, min(cc["skill_cap"], val) - floor)
            if val < floor:
                err("calling %s + %s skill %s below floor" % (c["id"], p["id"], sk))
        if spent != cc["skill_points"]:
            err("calling %s + profession %s spent %d != %d" % (c["id"], p["id"], spent, cc["skill_points"]))

# ---------- сборка пакета ----------
if os.path.isdir(PKG):
    shutil.rmtree(PKG)
os.makedirs(os.path.join(PKG, "scenes"))
os.makedirs(os.path.join(PKG, "entities"))
os.makedirs(os.path.join(PKG, "rules"))
os.makedirs(os.path.join(PKG, "quests"))
os.makedirs(os.path.join(PKG, "arenas"))
os.makedirs(os.path.join(PKG, "cutscenes"))
os.makedirs(os.path.join(PKG, "recipes"))
os.makedirs(os.path.join(PKG, "codex"))
os.makedirs(os.path.join(PKG, "dialogues"))

def w(path, obj):
    with open(os.path.join(PKG, path), "w", encoding="utf-8") as f:
        json.dump(obj, f, ensure_ascii=False, indent=2)

w("campaign.json", CAMPAIGN)
w("world.json", WORLD)
for i, o in SCENES.items(): w("scenes/%s.json" % i, o)
for i, o in ENTITIES.items(): w("entities/%s.json" % i, o)
for i, o in RULES.items(): w("rules/%s.json" % i, o)
w("rules/enc_road.json", {"encounter_tables": [ENCOUNTERS["enc_road"]]})
for i, o in QUESTS.items(): w("quests/%s.json" % i, o)
for i, o in ARENAS.items(): w("arenas/%s.json" % i, o)
for i, o in CUTSCENES.items(): w("cutscenes/%s.json" % i, o)
for i, o in RECIPES.items(): w("recipes/%s.json" % i, o)
for i, o in CODEX.items(): w("codex/%s.json" % i, o)
for i, o in DIALOGUES.items():
    w("dialogues/%s.dlg.json" % i, o)
    with open(os.path.join(PKG, "dialogues", "%s.ink" % i), "w", encoding="utf-8") as f:
        f.write(gen_ink(o))

manifest = {
    "scenes": sorted("%s.json" % i for i in SCENES),
    "entities": sorted("%s.json" % i for i in ENTITIES),
    "rules": sorted(["%s.json" % i for i in RULES] + ["enc_road.json"]),
    "quests": sorted("%s.json" % i for i in QUESTS),
    "arenas": sorted("%s.json" % i for i in ARENAS),
    "cutscenes": sorted("%s.json" % i for i in CUTSCENES),
    "encounters": ["enc_road.json"],
    "recipes": sorted("%s.json" % i for i in RECIPES),
    "codex": sorted("%s.json" % i for i in CODEX),
    "dialogues": sorted("%s.ink" % i for i in DIALOGUES),
}
w("manifest.json", manifest)

# медиа из исходников
ASSETS = os.path.join(ROOT, "cf_build", "assets")
if os.path.isdir(ASSETS):
    shutil.copytree(ASSETS, os.path.join(PKG, "assets"))

# самопроверка сгенерированных ink
import re
for did in DIALOGUES:
    path = os.path.join(PKG, "dialogues", "%s.ink" % did)
    text = open(path, encoding="utf-8").read()
    knots = set(re.findall(r"^=== ([\w-]+) ===$", text, re.M))
    externals = set(re.findall(r"^EXTERNAL (\w+)\(", text, re.M))
    for target in re.findall(r"-> (\S+)", text):
        if target not in ("DONE", "END") and target not in knots:
            err("ink %s divert to unknown knot %s" % (did, target))
    for cmd in set(re.findall(r"^~ (\w+)\(", text, re.M)) | set(re.findall(r"    ~ (\w+)\(", text, re.M)):
        if cmd not in externals:
            err("ink %s uses %s without EXTERNAL" % (did, cmd))

# ---------- валидация по схеме ----------
import jsonschema
from jsonschema import Draft202012Validator

registry = {}
for name, sub in SCHEMA["$defs"].items():
    registry[name] = sub

def validate(obj, defname, label):
    sch = dict(SCHEMA["$defs"][defname])
    full = {"$defs": SCHEMA["$defs"], **sch}
    v = Draft202012Validator(full)
    probs = sorted(v.iter_errors(obj), key=lambda e: e.path and list(e.path) or [])
    for e in probs[:6]:
        err("SCHEMA %s: %s @%s" % (label, e.message, list(e.path)))

validate(CAMPAIGN, "CampaignMeta", "campaign.json")
validate(WORLD, "WorldDef", "world.json")
validate(manifest, "CampaignManifest", "manifest.json")
for i, o in SCENES.items(): validate(o, "SceneDef", "scenes/" + i)
for i, o in ENTITIES.items(): validate(o, "EntityDef", "entities/" + i)
for i, o in RULES.items(): validate(o, "RuleDef", "rules/" + i)
validate({"encounter_tables": [ENCOUNTERS["enc_road"]]}, "EncounterFileDef", "rules/enc_road")
for i, o in QUESTS.items(): validate(o, "QuestDef", "quests/" + i)
for i, o in ARENAS.items(): validate(o, "ArenaDef", "arenas/" + i)
for i, o in CUTSCENES.items(): validate(o, "CutsceneDef", "cutscenes/" + i)
for i, o in RECIPES.items(): validate(o, "RecipeDef", "recipes/" + i)
for i, o in CODEX.items(): validate(o, "CodexEntryDef", "codex/" + i)
for i, o in DIALOGUES.items(): validate(o, "DlgDoc", "dialogues/" + i)

if errors:
    print("PROBLEMS (%d):" % len(errors))
    for e in errors:
        print(" -", e)
    sys.exit(1)

OUT = os.path.join(ROOT, "rzhavaya-liturgiya.chronicle")
with zipfile.ZipFile(OUT, "w", zipfile.ZIP_DEFLATED) as z:
    for dirpath, _dirs, files in os.walk(PKG):
        for fn in sorted(files):
            full = os.path.join(dirpath, fn)
            rel = os.path.relpath(full, PKG).replace(os.sep, "/")
            z.write(full, rel)
print("ALL CHECKS PASSED")
print("ARCHIVE:", OUT)
