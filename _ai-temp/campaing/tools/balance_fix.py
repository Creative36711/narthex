#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""Баланс боя и снаряжения (ход 10).

Что было не так:
  * у оружия и брони не было боевых полей вообще — `weapon_data`/`armor_data`
    пустовали, поэтому надетые ключ, нож, клинок, жилет и плащ ничего
    не делали: герой дрался кулаками, а броня не держала удар;
  * броня существ (3–4) в сумме с надетым жилетом гасила почти весь урон
    героя: обязательные бои (автомат-смотритель в штольне, Келл у затвора)
    были непроходимы для «небоевого» расследования;
  * обходных путей у этих двух боёв не было вовсе.

Что делает скрипт:
  1. раздаёт снаряжению честные `weapon_data`/`armor_data` и `equip_slot`;
  2. снижает броню и навыки противников до играбельных, убирая двойную броню
     у людей (она теперь живёт в жилете);
  3. добавляет небоевые прохождения: скрытность мимо смотрителя и разговор
     с Келлом у затвора;
  4. кладёт минимальный комплект (плащ + нож) в каждое происхождение.

Скрипт идемпотентен: повторный запуск ничего не ломает.
Запуск: python3 tools/balance_fix.py
"""
import json
import os
import sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))

# ---------------------------------------------------------------- снаряжение
WEAPONS = {
    "item_knife": {
        "skill": "blade", "damage": "1d4+1", "damage_bonus": False, "range": 1,
        "attacks_per_round": 1, "parry_capable": True, "label": "Нож"},
    "item_wrench": {
        "skill": "brawl", "damage": "1d8", "damage_bonus": True, "range": 1,
        "attacks_per_round": 1, "parry_capable": False, "label": "Гаечный ключ",
        "traits": ["knockback"]},
    "item_service_blade": {
        "skill": "blade", "damage": "1d8", "damage_bonus": True, "range": 1,
        "attacks_per_round": 1, "parry_capable": True, "label": "Служебный клинок",
        "traits": ["impale"]},
    "item_crossbow": {
        "skill": "shoot", "damage": "1d8", "damage_bonus": False, "range": 6,
        "attacks_per_round": 1, "parry_capable": False, "label": "Жильный самострел",
        "ammo_item": "item_bolt", "traits": ["impale"]},
}
ARMOR = {
    "item_coat": 2,   # промасленный плащ: тонкая, но держит сырость и случайный удар
    "item_vest": 3,   # кирза с пластинами: основная броня внизу
}

# ------------------------------------------------------------------ противники
# id -> что меняем
ENEMIES = {
    "npc_rotling": {"skills": {"bite": 42, "brawl": 38}},
    "npc_ashhound": {"skills": {"bite": 45}},
    "npc_watchman": {"armor": 3, "skills": {"brawl": 50},
                     "weapon": {"damage_bonus": False}},
    "npc_kell": {"armor": 0, "skills": {"blade": 52, "dodge": 42}},
    "npc_thug": {"armor": 0, "skills": {"blade": 46, "dodge": 36}},
}

# стартовый минимум каждому происхождению
PROF_KIT = {"prof_inspector": [("item_coat", 1), ("item_knife", 1)],
            "prof_wright": [("item_coat", 1), ("item_knife", 1)],
            "prof_scavenger": [("item_coat", 1), ("item_knife", 1)]}

NEW_FLAGS = [
    {"id": "watchman_past", "label": "Смотритель пройден тихо",
     "description": "Герой прошёл мимо автомата-смотрителя скрытностью: боя не "
                    "было, смотритель остался стоять. Читается правилом входа "
                    "в штольню, чтобы не начинать бой повторно."},
    {"id": "kell_stood_down", "label": "Келл отошёл от затвора",
     "description": "Келл пропустил героя к затвору после разговора: убеждение "
                    "сработало, бой не состоялся. Читается финальным правилом, "
                    "чтобы не повторять стычку."},
]


def load(p):
    return json.load(open(os.path.join(ROOT, p), encoding="utf-8"))


def save(p, o):
    with open(os.path.join(ROOT, p), "w", encoding="utf-8") as f:
        json.dump(o, f, ensure_ascii=False, indent=2)
        f.write("\n")


def main():
    os.chdir(ROOT)

    # ------------------------------------------------------------ снаряжение
    print("== снаряжение:")
    for iid, w in WEAPONS.items():
        p = f"entities/{iid}.json"
        d = load(p)
        d["equip_slot"] = "weapon"
        d["weapon_data"] = w
        save(p, d)
        print(f"   {iid:20s} оружие: {w['damage']:6s} ({w['skill']}) — {w['label']}")
    for iid, pts in ARMOR.items():
        p = f"entities/{iid}.json"
        d = load(p)
        d["equip_slot"] = "armor"
        d["armor_data"] = {"points": pts}
        save(p, d)
        print(f"   {iid:20s} броня: {pts}")
    d = load("entities/item_lamp.json")
    d["equip_slot"] = "gear"
    save("entities/item_lamp.json", d)
    print("   item_lamp            слот: снаряжение")

    # ------------------------------------------------------------ противники
    print("== противники:")
    for eid, fix in ENEMIES.items():
        p = f"entities/{eid}.json"
        d = load(p)
        if "armor" in fix:
            d["armor"] = fix["armor"]
        if fix.get("skills"):
            d["skills"].update(fix["skills"])
        if fix.get("weapon") and d.get("natural_weapon"):
            d["natural_weapon"].update(fix["weapon"])
        save(p, d)
        worn = (d.get("equipment") or {}).get("armor")
        worn_pts = ARMOR.get(worn, 0)
        total = d.get("armor", 0) + worn_pts
        print(f"   {eid:14s} природная броня {d.get('armor')}"
              f" + надето {worn or 'нет'} ({worn_pts}) = {total}")

    # --------------------------------------------------- обходные пути в боях
    print("== обходные пути:")

    # смотритель: сначала попытка пройти тихо, только провал — бой
    p = "rules/rule_watchman.json"
    r = load(p)
    r["conditions"] = [{"type": "player_enters_scene", "scene": "scene_drift"},
                       {"type": "flag_not_set", "flag": "watchman_down"},
                       {"type": "flag_not_set", "flag": "watchman_past"}]
    combat = [e for e in r["effects"] if e.get("type") == "start_combat"][0]
    combat.setdefault("on_fled", []).append(
        {"type": "show_message",
         "text": "Ты пятишься по рельсам, пока янтарные глаза не гаснут. "
                 "Смотритель остался стоять: он никуда не торопится."})
    r["effects"] = [{
        "type": "skill_check_gate", "skill": "stealth", "difficulty": 45,
        "success_effects": [
            {"type": "set_flag", "flag": "watchman_past"},
            {"type": "show_message",
             "text": "Ты идёшь по мокрому бетону, считая шаги между гулом "
                     "вентиляции. Смотритель поворачивает голову — и не "
                     "находит, на что смотреть."}],
        "fail_effects": [combat]}]
    save(p, r)
    print("   rule_watchman: скрытность 45 или бой")

    # Келл у затвора: сначала разговор, только провал — бой
    p = "rules/rule_final_fight.json"
    r = load(p)
    combat = [e for e in r["effects"] if e.get("type") == "start_combat"][0]
    combat.setdefault("on_fled", []).append(
        {"type": "show_message",
         "text": "Ты отходишь от затвора. Заряд уже в колодке — это не "
                 "отменяется, но и не торопится."})
    r["effects"] = [{
        "type": "skill_check_gate", "skill": "persuade", "difficulty": 50,
        "success_effects": [
            {"type": "set_flag", "flag": "kell_stood_down"},
            {"type": "show_message",
             "text": "Ты говоришь ровно и долго: про вторую подпись, про "
                     "смену без записи, про то, кто останется крайним, когда "
                     "вода пойдёт. Келл слушает, не перебивая. Потом "
                     "отступает на шаг — не потому, что согласен, а потому, "
                     "что приказ закончился, а следующий ещё не выписан."},
            {"type": "fire_rule", "rule": "rule_end_silence"}],
        "fail_effects": [combat]}]
    save(p, r)
    print("   rule_final_fight: убеждение 50 или бой")

    # --------------------------------------------------------- происхождения
    print("== стартовые комплекты:")
    c = load("campaign.json")
    for prof in c["char_creation"]["professions"]:
        have = {i["item"] for i in prof.get("items", [])}
        for iid, qty in PROF_KIT.get(prof["id"], []):
            if iid not in have:
                prof["items"].append({"item": iid, "quantity": qty})
        print(f"   {prof['id']:16s} {[i['item'] for i in prof['items']]}")

    # ----------------------------------------------------------------- флаги
    have = {f["id"] for f in c["flags"]}
    for f in NEW_FLAGS:
        if f["id"] not in have:
            c["flags"].append(f)
    save("campaign.json", c)
    print(f"== флагов в реестре: {len(c['flags'])} (добавлено "
          f"{len([f for f in NEW_FLAGS if f['id'] not in have])})")

    # спутник: у Иры должен быть бинт — она единственная, кто может перевязать
    p = "entities/npc_ira.json"
    d = load(p)
    inv = {i["item"]: i for i in d.get("inventory", [])}
    if "item_bandage" not in inv:
        d["inventory"].append({"item": "item_bandage", "quantity": 1})
        save(p, d)
        print("   npc_ira: добавлен бинт")
    return 0


if __name__ == "__main__":
    sys.exit(main())
