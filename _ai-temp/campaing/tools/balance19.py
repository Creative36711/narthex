#!/usr/bin/env python3
"""Ход 19: правка баланса выживания.

Что чиним и зачем:

1. Воздух. Было 2.5/ч — герой без дыхателя тратил на всю вылазку вниз
   (≈19 часов по критическому пути) меньше половины шкалы, и подсистема
   воздуха не значила ничего: маска была украшением. Стало 4.0/ч: без
   маски вылазка съедает ≈76 из 100, герой выходит на поверхность в красной
   зоне, а каждый лишний обыск внизу — уже удушье. С маской (банки на
   два спуска) — по-прежнему безопасно. Так «считают вдохи, а не часы»
   становится правдой.

2. Жажда. need_thirst ссылался на rule_zero_food — то же правило, что и
   у голода, с once:true. Значит: какая потребность обнулилась первой, та
   и забирала единственное правило, а вторая не получала ничего. Появилась
   своя rule_zero_thirst и свои статусы на нуле.

3. Печка и жаровня были бесконечными: час времени — +40 тепла при расходе
   1.2/ч. Теперь печка требует уголь (новая item_coal), а обе грелки
   работают только когда тепло ниже 70 — «догреться впрок» нельзя,
   время всё равно стоит часов из срока.

4. Слой предупреждений: новые статусы Голод/Сухость/Разбитость и правила на
   need_le, чтобы потребности было слышно до нуля, а не только на нуле.

Скрипт идемпотентен: повторный запуск ничего не меняет.
"""
import json
import os
import shutil

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
MISS = []


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


# ── 1. воздух ────────────────────────────────────────────────────────────
camp = load('campaign.json')
air = camp['needs'][find(camp['needs'], 'id', 'need_air')]
was_air = air['decay_per_tick']
air['decay_per_tick'] = 4.0
air['description'] = ('Сколько ещё протянут лёгкие: ниже восьмого яруса воздух '
                      'тяжёлый, его держат фильтры. Без маски на вылазку вниз '
                      'уходит почти вся шкала — считают вдохи, а не часы.')
th = camp['needs'][find(camp['needs'], 'id', 'need_thirst')]
was_thirst = th['on_zero_effect']
th['on_zero_effect'] = 'rule_zero_thirst'

# ── 2. новые статусы нужды ────────────────────────────────────────────────
NEW_STATUSES = [
    {
        'id': 'status_hunger', 'label': 'Голод', 'short_label': 'Голод',
        'description': 'Живот пуст, и мысли начинают ходить кругами вместо того, чтобы идти по следу.',
        'scope': 'world', 'duration': 10,
        'skill_mods': [{'skill': 'investigate', 'delta': -5},
                       {'skill': 'perception', 'delta': -5}],
        'apply_message': 'В животе пусто. Ты ловишь себя на том, что перечитываешь одну строку дважды.',
        'expire_message': 'Поел. Голова снова работает.',
        'apply_sound': 'snd_pot', 'remove_sound': 'snd_cloth',
    },
    {
        'id': 'status_thirst', 'label': 'Сухость', 'short_label': 'Сухость',
        'description': 'Горло дерет так, что говорить хочется короткими фразами. Вода — первая валюта седьмого яруса.',
        'scope': 'world', 'duration': 10,
        'skill_mods': [{'skill': 'perception', 'delta': -10},
                       {'skill': 'persuade', 'delta': -5}],
        'apply_message': 'Во рту сухо, как на чердаке. Без воды долгий разговор не вытянуть.',
        'expire_message': 'Вода. Обычная мутная вода — и сразу легче.',
        'apply_sound': 'sfx_glass', 'remove_sound': 'snd_cloth',
    },
    {
        'id': 'status_weary', 'label': 'Разбитость', 'short_label': 'Разбитость',
        'description': 'Вторые сутки без сна. Глаза видят, но мозг складывает увиденное криво.',
        'scope': 'world', 'duration': 10,
        'skill_mods': [{'skill': 'perception', 'delta': -10},
                       {'skill': 'dodge', 'delta': -10}],
        'apply_message': 'Глаза слипаются. Ты перечитываешь страницу и понимаешь, что не видел ни слова.',
        'expire_message': 'Ты проспался. Пока.',
        'apply_sound': 'snd_cloth', 'remove_sound': 'snd_latch',
    },
]
for st in NEW_STATUSES:
    if find(camp['statuses'], 'id', st['id']) is None:
        camp['statuses'].append(st)
    else:
        camp['statuses'][find(camp['statuses'], 'id', st['id'])] = st

