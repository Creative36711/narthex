# NAR-4.12 — Возврат-3: в `cf-play` нет ветвлений по рантайму

Дата: 2026-10-28
Dispatch: `4076f0cf-5705-8138-8599-e46837055c97`
Run: `66fc05f2-def1-4483-b187-648ff3d671c7`
Проверенная база: `origin/main` = `e7d2aca57556648cea764fd888cf0e37513e71bc`.

## Ответ

**Замечание 3 закрыто.** Полный AST-скан исполняемой обвязки `public/ai/cf-play.mjs` не нашёл ни одного `if`/тернарного/switch-ветвления, выбирающего `turn` против `realtime`; сравнений `kind` или `mode` с этими runtime-значениями также нет. `switch` по переменной `runtime` отсутствует. Единственный общий путь получает адаптер через `adapters[project.runtime]`, затем выполняет тот же цикл шагов и evaluator для каждого проекта. Легальные adapter/project selections перечислены ниже.

## Старт и среда

Перед работой выполнены `git fetch origin main`, проверка `git merge-base HEAD origin/main` и `git status --short`. Ветка сессии `arena/a861f794-narthex` была чистой и находилась ровно на свежем `origin/main`; общий предок совпал с `origin/main`. Ветка `nar/NAR-4.12` не создавалась и переключения не было: сессию закрепила Arena. Решение о ветке и PR зафиксировано тремя строками в [`docs/decisions/NAR-4.12.md`](../../docs/decisions/NAR-4.12.md).

- Машина: `e2b.local`.
- ОС: `Linux 6.1.158+ x86_64`.
- Node: `v22.22.3`; npm: `10.9.8`.
- Зависимости для TypeScript-проверки установлены `npm ci --ignore-scripts` (rc=0); lockfile не менялся.

## Полный скан обвязки

Область задаётся путями, а не подбором имён файлов: все tracked-файлы под `public/ai/cf-play.mjs` и `_tools/cf-play/**` получаются из `git ls-files`, затем каждый файл целиком разбирается JavaScript AST. На `if`, `?:` и `switch` проверяются условия/дискриминанты, включая сравнения `runtime`, `kind`, `mode` с `turn`/`realtime`; отдельно фиксируются широкие совпадения слова `runtime`, чтобы вручную отделить одноимённые поля состояния от выбора game runtime.

Полная команда скана (выполняется из корня репозитория):

