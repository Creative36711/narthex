// Гейт: закоммиченный бандл оракула собран из текущего `src`.
//
// `public/ai/cf-play.mjs` — артефакт, а не исходник: его собирает
// `npm run build:playkit-bundle` из `scripts/playkit/cli.mts`. 24.10 бандл
// отстал от src на две карточки: `grep -c ruleOrder` давал 0 при 4 в src, и
// оракул миссии проверял старую сборку (NAR-1.15). Гейт собирает бандл заново
// теми же флагами во временном каталоге и сравнивает побайтно: расхождение —
// это забытая пересборка, а не «шум».

import { createHash } from 'node:crypto'
import { mkdtemp, readFile, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { build } from 'esbuild'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const committedPath = path.join(root, 'public/ai/cf-play.mjs')
const packagePath = path.join(root, 'package.json')

const pkg = JSON.parse(await readFile(packagePath, 'utf8')) as { version: string }
const dir = await mkdtemp(path.join(tmpdir(), 'cf-play-bundle-'))
const builtPath = path.join(dir, 'cf-play.mjs')

const sha256 = (data: Buffer): string => createHash('sha256').update(data).digest('hex')

function firstDifference(a: Buffer, b: Buffer): number {
  const limit = Math.min(a.length, b.length)
  for (let index = 0; index < limit; index += 1) if (a[index] !== b[index]) return index
  return limit
}

let ok = true
try {
  await build({
    entryPoints: [path.join(root, 'scripts/playkit/cli.mts')],
    bundle: true,
    platform: 'node',
    format: 'esm',
    target: 'node20',
    legalComments: 'none',
    define: { __CF_ENGINE_VERSION__: JSON.stringify(pkg.version) },
    outfile: builtPath,
    logLevel: 'silent',
  })

  const committed = await readFile(committedPath)
  const built = await readFile(builtPath)

  if (committed.equals(built)) {
    console.log(`✓ public/ai/cf-play.mjs совпадает со сборкой из src (${pkg.version}, sha256 ${sha256(committed)})`)
  } else {
    ok = false
    const offset = firstDifference(committed, built)
    console.error('✗ public/ai/cf-play.mjs не совпадает со сборкой из src — бандл устарел.')
    console.error(`  закоммичено: ${committed.length} байт, sha256 ${sha256(committed)}`)
    console.error(`  собрано:    ${built.length} байт, sha256 ${sha256(built)}`)
    console.error(`  первое расхождение — байт ${offset}`)
    console.error('  пересоберите и закоммитьте: npm run build:playkit-bundle')
  }
} finally {
  await rm(dir, { recursive: true, force: true })
}

if (!ok) process.exit(1)