# ── 3. новые правила ──────────────────────────────────────────────────────
NEW_RULES = {
    'rule_zero_thirst': {
        'id': 'rule_zero_thirst', 'label': 'Вода кончилась', 'once': True, 'manual': True,
        'conditions': [],
        'effects': [
            {'type': 'change_hp', 'delta': -4},
            {'type': 'apply_status', 'target': 'player', 'status': 'status_thirst', 'duration': 12},
            {'type': 'show_message',
             'text': 'Язык распух и не помещается во рту. Ты обещаешь себе, что воды больше не будет «потом».'},
            {'type': 'play_sound', 'sound': 'sfx_gasp', 'volume': 0.8},
        ],
    },
    'rule_warn_cold': {
        'id': 'rule_warn_cold', 'label': 'Холод пробрал', 'once': False, 'manual': False,
        'conditions': [
            {'type': 'need_le', 'need': 'need_warmth', 'threshold': 35},
            {'type': 'not', 'condition': {'type': 'has_status', 'status': 'status_cold'}},
        ],
        'effects': [
            {'type': 'apply_status', 'target': 'player', 'status': 'status_cold', 'duration': 6},
        ],
        'chapter': 'ch_water',
    },
    'rule_warn_hunger': {
        'id': 'rule_warn_hunger', 'label': 'Голод даёт о себе знать', 'once': False, 'manual': False,
        'conditions': [
            {'type': 'need_le', 'need': 'need_hunger', 'threshold': 30},
            {'type': 'not', 'condition': {'type': 'has_status', 'status': 'status_hunger'}},
        ],
        'effects': [
            {'type': 'apply_status', 'target': 'player', 'status': 'status_hunger', 'duration': 8},
        ],
        'chapter': 'ch_water',
    },
    'rule_warn_thirst': {
        'id': 'rule_warn_thirst', 'label': 'Пить хочется всерьёз', 'once': False, 'manual': False,
        'conditions': [
            {'type': 'need_le', 'need': 'need_thirst', 'threshold': 30},
            {'type': 'not', 'condition': {'type': 'has_status', 'status': 'status_thirst'}},
        ],
        'effects': [
            {'type': 'apply_status', 'target': 'player', 'status': 'status_thirst', 'duration': 8},
        ],
        'chapter': 'ch_water',
    },
    'rule_warn_rest': {
        'id': 'rule_warn_rest', 'label': 'Сон не берётся ниоткуда', 'once': False, 'manual': False,
        'conditions': [
            {'type': 'need_le', 'need': 'need_rest', 'threshold': 30},
            {'type': 'not', 'condition': {'type': 'has_status', 'status': 'status_weary'}},
        ],
        'effects': [
            {'type': 'apply_status', 'target': 'player', 'status': 'status_weary', 'duration': 8},
        ],
        'chapter': 'ch_water',
    },
}
for rid, rule in NEW_RULES.items():
    p = os.path.join(ROOT, 'rules', rid + '.json')
    if os.path.exists(p):
        old = load('rules/' + rid + '.json')
        old.update(rule)
        save('rules/' + rid + '.json', old)
    else:
        save('rules/' + rid + '.json', rule)

# голод на нуле теперь тоже накладывает статус
rf = load('rules/rule_zero_food.json')
rf['label'] = 'Голод'
rf['effects'] = [
    {'type': 'change_hp', 'delta': -5},
    {'type': 'apply_status', 'target': 'player', 'status': 'status_hunger', 'duration': 12},
    {'type': 'show_message',
     'text': 'Пусто в животе и в голове. Ты грызёшь сухарь, которого нет.'},
]
save('rules/rule_zero_food.json', rf)

save('campaign.json', camp)

# ── 4. уголь ─────────────────────────────────────────────────────────────
COAL = {
    'id': 'item_coal', 'type': 'item', 'category': 'material',
    'label': 'Уголь',
    'description': ('Кусок литого угля в мешковине. На седьмом ярусе уголь считают '
                    'не топливом, а валютой: у кого топится печка, тот ещё жив.'),
    'weight': 1.0, 'stackable': True, 'value': {'mark': 3},
    'interact_hint': 'Топливо для печки',
}
scrap = load('entities/item_scrap.json')
for k, v in scrap.items():
    if k in ('id', 'label', 'description', 'weight', 'stackable', 'value',
             'interact_hint', 'interact_options'):
        continue
    COAL.setdefault(k, v)
cp = os.path.join(ROOT, 'entities/item_coal.json')
if not os.path.exists(cp):
    save('entities/item_coal.json', COAL)

# ── 5. печка: уголь + нельзя греться «впрок» ──────────────────────────────
stove = load('entities/item_stove.json')
warm = stove['interact_options'][0]
boil = stove['interact_options'][1]
if not any(e.get('type') == 'remove_item' for e in warm['effects']):
    warm['effects'].insert(0, {'type': 'remove_item', 'item': 'item_coal', 'quantity': 1})
    warm['conditions'] = [
        {'type': 'need_le', 'need': 'need_warmth', 'threshold': 70},
        {'type': 'has_item', 'item': 'item_coal', 'min_quantity': 1},
    ]
    warm['hint'] = 'час у печи: +40 к теплу, нужен уголь'
