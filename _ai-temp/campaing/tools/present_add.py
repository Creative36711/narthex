#!/usr/bin/env python3
"""Предъявление улик (present_item, движок обновлён 06.10).

Добавляет в три диалога вариант «протянуть вещь»: движок открывает сумку
прямо в разговоре, и НПС реагирует на ту улику, которую игрок выбрал.

Заодно закрывает дыру сюжета: записку Реша (item_note) можно было найти в
нише, но она ни на что не влияла — ни один диалог и ни одно правило её не
читали. Теперь её принимает Каст.

Форматы pravятся сразу в двух файлах: dialogues/*.ink (исполняет движок) и
dialogues/*.dlg.json (читает конструктор).
"""
import json
import io
import os

os.chdir(os.path.dirname(os.path.abspath(__file__)) + '/..')

BRANCHES = [
    {
        'who': 'kast',
        'item': 'item_note',
        'choice': 'Протянуть Каст записку мастера.',
        'ok_node': 'Записка',
        'fail_node': 'Отказ',
        'before_choice': 'Где мастер Реш?',
        'rule': 'rule_kast_note',
        'flag': 'kast_note',
        'flag_label': 'Записка показана Каст',
        'flag_desc': ('Записку мастера показали Каст. Она признала: наряд на ночь тринадцатого '
                      'выписан в её отделе, подпись её, почерк — не её. Читается правилом rule_kast_note.'),
        'ink_ok': [
            'Каст читает, не беря бумагу в руки: только глазами по строчке, туда и обратно. # action',
            '«Муфту срезали изнутри». Мастер сорок лет молчал не потому, что боялся. Он ждал, кто первый скажет это вслух. # emotion: calm',
            'Наряд на ночь тринадцатого выписан в моём отделе. Подпись моя. Почерк — не мой. # emotion: calm # voice: assets/voice/kast_4.mp3',
            '~ set_flag("kast_note")',
            '~ change_disposition("npc_kast", -12)',
            '~ fire_rule("rule_kast_note")',
        ],
        'ink_fail': [
            'Она даже не смотрит на протянутое. # action',
            'Убери. Дело сто тридцать семь не про это, а время у тебя не резиновое. # emotion: calm',
        ],
        'emotion_ok': 'calm',
        'emotion_fail': 'calm',
    },
    {
        'who': 'kell',
        'item': 'item_guard_token',
        'choice': 'Положить перед Келлом жетон стража.',
        'ok_node': 'Жетон',
        'fail_node': 'Отказ',
        'before_choice': 'Пропусти меня к помпе.',
        'rule': 'rule_kell_token',
        'flag': 'kell_token',
        'flag_label': 'Жетон показан Келлу',
        'flag_desc': ('Жетон стража Ярова показан Келлу: он три дня носил его в кармане и не '
                      'решился отдать сестре. Читается правилом rule_kell_token.'),
        'ink_ok': [
            'Келл смотрит на медь так, будто она горячая, и не берёт. # action',
            'Яров. Я три дня носил его жетон в кармане и так и не зашёл к сестре. # emotion: thoughtful # voice: assets/voice/kell_5.mp3',
            'Отдай ей сам. И скажи: Келл стоял у затвора и не открыл. Это правда, и она хуже любой лжи, которую ты мог бы придумать. # emotion: thoughtful',
            '~ set_flag("kell_token")',
            '~ change_disposition("npc_kell", 10)',
            '~ fire_rule("rule_kell_token")',
        ],
        'ink_fail': [
            'Келл косит на протянутое, но руки с рукояти не убирает. # action',
            'Мне это зачем? Я за чужие вещи не отвечаю. За свои — тоже. # emotion: calm',
        ],
        'emotion_ok': 'thoughtful',
        'emotion_fail': 'calm',
    },
    {
        'who': 'zhuk',
        'item': 'item_ledger',
        'choice': 'Дать Жуку полистать гроссбух.',
        'ok_node': 'Расход',
        'fail_node': 'Отказ',
        'before_choice': 'Где мастер?',
        'rule': 'rule_zhuk_ledger',
        'flag': 'zhuk_ledger',
        'flag_label': 'Жук прочёл гроссбух',
        'flag_desc': ('Жук прочёл гроссбух и нашёл расхождение: мазут списан на семь смен по '
                      'двенадцать человек, а ночь тринадцатого в расходе есть, людей в ней нет. '
                      'Читается правилом rule_zhuk_ledger.'),
        'ink_ok': [
            'Жук листает, водя пальцем по столбцам, и считает тихо, одними губами. # action',
            'Мазут списан на семь смен по двенадцать человек. А тринадцатая ночь в расходе есть, людей в ней нет. # emotion: thoughtful # voice: assets/voice/zhuk_4.mp3',
            'Кто-то платил, чтобы седьмой ярус в ту ночь стоял пустым. Платил не Келл: у Келла таких денег нет, у него только руки. # emotion: thoughtful',
            '~ set_flag("zhuk_ledger")',
            '~ change_disposition("npc_zhuk", 8)',
            '~ fire_rule("rule_zhuk_ledger")',
        ],
        'ink_fail': [
            'Жук вертит вещь в пальцах и возвращает. # action',
            'За это Векс и лома не даст. Приходи с бумагой, а лучше — с гроссбухом. # emotion: calm',
        ],
        'emotion_ok': 'thoughtful',
        'emotion_fail': 'calm',
    },
]

