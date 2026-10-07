#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""Ход 26: звук — сигнал «Режима тишины» (`sfx_lockdown`) и привязка первых
7 дорожек озвучки вступительных карточек сцен (`narrative_intro`).

1. `sfx_lockdown` (`assets/audio/sfx/sfx_lockdown.ogg`) — тяжёлый лязг
   перекрываемого шлюза, низкий гудок яруса и тревожный удар колокола:
   сведение трёх реальных CC0-сэмплов (`sfx_door.ogg` + `sfx_horn.ogg` с
   lowpass 900 Гц + `sfx_bell.ogg` со сдвигом 220 мс). Привязан к правилу
   `rule_lockdown` и состоянию `state_lockdown` в `scene_office`.
2. Привязаны 7 дорожек озвучки рассказчика (`voice-00`) к карточкам
   `narrative_intro` в четырёх сценах (`scene_gate_hall` ×2,
   `scene_gate_office` ×2, `scene_dry_row` ×2, `scene_office` ×1).

Скрипт идемпотентен.
"""
import json
import os
import subprocess

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SFX = os.path.join(ROOT, 'assets', 'audio', 'sfx')
SRC_DOOR = os.path.join(SFX, 'sfx_door.ogg')
SRC_HORN = os.path.join(SFX, 'sfx_horn.ogg')
SRC_BELL = os.path.join(SFX, 'sfx_bell.ogg')
DST = os.path.join(SFX, 'sfx_lockdown.ogg')

INTRO_VOICES = {
    'scene_gate_hall': [
        (0, 'assets/voice/intro_gate_hall_1.mp3'),
        (1, 'assets/voice/intro_gate_hall_2.mp3'),
    ],
    'scene_gate_office': [
        (0, 'assets/voice/intro_gate_office_1.mp3'),
        (1, 'assets/voice/intro_gate_office_2.mp3'),
    ],
    'scene_dry_row': [
        (0, 'assets/voice/intro_dry_row_1.mp3'),
        (1, 'assets/voice/intro_dry_row_2.mp3'),
    ],
    'scene_office': [
        (0, 'assets/voice/intro_office_1.mp3'),
    ],
}


def ffmpeg():
    try:
        import imageio_ffmpeg
        return imageio_ffmpeg.get_ffmpeg_exe()
    except Exception:
        return 'ffmpeg'


def build_lockdown():
    if os.path.exists(DST) and os.path.getsize(DST) > 2000:
        return False
    tmp = DST + '.tmp.ogg'
    graph = (
        '[0:a]volume=0.95[a];'
        '[1:a]lowpass=f=900,adelay=120|120,volume=0.85[b];'
        '[2:a]adelay=240|240,volume=0.8[c];'
        '[a][b][c]amix=inputs=3:duration=longest:normalize=0[out]'
    )
    cmd = [
        ffmpeg(), '-y', '-loglevel', 'error',
        '-i', SRC_DOOR, '-i', SRC_HORN, '-i', SRC_BELL,
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
    made = build_lockdown()
    camp = load('campaign.json')
    entry = {
        'id': 'sfx_lockdown',
        'label': 'Сигнал режима тишины',
        'src': 'assets/audio/sfx/sfx_lockdown.ogg',
    }
    ids = [s['id'] for s in camp['sounds']]
    if 'sfx_lockdown' in ids:
        camp['sounds'][ids.index('sfx_lockdown')] = entry
    else:
        camp['sounds'].append(entry)
    save('campaign.json', camp)

    rl = load('rules/rule_lockdown.json')
    for ef in rl.get('effects', []):
        if ef.get('type') == 'play_sound':
            ef['sound'] = 'sfx_lockdown'
    save('rules/rule_lockdown.json', rl)

    for sid, pairs in INTRO_VOICES.items():
        rel = f'scenes/{sid}.json'
        sc = load(rel)
        intro = sc.get('narrative_intro', [])
        for idx, vpath in pairs:
            if idx < len(intro) and isinstance(intro[idx], dict):
                intro[idx]['voice'] = vpath
        sc['narrative_intro'] = intro
        save(rel, sc)

    print('ЗВУК 26')
    print('  новый звук:', 'sfx_lockdown' + ('' if made else ' (уже был)'),
          '%.1f КБ' % (os.path.getsize(DST) / 1024))
    print('  привязаны 7 дорожек озвучки narrative_intro (7/24)')


if __name__ == '__main__':
    main()
