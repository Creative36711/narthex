#!/usr/bin/env node
/** Prove that cf-play check rejects a deterministic warning-only campaign. */
import { spawn } from 'node:child_process'
import { mkdtemp, readFile, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { dirname, join, relative, resolve, sep } from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '../..')
const FIXTURE = join(ROOT, '_tools', 'fixtures', 'cf-play-warning')
const FIXTURE_LABEL = relative(ROOT, FIXTURE).split(sep).join('/')
const SOURCE_OUT = 'source'
const BUNDLE_OUT = 'unpacked-kit'
const TIMEOUT_MS = 120_000

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

async function summarize(label, execution, outDir) {
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
      && typeof warning === 'string'
      && output.includes(warning)
      && typeof fatalDiagnostic === 'string'
      && fatalDiagnostic.includes('warning не допускается')
      && output.includes('warning не допускается')

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

async function probe(label, runCommand, outDir) {
  try {
    const execution = await runCommand(outDir)
    const summary = await summarize(label, execution, outDir)
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
try {
  const npm = process.platform === 'win32' ? 'npm.cmd' : 'npm'
  source = await probe(
    'source cf-play check',
    (outDir) => run(npm, ['run', '--silent', 'play', '--', 'check', FIXTURE, '--out', outDir]),
    join(workDir, SOURCE_OUT),
  )
  bundle = await probe(
    'unpacked-kit cf-play check',
    (outDir) => run(process.execPath, [join(ROOT, 'public', 'ai', 'cf-play.mjs'), 'check', FIXTURE, '--out', outDir]),
    join(workDir, BUNDLE_OUT),
  )
} finally {
  await rm(workDir, { recursive: true, force: true })
}

const result = {
  fixture: FIXTURE_LABEL,
  source,
  unpackedKit: bundle,
  ok: source.pass && bundle.pass,
}

for (const [label, check] of [['source', source], ['unpacked-kit', bundle]]) {
  console.log(`fixture ${label}: rc=${check.rc ?? 'n/a'} verdict=${check.verdict ?? 'n/a'} errors=${check.errors ?? 'n/a'} warnings=${check.warnings ?? 'n/a'}`)
  if (check.warning) console.log(`  warning: ${check.warning}`)
  if (check.fatalDiagnostic) console.log(`  fatal diagnostic: ${check.fatalDiagnostic}`)
  if (check.error) console.error(`  probe error: ${check.error}`)
  if (!check.pass) console.error(`  FAILED: warning must be fatal; expected rc=1, zero errors, exactly one warning, and the required diagnostic`)
}
console.log(`CF_PLAY_WARNING_NEGATIVE_RESULT ${JSON.stringify(result)}`)
if (!result.ok) process.exitCode = 1
