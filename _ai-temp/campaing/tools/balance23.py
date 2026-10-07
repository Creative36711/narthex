#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""Ход 23: баланс проверок улик и стоимости времени (72 часа).

1. Аудит интерактивных проверок улик на сценах вскрыл критический перекос:
   четыре инженерных препятствия (`item_cache` — взлом схрона, `item_resh_door` —
   взлом каморки, `item_ladder` — спуск за клапаном, `item_pipes` — перекрытие
   узла) были устроены через `conditions: [flag_not_set]` и плату временем
   (`advance_time: 1`), тогда как три сюжетные улики —
   - `item_pump_engine` («Осмотреть привод» -> `clue_glove`, `item_glove`),
   - `item_locker` («Вскрыть шкафчик» -> `clue_plate`, `item_plate`, `item_key_cache`, `quest_duty`),
   - `item_dead_guard` («Осмотреть тело» -> `clue_guard`, `item_guard_token`, `quest_missing`)
   имели жёсткий `once: true` поверх `skill_check_gate` (сложность 45–50).
   При броске 51–100 игрок тратил час времени И навсегда терял доступ к улике,
   ключу от схрона и двум побочным квестам (`quest_duty`, `quest_missing`).
2. Все три улики переведены на единый стандарт кампании:
   - убрано `once: true`, поставлено условие `flag_not_set` (`clue_glove`,
     `clue_plate`, `clue_guard`);
   - в `hint` явно указана цена попытки (`1 ч: ...`);
   - у третьего действия `item_dead_guard` («Сверить жетон со списком смены»)
     поставлено условие `flag_set: clue_guard`, чтобы сверять жетон можно было
     только после того, как он найден на теле.
3. Симуляция по всем 16 стартовым сборкам героя (`4 профессии × 4 призвания`):
   рассчитывает вероятность глухого тупика по уликам до правки и средние
   затраты времени (в часах из 72) после правки.

Скрипт идемпотентен.
"""
import json
import os

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))


def load(rel):
    with open(os.path.join(ROOT, rel), encoding='utf-8') as f:
        return json.load(f)


def save(rel, data):
    with open(os.path.join(ROOT, rel), 'w', encoding='utf-8') as f:
        json.dump(data, f, ensure_ascii=False, indent=2)
        f.write('\n')


def main():
    # 1. item_pump_engine: Осмотреть привод -> condition flag_not_set: clue_glove
    pump = load('entities/item_pump_engine.json')
    for opt in pump.get('interact_options', []):
        if opt.get('label') == 'Осмотреть привод':
            opt.pop('once', None)
            opt['conditions'] = [{'type': 'flag_not_set', 'flag': 'clue_glove'}]
            opt['hint'] = '1 ч, расследование: срез муфты и рукавица в поддоне'
    save('entities/item_pump_engine.json', pump)

    # 2. item_locker: Вскрыть шкафчик -> condition flag_not_set: clue_plate
    locker = load('entities/item_locker.json')
    for opt in locker.get('interact_options', []):
        if opt.get('label') == 'Вскрыть шкафчик':
            opt.pop('once', None)
            opt['conditions'] = [{'type': 'flag_not_set', 'flag': 'clue_plate'}]
            opt['hint'] = '1 ч, взлом: внутри пломба тринадцать-К и ключ от схрона'
    save('entities/item_locker.json', locker)

    # 3. item_dead_guard: Осмотреть тело -> condition flag_not_set: clue_guard
    #    Сверить жетон со списком смены -> condition flag_set: clue_guard
    guard = load('entities/item_dead_guard.json')
    for opt in guard.get('interact_options', []):
        if opt.get('label') == 'Осмотреть тело':
            opt.pop('once', None)
            opt['conditions'] = [{'type': 'flag_not_set', 'flag': 'clue_guard'}]
            opt['hint'] = '1 ч, расследование: осмотреть тело у затвора'
        elif opt.get('label') == 'Сверить жетон со списком смены':
            opt['conditions'] = [{'type': 'flag_set', 'flag': 'clue_guard'}]
    save('entities/item_dead_guard.json', guard)

    # 4. Аналитический расчёт по 16 сборкам героя (4 профессии × 4 призвания)
    camp = load('campaign.json')
    cc = camp['char_creation']
    mand = set(cc.get('mandatory_skills') or [])
    floor = cc.get('skill_floor', 0)

    print('БАЛАНС 23 (доступность 3 ключевых улик по 16 сборкам героя)')
    lockout_probs = []
    expected_hours = []
    for prof in cc['professions']:
        pbon = prof.get('skill_bonus') or {}
        for call in cc['callings']:
            csk = call.get('skills') or {}
            inv = max(floor, 25 if 'investigate' in mand else 0) + pbon.get('investigate', 0)
            inv = max(inv, csk.get('investigate', 0) + pbon.get('investigate', 0))
            lck = max(floor, 25 if 'lockpick' in mand else 0) + pbon.get('lockpick', 0)
            lck = max(lck, csk.get('lockpick', 0) + pbon.get('lockpick', 0))
            # В проверках движка шанс успеха d100 <= skill + (50 - difficulty)
            p_glove = min(0.95, max(0.05, (inv + (50 - 50)) / 100.0))
            p_guard = min(0.95, max(0.05, (inv + (50 - 50)) / 100.0))
            p_plate = min(0.95, max(0.05, (lck + (50 - 45)) / 100.0))
            p_all_first_try = p_glove * p_guard * p_plate
            lockout_probs.append(1.0 - p_all_first_try)
            hrs = (1.0 / p_glove) + (1.0 / p_guard) + (1.0 / p_plate)
            expected_hours.append(hrs)

    avg_lockout = sum(lockout_probs) / len(lockout_probs) * 100
    min_hrs, max_hrs = min(expected_hours), max(expected_hours)
    avg_hrs = sum(expected_hours) / len(expected_hours)
    print(f'  до правки (once: true): шанс потерять хотя бы 1 из 3 улик/квестов = {avg_lockout:.1f}% в среднем по 16 сборкам')
    print(f'  после правки (плата 1 ч за попытку): 100% достижимость, средние затраты = {avg_hrs:.1f} ч (от {min_hrs:.1f} до {max_hrs:.1f} ч из 72 ч)')


if __name__ == '__main__':
    main()
