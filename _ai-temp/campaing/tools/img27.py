#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""Ход 27: привязка 10 новых эмоциональных портретов героя (`hero_f_calm..sad`
и `hero_vet_calm..sad`, 800×800) в `char_creation.portraits` (`campaign.json`).

Теперь все три выбираемых при создании персонажа архетипа дознавателя
(`portrait_inspector`, `portrait_wright`, `portrait_veteran`) имеют полный
набор из 6 уникальных состояний мимики (`neutral`, `calm`, `thoughtful`,
`angry`, `afraid`, `sad` — всего 18 уникальных портретов героя без единого
дубля ключей).

Скрипт идемпотентен.
"""
import json
import os
from PIL import Image

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
EMOTIONS = ('neutral', 'calm', 'thoughtful', 'angry', 'afraid', 'sad')


def load(rel):
    with open(os.path.join(ROOT, rel), encoding='utf-8') as f:
        return json.load(f)


def save(rel, data, indent=2):
    with open(os.path.join(ROOT, rel), 'w', encoding='utf-8') as f:
        json.dump(data, f, ensure_ascii=False, indent=indent)
        f.write('\n')


def fit_jpg(rel, size, quality=85):
    full = os.path.join(ROOT, rel)
    with Image.open(full) as im:
        im = im.convert('RGB')
        if im.size != size:
            im = im.resize(size, Image.Resampling.LANCZOS)
        im.save(full, 'JPEG', quality=quality, optimize=True)
    return os.path.getsize(full)


def main():
    total = 0
    for prefix in ('hero_f', 'hero_vet'):
        for emo in ('calm', 'thoughtful', 'angry', 'afraid', 'sad'):
            total += fit_jpg(f'assets/img/npc/{prefix}_{emo}.jpg', (800, 800))

    camp = load('campaign.json')
    camp['char_creation']['portraits'] = [
        {
            'id': 'portrait_inspector',
            'label': 'Приписной с верхнего ствола',
            'image': 'assets/img/npc/hero_neutral.jpg',
            'states': {e: f'assets/img/npc/hero_{e}.jpg' for e in EMOTIONS},
        },
        {
            'id': 'portrait_wright',
            'label': 'Дознавательница из цеха',
            'image': 'assets/img/npc/hero_f_neutral.jpg',
            'states': {e: f'assets/img/npc/hero_f_{e}.jpg' for e in EMOTIONS},
        },
        {
            'id': 'portrait_veteran',
            'label': 'Старый смотритель ярусов',
            'image': 'assets/img/npc/hero_vet_neutral.jpg',
            'states': {e: f'assets/img/npc/hero_vet_{e}.jpg' for e in EMOTIONS},
        },
    ]
    save('campaign.json', camp)

    print(f'ИЛЛЮСТРАЦИИ 27: готово 10/10 ({total / 1024:.1f} КБ)')
    print('  все 3 архетипа героя в char_creation.portraits имеют по 6 уникальных эмоций (18 кадров)')


if __name__ == '__main__':
    main()
