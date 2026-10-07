#!/usr/bin/env python3
"""Звуковые крючки кампании: кто, где и чем звучит.

Движок умеет вешать звук на много мест разного масштаба — от реплики
до целой локации. Скрипт раскладывает звуки по всем этим местам разом,
чтобы таблица назначений лежала в одном файле и её можно было
перечитать, а не искать по сорока json.

Уровни, от крупного к мелкому:

1. `ui_sounds` — интерфейс: общий `panel_open` плюс отдельные звуки
   панелей (`panel:inventory`, `panel:inventory:close` и т.п.) с каскадным
   откатом на общий хук.
2. `TravelConnection` — `depart_sound` (отправление), `sound` (путь),
   `arrive_sound` (прибытие) и громкость каждого: у каждого перехода
   между ярусами свой набор.
3. Музыка: `override_music` / `clear_music_override` — сюжетный оверрайд
   поверх музыки сцены (тревога, удушье, бой) и возврат к обычной.
4. Состояния сцены и слоты: `sound` + `sound_volume` — звук смены
   состояния (помпа пошла) и звук клика по слоту.
5. Статусы героя: `apply_sound` / `remove_sound` (удушье, гнилец, вода).
6. Правила: `play_sound` — точный звук события; `stop_sound` — оборвать
   длинный звук или петлю.
7. Рецепты и действия предметов: `sound` + `sound_volume`.
8. Реплики: `# sfx:` в ink и поле `sfx` в конструкторе.

Запуск: python3 tools/audio_hooks.py
"""
import json
import os

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))


def load(path):
    with open(os.path.join(ROOT, path), encoding='utf-8') as fh:
        return json.load(fh)


def save(path, data):
    with open(os.path.join(ROOT, path), 'w', encoding='utf-8') as fh:
        json.dump(data, fh, ensure_ascii=False, indent=1)
    print(f'записан {path}')


# ------------------------------------------------------------- реестр звуков
NEW_SOUNDS = [
    {'id': 'sfx_bell', 'label': 'Колокол яруса', 'src': 'assets/audio/sfx/sfx_bell.ogg'},
    {'id': 'sfx_book', 'label': 'Дело в архиве', 'src': 'assets/audio/sfx/sfx_book.ogg'},
    {'id': 'sfx_coins', 'label': 'Марки в ладони', 'src': 'assets/audio/sfx/sfx_coins.ogg'},
    {'id': 'sfx_error', 'label': 'Отказ механизма', 'src': 'assets/audio/sfx/sfx_error.ogg'},
    {'id': 'sfx_flip', 'label': 'Листание страниц', 'src': 'assets/audio/sfx/sfx_flip.ogg'},
    {'id': 'sfx_gasp', 'label': 'Выдох воздуха', 'src': 'assets/audio/sfx/sfx_gasp.ogg'},
    {'id': 'sfx_glass', 'label': 'Звон стекла', 'src': 'assets/audio/sfx/sfx_glass.ogg'},
    {'id': 'sfx_hum', 'label': 'Гул жилы', 'src': 'assets/audio/sfx/sfx_hum.mp3'},
    {'id': 'sfx_lever', 'label': 'Рычаг', 'src': 'assets/audio/sfx/sfx_lever.ogg'},
    {'id': 'sfx_lock', 'label': 'Замок и ключ', 'src': 'assets/audio/sfx/sfx_lock.ogg'},
    {'id': 'sfx_machine', 'label': 'Запуск механизма', 'src': 'assets/audio/sfx/sfx_machine.ogg'},
    {'id': 'sfx_rungs', 'label': 'Ступени лестницы', 'src': 'assets/audio/sfx/sfx_rungs.ogg'},
    {'id': 'sfx_squelch', 'label': 'Хлюп гнильца', 'src': 'assets/audio/sfx/sfx_squelch.ogg'},
    {'id': 'sfx_surge', 'label': 'Наплыв воды', 'src': 'assets/audio/sfx/sfx_surge.mp3'},
    {'id': 'sfx_tick', 'label': 'Счётчик', 'src': 'assets/audio/sfx/sfx_tick.ogg'},
    {'id': 'sfx_wade', 'label': 'Шаг по воде', 'src': 'assets/audio/sfx/sfx_wade.ogg'},
]

