#!/usr/bin/env python3
"""Символьный прогон маршрутов кампании (без движка): проверяет, что каждая концовка достижима.

Маршрут — список шагов (см. tools/routes.py). Симулятор держит флаги, предметы, отряд, переменные,
стадии квестов и время; на каждом шаге проверяет условия опции/рецепта/реплики ink и применяет эффекты,
после каждого шага прогоняет автоправила (trigger always / enter_scene / time_tick) как движок.
Броски навыков по умолчанию успешны и записываются в журнал (их список — «риски маршрута»).
Ink-разговоры исполняются настоящим inkjs (tools/route_ink.cjs) с подстановкой состояния.

Запуск: NODE_PATH=/tmp/inkc/node_modules python3 tools/route_sim.py [имя_маршрута ...]
"""
import json, glob, os, sys, math, subprocess, copy

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
os.chdir(ROOT)
L = lambda p: json.load(open(p, encoding='utf-8'))
C = L('campaign.json')
M = L('manifest.json')
RULES = {}
for r in M['rules']:
    o = L('rules/' + r); RULES[o['id']] = o
ENT = {L(f)['id']: L(f) for f in glob.glob('entities/*.json')}
SCN = {L(f)['id']: L(f) for f in glob.glob('scenes/*.json')}
REC = {L(f)['id']: L(f) for f in glob.glob('recipes/*.json')}
PROF = {p['id']: p for p in C['char_creation']['professions']}
DIFF = {d['id']: d for d in C['difficulties']}
PE = {p['id']: p for p in C.get('price_events', [])}
W = {l['id']: l for r in L('world.json')['regions'] for l in r['locations']}


class RouteError(Exception):
    pass


