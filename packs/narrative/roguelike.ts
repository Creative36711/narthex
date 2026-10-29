import type { EngineCtx } from '../../src/core/context'
import type { CampaignData } from '../../src/shared/types'
import { evalCondition } from '../../src/core/conditions'
import { removeSave } from '../../src/core/savemigrate'
import { meta } from '../../src/core/meta'

type EngineConstructor = new (campaign: CampaignData) => EngineCtx

// ─────────────── рогалик-луп ───────────────
function gameOver(this: EngineCtx, type: 'death' | 'victory', reason: string, force = false): void {
    if (this.debugInvincible && type === 'death' && !force) return
    if (this.state.game_over) return
    // концовки кампании: первая подходящая по исходу и условиям (мастер задаёт сам)
    const ending = (this.campaign.meta.endings ?? []).find(
      (en) =>
        (!en.on || en.on === type) &&
        (en.conditions ?? []).every((c) => evalCondition(c, this)),
    )
    this.state.game_over = { type, reason, ending: ending?.id }
    if (ending?.id) meta.rememberEnding.call(this, ending.id)
    meta.finalizeRunMeta.call(this, type === 'victory')
    // Финал всегда закрывает диалог (и при победе, и при гибели). Иначе
    // GameView держит DialogueOverlay поверх и не показывает EndScreen:
    // `game_over && !dialogue` — типичный путь fire_rule/tick_elapsed →
    // game_over_victory из ink оставлял story «висящей».
    this.dialogue = null
    this.dialogueTimer = null
    this.activeStory = null
    this.activeNpc = null
    this.trade = null
    // забег завершён в любом исходе — сейв стирается, «Продолжить» исчезает (фидбек №10)
    removeSave(this.campaign.meta.id)
    this.notify()
  }

/** Полный рестарт: новый seed (ТЗ 4.10). */
function restart(this: EngineCtx, Engine: EngineConstructor): EngineCtx {
    removeSave(this.campaign.meta.id)
    const fresh = new Engine(this.campaign)
    // выбор создания персонажа переживает перезапуск забега (блок 11 ТЗ)
    if (this.state.char_choice) {
      fresh.applyCharCreation({ ...this.state.char_choice, calling: this.state.char_choice.calling ?? '' })
    }
    fresh.start()
    return fresh
  }

/** New Game+ доступен? (мастер разрешил, забег завершён победой) */
function newGamePlusAvailable(this: EngineCtx): boolean {
    return !!this.campaign.meta.new_game_plus && this.state.game_over?.type === 'victory'
  }

/**
   * New Game+: победивший герой возвращается в новый забег с наследием
   * (keep мастера), круг +1 — множители сложности растут на boost-шаги.
   * Пермадет-семантика сохранена: NG+ только за победу.
   */
function newGamePlus(this: EngineCtx, Engine: EngineConstructor): EngineCtx | null {
    const cfg = this.campaign.meta.new_game_plus
    if (!this.newGamePlusAvailable() || !cfg) return null
    const prev = this.state
    removeSave(this.campaign.meta.id)
    const fresh = new Engine(this.campaign)
    if (prev.char_choice) {
      fresh.applyCharCreation({ ...prev.char_choice, calling: prev.char_choice.calling ?? '' })
    }
    fresh.start()
    const keep = new Set(cfg.keep ?? ['skills', 'skill_marks', 'stats', 'inventory', 'feats', 'prepared'])
    const pp = prev.player
    const np = fresh.state.player
    if (keep.has('skills')) np.skills = JSON.parse(JSON.stringify(pp.skills)) as typeof np.skills
    if (keep.has('skill_marks')) np.skill_marks = { ...pp.skill_marks }
    if (keep.has('stats')) {
      np.stats = { ...pp.stats }
      // базовые производные взяты из шаблона — подтянем к статам наследия
      np.max_hp = pp.max_hp
      np.max_mp = pp.max_mp
    }
    if (keep.has('inventory')) {
      np.inventory = JSON.parse(JSON.stringify(pp.inventory)) as typeof np.inventory
      np.equipment = { ...pp.equipment }
    }
    if (keep.has('feats')) {
      np.xp = pp.xp
      np.level = pp.level
      np.feats = pp.feats?.slice()
    }
    if (keep.has('prepared')) np.prepared_abilities = pp.prepared_abilities?.slice()
    // облик и сложность идентичны прошлому забегу
    np.portrait_choice = pp.portrait_choice && JSON.parse(JSON.stringify(pp.portrait_choice))
    np.difficulty = pp.difficulty
    np.hp = np.max_hp
    np.mp = np.max_mp
    fresh.state.ng_cycle = (prev.ng_cycle ?? 0) + 1
    return fresh
  }

export const roguelike = {
  gameOver,
  restart,
  newGamePlusAvailable,
  newGamePlus,
}
