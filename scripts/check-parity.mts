/**
 * NAR-4.6 cross-environment oracle: the identical inline project, five seeds,
 * both Executor cycles, and the same fixed dt row in Chromium and Node/cf-play.
 *
 * If Chromium tooling is absent, it is installed into a temporary npm prefix
 * and linked only for this process; package.json, lockfiles, and source stay
 * untouched. A missing browser remains a hard failure, never a skip.
 */
import { createRequire } from 'node:module'
import { spawnSync } from 'node:child_process'
import { existsSync, mkdirSync, mkdtempSync, rmSync, symlinkSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join, resolve } from 'node:path'
import { pathToFileURL } from 'node:url'
import { build } from 'esbuild'
import {
  FIXED_DT_MS,
  RUNTIMES,
  SEEDS,
  runCycle,
  type RunResult,
  type Runtime,
} from './parity-fixture'

interface ParityCase {
  readonly seed: string
  readonly runtime: Runtime
  readonly dt: readonly number[]
}

interface ParityBrowserPage {
  setContent(html: string): Promise<void>
  addScriptTag(options: { content: string }): Promise<unknown>
  evaluate<Result, Argument>(fn: (argument: Argument) => Result, argument: Argument): Promise<Result>
  on(event: 'pageerror', listener: (error: Error) => void): void
  on(event: 'console', listener: (message: { type(): string; text(): string }) => void): void
}

interface ParityBrowserContext {
  newPage(): Promise<ParityBrowserPage>
  close(): Promise<void>
}

interface ParityBrowser {
  newContext(): Promise<ParityBrowserContext>
  close(): Promise<void>
}

interface LocalBrowserTools {
  launchChromium(): Promise<ParityBrowser>
  chromiumVersion(): string
}

interface ParityRow {
  readonly seed: string
  readonly runtime: Runtime
  readonly browser: RunResult
  readonly browserRepeat: RunResult
  readonly cfPlay: RunResult
  readonly cfPlayRepeat: RunResult
  readonly matches: boolean
  readonly repeatsMatch: boolean
}

const root = resolve(import.meta.dirname, '..')
const browserBundleEntry = join(root, 'scripts/parity-browser-entry.ts')
const browserToolsPath = join(root, 'scripts/visual/local-browser.mjs')
const require = createRequire(import.meta.url)

function browserPackagesAvailable(): boolean {
  try {
    require.resolve('@sparticuz/chromium')
    require.resolve('playwright-core')
    return true
  } catch {
    return false
  }
}

async function launchBrowserTools(): Promise<{
  browser: ParityBrowser
  version: string
  cleanup: () => void
}> {
  const temporaryPrefix = browserPackagesAvailable()
    ? null
    : mkdtempSync(join(tmpdir(), 'narthex-parity-browser-'))
  const temporaryLinks: string[] = []
  try {
    if (temporaryPrefix) {
      const install = spawnSync('npm', [
        'install',
        '--prefix', temporaryPrefix,
        '--no-save',
        '--ignore-scripts',
        '--no-audit',
        '--no-fund',
        '@sparticuz/chromium@131',
        'playwright-core@1.49.1',
      ], { cwd: root, encoding: 'utf8' })
      if (install.error || install.status !== 0) {
        throw new Error(
          `NAR-4.6 browser install failed (rc=${install.status ?? 127}): ` +
            `${install.error?.message ?? install.stderr.slice(-1200)}`,
        )
      }

      const packages = [
        {
          source: join(temporaryPrefix, 'node_modules/@sparticuz/chromium'),
          destination: join(root, 'node_modules/@sparticuz/chromium'),
        },
        {
          source: join(temporaryPrefix, 'node_modules/playwright-core'),
          destination: join(root, 'node_modules/playwright-core'),
        },
      ]
      for (const item of packages) {
        if (existsSync(item.destination)) continue
        if (!existsSync(item.source)) throw new Error(`NAR-4.6 temporary browser package missing: ${item.source}`)
        mkdirSync(dirname(item.destination), { recursive: true })
        symlinkSync(item.source, item.destination, 'dir')
        temporaryLinks.push(item.destination)
      }
      console.log('Headless Chromium driver: installed in a temporary npm prefix for this check.')
    }

    const browserTools = await import(pathToFileURL(browserToolsPath).href) as unknown as LocalBrowserTools
    const browser = await browserTools.launchChromium()
    return {
      browser,
      version: browserTools.chromiumVersion(),
      cleanup: () => {
        for (const link of temporaryLinks) rmSync(link, { recursive: true, force: true })
        if (temporaryPrefix) rmSync(temporaryPrefix, { recursive: true, force: true })
      },
    }
  } catch (error) {
    for (const link of temporaryLinks) rmSync(link, { recursive: true, force: true })
    if (temporaryPrefix) rmSync(temporaryPrefix, { recursive: true, force: true })
    throw error
  }
}

