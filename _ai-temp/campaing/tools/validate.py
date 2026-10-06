#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""Проверка собранного пакета кампании.

1. JSON Schema (__chronicle_ai__/campaign.schema.json) по MonolithDoc;
2. ссылочная целостность: id, флаги, статусы, способности, навыки, сцены,
   локации, слоты, правила, квесты и их стадии, журнальные записи, рецепты,
   кодекс, арены, катсцены, музыка, звуки, файлы-ассеты;
3. чек-лист гайда: описания флагов, короткие подписи потребностей,
   манифест (файлы встреч только в encounters), бюджеты создания героя,
   достижимость сцен и слотов, геометрия.

Запуск: python3 tools/validate.py
"""
import glob
import json
import os
import re
import sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SCHEMA = os.path.join(ROOT, "__chronicle_ai__", "campaign.schema.json")

problems = []
notes = []


def need(where, kind, val):
    if val is None:
        return
    reg = REG.get(kind)
    if reg is not None:
        if val not in reg and not (kind == "variable" and not reg):
            problems.append(f"ССЫЛКА {kind} «{val}» не найден ({where})")
        return
    ids = IDS.get(kind)
    if ids is not None and val not in ids:
        problems.append(f"ССЫЛКА {kind} «{val}» не найден ({where})")


def ids_of(x):
    if isinstance(x, dict):
        return set(x)
    if isinstance(x, list):
        out = set()
        for i in x:
            if isinstance(i, dict) and "id" in i:
                out.add(i["id"])
            elif isinstance(i, str):
                out.add(i)
        return out
    return set()


def walk_effects(effs, where, depth=0):
    if depth > 4:
        return
    for e in effs or []:
        t = e.get("type")
        if t in ("set_flag", "clear_flag", "flag_set", "flag_not_set"):
            need(where, "flag", e.get("flag"))
        elif t in ("apply_status", "remove_status"):
            need(where, "status", e.get("status"))
        elif t in ("add_item", "remove_item", "equipped"):
            need(where, "item", e.get("item"))
        elif t in ("set_variable", "change_variable"):
            need(where, "variable", e.get("var"))
        elif t == "change_need":
            need(where, "need", e.get("need"))
        elif t == "change_disposition":
            tgt = e.get("target", "")
            need(where, "faction" if tgt.startswith("faction_") else "entity", tgt)
        elif t == "start_combat":
            for en in e.get("enemies", []):
                need(where, "npc", en.get("entity"))
            need(where, "arena", e.get("arena"))
            for k in ("on_victory", "on_defeat", "on_fled"):
                walk_effects(e.get(k), f"{where}/{k}", depth + 1)
        elif t == "teleport_player":
            need(where, "location", e.get("location"))
            need(where, "scene", e.get("scene"))
        elif t in ("start_quest", "fail_quest"):
            need(where, "quest", e.get("quest"))
        elif t == "advance_quest":
            need(where, "quest", e.get("quest"))
            if e.get("stage") not in STAGES.get(e.get("quest"), set()):
                problems.append(f"ССЫЛКА стадия {e.get('quest')}/{e.get('stage')} ({where})")
        elif t == "journal_update":
            need(where, "quest", e.get("quest"))
            if e.get("text_key") not in JOURNALS.get(e.get("quest"), set()):
                problems.append(f"ССЫЛКА журнал {e.get('quest')}/{e.get('text_key')} ({where})")
        elif t == "fire_rule":
            need(where, "rule", e.get("rule"))
        elif t == "unlock_codex":
            need(where, "codex", e.get("entry"))
        elif t in ("unlock_recipe", "open_craft"):
            if e.get("recipe"):
                need(where, "recipe", e.get("recipe"))
        elif t == "play_cutscene":
            need(where, "cutscene", e.get("cutscene"))
        elif t == "set_weather":
            need(where, "weather", e.get("weather"))
        elif t == "set_price_event":
            need(where, "price_event", e.get("id"))
        elif t == "meta_currency":
            need(where, "meta_currency", e.get("id"))
        elif t in ("join_party", "leave_party", "open_trade"):
            need(where, "npc", e.get("npc") or e.get("entity"))
        elif t in ("spawn_entity", "remove_entity", "start_dialogue", "set_description",
                   "set_entity_state"):
            need(where, "entity", e.get("entity"))
        elif t == "reveal_location":
            need(where, "location", e.get("location"))
        elif t == "skill_check_gate":
            need(where, "skill", e.get("skill"))
            walk_effects(e.get("success_effects"), where + "/успех", depth + 1)
            walk_effects(e.get("fail_effects"), where + "/провал", depth + 1)
        elif t == "change_scene_state":
            need(where, "scene", e.get("scene"))
        elif t == "change_skill":
            need(where, "skill", e.get("skill"))
        elif t == "stat_check":
            need(where, "stat", e.get("stat"))
        elif t == "start_pursuit":
            walk_effects(e.get("on_fail"), where + "/провал", depth + 1)
        elif t == "give_reward":
            for it in e.get("items", []):
                need(where, "item", it.get("item"))
        elif t == "roll_event_table":
            need(where, "event_table", e.get("table"))


def walk_conds(conds, where, depth=0):
    for c in conds or []:
        t = c.get("type")
        if t in ("flag_set", "flag_not_set"):
            need(where, "flag", c.get("flag"))
        elif t == "player_enters_scene":
            need(where, "scene", c.get("scene"))
        elif t == "player_enters_location":
            need(where, "location", c.get("location"))
        elif t == "quest_at_stage":
            need(where, "quest", c.get("quest"))
            if c.get("stage") not in STAGES.get(c.get("quest"), set()):
                problems.append(f"ССЫЛКА стадия {c.get('quest')}/{c.get('stage')} ({where})")
        elif t in ("has_item", "equipped"):
            need(where, "item", c.get("item"))
        elif t == "variable_compare":
            need(where, "variable", c.get("var"))
        elif t == "has_status":
            need(where, "status", c.get("status"))
        elif t == "weather_is":
            need(where, "weather", c.get("weather"))
        elif t in ("entity_alive", "entity_dead", "in_party"):
            need(where, "entity", c.get("entity"))
        elif t in ("disposition_ge", "disposition_le"):
            tgt = c.get("target", "")
            need(where, "faction" if tgt.startswith("faction_") else "entity", tgt)
        elif t in ("need_le", "need_ge"):
            need(where, "need", c.get("need"))
        elif t == "skill_ge":
            need(where, "skill", c.get("skill"))
        elif t == "stat_ge":
            need(where, "stat", c.get("stat"))
        elif t in ("and", "or"):
            walk_conds(c.get("conditions"), where, depth + 1)
        elif t == "not":
            walk_conds([c.get("condition")], where, depth + 1)


def asset(where, p):
    if not p or not p.startswith("assets/"):
        return
    if not os.path.exists(os.path.join(ROOT, p)):
        problems.append(f"ФАЙЛ {p} не найден ({where})")


def main():
    global REG, IDS, STAGES, JOURNALS

    def load(p):
        return json.load(open(p, encoding="utf-8"))

    camp = load(os.path.join(ROOT, "campaign.json"))
    world = load(os.path.join(ROOT, "world.json"))
    manifest = load(os.path.join(ROOT, "manifest.json"))
    scenes, ents, rules, quests, arenas, cuts, recipes, codex, dlgs, enct = {}, {}, {}, {}, {}, {}, {}, {}, {}, {}
    for f in manifest.get("scenes", []):
        o = load(os.path.join(ROOT, "scenes", f)); scenes[o["id"]] = o
    for f in manifest.get("entities", []):
        o = load(os.path.join(ROOT, "entities", f)); ents[o["id"]] = o
    for f in manifest.get("rules", []):
        o = load(os.path.join(ROOT, "rules", f)); rules[o["id"]] = o
    for f in manifest.get("quests", []):
        o = load(os.path.join(ROOT, "quests", f)); quests[o["id"]] = o
    for f in manifest.get("arenas", []):
        o = load(os.path.join(ROOT, "arenas", f)); arenas[o["id"]] = o
    for f in manifest.get("cutscenes", []):
        o = load(os.path.join(ROOT, "cutscenes", f)); cuts[o["id"]] = o
    for f in manifest.get("recipes", []):
        o = load(os.path.join(ROOT, "recipes", f)); recipes[o["id"]] = o
    for f in manifest.get("codex", []):
        o = load(os.path.join(ROOT, "codex", f)); codex[o["id"]] = o
    for f in manifest.get("dialogues", []):
        n = f[:-4]
        dlgs[n] = load(os.path.join(ROOT, "dialogues", n + ".dlg.json"))
    for f in manifest.get("encounters", []):
        p = os.path.join(ROOT, "rules", f)
        if not os.path.exists(p):
            p = os.path.join(ROOT, "encounters", f)
        if os.path.exists(p):
            for t in load(p)["encounter_tables"]:
                enct[t["id"]] = t

    mono = {"campaign": camp, "world": world, "scenes": scenes, "entities": ents,
            "rules": rules, "quests": quests, "arenas": arenas, "cutscenes": cuts,
            "encounters": enct, "recipes": recipes, "codex": codex, "dialogues": dlgs}

    # ------------------------------------------------------------- схема ----
    try:
        import jsonschema
    except ImportError:
        notes.append("jsonschema не установлен — пропуск проверки схемы "
                     "(pip install --break-system-packages jsonschema)")
    else:
        schema = load(SCHEMA)
        v = jsonschema.Draft202012Validator(schema)
        errs = sorted(v.iter_errors(mono), key=lambda e: list(e.path))
        for e in errs:
            p = "/".join(str(x) for x in list(e.path)[:8])
            problems.append(f"СХЕМА {p}: {e.message[:220]}")
        print(f"схема: ошибок {len(errs)}")

    cc = camp.get("char_creation") or {}
    REG = {
        "flag": ids_of(camp.get("flags")),
        "variable": ids_of(camp.get("variables")),
        "status": ids_of(camp.get("statuses")),
        "ability": ids_of(camp.get("abilities")),
        "need": ids_of(camp.get("needs")),
        "faction": ids_of(camp.get("factions")),
        "chapter": ids_of(camp.get("chapters")),
        "music": ids_of(camp.get("music_tracks")),
        "sound": ids_of(camp.get("sounds")),
        "skill": ids_of(camp.get("skills")),
        "stat": set((cc.get("stat_limits") or {}).get("stats", {})),
        "weather": ids_of(camp.get("weathers")),
        "price_event": ids_of(camp.get("price_events")),
        "meta_currency": ids_of((camp.get("metaprogress") or {}).get("currencies")),
        "codex_cat": ids_of(camp.get("codex_categories")),
        "emotion": ids_of(camp.get("emotions")),
        "slot_type": ids_of(camp.get("slot_types")),
        "item_cat": ids_of(camp.get("item_categories")),
        "equip_slot": ids_of(camp.get("equipment_slots")),
        "crime": ids_of(camp.get("crimes")),
        "event_table": ids_of((camp.get("generators") or {}).get("event_tables")),
    }
    IDS = {
        "scene": set(scenes), "entity": set(ents),
        "item": {k for k, v in ents.items() if v.get("type") == "item"},
        "npc": {k for k, v in ents.items() if v.get("type") == "npc"},
        "rule": set(rules), "quest": set(quests), "arena": set(arenas),
        "cutscene": set(cuts), "encounter": set(enct), "recipe": set(recipes),
        "codex": set(codex), "dialogue": set(dlgs), "location": set(),
    }
    for r in world["regions"]:
        for l in r.get("locations", []):
            IDS["location"].add(l["id"])
    STAGES = {q: {s["id"] for s in v.get("stages", [])} for q, v in quests.items()}
    JOURNALS = {q: set(v.get("journal_entries", {})) for q, v in quests.items()}

    # ------------------------------------------------------------- обход ----
    for rid, r in rules.items():
        walk_conds(r.get("conditions"), f"правило {rid}")
        walk_effects(r.get("effects"), f"правило {rid}")

    for sid, s in scenes.items():
        need(f"сцена {sid}", "location", s.get("location"))
        need(f"сцена {sid}", "chapter", s.get("chapter"))
        if not s.get("navigation"):
            problems.append(f"ТУПИК сцена {sid}: нет навигации")
        if not s.get("states"):
            problems.append(f"СЦЕНА {sid}: нет состояний")
        for st in s.get("states", []):
            asset(f"сцена {sid}/{st.get('id')}", st.get("image"))
        for mr in s.get("music", []):
            for tr in mr.get("tracks", []):
                need(f"сцена {sid}", "music", tr)
        for a in s.get("ambient", []):
            if isinstance(a, dict):  # AmbientRule: слой с условиями
                for one in a.get("sounds", []) + ([a["sound"]] if a.get("sound") else []):
                    need(f"сцена {sid}", "sound", one)
                walk_conds(a.get("conditions"), f"сцена {sid} ambient")
            else:
                need(f"сцена {sid}", "sound", a)
        for sl in s.get("slots", []):
            need(f"сцена {sid}/{sl['id']}", "entity", sl.get("default_entity"))
            for t in sl.get("type", []):
                need(f"сцена {sid}/{sl['id']}", "slot_type", t)
            for uw in sl.get("use_with", []):
                need(f"сцена {sid}/{sl['id']}", "item", uw.get("item"))
                walk_effects(uw.get("effects"), f"сцена {sid}/{sl['id']}")
        for nz in s.get("navigation", []):
            need(f"сцена {sid} навигация", "scene", nz.get("go_to_scene"))
            need(f"сцена {sid} навигация", "location", nz.get("go_to_location"))
            walk_effects(nz.get("effects"), f"сцена {sid} навигация")
            walk_conds(nz.get("conditions"), f"сцена {sid} навигация")

    for r in world["regions"]:
        for l in r.get("locations", []):
            if not l.get("scenes"):
                problems.append(f"ЛОКАЦИЯ {l['id']}: нет сцен")
            for sc in l.get("scenes", []):
                need(f"локация {l['id']}", "scene", sc)
            need(f"локация {l['id']}", "scene", l.get("arrival_scene"))
            need(f"локация {l['id']}", "arena", l.get("arena"))
            for tc in l.get("travel_connections", []):
                need(f"локация {l['id']}", "location", tc.get("to"))
                need(f"локация {l['id']}", "encounter", tc.get("random_encounter_table"))
            for mr in l.get("music", []) or []:
                for tr in mr.get("tracks", []):
                    need(f"локация {l['id']}", "music", tr)
            for a in l.get("ambient", []):
                if isinstance(a, dict):  # AmbientRule: слой с условиями
                    for one in a.get("sounds", []) + ([a["sound"]] if a.get("sound") else []):
                        need(f"локация {l['id']}", "sound", one)
                    walk_conds(a.get("conditions"), f"локация {l['id']} ambient")
                    if isinstance(a.get("volume"), (int, float)) and not 0 <= a["volume"] <= 1:
                        problems.append(f"ГРОМКОСТЬ {a['volume']} вне 0…1 ({l['id']})")
                else:
                    need(f"локация {l['id']}", "sound", a)
            for orl in l.get("on_enter_rules", []):
                need(f"локация {l['id']}", "rule", orl)

    for eid, e in ents.items():
        for k in ("portrait",):
            for st, p in (e.get(k) or {}).items():
                asset(f"{eid} {k}", p)
        for p in [e.get("scene_sprite")] + list((e.get("scene_sprite_states") or {}).values()):
            asset(f"{eid} спрайт", p if isinstance(p, str) else None)
        for p in [e.get("combat_figure")] + list((e.get("combat_figure_states") or {}).values()):
            asset(f"{eid} фигурка", p if isinstance(p, str) else None)
        if e.get("type") == "npc":
            need(eid, "faction", e.get("faction"))
            need(eid, "slot_type", e.get("slot_type"))
            for ab in e.get("abilities", []):
                need(eid, "ability", ab)
            for sk in e.get("skills", {}):
                need(eid, "skill", sk)
            if e.get("dialogue"):
                asset(eid, e["dialogue"])
                nm = e["dialogue"].split("/")[-1][:-4]
                if nm not in IDS["dialogue"]:
                    problems.append(f"ССЫЛКА диалог «{nm}» ({eid})")
            for it in e.get("inventory", []):
                need(eid, "item", it.get("item"))
            for it in (e.get("trade") or {}).get("items", []):
                need(eid, "item", it.get("item") if isinstance(it, dict) else it)
            for eq in (e.get("equipment") or {}).values():
                need(eid, "item", eq)
            for sc in e.get("schedule", []):
                need(f"{eid} расписание", "scene", sc.get("scene"))
                need(f"{eid} расписание", "location", sc.get("location"))
                if sc.get("slot") and sc.get("scene") in scenes:
                    if sc["slot"] not in {x["id"] for x in scenes[sc["scene"]]["slots"]}:
                        problems.append(f"ССЫЛКА слот «{sc['slot']}» расписания {eid} "
                                        f"нет в сцене {sc['scene']}")
        else:
            need(eid, "item_cat", e.get("category"))
            need(eid, "equip_slot", e.get("equip_slot"))
            for io in e.get("interact_options", []):
                walk_effects(io.get("effects"), f"предмет {eid}")
                walk_conds(io.get("conditions"), f"предмет {eid}")
                if io.get("sound"):
                    need(eid, "sound", io["sound"])
            for ue in e.get("use_effects", []):
                walk_effects(ue.get("effects"), f"предмет {eid} {ue.get('verb', '')}")
            wd = e.get("weapon_data") or {}
            for ab in wd.get("abilities", []):
                need(eid, "ability", ab)

    for qid, q in quests.items():
        need(f"квест {qid}", "chapter", q.get("chapter"))
        targets = set()
        for st in q.get("stages", []):
            walk_effects(st.get("on_enter_effects"), f"квест {qid}/{st['id']}")
            for tr in st.get("transitions", []):
                targets.add(tr.get("to"))
                walk_conds(tr.get("conditions"), f"квест {qid}/{st['id']}")
        for t in targets:
            if t not in STAGES[qid]:
                problems.append(f"ССЫЛКА квест {qid}: переход в несуществующую стадию {t}")

    for rid, r in recipes.items():
        for i in r.get("inputs", []):
            need(f"рецепт {rid}", "item", i.get("item"))
        for t in r.get("tools", []):
            need(f"рецепт {rid}", "item", t)
        need(f"рецепт {rid}", "item", (r.get("output") or {}).get("item"))
        if r.get("skill"):
            need(f"рецепт {rid}", "skill", r["skill"]["id"])

    for eid, t in enct.items():
        for en in t.get("entries", []):
            for x in en.get("enemies", []):
                need(f"встреча {eid}", "npc", x.get("entity"))
            need(f"встреча {eid}", "arena", en.get("arena"))
            need(f"встреча {eid}", "skill", en.get("skill"))
            walk_effects(en.get("effects"), f"встреча {eid}")
            walk_effects(en.get("success_effects"), f"встреча {eid}")
            walk_effects(en.get("fail_effects"), f"встреча {eid}")

    for cid, c in cuts.items():
        need(f"катсцена {cid}", "music", c.get("music"))
        need(f"катсцена {cid}", "chapter", c.get("chapter"))
        for i, sl in enumerate(c.get("slides", [])):
            asset(f"катсцена {cid} слайд {i}", sl.get("image"))
            asset(f"катсцена {cid} слайд {i}", sl.get("voice"))

    for cid, c in codex.items():
        need(f"кодекс {cid}", "codex_cat", c.get("category"))
        need(f"кодекс {cid}", "npc", c.get("creature_entity"))
        asset(f"кодекс {cid}", c.get("image"))

    for a in camp.get("endings", []):
        walk_conds(a.get("conditions"), f"концовка {a['id']}")
        asset(f"концовка {a['id']}", a.get("image"))

    for t in camp.get("music_tracks", []):
        if isinstance(t.get("src"), str):
            asset(f"трек {t['id']}", t["src"])
    for s in camp.get("sounds", []):
        srcs = s.get("src")
        for one in (srcs if isinstance(srcs, list) else [srcs]):
            if isinstance(one, str):
                asset(f"звук {s['id']}", one)
    for sd in camp.get("statuses", []):
        for sm in sd.get("skill_mods", []):
            need(f"статус {sd['id']}", "skill", sm.get("skill"))
        for e in sd.get("on_apply", []) + sd.get("on_expire", []):
            walk_effects([e], f"статус {sd['id']}")
        if not (sd.get("description") or "").strip():
            problems.append(f"СТАТУС «{sd['id']}» без описания")
    for ad in camp.get("abilities", []):
        need(f"способность {ad['id']}", "skill", ad.get("skill"))
        need(f"способность {ad['id']}", "status", ad.get("status"))
        if not (ad.get("description") or "").strip():
            problems.append(f"СПОСОБНОСТЬ «{ad['id']}» без описания")
    for nd in camp.get("needs", []):
        need(f"потребность {nd['id']}", "rule", nd.get("on_zero_effect"))
        if len(nd.get("label", "")) > 18:
            problems.append(f"ПОТРЕБНОСТЬ «{nd['id']}»: подпись длиннее 18 знаков")
    for w in camp.get("weathers", []):
        for a in w.get("ambient", []):
            need(f"погода {w['id']}", "sound", a)

    # ------------------------------------------------------------ диалоги ---
    for name, d in dlgs.items():
        knots = {n["id"] for n in d["nodes"]}
        for n in d["nodes"]:
            secs = list(n.get("sections", []))
            for ch in n.get("choices", []):
                secs += list(ch.get("sections", []))
                ck = ch.get("check")
                if ck:
                    need(f"диалог {name}", "skill", ck.get("skill"))
                    for br in ("success", "fail"):
                        secs += list((ck.get(br) or {}).get("sections", []))
                g = ch.get("goto")
                if g not in (None, "", "end", "stay") and g not in knots:
                    problems.append(f"ССЫЛКА диалог {name}: goto «{g}»")
            for sec in secs:
                for st in sec.get("steps", []):
                    if st["kind"] == "effect":
                        walk_effects([st["effect"]], f"диалог {name}")
                    else:
                        asset(f"диалог {name}", (st["line"] or {}).get("voice"))
            tm = n.get("timer") or {}
            if tm.get("node") and tm["node"] not in knots:
                problems.append(f"ССЫЛКА диалог {name}: таймер → «{tm['node']}»")
            if n.get("goto") and n["goto"] != "end" and n["goto"] not in knots:
                problems.append(f"ССЫЛКА диалог {name}: узел {n['id']} → «{n['goto']}»")

    for eid, e in ents.items():
        if e.get("type") == "npc" and eid != "player_hero" and not e.get("dialogue"):
            notes.append(f"у {eid} нет диалога")

    # --------------------------------------------------------- чек-лист -----
    for f in camp.get("flags", []):
        if not (f.get("description") or "").strip():
            problems.append(f"ФЛАГ «{f.get('id')}» без description")
    for k in ("scenes", "entities", "rules", "dialogues"):
        if not manifest.get(k):
            problems.append(f"МАНИФЕСТ пустой массив {k}")
    for f in manifest.get("encounters", []):
        if f in manifest.get("rules", []):
            problems.append(f"МАНИФЕСТ файл встреч {f} попал в rules")
    for f in manifest.get("dialogues", []):
        if not f.endswith(".ink"):
            problems.append(f"МАНИФЕСТ dialogues: {f} не .ink")
    dirs = {"scenes": "scenes", "entities": "entities", "rules": "rules", "arenas": "arenas",
            "quests": "quests", "cutscenes": "cutscenes", "recipes": "recipes",
            "codex": "codex", "encounters": "rules"}
    for key, sub in dirs.items():
        for f in manifest.get(key, []):
            p = os.path.join(ROOT, sub, f)
            if not os.path.exists(p) and not os.path.exists(os.path.join(ROOT, "encounters", f)):
                problems.append(f"МАНИФЕСТ нет файла {sub}/{f}")
    for f in manifest.get("dialogues", []):
        if not os.path.exists(os.path.join(ROOT, "dialogues", f)):
            problems.append(f"МАНИФЕСТ нет файла dialogues/{f}")

    # бюджеты создания героя
    if cc.get("professions"):
        smin = (cc.get("stat_limits") or {}).get("min", 0)
        for prof in cc["professions"]:
            tot = sum(max(0, v - smin) for v in (prof.get("stats") or {}).values())
            if tot != cc.get("total_points"):
                problems.append(f"ГЕРОЙ {prof['id']}: характеристик {tot}, "
                                f"нужно {cc.get('total_points')}")
            for call in cc.get("callings", []):
                cap = cc.get("skill_cap", 100)
                fl = cc.get("skill_floor", 0)
                mand = set(cc.get("mandatory_skills") or [])
                sp = 0
                for sk, v in (call.get("skills") or {}).items():
                    base = max(fl, 25 if sk in mand else 0) + \
                        (prof.get("skill_bonus") or {}).get(sk, 0)
                    sp += max(0, min(cap, v) - base)
                if sp != cc.get("skill_points"):
                    problems.append(f"ГЕРОЙ {prof['id']}×{call['id']}: навыков {sp}, "
                                    f"нужно {cc.get('skill_points')}")
                if set(call.get("skills") or {}) & set(cc.get("forbidden_skills") or []):
                    problems.append(f"ГЕРОЙ {call['id']}: запрещённый навык")

    # геометрия слотов и зон
    for sid, s in scenes.items():
        W, H = s["canvas"]["w"], s["canvas"]["h"]
        slots = s["slots"]
        for i in range(len(slots)):
            a = slots[i]
            for j in range(i + 1, len(slots)):
                b = slots[j]
                if not (a["x"] + a["w"] <= b["x"] or b["x"] + b["w"] <= a["x"] or
                        a["y"] + a["h"] <= b["y"] or b["y"] + b["h"] <= a["y"]):
                    problems.append(f"ГЕОМЕТРИЯ {sid}: слоты {a['id']} и {b['id']} пересекаются")
        for nz in s.get("navigation", []):
            r = nz.get("area") or {}
            if not r:
                continue
            for k in slots:
                if not (r["x"] + r["w"] <= k["x"] or k["x"] + k["w"] <= r["x"] or
                        r["y"] + r["h"] <= k["y"] or k["y"] + k["h"] <= r["y"]):
                    problems.append(f"ГЕОМЕТРИЯ {sid}: зона «{nz.get('label')}» "
                                    f"перекрывает слот {k['id']}")

    for aid, a in arenas.items():
        g = a["hex_grid"]
        if a.get("music"):
            need(f"арена {aid}", "music", a["music"])
        for zone in ("player", "enemy"):
            for h in (a.get("spawn_zones", {}).get(zone, {}) or {}).get("hexes", []):
                if not (0 <= h[0] < g["cols"] and 0 <= h[1] < g["rows"]):
                    problems.append(f"АРЕНА {aid}: зона {zone} {h} вне сетки")
        for grp in ("blocked_hexes", "difficult_terrain"):
            for h in g.get(grp, []):
                if not (0 <= h[0] < g["cols"] and 0 <= h[1] < g["rows"]):
                    problems.append(f"АРЕНА {aid}: {grp} {h} вне сетки")

    print(f"\nпроверено: сцен {len(scenes)}, сущностей {len(ents)}, правил {len(rules)}, "
          f"квестов {len(quests)}, арен {len(arenas)}, катсцен {len(cuts)}, "
          f"рецептов {len(recipes)}, кодекс {len(codex)}, диалогов {len(dlgs)}")
    if notes:
        print("\n--- замечания ---")
        for n in sorted(set(notes)):
            print(" ·", n)
    print("\n--- проблемы ---")
    if problems:
        for p in problems:
            print(" ·", p)
    else:
        print("нет")
    print(f"\nитого проблем: {len(problems)}")
    return 1 if problems else 0


if __name__ == "__main__":
    sys.exit(main())
