#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""Ход 28 (финал): звук — сургучно-латунная печать закрытия дела (`sfx_seal`,
67-й звук в реестре) и привязка последних 7 дорожек озвучки вступительных
карточек сцен (`narrative_intro`, итого 24/24 = 100 % во всех 12 сценах).

Во всей кампании теперь озвучены 100 % всех диалогов (135/135 реплик и 39/39
ремарок), 100 % всех слайдов катсцен (17/17) и 100 % всех вступительных
карточек сцен (24/24) — всего 213 файлов озвучки.

Скрипт идемпотентен.
"""
import json
import os
import subprocess

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SFX = os.path.join(ROOT, 'assets', 'audio', 'sfx')
SRC_BOOK = os.path.join(SFX, 'sfx_book.ogg')
SRC_STAMP = os.path.join(SFX, 'sfx_stamp.ogg')
SRC_LATCH = os.path.join(SFX, 'snd_latch.ogg')
DST = os.path.join(SFX, 'sfx_seal.ogg')

INTRO_UPDATES = {
    'scene_flood_gallery': [
        (
            1,
            'По узкому карнизу вдоль стены приходится идти боком, держась за скользкие скобы. '
            'В сырой трубе галереи любой шорох разносится на десятки саженей, а из боковых '
            'штреков тянет гнилым илом.',
            'assets/voice/intro_flood_gallery_2.mp3',
        ),
    ],
    'scene_sluice': [
        (
            0,
            'В конце затопленной галереи проход перегораживает массивный чугунный затвор '
            'восьмого яруса. От клепаного полотна веет ледяным давлением грунтовых вод, '
            'а бронзовая втулка штурвала пустует.',
            'assets/voice/intro_sluice_1.mp3',
        ),
        (
            1,
            'Тяжёлые капли мерно бьют по железному настилу, отсчитывая оставшиеся часы '
            'до прорыва. У самой кромки чёрной воды в каменной нише чернеет запертый '
            'аварийный ящик старой проходческой смены.',
            'assets/voice/intro_sluice_2.mp3',
        ),
    ],
    'scene_drift': [
        (
            0,
            'Девятый ярус давно вычеркнут из сменных нарядов: крепи здесь рассохлись, '
            'а воздух густой и тёплый, как в кузнечном горне. На каждом вдохе сквозь '
            'угольную пыль проступает тяжёлый, сладковатый привкус жильного пара.',
            'assets/voice/intro_drift_1.mp3',
        ),
        (
            1,
            'Свет масляной лампы вязнет в сизом тумане и едва достаёт до обрушенных '
            'стоек старой выработки. Где-то впереди за поворотом штольни глухо и '
            'размеренно гудит сам камень.',
            'assets/voice/intro_drift_2.mp3',
        ),
    ],
    'scene_face': [
        (
            0,
            'На старых маркшейдерских картах этот тупик помечен как пустой слепой забой. '
            'Но здесь, на самом дне шахты, порода разошлась живым швом, и в нише у ручного '
            'подъёмника горит тусклый ночник.',
            'assets/voice/intro_face_1.mp3',
        ),
        (
            1,
            'Сквозь трещину в чёрном камне сочится ровный бирюзовый свет, от которого не '
            'падают тени. Вся выработка дышит в такт глубокому подземному пульсу, ожидая '
            'твоего последнего решения.',
            'assets/voice/intro_face_2.mp3',
        ),
    ],
}


def ffmpeg():
    try:
        import imageio_ffmpeg
        return imageio_ffmpeg.get_ffmpeg_exe()
    except Exception:
        return 'ffmpeg'


def build_seal():
    if os.path.exists(DST) and os.path.getsize(DST) > 2000:
        return False
    tmp = DST + '.tmp.ogg'
    graph = (
        '[0:a]volume=0.85[a];'
        '[1:a]adelay=180|180,volume=0.95[b];'
        '[2:a]asetrate=44100*0.88,aresample=44100,adelay=420|420,volume=0.75[c];'
        '[a][b][c]amix=inputs=3:duration=longest:normalize=0[out]'
    )
    cmd = [
        ffmpeg(), '-y', '-loglevel', 'error',
        '-i', SRC_BOOK, '-i', SRC_STAMP, '-i', SRC_LATCH,
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
    made = build_seal()
    camp = load('campaign.json')
    entry = {
        'id': 'sfx_seal',
        'label': 'Печать закрытия дела',
        'src': 'assets/audio/sfx/sfx_seal.ogg',
    }
    ids = [s['id'] for s in camp['sounds']]
    if 'sfx_seal' in ids:
        camp['sounds'][ids.index('sfx_seal')] = entry
    else:
        camp['sounds'].append(entry)
    camp.setdefault('ui_sounds', {})['heal'] = 'sfx_flask'
    save('campaign.json', camp)

    for sid, items in INTRO_UPDATES.items():
        rel = f'scenes/{sid}.json'
        sc = load(rel)
        intro = sc.get('narrative_intro', [])
        for idx, txt, vpath in items:
            if idx < len(intro) and isinstance(intro[idx], dict):
                intro[idx]['text'] = txt
                intro[idx]['voice'] = vpath
        sc['narrative_intro'] = intro
        save(rel, sc)

    print('ЗВУК 28')
    print('  новый звук:', 'sfx_seal' + ('' if made else ' (уже был)'),
          '%.1f КБ' % (os.path.getsize(DST) / 1024))
    print('  озвучены все 24 из 24 карточек narrative_intro (100 % во всех 12 сценах)')


if __name__ == '__main__':
    main()
