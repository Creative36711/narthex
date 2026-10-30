/**
 * Файлы кампании на диске: запись через dev-эндпоинт `__editor/save`, сверка
 * распакованного пакета с установленным и правила допуска путей.
 *
 * Вынесено из `newCampaign.ts`, чтобы модуль создания и импорта кампании
 * оставался в пределах лимита размера: здесь только работа с отдельными
 * файлами, решения об ID и реестре остаются в `newCampaign.ts`.
 */

import type JSZip from 'jszip'
import { canonicalJson } from '../shared/fingerprint'
import { AI_TASK_DIR } from './aiKit'

export async function saveFile(rel: string, text: string): Promise<void> {
  const res = await fetch('/__editor/save', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ path: rel, text }),
  })
  if (!res.ok) throw new Error(`${rel}: ${res.status} ${await res.text()}`)
}

export async function saveFileBase64(rel: string, base64: string): Promise<void> {
  const res = await fetch('/__editor/save', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ path: rel, base64 }),
  })
  if (!res.ok) throw new Error(`${rel}: ${res.status} ${await res.text()}`)
}

/**
 * Заглушка фона первой сцены, чтобы новая кампания сразу отрисовывалась
 * (правка «первая сцена новой кампании должна отображаться»). Копируется
 * из общего шаблона и потом заменяется артом мастера.
 */

export async function packageMatchesInstalled(zip: JSZip, campaignId: string): Promise<boolean> {
  const files = Object.entries(zip.files).filter(([path, file]) => !file.dir && !path.startsWith(AI_TASK_DIR))
  try {
    const response = await fetch(`/__editor/campaign-files?id=${encodeURIComponent(campaignId)}`)
    if (!response.ok) return false
    const result = await response.json() as { files?: unknown }
    if (!Array.isArray(result.files) || result.files.some((path) => typeof path !== 'string')) return false
    const installedPaths = (result.files as string[]).slice().sort()
    const packagePaths = files.map(([path]) => path).sort()
    if (installedPaths.length !== packagePaths.length || installedPaths.some((path, index) => path !== packagePaths[index])) return false
  } catch {
    return false
  }
  for (const [path, file] of files) {
    let response: Response
    try {
      response = await fetch(`/campaigns/${campaignId}/${path}?t=${Date.now()}`)
    } catch {
      return false
    }
    if (!response.ok) return false
    if (path.endsWith('.json')) {
      try {
        const [incoming, installed] = await Promise.all([
          file.async('text').then((text) => canonicalJson(JSON.parse(text))),
          response.json().then((value) => canonicalJson(value)),
        ])
        if (incoming !== installed) return false
      } catch {
        return false
      }
    } else if (path.endsWith('.ink')) {
      if ((await file.async('text')) !== (await response.text())) return false
    } else {
      const [incoming, installed] = await Promise.all([
        file.async('uint8array'),
        response.arrayBuffer().then((buffer) => new Uint8Array(buffer)),
      ])
      if (incoming.length !== installed.length || incoming.some((byte, i) => byte !== installed[i])) return false
    }
  }
  return files.length > 0
}

/** Байты → base64 без переполнения стека на больших файлах. */
export function uint8ArrayToBase64(bytes: Uint8Array): string {
  let binary = ''
  const len = bytes.byteLength
  const chunkSize = 0x8000
  for (let i = 0; i < len; i += chunkSize) {
    const chunk = bytes.subarray(i, Math.min(i + chunkSize, len))
    binary += String.fromCharCode.apply(null, chunk as unknown as number[])
  }
  return btoa(binary)
}

/** Удаляет корневой префикс подпапки (например из архива репозитория GitHub вида "repo-main/"). */
export function stripZipRootPrefix(path: string, prefix?: string): string {
  const p = path.replaceAll('\\', '/').replace(/^\/+/, '')
  if (prefix && p.startsWith(prefix)) {
    return p.slice(prefix.length)
  }
  // Если префикс не передан явно, проверяем формат single-directory wrapper (repo-branch/...)
  const parts = p.split('/')
  if (parts.length > 1 && !['assets', 'scenes', 'entities', 'rules', 'encounters', 'arenas', 'quests', 'cutscenes', 'recipes', 'codex', 'dialogues'].includes(parts[0])) {
    return parts.slice(1).join('/')
  }
  return p
}

/**
 * Белый список канонических файлов и папок кампании (Campaign Package).
 * Исключает служебные папки систем версий (.git, .github), инструменты и скрипты ИИ (tools/, *.py).
 */
/** Белый список канонических файлов и папок кампании (Campaign Package). */
export function isAllowedCampaignFile(relPath: string): boolean {
  const p = relPath.replaceAll('\\', '/').replace(/^\/+/, '')
  if (
    p.startsWith('.git/') ||
    p.startsWith('.github/') ||
    p.startsWith('.vscode/') ||
    p.startsWith('.idea/') ||
    p.startsWith('tools/') ||
    p.startsWith('_ai-temp/') ||
    p.startsWith('test/') ||
    p.startsWith('__chronicle_ai__/') ||
    p.startsWith('__pycache__/') ||
    p.includes('/__pycache__/') ||
    /\.(?:py|sh|bat|cmd|ps1|DS_Store|thumbs\.db)$/i.test(p)
  ) {
    return false
  }

  if (['campaign.json', 'world.json', 'manifest.json', 'README.md', 'DESIGN.md', 'design_doc.md'].includes(p)) {
    return true
  }

  const allowedDirs = [
    'scenes/', 'entities/', 'rules/', 'encounters/', 'arenas/',
    'quests/', 'cutscenes/', 'recipes/', 'codex/', 'dialogues/', 'assets/'
  ]
  return allowedDirs.some((dir) => p.startsWith(dir))
}
