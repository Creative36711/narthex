import { useCallback, useEffect, useMemo, useState } from 'react'
import { PackHost, type PackDrawCommand } from '../core/pack/host'
import { assetUrl } from '../core/loader'
import type { GameEngine } from '../core/engine'
import type { SceneDef } from '../shared/types'
import narrativeManifestSource from '../../packs/narrative/pack.json'
import { createFmvPreloader, FmvResourceError } from '../../packs/narrative/fmv-loader'
import type { FmvDocument, FmvErrorCode, FmvFragment } from '../../packs/narrative/fmv'
import { createNarrativeHooks } from '../../packs/narrative/hooks'
import { createNarrativeState } from '../../packs/narrative/sim'
import type { NarrativeContent, NarrativeEvent, NarrativeFrame, NarrativeState } from '../../packs/narrative/types'
import type { PackManifest } from '../core/pack/registry'
import { FmvCutsceneMode, type FmvCutsceneView } from './FmvCutsceneMode'

const narrativeManifest = narrativeManifestSource as PackManifest

type FmvRuntime = {
  document: FmvDocument
  content: NarrativeContent
  host: PackHost<NarrativeState, NarrativeEvent, NarrativeFrame>
  preloader: ReturnType<typeof createFmvPreloader>
  state: NarrativeState
  videoUrls: Map<string, string>
  nextFrame: number
  dispose: () => void
}

interface Props {
  engine: GameEngine
  scene: SceneDef & { fmv?: string }
  onContinue: () => void
}

async function getJson<T>(url: string): Promise<T> {
  const response = await fetch(url)
  if (!response.ok) throw new Error(`Не удалось загрузить FMV-данные ${url}: HTTP ${response.status}`)
  return response.json() as Promise<T>
}

function errorCode(error: unknown): FmvErrorCode {
  return error instanceof FmvResourceError ? error.code : 'FMV_LOAD_ERROR'
}

function errorText(error: unknown): string {
  return error instanceof Error ? error.message : String(error)
}

async function createRuntime(engine: GameEngine, scene: SceneDef & { fmv?: string }): Promise<FmvRuntime> {
  const fmvId = scene.fmv
  if (!fmvId) throw new Error(`В сцене ${scene.id} не указан FMV-документ.`)
  const base = engine.campaign.basePath
  const manifest = await getJson<{ fmv?: string[] }>(`${base}/manifest.json`)
  const file = manifest.fmv?.find((entry) => entry.replace(/\.json$/i, '') === fmvId)
  if (!file) throw new Error(`FMV-документ ${fmvId} отсутствует в manifest.json.`)
  const document = await getJson<FmvDocument>(`${base}/fmv/${file}`)
  const content: NarrativeContent = {
    campaign: { id: engine.campaign.meta.id, starting_scene: scene.id },
    scenes: { [scene.id]: { id: scene.id, location: scene.location, fmv: document.id } },
    locations: { [scene.location]: { id: scene.location, scenes: [scene.id] } },
    dialogues: {},
    quests: {},
    fmv: { [document.id]: document },
  }
  const state = createNarrativeState(content)
  const host = new PackHost<NarrativeState, NarrativeEvent, NarrativeFrame>([narrativeManifest])
  if (!host.register(narrativeManifest.id, createNarrativeHooks(content))) {
    throw new Error(`FMV runtime registration failed: ${host.paused?.reason ?? 'unknown reason'}`)
  }

  let disposed = false
  const videoUrls = new Map<string, string>()
  const preloader = createFmvPreloader(async (src) => {
    let response: Response
    try {
      response = await fetch(assetUrl(engine.campaign, src))
    } catch {
      throw new FmvResourceError('FMV_OFFLINE', `Видеофрагмент недоступен без сети: ${src}.`)
    }
    if (!response.ok) throw new FmvResourceError('FMV_HTTP_ERROR', `Не удалось загрузить ${src}: HTTP ${response.status}.`)
    const bytes = await response.arrayBuffer()
    if (!bytes.byteLength) throw new FmvResourceError('FMV_LOAD_ERROR', `Видеофрагмент ${src} пуст.`)
    if (!disposed) {
      const type = /\.webm(?:$|\?)/i.test(src) ? 'video/webm' : 'video/mp4'
      videoUrls.set(src, URL.createObjectURL(new Blob([bytes], { type })))
    }
    return bytes
  })

  return {
    document,
    content,
    host,
    preloader,
    state,
    videoUrls,
    nextFrame: 0,
    dispose() {
      disposed = true
      for (const url of videoUrls.values()) URL.revokeObjectURL(url)
      videoUrls.clear()
    },
  }
}

