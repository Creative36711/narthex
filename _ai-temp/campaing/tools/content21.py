#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""Ход 21: аудит диалогов, десять новых озвучек, запись кодекса про дыхатель
и починка цепочки банок на девятом ярусе.

Что делает скрипт:

1. **Закрывает последние три неозвученные реплики кампании** (`ira_17`,
   `kell_14`, `kell_15`): теперь 100 % spoken-реплик во всех десяти
   диалогах имеют живую озвучку.
2. **Исправляет сюжетно-логические огрехи вступления диалогов** (аудит):
   - у Айлы `ayla_10` («Заплату на рукавице я узнаю…») стояла в безусловном
     приветствии до того, как герой вообще нашёл рукавицу, — перенесена
     в выбор `+ { has_item("item_glove") } [Показать Айле рукавицу с привода.]`;
     а `ayla_9` («Если пойдёшь на девятый, возьми мой настой…») перенесена
     в выбор `[Научи готовить настой.]`;
   - у Реша `resh_14` («Муфту резали ключом на пятьдесят два, в перчатках…»)
     стояла в приветствии раньше вопроса `[Кто срезал муфту?]` — перенесена
     в ответ на этот вопрос;
   - у Векса `vex_11` и `vex_12` про воду и уголь восьмого яруса перенесены
     из приветствия в ответ на `[Как спуститься к помпе?]`;
   - у Дожа `dozh_14` («Уголь — три марки штука…») перенесена из покупки
     дыхателя в ответ на `[Почему у тебя всё дороже, чем наверху?]`.
3. **Добавляет пять новых условных веток диалогов (семь новых дорожек)**:
   - Каст (`kast_16`, `kast_17`) — реакция на караульную рукавицу с привода;
   - Жук (`zhuk_13`, `zhuk_14`) — опознаёт партию рукавиц седьмого яруса и
     отправляет с заплатой в Сухой ряд;
   - Реш (`resh_15`) — почему первая банка садится в штольне, а вторая у забоя;
   - Айла (`ayla_11`) — чем забиваются банки и почему их меняют на верстаке;
   - Регистратор (`registrar_10`) — ставит входящий штамп на сшитое дело №137.
4. **Чинит четыре выбора `~ present_item(...)` в `.ink`** (`kast`, `kell`,
   `zhuk`, `dozh`), добавляя `-> DONE`, чтобы inkjs не проваливался в следующий
   выбор до ответа окна предъявления предмета.
5. **Добавляет запись кодекса `codex_filter` («Дыхатель и две банки»)** и
   действие на верстаке (`item_bench`) «Сменить банки в дыхателе» (уголь +
   тряпьё + 1 час → сбрасывает `filter_bank_1`/`filter_bank_2` и снимает
   `status_filter_spent`).
6. **Чинит цепочку правил дыхателя** (`rule_filter_bank1`, `rule_filter_bank2`,
   `rule_filter_spent`): раньше все три висели на `player_enters_location:
   loc_deep9` и срабатывали каскадом в один и тот же первый вход. Теперь
   первая банка уходит на входе в `loc_deep9`, вторая — у слепого забоя
   (`scene_face`), а `rule_filter_spent` (`once: true`) срабатывает только
   при повторном спуске с выработанными банками. Заодно `rule_clue_check`
   получает `once: true`, а `rule_water_rises` не спамит при активном
   `status_wading`.

