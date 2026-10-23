import type { EngineCtx } from './context'
import type { FeatDef, PlayerState, SkillDifficulty, StatBlock } from '../shared/types'
import type { CharChoice } from './charcreate'
import { derivedHP, derivedMP, movement, skillCheck, CHECK_RESULT_LABEL, difficultyModifier, difficultyLabel } from './brp'
import { rollDice } from './dice'
import { featureOn } from '../shared/types'
import { skillLabel as sharedSkillLabel } from '../shared/skills'
import { evalCondition } from './conditions'
import { playUi } from '../shared/audio'

/**
   * Применить выбор с экрана создания персонажа (блок 11 ТЗ) к шаблону
   * `default_player`: имя, характеристики (с пересчётом производных),
   * навыки, снаряжение профессии. Вызывается ДО `start()` на новом забеге.
   */
function applyCharCreation(this: EngineCtx, choice: CharChoice): void {
    const creation = this.campaign.meta.char_creation
    if (!creation) return
    const s = this.state
    const profession = creation.professions?.find((p) => p.id === choice.profession)
    const name = choice.name.trim()
    if (name) s.player.name = name
    // возраст и биография (аудит §5.6): только если мастер включил поля
    if (creation.choose_age && choice.age !== undefined) s.player.age = choice.age
    // уровень сложности от игрока (мастерские пресеты meta.difficulties)
    if (choice.difficulty && this.campaign.meta.difficulties?.some((d) => d.id === choice.difficulty)) {
      s.player.difficulty = choice.difficulty
    }
    // облик героя: галерея и/или слои мастера (char_creation.portraits[-layers])
    const pc: Record<string, unknown> = {}
    if (choice.portrait && creation.portraits?.some((p) => p.id === choice.portrait)) pc.gallery = choice.portrait
    if (choice.portrait_layers && creation.portrait_layers?.length) {
      const layers: Record<string, string> = {}
      for (const layer of creation.portrait_layers) {
        const sel = choice.portrait_layers[layer.id]
        if (sel && layer.options.some((o) => o.id === sel)) layers[layer.id] = sel
      }
      if (Object.keys(layers).length) pc.layers = layers
    }
    if (Object.keys(pc).length) s.player.portrait_choice = pc as PlayerState['portrait_choice']
    else delete s.player.age
    if (creation.choose_bio && choice.bio?.trim()) s.player.bio = choice.bio.trim()
    else delete s.player.bio
    // характеристики: только семь базовых, производные пересчитываются
    const stats = { ...choice.stats } as unknown as StatBlock
    delete stats.HP
    delete stats.MP
    s.player.stats = stats
    s.player.max_hp = derivedHP(stats)
    s.player.hp = s.player.max_hp
    s.player.max_mp = derivedMP(stats)
    s.player.mp = s.player.max_mp
    // навыки: итоговые значения с экрана (база + покупки + бонусы профессии)
    s.player.skills = { ...choice.skills }
    // снаряжение профессии
    for (const it of profession?.items ?? []) this.addItem(it.item, it.quantity, { silent: true })
    s.char_choice = JSON.parse(JSON.stringify(choice))
    this.pushLog(`${name || 'Герой'}: забег начинается.`)
  }

// ─────────────── производные опции B6: усталость, рассудок, репутация, достаток, страсти, причастность ───────────────

  /** максимум усталости: (STR+CON)×множитель; opt-in meta.vitals.fatigue */
function fatigueMax(this: EngineCtx): number {
    const cfg = this.campaign.meta.vitals?.fatigue
    if (!cfg) return 0
    const mult = cfg === true ? 1 : (cfg.multiplier ?? 1)
    return Math.max(0, Math.round((this.state.player.stats.STR + this.state.player.stats.CON) * mult))
  }

/** текущая усталость (полная по умолчанию, как удача) */
function fatigue(this: EngineCtx): number {
    const max = this.fatigueMax()
    return Math.min(max, this.state.player.fatigue ?? max)
  }

/** израсходовать/восстановить усталость; ложь — запаса не хватит */
function changeFatigue(this: EngineCtx, delta: number): boolean {
    const max = this.fatigueMax()
    if (max === 0 && delta !== 0) return true // система выключена — no-op
    const cur = this.fatigue()
    if (delta < 0 && cur + delta < 0) {
      this.state.player.fatigue = 0
      this.pushLog('Вы на пределе: очки усталости на нуле!')
      this.checkRules() // правила мастера могут среагировать на fatigue_le
      this.notify()
      return false
    }
    this.state.player.fatigue = Math.max(0, Math.min(max, cur + delta))
    this.checkRules()
    this.notify()
    return true
  }

