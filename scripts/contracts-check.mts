/**
 * Проверка контрактов платформы.
 *
 * Контракты в docs/contracts — не справка, а исполняемые документы: схемы
 * компилируются, примеры валидируются, семантические правила (kind→caps,
 * совместимость рантаймов, совпадение пака с реестром) проверяются кодом.
 * Негативные примеры обязаны падать — иначе схема ничего не запрещает.
 *
 * Запуск: npm run check:contracts
 */
import { readdir, readFile } from 'node:fs/promises'
import { join, resolve } from 'node:path'
import Ajv2020 from 'ajv/dist/2020.js'
import { CAPABILITY_REGISTRY, campaignCaps, featureOn } from '../src/core/caps'

const root = resolve(import.meta.dirname, '..')
const dir = join(root, 'docs', 'contracts')

type Json = Record<string, any>

const failures: string[] = []
let checks = 0

const check = (name: string, ok: boolean, detail?: string) => {
  checks += 1
  if (ok) {
    console.log(`  ✓ ${name}`)
  } else {
    failures.push(detail ? `${name}: ${detail}` : name)
    console.log(`  ✗ ${name}${detail ? ` — ${detail}` : ''}`)
  }
}

const readJson = async (path: string): Promise<Json> => JSON.parse(await readFile(join(dir, path), 'utf8'))

const registry = await readJson('caps.json')
const projectSchema = await readJson('project.schema.json')
const packSchema = await readJson('pack.schema.json')

const ajv = new Ajv2020({ allErrors: true, strict: false })
const validateProject = ajv.compile(projectSchema)
const validatePack = ajv.compile(packSchema)

const formatErrors = (errors: unknown) =>
  (errors as Array<{ instancePath?: string; message?: string }>)
    .map((e) => `${e.instancePath || '/'} ${e.message}`)
    .join('; ')

// ── реестр: целостность ──────────────────────────────────────────────
const capIds = new Set<string>()
const packIds = new Set<string>()
const kindIds = new Set<string>()

for (const cap of registry.caps) {
  if (capIds.has(cap.id)) failures.push(`реестр: повторяющийся id возможности ${cap.id}`)
  capIds.add(cap.id)
}
for (const pack of registry.packs) {
  if (packIds.has(pack.id)) failures.push(`реестр: повторяющийся id пака ${pack.id}`)
  packIds.add(pack.id)
}
for (const kind of registry.kinds) {
  if (kindIds.has(kind.id)) failures.push(`реестр: повторяющийся id типа проекта ${kind.id}`)
  kindIds.add(kind.id)
}

const packById = new Map(registry.packs.map((p: Json) => [p.id, p]))
const capById = new Map(registry.caps.map((c: Json) => [c.id, c]))

const registryProjection = (caps: Array<Json>) =>
  caps
    .map(({ id, title, pack, status, since, enables, probe }) => ({ id, title, pack, status, since, enables, probe }))
    .sort((a, b) => a.id.localeCompare(b.id))
const registriesMatch = (contractCaps: Array<Json>, runtimeCaps: Array<Json>) =>
  JSON.stringify(registryProjection(contractCaps)) === JSON.stringify(registryProjection(runtimeCaps))
