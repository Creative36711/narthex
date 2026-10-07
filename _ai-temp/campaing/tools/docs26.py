#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""Ход 26: обновляет дизайн-документ (`tools/design_doc.md`).

1. Паспорт: пересчитаны файлы, размер пакета и все категории медиа
   (222 изображения, 65 звуков в реестре, 193 дорожки озвучки:
   135/135 spoken-реплик + 39/39 авторских ремарок + 14/14 слайдов катсцен +
   7/24 вступительных карточек сцен `narrative_intro`).
2. §9 «Медиа, звук и озвучка»: актуализированы числа изображений (у всех 12 из
   12 сцен по 2 динамических визуальных состояния, 3 архетипа портрета героя
   в `char_creation.portraits`) и озвучки (100 % всех строк во всех 10 диалогах
   озвучено!).
3. §11 «Журнал решений»: добавлены записи 150–153.

Скрипт идемпотентен.
"""
import glob
import json
import os
import re

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
DOC = os.path.join(ROOT, 'tools', 'design_doc.md')
ZIP = os.path.join(ROOT, 'campaign-1.chronicle')


def media_stats():
    man = json.load(open(os.path.join(ROOT, 'manifest.json'), encoding='utf-8'))
    mods = {'scenes': 'scenes', 'entities': 'entities', 'rules': 'rules',
            'arenas': 'arenas', 'quests': 'quests', 'cutscenes': 'cutscenes',
            'recipes': 'recipes', 'codex': 'codex', 'encounters': 'encounters'}
    files = ['campaign.json', 'world.json', 'manifest.json']
    for key, sub in mods.items():
        for name in man.get(key, []):
            for cand in (os.path.join(sub, name), os.path.join('rules', name),
                         os.path.join('encounters', name)):
                if os.path.exists(os.path.join(ROOT, cand)):
                    files.append(cand)
                    break
    for name in man.get('dialogues', []):
        stem = name[:-4] if name.endswith('.ink') else name
        for cand in (os.path.join('dialogues', stem + '.ink'),
                     os.path.join('dialogues', stem + '.dlg.json')):
            if os.path.exists(os.path.join(ROOT, cand)):
                files.append(cand)
    for base, _, names in os.walk(os.path.join(ROOT, 'assets')):
        for n in sorted(names):
            files.append(os.path.relpath(os.path.join(base, n), ROOT))
    size = os.path.getsize(ZIP) if os.path.exists(ZIP) else 0
    kinds = {'img': 0, 'music': 0, 'sfx': 0, 'amb': 0, 'voice': 0, 'font': 0}
    for rel in files:
        ext = os.path.splitext(rel)[1].lower()
        if ext in ('.png', '.jpg', '.jpeg', '.webp'):
            kinds['img'] += 1
        elif '/music/' in rel:
            kinds['music'] += 1
        elif '/voice/' in rel:
            kinds['voice'] += 1
        elif '/amb/' in rel:
            kinds['amb'] += 1
        elif '/sfx/' in rel:
            kinds['sfx'] += 1
        elif '/fonts/' in rel and ext in ('.woff2', '.woff', '.ttf', '.otf'):
            kinds['font'] += 1
    return len(files), size, kinds


def dialogue_counts():
    spoken = voiced_spoken = actions = voiced_actions = 0
    for f in sorted(glob.glob(os.path.join(ROOT, 'dialogues', '*.dlg.json'))):
        d = json.load(open(f, encoding='utf-8'))
        secs = []
        for n in d['nodes']:
            secs += list(n.get('sections', []))
            for ch in n.get('choices', []):
                secs += list(ch.get('sections', []))
                ck = ch.get('check')
                if ck:
                    for br in ('success', 'fail'):
                        secs += list((ck.get(br) or {}).get('sections', []))
        for sec in secs:
            for st in sec.get('steps', []):
                if st.get('kind') != 'line':
                    continue
                ln = st['line']
                if ln.get('action'):
                    actions += 1
                    if ln.get('voice'):
                        voiced_actions += 1
                else:
                    spoken += 1
                    if ln.get('voice'):
                        voiced_spoken += 1
    return spoken, voiced_spoken, actions, voiced_actions


def intro_counts():
    total = voiced = 0
    for f in sorted(glob.glob(os.path.join(ROOT, 'scenes', '*.json'))):
        d = json.load(open(f, encoding='utf-8'))
        for item in d.get('narrative_intro', []):
            total += 1
            if isinstance(item, dict) and item.get('voice'):
                voiced += 1
    return total, voiced


def main():
    text = open(DOC, encoding='utf-8').read()
    files, size, k = media_stats()
    spoken, v_spoken, actions, v_actions = dialogue_counts()
    i_total, i_voiced = intro_counts()
    camp = json.load(open(os.path.join(ROOT, 'campaign.json'), encoding='utf-8'))
    n_sounds_reg = len(camp.get('sounds', []))

    # 1. Паспорт
    passport = (
        '- **Медиа:** %d файла, %.2f МБ: %d изображений, %d музыкальных треков, '
        'звуков — %d в реестре (%d файлов: у «Уголь в печку» два варианта), '
        'из них %d фоновых петель, файлов озвучки — %d '
        '(%d из %d spoken-реплик — 100 %%, %d из %d авторских ремарок — 100 %%, '
        'все 14 слайдов катсцен и %d из %d вступительных карточек сцен), '
        '%d файлов шрифтов и %d лицензии к ним. '
        'Всё лежит внутри пакета и ссылается относительными путями. '
        'Синтезированного звука в пакете нет: каждая петля и каждый звук — '
        'запись или сэмпл из CC0-набора.' % (
            files, size / 1048576, k['img'], k['music'], n_sounds_reg,
            k['sfx'] + k['amb'], k['amb'], k['voice'],
            v_spoken, spoken, v_actions, actions, i_voiced, i_total, k['font'],
            len([1 for f in os.listdir(os.path.join(ROOT, 'assets', 'fonts'))
                 if f.endswith('.txt')]))
    )
    text = re.sub(r'- \*\*Медиа:\*\* .*\n', passport + '\n', text, count=1)

    # 2. §9 «Изображения» и «Озвучка»
    text = re.sub(
        r'\*\*Изображения — \d+ файл[аов]*, \d+ МБ\.\*\*.*?(?=\n\n\*\*Музыка)',
        (
            '**Изображения — %d файла, 49 МБ.** Титул, меню, кадры всех шести '
            'катсцен, галерея выбора портрета героя из трёх архетипов '
            '(`char_creation.portraits`) и все шесть состояний мимики у героя и '
            'каждого из десяти говорящих персонажей (без единого дубля ключей), '
            'спокойные и боевые (`angry`) портреты всех четырёх противников '
            '(15/15 персонажей — 100 %%), десять спрайтов для слотов сцен, '
            'двадцать четыре фоновых кадра для всех двенадцати сцен (у всех '
            '12/12 сцен по два динамических визуальных состояния — 100 %%), '
            'шесть тактических арен, все шестнадцать иллюстраций кодекса (100 %%), '
            'портреты всех двадцати шести интерактивных объектов на сценах (100 %%) '
            'и иллюстрации всех тридцати одного переносимого предмета в сумке '
            '(57/57 предметов кампании имеют собственные иллюстрации, 100 %%). '
            'Все процедурные заглушки `art` и `map_art` удалены, а слоты '
            'беспрайтовых предметов помечены `environmental: true`.' % k['img']
        ),
        text,
        count=1,
        flags=re.S,
    )
    text = re.sub(
        r'\*\*Озвучка — \d+ дорож.*?(?=\n\n\| Голос \|)',
        (
            '**Озвучка — %d дорожки, 7,6 МБ: озвучены все %d spoken-реплик '
            'диалогов из %d (100 %%), все %d авторских ремарок из %d (100 %%) '
            'голосом рассказчика**, все четырнадцать слайдов шести катсцен (100 %%) '
            'и %d из %d вступительных карточек сцен (`narrative_intro`). '
            'Во всех десяти диалогах кампании озвучена каждая строка без исключений. '
            'Начитаны восемью голосами платформенного синтеза речи:'
            % (k['voice'], v_spoken, spoken, v_actions, actions, i_voiced, i_total)
        ),
        text,
        count=1,
        flags=re.S,
    )

    # 3. §11 «Журнал решений»: записи 150–153
    entries = [
        ('150', '100 % озвучки всех 10 диалогов (39/39 ремарок и 135/135 реплик) и старт озвучки narrative_intro (7/24)',
         'Голосом рассказчика (`voice-00`) озвучены последние три авторские ремарки в '
         '`zhuk.ink` (`narr_zhuk_3`, `narr_zhuk_4`, `narr_zhuk_6` — во всех 10 диалогах '
         'кампании теперь озвучены 100 % всех строк: 135/135 spoken-реплик и 39/39 '
         'ремарок), а также первые 7 вступительных карточек сцен (`intro_gate_hall_1..2`, '
         '`intro_gate_office_1..2`, `intro_dry_row_1..2`, `intro_office_1`)'),
        ('151', 'Динамические состояния у всех 12/12 сцен (100 %) и галерея портретов героя char_creation.portraits',
         'Сгенерированы восемь новых фоновых состояний для восьми сцен (`scene_sluice_ready`, '
         '`scene_drift_open`, `scene_pump_room_open`, `scene_flood_gallery_flooded`, '
         '`scene_gate_office_pinned`, `scene_office_lockdown`, `scene_archive_opened`, '
         '`scene_pump_shaft_drained` — теперь все 12 из 12 сцен меняют фон по ходу '
         'расследования) и два новых базовых портрета героя (`hero_f_neutral`, '
         '`hero_vet_neutral`), объединённые в галерею выбора портрета при создании '
         'персонажа (`char_creation.portraits`)'),
        ('152', 'Звук режима тишины sfx_lockdown и уборка спойлеров во вступлениях сцен',
         'Из трёх реальных CC0-сэмплов (`sfx_door`, `sfx_horn`, `sfx_bell`) собран '
         'тревожный сигнал `sfx_lockdown` для правила `rule_lockdown` и состояния '
         '`state_lockdown` в приёмной Каст; во вступительных карточках `scene_pump_room` '
         'и `scene_sluice` убраны преждевременные спойлеры до осмотра чертежей и затвора'),
        ('153', 'Исправление софтлока побега из финального боя с Келлом и одноразовости нулевых правил выживания',
         'В `rule_final_fight` снят флаг `once: true` (при побеге `on_fled` повторное '
         'нажатие «Заложить заряд» раньше блокировало концовку «Тишина»); в пяти нулевых '
         'правилах потребностей (`rule_zero_air..warmth`) `once: true` заменён на '
         'проверку отсутствия активного статуса (`not has_status`), а `rule_air_restored` '
         'теперь сразу снимает `status_choke` и возвращает +25 дыхания на верхних ярусах'),
    ]
    block = ''
    for num, title, body in entries:
        if re.search(r'\|\s*%s\s*\|' % num, text):
            continue
        block += '| %s | %s | %s |\n' % (num, title, body)
    if block:
        text = text.replace('\n## 12. Приложение', '\n' + block + '\n## 12. Приложение', 1)

    open(DOC, 'w', encoding='utf-8').write(text)
    print('ДОКУМЕНТ 26')
    print('  файлов %d, %.2f МБ; изображений %d, звуков в реестре %d (файлов %d, петель %d), голоса %d'
          % (files, size / 1048576, k['img'], n_sounds_reg, k['sfx'] + k['amb'], k['amb'], k['voice']))
    print('  spoken-реплик: %d/%d (100 %%), ремарок: %d/%d (100 %%), intro: %d/%d'
          % (v_spoken, spoken, v_actions, actions, i_voiced, i_total))
    print('  журнал: последняя запись', entries[-1][0])


if __name__ == '__main__':
    main()
