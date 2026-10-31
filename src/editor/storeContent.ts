import { allLocations, migrateMeta, migrateNavigation } from '../shared/migrate'
import { isExternalUrl } from '../core/loader'
import { compareVersions } from '../shared/versions'
import type { SceneDef } from '../shared/types'
import { FIRE_RULE_MAX_DEPTH } from './storeShared'
import { EditorStoreLookups } from './storeLookups'

/** Content migration and validation operations. */
export abstract class EditorStoreContent extends EditorStoreLookups {
  protected abstract campaignRel(): string
  protected abstract saveEndpoint(): string



  /** название стадии или журнальной записи квеста (для сводок правил) */
  questStageLabel(questId: string, key: string): string {
    for (const p of this.questPaths()) {
      const q = this.quest(p)
      if (q?.id !== questId) continue
      const st = q.stages.find((s) => s.id === key)
      return st?.label ?? key
    }
    return key
  }


  /** src для предпросмотра ассета: файл пакета или внешняя ссылка (итерация 8, блок C) */
  assetSrc(path: string | undefined | null): string {
    if (!path) return ''
    if (isExternalUrl(path)) return path
    return `${this.basePath}/${path}`
  }


  /** название по id (для сводок) */
  labelFor(kind: string, id: string): string {
    return this.options(kind as Parameters<EditorStoreLookups['options']>[0]).find((o) => o.id === id)?.label ?? id
  }


