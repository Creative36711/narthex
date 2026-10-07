#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""Ход 26: привязка 10 новых иллюстраций:
- 8 динамических фоновых состояний сцен (`scene_sluice_ready.jpg`,
  `scene_drift_open.jpg`, `scene_pump_room_open.jpg`,
  `scene_flood_gallery_flooded.jpg`, `scene_gate_office_pinned.jpg`,
  `scene_office_lockdown.jpg`, `scene_archive_opened.jpg`,
  `scene_pump_shaft_drained.jpg`) — теперь у ВСЕХ 12 из 12 сцен кампании
  (100 %) есть по 2 динамических визуальных состояния;
- 2 новых базовых портрета героя (`hero_f_neutral.jpg`, `hero_vet_neutral.jpg`)
  и галерея выбора портрета `char_creation.portraits` из 3 архетипов.

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


SCENE_STATES = [
    (
        'scene_sluice',
        'assets/img/scenes/scene_sluice_ready.jpg',
        {
            'id': 'state_ready',
            'label': 'Клапан установлен',
            'condition': {'flag': 'sluice_ready'},
            'image': 'assets/img/scenes/scene_sluice_ready.jpg',
            'sound': 'snd_latch',
            'sound_volume': 0.8,
        },
        'assets/img/scenes/scene_sluice.jpg',
    ),
    (
        'scene_drift',
        'assets/img/scenes/scene_drift_open.jpg',
        {
            'id': 'state_open',
            'label': 'Тайник вскрыт',
            'condition': {'flag': 'cache_open'},
            'image': 'assets/img/scenes/scene_drift_open.jpg',
            'sound': 'sfx_lock',
            'sound_volume': 0.7,
        },
        'assets/img/scenes/scene_drift.jpg',
    ),
    (
        'scene_pump_room',
        'assets/img/scenes/scene_pump_room_open.jpg',
        {
            'id': 'state_open',
            'label': 'Шкафчик вскрыт',
            'condition': {'flag': 'clue_plate'},
            'image': 'assets/img/scenes/scene_pump_room_open.jpg',
            'sound': 'sfx_lock',
            'sound_volume': 0.7,
        },
        'assets/img/scenes/scene_pump_room.jpg',
    ),
    (
        'scene_flood_gallery',
        'assets/img/scenes/scene_flood_gallery_flooded.jpg',
        {
            'id': 'state_flooded',
            'label': 'Большая вода',
            'condition': {'flag': 'downpour_flood'},
            'image': 'assets/img/scenes/scene_flood_gallery_flooded.jpg',
            'sound': 'sfx_surge',
            'sound_volume': 0.85,
        },
        'assets/img/scenes/scene_flood_gallery.jpg',
    ),
    (
        'scene_gate_office',
        'assets/img/scenes/scene_gate_office_pinned.jpg',
        {
            'id': 'state_pinned',
            'label': 'Дело №137 сшито',
            'condition': {'flag': 'case_full'},
            'image': 'assets/img/scenes/scene_gate_office_pinned.jpg',
            'sound': 'sfx_file',
            'sound_volume': 0.75,
        },
        'assets/img/scenes/scene_gate_office.jpg',
    ),
    (
        'scene_office',
        'assets/img/scenes/scene_office_lockdown.jpg',
        {
            'id': 'state_lockdown',
            'label': 'Режим тишины',
            'condition': {'flag': 'lockdown'},
            'image': 'assets/img/scenes/scene_office_lockdown.jpg',
            'sound': 'sfx_lockdown',
            'sound_volume': 0.85,
        },
        'assets/img/scenes/scene_office.jpg',
    ),
    (
        'scene_archive',
        'assets/img/scenes/scene_archive_opened.jpg',
        {
            'id': 'state_opened',
            'label': 'Дело №136 на конторке',
            'condition': {'flag': 'case136_read'},
            'image': 'assets/img/scenes/scene_archive_opened.jpg',
            'sound': 'sfx_book',
            'sound_volume': 0.75,
        },
        'assets/img/scenes/scene_archive.jpg',
    ),
    (
        'scene_pump_shaft',
        'assets/img/scenes/scene_pump_shaft_drained.jpg',
        {
            'id': 'state_roped',
            'label': 'Страховка закреплена',
            'condition': {'flag': 'valve_found'},
            'image': 'assets/img/scenes/scene_pump_shaft_drained.jpg',
            'sound': 'sfx_rungs',
            'sound_volume': 0.75,
        },
        'assets/img/scenes/scene_pump_shaft.jpg',
    ),
]


def main():
    total = 0
    for sid, new_img, state_obj, base_img in SCENE_STATES:
        total += fit_jpg(new_img, (1280, 720))
        sc = load(f'scenes/{sid}.json')
        sc['states'] = [
            state_obj,
            {
                'id': 'state_main',
                'label': 'Всегда',
                'condition': None,
                'image': base_img,
            },
        ]
        save(f'scenes/{sid}.json', sc)

    # 2 новых портрета героя + галерея char_creation.portraits
    total += fit_jpg('assets/img/npc/hero_f_neutral.jpg', (800, 800))
    total += fit_jpg('assets/img/npc/hero_vet_neutral.jpg', (800, 800))

    camp = load('campaign.json')
    camp['char_creation']['portraits'] = [
        {
            'id': 'portrait_inspector',
            'label': 'Приписной с верхнего ствола',
            'image': 'assets/img/npc/hero_neutral.jpg',
            'states': {
                'neutral': 'assets/img/npc/hero_neutral.jpg',
                'calm': 'assets/img/npc/hero_calm.jpg',
                'thoughtful': 'assets/img/npc/hero_thoughtful.jpg',
                'angry': 'assets/img/npc/hero_angry.jpg',
                'afraid': 'assets/img/npc/hero_afraid.jpg',
                'sad': 'assets/img/npc/hero_sad.jpg',
            },
        },
        {
            'id': 'portrait_wright',
            'label': 'Дознавательница из цеха',
            'image': 'assets/img/npc/hero_f_neutral.jpg',
            'states': {
                'neutral': 'assets/img/npc/hero_f_neutral.jpg',
            },
        },
        {
            'id': 'portrait_veteran',
            'label': 'Старый смотритель ярусов',
            'image': 'assets/img/npc/hero_vet_neutral.jpg',
            'states': {
                'neutral': 'assets/img/npc/hero_vet_neutral.jpg',
            },
        },
    ]
    save('campaign.json', camp)

    print(f'ИЛЛЮСТРАЦИИ 26: готово 10/10 ({total / 1024:.1f} КБ)')
    print('  все 12/12 сцен кампании имеют по 2 динамических визуальных состояния')
    print('  добавлена галерея портретов героя char_creation.portraits (3 архетипа)')


if __name__ == '__main__':
    main()
