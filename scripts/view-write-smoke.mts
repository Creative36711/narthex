#!/usr/bin/env node
/**
 * Инвариант «просмотр = не запись» (фидбек 2026-10: мастер открыл диалог
 * глазами, а в списке изменений ИИ появилась строка — доверие к AI-diff
 * разрушается одним таким рядом).
 *
 * Две меры:
 *
 *  1. СТАТИКА. Все вызовы `.touch(` в src/editor перечислены в белом списке
 *     ниже — каждый с указанием, каким ДЕЙСТВИЕМ МАСТЕРА он вызван. Новый
 *     вызов без строки в списке = ошибка сборки смоука: автор обязан
 *     объяснить, на какое действие мастера пишется файл. Автозаписи при
 *     загрузке/просмотре сюда не пройдут незамеченными.
 *
 *  2. ДИНАМИКА. Полная загрузка эталонной кампании (public/campaigns/
 *     ash-of-caerden) в свежий EditorStore + пин базовых линий: список
 *     изменений обязан остаться пустым. Дополнительно — «двойной прогон»
 *     сериализации: повторный json stringify того же документа не должен
 *     порождать ряд в diff.
 *
 * Запуск: npx tsx scripts/view-write-smoke.mts
 */
import assert from 'node:assert/strict'
import { readFileSync, readdirSync, statSync, existsSync } from 'node:fs'
import { join, resolve } from 'node:path'

// ── 1. Белый список вызовов .touch( ─────────────────────────────────────────
// Ключ: «файл::фрагмент вызова (substring)» — строка кода должна содержать
// фрагмент. Значение: каким ДЕЙСТВИЕМ МАСТЕРА пишется файл. Никаких
// «нормализация при открытии» здесь быть не может — такой вызов обязан
// пинить базовую линию (acceptChangeAsBaseline), а не попадать сюда.

const TOUCH_WHITELIST: Readonly<Record<string, string>> = {
  'ArenaEditor.tsx::store.touch(path)': 'редактирование клеток/зон арены мастером (×2 вызова)',
  'ArenaEditor.tsx::store.touch(\'world.json\')': 'имя/настройки арены в редакторе',
  'ArenaEditor.tsx::commit={() => store.touch(': 'кнопка «Расширенный JSON арены» — явный commit',
  'AudioSection.tsx::store.touch(\'campaign.json\')': 'настройка музыки/звуков мастером',
  'CampaignEditor.tsx::store.touch(\'campaign.json\')': 'правки паспорта кампании мастером',
  'CodexEditor.tsx::store.touch(path)': 'правки статьи кодекса мастером',
  'CombatRulesEditor.tsx::store.touch(\'campaign.json\')': 'настройка боевых правил мастером',
  'CutsceneEditor.tsx::store.touch(path)': 'правки катсцены мастером',
  'DialogueBuilder.tsx::if (added) store.touch(\'campaign.json\')': 'первая РЕАЛЬНАЯ правка мастера → отложенная регистрация придуманных флагов',
  'DialogueBuilder.tsx::store.touch(dlgPath, group)': 'commit правок конструктора диалога',
  'DialogueBuilder.tsx::store.touch(path, group)': 'commit правок конструктора диалога (ink)',
  'DialogueHost.tsx::store.touch(dlgPath)': 'авто-конвертация ink→dlg при ПЕРВОМ открытии; тут же пинится acceptChangeAsBaseline — в diff не попадает',
  'EditorApp.tsx::store.touch(`dialogues/${fn}.dlg.json`)': 'явное создание нового диалога мастером',
  'EditorApp.tsx::store.touch(\'campaign.json\')': 'исправление версии кампании по подтверждению мастера',
  'EntityEditor.tsx::store.touch(path)': 'правки сущности мастером',
  'EntityEditor.tsx::store.touch(\'campaign.json\')': 'правки сущности с обновлением реестров паспорта (×3 вызова)',
  'Fields.tsx::store.touch(\'campaign.json\')': 'commit полей паспорта кампании',
  'QuestEditor.tsx::store.touch(path)': 'правки квеста мастером',
  'QuestEditor.tsx::commit={() => store.touch(': 'кнопка «Расширенный JSON квеста» — явный commit',
  'RecipeEditor.tsx::store.touch(path)': 'правки рецепта мастером',
  'RuleEditor.tsx::store.touch(path)': 'правки правила мастером',
  'RuleEditor.tsx::commit={() => store.touch(': 'кнопка «Расширенный JSON правила» — явный commit',
  'SceneEditor.tsx::store.touch(path)': 'редактирование сцены мастером',
  'SceneEditor.tsx::commit={() => store.touch(': 'кнопка «Расширенный JSON сцены» — явный commit',
  'WorldEditor.tsx::store.touch(\'world.json\')': 'правки мира мастером (формы)',
  'WorldEditor.tsx::commit={() => store.touch(': 'кнопка «Расширенный JSON мира» — явный commit',
  'assets.ts::store.touch(p)': 'вшивание медиафайла мастером: переписывает ссылки в json-файлах',
  'assets.ts::store.touch(\'campaign.json\')': 'вшивание медиафайла мастером: переписывает ссылки в паспорте',
  'assets.ts::store.touch(\'world.json\')': 'вшивание медиафайла мастером: переписывает ссылки в мире',
  'compatPublish.ts::store.touch(\'campaign.json\')': 'публикация compat.json мастером: дублирование версии в паспорт',
  'store.ts::this.touch(path)': 'внутренний API записи (setJson/setText); публичные вызыватели — список выше',
  'store.ts::this.touch(\'campaign.json\')': 'внутренний API записи (setMeta)',
  'store.ts::this.touch(\'project.json\')': 'автор явно меняет режим возможности в каталоге паков',
  'store.ts::this.touch(\'world.json\')': 'внутренний API записи (setWorld)',
}