/** максимум рассудка: POW×множитель; opt-in meta.vitals.sanity */
function sanityMax(this: EngineCtx): number {
    const cfg = this.campaign.meta.vitals?.sanity
    if (!cfg) return 0
    const mult = cfg === true ? 5 : (cfg.multiplier ?? 5)
    return Math.max(0, this.state.player.stats.POW * mult)
  }

/** текущий рассудок */
function sanity(this: EngineCtx): number {
    const max = this.sanityMax()
    return Math.min(max, this.state.player.sanity ?? max)
  }

/** потеря/исцеление рассудка; пороги/психозы — правилами на sanity_le */
function changeSanity(this: EngineCtx, delta: number): void {
    const max = this.sanityMax()
    if (max === 0 && delta !== 0) return
    const next = Math.max(0, Math.min(max, this.sanity() + delta))
    const lost = next - this.sanity()
    this.state.player.sanity = next
    if (lost < 0) this.pushLog(`Рассудок трещит: ${lost}. (сейчас ${next}/${max})`)
    else if (lost > 0) this.pushLog(`Мысли проясняются: рассудок +${lost}. (сейчас ${next}/${max})`)
    this.checkRules()
    this.notify()
  }

/**
   * Базовый шанс навыка (без обучения). Формула 'DEX×2' ('×' или '*'),
   * несколько слагаемых через '+': 'DEX×2+INT'.
   * Возвращает 0, если у навыка нет base (необученный даёт 0% — как раньше).
   */
function skillBaseChance(this: EngineCtx, skillId: string): number {
    const def = this.campaign.meta.skills?.find((s) => s.id === skillId)
    const base = def?.base
    if (base == null) return 0
    if (typeof base === 'number') return base
    const stats = this.state.player.stats as unknown as Record<string, number>
    let total = 0
    for (const part of base.split('+')) {
      const m = part.trim().match(/^([A-Z]+)(?:\s*[×x*]\s*(\d+))?$/)
      if (!m) continue
      const stat = stats[m[1]] ?? 0
      total += stat * (m[2] ? parseInt(m[2], 10) : 1)
    }
    return total
  }

/**
   * Эффективное значение навыка для проверок вне боя: изученный навык,
   * иначе базовый шанс (если у навыка задан `base` в реестре кампании).
   */
function skillEffective(this: EngineCtx, skillId: string): number {
    const learned = this.state.player.skills[skillId]
    return learned != null ? learned : this.skillBaseChance(skillId)
  }

/**
   * Тренировка характеристики (аудит B6): прибавка с клампом по stat_limits
   * кампании; пересчитывает производные пулы (HP/MP/усталость/рассудок).
   */
function trainStat(this: EngineCtx, stat: string, delta: number): void {
    const p = this.state.player
    const stats = p.stats as unknown as Record<string, number>
    if (!(stat in stats)) return
    const lim = this.campaign.meta.char_creation?.stat_limits
    const min = lim?.min ?? 1
    const max = lim?.max ?? 99
    const next = Math.max(min, Math.min(max, stats[stat] + delta))
    if (next === stats[stat]) return
    stats[stat] = next
    this.pushLog(`Тренировка дала плоды: ${this.statLabel(stat)} ${delta > 0 ? '+' : ''}${delta} → ${next}.`)
    // пересчёт HP (SIZ+CON)/MP (POW) теми же формулами, что на создании героя
    const newMaxHp = derivedHP(p.stats)
    if (newMaxHp !== p.max_hp) {
      const diff = newMaxHp - p.max_hp
      p.max_hp = newMaxHp
      p.hp = Math.max(1, Math.min(p.max_hp, p.hp + Math.max(0, diff)))
    }
    const newMaxMp = derivedMP(p.stats)
    if (newMaxMp !== p.max_mp) {
      const diff = newMaxMp - p.max_mp
      p.max_mp = newMaxMp
      p.mp = Math.max(0, Math.min(p.max_mp, p.mp + Math.max(0, diff)))
    }
    this.checkRules()
    this.notify()
  }

/** каноническое имя характеристики (всегда на латинице: STR, CON, SIZ, DEX, INT, POW, CHA, EDU) */
function statLabel(this: EngineCtx, stat: string): string {
    return stat.toUpperCase()
  }

// ─────────────── уровни и черты (аудит B8, opt-in meta.progression) ───────────────

  /** система уровней включена мастером */
function progressionEnabled(this: EngineCtx): boolean {
    return !!this.campaign.meta.progression
  }

