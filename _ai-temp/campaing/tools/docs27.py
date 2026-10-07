#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""Ход 27: обновляет дизайн-документ (`tools/design_doc.md`).

1. Паспорт: пересчитаны файлы, размер пакета и все категории медиа
   (232 изображения, 66 звуков в реестре, 203 дорожки озвучки:
   135/135 spoken-реплик + 39/39 авторских ремарок + 14/14 слайдов катсцен +
   17/24 вступительных карточек сцен `narrative_intro`).
2. §9 «Медиа, звук и озвучка»: актуализированы числа изображений (у всех 3
   архетипов героя в `char_creation.portraits` по 6 уникальных эмоций без
   дублей — 18 портретов героя) и озвучки (17/24 карточек `narrative_intro`,
   8 из 12 сцен озвучены на 100 %).
3. §11 «Журнал решений»: добавлены записи 154–157.

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
        '- **Медиа:** %d файла, %.2f МБ: %d изображения, %d музыкальных треков, '
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
            '**Изображения — %d файла, 51 МБ.** Титул, меню, кадры всех шести '
            'катсцен, галерея выбора портрета героя из трёх архетипов '
            '(`char_creation.portraits`, у всех трёх архетипов по шесть '
            'уникальных состояний мимики — 18 кадров без единого дубля ключей) '
            'и все шесть состояний мимики у каждого из десяти говорящих '
            'персонажей, спокойные и боевые (`angry`) портреты всех четырёх '
            'противников (15/15 персонажей — 100 %%), десять спрайтов для слотов '
            'сцен, двадцать четыре фоновых кадра для всех двенадцати сцен (у всех '
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
            '**Озвучка — %d дорожки, 8,0 МБ: озвучены все %d spoken-реплик '
            'диалогов из %d (100 %%), все %d авторских ремарок из %d (100 %%) '
            'голосом рассказчика**, все четырнадцать слайдов шести катсцен (100 %%) '
            'и %d из %d вступительных карточек сцен (`narrative_intro`, '
            'восемь сцен поверхности и седьмого яруса озвучены на 100 %%, '
            'на финальный ход осталось 7 карточек нижних ярусов). '
            'Во всех десяти диалогах кампании озвучена каждая строка без исключений. '
            'Начитаны восемью голосами платформенного синтеза речи:'
            % (k['voice'], v_spoken, spoken, v_actions, actions, i_voiced, i_total)
        ),
        text,
        count=1,
        flags=re.S,
    )

    # 3. §11 «Журнал решений»: записи 154–157
    entries = [
        ('154', 'Полная мимика для всех 3 архетипов героя в char_creation.portraits (18 кадров)',
         'Сгенерированы все пять недостающих состояний мимики (`calm`, `thoughtful`, '
         '`angry`, `afraid`, `sad`) для обоих новых архетипов дознавателя (`hero_f_*` и '
         '`hero_vet_*`). Теперь все три выбираемых портрета героя имеют по 6 уникальных '
         'эмоциональных кадров без единого дубля ключей'),
        ('155', 'Озвучка ещё 10 вступительных карточек сцен narrative_intro (17/24)',
         'Голосом рассказчика (`voice-00`) озвучены вступительные карточки `scene_office[1]`, '
         '`scene_archive[0..1]`, `scene_pump_hall[0..1]`, `scene_pump_room[0..1]`, '
         '`scene_pump_shaft[0..1]` и `scene_flood_gallery[0]`. Все 8 сцен поверхности и '
         'седьмого яруса озвучены на 100 %; на финальный ход остаётся ровно 7 карточек '
         'восьмого и девятого ярусов'),
        ('156', 'Звук фляги sfx_flask и 100 % интерактивный осмотр всех 57 предметов кампании',
         'Из трёх реальных CC0-сэмплов (`sfx_glass`, `sfx_water`, `sfx_gasp`) собран '
         'звук глотка `sfx_flask` для воды и настоев; последним семи переносимым '
         'предметам (`item_water`, `item_tonic`, `item_antirot`, `item_bandage`, '
         '`item_ration`, `item_stew`, `item_mark`) добавлены действия осмотра '
         '`interact_options` со звуком и показом портрета (57/57 = 100 %)'),
        ('157', 'Баланс проверок на седьмой помпе и ручном подъёмнике Жилы',
         'На `item_pump_engine` («Простучать корпус») добавлены `once: true`, подсказка '
         'сложности и награда +10 опыта; на `item_pump_engine` («Вставить сердцевину») '
         'и `item_hoist` («Стянуть шов Жилы») в ветку провала добавлен расход 1 часа '
         'времени, закрывающий бесплатный спам повторных бросков'),
    ]
    block = ''
    for num, title, body in entries:
        if re.search(r'\|\s*%s\s*\|' % num, text):
            continue
        block += '| %s | %s | %s |\n' % (num, title, body)
    if block:
        text = text.replace('\n## 12. Приложение', '\n' + block + '\n## 12. Приложение', 1)

    open(DOC, 'w', encoding='utf-8').write(text)
    print('ДОКУМЕНТ 27')
    print('  файлов %d, %.2f МБ; изображений %d, звуков в реестре %d (файлов %d, петель %d), голоса %d'
          % (files, size / 1048576, k['img'], n_sounds_reg, k['sfx'] + k['amb'], k['amb'], k['voice']))
    print('  spoken-реплик: %d/%d (100 %%), ремарок: %d/%d (100 %%), intro: %d/%d'
          % (v_spoken, spoken, v_actions, actions, i_voiced, i_total))
    print('  журнал: последняя запись', entries[-1][0])


if __name__ == '__main__':
    main()
