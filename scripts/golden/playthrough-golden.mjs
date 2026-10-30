#!/usr/bin/env node
/**
 * GOLD-1.6 end-to-end oracle: import the pinned campaign, audit it, run both
 * cf-play checks (source and unpacked kit), then exercise the browser route
 * through the first clue and a save/reload/load cycle.
 *
 * Normal use: npm run playthrough:golden
 * Integrity probe: this file also has a verify-only mode used with a temporary
 * copy of the manifest. That path verifies size/hash and cannot extract files.
 */
import { createHash, randomUUID } from 'node:crypto'
import { appendFileSync, existsSync, readFileSync, writeFileSync } from 'node:fs'
import { createReadStream } from 'node:fs'
import { spawn } from 'node:child_process'
import { dirname, join, relative, resolve, sep } from 'node:path'
import { tmpdir } from 'node:os'
import { fileURLToPath } from 'node:url'
import { mkdtemp, mkdir, lstat, readdir, readFile, rename, rm, stat, writeFile } from 'node:fs/promises'

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '../..')
const SCRIPT_PATH = fileURLToPath(import.meta.url)
const GOLDEN_DIR = join(ROOT, '.golden')
const MANIFEST_PATH = join(GOLDEN_DIR, 'manifest.json')
const CAMPAIGN_ROOT = join(GOLDEN_DIR, 'karkas')
const CACHE_DIR = join(GOLDEN_DIR, '.cache')
const REPORT_ROOT = join(ROOT, '_tools', 'reports')
const OUTPUT_DIR = join(REPORT_ROOT, 'GOLD-1.6')
const REPORT_PATH = join(REPORT_ROOT, 'GOLD-1.6.md')
const LOG_PATH = join(REPORT_ROOT, 'GOLD-1.6.log')
const REPOSITORY = 'Creative36711/campaign-1'
const ARCHIVE_PREFIX = `https://codeload.github.com/${REPOSITORY}/tar.gz/`
const DOWNLOAD_TIMEOUT_MS = 15 * 60 * 1000
const CHILD_TIMEOUT_MS = 25 * 60 * 1000
const BROWSER_TIMEOUT_MS = 5 * 60 * 1000
const PNG_WIDTH = 1440
const PNG_HEIGHT = 900
const flags = parseFlags(process.argv.slice(2))
const runId = randomUUID()
const state = {
  runId,
  startedAt: new Date().toISOString(),
  startedMs: Date.now(),
  branch: null,
  manifest: null,
  import: null,
  negativeProbe: null,
  audit: null,
  cfPlay: null,
  kit: null,
  browser: null,
  browserRunLog: [],
  priorRuns: [],
  priorNegativeProbe: null,
  currentRunSummary: null,
  failures: [],
  verdict: 'RUNNING',
  elapsedMs: null,
  temporaryDirectories: [],
}

function parseFlags(argv) {
  const result = {}
  for (let i = 0; i < argv.length; i++) {
    const token = argv[i]
    if (!token.startsWith('--')) continue
    const key = token.slice(2)
    const next = argv[i + 1]
    if (next !== undefined && !next.startsWith('--')) {
      result[key] = next
      i++
    } else {
      result[key] = true
    }
  }
  return result
}

function compareText(left, right) {
  return left < right ? -1 : left > right ? 1 : 0
}

function log(event, data = {}) {
  const record = { at: new Date().toISOString(), task: 'GOLD-1.6', runId, event, ...data }
  appendFileSync(LOG_PATH, `${JSON.stringify(record)}\n`)
  return record
}

function errorText(error) {
  return String(error?.stack ?? error).slice(0, 5000)
}

function readPriorEvidence() {
  if (!existsSync(LOG_PATH)) return { runs: [], negativeProbe: null }
  const records = readFileSync(LOG_PATH, 'utf8').split(/\r?\n/).filter(Boolean).flatMap((line) => {
    try { return [JSON.parse(line)] } catch { return [] }
  })
  const previous = records.filter((record) => record.task === 'GOLD-1.6' && record.runId && record.runId !== runId)
  const runIds = [...new Set(previous.map((record) => record.runId))]
  const runs = runIds.map((id) => {
    const items = previous.filter((record) => record.runId === id)
    const completed = [...items].reverse().find((record) => record.event === 'run_complete')
    const failure = [...items].reverse().find((record) => record.event === 'run_failure' && !record.step)
    const imported = [...items].reverse().find((record) => record.event === 'import_complete')
    const manifestCheck = [...items].reverse().find((record) => record.event === 'manifest_verified')
    const audit = [...items].reverse().find((record) => record.event === 'audit_result')
    const cfPlay = [...items].reverse().find((record) => record.event === 'cfplay_source_result')
    const browser = [...items].reverse().find((record) => record.event === 'browser_error_summary')
    return {
      runId: id,
      verdict: completed?.verdict ?? (failure ? 'FAIL' : 'UNKNOWN'),
      archiveSource: completed?.archiveSource ?? imported?.source ?? 'n/a',
      treeCacheHit: completed?.treeCacheHit ?? imported?.treeCacheHit ?? manifestCheck?.treeCacheHit ?? false,
      auditErrors: completed?.auditErrors ?? audit?.errors ?? null,
      cfPlayErrors: completed?.cfPlayErrors ?? cfPlay?.errors?.length ?? null,
      pageerror: completed?.pageerror ?? browser?.pageerrorCount ?? null,
      emptyBackgrounds: completed?.emptyBackgrounds ?? browser?.emptyBackgrounds ?? null,
      failure: failure?.message ? String(failure.message).split(/\r?\n/, 1)[0] : null,
    }
  })
  const probeRecord = [...previous].reverse().find((record) => record.event === 'negative_sha_probe')
  return {
    runs,
    negativeProbe: probeRecord ? { ...probeRecord, probeRunId: probeRecord.runId } : null,
  }
}