# ---------------------------------------------------------------- интерфейс
UI_SOUNDS = {
    'panel:inventory': 'snd_cloth',
    'panel:inventory:close': 'snd_cloth',
    'panel:journal': 'snd_page',
    'panel:journal:close': 'snd_page',
    'panel:map': 'snd_paper',
    'panel:map:close': 'snd_paper',
    'panel:craft': 'sfx_anvil',
    'panel:craft:close': 'snd_latch',
    'panel:character': 'snd_cloth',
    'panel:character:close': 'snd_cloth',
    'panel:codex': 'snd_paper',
    'panel:codex:close': 'snd_paper',
    'dialogue_present': 'snd_tag',   # вещь легла на стол перед НПС
    'equip': 'snd_latch',
    'unequip': 'snd_cloth',
    'item_get': 'sfx_pickup',
    'item_lose': 'snd_cloth',
    'craft': 'sfx_anvil',
    'heal': 'sfx_lamp',
    'flee': 'sfx_step',
    'kill': 'sfx_crit',
}

# ------------------------------------------------------------------ дорога
# локация → локация: (отправление, громкость, путь, громкость, прибытие, громкость)
TRAVEL = {
    ('loc_surface', 'loc_gate'): ('snd_latch', 0.7, 'sfx_step', 0.7, 'sfx_door', 0.8),
    ('loc_gate', 'loc_surface'): ('sfx_door', 0.8, 'sfx_step', 0.7, 'snd_latch', 0.7),
    ('loc_surface', 'loc_pump7'): ('snd_latch', 0.6, 'sfx_step', 0.7, 'snd_creak', 0.6),
    ('loc_pump7', 'loc_surface'): ('snd_creak', 0.6, 'sfx_step', 0.7, 'snd_latch', 0.6),
    ('loc_gate', 'loc_pump7'): ('snd_chain', 0.6, 'sfx_rungs', 0.6, 'snd_creak', 0.6),
    ('loc_pump7', 'loc_gate'): ('snd_creak', 0.6, 'sfx_rungs', 0.6, 'snd_chain', 0.6),
    ('loc_pump7', 'loc_ward8'): ('snd_latch', 0.7, 'sfx_wade', 0.8, 'sfx_water', 0.7),
    ('loc_ward8', 'loc_pump7'): ('sfx_water', 0.7, 'sfx_wade', 0.8, 'snd_latch', 0.7),
    ('loc_ward8', 'loc_deep9'): ('snd_creak', 0.7, 'sfx_step', 0.6, 'snd_vent', 0.5),
    ('loc_deep9', 'loc_ward8'): ('snd_vent', 0.5, 'sfx_step', 0.6, 'snd_creak', 0.7),
}

