#!/usr/bin/env node
/** GOLD-1.14 orchestrator: preserve the golden campaign run and add the warning-fatal probe. */
import { randomUUID } from 'node:crypto'
import { appendFileSync, existsSync, readFileSync } from 'node:fs'
import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises'
import { spawn } from 'node:child_process'
import { tmpdir } from 'node:os'
import { dirname, join, relative, resolve, sep } from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '../..')
const GOLDEN_RUNNER = join(ROOT, 'scripts', 'golden', 'playthrough-golden.mjs')
const GOLDEN_LOG = join(ROOT, '_tools', 'reports', 'GOLD-1.6.log')
const REPORT_DIR = join(ROOT, '_tools', 'reports')
const REPORT_PATH = join(REPORT_DIR, 'GOLD-1.14.md')
const LOG_PATH = join(REPORT_DIR, 'GOLD-1.14.log')
const FIXTURE = '_tools/fixtures/cf-play-warning'
const RUN_ID = randomUUID()
const STARTED_AT = new Date().toISOString()
const startedMs = Date.now()

function log(event, data = {}) {
  appendFileSync(LOG_PATH, `${JSON.stringify({ at: new Date().toISOString(), task: 'GOLD-1.14', runId: RUN_ID, event, ...data })}\n`)
}

function runProcess(command, args, timeoutMs) {
  return new Promise((resolvePromise, rejectPromise) => {
    const child = spawn(command, args, {
      cwd: ROOT,
      detached: process.platform !== 'win32',
      stdio: ['ignore', 'pipe', 'pipe'],
    })
    const stdout = []
    const stderr = []
    let timedOut = false
    const forward = (stream, target, chunks) => stream.on('data', (chunk) => {
      const bytes = Buffer.from(chunk)
      chunks.push(bytes)
      target.write(bytes)
    })
    forward(child.stdout, process.stdout, stdout)
    forward(child.stderr, process.stderr, stderr)
    child.on('error', rejectPromise)
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
        stdout: Buffer.concat(stdout).toString('utf8'),
        stderr: Buffer.concat(stderr).toString('utf8'),
      })
    })
  })
}

function structuredLines(path) {
  if (!existsSync(path)) return []
  return readFileSync(path, 'utf8').split(/\r?\n/).filter(Boolean).flatMap((line) => {
    try { return [JSON.parse(line)] } catch { return [] }
  })
}

function summarizeCampaignChecks(output, goldenRc) {
  const mainRunId = output.match(/GOLDEN playthrough start:\s*([0-9a-f-]+)/i)?.[1] ?? null
  const records = structuredLines(GOLDEN_LOG).filter((record) => record.runId === mainRunId)
  const sourceEvent = [...records].reverse().find((record) => record.event === 'cfplay_source_result')
  const kitEvent = [...records].reverse().find((record) => record.event === 'unpacked_kit_cfplay_result')
  const source = sourceEvent ? {
    rc: sourceEvent.rc,
    verdict: sourceEvent.verdict,
    errors: Array.isArray(sourceEvent.errors) ? sourceEvent.errors.length : null,
    warnings: Array.isArray(sourceEvent.warnings) ? sourceEvent.warnings.length : null,
  } : null
  const comparable = kitEvent?.comparable ?? null
  const kit = kitEvent ? {
    rc: kitEvent.rc,
    verdict: comparable?.verdict ?? null,
    errors: Array.isArray(comparable?.errors) ? comparable.errors.length : null,
    warnings: Array.isArray(comparable?.warnings) ? comparable.warnings.length : null,
    sourceMatches: kitEvent.sourceMatches ?? null,
  } : null
  return { goldenRunId: mainRunId, goldenRc, source, unpackedKit: kit }
}

async function runCampaignTextCheck() {
  const outDir = await mkdtemp(join(tmpdir(), 'gold14-cf-play-campaign-text-'))
  try {
    const npm = process.platform === 'win32' ? 'npm.cmd' : 'npm'
    const run = await runProcess(npm, [
      'run', '--silent', 'play', '--', 'check', '.golden/karkas', '--out', outDir,
    ], 5 * 60 * 1000)
    const output = `${run.stdout}\n${run.stderr}`
    const countMatch = output.match(/ошибок\s+(\d+)\s+·\s+предупреждений\s+(\d+)/)
    const errors = countMatch ? Number(countMatch[1]) : null
    const warnings = countMatch ? Number(countMatch[2]) : null
    const verdict = output.includes('✓ проверка пройдена') ? 'ok'
      : output.includes('✗ проверка не пройдена') ? 'failed' : null
    return {
      rc: run.rc,
      verdict,
      errors,
      warnings,
      printedCounts: countMatch !== null,
      outputTail: output.trim().slice(-1200),
      pass: run.rc === 0 && verdict === 'ok' && errors === 0 && warnings === 0,
    }
  } finally {
    await rm(outDir, { recursive: true, force: true })
  }
}

function parseNegativeMarker(output) {
  const prefix = 'CF_PLAY_WARNING_NEGATIVE_RESULT '
  const line = output.split(/\r?\n/).find((candidate) => candidate.startsWith(prefix))
  if (!line) return null
  try { return JSON.parse(line.slice(prefix.length)) } catch { return null }
}

