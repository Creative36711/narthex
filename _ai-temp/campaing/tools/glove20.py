#!/usr/bin/env python3
"""Ход 20: рукавица с привода — шестая улика, которой не было.

Аудит сюжета нашёл расхождение: дизайн-документ с первого хода описывает
шесть улик и называет среди них «рукавицу под приводом» (`item_glove`),
а в кампании такой вещи нет. Проверка «Осмотреть привод» ставит флаг
`clue_glove` и двигает счётчик, но ничего в инвентарь не кладёт: улика
есть в журнале и нет в руках. Остальные пять (записка, пломба, жетон,
гроссбух, наряд) — настоящие предметы, их можно пришить к делу.

Что делаем:
1. Рукавица становится предметом `item_glove` — её находят под приводом.
2. Её можно пришить к делу №137 наравне с остальными.
3. «Сшить дело» вместо перечисления всех четвёрок флагов считает переменную
   `case_filed`: с пятой уликой комбинаций стало десять, и держать их
   списком — значит ошибиться.
4. Запись в журнале дела.

Скрипт идемпотентен.
"""
import json
import os

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))


def load(rel):
    with open(os.path.join(ROOT, rel), encoding='utf-8') as fh:
        return json.load(fh)


def save(rel, data):
    with open(os.path.join(ROOT, rel), 'w', encoding='utf-8') as fh:
        json.dump(data, fh, ensure_ascii=False, indent=2)
        fh.write('\n')


def find(seq, key, val):
    for i, x in enumerate(seq):
        if x.get(key) == val:
            return i
    return None


GLOVE = {
    'id': 'item_glove',
    'type': 'item',
    'category': 'clue',
    'label': 'Рукавица с привода',
    'description': ('Брезентовая рукавица стражи, пропитанная мазутом. На манжете — '
                    'клеймо седьмого яруса, на ладони — царапина от срезанной муфты. '
                    'Заплата на большом пальце поставлена хозяйской иглой: в караулке '
                    'так не штопают.'),
    'weight': 0.2,
    'stackable': False,
    'value': {'mark': 1},
    'quest_item': True,
    'interact_options': [
        {
            'label': 'Рассмотреть рукавицу',
            'effects': [
                {'type': 'show_message',
                 'text': ('Мазут въелся намертво, но клеймо читается: седьмой ярус, '
                          'караульная партия. Размер велик мастеру — Реш носил кожаные '
                          'и жаловался, что они жмут. Эта рукавица не его.')},
            ],
            'once': True,
            'sound': 'snd_cloth',
            'hint': 'клеймо скажет, чья партия стояла в зале',
        }
    ],
    'interact_hint': 'Рассмотреть рукавицу',
}


def main():
    made = []

    # 1. предмет
    path = os.path.join(ROOT, 'entities', 'item_glove.json')
    if os.path.exists(path):
        old = load('entities/item_glove.json')
        old.update(GLOVE)
        data = old
    else:
        data = GLOVE
        made.append('item_glove')
    save('entities/item_glove.json', data)

    # 2. находка под приводом
    eng = load('entities/item_pump_engine.json')
    opt = eng['interact_options'][find(eng['interact_options'], 'label', 'Осмотреть привод')]
    succ = opt['effects'][1]['success_effects']
    if not any(e.get('item') == 'item_glove' for e in succ):
        succ.insert(1, {'type': 'add_item', 'item': 'item_glove', 'quantity': 1})
        for e in succ:
            if e.get('type') == 'show_message':
                e['text'] = ('Муфта срезана ровно, по метке: её снимали, а не рвало. '
                             'А в масляном поддоне под приводом лежит сама рукавица — '
                             'мазутная, с клеймом караульной партии, с чужой заплатой '
                             'на большом пальце.')
        opt['hint'] = 'срез муфты и рукавица в поддоне: не мастера, стражи'
        save('entities/item_pump_engine.json', eng)
        made.append('находка под приводом')

    # 3. пришить к делу и счётчик вместо перечисления комбинаций
    case = load('entities/item_case.json')
    opts = case['interact_options']
    if find(opts, 'label', 'Пришить рукавицу с привода') is None:
        opts.insert(find(opts, 'label', 'Пришить наряд стражи') + 1, {
            'label': 'Пришить рукавицу с привода',
            'conditions': [{'type': 'has_item', 'item': 'item_glove'},
                           {'type': 'flag_not_set', 'flag': 'case_filed_glove'}],
            'effects': [
                {'type': 'set_flag', 'flag': 'case_filed_glove'},
                {'type': 'change_variable', 'var': 'case_filed', 'delta': 1},
                {'type': 'journal_update', 'quest': 'quest_pump', 'text_key': 'j_glove'},
                {'type': 'grant_xp', 'points': 5},
            ],
            'message': ('Ты прокалываешь манжету шилом: мазут пачкает нитку, и дело '
                        '№137 впервые пахнет машинным залом, а не бумагой.'),
            'sound': 'sfx_book',
            'hint': 'шестая страница дела',
        })
        made.append('пришить рукавицу')

    for o in opts:
        if o['label'].startswith('Пришить '):
            effs = o['effects']
            if not any(e.get('type') == 'change_variable' and e.get('var') == 'case_filed'
                       for e in effs):
                at = find(effs, 'type', 'set_flag') + 1
                effs.insert(at, {'type': 'change_variable', 'var': 'case_filed', 'delta': 1})

    sew = opts[find(opts, 'label', 'Сшить дело')]
    if not any(c.get('var') == 'case_filed' for c in sew.get('conditions', [])):
        sew['conditions'] = [
            {'type': 'flag_not_set', 'flag': 'case_full'},
            {'type': 'variable_compare', 'var': 'case_filed', 'operator': '>=', 'value': 3},
        ]
        made.append('счётчик подшитых листов')
    save('entities/item_case.json', case)

    # 4. флаг в реестре (валидатор требует, чтобы флаг был объявлен)
    camp = load('campaign.json')
    if find(camp['flags'], 'id', 'case_filed_glove') is None:
        camp['flags'].append({
            'id': 'case_filed_glove',
            'label': 'В дело подшита рукавица',
            'description': ('Рукавица с привода седьмой помпы пришита к делу №137: '
                            'караульное клеймо, размер не мастерский.'),
        })
        camp['flags'].sort(key=lambda f: f['id'])
        save('campaign.json', camp)
        made.append('флаг case_filed_glove')

    # 5. запись в журнале дела
    q = load('quests/quest_pump.json')
    ent = q.setdefault('journal_entries', {})
    ent.setdefault('j_glove',
                   'К делу пришита рукавица с привода: караульное клеймо седьмого яруса, '
                   'чужая заплата, размер не мастерский. Кто-то снимал муфту в перчатках — '
                   'и не унёс их с собой.')
    save('quests/quest_pump.json', q)

    print('РУКАВИЦА 20')
    print('  нового:', '; '.join(made) if made else 'ничего, уже было')
    print('  подшитых листов считает переменная case_filed (порог «сшить дело» — 3)')


if __name__ == '__main__':
    main()