function runProcess(command, args, options = {}) {
  const timeoutMs = options.timeoutMs ?? CHILD_TIMEOUT_MS
  const capture = options.capture !== false
  const forward = options.forward === true
  const maxOutputBytes = options.maxOutputBytes ?? 64 * 1024 * 1024
  return new Promise((resolvePromise, rejectPromise) => {
    let child
    try {
      child = spawn(command, args, {
        cwd: options.cwd ?? ROOT,
        env: { ...process.env, ...(options.env ?? {}) },
        detached: process.platform !== 'win32',
        stdio: ['ignore', 'pipe', 'pipe'],
      })
    } catch (error) {
      rejectPromise(error)
      return
    }

    const stdoutChunks = []
    const stderrChunks = []
    let stdoutBytes = 0
    let stderrBytes = 0
    let outputTruncated = false
    let timedOut = false
    const receive = (stream, chunks, type) => (chunk) => {
      if (forward) (type === 'stdout' ? process.stdout : process.stderr).write(chunk)
      if (!capture) return
      const bytes = Buffer.byteLength(chunk)
      if (stdoutBytes + stderrBytes + bytes > maxOutputBytes) {
        outputTruncated = true
        return
      }
      chunks.push(Buffer.from(chunk))
      if (type === 'stdout') stdoutBytes += bytes
      else stderrBytes += bytes
      if (options.onChunk) options.onChunk(type, String(chunk))
    }
    child.stdout.on('data', receive(child.stdout, stdoutChunks, 'stdout'))
    child.stderr.on('data', receive(child.stderr, stderrChunks, 'stderr'))
    child.on('error', rejectPromise)
    const timer = setTimeout(() => {
      timedOut = true
      try {
        if (child.pid && process.platform !== 'win32') process.kill(-child.pid, 'SIGTERM')
        else child.kill('SIGTERM')
      } catch { /* child already exited */ }
      setTimeout(() => {
        try {
          if (child.pid && process.platform !== 'win32') process.kill(-child.pid, 'SIGKILL')
          else child.kill('SIGKILL')
        } catch { /* child already exited */ }
      }, 3000).unref()
    }, timeoutMs)

    child.on('close', (code, signal) => {
      clearTimeout(timer)
      resolvePromise({
        code: timedOut ? 124 : Number.isInteger(code) ? code : 1,
        signal: signal ?? null,
        timedOut,
        outputTruncated,
        stdout: Buffer.concat(stdoutChunks).toString('utf8'),
        stderr: Buffer.concat(stderrChunks).toString('utf8'),
      })
    })
  })
}

function assertExitCode(result, label) {
  if (result.code !== 0) {
    const tail = `${result.stdout}\n${result.stderr}`.trim().slice(-5000)
    throw new Error(`${label} returned rc=${result.code}${result.timedOut ? ' (timeout)' : ''}${tail ? `\n${tail}` : ''}`)
  }
}

async function readManifest(path = MANIFEST_PATH) {
  const raw = JSON.parse(await readFile(path, 'utf8'))
  const commit = String(raw.commit ?? '')
  const url = String(raw.url ?? '')
  const sha256 = String(raw.sha256 ?? '').toLowerCase()
  const sizeBytes = Number(raw.size_bytes)
  if (raw.repository !== REPOSITORY) throw new Error(`manifest repository must be ${REPOSITORY}`)
  if (!/^[a-f0-9]{40}$/.test(commit)) throw new Error('manifest commit must be a full 40-character SHA')
  if (url !== `${ARCHIVE_PREFIX}${commit}`) throw new Error('manifest URL must be the codeload tarball for its pinned commit')
  if (!/^[a-f0-9]{64}$/.test(sha256)) throw new Error('manifest sha256 must be a 64-character hexadecimal digest')
  if (!Number.isSafeInteger(sizeBytes) || sizeBytes <= 0) throw new Error('manifest size_bytes must be a positive integer')
  return { ...raw, repository: REPOSITORY, commit, url, sha256, size_bytes: sizeBytes }
}

async function sha256File(path) {
  const hash = createHash('sha256')
  for await (const chunk of createReadStream(path)) hash.update(chunk)
  return hash.digest('hex')
}

async function verifyArchiveFile(manifest, archivePath) {
  const details = await stat(archivePath)
  if (!details.isFile()) throw new Error(`archive is not a regular file: ${archivePath}`)
  if (details.size !== manifest.size_bytes) {
    throw new Error(`archive size mismatch: expected ${manifest.size_bytes}, received ${details.size}`)
  }
  const actualSha256 = await sha256File(archivePath)
  if (actualSha256 !== manifest.sha256) {
    throw new Error(`archive sha256 mismatch: expected ${manifest.sha256}, received ${actualSha256}`)
  }
  return { bytes: details.size, sha256: actualSha256 }
}

async function inspectTree(root) {
  let rootStat
  try {
    rootStat = await lstat(root)
  } catch (error) {
    if (error?.code === 'ENOENT') return null
    throw error
  }
  if (!rootStat.isDirectory()) throw new Error(`campaign target is not a directory: ${root}`)

  const entries = []
  const walk = async (directory) => {
    const children = await readdir(directory, { withFileTypes: true })
    children.sort((a, b) => compareText(a.name, b.name))
    for (const child of children) {
      const absolute = join(directory, child.name)
      const path = relative(root, absolute).split(sep).join('/')
      const details = await lstat(absolute)
      if (details.isDirectory()) {
        entries.push({ type: 'directory', path, absolute, size: 0 })
        await walk(absolute)
      } else if (details.isFile()) {
        entries.push({ type: 'file', path, absolute, size: details.size })
      } else {
        throw new Error(`unsupported filesystem entry in campaign tree: ${path}`)
      }
    }
  }
  await walk(root)
  entries.sort((a, b) => compareText(a.path, b.path) || compareText(a.type, b.type))

  const hash = createHash('sha256')
  let files = 0
  let directories = 0
  let sizeBytes = 0
  for (const entry of entries) {
    if (entry.type === 'directory') {
      directories++
      hash.update(`directory\0${entry.path}\n`)
    } else {
      files++
      sizeBytes += entry.size
      hash.update(`file\0${entry.path}\0${entry.size}\0${await sha256File(entry.absolute)}\n`)
    }
  }
  return { sha256: hash.digest('hex'), files, directories, size_bytes: sizeBytes }
}

