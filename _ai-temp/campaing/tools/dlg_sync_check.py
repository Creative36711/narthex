#!/usr/bin/env python3
"""Сверка .ink и .dlg.json: реплики (текст+voice) и варианты игрока, которые есть только с одной стороны."""
import json, glob, re, sys
def ink_lines(p):
    L, C = set(), set()
    for raw in open(p, encoding='utf-8'):
        s = raw.strip()
        if not s or s.startswith(('EXTERNAL', 'VAR', '===', '= ', '~', '->', '//', '-', '{', '}')): continue
        if s.startswith(('*', '+')):
            m = re.search(r'\[([^\]]*)\]', s)
            if m: C.add(m.group(1).strip())
            continue
        text = s.split('#')[0].strip()
        v = re.search(r'#\s*voice:\s*(\S+)', s)
        if text: L.add((text, v.group(1) if v else None))
    return L, C
def dlg_lines(p):
    L, C = set(), set()
    def walk(o):
        if isinstance(o, dict):
            if o.get('kind') == 'line' and 'line' in o:
                L.add((o['line'].get('text', '').strip(), o['line'].get('voice')))
            if 'text' in o and 'sections' in o: C.add(o['text'].strip())
            for v in o.values(): walk(v)
        elif isinstance(o, list):
            for v in o: walk(v)
    walk(json.load(open(p, encoding='utf-8')))
    return L, C
bad = 0
for d in sorted(glob.glob('dialogues/*.dlg.json')):
    i = d.replace('.dlg.json', '.ink')
    il, ic = ink_lines(i); dl, dc = dlg_lines(d)
    for x in sorted(il - dl, key=str): print(f'{i}: ТОЛЬКО В INK  {x}'); bad += 1
    for x in sorted(dl - il, key=str): print(f'{d}: ТОЛЬКО В DLG  {x}'); bad += 1
    for x in sorted(ic - dc): print(f'{i}: выбор только в ink: {x}'); bad += 1
    for x in sorted(dc - ic): print(f'{d}: выбор только в dlg: {x}'); bad += 1
print('расхождений:', bad); sys.exit(1 if bad else 0)
