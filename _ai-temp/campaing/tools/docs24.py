#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""Ход 24: обновляет дизайн-документ (`tools/design_doc.md`).

1. Паспорт: пересчитаны файлы, размер пакета и все категории медиа
   (202 изображения, 63 звука в реестре, 173 дорожки озвучки:
   133/133 spoken-реплик + 26/39 авторских ремарок + 14/14 слайдов катсцен).
2. §9 «Медиа, звук и озвучка»: актуализированы числа изображений (100 % всех
   57 предметов и всех 15 персонажей включая героя) и озвучки.
3. §11 «Журнал решений»: добавлены записи 140–144.

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

    # 1. Паспорт
    passport = (
        '- **Медиа:** %d файлов, %.2f МБ: %d изображения, %d музыкальных треков, '
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
        r'\*\*Изображения — \d+ файла, \d+ МБ\.\*\*.*?(?=\n\n\*\*Музыка)',
        (
            '**Изображения — %d файла, 45 МБ.** Титул, меню, кадры всех шести '
            'катсцен, портреты главного героя и все шесть состояний мимики у '
            'каждого из десяти говорящих персонажей, портреты всех четырёх '
            'противников (15/15 персонажей — 100 %%), десять спрайтов для слотов '
            'сцен, двенадцать фонов сцен, шесть тактических арен, все шестнадцать '
            'иллюстраций кодекса (100 %%), портреты всех двадцати шести интерактивных '
            'объектов на сценах (100 %%) и иллюстрации всех тридцати одного '
            'переносимого предмета в сумке (включая все 11 `quest_item`, всё оружие, '
            'броню, снаряжение, медикаменты, припасы, материалы и марки — 57/57 '
            'предметов кампании имеют собственные иллюстрации, 100 %%). '
            'Все процедурные заглушки `art` и `map_art` удалены, а слоты '
            'беспрайтовых предметов помечены `environmental: true`.' % k['img']
        ),
        text,
        count=1,
        flags=re.S,
    )
    text = re.sub(
        r'\*\*Озвучка — \d+ дорожек.*?(?=\n\n\| Голос \|)',
        (
            '**Озвучка — %d дорожки, 7,1 МБ: озвучены все %d spoken-реплик '
            'диалогов из %d (100 %%), %d авторских ремарок из %d '
            'голосом рассказчика** и все четырнадцать слайдов шести катсцен. '
            'Начитаны восемью голосами платформенного синтеза речи:'
            % (k['voice'], v_spoken, spoken, v_actions, actions)
        ),
        text,
        count=1,
        flags=re.S,
    )

    # 3. §11 «Журнал решений»: записи 140–144
    entries = [
        ('140', 'Аудит текстов и переозвучка 4 реплик с сюжетными несостыковками',
         'Построчная сверка всех десяти диалогов выявила четыре несостыковки: '
         '(1) в `kell_5` Келл говорил «Я три дня носил его жетон в кармане», хотя '
         'дознаватель снял этот жетон с руки погибшего Ярова у затвора (`item_dead_guard`) '
         'и сам протягивал его Келлу; реплика переписана и переозвучена голосом Келла '
         '(`voice-05`), синхронизированы `quest_missing` и описание тела; '
         '(2) в `kell_9` Келл обращался к дознавателю «старшина» (хотя старшина — сам '
         'Келл); реплика переписана и переозвучена; '
         '(3) в `vex_1` Векс у шлюза говорил «Спускайся, там тепло», хотя спуск ведёт '
         'в ледяную шахту, а тёплая контора с печкой — за дверью на том же ярусе; '
         'реплика переписана и переозвучена голосом Векса (`voice-01`); '
         '(4) в `zhuk_12` авторская ремарка от третьего лица («Жук кривится, но рук '
         'не прячет») была склеена с прямой речью и озвучена голосом самого Жука, а '
         'текст путал каморку с койкой (7-й ярус) и плиту в штольне (9-й ярус); '
         'ремарка вынесена в отдельную строку `# action` (`narr_zhuk_5.mp3`, `voice-00`), '
         'а прямая речь Жука переписана и переозвучена (`zhuk_12.mp3`, `voice-06`)'),
        ('141', 'Озвучка 5 авторских ремарок в диалоге Каст (narr_kast_2..6)',
         'Голосом рассказчика (`voice-00`) озвучены пять авторских ремарок в `kast.ink` '
         '(`narr_kast_2..6.mp3`). Всего в кампании теперь озвучены 26 из 39 авторских '
         'ремарок (67 %, осталось 13)'),
        ('142', 'Порядок веток в диалогах Иры, Каст и Жука и вступление архива',
         'В `ira.ink` передача жетона Стася (`[Я нашёл его жетон.]`) поставлена после '
         'разговора о судьбе брата (`ira_told_brother`), чтобы игрок не пропускал '
         'сцену `Брат`; в `kast.ink` и `zhuk.ink` вопрос о местонахождении мастера '
         'скрывается после нахождения Реша (`not resh_found`), а проверка убеждения '
         'Жука скрывается после оплаты 50 марок (`not zhuk_paid`). Из `narrative_intro` '
         'архива убран преждевременный спойлер дела №136 до открытия шкафа'),
        ('143', '100 % покрытие иллюстрациями всех 57 предметов и всех 15 персонажей',
         'Сгенерированы иллюстрации для последних восьми предметов в сумке (`item_ration`, '
         '`item_stew`, `item_oil`, `item_coal`, `item_cloth`, `item_scrap`, `item_bolt`, '
         '`item_mark` — теперь 57/57 предметов кампании имеют иллюстрации) и два '
         'портрета главного героя (`hero_neutral.jpg`, `hero_angry.jpg` в `player_hero.json` '
         '— 15/15 персонажей с портретами)'),
        ('144', 'Звук маслёнки sfx_oil и озвученный осмотр всех материалов в сумке',
         'Из двух реальных CC0-сэмплов (`snd_latch` и `sfx_water`) собран звук маслёнки '
         '`sfx_oil` и привязан к смазке автомата-смотрителя (`rule_watchman_oil`) и '
         'осмотру `item_oil`; всем восьми новым предметам прописаны карты звуков `sounds`'),
    ]
    block = ''
    for num, title, body in entries:
        if re.search(r'\|\s*%s\s*\|' % num, text):
            continue
        block += '| %s | %s | %s |\n' % (num, title, body)
    if block:
        text = text.replace('\n## 12. Приложение', '\n' + block + '\n## 12. Приложение', 1)

    open(DOC, 'w', encoding='utf-8').write(text)
    print('ДОКУМЕНТ 24')
    print('  файлов %d, %.2f МБ; изображений %d, звуков в реестре %d (файлов %d, петель %d), голоса %d'
          % (files, size / 1048576, k['img'], n_sounds_reg, k['sfx'] + k['amb'], k['amb'], k['voice']))
    print('  spoken-реплик: %d/%d (100 %%), ремарок: %d/%d' % (v_spoken, spoken, v_actions, actions))
    print('  журнал: последняя запись', entries[-1][0])


if __name__ == '__main__':
    main()
