"""Перекрёстная проверка ссылок внутри собранного пакета + ink-диалогов."""
import json
import os
import re
import sys

PKG = "/home/user/campaign-1/package"
INK = os.path.join(PKG, "dialogues")


def load(rel):
    with open(os.path.join(PKG, rel), encoding="utf-8") as fh:
        return json.load(fh)


def collect():
    ids = {}
    meta = load("campaign.json")
    world = load("world.json")
    ids["flags"] = {f["id"] for f in meta.get("flags", [])}
    ids["skills"] = {s["id"] for s in meta.get("skills", [])}
    ids["needs"] = {n["id"] for n in meta.get("needs", [])}
    ids["statuses"] = {s["id"] for s in meta.get("statuses", [])}
    ids["weathers"] = {w["id"] for w in meta.get("weathers", [])}
    ids["factions"] = {f["id"] for f in meta.get("factions", [])}
    ids["music"] = {m["id"] for m in meta.get("music_tracks", [])}
    ids["sounds"] = {s["id"] for s in meta.get("sounds", [])}
    ids["emotions"] = {e["id"] for e in meta.get("emotions", [])}
    ids["mc"] = {c["id"] for c in meta.get("metaprogress", {}).get("currencies", [])}
    ids["currencies"] = {c["id"] for c in meta.get("currencies", [])}
    ids["price_events"] = {p["id"] for p in meta.get("price_events", [])}
    ids["crimes"] = {c["id"] for c in meta.get("crimes", [])}
    ids["passions"] = {p["id"] for p in meta.get("passions_list", [])}
    ids["allegiances"] = {a["id"] for a in meta.get("allegiances", [])}
    feats = meta.get("features", {}).get("feats", []) or []
    ids["feats"] = {f.get("id") for f in feats if isinstance(f, dict)}
    ids["achievements"] = {a["id"] for a in meta.get("achievements", [])}
    ids["locations"] = set()
    ids["world_scenes"] = set()
    for reg in world["regions"]:
        for loc in reg.get("locations", []):
            ids["locations"].add(loc["id"])
            for s in loc.get("scenes", []) or []:
                ids["world_scenes"].add(s)

    for kind in ("scenes", "entities", "rules", "quests", "arenas", "cutscenes", "recipes", "codex"):
        d = {}
        for f in os.listdir(os.path.join(PKG, kind)):
            if f.endswith(".json"):
                d[f[:-5]] = load(os.path.join(kind, f))
        ids[kind] = set(d)
        ids["_" + kind] = d
    ids["items"] = {k for k, v in ids["_entities"].items() if v.get("type") == "item"}
    ids["npcs"] = {k for k, v in ids["_entities"].items() if v.get("type") == "npc"}
    ids["stages"] = {q["id"]: {s["id"] for s in q.get("stages", [])} for q, q in
                     [(k, v) for k, v in ids["_quests"].items()]}
    ids["journal"] = {k: set((v.get("journal_entries") or {}).keys())
                      for k, v in ids["_quests"].items()}
    ids["scene_states"] = {k: {s["id"] for s in v.get("states", [])} for k, v in ids["_scenes"].items()}
    ids["slots"] = {k: {s["id"] for s in v.get("slots", [])} for k, v in ids["_scenes"].items()}
    ids["tables"] = set()
    rules_dir = os.path.join(PKG, "rules")
    for f in os.listdir(rules_dir):
        if f.endswith(".json"):
            obj = load(os.path.join("rules", f))
            for t in obj.get("encounter_tables", []) or []:
                ids["tables"].add(t["id"])
                ids.setdefault("table_entries", {})[t["id"]] = t
    return ids


