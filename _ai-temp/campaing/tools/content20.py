#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""Ход 20: десять новых реплик и две новые ветки.

Что нового в кампании:

- **рукавица с привода** (шестая улика) получила две ветки: Ира узнаёт
  заплату, которую штопают в Сухом ряду, Келл отводит разговор. Обе ветки
 Conditional: видно только тому, кто рукавицу поднял;
- **уголь**: Дож объясняет, почему уголь дороже воды, Векс — что на восьмом
  теперь считают уголь, а не часы;
- **срок**: регистратор произносит главное бюрократическое правило — срок не
  продлевают, его переписывают;
- **жила** добирает три реплики до десяти: про город над ней, про мастера,
  который сидел и слушал, и про то, что вода ждать не умеет;
- **Реш** объясняет, что по срезу муфты видно перчатку.

Правятся оба источника — `.dlg.json` (конструктор) и `.ink` (исполняет
движок). Скрипт перезапускаемый.
"""
import json
import os
import sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))

# (диалог, узел, начало реплики-якоря, [(текст, голос)])
ADD = [
    ('vein', 'Начало', 'Семь помп считали мои годы', [
        ('Ты считаешь, что спасаешь город. Я под ним стою сто тридцать семь лет: '
         'мне виднее, что здесь спасать.', 'assets/voice/vein_8.mp3'),
    ]),
    ('vein', 'Начало', 'Я то, что было здесь до города', [
        ('Мастер не прятался от вас. Он сидел у меня и слушал — чтобы вы не '
         'услышали, как я прошу.', 'assets/voice/vein_9.mp3'),
    ]),
    ('vein', 'Молчание', 'Молчание — тоже ответ', [
        ('Если уйдёшь сейчас, седьмая простоит ещё сутки. Я умею ждать. Вода — нет.',
         'assets/voice/vein_10.mp3'),
    ]),
    ('ayla', 'Начало', 'Если пойдёшь на девятый, возьми мой настой', [
        ('Заплату на рукавице я узнаю: ставила осенью, в рядке. Чья — не помню: '
         'ладони у всех в мазуте, а имён я не спрашиваю. А клеймо караульное, '
         'это точно.', 'assets/voice/ayla_10.mp3'),
    ]),
    ('dozh', 'Начало', 'Дыхатель — это не товар, это время', [
        ('Уголь — три марки штука, и это ещё по-людски. Как вода пришла, уголь у нас '
         'дороже воды стал. Ведром не продаю: ведро самому топить.',
         'assets/voice/dozh_14.mp3'),
    ]),
    ('vex', 'Начало', 'Ты спускался ниже седьмого', [
        ('На восьмом теперь считают не часы, а уголь: сколько унёс, столько и прожил.',
         'assets/voice/vex_12.mp3'),
    ]),
    ('resh', 'Начало', 'Я не прятался. Я ждал', [
        ('Муфту резали ключом на пятьдесят два, в перчатках: на срезе ни одной мозоли. '
         'Сорок лет смотрю, как режут, — по металлу видно, чья рука держала ключ.',
         'assets/voice/resh_14.mp3'),
    ]),
    ('registrar', 'Начало', 'Срок дознания по делу сто тридцать семь', [
        ('Срок дознания не продлевают. Его переписывают — и в новой бумаге он идёт '
         'сначала. Так что спешите с первой, а не со второй.',
         'assets/voice/registrar_9.mp3'),
    ]),
]

# новые условные ветки: показываем то, что нашли
CHOICES = [
    {
        'dlg': 'ira',
        'hub': 'Начало',
        'text': 'Показать рукавицу с привода.',
        'ink_cond': 'has_item("item_glove")',
        'conds': [{'type': 'has_item', 'item': 'item_glove'}],
        'action': 'Она берёт рукавицу за манжет двумя пальцами, как чужую вещь.',
        'sfx': 'snd_cloth',
        'line': ('Реш носил кожаные и жаловался, что они жмут. А заплату ставили в Сухом '
                 'ряду: у Айлы так штопают, когда нечем платить.'),
        'voice': 'assets/voice/ira_16.mp3',
        'emotion': 'thoughtful',
        'ink_effect': 'change_disposition("npc_ira", 4)',
        'effect': {'type': 'change_disposition', 'target': 'npc_ira', 'delta': 4},
    },
    {
        'dlg': 'kell',
        'hub': 'Начало',
        'text': 'Показать рукавицу с привода.',
        'ink_cond': 'has_item("item_glove")',
        'conds': [{'type': 'has_item', 'item': 'item_glove'}],
        'action': 'Он берёт рукавицу за манжет, не разворачивая.',
        'sfx': 'snd_cloth',
        'line': ('Рукавица. В машинном зале их сто пар лежит: смене выдают по две на руки. '
                 'Клади в дело, раз нравится. Мне интереснее, кто её первым снимет.'),
        'voice': 'assets/voice/kell_13.mp3',
        'emotion': 'calm',
        'ink_effect': 'change_disposition("npc_kell", -3)',
        'effect': {'type': 'change_disposition', 'target': 'npc_kell', 'delta': -3},
    },
]


def load(rel):
    with open(os.path.join(ROOT, rel), encoding='utf-8') as f:
        return json.load(f)


def save(rel, data):
    with open(os.path.join(ROOT, rel), 'w', encoding='utf-8') as f:
        json.dump(data, f, ensure_ascii=False, indent=2)
        f.write('\n')


# ── реплики по якорю ─────────────────────────────────────────────────────
def patch_json(name, node_id, anchor, pairs):
    doc = load('dialogues/%s.dlg.json' % name)
    node = next((n for n in doc['nodes'] if n.get('id') == node_id), None)
    if node is None:
        return -1
    # в конструкторе узел-хаб свёрнут в узел «Начало»: реплика может лежать
    # и в секциях самого узла, и в секциях любого выбора
    places = list(node.get('sections') or [])
    for ch in node.get('choices') or []:
        places.extend(ch.get('sections') or [])
    added = 0
    for sec in places:
        steps = sec.get('steps') or []
        for i, st in enumerate(steps):
            ln = st.get('line') or {}
            if (ln.get('text') or '').startswith(anchor):
                for text, voice in pairs:
                    if any((s.get('line') or {}).get('text') == text for s in steps):
                        continue
                    steps.insert(i + 1 + added,
                                 {'kind': 'line', 'line': {'text': text, 'voice': voice}})
                    added += 1
                break
        if added:
            break
    if added:
        save('dialogues/%s.dlg.json' % name, doc)
    return added


def patch_ink(name, anchor, pairs):
    path = os.path.join(ROOT, 'dialogues/%s.ink' % name)
    text = open(path, encoding='utf-8').read()
    if pairs[0][0][:30] in text:
        return 0
    out, added = [], 0
    for line in text.split('\n'):
        out.append(line)
        if line.split(' #')[0].strip().startswith(anchor):
            for t, voice in pairs:
                out.append('%s # voice: %s' % (t, voice))
                added += 1
    if added:
        open(path, 'w', encoding='utf-8').write('\n'.join(out))
    return added


# ── новая ветка ──────────────────────────────────────────────────────────
def add_choice_json(c):
    doc = load('dialogues/%s.dlg.json' % c['dlg'])
    node = next((n for n in doc['nodes'] if n.get('id') == c['hub']), None)
    if node is None:
        return -1
    choices = node.setdefault('choices', [])
    if any(ch.get('text') == c['text'] for ch in choices):
        return 0
    choice = {
        'text': c['text'],
        'conds': c['conds'],
        'sections': [{'steps': [
            {'kind': 'line', 'line': {'text': c['action'], 'action': True}},
            {'kind': 'line', 'line': {'text': c['line'], 'voice': c['voice'],
                                      'emotion': c['emotion'], 'sfx': c['sfx']}},
            {'kind': 'effect', 'effect': c['effect']},
        ]}],
        'goto': 'stay',
    }
    at = next((i for i, ch in enumerate(choices)
               if (ch.get('text') or '').startswith('Мне пора')), len(choices))
    choices.insert(at, choice)
    save('dialogues/%s.dlg.json' % c['dlg'], doc)
    return 1


def add_choice_ink(c):
    path = os.path.join(ROOT, 'dialogues/%s.ink' % c['dlg'])
    lines = open(path, encoding='utf-8').read().split('\n')
    if c['voice'] in '\n'.join(lines):
        return 0
    # границы узла
    start = next((i for i, l in enumerate(lines)
                  if l.startswith('=== %s ===' % c['hub'])), None)
    if start is None:
        return -1
    end = next((i for i in range(start + 1, len(lines))
                if lines[i].startswith('=== ')), len(lines))
    # точка вставки: перед «Мне пора» или перед замыкающей gather-строкой
    at = next((i for i in range(start + 1, end)
               if lines[i].startswith('+ [Мне пора')), None)
    if at is None:
        at = next((i for i in range(end - 1, start, -1)
                   if lines[i].startswith('- -> ')), end)
    block = [
        '+ { %s } [%s]' % (c['ink_cond'], c['text']),
        '    %s # action # sfx: %s' % (c['action'], c['sfx']),
        '    %s # emotion: %s # voice: %s' % (c['line'], c['emotion'], c['voice']),
        '    ~ %s' % c['ink_effect'],
        '    -> %s' % c['hub'],
    ]
    lines[at:at] = block
    open(path, 'w', encoding='utf-8').write('\n'.join(lines))
    return 1


def main():
    bad = 0
    for name, node_id, anchor, pairs in ADD:
        if not os.path.exists(os.path.join(ROOT, pairs[0][1])):
            print('НЕТ ФАЙЛА', pairs[0][1])
            bad += 1
            continue
        a = patch_json(name, node_id, anchor, pairs)
        b = patch_ink(name, anchor, pairs)
        # +0 — уже было (скрипт перезапускаемый), -1 — не найдено, беда
        if a < 0 or b < 0:
            bad += 1
        note = '' if (a >= 0 and b >= 0) else '  ← ПРОВЕРИТЬ!'
        if a == 0 and b == 0:
            note = '  (уже было)'
        print('%-10s %-12s json %+d | ink %+d%s' % (name, node_id, a, b, note))
    for c in CHOICES:
        if not os.path.exists(os.path.join(ROOT, c['voice'])):
            print('НЕТ ФАЙЛА', c['voice'])
            bad += 1
            continue
        a = add_choice_json(c)
        b = add_choice_ink(c)
        if a < 0 or b < 0:
            bad += 1
        note = '  (уже было)' if (a == 0 and b == 0) else ('' if a >= 0 and b >= 0 else '  ← ПРОВЕРИТЬ!')
        print('%-10s %-12s ветка json %+d | ink %+d%s' % (c['dlg'], c['hub'], a, b, note))
    print('проблемных:', bad)
    return 1 if bad else 0


if __name__ == '__main__':
    sys.exit(main())
