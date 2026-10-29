"""Общие функции для скриптовых правок кампании (ink + dlg.json синхронно, флаги, JSON).
Использование:  exec(open('tools/edit_helpers.py').read())   # из корня репозитория
"""
import json, re


def L(p):
    return json.load(open(p, encoding='utf-8'))


def S(p, d):
    open(p, 'w', encoding='utf-8').write(json.dumps(d, ensure_ascii=False, indent=2) + '\n')


def ink_insert_before(f, anchor, block, after_hub=True):
    """Вставить блок перед первой строкой-якорем (по умолчанию — внутри узла Начало_hub)."""
    t = open(f, encoding='utf-8').read()
    start = t.find('=== Начало_hub ===') if after_hub else 0
    i = t.find(anchor, start)
    assert i >= 0, (f, anchor)
    open(f, 'w', encoding='utf-8').write(t[:i] + block + t[i:])


def ink_replace(f, a, b):
    t = open(f, encoding='utf-8').read()
    assert a in t, (f, a)
    open(f, 'w', encoding='utf-8').write(t.replace(a, b, 1))


def ensure_ext(f, decls):
    """decls: [(имя, 'EXTERNAL имя(a0)')] — добавить недостающие объявления EXTERNAL в начало ink."""
    t = open(f, encoding='utf-8').read()
    for name, decl in decls:
        if not re.search(r'^EXTERNAL ' + name + r'\(', t, re.M):
            t = decl + '\n' + t
    open(f, 'w', encoding='utf-8').write(t)


def node(d, nid):
    return next(n for n in d['nodes'] if n['id'] == nid)


def dlg_insert(f, nid, before_text, choice):
    """Вставить вариант в узел nid (обычно 'Начало') перед вариантом с текстом before_text."""
    d = L(f)
    n = node(d, nid)
    idx = next(i for i, c in enumerate(n['choices']) if c['text'] == before_text)
    n['choices'].insert(idx, choice)
    S(f, d)


def line(text, voice, **k):
    return {"kind": "line", "line": dict(text=text, voice=voice, **k)}


def eff(**k):
    return {"kind": "effect", "effect": k}


def F(flag, neg=False):
    return {"type": "flag", "flag": flag, "not": True} if neg else {"type": "flag", "flag": flag}


V = 'assets/voice/'


def add_flags(newf):
    """newf: [(id, label, description)] — дописать в реестр флагов campaign.json (у каждого флага есть description)."""
    d = L('campaign.json')
    fl = d['flags']
    ids = {x['id'] for x in fl}
    for i, l, ds in newf:
        if i not in ids:
            fl.append({"id": i, "label": l, "description": ds})
    S('campaign.json', d)


def manifest_add(section, files):
    m = L('manifest.json')
    for f in files:
        if f not in m[section]:
            m[section].append(f)
    S('manifest.json', m)