function campaignPassed(campaign) {
  const source = campaign.source
  const kit = campaign.unpackedKit
  return campaign.goldenRc === 0
    && source?.rc === 0 && source.verdict === 'ok' && source.errors === 0 && source.warnings === 0
    && kit?.rc === 0 && kit.verdict === 'ok' && kit.errors === 0 && kit.warnings === 0 && kit.sourceMatches === true
    && campaign.humanText?.pass === true
}

function negativePassed(npmRc, negative) {
  const source = negative?.source
  const kit = negative?.unpackedKit
  return npmRc === 0
    && negative?.ok === true
    && source?.pass === true && source.rc === 1 && source.verdict === 'failed' && source.errors === 0 && source.warnings === 1
    && kit?.pass === true && kit.rc === 1 && kit.verdict === 'failed' && kit.errors === 0 && kit.warnings === 1
    && String(source.fatalDiagnostic ?? '').includes('warning не допускается')
    && String(kit.fatalDiagnostic ?? '').includes('warning не допускается')
}

function formatCode(value) {
  return value === null || value === undefined ? 'not reached' : `rc=${value}`
}

function renderReport(result) {
  const { campaign, negative } = result
  const source = campaign.source
  const kit = campaign.unpackedKit
  const fixtureSource = negative?.source
  const fixtureKit = negative?.unpackedKit
  const verdict = result.ok ? 'PASS' : 'FAIL'
  const sourceWarning = fixtureSource?.warning ?? 'not captured'
  const kitWarning = fixtureKit?.warning ?? 'not captured'
  const sourceFatal = fixtureSource?.fatalDiagnostic ?? 'not captured'
  const kitFatal = fixtureKit?.fatalDiagnostic ?? 'not captured'

  return `# GOLD-1.14 — warnings are fatal for \`cf-play check\`\n\n` +
    `**Verdict: ${verdict}.** The single entry \`npm run playthrough:golden\` returned rc=${result.wrapperRc}; ` +
    `the underlying golden campaign runner returned ${formatCode(campaign.goldenRc)} and ` +
    `\`npm run cf-play:negative\` returned ${formatCode(result.negativeNpmRc)}.\n\n` +
    `- Run ID: \`${RUN_ID}\`; golden-run ID: \`${campaign.goldenRunId ?? 'not captured'}\`.\n` +
    `- Fixture: \`${FIXTURE}/\` (warning-only; no errors).\n` +
    `- Started: ${STARTED_AT}; elapsed: ${(result.elapsedMs / 1000).toFixed(2)} seconds.\n\n` +
    `## Imported clean campaign\n\n` +
    `- Human-readable source \`cf-play check .golden/karkas\`: ${formatCode(campaign.humanText?.rc)}; printed verdict=${campaign.humanText?.verdict ?? 'not reached'}; errors=${campaign.humanText?.errors ?? 'n/a'}; warnings=${campaign.humanText?.warnings ?? 'n/a'}; both counts printed=${campaign.humanText?.printedCounts ?? false}.\n` +
    `- Source \`cf-play check .golden/karkas\`: ${formatCode(source?.rc)}; verdict=${source?.verdict ?? 'not reached'}; errors=${source?.errors ?? 'n/a'}; warnings=${source?.warnings ?? 'n/a'}.\n` +
    `- Unpacked AI-kit \`cf-play check .golden/karkas\`: ${formatCode(kit?.rc)}; verdict=${kit?.verdict ?? 'not reached'}; errors=${kit?.errors ?? 'n/a'}; warnings=${kit?.warnings ?? 'n/a'}; same result as source=${kit?.sourceMatches ?? 'n/a'}.\n\n` +
    `## Warning-only negative probe\n\n` +
    `- Fixture path: \`${FIXTURE}/\`.\n` +
    `- Source \`cf-play check\`: ${formatCode(fixtureSource?.rc)}; verdict=${fixtureSource?.verdict ?? 'not reached'}; errors=${fixtureSource?.errors ?? 'n/a'}; warnings=${fixtureSource?.warnings ?? 'n/a'}; \`${sourceFatal}\`.\n` +
    `- Unpacked AI-kit \`cf-play check\`: ${formatCode(fixtureKit?.rc)}; verdict=${fixtureKit?.verdict ?? 'not reached'}; errors=${fixtureKit?.errors ?? 'n/a'}; warnings=${fixtureKit?.warnings ?? 'n/a'}; \`${kitFatal}\`.\n` +
    `- Source warning: ${sourceWarning}.\n` +
    `- Unpacked-kit warning: ${kitWarning}.\n` +
    `- Both outputs contain the warning and the required text \`warning не допускается\`; the negative-probe npm command passes only when each actual cf-play check returns rc=1, reports 0 errors and exactly one warning.\n\n` +
    `## Wiring and bundle\n\n` +
    `- \`npm run playthrough:golden\` runs the existing golden campaign, then \`npm run cf-play:negative\`; \`.github/workflows/golden.yml\` also runs the negative script as an explicit adjacent CI step.\n` +
    `- \`public/ai/cf-play.mjs\` is the generated CLI shipped in the unpacked AI kit. It was rebuilt from \`scripts/playkit/cli.mts\` so the shipped command enforces the same warning-fatal verdict; the campaign and negative checks cover both source and bundle.\n` +
    `- No suppression flag, environment override, or warning filter was added.\n\n` +
    `## Scope and assumption\n\n` +
    `- \`campaign-1\`, \`.golden/karkas\`, \`src/core/**\`, and \`src/player/**\` were not edited; \`.golden/**\` remains uncommitted. The full golden run used an isolated test workspace.\n` +
    `- **Допущение:** the minimal fixture uses a reachable start scene with no navigation and no location roads, producing exactly one deterministic dead-end warning; a tiny FMV document preserves the normal narrative-pack entry event.\n\n` +
    `## CI\n\n` +
    `- Pull-request CI and the post-merge push check are recorded separately when available. This report records the exact local campaign and fixture return codes; the merge-push run must remain green.\n`
}