# ------------------------------------------------------------------- звуки
# правило → (звук, громкость). Один звук на правило; если он уже стоял —
# заменяем, чтобы таблица оставалась единственным источником правды.
RULE_SOUNDS = {
    'rule_air_warn': ('snd_vent', 0.7),
    'rule_zero_air': ('sfx_gasp', 1.0),
    'rule_filter_bank1': ('snd_vent', 0.8),
    'rule_filter_bank2': ('snd_vent', 0.8),
    'rule_filter_spent': ('sfx_gasp', 0.9),
    'rule_ashfall': ('snd_vent', 0.6),
    'rule_downpour': ('sfx_water', 1.0),
    'rule_water_rises': ('sfx_surge', 0.9),
    'rule_gate_first': ('sfx_door', 1.0),
    'rule_sluice_first': ('sfx_water', 0.8),
    'rule_install_valve': ('sfx_lever', 0.8),
    'rule_open_cache': ('snd_stone', 0.9),
    'rule_reveal_deep': ('snd_creak', 0.8),
    'rule_watchman': ('sfx_machine', 0.6),
    'rule_see_rot': ('sfx_squelch', 0.7),
    'rule_hounds': ('snd_stone', 0.7),
    'rule_camp_ambush': ('sfx_hit', 0.9),
    'rule_kast_note': ('snd_paper', 0.7),
    'rule_kell_token': ('snd_tag', 0.8),
    'rule_zhuk_ledger': ('sfx_flip', 0.7),
    'rule_roster_got': ('sfx_book', 0.7),
    'rule_ira_story': ('snd_paper', 0.7),
    'rule_ira_brother': ('snd_tag', 0.8),
    'rule_zhuk_appears': ('sfx_coins', 0.8),
    'rule_zhuk_info': ('sfx_coins', 0.8),
    'rule_lockdown': ('snd_latch', 0.9),
    'rule_end_silence': ('snd_charge', 1.0),
    'rule_end_vein': ('sfx_hum', 1.0),
    'rule_end_closed': ('sfx_book', 0.7),
    'rule_end_pump': ('sfx_machine', 0.9),
    'rule_resh_found': ('sfx_hum', 0.6),
}

# правила, где к звуку добавляется сюжетная музыка
RULE_MUSIC = {
    'rule_deadline_warn': {'type': 'override_music', 'tracks': ['music_alarm'], 'fade': 3},
    'rule_zero_air': {'type': 'override_music', 'tracks': ['music_deep'], 'fade': 2},
}

# правила, где длинный звук надо оборвать
RULE_STOP = {
    'rule_air_restored': {'type': 'stop_sound', 'sound': 'sfx_gasp'},
    'rule_end_pump': {'type': 'stop_sound'},
    'rule_end_silence': {'type': 'stop_sound'},
    'rule_end_vein': {'type': 'stop_sound'},
    'rule_end_closed': {'type': 'stop_sound'},
}

# флаги, которые нужны новым эффектам
NEW_FLAGS = [
    {'id': 'air_music', 'label': 'Музыка: удушье',
     'description': 'Сюжетный оверрайд музыки включён: у героя кончился воздух '
                    'на девятом ярусе. Снимается правилом rule_air_restored.'},
]

# ------------------------------------------------------------------- крафт
RECIPES = {
    'recipe_bandage': ('snd_cloth', 0.6),
    'recipe_bolt': ('sfx_anvil', 0.9),
    'recipe_charge': ('snd_charge', 0.8),
    'recipe_filter': ('sfx_gear', 0.7),
    'recipe_repair_lamp': ('sfx_lamp', 0.7),
    'recipe_tonic': ('snd_pot', 0.8),
    'recipe_stew': ('snd_pot', 0.7),
}

# --------------------------------------------------------- состояния сцен
STATES = {
    ('scene_pump_hall', 'state_running'): ('sfx_machine', 1.0),  # помпа пошла
    ('scene_gate_hall', 'state_night'): ('sfx_bell', 0.7),       # колокол смены
    ('scene_gate_hall', 'state_day'): ('sfx_lever', 0.6),        # шлюз открыли
}

