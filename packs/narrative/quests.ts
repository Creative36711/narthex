import type { EngineCtx } from '../../src/core/context'
import { capabilityIsOff } from '../../src/core/caps'
import { evalCondition } from '../../src/core/conditions'
import { playUi } from '../../src/shared/audio'

export const quests = {
  // ─────────────── квесты (ТЗ 3.7) ───────────────
  startQuest(ctx: EngineCtx, questId: string): void {
    if (capabilityIsOff(ctx.campaign.meta, 'quests')) return
    const quest = ctx.campaign.quests[questId]
    if (!quest || ctx.state.quests[questId]) return
    const first = quest.stages[0]
    ctx.state.quests[questId] = { stage: first.id, status: 'active', journal: [] }
    ctx.pushLog(`Новый квест: «${quest.label}»`)
    ctx.messages.push({ text: `Новый квест: «${quest.label}»` })
    playUi('quest_started')
    if (first.on_enter_effects) ctx.applyEffects(first.on_enter_effects)
  },

  advanceQuestTo(ctx: EngineCtx, questId: string, stageId: string): void {
    if (capabilityIsOff(ctx.campaign.meta, 'quests')) return
    const quest = ctx.campaign.quests[questId]
    const qs = ctx.state.quests[questId]
    if (!quest || !qs || qs.status !== 'active' || qs.stage === stageId) return
    const stage = quest.stages.find((s) => s.id === stageId)
    if (!stage) return
    qs.stage = stageId
    if (stage.final) {
      qs.status = stage.outcome === 'failure' ? 'failed' : 'completed'
      if (qs.status === 'completed') {
        ctx.state.stats_run.quests_completed += 1
        ctx.messages.push({ text: `Квест завершён: «${quest.label}»` })
        playUi('quest_completed')
      } else {
        ctx.messages.push({ text: `Квест провален: «${quest.label}»` })
      }
      ctx.pushLog(`Квест «${quest.label}»: ${qs.status === 'completed' ? 'завершён' : 'провален'}.`)
    }
    if (stage.on_enter_effects) ctx.applyEffects(stage.on_enter_effects)
  },

  journalUpdate(ctx: EngineCtx, questId: string, textKey: string): void {
    if (capabilityIsOff(ctx.campaign.meta, 'quests')) return
    const quest = ctx.campaign.quests[questId]
    const qs = ctx.state.quests[questId]
    if (!quest || !qs) return
    const text = quest.journal_entries[textKey]
    if (text && !qs.journal.includes(text)) {
      qs.journal.push(text)
      ctx.pushLog(`Журнал: ${text}`)
    }
  },

  /** Переходы стадий активных квестов (вызывается из checkRules). */
  checkQuestTransitions(ctx: EngineCtx): void {
    if (capabilityIsOff(ctx.campaign.meta, 'quests')) return
    for (const [questId, qs] of Object.entries(ctx.state.quests)) {
      if (qs.status !== 'active') continue
      const quest = ctx.campaign.quests[questId]
      const stage = quest?.stages.find((s) => s.id === qs.stage)
      if (!stage?.transitions) continue
      for (const t of stage.transitions) {
        if ((t.conditions ?? []).every((c) => evalCondition(c, ctx))) {
          ctx.advanceQuestTo(questId, t.to)
          break
        }
      }
    }
  },
}
