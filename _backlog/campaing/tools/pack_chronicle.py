#!/usr/bin/env python3
"""Собрать .chronicle из корня репозитория (Campaign Package) и проверить архив.

Пакет — это сам корень репозитория: campaign.json, world.json, manifest.json,
scenes/, entities/, rules/, arenas/, quests/, cutscenes/, recipes/, codex/,
dialogues/, assets/. В архив не попадают: __chronicle_ai__/, dist/, tools/,
.git*, README.md, .gitattributes и сами архивы .chronicle/.zip.

Запуск:  python3 tools/pack_chronicle.py
Результат: dist/vtoroe-serdce-gorna.chronicle
"""
import json, os, re, sys, zipfile

SRC = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT = os.path.join(SRC, 'dist', 'vtoroe-serdce-gorna.chronicle')
EXCLUDE_DIRS = {'__chronicle_ai__', 'dist', 'tools', '.git', '__pycache__'}
EXCLUDE_EXT = {'.chronicle', '.zip', '.pyc'}
EXCLUDE_ROOT_FILES = {'README.md', '.gitattributes', '.gitignore'}
ROOT_OK = {'campaign.json', 'world.json', 'manifest.json'}
KINDS = ('scenes', 'entities', 'rules', 'dialogues', 'arenas', 'quests',
         'encounters', 'cutscenes', 'recipes', 'codex')


def collect():
    files = []
    for root, dirs, names in os.walk(SRC):
        dirs[:] = sorted(d for d in dirs if d not in EXCLUDE_DIRS)
        for n in sorted(names):
            if os.path.splitext(n)[1].lower() in EXCLUDE_EXT:
                continue
            if root == SRC and n in EXCLUDE_ROOT_FILES:
                continue
            p = os.path.join(root, n)
            files.append((os.path.relpath(p, SRC).replace(os.sep, '/'), p))
    return sorted(files)


def main():
    files = collect()
    os.makedirs(os.path.dirname(OUT), exist_ok=True)
    if os.path.exists(OUT):
        os.remove(OUT)
    with zipfile.ZipFile(OUT, 'w', zipfile.ZIP_DEFLATED, compresslevel=9) as z:
        for arc, p in files:
            z.write(p, arc)
    print(f'архив: {OUT} ({os.path.getsize(OUT) / 1024 / 1024:.1f} МиБ, {len(files)} файлов)')

    z = zipfile.ZipFile(OUT)
    names = set(z.namelist())
    errors, warns = [], []
    for must in ROOT_OK:
        if must not in names:
            errors.append(f'нет корневого файла {must}')
    if errors:
        print('\n'.join('ERROR ' + e for e in errors))
        return 1

    camp = json.loads(z.read('campaign.json'))
    man = json.loads(z.read('manifest.json'))
    print(f"кампания: {camp['title']} | id {camp['id']} | движок {camp['min_engine']}"
          f" | design_doc {len(camp.get('design_doc') or '')} знаков")

    enc = {'rules/' + f for f in man.get('encounters', [])}
    for kind in KINDS:
        arr = man.get(kind)
        if arr is None:
            warns.append(f'в манифесте нет массива «{kind}»')
            continue
        folder = 'rules' if kind == 'encounters' else kind
        for fn in arr:
            if '/' in fn:
                errors.append(f'manifest.{kind}: «{fn}» — нужно имя файла без папки')
            elif f'{folder}/{fn}' not in names:
                errors.append(f'manifest.{kind}: нет файла {folder}/{fn}')
        print(f'  manifest.{kind}: {len(arr)}')

    for kind in ('scenes', 'entities', 'rules', 'quests', 'arenas', 'cutscenes',
                 'recipes', 'codex'):
        for n in sorted(names):
            if not n.startswith(kind + '/') or n in enc:
                continue
            d = json.loads(z.read(n))
            if d.get('id') != os.path.splitext(os.path.basename(n))[0]:
                errors.append(f'{n}: id «{d.get("id")}» не совпадает с именем файла')

    for n in sorted(names):
        if n.startswith('entities/'):
            d = json.loads(z.read(n))
            dlg = d.get('dialogue')
            if dlg and dlg not in names:
                errors.append(f'{n}: диалог {dlg} отсутствует в архиве')

    pat = re.compile(r'assets/[A-Za-z0-9_/.\-]+\.(?:jpg|jpeg|png|webp)')
    refs = set()
    for n in names:
        if n.endswith(('.json', '.ink')):
            refs |= set(pat.findall(z.read(n).decode('utf-8')))
    missing = sorted(r for r in refs if r not in names)
    print(f'  ссылок на медиа: {len(refs)} | нет в архиве: {missing}')
    if missing:
        errors.append('нет медиа: ' + ', '.join(missing))

    stray = [n for n in names if '/' not in n and n not in ROOT_OK]
    if stray:
        errors.append('лишние файлы в корне архива: ' + ', '.join(sorted(stray)))

    folders = {}
    for n in names:
        if '/' in n:
            folders[n.split('/')[0]] = folders.get(n.split('/')[0], 0) + 1
    print('  папки:', dict(sorted(folders.items())))
    print(f"  всего записей: {len(names)}"
          f" | json: {sum(1 for n in names if n.endswith('.json'))}"
          f" | ink: {sum(1 for n in names if n.endswith('.ink'))}"
          f" | медиа: {sum(1 for n in names if n.endswith(('.jpg', '.png', '.jpeg', '.webp')))}")
    for w in warns:
        print('WARN ', w)
    for e in errors:
        print('ERROR', e)
    print('РЕЗУЛЬТАТ:', 'ОШИБОК: 0' if not errors else f'ОШИБОК: {len(errors)}')
    return 1 if errors else 0


if __name__ == '__main__':
    sys.exit(main())
