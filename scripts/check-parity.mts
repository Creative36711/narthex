/**
 * NAR-4.6 cross-environment oracle: the identical inline project, five seeds,
 * both Executor cycles, and the same fixed dt row in Chromium and Node/cf-play.
 *
 * If Chromium tooling is absent, it is installed into a temporary npm prefix
 * and linked only for this process; package.json, lockfiles, and source stay
 * untouched. A missing browser remains a hard failure, never a skip.
 */
import { createRequire } from 'node:module'
import { performance } from 'node:perf_hooks'
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
  version(): string
  close(): Promise<void>
}

interface LocalBrowserTools {
  launchChromium(): Promise<ParityBrowser>
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

const browserPackageNames = ['@sparticuz/chromium', 'playwright-core'] as const
const browserPackageSpecs = ['@sparticuz/chromium@131', 'playwright-core@1.49.1'] as const
const browserInstallPrefixEnv = 'NARTHEX_PARITY_BROWSER_PREFIX'
const browserInstallTimeoutMs = 120000

function browserPackagesAvailable(prefix?: string): boolean {
  const packageRequire = prefix ? createRequire(join(prefix, 'package.json')) : require
  try {
    for (const packageName of browserPackageNames) packageRequire.resolve(packageName)
    return true
  } catch {
    return false
  }
}

function browserInstallArgs(prefix: string): string[] {
  return [
    'install',
    '--prefix', prefix,
    '--no-save',
    '--ignore-scripts',
    '--no-audit',
    '--no-fund',
    ...browserPackageSpecs,
  ]
}

function browserInstallCommand(prefix: string): string {
  return `npm install --prefix ${JSON.stringify(prefix)} --no-save --ignore-scripts --no-audit --no-fund ${browserPackageSpecs.join(' ')}`
}

async function launchBrowserTools(): Promise<{
  browser: ParityBrowser
  version: string
  cleanup: () => void
}> {
  const preparationStartedAt = performance.now()
  console.log('NAR-4.6 browser package preparation: start.')
  const configuredPrefix = process.env[browserInstallPrefixEnv]?.trim()
  const cachePrefix = configuredPrefix ? resolve(configuredPrefix) : null
  const rootHasPackages = browserPackagesAvailable()
  const temporaryPrefix = !rootHasPackages && !cachePrefix
    ? mkdtempSync(join(tmpdir(), 'narthex-parity-browser-'))
    : null
  const packagePrefix = cachePrefix ?? temporaryPrefix
  const temporaryLinks: string[] = []
  const cleanup = () => {
    for (const link of temporaryLinks) rmSync(link, { recursive: true, force: true })
    if (temporaryPrefix) rmSync(temporaryPrefix, { recursive: true, force: true })
  }

  try {
    if (!rootHasPackages && cachePrefix && !browserPackagesAvailable(cachePrefix)) {
      throw new Error(
        `NAR-4.6 CI browser cache is missing ${browserPackageNames.join(' and ')} at ${cachePrefix}. ` +
          `Install them in the dedicated CI step with: ${browserInstallCommand(cachePrefix)}`,
      )
    }

    if (temporaryPrefix) {
      const command = browserInstallCommand(temporaryPrefix)
      console.log(
        `NAR-4.6 installing ${browserPackageNames.join(' and ')} ` +
          `(timeout=${browserInstallTimeoutMs} ms):\n> ${command}`,
      )
      const install = spawnSync('npm', browserInstallArgs(temporaryPrefix), {
        cwd: root,
        timeout: 120000,
        stdio: 'inherit',
      })
      if (install.error || install.status !== 0) {
        const timedOut = install.error?.code === 'ETIMEDOUT'
        const detail = timedOut
          ? `timed out after ${browserInstallTimeoutMs} ms`
          : install.error?.message ?? `exit=${install.status} signal=${install.signal ?? 'none'}`
        throw new Error(
          `NAR-4.6 could not install ${browserPackageNames.join(' and ')} (${detail}). ` +
            `Install command: ${command}`,
        )
      }
    }

    if (!rootHasPackages) {
      if (!packagePrefix || !browserPackagesAvailable(packagePrefix)) {
        const command = packagePrefix ? browserInstallCommand(packagePrefix) : 'npm install'
        throw new Error(
          `NAR-4.6 browser package prefix is missing ${browserPackageNames.join(' and ')}. ` +
            `Install command: ${command}`,
        )
      }

      for (const packageName of browserPackageNames) {
        const source = join(packagePrefix, 'node_modules', packageName)
        const destination = join(root, 'node_modules', packageName)
        if (existsSync(destination)) continue
        if (!existsSync(source)) {
          throw new Error(
            `NAR-4.6 browser package ${packageName} is missing from ${packagePrefix}. ` +
              `Install command: ${browserInstallCommand(packagePrefix)}`,
          )
        }
        mkdirSync(dirname(destination), { recursive: true })
        symlinkSync(source, destination, 'dir')
        temporaryLinks.push(destination)
      }
      console.log(cachePrefix
        ? `Headless Chromium driver: using cached packages from ${cachePrefix}; no install.`
        : 'Headless Chromium driver: installed in a temporary npm prefix for this check.')
    }

    console.log(`NAR-4.6 browser package preparation: complete in ${(performance.now() - preparationStartedAt).toFixed(1)} ms.`)
    console.log('NAR-4.6 browser helper import: start.')
    const helperStartedAt = performance.now()
    const browserTools = await import(pathToFileURL(browserToolsPath).href) as unknown as LocalBrowserTools
    console.log(`NAR-4.6 browser helper import: ${(performance.now() - helperStartedAt).toFixed(1)} ms.`)
    console.log('NAR-4.6 Chromium startup: start.')
    const launchStartedAt = performance.now()
    const browser = await browserTools.launchChromium()
    console.log(`NAR-4.6 Chromium startup: ${(performance.now() - launchStartedAt).toFixed(1)} ms.`)
    const version = `Chromium ${browser.version()}`
    console.log(`NAR-4.6 Chromium launched: ${version}.`)
    return {
      browser,
      version,
      cleanup,
    }
  } catch (error) {
    console.log(`NAR-4.6 browser preparation/startup failed after ${(performance.now() - preparationStartedAt).toFixed(1)} ms.`)
    cleanup()
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
  console.log('NAR-4.6 Node/cf-play parity repeats: start.')
  const nodeRunsStartedAt = performance.now()
  const cfPlayFirst = cases.map(({ seed, runtime, dt }) => runCycle(runtime, seed, dt))
  const cfPlaySecond = cases.map(({ seed, runtime, dt }) => runCycle(runtime, seed, dt))
  console.log(`NAR-4.6 Node/cf-play parity repeats: ${(performance.now() - nodeRunsStartedAt).toFixed(1)} ms.`)
  console.log('NAR-4.6 browser bundle build: start.')
  const bundleStartedAt = performance.now()
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
  console.log(`NAR-4.6 browser bundle build: ${(performance.now() - bundleStartedAt).toFixed(1)} ms.`)
  const browserSource = bundled.outputFiles[0]?.text
  if (!browserSource) throw new Error('NAR-4.6 browser bundle is empty')

  const { browser, version, cleanup } = await launchBrowserTools()
  try {
    console.log('NAR-4.6 browser replay 1/2: start.')
    const browserFirstStartedAt = performance.now()
    const browserFirst = await runInBrowser(browser, browserSource, cases)
    console.log(`NAR-4.6 browser replay 1/2: ${(performance.now() - browserFirstStartedAt).toFixed(1)} ms.`)
    console.log('NAR-4.6 browser replay 2/2: start.')
    const browserSecondStartedAt = performance.now()
    const browserSecond = await runInBrowser(browser, browserSource, cases)
    console.log(`NAR-4.6 browser replay 2/2: ${(performance.now() - browserSecondStartedAt).toFixed(1)} ms.`)
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