```sh
node <<'NODE'
const fs = require('node:fs');
const cp = require('node:child_process');
const ts = require('typescript');
const files = cp.execFileSync('git', ['ls-files', '--', 'public/ai/cf-play.mjs', '_tools/cf-play/**'], { encoding: 'utf8' })
  .split(/\r?\n/).filter(Boolean).filter((file) => fs.existsSync(file));
console.log(`Tracked scan files (${files.length}): ${files.join(', ') || '(none)'}`);
console.log(`_tools/cf-play directory exists: ${fs.existsSync('_tools/cf-play')}`);
const equality = new Set([ts.SyntaxKind.EqualsEqualsToken, ts.SyntaxKind.EqualsEqualsEqualsToken, ts.SyntaxKind.ExclamationEqualsToken, ts.SyntaxKind.ExclamationEqualsEqualsToken]);
const results = { runtimeNamedComparisons: [], runtimeSwitches: [], kindModeTurnRealtimeComparisons: [], turnRealtimeControlBranches: [], parseDiagnostics: [] };
function containsName(node, expression) {
  let found = false;
  function walk(n) { if (ts.isIdentifier(n) && expression.test(n.text)) found = true; ts.forEachChild(n, walk); }
  walk(node); return found;
}
function hasTurnRealtimeToken(node) {
  let found = false;
  function walk(n) {
    if (ts.isStringLiteral(n) || ts.isNoSubstitutionTemplateLiteral(n)) {
      if (['turn', 'realtime'].includes(n.text.toLowerCase())) found = true;
    }
    if (ts.isIdentifier(n) && /(^|[_$])(turn|realtime)($|[_$])/i.test(n.text)) found = true;
    ts.forEachChild(n, walk);
  }
  walk(node); return found;
}
function visit(file, node, source) {
  if (ts.isBinaryExpression(node) && equality.has(node.operatorToken.kind)) {
    const line = source.getLineAndCharacterOfPosition(node.getStart(source)).line + 1;
    if (containsName(node, /^runtime$/i)) results.runtimeNamedComparisons.push(`${file}:${line}: ${node.getText(source)}`);
    if (containsName(node, /^(kind|mode)$/i) && hasTurnRealtimeToken(node)) results.kindModeTurnRealtimeComparisons.push(`${file}:${line}: ${node.getText(source)}`);
  }
  if (ts.isSwitchStatement(node) && containsName(node.expression, /^runtime$/i)) {
    results.runtimeSwitches.push(`${file}:${source.getLineAndCharacterOfPosition(node.getStart(source)).line + 1}: switch (${node.expression.getText(source)})`);
  }
  if (ts.isIfStatement(node) || ts.isConditionalExpression(node) || ts.isSwitchStatement(node)) {
    const expr = ts.isConditionalExpression(node) ? node.condition : node.expression;
    const parts = [expr];
    if (ts.isSwitchStatement(node)) for (const clause of node.caseBlock.clauses) if (ts.isCaseClause(clause)) parts.push(clause.expression);
    if (parts.some((part) => containsName(part, /^(runtime|kind|mode)$/i)) && parts.some(hasTurnRealtimeToken)) {
      results.turnRealtimeControlBranches.push(`${file}:${source.getLineAndCharacterOfPosition(node.getStart(source)).line + 1}: ${parts.map((part) => part.getText(source)).join(' | ')}`);
    }
  }
  ts.forEachChild(node, (child) => visit(file, child, source));
}
for (const file of files) {
  const source = ts.createSourceFile(file, fs.readFileSync(file, 'utf8'), ts.ScriptTarget.Latest, true, ts.ScriptKind.JS);
  results.parseDiagnostics.push(...(source.parseDiagnostics || []).map((d) => `${file}:${d.start ?? 0}: ${ts.flattenDiagnosticMessageText(d.messageText, ' ')}`));
  visit(file, source, source);
}
for (const [name, values] of Object.entries(results)) {
  console.log(`${name} (${values.length}):`);
  for (const value of values) console.log(`  ${value}`);
  if (!values.length) console.log('  (none)');
}
NODE
```

Полный stdout команды:

```text
Tracked scan files (1): public/ai/cf-play.mjs
_tools/cf-play directory exists: false
runtimeNamedComparisons (17):
  public/ai/cf-play.mjs:20054: runtime.phase !== "choice"
  public/ai/cf-play.mjs:20054: runtime.phase !== "buffering"
  public/ai/cf-play.mjs:20083: runtime.scene !== sceneId
  public/ai/cf-play.mjs:20087: runtime.pendingChoice !== null
  public/ai/cf-play.mjs:20089: current.choices?.[runtime.pendingChoice]?.next === fragmentId
  public/ai/cf-play.mjs:20095: runtime.fragment === fragmentId
  public/ai/cf-play.mjs:20095: runtime.pendingChoice === null
  public/ai/cf-play.mjs:20095: runtime.phase === "loading"
  public/ai/cf-play.mjs:20095: runtime.phase === "error"
  public/ai/cf-play.mjs:20102: runtime.scene !== sceneId
  public/ai/cf-play.mjs:20109: runtime.scene !== sceneId
  public/ai/cf-play.mjs:20109: runtime.fragment !== fragmentId
  public/ai/cf-play.mjs:20111: runtime.phase !== "playing"
  public/ai/cf-play.mjs:20132: runtime.phase === "choice"
  public/ai/cf-play.mjs:20132: runtime.phase === "buffering"
  public/ai/cf-play.mjs:20148: runtime.phase === "playing"
  public/ai/cf-play.mjs:20894: typeof raw.runtime === "string"
runtimeSwitches (0):
  (none)
kindModeTurnRealtimeComparisons (0):
  (none)
turnRealtimeControlBranches (0):
  (none)
parseDiagnostics (0):
  (none)
```

Ручная классификация всех 17 широких сравнений: строки `20054–20148` относятся к локальной переменной `runtime = state.fmv` (сцена/фрагмент/фаза FMV-плеера), а строка `20894` проверяет, что значение поля `raw.runtime` — строка. Это не сравнение turn/realtime и не выбор executor. Фактический список ветвлений по `turn`/`realtime` пуст: `runtimeSwitches=0`, `kindModeTurnRealtimeComparisons=0`, `turnRealtimeControlBranches=0`; ошибок разбора JS нет.

