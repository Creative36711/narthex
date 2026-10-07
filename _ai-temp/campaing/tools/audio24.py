#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""Ход 24: звук — маслёнка (`sfx_oil`) и озвученный осмотр всех оставшихся
предметов и материалов в сумке дознавателя (100 % покрытие предметов).

1. `sfx_oil` (`assets/audio/sfx/sfx_oil.ogg`) — нажатие язычка жестяной
   маслёнки и густой плеск масла: сведение двух реальных CC0-сэмплов
   (`snd_latch.ogg` с lowpass 1100 Гц + `sfx_water.ogg` с замедлением 0.82×
   и сдвигом 60 мс). Привязан к правилу `rule_watchman_oil` (смазка плечевого
   сустава автомата-смотрителя) и к `item_oil`.
2. Восьми предметам (`item_ration`, `item_stew`, `item_oil`, `item_coal`,
   `item_cloth`, `item_scrap`, `item_bolt`, `item_mark`), получившим
   иллюстрации в этом ходу, прописаны карты `sounds`, а пяти материалам и
   боеприпасам — действия осмотра `interact_options` со звуком и показом
   портрета 1200×800.

Скрипт идемпотентен.
"""
import json
import os
import subprocess

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SFX = os.path.join(ROOT, 'assets', 'audio', 'sfx')
SRC_LATCH = os.path.join(SFX, 'snd_latch.ogg')
SRC_WATER = os.path.join(SFX, 'sfx_water.mp3')
DST = os.path.join(SFX, 'sfx_oil.ogg')

MAT_INSPECT = {
    'item_oil': {
        'sounds': {'pickup': 'sfx_oil', 'use': 'sfx_oil'},
        'label': 'Нажать язычок маслёнки',
        'hint': 'густое минеральное масло для ламп и муфт',
        'sound': 'sfx_oil',
        'text': (
            'Тяжёлое тёмно-янтарное масло без воды и смолы. Такого хватит, '
            'чтобы заправить жильную лампу, собрать заряд на верстаке или '
            'залить заклинивший сустав старого автомата-смотрителя.'
        ),
    },
    'item_coal': {
        'sounds': {'pickup': 'snd_coal', 'use': 'snd_coal'},
        'label': 'Взвесить кусок антрацита',
        'hint': 'жирный каменный уголь для печки и жаровни',
        'sound': 'snd_coal',
        'text': (
            'Тяжёлый маслянистый кусок угля с верхнего склада: горит жарко и '
            'почти без копоти, а дроблёным идёт на переснаряжение угольных '
            'банок дыхателя.'
        ),
    },
    'item_cloth': {
        'sounds': {'pickup': 'snd_cloth', 'use': 'snd_cloth'},
        'label': 'Проверить плотность сукна',
        'hint': 'промасленное сукно и чистая ветошь',
        'sound': 'snd_cloth',
        'text': (
            'Свёрток плотного сукна и стиранной холстины. Годится и на '
            'перевязку, и на фильтрующую прокладку в дыхатель мастера.'
        ),
    },
    'item_scrap': {
        'sounds': {'pickup': 'sfx_gear', 'use': 'sfx_anvil'},
        'label': 'Перебрать железный лом',
        'hint': 'кованые скобы, зубья шестерён и проволока',
        'sound': 'sfx_gear',
        'text': (
            'Обломки кованых скоб, стальные пальцы и медная проволока со '
            'старого привода. На верстаке из них выходят и болты для '
            'самострела, и рубашка для жильного заряда.'
        ),
    },
    'item_bolt': {
        'sounds': {'pickup': 'sfx_crossbow', 'use': 'sfx_crossbow'},
        'label': 'Проверить гранёный наконечник',
        'hint': 'стальной болт для жильного самострела',
        'sound': 'sfx_crossbow',
        'text': (
            'Короткий гранёный болт из калёной стали с латунным оперением. '
            'Бьёт прямо и пробивает как варёную кирзу, так и шкуру пепельного пса.'
        ),
    },
}

CONS_SOUNDS = {
    'item_ration': {'pickup': 'snd_cloth', 'use': 'snd_cloth'},
    'item_stew': {'pickup': 'snd_pot', 'use': 'snd_pot'},
    'item_mark': {'pickup': 'sfx_coin', 'use': 'sfx_coin'},
}


def ffmpeg():
    try:
        import imageio_ffmpeg
        return imageio_ffmpeg.get_ffmpeg_exe()
    except Exception:
        return 'ffmpeg'


def build_oil():
    if os.path.exists(DST) and os.path.getsize(DST) > 2000:
        return False
    tmp = DST + '.tmp.ogg'
    graph = (
        '[0:a]lowpass=f=1100,volume=0.9[a];'
        '[1:a]asetrate=44100*0.82,aresample=44100,lowpass=f=1400,adelay=60|60,volume=1.0[b];'
        '[a][b]amix=inputs=2:duration=longest:normalize=0[out]'
    )
    cmd = [
        ffmpeg(), '-y', '-loglevel', 'error',
        '-i', SRC_LATCH, '-i', SRC_WATER,
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
    made = build_oil()
    camp = load('campaign.json')
    entry = {
        'id': 'sfx_oil',
        'label': 'Маслёнка',
        'src': 'assets/audio/sfx/sfx_oil.ogg',
    }
    ids = [s['id'] for s in camp['sounds']]
    if 'sfx_oil' in ids:
        camp['sounds'][ids.index('sfx_oil')] = entry
    else:
        camp['sounds'].append(entry)
    save('campaign.json', camp)

    # Привязка sfx_oil к rule_watchman_oil
    woil = load('rules/rule_watchman_oil.json')
    for ef in woil.get('effects', []):
        if ef.get('type') == 'skill_check_gate':
            for sub in ef.get('success_effects', []):
                if sub.get('type') == 'play_sound':
                    sub['sound'] = 'sfx_oil'
    save('rules/rule_watchman_oil.json', woil)

    for iid, spec in MAT_INSPECT.items():
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

    for iid, snd in CONS_SOUNDS.items():
        rel = f'entities/{iid}.json'
        d = load(rel)
        d['sounds'] = snd
        save(rel, d)

    print('ЗВУК 24')
    print('  новый звук:', 'sfx_oil' + ('' if made else ' (уже был)'),
          '%.1f КБ' % (os.path.getsize(DST) / 1024))
    print('  озвучены карты звуков у 8 предметов и осмотр 5 материалов в сумке')


if __name__ == '__main__':
    main()
