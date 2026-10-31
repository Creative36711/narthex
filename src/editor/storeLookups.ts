import { DEFAULT_EMOTION, type ArenaDef, type CodexEntryDef, type CutsceneDef, type EntityDef, type NpcDef, type QuestDef, type RecipeDef, type RuleDef, type SceneDef } from '../shared/types'
import { skillLabel } from '../shared/skills'
import { walkEffects } from './storeShared'
import { EditorStoreBase } from './storeBase'

/** Read-only lookup and validation helpers for editor content. */
export abstract class EditorStoreLookups extends EditorStoreBase {


  // ─────────────── доступ с типами ───────────────

  scenePaths(): string[] {
    return this.manifest.scenes.map((f) => `scenes/${f}`)
  }

  entityPaths(): string[] {
    return this.manifest.entities.map((f) => `entities/${f}`)
  }

  rulePaths(): string[] {
    return this.manifest.rules.map((f) => `rules/${f}`)
  }

  arenaPaths(): string[] {
    return (this.manifest.arenas ?? []).map((f) => `arenas/${f}`)
  }

  questPaths(): string[] {
    return (this.manifest.quests ?? []).map((f) => `quests/${f}`)
  }

  /**
   * Персонаж, который ведёт этот диалог (ссылка `dialogue` в сущности NPC).
   * Нужен, чтобы в списках вместо имени файла стояло человеческое имя.
   */
  npcForDialogue(inkPath: string): NpcDef | undefined {
    for (const p of this.entityPaths()) {
      const e = this.entity(p)
      if (e?.type === 'npc' && e.dialogue === inkPath) return e
    }
    return undefined
  }


  /** Читаемое имя диалога: подпись документа → имя ведущего персонажа → русское имя или имя файла словами. */
  dialogueLabel(inkPath: string): string {
    const doc = this.jsonFiles.get(inkPath.replace(/\.ink$/, '.dlg.json')) as { label?: string } | undefined
    if (doc?.label) return doc.label
    const npc = this.npcForDialogue(inkPath)
    if (npc) return npc.label
    const base = inkPath.replace('dialogues/', '').replace(/\.ink$/, '')
    const DIALOGUE_RU: Record<string, string> = {
      heart: 'Сердце',
      core: 'Ядро',
      choir: 'Хор',
      clock: 'Часы',
      guard: 'Стража',
      abbot: 'Настоятель',
    }
    if (DIALOGUE_RU[base.toLowerCase()]) return DIALOGUE_RU[base.toLowerCase()]
    const allEnts = this.entityPaths().map((p) => this.entity(p))
    for (const ent of allEnts) {
      if (ent && (ent.id === base || ent.id === `item_${base}` || ent.id === `npc_${base}`) && ent.label) {
        return ent.label
      }
    }
    return base.replace(/[_-]+/g, ' ').replace(/^./, (ch) => ch.toUpperCase())
  }


  dialoguePaths(): string[] {
    return this.manifest.dialogues.map((f) => `dialogues/${f}`)
  }

  cutscenePaths(): string[] {
    return (this.manifest.cutscenes ?? []).map((f) => `cutscenes/${f}`)
  }

  recipePaths(): string[] {
    return (this.manifest.recipes ?? []).map((f) => `recipes/${f}`)
  }

  codexPaths(): string[] {
    return (this.manifest.codex ?? []).map((f) => `codex/${f}`)
  }


  scene(path: string): SceneDef {
    return this.jsonFiles.get(path) as SceneDef
  }

  entity(path: string): EntityDef {
    const e = this.jsonFiles.get(path) as EntityDef
    // мягкая миграция: у старых NPC нет описания — подставляем пустое
    if (e && e.type === 'npc' && typeof (e as { description?: string }).description !== 'string') {
      ;(e as { description?: string }).description = ''
    }
    return e
  }

  rule(path: string): RuleDef {
    return this.jsonFiles.get(path) as RuleDef
  }

  arena(path: string): ArenaDef {
    return this.jsonFiles.get(path) as ArenaDef
  }

  quest(path: string): QuestDef {
    return this.jsonFiles.get(path) as QuestDef
  }

  cutscene(path: string): CutsceneDef {
    return this.jsonFiles.get(path) as CutsceneDef
  }

  recipe(path: string): RecipeDef {
    return this.jsonFiles.get(path) as RecipeDef
  }

