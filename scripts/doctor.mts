/**
 * Паспорт среды: что есть у агента до первой правки.
 *
 *   npm run doctor            — таблица «есть / нет / чем заменить»
 *   npm run doctor -- --json  — то же машинно, для отчёта миссии
 *   npm run doctor -- --net   — плюс достижимость разрешённых хостов (медленнее)
 *   npm run doctor -- --strict — rc=1, если среда не готова к работе (нет node_modules)
 *
 * Зачем: знания о песочнице (что стоит, чего нет, что не переживает ход) жили
 * в `docs/agents/sandbox.md`, написанном руками, и каждый агент проверял их
 * заново. Проверка должна быть командой, а не памятью: среда меняется, документ
 * стареет молча. Подробности и правила установки — `docs/agents/toolbox.md`.
 *
 * Скрипт ничего не меняет и не требует сети, кроме режима `--net`.
 */
import { existsSync, readFileSync, statSync } from 'node:fs'
import { delimiter, join, resolve } from 'node:path'
import { spawnSync } from 'node:child_process'
import { availableParallelism, cpus, release, totalmem, freemem } from 'node:os'

const root = resolve(import.meta.dirname, '..')
const argv = new Set(process.argv.slice(2))
const asJson = argv.has('--json')
const withNet = argv.has('--net')
const strict = argv.has('--strict')

interface ToolInfo {
  /** Имя команды, которое ищет агент. */
  id: string
  /** Что это даёт в работе. */
  why: string
  /** Обязателен ли инструмент для базовых гейтов. */
  required: boolean
}

/**
 * Инструменты, о которых агенты спрашивают чаще всего. `required` — не про
 * качество проекта, а про то, без чего не запускаются гейты из
 * `docs/phases.md` §Сквозные гейты.
 */
const TOOLS: ToolInfo[] = [
  { id: 'git', why: 'ветки, коммиты, PR — ритуал старта сессии', required: true },
  { id: 'gh', why: 'PR, проверки CI, релизы', required: false },
  { id: 'npm', why: 'зависимости и npm-скрипты', required: true },
  { id: 'npx', why: 'tsc, tsx и разовые запуски без установки', required: true },
  { id: 'node', why: 'среда исполнения всех гейтов', required: true },
  { id: 'python3', why: 'скрипты медиа (cutout-chromakey.py)', required: false },
  { id: 'pip3', why: 'python-пакеты из PyPI (например pygltflib)', required: false },
  { id: 'convert', why: 'ImageMagick: ресайз, хромакей, golden frames', required: false },
  { id: 'montage', why: 'контактный лист анимации одной командой', required: false },
  { id: 'compare', why: 'перцептивный дифф кадров (golden frames)', required: false },
  { id: 'identify', why: 'размеры и альфа без запуска кода', required: false },
  { id: 'jq', why: 'разбор JSON в отчётах и проверках', required: false },
  { id: 'unzip', why: 'распаковка AI-кита для проверки', required: false },
  { id: 'ffmpeg', why: 'видео и звук (в образе отсутствует, см. toolbox.md)', required: false },
  { id: 'blender', why: '3D-редактор (агентам не нужен, см. ADR 0007)', required: false },
]

const IMAGE_MAGICK = 'ImageMagick'

/**
 * Что не переживает ход. Список — факт платформы, а не совет: снапшот
 * сохраняет только рабочее дерево, а кэши и `node_modules` в него не входят.
 */
const NOT_PERSISTED = [
  'node_modules — переустанавливается `npm ci`',
  '~/.npm и ~/.cache — кэш пакетов теряется',
  '/tmp — временные файлы и распакованные архивы',
  'установленные через apt/pip пакеты — не root и нет сброса',
]

const isExecutable = (path: string): boolean => {
  try {
    const stat = statSync(path)
    return stat.isFile()
  } catch {
    return false
  }
}

