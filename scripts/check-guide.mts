import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import { existsSync } from 'node:fs'
import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import { dirname, join, resolve, sep } from 'node:path'
import { tmpdir } from 'node:os'
import JSZip from 'jszip'
import { NARRATIVE_CODE_LIST } from './playkit/narrative-codes'

const root = resolve(import.meta.dirname, '..')
const guidePath = join(root, 'docs/guides/nar-2.15-playkit.md')
const guide = await readFile(guidePath, 'utf8')
const sourceGuide = await readFile(join(root, 'docs/ai-campaign-guide.md'), 'utf8')
const publicGuide = await readFile(join(root, 'public/ai/campaign-guide.md'), 'utf8')
assert.equal(publicGuide, sourceGuide, 'campaign-guide.md перестал совпадать с его канонической копией')
const sizeDecision = await readFile(join(root, 'docs/decisions/NAR-2.15.md'), 'utf8')
assert.match(sizeDecision, /^Статус: proposed/m, 'Предложение по лимиту должно оставаться на рассмотрении')
assert.match(sizeDecision, /294 912 байт/, 'ADR не содержит обоснованного предложенного предела')
assert.match(sizeDecision, /71 680.*остаётся действующим/, 'Действующий предел нельзя повышать молча')

const blocks = [...guide.matchAll(/```(?:bash|sh)\s*\n([\s\S]*?)```/g)]
const commands = blocks.flatMap((block) => block[1]!
  .split('\n')
  .map((line) => line.trim())
  .filter((line) => line && !line.startsWith('#')))
assert.equal(commands.length, 6, `Ожидалось шесть исполняемых команд в памятке, найдено ${commands.length}`)

interface CommandResult {
  code: number
  output: string
}

function run(executable: string, args: string[], cwd: string): CommandResult {
  const result = spawnSync(executable, args, {
    cwd,
    encoding: 'utf8',
    maxBuffer: 12 * 1024 * 1024,
  })
  if (result.error) throw result.error
  return {
    code: result.status ?? 127,
    output: `${result.stdout ?? ''}${result.stderr ?? ''}`,
  }
}

function assertExampleOutput(output: string, context: string): void {
  const expected = [
    '10 сцен · 8 локаций · 6 диалогов · 21 узлов ink',
    'ошибок 0 · предупреждений 8',
    `seed'ов 5 · исходы {"death":5}`,
    'посещено 6 из 10 достижимых сцен',
    'Эталон: 10 сцен · 8 локаций · 6 диалогов · 21 ink · ошибок 0 · предупреждений 8 · смертей 5 · покрытие 6 из 10',
  ]
  for (const fragment of expected) assert.ok(output.includes(fragment), `${context}: не найдено «${fragment}»`)
}

function assertExplainOutput(output: string, code: string, context: string): void {
  for (const fragment of [code, 'Почему:', 'Где искать:', 'Минимальный фикс:']) {
    assert.ok(output.includes(fragment), `${context}: explain ${code} не содержит «${fragment}»`)
  }
}

function documentedArgs(line: string): string[] {
  return line.split(/\s+/)
}

const bundleCheck = run('npm', ['run', 'check:playkit-bundle'], root)
assert.equal(bundleCheck.code, 0, `check:playkit-bundle завершился с rc=${bundleCheck.code}\n${bundleCheck.output}`)

const codeCheck = run('npm', ['run', 'check:narrative-codes'], root)
assert.equal(codeCheck.code, 0, `check:narrative-codes завершился с rc=${codeCheck.code}\n${codeCheck.output}`)

// Проверяем каждую строку памятки тем же CLI, которым пользуется читатель.
for (const line of commands) {
  const [executable, ...args] = documentedArgs(line)
  let cwd: string
  if (executable === 'npm' && args[0] === 'run' && args[1] === 'play') cwd = root
  else if (executable === 'node' && args[0] === 'public/ai/cf-play.mjs') cwd = root
  else if (executable === 'node' && args[0] === '__chronicle_ai__/cf-play.mjs') {
    // Запустим после распаковки ниже, когда каталог появится.
    continue
  } else {
    throw new Error(`Команда не распознана проверкой гайда: ${line}`)
  }
  const result = run(executable!, args, cwd)
  assert.equal(result.code, 0, `Команда из гайда завершилась с rc=${result.code}: ${line}\n${result.output}`)
  if (args.includes('example')) assertExampleOutput(result.output, line)
  if (args.includes('explain')) assertExplainOutput(result.output, NARRATIVE_CODE_LIST[0]!.code, line)
}