/** текущий уровень (старт 1) */
function level(this: EngineCtx): number {
    return Math.max(1, this.state.player.level ?? 1)
  }

/** текущий запас опыта */
function xp(this: EngineCtx): number {
    return Math.max(0, this.state.player.xp ?? 0)
  }

/** сколько опыта нужно, чтобы взять следующий уровень (кумулятивно) */
function xpForLevel(this: EngineCtx, level: number): number {
    const base = this.campaign.meta.progression?.xp_per_level ?? 100
    // база×summing i=1..level: base при lvl1→2; растёт линейно
    return base * level
  }

/** опыт до следующего уровня или до потолка */
function xpToNext(this: EngineCtx): number | null {
    if (!this.progressionEnabled()) return null
    const max = this.campaign.meta.progression?.max_level
    if (max != null && this.level() >= max) return null
    return this.xpForLevel(this.level()) - this.xp()
  }

/** нераспределённых черт (по умолчанию по одной за уровень) */
function pendingFeats(this: EngineCtx): number {
    if (!this.progressionEnabled()) return 0
    const per = this.campaign.meta.progression?.feats_per_level ?? 1
    return Math.max(0, (this.level() - 1) * per - (this.state.player.feats ?? []).length)
  }

/** начислить опыт; при достижении порога — уровень ↑ (одна итерация) */
function grantXp(this: EngineCtx, points: number): void {
    if (!this.progressionEnabled() || points <= 0) return
    const p = this.state.player
    const cap = this.campaign.meta.progression?.max_level
    if (cap != null && this.level() >= cap) return // потолок: опыт не копится
    p.xp = this.xp() + points
    this.pushLog(`Опыт: +${points} (всего ${p.xp}, до след. уровня ${this.xpToNext() ?? 'потолок'}).`)
    // уровни поднимаем по одному за проход (линейный лад book-op)
    while (this.xp() >= this.xpForLevel(this.level())) {
      const max = this.campaign.meta.progression?.max_level
      if (max != null && this.level() >= max) break
      p.xp = this.xp() - this.xpForLevel(this.level())
      p.level = this.level() + 1
      const slots = this.campaign.meta.progression?.feats_per_level ?? 1
      this.pushLog(`Уровень ${p.level}!${slots > 0 ? ` Доступно ${slots} чёрт(а) к выбору в листе персонажа.` : ''}`)
      this.checkRules()
    }
    this.notify()
  }

/** дефолтного набора черт */
function availableFeats(this: EngineCtx): FeatDef[] {
    if (!this.progressionEnabled()) return []
    const taken = new Set(this.state.player.feats ?? [])
    return (this.campaign.meta.progression?.feats ?? []).filter((f) => !taken.has(f.id))
  }

/** доступна ли черта (условия requires) */
function featEligible(this: EngineCtx, feat: FeatDef): boolean {
    if (!feat.requires?.length) return true
    return feat.requires.every((c) => evalCondition(c, this))
  }

/** взять черту точкой прокачки (слоты расходуются) */
function takeFeat(this: EngineCtx, id: string): boolean {
    if (!this.progressionEnabled() || this.pendingFeats() <= 0) return false
    const feat = this.availableFeats().find((f: FeatDef) => f.id === id)
    if (!feat || !this.featEligible(feat)) return false
    applyFeat.call(this, feat)
    this.pushLog(`Взята черта «${feat.label}».`)
    this.notify()
    return true
  }

/** выдать черту напрямую (эффект grant_feat, без счёта слотов) */
function grantFeat(this: EngineCtx, id: string): void {
    if (!this.progressionEnabled()) return
    const feat = this.campaign.meta.progression?.feats?.find((f: FeatDef) => f.id === id)
    if (!feat || (this.state.player.feats ?? []).includes(id)) return
    applyFeat.call(this, feat)
    this.pushLog(`Освоена черта «${feat.label}».`)
    this.checkRules()
    this.notify()
  }

/** применение бонусов черты (уже взята) */
function applyFeat(this: EngineCtx, feat: FeatDef): void {
    const p = this.state.player
    p.feats ??= []
    p.feats.push(feat.id)
    const mods = feat.mods ?? {}
    for (const [skill, delta] of Object.entries(mods.skills ?? {})) {
      p.skills[skill] = Math.max(0, (p.skills[skill] ?? 0) + (delta as number))
    }
    for (const [stat, delta] of Object.entries(mods.stats ?? {})) {
      if (delta) this.trainStat(stat, delta as number)
    }
    if (mods.hp) {
      p.max_hp = Math.max(1, p.max_hp + mods.hp)
      p.hp = Math.min(p.max_hp, p.hp + mods.hp)
    }
    if (mods.mp) {
      p.max_mp = Math.max(0, p.max_mp + mods.mp)
      p.mp = Math.min(p.max_mp, p.mp + mods.mp)
    }
    // движение от черт — добавкой в список модификаторов movement()
    this.checkRules()
  }

