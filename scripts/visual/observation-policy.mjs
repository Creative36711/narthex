import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { isImagePath, normalizeAssetPath } from './absence-policy.mjs'

export const OBSERVATION_REGISTRY_RELATIVE_PATH = '_tools/visual/allowed-observations.json'
const REGISTRY_FILE = fileURLToPath(new URL('../../_tools/visual/allowed-observations.json', import.meta.url))
const CONSOLE_TEMPLATES = new Map([
  ['[сцена] фон не загрузился: ', '[сцена] фон не загрузился: {url}'],
  ['Failed to load resource: portrait fallback ', 'Failed to load resource: portrait fallback {url}'],
  ['Failed to load resource: map image fallback ', 'Failed to load resource: map image fallback {url}'],
])

function fail(message) {
  throw new Error(`Некорректный реестр наблюдений: ${message}`)
}

function requireString(value, field, label) {
  if (typeof value !== 'string' || !value.trim()) fail(`${label}.${field} должен быть непустой строкой`)
}

function validateDate(value, label) {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    fail(`${label}.date должен быть датой ISO YYYY-MM-DD`)
  }
  const parsed = new Date(`${value}T00:00:00.000Z`)
  if (Number.isNaN(parsed.valueOf()) || parsed.toISOString().slice(0, 10) !== value) {
    fail(`${label}.date не является календарной датой`)
  }
}

function validateCampaignId(value, label) {
  if (typeof value !== 'string' || !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(value)) {
    fail(`${label}.campaignId имеет недопустимый формат`)
  }
}

function validateAssetPath(value, label) {
  if (typeof value !== 'string' || value !== normalizeAssetPath(value) || !value.startsWith('assets/')) {
    fail(`${label}.path должен быть каноническим относительным assets/... путём`)
  }
  if (value.includes('\\') || value.split('/').some((segment) => !segment || segment === '.' || segment === '..')) {
    fail(`${label}.path содержит недопустимый сегмент`)
  }
  if (/[*?{}]/.test(value) || !isImagePath(value)) {
    fail(`${label}.path должен быть точным путём к изображению, без шаблонов и glob`)
  }
}

function validateRegistry(registry) {
  if (!registry || typeof registry !== 'object' || Array.isArray(registry) || registry.schemaVersion !== 1) {
    fail('ожидается объект schemaVersion=1')
  }
  if (!Array.isArray(registry.knownAbsences) || !Array.isArray(registry.consoleErrors)) {
    fail('knownAbsences и consoleErrors должны быть массивами')
  }

  const absenceKeys = new Set()
  for (const [index, entry] of registry.knownAbsences.entries()) {
    const label = `knownAbsences[${index}]`
    validateCampaignId(entry?.campaignId, label)
    validateAssetPath(entry?.path, label)
    requireString(entry?.source, 'source', label)
    requireString(entry?.reason, 'reason', label)
    validateDate(entry?.date, label)
    if (!entry.expected || typeof entry.expected !== 'object' || Array.isArray(entry.expected)) {
      fail(`${label}.expected должен быть объектом`)
    }
    for (const [mode, expected] of [
      ['preview', { status: 200, contentType: 'text/html' }],
      ['fixtureRoot', { status: 200, contentType: 'text/html' }],
    ]) {
      const response = entry.expected[mode]
      if (!response || response.status !== expected.status || response.contentType !== expected.contentType) {
        fail(`${label}.expected.${mode} должен быть ровно ${expected.status} ${expected.contentType}`)
      }
    }
    if (entry.expected.occurrences !== 1) fail(`${label}.expected.occurrences должен быть равен 1`)
    const key = `${entry.campaignId}\0${entry.path}`
    if (absenceKeys.has(key)) fail(`${label} дублирует campaignId/path`)
    absenceKeys.add(key)
  }

  const consoleKeys = new Set()
  for (const [index, entry] of registry.consoleErrors.entries()) {
    const label = `consoleErrors[${index}]`
    validateCampaignId(entry?.campaignId, label)
    validateAssetPath(entry?.path, label)
    requireString(entry?.source, 'source', label)
    requireString(entry?.reason, 'reason', label)
    validateDate(entry?.date, label)
    if (typeof entry?.template !== 'string' || ![...CONSOLE_TEMPLATES.values()].includes(entry.template)) {
      fail(`${label}.template не является одним из трёх точных поддерживаемых шаблонов`)
    }
    if (!Number.isSafeInteger(entry.expectedOccurrences) || entry.expectedOccurrences < 1) {
      fail(`${label}.expectedOccurrences должен быть положительным целым числом`)
    }
    if (!absenceKeys.has(`${entry.campaignId}\0${entry.path}`)) {
      fail(`${label} не связан с путём из knownAbsences`)
    }
    const key = `${entry.campaignId}\0${entry.path}\0${entry.template}`
    if (consoleKeys.has(key)) fail(`${label} дублирует campaignId/path/template`)
    consoleKeys.add(key)
  }
  return registry
}