// В пакет кладём ровно ту же инструкцию и эталон; проверяем собранный zip после распаковки.
const packResult = run('npm', ['run', 'pack:ai-kit'], root)
assert.equal(packResult.code, 0, `pack:ai-kit завершился с rc=${packResult.code}\n${packResult.output}`)
const archivePath = join(root, 'dist-ai/__chronicle_ai__-kit.zip')
assert.ok(existsSync(archivePath), 'pack:ai-kit не создал zip чемодана')
const archive = await JSZip.loadAsync(await readFile(archivePath))
const kitPrefix = '__chronicle_ai__/'
assert.ok(archive.files[`${kitPrefix}CF-PLAY-TOOLS.md`], 'в архиве нет памятки CF-PLAY-TOOLS.md')
assert.ok(archive.files[`${kitPrefix}campaign-guide.md`], 'в архиве нет campaign-guide.md')
assert.ok(archive.files[`${kitPrefix}examples/narrative/campaign.json`], 'в архиве нет эталона для example')
assert.ok(
  !Object.keys(archive.files).some((path) => path.includes('/.cf-play/')),
  'в архив случайно попали скрытые отчёты прогона из каталога кампании',
)

const temp = await mkdtemp(join(tmpdir(), 'narthex-guide-check-'))
try {
  for (const [archiveName, entry] of Object.entries(archive.files)) {
    if (entry.dir) continue
    const destination = resolve(temp, archiveName)
    assert.ok(destination === temp || destination.startsWith(`${temp}${sep}`), `небезопасный путь в архиве: ${archiveName}`)
    await mkdir(dirname(destination), { recursive: true })
    await writeFile(destination, await entry.async('nodebuffer'))
  }
  const unpackedCli = join(temp, '__chronicle_ai__/cf-play.mjs')
  const unpackedExample = join(temp, '__chronicle_ai__/examples/narrative')
  assert.ok(existsSync(unpackedCli), 'после распаковки нет cf-play.mjs')
  assert.ok(existsSync(join(unpackedExample, 'world.json')), 'после распаковки в эталоне нет world.json')
  assert.equal(
    await readFile(join(temp, '__chronicle_ai__/CF-PLAY-TOOLS.md'), 'utf8'),
    guide,
    'памятка в распакованном чемодане отличается от проверяемого источника',
  )

  for (const line of commands.filter((entry) => entry.startsWith('node __chronicle_ai__/cf-play.mjs'))) {
    const [executable, ...args] = documentedArgs(line)
    const result = run(executable!, args, temp)
    assert.equal(result.code, 0, `Команда после распаковки завершилась с rc=${result.code}: ${line}\n${result.output}`)
    if (args.includes('example')) assertExampleOutput(result.output, `распакованный чемодан: ${line}`)
    if (args.includes('explain')) assertExplainOutput(result.output, NARRATIVE_CODE_LIST[0]!.code, `распакованный чемодан: ${line}`)
  }

  // Все значения explain берутся из единственного каталога и доступны в самом bundle.
  for (const entry of NARRATIVE_CODE_LIST) {
    const result = run('node', [unpackedCli, 'explain', entry.code], temp)
    assert.equal(result.code, 0, `распакованный explain ${entry.code} завершился с rc=${result.code}\n${result.output}`)
    assertExplainOutput(result.output, entry.code, 'распакованный чемодан')
  }
  const unknown = run('node', [unpackedCli, 'explain', '__unknown_narrative_code__'], temp)
  assert.equal(unknown.code, 2, `Неизвестный код должен возвращать rc=2, получено ${unknown.code}`)
  for (const entry of NARRATIVE_CODE_LIST) {
    assert.ok(unknown.output.includes(entry.code), `Список неизвестного кода пропустил ${entry.code}`)
  }
} finally {
  await rm(temp, { recursive: true, force: true })
}

console.log(`✓ check:guide: ${commands.length} команд (исходники, bundle, распакованный kit); explain=${NARRATIVE_CODE_LIST.length}; эталон 10/8/6/21, 0/8, 5 смертей, покрытие 6/10`)
