import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import { mkdir, mkdtemp, readFile, readdir, rm, writeFile } from 'node:fs/promises'
import { join, relative, resolve, sep } from 'node:path'
import { fileURLToPath } from 'node:url'

const repoRoot = resolve(import.meta.dirname, '..')
const scriptPath = fileURLToPath(import.meta.url)
const tsxCli = join(repoRoot, 'node_modules/tsx/dist/cli.mjs')
const allowedStatuses = ['proposed', 'accepted', 'rejected', 'superseded'] as const
const dayMs = 24 * 60 * 60 * 1000
const datePattern = /^(\d{4})-(\d{2})-(\d{2})$/

type DecisionStatus = (typeof allowedStatuses)[number]

interface ProposedDecision {
  file: string
  date: string
  ageDays: number | null
}

interface DecisionCheck {
  files: number
  statusless: number
  counts: Record<DecisionStatus, number>
  proposed: ProposedDecision[]
  issues: string[]
}

function relativePath(file: string): string {
  return relative(repoRoot, file).split(sep).join('/')
}

function parseIsoDate(value: string): number | undefined {
  const match = datePattern.exec(value)
  if (!match) return undefined
  const [, yearText, monthText, dayText] = match
  const year = Number(yearText)
  const month = Number(monthText)
  const day = Number(dayText)
  const timestamp = Date.parse(`${value}T00:00:00.000Z`)
  if (!Number.isFinite(timestamp)) return undefined
  const normalized = new Date(timestamp)
  if (normalized.getUTCFullYear() !== year || normalized.getUTCMonth() + 1 !== month || normalized.getUTCDate() !== day) {
    return undefined
  }
  return timestamp
}

function utcToday(): string {
  return new Date().toISOString().slice(0, 10)
}

function metadataValues(content: string, key: string): string[] {
  return content.split(/\r?\n/)
    .filter((line) => line.startsWith(`${key}:`))
    .map((line) => line.slice(key.length + 1).trim())
}

function proposedDate(content: string): string | undefined {
  const raw = metadataValues(content, 'Дата')[0]
  const match = raw?.match(/^(\d{4}-\d{2}-\d{2})(?:\.|\s|$)/)
  return match?.[1]
}

async function checkDecisions(decisionsDirectory: string, asOf: string): Promise<DecisionCheck> {
  const todayTimestamp = parseIsoDate(asOf)
  if (todayTimestamp === undefined) throw new Error(`--today must be a valid YYYY-MM-DD date, got ${JSON.stringify(asOf)}`)

  const entries = await readdir(decisionsDirectory, { withFileTypes: true })
  const files = entries
    .filter((entry) => entry.isFile() && entry.name.endsWith('.md'))
    .map((entry) => join(decisionsDirectory, entry.name))
    .sort()
  const result: DecisionCheck = {
    files: files.length,
    statusless: 0,
    counts: { proposed: 0, accepted: 0, rejected: 0, superseded: 0 },
    proposed: [],
    issues: [],
  }

  for (const file of files) {
    const content = await readFile(file, 'utf8')
    const label = relativePath(file)
    const statusLines = content.split(/\r?\n/).filter((line) => line.startsWith('Статус:'))

    if (statusLines.length === 0) {
      result.statusless += 1
      continue
    }
    if (statusLines.length > 1) {
      result.issues.push(`${label}: expected at most one Статус: field, found ${statusLines.length}`)
      continue
    }

    const status = statusLines[0]!.slice('Статус:'.length).trim()
    if (!allowedStatuses.includes(status as DecisionStatus)) {
      result.issues.push(`${label}: unsupported status ${JSON.stringify(status)}; allowed: ${allowedStatuses.join(' | ')}`)
      continue
    }

    const typedStatus = status as DecisionStatus
    result.counts[typedStatus] += 1

    if (typedStatus === 'accepted' || typedStatus === 'rejected') {
      const decisionDates = metadataValues(content, 'Дата решения')
      if (decisionDates.length === 0 || decisionDates[0] === '') {
        result.issues.push(`${label}: ${typedStatus} status requires Дата решения: YYYY-MM-DD`)
      } else if (parseIsoDate(decisionDates[0]!) === undefined) {
        result.issues.push(`${label}: invalid Дата решения ${JSON.stringify(decisionDates[0])}; expected YYYY-MM-DD`)
      }

      const deciders = metadataValues(content, 'Решил')
      if (deciders.length === 0 || deciders[0] === '') {
        result.issues.push(`${label}: ${typedStatus} status requires a non-empty Решил: field`)
      }
    }

    if (typedStatus === 'proposed') {
      const date = proposedDate(content)
      const timestamp = date ? parseIsoDate(date) : undefined
      result.proposed.push({
        file: label,
        date: timestamp === undefined ? 'unknown' : date!,
        ageDays: timestamp === undefined ? null : Math.floor((todayTimestamp - timestamp) / dayMs),
      })
    }
  }

  return result
}

function printCheck(result: DecisionCheck): void {
  console.log(
    `decision status check: ${result.files} files; statusless=${result.statusless}; ` +
    `proposed=${result.counts.proposed}; accepted=${result.counts.accepted}; ` +
    `rejected=${result.counts.rejected}; superseded=${result.counts.superseded}`,
  )

  if (result.proposed.length > 0) {
    console.log('proposed decisions (informational; never fail the check):')
    for (const item of result.proposed) {
      const age = item.ageDays === null ? 'unknown' : `${item.ageDays} ${Math.abs(item.ageDays) === 1 ? 'day' : 'days'}`
      console.log(`  ${item.file} — proposed; date=${item.date}; age=${age}`)
    }
  }

  if (result.issues.length > 0) {
    for (const issue of result.issues) console.error(`✗ ${issue}`)
    console.error(`check:decisions failed: ${result.issues.length} issue(s)`)
    return
  }
  console.log('check:decisions passed')
}