class Sim:
    def __init__(self, prof, diff, name=''):
        self.name = name
        self.flags, self.items, self.vars, self.party = set(), {}, {}, []
        self.quests, self.statuses, self.known, self.recipes = {}, set(), set(), set()
        self.disp = {k: e.get('base_disposition', 0) or 0 for k, e in ENT.items() if k.startswith('npc_')}
        self.fired, self.dead, self.price_events = set(), set(), set()
        self.tick, self.scene, self.ending = 0, None, None
        self.revealed = {k for k, l in W.items() if not l.get('hidden')}
        self.log, self.risks, self.diff, self.warn = [], [], DIFF[diff], []
        self.outcomes = []  # очередь исходов бросков для текущего шага
        self.combat_result = 'victory'
        for it in PROF[prof]['items']:
            self.add(it['item'], it['quantity'])
        for r in REC.values():
            if r.get('known', True): self.recipes.add(r['id'])

    # ---------- предметы
    def add(self, i, q=1): self.items[i] = self.items.get(i, 0) + q
    def rem(self, i, q=1):
        if self.items.get(i, 0) < q: raise RouteError(f'нет {q}× {i} (есть {self.items.get(i, 0)})')
        self.items[i] -= q
    def has(self, i): return self.items.get(i, 0) > 0

    # ---------- условия
    def cond(self, c, ctx=None):
        if c is None: return True
        if isinstance(c, list): return all(self.cond(x, ctx) for x in c)
        t = c.get('type')
        if t is None and 'flag' in c: return c['flag'] in self.flags
        if t is None and 'not_flag' in c: return c['not_flag'] not in self.flags
        neg = c.get('not') is True
        v = self._cond(t, c, ctx or {})
        return (not v) if neg else v

    def _cond(self, t, c, ctx):
        if t in ('flag_set', 'flag'): return c['flag'] in self.flags
        if t == 'flag_not_set': return c['flag'] not in self.flags
        if t == 'has_item':
            return self.items.get(c['item'], 0) >= c.get('quantity', c.get('qty', 1))
        if t == 'not': return not self.cond(c['condition'], ctx)
        if t == 'or': return any(self.cond(x, ctx) for x in c['conditions'])
        if t == 'and': return all(self.cond(x, ctx) for x in c['conditions'])
        if t == 'in_party': return (c.get('entity') or c.get('npc')) in self.party
        if t == 'variable_compare':
            a, b, op = self.vars.get(c['var'], 0), c['value'], c.get('operator', '==')
            return {'>=': a >= b, '<=': a <= b, '>': a > b, '<': a < b, '==': a == b, '!=': a != b}[op]
        if t == 'player_enters_scene': return ctx.get('entered') == c.get('scene')
        if t == 'player_enters_location':
            return ctx.get('entered') and SCN[ctx['entered']]['location'] == c.get('location')
        if t == 'tick_elapsed': return self.tick >= c.get('min_tick', 0)
        if t == 'quest_at_stage': return self.quests.get(c['quest']) == c['stage']
        if t == 'has_status': return c.get('status') in self.statuses
        if t == 'entity_dead': return c['entity'] in self.dead
        if t == 'entity_alive': return c['entity'] not in self.dead
        if t == 'equipped': return self.has(c.get('item'))
        # потребности, случайность, время суток — маршрут считает их «спокойными»
        if t in ('need_le', 'companion_need_le', 'random_chance', 'time_of_day', 'companion_need_ge'): return False
        raise RouteError(f'неизвестное условие {t}')

    # ---------- эффекты
    def effects(self, effs, where):
        for e in effs or []:
            if self.ending: return
            self.effect(e, where)

    def roll(self, what):
        r = self.outcomes.pop(0) if self.outcomes else True
        self.risks.append(f'{what} → {"успех" if r else "провал"}')
        return r

    def effect(self, e, where):
        t = e.get('type')
        if t == 'set_flag': self.flags.add(e['flag'])
        elif t == 'clear_flag': self.flags.discard(e['flag'])
        elif t == 'add_item': self.add(e['item'], e.get('quantity', e.get('qty', 1)))
        elif t == 'remove_item': self.rem(e['item'], e.get('quantity', e.get('qty', 1)))
        elif t == 'change_variable': self.vars[e['var']] = self.vars.get(e['var'], 0) + e.get('delta', 0)
        elif t == 'set_variable': self.vars[e['var']] = e.get('value', 0)
        elif t == 'advance_time': self.time(e.get('ticks', 1))
        elif t == 'fire_rule':
            r = RULES.get(e['rule'])
            if not r: raise RouteError(f'fire_rule на правило вне manifest: {e["rule"]}')
            if r['id'] in self.fired and r.get('once'): return
            if not self.cond(r.get('conditions')):
                self.log.append(f'  ! fire_rule {r["id"]}: условия правила ложны')
                self.warn.append(f'fire_rule {r["id"]} при ложных условиях ({where})')
                if not os.environ.get('LAX'): return  # строгий режим: движок проверяет условия
            self.run_rule(r, 'fire_rule')
        elif t == 'skill_check_gate':
            ok = self.roll(f'{where}: {e["skill"]} {e["difficulty"]}')
            self.effects(e.get('success_effects') if ok else e.get('fail_effects'), where)
        elif t == 'group_stat_check':
            ok = self.roll(f'{where}: группа {e.get("skill")} {e.get("difficulty")}')
            self.effects(e.get('success_effects') if ok else e.get('fail_effects'), where)
        elif t == 'start_combat':
            en = '+'.join(x['entity'] for x in e.get('enemies', []))
            res = self.combat_result
            self.risks.append(f'{where}: бой [{en}] отряд {["hero"] + self.party} → {res}')
            if res == 'victory':
                for x in e.get('enemies', []): self.dead.add(x['entity'])
                self.effects(e.get('on_victory'), where)
            else:
                self.effects(e.get('on_defeat'), where)
        elif t == 'start_dialogue':
            self.talk(e['entity'], self.pending_dlg.pop(0) if self.pending_dlg else [], knot=e.get('dialogue_knot'))
        elif t in ('advance_quest', 'start_quest'):
            self.quests[e['quest']] = e.get('stage', 'started')
        elif t == 'apply_status': self.statuses.add(e['status'])
        elif t == 'remove_status': self.statuses.discard(e['status'])
        elif t == 'join_party':
            n = e.get('npc') or e.get('entity')
            if n not in self.party: self.party.append(n)
        elif t == 'leave_party':
            n = e.get('npc') or e.get('entity'); self.party = [x for x in self.party if x != n]
        elif t == 'teleport_player': self.scene = e.get('scene', self.scene)
        elif t == 'change_disposition': self.disp[e['target']] = self.disp.get(e['target'], 0) + e['delta']
        elif t == 'learn_name': self.known.add(e.get('npc') or e.get('entity'))
        elif t == 'unlock_recipe': self.recipes.add(e['recipe'])
        elif t == 'reveal_location': self.revealed.add(e.get('location'))
        elif t == 'set_price_event': self.price_events.add(e['id'])
        elif t == 'clear_price_event': self.price_events.discard(e.get('id'))
        elif t in ('game_over_victory', 'game_over_death'):
            kind = 'victory' if t == 'game_over_victory' else 'death'
            for en in C['endings']:
                if en.get('on') == kind and self.cond(en.get('conditions')):
                    self.ending = en['id']; break
            self.log.append(f'  ★ КОНЦОВКА: {self.ending} ({where})')
        # остальное (сообщения, звук, открытки, кодекс, опыт…) на маршрут не влияет

    def time(self, n):
        for _ in range(n):
            self.tick += 1
            for r in RULES.values():
                if r.get('trigger') == 'time_tick': self.try_rule(r, {})

    def run_rule(self, r, why):
        self.fired.add(r['id'])
        self.log.append(f'  ⚙ {r["id"]} ({why})')
        self.effects(r.get('effects'), r['id'])

    def try_rule(self, r, ctx):
        if r.get('manual') or r.get('trigger') == 'manual': return False
        if r.get('once') and r['id'] in self.fired: return False
        if self.cond(r.get('conditions'), ctx):
            self.run_rule(r, r.get('trigger', 'always')); return True
        return False

    def auto(self, entered=None):
        if entered:
            for r in RULES.values():
                if self.ending: return
                if r.get('trigger') == 'enter_scene': self.try_rule(r, {'entered': entered})
        # стартовые и прочие always-правила с условием «вошёл в сцену» видят вход только в этом шаге
        done = set()
        for _ in range(5):  # always-правила до устойчивого состояния
            fired = False
            for r in RULES.values():
                if self.ending: return
                if r.get('trigger', 'always') == 'always' and not r.get('manual'):
                    ctx = {'entered': entered} if entered else {}
                    # «always» без once срабатывают постоянно — берём только once:true, чтобы не зациклиться
                    if r.get('once'):
                        if self.try_rule(r, ctx): fired = True
                    elif r['id'] not in done and self.try_rule(r, ctx):
                        done.add(r['id'])  # повторяемые — не больше раза за шаг
            if not fired: break

    # ---------- шаги
    def scene_entities(self):
        out = set()
        for s in SCN[self.scene].get('slots', []):
            if s.get('default_entity'): out.add(s['default_entity'])
        return out

    def enter(self, scene, cost):
        if cost: self.time(cost)
        self.scene = scene
        self.log.append(f'→ {scene} (тик {self.tick})')
        self.auto(entered=scene)

    def go(self, scene):
        if scene not in SCN: raise RouteError(f'нет сцены {scene}')
        if self.scene is None: return self.enter(scene, 0)
        if self.scene == scene: return
        loc_to = SCN[scene]['location']
        if SCN[self.scene]['location'] != loc_to:
            # по карте: кратчайший путь по travel_connections
            import heapq
            start = SCN[self.scene]['location']; dist = {start: 0}; prev = {}; q = [(0, start)]
            while q:
                d, u = heapq.heappop(q)
                for tc in W[u].get('travel_connections', []):
                    v = tc['to']
                    if v not in self.revealed: continue
                    if d + tc['cost_ticks'] < dist.get(v, 1e9):
                        dist[v] = d + tc['cost_ticks']; prev[v] = (u, tc['cost_ticks']); heapq.heappush(q, (dist[v], v))
            if loc_to not in dist: raise RouteError(f'локация {loc_to} недоступна по карте (скрыта?)')
            path = []; v = loc_to
            while v != start: path.append((v, prev[v][1])); v = prev[v][0]
            for v, cost in reversed(path):
                if self.ending: return
                self.enter(W[v]['arrival_scene'], cost)
        # внутри локации — по навигации сцен
        from collections import deque
        q = deque([(self.scene, [])]); seen = {self.scene}
        while q:
            u, pth = q.popleft()
            if u == scene: break
            for n in SCN[u].get('navigation', []):
                v = n.get('go_to_scene')
                if v and v not in seen and (not n.get('condition') or self.cond(n['condition'])):
                    seen.add(v); q.append((v, pth + [(v, n.get('cost_ticks', 0))]))
        else:
            raise RouteError(f'нет прохода из {self.scene} в {scene}')
        for v, cost in pth:
            if self.ending: return
            self.enter(v, cost)

    def use(self, ent, label):
        e = ENT[ent]
        if self.scene and ent not in self.scene_entities():
            self.log.append(f'  ! {ent} не стоит в слотах сцены {self.scene} (может быть размещён правилом)')
        opts = [o for o in e.get('interact_options', []) if label in o.get('label', '')]
        if not opts: raise RouteError(f'у {ent} нет опции «{label}»')
        ok = [o for o in opts if self.cond(o.get('conditions'))]
        if not ok: raise RouteError(f'опция «{label}» у {ent} недоступна: {json.dumps(opts[0].get("conditions"), ensure_ascii=False)[:300]}')
        o = ok[0]
        self.log.append(f'  ◆ {ent}: «{o["label"]}»')
        self.effects(o.get('effects'), f'{ent}/{o["label"]}')

    def state_js(self):
        return {'flags': sorted(self.flags), 'items': self.items, 'party': self.party, 'disp': self.disp,
                'known': sorted(self.known), 'statuses': sorted(self.statuses)}

    def talk(self, npc, choices, knot=None, present=None):
        f = ENT[npc].get('dialogue')
        if not f or not f.endswith('.ink'): raise RouteError(f'у {npc} нет ink-диалога')
        inp = {'file': f, 'knot': knot, 'state': self.state_js(), 'choices': choices,
               'outcomes': self.outcomes, 'present': present}
        p = subprocess.run(['node', 'tools/route_ink.cjs'], input=json.dumps(inp), capture_output=True, text=True)
        if p.returncode: raise RouteError('route_ink: ' + p.stderr[-500:])
        res = json.loads(p.stdout)
        self.log.append(f'  ✉ {npc}{"/" + knot if knot else ""}: ' + ' | '.join(x for x in res['transcript'] if x.startswith('>')))
        if res['error']: raise RouteError(f'{npc}: {res["error"]}')
        for fx in res['effects']:
            fn, a = fx[0], fx[1:]
            if fn == 'skill_check':
                if self.outcomes: self.outcomes.pop(0)
                self.risks.append(f'{npc}: ink {a[0]} {a[1]} → {"успех" if a[2] else "провал"}'); continue
            if fn == 'present_item': self.log.append(f'    предъявлено {a[0]}: {"верно" if a[1] else "мимо"}'); continue
            m = {'set_flag': lambda: self.flags.add(a[0]), 'clear_flag': lambda: self.flags.discard(a[0]),
                 'add_item': lambda: self.add(a[0], a[1]), 'remove_item': lambda: self.rem(a[0], a[1]),
                 'change_disposition': lambda: self.disp.__setitem__(a[0], self.disp.get(a[0], 0) + a[1]),
                 'join_party': lambda: self.party.append(a[0]) if a[0] not in self.party else None,
                 'leave_party': lambda: self.party.remove(a[0]) if a[0] in self.party else None,
                 'learn_name': lambda: self.known.add(a[0]), 'apply_status': lambda: self.statuses.add(a[0]),
                 'remove_status': lambda: self.statuses.discard(a[0]), 'unlock_recipe': lambda: self.recipes.add(a[0]),
                 'advance_time': lambda: self.time(a[0]),
                 'fire_rule': lambda: self.effect({'type': 'fire_rule', 'rule': a[0]}, npc)}
            if fn in m: m[fn]()

    def price(self, npc, item):
        tr = ENT[npc]['trader']
        s = [x for x in tr['sells'] if x['item'] == item]
        if not s: raise RouteError(f'{npc} не продаёт {item}')
        mult = self.diff['prices']
        for pe in self.price_events: mult *= PE[pe]['multiplier']
        return s[0], math.ceil(s[0]['price'] * mult)

    def buy(self, npc, item, q=1):
        s, p = self.price(npc, item)
        bought = self.__dict__.setdefault('bought', {})
        if 'stock' in s and bought.get((npc, item), 0) + q > s['stock']:
            raise RouteError(f'у {npc} в наличии только {s["stock"]}× {item}')
        self.rem('item_mark', p * q)
        bought[(npc, item)] = bought.get((npc, item), 0) + q
        self.add(item, q)
        self.log.append(f'  $ {npc}: {q}× {item} по {p} (осталось {self.items["item_mark"]})')

    def craft(self, rid):
        r = REC[rid]
        if rid not in self.recipes and not self.cond(r.get('conditions')):
            raise RouteError(f'рецепт {rid} неизвестен')
        if r.get('conditions') and not self.cond(r['conditions']): raise RouteError(f'условия рецепта {rid} ложны')
        if r.get('workbench'):
            here = [x for x in self.scene_entities() if any(ef.get('type') == 'open_craft' for o in ENT[x].get('interact_options', []) for ef in o.get('effects', []))]
            if not here: raise RouteError(f'{rid}: в сцене {self.scene} нет верстака')
        for t in r.get('tools', []):
            if not self.has(t): raise RouteError(f'{rid}: нет инструмента {t}')
        for i in r['inputs']: self.rem(i['item'], i['quantity'])
        sk = r.get('skill')
        if sk:
            while not self.roll(f'крафт {rid}: {sk["id"]} {sk["difficulty"]}'):
                for i in r['inputs']: self.add(i['item'], i['quantity'])  # провал сохраняет материалы (§14б)
                self.time(r.get('time_ticks', 1))
                for i in r['inputs']: self.rem(i['item'], i['quantity'])
        self.time(r.get('time_ticks', 1))
        self.add(r['output']['item'], r['output'].get('quantity', 1))
        self.log.append(f'  ⚒ {rid} → {r["output"]["item"]}')

    def step(self, s):
        kind = s[0]; opt = s[-1] if isinstance(s[-1], dict) else {}
        self.outcomes = list(opt.get('rolls', []))
        self.combat_result = opt.get('combat', 'victory')
        self.pending_dlg = list(opt.get('dlg', []))
        if kind == 'go': self.go(s[1])
        elif kind == 'use': self.use(s[1], s[2])
        elif kind == 'talk': self.talk(s[1], s[2], knot=opt.get('knot'), present=opt.get('present'))
        elif kind == 'buy': self.buy(s[1], s[2], s[3] if len(s) > 3 and isinstance(s[3], int) else 1)
        elif kind == 'craft': self.craft(s[1])
        elif kind == 'wait': self.time(s[1])
        elif kind == 'party':  # набор напарника вне ink (через правило) — только для проверки боёв
            self.party.append(s[1])
        else: raise RouteError(f'неизвестный шаг {kind}')
        if not self.ending: self.auto()


