#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""Ход 22: звук — штамп входящего реестра (`sfx_stamp`) и озвученный осмотр
ключевых предметов в сумке дознавателя.

1. `sfx_stamp` (`assets/audio/sfx/sfx_stamp.ogg`) — глухой удар конторского
   штампа и шорох листа: сведение двух реальных CC0-сэмплов Kenney
   (`snd_latch.ogg` с lowpass 900 Гц + `snd_paper.ogg` со сдвигом 120 мс).
   Привязан к реплике регистратора `registrar_10` («Ставлю входящий штамп…»)
   и к осмотру жетона дознавателя (`item_badge`).
2. Девяти ключевым предметам (`item_core`, `item_filter`, `item_valve`,
   `item_charge`, `item_badge`, `item_key_resh`, `item_key_cache`,
   `item_lamp`, `item_wrench`), получившим иллюстрации в этом ходу,
   прописаны звуковые карты `sounds` и действия осмотра `interact_options`
   со звуком — теперь их новые портреты 1200×800 открываются из сумки.

Скрипт идемпотентен.
"""
import json
import os
import subprocess

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SFX = os.path.join(ROOT, 'assets', 'audio', 'sfx')
SRC_LATCH = os.path.join(SFX, 'snd_latch.ogg')
SRC_PAPER = os.path.join(SFX, 'snd_paper.ogg')
DST = os.path.join(SFX, 'sfx_stamp.ogg')

ITEM_INSPECT = {
    'item_core': {
        'sounds': {'pickup': 'sfx_glass', 'use': 'sfx_hum'},
        'label': 'Поднести сердцевину к ладони',
        'hint': 'жильное стекло отвечает на тепло руки',
        'sound': 'sfx_hum',
        'text': (
            'Внутри свинцовой обоймы медленно ворочается бирюзовый свет. '
            'Стекло тёплое, как живое горло: без этой детали седьмая помпа '
            'не сделает ни одного хода, а с ней — либо откачает воду, либо '
            'разнесёт затвор.'
        ),
    },
    'item_filter': {
        'sounds': {'equip': 'snd_latch', 'unequip': 'snd_cloth', 'use': 'snd_vent'},
        'label': 'Проверить клапаны и банки',
        'hint': 'две сменные обоймы с дроблёным углём',
        'sound': 'snd_vent',
        'text': (
            'Резина клапана пахнет маслом, стёкла очков затянуты медной '
            'сеткой. По бокам — две банки с дроблёным углём и промасленным '
            'сукном: первая примет на себя штольню девятого яруса, вторая — '
            'слепой забой.'
        ),
    },
    'item_valve': {
        'sounds': {'pickup': 'sfx_gear', 'use': 'sfx_gear'},
        'label': 'Осмотреть резьбу клапана',
        'hint': 'латунное седло и медное кольцо',
        'sound': 'sfx_gear',
        'text': (
            'Тяжёлый перепускной клапан высокого давления. Резьба цела, '
            'медное уплотнительное кольцо не обжато: его сняли до того, как '
            'вода пошла в галерею.'
        ),
    },
    'item_charge': {
        'sounds': {'pickup': 'snd_charge', 'use': 'snd_charge'},
        'label': 'Проверить обмотку заряда',
        'hint': 'сердцевина в железной рубашке',
        'sound': 'snd_charge',
        'text': (
            'Сердцевина седьмой помпы стянута полосами кованого лома и '
            'промасленным шнуром. От обоймы идёт редкая мелкая дрожь: '
            'одного удара хватит, чтобы затвор восьмого яруса перестал '
            'существовать.'
        ),
    },
    'item_badge': {
        'sounds': {'pickup': 'snd_tag', 'use': 'sfx_stamp'},
        'label': 'Раскрыть удостоверение',
        'hint': 'жетон дознавателя и предписание на 72 часа',
        'sound': 'sfx_stamp',
        'text': (
            'Щиток из потемневшего серебра и вкладыш с печатью приёмной: '
            '«Дело №137. Срок дознания — семьдесят два часа с момента '
            'вручения. Подпись: инспектор В. Каст».'
        ),
    },
    'item_key_resh': {
        'sounds': {'pickup': 'sfx_lock', 'use': 'sfx_lock'},
        'label': 'Осмотреть бородку ключа',
        'hint': 'ручная ковка мастера Реша',
        'sound': 'sfx_lock',
        'text': (
            'Тяжёлый железный ключ с тремя косыми прорезями и латунной '
            'биркой. В связке Надзора дубликата нет — Реш выковал замок сам.'
        ),
    },
    'item_key_cache': {
        'sounds': {'pickup': 'sfx_lock', 'use': 'sfx_lock'},
        'label': 'Счистить соль с трубчатого ключа',
        'hint': 'ключ от плиты в штольне девятого яруса',
        'sound': 'sfx_lock',
        'text': (
            'Короткий бронзовый ключ с квадратным гнездом, побелевший от '
            'жильной соли. Такими запирают потайные плиты в старой крепи.'
        ),
    },
    'item_lamp': {
        'sounds': {'equip': 'sfx_lamp', 'unequip': 'snd_cloth', 'use': 'sfx_lamp'},
        'label': 'Подкрутить фитиль',
        'hint': 'карбидная лампа с бычьим стеклом',
        'sound': 'sfx_lamp',
        'text': (
            'Толстая линза в проволочной клетке даёт узкий жёлтый луч. '
            'Копоть на козырьке жирная: в сырости нижних ярусов лампа '
            'считает часы не хуже карманных часов.'
        ),
    },
    'item_wrench': {
        'sounds': {'equip': 'snd_latch', 'unequip': 'snd_cloth', 'use': 'sfx_anvil'},
        'label': 'Осмотреть губки ключа',
        'hint': 'ключ на 52 со следами латунной стружки',
        'sound': 'sfx_anvil',
        'text': (
            'Кованый разводной ключ на пятьдесят два. На губках — свежие '
            'забоины и мелкая латунная стружка: именно таким номером крутят '
            'муфты главного привода.'
        ),
    },
}


def ffmpeg():
    try:
        import imageio_ffmpeg
        return imageio_ffmpeg.get_ffmpeg_exe()
    except Exception:
        return 'ffmpeg'


def build_stamp():
    if os.path.exists(DST) and os.path.getsize(DST) > 2000:
        return False
    tmp = DST + '.tmp.ogg'
    graph = (
        '[0:a]lowpass=f=900,volume=1.1[a];'
        '[1:a]adelay=120|120,highpass=f=300,volume=0.7[b];'
        '[a][b]amix=inputs=2:duration=longest:normalize=0[out]'
    )
    cmd = [
        ffmpeg(), '-y', '-loglevel', 'error',
        '-i', SRC_LATCH, '-i', SRC_PAPER,
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
    made = build_stamp()
    camp = load('campaign.json')
    entry = {
        'id': 'sfx_stamp',
        'label': 'Штамп входящего реестра',
        'src': 'assets/audio/sfx/sfx_stamp.ogg',
    }
    ids = [s['id'] for s in camp['sounds']]
    if 'sfx_stamp' in ids:
        camp['sounds'][ids.index('sfx_stamp')] = entry
    else:
        camp['sounds'].append(entry)
    save('campaign.json', camp)

    # Привязка sfx_stamp к реплике регистратора registrar_10
    reg = load('dialogues/registrar.dlg.json')
    for ch in reg['nodes'][0].get('choices', []):
        if ch.get('text', '').startswith('Дело № 137 сшито'):
            for st in ch['sections'][0]['steps']:
                if st.get('kind') == 'line':
                    st['line']['sfx'] = 'sfx_stamp'
    save('dialogues/registrar.dlg.json', reg, indent=1)

    reg_ink_p = os.path.join(ROOT, 'dialogues/registrar.ink')
    reg_ink = open(reg_ink_p, encoding='utf-8').read()
    reg_ink = reg_ink.replace(
        '# sfx: snd_latch # voice: assets/voice/registrar_10.mp3',
        '# sfx: sfx_stamp # voice: assets/voice/registrar_10.mp3',
    )
    open(reg_ink_p, 'w', encoding='utf-8').write(reg_ink)

    # Осмотр и звуки девяти предметов
    patched = 0
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
        patched += 1

    print('ЗВУК 22')
    print('  новый звук:', 'sfx_stamp' + ('' if made else ' (уже был)'),
          '%.1f КБ' % (os.path.getsize(DST) / 1024))
    print('  озвучены осмотры предметов в сумке:', patched)


if __name__ == '__main__':
    main()
