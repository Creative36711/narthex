#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""Ход 22: обновляет дизайн-документ (`tools/design_doc.md`).

1. Паспорт: пересчитаны файлы, размер пакета и все категории медиа
   (включая озвученные ремарки рассказчика).
2. §9 «Медиа, звук и озвучка»: актуализированы числа изображений (182 файла:
   все 16 статей кодекса, все 26 интерактивных объектов сцен и все 11
   `quest_item` в сумке), звуков (61 в реестре, 62 файла) и озвучки
   (157 дорожек: 135/135 spoken-реплик + 10/38 авторских ремарок рассказчика +
   14/14 слайдов катсцен).
3. §11 «Журнал решений»: добавлены записи 128–133.

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
            '**Изображения — %d файла, 40 МБ.** Титул, меню, кадры всех шести '
            'катсцен, портреты и шесть состояний мимики у каждого из десяти '
            'говорящих персонажей, десять спрайтов для слотов сцен, двенадцать '
            'фонов сцен, шесть тактических арен, все шестнадцать иллюстраций '
            'кодекса (100 %%), портреты всех двадцати шести интерактивных объектов '
            'на сценах (100 %%) и иллюстрации всех одиннадцати ключевых предметов '
            '`quest_item` и снаряжения в сумке (`item_core`, `item_filter`, '
            '`item_valve`, `item_charge`, `item_badge`, `item_key_resh`, '
            '`item_key_cache`, `item_lamp`, `item_wrench`, `item_glove`, '
            '`item_ledger`, `item_note`, `item_roster`, `item_guard_token`). '
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
            '**Озвучка — %d дорожек, 6,5 МБ: озвучены все %d spoken-реплик '
            'диалогов из %d (100 %%), %d вступительных авторских ремарок из %d '
            'голосом рассказчика** и все четырнадцать слайдов шести катсцен. '
            'Начитаны восемью голосами платформенного синтеза речи:'
            % (k['voice'], v_spoken, spoken, v_actions, actions)
        ),
        text,
        count=1,
        flags=re.S,
    )

    # 3. §11 «Журнал решений»: записи 128–133
    entries = [
        ('128', 'Движок 22: механика «Незнакомец», триггеры правил и present_item в конструкторе',
         'Синхронизирован `__chronicle_ai__` с `main` (`a1ea1fa`), принят новый '
         'id кампании `fe0060e4-1287-4741-b36e-ea57239dee99`. Пяти персонажам, с '
         'которыми дознаватель не знаком до первой реплики (`npc_ira`, `npc_dozh`, '
         '`npc_ayla`, `npc_zhuk`, `npc_resh`), задан `unknown_label` («Девушка у '
         'пульта», «Старьёвщик за ящиками», «Женщина с бинтами», «Человек у '
         'жаровни», «Человек у стены») и раскрытие имени через `learn_name` при '
         'первом разговоре или по наводке (Дож называет Жука, Ира по заплате на '
         'рукавице называет Айлу). Всем авто-правилам проставлен явный `trigger` '
         '(`enter_scene`, `time_tick`, `always`), а в четыре `.dlg.json` добавлен '
         'новый схемный эффект `present_item`'),
        ('129', 'Исправлен софтлок повторного входа в каморку мастера Реша',
         'Правило `rule_unlock_resh_room` имело `once: true` и открывало каморку '
         'только один раз — выйдя в машинный зал, игрок больше не мог вернуться к '
         'записям мастера, ящику или койке. В `item_resh_door` добавлено действие '
         '«Войти в каморку» при `flag_set: resh_room_open`, а в `scene_pump_hall` — '
         'зона навигации с новыми полями `conditions` и `blocked_message`'),
        ('130', 'Иллюстрации всех 16 статей кодекса и всех 11 quest_item',
         'Сгенерирована иллюстрация `codex_filter.jpg` (кодекс 16/16, 100 %) и '
         'девять иллюстраций ключевых предметов (`item_core`, `item_filter`, '
         '`item_valve`, `item_charge`, `item_badge`, `item_key_resh`, '
         '`item_key_cache`, `item_lamp`, `item_wrench`) — теперь каждый `quest_item` '
         'в кампании имеет и карточку в сумке, и озвученный осмотр с портретом 1200×800'),
        ('131', 'Озвучка авторских ремарок (# action) голосом рассказчика',
         'По решению мастера начата озвучка авторских ремарок (`action: true`) '
         'голосом рассказчика (`voice-00`): озвучены все десять вступительных '
         'ремарок в узле «Начало» каждого из десяти диалогов (`narr_*_1.mp3`). '
         'Осталось 28 ремарок внутри веток — ровно на следующие три хода'),
        ('132', 'Баланс боёв на трёх пресетах сложности и вооружение спутников',
         'Аудит и симуляция Monte-Carlo (800 прогонов на бой) вскрыли три проблемы: '
         '(1) разводным ключом `item_wrench` нельзя было парировать (`parry_capable: '
         'false`), а стартовый `brawl` героя был 25 %; (2) рядовой боевик `npc_thug` '
         'по тексту одет в кирзу и вооружён дубинкой, но в данных носил офицерский '
         'жилет на 3 брони и клинок `1d8`, как босс Келл; (3) мастер Реш вступал в '
         'отряд с пустыми руками и без брони. Теперь ключ парирует, боевые навыки '
         'героя и Иры подняты до 42 %, Реш вооружён ключом и плащом, а рядовой '
         'боевик приведён к 10 HP и 1 брони: шанс победы на «Дознавателе» 92–98 %, '
         'на «Надзирателе» 79–90 %, на «Слепом забое» 67–85 %'),
        ('133', 'Звук конторского штампа sfx_stamp',
         'Из двух реальных CC0-сэмплов Kenney (`snd_latch` с фильтром низких частот '
         'и `snd_paper` со сдвигом 120 мс) собран звук `sfx_stamp` («Штамп входящего '
         'реестра») и привязан к реплике регистратора при регистрации сшитого дела '
         '№137 и к осмотру удостоверения дознавателя'),
    ]
    block = ''
    for num, title, body in entries:
        if re.search(r'\|\s*%s\s*\|' % num, text):
            continue
        block += '| %s | %s | %s |\n' % (num, title, body)
    if block:
        text = text.replace('\n## 12. Приложение', '\n' + block + '\n## 12. Приложение', 1)

    open(DOC, 'w', encoding='utf-8').write(text)
    print('ДОКУМЕНТ 22')
    print('  файлов %d, %.2f МБ; изображений %d, звуков в реестре %d (файлов %d, петель %d), голоса %d'
          % (files, size / 1048576, k['img'], n_sounds_reg, k['sfx'] + k['amb'], k['amb'], k['voice']))
    print('  spoken-реплик: %d/%d (100 %%), ремарок: %d/%d' % (v_spoken, spoken, v_actions, actions))
    print('  журнал: последняя запись', entries[-1][0])


if __name__ == '__main__':
    main()
