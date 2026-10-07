#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""Ход 21: что принёс обновлённый движок.

1. Приложение назначило кампании новый id — берём без изменений.
2. `map_art` у региона: та же история, что с `art` у сцен. Карта у нас
   растровая (`map_image`), значит процедурную заглушку надо снять.
3. `environmental: true` у слотов. Все интерактивные предметы кампании
   (помпа, дверь, шкафчик, жаровня, трубы…) нарисованы прямо на фоне сцены
   и не имеют `scene_sprite` — а раз sprites нет, слот надо пометить
   хотспотом окружения: тогда в покое сцена чистая, объект проявляется
   при наведении и по Tab. Спрайты остаются только у десятерых НПС — они
   и правда накладываются поверх фона.
4. `particles` — живой слой атмосферы поверх сцены: пар в шлюзе и шахте,
   угли над жаровней, туман в галерее и штольне, капель у затвора,
   пепел на поверхности, искры у жилы.
5. `narrative_intro` — две-три строки атмосферного вступления при первом
   входе в сцену. Новое содержание: у каждой из двенадцати сцен теперь
   есть голос, которым она встречается с игроком.

Скрипт идемпотентен.
"""
import glob
import json
import os

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
NEW_ID = '1d57557e-92e1-4252-b156-a4439c1efb5d'

PARTICLES = {
    'scene_gate_hall': 'steam',
    'scene_gate_office': 'dust',
    'scene_pump_hall': 'dust',
    'scene_pump_shaft': 'steam',
    'scene_pump_room': 'dust',
    'scene_dry_row': 'embers',
    'scene_flood_gallery': 'fog',
    'scene_sluice': 'rain',
    'scene_office': 'ash',
    'scene_archive': 'dust',
    'scene_drift': 'fog',
    'scene_face': 'sparks',
}

INTRO = {
    'scene_gate_hall': [
        'Седьмой ярус встречают не запахом, а звуком: где-то ниже ходит вода, которой здесь быть не должно.',
        'Смотритель не поднимает глаз. Он и так знает, кто спускается, — журнал у него в голове.',
    ],
    'scene_gate_office': [
        'В будке пахнет маслом и чужим табаком. Журнал лежит раскрытым, будто из него только что вышли.',
        'Каждая фамилия в нём — это час, который кто-то провёл внизу. Некоторые часы ещё не кончились.',
    ],
    'scene_pump_hall': [
        'Седьмая помпа стоит. Она не сломана и не заржавела: она просто молчит, и это молчание слышно на весь ярус.',
        'Мазут на полу не высыхает — его некому вытирать третий день.',
    ],
    'scene_pump_shaft': [
        'Лестница уходит вниз, насколько видит глаз, и дальше — насколько слышит ухо.',
        'Сверху доносится ровный гул города. Здесь он звучит как чужое дыхание.',
    ],
    'scene_pump_room': [
        'Чужую каморку открывают ключом, а читают глазами. Записи лежат так, будто хозяин собирался вернуться через час.',
        'На столе чертёж, на котором седьмая помпа есть. В сводке её уже нет.',
    ],
    'scene_dry_row': [
        'Ряд зовётся Сухим, потому что вода сюда не дошла. Пока не дошла.',
        'У жаровни греются не от холода: здесь греются, чтобы не думать о том, что будет, когда вода дойдёт.',
    ],
    'scene_flood_gallery': [
        'Вода стоит по щиколотку и пахнет ржавчиной. Мостки ведут в темноту, которая не кончается.',
        'Идти надо боком, держась за стену: в галерее слышно всё, и тебя тоже слышно.',
    ],
    'scene_sluice': [
        'Затвор не закрыт — он приготовлен: колодка пуста, и пуста она не первый месяц.',
        'Капли считают секунды. Секунды можно не считать: их и так мало.',
    ],
    'scene_office': [
        'Наверху сухо, светло и тихо. Здесь решают, кому достанется вода, и не спрашивают, кому она достанется на самом деле.',
        'Инспектор Каст улыбается так, как улыбаются в конце длинного дня: вежливо и без участия.',
    ],
    'scene_archive': [
        'В архиве своя погода: пыль, лампа под зелёным стеклом и шелест бумаги, которой сто лет.',
        'Дело №136 лежит в папке толщиной в палец. Про девятый ярус в нём одно слово: исполнено.',
    ],
    'scene_drift': [
        'Штольня ведёт к тому, что город считает выработанным. Жила считает иначе.',
        'Свет лампы не достаёт до стен: видно только то, что прямо перед лицом.',
    ],
    'scene_face': [
        'Забой зовётся слепым, потому что из него нечего брать. Оказалось — есть что.',
        'Стена светится ровно, как бирюза под водой, и свет этот не от лампы.',
    ],
}


def load(rel):
    with open(os.path.join(ROOT, rel), encoding='utf-8') as f:
        return json.load(f)


def save(rel, data):
    with open(os.path.join(ROOT, rel), 'w', encoding='utf-8') as f:
        json.dump(data, f, ensure_ascii=False, indent=2)
        f.write('\n')


def main():
    # 1. id
    camp = load('campaign.json')
    old_id = camp.get('id')
    camp['id'] = NEW_ID
    save('campaign.json', camp)

    # 2. карта: растр важнее заглушки
    w = load('world.json')
    dropped = 0
    for region in w['regions']:
        if region.get('map_image') and region.get('map_art'):
            dropped += len(json.dumps(region.pop('map_art'), ensure_ascii=False))
    save('world.json', w)

    # 3–5. сцены
    items = set()
    for f in glob.glob(os.path.join(ROOT, 'entities', '*.json')):
        d = json.load(open(f, encoding='utf-8'))
        if d.get('type') == 'item':
            items.add(d['id'])

    stat = {'slots': 0, 'particles': 0, 'intro': 0}
    for rel in sorted(glob.glob('scenes/*.json')):
        d = load(rel)
        for slot in d.get('slots', []):
            ent = slot.get('default_entity')
            if ent in items and not slot.get('environmental'):
                slot['environmental'] = True
                stat['slots'] += 1
        if d['id'] in PARTICLES and d.get('particles') != PARTICLES[d['id']]:
            d['particles'] = PARTICLES[d['id']]
            stat['particles'] += 1
        if d['id'] in INTRO and d.get('narrative_intro') != INTRO[d['id']]:
            d['narrative_intro'] = INTRO[d['id']]
            stat['intro'] += 1
        save(rel, d)

    print('ДВИЖОК 21')
    print('  id кампании: %s → %s' % (old_id, NEW_ID))
    print('  map_art удалён: %.1f КБ' % (dropped / 1024))
    print('  слотов помечено хотспотами окружения:', stat['slots'])
    print('  сценам заданы частицы:', stat['particles'])
    print('  сценам написаны вступления:', stat['intro'],
          '(%d строк)' % sum(len(v) for v in INTRO.values()))


if __name__ == '__main__':
    main()
