#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""Ход 22: шестнадцатая иллюстрация кодекса (`codex_filter`) и девять
иллюстраций всех остальных ключевых предметов (`quest_item`) и снаряжения
дознавателя.

После этого скрипта:
- все 16 статей кодекса имеют собственные иллюстрации (16/16, 100 %);
- все 11 сюжетных предметов (`quest_item: true`) в кампании имеют и `image`
  для сумки и прилавков, и `portrait.neutral` для осмотра (11/11, 100 %);
- плюс иллюстрации получили заряд из сердцевины (`item_charge`), карбидная
  лампа (`item_lamp`) и ключ на 52 (`item_wrench`).

Скрипт идемпотентен.
"""
import json
import os

from PIL import Image

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SIZE = (1200, 800)

ITEMS = [
    'item_core', 'item_filter', 'item_valve', 'item_charge',
    'item_badge', 'item_key_resh', 'item_key_cache', 'item_lamp', 'item_wrench',
]


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

    # 1. Иллюстрация кодекса codex_filter
    c_src = os.path.join(ROOT, 'assets', 'img', 'codex', 'codex_filter.jpg')
    if os.path.exists(c_src):
        sz = fit_save(c_src)
        c_path = os.path.join(ROOT, 'codex', 'codex_filter.json')
        c_data = json.load(open(c_path, encoding='utf-8'))
        c_data['image'] = 'assets/img/codex/codex_filter.jpg'
        with open(c_path, 'w', encoding='utf-8') as fh:
            json.dump(c_data, fh, ensure_ascii=False, indent=2)
            fh.write('\n')
        done.append('codex_filter %dx%d %.0f КБ' % (
            sz[0], sz[1], os.path.getsize(c_src) / 1024))

    # 2. Девять предметов
    for iid in ITEMS:
        src = os.path.join(ROOT, 'assets', 'img', 'items', iid + '.jpg')
        if not os.path.exists(src):
            print('  НЕТ ФАЙЛА:', iid)
            continue
        sz = fit_save(src)
        rel = 'assets/img/items/%s.jpg' % iid
        path = os.path.join(ROOT, 'entities', iid + '.json')
        data = json.load(open(path, encoding='utf-8'))
        data['image'] = rel
        portrait = data.get('portrait') or {}
        portrait['neutral'] = rel
        data['portrait'] = portrait
        with open(path, 'w', encoding='utf-8') as fh:
            json.dump(data, fh, ensure_ascii=False, indent=2)
            fh.write('\n')
        done.append('%s %dx%d %.0f КБ' % (
            iid, sz[0], sz[1], os.path.getsize(src) / 1024))

    print('КАРТИНКИ 22')
    for line in done:
        print('  ', line)


if __name__ == '__main__':
    main()
