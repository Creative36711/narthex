import type { EngineCtx } from './context'
import type { Effect, RuleDef } from '../shared/types'
import { featureOn } from './caps'
import { evalCondition } from './conditions'
import { skillCheck, CHECK_RESULT_LABEL, difficultyModifier } from './brp'
import { playInteraction, stopSound } from '../shared/audio'
import { packOperations } from './pack/host'

/**
 * Глубина вложенных вызовов правил (эффект fire_rule). Больше двух — стоп:
 * иначе «правило вызывает правило вызывает правило» зациклит забег. Прямые и
 * транзитивные петли ловит «Проверить кампанию» (см. store.validateContent).
 */
const FIRE_RULE_MAX_DEPTH = 2

function runLocationRules(this: EngineCtx, locationId: string): void {
    const loc = this.findLocation(locationId)?.location
    if (!loc?.on_enter_rules) return
    for (const ruleId of loc.on_enter_rules) {
      this.tryFireRule(ruleId)
    }
  }

function rulesInManifestOrder(this: EngineCtx): RuleDef[] {
  const order = this.campaign.ruleOrder
  if (!order) return Object.values(this.campaign.rules)

  const ordered: RuleDef[] = []
  const included = new Set<string>()
  for (const id of order) {
    const rule = this.campaign.rules[id]
    if (rule) {
      ordered.push(rule)
      included.add(id)
    }
  }
  // Retain rules added after loading, without letting integer-like IDs disturb manifest order.
  for (const rule of Object.values(this.campaign.rules)) {
    if (!included.has(rule.id)) ordered.push(rule)
  }
  return ordered
}

function checkRules(this: EngineCtx): void {
    for (const rule of rulesInManifestOrder.call(this)) {
      if (rule.manual) continue
      if (rule.trigger && rule.trigger !== 'always') continue
      this.tryFireRule(rule.id)
    }
    packOperations.invoke(this, 'checkQuestTransitions')
  }

function fireTrigger(this: EngineCtx, trigger: 'enter_scene' | 'leave_scene' | 'interact' | 'time_tick', _context?: { sceneId?: string; entityId?: string }): boolean {
    let anyFired = false
    for (const rule of rulesInManifestOrder.call(this)) {
      if (rule.manual) continue
      if (rule.trigger !== trigger) continue
      if (this.tryFireRule(rule.id)) {
        anyFired = true
      }
    }
    return anyFired
  }

function ruleConditionsOk(this: EngineCtx, rule: RuleDef): boolean {
    if (!(rule.conditions ?? []).every((c) => evalCondition(c, this))) return false
    const groups = rule.conditions_any
    if (!groups || groups.length === 0) return true
    return groups.some((g) => !g.length || g.every((c) => evalCondition(c, this)))
  }

function tryFireRule(this: EngineCtx, ruleId: string, depth = 0): boolean {
    const rule = this.campaign.rules[ruleId]
    if (!rule) return false
    if (rule.once && this.state.fired_rules.includes(rule.id)) return false
    if (!effects.ruleConditionsOk.call(this, rule)) return false
    this.state.fired_rules.push(rule.id)
    this.applyEffects(rule.effects ?? [], depth)
    return true
  }

function applyEffects(this: EngineCtx, effects: Effect[], depth = 0): void {
    for (const e of effects) this.applyEffect(e, depth)
  }

