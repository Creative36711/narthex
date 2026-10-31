import { aiDiffSnapshotKey } from '../shared/aiBaseline'
import type { ArenaDef, CodexEntryDef, CutsceneDef, QuestDef, RecipeDef, SceneDef } from '../shared/types'
import type { ModifiedFileEntry } from './storeTypes'
import { EditorStoreChanges } from './storeChanges'

/** Persistence baseline and change-diff operations. */
export abstract class EditorStoreDiff extends EditorStoreChanges {


  /** ключ localStorage, по которому лежит снимок базы правок мастера для этой кампании */
  protected get aiBaselineKey(): string {
    return aiDiffSnapshotKey(this.basePath)
  }


  /**
   * Сохранить базу правок мастера между сессиями. Снимок живёт в localStorage,
   * поэтому отслеживание изменений продолжается после закрытия редактора и самой
   * игры. Если кампания слишком велика для localStorage, слежение остаётся только
   * в рамках текущей сессии (поведение по умолчанию).
   */
  protected persistBaseline(): void {
    try {
      const payload = JSON.stringify({
        v: EditorStoreDiff.AI_BASELINE_VERSION,
        campaign: this.meta?.id ?? '',
        capturedAt: Date.now(),
        files: Object.fromEntries(this.baseline),
      })
      if (payload.length > EditorStoreDiff.AI_BASELINE_LIMIT) {
        // не влезаем в квоту — сносим возможный устаревший снимок, чтобы при
        // следующем запуске не воскресить базу от более раннего состояния
        localStorage.removeItem(this.aiBaselineKey)
        console.warn('[ai-diff] снимок базы правок слишком велик для localStorage; отслеживание не переживёт перезапуск')
        return
      }
      localStorage.setItem(this.aiBaselineKey, payload)
    } catch {
      // localStorage недоступен (приватный режим, эмулятор) — дифф проживёт только эту сессию
    }
  }


  /**
   * Восстановить сохранённую базу правок мастера. Возвращает true, если снимок
   * найден и принят; иначе false — вызывающий код фиксирует новую точку отсчёта.
   * Чужой кампании снимок не достанется: он кешируется по basePath и сверяется
   * с id кампании из campaign.json.
   */
  protected restoreBaseline(): boolean {
    try {
      const raw = localStorage.getItem(this.aiBaselineKey)
      if (!raw) return false
      const data = JSON.parse(raw) as { v?: unknown; campaign?: unknown; files?: unknown }
      if (data.v !== EditorStoreDiff.AI_BASELINE_VERSION) return false
      if (typeof data.files !== 'object' || data.files === null) return false
      if (typeof data.campaign === 'string' && data.campaign && this.meta?.id && data.campaign !== this.meta.id) return false
      const files = data.files as Record<string, unknown>
      this.baseline.clear()
      for (const [p, text] of Object.entries(files)) {
        if (typeof p === 'string' && p && typeof text === 'string') this.baseline.set(p, text)
      }
      return this.baseline.size > 0
    } catch {
      return false
    }
  }


  /** Имеются ли зафиксированные данные базового снимка */
  hasBaseline(): boolean {
    return this.baseline.size > 0
  }


  /**
   * Список файлов, которые реально изменились относительно исходного состояния
   * (добавленные, изменённые или удалённые файлы).
   */
  /** каноничная строка JSON для сравнения: ключи по алфавиту рекурсивно.
   *  Защита от ложного «изменилось»: перестановка ключей или перевод
   *  сериализации (отступы/переносы) не считается правкой мастера (фидбек:
   *  «просто просмотрел диалог — ИИ-мастер записал как изменение»). */
  protected static canonJson(o: unknown): string {
    if (Array.isArray(o)) return `[${o.map((x) => EditorStoreDiff.canonJson(x)).join(',')}]`
    if (o && typeof o === 'object') {
      return `{${Object.keys(o as Record<string, unknown>)
        .sort()
        .map((k) => `${JSON.stringify(k)}:${EditorStoreDiff.canonJson((o as Record<string, unknown>)[k])}`)
        .join(',')}}`
    }
    return JSON.stringify(o)
  }


  protected textsEqualForDiff(path: string, a: string, b: string): boolean {
    if (a === b) return true
    if (!path.endsWith('.json')) return false
    try {
      return EditorStoreDiff.canonJson(JSON.parse(a)) === EditorStoreDiff.canonJson(JSON.parse(b))
    } catch {
      return false
    }
  }


  getModifiedFiles(): ModifiedFileEntry[] {
    const list: ModifiedFileEntry[] = []
    const currentPaths = new Set(this.allPaths())

    // 1. Проверяем текущие файлы на добавление и изменение
    for (const p of currentPaths) {
      const currentText = this.fileText(p)
      const baseText = this.baseline.get(p)

      if (baseText === undefined) {
        list.push({
          path: p,
          status: 'added',
          category: this.categorizePath(p),
          title: this.titleForPath(p),
        })
      } else if (!this.textsEqualForDiff(p, baseText, currentText)) {
        list.push({
          path: p,
          status: 'modified',
          category: this.categorizePath(p),
          title: this.titleForPath(p),
          diffSummary: this.buildDiffSummary(p, baseText, currentText),
        })
      }
    }

    // 2. Проверяем удалённые файлы (были в baseline, но удалены сейчас)
    for (const [p] of this.baseline) {
      if (!currentPaths.has(p)) {
        list.push({
          path: p,
          status: 'deleted',
          category: this.categorizePath(p),
          title: this.titleForPath(p),
        })
      }
    }

    return list.sort((a, b) => a.path.localeCompare(b.path, 'ru'))
  }


