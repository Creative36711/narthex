import { projectCapabilityMode } from '../core/pack/capability-modes'
import type { ManifestDef } from './storeTypes'
import { EditorStoreContent } from './storeContent'

/** Mutation/undo operations for the editor's in-memory package. */
export abstract class EditorStoreChanges extends EditorStoreContent {
  protected abstract persistBaseline(): void



  // ─────────────── правки ───────────────

  touch(path: string, group = ''): void {
    if (path.startsWith('quests/') && projectCapabilityMode(this.project, 'quests') === 'off') {
      const previous = this.snapshots.get(path)
      if (previous !== undefined) this.jsonFiles.set(path, JSON.parse(previous))
      this.notify()
      return
    }
    const now = Date.now()
    const prev = this.snapshots.get(path)
    // группируем только СЕРИИ ОДНОТИПНЫХ правок, явно помеченных группой
    // (например набор текста); структурные изменения (добавил слот, удалил
    // правило…) всегда дают отдельный шаг отката — без группировки
    const sameBurst = group !== '' && this.lastTouch.path === path && this.lastTouch.group === group && now - this.lastTouch.at < 900
    if (prev !== undefined && !sameBurst) {
      this.undoStack.push({ path, text: prev })
      if (this.undoStack.length > 100) this.undoStack.shift()
    }
    this.lastTouch = { path, group, at: now }
    this.snapshots.set(path, this.fileText(path))
    if (this.saved.get(path) === this.fileText(path)) this.dirty.delete(path)
    else this.dirty.add(path)
    this.notify()
  }


  canUndo(): boolean {
    return this.undoStack.length > 0
  }


  /** откат последнего изменения */
  undo(): string | null {
    const step = this.undoStack.pop()
    if (!step) return null
    const { path, text } = step
    if (path === 'campaign.json') this.meta = JSON.parse(text)
    else if (path === 'project.json') {
      this.project = JSON.parse(text)
      this.projectFileExists = true
      this.capabilityModes = this.resolveModes?.(this.project) ?? null
    }
    else if (path === 'world.json') this.world = JSON.parse(text)
    else if (path === 'manifest.json') this.manifest = JSON.parse(text)
    else if (this.textFiles.has(path)) this.textFiles.set(path, text)
    else this.jsonFiles.set(path, JSON.parse(text))
    this.snapshots.set(path, text)
    // если откат вернул файл к состоянию на диске — он больше не «несохранён»
    if (this.saved.get(path) === text) this.dirty.delete(path)
    else this.dirty.add(path)
    this.lastTouch = { path: '', group: '', at: 0 }
    this.notify()
    return path
  }


  /** создать новый файл и внести в манифест */
  createFile(section: keyof ManifestDef, filename: string, data: unknown | string): string {
    if (section === 'quests' && projectCapabilityMode(this.project, 'quests') === 'off') return ''
    const dir = section
    const path = `${dir}/${filename}`
    const list = (this.manifest[section] ?? (this.manifest[section] = [] as string[])) as string[]
    if (!list.includes(filename)) list.push(filename)
    if (typeof data === 'string') this.textFiles.set(path, data)
    else this.jsonFiles.set(path, data)
    this.dirty.add(path)
    this.dirty.add('manifest.json')
    this.notify()
    return path
  }


  deleteFile(section: keyof ManifestDef, filename: string): void {
    if (section === 'quests' && projectCapabilityMode(this.project, 'quests') === 'off') return
    const dir = section
    const path = `${dir}/${filename}`
    const list = (this.manifest[section] ?? []) as string[]
    const i = list.indexOf(filename)
    if (i >= 0) list.splice(i, 1)
    this.jsonFiles.delete(path)
    if (section === 'encounters') this.jsonFiles.delete(`encounters/${filename}`)
    this.textFiles.delete(path)
    this.dirty.delete(path)
    if (section === 'encounters') this.dirty.delete(`encounters/${filename}`)
    this.dirty.add('manifest.json')
    this.notify()
  }


  // ─────────────── сохранение ───────────────

  fileText(path: string): string {
    if (path === 'project.json') {
      if (this.projectOriginal && this.projectOriginalText !== null && JSON.stringify(this.project) === JSON.stringify(this.projectOriginal)) {
        return this.projectOriginalText
      }
      return JSON.stringify(this.project, null, 2)
    }
    if (path === 'campaign.json') return JSON.stringify(this.meta, null, 2)
    if (path === 'world.json') return JSON.stringify(this.world, null, 2)
    if (path === 'manifest.json') return JSON.stringify(this.manifest, null, 2)
    if (this.textFiles.has(path)) return this.textFiles.get(path)!
    return JSON.stringify(this.jsonFiles.get(path), null, 2)
  }


  hasFile(path: string): boolean {
    return (
      (path === 'project.json' && this.projectFileExists) ||
      path === 'campaign.json' ||
      path === 'world.json' ||
      path === 'manifest.json' ||
      this.jsonFiles.has(path) ||
      this.textFiles.has(path)
    )
  }


  /** Зафиксировать текущее состояние кампании как исходную базу для диффа изменений */
  captureBaseline(): void {
    this.baseline.clear()
    for (const p of this.allPaths()) {
      this.baseline.set(p, this.fileText(p))
    }
    this.persistBaseline()
    // список правок и счётчик в шапке редактора пересчитываются сразу,
    // а не при следующем открытии мастера ИИ
    this.notify()
  }


  /**
   * Принять один файл в базовый снимок: убрать его из списка ручных правок,
   * не сбрасывая отслеживание остальных (нужна мастеру ИИ кнопка «убрать
   * правку» рядом с каждой строкой). Удалённым файлам снимок попросту не нужен.
   */
  acceptChangeAsBaseline(path: string): void {
    if (this.hasFile(path)) this.baseline.set(path, this.fileText(path))
    else this.baseline.delete(path)
    this.persistBaseline()
    this.notify()
  }
}
