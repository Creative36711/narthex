import type { EngineCtx } from './context'
import type { ItemDef, NpcDef } from '../shared/types'
import type { Story } from 'inkjs'
import { bindExternals, createStory, drainStory, firstInkKnot } from './dialogue'
import { playInteraction, playUi } from '../shared/audio'
import { stopVoiceAudio } from '../shared/voiceAudio'

/** подпись спикера реплики в истории диалога: явный # speaker — его имя, иначе собеседник */
function dlgSpeakerLabel(this: EngineCtx, line: { speaker?: string }, npc: NpcDef): string {
    if (!line.speaker) return npc.label
    const ent = this.campaign.entities[line.speaker] as NpcDef | undefined
    return ent?.label ?? npc.label
  }

// ─────────────── таймер выбора в диалоге ───────────────

  /**
   * Ink-вызов `~ set_dialogue_timer(секунды, "узел")`: сколько секунд игрок
   * может думать над ответами и куда уйти, если он промолчал. Пустой узел —
   * по истечении разговор заканчивается. `0` снимает таймер.
   * Действует, только если на узле есть варианты ответа.
   */
function setDialogueTimer(this: EngineCtx, seconds: number, knot?: string): void {
    const s = Math.floor(Number(seconds) || 0)
    this.pendingDialogueTimer = s > 0 ? { seconds: s, knot: knot ? String(knot) : undefined } : null
  }

/**
   * Зафиксировать таймер, объявленный ink-ом в этом проходе: он живёт, пока
   * игроку показаны варианты ответа. Без вариантов таймер снимается, а
   * забытый ink-ом таймер не «переезжает» на следующую реплику.
   */
function commitDialogueTimer(this: EngineCtx, _choices?: number): void {
    const next = this.pendingDialogueTimer
    this.pendingDialogueTimer = null
    this.dialogueTimer = next ? next : null
  }

/** Истёк таймер: уходим в назначенный узел или заканчиваем разговор. */
function dialogueTimeout(this: EngineCtx): void {
    const t = this.dialogueTimer
    const story = this.activeStory
    this.dialogueTimer = null
    if (!t || !story || !this.dialogue) return
    if (!t.knot) {
      this.pushLog('Разговор оборвался: вы слишком долго молчали.')
      this.endDialogue()
      return
    }
    try {
      story.ChoosePathString(t.knot)
    } catch {
      this.pushLog(`Узел «${t.knot}» для таймера не найден — разговор заканчивается.`)
      this.endDialogue()
      return
    }
    this.pushLog('Вы слишком долго молчали — собеседник перевёл разговор на своё.')
    const drained = drainStory(story)
    for (const l of drained.lines) {
      this.dialogueHistory.push({
        speaker: l.action ? '' : dlgSpeakerLabel.call(this, l, this.dialogue.npc),
        text: l.text,
        emotion: l.emotion,
        action: l.action,
      })
    }
    if (this.combat || this.trade || this.craftRequest || this.state.game_over || !this.activeStory) {
      this.dialogue = null
      this.dialogueHistory = []
      this.activeStory = null
      this.activeNpc = null
      this.notify()
      return
    }
    this.dialogue = {
      npc: this.dialogue.npc,
      lines: drained.lines,
      choices: drained.choices,
      finished: drained.finished,
      history: [...this.dialogueHistory],
    }
    commitDialogueTimer.call(this, drained.choices.length)
    commitDialoguePresenting.call(this)
    this.dialogue.timer = this.dialogueTimer ?? undefined
    this.notify()
  }

// ─────────────── предъявление предмета в диалоге ───────────────

  /**
   * Ink-вызов `~ present_item("ok_knot", "fail_knot", "required_item")`:
   * предлагает игроку выбрать предмет из инвентаря для предъявления собеседнику.
   */
function promptPresentItem(this: EngineCtx, okKnot: string, failKnot: string, required?: string): void {
    this.pendingDialoguePresenting = { ok: okKnot, fail: failKnot, required: required || undefined }
  }

function commitDialoguePresenting(this: EngineCtx): void {
    const next = this.pendingDialoguePresenting
    this.pendingDialoguePresenting = null
    if (this.dialogue) {
      this.dialogue.presenting = next ? next : undefined
    }
  }

/**
   * Игрок выбрал предмет для предъявления (или отменил выбор: itemId === null).
   */
