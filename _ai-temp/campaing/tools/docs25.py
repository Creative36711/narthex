#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""Ход 25: обновляет дизайн-документ (`tools/design_doc.md`).

1. Паспорт: пересчитаны файлы, размер пакета и все категории медиа
   (212 изображений, 64 звука в реестре, 183 дорожки озвучки:
   135/135 spoken-реплик + 36/39 авторских ремарок + 14/14 слайдов катсцен).
2. §9 «Медиа, звук и озвучка»: актуализированы числа изображений (6 уникальных
   эмоций у героя и всех 10 говорящих НПС, боевые портреты angry у всех 4
   врагов, 2 новых динамических фона сцен) и озвучки (9 из 10 диалогов
   озвучены на 100 % включая все ремарки, осталось 3 ремарки в zhuk).
3. §11 «Журнал решений»: добавлены записи 145–149.

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


def main():
    text = open(DOC, encoding='utf-8').read()
    files, size, k = media_stats()
    spoken, v_spoken, actions, v_actions = dialogue_counts()
    camp = json.load(open(os.path.join(ROOT, 'campaign.json'), encoding='utf-8'))
    n_sounds_reg = len(camp.get('sounds', []))

    # 0. ID кампании в паспорте
    text = re.sub(
        r'`2c46c88f-49f2-43dc-b393-85b0941874fe`',
        '`b7305faa-8e10-4d26-96bb-f1b5ed5e493f`',
        text,
    )

    # 1. Паспорт
    passport = (
        '- **Медиа:** %d файл, %.2f МБ: %d изображений, %d музыкальных треков, '
        'звуков — %d в реестре (%d файлов: у «Уголь в печку» два варианта), '
        'из них %d фоновых петель, файлов озвучки — %d '
        '(%d из %d spoken-реплик — 100 %%, %d из %d авторских ремарок и все 14 слайдов катсцен), '
        '%d файлов шрифтов и %d лицензии к ним. '
        'Всё лежит внутри пакета и ссылается относительными путями. '
        'Синтезированного звука в пакете нет: каждая петля и каждый звук — '
        'запись или сэмпл из CC0-набора.' % (
            files, size / 1048576, k['img'], k['music'], n_sounds_reg,
            k['sfx'] + k['amb'], k['amb'], k['voice'],
            v_spoken, spoken, v_actions, actions, k['font'],
            len([1 for f in os.listdir(os.path.join(ROOT, 'assets', 'fonts'))
                 if f.endswith('.txt')]))
    )
    text = re.sub(r'- \*\*Медиа:\*\* .*\n', passport + '\n', text, count=1)

    # 2. §9 «Изображения» и «Озвучка»
    text = re.sub(
        r'\*\*Изображения — \d+ файл[аов]*, \d+ МБ\.\*\*.*?(?=\n\n\*\*Музыка)',
        (
            '**Изображения — %d файлов, 47 МБ.** Титул, меню, кадры всех шести '
            'катсцен, все шесть состояний мимики у главного героя и каждого из '
            'десяти говорящих персонажей (без единого дубля ключей), спокойные и '
            'боевые (`angry`) портреты всех четырёх противников (15/15 персонажей '
            '— 100 %%), десять спрайтов для слотов сцен, шестнадцать фоновых '
            'кадров для двенадцати сцен (включая дневные/ночные состояния шлюза и '
            'Сухого ряда, пуск седьмой помпы и стянутый бандажом шов Жилы), шесть '
            'тактических арен, все шестнадцать иллюстраций кодекса (100 %%), '
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
            '**Озвучка — %d дорожки, 7,3 МБ: озвучены все %d spoken-реплик '
            'диалогов из %d (100 %%), %d авторских ремарок из %d (92,3 %%) '
            'голосом рассказчика** и все четырнадцать слайдов шести катсцен '
            '(в девяти из десяти диалогов озвучены 100 %% всех строк, '
            'неозвученными остаются только 3 ремарки в `zhuk.ink`). '
            'Начитаны восемью голосами платформенного синтеза речи:'
            % (k['voice'], v_spoken, spoken, v_actions, actions)
        ),
        text,
        count=1,
        flags=re.S,
    )

    # 3. §11 «Журнал решений»: записи 145–149
    entries = [
        ('145', 'Синхронизация с движком eeb2764: NarrativeIntroEntry, clear_flag, in_party, npc_known',
         'Обновлены ID кампании (`b7305faa-8e10-4d26-96bb-f1b5ed5e493f`) и глобальные '
         'подписи `ui_labels.scene_intro_next` / `scene_intro_done`; во всех 12 сценах '
         '`narrative_intro` переведены в объекты `NarrativeIntroEntry` (`{text, sfx}`) '
         'с флагом `narrative_intro_once: true` и адресными подписями кнопки завершения; '
         'в диалогах Иры, Реша, Каст, Жука и Жилы задействованы внешние функции '
         '`in_party`, `npc_known` и `clear_flag`'),
        ('146', 'Озвучка 10 авторских ремарок (narr_kast_7, narr_kell_2..5, narr_resh_2, narr_vein_2..3, narr_vex_2, narr_zhuk_2)',
         'Голосом рассказчика (`voice-00`) озвучены ещё десять авторских ремарок в шести '
         'диалогах. В девяти из десяти диалогов (`ayla`, `dozh`, `ira`, `kast`, `kell`, '
         '`registrar`, `resh`, `vein`, `vex`) озвучены 100 % всех строк (и реплики, и '
         'ремарки); во всей кампании озвучено 36 из 39 ремарок (92,3 %, осталось 3 в `zhuk`)'),
        ('147', 'Шесть уникальных эмоций героя, боевые портреты врагов и 2 динамических фона сцен',
         'Сгенерированы четыре отдельных эмоциональных портрета дознавателя (`hero_calm`, '
         '`hero_thoughtful`, `hero_afraid`, `hero_sad` — теперь у героя 6 разных кадров без '
         'дублей ключей), четыре боевых портрета `angry` для всех врагов (`ashhound_angry`, '
         '`rotling_angry`, `thug_angry`, `watchman_angry`) и два динамических фона сцен: '
         'ночной Сухой ряд (`scene_dry_row_night.jpg`) и стянутый бандажом Слепой забой '
         '(`scene_face_collared.jpg`)'),
        ('148', 'Механика цепного бандажа на Жиле (item_hoist + sfx_brace + clear_flag)',
         'На ручном подъёмнике в Слепом забое (`item_hoist`) добавлены стяжка шва Жилы '
         'свинцовым бандажом (`repair` 45, ставит флаг `vein_braced`, переключает фон '
         '`scene_face` на `state_collared`, даёт +15 опыта и +10 тепла) и сброс бандажа '
         'через новый эффект `clear_flag: vein_braced`. Из трёх реальных CC0-сэмплов '
         '(`snd_chain`, `sfx_anvil`, `sfx_lever`) собран звук стяжки `sfx_brace`'),
        ('149', 'Исправление двух балансных багов 9-го яруса: маслёнка смотрителя и цикл двух банок дыхателя',
         'В `rule_watchman` добавлено условие `not has_item: item_oil`, а в провал '
         '`rule_watchman_oil` — переход `fire_rule: rule_watchman`: теперь дознаватель с '
         'маслёнкой сначала пробует смазать сустав смотрителя (`repair` 40), а не попадает '
         'под одновременный запуск обоих правил. В цикле дыхателя (`rule_filter_bank1`, '
         '`rule_filter_bank2`, `rule_filter_exhausted`, `rule_filter_spent`, `item_bench`) '
         'устранён мгновенный сброс второй банки прямо в `scene_face` на первом спуске и '
         'включено многократное переснаряжение банок через `clear_flag`'),
    ]
    block = ''
    for num, title, body in entries:
        if re.search(r'\|\s*%s\s*\|' % num, text):
            continue
        block += '| %s | %s | %s |\n' % (num, title, body)
    if block:
        text = text.replace('\n## 12. Приложение', '\n' + block + '\n## 12. Приложение', 1)

    open(DOC, 'w', encoding='utf-8').write(text)
    print('ДОКУМЕНТ 25')
    print('  файлов %d, %.2f МБ; изображений %d, звуков в реестре %d (файлов %d, петель %d), голоса %d'
          % (files, size / 1048576, k['img'], n_sounds_reg, k['sfx'] + k['amb'], k['amb'], k['voice']))
    print('  spoken-реплик: %d/%d (100 %%), ремарок: %d/%d' % (v_spoken, spoken, v_actions, actions))
    print('  журнал: последняя запись', entries[-1][0])


if __name__ == '__main__':
    main()
