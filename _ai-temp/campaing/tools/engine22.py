#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""Ход 22: синхронизация с обновлённым движком (`a1ea1fa`).

1. Принят новый id кампании `fe0060e4-1287-4741-b36e-ea57239dee99`.
2. **Механика «Незнакомец» (`unknown_label` + `learn_name`)**: пять персонажей,
   с которыми дознаватель не знаком лично до первой реплики (`npc_ira`,
   `npc_dozh`, `npc_ayla`, `npc_zhuk`, `npc_resh`), получили `unknown_label`
   («Девушка у пульта», «Старьёвщик за ящиками», «Женщина с бинтами»,
   «Человек у жаровни», «Человек у стены») и раскрывают своё имя при первом
   разговоре (`learn_name`).
3. **Событийные триггеры правил (`RuleDef.trigger`)**: правилам на вход в сцену
   проставлен `trigger: "enter_scene"`, часовым отсечкам срока (`rule_water_warning`,
   `rule_flood_deadline`) — `trigger: "time_tick"`, остальным авто-правилам —
   `trigger: "always"`.
4. **Повторный вход в каморку мастера Реша (`scene_pump_hall` + `item_resh_door`)**:
   исправлен софтлок (после первого открытия `rule_unlock_resh_room` с `once: true`
   нельзя было вернуться в каморку из машинного зала). В `item_resh_door`
   добавлено действие «Войти в каморку» при `flag_set: resh_room_open`, а в
   `scene_pump_hall.navigation` — переход `В каморку мастера` с новыми полями
   `conditions` и `blocked_message`.
5. **Эффект `present_item` в `.dlg.json`**: схема конструктора диалогов теперь
   поддерживает `{"type": "present_item", "ok": ..., "fail": ..., "required": ...}` —
   прописан во все четыре выбора предъявления предмета (`kast`, `kell`, `zhuk`, `dozh`).