function submitPresentedItem(this: EngineCtx, itemId: string | null): void {
    const pres = this.dialogue?.presenting
    const story = this.activeStory
    if (!pres || !story || !this.dialogue) return
    this.dialogue.presenting = undefined
    if (itemId) {
      playUi('dialogue_present')
      const itDef = this.campaign.entities[itemId] as ItemDef | undefined
      this.dialogueHistory.push({
        speaker: this.state.player.name || 'Вы',
        text: `[Предъявлено: ${itDef?.label || itemId}]`,
        isChoice: true,
      })
    } else {
      playUi('click')
      this.dialogueHistory.push({
        speaker: this.state.player.name || 'Вы',
        text: '[Ничего не предъявлено]',
        isChoice: true,
      })
    }
    const success = itemId ? (!pres.required || pres.required === itemId) : false
    const targetKnot = success ? pres.ok : pres.fail
    try {
      story.ChoosePathString(targetKnot)
    } catch {
      this.pushLog(`Узел «${targetKnot}» для результата предъявления не найден.`)
      this.endDialogue()
      return
    }
    const drained = drainStory(story)
    for (const l of drained.lines) {
      this.dialogueHistory.push({
        speaker: l.action ? '' : dlgSpeakerLabel.call(this, l, this.dialogue.npc),
        text: l.text,
        emotion: l.emotion,
        action: l.action,
      })
    }
    if (this.combat || this.trade || this.craftRequest || this.state.game_over || !this.activeStory) {
      this.dialogue = null
      this.dialogueHistory = []
      this.activeStory = null
      this.activeNpc = null
      this.notify()
      return
    }
    this.dialogue = {
      npc: this.dialogue.npc,
      lines: drained.lines,
      choices: drained.choices,
      finished: drained.finished,
      history: [...this.dialogueHistory],
    }
    commitDialogueTimer.call(this, drained.choices.length)
    commitDialoguePresenting.call(this)
    this.dialogue.timer = this.dialogueTimer ?? undefined
    this.notify()
  }

// ─────────────── диалоги ───────────────

  /**
   * Найти ink-исходник диалога по ссылке NPC. Канон пакета —
   * `dialogues/<id>.ink`; монолит до repair и ручные правки часто держат
   * голый id (`dlg_orion`). Без фолбэков диалог «молча не открывался».
   */
