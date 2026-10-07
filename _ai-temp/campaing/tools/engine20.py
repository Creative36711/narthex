#!/usr/bin/env python3
"""Ход 20: что принёс обновлённый движок.

1. Приложение назначило кампании новый id — берём его без изменений.
2. Регламент по ArtDoc: если у состояния сцены или слайда есть растровое
   изображение (`image`), векторную заглушку `art` надо удалять — она
   дублирует картинку сотнями строк и движком не показывается. У нас все
   24 блока `art` лежат рядом с готовыми картинками: удаляем все.
3. `quest_item` наконец попал в схему (в прошлом ходу отправлял об этом
   отзыв): поле официальное, владелец — движок. Сверяем, что все сюжетные
   предметы помечены.

Скрипт идемпотентен.
"""
import glob
import json
import os

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
NEW_ID = 'c5fd16f9-761c-4649-bdad-4708ae9a33f6'
TARGETS = ('scenes/*.json', 'cutscenes/*.json', 'arenas/*.json')


def load(rel):
    with open(os.path.join(ROOT, rel), encoding='utf-8') as fh:
        return json.load(fh)


def save(rel, data):
    with open(os.path.join(ROOT, rel), 'w', encoding='utf-8') as fh:
        json.dump(data, fh, ensure_ascii=False, indent=2)
        fh.write('\n')


def strip_art(node, stat):
    """Удаляет art там, где есть растр. Возвращает новый узел."""
    if isinstance(node, dict):
        out = {}
        for k, v in node.items():
            if k == 'art' and node.get('image'):
                stat['removed'] += 1
                stat['bytes'] += len(json.dumps(v, ensure_ascii=False))
                continue
            out[k] = strip_art(v, stat)
        return out
    if isinstance(node, list):
        return [strip_art(x, stat) for x in node]
    return node


def main():
    # 1. id кампании
    camp = load('campaign.json')
    old_id = camp.get('id')
    camp['id'] = NEW_ID
    save('campaign.json', camp)

    # 2. векторные заглушки под растровыми картинками
    stat = {'removed': 0, 'bytes': 0}
    touched = []
    for pattern in TARGETS:
        for rel in sorted(glob.glob(os.path.join(ROOT, pattern))):
            rel = os.path.relpath(rel, ROOT)
            data = load(rel)
            before = json.dumps(data, ensure_ascii=False, sort_keys=True)
            clean = strip_art(data, stat)
            after = json.dumps(clean, ensure_ascii=False, sort_keys=True)
            if before != after:
                save(rel, clean)
                touched.append(rel)

    # 3. ревизия quest_item
    quest = []
    suspicious = []
    for rel in sorted(glob.glob(os.path.join(ROOT, 'entities/item_*.json'))):
        d = load(os.path.relpath(rel, ROOT))
        is_quest = bool(d.get('quest_item'))
        cat = d.get('category')
        if is_quest:
            quest.append(d['id'])
        elif cat in ('clue', 'key') or d['id'].endswith(('_core', '_valve')):
            suspicious.append('%s (%s)' % (d['id'], cat))

    print('ДВИЖОК 20')
    print('  id кампании: %s → %s' % (old_id, NEW_ID))
    print('  art-заглушек удалено: %d (%.1f КБ), файлов затронуто: %d'
          % (stat['removed'], stat['bytes'] / 1024, len(touched)))
    print('  quest_item стоит на: %s' % ', '.join(quest))
    print('  без пометки, но похоже на сюжетное: %s' % (', '.join(suspicious) or 'нет'))


if __name__ == '__main__':
    main()