export function loadObservationRegistry(file = REGISTRY_FILE) {
  let registry
  try {
    registry = JSON.parse(readFileSync(file, 'utf8'))
  } catch (error) {
    throw new Error(`Не удалось прочитать ${file}: ${String(error?.message || error)}`)
  }
  return validateRegistry(registry)
}

function isKnownAbsenceObservation(observation) {
  return observation.status === 'fetch-error'
    || (typeof observation.status === 'number' && observation.status >= 400)
    || !String(observation.contentType || '').toLowerCase().startsWith('image/')
}

export function auditKnownAbsences({ campaignId, declaredPaths, observations, registry, responseMode = 'preview' }) {
  if (!['preview', 'fixtureRoot'].includes(responseMode)) fail(`неизвестный responseMode ${responseMode}`)
  const declared = new Set(declaredPaths.map(normalizeAssetPath))
  const entries = registry.knownAbsences.filter((entry) => entry.campaignId === campaignId)
  const byPath = new Map(entries.map((entry) => [entry.path, entry]))
  const findings = []
  const counts = new Map()

  for (const path of declared) {
    if (!byPath.has(path)) findings.push(`D-076 объявляет ${path}, но в STAB-1.25 registry нет записи`)
  }
  for (const entry of entries) {
    if (!declared.has(entry.path)) findings.push(`STAB-1.25 registry устарел: ${entry.path} отсутствует в декларациях D-076`)
  }

  const audited = observations.map((observation) => {
    const path = normalizeAssetPath(observation.path)
    const entry = byPath.get(path)
    const occurrence = (counts.get(path) || 0) + 1
    counts.set(path, occurrence)
    const absent = isKnownAbsenceObservation(observation)
    const servedAsImage = String(observation.contentType || '').toLowerCase().startsWith('image/')
    const expectedResponse = entry?.expected?.[responseMode]
    const expectedOccurrences = entry?.expected?.occurrences
    const exactResponse = !!entry
      && observation.status === expectedResponse.status
      && String(observation.contentType || '').toLowerCase() === expectedResponse.contentType
      && absent
      && occurrence <= expectedOccurrences
    const registered = declared.has(path) && exactResponse
    if (!registered) {
      const expectedText = expectedResponse ? `${expectedResponse.status} ${expectedResponse.contentType}` : 'нет записи'
      findings.push(`необъяснённое known-absence ${path}: наблюдалось ${observation.status} ${observation.contentType || 'без content-type'}, ожидалось ${expectedText}`)
    }
    return {
      ...observation,
      path,
      knownAbsence: absent,
      servedAsImage,
      classification: registered ? 'allowed' : 'unexplained',
      registrySource: entry?.source || null,
      registryReason: entry?.reason || null,
      registryDate: entry?.date || null,
      expectedStatus: expectedResponse?.status ?? null,
      expectedContentType: expectedResponse?.contentType ?? null,
      responseMode,
      occurrence,
      expectedOccurrences: expectedOccurrences ?? null,
    }
  })

  for (const entry of entries) {
    const observed = counts.get(entry.path) || 0
    if (observed !== entry.expected.occurrences) {
      findings.push(`дрейф known-absence ${entry.path}: ожидалось ${entry.expected.occurrences}, наблюдалось ${observed}`)
    }
  }

  return {
    observations: audited,
    responseMode,
    observedCount: observations.length,
    expectedCount: entries.reduce((sum, entry) => sum + entry.expected.occurrences, 0),
    registeredCount: audited.filter((entry) => entry.classification === 'allowed').length,
    unexplainedCount: audited.filter((entry) => entry.classification !== 'allowed').length,
    registryEntryCount: entries.length,
    driftCount: findings.length,
    findings,
  }
}

/**
 * A response on a declared-absence path is permitted only when it is the exact
 * registered observation: canonical campaign/path, status, content type, and
 * reason. A path-only allowlist would also hide an unrelated 4xx/5xx response.
 */
export function isBlockingCampaignResponseFailure(failure) {
  let pathname
  try {
    pathname = new URL(failure?.url).pathname
  } catch {
    return true
  }
  // Preserve the pre-existing optional-metadata exceptions; all other failures
  // remain blocking unless they match an exact registered known-absence result.
  return !pathname.endsWith('/project.json') && !pathname.endsWith('/encounters/encounters.json')
}

