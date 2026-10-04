# -*- coding: utf-8 -*-
"""Диалоги кампании (DlgDoc) и генератор ink-исходников."""

def L(text, emotion=None):
    line = {"text": text}
    if emotion:
        line["emotion"] = emotion
    return {"kind": "line", "line": line}

def E(effect):
    return {"kind": "effect", "effect": effect}

def CH(text, goto, sections=None, conds=None, once=False):
    c = {"text": text, "sections": sections or [], "goto": goto}
    if conds:
        c["conds"] = conds
    if once:
        c["once"] = True
    return c

F_NOT = lambda f: {"type": "flag", "flag": f, "not": True}
F_SET = lambda f: {"type": "flag", "flag": f}
HAS = lambda i: {"type": "has_item", "item": i}
ITEM_GE = lambda i, n: {"type": "item_ge", "item": i, "count": n}

DIALOGUES = {
    "clerk": {
        "version": 2, "label": "Клерк Бюро",
        "nodes": [{
            "id": "main", "label": "Начало разговора",
            "sections": [{"steps": [
                L("Следователь. На столе — дело о пропавших инженерах. Три имени за две недели.")]}],
            "choices": [
                CH("Беру дело.", "stay", conds=[F_NOT("took_case")], sections=[{"steps": [
                    E({"type": "set_flag", "flag": "took_case"}),
                    E({"type": "start_quest", "quest": "quest_case"}),
                    E({"type": "start_quest", "quest": "quest_warmth"}),
                    E({"type": "add_item", "item": "item_silver", "qty": 20}),
                    L("Аванс — двадцать марок. К одиннадцатому дню контора ждёт имя.")]}]),
                CH("Что знаем о пропавших?", "stay", sections=[{"steps": [
                    L("Все из обслуги Очага. Последний, Лука, выбрался из Низов живым и лежит в приюте.")]}]),
                CH("Как дела у Очага?", "stay", sections=[{"steps": [
                    L("Каждую ночь Очаг держит тепло на час меньше. Город этого не переживёт, следователь.")]}]),
                CH("Пойду.", "end"),
            ],
        }],
    },
    "luka": {
        "version": 2, "label": "Инженер Лука",
        "nodes": [{
            "id": "main", "label": "Палата",
            "sections": [{"steps": [
                L("Вы из конторы? Не отдавайте меня им снова… Там внизу поёт железо.")]}],
            "choices": [
                CH("Успокойся. Рассказывай по порядку.", "stay", conds=[F_NOT("luka_talked")], sections=[{"steps": [
                    E({"type": "fire_rule", "rule": "rule_luka_talk"}),
                    L("Лука вцепляется в одеяло и смотрит мимо тебя.")]}]),
                CH("Покажи отметины.", "stay", once=True, sections=[{"steps": [
                    L("На запястье — шестерня, нарисованная мелом в обратную сторону. Такие же метки я видел на подоле серых плащей.")]}]),
                CH("Отдыхай.", "end"),
            ],
        }],
    },
    "iletta": {
        "version": 2, "label": "Сестра Илетта",
        "nodes": [{
            "id": "main", "label": "Приют",
            "sections": [{"steps": [
                L("Приют — не проходной двор, следователь. Больным нужен покой.")]}],
            "choices": [
                CH("Инженеры пели ваш гимн.", "stay", conds=[F_NOT("iletta_confessed")], sections=[{"steps": [
                    E({"type": "fire_rule", "rule": "rule_press_iletta"}),
                    L("Пальцы Илетты белеют на краю таза.")]}]),
                CH("Научи согревающему настою.", "stay", conds=[F_NOT("tonic_learned")], sections=[{"steps": [
                    E({"type": "set_flag", "flag": "tonic_learned"}),
                    E({"type": "unlock_recipe", "recipe": "recipe_tonic"}),
                    L("Полынь, уголёк для тепла и не переваривать. Записывай, не повторяю.")]}]),
                CH("Лечи больных. Я позже.", "end"),
            ],
        }],
    },
    "drogan": {
        "version": 2, "label": "Фореман Дроган",
        "nodes": [{
            "id": "main", "label": "Разговор с Дроганом",
            "sections": [{"steps": [
                L("Я не при делах, следователь. Я фореман, а не сторож братушкам.")]}],
            "choices": [
                CH("Латунь в гроссбухе не сходится.", "stay",
                   conds=[HAS("item_ledger"), F_NOT("drogan_confessed")], sections=[{"steps": [
                    E({"type": "fire_rule", "rule": "rule_press_drogan"}),
                    L("Дроган вытирает ладони о фартук.")]}]),
                CH("Кто открывает решётку ночью?", "stay", conds=[F_SET("drogan_confessed")], sections=[{"steps": [
                    L("Мастер Варга. Его ключ, его печать. Я видел дважды и не хотел видеть третий раз.")]}]),
                CH("Не покидай город.", "end"),
            ],
        }],
    },
    "greta": {
        "version": 2, "label": "Грета, хозяйка",
        "nodes": [{
            "id": "main", "label": "Стойка",
            "sections": [{"steps": [
                L("Присаживайся к печи, следователь. Первый кружкой угощаю.")]}],
            "choices": [
                CH("Покажи, чем торгуешь.", "end", sections=[{"steps": [
                    E({"type": "open_trade", "npc": "npc_greta"})]}]),
                CH("Что говорят в городе?", "stay", sections=[{"steps": [
                    E({"type": "start_quest", "quest": "quest_ledger"}),
                    L("Дроган неделю ныкает что-то в ящики за цехом. А мастерские пьют без тостов — к беде.")]}]),
                CH("Кого видела ночью?", "stay", once=True, sections=[{"steps": [
                    E({"type": "change_disposition", "target": "npc_greta", "delta": 2}),
                    L("Серые плащи у решётки в Низы. Шли как хозяева, а не как воры.")]}]),
            ],
        }],
    },
    "stoker": {
        "version": 2, "label": "Кочегар Прохор",
        "nodes": [{
            "id": "main", "label": "После смены",
            "sections": [{"steps": [
                L("Смена кончена, следователь. Тебе чего? У меня кружка остывает.")]}],
            "choices": [
                CH("Расскажи про гарь с нижних ярусов.", "stay", conds=[F_NOT("stoker_hint")], sections=[{"steps": [
                    E({"type": "set_flag", "flag": "stoker_hint"}),
                    E({"type": "start_quest", "quest": "quest_vial"}),
                    L("Мёртвая гарь, пахнет холодной солью. Это не уголь, это ритуальное. Возьми пробу из ящика в цехе — сам нюхни.")]}]),
                CH("Погреть руки.", "stay", sections=[{"steps": [
                    E({"type": "change_need", "need": "need_warmth", "delta": 10}),
                    L("Садись к топке. Печь своих узнаёт.")]}]),
                CH("Про Варгу.", "stay", once=True, sections=[{"steps": [
                    L("Мастер остаётся в цехе, когда все уходят. Огонь горит до утра. Что он там один куёт?")]}]),
                CH("Отдыхай.", "end"),
            ],
        }],
    },
    "beggar": {
        "version": 2, "label": "Нищенка Ашта",
        "nodes": [{
            "id": "main", "label": "У памятника",
            "sections": [{"steps": [
                L("Подай марку, господин. Холод не спрашивает, кто ты.")]}],
            "choices": [
                CH("Дать марку.", "stay", conds=[ITEM_GE("item_silver", 1), F_NOT("beggar_paid")], sections=[{"steps": [
                    E({"type": "remove_item", "item": "item_silver", "qty": 1}),
                    E({"type": "set_flag", "flag": "beggar_paid"}),
                    E({"type": "change_disposition", "target": "npc_beggar", "delta": 5}),
                    L("Храни тебя шестерня! Ночью серые плащи вели инженеров через площадь — троих! Уводили за литейный цех.", "happy")]}]),
                CH("Что ещё видела?", "stay", conds=[F_SET("beggar_paid")], once=True, sections=[{"steps": [
                    L("Первый шёл как мастер: спина прямая, не спешил. Решётку отворили без скрипа — своим ключом.")]}]),
                CH("Позже.", "end"),
            ],
        }],
    },
    "guard": {
        "version": 2, "label": "Стражник Бран",
        "nodes": [{
            "id": "main", "label": "У решётки",
            "sections": [{"steps": [
                L("Решётка в Низы — под печатью конторы. Прохода нет.")]}],
            "choices": [
                CH("Показать жетон. Открывай.", "stay", conds=[HAS("item_badge"), F_NOT("gate_open")], sections=[{"steps": [
                    E({"type": "fire_rule", "rule": "rule_guard_key"}),
                    L("Бран долго смотрит на печать, потом на твоё лицо.")]}]),
                CH("Что слышно снизу?", "stay", once=True, sections=[{"steps": [
                    L("Ночами под мостовой гудит железо. Как будто там, внизу, кто-то подпевает Очагу. В противофазе.")]}]),
                CH("Мимо шёл.", "end"),
            ],
        }],
    },
    "varga": {
        "version": 2, "label": "Мастер Варга Рец",
        "nodes": [
            {
                "id": "main", "label": "Цех",
                "sections": [{"steps": [
                    L("Следователь? Очаг не любит пустых разговоров. Говори быстро.", "calm")]}],
                "choices": [
                    CH("Инженеры пропадают.", "stay", sections=[{"steps": [
                        L("Труд тяжёлый, люди слабые. Кто на материк подался, кого снег забрал. Не ищи тайны.")]}]),
                    CH("Решётку ночью открывает твой ключ.", "stay", conds=[F_SET("drogan_key"), F_NOT("varga_pressed")], sections=[{"steps": [
                        E({"type": "set_flag", "flag": "varga_pressed"}),
                        L("Фореман болтает лишнее. Или Дроган? Люди лгут, когда боятся.", "angry")]}]),
                    CH("Холодная соль. Твои ритуалы?", "stay", conds=[F_SET("ev_vial")], sections=[{"steps": [
                        L("Соль сохраняет. Даже огонь. Ты внимательнее, чем кажешься, следователь.", "angry")]}]),
                    CH("Всё кончено, Варга.", "n_final", conds=[F_SET("automaton_down")]),
                    CH("Не буду мешать.", "end"),
                ],
            },
            {
                "id": "n_final", "label": "У обратного сердца",
                "sections": [{"steps": [
                    L("Варга кладёт ладонь на холодную доску обратного сердца. «Город мёрзнет, следователь. Я просто даю ему досмотреть сон.»")]}],
                "choices": [
                    CH("Ведём тебя в контору.", "end", sections=[{"steps": [
                        E({"type": "set_flag", "flag": "heart_saved"}),
                        L("Варга не сопротивляется. Сердце Очага гудит ровно, как раньше.")]}]),
                    CH("Уходи. Со своей тишиной — уходи.", "end", sections=[{"steps": [
                        E({"type": "set_flag", "flag": "deal_varga"}),
                        L("Варга кивает и растворяется в паре. Обратное сердце умолкает навсегда.")]}]),
                ],
            },
        ],
    },
    "oracle": {
        "version": 2, "label": "Сердце Очага",
        "nodes": [{
            "id": "main", "label": "Голос Сердца",
            "sections": [{"steps": [
                L("Холод. Холод. Обратная песнь уже поётся.")]}],
            "choices": [
                CH("Кто поёт обратную песнь?", "stay", conds=[F_NOT("heart_voice")], sections=[{"steps": [
                    E({"type": "set_flag", "flag": "heart_voice"}),
                    E({"type": "unlock_codex", "entry": "codex_hearth"}),
                    L("Тот, кто кормит меня железом и солью. Варга. Варга. Его машина поёт против меня.")]}]),
                CH("Это можно остановить?", "stay", sections=[{"steps": [
                    L("Верни инженеров. Останови обратное сердце. Спеши: мой пульс слабее с каждым часом.")]}]),
                CH("Отойти.", "end"),
            ],
        }],
    },
}

