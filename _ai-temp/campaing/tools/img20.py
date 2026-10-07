#!/usr/bin/env python3
"""Ход 20: ставит портреты предметов на место.

Картинки приходят 1024×1024 и крупнее. Окно взаимодействия у движка
широкое, поэтому кадр обрезается по центру до 1200×800 и пережимается
в JPEG q88 — так же, как десять кадров прошлого хода.

Скрипт идемпотентен.
"""
import json
import os

from PIL import Image

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SIZE = (1200, 800)

ITEMS = [
    'item_glove', 'item_cot', 'item_stove', 'item_brazier', 'item_pipes',
    'item_locker', 'item_hoist', 'item_ladder', 'item_vent', 'item_board',
]


def main():
    done, skipped = [], []
    for iid in ITEMS:
        src = os.path.join(ROOT, 'assets', 'img', 'items', iid + '.jpg')
        if not os.path.exists(src):
            skipped.append(iid + ' (нет файла)')
            continue
        im = Image.open(src).convert('RGB')
        w, h = im.size
        if (w, h) != SIZE:
            # вписываем по высоте, потом забираем центр нужной ширины
            if h != SIZE[1]:
                im = im.resize((max(1, int(w * SIZE[1] / h)), SIZE[1]), Image.LANCZOS)
                w, h = im.size
            if w > SIZE[0]:
                left = (w - SIZE[0]) // 2
                im = im.crop((left, 0, left + SIZE[0], h))
            elif w < SIZE[0]:
                im = im.resize(SIZE, Image.LANCZOS)
        im.save(src, 'JPEG', quality=88, optimize=True)
        rel = 'assets/img/items/%s.jpg' % iid

        path = os.path.join(ROOT, 'entities', iid + '.json')
        data = json.load(open(path, encoding='utf-8'))
        portrait = data.get('portrait') or {}
        if portrait.get('neutral') != rel:
            portrait['neutral'] = rel
            data['portrait'] = portrait
            with open(path, 'w', encoding='utf-8') as fh:
                json.dump(data, fh, ensure_ascii=False, indent=2)
                fh.write('\n')
        done.append('%s %dx%d %.0f КБ' % (iid, im.size[0], im.size[1],
                                          os.path.getsize(src) / 1024))

    print('КАРТИНКИ 20')
    for line in done:
        print('  ', line)
    if skipped:
        print('  пропущено:', ', '.join(skipped))
    rest = []
    for f in sorted(os.listdir(os.path.join(ROOT, 'entities'))):
        if not f.startswith('item_'):
            continue
        d = json.load(open(os.path.join(ROOT, 'entities', f), encoding='utf-8'))
        if d.get('interact_options') and not (d.get('portrait') or {}).get('neutral'):
            rest.append(d['id'])
    print('  без портрета осталось:', len(rest), ', '.join(rest))


if __name__ == '__main__':
    main()
