import Ajv2020 from 'ajv/dist/2020.js'
import campaignSchemaJson from '../../docs/campaign.schema.json' with { type: 'json' }
import type { ErrorObject, ValidateFunction } from 'ajv'
import type { EditorStore } from './store'

const schema = campaignSchemaJson as typeof campaignSchemaJson & { $id: string }
const ajv = new Ajv2020({ allErrors: true, strict: false })
ajv.addSchema(schema)
const schemaValidators = new Map<string, ValidateFunction>()

function validateSchema(typeName: string, value: unknown, label: string): string[] {
  let validator = schemaValidators.get(typeName)
  if (!validator) {
    validator = ajv.compile({ $ref: `${schema.$id}#/$defs/${typeName}` })
    schemaValidators.set(typeName, validator)
  }
  if (validator(value)) return []
  return (validator.errors ?? []).map((error: ErrorObject) => {
    const at = error.instancePath || '/'
    return `Схема ${label}${at}: ${error.message ?? 'значение недопустимо'}`
  })
}

export function validatePackageSchema(store: EditorStore): string[] {
  const issues = [
    ...validateSchema('CampaignMeta', store.meta, 'campaign.json'),
    ...validateSchema('WorldDef', store.world, 'world.json'),
    ...validateSchema('CampaignManifest', store.manifest, 'manifest.json'),
  ]
  const buckets: Array<[string[], string, string]> = [
    [store.manifest.scenes, 'scenes', 'SceneDef'],
    [store.manifest.entities, 'entities', 'EntityDef'],
    [store.manifest.rules, 'rules', 'RuleDef'],
    [store.manifest.arenas ?? [], 'arenas', 'ArenaDef'],
    [store.manifest.quests ?? [], 'quests', 'QuestDef'],
    [store.manifest.cutscenes ?? [], 'cutscenes', 'CutsceneDef'],
    [store.manifest.recipes ?? [], 'recipes', 'RecipeDef'],
    [store.manifest.codex ?? [], 'codex', 'CodexEntryDef'],
  ]
  for (const [files, folder, typeName] of buckets) {
    for (const filename of files) {
      const path = `${folder}/${filename}`
      issues.push(...validateSchema(typeName, store.jsonFiles.get(path), path))
    }
  }
  for (const filename of store.manifest.encounters ?? []) {
    const raw = store.jsonFiles.get(`encounters/${filename}`) ?? store.jsonFiles.get(`rules/${filename}`)
    const path = store.jsonFiles.has(`encounters/${filename}`) ? `encounters/${filename}` : `rules/${filename}`
    issues.push(...validateSchema('EncounterFileDef', raw, path))
  }
  for (const filename of store.manifest.dialogues ?? []) {
    const path = `dialogues/${filename.replace(/\\.ink$/, '.dlg.json')}`
    const doc = store.jsonFiles.get(path)
    if (doc) issues.push(...validateSchema('DlgDoc', doc, path))
  }
  return issues
}