if not any(e.get('type') == 'remove_item' for e in boil['effects']):
    boil['effects'].insert(0, {'type': 'remove_item', 'item': 'item_coal', 'quantity': 1})
    boil['conditions'] = [
        {'type': 'need_le', 'need': 'need_thirst', 'threshold': 70},
        {'type': 'has_item', 'item': 'item_coal', 'min_quantity': 1},
    ]
    boil['hint'] = 'час на кипяток: +30 к жажде, нужен уголь'
# варианты-подсказки, когда угля нет: игрок видит, где его взять
if find(stove['interact_options'], 'label', 'Печка холодная') is None:
    stove['interact_options'].append({
        'label': 'Печка холодная',
        'conditions': [{'type': 'not',
                        'condition': {'type': 'has_item', 'item': 'item_coal', 'min_quantity': 1}}],
        'effects': [{'type': 'show_message',
                     'text': ('Угля нет, чугун ледяной. Уголь берут у Дожа в Сухом ряду '
                              'и у Векса на затворе — или находят в ящиках Цеха.')}],
        'hint': 'без угля печка — просто чугун',
        'sound': 'snd_pot',
        'sound_volume': 0.5,
    })
stove['description'] = ('Чугунная печка с выводом в вентиляцию. Топят здесь углём, '
                        'а не надеждой: уголь в ведёрке кончается быстрее, чем кажется.')
save('entities/item_stove.json', stove)

# жаровня: общий огонь Сухого ряда, но греться «впрок» тоже нельзя
braz = load('entities/item_brazier.json')
bw = braz['interact_options'][0]
if not bw.get('conditions'):
    bw['conditions'] = [{'type': 'need_le', 'need': 'need_warmth', 'threshold': 70}]
    bw['hint'] = 'час у жаровни: +35 к теплу, пока ряд подбрасывает уголь'
braz['description'] = ('Чугунная жаровня на трёх ножках. Вокруг неё и держится весь Сухой '
                       'ряд: уголь сюда носят понемногу все, кому надо дожить до утра.')
save('entities/item_brazier.json', braz)

# ── 6. источники угля: старт, ящик, торговцы ─────────────────────────────
hero = load('entities/player_hero.json')
inv = hero.setdefault('inventory', [])
if find(inv, 'item', 'item_coal') is None:
    inv.append({'item': 'item_coal', 'quantity': 3})
save('entities/player_hero.json', hero)

crate = load('entities/item_crate.json')
opt = crate['interact_options'][0]
succ = opt['effects'][0].get('success_effects', [])
if not any(e.get('item') == 'item_coal' for e in succ):
    succ.append({'type': 'add_item', 'item': 'item_coal', 'quantity': 2})
    opt['effects'][0]['success_effects'] = succ
    opt['effects'][0]['fail_effects'].append(
        {'type': 'show_message', 'text': 'В самом низу, под тряпьём, нащупывается уголёк — но ты его не видишь.'})
save('entities/item_crate.json', crate)

for npc, price, stock in (('npc_dozh', 3, 12), ('npc_vex', 4, 8)):
    d = load('entities/%s.json' % npc)
    sells = d['trader']['sells']
    if find(sells, 'item', 'item_coal') is None:
        sells.insert(0, {'item': 'item_coal', 'price': price, 'stock': stock})
        save('entities/%s.json' % npc, d)

# ── 7. манифест: движок читает файлы по списку ───────────────────────────
man = load('manifest.json')
# файлы, уже учтённые в другой категории (encounters.json лежит в rules/,
# но это таблица встреч) — их в список правил не добавляем
for cat in ('entities', 'rules'):
    elsewhere = {os.path.basename(f)
                 for other, files in man.items() if other != cat
                 for f in files}
    present = sorted(f for f in os.listdir(os.path.join(ROOT, cat)) if f.endswith('.json'))
    listed = [f for f in man.get(cat, []) if f in present and f not in elsewhere]
    for f in present:
        if f not in listed and f not in elsewhere:
            listed.append(f)
    man[cat] = listed
save('manifest.json', man)

# ── отчёт ────────────────────────────────────────────────────────────────
print('БАЛАНС 19')
print('  воздух: расход %.1f → %.1f/ч (без маски вылазка ≈19 ч съедает %.0f из 100)'
      % (was_air, 4.0, 19 * 4.0))
print('  жажда на нуле: %s → rule_zero_thirst (было общее с голодом, once:true)' % was_thirst)
print('  статусы нужды: status_hunger, status_thirst, status_weary')
print('  правила: ' + ', '.join(NEW_RULES))
print('  уголь: item_coal (старт 3, ящик +2, Дож 12 шт по 3, Векс 8 шт по 4)')
print('  печка: уголь + нельзя греться выше 70; жаровня общая, порог 70')
print('  проблем: %d' % len(MISS))
