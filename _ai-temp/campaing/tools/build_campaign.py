# -*- coding: utf-8 -*-
"""Сборка Campaign Package «Шестерни и пепел»: JSON-модули, ink-диалоги,
manifest.json и архив .chronicle."""
import json
import re
import shutil
import sys
import zipfile
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))

import campaign_meta as meta
import campaign_world as world_mod
import campaign_entities as ent
import campaign_story as story
import campaign_dialogues as dlg

ROOT = Path(__file__).resolve().parent.parent
BUILD = ROOT / "campaign_package"
DIST = ROOT / "release"

INK_FUNCS = set()
INK_EXTERNAL_ARITY = {}


def _use(name, arity):
    INK_FUNCS.add(name)
    INK_EXTERNAL_ARITY[name] = max(INK_EXTERNAL_ARITY.get(name, 0), arity)
    return name


TOKEN_RE = re.compile(r"\{([^{}]+)\}")


def token_to_ink(text):
    def repl(m):
        tok = m.group(1)
        if tok in ("имя", "герой"):
            return "{%s()}" % _use("get_player_name", 0)
        if tok == "здоровье":
            return "{%s()}" % _use("get_hp", 0)
        if tok == "здоровье_макс":
            return "{%s()}" % _use("get_hp_max", 0)
        if tok == "день":
            return "{%s()}" % _use("get_run_day", 0)
        if ":" in tok:
            kind, key = tok.split(":", 1)
            kind = kind.strip()
            key = key.strip()
            if kind == "счёт":
                return '{%s("%s")}' % (_use("item_count", 1), key)
            if kind == "валюта":
                return '{%s("%s")}' % (_use("get_currency", 1), key)
            if kind == "навык":
                return '{%s("%s")}' % (_use("get_skill", 1), key)
            if kind == "стат":
                return '{%s("%s")}' % (_use("get_stat", 1), key)
            if kind == "потребность":
                return '{%s("%s")}' % (_use("get_need", 1), key)
        return m.group(0)
    return TOKEN_RE.sub(repl, text)


def cond_to_ink(c):
    t = c.get("type")
    neg = c.get("not", False)
    if t == "flag":
        _use("get_flag", 1)
        expr = 'get_flag("%s")' % c["flag"]
    elif t == "has_item":
        _use("has_item", 1)
        expr = 'has_item("%s")' % c["item"]
    elif t == "item_ge":
        _use("item_count", 1)
        expr = 'item_count("%s") >= %d' % (c["item"], c.get("count", 0))
    elif t == "disp_ge":
        _use("get_disposition", 1)
        expr = 'get_disposition("%s") >= %d' % (c["target"], c.get("value", 0))
    elif t == "quest":
        _use("quest_stage", 1)
        if c.get("stage"):
            expr = 'quest_stage("%s") == "%s"' % (c["quest"], c["stage"])
        else:
            expr = 'quest_stage("%s") != ""' % c["quest"]
    elif t == "in_party":
        _use("in_party", 1)
        expr = 'in_party("%s")' % c["npc"]
    elif t == "hp_ge":
        _use("get_hp", 0)
        expr = 'get_hp() >= %d' % c.get("value", 0)
    elif t == "has_status":
        _use("has_status", 1)
        expr = 'has_status("%s")' % c["status"]
    elif t == "weather_is":
        _use("weather_is", 1)
        expr = 'weather_is("%s")' % c.get("weather", "")
    else:
        return "true"
    return "not (%s)" % expr if neg else expr


