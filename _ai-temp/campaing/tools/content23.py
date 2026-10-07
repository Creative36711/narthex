#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""Ход 23: озвучка 10 авторских ремарок (`# action`) в диалогах Дожа и Иры
(`narr_dozh_2..4.mp3`, `narr_ira_2..8.mp3`, голос рассказчика `voice-00`) и
исправление логических дыр в диалогах.

1. Озвучены все оставшиеся авторские ремарки в `dozh` (3 шт.) и `ira` (7 шт.) —
   теперь диалоги `ayla`, `dozh`, `ira` и `registrar` озвучены на 100 %
   включая все ремарки рассказчика (всего по кампании озвучено 20/38 ремарок).
2. `dozh.ink` / `dozh.dlg.json`: вопрос «Ищу Жука.» переименован в
   «Кто там сидит у жаровни?», чтобы дознаватель не называл информатора по
   кличке до того, как узнает её от Дожа (`learn_name("npc_zhuk")`).
3. `ira.ink` / `ira.dlg.json`:
   - исправлен узел-ловушка `Брат` (`Брат_hub`), где все три ответа имели
     `goto: "stay"` (`-> Брат_hub`) без выхода и позволяли бесконечно фармить
     `+12` отношения Иры: теперь все три ответа одноразовые (`once: true` / `*`)
     и возвращают в основной узел `Начало` (`-> Начало_hub`);
   - одноразовыми (`once: true` / `*`) сделаны ветки «Расскажи, что случилось в
     ночь тринадцатого.», «Твой брат — Стась Яров?» и «Показать рукавицу с
     привода.», а к вопросу «Где ключ от его каморки?» добавлено условие
     отсутствия ключа и закрытой двери (`not has_item("item_key_resh") and
     not get_flag("resh_room_open")`).
4. `resh.ink` / `resh.dlg.json`: приглашение в отряд «Пойдём со мной.»
   защищено условием `not get_flag("resh_joined")`, сделан одноразовым (`*`) и
   выставляет флаг `resh_joined` (вместе с `Отдай сердцевину.`).
5. `vex.ink` / `kell.ink` и их `.dlg.json`: проверки навыка и показ рукавицы,
   меняющие отношение, переведены в одноразовые (`once: true` / `*`).

