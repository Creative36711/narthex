# Аудит достижимости: что определено, но никогда не выдаётся/не вызывается.
import json,glob,re,os
os.chdir(os.path.dirname(os.path.abspath(__file__))+'/..')
def load(p): return json.load(open(p))
ALL=''
for p in glob.glob('**/*.json',recursive=True)+glob.glob('dialogues/*.ink'):
    if p.startswith('__chronicle') or p.startswith('_ai-temp'): continue
    ALL+=open(p,encoding='utf-8').read()+'\n'
m=load('manifest.json'); c=load('campaign.json')
def defs(section,folder):
    out=[]
    for f in m.get(section,[]):
        try: out.append(load(f'{folder}/{f}')['id'])
        except Exception: pass
    return out
items=[i for i in defs('entities','entities') if i.startswith('item_')]
npcs=[i for i in defs('entities','entities') if i.startswith('npc_')]
def refs(pat): return re.findall(pat,ALL)
# items: obtainable?
gain=set(refs(r'"(?:item|output|entity|default_entity)"\s*:\s*"(item_[a-z0-9_]+)"'))|set(refs(r'add_item\("(item_[a-z0-9_]+)"'))
trade=set(refs(r'"(item_[a-z0-9_]+)"'))
print('== предметы без явной выдачи (add_item/слот/рецепт):')
add=set(refs(r'"type"\s*:\s*"add_item"[^}]*?"item"\s*:\s*"(item_[a-z0-9_]+)"'))|set(refs(r'add_item\("(item_[a-z0-9_]+)"'))|set(refs(r'"default_entity"\s*:\s*"(item_[a-z0-9_]+)"'))
add|=set(refs(r'"(?:spoil_into|output|result)"\s*:\s*"(item_[a-z0-9_]+)"'))
for f in glob.glob('entities/npc_*.json')+glob.glob('entities/player_*.json'):
    add|=set(re.findall(r'"(item_[a-z0-9_]+)"',open(f).read()))  # торговля, лут, стартовый набор
add|=set(re.findall(r'"item"\s*:\s*"(item_[a-z0-9_]+)"',json.dumps(c.get('char_creation',{}))))
for f in glob.glob('recipes/*.json'):
    r=load(f); o=r.get('output') or r.get('result') or {}
    if isinstance(o,dict) and o.get('item'): add.add(o['item'])
for it in items:
    if it not in add:
        n=ALL.count('"'+it+'"')
        print('  ',it,'упоминаний:',n)
print('== codex без unlock:')
for f in glob.glob('codex/*.json'):
    i=load(f)['id']
    if not re.search(r'unlock_codex[^\n]{0,40}'+i,ALL) and not re.search(r'"entry"\s*:\s*"'+i+'"',ALL) and not re.search(r'"codex"\s*:\s*"'+i+'"',ALL): print('  ',i)
print('== рецепты без unlock:')
for f in m.get('recipes',[]):
    try: rr=load('recipes/'+f); i=rr['id']
    except Exception: continue
    if rr.get('known',True) is not False: continue  # известен с начала
    if not re.search(r'unlock_recipe[^\n]{0,40}'+i,ALL) and not re.search(r'"recipe"\s*:\s*"'+i+'"',ALL): print('  ',i)
print('== катсцены без запуска:')
for f in m.get('cutscenes',[]):
    try: i=load('cutscenes/'+f)['id']
    except Exception: continue
    if ALL.count('"'+i+'"')+ALL.count('("'+i+'"')<2: print('  ',i)
print('== manual-правила, которые никто не вызывает:')
for f in m['rules']:
    r=load('rules/'+f)
    if r.get('manual'):
        i=r['id']
        if not re.search(r'fire_rule\("'+i+'"\)',ALL) and not re.search(r'"rule"\s*:\s*"'+i+'"',ALL) and not re.search(r'"(on_zero_effect|ambush_rule)"\s*:\s*"'+i+'"',ALL): print('  ',i)
print('== узлы ink, на которые нет перехода (кроме первого):')
for f in glob.glob('dialogues/*.ink'):
    t=open(f).read(); knots=re.findall(r'^=== (\S+) ===',t,re.M)
    for k in knots[1:]:
        pat_ref=r'(?:present_item|set_dialogue_timer)\([^)]*"'+re.escape(k)+'"'
        if not re.search(r'->\s*'+re.escape(k)+r'\b',t) and not re.search(pat_ref,t) and not re.search(r'"(?:dialogue_knot|knot)"\s*:\s*"'+re.escape(k)+'"',ALL):
            print('  ',f[10:],k)
print('== статусы без apply:')
for s in c.get('statuses',[]):
    if ALL.count('"'+s['id']+'"')+ALL.count('("'+s['id']+'"')<2: print('  ',s['id'])
print('== квесты: стадии и advance:')
for f in m.get('quests',[]):
    q=load('quests/'+f); qi=q['id']
    st=[s.get('id') for s in q.get('stages',[])]
    started=bool(re.search(r'start_quest[^\n]{0,40}'+qi,ALL)) or ALL.count('"'+qi+'"')>1
    print('  ',qi,'start:',started,'stages:',st)
    for s in st[1:]:  # первая стадия ставится start_quest
        if s and ALL.count('"'+s+'"')<2 and ALL.count("'"+s+"'")<1: print('     стадия без ссылки:',s)
print('== NPC в сценах/правилах:')
for n in npcs:
    if not re.search(r'"default_entity"\s*:\s*"'+n+'"',ALL) and not re.search(r'"entity"\s*:\s*"'+n+'"[^}]*"count',ALL): print('   нет слота:',n)
