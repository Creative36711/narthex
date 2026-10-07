#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""Ход 25: привязка 10 новых иллюстраций:
- 4 отдельных эмоциональных портрета дознавателя (`hero_calm.jpg`,
  `hero_thoughtful.jpg`, `hero_afraid.jpg`, `hero_sad.jpg` — теперь у
  `player_hero` 6 уникальных портретов без единого дубля ключей);
- 4 боевых портрета `angry` для всех враждебных сущностей (`ashhound_angry.jpg`,
  `rotling_angry.jpg`, `thug_angry.jpg`, `watchman_angry.jpg`);
- 2 динамических фоновых состояния сцен: ночной Сухой ряд
  (`scene_dry_row_night.jpg`, `state_night`) и стянутый цепным бандажом
  Слепой забой (`scene_face_collared.jpg`, `state_collared`).

Скрипт идемпотентен.
"""
import json
import os
from PIL import Image

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))


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
    # 1. 4 новых эмоциональных портрета главного героя (800x800, как hero_neutral)
    for k in ('calm', 'thoughtful', 'afraid', 'sad'):
        total += fit_jpg(f'assets/img/npc/hero_{k}.jpg', (800, 800))

    hero = load('entities/player_hero.json')
    hero['portrait'] = {
        'neutral': 'assets/img/npc/hero_neutral.jpg',
        'calm': 'assets/img/npc/hero_calm.jpg',
        'thoughtful': 'assets/img/npc/hero_thoughtful.jpg',
        'angry': 'assets/img/npc/hero_angry.jpg',
        'afraid': 'assets/img/npc/hero_afraid.jpg',
        'sad': 'assets/img/npc/hero_sad.jpg',
    }
    save('entities/player_hero.json', hero)

    # 2. 4 боевых портрета angry для всех враждебных сущностей
    enemies = [
        ('npc_ashhound', 'ashhound'),
        ('npc_rotling', 'rotling'),
        ('npc_thug', 'thug'),
        ('npc_watchman', 'watchman'),
    ]
    for eid, slug in enemies:
        neut_rel = f'assets/img/npc/{slug}_neutral.jpg'
        ang_rel = f'assets/img/npc/{slug}_angry.jpg'
        with Image.open(os.path.join(ROOT, neut_rel)) as nim:
            nsize = nim.size
        total += fit_jpg(ang_rel, nsize)
        ent = load(f'entities/{eid}.json')
        ent['portrait'] = {
            'neutral': neut_rel,
            'angry': ang_rel,
        }
        save(f'entities/{eid}.json', ent)

    # 3. 2 динамических фона сцен (1280x720)
    total += fit_jpg('assets/img/scenes/scene_dry_row_night.jpg', (1280, 720))
    total += fit_jpg('assets/img/scenes/scene_face_collared.jpg', (1280, 720))

    dry = load('scenes/scene_dry_row.json')
    dry['states'] = [
        {
            'id': 'state_day',
            'label': 'Днём и вечером',
            'condition': {
                'time_of_day': ['morning', 'day', 'evening'],
            },
            'image': 'assets/img/scenes/scene_dry_row.jpg',
        },
        {
            'id': 'state_night',
            'label': 'Ночью',
            'condition': None,
            'image': 'assets/img/scenes/scene_dry_row_night.jpg',
            'sound': 'sfx_bell',
            'sound_volume': 0.5,
        },
    ]
    save('scenes/scene_dry_row.json', dry)

    face = load('scenes/scene_face.json')
    face['states'] = [
        {
            'id': 'state_collared',
            'label': 'Шов стянут бандажом',
            'condition': {
                'flag': 'vein_braced',
            },
            'image': 'assets/img/scenes/scene_face_collared.jpg',
            'sound': 'sfx_brace',
            'sound_volume': 0.8,
        },
        {
            'id': 'state_main',
            'label': 'Всегда',
            'condition': None,
            'image': 'assets/img/scenes/scene_face.jpg',
        },
    ]
    save('scenes/scene_face.json', face)

    print(f'ИЛЛЮСТРАЦИИ 25: готово 10/10 ({total / 1024:.1f} КБ)')


if __name__ == '__main__':
    main()
