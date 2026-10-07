#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""Ход 24: исправление текстовых и сюжетных несостыковок в диалогах с заменой
озвучки (`kell_5`, `kell_9`, `vex_1`, `zhuk_12` + `narr_zhuk_5`), привязка
5 озвученных ремарок в `kast` (`narr_kast_2..6`) и починка порядка веток.

1. Заменены 4 spoken-реплики с несостыковками:
   - `kell_5.mp3` (`voice-05`): Келл больше не говорит «Я три дня носил его
     жетон в кармане», когда этот жетон дознаватель снял с руки погибшего
     Ярова у затвора и сам протягивает Келлу. Теперь: «Яров. Значит, вода
     сошла у затвора, и ты нашёл его у решётки. Я три дня не смел зайти к
     его сестре.» Синхронизированы `quests/quest_missing.json` (`j_token`) и
     описание `entities/item_dead_guard.json`;
   - `kell_9.mp3` (`voice-05`): Келл больше не обращается к дознавателю
     «старшина» (старшина — сам Келл). Теперь: «Первую подпись ты уже видел.
     Старшина — это только руки, дознаватель. Бумагу подписывают не руки.»;
   - `vex_1.mp3` (`voice-01`): Векс у Верхнего шлюза больше не говорит
     «Спускайся, там тепло» (спуск ведёт в ледяную шахту, а тёплая контора
     с печкой — за боковой дверью на том же ярусе). Теперь: «Приписной
     дознаватель? Проходи в контору за дверью, там печка топится. Здесь у
     затвора только сквозняк и чужие.»;
   - `zhuk_12.mp3` (`voice-06`) + новая ремарка `narr_zhuk_5.mp3` (`voice-00`):
     из прямой речи Жука вынесена склеенная авторская ремарка от третьего
     лица («Жук кривится, но рук не прячет») в отдельную строку `# action`,
     а также исправлена путаница между каморкой с койкой (7-й ярус) и плитой
     в штольне (9-й ярус).
2. В `kast.ink` / `kast.dlg.json` привязаны 5 озвученных авторских ремарок
   (`narr_kast_2..6.mp3`, голос рассказчика `voice-00`). Всего в кампании
   теперь 39 авторских ремарок, из них озвучены 26 (68 %, осталось 13).
3. Исправлен порядок веток в диалогах Иры, Каст и Жука и спойлер дела №136
   в `narrative_intro` сцены архива.

