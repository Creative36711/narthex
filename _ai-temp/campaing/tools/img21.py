#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""Ход 21: последние шесть портретов интерактивных предметов на сценах
и четыре иллюстрации главных улик в сумке дознавателя.

После этого скрипта:
- все 26 интерактивных предметов на сценах имеют портрет 1200×800 (100 %);
- все пять переносимых улик дела №137 (`item_ledger`, `item_note`,
  `item_roster`, `item_guard_token`, `item_glove`) имеют и `image` для
  сумки и окна предъявления улики, и `portrait.neutral` с действием осмотра.

Скрипт идемпотентен.
"""
import json
import os

from PIL import Image

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SIZE = (1200, 800)

SCENE_ITEMS = [
    'item_crate', 'item_debris', 'item_marker',
    'item_niche', 'item_plate', 'item_winch',
]

CLUE_ITEMS = {
    'item_ledger': {
        'label': 'Сверить последнюю страницу',
        'hint': 'подпись и статья расхода',
        'sound': 'sfx_flip',
        'text': (
            'В графе «Седьмая помпа — режим тишины» проведены сорок две марки '
            'на караульную партию и две свинцовые пломбы №13-К. Рука ровная, '
            'чернила конторские, подпись внизу листа — В. Каст.'
        ),
    },
    'item_note': {
        'label': 'Перечитать записку мастера',
        'hint': 'почерк Реша и пятно мазута',
        'sound': 'snd_paper',
        'text': (
            'Бумага сложена вчетверо и пахнет керосином: «Муфту срезали '
            'изнутри, а не сорвало. На приводе осталась чужая рукавица. '
            'Если со мной что случится — ищите, кто выписал наряд на ночь '
            'тринадцатого».'
        ),
    },
    'item_roster': {
        'label': 'Проверить фамилии в наряде',
        'hint': 'двенадцать человек взвода Ястреба',
        'sound': 'sfx_book',
        'text': (
            'В списке двенадцать фамилий взвода Келла Ястреба. Против '
            'девятой строчки — «Яров С., седьмой ярус, ночная» — карандашом '
            'поставлен прочерк: со смены не вышел, в сводку не подан.'
        ),
    },
    'item_guard_token': {
        'label': 'Осмотреть жетон с изнанки',
        'hint': 'номер партии и налёт воды',
        'sound': 'snd_tag',
        'text': (
            'Восьмигранная латунь потемнела от тяжёлой воды. Выбито: '
            '«13-К · Яров С.». Шнурок не перетёрся — его рванули резко, '
            'когда тело тащили к решётке.'
        ),
    },
}


def fit_save(src):
    im = Image.open(src).convert('RGB')
    w, h = im.size
    if (w, h) != SIZE:
        if h != SIZE[1]:
            im = im.resize((max(1, int(w * SIZE[1] / h)), SIZE[1]), Image.LANCZOS)
            w, h = im.size
        if w > SIZE[0]:
            left = (w - SIZE[0]) // 2
            im = im.crop((left, 0, left + SIZE[0], h))
        elif w < SIZE[0]:
            im = im.resize(SIZE, Image.LANCZOS)
    im.save(src, 'JPEG', quality=88, optimize=True)
    return im.size


def main():
    done = []
    for iid in SCENE_ITEMS + list(CLUE_ITEMS):
        src = os.path.join(ROOT, 'assets', 'img', 'items', iid + '.jpg')
        if not os.path.exists(src):
            print('  НЕТ ФАЙЛА:', iid)
            continue
        sz = fit_save(src)
        rel = 'assets/img/items/%s.jpg' % iid
        path = os.path.join(ROOT, 'entities', iid + '.json')
        data = json.load(open(path, encoding='utf-8'))
        portrait = data.get('portrait') or {}
        portrait['neutral'] = rel
        data['portrait'] = portrait
        if iid in CLUE_ITEMS or iid in ('item_plate', 'item_marker'):
            data['image'] = rel
        if iid in CLUE_ITEMS and not data.get('interact_options'):
            spec = CLUE_ITEMS[iid]
            data['interact_hint'] = spec['label']
            data['interact_options'] = [{
                'label': spec['label'],
                'hint': spec['hint'],
                'sound': spec['sound'],
                'once': True,
                'effects': [{
                    'type': 'show_message',
                    'text': spec['text'],
                }],
            }]
        with open(path, 'w', encoding='utf-8') as fh:
            json.dump(data, fh, ensure_ascii=False, indent=2)
            fh.write('\n')
        done.append('%s %dx%d %.0f КБ' % (
            iid, sz[0], sz[1], os.path.getsize(src) / 1024))

    # И рукавице из прошлого хода пропишем image рядом с portrait
    glove_path = os.path.join(ROOT, 'entities', 'item_glove.json')
    glove = json.load(open(glove_path, encoding='utf-8'))
    if glove.get('image') != 'assets/img/items/item_glove.jpg':
        glove['image'] = 'assets/img/items/item_glove.jpg'
        with open(glove_path, 'w', encoding='utf-8') as fh:
            json.dump(glove, fh, ensure_ascii=False, indent=2)
            fh.write('\n')

    print('КАРТИНКИ 21')
    for line in done:
        print('  ', line)

    rest = []
    for f in sorted(os.listdir(os.path.join(ROOT, 'entities'))):
        if not f.startswith('item_'):
            continue
        d = json.load(open(os.path.join(ROOT, 'entities', f), encoding='utf-8'))
        if d.get('interact_options') and not (d.get('portrait') or {}).get('neutral'):
            rest.append(d['id'])
    print('  интерактивных предметов без портрета:', len(rest))


if __name__ == '__main__':
    main()
