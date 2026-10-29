/**
 * Отчёт о совместимости двух версий кампании.
 *
 * Запуск:
 *   npx tsx scripts/compat-report.mts <старая> <новая> [--json out.json]
 * где <старая>/<новая> — каталог Campaign Package или файл .chronicle.
 *
 * Инструмент отвечает на вопрос мастера «с какой версии мои сохранения ещё
 * поддерживаются» без ручных таблиц: сравнивает инвентаризации пакетов,
 * печатает изменения по-русски и предлагает `save_base_version`.
 * Это же сравнение делает редактор в разделе «Кампания → Совместимость».
 */
import { readFileSync, writeFileSync, statSync, readdirSync } from 'node:fs'
import { join, basename } from 'node:path'
import JSZip from 'jszip'
import {
  inventoryOf,
  diffInventories,
  diffReportLines,
  buildCompat,
  suggestNextVersion,
  type InventorySource,
} from '../src/shared/compat'
import type { CampaignCompat, CampaignMeta, WorldDef } from '../src/shared/types'

type Files = Record<string, string>

function readDir(dir: string): Files {
  const out: Files = {}
  const walk = (rel: string) => {
    for (const entry of readdirSync(join(dir, rel), { withFileTypes: true })) {
      const path = rel ? `${rel}/${entry.name}` : entry.name
      if (entry.isDirectory()) walk(path)
      else if (path.endsWith('.json') || path.endsWith('.ink')) out[path] = readFileSync(join(dir, path), 'utf8')
    }
  }
  walk('')
  return out
}

async function readPackage(target: string): Promise<{ files: Files; label: string }> {
  const isDir = statSync(target).isDirectory()
  if (isDir) return { files: readDir(target), label: basename(target) }
  const zip = await JSZip.loadAsync(readFileSync(target))
  const files: Files = {}
  for (const [path, entry] of Object.entries(zip.files)) {
    if (entry.dir) continue
    if (path.endsWith('.json') || path.endsWith('.ink')) files[path.replace(/^\/+/, '')] = await entry.async('text')
  }
  return { files, label: basename(target) }
}

function sourceOf(files: Files, label: string): InventorySource {
  const parse = (path: string) => {
    const text = files[path]
    if (!text) throw new Error(`В пакете «${label}» нет ${path}`)
    return JSON.parse(text) as never
  }
  const meta = parse('campaign.json') as CampaignMeta
  const world = parse('world.json') as WorldDef
  const manifest = parse('manifest.json') as {
    scenes?: string[]; entities?: string[]; rules?: string[]; arenas?: string[]; quests?: string[]
    cutscenes?: string[]; recipes?: string[]; codex?: string[]; dialogues?: string[]
  }
  const pick = (dir: string, names: string[] | undefined) => {
    const out: Record<string, unknown> = {}
    for (const n of names ?? []) {
      const text = files[`${dir}/${n}`]
      if (!text) continue
      const value = JSON.parse(text) as Record<string, unknown>
      out[String(value.id ?? n)] = value
    }
    return out
  }
  const dialogues: Record<string, string> = {}
  for (const n of manifest.dialogues ?? []) {
    const text = files[`dialogues/${n}`]
    if (text) dialogues[n.replace(/\.ink$/, '')] = text
  }
  return {
    meta,
    world,
    sections: {
      scenes: pick('scenes', manifest.scenes),
      entities: pick('entities', manifest.entities),
      rules: pick('rules', manifest.rules),
      arenas: pick('arenas', manifest.arenas),
      quests: pick('quests', manifest.quests),
      cutscenes: pick('cutscenes', manifest.cutscenes),
      recipes: pick('recipes', manifest.recipes),
      codex: pick('codex', manifest.codex),
      dialogues,
    },
  }
}

const args = process.argv.slice(2)
const jsonOut = args.indexOf('--json')
let outPath: string | undefined
if (jsonOut >= 0) {
  outPath = args[jsonOut + 1]
  args.splice(jsonOut, 2)
}
const [oldTarget, newTarget] = args
if (!oldTarget || !newTarget) {
  console.error('Использование: npx tsx scripts/compat-report.mts <старая> <новая> [--json out.json]')
  process.exit(2)
}

const [oldPkg, newPkg] = await Promise.all([readPackage(oldTarget), readPackage(newTarget)])
const oldSrc = sourceOf(oldPkg.files, oldPkg.label)
const newSrc = sourceOf(newPkg.files, newPkg.label)

const oldInv = inventoryOf(oldSrc)
const newInv = inventoryOf(newSrc)
const diff = diffInventories(oldInv, newInv)

console.log(`Кампания: ${newSrc.meta.title} (${oldPkg.label} → ${newPkg.label})`)
for (const line of diffReportLines(diff)) console.log(line)

const suggestedVersion = suggestNextVersion(oldSrc.meta.version, diff)
const compat = buildCompat({
  version: newSrc.meta.version,
  diff,
  inventory: newInv,
  previous: null,
  minEngine: newSrc.meta.min_engine ?? newSrc.meta.engine_version,
  packageFormat: newSrc.meta.package_format,
})
console.log('')
console.log(`Предложение по версии: ${oldSrc.meta.version} → ${suggestedVersion}`)
console.log(`save_base_version: ${compat.save_base_version || '(не задан — поддерживаются все сохранения)'}`)
console.log(`Инвентаризация: ${newInv.digest}`)

if (outPath) {
  const payload: CampaignCompat = { ...compat, version: suggestedVersion }
  writeFileSync(outPath, JSON.stringify(payload, null, 2))
  console.log(`Контракт записан: ${outPath}`)
}
process.exit(diff.breaking ? 1 : 0)