# ---- генератор ink ----

EXTERNAL_SIG = {
    "set_flag": "set_flag(f)",
    "add_item": "add_item(id, n)",
    "remove_item": "remove_item(id, n)",
    "fire_rule": "fire_rule(r)",
    "join_party": "join_party(n)",
    "open_trade": "open_trade(n)",
    "start_quest": "start_quest(q)",
    "advance_time": "advance_time(t)",
    "change_need": "change_need(n, d)",
    "change_hp": "change_hp(d)",
    "sleep": "sleep(t)",
    "change_disposition": "change_disposition(t, d)",
    "play_cutscene": "play_cutscene(c)",
    "set_description": "set_description(e, t)",
    "apply_status": "apply_status(s, d)",
    "remove_status": "remove_status(s)",
    "set_weather": "set_weather(w)",
    "unlock_codex": "unlock_codex(e)",
    "unlock_recipe": "unlock_recipe(r)",
}

def _effect_ink(eff):
    t = eff["type"]
    if t == "set_flag":
        return '~ set_flag("%s")' % eff["flag"]
    if t == "add_item":
        return '~ add_item("%s", %d)' % (eff["item"], eff.get("qty", 1))
    if t == "remove_item":
        return '~ remove_item("%s", %d)' % (eff["item"], eff.get("qty", 1))
    if t == "fire_rule":
        return '~ fire_rule("%s")' % eff["rule"]
    if t == "join_party":
        return '~ join_party("%s")' % eff["npc"]
    if t == "open_trade":
        return '~ open_trade("%s")' % eff["npc"]
    if t == "start_quest":
        return '~ start_quest("%s")' % eff["quest"]
    if t == "advance_time":
        return "~ advance_time(%s)" % eff["ticks"]
    if t == "change_need":
        return '~ change_need("%s", %s)' % (eff["need"], eff["delta"])
    if t == "change_hp":
        return "~ change_hp(%s)" % eff["delta"]
    if t == "sleep":
        return "~ sleep(%s)" % eff["ticks"]
    if t == "change_disposition":
        return '~ change_disposition("%s", %s)' % (eff["target"], eff["delta"])
    if t == "play_cutscene":
        return '~ play_cutscene("%s")' % eff["cutscene"]
    if t == "set_description":
        return '~ set_description("%s", "%s")' % (eff["entity"], eff["text"].replace('"', "'"))
    if t == "apply_status":
        return '~ apply_status("%s", %s)' % (eff["status"], eff.get("duration", 4))
    if t == "remove_status":
        return '~ remove_status("%s")' % eff["status"]
    if t == "set_weather":
        return '~ set_weather("%s")' % eff["weather"]
    if t == "unlock_codex":
        return '~ unlock_codex("%s")' % eff["entry"]
    if t == "unlock_recipe":
        return '~ unlock_recipe("%s")' % eff["recipe"]
    raise ValueError("dialogue effect not supported: %s" % t)

