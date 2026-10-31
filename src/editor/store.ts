import type { ProjectPackInput } from '../core/pack/registry'
import type { CampaignMeta, WorldDef } from '../shared/types'
import { EditorStoreDiff } from './storeDiff'
export { FIRE_RULE_MAX_DEPTH } from './storeShared'
export type { EditorSection, ManifestDef, ModifiedFileEntry } from './storeTypes'

/** Public editor package store; implementation is split into domain bases. */
export class EditorStore extends EditorStoreDiff {

  setJson(path: string, data: unknown): void {
    if (path === 'project.json') {
      this.project = data as ProjectPackInput
      this.projectFileExists = true
      this.capabilityModes = this.resolveModes?.(this.project) ?? null
    } else {
      this.jsonFiles.set(path, data)
    }
    this.touch(path)
  }


  setText(path: string, text: string): void {
    this.textFiles.set(path, text)
    this.touch(path)
  }


  setMeta(meta: CampaignMeta): void {
    this.meta = meta
    this.touch('campaign.json')
  }


  setWorld(world: WorldDef): void {
    this.world = world
    this.touch('world.json')
  }





  allPaths(): string[] {
    return [
      ...(this.projectFileExists ? ['project.json'] : []),
      'campaign.json',
      'world.json',
      'manifest.json',
      ...this.jsonFiles.keys(),
      ...this.textFiles.keys(),
    ]
  }


  /** Сменить каталог назначения (используется при импорте новой кампании). */
  setBasePath(basePath: string): void {
    this.basePath = basePath
  }


  /** Задать id новой кампании и пометить метаданные для сохранения. */
  setCampaignId(id: string): void {
    this.meta.id = id
    this.dirty.add('campaign.json')
    this.notify()
  }


  /** "campaigns/<id>" — относительный путь пакета внутри public/ */
  campaignRel(): string {
    const path = this.basePath.startsWith('http') ? new URL(this.basePath).pathname : this.basePath
    return path.replace(/^\//, '')
  }


  /** URL dev-эндпоинта сохранения (работает и в браузере, и в node-тестах) */
  saveEndpoint(): string {
    return this.basePath.startsWith('http')
      ? new URL('/__editor/save', this.basePath).toString()
      : '/__editor/save'
  }


  /** сохранить на диск через dev-эндпоинт vite */
  async saveToDisk(paths?: string[]): Promise<void> {
    const targets = paths ?? [...this.dirty]
    const campaignRel = this.campaignRel()
    for (const p of targets) {
      const res = await fetch(this.saveEndpoint(), {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ path: `${campaignRel}/${p}`, text: this.fileText(p) }),
      })
      if (!res.ok) throw new Error(`Сохранение ${p}: ${res.status} ${await res.text()}`)
      this.saved.set(p, this.fileText(p))
      this.dirty.delete(p)
    }
    this.notify()
  }
}
