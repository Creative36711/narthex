#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""Баланс хода 17: бои, которые нельзя было пройти мимо.

Разбор по числам (герой-дознаватель без боевой специализации:
HP 10, клинок 30, рукопашная 25, плащ 2):

  * два пепельных пса в затопленной галерее — суммарно 19 HP при попадании
    45 и уклонении 46. Герой снимает около 1,4 HP за раунд, псы — 1,35,
    но бьют первыми (ловкость 15 против 11). Считается: герой умирает на
    седьмом-восьмом раунде, не убив ни одного. Обхода не было вовсе —
    правило висело на входе в сцену;
  * патруль Надзора на шлюзе и у помпы (режим тишины) — клинок 46, броня 3,
    урон 1d8+1d4. Герой снимает 1,5 за попадание при 30 % попадания: бой
    против одного длится двадцать семь раундов, а сам герой живёт четыре.
    Обхода тоже не было;
  * за убитый патруль ничего не падало: ни клинка, ни жилета, — то есть
    выигранный с огромным трудом бой не улучшал ничего дальше.

Что делаем:
  1. у псов и у обоих патрулей появляется обход (скрытность и жетон
     дознавателя), который ещё и оплачивается опытом: не стрелять — тоже
     работа;
  2. в драке с псами остаётся один пёс вместо двух: один — бой на грани,
     двое — смерть без шансов;
  3. с патруля падает то, чем он дрался: служебный клинок и жилет из
     кирзы (3 брони против 2 у плаща) — награда за риск;
  4. скрытность у смотрителя и путь через масло теперь дают опыт, чтобы
     мирное прохождение не оставалось без награды.

Скрипт перезапускаемый.

