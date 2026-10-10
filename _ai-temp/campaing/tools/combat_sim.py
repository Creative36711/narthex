#!/usr/bin/env python3
"""Монте-Карло симулятор боёв кампании (приближение BRP-движка Chronicle).

Модель:
  HP = ceil((CON+SIZ)/2); бонус урона по STR+SIZ (BRP): <=12 -1d6, <=16 -1d4,
  <=24 0, <=32 +1d4, <=40 +1d6.
  Атака: d100 <= навык (крит <= навык/20 — макс. урон, impale ×2 кубика оружия).
  Защита: первая успешная атака за раунд по цели — бросок dodge (успех гасит удар,
  если атака не крит). Броня вычитается из урона.
  ИИ: готовая способность применяется вместо атаки с шансом 50%.
  Мораль: при HP <= below_hp_pct% в начале хода — шанс flee_chance сбежать.
Запуск: python3 tools/combat_sim.py [N]
"""
import json, math, random, sys, glob, re, os
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
J = lambda p: json.load(open(os.path.join(ROOT, p), encoding='utf-8'))
CAMP = J('campaign.json')
ABIL = {a['id']: a for a in CAMP.get('abilities', [])}
ITEMS = {os.path.basename(f)[:-5]: J(os.path.relpath(f, ROOT)) for f in glob.glob(os.path.join(ROOT, 'entities/item_*.json'))}

def roll(expr):
    expr = expr.replace(' ', '')
    tot = 0
    for sign, term in re.findall(r'([+-]?)([^+-]+)', expr):
        s = -1 if sign == '-' else 1
        if 'd' in term:
            n, f = term.split('d'); n = int(n or 1); f = int(f)
            tot += s * sum(random.randint(1, f) for _ in range(n))
        else:
            tot += s * int(term)
    return tot

def maxroll(expr):
    return sum((-1 if s == '-' else 1) * (int(t.split('d')[0] or 1) * int(t.split('d')[1]) if 'd' in t else int(t))
               for s, t in re.findall(r'([+-]?)([^+-]+)', expr.replace(' ', '')))

def db(st):
    v = st.get('STR', 10) + st.get('SIZ', 10)
    return '-1d6' if v <= 12 else '-1d4' if v <= 16 else '' if v <= 24 else '+1d4' if v <= 32 else '+1d6'

class F:
    def __init__(self, eid, side, overrides=None):
        d = J(f'entities/{eid}.json'); self.id = eid; self.side = side
        st = {k: 10 for k in ('STR', 'CON', 'SIZ', 'DEX')}; st.update(d.get('stats', {}))
        self.hp = self.max = math.ceil((st['CON'] + st['SIZ']) / 2)
        self.dex = st['DEX']; self.sk = d.get('skills', {})
        eq = d.get('equipment', {}) or {}
        self.armor = d.get('armor', 0)
        if eq.get('armor') in ITEMS: self.armor += ITEMS[eq['armor']].get('armor_data', {}).get('points', 0)
        w = None
        if eq.get('weapon') in ITEMS: w = ITEMS[eq['weapon']].get('weapon_data')
        w = w or d.get('natural_weapon') or {'skill': 'brawl', 'damage': '1d3', 'damage_bonus': True}
        self.w = w; self.db = db(st) if w.get('damage_bonus') else ''
        self.abil = [ABIL[a] for a in d.get('abilities', []) if a in ABIL]; self.cd = {}
        self.morale = d.get('morale'); self.fled = False; self.dodged = False
        for k, v in (overrides or {}).items(): setattr(self, k, v)
    alive = property(lambda s: s.hp > 0 and not s.fled)

