#!/usr/bin/env python3
"""Смета времени кампании: успевает ли герой закрыть дело за семьдесят два часа.

Срок дела — единственное, что превращает расследование в выбор: если часов
хватает на всё, выборов нет. Скрипт собирает граф сцен (переходы внутри
локации из `navigation`, переходы между локациями из `world.json`) и считает
три сметы:

- критический путь — герой знает, куда идти, и делает только обязательное;
- добросовестный проход — обязательное плюс обыски и одна ночёвка;
- полный — все действия, все улики, три ночёвки.

Цены действий заданы таблицей ACTIONS: берутся из `advance_time` в эффектах
предметов и правил, плюс оценка на разговоры и бой.
"""
import glob
import heapq
import json
import os

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))

# обязательные остановки по сюжету, в порядке прохождения
ROUTE = [
    ('scene_gate_office', 2),   # поднять дело, разобрать стол
    ('scene_office', 1),        # допрос Каст
    ('scene_archive', 2),       # Регистратор, стеллаж
    ('scene_pump_hall', 2),     # помпа, Ира
    ('scene_pump_room', 2),     # записи, шкафчик
    ('scene_pump_shaft', 1),    # ниша, лебёдка
    ('scene_dry_row', 1),       # ряд: Дож, Айла, Жук
    ('scene_flood_gallery', 2), # тело, трубы, нанос
    ('scene_sluice', 2),        # механизм затвора
    ('scene_drift', 2),         # штольня, схрон
    ('scene_face', 3),          # Реш, жила, решение
]

# добавка «добросовестного» и «полного» прохода поверх обязательного
EXTRA_THOROUGH = 8    # лишние обыски, повторные разговоры, лишние переходы
EXTRA_FULL = 18       # все проверки и улики, которые можно собрать
SLEEP_TICKS = 8       # лагерь/койка
DEADLINE = 72


def load(p):
    with open(os.path.join(ROOT, p), encoding='utf-8') as fh:
        return json.load(fh)


def build_graph():
    """Возвращает граф сцен: {сцена: {сцена: часов}}."""
    g = {}
    loc_of = {}
    w = load('world.json')
    region = w['regions'][0]
    for loc in region['locations']:
        for s in loc.get('scenes', []):
            sid = s if isinstance(s, str) else s.get('id')
            loc_of[sid] = loc['id']
            g.setdefault(sid, {})

    # переходы внутри сцен (navigation)
    for path in sorted(glob.glob(os.path.join(ROOT, 'scenes', '*.json'))):
        s = json.load(open(path, encoding='utf-8'))
        a = s['id']
        g.setdefault(a, {})
        for e in s.get('navigation', []):
            b = e.get('go_to_scene')
            if b:
                g.setdefault(b, {})
                cost = e.get('cost_ticks', 0) or 0
                if b not in g[a] or cost < g[a][b]:
                    g[a][b] = cost
                    g[b][a] = cost

    # переходы между локациями: от каждой сцены одной локации к каждой сцене другой
    for loc in region['locations']:
        for t in loc.get('travel_connections', []):
            cost = t.get('cost_ticks', 0) or 0
            to_loc = t['to']
            for a in loc_of:
                if loc_of[a] != loc['id']:
                    continue
                for b in loc_of:
                    if loc_of[b] != to_loc:
                        continue
                    if b not in g[a] or cost < g[a][b]:
                        g[a][b] = cost
    return g


def shortest(g, a, b):
    dist = {a: 0}
    pq = [(0, a)]
    while pq:
        d, u = heapq.heappop(pq)
        if u == b:
            return d
        if d > dist.get(u, 1e9):
            continue
        for v, c in g.get(u, {}).items():
            nd = d + c
            if nd < dist.get(v, 1e9):
                dist[v] = nd
                heapq.heappush(pq, (nd, v))
    return None


def main():
    g = build_graph()
    camp = load('campaign.json')
    start = camp.get('starting_scene', 'scene_gate_hall')
    deadline = DEADLINE

    travel = 0
    actions = 0
    cur = start
    legs = []
    for scene, cost in ROUTE:
        d = shortest(g, cur, scene)
        if d is None:
            print(f'НЕТ ПУТИ: {cur} → {scene}')
            return 1
        legs.append((cur, scene, d))
        travel += d
        actions += cost
        cur = scene
    # обратно к помпе: финал разыгрывается на седьмом ярусе
    back = shortest(g, cur, 'scene_pump_hall') or 0
    legs.append((cur, 'scene_pump_hall', back))
    travel += back

    critical = travel + actions
    thorough = critical + EXTRA_THOROUGH + SLEEP_TICKS
    full = critical + EXTRA_FULL + SLEEP_TICKS * 3

    print('СМЕТА ВРЕМЕНИ, часов (срок дела — %d, потоп на %d-м тику)'
          % (deadline, camp.get('starting_tick', 0) + deadline))
    print()
    for a, b, d in legs:
        print(f'  {a:22} → {b:22} {d:2} ч')
    print()
    print(f'  дорога по маршруту:            {travel:3} ч')
    print(f'  обязательные действия:         {actions:3} ч')
    print(f'  критический путь:              {critical:3} ч  ({critical / deadline:.0%} срока)')
    print(f'  добросовестный проход (+ночь): {thorough:3} ч  ({thorough / deadline:.0%} срока)')
    print(f'  полный проход (+три ночи):     {full:3} ч  ({full / deadline:.0%} срока)')
    print()
    if critical > deadline:
        print('  ПРОБЛЕМА: критический путь не влезает в срок — дело не закрыть.')
    elif full <= deadline * 0.75:
        print('  ПРОБЛЕМА: даже полный проход оставляет четверть срока — дедлайн не чувствуется.')
    elif full <= deadline:
        print('  норма: полный проход укладывается, но почти без запаса — всё успеть нельзя.')
    else:
        print('  норма: полный проход не влезает в срок, критический — с запасом.')
    return 0


if __name__ == '__main__':
    raise SystemExit(main())