FIELD_MAP = [
    ("flag", "flags"), ("item", "items"), ("quest", "quests"), ("stage", "stages"),
    ("rule", "rules"), ("entry", "codex"), ("recipe", "recipes"), ("need", "needs"),
    ("status", "statuses"), ("weather", "weathers"), ("faction", "factions"),
    ("target", "npcs"), ("entity", "npcs"), ("cutscene", "cutscenes"), ("arena", "arenas"),
    ("scene", "world_scenes"), ("location", "locations"), ("table", "tables"),
    ("skill", "skills"), ("var", "variables"), ("id", "generic"), ("key", "generic"),
]
EFF_TRUTH = {
    "set_flag": {"flag": "flags"}, "clear_flag": {"flag": "flags"},
    "add_item": {"item": "items"}, "remove_item": {"item": "items"},
    "start_quest": {"quest": "quests"}, "advance_quest": {"quest": "quests", "stage": "stages_of"},
    "fail_quest": {"quest": "quests"}, "journal_update": {"quest": "quests", "text_key": "journal_of"},
    "fire_rule": {"rule": "rules"}, "unlock_codex": {"entry": "codex"},
    "unlock_recipe": {"recipe": "recipes"}, "open_craft": {"recipe": "recipes"},
    "change_need": {"need": "needs"}, "apply_status": {"status": "statuses"},
    "remove_status": {"status": "statuses"}, "set_weather": {"weather": "weathers"},
    "change_disposition": {"target": "npcs"}, "set_entity_state": {"entity": "npcs"},
    "set_description": {"entity": "npcs"}, "join_party": {"entity": "npcs"},
    "leave_party": {"entity": "npcs"}, "remove_entity": {"entity": "npcs"},
    "spawn_entity": {"entity": "npcs", "scene": "scenes"}, "start_dialogue": {"entity": "npcs"},
    "play_cutscene": {"cutscene": "cutscenes"}, "start_combat": {"arena": "arenas"},
    "teleport_player": {"location": "locations", "scene": "world_scenes"},
    "change_scene_state": {"scene": "scenes", "state": "scene_states_of"},
    "block_path": {"from": "locations", "to": "locations"},
    "unblock_path": {"from": "locations", "to": "locations"},
    "reveal_location": {"location": "locations"}, "roll_event_table": {"table": "tables"},
    "meta_currency": {"id": "mc"}, "set_price_event": {"id": "price_events"},
    "clear_price_event": {"id": "price_events"}, "commit_crime": {"id": "crimes"},
    "grant_feat": {"id": "feats"}, "change_passion": {"id": "passions"},
    "change_allegiance": {"id": "allegiances"}, "change_skill": {"skill": "skills"},
    "skill_check_gate": {"skill": "skills"}, "stat_check": {"stat": "stats"},
    "opposed_check": {"skill": "skills"},
    "give_reward": {}, "generate_variables": {}, "grant_xp": {}, "start_pursuit": {},
    "hazard_fall": {}, "show_message": {}, "banner": {}, "postcard": {}, "change_hp": {},
    "change_luck": {}, "change_fatigue": {}, "change_sanity": {}, "change_reputation": {},
    "change_wealth": {}, "train_stat": {}, "time": {}, "stop_pursuit": {},
    "game_over_victory": {}, "game_over_death": {}, "advance_time": {}, "set_variable": {},
    "change_variable": {}, "group_stat_check": {},
}
COND_TRUTH = {
    "flag_set": {"flag": "flags"}, "flag_not_set": {"flag": "flags"},
    "has_item": {"item": "items"}, "quest_at_stage": {"quest": "quests", "stage": "stages_of"},
    "skill_ge": {"skill": "skills"}, "need_le": {"need": "needs"}, "need_ge": {"need": "needs"},
    "has_status": {"status": "statuses"}, "weather_is": {"weather": "weathers"},
    "disposition_ge": {"target": "npcs"}, "disposition_le": {"target": "npcs"},
    "in_party": {"entity": "npcs"}, "entity_alive": {"entity": "npcs"},
    "entity_dead": {"entity": "npcs"}, "player_enters_scene": {"scene": "world_scenes"},
    "player_enters_location": {"location": "locations"}, "stat_ge": {"stat": "stats"},
    "meta_currency_ge": {"currency": "mc"}, "meta_achievement": {"id": "achievements"},
    "meta_counter": {"key": "meta_counters"}, "has_feat": {"id": "feats"},
    "passion_ge": {"id": "passions"}, "allegiance_ge": {"id": "allegiances"},
    "crime_committed": {"id": "crimes"}, "tick_elapsed": {}, "power_level_ge": {}, "reputation_ge": {},
    "hp_le": {}, "hp_ge": {}, "luck_ge": {}, "fatigue_ge": {}, "fatigue_le": {},
    "sanity_ge": {}, "sanity_le": {}, "wealth_ge": {}, "bounty_total_ge": {},
    "level_ge": {}, "random_chance": {}, "variable_compare": {}, "time_of_day": {},
    "and": {}, "or": {}, "not": {},
}
META_COUNTERS = {"endings_seen", "runs", "deaths", "victories", "kills", "quests_completed",
                 "ticks_survived", "travels", "dialogues", "meta_shard"}
