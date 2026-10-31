import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import { cp, mkdir, mkdtemp, readFile, readdir, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { auditCampaignFmv, withoutFmvExtension } from './campaign-fmv-audit.mts'

const root = path.resolve(import.meta.dirname, '..')
const sourceCampaign = path.join(root, 'public/campaigns/fmv-crossing')
const tempRoot = await mkdtemp(path.join(tmpdir(), 'narthex-fmv-audit-'))
const bundle = path.join(root, 'public/ai/campaign-audit.mjs')

interface CampaignAuditStore {
  manifest: unknown
  jsonFiles: Map<string, unknown>
}

async function copyFixture(name: string): Promise<string> {
  const target = path.join(tempRoot, name)
  await cp(sourceCampaign, target, { recursive: true })
  return target
}

async function readJson<T>(file: string): Promise<T> {
  return JSON.parse(await readFile(file, 'utf8')) as T
}

async function writeJson(file: string, value: unknown): Promise<void> {
  await writeFile(file, `${JSON.stringify(value, null, 2)}\n`, 'utf8')
}

async function loadCampaignAuditStore(campaign: string): Promise<CampaignAuditStore> {
  const manifest = await readJson<unknown>(path.join(campaign, 'manifest.json'))
  const jsonFiles = new Map<string, unknown>()
  async function walk(dir: string, rel = ''): Promise<void> {
    for (const entry of await readdir(path.join(dir, rel), { withFileTypes: true })) {
      const relative = rel ? `${rel}/${entry.name}` : entry.name
      if (entry.isDirectory()) {
        if (relative === 'fmv') continue
        await walk(dir, relative)
      } else if (entry.isFile() && entry.name.endsWith('.json') && entry.name !== 'campaign.json' && relative !== 'manifest.json') {
        jsonFiles.set(relative, await readJson(path.join(dir, relative)))
      }
    }
  }
  await walk(campaign)
  return { manifest, jsonFiles }
}

async function runBaseAuditor(campaign: string): Promise<{ status: number | null; output: string }> {
  const result = spawnSync('npm', ['run', 'audit:campaign', '--', campaign], { cwd: root, encoding: 'utf8', maxBuffer: 8 * 1024 * 1024 })
  if (result.error) throw result.error
  return { status: result.status, output: `${result.stdout ?? ''}\n${result.stderr ?? ''}` }
}

function runBundle(campaign: string): { status: number | null; output: string } {
  const result = spawnSync(process.execPath, [bundle, campaign], { cwd: root, encoding: 'utf8', maxBuffer: 8 * 1024 * 1024 })
  if (result.error) throw result.error
  return { status: result.status, output: `${result.stdout ?? ''}\n${result.stderr ?? ''}` }
}

function assertBaseGreen(label: string, result: ReturnType<typeof runBundle>): void {
  assert.equal(result.status, 0, `${label}: expected rc=0\n${result.output}`)
  assert.doesNotMatch(result.output, /ERROR:/, `${label}: unexpected ERROR\n${result.output}`)
  console.log(`  ✓ ${label}: rc=0; ERROR=0`)
}

function assertBaseRejected(label: string, result: ReturnType<typeof runBundle>, expected: RegExp): void {
  assert.equal(result.status, 1, `${label}: expected rc=1\n${result.output}`)
  assert.match(result.output, /ERROR:/, `${label}: missing ERROR row\n${result.output}`)
  assert.match(result.output, expected, `${label}: missing expected validation detail\n${result.output}`)
  console.log(`  ✓ ${label}: rc=1; expected schema error observed`)
}

function auditFmv(campaign: string, store: CampaignAuditStore) {
  return auditCampaignFmv(campaign, store.manifest, store.jsonFiles)
}

function assertFmvGreen(label: string, errors: string[]): void {
  assert.deepEqual(errors, [], `${label}: expected no FMV extension errors`)
  console.log(`  ✓ ${label}: FMV extension errors=0`)
}

function assertFmvRejected(label: string, errors: string[], expected: RegExp): void {
  assert.ok(errors.length > 0, `${label}: expected at least one FMV validation error`)
  assert.match(errors.join('\n'), expected, `${label}: missing expected validation detail\n${errors.join('\n')}`)
  console.log(`  ✓ ${label}: FMV extension rejected (${errors.length} error(s))`)
}

/** Persist only the projection produced by withoutFmvExtension for base checks. */
async function writeOrdinaryProjection(campaign: string): Promise<void> {
  const original = await loadCampaignAuditStore(campaign)
  const projected = withoutFmvExtension(original)
  assert.notEqual(projected, original, 'projection should return a separate audit view')
  const originalManifest = original.manifest as Record<string, unknown>
  const projectedManifest = projected.manifest as Record<string, unknown>
  assert.ok(Object.hasOwn(originalManifest, 'fmv'), 'source manifest retains FMV metadata')
  assert.equal(Object.hasOwn(projectedManifest, 'fmv'), false, 'projected manifest omits FMV metadata')
  assert.ok(
    [...original.jsonFiles].some(([relative, value]) => relative.startsWith('scenes/') && Object.hasOwn(value as object, 'fmv')),
    'source scene retains FMV reference',
  )
  assert.ok(
    [...projected.jsonFiles].some(([relative, value]) => relative.startsWith('scenes/') && !Object.hasOwn(value as object, 'fmv')),
    'projected scene omits FMV reference',
  )

  await writeJson(path.join(campaign, 'manifest.json'), projected.manifest)
  for (const [relative, value] of projected.jsonFiles) {
    const file = path.join(campaign, relative)
    await mkdir(path.dirname(file), { recursive: true })
    await writeJson(file, value)
  }
  await rm(path.join(campaign, 'fmv'), { recursive: true, force: true })
}

try {
  const validSource = await copyFixture('valid-source')
  const validStore = await loadCampaignAuditStore(validSource)
  const validResult = auditFmv(validSource, validStore)
  assertFmvGreen('source FMV contract through auditCampaignFmv()', validResult.errors)
  assert.equal(validResult.documents.size, 1, 'one FMV document is audited')
  assert.equal(validResult.documents.has('fmv/fmv_crossing.json'), true)
  assert.equal(validResult.mediaPaths.length, 6, 'all FMV src/poster references are discovered')

  // The legacy editor auditor must not be taught the extension. Verify the
  // read-only projection, then run both source and pinned bundle auditors on
  // an ordinary campaign view produced by that projection.
  const ordinary = await copyFixture('ordinary-scene')
  await writeOrdinaryProjection(ordinary)
  assertBaseGreen('ordinary scene through source auditor', await runBaseAuditor(ordinary))
  assertBaseGreen('ordinary scene through standalone bundle', runBundle(ordinary))

  const missingSrc = await copyFixture('missing-src')
  const missingStore = await loadCampaignAuditStore(missingSrc)
  const missingDoc = await readJson<Record<string, unknown>>(path.join(missingSrc, 'fmv/fmv_crossing.json'))
  const missingFragments = missingDoc.fragments as Array<Record<string, unknown>>
  delete missingFragments[0]!.src
  await writeJson(path.join(missingSrc, 'fmv/fmv_crossing.json'), missingDoc)
  assertFmvRejected('missing fragment src', auditFmv(missingSrc, missingStore).errors, /required property 'src'/)

  const unknownMode = await copyFixture('unknown-mode')
  const modeStore = await loadCampaignAuditStore(unknownMode)
  const modePath = path.join(unknownMode, 'fmv/fmv_crossing.json')
  const modeDoc = await readJson<Record<string, unknown>>(modePath)
  modeDoc.mode = 'loop'
  await writeJson(modePath, modeDoc)
  assertFmvRejected('unknown FMV field/mode', auditFmv(unknownMode, modeStore).errors, /additional properties/)

  const unknownChoiceField = await copyFixture('unknown-choice-field')
  const choiceStore = await loadCampaignAuditStore(unknownChoiceField)
  const choicePath = path.join(unknownChoiceField, 'fmv/fmv_crossing.json')
  const choiceDoc = await readJson<Record<string, unknown>>(choicePath)
  const choiceFragments = choiceDoc.fragments as Array<Record<string, unknown>>
  const firstChoice = (choiceFragments[0]!.choices as Array<Record<string, unknown>>)[0]!
  firstChoice.mystery = true
  await writeJson(choicePath, choiceDoc)
  assertFmvRejected('unknown choice field', auditFmv(unknownChoiceField, choiceStore).errors, /additional properties/)

  const unknownCondition = await copyFixture('unknown-condition')
  const conditionStore = await loadCampaignAuditStore(unknownCondition)
  const conditionPath = path.join(unknownCondition, 'fmv/fmv_crossing.json')
  const conditionDoc = await readJson<Record<string, unknown>>(conditionPath)
  const conditionFragments = conditionDoc.fragments as Array<Record<string, unknown>>
  const conditionChoice = (conditionFragments[0]!.choices as Array<Record<string, unknown>>)[0]!
  conditionChoice.conds = [{ type: 'flag', flag: 'chose_lantern', mode: 'sometimes' }]
  await writeJson(conditionPath, conditionDoc)
  assertFmvRejected('unknown condition field', auditFmv(unknownCondition, conditionStore).errors, /additional properties/)

  const invalidBundle = await copyFixture('invalid-bundle')
  await writeOrdinaryProjection(invalidBundle)
  const invalidManifestPath = path.join(invalidBundle, 'manifest.json')
  const invalidManifest = await readJson<Record<string, unknown>>(invalidManifestPath)
  invalidManifest.unauthorized = true
  await writeJson(invalidManifestPath, invalidManifest)
  assertBaseRejected('standalone bundle rejects an ordinary unknown manifest field', runBundle(invalidBundle), /manifest\.json.*additional properties/i)

  console.log('✓ FMV audit smoke — FMV data validated by auditCampaignFmv(); projection strips only the extension; source/bundle base auditors remain covered')
} finally {
  await rm(tempRoot, { recursive: true, force: true })
}
