#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""Синхронизация условий выборов: ink → конструктор (`.dlg.json`).

Поддерживает одинаковый текст у двух выборов одного узла (например,
`registrar`: две ветки «Наряд стражи за ночь тринадцатого.» — с пломбой
и без пломбы), сопоставляя их по порядку следования.
"""
import json
import os
import re
import sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
DIR = os.path.join(ROOT, 'dialogues')

CHOICE = re.compile(r'^\s*([*+])\s*(?:\{([^}]*)\}\s*)?\[(.*)\]\s*$')


def parse_ink(text):
    out = {}
    knot = None
    for line in text.split('\n'):
        m = re.match(r'^===\s*([^\s=]+)', line)
        if m:
            knot = m.group(1)
            out.setdefault(knot, [])
            continue
        m = CHOICE.match(line)
        if m and knot is not None:
            out[knot].append((m.group(1), (m.group(2) or '').strip(), m.group(3).strip()))
    return out


def translate(expr):
    conds = []
    if not expr:
        return conds
    for part in re.split(r'\s+and\s+', expr.strip()):
        part = part.strip()
        neg = False
        m = re.match(r'^not\s*\((.*)\)$', part)
        if m:
            neg = True
            part = m.group(1).strip()
        m = re.match(r'^has_item\(\s*"([^"]+)"\s*\)$', part)
        if m:
            c = {'type': 'has_item', 'item': m.group(1)}
        else:
            m = re.match(r'^get_flag\(\s*"([^"]+)"\s*\)$', part)
            if m:
                c = {'type': 'flag', 'flag': m.group(1)}
            else:
                m = re.match(r'^has_status\(\s*"([^"]+)"\s*\)$', part)
                if m:
                    c = {'type': 'has_status', 'status': m.group(1)}
                else:
                    m = re.match(r'^item_count\(\s*"([^"]+)"\s*\)\s*>=\s*(\d+)$', part)
                    if m:
                        c = {'type': 'item_ge', 'item': m.group(1), 'count': int(m.group(2))}
                    else:
                        m = re.match(r'^get_disposition\(\s*"([^"]+)"\s*\)\s*>=\s*(\d+)$', part)
                        if m:
                            c = {'type': 'disp_ge', 'target': m.group(1), 'value': int(m.group(2))}
                        else:
                            print(f'  НЕ ПОНЯЛ условие: {part!r}')
                            continue
        if neg:
            c['not'] = True
        conds.append(c)
    return conds


def main():
    changed = 0
    problems = []
    for name in sorted(f[:-4] for f in os.listdir(DIR) if f.endswith('.ink')):
        ink_path = os.path.join(DIR, name + '.ink')
        dlg_path = os.path.join(DIR, name + '.dlg.json')
        if not os.path.exists(dlg_path):
            continue
        ink = parse_ink(open(ink_path, encoding='utf-8').read())
        dlg = json.load(open(dlg_path, encoding='utf-8'))
        for node in dlg['nodes']:
            knot_choices = (ink.get(node['id'], [])
                            + ink.get(node['id'] + '_hub', []))
            if not knot_choices:
                continue
            by_text = {}
            for m, e, t in knot_choices:
                by_text.setdefault(t, []).append((m, e))
            used = set()
            for ch in node.get('choices', []):
                used.add(ch['text'].strip())
            for t in by_text:
                if t not in used:
                    problems.append(f'{name}/{node["id"]}: выбор ink '
                                    f'«{t[:38]}» не попал в конструктор')
            idx_by_text = {}
            for ch in node.get('choices', []):
                key = ch['text'].strip()
                if key not in by_text:
                    problems.append(f'{name}/{node["id"]}: выбор конструктора '
                                    f'«{key[:38]}» не найден в ink')
                    continue
                lst = by_text[key]
                i = idx_by_text.get(key, 0)
                marker, expr = lst[min(i, len(lst) - 1)]
                idx_by_text[key] = i + 1
                conds = translate(expr)
                before = json.dumps({k: v for k, v in ch.items()
                                     if k in ('conds', 'once')}, sort_keys=True)
                if conds:
                    ch['conds'] = conds
                elif 'conds' in ch:
                    del ch['conds']
                if marker == '*':
                    ch['once'] = True
                elif 'once' in ch:
                    del ch['once']
                after = json.dumps({k: v for k, v in ch.items()
                                    if k in ('conds', 'once')}, sort_keys=True)
                if before != after:
                    changed += 1
        with open(dlg_path, 'w', encoding='utf-8') as fh:
            json.dump(dlg, fh, ensure_ascii=False, indent=1)
    print(f'обновлено выборов: {changed}')
    for p in problems:
        print('ПРОБЛЕМА', p)
    return 1 if problems else 0


if __name__ == '__main__':
    sys.exit(main())
