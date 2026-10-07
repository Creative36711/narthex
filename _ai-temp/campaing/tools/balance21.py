#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""Ход 21: глубокая правка баланса потребностей, воздуха и угля.

Что обнаружил аудит реальной формулы движка в `campaign.json`:

1. **Тепло (`need_warmth`) в игре вообще не тратилось (0 за 72 часа)**:
   - в `decay_when` стояло условие `equipped: item_coat, not: true`, а герой
     со старта одет в `item_coat` (`entities/player_hero.json`);
   - вдобавок стояло `restore_per_tick: 6` на `morning, day`, то есть даже без
     плаща подземные ярусы сами «отогревали» героя утром на +72 в сутки.
   Из-за этого `need_warmth` всю игру держалось на 100/100, кнопки «Согреться»
   на печке и жаровне (`need_le: 70`) никогда не появлялись, уголь не расходовался,
   а `rule_warn_cold` не могло сработать.
   **Исправление:** под землёй (`loc_gate`, `loc_pump7`, `loc_ward8`, `loc_deep9`)
   тепло уходит по 1,5 в час всегда; само возвращается (+4/ч) только в сухой
   конторе на поверхности (`loc_surface`).

2. **Сон (`need_rest`) сам восстанавливался на ходу днём (+10/ч)**:
   - стояло `decay_when: evening, night` и `restore_per_tick: 10` на `morning, day`:
     за ночь уходило 12 пунктов, а к восьми утра на ногах шкала снова была 100.
   **Исправление:** `decay_when` и `restore_when` со сна сняты — сон уходит
   по 1,0 каждый час бодрствования (ровно как в таблице §8 дизайн-документа:
   36 / 52 / 78) и возвращается только на койке (`item_cot`) или привалом.

3. **Воздух (`need_air`) при 4,0/ч позволял пройти и восьмой, и девятый ярус
   без дыхателя** (`17 ч × 4,0 = 68 < 100`, даже не заходя в красную зону 25).
   **Исправление:** `decay_per_tick` поднят с 4,0 до **5,5** (запас без маски —
   18 часов: восьмой ярус проходится, но попытка спуститься ещё и на девятый
   без `item_filter` и без стравливания воздуха на `item_pipes` доводит шкалу
   до нуля).

4. **Жаровня Сухого ряда (`item_brazier`) грела бесплатно сколько угодно раз**,
   обесценивая уголь на восьмом ярусе вопреки репликам Векса и Дожа.
   **Исправление:** первый обогрев у общего огня остаётся бесплатным (+30 к
   теплу, флаг `brazier_free_used`), каждый следующий требует 1 `item_coal`
   (+40 к теплу).

Скрипт идемпотентен.
"""
import json
import os

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))


def load(rel):
    with open(os.path.join(ROOT, rel), encoding='utf-8') as f:
        return json.load(f)


def save(rel, data):
    with open(os.path.join(ROOT, rel), 'w', encoding='utf-8') as f:
        json.dump(data, f, ensure_ascii=False, indent=2)
        f.write('\n')


def main():
    camp = load('campaign.json')

    # 1. Флаг первого бесплатного обогрева у жаровни
    flags = camp.get('flags', [])
    if not any(f['id'] == 'brazier_free_used' for f in flags):
        flags.append({
            'id': 'brazier_free_used',
            'label': 'Погрелся у общего огня в Сухом ряду',
            'description': (
                'Первый час у жаровни Сухого ряда бесплатный; дальше нужно '
                'подбрасывать свой уголь.'
            ),
        })

    # 2. Потребности
    for n in camp.get('needs', []):
        nid = n['id']
        if nid == 'need_air':
            n['decay_per_tick'] = 5.5
        elif nid == 'need_warmth':
            n['decay_per_tick'] = 1.5
            n['decay_when'] = [{
                'type': 'in_location',
                'locations': ['loc_gate', 'loc_pump7', 'loc_ward8', 'loc_deep9'],
            }]
            n['restore_per_tick'] = 4
            n['restore_when'] = [{
                'type': 'in_location',
                'locations': ['loc_surface'],
            }]
        elif nid == 'need_rest':
            n['decay_per_tick'] = 1.0
            n.pop('decay_when', None)
            n.pop('restore_per_tick', None)
            n.pop('restore_when', None)

    save('campaign.json', camp)

    # 3. Жаровня: первый раз бесплатно, дальше за уголь
    brazier = load('entities/item_brazier.json')
    brazier['interact_options'] = [
        {
            'label': 'Погреться у общего огня',
            'hint': 'первый час у общей жаровни бесплатный (+30 к теплу)',
            'sound': 'snd_pot',
            'conditions': [
                {'type': 'need_le', 'need': 'need_warmth', 'threshold': 75},
                {'type': 'flag_not_set', 'flag': 'brazier_free_used'},
            ],
            'effects': [
                {'type': 'set_flag', 'flag': 'brazier_free_used'},
                {'type': 'change_need', 'need': 'need_warmth', 'delta': 30},
                {'type': 'advance_time', 'ticks': 1},
            ],
            'message': (
                'Пока в жаровне тлеет общий уголь, место у огня не жалеют. '
                'В следующий раз придётся подбросить своё — даром в Сухом ряду '
                'греют только раз.'
            ),
        },
        {
            'label': 'Подбросить угля и согреться',
            'hint': 'час у жаровни за свой кусок угля (+40 к теплу)',
            'sound': 'snd_coal',
            'conditions': [
                {'type': 'need_le', 'need': 'need_warmth', 'threshold': 75},
                {'type': 'flag_set', 'flag': 'brazier_free_used'},
                {'type': 'has_item', 'item': 'item_coal', 'min_quantity': 1},
            ],
            'effects': [
                {'type': 'remove_item', 'item': 'item_coal', 'quantity': 1},
                {'type': 'change_need', 'need': 'need_warmth', 'delta': 40},
                {'type': 'advance_time', 'ticks': 1},
            ],
            'message': 'Твой уголь занимается синим пламенем, и сырость отступает.',
        },
        {
            'label': 'Сготовить на жаровне',
            'hint': 'паёк и вода становятся похлёбкой',
            'sound': 'snd_pot',
            'effects': [
                {'type': 'open_craft', 'recipe': 'recipe_stew'},
            ],
            'message': (
                'Угли дышат ровно. Здесь можно сварить то, что в сухом виде '
                'не лезет в горло.'
            ),
        },
    ]
    save('entities/item_brazier.json', brazier)

    print('БАЛАНС 21')
    for n in camp['needs']:
        print('  %-12s decay=%.1f | decay_when=%s | restore=%s' % (
            n['id'], n['decay_per_tick'],
            bool(n.get('decay_when')), n.get('restore_per_tick')))
    print('  восьмой + девятый без маски (17 ч × 5,5): -93,5 воздуха → маска обязательна')
    print('  уголь в игре: 3 со старта + 2 в ящике Реша = 5 бесплатных кусков')


if __name__ == '__main__':
    main()
