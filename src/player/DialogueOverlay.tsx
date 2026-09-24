import { useState } from 'react'
import type { GameEngine } from '../core/engine'
import { assetUrl } from '../core/loader'
import { tipSeen, markTip } from './tips'

interface Props {
  engine: GameEngine
}

/** Диалоговое окно: портрет (emotion tag из Ink) + текст + варианты (ТЗ 4.5). */
export function DialogueOverlay({ engine }: Props) {
  const d = engine.dialogue
  const [showTip, setShowTip] = useState(() => !tipSeen('dialogue'))
  if (!d) return null

  const lastSpeech = [...d.lines].reverse().find((l) => !l.action)
  const emotion = lastSpeech?.emotion ?? 'neutral'
  const portrait = d.npc.portrait[emotion] ?? d.npc.portrait['neutral']
  const hasCheckChoice = d.choices.some((c) => /\((Убеждение|Торговля|проверка)/i.test(c.text))

  return (
    <div className="overlay dialogue-overlay">
      <div className="dialogue-box">
        <div className="dialogue-portrait">
          {portrait && <img src={assetUrl(engine.campaign, portrait)} alt={d.npc.label} />}
          <div className="dialogue-npc-name">{d.npc.label}</div>
        </div>
        <div className="dialogue-content">
          <div className="dialogue-lines">
            {d.lines.map((l, i) => (
              <p
                key={i}
                className={`${l.action ? 'action' : ''} ${i === d.lines.length - 1 ? 'current' : 'past'}`}
              >
                {l.action ? <>✦ {l.text}</> : l.text}
              </p>
            ))}
          </div>
          {showTip && hasCheckChoice && (
            <div className="dialogue-tip">
              💡 Варианты с пометкой вроде «(Убеждение)» — это <b>проверка навыка</b>: движок бросает
              d100, и если выпало ≤ значения навыка — успех. Чем выше навык, тем больше шанс.
              Результат броска смотрите в журнале (📜).
              <button
                className="btn btn-small"
                onClick={() => {
                  markTip('dialogue')
                  setShowTip(false)
                }}
              >
                Понятно
              </button>
            </div>
          )}
          <div className="dialogue-choices">
            {d.choices.map((c) => (
              <button key={c.index} className="choice-btn" onClick={() => engine.chooseDialogueOption(c.index)}>
                ▸ {c.text}
              </button>
            ))}
            {d.finished && (
              <button className="choice-btn end" onClick={() => engine.endDialogue()}>
                [Закончить разговор]
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
