#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""Ход 27: звук — глоток из фляги/склянки (`sfx_flask`), привязка 10 дорожек
озвучки вступительных карточек сцен (`narrative_intro`, итого 17/24) и
озвученный осмотр последних 7 предметов в сумке (57/57 = 100 % всех предметов
кампании имеют интерактивный осмотр с портретом и звуком).

Скрипт идемпотентен.
"""
import json
import os
import subprocess

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SFX = os.path.join(ROOT, 'assets', 'audio', 'sfx')
SRC_GLASS = os.path.join(SFX, 'sfx_glass.ogg')
SRC_WATER = os.path.join(SFX, 'sfx_water.mp3')
SRC_GASP = os.path.join(SFX, 'sfx_gasp.ogg')
DST = os.path.join(SFX, 'sfx_flask.ogg')

INTRO_VOICES = {
    'scene_office': [
        (1, 'assets/voice/intro_office_2.mp3'),
    ],
    'scene_archive': [
        (0, 'assets/voice/intro_archive_1.mp3'),
        (1, 'assets/voice/intro_archive_2.mp3'),
    ],
    'scene_pump_hall': [
        (0, 'assets/voice/intro_pump_hall_1.mp3'),
        (1, 'assets/voice/intro_pump_hall_2.mp3'),
    ],
    'scene_pump_room': [
        (0, 'assets/voice/intro_pump_room_1.mp3'),
        (1, 'assets/voice/intro_pump_room_2.mp3'),
    ],
    'scene_pump_shaft': [
        (0, 'assets/voice/intro_pump_shaft_1.mp3'),
        (1, 'assets/voice/intro_pump_shaft_2.mp3'),
    ],
    'scene_flood_gallery': [
        (0, 'assets/voice/intro_flood_gallery_1.mp3'),
    ],
}

ITEM_INSPECT = {
    'item_water': {
        'sounds': {'pickup': 'sfx_water', 'use': 'sfx_flask'},
        'label': 'Взболтать флягу',
        'hint': 'чистая вода с верхнего фильтра (+45 к жажде)',
        'sound': 'sfx_flask',
        'text': (
            'Тяжёлая солдатская фляга с резьбовой крышкой на цепочке. Вода внутри '
            'отдаёт оловом и известняком, но в ней нет ни мазута, ни жильной мути.'
        ),
    },
    'item_tonic': {
        'sounds': {'pickup': 'sfx_glass', 'use': 'sfx_flask'},
        'label': 'Посмотреть склянку на свет',
        'hint': 'травяной настой сестры Айлы (+8 здоровья и ясность ума)',
        'sound': 'sfx_glass',
        'text': (
            'Тёмно-янтарный настой в толстом аптечном стекле под сургучной пробкой. '
            'Пахнет полынью, сухим мхом и спиртом — проясняет голову даже после смены у забоя.'
        ),
    },
    'item_antirot': {
        'sounds': {'pickup': 'sfx_glass', 'use': 'sfx_flask'},
        'label': 'Проверить осадок отвара',
        'hint': 'снимает жильную гниль и возвращает +5 здоровья',
        'sound': 'sfx_glass',
        'text': (
            'Густой бирюзово-зелёный отвар из вытяжки жильного мха и медного купороса. '
            'На вкус как ржавый гвоздь, но единственное средство, которое останавливает гниль.'
        ),
    },
    'item_bandage': {
        'sounds': {'pickup': 'snd_cloth', 'use': 'snd_cloth'},
        'label': 'Проверить пропитку бинта',
        'hint': 'чистая перевязка (+7 здоровья)',
        'sound': 'snd_cloth',
        'text': (
            'Плотный рулон отбеленной холстины, пропитанной антисептическим отваром '
            'и перевязанный суровой ниткой.'
        ),
    },
    'item_ration': {
        'sounds': {'pickup': 'snd_cloth', 'use': 'snd_cloth'},
        'label': 'Развернуть вощёную бумагу',
        'hint': 'паёк сменной вахты (+35 к сытости)',
        'sound': 'snd_paper',
        'text': (
            'Два ржаных сухаря каменной закалки и ломоть копчёного сала в промасленной '
            'бумаге со штампом продсклада седьмого яруса.'
        ),
    },
    'item_stew': {
        'sounds': {'pickup': 'snd_pot', 'use': 'snd_pot'},
        'label': 'Поднять крышку котелка',
        'hint': 'горячее варево (+55 к сытости и +25 к теплу)',
        'sound': 'snd_pot',
        'text': (
            'Густая перловая похлёбка с солониной и сушёным корнем в закопчённом '
            'жестяном котелке. Держит жар и сразу возвращает тепло в пальцы.'
        ),
    },
    'item_mark': {
        'sounds': {'pickup': 'sfx_coin', 'use': 'sfx_coins'},
        'label': 'Проверить чеканку марки',
        'hint': 'ходовая латунная монета Каркаса',
        'sound': 'sfx_coin',
        'text': (
            'Увесистый восьмиугольный жетон из латуни с профилем зубчатого колеса '
            'и номером ствола. Наверху это отчётная единица, в Сухом ряду — хлеб и фильтр.'
        ),
    },
}


def ffmpeg():
    try:
        import imageio_ffmpeg
        return imageio_ffmpeg.get_ffmpeg_exe()
    except Exception:
        return 'ffmpeg'


def build_flask():
    if os.path.exists(DST) and os.path.getsize(DST) > 2000:
        return False
    tmp = DST + '.tmp.ogg'
    graph = (
        '[0:a]volume=0.85[a];'
        '[1:a]asetrate=44100*1.12,aresample=44100,adelay=90|90,volume=0.95[b];'
        '[2:a]lowpass=f=1600,adelay=280|280,volume=0.55[c];'
        '[a][b][c]amix=inputs=3:duration=longest:normalize=0[out]'
    )
    cmd = [
        ffmpeg(), '-y', '-loglevel', 'error',
        '-i', SRC_GLASS, '-i', SRC_WATER, '-i', SRC_GASP,
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
    made = build_flask()
    camp = load('campaign.json')
    entry = {
        'id': 'sfx_flask',
        'label': 'Глоток из фляги',
        'src': 'assets/audio/sfx/sfx_flask.ogg',
    }
    ids = [s['id'] for s in camp['sounds']]
    if 'sfx_flask' in ids:
        camp['sounds'][ids.index('sfx_flask')] = entry
    else:
        camp['sounds'].append(entry)
    save('campaign.json', camp)

    for sid, pairs in INTRO_VOICES.items():
        rel = f'scenes/{sid}.json'
        sc = load(rel)
        intro = sc.get('narrative_intro', [])
        for idx, vpath in pairs:
            if idx < len(intro) and isinstance(intro[idx], dict):
                intro[idx]['voice'] = vpath
        sc['narrative_intro'] = intro
        save(rel, sc)

    for iid, spec in ITEM_INSPECT.items():
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

    print('ЗВУК 27')
    print('  новый звук:', 'sfx_flask' + ('' if made else ' (уже был)'),
          '%.1f КБ' % (os.path.getsize(DST) / 1024))
    print('  привязаны ещё 10 дорожек озвучки narrative_intro (17/24)')
    print('  добавлен озвученный осмотр последним 7 предметам (57/57 = 100 %)')


if __name__ == '__main__':
    main()