function resolveDialogueSource(this: EngineCtx, ref: string): { key: string; source: string } | null {
    const map = this.campaign.dialogues
    if (!ref) return null
    if (map[ref]) return { key: ref, source: map[ref]! }
    const bare = ref.replace(/^dialogues\//, '').replace(/\.(dlg\.json|ink|json)$/i, '')
    const candidates = [
      `dialogues/${bare}.ink`,
      bare,
      `${bare}.ink`,
      `dialogues/${bare}`,
    ]
    for (const k of candidates) {
      if (map[k]) return { key: k, source: map[k]! }
    }
    // последний шанс: суффикс/окончание ключа
    for (const [k, src] of Object.entries(map)) {
      if (k === bare || k.endsWith(`/${bare}.ink`) || k.endsWith(`/${bare}`)) {
        return { key: k, source: src }
      }
    }
    return null
  }

function startDialogue(this: EngineCtx, entityId: string, knot?: string): void {
    stopVoiceAudio()
    let npc = this.campaign.entities[entityId] as NpcDef | undefined
    if (!npc || npc.type !== 'npc') {
      npc = Object.values(this.campaign.entities).find((e): e is NpcDef => e.type === 'npc' && (e.dialogue === entityId || e.dialogue === `${entityId}.ink`))
    }
    if (!npc || npc.type !== 'npc' || !npc.dialogue) return
    const resolved = this.resolveDialogueSource(npc.dialogue)
    if (!resolved) return
    const { key: dialogueKey, source } = resolved
    playInteraction('talk', { entity: npc })
    // Каждый разговор — свежая Story (компиляция кэширована в dialogue.ts):
    // однократные `*`-ветки исчезают до конца разговора и возвращаются в новом,
    // а «навсегда» вещи хранятся только во флагах. (фидбек №3)
    let story: Story
    this.lastDialogueError = null
    try {
      story = createStory(source, dialogueKey)
    } catch (err) {
      // битый ink не должен валить весь рантайм: сообщение мастеру/игроку и выход
      const msg = err instanceof Error ? err.message : String(err)
      this.lastDialogueError = msg
      this.pushLog(`Диалог «${dialogueKey}» не скомпилировался.`)
      this.messages.push({ text: `Диалог недоступен (${npc.label}).` })
      console.error(msg)
      this.notify()
      return
    }
    bindExternals(story, this)
    // Точка входа: явный knot → «main» (канон редактора) → первый knot файла.
    // ИИ/ручные dlg.json часто зовут стартовый узел n_start — без фолбэка
    // ChoosePathString молча проваливался и диалог «не открывался».
    const entryKnot = knot ?? 'main'
    try {
      story.ChoosePathString(entryKnot)
    } catch {
      const fallback = firstInkKnot(source)
      if (fallback && fallback !== entryKnot) {
        try {
          story.ChoosePathString(fallback)
        } catch {
          this.lastDialogueError = `Стартовый узел «${fallback}» не найден в диалоге «${dialogueKey}».`
          return
        }
      } else if (!story.canContinue) {
        this.lastDialogueError = `Узел «${entryKnot}» не найден в диалоге «${dialogueKey}».`
        return
      }
    }
    this.activeStory = story
    this.activeNpc = npc
    this.state.stats_run.dialogues += 1
    this.dialogueHistory = []
    const drained = drainStory(story)
    for (const l of drained.lines) {
      this.dialogueHistory.push({
        speaker: l.action ? '' : dlgSpeakerLabel.call(this, l, npc),
        text: l.text,
        emotion: l.emotion,
        action: l.action,
      })
    }
    if (this.combat || this.trade || this.state.game_over || !this.activeStory) {
      // external в первой же реплике: бой / торговля / финал — окна диалога нет
      this.dialogue = null
      this.dialogueHistory = []
      this.activeStory = null
      this.activeNpc = null
    } else {
      this.dialogue = {
        npc,
        lines: drained.lines,
        choices: drained.choices,
        finished: drained.finished,
        history: [...this.dialogueHistory],
      }
      commitDialogueTimer.call(this, drained.choices.length)
      commitDialoguePresenting.call(this)
      this.dialogue.timer = this.dialogueTimer ?? undefined
    }
    this.notify()
  }

function chooseDialogueOption(this: EngineCtx, index: number): void {
    const story = this.activeStory
    const npc = this.activeNpc
    if (!story || !npc) return
    const chosenChoice = story.currentChoices[index]?.text
    if (chosenChoice) {
      this.dialogueHistory.push({
        speaker: this.state.player.name || 'Вы',
        text: chosenChoice,
        isChoice: true,
      })
    }
    story.ChooseChoiceIndex(index)
    const drained = drainStory(story)
    for (const l of drained.lines) {
      this.dialogueHistory.push({
        speaker: l.action ? '' : dlgSpeakerLabel.call(this, l, npc),
        text: l.text,
        emotion: l.emotion,
        action: l.action,
      })
    }
    // external мог закрыть забег/открыть бой/торговлю (game_over чистит
    // activeStory — но drainStory уже отработал). Не восстанавливаем окно.
    if (this.combat || this.trade || this.state.game_over || !this.activeStory) {
      this.dialogue = null
      this.dialogueHistory = []
      this.activeStory = null
      this.activeNpc = null
      this.notify()
      return
    }
    this.dialogue = {
      npc,
      lines: drained.lines,
      choices: drained.choices,
      finished: drained.finished,
      history: [...this.dialogueHistory],
    }
    commitDialogueTimer.call(this, drained.choices.length)
    commitDialoguePresenting.call(this)
    this.dialogue.timer = this.dialogueTimer ?? undefined
    this.checkRules()
    // правило на checkRules тоже могло вызвать game_over
    if (this.state.game_over) {
      this.dialogue = null
      this.dialogueHistory = []
      this.activeStory = null
      this.activeNpc = null
    }
    this.notify()
  }

function endDialogue(this: EngineCtx): void {
    stopVoiceAudio()
    this.dialogueTimer = null
    this.pendingDialoguePresenting = null
    this.dialogue = null
    this.dialogueHistory = []
    this.activeStory = null
    this.activeNpc = null
    this.checkRules()
    this.autosave()
    this.notify()
  }

export const dialogueRuntime = {
  dlgSpeakerLabel,
  setDialogueTimer,
  commitDialogueTimer,
  dialogueTimeout,
  promptPresentItem,
  commitDialoguePresenting,
  submitPresentedItem,
  resolveDialogueSource,
  startDialogue,
  chooseDialogueOption,
  endDialogue,
}