Скрипт идемпотентен.
"""
import json
import os
import re

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))


def load_json(rel):
    with open(os.path.join(ROOT, rel), encoding='utf-8') as f:
        return json.load(f)


def save_json(rel, data, indent=2):
    with open(os.path.join(ROOT, rel), 'w', encoding='utf-8') as f:
        json.dump(data, f, ensure_ascii=False, indent=indent)
        f.write('\n')


def load_text(rel):
    with open(os.path.join(ROOT, rel), encoding='utf-8') as f:
        return f.read()


def save_text(rel, text):
    with open(os.path.join(ROOT, rel), 'w', encoding='utf-8') as f:
        f.write(text)


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


def make_line_step(text, voice, emotion=None, action=False, sfx=None):
    ln = {'text': text}
    if action:
        ln['action'] = True
    if emotion:
        ln['emotion'] = emotion
    if voice:
        ln['voice'] = voice
    if sfx:
        ln['sfx'] = sfx
    return {'kind': 'line', 'line': ln}


def make_effect_step(eff):
    return {'kind': 'effect', 'effect': eff}


def patch_existing_unspoken():
    # 1. Ира: Молчание -> ira_17.mp3
    ira = load_json('dialogues/ira.dlg.json')
    for n in ira['nodes']:
        if n['id'] == 'Молчание':
            for st in n['sections'][0]['steps']:
                if st['kind'] == 'line' and st['line'].get('text', '').startswith('Вот и я молчу'):
                    st['line']['voice'] = 'assets/voice/ira_17.mp3'
    save_json('dialogues/ira.dlg.json', ira, indent=1)

    ira_ink = load_text('dialogues/ira.ink')
    ira_ink = ira_ink.replace(
        'Вот и я молчу третий день. Ничего, привыкла.\n',
        'Вот и я молчу третий день. Ничего, привыкла. # voice: assets/voice/ira_17.mp3\n',
    )
    save_text('dialogues/ira.ink', ira_ink)

    # 2. Келл: Начало_hub_no1 -> kell_14.mp3, Начало_hub_no2 -> kell_15.mp3
    kell = load_json('dialogues/kell.dlg.json')
    n0 = kell['nodes'][0]
    for ch in n0['choices']:
        ck = ch.get('check')
        if not ck:
            continue
        for st in ck['fail']['sections'][0]['steps']:
            if st['kind'] != 'line':
                continue
            txt = st['line'].get('text', '')
            if txt.startswith('Ты меня допрашиваешь?'):
                st['line']['voice'] = 'assets/voice/kell_14.mp3'
            elif txt.startswith('За такие слова внизу'):
                st['line']['voice'] = 'assets/voice/kell_15.mp3'
    save_json('dialogues/kell.dlg.json', kell, indent=1)

    kell_ink = load_text('dialogues/kell.ink')
    kell_ink = kell_ink.replace(
        'Ты меня допрашиваешь? Забавно. У тебя бумага, у меня двенадцать свидетелей, которые стояли со мной.\n',
        'Ты меня допрашиваешь? Забавно. У тебя бумага, у меня двенадцать свидетелей, которые стояли со мной. # voice: assets/voice/kell_14.mp3\n',
    )
    kell_ink = kell_ink.replace(
        'За такие слова внизу не отвечают. Считай, я не слышал — пока ты при исполнении.\n',
        'За такие слова внизу не отвечают. Считай, я не слышал — пока ты при исполнении. # voice: assets/voice/kell_15.mp3\n',
    )
    save_text('dialogues/kell.ink', kell_ink)


def patch_ayla():
    ayla = load_json('dialogues/ayla.dlg.json')
    n0 = ayla['nodes'][0]
    # Оставляем в приветствии только ремарку + ayla_1 + ayla_8
    n0['sections'][0]['steps'] = [
        st for st in n0['sections'][0]['steps']
        if st.get('line', {}).get('voice') not in (
            'assets/voice/ayla_9.mp3', 'assets/voice/ayla_10.mp3'
        )
    ]
    # В «Научи готовить настой.» добавляем ayla_9 после ayla_6
    for ch in n0['choices']:
        if ch['text'] == 'Научи готовить настой.':
            steps = ch['sections'][0]['steps']
            if not any(s.get('line', {}).get('voice') == 'assets/voice/ayla_9.mp3' for s in steps):
                steps.insert(1, make_line_step(
                    'Если пойдёшь на девятый, возьми мой настой. Он не от воды. Он от того, что в воде.',
                    'assets/voice/ayla_9.mp3',
                    emotion='thoughtful',
                ))

    # Выбор про рукавицу (ayla_10)
    glove_text = 'Показать Айле рукавицу с привода.'
    if not any(c['text'] == glove_text for c in n0['choices']):
        n0['choices'].insert(-1, {
            'text': glove_text,
            'conds': [{'type': 'has_item', 'item': 'item_glove'}],
            'goto': 'stay',
            'sections': [{
                'steps': [
                    make_line_step(
                        'Заплату на рукавице я узнаю: ставила осенью, в рядке. Чья — не помню: ладони у всех в мазуте, а имён я не спрашиваю. А клеймо караульное, это точно.',
                        'assets/voice/ayla_10.mp3',
                        emotion='thoughtful',
                    ),
                ],
            }],
        })

    # Выбор про банки дыхателя (ayla_11)
    filt_text = 'Чем забиваются банки в дыхателе?'
    if not any(c['text'] == filt_text for c in n0['choices']):
        n0['choices'].insert(-1, {
            'text': filt_text,
            'conds': [{'type': 'has_item', 'item': 'item_filter'}],
            'goto': 'stay',
            'sections': [{
                'steps': [
                    make_line_step(
                        'Жильной взвесью. Она не пыль — она в угле живёт и разбухает от сырости. Продуть банку нельзя, можно только сменить на верстаке.',
                        'assets/voice/ayla_11.mp3',
                        emotion='calm',
                    ),
                    make_effect_step({'type': 'unlock_codex', 'entry': 'codex_filter'}),
                ],
            }],
        })
    save_json('dialogues/ayla.dlg.json', ayla, indent=1)

    ink = load_text('dialogues/ayla.ink')
    ink = ensure_external(ink, 'EXTERNAL has_item(a0)')
    ink = ensure_external(ink, 'EXTERNAL unlock_codex(a0)')
    # Убираем ayla_9 и ayla_10 из === Начало ===
    ink = ink.replace(
        'Если пойдёшь на девятый, возьми мой настой. Он не от воды. Он от того, что в воде. # voice: assets/voice/ayla_9.mp3\n',
        '',
    )
    ink = ink.replace(
        'Заплату на рукавице я узнаю: ставила осенью, в рядке. Чья — не помню: ладони у всех в мазуте, а имён я не спрашиваю. А клеймо караульное, это точно. # voice: assets/voice/ayla_10.mp3\n',
        '',
    )
    # Добавляем ayla_9 в [Научи готовить настой.]
    old_rec = '    Рецепт простой, как всё, что спасает жизнь: трава, вода и терпение. # emotion: calm # voice: assets/voice/ayla_6.mp3\n'
    new_rec = (
        old_rec
        + '    Если пойдёшь на девятый, возьми мой настой. Он не от воды. Он от того, что в воде. # emotion: thoughtful # voice: assets/voice/ayla_9.mp3\n'
    )
    if 'ayla_9.mp3' not in ink:
        ink = ink.replace(old_rec, new_rec, 1)

    extra_choices = ''
    if 'ayla_10.mp3' not in ink:
        extra_choices += (
            '+ { has_item("item_glove") } [Показать Айле рукавицу с привода.]\n'
            '    Заплату на рукавице я узнаю: ставила осенью, в рядке. Чья — не помню: ладони у всех в мазуте, а имён я не спрашиваю. А клеймо караульное, это точно. # emotion: thoughtful # voice: assets/voice/ayla_10.mp3\n'
            '    -> Начало_hub\n'
        )
    if 'ayla_11.mp3' not in ink:
        extra_choices += (
            '+ { has_item("item_filter") } [Чем забиваются банки в дыхателе?]\n'
            '    Жильной взвесью. Она не пыль — она в угле живёт и разбухает от сырости. Продуть банку нельзя, можно только сменить на верстаке. # emotion: calm # voice: assets/voice/ayla_11.mp3\n'
            '    ~ unlock_codex("codex_filter")\n'
            '    -> Начало_hub\n'
        )
    if extra_choices:
        ink = ink.replace('+ [Пока.]\n', extra_choices + '+ [Пока.]\n', 1)
    save_text('dialogues/ayla.ink', ink)


def patch_resh():
    resh = load_json('dialogues/resh.dlg.json')
    n0 = resh['nodes'][0]
    n0['sections'][0]['steps'] = [
        st for st in n0['sections'][0]['steps']
        if st.get('line', {}).get('voice') != 'assets/voice/resh_14.mp3'
    ]
    for ch in n0['choices']:
        if ch['text'] == 'Кто срезал муфту?':
            steps = ch['sections'][0]['steps']
            if not any(s.get('line', {}).get('voice') == 'assets/voice/resh_14.mp3' for s in steps):
                steps.append(make_line_step(
                    'Муфту резали ключом на пятьдесят два, в перчатках: на срезе ни одной мозоли. Сорок лет смотрю, как режут, — по металлу видно, чья рука держала ключ.',
                    'assets/voice/resh_14.mp3',
                    emotion='thoughtful',
                ))
    filt_text = 'Дыхатель держит только две банки?'
    if not any(c['text'] == filt_text for c in n0['choices']):
        n0['choices'].insert(-1, {
            'text': filt_text,
            'conds': [{'type': 'has_item', 'item': 'item_filter'}],
            'goto': 'stay',
            'sections': [{
                'steps': [
                    make_line_step(
                        'Первая банка садится ещё в штольне, вторая — у самого забоя. Кто спускается в третий раз со старой маской, тот дышит уже собой.',
                        'assets/voice/resh_15.mp3',
                        emotion='thoughtful',
                    ),
                    make_effect_step({'type': 'unlock_codex', 'entry': 'codex_filter'}),
                ],
            }],
        })
    save_json('dialogues/resh.dlg.json', resh, indent=1)

    ink = load_text('dialogues/resh.ink')
    ink = ink.replace(
        'Муфту резали ключом на пятьдесят два, в перчатках: на срезе ни одной мозоли. Сорок лет смотрю, как режут, — по металлу видно, чья рука держала ключ. # voice: assets/voice/resh_14.mp3\n',
        '',
    )
    old_muf = '    Стража. Я видел пломбу на их рукавицах: тринадцать-К. У нас на ярусе пломбы только у тех, кто закрывает. # emotion: angry # voice: assets/voice/resh_6.mp3\n'
    new_muf = (
        old_muf
        + '    Муфту резали ключом на пятьдесят два, в перчатках: на срезе ни одной мозоли. Сорок лет смотрю, как режут, — по металлу видно, чья рука держала ключ. # emotion: thoughtful # voice: assets/voice/resh_14.mp3\n'
    )
    if 'resh_14.mp3' not in ink:
        ink = ink.replace(old_muf, new_muf, 1)
    if 'resh_15.mp3' not in ink:
        branch = (
            '+ { has_item("item_filter") } [Дыхатель держит только две банки?]\n'
            '    Первая банка садится ещё в штольне, вторая — у самого забоя. Кто спускается в третий раз со старой маской, тот дышит уже собой. # emotion: thoughtful # voice: assets/voice/resh_15.mp3\n'
            '    ~ unlock_codex("codex_filter")\n'
            '    -> Начало_hub\n'
        )
        ink = ink.replace('+ [Мне пора.]\n', branch + '+ [Мне пора.]\n', 1)
    save_text('dialogues/resh.ink', ink)


def patch_vex():
    vex = load_json('dialogues/vex.dlg.json')
    n0 = vex['nodes'][0]
    n0['sections'][0]['steps'] = [
        st for st in n0['sections'][0]['steps']
        if st.get('line', {}).get('voice') not in (
            'assets/voice/vex_11.mp3', 'assets/voice/vex_12.mp3'
        )
    ]
    for ch in n0['choices']:
        if ch['text'] == 'Как спуститься к помпе?':
            steps = ch['sections'][0]['steps']
            if not any(s.get('line', {}).get('voice') == 'assets/voice/vex_11.mp3' for s in steps):
                steps.append(make_line_step(
                    'Ты спускался ниже седьмого? Нет? Тогда не спорь со мной про воду.',
                    'assets/voice/vex_11.mp3',
                ))
            if not any(s.get('line', {}).get('voice') == 'assets/voice/vex_12.mp3' for s in steps):
                steps.append(make_line_step(
                    'На восьмом теперь считают не часы, а уголь: сколько унёс, столько и прожил.',
                    'assets/voice/vex_12.mp3',
                    emotion='thoughtful',
                ))
    save_json('dialogues/vex.dlg.json', vex, indent=1)

    ink = load_text('dialogues/vex.ink')
    ink = ink.replace(
        'Ты спускался ниже седьмого? Нет? Тогда не спорь со мной про воду. # voice: assets/voice/vex_11.mp3\n',
        '',
    )
    ink = ink.replace(
        'На восьмом теперь считают не часы, а уголь: сколько унёс, столько и прожил. # voice: assets/voice/vex_12.mp3\n',
        '',
    )
    old_down = '    Вниз не ходи: там вода стоит и, говорят, ходит. # voice: assets/voice/vex_6.mp3\n'
    new_down = (
        old_down
        + '    Ты спускался ниже седьмого? Нет? Тогда не спорь со мной про воду. # voice: assets/voice/vex_11.mp3\n'
        + '    На восьмом теперь считают не часы, а уголь: сколько унёс, столько и прожил. # emotion: thoughtful # voice: assets/voice/vex_12.mp3\n'
    )
    if 'vex_11.mp3' not in ink:
        ink = ink.replace(old_down, new_down, 1)
    save_text('dialogues/vex.ink', ink)


def patch_dozh():
    dozh = load_json('dialogues/dozh.dlg.json')
    n0 = dozh['nodes'][0]
    for ch in n0['choices']:
        if ch['text'].startswith('Купить дыхатель'):
            ch['sections'][0]['steps'] = [
                st for st in ch['sections'][0]['steps']
                if st.get('line', {}).get('voice') != 'assets/voice/dozh_14.mp3'
            ]
        elif ch['text'] == 'Почему у тебя всё дороже, чем наверху?':
            steps = ch['sections'][0]['steps']
            if not any(s.get('line', {}).get('voice') == 'assets/voice/dozh_14.mp3' for s in steps):
                steps.append(make_line_step(
                    'Уголь — три марки штука, и это ещё по-людски. Как вода пришла, уголь у нас дороже воды стал. Ведром не продаю: ведро самому топить.',
                    'assets/voice/dozh_14.mp3',
                    emotion='calm',
                ))
    save_json('dialogues/dozh.dlg.json', dozh, indent=1)

    ink = load_text('dialogues/dozh.ink')
    ink = ink.replace(
        'Уголь — три марки штука, и это ещё по-людски. Как вода пришла, уголь у нас дороже воды стал. Ведром не продаю: ведро самому топить. # voice: assets/voice/dozh_14.mp3\n',
        '',
    )
    old_exp = '    Потому что сверху вещи возят, а сюда их носят на себе. Спина — тоже цена. # emotion: calm # voice: assets/voice/dozh_5.mp3\n'
    new_exp = (
        old_exp
        + '    Уголь — три марки штука, и это ещё по-людски. Как вода пришла, уголь у нас дороже воды стал. Ведром не продаю: ведро самому топить. # emotion: calm # voice: assets/voice/dozh_14.mp3\n'
    )
    if 'dozh_14.mp3' not in ink:
        ink = ink.replace(old_exp, new_exp, 1)
    save_text('dialogues/dozh.ink', ink)


def patch_kast_zhuk_registrar():
    # Каст: рукавица с привода (kast_16, kast_17)
    kast = load_json('dialogues/kast.dlg.json')
    n0 = kast['nodes'][0]
    k_text = 'Под приводом лежала караульная рукавица.'
    if not any(c['text'] == k_text for c in n0['choices']):
        n0['choices'].insert(-1, {
            'text': k_text,
            'conds': [{'type': 'has_item', 'item': 'item_glove'}],
            'goto': 'stay',
            'sections': [{
                'steps': [
                    make_line_step(
                        'Караульная партия. Значит, кто-то из двенадцати снял рукавицу, когда крутил муфту, и забыл в поддоне.',
                        'assets/voice/kast_16.mp3',
                        emotion='calm',
                    ),
                    make_line_step(
                        'Не неси её сюда: масло пачкает сукно. Подшей к делу номер клейма — для трибунала нитка весит больше тряпки.',
                        'assets/voice/kast_17.mp3',
                        emotion='thoughtful',
                    ),
                ],
            }],
        })
    save_json('dialogues/kast.dlg.json', kast, indent=1)

    kast_ink = load_text('dialogues/kast.ink')
    if 'kast_16.mp3' not in kast_ink:
        branch = (
            '+ { has_item("item_glove") } [Под приводом лежала караульная рукавица.]\n'
            '    Караульная партия. Значит, кто-то из двенадцати снял рукавицу, когда крутил муфту, и забыл в поддоне. # emotion: calm # voice: assets/voice/kast_16.mp3\n'
            '    Не неси её сюда: масло пачкает сукно. Подшей к делу номер клейма — для трибунала нитка весит больше тряпки. # emotion: thoughtful # voice: assets/voice/kast_17.mp3\n'
            '    -> Начало_hub\n'
        )
        kast_ink = kast_ink.replace('+ [Мне пора.]\n', branch + '+ [Мне пора.]\n', 1)
    save_text('dialogues/kast.ink', kast_ink)

    # Жук: рукавица с привода (zhuk_13, zhuk_14)
    zhuk = load_json('dialogues/zhuk.dlg.json')
    n0 = zhuk['nodes'][0]
    z_text = 'Узнаёшь рукавицу? Семёрка на манжете, заплата на пальце.'
    if not any(c['text'] == z_text for c in n0['choices']):
        n0['choices'].insert(-1, {
            'text': z_text,
            'conds': [{'type': 'has_item', 'item': 'item_glove'}],
            'goto': 'stay',
            'sections': [{
                'steps': [
                    make_line_step(
                        'Партия седьмого яруса, прошлогодняя выдача. Я сам эти тюки через шлюз принимал — брезент двойной, сносу нет.',
                        'assets/voice/zhuk_13.mp3',
                        emotion='calm',
                    ),
                    make_line_step(
                        'А заплата — это к Айле или к Ире: караульные у нас гордые, но когда палец мёрзнет, идут кланяться в Сухой ряд.',
                        'assets/voice/zhuk_14.mp3',
                        emotion='thoughtful',
                    ),
                ],
            }],
        })
    save_json('dialogues/zhuk.dlg.json', zhuk, indent=1)

    zhuk_ink = load_text('dialogues/zhuk.ink')
    if 'zhuk_13.mp3' not in zhuk_ink:
        branch = (
            '+ { has_item("item_glove") } [Узнаёшь рукавицу? Семёрка на манжете, заплата на пальце.]\n'
            '    Партия седьмого яруса, прошлогодняя выдача. Я сам эти тюки через шлюз принимал — брезент двойной, сносу нет. # emotion: calm # voice: assets/voice/zhuk_13.mp3\n'
            '    А заплата — это к Айле или к Ире: караульные у нас гордые, но когда палец мёрзнет, идут кланяться в Сухой ряд. # emotion: thoughtful # voice: assets/voice/zhuk_14.mp3\n'
            '    -> Начало_hub\n'
        )
        zhuk_ink = zhuk_ink.replace('+ [Пока.]\n', branch + '+ [Пока.]\n', 1)
    save_text('dialogues/zhuk.ink', zhuk_ink)

    # Регистратор: сшитое дело №137 (registrar_10)
    reg = load_json('dialogues/registrar.dlg.json')
    n0 = reg['nodes'][0]
    r_text = 'Дело № 137 сшито. Запишешь во входящие?'
    if not any(c['text'] == r_text for c in n0['choices']):
        n0['choices'].insert(-1, {
            'text': r_text,
            'conds': [{'type': 'flag', 'flag': 'case_full'}],
            'goto': 'stay',
            'sections': [{
                'steps': [
                    make_line_step(
                        'Шесть улик на суровой нитке… Давно такого не приносили. Ставлю входящий штамп: теперь эту папку даже инспектор из реестра не вынет.',
                        'assets/voice/registrar_10.mp3',
                        emotion='calm',
                        sfx='snd_latch',
                    ),
                    make_effect_step({'type': 'unlock_codex', 'entry': 'codex_case137'}),
                ],
            }],
        })
    save_json('dialogues/registrar.dlg.json', reg, indent=1)

    reg_ink = load_text('dialogues/registrar.ink')
    reg_ink = ensure_external(reg_ink, 'EXTERNAL get_flag(a0)')
    if 'registrar_10.mp3' not in reg_ink:
        branch = (
            '+ { get_flag("case_full") } [Дело № 137 сшито. Запишешь во входящие?]\n'
            '    Шесть улик на суровой нитке… Давно такого не приносили. Ставлю входящий штамп: теперь эту папку даже инспектор из реестра не вынет. # emotion: calm # sfx: snd_latch # voice: assets/voice/registrar_10.mp3\n'
            '    ~ unlock_codex("codex_case137")\n'
            '    -> Начало_hub\n'
        )
        reg_ink = reg_ink.replace('+ [Отключись.]\n', branch + '+ [Отключись.]\n', 1)
    save_text('dialogues/registrar.ink', reg_ink)


def fix_present_item_diverts():
    fixed = 0
    for name in ('kast', 'kell', 'zhuk', 'dozh'):
        rel = f'dialogues/{name}.ink'
        ink = load_text(rel)
        lines = ink.split('\n')
        out = []
        for i, line in enumerate(lines):
            out.append(line)
            if '~ present_item(' in line:
                nxt = lines[i + 1].strip() if i + 1 < len(lines) else ''
                if not nxt.startswith('->'):
                    out.append('    -> DONE')
                    fixed += 1
        if fixed:
            save_text(rel, '\n'.join(out))
    return fixed


def patch_codex_bench_and_rules():
    # 1. Запись кодекса codex_filter
    codex_rel = 'codex/codex_filter.json'
    codex_data = {
        'id': 'codex_filter',
        'label': 'Дыхатель и две банки',
        'category': 'lore',
        'text': (
            'Маска мастера Реша рассчитана на две сменные банки с дроблёным '
            'углём и промасленным сукном. Первая банка садится ещё в штольне '
            'девятого яруса, вторая — у самого слепого забоя, где жильная '
            'взвесь стоит как туман. Продуть забитую банку нельзя: жильная '
            'соль схватывается в камень. Но на верстаке обойму можно '
            'переснарядить свежим углём и сукном — иначе второй спуск на '
            'девятый придётся дышать впустую.'
        ),
    }
    save_json(codex_rel, codex_data)

    man = load_json('manifest.json')
    if 'codex_filter.json' not in man.get('codex', []):
        man['codex'].append('codex_filter.json')
        man['codex'].sort()
        save_json('manifest.json', man)

    # 2. Верстак: «Сменить банки в дыхателе»
    bench = load_json('entities/item_bench.json')
    opt_label = 'Сменить банки в дыхателе'
    if not any(o.get('label') == opt_label for o in bench.get('interact_options', [])):
        bench['interact_options'].append({
            'label': opt_label,
            'hint': 'уголь, тряпьё и час у тисков вернут маске обе банки',
            'sound': 'snd_vent',
            'conditions': [
                {'type': 'has_item', 'item': 'item_filter'},
                {'type': 'has_item', 'item': 'item_coal'},
                {'type': 'has_item', 'item': 'item_cloth'},
                {'type': 'flag_set', 'flag': 'filter_bank_1'},
            ],
            'effects': [
                {'type': 'remove_item', 'item': 'item_coal', 'quantity': 1},
                {'type': 'remove_item', 'item': 'item_cloth', 'quantity': 1},
                {'type': 'advance_time', 'ticks': 1},
                {'type': 'clear_flag', 'flag': 'filter_bank_1'},
                {'type': 'clear_flag', 'flag': 'filter_bank_2'},
                {'type': 'remove_status', 'target': 'player', 'status': 'status_filter_spent'},
                {'type': 'unlock_codex', 'entry': 'codex_filter'},
                {
                    'type': 'show_message',
                    'text': (
                        'Ты вытряхиваешь из обоймы спекшуюся жильную соль, '
                        'режешь свежий кружок сукна и засыпаешь дроблёный уголь. '
                        'Обе банки снова дышат легко.'
                    ),
                },
            ],
        })
        save_json('entities/item_bench.json', bench)

    # 3. Цепочка правил дыхателя без каскадного срабатывания
    b1 = load_json('rules/rule_filter_bank1.json')
    b1['once'] = True
    if not any(e.get('type') == 'unlock_codex' and e.get('entry') == 'codex_filter'
               for e in b1['effects']):
        b1['effects'].append({'type': 'unlock_codex', 'entry': 'codex_filter'})
    save_json('rules/rule_filter_bank1.json', b1)

    b2 = load_json('rules/rule_filter_bank2.json')
    b2['once'] = True
    b2['conditions'] = [
        {'type': 'player_enters_scene', 'scene': 'scene_face'},
        {'type': 'equipped', 'item': 'item_filter'},
        {'type': 'flag_set', 'flag': 'filter_bank_1'},
        {'type': 'flag_not_set', 'flag': 'filter_bank_2'},
    ]
    b2['effects'] = [
        {'type': 'set_flag', 'flag': 'filter_bank_2'},
        {
            'type': 'show_message',
            'text': (
                'У слепого забоя воздух гуще воды — первая банка забилась в камень, '
                'маска щёлкнула на вторую. На подъём её хватит, но перед новым '
                'спуском обойму придётся переснарядить на верстаке.'
            ),
        },
        {'type': 'play_sound', 'sound': 'snd_vent', 'volume': 0.8},
    ]
    save_json('rules/rule_filter_bank2.json', b2)

    sp = load_json('rules/rule_filter_spent.json')
    sp['once'] = True
    sp['conditions'] = [
        {'type': 'player_enters_location', 'location': 'loc_deep9'},
        {'type': 'equipped', 'item': 'item_filter'},
        {'type': 'flag_set', 'flag': 'filter_bank_2'},
        {
            'type': 'not',
            'condition': {'type': 'has_status', 'status': 'status_filter_spent'},
        },
    ]
    save_json('rules/rule_filter_spent.json', sp)

    # 4. rule_clue_check -> once: true; rule_water_rises -> не спамить под status_wading
    cc = load_json('rules/rule_clue_check.json')
    cc['once'] = True
    save_json('rules/rule_clue_check.json', cc)

    wr = load_json('rules/rule_water_rises.json')
    if not any(c.get('type') == 'not' for c in wr.get('conditions', [])):
        wr['conditions'].append({
            'type': 'not',
            'condition': {'type': 'has_status', 'status': 'status_wading'},
        })
        save_json('rules/rule_water_rises.json', wr)


def main():
    patch_existing_unspoken()
    patch_ayla()
    patch_resh()
    patch_vex()
    patch_dozh()
    patch_kast_zhuk_registrar()
    div = fix_present_item_diverts()
    patch_codex_bench_and_rules()
    print('КОНТЕНТ 21')
    print('  озвучены 3 старые spoken-реплики (ira_17, kell_14, kell_15)')
    print('  перенесены на свои места 5 реплик (ayla_9, ayla_10, resh_14, vex_11..12, dozh_14)')
    print('  добавлены 5 новых веток диалогов (7 голосовых файлов)')
    print('  исправлено выборов present_item без -> DONE:', div)
    print('  добавлена запись кодекса codex_filter и смена банок на верстаке')
    print('  разведена по событиям цепочка rule_filter_bank1 → bank2 → spent')


if __name__ == '__main__':
    main()
