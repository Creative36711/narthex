import type { EngineCtx } from '../../src/core/context'
import type { EncounterEntry, EventTableDef, GenWeightedItem, NpcGeneratorDef, TravelConnection } from '../../src/shared/types'
import { featureOn } from '../../src/core/caps'
import { skillCheck, difficultyModifier, CHECK_RESULT_LABEL } from '../../src/core/brp'
import { timeOfDay } from '../../src/core/time'
import { effects } from '../../src/core/effects'

// ─────────────── скрытность и обнаружение (аудит §5.6 п.12) ───────────────

  /** включена ли скрытность мастером (meta.stealth); боевой режим — отдельно */
function stealthEnabled(this: EngineCtx): boolean {
    return !!this.campaign.meta.stealth
  }

/** герой сейчас крадётся */
function isSneaking(this: EngineCtx): boolean {
    return this.state.stealth?.sneaking === true
  }

/** героя заметили в текущей сцене */
function isDetected(this: EngineCtx): boolean {
    return this.state.stealth?.detected === true
  }

/** Получает значение навыка игрока (с модификаторами статусов) */
function playerSkill(this: EngineCtx, skill: string): number {
    return Math.max(0, (this.state.player.skills[skill] ?? 0) + this.statusSkillMod(skill))
  }

/**
   * Переключить красться/идти открыто. Вход в красться — моментальная
   * проверка против всех наблюдателей в сцене; заметили — режим включён,
   * но скрытым вас не считают.
   */
function toggleSneak(this: EngineCtx): void {
    if (!this.stealthEnabled()) return
    const st = (this.state.stealth ??= { sneaking: false, detected: false })
    const wasSneaking = st.sneaking
    st.sneaking = !wasSneaking
    st.detected = false

    if (st.sneaking) {
      this.pushLog('Вы переходите на скрытное передвижение. Бросок скрытности при смене сцены...')
      this.detectCheck('вы появляетесь в поле зрения')
    } else {
      this.pushLog('Вы больше не скрываетесь.')
    }

    this.autosave()
    this.notify()
  }

/**
   * Проверка обнаружения: бросок скрытности героя против лучшей
   * внимательности живых NPC в текущей сцене. Поражение — `detected`.
   * Истина — остался незамеченным.
   */
function detectCheck(this: EngineCtx, context: string): boolean {
    if (!this.stealthEnabled() || !this.isSneaking() || this.isDetected()) return true
    const scene = this.currentScene()
    if (!scene) return true
    const st = this.campaign.meta.stealth!
    let bestNpc: { label: string; value: number } | null = null
    for (const occ of this.slotOccupants(scene)) {
      const def = occ.entity
      if (!def || def.type !== 'npc') continue
      const value = def.perception ?? Math.max(1, (def.skills[st.perception_skill ?? 'perception'] ?? 0) || def.stats.INT * 2)
      if (!bestNpc || value > bestNpc.value) bestNpc = { label: def.label, value }
    }
    if (!bestNpc) return true
    const skill = st.skill ?? 'stealth'
    const hero = Math.max(1, (this.state.player.skills[skill] ?? 0) + this.statusSkillMod(skill))
    const mine = skillCheck(hero, this.rng, 0, this.diceRules)
    const theirs = skillCheck(bestNpc.value, this.rng, 0, this.diceRules)
    const RANK: Record<string, number> = { fumble: 0, fail: 1, success: 2, hard: 3, critical: 4 }
    const wins = (RANK[mine.result] ?? 1) >= (RANK[theirs.result] ?? 1)
    this.pushLog(
      `Скрытность (${context}): ваш ${mine.result} (d100=${mine.roll}/${hero}) против «${bestNpc.label}» ${theirs.result} (d100=${theirs.roll}/${bestNpc.value}) → ${wins ? 'вас не заметили' : 'ВАС ЗАМЕТИЛИ!'}`,
    )
    if (!wins) {
      this.state.stealth!.detected = true
    }
    return wins
  }

/** Внезапность при начале боя из скрытности: враги застигнуты врасплох. */
function consumeSurpriseFromSneak(this: EngineCtx): boolean {
    const st = this.state.stealth
    if (st?.sneaking && !st.detected) return true
    return false
  }

// ─────────────── случайные встречи (ТЗ 4.9) ───────────────
function rollEncounter(this: EngineCtx, conn: TravelConnection): void {
    if (!conn.random_encounter_table) return
    const table = this.campaign.encounters[conn.random_encounter_table]
    if (!table) return
    for (let roll = 0; roll < (table.rolls ?? 1); roll++) {
      const total = table.entries.reduce((s, e) => s + e.weight, 0)
      let pick = this.rng.next() * total
      let entry: EncounterEntry | null = null
      for (const e of table.entries) {
        pick -= e.weight
        if (pick <= 0) {
          entry = e
          break
        }
      }
      if (!entry) continue
      resolveEncounter.call(this, entry)
      if (this.combat || this.state.game_over) return
    }
  }

