import { createHash } from 'node:crypto'
import { execSync } from 'node:child_process'
import { mkdir, readFile, readdir, writeFile } from 'node:fs/promises'
import { basename, join, resolve } from 'node:path'
import JSZip from 'jszip'

const root = resolve(import.meta.dirname, '..')
const source = join(root, 'public', 'ai')
const out = join(root, 'dist-ai')
const kit = join(out, '__chronicle_ai__')

await mkdir(kit, { recursive: true })

const sha = (buffer: Buffer) => createHash('sha256').update(buffer).digest('hex')
const manifest: Array<{ file: string; bytes: number; sha256: string }> = []

const copy = async (from: string, to: string) => {
  const data = await readFile(from)
  await writeFile(to, data)
  manifest.push({ file: basename(to), bytes: data.length, sha256: sha(data) })
}

for (const name of (await readdir(source)).sort()) {
  if (name.endsWith('.mjs') || name.endsWith('.md') || name.endsWith('.json') || name.endsWith('.py')) {
    await copy(join(source, name), join(kit, name))
  }
}


const readme = `# __chronicle_ai__ — чемодан агента

Сначала читай \`TASK.md\`, \`campaign-guide.md\` и \`PLAYKIT.md\`.

- \`campaign-audit.mjs\` — схема, ссылки, медиа. Запуск: \`node __chronicle_ai__/campaign-audit.mjs .\`
- \`cf-play.mjs\` — движок как инструмент: граф, диалоги, прогоны, приёмка.
  Одна команда: \`node __chronicle_ai__/cf-play.mjs check . --out .cf-play/check\`
- \`campaign.schema.json\` — схема пакета.
- \`campaign-guide.md\` — правила контента.
- \`design-template.md\` — бланк дизайн-документа.
- \`cutout-chromakey.py\` — вырезание фона у арта.

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
    await writeFile(join(destination, entry.file), await readFile(join(kit, entry.file)))
  }
  const stale = (await readdir(destination)).filter((name) => !names.has(name)).sort()
  console.log(`куда: ${destination}`)
  console.log(`файлов: ${manifest.length}; версия ${pkg.version}, коммит ${commit}`)
  if (stale.length) console.log(`лишние файлы (проверить руками): ${stale.join(', ')}`)
}
