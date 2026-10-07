#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""Ход 28 (финал): обработка и привязка новых иллюстраций пакета 28:
- 3 эпилоговых кадра финальных катсцен (`cut_final_pump_3.jpg`,
  `cut_final_vein_3.jpg`, `cut_final_silence_3.jpg`, 1280×720) + 3 озвученных
  слайда в `cutscene_final_pump`, `cutscene_final_vein`, `cutscene_final_silence`;
- 3 динамических фона сцен (`scene_pump_room_open.jpg`,
  `scene_sluice_drained.jpg`, `scene_face_sealed.jpg`, 1280×720);
- 3 портрета состояния `afraid` (ошеломление/испуг в бою) для противников
  (`thug_afraid.jpg`, `watchman_afraid.jpg`, `ashhound_afraid.jpg`, 800×800).

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
    for rel in (
        'assets/img/cut_final_pump_3.jpg',
        'assets/img/cut_final_vein_3.jpg',
        'assets/img/cut_final_silence_3.jpg',
        'assets/img/scenes/scene_pump_room_open.jpg',
        'assets/img/scenes/scene_sluice_drained.jpg',
        'assets/img/scenes/scene_face_sealed.jpg',
    ):
        total += fit_jpg(rel, (1280, 720))

    for npc_id, stem in (
        ('npc_thug', 'thug'),
        ('npc_watchman', 'watchman'),
        ('npc_ashhound', 'ashhound'),
    ):
        rel = f'assets/img/npc/{stem}_afraid.jpg'
        total += fit_jpg(rel, (800, 800))
        ent_rel = f'entities/{npc_id}.json'
        ent = load(ent_rel)
        ent.setdefault('portrait', {})['afraid'] = rel
        save(ent_rel, ent)

    # Привязка 3-х состояний фонов сцен
    sluice = load('scenes/scene_sluice.json')
    sluice['states'] = [
        {
            'id': 'state_drained',
            'label': 'Затвор заперт и вода сброшена',
            'condition': {'flag': 'sluice_ready'},
            'image': 'assets/img/scenes/scene_sluice_drained.jpg',
            'sound': 'snd_latch',
            'sound_volume': 0.8,
        },
        {
            'id': 'state_ready',
            'label': 'Клапан найден в шахте',
            'condition': {'flag': 'valve_found'},
            'image': 'assets/img/scenes/scene_sluice_ready.jpg',
            'sound': 'sfx_gear',
            'sound_volume': 0.7,
        },
        {
            'id': 'state_main',
            'label': 'Всегда',
            'condition': None,
            'image': 'assets/img/scenes/scene_sluice.jpg',
        },
    ]
    save('scenes/scene_sluice.json', sluice)

    face = load('scenes/scene_face.json')
    face['states'] = [
        {
            'id': 'state_sealed',
            'label': 'Шов стянут свинцовым бандажом',
            'condition': {'flag': 'vein_braced'},
            'image': 'assets/img/scenes/scene_face_sealed.jpg',
            'sound': 'sfx_brace',
            'sound_volume': 0.8,
        },
        {
            'id': 'state_collared',
            'label': 'Сердцевина вынута из тайника',
            'condition': {'flag': 'core_taken'},
            'image': 'assets/img/scenes/scene_face_collared.jpg',
            'sound': 'sfx_hum',
            'sound_volume': 0.7,
        },
        {
            'id': 'state_main',
            'label': 'Всегда',
            'condition': None,
            'image': 'assets/img/scenes/scene_face.jpg',
        },
    ]
    save('scenes/scene_face.json', face)

    # Добавление 3-х эпилоговых слайдов в финальные катсцены
    epilogues = {
        'cutscenes/cutscene_final_pump.json': {
            'text': (
                'Папка дела номер сто тридцать семь ложится на стол архива со штампом '
                '«Исполнено». Наверху празднуют спасение выработок, а внизу седьмая '
                'помпа снова гонит жильную кровь по чугунным трубам.'
            ),
            'duration': 9,
            'transition': 'fade',
            'image': 'assets/img/cut_final_pump_3.jpg',
            'voice': 'assets/voice/final_pump_3.mp3',
        },
        'cutscenes/cutscene_final_vein.json': {
            'text': (
                'Тёплый пар поднимается по стволу до самого Сухого ряда, и рудокопы '
                'впервые за сто лет снимают респираторы. Папка дела номер сто тридцать '
                'семь остаётся лежать открытой на пустом столе конторы.'
            ),
            'duration': 9,
            'transition': 'fade',
            'image': 'assets/img/cut_final_vein_3.jpg',
            'voice': 'assets/voice/final_vein_3.mp3',
        },
        'cutscenes/cutscene_final_silence.json': {
            'text': (
                'Чугунная переборка запечатывает восьмой ярус навсегда, оставляя под '
                'завалом и жилу, и тайну конторы. В кармане твоего плаща лежит тетрадь '
                'Реша без печати — единственная правда, которую не смог купить Каркас.'
            ),
            'duration': 9,
            'transition': 'fade',
            'image': 'assets/img/cut_final_silence_3.jpg',
            'voice': 'assets/voice/final_silence_3.mp3',
        },
    }
    for rel, slide in epilogues.items():
        cs = load(rel)
        slides = cs.get('slides', [])
        if len(slides) >= 3:
            slides[2] = slide
        else:
            slides.append(slide)
        cs['slides'] = slides
        save(rel, cs)

    print(f'ИЛЛЮСТРАЦИИ 28: обработано 9 файлов ({total / 1024:.1f} КБ)')
    print('  3 эпилоговых слайда финальных катсцен + 3 состояния сцен + 3 портрета afraid у врагов')


if __name__ == '__main__':
    main()
