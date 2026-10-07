#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""Ход 28 (финал): исправление багов финальных правил и закрытие бесконечного
фарма отношения в диалогах.

1. В четырёх финальных правилах (`rule_end_pump`, `rule_end_vein`,
   `rule_end_silence`, `rule_end_closed`) эффект `stop_sound` стоял ПОСЛЕ
   `play_sound`, мгновенно обрывая финальный звук в том же тике. Перенесён
   ПЕРЕД `play_sound`; в `rule_end_closed` привязан новый звук печати `sfx_seal`.
2. В `kell.ink`/`.dlg.json`, `kast.ink`/`.dlg.json`, `zhuk.ink`/`.dlg.json` и
   `dozh.ink`/`.dlg.json` добавлены защитные условия `not get_flag(...)` и
   `once: true` на многоразовые варианты выбора (`+`), которые меняли отношение
   персонажа или предъявляли улику и ставили флаг (`kell_confessed`,
   `kell_token`, `kast_note`, `kast_case_shown`, `zhuk_ledger`, `Показать Дожу
   вещь`), закрывая бесконечный фарм репутации у Келла, Каст и Дожа.

Скрипт идемпотентен.
"""
import json
import os

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))


def load_json(rel):
    with open(os.path.join(ROOT, rel), encoding='utf-8') as f:
        return json.load(f)


def save_json(rel, data, indent=2):
    with open(os.path.join(ROOT, rel), 'w', encoding='utf-8') as f:
        json.dump(data, f, ensure_ascii=False, indent=indent)
        f.write('\n')


def fix_end_rules():
    for rname, snd, vol in (
        ('rule_end_pump', 'sfx_machine', 0.9),
        ('rule_end_vein', 'sfx_hum', 1.0),
        ('rule_end_silence', 'snd_charge', 1.0),
        ('rule_end_closed', 'sfx_seal', 0.9),
    ):
        rel = f'rules/{rname}.json'
        r = load_json(rel)
        effs = [
            e for e in r.get('effects', [])
            if e.get('type') not in ('play_sound', 'stop_sound', 'game_over_victory')
        ]
        effs.append({'type': 'stop_sound'})
        effs.append({'type': 'play_sound', 'sound': snd, 'volume': vol})
        effs.append({'type': 'game_over_victory'})
        r['effects'] = effs
        save_json(rel, r)


def add_not_flag_cond(ch, flag):
    conds = ch.setdefault('conds', [])
    if not any(c.get('type') == 'flag' and c.get('flag') == flag for c in conds):
        conds.append({'type': 'flag', 'flag': flag, 'not': True})


def fix_dialogues():
    # 1. kell.ink + kell.dlg.json
    p_kell = os.path.join(ROOT, 'dialogues', 'kell.ink')
    txt = open(p_kell, encoding='utf-8').read()
    txt = txt.replace(
        '+ { has_item("item_roster") } [Наряд тринадцатого: твой взвод шёл вниз, а запись делали наверх.]',
        '+ { has_item("item_roster") and not (get_flag("kell_confessed")) } [Наряд тринадцатого: твой взвод шёл вниз, а запись делали наверх.]',
    )
    txt = txt.replace(
        '+ { has_item("item_guard_token") } [Положить перед Келлом жетон стража.]',
        '+ { has_item("item_guard_token") and not (get_flag("kell_token")) } [Положить перед Келлом жетон стража.]',
    )
    open(p_kell, 'w', encoding='utf-8').write(txt)

    d_kell = load_json('dialogues/kell.dlg.json')
    for ch in d_kell['nodes'][0]['choices']:
        if ch.get('text', '').startswith('Наряд тринадцатого:'):
            add_not_flag_cond(ch, 'kell_confessed')
        elif ch.get('text', '') == 'Положить перед Келлом жетон стража.':
            add_not_flag_cond(ch, 'kell_token')
    save_json('dialogues/kell.dlg.json', d_kell, indent=1)

    # 2. kast.ink + kast.dlg.json
    p_kast = os.path.join(ROOT, 'dialogues', 'kast.ink')
    txt = open(p_kast, encoding='utf-8').read()
    txt = txt.replace(
        '+ { has_item("item_note") } [Протянуть Каст записку мастера.]',
        '+ { has_item("item_note") and not (get_flag("kast_note")) } [Протянуть Каст записку мастера.]',
    )
    txt = txt.replace(
        '+ { get_flag("case_full") } [Показать сшитое дело.]',
        '+ { get_flag("case_full") and not (get_flag("kast_case_shown")) } [Показать сшитое дело.]',
    )
    open(p_kast, 'w', encoding='utf-8').write(txt)

    d_kast = load_json('dialogues/kast.dlg.json')
    for ch in d_kast['nodes'][0]['choices']:
        if ch.get('text', '') == 'Протянуть Каст записку мастера.':
            add_not_flag_cond(ch, 'kast_note')
        elif ch.get('text', '') == 'Показать сшитое дело.':
            add_not_flag_cond(ch, 'kast_case_shown')
    save_json('dialogues/kast.dlg.json', d_kast, indent=1)

    # 3. zhuk.ink + zhuk.dlg.json
    p_zhuk = os.path.join(ROOT, 'dialogues', 'zhuk.ink')
    txt = open(p_zhuk, encoding='utf-8').read()
    txt = txt.replace(
        '+ { has_item("item_ledger") } [Дать Жуку полистать гроссбух.]',
        '+ { has_item("item_ledger") and not (get_flag("zhuk_ledger")) } [Дать Жуку полистать гроссбух.]',
    )
    open(p_zhuk, 'w', encoding='utf-8').write(txt)

    d_zhuk = load_json('dialogues/zhuk.dlg.json')
    for ch in d_zhuk['nodes'][0]['choices']:
        if ch.get('text', '') == 'Дать Жуку полистать гроссбух.':
            add_not_flag_cond(ch, 'zhuk_ledger')
    save_json('dialogues/zhuk.dlg.json', d_zhuk, indent=1)

    # 4. dozh.ink + dozh.dlg.json
    p_dozh = os.path.join(ROOT, 'dialogues', 'dozh.ink')
    txt = open(p_dozh, encoding='utf-8').read()
    txt = txt.replace(
        '+ [Показать Дожу вещь.]',
        '* [Показать Дожу вещь.]',
    )
    open(p_dozh, 'w', encoding='utf-8').write(txt)

    d_dozh = load_json('dialogues/dozh.dlg.json')
    for ch in d_dozh['nodes'][0]['choices']:
        if ch.get('text', '') == 'Показать Дожу вещь.':
            ch['once'] = True
    save_json('dialogues/dozh.dlg.json', d_dozh, indent=1)


def main():
    fix_end_rules()
    fix_dialogues()
    print('КОНТЕНТ 28')
    print('  rule_end_*: исправлен порядок stop_sound -> play_sound, привязан sfx_seal')
    print('  kell/kast/zhuk/dozh: закрыт бесконечный фарм отношения на + (sticky) ветках')


if __name__ == '__main__':
    main()