RULES = {
    'rule_kast_note': {
        'label': 'Записка показана Каст',
        'chapter': 'ch_price',
        'effects': [
            {'type': 'grant_xp', 'points': 10},
            {'type': 'journal_update', 'quest': 'quest_duty', 'text_key': 'j_forged'},
            {'type': 'change_disposition', 'target': 'faction_nadzor', 'delta': -5},
        ],
    },
    'rule_kell_token': {
        'label': 'Жетон показан Келлу',
        'chapter': 'ch_signs',
        'effects': [
            {'type': 'grant_xp', 'points': 10},
            {'type': 'journal_update', 'quest': 'quest_missing', 'text_key': 'j_token'},
        ],
    },
    'rule_zhuk_ledger': {
        'label': 'Жук прочёл гроссбух',
        'chapter': 'ch_price',
        'effects': [
            {'type': 'grant_xp', 'points': 10},
            {'type': 'journal_update', 'quest': 'quest_ledger', 'text_key': 'j_read'},
        ],
    },
}

JOURNAL = {
    'quest_duty': ('j_forged', 'Наряд на ночь тринадцатого выписан в отделе Каст. Подпись её, '
                               'почерк — не её: приказ готовили не в её кабинете, а под её подпись.'),
    'quest_missing': ('j_token', 'Келл Ястреб три дня носил жетон Ярова в кармане и не зашёл к '
                                 'сестре. Он стоял у затвора и не открыл.'),
    'quest_ledger': ('j_read', 'Жук прочёл расход: мазут списан на семь смен по двенадцать человек, '
                               'а ночь тринадцатого в расходе есть — людей в ней нет. За пустой ярус кто-то платил.'),
}


def split_line(raw):
    """«текст # emotion: calm # voice: x.mp3» -> (текст, emotion, voice, действие?)"""
    text, emotion, voice, action = raw, None, None, False
    if '# action' in text:
        action = True
        text = text.replace('# action', '')
    if '# voice:' in text:
        voice = text.split('# voice:')[1].strip()
        text = text.split('# voice:')[0]
    if '# emotion:' in text:
        emotion = text.split('# emotion:')[1].strip()
        text = text.split('# emotion:')[0]
    return text.strip(), emotion, voice, action