  /** сохранить бинарный файл (картинку) в кампанию; возвращает путь внутри кампании */
  async saveBinary(relPath: string, file: File): Promise<string> {
    const buf = await file.arrayBuffer()
    let bin = ''
    const bytes = new Uint8Array(buf)
    for (let i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i])
    const b64 = btoa(bin)
    const res = await fetch(this.saveEndpoint(), {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ path: `${this.campaignRel()}/${relPath}`, base64: b64 }),
    })
    if (!res.ok) throw new Error(`${relPath}: ${res.status} ${await res.text()}`)
    return relPath
  }


  ids(kind: 'entity' | 'scene' | 'location' | 'quest' | 'arena' | 'rule' | 'item' | 'npc' | 'cutscene' | 'recipe' | 'codex'): string[] {
    const out: string[] = []
    if (kind === 'entity' || kind === 'item' || kind === 'npc') {
      for (const p of this.entityPaths()) {
        const e = this.entity(p)
        if (!e) continue
        if (kind === 'entity' || e.type === kind) out.push(e.id)
      }
    } else if (kind === 'scene') {
      for (const p of this.scenePaths()) out.push(this.scene(p)?.id ?? '')
    } else if (kind === 'quest') {
      for (const p of this.questPaths()) out.push(this.quest(p)?.id ?? '')
    } else if (kind === 'arena') {
      for (const p of this.arenaPaths()) out.push(this.arena(p)?.id ?? '')
    } else if (kind === 'rule') {
      for (const p of this.rulePaths()) out.push(this.rule(p)?.id ?? '')
    } else if (kind === 'cutscene') {
      for (const p of this.cutscenePaths()) out.push(this.cutscene(p)?.id ?? '')
    } else if (kind === 'recipe') {
      for (const p of this.recipePaths()) out.push(this.recipe(p)?.id ?? '')
    } else if (kind === 'codex') {
      for (const p of this.codexPaths()) out.push(this.codexEntry(p)?.id ?? '')
    } else if (kind === 'location') {
      const walk = (regions: typeof this.world.regions) => {
        for (const r of regions) {
          for (const l of r.locations) out.push(l.id)
          if (r.sub_regions) walk(r.sub_regions)
        }
      }
      walk(this.world.regions)
    }
    return out.filter(Boolean).sort()
  }


  // ─────────────── миграции и валидация ───────────────

  /**
   * Мягкие миграции контента (итерация 8). Старый формат остаётся читаемым:
   * одиночные location/item в условиях потребностей превращаются в списки,
   * переходы «в локацию» из сцен — в «открыть карту».
   */
  migrateContent(): string[] {
    const notes: string[] = []
    migrateMeta(this.meta)

    // автосопоставление алиасов звуков погоды (snd_ <-> sfx_)
    const soundIds = new Set((this.meta.sounds ?? []).map((s) => s.id))
    for (const w of this.meta.weathers ?? []) {
      if (!w.ambient?.length) continue
      w.ambient = w.ambient.map((id) => {
        if (soundIds.has(id)) return id
        const alt = id.startsWith('snd_') ? id.replace(/^snd_/, 'sfx_') : id.startsWith('sfx_') ? id.replace(/^sfx_/, 'snd_') : ''
        return alt && soundIds.has(alt) ? alt : id
      })
    }

    for (const p of this.scenePaths()) {
      const sc = this.scene(p)
      if (!sc) continue
      const before = JSON.stringify(sc.navigation)
      migrateNavigation(sc, this.world)
      if (JSON.stringify(sc.navigation) !== before) {
        notes.push(`Сцена «${sc.label}»: переход «в локацию» заменён на «открыть карту»`)
      }
    }
    return notes
  }


  /**
   * Проверка целостности кампании (итерация 8, А6/блок F).
   * Возвращает список проблем по-русски — импорт и загрузка не падают,
   * мастеру показывается отчёт.
   */
  validateContent(): string[] {
    const issues: string[] = []

    // версии и совместимость (docs/compatibility.md)
    const semver = /^\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?$/
    if (!this.meta.version) issues.push('Кампания: не заполнена версия (нужна для обновлений и совместимости сохранений)')
    else if (!semver.test(this.meta.version)) issues.push(`Кампания: версия «${this.meta.version}» не похожа на semver (ожидается вид 1.4.2)`)
    const minEngine = this.meta.min_engine ?? this.meta.engine_version
    if (minEngine && !/^\d+(\.\d+){0,2}(?:-[0-9A-Za-z.-]+)?$/.test(minEngine)) {
      issues.push(`Кампания: минимальный движок «${minEngine}» не похож на номер версии`)
    }
    if (this.meta.save_base_version) {
      if (!semver.test(this.meta.save_base_version)) issues.push(`Кампания: граница сохранений «${this.meta.save_base_version}» не похожа на semver`)
      else if (compareVersions(this.meta.save_base_version, this.meta.version) > 0) {
        issues.push(`Кампания: граница сохранений ${this.meta.save_base_version} новее версии кампании ${this.meta.version} — так сохранения не откроются ни у кого`)
      }
    }

    const scenes: Record<string, SceneDef> = {}
    for (const p of this.scenePaths()) {
      const sc = this.scene(p)
      if (sc) scenes[sc.id] = sc
    }
    const locationIds = new Set(this.ids('location'))
    const sceneIds = new Set(Object.keys(scenes))
    const entityIds = new Set(this.ids('entity'))
    const questIds = new Set(this.ids('quest'))
    const arenaIds = new Set(this.ids('arena'))
    const ruleIds = new Set(this.ids('rule'))
    const cutsceneIds = new Set(this.ids('cutscene'))

    // катсцены: слайды
    for (const p of this.cutscenePaths()) {
      const c = this.cutscene(p)
      if (!c) continue
      if (!c.slides?.length) issues.push(`Катсцена «${c.label}»: нет ни одного слайда`)
    }

    // мировая карта
    for (const loc of allLocations(this.world)) {
      for (const sc of loc.scenes) {
        if (!sceneIds.has(sc)) issues.push(`Локация «${loc.label}»: сцены «${sc}» нет в кампании`)
      }
      if (loc.arrival_scene && !loc.scenes.includes(loc.arrival_scene)) {
        issues.push(`Локация «${loc.label}»: сцена по прибытии «${loc.arrival_scene}» не входит в список её сцен`)
      }
      if (loc.arena && !arenaIds.has(loc.arena)) {
        issues.push(`Локация «${loc.label}»: арена «${loc.arena}» не найдена`)
      }
      for (const tc of loc.travel_connections) {
        if (!locationIds.has(tc.to)) issues.push(`Локация «${loc.label}»: дорога ведёт в несуществующую локацию «${tc.to}»`)
      }
    }

    // сцены: локация, внутренние переходы, слоты
    for (const p of this.scenePaths()) {
      const sc = this.scene(p)
      if (!sc) continue
      if (sc.location && !locationIds.has(sc.location)) {
        issues.push(`Сцена «${sc.label}»: локация «${sc.location}» не найдена`)
      }
      for (const nav of sc.navigation) {
        if (!nav.go_to_scene) continue
        const target = scenes[nav.go_to_scene]
        if (!target) {
          issues.push(`Сцена «${sc.label}»: переход «${nav.label}» ведёт в несуществующую сцену «${nav.go_to_scene}»`)
        } else if (target.location !== sc.location) {
          issues.push(
            `Сцена «${sc.label}»: переход «${nav.label}» ведёт в сцену другой локации «${target.label}» ` +
              `(между локациями — только через карту)`,
          )
        }
      }
      for (const slot of sc.slots) {
        if (slot.default_entity && !entityIds.has(slot.default_entity)) {
          issues.push(`Сцена «${sc.label}»: в слоте стоит несуществующая сущность «${slot.default_entity}»`)
        }
      }
      if (!sc.states.length) issues.push(`Сцена «${sc.label}»: нет ни одного состояния (фона)`)
      for (const st of sc.states) {
        if (!st.image && !st.art) issues.push(`Сцена «${sc.label}»: у состояния «${st.label}» нет ни изображения, ни векторного фона`)
      }
    }

    // сущности: диалоги, расписания
    for (const p of this.entityPaths()) {
      const e = this.entity(p)
      if (!e || e.type !== 'npc') continue
      if (e.dialogue && !this.textFiles.has(e.dialogue)) {
        issues.push(`Персонаж «${e.label}»: диалог «${e.dialogue}» не найден`)
      }
      for (const s of e.schedule ?? []) {
        if (!sceneIds.has(s.scene)) issues.push(`Персонаж «${e.label}»: расписание ссылается на несуществующую сцену «${s.scene}»`)
        else if (scenes[s.scene] && !scenes[s.scene].slots.some((sl) => sl.id === s.slot)) {
          issues.push(`Персонаж «${e.label}»: в сцене «${scenes[s.scene].label}» нет слота «${s.slot}»`)
        }
      }
      for (const ov of e.presence_overrides ?? []) {
        if (!sceneIds.has(ov.scene)) {
          issues.push(`Персонаж «${e.label}»: особое место ссылается на несуществующую сцену «${ov.scene}»`)
        }
      }
      for (const s of e.trader?.sells ?? []) {
        if (!entityIds.has(s.item)) issues.push(`Персонаж «${e.label}»: в прилавке нет предмета «${s.item}»`)
      }
    }

    // правила и квесты
    for (const p of this.rulePaths()) {
      const r = this.rule(p)
      if (!r) continue
      for (const cond of r.conditions ?? []) {
        if (cond.type === 'player_enters_scene' && !sceneIds.has(cond.scene)) {
          issues.push(`Правило «${r.label}»: условие ссылается на несуществующую сцену «${cond.scene}»`)
        }
      }
      for (const ef of r.effects ?? []) {
        if (ef.type === 'start_quest' && !questIds.has(ef.quest)) {
          issues.push(`Правило «${r.label}»: квест «${ef.quest}» не найден`)
        }
        if (ef.type === 'play_cutscene' && !cutsceneIds.has(ef.cutscene)) {
          issues.push(`Правило «${r.label}»: катсцена «${ef.cutscene}» не найдена`)
        }
        if (ef.type === 'fire_rule' && !ruleIds.has(ef.rule)) {
          issues.push(`Правило «${r.label}»: эффект вызывает несуществующее правило «${ef.rule}»`)
        }
        if (ef.type === 'unlock_recipe' && !this.recipeIds().has(ef.recipe)) {
          issues.push(`Правило «${r.label}»: открывается несуществующий рецепт «${ef.recipe}»`)
        }
        if (ef.type === 'set_entity_state') {
          if (!entityIds.has(ef.entity)) {
            issues.push(`Правило «${r.label}»: состояние облика назначается несуществующему персонажу «${ef.entity}»`)
          } else if (ef.state && !this.entityStateKeys(ef.entity).has(ef.state)) {
            issues.push(
              `Правило «${r.label}»: у персонажа «${ef.entity}» нет состояния облика «${ef.state}» ` +
                `(есть: ${[...this.entityStateKeys(ef.entity)].join(', ') || '—'})`,
            )
          }
        }
      }
    }
    // петли правил через fire_rule: прямое и транзитивноеself-вызовы запрещены
    for (const cyc of this.fireRuleCycles()) {
      issues.push(
        `Правила вызывают друг друга по кругу: ${cyc.join(' → ')}. ` +
          `Разорвите цепочку: вложенных вызовов правил может быть не больше ${FIRE_RULE_MAX_DEPTH}, ` +
          `а правило не должно возвращаться в себя.`,
      )
    }
    for (const p of this.questPaths()) {
      const q = this.quest(p)
      if (!q) continue
      if (!q.stages.length) issues.push(`Квест «${q.label}»: нет ни одной стадии`)
      else {
        const ids = new Set(q.stages.map((s) => s.id))
        for (const st of q.stages) {
          for (const t of st.transitions ?? []) {
            if (!ids.has(t.to)) issues.push(`Квест «${q.label}»: переход стадии «${st.label ?? st.id}» в несуществующую стадию «${t.to}»`)
          }
        }
        // стартовая сцена/сущность игрока
        if (this.meta.starting_scene && !sceneIds.has(this.meta.starting_scene)) {
          issues.push(`Кампания: стартовая сцена «${this.meta.starting_scene}» не найдена`)
        }
      }
    }

    // старт кампании
    if (!locationIds.has(this.meta.starting_location)) {
      issues.push(`Кампания: стартовая локация «${this.meta.starting_location}» не найдена`)
    }
    if (!entityIds.has(this.meta.default_player)) {
      issues.push(`Кампания: персонаж игрока «${this.meta.default_player}» не найден`)
    }
    for (const need of this.meta.needs ?? []) {
      if (need.on_zero_effect && need.on_zero_effect !== 'death' && !ruleIds.has(need.on_zero_effect)) {
        issues.push(`Потребность «${need.label}»: правило «${need.on_zero_effect}» не найдено`)
      }
    }

    // дизайн-документ (§R10): непустой документ обязан описывать хоть что-то
    // из этой кампании — иначе мастер читает черновик не про её сцены.
    // Обратного требования нет: упомянуто лишнее — нормально (черновик с
    // планами). Кампании без design_doc (и с пустым) не получают замечаний.
    const designDoc = (this.meta.design_doc ?? '').trim()
    if (designDoc) {
      const npcIds = new Set<string>()
      for (const p of this.entityPaths()) {
        const e = this.entity(p)
        if (e?.type === 'npc') npcIds.add(e.id)
      }
      const known = [...sceneIds, ...questIds, ...npcIds]
      if (known.length && !known.some((id) => designDoc.includes(id))) {
        const firstScene = this.scene(this.scenePaths()[0] ?? '')
        issues.push(
          firstScene
            ? `Дизайн-документ не описывает сцену «${firstScene.label}»: попросите агента дополнить`
            : 'Дизайн-документ не описывает ни одной сцены, персонажа или квеста кампании: попросите агента дополнить',
        )
      }
    }
    return issues
  }
}