async function runInBrowser(
  browser: ParityBrowser,
  source: string,
  cases: readonly ParityCase[],
): Promise<RunResult[]> {
  const context = await browser.newContext()
  const page = await context.newPage()
  const browserErrors: string[] = []
  page.on('pageerror', (error) => browserErrors.push(String(error)))
  page.on('console', (message) => {
    if (message.type() === 'error') browserErrors.push(message.text())
  })

  try {
    await page.setContent('<!doctype html><html><head><title>NAR-4.6 parity</title></head><body></body></html>')
    await page.addScriptTag({ content: source })
    const results = await page.evaluate((input) => {
      const scope = globalThis as typeof globalThis & {
        __NARTHEX_PARITY__?: {
          runCycle: (runtime: Runtime, seed: string, dt: readonly number[]) => RunResult
        }
      }
      const runCycle = scope.__NARTHEX_PARITY__?.runCycle
      if (!runCycle) throw new Error('NAR-4.6 browser runner was not installed')
      return input.map(({ runtime, seed, dt }) => runCycle(runtime, seed, dt))
    }, cases)
    if (browserErrors.length) throw new Error(`NAR-4.6 browser errors: ${browserErrors.join(' | ')}`)
    return results
  } finally {
    await context.close()
  }
}

export async function runParity(): Promise<void> {
  const cases: ParityCase[] = SEEDS.flatMap((seed) => RUNTIMES.map((runtime) => ({
    seed,
    runtime,
    dt: FIXED_DT_MS,
  })))
  const cfPlayFirst = cases.map(({ seed, runtime, dt }) => runCycle(runtime, seed, dt))
  const cfPlaySecond = cases.map(({ seed, runtime, dt }) => runCycle(runtime, seed, dt))
  const packageJson = JSON.parse(await (await import('node:fs/promises')).readFile(join(root, 'package.json'), 'utf8')) as { version: string }
  const bundled = await build({
    entryPoints: [browserBundleEntry],
    bundle: true,
    platform: 'browser',
    format: 'iife',
    target: 'chrome131',
    legalComments: 'none',
    define: { __CF_ENGINE_VERSION__: JSON.stringify(packageJson.version) },
    write: false,
    logLevel: 'silent',
  })
  const browserSource = bundled.outputFiles[0]?.text
  if (!browserSource) throw new Error('NAR-4.6 browser bundle is empty')

  const { browser, version, cleanup } = await launchBrowserTools()
  try {
    const browserFirst = await runInBrowser(browser, browserSource, cases)
    const browserSecond = await runInBrowser(browser, browserSource, cases)
    const rows: ParityRow[] = cases.map((test, index) => {
      const browser = browserFirst[index]!
      const browserRepeat = browserSecond[index]!
      const cfPlay = cfPlayFirst[index]!
      const cfPlayRepeat = cfPlaySecond[index]!
      return {
        ...test,
        browser,
        browserRepeat,
        cfPlay,
        cfPlayRepeat,
        matches: browser.fingerprint === cfPlay.fingerprint,
        repeatsMatch:
          browser.fingerprint === browserRepeat.fingerprint &&
          cfPlay.fingerprint === cfPlayRepeat.fingerprint,
      }
    })

    console.log(`NAR-4.6 parity: browser (${version}) ↔ cf-play Node; project=nar-4.4-determinism-fixture.`)
    console.log(`Same seed and dt input row: [${FIXED_DT_MS.join(', ')}] ms; 5 seeds × 2 runtimes.`)
    console.log('| seed | runtime | browser hash | cf-play hash | match |')
    console.log('|---|---|---|---|---|')
    for (const row of rows) {
      console.log(`| ${row.seed} | ${row.runtime} | ${row.browser.fingerprint} | ${row.cfPlay.fingerprint} | ${row.matches ? 'yes' : 'NO'} |`)
    }
    const mismatches = rows.filter((row) => !row.matches)
    const nonRepeats = rows.filter((row) => !row.repeatsMatch)
    console.log(
      `Repeat run: browser and cf-play hashes are stable for ${rows.length - nonRepeats.length}/${rows.length} rows; ` +
        `cross-environment mismatches=${mismatches.length}.`,
    )
    if (rows.length !== SEEDS.length * RUNTIMES.length || mismatches.length || nonRepeats.length) {
      throw new Error(
        `NAR-4.6 parity failed: rows=${rows.length}, mismatches=${mismatches.length}, ` +
          `unstable repeats=${nonRepeats.length}`,
      )
    }
    console.log(`PASS: ${rows.length}/${rows.length} browser hashes equal cf-play; repeated hashes are identical.`)
  } finally {
    await browser.close()
    cleanup()
  }
}

if (import.meta.main) {
  runParity().catch((error) => {
    console.error(error)
    process.exitCode = 1
  })
}
