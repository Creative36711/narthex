import Ajv2020 from 'ajv/dist/2020.js'
import type { AnySchema, ErrorObject, ValidateFunction } from 'ajv'
import { existsSync, readFileSync, statSync } from 'node:fs'
import { resolve } from 'node:path'
import fmvSchemaSource from '../packs/narrative/schema/fmv.schema.json' with { type: 'json' }

interface JsonRecord {
  [key: string]: unknown
}

export interface CampaignFmvAuditResult {
  /** Parsed, safely named FMV documents included in the audit coverage count. */
  documents: Map<string, unknown>
  /** src/poster references from every parsed FMV document, de-duplicated. */
  mediaPaths: string[]
  /** Strict FMV schema and cross-reference errors. */
  errors: string[]
}

const idPattern = /^[a-z][a-z0-9_]*$/
const filePattern = /^[a-z][a-z0-9_-]*\.json$/

const narrativeConditionSchema = {
  oneOf: [
    {
      type: 'object', properties: { type: { const: 'flag' }, flag: { type: 'string', minLength: 1 }, not: { type: 'boolean' } },
      required: ['type', 'flag'], additionalProperties: false,
    },
    {
      type: 'object', properties: { type: { const: 'flag_set' }, flag: { type: 'string', minLength: 1 }, not: { type: 'boolean' } },
      required: ['type', 'flag'], additionalProperties: false,
    },
    {
      type: 'object', properties: { type: { const: 'quest' }, quest: { type: 'string', minLength: 1 }, stage: { type: 'string' }, not: { type: 'boolean' } },
      required: ['type', 'quest'], additionalProperties: false,
    },
    {
      type: 'object', properties: { type: { const: 'has_item' }, item: { type: 'string', minLength: 1 }, not: { type: 'boolean' } },
      required: ['type', 'item'], additionalProperties: false,
    },
    {
      type: 'object', properties: { type: { const: 'item_ge' }, item: { type: 'string', minLength: 1 }, count: { type: 'number', minimum: 0 }, not: { type: 'boolean' } },
      required: ['type', 'item'], additionalProperties: false,
    },
    {
      type: 'object', properties: { type: { const: 'player_enters_location' }, location: { type: 'string', minLength: 1 }, not: { type: 'boolean' } },
      required: ['type', 'location'], additionalProperties: false,
    },
  ],
}

const narrativeEffectSchema = {
  oneOf: [
    {
      type: 'object', properties: { type: { const: 'set_flag' }, flag: { type: 'string', minLength: 1 } },
      required: ['type', 'flag'], additionalProperties: false,
    },
    {
      type: 'object', properties: { type: { const: 'start_quest' }, quest: { type: 'string', minLength: 1 } },
      required: ['type', 'quest'], additionalProperties: false,
    },
    {
      type: 'object', properties: { type: { const: 'add_item' }, item: { type: 'string', minLength: 1 }, qty: { type: 'number' } },
      required: ['type', 'item'], additionalProperties: false,
    },
    {
      type: 'object', properties: { type: { const: 'remove_item' }, item: { type: 'string', minLength: 1 }, qty: { type: 'number' } },
      required: ['type', 'item'], additionalProperties: false,
    },
    {
      type: 'object', properties: { type: { const: 'journal_update' }, quest: { type: 'string', minLength: 1 }, text_key: { type: 'string', minLength: 1 } },
      required: ['type', 'quest', 'text_key'], additionalProperties: false,
    },
  ],
}

const narrativeStepSchema = {
  type: 'object',
  properties: {
    kind: { const: 'effect' },
    effect: narrativeEffectSchema,
  },
  additionalProperties: false,
  anyOf: [
    { required: ['effect'] },
    { not: { required: ['kind'] } },
  ],
}

const narrativeSectionSchema = {
  type: 'object',
  properties: {
    conds: { type: 'array', items: narrativeConditionSchema },
    steps: { type: 'array', items: narrativeStepSchema },
    else_steps: { type: 'array', items: narrativeStepSchema },
  },
  additionalProperties: false,
}

function makeStrictFmvSchema(): AnySchema {
  const schema = JSON.parse(JSON.stringify(fmvSchemaSource)) as JsonRecord
  const defs = schema.$defs as JsonRecord
  const choice = defs.choice as JsonRecord
  const properties = choice.properties as JsonRecord
  // The pack schema's choice.additionalProperties=true is intentional for its
  // broader narrative editor; the campaign audit narrows it to the fields the
  // FMV runtime actually consumes, with the known condition/effect shapes.
  choice.additionalProperties = false
  properties.conds = { type: 'array', items: narrativeConditionSchema }
  properties.sections = { type: 'array', items: narrativeSectionSchema }
  return schema as AnySchema
}

const ajv = new Ajv2020({ allErrors: true, strict: false })
const validateFmvDocument: ValidateFunction = ajv.compile(makeStrictFmvSchema())

