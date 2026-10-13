"""Список всех реплик рассказчика: файл → текст (ink + JSON катсцен/сцен/правил). Для переозвучки рассказчика."""
import json, glob, re, os
NARR = re.compile(r'(narr_|intro_|final_|prologue_|flood_|rev_)')
out = {}
def walk(o, src):
    if isinstance(o, dict):
        v = o.get('voice')
        if isinstance(v, str) and NARR.search(os.path.basename(v)):
            out.setdefault(os.path.basename(v), (o.get('text', ''), src))
        for x in o.values(): walk(x, src)
    elif isinstance(o, list):
        for x in o: walk(x, src)
for f in glob.glob('**/*.json', recursive=True):
    if f.startswith(('__chronicle', '_ai', 'node_modules')): continue
    try: walk(json.load(open(f)), f)
    except Exception: pass
for f in glob.glob('dialogues/*.ink'):
    for i, l in enumerate(open(f), 1):
        m = re.search(r'#\s*voice:\s*\S*/((?:narr_|intro_|final_|prologue_|flood_|rev_)\S+\.mp3)', l)
        if m:
            t = re.sub(r'\s*#.*$', '', l).strip()
            out.setdefault(m.group(1), (t, f'{f}:{i}'))
if __name__ == '__main__':
    import sys
    for k in sorted(out): print(f'{k}\t{out[k][1]}\t{out[k][0]}')
    print(len(out), 'files', file=sys.stderr)