function treeMatchesManifest(tree, manifest) {
  const expected = manifest.tree
  return !!tree && !!expected && expected.archive_sha256 === manifest.sha256 &&
    tree.sha256 === expected.sha256 && tree.files === expected.files &&
    tree.directories === expected.directories && tree.size_bytes === expected.size_bytes
}

async function downloadVerifiedArchive(manifest) {
  await mkdir(CACHE_DIR, { recursive: true })
  const archivePath = join(CACHE_DIR, `${manifest.sha256}.tar.gz`)
  const partialPath = `${archivePath}.partial-${process.pid}`

  if (existsSync(archivePath)) {
    try {
      const cached = await verifyArchiveFile(manifest, archivePath)
      log('archive_cache_verified', { path: relative(ROOT, archivePath), ...cached })
      return { path: archivePath, ...cached, source: 'verified-cache' }
    } catch (error) {
      await rm(archivePath, { force: true })
      log('archive_cache_rejected', { path: relative(ROOT, archivePath), message: String(error?.message ?? error) })
    }
  }

  let lastError
  for (let attempt = 1; attempt <= 3; attempt++) {
    log('archive_download_start', { url: manifest.url, expectedBytes: manifest.size_bytes, expectedSha256: manifest.sha256, attempt })
    try {
      const result = await runProcess('curl', [
        '--fail', '--location', '--silent', '--show-error',
        '--connect-timeout', '60', '--max-time', String(DOWNLOAD_TIMEOUT_MS / 1000),
        '--output', partialPath, '--write-out', '%{http_code}', manifest.url,
      ], { timeoutMs: DOWNLOAD_TIMEOUT_MS + 5000, maxOutputBytes: 1024 * 1024 })
      if (result.code !== 0) throw new Error(`curl exited ${result.code}: ${result.stderr.trim()}`)
      const httpStatus = result.stdout.trim()
      if (httpStatus !== '200') throw new Error(`archive download returned HTTP ${httpStatus || '(unknown)'}`)
      const verified = await verifyArchiveFile(manifest, partialPath)
      await rename(partialPath, archivePath)
      log('archive_download_verified', { path: relative(ROOT, archivePath), ...verified, attempt })
      return { path: archivePath, ...verified, source: 'download' }
    } catch (error) {
      lastError = error
      await rm(partialPath, { force: true }).catch(() => undefined)
      const message = String(error?.message ?? error)
      if (/size mismatch|sha256 mismatch/.test(message)) throw error
      if (attempt === 3) break
      await new Promise((resolvePromise) => setTimeout(resolvePromise, attempt * 1000))
      log('archive_download_retry', { attempt, message })
    }
  }
  throw new Error(`archive download failed after 3 attempts: ${String(lastError?.message ?? lastError)}`)
}

function tamperSha256(value) {
  const replacement = value[0] === '0' ? '1' : '0'
  return replacement + value.slice(1)
}

async function runNegativeShaProbe(manifest, archivePath) {
  const before = await inspectTree(CAMPAIGN_ROOT)
  const manifestShaBefore = await sha256File(MANIFEST_PATH)
  const tempDir = await mkdtemp(join(tmpdir(), 'golden-1.6-sha-probe-'))
  state.temporaryDirectories.push(tempDir)
  const tampered = { ...manifest, sha256: tamperSha256(manifest.sha256) }
  const copyPath = join(tempDir, 'manifest-copy.json')
  await writeFile(copyPath, `${JSON.stringify(tampered, null, 2)}\n`, 'utf8')
  const result = await runProcess(process.execPath, [
    SCRIPT_PATH,
    '--verify-only',
    '--manifest', copyPath,
    '--archive', archivePath,
  ], { cwd: ROOT, timeoutMs: 60_000, maxOutputBytes: 1024 * 1024 })
  const message = `${result.stdout}\n${result.stderr}`
  const after = await inspectTree(CAMPAIGN_ROOT)
  const manifestShaAfter = await sha256File(MANIFEST_PATH)
  const unchanged = JSON.stringify(before) === JSON.stringify(after)
  const manifestUnchanged = manifestShaBefore === manifestShaAfter
  const passed = result.code === 1 && /archive sha256 mismatch/i.test(message) && unchanged && manifestUnchanged
  state.negativeProbe = {
    manifestCopy: 'temporary copy only; .golden/manifest.json unchanged',
    originalSha256: manifest.sha256,
    originalManifestFileSha256: manifestShaBefore,
    manifestUnchanged,
    tamperedSha256: tampered.sha256,
    archiveBytes: manifest.size_bytes,
    expectedExitCode: 1,
    actualExitCode: result.code,
    extractionStarted: false,
    campaignTreeUnchanged: unchanged,
    campaignTreeBefore: before ? { files: before.files, directories: before.directories, bytes: before.size_bytes, sha256: before.sha256 } : null,
    campaignTreeAfter: after ? { files: after.files, directories: after.directories, bytes: after.size_bytes, sha256: after.sha256 } : null,
    diagnostic: message.trim().slice(-1200),
    verdict: passed ? 'PASS' : 'FAIL',
  }
  log('negative_sha_probe', state.negativeProbe)
  if (!passed) throw new Error(`tampered-manifest negative probe did not fail safely: ${JSON.stringify(state.negativeProbe)}`)
  console.log(`NEGATIVE SHA PROBE PASS: rc=${result.code}, no extraction, campaign tree unchanged`)
  return state.negativeProbe
}

