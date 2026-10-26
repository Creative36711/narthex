import { readFileSync } from 'node:fs'

/**
 * Исходники экрана сцены. D-076 разложил `SceneScreen.tsx` на слои
 * (лимит модуля 450 строк), поэтому смоки, которые ищут код «в сцене»,
 * читают все файлы сразу, а не один экран.
 */
export const SCENE_PLAYER_FILES = [
  'src/player/SceneScreen.tsx',
  'src/player/SceneForeground.tsx',
  'src/player/SceneNavigation.tsx',
  'src/player/SceneIntroOverlay.tsx',
  'src/player/ItemInteractDialog.tsx',
] as const

export function scenePlayerSource(): string {
  return SCENE_PLAYER_FILES.map((path) => readFileSync(path, 'utf8')).join('\n')
}
