# STAB-1.34 — проверка принятого исключения для `.github/workflows/golden.yml` из PR #192

## Проверенная точка и история

Проверенный SHA `main`: `fa5152f867556720228d8a1822c968d5ab73c27c`. При проверке `HEAD` и `origin/main` совпадали; `git merge-base HEAD origin/main` вернул этот SHA. Клон shallow (`git rev-parse --is-shallow-repository` → `true`), но общая история с `main` подтверждена merge-base; начальный `git status --short` был пуст.

PR #192: base `8a36153957bab63356c2906cc2c8d1aa3291c274`, head `c78bb16ea62d344e7d6ac5f8ead3025923b22210`, merge SHA `fdc3246a6ede8fadb3e5cadeb13ec57d6b5370ae` (2026-10-31). Его список файлов включал `.github/workflows/golden.yml`, `docs/decisions/STAB-1.27.md` и `scripts/visual/playthrough.mjs`. Согласование STAB-1.34 распространяется только на точный diff `golden.yml`; изменение `playthrough.mjs` в это решение не входит.

## Полный diff PR #192: base → head

Команда:

```text
git diff 8a36153957bab63356c2906cc2c8d1aa3291c274..c78bb16ea62d344e7d6ac5f8ead3025923b22210 -- .github/workflows/golden.yml
```

Полный вывод:

```diff
diff --git a/.github/workflows/golden.yml b/.github/workflows/golden.yml
index dfb072b..f92b877 100644
--- a/.github/workflows/golden.yml
+++ b/.github/workflows/golden.yml
@@ -20,6 +20,7 @@ on:
       - 'scripts/playkit/**'
       - 'scripts/pack-ai-kit.mts'
       - 'scripts/visual/local-browser.mjs'
+      - 'scripts/visual/playthrough.mjs'
   push:
     branches: [main]
     paths:
@@ -39,6 +40,7 @@ on:
       - 'scripts/playkit/**'
       - 'scripts/pack-ai-kit.mts'
       - 'scripts/visual/local-browser.mjs'
+      - 'scripts/visual/playthrough.mjs'
   workflow_dispatch:

 jobs:
@@ -77,6 +79,40 @@ jobs:
       - name: Prove cf-play rejects a warning-only fixture
         run: npm run cf-play:negative

+      - name: Publish GOLD-1.15 soak boundaries
+        if: always()
+        run: |
+          node --input-type=module <<'NODE'
+          import { appendFileSync, existsSync, readFileSync } from 'node:fs'
+
+          const logPath = '_tools/reports/GOLD-1.15.log'
+          if (!existsSync(logPath)) {
+            console.log('::warning title=GOLD-1.15 soak boundaries::timeline log is missing')
+            process.exit(0)
+          }
+
+          const records = readFileSync(logPath, 'utf8')
+            .split(/\r?\n/)
+            .filter(Boolean)
+            .map((line) => JSON.parse(line))
+          const soakRunId = records.filter((record) => record.task === 'GOLD-1.15' && record.event === 'run_start').at(-1)?.runId
+          const last = (event) => records.filter((record) => record.task === 'GOLD-1.15' && record.runId === soakRunId && record.event === event).at(-1)
+          const started = last('session_start')
+          const ended = last('active_session_end')
+          const completed = last('run_complete')
+          if (!soakRunId || !started?.at || !ended?.at || !completed) {
+            console.log(`::warning title=GOLD-1.15 soak boundaries::incomplete timeline for run ${soakRunId ?? 'unknown'} (session_start=${Boolean(started)} active_session_end=${Boolean(ended)} run_complete=${Boolean(completed)})`)
+            process.exit(0)
+          }
+
+          const wallSeconds = (Date.parse(ended.at) - Date.parse(started.at)) / 1000
+          const detail = `start=${started.at} end=${ended.at} wallSeconds=${wallSeconds.toFixed(1)} activeDurationSeconds=${completed.activeDurationSeconds} verdict=${completed.verdict}`
+          console.log(`::notice title=GOLD-1.15 actual soak boundaries::${detail}`)
+          if (process.env.GITHUB_STEP_SUMMARY) {
+            appendFileSync(process.env.GITHUB_STEP_SUMMARY, `### GOLD-1.15 actual soak boundaries\n\n- ${detail}\n`)
+          }
+          NODE
+
       - name: Upload GOLD-1.6 evidence
         if: always()
         uses: actions/upload-artifact@v4
