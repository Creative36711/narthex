/**
 * Ассеты по ссылкам (итерация 8, блок C).
 *
 * Кампания может ссылаться на изображения/звук с любого хостинга: `assetUrl()`
 * пропускает http(s) как есть. Здесь — проверка доступности ссылки и
 * «вшивание» внешних файлов в пакет при экспорте (кампания становится
 * автономной, но тяжелее).
 */

import { showAlert } from '../shared/modals'
import { isExternalUrl } from '../core/loader'
import type { EditorStore } from './store'

export type AssetKind = 'image' | 'audio' | 'video' | 'font' | 'any'

export interface UrlCheck {
  /** файл вообще открывается (картинка/звук грузится в браузере) */
  ok: boolean
  /** сервер отдаёт CORS — файл можно скачать и вшить в пакет при экспорте */
  cors: boolean
  message: string
}

const EXT_BY_MIME: Record<string, string> = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
  'image/gif': 'gif',
  'image/svg+xml': 'svg',
  'image/avif': 'avif',
  'audio/mpeg': 'mp3',
  'audio/mp4': 'm4a',
  'audio/ogg': 'ogg',
  'audio/wav': 'wav',
  'audio/webm': 'webm',
  'video/mp4': 'mp4',
  'video/webm': 'webm',
}

function extFromUrl(url: string): string {
  const clean = url.split('?')[0].split('#')[0]
  const m = clean.match(/\.([a-z0-9]{2,5})$/i)
  return (m?.[1] ?? '').toLowerCase()
}

import { youtubeId } from '../shared/CutscenePlayer'

/**
 * Проверка доступности ссылки:
 *  • `ok`    — файл грузится тегом <img>/<audio> (встраивание разрешено);
 *  • `cors`  — сервер отдаёт CORS-заголовки, поэтому файл можно скачать
 *              и вшить в .chronicle при экспорте.
 */
export function checkExternalUrl(url: string, kind: AssetKind = 'any'): Promise<UrlCheck> {
  return new Promise((resolve) => {
    if (!isExternalUrl(url)) {
      resolve({ ok: false, cors: false, message: 'Это не внешняя ссылка' })
      return
    }
    // шрифт как медиа не загрузишь — проверяем обычным fetch (для @font-face
    // с чужого домена всё равно нужен CORS)
    if (kind === 'font') {
      void fetch(url, { mode: 'cors' })
        .then((res) =>
          finish(
            res.ok
              ? { ok: true, cors: true, message: 'Шрифт доступен, его можно вшить в пакет.' }
              : { ok: false, cors: false, message: `Сервер ответил ${res.status} — шрифт не загрузится.` },
          ),
        )
        .catch(() =>
          finish({
            ok: true,
            cors: false,
            message: 'Проверить не удалось (сервер не отдаёт CORS): шрифт может не загрузиться, надёжнее вшить файл в пакет.',
          }),
        )
      return
    }
    // YouTube — особый случай: как <video> его не проверить (это страница),
    // но в катсцену он встраивается плеером. Проверяем распознавание ссылки.
    if (kind === 'video' && youtubeId(url)) {
      resolve({
        ok: true,
        cors: false,
        message: 'YouTube-ссылка распознана — ролик встроится в катсцену; вшить в пакет его нельзя.',
      })
      return
    }
    let settled = false
    const finish = (c: UrlCheck) => {
      if (settled) return
      settled = true
      resolve(c)
    }
    // 1. грузим как медиа (то же самое, что сделает игра)
    const useAudio = kind === 'audio' || kind === 'video'
    const el = useAudio ? new Audio() : new window.Image()
    const onOk = () => {
      // 2. пробуем скачать — пригодится ли ссылка для «вшивания» в пакет
      void fetch(url, { mode: 'cors' })
        .then((res) =>
          finish({
            ok: true,
            cors: res.ok,
            message: res.ok
              ? 'Ссылка доступна, файл можно вшить в пакет.'
              : `Файл открывается, но сервер ответил ${res.status} — вшить в пакет не получится.`,
          }),
        )
        .catch(() =>
          finish({
            ok: true,
            cors: false,
            message:
              'Файл показывается в браузере, но скачать его нельзя (нет CORS): ' +
              'вшить в пакет не получится, кампания будет зависеть от сети.',
          }),
        )
    }
    const onErr = () =>
      finish({
        ok: false,
        cors: false,
        message: 'Ссылка не открывается: неправильный адрес или хостинг запрещает встраивание.',
      })
    if (useAudio) {
      const a = el as HTMLAudioElement
      a.preload = 'metadata'
      a.onloadedmetadata = onOk
      a.onerror = onErr
      a.src = url
    } else {
      const im = el as HTMLImageElement
      im.onload = onOk
      im.onerror = onErr
      im.src = url
    }
    // страховка от «вечной» загрузки
    setTimeout(() => finish({ ok: false, cors: false, message: 'Ссылка не отвечает (таймаут 15 с).' }), 15000)
  })
}

