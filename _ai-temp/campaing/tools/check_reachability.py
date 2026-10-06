#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""Ищет тупики в сюжете: reachable-анализ по флагам.

Собирает все места кампании, где поднимаются флаги (правила, эффекты
квестов, действия предметов, слоты сцен, реплики диалогов, встречи),
и итеративно «проигрывает» их: эффект срабатывает, если его условия
выполнимы уже известными флагами. Неизвестные условия (навыки,
предметы, стадии квеста) считаются выполнимыми — это верхняя оценка,
поэтому отчёт показывает не «недостижимо вообще», а «не достижимо
одними флагами, значит ветка висит на проверке или на предмете».

Что ищем:
  * флаги, которые никто не поднимает, но проверяют в условиях — вечная ложь;
  * концовки, до которых нельзя дойти;
  * правила, которые никогда не сработают.

Запуск: python3 tools/check_reachability.py
"""
import glob
import json
import os
import sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))


def load(p):
    return json.load(open(os.path.join(ROOT, p), encoding="utf-8"))


def effects_of(obj):
    """все группы эффектов объекта: (условия, [эффекты])"""
    out = []
    if obj.get("effects"):
        out.append(("", obj.get("conditions") or [], obj["effects"]))
    for io in obj.get("interact_options", []) or []:
        out.append((io.get("label", ""), io.get("conditions") or [], io.get("effects") or []))
    for ue in obj.get("use_effects", []) or []:
        out.append((ue.get("verb", ""), ue.get("conditions") or [], ue.get("effects") or []))
    for nz in obj.get("navigation", []) or []:
        out.append((nz.get("label", ""), nz.get("conditions") or [], nz.get("effects") or []))
    for sl in obj.get("slots", []) or []:
        for uw in sl.get("use_with", []) or []:
            out.append((sl.get("id", ""), uw.get("conditions") or [], uw.get("effects") or []))
    return out


_seq = [0]


def uname(base):
    _seq[0] += 1
    return f"{base}#{_seq[0]}"


def walk_effects(effs, sink, depth=0, rules=None):
    """кладёт в sink все set_flag/clear_flag/advance_quest из дерева эффектов"""
    rules = rules or {}
    for e in effs or []:
        t = e.get("type")
        if t == "set_flag":
            sink.append(("set", e.get("flag")))
        elif t == "clear_flag":
            sink.append(("clear", e.get("flag")))
        elif t == "skill_check_gate":
            walk_effects(e.get("success_effects"), sink, depth, rules)
            walk_effects(e.get("fail_effects"), sink, depth, rules)
        elif t == "start_combat":
            for k in ("on_victory", "on_defeat", "on_fled"):
                walk_effects(e.get(k), sink, depth, rules)
        elif t in ("advance_quest", "start_quest"):
            sink.append(("quest", e.get("quest")))
        elif t == "fire_rule" and depth < 6:
            tgt = rules.get(e.get("rule"))
            if tgt is not None:
                walk_effects(tgt.get("effects"), sink, depth + 1, rules)


END_PREFIXES = ("end_",)
IGNORE_FLAGS = {"case_ended"}


def end_flag(name):
    return name in IGNORE_FLAGS or name.startswith(END_PREFIXES)


def cond_ok(conds, known):
    for c in conds or []:
        t = c.get("type")
        if t in ("flag_set", "flag_not_set") and end_flag(c.get("flag")):
            # концовки mutually exclusive: в одной проходке поднимается одна,
            # поэтому их собственные флаги в условиях не учитываем
            continue
        if t == "flag_set":
            if c.get("flag") not in known:
                return False
        elif t == "flag_not_set":
            if c.get("flag") in known:
                return False
        elif t in ("and", "or"):
            subs = [cond_ok([x], known) for x in c.get("conditions", [])]
            if t == "and" and not all(subs):
                return False
            if t == "or" and not any(subs):
                return False
        elif t == "not":
            inner = c.get("condition") or {}
            if inner.get("type") in ("flag_set", "flag_not_set"):
                if cond_ok([inner], known):
                    return False
                continue
            # неизвестное условие под отрицанием считаем выполнимым
        # остальные условия (предметы, навыки, стадии квеста) считаем выполнимыми
    return True


def main():
    camp = load("campaign.json")
    man = load("manifest.json")
    registry = {f["id"] for f in camp["flags"]}

    groups = []  # (откуда, условия, эффекты)

    rules_by_id = {}

    def add_rule(doc, src):
        if "rules" in doc:
            for r in doc["rules"]:
                add_rule(r, src)
            return
        if "id" in doc and ("effects" in doc or "conditions" in doc):
            rules_by_id[doc["id"]] = doc
            groups.append((doc["id"], doc.get("conditions") or [], doc.get("effects") or []))
        for t in doc.get("encounter_tables", []):
            for en in t.get("entries", []):
                groups.append((uname(t["id"] + "/" + str(en.get("type", ""))),
                               [], (en.get("effects") or []) +
                               (en.get("success_effects") or []) +
                               (en.get("fail_effects") or [])))

    for f in man.get("rules", []):
        p = "rules/" + f
        if not os.path.exists(os.path.join(ROOT, p)):
            p = "encounters/" + f
        if not os.path.exists(os.path.join(ROOT, p)):
            continue
        add_rule(load(p), p)

    for f in man.get("quests", []):
        q = load("quests/" + f)
        for st in q.get("stages", []):
            groups.append((uname(f"{q['id']}/{st['id']}"), [], st.get("on_enter_effects") or []))
            for tr in st.get("transitions", []):
                groups.append((uname(f"{q['id']}/{st['id']}→{tr.get('to')}"),
                               tr.get("conditions") or [], tr.get("effects") or []))

    for f in man.get("entities", []):
        d = load("entities/" + f)
        for where, conds, effs in effects_of(d):
            if effs:
                groups.append((uname(d["id"] + "/" + str(where)), conds, effs))

    for f in man.get("scenes", []):
        d = load("scenes/" + f)
        for where, conds, effs in effects_of(d):
            if effs:
                groups.append((uname(d["id"] + "/" + str(where)), conds, effs))

    for f in man.get("dialogues", []):
        d = load("dialogues/" + f[:-4] + ".dlg.json")
        for node in d["nodes"]:
            secs = list(node.get("sections", []))
            for ch in node.get("choices", []):
                secs += list(ch.get("sections", []))
                ck = ch.get("check") or {}
                for br in ("success", "fail"):
                    secs += list((ck.get(br) or {}).get("sections", []))
            for sec in secs:
                for st in sec.get("steps", []):
                    if st["kind"] == "effect":
                        groups.append((uname(f[:-4] + "/" + node["id"]), [], [st["effect"]]))

    # ------------------------------------------------------------ проигрываем
    known = set()
    fired = []
    for _ in range(12):
        new = False
        for name, conds, effs in groups:
            if name in fired:
                continue
            if not cond_ok(conds, known):
                continue
            sink = []
            walk_effects(effs, sink, 0, rules_by_id)
            fired.append(name)
            for kind, val in sink:
                if kind == "set" and val and val not in known:
                    known.add(val)
                    new = True
        if not new:
            break

    # --------------------------------------------- предметы и кодекс
    def flatten(effs, depth=0, out=None):
        """все эффекты, включая вложенные в проверки, бои и fire_rule"""
        out = [] if out is None else out
        for e in effs or []:
            out.append(e)
            t = e.get("type")
            if t == "skill_check_gate":
                flatten(e.get("success_effects"), depth + 1, out)
                flatten(e.get("fail_effects"), depth + 1, out)
            elif t == "start_combat":
                for k in ("on_victory", "on_defeat", "on_fled"):
                    flatten(e.get(k), depth + 1, out)
            elif t == "fire_rule" and depth < 6:
                tgt = rules_by_id.get(e.get("rule"))
                if tgt is not None:
                    flatten(tgt.get("effects"), depth + 1, out)
        return out

    granted, unlocked = set(), set()
    for name, conds, effs in groups:
        # условия не учитываем: вопрос в том, существует ли место,
        # где предмет или запись вообще выдаётся
        for e in flatten(effs) or []:
            if e.get("type") == "add_item":
                granted.add(e.get("item"))
            if e.get("type") == "unlock_codex":
                unlocked.add(e.get("entry"))
        for k, v in sink:
            if k == "quest":
                q = None
                for f in man["quests"]:
                    doc = load("quests/" + f)
                    if doc["id"] == v:
                        q = doc
                if q:
                    for st in q.get("stages", []):
                        for e2 in st.get("on_enter_effects") or []:
                            if e2.get("type") == "add_item":
                                granted.add(e2.get("item"))
                            if e2.get("type") == "unlock_codex":
                                unlocked.add(e2.get("entry"))

    for f in man.get("recipes", []):
        rec = load("recipes/" + f)
        for it in (rec.get("result_items") or rec.get("results") or
                   ([rec["result"]] if rec.get("result") else []) or
                   ([rec["output"]] if rec.get("output") else [])):
            if isinstance(it, dict):
                granted.add(it.get("item") or it.get("id"))
    for f in man.get("entities", []):
        d = load("entities/" + f)
        if d.get("type") == "item" and d.get("starts_in_inventory"):
            granted.add(d["id"])

    needed_items = set()

    def scan_conds(items):
        for c in items or []:
            if c.get("type") in ("has_item", "equipped") and c.get("item"):
                needed_items.add(c["item"])
            scan_conds(c.get("conditions"))
            if c.get("condition"):
                scan_conds([c["condition"]])

    for name, conds, effs in groups:
        scan_conds(conds)

    # --------------------------------------------------------------- отчёт
    used = set()
    for name, conds, effs in groups:
        for c in conds or []:
            for k in ("flag",):
                if c.get(k):
                    used.add(c[k])
            for sub in c.get("conditions", []) or []:
                if sub.get("flag"):
                    used.add(sub["flag"])
    never = sorted(f for f in used if f not in known)
    def has_block(conds):
        for c in conds or []:
            if c.get("type") == "flag_not_set":
                return True
            if has_block(c.get("conditions")) or has_block([c.get("condition")]):
                return True
        return False

    dead = [n for n, conds, _ in groups
            if n not in fired and not has_block(conds)]
    alt = [n for n, conds, _ in groups if n not in fired and has_block(conds)]

    print(f"источников эффектов: {len(groups)}, сработало: {len(fired)}")
    print(f"флагов достигнуто: {len(known)} из {len(registry)} в реестре")
    print("\n--- концовки:")
    for e in camp["endings"]:
        need = [c.get("flag") for c in e.get("conditions", []) if c.get("flag")]
        ok = all(f in known for f in need) if need else True
        print(f"   {e['id']:16s} {'достижима' if ok else 'НЕ достижима флагами'} "
              f"{('(' + ', '.join(need) + ')') if need else '(без условий — срабатывает последней)'}")
    print("\n--- флаги, которые проверяют, но никто не поднимает:")
    print("   " + (", ".join(never) if never else "нет"))
    miss_items = sorted(i for i in needed_items if i not in granted)
    codex_ids = set()
    for f in man.get("codex", []):
        doc = load("codex/" + f)
        for e in doc.get("entries", [doc] if "id" in doc else []):
            if e.get("id"):
                codex_ids.add(e["id"])
    miss_codex = sorted(i for i in codex_ids if i not in unlocked)
    placed = set()
    for f in man.get("scenes", []):
        d = load("scenes/" + f)
        for sl in d.get("slots", []):
            if sl.get("default_entity"):
                placed.add(sl["default_entity"])
    homeless = []
    for f in man.get("entities", []):
        d = load("entities/" + f)
        if d.get("type") == "npc" and d["id"] not in placed and not d.get("schedule"):
            # враги приходят из таблиц встреч и из правил — их раскладка не нужна
            if d["id"] in ("npc_rotling", "npc_ashhound", "npc_watchman", "npc_thug",
                           "player_hero"):
                continue
            homeless.append(d["id"])
    print("\n--- персонажи с репликами, которых нет ни в одной сцене:")
    print("   " + (", ".join(homeless) if homeless else "нет"))

    print("\n--- предметы, которые нужны по условиям, но нигде не выдаются:")
    print("   " + (", ".join(miss_items) if miss_items else "нет"))
    print("\n--- записи кодекса, которые никто не открывает:")
    print("   " + (", ".join(miss_codex) if miss_codex else "нет"))
    print("\n--- правила-альтернативы (ждут, что флаг ещё не поднят):")
    print("   " + (", ".join(alt[:10]) if alt else "нет"))
    print("\n--- правила, которые ни разу не сработали:")
    print("   " + (", ".join(dead[:20]) if dead else "нет"))
    if len(dead) > 20:
        print(f"   …и ещё {len(dead) - 20}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
