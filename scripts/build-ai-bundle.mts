import { createHash } from 'node:crypto'
import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { dirname, join, relative, resolve } from 'node:path'
import { build } from 'esbuild'
import { renameAjvHelper } from './rename-audit-ajv-helper.mts'

const root = resolve(import.meta.dirname, '..')
const source = 'scripts/campaign-audit.mts'
const defaultOut = join(root, 'public/ai/campaign-audit.mjs')

/** Build the audit bundle from the checked-out source using the package's exact esbuild options. */
export async function buildAiBundle(outfile = defaultOut, quiet = false): Promise<Buffer> {
  const target = resolve(outfile)
  await mkdir(dirname(target), { recursive: true })
  await build({
    absWorkingDir: root,
    entryPoints: [source],
    bundle: true,
    platform: 'node',
    format: 'esm',
    target: 'node18',
    outfile: target,
    logLevel: quiet ? 'silent' : 'info',
  })

  const original = await readFile(target, 'utf8')
  const bundle = Buffer.from(renameAjvHelper(original), 'utf8')
  await writeFile(target, bundle)
  return bundle
}

if (import.meta.main) {
  const args = process.argv.slice(2)
  let outfile = defaultOut
  if (args.length) {
    if (args.length !== 2 || args[0] !== '--out' || !args[1]) {
      throw new Error('Usage: npm run build:ai-bundle [-- --out <path>]')
    }
    outfile = resolve(process.cwd(), args[1]!)
  }
  const bundle = await buildAiBundle(outfile)
  const sha256 = createHash('sha256').update(bundle).digest('hex')
  console.log(`✓ ${source} -> ${relative(root, resolve(outfile))} (${bundle.length} bytes, sha256 ${sha256})`)
}