Скрипт идемпотентен.
"""
import glob
import json
import os

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
NEW_ID = 'fe0060e4-1287-4741-b36e-ea57239dee99'

STRANGERS = {
    'npc_ira': ('ira', 'Девушка у пульта'),
    'npc_dozh': ('dozh', 'Старьёвщик за ящиками'),
    'npc_ayla': ('ayla', 'Женщина с бинтами'),
    'npc_zhuk': ('zhuk', 'Человек у жаровни'),
    'npc_resh': ('resh', 'Человек у стены'),
}

PRESENT_CHOICES = {
    'kast': ('Протянуть Каст записку мастера.', 'Записка', 'Записка_мимо', 'item_note'),
    'kell': ('Положить перед Келлом жетон стража.', 'Жетон', 'Жетон_мимо', 'item_guard_token'),
    'zhuk': ('Дать Жуку полистать гроссбух.', 'Расход', 'Расход_мимо', 'item_ledger'),
    'dozh': ('Показать Дожу вещь.', 'Оценка', 'Оценка_мимо', ''),
}


def load(rel):
    with open(os.path.join(ROOT, rel), encoding='utf-8') as f:
        return json.load(f)


def save(rel, data, indent=2):
    with open(os.path.join(ROOT, rel), 'w', encoding='utf-8') as f:
        json.dump(data, f, ensure_ascii=False, indent=indent)
        f.write('\n')


def ensure_external(ink, fn_decl):
    if fn_decl in ink:
        return ink
    lines = ink.split('\n')
    ext_end = 0
    for i, l in enumerate(lines):
        if l.startswith('EXTERNAL '):
            ext_end = i + 1
    lines.insert(ext_end, fn_decl)
    return '\n'.join(lines)


def main():
    # 1. ID кампании
    camp = load('campaign.json')
    old_id = camp.get('id')
    camp['id'] = NEW_ID
    save('campaign.json', camp)

    # 2. Незнакомцы (unknown_label + learn_name)
    for npc_id, (dlg_name, ulabel) in STRANGERS.items():
        ent_rel = f'entities/{npc_id}.json'
        ent = load(ent_rel)
        ent['unknown_label'] = ulabel
        save(ent_rel, ent)

        dlg_rel = f'dialogues/{dlg_name}.dlg.json'
        dlg = load(dlg_rel)
        steps = dlg['nodes'][0]['sections'][0]['steps']
        if not any(
            s.get('kind') == 'effect'
            and s.get('effect', {}).get('type') == 'learn_name'
            for s in steps
        ):
            steps.append({
                'kind': 'effect',
                'effect': {'type': 'learn_name', 'entity': npc_id, 'silent': True},
            })
        save(dlg_rel, dlg, indent=1)

        ink_rel = f'dialogues/{dlg_name}.ink'
        ink = open(os.path.join(ROOT, ink_rel), encoding='utf-8').read()
        ink = ensure_external(ink, 'EXTERNAL learn_name(a0)')
        call = f'~ learn_name("{npc_id}")'
        if call not in ink:
            ink = ink.replace('\n-> Начало_hub\n', f'\n{call}\n-> Начало_hub\n', 1)
        open(os.path.join(ROOT, ink_rel), 'w', encoding='utf-8').write(ink)

    # 3. Триггеры правил
    trig_counts = {'enter_scene': 0, 'time_tick': 0, 'always': 0}
    for rel in sorted(glob.glob('rules/rule_*.json')):
        r = load(rel)
        if r.get('manual'):
            continue
        conds = r.get('conditions', [])
        ctypes = {c.get('type') for c in conds}
        if 'player_enters_scene' in ctypes and 'tick_elapsed' not in ctypes:
            trig = 'enter_scene'
        elif ctypes == {'tick_elapsed'} or (
            'tick_elapsed' in ctypes and 'player_enters_scene' not in ctypes
            and 'player_enters_location' not in ctypes
        ):
            trig = 'time_tick'
        else:
            trig = 'always'
        r['trigger'] = trig
        trig_counts[trig] += 1
        save(rel, r)

    # 4. Дверь каморки мастера Реша и навигация в scene_pump_hall
    door = load('entities/item_resh_door.json')
    for opt in door.get('interact_options', []):
        if opt.get('label') == 'Отпереть ключом':
            opt['conditions'] = [
                {'type': 'has_item', 'item': 'item_key_resh'},
                {'type': 'flag_not_set', 'flag': 'resh_room_open'},
            ]
        elif opt.get('label') == 'Постучать':
            opt['conditions'] = [
                {'type': 'flag_not_set', 'flag': 'resh_room_open'},
            ]
    if not any(o.get('label') == 'Войти в каморку' for o in door.get('interact_options', [])):
        door['interact_options'].insert(0, {
            'label': 'Войти в каморку',
            'hint': 'замок уже открыт',
            'sound': 'sfx_door',
            'conditions': [
                {'type': 'flag_set', 'flag': 'resh_room_open'},
            ],
            'effects': [
                {
                    'type': 'teleport_player',
                    'location': 'loc_pump7',
                    'scene': 'scene_pump_room',
                },
            ],
        })
    save('entities/item_resh_door.json', door)

    phall = load('scenes/scene_pump_hall.json')
    nav = phall.setdefault('navigation', [])
    if not any(n.get('go_to_scene') == 'scene_pump_room' for n in nav):
        nav.append({
            'label': 'В каморку мастера',
            'area': {'x': 1140, 'y': 470, 'w': 120, 'h': 90},
            'go_to_scene': 'scene_pump_room',
            'cost_ticks': 0,
            'conditions': [{'type': 'flag_set', 'flag': 'resh_room_open'}],
            'blocked_message': 'Железная дверь каморки заперта: нужен ключ мастера Реша или отмычка.',
        })
        save('scenes/scene_pump_hall.json', phall)

    # 5. present_item в .dlg.json
    for dlg_name, (ch_text, ok_node, fail_node, req_item) in PRESENT_CHOICES.items():
        dlg_rel = f'dialogues/{dlg_name}.dlg.json'
        dlg = load(dlg_rel)
        for ch in dlg['nodes'][0].get('choices', []):
            if ch.get('text') == ch_text:
                eff = {'type': 'present_item', 'ok': ok_node, 'fail': fail_node}
                if req_item:
                    eff['required'] = req_item
                ch['sections'] = [{'steps': [{'kind': 'effect', 'effect': eff}]}]
        save(dlg_rel, dlg, indent=1)

    print('ДВИЖОК 22')
    print('  id кампании: %s → %s' % (old_id, NEW_ID))
    print('  незнакомцев с unknown_label + learn_name:', len(STRANGERS))
    print('  триггеры правил:', trig_counts)
    print('  повторный вход в scene_pump_room открыт (item_resh_door + navigation)')
    print('  эффект present_item синхронизирован в 4 .dlg.json')


if __name__ == '__main__':
    main()