/** Ищет команду в PATH без запуска процесса: `which` сам может отсутствовать. */
function which(command: string): string | null {
  const path = process.env.PATH ?? ''
  for (const dir of path.split(delimiter)) {
    if (!dir) continue
    const candidate = join(dir, command)
    if (isExecutable(candidate)) return candidate
  }
  return null
}

function run(command: string, args: string[]): string | null {
  try {
    const result = spawnSync(command, args, { cwd: root, encoding: 'utf8', timeout: 8000 })
    if (result.error || result.status !== 0) return null
    return (result.stdout ?? '').trim()
  } catch {
    return null
  }
}

function readText(path: string): string | null {
  try {
    // Абсолютные пути — системные файлы (`/etc/os-release`, `/proc/cpuinfo`),
    // их нельзя склеивать с корнем репозитория.
    return readFileSync(path.startsWith('/') ? path : join(root, path), 'utf8')
  } catch {
    return null
  }
}

function osName(): string {
  const release = readText('/etc/os-release')
  if (release) {
    const pretty = release.match(/^PRETTY_NAME="?([^"\n]+)"?/m)
    if (pretty) return pretty[1]
  }
  return process.platform
}

function cpuModel(): string {
  const info = readText('/proc/cpuinfo')
  if (!info) return 'неизвестно'
  const match = info.match(/^model name\s*:\s*(.+)$/m)
  return match ? match[1].trim() : 'неизвестно'
}

function diskFreeGb(): number | null {
  try {
    const out = spawnSync('df', ['-k', root], { encoding: 'utf8', timeout: 5000 })
    if (out.status !== 0) return null
    const line = out.stdout.split('\n')[1] ?? ''
    const parts = line.trim().split(/\s+/)
    const available = Number(parts[3])
    if (!Number.isFinite(available)) return null
    return Math.round((available / 1024 / 1024) * 10) / 10
  } catch {
    return null
  }
}

interface HostProbe {
  url: string
  ok: boolean
  ms: number | null
  note: string
}

/**
 * Разрешённые хосты — из `docs/agents/sandbox.md`. Проверяем только их: всё
 * остальное закрыто и тратить на него ход бессмысленно.
 */
const ALLOWED_HOSTS = [
  { url: 'https://registry.npmjs.org/', note: 'npm-пакеты' },
  { url: 'https://pypi.org/simple/', note: 'python-пакеты' },
  { url: 'https://github.com', note: 'git и gh' },
]

async function probeHosts(): Promise<HostProbe[]> {
  const results: HostProbe[] = []
  for (const host of ALLOWED_HOSTS) {
    const started = Date.now()
    try {
      const response = await fetch(host.url, { method: 'HEAD', signal: AbortSignal.timeout(6000) })
      results.push({
        url: host.url,
        ok: response.ok || response.status === 405,
        ms: Date.now() - started,
        note: host.note,
      })
    } catch {
      results.push({ url: host.url, ok: false, ms: null, note: host.note })
    }
  }
  return results
}

const tools = TOOLS.map((tool) => ({ ...tool, path: which(tool.id) }))

const gitStatus = run('git', ['status', '--porcelain'])
const branch = run('git', ['rev-parse', '--abbrev-ref', 'HEAD'])
const head = run('git', ['log', '-1', '--format=%h %s'])
const nodeModules = existsSync(join(root, 'node_modules'))
const tsx = existsSync(join(root, 'node_modules', '.bin', 'tsx'))
const tsc = existsSync(join(root, 'node_modules', 'typescript', 'bin', 'tsc'))
const kit = existsSync(join(root, 'public/ai/cf-play.mjs'))
const dirty = gitStatus !== null && gitStatus.length > 0

const environment = {
  node: process.version,
  npm: run('npm', ['--version']) ?? 'нет',
  python: (which('python3') ? run('python3', ['--version'])?.replace(/^Python\s+/, '') : null) ?? 'нет',
  os: osName(),
  kernel: release(),
  cpu: cpuModel(),
  cores: availableParallelism(),
  cpuCount: cpus().length,
  ramTotalGb: Math.round((totalmem() / 1024 ** 3) * 10) / 10,
  ramFreeGb: Math.round((freemem() / 1024 ** 3) * 10) / 10,
  diskFreeGb: diskFreeGb(),
  uid: typeof process.getuid === 'function' ? process.getuid() : null,
  imageMagick: run('convert', ['-version'])?.split('\n')[0] ?? null,
}