function parseJsonOutput(result, label) {
  if (result.code !== 0) {
    const tail = `${result.stdout}\n${result.stderr}`.trim().slice(-5000)
    throw new Error(`${label} returned rc=${result.code}${tail ? `\n${tail}` : ''}`)
  }
  try {
    return JSON.parse(result.stdout)
  } catch (error) {
    throw new Error(`${label} did not emit valid JSON: ${String(error)}\n${result.stdout.slice(0, 2000)}`)
  }
}

function countAuditFindings(report) {
  const findings = [
    ...(Array.isArray(report?.structure) ? report.structure : []),
    ...(Array.isArray(report?.media) ? report.media : []),
    ...(Array.isArray(report?.playtest) ? report.playtest : []),
  ]
  return {
    errors: findings.filter((item) => item.severity === 'error').length,
    warnings: findings.filter((item) => item.severity === 'warning').length,
    info: findings.filter((item) => item.severity === 'info').length,
    findings,
  }
}

function cfPlayComparable(result) {
  const counts = result?.graph?.counts ?? {}
  return {
    verdict: result?.verdict ?? null,
    scenes: counts.scenes ?? null,
    locations: counts.locations ?? null,
    dialogues: counts.dialogues ?? null,
    inkKnots: counts.inkKnots ?? null,
    errors: result?.graph?.errors ?? [],
    warnings: result?.graph?.warnings ?? [],
  }
}

async function checkCfPlay(label, command, args, outDir) {
  const result = await runProcess(command, [...args, '--json', '--out', outDir], { timeoutMs: CHILD_TIMEOUT_MS, maxOutputBytes: 64 * 1024 * 1024 })
  const parsed = parseJsonOutput(result, label)
  const comparable = cfPlayComparable(parsed)
  return {
    label,
    rc: result.code,
    verdict: parsed.verdict,
    counts: parsed.graph?.counts ?? {},
    errors: parsed.graph?.errors ?? [],
    warnings: parsed.graph?.warnings ?? [],
    coverage: parsed.coverage ?? null,
    sweep: parsed.sweep ?? null,
    comparable,
  }
}

function formatFindings(findings = []) {
  if (!findings.length) return '- (нет)'
  return findings.map((finding) => `- ${finding.severity}: ${finding.message}`).join('\n')
}

function pngDimensions(path) {
  const bytes = readFileSync(path)
  if (bytes.length < 24 || bytes.toString('hex', 0, 8) !== '89504e470d0a1a0a') return null
  return { width: bytes.readUInt32BE(16), height: bytes.readUInt32BE(20), bytes: bytes.length }
}

function browserCheckpoints(summary) {
  return [
    ['menu', summary.menu],
    ['hero', summary.hero],
    ['gate', summary.gate],
    ['map', summary.routeMap],
    ['machine hall', summary.machineHall],
    ['first clue', summary.firstClue],
    ['before save', summary.beforeSave],
    ['after reload menu', summary.afterReloadMenu],
    ['after load', summary.afterLoad],
  ].filter(([, checkpoint]) => checkpoint?.screenshot)
}

function ciWorkflowText(ci = null) {
  const workflowYaml = readFileSync(join(ROOT, '.github', 'workflows', 'golden.yml'), 'utf8').trimEnd()
  const statusLine = ci?.runId
    ? `- CI run: \`${ci.runId}\`, job \`golden-playthrough\`, status **${ci.status}** ([run](${ci.url ?? `https://github.com/Creative36711/narthex/actions/runs/${ci.runId}`})).`
    : '- CI run: pending; the path-filtered `golden-playthrough` workflow runs on this pull request.'
  return [
    '## CI workflow',
    '',
    '- Workflow file: `.github/workflows/golden.yml`.',
    '- Triggers: pull requests to `main` and pushes to `main`, filtered to the workflow, pinned manifest, package/runtime, UI, engine, pack and test paths; also `workflow_dispatch`.',
    '- Job: `golden-playthrough`; Ubuntu latest; timeout: 45 minutes.',
    "- Cache: `.golden`, keyed by runner OS and `hashFiles('.golden/manifest.json')`.",
    `- CI artifact: \`GOLD-1.6-${ci?.runId ?? '<run-id>'}\` (14-day retention; report, JSONL log and PNG screenshots).`,
    statusLine,
    '',
    '### Workflow YAML',
    '',
    '```yaml',
    workflowYaml,
    '```',
    '',
  ].join('\n')
}

