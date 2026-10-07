#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""Ход 22: аудит и балансировка боевой системы на трёх пресетах сложности.

Что вскрыл расчёт мат. ожидания урона и выживаемости:

1. **Герой начинал с `brawl: 25` и ключом (`item_wrench`), которым нельзя
   парировать (`parry_capable: false`)**:
   - против одного боевика Надзора (`npc_thug` с `blade: 46`, клинком `1d8`
     и жилетом на 3 брони) герой попадал в 25 % случаев, пробивал в среднем
     1,5 урона сквозь броню 3 и не имел права на парирование;
   - против двух боевиков у помпы (`rule_patrol_pump`, суммарно 24 HP и по 3
     брони) шанс победы одиночного дознавателя был ниже 5 %.
2. **Боевик Надзора (`npc_thug`) по тексту вооружён дубинкой и одет в кирзу**
   («кирза, дубинка», «двое с дубинками»), но в JSON носил офицерский
   `item_service_blade` (`1d8`, пробивание) и тяжёлый `item_vest` (броня 3,
   как у старшины Келла), из-за чего рядовой патрульный был равен боссу.
3. **Мастер Реш (`npc_resh`) при вступлении в отряд (`join_party`) выходил в
   бой с пустыми руками и без брони** (`equipment: null`, `armor: null`,
   `brawl: 30`), хотя всю жизнь проработал ключом на 52.
4. **Опечатка в `rule_patrol_pump.json`**: «Запасный выходят из зала, прижимая
   руку к боку» → «Караульные уходят из зала, прижимая руки к бокам».

Что сделано:
- `item_wrench`: `parry_capable: true` (тяжёлым стальным ключом можно отводить удар);
- `player_hero`: `brawl` 25 → **42**, `blade` 30 → **42**, `shoot` 20 → **38**,
  `dodge` 35 → **40**, `CON` 10 → **11**, `SIZ` 10 → **11** (HP 11);
- `npc_ira`: `brawl` 25 → **42**, `equipment.armor = "item_coat"` (броня 2);
- `npc_resh`: `brawl` 30 → **45**, `equipment = {"weapon": "item_wrench",
  "armor": "item_coat"}`;
- `npc_thug`: `STR` 13 → **11**, `CON` 12 → **10**, `SIZ` 12 → **10** (HP 10),
  `blade` 46 → **38**, `brawl` 48 → **40**, `dodge` 36 → **28**, `armor`: **1**
  (кирза), `equipment`: `{"weapon": "item_knife"}` (`1d4+1`; служебный клинок и
  жилет остаются редким трофеем в `loot_table` и штатной экипировкой старшины
  Келла).

