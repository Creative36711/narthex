#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""Ход 20: обновляет дизайн-документ.

1. Паспорт: пересчитаны файлы и медиа.
2. §8 «Потребности»: цифры после правки баланса — расход вырос, потому что
   прежний не заставлял ничего делать; добавлена смета по трём проходам.
3. §11 «Журнал решений»: записи 116–121.
4. Приложение: список улик приведён к шести (рукавица наконец настоящая).

Скрипт идемпотентен.
"""
import json
import os
import re
import zipfile

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
DOC = os.path.join(ROOT, 'tools', 'design_doc.md')
ZIP = os.path.join(ROOT, 'campaign-1.chronicle')

DECAY = (('Тепло', '1,5'), ('Еда', '1,3'), ('Вода', '1,4'), ('Сон', '1,0'))


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


def main():
    text = open(DOC, encoding='utf-8').read()
    files, size, k = media_stats()

    # 1. паспорт
    voiced = 0
    for f in os.listdir(os.path.join(ROOT, 'dialogues')):
        if f.endswith('.dlg.json'):
            voiced += json.load(open(os.path.join(ROOT, 'dialogues', f),
                                     encoding='utf-8')).__str__().count("'voice'")
    passport = ('- **Медиа:** %d файлов, %.2f МБ: %d изображения, %d музыкальных треков, '
                'звуков — %d в реестре (%d файлов: у «Уголь в печку» два варианта), '
                'из них %d фоновых петель, файлов озвучки — %d '
                '(%d реплик диалогов и слайды катсцен), %d файлов шрифтов и %d лицензии к ним. '
                'Всё лежит внутри пакета и ссылается относительными путями. '
                'Синтезированного звука в пакете нет: каждая петля и каждый звук — '
                'запись или сэмпл из CC0-набора.' % (
                    files, size / 1048576, k['img'], k['music'], k['sfx'] + k['amb'] - 1,
                    k['sfx'] + k['amb'], k['amb'], k['voice'], voiced, k['font'],
                    len([1 for f in os.listdir(os.path.join(ROOT, 'assets', 'fonts'))
                         if f.endswith('.txt')])))
    text = re.sub(r'- \*\*Медиа:\*\* .*\n', passport + '\n', text, count=1)

    # 2. потребности
    for label, val in DECAY:
        text = re.sub(r'\| %s \| [0-9,]+/ч \|' % label,
                      '| %s | %s/ч |' % (label, val), text, count=1)

    marker = 'Смета времени (считает `tools/time_budget.py`)'
    if '| критический | 36 |' not in text:
        table = """
Сколько это стоит игроку, по сметам `tools/time_budget.py`:

| Проход | Часов | Голод | Жажда | Тепло | Сон | Что надо сделать |
| --- | --- | --- | --- | --- | --- | --- |
| критический | 36 | 47 | 50 | 54 | 36 | ничего: скорость сама по себе награда |
| добросовестный | 52 | 68 | 73 | 78 | 52 | похлёбка, вода и час у жаровни |
| полный | 78 | 101 | 109 | 117 | 78 | часов десять на еду, воду и тепло — и срок всё равно выйдет |

Кто бежит — тот не ест. Кто копает всё подряд — платит часами, которых нет.