function isRecord(value: unknown): value is JsonRecord {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function schemaErrors(label: string): string[] {
  return (validateFmvDocument.errors ?? []).map((error: ErrorObject) => {
    const at = error.instancePath || '/'
    return `Схема FMV ${label}${at}: ${error.message ?? 'значение недопустимо'}`
  })
}

function safeManifestFiles(manifest: unknown, errors: string[]): string[] {
  if (!isRecord(manifest) || !Object.hasOwn(manifest, 'fmv')) return []
  const files = manifest.fmv
  if (!Array.isArray(files)) {
    errors.push('Схема manifest.json/fmv: должно быть массивом имён FMV-документов')
    return []
  }

  const safe: string[] = []
  const seen = new Set<string>()
  files.forEach((file, index) => {
    if (typeof file !== 'string' || !filePattern.test(file)) {
      errors.push(`Схема manifest.json/fmv/${index}: ожидается безопасное имя файла вида fmv_name.json`)
      return
    }
    if (seen.has(file)) {
      errors.push(`FMV manifest.json/fmv: файл «${file}» перечислен повторно`)
      return
    }
    seen.add(file)
    safe.push(file)
  })
  return safe
}

function addDocumentSemantics(label: string, document: JsonRecord, errors: string[]): boolean {
  if (!validateFmvDocument(document)) {
    errors.push(...schemaErrors(label))
    return false
  }

  const start = document.start as string
  const fragments = document.fragments as JsonRecord[]
  const fragmentIds = new Set<string>()
  for (const fragment of fragments) {
    const fragmentId = fragment.id as string
    if (fragmentIds.has(fragmentId)) errors.push(`FMV ${label}: повторный id фрагмента «${fragmentId}»`)
    fragmentIds.add(fragmentId)
  }
  if (!fragmentIds.has(start)) errors.push(`FMV ${label}: стартовый фрагмент «${start}» не найден`)

  for (const fragment of fragments) {
    const fragmentId = fragment.id as string
    const duration = fragment.duration_ms as number
    const subtitles = fragment.subtitles as JsonRecord[]
    for (const [index, subtitle] of subtitles.entries()) {
      const from = subtitle.start_ms as number
      const to = subtitle.end_ms as number
      if (from >= to || to > duration) {
        errors.push(`FMV ${label}/fragments/${fragmentId}/subtitles/${index}: интервал должен удовлетворять 0 ≤ start_ms < end_ms ≤ duration_ms (${duration})`)
      }
    }

    const choices = (fragment.choices ?? []) as JsonRecord[]
    const choiceIds = new Set<string>()
    for (const [index, choice] of choices.entries()) {
      const choiceId = choice.id as string
      const next = choice.next as string
      if (choiceIds.has(choiceId)) errors.push(`FMV ${label}/fragments/${fragmentId}: повторный id выбора «${choiceId}»`)
      choiceIds.add(choiceId)
      if (!fragmentIds.has(next)) {
        errors.push(`FMV ${label}/fragments/${fragmentId}/choices/${index}: следующий фрагмент «${next}» не найден`)
      }
    }
  }
  return true
}

/**
 * Validate the NAR-3.2 FMV extension without changing the legacy campaign
 * schema. Safely named files are also returned so the ordinary media audit
 * checks clip and poster references for existence.
 */
export function auditCampaignFmv(
  campaignRoot: string,
  manifest: unknown,
  jsonFiles: ReadonlyMap<string, unknown>,
): CampaignFmvAuditResult {
  const errors: string[] = []
  const documents = new Map<string, unknown>()
  const mediaPaths = new Set<string>()
  const files = safeManifestFiles(manifest, errors)
  const loaded: Array<{ path: string; value: unknown }> = []

  for (const file of files) {
    const relative = `fmv/${file}`
    const absolute = resolve(campaignRoot, 'fmv', file)
    if (!absolute.startsWith(`${resolve(campaignRoot)}/`) || !existsSync(absolute) || !statSync(absolute).isFile()) {
      errors.push(`FMV ${relative}: документ не найден`)
      continue
    }
    try {
      const value: unknown = JSON.parse(readFileSync(absolute, 'utf8'))
      documents.set(relative, value)
      loaded.push({ path: relative, value })
      if (isRecord(value) && Array.isArray(value.fragments)) {
        for (const fragment of value.fragments) {
          if (!isRecord(fragment)) continue
          for (const key of ['src', 'poster'] as const) {
            if (typeof fragment[key] === 'string') mediaPaths.add(fragment[key] as string)
          }
        }
      }
    } catch (error) {
      errors.push(`FMV ${relative}: JSON не читается (${String(error)})`)
    }
  }

  const documentsById = new Map<string, string>()
  for (const entry of loaded) {
    if (!isRecord(entry.value)) {
      errors.push(`Схема FMV ${entry.path}/: должно быть объектом`)
      continue
    }
    const valid = addDocumentSemantics(entry.path, entry.value, errors)
    if (!valid) continue
    const id = entry.value.id as string
    const previous = documentsById.get(id)
    if (previous) {
      errors.push(`FMV: id документа «${id}» повторяется в ${previous} и ${entry.path}`)
    } else {
      documentsById.set(id, entry.path)
    }
  }

  for (const [path, value] of jsonFiles) {
    if (!path.startsWith('scenes/') || !isRecord(value) || !Object.hasOwn(value, 'fmv')) continue
    const id = value.fmv
    if (typeof id !== 'string' || !idPattern.test(id)) {
      errors.push(`Схема ${path}/fmv: ожидается id FMV вида fmv_scene`)
      continue
    }
    if (!documentsById.has(id)) {
      errors.push(`FMV ${path}/fmv: документ «${id}» не найден среди manifest.json/fmv`)
    }
  }

  return { documents, mediaPaths: [...mediaPaths].sort(), errors }
}

/** Make a shallow, read-only-audit view that the existing schema can consume. */
export function withoutFmvExtension<T extends { manifest: unknown; jsonFiles: Map<string, unknown> }>(store: T): T {
  const view = Object.assign(Object.create(Object.getPrototypeOf(store)) as T, store)
  const manifest = isRecord(store.manifest) ? { ...store.manifest } : store.manifest
  if (isRecord(manifest)) delete manifest.fmv
  view.manifest = manifest
  view.jsonFiles = new Map(store.jsonFiles)
  for (const [path, value] of view.jsonFiles) {
    if (!path.startsWith('scenes/') || !isRecord(value) || !Object.hasOwn(value, 'fmv')) continue
    const scene = { ...value }
    delete scene.fmv
    view.jsonFiles.set(path, scene)
  }
  return view
}