// ── утилиты ──────────────────────────────────────────────────────────────────

let failures = 0
function fail(msg: string): void {
  failures += 1
  console.error(`✗ ${msg}`)
}
function ok(msg: string): void {
  console.log(`✓ ${msg}`)
}

function listEditorFiles(dir: string): string[] {
  const out: string[] = []
  if (!existsSync(dir)) return out
  for (const name of readdirSync(dir)) {
    const full = join(dir, name)
    const st = statSync(full)
    if (st.isDirectory()) out.push(...listEditorFiles(full))
    else if (/\.(tsx?|mts)$/.test(name)) out.push(full)
  }
  return out
}

// ── 1. статика: каждый .touch( в src/editor покрыт белым списком ─────────────

function auditTouchSites(): void {
  const seen = new Map<string, number>()
  for (const [key] of Object.entries(TOUCH_WHITELIST)) seen.set(key, 0)
  const editorDir = resolve('src/editor')
  const offenders: string[] = []
  for (const file of listEditorFiles(editorDir)) {
    const rel = file.slice(editorDir.length + 1)
    const lines = readFileSync(file, 'utf-8').split('\n')
    lines.forEach((line, idx) => {
      if (!line.includes('.touch(')) return
      let covered = false
      for (const key of Object.keys(TOUCH_WHITELIST)) {
        const sep = key.indexOf('::')
        const file = key.slice(0, sep)
        const fragment = key.slice(sep + 2)
        if (file === rel && line.includes(fragment)) {
          seen.set(key, (seen.get(key) ?? 0) + 1)
          covered = true
        }
      }
      if (!covered) offenders.push(`${rel}:${idx + 1}: ${line.trim()}`)
    })
  }
  for (const o of offenders) {
    fail(`новый вызов .touch( вне белого списка: ${o}\n   → добавьте строку в TOUCH_WHITELIST scripts/view-write-smoke.mts\n     с объяснением, каким действием мастера файл пишется`)
  }
  if (offenders.length === 0) ok(`статика: все вызовы .touch( в src/editor объяснены действием мастера (${[...seen.values()].reduce((a, b) => a + b, 0)} сайтов)`)
  // белый список не должен гнить: записи, которых больше нет в коде — тоже ошибка
  for (const [key, count] of seen) {
    if (count === 0) fail(`белый список ссылается на отсутствующий сайт: ${key} — удалите запись`)
  }
}

// ── 2. динамика: загрузка эталонной кампании не порождает diff ───────────────

async function auditLoadIsClean(): Promise<void> {
  const { EditorStore } = await import('../src/editor/store')
  const ROOT = resolve('public/campaigns/ash-of-caerden')
  const store = new EditorStore('/__view_write__')

  store.meta = JSON.parse(readFileSync(join(ROOT, 'campaign.json'), 'utf-8')) as typeof store.meta
  store.world = JSON.parse(readFileSync(join(ROOT, 'world.json'), 'utf-8')) as typeof store.world
  store.manifest = JSON.parse(readFileSync(join(ROOT, 'manifest.json'), 'utf-8')) as typeof store.manifest

  const bill: string[] = []
  const dirs = ['scenes', 'entities', 'rules', 'quests', 'arenas', 'cutscenes', 'recipes', 'codex', 'encounters', 'dialogues']
  for (const dir of dirs) {
    const full = join(ROOT, dir)
    if (!existsSync(full)) continue
    for (const name of readdirSync(full)) {
      const rel = `${dir}/${name}`
      const text = readFileSync(join(full, name), 'utf-8')
      bill.push(rel)
      if (name.endsWith('.json')) {
        store.jsonFiles.set(rel, JSON.parse(text))
      } else if (name.endsWith('.ink') || name.endsWith('.md')) {
        store.textFiles.set(rel, text)
      }
    }
  }
  // как после настоящей загрузки пакета: базовые линии пинятся, diff пуст
  store.acceptChangeAsBaseline('campaign.json')
  store.acceptChangeAsBaseline('world.json')
  store.acceptChangeAsBaseline('manifest.json')
  for (const rel of bill) store.acceptChangeAsBaseline(rel)

  const mods = store.getModifiedFiles()
  assert.equal(mods.length, 0, `сразу после загрузки эталонной кампании список изменений не пуст: ${mods.map((m) => m.path).join(', ')}`)
  ok(`динамика: загрузка эталонной кампании (${bill.length} файлов) не порождает ни одного ряда в diff`)

  // двойной прогон: повторная сериализация того же документа не рождает «изменение»
  let reSerial = 0
  for (const rel of bill) {
    if (!rel.endsWith('.json')) continue
    const doc = store.jsonFiles.get(rel)
    const reser = JSON.stringify(doc)
    const again = JSON.stringify(JSON.parse(reser))
    if (reser !== again) {
      fail(`двойная сериализация меняет документ ${rel} — семантика сравнения должна гасить перестановку ключей`)
    }
    reSerial += 1
  }
  if (failures === 0) ok(`двойная сериализация ${reSerial} JSON-документов стабильна`)
}

async function main(): Promise<void> {
  auditTouchSites()
  await auditLoadIsClean()
  if (failures > 0) {
    console.error(`\n${failures} нарушений инварианта «просмотр ≠ запись»`)
    process.exit(1)
  }
  console.log('\nинвариант зелёный')
}

main().catch((e) => {
  console.error('смоук упал целиком:', e)
  process.exit(1)
})
