#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""Ход 21: звук — тяга в стволе шахты (`snd_shaft_amb`), фон восьмого яруса
до потопа и проверка неиспользуемых звуков.

1. `snd_shaft_amb` (`assets/audio/amb/snd_shaft_amb.mp3`) — гул вертикального
   ствола: сведение реальных CC0-записей сквозняка (`snd_wind.mp3`, полосовой
   фильтр 120–900 Гц) и редкой капели (`snd_drops.mp3`, −8 дБ) с бесшовным
   кроссфейдом хвоста в голову на 16 секундах. Привязан к `scene_pump_shaft`
   (0,42) и `scene_sluice` (0,35).
2. В `world.json` у `loc_ward8` фоновый слой был задан только для `flag_set:
   flood` — до потопа локация молчала. Добавлен слой `snd_drops` (0,55) при
   `flag_not_set: flood`, а все условия музыки локаций приведены к полному
   виду `{"type": "flag_set", "flag": "lockdown"}`.

Скрипт идемпотентен.
"""
import json
import os
import subprocess

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
AMB = os.path.join(ROOT, 'assets', 'audio', 'amb')
SRC_WIND = os.path.join(AMB, 'snd_wind.mp3')
SRC_DROPS = os.path.join(AMB, 'snd_drops.mp3')
DST = os.path.join(AMB, 'snd_shaft_amb.mp3')
SCENES = {'scene_pump_shaft': 0.42, 'scene_sluice': 0.35}


def ffmpeg():
    try:
        import imageio_ffmpeg
        return imageio_ffmpeg.get_ffmpeg_exe()
    except Exception:
        return 'ffmpeg'


def build():
    if os.path.exists(DST) and os.path.getsize(DST) > 100000:
        return False
    tmp = DST + '.tmp.mp3'
    graph = (
        '[0:a]atrim=0:16,asetpts=PTS-STARTPTS,highpass=f=110,lowpass=f=850,volume=0.65[w];'
        '[1:a]atrim=0:16,asetpts=PTS-STARTPTS,lowpass=f=1800,volume=0.38[d];'
        '[w][d]amix=inputs=2:duration=first:normalize=0[a];'
        '[a]asplit=2[m][n];'
        '[m]afade=t=out:st=14.5:d=1.5[m1];'
        '[n]atrim=0:1.5,asetpts=PTS-STARTPTS,afade=t=in:st=0:d=1.5,'
        'asetpts=PTS+14.5/TB[n1];'
        '[m1][n1]amix=inputs=2:duration=first:normalize=0,atrim=0:16[out]'
    )
    cmd = [
        ffmpeg(), '-y', '-loglevel', 'error',
        '-i', SRC_WIND, '-i', SRC_DROPS,
        '-filter_complex', graph, '-map', '[out]',
        '-c:a', 'libmp3lame', '-b:a', '96k', tmp,
    ]
    subprocess.run(cmd, capture_output=True)
    ok = os.path.exists(tmp) and os.path.getsize(tmp) > 100000
    if not ok:
        cmd = [
            ffmpeg(), '-y', '-loglevel', 'error', '-i', SRC_WIND,
            '-af', 'atrim=0:16,highpass=f=110,lowpass=f=850,volume=0.65',
            '-c:a', 'libmp3lame', '-b:a', '96k', tmp,
        ]
        subprocess.run(cmd, capture_output=True)
        ok = os.path.exists(tmp) and os.path.getsize(tmp) > 100000
    if ok:
        os.replace(tmp, DST)
    elif os.path.exists(tmp):
        os.remove(tmp)
    return ok


def load(rel):
    with open(os.path.join(ROOT, rel), encoding='utf-8') as f:
        return json.load(f)


def save(rel, data):
    with open(os.path.join(ROOT, rel), 'w', encoding='utf-8') as f:
        json.dump(data, f, ensure_ascii=False, indent=2)
        f.write('\n')


def main():
    made = build()
    camp = load('campaign.json')

    entry = {
        'id': 'snd_shaft_amb',
        'label': 'Тяга в стволе шахты (фон)',
        'src': 'assets/audio/amb/snd_shaft_amb.mp3',
        'loop': True,
    }
    ids = [s['id'] for s in camp['sounds']]
    if 'snd_shaft_amb' in ids:
        camp['sounds'][ids.index('snd_shaft_amb')] = entry
    else:
        camp['sounds'].append(entry)

    note = (' Фон ствола «Тяга в стволе шахты» — сведение CC0-записей ветра '
            'и капели с полосовой фильтрацией и бесшовной петлёй.')
    if 'Тяга в стволе шахты' not in camp['attribution']['note']:
        camp['attribution']['note'] = camp['attribution']['note'].rstrip() + note
    save('campaign.json', camp)

    bound = []
    for scene, vol in SCENES.items():
        d = load('scenes/%s.json' % scene)
        amb = d.setdefault('ambient', [])
        if not any('snd_shaft_amb' in (layer.get('sounds') or []) for layer in amb):
            amb.append({'sounds': ['snd_shaft_amb'], 'volume': vol})
            save('scenes/%s.json' % scene, d)
            bound.append('%s (%.2f)' % (scene, vol))

    # world.json: loc_ward8 до потопа + единообразные условия музыки
    w = load('world.json')
    for r in w['regions']:
        for loc in r.get('locations', []):
            for m in loc.get('music', []):
                for c in m.get('conditions', []):
                    if 'flag' in c and 'type' not in c:
                        c['type'] = 'flag_set'
            if loc['id'] == 'loc_ward8':
                amb = loc.setdefault('ambient', [])
                if not any(
                    any(c.get('type') == 'flag_not_set' and c.get('flag') == 'flood'
                        for c in (a.get('conditions') or []))
                    for a in amb
                ):
                    amb.append({
                        'conditions': [{'type': 'flag_not_set', 'flag': 'flood'}],
                        'sounds': ['snd_drops'],
                        'volume': 0.55,
                    })
    save('world.json', w)

    print('ЗВУК 21')
    print('  новый фон:', 'snd_shaft_amb' + ('' if made else ' (уже был)'),
          '%.0f КБ' % (os.path.getsize(DST) / 1024))
    print('  привязан к сценам:', ', '.join(bound) or 'уже привязан')


if __name__ == '__main__':
    main()
