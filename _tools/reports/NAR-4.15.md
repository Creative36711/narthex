# NAR-4.15 — Возврат-6: D-01 и проверка двух runtime

- Дата: **2026-10-28**.
- Dispatch: `4076f0cf-5705-817f-9d40-f06c6c8f9a7a`.
- Run: `74656025-1172-4e42-882d-84d12edbcaae`.
- База: свежий `origin/main` = `67f9a720c6aa0f2a0123eaaadf75337c37dd53ce`; `HEAD` и merge-base совпали с ним, worktree до прогона был чистым.
- Ветка сессии: закреплённая Arena `arena/9a2f0673-narthex`.

## Ответ

**Замечание 6 закрыто.** `npm run lint` завершился **rc=0: 0 errors, 1505 warnings, 416 files**. Предупреждения не считаются долгом D-01; их число совпало с базой NAR-4.9 (1505), то есть роста нет. `npm run check:mission` завершился **rc=0**, сохранил базовые **55/55** смоуков, выполнил **12/12** mission steps с rc=0 и явно проверил оба runtime: **turn и realtime**, 5 seed на каждый (10/10 browser↔cf-play fingerprints совпали). `npx tsc -b` — **rc=0**.

## Среда и старт

- Машина: `e2b.local`, Intel(R) Xeon(R) Processor @ 2.60GHz, 2 logical CPU.
- ОС: Debian GNU/Linux 12 (bookworm), Linux `6.1.158+`, x86_64.
- Node `v22.22.3`, npm `10.9.8`; Oxlint `1.86.0`, TypeScript `6.0.3`.
- `npm ci --ignore-scripts` — rc=0, 70 пакетов из lock-файла; tracked dependency-файлы не менялись. npm audit сообщил одну moderate vulnerability.
- Начальное состояние: закреплённая ветка была ровно на свежем `origin/main`; переключения/создания другой ветки не было.

## `npm run lint`

Полная команда — `npm run lint`; package script — ровно `oxlint`, без quiet-флагов, дополнительных allow/deny, ignore-path или file exclusions. **rc=0; 1505 warnings; 0 errors; 416 файлов; 116 rules; 2 threads.** База NAR-4.9: 1505 warnings / 0 errors — фактический warning count не вырос.

Проверка области и настроек:

- `node_modules/.bin/oxlint --debug=files` — rc=0, 416 lint-target files. Среди них `public/ai/` — 2 (`campaign-audit.mjs`, `cf-play.mjs`), `_tools/` — 57, `src/player/` — 33. Значит, все три D-01 зоны попали в список реальных lint targets.
- `.oxlintrc.json` не задаёт ignore/exclude patterns; `.eslintignore` отсутствует. В `.gitignore` перечислены только generated/environment каталоги (`node_modules`, `dist`, `out`, `dist-ai` и др.), не D-01 зоны.
- `.oxlintrc.json` blob совпадает с `origin/main` (`bd60aac4a1a5642664c012a2b74ae75a49a9ce03`); lint script в `package.json` — `oxlint`. `scripts/check-mission.mts` также byte-identical main (`8ab8706171f9de3da9b8e115044e49463d17baa8`). Изменений правил/конфига/mission runner нет. Единственный существующий per-file override — `react/immutability: off` для `src/editor/DialogueBuilder.tsx`; это не исключение файла и до этой задачи совпадало с main.
- Code-only поиск `oxlint-disable` нашёл один существующий комментарий `src/editor/DialogueBuilder.tsx:267` (вне зон D-01); он был в исходном `origin/main` и не менялся. Новых suppressions, исключённых файлов и ослаблений нет.

Сырой хвост stdout `npm run lint`:

```text
  2733 |                   const id = e.target.value
  2734 |                   if (id) ((p.items ??= []).push({ item: id, quantity: 1 }), commit())
      :                           ^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^
 2735 |                 }}>
      `----
  help: Consider using this expression or removing it

  ! eslint(no-unused-expressions): Expected expression to be used
      ,-[src/editor/CampaignEditor.tsx:2795:29]
 2794 |                     const id = e.target.value
 2795 |                     if (id) (c.skills[id] = Math.min(floorOf(id) + 10, m.char_creation!.skill_cap ?? Number.MAX_SAFE_INTEGER), commit())
      :                             ^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^
 2796 |                   }}>
      `----
  help: Consider using this expression or removing it

Found 1505 warnings and 0 errors.
Finished in 911ms on 416 files with 116 rules using 2 threads.
```

Сырой лог прогона сохранён во временном `/tmp/nar415/lint.log`; он не входит в Git.

## `npm run check:mission`

Полная команда — `npm run check:mission`; rc=0. В mission summary **12/12** команд завершились rc=0. Вложенный `npm run smoke:mission` сохранил базовый счётчик **`SUMMARY 55/55 passed; rc=0`**, как в NAR-4.9.

В выводе явно перечислены два рантайма и обе стороны parity: Chromium turn executor и Chromium realtime executor сопоставляются с cf-play; 5 seed × 2 runtimes, повторы стабильны, **10/10** browser hashes совпали с cf-play, mismatches=0. Затем оба эталонных `cf-play check` (Ash и Adventure) завершились rc=0. Вложенный `check:guide` также проверил kit после распаковки: 6 команд, `explain=28`, эталон 10/8/6/21, 0/8, 5 смертей, покрытие 6/10. Временная упаковка создавалась самим check:guide и после проверки удалена.

Сырой хвост stdout `npm run check:mission`:

```text
Added NAR-4.6 second-runtime parity checks (Chromium vs cf-play Node; each repeated):
- Chromium turn executor: five seed cases against the cf-play turn executor
- Chromium realtime executor: five seed cases against the cf-play realtime executor

Mission check results
command                                                                     rc
tsc -b                                                                      0
npm run check:contracts                                                     0
npm run check:core-graph                                                    0
npm run check:guide                                                         0
npm run check:narrative-codes                                               0
npm run check:version                                                       0
npm run check:brand                                                         0
npm run smoke:core                                                          0
npm run smoke:mission (55 scripts)                                          0
npm run check:determinism (NAR-4.4 + NAR-4.6 browser/cf-play)               0
node public/ai/cf-play.mjs check public/campaigns/ash-of-caerden            0
node public/ai/cf-play.mjs check public/campaigns/ash-of-caerden-adventure  0
check:mission passed; rc=0
```

Ключевой raw fragment из вложенного smoke output:

```text
SUMMARY 55/55 passed; rc=0
```

Полный временный stdout: `/tmp/nar415/check-mission.log`.

## `npx tsc -b`

Полная команда — `npx tsc -b`; **rc=0**. stdout и stderr пусты. Команда выполнена отдельно после установки lock-зависимостей; `check:mission` также выполнил свой `tsc -b` с rc=0.

## Scope и итог

В tracked patch входят только этот отчёт и [решение NAR-4.15](../../docs/decisions/NAR-4.15.md). Lint config, правила, mission runner, suppressions, исходники и пороги не менялись. Фаза 4 **не начинается**.
