#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""Ход 25: синхронизация с движком `eeb2764`, привязка 10 озвученных авторских
ремарок (`narr_kast_7`, `narr_kell_2..5`, `narr_resh_2`, `narr_vein_2..3`,
`narr_vex_2`, `narr_zhuk_2` — теперь 9 из 10 диалогов озвучены на 100 %
включая все ремарки!), механика цепного бандажа на Жиле (`item_hoist` +
`clear_flag: vein_braced`) и исправление двух балансных багов 9-го яруса
(`rule_watchman` vs `rule_watchman_oil` и цикл двух банок `item_filter`).

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


REMARKS_MAP = {
    'kast': [
        ('Она даже не поднимает глаз.', 'assets/voice/narr_kast_7.mp3'),
    ],
    'kell': [
        ('Он берёт рукавицу за манжет, не разворачивая.', 'assets/voice/narr_kell_2.mp3'),
        ('Он смотрит на бумагу долго, потом убирает руку с рукояти.', 'assets/voice/narr_kell_3.mp3'),
        ('Келл смотрит на медь так, будто она горячая, и не берёт.', 'assets/voice/narr_kell_4.mp3'),
        ('Келл смотрит сначала на вещь, потом на тебя — и без всякого интереса.', 'assets/voice/narr_kell_5.mp3'),
    ],
    'resh': [
        ('Он встаёт тяжело, опираясь о стену ладонью.', 'assets/voice/narr_resh_2.mp3'),
    ],
    'vein': [
        ('Ты кладёшь ладонь на камень. Он тёплый и отвечает на пульс.', 'assets/voice/narr_vein_2.mp3'),
        ('Молчание длится, пока не закладывает уши.', 'assets/voice/narr_vein_3.mp3'),
    ],
    'vex': [
        ('Он крутит маховик на четверть оборота — тот идёт свободно, как в пустоте.', 'assets/voice/narr_vex_2.mp3'),
    ],
    'zhuk': [
        ('Он протягивает руку, не глядя. Марки исчезают в рукаве.', 'assets/voice/narr_zhuk_2.mp3'),
    ],
}


def attach_remarks(dlg_id, pairs):
    dlg_rel = f'dialogues/{dlg_id}.dlg.json'
    dlg = load_json(dlg_rel)
    for n in dlg.get('nodes', []):
        for sec in all_sections(n):
            for st in sec.get('steps', []):
                if st.get('kind') == 'line' and st['line'].get('action'):
                    for txt, v in pairs:
                        if st['line'].get('text') == txt:
                            st['line']['voice'] = v
                            st['line'].pop('timer', None)
    save_json(dlg_rel, dlg, indent=1)

    ink_p = os.path.join(ROOT, f'dialogues/{dlg_id}.ink')
    lines = open(ink_p, encoding='utf-8').read().split('\n')
    for i, line in enumerate(lines):
        for txt, v in pairs:
            if line.strip().startswith(txt) and '# action' in line:
                line = line.replace(' # timer: 4', '').replace('# timer: 4 ', '')
                if '# voice:' not in line:
                    line = line + f' # voice: {v}'
                lines[i] = line
    open(ink_p, 'w', encoding='utf-8').write('\n'.join(lines))


def ensure_external(ink_p, decl):
    txt = open(ink_p, encoding='utf-8').read()
    if decl not in txt:
        txt = decl + '\n' + txt
        open(ink_p, 'w', encoding='utf-8').write(txt)


