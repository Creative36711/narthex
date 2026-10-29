import type { FmvDocument, FmvErrorCode, FmvFragment } from './fmv'

export interface FmvLoadedResource {
  scene: string
  fragment: string
  src: string
  bytes: number
}

export type FmvResourceLoader = (src: string) => Promise<ArrayBuffer>

export class FmvResourceError extends Error {
  readonly code: FmvErrorCode

  constructor(code: FmvErrorCode, message: string) {
    super(message)
    this.name = 'FmvResourceError'
    this.code = code
  }
}

/** Browser/host adapter: readiness means the complete resource is buffered. */
export async function fetchFmvResource(src: string): Promise<ArrayBuffer> {
  let response: Response
  try {
    response = await fetch(src)
  } catch {
    throw new FmvResourceError(
      'FMV_OFFLINE',
      `Видеофрагмент недоступен без сети: ${src}. Проверьте подключение и повторите загрузку.`,
    )
  }
  if (!response.ok) {
    throw new FmvResourceError(
      'FMV_HTTP_ERROR',
      `Не удалось загрузить видеофрагмент ${src}: HTTP ${response.status}.`,
    )
  }
  const bytes = await response.arrayBuffer()
  if (bytes.byteLength === 0) {
    throw new FmvResourceError('FMV_LOAD_ERROR', `Видеофрагмент ${src} пуст.`)
  }
  return bytes
}

export interface FmvPreloader {
  preload(scene: string, fragment: FmvFragment): Promise<FmvLoadedResource>
  preloadChoices(scene: string, fragment: FmvFragment, document: FmvDocument): Promise<FmvLoadedResource[]>
}

/** Async I/O stays outside sim. Sim receives only the resulting ready/error event. */
export function createFmvPreloader(load: FmvResourceLoader = fetchFmvResource): FmvPreloader {
  const pending = new Map<string, Promise<FmvLoadedResource>>()

  function preload(scene: string, fragment: FmvFragment): Promise<FmvLoadedResource> {
    const key = `${scene}/${fragment.id}`
    const existing = pending.get(key)
    if (existing) return existing
    const request = load(fragment.src)
      .then((bytes) => {
        if (bytes.byteLength === 0) throw new FmvResourceError('FMV_LOAD_ERROR', `Видеофрагмент ${fragment.src} пуст.`)
        return { scene, fragment: fragment.id, src: fragment.src, bytes: bytes.byteLength }
      })
      .catch((error: unknown) => {
        pending.delete(key)
        throw error
      })
    pending.set(key, request)
    return request
  }

  return {
    preload,
    async preloadChoices(scene, fragment, document) {
      const targets = (fragment.choices ?? []).map((choice) => {
        const next = document.fragments.find((candidate) => candidate.id === choice.next)
        if (!next) throw new FmvResourceError('FMV_LOAD_ERROR', `Неизвестный следующий фрагмент ${choice.next}.`)
        return next
      })
      return Promise.all(targets.map((target) => preload(scene, target)))
    },
  }
}