  codexEntry(path: string): CodexEntryDef {
    return this.jsonFiles.get(path) as CodexEntryDef
  }


  /** id всех рецептов кампании (для ссылок unlock_recipe) */
  recipeIds(): Set<string> {
    return new Set(this.recipePaths().map((p) => this.recipe(p)?.id).filter((x): x is string => !!x))
  }


  /**
   * Ключи состояний облика НПЦ: его собственные портреты и спрайты сцены
   * плюс общий реестр состояний meta.emotions. Пустая строка — обычный облик.
   */
  entityStateKeys(entityId: string): Set<string> {
    const out = new Set<string>(['', DEFAULT_EMOTION.id])
    for (const e of this.meta.emotions ?? []) out.add(e.id)
    const npc = this.entityPaths().map((p) => this.entity(p)).find((e) => e?.id === entityId)
    if (npc && npc.type === 'npc') {
      for (const k of Object.keys(npc.portrait ?? {})) out.add(k)
      for (const k of Object.keys(npc.scene_sprite_states ?? {})) out.add(k)
      for (const k of Object.keys(npc.combat_figure_states ?? {})) out.add(k)
    }
    return out
  }


  /**
   * Циклы правил через эффект fire_rule (прямой вызов себя и транзитивные
   * петли). Возвращает список замкнутых цепочек для отчёта «Проверить кампанию».
   */
  fireRuleCycles(): string[][] {
    const edges = new Map<string, string[]>()
    for (const p of this.rulePaths()) {
      const r = this.rule(p)
      if (!r) continue
      const to: string[] = []
      walkEffects(r.effects ?? [], (e) => {
        if (e.type === 'fire_rule') to.push(e.rule)
      })
      edges.set(r.id, to)
    }
    const cycles: string[][] = []
    const state = new Map<string, 0 | 1 | 2>() // 0 нет, 1 в стеке, 2 обработан
    const stack: string[] = []
    const labels = new Map<string, string>()
    for (const p of this.rulePaths()) {
      const r = this.rule(p)
      if (r) labels.set(r.id, r.label || r.id)
    }
    const visit = (id: string): void => {
      const st = state.get(id) ?? 0
      if (st === 2) return
      if (st === 1) {
        const from = stack.indexOf(id)
        if (from >= 0) cycles.push([...stack.slice(from), id])
        return
      }
      state.set(id, 1)
      stack.push(id)
      for (const next of edges.get(id) ?? []) visit(next)
      stack.pop()
      state.set(id, 2)
    }
    for (const id of edges.keys()) visit(id)
    return cycles.map((c) => c.map((id) => `«${labels.get(id) ?? id}»`))
  }


