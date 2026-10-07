#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""Ход 22: озвучка вступительных авторских ремарок (`# action`) голосом
рассказчика (`voice-00`) во всех десяти диалогах и связка `learn_name`
по наводкам персонажей.

1. Все десять диалогов открываются авторской ремаркой (`action: true`).
   Теперь все десять вступительных ремарок озвучены голосом рассказчика
   (`assets/voice/narr_<dlg>_1.mp3`) — и в `.dlg.json`, и в `.ink`.
   Из 38 ремарок кампании озвучены 10 (осталось 28 на следующие ходы).
2. Связка механики «Незнакомец» (`unknown_label` / `learn_name`) с
   разговорами:
   - вопрос Дожу «Ищу Жука» сразу раскрывает имя человека у жаровни
     (`learn_name("npc_zhuk")`);
   - показ рукавицы Ире («у Айлы так штопают…») сразу раскрывает имя
     женщины с бинтами в Сухом ряду (`learn_name("npc_ayla")`).

Скрипт идемпотентен.
"""
import json
import os
import re

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))

OPENING_REMARKS = {
    'ayla': ('Айла промокает бинт и не смотрит на твои руки.', 'assets/voice/narr_ayla_1.mp3'),
    'dozh': ('Дож что-то взвешивает на ладони и прячет в рукав, не глядя.', 'assets/voice/narr_dozh_1.mp3'),
    'ira': ('Ира стирает мазут с ладоней ветошью и смотрит на тебя исподлобья.', 'assets/voice/narr_ira_1.mp3'),
    'kast': ('Каст не поднимает головы от бумаг.', 'assets/voice/narr_kast_1.mp3'),
    'kell': ('Келл не встаёт. Он просто кладёт руку на рукоять клинка.', 'assets/voice/narr_kell_1.mp3'),
    'registrar': ('Регистратор щёлкает реле: два стеклянных глаза разгораются бирюзой.', 'assets/voice/narr_registrar_1.mp3'),
    'resh': ('Реш сидит спиной к стене и смотрит не на тебя — в стену.', 'assets/voice/narr_resh_1.mp3'),
    'vein': ('Стена светится ровно, как бирюза под водой. Звук идёт не из породы — из груди.', 'assets/voice/narr_vein_1.mp3'),
    'vex': ('Векс поднимает глаза от пульта и долго смотрит на твой жетон.', 'assets/voice/narr_vex_1.mp3'),
    'zhuk': ('Жук не здоровается. Он просто ждёт, сколько ты заплатишь.', 'assets/voice/narr_zhuk_1.mp3'),
}


def load_json(rel):
    with open(os.path.join(ROOT, rel), encoding='utf-8') as f:
        return json.load(f)


def save_json(rel, data, indent=1):
    with open(os.path.join(ROOT, rel), 'w', encoding='utf-8') as f:
        json.dump(data, f, ensure_ascii=False, indent=indent)
        f.write('\n')


def main():
    voiced_now = 0
    for name, (prefix, voice_rel) in OPENING_REMARKS.items():
        dlg_rel = f'dialogues/{name}.dlg.json'
        dlg = load_json(dlg_rel)
        for st in dlg['nodes'][0]['sections'][0]['steps']:
            if st.get('kind') == 'line' and st['line'].get('action'):
                if st['line'].get('text', '').startswith(prefix[:25]):
                    st['line']['voice'] = voice_rel
                    voiced_now += 1
        save_json(dlg_rel, dlg)

        ink_path = os.path.join(ROOT, f'dialogues/{name}.ink')
        lines = open(ink_path, encoding='utf-8').read().split('\n')
        for i, line in enumerate(lines):
            if line.strip().startswith(prefix[:25]) and '# action' in line:
                if '# voice:' not in line:
                    lines[i] = line + f' # voice: {voice_rel}'
                break
        open(ink_path, 'w', encoding='utf-8').write('\n'.join(lines))

    # Наводка Дожа на Жука -> learn_name("npc_zhuk")
    dozh = load_json('dialogues/dozh.dlg.json')
    for ch in dozh['nodes'][0]['choices']:
        if ch.get('text') == 'Ищу Жука.':
            steps = ch['sections'][0]['steps']
            if not any(
                s.get('kind') == 'effect'
                and s.get('effect', {}).get('type') == 'learn_name'
                for s in steps
            ):
                steps.append({
                    'kind': 'effect',
                    'effect': {'type': 'learn_name', 'entity': 'npc_zhuk'},
                })
    save_json('dialogues/dozh.dlg.json', dozh)

    dozh_ink_path = os.path.join(ROOT, 'dialogues/dozh.ink')
    dozh_ink = open(dozh_ink_path, encoding='utf-8').read()
    if '~ learn_name("npc_zhuk")' not in dozh_ink:
        dozh_ink = dozh_ink.replace(
            '    ~ change_disposition("npc_zhuk", 8)\n',
            '    ~ change_disposition("npc_zhuk", 8)\n    ~ learn_name("npc_zhuk")\n',
            1,
        )
        open(dozh_ink_path, 'w', encoding='utf-8').write(dozh_ink)

    # Наводка Иры на Айлу по заплате на рукавице -> learn_name("npc_ayla")
    ira = load_json('dialogues/ira.dlg.json')
    for ch in ira['nodes'][0]['choices']:
        if ch.get('text') == 'Показать рукавицу с привода.':
            steps = ch['sections'][0]['steps']
            if not any(
                s.get('kind') == 'effect'
                and s.get('effect', {}).get('type') == 'learn_name'
                for s in steps
            ):
                steps.append({
                    'kind': 'effect',
                    'effect': {'type': 'learn_name', 'entity': 'npc_ayla'},
                })
    save_json('dialogues/ira.dlg.json', ira)

    ira_ink_path = os.path.join(ROOT, 'dialogues/ira.ink')
    ira_ink = open(ira_ink_path, encoding='utf-8').read()
    if '~ learn_name("npc_ayla")' not in ira_ink:
        ira_ink = ira_ink.replace(
            '    ~ change_disposition("npc_ira", 4)\n',
            '    ~ change_disposition("npc_ira", 4)\n    ~ learn_name("npc_ayla")\n',
            1,
        )
        open(ira_ink_path, 'w', encoding='utf-8').write(ira_ink)

    print('КОНТЕНТ 22')
    print('  озвучено вступительных ремарок рассказчиком:', voiced_now)
    print('  добавлены связки learn_name по наводкам Дожа (Жук) и Иры (Айла)')


if __name__ == '__main__':
    main()
