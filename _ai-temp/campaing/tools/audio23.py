#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""Ход 23: звук — щелчок тетивы жильного самострела (`sfx_crossbow`) и
озвученный осмотр оружия, брони и снаряжения в сумке дознавателя.

1. `sfx_crossbow` (`assets/audio/sfx/sfx_crossbow.ogg`) — резкий спуск
   храповика и короткий удар тетивы: сведение двух реальных CC0-сэмплов
   Kenney (`snd_latch.ogg` с highpass 600 Гц + `snd_cloth.ogg` с ускорением
   1.35× и сдвигом 45 мс).
2. Десяти предметам (`item_knife`, `item_service_blade`, `item_crossbow`,
   `item_coat`, `item_vest`, `item_rope`, `item_bandage`, `item_tonic`,
   `item_antirot`, `item_water`), получившим иллюстрации в этом ходу,
   прописаны полные звуковые карты `sounds`, а шести нерасходуемым предметам
   оружия, брони и снаряжения — действия осмотра `interact_options` со
   звуком и показом портрета 1200×800.

Скрипт идемпотентен.
"""
import json
import os
import subprocess

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SFX = os.path.join(ROOT, 'assets', 'audio', 'sfx')
SRC_LATCH = os.path.join(SFX, 'snd_latch.ogg')
SRC_CLOTH = os.path.join(SFX, 'snd_cloth.ogg')
DST = os.path.join(SFX, 'sfx_crossbow.ogg')

GEAR_INSPECT = {
    'item_knife': {
        'sounds': {'pickup': 'snd_blade', 'equip': 'snd_blade', 'unequip': 'snd_cloth', 'use': 'snd_blade'},
        'label': 'Проверить заточку клинка',
        'hint': 'складной нож с костяной рукоятью',
        'sound': 'snd_blade',
        'text': (
            'Узкое воронёное лезвие фиксируется латунным кольцом без люфта. '
            'Против кирасы Надзора с ним не пойдёшь, но резать пеньку, '
            'вскрывать сургуч и отбиваться в тесном штреке — в самый раз.'
        ),
    },
    'item_service_blade': {
        'sounds': {'pickup': 'snd_blade', 'equip': 'snd_blade', 'unequip': 'snd_cloth', 'use': 'snd_blade'},
        'label': 'Осмотреть клеймо на гарде',
        'hint': 'прямой тесак караульной смены',
        'sound': 'snd_blade',
        'text': (
            'Тяжёлый прямой клинок с долом и массивной латунной дужкой. '
            'На пяте выбито клеймо седьмого яруса: такими вооружают '
            'старших смен и людей Келла.'
        ),
    },
    'item_crossbow': {
        'sounds': {'pickup': 'sfx_crossbow', 'equip': 'sfx_crossbow', 'unequip': 'snd_cloth', 'use': 'sfx_crossbow'},
        'label': 'Проверить натяжение дуги',
        'hint': 'шахтный самострел с жильной прицельной планкой',
        'sound': 'sfx_crossbow',
        'text': (
            'Короткая стальная дуга взводится храповым рычагом, а в прорези '
            'прицела тускло светится осколок жильного стекла — чтобы бить '
            'вдоль неосвещённого штрека на тридцать шагов.'
        ),
    },
    'item_coat': {
        'sounds': {'pickup': 'snd_cloth', 'equip': 'snd_cloth', 'unequip': 'snd_cloth'},
        'label': 'Отряхнуть угольную пыль с воротника',
        'hint': 'промасленное сукно и медные пряжки',
        'sound': 'snd_cloth',
        'text': (
            'Тяжёлый дорожный плащ из двойного промасленного сукна. '
            'Смягчает скользящий удар и держит капель на верхних ярусах, '
            'но от ледяной сырости восьмого и девятого спасает только печка.'
        ),
    },
    'item_vest': {
        'sounds': {'pickup': 'snd_cloth', 'equip': 'snd_latch', 'unequip': 'snd_cloth'},
        'label': 'Проверить нагрудные пластины',
        'hint': 'стёганая кирза с железным подбоем',
        'sound': 'snd_latch',
        'text': (
            'Многослойная варёная кирза, проклёпанная железными полосами '
            'на груди и плечах. Тяжёлый, пахнет потом и ружейным маслом, '
            'зато держит и клык пепельного пса, и удар ломом.'
        ),
    },
    'item_rope': {
        'sounds': {'pickup': 'snd_cloth', 'use': 'snd_chain'},
        'label': 'Проверить узлы и кошку',
        'hint': 'смолёный канат с трёхзубым крюком',
        'sound': 'snd_chain',
        'text': (
            'Двадцать локтей смолёной пеньки и кованый трёхзубый крюк-кошка. '
            'Нити целые, без гнили: удержит двоих над затопленным колодцем.'
        ),
    },
}

CONSUMABLE_SOUNDS = {
    'item_bandage': {'pickup': 'snd_cloth', 'use': 'snd_cloth'},
    'item_tonic': {'pickup': 'sfx_glass', 'use': 'sfx_glass'},
    'item_antirot': {'pickup': 'sfx_glass', 'use': 'sfx_glass'},
    'item_water': {'pickup': 'sfx_water', 'use': 'sfx_water'},
}


def ffmpeg():
    try:
        import imageio_ffmpeg
        return imageio_ffmpeg.get_ffmpeg_exe()
    except Exception:
        return 'ffmpeg'


def build_crossbow():
    if os.path.exists(DST) and os.path.getsize(DST) > 2000:
        return False
    tmp = DST + '.tmp.ogg'
    graph = (
        '[0:a]highpass=f=600,volume=1.15[a];'
        '[1:a]asetrate=44100*1.35,aresample=44100,adelay=45|45,volume=0.85[b];'
        '[a][b]amix=inputs=2:duration=longest:normalize=0[out]'
    )
    cmd = [
        ffmpeg(), '-y', '-loglevel', 'error',
        '-i', SRC_LATCH, '-i', SRC_CLOTH,
        '-filter_complex', graph, '-map', '[out]',
        '-c:a', 'libvorbis', '-q:a', '4', tmp,
    ]
    subprocess.run(cmd, capture_output=True)
    ok = os.path.exists(tmp) and os.path.getsize(tmp) > 2000
    if ok:
        os.replace(tmp, DST)
    elif os.path.exists(tmp):
        os.remove(tmp)
    return ok


def load(rel):
    with open(os.path.join(ROOT, rel), encoding='utf-8') as f:
        return json.load(f)


def save(rel, data, indent=2):
    with open(os.path.join(ROOT, rel), 'w', encoding='utf-8') as f:
        json.dump(data, f, ensure_ascii=False, indent=indent)
        f.write('\n')


def main():
    made = build_crossbow()
    camp = load('campaign.json')
    entry = {
        'id': 'sfx_crossbow',
        'label': 'Спуск тетивы самострела',
        'src': 'assets/audio/sfx/sfx_crossbow.ogg',
    }
    ids = [s['id'] for s in camp['sounds']]
    if 'sfx_crossbow' in ids:
        camp['sounds'][ids.index('sfx_crossbow')] = entry
    else:
        camp['sounds'].append(entry)
    save('campaign.json', camp)

    for iid, spec in GEAR_INSPECT.items():
        rel = f'entities/{iid}.json'
        d = load(rel)
        d['sounds'] = spec['sounds']
        d['interact_hint'] = spec['label']
        d['interact_options'] = [{
            'label': spec['label'],
            'hint': spec['hint'],
            'sound': spec['sound'],
            'once': True,
            'effects': [{
                'type': 'show_message',
                'text': spec['text'],
            }],
        }]
        save(rel, d)

    for iid, snd in CONSUMABLE_SOUNDS.items():
        rel = f'entities/{iid}.json'
        d = load(rel)
        d['sounds'] = snd
        save(rel, d)

    print('ЗВУК 23')
    print('  новый звук:', 'sfx_crossbow' + ('' if made else ' (уже был)'),
          '%.1f КБ' % (os.path.getsize(DST) / 1024))
    print('  озвучены карты звуков у 10 предметов и осмотр 6 предметов снаряжения')


if __name__ == '__main__':
    main()
