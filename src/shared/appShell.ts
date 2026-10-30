/**
 * Оболочка приложения: классы на `<html>`/`<body>` под профиль кампании и
 * разблокировка звука по первому жесту.
 *
 * Вынесено из `App.tsx`, чтобы корневой компонент не упирался в лимит размера
 * модуля: здесь только побочные эффекты DOM и WebAudio, решения о том, что
 * показывать, остаются в `App.tsx`.
 */

import { useEffect } from 'react'
import type { GameEngine } from '../core/engine'
import type { CampaignData } from './types'
import { atmosphereOn, profileClass } from './profiles'
import { playUi, unlockAudio } from './audio'
import { refreshMusic } from './music'

/** Анимации интерфейса: класс `no-anim` на `<html>` по настройкам игрока. */
export function useAnimationPreference(animations: boolean): void {
  useEffect(() => {
    document.documentElement.classList.toggle('no-anim', !animations)
  }, [animations])
}

/**
 * Профиль на `<html>`: модалки рендерятся на уровне body (ModalHost), поэтому и
 * им нужны токены профиля. В режиме редактора классы снимаются — оболочка
 * редактора живёт в фирменном стиле Narthex.
 */
export function useCampaignProfileClass(editor: boolean, campaign: CampaignData | null): void {
  useEffect(() => {
    const root = document.documentElement
    // снимаем любой профиль, установленный ранее (каталог из 13 профилей —
    // фиксированный список классов перечислять не нужно)
    for (const c of Array.from(root.classList)) {
      if (c === 'cf-atmos-off' || c.startsWith('cf-profile-')) root.classList.remove(c)
    }
    if (!editor && campaign) {
      root.classList.add(profileClass(campaign.meta))
      if (!atmosphereOn(campaign.meta)) root.classList.add('cf-atmos-off')
    }
  }, [editor, campaign])
}

/**
 * Аудио: разблокировка WebAudio по первому жесту + общий «клик» по кнопкам
 * (блок H). Музыка, которая уже должна звучать, догоняется тем же жестом.
 */
export function useAudioUnlock(engine: GameEngine | null, editor: boolean): void {
  useEffect(() => {
    const unlock = () => {
      unlockAudio()
      // первый жест разрешает автоплей — запускаем музыку, которая уже должна звучать (но не в редакторе)
      if (editor || window.location.hash === '#editor') return
      refreshMusic(engine)
    }
    const onClick = (e: MouseEvent) => {
      const t = e.target as HTMLElement | null
      if (t?.closest('button')) playUi('click', 0.55)
    }
    window.addEventListener('pointerdown', unlock, { once: true })
    window.addEventListener('click', onClick)
    return () => {
      window.removeEventListener('pointerdown', unlock)
      window.removeEventListener('click', onClick)
    }
  }, [engine, editor])
}