# ------------------------------------------------------------------- слоты
# сцена: слот → (звук, громкость)
SLOTS = {
    'scene_archive': {'Регистратор': ('sfx_tick', 0.5),
                      'Стеллаж с делами': ('sfx_book', 0.7)},
    'scene_drift': {'Схрон мастера': ('sfx_lock', 0.7),
                    'Отдушина': ('snd_vent', 0.6),
                    'Маркер забоя': ('snd_stone', 0.5)},
    'scene_dry_row': {'Прилавок старьёвщика': ('sfx_coins', 0.6),
                      'Стол лекаря': ('sfx_glass', 0.6),
                      'У жаровни': ('snd_pot', 0.6),
                      'Жаровня': ('snd_pot', 0.5),
                      'Верстак у стены': ('sfx_anvil', 0.7)},
    'scene_face': {'Мастер у жилы': ('sfx_hum', 0.7),
                   'Жила в породе': ('sfx_hum', 0.8),
                   'Подъёмник': ('snd_chain', 0.7)},
    'scene_flood_gallery': {'Тело у воды': ('snd_cloth', 0.6),
                            'Трубный узел': ('sfx_gear', 0.6),
                            'Нанос у стенки': ('snd_stone', 0.6)},
    'scene_gate_hall': {'Смотритель у пульта': ('sfx_click', 0.5),
                        'Доска объявлений': ('snd_paper', 0.6),
                        'Ящик с кладью': ('snd_creak', 0.6),
                        'У затвора': ('sfx_door', 0.6)},
    'scene_gate_office': {'Шкаф с делами': ('sfx_book', 0.6),
                          'Стол дознавателя': ('snd_paper', 0.6),
                          'Койка': ('snd_cloth', 0.5),
                          'Верстак': ('sfx_anvil', 0.7)},
    'scene_office': {'Инспектор за столом': ('snd_paper', 0.5),
                     'Старшина стражи': ('snd_blade', 0.5)},
    'scene_pump_hall': {'Седьмая помпа': ('sfx_gear', 0.6),
                        'У пульта': ('sfx_lever', 0.5),
                        'Дверь каморки мастера': ('sfx_door', 0.6)},
    'scene_pump_room': {'Стол мастера': ('snd_paper', 0.6),
                        'Железный шкафчик': ('sfx_lock', 0.7),
                        'Печка': ('snd_pot', 0.5)},
    'scene_pump_shaft': {'Лестница вниз': ('sfx_rungs', 0.6),
                         'Ниша в кладке': ('snd_stone', 0.6),
                         'Лебёдка': ('snd_chain', 0.7)},
    'scene_sluice': {'Механизм затвора': ('sfx_machine', 0.7),
                     'Погибший стражник': ('snd_cloth', 0.5)},
}

# ---------------------------------------------------------------- статусы
STATUS = {
    'status_rot': ('sfx_squelch', 'sfx_glass'),        # гнилец пришёл / снят настоем
    'status_choke': ('sfx_gasp', 'snd_vent'),          # удушье / воздух пошёл
    'status_cold': ('snd_vent', 'snd_cloth'),          # озноб / укутался
    'status_clarity': ('sfx_glass', 'sfx_tick'),       # ясность / спадает
    'status_veinsong': ('sfx_hum', 'sfx_hum'),         # зов жилы
    'status_filter_spent': ('sfx_gasp', 'snd_latch'),  # банка кончилась / новая
    'status_wading': ('sfx_surge', 'sfx_wade'),        # по колено в воде / вылез
}

# ---------------------------------------------------------------- предметы
ITEM_SOUNDS = {
    'item_filter': {'equip': 'snd_latch', 'unequip': 'snd_cloth', 'use': 'snd_vent'},
    'item_coat': {'equip': 'snd_cloth', 'unequip': 'snd_cloth'},
    'item_lamp': {'equip': 'sfx_lamp', 'unequip': 'snd_cloth'},
    'item_wrench': {'equip': 'snd_latch', 'unequip': 'snd_cloth'},
    # улики: каждая звучит по-своему, когда её берут в руки
    'item_ledger': {'use': 'sfx_flip'},
    'item_resh_notes': {'use': 'sfx_flip'},
    'item_roster': {'use': 'sfx_book'},
    'item_note': {'use': 'snd_paper'},
    'item_core': {'use': 'sfx_glass'},
    'item_guard_token': {'use': 'snd_tag'},
    'item_key_cache': {'use': 'sfx_lock'},
    'item_key_resh': {'use': 'sfx_lock'},
    'item_plate': {'use': 'snd_stone'},
    # расходники
    'item_tonic': {'use': 'sfx_glass'},
    'item_antirot': {'use': 'sfx_glass'},
    'item_bandage': {'use': 'snd_cloth'},
    'item_water': {'use': 'sfx_water'},
    'item_stew': {'use': 'snd_pot'},
    'item_ration': {'use': 'snd_cloth'},
    'item_oil': {'use': 'snd_pot'},
}

