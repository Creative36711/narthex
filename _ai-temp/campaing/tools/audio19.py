#!/usr/bin/env python3
"""Ход 19: звук — новые настоящие файлы и привязка висевшего sfx_file.

Что делаем:
1. Уголь в печке зазвучал. Новый звук `snd_coal` собран из двух настоящих
   CC0-сэмплов Kenney (Impact Sounds, подборка Cy4nWare/sfx-api): тяжёлый
   удар по дереву и удар по металлу — движок сам выбирает вариант
   (массив src), поэтому «бросаешь уголь» не звучит одинаково дважды.
2. `sfx_file` («Бумага в папку») был зарегистрирован, но не привязан ни к
   одному хуку интерфейса — привязываем к открытию справки.
3. Обновляем атрибуцию: новые файлы — CC0, авторы указаны.

Файлы — настоящие записи, никакого синтеза. Скрипт идемпотентен.
"""
import json
import os
import subprocess
import sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SFX = os.path.join(ROOT, 'assets', 'audio', 'sfx')

SRC = [
    ('snd_coal_1.ogg', 'sounds/impact-sounds/impactwood-heavy-000.ogg'),
    ('snd_coal_2.ogg', 'sounds/impact-sounds/impactmetal-heavy-002.ogg'),
]
REPO = 'Cy4nWare/sfx-api'


def load(rel):
    with open(os.path.join(ROOT, rel), encoding='utf-8') as fh:
        return json.load(fh)


def save(rel, data):
    with open(os.path.join(ROOT, rel), 'w', encoding='utf-8') as fh:
        json.dump(data, fh, ensure_ascii=False, indent=2)
        fh.write('\n')


def ffmpeg():
    try:
        import imageio_ffmpeg
        return imageio_ffmpeg.get_ffmpeg_exe()
    except Exception:
        return 'ffmpeg'


def fetch(path, dest):
    """Качает файл из GitHub через API (raw.githubusercontent недоступен)."""
    url = 'https://api.github.com/repos/%s/contents/%s' % (REPO, path)
    cmd = ['curl', '-sL', '-H', 'Accept: application/vnd.github.raw',
           '-H', 'User-Agent: arena-agent', url]
    raw = subprocess.run(cmd, capture_output=True)
    if len(raw.stdout) < 2000:
        return False
    tmp = dest + '.raw'
    with open(tmp, 'wb') as fh:
        fh.write(raw.stdout)
    # обрезаем до 1.2 с и выравниваем громкость: звук должен быть коротким
    subprocess.run([ffmpeg(), '-y', '-loglevel', 'error', '-i', tmp,
                    '-af', 'loudnorm=I=-18:TP=-2:LRA=8', '-t', '1.2',
                    '-c:a', 'libvorbis', '-q:a', '4', dest], check=False)
    os.remove(tmp)
    return os.path.exists(dest) and os.path.getsize(dest) > 1000


def main():
    os.makedirs(SFX, exist_ok=True)
    made = []
    for name, path in SRC:
        dest = os.path.join(SFX, name)
        if os.path.exists(dest) and os.path.getsize(dest) > 1000:
            continue
        if fetch(path, dest):
            made.append(name)
        else:
            print('  не скачалось:', name)
    camp = load('campaign.json')

    snd_id = 'snd_coal'
    entry = {
        'id': snd_id,
        'label': 'Уголь в печку',
        'src': ['assets/audio/sfx/%s' % n for n, _ in SRC],
    }
    ids = [s['id'] for s in camp['sounds']]
    if snd_id in ids:
        camp['sounds'][ids.index(snd_id)] = entry
    else:
        camp['sounds'].append(entry)

    camp['ui_sounds']['panel:help'] = 'sfx_file'
    save('campaign.json', camp)

    # печка: бросок угля звучит углём, кипяток — котелком
    stove = load('entities/item_stove.json')
    for opt in stove['interact_options']:
        if opt['label'] == 'Согреться':
            opt['sound'] = snd_id
        if opt['label'] == 'Печка холодная':
            opt['sound_volume'] = 0.45
    save('entities/item_stove.json', stove)

    # атрибуция
    note_add = (' Звук «Уголь в печку» — два CC0-сэмпла Kenney «Impact Sounds» '
                '(подборка Cy4nWare/sfx-api), обрезаны и выровнены по громкости.')
    if 'Уголь в печку' not in camp['attribution']['note']:
        camp['attribution']['note'] = camp['attribution']['note'].rstrip() + note_add
        save('campaign.json', camp)

    print('ЗВУК 19')
    print('  новых файлов:', made or 'уже были')
    print('  snd_coal привязан к печке; sfx_file — к открытию справки')


if __name__ == '__main__':
    sys.exit(main())