  /** списки id для подсказок в полях */
  /** все флаги, упомянутые в правилах/квестах/ink — для подсказок в конструкторах */
  knownFlags(): string[] {
    const flags = new Set<string>()
    const scan = (o: unknown): void => {
      if (Array.isArray(o)) { o.forEach(scan); return }
      if (o && typeof o === 'object') {
        const r = o as Record<string, unknown>
        if (typeof r.flag === 'string') flags.add(r.flag)
        for (const v of Object.values(r)) scan(v)
      }
    }
    for (const p of this.rulePaths()) scan(this.rule(p))
    for (const p of this.questPaths()) scan(this.quest(p))
    for (const [, text] of this.textFiles) {
      for (const m of text.matchAll(/(?:get_flag|set_flag)\("([^"]+)"\)/g)) flags.add(m[1])
    }
    return [...flags].sort()
  }


  /** пары id+label для выпадающих списков (в UI мастер видит названия, не id) */
  options(kind: 'entity' | 'scene' | 'location' | 'quest' | 'arena' | 'rule' | 'item' | 'npc' | 'dialogue' | 'faction' | 'skill' | 'need' | 'disposition' | 'itemCategory' | 'flag' | 'cutscene' | 'status' | 'ability' | 'weather' | 'codex' | 'currency' | 'recipe' | 'emotion' | 'duration_action'): Array<{ id: string; label: string }> {
    const out: Array<{ id: string; label: string }> = []
    if (kind === 'currency') {
      for (const c of this.meta.currencies ?? []) out.push({ id: c.id, label: c.label })
    } else if (kind === 'entity' || kind === 'item' || kind === 'npc') {
      for (const p of this.entityPaths()) {
        const e = this.entity(p)
        if (!e) continue
        if (kind === 'entity' || e.type === kind) out.push({ id: e.id, label: e.label || e.id })
      }
    } else if (kind === 'scene') {
      for (const p of this.scenePaths()) {
        const sc = this.scene(p)
        if (sc) out.push({ id: sc.id, label: sc.label || sc.id })
      }
    } else if (kind === 'quest') {
      for (const p of this.questPaths()) {
        const q = this.quest(p)
        if (q) out.push({ id: q.id, label: q.label || q.id })
      }
    } else if (kind === 'arena') {
      for (const p of this.arenaPaths()) {
        const a = this.arena(p)
        if (a) out.push({ id: a.id, label: a.label || a.id })
      }
    } else if (kind === 'rule') {
      for (const p of this.rulePaths()) {
        const r = this.rule(p)
        if (r) out.push({ id: r.id, label: r.label || r.id })
      }
    } else if (kind === 'cutscene') {
      for (const p of this.cutscenePaths()) {
        const c = this.cutscene(p)
        if (c) out.push({ id: c.id, label: c.label || c.id })
      }
    } else if (kind === 'location') {
      const walk = (regions: typeof this.world.regions) => {
        for (const r of regions) {
          for (const l of r.locations) out.push({ id: l.id, label: l.label || l.id })
          if (r.sub_regions) walk(r.sub_regions)
        }
      }
      walk(this.world.regions)
    } else if (kind === 'dialogue') {
      for (const p of this.dialoguePaths()) out.push({ id: p, label: this.dialogueLabel(p) })
    } else if (kind === 'faction') {
      for (const f of this.meta.factions ?? []) out.push({ id: f.id, label: f.label || f.id })
    } else if (kind === 'skill') {
      for (const sk of this.meta.skills ?? []) out.push({ id: sk.id, label: sk.label || skillLabel(sk.id, this.meta.skills) })
    } else if (kind === 'need') {
      for (const n of this.meta.needs) out.push({ id: n.id, label: n.label || n.id })
    } else if (kind === 'status') {
      for (const s of this.meta.statuses ?? []) out.push({ id: s.id, label: s.label || s.id })
    } else if (kind === 'ability') {
      for (const a of this.meta.abilities ?? []) out.push({ id: a.id, label: a.label || a.id })
    } else if (kind === 'weather') {
      out.push({ id: '', label: 'Ясно' })
      for (const w of this.meta.weathers ?? []) out.push({ id: w.id, label: w.label || w.id })
    } else if (kind === 'codex') {
      for (const p of this.codexPaths()) {
        const c = this.codexEntry(p)
        if (c) out.push({ id: c.id, label: c.label || c.id })
      }
    } else if (kind === 'recipe') {
      for (const p of this.recipePaths()) {
        const r = this.recipe(p)
        if (r) out.push({ id: r.id, label: r.label || r.id })
      }
    } else if (kind === 'emotion') {
      // состояния портретов: встроенное «Обычный» + реестр кампании
      out.push({ id: DEFAULT_EMOTION.id, label: DEFAULT_EMOTION.label })
      for (const e of this.meta.emotions ?? []) out.push({ id: e.id, label: e.label || e.id })
    } else if (kind === 'disposition') {
      // отношение можно менять и к фракции, и к отдельному NPC
      for (const f of this.meta.factions ?? []) out.push({ id: f.id, label: `${f.label || f.id} (фракция)` })
      for (const o of this.options('npc')) out.push({ id: o.id, label: `${o.label} (NPC)` })
    } else if (kind === 'duration_action') {
      for (const d of this.meta.duration_actions ?? []) out.push({ id: d.id, label: d.label || d.id })
    } else if (kind === 'itemCategory') {
      for (const c of this.meta.item_categories ?? []) out.push({ id: c.id, label: c.label || c.id })
    } else if (kind === 'flag') {
      const seen = new Set<string>()
      for (const f of this.meta.flags ?? []) {
        out.push({ id: f.id, label: f.label || f.id })
        seen.add(f.id)
      }
      // флаги, встречающиеся в контенте, но не описанные в реестре
      for (const f of this.knownFlags()) if (!seen.has(f)) out.push({ id: f, label: f })
    }
    return out.sort((a, b) => a.label.localeCompare(b.label, 'ru'))
  }
}
