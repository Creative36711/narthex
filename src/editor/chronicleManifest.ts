import type JSZip from 'jszip'
import type { CampaignManifest, CampaignMeta, DlgDoc, MonolithDoc, WorldDef } from '../shared/types'
import { generateInk, migrateDlgDoc } from './dialogueDoc'
import { refsFromMonolith } from './dlgScript'

/**
 * Реестры кампании из уже прочитанных файлов архива: нужны, чтобы разобрать
 * разговор, написанный текстом (поле `script`), когда структуры в документе нет.
 * ИИ-агент вправе отдать разговор словами — тогда `.dlg.json` приходит без узлов.
 */
function refsFromFiles(jsonFiles: Map<string, unknown>) {
  const take = <T,>(folder: string): Record<string, T> => {
    const out: Record<string, T> = {}
    for (const [path, val] of jsonFiles) {
      if (!path.startsWith(`${folder}/`) || !path.endsWith('.json')) continue
      const id = (val as { id?: string } | null)?.id
      if (id) out[id] = val as T
    }
    return out
  }
  const shell = {
    campaign: (jsonFiles.get('campaign.json') ?? {}) as CampaignMeta,
    world: (jsonFiles.get('world.json') ?? {}) as WorldDef,
    scenes: {}, entities: take('entities'), rules: take('rules'), quests: take('quests'),
    arenas: {}, cutscenes: take('cutscenes'), recipes: take('recipes'), codex: take('codex'),
    dialogues: {},
  } as MonolithDoc
  return refsFromMonolith(shell)
}

/**
 * Campaign Package manifests list filenames relative to their module folder.
 * Some generators mistakenly repeat that folder (for example
 * `entities/item.json` in `manifest.entities`), which otherwise becomes
 * `entities/entities/item.json` in the editor. Canonicalize these references
 * against the archive's actual files and keep dialogue builder sidecars usable.
 */
export function normalizeChronicleManifest(
  rawManifest: CampaignManifest,
  jsonFiles: Map<string, unknown>,
  textFiles: Map<string, string>,
): { manifest: CampaignManifest; changed: boolean; notes: string[] } {
  const manifest = { ...rawManifest } as CampaignManifest
  const notes: string[] = []
  let changed = false
  const modules: Array<{ key: keyof CampaignManifest; folder: string }> = [
    { key: 'scenes', folder: 'scenes' },
    { key: 'entities', folder: 'entities' },
    { key: 'rules', folder: 'rules' },
    { key: 'arenas', folder: 'arenas' },
    { key: 'quests', folder: 'quests' },
    { key: 'encounters', folder: 'rules' },
    { key: 'cutscenes', folder: 'cutscenes' },
    { key: 'recipes', folder: 'recipes' },
    { key: 'codex', folder: 'codex' },
    { key: 'dialogues', folder: 'dialogues' },
  ]

  for (const { key, folder } of modules) {
    const entries = manifest[key]
    if (!Array.isArray(entries)) continue
    const normalized: string[] = []
    for (const value of entries) {
      if (typeof value !== 'string' || !value.trim()) continue
      const original = value.replaceAll('\\', '/').replace(/^\.\//, '')
      let name = original.replace(/^\/+/, '')
      while (name.startsWith(`${folder}/`)) name = name.slice(folder.length + 1)
      const dialogueSidecarListed = key === 'dialogues' && name.endsWith('.dlg.json')
      const sidecarPath = dialogueSidecarListed
        ? `${folder}/${name}`
        : `${folder}/${name.replace(/\.ink$/, '.dlg.json')}`
      if (dialogueSidecarListed) name = `${name.slice(0, -'.dlg.json'.length)}.ink`
      const canonicalPath = `${folder}/${name}`

      // Relocate oddly nested module paths in memory so subsequent editor paths
      // and saves use the format documented by Campaign Package. A listed
      // dialogue .dlg.json is a structured sidecar, never the .ink source itself.
      const rawPath = `${folder}/${original.replace(/^\/+/, '')}`
      const targetPath = dialogueSidecarListed ? sidecarPath : canonicalPath
      const altFolder = key === 'encounters' ? 'encounters' : undefined
      const candidates = [...new Set([
        targetPath,
        rawPath,
        ...(altFolder ? [`${altFolder}/${name}`, `${altFolder}/${original.replace(/^\/+/, '')}`] : []),
        original,
      ])]
      const source = candidates.find((path) => jsonFiles.has(path) || textFiles.has(path))
      if (source && source !== targetPath) {
        if (jsonFiles.has(source)) {
          jsonFiles.set(targetPath, jsonFiles.get(source))
          jsonFiles.delete(source)
        }
        if (textFiles.has(source)) {
          textFiles.set(targetPath, textFiles.get(source)!)
          textFiles.delete(source)
        }
      }

      if (key === 'dialogues' && !textFiles.has(canonicalPath)) {
        const doc = jsonFiles.get(sidecarPath) as DlgDoc | undefined
        if (doc) {
          try {
            // разговор, написанный текстом: собираем структуру, затем ink
            textFiles.set(canonicalPath, generateInk(migrateDlgDoc(doc, refsFromFiles(jsonFiles))))
          } catch {
            // Keep the structured sidecar intact; the editor's guarded dialogue
            // host can still expose it for repair without crashing the campaign.
          }
        }
      }
      normalized.push(name)
      if (name !== value) {
        changed = true
        notes.push(`manifest.${String(key)}: «${value}» нормализовано до «${name}».`)
      }
    }
    ;(manifest as unknown as Record<string, unknown>)[key] = [...new Set(normalized)]
  }
  return { manifest, changed, notes }
}


/** Normalize module names inside an archive before a standalone install writes it. */
export async function normalizeChronicleZip(zip: JSZip): Promise<string[]> {
  const manifestFile = zip.files['manifest.json']
  if (!manifestFile || manifestFile.dir) return []
  const manifest = JSON.parse(await manifestFile.async('text')) as CampaignManifest
  const jsonFiles = new Map<string, unknown>()
  const textFiles = new Map<string, string>()
  const originalJsonPaths = new Set<string>()
  const originalTextPaths = new Set<string>()
  for (const [path, file] of Object.entries(zip.files)) {
    if (file.dir || path === 'campaign.json' || path === 'world.json' || path === 'manifest.json') continue
    if (path.endsWith('.ink')) {
      textFiles.set(path, await file.async('text'))
      originalTextPaths.add(path)
    } else if (path.endsWith('.json')) {
      try {
        jsonFiles.set(path, JSON.parse(await file.async('text')))
        originalJsonPaths.add(path)
      } catch {
        // Keep unrelated or malformed JSON untouched; the normal package loader
        // will report it when that specific module is opened.
      }
    }
  }

  const normalized = normalizeChronicleManifest(manifest, jsonFiles, textFiles)
  for (const path of originalJsonPaths) if (!jsonFiles.has(path)) zip.remove(path)
  for (const [path, value] of jsonFiles) {
    if (!originalJsonPaths.has(path)) zip.file(path, JSON.stringify(value, null, 2))
  }
  for (const path of originalTextPaths) if (!textFiles.has(path)) zip.remove(path)
  for (const [path, value] of textFiles) {
    if (!originalTextPaths.has(path)) zip.file(path, value)
  }
  if (normalized.changed) zip.file('manifest.json', JSON.stringify(normalized.manifest, null, 2))
  return normalized.notes
}
