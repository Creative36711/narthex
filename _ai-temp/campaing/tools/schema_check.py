#!/usr/bin/env python3
"""Проверка всех файлов кампании по схеме движка (__chronicle_ai__/campaign.schema.json).

tools/validate.py ловит битые ссылки внутри кампании, но не сверяет файлы с
типами движка. Этот скрипт делает вторую половину работы: берёт описания из
$defs схемы и прогоняет по ним каждый модуль. Нужен после обновления движка —
именно так ловятся удалённые и переименованные поля.
"""
import glob
import json
import os
import sys

import jsonschema

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SCHEMA = os.path.join(ROOT, '__chronicle_ai__', 'campaign.schema.json')

# папка -> описание в схеме
MODULES = [
    ('scenes/*.json', 'SceneDef'),
    ('rules/rule_*.json', 'RuleDef'),
    ('recipes/*.json', 'RecipeDef'),
    ('quests/*.json', 'QuestDef'),
    ('cutscenes/*.json', 'CutsceneDef'),
    ('codex/*.json', 'CodexEntryDef'),
    ('arenas/*.json', 'ArenaDef'),
    ('dialogues/*.dlg.json', 'DlgDoc'),
    ('rules/encounters.json', 'EncounterFileDef'),
]

# поля, которых нет в схеме, но которые требует руководство движка.
# Схема отстаёт от руководства: такие поля не считаем ошибкой.
# quest_item появился в схеме движка в ходу 20 — отставания больше нет
SCHEMA_LAG = set()


def strip_lag(node):
    """Убирает известные схеме-неизвестные поля перед проверкой."""
    if isinstance(node, dict):
        return {k: strip_lag(v) for k, v in node.items() if k not in SCHEMA_LAG}
    if isinstance(node, list):
        return [strip_lag(v) for v in node]
    return node


def main():
    with open(SCHEMA, encoding='utf-8') as fh:
        schema = json.load(fh)
    defs = schema['$defs']

    errors = 0

    # монолитная кампания
    camp = strip_lag(json.load(open(os.path.join(ROOT, 'campaign.json'), encoding='utf-8')))
    for err in sorted(jsonschema.Draft202012Validator(
            {'$ref': '#/$defs/CampaignMeta', '$defs': defs}).iter_errors(camp),
            key=lambda e: list(e.path)):
        print('campaign.json:', '/'.join(str(p) for p in err.path) or '(корень)',
              '→', err.message[:200])
        errors += 1

    for pattern, ref in MODULES:
        if ref not in defs:
            print('  ! в схеме нет описания', ref, '— пропускаю', pattern)
            continue
        for path in sorted(glob.glob(os.path.join(ROOT, pattern))):
            data = strip_lag(json.load(open(path, encoding='utf-8')))
            file_errors = list(jsonschema.Draft202012Validator(
                {'$ref': '#/$defs/' + ref, '$defs': defs}).iter_errors(data))
            for err in sorted(file_errors, key=lambda e: list(e.path))[:5]:
                print(os.path.relpath(path, ROOT) + ':',
                      '/'.join(str(p) for p in err.path) or '(корень)',
                      '→', err.message[:200])
            errors += len(file_errors)

    # сущности: у предметов и у персонажей разные описания
    for path in sorted(glob.glob(os.path.join(ROOT, 'entities/*.json'))):
        data = strip_lag(json.load(open(path, encoding='utf-8')))
        ref = 'NpcDef' if data.get('type') == 'npc' else 'ItemDef'
        file_errors = list(jsonschema.Draft202012Validator(
            {'$ref': '#/$defs/' + ref, '$defs': defs}).iter_errors(data))
        for err in sorted(file_errors, key=lambda e: list(e.path))[:5]:
            print(os.path.relpath(path, ROOT) + ':',
                  '/'.join(str(p) for p in err.path) or '(корень)',
                  '→', err.message[:200])
        errors += len(file_errors)

    print('\nитого ошибок по схеме:', errors)
    print('поля, пропущенные как отставание схемы:', ', '.join(sorted(SCHEMA_LAG)))
    return 1 if errors else 0


if __name__ == '__main__':
    sys.exit(main())