STATS = {"STR", "CON", "SIZ", "DEX", "INT", "POW", "CHA"}

ERRORS = []


def err(msg):
    if msg not in ERRORS:
        ERRORS.append(msg)


def resolve(ids, space, value, where):
    if value is None:
        return
    if space == "generic":
        return
    if space in ("stages_of", "journal_of", "scene_states_of"):
        return
    if space == "stats":
        if value not in STATS:
            err("%s: unknown stat %s" % (where, value))
        return
    if space == "variables":
        return
    if space == "meta_counters":
        if value not in META_COUNTERS:
            err("%s: unknown meta counter %s" % (where, value))
        return
    if space not in ids:
        return
    if value not in ids[space]:
        err("%s: unknown %s '%s'" % (where, space, value))


def walk(obj, where, ids, mapping):
    if isinstance(obj, list):
        for i, v in enumerate(obj):
            walk(v, where, ids, mapping)
        return
    if not isinstance(obj, dict):
        return
    t = obj.get("type")
    spec = mapping.get(t)
    if spec is None and t is not None and t not in mapping:
        err("%s: unknown node type '%s'" % (where, t))
        return
    for field, space in (spec or {}).items():
        val = obj.get(field)
        if isinstance(val, list):
            for v in val:
                resolve(ids, space, v, "%s.%s" % (where, field))
        else:
            resolve(ids, space, val, "%s.%s" % (where, field))
            if space == "stages_of":
                q = obj.get("quest")
                names = ids["stages"].get(q)
                if names is not None and val is not None and val not in names:
                    err("%s: quest %s has no stage %s" % (where, q, val))
            if space == "journal_of":
                names = ids["journal"].get(obj.get("quest"))
                if names is not None and val is not None and val not in names:
                    err("%s: quest %s has no journal key %s" % (where, obj.get("quest"), val))
            if space == "scene_states_of":
                sc = obj.get("scene")
                names = ids["scene_states"].get(sc)
                if names is not None and val is not None and val not in names:
                    err("%s: scene %s has no state %s" % (where, sc, val))
    if t == "start_combat":
        for side in ("enemies", "allies", "on_victory", "on_defeat", "on_fled"):
            for ent in obj.get(side, []) or []:
                if isinstance(ent, dict) and "entity" in ent:
                    resolve(ids, "npcs", ent["entity"], where + "." + side)
        for key in ("on_victory", "on_defeat", "on_fled"):
            if isinstance(obj.get(key), list):
                walk(obj[key], where + "." + key, ids, mapping)
    if t == "give_reward":
        for it in obj.get("items", []) or []:
            iid = it.get("item") if isinstance(it, dict) else it
            resolve(ids, "items", iid, where + ".give_reward")
    if t in ("skill_check_gate", "stat_check", "opposed_check", "group_stat_check"):
        for key in ("success_effects", "fail_effects"):
            if isinstance(obj.get(key), list):
                walk(obj[key], "%s.%s" % (where, key), ids, mapping)
    if t == "start_pursuit":
        if isinstance(obj.get("on_fail"), list):
            walk(obj["on_fail"], where + ".on_fail", ids, mapping)
    if t in ("and", "or"):
        walk(obj.get("conditions") or [], where + "." + t, ids, mapping)
    if t == "not":
        walk([obj.get("condition")] if obj.get("condition") else [], where + ".not", ids, mapping)
    for key in ("conditions", "effects"):
        if isinstance(obj.get(key), list):
            walk(obj[key], where + "." + key, ids, mapping)
    for key in ("on_enter", "on_enter_conditions", "transitions", "on_use", "on_interact"):
        if isinstance(obj.get(key), (list, dict)):
            walk(obj[key], where + "." + key, ids, mapping)


