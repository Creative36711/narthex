import { createHash } from 'node:crypto'
import { execSync } from 'node:child_process'
import { mkdir, readFile, readdir, writeFile } from 'node:fs/promises'
import { dirname, join, resolve } from 'node:path'
import JSZip from 'jszip'

const root = resolve(import.meta.dirname, '..')
const source = join(root, 'public', 'ai')
const outIndex = process.argv.indexOf('--out')
const outArg = outIndex >= 0 ? process.argv[outIndex + 1] : undefined
if (outIndex >= 0 && (!outArg || outArg.startsWith('--'))) {
  throw new Error('Usage: npm run pack:ai-kit [-- --out <directory>]')
}
const out = outArg ? resolve(process.cwd(), outArg) : join(root, 'dist-ai')
const kit = join(out, '__chronicle_ai__')

await mkdir(kit, { recursive: true })

const sha = (buffer: Buffer) => createHash('sha256').update(buffer).digest('hex')
const manifest: Array<{ file: string; bytes: number; sha256: string }> = []

const copy = async (from: string, to: string, archivePath: string) => {
  const data = await readFile(from)
  await mkdir(dirname(to), { recursive: true })
  await writeFile(to, data)
  manifest.push({ file: archivePath, bytes: data.length, sha256: sha(data) })
}

async function filesUnder(dir: string, prefix = ''): Promise<string[]> {
  const files: string[] = []
  for (const entry of await readdir(join(dir, prefix), { withFileTypes: true })) {
    // Не упаковываем скрытые артефакты проверки (например, .cf-play/check).
    if (entry.name.startsWith('.')) continue
    const relativePath = prefix ? `${prefix}/${entry.name}` : entry.name
    if (entry.isDirectory()) files.push(...(await filesUnder(dir, relativePath)))
    else if (entry.isFile()) files.push(relativePath)
  }
  return files.sort()
}

for (const relativePath of await filesUnder(source)) {
  const name = relativePath.split('/').at(-1) ?? relativePath
  if (name.endsWith('.mjs') || name.endsWith('.md') || name.endsWith('.json') || name.endsWith('.py')) {
    await copy(join(source, relativePath), join(kit, relativePath), relativePath)
  }
}

// Самодостаточная копия эталона для `cf-play example` после распаковки.
// Источник — опубликованная кампания; check:campaigns удерживает её равной данным пака.
const exampleSource = join(root, 'public/campaigns/ash-of-caerden')
const exampleTarget = join(kit, 'examples/narrative')
for (const relativePath of await filesUnder(exampleSource)) {
  await copy(
    join(exampleSource, relativePath),
    join(exampleTarget, relativePath),
    `examples/narrative/${relativePath}`,
  )
}

// Короткая инструкция по инструментам не дублирует полный форматный справочник.
const playkitGuide = join(root, 'docs/guides/nar-2.15-playkit.md')
await copy(playkitGuide, join(kit, 'CF-PLAY-TOOLS.md'), 'CF-PLAY-TOOLS.md')

const readme = `# __chronicle_ai__ — чемодан агента

Сначала читай \`TASK.md\`, \`campaign-guide.md\` и \`PLAYKIT.md\`; для быстрого запуска \`cf-play\` — \`CF-PLAY-TOOLS.md\`.

- \`campaign-audit.mjs\` — схема, ссылки, медиа. Запуск из корня кампании: \`node __chronicle_ai__/campaign-audit.mjs .\`
- \`cf-play.mjs\` — движок как инструмент: граф, диалоги, прогоны, приёмка.
  Приёмка: \`node __chronicle_ai__/cf-play.mjs check . --out .cf-play/check\`; эталон: \`node __chronicle_ai__/cf-play.mjs example\`.
- \`CF-PLAY-TOOLS.md\` — проверенные команды \`example\` и \`explain\`.
- \`campaign.schema.json\` — схема пакета.
- \`campaign-guide.md\` — правила контента.
- \`design-template.md\` — бланк дизайн-документа.
- \`cutout-chromakey.py\` — вырезание фона у арта.
- \`examples/narrative/\` — встроенный эталон для автономного \`cf-play example\`.

Перед пушем: \`check\` вернул \`0\`, \`report.md\` приложен к отчёту.
Прогоны с отладочными правками (\`evidence: injected\`) не считаются приёмкой.
`
await writeFile(join(kit, 'README.md'), readme, 'utf8')
const readmeBytes = Buffer.from(readme, 'utf8')
manifest.push({ file: 'README.md', bytes: readmeBytes.length, sha256: sha(readmeBytes) })

// Паспорт набора: по нему видно, какая версия кита лежит в репозитории кампании.
const pkg = JSON.parse(await readFile(join(root, 'package.json'), 'utf8')) as { version: string }
const commit = (() => {
  try {
    return execSync('git rev-parse --short HEAD', { cwd: root }).toString().trim()
  } catch {
    return 'unknown'
  }
})()
const passport = {
  kit: '__chronicle_ai__',
  version: pkg.version,
  built_at: new Date().toISOString(),
  commit,
  files: manifest.map(({ file, bytes, sha256 }) => ({ file, bytes, sha256 })),
}
const passportText = `${JSON.stringify(passport, null, 2)}\n`
await writeFile(join(kit, 'KIT.json'), passportText, 'utf8')
const passportBytes = Buffer.from(passportText, 'utf8')
manifest.push({ file: 'KIT.json', bytes: passportBytes.length, sha256: sha(passportBytes) })

const files = Object.fromEntries(
  await Promise.all(
    manifest.map(async (entry) => [entry.file, await readFile(join(kit, entry.file))] as const),
  ),
)
const zip = new JSZip()
const folder = zip.folder('__chronicle_ai__')!
for (const [name, data] of Object.entries(files)) folder.file(name, data)
const archive = await zip.generateAsync({ type: 'nodebuffer', compression: 'DEFLATE', compressionOptions: { level: 9 } })
const archivePath = join(out, '__chronicle_ai__-kit.zip')
await writeFile(archivePath, archive)

const total = manifest.reduce((sum, entry) => sum + entry.bytes, 0)
console.log(`kit: ${manifest.length} файлов, ${(total / 1024 / 1024).toFixed(2)} МБ`)
for (const entry of manifest) {
  console.log(`  ${entry.file.padEnd(24)} ${String(entry.bytes).padStart(9)}  ${entry.sha256.slice(0, 16)}…`)
}
console.log(`zip: ${archivePath} (${(archive.length / 1024 / 1024).toFixed(2)} МБ) sha256:${sha(archive).slice(0, 16)}…`)

// npm run sync:ai-kit -- ../campaign-2 — разложить набор в чужой репозиторий.
const copyIndex = process.argv.indexOf('--copy')
if (copyIndex > -1) {
  const targetArg = process.argv[copyIndex + 1]
  if (!targetArg || targetArg.startsWith('--')) throw new Error('--copy требует путь к репозиторию кампании')
  const destination = join(resolve(process.cwd(), targetArg), '__chronicle_ai__')
  await mkdir(destination, { recursive: true })
  const names = new Set(manifest.map((entry) => entry.file))
  for (const entry of manifest) {
    const target = join(destination, entry.file)
    await mkdir(dirname(target), { recursive: true })
    await writeFile(target, await readFile(join(kit, entry.file)))
  }
  const stale = (await filesUnder(destination)).filter((name) => !names.has(name))
  console.log(`куда: ${destination}`)
  console.log(`файлов: ${manifest.length}; версия ${pkg.version}, коммит ${commit}`)
  if (stale.length) console.log(`лишние файлы (проверить руками): ${stale.join(', ')}`)
}