function renderReport(reportState) {
  const manifest = reportState.manifest
  const tree = reportState.tree
  const audit = reportState.audit
  const source = reportState.cfPlay?.source
  const kit = reportState.kit
  const browser = reportState.browser
  const summary = browser?.summary
  const diagnostics = summary?.browser
  const screenshots = summary ? browserCheckpoints(summary).map(([name, checkpoint]) => {
    const shot = checkpoint.screenshot
    return `| ${name} | \`${shot.path}\` | ${shot.width}×${shot.height} | ${shot.bytes} |`
  }).join('\n') : '- (not captured)'
  const browserDuration = browser?.elapsedMs != null ? `${(browser.elapsedMs / 1000).toFixed(2)} s` : 'n/a'
  const browserRoute = summary
    ? `- First clue found: **${summary.clueFound ? 'yes' : 'no'}** in ${summary.clueAttempts?.length ?? 0} attempt(s); text: ${JSON.stringify(summary.clueAttempts?.find((item) => item.success)?.message ?? null)}\n- Save/load: **${summary.persistence?.verdict ?? 'not run'}**; discrepancies=${summary.persistence?.discrepancyCount ?? 'n/a'}; slot=${summary.persistence?.slot ?? 'n/a'}; restored flags: ${JSON.stringify(summary.persistence?.requiredFlagValuesAfterLoad ?? {})}\n- Browser duration: **${browserDuration}**.`
    : '- Browser route did not complete.'
  const consoleLines = diagnostics?.consoleErrors?.length
    ? diagnostics.consoleErrors.map((item) => `- ${item.step}: ${item.text}`).join('\n')
    : '- (none)'
  const auditCounts = audit?.counts
  const cfCounts = source?.counts ?? {}
  const coverage = source?.coverage
  const coverageText = coverage
    ? `${coverage.visited}/${coverage.total}; seen: ${(coverage.seen ?? []).join(', ') || '(none)'}; uncovered: ${(coverage.uncovered ?? []).join(', ') || '(none)'}`
    : 'n/a'
  const browserScenes = summary
    ? `gate=${summary.gate?.sceneId ?? 'n/a'}, machine hall=${summary.machineHall?.sceneId ?? 'n/a'}, first clue=${summary.firstClue?.sceneId ?? 'n/a'}`
    : 'n/a'
  const totalElapsed = reportState.elapsedMs != null ? `${(reportState.elapsedMs / 1000).toFixed(2)} s` : 'n/a'
  const negativeProbe = reportState.negativeProbe ?? reportState.priorNegativeProbe
  const negative = negativeProbe
    ? `- Probe run: \`${negativeProbe.probeRunId ?? negativeProbe.runId ?? reportState.runId}\`; temporary copied manifest with tampered SHA; result: **${negativeProbe.verdict}**, rc=${negativeProbe.actualExitCode} (expected 1); ` +
      `SHA ${negativeProbe.tamperedSha256} did not match the archive; extractionStarted=${negativeProbe.extractionStarted}; ` +
      `campaign tree unchanged=${negativeProbe.campaignTreeUnchanged}; .golden/manifest.json unchanged=${negativeProbe.manifestUnchanged} (SHA-256 ${negativeProbe.originalManifestFileSha256}).\n- Diagnostic: \`${negativeProbe.diagnostic.replace(/`/g, '\\`')}\``
    : reportState.import?.treeCacheHit
      ? '- Not repeated on this cached-tree invocation; no earlier negative-probe record was present in the append-only log.'
      : '- Negative SHA probe did not complete before the current run stopped.'
  const currentHistoryRow = reportState.currentRunSummary ?? (reportState.verdict === 'FAIL' ? {
    runId: reportState.runId,
    verdict: reportState.verdict,
    archiveSource: reportState.import?.source,
    treeCacheHit: reportState.import?.treeCacheHit,
    auditErrors: reportState.audit?.counts.errors,
    cfPlayErrors: reportState.cfPlay?.source?.errors?.length,
    pageerror: reportState.browser?.summary?.browser?.pageerrorCount,
    emptyBackgrounds: reportState.browser?.summary?.browser?.emptyBackgrounds,
    failure: reportState.failures[0]?.split(/\r?\n/, 1)[0] ?? null,
  } : null)
  const runRows = [...reportState.priorRuns, ...(currentHistoryRow ? [currentHistoryRow] : [])]
  const runHistory = runRows.length
    ? `| Run ID | Archive path | Tree-cache hit | Audit errors | cf-play errors | Browser pageerrors / empty backgrounds | Verdict | Failure / detail |\n|---|---|---:|---:|---:|---:|---|---|\n${runRows.map((item) => `| \`${item.runId}\` | ${item.archiveSource ?? 'n/a'} | ${item.treeCacheHit ? 'yes' : 'no'} | ${item.auditErrors ?? 'n/a'} | ${item.cfPlayErrors ?? 'n/a'} | ${item.pageerror ?? 'n/a'} / ${item.emptyBackgrounds ?? 'n/a'} | ${item.verdict ?? 'unknown'} | ${(item.failure ?? '—').replace(/\|/g, '\\|').slice(0, 180)} |`).join('\n')}`
    : '- No completed runs recorded.'
  const sourceWarnings = (source?.warnings ?? []).length ? formatFindings((source.warnings ?? []).map((message) => ({ severity: 'warning', message }))) : '- (нет)'
  const kitComparable = kit?.comparable ?? null
  const cfParity = source && kit ? JSON.stringify(source.comparable) === JSON.stringify(kitComparable) : false
  const failureText = reportState.failures.length
    ? `\n## Failure details\n\n${reportState.failures.map((failure) => `- ${failure}`).join('\n')}\n`
    : ''

  return `# GOLD-1.6 — One-command golden playthrough\n\n` +
    `**Verdict: ${reportState.verdict}.**\n\n` +
    `- Run ID: \`${reportState.runId}\`; branch: \`${reportState.branch ?? 'unknown'}\`; total command duration: **${totalElapsed}**.\n` +
    `- Command: \`npm run playthrough:golden\`; importer: \`npm run golden:import\`.\n` +
    `- Archive: ${manifest ? `\`${manifest.size_bytes}\` bytes, SHA-256 \`${manifest.sha256}\`, commit \`${manifest.commit}\`; URL: ${manifest.url}.` : 'manifest not read.'}\n` +
    `- Imported tree: ${tree ? `\`${tree.files}\` files / \`${tree.directories}\` directories / \`${tree.size_bytes}\` bytes; SHA-256 \`${tree.sha256}\`.` : 'not imported.'}\n` +
    `- Import mode: ${reportState.import?.source ?? 'n/a'}; importer rc=${reportState.import?.rc ?? 'n/a'}; verified tree cache hit=${reportState.import?.treeCacheHit ?? 'n/a'}.\n\n` +
    `## Cold-import and cached-repeat runs\n\n${runHistory}\n\n` +
    `## Audit and playkit checks\n\n` +
    `- \`audit:campaign\`: rc=${audit?.rc ?? 'n/a'}; errors=${auditCounts?.errors ?? 'n/a'}; warnings=${auditCounts?.warnings ?? 'n/a'}; info=${auditCounts?.info ?? 'n/a'}.\n` +
    `- Audit warnings:\n${auditCounts ? formatFindings(auditCounts.findings.filter((finding) => finding.severity === 'warning')) : '- (not run)'}\n` +
    `- Source \`cf-play check\`: rc=${source?.rc ?? 'n/a'}; scenes=${cfCounts.scenes ?? 'n/a'}; locations=${cfCounts.locations ?? 'n/a'}; dialogues=${cfCounts.dialogues ?? 'n/a'}; Ink nodes=${cfCounts.inkKnots ?? 'n/a'}; errors=${source?.errors?.length ?? 'n/a'}; warnings=${source?.warnings?.length ?? 'n/a'}.\n` +
    `- cf-play scene coverage: ${coverageText}.\n` +
    `- Browser route scene IDs: ${browserScenes}.\n` +
    `- Source cf-play warnings:\n${sourceWarnings}\n` +
    `- Unpacked AI kit cf-play: rc=${kit?.rc ?? 'n/a'}; same result as source=${cfParity}; comparable=${kitComparable ? JSON.stringify(kitComparable) : 'not run'}.\n\n` +
    `## Browser route and persistence\n\n` +
    `Menu → hero → gate → machine hall → first clue, then save, page reload/Continue, and manual-slot load.\n\n${browserRoute}\n\n` +
    `- Browser: ${browser?.browserVersion ?? 'n/a'}; viewport ${PNG_WIDTH}×${PNG_HEIGHT}.\n` +
    `- pageerror=${diagnostics?.pageerrorCount ?? 'n/a'}; empty backgrounds=${diagnostics?.emptyBackgrounds ?? 'n/a'} across ${diagnostics?.checkpointCount ?? 'n/a'} checkpoints.\n` +
    `- Console errors=${diagnostics?.consoleErrorCount ?? 'n/a'}; HTTP errors=${diagnostics?.httpErrorCount ?? 'n/a'} (optional project.json 404s=${summary?.projectJson404Count ?? 'n/a'}; unclassified=${diagnostics ? Math.max(0, diagnostics.httpErrorCount - (summary?.projectJson404Count ?? 0)) : 'n/a'}); request failures=${diagnostics?.requestFailureCount ?? 'n/a'}.\n` +
    `- Console error text:\n${consoleLines}\n\n` +
    `### Screenshots\n\n| Checkpoint | File | Dimensions | Bytes |\n|---|---|---:|---:|\n${screenshots}\n\n` +
    `## SHA negative probe\n\n${negative}\n\n` +
    `## Artifacts\n\n- Report: \`_tools/reports/GOLD-1.6.md\`\n- Log: \`_tools/reports/GOLD-1.6.log\`\n- Screenshots: \`_tools/reports/GOLD-1.6/\`\n` +
    ciWorkflowText(reportState.ci) + failureText
}