def main():
    ids = collect()
    ids["variables"] = set()
    walk(ids["_rules"], "rules", ids, {"__": "rule"})
    # правила
    for rid, r in ids["_rules"].items():
        walk(r.get("conditions"), "rule %s" % rid, ids, COND_TRUTH)
        walk(r.get("effects"), "rule %s" % rid, ids, EFF_TRUTH)
    # квесты
    for qid, q in ids["_quests"].items():
        for st in q.get("stages", []):
            walk(st.get("conditions"), "quest %s/%s" % (qid, st["id"]), ids, COND_TRUTH)
            walk(st.get("on_enter_effects"), "quest %s/%s" % (qid, st["id"]), ids, EFF_TRUTH)
            walk(st.get("transitions"), "quest %s/%s" % (qid, st["id"]), ids, COND_TRUTH)
            names = ids["stages"].get(qid, set())
            for tr in st.get("transitions", []) or []:
                if tr.get("to") not in names and tr.get("to") is not None:
                    err("quest %s/%s: transition to unknown stage %s" % (qid, st["id"], tr.get("to")))
    # сцены
    for sid, s in ids["_scenes"].items():
        for sl in s.get("slots", []):
            de = sl.get("default_entity")
            if de and de not in ids["npcs"] and de not in ids["items"]:
                err("scene %s slot %s: unknown default_entity %s" % (sid, sl["id"], de))
            for uw in sl.get("use_with", []) or []:
                it = uw.get("item") if isinstance(uw, dict) else uw
                if it and it not in ids["items"]:
                    err("scene %s slot %s: unknown use_with item %s" % (sid, sl["id"], it))
        for stt in s.get("states", []):
            if isinstance(stt.get("condition"), dict):
                walk([stt["condition"]], "scene %s/%s" % (sid, stt["id"]), ids, COND_TRUTH)
        for nav in s.get("navigation", []) or []:
            if nav.get("go_to_scene") and nav["go_to_scene"] not in ids["scenes"]:
                err("scene %s nav: unknown go_to_scene %s" % (sid, nav["go_to_scene"]))
        for m in s.get("music", []) or []:
            if isinstance(m, dict) and m.get("track") and m["track"] not in ids["music"]:
                err("scene %s: unknown music %s" % (sid, m["track"]))
        if s.get("location") and s["location"] not in ids["locations"]:
            err("scene %s: unknown location %s" % (sid, s["location"]))
    # сущности
    for eid, e in ids["_entities"].items():
        if e.get("dialogue") and not os.path.exists(os.path.join(PKG, e["dialogue"])):
            err("entity %s: missing dialogue %s" % (eid, e["dialogue"]))
        if e.get("faction") and e["faction"] not in ids["factions"]:
            err("entity %s: unknown faction %s" % (eid, e["faction"]))
        for inv in e.get("inventory", []) or []:
            if inv.get("item") not in ids["items"]:
                err("entity %s: unknown inventory item %s" % (eid, inv.get("item")))
        for k, v in (e.get("equipment") or {}).items():
            if v not in ids["items"]:
                err("entity %s: unknown equipment %s" % (eid, v))
        if e.get("loot_table"):
            for l in e["loot_table"]:
                if isinstance(l, dict) and l.get("item") and l["item"] not in ids["items"]:
                    err("entity %s: unknown loot item %s" % (eid, l["item"]))
        for opt in e.get("interact_options", []) or []:
            walk(opt.get("conditions"), "entity %s option" % eid, ids, COND_TRUTH)
            walk(opt.get("effects"), "entity %s option" % eid, ids, EFF_TRUTH)
            for uw in opt.get("use_with", []) or []:
                if isinstance(uw, dict):
                    walk(uw.get("conditions"), "entity %s use_with" % eid, ids, COND_TRUTH)
                    walk(uw.get("effects"), "entity %s use_with" % eid, ids, EFF_TRUTH)
        for k in ("on_use", "on_interact"):
            if isinstance(e.get(k), dict):
                walk(e[k].get("effects"), "entity %s %s" % (eid, k), ids, EFF_TRUTH)
        if e.get("portrait"):
            for emo in e["portrait"]:
                if emo not in ids["emotions"] and emo != "neutral":
                    err("entity %s: portrait emotion '%s' not in registry" % (eid, emo))
    # мир
    world = load("world.json")
    for reg in world["regions"]:
        for loc in reg.get("locations", []):
            for sc in loc.get("scenes", []) or []:
                if sc not in ids["scenes"]:
                    err("location %s: unknown scene %s" % (loc["id"], sc))
            if loc.get("arrival_scene") and loc["arrival_scene"] not in ids["scenes"]:
                err("location %s: unknown arrival_scene %s" % (loc["id"], loc["arrival_scene"]))
            if loc.get("arena") and loc["arena"] not in ids["arenas"]:
                err("location %s: unknown arena %s" % (loc["id"], loc["arena"]))
            for r in loc.get("on_enter_rules", []) or []:
                if r not in ids["rules"]:
                    err("location %s: unknown on_enter_rule %s" % (loc["id"], r))
            for tc in loc.get("travel_connections", []) or []:
                if tc.get("to") not in ids["locations"]:
                    err("location %s: travel to unknown %s" % (loc["id"], tc.get("to")))
                tbl = tc.get("table") or tc.get("random_encounter_table")
                if tbl and tbl not in ids["tables"]:
                    err("location %s: unknown table %s" % (loc["id"], tbl))
                walk(tc.get("conditions") or tc.get("requirements"), "location %s travel" % loc["id"], ids, COND_TRUTH)
    # арены
    for aid, a in ids["_arenas"].items():
        ins = a.get("spawn_zones", {}).get("player") if isinstance(a.get("spawn_zones"), dict) else None
        for z in (a.get("spawn_zones") or {}).values() if isinstance(a.get("spawn_zones"), dict) else []:
            for ent in (z.get("units") or z.get("entities") or []) if isinstance(z, dict) else []:
                eid = ent.get("entity") if isinstance(ent, dict) else ent
                if eid and eid not in ids["npcs"]:
                    err("arena %s: unknown entity %s" % (aid, eid))
    # cutscene slides
    for cid, c in ids["_cutscenes"].items():
        for sl in c.get("slides", []):
            walk(sl.get("conditions"), "cutscene %s" % cid, ids, COND_TRUTH)
            walk(sl.get("effects"), "cutscene %s" % cid, ids, EFF_TRUTH)
    # рецепты
    for rid, r in ids["_recipes"].items():
        for inp in r.get("inputs", []) or []:
            iid = inp.get("item") if isinstance(inp, dict) else inp
            if iid and iid not in ids["items"]:
                err("recipe %s: unknown input %s" % (rid, iid))
        out = r.get("output") or {}
        oid = out.get("item") if isinstance(out, dict) else out
        if oid and oid not in ids["items"]:
            err("recipe %s: unknown output %s" % (rid, oid))
        walk(r.get("requires"), "recipe %s" % rid, ids, COND_TRUTH)
    # ink
    for name in sorted(os.listdir(INK)):
        if not name.endswith(".ink"):
            continue
        src = open(os.path.join(INK, name), encoding="utf-8").read()
        for fn, args in re.findall(r'~\s*([a-z_]+)\(([^)]*)\)', src):
            called = [a.strip().strip('"') for a in args.split(",")] if args.strip() else []
            chk = {"set_flag": "flags", "fire_rule": "rules", "start_quest": "quests",
                   "unlock_codex": "codex", "unlock_recipe": "recipes", "add_item": "items",
                   "remove_item": "items", "has_item": "items", "open_trade": "npcs",
                   "open_craft": "recipes", "change_disposition": "npcs",
                   "set_entity_state": "npcs", "set_description": "npcs",
                   "sleep": None, "advance_time": None, "change_need": "needs",
                   "apply_status": "statuses", "join_party": "npcs"}.get(fn)
            if chk and called and chk in ids and called[0] not in ids[chk]:
                err("ink %s: %s('%s') — unknown %s" % (name, fn, called[0], chk))
        for fn, args in re.findall(r'\{\s*(?:not \()?([a-z_]+)\(([^)]*)\)', src):
            called = [a.strip().strip('"') for a in args.split(",")] if args.strip() else []
            chk = {"get_flag": "flags", "has_item": "items", "get_skill": "skills",
                   "get_disposition": "npcs", "quest_stage": "quests",
                   "has_status": "statuses", "get_currency": "currencies"}.get(fn)
            if chk and chk in ids and called and called[0] not in ids[chk]:
                err("ink %s: %s('%s') — unknown %s" % (name, fn, called[0], chk))
        for q, stage in re.findall(r'quest_stage\("([a-z_]+)"\)\s*==\s*"([a-z_]+)"', src):
            if q in ids["stages"] and stage not in ids["stages"][q]:
                err("ink %s: quest %s has no stage %s" % (name, q, stage))
    # условия состояний и слотов сцены — тип SceneCondition
    SCENE_COND = {"time_of_day", "flag", "not_flag", "weather"}
    for sid, s in ids["_scenes"].items():
        for where, c in [("state %s" % st.get("id"), st.get("condition")) for st in s.get("states", [])] + \
                        [("slot %s" % sl.get("id"), sl.get("condition")) for sl in s.get("slots", [])]:
            if c is None:
                continue
            for k in c:
                if k not in SCENE_COND:
                    err("scene %s %s: unknown scene-condition key '%s'" % (sid, where, k))
            for k in ("flag", "not_flag"):
                if c.get(k) and c[k] not in ids["flags"]:
                    err("scene %s %s: unknown flag %s" % (sid, where, c[k]))
            if c.get("weather") and c["weather"] not in ids["weathers"]:
                err("scene %s %s: unknown weather %s" % (sid, where, c["weather"]))

    # геометрия сцен: слоты и зоны навигации внутри холста, без тяжёлых наложений
    for sid, s in ids["_scenes"].items():
        w = (s.get("canvas") or {}).get("w", 1280)
        h = (s.get("canvas") or {}).get("h", 720)
        navs = s.get("navigation") or []
        for sl in s.get("slots", []):
            if sl["x"] < 0 or sl["y"] < 0 or sl["x"] + sl["w"] > w or sl["y"] + sl["h"] > h:
                err("scene %s slot %s: outside canvas" % (sid, sl["id"]))
            de = sl.get("default_entity")
            if de and de in ids["_entities"]:
                t = ids["_entities"][de].get("type")
                types = sl.get("type") or []
                if t == "npc" and "person" not in types:
                    err("scene %s slot %s: npc in non-person slot" % (sid, sl["id"]))
                if t == "item" and not ({"prop", "item", "container"} & set(types)):
                    err("scene %s slot %s: item in %s slot" % (sid, sl["id"], types))
            for n in navs:
                a = n.get("area") or {}
                if a.get("x", 0) < 0 or a.get("y", 0) < 0 or \
                   a.get("x", 0) + a.get("w", 0) > w or a.get("y", 0) + a.get("h", 0) > h:
                    err("scene %s nav %s: outside canvas" % (sid, n.get("label")))
                ox = max(0, min(sl["x"] + sl["w"], a.get("x", 0) + a.get("w", 0)) - max(sl["x"], a.get("x", 0)))
                oy = max(0, min(sl["y"] + sl["h"], a.get("y", 0) + a.get("h", 0)) - max(sl["y"], a.get("y", 0)))
                if ox * oy > 0.55 * sl["w"] * sl["h"]:
                    err("scene %s slot %s overlaps nav %s" % (sid, sl["id"], n.get("label")))
        for i in range(len(s.get("slots", []))):
            for j in range(i + 1, len(s.get("slots", []))):
                a, b = s["slots"][i], s["slots"][j]
                ox = max(0, min(a["x"] + a["w"], b["x"] + b["w"]) - max(a["x"], b["x"]))
                oy = max(0, min(a["y"] + a["h"], b["y"] + b["h"]) - max(a["y"], b["y"]))
                ov = ox * oy
                if ov > 0.4 * min(a["w"] * a["h"], b["w"] * b["h"]):
                    err("scene %s slots %s/%s overlap %.0f%%" % (sid, a["id"], b["id"], 100.0 * ov / min(a["w"] * a["h"], b["w"] * b["h"])))

    # звук и музыка: ссылки только на реестр
    def scan_audio(node, where):
        if isinstance(node, list):
            for v in node: scan_audio(v, where)
            return
        if not isinstance(node, dict): return
        for key in ("ambient", "ambient_audio"):
            v = node.get(key)
            for x in (v if isinstance(v, list) else [v]):
                if isinstance(x, str) and x and x not in ids["sounds"] and x not in ids["music"]:
                    err("%s: unknown %s '%s'" % (where, key, x))
        if "music" in node:
            v = node["music"]
            for x in (v if isinstance(v, list) else [v]):
                if isinstance(x, dict):
                    t = x.get("track")
                    if t and t not in ids["music"]:
                        err("%s: unknown music track '%s'" % (where, t))
                elif isinstance(x, str) and x and x not in ids["music"]:
                    err("%s: unknown music track '%s'" % (where, x))
        for v in node.values():
            if isinstance(v, (list, dict)): scan_audio(v, where)

    for k, v in ids["_scenes"].items():
        scan_audio(v, "scene " + k)
    for k, v in ids["_cutscenes"].items():
        scan_audio(v, "cutscene " + k)
    scan_audio(load("world.json"), "world")

    # медиа: все относительные пути существуют
    def scan_paths(node, where):
        if isinstance(node, str):
            if node.startswith("assets/"):
                if not os.path.exists(os.path.join(PKG, node)):
                    err("%s: missing asset %s" % (where, node))
        elif isinstance(node, list):
            for v in node:
                scan_paths(v, where)
        elif isinstance(node, dict):
            for k, v in node.items():
                scan_paths(v, where)

    for kind in ("_scenes", "_entities", "_cutscenes"):
        for k, v in ids[kind].items():
            scan_paths(v, "%s %s" % (kind[1:], k))
    scan_paths(load("campaign.json"), "campaign")
    scan_paths(load("world.json"), "world")
    # манифест
    man = load("manifest.json")
    for kind in ("scenes", "entities", "rules", "arenas", "quests", "cutscenes", "recipes", "codex"):
        for f in man.get(kind, []):
            if not os.path.exists(os.path.join(PKG, kind, f)):
                err("manifest.%s: missing file %s" % (kind, f))
    for f in man.get("encounters", []):
        if not os.path.exists(os.path.join(PKG, "rules", f)):
            err("manifest.encounters: missing file %s" % f)
        if f in man.get("rules", []):
            err("manifest: %s listed in both rules and encounters" % f)
    for f in man.get("dialogues", []):
        if not os.path.exists(os.path.join(PKG, "dialogues", f)):
            err("manifest.dialogues: missing file %s" % f)
        if not f.endswith(".ink"):
            err("manifest.dialogues: %s is not .ink" % f)
    for kind in ("scenes", "entities", "rules", "arenas", "quests", "cutscenes", "recipes", "codex"):
        have = {f for f in os.listdir(os.path.join(PKG, kind)) if f.endswith(".json")}
        listed = set(man.get(kind, []))
        if kind == "rules":
            listed |= set(man.get("encounters", []))
        extra = have - listed
        if extra:
            err("manifest.%s: files not listed: %s" % (kind, sorted(extra)))
    ink_have = {f for f in os.listdir(INK) if f.endswith(".ink")}
    extra_ink = ink_have - set(man.get("dialogues", []))
    if extra_ink:
        err("manifest.dialogues: files not listed: %s" % sorted(extra_ink))
    # стартовые точки
    meta = load("campaign.json")
    if meta.get("starting_location") not in ids["locations"]:
        err("campaign.starting_location: unknown %s" % meta.get("starting_location"))
    if meta.get("starting_scene") not in ids["scenes"]:
        err("campaign.starting_scene: unknown %s" % meta.get("starting_scene"))
    if meta.get("default_player") not in ids["npcs"]:
        err("campaign.default_player: unknown %s" % meta.get("default_player"))
    for reg in load("world.json")["regions"]:
        if meta.get("starting_region") and reg["id"] != meta["starting_region"] and False:
            pass
    regions = {r["id"] for r in load("world.json")["regions"]}
    if meta.get("starting_region") not in regions:
        err("campaign.starting_region: unknown %s" % meta.get("starting_region"))
    # рецепты: tools/known
    for rid, r in ids["_recipes"].items():
        if r.get("known"):
            continue
    # каждый флаг должен иметь description (проверка аудита)
    for f in load("campaign.json").get("flags", []):
        if not f.get("description"):
            err("flag %s: no description" % f["id"])
    return ERRORS


if __name__ == "__main__":
    errs = main()
    for e in errs:
        print(e)
    print("TOTAL", len(errs))
