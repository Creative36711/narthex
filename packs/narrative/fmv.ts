import type { DeepReadonly, PackDrawCommand } from '../../src/core/pack/host'
import type {
  NarrativeChoice,
  NarrativeContent,
  NarrativeFrame,
  NarrativeState,
} from './types'

export interface FmvSubtitle {
  start_ms: number
  end_ms: number
  text: string
}

export interface FmvChoice extends NarrativeChoice {
  id: string
  next: string
}

export interface FmvFragment {
  id: string
  src: string
  poster: string
  duration_ms: number
  subtitles: FmvSubtitle[]
  choices?: FmvChoice[]
}

export interface FmvDocument {
  version: 1
  id: string
  start: string
  fragments: FmvFragment[]
}

export type FmvErrorCode = 'FMV_OFFLINE' | 'FMV_LOAD_ERROR' | 'FMV_HTTP_ERROR'

export interface FmvError {
  code: FmvErrorCode
  message: string
  fragment: string
}

export interface FmvTransition {
  from: string
  to: string
  choice: string
  choiceIndex: number
  readyNext: true
}

export interface FmvState {
  scene: string
  fragment: string
  phase: 'loading' | 'playing' | 'choice' | 'buffering' | 'ended' | 'error'
  ready: string[]
  pendingChoice: number | null
  presentation: number
  lastTransition: FmvTransition | null
  error: FmvError | null
}

export type FmvEvent =
  | { type: 'start_fmv'; scene: string }
  | { type: 'fmv_ready'; scene: string; fragment: string }
  | { type: 'fmv_ended'; scene: string; fragment: string }
  | {
      type: 'fmv_error'
      scene: string
      fragment: string
      code: FmvErrorCode
      message: string
    }

export type FmvWorkingState = NarrativeState & { content: NarrativeContent }
export type FmvChoiceApplier = (
  state: FmvWorkingState,
  owner: string,
  node: string,
  choices: readonly NarrativeChoice[],
  index: number,
) => NarrativeChoice

export function copyFmvState(state: DeepReadonly<FmvState>): FmvState {
  return {
    ...state,
    ready: [...state.ready],
    lastTransition: state.lastTransition ? { ...state.lastTransition } : null,
    error: state.error ? { ...state.error } : null,
  }
}

function documentFor(content: NarrativeContent, sceneId: string): FmvDocument {
  const document = content.fmv?.[sceneId]
  if (!document) throw new Error(`Unknown FMV scene ${sceneId}`)
  return document
}

function fragmentFor(document: FmvDocument, fragmentId: string): FmvFragment {
  const fragment = document.fragments.find((candidate) => candidate.id === fragmentId)
  if (!fragment) throw new Error(`Unknown FMV fragment ${document.id}/${fragmentId}`)
  return fragment
}

export function startFmv(state: FmvWorkingState, content: NarrativeContent, sceneId: string): void {
  const document = documentFor(content, sceneId)
  fragmentFor(document, document.start)
  state.fmv = {
    scene: sceneId,
    fragment: document.start,
    phase: 'loading',
    ready: [],
    pendingChoice: null,
    presentation: 1,
    lastTransition: null,
    error: null,
  }
}

export function chooseFmv(
  state: FmvWorkingState,
  content: NarrativeContent,
  index: number,
  applyChoice: FmvChoiceApplier,
): void {
  const runtime = state.fmv
  if (!runtime || (runtime.phase !== 'choice' && runtime.phase !== 'buffering')) {
    throw new Error('FMV scene is not waiting for a choice')
  }
  const document = documentFor(content, runtime.scene)
  const current = fragmentFor(document, runtime.fragment)
  const choice = current.choices?.[index]
  if (!choice) throw new Error(`Unknown dialogue choice ${index}`)
  fragmentFor(document, choice.next)
  if (!runtime.ready.includes(choice.next)) {
    runtime.pendingChoice = index
    runtime.phase = 'buffering'
    return
  }

  // The exact ordinary narrative choice reducer writes effects and usedChoices.
  applyChoice(state, runtime.scene, current.id, current.choices ?? [], index)
  runtime.lastTransition = {
    from: current.id,
    to: choice.next,
    choice: choice.id,
    choiceIndex: index,
    readyNext: true,
  }
  runtime.fragment = choice.next
  runtime.phase = 'playing'
  runtime.pendingChoice = null
  runtime.presentation += 1
  runtime.error = null
}