def main():
    # ---------- ink ----------
    for b in BRANCHES:
        p = 'dialogues/%s.ink' % b['who']
        s = open(p, encoding='utf-8').read()
        if b['ok_node'] in s:
            print('  %s: ветка уже есть' % p)
            continue
        if 'EXTERNAL present_item' not in s:
            lines = s.split('\n')
            ext = [i for i, l in enumerate(lines) if l.startswith('EXTERNAL ')]
            lines.insert(ext[-1] + 1, 'EXTERNAL present_item(a0, a1, a2)')
            s = '\n'.join(lines)
        # вариант ответа — перед указанным существующим
        anchor = '[%s]' % b['before_choice']
        i = s.index(anchor)
        i = s.rindex('\n', 0, i) + 1  # начало строки, чтобы захватить «* » или «+ »
        choice = ('+ [%s]\n    ~ present_item("%s", "%s", "%s")\n    -> Начало_hub\n'
                  % (b['choice'], b['ok_node'], b['fail_node'], b['item']))
        s = s[:i] + choice + s[i:]
        # новые узлы — в конец файла
        tail = '\n=== %s ===\n' % b['ok_node']
        for raw in b['ink_ok']:
            tail += raw + '\n'
        tail += '-> Начало_hub\n'
        tail += '\n=== %s ===\n' % b['fail_node']
        for raw in b['ink_fail']:
            tail += raw + '\n'
        tail += '-> Начало_hub\n'
        s = s.rstrip('\n') + '\n' + tail
        open(p, 'w', encoding='utf-8').write(s)
        print('  %s: ветка «%s» добавлена' % (p, b['choice']))

    # ---------- dlg.json ----------
    for b in BRANCHES:
        p = 'dialogues/%s.dlg.json' % b['who']
        d = json.load(open(p, encoding='utf-8'))
        node = [n for n in d['nodes'] if n['id'] == 'Начало'][0]
        if any(b['ok_node'] in json.dumps(c, ensure_ascii=False) for c in node['choices']):
            print('  %s: ветка уже есть' % p)
            continue
        choice = {
            'text': b['choice'],
            'sections': [{'steps': [{'kind': 'effect', 'effect': {
                'type': 'present_item',
                'required': b['item'],
                'ok_goto': b['ok_node'],
                'fail_goto': b['fail_node'],
            }}]}],
            'goto': 'stay',
        }
        idx = next((i for i, c in enumerate(node['choices'])
                    if b['before_choice'] in c['text']), len(node['choices']))
        node['choices'].insert(idx, choice)

        def make_node(name, raws, emotion):
            steps = []
            for raw in raws:
                if raw.startswith('~ '):
                    body = raw[2:]
                    fn = body.split('(')[0]
                    args = body.split('(', 1)[1].rstrip(')').split(', ')
                    args = [a.strip('"') for a in args]
                    if fn == 'set_flag':
                        steps.append({'kind': 'effect', 'effect': {'type': 'set_flag', 'flag': args[0]}})
                    elif fn == 'fire_rule':
                        steps.append({'kind': 'effect', 'effect': {'type': 'fire_rule', 'rule': args[0]}})
                    elif fn == 'change_disposition':
                        steps.append({'kind': 'effect', 'effect': {
                            'type': 'change_disposition', 'target': args[0], 'delta': int(args[1])}})
                else:
                    text, emo, voice, action = split_line(raw)
                    line = {'text': text}
                    if emo:
                        line['emotion'] = emo
                    if voice:
                        line['voice'] = voice
                    if action:
                        line['action'] = True
                    steps.append({'kind': 'line', 'line': line})
            return {'id': name, 'speaker': b['who'], 'sections': [{'steps': steps}]}

        d['nodes'].append(make_node(b['ok_node'], b['ink_ok'], b['emotion_ok']))
        d['nodes'].append(make_node(b['fail_node'], b['ink_fail'], b['emotion_fail']))
        json.dump(d, open(p, 'w', encoding='utf-8'), ensure_ascii=False, indent=1)
        print('  %s: узлы «%s» и «%s» добавлены' % (p, b['ok_node'], b['fail_node']))

    # ---------- правила ----------
    for rid, spec in RULES.items():
        p = 'rules/%s.json' % rid
        if os.path.exists(p):
            print('  %s: уже есть' % rid)
            continue
        rule = {'id': rid, 'label': spec['label'], 'once': True, 'manual': False,
                'conditions': [], 'effects': spec['effects'], 'chapter': spec['chapter']}
        json.dump(rule, open(p, 'w', encoding='utf-8'), ensure_ascii=False, indent=1)
        print('  %s создано' % p)
    m = json.load(open('manifest.json', encoding='utf-8'))
    for rid in RULES:
        if rid + '.json' not in m['rules']:
            m['rules'].append(rid + '.json')
    json.dump(m, open('manifest.json', 'w', encoding='utf-8'), ensure_ascii=False, indent=1)

    # ---------- журналы ----------
    for qid, (key, text) in JOURNAL.items():
        p = 'quests/%s.json' % qid
        q = json.load(open(p, encoding='utf-8'))
        if key not in q['journal_entries']:
            q['journal_entries'][key] = text
            json.dump(q, open(p, 'w', encoding='utf-8'), ensure_ascii=False, indent=1)
            print('  %s: запись журнала %s' % (qid, key))

    # ---------- флаги ----------
    c = json.load(open('campaign.json', encoding='utf-8'))
    for b in BRANCHES:
        if not any(f['id'] == b['flag'] for f in c['flags']):
            c['flags'].append({'id': b['flag'], 'label': b['flag_label'], 'description': b['flag_desc']})
            print('  флаг %s зарегистрирован' % b['flag'])
    json.dump(c, open('campaign.json', 'w', encoding='utf-8'), ensure_ascii=False, indent=1)
    print('готово')


if __name__ == '__main__':
    main()