Скрипт идемпотентен.
"""
import json
import os
import re

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))

REMARKS_23 = [
    ('dozh', 'Дож спокойно ждёт: он умеет торговать и молча.', 'assets/voice/narr_dozh_2.mp3'),
    ('dozh', 'Дож вертит вещь двумя пальцами, прищурившись.', 'assets/voice/narr_dozh_3.mp3'),
    ('dozh', 'Дож разводит руками: пусто.', 'assets/voice/narr_dozh_4.mp3'),
    ('ira', 'Она вытирает ладони о штаны. Полотно всё равно чёрное.', 'assets/voice/narr_ira_2.mp3'),
    ('ira', 'Она замирает. Ветошь падает на пол.', 'assets/voice/narr_ira_3.mp3'),
    ('ira', 'Она берёт жетон двумя руками, как воду.', 'assets/voice/narr_ira_4.mp3'),
    ('ira', 'Она кивает раньше, чем ты договорил.', 'assets/voice/narr_ira_5.mp3'),
    ('ira', 'Она берёт рукавицу за манжет двумя пальцами, как чужую вещь.', 'assets/voice/narr_ira_6.mp3'),
    ('ira', 'Она поднимает ветошь, но не вытирает руки.', 'assets/voice/narr_ira_7.mp3'),
    ('ira', 'Ты молчишь. Она ждёт — и поднимает ветошь с пола.', 'assets/voice/narr_ira_8.mp3'),
]


def load_json(rel):
    with open(os.path.join(ROOT, rel), encoding='utf-8') as f:
        return json.load(f)


def save_json(rel, data, indent=1):
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


def main():
    # 1. Привязка 10 озвученных ремарок в dozh и ira
    for name in ('dozh', 'ira'):
        dlg_rel = f'dialogues/{name}.dlg.json'
        dlg = load_json(dlg_rel)
        items = [(txt, v) for n, txt, v in REMARKS_23 if n == name]
        for node in dlg['nodes']:
            for sec in all_sections(node):
                for st in sec.get('steps', []):
                    if st.get('kind') == 'line' and st['line'].get('action'):
                        for txt, v in items:
                            if st['line'].get('text') == txt:
                                st['line']['voice'] = v
        save_json(dlg_rel, dlg)

        ink_path = os.path.join(ROOT, f'dialogues/{name}.ink')
        lines = open(ink_path, encoding='utf-8').read().split('\n')
        for i, line in enumerate(lines):
            for txt, v in items:
                if line.strip().startswith(txt) and '# action' in line:
                    if '# voice:' not in line:
                        lines[i] = line + f' # voice: {v}'
        open(ink_path, 'w', encoding='utf-8').write('\n'.join(lines))

    # 2. Дож: «Ищу Жука.» -> «Кто там сидит у жаровни?»
    dozh = load_json('dialogues/dozh.dlg.json')
    for ch in dozh['nodes'][0]['choices']:
        if ch.get('text') in ('Ищу Жука.', 'Кто там сидит у жаровни?'):
            ch['text'] = 'Кто там сидит у жаровни?'
            ch['once'] = True
    save_json('dialogues/dozh.dlg.json', dozh)

    dozh_ink_p = os.path.join(ROOT, 'dialogues/dozh.ink')
    dozh_ink = open(dozh_ink_p, encoding='utf-8').read()
    dozh_ink = dozh_ink.replace('* [Ищу Жука.]', '* [Кто там сидит у жаровни?]')
    open(dozh_ink_p, 'w', encoding='utf-8').write(dozh_ink)

    # 3. Ира: исправление узла-ловушки Брат и одноразовых веток
    ira = load_json('dialogues/ira.dlg.json')
    for n in ira['nodes']:
        if n['id'] == 'Начало':
            for ch in n.get('choices', []):
                t = ch.get('text', '')
                if t in (
                    'Расскажи, что случилось в ночь тринадцатого.',
                    'Твой брат — Стась Яров?',
                    'Показать рукавицу с привода.',
                ):
                    ch['once'] = True
                elif t == 'Где ключ от его каморки?':
                    ch['once'] = True
                    ch['conds'] = [
                        {'type': 'has_item', 'item': 'item_key_resh', 'not': True},
                        {'type': 'flag', 'flag': 'resh_room_open', 'not': True},
                    ]
        elif n['id'] == 'Брат':
            for ch in n.get('choices', []):
                ch['once'] = True
                ch['goto'] = 'Начало'
    save_json('dialogues/ira.dlg.json', ira)

    ira_ink_p = os.path.join(ROOT, 'dialogues/ira.ink')
    ira_ink = open(ira_ink_p, encoding='utf-8').read()
    ira_ink = ira_ink.replace(
        '+ [Расскажи, что случилось в ночь тринадцатого.]',
        '* [Расскажи, что случилось в ночь тринадцатого.]',
    )
    ira_ink = ira_ink.replace(
        '+ [Где ключ от его каморки?]',
        '* { not (has_item("item_key_resh")) and not (get_flag("resh_room_open")) } [Где ключ от его каморки?]',
    )
    ira_ink = ira_ink.replace(
        '+ { get_flag("clue_guard") and not (get_flag("body_returned")) } [Твой брат — Стась Яров?]',
        '* { get_flag("clue_guard") and not (get_flag("body_returned")) } [Твой брат — Стась Яров?]',
    )
    ira_ink = ira_ink.replace(
        '+ { has_item("item_glove") } [Показать рукавицу с привода.]',
        '* { has_item("item_glove") } [Показать рукавицу с привода.]',
    )
    # В узле Брат_hub: + -> * и -> Брат_hub -> -> Начало_hub
    if '=== Брат_hub ===' in ira_ink:
        head, tail = ira_ink.split('=== Брат_hub ===', 1)
        brat_part, rest = tail.split('=== Молчание ===', 1)
        brat_part = brat_part.replace('\n+ [', '\n* [').replace('-> Брат_hub', '-> Начало_hub')
        ira_ink = head + '=== Брат_hub ===' + brat_part + '=== Молчание ===' + rest
    open(ira_ink_p, 'w', encoding='utf-8').write(ira_ink)

    # 4. Реш: защита «Пойдём со мной.» флагом resh_joined и одноразовый «Отдай сердцевину.»
    resh = load_json('dialogues/resh.dlg.json')
    for ch in resh['nodes'][0]['choices']:
        if ch.get('text') == 'Отдай сердцевину.':
            ch['once'] = True
        elif ch.get('text') == 'Пойдём со мной.':
            ch['once'] = True
            ch['conds'] = [
                {'type': 'flag', 'flag': 'resh_trusts'},
                {'type': 'flag', 'flag': 'resh_joined', 'not': True},
            ]
            steps = ch['sections'][0]['steps']
            if not any(
                s.get('kind') == 'effect'
                and s.get('effect', {}).get('type') == 'set_flag'
                and s.get('effect', {}).get('flag') == 'resh_joined'
                for s in steps
            ):
                steps.append({
                    'kind': 'effect',
                    'effect': {'type': 'set_flag', 'flag': 'resh_joined'},
                })
    save_json('dialogues/resh.dlg.json', resh)

    resh_ink_p = os.path.join(ROOT, 'dialogues/resh.ink')
    resh_ink = open(resh_ink_p, encoding='utf-8').read()
    resh_ink = resh_ink.replace(
        '+ { not (has_item("item_core")) and not (has_item("item_key_cache")) } [Отдай сердцевину.]',
        '* { not (has_item("item_core")) and not (has_item("item_key_cache")) } [Отдай сердцевину.]',
    )
    resh_ink = resh_ink.replace(
        '+ { get_flag("resh_trusts") } [Пойдём со мной.]',
        '* { get_flag("resh_trusts") and not (get_flag("resh_joined")) } [Пойдём со мной.]',
    )
    if '~ set_flag("resh_joined")' not in resh_ink:
        resh_ink = resh_ink.replace(
            '    ~ join_party("npc_resh")\n',
            '    ~ join_party("npc_resh")\n    ~ set_flag("resh_joined")\n',
            1,
        )
    open(resh_ink_p, 'w', encoding='utf-8').write(resh_ink)

    # 5. Векс и Келл: одноразовые проверки навыка и показ рукавицы
    vex = load_json('dialogues/vex.dlg.json')
    for ch in vex['nodes'][0]['choices']:
        if ch.get('text') == 'Кто проходил через шлюз в ночь тринадцатого?':
            ch['once'] = True
    save_json('dialogues/vex.dlg.json', vex)
    vex_ink_p = os.path.join(ROOT, 'dialogues/vex.ink')
    vex_ink = open(vex_ink_p, encoding='utf-8').read()
    vex_ink = vex_ink.replace(
        '+ [Кто проходил через шлюз в ночь тринадцатого?]',
        '* [Кто проходил через шлюз в ночь тринадцатого?]',
    )
    open(vex_ink_p, 'w', encoding='utf-8').write(vex_ink)

    kell = load_json('dialogues/kell.dlg.json')
    for ch in kell['nodes'][0]['choices']:
        if ch.get('text') in (
            'Где ты был в ночь тринадцатого?',
            'Ты убил стража Ярова.',
            'Показать рукавицу с привода.',
        ):
            ch['once'] = True
    save_json('dialogues/kell.dlg.json', kell)
    kell_ink_p = os.path.join(ROOT, 'dialogues/kell.ink')
    kell_ink = open(kell_ink_p, encoding='utf-8').read()
    kell_ink = kell_ink.replace(
        '+ [Где ты был в ночь тринадцатого?]',
        '* [Где ты был в ночь тринадцатого?]',
    )
    kell_ink = kell_ink.replace(
        '+ { get_flag("clue_guard") } [Ты убил стража Ярова.]',
        '* { get_flag("clue_guard") } [Ты убил стража Ярова.]',
    )
    kell_ink = kell_ink.replace(
        '+ { has_item("item_glove") } [Показать рукавицу с привода.]',
        '* { has_item("item_glove") } [Показать рукавицу с привода.]',
    )
    open(kell_ink_p, 'w', encoding='utf-8').write(kell_ink)

    print('КОНТЕНТ 23')
    print('  озвучено 10 ремарок в dozh (3) и ira (7) -> всего 20/38 ремарок')
    print('  исправлены узел-ловушка Брат у Иры, вопрос Дожу про жаровню и одноразовые проверки в диалогах')


if __name__ == '__main__':
    main()