/** Все внешние ссылки, упомянутые в файлах кампании. */
export function collectExternalUrls(store: EditorStore): string[] {
  const found = new Set<string>()
  const scanText = (text: string) => {
    for (const m of text.matchAll(/"((?:https?:\/\/|\/\/)[^"\\]+)"/g)) found.add(m[1])
  }
  const scan = (v: unknown) => {
    if (typeof v === 'string') {
      if (isExternalUrl(v)) found.add(v)
      return
    }
    if (Array.isArray(v)) {
      v.forEach(scan)
      return
    }
    if (v && typeof v === 'object') {
      for (const x of Object.values(v)) scan(x)
    }
  }
  scanText(JSON.stringify(store.meta))
  scanText(JSON.stringify(store.world))
  for (const [, v] of store.jsonFiles) scan(v)
  for (const [, t] of store.textFiles) scanText(JSON.stringify(t))
  return [...found].sort()
}

/** заменить строки во всех документах кампании (для «вшивания» ссылок) */
function replaceStrings(node: unknown, map: Map<string, string>): unknown {
  if (typeof node === 'string') return map.get(node) ?? node
  if (Array.isArray(node)) return node.map((x) => replaceStrings(x, map))
  if (node && typeof node === 'object') {
    for (const [k, v] of Object.entries(node)) {
      ;(node as Record<string, unknown>)[k] = replaceStrings(v, map)
    }
  }
  return node
}

/** безопасное имя файла из ссылки */
function fileNameFromUrl(url: string, fallback: string, mime: string): string {
  let name = url.split('?')[0].split('#')[0].split('/').pop() ?? ''
  name = name.toLowerCase().replace(/[^a-z0-9._-]+/g, '_').replace(/^_+|_+$/g, '')
  if (!name || name.length > 60) name = fallback
  if (!/\.[a-z0-9]{2,5}$/.test(name)) {
    const ext = extFromUrl(url) || (EXT_BY_MIME[mime.split(';')[0]] ?? 'bin')
    name = `${name.replace(/\.[a-z0-9]{2,5}$/, '')}.${ext}`
  }
  return name
}

/**
 * Скачать внешний файл. В dev-режиме — через эндпоинт /__editor/fetch
 * (сервер снимет его без ограничений CORS), в проде — напрямую.
 */
async function downloadExternal(url: string): Promise<{ base64: string; mime: string } | null> {
  try {
    const res = await fetch('/__editor/fetch', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ url }),
    })
    if (res.ok) {
      const data = (await res.json()) as { base64?: string; mime?: string; error?: string }
      if (data.base64) return { base64: data.base64, mime: data.mime ?? '' }
    }
  } catch {
    /* эндпоинта нет (прод-сборка) — пробуем напрямую */
  }
  try {
    const res = await fetch(url, { mode: 'cors' })
    if (!res.ok) return null
    const blob = await res.blob()
    const buf = new Uint8Array(await blob.arrayBuffer())
    let bin = ''
    for (let i = 0; i < buf.length; i++) bin += String.fromCharCode(buf[i])
    return { base64: btoa(bin), mime: res.headers.get('content-type') ?? '' }
  } catch {
    return null
  }
}

/**
 * «Вшить внешние ссылки в пакет»: скачивает файлы в assets/external/ и
 * переписывает ссылки в документах кампании. Возвращает отчёт по-русски.
 */
export async function embedExternalAssets(store: EditorStore): Promise<string[]> {
  const urls = collectExternalUrls(store)
  const notes: string[] = []
  if (!urls.length) return notes
  const map = new Map<string, string>()
  let n = 0
  for (const url of urls) {
    const file = await downloadExternal(url)
    if (!file) {
      notes.push(`не удалось скачать: ${url}`)
      continue
    }
    n += 1
    const rel = `assets/external/${fileNameFromUrl(url, `file_${n}`, file.mime)}`
    const saved = await store
      .saveBinary(rel, new File([Uint8Array.from(atob(file.base64), (c) => c.charCodeAt(0))], rel.split('/').pop()!))
      .then(() => true)
      .catch(() => false)
    if (!saved) {
      notes.push(`не удалось сохранить: ${url}`)
      continue
    }
    map.set(url, rel)
    notes.push(`вшит файл: ${rel}`)
  }
  if (map.size) {
    store.meta = replaceStrings(store.meta, map) as typeof store.meta
    store.world = replaceStrings(store.world, map) as typeof store.world
    for (const [p, v] of [...store.jsonFiles]) {
      store.jsonFiles.set(p, replaceStrings(v, map))
      store.touch(p)
    }
    store.touch('campaign.json')
    store.touch('world.json')
  }
  return notes
}

/** понятное сообщение об ошибке загрузки файла (используется в формах) */
export async function reportAssetError(e: unknown): Promise<void> {
  await showAlert('Не удалось загрузить файл', `${e}\n(Загрузка работает в dev-режиме vite / Tauri.)`)
}
