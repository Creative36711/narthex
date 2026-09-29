/**
 * Установка кампании из монолитного JSON в public/campaigns/<id>/.
 *
 * Монолит (файл с ключами campaign/world/scenes/entities/rules/quests/
 * arenas/cutscenes/encounters/recipes/codex/dialogues) — формат, в котором
 * кампанию отдаёт ИИ-агент («чемодан»). Скрипт пропускает его через тот же
 * путь, что и кнопка «Импорт из JSON» в редакторе (repairMonolith +
 * importMonolith), и раскладывает результат в файлы Campaign Package.
 *
 * Запуск: npx tsx scripts/install-campaign.mts [путь/к/монолиту.json]
 *         (по умолчанию — _backlog/campaign.json)
 *
 * Скрипт идемпотентен: папка кампании перезаписывается целиком.
 */
import { mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { EditorStore } from '../src/editor/store'
import { importMonolith, parseMonolith } from '../src/editor/monolith'

const root = join(import.meta.dirname, '..')
const srcArg = process.argv[2] ?? '_backlog/campaign.json'
const srcPath = join(root, srcArg)

const raw = JSON.parse(readFileSync(srcPath, 'utf8')) as unknown
const doc = parseMonolith(JSON.stringify(raw))
const id = String((doc.campaign as { id?: string })?.id ?? '')
if (!id) throw new Error('В монолите нет campaign.id — кампанию некуда устанавливать')
const title = String((doc.campaign as { title?: string })?.title ?? id)

const store = new EditorStore(`/campaigns/${id}`)
const warnings = importMonolith(store, doc)

const dir = join(root, 'public/campaigns', id)
rmSync(dir, { recursive: true, force: true })
const written: string[] = []
for (const p of store.allPaths()) {
  const target = join(dir, p)
  mkdirSync(join(target, '..'), { recursive: true })
  writeFileSync(target, store.fileText(p), 'utf8')
  written.push(p)
}

// реестр кампаний: запись index.json — производная от campaign.json пакета,
// поэтому описание/автор берём из манифеста, а не из памяти (фидбек 29-09, п.2)
const indexPath = join(root, 'public/campaigns/index.json')
let index: { id: string; title: string; description?: string; author?: string }[] = []
try {
  index = JSON.parse(readFileSync(indexPath, 'utf8')) as typeof index
} catch {
  index = []
}
const meta = doc.campaign as { description?: string; author?: string }
const entry = {
  id,
  title,
  author: meta.author,
  ...(meta.description ? { description: meta.description } : {}),
}
const nextIndex = index.filter((c) => c.id !== id)
nextIndex.push(entry)
// без завершающего перевода строки: так же, как пишут реестр редактор и смоуки
writeFileSync(indexPath, JSON.stringify(nextIndex, null, 2), 'utf8')

console.log(`Кампания «${title}» (${id}) установлена: ${written.length} файлов в public/campaigns/${id}/`)
for (const p of written) console.log(`  ${p}`)
if (warnings.length) {
  console.log(`\nПредупреждения импорта (${warnings.length}):`)
  for (const w of warnings) console.log(`  · ${w}`)
} else {
  console.log('\nПредупреждений нет — пакет собран чисто.')
}
