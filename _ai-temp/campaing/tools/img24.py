#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""Ход 24: вписывает и привязывает 8 иллюстраций оставшихся предметов в сумке
(доводя покрытие всех 57 предметов кампании до 100 %) и 2 портрета героя
(`player_hero.json`, доводя покрытие портретов всех 15 персонажей до 100 %).

Скрипт идемпотентен.
"""
import json
import os
from PIL import Image

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))

ITEMS_24 = [
    'item_ration',
    'item_stew',
    'item_oil',
    'item_coal',
    'item_cloth',
    'item_scrap',
    'item_bolt',
    'item_mark',
]


def fit_jpeg(rel_path, target=(1200, 800), quality=88):
    full = os.path.join(ROOT, rel_path)
    im = Image.open(full).convert('RGB')
    tw, th = target
    w, h = im.size
    if (w, h) != (tw, th):
        scale = max(tw / w, th / h)
        nw, nh = int(round(w * scale)), int(round(h * scale))
        im = im.resize((nw, nh), Image.Resampling.LANCZOS)
        left = (nw - tw) // 2
        top = (nh - th) // 2
        im = im.crop((left, top, left + tw, top + th))
    im.save(full, 'JPEG', quality=quality, optimize=True)
    return os.path.getsize(full)


def main():
    total_kb = 0.0
    for iid in ITEMS_24:
        img_rel = f'assets/img/items/{iid}.jpg'
        total_kb += fit_jpeg(img_rel, target=(1200, 800)) / 1024
        ent_path = os.path.join(ROOT, f'entities/{iid}.json')
        ent = json.load(open(ent_path, encoding='utf-8'))
        ent['image'] = img_rel
        ent['portrait'] = {'neutral': img_rel}
        with open(ent_path, 'w', encoding='utf-8') as f:
            json.dump(ent, f, ensure_ascii=False, indent=2)
            f.write('\n')

    for hrel in ('assets/img/npc/hero_neutral.jpg', 'assets/img/npc/hero_angry.jpg'):
        total_kb += fit_jpeg(hrel, target=(640, 640)) / 1024

    hero_path = os.path.join(ROOT, 'entities/player_hero.json')
    hero = json.load(open(hero_path, encoding='utf-8'))
    hero['portrait'] = {
        'neutral': 'assets/img/npc/hero_neutral.jpg',
        'calm': 'assets/img/npc/hero_neutral.jpg',
        'thoughtful': 'assets/img/npc/hero_neutral.jpg',
        'angry': 'assets/img/npc/hero_angry.jpg',
        'afraid': 'assets/img/npc/hero_angry.jpg',
        'sad': 'assets/img/npc/hero_angry.jpg',
    }
    with open(hero_path, 'w', encoding='utf-8') as f:
        json.dump(hero, f, ensure_ascii=False, indent=2)
        f.write('\n')

    print(f'КАРТИНКИ 24: обработано 10 файлов ({total_kb:.1f} КБ)')


if __name__ == '__main__':
    main()
