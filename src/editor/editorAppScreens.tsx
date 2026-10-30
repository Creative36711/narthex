/**
 * Экраны страницы редактора: заглушки «нет кампании», ошибки загрузки,
 * ожидания загрузки, отсутствующего пака и режим плейтеста.
 *
 * Вынесено из `EditorApp.tsx`: каждый экран — ранний выход страницы, поэтому
 * заглушки собраны в одну функцию, а плейтест — в отдельный компонент.
 */

import type { Dispatch, RefObject, SetStateAction } from 'react'
import { stopMusic, setMusicCampaign } from '../shared/music'
import { setAmbientAudioEnabled, setAudioCampaign } from '../shared/audio'
import { deleteSave, GameEngine } from '../core/engine'
import { GameView } from '../player/GameView'
import { CharacterCreation } from '../player/CharacterCreation'
import { PlaytestDebugPanel } from './PlaytestDebugPanel'
import { profileClass, atmosphereOn } from '../shared/profiles'
import { themeVars } from '../shared/theme'
import type { CharChoice } from '../core/charcreate'
import type { CampaignData, CampaignIndexEntry } from '../shared/types'
import type { PlaytestRecord } from './campaignAudit'
import type { EditorStore } from './store'
import type { CampaignOps } from './editorAppCampaignOps'

/** Всё, что нужно ранним экранам страницы редактора. */
export interface EditorGuardProps {
  base: string
  setBase: Dispatch<SetStateAction<string>>
  error: string | null
  setError: Dispatch<SetStateAction<string | null>>
  setReadyStore: Dispatch<SetStateAction<EditorStore | null>>
  loaded: boolean
  store: EditorStore
  campaigns: CampaignIndexEntry[]
  ops: CampaignOps
  onExit: () => void
  aiWizard: boolean
  setAiWizard: Dispatch<SetStateAction<boolean>>
  busy: string | null
  doImport: (file: File) => Promise<void>
  doImportJson: () => Promise<void>
  fileInput: RefObject<HTMLInputElement | null>
}

/** Всё, что нужно экрану плейтеста. */
export interface EditorPlaytestProps {
  testCampaign: CampaignData | null
  testEngine: GameEngine | null
  setTestEngine: Dispatch<SetStateAction<GameEngine | null>>
  setTestCampaign: Dispatch<SetStateAction<CampaignData | null>>
  debugOpen: boolean
  setDebugOpen: Dispatch<SetStateAction<boolean>>
  lastPlaytest: PlaytestRecord | null
  setLastPlaytest: Dispatch<SetStateAction<PlaytestRecord | null>>
  ops: CampaignOps
}

/** Режим плейтеста: игра поверх редактора и баннер отладки. */
export function EditorPlaytestScreen(props: EditorPlaytestProps) {
  const { testCampaign, testEngine, setTestEngine, setTestCampaign, debugOpen, setDebugOpen, lastPlaytest, setLastPlaytest, ops } = props
  if (testCampaign) {
    const leaveTest = () => {
      stopMusic(0.2)
      setAmbientAudioEnabled(false)
      setMusicCampaign(null)
      deleteSave(testCampaign.meta.id)
      setLastPlaytest((previous) => previous ? { ...previous, finishedAt: Date.now() } : previous)
      setTestEngine(null)
      setTestCampaign(null)
      setDebugOpen(false)
    }
    const startTest = (choice?: CharChoice) => {
      if (!testCampaign) return
      setAudioCampaign(testCampaign)
      setMusicCampaign(testCampaign)
      setAmbientAudioEnabled(true)
      const e = new GameEngine(testCampaign)
      if (choice) e.applyCharCreation(choice)
      e.start()
      setTestEngine(e)
    }
    // предпросмотр — игровая тема кампании (профиль + шрифты/акцент),
    // оболочка баннера остаётся фирменным стилем редактора
    const playThemeClass = `cf-themed ${profileClass(testCampaign.meta)}${atmosphereOn(testCampaign.meta) ? '' : ' cf-atmos-off'}`
    const playThemeStyle = themeVars(testCampaign, 1)
    return (
      <div className="playtest-shell">
        <div className={playThemeClass} style={playThemeStyle}>
          {testEngine ? <GameView engine={testEngine} onRestart={() => setTestEngine(testEngine.restart())} onExitToMenu={leaveTest} debugPanelOpen={debugOpen} onGamePanelOpen={() => setDebugOpen(false)} /> : (
            <CharacterCreation campaign={testCampaign} onBack={leaveTest} onStart={startTest} />
          )}
        </div>
        <div className="playtest-banner">
          <b>Режим отладки</b>
          <button className="btn btn-small" onClick={() => setDebugOpen((v) => !v)}>{debugOpen ? 'Скрыть панель' : 'Отладка'}</button>
          <button className="btn btn-small" onClick={() => void ops.recordPlaytestResult()}>Записать результат</button>
          <button className="btn btn-small" onClick={leaveTest}>Вернуться в редактор</button>
        </div>
        {debugOpen && testEngine && (
          <PlaytestDebugPanel
            engine={testEngine}
            onClose={() => setDebugOpen(false)}
            notes={lastPlaytest?.notes ?? ''}
            onSaveNotes={(n) => setLastPlaytest((prev) => prev ? { ...prev, notes: n } : { startedAt: Date.now(), finishedAt: 0, contentHash: '', notes: n })}
          />
        )}
      </div>
    )
  }
  return null
}
