import assert from 'node:assert/strict'
import { spawn, spawnSync, type ChildProcess } from 'node:child_process'
import { existsSync, readFileSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { setTimeout as delay } from 'node:timers/promises'

const root = resolve(import.meta.dirname, '..')
const serverUrl = 'http://127.0.0.1:5173'
const smokeScripts = [
  'smoke:currency',
  'smoke:ink-import',
  'smoke:fingerprint',
  'smoke:book-md',
  'smoke:campaign-index',
  'smoke:guide',
  'smoke:design-doc',
  'smoke:quest-journal',
  'smoke:quest-journal-runtime',
  'smoke:p2',
  'smoke:ai-runtime',
  'smoke:ai-task',
  'smoke:char-templates',
  'smoke:no-campaign',
  'smoke:chronicle-manifest',
  'smoke:dialogues-r31',
  'smoke:dialogues-r32',
  'smoke:breathe-toggle',
  'smoke:scene-subtitles',
  'smoke:scene-editor',
  'smoke:editor-hotspot',
  'smoke:voice-dedup',
  'smoke:narrative-intro',
  'smoke:encounters-loader',
  'smoke:manifest-order',
  'smoke:engine-version',
  'smoke:hero-appearance',
  'smoke:theme-contrast',
  'smoke:dialogue-transitions',
  'smoke:dialogue-skip',
  'smoke:travel-transition',
  'smoke:stranger',
  'smoke:encumbrance',
  'smoke:cutscene-queue',
  'smoke:spoil',
  'smoke:time-semantics',
  'smoke:ai-diff',
  'smoke:view-write',
  'smoke:core',
  'smoke:saves-compat',
  'smoke:pack-missing',
  'smoke:pack-panels',
  'smoke:capability-modes',
  'smoke:dlg-script',
  'smoke:dlg-ui',
  'smoke:folder-import',
  'smoke:narrative-builder',
  'smoke:patch',
  'smoke:cutout',
  'smoke:duration-actions',
  'smoke:craft-fail-time',
  'smoke:dialogue-speaker',
  'smoke:narthex-closed',
  'smoke:narthex-tech',
  'smoke:drive-gateway',
] as const

interface Result {
  command: string
  rc: number
}

const packageJson = JSON.parse(readFileSync(join(root, 'package.json'), 'utf8')) as {
  scripts?: Record<string, string>
}
assert.equal(smokeScripts.length, 55, `Expected exactly 55 mission smoke scripts, got ${smokeScripts.length}`)
for (const name of smokeScripts) {
  assert.equal(typeof packageJson.scripts?.[name], 'string', `Missing npm script ${name}`)
}

function startDevServer(): ChildProcess {
  const vite = join(root, 'node_modules/vite/bin/vite.js')
  if (!existsSync(vite)) throw new Error(`Vite executable is missing: ${vite}; run npm ci first`)
  return spawn(process.execPath, [vite, '--host', '127.0.0.1', '--port', '5173', '--strictPort'], {
    cwd: root,
    stdio: 'ignore',
  })
}

async function waitForServer(server: ChildProcess): Promise<void> {
  const deadline = Date.now() + 60_000
  let spawnError: Error | undefined
  server.once('error', (error) => { spawnError = error })
  while (Date.now() < deadline) {
    if (spawnError) throw spawnError
    if (server.exitCode !== null || server.signalCode !== null) {
      throw new Error(`Vite dev server exited before ready (code=${server.exitCode}, signal=${server.signalCode})`)
    }
    try {
      const response = await fetch(serverUrl)
      if (response.ok) {
        await response.body?.cancel()
        return
      }
    } catch {
      // Retry until the server is ready or the startup deadline expires.
    }
    await delay(250)
  }
  throw new Error(`Vite dev server did not answer at ${serverUrl} within 60s`)
}

async function stopDevServer(server: ChildProcess): Promise<void> {
  const closed = new Promise<void>((resolveClose) => {
    if (server.exitCode !== null || server.signalCode !== null) return resolveClose()
    server.once('close', () => resolveClose())
  })
  if (server.exitCode === null && server.signalCode === null) server.kill('SIGTERM')
  const stopped = await Promise.race([closed.then(() => true), delay(5_000).then(() => false)])
  if (!stopped) {
    server.kill('SIGKILL')
    await closed
  }
}

const results: Result[] = []
let server: ChildProcess | undefined
let startupFailure: string | undefined
try {
  server = startDevServer()
  await waitForServer(server)
  console.log(`Vite dev server ready at ${serverUrl}; running ${smokeScripts.length} smoke scripts serially.`)
  for (const name of smokeScripts) {
    const run = spawnSync('npm', ['run', '--silent', name], {
      cwd: root,
      encoding: 'utf8',
      stdio: 'inherit',
    })
    const rc = run.error ? 127 : run.status ?? 1
    results.push({ command: `npm run ${name}`, rc })
  }
} catch (error) {
  startupFailure = error instanceof Error ? error.message : String(error)
  console.error(`Smoke suite setup failed: ${startupFailure}`)
} finally {
  if (server) await stopDevServer(server)
}

console.log('\nMission smoke results')
console.log('command'.padEnd(38) + 'rc')
for (const result of results) console.log(`${result.command.padEnd(38)}${result.rc}`)
const passed = results.filter((result) => result.rc === 0).length
const rc = startupFailure || results.length !== smokeScripts.length || passed !== smokeScripts.length ? 1 : 0
console.log(`SUMMARY ${passed}/${smokeScripts.length} passed; rc=${rc}`)
process.exitCode = rc
