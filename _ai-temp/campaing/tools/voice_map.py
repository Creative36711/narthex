#!/usr/bin/env python3
"""Точная карта voice-файл -> текст реплики (из .ink). Печатает TSV: file<TAB>speaker_file<TAB>text.
Использует точное совпадение пути (без подстрочных коллизий narr_X / X)."""
import re, glob, sys, os
VOICE = re.compile(r'#\s*voice:\s*(\S+)')
out = {}
for ink in sorted(glob.glob('dialogues/*.ink')):
    for ln, line in enumerate(open(ink, encoding='utf-8'), 1):
        m = VOICE.search(line)
        if not m: continue
        path = m.group(1)
        text = line.split('#')[0].strip()
        text = re.sub(r'^[\*\+\-\s]*(\{[^}]*\})?\s*(\[[^\]]*\])?\s*', '', text) if text.startswith(('*','+')) else text
        out.setdefault(os.path.basename(path), []).append((ink, ln, text))
if __name__ == '__main__':
    names = sys.argv[1:] or sorted(out)
    for n in names:
        n = n if n.endswith('.mp3') else n + '.mp3'
        for ink, ln, t in out.get(n, [('-', 0, '<НЕТ ССЫЛКИ>')]):
            print(f'{n}\t{ink}:{ln}\t{t}')