"""
        text = text.replace(marker, table + marker, 1)

    # 3. журнал
    entries = [
        ('116', 'Движок 20: id, заглушки и quest_item',
         'Кампании назначен новый id — берём без изменений. Из регламента про ArtDoc: '
         'рядом с растровой картинкой векторная заглушка не нужна. У нас все 24 блока `art` '
         'лежали под готовыми изображениями — удалены, минус 68,6 КБ служебного JSON. '
         'И `quest_item` наконец в схеме: в прошлом ходу про это отправляли отзыв, теперь поле '
         'официальное и валидатор его знает'),
        ('117', 'Рукавица с привода: шестая улика, которой не было',
         'Документ с первого хода описывает шесть улик и называет среди них «рукавицу под приводом». '
         'В кампании её не было: проверка «Осмотреть привод» ставила флаг и двигала счётчик, '
         'но ничего в руки не давала, — остальные пять улик настоящие, и их можно пришить к делу. '
         'Рукавица стала предметом: её находят в масляном поддоне, Ира узнаёт заплату, '
         'которую штопают в Сухом ряду, Келл отводит разговор, и её можно подшить. '
         '«Сшить дело» вместо десяти перечисленных четвёрок считает переменную `case_filed`'),
        ('118', 'Еда, вода и тепло перестали быть декорацией',
         'Расход 0,9 / 1,1 / 1,2 в час: за добросовестный проход (52 часа) ни одна потребность '
         'не спускалась даже в красную зону — ни паёк, ни вода, ни печка были не нужны. '
         'Стало 1,3 / 1,4 / 1,5 (сон 1,0): быстрый проход по-прежнему ничего не тратит, добросовестный тратит '
         'на похлёбку, воду и жаровню три-четыре часа, а полный — около десяти, и срок '
         'за это выйдет. Деньги сводятся: за проход около 47 марок, дыхатель стоит 34, '
         'но его собирают на верстаке из тряпья, лома и ключа с привода'),
        ('119', 'Удушье перестало быть приговором',
         'У дознавателя около 10 здоровья. «Воздух кончился» снимал 3 сразу и по 2 в час восемь '
         'часов — минус 19 при десяти: ошибка в расчёте воздуха стоила жизни без шанса выбраться. '
         'Теперь −1 сразу и −1 в час: герой выползает наверх на последнем здоровье и с −15 '
         'к следствию и вниманию, но живой'),
        ('120', 'Поверхность загудела',
         'Три сцены — приёмная Надзора, архив и будка смотрителя — стояли в тишине: фонового слоя '
         'для верхних ярусов не было. Появился «Гул города»: срез записи работы помп, приглушённый '
         'фильтром низких частот и зацикленный кроссфейдом, чтобы петля не щёлкала. '
         'Заодно из реестра убраны `sfx_log_open` и `sfx_log_close`: они нигде не звучали, '
         'потому что журнал расследования — это и есть панель с собственными звуками'),
        ('121', 'Десять портретов и десять реплик',
         'Портреты получили рукавица, койка, печка, жаровня, трубы, шкафчик, лебёдка, лестница, '
         'отдушина и доска объявлений — осталось шесть предметов. Новые реплики связаны с новым '
         'содержанием: жила добрала три фразы до десяти, Дож и Векс объясняют, почему уголь '
         'дороже воды, Айла узнаёт заплату на рукавице, Реш читает срез муфты, а регистратор '
         'произносит главное правило конторы: срок не продлевают — его переписывают'),
    ]
    block = ''
    for num, title, body in entries:
        if re.search(r'\|\s*%s\s*\|' % num, text):
            continue
        block += '| %s | %s | %s |\n' % (num, title, body)
    if block:
        text = text.replace('\n## 12. Приложение', '\n' + block + '\n## 12. Приложение', 1)

    # 4. приложение: улики
    text = re.sub(r'\| Предметы-улики \| .*?\|',
                  '| Предметы-улики | `item_glove`, `item_note`, `item_plate`, `item_ledger`, '
                  '`item_guard_token`, `item_roster` — шесть; ключевой предмет `item_core`; '
                  'счётчик — переменная `clues`, порог 3 |', text, count=1)

    open(DOC, 'w', encoding='utf-8').write(text)
    print('ДОКУМЕНТ 20')
    print('  файлов %d, %.2f МБ; изображений %d, звуков %d (петель %d), голоса %d'
          % (files, size / 1048576, k['img'], k['sfx'] + k['amb'], k['amb'], k['voice']))
    print('  озвученных реплик:', voiced)
    print('  журнал: последняя запись', entries[-1][0])


if __name__ == '__main__':
    main()