export function isExactRegisteredKnownAbsenceResponse({ campaignId, failure, knownAbsences }) {
  if (typeof campaignId !== 'string' || typeof failure?.path !== 'string' || !failure.path) return false
  const path = normalizeAssetPath(failure.path)
  if (path !== failure.path) return false

  let url
  try {
    url = new URL(failure.url)
  } catch {
    return false
  }
  if (!['http:', 'https:'].includes(url.protocol) || url.search || url.hash) return false
  const prefix = `/campaigns/${campaignId}/`
  if (!url.pathname.startsWith(prefix)) return false

  let urlAssetPath
  try {
    urlAssetPath = decodeURIComponent(url.pathname.slice(prefix.length))
  } catch {
    return false
  }
  if (urlAssetPath !== path || normalizeAssetPath(urlAssetPath) !== urlAssetPath) return false

  const contentType = String(failure.contentType || '').trim().toLowerCase()
  return knownAbsences.some((observation) => observation.classification === 'allowed'
    && observation.path === path
    && observation.status === failure.status
    && observation.expectedStatus === failure.status
    && String(observation.contentType || '').trim().toLowerCase() === contentType
    && observation.expectedContentType === contentType
    && observation.reason === failure.reason
    && observation.occurrence === 1
    && observation.expectedOccurrences === 1)
}

export function splitCampaignResponseFailures({ campaignId, failures, knownAbsences }) {
  const unregistered = failures.filter((failure) => !isExactRegisteredKnownAbsenceResponse({
    campaignId,
    failure,
    knownAbsences,
  }))
  const blocking = [...new Map(unregistered
    .filter(isBlockingCampaignResponseFailure)
    .map((failure) => [failure.url, failure])).values()]
  const nonBlocking = unregistered.filter((failure) => !isBlockingCampaignResponseFailure(failure))
  return { blocking, nonBlocking }
}

function parseConsoleError(message) {
  for (const [prefix, template] of CONSOLE_TEMPLATES) {
    if (!message.startsWith(prefix)) continue
    const rawUrl = message.slice(prefix.length)
    try {
      const url = new URL(rawUrl)
      if (!['http:', 'https:'].includes(url.protocol) || url.search || url.hash) return null
      const match = url.pathname.match(/^\/campaigns\/([^/]+)\/(.+)$/)
      if (!match) return null
      const path = decodeURIComponent(match[2])
      if (normalizeAssetPath(path) !== path) return null
      return { campaignId: match[1], path, template }
    } catch {
      return null
    }
  }
  return null
}

export function auditConsoleErrors({ campaignId, messages, registry }) {
  const entries = registry.consoleErrors.filter((entry) => entry.campaignId === campaignId)
  const byKey = new Map(entries.map((entry) => [`${entry.campaignId}\0${entry.path}\0${entry.template}`, entry]))
  const counts = new Map()
  const findings = []

  const audited = messages.map((message) => {
    const parsed = parseConsoleError(message)
    const key = parsed ? `${parsed.campaignId}\0${parsed.path}\0${parsed.template}` : ''
    const entry = byKey.get(key)
    const occurrence = parsed ? (counts.get(key) || 0) + 1 : null
    if (parsed) counts.set(key, occurrence)
    const registered = parsed?.campaignId === campaignId
      && !!entry
      && occurrence <= entry.expectedOccurrences
    if (!registered) {
      findings.push(`необъяснённый console-error: ${message}`)
    }
    return {
      message,
      campaignId: parsed?.campaignId || campaignId,
      path: parsed?.path || null,
      template: parsed?.template || null,
      classification: registered ? 'allowed' : 'unexplained',
      registrySource: entry?.source || null,
      registryReason: entry?.reason || null,
      registryDate: entry?.date || null,
      occurrence,
      expectedOccurrences: entry?.expectedOccurrences ?? null,
    }
  })

  for (const entry of entries) {
    const key = `${entry.campaignId}\0${entry.path}\0${entry.template}`
    const observed = counts.get(key) || 0
    if (observed !== entry.expectedOccurrences) {
      findings.push(`дрейф console-error ${entry.template} ${entry.path}: ожидалось ${entry.expectedOccurrences}, наблюдалось ${observed}`)
    }
  }

  return {
    observations: audited,
    observedCount: messages.length,
    expectedCount: entries.reduce((sum, entry) => sum + entry.expectedOccurrences, 0),
    registeredCount: audited.filter((entry) => entry.classification === 'allowed').length,
    unexplainedCount: audited.filter((entry) => entry.classification !== 'allowed').length,
    registryEntryCount: entries.length,
    driftCount: findings.length,
    findings,
  }
}
