import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import { mkdir, mkdtemp, readFile, readdir, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { dirname, join, resolve, sep } from 'node:path'
import JSZip from 'jszip'
import { assertAshWarningReport, type AshCampaignId } from './ash-warning-oracle.mts'

const root = resolve(import.meta.dirname, '../..')
const packageJson = JSON.parse(await readFile(join(root, 'package.json'), 'utf8')) as { version: string }
const adventureManifest = JSON.parse(await readFile(join(root, 'packs/adventure/pack.json'), 'utf8')) as { caps?: string[] }
const capabilityContracts = JSON.parse(await readFile(join(root, 'docs/contracts/caps.json'), 'utf8')) as {
  kinds: Array<{ id: string; requires?: string[] }>
}
const adventureKind = capabilityContracts.kinds.find((kind) => kind.id === 'adventure')
assert.ok(adventureKind, 'adventure project kind must remain registered')

interface Invocation {
  rc: number
  stdout: string
  stderr: string
  error?: string
}

interface Runner {
  name: string
  executable: string
  prefix: string[]
}

function invoke(executable: string, args: string[], timeout = 180_000): Invocation {
  const result = spawnSync(executable, args, {
    cwd: root,
    env: { ...process.env, npm_package_version: packageJson.version },
    encoding: 'utf8',
    timeout,
    maxBuffer: 16 * 1024 * 1024,
  })
  return {
    rc: result.status ?? (result.error ? 127 : 1),
    stdout: result.stdout ?? '',
    stderr: result.stderr ?? '',
    ...(result.error ? { error: result.error.message } : {}),
  }
}

function reportFrom(invocation: Invocation, label: string): Record<string, any> {
  try {
    const value: unknown = JSON.parse(invocation.stdout)
    assert.ok(typeof value === 'object' && value !== null && !Array.isArray(value), `${label}: expected JSON report`)
    return value as Record<string, any>
  } catch (error) {
    throw new Error(`${label}: could not parse cf-play JSON output (rc=${invocation.rc})\n${invocation.stdout}\n${invocation.stderr}\n${String(error)}`)
  }
}

async function unpackKit(destination: string, archivePath: string): Promise<string> {
  const archive = await JSZip.loadAsync(await readFile(archivePath))
  const kitRoot = join(destination, '__chronicle_ai__')
  for (const [archiveName, entry] of Object.entries(archive.files)) {
    if (entry.dir) continue
    const target = resolve(destination, archiveName)
    assert.ok(target === destination || target.startsWith(`${destination}${sep}`), `unsafe kit path: ${archiveName}`)
    await mkdir(dirname(target), { recursive: true })
    await writeFile(target, await entry.async('nodebuffer'))
  }
  assert.ok(await readFile(join(kitRoot, 'cf-play.mjs')), 'unpacked kit must contain cf-play.mjs')
  return join(kitRoot, 'cf-play.mjs')
}

async function main(): Promise<void> {
  const workspace = await mkdtemp(join(tmpdir(), 'cf-play-strict-warning-gate-'))
  try {
    const kitOutput = join(workspace, 'kit-build')
    const kitBuild = invoke(process.platform === 'win32' ? 'npm.cmd' : 'npm', ['run', '--silent', 'pack:ai-kit', '--', '--out', kitOutput], 180_000)
    assert.equal(kitBuild.rc, 0, `pack:ai-kit must complete before the unpacked-kit check\n${kitBuild.stdout}\n${kitBuild.stderr}`)
    const kitCli = await unpackKit(join(workspace, 'unpacked'), join(kitOutput, '__chronicle_ai__-kit.zip'))
    const sourceCli = join(root, 'node_modules/tsx/dist/cli.mjs')
    const sourceEntry = join(root, 'scripts/playkit/cli.mts')
    const bundleCli = join(root, 'public/ai/cf-play.mjs')
    const runners: Runner[] = [
      { name: 'source', executable: process.execPath, prefix: [sourceCli, sourceEntry] },
      { name: 'bundle', executable: process.execPath, prefix: [bundleCli] },
      { name: 'unpacked-kit', executable: process.execPath, prefix: [kitCli] },
    ]

    // §3's expected failure is checked as a complete result, not as an arbitrary rc=1.
    for (const campaignId of ['ash-of-caerden', 'ash-of-caerden-adventure'] as const satisfies readonly AshCampaignId[]) {
      const campaignDir = join(root, 'public/campaigns', campaignId)
      for (const runner of runners) {
        const output = join(workspace, 'reports', `${runner.name}-${campaignId}`)
        const invocation = invoke(runner.executable, [
          ...runner.prefix,
          'check', campaignDir,
          '--json', '--seeds', '1-5', '--steps', '300',
          '--out', output,
        ])
        const label = `${runner.name} ${campaignId}`
        assert.equal(invocation.rc, 1, `${label}: strict check must return exactly rc=1\n${invocation.stdout}\n${invocation.stderr}`)
        assertAshWarningReport(reportFrom(invocation, label), campaignId)
        console.log(`✓ ${label}: expected rc=1; exact warnings, zero errors, 10/8/6/21, 5 deaths, coverage 6/10`)
      }
    }

    // A real warning-free narrative project remains a positive rc=0 control.
    const positiveNarrative = join(root, 'packs/narrative/data/fmv-crossing')
    for (const runner of runners) {
      const label = `${runner.name} positive narrative`
      const invocation = invoke(runner.executable, [
        ...runner.prefix,
        'check', positiveNarrative,
        '--json', '--seeds', '1-1', '--steps', '50',
        '--out', join(workspace, 'reports', `${runner.name}-positive-narrative`),
      ])
      assert.equal(invocation.rc, 0, `${label}: expected rc=0\n${invocation.stdout}\n${invocation.stderr}`)
      const report = reportFrom(invocation, label)
      assert.equal(report.verdict, 'ok', `${label}: verdict`)
      assert.equal(report.graph?.errors?.length, 0, `${label}: errors`)
      assert.equal(report.graph?.warnings?.length, 0, `${label}: warnings`)
      assert.equal(report.sweep?.seeds, 1, `${label}: one deterministic seed`)
      console.log(`✓ ${label}: warning-free strict check rc=0`)
    }

    // Build an isolated warning-free adventure project from the small narrative
    // fixture; neither protected Ash directory is edited or copied into Git.
    const positiveAdventure = join(workspace, 'positive-adventure')
    await mkdir(positiveAdventure, { recursive: true })
    const narrativeFiles = await readdirFiles(positiveNarrative)
    for (const relativePath of narrativeFiles) {
      const source = join(positiveNarrative, relativePath)
      const target = join(positiveAdventure, relativePath)
      await mkdir(dirname(target), { recursive: true })
      await writeFile(target, await readFile(source))
    }
    const adventureCaps = [...new Set([...(adventureKind.requires ?? []), ...(adventureManifest.caps ?? [])])].sort()
    await writeFile(join(positiveAdventure, 'project.json'), `${JSON.stringify({
      format: 2,
      id: 'cf-play-positive-adventure',
      title: 'Warning-free adventure control',
      kind: 'adventure',
      caps: adventureCaps,
      engine: { min: packageJson.version, tested: packageJson.version },
      entry: 'world.json',
      manifest: 'manifest.json',
    }, null, 2)}\n`)
    await writeFile(join(positiveAdventure, 'adventure.json'), `${JSON.stringify({
      version: 1,
      startScene: 'scene_fmv_crossing',
      startNode: 'spawn',
      scenes: {
        scene_fmv_crossing: {
          walk: {
            nodes: [{ id: 'spawn', x: 0, y: 0 }, { id: 'goal', x: 100, y: 0 }],
            edges: [['spawn', 'goal']],
          },
          hotspots: [{
            id: 'probe_token',
            label: 'Probe token',
            x: 90, y: -10, w: 20, h: 20,
            message: 'The warning-free adventure runtime is active.',
            item: 'item_probe_token',
          }],
        },
      },
      combinations: [],
      riddles: [],
      endings: {},
    }, null, 2)}\n`)

    const adventureRoute = join(workspace, 'adventure-route.json')
    await writeFile(adventureRoute, `${JSON.stringify({
      seed: '1',
      steps: [
        { do: 'adventure_click', x: 100, y: 0, label: 'walk to the probe point' },
        { do: 'expect', adventure_scene: 'scene_fmv_crossing' },
        { do: 'adventure_cursor', mode: 'take' },
        { do: 'adventure_click', x: 100, y: 0, label: 'take the probe token' },
        { do: 'expect', adventure_item: { item: 'item_probe_token', quantity: 1 } },
      ],
    }, null, 2)}\n`)

    for (const runner of runners) {
      const label = `${runner.name} positive adventure`
      const check = invoke(runner.executable, [
        ...runner.prefix,
        'check', positiveAdventure,
        '--json', '--seeds', '1-1', '--steps', '50',
        '--out', join(workspace, 'reports', `${runner.name}-positive-adventure`),
      ])
      assert.equal(check.rc, 0, `${label}: strict warning-free check expected rc=0\n${check.stdout}\n${check.stderr}`)
      const report = reportFrom(check, `${label} check`)
      assert.equal(report.campaign?.id, 'fmv-crossing')
      assert.equal(report.verdict, 'ok')
      assert.equal(report.graph?.errors?.length, 0)
      assert.equal(report.graph?.warnings?.length, 0)
      assert.equal(report.sweep?.seeds, 1)

      const run = invoke(runner.executable, [
        ...runner.prefix,
        'run', positiveAdventure,
        '--json', '--seed', '1', '--script', adventureRoute,
        '--out', join(workspace, 'runs', runner.name),
      ])
      assert.equal(run.rc, 0, `${label}: adventure runtime route expected rc=0\n${run.stdout}\n${run.stderr}`)
      const result = reportFrom(run, `${label} run`)
      assert.equal(result.status, 'ok', `${label}: adventure route status`)
      assert.equal(result.assertions?.length, 2, `${label}: actual adventure assertions`)
      assert.ok(result.assertions.every((assertion: { ok?: unknown }) => assertion.ok === true), `${label}: all adventure actions and assertions must pass`)
      console.log(`✓ ${label}: warning-free strict check rc=0; actual adventure walk/take route rc=0`)
    }
  } finally {
    await rm(workspace, { recursive: true, force: true })
  }
}

async function readdirFiles(directory: string, prefix = ''): Promise<string[]> {
  const entries = await readdir(join(directory, prefix), { withFileTypes: true })
  const files: string[] = []
  for (const entry of entries) {
    const relativePath = prefix ? `${prefix}/${entry.name}` : entry.name
    if (entry.isDirectory()) files.push(...await readdirFiles(directory, relativePath))
    else if (entry.isFile()) files.push(relativePath)
  }
  return files.sort()
}

await main()