```

The additions expand golden workflow path triggers to changes in `scripts/visual/playthrough.mjs` and add a publication step that reads `_tools/reports/GOLD-1.15.log`. Missing or incomplete logs produce a warning and `process.exit(0)`; a JSON parse error can still fail the job. This step reports timestamps/duration from the log; it does not replace the pre-existing checks or the one-hour soak and does not itself prove that a full soak completed.

The complete diff has additions only and no removed lines. In particular, it shows no modification to existing checks, thresholds, pin, timeouts, or existing error handling.

## Сравнение с baseline `297eaba6`

На момент команды `HEAD` был `fa5152f867556720228d8a1822c968d5ab73c27c`.

Команда:

```text
git diff 297eaba6833ad13bab52eb93a205046fed3f0cce..HEAD -- .github/workflows/golden.yml
```

Полный вывод:

```diff
diff --git a/.github/workflows/golden.yml b/.github/workflows/golden.yml
index dfb072b..f92b877 100644
--- a/.github/workflows/golden.yml
+++ b/.github/workflows/golden.yml
@@ -20,6 +20,7 @@ on:
       - 'scripts/playkit/**'
       - 'scripts/pack-ai-kit.mts'
       - 'scripts/visual/local-browser.mjs'
+      - 'scripts/visual/playthrough.mjs'
   push:
     branches: [main]
     paths:
@@ -39,6 +40,7 @@ on:
       - 'scripts/playkit/**'
       - 'scripts/pack-ai-kit.mts'
       - 'scripts/visual/local-browser.mjs'
+      - 'scripts/visual/playthrough.mjs'
   workflow_dispatch:

 jobs:
@@ -77,6 +79,40 @@ jobs:
       - name: Prove cf-play rejects a warning-only fixture
         run: npm run cf-play:negative

+      - name: Publish GOLD-1.15 soak boundaries
+        if: always()
+        run: |
+          node --input-type=module <<'NODE'
+          import { appendFileSync, existsSync, readFileSync } from 'node:fs'
+
+          const logPath = '_tools/reports/GOLD-1.15.log'
+          if (!existsSync(logPath)) {
+            console.log('::warning title=GOLD-1.15 soak boundaries::timeline log is missing')
+            process.exit(0)
+          }
+
+          const records = readFileSync(logPath, 'utf8')
+            .split(/\r?\n/)
+            .filter(Boolean)
+            .map((line) => JSON.parse(line))
+          const soakRunId = records.filter((record) => record.task === 'GOLD-1.15' && record.event === 'run_start').at(-1)?.runId
+          const last = (event) => records.filter((record) => record.task === 'GOLD-1.15' && record.runId === soakRunId && record.event === event).at(-1)
+          const started = last('session_start')
+          const ended = last('active_session_end')
+          const completed = last('run_complete')
+          if (!soakRunId || !started?.at || !ended?.at || !completed) {
+            console.log(`::warning title=GOLD-1.15 soak boundaries::incomplete timeline for run ${soakRunId ?? 'unknown'} (session_start=${Boolean(started)} active_session_end=${Boolean(ended)} run_complete=${Boolean(completed)})`)
+            process.exit(0)
+          }
+
+          const wallSeconds = (Date.parse(ended.at) - Date.parse(started.at)) / 1000
+          const detail = `start=${started.at} end=${ended.at} wallSeconds=${wallSeconds.toFixed(1)} activeDurationSeconds=${completed.activeDurationSeconds} verdict=${completed.verdict}`
+          console.log(`::notice title=GOLD-1.15 actual soak boundaries::${detail}`)
+          if (process.env.GITHUB_STEP_SUMMARY) {
+            appendFileSync(process.env.GITHUB_STEP_SUMMARY, `### GOLD-1.15 actual soak boundaries\n\n- ${detail}\n`)
+          }
+          NODE
+
       - name: Upload GOLD-1.6 evidence
         if: always()
         uses: actions/upload-artifact@v4
```

Сравнение complete diff-ов `8a361539..c78bb16` и `297eaba6..fa5152f` вернуло `cmp=0`: их выводы идентичны. Объект `golden.yml` у base `8a361539` и baseline `297eaba6` также одинаков: `dfb072bc353ca5c084268582c3316ec536f7e2a3`.

## Актуальный `golden.yml` равен head PR #192

Проверенный SHA: `fa5152f867556720228d8a1822c968d5ab73c27c`.

```text
$ git diff c78bb16ea62d344e7d6ac5f8ead3025923b22210..fa5152f867556720228d8a1822c968d5ab73c -- .github/workflows/golden.yml
# пустой вывод; rc=0

$ git rev-parse c78bb16ea62d344e7d6ac5f8ead3025923b22210:.github/workflows/golden.yml
f92b877be0f7ff637b2003668685e452887d9253
$ git rev-parse fa5152f867556720228d8a1822c968d5ab73c:.github/workflows/golden.yml
f92b877be0f7ff637b2003668685e452887d9253
```

Следовательно, на проверенном SHA текущий `.github/workflows/golden.yml` побайтно совпадает с версией head PR #192. Любое отличие означало бы FAIL; в этой карточке сам workflow-файл не редактируется.

## Границы карточки

§4 и bundle SHA-256 `0298805c8c6c038155500fc4dd7b67fc0f0f51c5ead761dea32eb476ee2ca9b8` этой карточкой не пересматривались. PR STAB-1.34 содержит только `docs/decisions/STAB-1.34.md` и этот отчёт; `.github/workflows/golden.yml`, `scripts/visual/playthrough.mjs` и другие файлы не входят в его diff.