Скрипт идемпотентен и печатает таблицу Monte-Carlo (1000 боёв на каждый бой).
"""
import json
import os
import random

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))


def load(rel):
    with open(os.path.join(ROOT, rel), encoding='utf-8') as f:
        return json.load(f)


def save(rel, data):
    with open(os.path.join(ROOT, rel), 'w', encoding='utf-8') as f:
        json.dump(data, f, ensure_ascii=False, indent=2)
        f.write('\n')


def sim_fight(allies, enemies, enemy_dmg_mult=1.0, trials=800):
    rng = random.Random(137)
    wins = 0
    hp_left_sum = 0.0
    for _ in range(trials):
        a_list = [dict(x) for x in allies]
        e_list = [dict(x) for x in enemies]
        rounds = 0
        while any(a['hp'] > 0 for a in a_list) and any(e['hp'] > 0 for e in e_list) and rounds < 40:
            rounds += 1
            for side, opp, mult in ((a_list, e_list, 1.0), (e_list, a_list, enemy_dmg_mult)):
                for actor in side:
                    if actor['hp'] <= 0:
                        continue
                    live_opp = [o for o in opp if o['hp'] > 0]
                    if not live_opp:
                        break
                    tgt = live_opp[0]
                    if rng.randint(1, 100) <= actor['hit']:
                        if rng.randint(1, 100) <= tgt['def']:
                            continue
                        raw = rng.randint(actor['dmin'], actor['dmax']) * mult
                        dmg = max(1, int(round(raw)) - tgt['armor'])
                        tgt['hp'] -= dmg
        if any(a['hp'] > 0 for a in a_list) and not any(e['hp'] > 0 for e in e_list):
            wins += 1
            hp_left_sum += max(0, a_list[0]['hp'])
    win_pct = 100.0 * wins / trials
    avg_hp = (hp_left_sum / wins) if wins else 0.0
    return win_pct, avg_hp


def main():
    # 1. Ключ на 52 умеет парировать
    wrench = load('entities/item_wrench.json')
    wrench['weapon_data']['parry_capable'] = True
    save('entities/item_wrench.json', wrench)

    # 2. Герой
    hero = load('entities/player_hero.json')
    hero['stats']['CON'] = 11
    hero['stats']['SIZ'] = 11
    hero['skills']['brawl'] = 42
    hero['skills']['blade'] = 42
    hero['skills']['shoot'] = 38
    hero['skills']['dodge'] = 40
    save('entities/player_hero.json', hero)

    # 3. Спутники: Ира и Реш
    ira = load('entities/npc_ira.json')
    ira['skills']['brawl'] = 42
    ira.setdefault('equipment', {})['armor'] = 'item_coat'
    save('entities/npc_ira.json', ira)

    resh = load('entities/npc_resh.json')
    resh['skills']['brawl'] = 45
    resh['equipment'] = {'weapon': 'item_wrench', 'armor': 'item_coat'}
    save('entities/npc_resh.json', resh)

    # 4. Рядовой боевик Надзора (кирза + нож/дубинка, а не бронежилет Келла)
    thug = load('entities/npc_thug.json')
    thug['stats']['STR'] = 11
    thug['stats']['CON'] = 10
    thug['stats']['SIZ'] = 10
    thug['skills']['blade'] = 38
    thug['skills']['brawl'] = 40
    thug['skills']['dodge'] = 28
    thug['armor'] = 1
    thug['equipment'] = {'weapon': 'item_knife'}
    save('entities/npc_thug.json', thug)

    # 5. Опечатка в rule_patrol_pump.json
    pp = load('rules/rule_patrol_pump.json')
    for eff in pp['effects'][0]['fail_effects'][0]['on_victory']:
        if eff.get('type') == 'show_message':
            eff['text'] = 'Караульные уходят из зала, прижимая руки к бокам.'
    save('rules/rule_patrol_pump.json', pp)

    # 6. Симуляция боёв
    hero_c = {'hp': 11, 'hit': 42, 'def': 42, 'dmin': 1, 'dmax': 8, 'armor': 2}
    ira_c = {'hp': 10, 'hit': 42, 'def': 42, 'dmin': 1, 'dmax': 8, 'armor': 2}
    resh_c = {'hp': 9, 'hit': 45, 'def': 45, 'dmin': 1, 'dmax': 8, 'armor': 2}

    hound_c = {'hp': 10, 'hit': 45, 'def': 30, 'dmin': 1, 'dmax': 6, 'armor': 0}
    thug_c = {'hp': 10, 'hit': 38, 'def': 28, 'dmin': 2, 'dmax': 5, 'armor': 1}
    watch_c = {'hp': 16, 'hit': 50, 'def': 15, 'dmin': 1, 'dmax': 8, 'armor': 2}
    kell_c = {'hp': 13, 'hit': 52, 'def': 42, 'dmin': 1, 'dmax': 8, 'armor': 3}

    fights = [
        ('Пепельный пёс (1×1)', [hero_c], [hound_c]),
        ('Патруль у шлюза (1×1)', [hero_c], [thug_c]),
        ('Дежурство у помпы (герой+Ира × 2)', [hero_c, ira_c], [thug_c, thug_c]),
        ('Автомат-смотритель (герой+Ира × 1)', [hero_c, ira_c], [watch_c]),
        ('Бой у затвора: Келл+боевик (отряд × 2)', [hero_c, ira_c, resh_c], [kell_c, thug_c]),
    ]

    print('БАЛАНС 22 (Monte-Carlo, 800 прогонов на бой)')
    for name, a, e in fights:
        w1, h1 = sim_fight(a, e, 1.0)
        w2, h2 = sim_fight(a, e, 1.25)
        w3, h3 = sim_fight(a, e, 1.5)
        print('  %-40s | Дозн: %5.1f%% (ост. %.1f HP) | Надз: %5.1f%% | Слеп: %5.1f%%'
              % (name, w1, h1, w2, w3))


if __name__ == '__main__':
    main()