def _cond_ink(c):
    t = c["type"]
    neg = c.get("not", False)
    if t == "flag":
        expr = 'get_flag("%s") == 1' % c["flag"]
    elif t == "item_ge":
        expr = 'item_count("%s") >= %s' % (c["item"], c["count"])
    elif t == "has_item":
        expr = 'has_item("%s")' % c["item"]
    elif t == "disp_ge":
        expr = 'get_disposition("%s") >= %s' % (c["target"], c["value"])
    elif t == "quest":
        expr = 'quest_stage("%s") == "%s"' % (c["quest"], c["stage"])
    elif t == "in_party":
        expr = 'in_party("%s")' % c["npc"]
    elif t == "hp_ge":
        expr = "get_hp() >= %s" % c["value"]
    elif t == "has_status":
        expr = 'has_status("%s")' % c["status"]
    elif t == "weather_is":
        expr = 'weather_is("%s")' % c["weather"]
    else:
        raise ValueError("dialogue cond not supported: %s" % t)
    if neg:
        expr = "!(%s)" % expr
    return expr

def _collect_externals(doc):
    used = set()
    def walk_steps(steps):
        for st in steps:
            if st.get("kind") == "effect":
                used.add(st["effect"]["type"])
    for node in doc["nodes"]:
        for sec in node.get("sections", []):
            walk_steps(sec.get("steps", []))
            walk_steps(sec.get("else_steps", []))
        for ch in node.get("choices", []):
            for sec in ch.get("sections", []):
                walk_steps(sec.get("steps", []))
    return sorted(t for t in used if t in EXTERNAL_SIG)

