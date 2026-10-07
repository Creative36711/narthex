#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""Ход 23: синхронизация с движком (`fb947a1`), исправление триггеров
стартовых и ручных правил, расписаний NPC и слотов спутников.

1. `campaign.json`:
   - `id` → `2c46c88f-49f2-43dc-b393-85b0941874fe` (из `__chronicle_ai__/TASK.md`);
   - добавлен флаг `resh_joined` («Реш пошёл с дознавателем»).
2. Исправление критических багов правил:
   - `rule_intro.json`: `trigger` переведён с `time_tick` на `always`
     (по новому регламенту `campaign-guide.md`: правило на `min_tick: 0`
     обязано иметь `trigger: "always"`, иначе пролог ждёт первого тика сна/пути);
   - `rule_kast_note.json`, `rule_kell_token.json`, `rule_zhuk_ledger.json`:
     стояло `manual: false` при пустом `conditions: []` и `trigger: "always"`,
     из-за чего все три правила срабатывали автоматически на нулевом тике
     в момент старта игры! Переведены в `manual: true` без `trigger`;
   - `rule_watchman_oil.json`: добавлено открытие статьи `codex_watchman`
     (раньше статью открывало только `rule_watchman.json`, и при обходе
     маслом запись кодекса не выдавалась).
3. Исправление расписаний NPC (`schedule` vs `default_entity`):
   - `npc_kast` и `npc_kell` имели `schedule: [9..21]`, из-за чего в 08:00
     первого утра (сразу после прихода со шлюза!) и ночью после 21:00 приёмная
     стояла пустой — переведены на `schedule: []` (круглосуточное дежурство
     через `default_entity` слота);
   - `npc_ira` имела ночное расписание `20..7` в `scene_dry_row`, из-за чего
     вечером исчезала от седьмой помпы, а после вступления в отряд продолжала
     появляться в Сухом ряду — переведена на `schedule: []`;
   - `npc_zhuk`: `schedule: []`, убрана вечная блокировка `presence_overrides`
     в `scene_gate_hall`, из-за которой жаровня в Сухом ряду пустовала вопреки
     словам Дожа («У жаровни сидит, греется»); `rule_zhuk_appears` теперь даёт
     наводку у шлюза, что человек в чужой кепке спустился к жаровне в Сухой ряд;
   - `scenes/scene_face.json`: слоту `slot_resh` добавлено условие
     `{"not_flag": "resh_joined"}` (после вступления в отряд Реш не остаётся
     сидеть у стены).

Скрипт идемпотентен.
"""
import json
import os

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
NEW_ID = '2c46c88f-49f2-43dc-b393-85b0941874fe'


def load_json(rel):
    with open(os.path.join(ROOT, rel), encoding='utf-8') as f:
        return json.load(f)


def save_json(rel, data, indent=2):
    with open(os.path.join(ROOT, rel), 'w', encoding='utf-8') as f:
        json.dump(data, f, ensure_ascii=False, indent=indent)
        f.write('\n')


def main():
    # 1. campaign.json
    camp = load_json('campaign.json')
    camp['id'] = NEW_ID
    flag_map = {f['id']: f for f in camp.get('flags', [])}
    if 'resh_joined' not in flag_map:
        camp['flags'].append({
            'id': 'resh_joined',
            'label': 'Реш пошёл с дознавателем',
            'description': 'Мастер Реш поднялся со стены в слепом забое и пошёл вместе с дознавателем.',
        })
    else:
        flag_map['resh_joined']['description'] = (
            'Мастер Реш поднялся со стены в слепом забое и пошёл вместе с дознавателем.'
        )
    save_json('campaign.json', camp)

    # 2. rule_intro -> trigger: always
    intro = load_json('rules/rule_intro.json')
    intro['trigger'] = 'always'
    save_json('rules/rule_intro.json', intro)

    # 3. Ручные правила диалогов (не должны стрелять сами на тике 0)
    for rname in ('rule_kast_note.json', 'rule_kell_token.json', 'rule_zhuk_ledger.json'):
        rel = f'rules/{rname}'
        r = load_json(rel)
        r['manual'] = True
        r.pop('trigger', None)
        save_json(rel, r)

    # 4. rule_watchman_oil -> unlock_codex("codex_watchman")
    woil = load_json('rules/rule_watchman_oil.json')
    if not any(
        e.get('type') == 'unlock_codex' and e.get('entry') == 'codex_watchman'
        for e in woil.get('effects', [])
    ):
        woil['effects'].insert(0, {
            'type': 'unlock_codex',
            'entry': 'codex_watchman',
        })
    save_json('rules/rule_watchman_oil.json', woil)

    # 5. Расписания NPC и Жук у жаровни
    for npc_id in ('npc_kast', 'npc_kell', 'npc_ira'):
        rel = f'entities/{npc_id}.json'
        d = load_json(rel)
        d['schedule'] = []
        save_json(rel, d)

    zhuk = load_json('entities/npc_zhuk.json')
    zhuk['schedule'] = []
    zhuk.pop('presence_overrides', None)
    zhuk['unknown_label'] = 'Человек у жаровни'
    save_json('entities/npc_zhuk.json', zhuk)

    zhuk_rule = load_json('rules/rule_zhuk_appears.json')
    for ef in zhuk_rule.get('effects', []):
        if ef.get('type') == 'show_message':
            ef['text'] = (
                'У затвора мелькает человек в чужой кепке и тут же уходит '
                'вниз по лестнице восьмого яруса. Новости в Каркасе бегут '
                'быстрее приписных: ищи его у жаровни в Сухом ряду.'
            )
    save_json('rules/rule_zhuk_appears.json', zhuk_rule)

    # 6. Слот Реша в слепом забое скрывается после вступления в отряд
    face = load_json('scenes/scene_face.json')
    for sl in face.get('slots', []):
        if sl.get('id') == 'slot_resh':
            sl['condition'] = {'not_flag': 'resh_joined'}
    save_json('scenes/scene_face.json', face)

    print('ДВИЖОК 23')
    print('  campaign.id:', NEW_ID)
    print('  rule_intro trigger: always')
    print('  rule_kast_note / rule_kell_token / rule_zhuk_ledger -> manual: true')
    print('  расписания npc_kast, npc_kell, npc_ira, npc_zhuk очищены (работают через default_entity)')


if __name__ == '__main__':
    main()