await mkdir(REPORT_DIR, { recursive: true })
log('run_start', { command: 'npm run playthrough:golden', fixture: FIXTURE })
console.log(`GOLD-1.14 start: ${RUN_ID}; fixture=${FIXTURE}`)

let goldenRun
try {
  goldenRun = await runProcess(process.execPath, [GOLDEN_RUNNER], 39 * 60 * 1000)
} catch (error) {
  goldenRun = { rc: 1, signal: null, timedOut: false, stdout: '', stderr: String(error?.message ?? error) }
  console.error(`GOLD-1.14 golden runner could not start: ${goldenRun.stderr}`)
}
const campaign = summarizeCampaignChecks(goldenRun.stdout, goldenRun.rc)
try {
  campaign.humanText = await runCampaignTextCheck()
} catch (error) {
  campaign.humanText = { rc: 1, verdict: null, errors: null, warnings: null, printedCounts: false, pass: false, error: String(error?.message ?? error) }
}
log('campaign_check_results', campaign)
log('campaign_text_result', campaign.humanText)

let negativeRun
try {
  const npm = process.platform === 'win32' ? 'npm.cmd' : 'npm'
  negativeRun = await runProcess(npm, ['run', '--silent', 'cf-play:negative'], 5 * 60 * 1000)
} catch (error) {
  negativeRun = { rc: 1, signal: null, timedOut: false, stdout: '', stderr: String(error?.message ?? error) }
  console.error(`GOLD-1.14 negative probe could not start: ${negativeRun.stderr}`)
}
const negative = parseNegativeMarker(`${negativeRun.stdout}\n${negativeRun.stderr}`)
log('warning_fixture_negative_probe', {
  fixture: negative?.fixture ?? FIXTURE,
  npmRc: negativeRun.rc,
  source: negative?.source ?? null,
  unpackedKit: negative?.unpackedKit ?? null,
  ok: negative?.ok ?? false,
  outputTail: `${negativeRun.stdout}\n${negativeRun.stderr}`.trim().slice(-2000),
})

const ok = campaignPassed(campaign) && negativePassed(negativeRun.rc, negative)
const wrapperRc = ok ? 0 : 1
const result = {
  ok,
  wrapperRc,
  campaign,
  negative,
  negativeNpmRc: negativeRun.rc,
  elapsedMs: Date.now() - startedMs,
}
log('run_complete', {
  verdict: ok ? 'PASS' : 'FAIL',
  wrapperRc,
  goldenRc: campaign.goldenRc,
  campaignTextRc: campaign.humanText?.rc ?? null,
  sourceCampaignRc: campaign.source?.rc ?? null,
  unpackedKitCampaignRc: campaign.unpackedKit?.rc ?? null,
  negativeScriptRc: negativeRun.rc,
  fixtureSourceRc: negative?.source?.rc ?? null,
  fixtureUnpackedKitRc: negative?.unpackedKit?.rc ?? null,
  elapsedMs: result.elapsedMs,
})

await writeFile(REPORT_PATH, renderReport(result), 'utf8')
log('report_written', { path: relative(ROOT, REPORT_PATH).split(sep).join('/'), verdict: ok ? 'PASS' : 'FAIL' })
console.log(
  `GOLD-1.14 RESULTS: playthroughRc=${wrapperRc} goldenRunnerRc=${campaign.goldenRc} ` +
  `campaignTextRc=${campaign.humanText?.rc ?? 'n/a'} campaignSourceRc=${campaign.source?.rc ?? 'n/a'} campaignUnpackedKitRc=${campaign.unpackedKit?.rc ?? 'n/a'} ` +
  `negativeScriptRc=${negativeRun.rc} fixtureSourceRc=${negative?.source?.rc ?? 'n/a'} ` +
  `fixtureUnpackedKitRc=${negative?.unpackedKit?.rc ?? 'n/a'} verdict=${ok ? 'PASS' : 'FAIL'}`,
)
console.log(`Report: ${relative(ROOT, REPORT_PATH).split(sep).join('/')}`)
console.log(`Log: ${relative(ROOT, LOG_PATH).split(sep).join('/')}`)
if (!ok) process.exitCode = 1
