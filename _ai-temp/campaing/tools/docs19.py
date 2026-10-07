#!/usr/bin/env python3
"""Ход 19: обновляет дизайн-документ кампании.

Что меняем в tools/design_doc.md (он же campaign.design_doc):
1. Паспорт: пересчитаны файлы и медиа.
2. §8 «Рамки баланса»: добавлена таблица потребностей — цифры, которые
   реально лежат в файлах после правки баланса этого хода.
3. §11 «Журнал решений»: записи 107–115 про срок в HUD, типографику,
   звуки панелей, портреты предметов, озвучку, воздух, жажду, уголь и звук угля.
4. Приложение: список кодекса приведён к текущим 15 записям.

Скрипт идемпотентен: повторный запуск не дублирует записи.
"""
import json
import os
import re
import zipfile

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
DOC = os.path.join(ROOT, 'tools', 'design_doc.md')
ZIP = os.path.join(ROOT, 'campaign-1.chronicle')


def pack_files():
    """Тот же состав, что кладёт tools/pack.py: модули по манифесту,
    диалоги, assets и три корневых файла."""
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
    return files


def media_stats():
    """Считает медиа по составу пакета (как tools/pack.py)."""
    files = pack_files()
    size = 0
    kinds = {'img': 0, 'music': 0, 'sfx': 0, 'amb': 0, 'voice': 0, 'font': 0}
    for rel in files:
        p = os.path.join(ROOT, rel)
        if os.path.exists(p):
            size += os.path.getsize(p)
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
    if os.path.exists(ZIP):
        # паспорт исторически сверяют с тем, что печатает tools/pack.py,
        # а он называет размер собранного архива
        size = os.path.getsize(ZIP)
    return len(files), size, kinds