def attack(a, t, dmg_expr, skill, impale=False, armor=True):
    s = a.sk.get(skill, 25)
    r = random.randint(1, 100)
    if r > s: return 0
    crit = r <= max(1, s // 20)
    if not crit and not t.dodged:
        t.dodged = True
        if random.randint(1, 100) <= t.sk.get('dodge', 20): return 0
    dmg = maxroll(dmg_expr) if crit else roll(dmg_expr)
    if crit and impale: dmg += roll(dmg_expr)
    if armor: dmg -= t.armor
    return max(0, dmg)

def turn(a, foes):
    tg = [f for f in foes if f.alive]
    if not tg: return
    t = min(tg, key=lambda f: f.hp)
    if a.morale and a.hp <= a.max * a.morale['below_hp_pct'] / 100 and random.randint(1, 100) <= a.morale['flee_chance']:
        a.fled = True; return
    ready = [x for x in a.abil if a.cd.get(x['id'], 0) <= 0]
    if ready and random.random() < 0.5:
        ab = random.choice(ready); a.cd[ab['id']] = ab.get('cooldown_rounds', 0) + 1
        if ab['kind'] == 'damage':
            if 'skill' in ab: d = attack(a, t, ab['damage'], ab['skill'])
            else: d = max(0, roll(ab['damage']) - t.armor)
            t.hp -= d
        elif ab['kind'] == 'status':
            t.status = getattr(t, 'status', 0) + 1  # статус: учитываем как -10 к атаке на 2 раунда
            t.debuff = 2
        return
    pen = 10 if getattr(a, 'debuff', 0) > 0 else 0
    a.sk = dict(a.sk); sk = a.w['skill']; base = a.sk.get(sk, 25); a.sk[sk] = base - pen
    expr = a.w['damage'] + a.db
    t.hp -= attack(a, t, expr, sk, impale='impale' in a.w.get('traits', []))
    a.sk[sk] = base

def fight(allies, enemies, rounds=40):
    fs = allies + enemies
    for r in range(rounds):
        for f in fs:
            f.dodged = False
            for k in list(f.cd): f.cd[k] -= 1
            if getattr(f, 'debuff', 0) > 0: f.debuff -= 1
        for f in sorted(fs, key=lambda f: -f.dex - random.random()):
            if not f.alive: continue
            turn(f, enemies if f.side == 0 else allies)
        if not any(e.alive for e in enemies): return True, r + 1
        if not allies[0].alive: return False, r + 1
    return False, rounds

SCEN = [
    ('Гнилец ×1 (засада лагеря / таблицы)', [('npc_rotling', 1)], False),
    ('Гнилец ×2 (таблицы enc_*)',           [('npc_rotling', 2)], False),
    ('Пёс ×1 (галерея)',                    [('npc_ashhound', 1)], False),
    ('Пёс ×2 (enc_deep)',                   [('npc_ashhound', 2)], False),
    ('Громила ×1 (патруль шлюза)',          [('npc_thug', 1)], False),
    ('Громила ×2 (патруль помпы)',          [('npc_thug', 2)], False),
    ('Смотритель (штольня)',                [('npc_watchman', 1)], False),
    ('Стекольщик ×1 (enc_deep, драка)',     [('npc_glazier', 1)], False),
    ('Келл один (финал с делом / повтор)',  [('npc_kell', 1)], False),
    ('Келл + громила (финал)',              [('npc_kell', 1), ('npc_thug', 1)], False),
    ('Келл + громила (финал, с Ирой)',      [('npc_kell', 1), ('npc_thug', 1)], True),
]

def run(N=4000, hero_over=None, label=''):
    print(f'\n== {label or "текущие значения"} (N={N})')
    print(f'{"бой":40} {"победа":>7} {"раунды":>7} {"HP ост.":>8}')
    for name, en, ira in SCEN:
        w = 0; rr = 0; hpl = 0
        for _ in range(N):
            hero = F('player_hero', 0, hero_over)
            allies = [hero] + ([F('npc_ira', 0)] if ira else [])
            enemies = [F(e, 1) for e, c in en for _ in range(c)]
            ok, r = fight(allies, enemies); rr += r
            if ok: w += 1; hpl += hero.hp
        print(f'{name:40} {w / N:7.0%} {rr / N:7.1f} {hpl / max(w, 1):8.1f}')

if __name__ == '__main__':
    N = int(sys.argv[1]) if len(sys.argv) > 1 else 4000
    h = F('player_hero', 0)
    print(f'Герой: HP {h.max}, броня {h.armor}, оружие {h.w.get("label")} {h.w["damage"]}{h.db} ({h.w["skill"]} {h.sk.get(h.w["skill"])})')
    for e in ['npc_rotling', 'npc_ashhound', 'npc_thug', 'npc_watchman', 'npc_kell']:
        f = F(e, 1); print(f'  {e:14} HP {f.max:2} броня {f.armor} {f.w["damage"]}{f.db} ({f.w["skill"]} {f.sk.get(f.w["skill"])}) dodge {f.sk.get("dodge", 20)}')
    run(N)