# действия предметов: более точный звук вместо общего
ITEM_OPTION_SOUNDS = {
    'item_resh_notes': ('snd_page', 'sfx_flip'),
    'item_shelf': ('snd_paper', 'sfx_book'),
    'item_vent': (None, 'snd_vent'),
    'item_valve': (None, 'sfx_lever'),
}

# ---------------------------------------------------------------- реплики
LINES = [
    ('vex', 'Векс поднимает глаза от пульта', 'sfx_click'),
    ('vex', 'Он крутит маховик', 'sfx_gear'),
    ('registrar', 'Регистратор щёлкает реле', 'sfx_click'),
    ('registrar', 'Пломба предъявлена', 'snd_latch'),
    ('registrar', 'Пломба не предъявлена', 'sfx_error'),
    ('registrar', 'Назовите номер дела', 'sfx_tick'),
    ('kell', 'Келл не встаёт', 'snd_blade'),
    ('kell', 'Келл смотрит на медь', 'snd_tag'),
    ('zhuk', 'Он протягивает руку', 'sfx_coins'),
    ('zhuk', 'Жук листает', 'sfx_flip'),
    ('ira', 'Она вытирает ладони', 'snd_cloth'),
    ('ira', 'Она берёт жетон', 'snd_tag'),
    ('resh', 'Он встаёт тяжело', 'snd_stone'),
    ('vein', 'Ты кладёшь ладонь на камень', 'sfx_hum'),
    ('vein', 'Молчание длится', 'sfx_hum'),
    ('kast', 'Она листает книгу', 'snd_page'),
    ('kast', 'Молчишь? Я запишу', 'snd_paper'),
    ('dozh', 'Дож вертит вещь', 'snd_latch'),
    ('ayla', 'Айла промокает бинт', 'sfx_water'),
]


def put_sound(effects, snd, volume, tail=('game_over_victory', 'game_over_death')):
    """Ставит (или заменяет) единственный play_sound в списке эффектов."""
    for e in effects:
        if e.get('type') == 'play_sound':
            e['sound'] = snd
            e['volume'] = volume
            return False
    e = {'type': 'play_sound', 'sound': snd, 'volume': volume}
    pos = len(effects)
    for i, ex in enumerate(effects):
        if ex.get('type') in tail:
            pos = i
            break
    effects.insert(pos, e)
    return True


def put_effect(effects, eff, tail=('game_over_victory', 'game_over_death')):
    key = json.dumps(eff, ensure_ascii=False, sort_keys=True)
    for e in effects:
        if json.dumps(e, ensure_ascii=False, sort_keys=True) == key:
            return False
    pos = len(effects)
    for i, ex in enumerate(effects):
        if ex.get('type') in tail:
            pos = i
            break
    effects.insert(pos, eff)
    return True


