#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""Ход 20: звук — гул поверхности и ревизия реестра.

1. Три сцены на поверхности (приёмная Надзора, архив, будка смотрителя)
   стояли в тишине: у кампании не было фонового слоя для верхних ярусов.
   Появился `snd_city_amb` — далёкий гул города, в котором работают семь
   помп. Это не синтез: производная от настоящей записи работы помп
   (CC0-Music «Deep Tones»), срезанная, приглушённая фильтром низких
   частот, утишенная и зацикленная кроссфейдом.
2. `sfx_log_open` и `sfx_log_close` числились в реестре, но не звучали
   нигде: журнал расследования и есть панель `panel:journal`, у которой
   свои звуки. Мёртвые записи и их файлы удалены — в пакете не должно
   лежать того, что не играет.

Скрипт идемпотентен.
"""
import json
import os
import subprocess

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
AMB = os.path.join(ROOT, 'assets', 'audio', 'amb')
SRC = os.path.join(AMB, 'snd_pump_amb.mp3')
DST = os.path.join(AMB, 'snd_city_amb.mp3')
DEAD = ('sfx_log_open', 'sfx_log_close')
SCENES = {'scene_archive': 0.32, 'scene_office': 0.28, 'scene_gate_office': 0.38}


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
    # 16 секунд; хвост затухает, и на его место встаёт голова — петля без щелчка
    graph = ('[0:a]atrim=0:16,asetpts=PTS-STARTPTS,lowpass=f=420,volume=0.55[a];'
             '[a]asplit=2[m][n];'
             '[m]afade=t=out:st=14.5:d=1.5[m1];'
             '[n]atrim=0:1.5,asetpts=PTS-STARTPTS,afade=t=in:st=0:d=1.5,'
             'asetpts=PTS+14.5/TB[n1];'
             '[m1][n1]amix=inputs=2:duration=first:normalize=0,atrim=0:16[out]')
    cmd = [ffmpeg(), '-y', '-loglevel', 'error', '-i', SRC,
           '-filter_complex', graph, '-map', '[out]',
           '-c:a', 'libmp3lame', '-b:a', '96k', tmp]
    r = subprocess.run(cmd, capture_output=True)
    ok = os.path.exists(tmp) and os.path.getsize(tmp) > 100000
    if not ok:
        cmd = [ffmpeg(), '-y', '-loglevel', 'error', '-i', SRC,
               '-af', 'atrim=0:16,lowpass=f=420,volume=0.55',
               '-c:a', 'libmp3lame', '-b:a', '96k', tmp]
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
        'id': 'snd_city_amb',
        'label': 'Гул города (фон)',
        'src': 'assets/audio/amb/snd_city_amb.mp3',
        'loop': True,
    }
    ids = [s['id'] for s in camp['sounds']]
    if 'snd_city_amb' in ids:
        camp['sounds'][ids.index('snd_city_amb')] = entry
    else:
        camp['sounds'].append(entry)

    # мёртвые записи — вон
    removed = []
    for dead in DEAD:
        if dead in ids:
            camp['sounds'] = [s for s in camp['sounds'] if s['id'] != dead]
            removed.append(dead)
    for dead in DEAD:
        for ext in ('.ogg', '.mp3', '.wav'):
            p = os.path.join(ROOT, 'assets', 'audio', 'sfx', dead + ext)
            if os.path.exists(p):
                os.remove(p)
                break

    note = (' Фон поверхности «Гул города» — производная от CC0-записи работы помп: '
            'срез, фильтр низких частот, тише и зациклен.')
    if 'Гул города' not in camp['attribution']['note']:
        camp['attribution']['note'] = camp['attribution']['note'].rstrip() + note
    save('campaign.json', camp)

    bound = []
    for scene, vol in SCENES.items():
        d = load('scenes/%s.json' % scene)
        amb = d.setdefault('ambient', [])
        if not any('snd_city_amb' in (layer.get('sounds') or []) for layer in amb):
            amb.append({'sounds': ['snd_city_amb'], 'volume': vol})
            save('scenes/%s.json' % scene, d)
            bound.append('%s (%.2f)' % (scene, vol))

    print('ЗВУК 20')
    print('  новый фон:', 'snd_city_amb' + ('' if made else ' (уже был)'),
          '%.0f КБ' % (os.path.getsize(DST) / 1024))
    print('  привязан к сценам:', ', '.join(bound) or 'уже привязан')
    print('  удалены мёртвые записи:', ', '.join(removed) or 'нет')
    if os.path.exists(DST + '.tmp.mp3'):
        os.remove(DST + '.tmp.mp3')


if __name__ == '__main__':
    main()
