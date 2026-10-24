// Копии кампаний: публикация и гейт расхождения.
//
// Кампания-пример живёт в двух местах:
//   packs/<пак>/data/<кампания>  — данные пака, источник истины;
//   public/campaigns/<кампания>  — артефакт: его грузит приложение, на нём
//                                  стоит оракул §2.1
//                                  (`cf-play check public/campaigns/ash-of-caerden`)
//                                  и читают smoke-пробы.
//
// Пока копию обновляли руками, расхождение было невидимым: правка в паке не
// доезжала до оракула, правка в кампании — до пака, и обе проверки оставались
// зелёными. 25.10 сверка blob-ов дала 99 совпадающих файлов и ни одной пробы,
// которая бы это удерживала. Поэтому здесь два режима: `--write` — единственный
// способ обновить копию, без флага — гейт, который падает на любом расхождении.
//
// `project.json` не сравнивается и не копируется: это метаданные проекта
// (format 2, caps, cap_options), а не содержимое пакета кампании.

import { createHash } from 'node:crypto'
import { existsSync } from 'node:fs'
import { cp, mkdir, readdir, readFile, rm } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const packsDir = path.join(root, 'packs')
const campaignsDir = path.join(root, 'public/campaigns')
const PROJECT_FILE = 'project.json'
const write = process.argv.includes('--write')

const sha256 = (data: Buffer): string => createHash('sha256').update(data).digest('hex')

async function listFiles(dir: string, rel = ''): Promise<string[]> {
  const entries = await readdir(path.join(dir, rel), { withFileTypes: true })
  const files: string[] = []
  for (const entry of entries) {
    const next = rel ? `${rel}/${entry.name}` : entry.name
    if (entry.name.startsWith('.') || entry.name === PROJECT_FILE) continue
    if (entry.isDirectory()) files.push(...(await listFiles(dir, next)))
    else if (entry.isFile()) files.push(next)
  }
  return files.sort()
}

async function snapshot(dir: string): Promise<Map<string, string>> {
  const files = await listFiles(dir)
  const entries = await Promise.all(
    files.map(async (rel) => [rel, sha256(await readFile(path.join(dir, rel)))] as const),
  )
  return new Map(entries)
}

interface Pair {
  pack: string
  name: string
  label: string
  source: string
  target: string
}

async function discover(): Promise<Pair[]> {
  const packs = await readdir(packsDir, { withFileTypes: true })
  const pairs: Pair[] = []
  for (const pack of packs) {
    if (!pack.isDirectory()) continue
    const dataDir = path.join(packsDir, pack.name, 'data')
    if (!existsSync(dataDir)) continue
    for (const campaign of await readdir(dataDir, { withFileTypes: true })) {
      if (!campaign.isDirectory()) continue
      pairs.push({
        pack: pack.name,
        name: campaign.name,
        label: `${pack.name}/${campaign.name}`,
        source: path.join(dataDir, campaign.name),
        target: path.join(campaignsDir, campaign.name),
      })
    }
  }
  return pairs.sort((a, b) => a.label.localeCompare(b.label))
}

function plural(count: number, one: string, few: string, many: string): string {
  const tail = count % 100
  if (tail >= 11 && tail <= 14) return many
  if (count % 10 === 1) return one
  if (count % 10 >= 2 && count % 10 <= 4) return few
  return many
}

function report(title: string, files: string[], sign: string): void {
  console.error(`  ${title}`)
  const shown = files.slice(0, 10)
  for (const file of shown) console.error(`    ${sign} ${file}`)
  if (files.length > shown.length) console.error(`    ${sign} … ещё ${files.length - shown.length}`)
}

const pairs = await discover()
if (pairs.length === 0) {
  console.error('✗ в packs/*/data нет ни одной кампании — сверять нечего')
  process.exit(1)
}

let failed = 0
let skipped = 0

for (const pair of pairs) {
  const source = await snapshot(pair.source)

  if (!existsSync(pair.target)) {
    if (!write) {
      console.warn(`! ${pair.label}: public/campaigns/${pair.name} не опубликована (это не расхождение)`)
      skipped += 1
      continue
    }
    await mkdir(pair.target, { recursive: true })
    for (const file of source.keys()) {
      await mkdir(path.dirname(path.join(pair.target, file)), { recursive: true })
      await cp(path.join(pair.source, file), path.join(pair.target, file))
    }
    console.log(`✓ ${pair.label}: опубликовано ${source.size} файлов в public/campaigns/${pair.name}`)
    continue
  }

  let target = await snapshot(pair.target)
  const added = [...source.keys()].filter((file) => !target.has(file))
  const removed = [...target.keys()].filter((file) => !source.has(file))
  const changed = [...source.keys()].filter((file) => target.has(file) && target.get(file) !== source.get(file))

  if (write && (added.length || changed.length || removed.length)) {
    for (const file of [...added, ...changed]) {
      await mkdir(path.dirname(path.join(pair.target, file)), { recursive: true })
      await cp(path.join(pair.source, file), path.join(pair.target, file))
    }
    for (const file of removed) await rm(path.join(pair.target, file))
    console.log(
      `✓ ${pair.label}: записано файлов: ${added.length + changed.length}, удалено: ${removed.length}` +
        ` (public/campaigns/${pair.name} ← packs/${pair.pack}/data/${pair.name})`,
    )
    target = await snapshot(pair.target)
  }

  const missing = [...source.keys()].filter((file) => !target.has(file))
  const extra = [...target.keys()].filter((file) => !source.has(file))
  const differing = [...source.keys()].filter((file) => target.has(file) && target.get(file) !== source.get(file))

  if (missing.length || extra.length || differing.length) {
    failed += 1
    const total = missing.length + extra.length + differing.length
    console.error(
      `✗ ${pair.label}: ${total} ${plural(total, 'расхождение', 'расхождения', 'расхождений')}` +
        ` с packs/${pair.pack}/data/${pair.name}`,
    )
    if (differing.length) report('изменены:', differing, '~')
    if (missing.length) report('нет в копии:', missing, '−')
    if (extra.length) report('лишние в копии:', extra, '+')
    continue
  }

  console.log(`✓ ${pair.label}: ${source.size} файлов копии совпадают с паком`)
}

if (failed > 0) {
  console.error('  копию не правят руками: npm run publish:campaigns')
  console.error(`✗ копии кампаний расходятся: ${failed} из ${pairs.length}`)
  process.exit(1)
}

const published = pairs.length - skipped
console.log(`✓ публичные копии кампаний — артефакты паков: ${published} из ${pairs.length} сверены`)
