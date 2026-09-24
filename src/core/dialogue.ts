import { Compiler } from 'inkjs/full'
import type { Story } from 'inkjs'
import type { GameEngine } from './engine'
import type { NpcDef } from '../shared/types'
import { skillCheck } from './brp'

/**
 * Dialogue Engine — Ink runtime (ТЗ 4.5).
 * Исходники .ink компилируются при загрузке (inkjs full).
 * External functions пробрасываются в движок.
 */

export interface DialogueLine {
  text: string
  emotion: string
}

export interface DialogueUI {
  npc: NpcDef
  lines: DialogueLine[]
  choices: { index: number; text: string }[]
  finished: boolean
}

const storyCache = new Map<string, Story>()

export function compileDialogue(source: string, cacheKey: string): Story {
  const cached = storyCache.get(cacheKey)
  if (cached) return cached
  const story = new Compiler(source).Compile() as unknown as Story
  storyCache.set(cacheKey, story)
  return story
}

export function clearDialogueCache(): void {
  storyCache.clear()
}

export function bindExternals(story: Story, engine: GameEngine): void {
  const bind = (name: string, fn: (...args: never[]) => unknown) => {
    try {
      story.BindExternalFunction(name, fn as (...args: unknown[]) => unknown, false)
    } catch {
      /* уже привязана */
    }
  }

  bind('has_item', (id: string) => engine.hasItem(id))
  bind('item_count', (id: string) => engine.itemCount(id))
  bind('add_item', (id: string, n: number) => { engine.addItem(id, n); return 0 })
  bind('remove_item', (id: string, n: number) => { engine.removeItem(id, n); return 0 })
  bind('skill_check', (skill: string, difficulty: number) => {
    // порог = навык игрока; сложность смещает порог (50 — нейтральная)
    const value = engine.state.player.skills[skill] ?? 0
    const modifier = 50 - (difficulty ?? 50)
    const out = skillCheck(value, engine.rng, modifier)
    engine.pushLog(`Проверка «${skill}» (d100=${out.roll} против ${out.target}): ${out.result}`)
    return out.result
  })
  bind('get_need', (id: string) => engine.state.player.needs[id] ?? 0)
  bind('change_need', (id: string, delta: number) => { engine.changeNeed(id, delta); return 0 })
  bind('set_flag', (f: string) => { engine.state.flags[f] = true; return 0 })
  bind('get_flag', (f: string) => !!engine.state.flags[f])
  bind('get_stat', (s: string) => (engine.state.player.stats as unknown as Record<string, number>)[s] ?? 0)
  bind('get_skill', (s: string) => engine.state.player.skills[s] ?? 0)
  bind('get_hp', () => engine.state.player.hp)
  bind('change_hp', (d: number) => { engine.changeHp(d); return 0 })
  bind('advance_time', (ticks: number) => { engine.advanceTicks(ticks); return 0 })
  bind('fire_rule', (ruleId: string) => { engine.fireRule(ruleId); return 0 })
}

/** Прочитать все доступные строки до выбора/конца. */
export function drainStory(story: Story): { lines: DialogueLine[]; choices: { index: number; text: string }[]; finished: boolean } {
  const lines: DialogueLine[] = []
  while (story.canContinue) {
    const text = (story.Continue() ?? '').trim()
    const tags = story.currentTags ?? []
    let emotion = 'neutral'
    for (const t of tags) {
      const m = t.match(/^emotion:\s*(\w+)/)
      if (m) emotion = m[1]
    }
    if (text) lines.push({ text, emotion })
  }
  const choices = story.currentChoices.map((c, i) => ({ index: i, text: c.text }))
  return { lines, choices, finished: choices.length === 0 && !story.canContinue }
}
