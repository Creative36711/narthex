#!/usr/bin/env python3
"""Слои фона и музыка: что звучит в сцене и когда.

Отдельно от разовых звуков (`audio_hooks.py`), потому что здесь другие
правила: слой живёт всё время, пока герой в сцене, и включается по
условию — флагу, погоде, времени суток. Два слоя одного и того же звука
с разными условиями — ошибка: движок наложит их друг на друга, и громкость
перестанет что-либо значить. Поэтому таблица ниже задаёт слои целиком,
а не добавляет их к существующим.

Запуск: python3 tools/audio_layers.py
"""
import json
import os

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))


def load(path):
    with open(os.path.join(ROOT, path), encoding='utf-8') as fh:
        return json.load(fh)


def save(path, data):
    with open(os.path.join(ROOT, path), 'w', encoding='utf-8') as fh:
        json.dump(data, fh, ensure_ascii=False, indent=1)
    print(f'записан {path}')


def layer(sounds, volume, flag=None, neg=False):
    """Фоновый слой: звук, громкость и необязательное условие по флагу."""
    d = {'sounds': list(sounds), 'volume': volume}
    if flag:
        d['conditions'] = [{'type': 'flag_not_set' if neg else 'flag_set', 'flag': flag}]
    return d


def block(flag, tracks):
    """Музыкальный блок: первый подходящий по условию выигрывает."""
    return {'tracks': list(tracks),
            'conditions': [] if flag is None else [{'type': 'flag_set', 'flag': flag}]}


# новая дорожка: работающая помпа (до починки в зале звучит «мёртвая»)
NEW_MUSIC = [{'id': 'music_works', 'label': 'Семь помп (CC0)',
              'src': 'assets/audio/music/music_works.mp3'}]

# музыка машинного зала: починка → работа, режим тишины → тревога, иначе — «мёртвая помпа»
PUMP_MUSIC = [block('end_pump', ['music_works']),
              block('lockdown', ['music_alarm']),
              block(None, ['music_pump'])]

SCENES = {
    'scenes/scene_pump_hall.json': {'music': PUMP_MUSIC},
    'scenes/scene_pump_room.json': {'music': PUMP_MUSIC},
    # раньше оба слоя воды висели без условий — движок накладывал их друг на друга
    'scenes/scene_flood_gallery.json': {'ambient': [
        layer(['snd_water_amb'], 0.45, 'flood', neg=True),
        layer(['snd_water_amb'], 0.85, 'flood'),
        layer(['snd_rain'], 0.35, 'flood')]},
    'scenes/scene_pump_shaft.json': {'ambient': [
        layer(['snd_water_amb'], 0.3, 'flood', neg=True),
        layer(['snd_water_amb'], 0.6, 'flood')]},
    # в режиме тишины ряд пустеет: толпа уходит, жаровня остаётся
    'scenes/scene_dry_row.json': {'ambient': [
        layer(['snd_crowd'], 0.5, 'lockdown', neg=True),
        layer(['snd_fire'], 0.3)]},
    # строки-одиночки стали слоями с громкостью
    'scenes/scene_gate_hall.json': {'ambient': [layer(['snd_wind'], 0.5)]},
    'scenes/scene_sluice.json': {'ambient': [layer(['snd_water_amb'], 0.6)]},
}

LOCATIONS = {
    # помпа стоит — значит, гул работающей помпы в локации звучать не должен
    'loc_pump7': {'ambient': [
        layer(['snd_pump_amb'], 0.9, 'end_pump'),
        layer(['snd_deep_drone'], 0.4, 'end_pump', neg=True)],
        'music': PUMP_MUSIC},
    'loc_surface': {'ambient': [layer(['snd_wind'], 0.45)]},
    'loc_gate': {'ambient': [layer(['snd_wind'], 0.5)]},
    'loc_deep9': {'ambient': [layer(['snd_deep_drone'], 0.7)]},
}


def main():
    camp = load('campaign.json')
    ids = {t['id'] for t in camp['music_tracks']}
    for t in NEW_MUSIC:
        if t['id'] not in ids:
            camp['music_tracks'].append(t)
            ids.add(t['id'])
    camp['music_tracks'].sort(key=lambda t: t['id'])
    save('campaign.json', camp)

    for path, patch in SCENES.items():
        sc = load(path)
        sc.update(patch)
        save(path, sc)

    world = load('world.json')
    for loc in world['regions'][0]['locations']:
        patch = LOCATIONS.get(loc['id'])
        if patch:
            loc.update(patch)
    save('world.json', world)

    # проверка: не осталось ли двух слоёв одного звука без условий
    def check(where, layers):
        seen = {}
        for l in layers or []:
            if not isinstance(l, dict):
                print(f'  {where}: слой строкой, а не правилом — «{l}»')
                continue
            for s in l.get('sounds', []):
                key = (s, bool(l.get('conditions')))
                if key in seen and not l.get('conditions'):
                    print(f'  {where}: звук «{s}» без условий')
                seen[key] = True

    for path in SCENES:
        check(path, load(path).get('ambient'))
    world = load('world.json')
    for loc in world['regions'][0]['locations']:
        check('локация ' + loc['id'], loc.get('ambient'))
    print('\nготово')


if __name__ == '__main__':
    main()