const runtimeCaps = [...CAPABILITY_REGISTRY] as Array<Json>
const contractsRegistryMatches = registriesMatch(registry.caps, runtimeCaps)
const deliberateMismatch = runtimeCaps.map((cap, index) => index === 0 ? { ...cap, probe: 'mismatch-probe' } : cap)
const mismatchIsRejected = !registriesMatch(registry.caps, deliberateMismatch)
const capsSource = await readFile(join(root, 'src', 'core', 'caps.ts'), 'utf8')
const typesSource = await readFile(join(root, 'src', 'shared', 'types.ts'), 'utf8')
const packageJson = JSON.parse(await readFile(join(root, 'package.json'), 'utf8')) as Json
check(
  'caps.json совпадает с runtime-реестром src/core/caps.ts',
  contractsRegistryMatches,
  contractsRegistryMatches ? undefined : 'id/title/pack/status/since/enables/probe различаются',
)
check('синтетическое расхождение реестров отклоняется', mismatchIsRejected)
check(
  'featureOn реализован в caps.ts, а не в types.ts',
  /export function featureOn\s*\(/.test(capsSource) && !/export function featureOn\s*\(/.test(typesSource),
)
const missingCapMetadata = registry.caps.filter((cap: Json) =>
  typeof cap.enables !== 'string' || cap.enables.trim() === '' ||
  ((cap.status === 'stable' || cap.status === 'experimental')
    ? typeof cap.probe !== 'string' || cap.probe.trim() === ''
    : cap.probe !== null),
)
check('у каждой возможности есть назначение и проба по статусу', missingCapMetadata.length === 0,
  missingCapMetadata.map((cap: Json) => cap.id).join(', '))
const unknownProbes = registry.caps.filter((cap: Json) => cap.probe !== null && !packageJson.scripts?.[cap.probe])
check('пробы возможностей существуют в npm scripts', unknownProbes.length === 0,
  unknownProbes.map((cap: Json) => `${cap.id}: ${cap.probe}`).join(', '))
check('гейт размеров модулей зарегистрирован в npm scripts', typeof packageJson.scripts?.['check:module-size'] === 'string')

const listProfile = { features: ['combat'] }
const listCaps = campaignCaps(listProfile)
const mapProfile = { features: { map: true } }
const legacyMapCaps = campaignCaps(mapProfile)
const explicitProfile = { caps: ['map'] }
const explicitCaps = campaignCaps(explicitProfile)
let malformedProfileError = ''
try {
  campaignCaps({ features: 'combat' })
} catch (error) {
  malformedProfileError = error instanceof Error ? error.message : String(error)
}
console.log('\nпрофили возможностей (compatibility report)')
console.log(`features: ["combat"] -> caps: ${JSON.stringify(listCaps)}; combat=${featureOn(listProfile, 'combat')}`)
console.log(`features: {"map":true} -> caps: ${JSON.stringify(legacyMapCaps)}; combat=${featureOn(mapProfile, 'combat')}; map=${featureOn(mapProfile, 'map')}`)
console.log(`caps: ["map"] -> caps: ${JSON.stringify(explicitCaps)}; combat=${featureOn(explicitProfile, 'combat')}; map=${featureOn(explicitProfile, 'map')}`)
console.log(`features: "combat" -> rejected: ${malformedProfileError || 'NO ERROR'}`)
check('features list maps to exactly its registered capabilities',
  listCaps.length === 1 && listCaps[0] === 'combat' && featureOn(listProfile, 'combat'))
check('legacy features map preserves omitted=true semantics',
  legacyMapCaps.length === 8 &&
    ['map', 'inventory', 'needs', 'skills', 'relationships', 'trade', 'combat', 'time'].every((id) => legacyMapCaps.includes(id)) &&
    featureOn(mapProfile, 'combat') && featureOn(mapProfile, 'inventory'))
check('explicit caps list takes precedence and remains exact',
  explicitCaps.length === 1 && explicitCaps[0] === 'map' && featureOn(explicitProfile, 'map') && !featureOn(explicitProfile, 'combat'))
check('unrecognized profile format fails loudly instead of returning an empty caps list',
  malformedProfileError.includes('expected string[] or a boolean map'))
check('campaign without either profile keeps the pre-registry default',
  ['map', 'inventory', 'needs', 'skills', 'relationships', 'trade', 'combat', 'time'].every((id) => featureOn({}, id)))


const badRuntime = registry.caps.filter((c: Json) => !registry.runtimes.includes(capRuntime(c)))
const badStatus = registry.caps.filter((c: Json) => !registry.statuses.includes(c.status))

function capRuntime(cap: Json): string {
  if (!cap.pack) return 'none'
  return packById.get(cap.pack)?.runtime ?? 'unknown'
}

// ── семантика проекта ────────────────────────────────────────────────
function projectProblems(project: Json): string[] {
  const problems: string[] = []
  const caps: string[] = project.caps ?? []
  if (!kindIds.has(project.kind)) problems.push(`неизвестный kind ${project.kind}`)
  const kind = registry.kinds.find((k: Json) => k.id === project.kind)
  for (const cap of caps) {
    const entry = capById.get(cap)
    if (!entry) {
      problems.push(`возможность ${cap} отсутствует в реестре`)
      continue
    }
    if (!['stable', 'experimental'].includes(entry.status)) {
      problems.push(`возможность ${cap} в статусе ${entry.status}, проект не может её включать`)
    }
  }
  for (const required of kind?.requires ?? []) {
    if (!caps.includes(required)) problems.push(`тип ${project.kind} требует возможность ${required}`)
    if (project.cap_options?.[required]?.mode === 'off') {
      problems.push(`возможность ${required} выключена, но тип ${project.kind} её требует`)
    }
  }

  const modes: string[] = registry.capability_modes ?? ['core', 'code', 'off']
  let hasCodeMode = false
  for (const [cap, option] of Object.entries(project.cap_options ?? {})) {
    const opt = option as Json
    if (!caps.includes(cap)) problems.push(`настройка ${cap} не относится ни к одной включённой возможности`)
    if (!capById.has(cap)) problems.push(`настройка ${cap}: возможности нет в реестре`)
    if (opt.mode !== undefined && !modes.includes(opt.mode)) {
      problems.push(`режим ${opt.mode} у возможности ${cap} неизвестен`)
    }
    if (opt.mode === 'code') hasCodeMode = true
    if (opt.version !== undefined && (!Number.isInteger(opt.version) || opt.version < 1)) {
      problems.push(`версия поведения ${cap} должна быть целым ≥ 1`)
    }
  }
  if (hasCodeMode && !project.code?.entry) {
    problems.push('есть режим code, но code.entry не задан')
  }

  if (project.default_language && !(project.languages ?? []).includes(project.default_language)) {
    problems.push(`язык ${project.default_language} не входит в languages`)
  }

  const runtimes = new Set(
    caps.map((cap: string) => capRuntime(capById.get(cap) ?? {})).filter((r: string) => r !== 'none'),
  )
  if (runtimes.size > 1) problems.push(`смешаны рантаймы: ${[...runtimes].join(', ')}`)
  if (project.engine?.tested && project.engine.min && semverParts(project.engine.tested) < semverParts(project.engine.min)) {
    problems.push(`tested ${project.engine.tested} ниже min ${project.engine.min}`)
  }
  return problems
}

function semverParts(v: string): number {
  const [a, b, c] = v.split('.').map(Number)
  return a * 1e6 + b * 1e3 + c
}

// ── семантика пака ───────────────────────────────────────────────────
function packProblems(pack: Json): string[] {
  const problems: string[] = []
  const entry = packById.get(pack.id)
  if (!entry) {
    problems.push(`пак ${pack.id} отсутствует в реестре`)
    return problems
  }
  if (pack.runtime !== entry.runtime) problems.push(`runtime ${pack.runtime} ≠ реестр ${entry.runtime}`)
  const owned = registry.caps.filter((c: Json) => c.pack === pack.id).map((c: Json) => c.id)
  const declared: string[] = pack.caps ?? []
  const missing = owned.filter((id: string) => !declared.includes(id))
  const extra = declared.filter((id: string) => !owned.includes(id))
  if (missing.length) problems.push(`пак не объявляет свои возможности: ${missing.join(', ')}`)
  if (extra.length) problems.push(`пак объявляет чужие возможности: ${extra.join(', ')}`)
  if (pack.provides?.kind && !registry.kinds.some((k: Json) => k.pack === pack.id)) {
    problems.push('пак объявляет kind, но реестр типов этого не знает')
  }
  for (const key of ['panels', 'validators', 'probes'] as const) {
    const ids = (pack.provides?.[key] ?? []).map((item: Json) => item.id)
    if (new Set(ids).size !== ids.length) problems.push(`повторяющиеся id в ${key}`)
    for (const item of pack.provides?.[key] ?? []) {
      for (const cap of item.caps ?? []) {
        if (!capIds.has(cap)) problems.push(`${key}.${item.id}: неизвестная возможность ${cap}`)
      }
    }
  }
  for (const cap of pack.requires?.caps ?? []) {
    if (!capIds.has(cap)) problems.push(`requires: неизвестная возможность ${cap}`)
    if (pack.caps?.includes(cap)) problems.push(`requires: возможность ${cap} уже своя`)
  }
  for (const other of pack.requires?.packs ?? []) {
    if (!packIds.has(other)) problems.push(`requires: неизвестный пак ${other}`)
    if (other === pack.id) problems.push('requires: пак требует сам себя')
  }
  if ((pack.saves?.migrations ?? 0) > 0 && (pack.saves?.version ?? 1) < 2) {
    problems.push('миграции объявлены, но version = 1')
  }
  const seamIds = (pack.provides?.seams ?? []).map((s: Json) => s.id)
  if (new Set(seamIds).size !== seamIds.length) problems.push('повторяющиеся id швов')
  for (const seam of pack.provides?.seams ?? []) {
    if (!['sim', 'view'].includes(seam.kind)) problems.push(`шов ${seam.id}: неизвестный вид ${seam.kind}`)
    for (const cap of seam.caps ?? []) {
      if (!capIds.has(cap)) problems.push(`шов ${seam.id}: неизвестная возможность ${cap}`)
    }
  }
  if (pack.provides?.probes?.length === 0) problems.push('пак без проб не принимается')
  return problems
}

// ── прогон ───────────────────────────────────────────────────────────
console.log('\nреестр возможностей')
check('ids возможностей уникальны', new Set(registry.caps.map((c: Json) => c.id)).size === registry.caps.length)
check('ids паков уникальны', new Set(registry.packs.map((p: Json) => p.id)).size === registry.packs.length)
check('ids типов проектов уникальны', new Set(registry.kinds.map((k: Json) => k.id)).size === registry.kinds.length)
check('у каждой возможности валидный статус', badStatus.length === 0, badStatus.map((c: Json) => c.id).join(', '))
check('у каждой возможности известный рантайм', badRuntime.length === 0, badRuntime.map((c: Json) => c.id).join(', '))
check(
  'kind ссылается на существующий пак',
  registry.kinds.every((k: Json) => packIds.has(k.pack)),
  registry.kinds.filter((k: Json) => !packIds.has(k.pack)).map((k: Json) => k.id).join(', '),
)
check(
  'kind требует только свои возможности',
  registry.kinds.every((k: Json) =>
    (k.requires ?? []).every((cap: string) => capById.get(cap)?.pack === k.pack),
  ),
)
check(
  'зарезервированная возможность не принадлежит паку',
  registry.caps.every((c: Json) => (c.status === 'reserved' ? c.pack === null : c.pack !== null)),
)
check(
  'каждый пак владеет хотя бы одной возможностью',
  registry.packs.every((p: Json) => registry.caps.some((c: Json) => c.pack === p.id)),
)

check(
  'реестр задаёт режимы возможностей',
  Array.isArray(registry.capability_modes) && registry.capability_modes.join(',') === 'core,code,off',
)

console.log('\nпример пака narrative')
const narrativePack = await readJson('examples/pack.narrative.json')
const narrativeSchemaOk = validatePack(narrativePack)
check('проходит схему', narrativeSchemaOk, narrativeSchemaOk ? undefined : formatErrors(validatePack.errors))
const narrativePackProblems = packProblems(narrativePack)
check('проходит семантику', narrativePackProblems.length === 0, narrativePackProblems.join('; '))

console.log('\nпример пака grid-strategy')
const gridPack = await readJson('examples/pack.grid-strategy.json')
const gridSchemaOk = validatePack(gridPack)
check('проходит схему', gridSchemaOk, gridSchemaOk ? undefined : formatErrors(validatePack.errors))
const gridPackProblems = packProblems(gridPack)
check('проходит семантику', gridPackProblems.length === 0, gridPackProblems.join('; '))

console.log('\nпример проекта narrative')
const narrativeProject = await readJson('examples/project.narrative.json')
const projectSchemaOk = validateProject(narrativeProject)
check('проходит схему', projectSchemaOk, projectSchemaOk ? undefined : formatErrors(validateProject.errors))
const projectProblemsList = projectProblems(narrativeProject)
check('проходит семантику', projectProblemsList.length === 0, projectProblemsList.join('; '))

console.log('\nпример проекта с кодом в швах')
const codeProject = await readJson('examples/project.code-mode.json')
const codeSchemaOk = validateProject(codeProject)
check('проходит схему', codeSchemaOk, codeSchemaOk ? undefined : formatErrors(validateProject.errors))
const codeProblems = projectProblems(codeProject)
check('проходит семантику', codeProblems.length === 0, codeProblems.join('; '))

console.log('\nпример локали')
const localeDe = await readJson('examples/locales.de.json')
check('схема локали = 1', localeDe.schema === 1)
check('язык файла совпадает с именем', localeDe.language === 'de')
const localeKeys = Object.keys(localeDe.strings ?? {})
check(
  'ключи строк — стабильные ID по структуре',
  localeKeys.length > 0 && localeKeys.every((key) => /^[a-z0-9_]+(\/[a-z0-9_]+)+$/.test(key)),
)
check(
  'у каждой строки есть хэш источника',
  localeKeys.every((key) => /^[0-9a-f]{8,}$/.test(String(localeDe.sources?.[key] ?? ''))),
)
check(
  'у каждого источника есть строка',
  Object.keys(localeDe.sources ?? {}).every((key) => key in localeDe.strings),
)

console.log('\nнегативные примеры обязаны падать')
const invalidDir = 'examples/invalid'
let rejectedBySemantics = 0
for (const name of (await readdir(join(dir, invalidDir))).sort()) {
  const sample = await readJson(join(invalidDir, name))
  const schemaOk = validateProject(sample)
  const problems = schemaOk ? projectProblems(sample) : []
  const layer = schemaOk ? 'семантика' : 'схема'
  if (schemaOk && problems.length) rejectedBySemantics += 1
  check(`${name}: отклонён (${layer})`, !schemaOk || problems.length > 0, schemaOk ? 'плохой пример прошёл всё' : undefined)
}
check('семантика ловит то, что схема пропускает', rejectedBySemantics > 0)

console.log('\nполнота контрактов')
const stableKinds = registry.kinds.filter((k: Json) => packById.get(k.pack)?.status === 'stable').map((k: Json) => k.id)
check(
  'у каждого стабильного kind есть пример проекта',
  stableKinds.every((id: string) => narrativeProject.kind === id),
  stableKinds.join(', '),
)
const stablePacks = registry.packs.filter((p: Json) => p.status === 'stable').map((p: Json) => p.id)
check(
  'у каждого стабильного пака есть манифест-пример',
  stablePacks.every((id: string) => narrativePack.id === id),
  stablePacks.join(', '),
)

if (failures.length) {
  console.error(`\nПРОВАЛЕНО: ${failures.length}`)
  for (const failure of failures) console.error(`  - ${failure}`)
  process.exit(1)
}
console.log(`\nконтракты согласованы: ${checks} проверок`)
