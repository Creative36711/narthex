/**
 * Narthex — Интеграция с десктопной платформой Tauri v2.
 * Поддерживает гибридный режим: работа в браузере (vite dev) и в нативном окне Tauri.
 */

declare global {
  interface Window {
    __TAURI_INTERNALS__?: unknown
    __TAURI__?: unknown
  }
}

/** Запущено ли приложение внутри десктопной оболочки Tauri */
export function isTauri(): boolean {
  return typeof window !== 'undefined' && ('__TAURI_INTERNALS__' in window || '__TAURI__' in window)
}

/** Получить удобную подпись текущей среды выполнения */
export function runtimePlatform(): 'tauri' | 'browser' {
  return isTauri() ? 'tauri' : 'browser'
}