function resolveEncounter(this: EngineCtx, entry: EncounterEntry): void {
    switch (entry.type) {
      case 'nothing':
        return
      case 'combat': {
        // бой выключен профилем — встреча в пути проходит мимо
        if (!featureOn(this.campaign.meta, 'combat')) return
        const enemies = entry.enemies.map((e) => ({
          entity: e.entity,
          count: this.rng.int(e.count_min, e.count_max),
        }))
        this.startCombat({
          type: 'start_combat',
          enemies,
          arena: entry.arena,
          intro: entry.intro ?? 'В дороге на вас нападают!',
        })
        return
      }
      case 'dialogue':
        this.startDialogue(entry.entity, entry.knot)
        return
      case 'skill_check': {
        const out = this.playerSkillCheck(entry.skill, entry.difficulty)
        if (entry.message) this.messages.push({ text: entry.message })
        this.applyEffects(out.success ? entry.success_effects : entry.fail_effects)
        return
      }
      case 'event':
        this.applyEffects(entry.effects)
        if (entry.message) this.messages.push({ text: entry.message })
        return
    }
  }

/** периодическая проверка погони: герой + до двух союзников цепочкой; провал наращивает счётчик до облавы */
function tickPursuit(this: EngineCtx): void {
    const p = this.state.pursuit
    if (!p) return
    const companions = this.state.party.slice(0, 2)
    let wins = 0
    const outP = this.playerSkillCheck(p.skill, 50)
    if (outP.success) wins++
    for (const c of companions) {
      const def = this.campaign.entities[c.entity]
      if (!def || def.type !== 'npc') continue
      const out = skillCheck(Math.max(1, def.skills?.[p.skill] ?? 0), this.rng, difficultyModifier(def.skills?.[p.skill] ?? 0, 50), this.diceRules)
      this.pushLog(`${def.label}: d100=${out.roll} против ${out.target} → ${CHECK_RESULT_LABEL[out.result]}`)
      if (out.success) wins++
    }
    p.left = p.every
    if (wins > 0) {
      if (p.fails > 0) this.pushLog(`След удалось запутать — ${p.label ?? 'погоня'} пока не настигает.`)
      p.fails = 0
      return
    }
    p.fails += 1
    if (p.fails < p.fails_needed) {
      this.pushLog(`${p.label ?? 'Погоня'} не отстаёт — ещё ${p.fails_needed - p.fails} сорванная проверка, и отряд настигнут!`)
      return
    }
    this.pushLog(`${p.label ?? 'Погоня'} настигла отряд!`)
    const effects = p.on_fail
    delete this.state.pursuit
    this.applyEffects(effects)
  }

// ─────────────── случайные события и генераторы (аудит B9) ───────────────

  /** есть ли генераторы/таблицы вообще */
function generatorsEnabled(this: EngineCtx): boolean {
    const g = this.campaign.meta.generators
    return !!(g && (g.event_tables?.length || g.npc?.length || g.scenes?.length || g.adventures?.length))
  }

/** таблица событий по id */
function eventTableDef(this: EngineCtx, id: string): EventTableDef | undefined {
    return this.campaign.meta.generators?.event_tables?.find((t) => t.id === id)
  }

/** таблица событий активна сейчас (не выключена, время/локация подходят) */
function eventTableActive(this: EngineCtx, t: EventTableDef): boolean {
    if (t.disabled) return false
    if (t.time_of_day?.length && !t.time_of_day.includes(timeOfDay(this.state.tick, this.campaign.meta))) return false
    if (t.locations?.length && !t.locations.includes(this.state.location)) return false
    return true
  }

/**
   * Один бросок таблицы: выбор случайного подходящего правила и его
   * исполнение. Возвращает id исполненного правила или null.
   * `forced` — вызыватель эффекта roll_event_table: без шанса-интервала,
   * `ignoreFilters` — даже без проверок времени/локации.
   */
function rollEventTable(this: EngineCtx, tableId: string, opts: { forced?: boolean; ignoreFilters?: boolean } = {}): string | null {
    const t = this.eventTableDef(tableId)
    if (!t || t.disabled) return null
    if (!opts.ignoreFilters && !eventTableActive.call(this, t)) return null
    if (!opts.forced && (t.chance ?? 1) < 1 && !this.rng.chance(t.chance ?? 1)) return null
    const candidates: string[] = []
    for (const ruleId of t.rules) {
      const rule = this.campaign.rules[ruleId]
      if (!rule) continue
      if (rule.once && this.state.fired_rules.includes(rule.id)) continue
      if (!effects.ruleConditionsOk.call(this, rule)) continue
      candidates.push(ruleId)
    }
    if (!candidates.length) return null
    const picked = candidates[this.rng.int(0, candidates.length - 1)]!
    this.pushLog(`Событие (${t.label})…`)
    this.fireRule(picked)
    return picked
  }

