"""Проверка собранного пакета: схема, ссылки, бюджет героя, ink, медиа."""

import json
import os
import re
import sys

import jsonschema_mini as jsm

PNG_TRANSPARENT_ROLES = (
    "theme.menu.title_art", "scene_sprite", "combat_figure", "combat_figure_states",
    "portrait", "frame", "codex.image(item)", "hero_portrait",
)


def png_has_alpha(path):
    try:
        with open(path, "rb") as f:
            head = f.read(33)
        if head[:8] != b"\x89PNG\r\n\x1a\n":
            return False
        color_type = head[25]
        return color_type in (4, 6) or b"tRNS" in open(path, "rb").read(2000)
    except OSError:
        return False


class Report:
    def __init__(self):
        self.problems = []
        self.info = []

    def bad(self, msg):
        self.problems.append(msg)

    def note(self, msg):
        self.info.append(msg)


def load(pkg, rel):
    with open(os.path.join(pkg, rel), encoding="utf-8") as f:
        return json.load(f)


def iter_effects(node):
    """Обход всех эффектов во всех структурах."""
    if isinstance(node, dict):
        if "type" in node and isinstance(node.get("type"), str) and (
                "effects" in node or node.get("type") in (
                "set_flag", "clear_flag", "apply_status", "remove_status", "set_weather",
                "unlock_codex", "unlock_recipe", "open_craft", "set_entity_state",
                "set_variable", "change_variable", "start_dialogue", "start_combat",
                "teleport_player", "change_scene_state", "add_item", "remove_item",
                "change_need", "change_hp", "change_skill", "skill_check_gate",
                "change_disposition", "start_quest", "advance_quest", "fail_quest",
                "journal_update", "give_reward", "stat_check", "opposed_check",
                "group_stat_check", "change_luck", "change_fatigue", "change_sanity",
                "change_reputation", "change_wealth", "change_passion",
                "change_allegiance", "train_stat", "hazard_fall", "start_pursuit",
                "stop_pursuit", "fire_rule", "commit_crime", "set_price_event",
                "clear_price_event", "banner", "postcard", "grant_xp", "meta_currency",
                "roll_event_table", "generate_variables", "grant_feat", "join_party",
                "leave_party", "block_path", "unblock_path", "show_message",
                "reveal_location", "advance_time", "remove_entity", "spawn_entity",
                "set_description", "game_over_victory", "game_over_death",
                "play_cutscene")):
            yield node
        for key in ("effects", "success_effects", "fail_effects", "on_victory",
                    "on_defeat", "on_fled", "on_enter_effects", "on_apply",
                    "on_expire", "grants"):
            if key in node:
                yield from iter_effects(node[key])
        for key in ("conditions", "requires", "interactable_when", "decay_when",
                    "restore_when"):
            if key in node and isinstance(node[key], list):
                for c in node[key]:
                    yield from iter_effects(c)
        for key in ("transitions",):
            if key in node:
                yield from iter_effects(node[key])
        for key in ("stages", "entries", "slides", "items", "inputs"):
            if key in node:
                yield from iter_effects(node[key])
        for key in ("interact_options", "on_interact", "on_use", "use_with"):
            if key in node:
                yield from iter_effects(node[key])
    elif isinstance(node, list):
        for x in node:
            yield from iter_effects(x)


def collect_conditions(node, out):
    if isinstance(node, dict):
        t = node.get("type")
        if isinstance(t, str):
            out.append(node)
        for k, v in node.items():
            if k in ("conditions", "conditions_any", "requires", "requirements"):
                collect_conditions(v, out)
            elif k in ("condition", "not"):
                collect_conditions(v, out)
    elif isinstance(node, list):
        for x in node:
            collect_conditions(x, out)


def check_ink(path, rep):
    with open(path, encoding="utf-8") as f:
        src = f.read()
    name = os.path.basename(path)
    externals = set(re.findall(r"^EXTERNAL\s+(\w+)\(", src, re.M))
    body = "\n".join(l for l in src.splitlines() if not l.strip().startswith("EXTERNAL"))
    called = set(re.findall(r"~\s*(\w+)\(", body))
    called |= set(re.findall(r"(?<![\w.])(get_flag|get_stat|get_hp|get_skill|get_need|"
                             r"get_currency|get_disposition|quest_stage|has_item|"
                             r"item_count|has_status|has_meta_achievement|"
                             r"get_meta_counter|skill_check|in_party|weather_is)\s*\(",
                             body))
    for fn in sorted(called - externals):
        rep.bad(f"ink {name}: функция {fn} используется, но не объявлена EXTERNAL")
    for fn in sorted(externals - called):
        rep.note(f"ink {name}: EXTERNAL {fn} объявлен, но не используется")
    knots = set(re.findall(r"^===\s*([\wА-Яа-яЁё]+)\s*===\s*$", src, re.M))
    if "main" not in knots:
        rep.bad(f"ink {name}: нет стартового узла main")
    for target in set(re.findall(r"->\s*([A-Za-z_][\w]*)\s*$", src, re.M)):
        if target in ("END", "DONE"):
            continue
        if target not in knots:
            rep.bad(f"ink {name}: переход -> {target} на несуществующий узел")
    # запрещённые конструкции
    for m in re.finditer(r"^[ \t]*[*+][ \t]*\[[^\]]*\][ \t]*\{", src, re.M):
        rep.bad(f"ink {name}: условие выбора ПОСЛЕ скобок — часть сборок печатает его отдельной строкой")
    for m in re.finditer(r"\{\s*[^}\n]*:\s*$", src, re.M):
        rep.bad(f"ink {name}: многострочный условный блок — писать в одну строку")
    # счетчик скобок
    if src.count("{") != src.count("}"):
        rep.bad(f"ink {name}: не закрыта фигурная скобка")


