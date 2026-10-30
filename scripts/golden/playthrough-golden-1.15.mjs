#!/usr/bin/env node
/** GOLD-1.15 single entry: preserve GOLD-1.14 checks, then run the existing real-time soak. */
import { randomUUID } from 'node:crypto'
import { appendFileSync, existsSync, mkdirSync, rmSync, writeFileSync } from 'node:fs'
import { dirname, join, relative, resolve, sep } from 'node:path'
import { fileURLToPath } from 'node:url'
import { spawn } from 'node:child_process'
import { tmpdir } from 'node:os'

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '../..')
const BASE_RUNNER = join(ROOT, 'scripts', 'golden', 'playthrough-golden-1.14.mjs')
const REPORT_DIR = join(ROOT, '_tools', 'reports')
const REPORT_PATH = join(REPORT_DIR, 'GOLD-1.15.md')
const LOG_PATH = join(REPORT_DIR, 'GOLD-1.15.log')
const RUN_ID = randomUUID()
const STARTED_AT = new Date().toISOString()
const startedMs = Date.now()
const BASE_TIMEOUT_MS = 20 * 60 * 1000
const SOAK_TIMEOUT_MS = 75 * 60 * 1000

function appendLog(event, data = {}) {
  appendFileSync(LOG_PATH, `${JSON.stringify({
    at: new Date().toISOString(),
    task: 'GOLD-1.15',
    orchestratorRunId: RUN_ID,
    event,
    ...data,
  })}\n`)
}

function runProcess(command, args, timeoutMs, env = process.env) {
  return new Promise((resolvePromise) => {
    const child = spawn(command, args, {
      cwd: ROOT,
      env,
      detached: process.platform !== 'win32',
      stdio: ['ignore', 'pipe', 'pipe'],
    })
    const stdout = []
    const stderr = []
    let timedOut = false
    let spawnError = null
    const forward = (stream, target, chunks) => stream.on('data', (chunk) => {
      const bytes = Buffer.from(chunk)
      chunks.push(bytes)
      target.write(bytes)
    })
    forward(child.stdout, process.stdout, stdout)
    forward(child.stderr, process.stderr, stderr)
    child.on('error', (error) => { spawnError = error })
    const timer = setTimeout(() => {
      timedOut = true
      try {
        if (child.pid && process.platform !== 'win32') process.kill(-child.pid, 'SIGTERM')
        else child.kill('SIGTERM')
      } catch { /* process already exited */ }
      setTimeout(() => {
        try {
          if (child.pid && process.platform !== 'win32') process.kill(-child.pid, 'SIGKILL')
          else child.kill('SIGKILL')
        } catch { /* process already exited */ }
      }, 3000).unref()
    }, timeoutMs)
    child.on('close', (code, signal) => {
      clearTimeout(timer)
      resolvePromise({
        rc: timedOut ? 124 : Number.isInteger(code) ? code : 1,
        signal: signal ?? null,
        timedOut,
        error: spawnError ? String(spawnError.message ?? spawnError) : null,
        stdout: Buffer.concat(stdout).toString('utf8'),
        stderr: Buffer.concat(stderr).toString('utf8'),
      })
    })
  })
}

function writeFailureReport(base, soak, verdict) {
  const report = [
    '# GOLD-1.15 — one-hour golden playthrough from fresh game to first clue',
    '',
    `**Verdict:** ${verdict}`,
    `**Orchestrator run ID:** ${RUN_ID}`,
    `**Started:** ${STARTED_AT}`,
    '**Command:** npm run playthrough:golden; invokes the GOLD-1.14 checks and then the existing npm run golden:soak command.',
    `**Base campaign/warning checks rc:** ${base?.rc ?? 'not reached'}`,
    `**Soak rc:** ${soak?.rc ?? 'not reached'}`,
    '',
    'The soak did not produce a complete acceptance timeline. This report is a failure record; it does not claim the 3600-second oracle passed.',
    '',
    `- Report: ${relative(ROOT, REPORT_PATH).split(sep).join('/')}`,
    `- Full log: ${relative(ROOT, LOG_PATH).split(sep).join('/')}`,
  ].join('\n') + '\n'
  writeFileSync(REPORT_PATH, report)
}

