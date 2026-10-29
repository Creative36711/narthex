import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import { cp, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { tmpdir } from 'node:os'

const root = path.resolve(import.meta.dirname, '..')
const sourceCampaign = path.join(root, 'public/campaigns/fmv-crossing')
const tempRoot = await mkdtemp(path.join(tmpdir(), 'narthex-fmv-audit-'))
const sourceEntry = ['run', 'audit:campaign', '--']
const bundle = path.join(root, 'public/ai/campaign-audit.mjs')

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

function runSource(campaign: string): { status: number | null; output: string } {
  const result = spawnSync('npm', [...sourceEntry, campaign], { cwd: root, encoding: 'utf8', maxBuffer: 8 * 1024 * 1024 })
  if (result.error) throw result.error
  return { status: result.status, output: `${result.stdout ?? ''}\n${result.stderr ?? ''}` }
}

function runBundle(campaign: string): { status: number | null; output: string } {
  const result = spawnSync(process.execPath, [bundle, campaign], { cwd: root, encoding: 'utf8', maxBuffer: 8 * 1024 * 1024 })
  if (result.error) throw result.error
  return { status: result.status, output: `${result.stdout ?? ''}\n${result.stderr ?? ''}` }
}

function assertGreen(label: string, result: ReturnType<typeof runSource>): void {
  assert.equal(result.status, 0, `${label}: expected rc=0\n${result.output}`)
  assert.doesNotMatch(result.output, /ERROR:/, `${label}: unexpected ERROR\n${result.output}`)
  console.log(`  ✓ ${label}: rc=0; ERROR=0`)
}

function assertRejected(label: string, result: ReturnType<typeof runSource>, expected: RegExp): void {
  assert.equal(result.status, 1, `${label}: expected rc=1\n${result.output}`)
  assert.match(result.output, /ERROR:/, `${label}: missing ERROR row\n${result.output}`)
  assert.match(result.output, expected, `${label}: missing expected validation detail\n${result.output}`)
  const errorLine = result.output.split(/\r?\n/).find((line) => line.startsWith('ERROR:'))
  console.log(`  ✓ ${label}: rc=1; ${errorLine ?? 'ERROR row observed'}`)
}

try {
  const validSource = await copyFixture('valid-source')
  assertGreen('source FMV contract', runSource(validSource))

  // The shared non-FMV schema must still accept an ordinary scene. This clone
  // removes only the two FMV references and the FMV payload; public data stays untouched.
  const ordinary = await copyFixture('ordinary-scene')
  const ordinaryManifest = await readJson<Record<string, unknown>>(path.join(ordinary, 'manifest.json'))
  delete ordinaryManifest.fmv
  await writeJson(path.join(ordinary, 'manifest.json'), ordinaryManifest)
  const ordinaryScenePath = path.join(ordinary, 'scenes/scene_fmv_crossing.json')
  const ordinaryScene = await readJson<Record<string, unknown>>(ordinaryScenePath)
  delete ordinaryScene.fmv
  await writeJson(ordinaryScenePath, ordinaryScene)
  await rm(path.join(ordinary, 'fmv'), { recursive: true, force: true })
  assertGreen('ordinary scene without FMV', runSource(ordinary))

  const missingSrc = await copyFixture('missing-src')
  const missingSrcPath = path.join(missingSrc, 'fmv/fmv_crossing.json')
  const missingSrcDocument = await readJson<Record<string, unknown>>(missingSrcPath)
  const missingSrcFragments = missingSrcDocument.fragments as Array<Record<string, unknown>>
  delete missingSrcFragments[0]!.src
  await writeJson(missingSrcPath, missingSrcDocument)
  assertRejected('missing fragment src', runSource(missingSrc), /fmv\/fmv_crossing\.json\/fragments\/0.*required property 'src'/)

  const unknownMode = await copyFixture('unknown-mode')
  const unknownModePath = path.join(unknownMode, 'fmv/fmv_crossing.json')
  const unknownModeDocument = await readJson<Record<string, unknown>>(unknownModePath)
  unknownModeDocument.mode = 'loop'
  await writeJson(unknownModePath, unknownModeDocument)
  assertRejected('unknown FMV mode', runSource(unknownMode), /fmv\/fmv_crossing\.json.*additional properties/)

  const unknownChoiceField = await copyFixture('unknown-choice-field')
  const unknownChoicePath = path.join(unknownChoiceField, 'fmv/fmv_crossing.json')
  const unknownChoiceDocument = await readJson<Record<string, unknown>>(unknownChoicePath)
  const unknownChoiceFragments = unknownChoiceDocument.fragments as Array<Record<string, unknown>>
  const firstChoice = (unknownChoiceFragments[0]!.choices as Array<Record<string, unknown>>)[0]!
  firstChoice.mystery = true
  await writeJson(unknownChoicePath, unknownChoiceDocument)
  assertRejected('unknown choice field', runSource(unknownChoiceField), /fmv\/fmv_crossing\.json\/fragments\/0\/choices\/0.*additional properties/)

  const unknownCondition = await copyFixture('unknown-condition')
  const unknownConditionPath = path.join(unknownCondition, 'fmv/fmv_crossing.json')
  const unknownConditionDocument = await readJson<Record<string, unknown>>(unknownConditionPath)
  const conditionFragments = unknownConditionDocument.fragments as Array<Record<string, unknown>>
  const conditionChoice = (conditionFragments[0]!.choices as Array<Record<string, unknown>>)[0]!
  conditionChoice.conds = [{ type: 'flag', flag: 'chose_lantern', mode: 'sometimes' }]
  await writeJson(unknownConditionPath, unknownConditionDocument)
  assertRejected('unknown condition field', runSource(unknownCondition), /must NOT have additional properties/)

  const validBundle = await copyFixture('valid-bundle')
  assertGreen('standalone audit bundle', runBundle(validBundle))
  const invalidBundle = await copyFixture('invalid-bundle')
  const invalidBundlePath = path.join(invalidBundle, 'fmv/fmv_crossing.json')
  const invalidBundleDocument = await readJson<Record<string, unknown>>(invalidBundlePath)
  invalidBundleDocument.mode = 'unrecognized'
  await writeJson(invalidBundlePath, invalidBundleDocument)
  assertRejected('standalone bundle rejects unknown mode', runBundle(invalidBundle), /ERROR:/)

  console.log('✓ FMV audit smoke — source and bundle strict; missing src/unknown mode/unknown fields rejected; ordinary scene green')
} finally {
  await rm(tempRoot, { recursive: true, force: true })
}
