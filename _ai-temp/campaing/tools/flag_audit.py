#!/usr/bin/env python3
"""Аудит флагов и ссылок: флаги читаются, но нигде не ставятся (мёртвые условия) / ставятся, но нигде не читаются;
fire_rule на правила вне manifest; ссылки на несуществующие предметы/сущности."""
import json, glob, re, os
SET, READ = {}, {}
def add(d, k, where): d.setdefault(k, set()).add(where)
def walk(o, where):
    if isinstance(o, dict):
        t = o.get('type')
        if t in ('set_flag', 'clear_flag') and 'flag' in o: add(SET, o['flag'], where)
        elif t in ('flag_set', 'flag_not_set', 'flag') and 'flag' in o: add(READ, o['flag'], where)
        for k in ('flag', 'not_flag'):
            if k in o and t is None and isinstance(o[k], str): add(READ, o[k], where)
        for v in o.values(): walk(v, where)
    elif isinstance(o, list):
        for v in o: walk(v, where)
files = [f for f in glob.glob('**/*.json', recursive=True) if not f.startswith(('__chronicle_ai__', '_ai-temp', 'node_modules')) and not f.endswith('.dlg.json')]
for f in files:
    try: walk(json.load(open(f, encoding='utf-8')), f)
    except Exception: pass
for f in glob.glob('dialogues/*.ink'):
    t = open(f, encoding='utf-8').read()
    for m in re.finditer(r'(set_flag|clear_flag)\("([^"]+)"', t): add(SET, m.group(2), f)
    for m in re.finditer(r'get_flag\("([^"]+)"', t): add(READ, m.group(1), f)
# флаги, которые движок/концовки читают через endings
c = json.load(open('campaign.json'))
for e in c.get('endings', []): walk(e, 'campaign.json:endings')
reg = {x['id'] for x in c.get('flags', [])}
dead = sorted(k for k in READ if k not in SET)
unused = sorted(k for k in SET if k not in READ)
print('== читаются, но нигде не ставятся:'); [print('  ', k, sorted(READ[k])[:3]) for k in dead]
print('== ставятся, но нигде не читаются:'); [print('  ', k, sorted(SET[k])[:2]) for k in unused]
print('== не в реестре flags:', sorted((set(SET) | set(READ)) - reg))
m = json.load(open('manifest.json'))
rules = {json.load(open('rules/' + r))['id'] for r in m['rules']}
for f in files + glob.glob('dialogues/*.ink'):
    t = open(f, encoding='utf-8').read()
    for r in set(re.findall(r'"rule":\s*"([^"]+)"', t) + re.findall(r'fire_rule\("([^"]+)"', t) + re.findall(r'"(?:spoil_rule|ambush_rule|on_zero_effect)":\s*"([^"]+)"', t)):
        if r not in rules: print('fire_rule на неизвестное правило:', r, f)
ents = {os.path.basename(x)[:-5] for x in glob.glob('entities/*.json')}
for f in files + glob.glob('dialogues/*.ink'):
    t = open(f, encoding='utf-8').read()
    for e in set(re.findall(r'"(?:item|entity|npc|spoil_into)":\s*"((?:item|npc|enemy)_[a-z0-9_]+)"', t) + re.findall(r'(?:add_item|remove_item|has_item|item_count)\("([^"]+)"', t)):
        if e not in ents: print('нет сущности:', e, f)