def effect_to_ink(e):
    t = e.get("type")
    if t == "set_flag":
        _use("set_flag", 1)
        return '~ set_flag("%s")' % e["flag"]
    if t == "add_item":
        _use("add_item", 2)
        return '~ add_item("%s", %d)' % (e["item"], e.get("qty", 1))
    if t == "remove_item":
        _use("remove_item", 2)
        return '~ remove_item("%s", %d)' % (e["item"], e.get("qty", 1))
    if t == "fire_rule":
        _use("fire_rule", 1)
        return '~ fire_rule("%s")' % e["rule"]
    if t == "start_quest":
        _use("start_quest", 1)
        return '~ start_quest("%s")' % e["quest"]
    if t == "change_disposition":
        _use("change_disposition", 2)
        return '~ change_disposition("%s", %d)' % (e["target"], e.get("delta", 0))
    if t == "apply_status":
        _use("apply_status", 2)
        return '~ apply_status("%s", %d)' % (e["status"], e.get("duration", 0))
    if t == "remove_status":
        _use("remove_status", 1)
        return '~ remove_status("%s")' % e["status"]
    if t == "set_weather":
        _use("set_weather", 1)
        return '~ set_weather("%s")' % e.get("weather", "")
    if t == "unlock_codex":
        _use("unlock_codex", 1)
        return '~ unlock_codex("%s")' % e["entry"]
    if t == "unlock_recipe":
        _use("unlock_recipe", 1)
        return '~ unlock_recipe("%s")' % e["recipe"]
    if t == "join_party":
        _use("join_party", 1)
        return '~ join_party("%s")' % e["npc"]
    if t == "sleep":
        _use("sleep", 1)
        return '~ sleep(%d)' % e.get("ticks", 8)
    if t == "set_description":
        _use("set_description", 2)
        return '~ set_description("%s", "%s")' % (e["entity"], _ink_escape(e["text"]))
    raise ValueError("эффект диалога не поддержан генератором ink: %s" % t)


def _ink_escape(text):
    return text.replace('"', "'").replace("\n", " ")


def steps_to_ink(steps, indent=0):
    pad = "    " * indent
    out = []
    for st in steps:
        if st.get("kind") == "line":
            ln = st["line"]
            out.append(pad + token_to_ink(ln["text"]))
        elif st.get("kind") == "effect":
            out.append(pad + effect_to_ink(st["effect"]))
    return out


def section_to_ink(sec, indent=0):
    pad = "    " * indent
    conds = sec.get("conds") or []
    if not conds:
        return steps_to_ink(sec.get("steps", []), indent)
    expr = " and ".join(cond_to_ink(c) for c in conds)
    for c in conds:
        cond_to_ink(c)
    out = [pad + "{ %s:" % expr]
    out += steps_to_ink(sec.get("steps", []), indent + 1) or [pad + "    "]
    if sec.get("else_steps"):
        out.append(pad + "- else:")
        out += steps_to_ink(sec.get("else_steps", []), indent + 1)
    out.append(pad + "}")
    return out


def dialogue_to_ink(name, doc):
    """DlgDoc → ink. Каждый узел получает хаб вариантов <node>_hub."""
    global INK_FUNCS, INK_EXTERNAL_ARITY
    saved_funcs, saved_arity = set(INK_FUNCS), dict(INK_EXTERNAL_ARITY)
    INK_FUNCS, INK_EXTERNAL_ARITY = set(), {}

    body = []
    for i, n in enumerate(doc["nodes"]):
        nid = n["id"]
        body.append("=== %s ===" % nid)
        for sec in n.get("sections", []):
            body += section_to_ink(sec)
        choices = n.get("choices") or []
        if choices:
            body.append("-> %s_hub" % nid)
            body.append("")
            body.append("=== %s_hub ===" % nid)
            for c in choices:
                marker = "*" if c.get("once") else "+"
                head = "%s [%s]" % (marker, c["text"])
                conds = c.get("conds") or []
                if conds:
                    head += " { %s }" % " and ".join(cond_to_ink(x) for x in conds)
                body.append(head)
                for sec in c.get("sections", []):
                    body += section_to_ink(sec, 1) or []
                goto = c.get("goto", "")
                if goto == "end":
                    body.append("    -> DONE")
                elif goto == "stay" or goto == "":
                    body.append("    -> %s_hub" % nid)
                else:
                    body.append("    -> %s" % goto)
                body.append("")
            body.append("- -> %s_hub" % nid)
        else:
            goto = n.get("goto", "end")
            body.append("-> DONE" if goto == "end" else "-> %s" % goto)
        body.append("")

    externals = []
    for fn in sorted(INK_FUNCS):
        arity = INK_EXTERNAL_ARITY[fn]
        args = ", ".join("a%d" % i for i in range(arity))
        externals.append("EXTERNAL %s(%s)" % (fn, args))

    ink = "\n".join(externals) + "\n\n" + "\n".join(body)
    ink = re.sub(r"\n{3,}", "\n\n", ink).strip() + "\n"
    INK_FUNCS, INK_EXTERNAL_ARITY = saved_funcs, saved_arity
    return ink