export function FmvScreen({ engine, scene, onContinue }: Props) {
  const [runtime, setRuntime] = useState<FmvRuntime | null>(null)
  const [loadError, setLoadError] = useState('')
  const [reload, setReload] = useState(0)
  const [revision, setRevision] = useState(0)
  const [positionMs, setPositionMs] = useState(0)

  useEffect(() => {
    let active = true
    let created: FmvRuntime | null = null
    setRuntime(null)
    setLoadError('')
    void createRuntime(engine, scene)
      .then((value) => {
        created = value
        if (active) setRuntime(value)
        else value.dispose()
      })
      .catch((error: unknown) => { if (active) setLoadError(errorText(error)) })
    return () => {
      active = false
      created?.dispose()
    }
  }, [engine, scene.id, scene.fmv, reload])

  const dispatch = useCallback((event: NarrativeEvent) => {
    if (!runtime) return
    const result = runtime.host.runSim({
      state: runtime.state,
      event,
      seed: Number(engine.state.seed) || 0,
    })
    if (result.paused) {
      setLoadError(`FMV sim остановлен: ${result.paused.reason}`)
      return
    }
    const previousFragment = runtime.state.fmv?.fragment
    runtime.state = result.state
    if (previousFragment !== runtime.state.fmv?.fragment) setPositionMs(0)
    if (event.type === 'choose_dialogue') {
      for (const [flag, value] of Object.entries(runtime.state.flags)) {
        if (engine.state.flags[flag] !== value) engine.setFlag(flag, value)
      }
    }
    setRevision((value) => value + 1)
  }, [engine, runtime])

  const loadFragment = useCallback((fragment: FmvFragment) => {
    if (!runtime) return
    void runtime.preloader.preload(runtime.document.id, fragment)
      .then((resource) => dispatch({ type: 'fmv_ready', scene: resource.scene, fragment: resource.fragment }))
      .catch((error: unknown) => dispatch({
        type: 'fmv_error',
        scene: runtime.document.id,
        fragment: fragment.id,
        code: errorCode(error),
        message: errorText(error),
      }))
  }, [dispatch, runtime])

  const fmvState = runtime?.state.fmv
  const currentFragment = runtime && fmvState
    ? runtime.document.fragments.find((fragment) => fragment.id === fmvState.fragment) ?? null
    : null

  useEffect(() => {
    if (!runtime || !fmvState) return
    const initial = runtime.document.fragments.find((fragment) => fragment.id === fmvState.fragment)
    if (initial && fmvState.phase === 'loading') loadFragment(initial)
  }, [fmvState?.fragment, fmvState?.phase, loadFragment, runtime])

  useEffect(() => {
    if (!runtime || !currentFragment) return
    let active = true
    for (const choice of currentFragment.choices ?? []) {
      const target = runtime.document.fragments.find((fragment) => fragment.id === choice.next)
      if (!target) continue
      void runtime.preloader.preload(runtime.document.id, target)
        .then((resource) => {
          if (active) dispatch({ type: 'fmv_ready', scene: resource.scene, fragment: resource.fragment })
        })
        .catch(() => { /* A failed branch stays disabled; the currently playing fragment is unaffected. */ })
    }
    return () => { active = false }
  }, [currentFragment, dispatch, runtime])

  const projection = useMemo(() => {
    if (!runtime) return { commands: [] as PackDrawCommand[], error: '' }
    const commands: PackDrawCommand[] = []
    const paused = runtime.host.runView({
      state: runtime.state,
      frame: { frame: runtime.nextFrame++, position_ms: positionMs },
      draw: (command) => commands.push(command),
    })
    return { commands, error: paused ? `FMV view остановлен: ${paused.reason}` : '' }
  }, [positionMs, revision, runtime])
  const commands = projection.commands
  const frame = commands.find((command) => command.type === 'narrative.fmv.frame')
  const subtitle = commands.find((command) => command.type === 'narrative.fmv.subtitle')
  const choiceFrame = commands.find((command) => command.type === 'narrative.fmv.choices')
  const errorFrame = commands.find((command) => command.type === 'narrative.fmv.error')
  const choices = Array.isArray(choiceFrame?.choices)
    ? (choiceFrame.choices as Array<Record<string, unknown>>).map((choice) => ({
      index: Number(choice.index),
      text: String(choice.text ?? ''),
      ready: choice.ready === true,
    }))
    : []
  const view: FmvCutsceneView | null = runtime && fmvState && currentFragment && frame ? {
    scene: String(frame.scene ?? fmvState.scene),
    fragment: String(frame.fragment ?? fmvState.fragment),
    presentation: Number(frame.presentation ?? fmvState.presentation),
    posterUrl: assetUrl(engine.campaign, String(frame.poster ?? currentFragment.poster)),
    videoUrl: runtime.videoUrls.get(String(frame.src ?? currentFragment.src)) ?? null,
    phase: fmvState.phase,
    subtitle: typeof subtitle?.text === 'string' ? subtitle.text : null,
    choices,
    error: typeof errorFrame?.message === 'string' ? errorFrame.message : null,
    onVideoEnded: () => dispatch({ type: 'fmv_ended', scene: fmvState.scene, fragment: fmvState.fragment }),
    onVideoError: () => dispatch({
      type: 'fmv_error', scene: fmvState.scene, fragment: fmvState.fragment,
      code: 'FMV_LOAD_ERROR', message: `Браузер не смог воспроизвести ${fmvState.fragment}.`,
    }),
    onPosition: (nextPositionMs) => setPositionMs(nextPositionMs),
    onChoice: (index) => dispatch({ type: 'choose_dialogue', choice: index }),
    onRetry: () => loadFragment(currentFragment),
    onContinue,
  } : null

  const failure = loadError || projection.error
  if (failure) {
    return (
      <div className="cutscene-overlay fmv-cutscene" role="alert" data-fmv-screen data-fmv-phase="error">
        <div className="fmv-poster-prompt">
          <p>{failure}</p>
          <button type="button" className="btn btn-primary" onClick={() => setReload((value) => value + 1)}>Повторить</button>
        </div>
      </div>
    )
  }
  if (!view) {
    const fallbackPoster = scene.states?.[0]?.image
    return (
      <div className="cutscene-overlay fmv-cutscene" role="status" data-fmv-screen data-fmv-phase="loading">
        {fallbackPoster && <img className="cs-media fmv-poster" src={assetUrl(engine.campaign, String(fallbackPoster))} alt="Постер FMV" data-fmv-poster />}
        <div className="fmv-poster-prompt">Открываем видеофрагмент…</div>
      </div>
    )
  }
  return (
    <FmvCutsceneMode
      key={`${view.fragment}:${view.presentation}`}
      view={view}
    />
  )
}

export function fmvSceneId(scene: SceneDef | null | undefined): string | null {
  const id = (scene as (SceneDef & { fmv?: string }) | null | undefined)?.fmv
  return typeof id === 'string' && id ? id : null
}