async function writeReport() {
  state.elapsedMs ??= Date.now() - state.startedMs
  await mkdir(REPORT_ROOT, { recursive: true })
  await writeFile(REPORT_PATH, renderReport(state), 'utf8')
}

async function verifyOnlyMode() {
  try {
    const manifestPath = flags.manifest ? resolve(String(flags.manifest)) : null
    const archivePath = flags.archive ? resolve(String(flags.archive)) : null
    if (!manifestPath || !archivePath) throw new Error('--verify-only requires --manifest and --archive')
    const manifest = await readManifest(manifestPath)
    const verified = await verifyArchiveFile(manifest, archivePath)
    console.log(`ARCHIVE VERIFY PASS: ${verified.bytes} bytes sha256=${verified.sha256}`)
    return 0
  } catch (error) {
    console.error(`ARCHIVE VERIFY FAIL: ${String(error?.message ?? error)}`)
    return 1
  }
}

async function main() {
  await mkdir(REPORT_ROOT, { recursive: true })
  await mkdir(OUTPUT_DIR, { recursive: true })
  if (!existsSync(LOG_PATH)) writeFileSync(LOG_PATH, '')
  const priorEvidence = readPriorEvidence()
  state.priorRuns = priorEvidence.runs
  state.priorNegativeProbe = priorEvidence.negativeProbe
  state.branch = (await runProcess('git', ['branch', '--show-current'], { timeoutMs: 10_000 })).stdout.trim()
  log('run_start', { command: 'npm run playthrough:golden', branch: state.branch, manifest: relative(ROOT, MANIFEST_PATH) })
  console.log(`GOLDEN playthrough start: ${runId}`)

  try {
    const manifest = await readManifest(MANIFEST_PATH)
    state.manifest = manifest
    const treeBefore = await inspectTree(CAMPAIGN_ROOT)
    const treeCacheHit = treeMatchesManifest(treeBefore, manifest)
    log('manifest_verified', {
      repository: manifest.repository,
      commit: manifest.commit,
      url: manifest.url,
      archiveSha256: manifest.sha256,
      archiveBytes: manifest.size_bytes,
      treeCacheHit,
      existingTree: treeBefore,
    })

    let archive = null
    if (!treeCacheHit) {
      archive = await downloadVerifiedArchive(manifest)
      await runNegativeShaProbe(manifest, archive.path)
    }

    const importStarted = Date.now()
    const importer = await runProcess('npm', ['run', 'golden:import'], { timeoutMs: DOWNLOAD_TIMEOUT_MS + 120_000, maxOutputBytes: 8 * 1024 * 1024 })
    for (const line of importer.stdout.split(/\r?\n/).filter(Boolean)) log('importer_stdout', { line })
    for (const line of importer.stderr.split(/\r?\n/).filter(Boolean)) log('importer_stderr', { line })
    state.import = {
      rc: importer.code,
      source: archive?.source ?? (treeCacheHit ? 'verified-extracted-tree-cache' : 'importer-managed-archive-cache'),
      treeCacheHit,
      elapsedMs: Date.now() - importStarted,
      outputTruncated: importer.outputTruncated,
    }
    log('import_complete', state.import)
    assertExitCode(importer, 'npm run golden:import')

    const importedManifest = await readManifest(MANIFEST_PATH)
    const importedTree = await inspectTree(CAMPAIGN_ROOT)
    if (!treeMatchesManifest(importedTree, importedManifest)) {
      throw new Error(`imported campaign tree does not match manifest: ${JSON.stringify({ expected: importedManifest.tree, actual: importedTree })}`)
    }
    state.manifest = importedManifest
    state.tree = { ...importedTree, archive_sha256: importedManifest.sha256 }
    log('tree_verified', state.tree)

    const auditStarted = Date.now()
    const auditRun = await runProcess('npm', ['run', '--silent', 'audit:campaign', '--', CAMPAIGN_ROOT, '--json'], { timeoutMs: CHILD_TIMEOUT_MS, maxOutputBytes: 64 * 1024 * 1024 })
    const auditReport = parseJsonOutput(auditRun, 'audit:campaign')
    const auditCounts = countAuditFindings(auditReport)
    state.audit = { rc: auditRun.code, counts: auditCounts, checkedAt: auditReport.checkedAt, elapsedMs: Date.now() - auditStarted }
    log('audit_result', {
      rc: state.audit.rc,
      elapsedMs: state.audit.elapsedMs,
      errors: auditCounts.errors,
      warnings: auditCounts.warnings,
      info: auditCounts.info,
      warningText: auditCounts.findings.filter((finding) => finding.severity === 'warning').map((finding) => finding.message),
    })
    if (auditRun.code !== 0 || auditCounts.errors !== 0) throw new Error(`audit:campaign failed: rc=${auditRun.code}, errors=${auditCounts.errors}`)

    const sourceOut = await mkdtemp(join(tmpdir(), 'golden-1.6-cfplay-source-'))
    state.temporaryDirectories.push(sourceOut)
    const cfPlayStarted = Date.now()
    const source = await checkCfPlay('source cf-play check', 'npm', ['run', '--silent', 'play', '--', 'check', CAMPAIGN_ROOT], sourceOut)
    state.cfPlay = { source, elapsedMs: Date.now() - cfPlayStarted }
    log('cfplay_source_result', { ...source, elapsedMs: state.cfPlay.elapsedMs })
    if (source.rc !== 0 || source.verdict !== 'ok' || source.errors.length !== 0 || source.warnings.length !== 0) {
      throw new Error(`source cf-play check failed: rc=${source.rc}, verdict=${source.verdict}, errors=${source.errors.length}, warnings=${source.warnings.length}`)
    }

    const packStarted = Date.now()
    const packResult = await runProcess('npm', ['run', '--silent', 'pack:ai-kit'], { timeoutMs: CHILD_TIMEOUT_MS, maxOutputBytes: 8 * 1024 * 1024 })
    assertExitCode(packResult, 'npm run pack:ai-kit')
    const kitZip = join(ROOT, 'dist-ai', '__chronicle_ai__-kit.zip')
    if (!existsSync(kitZip)) throw new Error(`AI kit archive was not created: ${kitZip}`)
    const kitDir = await mkdtemp(join(tmpdir(), 'golden-1.6-kit-unpacked-'))
    state.temporaryDirectories.push(kitDir)
    const unzip = await runProcess('unzip', ['-q', kitZip, '-d', kitDir], { timeoutMs: CHILD_TIMEOUT_MS, maxOutputBytes: 2 * 1024 * 1024 })
    assertExitCode(unzip, 'unpack AI kit')
    const unpackedCli = join(kitDir, '__chronicle_ai__', 'cf-play.mjs')
    if (!existsSync(unpackedCli)) throw new Error('unpacked AI kit does not contain __chronicle_ai__/cf-play.mjs')
    const kitOut = join(kitDir, 'cf-play-check')
    await mkdir(kitOut, { recursive: true })
    const kitCheck = await checkCfPlay('unpacked AI-kit cf-play check', process.execPath, [unpackedCli, 'check', CAMPAIGN_ROOT], kitOut)
    const comparableMatches = JSON.stringify(kitCheck.comparable) === JSON.stringify(source.comparable)
    state.kit = { rc: kitCheck.rc, comparable: kitCheck.comparable, cfPlay: kitCheck, sourceMatches: comparableMatches, elapsedMs: Date.now() - packStarted }
    log('unpacked_kit_cfplay_result', { rc: state.kit.rc, sourceMatches: comparableMatches, comparable: state.kit.comparable, elapsedMs: state.kit.elapsedMs })
    if (kitCheck.rc !== 0 || kitCheck.verdict !== 'ok' || kitCheck.errors.length !== 0 || kitCheck.warnings.length !== 0 || !comparableMatches) {
      throw new Error(`unpacked AI-kit cf-play result differed from source: ${JSON.stringify({ source: source.comparable, kit: kitCheck.comparable, rc: kitCheck.rc, errors: kitCheck.errors.length, warnings: kitCheck.warnings.length })}`)
    }

    const browserStarted = Date.now()
    const browserRun = await runProcess(process.execPath, [join(ROOT, 'scripts', 'golden', 'play.mjs'), '--save-load'], {
      timeoutMs: BROWSER_TIMEOUT_MS,
      capture: false,
      forward: true,
      env: {
        GOLDEN_TASK: 'GOLD-1.6',
        GOLDEN_RUN_ID: runId,
        GOLDEN_APPEND_LOG: '1',
        GOLDEN_COMMAND: 'npm run playthrough:golden',
      },
    })
    state.browser = { rc: browserRun.code, elapsedMs: Date.now() - browserStarted }
    const logRows = readFileSync(LOG_PATH, 'utf8').split(/\r?\n/).filter(Boolean).map((line) => {
      try { return JSON.parse(line) } catch { return null }
    }).filter(Boolean)
    state.browserRunLog = logRows.filter((record) => record.runId === runId)
    const browserReady = state.browserRunLog.find((record) => record.event === 'browser_ready')
    const browserSummaryRecord = [...state.browserRunLog].reverse().find((record) => record.event === 'run_summary')
    state.browser.browserVersion = browserReady?.browser ?? null
    state.browser.summary = browserSummaryRecord ?? null
    log('browser_result', { rc: browserRun.code, elapsedMs: state.browser.elapsedMs, browserVersion: state.browser.browserVersion, summaryFound: !!browserSummaryRecord })
    assertExitCode(browserRun, 'GOLD-1.6 browser route and save/load')
    if (!browserSummaryRecord) throw new Error('browser runner did not write run_summary to the GOLD-1.6 log')
    const browser = browserSummaryRecord
    if (!browser.clueFound) throw new Error('browser route did not find the first clue')
    if (!browser.persistence || browser.persistence.discrepancyCount !== 0) {
      throw new Error(`save/load comparison failed: ${JSON.stringify(browser.persistence ?? null)}`)
    }
    if (browser.browser?.pageerrorCount !== 0) throw new Error(`pageerror count was ${browser.browser?.pageerrorCount}`)
    if (browser.browser?.emptyBackgrounds !== 0) throw new Error(`empty background count was ${browser.browser?.emptyBackgrounds}`)

    const screenshots = browserCheckpoints(browser)
    if (!screenshots.length) throw new Error('browser run produced no checkpoint PNGs')
    for (const [name, checkpoint] of screenshots) {
      const shotPath = resolve(ROOT, checkpoint.screenshot.path)
      const size = pngDimensions(shotPath)
      if (!size || size.width !== PNG_WIDTH || size.height !== PNG_HEIGHT) {
        throw new Error(`screenshot ${name} is not ${PNG_WIDTH}x${PNG_HEIGHT}: ${JSON.stringify(size)}`)
      }
      checkpoint.screenshot.width = size.width
      checkpoint.screenshot.height = size.height
      checkpoint.screenshot.bytes = size.bytes
    }

    const finalTree = await inspectTree(CAMPAIGN_ROOT)
    if (!treeMatchesManifest(finalTree, importedManifest)) {
      throw new Error(`.golden/karkas changed after import/checks: expected ${importedManifest.tree.sha256}, got ${finalTree?.sha256 ?? 'missing'}`)
    }
    state.verdict = 'PASS'
    state.elapsedMs = Date.now() - state.startedMs
    state.currentRunSummary = {
      runId,
      verdict: state.verdict,
      totalElapsedMs: state.elapsedMs,
      archiveSource: state.import.source,
      treeCacheHit: state.import.treeCacheHit,
      archiveSha256: importedManifest.sha256,
      treeSha256: finalTree.sha256,
      auditErrors: auditCounts.errors,
      auditWarnings: auditCounts.warnings,
      cfPlayErrors: source.errors.length,
      cfPlayWarnings: source.warnings.length,
      clueFound: browser.clueFound,
      saveLoad: browser.persistence.verdict,
      pageerror: browser.browser.pageerrorCount,
      emptyBackgrounds: browser.browser.emptyBackgrounds,
      browserDurationMs: state.browser.elapsedMs,
      screenshotCount: screenshots.length,
    }
    log('run_complete', state.currentRunSummary)
    console.log(`GOLDEN PLAYTHROUGH PASS: archive=${importedManifest.sha256} tree=${finalTree.sha256}`)
    console.log(`audit errors=${auditCounts.errors} warnings=${auditCounts.warnings}; cf-play scenes=${source.counts.scenes} errors=${source.errors.length} warnings=${source.warnings.length}`)
    console.log(`browser clue=${browser.clueFound} save/load=${browser.persistence.verdict} pageerror=${browser.browser.pageerrorCount} emptyBackgrounds=${browser.browser.emptyBackgrounds} duration=${(state.browser.elapsedMs / 1000).toFixed(2)}s`)
  } catch (error) {
    const message = errorText(error)
    state.failures.push(message)
    state.verdict = 'FAIL'
    state.elapsedMs = Date.now() - state.startedMs
    log('run_failure', { message })
    console.error(`GOLDEN PLAYTHROUGH FAIL: ${String(error?.message ?? error)}`)
    const audit = state.audit
    const source = state.cfPlay?.source
    const browser = state.browser?.summary?.browser
    console.log(`GOLDEN NUMERIC RESULTS: importerRc=${state.import?.rc ?? 'n/a'} auditRc=${audit?.rc ?? 'n/a'} auditErrors=${audit?.counts.errors ?? 'n/a'} auditWarnings=${audit?.counts.warnings ?? 'n/a'} cfPlayRc=${source?.rc ?? 'n/a'} cfPlayErrors=${source?.errors?.length ?? 'n/a'} cfPlayWarnings=${source?.warnings?.length ?? 'n/a'} pageerror=${browser?.pageerrorCount ?? 'n/a'} emptyBackgrounds=${browser?.emptyBackgrounds ?? 'n/a'}`)
    process.exitCode = 1
  } finally {
    state.elapsedMs ??= Date.now() - state.startedMs
    try {
      await writeReport()
      log('report_written', { path: relative(ROOT, REPORT_PATH).split(sep).join('/'), verdict: state.verdict })
      console.log(`Report: ${relative(ROOT, REPORT_PATH).split(sep).join('/')}`)
      console.log(`Log: ${relative(ROOT, LOG_PATH).split(sep).join('/')}`)
      console.log(`Screenshots: ${relative(ROOT, OUTPUT_DIR).split(sep).join('/')}/`)
    } catch (error) {
      state.failures.push(`report write failed: ${errorText(error)}`)
      process.exitCode = 1
    }
    for (const directory of state.temporaryDirectories) await rm(directory, { recursive: true, force: true }).catch(() => undefined)
  }
}

if (flags['verify-only']) {
  process.exitCode = await verifyOnlyMode()
} else {
  await main()
}