export function readyFmv(
  state: FmvWorkingState,
  content: NarrativeContent,
  sceneId: string,
  fragmentId: string,
  applyChoice: FmvChoiceApplier,
): void {
  const runtime = state.fmv
  if (!runtime || runtime.scene !== sceneId) return
  const document = documentFor(content, sceneId)
  fragmentFor(document, fragmentId)
  if (!runtime.ready.includes(fragmentId)) runtime.ready.push(fragmentId)

  if (runtime.pendingChoice !== null) {
    const current = fragmentFor(document, runtime.fragment)
    if (current.choices?.[runtime.pendingChoice]?.next === fragmentId) {
      runtime.phase = 'buffering'
      chooseFmv(state, content, runtime.pendingChoice, applyChoice)
      return
    }
  }
  if (
    runtime.fragment === fragmentId &&
    runtime.pendingChoice === null &&
    (runtime.phase === 'loading' || runtime.phase === 'error')
  ) {
    runtime.phase = 'playing'
    runtime.error = null
  }
}

export function failFmv(
  state: FmvWorkingState,
  content: NarrativeContent,
  sceneId: string,
  fragmentId: string,
  code: FmvErrorCode,
  message: string,
): void {
  const runtime = state.fmv
  if (!runtime || runtime.scene !== sceneId) return
  fragmentFor(documentFor(content, sceneId), fragmentId)
  runtime.phase = 'error'
  runtime.error = { code, message, fragment: fragmentId }
}

export function endFmv(
  state: FmvWorkingState,
  content: NarrativeContent,
  sceneId: string,
  fragmentId: string,
): void {
  const runtime = state.fmv
  if (!runtime || runtime.scene !== sceneId || runtime.fragment !== fragmentId) return
  const current = fragmentFor(documentFor(content, sceneId), fragmentId)
  if (runtime.phase !== 'playing') throw new Error(`FMV fragment ${sceneId}/${fragmentId} is not playing`)
  runtime.phase = current.choices?.length ? 'choice' : 'ended'
}

export function drawFmv(
  state: DeepReadonly<NarrativeState>,
  content: NarrativeContent,
  frame: DeepReadonly<NarrativeFrame>,
  draw: (command: PackDrawCommand) => void,
): void {
  const runtime = state.fmv
  if (!runtime) return
  const document = documentFor(content, runtime.scene)
  const current = fragmentFor(document, runtime.fragment)
  draw({
    type: 'narrative.fmv.frame',
    frame: frame.frame,
    scene: runtime.scene,
    fragment: current.id,
    src: current.src,
    poster: current.poster,
    duration_ms: current.duration_ms,
    ready: runtime.ready.includes(current.id),
    presentation: runtime.presentation,
    status: runtime.phase,
    blank: false,
  })

  if (runtime.phase === 'choice' || runtime.phase === 'buffering') {
    draw({
      type: 'narrative.fmv.choices',
      frame: frame.frame,
      scene: runtime.scene,
      fragment: current.id,
      pendingChoice: runtime.pendingChoice,
      choices: (current.choices ?? []).map((choice, index) => ({
        index,
        id: choice.id,
        text: choice.text,
        next: choice.next,
        ready: runtime.ready.includes(choice.next),
      })),
    })
  }

  if (runtime.phase === 'playing') {
    const position = frame.position_ms ?? 0
    for (const subtitle of current.subtitles) {
      if (position >= subtitle.start_ms && position < subtitle.end_ms) {
        draw({
          type: 'narrative.fmv.subtitle',
          frame: frame.frame,
          scene: runtime.scene,
          fragment: current.id,
          start_ms: subtitle.start_ms,
          end_ms: subtitle.end_ms,
          text: subtitle.text,
        })
      }
    }
  }
  if (runtime.error) {
    draw({
      type: 'narrative.fmv.error',
      frame: frame.frame,
      scene: runtime.scene,
      fragment: runtime.error.fragment,
      code: runtime.error.code,
      message: runtime.error.message,
      recoverable: true,
    })
  }
}
