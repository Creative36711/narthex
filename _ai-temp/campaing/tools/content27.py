#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""Ход 27: баланс и полировка интерактивных объектов (`item_pump_engine`,
`item_hoist`):
1. В `item_pump_engine` действие «Простучать корпус» получило `once: true`,
   подсказку `hint` («ремонт 45: проверить, целы ли поршни и клапаны») и
   награду `+10 XP` при успехе (раньше было единственным проверяемым действием
   без `once`, `conditions` и `hint`).
2. В `item_pump_engine` («Вставить сердцевину и запустить помпу») и `item_hoist`
   («Стянуть шов Жилы цепным бандажом») в `fail_effects` добавлен расход
   времени `advance_time: 1` (1 час за неудачную попытку установки обоймы или
   натяжения цепи), чтобы игрок не мог бесплатно перебрасывать проверку
   в обход 72-часового таймера и очков удачи.

Скрипт идемпотентен.
"""
import json
import os

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))


def load_json(rel):
    with open(os.path.join(ROOT, rel), encoding='utf-8') as f:
        return json.load(f)


def save_json(rel, data, indent=2):
    with open(os.path.join(ROOT, rel), 'w', encoding='utf-8') as f:
        json.dump(data, f, ensure_ascii=False, indent=indent)
        f.write('\n')


def main():
    pump = load_json('entities/item_pump_engine.json')
    for opt in pump.get('interact_options', []):
        lbl = opt.get('label')
        if lbl == 'Простучать корпус':
            opt['once'] = True
            opt['hint'] = 'ремонт 45: проверить, целы ли поршни и клапаны'
            for ef in opt.get('effects', []):
                if ef.get('type') == 'skill_check_gate':
                    succ = ef.get('success_effects', [])
                    if not any(e.get('type') == 'grant_xp' for e in succ):
                        succ.insert(0, {'type': 'grant_xp', 'points': 10})
        elif lbl == 'Вставить сердцевину и запустить помпу':
            opt['hint'] = 'ремонт 55 (1 ч при срыве): нужна сердцевина и исправный затвор восьмого яруса'
            for ef in opt.get('effects', []):
                if ef.get('type') == 'skill_check_gate':
                    fail = ef.get('fail_effects', [])
                    if not any(e.get('type') == 'advance_time' for e in fail):
                        fail.insert(0, {'type': 'advance_time', 'ticks': 1})
    save_json('entities/item_pump_engine.json', pump)

    hoist = load_json('entities/item_hoist.json')
    for opt in hoist.get('interact_options', []):
        if opt.get('label') == 'Стянуть шов Жилы цепным бандажом':
            opt['hint'] = 'ремонт 45 (1 ч при срыве): прижать свинцовые накладки к породе цепью подъёмника'
            for ef in opt.get('effects', []):
                if ef.get('type') == 'skill_check_gate':
                    fail = ef.get('fail_effects', [])
                    if not any(e.get('type') == 'advance_time' for e in fail):
                        fail.insert(0, {'type': 'advance_time', 'ticks': 1})
    save_json('entities/item_hoist.json', hoist)

    print('КОНТЕНТ 27')
    print('  item_pump_engine: Простучать корпус получило once: true, hint и +10 XP')
    print('  item_pump_engine / item_hoist: закрыт бесплатный спам повторных бросков без траты часа')


if __name__ == '__main__':
    main()