def run(name, route, verbose=False):
    sim = Sim(route['prof'], route['diff'], name)
    try:
        for i, s in enumerate(route['steps']):
            if sim.ending: raise RouteError(f'концовка {sim.ending} наступила раньше шага {i}: {s}')
            sim.step(s)
        err = None
    except RouteError as e:
        err = f'шаг {i}: {s[:3]} — {e}'
    ok = err is None and sim.ending == route['expect']
    if route.get('expect_error'):
        ok = bool(err) and route['expect_error'] in err
    return sim, ok, err


if __name__ == '__main__':
    sys.path.insert(0, os.path.join(ROOT, 'tools'))
    from routes import ROUTES
    args = [a for a in sys.argv[1:] if not a.startswith('--')]
    want = args or list(ROUTES)
    md = '--md' in sys.argv
    rows = []
    verbose = os.environ.get('V')
    bad = 0
    for n in want:
        sim, ok, err = run(n, ROUTES[n])
        print(f'{"✓" if ok else "✗"} {n}: ждали {ROUTES[n]["expect"]}, получили {sim.ending}; тик {sim.tick}, марок {sim.items.get("item_mark", 0)}, '
              f'отряд {sim.party}, бросков {len(sim.risks)}')
        if err: print('   ', err)
        if verbose or not ok:
            print('\n'.join('    ' + x for x in sim.log[-40 if not verbose else 0:]))
        if verbose: print('    риски:\n' + '\n'.join('      ' + x for x in sim.risks))
        bad += not ok
        rows.append((n, ROUTES[n], sim, ok, err))
    if md:
        out = ['| Маршрут | Старт / сложность | Ждали | Итог | Час | Марок | Отряд | Броски |', '|---|---|---|---|---:|---:|---|---|']
        for n, r, sim, ok, err in rows:
            exp = r.get('expect') or ('отказ: ' + r['expect_error'] if r.get('expect_error') else '— (без концовки)')
            res = ('✓ ' if ok else '✗ ') + (sim.ending or ('отказ по деньгам' if err and r.get('expect_error') else ('шаги пройдены' if not err else err)))
            rolls = '; '.join(x.split(': ', 1)[-1] for x in sim.risks)
            out.append(f"| {n} | {r['prof'][5:]} / {r['diff'][5:]} | {exp} | {res} | {sim.tick} | {sim.items.get('item_mark', 0)} | {', '.join(sim.party) or 'соло'} | {rolls} |")
        open('/tmp/routes_table.md', 'w').write('\n'.join(out) + '\n')
    sys.exit(1 if bad else 0)