/** движение героя: базовое + перманентные бонусы черт */
function playerMovement(this: EngineCtx): number {
    let mov = movement(this.state.player.stats)
    for (const fid of this.state.player.feats ?? []) {
      const f = this.campaign.meta.progression?.feats?.find((x) => x.id === fid)
      mov += f?.mods?.mov ?? 0
    }
    return Math.max(1, mov)
  }

// ─────────────── рост навыков (ТЗ 4.3) ───────────────
function markSkill(this: EngineCtx, skill: string): void {
    if (!featureOn(this.campaign.meta, 'skills')) return
    if (this.state.player.skills[skill] != null) this.state.player.skill_marks[skill] = true
  }

/** Проверка навыка игрока с «галочкой» опыта при успехе. */
function playerSkillCheck(this: EngineCtx, skill: string, difficulty: SkillDifficulty = 50): ReturnType<typeof skillCheck> {
    // навыки выключены профилем — проверка резолвится успехом без броска
    if (!featureOn(this.campaign.meta, 'skills')) {
      return { roll: 0, target: 100, result: 'success', success: true }
    }
    // необученный навык берёт базовый шанс (аудит B6, meta.skills[].base)
    const value = Math.max(0, this.skillEffective(skill) + this.statusSkillMod(skill))
    const out = skillCheck(value, this.rng, difficultyModifier(value, difficulty), this.diceRules)
    this.pushLog(
      `Проверка «${this.skillLabel(skill)}» (${difficultyLabel(difficulty)}) — d100=${out.roll} против ${out.target}: ${CHECK_RESULT_LABEL[out.result]}`,
    )
    if (out.success) this.markSkill(skill)
    return out
  }

/** Отдых: броски роста отмеченных навыков (d100 > навык → +1d6). */
  /** русское название навыка (реестр кампании → встроенный словарь → id) */
function skillLabel(this: EngineCtx, id: string): string {
    return sharedSkillLabel(id, this.campaign.meta.skills)
  }

function restAndGrow(this: EngineCtx): string[] {
    if (!featureOn(this.campaign.meta, 'skills')) return []
    const grown: string[] = []
    for (const skill of Object.keys(this.state.player.skill_marks)) {
      const cur = this.state.player.skills[skill] ?? 0
      const roll = this.rng.int(1, 100)
      if (roll > cur) {
        const gain = rollDice('1d6', this.rng)
        this.state.player.skills[skill] = cur + gain
        grown.push(`${this.skillLabel(skill)} +${gain} (${cur} → ${cur + gain})`)
        this.pushLog(`Навык «${this.skillLabel(skill)}» вырос на ${gain} (${cur} → ${cur + gain}).`)
      }
    }
    this.state.player.skill_marks = {}
    if (grown.length) {
      this.messages.push({ text: `Во сне приходит опыт. Рост навыков: ${grown.join(', ')}.` })
      playUi('skill_up')
    }
    return grown
  }

/** подготовка способности в слот магии (meta.magic.slots): true — получилось */
function togglePreparedAbility(this: EngineCtx, id: string): boolean {
    const s = this.state
    const slots = this.campaign.meta.magic?.slots
    if (!slots) return false
    const cur = new Set(s.player.prepared_abilities ?? [])
    if (cur.has(id)) cur.delete(id)
    else {
      if (cur.size >= slots) return false
      cur.add(id)
    }
    const arr = [...cur]
    s.player.prepared_abilities = arr
    if (!arr.length) delete s.player.prepared_abilities
    return true
  }

export const character = {
  applyCharCreation,
  fatigueMax,
  fatigue,
  changeFatigue,
  sanityMax,
  sanity,
  changeSanity,
  skillBaseChance,
  skillEffective,
  trainStat,
  statLabel,
  progressionEnabled,
  level,
  xp,
  xpForLevel,
  xpToNext,
  pendingFeats,
  grantXp,
  availableFeats,
  featEligible,
  takeFeat,
  grantFeat,
  applyFeat,
  playerMovement,
  markSkill,
  playerSkillCheck,
  skillLabel,
  restAndGrow,
  togglePreparedAbility,
}