const repo = {
  branch: branch ?? 'не git',
  head: head ?? 'нет истории',
  dirty,
  nodeModules,
  tsx,
  tsc,
  playkitBundle: kit,
  ready: nodeModules && tsx && tsc,
}

const missingRequired = tools.filter((tool) => tool.required && !tool.path).map((tool) => tool.id)
const hosts = withNet ? await probeHosts() : []
const missingHosts = hosts.filter((host) => !host.ok)

const payload = {
  generatedAt: new Date().toISOString(),
  environment,
  tools: tools.map(({ id, why, required, path }) => ({ id, why, required, found: Boolean(path) })),
  repo,
  missingRequired,
  notPersisted: NOT_PERSISTED,
  hosts,
}

if (asJson) {
  console.log(JSON.stringify(payload, null, 2))
} else {
  const line = (label: string, value: string | number | null) =>
    console.log(`  ${label.padEnd(22)} ${value === null ? '—' : value}`)

  console.log('Среда')
  line('node', environment.node)
  line('npm', environment.npm)
  line('python3', environment.python)
  line('ОС', environment.os)
  line('ядро', environment.kernel)
  line('CPU', environment.cpu)
  line('ядер / потоков', `${environment.cores} / ${environment.cpuCount}`)
  line('RAM (всего/свободно)', `${environment.ramTotalGb} / ${environment.ramFreeGb} ГБ`)
  line('диск свободно', `${environment.diskFreeGb ?? '—'} ГБ`)
  line('uid', environment.uid === 0 ? '0 (root)' : `${environment.uid} (не root)`)
  line(IMAGE_MAGICK, environment.imageMagick ?? 'нет')

  console.log('\nИнструменты')
  for (const tool of tools) {
    const mark = tool.path ? '✓' : tool.required ? '✗' : '·'
    const tail = tool.path ? '' : ` — ${tool.why}`
    console.log(`  ${mark} ${tool.id.padEnd(10)}${tail}`)
  }

  console.log('\nРепозиторий')
  line('ветка', repo.branch)
  line('HEAD', repo.head)
  line('незакоммичено', repo.dirty ? 'да (см. git status)' : 'нет')
  line('node_modules', repo.nodeModules ? 'есть' : 'нет — нужен `npm ci`')
  line('tsx / tsc', `${repo.tsx ? '✓' : '✗'} / ${repo.tsc ? '✓' : '✗'}`)
  line('бандл cf-play', repo.playkitBundle ? 'на месте' : 'нет — `npm run build:playkit-bundle`')
  line('готовность', repo.ready ? 'к работе готова' : 'НЕ готова: `npm ci`')

  console.log('\nНе переживает ход')
  for (const item of NOT_PERSISTED) console.log(`  · ${item}`)

  if (withNet) {
    console.log('\nРазрешённые хосты')
    for (const host of hosts) {
      const ms = host.ms === null ? '' : ` ${host.ms} мс`
      console.log(`  ${host.ok ? '✓' : '✗'} ${host.url.padEnd(32)}${ms} — ${host.note}`)
    }
  } else {
    console.log('\nРазрешённые хосты: npm, PyPI, GitHub. Проверить сейчас — `npm run doctor -- --net`.')
  }

  console.log('\nКвоты хода: 10 изображений и 10 аудиоклипов (docs/agents/generation-quotas.md).')
}

const failures: string[] = []
if (strict && !repo.ready) failures.push('окружение не готово: нет node_modules (npm ci)')
if (missingHosts.length > 0) failures.push(`недоступны хосты: ${missingHosts.map((h) => h.url).join(', ')}`)

if (failures.length > 0) {
  console.error(`\ndoctor: ${failures.join('; ')}`)
  process.exit(1)
}