# --- сборка пакета ----------------------------------------------------------
def write_json(path: Path, data):
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(data, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")


def build():
    """Собирает модули заново, НЕ трогая уже сгенерированные медиа."""
    BUILD.mkdir(parents=True, exist_ok=True)
    for folder in ("scenes", "entities", "rules", "quests", "arenas", "cutscenes",
                   "recipes", "codex", "dialogues"):
        d = BUILD / folder
        if d.exists():
            shutil.rmtree(d)
    for f in ("campaign.json", "world.json", "manifest.json"):
        p = BUILD / f
        if p.exists():
            p.unlink()

    manifest = {"scenes": [], "entities": [], "rules": [], "dialogues": [],
                "arenas": [], "quests": [], "encounters": [], "cutscenes": [],
                "recipes": [], "codex": []}

    write_json(BUILD / "campaign.json", meta.campaign())
    write_json(BUILD / "world.json", world_mod.world())

    for sid, scene in world_mod.SCENES.items():
        write_json(BUILD / "scenes" / ("%s.json" % sid), scene)
        manifest["scenes"].append("%s.json" % sid)

    entities = list(ent.NPCS) + list(ent.ITEMS)
    seen = set()
    for e in entities:
        assert e["id"] not in seen, "дубль id: %s" % e["id"]
        seen.add(e["id"])
        write_json(BUILD / "entities" / ("%s.json" % e["id"]), e)
        manifest["entities"].append("%s.json" % e["id"])

    for r in story.ALL_RULES():
        write_json(BUILD / "rules" / ("%s.json" % r["id"]), r)
        manifest["rules"].append("%s.json" % r["id"])

    for t in story.ENCOUNTER_TABLES:
        # один файл — одна таблица, файл-обёртка живёт в rules/, но
        # перечисляется ТОЛЬКО в manifest.encounters
        write_json(BUILD / "rules" / ("%s.json" % t["id"]), {"encounter_tables": [t]})
        manifest["encounters"].append("%s.json" % t["id"])

    for q in story.QUESTS:
        write_json(BUILD / "quests" / ("%s.json" % q["id"]), q)
        manifest["quests"].append("%s.json" % q["id"])

    for a in story.ARENAS:
        write_json(BUILD / "arenas" / ("%s.json" % a["id"]), a)
        manifest["arenas"].append("%s.json" % a["id"])

    for c in story.CUTSCENES:
        write_json(BUILD / "cutscenes" / ("%s.json" % c["id"]), c)
        manifest["cutscenes"].append("%s.json" % c["id"])

    for r in story.RECIPES:
        write_json(BUILD / "recipes" / ("%s.json" % r["id"]), r)
        manifest["recipes"].append("%s.json" % r["id"])

    for c in story.CODEX:
        write_json(BUILD / "codex" / ("%s.json" % c["id"]), c)
        manifest["codex"].append("%s.json" % c["id"])

    for name, doc in dlg.DIALOGUES.items():
        ink = dialogue_to_ink(name, doc)
        (BUILD / "dialogues").mkdir(exist_ok=True)
        (BUILD / "dialogues" / ("%s.ink" % name)).write_text(ink, encoding="utf-8")
        write_json(BUILD / "dialogues" / ("%s.dlg.json" % name), doc)
        manifest["dialogues"].append("%s.ink" % name)

    # генераторы событий лежат в самом campaign.json, но генераторы — отдельный
    # задел: дописываем их в campaign (схема допускает), если ещё не заданы
    cj = json.loads((BUILD / "campaign.json").read_text(encoding="utf-8"))
    cj["generators"] = story.GENERATORS
    write_json(BUILD / "campaign.json", cj)

    write_json(BUILD / "manifest.json", manifest)
    print("Модулей: сцены %d, сущности %d, правила %d, встречи %d, диалоги %d" % (
        len(manifest["scenes"]), len(manifest["entities"]), len(manifest["rules"]),
        len(manifest["encounters"]), len(manifest["dialogues"])))
    return BUILD


def package_archive():
    DIST.mkdir(exist_ok=True)
    out = DIST / "shesterni-i-pepel.chronicle"
    if out.exists():
        out.unlink()
    with zipfile.ZipFile(out, "w", zipfile.ZIP_DEFLATED) as z:
        for p in sorted(BUILD.rglob("*")):
            if p.is_file():
                z.write(p, p.relative_to(BUILD).as_posix())
    print("Архив: %s (%.2f МБ)" % (out, out.stat().st_size / 1048576))
    return out


# --- медиа: обрезка отсутствующих ссылок и запасные ArtDoc -------------------
OPTIONAL_IMAGE_KEYS = {"image", "scene_sprite", "combat_figure", "token", "icon",
                       "map_image", "title_art", "background", "frame_image", "video",
                       "portrait", "voice", "hero_appearance"}


def _fallback_art(scene_id, state_id):
    """Запасной фон сцены примитивами (пока нет картинки): индустриальная
    палитра, стены, пол, трубы и пятно света."""
    h = abs(hash(scene_id + state_id))
    night = "night" in state_id or "fume" in state_id
    wall_top = "#1d1813" if not night else "#12100e"
    wall_bottom = "#2b231b" if not night else "#1a1512"
    accent = ["#c8873a", "#a8642c", "#8f5a2a", "#b9863f"][h % 4]
    layers = [
        {"label": "стена", "shape": {"type": "rect", "x": 0, "y": 0, "w": 1280, "h": 720, "fill": {
            "gradient": {"from": wall_top, "to": wall_bottom, "angle": 90}}}},
        {"label": "пол", "shape": {"type": "rect", "x": 0, "y": 520, "w": 1280, "h": 200,
                                   "fill": "#171310", "stroke": "#3a2d20", "stroke_width": 3}},
        {"label": "свет", "shape": {"type": "ellipse", "cx": 640 + (h % 200) - 100, "cy": 200,
                                    "rx": 320, "ry": 150, "fill": accent, "opacity": 0.10}},
        {"label": "труба", "shape": {"type": "rect", "x": 120, "y": 0, "w": 46, "h": 520,
                                     "fill": "#241d18", "stroke": "#4a3a28", "stroke_width": 3}},
        {"label": "труба 2", "shape": {"type": "rect", "x": 1130, "y": 0, "w": 56, "h": 520,
                                       "fill": "#221b16", "stroke": "#4a3a28", "stroke_width": 3}},
        {"label": "балка", "shape": {"type": "rect", "x": 0, "y": 120, "w": 1280, "h": 30,
                                     "fill": "#2a221a", "stroke": "#3f3226", "stroke_width": 2}},
        {"label": "клёпки", "shape": {"type": "line", "x1": 146, "y1": 60, "x2": 146, "y2": 500,
                                      "color": "#c8873a", "width": 2, "opacity": 0.35}},
        {"label": "пятно", "shape": {"type": "ellipse", "cx": 560, "cy": 600, "rx": 260, "ry": 60,
                                     "fill": "#0d0b09", "opacity": 0.5}},
    ]
    if night:
        layers.append({"label": "тьма", "shape": {"type": "rect", "x": 0, "y": 0, "w": 1280, "h": 720,
                                                  "fill": "#0b0908", "opacity": 0.45}})
    return {"canvas": {"w": 1280, "h": 720}, "background": wall_top, "layers": layers}


def prune_media(build_dir: Path):
    """Убирает ссылки на несуществующие файлы и подставляет запасной фон сцен."""
    def exists(rel):
        return bool(rel) and (build_dir / rel).exists()

    def walk(node, context=None):
        if isinstance(node, dict):
            for k in list(node.keys()):
                v = node[k]
                if isinstance(v, str) and v.startswith("assets/"):
                    if not exists(v):
                        if k == "map_image":
                            node[k] = ""
                        else:
                            node.pop(k)
                elif isinstance(v, dict):
                    if k == "portrait":
                        for ik in list(v.keys()):
                            if isinstance(v[ik], str) and v[ik].startswith("assets/") and not exists(v[ik]):
                                v[ik] = ""
                        if not v:
                            v["neutral"] = ""
                    else:
                        walk(v, k)
                elif isinstance(v, list):
                    for item in v:
                        walk(item, k)
        elif isinstance(node, list):
            for item in node:
                walk(item, context)

    for rel in ["campaign.json", "world.json"]:
        p = build_dir / rel
        data = json.loads(p.read_text(encoding="utf-8"))
        walk(data)
        write_json(p, data)

    for folder in ["scenes", "entities", "rules", "quests", "arenas", "cutscenes",
                   "recipes", "codex", "dialogues"]:
        for p in sorted((build_dir / folder).glob("*.json")):
            data = json.loads(p.read_text(encoding="utf-8"))
            walk(data)
            if folder == "scenes":
                for st in data.get("states", []):
                    if not st.get("image") and not st.get("art"):
                        st["art"] = _fallback_art(data["id"], st["id"])
            write_json(p, data)

    manifest = json.loads((build_dir / "manifest.json").read_text(encoding="utf-8"))
    return manifest


if __name__ == "__main__":
    build()


if __name__ == "__main__":
    pkg = build()
    prune_media(pkg)
    package_archive()
