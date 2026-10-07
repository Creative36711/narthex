#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""Ход 23: вписывает в 1200×800 JPEG (q=88) и привязывает 10 новых иллюстраций
оружия, брони, снаряжения и медикаментов:
- оружие и броня: `item_knife`, `item_service_blade`, `item_crossbow`,
  `item_coat`, `item_vest`;
- снаряжение и медикаменты/вода: `item_rope`, `item_bandage`, `item_tonic`,
  `item_antirot`, `item_water`.

Скрипт идемпотентен.
"""
import json
import os
from PIL import Image

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))

ITEMS = [
    'item_knife',
    'item_service_blade',
    'item_crossbow',
    'item_coat',
    'item_vest',
    'item_rope',
    'item_bandage',
    'item_tonic',
    'item_antirot',
    'item_water',
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
    for iid in ITEMS:
        img_rel = f'assets/img/items/{iid}.jpg'
        total_kb += fit_jpeg(img_rel) / 1024
        ent_path = os.path.join(ROOT, f'entities/{iid}.json')
        ent = json.load(open(ent_path, encoding='utf-8'))
        ent['image'] = img_rel
        ent['portrait'] = {'neutral': img_rel}
        with open(ent_path, 'w', encoding='utf-8') as f:
            json.dump(ent, f, ensure_ascii=False, indent=2)
            f.write('\n')

    print(f'КАРТИНКИ 23: обработано 10 файлов ({total_kb:.1f} КБ)')


if __name__ == '__main__':
    main()
