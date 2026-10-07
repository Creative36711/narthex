#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""Ход 25: звук — цепной бандаж (`sfx_brace`) и звуковые акценты `sfx` во
вступительных карточках (`narrative_intro` / `NarrativeIntroEntry`) всех 12 сцен
по спецификации обновлённого движка (`eeb2764`).

1. `sfx_brace` (`assets/audio/sfx/sfx_brace.ogg`) — натяжение цепи лебёдки,
   глухой удар свинцовой накладки и щелчок храповика: сведение трёх реальных
   CC0-сэмплов (`snd_chain.ogg` + `sfx_anvil.ogg` с lowpass 950 Гц +
   `sfx_lever.ogg` со сдвигом 180 мс).
2. Во всех 12 сценах (`scenes/*.json`) карточки `narrative_intro` переведены в
   формат `NarrativeIntroEntry` (`{ "text", "sfx" }`), включён флаг
   `narrative_intro_once: true` и задана атмосферная подпись кнопки завершения
   (`narrative_intro_done_label`).

Скрипт идемпотентен.
"""
import json
import os
import subprocess

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SFX = os.path.join(ROOT, 'assets', 'audio', 'sfx')
SRC_CHAIN = os.path.join(SFX, 'snd_chain.ogg')
SRC_ANVIL = os.path.join(SFX, 'sfx_anvil.ogg')
SRC_LEVER = os.path.join(SFX, 'sfx_lever.ogg')
DST = os.path.join(SFX, 'sfx_brace.ogg')

SCENE_INTRO_SFX = {
    'scene_gate_hall': (['sfx_door', 'sfx_step'], 'Осмотреть шлюз ▶'),
    'scene_gate_office': (['snd_fire', 'snd_paper'], 'Подойти к столу ▶'),
    'scene_dry_row': (['snd_fire', 'sfx_coins'], 'Выйти в ряд ▶'),
    'scene_office': (['sfx_door', 'snd_paper'], 'Войти в контору ▶'),
    'scene_archive': (['sfx_archive_open', 'sfx_flip'], 'Осмотреть полки ▶'),
    'scene_pump_hall': (['sfx_gear', 'sfx_water'], 'Осмотреть привод ▶'),
    'scene_pump_room': (['sfx_lock', 'sfx_water'], 'Осмотреть каморку ▶'),
    'scene_pump_shaft': (['sfx_rungs', 'sfx_water'], 'Взглянуть вниз ▶'),
    'scene_flood_gallery': (['sfx_wade', 'sfx_water'], 'Ступить на мостки ▶'),
    'scene_sluice': (['sfx_surge', 'sfx_lever'], 'Подойти к затвору ▶'),
    'scene_drift': (['snd_stone', 'sfx_machine'], 'Вглядеться в штольню ▶'),
    'scene_face': (['sfx_hum', 'snd_chain'], 'Прислушаться к Жиле ▶'),
}


def ffmpeg():
    try:
        import imageio_ffmpeg
        return imageio_ffmpeg.get_ffmpeg_exe()
    except Exception:
        return 'ffmpeg'


def build_brace():
    if os.path.exists(DST) and os.path.getsize(DST) > 2000:
        return False
    tmp = DST + '.tmp.ogg'
    graph = (
        '[0:a]volume=0.95[a];'
        '[1:a]asetrate=44100*0.78,aresample=44100,lowpass=f=950,adelay=90|90,volume=0.85[b];'
        '[2:a]adelay=180|180,volume=0.9[c];'
        '[a][b][c]amix=inputs=3:duration=longest:normalize=0[out]'
    )
    cmd = [
        ffmpeg(), '-y', '-loglevel', 'error',
        '-i', SRC_CHAIN, '-i', SRC_ANVIL, '-i', SRC_LEVER,
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
    made = build_brace()
    camp = load('campaign.json')
    entry = {
        'id': 'sfx_brace',
        'label': 'Стяжка бандажа',
        'src': 'assets/audio/sfx/sfx_brace.ogg',
    }
    ids = [s['id'] for s in camp['sounds']]
    if 'sfx_brace' in ids:
        camp['sounds'][ids.index('sfx_brace')] = entry
    else:
        camp['sounds'].append(entry)
    save('campaign.json', camp)

    for sid, (sfx_pair, done_lbl) in SCENE_INTRO_SFX.items():
        rel = f'scenes/{sid}.json'
        sc = load(rel)
        raw_intro = sc.get('narrative_intro', [])
        new_intro = []
        for idx, item in enumerate(raw_intro):
            txt = item['text'] if isinstance(item, dict) else str(item)
            entry_obj = {
                'text': txt,
                'sfx': sfx_pair[idx % len(sfx_pair)],
            }
            if isinstance(item, dict) and item.get('voice'):
                entry_obj['voice'] = item['voice']
            new_intro.append(entry_obj)
        sc['narrative_intro'] = new_intro
        sc['narrative_intro_once'] = True
        sc['narrative_intro_next_label'] = 'Далее ▶'
        sc['narrative_intro_done_label'] = done_lbl
        save(rel, sc)

    print('ЗВУК 25')
    print('  новый звук:', 'sfx_brace' + ('' if made else ' (уже был)'),
          '%.1f КБ' % (os.path.getsize(DST) / 1024))
    print('  озвучены SFX-акцентами 24 карточки narrative_intro во всех 12 сценах')


if __name__ == '__main__':
    main()
