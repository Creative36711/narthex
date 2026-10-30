import type { GameEngine } from '../core/engine'
import type { SceneDef } from '../shared/types'
import { getUiLabel } from '../shared/types'

interface Props {
  engine: GameEngine
  scene: SceneDef
  step: number
  item: { text: string }
  intro: unknown[]
  onAdvance: () => void
  onSkip: () => void
}

/** Вводное повествование сцены: текст, счётчик, «Пропустить» и «Далее». */
export function SceneIntroOverlay({ engine, scene, step, item, intro, onAdvance, onSkip }: Props) {
  return (
    <div className="scene-narrative-overlay" onClick={onAdvance}>
      <div className="scene-narrative-box" onClick={(e) => e.stopPropagation()}>
        <div className="scene-narrative-text">{item.text}</div>
        <div className="scene-narrative-actions">
          <span className="muted small">
            {step + 1} / {intro.length} · Кликните или нажмите Пробел
          </span>
          {intro.length > 1 && step + 1 < intro.length && (
            <button
              type="button"
              className="btn btn-secondary btn-small"
              onClick={onSkip}
              data-tip="Пропустить всё вступление (Esc)"
            >
              Пропустить ⏭
            </button>
          )}
          <button type="button" className="btn btn-primary btn-small" onClick={onAdvance}>
            {step + 1 < intro.length
              ? (scene.narrative_intro_next_label || getUiLabel(engine.campaign.meta, 'scene_intro_next', 'Далее ▶'))
              : (scene.narrative_intro_done_label || getUiLabel(engine.campaign.meta, 'scene_intro_done', 'Осмотреться ▶'))}
          </button>
        </div>
      </div>
    </div>
  )
}