function runCheck(decisionsDirectory: string, asOf: string): { status: number | null; output: string; error?: Error } {
  const processResult = spawnSync(process.execPath, [
    tsxCli,
    scriptPath,
    '--decisions-root',
    decisionsDirectory,
    '--today',
    asOf,
  ], {
    cwd: repoRoot,
    encoding: 'utf8',
    timeout: 30_000,
    maxBuffer: 2 * 1024 * 1024,
  })
  return {
    status: processResult.status,
    output: `${processResult.stdout ?? ''}${processResult.stderr ?? ''}`,
    error: processResult.error,
  }
}

async function createFixture(workspace: string, name: string, fileName: string, content: string): Promise<string> {
  const directory = join(workspace, name, 'docs/decisions')
  await mkdir(directory, { recursive: true })
  await writeFile(join(directory, fileName), content, 'utf8')
  return directory
}

async function verifyFixtures(): Promise<void> {
  const workspace = await mkdtemp(join(repoRoot, 'scripts', '.decision-check-fixtures-'))
  const asOf = '2026-10-25'
  try {
    const statuslessRoot = await createFixture(workspace, 'a-statusless', 'legacy.md', '# Legacy decision journal\n')
    const statusless = runCheck(statuslessRoot, asOf)
    assert.ifError(statusless.error)
    assert.equal(statusless.status, 0, `a decision without Статус: must be valid\n${statusless.output}`)
    assert.match(statusless.output, /statusless=1/)
    console.log('fixture (a) decision without Статус: remains valid: PASS — rc=0')

    const unknownRoot = await createFixture(workspace, 'b-unknown-status', 'unknown.md', 'Статус: waiting\n')
    const unknown = runCheck(unknownRoot, asOf)
    assert.ifError(unknown.error)
    assert.equal(unknown.status, 1, `an unsupported status must return rc=1\n${unknown.output}`)
    assert.match(unknown.output, /unsupported status "waiting"/)
    console.log('fixture (b) unsupported status rejected: PASS — rc=1')

    const missingDateRoot = await createFixture(
      workspace,
      'c-accepted-without-date',
      'accepted.md',
      'Статус: accepted\nРешил: Мастер\n',
    )
    const missingDate = runCheck(missingDateRoot, asOf)
    assert.ifError(missingDate.error)
    assert.equal(missingDate.status, 1, `accepted without a decision date must return rc=1\n${missingDate.output}`)
    assert.match(missingDate.output, /requires Дата решения/)
    console.log('fixture (c) accepted without Дата решения rejected: PASS — rc=1')

    const missingDeciderRoot = await createFixture(
      workspace,
      'd-rejected-without-decider',
      'rejected.md',
      'Статус: rejected\nДата решения: 2026-10-25\n',
    )
    const missingDecider = runCheck(missingDeciderRoot, asOf)
    assert.ifError(missingDecider.error)
    assert.equal(missingDecider.status, 1, `rejected without a decision-maker must return rc=1\n${missingDecider.output}`)
    assert.match(missingDecider.output, /requires a non-empty Решил:/)
    console.log('fixture (d) rejected without Решил rejected: PASS — rc=1')

    const proposedRoot = await createFixture(
      workspace,
      'e-proposed-is-informational',
      'proposed.md',
      'Статус: proposed\nДата: 2026-10-20\n',
    )
    await writeFile(join(proposedRoot, 'proposed-no-date.md'), 'Статус: proposed\n', 'utf8')
    const proposed = runCheck(proposedRoot, asOf)
    assert.ifError(proposed.error)
    assert.equal(proposed.status, 0, `proposed must be informational and return rc=0\n${proposed.output}`)
    assert.match(proposed.output, /date=2026-10-20; age=5 days/)
    assert.match(proposed.output, /date=unknown; age=unknown/)
    console.log('fixture (e) proposed lists date and age without failing: PASS — rc=0, date=2026-10-20, age=5 days')
    console.log('fixture (f) proposed without date remains informational: PASS — rc=0, date=unknown, age=unknown')
  } finally {
    await rm(workspace, { recursive: true, force: true })
  }
}

const decisionsRootIndex = process.argv.indexOf('--decisions-root')
if (decisionsRootIndex >= 0) {
  const decisionsDirectory = process.argv[decisionsRootIndex + 1]
  if (!decisionsDirectory) throw new Error('--decisions-root requires a directory')
  const todayIndex = process.argv.indexOf('--today')
  const asOf = todayIndex >= 0 ? process.argv[todayIndex + 1] : utcToday()
  if (!asOf) throw new Error('--today requires a YYYY-MM-DD date')
  const result = await checkDecisions(resolve(decisionsDirectory), asOf)
  printCheck(result)
  if (result.issues.length > 0) process.exitCode = 1
} else {
  await verifyFixtures()
  const result = await checkDecisions(join(repoRoot, 'docs/decisions'), utcToday())
  printCheck(result)
  if (result.issues.length > 0) process.exitCode = 1
}
