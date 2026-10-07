#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""Ход 26: закрытие последних 3 авторских ремарок в диалогах (`narr_zhuk_3`,
`narr_zhuk_4`, `narr_zhuk_6` — 100 % всех строк во всех 10 диалогах озвучено!),
исправление софтлока побега из финального боя с Келлом (`rule_final_fight`),
повторяемости нулевых правил выживания (`rule_zero_*` + `rule_air_restored`),
преждевременных спойлеров во вступлениях `scene_pump_room` и `scene_sluice`
и привязка сюжетных флагов состояний сцен (`case136_read`, `downpour_flood`,
`final_ready`, `charge_made`).

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


def all_sections(node):
    secs = list(node.get('sections', []))
    for ch in node.get('choices', []):
        secs += list(ch.get('sections', []))
        ck = ch.get('check')
        if ck:
            for br in ('success', 'fail'):
                secs += list((ck.get(br) or {}).get('sections', []))
    return secs


ZHUK_REMARKS = [
    ('Жук ждёт ровно столько, сколько стоит твоё молчание.', 'assets/voice/narr_zhuk_3.mp3'),
    ('Жук листает, водя пальцем по столбцам, и считает тихо, одними губами.', 'assets/voice/narr_zhuk_4.mp3'),
    ('Жук тянется было, но рука остаётся при нём.', 'assets/voice/narr_zhuk_6.mp3'),
]

ZERO_STATUS_MAP = {
    'rule_zero_air': 'status_choke',
    'rule_zero_food': 'status_hunger',
    'rule_zero_rest': 'status_weary',
    'rule_zero_thirst': 'status_thirst',
    'rule_zero_warmth': 'status_cold',
}


def main():
    # 1. Привязка последних 3 авторских ремарок в zhuk (39/39 = 100 % всех ремарок!)
    dlg_rel = 'dialogues/zhuk.dlg.json'
    dlg = load_json(dlg_rel)
    for n in dlg.get('nodes', []):
        for sec in all_sections(n):
            for st in sec.get('steps', []):
                if st.get('kind') == 'line' and st['line'].get('action'):
                    for txt, v in ZHUK_REMARKS:
                        if st['line'].get('text') == txt:
                            st['line']['voice'] = v
                            st['line'].pop('timer', None)
    save_json(dlg_rel, dlg, indent=1)

    ink_p = os.path.join(ROOT, 'dialogues/zhuk.ink')
    lines = open(ink_p, encoding='utf-8').read().split('\n')
    for i, line in enumerate(lines):
        for txt, v in ZHUK_REMARKS:
            if line.strip().startswith(txt) and '# action' in line:
                line = line.replace(' # timer: 4', '').replace('# timer: 4 ', '')
                if '# voice:' not in line:
                    line = line + f' # voice: {v}'
                lines[i] = line
    open(ink_p, 'w', encoding='utf-8').write('\n'.join(lines))

    # 2. Флаги состояний сцен в campaign.json
    camp = load_json('campaign.json')
    fmap = {f['id']: f for f in camp.get('flags', [])}
    for fid, flbl, fdesc in [
        ('case136_read', 'Дело №136 прочитано', 'Дознаватель достал со стеллажа и прочитал архивное дело №136.'),
        ('downpour_flood', 'Ливень поднял воду в галерее', 'После прорыва ливня на 68-м часу вода в галерее восьмого яруса поднялась выше мостков.'),
    ]:
        if fid not in fmap:
            camp['flags'].append({'id': fid, 'label': flbl, 'description': fdesc})
    save_json('campaign.json', camp)

    # 3. Выставление флагов case136_read, downpour_flood, final_ready, charge_made
    shelf = load_json('entities/item_shelf.json')
    for opt in shelf.get('interact_options', []):
        if opt.get('label') == 'Прочитать дело №136':
            effs = opt.get('effects', [])
            if not any(e.get('flag') == 'case136_read' for e in effs):
                effs.insert(0, {'type': 'set_flag', 'flag': 'case136_read'})
    save_json('entities/item_shelf.json', shelf)

    dp = load_json('rules/rule_downpour.json')
    if not any(e.get('flag') == 'downpour_flood' for e in dp.get('effects', [])):
        dp['effects'].insert(0, {'type': 'set_flag', 'flag': 'downpour_flood'})
    save_json('rules/rule_downpour.json', dp)

    rf = load_json('rules/rule_resh_found.json')
    if not any(e.get('flag') == 'final_ready' for e in rf.get('effects', [])):
        rf['effects'].insert(1, {'type': 'set_flag', 'flag': 'final_ready'})
    save_json('rules/rule_resh_found.json', rf)

    chg = load_json('entities/item_charge.json')
    for opt in chg.get('interact_options', []):
        effs = opt.get('effects', [])
        if not any(e.get('flag') == 'charge_made' for e in effs):
            effs.insert(0, {'type': 'set_flag', 'flag': 'charge_made'})
    save_json('entities/item_charge.json', chg)

    # 4. Устранение преждевременных спойлеров в narrative_intro scene_pump_room и scene_sluice
    pr = load_json('scenes/scene_pump_room.json')
    if len(pr.get('narrative_intro', [])) >= 2 and isinstance(pr['narrative_intro'][1], dict):
        pr['narrative_intro'][1]['text'] = (
            'В железной печке ещё тлеют угли, а на дверце шкафчика висит тяжёлый навесной замок.'
        )
    save_json('scenes/scene_pump_room.json', pr)

    sl = load_json('scenes/scene_sluice.json')
    if len(sl.get('narrative_intro', [])) >= 1 and isinstance(sl['narrative_intro'][0], dict):
        sl['narrative_intro'][0]['text'] = (
            'У чугунного полотна пахнет сырым железом и глубокой водой. Штурвал блестит так, будто за него недавно держались.'
        )
    save_json('scenes/scene_sluice.json', sl)

    # 5. Исправление софтлока побега (on_fled) в rule_final_fight
    rff = load_json('rules/rule_final_fight.json')
    rff['once'] = False
    rff['conditions'] = [{'type': 'flag_not_set', 'flag': 'case_ended'}]
    save_json('rules/rule_final_fight.json', rff)

    # 6. Исправление повторяемости нулевых правил выживания (rule_zero_*) и rule_air_restored
    for rid, st_id in ZERO_STATUS_MAP.items():
        rz = load_json(f'rules/{rid}.json')
        rz['once'] = False
        rz['conditions'] = [
            {'type': 'not', 'condition': {'type': 'has_status', 'status': st_id}},
        ]
        save_json(f'rules/{rid}.json', rz)

    rar = load_json('rules/rule_air_restored.json')
    rar_effs = rar.get('effects', [])
    if not any(e.get('type') == 'remove_status' for e in rar_effs):
        rar_effs.insert(0, {'type': 'remove_status', 'target': 'player', 'status': 'status_choke'})
        rar_effs.insert(1, {'type': 'change_need', 'need': 'need_air', 'delta': 25})
    save_json('rules/rule_air_restored.json', rar)

    print('КОНТЕНТ 26')
    print('  привязаны последние 3 авторские ремарки (39/39 = 100 % во всех 10 диалогах!)')
    print('  исправлен софтлок побега в rule_final_fight и одноразовость rule_zero_*')
    print('  убраны спойлеры во вступлениях scene_pump_room и scene_sluice')


if __name__ == '__main__':
    main()
