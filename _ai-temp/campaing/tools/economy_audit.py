"""Экономика марок: откуда приходят, сколько стоят обязательные вещи на каждой сложности.
Текстовый обход данных (не симулятор маршрута)."""
import json,glob,re,os
ROOT=os.path.dirname(os.path.dirname(os.path.abspath(__file__))); os.chdir(ROOT)
L=lambda p: json.load(open(p))
c=L('campaign.json')
src=[]
def walk(o,path):
    if isinstance(o,dict):
        if o.get('type')=='add_item' and o.get('item')=='item_mark': src.append((path,o.get('qty',o.get('quantity',1))))
        if o.get('type')=='give_reward':
            for it in o.get('items',[]):
                if it.get('item')=='item_mark': src.append((path+' (награда)',it.get('quantity',1)))
        for k,v in o.items(): walk(v,path+'.'+k)
    elif isinstance(o,list):
        for i,v in enumerate(o): walk(v,path)
for f in glob.glob('rules/*.json')+glob.glob('entities/item_*.json')+glob.glob('quests/*.json')+glob.glob('encounters/*.json'):
    walk(L(f),f)
for f in glob.glob('dialogues/*.ink'):
    for m in re.finditer(r'add_item\("item_mark",\s*(\d+)\)',open(f).read()): src.append((f,int(m.group(1))))
for f in glob.glob('entities/npc_*.json'):
    for lt in L(f).get('loot_table',[]) or []:
        if lt.get('item')=='item_mark': src.append((f+' (лут, шанс %s)'%lt.get('chance'),'%s–%s'%(lt.get('min',1),lt.get('max',lt.get('min',1)))))
print('== Источники марок')
for p,q in sorted(src,key=lambda x:x[0]): print(f'  {q:>6}  {p}')
print('\n== Стартовые марки по профессиям')
for p in c['char_creation']['professions']:
    print('  ',p['label'], sum(i['quantity'] for i in p['items'] if i['item']=='item_mark'))
dozh=L('entities/npc_dozh.json')['trader']['sells']; vex=L('entities/npc_vex.json')['trader']['sells']
pr={s['item']:s['price'] for s in dozh}
need={'item_filter':1,'item_water':2,'item_ration':1,'item_coal':4,'item_cloth':1}
ev=max([e['multiplier'] for e in c.get('price_events',[])]+[1])
print('\n== Корзина «спуск на девятый» (дыхатель, 2 воды, паёк, 4 угля, сукно) у Дожа')
for d in c['difficulties']:
    base=sum(pr[i]*n for i,n in need.items())
    print(f"  {d['label']:14} ×{d['prices']}: {base*d['prices']:.0f} марок; в режиме тишины ×{ev}: {base*d['prices']*ev:.0f}")
