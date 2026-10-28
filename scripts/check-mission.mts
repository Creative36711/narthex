import { spawnSync } from 'node:child_process'
import { join, resolve } from 'node:path'

const root = resolve(import.meta.dirname, '..')
const tsc = join(root, 'node_modules/typescript/bin/tsc')

interface MissionStep {
  command: string
  executable: string
  args: string[]
}

const npm = 'npm'
const node = process.execPath
const steps: MissionStep[] = [
  { command: 'tsc -b', executable: node, args: [tsc, '-b'] },
  { command: 'npm run check:contracts', executable: npm, args: ['run', 'check:contracts'] },
  { command: 'npm run check:core-graph', executable: npm, args: ['run', 'check:core-graph'] },
  { command: 'npm run check:guide', executable: npm, args: ['run', 'check:guide'] },
  { command: 'npm run check:compat-corpus', executable: npm, args: ['run', 'check:compat-corpus'] },
  { command: 'npm run check:narrative-codes', executable: npm, args: ['run', 'check:narrative-codes'] },
  { command: 'npm run check:version', executable: npm, args: ['run', 'check:version'] },
  { command: 'npm run check:brand', executable: npm, args: ['run', 'check:brand'] },
  { command: 'npm run smoke:core', executable: npm, args: ['run', 'smoke:core'] },
  { command: 'npm run smoke:mission (55 scripts)', executable: npm, args: ['run', 'smoke:mission'] },
  {
    command: 'npm run check:determinism (NAR-4.4 + NAR-4.6 browser/cf-play)',
    executable: npm,
    args: ['run', 'check:determinism'],
  },
  {
    command: 'node public/ai/cf-play.mjs check public/campaigns/ash-of-caerden',
    executable: node,
    args: ['public/ai/cf-play.mjs', 'check', 'public/campaigns/ash-of-caerden'],
  },
  {
    command: 'node public/ai/cf-play.mjs check public/campaigns/ash-of-caerden-adventure',
    executable: node,
    args: ['public/ai/cf-play.mjs', 'check', 'public/campaigns/ash-of-caerden-adventure'],
  },
]

interface Result {
  command: string
  rc: number
}

const results: Result[] = []
for (const step of steps) {
  const result = spawnSync(step.executable, step.args, {
    cwd: root,
    env: process.env,
    stdio: 'inherit',
  })
  const rc = result.error ? 127 : result.status ?? 1
  results.push({ command: step.command, rc })
}

const width = Math.max('command'.length, ...results.map((result) => result.command.length))
console.log('\nAdded NAR-4.6 second-runtime parity checks (Chromium vs cf-play Node; each repeated):')
console.log('- Chromium turn executor: five seed cases against the cf-play turn executor')
console.log('- Chromium realtime executor: five seed cases against the cf-play realtime executor')
console.log('\nMission check results')
console.log(`${'command'.padEnd(width)}  rc`)
for (const result of results) console.log(`${result.command.padEnd(width)}  ${result.rc}`)
const rc = results.every((result) => result.rc === 0) ? 0 : 1
console.log(`check:mission ${rc === 0 ? 'passed' : 'failed'}; rc=${rc}`)
process.exitCode = rc