def main():
    # 1. campaign.json: ID из TASK.md, ui_labels для narrative_intro, новые флаги
    camp = load_json('campaign.json')
    camp['id'] = 'b7305faa-8e10-4d26-96bb-f1b5ed5e493f'
    camp.pop('meta', None)
    ui = camp.setdefault('ui_labels', {})
    ui['scene_intro_next'] = 'Далее ▶'
    ui['scene_intro_done'] = 'Осмотреться ▶'

    fmap = {f['id']: f for f in camp.get('flags', [])}
    if 'vein_braced' not in fmap:
        camp['flags'].append({
            'id': 'vein_braced',
            'label': 'Шов Жилы стянут бандажом',
            'description': 'На слепом забое трещина Жилы прижата свинцовым бандажом на цепях ручного подъёмника.',
        })
    if 'filter_exhausted' not in fmap:
        camp['flags'].append({
            'id': 'filter_exhausted',
            'label': 'Обе банки дыхателя отработаны',
            'description': 'После подъёма с девятого яруса обе угольные банки дыхателя забиты и требуют переснаряжения на верстаке.',
        })
    save_json('campaign.json', camp)

    # 2. Привязка 10 озвученных авторских ремарок
    for dlg_id, pairs in REMARKS_MAP.items():
        attach_remarks(dlg_id, pairs)

    # 3. Новые функции движка eeb2764 в диалогах (in_party, npc_known, clear_flag)
    # 3a. ira: not (in_party("npc_ira"))
    ira_dlg = load_json('dialogues/ira.dlg.json')
    for ch in ira_dlg['nodes'][0]['choices']:
        if ch.get('text') == 'Пойдём со мной вниз. Нам обоим нужно закрыть этот журнал.':
            ch['conds'] = [
                {'type': 'flag', 'flag': 'ira_joined', 'not': True},
                {'type': 'in_party', 'npc': 'npc_ira', 'not': True},
                {'type': 'disp_ge', 'target': 'npc_ira', 'value': 25},
            ]
    save_json('dialogues/ira.dlg.json', ira_dlg, indent=1)
    ira_ink_p = os.path.join(ROOT, 'dialogues/ira.ink')
    ensure_external(ira_ink_p, 'EXTERNAL in_party(a0)')
    ira_ink = open(ira_ink_p, encoding='utf-8').read()
    ira_ink = ira_ink.replace(
        '* { not (get_flag("ira_joined")) and get_disposition("npc_ira") >= 25 } [Пойдём со мной вниз. Нам обоим нужно закрыть этот журнал.]',
        '* { not (get_flag("ira_joined")) and not (in_party("npc_ira")) and get_disposition("npc_ira") >= 25 } [Пойдём со мной вниз. Нам обоим нужно закрыть этот журнал.]',
    )
    open(ira_ink_p, 'w', encoding='utf-8').write(ira_ink)

    # 3b. resh: not (in_party("npc_resh"))
    resh_dlg = load_json('dialogues/resh.dlg.json')
    for ch in resh_dlg['nodes'][0]['choices']:
        if ch.get('text') == 'Вставай, мастер. Пойдём закрывать смену вместе.':
            ch['conds'] = [
                {'type': 'flag', 'flag': 'resh_trusts'},
                {'type': 'flag', 'flag': 'resh_joined', 'not': True},
                {'type': 'in_party', 'npc': 'npc_resh', 'not': True},
            ]
    save_json('dialogues/resh.dlg.json', resh_dlg, indent=1)
    resh_ink_p = os.path.join(ROOT, 'dialogues/resh.ink')
    ensure_external(resh_ink_p, 'EXTERNAL in_party(a0)')
    resh_ink = open(resh_ink_p, encoding='utf-8').read()
    resh_ink = resh_ink.replace(
        '* { get_flag("resh_trusts") and not (get_flag("resh_joined")) } [Вставай, мастер. Пойдём закрывать смену вместе.]',
        '* { get_flag("resh_trusts") and not (get_flag("resh_joined")) and not (in_party("npc_resh")) } [Вставай, мастер. Пойдём закрывать смену вместе.]',
    )
    open(resh_ink_p, 'w', encoding='utf-8').write(resh_ink)

    # 3c. kast и zhuk: not (npc_known("npc_resh")) на вопросе «Где мастер?»
    kast_dlg = load_json('dialogues/kast.dlg.json')
    for ch in kast_dlg['nodes'][0]['choices']:
        if ch.get('text') == 'Где мастер Реш?':
            ch['conds'] = [
                {'type': 'flag', 'flag': 'resh_found', 'not': True},
                {'type': 'npc_known', 'entity': 'npc_resh', 'known': False},
            ]
    save_json('dialogues/kast.dlg.json', kast_dlg, indent=1)
    kast_ink_p = os.path.join(ROOT, 'dialogues/kast.ink')
    ensure_external(kast_ink_p, 'EXTERNAL npc_known(a0)')
    kast_ink = open(kast_ink_p, encoding='utf-8').read()
    kast_ink = kast_ink.replace(
        '+ { not (get_flag("resh_found")) } [Где мастер Реш?]',
        '+ { not (get_flag("resh_found")) and not (npc_known("npc_resh")) } [Где мастер Реш?]',
    )
    open(kast_ink_p, 'w', encoding='utf-8').write(kast_ink)

    zhuk_dlg = load_json('dialogues/zhuk.dlg.json')
    for ch in zhuk_dlg['nodes'][0]['choices']:
        if ch.get('text') == 'Где мастер?':
            ch['conds'] = [
                {'type': 'flag', 'flag': 'resh_found', 'not': True},
                {'type': 'npc_known', 'entity': 'npc_resh', 'known': False},
            ]
    save_json('dialogues/zhuk.dlg.json', zhuk_dlg, indent=1)
    zhuk_ink_p = os.path.join(ROOT, 'dialogues/zhuk.ink')
    ensure_external(zhuk_ink_p, 'EXTERNAL npc_known(a0)')
    zhuk_ink = open(zhuk_ink_p, encoding='utf-8').read()
    zhuk_ink = zhuk_ink.replace(
        '* { not (get_flag("resh_found")) } [Где мастер?]',
        '* { not (get_flag("resh_found")) and not (npc_known("npc_resh")) } [Где мастер?]',
    )
    open(zhuk_ink_p, 'w', encoding='utf-8').write(zhuk_ink)

    # 3d. vein: clear_flag("vein_braced") при возврате сердцевины Жиле
    vein_dlg = load_json('dialogues/vein.dlg.json')
    for ch in vein_dlg['nodes'][0]['choices']:
        if ch.get('text') == 'Вложить сердцевину в стену.':
            steps = ch['sections'][0]['steps']
            if not any(
                s.get('kind') == 'effect'
                and s.get('effect', {}).get('type') == 'clear_flag'
                for s in steps
            ):
                steps.insert(-1, {
                    'kind': 'effect',
                    'effect': {'type': 'clear_flag', 'flag': 'vein_braced'},
                })
    save_json('dialogues/vein.dlg.json', vein_dlg, indent=1)
    vein_ink_p = os.path.join(ROOT, 'dialogues/vein.ink')
    ensure_external(vein_ink_p, 'EXTERNAL clear_flag(a0)')
    vein_ink = open(vein_ink_p, encoding='utf-8').read()
    if '~ clear_flag("vein_braced")' not in vein_ink:
        vein_ink = vein_ink.replace(
            '    ~ fire_rule("rule_end_vein")',
            '    ~ clear_flag("vein_braced")\n    ~ fire_rule("rule_end_vein")',
        )
    open(vein_ink_p, 'w', encoding='utf-8').write(vein_ink)

    # 4. Механика цепного бандажа на подъёмнике (item_hoist) в scene_face
    hoist = load_json('entities/item_hoist.json')
    hoist['interact_options'] = [
        hoist['interact_options'][0],
        {
            'label': 'Стянуть шов Жилы цепным бандажом',
            'hint': 'прижать свинцовые накладки к породе цепью подъёмника',
            'sound': 'sfx_brace',
            'conditions': [
                {'type': 'flag_not_set', 'flag': 'vein_braced'},
            ],
            'effects': [
                {
                    'type': 'skill_check_gate',
                    'skill': 'repair',
                    'difficulty': 45,
                    'success_effects': [
                        {'type': 'set_flag', 'flag': 'vein_braced'},
                        {'type': 'grant_xp', 'points': 15},
                        {'type': 'change_need', 'need': 'need_warmth', 'delta': 10},
                        {
                            'type': 'show_message',
                            'text': (
                                'Ты заводишь цепь через направляющий ролик и храповиком '
                                'притягиваешь тяжёлый свинцовый бандаж прямо к расщелине. '
                                'Бирюзовый свет приглушается под металлом, а гул в груди '
                                'становится тише.'
                            ),
                        },
                    ],
                    'fail_effects': [
                        {
                            'type': 'show_message',
                            'text': (
                                'Цепь срывается с зуба храповика, обжигая ладони ржавчиной — '
                                'нужно перехватить рычаг плотнее.'
                            ),
                        },
                    ],
                },
            ],
        },
        {
            'label': 'Ослабить цепной бандаж на Жиле',
            'hint': 'сбросить собачку храповика и освободить расщелину',
            'sound': 'snd_chain',
            'conditions': [
                {'type': 'flag_set', 'flag': 'vein_braced'},
            ],
            'effects': [
                {'type': 'clear_flag', 'flag': 'vein_braced'},
                {
                    'type': 'show_message',
                    'text': (
                        'Ты выбиваешь собачку храповика: барабан с лязгом раскручивается, '
                        'свинцовый бандаж отходит от породы, и трещина снова наливается '
                        'ровным бирюзовым светом.'
                    ),
                },
            ],
        },
    ]
    save_json('entities/item_hoist.json', hoist)

    # 5. Исправление конфликта rule_watchman и rule_watchman_oil в scene_drift
    rw = load_json('rules/rule_watchman.json')
    rw['conditions'] = [
        {'type': 'player_enters_scene', 'scene': 'scene_drift'},
        {'type': 'flag_not_set', 'flag': 'watchman_down'},
        {'type': 'flag_not_set', 'flag': 'watchman_past'},
        {'type': 'not', 'condition': {'type': 'has_item', 'item': 'item_oil'}},
    ]
    save_json('rules/rule_watchman.json', rw)

    rwo = load_json('rules/rule_watchman_oil.json')
    for ef in rwo.get('effects', []):
        if ef.get('type') == 'skill_check_gate':
            f_effs = ef.get('fail_effects', [])
            if not any(x.get('type') == 'fire_rule' for x in f_effs):
                f_effs.append({'type': 'fire_rule', 'rule': 'rule_watchman'})
    save_json('rules/rule_watchman_oil.json', rwo)

    # 6. Исправление цикла двух банок дыхателя (filter_bank_1 -> filter_bank_2 -> filter_exhausted)
    fb1 = load_json('rules/rule_filter_bank1.json')
    fb1['once'] = False
    fb1['trigger'] = 'enter_scene'
    save_json('rules/rule_filter_bank1.json', fb1)

    fb2 = load_json('rules/rule_filter_bank2.json')
    fb2['once'] = False
    fb2['trigger'] = 'enter_scene'
    save_json('rules/rule_filter_bank2.json', fb2)

    fex = {
        'id': 'rule_filter_exhausted',
        'label': 'Дыхатель: вторая банка отработана на подъёме',
        'once': False,
        'manual': False,
        'chapter': 'ch_deep',
        'trigger': 'always',
        'conditions': [
            {'type': 'flag_set', 'flag': 'filter_bank_2'},
            {'type': 'flag_not_set', 'flag': 'filter_exhausted'},
            {
                'type': 'not',
                'condition': {
                    'type': 'player_enters_location',
                    'location': 'loc_deep9',
                },
            },
        ],
        'effects': [
            {'type': 'set_flag', 'flag': 'filter_exhausted'},
        ],
    }
    save_json('rules/rule_filter_exhausted.json', fex)

    man = load_json('manifest.json')
    if 'rule_filter_exhausted.json' not in man.get('rules', []):
        idx = man['rules'].index('rule_filter_bank2.json') + 1
        man['rules'].insert(idx, 'rule_filter_exhausted.json')
    save_json('manifest.json', man)

    fsp = load_json('rules/rule_filter_spent.json')
    fsp['once'] = False
    fsp['trigger'] = 'enter_scene'
    fsp['conditions'] = [
        {'type': 'player_enters_location', 'location': 'loc_deep9'},
        {'type': 'equipped', 'item': 'item_filter'},
        {'type': 'flag_set', 'flag': 'filter_exhausted'},
        {
            'type': 'not',
            'condition': {
                'type': 'has_status',
                'status': 'status_filter_spent',
            },
        },
    ]
    save_json('rules/rule_filter_spent.json', fsp)

    bench = load_json('entities/item_bench.json')
    for opt in bench.get('interact_options', []):
        if opt.get('label') == 'Сменить банки в дыхателе':
            effs = opt.get('effects', [])
            if not any(
                e.get('type') == 'clear_flag' and e.get('flag') == 'filter_exhausted'
                for e in effs
            ):
                effs.insert(5, {'type': 'clear_flag', 'flag': 'filter_exhausted'})
    save_json('entities/item_bench.json', bench)

    print('КОНТЕНТ 25')
    print('  campaign.id = b7305faa-8e10-4d26-96bb-f1b5ed5e493f, ui_labels для narrative_intro')
    print('  привязаны 10 озвученных авторских ремарок (36/39 = 92,3 %, осталось 3 в zhuk)')
    print('  внедрены in_party, npc_known, clear_flag (eeb2764) и механика бандажа Жилы на item_hoist')
    print('  исправлены 2 балансных бага 9-го яруса (rule_watchman_oil и цикл банок дыхателя)')


if __name__ == '__main__':
    main()