def gen_ink(doc):
    out = []
    for ext in _collect_externals(doc):
        out.append("EXTERNAL %s" % EXTERNAL_SIG[ext])
    if out:
        out.append("")
    for node in doc["nodes"]:
        nid = node["id"]
        out.append("=== %s ===" % nid)
        has_choices = bool(node.get("choices"))
        for sec in node.get("sections", []):
            for st in sec.get("steps", []):
                if st.get("kind") == "line":
                    out.append(st["line"]["text"])
                else:
                    out.append(_effect_ink(st["effect"]))
        if has_choices:
            out.append("-> %s_hub" % nid)
            out.append("")
            out.append("=== %s_hub ===" % nid)
            for ch in node["choices"]:
                mark = "*" if ch.get("once") else "+"
                cond = ""
                if ch.get("conds"):
                    cond = " { %s }" % " && ".join(_cond_ink(c) for c in ch["conds"])
                out.append("%s [%s]%s" % (mark, ch["text"], cond))
                for sec in ch.get("sections", []):
                    for st in sec.get("steps", []):
                        if st.get("kind") == "line":
                            out.append("    " + st["line"]["text"])
                        else:
                            out.append("    " + _effect_ink(st["effect"]))
                g = ch.get("goto", "")
                if g == "end":
                    out.append("    -> DONE")
                elif g == "stay" or g == "":
                    out.append("    -> %s_hub" % nid)
                else:
                    out.append("    -> %s" % g)
                out.append("")
        else:
            out.append("-> DONE")
        out.append("")
    return "\n".join(out).rstrip() + "\n"