Запуск: python3 tools/balance_17.py
"""
import json
import os

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))


def load(rel):
    with open(os.path.join(ROOT, rel), encoding="utf-8") as f:
        return json.load(f)


def save(rel, data):
    with open(os.path.join(ROOT, rel), "w", encoding="utf-8") as f:
        json.dump(data, f, ensure_ascii=False, indent=2)
        f.write("\n")


FLAGS = [
    ("hounds_past", "Псы не взяли след",
     "Герой прошёл затопленную галерею по воде у стенки: пепельные псы потеряли след."),
    ("patrol_gate_passed", "Патруль на шлюзе пропустил",
     "Герой предъявил жетон дознавателя и прошёл мимо патруля Надзора у шлюза."),
    ("patrol_pump_passed", "Патруль у помпы пропустил",
     "Герой прошёл мимо дежурства у седьмой помпы по жетону дознавателя."),
]

HOUNDS = {
    "id": "rule_hounds",
    "label": "Пепельные псы в галерее",
    "once": True,
    "manual": False,
    "conditions": [{"type": "player_enters_scene", "scene": "scene_flood_gallery"}],
    "effects": [
        {"type": "skill_check_gate", "skill": "stealth", "difficulty": 50,
         "success_effects": [
             {"type": "set_flag", "flag": "hounds_past"},
             {"type": "grant_xp", "points": 10},
             {"type": "play_sound", "sound": "sfx_wade", "volume": 0.6},
             {"type": "show_message",
              "text": "Ты снимаешь ботинки и идёшь по пояс в воде, прижимаясь к стенке. Псы берут след у самой арки и теряют его в стоячей воде: в ней человек не пахнет. Через минуту ты уже на той стороне."},
         ],
         "fail_effects": [
             {"type": "start_combat",
              "enemies": [{"entity": "npc_ashhound", "count": 1}],
              "arena": "arena_gallery",
              "intro": "Из-под арки выходит пёс: пепельная шерсть, красные глаза, ни звука. Он идёт не спеша, прижимаясь к стенке, — и загораживает галерею.",
              "on_victory": [
                  {"type": "show_message", "text": "Пёс уходит в воду. Там его и кормили."},
                  {"type": "grant_xp", "points": 15},
              ]},
             {"type": "play_sound", "sound": "snd_stone", "volume": 0.7},
         ]},
    ],
    "chapter": "ch_deep",
}

PATROL_GATE = {
    "id": "rule_patrol_gate",
    "label": "Патруль на шлюзе",
    "once": True,
    "manual": False,
    "conditions": [
        {"type": "flag_set", "flag": "lockdown"},
        {"type": "player_enters_location", "location": "loc_gate"},
    ],
    "effects": [
        {"type": "skill_check_gate", "skill": "persuade", "difficulty": 45,
         "success_effects": [
             {"type": "set_flag", "flag": "patrol_gate_passed"},
             {"type": "grant_xp", "points": 8},
             {"type": "show_message",
              "text": "Ты не достаёшь жетон — просто держишь руку у груди, где он лежит. «Дознаватель. Я к инспектору». Человек смотрит на плащ, на пустые руки и отходит: связываться с Надзором ему платят не по этой статье."},
         ],
         "fail_effects": [
             {"type": "start_combat",
              "enemies": [{"entity": "npc_thug", "count": 1}],
              "arena": "arena_gate",
              "intro": "Из-под эстакады выходит один в кирзе: «Документы. И не дёргайся».",
              "on_victory": [
                  {"type": "show_message",
                   "text": "Он остаётся лежать у эстакады. Убежать не успел — или не захотел."},
                  {"type": "grant_xp", "points": 20},
              ]},
         ]},
    ],
    "chapter": "ch_deep",
}

PATROL_PUMP = {
    "id": "rule_patrol_pump",
    "label": "Дежурство у седьмой помпы",
    "once": True,
    "manual": False,
    "conditions": [
        {"type": "flag_set", "flag": "lockdown"},
        {"type": "player_enters_location", "location": "loc_pump7"},
    ],
    "effects": [
        {"type": "skill_check_gate", "skill": "persuade", "difficulty": 50,
         "success_effects": [
             {"type": "set_flag", "flag": "patrol_pump_passed"},
             {"type": "grant_xp", "points": 8},
             {"type": "show_message",
              "text": "«Дознаватель, дело сто тридцать семь». Один смотрит на жетон, второй — на лестницу. Приказ никого не пускать писали не про Надзор, и оба это понимают."},
         ],
         "fail_effects": [
             {"type": "start_combat",
              "enemies": [{"entity": "npc_thug", "count": 2}],
              "arena": "arena_pump",
              "intro": "У помпы теперь дежурство: двое с дубинками и приказом никого не пускать.",
              "on_victory": [
                  {"type": "show_message",
                   "text": "Запасный выходят из зала, прижимая руку к боку."},
                  {"type": "grant_xp", "points": 30},
              ]},
         ]},
    ],
    "chapter": "ch_deep",
}


def main():
    cam = load("campaign.json")
    for fid, label, desc in FLAGS:
        if not any(f["id"] == fid for f in cam["flags"]):
            cam["flags"].append({"id": fid, "label": label, "description": desc})
    cam["flags"].sort(key=lambda f: f["id"])
    save("campaign.json", cam)
    print("флагов:", len(cam["flags"]))

    for doc in (HOUNDS, PATROL_GATE, PATROL_PUMP):
        save("rules/%s.json" % doc["id"], doc)
        print("правило:", doc["id"])

    # опыт за мирный проход мимо смотрителя
    w = load("rules/rule_watchman.json")
    for e in w.get("effects") or []:
        if e.get("type") == "skill_check_gate":
            se = e.setdefault("success_effects", [])
            if not any(x.get("type") == "grant_xp" for x in se):
                se.insert(1, {"type": "grant_xp", "points": 10})
    save("rules/rule_watchman.json", w)
    oil = load("rules/rule_watchman_oil.json")
    for e in oil.get("effects") or []:
        if e.get("type") == "skill_check_gate":
            se = e.setdefault("success_effects", [])
            if not any(x.get("type") == "grant_xp" for x in se):
                se.insert(2, {"type": "grant_xp", "points": 15})
    save("rules/rule_watchman_oil.json", oil)
    print("смотритель: опыт за скрытность и за масло")

    # добыча с патруля: чем он дрался, тем и расплачивается
    thug = load("entities/npc_thug.json")
    loot = thug.setdefault("loot_table", [])
    have = {l.get("item") for l in loot}
    for item, chance in (("item_service_blade", 0.5), ("item_vest", 0.3)):
        if item not in have:
            loot.append({"item": item, "chance": chance, "min": 1, "max": 1})
    save("entities/npc_thug.json", thug)
    print("добыча с боевика:", json.dumps(thug["loot_table"], ensure_ascii=False))


if __name__ == "__main__":
    main()