Дополнительный полный поиск всех точных слов `turn` / `realtime` в том же emitted bundle:

```text
$ rg -n -o --no-heading -w 'turn|realtime' public/ai/cf-play.mjs
1015:turn
1026:turn
1026:turn
1032:realtime
1040:turn
1041:realtime
11290:turn
18267:turn
19614:turn
20741:turn
21031:realtime
21155:realtime
22559:realtime
22562:turn
22570:turn
22583:realtime
22591:turn
22591:realtime
```

Совпадения — описание capabilities, сериализационная команда Ink `turn`, bundle-маркеры, pack/project metadata, подписи и adapter registry. Ни одно не является `if`/`switch`/тернарным условием. `_tools/cf-play/` на этой базе отсутствует и не содержит tracked-файлов; единственный tracked executable target скана — `public/ai/cf-play.mjs`.

## Легальные project/adapter selections (ADR 0002)

| Путь / строка | Наблюдение | Почему это не ветвление обвязки |
|---|---|---|
| `public/ai/cf-play.mjs:18262–18267`, `20931` | Narrative pack manifest задаёт `runtime: "turn"` для Ash; загрузчик передаёт resolved `manifest.runtime` в project record. | Runtime metadata из pack/project data, не условная ветвь. |
| `_tools/projects/realtime-wall/project.json:5` | Проект `realtime-wall-zone` задаёт `"runtime": "realtime"`; там же указан его world/route и `step_ms`. В manifest нет seed-поля. | Рантайм проекта задаётся данными, как разрешает ADR 0002. |
| `public/ai/cf-play.mjs:22561–22585` | `cmdCycles` строит map адаптеров: `turn: async (...) => ...`, `realtime: createRealtimeProjectSetup`; затем вызывает один `runCycleProjects(projects, adapters)`. | Это таблица адаптеров, не ветвление в общем executor loop. |
| `public/ai/cf-play.mjs:20971–20974` | Общий путь делает `const adapter = adapters[project.runtime]`, проверяет только отсутствие адаптера и вызывает его. | Выбор по ключу данных; нет сравнения `project.runtime === ...`. |
| `public/ai/cf-play.mjs:22563` | Turn adapter для Ash задаёт seed `NAR-4.5-cycle-check`. | Seed фиксирует конфигурация adapter для соответствующего project cycle. |
| `public/ai/cf-play.mjs:21301–21316` (seed: `21311`) | Realtime adapter создаёт setup из project manifest/world/route; seed задаётся как `${project.id}:NAR-4.5`. | Seed и runtime принадлежат setup проекта/адаптера, не условной ветви общего цикла. |

Поддерживающее правило: `docs/contracts/adr/0002-two-runtimes.md:24–25` различает `turn` и `realtime`; строки `55–56` запрещают смешивать их внутри одного проекта. Для Ash runtime приходит из narrative pack и подключается тем же adapter registry; для realtime reference поле runtime расположено в указанном `_tools/projects` manifest.

## Контрольный `cf-play cycles --json`

Полная команда `node public/ai/cf-play.mjs cycles --json` вернула rc=0. Итоговые fingerprints совпали с заданными в NAR-4.10: Ash `3e183cbc9ce9a358`, realtime-wall-zone `c585e2c26d21ed7e`. Полный stdout:

```json
{
  "projects": [
    {
      "id": "ash-of-caerden",
      "title": "[DEV] Пепел Каэрдена — эталон narrative (полигон смоуков)",
      "runtime": "turn",
      "stepCalls": 1,
      "clockBefore": 28800000,
      "clockAfter": 32400000,
      "initialFingerprint": "ed2cd114d72ab278",
      "finalFingerprint": "3e183cbc9ce9a358",
      "summary": {
        "tick": 9,
        "scene": "scene_gates_front",
        "location": "loc_gates"
      },
      "assertions": [
        {
          "name": "the turn executor advances exactly one campaign tick",
          "path": "tick",
          "op": "equals",
          "expected": 9,
          "ok": true,
          "actual": 9,
          "previous": 8
        }
      ],
      "ok": true
    },
    {
      "id": "realtime-wall-zone",
      "title": "Realtime wall and zone probe",
      "runtime": "realtime",
      "stepCalls": 11,
      "clockBefore": 0,
      "clockAfter": 220,
      "initialFingerprint": "9910f683b96eba27",
      "finalFingerprint": "c585e2c26d21ed7e",
      "summary": {
        "position.x": 6,
        "position.y": 10,
        "max_x": 12,
        "wall_contact": true,
        "wall_contacts": 1,
        "zone_trigger_count": 1,
        "triggered_zones.checkpoint": true,
        "world_state": "checkpoint-activated"
      },
      "assertions": [
        {
          "name": "movement input changes the player position",
          "path": "position.x",
          "op": "changed",
          "ok": true,
          "actual": 6,
          "previous": 2
        },
        {
          "name": "the wall was contacted",
          "path": "wall_contacts",
          "op": "greater_than",
          "expected": 0,
          "ok": true,
          "actual": 1,
          "previous": 0
        },
        {
          "name": "the player never passes through the wall",
          "path": "max_x",
          "op": "less_than_or_equal",
          "expected": 12,
          "ok": true,
          "actual": 12,
          "previous": 2
        },
        {
          "name": "the checkpoint changes state exactly once",
          "path": "zone_trigger_count",
          "op": "equals",
          "expected": 1,
          "ok": true,
          "actual": 1,
          "previous": 0
        },
        {
          "name": "the checkpoint state is recorded",
          "path": "triggered_zones.checkpoint",
          "op": "equals",
          "expected": true,
          "ok": true,
          "actual": true,
          "previous": null
        },
        {
          "name": "the zone's state transition is visible",
          "path": "world_state",
          "op": "equals",
          "expected": "checkpoint-activated",
          "ok": true,
          "actual": "checkpoint-activated",
          "previous": null
        }
      ],
      "ok": true
    }
  ],
  "configuredRuntimes": [
    "realtime",
    "turn"
  ],
  "usedRuntimes": [
    "realtime",
    "turn"
  ],
  "missingRuntimes": [],
  "ok": true
}
```

## Контрольный `cf-play check`, kit и TypeScript

- `node public/ai/cf-play.mjs check public/campaigns/ash-of-caerden --out /tmp/nar412-check-ash` — rc=0; 10 сцен, 8 локаций, 6 диалогов, 21 Ink knot, 0 errors, 8 прежних `flag_written_never_read` warnings, пять seed'ов → death, coverage 6/10.
- `npx tsc -b` — rc=0, stdout/stderr пустые.
- `npm run pack:ai-kit` — rc=0; 110 файлов / 2.83 MB. ZIP integrity test прошёл; архив распакован во временный каталог (122 ZIP entries, включая directory entries); `cf-play check` из распакованного `__chronicle_ai__/examples/narrative` — rc=0 с теми же 10/8/6/21, 0 errors / 8 warnings, пятью seed'ами → death и coverage 6/10. ZIP и unpack directory не добавлены в Git.
- `npm run check:decisions` — rc=0.

Kit был проверен командной цепочкой: `npm run pack:ai-kit`, `python3 - "$archive" "$tmpdir"` с `zipfile.ZipFile(...).testzip()` и `extractall()`, затем `node "$tmpdir/__chronicle_ai__/cf-play.mjs" check "$tmpdir/__chronicle_ai__/examples/narrative" --out /tmp/nar412-kit-check`.

## Итоговая приёмка

| Критерий | Результат |
|---|---|
| Скан полного tracked scope обвязки | 0 ветвлений runtime `turn`/`realtime`; AST parse diagnostics=0; `_tools/cf-play/` не существует на этой базе. |
| Adapter/project exceptions | Зафиксированы с путями/строками; project runtime/seed остаются данными и конфигурацией adapter. |
| `node public/ai/cf-play.mjs cycles --json` | rc=0; Ash `3e183cbc9ce9a358`; realtime-wall-zone `c585e2c26d21ed7e`. |
| `npx tsc -b` | rc=0. |
| Reference Ash check / unpacked kit check | Оба rc=0; эталонные числа сохранены. |

Допущение: критерий карточки о merged PR конкретнее общей оговорки о PR для docs-only evidence, поэтому отчёт и решение передаются через PR в main; сканируемая обвязка остаётся неизменной.