def main():
    text = open(DOC, encoding='utf-8').read()

    # ── 1. паспорт ──────────────────────────────────────────────────────
    files, size, k = media_stats()
    passport = ('- **Медиа:** %d файлов, %.2f МБ: %d изображения, %d музыкальных треков, '
                'звуков — %d (из них %d фоновых петель), файлов озвучки — %d '
                '(115 реплик диалогов и слайды катсцен), %d файлов шрифтов и %d лицензии к ним. '
                'Всё лежит внутри пакета и ссылается относительными путями. '
                'Синтезированного звука в пакете нет: каждая петля и каждый звук — '
                'запись или сэмпл из CC0-набора.' % (
                    files, size / 1048576, k['img'], k['music'], k['sfx'] + k['amb'],
                    k['amb'], k['voice'], k['font'],
                    len([1 for f in os.listdir(os.path.join(ROOT, 'assets', 'fonts'))
                         if f.endswith('.txt')])))
    text = re.sub(r'- \*\*Медиа:\*\* .*\n', passport + '\n', text, count=1)

    # ── 2. таблица потребностей в §8 ────────────────────────────────────
    if '### Потребности' not in text:
        needs = """
### Потребности

Цифры — из `campaign.needs` и правил на ноль. Потребность не наказывает за
само падение: она наказывает за ноль, а до нуля предупреждает статусом
(правила `rule_warn_*` на условии `need_le`).

| Потребность | Расход | Красная зона | На нуле | Где пополнить |
| --- | --- | --- | --- | --- |
| Дыхание | 4,0/ч — только на восьмом и девятом ярусе и только без дыхателя | 25 | `rule_zero_air`: удушье (2 здоровья в час, 8 часов), −3 здоровья | вне нижних ярусов +8/ч; узел на трубе +25; дыхатель снимает расход на две банки |
| Тепло | 1,2/ч | 25 | `rule_zero_warmth` | печка +40 (нужен уголь), жаровня +35, койка +15, похлёбка +20 |
| Еда | 0,9/ч | 20 | `rule_zero_food`: −5 здоровья и статус «Голод» | паёк +38, похлёбка +55 |
| Вода | 1,1/ч | 20 | `rule_zero_thirst`: −4 здоровья и статус «Сухость» | вода +45, кипяток +30 (нужен уголь) |
| Сон | 0,8/ч | 20 | `rule_zero_rest` | койка: 8 часов, +100 |

Вылазка вниз по критическому пути — около девятнадцати часов. Без дыхателя
это 76 из 100: герой выходит наверх в красной зоне, а каждый лишний обыск
внизу — уже удушье. С дыхателем расхода нет, но банки считаются: две на спуск
и на подъём, на третий спуск маска не держит.

Смета времени (считает `tools/time_budget.py`): критический путь — 36 часов,
добросовестный — 52, полный — 78. Срок дела — 72: полный проход в срок не
влезает, и это сделано намеренно.

"""
        text = text.replace('\n**Противники.**', needs + '**Противники.**', 1)

    # ── 3. журнал решений ───────────────────────────────────────────────
    entries = [
        ('107', 'Срок дела вышел на экран',
         'Движок дал `deadline_ticks` и `deadline_label`: в HUD висит «До срока» — '
         'семьдесят два часа от приезда героя (старт в семь утра, вода идёт на 79-м тику). '
         'Меньше суток — цифра янтарная, после нуля — красная и мигает. Раньше срок жил '
         'только в тексте и в двух правилах на тиках'),
        ('108', 'Мелкий текст в панелях',
         'Поднята типографика: `theme.font_scale` 1,05, кегли body 16 / display 21 / '
         'диалог 16 / интерфейс 14, `line_height` 1,6, `letter_spacing` 0,01em. '
         'Рукописные гарнитуры размером подтянуты порознь: Neucha ×1,2 и Marck Script ×1,3, '
         'заголовочная Russo One, наоборот, сбавлена до ×0,95'),
        ('109', 'Звуки панелей: синонимы и выдумки',
         '`panel:log` и `panel:journal` — один и тот же журнал расследования, '
         '`panel:meta` и `panel:chronicle` — одна хроника: в прошлом ходе им назначили '
         'разные звуки, и одна панель звучала по-разному. Теперь у синонимов один звук. '
         'Ключи `panel:quest*` удалены: движок их не знает, они были выдуманы. Хуков — 54'),
        ('110', 'У предметов появились портреты',
         'Десять кадров 1200×800: дело №137, привод помпы, механизм затвора, стол дознавателя, '
         'стеллаж архива, дверь мастера, верстак, записи Реша, схрон и тело стража Ярова. '
         'Раньше у интерактивных предметов не было ни одного'),
        ('111', 'Озвучка: 115 реплик из 156',
         'Десять новых реплик: регистратор объясняет срок, Жила впервые говорит о помпах и о '
         'молчании, Айла — про бессонные двое суток и настой для спуска, Векс — про журнал и '
         'про девятый ярус, Реш — про то, почему семёрку не чинили, Ира — про брата. '
         'Закрыта старая дыра `vein_6`. Авторские ремарки (144) не озвучиваются намеренно'),
        ('112', 'Воздух перестал быть декорацией',
         'Расход был 2,5/ч: вылазка вниз съедала меньше половины шкалы, и без дыхателя было '
         'просто комфортно — вся подсистема маски ничего не значила. Стало 4,0/ч: без маски '
         'герой выходит наверх в красной зоне, а лишний обыск внизу — удушье и минус два '
         'здоровья в час. С маской расхода нет, но банки считаются'),
        ('113', 'У жажды не было своего нуля',
         '`need_thirst` ссылалась на `rule_zero_food` — то же правило, что и у голода, '
         'с `once:true`. Какая потребность обнулилась первой, та и забирала правило, вторая '
         'не получала ничего. Появилась `rule_zero_thirst` и статусы нужды: `status_hunger`, '
         '`status_thirst`, `status_weary`; четыре правила на `need_le` предупреждают до нуля'),
        ('114', 'Тепло снова чего-то стоит',
         'Печка и жаровня были бесконечными: час времени — +40 тепла при расходе 1,2/ч, то есть '
         'тепло можно было держать вечно. Печка теперь требует уголь (`item_coal`: старт 3, '
         'ящик +2, Дож 12 штук по 3 марки, Векс 8 штук по 4), а обе грелки работают только '
         'ниже 70 — греться впрок нельзя. Жаровню кормит весь Сухой ряд, поэтому она бесплатна'),
        ('115', 'Уголь зазвучал',
         'Новый звук `snd_coal` — два настоящих CC0-сэмпла Kenney (тяжёлый удар по дереву и по '
         'металлу) в одном id: движок выбирает вариант, поэтому «бросаешь уголь» не звучит '
         'дважды одинаково. `sfx_file` («Бумага в папку») был зарегистрирован, но не привязан '
         'ни к одному хуку интерфейса — привязан к открытию справки'),
    ]
    block = ''
    for num, title, body in entries:
        if re.search(r'\|\s*%s\s*\|' % num, text):
            continue
        block += '| %s | %s | %s |\n' % (num, title, body)
    if block:
        text = text.replace('\n## 12. Приложение', '\n' + block + '\n## 12. Приложение', 1)

    # ── 4. приложение: кодекс ───────────────────────────────────────────
    codex = sorted(json.load(open(os.path.join(ROOT, 'codex', f), encoding='utf-8'))['id']
                   for f in os.listdir(os.path.join(ROOT, 'codex')) if f.endswith('.json'))
    labels = {json.load(open(os.path.join(ROOT, 'codex', f), encoding='utf-8'))['id']:
              json.load(open(os.path.join(ROOT, 'codex', f), encoding='utf-8')).get('label')
              for f in os.listdir(os.path.join(ROOT, 'codex')) if f.endswith('.json')}
    line = ('| Кодекс | %d записи: %s |' %
            (len(codex), ', '.join(labels[c] for c in codex)))
    text = re.sub(r'\| Кодекс \| .*?\|', line, text, count=1)

    open(DOC, 'w', encoding='utf-8').write(text)
    print('ДОКУМЕНТ 19')
    print('  файлов в пакете: %d, %.0f МБ; изображений %d, звуков %d, голоса %d'
          % (files, size / 1024 / 1024, k['img'], k['sfx'] + k['amb'], k['voice']))
    print('  потребности: раздел добавлен' if '### Потребности' in text else '  потребности: УЖЕ БЫЛ')
    present = sum(1 for n, _, _ in entries if re.search(r'\|\s*%s\s*\|' % n, text))
    print('  журнал: записей в документе — %d (последняя %s)' % (present, entries[-1][0]))
    print('  кодекс: %d записей' % len(codex))


if __name__ == '__main__':
    main()