Скрипт идемпотентен.
"""
import json
import os

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))


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
    # 0. Флаг ira_told_brother в campaign.json
    camp = load_json('campaign.json')
    fmap = {f['id']: f for f in camp.get('flags', [])}
    if 'ira_told_brother' not in fmap:
        camp['flags'].append({
            'id': 'ira_told_brother',
            'label': 'Ире рассказали о находке у затвора',
            'description': 'Дознаватель поговорил с Ирой о судьбе её брата Стася Ярова.',
        })
    save_json('campaign.json', camp, indent=2)

    # 1. Келл: kell_5 и kell_9 + quest_missing + item_dead_guard
    NEW_KELL_5 = 'Яров. Значит, вода сошла у затвора, и ты нашёл его у решётки. Я три дня не смел зайти к его сестре.'
    NEW_KELL_9 = 'Первую подпись ты уже видел. Старшина — это только руки, дознаватель. Бумагу подписывают не руки.'

    kell = load_json('dialogues/kell.dlg.json')
    for n in kell['nodes']:
        for sec in all_sections(n):
            for st in sec.get('steps', []):
                if st.get('kind') == 'line':
                    v = st['line'].get('voice')
                    if v == 'assets/voice/kell_5.mp3':
                        st['line']['text'] = NEW_KELL_5
                    elif v == 'assets/voice/kell_9.mp3':
                        st['line']['text'] = NEW_KELL_9
    save_json('dialogues/kell.dlg.json', kell)

    kell_ink_p = os.path.join(ROOT, 'dialogues/kell.ink')
    kell_ink = open(kell_ink_p, encoding='utf-8').read()
    kell_ink = kell_ink.replace(
        'Яров. Я три дня носил его жетон в кармане и так и не зашёл к сестре.',
        NEW_KELL_5,
    )
    kell_ink = kell_ink.replace(
        'Первую ты уже видел. Я — руки, старшина. Бумагу подписывают не руки.',
        NEW_KELL_9,
    )
    open(kell_ink_p, 'w', encoding='utf-8').write(kell_ink)

    qm = load_json('quests/quest_missing.json')
    qm['journal_entries']['j_token'] = (
        'Келл Ястреб узнал жетон с тела у затвора: он три дня не решался '
        'зайти к сестре Ярова. Он стоял у затвора и не открыл.'
    )
    save_json('quests/quest_missing.json', qm, indent=2)

    dg = load_json('entities/item_dead_guard.json')
    dg['description'] = (
        'Страж Надзора лицом в воду у решётки затвора. В сведённых пальцах '
        'зажата сорванная цепочка.'
    )
    save_json('entities/item_dead_guard.json', dg, indent=2)

    # 2. Векс: vex_1
    NEW_VEX_1 = 'Приписной дознаватель? Проходи в контору за дверью, там печка топится. Здесь у затвора только сквозняк и чужие.'
    vex = load_json('dialogues/vex.dlg.json')
    for st in vex['nodes'][0]['sections'][0]['steps']:
        if st.get('kind') == 'line' and st['line'].get('voice') == 'assets/voice/vex_1.mp3':
            st['line']['text'] = NEW_VEX_1
    save_json('dialogues/vex.dlg.json', vex)

    vex_ink_p = os.path.join(ROOT, 'dialogues/vex.ink')
    vex_ink = open(vex_ink_p, encoding='utf-8').read()
    vex_ink = vex_ink.replace(
        'Ты из конторы? Спускайся, там тепло. Здесь только сквозняк и чужие.',
        NEW_VEX_1,
    )
    open(vex_ink_p, 'w', encoding='utf-8').write(vex_ink)

    # 3. Жук: вынос ремарки narr_zhuk_5 из zhuk_12 + условия веток
    NEW_ZHUK_REMARK = 'Жук кривится, но ладоней со стола не убирает.'
    NEW_ZHUK_12 = (
        'Тогда слушай другое. Гроссбух Реш не в конторе держал и не в каморке: '
        'он его в штольне девятого яруса спрятал, под чугунной плитой у старой крепи.'
    )
    zhuk = load_json('dialogues/zhuk.dlg.json')
    for ch in zhuk['nodes'][0]['choices']:
        t = ch.get('text', '')
        if t == 'Что ты видел в ночь тринадцатого?':
            ch['once'] = True
            ch['conds'] = [{'type': 'flag', 'flag': 'zhuk_paid', 'not': True}]
        elif t == 'Где мастер?':
            ch['once'] = True
            ch['conds'] = [{'type': 'flag', 'flag': 'resh_found', 'not': True}]
        elif t == 'Ты и сам знаешь, кто стоял. Что ещё?':
            ch['sections'][0]['steps'] = [
                {
                    'kind': 'line',
                    'line': {
                        'text': NEW_ZHUK_REMARK,
                        'action': True,
                        'voice': 'assets/voice/narr_zhuk_5.mp3',
                    },
                },
                {
                    'kind': 'line',
                    'line': {
                        'text': NEW_ZHUK_12,
                        'emotion': 'thoughtful',
                        'voice': 'assets/voice/zhuk_12.mp3',
                    },
                },
                {
                    'kind': 'effect',
                    'effect': {'type': 'set_flag', 'flag': 'zhuk_cache_hint'},
                },
            ]
    save_json('dialogues/zhuk.dlg.json', zhuk)

    zhuk_ink_p = os.path.join(ROOT, 'dialogues/zhuk.ink')
    zhuk_ink = open(zhuk_ink_p, encoding='utf-8').read()
    zhuk_ink = zhuk_ink.replace(
        '+ [Что ты видел в ночь тринадцатого?]',
        '* { not (get_flag("zhuk_paid")) } [Что ты видел в ночь тринадцатого?]',
    )
    zhuk_ink = zhuk_ink.replace(
        '* [Где мастер?]',
        '* { not (get_flag("resh_found")) } [Где мастер?]',
    )
    old_zhuk_line = (
        '    Жук кривится, но рук не прячет: тогда слушай другое. Гроссбух он не в конторе '
        'держал и не в каморке: он его в штольне спрятал, там, где спал, под плитой. '
        'Ищи, где у мастера была постель. # emotion: thoughtful # voice: assets/voice/zhuk_12.mp3'
    )
    new_zhuk_lines = (
        f'    {NEW_ZHUK_REMARK} # action # voice: assets/voice/narr_zhuk_5.mp3\n'
        f'    {NEW_ZHUK_12} # emotion: thoughtful # voice: assets/voice/zhuk_12.mp3'
    )
    zhuk_ink = zhuk_ink.replace(old_zhuk_line, new_zhuk_lines)
    open(zhuk_ink_p, 'w', encoding='utf-8').write(zhuk_ink)

    # 4. Каст: 5 озвученных ремарок narr_kast_2..6 и условие «Где мастер Реш?»
    KAST_REMARKS = [
        ('Она наконец поднимает глаза. Улыбка есть, тепла нет.', 'assets/voice/narr_kast_2.mp3'),
        ('Она смотрит на нитку дольше, чем на сами листы.', 'assets/voice/narr_kast_3.mp3'),
        ('Она листает книгу быстро, почти не глядя — как человек, который знает, что там написано.', 'assets/voice/narr_kast_4.mp3'),
        ('Молчание длится ровно столько, сколько нужно, чтобы его записали.', 'assets/voice/narr_kast_5.mp3'),
        ('Каст читает, не беря бумагу в руки: только глазами по строчке, туда и обратно.', 'assets/voice/narr_kast_6.mp3'),
    ]
    kast = load_json('dialogues/kast.dlg.json')
    for n in kast['nodes']:
        if n['id'] == 'Начало':
            for ch in n.get('choices', []):
                if ch.get('text') == 'Где мастер Реш?':
                    ch['conds'] = [{'type': 'flag', 'flag': 'resh_found', 'not': True}]
        for sec in all_sections(n):
            for st in sec.get('steps', []):
                if st.get('kind') == 'line' and st['line'].get('action'):
                    for txt, v in KAST_REMARKS:
                        if st['line'].get('text') == txt:
                            st['line']['voice'] = v
                            st['line'].pop('timer', None)
    save_json('dialogues/kast.dlg.json', kast)

    kast_ink_p = os.path.join(ROOT, 'dialogues/kast.ink')
    kast_ink = open(kast_ink_p, encoding='utf-8').read()
    kast_ink = kast_ink.replace(
        '+ [Где мастер Реш?]',
        '+ { not (get_flag("resh_found")) } [Где мастер Реш?]',
    )
    kast_ink = kast_ink.replace('# timer: 4 # action', '# action')
    klines = kast_ink.split('\n')
    for i, line in enumerate(klines):
        for txt, v in KAST_REMARKS:
            if line.strip().startswith(txt) and '# action' in line:
                if '# voice:' not in line:
                    klines[i] = line + f' # voice: {v}'
    open(kast_ink_p, 'w', encoding='utf-8').write('\n'.join(klines))

    # 5. Ира: последовательность разговора о брате и передачи жетона
    ira = load_json('dialogues/ira.dlg.json')
    for n in ira['nodes']:
        if n['id'] == 'Начало':
            for ch in n.get('choices', []):
                if ch.get('text') == 'Твой брат — Стась Яров?':
                    ch['conds'] = [
                        {'type': 'flag', 'flag': 'clue_guard'},
                        {'type': 'flag', 'flag': 'ira_told_brother', 'not': True},
                    ]
                elif ch.get('text') == 'Я нашёл его жетон.':
                    ch['once'] = True
                    ch['conds'] = [
                        {'type': 'has_item', 'item': 'item_guard_token'},
                        {'type': 'flag', 'flag': 'ira_told_brother'},
                    ]
        elif n['id'] == 'Брат':
            steps = n['sections'][0]['steps']
            if not any(
                s.get('kind') == 'effect'
                and s.get('effect', {}).get('flag') == 'ira_told_brother'
                for s in steps
            ):
                steps.append({
                    'kind': 'effect',
                    'effect': {'type': 'set_flag', 'flag': 'ira_told_brother'},
                })
    save_json('dialogues/ira.dlg.json', ira)

    ira_ink_p = os.path.join(ROOT, 'dialogues/ira.ink')
    ira_ink = open(ira_ink_p, encoding='utf-8').read()
    if 'EXTERNAL set_flag(a0)' not in ira_ink:
        ira_ink = 'EXTERNAL set_flag(a0)\n' + ira_ink
    ira_ink = ira_ink.replace(
        '* { get_flag("clue_guard") and not (get_flag("body_returned")) } [Твой брат — Стась Яров?]',
        '* { get_flag("clue_guard") and not (get_flag("ira_told_brother")) } [Твой брат — Стась Яров?]',
    )
    ira_ink = ira_ink.replace(
        '+ { has_item("item_guard_token") } [Я нашёл его жетон.]',
        '* { has_item("item_guard_token") and get_flag("ira_told_brother") } [Я нашёл его жетон.]',
    )
    if '~ set_flag("ira_told_brother")' not in ira_ink:
        ira_ink = ira_ink.replace(
            '-> Брат_hub\n',
            '~ set_flag("ira_told_brother")\n-> Брат_hub\n',
            1,
        )
    open(ira_ink_p, 'w', encoding='utf-8').write(ira_ink)

    # 6. Архив: убрать преждевременный спойлер дела №136 из narrative_intro
    arch = load_json('scenes/scene_archive.json')
    arch['narrative_intro'] = [
        'В архиве своя погода: пыль, лампа под зелёным стеклом и шелест бумаги, которой сто лет.',
        'Зелёные абажуры качаются от тяги из вентиляции, а полки пахнут сургучом и старой пылью.',
    ]
    save_json('scenes/scene_archive.json', arch, indent=2)

    print('КОНТЕНТ 24')
    print('  заменены 4 spoken-реплики с несостыковками (kell_5, kell_9, vex_1, zhuk_12)')
    print('  привязаны 6 новых ремарок (narr_zhuk_5 + narr_kast_2..6) -> 26/39 ремарок озвучено')
    print('  исправлены условия веток в ira, kast, zhuk и narrative_intro архива')


if __name__ == '__main__':
    main()