/** тики: у каждой таблицы свой шаг (tick % interval === 0) */
function tickEventTables(this: EngineCtx): void {
    const tables = this.campaign.meta.generators?.event_tables
    if (!tables?.length) return
    for (const t of tables) {
      if (t.interval_ticks <= 0) continue
      if (this.state.tick % t.interval_ticks !== 0) continue
      this.rollEventTable(t.id)
    }
  }

/** взвешенный выбор из списка генератора (`genPick` используется и из ink) */
function genPickWeighted(this: EngineCtx, items: GenWeightedItem[], rand: () => number): string | null {
    if (!items.length) return null
    let total = 0
    for (const it of items) total += Math.max(0, it.weight ?? 1)
    if (total <= 0) return items[0].value
    let roll = rand() * total
    for (const it of items) {
      roll -= Math.max(0, it.weight ?? 1)
      if (roll <= 0) return it.value
    }
    return items[items.length - 1].value
  }

/** найти определение генератора (любого вида) по id или id списка */
function genDef(this: EngineCtx, generatorId: string): { lists: Record<string, GenWeightedItem[]> } | undefined {
    const g = this.campaign.meta.generators
    if (!g) return undefined
    return (
      g.npc?.find((x) => x.id === generatorId) ??
      g.scenes?.find((x) => x.id === generatorId) ??
      g.adventures?.find((x) => x.id === generatorId)
    )
  }

/**
   * Значение из списка генератора. `key` — ключ списка; компоновка имени —
   * ключ `name` (через gen.name части). seed — стабильная строка: тот же
   * seed+key даёт то же значение. Без seed — игровой PRNG.
   */
function genValue(this: EngineCtx, generatorId: string, key: string, seed?: string): string {
    const def = genDef.call(this, generatorId)
    if (!def) return ''
    const rand = seed ? seedRand.call(this, `${seed}:${generatorId}:${key}`) : () => this.rng.next()
    if (key === 'name') {
      const nameGen = this.campaign.meta.generators?.npc?.find((x) => x.id === generatorId)
      if (nameGen?.name?.length) return composeGenName.call(this, nameGen, rand)
    }
    // спец-ключ цели приключения: goals:N
    if (key.startsWith('goal:')) {
      const adv = this.campaign.meta.generators?.adventures?.find((x) => x.id === generatorId)
      const idx = parseInt(key.slice(5), 10)
      const template = adv?.goals[idx]
      if (template) return expandGenTemplate.call(this, template, def.lists, rand)
      return ''
    }
    const list = def.lists[key]
    return list ? (this.genPickWeighted(list, rand) ?? '') : ''
  }

/** детерминированный PRNG из строки (стабильность по seed) */
function seedRand(this: EngineCtx, seed: string): () => number {
    let h = 2166136261 >>> 0
    for (let i = 0; i < seed.length; i++) {
      h ^= seed.charCodeAt(i)
      h = Math.imul(h, 16777619) >>> 0
    }
    let x = h || 1
    return () => {
      x ^= x << 13; x >>>= 0
      x ^= x >> 17
      x ^= x << 5; x >>>= 0
      return x / 4294967296
    }
  }

/** компоновка имени из частей (список/литерал) */
function composeGenName(this: EngineCtx, gen: NpcGeneratorDef, rand: () => number): string {
    if (!gen.name?.length) return ''
    return gen.name
      .map((p) => {
        if (p.literal != null) return p.literal
        const list = gen.lists[p.list ?? '']
        return list ? (this.genPickWeighted(list, rand) ?? '') : ''
      })
      .filter(Boolean)
      .join('')
      .trim()
  }

/** подстановка {list:key} в шаблон (цели приключений и слоты сцен) */
function expandGenTemplate(this: EngineCtx, template: string, lists: Record<string, GenWeightedItem[]>, rand: () => number): string {
    // {list:ключ} — наследие ранних версий; {список:ключ} — русская форма,
    // которую учит подсказывать UI мастера. Обе подстановки равноправны.
    return template.replace(/\{(?:list|список):([^\s{}]+)\}/g, (_m, key: string) => {
      const list = lists[key]
      return list ? (this.genPickWeighted(list, rand) ?? '') : ''
    })
  }

export const encounters = {
  stealthEnabled,
  isSneaking,
  isDetected,
  playerSkill,
  toggleSneak,
  detectCheck,
  consumeSurpriseFromSneak,
  rollEncounter,
  resolveEncounter,
  tickPursuit,
  generatorsEnabled,
  eventTableDef,
  eventTableActive,
  rollEventTable,
  tickEventTables,
  genPickWeighted,
  genDef,
  genValue,
  seedRand,
  composeGenName,
  expandGenTemplate,
}
