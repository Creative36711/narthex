#!/usr/bin/env node
/** Prove that cf-play check rejects a deterministic warning-only campaign. */
import { spawn } from 'node:child_process'
import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { dirname, join, relative, resolve, sep } from 'node:path'
import { fileURLToPath } from 'node:url'
import JSZip from 'jszip'

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '../..')
const FIXTURE = join(ROOT, '_tools', 'fixtures', 'cf-play-warning')
const FIXTURE_LABEL = relative(ROOT, FIXTURE).split(sep).join('/')
const SOURCE_OUT = 'source'
const BUNDLE_OUT = 'bundle'
const KIT_OUT = 'unpacked-kit'
const TIMEOUT_MS = 120_000
const EXPECTED_WARNING = 'scene_dead_end: сцена «warning fixture: dead-end start scene» без навигации, и из локации «location_test» нет дорог'

function run(command, args, cwd = ROOT) {
  return new Promise((resolvePromise, rejectPromise) => {
    const child = spawn(command, args, { cwd, stdio: ['ignore', 'pipe', 'pipe'] })
    const stdout = []
    const stderr = []
    let timedOut = false
    const timer = setTimeout(() => {
      timedOut = true
      child.kill('SIGTERM')
      setTimeout(() => child.kill('SIGKILL'), 2_000).unref()
    }, TIMEOUT_MS)
    child.stdout.on('data', (chunk) => stdout.push(Buffer.from(chunk)))
    child.stderr.on('data', (chunk) => stderr.push(Buffer.from(chunk)))
    child.on('error', rejectPromise)
    child.on('close', (code, signal) => {
      clearTimeout(timer)
      resolvePromise({
        rc: timedOut ? 124 : Number.isInteger(code) ? code : 1,
        signal: signal ?? null,
        stdout: Buffer.concat(stdout).toString('utf8'),
        stderr: Buffer.concat(stderr).toString('utf8'),
      })
    })
  })
}

async function unpackKit(destination) {
  const archivePath = join(ROOT, 'dist-ai', '__chronicle_ai__-kit.zip')
  const archive = await JSZip.loadAsync(await readFile(archivePath))
  const kitRoot = join(destination, '__chronicle_ai__')
  for (const [archiveName, entry] of Object.entries(archive.files)) {
    if (entry.dir) continue
    const target = resolve(destination, archiveName)
    if (target !== destination && !target.startsWith(`${destination}${sep}`)) {
      throw new Error(`unsafe kit path: ${archiveName}`)
    }
    await mkdir(dirname(target), { recursive: true })
    await writeFile(target, await entry.async('nodebuffer'))
  }
  const cli = join(kitRoot, 'cf-play.mjs')
  await readFile(cli)
  return cli
}

async function summarize(execution, outDir) {
  try {
    const result = JSON.parse(await readFile(join(outDir, 'report.json'), 'utf8'))
    const errors = Array.isArray(result.graph?.errors) ? result.graph.errors : []
    const warnings = Array.isArray(result.graph?.warnings) ? result.graph.warnings : []
    const problems = Array.isArray(result.problems) ? result.problems : []
    const warning = warnings[0] ?? null
    const fatalDiagnostic = problems.find((problem) => String(problem).includes('warning не допускается')) ?? null
    const output = `${execution.stdout}\n${execution.stderr}`
    const pass = execution.rc === 1
      && result.verdict === 'failed'
      && errors.length === 0
      && warnings.length === 1
      && warning === EXPECTED_WARNING
      && output.includes(warning)
      && typeof fatalDiagnostic === 'string'
      && fatalDiagnostic === 'warning не допускается: 1'
      && output.includes(fatalDiagnostic)

    return {
      rc: execution.rc,
      verdict: result.verdict ?? null,
      errors: errors.length,
      warnings: warnings.length,
      warning,
      fatalDiagnostic,
      pass,
    }
  } catch (error) {
    return {
      rc: execution.rc,
      verdict: null,
      errors: null,
      warnings: null,
      warning: null,
      fatalDiagnostic: null,
      pass: false,
      error: String(error?.message ?? error),
    }
  }
}

async function probe(runCommand, outDir) {
  try {
    const execution = await runCommand(outDir)
    const summary = await summarize(execution, outDir)
    return { ...summary, signal: execution.signal }
  } catch (error) {
    return {
      rc: null,
      verdict: null,
      errors: null,
      warnings: null,
      warning: null,
      fatalDiagnostic: null,
      pass: false,
      error: String(error?.message ?? error),
    }
  }
}

const workDir = await mkdtemp(join(tmpdir(), 'cf-play-warning-negative-'))
let source
let bundle
let unpackedKit
try {
  const npm = process.platform === 'win32' ? 'npm.cmd' : 'npm'
  const kitBuild = await run(npm, ['run', '--silent', 'pack:ai-kit'])
  if (kitBuild.rc !== 0) throw new Error(`pack:ai-kit failed with rc=${kitBuild.rc}\n${kitBuild.stdout}\n${kitBuild.stderr}`)
  const kitCli = await unpackKit(join(workDir, KIT_OUT))

  source = await probe(
    (outDir) => run(npm, ['run', '--silent', 'play', '--', 'check', FIXTURE, '--out', outDir]),
    join(workDir, SOURCE_OUT),
  )
  bundle = await probe(
    (outDir) => run(process.execPath, [join(ROOT, 'public', 'ai', 'cf-play.mjs'), 'check', FIXTURE, '--out', outDir]),
    join(workDir, BUNDLE_OUT),
  )
  unpackedKit = await probe(
    (outDir) => run(process.execPath, [kitCli, 'check', FIXTURE, '--out', outDir]),
    join(workDir, KIT_OUT, 'reports'),
  )
} finally {
  await rm(workDir, { recursive: true, force: true })
}

const result = {
  fixture: FIXTURE_LABEL,
  source,
  bundle,
  unpackedKit,
  ok: source.pass && bundle.pass && unpackedKit.pass,
}

for (const [label, check] of [['source', source], ['bundle', bundle], ['unpacked-kit', unpackedKit]]) {
  console.log(`fixture ${label}: rc=${check.rc ?? 'n/a'} verdict=${check.verdict ?? 'n/a'} errors=${check.errors ?? 'n/a'} warnings=${check.warnings ?? 'n/a'}`)
  if (check.warning) console.log(`  warning: ${check.warning}`)
  if (check.fatalDiagnostic) console.log(`  fatal diagnostic: ${check.fatalDiagnostic}`)
  if (check.error) console.error(`  probe error: ${check.error}`)
  if (!check.pass) console.error(`  FAILED: expected rc=1, zero errors, exactly one warning, and «warning не допускается: 1»`)
}
console.log(`CF_PLAY_WARNING_NEGATIVE_RESULT ${JSON.stringify(result)}`)
if (!result.ok) process.exitCode = 1