  protected categorizePath(path: string): ModifiedFileEntry['category'] {
    if (path === 'project.json' || path === 'campaign.json') return 'meta'
    if (path === 'world.json') return 'world'
    if (path.startsWith('scenes/')) return 'scene'
    if (path.startsWith('dialogues/')) return 'dialogue'
    if (path.startsWith('entities/')) return 'entity'
    if (path.startsWith('quests/')) return 'quest'
    if (path.startsWith('rules/')) return 'rule'
    if (path.startsWith('recipes/')) return 'recipe'
    if (path.startsWith('arenas/')) return 'arena'
    if (path.startsWith('cutscenes/')) return 'cutscene'
    if (path.startsWith('codex/')) return 'codex'
    return 'other'
  }


  protected titleForPath(path: string): string {
    if (path === 'project.json') return 'Режимы возможностей проекта'
    if (path === 'campaign.json') return `Паспорт кампании «${this.meta.title || this.meta.id}»`
    if (path === 'world.json') return 'Карта мира и локации'
    if (path === 'manifest.json') return 'Манифест структуры'

    if (path.startsWith('scenes/')) {
      const doc = this.jsonFiles.get(path) as SceneDef | undefined
      return doc?.label ? `Сцена: ${doc.label}` : path
    }
    if (path.startsWith('entities/')) {
      const doc = this.jsonFiles.get(path) as any
      const kind = doc?.type === 'npc' ? 'Персонаж' : 'Предмет'
      return doc?.label ? `${kind}: ${doc.label}` : path
    }
    if (path.startsWith('dialogues/')) {
      const clean = path.replace(/^dialogues\//, '').replace(/\.(ink|dlg\.json)$/, '')
      return `Диалог: ${clean}`
    }
    if (path.startsWith('quests/')) {
      const doc = this.jsonFiles.get(path) as QuestDef | undefined
      return doc?.label ? `Квест: ${doc.label}` : path
    }
    if (path.startsWith('recipes/')) {
      const doc = this.jsonFiles.get(path) as RecipeDef | undefined
      return doc?.label ? `Рецепт: ${doc.label}` : path
    }
    if (path.startsWith('rules/')) {
      const doc = this.jsonFiles.get(path) as any
      return doc?.label || doc?.id ? `Правило: ${doc.label || doc.id}` : path
    }
    if (path.startsWith('cutscenes/')) {
      const doc = this.jsonFiles.get(path) as CutsceneDef | undefined
      return doc?.label ? `Катсцена: ${doc.label}` : path
    }
    if (path.startsWith('arenas/')) {
      const doc = this.jsonFiles.get(path) as ArenaDef | undefined
      return doc?.label ? `Арена: ${doc.label}` : path
    }
    if (path.startsWith('codex/')) {
      const doc = this.jsonFiles.get(path) as CodexEntryDef | undefined
      return doc?.label ? `Кодекс: ${doc.label}` : path
    }
    return path
  }


  protected buildDiffSummary(path: string, baseText: string, currentText: string): string | undefined {
    if (path.endsWith('.json')) {
      try {
        const baseObj = JSON.parse(baseText)
        const curObj = JSON.parse(currentText)
        if (typeof baseObj === 'object' && baseObj && typeof curObj === 'object' && curObj) {
          const changedKeys: string[] = []
          const allKeys = new Set([...Object.keys(baseObj), ...Object.keys(curObj)])
          for (const k of allKeys) {
            if (JSON.stringify(baseObj[k]) !== JSON.stringify(curObj[k])) {
              changedKeys.push(k)
            }
          }
          if (changedKeys.length > 0 && changedKeys.length <= 4) {
            return `изменены поля: ${changedKeys.join(', ')}`
          } else if (changedKeys.length > 4) {
            return `изменено ${changedKeys.length} полей (${changedKeys.slice(0, 3).join(', ')}…)`
          }
        }
      } catch {
        // игнорируем ошибку парсинга
      }
    }
    return undefined
  }


  /**
   * Сформировать понятную сводку изменений для чата с ИИ
   */
  getChangesSummaryText(): string {
    const mods = this.getModifiedFiles()
    if (mods.length === 0) {
      return `Кампания «${this.meta.title}» (${this.meta.id}): нет изменений относительно исходного состояния.`
    }

    const lines: string[] = [
      `### Изменения мастера в кампании «${this.meta.title}» (${this.meta.id}):`,
      `Всего затронуто файлов: ${mods.length}`,
      '',
    ]

    for (let i = 0; i < mods.length; i++) {
      const m = mods[i]
      const statusLabel = m.status === 'added' ? 'Новый' : m.status === 'deleted' ? 'Удалён' : 'Изменён'
      const detail = m.diffSummary ? ` — ${m.diffSummary}` : ''
      lines.push(`${i + 1}. [${statusLabel}] ${m.title} (\`${m.path}\`)${detail}`)
    }

    lines.push('')
    lines.push('Примени эти изменения поверх своей версии проекта кампании и продолжай разработку с их учётом.')

    return lines.join('\n')
  }
}
