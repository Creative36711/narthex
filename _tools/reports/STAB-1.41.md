# STAB-1.41 — отвязать ScriptCat probes от номера релиза

Дата: 2026-11-01. Dispatch: `40b6f0cf-5705-8100-9319-dee14559af2c`; run: `cf7426b4-4ee5-4237-955d-51d60c4bde05`.

## База и область

- Целевая ветка — закреплённая `arena/509b583e-narthex`; PR [#201](https://github.com/Creative36711/narthex/pull/201) открыт в `main`.
- Перед правками выполнены `git fetch origin main`, `git merge-base HEAD origin/main` и `git status --short`. Checkout был shallow, но общая история есть: merge-base и исходный `origin/main` совпадали с `bffc32e492f4577607bb9e5d9f1b1e9e0f8892bd` (merge STAB-1.40). Никаких удалений файлов из-за разрыва истории нет.
- Ровно 37 существующих проб, перечисленных в PR #178, изменены; перечень совпал с API PR #178, проба не добавлена/удалена/переименована. Общий набор ScriptCat остался 71 файл: новый общий helper расположен в `_tools/ScriptCat/version-oracle.mjs`, вне каталога `tests`.
- Изменён только этот helper и 37 тестов в `_tools/ScriptCat/tests/**`; отчёт находится в `_tools/reports/**`. `_tools/ScriptCat/narthex.user.js`, `scripts/**`, `public/ai/**`, метаданные релиза и рантайм не менялись. Контракт версии не менялся, поэтому ADR не создавался.

## Оракул версии

В `_tools/ScriptCat/version-oracle.mjs` каждый probe вызывает `assertUserscriptVersionContract(src)`. Helper отдельно читает одно поле `@version` и одну строку fallback `const SCRIPT_VERSION = (typeof GM_info !== "undefined" && GM_info?.script?.version) || "…"`; проверяет, что источники расположены в разных строках, оба значения — plain MAJOR.MINOR.PATCH, и значения равны. Возвращаемая match-группа даёт тестам динамическое значение для диагностик; фиксированного релизного числа в oracle нет. Параметр независимого `expectedVersion` используется только в одноразовой временной негативной копии, не в main-пробах.

На исходном `narthex.user.js` значения прочитаны и совпали: metadata `1.4.90` на строке 4; runtime fallback `1.4.90` на строке 347. Два литерала остаются в проверяемом userscript и явно не считаются литералами проб.

## Полный перечень 37 проб и независимый источник сравнения

Для каждого файла ниже helper читает metadata как источник версии и независимо читает runtime fallback как второе поле того же артефакта; проверка не закрепляет номер релиза. Все строки — прогоны каждого исходного файла: текущий артефакт, временная копия с согласованным bump +0.0.1, временная копия с согласованным bump до `9.9.9`.

| Probe | Ожидаемое поле | Независимое поле / правило | Текущая версия | Bump +0.0.1 | Bump 9.9.9 |
|---|---|---|---:|---:|---:|
| `_tools/ScriptCat/tests/narthex-adr-handoff-smoke.mjs` | `narthex.user.js` @version (line 4) | `SCRIPT_VERSION` runtime fallback (line 347), separately parsed; strict SemVer + equality | rc=0 | rc=0 | rc=0 |
| `_tools/ScriptCat/tests/narthex-agent-poll-smoke.mjs` | `narthex.user.js` @version (line 4) | `SCRIPT_VERSION` runtime fallback (line 347), separately parsed; strict SemVer + equality | rc=0 | rc=0 | rc=0 |
| `_tools/ScriptCat/tests/narthex-answer-smoke.mjs` | `narthex.user.js` @version (line 4) | `SCRIPT_VERSION` runtime fallback (line 347), separately parsed; strict SemVer + equality | rc=0 | rc=0 | rc=0 |
| `_tools/ScriptCat/tests/narthex-blocked-reason-smoke.mjs` | `narthex.user.js` @version (line 4) | `SCRIPT_VERSION` runtime fallback (line 347), separately parsed; strict SemVer + equality | rc=0 | rc=0 | rc=0 |
| `_tools/ScriptCat/tests/narthex-closed-state-smoke.mjs` | `narthex.user.js` @version (line 4) | `SCRIPT_VERSION` runtime fallback (line 347), separately parsed; strict SemVer + equality | rc=0 | rc=0 | rc=0 |
| `_tools/ScriptCat/tests/narthex-collapse-smoke.mjs` | `narthex.user.js` @version (line 4) | `SCRIPT_VERSION` runtime fallback (line 347), separately parsed; strict SemVer + equality | rc=0 | rc=0 | rc=0 |
| `_tools/ScriptCat/tests/narthex-coordinator-authority-smoke.mjs` | `narthex.user.js` @version (line 4) | `SCRIPT_VERSION` runtime fallback (line 347), separately parsed; strict SemVer + equality | rc=0 | rc=0 | rc=0 |
| `_tools/ScriptCat/tests/narthex-coordinator-marker-smoke.mjs` | `narthex.user.js` @version (line 4) | `SCRIPT_VERSION` runtime fallback (line 347), separately parsed; strict SemVer + equality | rc=0 | rc=0 | rc=0 |
| `_tools/ScriptCat/tests/narthex-decisions-smoke.mjs` | `narthex.user.js` @version (line 4) | `SCRIPT_VERSION` runtime fallback (line 347), separately parsed; strict SemVer + equality | rc=0 | rc=0 | rc=0 |
| `_tools/ScriptCat/tests/narthex-error-pause-smoke.mjs` | `narthex.user.js` @version (line 4) | `SCRIPT_VERSION` runtime fallback (line 347), separately parsed; strict SemVer + equality | rc=0 | rc=0 | rc=0 |
| `_tools/ScriptCat/tests/narthex-fresh-branch-smoke.mjs` | `narthex.user.js` @version (line 4) | `SCRIPT_VERSION` runtime fallback (line 347), separately parsed; strict SemVer + equality | rc=0 | rc=0 | rc=0 |
| `_tools/ScriptCat/tests/narthex-ghost-handoff-smoke.mjs` | `narthex.user.js` @version (line 4) | `SCRIPT_VERSION` runtime fallback (line 347), separately parsed; strict SemVer + equality | rc=0 | rc=0 | rc=0 |
| `_tools/ScriptCat/tests/narthex-github-recover-smoke.mjs` | `narthex.user.js` @version (line 4) | `SCRIPT_VERSION` runtime fallback (line 347), separately parsed; strict SemVer + equality | rc=0 | rc=0 | rc=0 |
| `_tools/ScriptCat/tests/narthex-journal-recover-smoke.mjs` | `narthex.user.js` @version (line 4) | `SCRIPT_VERSION` runtime fallback (line 347), separately parsed; strict SemVer + equality | rc=0 | rc=0 | rc=0 |
| `_tools/ScriptCat/tests/narthex-link-probe-smoke.mjs` | `narthex.user.js` @version (line 4) | `SCRIPT_VERSION` runtime fallback (line 347), separately parsed; strict SemVer + equality | rc=0 | rc=0 | rc=0 |
| `_tools/ScriptCat/tests/narthex-log-answer-smoke.mjs` | `narthex.user.js` @version (line 4) | `SCRIPT_VERSION` runtime fallback (line 347), separately parsed; strict SemVer + equality | rc=0 | rc=0 | rc=0 |
| `_tools/ScriptCat/tests/narthex-marker-id-smoke.mjs` | `narthex.user.js` @version (line 4) | `SCRIPT_VERSION` runtime fallback (line 347), separately parsed; strict SemVer + equality | rc=0 | rc=0 | rc=0 |
| `_tools/ScriptCat/tests/narthex-merge-verify-smoke.mjs` | `narthex.user.js` @version (line 4) | `SCRIPT_VERSION` runtime fallback (line 347), separately parsed; strict SemVer + equality | rc=0 | rc=0 | rc=0 |
| `_tools/ScriptCat/tests/narthex-mission-match-smoke.mjs` | `narthex.user.js` @version (line 4) | `SCRIPT_VERSION` runtime fallback (line 347), separately parsed; strict SemVer + equality | rc=0 | rc=0 | rc=0 |
| `_tools/ScriptCat/tests/narthex-new-mission-smoke.mjs` | `narthex.user.js` @version (line 4) | `SCRIPT_VERSION` runtime fallback (line 347), separately parsed; strict SemVer + equality | rc=0 | rc=0 | rc=0 |
| `_tools/ScriptCat/tests/narthex-no-pr-smoke.mjs` | `narthex.user.js` @version (line 4) | `SCRIPT_VERSION` runtime fallback (line 347), separately parsed; strict SemVer + equality | rc=0 | rc=0 | rc=0 |
| `_tools/ScriptCat/tests/narthex-notion-retry-smoke.mjs` | `narthex.user.js` @version (line 4) | `SCRIPT_VERSION` runtime fallback (line 347), separately parsed; strict SemVer + equality | rc=0 | rc=0 | rc=0 |
| `_tools/ScriptCat/tests/narthex-ntfy-transport-smoke.mjs` | `narthex.user.js` @version (line 4) | `SCRIPT_VERSION` runtime fallback (line 347), separately parsed; strict SemVer + equality | rc=0 | rc=0 | rc=0 |
| `_tools/ScriptCat/tests/narthex-orphan-running-smoke.mjs` | `narthex.user.js` @version (line 4) | `SCRIPT_VERSION` runtime fallback (line 347), separately parsed; strict SemVer + equality | rc=0 | rc=0 | rc=0 |
| `_tools/ScriptCat/tests/narthex-question-badge-smoke.mjs` | `narthex.user.js` @version (line 4) | `SCRIPT_VERSION` runtime fallback (line 347), separately parsed; strict SemVer + equality | rc=0 | rc=0 | rc=0 |
| `_tools/ScriptCat/tests/narthex-question-null-smoke.mjs` | `narthex.user.js` @version (line 4) | `SCRIPT_VERSION` runtime fallback (line 347), separately parsed; strict SemVer + equality | rc=0 | rc=0 | rc=0 |
| `_tools/ScriptCat/tests/narthex-question-retry-smoke.mjs` | `narthex.user.js` @version (line 4) | `SCRIPT_VERSION` runtime fallback (line 347), separately parsed; strict SemVer + equality | rc=0 | rc=0 | rc=0 |
| `_tools/ScriptCat/tests/narthex-questions-smoke.mjs` | `narthex.user.js` @version (line 4) | `SCRIPT_VERSION` runtime fallback (line 347), separately parsed; strict SemVer + equality | rc=0 | rc=0 | rc=0 |
| `_tools/ScriptCat/tests/narthex-return-epoch-smoke.mjs` | `narthex.user.js` @version (line 4) | `SCRIPT_VERSION` runtime fallback (line 347), separately parsed; strict SemVer + equality | rc=0 | rc=0 | rc=0 |
| `_tools/ScriptCat/tests/narthex-review-gate-smoke.mjs` | `narthex.user.js` @version (line 4) | `SCRIPT_VERSION` runtime fallback (line 347), separately parsed; strict SemVer + equality | rc=0 | rc=0 | rc=0 |
| `_tools/ScriptCat/tests/narthex-rework-return-smoke.mjs` | `narthex.user.js` @version (line 4) | `SCRIPT_VERSION` runtime fallback (line 347), separately parsed; strict SemVer + equality | rc=0 | rc=0 | rc=0 |
| `_tools/ScriptCat/tests/narthex-rework-smoke.mjs` | `narthex.user.js` @version (line 4) | `SCRIPT_VERSION` runtime fallback (line 347), separately parsed; strict SemVer + equality | rc=0 | rc=0 | rc=0 |
| `_tools/ScriptCat/tests/narthex-rich-text-smoke.mjs` | `narthex.user.js` @version (line 4) | `SCRIPT_VERSION` runtime fallback (line 347), separately parsed; strict SemVer + equality | rc=0 | rc=0 | rc=0 |
| `_tools/ScriptCat/tests/narthex-roles-cache-smoke.mjs` | `narthex.user.js` @version (line 4) | `SCRIPT_VERSION` runtime fallback (line 347), separately parsed; strict SemVer + equality | rc=0 | rc=0 | rc=0 |
| `_tools/ScriptCat/tests/narthex-send-repeat-smoke.mjs` | `narthex.user.js` @version (line 4) | `SCRIPT_VERSION` runtime fallback (line 347), separately parsed; strict SemVer + equality | rc=0 | rc=0 | rc=0 |
| `_tools/ScriptCat/tests/narthex-send-truth-smoke.mjs` | `narthex.user.js` @version (line 4) | `SCRIPT_VERSION` runtime fallback (line 347), separately parsed; strict SemVer + equality | rc=0 | rc=0 | rc=0 |
| `_tools/ScriptCat/tests/narthex-step-smoke.mjs` | `narthex.user.js` @version (line 4) | `SCRIPT_VERSION` runtime fallback (line 347), separately parsed; strict SemVer + equality | rc=0 | rc=0 | rc=0 |

**Результаты матрицы:** текущая версия — 37/37 rc=0; согласованный bump +0.0.1 — 37/37 rc=0; произвольный bump `9.9.9` — 37/37 rc=0. Копии создавались в `/tmp` и удалены; сами пробы в bump-прогонах не менялись.

### Diff временных копий артефакта

Для +0.0.1 изменены только два version-поля в копии `narthex.user.js`:

```diff
-// @version      1.4.90
+// @version      1.4.91
-    (typeof GM_info !== "undefined" && GM_info?.script?.version) || "1.4.90";
+    (typeof GM_info !== "undefined" && GM_info?.script?.version) || "1.4.91";
```

Для произвольной версии diff того же артефакта, также только две строки:

```diff
-// @version      1.4.90
+// @version      9.9.9
-    (typeof GM_info !== "undefined" && GM_info?.script?.version) || "1.4.90";
+    (typeof GM_info !== "undefined" && GM_info?.script?.version) || "9.9.9";
```

## Негативные контроли

- **Metadata/runtime mismatch.** Временная копия меняла только metadata на следующий patch, оставляя fallback прежним. Вердикт: rc=1; `version mismatch: @version metadata at line 4 (1.4.91) differs from SCRIPT_VERSION runtime fallback at line 347 (1.4.90)`.
- **Самоссылка.** `narthex-answer-smoke.mjs` показывает, что чтение @version как ожидаемого и наблюдаемого значения из одного поля ложно принимает замену; `assertIndependentVersionSources('@version', '@version')` отклоняет этот источник, а сравнение с runtime fallback ловит metadata-only divergence.
- **Несовместимый формат.** Fixture с `@version incompatible` даёт ожидаемый отказ: `narthex.user.js @version metadata at line 4 must be plain MAJOR.MINOR.PATCH`. Остальные поведенческие assertions в answer smoke сохранены.
- **Независимое ожидаемое значение.** В одноразовой копии только `narthex-log-answer-smoke.mjs` expected был намеренно смещён на patch, artifact оставлен текущим: этот probe rc=1 с `independent expected version 1.4.91 differs from @version metadata at line 4 (1.4.90)`; остальные 36 неизменённых проб — 36/36 rc=0.

### Несовпадение статуса одной пробы в карточке и на исходном main

До любых изменений отдельный запуск `node _tools/ScriptCat/tests/narthex-log-answer-smoke.mjs` на исходном SHA завершился rc=0; после изменения файл также завершился rc=0 и полный набор ScriptCat прошёл 71/71. Это расходится с формулировками карточки «по-прежнему FAIL». Чтобы не подделывать красный результат и не менять поведенческий оракул, штатную пробу не переведено в FAIL; отдельно показан требуемый rc=1 negative copy с неверным expected. В таблице выше указан фактически наблюдённый rc=0, не утверждается, что базовая проба красная.

## Поиск литералов и сохранность набора

`grep -rnE '1\.4\.9[01]' _tools/ScriptCat/tests scripts` дал **0 совпадающих строк** (grep rc=1 из-за отсутствия совпадений). Поиск в разрешённом артефакте отдельно находит только строки 4 и 347 `_tools/ScriptCat/narthex.user.js`. Исторические версии других функций, не относящиеся к release pin, не редактировались.

- ScriptCat tests: 71 файла до и после; полный индивидуальный прогон — **71/71 rc=0**.
- Все 37 путей совпадают с перечнем PR #178; в этих тестах убраны literal regex pins, номера для сообщений считываются динамически.
- Порогов, seed, числа повторов, parity, кодов возврата и состава smoke-наборов не меняли. Ни одна ранее падавшая проба не стала зелёной: все 37 были rc=0 на исходном main до изменений.

## Остальные гейты

| Команда / проверка | Результат |
|---|---|
| `npm run check:mission` | rc=0; включая typecheck, contracts, core graph, guide, version/brand, 55 mission smokes, determinism, browser/cf-play parity 10/10, strict-warning и negative cf-play. |
| `npm run check:audit-bundle` | rc=0; source/build/published bundle byte-identical, 1,006,226 bytes, SHA-256 `0298805c8c6c038155500fc4dd7b67fc0f0f51c5ead761dea32eb476ee2ca9b8`. |
| `npm run cf-play:negative` | Команда rc=0; source, bundle и реально распакованный AI-kit каждый дают ожидаемый check rc=1, verdict failed, 0 errors, ровно 1 warning. |
| `npm run check:strict-warning` | rc=0; expected warning results и positive controls одинаковы для source, bundle и распакованного kit. |
| `npm run check:guide` | rc=0; шесть документированных проверок в исходнике, bundle и распакованном kit. |
| `npm run smoke:mission` | 55/55, rc=0; прежний опциональный functional cutout-тест пропущен из-за отсутствия Pillow, пороги не менялись. |
| `npm run lint` | rc=0, 0 errors; 1,533 repository-wide warnings. |
| `git diff --check` | rc=0. |

## Допущение / откат

неясно: карточка требует, чтобы штатный `narthex-log-answer-smoke` уже был FAIL, однако предоставленный main SHA до правок воспроизводимо возвращает rc=0.
решил: не создавать искусственную красную точку; сохранять текущий поведенческий результат и показать отдельный expected-mismatch negative copy с единственным rc=1.
откат: удалить общий helper и вернуть 37 исходных version-проверок; userscript и все oracle-пороги останутся нетронуты.