def main():
    # 1. реестр звуков, флаги, интерфейс
    camp = load('campaign.json')
    ids = {s['id'] for s in camp['sounds']}
    for s in NEW_SOUNDS:
        if s['id'] not in ids:
            camp['sounds'].append(s)
            ids.add(s['id'])
    camp['sounds'].sort(key=lambda s: s['id'])
    ui = camp.setdefault('ui_sounds', {})
    ui.update({k: v for k, v in UI_SOUNDS.items() if k not in ui})
    have = {f['id'] for f in camp['flags']}
    for f in NEW_FLAGS:
        if f['id'] not in have:
            camp['flags'].append(f)
    camp['flags'].sort(key=lambda f: f['id'])
    # статусы: звук наложения и снятия
    for st in camp['statuses']:
        pair = STATUS.get(st['id'])
        if not pair:
            continue
        st['apply_sound'], st['remove_sound'] = pair
    save('campaign.json', camp)

    # 2. дорога
    world = load('world.json')
    for loc in world['regions'][0]['locations']:
        for conn in loc.get('travel_connections', []):
            key = (loc['id'], conn['to'])
            if key not in TRAVEL:
                print('нет звуков для перехода', key)
                continue
            dep, dv, path, pv, arr, av = TRAVEL[key]
            conn.update({'depart_sound': dep, 'depart_sound_volume': dv,
                         'sound': path, 'sound_volume': pv,
                         'arrive_sound': arr, 'arrive_sound_volume': av})
    save('world.json', world)

    # 3. правила: звук, музыка, остановка
    for rid, (snd, vol) in RULE_SOUNDS.items():
        p = f'rules/{rid}.json'
        try:
            r = load(p)
        except FileNotFoundError:
            print('нет правила', rid)
            continue
        put_sound(r['effects'], snd, vol)
        if rid in RULE_MUSIC:
            put_effect(r['effects'], RULE_MUSIC[rid])
        save(p, r)
    for rid, eff in RULE_STOP.items():
        p = f'rules/{rid}.json'
        try:
            r = load(p)
        except FileNotFoundError:
            print('нет правила', rid)
            continue
        put_effect(r['effects'], eff)
        save(p, r)

    # 4. крафт
    for rid, (snd, vol) in RECIPES.items():
        p = f'recipes/{rid}.json'
        try:
            r = load(p)
        except FileNotFoundError:
            print('нет рецепта', rid)
            continue
        r['sound'], r['sound_volume'] = snd, vol
        save(p, r)

    # 5. состояния сцен и слоты
    for sid, slots in SLOTS.items():
        p = f'scenes/{sid}.json'
        sc = load(p)
        for st in sc.get('states', []):
            pair = STATES.get((sid, st['id']))
            if pair:
                st['sound'], st['sound_volume'] = pair
        for sl in sc.get('slots', []):
            lab = sl.get('label', '')
            if isinstance(lab, list):
                lab = lab[0] if lab else ''
            pair = slots.get(lab)
            if pair:
                sl['sound'], sl['sound_volume'] = pair
            else:
                print(f'  слот без звука: {sid} / {lab}')
        save(p, sc)

    # 6. предметы
    for iid, snds in ITEM_SOUNDS.items():
        p = f'entities/{iid}.json'
        e = load(p)
        s = e.get('sounds') or {}
        s.update(snds)
        e['sounds'] = s
        save(p, e)
    for iid, (old, new) in ITEM_OPTION_SOUNDS.items():
        p = f'entities/{iid}.json'
        try:
            e = load(p)
        except FileNotFoundError:
            print('нет предмета', iid)
            continue
        n = 0
        for io in e.get('interact_options', []):
            if io.get('sound') == old or (old is None and not io.get('sound')):
                io['sound'] = new
                n += 1
        if n:
            save(p, e)
        print(f'  {iid}: действий со звуком {n}')

    # 7. реплики: ink + конструктор
    for name, start, snd in LINES:
        p = f'dialogues/{name}.ink'
        lines = open(os.path.join(ROOT, p), encoding='utf-8').read().split('\n')
        hit = 0
        for i, line in enumerate(lines):
            if line.strip().startswith(start) and '# sfx:' not in line:
                lines[i] = line.rstrip() + ' # sfx: ' + snd
                hit += 1
        with open(os.path.join(ROOT, p), 'w', encoding='utf-8') as fh:
            fh.write('\n'.join(lines))
        p = f'dialogues/{name}.dlg.json'
        d = load(p)
        cnt = 0

        def scan(secs):
            nonlocal cnt
            for sec in secs:
                for st in sec.get('steps', []):
                    l = st.get('line')
                    if l and l.get('text', '').strip().startswith(start) and not l.get('sfx'):
                        l['sfx'] = snd
                        cnt += 1

        for n in d.get('nodes', []):
            scan(n.get('sections') or [])
            for ch in n.get('choices', []):
                scan(ch.get('sections') or [])
        save(p, d)
        print(f'  {name}: ink {hit}, конструктор {cnt} — {snd}')

    print('\nготово')


if __name__ == '__main__':
    main()
