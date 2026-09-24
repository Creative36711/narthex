import type { GameEngine } from '../core/engine'
import { assetUrl } from '../core/loader'

interface Props {
  engine: GameEngine
}

/** Диалоговое окно: портрет (emotion tag из Ink) + текст + варианты (ТЗ 4.5). */
export function DialogueOverlay({ engine }: Props) {
  const d = engine.dialogue
  if (!d) return null

  const lastLine = d.lines[d.lines.length - 1]
  const emotion = lastLine?.emotion ?? 'neutral'
  const portrait = d.npc.portrait[emotion] ?? d.npc.portrait['neutral']

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
              <p key={i} className={i === d.lines.length - 1 ? 'current' : 'past'}>
                {l.text}
              </p>
            ))}
          </div>
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