def validate(pkg, schema_path, verbose=True):
    schema = json.load(open(schema_path, encoding="utf-8"))
    rep = Report()
    manifest = load(pkg, "manifest.json")
    problems = jsm.validate_doc(manifest, schema["$defs"]["CampaignManifest"], schema)
    for p in problems:
        rep.bad(f"manifest.json: {p}")

    # ---- модули по схеме
    def check_dir(files, defname, where):
        for fn in files:
            doc = load(pkg, f"{where}/{fn}")
            for p in jsm.validate_doc(doc, schema["$defs"][defname], schema):
                rep.bad(f"{where}/{fn}: {p}")

    check_dir(manifest["scenes"], "SceneDef", "scenes")
    check_dir(manifest["entities"], "EntityDef", "entities")
    check_dir(manifest["rules"], "RuleDef", "rules")
    check_dir(manifest.get("arenas", []), "ArenaDef", "arenas")
    check_dir(manifest.get("quests", []), "QuestDef", "quests")
    check_dir(manifest.get("cutscenes", []), "CutsceneDef", "cutscenes")
    check_dir(manifest.get("recipes", []), "RecipeDef", "recipes")
    check_dir(manifest.get("codex", []), "CodexEntryDef", "codex")
    for fn in manifest.get("encounters", []):
        doc = load(pkg, f"rules/{fn}")
        for p in jsm.validate_doc(doc, schema["$defs"]["EncounterFileDef"], schema):
            rep.bad(f"rules/{fn}: {p}")
        if fn in manifest["rules"]:
            rep.bad(f"rules/{fn}: файл встреч попал в manifest.rules — сломает старт забега")
    for p in jsm.validate_doc(load(pkg, "world.json"), schema["$defs"]["WorldDef"], schema):
        rep.bad(f"world.json: {p}")
    campaign = load(pkg, "campaign.json")
    for p in jsm.validate_doc(campaign, schema["$defs"]["CampaignMeta"], schema):
        rep.bad(f"campaign.json: {p}")

    # ---- сборка данных
    scenes = {fn[:-5]: load(pkg, f"scenes/{fn}") for fn in manifest["scenes"]}
    entities = {fn[:-5]: load(pkg, f"entities/{fn}") for fn in manifest["entities"]}
    rules = {fn[:-5]: load(pkg, f"rules/{fn}") for fn in manifest["rules"]}
    quests = {fn[:-5]: load(pkg, f"quests/{fn}") for fn in manifest.get("quests", [])}
    arenas = {fn[:-5]: load(pkg, f"arenas/{fn}") for fn in manifest.get("arenas", [])}
    cuts = {fn[:-5]: load(pkg, f"cutscenes/{fn}") for fn in manifest.get("cutscenes", [])}
    recipes = {fn[:-5]: load(pkg, f"recipes/{fn}") for fn in manifest.get("recipes", [])}
    codex = {fn[:-5]: load(pkg, f"codex/{fn}") for fn in manifest.get("codex", [])}
    enc_tables = {}
    for fn in manifest.get("encounters", []):
        for t in load(pkg, f"rules/{fn}")["encounter_tables"]:
            enc_tables[t["id"]] = t
    world = load(pkg, "world.json")

    locations = {}
    for reg in world["regions"]:
        for loc in reg["locations"]:
            locations[loc["id"]] = loc

    # ---- монолит по схеме
    monolith = {
        "campaign": campaign, "world": world, "scenes": scenes, "entities": entities,
        "rules": rules, "quests": quests, "arenas": arenas, "cutscenes": cuts,
        "dialogues": {os.path.basename(p)[:-4]: {"ink": open(os.path.join(pkg, "dialogues", p),
                                                             encoding="utf-8").read()}
                      for p in manifest["dialogues"]},
    }
    if recipes:
        monolith["recipes"] = recipes
    if codex:
        monolith["codex"] = codex
    if enc_tables:
        monolith["encounters"] = enc_tables
    for p in jsm.validate_doc(monolith, schema["$defs"]["MonolithDoc"], schema):
        rep.bad(f"монолит: {p}")

    # ---- реестры
    skill_ids = {s["id"] for s in campaign.get("skills", [])}
    flag_reg = {f["id"]: f for f in campaign.get("flags", [])}
    for fid, f in flag_reg.items():
        if not f.get("description"):
            rep.bad(f"флаг {fid}: пустое поле description (аудит помечает предупреждением)")
    need_ids = {n["id"] for n in campaign["needs"]}
    status_ids = {s["id"] for s in campaign.get("statuses", [])}
    item_ids = {i["id"] for i in campaign.get("item_categories", [])}
    faction_ids = {f["id"] for f in campaign.get("factions", [])}
    slot_type_ids = {s["id"] for s in campaign.get("slot_types", [])}
    equip_slots = {s["id"] for s in campaign.get("equipment_slots", [])}
    emotion_ids = {e["id"] for e in campaign.get("emotions", [])}
    music_ids = {m["id"] for m in campaign.get("music_tracks", [])}
    sound_ids = {s["id"] for s in campaign.get("sounds", [])}
    weather_ids = {w["id"] for w in campaign.get("weathers", [])}
    codex_cat = {c["id"] for c in campaign.get("codex_categories", [])} | {
        "creatures", "places", "chronicles"}
    price_events = {p["id"] for p in campaign.get("price_events", [])}
    crime_ids = {c["id"] for c in campaign.get("crimes", [])}
    ability_ids = {a["id"] for a in campaign.get("abilities", [])}
    feat_ids = {f["id"] for f in campaign.get("progression", {}).get("feats", [])}

    used_flags = set()

    def reg_flag(fid, where):
        if fid:
            used_flags.add(fid)

    # ---- ссылки кампании
    if campaign["default_player"] not in entities:
        rep.bad(f"default_player {campaign['default_player']} не найден среди сущностей")
    if campaign["starting_region"] not in {r["id"] for r in world["regions"]}:
        rep.bad("starting_region не существует")
    if campaign["starting_location"] not in locations:
        rep.bad("starting_location не существует")
    else:
        loc = locations[campaign["starting_location"]]
        if campaign["starting_scene"] not in loc["scenes"]:
            rep.bad("starting_scene не принадлежит стартовой локации")
        if campaign["starting_scene"] not in scenes:
            rep.bad("starting_scene не существует")
        elif scenes[campaign["starting_scene"]]["location"] != campaign["starting_location"]:
            rep.bad("starting_scene привязана к другой локации")
    for n in campaign["needs"]:
        if n.get("on_zero_effect") and n["on_zero_effect"] not in rules:
            rep.bad(f"потребность {n['id']}: правило {n['on_zero_effect']} не существует")
        for c in (n.get("decay_when") or []) + (n.get("restore_when") or []):
            if c["type"] == "in_location":
                for lid in c["locations"]:
                    if lid not in locations:
                        rep.bad(f"потребность {n['id']}: локация {lid} не существует")
            if c["type"] in ("has_item", "equipped"):
                for iid in c["items"]:
                    if iid not in entities:
                        rep.bad(f"потребность {n['id']}: предмет {iid} не существует")
            if c["type"] == "weather" and c["weather"] not in weather_ids:
                rep.bad(f"потребность {n['id']}: погода {c['weather']} не в реестре")
        if len(n["label"]) > 18:
            rep.note(f"потребность {n['id']}: длинная подпись «{n['label']}» для HUD")
    for s in campaign.get("statuses", []):
        for m in s.get("skill_mods", []):
            if m["skill"] not in skill_ids:
                rep.bad(f"статус {s['id']}: навык {m['skill']} не в реестре")
    for a in campaign.get("abilities", []):
        if a.get("skill") and a["skill"] not in skill_ids:
            rep.bad(f"способность {a['id']}: навык {a['skill']} не в реестре")
    for e in campaign.get("endings", []):
        for c in e.get("conditions", []):
            if c.get("flag"):
                reg_flag(c["flag"], "концовка")
            if c["type"] == "flag_set" and c["flag"] not in flag_reg:
                rep.note(f"концовка {e['id']}: флаг {c['flag']} вне реестра")
        if e.get("image") and not os.path.exists(os.path.join(pkg, e["image"])):
            rep.bad(f"концовка {e['id']}: нет файла {e['image']}")
    for hook, sid in (campaign.get("ui_sounds") or {}).items():
        if sid and sid not in sound_ids and sid not in music_ids:
            rep.bad(f"ui_sounds.{hook}: звук {sid} не в реестре")
    for tid in campaign.get("default_music", []) + campaign.get("combat_music", []):
        if tid not in music_ids:
            rep.bad(f"музыка {tid} не в реестре треков")
    theme = campaign.get("theme") or {}
    menu = theme.get("menu") or {}
    if not menu.get("background"):
        rep.note("тема: не задан фон главного меню")
    else:
        if not os.path.exists(os.path.join(pkg, menu["background"])):
            rep.bad(f"тема: нет файла фона меню {menu['background']}")
        if menu.get("title_art"):
            if menu["title_art"] == menu["background"]:
                rep.bad("тема: title_art совпадает с фоном меню")
            p = os.path.join(pkg, menu["title_art"])
            if not os.path.exists(p):
                rep.bad(f"тема: нет файла {menu['title_art']}")
            elif not png_has_alpha(p):
                rep.bad(f"тема: title_art {menu['title_art']} без прозрачности (будет чёрным квадратом)")
    if theme.get("end", {}).get("background") and not os.path.exists(
            os.path.join(pkg, theme["end"]["background"])):
        rep.bad("тема: нет файла фона финала")
    for p in campaign.get("portraits", []) if False else []:
        pass
    for prt in (campaign.get("char_creation") or {}).get("portraits", []):
        p = os.path.join(pkg, prt["image"])
        if not os.path.exists(p):
            rep.bad(f"портрет героя {prt['id']}: нет файла {prt['image']}")
        elif not png_has_alpha(p):
            rep.bad(f"портрет героя {prt['id']}: без прозрачного фона")

    # ---- мир
    for lid, loc in locations.items():
        for s in loc["scenes"]:
            if s not in scenes:
                rep.bad(f"локация {lid}: сцена {s} не существует")
            elif scenes[s]["location"] != lid:
                rep.bad(f"сцена {s}: поле location не совпадает с локацией {lid}")
        if loc.get("arrival_scene") and loc["arrival_scene"] not in loc["scenes"]:
            rep.bad(f"локация {lid}: arrival_scene не в списке сцен")
        for c in loc.get("travel_connections", []):
            if c["to"] not in locations:
                rep.bad(f"локация {lid}: переход в несуществующую локацию {c['to']}")
            if c.get("random_encounter_table") and c["random_encounter_table"] not in enc_tables:
                rep.bad(f"локация {lid}: таблица встреч {c['random_encounter_table']} не найдена")
        for m in (loc.get("music") or []) if isinstance(loc.get("music"), list) else []:
            for t in m["tracks"]:
                if t not in music_ids:
                    rep.bad(f"локация {lid}: трек {t} не в реестре")
        for a in loc.get("ambient", []) + ([loc["ambient_audio"]] if loc.get("ambient_audio") else []):
            if a not in sound_ids:
                rep.bad(f"локация {lid}: звук {a} не в реестре")
        if loc.get("arena") and loc["arena"] not in arenas:
            rep.bad(f"локация {lid}: арена {loc['arena']} не найдена")

    # из каждой локации должен быть выход на карту игрока
    for lid, loc in locations.items():
        outs = []
        for sid in loc["scenes"]:
            sc = scenes.get(sid)
            if not sc:
                continue
            outs += [nz for nz in sc["navigation"] if nz.get("open_map")]
            for sl in sc["slots"]:
                for opt in sl.get("interact_options", []):
                    for e in iter_effects(opt.get("effects", [])):
                        if e["type"] == "teleport_player":
                            outs.append(e)
        if not outs:
            rep.bad(f"локация {lid}: нет выхода на карту игрока (open_map/teleport_player)")

    # ---- сцены
    for sid, sc in scenes.items():
        if not sc["states"]:
            rep.bad(f"сцена {sid}: нет состояний")
        for stt in sc["states"]:
            if not stt.get("art") and not stt.get("image"):
                rep.bad(f"сцена {sid}/{stt['id']}: ни art, ни image")
            if stt.get("image") and not os.path.exists(os.path.join(pkg, stt["image"])):
                rep.bad(f"сцена {sid}: нет файла {stt['image']}")
        for sl in sc["slots"]:
            for t in sl["type"]:
                if t not in slot_type_ids:
                    rep.bad(f"сцена {sid}/{sl['id']}: тип слота {t} не в реестре")
            ent = sl.get("default_entity")
            if ent and ent not in entities:
                rep.bad(f"сцена {sid}/{sl['id']}: сущность {ent} не найдена")
            if ent and entities[ent]["type"] == "npc" and not entities[ent].get("schedule") \
                    and sc["id"] not in {s.get("scene") for s in entities[ent].get("schedule", [])}:
                pass
            for uw in sl.get("use_with", []):
                if uw["item"] not in entities:
                    rep.bad(f"сцена {sid}/{sl['id']}: предмет {uw['item']} не найден")
                for e in uw.get("effects", []):
                    for x in iter_effects([e]):
                        pass
        for nz in sc["navigation"]:
            if nz.get("go_to_scene"):
                tgt = nz["go_to_scene"]
                if tgt not in scenes:
                    rep.bad(f"сцена {sid}: переход в несуществующую сцену {tgt}")
                elif scenes[tgt]["location"] != sc["location"]:
                    rep.bad(f"сцена {sid}: переход {tgt} ведёт в другую локацию")
            elif not nz.get("open_map"):
                rep.bad(f"сцена {sid}: зона «{nz.get('label')}» без перехода")
        for m in sc.get("music", []):
            for t in m["tracks"]:
                if t not in music_ids:
                    rep.bad(f"сцена {sid}: трек {t} не в реестре")
        for a in sc.get("ambient", []):
            if a not in sound_ids:
                rep.bad(f"сцена {sid}: звук {a} не в реестре")

    # НПС со слотами должны стоять в сцене
    for eid, ent in entities.items():
        if ent["type"] != "npc":
            continue
        if ent.get("schedule"):
            for s in ent["schedule"]:
                if s["scene"] not in scenes:
                    rep.bad(f"{eid}: расписание на несуществующую сцену {s['scene']}")
                else:
                    tgt = scenes[s["scene"]]
                    slots = {x["id"] for x in tgt["slots"]}
                    if s["slot"] not in slots:
                        rep.bad(f"{eid}: в сцене {s['scene']} нет слота {s['slot']}")
        for ov in ent.get("presence_overrides", []):
            if ov["scene"] not in scenes:
                rep.bad(f"{eid}: presence_override на несуществующую сцену {ov['scene']}")
        if ent.get("dialogue"):
            dlg = ent["dialogue"]
            if not dlg.startswith("dialogues/"):
                rep.bad(f"{eid}: путь диалога должен быть dialogues/<файл>.ink")
            elif not os.path.exists(os.path.join(pkg, dlg)):
                rep.bad(f"{eid}: нет файла диалога {dlg}")
        for key, val in (ent.get("portrait") or {}).items():
            if key not in emotion_ids:
                rep.bad(f"{eid}: состояние портрета {key} не в реестре эмоций")
            if val and not os.path.exists(os.path.join(pkg, val)):
                rep.bad(f"{eid}: нет файла портрета {val}")
            elif val and not png_has_alpha(os.path.join(pkg, val)):
                rep.note(f"{eid}: портрет {os.path.basename(val)} без прозрачного фона")
        for key in ("scene_sprite", "combat_figure"):
            val = ent.get(key)
            if isinstance(val, str) and val:
                p = os.path.join(pkg, val)
                if not os.path.exists(p):
                    rep.bad(f"{eid}: нет файла {val}")
                elif not png_has_alpha(p):
                    rep.bad(f"{eid}: {key} {os.path.basename(val)} без прозрачного фона")
            if isinstance(val, dict):
                for fr in val.get("frames", []):
                    p = os.path.join(pkg, fr)
                    if not os.path.exists(p):
                        rep.bad(f"{eid}: нет файла {fr}")
                    elif not png_has_alpha(p):
                        rep.bad(f"{eid}: кадр {os.path.basename(fr)} без прозрачного фона")
        for key, val in (ent.get("combat_figure_states") or {}).items():
            if isinstance(val, str) and val:
                p = os.path.join(pkg, val)
                if os.path.exists(p) and not png_has_alpha(p):
                    rep.bad(f"{eid}: состояние фигурки {key} без прозрачного фона")
        for sk in ent.get("skills", {}):
            if sk not in skill_ids:
                rep.bad(f"{eid}: навык {sk} не в реестре")
        for slot, iid in (ent.get("equipment") or {}).items():
            if slot not in equip_slots:
                rep.bad(f"{eid}: слот экипировки {slot} не в реестре")
            if iid not in entities:
                rep.bad(f"{eid}: предмет экипировки {iid} не найден")
        for inv in ent.get("inventory", []):
            if inv["item"] not in entities:
                rep.bad(f"{eid}: предмет инвентаря {inv['item']} не найден")
        for lt in ent.get("loot_table", []):
            if lt["item"] not in entities:
                rep.bad(f"{eid}: лут {lt['item']} не найден")
        for ab in ent.get("abilities", []):
            if ab not in ability_ids:
                rep.bad(f"{eid}: способность {ab} не в реестре")
        if ent.get("faction") and ent["faction"] not in faction_ids:
            rep.bad(f"{eid}: фракция {ent['faction']} не в реестре")
        tr = ent.get("trader")
        if tr:
            for s in tr["sells"]:
                if s["item"] not in entities:
                    rep.bad(f"{eid}: товар {s['item']} не найден")
        for hook, sid in (ent.get("sounds") or {}).items():
            if sid not in sound_ids:
                rep.bad(f"{eid}: звук {sid} не в реестре")

    # ---- предметы
    for eid, ent in entities.items():
        if ent["type"] != "item":
            continue
        if ent["category"] not in item_ids:
            rep.bad(f"{eid}: категория {ent['category']} не в реестре")
        if ent.get("equip_slot") and ent["equip_slot"] not in equip_slots:
            rep.bad(f"{eid}: слот {ent['equip_slot']} не в реестре")
        if ent.get("weapon_data") and ent["weapon_data"]["skill"] not in skill_ids:
            rep.bad(f"{eid}: навык оружия не в реестре")
        if ent.get("weapon_data", {}).get("ammo_item") not in (None, *entities):
            rep.bad(f"{eid}: боеприпас не найден")
        for val in (ent.get("portrait") or {}).values():
            if val and not os.path.exists(os.path.join(pkg, val)):
                rep.bad(f"{eid}: нет файла {val}")
        if ent.get("scene_sprite") and isinstance(ent["scene_sprite"], str):
            if not os.path.exists(os.path.join(pkg, ent["scene_sprite"])):
                rep.bad(f"{eid}: нет файла спрайта {ent['scene_sprite']}")
            elif not png_has_alpha(os.path.join(pkg, ent["scene_sprite"])):
                rep.bad(f"{eid}: спрайт сцены без прозрачного фона")

    # ---- эффекты и условия
    def check_effect(e, where):
        t = e["type"]
        if t in ("set_flag", "clear_flag"):
            reg_flag(e["flag"], where)
            if e["flag"] not in flag_reg:
                rep.note(f"{where}: флаг {e['flag']} вне реестра флагов")
        if t == "change_need" and e["need"] not in need_ids:
            rep.bad(f"{where}: потребность {e['need']} не в реестре")
        if t == "change_skill" and e["skill"] not in skill_ids:
            rep.bad(f"{where}: навык {e['skill']} не в реестре")
        if t == "train_stat" and e["stat"] not in ("STR", "CON", "SIZ", "DEX", "INT", "POW", "CHA"):
            rep.bad(f"{where}: характеристика {e['stat']}")
        if t == "stat_check" and e["stat"] not in ("STR", "CON", "SIZ", "DEX", "INT", "POW", "CHA"):
            rep.bad(f"{where}: характеристика {e['stat']}")
        if t in ("add_item", "remove_item") and e["item"] not in entities:
            rep.bad(f"{where}: предмет {e['item']} не найден")
        if t == "give_reward":
            for it in e.get("items", []):
                if it["item"] not in entities:
                    rep.bad(f"{where}: награда {it['item']} не найдена")
        if t == "start_combat":
            if e["arena"] not in arenas:
                rep.bad(f"{where}: арена {e['arena']} не найдена")
            for en in e["enemies"]:
                if en["entity"] not in entities:
                    rep.bad(f"{where}: враг {en['entity']} не найден")
            for al in e.get("allies", []):
                if al["entity"] not in entities:
                    rep.bad(f"{where}: союзник {al['entity']} не найден")
        if t == "play_cutscene" and e["cutscene"] not in cuts:
            rep.bad(f"{where}: катсцена {e['cutscene']} не найдена")
        if t == "start_quest" and e["quest"] not in quests:
            rep.bad(f"{where}: квест {e['quest']} не найден")
        if t == "advance_quest":
            if e["quest"] not in quests:
                rep.bad(f"{where}: квест {e['quest']} не найден")
            else:
                stages = {s["id"] for s in quests[e["quest"]]["stages"]}
                if e["stage"] not in stages:
                    rep.bad(f"{where}: у квеста {e['quest']} нет стадии {e['stage']}")
        if t == "fail_quest" and e["quest"] not in quests:
            rep.bad(f"{where}: квест {e['quest']} не найден")
        if t == "journal_update":
            q = quests.get(e["quest"])
            if not q:
                rep.bad(f"{where}: квест {e['quest']} не найден")
            elif e["text_key"] not in q["journal_entries"]:
                rep.bad(f"{where}: у квеста {e['quest']} нет записи журнала {e['text_key']}")
        if t == "unlock_recipe" and e["recipe"] not in recipes:
            rep.bad(f"{where}: рецепт {e['recipe']} не найден")
        if t == "open_craft" and e.get("recipe") and e["recipe"] not in recipes:
            rep.bad(f"{where}: рецепт {e['recipe']} не найден")
        if t == "unlock_codex" and e["entry"] not in codex:
            rep.bad(f"{where}: запись кодекса {e['entry']} не найдена")
        if t == "fire_rule" and e["rule"] not in rules:
            rep.bad(f"{where}: правило {e['rule']} не найдено")
        if t == "reveal_location" and e["location"] not in locations:
            rep.bad(f"{where}: локация {e['location']} не найдена")
        if t == "teleport_player":
            if e["location"] not in locations:
                rep.bad(f"{where}: локация {e['location']} не найдена")
            elif e.get("scene") and e["scene"] not in locations[e["location"]]["scenes"]:
                rep.bad(f"{where}: сцена {e['scene']} не в локации {e['location']}")
        if t == "change_scene_state":
            sc = scenes.get(e["scene"])
            if not sc:
                rep.bad(f"{where}: сцена {e['scene']} не найдена")
            elif e["state"] not in {s["id"] for s in sc["states"]}:
                rep.bad(f"{where}: у сцены {e['scene']} нет состояния {e['state']}")
        if t == "start_dialogue":
            if e["entity"] not in entities:
                rep.bad(f"{where}: сущность диалога {e['entity']} не найдена")
            elif not entities[e["entity"]].get("dialogue"):
                rep.bad(f"{where}: у {e['entity']} нет диалога")
        if t == "apply_status" and e["status"] not in status_ids:
            rep.bad(f"{where}: статус {e['status']} не в реестре")
        if t == "remove_status" and e["status"] not in status_ids:
            rep.bad(f"{where}: статус {e['status']} не в реестре")
        if t == "set_weather" and e["weather"] and e["weather"] not in weather_ids:
            rep.bad(f"{where}: погода {e['weather']} не в реестре")
        if t == "set_price_event" and e["id"] not in price_events:
            rep.bad(f"{where}: ценовое событие {e['id']} не в реестре")
        if t == "commit_crime" and e["id"] not in crime_ids:
            rep.bad(f"{where}: преступление {e['id']} не в реестре")
        if t == "grant_feat" and e["id"] not in feat_ids:
            rep.bad(f"{where}: черта {e['id']} не в реестре")
        if t in ("join_party", "leave_party") and e["entity"] not in entities:
            rep.bad(f"{where}: спутник {e['entity']} не найден")
        if t == "set_entity_state":
            ent = entities.get(e["entity"])
            if not ent:
                rep.bad(f"{where}: сущность {e['entity']} не найдена")
            elif e["state"] and e["state"] not in set((ent.get("portrait") or {}).keys()):
                rep.bad(f"{where}: у {e['entity']} нет состояния облика {e['state']}")
        if t == "set_description" and e["entity"] not in entities:
            rep.bad(f"{where}: сущность {e['entity']} не найдена")
        if t == "change_disposition" and e["target"] not in faction_ids and e["target"] not in entities:
            rep.bad(f"{where}: цель отношения {e['target']} не найдена")
        if t == "roll_event_table" and e["table"] not in enc_tables:
            rep.bad(f"{where}: таблица событий {e['table']} не найдена")
        if t in ("skill_check_gate",) and e["skill"] not in skill_ids:
            rep.bad(f"{where}: навык {e['skill']} не в реестре")
        if t in ("opposed_check", "group_stat_check") and e.get("skill") and e["skill"] not in skill_ids:
            rep.bad(f"{where}: навык {e['skill']} не в реестре")

    def check_cond(c, where):
        t = c["type"]
        if t in ("flag_set", "flag_not_set"):
            reg_flag(c["flag"], where)
            if c["flag"] not in flag_reg:
                rep.note(f"{where}: флаг {c['flag']} вне реестра флагов")
        if t == "has_item" and c["item"] not in entities:
            rep.bad(f"{where}: предмет {c['item']} не найден")
        if t in ("skill_ge",) and c["skill"] not in skill_ids:
            rep.bad(f"{where}: навык {c['skill']} не в реестре")
        if t == "quest_at_stage":
            if c["quest"] not in quests:
                rep.bad(f"{where}: квест {c['quest']} не найден")
            elif c["stage"] not in {s["id"] for s in quests[c["quest"]]["stages"]}:
                rep.bad(f"{where}: у квеста {c['quest']} нет стадии {c['stage']}")
        if t == "need_ge" and c["need"] not in need_ids:
            rep.bad(f"{where}: потребность {c['need']} не в реестре")
        if t in ("entity_alive", "entity_dead", "in_party") and c["entity"] not in entities:
            rep.bad(f"{where}: сущность {c['entity']} не найдена")
        if t == "has_status" and c["status"] not in status_ids:
            rep.bad(f"{where}: статус {c['status']} не в реестре")
        if t == "weather_is" and c["weather"] and c["weather"] not in weather_ids:
            rep.bad(f"{where}: погода {c['weather']} не в реестре")
        if t == "disposition_ge" and c["target"] not in faction_ids and c["target"] not in entities:
            rep.bad(f"{where}: цель отношения {c['target']} не найдена")
        for key in ("conditions", "and", "or"):
            pass
        if t in ("and", "or") and isinstance(c.get("conditions"), list):
            for x in c["conditions"]:
                check_cond(x, where)
        if t == "not" and c.get("condition"):
            check_cond(c["condition"], where)

    for rid, r in rules.items():
        for e in iter_effects(r.get("effects", [])):
            check_effect(e, f"правило {rid}")
        conds = []
        collect_conditions(r.get("conditions", []), conds)
        collect_conditions(r.get("conditions_any", []), conds)
        for c in conds:
            check_cond(c, f"правило {rid}")
        if "conditions" not in r or "effects" not in r:
            rep.bad(f"правило {rid}: нет обязательных массивов conditions/effects")

    for eid, ent in entities.items():
        for opt in ent.get("interact_options", []):
            for c in opt.get("conditions", []):
                check_cond(c, f"{eid}/{opt['label']}")
            for eff in iter_effects(opt.get("effects", [])):
                check_effect(eff, f"{eid}/{opt['label']}")
        for c in ent.get("interactable_when", []):
            check_cond(c, f"{eid}/interactable_when")
        for key in ("on_use", "on_interact"):
            if ent.get(key):
                for eff in iter_effects(ent[key].get("effects", [])):
                    check_effect(eff, f"{eid}/{key}")
    for sid, sc in scenes.items():
        for sl in sc["slots"]:
            for uw in sl.get("use_with", []):
                for eff in iter_effects(uw.get("effects", [])):
                    check_effect(eff, f"{sid}/{sl['id']}/use_with")
    for qid, q in quests.items():
        stage_ids = {s["id"] for s in q["stages"]}
        for s in q["stages"]:
            for eff in iter_effects(s.get("on_enter_effects", [])):
                check_effect(eff, f"квест {qid}/{s['id']}")
            for tr in s.get("transitions", []):
                if tr["to"] not in stage_ids:
                    rep.bad(f"квест {qid}: переход на несуществующую стадию {tr['to']}")
                for c in tr.get("conditions", []):
                    check_cond(c, f"квест {qid}/{s['id']}")
        final = [s for s in q["stages"] if s.get("final")]
        if not final:
            rep.note(f"квест {qid}: нет финальной стадии")
    for rid, r in recipes.items():
        for inp in r["inputs"]:
            if inp["item"] not in entities:
                rep.bad(f"рецепт {rid}: компонент {inp['item']} не найден")
        for t in r.get("tools", []):
            if t not in entities:
                rep.bad(f"рецепт {rid}: инструмент {t} не найден")
        if r["output"]["item"] not in entities:
            rep.bad(f"рецепт {rid}: результат {r['output']['item']} не найден")
        if r.get("skill") and r["skill"]["id"] not in skill_ids:
            rep.bad(f"рецепт {rid}: навык {r['skill']['id']} не в реестре")
        for c in r.get("requires", []):
            check_cond(c, f"рецепт {rid}")
    for cid, c in codex.items():
        if c.get("category") and c["category"] not in codex_cat:
            rep.bad(f"кодекс {cid}: категория {c['category']} не в реестре")
        if c.get("creature_entity") and c["creature_entity"] not in entities:
            rep.bad(f"кодекс {cid}: существо {c['creature_entity']} не найдено")
        if c.get("image") and not os.path.exists(os.path.join(pkg, c["image"])):
            rep.bad(f"кодекс {cid}: нет файла {c['image']}")
    for cid, cut in cuts.items():
        if cut.get("music") and cut["music"] not in music_ids:
            rep.bad(f"катсцена {cid}: трек {cut['music']} не в реестре")
        for s in cut["slides"]:
            if not s.get("art") and not s.get("image") and not s.get("video"):
                rep.bad(f"катсцена {cid}: слайд без кадра")
            if s.get("image") and not os.path.exists(os.path.join(pkg, s["image"])):
                rep.bad(f"катсцена {cid}: нет файла {s['image']}")
    for aid, a in arenas.items():
        if a.get("music") and a["music"] not in music_ids:
            rep.bad(f"арена {aid}: трек {a['music']} не в реестре")
        g = a["hex_grid"]
        for hx in g["blocked_hexes"] + g["difficult_terrain"] + g.get("cover_hexes", []) + \
                a["spawn_zones"]["player"]["hexes"] + a["spawn_zones"]["enemy"]["hexes"]:
            if not (0 <= hx[0] < g["cols"] and 0 <= hx[1] < g["rows"]):
                rep.bad(f"арена {aid}: гекс {hx} вне поля {g['cols']}x{g['rows']}")
    for tid, t in enc_tables.items():
        for e in t["entries"]:
            if e["type"] == "combat":
                if e["arena"] not in arenas:
                    rep.bad(f"таблица {tid}: арена {e['arena']} не найдена")
                for en in e["enemies"]:
                    if en["entity"] not in entities:
                        rep.bad(f"таблица {tid}: враг {en['entity']} не найден")
            if e["type"] == "dialogue" and e["entity"] not in entities:
                rep.bad(f"таблица {tid}: сущность {e['entity']} не найдена")
            if e["type"] == "skill_check" and e["skill"] not in skill_ids:
                rep.bad(f"таблица {tid}: навык {e['skill']} не в реестре")
            for key in ("success_effects", "fail_effects", "effects"):
                for eff in iter_effects(e.get(key, [])):
                    check_effect(eff, f"таблица {tid}")

    # ---- бюджет создания героя
    cc = campaign.get("char_creation")
    if cc:
        floor = cc.get("skill_floor", 0)
        cap = cc.get("skill_cap", 10 ** 9)
        mand = set(cc.get("mandatory_skills", []))
        budget = cc["skill_points"]
        for prof in cc["professions"]:
            total = sum(max(0, v - cc["stat_limits"]["min"])
                        for v in prof.get("stats", {}).values())
            if prof.get("stats"):
                if len(prof["stats"]) != 7:
                    rep.bad(f"происхождение {prof['id']}: не все семь характеристик")
                if total != cc["total_points"]:
                    rep.bad(f"происхождение {prof['id']}: распределено {total} очков, "
                            f"должно быть {cc['total_points']}")
                for k, v in prof["stats"].items():
                    if not (cc["stat_limits"]["min"] <= v <= cc["stat_limits"]["max"]):
                        rep.bad(f"происхождение {prof['id']}: {k}={v} вне лимитов")
            for it in prof.get("items", []):
                if it["item"] not in entities:
                    rep.bad(f"происхождение {prof['id']}: предмет {it['item']} не найден")
        for call in cc["callings"]:
            for sk in call["skills"]:
                if sk not in skill_ids:
                    rep.bad(f"призвание {call['id']}: навык {sk} не в реестре")
            for prof in cc["professions"]:
                bonus = prof.get("skill_bonus", {})
                spent = 0
                for sk, val in call["skills"].items():
                    low = max(floor, 25 if sk in mand else 0) + bonus.get(sk, 0)
                    spent += max(0, min(cap, val) - low)
                if spent != budget:
                    rep.bad(f"{prof['id']} + {call['id']}: потрачено {spent} очков навыков, "
                            f"бюджет {budget}")
        for prt in cc.get("portraits", []):
            for key in prt.get("states", {}):
                if key not in emotion_ids:
                    rep.bad(f"портрет героя {prt['id']}: состояние {key} не в реестре эмоций")

    # ---- ink
    for fn in manifest["dialogues"]:
        p = os.path.join(pkg, "dialogues", fn)
        if not os.path.exists(p):
            rep.bad(f"диалог {fn}: файл не найден")
            continue
        check_ink(p, rep)
        src = open(p, encoding="utf-8").read()
        for fid in re.findall(r'set_flag\("([\w]+)"\)', src):
            reg_flag(fid, f"ink {fn}")
            if fid not in flag_reg:
                rep.bad(f"ink {fn}: флаг {fid} вне реестра флагов")
        for fid in re.findall(r'get_flag\("([\w]+)"\)', src):
            reg_flag(fid, f"ink {fn}")
            if fid not in flag_reg:
                rep.bad(f"ink {fn}: флаг {fid} вне реестра флагов")
        for iid in re.findall(r'(?:has_item|add_item|remove_item|item_count)\("([\w]+)"', src):
            if iid not in entities:
                rep.bad(f"ink {fn}: предмет {iid} не найден")
        for rid in re.findall(r'fire_rule\("([\w]+)"\)', src):
            if rid not in rules:
                rep.bad(f"ink {fn}: правило {rid} не найдено")
        for eid in re.findall(r'(?:set_entity_state|join_party|in_party)\("([\w]+)"', src):
            if eid not in entities:
                rep.bad(f"ink {fn}: сущность {eid} не найдена")
        for qid in re.findall(r'start_quest\("([\w]+)"\)', src):
            if qid not in quests:
                rep.bad(f"ink {fn}: квест {qid} не найден")
        for cid in re.findall(r'unlock_codex\("([\w]+)"\)', src):
            if cid not in codex:
                rep.bad(f"ink {fn}: запись кодекса {cid} не найдена")
        for tid in re.findall(r'open_trade\("([\w]+)"\)', src):
            if tid not in entities:
                rep.bad(f"ink {fn}: торговец {tid} не найден")
        dlg_id = fn[:-4]
        used_by = [e for e, v in entities.items() if v.get("dialogue") == f"dialogues/{fn}"]
        if not used_by:
            rep.note(f"диалог {fn}: не привязан ни к одной сущности")

    # ---- неиспользуемые флаги реестра
    unused = [f for f in flag_reg if f not in used_flags]
    if unused:
        rep.note(f"флаги реестра, не встретившиеся в данных: {', '.join(sorted(unused))}")

    return rep


def main():
    pkg = sys.argv[1] if len(sys.argv) > 1 else "package"
    schema = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..",
                          "__chronicle_ai__", "campaign.schema.json")
    rep = validate(pkg, schema)
    for line in rep.info:
        print("INFO:", line)
    if rep.problems:
        print(f"\nПРОБЛЕМ: {len(rep.problems)}")
        for line in rep.problems:
            print(" -", line)
        return 1
    print("Проверка пройдена: проблем не найдено.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