mkdirSync(REPORT_DIR, { recursive: true })
rmSync(REPORT_PATH, { force: true })
writeFileSync(LOG_PATH, '')
console.log(`GOLD-1.15 start: ${RUN_ID}; common command=npm run playthrough:golden`)
console.log('GOLD-1.15 base command: node scripts/golden/playthrough-golden-1.14.mjs')
appendLog('orchestrator_start', {
  command: 'npm run playthrough:golden',
  baseCommand: 'node scripts/golden/playthrough-golden-1.14.mjs',
  soakCommand: 'npm run golden:soak',
  startedAt: STARTED_AT,
  ciRunId: process.env.GITHUB_RUN_ID ?? null,
  ciEvent: process.env.GITHUB_EVENT_NAME ?? null,
  ciSha: process.env.GITHUB_SHA ?? null,
})

let base
try {
  base = await runProcess(process.execPath, [BASE_RUNNER], BASE_TIMEOUT_MS)
} catch (error) {
  base = { rc: 1, signal: null, timedOut: false, error: String(error?.message ?? error), stdout: '', stderr: '' }
}
appendLog('base_playthrough_complete', { rc: base.rc, timedOut: base.timedOut, error: base.error })

let soak = null
if (base.rc === 0) {
  const npm = process.platform === 'win32' ? 'npm.cmd' : 'npm'
  const screenshotDir = join(tmpdir(), `golden-soak-GOLD-1.15-${RUN_ID}`)
  console.log('GOLD-1.15 invoking the existing soak now: npm run golden:soak')
  appendLog('soak_invoked', { command: 'npm run golden:soak', timeoutMs: SOAK_TIMEOUT_MS })
  try {
    soak = await runProcess(npm, ['run', 'golden:soak'], SOAK_TIMEOUT_MS, {
      ...process.env,
      GOLDEN_SOAK_TASK: 'GOLD-1.15',
      GOLDEN_SOAK_COMMAND: 'npm run playthrough:golden',
      GOLDEN_SOAK_ORCHESTRATOR_ID: RUN_ID,
      GOLDEN_BASE_PLAYTHROUGH_RC: String(base.rc),
      GOLDEN_SOAK_SCREENSHOT_DIR: screenshotDir,
    })
  } catch (error) {
    soak = { rc: 1, signal: null, timedOut: false, error: String(error?.message ?? error), stdout: '', stderr: '' }
  }
} else {
  console.error(`GOLD-1.15 skipped soak because base checks returned rc=${base.rc}; the common entry fails.`)
}

const rc = base.rc === 0 && soak?.rc === 0 ? 0 : 1
const elapsedMs = Date.now() - startedMs
const summary = {
  verdict: rc === 0 ? 'PASS' : 'FAIL',
  playthroughRc: rc,
  basePlaythroughRc: base.rc,
  soakRc: soak?.rc ?? null,
  elapsedMs,
  ciRunId: process.env.GITHUB_RUN_ID ?? null,
  ciEvent: process.env.GITHUB_EVENT_NAME ?? null,
  ciSha: process.env.GITHUB_SHA ?? null,
}
appendLog('orchestrator_complete', summary)
if (existsSync(REPORT_PATH)) {
  appendFileSync(REPORT_PATH, `\n## Combined entry result\n\n- npm run playthrough:golden rc=${rc}; base campaign/warning checks rc=${base.rc}; npm run golden:soak rc=${soak?.rc ?? 'not-run'}.\n- Orchestrator run ID: ${RUN_ID}; elapsed wall time: ${(elapsedMs / 1000).toFixed(1)} seconds.\n`)
}
console.log(`GOLD-1.15 RESULTS: playthroughRc=${rc} basePlaythroughRc=${base.rc} soakRc=${soak?.rc ?? 'not-run'} elapsedSeconds=${(elapsedMs / 1000).toFixed(1)} verdict=${summary.verdict}`)
console.log(`Report: ${relative(ROOT, REPORT_PATH).split(sep).join('/')}`)
console.log(`Log: ${relative(ROOT, LOG_PATH).split(sep).join('/')}`)

if (!existsSync(REPORT_PATH)) writeFailureReport(base, soak, summary.verdict)
if (!existsSync(LOG_PATH)) appendLog('orchestrator_log_missing', { rc })
if (rc !== 0) process.exitCode = 1
