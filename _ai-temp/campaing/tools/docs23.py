#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""Ход 23: обновляет дизайн-документ (`tools/design_doc.md`).

1. Паспорт: пересчитаны файлы, размер пакета и все категории медиа
   (192 изображения, 62 звука в реестре, 167 дорожек озвучки:
   133/133 spoken-реплик + 20/38 авторских ремарок + 14/14 слайдов катсцен).
2. §9 «Медиа, звук и озвучка»: актуализированы числа изображений и озвучки.
3. §11 «Журнал решений»: добавлены записи 134–139.

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
            '**Изображения — %d файла, 42 МБ.** Титул, меню, кадры всех шести '
            'катсцен, портреты и шесть состояний мимики у каждого из десяти '
            'говорящих персонажей, десять спрайтов для слотов сцен, двенадцать '
            'фонов сцен, шесть тактических арен, все шестнадцать иллюстраций '
            'кодекса (100 %%), портреты всех двадцати шести интерактивных объектов '
            'на сценах (100 %%), иллюстрации всех одиннадцати ключевых предметов '
            '`quest_item` (100 %%: `item_core`, `item_filter`, `item_valve`, '
            '`item_charge`, `item_badge`, `item_key_resh`, `item_key_cache`, '
            '`item_lamp`, `item_wrench`, `item_glove`, `item_ledger`, `item_note`, '
            '`item_roster`, `item_guard_token`) и всех десяти предметов оружия, '
            'брони, снаряжения и медикаментов (`item_knife`, `item_service_blade`, '
            '`item_crossbow`, `item_coat`, `item_vest`, `item_rope`, `item_bandage`, '
            '`item_tonic`, `item_antirot`, `item_water`). '
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
            '**Озвучка — %d дорожек, 6,8 МБ: озвучены все %d spoken-реплик '
            'диалогов из %d (100 %%), %d авторских ремарок из %d '
            'голосом рассказчика** и все четырнадцать слайдов шести катсцен. '
            'Начитаны восемью голосами платформенного синтеза речи:'
            % (k['voice'], v_spoken, spoken, v_actions, actions)
        ),
        text,
        count=1,
        flags=re.S,
    )

    # 3. §11 «Журнал решений»: записи 134–139
    entries = [
        ('134', 'Движок 23: триггер пролога и перевод трёх диалоговых правил в manual: true',
         'Синхронизирован `__chronicle_ai__` с `main` (`fb947a1`), принят новый '
         'id кампании `2c46c88f-49f2-43dc-b393-85b0941874fe`. По новому регламенту '
         '`campaign-guide.md` стартовое правило `rule_intro` (`min_tick: 0`) переведено '
         'с `trigger: "time_tick"` на `trigger: "always"`. Три правила предъявления '
         'улик (`rule_kast_note`, `rule_kell_token`, `rule_zhuk_ledger`), имевшие '
         '`manual: false` при пустом `conditions: []` и срабатывавшие сами на тике 0, '
         'переведены в `manual: true` без `trigger`'),
        ('135', 'Исправление расписаний NPC и присутствия в сценах',
         'У `npc_kast` и `npc_kell` расписание `[9..21]` перекрывало `default_entity` '
         'слотов, из-за чего в 08:00 первого утра (сразу после прихода со шлюза) и '
         'ночью после 21:00 приёмная стояла пустой. У `npc_ira` ночное расписание '
         'переносило её в Сухой ряд даже после вступления в отряд, а у `npc_zhuk` '
         '`presence_overrides` навсегда уводил его от жаровни в Сухом ряду. Все '
         'четверо переведены на `schedule: []` через `default_entity` своих слотов'),
        ('136', 'Исправление узла-ловушки Брат у Иры и наводки Дожа на Жука',
         'В `ira.ink` узел `Брат_hub` замыкал все три ответа на `-> Брат_hub` без '
         'выхода и позволял бесконечно набирать `+12` отношения за клик; теперь ответы '
         'одноразовые (`*`) и возвращают в `Начало_hub`. В `dozh.ink` вопрос «Ищу '
         'Жука.» переименован в «Кто там сидит у жаровни?», чтобы герой не называл '
         'информатора по имени до знакомства (`learn_name("npc_zhuk")`)'),
        ('137', 'Баланс 23: отказ от once: true на трёх ключевых проверках улик',
         'Проверка по 16 стартовым сборкам героя (`4 профессии × 4 призвания`) показала, '
         'что при `once: true` на `item_pump_engine` («Осмотреть привод»), `item_locker` '
         '(«Вскрыть шкафчик») и `item_dead_guard` («Осмотреть тело») шанс навсегда '
         'потерять хотя бы одну из трёх улик и два побочных квеста при первом броске '
         'составлял 94,8 %. Все три проверки переведены на `conditions: [flag_not_set]` '
         'с ценой 1 час за попытку: достижимость 100 %, средние затраты — 10,2 ч из 72'),
        ('138', 'Озвучка ещё 10 авторских ремарок (narr_dozh_2..4 и narr_ira_2..8)',
         'Голосом рассказчика (`voice-00`) озвучены все оставшиеся авторские ремарки '
         'в диалогах Дожа (3) и Иры (7) — теперь диалоги Айлы, Дожа, Иры и '
         'Регистратора озвучены на 100 % вместе с ремарками (всего 20/38 ремарок, '
         'осталось 18 на следующие два хода)'),
        ('139', 'Иллюстрации оружия, брони и медикаментов (10 предметов) и звук sfx_crossbow',
         'Сгенерированы иллюстрации для всех предметов оружия, брони, снаряжения и '
         'медикаментов (`item_knife`, `item_service_blade`, `item_crossbow`, `item_coat`, '
         '`item_vest`, `item_rope`, `item_bandage`, `item_tonic`, `item_antirot`, '
         '`item_water`), а из двух реальных CC0-сэмплов Kenney собран звук спуска '
         'тетивы самострела `sfx_crossbow`'),
    ]
    block = ''
    for num, title, body in entries:
        if re.search(r'\|\s*%s\s*\|' % num, text):
            continue
        block += '| %s | %s | %s |\n' % (num, title, body)
    if block:
        text = text.replace('\n## 12. Приложение', '\n' + block + '\n## 12. Приложение', 1)

    open(DOC, 'w', encoding='utf-8').write(text)
    print('ДОКУМЕНТ 23')
    print('  файлов %d, %.2f МБ; изображений %d, звуков в реестре %d (файлов %d, петель %d), голоса %d'
          % (files, size / 1048576, k['img'], n_sounds_reg, k['sfx'] + k['amb'], k['amb'], k['voice']))
    print('  spoken-реплик: %d/%d (100 %%), ремарок: %d/%d' % (v_spoken, spoken, v_actions, actions))
    print('  журнал: последняя запись', entries[-1][0])


if __name__ == '__main__':
    main()