function applyEffect(this: EngineCtx, e: Effect, depth = 0): void {
    const packOperation = `effect:${e.type}`
    if (packOperations.has(packOperation)) {
      packOperations.invoke(this, packOperation, e, depth)
      this.checkAchievements()
      return
    }
    const s = this.state
    switch (e.type) {
      case 'fire_rule':
        if (depth >= FIRE_RULE_MAX_DEPTH) {
          this.pushLog('Правило не вызвано: превышена глубина цепочки вызовов.')
          break
        }
        this.tryFireRule(e.rule, depth + 1)
        break
      case 'unlock_recipe':
        this.unlockRecipe(e.recipe)
        break
      case 'open_craft':
        this.openCraft(e.recipe || undefined)
        break
      case 'set_entity_state': {
        const m = (s.entity_states ??= {})
        if (e.state) m[e.entity] = e.state
        else delete m[e.entity]
        this.notify()
        break
      }
      case 'learn_name':
        this.learnNpcName(e.entity, e.silent)
        break
      case 'set_flag':
        if (e.value === false || e.value === 0 || e.value === 'false') {
          delete s.flags[e.flag]
        } else {
          s.flags[e.flag] = (e.value as any) ?? true
        }
        break
      case 'set_description':
        this.setEntityDescription(e.entity, e.text)
        break
      case 'clear_flag': delete s.flags[e.flag]; break
      case 'apply_status': this.applyStatus(e.target, e.status, e.duration); break
      case 'remove_status': this.removeStatus(e.target, e.status); break
      case 'set_weather': {
        const next = e.weather || undefined
        if (s.weather !== next) {
          s.weather = next
          const w = this.campaign.meta.weathers?.find((x) => x.id === next)
          this.pushLog(next ? `Погода меняется: ${w?.label ?? next}.` : 'Небо проясняется.')
        }
        break
      }
      case 'unlock_codex': this.unlockCodex(e.entry); break
      case 'set_variable': s.variables[e.var] = e.value; break
      case 'change_variable':
        s.variables[e.var] = Number(s.variables[e.var] ?? 0) + e.delta
        break
      case 'start_duration_action': {
        // dz.20: без ticks — открывается окно выбора длительности; с ticks — действие идёт сразу
        this.requestDurationAction(e.action, e.ticks ?? null)
        break
      }
      case 'start_combat':
        this.startCombat(e)
        break
      case 'teleport_player': {
        const target = this.findLocation(e.location)
        if (target) {
          s.region = target.region.id
          s.location = e.location
          s.scene = e.scene ?? this.arrivalSceneOf(target.location) ?? s.scene
        }
        break
      }
      case 'change_scene_state':
        // состояние сцены управляется флагами; хелпер ставит флаг вида scene_state:<scene>
        s.flags[`scene_state:${e.scene}:${e.state}`] = true
        break
      case 'add_item': this.addItem(e.item, e.quantity ?? 1); break
      case 'remove_item': this.removeItem(e.item, e.quantity ?? 1); break
      case 'change_need': this.changeNeed(e.need, e.delta); break
      case 'change_hp': this.changeHp(e.delta); break
      case 'change_companion_need': this.changeCompanionNeed(e.entity, e.need, e.delta); break
      // сюжетный эффект мастера: quest_item-ограничение не применяется — мастер решает сам
      case 'transfer_to_companion': this.giveItemToCompanion(e.entity, e.item, e.quantity ?? 1, { forceQuest: true }); break
      case 'change_skill': {
        if (!featureOn(this.campaign.meta, 'skills')) break
        const cur = s.player.skills[e.skill] ?? 0
        s.player.skills[e.skill] = Math.max(0, cur + e.delta)
        this.pushLog(`Навык «${e.skill}»: ${e.delta > 0 ? '+' : ''}${e.delta} (теперь ${s.player.skills[e.skill]}).`)
        break
      }
      case 'skill_check_gate': {
        const out = this.playerSkillCheck(e.skill, e.difficulty)
        const retry = () => this.playerSkillCheck(e.skill, e.difficulty)
        const deferred = this.applyByCheck(
          out,
          `Проверка «${this.skillLabel(e.skill)}»`,
          retry,
          () => {
            this.markSkill(e.skill)
            this.applyEffects(e.success_effects)
          },
          () => this.applyEffects(e.fail_effects),
        )
        // с luckOffer эффекты применит resolveLuckOffer
        void deferred
        break
      }
      case 'stat_check': {
        const mult = e.multiplier ?? 5
        const aug = this.augmentBonus(e)
        const modifier = (e.modifier ?? 0) + aug
        const out = this.statCheck(e.stat, mult, modifier)
        this.applyByCheck(
          out,
          `Проверка характеристики ${e.stat}×${mult}`,
          () => this.statCheck(e.stat, mult, modifier),
          () => this.applyEffects(e.success_effects),
          () => this.applyEffects(e.fail_effects),
        )
        break
      }
      case 'group_stat_check': {
        // групповая сцепленная проверка (аудит §5.6): герой + до N союзников партии
        const bySkill = (e.mode ?? (e.stat ? 'stat' : 'skill')) === 'skill'
        const helpersN = Math.max(0, e.helpers ?? 2)
        const companions = this.state.party.slice(0, helpersN)
        const total = 1 + companions.length
        const need = Math.max(1, e.need ?? Math.ceil(total / 2))
        let wins = 0
        const whatLabel = bySkill
          ? `Групповая проверка «${this.skillLabel(e.skill!)}»`
          : `Групповая проверка ${e.stat}×${e.multiplier ?? 5}`
        this.pushLog(`${whatLabel} — цепочка из ${total} чел., нужно успешных: ${need}.`)
        // герой
        if (bySkill) {
          const out = this.playerSkillCheck(e.skill!, e.difficulty ?? 50)
          if (out.success) wins++
        } else {
          const out = this.statCheck(e.stat!, e.multiplier ?? 5, e.modifier ?? 0)
          if (out.success) wins++
        }
        // союзники — их собственными значениями
        const mult = e.multiplier ?? 5
        for (const c of companions) {
          const def = this.campaign.entities[c.entity]
          if (!def || def.type !== 'npc') continue
          const value = bySkill
            ? (def.skills?.[e.skill!] ?? 0)
            : (((def.stats as unknown as Record<string, number>)[e.stat!] ?? 0) * mult)
          const out = skillCheck(
            Math.max(1, value),
            this.rng,
            bySkill ? difficultyModifier(value, e.difficulty ?? 50) : (e.modifier ?? 0),
            this.diceRules,
          )
          this.pushLog(`${def.label}: d100=${out.roll} против ${out.target} → ${CHECK_RESULT_LABEL[out.result]}`)
          if (out.success) wins++
        }
        if (wins >= need) {
          this.pushLog(`Цепочка выдержала: ${wins} из ${total} успешно.`)
          this.applyEffects(e.success_effects)
        } else {
          this.pushLog(`Цепочка порвалась: ${wins} из ${total} успешно (нужно ${need}).`)
          this.applyEffects(e.fail_effects)
        }
        break
      }
      case 'opposed_check': {
        const res = this.opposedCheck(e)
        const finalize = (r: { success: boolean }) => {
          if (r.success) this.markSkill(e.skill)
          this.applyEffects(r.success ? e.success_effects : e.fail_effects)
        }
        if (res.success) {
          finalize(res)
          break
        }
        const cfg = this.campaign.meta.luck
        const cost = Math.max(1, cfg?.reroll_cost ?? 1)
        if (!cfg || this.luckMax() <= 0 || this.luck() < cost) {
          finalize(res)
          break
        }
        this.changeLuck(-cost)
        this.pushLog(`Поражение можно оспорить за удачу: −${cost} (осталось ${this.luck()}).`)
        this.luckOffer = {
          text: `Противоборство «${this.skillLabel(e.skill)}» — поражение героя.`,
          cost,
          decide: (reroll: boolean) => {
            if (reroll) finalize(this.opposedCheck(e))
            else {
              this.pushLog('Удача прибережена — остаётся поражение.')
              finalize(res)
            }
            this.checkRules()
            this.autosave()
          },
        }
        break
      }
      case 'change_luck': this.changeLuck(e.delta); break
      case 'change_fatigue': this.changeFatigue(e.delta); break
      case 'change_sanity': this.changeSanity(e.delta); break
      case 'change_reputation': this.changeReputation(e.delta); break
      case 'change_wealth': this.changeWealth(e.levels); break
      case 'change_passion': this.changePassion(e.id, e.delta ?? (e.set != null ? e.set - (this.state.player.passions?.[e.id] ?? 0) : 0)); break
      case 'change_allegiance': this.changeAllegiance(e.id, e.points); break
      case 'train_stat': this.trainStat(e.stat, e.delta); break
      case 'hazard_fall': this.applyFall(e.meters, e.skill); break
      case 'commit_crime': this.commitCrime(e.id, e.bounty); break
      case 'set_price_event': this.setPriceEvent(e.id, true); break
      case 'clear_price_event': this.setPriceEvent(e.id ?? '', false); break
      case 'banner': this.showBanner(e); break
      case 'postcard':
        this.showPostcard(e)
        break
      case 'grant_xp': this.grantXp(e.points); break
      case 'grant_feat': this.grantFeat(e.id); break
      case 'meta_currency': this.grantMetaCurrency(e.id, e.amount); break
      case 'roll_event_table': this.rollEventTable(e.table, { forced: true, ignoreFilters: e.ignore_filters }); break
      case 'play_sound': playInteraction(e.sound, { sound: e.sound }, e.volume ?? 1); break
      case 'stop_sound': stopSound(e.sound); break
      case 'override_music': this.setMusicOverride(e.tracks, e.fade); break
      case 'clear_music_override': this.clearMusicOverride(); break
      case 'generate_variables': {
        for (const p of e.pack) {
          const val = this.genValue(e.generator, p.key, e.seed)
          s.variables[p.as ?? p.key] = val
        }
        this.pushLog('Мир что-то замышляет…')
        break
      }
      case 'change_disposition': this.changeDisposition(e.target, e.delta); break
      case 'start_quest': this.startQuest(e.quest); break
      case 'advance_quest': this.advanceQuestTo(e.quest, e.stage); break
      case 'journal_update': this.journalUpdate(e.quest, e.text_key); break
      case 'give_reward':
        for (const it of e.items ?? []) this.addItem(it.item, it.quantity)
        break
      case 'join_party': this.joinParty(e.entity); break
      case 'leave_party': this.leaveParty(e.entity); break
      case 'block_path':
        if (!s.blocked_paths.includes(`${e.from}->${e.to}`)) s.blocked_paths.push(`${e.from}->${e.to}`)
        break
      case 'unblock_path': {
        const i = s.blocked_paths.indexOf(`${e.from}->${e.to}`)
        if (i >= 0) s.blocked_paths.splice(i, 1)
        break
      }
      case 'show_message': {
        const msgText = this.fmt(e.text)
        // Не добавляем дублирующиеся сообщения (защита от спама ИИ-кампаний)
        // и ограничиваем очередь сообщений, чтобы не забивать UI
        if (!this.messages.some((m: { text: string; portrait?: string }) => m.text === msgText) && this.messages.length < 5) {
          this.messages.push({ text: msgText, portrait: e.portrait })
        }
        break
      }
      case 'reveal_location':
        if (!s.revealed_locations.includes(e.location)) s.revealed_locations.push(e.location)
        break
      case 'advance_time': this.advanceTicks(e.ticks); break
      case 'start_pursuit': {
        // преследование героя: периодические цепочные проверки маскировки
        s.pursuit = {
          label: e.label,
          skill: e.skill ?? 'stealth',
          every: Math.max(1, e.every_ticks ?? 4),
          fails_needed: Math.max(1, e.fails_to_catch ?? 1),
          fails: 0,
          left: Math.max(1, e.every_ticks ?? 4),
          on_fail: e.on_fail,
        }
        this.pushLog(`За вами следом идут${e.label ? ` — ${e.label}` : ''}! Удерживайте маскировку, пока не оторвётесь.`)
        break
      }
      case 'stop_pursuit': {
        if (s.pursuit) {
          delete s.pursuit
          this.pushLog('Погоня осталась позади.')
        }
        break
      }
      case 'remove_entity':
        if (!s.removed_entities.includes(e.entity)) s.removed_entities.push(e.entity)
        break
      case 'spawn_entity':
        s.spawned.push({ entity: e.entity, scene: e.scene, slot: e.slot })
        break
      case 'game_over_victory':
        this.gameOver('victory', 'Кампания пройдена!')
        break
      case 'game_over_death':
        this.gameOver('death', e.reason ?? 'Вы погибли.')
        break
      case 'play_cutscene':
        this.playCutscene(e.cutscene)
        break
    }
    // эффект мог выполнить условия достижений (флаги, предметы, переменные)
    this.checkAchievements()
  }

function fireRule(this: EngineCtx, ruleId: string): void {
    this.tryFireRule(ruleId)
  }

export const effects = {
  runLocationRules,
  checkRules,
  fireTrigger,
  ruleConditionsOk,
  tryFireRule,
  applyEffects,
  applyEffect,
  fireRule,
}
